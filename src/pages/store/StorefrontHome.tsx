import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StorefrontHeader from "@/components/StorefrontHeader";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
import HeroBanner from "@/components/storefront/HeroBanner";
import { StorefrontHomeSkeleton } from "@/components/PageSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useInlineEnName } from "@/hooks/useI18nMaps";
import { useMainPageBlocks, type MainPageBlock } from "@/hooks/useMainPageBlocks";
import SitePopups from "@/components/storefront/SitePopups";
import DOMPurify from "dompurify";

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
  },
  {
    name: "보령 머드축제",
    location: "충남 보령시",
    month: "7월",
    icon: "🌊",
    bg: "bg-brand-orange/10",
    iconColor: "text-brand-orange",
  },
  {
    name: "진해 군항제",
    location: "경남 창원시",
    month: "4월",
    icon: "🌸",
    bg: "bg-brand-pink-light",
    iconColor: "text-primary",
  },
];

const StorefrontHome = () => {
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
  const localizeCatName = useInlineEnName();
  const localizedCategories = categories.map((c: any) => ({ ...c, name: localizeCatName(c) }));


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
            <div
              key={festival.name}
              className="bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            >
              <div className={`h-32 ${festival.bg} flex items-center justify-center`}>
                <span className={`text-5xl ${festival.iconColor}`}>{festival.icon}</span>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-foreground">{festival.name}</h3>
                <p className="text-base text-muted-foreground mt-1">
                  {festival.location} · {festival.month}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderBlock = (b: MainPageBlock) => {
    switch (b.block_type) {
      case "hero":
        return <div key={b.id}>{renderHero()}</div>;
      case "categories":
        return <div key={b.id}>{renderCategories()}</div>;
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
