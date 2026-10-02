import { NextResponse } from "next/server";
import { createMailSession, getComposio, type MailProvider } from "@/lib/composio";
import { requireOutreachSession } from "@/lib/outreach/session";

const providers = new Set<MailProvider>(["gmail", "outlook"]);

function findString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const match = Object.entries(record).find(([candidate]) => candidate.toLowerCase() === key.toLowerCase())?.[1];
    if (typeof match === "string" && match.trim()) return match.trim();
  }
  for (const nested of Object.values(record)) {
    const match = findString(nested, keys);
    if (match) return match;
  }
  return null;
}

async function mailboxIdentity(userId: string, provider: MailProvider) {
  const session = await createMailSession(userId, provider);
  const result = await session.execute(
    provider === "gmail" ? "GMAIL_GET_PROFILE" : "OUTLOOK_GET_PROFILE",
    { user_id: "me", ...(provider === "outlook" ? { include_proxy_addresses: false } : {}) },
  );
  if (result.error) throw new Error(String(result.error));
  const email = findString(result.data, provider === "gmail" ? ["emailAddress"] : ["mail", "userPrincipalName"])?.toLowerCase();
  const name = findString(result.data, ["displayName", "name"]);
  return { email: email && email.includes("@") ? email : null, name };
}

export async function POST(request: Request) {
  const session = await requireOutreachSession();
  if ("error" in session) return session.error;
  try {
    const { provider } = await request.json();
    if (!providers.has(provider)) {
      return NextResponse.json({ error: "Choose Gmail or Outlook." }, { status: 400 });
    }
    const placeholder = `${provider}.${session.user.id.slice(0, 8)}@pending.workifyr.local`;
    const { data: sender, error } = await session.supabase
      .from("outreach_senders")
      .insert({
        org_id: session.orgId,
        user_id: session.user.id,
        provider,
        from_name: provider === "gmail" ? "Gmail account" : "Outlook account",
        from_email: placeholder,
        connection_status: "pending",
        domain_verified: false,
      })
      .select("id")
      .single();
    if (error || !sender?.id) {
      return NextResponse.json({ error: error?.message || "Could not start the mailbox connection." }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const callbackUrl = new URL("/outreach/connect/callback", origin);
    callbackUrl.searchParams.set("senderId", String(sender.id));
    callbackUrl.searchParams.set("provider", provider);

    const mailSession = await createMailSession(session.user.id, provider);
    const connection = await mailSession.authorize(provider, {
      callbackUrl: callbackUrl.toString(),
      alias: `${provider}-${String(sender.id).slice(0, 8)}`,
    });

    await session.supabase
      .from("outreach_senders")
      .update({
        connection_status: "pending",
        composio_session_id: mailSession.sessionId,
        composio_connection_id: connection.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sender.id);

    return NextResponse.json({
      redirectUrl: connection.redirectUrl,
      senderId: sender.id,
      status: connection.status || "INITIATED",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect the mailbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await requireOutreachSession();
  if ("error" in session) return session.error;
  const url = new URL(request.url);
  const senderId = url.searchParams.get("senderId");
  const provider = url.searchParams.get("provider") as MailProvider | null;
  if (!senderId || !provider || !providers.has(provider)) {
    return NextResponse.json({ error: "Invalid mailbox status request." }, { status: 400 });
  }

  try {
    const accounts = await getComposio().connectedAccounts.list({
      userIds: [session.user.id],
      toolkitSlugs: [provider],
      statuses: ["ACTIVE"],
    });
    const account = accounts.items[0];
    const connected = Boolean(account);
    let identity: { email: string | null; name: string | null } | null = null;
    if (connected) {
      try {
        identity = await mailboxIdentity(session.user.id, provider);
      } catch (error) {
        console.error("Could not read mailbox identity", error);
      }
    }

    const update: Record<string, unknown> = {
      connection_status: connected ? "connected" : "error",
      composio_connection_id: account?.id || null,
      domain_verified: connected,
      updated_at: new Date().toISOString(),
    };
    if (identity?.email) update.from_email = identity.email;
    if (identity?.name) update.from_name = identity.name;

    await session.supabase.from("outreach_senders").update(update).eq("id", senderId).eq("org_id", session.orgId);
    return NextResponse.json({
      connected,
      status: account?.status || "INITIATED",
      mailbox: identity?.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify the mailbox.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
