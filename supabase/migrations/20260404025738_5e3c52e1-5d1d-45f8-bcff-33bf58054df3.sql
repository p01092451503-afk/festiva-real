
-- Allow edge functions (service role) to insert notifications
-- The notifications table already exists but has no INSERT policy
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow service role inserts (for edge functions)
CREATE POLICY "Allow insert for service role"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);
