"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, EyeOff, Eye } from "lucide-react";
import { getClientPortalData, generateMonthlyReport, getReportDownloadUrl, type ClientPortalData } from "@/lib/actions/client-portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// How outcomes are grouped in the dispositions table (outcome_group).
const OUTCOME_GROUPS: { id: string; label: string }[] = [
  { id: "", label: "All outcomes" },
  { id: "conversion", label: "Conversions" },
  { id: "connect", label: "Connected" },
  { id: "no_connect", label: "Not connected" },
  { id: "dnc", label: "Do not call" },
];

const selectCls = "h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

export function PortalClient({ initialData, clientId }: { initialData: ClientPortalData; clientId?: string }) {
  const [data, setData] = useState(initialData);
  const [anonymize, setAnonymize] = useState(!clientId);
  // Which campaign the report covers ("" = every campaign) and which outcome
  // group the Outcomes list is narrowed to. The campaign choice re-queries;
  // the outcome group is a view of what came back.
  const [campaignId, setCampaignId] = useState("");
  const [outcomeGroup, setOutcomeGroup] = useState("");
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // The campaign list comes from the unfiltered funnel so it never shrinks
  // to only the campaign currently chosen.
  const campaigns = useMemo(() => initialData.funnel.map((f) => ({ id: f.campaign_id, name: f.campaign_name })), [initialData.funnel]);
  const campaignName = campaigns.find((c) => c.id === campaignId)?.name;

  useEffect(() => {
    startTransition(async () => {
      const next = await getClientPortalData(anonymize, clientId, campaignId || undefined);
      setData(next);
    });
  }, [anonymize, clientId, campaignId]);

  const groupsPresent = useMemo(() => new Set(data.outcomes.map((o) => o.outcome_group)), [data.outcomes]);
  const outcomes = useMemo(() => (outcomeGroup ? data.outcomes.filter((o) => o.outcome_group === outcomeGroup) : data.outcomes), [data.outcomes, outcomeGroup]);
  const outcomeTotal = outcomes.reduce((n, o) => n + o.count, 0);
  const totals = data.funnel.reduce(
    (t, f) => ({ loaded: t.loaded + f.loaded, screened: t.screened + f.screened, dialled: t.dialled + f.dialled, connected: t.connected + f.connected, converted: t.converted + f.converted }),
    { loaded: 0, screened: 0, dialled: 0, connected: 0, converted: 0 },
  );

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    const gen = await generateMonthlyReport(clientId, campaignId || undefined);
    if (gen.error || !gen.path) {
      setDownloadError(gen.error ?? "Could not generate the report.");
      setDownloading(false);
      return;
    }
    const link = await getReportDownloadUrl(gen.path);
    if (link.error || !link.url) {
      setDownloadError(link.error ?? "Could not create a download link.");
      setDownloading(false);
      return;
    }
    window.open(link.url, "_blank");
    setDownloading(false);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">{campaignName ?? "Your campaigns"}</h1>
        <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
          <Download className="h-4 w-4" /> {downloading ? "Preparing..." : `Download ${campaignName ? "this campaign's" : "monthly"} PDF`}
        </Button>
      </div>
      {downloadError && <p className="text-sm text-danger">{downloadError}</p>}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 shadow-sm" role="group" aria-label="Report filters">
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Campaign
          <select className={selectCls} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} aria-label="Campaign">
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          Outcomes
          <select className={selectCls} value={outcomeGroup} onChange={(e) => setOutcomeGroup(e.target.value)} aria-label="Outcome group">
            {OUTCOME_GROUPS.filter((g) => g.id === "" || groupsPresent.has(g.id)).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        {(campaignId || outcomeGroup) && (
          <button
            type="button"
            className="text-xs font-semibold text-brand-blue hover:underline"
            onClick={() => {
              setCampaignId("");
              setOutcomeGroup("");
            }}
          >
            Clear
          </button>
        )}
        {pending && <span className="ml-auto text-xs text-muted">Refreshing...</span>}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Funnel</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Loaded</th>
                <th className="px-4 py-3">Screened</th>
                <th className="px-4 py-3">Dialled</th>
                <th className="px-4 py-3">Connected</th>
                <th className="px-4 py-3">Converted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.funnel.map((f) => (
                <tr key={f.campaign_id}>
                  <td className="px-4 py-3 font-medium text-ink">{f.campaign_name}</td>
                  <td className="px-4 py-3">{f.loaded}</td>
                  <td className="px-4 py-3">{f.screened}</td>
                  <td className="px-4 py-3">{f.dialled}</td>
                  <td className="px-4 py-3">{f.connected}</td>
                  <td className="px-4 py-3">{f.converted}</td>
                </tr>
              ))}
              {data.funnel.length > 1 && (
                <tr className="bg-canvas font-semibold text-ink">
                  <td className="px-4 py-3">All campaigns</td>
                  <td className="px-4 py-3">{totals.loaded}</td>
                  <td className="px-4 py-3">{totals.screened}</td>
                  <td className="px-4 py-3">{totals.dialled}</td>
                  <td className="px-4 py-3">{totals.connected}</td>
                  <td className="px-4 py-3">{totals.converted}</td>
                </tr>
              )}
              {data.funnel.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                    No campaigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Outcomes</h2>
          {outcomes.length > 0 && (
            <span className="text-xs text-muted">
              {outcomeTotal} call{outcomeTotal === 1 ? "" : "s"}
              {outcomeGroup ? ` · ${OUTCOME_GROUPS.find((g) => g.id === outcomeGroup)?.label.toLowerCase()}` : ""}
            </span>
          )}
        </div>
        <Card>
          <CardContent className="flex flex-col gap-1.5 py-4">
            {outcomes.map((o) => (
              <div key={o.disposition_label} className="flex items-center justify-between text-sm">
                <span className="text-ink">{o.disposition_label}</span>
                <span className="text-muted">{o.count}</span>
              </div>
            ))}
            {outcomes.length === 0 && (
              <p className="text-sm text-muted">{data.outcomes.length === 0 ? "No calls yet." : "No calls with that outcome."}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Agent activity</h2>
          <button onClick={() => setAnonymize((a) => !a)} className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline">
            {anonymize ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {anonymize ? "Show names" : "Anonymise"}
          </button>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-1.5 py-4">
            {data.activity.map((a) => (
              <div key={a.agent_label} className="flex items-center justify-between text-sm">
                <span className="text-ink">{a.agent_label}</span>
                <span className="text-muted">
                  {a.calls} calls · {a.connects} connects · {a.conversions} conversions
                </span>
              </div>
            ))}
            {data.activity.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
