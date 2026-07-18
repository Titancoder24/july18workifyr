/**
 * Placeholder Database type. Generated types from Supabase replace this file:
 *   pnpm dlx supabase gen types typescript --project-id jcnkyklkxggthxbepvfj > src/lib/supabase/types.ts
 *
 * Until then, use a permissive shape so the app compiles and runtime queries work.
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
  };
};
