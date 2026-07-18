import { createClient } from "@supabase/supabase-js";
import { Users, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminCommunityPage() {
  const { data: posts } = await supabaseAdmin
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Community Moderation</h1>
          <p className="text-[14px] text-gray-500 mt-1 font-medium">Monitor and manage the public forum.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-6 py-3 font-semibold text-gray-900">Post Title</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Author</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Date</th>
              <th className="px-6 py-3 font-semibold text-gray-900">Upvotes</th>
              <th className="px-6 py-3 font-semibold text-gray-900 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts && posts.length > 0 ? (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 max-w-md truncate">
                    {post.title}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900 font-medium">{post.author_name}</div>
                    <div className="text-gray-500 text-[11px]">{post.author_email}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(post.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="chip chip-default">{post.upvotes}</span>
                  </td>
                  <td className="px-6 py-4 flex items-center justify-end gap-2">
                    <Link href={`/community/${post.id}`} target="_blank" className="p-1.5 text-gray-400 hover:text-[#40826D] hover:bg-emerald-50 rounded transition-colors"><ExternalLink className="size-4" /></Link>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 className="size-4" /></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No community posts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
