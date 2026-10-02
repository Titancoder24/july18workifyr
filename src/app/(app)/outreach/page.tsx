"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ContactRound, Gauge, Link as LinkIcon, Megaphone, Play, PlugZap } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { OutreachWorkflowNav } from "@/components/outreach/workflow-nav";
import { ProviderMark } from "@/components/outreach/provider-mark";
import { renderOutreachTemplate } from "@/lib/outreach/model";
import { useOutreach } from "@/lib/outreach/use-outreach";

const starterBody = `Hi {{contact.first_name || 'there'}},

I wanted to reach out because this may be relevant for {{contact.role || 'your team'}} at {{contact.company || 'your company'}}.

[Add the specific reason this note is worth a reply.]

Best,`;

export default function OutreachPage() {
  const { state, ready, error, saveContext: persistContext, saveCampaign: persistCampaign } = useOutreach();
  const [name, setName] = useState("Intro sequence");
  const [subject, setSubject] = useState("A simpler way to keep follow-ups moving");
  const [body, setBody] = useState(starterBody);
  const [brief, setBrief] = useState("");
  const [contextTitle, setContextTitle] = useState("");
  const [contextBody, setContextBody] = useState("");
  const [assetTitle, setAssetTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [listId, setListId] = useState("");
  const [senderId, setSenderId] = useState("");
  useEffect(() => {
    if (!listId && state.lists[0]) setListId(state.lists[0].id);
    if (!senderId) {
      const connected = state.senders.find((sender) => sender.connectionStatus === "connected");
      if (connected) setSenderId(connected.id);
    }
  }, [listId, senderId, state.lists, state.senders]);
  const [sendAt, setSendAt] = useState("");
  const [throttle, setThrottle] = useState(25);
  const [testEmail, setTestEmail] = useState("");
  const [notice, setNotice] = useState("");

  const activeContacts = useMemo(
    () => state.contacts.filter((contact) => contact.status === "active"),
    [state.contacts],
  );
  const previewContact = activeContacts[0] ?? state.contacts[0];
  const selectedSender = state.senders.find((sender) => sender.id === senderId);
  const launchReady = Boolean(
    selectedSender?.connectionStatus === "connected" && selectedSender.domainVerified && listId,
  );

  async function connectMailbox(provider: "gmail" | "outlook") {
    setNotice(`Opening ${provider === "gmail" ? "Gmail" : "Outlook"}…`);
    const response = await fetch("/api/outreach/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const result = await response.json();
    if (!response.ok || !result.redirectUrl) {
      setNotice(result.error || "Could not start the mailbox connection.");
      return;
    }
    window.location.assign(result.redirectUrl);
  }

  async function saveContext() {
    if (!contextTitle.trim() || !contextBody.trim()) return;
    const failure = await persistContext(contextTitle.trim(), contextBody.trim());
    if (!failure) {
      setContextTitle("");
      setContextBody("");
    }
    setNotice(failure ?? "Approved context saved for this organization.");
  }

  function draftFromBrief() {
    const focus = brief.trim() || "a short introduction";
    setSubject(subject || `Note for {{contact.first_name || 'there'}}`);
    setBody(
      `Hi {{contact.first_name || 'there'}},\n\n${focus}\n\nI thought this would be useful for {{contact.role || 'your team'}} at {{contact.company || 'your company'}}.\n\nBest,`,
    );
    setNotice("Starter draft filled from your brief and contact fields. Model-backed generation plugs in with Composio.");
  }

  async function saveCampaign(intent: "draft" | "scheduled") {
    const scheduled = intent === "scheduled" && launchReady;
    const failure = await persistCampaign({
      name: name.trim() || "Untitled outreach",
      subject: subject.trim(),
      body,
      listId: listId || null,
      senderId: senderId || null,
      assetTitle,
      assetUrl,
      status: scheduled ? "scheduled" : "draft",
      sendAt: sendAt || null,
      throttlePerHour: throttle,
    });
    setNotice(failure ?? (scheduled ? "Campaign scheduled." : "Saved as a draft. Scheduling stays off until a mailbox is connected."));
  }

  async function sendTest() {
    const campaign = state.campaigns[0];
    if (!testEmail.trim() || !campaign) {
      setNotice("Save a campaign and add a test inbox first.");
      return;
    }
    const response = await fetch("/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id, testEmail: testEmail.trim() }),
    });
    const result = await response.json();
    setNotice(result.message || result.error || "Test send failed.");
  }

  function runDue() {
    const due = state.campaigns.filter((campaign) => campaign.status === "scheduled" && campaign.sendAt && new Date(campaign.sendAt).getTime() <= Date.now());
    setNotice(due.length ? `${due.length} campaign${due.length === 1 ? " is" : "s are"} due. Use Test to send through the connected mailbox.` : "No scheduled campaigns are due.");
  }

  return (
    <PageContainer>
      <PageHeader
        title="Outreach"
        description={ready ? "Write from CRM contacts and send through a connected Gmail or Outlook mailbox." : "Loading campaigns…"}
      />
      <OutreachWorkflowNav active="outreach" />
      {(notice || error) && <Notice>{notice || error}</Notice>}

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={ContactRound} value={activeContacts.length} label="Reachable contacts" />
        <Stat icon={Megaphone} value={state.campaigns.length} label="Campaigns" />
        <Stat icon={PlugZap} value={state.senders.filter((sender) => sender.connectionStatus === "connected").length} label="Connected mailboxes" />
        <Stat icon={Gauge} value={`${throttle}/hr`} label="Throttle limit" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="card p-4">
          <h2 className="text-[14px] font-semibold">Mailboxes</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-ink-secondary)" }}>
            Gmail and Outlook connect through Composio for this signed-in user.
          </p>
          <div className="mt-3 space-y-2">
            <MailboxButton provider="gmail" onClick={() => connectMailbox("gmail")} />
            <MailboxButton provider="outlook" onClick={() => connectMailbox("outlook")} />
          </div>
          <div className="mt-3 space-y-2">
            {state.senders.map((sender) => (
              <button
                key={sender.id}
                type="button"
                onClick={() => setSenderId(sender.id)}
                className="w-full rounded-lg px-3 py-2.5 text-left"
                style={{
                  border: `1px solid ${senderId === sender.id ? "var(--color-viridian-500)" : "var(--color-border)"}`,
                  background: senderId === sender.id ? "var(--color-viridian-50)" : "var(--color-surface)",
                }}
              >
                <div className="text-[13px] font-medium">
                  {sender.fromName} &lt;{sender.fromEmail}&gt;
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Badge tone="neutral">{sender.provider}</Badge>
                  <Badge tone={sender.domainVerified ? "viridian" : "outline"}>{sender.connectionStatus}</Badge>
                </div>
              </button>
            ))}
            {state.senders.length === 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--color-ink-tertiary)" }}>
                No mailbox connected yet.
              </p>
            )}
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-[14px] font-semibold">Pitch studio</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-ink-secondary)" }}>
            {state.context.length
              ? `${state.context.length} approved source${state.context.length === 1 ? "" : "s"} on file. `
              : ""}
            Drafts stay in this workspace until you approve a send.
          </p>
          <div className="mt-3 grid gap-2">
            <Input value={contextTitle} onChange={(event) => setContextTitle(event.target.value)} placeholder="Approved source title" />
            <Textarea
              value={contextBody}
              onChange={(event) => setContextBody(event.target.value)}
              placeholder="Paste verified facts, offer details, and claims this pitch is allowed to use."
            />
            <div>
              <Button variant="outline" onClick={saveContext} disabled={!contextTitle.trim() || !contextBody.trim()}>
                Add context
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="What should this note accomplish?" />
            <Button variant="outline" onClick={draftFromBrief}>
              Generate draft
            </Button>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Campaign name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Subject">
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </Field>
            </div>
            <Field label="Message" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>{"{{contact.first_name}}"}</span>}>
              <Textarea className="min-h-44" value={body} onChange={(event) => setBody(event.target.value)} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={assetTitle} onChange={(event) => setAssetTitle(event.target.value)} placeholder="Link title" />
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2" style={{ color: "var(--color-ink-tertiary)" }} />
                <Input className="pl-8" value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} placeholder="https://" />
              </div>
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-tertiary)" }}>
                Preview {previewContact ? `· ${previewContact.firstName || previewContact.email}` : ""}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-[13px] leading-6">{renderOutreachTemplate(body, previewContact)}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="text-[14px] font-semibold">Review and schedule</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <Field label="Audience list">
            <Select value={listId} onChange={(event) => setListId(event.target.value)}>
              <option value="">Select a list</option>
              {state.lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Send at">
            <Input type="datetime-local" value={sendAt} onChange={(event) => setSendAt(event.target.value)} />
          </Field>
          <Field label="Throttle per hour">
            <Input type="number" min={1} max={75} value={throttle} onChange={(event) => setThrottle(Number(event.target.value) || 1)} />
          </Field>
          <Field label="Test inbox">
            <Input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="you@company.com" />
          </Field>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={sendTest}>
              Test
            </Button>
            <Button variant="primary" onClick={() => saveCampaign("scheduled")} disabled={!launchReady}>
              Schedule
            </Button>
          </div>
        </div>
        {!launchReady && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-ink-secondary)" }}>
            Launches stay disabled until a connected mailbox is verified and a list is selected.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => saveCampaign("draft")}>
            Save draft
          </Button>
          <Button variant="outline" iconLeft={<Play className="size-3.5" />} onClick={runDue}>
            Run due now
          </Button>
        </div>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <BarChart3 className="size-4" style={{ color: "var(--color-ink-tertiary)" }} />
          <h2 className="text-[14px] font-semibold">Campaigns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Campaign", "Status", "Sent", "Open", "CTR", "Bounce", "Replies"].map((label) => (
                  <th key={label} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.campaigns.map((campaign) => {
                const sent = campaign.metrics.sent || 0;
                const pct = (count: number) => (sent ? `${Math.round((count / sent) * 100)}%` : "0%");
                return (
                  <tr key={campaign.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>{campaign.subject}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={campaign.status === "draft" ? "outline" : "viridian"}>{campaign.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{sent}</td>
                    <td className="px-4 py-3">{pct(campaign.metrics.opened)}</td>
                    <td className="px-4 py-3">{pct(campaign.metrics.clicked)}</td>
                    <td className="px-4 py-3">{campaign.metrics.bounced}</td>
                    <td className="px-4 py-3">{campaign.metrics.replied}</td>
                  </tr>
                );
              })}
              {state.campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center" style={{ color: "var(--color-ink-secondary)" }}>
                    No campaigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  );
}

function MailboxButton({ provider, onClick }: { provider: "gmail" | "outlook"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-surface-2)" }}
    >
      <span className="flex items-center gap-3">
        <ProviderMark provider={provider} />
        <span>
          <span className="block text-[13px] font-semibold">{provider === "gmail" ? "Gmail" : "Outlook"}</span>
          <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
            Secure OAuth
          </span>
        </span>
      </span>
      <span className="text-[12px] font-semibold" style={{ color: "var(--color-viridian-700)" }}>
        Connect
      </span>
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg px-3.5 py-2.5 text-[13px]" style={{ background: "var(--color-viridian-50)", border: "1px solid var(--color-border)" }}>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
}) {
  return (
    <div className="card px-4 py-4">
      <div className="flex size-9 items-center justify-center rounded-lg" style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-[22px] font-semibold tracking-tight">{value}</div>
      <p className="text-[12.5px]" style={{ color: "var(--color-ink-secondary)" }}>{label}</p>
    </div>
  );
}
