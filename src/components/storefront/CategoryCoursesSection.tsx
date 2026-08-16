import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
import { supabase } from "@/integrations/supabase/client";
import { useInlineEnName } from "@/hooks/useI18nMaps";

interface CategoryCoursesProps {
  categories: { id: string; name: string; name_en?: string | null; slug: string }[];
  wishlistSet: Set<string>;
  enrolledIds?: Set<string>;
  onWishlistToggle: (courseId: string) => void;
}

const CategoryCoursesSection = ({ categories, wishlistSet, enrolledIds, onWishlistToggle }: CategoryCoursesProps) => {
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const localizeCatName = useInlineEnName();
  const localizedCategories = categories.map((c: any) => ({ ...c, name: localizeCatName(c) }));

  const selectedCatId = activeCatId || categories[0]?.id || null;

  const { data: courses = [] } = useQuery({
    queryKey: ["store-category-courses", selectedCatId],
    queryFn: async () => {
      if (!selectedCatId) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, price, sale_price, sale_ends_at, rating_avg, rating_count, enrolled_count, category_id, instructor_id, sale_status")
        .eq("is_b2c", true)
        .eq("status", "published")
        .eq("category_id", selectedCatId)
        .order("enrolled_count", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCatId,
  });

  const allInstructorIds = [...new Set(courses.map(c => c.instructor_id).filter(Boolean))];
  const { data: instructors = [] } = useQuery({
    queryKey: ["store-cat-instructors", allInstructorIds],
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

  const selectedSlug = localizedCategories.find((c: any) => c.id === selectedCatId)?.slug;

  return (
    <section className="max-w-6xl mx-auto px-4 pt-14 pb-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            가장 많이 구매한 강의
          </h2>
          <p className="text-sm text-muted-foreground mt-1">카테고리별 인기 과정을 살펴보세요</p>
        </div>
        {selectedSlug && (
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground hover:text-foreground">
            <Link to={`/store/courses?category=${selectedSlug}`}>
              전체 보기 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-1">
        {localizedCategories.map((cat: any) => (
          <button
            key={cat.id}
            onClick={() => setActiveCatId(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              cat.id === selectedCatId
                ? "bg-foreground text-background"
                : "bg-accent text-muted-foreground hover:bg-accent/80"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Course grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {courses.map((c) => (
          <StorefrontCourseCard
            key={c.id}
            course={{
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
            }}
            isInWishlist={wishlistSet.has(c.id)}
            isEnrolled={enrolledIds?.has(c.id)}
            onWishlistToggle={onWishlistToggle}
          />
        ))}
      </div>
    </section>
  );
};

export default CategoryCoursesSection;
