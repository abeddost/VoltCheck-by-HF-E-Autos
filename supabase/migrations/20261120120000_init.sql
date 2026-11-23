-- HF VoltCheck: initial schema
-- Roles: admin (sees everything) and mechanic (creates and edits own inspections while in draft).

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text check (role in ('admin', 'mechanic')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- A new auth user gets a profile. The role can only come from app_metadata
-- (set by an admin through the service API), never from the sign-up form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case
      when new.raw_app_meta_data ->> 'role' in ('admin', 'mechanic') then new.raw_app_meta_data ->> 'role'
      else null
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Leads (one inspected car = one lead)
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'in_review', 'offer_sent', 'bought', 'rejected')),
  mechanic_id uuid default auth.uid() references public.profiles (id) on delete set null,

  -- vehicle
  vin text,
  plate text,
  make text,
  model text,
  variant text,
  drive_type text check (drive_type in ('bev', 'phev', 'hev', 'ice')),
  first_registration date,
  mileage integer,
  power_kw integer,
  color text,
  battery_capacity_kwh numeric(6, 1),
  soh_percent numeric(5, 1),
  range_km integer,
  battery_ownership text check (battery_ownership in ('owned', 'rented', 'unknown')),

  -- seller
  seller_name text,
  seller_phone text,
  seller_email text,
  seller_type text check (seller_type in ('private', 'dealer')),
  asking_price integer,

  -- mechanic assessment
  grade smallint check (grade between 1 and 5),
  recommendation text check (recommendation in ('buy', 'buy_with_discount', 'dont_buy')),
  suggested_price integer,
  repair_cost_total integer not null default 0,
  defect_count integer not null default 0,
  mechanic_notes text,
  gdpr_consent boolean not null default false,
  signature_path text,
  cover_photo_path text,

  -- full checklist answers (keys defined in src/lib/checklist.ts)
  data jsonb not null default '{}'::jsonb,

  -- admin only
  admin_notes text,
  offer_price integer,
  purchase_price integer,

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_updated_idx on public.leads (status, updated_at desc);
create index leads_mechanic_idx on public.leads (mechanic_id);

alter table public.leads enable row level security;

-- Protects admin-only columns and validates submission.
create or replace function public.leads_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  privileged boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_admin();
begin
  if tg_op = 'INSERT' then
    if not privileged then
      new.admin_notes := null;
      new.offer_price := null;
      new.purchase_price := null;
    end if;
    return new;
  end if;

  new.updated_at := now();
  new.created_at := old.created_at;

  if not privileged then
    new.mechanic_id := old.mechanic_id;
    new.admin_notes := old.admin_notes;
    new.offer_price := old.offer_price;
    new.purchase_price := old.purchase_price;
  end if;

  if new.status = 'submitted' and old.status = 'draft' then
    if coalesce(btrim(new.vin), '') = '' and coalesce(btrim(new.plate), '') = '' then
      raise exception 'FIN oder Kennzeichen fehlt' using errcode = 'check_violation';
    end if;
    if coalesce(btrim(new.seller_name), '') = '' or coalesce(btrim(new.seller_phone), '') = '' then
      raise exception 'Name und Telefon des Verkäufers fehlen' using errcode = 'check_violation';
    end if;
    if not new.gdpr_consent then
      raise exception 'Datenschutz-Einwilligung des Verkäufers fehlt' using errcode = 'check_violation';
    end if;
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

create trigger leads_before_write
  before insert or update on public.leads
  for each row execute function public.leads_before_write();

create policy "leads: read" on public.leads
  for select to authenticated
  using (public.is_admin() or mechanic_id = auth.uid());

create policy "leads: create draft" on public.leads
  for insert to authenticated
  with check (
    mechanic_id = auth.uid()
    and status = 'draft'
    and public.current_app_role() in ('admin', 'mechanic')
  );

create policy "leads: admin update" on public.leads
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "leads: mechanic edits own draft" on public.leads
  for update to authenticated
  using (mechanic_id = auth.uid() and status = 'draft' and public.current_app_role() is not null)
  with check (mechanic_id = auth.uid() and status in ('draft', 'submitted'));

create policy "leads: delete" on public.leads
  for delete to authenticated
  using (public.is_admin() or (mechanic_id = auth.uid() and status = 'draft'));

-- ---------------------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------------------
create table public.lead_photos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  field_key text not null,
  path text not null,
  thumb_path text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index lead_photos_lead_idx on public.lead_photos (lead_id, created_at);

alter table public.lead_photos enable row level security;

create or replace function public.can_view_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or exists (select 1 from public.leads l where l.id = p_lead and l.mechanic_id = auth.uid())
$$;

create or replace function public.can_edit_lead(p_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or exists (
      select 1 from public.leads l
      where l.id = p_lead and l.mechanic_id = auth.uid() and l.status = 'draft'
    )
$$;

create policy "photos: read" on public.lead_photos
  for select to authenticated
  using (public.can_view_lead(lead_id));

create policy "photos: add" on public.lead_photos
  for insert to authenticated
  with check (public.can_edit_lead(lead_id));

create policy "photos: remove" on public.lead_photos
  for delete to authenticated
  using (public.can_edit_lead(lead_id));

-- ---------------------------------------------------------------------------
-- Grants (explicit, in case new tables are not exposed to the API by default)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.leads, public.lead_photos from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.leads, public.lead_photos to authenticated;
grant all on public.profiles, public.leads, public.lead_photos to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files stored as <lead_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-photos', 'lead-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create policy "lead photos: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lead-photos'
    and public.can_view_lead(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "lead photos: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lead-photos'
    and public.can_edit_lead(public.try_uuid((storage.foldername(name))[1]))
  );

create policy "lead photos: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lead-photos'
    and public.can_edit_lead(public.try_uuid((storage.foldername(name))[1]))
  );
