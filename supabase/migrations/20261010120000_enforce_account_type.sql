-- Enforce account type: every account is exactly "operator" or "customer",
-- set at sign-up and never changeable by the user.
--   * Customer accounts can never read or write Operator data.
--   * Operator accounts may also use the Customer-side tables (own rows only).
-- Admin/compliance access rules are unchanged.
-- Undo: supabase/undo-account-type.sql

-- 1. The current account's type, read live from auth.users (never from a
--    possibly stale sign-in token). NULL when signed out.
create or replace function public.account_type()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.raw_app_meta_data ->> 'account_type' from auth.users u where u.id = auth.uid()
$$;
revoke all on function public.account_type() from public;
grant execute on function public.account_type() to anon, authenticated;

-- 2. Sign-up: copy the type chosen at sign-up (user metadata "account_type")
--    into app_metadata, which users cannot edit. Only "operator" or
--    "customer" are accepted; anything else (or nothing) rejects the sign-up.
create or replace function public.set_account_type_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen text := new.raw_user_meta_data ->> 'account_type';
begin
  if chosen is null or chosen not in ('operator', 'customer') then
    raise exception 'account_type must be "operator" or "customer" (got %)', coalesce(chosen, 'none')
      using errcode = 'check_violation';
  end if;
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('account_type', chosen);
  return new;
end
$$;
drop trigger if exists set_account_type_on_signup on auth.users;
create trigger set_account_type_on_signup
  before insert on auth.users
  for each row execute function public.set_account_type_on_signup();

-- 3. Existing accounts (decided from the data on 2026-10-10, confirmed by the
--    owner): both are Operators.
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"account_type":"operator"}'::jsonb
  where id in ('97504fe8-f7b9-475e-830b-ed271b91db44', 'cc4604be-1a76-4a7a-b8c4-16da40c7b99f');

-- 4. The type can never change once set. An update that drops it keeps the
--    old value; an update that changes it is rejected. (Maintenance escape
--    hatch, for a database admin only: set_config('solo.allow_account_type_change','on',true).)
create or replace function public.protect_account_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_type text := old.raw_app_meta_data ->> 'account_type';
  new_type text := new.raw_app_meta_data ->> 'account_type';
begin
  if old_type is null or coalesce(current_setting('solo.allow_account_type_change', true), '') = 'on' then
    return new;
  end if;
  if new_type is null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('account_type', old_type);
  elsif new_type <> old_type then
    raise exception 'account_type cannot be changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
drop trigger if exists protect_account_type on auth.users;
create trigger protect_account_type
  before update on auth.users
  for each row execute function public.protect_account_type();

-- 5. Operator data: only "operator" accounts (own rows, as before).
alter policy operators_select_own on public.operators using ((auth.uid() = id) and (select public.account_type()) = 'operator');
alter policy operators_insert_own on public.operators with check ((auth.uid() = id) and (select public.account_type()) = 'operator');
alter policy operators_update_own on public.operators using ((auth.uid() = id) and (select public.account_type()) = 'operator');
alter policy operators_delete_own on public.operators using ((auth.uid() = id) and (select public.account_type()) = 'operator');

alter policy documents_select_own on public.documents using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy documents_insert_own on public.documents with check ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy documents_update_own on public.documents using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy documents_delete_own on public.documents using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');

alter policy operators_select_own_shifts on public.operator_shifts using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy operators_insert_own_shifts on public.operator_shifts with check ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy operators_update_own_shifts on public.operator_shifts using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');

alter policy trips_select_own on public.trips using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy trips_insert_own on public.trips with check ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy trips_update_own on public.trips using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy trips_delete_own on public.trips using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');

alter policy operators_select_own_documents_objects on storage.objects using ((bucket_id = 'documents') and ((storage.foldername(name))[1] = (auth.uid())::text) and (select public.account_type()) = 'operator');
alter policy operators_insert_own_documents_objects on storage.objects with check ((bucket_id = 'documents') and ((storage.foldername(name))[1] = (auth.uid())::text) and (select public.account_type()) = 'operator');
alter policy operators_update_own_documents_objects on storage.objects using ((bucket_id = 'documents') and ((storage.foldername(name))[1] = (auth.uid())::text) and (select public.account_type()) = 'operator');

-- Operator side of the shared trip tables.
alter policy operators_insert_own_responses on public.trip_request_responses with check ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy operators_select_own_responses on public.trip_request_responses using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy operators_select_matched_trip_requests on public.trip_requests using ((auth.uid() = matched_operator_id) and (select public.account_type()) = 'operator');
alter policy operators_update_matched_trip_requests on public.trip_requests using ((auth.uid() = matched_operator_id) and (select public.account_type()) = 'operator');
alter policy operators_select_own_received_ratings on public.trip_ratings using ((auth.uid() = operator_id) and (select public.account_type()) = 'operator');
alter policy users_select_own_safety_incidents on public.safety_incidents using (
  ((auth.uid() = operator_id) and (select public.account_type()) = 'operator')
  or ((auth.uid() = rider_id) and (select public.account_type()) in ('customer', 'operator')));
alter policy trip_participants_insert_panic_events on public.panic_events with check (
  (triggered_by_id = auth.uid()) and (
    ((triggered_by = 'rider') and (select public.account_type()) in ('customer', 'operator') and exists (
      select 1 from public.trip_requests tr where tr.id = panic_events.trip_request_id and tr.rider_id = auth.uid()))
    or ((triggered_by = 'operator') and (select public.account_type()) = 'operator' and exists (
      select 1 from public.trip_requests tr where tr.id = panic_events.trip_request_id and tr.matched_operator_id = auth.uid()))));

-- 6. Customer-side tables: "customer" and "operator" accounts, own rows only.
alter policy "Riders can view own profile" on public.riders using ((auth.uid() = id) and (select public.account_type()) in ('customer', 'operator'));
alter policy "Riders can insert own profile" on public.riders with check ((auth.uid() = id) and (select public.account_type()) in ('customer', 'operator'));
alter policy "Riders can update own profile" on public.riders using ((auth.uid() = id) and (select public.account_type()) in ('customer', 'operator'));
alter policy riders_insert_own_trip_requests on public.trip_requests with check ((auth.uid() = rider_id) and (select public.account_type()) in ('customer', 'operator'));
alter policy riders_select_own_trip_requests on public.trip_requests using ((auth.uid() = rider_id) and (select public.account_type()) in ('customer', 'operator'));
alter policy riders_update_own_trip_requests on public.trip_requests using ((auth.uid() = rider_id) and (select public.account_type()) in ('customer', 'operator'));
alter policy riders_insert_own_trip_ratings on public.trip_ratings with check ((auth.uid() = rider_id) and (select public.account_type()) in ('customer', 'operator'));
alter policy riders_select_own_trip_ratings on public.trip_ratings using ((auth.uid() = rider_id) and (select public.account_type()) in ('customer', 'operator'));
alter policy riders_select_own_request_candidates on public.trip_request_candidates using ((select public.account_type()) in ('customer', 'operator') and exists (
  select 1 from public.trip_requests tr where tr.id = trip_request_candidates.trip_request_id and tr.rider_id = auth.uid()));
alter policy riders_select_own_request_responses on public.trip_request_responses using ((select public.account_type()) in ('customer', 'operator') and exists (
  select 1 from public.trip_requests tr where tr.id = trip_request_responses.trip_request_id and tr.rider_id = auth.uid()));
