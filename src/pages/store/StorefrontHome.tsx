import { lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, TrendingUp, Clock, GraduationCap, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import StorefrontHeader from "@/components/StorefrontHeader";
import HeroBanner from "@/components/storefront/HeroBanner";
import { StorefrontHomeSkeleton } from "@/components/PageSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { useInlineEnName } from "@/hooks/useI18nMaps";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCourseIds";
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

  // Category icon config: colorful rounded-square style like app icons
  const categoryStyles: { icon: typeof GraduationCap; bg: string; iconColor: string }[] = [
    { icon: GraduationCap, bg: "hsl(260 30% 62%)", iconColor: "#fff" },
    { icon: TrendingUp, bg: "hsl(210 30% 58%)", iconColor: "#fff" },
    { icon: Flame, bg: "hsl(15 30% 60%)", iconColor: "#fff" },
    { icon: Sparkles, bg: "hsl(330 28% 60%)", iconColor: "#fff" },
    { icon: Clock, bg: "hsl(170 25% 55%)", iconColor: "#fff" },
  ];

  if (categoriesLoading) {
    return <StorefrontHomeSkeleton />;
  }

  const renderHero = () => <HeroBanner key="hero" />;

  const renderCategories = () =>
    localizedCategories.length > 0 ? (
      <section key="categories" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-center justify-center gap-8 sm:gap-12 overflow-x-auto scrollbar-hide pb-1">
            {localizedCategories.map((cat: any, idx: number) => {
              const style = categoryStyles[idx % categoryStyles.length];
              const Icon = style.icon;
              return (
                <Link
                  key={cat.id}
                  to={`/store/courses?category=${cat.slug}`}
                  className="flex flex-col items-center gap-3 group shrink-0"
                >
                  <div
                    className="w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-2xl flex items-center justify-center transition-all group-hover:scale-105"
                    style={{ background: style.bg }}
                  >
                    <Icon className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: style.iconColor }} strokeWidth={1.6} />
                  </div>
                  <span className="text-base sm:text-lg font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    ) : null;

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
        return <div key={b.id}>{renderCourses(b.title, b.subtitle)}</div>;
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
            {renderCategories()}
            {renderCourses()}
          </>
        )}
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
