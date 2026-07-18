import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the authenticated user, their org, and their roles.
 * Server Components and Server Actions call this to avoid repeating the lookup.
 */
export async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, org_id, organizations(id, name, currency, timezone, brand_color)")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/onboarding");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles!inner(key)")
    .eq("user_id", user.id);

  const roles = (roleRows ?? [])
    .map((r: { roles: { key: string } | { key: string }[] }) => {
      const inner = Array.isArray(r.roles) ? r.roles[0] : r.roles;
      return inner?.key;
    })
    .filter(Boolean) as string[];

  const orgRaw = (profile as { organizations?: unknown }).organizations;
  const organization = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    brand_color: string;
  } | null;

  return {
    supabase,
    user,
    profile: { id: profile.id, full_name: profile.full_name ?? user.email ?? "Member" },
    orgId: profile.org_id as string,
    organization,
    roles,
    hasRole: (key: string) => roles.includes(key),
    hasAnyRole: (keys: string[]) => keys.some((k) => roles.includes(k)),
  };
}

export type AppContext = Awaited<ReturnType<typeof getContext>>;
