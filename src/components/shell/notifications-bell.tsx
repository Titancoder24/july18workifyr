"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCircle2, Clock, X, ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";

type Notif = {
  id: string;
  kind: string | null;
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type Tab = "all" | "unread" | "follow-ups";

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [bellHover, setBellHover] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const supabaseRef = useRef(createClient());

  const fetchNotifs = useCallback(async (uid: string) => {
    const supabase = supabaseRef.current;
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, link, entity_type, entity_id, read_at, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as Notif[];

    if (!initialLoadRef.current) {
      const fresh = rows.filter((r) => {
        if (seenIdsRef.current.has(r.id)) return false;
        if (r.read_at) return false;
        const ageMs = Date.now() - new Date(r.created_at).getTime();
        return ageMs <= 60_000;
      });
      if (fresh.length > 0 && typeof window !== "undefined") {
        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState !== "visible"
        ) {
          for (const n of fresh) {
            try {
              new Notification(n.title, {
                body: n.body ?? undefined,
                icon: "/favicon.ico",
              });
            } catch {
            }
          }
        }
      }
    }

    seenIdsRef.current = new Set(rows.map((r) => r.id));
    initialLoadRef.current = false;
    setNotifs(rows);
  }, []);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const supabase = supabaseRef.current;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);
      await fetchNotifs(user.id);
      interval = setInterval(() => {
        fetchNotifs(user.id);
      }, 30_000);
    })();

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          Notification.requestPermission().catch(() => {});
        } catch {
        }
      }
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [fetchNotifs]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = notifs.filter((n) => !n.read_at);
  const unreadCount = unread.length;

  const filtered = notifs.filter((n) => {
    if (tab === "unread") return !n.read_at;
    if (tab === "follow-ups") return n.kind === "follow_up" || n.kind === "follow_up_reminder";
    return true;
  });

  async function markAsRead(id: string) {
    if (!userId) return;
    const supabase = supabaseRef.current;
    const now = new Date().toISOString();
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now } as never)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Could not mark as read");
      fetchNotifs(userId);
    }
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return;
    const supabase = supabaseRef.current;
    const now = new Date().toISOString();
    setNotifs((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now } as never)
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      toast.error("Could not mark all as read");
      fetchNotifs(userId);
    } else {
      toast.success("All notifications marked as read");
    }
  }

  async function dismiss(id: string) {
    if (!userId) return;
    const supabase = supabaseRef.current;
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Could not dismiss");
      fetchNotifs(userId);
    }
  }

  async function onItemClick(n: Notif) {
    if (!n.read_at) await markAsRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link as never);
    }
  }

  function iconFor(n: Notif) {
    const isFollowUp = n.kind === "follow_up" || n.kind === "follow_up_reminder";
    const isCompleted = n.kind === "follow_up_completed" || n.kind === "task_completed";
    const color = !n.read_at ? "var(--color-viridian-600)" : "var(--color-ink-tertiary)";
    if (isCompleted) return <CheckCircle2 size={16} style={{ color }} />;
    if (isFollowUp) return <Clock size={16} style={{ color }} />;
    return <Bell size={16} style={{ color }} />;
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setBellHover(true)}
        onMouseLeave={() => setBellHover(false)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          color: "var(--color-ink-secondary)",
          position: "relative",
          background: bellHover ? "var(--color-surface-hover)" : "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 14,
              height: 14,
              padding: "0 3px",
              background: "var(--color-viridian-500)",
              color: "white",
              fontSize: 9.5,
              fontWeight: 600,
              borderRadius: 7,
              display: "grid",
              placeItems: "center",
              border: "1.5px solid var(--color-canvas)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            width: 380,
            maxHeight: 480,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            boxShadow: "var(--shadow-pop)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
              Notifications
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-viridian-700)",
                  fontSize: 12,
                  fontWeight: 550,
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: 6,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "10px 16px",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "unread", label: "Unread" },
                { key: "follow-ups", label: "Follow-ups" },
              ] as { key: Tab; label: string }[]
            ).map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 550,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: active ? "transparent" : "var(--color-border)",
                    background: active ? "var(--color-viridian-100)" : "transparent",
                    color: active ? "var(--color-viridian-700)" : "var(--color-ink-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                  {t.key === "unread" && unreadCount > 0 && (
                    <span style={{ marginLeft: 5, fontWeight: 600 }}>{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ overflowY: "auto", flex: 1, minHeight: 120 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 16px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "var(--color-surface-2)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--color-ink-tertiary)",
                    marginBottom: 10,
                  }}
                >
                  <Inbox size={18} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 550, color: "var(--color-ink)" }}>
                  No notifications
                </div>
                <div style={{ fontSize: 12, color: "var(--color-ink-tertiary)", marginTop: 2 }}>
                  You&apos;re all caught up
                </div>
              </div>
            ) : (
              filtered.map((n, idx) => {
                const isLast = idx === filtered.length - 1;
                const isUnread = !n.read_at;
                const isHovered = hovered === n.id;
                return (
                  <div
                    key={n.id}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
                    onClick={() => onItemClick(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onItemClick(n);
                      }
                    }}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 14px 10px 16px",
                      borderBottom: isLast ? "none" : "1px solid var(--color-border)",
                      background: isHovered ? "var(--color-surface-hover)" : "transparent",
                      cursor: n.link ? "pointer" : "default",
                    }}
                  >
                    {isUnread && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          background: "var(--color-viridian-500)",
                        }}
                      />
                    )}
                    <div
                      style={{
                        marginTop: 2,
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        display: "grid",
                        placeItems: "center",
                        background: isUnread ? "var(--color-viridian-100)" : "transparent",
                        flexShrink: 0,
                      }}
                    >
                      {iconFor(n)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: isUnread ? 550 : 400,
                          color: "var(--color-ink)",
                          lineHeight: 1.35,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.title}
                        </span>
                        {n.link && (
                          <ExternalLink
                            size={11}
                            style={{ color: "var(--color-ink-tertiary)", flexShrink: 0 }}
                          />
                        )}
                      </div>
                      {n.body && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            color: "var(--color-ink-tertiary)",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {n.body}
                        </div>
                      )}
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 11,
                          color: "var(--color-ink-tertiary)",
                        }}
                      >
                        {relativeTime(n.created_at)}
                      </div>
                    </div>
                    {isHovered && (
                      <button
                        type="button"
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                        }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          display: "grid",
                          placeItems: "center",
                          background: "transparent",
                          border: "none",
                          color: "var(--color-ink-tertiary)",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              position: "sticky",
              bottom: 0,
              padding: "8px 14px",
              borderTop: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              textAlign: "center",
            }}
          >
            <Link
              href={"/crm/follow-ups" as never}
              onClick={() => setOpen(false)}
              style={{
                fontSize: 12,
                fontWeight: 550,
                color: "var(--color-viridian-700)",
                textDecoration: "none",
              }}
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
