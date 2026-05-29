import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Banknote, Layers, Settings2, Info, Plus, Trash2, Save, Loader2, Tag, X,
  Calendar as CalendarIcon, Image as ImageIcon, Video, Paperclip,
} from "lucide-react";

type Tier = {
  id?: string;
  duration_days: number;
  list_price: number;
  sale_price: number;
  points: number;
  display_name: string;
  sort_order: number;
};

interface Props {
  courseId: string;
}

const emptyTier = (sort_order = 0): Tier => ({
  duration_days: 0,
  list_price: 0,
  sale_price: 0,
  points: 0,
  display_name: "",
  sort_order,
});

const PaidCourseSettings = ({ courseId }: Props) => {
  const queryClient = useQueryClient();

  // 기본 정보
  const [baseCategory, setBaseCategory] = useState("정규 교육과정");
  const [courseType, setCourseType] = useState<"single" | "package">("single");
  const [installmentEnabled, setInstallmentEnabled] = useState(true);
  const [installmentMonths, setInstallmentMonths] = useState(12);
  const [retakeEnabled, setRetakeEnabled] = useState(false);
  const [retakePercent, setRetakePercent] = useState(50);
  const [retakeCouponStack, setRetakeCouponStack] = useState(false);
  const [suspensionEnabled, setSuspensionEnabled] = useState(false);
  const [isSequential, setIsSequential] = useState(false);
  const [visibility, setVisibility] = useState<"shown" | "hidden">("shown");
  const [visStart, setVisStart] = useState("");
  const [visEnd, setVisEnd] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  // 운영 정보
  const [alwaysRecruiting, setAlwaysRecruiting] = useState(true);
  const [periodMode, setPeriodMode] = useState(false);
  const [graceDays, setGraceDays] = useState(30);
  const [dailyLimit, setDailyLimit] = useState<number | "">("");

  // 강의 소개
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [introVideoProvider, setIntroVideoProvider] = useState<"cdn" | "youtube" | "vimeo" | "">("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [supportOptions, setSupportOptions] = useState<string[]>([]);
  const [shortIntro, setShortIntro] = useState("");
  const [detailIntro, setDetailIntro] = useState("");

  // SEO
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");

  // 가격 옵션
  const [tiers, setTiers] = useState<Tier[]>([emptyTier(0), emptyTier(1)]);

  // 패키지 구성
  const [packageItems, setPackageItems] = useState<string[]>([]);

  // 강의 + 가격티어 + 패키지 로드
  const { data: course } = useQuery({
    queryKey: ["paid-course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!courseId,
  });

  const { data: existingTiers = [] } = useQuery({
    queryKey: ["course-pricing-tiers", courseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_pricing_tiers")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      return data as Tier[];
    },
    enabled: !!courseId,
  });

  const { data: existingPackage = [] } = useQuery({
    queryKey: ["course-package-items", courseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_package_items")
        .select("child_course_id")
        .eq("package_course_id", courseId)
        .order("sort_order");
      if (error) throw error;
      return (data || []).map((r: any) => r.child_course_id) as string[];
    },
    enabled: !!courseId,
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ["all-courses-for-package"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .neq("id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; title: string }>;
    },
    enabled: !!courseId,
  });

  // hydrate
  useEffect(() => {
    if (!course) return;
    setBaseCategory(course.base_category ?? "정규 교육과정");
    setCourseType((course.course_type ?? "single") as any);
    setInstallmentEnabled(!!course.installment_enabled);
    setInstallmentMonths(course.installment_months ?? 12);
    setRetakeEnabled(!!course.retake_discount_enabled);
    setRetakePercent(course.retake_discount_percent ?? 50);
    setRetakeCouponStack(!!course.retake_allow_coupon_stack);
    setSuspensionEnabled(!!course.suspension_enabled);
    setIsSequential(!!course.is_sequential);
    setVisibility((course.visibility ?? "shown") as any);
    setVisStart(course.visibility_start_at ? course.visibility_start_at.slice(0, 16) : "");
    setVisEnd(course.visibility_end_at ? course.visibility_end_at.slice(0, 16) : "");
    setKeywords(course.keywords ?? []);
    setAlwaysRecruiting(course.always_recruiting !== false);
    setPeriodMode(!!course.period_mode);
    setGraceDays(course.auto_start_grace_days ?? 30);
    setDailyLimit(course.daily_learning_limit_min ?? "");
    setIntroVideoUrl(course.intro_video_url ?? "");
    setIntroVideoProvider((course.intro_video_provider ?? "") as any);
    setAttachmentUrl(course.attachment_url ?? "");
    setSupportOptions(course.support_options ?? []);
    setShortIntro(course.short_intro_html ?? "");
    setDetailIntro(course.detail_intro_html ?? "");
    setSeoTitle(course.seo_title ?? "");
    setSeoDescription(course.seo_description ?? "");
    setSeoKeywords(course.seo_keywords ?? "");
  }, [course]);

  useEffect(() => {
    if (existingTiers.length > 0) {
      setTiers(existingTiers.map((t: any, i: number) => ({ ...t, sort_order: t.sort_order ?? i })));
    }
  }, [existingTiers]);

  useEffect(() => {
    if (existingPackage.length > 0) setPackageItems(existingPackage);
  }, [existingPackage]);

  // helpers
  const addTier = () => setTiers((prev) => [...prev, emptyTier(prev.length)]);
  const removeTier = (idx: number) => setTiers((prev) => prev.filter((_, i) => i !== idx));
  const updateTier = (idx: number, field: keyof Tier, value: any) =>
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));

  const addKeyword = () => {
    const k = keywordInput.trim();
    if (!k || keywords.includes(k)) return;
    setKeywords([...keywords, k]);
    setKeywordInput("");
  };

  const toggleSupportOption = (opt: string) => {
    setSupportOptions((prev) => (prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt]));
  };

  const togglePackageChild = (id: string) => {
    setPackageItems((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  // 저장
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1) courses 업데이트
      const { error: courseErr } = await supabase
        .from("courses")
        .update({
          base_category: baseCategory || null,
          course_type: courseType,
          installment_enabled: installmentEnabled,
          installment_months: installmentMonths,
          retake_discount_enabled: retakeEnabled,
          retake_discount_percent: retakePercent,
          retake_allow_coupon_stack: retakeCouponStack,
          suspension_enabled: suspensionEnabled,
          is_sequential: isSequential,
          visibility,
          visibility_start_at: visStart ? new Date(visStart).toISOString() : null,
          visibility_end_at: visEnd ? new Date(visEnd).toISOString() : null,
          keywords,
          always_recruiting: alwaysRecruiting,
          period_mode: periodMode,
          auto_start_grace_days: graceDays,
          daily_learning_limit_min: dailyLimit === "" ? null : Number(dailyLimit),
          intro_video_url: introVideoUrl || null,
          intro_video_provider: introVideoProvider || null,
          attachment_url: attachmentUrl || null,
          support_options: supportOptions,
          short_intro_html: shortIntro || null,
          detail_intro_html: detailIntro || null,
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
          seo_keywords: seoKeywords || null,
        } as any)
        .eq("id", courseId);
      if (courseErr) throw courseErr;

      // 2) pricing tiers — 전체 삭제 후 재삽입
      await (supabase as any).from("course_pricing_tiers").delete().eq("course_id", courseId);
      const validTiers = tiers.filter((t) => t.duration_days > 0 || t.list_price > 0 || t.sale_price > 0);
      if (validTiers.length > 0) {
        const rows = validTiers.map((t, i) => ({
          course_id: courseId,
          duration_days: t.duration_days || 0,
          list_price: t.list_price || 0,
          sale_price: t.sale_price || 0,
          points: t.points || 0,
          display_name: t.display_name || null,
          sort_order: i,
        }));
        const { error } = await (supabase as any).from("course_pricing_tiers").insert(rows);
        if (error) throw error;
      }

      // 3) package items
      await (supabase as any).from("course_package_items").delete().eq("package_course_id", courseId);
      if (courseType === "package" && packageItems.length > 0) {
        const rows = packageItems.map((cid, i) => ({
          package_course_id: courseId,
          child_course_id: cid,
          sort_order: i,
        }));
        const { error } = await (supabase as any).from("course_package_items").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("유료 판매 설정이 저장되었습니다");
      queryClient.invalidateQueries({ queryKey: ["paid-course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course-pricing-tiers", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course-package-items", courseId] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      queryClient.invalidateQueries({ queryKey: ["storefront-courses"] });
    },
    onError: (e: any) => toast.error(e.message ?? "저장 실패"),
  });

  return (
    <div className="stat-card space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold">유료 판매 설정</h2>
        </div>
        <Button
          type="button"
          size="sm"
          className="rounded-xl gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          판매 설정 저장
        </Button>
      </div>

      {/* 기본 정보 */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">기본 정보</h3>
        </div>

        <Row label="기본 분류">
          <Select value={baseCategory} onValueChange={setBaseCategory}>
            <SelectTrigger className="w-48 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="정규 교육과정">정규 교육과정</SelectItem>
              <SelectItem value="특강">특강</SelectItem>
              <SelectItem value="이벤트 강좌">이벤트 강좌</SelectItem>
              <SelectItem value="무료 강좌">무료 강좌</SelectItem>
            </SelectContent>
          </Select>
        </Row>

        <Row label="강의 구분">
          <RadioGroup
            value={courseType}
            onValueChange={(v) => setCourseType(v as any)}
            className="flex items-center gap-6"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="single" id="ct-single" /> <span className="text-sm">단과</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value="package" id="ct-package" /> <span className="text-sm">패키지</span>
            </label>
          </RadioGroup>
        </Row>

        {/* 패키지 선택 */}
        {courseType === "package" && (
          <Row label="패키지 구성">
            <div className="space-y-2 max-h-64 overflow-auto border rounded-xl p-3">
              {allCourses.length === 0 ? (
                <p className="text-xs text-muted-foreground">선택 가능한 강의가 없습니다.</p>
              ) : (
                allCourses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={packageItems.includes(c.id)}
                      onCheckedChange={() => togglePackageChild(c.id)}
                    />
                    <span className="truncate">{c.title}</span>
                  </label>
                ))
              )}
              <p className="text-xs text-muted-foreground pt-2">선택 {packageItems.length}개</p>
            </div>
          </Row>
        )}

        {/* 판매 가격 그리드 */}
        <Row label="판매 가격">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-2">
              <div className="col-span-2">수강기간 (일)</div>
              <div className="col-span-2">정가 (원)</div>
              <div className="col-span-2">가격 (원)</div>
              <div className="col-span-2">개별 포인트</div>
              <div className="col-span-3">표출명</div>
              <div className="col-span-1"></div>
            </div>
            {tiers.map((tier, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-2 h-9 rounded-lg"
                  type="number"
                  value={tier.duration_days || ""}
                  onChange={(e) => updateTier(idx, "duration_days", Number(e.target.value))}
                />
                <Input
                  className="col-span-2 h-9 rounded-lg"
                  type="number"
                  value={tier.list_price || ""}
                  onChange={(e) => updateTier(idx, "list_price", Number(e.target.value))}
                />
                <Input
                  className="col-span-2 h-9 rounded-lg"
                  type="number"
                  value={tier.sale_price || ""}
                  onChange={(e) => updateTier(idx, "sale_price", Number(e.target.value))}
                />
                <Input
                  className="col-span-2 h-9 rounded-lg"
                  type="number"
                  value={tier.points || ""}
                  onChange={(e) => updateTier(idx, "points", Number(e.target.value))}
                />
                <Input
                  className="col-span-3 h-9 rounded-lg"
                  placeholder="예: 100일 과정"
                  value={tier.display_name || ""}
                  onChange={(e) => updateTier(idx, "display_name", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="col-span-1 h-9 w-9"
                  onClick={() => removeTier(idx)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2" onClick={addTier}>
              <Plus className="h-3.5 w-3.5" /> 가격 옵션 추가
            </Button>
            <div className="text-xs text-muted-foreground space-y-1 pt-1">
              <p>· 가격란에 0을 입력하시면 결제없이(무료결제) 수강이 가능합니다.</p>
              <p>· 정가 입력시 가격과 비교해서 할인 금액이 표출됩니다.</p>
              <p>· 표출명은 고객이 선택시 노출되는 문구입니다. (예: 100일 과정)</p>
            </div>
          </div>
        </Row>

        <Row label="무이자 할부 문구">
          <div className="flex items-center gap-3">
            <Switch checked={installmentEnabled} onCheckedChange={setInstallmentEnabled} />
            <span className="text-sm whitespace-nowrap">할부 개월수</span>
            <Input
              type="number"
              className="w-20 h-9 rounded-lg"
              value={installmentMonths}
              onChange={(e) => setInstallmentMonths(Number(e.target.value))}
              disabled={!installmentEnabled}
            />
            <span className="text-xs text-muted-foreground">결제금액에서 할부 개월수만큼 나눈 금액이 노출됩니다.</span>
          </div>
        </Row>

        <Row label="재수강 할인">
          <div className="flex items-center gap-3 flex-wrap">
            <Switch checked={retakeEnabled} onCheckedChange={setRetakeEnabled} />
            <span className="text-sm">기존 가격에서</span>
            <Input
              type="number"
              className="w-20 h-9 rounded-lg"
              value={retakePercent}
              onChange={(e) => setRetakePercent(Number(e.target.value))}
              disabled={!retakeEnabled}
            />
            <span className="text-sm">% 할인</span>
            <label className="flex items-center gap-2 text-sm ml-3">
              <Checkbox checked={retakeCouponStack} onCheckedChange={(c) => setRetakeCouponStack(!!c)} />
              쿠폰 중복할인 허용
            </label>
          </div>
        </Row>

        <Row label="휴강 기능">
          <Switch checked={suspensionEnabled} onCheckedChange={setSuspensionEnabled} />
        </Row>

        <Row label="순차 학습">
          <div className="flex items-center gap-2">
            <Switch checked={isSequential} onCheckedChange={setIsSequential} />
            <span className="text-xs text-muted-foreground">차시 순서대로 학습 (예: 1차시 이수해야 2차시 가능)</span>
          </div>
        </Row>

        <Row label="표출 여부">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={visibility === "shown"}
                onCheckedChange={(c) => setVisibility(c ? "shown" : "hidden")}
              />
              <span className="text-xs text-muted-foreground">숨김 처리시 강의목록에 노출되지 않음.</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="datetime-local"
                className="w-56 h-9 rounded-lg"
                value={visStart}
                onChange={(e) => setVisStart(e.target.value)}
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="datetime-local"
                className="w-56 h-9 rounded-lg"
                value={visEnd}
                onChange={(e) => setVisEnd(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">기간 미지정시 상시 표출</span>
            </div>
          </div>
        </Row>

        <Row label="키워드 설정">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="키워드 입력 후 Enter"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                className="h-9 rounded-lg"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <Badge key={k} variant="secondary" className="gap-1">
                  {k}
                  <button onClick={() => setKeywords(keywords.filter((x) => x !== k))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </Row>
      </section>

      {/* 운영 정보 */}
      <section className="space-y-5 pt-2 border-t border-border">
        <div className="flex items-center gap-2 pt-4">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">운영 정보</h3>
        </div>

        <Row label="상시모집 노출">
          <Switch checked={alwaysRecruiting} onCheckedChange={setAlwaysRecruiting} />
        </Row>

        <Row label="기간제 운영">
          <div className="flex items-center gap-3 flex-wrap">
            <Switch checked={periodMode} onCheckedChange={setPeriodMode} />
            <span className="text-xs text-muted-foreground">정해진 기간동안 학습 진행 (미설정시에는 상시 개강)</span>
          </div>
        </Row>

        <Row label="학습자동시작 유예 기간">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="w-24 h-9 rounded-lg"
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value))}
            />
            <span className="text-xs text-muted-foreground">
              일 — 수강신청 결제후 설정일이 지나면 자동 시작 (0 : 결제시 바로 시작)
            </span>
          </div>
        </Row>

        <Row label="1일 학습제한 (분)">
          <Input
            type="number"
            placeholder="미설정시 제한 없음"
            className="w-40 h-9 rounded-lg"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </Row>
      </section>

      {/* 강의 소개 */}
      <section className="space-y-5 pt-2 border-t border-border">
        <div className="flex items-center gap-2 pt-4">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">강의 소개</h3>
        </div>

        <Row label="소개 영상">
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={introVideoProvider || "youtube"}
              onValueChange={(v) => setIntroVideoProvider(v as any)}
            >
              <SelectTrigger className="w-28 h-9 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cdn">CDN</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="예: https://www.youtube.com/embed/0bxlmudj4qE"
              value={introVideoUrl}
              onChange={(e) => setIntroVideoUrl(e.target.value)}
              className="flex-1 h-9 rounded-lg min-w-[260px]"
            />
            <Video className="h-4 w-4 text-muted-foreground" />
          </div>
        </Row>

        <Row label="첨부파일 (교재)">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="교재 PDF / 파일 URL"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              className="flex-1 h-9 rounded-lg"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">파일용량 200M 까지 가능</span>
          </div>
        </Row>

        <Row label="지원옵션">
          <div className="flex items-center gap-4">
            {["신규", "인기", "최다판매"].map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={supportOptions.includes(opt)} onCheckedChange={() => toggleSupportOption(opt)} />
                {opt}
              </label>
            ))}
          </div>
        </Row>

        <Row label="간략 소개">
          <Textarea
            rows={4}
            placeholder="강의 카드/목록에 노출될 짧은 소개"
            value={shortIntro}
            onChange={(e) => setShortIntro(e.target.value)}
            className="rounded-lg"
          />
        </Row>

        <Row label="강의 소개 (HTML)">
          <Textarea
            rows={8}
            placeholder="강의 상세 페이지에 노출될 본문 (HTML 허용)"
            value={detailIntro}
            onChange={(e) => setDetailIntro(e.target.value)}
            className="rounded-lg font-mono text-xs"
          />
        </Row>
      </section>

      {/* SEO */}
      <section className="space-y-5 pt-2 border-t border-border">
        <div className="flex items-center gap-2 pt-4">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">SEO 정보</h3>
        </div>
        <Row label="SEO 제목">
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="h-9 rounded-lg"
            maxLength={60}
          />
        </Row>
        <Row label="SEO 설명">
          <Textarea
            rows={2}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            className="rounded-lg"
            maxLength={160}
          />
        </Row>
        <Row label="SEO 키워드">
          <Input
            value={seoKeywords}
            onChange={(e) => setSeoKeywords(e.target.value)}
            placeholder="콤마(,)로 구분"
            className="h-9 rounded-lg"
          />
        </Row>
      </section>

      {/* 저장 버튼 (하단) */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          type="button"
          size="lg"
          className="rounded-xl gap-2"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          판매 설정 저장
        </Button>
      </div>
    </div>
  );
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-12 gap-4 items-start">
    <Label className="col-span-12 sm:col-span-3 text-sm text-foreground pt-2 whitespace-nowrap">{label}</Label>
    <div className="col-span-12 sm:col-span-9 min-w-0">{children}</div>
  </div>
);

export default PaidCourseSettings;
