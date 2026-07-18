import { getContext } from "@/lib/server/context";
import { AIChat } from "@/components/ai/chat";

export default async function CRMAIPage() {
  const ctx = await getContext();
  return (
    <div className="h-[calc(100vh-56px)]">
      <AIChat module="crm" userName={ctx.profile.full_name} />
    </div>
  );
}
