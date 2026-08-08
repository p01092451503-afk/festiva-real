import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Megaphone, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Home block: latest published announcements. */
const HomeNoticeSection = ({ title, subtitle }: { title?: string | null; subtitle?: string | null }) => {
  const { data: notices = [] } = useQuery({
    queryKey: ["home-notices"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, created_at, is_pinned")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return data ?? [];
    },
  });

  if (notices.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-muted-foreground" />
            {title || "공지사항"}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <Link to="/student/announcements" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          전체 보기 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <ul className="border-t border-border">
        {notices.map((n: any) => (
          <li key={n.id} className="border-b-2 border-border/80">
            <Link to="/student/announcements" className="flex items-center justify-between gap-4 py-4 min-w-0">
              <span className="truncate text-sm">{n.title}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(n.created_at).toLocaleDateString("ko-KR")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default HomeNoticeSection;
