// Server-only LLM access. The API key is read from the server environment and
// never sent to the browser (it has no NEXT_PUBLIC_ prefix, so Next.js does not
// bundle it into client code).
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "openai";
import type { z } from "zod";

// Groq exposes an OpenAI-compatible API, so the official OpenAI SDK works with
// a different base URL. Any OpenAI-compatible provider can be swapped in via env.
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
export const CHAT_MODEL = process.env.CHAT_MODEL ?? "openai/gpt-oss-120b";
// Classification is a simple task, so a smaller, faster model is enough.
export const TRIAGE_MODEL = process.env.TRIAGE_MODEL ?? "openai/gpt-oss-20b";
// Groq's free tier limits tokens per minute *per model*. When the chat model's
// budget is used up, the next model in this list (with its own budget) answers.
export const CHAT_FALLBACK_MODELS = (process.env.CHAT_FALLBACK_MODELS ?? "openai/gpt-oss-20b,qwen/qwen3.8-27b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// A per-minute limit usually frees up within a second or two; waiting that long
// is better than failing. Longer waits (e.g. a daily limit) move on instead.
const MAX_RATE_LIMIT_WAIT_MS = 2_500;

const REQUEST_TIMEOUT_MS = 20_000;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ConfigError("GROQ_API_KEY is not set");
  // maxRetries: 0 keeps the worst-case latency predictable; the UI offers a
  // Retry button instead of the server silently retrying for a long time.
  client ??= new OpenAI({ apiKey, baseURL: BASE_URL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  return client;
}

export class ConfigError extends Error {}
/** The model answered, but not in the shape we asked for. */
export class InvalidModelOutputError extends Error {}

interface JsonCompletionOptions<T> {
  /** Models to try in order; later ones are used only if earlier ones are rate-limited. */
  models: string[];
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: z.ZodType<T>;
  maxTokens: number;
  temperature: number;
  /**
   * Turns a plain-text reply into a result. Models sometimes answer in plain
   * text despite JSON mode; accepting that text avoids paying for a retry.
   */
  fromPlainText?: (text: string) => T;
}

/**
 * Calls the model in JSON mode and validates the result against `schema`.
 * Retries once if the output is not valid JSON or does not match the schema.
 */
export async function completeJson<T>(opts: JsonCompletionOptions<T>): Promise<T> {
  const MAX_ATTEMPTS = 2;
  let lastProblem = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let content: string | null | undefined;
    try {
      const completion = await createWithFallback(opts.models, (model) => ({
        model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        response_format: { type: "json_object" },
        max_completion_tokens: opts.maxTokens,
        temperature: opts.temperature,
        ...reasoningParams(model),
      }));
      content = completion.choices?.[0]?.message?.content;
      logUsage(completion.model, completion.usage);
    } catch (err) {
      // Groq rejects JSON-mode output that fails to parse with a 400
      // "json_validate_failed". Treat that as bad output and retry.
      if (err instanceof APIError && err.status === 400 && String(err.code ?? err.message).includes("json_validate_failed")) {
        const text = (err.error as { failed_generation?: unknown } | undefined)?.failed_generation;
        const salvaged = typeof text === "string" ? salvagePlainText(text, opts.fromPlainText) : undefined;
        if (salvaged !== undefined) return salvaged;
        lastProblem = "provider rejected malformed JSON";
        continue;
      }
      throw err;
    }

    if (!content) {
      lastProblem = "empty response";
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      const salvaged = salvagePlainText(content, opts.fromPlainText);
      if (salvaged !== undefined) return salvaged;
      lastProblem = "response was not JSON";
      continue;
    }
    const result = opts.schema.safeParse(json);
    if (result.success) return result.data;
    lastProblem = "response did not match the expected schema";
  }

  throw new InvalidModelOutputError(lastProblem);
}

/** Uses a plain-text reply as-is, unless it looks like broken JSON. */
function salvagePlainText<T>(text: string, fromPlainText?: (text: string) => T): T | undefined {
  const trimmed = text.trim();
  if (!fromPlainText || !trimmed || trimmed.startsWith("{")) return undefined;
  console.warn("[llm] model replied in plain text; using it instead of retrying");
  return fromPlainText(trimmed);
}

/**
 * Hidden reasoning is billed as output tokens, and our tasks (answering from a
 * short FAQ, picking two labels) need very little of it.
 */
function reasoningParams(model: string): Partial<OpenAI.ChatCompletionCreateParamsNonStreaming> {
  if (model.includes("gpt-oss")) return { reasoning_effort: "low" };
  // Qwen 3 thinks at length by default; Groq's "none" turns that off.
  if (model.includes("qwen3")) return { reasoning_effort: "none" };
  return {};
}

/**
 * Sends the request to the first model in `models`. If the provider rate-limits
 * it, waits briefly and retries once when the wait is short, otherwise moves on
 * to the next model. Rethrows the last rate-limit error if every model is busy.
 */
async function createWithFallback(
  models: string[],
  params: (model: string) => OpenAI.ChatCompletionCreateParamsNonStreaming,
): Promise<OpenAI.ChatCompletion> {
  let lastError: unknown = new Error("No models configured");
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await getClient().chat.completions.create(params(model));
      } catch (err) {
        if (!(err instanceof RateLimitError)) throw err;
        lastError = err;
        const waitMs = retryAfterMs(err);
        if (attempt === 1 && waitMs !== null && waitMs <= MAX_RATE_LIMIT_WAIT_MS) {
          console.warn(`[llm] ${model} rate-limited, retrying in ${waitMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitMs + 100));
          continue;
        }
        console.warn(`[llm] ${model} rate-limited, trying the next model`);
        break;
      }
    }
  }
  throw lastError;
}

/** How long the provider asked us to wait, from the header or Groq's error text. */
function retryAfterMs(err: RateLimitError): number | null {
  const header = Number(err.headers?.get("retry-after"));
  if (header > 0) return header * 1000;
  // e.g. "Please try again in 3.42s" or "... in 705ms"
  const match = /try again in ([\d.]+)(ms|s)\b/.exec(err.message);
  if (!match) return null;
  return Math.ceil(Number(match[1]) * (match[2] === "s" ? 1000 : 1));
}

/** One log line per model call, so token spend is visible while developing. */
function logUsage(model: string, usage: OpenAI.CompletionUsage | undefined) {
  if (!usage) return;
  const reasoning = usage.completion_tokens_details?.reasoning_tokens;
  console.info(
    `[llm] ${model}: ${usage.prompt_tokens} in + ${usage.completion_tokens} out` +
      (reasoning ? ` (${reasoning} reasoning)` : "") +
      ` = ${usage.total_tokens} tokens`,
  );
}

/** Maps any error from an LLM call to a safe, user-friendly API response. */
export function llmErrorResponse(err: unknown): Response {
  // Full details go to the server log only; the client gets a generic message.
  console.error("[llm]", err);

  if (err instanceof ConfigError) {
    return errorResponse(500, "config_error", "The assistant is not configured correctly. Please contact the site owner.");
  }
  if (err instanceof APIConnectionTimeoutError) {
    return errorResponse(504, "timeout", "The AI service took too long to respond. Please try again.");
  }
  if (err instanceof RateLimitError) {
    // Pass the provider's wait time on, so the UI can count down instead of guessing.
    const waitSeconds = Math.max(1, Math.ceil((retryAfterMs(err) ?? 5_000) / 1000));
    return errorResponse(429, "provider_rate_limited", "The AI service is busy right now. Please wait a few seconds and try again.", {
      "Retry-After": String(waitSeconds),
    });
  }
  if (err instanceof AuthenticationError) {
    return errorResponse(500, "config_error", "The assistant is not configured correctly. Please contact the site owner.");
  }
  if (err instanceof InvalidModelOutputError) {
    return errorResponse(502, "invalid_response", "The AI returned an unexpected response. Please try again.");
  }
  if (err instanceof APIConnectionError || err instanceof APIError) {
    return errorResponse(502, "upstream_error", "The AI service is unavailable right now. Please try again shortly.");
  }
  return errorResponse(500, "internal_error", "Something went wrong on our side. Please try again.");
}

export function errorResponse(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

export function rateLimitedResponse(waitSeconds: number, message: string): Response {
  return errorResponse(429, "rate_limited", message, { "Retry-After": String(waitSeconds) });
}
