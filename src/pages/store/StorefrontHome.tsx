import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StorefrontHeader from "@/components/StorefrontHeader";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
import HeroBanner from "@/components/storefront/HeroBanner";
import { StorefrontHomeSkeleton } from "@/components/PageSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

import { useMainPageBlocks, type MainPageBlock } from "@/hooks/useMainPageBlocks";
import SitePopups from "@/components/storefront/SitePopups";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import hwacheonImg from "@/assets/festival-hwacheon.png.asset.json";
import boryeongImg from "@/assets/festival-boryeong-mud.jpg.asset.json";
import jinhaeImg from "@/assets/festival-jinhae.png.asset.json";


// Lazy-load below-the-fold sections to reduce initial JS bundle
const SiteFooter = lazy(() => import("@/components/SiteFooter"));
const HomeReviewsSection = lazy(() => import("@/components/storefront/HomeReviewsSection"));
const HomeInstructorsSection = lazy(() => import("@/components/storefront/HomeInstructorsSection"));
const HomeNoticeSection = lazy(() => import("@/components/storefront/HomeNoticeSection"));
const HomeCtaSection = lazy(() => import("@/components/storefront/HomeCtaSection"));
const HomeCourseFeatureSection = lazy(() => import("@/components/storefront/HomeCourseFeatureSection"));
const HomeWhySection = lazy(() => import("@/components/storefront/HomeWhySection"));
const HomeVoicesSection = lazy(() => import("@/components/storefront/HomeVoicesSection"));
const HomeSupportSection = lazy(() => import("@/components/storefront/HomeSupportSection"));
const HomeCourseGuideCta = lazy(() => import("@/components/storefront/HomeCourseGuideCta"));


const FESTIVALS = [
  {
    name: "화천 산천어축제",
    location: "강원도 화천군",
    month: "1월",
    imageUrl: hwacheonImg.url,
    period: "매년 1월 초 ~ 1월 하순 (약 23일간)",
    summary:
      "얼음으로 덮인 화천천 위에서 열리는 국내 대표 겨울 축제입니다. 얼음낚시를 중심으로 눈·얼음 조형물, 선등거리 등 겨울 콘텐츠를 한곳에 모아 매년 100만 명 이상이 찾습니다.",
    highlights: [
      "얼음낚시터 · 맨손잡기 등 체험형 프로그램 운영",
      "화천천 일대 얼음 안전관리와 구역별 인원 통제가 핵심 과제",
      "선등거리 야간 경관 조명으로 체류 시간 확대",
    ],
    opsPoint:
      "결빙 두께 상시 점검, 구역별 입장 인원 제한, 한파 대비 온열 쉼터 배치가 운영계획서의 필수 항목입니다.",
  },
  {
    name: "보령 머드축제",
    location: "충남 보령시",
    month: "7월",
    imageUrl: boryeongImg.url,
    period: "매년 7월 중순 ~ 하순 (약 10일간)",
    summary:
      "대천해수욕장의 갯벌 진흙을 활용한 체험형 여름 축제로, 외국인 방문객 비중이 가장 높은 축제 중 하나입니다. 머드 체험존과 해변 공연이 결합된 구조입니다.",
    highlights: [
      "머드탕·머드슬라이드 등 대규모 체험 시설 운영",
      "해변 무대 공연과 야간 콘서트로 청년층 집중 유입",
      "다국어 안내와 외국인 전용 안내데스크 운영",
    ],
    opsPoint:
      "샤워·탈의 시설 동선, 응급의료 부스, 해변 안전요원 배치 계획이 안전관리계획의 중심이 됩니다.",
  },
  {
    name: "진해 군항제",
    location: "경남 창원시",
    month: "4월",
    imageUrl: jinhaeImg.url,
    period: "매년 3월 말 ~ 4월 초 (약 10일간)",
    summary:
      "36만여 그루의 벚나무가 만개하는 국내 최대 봄 축제입니다. 여좌천 로망스교, 경화역 등 도심 전역이 축제 공간으로 확장되는 개방형 구조가 특징입니다.",
    highlights: [
      "여좌천·경화역 벚꽃길 야간 개방 및 경관 조명",
      "군악의장 페스티벌 등 해군 연계 특화 프로그램",
      "단기간 대규모 인파가 도심에 집중되는 개방형 축제",
    ],
    opsPoint:
      "일방통행 보행 동선 설계, 대중교통 증편, 혼잡도 실시간 모니터링이 인파 관리의 핵심입니다.",
  },
];


const StorefrontHome = () => {
  const [selectedFestival, setSelectedFestival] = useState<(typeof FESTIVALS)[number] | null>(null);
  const { data: blocks = [] } = useMainPageBlocks();


  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["store-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_en, slug, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });


  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["store-home-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, price, sale_price, sale_ends_at, rating_avg, rating_count, enrolled_count, category_id, instructor_id, sale_status, status")
        .eq("is_b2c", true)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: instructorMap = {} } = useQuery({
    queryKey: ["store-home-instructors", courses.map((c: any) => c.instructor_id).filter(Boolean)],
    queryFn: async () => {
      const ids = [...new Set(courses.map((c: any) => c.instructor_id).filter(Boolean))] as string[];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      data?.forEach((p: any) => { map[p.user_id] = p.full_name || ""; });
      return map;
    },
    enabled: courses.length > 0,
  });

  const categoryMap = categories.reduce((acc: Record<string, string>, c: any) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  if (categoriesLoading || coursesLoading) {
    return <StorefrontHomeSkeleton />;
  }

  const renderHero = () => <HeroBanner key="hero" />;

  /** 강의 썸네일 카드 대신 급수별 과정 특징을 노출한다. */
  const renderFeaturedCourses = () => {
    if (coursesLoading) return <div className="min-h-[300px]" />;
    return (
      <Suspense key="course-feature" fallback={<div className="min-h-[400px]" />}>
        <HomeCourseFeatureSection courses={courses as any} />
      </Suspense>
    );
  };


  const renderFestivals = () => (
    <section key="festivals" className="bg-background">
      <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">

        <div className="mb-10">
          <span className="text-sm font-semibold text-brand-orange">Festival</span>
          <h2 className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.5] text-foreground">
            꼭 가봐야 할 전국 축제
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
            대표 축제의 운영 구조와 실무 포인트를 함께 살펴보세요.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FESTIVALS.map((festival) => (
            <button
              key={festival.name}
              type="button"
              onClick={() => setSelectedFestival(festival)}
              aria-label={`${festival.name} 자세히 보기`}
              className="text-left bg-background rounded-3xl overflow-hidden ring-1 ring-border/60 shadow-[0_18px_50px_-32px_hsl(var(--navy)/0.4)] transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                <img
                  src={festival.imageUrl}
                  alt={festival.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-foreground">{festival.name}</h3>
                <p className="text-base text-muted-foreground mt-1">
                  {festival.location} · {festival.month}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-base font-medium text-muted-foreground hover:text-foreground transition-colors">
                  자세히 보기
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </div>
            </button>
          ))}

        </div>
      </div>
    </section>
  );

  const renderBlock = (b: MainPageBlock) => {
    switch (b.block_type) {
      case "hero":
        return <div key={b.id}>{renderHero()}</div>;
      case "courses":
        return <div key={b.id}>{renderFeaturedCourses()}</div>;
      case "reviews":
        return (
          <Suspense key={b.id} fallback={<div className="min-h-[200px]" />}>
            <HomeReviewsSection title={b.title} subtitle={b.subtitle} />
          </Suspense>
        );
      case "instructors":
        return (
          <Suspense key={b.id} fallback={<div className="min-h-[200px]" />}>
            <HomeInstructorsSection title={b.title} subtitle={b.subtitle} />
          </Suspense>
        );
      case "notice":
        return (
          <Suspense key={b.id} fallback={<div className="min-h-[200px]" />}>
            <HomeNoticeSection title={b.title} subtitle={b.subtitle} />
          </Suspense>
        );
      case "cta":
        return (
          <Suspense key={b.id} fallback={<div className="min-h-[200px]" />}>
            <HomeCtaSection
              title={b.title}
              subtitle={b.subtitle}
              ctaText={b.config?.cta_text}
              ctaUrl={b.config?.cta_url}
            />
          </Suspense>
        );
      case "custom":
        return b.config?.html ? (
          <section key={b.id} className="max-w-6xl mx-auto px-4 py-14">
            {b.title && <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-6">{b.title}</h2>}
            <div
              className="prose max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(String(b.config.html)) }}
            />
          </section>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      <main>
        {blocks.length > 0 ? (
          blocks.map(renderBlock)
        ) : (
          <>
            {renderHero()}
          </>
        )}
        {!blocks.some((b: MainPageBlock) => b.block_type === "courses") && renderFeaturedCourses()}
        <Suspense fallback={<div className="min-h-[160px]" />}>
          <HomeCourseGuideCta />
        </Suspense>
        <Suspense fallback={<div className="min-h-[300px]" />}>
          <HomeWhySection />
        </Suspense>
        <Suspense fallback={<div className="min-h-[300px]" />}>
          <HomeVoicesSection />
        </Suspense>
        <Suspense fallback={<div className="min-h-[240px]" />}>
          <HomeSupportSection />
        </Suspense>
        {renderFestivals()}
      </main>




      {/* Footer */}
      <Suspense fallback={<div className="min-h-[200px]" />}>
        <SiteFooter />
      </Suspense>

      <Dialog open={!!selectedFestival} onOpenChange={(o) => !o && setSelectedFestival(null)}>
        <DialogContent className="max-w-xl">
          {selectedFestival && (
            <>
              <div className="-mx-6 -mt-6 mb-2 aspect-[4/3] w-[calc(100%+3rem)] overflow-hidden rounded-t-lg bg-muted">
                <img
                  src={selectedFestival.imageUrl}
                  alt={selectedFestival.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedFestival.name}</DialogTitle>
                <DialogDescription className="text-sm">
                  {selectedFestival.location} · {selectedFestival.period}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="leading-relaxed text-foreground/90">{selectedFestival.summary}</p>
                <div className="space-y-2">
                  <h4 className="font-semibold text-navy text-sm">주요 특징</h4>
                  <ul className="space-y-2">
                    {selectedFestival.highlights.map((h) => (
                      <li key={h} className="flex gap-2 text-muted-foreground leading-relaxed">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <h4 className="font-semibold text-navy mb-1 text-sm">운영 실무 포인트</h4>
                  <p className="text-muted-foreground leading-relaxed">{selectedFestival.opsPoint}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <SitePopups />

    </div>
  );
};

export default StorefrontHome;
