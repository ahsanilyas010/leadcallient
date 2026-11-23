import { BILLING } from "../brand";

// Emails the owner console sends on its own when a company is let in:
// recording a payment, or clicking "Approve to continue". Plain text, pure
// builders (unit-tested); sending lives in send-admin-email.ts.

function firstName(name?: string | null): string {
  return name?.trim().split(" ")[0] || "there";
}

function money(amount: number, currency: string): string {
  const n = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "USD" ? "$" + n : currency + " " + n;
}

export interface AccessEmail {
  subject: string;
  text: string;
}

// A payment was recorded in the ledger. `restored` is true when this payment
// is what approved the company (it was on trial or locked out before).
export function paymentReceivedEmail(input: {
  workspaceName: string;
  adminName?: string | null;
  amount: number;
  currency: string;
  reference?: string | null;
  restored: boolean;
}): AccessEmail {
  const paid = money(input.amount, input.currency);
  const ref = input.reference?.trim() ? " (reference " + input.reference.trim() + ")" : "";
  return {
    subject: input.restored ? "Payment received: your LeadCallient access is active" : "Payment received: thank you",
    text: [
      "Hi " + firstName(input.adminName) + ",",
      "",
      "We have received your payment of " + paid + " for " + input.workspaceName + ref + ". Thank you.",
      "",
      input.restored
        ? "Access to your LeadCallient workspace is active. Your team can sign in and carry on where they left off; nothing was changed or deleted."
        : "Your LeadCallient workspace stays active. There is nothing you need to do.",
      "",
      "Questions? Reply to this email or call " + BILLING.phone + ".",
      "",
      "LeadCallient",
    ].join("\n"),
  };
}

// The owner clicked "Approve to continue" without recording a payment.
export function accessApprovedEmail(input: { workspaceName: string; adminName?: string | null }): AccessEmail {
  return {
    subject: "Your LeadCallient access is active",
    text: [
      "Hi " + firstName(input.adminName) + ",",
      "",
      input.workspaceName + " has been approved to continue on LeadCallient. Your team can sign in and carry on where they left off; nothing was changed or deleted.",
      "",
      "Questions? Reply to this email or call " + BILLING.phone + ".",
      "",
      "LeadCallient",
    ].join("\n"),
  };
}
