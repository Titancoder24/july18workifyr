import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function requireOutreachSession() {
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from("profiles").select("org_id, full_name").eq("id", user.id).single();
  const orgId = profile && typeof profile.org_id === "string" ? profile.org_id : null;
  if (!orgId) {
    return { error: NextResponse.json({ error: "Finish organization setup before using outreach." }, { status: 403 }) };
  }
  const name = profile && typeof profile.full_name === "string" && profile.full_name.trim()
    ? profile.full_name
    : user.email ?? "Workifyr";
  return { supabase, user, orgId, name };
}
