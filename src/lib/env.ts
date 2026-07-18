import { z } from "zod";

/**
 * Boot-time environment validation. Refuses to start with a missing or malformed
 * configuration, which prevents an entire class of production incidents.
 */
const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  OPENROUTER_API_KEY: z.string().min(10).optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().default("google/gemma-4-31b-it"),
  OPENROUTER_APP_URL: z.string().optional(),
  OPENROUTER_APP_NAME: z.string().default("Workifyr"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const PublicEnv = ServerEnv.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_APP_URL: true,
});

export type ServerEnv = z.infer<typeof ServerEnv>;
export type PublicEnv = z.infer<typeof PublicEnv>;

function parse<T extends z.ZodSchema>(schema: T, source: Record<string, unknown>): z.infer<T> {
  const r = schema.safeParse(source);
  if (!r.success) {
    const flat = r.error.flatten().fieldErrors;
    const lines = Object.entries(flat).map(([k, v]) => `  • ${k}: ${(v ?? []).join(", ")}`);
    throw new Error(
      `Invalid environment configuration:\n${lines.join("\n")}\n\nCheck .env.local against .env.example.`,
    );
  }
  return r.data;
}

export const env: ServerEnv =
  typeof window === "undefined"
    ? parse(ServerEnv, process.env)
    : (parse(PublicEnv, {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      }) as ServerEnv);
