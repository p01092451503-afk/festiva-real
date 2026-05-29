import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * Batched traffic logger — collects page views and flushes every 10s
 * or on page unload, reducing DB write pressure from N inserts/nav
 * to ~1 insert per 10 seconds per user.
 */

let buffer: Array<{
  user_id: string;
  tenant_id: string | null;
  event_type: string;
  page_path: string;
  estimated_bytes: number;
}> = [];

let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL = 10_000; // 10 seconds

const flushBuffer = async () => {
  if (buffer.length === 0) return;
  const batch = [...buffer];
  buffer = [];
  try {
    await supabase.from("traffic_logs").insert(batch);
  } catch {
    // On failure, don't re-add to buffer to avoid infinite retry loops
  }
};

// Flush on page unload using sendBeacon as last resort
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (buffer.length === 0) return;
    const batch = [...buffer];
    buffer = [];
    // Use sendBeacon for reliability during unload
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/traffic_logs`;
    const headers = {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    try {
      navigator.sendBeacon(
        url,
        new Blob([JSON.stringify(batch)], { type: "application/json" })
      );
    } catch {
      // silently fail
    }
  });
}

export const useTrafficLogger = () => {
  const { user, profile } = useUser();
  const location = useLocation();
  const lastPath = useRef<string>("");

  useEffect(() => {
    if (!user?.id || location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    buffer.push({
      user_id: user.id,
      tenant_id: profile?.tenant_id || null,
      event_type: "page_view",
      page_path: location.pathname,
      estimated_bytes: 5000,
    });

    // Start flush timer if not running
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushBuffer();
      }, FLUSH_INTERVAL);
    }
  }, [location.pathname, user?.id, profile?.tenant_id]);
};

/**
 * Log content access with accurate CDN byte estimation.
 */
export const logContentAccess = async (
  userId: string,
  contentId: string,
  courseId: string,
  contentType: string,
  videoProvider?: string | null,
  tenantId?: string | null,
) => {
  const isExternalVideo =
    videoProvider === "youtube" || videoProvider === "vimeo";
  const isExternalDoc = contentType === "document";

  let byteEstimate = 0;

  if (isExternalVideo || isExternalDoc) {
    byteEstimate = 0;
  } else if (contentType === "video" && videoProvider === "upload") {
    byteEstimate = 50_000_000;
  } else if (contentType === "video" && videoProvider === "custom") {
    byteEstimate = 30_000_000;
  } else {
    byteEstimate = 500_000;
  }

  await supabase.from("traffic_logs").insert({
    user_id: userId,
    tenant_id: tenantId || null,
    event_type: "content_access",
    content_id: contentId,
    course_id: courseId,
    estimated_bytes: byteEstimate,
    metadata: {
      content_type: contentType,
      video_provider: videoProvider || null,
      is_external: isExternalVideo || isExternalDoc,
    },
  });
};
