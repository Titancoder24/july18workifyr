"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type Options = {
  intervalMs?: number;
  onNew?: (notifs: Notif[]) => void;
};

export function useNotificationsPoller(opts: Options = {}) {
  const { intervalMs = 30_000, onNew } = opts;
  const seenRef = useRef<Set<string>>(new Set());
  const initialRef = useRef(true);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        try {
          Notification.requestPermission().catch(() => {});
        } catch {
        }
      }
    }

    async function tick(uid: string) {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active) return;
      const rows = (data ?? []) as Notif[];

      if (!initialRef.current) {
        const fresh = rows.filter((r) => {
          if (seenRef.current.has(r.id)) return false;
          if (r.read_at) return false;
          const ageMs = Date.now() - new Date(r.created_at).getTime();
          return ageMs <= 60_000;
        });
        if (fresh.length > 0) {
          if (
            typeof window !== "undefined" &&
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
          if (onNewRef.current) onNewRef.current(fresh);
        }
      }

      seenRef.current = new Set(rows.map((r) => r.id));
      initialRef.current = false;
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      await tick(user.id);
      interval = setInterval(() => {
        tick(user.id);
      }, intervalMs);
    })();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [intervalMs]);
}

export function NotificationsPoller({ intervalMs }: { intervalMs?: number }) {
  useNotificationsPoller({ intervalMs });
  return null;
}
