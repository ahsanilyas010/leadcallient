// Turns the dial_queue_diagnosis() counts (migration 110) into the single most
// useful reason the queue is empty, plus who can fix it. Pure, so the order of
// the checks is easy to read and to test.

export type QueueDiagnosisRow = {
  rostered_campaigns: number;
  active_campaigns: number;
  in_window_campaigns: number;
  paused_campaign_name: string | null;
  outside_campaign_name: string | null;
  outside_window_start: string | null;
  outside_window_end: string | null;
  outside_timezone: string | null;
  leads_in_rostered_campaigns: number;
  leads_considered: number;
  pending_screening: number;
  failed_screening: number;
  expired_screening: number;
  assigned_elsewhere: number;
  attempts_exhausted: number;
  suppressed: number;
  cooling_off: number;
  claimed: number;
  demo_blocked: number;
  dialable: number;
};

export type QueueReason = {
  title: string;
  detail: string;
  // Where a manager goes to fix it; null when only waiting helps.
  fix: { href: string; label: string } | null;
  // Whether an agent should ask a manager (false: just wait).
  askManager: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function diagnoseQueue(d: QueueDiagnosisRow): QueueReason {
  // Leads assigned to the agent outside any campaign (their own list) are
  // counted in leads_considered, so a campaign problem is only the answer
  // when there is nothing else to dial either.
  if (d.rostered_campaigns === 0 && d.leads_considered === 0) {
    return {
      title: "You are not on any campaign yet",
      detail: "Leads are only served from campaigns you are on the roster of.",
      fix: { href: "/admin/campaigns", label: "Campaign rosters" },
      askManager: true,
    };
  }
  if (d.in_window_campaigns === 0 && d.leads_considered === 0) {
    if (d.active_campaigns === 0) {
      return {
        title: "Your campaigns are paused",
        detail: d.paused_campaign_name ? `${d.paused_campaign_name} is paused, so none of its leads are served.` : "None of your campaigns is active.",
        fix: { href: "/admin/campaigns", label: "Open campaigns" },
        askManager: true,
      };
    }
    const hours =
      d.outside_window_start && d.outside_window_end ? ` (${d.outside_window_start}-${d.outside_window_end}${d.outside_timezone ? ` ${d.outside_timezone}` : ""})` : "";
    return {
      title: "Outside calling hours",
      detail: `${d.outside_campaign_name ?? "Your campaign"} only dials during its calling window${hours}. Come back then.`,
      fix: null,
      askManager: false,
    };
  }
  if (d.leads_in_rostered_campaigns === 0) {
    return {
      title: "Nothing to dial yet",
      detail: "Nothing has been uploaded to the campaigns you are on, and no leads are assigned to you.",
      fix: { href: "/admin/import", label: "Upload leads" },
      askManager: true,
    };
  }
  const unscreened = d.pending_screening + d.expired_screening;
  if (d.leads_considered > 0 && d.leads_considered === unscreened + d.failed_screening) {
    return {
      title: "Leads are waiting to be screened",
      detail:
        `${plural(unscreened, "lead")} must pass screening before they can be dialled` +
        (d.failed_screening > 0 ? `; ${plural(d.failed_screening, "lead")} failed screening and stay blocked.` : "."),
      fix: { href: "/admin/compliance", label: "Screen leads" },
      askManager: true,
    };
  }
  const parts: string[] = [];
  if (d.assigned_elsewhere > 0) parts.push(`${plural(d.assigned_elsewhere, "lead")} assigned to another agent`);
  if (d.cooling_off > 0) parts.push(`${plural(d.cooling_off, "lead")} in the cooling-off period after a recent call`);
  if (d.attempts_exhausted > 0) parts.push(`${plural(d.attempts_exhausted, "lead")} out of attempts`);
  if (d.suppressed > 0) parts.push(`${plural(d.suppressed, "lead")} on the do-not-call list`);
  if (d.claimed > 0) parts.push(`${plural(d.claimed, "lead")} being called by someone else right now`);
  if (d.demo_blocked > 0) parts.push(`${plural(d.demo_blocked, "lead")} not on the demo allow-list`);
  if (unscreened > 0) parts.push(`${plural(unscreened, "lead")} waiting to be screened`);
  return {
    title: "Every lead is on hold right now",
    detail: parts.length > 0 ? `${parts.join("; ")}.` : "No lead currently meets every compliance rule.",
    fix: null,
    askManager: true,
  };
}
