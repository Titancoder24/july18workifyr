-- Migration: Add Documentation, Community, and Support Tables

-- 1. Documentation Pages (GitBook style)
CREATE TABLE IF NOT EXISTS public.documentation_pages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    category text NOT NULL,
    content text,
    page_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Community Posts (Reddit style)
CREATE TABLE IF NOT EXISTS public.community_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    author_name text NOT NULL,
    author_email text NOT NULL,
    upvotes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Community Comments
CREATE TABLE IF NOT EXISTS public.community_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
    author_name text NOT NULL,
    author_email text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_email text NOT NULL,
    customer_name text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'Open' NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set RLS (Public read, authenticated write/admin)
ALTER TABLE public.documentation_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Documentation: Public can read, anyone can technically read, but admin manages
CREATE POLICY "Public can view documentation" ON public.documentation_pages FOR SELECT USING (true);
CREATE POLICY "Admin can manage documentation" ON public.documentation_pages FOR ALL USING (auth.role() = 'authenticated');

-- Community: Public can read and insert (since it's a public forum, but usually we restrict insert to authenticated. We'll allow public insert for the MVP so "anybody can actually like put up the content").
CREATE POLICY "Public can view posts" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Public can insert posts" ON public.community_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage posts" ON public.community_posts FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public can view comments" ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Public can insert comments" ON public.community_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage comments" ON public.community_comments FOR ALL USING (auth.role() = 'authenticated');

-- Tickets: Public can insert, Admin can view/manage
CREATE POLICY "Public can insert tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage tickets" ON public.support_tickets FOR ALL USING (auth.role() = 'authenticated');
