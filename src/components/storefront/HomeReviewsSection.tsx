import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Home block: published course reviews. */
const HomeReviewsSection = ({ title, subtitle }: { title?: string | null; subtitle?: string | null }) => {
  const { data: reviews = [] } = useQuery({
    queryKey: ["home-reviews"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, content, created_at, course_id")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (reviews.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-14">
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title || "수강 후기"}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle || "실제 수강생들의 이야기"}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {reviews.map((r: any) => (
          <div key={r.id} className="border border-border rounded-lg p-5 min-w-0">
            <div className="flex items-center gap-0.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < (r.rating || 0) ? "fill-current text-foreground" : "text-muted-foreground/40"}`} />
              ))}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-4">{r.content}</p>
            <p className="text-xs text-muted-foreground mt-4">
              {new Date(r.created_at).toLocaleDateString("ko-KR")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HomeReviewsSection;
