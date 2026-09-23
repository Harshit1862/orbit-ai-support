import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  applyDueBilling,
  inviteDaysLeft,
  isInviteExpired,
  pricePerSeat,
  projectLimit,
  refundDaysLeft,
  seatLimit,
  seatsUsed,
  seedData,
  type Member,
} from "./model";

const NOW = Date.UTC(2026, 8, 23);

describe("plans and prices (must match the FAQ)", () => {
  it("prices Pro at $12 monthly or $10 annually, and Business at $24", () => {
    expect(pricePerSeat("Pro", "monthly")).toBe(12);
    expect(pricePerSeat("Pro", "annual")).toBe(10);
    expect(pricePerSeat("Business", "monthly")).toBe(24);
    expect(pricePerSeat("Free", "monthly")).toBe(0);
  });

  it("limits the Free plan to 3 users and 5 projects, and paid plans not at all", () => {
    expect(seatLimit("Free")).toBe(3);
    expect(projectLimit("Free")).toBe(5);
    expect(seatLimit("Pro")).toBeNull();
    expect(projectLimit("Business")).toBeNull();
  });
});

describe("invitations", () => {
  const invite = (daysAgo: number): Member => ({
    id: "x",
    name: "X",
    email: "x@example.com",
    role: "Member",
    status: "invited",
    invitedAt: NOW - daysAgo * DAY_MS,
  });

  it("expire after 7 days", () => {
    expect(isInviteExpired(invite(6), NOW)).toBe(false);
    expect(isInviteExpired(invite(8), NOW)).toBe(true);
    expect(inviteDaysLeft(invite(5), NOW)).toBe(2);
  });

  it("use a seat until they expire", () => {
    const data = seedData(NOW); // 2 active members + 1 invite sent 5 days ago
    expect(seatsUsed(data, NOW)).toBe(3);
    expect(seatsUsed(data, NOW + 3 * DAY_MS)).toBe(2);
  });
});

describe("refunds", () => {
  it("are available for 30 days after buying a paid plan", () => {
    const sub = { plan: "Pro" as const, cycle: "monthly" as const, purchasedAt: NOW, renewsAt: NOW + 30 * DAY_MS };
    expect(refundDaysLeft(sub, NOW + 10 * DAY_MS)).toBe(20);
    expect(refundDaysLeft(sub, NOW + 31 * DAY_MS)).toBe(0);
  });

  it("don't apply to the Free plan", () => {
    expect(refundDaysLeft({ plan: "Free", cycle: "monthly" }, NOW)).toBe(0);
  });
});

describe("billing when a period ends", () => {
  const onPro = (extra: object = {}) => {
    const data = seedData(NOW);
    data.subscription = { plan: "Pro", cycle: "monthly", purchasedAt: NOW, renewsAt: NOW + 30 * DAY_MS, ...extra };
    return data;
  };

  it("does nothing before the renewal date", () => {
    const data = onPro();
    expect(applyDueBilling(data, NOW + 29 * DAY_MS)).toBe(data);
  });

  it("renews and issues an invoice for the seats in use", () => {
    const next = applyDueBilling(onPro(), NOW + 31 * DAY_MS);
    expect(next.subscription.plan).toBe("Pro");
    expect(next.subscription.renewsAt).toBe(NOW + 60 * DAY_MS);
    // The pending invite has expired by then, so 2 seats × $12.
    expect(next.invoices[0]).toMatchObject({ amount: 24, status: "paid" });
  });

  it("applies a scheduled downgrade", () => {
    const next = applyDueBilling(onPro({ pendingPlan: "Free" }), NOW + 31 * DAY_MS);
    expect(next.subscription.plan).toBe("Free");
    expect(next.invoices).toHaveLength(0);
  });

  it("ends a cancelled subscription without charging", () => {
    const next = applyDueBilling(onPro({ canceledAt: NOW }), NOW + 31 * DAY_MS);
    expect(next.subscription.plan).toBe("Free");
    expect(next.invoices).toHaveLength(0);
  });
});
