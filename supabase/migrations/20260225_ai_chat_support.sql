create extension if not exists pgcrypto;

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_internal, false) = true
  );
$$;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.support_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.support_agents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.support_areas(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, area_id)
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'handed_off', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system', 'agent')),
  content text not null,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.support_areas(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  handoff_reason text,
  ai_confidence numeric(5, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_conversations_user_id on public.ai_conversations(user_id);
create index if not exists idx_ai_messages_conversation_id on public.ai_messages(conversation_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_assigned_to on public.support_tickets(assigned_to);
create index if not exists idx_support_tickets_area_id on public.support_tickets(area_id);

drop trigger if exists trg_ai_conversations_updated_at on public.ai_conversations;
create trigger trg_ai_conversations_updated_at
before update on public.ai_conversations
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.set_row_updated_at();

alter table public.support_areas enable row level security;
alter table public.support_agents enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "read support areas" on public.support_areas;
create policy "read support areas"
on public.support_areas
for select
to authenticated
using (true);

drop policy if exists "read support agents internal" on public.support_agents;
create policy "read support agents internal"
on public.support_agents
for select
to authenticated
using (public.is_internal_user() or profile_id = auth.uid());

drop policy if exists "manage support agents internal" on public.support_agents;
create policy "manage support agents internal"
on public.support_agents
for all
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

drop policy if exists "read conversations own or internal" on public.ai_conversations;
create policy "read conversations own or internal"
on public.ai_conversations
for select
to authenticated
using (user_id = auth.uid() or public.is_internal_user());

drop policy if exists "create conversation for self" on public.ai_conversations;
create policy "create conversation for self"
on public.ai_conversations
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "update conversations own or internal" on public.ai_conversations;
create policy "update conversations own or internal"
on public.ai_conversations
for update
to authenticated
using (user_id = auth.uid() or public.is_internal_user())
with check (user_id = auth.uid() or public.is_internal_user());

drop policy if exists "read messages own conversation or internal" on public.ai_messages;
create policy "read messages own conversation or internal"
on public.ai_messages
for select
to authenticated
using (
  public.is_internal_user()
  or exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "insert user messages on own conversation" on public.ai_messages;
create policy "insert user messages on own conversation"
on public.ai_messages
for insert
to authenticated
with check (
  role = 'user'
  and user_id = auth.uid()
  and exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "read tickets own or internal" on public.support_tickets;
create policy "read tickets own or internal"
on public.support_tickets
for select
to authenticated
using (user_id = auth.uid() or public.is_internal_user());

drop policy if exists "update tickets internal only" on public.support_tickets;
create policy "update tickets internal only"
on public.support_tickets
for update
to authenticated
using (public.is_internal_user())
with check (public.is_internal_user());

insert into public.support_areas (name)
values
  ('operaciones'),
  ('documentacion'),
  ('facturacion'),
  ('soporte_tecnico')
on conflict (name) do nothing;
