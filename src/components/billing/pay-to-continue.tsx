import { MessageCircle, Phone } from "lucide-react";
import { BILLING } from "@/lib/brand";
import { bankTransferDetails } from "@/lib/billing/bank-transfer";

// How to keep (or get back) access once the 30-day trial is over: pay by bank
// transfer, tell us, and we approve the company. Server component: the bank
// details come from bankTransferDetails() (defaults in src/lib/brand.ts).
export function PayToContinue({ workspaceName, canPay = true }: { workspaceName: string; canPay?: boolean }) {
  const bank = bankTransferDetails();
  const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition";
  return (
    <div className="space-y-5 text-sm">
      {canPay ? (
        <ol className="space-y-3">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">1</span>
            <span className="text-ink">
              <span className="font-semibold">Pay by bank transfer</span> to the account below. Use{" "}
              <span className="font-semibold">{workspaceName}</span> as the payment reference.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">2</span>
            <span className="text-ink">
              <span className="font-semibold">Send us the receipt</span> on WhatsApp or call {BILLING.phone}, with your workspace name.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">3</span>
            <span className="text-ink">
              <span className="font-semibold">We approve your company</span> and you carry on exactly where you left off. Nothing is deleted.
            </span>
          </li>
        </ol>
      ) : (
        <p className="text-ink">
          Ask your workspace admin to arrange payment. Once it is approved, everyone in the workspace can sign in and carry on, and nothing is deleted.
        </p>
      )}

      {canPay && bank && (
        <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 rounded-2xl bg-canvas p-4 ring-1 ring-line">
          {bank.rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="text-muted">{r.label}</dt>
              <dd className="break-all font-medium tabular text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={`tel:${BILLING.phone.replace(/\s+/g, "")}`} className={`${btn} bg-gold-gradient text-ink shadow-lg shadow-gold/25 hover:brightness-105`}>
          <Phone className="h-4 w-4" /> Call {BILLING.phone}
        </a>
        <a href={BILLING.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#25D366] text-white hover:brightness-105`}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </div>
    </div>
  );
}
