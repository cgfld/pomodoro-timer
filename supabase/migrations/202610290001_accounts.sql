-- All application data goes through authenticated Cloudflare endpoints.
-- Browser clients have no table/RPC grants, including with a valid Supabase JWT.
create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'tomato',
  default_theme text,
  goal_seconds integer not null default 7200 check (goal_seconds between 1800 and 43200),
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);
create table public.activity_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  day date not null,
  revision bigint not null check (revision > 0),
  work_seconds numeric(12,3) not null default 0 check (work_seconds between 0 and 86400),
  rest_seconds numeric(12,3) not null default 0 check (rest_seconds between 0 and 86400),
  work_completed integer not null default 0 check (work_completed between 0 and 500),
  breaks_completed integer not null default 0 check (breaks_completed between 0 and 500),
  cycles_completed integer not null default 0 check (cycles_completed between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_id, day)
);
create index activity_sources_date on public.activity_sources(user_id, day);
create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text,
  status text not null default 'free',
  access_until timestamptz,
  reconciled_at timestamptz not null default '-infinity',
  checkout_lease_until timestamptz,
  checkout_lease_id uuid
);
create table public.billing_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.account_preferences enable row level security;
alter table public.activity_sources enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.account_preferences, public.activity_sources, public.billing_customers, public.billing_events from anon, authenticated;
grant all on public.account_preferences, public.activity_sources, public.billing_customers, public.billing_events to service_role;

-- A retried or out-of-order source snapshot can never add its totals twice.
create function public.sync_activity(p_user_id uuid, p_source_id uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.activity_sources(user_id, source_id, day, revision, work_seconds, rest_seconds, work_completed, breaks_completed, cycles_completed)
  select p_user_id, p_source_id, x.day, x.revision, x.work_seconds, x.rest_seconds, x.work_completed, x.breaks_completed, x.cycles_completed
  from jsonb_to_recordset(p_rows) as x(day date, revision bigint, work_seconds numeric, rest_seconds numeric, work_completed integer, breaks_completed integer, cycles_completed integer)
  on conflict (user_id, source_id, day) do update set
    revision = excluded.revision, work_seconds = excluded.work_seconds, rest_seconds = excluded.rest_seconds,
    work_completed = excluded.work_completed, breaks_completed = excluded.breaks_completed, cycles_completed = excluded.cycles_completed, updated_at = now()
  where excluded.revision > public.activity_sources.revision;
end;
$$;

-- A short lease prevents parallel requests from creating multiple Checkout sessions.
create function public.claim_checkout(p_user_id uuid, p_lease_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.billing_customers set checkout_lease_until = now() + interval '60 seconds', checkout_lease_id = p_lease_id
  where user_id = p_user_id and (checkout_lease_until is null or checkout_lease_until < now());
  return found;
end;
$$;
create function public.release_checkout(p_user_id uuid, p_lease_id uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.billing_customers set checkout_lease_until = null, checkout_lease_id = null where user_id = p_user_id and checkout_lease_id = p_lease_id;
$$;

-- Serialize access updates, deduplicate webhook retries, and reject stale reconciliations.
create function public.apply_billing_event(p_event_id text, p_customer_id text, p_subscription_id text, p_status text, p_access_until timestamptz, p_started_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.billing_customers where stripe_customer_id = p_customer_id for update;
  insert into public.billing_events(event_id) values (p_event_id) on conflict do nothing;
  if not found then return; end if;
  update public.billing_customers set stripe_subscription_id = p_subscription_id, status = p_status, access_until = p_access_until, reconciled_at = p_started_at
  where stripe_customer_id = p_customer_id and reconciled_at <= p_started_at;
end;
$$;
revoke all on function public.sync_activity(uuid,uuid,jsonb), public.claim_checkout(uuid,uuid), public.release_checkout(uuid,uuid), public.apply_billing_event(text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.sync_activity(uuid,uuid,jsonb), public.claim_checkout(uuid,uuid), public.release_checkout(uuid,uuid), public.apply_billing_event(text,text,text,text,timestamptz,timestamptz) to service_role;
