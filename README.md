# LeadCallient

A multi-tenant contact-centre CRM and workforce platform. Every screen runs on
a real Supabase Postgres database (Auth + Row Level Security + Storage); there
is no in-memory or sample-data layer. Calling goes through your own Zoom Phone account (Zoom's Smart Embed dial pad),
billing is real Stripe, email is real Resend. Stripe and Resend switch on when
their keys are set and are cleanly disabled when they aren't.

Product of **Assorted Business LLC** (name, address and contact details live in
`COMPANY` in `src/lib/brand.ts`).

## What's in it

| Area | Route | Notes |
|---|---|---|
| Upload leads | `/admin/import` | CSV/Excel importer of any shape: the admin says what each column is (super admin, ops manager); also embedded in the Lead inbox and Data |
| Leads | `/admin/leads` | Every uploaded lead and phone-less contact with every column from the file; filter by upload, campaign, owner, screening; tick rows to assign to an agent (auto-rosters them), screen, or move to a campaign |
| Dial workspace | `/dial` | Compliance-gated next-lead queue, Zoom Phone Smart Embed dial pad, dispositions, callbacks. Agents and, since migration 99, admins/ops managers |
| Call sheet | `/callsheet` | Board of leads, a column per campaign (overdue and upcoming first); dial from a card, log the outcome, edit notes and next step, promote phone-less contacts |
| Live floor | `/live` | Agent states, today's calls/connects/conversions (Realtime) |
| Performance | `/performance` | Campaign funnels, agent scorecards |
| People | `/admin/people` | Create users (one-time password), reset, deactivate, assign to campaigns |
| Campaigns | `/admin/campaigns` | Clients, campaigns (optional caller ID, calling window, attempts, recording), rosters, auto-assign, inbound webhook token |
| Attendance | `/admin/attendance` | Today, history, leave approvals, shifts, campaign rosters |
| Compliance | `/admin/compliance` | Suppression list, screening, DNC stats |
| Data | `/admin/data` | Data sources with lawful basis, vendor CSV/XLSX import, source performance, phone-less contacts |
| Quality | `/quality` | QA scorecards, agent acknowledgement |
| Client reports | `/portal` | Client login sees own results; admins preview any client; filter by campaign and outcome group, PDF per campaign |
| Integrations / Settings | `/admin/integrations`, `/admin/settings/*` | Zoom, email templates, branding, lead upload |
| Security & audit | `/admin/security` | Audit log, recent sign-ins, credential events |
| Agents & billing | `/admin/billing` | Seats in use; Stripe checkout/portal when Stripe is configured, otherwise a contact card (phone / WhatsApp / email from `NEXT_PUBLIC_COMPANY_*`) and bank-transfer details |
| Platform owner | `/platform` | Vendor-side workspace list and suspension |

Roles: `super_admin`, `ops_manager`, `team_lead`, `agent`, `qa_analyst`,
`client`. Admins, managers, team leads, QA and clients are free; 3 agents are
free per workspace and more seats are bought through Stripe.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in the Supabase keys at minimum
```

1. Create a Supabase project. Copy the URL, anon key and service_role key into
   `.env.local`. Enable the **Vault** extension (Database → Extensions).
2. `npx supabase login` then `npx supabase link --project-ref <ref>` and
   `npx supabase db push` to apply `supabase/migrations`.
   (`supabase/migrations_legacy_reference/` is the original single-tenant
   schema, kept only for reference and never applied.)
3. After any schema change run `npm run types:gen` to refresh
   `src/lib/supabase/database.generated.ts`.
4. Seed: set `PLATFORM_ADMIN_EMAILS` (existing Supabase Auth users),
   optionally `ASSORTED_ADMIN_EMAIL`/`ASSORTED_ADMIN_PASSWORD` for the vendor's
   own workspace, then `npm run seed`. This always creates the **demo**
   workspace (3 campaigns, 500 leads, one login per role).
5. `npm run dev`, open http://localhost:3000.
6. Authentication → Email Templates / SMTP: configure a sender so account
   emails (password resets, email templates) can be delivered.

### Sign-up and guided setup

Sign-up (`/signup`) asks for name, company, email and password only. The
workspace is created **active** straight away (free plan, 3 agent seats) and
the user lands on their dashboard. There is no setup wizard (`/onboarding`
redirects to `/start`). Instead:

- **Get started card** on the manager dashboard (`/live`): eight steps (brand,
  Zoom, team, campaign, leads, screening, roster, first call), each with a
  one-line reason and a button to the right page. Progress comes from one
  manager-only RPC, `setup_progress()`, and updates as steps are completed.
  "Hide" is remembered per user; the **Setup guide n/8** button in the header
  reopens it from any page.
- **Product tour**: a step-by-step walkthrough that spotlights real sidebar
  items and header controls (`data-tour` attributes; steps per role in
  `src/lib/guide/tours.ts`). A welcome dialog offers it once on a user's first
  login (never in the demo workspace); the **?** button in the header replays
  it any time.
- State per user lives in `user_guide_state` (own row only, RLS). Key pages
  (Campaigns, People, Data, Compliance, Lead inbox) show a short empty state
  with a next-action button until there is data.

### Demo workspace

`NEXT_PUBLIC_DEMO_MODE=true` adds a role switcher to `/login` that signs in to
the seeded `demo` workspace (real Supabase Auth, real rows). All demo logins
share the public password `LeadCallient@123` (`DEMO_SEED_PASSWORD`). A **Reset
data** button in the top bar re-seeds that one workspace.

The demo workspace can only ever dial numbers in `DEMO_ALLOWED_NUMBERS`
(comma-separated E.164), enforced inside `next_lead_for_agent()`. With the list
empty, the dial queue is empty by design.

### Calling (Zoom Phone Smart Embed)

Calls run through the agent's own Zoom Phone account. On `/dial` a Zoom-hosted
dial pad (iframe) appears in a floating dock bottom right; agents sign in to
Zoom inside it. The Call button records the attempt (`calls` row) and tells
the dock to dial; Zoom's call events (ringing, connected, ended, call log,
recording link, AI summary) are relayed from the browser to the server and
update that row. Hold, mute and transfer live in the Zoom panel.

Zoom admin prerequisites (one-off):

1. Install the **Zoom Phone Smart Embed** app from the Zoom Marketplace.
2. Enable **Automatically Call From Third Party Apps** and approve this site's
   domain.
3. Give each agent a Zoom Phone licence; Zoom desktop client 5.9.0 or later.

Limits to know: call events come from the browser and are not server-verified
(Zoom webhooks are the future hardening), so durations and recording links are
agent-reported. Call recording is whatever your Zoom Phone plan records; we
only store the link Zoom reports. A campaign's optional caller ID must be an
E.164 number on your Zoom Phone plan. Existing Twilio tables and columns remain
in the schema but are unused.

### Resend

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` (a verified sender). Email only sends
through an **approved** template and every send is logged in `email_log`.

### Stripe

Create a recurring, graduated per-seat monthly price (seats 1–3 at $0), then set
`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET`. Webhook
endpoint: `/api/billing/webhook` with `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`. Enable the
Customer portal.

### Inbound lead webhook

A manager generates a token under Campaigns → Inbound webhook (shown once).
`POST /api/leads/inbound` with `Authorization: Bearer <token>` creates a pending
lead. Consent is required, duplicates return 409, suppressed numbers 422.
Add `?dry_run=1` (or header `X-Dry-Run: 1`) to validate without saving. Field
aliases from Apollo / Clay / Zapier are accepted (`First Name`, `work_email`,
`organization_name`, `direct_phone`, `campaign` / `campaign_code`, ...); unknown
fields are kept in `custom`. Every delivery is logged in `lead_intake_events`
(last 4 digits of the phone only).

### Lead Gen seat

Three seat types: **Sales** (`agent`), **Lead Gen** (`lead_gen`) and Super
admin. Lead Gen finds and loads leads and hands them to sales; they never dial,
hear recordings, or see calls, QA, attendance, billing or people. They are not a
metered seat (only active `agent`s count). Demo login:
`leadgen@leadcallient.demo` (same shared password).

- `/leadgen` dashboard, `/leadgen/leads` inbox (search, filter, add lead, CSV /
  XLSX import, assign to an agent or round-robin), `/leadgen/connectors`.
- Leads enter unowned and `pending`; **screening stays with managers**
  (`screen_leads`), so `next_lead_for_agent` still only serves screened leads.
- **Zapier is the one connector.** Apollo and Clay push into Zapier, and Zapier
  POSTs here. In Zapier add a *Webhooks by Zapier -> POST* action to
  `https://<your-app>/api/leads/inbound`, Payload Type Json, header
  `Authorization: Bearer <token>`, map phone / name / email / company / title /
  location, set `campaign_id` (id, code or name), `source` (`apollo` / `clay` /
  `zapier`), `consent` = true and `consent_text`. Step-by-step guides, a sample
  payload, curl and a dry-run tester live on `/leadgen/connectors`.
- `npm run test:leadgen` proves the seat against the live DB (happy paths, the
  webhook handler, dry run, delivery log, hand-off, and RLS denials).

### Importing leads

One importer (`src/lib/leads/mapped-import.ts`, UI `src/components/leads/lead-importer.tsx`) serves
`/admin/import`, the Lead inbox import button and the Data page's vendor import (which also requires a
data source with a lawful basis). Steps: **1** pick a .csv/.xlsx (max 10 MB, 20,000 rows) and the campaign;
**2** say what each column is; **3** review (a dry run, nothing is saved); **4** import.

- **Column by column.** Step 2 lists every column in the file with its first values and a role: Name
  (full), First name, Last name, Phone number, Company, Email, the optional fields below, "Extra
  information" (kept under a label you choose, default the header) or "Don't import". Headers are
  auto-suggested. Nothing in the file is lost unless you skip it. Numbers are normalised to E.164 using
  the campaign's country. The browser builds the `ColumnMapping` with `mappingFromRoles()` and the server
  re-validates it (`validateMapping`).
- **No phone column?** Allowed. Every row is then kept as a contact without a number
  (`unphoned_contacts`, with company and all extra columns in `custom`), as are rows whose number is blank.
  Assign them under Leads; the agent sees them on the call sheet, adds the number they find, and
  `promote_unphoned_contact` (migration 112) turns the contact into a `pending` lead carrying its data.
- **Optional mapping.** Campaign (a column of campaign names that must match your campaigns, case and
  spacing ignored; unmatched rows are listed and skipped, unless you tick "use the step-1 campaign"),
  Contact person, Website, Notes, Next step, Appointment / follow-up date-time and Last contact date
  (common formats are read; a time with no zone is read in the campaign's timezone; unreadable dates are
  listed in the review, the lead is still imported). "Keep my other columns as extra information"
  (default on) saves every unmapped column in `leads.custom`. `leads.group_label` exists (migration 101)
  but is unused: the call sheet groups leads by campaign.
- **Review** shows counts for rows that will import, invalid numbers (row + reason), repeats in the file,
  numbers already in the workspace and suppressed numbers (skipped), plus a sample of the cleaned result.
  Suppressed numbers are never imported; leads always arrive `pending`.
- **Screening is optional.** Compliance has a "Require screening before dialing" switch
  (`workspaces.require_screening`, migration 113, off by default). Off: a lead can be dialled as soon as it is
  uploaded and assigned; the suppression list still blocks numbers. On: every lead must pass screening first,
  for markets that need a TPS/DNC-style check before each call. "Run screening now" runs the manual check
  (`screen_lead_batch`): numbers are checked against the workspace suppression list only; it is not a live
  TPS/DNC lookup. Lead gen cannot screen or roster. Compliance always offers a Screen button per batch (with
  its pending count) plus "Screen N pending leads" for everything still waiting, including leads added
  outside a batch (`screen_leads`).
- **Assigning.** Under Leads (or a campaign's lead table) an admin can assign any lead or contact to an
  agent, screened or not; assignment also puts the agent on that campaign's roster, which the dial queue,
  call sheet and lead RLS all require. A lead that belongs to no campaign is a personal list: the agent it is
  assigned to can dial it from the call sheet, and the dial queue serves it after campaign leads (campaign
  defaults apply: 6 attempts, 24 h cooling-off, no calling window).
- **Dialing your own data.** Tick "I will call these myself": the leads are assigned to you and you are put
  on that campaign's roster (migration 99 lets super admins and ops managers be rostered). **Start dialing**
  opens `/dial`, which behaves exactly as for an agent. A lead is dialable if it is on a campaign you are
  rostered on (or assigned to you with no campaign), assigned to you or to nobody, not suppressed and, when
  the workspace requires it, screened. A campaign's own page has an "Upload a file" button that opens the
  importer with that campaign chosen. The demo workspace only dials its allow-listed numbers by design.
- Agents can edit next step, appointment, website and contact person on their own leads
  (`update_my_lead`, optional `p_extra`).

### Zoom meetings

Each workspace connects its own Zoom **Server-to-Server OAuth** app at
`/admin/settings/zoom` (Account ID, Client ID, Client Secret; the secret is kept
in Supabase Vault and never returned to the browser). Scopes:
`meeting:write:meeting:admin`, `meeting:read:meeting:admin`,
`meeting:update:meeting:admin`, `meeting:delete:meeting:admin`,
`user:read:user:admin`; then activate the app. Agents, team leads and managers
book meetings from a lead (Call sheet, dial screen) and manage them on `/meetings`.
The host is the booker, so their login email must match a Zoom user on the
account. The host start link is fetched fresh from Zoom on every Start and is
never stored. `ZOOM_OAUTH_BASE` / `ZOOM_API_BASE` override the Zoom base URLs
(used by `npm run test:zoommeetings`, which runs against a local mock Zoom).
The same settings page carries the Zoom Phone calling checklist.

## Tests (run against a staging Supabase project, never production)

| Command | Proves |
|---|---|
| `npm run test:compliance` | Compliance gate, claim/skip-locked concurrency, DNC suppression |
| `npm run test:rls` | RLS for every role over real sessions (needs the `assorted` workspace seed) |
| `npm run test:campaigns` | Campaign/client/lead/roster flows, auto-assign, webhook |
| `npm run test:leadgen` | Lead Gen seat: add/import/webhook/dry run/hand-off, RLS denials |
| `npm run test:zoomcalls` | Zoom call tracking: startCall rows, the event state machine, illegal transitions, cross-agent isolation |
| `npm run test:ops` | Shifts, leave, suppression, data sources, promotion |
| `npm run test:zoommeetings` | Zoom credential storage (Vault), token caching, meeting flows against a mock Zoom, RLS, audit |
| `npm run test:guide` | Guided setup: `setup_progress()` counts and access, `user_guide_state` RLS, new workspaces start active |
| `npm run test:import` | Mapped importer: header suggestions, mapping rules, dates, dry run, import, call-myself + screening, role limits, isolation (uses the throwaway "ZZ Signup Test Co" workspace) |
| `npm run test:e2e` | Browser sign-in as every role and every nav screen (needs the app running; `npx playwright install chromium` once) |

## Known limitations

- **Screening is a manual stub** (`src/lib/compliance/screening.ts`): it passes a
  lead unless its number is suppressed. A real TPS/CTPS/National DNC provider
  plugs in behind the `ScreeningProvider` interface.
- No holiday calendar; no QA template editor.
- Lead status isn't advanced automatically by the dialer; agents set it.
- No in-app call transfer, call recording or mute/hold controls: those are in
  the Zoom Phone panel. The Zoom iframe flow needs a real Zoom Phone account
  and has only been tested up to the state machine and database.

## Deploy (Vercel)

Import the repo (Next.js defaults), add the environment variables from
`.env.example`, run migrations against the production project, and add your
domain. Seed only the workspaces you want.
