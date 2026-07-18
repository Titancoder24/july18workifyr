"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, Plus, CheckCircle, Search, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function LegalPagesCMS() {
  const supabase = createClient();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  async function fetchPages() {
    const { data, error } = await supabase.from("cms_pages").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load pages");
    } else {
      setPages(data || []);
    }
    setLoading(false);
  }

  function handleEdit(page: any) {
    setTitle(page.title);
    setSlug(page.slug);
    setContent(page.content || "");
    setPublished(page.published);
    setCurrentId(page.id);
    setIsEditing(true);
  }

  function handleNew() {
    setTitle("");
    setSlug("");
    setContent("");
    setPublished(false);
    setCurrentId(null);
    setIsEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !slug) return toast.error("Title and Slug are required");

    const payload = { title, slug, content, published };
    
    if (currentId) {
      const { error } = await supabase.from("cms_pages").update(payload).eq("id", currentId);
      if (error) return toast.error(error.message);
      toast.success("Page updated successfully");
    } else {
      const { error } = await supabase.from("cms_pages").insert([payload]);
      if (error) return toast.error(error.message);
      toast.success("Page created successfully");
    }
    
    setIsEditing(false);
    fetchPages();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this page?")) return;
    const { error } = await supabase.from("cms_pages").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Page deleted");
      fetchPages();
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{currentId ? "Edit Page" : "Create New Page"}</h1>
            <p className="text-sm text-gray-500">Create legal or custom pages like Terms & Conditions</p>
          </div>
          <button 
            onClick={() => setIsEditing(false)}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 px-4 py-2 bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Page Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!currentId) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] outline-none transition-all"
                placeholder="e.g. Terms and Conditions"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">URL Slug</label>
              <input 
                type="text" 
                value={slug} 
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] outline-none transition-all"
                placeholder="e.g. terms-and-conditions"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content (Markdown supported)</label>
            <textarea 
              value={content} 
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[400px] bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] outline-none transition-all resize-none"
              placeholder="# Introduction\nWrite your legal text here..."
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[#40826D] focus:ring-[#40826D] accent-[#40826D]"
              />
              <span className="text-sm font-medium text-gray-700">Publish immediately</span>
            </label>
            <button type="submit" className="flex items-center gap-2 bg-[#40826D] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#326756] transition-colors shadow-sm">
              <CheckCircle className="size-4" /> Save Page
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Legal Pages CMS</h1>
          <p className="text-sm text-gray-500 mt-1">Manage public pages like Privacy Policy and Terms</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-[#40826D] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#326756] transition-colors shadow-sm">
          <Plus className="size-4" /> Create Page
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search pages..." className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#40826D]" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">URL Slug</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading pages...</td>
                </tr>
              ) : pages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <FileText className="size-8 mx-auto mb-3 opacity-20" />
                    No pages found. Create your first legal page.
                  </td>
                </tr>
              ) : pages.map(page => (
                <tr key={page.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{page.title}</td>
                  <td className="px-6 py-4 text-gray-500">/legal/{page.slug}</td>
                  <td className="px-6 py-4">
                    {page.published ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-500"></span> Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                        <span className="size-1.5 rounded-full bg-gray-400"></span> Draft
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(page)} className="p-2 text-gray-400 hover:text-[#40826D] hover:bg-emerald-50 rounded-lg transition-colors">
                        <Edit2 className="size-4" />
                      </button>
                      <button onClick={() => handleDelete(page.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
