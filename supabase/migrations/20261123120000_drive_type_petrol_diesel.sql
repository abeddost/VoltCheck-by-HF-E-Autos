-- Allow petrol and diesel cars. 'ice' stays valid for inspections created before this change.
alter table public.leads drop constraint if exists leads_drive_type_check;
alter table public.leads
  add constraint leads_drive_type_check
  check (drive_type in ('bev', 'phev', 'hev', 'petrol', 'diesel', 'ice'));
