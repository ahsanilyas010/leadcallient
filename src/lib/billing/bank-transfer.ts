import "server-only";

// Bank-transfer details for customers who pay by transfer instead of card.
// Defaults to Assorted Business Services' account (src/lib/brand.ts: BILLING);
// the BANK_* environment variables override it, e.g. to add a SWIFT code or to
// point a deployment at a different account.
import { BILLING } from "@/lib/brand";

export interface BankTransferDetails {
  rows: { label: string; value: string }[];
  note: string | null;
}

export function bankTransferDetails(): BankTransferDetails | null {
  const e = process.env;
  const fromEnv = Boolean(e.BANK_ACCOUNT_NAME?.trim());
  const name = fromEnv ? e.BANK_ACCOUNT_NAME!.trim() : BILLING.bank.accountTitle;
  const iban = fromEnv ? e.BANK_IBAN : BILLING.bank.iban;
  const accountNumber = fromEnv ? e.BANK_ACCOUNT_NUMBER : BILLING.bank.accountNumber;
  if (!(iban?.trim() || accountNumber?.trim())) return null;
  const candidates: [string, string | undefined][] = [
    ["Account name", name],
    ["Bank", fromEnv ? e.BANK_NAME : BILLING.bank.bankName],
    ["IBAN", iban],
    ["Account number", accountNumber],
    ["Sort code", e.BANK_SORT_CODE],
    ["Routing number", e.BANK_ROUTING_NUMBER],
    ["SWIFT / BIC", e.BANK_SWIFT_BIC],
  ];
  return {
    rows: candidates.filter(([, v]) => v?.trim()).map(([label, v]) => ({ label, value: v!.trim() })),
    note: e.BANK_TRANSFER_NOTE?.trim() || null,
  };
}
