export type ContactStatus = "active" | "do_not_contact" | "bounced" | "archived";

export type OutreachContact = {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  email: string;
  region: string;
  tags: string[];
  status: ContactStatus;
  notes: string;
};

export type OutreachList = {
  id: string;
  name: string;
  description: string;
  isDynamic: boolean;
  query: string;
  contactIds: string[];
};

export type SenderProfile = {
  id: string;
  provider: "gmail" | "outlook";
  fromName: string;
  fromEmail: string;
  connectionStatus: "connected" | "pending" | "disconnected";
  domainVerified: boolean;
};

export type CampaignStatus = "draft" | "scheduled" | "queued";

export type Campaign = {
  id: string;
  name: string;
  subject: string;
  body: string;
  listId: string | null;
  senderId: string | null;
  assetTitle: string;
  assetUrl: string;
  status: CampaignStatus;
  sendAt: string | null;
  throttlePerHour: number;
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    replied: number;
  };
};

export type ContextSource = {
  id: string;
  title: string;
  content: string;
};

export type MailMessage = {
  id: string;
  direction: "inbound" | "outbound";
  fromEmail: string;
  body: string;
  sentAt: string;
};

export type AgentRun = {
  id: string;
  status: "draft" | "sent";
  draftBody: string;
  reasoning: string;
  createdAt: string;
};

export type MailThread = {
  id: string;
  provider: "gmail" | "outlook";
  subject: string;
  participants: string[];
  snippet: string;
  intent: string | null;
  sentiment: string | null;
  unread: boolean;
  needsReply: boolean;
  lastMessageAt: string;
  sample: boolean;
  messages: MailMessage[];
  runs: AgentRun[];
};

export type OutreachState = {
  contacts: OutreachContact[];
  lists: OutreachList[];
  senders: SenderProfile[];
  campaigns: Campaign[];
  context: ContextSource[];
  threads: MailThread[];
};

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\|\s*['"]([^'"]*)['"])?\s*\}\}/g;

export function contactName(contact: Pick<OutreachContact, "firstName" | "lastName" | "email">) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.email;
}

export function renderOutreachTemplate(
  template: string,
  contact: Partial<OutreachContact> | null | undefined,
) {
  return template.replace(TOKEN_PATTERN, (_match, rawKey: string, fallback = "") => {
    const key = rawKey.replace(/^(contact|journalist)\./, "");
    const map: Record<string, string | undefined> = {
      first_name: contact?.firstName ?? undefined,
      last_name: contact?.lastName ?? undefined,
      company: contact?.company,
      role: contact?.role,
      region: contact?.region,
      email: contact?.email,
      outlet: contact?.company,
      beat: contact?.role,
    };
    const value = map[key];
    return value && value.trim() ? value : fallback;
  });
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createId(prefix: string) {
  return id(prefix);
}

const SAMPLE_ANCHOR = "2026-10-01T09:00:00.000Z";
const hoursAgo = (hours: number) => new Date(new Date(SAMPLE_ANCHOR).getTime() - hours * 3_600_000).toISOString();

export function seedOutreach(): OutreachState {
  const contacts: OutreachContact[] = [
    {
      id: "ct_maya",
      firstName: "Maya",
      lastName: "Iyer",
      company: "Northwind Labs",
      role: "Head of Partnerships",
      email: "maya.iyer@northwind.example",
      region: "Bengaluru",
      tags: ["partner", "saas"],
      status: "active",
      notes: "",
    },
    {
      id: "ct_arjun",
      firstName: "Arjun",
      lastName: "Mehta",
      company: "Harbor & Co",
      role: "Revenue Operations",
      email: "arjun@harbor.example",
      region: "Mumbai",
      tags: ["revops"],
      status: "active",
      notes: "",
    },
    {
      id: "ct_leah",
      firstName: "Leah",
      lastName: "Okoye",
      company: "Fieldnote",
      role: "Founder",
      email: "leah@fieldnote.example",
      region: "Lagos",
      tags: ["founder"],
      status: "active",
      notes: "",
    },
    {
      id: "ct_sam",
      firstName: "Sam",
      lastName: "Patel",
      company: "Kiln Studio",
      role: "Operations Lead",
      email: "sam.patel@kiln.example",
      region: "London",
      tags: ["ops"],
      status: "do_not_contact",
      notes: "Asked to be removed from sequences.",
    },
  ];

  return {
    contacts,
    lists: [
      {
        id: "ls_partners",
        name: "Partnership leads",
        description: "Active contacts tagged for partnership outreach.",
        isDynamic: false,
        query: "",
        contactIds: ["ct_maya", "ct_arjun", "ct_leah"],
      },
    ],
    senders: [],
    campaigns: [
      {
        id: "cp_intro",
        name: "Intro sequence",
        subject: "A simpler way to keep follow-ups moving",
        body: "Hi {{contact.first_name || 'there'}},\n\nI wanted to share how teams at {{contact.company || 'companies like yours'}} keep contacts, follow-ups, and replies in one place.\n\nOpen to a short look this week?\n\nBest,",
        listId: "ls_partners",
        senderId: null,
        assetTitle: "Product overview",
        assetUrl: "",
        status: "draft",
        sendAt: null,
        throttlePerHour: 25,
        metrics: { sent: 0, opened: 0, clicked: 0, bounced: 0, replied: 0 },
      },
    ],
    context: [],
    threads: [
      {
        id: "th_maya",
        provider: "gmail",
        subject: "Re: A simpler way to keep follow-ups moving",
        participants: ["maya.iyer@northwind.example"],
        snippet: "This is useful. Can you share pricing for a 12-person team?",
        intent: "interested",
        sentiment: "positive",
        unread: true,
        needsReply: true,
        lastMessageAt: hoursAgo(3),
        sample: true,
        messages: [
          {
            id: "ms_1",
            direction: "outbound",
            fromEmail: "you@workifyr.example",
            body: "Hi Maya,\n\nI wanted to share how teams keep contacts, follow-ups, and replies in one place.\n\nOpen to a short look this week?",
            sentAt: hoursAgo(26),
          },
          {
            id: "ms_2",
            direction: "inbound",
            fromEmail: "maya.iyer@northwind.example",
            body: "This is useful. Can you share pricing for a 12-person team, and whether we can start with contacts and outreach only?",
            sentAt: hoursAgo(3),
          },
        ],
        runs: [],
      },
      {
        id: "th_arjun",
        provider: "outlook",
        subject: "Pipeline cleanup next quarter",
        participants: ["arjun@harbor.example"],
        snippet: "Looping in our ops lead. Send a time for Thursday.",
        intent: "meeting",
        sentiment: "neutral",
        unread: false,
        needsReply: true,
        lastMessageAt: hoursAgo(20),
        sample: true,
        messages: [
          {
            id: "ms_3",
            direction: "inbound",
            fromEmail: "arjun@harbor.example",
            body: "Looping in our ops lead. Send a time for Thursday and a one-page outline of what the first month looks like.",
            sentAt: hoursAgo(20),
          },
        ],
        runs: [],
      },
    ],
  };
}

const STORAGE_KEY = "workifyr.outreach.v1";

export function loadOutreach(): OutreachState {
  if (typeof window === "undefined") return seedOutreach();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedOutreach();
    const parsed = JSON.parse(raw) as OutreachState;
    if (!parsed || !Array.isArray(parsed.contacts) || !Array.isArray(parsed.lists)) return seedOutreach();
    return {
      ...seedOutreach(),
      ...parsed,
      threads: parsed.threads ?? seedOutreach().threads,
      context: parsed.context ?? [],
      senders: parsed.senders ?? [],
      campaigns: parsed.campaigns ?? [],
    };
  } catch {
    return seedOutreach();
  }
}

export function saveOutreach(state: OutreachState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("workifyr-outreach"));
}

export function parseContactCsv(text: string): { contacts: Omit<OutreachContact, "id" | "status">[]; rejected: number } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { contacts: [], rejected: 0 };
  const headers = rows[0].map((cell) => cell.trim().toLowerCase());
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const first = indexOf("first");
  const last = indexOf("last");
  const company = indexOf("company", "outlet", "organization", "organisation");
  const role = indexOf("role", "title", "beat", "position", "focus");
  const email = indexOf("email");
  const region = indexOf("region", "city", "location");
  const tags = indexOf("tag");
  const notes = indexOf("note");

  const contacts: Omit<OutreachContact, "id" | "status">[] = [];
  let rejected = 0;
  for (const row of rows.slice(1)) {
    const value = (index: number) => (index >= 0 ? (row[index] ?? "").trim() : "");
    const emailValue = value(email).toLowerCase();
    if (!isValidEmail(emailValue)) {
      rejected += 1;
      continue;
    }
    contacts.push({
      firstName: value(first),
      lastName: value(last),
      company: value(company),
      role: value(role),
      email: emailValue,
      region: value(region),
      tags: value(tags)
        .split(/[|,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: value(notes),
    });
  }
  return { contacts, rejected };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}

export const CSV_HEADERS = "First Name,Last Name,Company,Role,Email Address,Region,Tags";

export function csvExample() {
  return `${CSV_HEADERS}\nMaya,Iyer,Northwind Labs,Head of Partnerships,maya.iyer@northwind.example,Bengaluru,partner|saas`;
}
