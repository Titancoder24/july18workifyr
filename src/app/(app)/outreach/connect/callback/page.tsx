"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function OutreachConnectionCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "connected" | "failed">("checking");
  const [message, setMessage] = useState("Verifying the mailbox connection…");

  useEffect(() => {
    const verify = async () => {
      const params = new URLSearchParams(window.location.search);
      const senderId = params.get("senderId");
      const provider = params.get("provider");
      const oauthStatus = params.get("status");
      if (!senderId || !provider || oauthStatus === "failed") {
        setState("failed");
        setMessage("The mailbox connection was not completed.");
        return;
      }
      const query = new URLSearchParams({ senderId, provider });
      const response = await fetch(`/api/outreach/senders?${query}`);
      const result = await response.json();
      if (!response.ok || !result.connected) {
        setState("failed");
        setMessage(result.error || "The mailbox is not active yet.");
        return;
      }
      setState("connected");
      setMessage(`${provider === "gmail" ? "Gmail" : "Outlook"} is connected.`);
      window.setTimeout(() => router.replace("/outreach/inbox"), 900);
    };
    void verify();
  }, [router]);

  const Icon = state === "checking" ? Loader2 : state === "connected" ? CheckCircle2 : XCircle;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="card w-full max-w-md px-8 py-8 text-center">
        <Icon className={`mx-auto size-8 ${state === "checking" ? "animate-spin" : ""}`} />
        <h1 className="mt-4 text-[16px] font-semibold">Mailbox connection</h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>{message}</p>
      </div>
    </div>
  );
}
