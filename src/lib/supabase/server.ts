import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Server Component / Route Handler / Server Action client.
 * Cookies are read from the request and any auth refresh writes are mirrored back.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies; middleware refreshes instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. NEVER pass to client components or expose via the
 * browser bundle. Used for audit log inserts and AI tool execution paths
 * that must bypass RLS by design.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
