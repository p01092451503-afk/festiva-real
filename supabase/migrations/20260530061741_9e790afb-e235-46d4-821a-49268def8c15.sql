GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_assignments TO authenticated;
GRANT ALL ON public.correction_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_assignment_targets TO authenticated;
GRANT ALL ON public.correction_assignment_targets TO service_role;