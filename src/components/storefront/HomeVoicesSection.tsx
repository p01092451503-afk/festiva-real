import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Quote, Star, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";



/** 수강 후기 홈 섹션 (support_reviews 기반) */
const HomeVoicesSection = () => {
  const { data: reviews = [] } = useQuery({
    queryKey: ["home-support-reviews"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_reviews")
        .select("id, author_label, course_label, rating, content, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) return [];
      return data ?? [];
    },
  });

  if (!Array.isArray(reviews) || reviews.length === 0) return null;

  return (
    <section className="bg-gradient-to-b from-background via-brand-blue-light/30 to-background">
      <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">

        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold text-brand-orange">Reviews</span>
          <h2 className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.5] text-foreground">
            수강생이 남긴 실제 후기
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
            축제 기획·운영 실무자들의 학습 경험을 확인해 보세요.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r: any) => (
            <article key={r.id} className="rounded-3xl overflow-hidden bg-background flex flex-col shadow-[0_18px_50px_-32px_hsl(var(--navy)/0.4)] ring-1 ring-border/60">
              <div className="px-8 pt-8 pb-6">
                <Quote className="w-7 h-7 text-navy/40" aria-hidden="true" />
                <p className="mt-3 text-base font-semibold text-navy">{r.course_label || "축제운영전문가 과정"}</p>
              </div>
              <div className="px-8 pb-8 flex-1 flex flex-col">
                <div className="flex items-center gap-1" aria-label={`평점 ${r.rating ?? 5}점`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < (r.rating ?? 5) ? "fill-brand-orange text-brand-orange" : "text-border"}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="mt-4 text-base text-foreground/85 leading-relaxed flex-1">{r.content}</p>
                <p className="mt-5 pt-4 border-t border-border/70 text-sm text-muted-foreground">
                  {r.author_label}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/support?tab=reviews"
            className="inline-flex items-center gap-1.5 text-base font-medium text-navy hover:text-brand-orange transition-colors"
          >
            후기 전체 보기
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomeVoicesSection;
