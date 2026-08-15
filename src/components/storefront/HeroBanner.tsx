import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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
    bg_color: "#6C3AED",
    image_url: "",
    title: "이 영역은 메인 비주얼 배너입니다\n고객사 브랜드에 맞게 교체됩니다",
    subtitle: "관리자 대시보드에서 배너 이미지, 타이틀, 설명문구를\n자유롭게 등록하고 순서를 변경할 수 있습니다.",
    cta_text: null,
    cta_url: null,
  },
  {
    id: "fallback-2",
    bg_color: "#1D4ED8",
    image_url: "",
    title: "학습의 시작, 성장의 기록\n맞춤형 이러닝 플랫폼",
    subtitle: "강의 등록부터 수강 관리, 평가와 이수증 발급까지\n하나의 시스템에서 효율적으로 운영하세요.",
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
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16 sm:py-20 md:py-24 min-h-[320px] sm:min-h-[380px]">
                  {isFallback && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20 mb-6">
                      <Sparkles className="h-3 w-3" />
                      ✨ 비주얼 배너 영역
                    </div>
                  )}
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
