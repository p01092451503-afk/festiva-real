import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Link2,
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Save,
  Wand2,
  Quote,
  ChevronDown,
  Newspaper,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import UrlFallbackCard from "./UrlFallbackCard";

type QType = "multiple_choice_4" | "ox" | "short_answer" | "essay";
type Diff = "easy" | "medium" | "hard";
type StylePreset = "balanced" | "fairness" | "concise" | "deep" | "applied" | "exam";

interface GeneratedQ {
  question_type: QType;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: Diff;
  source_quote?: string;
  // Local UI flags
  selected: boolean;
}

interface Props {
  /** Assessment id — when set, "Add to assessment" target is preselected. */
  assessmentId?: string;
  /** Course id used to scope question_bank entries. */
  courseId?: string | null;
  /** Optional custom trigger; defaults to a primary button. */
  trigger?: React.ReactNode;
  /** Called after questions are saved. */
  onSaved?: () => void;
  /** Compact button variant for header rows. */
  compact?: boolean;
}

const ALL_TYPES: { value: QType; ko: string; en: string }[] = [
  { value: "multiple_choice_4", ko: "객관식 (4지선다)", en: "Multiple Choice" },
  { value: "ox", ko: "OX (참/거짓)", en: "True / False" },
  { value: "short_answer", ko: "단답형", en: "Short Answer" },
  { value: "essay", ko: "서술형", en: "Essay" },
];

/**
 * 출제 스타일 프리셋
 * - 클라이언트는 코드(value)만 서버로 전달
 * - 서버(엣지 함수)가 코드 → 시스템 프롬프트 보강 문구로 매핑
 */
const STYLE_PRESETS: {
  value: StylePreset;
  ko: { label: string; desc: string };
  en: { label: string; desc: string };
}[] = [
  {
    value: "balanced",
    ko: { label: "균형 (기본)", desc: "이해·적용·분석을 고르게 출제" },
    en: { label: "Balanced (default)", desc: "Even mix of recall, apply, analyze" },
  },
  {
    value: "fairness",
    ko: {
      label: "공정성",
      desc: "편향·민감 표현 배제, 중립 문체, 명확한 단일 정답",
    },
    en: {
      label: "Fairness",
      desc: "Neutral wording, no bias, single unambiguous answer",
    },
  },
  {
    value: "concise",
    ko: { label: "간결함", desc: "짧은 문장, 핵심 키워드 위주, 군더더기 제거" },
    en: { label: "Concise", desc: "Short stems, key facts only, no fluff" },
  },
  {
    value: "deep",
    ko: { label: "심화", desc: "추론·비교·다단계 분석 중심, 오답 매력도 ↑" },
    en: { label: "Deep", desc: "Inference, comparison, plausible distractors" },
  },
  {
    value: "applied",
    ko: { label: "실무 적용", desc: "현업 시나리오 기반, 의사결정형 문항" },
    en: { label: "Applied", desc: "Workplace scenarios and decision-making" },
  },
  {
    value: "exam",
    ko: { label: "시험형", desc: "공인시험 톤, 형식·문항 길이 표준화" },
    en: { label: "Exam-style", desc: "Standardized tone and length, formal" },
  },
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:...;base64," prefix
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AIQuestionGenerator({
  assessmentId,
  courseId,
  trigger,
  onSaved,
  compact,
}: Props) {
  const { user } = useUser();
  const { isAdmin, isSuperAdmin } = useUserRole();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);

  // Source
  const [sourceTab, setSourceTab] = useState<"text" | "url" | "pdf" | "image" | "cms" | "course">(
    courseId ? "course" : "text",
  );
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string>("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);

  // Options
  const [types, setTypes] = useState<QType[]>(["multiple_choice_4"]);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [learnerLevel, setLearnerLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [topicHint, setTopicHint] = useState("");
  const [stylePreset, setStylePreset] = useState<StylePreset>("balanced");

  // Save destination
  const [saveToBank, setSaveToBank] = useState(true);
  const [saveToAssessment, setSaveToAssessment] = useState<string>(assessmentId || "");
  const [bankCategory, setBankCategory] = useState<string>("");
  const [bankCourse, setBankCourse] = useState<string>(courseId || "");
  const [bankPoints, setBankPoints] = useState(10);

  // Results
  const [generated, setGenerated] = useState<GeneratedQ[] | null>(null);
  const [articleSummary, setArticleSummary] = useState("");

  // URL 크롤링 실패 폴백 정보
  type UrlErrorCode =
    | "INVALID_URL"
    | "TIMEOUT"
    | "DNS_OR_NETWORK"
    | "BLOCKED"
    | "NOT_FOUND"
    | "SERVER_ERROR"
    | "HTTP_ERROR"
    | "UNSUPPORTED_TYPE"
    | "TOO_SHORT"
    | "UNKNOWN";
  const [urlFallback, setUrlFallback] = useState<{
    failedUrl: string;
    reason: string;
    code: UrlErrorCode;
    httpStatus?: number | null;
  } | null>(null);

  // URL 재시도 상태 — 횟수 + 백오프 카운트다운
  const MAX_URL_RETRIES = 3;
  const [urlRetryCount, setUrlRetryCount] = useState(0);
  const [urlRetryWaitMs, setUrlRetryWaitMs] = useState(0); // > 0 이면 카운트다운 진행 중

  // 폴백 카드 접근성(포커스 이동/Esc/Tab 루핑)은 UrlFallbackCard 컴포넌트가 캡슐화한다.

  // 생성 완료 후 "3. 검토 및 편집" 영역으로 자동 스크롤하기 위한 ref
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Lookups
  const { data: categories = [] } = useQuery({
    queryKey: ["qbank-categories-aigen"],
    enabled: open && saveToBank,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_bank_categories" as any)
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data || []) as any[];
    },
  });
  const { data: courses = [] } = useQuery({
    queryKey: ["qbank-courses-aigen"],
    enabled: open && saveToBank,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id,title").order("title");
      if (error) throw error;
      return data || [];
    },
  });
  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments-aigen"],
    enabled: open && !!saveToAssessment !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id,title,course_id")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // CMS — published articles selectable as source
  const { data: cmsArticles = [] } = useQuery({
    queryKey: ["aigen-cms-articles"],
    enabled: open && sourceTab === "cms",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles" as any)
        .select("id,title,summary,body,published_at,publish_at,language_code")
        .eq("status", "published")
        .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Course lessons — pull registered course_contents + their AI summaries for the bound course
  const { data: courseLessons = [] } = useQuery({
    queryKey: ["aigen-course-lessons", courseId],
    enabled: open && sourceTab === "course" && !!courseId,
    queryFn: async () => {
      const { data: contents, error } = await supabase
        .from("course_contents")
        .select("id, title, description, order_index")
        .eq("course_id", courseId!)
        .order("order_index", { ascending: true });
      if (error) throw error;
      const ids = (contents || []).map((c: any) => c.id);
      let sumMap = new Map<string, { summary: string; key_points: any; keywords: any }>();
      if (ids.length > 0) {
        const { data: sums } = await supabase
          .from("content_summaries")
          .select("content_id, summary, key_points, keywords")
          .in("content_id", ids);
        (sums || []).forEach((s: any) => sumMap.set(s.content_id, s));
      }
      return (contents || []).map((c: any) => ({ ...c, summary_row: sumMap.get(c.id) || null }));
    },
  });

  const reset = () => {
    setText("");
    setUrl("");
    setFile(null);
    setGenerated(null);
    setArticleSummary("");
    setSourceTab(courseId ? "course" : "text");
    setUrlFallback(null);
    setUrlRetryCount(0);
    setUrlRetryWaitMs(0);
    setSelectedArticleId("");
    setSelectedLessonIds([]);
  };

  // ─────────────────────────────────────────────────────────────────
  // URL 재시도 backoff 카운트다운 (1초 단위)
  // ─────────────────────────────────────────────────────────────────
  const retryTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (urlRetryWaitMs <= 0) return;
    retryTimerRef.current = window.setTimeout(() => {
      setUrlRetryWaitMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => {
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    };
  }, [urlRetryWaitMs]);

  // 재시도해도 의미 없는 코드들
  const NON_RETRYABLE: UrlErrorCode[] = [
    "INVALID_URL",
    "NOT_FOUND",
    "UNSUPPORTED_TYPE",
  ];
  const canRetryUrl =
    !!urlFallback &&
    !NON_RETRYABLE.includes(urlFallback.code) &&
    urlRetryCount < MAX_URL_RETRIES;

  // 사용자 버튼 트리거 — 지수 backoff(2s → 4s → 8s) 후 재시도
  const handleUrlRetry = () => {
    if (!canRetryUrl || urlRetryWaitMs > 0) return;
    const nextAttempt = urlRetryCount + 1; // 1, 2, 3
    const waitMs = Math.pow(2, nextAttempt) * 1000; // 2s, 4s, 8s
    setUrlRetryCount(nextAttempt);
    setUrlRetryWaitMs(waitMs);
    window.setTimeout(() => {
      // 카운트다운 종료 후 실제 재시도
      generateMutation.mutate();
    }, waitMs);
  };

  const toggleType = (val: QType) => {
    setTypes((prev) =>
      prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val],
    );
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      // 새 시도 시 이전 폴백 안내 초기화
      setUrlFallback(null);
      const payload: any = {
        questionTypes: types,
        count,
        difficulty,
        learnerLevel,
        language: isEn ? "en" : "ko",
        topicHint: topicHint || undefined,
        stylePreset,
      };

      if (sourceTab === "text") {
        if (!text.trim()) throw new Error(isEn ? "Paste article text" : "기사 본문을 붙여넣어 주세요");
        payload.text = text.trim();
      } else if (sourceTab === "url") {
        if (!url.trim()) throw new Error(isEn ? "Enter URL" : "URL을 입력해 주세요");
        payload.url = url.trim();
      } else if (sourceTab === "cms") {
        if (!selectedArticleId) throw new Error(isEn ? "Select an article" : "기사를 선택해 주세요");
        const a = cmsArticles.find((x: any) => x.id === selectedArticleId);
        if (!a) throw new Error(isEn ? "Article not found" : "기사를 찾을 수 없습니다");
        const composed = [a.title, a.summary, a.body].filter(Boolean).join("\n\n");
        if (!composed.trim()) throw new Error(isEn ? "Article body is empty" : "기사 본문이 비어 있습니다");
        payload.text = composed.trim();
      } else if (sourceTab === "course") {
        if (selectedLessonIds.length === 0)
          throw new Error(isEn ? "Select at least one lesson" : "차시를 1개 이상 선택해 주세요");
        const picked = courseLessons.filter((c: any) => selectedLessonIds.includes(c.id));
        const composed = picked
          .map((c: any) => {
            const parts: string[] = [`# ${c.title}`];
            if (c.description) parts.push(c.description);
            const s = c.summary_row;
            if (s?.summary) parts.push(`[요약]\n${s.summary}`);
            const kp = Array.isArray(s?.key_points) ? s.key_points : [];
            if (kp.length) parts.push(`[핵심 포인트]\n- ${kp.join("\n- ")}`);
            const kw = Array.isArray(s?.keywords) ? s.keywords : [];
            if (kw.length) parts.push(`[키워드] ${kw.join(", ")}`);
            return parts.join("\n\n");
          })
          .join("\n\n---\n\n");
        if (!composed.trim())
          throw new Error(
            isEn ? "Selected lessons have no usable content" : "선택한 차시에 활용 가능한 자료가 없습니다",
          );
        payload.text = composed.trim();
      } else {
        if (!file) throw new Error(isEn ? "Choose a file" : "파일을 선택해 주세요");
        const dataBase64 = await fileToBase64(file);
        payload.file = { mimeType: file.type, dataBase64 };
      }

      const { data, error } = await supabase.functions.invoke(
        "generate-questions-from-article",
        { body: payload },
      );
      // supabase-js v2의 FunctionsHttpError는 응답 본문을 직접 노출하지 않으므로
      // context.response에서 JSON 본문을 다시 파싱해 errorCode/httpStatus를 보존한다.
      if (error) {
        let parsed: any = null;
        const ctxResp: Response | undefined = (error as any)?.context?.response;
        if (ctxResp && typeof ctxResp.clone === "function") {
          try {
            parsed = await ctxResp.clone().json();
          } catch {
            try {
              const txt = await ctxResp.clone().text();
              parsed = txt ? { error: txt } : null;
            } catch {
              /* ignore */
            }
          }
        }
        const message =
          parsed?.error ||
          error.message ||
          (isEn ? "Generation failed" : "문제 생성에 실패했습니다");
        const err: any = new Error(message);
        err.errorCode = parsed?.errorCode || "UNKNOWN";
        err.httpStatus = parsed?.httpStatus ?? ctxResp?.status ?? null;
        err.failedUrl = parsed?.url;
        throw err;
      }
      // 일부 경로에서 200 + {error} 형태로 내려올 수도 있으므로 방어적으로 처리
      if (data && (data as any).error) {
        const err: any = new Error((data as any).error);
        err.errorCode = (data as any).errorCode || "UNKNOWN";
        err.httpStatus = (data as any).httpStatus ?? null;
        err.failedUrl = (data as any).url;
        throw err;
      }
      if (!data) throw new Error("No response");
      return data as { questions: Omit<GeneratedQ, "selected">[]; article_summary: string };
    },
    onSuccess: (data) => {
      setGenerated(data.questions.map((q) => ({ ...q, selected: true })));
      setArticleSummary(data.article_summary || "");
      // 성공 시 URL 재시도 상태 초기화
      setUrlRetryCount(0);
      setUrlRetryWaitMs(0);
      setUrlFallback(null);
      toast({
        title: isEn ? "Generated" : "생성 완료",
        description: isEn
          ? `${data.questions.length} questions ready for review`
          : `${data.questions.length}문항이 생성되었습니다. 검토해 주세요.`,
      });
      // 다음 페인트 후 "3. 검토 및 편집" 영역으로 자동 스크롤
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      // 1) 엣지에서 표준화된 errorCode가 온 경우 우선
      let code: UrlErrorCode | null = (e?.errorCode as UrlErrorCode) || null;
      const httpStatus: number | null = e?.httpStatus ?? null;
      const failedUrl: string = e?.failedUrl || url.trim();

      // 2) 코드가 없으면 메시지로 폴백 분류
      if (!code && sourceTab === "url" && !!url.trim()) {
        if (/timeout|시간|초과/i.test(msg)) code = "TIMEOUT";
        else if (/403|401|forbidden|blocked|429|451|차단/i.test(msg)) code = "BLOCKED";
        else if (/404|410|not found|찾을 수 없/i.test(msg)) code = "NOT_FOUND";
        else if (/5\d{2}|server error/i.test(msg)) code = "SERVER_ERROR";
        else if (/network|dns|fetch failed|네트워크/i.test(msg)) code = "DNS_OR_NETWORK";
        else if (/too little|too short|추출|짧/i.test(msg)) code = "TOO_SHORT";
        else if (/invalid url|형식/i.test(msg)) code = "INVALID_URL";
        else if (/unsupported|content[-\s]?type/i.test(msg)) code = "UNSUPPORTED_TYPE";
        else if (/url fetch failed|http\s*[345]\d{2}/i.test(msg)) code = "HTTP_ERROR";
      }

      const isUrlFailure = sourceTab === "url" && !!url.trim() && !!code;
      if (isUrlFailure) {
        setUrlFallback({
          failedUrl,
          reason: msg,
          code: code as UrlErrorCode,
          httpStatus,
        });
      }
      toast({
        title: isEn ? "Error" : "오류",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const updateQ = (idx: number, patch: Partial<GeneratedQ>) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const updateOption = (idx: number, optIdx: number, value: string) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const opts = [...(next[idx].options || [])];
      opts[optIdx] = value;
      next[idx] = { ...next[idx], options: opts };
      return next;
    });
  };

  const removeQ = (idx: number) => {
    setGenerated((prev) => prev?.filter((_, i) => i !== idx) || null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!generated) throw new Error("Nothing to save");
      const selected = generated.filter((q) => q.selected);
      if (selected.length === 0) throw new Error(isEn ? "Select at least one" : "저장할 문항을 선택하세요");
      if (!saveToBank && !saveToAssessment) {
        throw new Error(isEn ? "Choose a destination" : "저장 위치를 선택하세요");
      }

      // ===== 중복 검증 =====
      // 정규화: 공백/대소문자 차이를 무시한 키
      const normalize = (s: string) =>
        (s || "").replace(/\s+/g, " ").trim().toLowerCase();

      // (a) 선택된 문항들 사이의 자체 중복 제거 — 같은 question_text가 여러 개면
      // 첫 번째만 유지하고 나머지는 스킵 (사용자에게 알림)
      const seen = new Set<string>();
      const dedupedSelected: typeof selected = [];
      const intraDuplicates: string[] = [];
      for (const q of selected) {
        const key = normalize(q.question_text);
        if (!key) continue;
        if (seen.has(key)) {
          intraDuplicates.push(q.question_text);
          continue;
        }
        seen.add(key);
        dedupedSelected.push(q);
      }
      if (dedupedSelected.length === 0) {
        throw new Error(isEn ? "No unique questions to save" : "저장할 고유 문항이 없습니다");
      }

      const allTexts = dedupedSelected.map((q) => q.question_text);
      const skippedFromBank: string[] = [];
      const skippedFromAssessment: string[] = [];

      // 1) Save to question_bank
      let bankRowsToInsert: typeof dedupedSelected = dedupedSelected;
      if (saveToBank) {
        // DB에 이미 같은 question_text가 있는지 확인 (course/category 스코프 무관, 전역 중복 방지)
        const { data: existingBank, error: bankCheckErr } = await supabase
          .from("question_bank" as any)
          .select("question_text")
          .in("question_text", allTexts);
        if (bankCheckErr) throw bankCheckErr;
        const existingSet = new Set(
          (existingBank || []).map((r: any) => normalize(r.question_text)),
        );
        bankRowsToInsert = dedupedSelected.filter((q) => {
          if (existingSet.has(normalize(q.question_text))) {
            skippedFromBank.push(q.question_text);
            return false;
          }
          return true;
        });

        if (bankRowsToInsert.length === 0 && !saveToAssessment) {
          throw new Error(
            isEn
              ? "All selected questions already exist in the question bank."
              : "선택한 모든 문항이 이미 문제은행에 존재합니다.",
          );
        }

        if (bankRowsToInsert.length > 0) {
          const rows = bankRowsToInsert.map((q) => ({
            course_id: bankCourse || null,
            category_id: bankCategory || null,
            tags: ["AI생성", articleSummary ? "기사기반" : ""].filter(Boolean),
            difficulty: q.difficulty,
            learner_level: learnerLevel,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            points: bankPoints,
            explanation: q.explanation || null,
            hint: null,
            is_active: true,
            created_by: user?.id,
          }));
          const { error } = await supabase.from("question_bank" as any).insert(rows);
          if (error) throw error;
        }
      }

      // 2) Save to assessment_questions (해당 평가 내 중복 차단)
      let assessmentRowsToInsert: typeof dedupedSelected = dedupedSelected;
      if (saveToAssessment) {
        const { data: existingAQ, error: aqCheckErr } = await supabase
          .from("assessment_questions")
          .select("question_text, order_index")
          .eq("assessment_id", saveToAssessment);
        if (aqCheckErr) throw aqCheckErr;
        const existingAQSet = new Set(
          (existingAQ || []).map((r: any) => normalize(r.question_text)),
        );
        assessmentRowsToInsert = dedupedSelected.filter((q) => {
          if (existingAQSet.has(normalize(q.question_text))) {
            skippedFromAssessment.push(q.question_text);
            return false;
          }
          return true;
        });

        if (assessmentRowsToInsert.length === 0 && !saveToBank) {
          throw new Error(
            isEn
              ? "All selected questions already exist in this assessment."
              : "선택한 모든 문항이 이미 해당 평가에 등록되어 있습니다.",
          );
        }

        if (assessmentRowsToInsert.length > 0) {
          const maxOrder =
            existingAQ && existingAQ.length > 0
              ? Math.max(...existingAQ.map((r: any) => r.order_index ?? 0)) + 1
              : 0;
          const rows = assessmentRowsToInsert.map((q, i) => ({
            assessment_id: saveToAssessment,
            question_type: q.question_type,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            points: bankPoints,
            explanation: q.explanation || null,
            hint: null,
            order_index: maxOrder + i,
          }));
          const { error } = await supabase.from("assessment_questions").insert(rows);
          if (error) throw error;
        }
      }

      // 사용자에게 보여줄 요약 정보를 onSuccess로 전달
      return {
        savedToBank: saveToBank ? bankRowsToInsert.length : 0,
        savedToAssessment: saveToAssessment ? assessmentRowsToInsert.length : 0,
        skippedIntra: intraDuplicates.length,
        skippedBank: skippedFromBank.length,
        skippedAssessment: skippedFromAssessment.length,
      };
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["question-bank"] });
      qc.invalidateQueries({ queryKey: ["assessment"] });
      const skippedTotal =
        (res.skippedIntra || 0) + (res.skippedBank || 0) + (res.skippedAssessment || 0);
      const parts: string[] = [];
      if (res.savedToBank)
        parts.push(isEn ? `Bank: ${res.savedToBank}` : `문제은행 ${res.savedToBank}개`);
      if (res.savedToAssessment)
        parts.push(
          isEn ? `Assessment: ${res.savedToAssessment}` : `평가 ${res.savedToAssessment}개`,
        );
      const summary = parts.join(", ") || (isEn ? "0 saved" : "저장 0개");
      const skipMsg = skippedTotal
        ? isEn
          ? ` (${skippedTotal} duplicates skipped)`
          : ` (중복 ${skippedTotal}개 제외)`
        : "";
      toast({
        title: isEn ? "Saved" : "저장 완료",
        description: summary + skipMsg,
      });
      onSaved?.();
      setOpen(false);
      reset();
    },
    onError: (e: any) =>
      toast({
        title: isEn ? "Error" : "오류",
        description: e.message,
        variant: "destructive",
      }),
  });

  const defaultTrigger = compact ? (
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
      <Sparkles className="h-4 w-4 mr-1" />
      {isEn ? "AI Generate" : "AI 문제 생성"}
    </Button>
  ) : (
    <Button onClick={() => setOpen(true)}>
      <Sparkles className="h-4 w-4 mr-1" />
      {isEn ? "AI Generate Questions" : "AI 문제 생성"}
    </Button>
  );

  // Hard guard: AI 문제 생성은 admin / super_admin 전용 기능.
  // 학생/강사 화면 또는 role-switcher로 학생/강사 모드일 때는 노출하지 않는다.
  // ⚠️ Hooks 규칙을 지키기 위해 모든 useState/useEffect/useQuery/useMutation 선언 이후에 가드한다.
  const activeRole = (() => {
    try {
      return localStorage.getItem("nf-active-role");
    } catch {
      return null;
    }
  })();
  const allowed =
    (isAdmin || isSuperAdmin) && (!activeRole || activeRole === "admin");
  if (!allowed) return null;

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-block cursor-pointer">
          {trigger}
        </span>
      ) : (
        defaultTrigger
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {isEn ? "AI Question Generator" : "AI 기반 문제 생성"}
            </DialogTitle>
            <DialogDescription>
              {isEn
                ? "Generate exam questions from articles, news, or study materials."
                : "다양한 학습자료를 기반으로 평가 문항을 자동 생성합니다."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-3 -mr-3">
            <div className="space-y-6">
              {/* SOURCE */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  {isEn ? "1. Source" : "1. 입력 소스"}
                </Label>
                <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as any)}>
                  <TabsList className={`grid ${courseId ? "grid-cols-6" : "grid-cols-5"} w-full`}>
                    {courseId && (
                      <TabsTrigger value="course">
                        <BookOpen className="h-4 w-4 mr-1" />
                        {isEn ? "Course" : "강의자료"}
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="text">
                      <FileText className="h-4 w-4 mr-1" />
                      {isEn ? "Text" : "텍스트"}
                    </TabsTrigger>
                    <TabsTrigger value="url">
                      <Link2 className="h-4 w-4 mr-1" />
                      URL
                    </TabsTrigger>
                    <TabsTrigger value="cms">
                      <Newspaper className="h-4 w-4 mr-1" />
                      {isEn ? "CMS" : "CMS"}
                    </TabsTrigger>
                    <TabsTrigger value="pdf">
                      <FileUp className="h-4 w-4 mr-1" />
                      PDF
                    </TabsTrigger>
                    <TabsTrigger value="image">
                      <ImageIcon className="h-4 w-4 mr-1" />
                      {isEn ? "Image" : "이미지"}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="course" className="mt-3">
                    {!courseId ? (
                      <p className="text-xs text-muted-foreground">
                        {isEn ? "No course bound." : "강의가 지정되지 않았습니다."}
                      </p>
                    ) : courseLessons.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {isEn ? "No lessons in this course." : "이 강의에 등록된 차시가 없습니다."}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {isEn
                              ? "Pick lessons to use as source. Title, description, and AI summary are combined."
                              : "출제 근거로 사용할 차시를 선택하세요. 제목·설명·AI 요약이 함께 사용됩니다."}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              setSelectedLessonIds(
                                selectedLessonIds.length === courseLessons.length
                                  ? []
                                  : courseLessons.map((c: any) => c.id),
                              )
                            }
                          >
                            {selectedLessonIds.length === courseLessons.length
                              ? isEn
                                ? "Clear"
                                : "선택 해제"
                              : isEn
                                ? "Select all"
                                : "전체 선택"}
                          </Button>
                        </div>
                        <div className="border-2 border-border/80 rounded-md max-h-[260px] overflow-y-auto divide-y divide-border">
                          {courseLessons.map((c: any, i: number) => {
                            const checked = selectedLessonIds.includes(c.id);
                            const hasSummary = !!c.summary_row?.summary;
                            return (
                              <label
                                key={c.id}
                                className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    setSelectedLessonIds((prev) =>
                                      v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                                    )
                                  }
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">
                                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                    {c.title}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant={hasSummary ? "secondary" : "outline"} className="text-[10px]">
                                      {hasSummary
                                        ? isEn
                                          ? "AI summary"
                                          : "AI 요약 있음"
                                        : isEn
                                          ? "Metadata only"
                                          : "메타데이터만"}
                                    </Badge>
                                    {c.description && (
                                      <span className="text-[11px] text-muted-foreground truncate">
                                        {c.description.slice(0, 80)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {isEn
                            ? `${selectedLessonIds.length} of ${courseLessons.length} lessons selected`
                            : `${courseLessons.length}개 중 ${selectedLessonIds.length}개 선택됨`}
                        </p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="text" className="mt-3">
                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        isEn
                          ? "Paste the article body here..."
                          : "기사 본문을 붙여넣어 주세요. (최대 약 16,000자)"
                      }
                      className="min-h-[180px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEn ? `${text.length} chars` : `${text.length}자`}
                    </p>
                  </TabsContent>
                  <TabsContent value="url" className="mt-3">
                    <Input
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        // 새 URL 입력 시 재시도 카운트/폴백 리셋
                        if (urlRetryCount !== 0) setUrlRetryCount(0);
                        if (urlRetryWaitMs !== 0) setUrlRetryWaitMs(0);
                        if (urlFallback) setUrlFallback(null);
                      }}
                      placeholder="https://news.example.com/article/12345"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEn
                        ? "Some sites block scraping. If extraction fails, paste the text manually."
                        : "일부 사이트는 자동 추출이 막혀있습니다. 실패 시 본문을 직접 붙여넣어 주세요."}
                    </p>

                    {urlFallback && (
                      <UrlFallbackCard
                        fallback={urlFallback}
                        isEn={!!isEn}
                        retryCount={urlRetryCount}
                        maxRetries={MAX_URL_RETRIES}
                        retryWaitMs={urlRetryWaitMs}
                        canRetry={canRetryUrl}
                        isPending={generateMutation.isPending}
                        onRetry={handleUrlRetry}
                        onSwitchToPaste={() => {
                          setSourceTab("text");
                          setUrlFallback(null);
                          setTimeout(() => {
                            const ta = document.querySelector<HTMLTextAreaElement>(
                              'textarea[placeholder*="기사 본문"], textarea[placeholder*="article body"]',
                            );
                            ta?.focus();
                          }, 50);
                        }}
                        onDismiss={() => {
                          setUrlFallback(null);
                          setTimeout(() => {
                            const urlInput = document.querySelector<HTMLInputElement>(
                              'input[placeholder*="news.example.com"]',
                            );
                            urlInput?.focus();
                          }, 30);
                        }}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="cms" className="mt-3">
                    <Select
                      value={selectedArticleId || "none"}
                      onValueChange={(v) => setSelectedArticleId(v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={isEn ? "Select a published article" : "발행된 기사를 선택하세요"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {cmsArticles.length === 0 ? (
                          <SelectItem value="none" disabled>
                            {isEn ? "No published articles" : "발행된 기사가 없습니다"}
                          </SelectItem>
                        ) : (
                          cmsArticles.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedArticleId &&
                      (() => {
                        const a = cmsArticles.find((x: any) => x.id === selectedArticleId);
                        if (!a) return null;
                        const preview = (a.body || a.summary || "").slice(0, 280);
                        return (
                          <div className="mt-3 border-2 border-border/80 rounded-md p-3 text-xs space-y-1">
                            <div className="font-medium text-foreground">{a.title}</div>
                            {a.summary && (
                              <div className="text-muted-foreground">{a.summary}</div>
                            )}
                            <div className="text-muted-foreground line-clamp-3">{preview}…</div>
                            <div className="text-[10px] text-muted-foreground pt-1">
                              {(a.body || "").length.toLocaleString()} {isEn ? "chars" : "자"}
                            </div>
                          </div>
                        );
                      })()}
                    <p className="text-xs text-muted-foreground mt-2">
                      {isEn
                        ? "Pick a published CMS article to generate questions from."
                        : "CMS에 발행된 기사를 선택해 문제를 생성합니다."}
                    </p>
                  </TabsContent>
                  <TabsContent value="pdf" className="mt-3">
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.name} ({(file.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="image" className="mt-3">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEn
                        ? "Newspaper photo, screenshot, etc. AI will OCR the image."
                        : "신문 사진, 스크린샷 등. AI가 이미지의 텍스트를 인식합니다."}
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />

              {/* OPTIONS */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  {isEn ? "2. Options" : "2. 생성 옵션"}
                </Label>

                <div>
                  <Label className="text-sm">
                    {isEn ? "Question types" : "문제 유형"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {ALL_TYPES.map((t) => (
                      <label
                        key={t.value}
                        className="flex items-center gap-2 border-2 border-border/80 rounded-md px-3 py-2 cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={types.includes(t.value)}
                          onCheckedChange={() => toggleType(t.value)}
                        />
                        <span className="text-sm">{isEn ? t.en : t.ko}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm">{isEn ? "Count" : "문항 수"}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{isEn ? "Difficulty" : "난이도"}</Label>
                    <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">{isEn ? "Mixed" : "혼합"}</SelectItem>
                        <SelectItem value="easy">{isEn ? "Easy" : "쉬움"}</SelectItem>
                        <SelectItem value="medium">{isEn ? "Medium" : "보통"}</SelectItem>
                        <SelectItem value="hard">{isEn ? "Hard" : "어려움"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">{isEn ? "Learner level" : "학습자 수준"}</Label>
                    <Select value={learnerLevel} onValueChange={(v) => setLearnerLevel(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">{isEn ? "Beginner" : "입문"}</SelectItem>
                        <SelectItem value="intermediate">{isEn ? "Intermediate" : "중급"}</SelectItem>
                        <SelectItem value="advanced">{isEn ? "Advanced" : "고급"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-sm">
                    {isEn ? "Style preset" : "출제 스타일 프리셋"}
                  </Label>
                  <Select
                    value={stylePreset}
                    onValueChange={(v) => setStylePreset(v as StylePreset)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_PRESETS.map((p) => {
                        const t = isEn ? p.en : p.ko;
                        return (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="font-medium">{t.label}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              — {t.desc}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEn
                      ? "Adjusts tone, distractor difficulty, and question framing."
                      : "문항의 톤, 오답 난이도, 출제 프레임을 조정합니다."}
                  </p>
                </div>

                <div>
                  <Label className="text-sm">
                    {isEn ? "Focus topic (optional)" : "출제 포커스 (선택)"}
                  </Label>
                  <Input
                    value={topicHint}
                    onChange={(e) => setTopicHint(e.target.value)}
                    placeholder={isEn ? "e.g. Key statistics and dates" : "예: 핵심 통계와 발생 시점 위주"}
                  />
                </div>

                {/* Generate 버튼은 항상 보이도록 DialogFooter로 이동했습니다. */}
              </div>

              {/* PREVIEW & EDIT */}
              {generated && generated.length > 0 && (
                <>
                  <Separator />
                  <div ref={previewRef} className="space-y-3 scroll-mt-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">
                        {isEn ? "3. Review & Edit" : "3. 검토 및 편집"}
                      </Label>
                      <Badge variant="secondary">
                        {generated.filter((q) => q.selected).length} / {generated.length}
                      </Badge>
                    </div>
                    {articleSummary && (
                      <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        <strong>{isEn ? "Summary: " : "요약: "}</strong>
                        {articleSummary}
                      </div>
                    )}

                    <div className="space-y-3">
                      {generated.map((q, idx) => (
                        <div
                          key={idx}
                          className="border-2 border-border/80 rounded-md p-3 space-y-2 min-w-0"
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={q.selected}
                              onCheckedChange={(v) => updateQ(idx, { selected: !!v })}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="whitespace-nowrap">
                                  {ALL_TYPES.find((t) => t.value === q.question_type)?.[isEn ? "en" : "ko"]}
                                </Badge>
                                <Badge variant="outline" className="whitespace-nowrap">
                                  {q.difficulty}
                                </Badge>
                              </div>
                              <Textarea
                                value={q.question_text}
                                onChange={(e) => updateQ(idx, { question_text: e.target.value })}
                                className="text-sm"
                                rows={2}
                              />
                              {q.options && (
                                <div className="space-y-1">
                                  {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        name={`correct-${idx}`}
                                        checked={q.correct_answer === opt}
                                        onChange={() => updateQ(idx, { correct_answer: opt })}
                                      />
                                      <Input
                                        value={opt}
                                        onChange={(e) => updateOption(idx, oi, e.target.value)}
                                        className="text-sm h-8"
                                        disabled={q.question_type === "ox"}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!q.options && (
                                <div>
                                  <Label className="text-xs">
                                    {q.question_type === "essay"
                                      ? isEn ? "Model answer / rubric" : "모범답안 / 채점기준"
                                      : isEn ? "Correct answer" : "정답"}
                                  </Label>
                                  <Textarea
                                    value={q.correct_answer}
                                    onChange={(e) => updateQ(idx, { correct_answer: e.target.value })}
                                    className="text-sm"
                                    rows={q.question_type === "essay" ? 3 : 1}
                                  />
                                </div>
                              )}
                              <div>
                                <Label className="text-xs">{isEn ? "Explanation" : "해설"}</Label>
                                <Textarea
                                  value={q.explanation}
                                  onChange={(e) => updateQ(idx, { explanation: e.target.value })}
                                  className="text-sm"
                                  rows={2}
                                />
                              </div>
                              {q.source_quote && (
                                <details className="group rounded-md border border-border/70 bg-muted/30 open:bg-muted/50 transition-colors">
                                  <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                                    <Quote className="h-3 w-3" />
                                    <span>{isEn ? "Source quote" : "근거 문장"}</span>
                                    <ChevronDown className="h-3 w-3 ml-auto transition-transform group-open:rotate-180" />
                                  </summary>
                                  <p className="px-2.5 pb-2 pt-0 text-xs text-muted-foreground italic leading-relaxed border-t border-border/60">
                                    "{q.source_quote}"
                                  </p>
                                </details>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQ(idx)}
                              className="shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* DESTINATION */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">
                      {isEn ? "4. Save to" : "4. 저장 위치"}
                    </Label>

                    <label className="flex items-start gap-2 border-2 border-border/80 rounded-md p-3 cursor-pointer">
                      <Checkbox
                        checked={saveToBank}
                        onCheckedChange={(v) => setSaveToBank(!!v)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-2 min-w-0">
                        <p className="text-sm font-medium">
                          {isEn ? "Question Bank" : "문제은행"}
                        </p>
                        {saveToBank && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Select value={bankCourse || "none"} onValueChange={(v) => setBankCourse(v === "none" ? "" : v)}>
                              <SelectTrigger><SelectValue placeholder={isEn ? "Course (global)" : "강의 (전역)"} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{isEn ? "Global pool" : "전역 공용"}</SelectItem>
                                {courses.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={bankCategory || "none"} onValueChange={(v) => setBankCategory(v === "none" ? "" : v)}>
                              <SelectTrigger><SelectValue placeholder={isEn ? "Category" : "카테고리"} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{isEn ? "No category" : "미분류"}</SelectItem>
                                {categories.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>{isEn ? c.name_en || c.name : c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={1}
                              value={bankPoints}
                              onChange={(e) => setBankPoints(Math.max(1, Number(e.target.value) || 10))}
                              placeholder={isEn ? "Points each" : "문항당 점수"}
                            />
                          </div>
                        )}
                      </div>
                    </label>

                    <label className="flex items-start gap-2 border-2 border-border/80 rounded-md p-3 cursor-pointer">
                      <Checkbox
                        checked={!!saveToAssessment}
                        onCheckedChange={(v) => setSaveToAssessment(v ? (assessmentId || "pick") : "")}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-2 min-w-0">
                        <p className="text-sm font-medium">
                          {isEn ? "Add to specific assessment" : "특정 평가에 바로 추가"}
                        </p>
                        {!!saveToAssessment && (
                          <Select
                            value={saveToAssessment}
                            onValueChange={setSaveToAssessment}
                            disabled={!!assessmentId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={isEn ? "Pick assessment" : "평가 선택"} />
                            </SelectTrigger>
                            <SelectContent>
                              {assessments.map((a: any) => (
                                <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-3 gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>
              {isEn ? "Cancel" : "취소"}
            </Button>
            {generated && generated.length > 0 ? (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {isEn ? "Save selected" : "선택 항목 저장"}
              </Button>
            ) : (
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || types.length === 0}
                size="lg"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEn ? "Generating..." : "생성 중..."}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {isEn ? "Generate" : "문제 생성"}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
