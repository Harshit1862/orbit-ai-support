// Retrieval eval: does the vector search find the right FAQ?
//
//   npm run eval:retrieval
//
// Each case is a conversation (the user's questions, latest last) and the FAQ
// ids that count as a correct retrieval. An empty list means the question is
// out of scope and nothing should be retrieved, so the assistant says it
// doesn't know. The report sweeps the similarity threshold to choose
// RETRIEVAL.minScore.
import { RETRIEVAL, retrieveFaqs } from "@/lib/rag/retrieve";

interface Case {
  questions: string[];
  expected: string[];
}

const CASES: Case[] = [
  // Paraphrases: little or no word overlap with the FAQ
  { questions: ["Can I get my money back?"], expected: ["refund-policy"] },
  { questions: ["I want a refund"], expected: ["refund-policy"] },
  { questions: ["How long until a refund reaches my card?"], expected: ["refund-policy"] },
  { questions: ["I forgot my password"], expected: ["password-reset"] },
  { questions: ["I can't log in to my account"], expected: ["password-reset"] },
  { questions: ["How much does Orbit cost?"], expected: ["plans-pricing"] },
  { questions: ["Is there a free plan?"], expected: ["plans-pricing"] },
  { questions: ["What does the Business plan include?"], expected: ["plans-pricing"] },
  { questions: ["How do I upgrade to Pro?"], expected: ["change-plan"] },
  { questions: ["Can I switch to a cheaper plan?"], expected: ["change-plan"] },
  { questions: ["How do I cancel my subscription?"], expected: ["cancel-subscription"] },
  { questions: ["What happens to my data if I stop paying?"], expected: ["cancel-subscription"] },
  { questions: ["How do I add a teammate?"], expected: ["invite-members"] },
  { questions: ["My colleague's invitation link expired"], expected: ["invite-members"] },
  { questions: ["How do I turn on two-factor?"], expected: ["two-factor"] },
  { questions: ["I lost my phone with the authenticator app"], expected: ["two-factor"] },
  { questions: ["Can I download my projects as a spreadsheet?"], expected: ["data-export"] },
  { questions: ["How do I back up everything in my workspace?"], expected: ["data-export"] },
  { questions: ["How can I talk to a real person?"], expected: ["contact-support"] },
  { questions: ["When is your support team available?"], expected: ["contact-support"] },
  { questions: ["Does Orbit work with Slack?"], expected: ["integrations"] },
  { questions: ["Do you integrate with Jira?"], expected: ["integrations"] },
  // Questions the in-app widget gets about plan limits
  { questions: ["Why can't I create more projects?"], expected: ["plans-pricing", "change-plan"] },
  { questions: ["Why can't I invite more people?"], expected: ["plans-pricing", "invite-members", "change-plan"] },
  // Follow-ups that only make sense with the previous question
  { questions: ["How much is Pro?", "and the bigger one?"], expected: ["plans-pricing"] },
  { questions: ["How do I enable 2FA?", "what if I lose the codes?"], expected: ["two-factor"] },
  { questions: ["Can I get a refund?", "how long does it take?"], expected: ["refund-policy"] },
  // Out of scope: nothing should be retrieved
  { questions: ["Do you have a mobile app?"], expected: [] },
  { questions: ["What's the weather like today?"], expected: [] },
  { questions: ["Write me a poem about the sea"], expected: [] },
  { questions: ["Is Orbit GDPR compliant?"], expected: [] },
  { questions: ["Who is the CEO of Orbit?"], expected: [] },
];

interface Result {
  hitAt1: number;
  recallAtK: number;
  outOfScopeClean: number;
  avgRetrieved: number;
  failures: string[];
}

async function evaluate(minScore: number): Promise<Result> {
  const inScope = CASES.filter((c) => c.expected.length > 0);
  const outOfScope = CASES.filter((c) => c.expected.length === 0);
  let hitAt1 = 0;
  let recallAtK = 0;
  let clean = 0;
  let retrievedTotal = 0;
  const failures: string[] = [];

  for (const c of CASES) {
    const hits = await retrieveFaqs(c.questions, { ...RETRIEVAL, minScore });
    const ids = hits.map((h) => h.faq.id);
    retrievedTotal += ids.length;
    const label = `"${c.questions.join(" → ")}"`;
    const got = hits.map((h) => `${h.faq.id} ${h.score.toFixed(2)}`).join(", ") || "nothing";
    if (c.expected.length === 0) {
      if (ids.length === 0) clean++;
      else failures.push(`${label}: expected nothing, got ${got}`);
      continue;
    }
    if (c.expected.includes(ids[0])) hitAt1++;
    if (ids.some((id) => c.expected.includes(id))) recallAtK++;
    else failures.push(`${label}: expected ${c.expected.join(" or ")}, got ${got}`);
  }

  return {
    hitAt1: hitAt1 / inScope.length,
    recallAtK: recallAtK / inScope.length,
    outOfScopeClean: clean / outOfScope.length,
    avgRetrieved: retrievedTotal / CASES.length,
    failures,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5);

console.log(`${CASES.length} cases, top-${RETRIEVAL.topK}\n`);
console.log("minScore | hit@1 | recall@3 | out-of-scope clean | avg FAQs in prompt");
for (const minScore of [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]) {
  const r = await evaluate(minScore);
  const marker = minScore === RETRIEVAL.minScore ? "  ← current" : "";
  console.log(`  ${minScore.toFixed(2)}   | ${pct(r.hitAt1)} |  ${pct(r.recallAtK)}   |       ${pct(r.outOfScopeClean)}        |        ${r.avgRetrieved.toFixed(1)}${marker}`);
}

const current = await evaluate(RETRIEVAL.minScore);
console.log(`\nMisses at minScore ${RETRIEVAL.minScore}:`);
console.log(current.failures.length ? current.failures.map((f) => `  - ${f}`).join("\n") : "  none");
