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


// Lazy-load below-the-fold sections to reduce initial JS bundle
const SiteFooter = lazy(() => import("@/components/SiteFooter"));
const HomeReviewsSection = lazy(() => import("@/components/storefront/HomeReviewsSection"));
const HomeInstructorsSection = lazy(() => import("@/components/storefront/HomeInstructorsSection"));
const HomeNoticeSection = lazy(() => import("@/components/storefront/HomeNoticeSection"));
const HomeCtaSection = lazy(() => import("@/components/storefront/HomeCtaSection"));

const FESTIVALS = [
  {
    name: "화천 산천어축제",
    location: "강원도 화천군",
    month: "1월",
    icon: "🎣",
    bg: "bg-brand-blue-light",
    iconColor: "text-brand-blue",
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
    icon: "🌊",
    bg: "bg-brand-orange/10",
    iconColor: "text-brand-orange",
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
    icon: "🌸",
    bg: "bg-brand-pink-light",
    iconColor: "text-primary",
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

  const renderFeaturedCourses = () => {
    if (coursesLoading) return <div className="min-h-[300px]" />;
    if (!courses.length) return null;
    const featured = courses.slice(0, 2);
    return (
      <section key="featured-courses" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">지금 가장 주목받는 강의</h2>
              <p className="text-base sm:text-lg text-muted-foreground mt-2">실시간 인기 과정을 확인하세요</p>
            </div>
            <Link to="/store/courses" className="hidden sm:flex items-center gap-1 text-base font-medium text-muted-foreground hover:text-foreground transition-colors">
              전체 보기 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {featured.map((course: any, idx: number) => (
              <StorefrontCourseCard
                key={course.id}
                course={{
                  ...course,
                  category_name: categoryMap[course.category_id],
                  instructor_name: instructorMap[course.instructor_id],
                }}
                rank={idx + 1}
                size="lg"
                featured
              />
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderFestivals = () => (
    <section key="festivals" className="bg-accent/30">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-8">
          꼭 가봐야 할 전국 축제
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FESTIVALS.map((festival) => (
            <button
              key={festival.name}
              type="button"
              onClick={() => setSelectedFestival(festival)}
              aria-label={`${festival.name} 자세히 보기`}
              className="text-left bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className={`h-32 ${festival.bg} flex items-center justify-center`}>
                <span className={`text-5xl ${festival.iconColor}`}>{festival.icon}</span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-foreground">{festival.name}</h3>
                <p className="text-base text-muted-foreground mt-1">
                  {festival.location} · {festival.month}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-navy">
                  자세히 보기
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
        {renderFestivals()}
      </main>

      {/* Footer */}
      <Suspense fallback={<div className="min-h-[200px]" />}>
        <SiteFooter />
      </Suspense>

      <SitePopups />
    </div>
  );
};

export default StorefrontHome;
