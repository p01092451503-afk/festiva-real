
-- Allow anonymous users to view active departments (for signup branch selection)
CREATE POLICY "Anon can view active departments"
ON public.departments
FOR SELECT
TO anon
USING (is_active = true);

-- Update handle_new_user to set department_id from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, department_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.raw_user_meta_data->>'department_id' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'department_id')::uuid
         ELSE NULL
    END
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  INSERT INTO public.user_gamification (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$function$;
