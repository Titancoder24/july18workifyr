import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { FloatingAssistant } from "./floating-assistant";
import { createClient } from "@/lib/supabase/server";
import { RBACProvider } from "@/lib/rbac";
import { ThemeProvider } from "@/lib/theme";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/signup");

  return (
    <ThemeProvider>
      <RBACProvider>
        <div className="min-h-screen flex" style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar userName={profile.full_name ?? user.email ?? "Member"} />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
          <FloatingAssistant />
        </div>
      </RBACProvider>
    </ThemeProvider>
  );
}
