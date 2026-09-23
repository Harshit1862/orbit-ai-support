// The Orbit product itself: data types, plan rules and demo seed data.
// Every rule here matches the knowledge base in src/lib/faqs.ts, so what the
// help assistant says is exactly what the app does.
import type { ChatContext } from "@/lib/types";

export type Plan = "Free" | "Pro" | "Business";
export type BillingCycle = "monthly" | "annual";
export type TaskStatus = "todo" | "doing" | "done";
export type IntegrationId = "slack" | "drive" | "github" | "zapier";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Member";
  status: "active" | "invited";
  invitedAt?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assigneeId?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  createdAt: number;
}

export interface Invoice {
  id: string;
  date: number;
  description: string;
  amount: number;
  status: "paid" | "refund pending";
}

export interface Ticket {
  id: string;
  createdAt: number;
  subject: string;
  message: string;
  category?: string;
  urgency?: string;
  status: "open" | "resolved";
}

export interface Subscription {
  plan: Plan;
  cycle: BillingCycle;
  /** When the current paid plan was bought (starts the 30-day refund window). */
  purchasedAt?: number;
  /** End of the current billing period. */
  renewsAt?: number;
  /** A downgrade waiting for the end of the period. */
  pendingPlan?: Plan;
  /** Set when cancelled: access continues until renewsAt. */
  canceledAt?: number;
}

export interface OrbitData {
  version: 1;
  user: { name: string; email: string };
  workspace: { name: string };
  subscription: Subscription;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  security: { twoFactor: boolean; backupCodes: string[] };
  integrations: Record<IntegrationId, boolean>;
  tickets: Ticket[];
  /** Demo-only: how far the clock has been skipped ahead, to see time-based rules. */
  clockOffsetMs: number;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const FREE_LIMITS = { users: 3, projects: 5 };
export const REFUND_WINDOW_DAYS = 30;
export const INVITE_EXPIRY_DAYS = 7;
export const DATA_RETENTION_DAYS = 90;

export const PLANS: { name: Plan; tagline: string; features: string[] }[] = [
  { name: "Free", tagline: "For trying Orbit out", features: ["Up to 3 users", "Up to 5 projects", "Boards and tasks"] },
  { name: "Pro", tagline: "For growing teams", features: ["Unlimited users", "Unlimited projects", "$10/user when billed annually"] },
  { name: "Business", tagline: "For companies", features: ["Everything in Pro", "SSO", "Audit logs", "Priority support (4-hour response)"] },
];

export const PLAN_RANK: Record<Plan, number> = { Free: 0, Pro: 1, Business: 2 };

/** Price per user per month, in dollars. */
export function pricePerSeat(plan: Plan, cycle: BillingCycle): number {
  if (plan === "Pro") return cycle === "annual" ? 10 : 12;
  if (plan === "Business") return 24;
  return 0;
}

export function periodDays(cycle: BillingCycle): number {
  return cycle === "annual" ? 365 : 30;
}

/** Every member, including pending invitations, uses one seat. */
export function seatsUsed(data: OrbitData, now: number): number {
  return data.members.filter((m) => !isInviteExpired(m, now)).length;
}

export function isInviteExpired(m: Member, now: number): boolean {
  return m.status === "invited" && m.invitedAt !== undefined && now - m.invitedAt > INVITE_EXPIRY_DAYS * DAY_MS;
}

export function inviteDaysLeft(m: Member, now: number): number {
  return Math.max(0, Math.ceil(((m.invitedAt ?? now) + INVITE_EXPIRY_DAYS * DAY_MS - now) / DAY_MS));
}

export function seatLimit(plan: Plan): number | null {
  return plan === "Free" ? FREE_LIMITS.users : null;
}

export function projectLimit(plan: Plan): number | null {
  return plan === "Free" ? FREE_LIMITS.projects : null;
}

/** A full refund is available within 30 days of buying a paid plan. */
export function refundDaysLeft(sub: Subscription, now: number): number {
  if (sub.plan === "Free" || sub.purchasedAt === undefined) return 0;
  return Math.max(0, Math.ceil((sub.purchasedAt + REFUND_WINDOW_DAYS * DAY_MS - now) / DAY_MS));
}

/** Applies billing events that are due: renewals, scheduled downgrades, cancellations. */
export function applyDueBilling(d: OrbitData, now: number): OrbitData {
  let sub = d.subscription;
  const invoices = [...d.invoices];
  while (sub.plan !== "Free" && sub.renewsAt !== undefined && sub.renewsAt <= now) {
    const periodEnd: number = sub.renewsAt;
    if (sub.canceledAt || sub.pendingPlan === "Free") {
      sub = { plan: "Free", cycle: sub.cycle };
      break;
    }
    const plan = sub.pendingPlan ?? sub.plan;
    const amount = pricePerSeat(plan, sub.cycle) * seatsUsed(d, periodEnd) * (sub.cycle === "annual" ? 12 : 1);
    invoices.unshift({ id: id(), date: periodEnd, description: `${plan} plan renewal (${sub.cycle})`, amount, status: "paid" });
    sub = { ...sub, plan, pendingPlan: undefined, renewsAt: periodEnd + periodDays(sub.cycle) * DAY_MS };
  }
  return sub === d.subscription ? d : { ...d, subscription: sub, invoices };
}

/** The workspace's current time (real time plus any demo "skip ahead"). */
export function workspaceNow(d: OrbitData): number {
  return Date.now() + d.clockOffsetMs;
}

/** What the assistant is told about this customer; built on the server from stored data. */
export function chatContextFor(d: OrbitData, now: number, page: string): ChatContext {
  return {
    page,
    plan: d.subscription.plan,
    billingCycle: d.subscription.cycle,
    subscription: describeSubscription(d.subscription),
    seatsUsed: seatsUsed(d, now),
    seatLimit: seatLimit(d.subscription.plan),
    projects: d.projects.length,
    projectLimit: projectLimit(d.subscription.plan),
    twoFactorEnabled: d.security.twoFactor,
    refundEligible: refundDaysLeft(d.subscription, now) > 0,
  };
}

export function describeSubscription(sub: Subscription): string {
  if (sub.plan === "Free") return "free";
  if (sub.canceledAt) return `cancelled, access until ${formatDate(sub.renewsAt ?? 0)}`;
  if (sub.pendingPlan) return `active, changes to ${sub.pendingPlan} on ${formatDate(sub.renewsAt ?? 0)}`;
  return `active, renews ${formatDate(sub.renewsAt ?? 0)}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function id(): string {
  return crypto.randomUUID().slice(0, 8);
}

export const PROJECT_COLORS = ["#818cf8", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#fb7185"];

/** YYYY-MM-DD in the user's own timezone (toISOString would give the UTC date). */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A believable workspace to explore: Free plan, 4 of 5 projects, 3 of 3 seats. */
export function seedData(now: number): OrbitData {
  const me = { id: "u-me", name: "Harshit", email: "harshit@acme.example", role: "Admin" as const, status: "active" as const };
  const members: Member[] = [
    me,
    { id: "u-priya", name: "Priya Sharma", email: "priya@acme.example", role: "Member", status: "active" },
    { id: "u-arjun", name: "Arjun Mehta", email: "arjun@acme.example", role: "Member", status: "invited", invitedAt: now - 5 * DAY_MS },
  ];
  const projects: Project[] = [
    { id: "p-web", name: "Website redesign", description: "New marketing site for the spring launch", color: PROJECT_COLORS[0], createdAt: now - 40 * DAY_MS },
    { id: "p-app", name: "Mobile app MVP", description: "First version of the iOS and Android app", color: PROJECT_COLORS[3], createdAt: now - 25 * DAY_MS },
    { id: "p-launch", name: "Q3 launch campaign", description: "Emails, ads and the launch-day checklist", color: PROJECT_COLORS[2], createdAt: now - 12 * DAY_MS },
    { id: "p-hiring", name: "Hiring", description: "Open roles and interview pipeline", color: PROJECT_COLORS[4], createdAt: now - 6 * DAY_MS },
  ];
  const t = (projectId: string, title: string, status: TaskStatus, assigneeId?: string, dueInDays?: number): Task => ({
    id: id(),
    projectId,
    title,
    status,
    assigneeId,
    dueDate: dueInDays === undefined ? undefined : isoDate(now + dueInDays * DAY_MS),
    createdAt: now,
  });
  const tasks: Task[] = [
    t("p-web", "Write homepage copy", "done", "u-priya", -3),
    t("p-web", "Design pricing page", "doing", "u-me", 2),
    t("p-web", "Set up analytics", "todo", "u-priya", 5),
    t("p-web", "Accessibility review", "todo", undefined, 9),
    t("p-app", "Login screen", "done", "u-me", -8),
    t("p-app", "Push notifications", "doing", "u-priya", 1),
    t("p-app", "Offline mode spike", "todo", "u-me", 12),
    t("p-launch", "Draft launch email", "doing", "u-me", 0),
    t("p-launch", "Book ad slots", "todo", "u-priya", 4),
    t("p-launch", "Press kit", "done", "u-priya", -1),
    t("p-hiring", "Post frontend role", "done", "u-me", -2),
    t("p-hiring", "Schedule interviews", "todo", "u-me", 3),
  ];
  return {
    version: 1,
    user: { name: me.name, email: me.email },
    workspace: { name: "Acme Inc." },
    subscription: { plan: "Free", cycle: "monthly" },
    members,
    projects,
    tasks,
    invoices: [],
    security: { twoFactor: false, backupCodes: [] },
    integrations: { slack: false, drive: false, github: false, zapier: false },
    tickets: [],
    clockOffsetMs: 0,
  };
}
