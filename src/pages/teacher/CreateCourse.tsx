import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Video, FileText, BarChart3,
  MonitorPlay, BookOpen, ExternalLink, Link2, Eye, ImagePlus, X, CalendarIcon,
  Save, Languages, Loader2, LayoutGrid, Image as ImageIcon, ChevronUp, Layers,
  ChevronDown, Clock,
} from "lucide-react";
import { translateKoToEn, autoTranslateInBackground } from "@/lib/translate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import CategorySelect from "@/components/CategorySelect";
import { useTranslation } from "react-i18next";
import type { Database } from "@/integrations/supabase/types";
import B2CSaleSettings from "@/components/admin/B2CSaleSettings";
import PaidCourseSettings from "@/components/admin/PaidCourseSettings";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import BunnyUploader from "@/components/admin/BunnyUploader";
import { BulkAddDialog, BulkEditBar, type NewContentDraft } from "@/components/admin/BulkContentTools";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ContentType = Database["public"]["Enums"]["content_type"];
type VideoProvider = Database["public"]["Enums"]["video_provider"];

type ContentSource = "video" | "mangoboard" | "card";

interface ContentItem {
  tempId: string;
  title: string;
  description: string;
  content_type: ContentType;
  video_url: string;
  video_provider: VideoProvider | "";
  duration_minutes: number | null;
  is_preview: boolean;
  is_published: boolean;
  source: ContentSource;
  enTitle: string;
  enDescription: string;
  card_image_url?: string;
  card_urls?: string[];
  transcript?: string;
}

const CreateCourse = () => {
  const navigate = useNavigate();
  const { courseId: editCourseId } = useParams<{ courseId?: string }>();
  const isEditMode = !!editCourseId;
  const { user } = useUser();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const layoutRole = isAdmin ? "admin" : "teacher";
  const { data: siteSettings } = useSiteSettings();
  const b2cEnabled = siteSettings?.b2c_enabled !== false;

  const contentTypeOptions: { value: ContentType; label: string; icon: React.ElementType }[] = [
    { value: "video", label: t("createCourse.videoLabel"), icon: Video },
    { value: "document", label: t("createCourse.documentLabel"), icon: FileText },
    { value: "quiz", label: t("createCourse.quizLabel"), icon: BarChart3 },
    { value: "assignment", label: t("createCourse.assignmentLabel"), icon: FileText },
    { value: "live", label: t("createCourse.liveLabel"), icon: Video },
  ];

  const videoProviderOptions: { value: VideoProvider; label: string }[] = [
    { value: "custom", label: "CDN URL 입력" },
    { value: "upload", label: "CDN 업로드" },
    { value: "youtube", label: "YouTube" },
    { value: "vimeo", label: "Vimeo" },
    { value: "cloudflare" as VideoProvider, label: "Cloudflare Stream" },
    { value: "kollus" as VideoProvider, label: "Kollus" },
  ];

  // Course fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [enTitle, setEnTitle] = useState("");
  const [enDescription, setEnDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState("beginner");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [translatingCourse, setTranslatingCourse] = useState(false);
  const [enTitleManual, setEnTitleManual] = useState(false);
  const [enDescManual, setEnDescManual] = useState(false);
  const [maxStudents, setMaxStudents] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [isSequential, setIsSequential] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("draft");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // B2C fields
  const [isB2c, setIsB2c] = useState(false);
  const [b2cPrice, setB2cPrice] = useState(0);
  const [b2cSalePrice, setB2cSalePrice] = useState<number | null>(null);
  const [b2cSaleEndsAt, setB2cSaleEndsAt] = useState("");

  // Content items
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editDataLoaded, setEditDataLoaded] = useState(false);
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null);

  // Load existing course data for edit mode
  useEffect(() => {
    if (!isEditMode || !editCourseId || editDataLoaded) return;
    (async () => {
      const { data: course, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", editCourseId)
        .single();
      if (error || !course) {
        toast({ title: t("common.error"), description: "강의를 찾을 수 없습니다.", variant: "destructive" });
        navigate(-1);
        return;
      }
      setTitle(course.title || "");
      setDescription(course.description || "");
      setCategoryId(course.category_id || "");
      setDifficultyLevel(course.difficulty_level || "beginner");
      setEstimatedHours(course.estimated_duration_hours ? String(course.estimated_duration_hours) : "");
      setMaxStudents(course.max_students ? String(course.max_students) : "");
      setIsMandatory(course.is_mandatory || false);
      setIsSequential((course as any).is_sequential || false);
      setDeadline(course.deadline || "");
      setStatus(course.status || "draft");
      setIsB2c(course.is_b2c || false);
      setB2cPrice(course.price || 0);
      setB2cSalePrice(course.sale_price ?? null);
      setB2cSaleEndsAt(course.sale_ends_at || "");
      if (course.thumbnail_url) {
        setThumbnailPreview(course.thumbnail_url);
        setExistingThumbnailUrl(course.thumbnail_url);
      }

      // Load course i18n
      const { data: courseI18n } = await supabase
        .from("course_i18n")
        .select("*")
        .eq("course_id", editCourseId)
        .eq("language_code", "en")
        .maybeSingle();
      if (courseI18n) {
        setEnTitle(courseI18n.title || "");
        setEnDescription(courseI18n.description || "");
        // Lock auto KO→EN mirroring so existing EN translations aren't overwritten
        if (courseI18n.title?.trim()) setEnTitleManual(true);
        if (courseI18n.description?.trim()) setEnDescManual(true);
      }

      // Load contents
      const { data: courseContents } = await supabase
        .from("course_contents")
        .select("*")
        .eq("course_id", editCourseId)
        .order("order_index", { ascending: true });

      // Load content i18n
      const { data: contentI18ns } = await supabase
        .from("course_content_i18n")
        .select("*")
        .eq("language_code", "en");

      const i18nMap = new Map((contentI18ns || []).map((i: any) => [i.content_id, i]));

      if (courseContents?.length) {
        setContents(courseContents.map((c: any) => {
          const en = i18nMap.get(c.id);
          const isCard = c.description?.startsWith("[card-content]");
          let cleanDesc = "";
          let cardUrls: string[] = [];
          if (isCard) {
            const payload = c.description.replace("[card-content]", "");
            try {
              const parsed = JSON.parse(payload);
              cleanDesc = parsed.desc || "";
              cardUrls = parsed.urls || [];
            } catch {
              cleanDesc = payload;
            }
          } else {
            cleanDesc = c.description || "";
          }
          return {
            tempId: c.id,
            title: c.title || "",
            description: cleanDesc,
            content_type: c.content_type || "video",
            video_url: c.video_url || "",
            video_provider: c.video_provider || "",
            duration_minutes: c.duration_minutes,
            is_preview: c.is_preview || false,
            is_published: c.is_published || false,
            source: isCard ? "card" as ContentSource : (c.video_url?.includes("mangoboard") ? "mangoboard" as ContentSource : "video" as ContentSource),
            enTitle: en?.title || "",
            enDescription: en?.description || "",
            card_urls: cardUrls.length > 0 ? cardUrls : (isCard && c.video_url ? [c.video_url] : []),
            transcript: (c as any).transcript || "",
          };
        }));
      }
      setEditDataLoaded(true);
      setDraftLoaded(true);
    })();
  }, [isEditMode, editCourseId, editDataLoaded]);

  // Real-time sync KO → EN for course (auto-copy when user hasn't manually edited EN)
  useEffect(() => {
    if (!enTitleManual && title) setEnTitle(title);
  }, [title, enTitleManual]);
  useEffect(() => {
    if (!enDescManual && description) setEnDescription(description);
  }, [description, enDescManual]);

  // Auto-translate course info
  const handleTranslateCourse = async () => {
    const texts = [title, description].filter(Boolean);
    if (!texts.length) return;
    setTranslatingCourse(true);
    try {
      const results = await translateKoToEn(texts);
      let idx = 0;
      if (title) { setEnTitle(results[idx++] || ""); setEnTitleManual(true); }
      if (description) { setEnDescription(results[idx++] || ""); setEnDescManual(true); }
    } catch { /* silent */ }
    finally { setTranslatingCourse(false); }
  };

  const buildDraftData = useCallback(() => ({
    title, description, categoryId, difficultyLevel,
    estimatedHours, maxStudents, isMandatory, deadline, status, contents,
  }), [title, description, categoryId, difficultyLevel, estimatedHours, maxStudents, isMandatory, deadline, status, contents]);

  const saveDraft = useCallback(async () => {
    if (!user) return;
    setSavingDraft(true);
    try {
      await (supabase.from("course_drafts" as any) as any).upsert({
        user_id: user.id,
        draft_data: buildDraftData(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setLastSaved(new Date());
      toast({ title: t("createCourse.draftSaved"), description: t("createCourse.draftSavedDesc") });
    } catch {
      toast({ title: t("createCourse.draftFailed"), description: t("createCourse.draftFailedDesc"), variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  }, [user, buildDraftData, toast, t]);

  useEffect(() => {
    if (!user || draftLoaded || isEditMode) return;
    (async () => {
      const { data } = await (supabase.from("course_drafts" as any) as any).select("draft_data").eq("user_id", user.id).maybeSingle();
      if (data?.draft_data) {
        const d = data.draft_data as any;
        if (d.title) setTitle(d.title);
        if (d.description) setDescription(d.description);
        if (d.categoryId) setCategoryId(d.categoryId);
        if (d.difficultyLevel) setDifficultyLevel(d.difficultyLevel);
        if (d.estimatedHours) setEstimatedHours(d.estimatedHours);
        if (d.maxStudents) setMaxStudents(d.maxStudents);
        if (d.isMandatory != null) setIsMandatory(d.isMandatory);
        if (d.deadline) setDeadline(d.deadline);
        if (d.status) setStatus(d.status);
        if (d.contents?.length) setContents(d.contents.map((c: any) => ({ ...c, source: c.source || (c.video_url?.includes("mangoboard") ? "mangoboard" : "video") })));
        toast({ title: t("createCourse.draftRestored"), description: t("createCourse.draftRestoredDesc") });
      }
      setDraftLoaded(true);
    })();
  }, [user, draftLoaded, isEditMode]);

  const deleteDraft = useCallback(async () => {
    if (!user) return;
    await (supabase.from("course_drafts" as any) as any).delete().eq("user_id", user.id);
  }, [user]);

  const addContent = () => {
    setContents((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        title: "",
        description: "",
        content_type: "video",
        video_url: "",
        video_provider: "",
        duration_minutes: null,
        is_preview: false,
        is_published: true,
        source: "video",
        enTitle: "",
        enDescription: "",
      },
    ]);
  };

  const updateContent = (tempId: string, field: keyof ContentItem, value: any) => {
    setContents((prev) =>
      prev.map((c) => {
        if (c.tempId !== tempId) return c;
        const updated = { ...c, [field]: value };
        // When switching source, reset relevant fields
        if (field === "source") {
          if (value === "mangoboard") {
            updated.content_type = "document";
            updated.video_provider = "custom";
            updated.video_url = "";
            updated.card_image_url = "";
          } else if (value === "card") {
            updated.content_type = "document";
            updated.video_provider = "custom";
            updated.video_url = "";
            updated.card_image_url = "";
          } else {
            updated.content_type = "video";
            updated.video_provider = "";
            updated.video_url = "";
            updated.card_image_url = "";
          }
        }
        // Auto-sync KO → EN for content items (only if EN hasn't been manually set differently)
        if (field === "title" && (c.enTitle === c.title || !c.enTitle)) {
          updated.enTitle = value;
        }
        if (field === "description" && (c.enDescription === c.description || !c.enDescription)) {
          updated.enDescription = value;
        }
        return updated;
      })
    );
  };

  const removeContent = (tempId: string) => {
    setContents((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  // ── Bulk add / edit ──
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());

  const toggleSelected = (tempId: string, checked: boolean) => {
    setSelectedContentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tempId);
      else next.delete(tempId);
      return next;
    });
  };

  const handleBulkAdd = (drafts: NewContentDraft[]) => {
    setContents((prev) => [
      ...prev,
      ...drafts.map((d) => {
        const provider: VideoProvider | "" = (d.video_provider as VideoProvider) || "";
        return {
          tempId: crypto.randomUUID(),
          title: d.title,
          description: "",
          content_type: "video" as ContentType,
          video_url: d.video_url || "",
          video_provider: provider,
          duration_minutes: d.duration_minutes ?? null,
          is_preview: false,
          is_published: true,
          source: "video" as ContentSource,
          enTitle: d.title,
          enDescription: "",
        } as ContentItem;
      }),
    ]);
    toast({ title: `${drafts.length}개의 차시를 추가했습니다.` });
  };

  const applyToSelected = (mutator: (c: ContentItem) => ContentItem) => {
    setContents((prev) =>
      prev.map((c) => (selectedContentIds.has(c.tempId) ? mutator(c) : c)),
    );
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Apply a partial DB update to selected rows AND mirror to local state in one go.
  const applyAndPersistToSelected = async (
    patch: Partial<Pick<ContentItem, "is_published" | "is_preview">>,
    successLabel: string,
  ) => {
    if (selectedContentIds.size === 0) return;

    // Update local state immediately (covers both saved + unsaved rows)
    applyToSelected((c) => ({ ...c, ...patch }));

    if (!isEditMode || !editCourseId) {
      toast({ title: successLabel, description: `${selectedContentIds.size}개 차시에 적용됨` });
      return;
    }

    // Persist only rows that exist in DB (their tempId is the real course_contents.id)
    const dbIds = Array.from(selectedContentIds).filter((id) => UUID_RE.test(id));
    if (dbIds.length === 0) {
      toast({ title: successLabel, description: `${selectedContentIds.size}개 차시에 적용됨 (저장은 전체 저장 시 반영)` });
      return;
    }

    const { error } = await supabase
      .from("course_contents")
      .update(patch)
      .eq("course_id", editCourseId)
      .in("id", dbIds);

    if (error) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["course-contents", editCourseId] });
    toast({
      title: successLabel,
      description: `${dbIds.length}개 차시에 즉시 저장됨`,
    });
  };

  const moveSelected = (direction: "up" | "down") => {
    setContents((prev) => {
      const arr = [...prev];
      const indices = arr
        .map((c, i) => (selectedContentIds.has(c.tempId) ? i : -1))
        .filter((i) => i >= 0);
      if (indices.length === 0) return prev;
      const ordered = direction === "up" ? indices : [...indices].reverse();
      for (const i of ordered) {
        const swap = direction === "up" ? i - 1 : i + 1;
        if (swap < 0 || swap >= arr.length) continue;
        if (selectedContentIds.has(arr[swap].tempId)) continue;
        [arr[i], arr[swap]] = [arr[swap], arr[i]];
      }
      return arr;
    });
  };

  const deleteSelected = () => {
    if (selectedContentIds.size === 0) return;
    if (!confirm(`선택한 ${selectedContentIds.size}개의 차시를 삭제하시겠습니까?`)) return;
    setContents((prev) => prev.filter((c) => !selectedContentIds.has(c.tempId)));
    setSelectedContentIds(new Set());
  };

  const uploadThumbnail = async (courseId: string): Promise<string | null> => {
    if (!thumbnailFile) return null;
    const ext = thumbnailFile.name.split(".").pop();
    const path = `${user!.id}/${courseId}.${ext}`;
    const { error } = await supabase.storage
      .from("course-thumbnails")
      .upload(path, thumbnailFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  const applyImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: t("common.error"), description: t("createCourse.imageSizeError"), variant: "destructive" });
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyImageFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { applyImageFile(file); break; }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) applyImageFile(file);
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setExistingThumbnailUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      let thumbnailUrl = existingThumbnailUrl;
      if (thumbnailFile) {
        thumbnailUrl = await uploadThumbnail(editCourseId!);
      }

      const { error: courseError } = await supabase
        .from("courses")
        .update({
          title,
          description: description || null,
          category_id: categoryId || null,
          difficulty_level: difficultyLevel,
          estimated_duration_hours: estimatedHours ? parseInt(estimatedHours) : null,
          max_students: maxStudents ? parseInt(maxStudents) : null,
          is_mandatory: isMandatory,
          is_sequential: isSequential,
          deadline: deadline || null,
          status,
          thumbnail_url: thumbnailUrl,
          is_b2c: isB2c,
          price: b2cPrice,
          sale_price: b2cSalePrice,
          sale_ends_at: b2cSaleEndsAt || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", editCourseId!);
      if (courseError) throw courseError;

      // Delete existing contents and re-insert
      await supabase.from("course_content_i18n").delete().eq("language_code", "en").in("content_id",
        (await supabase.from("course_contents").select("id").eq("course_id", editCourseId!)).data?.map((c: any) => c.id) || []
      );
      await supabase.from("course_contents").delete().eq("course_id", editCourseId!);

      // Save course i18n
      if (enTitle || enDescription) {
        await supabase.from("course_i18n").upsert({
          course_id: editCourseId!,
          language_code: "en",
          title: enTitle || title,
          description: enDescription || description || null,
        }, { onConflict: "course_id,language_code" });
      }

      if (contents.length > 0) {
        const contentRows = contents.map((c, idx) => ({
          course_id: editCourseId!,
          title: c.title,
          description: c.source === "card" ? `[card-content]${JSON.stringify({ urls: c.card_urls || [], desc: c.description || "" })}` : (c.description || null),
          content_type: c.content_type,
          video_url: c.source === "card" ? (c.card_urls?.[0] || c.video_url || null) : (c.video_url || null),
          video_provider: c.video_provider || null,
          duration_minutes: c.duration_minutes,
          order_index: idx,
          is_preview: c.is_preview,
          is_published: c.is_published,
          transcript: c.transcript?.trim() ? c.transcript.trim() : null,
        }));
        const { data: insertedContents, error: contentError } = await supabase
          .from("course_contents")
          .insert(contentRows)
          .select("id");
        if (contentError) throw contentError;

        // Save content i18n
        if (insertedContents?.length) {
          const i18nRows = insertedContents.map((ic: any, idx: number) => ({
            content_id: ic.id,
            language_code: "en",
            title: contents[idx].enTitle || contents[idx].title,
            description: contents[idx].enDescription || contents[idx].description || null,
          })).filter((r: any) => r.title);
          if (i18nRows.length) {
            await supabase.from("course_content_i18n").insert(i18nRows);
          }
          // Auto-translate any contents where the user did not provide EN
          const contentIdsNeedingAuto = insertedContents
            .map((ic: any, idx: number) => ({ id: ic.id, hasEn: !!contents[idx].enTitle?.trim() }))
            .filter((x: any) => !x.hasEn)
            .map((x: any) => x.id);
          if (contentIdsNeedingAuto.length) autoTranslateInBackground("content", contentIdsNeedingAuto);
        }
      }

      return { id: editCourseId!, title };
    },
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      queryClient.invalidateQueries({ queryKey: ["course", editCourseId] });
      // Auto-translate the course itself if no EN was provided
      if (!enTitle?.trim() && editCourseId) {
        autoTranslateInBackground("course", [editCourseId]);
      }
      toast({ title: t("createCourse.courseUpdated", "강의가 수정되었습니다"), description: title });
      navigate(-1);
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({
          title,
          description: description || null,
          category_id: categoryId || null,
          instructor_id: user!.id,
          difficulty_level: difficultyLevel,
          estimated_duration_hours: estimatedHours ? parseInt(estimatedHours) : null,
          max_students: maxStudents ? parseInt(maxStudents) : null,
          is_mandatory: isMandatory,
          is_sequential: isSequential,
          deadline: deadline || null,
          status,
          is_b2c: isB2c,
          price: b2cPrice,
          sale_price: b2cSalePrice,
          sale_ends_at: b2cSaleEndsAt || null,
        } as any)
        .select()
        .single();
      if (courseError) throw courseError;

      if (thumbnailFile) {
        const thumbnailUrl = await uploadThumbnail(course.id);
        if (thumbnailUrl) {
          await supabase.from("courses").update({ thumbnail_url: thumbnailUrl }).eq("id", course.id);
          course.thumbnail_url = thumbnailUrl;
        }
      }

      // Save course i18n
      if (enTitle || enDescription) {
        await supabase.from("course_i18n").insert({
          course_id: course.id,
          language_code: "en",
          title: enTitle || title,
          description: enDescription || description || null,
        });
      }

      if (contents.length > 0) {
        const contentRows = contents.map((c, idx) => ({
          course_id: course.id,
          title: c.title,
          description: c.source === "card" ? `[card-content]${JSON.stringify({ urls: c.card_urls || [], desc: c.description || "" })}` : (c.description || null),
          content_type: c.content_type,
          video_url: c.source === "card" ? (c.card_urls?.[0] || c.video_url || null) : (c.video_url || null),
          video_provider: c.video_provider || null,
          duration_minutes: c.duration_minutes,
          order_index: idx,
          is_preview: c.is_preview,
          is_published: c.is_published,
          transcript: c.transcript?.trim() ? c.transcript.trim() : null,
        }));
        const { data: insertedContents, error: contentError } = await supabase
          .from("course_contents")
          .insert(contentRows)
          .select("id");
        if (contentError) throw contentError;

        // Save content i18n
        if (insertedContents?.length) {
          const i18nRows = insertedContents.map((ic: any, idx: number) => ({
            content_id: ic.id,
            language_code: "en",
            title: contents[idx].enTitle || contents[idx].title,
            description: contents[idx].enDescription || contents[idx].description || null,
          })).filter((r: any) => r.title);
          if (i18nRows.length) {
            await supabase.from("course_content_i18n").insert(i18nRows);
          }
          const contentIdsNeedingAuto = insertedContents
            .map((ic: any, idx: number) => ({ id: ic.id, hasEn: !!contents[idx].enTitle?.trim() }))
            .filter((x: any) => !x.hasEn)
            .map((x: any) => x.id);
          if (contentIdsNeedingAuto.length) autoTranslateInBackground("content", contentIdsNeedingAuto);
        }
      }

      return course;
    },
    onSuccess: async (course) => {
      await deleteDraft();
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      if (!enTitle?.trim() && course?.id) {
        autoTranslateInBackground("course", [course.id]);
      }
      toast({ title: t("createCourse.courseCreated"), description: t("createCourse.courseCreatedDesc", { title: course.title }) });
      navigate(`/courses/${course.id}`);
    },
    onError: (error: any) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: t("common.error"), description: t("createCourse.titleRequired2"), variant: "destructive" });
      return;
    }
    const invalidContent = contents.find((c) => !c.title.trim());
    if (invalidContent) {
      toast({ title: t("common.error"), description: t("createCourse.contentTitleRequired"), variant: "destructive" });
      return;
    }
    const noUrlMango = contents.find((c) => c.source === "mangoboard" && !c.video_url.trim());
    if (noUrlMango) {
      toast({ title: t("common.error"), description: t("createCourse.flipUrlRequired"), variant: "destructive" });
      return;
    }
    if (isEditMode) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const dateLocale = isEn ? enUS : ko;
  const formatDeadline = (d: string) => {
    const parsed = parse(d, "yyyy-MM-dd", new Date());
    return isEn ? format(parsed, "MMM d, yyyy") : format(parsed, "yyyy년 M월 d일");
  };

  return (
    <DashboardLayout role={layoutRole}>
      <form onSubmit={handleSubmit} className="space-y-8">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("createCourse.backButton")}
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isEditMode ? t("createCourse.editTitle", "강의 수정") : t("createCourse.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode ? t("createCourse.editSubtitle", "강의 정보와 차시를 수정할 수 있습니다.") : t("createCourse.subtitle")}
          </p>
        </div>

        {/* Course Info */}
        <div className="stat-card space-y-5">
          <h2 className="text-base font-semibold text-foreground border-b border-border pb-3">{t("createCourse.courseInfo")}</h2>

          {/* Thumbnail Upload */}
          <div className="space-y-2">
            <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.thumbnailLabel")}</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
            {thumbnailPreview ? (
              <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border">
                <img src={thumbnailPreview} alt={t("createCourse.thumbnailAlt")} className="w-full h-full object-cover" />
                <button type="button" onClick={removeThumbnail} className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} onPaste={handlePaste} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-primary/50 focus:border-primary/50 focus:outline-none flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={0}>
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs">{t("createCourse.thumbnailDropHint")}</span>
              </button>
            )}
          </div>

          <Tabs defaultValue="ko" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="ko" className="flex-1">{t("course.koTab", "한국어")}</TabsTrigger>
              <TabsTrigger value="en" className="flex-1">{t("course.enTab", "English")}</TabsTrigger>
            </TabsList>

            <TabsContent value="ko" className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.courseTitleRequired")}</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("createCourse.courseTitleExample")} className="h-11 rounded-xl border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.descriptionLabel")}</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("createCourse.descriptionPlaceholder2")} className="min-h-[100px] rounded-xl border-border resize-none" />
              </div>
            </TabsContent>

            <TabsContent value="en" className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{t("course.enOptional", "영어 버전 (선택)")}</p>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleTranslateCourse} disabled={translatingCourse || (!title && !description)}>
                  {translatingCourse ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                  {t("course.autoTranslate", "자동 번역")}
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("course.enTitle", "영어 제목")}</label>
                <Input value={enTitle} onChange={(e) => setEnTitle(e.target.value)} placeholder="English title" className="h-11 rounded-xl border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("course.enDescription", "영어 설명")}</label>
                <Textarea value={enDescription} onChange={(e) => setEnDescription(e.target.value)} placeholder="English description" className="min-h-[100px] rounded-xl border-border resize-none" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.categoryLabel2")}</label>
              <CategorySelect value={categoryId} onValueChange={setCategoryId} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.difficultyLabel2")}</label>
              <Select value={difficultyLevel} onValueChange={setDifficultyLevel}>
                <SelectTrigger className="h-11 rounded-xl border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">{t("createCourse.beginnerLevel")}</SelectItem>
                  <SelectItem value="intermediate">{t("createCourse.intermediateLevel")}</SelectItem>
                  <SelectItem value="advanced">{t("createCourse.advancedLevel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.estimatedDurationLabel")}</label>
              <Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder={t("createCourse.estimatedDurationExample")} className="h-11 rounded-xl border-border" min="0" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.maxStudentsLabel")}</label>
              <Input type="number" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} placeholder={t("createCourse.maxStudentsPlaceholder")} className="h-11 rounded-xl border-border" min="1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.deadlineLabelCreate")}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`h-11 w-full rounded-xl border-border justify-start text-left font-normal ${!deadline ? "text-muted-foreground" : ""}`}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? formatDeadline(deadline) : t("createCourse.selectDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-lg border-border" align="start">
                  <Calendar mode="single" locale={dateLocale} selected={deadline ? parse(deadline, "yyyy-MM-dd", new Date()) : undefined} onSelect={(date) => setDeadline(date ? format(date, "yyyy-MM-dd") : "")} initialFocus className="rounded-2xl" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("createCourse.publishStatusLabel")}</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 rounded-xl border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("createCourse.draftPrivate")}</SelectItem>
                  <SelectItem value="published">{t("createCourse.publishedOpen")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{t("createCourse.mandatoryLabel")}</p>
              <p className="text-xs text-muted-foreground">{t("createCourse.mandatoryDesc2")}</p>
            </div>
            <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{t("course.sequentialToggle")}</p>
              <p className="text-xs text-muted-foreground">{t("course.sequentialToggleDesc")}</p>
            </div>
            <Switch checked={isSequential} onCheckedChange={setIsSequential} />
          </div>
        </div>

        {/* Contents */}
        <div className="bg-accent/50 border border-accent rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("createCourse.contentSectionTitle")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("createCourse.contentSectionHint", "동영상 또는 기타 유형의 콘텐츠 차시를 추가하세요")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={() => setBulkAddOpen(true)}
              >
                <Layers className="h-3.5 w-3.5" /> 일괄 추가
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2" onClick={addContent}>
                <Plus className="h-3.5 w-3.5" /> {t("createCourse.addContentBtn")}
              </Button>
            </div>
          </div>

          {contents.length === 0 ? (
            <div className="stat-card text-center py-10 border-dashed">
              <div className="h-12 w-12 rounded-xl bg-accent mx-auto flex items-center justify-center mb-3">
                <MonitorPlay className="h-5 w-5 text-accent-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t("createCourse.emptyContentHint")}</p>
              <div className="flex items-center justify-center gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2" onClick={addContent}>
                  <Plus className="h-3.5 w-3.5" /> {t("createCourse.addFirstContent")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2"
                  onClick={() => setBulkAddOpen(true)}
                >
                  <Layers className="h-3.5 w-3.5" /> 일괄 추가
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <BulkEditBar
                selectedCount={selectedContentIds.size}
                totalCount={contents.length}
                onSelectAll={(all) =>
                  setSelectedContentIds(all ? new Set(contents.map((c) => c.tempId)) : new Set())
                }
                onClear={() => setSelectedContentIds(new Set())}
                providerOptions={videoProviderOptions}
                onApplyPublished={(value) =>
                  applyAndPersistToSelected(
                    { is_published: value },
                    value ? "공개로 변경" : "숨김으로 변경",
                  )
                }
                onApplyPreview={(value) =>
                  applyAndPersistToSelected(
                    { is_preview: value },
                    value ? "미리보기 허용" : "미리보기 차단",
                  )
                }
                onApplyProvider={(value) =>
                  applyToSelected((c) => ({
                    ...c,
                    source: "video",
                    content_type: "video",
                    video_provider: value as VideoProvider,
                  }))
                }
                onApplyDuration={(minutes) =>
                  applyToSelected((c) => ({ ...c, duration_minutes: minutes }))
                }
                onMoveUp={() => moveSelected("up")}
                onMoveDown={() => moveSelected("down")}
                onDelete={deleteSelected}
              />
              {contents.map((content, idx) => (
                <div key={content.tempId} className="flex items-start gap-2">
                  <div className="pt-5">
                    <Checkbox
                      checked={selectedContentIds.has(content.tempId)}
                      onCheckedChange={(v) => toggleSelected(content.tempId, !!v)}
                      aria-label={`${idx + 1}번 차시 선택`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <UnifiedContentEditor
                      content={content}
                      index={idx}
                      onChange={(field, value) => updateContent(content.tempId, field, value)}
                      onRemove={() => removeContent(content.tempId)}
                      contentTypeOptions={contentTypeOptions}
                      videoProviderOptions={videoProviderOptions}
                      t={t}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <BulkAddDialog
          open={bulkAddOpen}
          onOpenChange={setBulkAddOpen}
          providerOptions={videoProviderOptions}
          onAdd={handleBulkAdd}
        />

        {/* B2C Sale Settings - 사이트 설정에서 B2C 기능이 활성화된 경우에만 노출 */}
        {isAdmin && b2cEnabled && (
          <div className="stat-card space-y-5">
            <B2CSaleSettings
              courseId={isEditMode ? editCourseId! : ""}
              isB2c={isB2c}
              setIsB2c={setIsB2c}
              price={b2cPrice}
              setPrice={setB2cPrice}
              salePrice={b2cSalePrice}
              setSalePrice={setB2cSalePrice}
              saleEndsAt={b2cSaleEndsAt}
              setSaleEndsAt={setB2cSaleEndsAt}
              thumbnailUrl={thumbnailPreview}
              contentCount={contents.length}
              status={status}
              onStatusChange={setStatus}
            />
          </div>
        )}

        {/* 유료 강의 판매 상세 설정 — 편집 모드 전용 */}
        {isAdmin && isEditMode && editCourseId && (
          <PaidCourseSettings courseId={editCourseId} />
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
            {t("createCourse.cancel")}
          </Button>
          {!isEditMode && (
            <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={saveDraft} disabled={savingDraft}>
              <Save className="h-4 w-4" />
              {savingDraft ? t("createCourse.savingBtn") : t("createCourse.saveDraftBtn")}
            </Button>
          )}
          <Button type="submit" variant="login" size="xl" disabled={isEditMode ? updateMutation.isPending : createMutation.isPending}>
            {isEditMode
              ? (updateMutation.isPending ? t("createCourse.updatingBtn", "수정 중...") : t("createCourse.updateBtn", "수정하기"))
              : (createMutation.isPending ? t("createCourse.creatingBtn") : t("createCourse.createBtn"))
            }
          </Button>
          {!isEditMode && lastSaved && (
            <span className="text-xs text-muted-foreground ml-auto">
              {t("createCourse.lastSaved", { time: format(lastSaved, "HH:mm:ss") })}
            </span>
          )}
        </div>
      </form>
    </DashboardLayout>
  );
};

/* ───── Unified Content Editor ───── */

const UnifiedContentEditor = ({
  content, index, onChange, onRemove, contentTypeOptions, videoProviderOptions, t,
}: {
  content: ContentItem;
  index: number;
  onChange: (field: keyof ContentItem, value: any) => void;
  onRemove: () => void;
  contentTypeOptions: { value: ContentType; label: string; icon: React.ElementType }[];
  videoProviderOptions: { value: VideoProvider; label: string }[];
  t: any;
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showEn, setShowEn] = useState(false);
  const isMango = content.source === "mangoboard";
  const isCard = content.source === "card";
  const isValidMangoboard = isMango && content.video_url.includes("mangoboard.net");
  const Icon = isCard ? LayoutGrid : isMango ? BookOpen : (contentTypeOptions.find((o) => o.value === content.content_type)?.icon || Video);

  // Real-time sync KO → EN
  useEffect(() => {
    if (!content.enTitle && content.title) onChange("enTitle", content.title);
    if (!content.enDescription && content.description) onChange("enDescription", content.description);
  }, [content.title, content.description]);

  const handleTranslateContent = async () => {
    const texts = [content.title, content.description].filter(Boolean);
    if (!texts.length) return;
    setTranslating(true);
    try {
      const results = await translateKoToEn(texts);
      let idx = 0;
      if (content.title) onChange("enTitle", results[idx++] || "");
      if (content.description) onChange("enDescription", results[idx++] || "");
    } catch { /* silent */ }
    finally { setTranslating(false); }
  };

  const handlePreview = () => {
    if (!isValidMangoboard) return;
    setPreviewError(false);
    setPreviewLoading(true);
    setShowPreview(true);
  };

  // ── Video provider field metadata (matches AdminVideos UX) ──
  const provider = content.video_provider || "";
  const isUploadMode = provider === "upload";
  const isYouTube = provider === "youtube";
  const isVimeo = provider === "vimeo";
  const isCloudflare = provider === "cloudflare";
  const isKollus = provider === "kollus";
  const isCustomCdn = provider === "custom";
  const showVideoControls = content.source === "video";

  const urlMeta = (() => {
    switch (provider) {
      case "youtube":
        return { label: "YouTube 링크", placeholder: "https://www.youtube.com/watch?v=... 또는 https://youtu.be/...", hint: "YouTube 영상 URL을 그대로 붙여넣으세요." };
      case "vimeo":
        return { label: "Vimeo 링크", placeholder: "https://vimeo.com/123456789", hint: "Vimeo 영상 URL을 입력하세요." };
      case "kollus":
        return { label: "Kollus 콘텐츠 키", placeholder: "Kollus 콘텐츠 ID 입력", hint: "Kollus에 등록된 콘텐츠 키를 입력하세요." };
      case "cloudflare":
        return { label: "Cloudflare Stream URL", placeholder: "https://customer-xxxx.cloudflarestream.com/.../manifest/video.m3u8", hint: "Cloudflare Stream의 HLS(.m3u8) 또는 iframe URL을 입력하세요." };
      case "upload":
        return { label: "CDN 업로드", placeholder: "업로드 완료 시 자동 입력", hint: "아래 버튼으로 영상을 직접 CDN에 업로드합니다." };
      case "custom":
      default:
        return { label: "CDN URL", placeholder: "https://cdn.example.com/videos/lesson.mp4", hint: "직접 재생 가능한 MP4·HLS(.m3u8) URL을 입력하세요." };
    }
  })();

  // ── CDN library: registered video_assets for quick selection ──
  const { data: cdnLibrary = [] } = useQuery({
    queryKey: ["video-assets-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("id, title, video_url, video_provider, bunny_video_guid, duration_minutes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const handlePickFromLibrary = (assetId: string) => {
    const asset = cdnLibrary.find((a: any) => a.id === assetId);
    if (!asset) return;
    const url: string = asset.video_url || (asset.bunny_video_guid ? `bunny://${asset.bunny_video_guid}` : "");
    onChange("video_url", url);
    // bunny:// 자산은 업로드 모드로 표시 (Provider 셀렉트와 호환)
    const isBunny = url.startsWith("bunny://") || asset.video_provider === "bunny" || asset.video_provider === "upload";
    onChange("video_provider", (isBunny ? "upload" : (asset.video_provider as VideoProvider) || "custom") as VideoProvider);
    if (asset.duration_minutes != null) onChange("duration_minutes", Math.round(asset.duration_minutes));
    if (!content.title && asset.title) onChange("title", asset.title);
  };

  // duration in minutes (decimal) → split min/sec inputs
  const durMin = content.duration_minutes ?? 0;
  const minPart = Math.floor(Number(durMin) || 0);
  const secPart = Math.round(((Number(durMin) || 0) - minPart) * 60);
  const updateDuration = (m: number, s: number) => {
    const total = Math.round((m + s / 60) * 100) / 100;
    onChange("duration_minutes", total);
  };

  return (
    <div className="stat-card !p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="h-4 w-4" />
          <span className="text-xs font-medium">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isMango || isCard ? "bg-primary/10" : "bg-accent"}`}>
          <Icon className={`h-4 w-4 ${isMango || isCard ? "text-primary" : "text-accent-foreground"}`} />
        </div>
        <Input value={content.title} onChange={(e) => onChange("title", e.target.value)} placeholder={t("createCourse.contentTitlePlaceholder")} className="flex-1 h-9 rounded-lg border-border text-sm" required />
        <button type="button" onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="pl-14 space-y-3">
        {/* Source selector: 동영상 vs 망고보드 vs 카드 */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("createCourse.contentSourceLabel")}</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onChange("source", "video")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
                content.source === "video"
                  ? "bg-accent text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-accent/50"
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              {t("createCourse.sourceVideo")}
            </button>
            <button
              type="button"
              onClick={() => onChange("source", "mangoboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
                isMango
                  ? "bg-accent text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-accent/50"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {t("createCourse.sourceMangoboard")}
            </button>
            <button
              type="button"
              onClick={() => onChange("source", "card")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
                isCard
                  ? "bg-accent text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-accent/50"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t("createCourse.sourceCard", "카드")}
            </button>
          </div>
        </div>

        {isMango ? (
          /* ── Mangoboard fields ── */
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Link2 className="h-3 w-3" /> {t("createCourse.mangoLinkLabel")}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input value={content.video_url} onChange={(e) => { onChange("video_url", e.target.value); setShowPreview(false); setPreviewError(false); }} placeholder="https://www.mangoboard.net/publish/52632315" className="h-9 rounded-lg border-border text-xs pr-8" />
                  {isValidMangoboard && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      </div>
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs shrink-0 h-9" disabled={!isValidMangoboard} onClick={handlePreview}>
                  <Eye className="h-3.5 w-3.5" /> {t("createCourse.preview")}
                </Button>
                {isValidMangoboard && (
                  <a href={normalizeMangoboardUrl(content.video_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0" title={t("createCourse.openNewTab")}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{t("createCourse.mangoHint")}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("createCourse.durationLabel")}</label>
              <Input type="number" value={content.duration_minutes ?? ""} onChange={(e) => onChange("duration_minutes", e.target.value ? parseInt(e.target.value) : null)} placeholder={t("createCourse.durationPlaceholder")} className="h-9 rounded-lg border-border text-xs" min="0" />
            </div>

            {showPreview && isValidMangoboard && (
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Eye className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground truncate">{content.video_url}</span>
                  </div>
                  <button type="button" onClick={() => setShowPreview(false)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2">
                    {t("createCourse.closePreview")}
                  </button>
                </div>
                <div className="relative aspect-video">
                  {previewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">{t("createCourse.loadingText")}</span>
                      </div>
                    </div>
                  )}
                  {previewError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                      <div className="flex flex-col items-center gap-2 text-center px-4">
                        <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                          <ExternalLink className="h-5 w-5 text-destructive" />
                        </div>
                        <p className="text-xs text-muted-foreground">{t("createCourse.previewFailed")}</p>
                        <a href={normalizeMangoboardUrl(content.video_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                          {t("createCourse.openDirectly")}
                        </a>
                      </div>
                    </div>
                  )}
                  <iframe src={normalizeMangoboardUrl(content.video_url)} className="w-full h-full" title={t("createCourse.mangoPreviewTitle")} allowFullScreen onLoad={() => setPreviewLoading(false)} onError={() => { setPreviewLoading(false); setPreviewError(true); }} />
                </div>
              </div>
            )}
          </>
        ) : isCard ? (
          /* ── Card fields (multiple cards, 9:16) ── */
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> 카드 이미지/영상 URL 목록
              </label>
              <p className="text-[10px] text-muted-foreground">
                세로형 카드 (1080×1920) 사이즈의 이미지 또는 영상 링크를 여러 장 등록할 수 있습니다.
              </p>

              {/* Existing card URLs */}
              {(content.card_urls || []).map((url, cardIdx) => (
                <div key={cardIdx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 shrink-0 text-center">{cardIdx + 1}</span>
                  <Input
                    value={url}
                    onChange={(e) => {
                      const newUrls = [...(content.card_urls || [])];
                      newUrls[cardIdx] = e.target.value;
                      onChange("card_urls", newUrls);
                    }}
                    placeholder="이미지 URL 또는 영상 URL"
                    className="h-8 rounded-lg border-border text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newUrls = (content.card_urls || []).filter((_, i) => i !== cardIdx);
                      onChange("card_urls", newUrls);
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {cardIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newUrls = [...(content.card_urls || [])];
                        [newUrls[cardIdx - 1], newUrls[cardIdx]] = [newUrls[cardIdx], newUrls[cardIdx - 1]];
                        onChange("card_urls", newUrls);
                      }}
                      className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors shrink-0"
                      title="위로 이동"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add new card URL */}
              <button
                type="button"
                onClick={() => {
                  const newUrls = [...(content.card_urls || []), ""];
                  onChange("card_urls", newUrls);
                }}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1"
              >
                <Plus className="h-3.5 w-3.5" />
                카드 추가
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("createCourse.durationLabel")}</label>
              <Input type="number" value={content.duration_minutes ?? ""} onChange={(e) => onChange("duration_minutes", e.target.value ? parseInt(e.target.value) : null)} placeholder={t("createCourse.durationPlaceholder")} className="h-9 rounded-lg border-border text-xs" min="0" />
            </div>

            {/* Card previews */}
            {(content.card_urls || []).filter(u => u).length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">미리보기 ({(content.card_urls || []).filter(u => u).length}장)</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {(content.card_urls || []).filter(u => u).map((url, i) => (
                    <div key={i} className="w-24 rounded-lg border border-border overflow-hidden bg-muted/30 shrink-0" style={{ aspectRatio: "9/16" }}>
                      {url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i) ? (
                        <img src={url} alt={`카드 ${i + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <iframe src={url} className="w-full h-full pointer-events-none" title={`카드 ${i + 1}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Video fields ── */
          <>
            {/* Duration is now collapsed under "Advanced" — auto-synced on upload/import */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    소요 시간{" "}
                    {durMin > 0 || (content.duration_minutes ?? 0) > 0 ? (
                      <span className="text-foreground font-medium">
                        {minPart}분 {secPart}초
                      </span>
                    ) : (
                      <span className="italic">자동 동기화 · 필요 시 직접 보정</span>
                    )}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 max-w-xs">
                    <Input
                      type="number"
                      min={0}
                      value={minPart}
                      onChange={(e) => updateDuration(Math.max(0, parseInt(e.target.value || "0", 10) || 0), secPart)}
                      placeholder="분"
                      className="h-9 rounded-lg border-border text-xs flex-1 min-w-0"
                      disabled={isUploadMode}
                    />
                    <span className="text-[10px] text-muted-foreground">분</span>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={secPart}
                      onChange={(e) => updateDuration(minPart, Math.min(59, Math.max(0, parseInt(e.target.value || "0", 10) || 0)))}
                      placeholder="초"
                      className="h-9 rounded-lg border-border text-xs flex-1 min-w-0"
                      disabled={isUploadMode}
                    />
                    <span className="text-[10px] text-muted-foreground">초</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isUploadMode
                      ? "CDN 업로드 완료 시 자동으로 채워집니다."
                      : "CDN 라이브러리에서 선택하거나 업로드 시 자동 입력됩니다. 수동 보정이 필요할 때만 사용하세요."}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {showVideoControls && (
              <div className="space-y-3">
                {/* Provider selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("createCourse.providerLabel")}</label>
                  <Select
                    value={content.video_provider || ""}
                    onValueChange={(v) => {
                      onChange("video_provider", v);
                      // upload 모드 진입/이탈 시 URL 초기화 (잔여값 방지)
                      if (v === "upload" || provider === "upload") {
                        onChange("video_url", "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-border text-xs">
                      <SelectValue placeholder={t("createCourse.providerPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {videoProviderOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* URL input or upload area */}
                {isUploadMode ? (
                  <>
                    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
                      아래 버튼으로 동영상 파일을 선택하면 CDN에 자동 업로드됩니다. 업로드가 완료되면 차시에 자동 연결됩니다.
                    </div>
                    {!content.video_url && (
                      <BunnyUploader
                        title={content.title || "untitled"}
                        onComplete={({ video_guid, file_size_mb, duration_minutes }) => {
                          onChange("video_url", `bunny://${video_guid}`);
                          onChange("video_provider", "upload" as VideoProvider);
                          if (duration_minutes != null) onChange("duration_minutes", duration_minutes);
                        }}
                      />
                    )}
                    {content.video_url && (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px]">
                        <span className="truncate text-muted-foreground">업로드 완료 · 영상이 등록되었습니다</span>
                        <button
                          type="button"
                          onClick={() => onChange("video_url", "")}
                          className="text-destructive hover:underline shrink-0"
                        >
                          다시 업로드
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">{urlMeta.label}</label>
                    {content.video_url?.startsWith("bunny://") ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px]">
                        <span className="truncate text-muted-foreground">
                          ✅ CDN 영상이 연결되어 있습니다 (원본 주소는 보안상 표시되지 않습니다)
                        </span>
                        <button
                          type="button"
                          onClick={() => onChange("video_url", "")}
                          className="text-destructive hover:underline shrink-0 text-[11px]"
                        >
                          연결 해제
                        </button>
                      </div>
                    ) : (
                      <>
                        <Input
                          value={content.video_url}
                          onChange={(e) => onChange("video_url", e.target.value)}
                          placeholder={urlMeta.placeholder}
                          className="h-9 rounded-lg border-border text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">{urlMeta.hint}</p>
                      </>
                    )}
                  </div>
                )}

                {/* CDN library quick-pick */}
                {(isCustomCdn || isUploadMode) && (
                  <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">
                        CDN 라이브러리에서 선택
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        등록된 영상 {cdnLibrary.length}개
                      </span>
                    </div>
                    {cdnLibrary.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        등록된 영상이 없습니다. 위에서 새 영상을 업로드하거나 [관리자 → 동영상 관리]에서 먼저 등록해주세요.
                      </p>
                    ) : (
                      <>
                        <Select onValueChange={handlePickFromLibrary} value="">
                          <SelectTrigger className="h-9 rounded-lg border-border text-xs bg-background">
                            <SelectValue placeholder="업로드된 영상 목록에서 선택" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {cdnLibrary.map((a: any) => {
                              const dur = a.duration_minutes != null ? Math.round(a.duration_minutes) : null;
                              const tag = a.video_provider === "bunny" || a.video_provider === "upload" ? "CDN" : (a.video_provider || "");
                              return (
                                <SelectItem key={a.id} value={a.id} className="text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="truncate">{a.title}</span>
                                    {dur != null && (
                                      <span className="text-[10px] text-muted-foreground shrink-0">· {dur}분</span>
                                    )}
                                    {tag && (
                                      <span className="text-[10px] text-muted-foreground shrink-0 uppercase">· {tag}</span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          선택한 영상이 이 차시에 자동 연결되며 제목·재생시간이 채워집니다.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Common fields */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("createCourse.descLabel")}</label>
          <Textarea value={content.description} onChange={(e) => onChange("description", e.target.value)} placeholder={t("createCourse.contentDescPlaceholder")} className="min-h-[60px] rounded-lg border-border text-xs resize-none" />
        </div>

        {/* 강의 자막 / 대본 — AI 요약·튜터의 핵심 컨텍스트 */}
        <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase">
              강의 자막 / 대본 (AI 요약·튜터용)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {(content.transcript || "").length.toLocaleString()}자
              </span>
              <label className="cursor-pointer text-[10px] text-primary hover:underline">
                파일 업로드 (.vtt/.srt/.txt)
                <input
                  type="file"
                  accept=".vtt,.srt,.txt,text/plain,text/vtt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const raw = await file.text();
                    const parsed = parseTranscriptFile(raw, file.name);
                    onChange("transcript", parsed);
                    e.target.value = "";
                  }}
                />
              </label>
              {content.transcript ? (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={() => onChange("transcript", "")}
                >
                  비우기
                </button>
              ) : null}
            </div>
          </div>
          <Textarea
            value={content.transcript || ""}
            onChange={(e) => onChange("transcript", e.target.value)}
            placeholder="VTT/SRT 파일을 업로드하거나 강의 대본을 붙여넣으세요. 이 내용을 기반으로 AI 요약과 AI 튜터가 답변합니다."
            className="min-h-[80px] rounded-lg border-border text-xs resize-none font-mono"
          />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={content.is_preview} onCheckedChange={(v) => onChange("is_preview", v)} className="scale-75" />
            {t("createCourse.allowPreview")}
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={content.is_published} onCheckedChange={(v) => onChange("is_published", v)} className="scale-75" />
            {t("createCourse.publishToggle")}
          </label>
          <button type="button" onClick={() => setShowEn(!showEn)} className="ml-auto flex items-center gap-1 text-[10px] text-primary hover:underline">
            <Languages className="h-3 w-3" />
            {showEn ? t("course.koTab", "한국어") : "English"}
          </button>
        </div>

        {showEn && (
          <div className="space-y-3 p-3 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">English</span>
              <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={handleTranslateContent} disabled={translating || (!content.title && !content.description)}>
                {translating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Languages className="h-2.5 w-2.5" />}
                {t("course.autoTranslate", "자동 번역")}
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("course.enTitle", "영어 제목")}</label>
              <Input value={content.enTitle} onChange={(e) => onChange("enTitle", e.target.value)} placeholder="English title" className="h-8 rounded-lg border-border text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">{t("course.enDescription", "영어 설명")}</label>
              <Textarea value={content.enDescription} onChange={(e) => onChange("enDescription", e.target.value)} placeholder="English description" className="min-h-[40px] rounded-lg border-border text-xs resize-none" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ───── Helpers ───── */

function normalizeMangoboardUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = "https://" + normalized;
  }
  return normalized;
}

/**
 * VTT/SRT/TXT 파일 텍스트에서 타임코드·큐 번호·태그를 제거하고
 * 순수 대본 텍스트만 반환합니다.
 */
function parseTranscriptFile(raw: string, filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".txt")) {
    return raw.replace(/\r/g, "").trim();
  }
  return raw
    .replace(/^WEBVTT.*$/gim, "")
    .replace(/^NOTE.*$/gim, "")
    .replace(/^\d+\s*$/gm, "")
    .replace(
      /\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}.*$/gm,
      "",
    )
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export default CreateCourse;
