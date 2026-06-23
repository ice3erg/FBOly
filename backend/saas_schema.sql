-- Initial SaaS schema for Ozon FBO Supply Automation.
-- Target database: PostgreSQL.

create extension if not exists pgcrypto;

create table users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    password_hash text not null,
    full_name text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_user_id uuid not null references users(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table organization_members (
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'member')),
    created_at timestamptz not null default now(),
    primary key (organization_id, user_id)
);

create table ozon_accounts (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    title text not null,
    client_id text not null,
    encrypted_api_key text not null,
    api_key_last4 text,
    last_checked_at timestamptz,
    last_check_status text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table subscription_plans (
    id text primary key,
    name text not null,
    price_monthly_rub integer not null,
    max_jobs_per_month integer not null,
    max_rows_per_month integer not null,
    max_ozon_accounts integer not null,
    can_create_ozon_drafts boolean not null default false,
    can_auto_book_slots boolean not null default false,
    created_at timestamptz not null default now()
);

insert into subscription_plans (
    id,
    name,
    price_monthly_rub,
    max_jobs_per_month,
    max_rows_per_month,
    max_ozon_accounts,
    can_create_ozon_drafts,
    can_auto_book_slots
) values
    ('start', 'Start', 2990, 20, 5000, 1, true, false),
    ('pro', 'Pro', 7990, 200, 50000, 3, true, true),
    ('agency', 'Agency', 19990, 1000, 250000, 20, true, true)
on conflict (id) do nothing;

create table subscriptions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    plan_id text not null references subscription_plans(id),
    status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
    provider text not null default 'manual',
    provider_customer_id text,
    provider_subscription_id text,
    current_period_start timestamptz not null,
    current_period_end timestamptz not null,
    cancel_at_period_end boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table usage_counters (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    period_start date not null,
    jobs_count integer not null default 0,
    rows_count integer not null default 0,
    drafts_count integer not null default 0,
    slot_jobs_count integer not null default 0,
    unique (organization_id, period_start)
);

create table processing_jobs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references users(id) on delete restrict,
    ozon_account_id uuid references ozon_accounts(id) on delete set null,
    status text not null check (status in ('queued', 'processing', 'done', 'failed')),
    input_filename text not null,
    input_rows integer not null default 0,
    resolved_rows integer not null default 0,
    error_rows integer not null default 0,
    total_input_quantity integer not null default 0,
    total_output_quantity integer not null default 0,
    error_message text,
    created_at timestamptz not null default now(),
    finished_at timestamptz
);

create table processing_job_files (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references processing_jobs(id) on delete cascade,
    warehouse text not null,
    filename text not null,
    storage_key text not null,
    rows_count integer not null,
    total_quantity integer not null,
    created_at timestamptz not null default now()
);

create table ozon_drafts (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references processing_jobs(id) on delete cascade,
    organization_id uuid not null references organizations(id) on delete cascade,
    ozon_account_id uuid references ozon_accounts(id) on delete set null,
    warehouse text not null,
    ozon_operation_id text,
    ozon_draft_id text,
    status text not null default 'created',
    error_message text,
    created_at timestamptz not null default now()
);

create table slot_booking_jobs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    user_id uuid not null references users(id) on delete restrict,
    ozon_account_id uuid references ozon_accounts(id) on delete set null,
    processing_job_id uuid references processing_jobs(id) on delete set null,
    status text not null check (
        status in ('queued', 'running', 'booked', 'partial', 'stopped', 'failed', 'expired')
    ),
    mode text not null check (mode in ('notify_only', 'auto_book')),
    target_strategy text not null default 'maximize_geography',
    max_wait_until timestamptz,
    poll_interval_seconds integer not null default 60 check (poll_interval_seconds >= 10),
    concurrency_limit integer not null default 3 check (concurrency_limit between 1 and 20),
    total_sku_count integer not null default 0,
    total_quantity integer not null default 0,
    last_heartbeat_at timestamptz,
    error_message text,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz
);

create table slot_booking_targets (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references slot_booking_jobs(id) on delete cascade,
    city text not null,
    cluster_id text,
    warehouse_id text,
    warehouse_name text,
    priority integer not null default 100,
    target_sku_count integer not null default 0,
    target_quantity integer not null default 0,
    status text not null check (
        status in (
            'waiting',
            'draft_created',
            'searching',
            'slot_found',
            'booked',
            'skipped',
            'stopped',
            'failed',
            'expired',
            'rate_limited'
        )
    ),
    ozon_operation_id text,
    ozon_draft_id text,
    ozon_supply_order_id text,
    selected_slot jsonb,
    attempts_count integer not null default 0,
    last_attempt_at timestamptz,
    booked_at timestamptz,
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table slot_booking_target_items (
    id uuid primary key default gen_random_uuid(),
    target_id uuid not null references slot_booking_targets(id) on delete cascade,
    sku text not null,
    offer_id text,
    name text,
    quantity integer not null check (quantity > 0),
    created_at timestamptz not null default now()
);

create table slot_booking_attempts (
    id uuid primary key default gen_random_uuid(),
    job_id uuid not null references slot_booking_jobs(id) on delete cascade,
    target_id uuid references slot_booking_targets(id) on delete cascade,
    attempt_type text not null check (
        attempt_type in (
            'create_draft',
            'get_timeslots',
            'create_supply',
            'update_timeslot',
            'status_check'
        )
    ),
    status text not null check (
        status in ('success', 'empty', 'rate_limited', 'retrying', 'failed')
    ),
    http_status integer,
    ozon_error_code text,
    message text,
    available_slots jsonb,
    selected_slot jsonb,
    raw_response jsonb,
    attempted_at timestamptz not null default now()
);

create table audit_events (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references organizations(id) on delete cascade,
    user_id uuid references users(id) on delete set null,
    event_type text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index idx_ozon_accounts_organization_id on ozon_accounts(organization_id);
create index idx_processing_jobs_organization_id_created_at on processing_jobs(organization_id, created_at desc);
create index idx_processing_job_files_job_id on processing_job_files(job_id);
create index idx_ozon_drafts_job_id on ozon_drafts(job_id);
create index idx_slot_booking_jobs_organization_id_created_at on slot_booking_jobs(organization_id, created_at desc);
create index idx_slot_booking_jobs_status on slot_booking_jobs(status);
create index idx_slot_booking_targets_job_id_priority on slot_booking_targets(job_id, priority);
create index idx_slot_booking_targets_status on slot_booking_targets(status);
create index idx_slot_booking_target_items_target_id on slot_booking_target_items(target_id);
create index idx_slot_booking_attempts_job_id_attempted_at on slot_booking_attempts(job_id, attempted_at desc);
create index idx_slot_booking_attempts_target_id_attempted_at on slot_booking_attempts(target_id, attempted_at desc);
create index idx_audit_events_organization_id_created_at on audit_events(organization_id, created_at desc);
