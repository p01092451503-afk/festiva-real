import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Heart, Star, Users, ShoppingBag, Play, Clock, BarChart3,
  ChevronDown, ChevronUp, CheckCircle2, Lock, Eye, Share2, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageLoading from "@/components/PageLoading";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StorefrontHeader from "@/components/StorefrontHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useDemoPreset } from "@/contexts/DemoPresetContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { formatPrice, formatDurationMinutes, cn } from "@/lib/utils";
import SaleStatusCta, { isPurchasable, saleCtaLabel, SaleStatusBadge } from "@/components/storefront/SaleStatusCta";

const StorefrontCourseDetail = () => {
  const { courseId: id } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { isAdmin, isTeacher } = useUserRole();
  const { getCourseTitle, getCourseThumbnail } = useDemoPreset();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [curriculumExpanded, setCurriculumExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"intro" | "instructor" | "curriculum" | "reviews" | "textbook" | "refund">("intro");

  // Course
  const { data: course, isLoading } = useQuery({
    queryKey: ["store-course-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, categories(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Instructor
  const { data: instructor } = useQuery({
    queryKey: ["store-instructor", course?.instructor_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, position, department")
        .eq("user_id", course!.instructor_id!)
        .single();
      return data;
    },
    enabled: !!course?.instructor_id,
  });

  // Contents (curriculum)
  const { data: contents = [] } = useQuery({
    queryKey: ["store-course-contents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_contents")
        .select("id, title, duration_minutes, content_type, is_preview, is_published")
        .eq("course_id", id!)
        .eq("is_published", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Detail blocks
  const { data: detailBlocks = [] } = useQuery({
    queryKey: ["store-course-blocks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_detail_blocks")
        .select("*")
        .eq("course_id", id!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ["store-course-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles:user_id(full_name, avatar_url)")
        .eq("course_id", id!)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Wishlist check
  const { data: isInWishlist } = useQuery({
    queryKey: ["store-wishlist-check", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", user!.id)
        .eq("course_id", id!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!id,
  });

  // Enrollment check
  const { data: enrollment } = useQuery({
    queryKey: ["store-enrollment-check", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("user_id", user!.id)
        .eq("course_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!id,
  });

  // Cart check
  const { data: isInCart } = useQuery({
    queryKey: ["store-cart-check", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cart_items")
        .select("id")
        .eq("user_id", user!.id)
        .eq("course_id", id!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id && !!id,
  });

  // Add to cart
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      // 이미 수강 중인지 서버에서 재확인
      const { data: existingEnrollment } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("user_id", user!.id)
        .eq("course_id", id!)
        .eq("status", "approved")
        .maybeSingle();
      if (existingEnrollment) {
        throw new Error("ALREADY_ENROLLED");
      }
      const { error } = await supabase.from("cart_items").insert({ user_id: user!.id, course_id: id! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-cart-check", id] });
      queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      queryClient.invalidateQueries({ queryKey: ["cart-items"] });
      toast.success("장바구니에 추가되었습니다");
    },
    onError: (err: any) => {
      if (err?.message === "ALREADY_ENROLLED") {
        toast.error("이미 수강 중인 강의입니다. 장바구니에 담을 수 없습니다.");
      } else {
        toast.error("장바구니 추가에 실패했습니다");
      }
    },
  });

  // Wishlist toggle
  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (isInWishlist) {
        await supabase.from("wishlists").delete().eq("user_id", user!.id).eq("course_id", id!);
      } else {
        await supabase.from("wishlists").insert({ user_id: user!.id, course_id: id! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-wishlist-check", id] });
      toast.success(isInWishlist ? "찜 목록에서 제거되었습니다" : "찜 목록에 추가되었습니다");
    },
  });

  const isSaleActive = course?.sale_price != null && (!course?.sale_ends_at || new Date(course.sale_ends_at) > new Date());
  const displayPrice = isSaleActive ? course!.sale_price! : (course?.price ?? 0);
  const isFree = displayPrice === 0;
  const isEnrolled = enrollment?.status === "approved";
  const discountPct = isSaleActive ? Math.round((1 - course!.sale_price! / course!.price) * 100) : 0;

  const totalDuration = contents.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);

  const handleAddToCart = () => {
    if (!user) { navigate("/auth"); return; }
    if (isEnrolled) { toast.info("이미 수강 중인 과정입니다"); return; }
    addToCartMutation.mutate();
  };

  const handleBuyNow = async () => {
    if (!user) { navigate("/auth"); return; }
    if (isEnrolled) { navigate(`/student/courses/${id}`); return; }

    // 중복 주문 체크: pending 상태의 같은 과목 주문이 있는지 확인
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, order_items(course_id)")
      .eq("user_id", user.id)
      .eq("status", "pending");

    const hasPending = (pendingOrders || []).some((o: any) =>
      (o.order_items || []).some((oi: any) => oi.course_id === id)
    );

    if (hasPending) {
      toast.error("이미 결제 대기 중인 강의입니다. 주문 내역을 확인해주세요.");
      return;
    }

    const checkoutData = {
      items: [{
        course_id: id!,
        title: course?.title ?? "",
        thumbnail_url: course?.thumbnail_url ?? null,
        price: course?.price ?? 0,
        sale_price: isSaleActive ? course!.sale_price : null,
      }],
      couponId: null,
      discountAmount: 0,
      totalAmount: displayPrice,
      finalAmount: displayPrice,
    };
    localStorage.setItem("checkout_data", JSON.stringify(checkoutData));
    navigate("/checkout");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <PageLoading size="lg" />
        </main>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader />
        <main className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground text-lg">과정을 찾을 수 없습니다</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/store/courses")}>
            과정 탐색으로 돌아가기
          </Button>
        </main>
      </div>
    );
  }

  const c: any = course;
  const hasTextbook = !!(c.textbook_title || c.textbook_author || c.textbook_image_url || c.textbook_description);
  const tabItems = [
    { key: "intro" as const, label: "소개" },
    { key: "curriculum" as const, label: `커리큘럼 (${contents.length})` },
    { key: "instructor" as const, label: "강사 소개" },
    ...(hasTextbook ? [{ key: "textbook" as const, label: "교재 정보" }] : []),
    { key: "reviews" as const, label: `수강 후기 (${reviews.length})` },
    { key: "refund" as const, label: "환불·배송 안내" },
  ];


  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      {/* Breadcrumb */}
      <div className="border-b border-border/60 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/store" className="hover:text-foreground transition-colors">홈</Link>
          <span className="text-muted-foreground/40">/</span>
          <Link to="/store/courses" className="hover:text-foreground transition-colors">전체 과정</Link>
          {(course as any).categories?.name && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground/80 font-medium">{(course as any).categories.name}</span>
            </>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        {/* Mega title — full width above hero */}
        <header className="mb-6 sm:mb-8 max-w-5xl">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            {(course as any).categories?.name && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-foreground text-background font-semibold tracking-wide">
                {(course as any).categories.name}
              </span>
            )}
            {instructor?.full_name && (
              <span className="text-primary font-semibold">{instructor.full_name}</span>
            )}
            <span className="text-muted-foreground/40">|</span>
            <span className="text-muted-foreground">정규 교육과정</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-foreground leading-[1.2] tracking-tight">
            {getCourseTitle(course.id, course.title)}
          </h1>
          {course.subtitle && (
            <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
              {course.subtitle}
            </p>
          )}
        </header>

        {/* Hero layout: left thumbnail + right sticky purchase card */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10 items-start">

          {/* Left: Thumbnail + Info + Tabs */}
          <div className="lg:col-span-3 space-y-6 min-w-0">

            {/* Thumbnail */}
            {(getCourseThumbnail(course.id, course.thumbnail_url) || course.thumbnail_url) ? (
              <div className="rounded-2xl overflow-hidden aspect-video shadow-[0_16px_48px_-20px_hsl(var(--foreground)/0.18)] ring-1 ring-border/40">
                <img src={getCourseThumbnail(course.id, course.thumbnail_url)!} alt={getCourseTitle(course.id, course.title)} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl aspect-video bg-gradient-to-br from-accent via-muted to-accent/50 flex items-center justify-center ring-1 ring-border/40 shadow-[0_16px_48px_-20px_hsl(var(--foreground)/0.12)]">
                <BookOpen className="h-16 w-16 text-muted-foreground/25" strokeWidth={1} />
              </div>
            )}

            {/* Quick highlights — fills space under thumbnail */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border/70 bg-card px-4 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Duration</span>
                <span className="text-sm font-semibold text-foreground">{formatDurationMinutes(totalDuration)}</span>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Lessons</span>
                <span className="text-sm font-semibold text-foreground">{contents.length}개 차시</span>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Students</span>
                <span className="text-sm font-semibold text-foreground">{course.enrolled_count.toLocaleString()}명</span>
              </div>
              <div className="rounded-xl border border-border/70 bg-card px-4 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Level</span>
                <span className="text-sm font-semibold text-foreground capitalize">{course.difficulty_level || "All"}</span>
              </div>
            </div>




            {/* Reviews below thumbnail */}
            {reviews.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">베스트 수강 후기</h3>
                  <span className="text-xs text-muted-foreground">{reviews.length}건</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviews.slice(0, 4).map((review: any) => (
                    <div key={review.id} className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 hover:border-foreground/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={review.profiles?.avatar_url} />
                          <AvatarFallback className="text-xs bg-accent">
                            {(review.profiles?.full_name || "U")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {review.profiles?.full_name || "익명"}
                          </p>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={cn("h-3 w-3", i < review.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/20")} />
                            ))}
                            <span className="text-xs font-medium text-foreground ml-1">{review.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">{review.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Sticky purchase card */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8">
              <div className="rounded-2xl border border-border/70 bg-card p-6 space-y-5 shadow-[0_8px_30px_-12px_hsl(var(--foreground)/0.12)]">
                {/* Compact title repeat + meta */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    {instructor?.full_name && (
                      <span className="text-primary font-semibold">{instructor.full_name}</span>
                    )}
                    <span className="text-muted-foreground/40">|</span>
                    <span className="text-muted-foreground">정규 교육과정</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug tracking-tight line-clamp-2">
                    {getCourseTitle(course.id, course.title)}
                  </h2>

                  {/* Rating + Share */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(course.rating_avg) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/25")} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{course.rating_avg.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({course.rating_count.toLocaleString()})</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("링크가 복사되었습니다");
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" /> 공유
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Course structure row — like reference '차시 | 총 8강 > 26차시' */}
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-muted-foreground">차시</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    총 {contents.length}차시 · {formatDurationMinutes(totalDuration)}
                  </span>
                </div>

                <Separator />

                {/* Price section */}
                <div className="space-y-2">
                  {isFree ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-green-600 tracking-tight">무료</span>
                      <span className="text-sm text-muted-foreground">평생 수강</span>
                    </div>
                  ) : (
                    <>
                      {isSaleActive && (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-bold tabular-nums">
                            {discountPct}% OFF
                          </span>
                          <span className="text-sm text-muted-foreground line-through tabular-nums">{formatPrice(course.price)}</span>
                        </div>
                      )}
                      <p className="text-3xl font-extrabold text-foreground tracking-tight tabular-nums">{formatPrice(displayPrice)}</p>
                      {displayPrice >= 12000 && (
                        <p className="text-xs text-muted-foreground">
                          12개월 무이자 할부시 <span className="font-bold text-foreground tabular-nums">월 {formatPrice(Math.round(displayPrice / 12 / 100) * 100)}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>


                {/* Course meta */}
                {/* Meta grid — compact */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-xl bg-muted/40 p-3.5 text-[13px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-foreground/80 truncate tabular-nums">{course.enrolled_count.toLocaleString()}명 수강</span>
                  </div>
                  {course.difficulty_level && (
                    <div className="flex items-center gap-2 min-w-0">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-foreground/80 truncate capitalize">{course.difficulty_level}</span>
                    </div>
                  )}
                </div>

                {/* Action row — 판매 상태(오픈알림·사전신청·신청하기·신청마감·품절) 반영 */}
                {isEnrolled ? (
                  <div className="flex items-stretch gap-2 pt-1">
                    <Button className="flex-1 h-12 text-base rounded-xl font-semibold" onClick={() => navigate(`/student/courses/${id}`)}>
                      <Play className="h-4 w-4 mr-2" /> 학습하기
                    </Button>
                  </div>
                ) : (
                  <SaleStatusCta courseId={id} info={course as any} className="pt-1">
                    <div className="flex items-stretch gap-2">
                      <button
                        onClick={() => {
                          if (!user) { toast.error("로그인이 필요합니다"); navigate("/auth"); return; }
                          wishlistMutation.mutate();
                        }}
                        aria-label={isInWishlist ? "찜 해제" : "찜하기"}
                        className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border border-border hover:bg-accent transition-colors"
                      >
                        <Heart className={cn("h-5 w-5", isInWishlist ? "fill-destructive text-destructive" : "text-muted-foreground")} />
                      </button>
                      {!isFree && (
                        <button
                          onClick={handleAddToCart}
                          disabled={isInCart || addToCartMutation.isPending}
                          aria-label={isInCart ? "장바구니에 있음" : "장바구니 담기"}
                          className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border border-border hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          <ShoppingBag className={cn("h-5 w-5", isInCart ? "text-foreground" : "text-muted-foreground")} />
                        </button>
                      )}
                      <Button className="flex-1 h-12 text-base rounded-xl font-bold shadow-sm" onClick={handleBuyNow}>
                        {saleCtaLabel(course?.sale_status, isFree)}
                      </Button>
                    </div>
                  </SaleStatusCta>
                )}

              </div>
            </div>
          </div>
        </div>


        {/* Tabs section — full width below */}
        <div className="mt-6">
          {/* Tab navigation — sticky */}
          <div className="sticky top-0 z-30 bg-background border-b border-border -mx-4 px-4">
            <div className="flex gap-0">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-6 py-4 text-base font-semibold transition-colors relative",
                    activeTab === tab.key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="py-6">
            {activeTab === "intro" && (
              <div className="space-y-8">
                {course.description && (
                  <div className="prose prose-sm max-w-none text-foreground">
                    <p className="whitespace-pre-wrap leading-relaxed">{course.description}</p>
                  </div>
                )}

                {detailBlocks.map((block: any) => {
                  if (block.block_type === "heading") {
                    return (
                      <h3 key={block.id} className="text-xl font-bold text-foreground pt-4 border-l-4 border-foreground pl-4">
                        {block.title || ""}
                      </h3>
                    );
                  }
                  if (block.block_type === "video" && block.video_url) {
                    const url: string = block.video_url;
                    let embed = url;
                    if (block.video_provider === "youtube") {
                      const m = url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
                      if (m) embed = `https://www.youtube.com/embed/${m[1]}`;
                    } else if (block.video_provider === "vimeo") {
                      const m = url.match(/vimeo\.com\/(\d+)/);
                      if (m) embed = `https://player.vimeo.com/video/${m[1]}`;
                    }
                    const isFile = block.video_provider === "cdn";
                    return (
                      <div key={block.id} className="space-y-3">
                        {block.title && <h3 className="text-lg font-bold text-foreground">{block.title}</h3>}
                        <div className="aspect-video rounded-xl overflow-hidden bg-black">
                          {isFile ? (
                            <video src={url} controls className="w-full h-full" />
                          ) : (
                            <iframe src={embed} title={block.title || "intro video"} className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen />
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={block.id} className="space-y-3">
                      {block.title && block.block_type !== "image" && (
                        <h3 className="text-lg font-bold text-foreground">{block.title}</h3>
                      )}
                      {block.block_type === "text" && block.content && (
                        <p className="text-foreground/80 whitespace-pre-wrap leading-relaxed">{block.content}</p>
                      )}
                      {block.block_type === "image" && block.image_url && (
                        <img src={block.image_url} alt={block.title || ""} className="rounded-xl w-full" loading="lazy" />
                      )}
                      {block.block_type === "checklist" && block.checklist_items && (
                        <ul className="space-y-2">
                          {block.checklist_items.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-foreground/80">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {!course.description && detailBlocks.length === 0 && (
                  <div className="border border-dashed border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
                    아직 등록된 소개 내용이 없습니다.
                  </div>
                )}
              </div>
            )}

            {activeTab === "curriculum" && (
              <div className="space-y-1">
                <button
                  onClick={() => setCurriculumExpanded(!curriculumExpanded)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                >
                  {curriculumExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {contents.length}개 차시 · 총 {formatDurationMinutes(totalDuration)}
                </button>

                {curriculumExpanded && (
                  <div className="space-y-0.5">
                    {contents.map((content, idx) => (
                      <div key={content.id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-accent/50 transition-colors">
                        <span className="text-xs font-medium text-muted-foreground w-6 text-right shrink-0 tabular-nums">{idx + 1}</span>
                        {content.is_preview ? (
                          <Eye className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className="text-sm text-foreground flex-1 truncate">{content.title.replace(/^\d+차시\.\s*/, "")}</span>
                        {content.duration_minutes && (
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{content.duration_minutes}분</span>
                        )}
                        {content.is_preview && (
                          <Badge variant="outline" className="text-[10px] shrink-0">미리보기</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "instructor" && (
              <div className="space-y-6">
                {instructor ? (
                  <div className="flex items-start gap-5 p-6 rounded-2xl border border-border bg-accent/30">
                    <Avatar className="h-20 w-20 shrink-0">
                      <AvatarImage src={instructor.avatar_url || undefined} />
                      <AvatarFallback className="bg-accent text-xl">
                        {(instructor.full_name || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{instructor.full_name}</h3>
                        {(instructor as any).position && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {(instructor as any).position}
                            {(instructor as any).department ? ` · ${(instructor as any).department}` : ""}
                          </p>
                        )}
                      </div>
                      {c.instructor_bio ? (
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pt-2">{c.instructor_bio}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground pt-2">등록된 강사 소개가 없습니다.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm py-12 text-center">강사 정보가 없습니다</p>
                )}
              </div>
            )}

            {activeTab === "textbook" && (
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                  <div className="bg-accent/40 p-6 flex items-center justify-center">
                    {c.textbook_image_url ? (
                      <img src={c.textbook_image_url} alt={c.textbook_title || "교재"} className="max-h-64 w-auto rounded-lg shadow-md" loading="lazy" />
                    ) : (
                      <BookOpen className="h-24 w-24 text-muted-foreground/30" strokeWidth={1} />
                    )}
                  </div>
                  <div className="md:col-span-2 p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{c.textbook_title || "교재"}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        {c.textbook_author && <span>저자 · {c.textbook_author}</span>}
                        {c.textbook_publisher && <span>출판사 · {c.textbook_publisher}</span>}
                        {c.textbook_isbn && <span>ISBN · {c.textbook_isbn}</span>}
                      </div>
                    </div>
                    {c.textbook_price != null && (
                      <p className="text-lg font-bold text-foreground">{formatPrice(c.textbook_price)}</p>
                    )}
                    {c.textbook_description && (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.textbook_description}</p>
                    )}
                    {c.textbook_purchase_url && (
                      <a
                        href={c.textbook_purchase_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        교재 구매하기 <Share2 className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">아직 리뷰가 없습니다</p>
                ) : (
                  reviews.map((review: any) => (
                    <div key={review.id} className="py-5 border-b border-border last:border-0">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={review.profiles?.avatar_url} />
                          <AvatarFallback className="text-xs bg-accent">
                            {(review.profiles?.full_name || "U")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{review.profiles?.full_name || "익명"}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={cn("h-3 w-3", i < review.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/20")} />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-sm text-foreground leading-relaxed">{review.content}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "refund" && (
              <div className="space-y-6 text-sm leading-relaxed">
                <section className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
                  <h3 className="text-base font-bold text-foreground">수강 안내</h3>
                  <ul className="space-y-2 text-foreground/80">
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>결제 완료 후 즉시 수강이 가능합니다.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>수강 기간 내 PC·모바일에서 무제한 반복 학습이 가능합니다.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>강의 자료(PDF·교재 등)는 마이페이지에서 다운로드할 수 있습니다.</span></li>
                  </ul>
                </section>
                <section className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
                  <h3 className="text-base font-bold text-foreground">환불 정책</h3>
                  <ul className="space-y-2 text-foreground/80">
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>학습 이력이 없는 경우, 결제일로부터 7일 이내 100% 환불.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>7일 경과 또는 학습 이력 발생 시, 잔여 차시 비율에 따라 부분 환불.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>전체 차시의 50% 이상 수강 시 환불이 제한될 수 있습니다.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>환불 요청은 마이페이지 &gt; 결제 내역에서 신청 가능합니다.</span></li>
                  </ul>
                </section>
                <section className="rounded-2xl border border-border/70 bg-card p-6 space-y-3">
                  <h3 className="text-base font-bold text-foreground">교재·배송 안내</h3>
                  <ul className="space-y-2 text-foreground/80">
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>교재 포함 옵션 구매 시, 결제일 기준 영업일 1~3일 내 발송됩니다.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>도서·산간 지역은 1~2일 추가 소요될 수 있습니다.</span></li>
                    <li className="flex gap-2"><span className="text-muted-foreground/60">·</span><span>교재 개봉·필기 후에는 환불이 제한됩니다.</span></li>
                  </ul>
                </section>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Mobile fixed bottom bar */}
      {isMobile && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (!user) { navigate("/auth"); return; }
              wishlistMutation.mutate();
            }}
            className="flex flex-col items-center justify-center px-2"
          >
            <Heart className={cn("h-5 w-5", isInWishlist ? "fill-destructive text-destructive" : "text-muted-foreground")} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-foreground">{isFree ? "무료" : formatPrice(displayPrice)}</p>
            <SaleStatusBadge status={course?.sale_status} />
          </div>
          {isEnrolled ? (
            <Button size="lg" className="rounded-xl" onClick={() => navigate(`/student/courses/${id}`)}>
              <Play className="h-4 w-4 mr-1" /> 학습하기
            </Button>
          ) : isPurchasable(course?.sale_status) ? (
            <>
              {!isFree && (
                <Button variant="outline" size="lg" className="rounded-xl" onClick={handleAddToCart} disabled={isInCart}>
                  <ShoppingBag className="h-4 w-4" />
                </Button>
              )}
              <Button size="lg" className="rounded-xl" onClick={handleBuyNow}>
                {saleCtaLabel(course?.sale_status, isFree)}
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="rounded-xl"
              disabled={course?.sale_status !== "open_alert"}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              {saleCtaLabel(course?.sale_status, isFree)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default StorefrontCourseDetail;
