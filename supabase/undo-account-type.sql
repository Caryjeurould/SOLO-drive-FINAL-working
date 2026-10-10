-- UNDO for supabase/migrations/20261010120000_enforce_account_type.sql
--
-- Restores every access rule that migration changed, exactly as it was before
-- (captured from the live database on 2026-10-10), and removes the
-- account-type trigger and functions it added.
--
-- Run it in the Supabase dashboard → SQL Editor (paste the whole file, Run),
-- or:  psql "$DATABASE_URL" -f supabase/undo-account-type.sql
-- It runs as one transaction: all of it applies, or none of it does.

begin;

-- 1. Access rules, restored verbatim (35).
ALTER POLICY documents_delete_own ON public.documents USING ((auth.uid() = operator_id));
ALTER POLICY documents_insert_own ON public.documents WITH CHECK ((auth.uid() = operator_id));
ALTER POLICY documents_select_own ON public.documents USING ((auth.uid() = operator_id));
ALTER POLICY documents_update_own ON public.documents USING ((auth.uid() = operator_id));
ALTER POLICY operators_insert_own_shifts ON public.operator_shifts WITH CHECK ((auth.uid() = operator_id));
ALTER POLICY operators_select_own_shifts ON public.operator_shifts USING ((auth.uid() = operator_id));
ALTER POLICY operators_update_own_shifts ON public.operator_shifts USING ((auth.uid() = operator_id));
ALTER POLICY operators_delete_own ON public.operators USING ((auth.uid() = id));
ALTER POLICY operators_insert_own ON public.operators WITH CHECK ((auth.uid() = id));
ALTER POLICY operators_select_own ON public.operators USING ((auth.uid() = id));
ALTER POLICY operators_update_own ON public.operators USING ((auth.uid() = id));
ALTER POLICY trip_participants_insert_panic_events ON public.panic_events WITH CHECK (((triggered_by_id = auth.uid()) AND (((triggered_by = 'rider'::text) AND (EXISTS ( SELECT 1
   FROM trip_requests tr
  WHERE ((tr.id = panic_events.trip_request_id) AND (tr.rider_id = auth.uid()))))) OR ((triggered_by = 'operator'::text) AND (EXISTS ( SELECT 1
   FROM trip_requests tr
  WHERE ((tr.id = panic_events.trip_request_id) AND (tr.matched_operator_id = auth.uid()))))))));
ALTER POLICY "Riders can insert own profile" ON public.riders WITH CHECK ((auth.uid() = id));
ALTER POLICY "Riders can update own profile" ON public.riders USING ((auth.uid() = id));
ALTER POLICY "Riders can view own profile" ON public.riders USING ((auth.uid() = id));
ALTER POLICY users_select_own_safety_incidents ON public.safety_incidents USING (((auth.uid() = operator_id) OR (auth.uid() = rider_id)));
ALTER POLICY operators_select_own_received_ratings ON public.trip_ratings USING ((auth.uid() = operator_id));
ALTER POLICY riders_insert_own_trip_ratings ON public.trip_ratings WITH CHECK ((auth.uid() = rider_id));
ALTER POLICY riders_select_own_trip_ratings ON public.trip_ratings USING ((auth.uid() = rider_id));
ALTER POLICY riders_select_own_request_candidates ON public.trip_request_candidates USING ((EXISTS ( SELECT 1
   FROM trip_requests tr
  WHERE ((tr.id = trip_request_candidates.trip_request_id) AND (tr.rider_id = auth.uid())))));
ALTER POLICY operators_insert_own_responses ON public.trip_request_responses WITH CHECK ((auth.uid() = operator_id));
ALTER POLICY operators_select_own_responses ON public.trip_request_responses USING ((auth.uid() = operator_id));
ALTER POLICY riders_select_own_request_responses ON public.trip_request_responses USING ((EXISTS ( SELECT 1
   FROM trip_requests tr
  WHERE ((tr.id = trip_request_responses.trip_request_id) AND (tr.rider_id = auth.uid())))));
ALTER POLICY operators_select_matched_trip_requests ON public.trip_requests USING ((auth.uid() = matched_operator_id));
ALTER POLICY operators_update_matched_trip_requests ON public.trip_requests USING ((auth.uid() = matched_operator_id));
ALTER POLICY riders_insert_own_trip_requests ON public.trip_requests WITH CHECK ((auth.uid() = rider_id));
ALTER POLICY riders_select_own_trip_requests ON public.trip_requests USING ((auth.uid() = rider_id));
ALTER POLICY riders_update_own_trip_requests ON public.trip_requests USING ((auth.uid() = rider_id));
ALTER POLICY trips_delete_own ON public.trips USING ((auth.uid() = operator_id));
ALTER POLICY trips_insert_own ON public.trips WITH CHECK ((auth.uid() = operator_id));
ALTER POLICY trips_select_own ON public.trips USING ((auth.uid() = operator_id));
ALTER POLICY trips_update_own ON public.trips USING ((auth.uid() = operator_id));
ALTER POLICY operators_insert_own_documents_objects ON storage.objects WITH CHECK (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
ALTER POLICY operators_select_own_documents_objects ON storage.objects USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
ALTER POLICY operators_update_own_documents_objects ON storage.objects USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

-- 2. Remove the sign-up type check and the "type can't change" guard.
DROP TRIGGER IF EXISTS set_account_type_on_signup ON auth.users;
DROP TRIGGER IF EXISTS protect_account_type ON auth.users;
DROP FUNCTION IF EXISTS public.set_account_type_on_signup();
DROP FUNCTION IF EXISTS public.protect_account_type();
DROP FUNCTION IF EXISTS public.account_type();

commit;

-- Optional, NOT run by default: also erase the stored type from every account.
-- Leaving it is harmless once the rules above are restored.
--   update auth.users set raw_app_meta_data = raw_app_meta_data - 'account_type';
