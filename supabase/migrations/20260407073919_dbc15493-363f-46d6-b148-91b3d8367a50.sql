
-- Fix FK constraints that block user deletion

-- assignment_submissions.student_id -> CASCADE (submissions belong to the student)
ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT assignment_submissions_student_id_fkey,
  ADD CONSTRAINT assignment_submissions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- assignment_submissions.graded_by -> SET NULL (keep submission, clear grader ref)
ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT assignment_submissions_graded_by_fkey,
  ADD CONSTRAINT assignment_submissions_graded_by_fkey
    FOREIGN KEY (graded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- assignments.created_by -> SET NULL (keep assignment, clear creator ref)
ALTER TABLE public.assignments
  DROP CONSTRAINT assignments_created_by_fkey,
  ADD CONSTRAINT assignments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- attendance.user_id -> CASCADE (attendance records belong to the user)
ALTER TABLE public.attendance
  DROP CONSTRAINT attendance_user_id_fkey,
  ADD CONSTRAINT attendance_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- courses.instructor_id -> SET NULL (keep course, clear instructor ref)
ALTER TABLE public.courses
  DROP CONSTRAINT courses_instructor_id_fkey,
  ADD CONSTRAINT courses_instructor_id_fkey
    FOREIGN KEY (instructor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
