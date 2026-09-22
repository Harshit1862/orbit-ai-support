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
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: z.ZodType<T>;
  maxTokens: number;
  temperature: number;
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
      const completion = await getClient().chat.completions.create({
        model: opts.model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
        response_format: { type: "json_object" },
        max_completion_tokens: opts.maxTokens,
        temperature: opts.temperature,
        // gpt-oss models are reasoning models; low effort keeps replies fast.
        ...(opts.model.includes("gpt-oss") ? { reasoning_effort: "low" as const } : {}),
      });
      content = completion.choices?.[0]?.message?.content;
    } catch (err) {
      // Groq rejects JSON-mode output that fails to parse with a 400
      // "json_validate_failed". Treat that as bad output and retry.
      if (err instanceof APIError && err.status === 400 && String(err.code ?? err.message).includes("json_validate_failed")) {
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
      lastProblem = "response was not JSON";
      continue;
    }
    const result = opts.schema.safeParse(json);
    if (result.success) return result.data;
    lastProblem = "response did not match the expected schema";
  }

  throw new InvalidModelOutputError(lastProblem);
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
    return errorResponse(429, "provider_rate_limited", "The AI service is busy right now. Please wait a few seconds and try again.");
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

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}
