# Harshit's featured improvements: Orbit Support Assistant

This file lists every improvement made to this project, what problem each one solves, and where to find it in the code.

---

## 1. Stopped message spamming

**Problem:** A failed reply came back almost instantly, so you could fire off message after message ("w w w w…"). Every one went to the AI and piled up unanswered.

- **2-second gap between messages.** Sending again too quickly shows "Please wait a moment before sending another message." (`useSupportChat.ts`, `claimSendSlot()`)
- **The server says how long to wait.** When the app blocks you, it sends a standard `Retry-After` header (for example, 42 seconds) instead of a vague "try again later". (`src/lib/rateLimit.ts`, `src/lib/llm.ts`)
- **Live countdown.** Send, Retry and the example questions are disabled, and the page shows "You can send again in 42s".
- **Retry is protected too.** It goes through the same checks as Send, so you can't spam it either.

## 2. No more "API limit reached" after 10–15 questions

**Problem:** Groq's free plan allows 8,000 tokens per minute *per model*. Each question used about 1,300 tokens, so the chat model ran out after 7–8 quick questions.

### Never showing the limit to the user
- **Automatic wait and retry.** When Groq says "try again in 1.2s", the server waits once, if the wait is short, and retries. You just see a slightly slower reply.
- **Backup models.** If `gpt-oss-120b` is out of tokens, the question goes to `gpt-oss-20b`, then to `qwen3.8-27b`. Each has its own free budget.
- **Qwen's "thinking" turned off.** This cut its output from hundreds of tokens to about 50 per answer.
- **Result:** 20 questions answered with no errors, including 14 fired back to back.

### Using fewer tokens
- **Built-in replies for simple messages.** "hi", "thanks" and single characters like "w" get an instant reply without calling the AI. That saves about 1,300 tokens each. (`src/lib/quickReplies.ts`)
- **Answer cache.** Repeated opening questions and triage results are remembered for an hour, so the example-question buttons cost 0 tokens after the first click. (`src/lib/cache.ts`)
- **Shorter system prompt.** Same rules, fewer words, which saves tokens on every question.
- **Less history sent.** The last 6 messages instead of 20, so long chats don't keep getting more expensive.
- **Smaller `max_tokens` limit.** 1500 → 400 for chat and 400 → 200 for triage. Stops runaway answers, and stops Qwen being blocked.
- **Token log per request.** The server prints `[llm] model: 905 in + 82 out = 987 tokens`, so you can measure before optimising.

### Bug fixed along the way
- **"it's not working" failed mid-conversation every time.** The model copied the plain-text style of earlier replies instead of answering in JSON, and each failure was paid for twice.
  - Earlier replies are now sent back to the model as JSON, so it stays consistent.
  - If the model still replies in plain text, that text is used as the answer instead of paying for a second call.

## 3. Built Orbit itself, a working project-management app

**Problem:** The chatbot supported a company that didn't exist, so there was nothing to "help" with and the use case felt pointless.

Orbit is now a working product, and every rule in it matches the FAQ exactly:

| Feature | Where | Matches the FAQ |
|---|---|---|
| Homepage with pricing | `/` | Free / Pro $12 ($10 annual) / Business $24 |
| Login + "Forgot password?" flow | `/login` | Reset link valid 60 minutes, SSO note |
| Dashboard | `/app` | My tasks, overdue items, usage vs plan limits |
| Projects + drag-and-drop task board | `/app/projects` | Free plan capped at 5 projects |
| Members & invites | `/app/settings/members` | Free: 3 users, invites expire after 7 days, invites use a seat |
| Billing | `/app/settings/billing` | Upgrades apply now with a partial charge for the rest of the month; downgrades wait for the next billing date; 30-day refund; cancel keeps access until the period ends; data kept 90 days |
| Security | `/app/settings/security` | 2FA with a QR code and backup codes |
| Data export | `/app/settings/workspace` | Real CSV / JSON download |
| Integrations | `/app/settings/integrations` | Slack, Google Drive, GitHub, Zapier |
| Demo controls | `/app/settings/workspace` | Skip days ahead to see invites expire, the refund window close and renewals happen |

## 4. The chatbot as a Help button inside the app

**Problem:** A standalone chat page can't see who is asking or where they are stuck.

- **Help button on every app screen.** It opens a chat panel, which fills the screen on phones. (`src/components/orbit/HelpWidget.tsx`)
- **It knows who is asking.** Each question includes the user's plan, seats, project count, 2FA status, refund eligibility and current page.
  - Example: "Why can't I create more projects?" → *"You're on the Free plan, which allows up to 5 projects, and you've already reached that limit."*
- **Suggestions for the current page.** The Billing page suggests refund questions; the Members page suggests invite questions.
- **Answers link to the right screen.** Each FAQ has a link, shown as a button under the answer: "Open Billing →", "Invite members →".
- **Human handoff.** "Talk to a human" turns the conversation into a support ticket, with the questions already filled in.
- **AI triage becomes useful.** Every ticket is tagged with a category and urgency ("Billing · High"), and the tickets page puts the most urgent first. That's how a real support team decides what to handle first.

## 5. Cleaner, reusable code

- **One chat hook shared by both UIs.** `useSupportChat.ts` holds sending, retries, timeouts, cooldowns and saving to storage. The full-page help centre and the in-app widget both use it, so there's no duplicated logic.
- **Shared UI pieces.** Message bubbles, triage tags, the typing indicator and the logo live in `src/components/support/parts.tsx`.
- **All the product's rules in one place.** Plans, prices, limits, refund and invite rules are in `src/lib/orbit/model.ts`.
- **All the app's actions in one place.** Every action and its validation (upgrade, refund, invite…) is in `src/components/orbit/OrbitProvider.tsx`.
- **Customer details are validated on the server.** The details sent with each question are checked (zod), labelled as "data, not instructions" in the prompt, and never cached.
- **Timezone bug fixed.** Dates use the user's local day, not UTC. The export was named with yesterday's date before.
- **Ticket subject bug fixed.** "Talk to a human" now uses the *latest* question as the subject (what the user is stuck on now), so tickets get the right triage tags.
- **Code tidied for review.** No duplicated limits, no unused exports, and clearer file names (`HelpCenter.tsx`). Billing renewal logic moved into the pure, testable `model.ts`.

## 6. Tested

- **39 automated unit tests** (`npm test`, Vitest) covering:
  - prices and plan limits
  - invite expiry and the refund window
  - renewals, downgrades and cancellations
  - the rate limiter, the cache and built-in replies
  - request validation
- Typecheck (`npm run typecheck`), lint and a production build all pass.
- Every page loads (HTTP 200).
- End-to-end tests in real Chrome, at desktop and phone sizes, with 0 console errors:
  - project limit
  - invite limit
  - upgrading to Pro
  - refund
  - 2FA
  - CSV export
  - skipping 31 days
  - forgot-password flow
  - Help widget answers and links
  - ticket creation with triage tags
- Stress test: 20 questions, 0 rate-limit errors.

## 8. RAG: retrieval instead of sending every FAQ

**Problem:** All 10 FAQs were sent with every question. That wastes tokens (most were irrelevant) and wouldn't scale to a real help centre with hundreds of articles.

- **Vector index of the FAQs.** Each FAQ (question + answer) is one chunk, embedded into 384 numbers by a local model (all-MiniLM-L6-v2 via transformers.js; no API key, ~40 ms per question). The vectors are saved in `src/lib/rag/faq-index.json` by `npm run build:index`.
- **Semantic search.** Each question is embedded and compared with every FAQ by cosine similarity; the top 3 above a threshold go into the prompt. "Can I get my money back?" finds the refund policy with zero shared words.
- **Follow-ups still work.** "and the bigger one?" is also searched together with the previous question.
- **Tuned with an eval, not a guess.** `npm run eval:retrieval` scores 32 labelled questions (paraphrases, follow-ups, out-of-scope). The chosen setting gives **96% hit@1 and 100% recall@3**. The threshold favours recall, because a missed FAQ causes a wrong "I don't know", while an extra FAQ only costs tokens. The model still says "I don't know" to out-of-scope questions.
- **Result:** input tokens per question dropped from ~1,000 to ~400–550 (roughly half).
- **Safe by design.** A test fails if the FAQs change without rebuilding the index; if the embedding model can't load, the chat falls back to the full knowledge base instead of failing.
- **Deployable.** The embedding runtime ships only its Linux CPU files, so the chat function is ~100 MB (Vercel's limit is 250 MB). Verified on a Vercel preview deployment with real retrieval in the logs.
- **Bugs found by testing on Vercel, not assumed:** the file tracer missed the dynamically loaded native runtime (fixed with explicit includes), and a top-of-file import meant a load failure took down the whole route (fixed by importing lazily so the fallback works).

## 9. Smarter handoff and an assistant that gets noticed

- **"Talk to a human" is earned.** It appears only after the assistant has had a fair try: **7 replies if the conversation is High urgency, 8 for Medium, 10 for Low**. The most urgent triage tag in the chat decides, so an urgent message brings the option forward straight away. (`src/lib/handoff.ts`, unit-tested)
- **New launcher.** A round bot-face button that wiggles every few seconds and shows a "👋 Need help? Ask me anything" teaser, until the visitor opens it once. It respects the reduced-motion setting.
- **On the homepage too.** Logged-out visitors get the assistant with pre-sales suggestions. With no account, it sends no customer details and hands off with a pre-filled email to support instead of an in-app ticket.
- **One shared widget.** `SupportWidget` holds the launcher, panel and handoff rule; the homepage and the app only pass in their greeting, suggestions and handoff form.
- **Tested in the browser:** the teaser and wiggle, the visitor chat, and every threshold (6→7 High, 7→8 Medium, 9→10 Low) with 0 console errors.

## 10. Real database: data moved from the browser to Postgres

**Problem:** All app data lived in the browser's localStorage. A user could edit it to bypass plan limits (50 projects on Free), and anything the assistant knew about the customer came from the browser, so it could be faked.

- **Postgres on Neon (free tier, Singapore).** One row per workspace in the `workspaces` table, with the workspace stored as JSON (`db/schema.sql`).
- **Anonymous sessions.** Every visitor gets a random 256-bit ID in an **HttpOnly, SameSite=Lax** cookie (page scripts can't read it). The database stores only its **SHA-256 hash**, so a leaked database can't be used to log in as anyone.
- **Every change runs on the server.** Server Functions validate the input with zod, apply the same pure rules (`lib/orbit/actions.ts`), and save. Plan limits are now really enforced; unknown actions and invalid arguments are rejected; demo workspaces are size-capped.
- **No two-tab overwrites.** Saves use a `version` column (optimistic concurrency) and retry on conflict.
- **The assistant reads the customer from the database.** The browser only sends which page it's on. A faked "Business plan" in the request is ignored (tested).
- **Operations:** an error page if the database is unreachable, a per-IP limit on creating workspaces, a per-session limit on actions, and a daily cron job that deletes workspaces unused for 7 days.
- **See the data:** `npm run db:inspect`, or the Neon console.
- **Tested against the real database in Chrome:** cookie flags, persistence across reload, isolation between two visitors, and the faked-plan check. 39 unit tests.
- **Bugs caught while switching to async server calls:** clearing a task's assignee sent `undefined`, which doesn't survive the trip to the server (now `null`); and a check `if (!addTask(...))` treated a Promise as the result, so the input never cleared. It compiled, but it was wrong.

## Known limitations

- **Anonymous sessions, not real accounts.** Each browser gets its own 7-day demo workspace; real sign-in would replace the random cookie.
- **The rate limiter and cache live in server memory.** On serverless hosting, a shared store such as Redis would be needed.
- **Free-tier daily token limits still apply.** Roughly 150–200 questions per model per day.
- **The backup models can give weaker answers** than `gpt-oss-120b`.
- **No automated evaluation of answer quality** yet (a labelled question set with scored answers).

## 7. Deployed

- Live at https://orbit-support-assistant.vercel.app (Vercel Hobby, free).
- The Groq key is stored as an encrypted Vercel secret; `.vercelignore` keeps local secrets from being uploaded.
