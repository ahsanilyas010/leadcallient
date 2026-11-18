"use server";

import { z } from "zod";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { getCurrentWorkspace } from "@/lib/workspace/current";
import { accessFromRow } from "@/lib/workspace/access";
import { isLocked } from "@/lib/access";
import { createRealClient } from "@/lib/supabase/real";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/database.generated";
import {
  applyZoomEvent,
  sameNumber,
  type AiSummary,
  type CallRowState,
  type CallStatus,
  type ZoomCallEvent,
} from "@/lib/zoom-phone/call-state";

const STAFF_ROLES = ["super_admin", "ops_manager", "team_lead", "agent", "qa_analyst"];

export interface StartCallResult {
  error?: string;
  callId?: string;
  number?: string;
  callerId?: string | null;
}

// Preview dialing: the agent has already pulled this lead through
// next_lead_for_agent() (the compliance gate), which claimed it for them.
// This only records the attempt and hands the browser the number to dial in
// the Zoom Smart Embed; it never places a call itself.
export async function startCall(leadId: string): Promise<StartCallResult> {
  const idOk = z.string().uuid().safeParse(leadId);
  if (!idOk.success) return { error: "Invalid lead." };

  const profile = await requireRealProfile();
  if (!STAFF_ROLES.includes(profile.role)) return { error: "Only staff can place calls." };

  const workspace = await getCurrentWorkspace();
  // Trial over and not approved yet: no dialing (the pages are locked too).
  if (isLocked(accessFromRow(workspace))) {
    return { error: "Your free trial has ended. Contact us to continue." };
  }
  // "A workspace with status suspended can log in but cannot dial."
  if (workspace.status === "suspended") {
    return { error: "This workspace is suspended. Contact support to resume calling." };
  }

  const supabase = await createRealClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, campaign_id, claimed_by, phone_e164")
    .eq("id", leadId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!lead) return { error: "Lead not found." };
  if (lead.claimed_by !== profile.id) return { error: "This lead isn't claimed by you. Pull your next lead first." };
  if (!lead.phone_e164) return { error: "This lead has no phone number." };

  const { data: campaign } = lead.campaign_id
    ? await supabase.from("campaigns").select("caller_id").eq("id", lead.campaign_id).maybeSingle()
    : { data: null };
  const callerId = campaign?.caller_id || null;

  const admin = createServiceClient();
  // A retry on the same lead supersedes any earlier attempt that never reached Zoom.
  await admin
    .from("calls")
    .update({ status: "canceled", ended_at: new Date().toISOString() })
    .eq("workspace_id", workspace.id)
    .eq("agent_id", profile.id)
    .eq("lead_id", leadId)
    .eq("status", "initiated")
    .is("zoom_call_id", null);

  const { data: call, error } = await admin
    .from("calls")
    .insert({
      workspace_id: workspace.id,
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      agent_id: profile.id,
      provider: "zoom",
      from_number: callerId,
      to_number: lead.phone_e164,
      status: "initiated",
    })
    .select("id")
    .single();
  if (error || !call) return { error: error?.message ?? "Could not record the call." };

  return { callId: call.id, number: lead.phone_e164, callerId };
}

const MATCH_WINDOW_MS = 15 * 60 * 1000;

const zid = z.string().min(1).max(200);

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ringing"), zoomCallId: zid }),
  z.object({ type: z.literal("connected"), zoomCallId: zid }),
  z.object({ type: z.literal("ended"), zoomCallId: zid, result: z.enum(["missed", "rejected", "ended"]) }),
  z.object({
    type: z.literal("log-completed"),
    zoomCallId: zid,
    zoomCallLogId: zid,
    durationSeconds: z.number().finite().nullable(),
  }),
  z.object({
    type: z.literal("recording-completed"),
    zoomCallId: zid,
    zoomCallLogId: zid.nullable(),
    recordingUrl: z.string().url().max(2000),
  }),
  z.object({
    type: z.literal("ai-summary"),
    zoomCallId: zid,
    summary: z.object({
      callSummary: z.string().max(10_000).nullable(),
      nextSteps: z.string().max(10_000).nullable(),
      detailedSummary: z.string().max(20_000).nullable(),
    }),
  }),
]);

const inputSchema = z.object({
  // Our own call id, as handed back by startCall(); a hint only. The row must
  // still belong to the signed-in agent.
  callId: z.string().uuid().nullable(),
  // The callee number Zoom reported; used to bind a not-yet-linked row.
  calleeNumber: z.string().max(64).nullable(),
  direction: z.enum(["inbound", "outbound"]).nullable(),
  event: eventSchema,
});

export type RecordZoomCallEventInput = z.input<typeof inputSchema>;

const SELECT =
  "id, status, to_number, created_at, zoom_call_id, zoom_call_log_id, answered_at, ended_at, duration_seconds, recording_url, ai_summary";

type CallRow = CallRowState & { id: string; to_number: string | null; created_at: string };

// Called from the browser with events relayed from the Zoom Smart Embed.
//
// IMPORTANT: these events come from the browser (window.postMessage from
// Zoom's iframe). We verify the signed-in agent owns the call row, that
// transitions only move forward and that the Zoom call id is consistent, but
// we cannot verify the events are genuine; a user could forge them. Zoom
// webhooks (server-to-server) are the future hardening for status, duration
// and recordings. workspace_id / agent_id are always derived from the session.
export async function recordZoomCallEvent(
  raw: RecordZoomCallEventInput,
): Promise<{ ok?: true; ignored?: string; error?: string }> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid call event." };
  const { callId, calleeNumber, direction, event } = parsed.data;

  const profile = await requireRealProfile();
  if (!STAFF_ROLES.includes(profile.role)) return { error: "Only staff can record calls." };
  // Inbound calls are not tied to a lead we queued; nothing to record.
  if (direction === "inbound") return { ignored: "inbound call" };

  const admin = createServiceClient();
  const workspaceId = profile.workspace_id;
  const agentId = profile.id;

  // 1. Already bound to this Zoom call id.
  const { data: bound } = await admin
    .from("calls")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .eq("zoom_call_id", event.zoomCallId)
    .maybeSingle();
  let row = (bound as CallRow | null) ?? null;

  // 2. Otherwise bind the most recent unbound 'initiated' row of this agent
  //    whose number matches the callee Zoom reported.
  if (!row) {
    const since = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();
    const { data } = await admin
      .from("calls")
      .select(SELECT)
      .eq("workspace_id", workspaceId)
      .eq("agent_id", agentId)
      .eq("status", "initiated")
      .is("zoom_call_id", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const candidates = (data ?? []) as CallRow[];
    row =
      candidates.find(
        (c) => (callId ? c.id === callId : true) && calleeNumber && c.to_number && sameNumber(c.to_number, calleeNumber),
      ) ?? null;
  }
  if (!row) return { ignored: "no matching call" };

  const t = applyZoomEvent(
    {
      status: row.status as CallStatus,
      zoom_call_id: row.zoom_call_id,
      zoom_call_log_id: row.zoom_call_log_id,
      answered_at: row.answered_at,
      ended_at: row.ended_at,
      duration_seconds: row.duration_seconds,
      recording_url: row.recording_url,
      ai_summary: (row.ai_summary as AiSummary | null) ?? null,
    },
    event as ZoomCallEvent,
  );
  if (!t.ok) return { ignored: t.reason };
  if (Object.keys(t.patch).length === 0) return { ok: true };

  // Optimistic concurrency: only apply if the row is still in the status we
  // evaluated against, and still belongs to this agent and workspace.
  const { data: updated, error } = await admin
    .from("calls")
    .update({ ...t.patch, ai_summary: (t.patch.ai_summary ?? undefined) as Json | undefined })
    .eq("id", row.id)
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .eq("status", row.status)
    .select("id");
  if (error) return { error: "Could not update the call." };
  if (!updated || updated.length === 0) return { ignored: "call changed concurrently" };
  return { ok: true };
}
