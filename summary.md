# Project summary: what every file and folder does

This guide walks through the project in a sensible reading order: the big picture first, then each folder and file with a plain explanation of its job.

---

## The big picture

```
ai-support-assistant/
├── src/            ← all the app's source code (the important part)
│   ├── app/        ← pages and API endpoints (every folder here is a URL)
│   ├── components/ ← reusable pieces of UI
│   └── lib/        ← logic with no UI: AI calls, prompts, rules, validation
├── docs/           ← screenshots used by the README
├── config files    ← settings for Next.js, TypeScript, lint, tests, deployment
└── docs (.md)      ← README, summaries, notes
```

**How a question flows through the files:**

```
You type in the assistant (SupportWidget.tsx, via HelpWidget.tsx in the app or PublicHelpWidget.tsx on public pages)
  → useSupportChat.ts sends it
  → api/chat/route.ts checks it (rateLimit.ts, schemas.ts, quickReplies.ts, server/savedAnswers.ts)
  → rag/retrieve.ts embeds the question and finds the top matching FAQs in the vector index
  → llm.ts asks the AI, using prompts.ts + only the retrieved FAQs
  → the answer comes back and is shown by parts.tsx
```

---

## 📁 `src/app/`: pages and API endpoints

In Next.js, **folders become URLs**. `page.tsx` is the page shown at that URL, `layout.tsx` wraps the pages below it, and `route.ts` is a backend endpoint.

### Site-wide files
| File | What it does |
|---|---|
| `layout.tsx` | The outermost wrapper for every page: `<html>`, `<body>`, fonts and the browser-tab title |
| `globals.css` | Global styles: Tailwind setup, animations (fade-in, orbit spin, typing dots), star background, scrollbars, reduced-motion support |
| `favicon.ico` | The small icon in the browser tab |
| `page.tsx` | **Homepage (`/`)**: the marketing page with the hero, features, pricing, the "Open demo" button, and the assistant for visitors |

### 📁 `api/`: the backend (runs on the server, never in the browser)
| File | What it does |
|---|---|
| `api/chat/route.ts` | **The assistant's brain entry point (`POST /api/chat`)**. In order: rate limit → validate the request → built-in reply? → saved answer? → **retrieve the relevant FAQs (RAG)** → build the prompt (+ customer details) → call the AI → attach source links → save the answer → reply |
| `api/classify/route.ts` | **Triage endpoint (`POST /api/classify`)**. Tags a message with a category (Billing / Technical / Account / Other) and urgency (Low / Medium / High), using the smaller AI model |

### 📁 `app/`: the Orbit product (everything under `/app`)
| File | What it does |
|---|---|
| `app/layout.tsx` | Wraps every app page in the **AppShell** (sidebar, top bar, Help button) |
| `app/page.tsx` | **Dashboard (`/app`)**: greeting, task stats, "My tasks", plan usage bars, project cards |
| `app/projects/page.tsx` | **Projects list**: project cards with progress; "New project" (blocked at 5 on the Free plan) |
| `app/projects/[id]/page.tsx` | **Task board for one project**: To do / In progress / Done columns, drag and drop, assignee, due date, delete. `[id]` means the URL part is a variable, e.g. `/app/projects/p-web` |
| `app/support/page.tsx` | **Support tickets**: tickets created by "Talk to a human", sorted by AI urgency, "Mark resolved" |
| `app/settings/layout.tsx` | The "Settings" heading and tab bar shared by all settings pages |
| `app/settings/page.tsx` | Sends `/app/settings` straight to `/app/settings/workspace` |
| `app/settings/workspace/page.tsx` | Rename the workspace, **CSV/JSON export** (real download), **demo controls** (skip days, reset) |
| `app/settings/members/page.tsx` | **Invite members** (Free: 3 max; invites expire after 7 days), resend, "Simulate accept", remove |
| `app/settings/billing/page.tsx` | **Plans and billing**: current plan, upgrade/downgrade, cancel/resume, request refund (30 days), invoices |
| `app/settings/security/page.tsx` | **2FA setup**: QR code, 6-digit check, backup codes, turn off; password-reset info |
| `app/settings/integrations/page.tsx` | Connect/disconnect **Slack, Google Drive, GitHub, Zapier** |

### Other pages
| File | What it does |
|---|---|
| `login/page.tsx` | **Login page (`/login`)**: wraps the form in `<Suspense>`, which Next.js requires when a page reads the URL's `?forgot=1` |
| `login/LoginForm.tsx` | The login form, the "Forgot password?" form and the "Check your email" screen |

---

## 📁 `src/components/`: reusable UI pieces

### 📁 `support/`: the assistant's UI
| File | What it does |
|---|---|
| `useSupportChat.ts` | **The heart of the chat in the browser.** A React hook holding all the chat logic: sending, the 2-second gap, the rate-limit countdown, retries, the 8s "slow" notice and 30s timeout, cancelling, saving chats in session storage. Both chat UIs use it |
| `SupportWidget.tsx` | **The assistant**: the bot launcher (wiggles + "👋 Need help?" teaser until first opened) the **full-screen help centre** with the conversation history on the left, and the **side window**. Minimise: full screen → side window; Expand: back to full screen; Close: hide (conversations are kept); Escape steps down one level. Shows "Talk to a human" only when `handoff.ts` says the assistant has had enough tries |
| `PublicHelpWidget.tsx` | The assistant on the **homepage and login page for logged-out visitors**: pre-sales suggestions, no account details, and a pre-filled support email as the handoff |
| `parts.tsx` | **Shared chat pieces**: message bubble (with "Based on" sources and "Open Billing →" buttons), triage tags, typing indicator, AI avatar, Orbit logo, icons |

### 📁 `orbit/`: the Orbit app's UI
| File | What it does |
|---|---|
| `OrbitProvider.tsx` | **The app's data and actions in the browser.** Starts with the workspace the server loaded, and sends every action (create project, invite, upgrade, refund…) to the server. Simple, predictable changes (dragging a task, toggles) update the screen instantly and are then confirmed by the server |
| `AppShell.tsx` | The **frame of the app**: sidebar navigation, workspace name, "Upgrade to Pro" card, top bar with plan badge, mobile menu, and the Help button |
| `HelpWidget.tsx` | **The assistant inside the app**, built on `SupportWidget`: page-specific suggested questions, sends customer details, and the **"Talk to a human" ticket form** (with AI triage) |
| `SettingsTabs.tsx` | The Workspace / Members / Billing / Security / Integrations tab bar, highlighting the current tab |
| `ui.tsx` | **Small UI kit**: Button, Card, Input, Badge, Notice (error/success), Avatar, ProgressBar, PageHeader. Keeps every screen looking consistent |

---

## 📁 `src/lib/`: logic with no UI

### The AI part
| File | What it does |
|---|---|
| `llm.ts` | **Talks to the AI (Groq).** Forces JSON output, validates it, retries once on bad output, **waits out short rate limits and falls back to other models** (120b → 20b → qwen), controls hidden reasoning, logs token use, and turns every failure into a friendly error. Keeps the API key on the server |
| `prompts.ts` | **The AI's instructions.** The chat system prompt (9 rules + only the retrieved FAQs + the JSON format), the customer-details block, and the triage prompt |
| `faqs.ts` | **The knowledge base**: 10 FAQs (refunds, pricing, 2FA…), each with a link to the screen where it's done in the app |
| `schemas.ts` | **Validation rules (zod)** for what the browser may send (message length, roles, customer details) and what the AI must return (answer + FAQ ids, category + urgency) |
| `handoff.ts` | **When a human is offered**: straight away for High urgency, after 8 bot replies for Medium, 10 for Low (the most urgent message in the chat decides) |
| `quickReplies.ts` | **Answers without calling the AI**: "hi", "thanks" and single characters like "w". Saves about 1,300 tokens each time |
| `questions.ts` | `normalizeQuestion()`, so "Refund?" and "refund" count as the same question |
| `server/savedAnswers.ts` | **Answers saved in Postgres for an hour** (`saved_answers` table), so repeated questions cost 0 tokens |
| `rateLimit.ts` | **Spam protection**: max 15 requests/minute per user, and it works out how many seconds to wait (sent as `Retry-After`) |
| `types.ts` | **Shared TypeScript types** used by both browser and server: Message, Conversation, Triage, Source, ChatContext, the 2,000-character limit |

### 📁 `rag/`: retrieval-augmented generation (finding the right FAQs)
| File | What it does |
|---|---|
| `embeddings.ts` | **Turns text into meaning-vectors** (384 numbers) with a small local AI model, all-MiniLM-L6-v2, running inside the server. No API key. Loaded lazily, so a failure can't break the chat route |
| `chunks.ts` | **Chunking**: how the knowledge base is split into pieces to embed (one FAQ = question + answer), plus a fingerprint to detect a stale index |
| `faq-index.json` | **The vector database on disk**: every FAQ's embedding, built by `npm run build:index`. Generated; don't edit by hand |
| `faqIndex.ts` | Loads `faq-index.json` with its types |
| `vectorStore.ts` | **Vector search**: cosine similarity, and the top K most similar FAQs above a minimum score |
| `retrieve.ts` | **Retrieval**: embeds the question (and previous question + question, for follow-ups), searches the index, returns the best FAQs. Holds the tuned settings: top 3, score ≥ 0.20 |

### The product rules
| File | What it does |
|---|---|
| `orbit/model.ts` | **Orbit's business rules**, written as pure functions: plans and prices, Free limits (3 users / 5 projects), seat counting, invite expiry, refund window, renewals and scheduled downgrades, date formatting, and the demo seed data ("Acme Inc.") |

### Tests (`*.test.ts`, run with `npm test`)
| File | What it checks |
|---|---|
| `orbit/model.test.ts` | Prices, plan limits, invite expiry, refund window, renewals, downgrades, cancellations |
| `rateLimit.test.ts` | Allows up to the limit, gives the right wait time, resets after a minute, counts each user separately |
| `questions.test.ts` | Similar questions count as the same question |
| `quickReplies.test.ts` | Greetings and single characters are answered locally; real questions and "no" go to the AI |
| `schemas.test.ts` | Rejects empty and over-long messages, a conversation ending on a bot message, and bad customer details; normalises triage labels |
| `handoff.test.ts` | "Talk to a human" appears after exactly 7/8/10 replies, and sooner as soon as an urgent message arrives |
| `rag/vectorStore.test.ts` | Vector search ranks by similarity and drops results below the threshold |
| `rag/faqIndex.test.ts` | Fails if `faqs.ts` was edited without rebuilding the vector index |

---

## 📁 `scripts/`: developer commands
| File | What it does |
|---|---|
| `build-faq-index.mts` | **Ingestion** (`npm run build:index`): embeds every FAQ and writes `faq-index.json`. Run after changing FAQs |
| `db-setup.mts` | **Creates the database table** (`npm run db:setup`) from `db/schema.sql`. Safe to run again |
| `db-inspect.mts` | **Shows what's saved** (`npm run db:inspect`): one line per workspace, plus the full JSON of the latest one |
| `eval-retrieval.mts` | **Retrieval eval** (`npm run eval:retrieval`): 32 labelled questions; reports hit@1, recall@3 and out-of-scope behaviour across thresholds |

---

## 📁 `docs/`
| File | What it does |
|---|---|
| `screenshots/help-widget.png` | Help widget answering with the customer's plan; shown at the top of the README |
| `screenshots/dashboard.png` | The dashboard, used in the README |
| `screenshots/tickets.png` | Support tickets with triage tags, used in the README |

---

## 🗄️ Where the data is saved (Postgres)

```
Your browser                         Vercel (server)                          Neon (Postgres, Singapore)
────────────                         ───────────────                          ─────────────────────────
cookie: orbit_session=k3J9…  ──►  proxy.ts gives you the cookie
                                   session.ts: SHA-256(cookie) ──────────►  table "workspaces"
                                   workspaces.ts: load / save   ◄────────►    one ROW per visitor:
                                   app/actions.ts: every change                  session_hash  (not the cookie)
                                                                                 data          (your whole workspace, JSON)
                                                                                 version       (stops two tabs clashing)
                                                                                 last_seen_at  (cleanup after 7 days)
```

| File | What it does |
|---|---|
| `db/schema.sql` | **The table definition**: which columns a workspace row has |
| `src/proxy.ts` | Runs before every `/app` page: gives a new visitor a random, HttpOnly session cookie |
| `src/lib/server/db.ts` | **The connection to Postgres** (Neon's driver, over HTTPS) |
| `src/lib/server/session.ts` | Reads the cookie and turns it into the hash stored in the database |
| `src/lib/server/workspaces.ts` | **Load and save a workspace**: creates it from the demo data on the first visit; saves only if nobody else saved first |
| `src/app/app/actions.ts` | **Server Functions**: every button that changes data calls one of these. Validates, applies the rules, saves |
| `src/lib/orbit/actions.ts` | **Every rule**, e.g. "Free plan: max 5 projects", as a pure function with input validation (tested) |
| `src/app/app/layout.tsx` | Loads your workspace from the database before the app page is shown |
| `src/app/app/error.tsx` | Shown if the database can't be reached, with a "Try again" button |
| `src/app/api/cron/cleanup/route.ts` + `vercel.json` | A daily job that deletes workspaces unused for 7 days |
| `.env.development.local` | 🔒 The database address and password for local development (from `vercel env pull`). Never share it |

**See your data:** `npm run db:inspect` in the terminal, or open **Neon's console** (Vercel dashboard → Storage → orbit-db → "Open in Neon" → **Tables** → `workspaces`).

---

## ⚙️ Configuration files (project root)
| File | What it does |
|---|---|
| `package.json` | Project name, **libraries used** (Next.js, React, zod, openai, Vitest…) and **commands** (`dev`, `build`, `test`, `typecheck`, `lint`) |
| `package-lock.json` | Records the exact version of every library, so everyone installs the same ones. Auto-generated; don't edit |
| `next.config.ts` | Next.js settings: hides the "N" dev badge, and ships only the Linux CPU part of the embedding runtime so the chat function stays ~100 MB (Vercel's limit is 250 MB) |
| `tsconfig.json` | TypeScript settings, including the `@/` shortcut, so `@/lib/llm` means `src/lib/llm` |
| `next-env.d.ts` | Auto-generated type hints for Next.js; don't edit |
| `eslint.config.mjs` | **Lint rules** (the code-quality checker), using Next.js's recommended rules |
| `postcss.config.mjs` | Connects **Tailwind CSS** to the build |
| `vitest.config.mts` | **Test runner settings**: where the tests are, and the `@/` shortcut |
| `.gitignore` | Files git should **never save**: `node_modules`, `.next`, `.env*` (your secret key) and so on |
| `.env.example` | **Template for secrets.** Shows which settings exist (`GROQ_API_KEY`, optional models) without real values. Safe to share |
| `vercel.json` | Vercel settings: schedules the daily cleanup job |
| `.env.local` | 🔒 **Your real secrets**: the Groq API key (and a Vercel token). Ignored by git and never uploaded. Never share it |
| `.vercelignore` | Files **never uploaded to Vercel** (secrets, caches) |
| `.vercel/` | Links this folder to your Vercel project (`project.json`), so `npx vercel deploy` knows where to deploy. Created by Vercel |

---

## 📝 Documentation files
| File | What it is |
|---|---|
| `README.md` | **The main project page** for employers: live demo, screenshots, features, architecture, AI decisions, how to run and test, limitations |
| `harshit_featured.md` | Every improvement made, and the problem each one solves |
| `summary.md` | This file: what every file and folder does |
| `AI_NOTES.md` | Draft notes on how AI tools were used, with "✏️ rewrite in your own words" markers. Finish it or leave it out before submitting |
| `AGENTS.md` | Instructions for AI coding assistants about this Next.js version. Auto-generated by `next dev` |
| `CLAUDE.md` | One line (`@AGENTS.md`) that points Claude Code to `AGENTS.md` |

---

## 🗑️ Auto-generated folders (safe to ignore)
| Folder / file | What it is | Delete? |
|---|---|---|
| `node_modules/` | Downloaded libraries (~500 MB) | Needed to run; `npm install` recreates it |
| `.next/` | Build and dev cache | Safe; comes back automatically |
| `tsconfig.tsbuildinfo` | TypeScript's speed-up cache | Safe; comes back automatically |
| `.git/` | Git's history database | **Never delete**: it holds your version history |

---

## Quick "where do I change…?" guide
| I want to… | Edit |
|---|---|
| Change what the bot knows | `src/lib/faqs.ts`, then run `npm run build:index` |
| Tune retrieval (how many FAQs, strictness) | `RETRIEVAL` in `src/lib/rag/retrieve.ts`, then check with `npm run eval:retrieval` |
| Change how the bot behaves | `src/lib/prompts.ts` |
| Change prices or plan limits | `src/lib/orbit/model.ts` (and the matching FAQ in `faqs.ts`) |
| Change the AI model | `.env.local` (`CHAT_MODEL=...`) or `src/lib/llm.ts` |
| Change the spam limits | `src/lib/rateLimit.ts` (server), `useSupportChat.ts` (browser) |
| Change the assistant's suggestions | `suggestionsFor()` in `src/components/orbit/HelpWidget.tsx` (app) or `PublicHelpWidget.tsx` (homepage) |
| Change when "Talk to a human" appears | `HANDOFF_AFTER_REPLIES` in `src/lib/handoff.ts` |
| Add a new app page | Create `src/app/app/<name>/page.tsx` and add it to `NAV` in `AppShell.tsx` |
