import { lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, TrendingUp, Clock, GraduationCap, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import StorefrontHeader from "@/components/StorefrontHeader";
import HeroBanner from "@/components/storefront/HeroBanner";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
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
const CategoryCoursesSection = lazy(() => import("@/components/storefront/CategoryCoursesSection"));
const SiteFooter = lazy(() => import("@/components/SiteFooter"));
const HomeReviewsSection = lazy(() => import("@/components/storefront/HomeReviewsSection"));
const HomeInstructorsSection = lazy(() => import("@/components/storefront/HomeInstructorsSection"));
const HomeNoticeSection = lazy(() => import("@/components/storefront/HomeNoticeSection"));
const HomeCtaSection = lazy(() => import("@/components/storefront/HomeCtaSection"));

interface CourseRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  price: number;
  sale_price: number | null;
  sale_ends_at: string | null;
  rating_avg: number;
  rating_count: number;
  enrolled_count: number;
  category_id: string | null;
  instructor_id: string | null;
}

const StorefrontHome = () => {
  const { user } = useUser();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: enrolledIds = new Set<string>() } = useEnrolledCourseIds();



  const { data: categories = [] } = useQuery({
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

  const { data: featuredCourses = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["store-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, price, sale_price, sale_ends_at, rating_avg, rating_count, enrolled_count, category_id, instructor_id")
        .eq("is_b2c", true)
        .eq("status", "published")
        .order("enrolled_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as CourseRow[];
    },
  });

  const { data: newCourses = [] } = useQuery({
    queryKey: ["store-new"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, price, sale_price, sale_ends_at, rating_avg, rating_count, enrolled_count, category_id, instructor_id")
        .eq("is_b2c", true)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data as CourseRow[];
    },
  });

  const allInstructorIds = [...new Set([...featuredCourses, ...newCourses].map(c => c.instructor_id).filter(Boolean))];
  const { data: instructors = [] } = useQuery({
    queryKey: ["store-instructors", allInstructorIds],
    queryFn: async () => {
      if (allInstructorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", allInstructorIds as string[]);
      if (error) throw error;
      return data;
    },
    enabled: allInstructorIds.length > 0,
  });

  const categoryMap = new Map(localizedCategories.map((c: any) => [c.id, c.name]));
  const instructorMap = new Map(instructors.map(i => [i.user_id, i.full_name]));

  const { data: wishlistIds = [] } = useQuery({
    queryKey: ["my-wishlists", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("course_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map(w => w.course_id);
    },
    enabled: !!user?.id,
  });

  const wishlistSet = new Set(wishlistIds);

  const toggleWishlist = useMutation({
    mutationFn: async (courseId: string) => {
      if (wishlistSet.has(courseId)) {
        await supabase.from("wishlists").delete().eq("user_id", user!.id).eq("course_id", courseId);
      } else {
        await supabase.from("wishlists").insert({ user_id: user!.id, course_id: courseId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-wishlists"] });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const mapCourse = (c: CourseRow) => ({
    id: c.id,
    title: c.title,
    thumbnail_url: c.thumbnail_url,
    price: c.price,
    sale_price: c.sale_price,
    sale_ends_at: c.sale_ends_at,
    rating_avg: c.rating_avg,
    rating_count: c.rating_count,
    enrolled_count: c.enrolled_count,
    category_name: c.category_id ? categoryMap.get(c.category_id) || null : null,
    instructor_name: c.instructor_id ? instructorMap.get(c.instructor_id) || null : null,
  });

  // Category icon config: colorful rounded-square style like app icons
  const categoryStyles: { icon: typeof GraduationCap; bg: string; iconColor: string }[] = [
    { icon: GraduationCap, bg: "hsl(260 30% 62%)", iconColor: "#fff" },
    { icon: TrendingUp, bg: "hsl(210 30% 58%)", iconColor: "#fff" },
    { icon: Flame, bg: "hsl(15 30% 60%)", iconColor: "#fff" },
    { icon: Sparkles, bg: "hsl(330 28% 60%)", iconColor: "#fff" },
    { icon: Clock, bg: "hsl(170 25% 55%)", iconColor: "#fff" },
  ];

  if (featuredLoading) {
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
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-105"
                    style={{ background: style.bg }}
                  >
                    <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" style={{ color: style.iconColor }} strokeWidth={1.6} />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    ) : null;

  const renderCourses = (title?: string | null, subtitle?: string | null) => (
    <div key="courses">
      {featuredCourses.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pt-14 pb-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {title || "지금 가장 주목받는 강의"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{subtitle || "실시간 인기 과정을 확인하세요"}</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
              <Link to="/store/courses">
                전체 보기 <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredCourses.map((c, idx) => (
              <StorefrontCourseCard
                key={c.id}
                course={mapCourse(c)}
                rank={idx + 1}
                isInWishlist={wishlistSet.has(c.id)}
                isEnrolled={enrolledIds.has(c.id)}
                onWishlistToggle={(id) => toggleWishlist.mutate(id)}
              />
            ))}
          </div>
        </section>
      )}

      {newCourses.length > 0 && (
        <section className="bg-accent/30">
          <div className="max-w-6xl mx-auto px-4 py-14">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">새로 오픈한 강의</h2>
                <p className="text-sm text-muted-foreground mt-1">최신 과정을 놓치지 마세요</p>
              </div>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
                <Link to="/store/courses">
                  전체 보기 <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {newCourses.map((c) => (
                <StorefrontCourseCard
                  key={c.id}
                  course={mapCourse(c)}
                  isInWishlist={wishlistSet.has(c.id)}
                  isEnrolled={enrolledIds.has(c.id)}
                  onWishlistToggle={(id) => toggleWishlist.mutate(id)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {localizedCategories.length > 0 && (
        <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-14 min-h-[400px]" />}>
          <CategoryCoursesSection
            categories={localizedCategories}
            wishlistSet={wishlistSet}
            enrolledIds={enrolledIds}
            onWishlistToggle={(id) => toggleWishlist.mutate(id)}
          />
        </Suspense>
      )}
    </div>
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
