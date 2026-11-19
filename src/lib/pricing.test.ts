import { describe, expect, it } from "vitest";
import { quote, quoteLine, basicPriceLine } from "./pricing";
import { trialNoticeEmail } from "./billing/trial-notice";

describe("quote", () => {
  it("charges the Basic minimum for 1 to 3 agents", () => {
    for (const n of [0, 1, 2, 3]) expect(quote(n)).toMatchObject({ plan: "Basic", monthly: 150 });
  });
  it("matches the published examples", () => {
    expect(quote(5)).toMatchObject({ plan: "Growth", monthly: 230 });
    expect(quote(10)).toMatchObject({ plan: "Growth", monthly: 430 });
    expect(quote(15)).toMatchObject({ plan: "Scale", monthly: 605 });
    expect(quote(25)).toMatchObject({ plan: "Scale", monthly: 955 });
  });
  it("never gets cheaper when an agent is added", () => {
    for (let n = 1; n < 25; n++) expect(quote(n + 1).monthly!).toBeGreaterThanOrEqual(quote(n).monthly!);
  });
  it("leaves Enterprise to sales", () => {
    expect(quote(26)).toMatchObject({ plan: "Enterprise", monthly: null });
  });
  it("annual prepay charges 10 months", () => {
    expect(quote(3).annual).toBe(1500);
  });
  it("formats lines", () => {
    expect(basicPriceLine()).toBe("$150 per month for up to 3 agents");
    expect(quoteLine(2)).toBe("$150 per month for up to 3 agents");
    expect(quoteLine(5)).toBe("$230 per month (Growth, 5 agents)");
  });
});

describe("trial notice email price", () => {
  it("quotes the Basic price", () => {
    expect(trialNoticeEmail({ workspaceName: "Acme", endsAt: "2026-11-20T12:00:00Z" }).text).toContain("$150 per month for up to 3 agents");
  });
});
