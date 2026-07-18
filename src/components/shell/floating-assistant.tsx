"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

export function FloatingAssistant() {
  const pathname = usePathname();
  if (pathname?.startsWith("/crm/ai") || pathname?.startsWith("/hrm/ai")) return null;

  const target = pathname?.startsWith("/hrm") ? "/hrm/ai" : "/crm/ai";

  return (
    <Link
      href={target}
      aria-label="Open AI assistant"
      title="Ask AI Assistant"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 48,
        padding: "0 18px",
        borderRadius: 999,
        background: "linear-gradient(135deg, var(--color-viridian-500), var(--color-viridian-700))",
        color: "white",
        border: "1px solid var(--color-viridian-700)",
        boxShadow:
          "0 6px 20px -4px rgba(64,130,109,0.45), 0 16px 48px -12px rgba(15,23,42,0.30), inset 0 1px 0 rgba(255,255,255,0.2)",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        transition: "transform 160ms cubic-bezier(0.25,1,0.5,1), box-shadow 160ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 10px 28px -4px rgba(64,130,109,0.55), 0 20px 60px -12px rgba(15,23,42,0.35), inset 0 1px 0 rgba(255,255,255,0.22)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 6px 20px -4px rgba(64,130,109,0.45), 0 16px 48px -12px rgba(15,23,42,0.30), inset 0 1px 0 rgba(255,255,255,0.2)";
      }}
    >
      <Sparkles size={16} />
      <span>Ask AI</span>
    </Link>
  );
}
