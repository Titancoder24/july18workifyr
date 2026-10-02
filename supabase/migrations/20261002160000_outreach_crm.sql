-- Outreach lists, mailboxes, campaigns, and inbox, scoped to the CRM organization.
-- Contacts stay in public.contacts so outreach and the CRM share one directory.

alter table public.contacts
  add column if not exists region text,
  add column if not exists outreach_status text not null default 'active';

alter table public.contacts drop constraint if exists contacts_outreach_status_check;
alter table public.contacts
  add constraint contacts_outreach_status_check
  check (outreach_status in ('active', 'do_not_contact', 'bounced', 'archived'));

create table if not exists public.outreach_lists (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_dynamic boolean not null default false,
  query text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_list_members (
  list_id uuid not null references public.outreach_lists(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);

create table if not exists public.outreach_senders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  from_name text not null,
  from_email text not null,
  connection_status text not null default 'pending' check (connection_status in ('pending', 'connected', 'error')),
  composio_connection_id text,
  composio_session_id text,
  domain_verified boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid references public.outreach_senders(id) on delete set null,
  list_id uuid references public.outreach_lists(id) on delete set null,
  name text not null,
  subject text not null,
  body text not null,
  asset_title text,
  asset_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'queued', 'sending', 'sent')),
  send_at timestamptz,
  throttle_per_hour integer not null default 25,
  metrics jsonb not null default '{"sent":0,"opened":0,"clicked":0,"bounced":0,"replied":0}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_context (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid references public.outreach_senders(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  external_thread_id text not null,
  subject text not null,
  participants text[] not null default '{}',
  snippet text,
  intent text,
  sentiment text,
  unread boolean not null default false,
  needs_reply boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_id, external_thread_id)
);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.outreach_threads(id) on delete cascade,
  external_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text,
  to_emails text[] not null default '{}',
  body text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (thread_id, external_message_id)
);

create table if not exists public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.outreach_threads(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  draft_body text not null,
  reasoning text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists outreach_lists_org_idx on public.outreach_lists(org_id);
create index if not exists outreach_senders_org_idx on public.outreach_senders(org_id);
create index if not exists outreach_campaigns_org_idx on public.outreach_campaigns(org_id);
create index if not exists outreach_threads_org_idx on public.outreach_threads(org_id, last_message_at desc);

alter table public.outreach_lists enable row level security;
alter table public.outreach_list_members enable row level security;
alter table public.outreach_senders enable row level security;
alter table public.outreach_campaigns enable row level security;
alter table public.outreach_context enable row level security;
alter table public.outreach_threads enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.outreach_drafts enable row level security;

grant select, insert, update, delete on
  public.outreach_lists,
  public.outreach_list_members,
  public.outreach_senders,
  public.outreach_campaigns,
  public.outreach_context,
  public.outreach_threads,
  public.outreach_messages,
  public.outreach_drafts
to authenticated;

drop policy if exists outreach_lists_all on public.outreach_lists;
create policy outreach_lists_all on public.outreach_lists
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists outreach_list_members_all on public.outreach_list_members;
create policy outreach_list_members_all on public.outreach_list_members
  for all to authenticated
  using (exists (select 1 from public.outreach_lists l where l.id = list_id and l.org_id = public.current_org_id()))
  with check (exists (select 1 from public.outreach_lists l where l.id = list_id and l.org_id = public.current_org_id()));

drop policy if exists outreach_senders_all on public.outreach_senders;
create policy outreach_senders_all on public.outreach_senders
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists outreach_campaigns_all on public.outreach_campaigns;
create policy outreach_campaigns_all on public.outreach_campaigns
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists outreach_context_all on public.outreach_context;
create policy outreach_context_all on public.outreach_context
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists outreach_threads_all on public.outreach_threads;
create policy outreach_threads_all on public.outreach_threads
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists outreach_messages_all on public.outreach_messages;
create policy outreach_messages_all on public.outreach_messages
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

drop policy if exists outreach_drafts_all on public.outreach_drafts;
create policy outreach_drafts_all on public.outreach_drafts
  for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
