import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import StorefrontHeader from "@/components/StorefrontHeader";
import StorefrontCourseCard from "@/components/storefront/StorefrontCourseCard";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCourseIds";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const StorefrontCatalog = () => {
  const { user } = useUser();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
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
        .select("id, title, thumbnail_url, price, sale_price, sale_ends_at, rating_avg, rating_count, enrolled_count, category_id, instructor_id, status, created_at")
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground">과정 탐색</h1>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-video rounded-xl" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                {search ? "검색 결과가 없습니다" : "공개된 과정이 없습니다"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map(course => (
                  <StorefrontCourseCard
                    key={course.id}
                    course={course}
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
