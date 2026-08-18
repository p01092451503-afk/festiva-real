import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface HeroBannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  cta_url: string | null;
  image_url: string;
  bg_color: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

const staticFallback = [
  {
    id: "fallback-1",
    bg_color: "#1a3a8c",
    image_url: "",
    title: "",
    subtitle: "",
    cta_text: null,
    cta_url: null,
  },
] as unknown as HeroBannerRow[];


const HeroBanner = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: banners = [] } = useQuery({
    queryKey: ["hero-banners-active"],
    queryFn: async () => {
      const now = Date.now();
      const { data, error } = await supabase
        .from("hero_banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data as HeroBannerRow[]).filter((b) => {
        const startsOk = !b.starts_at || new Date(b.starts_at).getTime() <= now;
        const endsOk = !b.ends_at || new Date(b.ends_at).getTime() >= now;
        return startsOk && endsOk && !!b.image_url;
      });
    },
    staleTime: 60 * 1000,
  });

  const list = banners.length > 0 ? banners : staticFallback;
  const isFallback = banners.length === 0;

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || list.length <= 1) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [emblaApi, list.length]);

  return (
    <section className="relative w-full">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {list.map((banner, idx) => {
            const hasImage = !isFallback && !!banner.image_url;
            const Wrapper: any = banner.cta_url ? Link : "div";
            const wrapperProps = banner.cta_url ? { to: banner.cta_url } : {};
            return (
              <Wrapper
                key={banner.id}
                {...wrapperProps}
                className="relative flex-[0_0_100%] min-w-0 block"
                style={{ backgroundColor: banner.bg_color || "#1a1a2e" }}
              >
                {hasImage && (
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading={idx === 0 ? "eager" : "lazy"}
                    {...({ fetchpriority: idx === 0 ? "high" : "auto" } as any)}
                    decoding={idx === 0 ? "sync" : "async"}
                    width={1920}
                    height={600}
                  />
                )}
                {hasImage && (banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 bg-black/30" />
                )}
                {isFallback ? (
                  <div className="relative overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(115deg, hsl(var(--navy-dark)) 0%, hsl(var(--navy)) 55%, hsl(var(--brand-blue)) 130%)" }}
                    />
                    <div className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full bg-white/[0.06]" />
                    <div className="pointer-events-none absolute right-24 bottom-[-160px] h-[280px] w-[280px] rounded-full bg-white/[0.04]" />
                    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 md:py-24">
                      <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-white/60 uppercase mb-4 sm:mb-5">
                        Festival Expert Certification
                      </p>
                      <h2 className="text-white font-bold tracking-tight text-2xl sm:text-4xl md:text-[2.9rem] leading-[1.28]">
                        축제 기획부터 평가까지
                        <br />
                        <span className="text-brand-orange">실무 문서</span>를 만드는 자격증
                      </h2>
                      <div className="mt-6 sm:mt-8 space-y-1.5 text-white/75 text-sm sm:text-base leading-relaxed">
                        <p>지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자를 위한</p>
                        <p className="text-white/60">대한민국 유일의 온라인 축제전문가 자격증 과정</p>
                      </div>
                      <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3">
                        <Link
                          to="/store/courses"
                          className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-6 py-2.5 text-sm font-semibold text-brand-orange-foreground transition hover:opacity-90"
                        >
                          강의 안내 보기
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/about"
                          className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                        >
                          자격 제도 안내
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16 sm:py-20 md:py-24 min-h-[320px] sm:min-h-[380px]">
                  {banner.title && (
                    <h2 className="text-lg sm:text-3xl md:text-4xl font-bold text-white leading-snug tracking-tight mb-4 whitespace-pre-line drop-shadow">
                      {banner.title}
                    </h2>
                  )}
                  {banner.subtitle && (
                    <p className="text-white/80 text-sm sm:text-base max-w-xl whitespace-pre-line mb-6 leading-relaxed drop-shadow">
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.cta_text && banner.cta_url && (
                    <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-foreground text-sm font-medium hover:bg-white/90 transition">
                      {banner.cta_text}
                    </span>
                  )}
                </div>
                )}

              </Wrapper>
            );
          })}
        </div>
      </div>

      {list.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === selectedIndex ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/40"
                }`}
                aria-label={`배너 ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={scrollPrev}
              className="h-7 w-7 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="이전 배너"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-white" />
            </button>
            <button
              onClick={scrollNext}
              className="h-7 w-7 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="다음 배너"
            >
              <ChevronRight className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroBanner;
