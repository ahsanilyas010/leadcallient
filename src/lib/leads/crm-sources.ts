// CRM migration presets. Client-safe (no server imports): the migration
// wizard uses them to explain how to export from each CRM and to make a
// better first guess at the column mapping. They are only a starting point:
// export formats change and every column is still confirmed by the admin
// before anything is imported.
import {
  rolesFromMapping,
  suggestMapping,
  type ColumnChoice,
  type ColumnMapping,
  type ColumnRole,
} from "./mapped-import-shared";

export type CrmSourceKey = "hubspot" | "salesforce" | "zoho" | "pipedrive" | "gohighlevel" | "close" | "csv";

export interface CrmSource {
  key: CrmSourceKey;
  name: string;
  // How to get a file out of the CRM, in plain steps.
  exportSteps: string[];
  // Header names this CRM commonly uses, per column role (compared without
  // case, spacing or punctuation). First match wins.
  aliases: Partial<Record<ColumnRole, string[]>>;
}

const COMMON_NOTE = "Include every field (or all properties) so stages, owners, notes and tags come across.";

export const CRM_SOURCES: CrmSource[] = [
  {
    key: "hubspot",
    name: "HubSpot",
    exportSteps: [
      "Open Contacts (or Companies for company records) in HubSpot.",
      "Choose Export, pick CSV, and include all properties.",
      "HubSpot emails you a download link: save the file and upload it here.",
      COMMON_NOTE,
    ],
    aliases: {
      first: ["First Name"],
      last: ["Last Name"],
      email: ["Email", "Email Address"],
      phone: ["Phone Number", "Phone", "Mobile Phone Number"],
      company: ["Company Name", "Associated Company", "Company"],
      owner: ["Contact owner", "HubSpot Owner", "Owner"],
      status: ["Lead Status", "Lifecycle Stage", "Deal Stage"],
      website: ["Website URL", "Website"],
      lastContact: ["Last Activity Date", "Last Contacted", "Last Engagement Date"],
      notes: ["Notes", "Message", "Description"],
      tags: ["Tags", "Lists"],
    },
  },
  {
    key: "salesforce",
    name: "Salesforce",
    exportSteps: [
      "In Salesforce, open a Leads or Contacts report (or list view) that shows every record you want to move.",
      "Add the columns you need, including Lead Status and Lead Owner.",
      "Choose Export, pick Details Only and CSV, and save the file.",
      COMMON_NOTE,
    ],
    aliases: {
      first: ["First Name"],
      last: ["Last Name"],
      email: ["Email"],
      phone: ["Phone", "Mobile", "Mobile Phone"],
      company: ["Company / Account", "Company", "Account Name"],
      owner: ["Lead Owner", "Contact Owner", "Owner Name", "Owner"],
      status: ["Lead Status", "Status", "Stage"],
      website: ["Website"],
      lastContact: ["Last Activity", "Last Activity Date"],
      notes: ["Description", "Notes"],
      contact: ["Title"],
    },
  },
  {
    key: "zoho",
    name: "Zoho CRM",
    exportSteps: [
      "In Zoho CRM, go to Setup, Data Administration, Export (or use the Leads module's Export option).",
      "Choose the Leads (or Contacts) module, all fields, and CSV.",
      "Download the file and upload it here.",
      COMMON_NOTE,
    ],
    aliases: {
      first: ["First Name"],
      last: ["Last Name"],
      email: ["Email"],
      phone: ["Phone", "Mobile"],
      company: ["Company", "Account Name"],
      owner: ["Lead Owner", "Contact Owner", "Owner"],
      status: ["Lead Status", "Stage"],
      website: ["Website"],
      lastContact: ["Last Activity Time"],
      notes: ["Description"],
      tags: ["Tag", "Tags"],
    },
  },
  {
    key: "pipedrive",
    name: "Pipedrive",
    exportSteps: [
      "In Pipedrive, open the Leads inbox, Contacts (People) or Deals list.",
      "Use the list's export option to export all records to CSV.",
      "Save the file and upload it here.",
      COMMON_NOTE,
    ],
    aliases: {
      name: ["Person - Name", "Name", "Contact person"],
      email: ["Person - Email", "Email"],
      phone: ["Person - Phone", "Phone"],
      company: ["Organization - Name", "Organization"],
      owner: ["Person - Owner", "Deal - Owner", "Lead - Owner", "Owner"],
      status: ["Deal - Stage", "Stage", "Deal - Status"],
      tags: ["Lead - Labels", "Person - Labels", "Labels"],
      notes: ["Notes", "Deal - Notes"],
      lastContact: ["Person - Last activity date", "Last activity date"],
    },
  },
  {
    key: "gohighlevel",
    name: "GoHighLevel",
    exportSteps: [
      "In GoHighLevel, open Contacts and select all contacts (or a smart list).",
      "Choose Export Contacts and pick the fields to include.",
      "Save the CSV and upload it here.",
      COMMON_NOTE,
    ],
    aliases: {
      first: ["First Name"],
      last: ["Last Name"],
      email: ["Email"],
      phone: ["Phone"],
      company: ["Business Name", "Company Name"],
      owner: ["Assigned To", "Contact Owner", "User"],
      status: ["Opportunity Stage", "Pipeline Stage", "Stage", "Status"],
      tags: ["Tags"],
      lastContact: ["Last Activity"],
      website: ["Website"],
    },
  },
  {
    key: "close",
    name: "Close",
    exportSteps: [
      "In Close, open the Leads (or Contacts) view and run a search that matches every record you want to move.",
      "Choose Export, pick CSV, and include all fields.",
      "Save the file and upload it here.",
      COMMON_NOTE,
    ],
    aliases: {
      name: ["Contact Name", "primary_contact_name", "contact_name"],
      company: ["Lead Name", "display_name", "Company"],
      email: ["Contact Email", "primary_contact_primary_email", "Email"],
      phone: ["Contact Phone", "primary_contact_primary_phone", "Phone"],
      status: ["Status", "status_label", "Lead Status"],
      owner: ["Lead Owner", "user_name", "Owner", "Assigned To"],
      website: ["URL", "url", "Website"],
      notes: ["Description", "description", "Notes"],
      lastContact: ["Last Communication Date", "date_last_contacted"],
    },
  },
  {
    key: "csv",
    name: "Another CRM (CSV export)",
    exportSteps: [
      "Export your leads or contacts from your current system as a CSV or Excel file.",
      "Include names, phone numbers, emails, company, owner, stage, notes and tags if it has them.",
      "Upload the file here and match each column on the next step.",
    ],
    aliases: {},
  },
];

export function crmSource(key: string | null | undefined): CrmSource | undefined {
  return CRM_SOURCES.find((c) => c.key === key);
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// First guess at the column roles for a file from this CRM: its known header
// names first, then the general guesser for anything left.
export function presetRoles(headers: string[], key: CrmSourceKey): Record<string, ColumnChoice> {
  const base = rolesFromMapping(headers, suggestMapping(headers));
  const src = crmSource(key);
  if (!src || Object.keys(src.aliases).length === 0) return base;

  const out: Record<string, ColumnChoice> = { ...base };
  const taken = new Set<string>();
  const assign = (role: ColumnRole, header: string) => {
    // A role is used once: clear it from any other column the guesser chose.
    for (const h of headers) if (out[h]?.role === role && h !== header) out[h] = { role: "extra", label: h };
    out[header] = { role };
    taken.add(header);
  };
  for (const [role, names] of Object.entries(src.aliases) as [ColumnRole, string[]][]) {
    for (const n of names) {
      const h = headers.find((x) => !taken.has(x) && norm(x) === norm(n));
      if (h) {
        assign(role, h);
        break;
      }
    }
  }
  // A full-name column and first/last columns can't both be the name.
  const has = (r: ColumnRole) => headers.some((h) => out[h]?.role === r);
  if (has("first") && has("last")) {
    for (const h of headers) if (out[h]?.role === "name") out[h] = { role: "extra", label: h };
  }
  return out;
}

export type { ColumnMapping };
