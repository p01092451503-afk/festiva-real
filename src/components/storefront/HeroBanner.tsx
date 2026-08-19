import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Layers, PlayCircle, BookOpen } from "lucide-react";
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
                style={{ backgroundColor: isFallback ? "transparent" : banner.bg_color || "#1a1a2e" }}
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
                  <div className="relative overflow-hidden bg-background">
                    {/* warm cream gradient wash with depth */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #f5efe6 0%, #faf6f0 35%, #fdfbf7 55%, #f0e8dc 100%)",
                      }}
                    />
                    {/* bold navy diagonal accent for strong contrast */}
                    <div
                      className="pointer-events-none absolute -right-[30%] -top-[40%] h-[110%] w-[80%] rotate-12 rounded-[60px]"
                      style={{
                        background: "linear-gradient(160deg, rgba(26,58,140,0.12) 0%, rgba(26,58,140,0.05) 60%, transparent 100%)",
                        filter: "blur(60px)",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute -left-[25%] bottom-[-35%] h-[90%] w-[70%] -rotate-6 rounded-[60px]"
                      style={{
                        background: "linear-gradient(200deg, rgba(26,58,140,0.10) 0%, rgba(26,58,140,0.03) 55%, transparent 100%)",
                        filter: "blur(55px)",
                      }}
                    />
                    {/* warm radial blobs */}
                    <div
                      className="pointer-events-none absolute -left-[10%] -top-[20%] h-[55%] w-[55%] rounded-full blur-3xl"
                      style={{ background: "radial-gradient(circle, rgba(232,221,208,0.65) 0%, transparent 70%)" }}
                    />
                    <div
                      className="pointer-events-none absolute -right-[10%] top-[5%] h-[50%] w-[50%] rounded-full blur-3xl"
                      style={{ background: "radial-gradient(circle, rgba(250,246,240,0.80) 0%, transparent 70%)" }}
                    />
                    {/* stronger orange accent blob */}
                    <div
                      className="pointer-events-none absolute bottom-[-5%] left-[15%] h-[40%] w-[40%] rounded-full blur-3xl"
                      style={{ background: "radial-gradient(circle, rgba(224,90,30,0.14) 0%, transparent 70%)" }}
                    />
                    {/* abstract geometric pattern with higher contrast */}
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
                      viewBox="0 0 1440 520"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="heroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(232,221,208,0.55)" />
                          <stop offset="100%" stopColor="rgba(250,246,240,0.30)" />
                        </linearGradient>
                        <linearGradient id="heroGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(26,58,140,0.18)" />
                          <stop offset="100%" stopColor="rgba(224,90,30,0.10)" />
                        </linearGradient>
                      </defs>
                      <circle cx="180" cy="120" r="100" fill="url(#heroGrad1)" />
                      <circle cx="1260" cy="380" r="140" fill="url(#heroGrad2)" />
                      <circle cx="1100" cy="80" r="70" fill="url(#heroGrad1)" />
                      <circle cx="320" cy="420" r="80" fill="url(#heroGrad2)" />
                      <path
                        d="M-100 260 C 240 180 480 340 1540 200"
                        fill="none"
                        stroke="rgba(232,221,208,0.65)"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M-100 300 C 280 220 560 380 1540 240"
                        fill="none"
                        stroke="rgba(224,90,30,0.18)"
                        strokeWidth="2.5"
                      />
                    </svg>
                    <div className="pointer-events-none absolute -left-32 -top-28 h-[380px] w-[380px] rounded-full bg-[hsl(var(--brand-orange)/0.06)] blur-2xl" />
                    <div className="pointer-events-none absolute -right-24 bottom-[-140px] h-[320px] w-[320px] rounded-full bg-[hsl(var(--brand-blue)/0.08)] blur-2xl" />

                    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 text-center sm:py-20 md:py-24">
                      <span className="inline-flex items-stretch overflow-hidden rounded-sm border border-navy/15 bg-card/70 text-sm">
                        <span className="bg-navy px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white">
                          fest<span className="text-brand-orange">cert</span>
                        </span>
                        <span className="px-4 py-1.5 font-semibold tracking-tight text-navy">
                          축제운영전문가 자격증 교육원
                        </span>
                      </span>

                      <h2 className="mt-6 text-4xl font-bold leading-[1.3] tracking-tight text-foreground sm:text-5xl md:text-[3.6rem]">
                        축제 기획부터 평가까지
                        <br />
                        <span className="text-brand-orange">실무 문서</span>를 만드는 자격증
                      </h2>
                      <div className="mx-auto mt-6 max-w-2xl space-y-1.5 text-base leading-relaxed text-muted-foreground sm:mt-7 sm:text-lg">
                        <p>지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자를 위한</p>
                        <p>대한민국 유일의 온라인 축제전문가 자격증 과정</p>
                      </div>
                      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
                        <Link
                          to="/store/courses"
                          className="inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-navy-dark"
                        >
                          강의 안내 보기
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/student/certificates"
                          className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-7 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-orange/90"
                        >
                          자격증 신청 및 발급
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/about"
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3 text-base font-medium text-foreground transition hover:bg-accent"
                        >
                          자격 제도 안내
                        </Link>
                      </div>
                      <div className="mt-10 sm:mt-12">
                        <div className="mx-auto inline-flex flex-wrap items-center justify-center divide-y divide-border border-y border-navy/15 sm:divide-x sm:divide-y-0">
                          {[
                            { Icon: Layers, strong: "2급·1급", label: "단계별 과정" },
                            { Icon: PlayCircle, strong: "9차시", label: "온라인 강의" },
                            { Icon: BookOpen, strong: "교재 포함", label: "195,000원" },
                          ].map(({ Icon, strong, label }) => (
                            <div key={strong} className="flex items-center gap-3 px-6 py-4 sm:px-8">
                              <Icon className="h-5 w-5 shrink-0 text-navy/70" strokeWidth={1.5} />
                              <span className="text-base text-muted-foreground sm:text-lg">
                                <strong className="font-bold text-navy">{strong}</strong> {label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (

                <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16 sm:py-20 md:py-24 min-h-[320px] sm:min-h-[380px]">
                  {banner.title && (
                    <h2 className="text-xl sm:text-4xl md:text-5xl font-bold text-white leading-snug tracking-tight mb-4 whitespace-pre-line drop-shadow">
                      {banner.title}
                    </h2>
                  )}
                  {banner.subtitle && (
                    <p className="text-white/80 text-base sm:text-lg max-w-xl whitespace-pre-line mb-6 leading-relaxed drop-shadow">
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.cta_text && banner.cta_url && (
                    <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-foreground text-base font-medium hover:bg-white/90 transition">
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
