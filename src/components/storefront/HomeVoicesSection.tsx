import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Quote, Star, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TONES = ["bg-brand-blue-light/60", "bg-brand-blue-light/60", "bg-brand-blue-light/60"];

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
    <section className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">수강생 실제 후기</h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            축제 기획·운영 실무자들이 남긴 수강 후기입니다.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r: any, idx: number) => (
            <article key={r.id} className="rounded-2xl border border-border overflow-hidden bg-background flex flex-col">
              <div className={`${TONES[idx % TONES.length]} px-7 pt-7 pb-6`}>
                <Quote className="w-7 h-7 text-navy/40" aria-hidden="true" />
                <p className="mt-3 text-base font-semibold text-navy">{r.course_label || "축제운영전문가 과정"}</p>
              </div>
              <div className="p-7 flex-1 flex flex-col">
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
                <p className="mt-5 pt-4 border-t border-border text-sm text-muted-foreground">
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
