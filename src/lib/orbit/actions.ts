// Every change a user can make to their workspace, as pure functions:
// (current data, current time, ...arguments) → new data, or an error message.
//
// The server runs these (src/app/app/actions.ts) against the workspace stored
// in Postgres, so the rules (plan limits, refund window, ...) are enforced
// where the user can't tamper with them. Each action declares a zod schema for
// its arguments, because they arrive from the browser and can't be trusted.
import { z } from "zod";
import {
  DAY_MS,
  PLAN_RANK,
  PROJECT_COLORS,
  applyDueBilling,
  id,
  periodDays,
  pricePerSeat,
  projectLimit,
  refundDaysLeft,
  seatLimit,
  seatsUsed,
  seedData,
  type Invoice,
  type OrbitData,
} from "./model";

/** Hard caps, so one workspace can't grow without bound in the database. */
export const MAX_ITEMS = { projects: 50, tasks: 500, members: 50, tickets: 100 };

const plan = z.enum(["Free", "Pro", "Business"]);
const cycle = z.enum(["monthly", "annual"]);
const taskStatus = z.enum(["todo", "doing", "done"]);
const itemId = z.string().min(1).max(40);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type Result = OrbitData | string;

function action<Args extends z.ZodTuple>(args: Args, run: (d: OrbitData, now: number, ...args: z.infer<Args>) => Result) {
  return { args, run };
}

export const ACTIONS = {
  // ---- Projects and tasks ----
  createProject: action(z.tuple([z.string().max(60), z.string().max(120)]), (d, now, name, description) => {
    const limit = projectLimit(d.subscription.plan);
    if (limit !== null && d.projects.length >= limit) {
      return `The Free plan includes up to ${limit} projects. Upgrade to Pro for unlimited projects.`;
    }
    if (d.projects.length >= MAX_ITEMS.projects) return `This demo workspace is limited to ${MAX_ITEMS.projects} projects.`;
    if (!name.trim()) return "Please give the project a name.";
    const color = PROJECT_COLORS[d.projects.length % PROJECT_COLORS.length];
    return { ...d, projects: [...d.projects, { id: id(), name: name.trim(), description: description.trim(), color, createdAt: now }] };
  }),

  deleteProject: action(z.tuple([itemId]), (d, _now, projectId) => ({
    ...d,
    projects: d.projects.filter((p) => p.id !== projectId),
    tasks: d.tasks.filter((t) => t.projectId !== projectId),
  })),

  addTask: action(z.tuple([itemId, z.string().max(120), taskStatus]), (d, now, projectId, title, status) => {
    if (!title.trim()) return "Please type a task title.";
    if (!d.projects.some((p) => p.id === projectId)) return "That project no longer exists.";
    if (d.tasks.length >= MAX_ITEMS.tasks) return `This demo workspace is limited to ${MAX_ITEMS.tasks} tasks.`;
    return { ...d, tasks: [...d.tasks, { id: id(), projectId, title: title.trim(), status, createdAt: now }] };
  }),

  /** `null` clears the assignee or due date. */
  updateTask: action(
    z.tuple([
      itemId,
      z.object({
        status: taskStatus.optional(),
        title: z.string().min(1).max(120).optional(),
        assigneeId: itemId.nullable().optional(),
        dueDate: isoDay.nullable().optional(),
      }),
    ]),
    (d, _now, taskId, patch) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id !== taskId
          ? t
          : {
              ...t,
              ...(patch.status && { status: patch.status }),
              ...(patch.title && { title: patch.title }),
              ...(patch.assigneeId !== undefined && { assigneeId: patch.assigneeId ?? undefined }),
              ...(patch.dueDate !== undefined && { dueDate: patch.dueDate ?? undefined }),
            },
      ),
    }),
  ),

  deleteTask: action(z.tuple([itemId]), (d, _now, taskId) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) })),

  // ---- Members ----
  inviteMember: action(z.tuple([z.string().max(254)]), (d, now, email) => {
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return "Please enter a valid email address.";
    if (d.members.some((m) => m.email === address)) return "That person is already a member or has been invited.";
    const limit = seatLimit(d.subscription.plan);
    if (limit !== null && seatsUsed(d, now) >= limit) {
      return `The Free plan includes up to ${limit} users, and pending invitations use a seat too. Upgrade to Pro to add more people.`;
    }
    if (d.members.length >= MAX_ITEMS.members) return `This demo workspace is limited to ${MAX_ITEMS.members} members.`;
    const name = address
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { ...d, members: [...d.members, { id: id(), name, email: address, role: "Member", status: "invited", invitedAt: now }] };
  }),

  resendInvite: action(z.tuple([itemId]), (d, now, memberId) => ({
    ...d,
    members: d.members.map((m) => (m.id === memberId ? { ...m, invitedAt: now } : m)),
  })),

  acceptInvite: action(z.tuple([itemId]), (d, _now, memberId) => ({
    ...d,
    members: d.members.map((m) => (m.id === memberId ? { ...m, status: "active", invitedAt: undefined } : m)),
  })),

  removeMember: action(z.tuple([itemId]), (d, _now, memberId) => {
    if (memberId === "u-me") return "You can't remove yourself from the workspace.";
    return {
      ...d,
      members: d.members.filter((m) => m.id !== memberId),
      tasks: d.tasks.map((t) => (t.assigneeId === memberId ? { ...t, assigneeId: undefined } : t)),
    };
  }),

  // ---- Billing ----
  /** Upgrades take effect now (prorated); downgrades wait for the end of the period. */
  changePlan: action(z.tuple([plan, cycle]), (d, now, newPlan, newCycle) => {
    const sub = d.subscription;
    const seats = seatsUsed(d, now);
    if (newPlan === sub.plan && !sub.pendingPlan) return `You're already on the ${newPlan} plan.`;
    if (newPlan === sub.plan) return { ...d, subscription: { ...sub, pendingPlan: undefined } };

    if (sub.plan === "Free") {
      const amount = pricePerSeat(newPlan, newCycle) * seats * (newCycle === "annual" ? 12 : 1);
      const invoice: Invoice = { id: id(), date: now, description: `${newPlan} plan, ${seats} users (${newCycle})`, amount, status: "paid" };
      return {
        ...d,
        subscription: { plan: newPlan, cycle: newCycle, purchasedAt: now, renewsAt: now + periodDays(newCycle) * DAY_MS },
        invoices: [invoice, ...d.invoices],
      };
    }
    if (PLAN_RANK[newPlan] > PLAN_RANK[sub.plan]) {
      // Charge only the price difference for the rest of the current period.
      const remaining = Math.max(0, ((sub.renewsAt ?? now) - now) / (periodDays(sub.cycle) * DAY_MS));
      const diff = (pricePerSeat(newPlan, sub.cycle) - pricePerSeat(sub.plan, sub.cycle)) * seats * (sub.cycle === "annual" ? 12 : 1);
      const amount = Math.round(diff * remaining * 100) / 100;
      const invoice: Invoice = { id: id(), date: now, description: `Upgrade to ${newPlan} (prorated)`, amount, status: "paid" };
      return { ...d, subscription: { ...sub, plan: newPlan, pendingPlan: undefined, canceledAt: undefined }, invoices: [invoice, ...d.invoices] };
    }
    return { ...d, subscription: { ...sub, pendingPlan: newPlan } };
  }),

  cancelSubscription: action(z.tuple([]), (d, now) => {
    if (d.subscription.plan === "Free") return "You're on the Free plan, so there's nothing to cancel.";
    return { ...d, subscription: { ...d.subscription, canceledAt: now, pendingPlan: undefined } };
  }),

  resumeSubscription: action(z.tuple([]), (d) => ({ ...d, subscription: { ...d.subscription, canceledAt: undefined } })),

  /** A full refund within 30 days of purchase; the workspace returns to Free. */
  requestRefund: action(z.tuple([]), (d, now) => {
    const sub = d.subscription;
    if (refundDaysLeft(sub, now) <= 0) return "Refunds are only available within 30 days of purchase.";
    const since = sub.purchasedAt ?? now;
    return {
      ...d,
      subscription: { plan: "Free", cycle: sub.cycle },
      invoices: d.invoices.map((inv) => (inv.date >= since && inv.status === "paid" ? { ...inv, status: "refund pending" } : inv)),
    };
  }),

  // ---- Security ----
  enableTwoFactor: action(z.tuple([z.string().max(10)]), (d, _now, code) => {
    if (!/^\d{6}$/.test(code.trim())) return "Enter the 6-digit code from your authenticator app.";
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomUUID().replace(/-/g, "").slice(0, 10).replace(/(.{5})/, "$1-"),
    );
    return { ...d, security: { twoFactor: true, backupCodes } };
  }),

  disableTwoFactor: action(z.tuple([]), (d) => ({ ...d, security: { twoFactor: false, backupCodes: [] } })),

  // ---- Workspace and integrations ----
  renameWorkspace: action(z.tuple([z.string().max(40)]), (d, _now, name) =>
    name.trim() ? { ...d, workspace: { name: name.trim() } } : "The workspace needs a name.",
  ),

  toggleIntegration: action(z.tuple([z.enum(["slack", "drive", "github", "zapier"])]), (d, _now, integration) => ({
    ...d,
    integrations: { ...d.integrations, [integration]: !d.integrations[integration] },
  })),

  // ---- Support tickets (human handoff from the assistant) ----
  addTicket: action(
    z.tuple([
      z.object({
        subject: z.string().trim().min(1).max(120),
        message: z.string().max(2000),
        category: z.enum(["Billing", "Technical", "Account", "Other"]).optional(),
        urgency: z.enum(["Low", "Medium", "High"]).optional(),
      }),
    ]),
    (d, now, ticket) => {
      if (d.tickets.length >= MAX_ITEMS.tickets) return `This demo workspace is limited to ${MAX_ITEMS.tickets} tickets.`;
      return { ...d, tickets: [{ ...ticket, id: id(), createdAt: now, status: "open" }, ...d.tickets] };
    },
  ),

  setTicketStatus: action(z.tuple([itemId, z.enum(["open", "resolved"])]), (d, _now, ticketId, status) => ({
    ...d,
    tickets: d.tickets.map((t) => (t.id === ticketId ? { ...t, status } : t)),
  })),

  // ---- Demo controls ----
  /** Moves the workspace's clock forward, to see invites expire, refund windows close and renewals happen. */
  skipDays: action(z.tuple([z.number().int().min(1).max(365)]), (d, now, days) => {
    const next = { ...d, clockOffsetMs: d.clockOffsetMs + days * DAY_MS };
    return applyDueBilling(next, now + days * DAY_MS);
  }),

  resetDemo: action(z.tuple([]), (d, now) => seedData(now - d.clockOffsetMs)),
};

export type ActionName = keyof typeof ACTIONS;
export type ActionArgs<N extends ActionName> = z.infer<(typeof ACTIONS)[N]["args"]>;

/** Validates untrusted arguments, then runs the action. */
export function runAction(name: string, data: OrbitData, now: number, rawArgs: unknown): Result {
  if (!Object.hasOwn(ACTIONS, name)) return "Unknown action.";
  const { args, run } = ACTIONS[name as ActionName];
  const parsed = args.safeParse(rawArgs);
  if (!parsed.success) return "That request wasn't valid. Please try again.";
  return (run as (d: OrbitData, now: number, ...args: unknown[]) => Result)(data, now, ...parsed.data);
}
