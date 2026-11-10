import { describe, expect, it } from "vitest";
import { advanceDueDate, attentionFlags, billingState, monthlyValue, trialState } from "./status";
import { isOwnerEmail } from "./allowlist";

const NOW = Date.parse("2026-11-10T12:00:00Z");

describe("trialState", () => {
  it("counts days left", () => {
    expect(trialState("2026-11-20T12:00:00Z", 0, NOW)).toEqual({ kind: "trialing", daysLeft: 10 });
  });
  it("expires", () => {
    expect(trialState("2026-11-07T12:00:00Z", 0, NOW)).toEqual({ kind: "expired", daysAgo: 3 });
  });
  it("paying wins over trial", () => {
    expect(trialState("2026-11-07T12:00:00Z", 50, NOW)).toEqual({ kind: "paying" });
  });
  it("no trial date", () => {
    expect(trialState(null, 0, NOW)).toEqual({ kind: "none" });
  });
});

describe("billingState", () => {
  it("overdue when balance owing past due date", () => {
    expect(billingState(100, "2026-11-01", 100, NOW)).toEqual({ kind: "overdue", daysOverdue: 9 });
  });
  it("due soon", () => {
    expect(billingState(100, "2026-11-13", 100, NOW)).toEqual({ kind: "due_soon", dueInDays: 3 });
  });
  it("settled when nothing owed and due far away", () => {
    expect(billingState(0, "2026-12-30", 100, NOW)).toEqual({ kind: "settled" });
  });
  it("not set without a price", () => {
    expect(billingState(0, null, null, NOW)).toEqual({ kind: "not_set" });
  });
});

describe("money helpers", () => {
  it("normalises to monthly", () => {
    expect(monthlyValue(120, "yearly")).toBe(10);
    expect(monthlyValue(30, "quarterly")).toBe(10);
    expect(monthlyValue(null, "monthly")).toBe(0);
  });
  it("advances due dates and clamps month ends", () => {
    expect(advanceDueDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advanceDueDate("2026-11-15", "quarterly")).toBe("2027-02-15");
    expect(advanceDueDate("2026-11-15", "yearly")).toBe("2027-11-15");
  });
});

describe("attentionFlags", () => {
  const base = {
    status: "active",
    isDemo: false,
    trial: { kind: "paying" } as const,
    billing: { kind: "settled" } as const,
    callsTotal: 10,
    calls7d: 3,
    createdAt: "2026-10-01T00:00:00Z",
    agentsActive: 1,
    seatLimit: 3,
  };
  it("healthy company has no flags", () => {
    expect(attentionFlags(base, NOW)).toEqual([]);
  });
  it("flags inactivity, full seats and overdue", () => {
    expect(
      attentionFlags({ ...base, calls7d: 0, agentsActive: 3, billing: { kind: "overdue", daysOverdue: 2 } }, NOW),
    ).toEqual(["overdue", "inactive", "seats_full"]);
  });
  it("ignores demo", () => {
    expect(attentionFlags({ ...base, isDemo: true, status: "suspended" }, NOW)).toEqual([]);
  });
});

describe("isOwnerEmail", () => {
  it("matches case-insensitively and rejects others", () => {
    expect(isOwnerEmail("AhsanIlyas35@GMAIL.COM ")).toBe(true);
    expect(isOwnerEmail("nehalksyed3@gmail.com")).toBe(true);
    expect(isOwnerEmail("someone@gmail.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });
});
