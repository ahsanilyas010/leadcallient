"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Loader2, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableWrap } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { erasePerson, findPersonData, type PersonData } from "@/lib/actions/data-trash";
import { ERASE_CONFIRM_WORD } from "@/lib/data-delete";
import { ISO_COUNTRIES, COMMON_COUNTRY_CODES } from "@/lib/countries";
import { EMPTY, fmtDate } from "@/lib/format";

const inputCls = "h-9 w-full rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

export function PrivacyRequest({ canErase }: { canErase: boolean }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("GB");
  const [data, setData] = useState<PersonData | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [suppress, setSuppress] = useState(true);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const countries = [
    ...COMMON_COUNTRY_CODES.map((c) => ISO_COUNTRIES.find((x) => x.value === c)).filter((c): c is { value: string; label: string } => Boolean(c)),
    ...ISO_COUNTRIES.filter((c) => !COMMON_COUNTRY_CODES.includes(c.value)),
  ];
  const found = data ? data.leads.length + data.contacts.length + data.emails_sent : 0;

  function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    start(async () => {
      const r = await findPersonData({ email, phone, country });
      if (r.error || !r.data) {
        setError(r.error ?? "Search failed.");
        setData(null);
        return;
      }
      setData(r.data);
      setSearchedFor([email.trim(), phone.trim()].filter(Boolean).join(" / "));
    });
  }

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify({ searched_for: searchedFor, exported_at: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data-held-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function erase() {
    start(async () => {
      const r = await erasePerson({ email, phone, country, suppress, confirm: typed });
      if (r.error || !r.result) {
        toast.error(r.error ?? "Couldn't erase.");
        return;
      }
      const x = r.result;
      toast.success(
        `Erased ${x.leads} lead${x.leads === 1 ? "" : "s"}, ${x.calls} call${x.calls === 1 ? "" : "s"}, ${x.recordings} recording${x.recordings === 1 ? "" : "s"}, ${x.contacts} contact${x.contacts === 1 ? "" : "s"} and ${x.emails} email record${x.emails === 1 ? "" : "s"}.${x.suppressed ? " The number is now on your suppression list." : ""}`,
      );
      setErasing(false);
      setTyped("");
      setData(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="dsr-email" className="text-sm font-medium text-ink">
            Email address
          </label>
          <input id="dsr-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dsr-phone" className="text-sm font-medium text-ink">
            Phone number
          </label>
          <input id="dsr-phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" placeholder="+44 7700 900123" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dsr-country" className="text-sm font-medium text-ink">
            Number&apos;s country
          </label>
          <select id="dsr-country" className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending || (!email.trim() && !phone.trim())}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find
        </Button>
        <p className="text-xs text-muted sm:col-span-4">Give either or both. The country is only used to read a number written without a country code.</p>
      </form>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {data && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm" data-testid="dsr-results">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">
              {found === 0 ? `Nothing held for ${searchedFor}` : `What is held for ${searchedFor}`}
            </h2>
            {found > 0 && (
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={exportJson}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                {canErase && (
                  <Button size="sm" variant="danger" onClick={() => setErasing(true)} data-testid="dsr-erase">
                    <ShieldAlert className="h-3.5 w-3.5" /> Erase everything
                  </Button>
                )}
              </div>
            )}
          </div>
          {data.suppressed && <p className="text-xs text-muted">This number is on your suppression list, so it is never called or imported.</p>}
          {data.leads.length > 0 && (
            <TableWrap label="Leads">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Calls</th>
                    <th className="px-3 py-2 font-medium">Recordings</th>
                    <th className="px-3 py-2 font-medium">Callbacks</th>
                    <th className="px-3 py-2 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 text-ink">
                        {l.full_name ?? l.company_name ?? EMPTY}
                        {l.deleted_at && <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[10px] text-muted">in trash</span>}
                      </td>
                      <td className="tabular px-3 py-1.5 text-muted">{l.phone_e164 ?? EMPTY}</td>
                      <td className="px-3 py-1.5 text-muted">{l.email ?? EMPTY}</td>
                      <td className="tabular px-3 py-1.5">{l.calls}</td>
                      <td className="tabular px-3 py-1.5">{l.recordings}</td>
                      <td className="tabular px-3 py-1.5">{l.callbacks}</td>
                      <td className="px-3 py-1.5 text-xs text-muted">{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          {data.contacts.length > 0 && (
            <p className="text-sm text-ink">
              {data.contacts.length} contact{data.contacts.length === 1 ? "" : "s"} without a number:{" "}
              {data.contacts.map((c) => c.full_name ?? c.company_name ?? c.email).join(", ")}
            </p>
          )}
          {data.emails_sent > 0 && <p className="text-sm text-ink">{data.emails_sent} email{data.emails_sent === 1 ? "" : "s"} sent to this address.</p>}
          {!canErase && found > 0 && (
            <p className="text-xs text-muted">Only the super admin (or an ops manager they allow) can erase a person&apos;s data.</p>
          )}
        </section>
      )}

      <Dialog open={erasing} onOpenChange={(o) => !pending && setErasing(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erase everything held for {searchedFor}?</DialogTitle>
            <DialogDescription>
              Their leads (including any in the trash), every call and recording, callbacks, contacts and email records are deleted for good,
              and the audit log&apos;s copies are scrubbed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {phone.trim() && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <Checkbox checked={suppress} onCheckedChange={(v) => setSuppress(v === true)} className="mt-0.5" />
              <span>
                Keep their number on the suppression list
                <span className="block text-xs text-muted">So they are never called or imported again. Only a one-way hash of the number is kept.</span>
              </span>
            </label>
          )}
          <label htmlFor="erase-confirm" className="text-sm text-ink">
            Type <strong>{ERASE_CONFIRM_WORD}</strong> to confirm
          </label>
          <input
            id="erase-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-9 rounded-md border border-line bg-white px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-danger"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setErasing(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={erase} disabled={pending || typed.trim() !== ERASE_CONFIRM_WORD}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Erase for good
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
