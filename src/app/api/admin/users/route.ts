import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

async function getCallerProfile(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id")
    .eq("id", user.id)
    .single();
  return profile as { id: string; org_id: string } | null;
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Service role key not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local" },
      { status: 500 }
    );
  }

  const caller = await getCallerProfile(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email: string; password: string; full_name: string; role_keys?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, full_name, role_keys = ["employee"] } = body;
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "email, password, and full_name are required" }, { status: 400 });
  }

  const admin = adminClient();

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, org_name: "" },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: newUser.user.id,
      org_id: caller.org_id,
      full_name,
      email,
    });

  if (profileError) {
    console.error("Profile upsert error:", profileError);
  }

  if (role_keys.length > 0) {
    const { data: roles } = await admin
      .from("roles")
      .select("id, key")
      .eq("org_id", caller.org_id)
      .in("key", role_keys);

    if (roles && roles.length > 0) {
      const userRoles = roles.map((r: { id: string }) => ({
        user_id: newUser.user.id,
        role_id: r.id,
        org_id: caller.org_id,
        granted_by: caller.id,
      }));
      await admin.from("user_roles").insert(userRoles);
    }
  }

  return NextResponse.json({ ok: true, user_id: newUser.user.id }, { status: 201 });
}
