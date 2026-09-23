import { describe, expect, it } from "vitest";
import { MAX_ITEMS, runAction } from "./actions";
import { DAY_MS, seedData, type OrbitData } from "./model";

const NOW = Date.UTC(2026, 8, 23);
const data = () => seedData(NOW); // Free plan, 4 projects, 3 of 3 seats

const ok = (result: OrbitData | string): OrbitData => {
  if (typeof result === "string") throw new Error(`expected data, got error: ${result}`);
  return result;
};

describe("runAction: untrusted input", () => {
  it("rejects unknown actions and invalid arguments", () => {
    expect(runAction("dropDatabase", data(), NOW, [])).toBe("Unknown action.");
    expect(runAction("toString", data(), NOW, [])).toBe("Unknown action.");
    expect(runAction("createProject", data(), NOW, [123, "x"])).toMatch(/wasn't valid/);
    expect(runAction("changePlan", data(), NOW, ["Enterprise", "monthly"])).toMatch(/wasn't valid/);
    expect(runAction("skipDays", data(), NOW, [100000])).toMatch(/wasn't valid/);
  });
});

describe("plan limits are enforced", () => {
  it("allows a 5th project on Free but not a 6th", () => {
    const five = ok(runAction("createProject", data(), NOW, ["Fifth", ""]));
    expect(five.projects).toHaveLength(5);
    expect(runAction("createProject", five, NOW, ["Sixth", ""])).toMatch(/Free plan includes up to 5 projects/);
  });

  it("blocks invites past 3 seats on Free, and allows them after upgrading", () => {
    expect(runAction("inviteMember", data(), NOW, ["new@acme.example"])).toMatch(/up to 3 users/);
    const pro = ok(runAction("changePlan", data(), NOW, ["Pro", "monthly"]));
    expect(ok(runAction("inviteMember", pro, NOW, ["new@acme.example"])).members).toHaveLength(4);
  });

  it("caps demo workspaces so they can't grow without bound", () => {
    let d = ok(runAction("changePlan", data(), NOW, ["Pro", "monthly"]));
    d = { ...d, tasks: Array.from({ length: MAX_ITEMS.tasks }, (_, i) => ({ ...d.tasks[0], id: `t${i}` })) };
    expect(runAction("addTask", d, NOW, ["p-web", "One more", "todo"])).toMatch(/limited to 500 tasks/);
  });
});

describe("billing", () => {
  it("charges seats × price when upgrading from Free, and refunds within 30 days", () => {
    const pro = ok(runAction("changePlan", data(), NOW, ["Pro", "monthly"]));
    expect(pro.invoices[0]).toMatchObject({ amount: 36, status: "paid" }); // 3 seats × $12
    const refunded = ok(runAction("requestRefund", pro, NOW + 10 * DAY_MS, []));
    expect(refunded.subscription.plan).toBe("Free");
    expect(refunded.invoices[0].status).toBe("refund pending");
    expect(runAction("requestRefund", pro, NOW + 31 * DAY_MS, [])).toMatch(/within 30 days/);
  });
});

describe("tasks", () => {
  it("clears an assignee or due date with null", () => {
    const d = data();
    const task = d.tasks.find((t) => t.assigneeId && t.dueDate)!;
    const next = ok(runAction("updateTask", d, NOW, [task.id, { assigneeId: null, dueDate: null }]));
    const updated = next.tasks.find((t) => t.id === task.id);
    expect(updated).toBeDefined();
    expect(updated?.assigneeId).toBeUndefined();
    expect(updated?.dueDate).toBeUndefined();
  });
});
