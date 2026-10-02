"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  createId,
  type AgentRun,
  type Campaign,
  type MailThread,
  type OutreachContact,
  type OutreachList,
  type OutreachState,
  type SenderProfile,
} from "./model";

type Row = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function companyName(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "name" in row && typeof row.name === "string") return row.name;
  return "";
}

async function scope() {
  const supabase = createClient() as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in required.");
  const { data: profile, error } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  const orgId = profile && typeof profile.org_id === "string" ? profile.org_id : "";
  if (error || !orgId) throw new Error(error?.message || "No organization is attached to this account.");
  return { supabase, userId: user.id, orgId };
}

export function emptyOutreach(): OutreachState {
  return { contacts: [], lists: [], senders: [], campaigns: [], context: [], threads: [] };
}

export async function loadRemoteOutreach(): Promise<OutreachState> {
  const { supabase } = await scope();
  const [contactsRes, listsRes, membersRes, sendersRes, campaignsRes, contextRes, threadsRes, messagesRes, draftsRes] = await Promise.all([
    supabase.from("contacts").select("id, first_name, last_name, email, position, tags, notes, region, outreach_status, company:companies(name)").order("created_at", { ascending: false }).limit(500),
    supabase.from("outreach_lists").select("id, name, description, is_dynamic, query").order("created_at", { ascending: false }),
    supabase.from("outreach_list_members").select("list_id, contact_id"),
    supabase.from("outreach_senders").select("id, provider, from_name, from_email, connection_status, domain_verified").order("created_at", { ascending: false }),
    supabase.from("outreach_campaigns").select("id, name, subject, body, list_id, sender_id, asset_title, asset_url, status, send_at, throttle_per_hour, metrics").order("created_at", { ascending: false }),
    supabase.from("outreach_context").select("id, title, content").order("created_at", { ascending: false }),
    supabase.from("outreach_threads").select("id, provider, subject, participants, snippet, intent, sentiment, unread, needs_reply, last_message_at").order("last_message_at", { ascending: false }),
    supabase.from("outreach_messages").select("id, thread_id, direction, from_email, body, sent_at").order("sent_at", { ascending: true }),
    supabase.from("outreach_drafts").select("id, thread_id, status, draft_body, reasoning, created_at").order("created_at", { ascending: false }),
  ]);
  const failed = [contactsRes, listsRes, membersRes, sendersRes, campaignsRes, contextRes, threadsRes, messagesRes, draftsRes].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const members = new Map<string, string[]>();
  for (const row of (membersRes.data ?? []) as Row[]) {
    const listId = text(row.list_id);
    const contactId = text(row.contact_id);
    members.set(listId, [...(members.get(listId) ?? []), contactId]);
  }

  const messagesByThread = new Map<string, MailThread["messages"]>();
  for (const row of (messagesRes.data ?? []) as Row[]) {
    const threadId = text(row.thread_id);
    const message = {
      id: text(row.id),
      direction: row.direction === "outbound" ? "outbound" as const : "inbound" as const,
      fromEmail: text(row.from_email),
      body: text(row.body),
      sentAt: text(row.sent_at),
    };
    messagesByThread.set(threadId, [...(messagesByThread.get(threadId) ?? []), message]);
  }
  const draftsByThread = new Map<string, AgentRun[]>();
  for (const row of (draftsRes.data ?? []) as Row[]) {
    const threadId = text(row.thread_id);
    const run: AgentRun = {
      id: text(row.id),
      status: row.status === "sent" ? "sent" : "draft",
      draftBody: text(row.draft_body),
      reasoning: text(row.reasoning),
      createdAt: text(row.created_at),
    };
    draftsByThread.set(threadId, [...(draftsByThread.get(threadId) ?? []), run]);
  }

  return {
    contacts: ((contactsRes.data ?? []) as Row[]).map((row) => ({
      id: text(row.id),
      firstName: text(row.first_name),
      lastName: text(row.last_name),
      company: companyName(row.company),
      role: text(row.position),
      email: text(row.email),
      region: text(row.region),
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
      status: (text(row.outreach_status) || "active") as OutreachContact["status"],
      notes: text(row.notes),
    })),
    lists: ((listsRes.data ?? []) as Row[]).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      description: text(row.description),
      isDynamic: Boolean(row.is_dynamic),
      query: text(row.query),
      contactIds: members.get(text(row.id)) ?? [],
    })),
    senders: ((sendersRes.data ?? []) as Row[]).map((row) => ({
      id: text(row.id),
      provider: row.provider === "outlook" ? "outlook" : "gmail",
      fromName: text(row.from_name),
      fromEmail: text(row.from_email),
      connectionStatus: row.connection_status === "connected" ? "connected" : row.connection_status === "error" ? "disconnected" : "pending",
      domainVerified: Boolean(row.domain_verified),
    })),
    campaigns: ((campaignsRes.data ?? []) as Row[]).map((row) => {
      const metrics = row.metrics && typeof row.metrics === "object" ? row.metrics as Record<string, number> : {};
      return {
        id: text(row.id),
        name: text(row.name),
        subject: text(row.subject),
        body: text(row.body),
        listId: text(row.list_id) || null,
        senderId: text(row.sender_id) || null,
        assetTitle: text(row.asset_title),
        assetUrl: text(row.asset_url),
        status: (text(row.status) || "draft") as Campaign["status"],
        sendAt: text(row.send_at) || null,
        throttlePerHour: Number(row.throttle_per_hour) || 25,
        metrics: {
          sent: Number(metrics.sent) || 0,
          opened: Number(metrics.opened) || 0,
          clicked: Number(metrics.clicked) || 0,
          bounced: Number(metrics.bounced) || 0,
          replied: Number(metrics.replied) || 0,
        },
      };
    }),
    context: ((contextRes.data ?? []) as Row[]).map((row) => ({
      id: text(row.id),
      title: text(row.title),
      content: text(row.content),
    })),
    threads: ((threadsRes.data ?? []) as Row[]).map((row) => ({
      id: text(row.id),
      provider: row.provider === "outlook" ? "outlook" as const : "gmail" as const,
      subject: text(row.subject),
      participants: Array.isArray(row.participants) ? row.participants.filter((item): item is string => typeof item === "string") : [],
      snippet: text(row.snippet),
      intent: text(row.intent) || null,
      sentiment: text(row.sentiment) || null,
      unread: Boolean(row.unread),
      needsReply: Boolean(row.needs_reply),
      lastMessageAt: text(row.last_message_at),
      sample: false,
      messages: messagesByThread.get(text(row.id)) ?? [],
      runs: draftsByThread.get(text(row.id)) ?? [],
    })),
  };
}

async function ensureCompany(orgId: string, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { supabase } = await scope();
  const { data: existing } = await supabase.from("companies").select("id").eq("org_id", orgId).ilike("name", trimmed).limit(1).maybeSingle();
  if (existing?.id) return String(existing.id);
  const { data, error } = await supabase.from("companies").insert({
    org_id: orgId,
    name: trimmed,
    owner_id: userId,
    created_by: userId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

export async function addRemoteContact(input: Omit<OutreachContact, "id" | "status">) {
  const { supabase, userId, orgId } = await scope();
  const companyId = await ensureCompany(orgId, userId, input.company);
  const { error } = await supabase.from("contacts").insert({
    org_id: orgId,
    company_id: companyId,
    first_name: input.firstName || null,
    last_name: input.lastName || null,
    email: input.email,
    position: input.role || null,
    region: input.region || null,
    tags: input.tags,
    notes: input.notes || null,
    outreach_status: "active",
    owner_id: userId,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function importRemoteContacts(rows: Omit<OutreachContact, "id" | "status">[], listId: string, listName: string) {
  const { supabase, userId, orgId } = await scope();
  const ids: string[] = [];
  for (const row of rows) {
    const { data: existing } = await supabase.from("contacts").select("id").eq("org_id", orgId).eq("email", row.email).maybeSingle();
    if (existing?.id) {
      ids.push(String(existing.id));
      continue;
    }
    const companyId = await ensureCompany(orgId, userId, row.company);
    const { data, error } = await supabase.from("contacts").insert({
      org_id: orgId,
      company_id: companyId,
      first_name: row.firstName || null,
      last_name: row.lastName || null,
      email: row.email,
      position: row.role || null,
      region: row.region || null,
      tags: row.tags,
      notes: row.notes || null,
      outreach_status: "active",
      owner_id: userId,
      created_by: userId,
    }).select("id").single();
    if (error || !data?.id) throw new Error(error?.message || "Import failed.");
    ids.push(String(data.id));
  }
  let target = listId;
  if (!target) {
    const { data, error } = await supabase.from("outreach_lists").insert({
      org_id: orgId,
      name: listName,
      description: "Imported from CSV",
      is_dynamic: false,
      query: "",
      created_by: userId,
    }).select("id").single();
    if (error || !data?.id) throw new Error(error?.message || "Could not create the list.");
    target = String(data.id);
  }
  if (ids.length) {
    const { error } = await supabase.from("outreach_list_members").upsert(
      ids.map((contactId) => ({ list_id: target, contact_id: contactId })),
      { onConflict: "list_id,contact_id" },
    );
    if (error) throw new Error(error.message);
  }
}

export async function createRemoteList(list: Omit<OutreachList, "id">) {
  const { supabase, userId, orgId } = await scope();
  const { data, error } = await supabase.from("outreach_lists").insert({
    org_id: orgId,
    name: list.name,
    description: list.description || null,
    is_dynamic: list.isDynamic,
    query: list.query,
    created_by: userId,
  }).select("id").single();
  if (error || !data?.id) throw new Error(error?.message || "Could not create the list.");
  if (!list.isDynamic && list.contactIds.length) {
    const { error: memberError } = await supabase.from("outreach_list_members").insert(
      list.contactIds.map((contactId) => ({ list_id: data.id, contact_id: contactId })),
    );
    if (memberError) throw new Error(memberError.message);
  }
}

export async function markRemoteDoNotContact(contactId: string) {
  const { supabase } = await scope();
  const { error } = await supabase.from("contacts").update({ outreach_status: "do_not_contact" }).eq("id", contactId);
  if (error) throw new Error(error.message);
}

export async function saveRemoteContext(title: string, content: string) {
  const { supabase, userId, orgId } = await scope();
  const { error } = await supabase.from("outreach_context").insert({ org_id: orgId, title, content, created_by: userId });
  if (error) throw new Error(error.message);
}

export async function saveRemoteCampaign(campaign: Omit<Campaign, "id" | "metrics">) {
  const { supabase, userId, orgId } = await scope();
  const { error } = await supabase.from("outreach_campaigns").insert({
    org_id: orgId,
    sender_id: campaign.senderId,
    list_id: campaign.listId,
    name: campaign.name,
    subject: campaign.subject,
    body: campaign.body,
    asset_title: campaign.assetTitle || null,
    asset_url: campaign.assetUrl || null,
    status: campaign.status,
    send_at: campaign.sendAt,
    throttle_per_hour: campaign.throttlePerHour,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function saveRemoteDraft(threadId: string, draftBody: string, reasoning: string) {
  const { supabase, userId, orgId } = await scope();
  const { error } = await supabase.from("outreach_drafts").insert({
    org_id: orgId,
    thread_id: threadId,
    draft_body: draftBody,
    reasoning,
    status: "draft",
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  return createId("run");
}
