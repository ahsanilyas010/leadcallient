"use client";

import { useRouter } from "next/navigation";
import { SettingToggle } from "@/components/ui/setting-toggle";
import { setCampaignSetting } from "@/lib/actions/campaigns";
import { setCampaignActive } from "@/lib/actions/assignment";

// A campaign's on/off settings. Each saves as soon as it is switched; the
// ones with a big effect (pausing dialling, dropping the screening rule) ask
// first.
export function CampaignToggles({
  campaignId,
  isActive,
  archived,
  requireScreening,
  workspaceRequiresScreening,
  autoAssignNew,
}: {
  campaignId: string;
  isActive: boolean;
  archived: boolean;
  requireScreening: boolean | null;
  workspaceRequiresScreening: boolean;
  autoAssignNew: boolean;
}) {
  const router = useRouter();
  const effectiveScreening = requireScreening ?? workspaceRequiresScreening;
  const refreshAfter = async (p: Promise<{ error?: string }>) => {
    const r = await p;
    if (!r.error) router.refresh();
    return r;
  };

  return (
    <section className="mb-4 divide-y divide-line rounded-2xl border border-line bg-white px-4 shadow-sm" aria-label="Campaign settings" data-testid="campaign-toggles">
      <SettingToggle
        label="Live"
        description={
          archived
            ? "This campaign is archived. Edit it to bring it back."
            : "On: agents on the roster are served this campaign's leads. Off (paused): nobody can dial them until it is switched back on."
        }
        checked={isActive}
        onLabel="Live"
        offLabel="Paused"
        disabled={archived}
        testId="toggle-live"
        confirm={{
          when: "off",
          title: "Pause this campaign?",
          body: "Agents stop being served its leads straight away, including anyone dialling it right now. Nothing is deleted, and you can switch it back on at any time.",
          confirmLabel: "Pause it",
        }}
        onSave={(on) => refreshAfter(setCampaignActive(campaignId, on))}
      />
      <SettingToggle
        label="Require screening before dialling"
        description={
          <>
            {effectiveScreening
              ? "On: a lead in this campaign can only be dialled after it has passed screening."
              : "Off: this campaign's leads can be dialled as soon as they are uploaded and assigned."}{" "}
            The suppression (do-not-call) list blocks a number either way.{" "}
            {requireScreening === null ? (
              <span>Following the workspace setting under Compliance.</span>
            ) : (
              <button
                type="button"
                className="font-medium text-brand-blue underline"
                onClick={async () => {
                  const r = await setCampaignSetting(campaignId, "require_screening", null);
                  if (!r.error) router.refresh();
                }}
              >
                Use the workspace setting ({workspaceRequiresScreening ? "on" : "off"}) instead
              </button>
            )}
          </>
        }
        checked={effectiveScreening}
        testId="toggle-campaign-screening"
        confirm={{
          when: "off",
          title: "Stop requiring screening for this campaign?",
          body: "Leads in this campaign that haven't been screened become dialable straight away. Numbers on your suppression list stay blocked. Only do this if your market doesn't need a TPS, DNC or similar check before each call.",
          confirmLabel: "Stop requiring it",
        }}
        onSave={(on) => refreshAfter(setCampaignSetting(campaignId, "require_screening", on))}
      />
      <SettingToggle
        label="Auto-assign new leads"
        description="On: leads imported into this campaign are shared out to its roster straight away (screened leads, up to each agent's daily target). Off: they wait for you to assign them."
        checked={autoAssignNew}
        testId="toggle-auto-assign"
        onSave={(on) => refreshAfter(setCampaignSetting(campaignId, "auto_assign_new", on))}
      />
    </section>
  );
}
