import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MainPageBlock = {
  id: string;
  block_type: string;
  title: string | null;
  subtitle: string | null;
  config: any;
  display_order: number | null;
};

/** Active main page blocks configured in 디자인 관리. */
export const useMainPageBlocks = () =>
  useQuery({
    queryKey: ["main-page-blocks-active"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("main_page_blocks")
        .select("id, block_type, title, subtitle, config, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MainPageBlock[];
    },
  });
