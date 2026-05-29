import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteSettings {
  id: string;
  header_logo_url: string | null;
  sidebar_logo_url: string | null;
  footer_logo_url: string | null;
  company_name: string | null;
  company_name_en: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  business_number: string | null;
  ceo_name: string | null;
  hours_weekday: string | null;
  hours_weekend: string | null;
  hours_lunch: string | null;
  hours_holiday: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
  blog_url: string | null;
  footer_description: string | null;
  copyright_text: string | null;
  privacy_policy: string | null;
  b2c_enabled: boolean;
  teacher_role_enabled: boolean;
  pwa_app_name: string | null;
  pwa_short_name: string | null;
  pwa_icon_192_url: string | null;
  pwa_icon_512_url: string | null;
  pwa_apple_icon_url: string | null;
  pwa_theme_color: string | null;
  pwa_background_color: string | null;
  hidden_nav_keys: string[];
  updated_at: string;
}

export interface NavItem {
  id: string;
  label: string;
  label_en: string | null;
  url: string;
  position: "header" | "footer";
  sort_order: number;
  is_active: boolean;
  open_in_new_tab: boolean;
}

/** Fetches the single site_settings row. Returns null if not yet seeded. */
export const useSiteSettings = () =>
  useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SiteSettings | null;
    },
    staleTime: 10 * 60 * 1000,
  });

/** Fetches active nav items, optionally scoped by position. */
export const useNavItems = (position?: "header" | "footer") =>
  useQuery({
    queryKey: ["nav-items", position ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("nav_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (position) q = q.eq("position", position);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as NavItem[];
    },
    staleTime: 10 * 60 * 1000,
  });
