
CREATE TABLE public.traffic_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  event_type text NOT NULL,
  page_path text,
  content_id uuid,
  course_id uuid,
  estimated_bytes bigint DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_traffic_logs_created_at ON public.traffic_logs (created_at);
CREATE INDEX idx_traffic_logs_event_type ON public.traffic_logs (event_type);

ALTER TABLE public.traffic_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all traffic logs"
  ON public.traffic_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert traffic logs"
  ON public.traffic_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
