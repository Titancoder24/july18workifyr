"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decideLeaveRequest } from "./actions";

export function DecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  function decide(decision: "approved" | "rejected") {
    setBusy(decision === "approved" ? "approve" : "reject");
    startTransition(async () => {
      const res = await decideLeaveRequest({ id, decision });
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "approved" ? "Leave approved." : "Leave rejected.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="primary"
        loading={busy === "approve"}
        onClick={() => decide("approved")}
        iconLeft={busy === "approve" ? null : <Check className="size-3" />}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={busy === "reject"}
        onClick={() => decide("rejected")}
        iconLeft={busy === "reject" ? null : <X className="size-3" />}
      >
        Reject
      </Button>
    </div>
  );
}
