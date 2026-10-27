# Cowork prompt: ship and verify the 23 Oct meeting fixes

Paste everything below the line into a Claude Cowork session that has the
Supabase, Vercel and GitHub connectors enabled.

---

You are helping Assorted Business LLC ship the LeadCallient CRM fixes from our
23 October review meeting with Nehal. The code is in GitHub repo
`ahsanilyas010/leadcallient`, pull request #10, branch
`claude/brave-mccarthy-t9iyax`. The app is deployed on Vercel as project
`dialbyhand` and uses a Supabase Postgres database.

Work through the steps in order. Before each step that changes production
(merging, running migrations, redeploying), tell me what you are about to do
and wait for my OK. After each step, report what you did and what you saw.

## 1. Merge the pull request

- Open PR #10 and confirm CI is green (the GitHub Actions "build" job and the
  Vercel preview).
- Summarise the PR description for me in five bullets.
- Mark it ready for review and merge it into `main` with a merge commit.

## 2. Apply the database migrations

The PR adds two migrations under `supabase/migrations/`:

- `00000000000113_optional_screening_personal_dialing.sql`: adds
  `workspaces.require_screening` (default false) and redefines
  `next_lead_for_agent`, `lead_dial_block_reason` and `dial_queue_diagnosis`.
- `00000000000114_client_report_campaign_filter.sql`: replaces
  `client_disposition_breakdown`, `client_agent_activity` and
  `manager_client_report` with versions that take `p_campaign_id`.

Apply them to the production Supabase project, either with
`npx supabase db push` from a checkout of `main`, or by running each file's SQL
through the Supabase connector. Afterwards confirm:

- `select require_screening from workspaces limit 3;` returns rows.
- `select proname, pg_get_function_arguments(oid) from pg_proc where proname
  in ('manager_client_report','client_agent_activity','client_disposition_breakdown');`
  shows the `p_campaign_id uuid` argument on each, and only one version of
  each function.

## 3. Check the Vercel deployment

- Confirm the production deployment of `dialbyhand` built from the merge
  commit and is "Ready".
- The contact number +92 321 8526405 is now built into the code, so no
  environment variable is needed for it. Only if I later give you a different
  number, set `NEXT_PUBLIC_COMPANY_PHONE` and `NEXT_PUBLIC_COMPANY_WHATSAPP_URL`
  (format `https://wa.me/<digits>`) in the Vercel project and redeploy.

## 4. Verify each meeting fix in the live app

Sign in as a super admin (I will give you credentials when you reach this
step) and check the following. For each item say pass or fail and, on a
fail, what you saw.

1. **Compliance page** shows a "Require screening before dialing" switch at
   the top, currently off.
2. **Upload leads**: import a small CSV (3 rows: name, phone, company, no
   email column) into a campaign. It must import with the email missing and
   the review step must not say "Nothing can be imported".
3. **Campaign page**: the campaign has an "Upload a file" button that opens
   the importer with that campaign already selected.
4. **Leads page**: assign the imported leads to an agent.
5. **Call sheet** (signed in as that agent, or as the admin after ticking
   "I will call these myself" on import): the cards show a green dial button
   with the number, not "On hold" or "Not screened yet".
6. **Dial workspace**: the next lead loads instead of "No dialable leads".
7. **A lead with no campaign** assigned to an agent is dialable from that
   agent's call sheet.
8. **Client reports**: the Campaign and Outcomes dropdowns narrow the funnel
   and outcomes; "Download PDF" works with a campaign chosen.
9. **Contact page** (`/contact`, signed out): shows "Call +92 321 8526405" and
   "Chat on WhatsApp" buttons; nothing says "coming soon".
10. **Plan bar / Agents & billing**: the top bar button says "Contact us" and
    the billing page shows seats in use and a contact card, not a price or
    seat picker.
11. **Settings**: tabs include Branding, Clients & logos, Campaigns, Email
    templates, Zoom, Screening & compliance, Plugins & integrations.
12. **Performance**: an agent login sees "My performance" with a CSV download;
    the admin can open any agent's daily report.

## 5. Report back

Give me a short checklist of the twelve items with pass/fail, any errors you
hit, and anything Nehal should re-test herself. Do not change any code; if
something fails, describe it so it can be fixed in a follow-up pull request.
