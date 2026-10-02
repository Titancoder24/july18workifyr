import { NextResponse } from "next/server";
import { createMailSession, mailTools, type MailProvider } from "@/lib/composio";
import { renderOutreachTemplate, type OutreachContact } from "@/lib/outreach/model";
import { requireOutreachSession } from "@/lib/outreach/session";

async function sendMail(userId: string, provider: MailProvider, to: string, subject: string, body: string) {
  const session = await createMailSession(userId, provider);
  const result = provider === "gmail"
    ? await session.execute(mailTools.gmail.send, {
        user_id: "me",
        recipient_email: to,
        subject,
        body,
        is_html: false,
        cc: [],
        bcc: [],
        extra_recipients: [],
      })
    : await session.execute(mailTools.outlook.send, {
        user_id: "me",
        to,
        to_name: to,
        subject,
        body,
        is_html: false,
        cc_emails: [],
        bcc_emails: [],
        save_to_sent_items: true,
      });
  if (result.error) throw new Error(String(result.error));
  return result;
}

export async function POST(request: Request) {
  const session = await requireOutreachSession();
  if ("error" in session) return session.error;
  const payload = await request.json();

  try {
    if (payload.threadId && payload.body) {
      const { data: thread } = await session.supabase
        .from("outreach_threads")
        .select("id, subject, participants, provider, sender_id")
        .eq("id", payload.threadId)
        .eq("org_id", session.orgId)
        .single();
      if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const provider = thread.provider as MailProvider;
      const recipient = (Array.isArray(thread.participants) ? thread.participants : []).find((email) => typeof email === "string" && email.includes("@"));
      if (!recipient || (provider !== "gmail" && provider !== "outlook")) {
        return NextResponse.json({ error: "This conversation has no mailbox to reply from." }, { status: 409 });
      }
      await sendMail(session.user.id, provider, recipient, thread.subject?.startsWith("Re:") ? String(thread.subject) : `Re: ${thread.subject}`, String(payload.body));
      const sentAt = new Date().toISOString();
      await session.supabase.from("outreach_messages").insert({
        org_id: session.orgId,
        thread_id: thread.id,
        external_message_id: `local-${sentAt}`,
        direction: "outbound",
        from_email: session.user.email,
        to_emails: [recipient],
        body: String(payload.body),
        sent_at: sentAt,
      });
      await session.supabase.from("outreach_threads").update({
        needs_reply: false,
        unread: false,
        snippet: String(payload.body).slice(0, 180),
        last_message_at: sentAt,
        updated_at: sentAt,
      }).eq("id", thread.id);
      if (payload.draftId) {
        await session.supabase.from("outreach_drafts").update({ status: "sent", draft_body: String(payload.body) }).eq("id", payload.draftId);
      }
      return NextResponse.json({ ok: true, message: "Reply sent." });
    }

    if (!payload.campaignId || !payload.testEmail) {
      return NextResponse.json({ error: "A campaign and test inbox are required." }, { status: 400 });
    }
    const { data: campaign } = await session.supabase
      .from("outreach_campaigns")
      .select("id, subject, body, sender_id")
      .eq("id", payload.campaignId)
      .eq("org_id", session.orgId)
      .single();
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    const { data: sender } = await session.supabase
      .from("outreach_senders")
      .select("provider, connection_status")
      .eq("id", campaign.sender_id)
      .eq("org_id", session.orgId)
      .single();
    if (!sender || sender.connection_status !== "connected") {
      return NextResponse.json({ error: "Connect Gmail or Outlook before sending a test." }, { status: 409 });
    }
    const provider = sender.provider as MailProvider;
    const preview = renderOutreachTemplate(String(campaign.body), {
      firstName: "there",
      company: "your company",
      role: "your team",
      email: String(payload.testEmail),
    } as OutreachContact);
    await sendMail(session.user.id, provider, String(payload.testEmail), `[Test] ${campaign.subject}`, preview);
    return NextResponse.json({ ok: true, message: `Test sent to ${payload.testEmail}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
