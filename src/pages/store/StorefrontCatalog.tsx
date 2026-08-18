import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageLoading from "@/components/PageLoading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import StorefrontHeader from "@/components/StorefrontHeader";
import { PageBanner } from "@/components/PagePattern";
import { pageBg } from "@/config/pageBackgrounds";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCourseIds";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

/** 급수(2급/1급) 서브메뉴 — `?level=1|2`로 카테고리를 자동 선택한다. */
const LEVEL_TABS = [
  { value: "all", label: "전체 과정" },
  { value: "2", label: "2급 과정" },
  { value: "1", label: "1급 과정" },
] as const;

const StorefrontCatalog = () => {
  const { user } = useUser();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const level = searchParams.get("level") ?? "all";
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [filterOpen, setFilterOpen] = useState(false);


  const { data: categories = [] } = useQuery({
    queryKey: ["store-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_en, slug")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: rawCourses = [], isLoading } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, price, sale_price, sale_ends_at, rating_avg, rating_count, enrolled_count, category_id, instructor_id, sale_status, status, created_at")
        .eq("is_b2c", true)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: instructorMap = {} } = useQuery({
    queryKey: ["store-instructors", rawCourses.map(c => c.instructor_id).filter(Boolean)],
    queryFn: async () => {
      const ids = [...new Set(rawCourses.map(c => c.instructor_id).filter(Boolean))] as string[];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const map: Record<string, string> = {};
      data?.forEach(p => { map[p.user_id] = p.full_name || ""; });
      return map;
    },
    enabled: rawCourses.length > 0,
  });

  const categoryMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  /** `?level=1|2` → "1급/2급" 카테고리를 자동 선택. 매칭 카테고리가 없으면 전체를 보여준다. */
  useEffect(() => {
    if (level === "all") {
      setSelectedCategory("all");
      return;
    }
    const match = categories.find(c => {
      const hay = `${c.name ?? ""} ${c.slug ?? ""}`.toLowerCase();
      return hay.includes(`${level}급`) || hay.includes(`level-${level}`) || hay.includes(`level${level}`);
    });
    setSelectedCategory(match ? match.id : "all");
  }, [level, categories]);






  const { data: wishlistSet = new Set<string>() } = useQuery({
    queryKey: ["store-wishlist-ids", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("wishlists").select("course_id").eq("user_id", user!.id);
      return new Set((data || []).map(w => w.course_id));
    },
    enabled: !!user?.id,
  });
  const { data: enrolledIds = new Set<string>() } = useEnrolledCourseIds();


  const wishlistToggle = useMutation({
    mutationFn: async (courseId: string) => {
      if (wishlistSet.has(courseId)) {
        await supabase.from("wishlists").delete().eq("user_id", user!.id).eq("course_id", courseId);
      } else {
        await supabase.from("wishlists").insert({ user_id: user!.id, course_id: courseId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-wishlist-ids"] }),
    onError: () => toast.error("오류가 발생했습니다"),
  });

  const handleWishlistToggle = (courseId: string) => {
    if (!user) { toast.error("로그인이 필요합니다"); return; }
    wishlistToggle.mutate(courseId);
  };

  const courses = useMemo(() => {
    let filtered = rawCourses.map(c => ({
      ...c,
      category_name: c.category_id ? categoryMap[c.category_id] : null,
      instructor_name: c.instructor_id ? (instructorMap as Record<string, string>)[c.instructor_id] : null,
    }));

    if (selectedCategory !== "all") {
      filtered = filtered.filter(c => c.category_id === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c => c.title.toLowerCase().includes(q) || c.instructor_name?.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case "popular": return filtered.sort((a, b) => (b.enrolled_count ?? 0) - (a.enrolled_count ?? 0));
      case "rating": return filtered.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
      case "newest":
        return filtered.sort(
          (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        );
      case "price_low": return filtered.sort((a, b) => (a.sale_price ?? a.price ?? 0) - (b.sale_price ?? b.price ?? 0));
      case "price_high": return filtered.sort((a, b) => (b.sale_price ?? b.price ?? 0) - (a.sale_price ?? a.price ?? 0));
      default: return filtered;
    }
  }, [rawCourses, categoryMap, instructorMap, selectedCategory, search, sortBy]);

  const FilterPanel = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">카테고리</h3>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => { setSelectedCategory("all"); setFilterOpen(false); }}
          >
            전체
          </Badge>
          {categories.map(cat => (
            <Badge
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => { setSelectedCategory(cat.id); setFilterOpen(false); }}
            >
              {cat.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      {/* Page banner */}
      <PageBanner
        config={pageBg("courses")}
        as="h2"
        eyebrow="COURSES"
        title="자격증 취득 과정"
        description="2급·1급 단계별 온라인 과정으로 축제 기획·운영·안전관리 실무 문서를 직접 완성합니다."
        containerClassName="max-w-7xl"
      />



      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">강의 안내</h1>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="과정명 또는 강사명 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">인기순</SelectItem>
                <SelectItem value="rating">평점순</SelectItem>
                <SelectItem value="newest">최신순</SelectItem>
                <SelectItem value="price_low">낮은 가격순</SelectItem>
                <SelectItem value="price_high">높은 가격순</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile filter button */}
            {isMobile && (
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>필터</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterPanel />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Desktop filter panel */}
          {!isMobile && (
            <aside className="w-52 shrink-0">
              <FilterPanel />
            </aside>
          )}

          {/* Course grid */}
          <div className="flex-1">
            {isLoading ? (
              <PageLoading size="lg" />
            ) : courses.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                {search ? "검색 결과가 없습니다" : "공개된 과정이 없습니다"}
              </div>
            ) : (
              <div className={courses.length <= 2 ? "grid grid-cols-1 md:grid-cols-2 gap-8" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"}>
                {courses.map(course => (
                  <StorefrontCourseCard
                    key={course.id}
                    course={course}
                    size={courses.length <= 2 ? "lg" : "default"}
                    isInWishlist={wishlistSet.has(course.id)}
                    isEnrolled={enrolledIds.has(course.id)}
                    onWishlistToggle={handleWishlistToggle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StorefrontCatalog;
