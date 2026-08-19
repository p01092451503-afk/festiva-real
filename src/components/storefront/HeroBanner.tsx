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
                    {/* deep blue base */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(115deg, #12306f 0%, #1a3a8c 42%, #23509f 72%, #2b62b4 100%)",
                      }}
                    />
                    {/* soft light source top-center */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 40%, transparent 72%)",
                      }}
                    />
                    {/* floating glass objects, receding diagonally */}
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 1440 560"
                      preserveAspectRatio="xMidYMid slice"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="glassA" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.42)" />
                          <stop offset="45%" stopColor="rgba(198,228,255,0.20)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
                        </linearGradient>
                        <linearGradient id="glassB" x1="100%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(180,214,255,0.30)" />
                          <stop offset="60%" stopColor="rgba(255,255,255,0.10)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
                        </linearGradient>
                        <filter id="glassBlur" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="1.2" />
                        </filter>
                      </defs>

                      {/* left cluster: large -> small, rising to the right */}
                      <g filter="url(#glassBlur)">
                        <g transform="translate(-40 300) rotate(-18)">
                          <rect width="250" height="250" rx="42" fill="url(#glassA)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                        </g>
                        <g transform="translate(190 250) rotate(-18)">
                          <rect width="205" height="205" rx="36" fill="url(#glassB)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" />
                        </g>
                        <g transform="translate(378 214) rotate(-18)">
                          <rect width="164" height="164" rx="30" fill="url(#glassA)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
                        </g>
                        <g transform="translate(524 190) rotate(-18)" opacity="0.75">
                          <rect width="126" height="126" rx="24" fill="url(#glassB)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                        </g>
                        <g transform="translate(634 176) rotate(-18)" opacity="0.5">
                          <rect width="92" height="92" rx="18" fill="url(#glassA)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
                        </g>
                      </g>

                      {/* right cluster: mirrored, descending */}
                      <g filter="url(#glassBlur)">
                        <g transform="translate(1250 210) rotate(-18)">
                          <rect width="260" height="260" rx="44" fill="url(#glassB)" stroke="rgba(255,255,255,0.32)" strokeWidth="1.5" />
                        </g>
                        <g transform="translate(1058 262) rotate(-18)">
                          <rect width="200" height="200" rx="34" fill="url(#glassA)" stroke="rgba(255,255,255,0.24)" strokeWidth="1.3" />
                        </g>
                        <g transform="translate(908 306) rotate(-18)" opacity="0.8">
                          <rect width="150" height="150" rx="28" fill="url(#glassB)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" />
                        </g>
                        <g transform="translate(796 340) rotate(-18)" opacity="0.55">
                          <rect width="108" height="108" rx="20" fill="url(#glassA)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
                        </g>
                      </g>

                      {/* faint horizon lines for depth */}
                      <path d="M-40 452 C 320 404 1120 404 1480 452" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
                      <path d="M-40 486 C 360 442 1080 442 1480 486" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                    </svg>
                    {/* bottom vignette so type stays legible */}
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(70% 60% at 50% 45%, rgba(10,28,68,0.45) 0%, transparent 70%)",
                      }}
                    />

                    <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 text-center sm:py-20 md:py-28">
                      <h2 className="text-4xl font-bold leading-[1.3] tracking-tight text-white sm:text-5xl md:text-[3.6rem]">
                        축제 기획부터 평가까지
                        <br />
                        실무 문서를 만드는 자격증
                      </h2>
                      <div className="mx-auto mt-6 max-w-2xl space-y-1.5 text-base leading-relaxed text-white/80 sm:mt-7 sm:text-lg">
                        <p>지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자를 위한</p>
                        <p>대한민국 유일의 온라인 축제전문가 자격증 과정</p>
                      </div>
                      <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:mt-11">
                        <Link
                          to="/store/courses"
                          className="inline-flex items-center gap-2 rounded-md bg-white px-8 py-3.5 text-base font-semibold text-navy shadow-lg transition hover:bg-white/90"
                        >
                          강의 안내 보기
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/student/certificates"
                          className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-navy-dark/60 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-navy-dark/80"
                        >
                          자격증 신청 및 발급
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                        <Link
                          to="/about?tab=system"
                          className="inline-flex items-center gap-2 rounded-md border border-white/20 px-8 py-3.5 text-base font-medium text-white/90 transition hover:bg-white/10"
                        >
                          자격 제도 안내
                        </Link>
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
