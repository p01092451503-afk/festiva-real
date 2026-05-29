import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Heart, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useDemoPreset } from "@/contexts/DemoPresetContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const categoryBgColors: Record<string, string> = {
  // 기존 분류
  "마케팅": "#e8d5c4",
  "개발": "#c4d4e0",
  "디자인": "#d4c4d9",
  "비즈니스": "#c8d5c4",
  "자기계발": "#d9d4c4",
  "재무": "#c4d0d5",
  "영상": "#d5c4c4",
  // 노무사 분류
  "노동법": "#d8e3d0",      // 세이지 그린
  "사회보험법": "#cdd9e6",   // 소프트 블루
  "인사노무관리": "#e6d6c4", // 웜 베이지
  "시험전략": "#e2c9c9",     // 더스티 로즈
  "선택과목": "#d6cce0",     // 라벤더 그레이
  // 영문 매핑 (i18n)
  "Labor Law": "#d8e3d0",
  "Social Insurance": "#cdd9e6",
  "HR Management": "#e6d6c4",
  "Exam Strategy": "#e2c9c9",
  "Electives": "#d6cce0",
};

interface StorefrontCourseCardProps {
  course: {
    id: string;
    title: string;
    thumbnail_url?: string | null;
    price: number;
    sale_price?: number | null;
    sale_ends_at?: string | null;
    rating_avg: number;
    rating_count: number;
    enrolled_count: number;
    category_name?: string | null;
    instructor_name?: string | null;
  };
  rank?: number;
  isInWishlist?: boolean;
  onWishlistToggle?: (courseId: string) => void;
}

const StorefrontCourseCard = forwardRef<HTMLAnchorElement, StorefrontCourseCardProps>(({ course, rank, isInWishlist = false, onWishlistToggle }, _ref) => {
  const { user } = useUser();
  const { toast } = useToast();
  const { getCourseTitle, getCourseThumbnail } = useDemoPreset();

  const displayTitle = getCourseTitle(course.id, course.title);
  const displayThumbnail = getCourseThumbnail(course.id, course.thumbnail_url ?? null);

  const isSaleActive = course.sale_price != null && (!course.sale_ends_at || new Date(course.sale_ends_at) > new Date());
  const displayPrice = isSaleActive ? course.sale_price! : course.price;
  const isFree = displayPrice === 0;
  const discountPct = isSaleActive ? Math.round((1 - course.sale_price! / course.price) * 100) : 0;

  const placeholderBg = course.category_name ? categoryBgColors[course.category_name] || "#e5e0da" : "#e5e0da";

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: "로그인이 필요합니다", description: "찜 기능을 이용하려면 로그인해 주세요.", variant: "destructive" });
      return;
    }
    onWishlistToggle?.(course.id);
  };

  return (
    <Link
      to={`/store/courses/${course.id}`}
      className="group block rounded-2xl overflow-hidden bg-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={displayTitle}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] bg-accent overflow-hidden">
        {displayThumbnail ? (
          <img
            src={displayThumbnail}
            alt={displayTitle}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            width={400}
            height={250}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: placeholderBg }}
          >
            <BookOpen className="h-12 w-12 text-foreground/15" strokeWidth={1.2} />
          </div>
        )}

        {/* Dark gradient overlay at bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Wishlist heart */}
        <button
          onClick={handleWishlistClick}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors z-10"
          aria-label={isInWishlist ? "찜 해제" : "찜하기"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isInWishlist ? "fill-white text-white" : "text-white/80"
            )}
          />
        </button>

        {/* Category badge */}
        {course.category_name && (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="text-[10px] bg-white/90 text-foreground hover:bg-white/90 border-0 backdrop-blur-sm font-medium">
              {course.category_name}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2.5">
        {/* Title row with optional rank */}
        <div className="flex items-start gap-2.5">
          {rank != null && (
            <span className="text-2xl font-extrabold text-primary leading-none mt-0.5 shrink-0 tabular-nums">
              {rank}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
              {displayTitle}
            </h3>
            {course.instructor_name && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{course.instructor_name}</p>
            )}
          </div>
        </div>

        {/* Rating & students */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-0.5">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span className="font-semibold text-foreground">{course.rating_avg.toFixed(1)}</span>
            <span>({course.rating_count.toLocaleString()})</span>
          </div>
          <span className="text-border">|</span>
          <span>{course.enrolled_count.toLocaleString()}명 수강</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 pt-0.5">
          {isFree ? (
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">무료</Badge>
          ) : (
            <>
              {isSaleActive && (
                <span className="text-sm font-bold text-destructive">{discountPct}%</span>
              )}
              {isSaleActive && (
                <span className="text-xs text-muted-foreground line-through">
                  {course.price.toLocaleString()}원
                </span>
              )}
              <span className="text-base font-bold text-foreground">
                {displayPrice.toLocaleString()}원
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
});
StorefrontCourseCard.displayName = "StorefrontCourseCard";

export default StorefrontCourseCard;
