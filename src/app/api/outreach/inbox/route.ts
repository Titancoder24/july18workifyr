import { NextResponse } from "next/server";
import { createMailSession, mailTools, type MailProvider } from "@/lib/composio";
import { normalizeMailResult } from "@/lib/outreach/mail-normalizer";
import { requireOutreachSession } from "@/lib/outreach/session";

async function fetchProviderMail(userId: string, provider: MailProvider) {
  const session = await createMailSession(userId, provider);
  if (provider === "gmail") {
    return [
      await session.execute(mailTools.gmail.fetch, {
        user_id: "me",
        query: "newer_than:30d -in:spam -in:trash",
        max_results: 40,
        verbose: true,
        include_payload: true,
        include_spam_trash: false,
      }),
    ];
  }
  const select = ["id", "conversationId", "subject", "from", "toRecipients", "body", "bodyPreview", "receivedDateTime", "sentDateTime", "isRead"];
  return Promise.all([
    session.execute(mailTools.outlook.fetch, { user_id: "me", folder: "inbox", top: 30, select, orderby: "receivedDateTime desc" }),
    session.execute(mailTools.outlook.fetch, { user_id: "me", folder: "sentitems", top: 15, select, orderby: "sentDateTime desc" }),
  ]);
}

export async function GET(request: Request) {
  const session = await requireOutreachSession();
  if ("error" in session) return session.error;
  const sync = new URL(request.url).searchParams.get("sync") === "true";
  if (!sync) return NextResponse.json({ ok: true });

  const { data: senders, error } = await session.supabase
    .from("outreach_senders")
    .select("id, provider, from_email, connection_status")
    .eq("org_id", session.orgId)
    .eq("connection_status", "connected");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let threads = 0;
  const failures: string[] = [];
  for (const sender of senders ?? []) {
    const provider = sender.provider as MailProvider;
    if (provider !== "gmail" && provider !== "outlook") continue;
    try {
      const results = await fetchProviderMail(session.user.id, provider);
      const messages = results.flatMap((result) => normalizeMailResult(provider, result, String(sender.from_email ?? "")));
      const grouped = new Map<string, typeof messages>();
      for (const message of messages) grouped.set(message.threadId, [...(grouped.get(message.threadId) || []), message]);

      for (const [externalThreadId, threadMessages] of grouped) {
        const sorted = [...threadMessages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
        const latest = sorted.at(-1);
        if (!latest) continue;
        const participants = Array.from(new Set(sorted.flatMap((message) => [message.from, ...message.to]).filter(Boolean)));
        const { data: thread, error: threadError } = await session.supabase
          .from("outreach_threads")
          .upsert(
            {
              org_id: session.orgId,
              sender_id: sender.id,
              provider,
              external_thread_id: externalThreadId,
              subject: latest.subject,
              participants,
              snippet: latest.snippet || latest.body.slice(0, 280),
              unread: sorted.some((message) => message.unread),
              needs_reply: latest.direction === "inbound",
              last_message_at: latest.sentAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "sender_id,external_thread_id" },
          )
          .select("id")
          .single();
        if (threadError || !thread?.id) continue;
        threads += 1;
        for (const message of sorted) {
          await session.supabase.from("outreach_messages").upsert(
            {
              org_id: session.orgId,
              thread_id: thread.id,
              external_message_id: message.messageId,
              direction: message.direction,
              from_email: message.from,
              to_emails: message.to,
              body: message.body || message.snippet,
              sent_at: message.sentAt,
            },
            { onConflict: "thread_id,external_message_id" },
          );
        }
      }
      await session.supabase.from("outreach_senders").update({ last_synced_at: new Date().toISOString() }).eq("id", sender.id);
    } catch (syncError) {
      failures.push(syncError instanceof Error ? syncError.message : "Mailbox sync failed");
    }
  }

  if (!senders?.length) {
    return NextResponse.json({ error: "Connect Gmail or Outlook before syncing mail." }, { status: 409 });
  }
  return NextResponse.json({ ok: failures.length === 0, threads, error: failures[0] });
}
