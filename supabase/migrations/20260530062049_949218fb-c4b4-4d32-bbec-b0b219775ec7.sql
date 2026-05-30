INSERT INTO public.correction_assignment_targets (assignment_id, student_id, status)
SELECT a.id, 'f61dbfb0-c75c-464d-93e1-2e768c08d273'::uuid, 'assigned'
FROM public.correction_assignments a
WHERE a.title LIKE '[테스트]%'
ON CONFLICT DO NOTHING;