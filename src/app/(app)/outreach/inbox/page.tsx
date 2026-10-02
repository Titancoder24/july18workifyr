"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Inbox, RefreshCw, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { OutreachWorkflowNav } from "@/components/outreach/workflow-nav";
import { ProviderMark } from "@/components/outreach/provider-mark";
import { type MailThread } from "@/lib/outreach/model";
import { relativeTime } from "@/lib/format";
import { useOutreach } from "@/lib/outreach/use-outreach";

export default function OutreachInboxPage() {
  const { state, ready, error, reload, saveDraft } = useOutreach();
  const [selectedId, setSelectedId] = useState("");
  const [provider, setProvider] = useState<"all" | "gmail" | "outlook">("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [guidance, setGuidance] = useState("");
  const [notice, setNotice] = useState("");

  const threads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.threads.filter((thread) => {
      if (provider !== "all" && thread.provider !== provider) return false;
      if (!needle) return true;
      return [thread.subject, thread.snippet, ...thread.participants].join(" ").toLowerCase().includes(needle);
    });
  }, [provider, query, state.threads]);

  const selected = state.threads.find((thread) => thread.id === selectedId) ?? threads[0];

  useEffect(() => {
    if (!selectedId && threads[0]) setSelectedId(threads[0].id);
  }, [selectedId, threads]);

  useEffect(() => {
    const latest = [...(selected?.runs ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    setDraft(latest?.draftBody ?? "");
  }, [selected?.id, selected?.runs]);

  async function connectMailbox(mailProvider: "gmail" | "outlook") {
    setNotice(`Opening ${mailProvider === "gmail" ? "Gmail" : "Outlook"}…`);
    const response = await fetch("/api/outreach/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: mailProvider }),
    });
    const result = await response.json();
    if (!response.ok || !result.redirectUrl) {
      setNotice(result.error || "Could not start the mailbox connection.");
      return;
    }
    window.location.assign(result.redirectUrl);
  }

  async function syncMail() {
    setNotice("Syncing the connected mailbox…");
    const response = await fetch("/api/outreach/inbox?sync=true");
    const result = await response.json();
    if (!response.ok || result.error) {
      setNotice(result.error || "Could not sync mail.");
      return;
    }
    await reload();
    setNotice(result.threads ? `Synced ${result.threads} conversations.` : "Mailbox synced.");
  }

  async function createDraft() {
    if (!selected) return;
    const note = guidance.trim();
    const body = [
      `Hi ${selected.participants[0]?.split("@")[0] ?? "there"},`,
      "",
      `Thanks for the note on “${selected.subject}”.`,
      note || "Happy to share the details and find a time that works.",
      "",
      "Best,",
    ].join("\n");
    const failure = await saveDraft(
      selected.id,
      body,
      note ? `Draft follows your guidance: ${note}` : "Draft answers the latest inbound note. It is not sent until you approve it.",
    );
    setDraft(body);
    setNotice(failure ?? "Draft saved. Approve it to send through the connected mailbox.");
  }

  async function approveAndSend() {
    if (!selected || !draft.trim()) return;
    const response = await fetch("/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: selected.id, body: draft.trim(), draftId: latestRun?.id }),
    });
    const result = await response.json();
    if (response.ok) await reload();
    setNotice(result.message || result.error || "Reply failed.");
  }

  const gmailConnected = state.senders.some((sender) => sender.provider === "gmail" && sender.connectionStatus === "connected");
  const outlookConnected = state.senders.some((sender) => sender.provider === "outlook" && sender.connectionStatus === "connected");
  const latestRun = [...(selected?.runs ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-8">
      <PageHeader
        title="Outreach inbox"
        description={ready ? "Replies come from the connected Gmail or Outlook mailbox." : "Loading inbox…"}
        actions={
          <Button variant="outline" iconLeft={<RefreshCw className="size-3.5" />} onClick={syncMail}>
            Sync mail
          </Button>
        }
      />
      <OutreachWorkflowNav active="inbox" />
      {(notice || error) && (
        <div className="mb-4 rounded-lg px-3.5 py-2.5 text-[13px]" style={{ background: "var(--color-viridian-50)", border: "1px solid var(--color-border)" }}>
          {notice || error}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <MailboxRow provider="gmail" connected={gmailConnected} onConnect={() => connectMailbox("gmail")} />
        <MailboxRow provider="outlook" connected={outlookConnected} onConnect={() => connectMailbox("outlook")} />
      </div>

      <div className="card grid min-h-[640px] overflow-hidden xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <section style={{ borderRight: "1px solid var(--color-border)" }}>
          <div className="space-y-2 p-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" />
            <div className="flex gap-1">
              {(["all", "gmail", "outlook"] as const).map((value) => (
                <Button key={value} size="sm" variant={provider === value ? "primary" : "ghost"} onClick={() => setProvider(value)} className="capitalize">
                  {value}
                </Button>
              ))}
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} active={selected?.id === thread.id} onSelect={() => setSelectedId(thread.id)} />
            ))}
            {threads.length === 0 && (
              <div className="px-4 py-12 text-center text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                <Inbox className="mx-auto mb-2 size-5" />
                No conversations
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0" style={{ borderRight: "1px solid var(--color-border)" }}>
          {selected ? (
            <>
              <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold">{selected.subject}</h2>
                  {selected.sample && <Badge tone="outline">Sample</Badge>}
                  {selected.intent && <Badge tone="viridian">{selected.intent}</Badge>}
                  {selected.sentiment && <Badge tone="neutral">{selected.sentiment}</Badge>}
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {selected.participants.join(" · ")}
                </p>
              </div>
              <div className="max-h-[560px] space-y-3 overflow-y-auto p-5">
                {selected.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[82%] rounded-xl px-3 py-2.5"
                      style={{
                        background: message.direction === "outbound" ? "var(--color-viridian-50)" : "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-4 text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                        <span>{message.direction === "outbound" ? "You" : message.fromEmail}</span>
                        <span>{relativeTime(message.sentAt)}</span>
                      </div>
                      <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6">{message.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
              Select a conversation
            </div>
          )}
        </section>

        <aside className="flex min-h-[520px] flex-col">
          <div className="px-4 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2 text-[14px] font-semibold">
              <Bot className="size-4" style={{ color: "var(--color-viridian-700)" }} />
              Reply
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
              Drafts stay here until you approve them. Nothing is sent from a sample thread.
            </p>
          </div>
          <div className="flex-1 space-y-3 p-4">
            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>
                Guidance
              </label>
              <Input className="mt-1.5" value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="Mention pricing, offer Thursday…" />
            </div>
            <Button variant="outline" className="w-full" iconLeft={<Sparkles className="size-3.5" />} onClick={createDraft} disabled={!selected}>
              Analyze and draft
            </Button>
            {latestRun?.reasoning && (
              <div className="rounded-lg px-3 py-2.5 text-[12px] leading-5" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-secondary)" }}>
                {latestRun.reasoning}
              </div>
            )}
            <div>
              <label className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>
                Reviewed reply
              </label>
              <Textarea className="mt-1.5 min-h-52" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a response or generate a draft." />
            </div>
          </div>
          <div className="p-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <Button variant="primary" className="w-full" iconLeft={<Send className="size-3.5" />} onClick={approveAndSend} disabled={!draft.trim()}>
              Approve and send
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MailboxRow({
  provider,
  connected,
  onConnect,
}: {
  provider: "gmail" | "outlook";
  connected: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="card flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <ProviderMark provider={provider} />
        <div>
          <div className="text-[13px] font-semibold">{provider === "gmail" ? "Gmail" : "Outlook"}</div>
          <div className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
            {connected ? "Connected" : "Not connected"}
          </div>
        </div>
      </div>
      {connected ? (
        <CheckCircle2 className="size-4" style={{ color: "var(--color-viridian-700)" }} />
      ) : (
        <Button size="sm" variant="outline" onClick={onConnect}>
          Connect
        </Button>
      )}
    </div>
  );
}

function ThreadRow({ thread, active, onSelect }: { thread: MailThread; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full px-3 py-3 text-left"
      style={{
        background: active ? "var(--color-viridian-50)" : "transparent",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`truncate text-[13px] ${thread.unread ? "font-semibold" : "font-medium"}`}>{thread.subject}</span>
        <Badge tone="outline">{thread.provider}</Badge>
      </div>
      <p className="mt-1 truncate text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
        {thread.participants.join(", ")}
      </p>
      <p className="mt-1 line-clamp-2 text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
        {thread.snippet}
      </p>
      <div className="mt-2 flex items-center justify-between">
        {thread.needsReply ? <Badge tone="solid">Needs reply</Badge> : <span />}
        <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          {relativeTime(thread.lastMessageAt)}
        </span>
      </div>
    </button>
  );
}
