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
                  <div className="relative overflow-hidden">
                    {/* pastel lilac / periwinkle satin base */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(125deg, #dfe4fb 0%, #e6e3fb 30%, #dcd8f7 55%, #cfd7f7 78%, #e9e6fc 100%)",
                      }}
                    />
                    {/* soft light bloom */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(110% 85% at 22% 12%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.15) 45%, transparent 72%)",
                      }}
                    />

                    {/* flowing silk ribbons */}
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 1440 560"
                      preserveAspectRatio="xMidYMid slice"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="silkA" x1="0%" y1="0%" x2="100%" y2="60%">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                          <stop offset="45%" stopColor="rgba(214,222,255,0.55)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                        </linearGradient>
                        <linearGradient id="silkB" x1="10%" y1="100%" x2="90%" y2="0%">
                          <stop offset="0%" stopColor="rgba(186,178,240,0.45)" />
                          <stop offset="55%" stopColor="rgba(255,255,255,0.45)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                        </linearGradient>
                        <linearGradient id="silkC" x1="0%" y1="50%" x2="100%" y2="50%">
                          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                          <stop offset="40%" stopColor="rgba(255,255,255,0.7)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                        </linearGradient>
                        <filter id="silkSoft" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="6" />
                        </filter>
                      </defs>

                      {/* broad diagonal drape */}
                      <g filter="url(#silkSoft)">
                        <path
                          d="M-120 430 C 220 330 420 250 700 150 C 940 66 1180 30 1560 -30 L1560 90 C1200 140 980 190 740 270 C 470 360 240 470 -120 540 Z"
                          fill="url(#silkA)"
                          opacity="0.9"
                        />
                        <path
                          d="M-140 560 C 260 470 520 380 820 250 C 1080 138 1300 90 1580 40 L1580 150 C1280 200 1060 260 820 360 C 540 476 300 540 -140 620 Z"
                          fill="url(#silkB)"
                          opacity="0.75"
                        />
                      </g>

                      {/* crisp specular edges */}
                      <path
                        d="M-120 452 C 240 352 460 268 740 168 C 980 84 1200 46 1580 -12"
                        fill="none"
                        stroke="url(#silkC)"
                        strokeWidth="2"
                      />
                      <path
                        d="M-120 500 C 260 402 500 314 780 214 C 1020 130 1240 92 1580 40"
                        fill="none"
                        stroke="url(#silkC)"
                        strokeWidth="1.2"
                        opacity="0.7"
                      />
                      <path
                        d="M-120 372 C 220 282 440 206 720 108 C 960 26 1200 -10 1580 -66"
                        fill="none"
                        stroke="url(#silkC)"
                        strokeWidth="1"
                        opacity="0.55"
                      />

                      {/* faint vertical light shafts */}
                      <g opacity="0.28">
                        <rect x="205" y="0" width="1.5" height="560" fill="rgba(255,255,255,0.8)" />
                        <rect x="1235" y="0" width="1.5" height="560" fill="rgba(255,255,255,0.6)" />
                      </g>

                      {/* wide arc, bottom right */}
                      <path
                        d="M1560 210 C 1300 300 1080 420 940 580"
                        fill="none"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                      />
                    </svg>

                    {/* legibility veil behind copy */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(60% 55% at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 60%, transparent 80%)",
                      }}
                    />

                    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 text-center sm:py-20 md:py-28">
                      <h2 className="text-4xl font-bold leading-[1.3] tracking-tight text-navy-dark sm:text-5xl md:text-[3.6rem]">
                        축제 기획부터 평가까지
                        <br />
                        실무 전문가를 양성하는 자격증 과정
                      </h2>
                      <div className="mx-auto mt-6 max-w-2xl space-y-1.5 text-base leading-relaxed text-navy/75 sm:mt-7 sm:text-lg">
                        <p>지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자를 위한</p>
                        <p>대한민국 유일의 온라인 축제전문가 자격증 과정</p>
                      </div>
                      <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:mt-11">
                        <Link
                          to="/store/courses"
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-navy-dark"
                        >
                          강의 안내 보기
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/student/certificates"
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-navy/15 bg-white/80 px-8 py-3.5 text-base font-semibold text-navy backdrop-blur-sm transition hover:bg-white"
                        >
                          자격증 신청 및 발급
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/about?tab=system"
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-navy/20 px-8 py-3.5 text-base font-medium text-navy/85 transition hover:bg-white/60"
                        >
                          자격 제도 안내
                        </Link>
                      </div>
                      <div className="mt-12 sm:mt-14">
                        <div className="mx-auto inline-flex flex-wrap items-center justify-center divide-y divide-navy/10 border-y border-navy/10 sm:divide-x sm:divide-y-0">
                          {[
                            { Icon: Layers, strong: "2급·1급", label: "단계별 과정" },
                            { Icon: PlayCircle, strong: "9차시", label: "온라인 강의" },
                            { Icon: BookOpen, strong: "교재 포함", label: "195,000원" },
                          ].map(({ Icon, strong, label }) => (
                            <div key={strong} className="flex items-center gap-3 px-6 py-4 sm:px-8">
                              <Icon className="h-5 w-5 shrink-0 text-navy/60" strokeWidth={1.5} />
                              <span className="text-base text-navy/70 sm:text-lg">
                                <strong className="font-bold text-navy-dark">{strong}</strong> {label}
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
