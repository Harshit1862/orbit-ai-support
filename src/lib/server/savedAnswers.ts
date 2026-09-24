// Model answers saved in Postgres for an hour, so a repeated question (such as
// an example-question button) is answered from the database for 0 tokens.
// Every server instance shares the table, and it survives cold starts. If the
// database can't be reached, the question is simply sent to the model.
import { createHash } from "node:crypto";
import { normalizeQuestion } from "@/lib/questions";
import { sql } from "./db";

const KEEP_FOR = "1 hour";

export type AnswerKind = "chat" | "triage";

export class SavedAnswers<T> {
  constructor(private kind: AnswerKind) {}

  /** The saved answer to this question, if one was saved in the last hour. */
  async get(question: string): Promise<T | undefined> {
    try {
      const rows = await sql()`
        SELECT value FROM saved_answers
        WHERE kind = ${this.kind} AND question_hash = ${questionHash(question)} AND expires_at > now()`;
      return rows[0]?.value as T | undefined;
    } catch (err) {
      console.error(`[saved-answers] ${this.kind} read failed`, err);
      return undefined;
    }
  }

  async save(question: string, value: T): Promise<void> {
    try {
      await sql()`
        INSERT INTO saved_answers (kind, question_hash, value, expires_at)
        VALUES (${this.kind}, ${questionHash(question)}, ${JSON.stringify(value)}, now() + ${KEEP_FOR}::interval)
        ON CONFLICT (kind, question_hash) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`;
    } catch (err) {
      console.error(`[saved-answers] ${this.kind} write failed`, err);
    }
  }
}

/** SHA-256 of the normalised question: short enough to index whatever the question's length. */
function questionHash(question: string): string {
  return createHash("sha256").update(normalizeQuestion(question)).digest("hex");
}
