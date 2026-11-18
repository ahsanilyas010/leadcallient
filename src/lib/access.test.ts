import { describe, expect, it } from "vitest";
import { accessState, isLocked, shouldWarn, NOTICE_DAYS, type AccessInput } from "./access";
import { trialState } from "./owner/status";
import { trialNoticeEmail } from "./billing/trial-notice";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const base: AccessInput = { isDemo: false, seatLimit: 3, hasSubscription: false, trialEndsAt: "2026-12-10T12:00:00Z", accessApprovedAt: null };

describe("accessState", () => {
  it("is a trial with days left while the 14 days run", () => {
    expect(accessState(base, NOW)).toEqual({ kind: "trial", daysLeft: 22, endsAt: base.trialEndsAt });
  });

  it("locks the moment the trial ends", () => {
    const s = accessState({ ...base, trialEndsAt: "2026-11-18T11:59:59Z" }, NOW);
    expect(s.kind).toBe("locked");
    expect(isLocked(s)).toBe(true);
  });

  it("owner approval lets a locked company continue", () => {
    const expired = { ...base, trialEndsAt: "2026-11-01T00:00:00Z" };
    expect(isLocked(accessState(expired, NOW))).toBe(true);
    expect(accessState({ ...expired, accessApprovedAt: "2026-11-18T10:00:00Z" }, NOW)).toEqual({ kind: "full", reason: "approved" });
  });

  it("a live Stripe subscription keeps access", () => {
    expect(accessState({ ...base, trialEndsAt: "2026-11-01T00:00:00Z", hasSubscription: true }, NOW)).toEqual({ kind: "full", reason: "subscription" });
  });

  it("never locks the demo, Assorted's unlimited-seat workspaces, or a workspace with no trial", () => {
    const expired = { ...base, trialEndsAt: "2026-01-01T00:00:00Z" };
    expect(accessState({ ...expired, isDemo: true }, NOW).kind).toBe("full");
    expect(accessState({ ...expired, seatLimit: 2147483647 }, NOW).kind).toBe("full");
    expect(accessState({ ...base, trialEndsAt: null }, NOW).kind).toBe("full");
  });

  it("an existing customer given the 2-day notice is warned, then locked after it", () => {
    const notice = { ...base, trialEndsAt: new Date(NOW + NOTICE_DAYS * 86_400_000).toISOString() };
    const during = accessState(notice, NOW);
    expect(during).toMatchObject({ kind: "trial", daysLeft: 2 });
    expect(shouldWarn(during)).toBe(true);
    expect(isLocked(accessState(notice, NOW + NOTICE_DAYS * 86_400_000 + 1))).toBe(true);
  });

  it("only warns in the last week", () => {
    expect(shouldWarn(accessState(base, NOW))).toBe(false);
    expect(shouldWarn(accessState({ ...base, trialEndsAt: "2026-11-23T12:00:00Z" }, NOW))).toBe(true);
  });
});

describe("owner console trial state with approval", () => {
  it("approval counts as paying even with an expired trial and no payments", () => {
    expect(trialState("2026-11-01T00:00:00Z", 0, NOW, true)).toEqual({ kind: "paying" });
    expect(trialState("2026-11-01T00:00:00Z", 0, NOW, false).kind).toBe("expired");
  });
});

describe("trialNoticeEmail", () => {
  it("carries the date, the account and the contact number", () => {
    const m = trialNoticeEmail({ workspaceName: "Acme Calls", endsAt: "2026-11-20T12:00:00Z", adminName: "Sara Khan" });
    expect(m.subject).toContain("Acme Calls");
    expect(m.subject).toContain("20 November 2026");
    expect(m.text).toContain("Hi Sara,");
    expect(m.text).toContain("PK56FAYS0213007000001472");
    expect(m.text).toContain("Assorted Business Services");
    expect(m.text).toContain("+92 342 2221633");
  });
});
