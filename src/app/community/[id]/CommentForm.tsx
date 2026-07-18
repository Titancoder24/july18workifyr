"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CommentForm({ postId }: { postId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    await supabase.from("community_comments").insert({
      post_id: postId,
      author_name: formData.get("name") as string,
      author_email: formData.get("email") as string,
      content: formData.get("content") as string,
    });
    
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input name="name" required type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[13px]" placeholder="Your Name" />
        <input name="email" required type="email" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[13px]" placeholder="Email" />
      </div>
      <textarea name="content" required rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[13px] resize-none" placeholder="Write a comment..."></textarea>
      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50">
          {loading ? "Posting..." : <><Send className="size-4" /> Post Comment</>}
        </button>
      </div>
    </form>
  );
}
