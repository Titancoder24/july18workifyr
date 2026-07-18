"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Module = "crm" | "hrm";
type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; tool_events?: ToolEvent[] };
type ToolEvent = { id: string; name: string; args?: string; result?: unknown };

const SUGGESTIONS: Record<Module, string[]> = {
  crm: [
    "Summarize my pipeline",
    "Open tasks for me today",
    "Contacts I haven't touched in 30 days",
    "Draft a follow-up to my last contact",
  ],
  hrm: [
    "Pending leave requests",
    "My leave balance",
    "Attendance for this month",
    "Explain my last salary slip",
  ],
};

export function AIChatPanel({
  open,
  onOpenChange,
  initialModule = "crm",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialModule?: Module;
}) {
  const [module, setModule] = useState<Module>(initialModule);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Switching modules resets the conversation thread but keeps the panel open.
  function switchModule(m: Module) {
    setModule(m);
    setMessages([]);
    setConversationId(null);
  }

  function newConversation() {
    setMessages([]);
    setConversationId(null);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text };
    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", text: "", tool_events: [] };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`/api/ai/${module}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.role === "user" ? m.text : m.text })),
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setMessages((m) =>
          m.map((x) => (x.id === assistantMsg.id ? { ...x, text: `_${err.error ?? "Request failed"}_` } : x)),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Parse SSE events as they arrive.
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = block.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          try {
            const payload = JSON.parse(data);
            if (event === "conversation" && payload.id) {
              setConversationId(payload.id);
              continue;
            }
            setMessages((m) =>
              m.map((x) => {
                if (x.id !== assistantMsg.id || x.role !== "assistant") return x;
                if (event === "token" && payload.text) {
                  return { ...x, text: x.text + payload.text };
                }
                if (event === "tool_call") {
                  const events = [...(x.tool_events ?? []), { id: payload.id, name: payload.name, args: payload.args }];
                  return { ...x, tool_events: events };
                }
                if (event === "tool_result") {
                  const events = (x.tool_events ?? []).map((e) =>
                    e.id === payload.id ? { ...e, result: payload.result } : e,
                  );
                  return { ...x, tool_events: events };
                }
                if (event === "done" && payload.text) {
                  return { ...x, text: payload.text };
                }
                if (event === "error") {
                  return { ...x, text: x.text + `\n\n_Error: ${payload.message}_` };
                }
                return x;
              }),
            );
          } catch {/* ignore parse errors */}
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-40 w-full md:w-[420px] flex flex-col transition-transform",
        open ? "translate-x-0" : "translate-x-full",
      )}
      style={{
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      {/* Header */}
      <div
        className="h-14 px-4 flex items-center justify-between border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
      >
        <div className="flex items-center gap-2">
          <span className="icon-tile size-7">
            <Sparkles className="size-3.5" />
          </span>
          <select
            value={module}
            onChange={(e) => switchModule(e.target.value as Module)}
            className="bg-transparent text-[13px] font-medium outline-none cursor-pointer"
            style={{ color: "var(--color-ink)" }}
          >
            <option value="crm">CRM Assistant</option>
            <option value="hrm">HR Assistant</option>
          </select>
          <ChevronDown className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={newConversation}
            disabled={messages.length === 0 || streaming}
            className="text-[12px] px-2 h-8 rounded-lg disabled:opacity-40"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            New
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="size-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
              Ask anything about your {module === "crm" ? "contacts, deals, and pipeline" : "team, attendance, leave, and payroll"}. I read live data and never invent records.
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[module].map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[12px] px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: "var(--color-viridian-100)",
                    color: "var(--color-viridian-700)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div
                className="max-w-[85%] rounded-xl px-3 py-2 text-[13px] whitespace-pre-wrap"
                style={{ background: "var(--color-viridian-100)", color: "var(--color-ink)" }}
              >
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div
                className="max-w-[90%] rounded-xl px-3 py-2 text-[13px] whitespace-pre-wrap"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                  borderLeft: "2px solid var(--color-viridian-500)",
                }}
              >
                {(m.tool_events ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    className="mb-2 inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md"
                    style={{
                      background: "var(--color-viridian-50)",
                      color: "var(--color-viridian-700)",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    }}
                  >
                    <Sparkles className="size-3" />
                    {ev.result ? `${ev.name}` : `${ev.name}…`}
                  </div>
                ))}
                {m.text || <PulseDots />}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t" style={{ borderColor: "var(--color-border)" }}>
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={`Message the ${module === "crm" ? "CRM" : "HR"} assistant…`}
            className="flex-1 bg-transparent resize-none outline-none text-[13px] leading-relaxed max-h-32"
            style={{ color: "var(--color-ink)" }}
            disabled={streaming}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            className="size-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-opacity disabled:opacity-40"
            style={{ background: "var(--color-viridian-500)", color: "white" }}
            aria-label="Send"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PulseDots() {
  return (
    <span className="inline-flex gap-1 items-center" aria-hidden>
      <span className="size-1.5 rounded-full animate-pulse" style={{ background: "var(--color-viridian-500)" }} />
      <span className="size-1.5 rounded-full animate-pulse [animation-delay:120ms]" style={{ background: "var(--color-viridian-500)" }} />
      <span className="size-1.5 rounded-full animate-pulse [animation-delay:240ms]" style={{ background: "var(--color-viridian-500)" }} />
    </span>
  );
}
