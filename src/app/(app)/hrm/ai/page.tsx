import { getContext } from "@/lib/server/context";
import { AIChat } from "@/components/ai/chat";

export default async function HRMAIPage() {
  const ctx = await getContext();
  return (
    <div className="h-[calc(100vh-56px)]">
      <AIChat module="hrm" userName={ctx.profile.full_name} />
    </div>
  );
}
