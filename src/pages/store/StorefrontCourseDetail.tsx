import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Heart, Star, Users, ShoppingBag, Play, Clock, BarChart3,
  ChevronDown, ChevronUp, CheckCircle2, Lock, Eye, Share2, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StorefrontHeader from "@/components/StorefrontHeader";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useDemoPreset } from "@/contexts/DemoPresetContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { formatPrice, formatDurationMinutes, cn } from "@/lib/utils";

const StorefrontCourseDetail = () => {
  const { courseId: id } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { getCourseTitle, getCourseThumbnail } = useDemoPreset();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [curriculumExpanded, setCurriculumExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"intro" | "instructor" | "curriculum" | "reviews" | "textbook">("intro");

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
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            <div className="lg:col-span-3 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="aspect-video w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
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

  const tabItems = [
    { key: "intro" as const, label: "소개" },
    { key: "curriculum" as const, label: `커리큘럼 (${contents.length})` },
    { key: "reviews" as const, label: `수강 후기 (${reviews.length})` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      {/* Breadcrumb */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/store" className="hover:text-foreground transition-colors">홈</Link>
          <span>/</span>
          <Link to="/store/courses" className="hover:text-foreground transition-colors">전체 과정</Link>
          {(course as any).categories?.name && (
            <>
              <span>/</span>
              <span>{(course as any).categories.name}</span>
            </>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* weolbu-style layout: left image + right sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Left: Thumbnail + Info */}
          <div className="lg:col-span-3 space-y-6">
            {/* Thumbnail */}
            {(getCourseThumbnail(course.id, course.thumbnail_url) || course.thumbnail_url) ? (
              <div className="rounded-2xl overflow-hidden aspect-video">
                <img src={getCourseThumbnail(course.id, course.thumbnail_url)!} alt={getCourseTitle(course.id, course.title)} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl aspect-video bg-gradient-to-br from-accent to-muted flex items-center justify-center">
                <BookOpen className="h-16 w-16 text-muted-foreground/30" strokeWidth={1} />
              </div>
            )}

            {/* Reviews below thumbnail (weolbu style) */}
            {reviews.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">베스트 수강 후기</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviews.slice(0, 4).map((review: any) => (
                    <div key={review.id} className="rounded-xl border border-border p-4 space-y-3">
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

          {/* Right: Sticky Sidebar (weolbu style) */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* Title & badges */}
              <div className="space-y-3">
                {(course as any).categories?.name && (
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">{(course as any).categories.name}</Badge>
                  </div>
                )}
                <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug tracking-tight">
                  {getCourseTitle(course.id, course.title)}
                </h1>
                {course.subtitle && <p className="text-sm text-muted-foreground">{course.subtitle}</p>}

                {/* Rating */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn("h-4 w-4", i < Math.round(course.rating_avg) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/20")} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{course.rating_avg.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">{course.rating_count.toLocaleString()}개 후기</span>
                </div>

                {/* Share button */}
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

              {/* Price section */}
              <div className="space-y-1">
                {isFree ? (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white text-base px-3 py-1">무료</Badge>
                ) : (
                  <>
                    {isSaleActive && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-destructive">{discountPct}%</span>
                        <span className="text-sm text-muted-foreground line-through">{formatPrice(course.price)}</span>
                      </div>
                    )}
                    <p className="text-3xl font-extrabold text-foreground tracking-tight">{formatPrice(displayPrice)}</p>
                  </>
                )}
              </div>

              <Separator />

              {/* Course meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>총 {formatDurationMinutes(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>{contents.length}개 차시</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{course.enrolled_count.toLocaleString()}명 수강</span>
                </div>
                {course.difficulty_level && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    <span>{course.difficulty_level}</span>
                  </div>
                )}
              </div>

              {/* Instructor */}
              {instructor && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={instructor.avatar_url || undefined} />
                    <AvatarFallback className="bg-accent text-sm">
                      {(instructor.full_name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{instructor.full_name}</p>
                    <p className="text-xs text-muted-foreground">강사</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                {isEnrolled ? (
                  <Button className="w-full h-12 text-base rounded-xl" onClick={() => navigate(`/student/courses/${id}`)}>
                    <Play className="h-4 w-4 mr-2" /> 학습하기
                  </Button>
                ) : (
                  <>
                    <Button className="w-full h-12 text-base rounded-xl" onClick={handleBuyNow}>
                      {isFree ? "무료로 시작하기" : "바로 구매"}
                    </Button>
                    {!isFree && (
                      <Button variant="outline" className="w-full h-12 rounded-xl" onClick={handleAddToCart} disabled={isInCart || addToCartMutation.isPending}>
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        {isInCart ? "장바구니에 있음" : "장바구니 담기"}
                      </Button>
                    )}
                  </>
                )}

                <div className="flex items-center justify-center">
                  <button
                    onClick={() => {
                      if (!user) { toast.error("로그인이 필요합니다"); navigate("/auth"); return; }
                      wishlistMutation.mutate();
                    }}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    <Heart className={cn("h-4 w-4", isInWishlist ? "fill-destructive text-destructive" : "")} />
                    {isInWishlist ? "찜 해제" : "찜하기"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs section — full width below */}
        <div className="mt-12">
          {/* Tab navigation — sticky */}
          <div className="sticky top-0 z-30 bg-background border-b border-border -mx-4 px-4">
            <div className="flex gap-0">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-5 py-3.5 text-sm font-medium transition-colors relative",
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
          <div className="py-8 max-w-4xl">
            {activeTab === "intro" && (
              <div className="space-y-8">
                {course.description && (
                  <div className="prose prose-sm max-w-none text-foreground">
                    <p className="whitespace-pre-wrap leading-relaxed">{course.description}</p>
                  </div>
                )}

                {detailBlocks.map((block) => (
                  <div key={block.id} className="space-y-3">
                    {block.title && <h3 className="text-lg font-bold text-foreground">{block.title}</h3>}
                    {block.block_type === "text" && block.content && (
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>
                    )}
                    {block.block_type === "image" && block.image_url && (
                      <img src={block.image_url} alt={block.title || ""} className="rounded-xl w-full" loading="lazy" />
                    )}
                    {block.block_type === "checklist" && block.checklist_items && (
                      <ul className="space-y-2">
                        {block.checklist_items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
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
          <div className="flex-1">
            <p className="text-lg font-bold text-foreground">{isFree ? "무료" : formatPrice(displayPrice)}</p>
          </div>
          {isEnrolled ? (
            <Button size="lg" className="rounded-xl" onClick={() => navigate(`/student/courses/${id}`)}>
              <Play className="h-4 w-4 mr-1" /> 학습하기
            </Button>
          ) : (
            <>
              {!isFree && (
                <Button variant="outline" size="lg" className="rounded-xl" onClick={handleAddToCart} disabled={isInCart}>
                  <ShoppingBag className="h-4 w-4" />
                </Button>
              )}
              <Button size="lg" className="rounded-xl" onClick={handleBuyNow}>
                {isFree ? "무료 시작" : "바로 구매"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StorefrontCourseDetail;
