"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PhoneCall, ChevronDown, Clock, AlertTriangle, Info } from "lucide-react";
import {
  pullNextLead,
  submitDisposition,
  snoozeCallback,
  getQueueReason,
  type DialWorkspaceLead,
} from "@/lib/actions/dial-workspace";
import { startCall } from "@/lib/actions/zoom-calls";
import { PHONE_LABEL, usePhone } from "@/components/zoom-phone/zoom-phone-provider";
import { BookMeetingDialog } from "@/components/zoom/book-meeting-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { RealTables } from "@/lib/supabase/real-types";
import type { QueueReason } from "@/lib/dial/queue-diagnosis";
import { fmtTime } from "@/lib/format";

type Disposition = RealTables<"dispositions">;
type Callback = RealTables<"callbacks">;

export function DialWorkspaceClient({
  dispositions,
  initialDueCallbacks,
  isDemo,
  canManage = false,
  screeningRequired = false,
}: {
  dispositions: Disposition[];
  initialDueCallbacks: Callback[];
  isDemo: boolean;
  canManage?: boolean;
  // Whether this workspace makes leads pass screening before they can be dialled (Compliance).
  screeningRequired?: boolean;
}) {
  const [current, setCurrent] = useState<DialWorkspaceLead | null | undefined>(undefined);
  const [pulling, startPull] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [callbackDueAt, setCallbackDueAt] = useState("");
  const [dueCallbacks, setDueCallbacks] = useState(initialDueCallbacks);
  const [calling, setCalling] = useState(false);
  const [reason, setReason] = useState<QueueReason | null>(null);

  const notesRef = useRef<HTMLTextAreaElement>(null);
  const dispositionRef = useRef<HTMLDivElement>(null);

  const { status, setupHint, activeCall, makeCall, clearCall } = usePhone();

  const pull = useCallback(() => {
    setError(null);
    startPull(async () => {
      const res = await pullNextLead();
      if (res.error) {
        setError(res.error);
        setCurrent(null);
        return;
      }
      setCurrent(res.lead ?? null);
      setNotes("");
      setSelectedCode(null);
      setCallbackDueAt("");
      setCalling(false);
      clearCall();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current !== null || isDemo) return;
    let live = true;
    getQueueReason().then((r) => live && setReason(r.reason ?? null));
    return () => {
      live = false;
    };
  }, [current, isDemo]);

  useEffect(() => {
    pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDisposition = dispositions.find((d) => d.code === selectedCode) ?? null;

  const submit = useCallback(() => {
    if (!current || !selectedCode) {
      setError("Pick an outcome before saving.");
      return;
    }
    if (selectedDisposition?.requires_note && notes.trim().length === 0) {
      setError("This outcome requires a note.");
      return;
    }
    setError(null);
    startSubmit(async () => {
      const res = await submitDisposition({
        leadId: current.lead.id,
        dispositionCode: selectedCode,
        notes: notes.trim() || undefined,
        callbackDueAt: callbackDueAt ? new Date(callbackDueAt).toISOString() : undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      pull();
    });
  }, [current, selectedCode, notes, callbackDueAt, selectedDisposition, pull]);

  // Keyboard shortcuts: D opens/focuses the disposition picker, N focuses
  // notes, Ctrl+Enter saves and loads the next lead (spec).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "TEXTAREA" || target.tagName === "INPUT";
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      } else if (!typing && e.key.toLowerCase() === "d") {
        e.preventDefault();
        dispositionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (!typing && e.key.toLowerCase() === "n") {
        e.preventDefault();
        notesRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submit]);

  async function handleCall() {
    if (!current) return;
    setCalling(true);
    setError(null);
    const res = await startCall(current.lead.id);
    setCalling(false);
    if (res.error || !res.callId || !res.number) {
      setError(res.error ?? "Could not start the call.");
      return;
    }
    makeCall(res.number, res.callId, res.callerId ?? null);
  }

  async function handleSnooze(callbackId: string) {
    const res = await snoozeCallback(callbackId);
    setDueCallbacks((prev) => prev.filter((c) => c.id !== callbackId));
    if (res.error) setError(res.error);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Dial workspace</h1>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span
            className={`h-2 w-2 rounded-full ${status === "ready" || status === "on-call" ? "bg-brand-green" : status === "unavailable" ? "bg-danger" : status === "sign-in" ? "bg-gold" : "bg-line"}`}
          />
          Zoom Phone: {PHONE_LABEL[status].toLowerCase()}
        </div>
      </div>

      {dueCallbacks.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-gold/40 bg-gold-tint p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gold-text">
            <Clock className="h-4 w-4" /> Due now: {dueCallbacks.length} callback{dueCallbacks.length === 1 ? "" : "s"}
          </div>
          {dueCallbacks.map((cb) => (
            <div key={cb.id} className="flex items-center justify-between text-xs text-ink">
              <span>Due {fmtTime(cb.due_at)}</span>
              <button onClick={() => handleSnooze(cb.id)} className="font-medium text-brand-blue hover:underline">
                Snooze 15m {cb.snooze_count >= 2 ? "(last chance — then escalates)" : ""}
              </button>
            </div>
          ))}
        </div>
      )}

      {setupHint && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-gold/40 bg-gold-tint p-3 text-xs text-ink" role="status">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gold-text">
            <Info className="h-4 w-4" /> Sign in to Zoom Phone to start calling
          </div>
          <p>If the panel on the right shows a Zoom sign-in, sign in there. If it never gets past that, first-time setup needs three things from your Zoom admin:</p>
          <ul className="list-disc pl-5">
            <li>Install the Zoom Phone Smart Embed app from the Zoom Marketplace.</li>
            <li>Enable &quot;Automatically Call From Third Party Apps&quot; and approve this site&apos;s domain.</li>
            <li>Give each agent a Zoom Phone licence (Zoom client 5.9.0 or later).</li>
          </ul>
          <Link href="/admin/settings/zoom" className="font-medium text-brand-blue hover:underline">
            Open the Zoom setup checklist
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-tint px-4 py-2.5 text-sm text-danger" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {current === undefined || pulling ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">Loading your next lead...</CardContent>
        </Card>
      ) : current === null ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">
            {isDemo ? (
              <div className="mx-auto flex max-w-lg flex-col gap-2">
                <p className="font-medium text-ink">No dialable leads in the demo workspace.</p>
                <p>
                  The demo workspace only serves leads whose phone numbers are on its allow-list (the DEMO_ALLOWED_NUMBERS
                  setting), so nobody real can be called by accident. To try calling, add your own test number(s) to
                  DEMO_ALLOWED_NUMBERS as comma-separated E.164 values, then run the seed again (npm run seed), or use the
                  Reset data button in the top bar.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-xl flex-col gap-3 text-left" data-testid="dial-empty">
                <p className="text-center font-medium text-ink">{reason ? reason.title : "No dialable leads right now."}</p>
                <p className="text-center">
                  {reason
                    ? reason.detail
                    : screeningRequired
                      ? "A lead is served only when it is screened, on an active campaign you are rostered on and inside its calling hours, and assigned to you or to nobody."
                      : "A lead is served when it is on an active campaign you are rostered on and inside its calling hours (or assigned to you with no campaign), and not on the do-not-call list."}
                </p>
                {canManage ? (
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    {reason?.fix && (
                      <Button asChild>
                        <Link href={reason.fix.href}>{reason.fix.label}</Link>
                      </Button>
                    )}
                    <Button asChild variant="secondary">
                      <Link href="/admin/import">Upload leads</Link>
                    </Button>
                    {screeningRequired && (
                      <Button asChild variant="secondary">
                        <Link href="/admin/compliance">Screen leads</Link>
                      </Button>
                    )}
                    <Button asChild variant="secondary">
                      <Link href="/admin/leads">Assign leads</Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/admin/campaigns">Campaign rosters</Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-center">{reason && !reason.askManager ? "Nothing to do but wait." : "Ask your manager to fix this."}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {current.campaign?.disclosure_script && (
            <Card className="border-brand-blue/30 bg-brand-blue-tint/40">
              <CardHeader>
                <CardTitle>Opening disclosure</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-ink">{current.campaign.disclosure_script}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{current.lead.full_name ?? "Unknown name"}</CardTitle>
              <span className="text-xs text-muted">
                Attempt {current.lead.attempts + 1}
                {current.campaign ? ` of ${current.campaign.max_attempts}` : ""}
              </span>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="font-mono text-lg text-ink">{current.lead.phone_e164}</span>
              <Button onClick={handleCall} disabled={calling || status === "on-call"}>
                <PhoneCall className="h-4 w-4" /> {calling ? "Starting..." : status === "on-call" ? "On a call" : activeCall ? "Call again" : "Call"}
              </Button>
            </CardContent>
            {activeCall && (
              <CardContent className="flex flex-col gap-1 border-t border-line pt-3 text-xs text-muted">
                <span className="font-medium text-ink" data-testid="call-state">
                  {activeCall.state === "dialing" && "Dialing in the Zoom panel..."}
                  {activeCall.state === "ringing" && "Ringing..."}
                  {activeCall.state === "connected" && "Connected"}
                  {activeCall.state === "ended" &&
                    (activeCall.result === "missed"
                      ? "No answer"
                      : activeCall.result === "rejected"
                        ? "Call rejected"
                        : "Call ended")}
                </span>
                <span>Hold, mute and transfer are in the Zoom phone panel (bottom right). Then pick an outcome below.</span>
              </CardContent>
            )}
            <CardContent className="flex justify-end border-t border-line pt-3">
              <BookMeetingDialog leadId={current.lead.id} leadName={current.lead.full_name} />
            </CardContent>
          </Card>

          {current.campaign?.objection_notes && (
            <details className="rounded-xl border border-line bg-white">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
                Objection handling <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm text-muted">{current.campaign.objection_notes}</div>
            </details>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Notes {selectedDisposition?.requires_note && <span className="text-danger">(required)</span>}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea ref={notesRef} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened on this call? (press N to focus)" />
            </CardContent>
          </Card>

          <Card ref={dispositionRef}>
            <CardHeader>
              <CardTitle>Outcome (press D to jump here)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {dispositions.map((d) => (
                <button
                  key={d.code}
                  onClick={() => setSelectedCode(d.code)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    selectedCode === d.code
                      ? "border-brand-blue bg-brand-blue-tint text-brand-blue"
                      : "border-line bg-white text-ink hover:border-brand-blue-tint-2"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </CardContent>
            {selectedDisposition?.requires_followup && (
              <CardContent className="border-t border-line pt-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-ink">
                  Callback due
                  <input
                    type="datetime-local"
                    value={callbackDueAt}
                    onChange={(e) => setCallbackDueAt(e.target.value)}
                    className="h-9 rounded-md border border-line px-3 text-sm"
                  />
                </label>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end">
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? "Saving..." : "Save & next (Ctrl+Enter)"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
