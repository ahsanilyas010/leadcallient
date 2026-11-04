import { NextResponse } from "next/server";
import { requireRealProfile } from "@/lib/auth/current-profile";
import { createRealClient } from "@/lib/supabase/real";

// CSV of leads (or contacts without a number) with the Leads page's filters:
// every mapped field, tags, list and each piece of extra information as its
// own column. Managers and the Data-only role. Row-level security still
// decides what is visible (trashed records never are).
const MAX_ROWS = 20_000;
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  // A cell that would start a spreadsheet formula gets a leading apostrophe;
  // phone numbers like +44 7700 900123 are left alone.
  const formula = /^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s);
  const out = (formula ? "'" : "") + s;
  return /[",\n\r]/.test(out) || formula ? `"${out.replace(/"/g, '""')}"` : out;
}

export async function GET(request: Request) {
  const profile = await requireRealProfile();
  if (!["super_admin", "ops_manager", "data_manager"].includes(profile.role)) return new NextResponse("Not allowed", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const kind = sp.get("kind") === "contact" ? "contact" : "lead";
  const batch = sp.get("batch") ?? "";
  const campaign = sp.get("campaign") ?? "";
  const agent = sp.get("agent") ?? "";
  const screening = sp.get("screening") ?? "";
  const tag = (sp.get("tag") ?? "").slice(0, 40);
  const list = (sp.get("list") ?? "").slice(0, 80);
  const q = (sp.get("q") ?? "").trim().replace(/[,()%*\\]/g, " ").slice(0, 60).trim();
  const supabase = await createRealClient();
  const ws = profile.workspace_id;

  const [{ data: campaigns }, { data: people }] = await Promise.all([
    supabase.from("campaigns").select("id, name").eq("workspace_id", ws),
    supabase.from("profiles").select("id, full_name").eq("workspace_id", ws),
  ]);
  const campaignName = new Map((campaigns ?? []).map((c) => [c.id, c.name]));
  const personName = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const rows: Record<string, unknown>[] = [];
  const digits = q.replace(/\D/g, "");
  for (let from = 0; from < MAX_ROWS; from += 1000) {
    let page: Record<string, unknown>[] = [];
    if (kind === "lead") {
      let query = supabase
        .from("leads")
        .select("full_name, phone_e164, company_name, email, contact_name, website, campaign_id, assigned_to, screening_status, status, tags, group_label, next_step, appointment_at, last_contact_at, agent_notes, custom, source, created_at")
        .eq("workspace_id", ws);
      if (campaign === "none") query = query.is("campaign_id", null);
      else if (isUuid(campaign)) query = query.eq("campaign_id", campaign);
      if (agent === "unassigned") query = query.is("assigned_to", null);
      else if (isUuid(agent)) query = query.eq("assigned_to", agent);
      if (isUuid(batch)) query = query.eq("batch_id", batch);
      if (["pending", "passed", "failed", "expired"].includes(screening)) query = query.eq("screening_status", screening);
      if (tag) query = query.contains("tags", [tag]);
      if (list) query = query.eq("group_label", list);
      if (q) {
        const parts = [`full_name.ilike.%${q}%`, `company_name.ilike.%${q}%`, `email.ilike.%${q}%`, `contact_name.ilike.%${q}%`];
        if (digits.length >= 4) parts.push(`phone_e164.ilike.%${digits}%`);
        query = query.or(parts.join(","));
      }
      const { data, error } = await query.order("created_at", { ascending: false }).range(from, from + 999);
      if (error) return new NextResponse(error.message, { status: 500 });
      page = (data ?? []) as Record<string, unknown>[];
    } else {
      let query = supabase
        .from("unphoned_contacts")
        .select("full_name, company_name, email, city, campaign_id, assigned_to, custom, created_at")
        .eq("workspace_id", ws)
        .is("promoted_lead_id", null);
      if (campaign === "none") query = query.is("campaign_id", null);
      else if (isUuid(campaign)) query = query.eq("campaign_id", campaign);
      if (agent === "unassigned") query = query.is("assigned_to", null);
      else if (isUuid(agent)) query = query.eq("assigned_to", agent);
      if (q) query = query.or([`full_name.ilike.%${q}%`, `company_name.ilike.%${q}%`, `email.ilike.%${q}%`].join(","));
      const { data, error } = await query.order("created_at", { ascending: false }).range(from, from + 999);
      if (error) return new NextResponse(error.message, { status: 500 });
      page = (data ?? []) as Record<string, unknown>[];
    }
    rows.push(...page);
    if (page.length < 1000) break;
  }

  // Extra information keys, in first-seen order.
  const extra: string[] = [];
  for (const r of rows) {
    const c = r.custom;
    if (c && typeof c === "object" && !Array.isArray(c)) for (const k of Object.keys(c)) if (!extra.includes(k)) extra.push(k);
  }
  const base =
    kind === "lead"
      ? [
          ["Name", "full_name"],
          ["Phone", "phone_e164"],
          ["Company", "company_name"],
          ["Email", "email"],
          ["Contact person", "contact_name"],
          ["Website", "website"],
          ["Campaign", "campaign_id"],
          ["Owner", "assigned_to"],
          ["Screening", "screening_status"],
          ["Stage", "status"],
          ["Tags", "tags"],
          ["List", "group_label"],
          ["Next step", "next_step"],
          ["Appointment", "appointment_at"],
          ["Last contact", "last_contact_at"],
          ["Notes", "agent_notes"],
          ["Source", "source"],
          ["Added", "created_at"],
        ]
      : [
          ["Name", "full_name"],
          ["Company", "company_name"],
          ["Email", "email"],
          ["City", "city"],
          ["Campaign", "campaign_id"],
          ["Owner", "assigned_to"],
          ["Added", "created_at"],
        ];
  const lines = [[...base.map(([h]) => h), ...extra].map(csvCell).join(",")];
  for (const r of rows) {
    const cells = base.map(([, k]) => {
      const v = r[k];
      if (k === "campaign_id") return v ? (campaignName.get(String(v)) ?? "") : "";
      if (k === "assigned_to") return v ? (personName.get(String(v)) ?? "") : "";
      return v;
    });
    const custom = (r.custom && typeof r.custom === "object" ? r.custom : {}) as Record<string, unknown>;
    lines.push([...cells, ...extra.map((k) => custom[k])].map(csvCell).join(","));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind === "lead" ? "leads" : "contacts"}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
