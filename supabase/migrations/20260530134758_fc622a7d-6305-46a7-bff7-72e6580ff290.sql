UPDATE correction_assignment_targets SET request_id = NULL, status = 'assigned', submitted_at = NULL WHERE request_id = 'c355ace4-5c1c-417e-9a6a-934ab61b61dc';
DELETE FROM correction_pages WHERE request_id = 'c355ace4-5c1c-417e-9a6a-934ab61b61dc';
DELETE FROM correction_requests WHERE id = 'c355ace4-5c1c-417e-9a6a-934ab61b61dc';