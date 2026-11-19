import { BILLING } from "../brand";
import { basicPriceLine, PRICING, usd } from "../pricing";

// The email sent to a workspace's admins when their trial is about to end
// (NOTICE_DAYS out). Plain text on purpose: it must survive any mail client
// and carry everything needed to pay without logging in.
export function trialNoticeEmail(input: { workspaceName: string; endsAt: string; adminName?: string | null }): { subject: string; text: string } {
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(input.endsAt));
  const b = BILLING.bank;
  return {
    subject: `Your ${input.workspaceName} free trial ends on ${date}`,
    text: [
      `Hi ${input.adminName?.trim().split(" ")[0] || "there"},`,
      "",
      `The free trial for ${input.workspaceName} ends on ${date}. After that, access to the workspace is paused until we approve your company. Your leads, campaigns and call history are kept.`,
      "",
      "To carry on without a break:",
      `1. Pay ${basicPriceLine()} by bank transfer (more than ${PRICING.includedAgents} agents: add ${usd(PRICING.growthPerAgent)} a month per extra agent) to:`,
      `   Account title: ${b.accountTitle}`,
      `   Bank: ${b.bankName}`,
      `   Account number: ${b.accountNumber}`,
      `   IBAN: ${b.iban}`,
      `   Reference: ${input.workspaceName}`,
      `2. Send a screenshot of the payment on WhatsApp (${BILLING.whatsappUrl}) or call ${BILLING.phone}.`,
      "3. We approve your company and you carry on where you left off.",
      "",
      `Questions? Call or WhatsApp ${BILLING.phone}.`,
    ].join("\n"),
  };
}
