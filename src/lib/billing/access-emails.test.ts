import { describe, expect, it } from "vitest";
import { accessApprovedEmail, paymentReceivedEmail } from "./access-emails";

describe("paymentReceivedEmail", () => {
  it("confirms the amount and says access is active when the payment restored it", () => {
    const m = paymentReceivedEmail({ workspaceName: "Acme Calls", adminName: "Sara Khan", amount: 150, currency: "USD", reference: "LC-2026-001", restored: true });
    expect(m.subject).toBe("Payment received: your LeadCallient access is active");
    expect(m.text).toContain("Hi Sara,");
    expect(m.text).toContain("$150.00 for Acme Calls (reference LC-2026-001)");
    expect(m.text).toContain("Your team can sign in");
    expect(m.text).toContain("+92 342 2221633");
  });
  it("is a plain thank-you for a company that was already approved", () => {
    const m = paymentReceivedEmail({ workspaceName: "Acme", amount: 430, currency: "USD", restored: false });
    expect(m.subject).toBe("Payment received: thank you");
    expect(m.text).toContain("Hi there,");
    expect(m.text).toContain("$430.00 for Acme.");
    expect(m.text).toContain("stays active");
  });
  it("shows other currencies by code", () => {
    expect(paymentReceivedEmail({ workspaceName: "Acme", amount: 42000, currency: "PKR", restored: false }).text).toContain("PKR 42,000.00");
  });
});

describe("accessApprovedEmail", () => {
  it("tells the admin the company is approved", () => {
    const m = accessApprovedEmail({ workspaceName: "Acme", adminName: "Ali" });
    expect(m.subject).toBe("Your LeadCallient access is active");
    expect(m.text).toContain("Acme has been approved to continue");
  });
});
