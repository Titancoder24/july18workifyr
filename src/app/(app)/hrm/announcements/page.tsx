"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader, PageContainer } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate, relativeTime } from "@/lib/format";
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Megaphone,
  Eye,
  Loader2,
} from "lucide-react";

/* ============================================================================
   Types
   ========================================================================= */

interface Announcement {
  id: string;
  org_id: string;
  title: string;
  body_html: string | null;
  audience: string;
  audience_meta: Record<string, unknown> | null;
  pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  author_id: string | null;
  created_at: string;
}

type Supa = ReturnType<typeof createClient>;

// Helper to bypass strict table-name typing for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (sb: Supa, table: string): any => (sb as any).from(table);

/* ============================================================================
   Main Page
   ========================================================================= */

export default function AnnouncementsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Data
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readMap, setReadMap] = useState<Record<string, number>>({});
  const [userReads, setUserReads] = useState<Set<string>>(new Set());
  const [authors, setAuthors] = useState<Record<string, string>>({});

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);

  /* ------ Bootstrap ------ */
  const bootstrap = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await from(supabase, "profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single();
    if (!profile) return;
    setOrgId(profile.org_id);
    setUserId(user.id);

    const oid = profile.org_id;
    const [announcementsRes, readsRes, userReadsRes] = await Promise.all([
      from(supabase, "announcements")
        .select("*")
        .eq("org_id", oid)
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200),
      from(supabase, "announcement_reads")
        .select("announcement_id")
        .eq("org_id", oid),
      from(supabase, "announcement_reads")
        .select("announcement_id")
        .eq("org_id", oid)
        .eq("user_id", user.id),
    ]);

    const items = (announcementsRes.data ?? []) as Announcement[];
    setAnnouncements(items);

    // Count reads per announcement
    const counts: Record<string, number> = {};
    for (const r of ((readsRes.data ?? []) as { announcement_id: string }[])) {
      counts[r.announcement_id] = (counts[r.announcement_id] || 0) + 1;
    }
    setReadMap(counts);

    // User's own reads
    const readSet = new Set<string>();
    for (const r of ((userReadsRes.data ?? []) as { announcement_id: string }[])) {
      readSet.add(r.announcement_id);
    }
    setUserReads(readSet);

    // Fetch author profiles
    const authorIds = [...new Set(items.filter((a) => a.author_id).map((a) => a.author_id!))];
    if (authorIds.length > 0) {
      const { data: profiles } = await from(supabase, "profiles")
        .select("id, full_name")
        .in("id", authorIds);
      const authorMap: Record<string, string> = {};
      for (const p of ((profiles ?? []) as { id: string; full_name: string | null }[])) {
        authorMap[p.id] = p.full_name ?? "Unknown";
      }
      setAuthors(authorMap);
    }

    // Mark unread announcements as read
    const unreadIds = items
      .filter((a) => !readSet.has(a.id))
      .map((a) => a.id);
    if (unreadIds.length > 0) {
      const readsToInsert = unreadIds.map((id) => ({
        announcement_id: id,
        user_id: user.id,
        org_id: oid,
        read_at: new Date().toISOString(),
      }));
      await from(supabase, "announcement_reads").upsert(readsToInsert, {
        onConflict: "announcement_id,user_id",
      });
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  /* ------ Actions ------ */
  const togglePin = async (announcement: Announcement) => {
    const { error } = await from(supabase, "announcements")
      .update({ pinned: !announcement.pinned })
      .eq("id", announcement.id)
      .eq("org_id", orgId!);
    if (error) { toast.error(error.message); return; }
    toast.success(announcement.pinned ? "Unpinned" : "Pinned");
    bootstrap();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await from(supabase, "announcements")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId!);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement deleted");
    bootstrap();
  };

  const openEdit = (a: Announcement) => {
    setEditAnnouncement(a);
    setSheetOpen(true);
  };

  const openNew = () => {
    setEditAnnouncement(null);
    setSheetOpen(true);
  };

  // Sort: pinned first, then by published_at desc
  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const dateA = a.published_at ? new Date(a.published_at).getTime() : new Date(a.created_at).getTime();
    const dateB = b.published_at ? new Date(b.published_at).getTime() : new Date(b.created_at).getTime();
    return dateB - dateA;
  });

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin" style={{ color: "var(--color-ink-tertiary)" }} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        description={`${announcements.length} announcement(s)`}
        actions={
          <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={openNew}>
            New Announcement
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div
            className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
            style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
          >
            <Megaphone className="size-5" />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight">No announcements yet</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
            Share important updates with your team by creating your first announcement.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => {
            const isUnread = !userReads.has(a.id);
            const readCount = readMap[a.id] ?? 0;
            const authorName = a.author_id ? (authors[a.author_id] ?? "Unknown") : "System";
            const displayDate = a.published_at ?? a.created_at;

            return (
              <article
                key={a.id}
                className="card overflow-hidden relative"
                style={{
                  borderLeft: isUnread ? "3px solid var(--color-viridian-500)" : undefined,
                }}
              >
                {/* Header */}
                <div className="px-5 pt-4 pb-2 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.pinned && (
                        <Pin className="size-3.5 shrink-0" style={{ color: "var(--color-viridian-500)" }} />
                      )}
                      {isUnread && (
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ background: "var(--color-viridian-500)" }}
                        />
                      )}
                      <h2 className="text-[16px] font-semibold tracking-tight">{a.title}</h2>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      <span>{authorName}</span>
                      <span>·</span>
                      <span>{relativeTime(displayDate)}</span>
                      <span>·</span>
                      <Badge tone={a.audience === "all" ? "neutral" : "outline"}>{a.audience}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={a.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                      onClick={() => togglePin(a)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<Pencil className="size-3.5" />}
                      onClick={() => openEdit(a)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<Trash2 className="size-3.5" />}
                      onClick={() => deleteAnnouncement(a.id)}
                    />
                  </div>
                </div>

                {/* Body */}
                {a.body_html && (
                  <div
                    className="px-5 pb-3 text-[13px] leading-relaxed prose-sm max-w-none"
                    style={{ color: "var(--color-ink-secondary)" }}
                    dangerouslySetInnerHTML={{ __html: a.body_html }}
                  />
                )}

                {/* Footer */}
                <div
                  className="px-5 py-2.5 flex items-center justify-between text-[11px]"
                  style={{
                    borderTop: "1px solid var(--color-border)",
                    color: "var(--color-ink-tertiary)",
                    background: "var(--color-surface-muted)",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Eye className="size-3" />
                    <span>Read by {readCount} {readCount === 1 ? "person" : "people"}</span>
                  </div>
                  {a.expires_at && (
                    <span>Expires {formatDate(a.expires_at)}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* New / Edit Sheet */}
      <AnnouncementSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orgId={orgId!}
        userId={userId!}
        supabase={supabase}
        existing={editAnnouncement}
        onDone={bootstrap}
      />
    </PageContainer>
  );
}

/* ============================================================================
   Announcement Sheet (New / Edit)
   ========================================================================= */

function AnnouncementSheet({
  open,
  onOpenChange,
  orgId,
  userId,
  supabase,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  userId: string;
  supabase: Supa;
  existing: Announcement | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(existing?.body_html ?? "");
  const [audience, setAudience] = useState(existing?.audience ?? "all");
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [publishedAt, setPublishedAt] = useState(
    existing?.published_at ? existing.published_at.slice(0, 16) : ""
  );
  const [expiresAt, setExpiresAt] = useState(
    existing?.expires_at ? existing.expires_at.slice(0, 16) : ""
  );

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      setBodyHtml(existing?.body_html ?? "");
      setAudience(existing?.audience ?? "all");
      setPinned(existing?.pinned ?? false);
      setPublishedAt(
        existing?.published_at ? existing.published_at.slice(0, 16) : ""
      );
      setExpiresAt(
        existing?.expires_at ? existing.expires_at.slice(0, 16) : ""
      );
    }
  }, [open, existing]);

  async function onSave() {
    if (!title.trim()) { toast.error("Please enter a title"); return; }
    setBusy(true);

    const payload = {
      org_id: orgId,
      title: title.trim(),
      body_html: bodyHtml || null,
      audience,
      pinned,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      author_id: userId,
    };

    if (existing) {
      const { error } = await from(supabase, "announcements")
        .update(payload)
        .eq("id", existing.id)
        .eq("org_id", orgId);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Announcement updated");
    } else {
      const { error } = await from(supabase, "announcements").insert(payload);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Announcement published");
    }

    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={existing ? "Edit Announcement" : "New Announcement"}
      description="Share updates with your team."
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onSave} loading={busy}>
            {existing ? "Update" : "Publish"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Title" required>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Announcement title"
          />
        </Field>

        <Field label="Body (HTML)">
          <Textarea
            rows={8}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="<p>Write your announcement content here...</p>"
          />
        </Field>

        <Field label="Audience">
          <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">All</option>
            <option value="department">Department</option>
            <option value="specific">Specific</option>
          </Select>
        </Field>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="size-4 rounded"
              style={{ accentColor: "var(--color-viridian-500)" }}
            />
            <span className="text-[13px]">Pin to top</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Published At">
            <Input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
            />
          </Field>
          <Field label="Expires At">
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
        </div>

        {bodyHtml && (
          <div>
            <span className="text-[12px] font-medium mb-1.5 block" style={{ color: "var(--color-ink-secondary)" }}>
              Preview
            </span>
            <div
              className="p-3 rounded-lg text-[13px] leading-relaxed"
              style={{
                background: "var(--color-surface-muted)",
                border: "1px solid var(--color-border)",
                color: "var(--color-ink-secondary)",
              }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
