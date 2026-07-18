"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Using service role to bypass RLS for admin actions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getAdminUsers() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }
  return data.users.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    full_name: u.user_metadata?.full_name || "Unknown",
    org_id: u.user_metadata?.org_id || null,
    role: u.user_metadata?.role || "Member",
  }));
}

export async function createBlogPost(formData: FormData) {
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  
  if (!title || !content) return;
  
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  
  await supabaseAdmin.from("blog_posts").insert({
    title,
    slug,
    content,
    published: true,
  });
  
  revalidatePath("/admin/cms");
  revalidatePath("/blog");
}

export async function deleteBlogPost(id: string) {
  await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  revalidatePath("/admin/cms");
  revalidatePath("/blog");
}

export async function addLmsVideo(formData: FormData) {
  const title = formData.get("title") as string;
  const youtubeUrl = formData.get("youtubeUrl") as string;
  const description = formData.get("description") as string;
  
  if (!title || !youtubeUrl) return;
  
  // Extract YouTube ID from URL (e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ -> dQw4w9WgXcQ)
  let youtube_id = youtubeUrl;
  const match = youtubeUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
  if (match) {
    youtube_id = match[1];
  }

  await supabaseAdmin.from("lms_videos").insert({
    title,
    youtube_id,
    description,
  });
  
  revalidatePath("/admin/lms");
  revalidatePath("/learn");
}

export async function deleteLmsVideo(id: string) {
  await supabaseAdmin.from("lms_videos").delete().eq("id", id);
  revalidatePath("/admin/lms");
  revalidatePath("/learn");
}

export async function updateAsset(section: string, imageUrl: string) {
  await supabaseAdmin.from("landing_page_assets").upsert({
    section,
    image_url: imageUrl
  }, { onConflict: 'section' });
  
  revalidatePath("/admin/assets");
  revalidatePath("/");
}

export async function uploadAsset(formData: FormData) {
  const section = formData.get("section") as string;
  const file = formData.get("file") as File;
  
  if (!section || !file || file.size === 0) return;
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${section}-${Date.now()}.${fileExt}`;
  
  const { data: uploadData, error } = await supabaseAdmin.storage
    .from("public-assets")
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });
    
  if (error) {
    console.error("Upload error:", error);
    return;
  }
  
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("public-assets")
    .getPublicUrl(fileName);
    
  await updateAsset(section, publicUrl);
}

export async function createPricingPlan(formData: FormData) {
  const name = formData.get("name") as string;
  const price = parseFloat(formData.get("price") as string);
  const interval = formData.get("interval") as string;
  const paymentLink = formData.get("payment_link") as string;
  const featuresText = formData.get("features") as string;
  
  if (!name || !interval || isNaN(price)) return;
  
  const features = featuresText.split("\n").map(f => f.trim()).filter(f => f.length > 0);
  
  await supabaseAdmin.from("pricing_plans").insert({
    name,
    price,
    interval,
    payment_link: paymentLink || null,
    features,
  });
  
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
}

export async function updatePricingPlan(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const price = parseFloat(formData.get("price") as string);
  const interval = formData.get("interval") as string;
  const paymentLink = formData.get("payment_link") as string;
  const featuresText = formData.get("features") as string;
  
  if (!id || !name || !interval || isNaN(price)) return;
  
  const features = featuresText.split("\n").map(f => f.trim()).filter(f => f.length > 0);
  
  await supabaseAdmin.from("pricing_plans").update({
    name,
    price,
    interval,
    payment_link: paymentLink || null,
    features,
    updated_at: new Date().toISOString()
  }).eq("id", id);
  
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
}

export async function deletePricingPlan(id: string) {
  await supabaseAdmin.from("pricing_plans").delete().eq("id", id);
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
}
