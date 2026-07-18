"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Plus, Send, ArrowUp, Pin, Trash2, Search, MessageSquare, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Module = "crm" | "hrm";

interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  last_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: { text: string };
  created_at: string;
}

const CRM_SUGGESTIONS = [
  "Summarize my pipeline",
  "How are my leads doing?",
  "Show revenue breakdown",
  "What deals need attention?",
];

const HRM_SUGGESTIONS = [
  "Show attendance overview",
  "Any pending leave requests?",
  "Payroll summary",
  "Team performance insights",
];

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => {
    return `<pre style="background:var(--color-surface-muted);padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,monospace;margin:8px 0"><code>${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--color-surface-muted);padding:1px 5px;border-radius:4px;font-size:12px;font-family:ui-monospace,SFMono-Regular,monospace">$1</code>');

  const lines = html.split("\n");
  const processed: string[] = [];
  let inTable = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith("<pre")) {
      const preEnd = html.indexOf("</pre>", html.indexOf(line));
      if (preEnd !== -1) {
        processed.push(line);
        continue;
      }
    }

    if (line.match(/^\|(.+)\|$/)) {
      if (line.match(/^\|[\s\-:|]+\|$/)) continue;
      const cells = line.split("|").filter((c) => c.trim() !== "");
      if (!inTable) {
        processed.push('<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">');
        inTable = true;
        processed.push("<thead><tr>" + cells.map((c) => `<th style="border:1px solid var(--color-border);padding:6px 10px;text-align:left;font-weight:600">${c.trim()}</th>`).join("") + "</tr></thead><tbody>");
        continue;
      }
      processed.push("<tr>" + cells.map((c) => `<td style="border:1px solid var(--color-border);padding:6px 10px">${c.trim()}</td>`).join("") + "</tr>");
      continue;
    } else if (inTable) {
      processed.push("</tbody></table>");
      inTable = false;
    }

    if (line.match(/^#{1,4}\s/)) {
      if (inList) { processed.push("</ul>"); inList = false; }
      const level = line.match(/^(#+)/)?.[1].length ?? 3;
      const content = line.replace(/^#+\s/, "");
      const tag = level <= 2 ? "h3" : "h4";
      const size = level <= 2 ? "15px" : "14px";
      processed.push(`<${tag} style="font-weight:600;font-size:${size};margin:12px 0 4px">${content}</${tag}>`);
      continue;
    }

    if (line.match(/^\s*[-*]\s/)) {
      const content = line.replace(/^\s*[-*]\s/, "");
      if (!inList) { processed.push('<ul style="margin:4px 0;padding-left:20px">'); inList = true; }
      processed.push(`<li style="margin:2px 0">${content}</li>`);
      continue;
    } else if (inList) {
      processed.push("</ul>");
      inList = false;
    }

    if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      processed.push(`<div style="margin:2px 0;padding-left:20px">${content}</div>`);
      continue;
    }

    if (line.trim() === "") {
      processed.push("<br>");
      continue;
    }

    processed.push(line);
  }

  if (inList) processed.push("</ul>");
  if (inTable) processed.push("</tbody></table>");

  html = processed.join("\n");

  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  return html;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AIChat({ module, userName }: { module: Module; userName: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useRef(createClient());

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    loadConversations();
  }, [module]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  async function loadConversations() {
    const { data, error } = await supabase.current
      .from("ai_conversations")
      .select("id, title, pinned, last_message_at, created_at")
      .eq("module", module)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load conversations");
      return;
    }
    setConversations(data ?? []);
  }

  async function loadMessages(conversationId: string) {
    const { data, error } = await supabase.current
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load messages");
      return;
    }
    setMessages((data ?? []) as Message[]);
    setActiveId(conversationId);
    setStreamingText("");
  }

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    const trimmed = text.trim();
    setInput("");
    setStreaming(true);
    setStreamingText("");

    const tempUserMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: { text: trimmed },
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeId,
          message: trimmed,
          module,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to send message");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let newConversationId = activeId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);

            if (parsed.type === "conversation_id") {
              newConversationId = parsed.value;
              setActiveId(parsed.value);
              const existingConv = conversations.find((c) => c.id === parsed.value);
              if (!existingConv) {
                const newConv: Conversation = {
                  id: parsed.value,
                  title: trimmed.slice(0, 60),
                  pinned: false,
                  last_message_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                };
                setConversations((prev) => [newConv, ...prev]);
              }
            }

            if (parsed.type === "chunk") {
              assistantText += parsed.value;
              setStreamingText(assistantText);
            }

            if (parsed.type === "done") {
              const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: { text: assistantText },
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setStreamingText("");

              if (newConversationId) {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === newConversationId
                      ? { ...c, last_message_at: new Date().toISOString() }
                      : c
                  )
                );
              }
            }

            if (parsed.type === "error") {
              toast.error(parsed.value ?? "An error occurred");
            }
          } catch {
            /* skip malformed lines */
          }
        }
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setStreaming(false);
    }
  }

  async function deleteConversation(id: string) {
    const { error } = await supabase.current
      .from("ai_conversations")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete conversation");
      return;
    }

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    toast.success("Conversation deleted");
  }

  async function renameConversation(id: string, title: string) {
    const { error } = await supabase.current
      .from("ai_conversations")
      .update({ title })
      .eq("id", id);

    if (error) {
      toast.error("Failed to rename conversation");
      return;
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    setRenamingId(null);
  }

  async function togglePin(id: string, pinned: boolean) {
    const { error } = await supabase.current
      .from("ai_conversations")
      .update({ pinned: !pinned })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update pin");
      return;
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !pinned } : c))
    );
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setStreamingText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const maxHeight = 5 * 24;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }

  const suggestions = module === "crm" ? CRM_SUGGESTIONS : HRM_SUGGESTIONS;
  const placeholder = module === "crm" ? "Ask about your sales data..." : "Ask about your workforce...";

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--color-canvas)" }}>
      <div
        className={`${sidebarOpen ? "w-[280px]" : "w-0"} shrink-0 flex flex-col overflow-hidden transition-all duration-200`}
        style={{
          background: "var(--color-surface)",
          borderRight: sidebarOpen ? "1px solid var(--color-border)" : "none",
        }}
      >
        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="size-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--color-viridian-100)" }}
            >
              <Sparkles className="size-3.5" style={{ color: "var(--color-viridian-700)" }} />
            </div>
            <span className="text-[14px] font-semibold" style={{ color: "var(--color-ink)" }}>
              AI Assistant
            </span>
          </div>
          <button
            onClick={startNewChat}
            className="size-7 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ background: "var(--color-viridian-500)", color: "white" }}
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <div
            className="flex items-center gap-2 rounded-lg px-2.5 h-8"
            style={{
              background: "var(--color-surface-muted)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Search className="size-3.5 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent outline-none text-[12px]"
              style={{ color: "var(--color-ink)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {pinned.length > 0 && (
            <div className="mb-1">
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>
                Pinned
              </div>
              {pinned.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  active={activeId === conv.id}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onSelect={() => loadMessages(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                  onTogglePin={() => togglePin(conv.id, conv.pinned)}
                  onStartRename={() => { setRenamingId(conv.id); setRenameValue(conv.title); }}
                  onRenameChange={setRenameValue}
                  onRenameSubmit={() => renameConversation(conv.id, renameValue)}
                  onRenameCancel={() => setRenamingId(null)}
                />
              ))}
            </div>
          )}

          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>
                  Recent
                </div>
              )}
              {unpinned.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  active={activeId === conv.id}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  onSelect={() => loadMessages(conv.id)}
                  onDelete={() => deleteConversation(conv.id)}
                  onTogglePin={() => togglePin(conv.id, conv.pinned)}
                  onStartRename={() => { setRenamingId(conv.id); setRenameValue(conv.title); }}
                  onRenameChange={setRenameValue}
                  onRenameSubmit={() => renameConversation(conv.id, renameValue)}
                  onRenameCancel={() => setRenamingId(null)}
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center">
              <MessageSquare className="size-8 mx-auto mb-2" style={{ color: "var(--color-ink-tertiary)", opacity: 0.4 }} />
              <p className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                {searchQuery ? "No matching conversations" : "No conversations yet"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="h-12 px-4 flex items-center justify-between shrink-0 md:hidden"
          style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="size-8 rounded-lg flex items-center justify-center"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            <MessageSquare className="size-4" />
          </button>
          <span className="text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
            {module === "crm" ? "CRM" : "HR"} Assistant
          </span>
          <div className="size-8" />
        </div>

        {!activeId && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div
                className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: "var(--color-viridian-100)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <Sparkles className="size-7" style={{ color: "var(--color-viridian-500)" }} />
              </div>
              <h2 className="text-[20px] font-semibold mb-2" style={{ color: "var(--color-ink)" }}>
                How can I help?
              </h2>
              <p className="text-[13px] mb-6" style={{ color: "var(--color-ink-secondary)" }}>
                Ask anything about your {module === "crm" ? "sales pipeline, contacts, and deals" : "workforce, attendance, and payroll"}.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[12px] px-3 py-1.5 rounded-full transition-all hover:scale-105"
                    style={{
                      background: "var(--color-viridian-100)",
                      color: "var(--color-viridian-700)",
                      border: "1px solid transparent",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => {
                const text = (msg.content as { text: string }).text;
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                  >
                    <div className="relative max-w-[80%]">
                      {isUser ? (
                        <div
                          className="rounded-2xl rounded-br-md px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                          style={{
                            background: "var(--color-viridian-500)",
                            color: "white",
                          }}
                        >
                          {text}
                        </div>
                      ) : (
                        <div
                          className="rounded-2xl rounded-bl-md px-4 py-2.5 text-[13px] leading-relaxed"
                          style={{
                            background: "var(--color-surface)",
                            color: "var(--color-ink)",
                            border: "1px solid var(--color-border)",
                          }}
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
                        />
                      )}
                      {hoveredMsgId === msg.id && (
                        <div
                          className={`absolute -bottom-5 text-[11px] ${isUser ? "right-1" : "left-1"}`}
                          style={{ color: "var(--color-ink-tertiary)" }}
                        >
                          {formatTimestamp(msg.created_at)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {streaming && streamingText && (
                <div className="flex justify-start">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-[13px] leading-relaxed"
                    style={{
                      background: "var(--color-surface)",
                      color: "var(--color-ink)",
                      border: "1px solid var(--color-border)",
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                  />
                </div>
              )}

              {streaming && !streamingText && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className="shrink-0 px-4 pb-4 pt-2"
          style={{ background: "var(--color-canvas)" }}
        >
          <div className="max-w-3xl mx-auto">
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={placeholder}
                disabled={streaming}
                className="flex-1 bg-transparent resize-none outline-none text-[13px] leading-relaxed max-h-[120px]"
                style={{ color: "var(--color-ink)" }}
              />
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
                className="size-8 shrink-0 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: "var(--color-viridian-500)", color: "white" }}
              >
                <ArrowUp className="size-4" />
              </button>
            </div>
            <p className="text-center mt-2 text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
              AI may make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({
  conv,
  active,
  renamingId,
  renameValue,
  onSelect,
  onDelete,
  onTogglePin,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  conv: Conversation;
  active: boolean;
  renamingId: string | null;
  renameValue: string;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isRenaming = renamingId === conv.id;

  return (
    <div
      className="group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors"
      style={{
        background: active ? "var(--color-viridian-100)" : "transparent",
      }}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {conv.pinned && (
        <Pin className="size-3 shrink-0" style={{ color: "var(--color-viridian-500)" }} />
      )}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full bg-transparent outline-none text-[13px] px-1 rounded"
            style={{
              color: "var(--color-ink)",
              border: "1px solid var(--color-viridian-500)",
            }}
          />
        ) : (
          <>
            <div
              className="text-[13px] truncate"
              style={{ color: active ? "var(--color-viridian-700)" : "var(--color-ink)" }}
            >
              {conv.title}
            </div>
            <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
              {relativeTime(conv.last_message_at)}
            </div>
          </>
        )}
      </div>

      {showActions && !isRenaming && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className="size-6 rounded flex items-center justify-center hover:opacity-70"
            style={{ color: conv.pinned ? "var(--color-viridian-500)" : "var(--color-ink-tertiary)" }}
          >
            <Pin className="size-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStartRename(); }}
            className="size-6 rounded flex items-center justify-center hover:opacity-70"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            <MessageSquare className="size-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="size-6 rounded flex items-center justify-center hover:opacity-70"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="size-2 rounded-full animate-bounce"
        style={{ background: "var(--color-viridian-500)", animationDelay: "0ms", animationDuration: "600ms" }}
      />
      <span
        className="size-2 rounded-full animate-bounce"
        style={{ background: "var(--color-viridian-500)", animationDelay: "150ms", animationDuration: "600ms" }}
      />
      <span
        className="size-2 rounded-full animate-bounce"
        style={{ background: "var(--color-viridian-500)", animationDelay: "300ms", animationDuration: "600ms" }}
      />
    </div>
  );
}
