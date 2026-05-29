import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, GripVertical, Lock, BookOpen, ChevronDown, ChevronUp, Layers, AlertTriangle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TrackTargetSelector, {
  EMPTY_TRACK_TARGET,
  type TrackTargetValue,
} from "@/components/TrackTargetSelector";
import { formatTrackTargetLabel } from "@/components/trackTargetUtils";

interface Track {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
  target_scope?: string;
  target_country_codes?: string[];
  target_branch_ids?: string[];
  target_user_ids?: string[];
}

interface Step {
  id: string;
  track_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  level_order: number;
  unlock_previous_required: boolean;
  badge_color: string | null;
  require_assessment_pass?: boolean;
}

interface StepCourse {
  id: string;
  step_id: string;
  course_id: string;
  sort_order: number;
  is_required: boolean;
  course?: { id: string; title: string; thumbnail_url: string | null };
}

const DEFAULT_STEPS = [
  { name: "Foundation", name_en: "Foundation", level_order: 0, badge_color: "#10B981" },
  { name: "BASIC", name_en: "BASIC", level_order: 1, badge_color: "#3B82F6" },
  { name: "ADVANCED", name_en: "ADVANCED", level_order: 2, badge_color: "#8B5CF6" },
];

export default function AdminTracks() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [activeTrackForStep, setActiveTrackForStep] = useState<string | null>(null);
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [activeStepForCourse, setActiveStepForCourse] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "track" | "step" | "course"; id: string } | null>(null);

  // Form state
  const [trackForm, setTrackForm] = useState({ name: "", name_en: "", description: "", description_en: "", is_active: true });
  const [trackTarget, setTrackTarget] = useState<TrackTargetValue>(EMPTY_TRACK_TARGET);
  const [stepForm, setStepForm] = useState({ name: "", name_en: "", description: "", description_en: "", level_order: 0, unlock_previous_required: true, badge_color: "#3B82F6", require_assessment_pass: false });
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["admin-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_tracks").select("*").order("sort_order");
      if (error) throw error;
      return data as Track[];
    },
  });

  // Lookup maps for showing readable target labels on each card
  const { data: targetBranches = [] } = useQuery({
    queryKey: ["admin-tracks-target-branches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("entity_type", "branch");
      return data || [];
    },
  });
  const { data: targetUsers = [] } = useQuery({
    queryKey: ["admin-tracks-target-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email");
      return data || [];
    },
  });
  const branchNameMap = Object.fromEntries(targetBranches.map((b) => [b.id, b.name]));
  const userNameMap = Object.fromEntries(
    targetUsers.map((u) => [u.user_id, u.full_name || u.email || u.user_id.slice(0, 8)])
  );

  const { data: steps = [] } = useQuery({
    queryKey: ["admin-track-steps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("track_steps").select("*").order("level_order");
      if (error) throw error;
      return data as Step[];
    },
  });

  const { data: stepCourses = [] } = useQuery({
    queryKey: ["admin-step-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("track_step_courses")
        .select("*, course:courses(id, title, thumbnail_url)")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as StepCourse[];
    },
  });

  const { data: allCourses = [] } = useQuery({
    queryKey: ["all-courses-for-tracks", "published-only-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, thumbnail_url, status")
        .eq("status", "published")
        .neq("status", "archived")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Defensive client-side filter in case stale cache or data drift
      return (data || []).filter((c: any) => c.status === "published") as {
        id: string; title: string; thumbnail_url: string | null; status: string;
      }[];
    },
  });

  // ───── Mutations ─────
  const upsertTrack = useMutation({
    mutationFn: async () => {
      if (editingTrack) {
        const { error } = await supabase.from("learning_tracks").update({
          name: trackForm.name, name_en: trackForm.name_en || null,
          description: trackForm.description || null, description_en: trackForm.description_en || null,
          is_active: trackForm.is_active,
          target_scope: trackTarget.target_scope,
          target_country_codes: trackTarget.target_country_codes,
          target_branch_ids: trackTarget.target_branch_ids,
          target_user_ids: trackTarget.target_user_ids,
        }).eq("id", editingTrack.id);
        if (error) throw error;
        return editingTrack.id;
      } else {
        const maxSort = Math.max(0, ...tracks.map((t) => t.sort_order));
        const { data, error } = await supabase.from("learning_tracks").insert({
          name: trackForm.name, name_en: trackForm.name_en || null,
          description: trackForm.description || null, description_en: trackForm.description_en || null,
          is_active: trackForm.is_active, sort_order: maxSort + 1, created_by: user?.id ?? null,
          target_scope: trackTarget.target_scope,
          target_country_codes: trackTarget.target_country_codes,
          target_branch_ids: trackTarget.target_branch_ids,
          target_user_ids: trackTarget.target_user_ids,
        }).select("id").single();
        if (error) throw error;
        // Auto-create 3 default steps
        await supabase.from("track_steps").insert(
          DEFAULT_STEPS.map((s) => ({ ...s, track_id: data.id, unlock_previous_required: s.level_order > 0 }))
        );
        return data.id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["admin-track-steps"] });
      setTrackDialogOpen(false);
      setEditingTrack(null);
      toast({ title: editingTrack ? t("tracks.trackUpdated") : t("tracks.trackCreated") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const upsertStep = useMutation({
    mutationFn: async () => {
      if (editingStep) {
        const { error } = await supabase.from("track_steps").update({
          name: stepForm.name, name_en: stepForm.name_en || null,
          description: stepForm.description || null,
          description_en: stepForm.description_en || null,
          level_order: stepForm.level_order,
          unlock_previous_required: stepForm.unlock_previous_required, badge_color: stepForm.badge_color,
          require_assessment_pass: stepForm.require_assessment_pass,
        }).eq("id", editingStep.id);
        if (error) throw error;
      } else if (activeTrackForStep) {
        const { error } = await supabase.from("track_steps").insert({
          track_id: activeTrackForStep, name: stepForm.name, name_en: stepForm.name_en || null,
          description: stepForm.description || null,
          description_en: stepForm.description_en || null,
          level_order: stepForm.level_order,
          unlock_previous_required: stepForm.unlock_previous_required, badge_color: stepForm.badge_color,
          require_assessment_pass: stepForm.require_assessment_pass,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-track-steps"] });
      setStepDialogOpen(false);
      setEditingStep(null);
      setActiveTrackForStep(null);
      toast({ title: editingStep ? t("tracks.stepUpdated") : t("tracks.stepAdded") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const addCoursesToStep = useMutation({
    mutationFn: async () => {
      if (!activeStepForCourse) return;
      // Re-fetch latest rows for this step to avoid stale-cache duplicates
      const { data: liveRows, error: fetchErr } = await supabase
        .from("track_step_courses")
        .select("course_id, sort_order")
        .eq("step_id", activeStepForCourse);
      if (fetchErr) throw fetchErr;
      const existingIds = new Set((liveRows ?? []).map((r) => r.course_id));
      const maxSort = Math.max(0, ...(liveRows ?? []).map((r) => r.sort_order ?? 0));
      const toInsert = Array.from(selectedCourseIds).filter((cid) => !existingIds.has(cid));
      if (toInsert.length === 0) return;
      const newRows = toInsert.map((cid, i) => ({
        step_id: activeStepForCourse, course_id: cid, sort_order: maxSort + i + 1, is_required: true,
      }));
      const { error } = await supabase
        .from("track_step_courses")
        .upsert(newRows, { onConflict: "step_id,course_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-step-courses"] });
      setCoursePickerOpen(false);
      setSelectedCourseIds(new Set());
      setActiveStepForCourse(null);
      toast({ title: t("tracks.courseAdded") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      const tableMap = { track: "learning_tracks", step: "track_steps", course: "track_step_courses" } as const;
      const table = tableMap[deleteTarget.type];

      // For step deletion, explicitly clear references in user_track_progress
      // and remove child course mappings first to avoid any RESTRICT/RLS surprises.
      if (deleteTarget.type === "step") {
        await supabase.from("user_track_progress").update({ current_step_id: null }).eq("current_step_id", deleteTarget.id);
        await supabase.from("track_step_courses").delete().eq("step_id", deleteTarget.id);
      }
      if (deleteTarget.type === "track") {
        // Clean up progress rows that reference this track (if any RESTRICT exists)
        await supabase.from("user_track_progress").delete().eq("track_id", deleteTarget.id);
      }

      const { error, count } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .eq("id", deleteTarget.id);
      if (error) {
        console.error("[AdminTracks] delete error:", error);
        throw error;
      }
      if (!count) {
        throw new Error(t("tracks.deleteFailed"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["admin-track-steps"] });
      queryClient.invalidateQueries({ queryKey: ["admin-step-courses"] });
      setDeleteTarget(null);
      toast({ title: t("tracks.deletedToast") });
    },
    onError: (e: Error) =>
      toast({ title: t("tracks.deleteFailed"), description: e.message, variant: "destructive" }),
  });

  // Bulk-translate Korean step descriptions into description_en for all
  // steps where description_en is empty/null.
  const bulkTranslateMissingEn = useMutation({
    mutationFn: async () => {
      const targets = steps.filter(
        (s) =>
          (!s.description_en || s.description_en.trim() === "") &&
          s.description &&
          s.description.trim() !== ""
      );
      if (targets.length === 0) {
        throw new Error(t("tracks.bulkTranslateNoSource"));
      }
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { texts: targets.map((s) => s.description as string) },
      });
      if (error) throw error;
      const translations: string[] = data?.translations ?? [];
      const updates = targets
        .map((s, i) => ({ id: s.id, translated: (translations[i] || "").trim() }))
        .filter((u) => u.translated.length > 0);
      // Update one-by-one (small N, typically a few dozen at most).
      for (const u of updates) {
        const { error: upErr } = await supabase
          .from("track_steps")
          .update({ description_en: u.translated })
          .eq("id", u.id);
        if (upErr) throw upErr;
      }
      return updates.length;
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: ["admin-track-steps"] });
      toast({ title: t("tracks.bulkTranslateDone", { count }) });
    },
    onError: (e: Error) =>
      toast({
        title: t("tracks.bulkTranslateFailed"),
        description: e.message,
        variant: "destructive",
      }),
  });

  const openCreateTrack = () => {
    setEditingTrack(null);
    setTrackForm({ name: "", name_en: "", description: "", description_en: "", is_active: true });
    setTrackTarget(EMPTY_TRACK_TARGET);
    setTrackDialogOpen(true);
  };

  const openEditTrack = (track: Track) => {
    setEditingTrack(track);
    setTrackForm({
      name: track.name, name_en: track.name_en || "",
      description: track.description || "", description_en: track.description_en || "",
      is_active: track.is_active,
    });
    setTrackTarget({
      target_scope: track.target_scope || "all",
      target_country_codes: track.target_country_codes || [],
      target_branch_ids: track.target_branch_ids || [],
      target_user_ids: track.target_user_ids || [],
    });
    setTrackDialogOpen(true);
  };

  const openAddStep = (trackId: string) => {
    setEditingStep(null);
    setActiveTrackForStep(trackId);
    const trackSteps = steps.filter((s) => s.track_id === trackId);
    const nextOrder = Math.max(-1, ...trackSteps.map((s) => s.level_order)) + 1;
    setStepForm({ name: "", name_en: "", description: "", description_en: "", level_order: nextOrder, unlock_previous_required: nextOrder > 0, badge_color: "#3B82F6", require_assessment_pass: false });
    setStepDialogOpen(true);
  };

  const openEditStep = (step: Step) => {
    setEditingStep(step);
    setStepForm({
      name: step.name, name_en: step.name_en || "", description: step.description || "",
      description_en: step.description_en || "",
      level_order: step.level_order, unlock_previous_required: step.unlock_previous_required,
      badge_color: step.badge_color || "#3B82F6",
      require_assessment_pass: step.require_assessment_pass ?? false,
    });
    setStepDialogOpen(true);
  };

  const openCoursePicker = (stepId: string) => {
    setActiveStepForCourse(stepId);
    setSelectedCourseIds(new Set());
    setCoursePickerOpen(true);
  };

  const existingCourseIdsForStep = activeStepForCourse
    ? new Set(stepCourses.filter((sc) => sc.step_id === activeStepForCourse).map((sc) => sc.course_id))
    : new Set<string>();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              {t("tracks.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("tracks.subtitle")}
            </p>
          </div>
          <Button onClick={openCreateTrack}>
            <Plus className="h-4 w-4 mr-2" /> {t("tracks.createTrack")}
          </Button>
        </div>

        {/* Steps missing English description */}
        {(() => {
          const trackNameMap = Object.fromEntries(
            tracks.map((tr) => [tr.id, isEn && tr.name_en ? tr.name_en : tr.name])
          );
          const missing = steps.filter((s) => !s.description_en || s.description_en.trim() === "");
          return (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      {t("tracks.missingEnTitle")}
                      <Badge variant="outline" className="ml-1">
                        {t("tracks.missingEnCount", { count: missing.length })}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("tracks.missingEnSubtitle")}
                    </p>
                  </div>
                  {missing.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkTranslateMissingEn.mutate()}
                      disabled={bulkTranslateMissingEn.isPending}
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      {bulkTranslateMissingEn.isPending
                        ? t("tracks.bulkTranslating")
                        : t("tracks.bulkTranslate")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {missing.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">{t("tracks.missingEnEmpty")}</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {missing.map((step) => {
                      const trackName = trackNameMap[step.track_id] || t("tracks.unknownTrack");
                      const stepLabel = isEn && step.name_en ? step.name_en : step.name;
                      return (
                        <li key={step.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{stepLabel}</span>
                              <span className="text-xs text-muted-foreground">/ {trackName}</span>
                              <Badge variant="secondary" className="text-[10px]">Lv.{step.level_order}</Badge>
                            </div>
                            {step.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {step.description}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditStep(step)}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                            {t("tracks.missingEnEditCta")}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
        ) : tracks.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            {t("tracks.noTracks")}
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {tracks.map((track) => {
              const trackSteps = steps.filter((s) => s.track_id === track.id).sort((a, b) => a.level_order - b.level_order);
              const isExpanded = expandedTrack === track.id;
              const trackDisplayName = isEn && track.name_en ? track.name_en : track.name;
              const trackSecondaryName = isEn && track.name_en ? track.name : track.name_en;
              const trackDisplayDesc = isEn && track.description_en ? track.description_en : track.description;
              return (
                <Card key={track.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{trackDisplayName}</CardTitle>
                        {trackSecondaryName && <span className="text-sm text-muted-foreground">/ {trackSecondaryName}</span>}
                        <Badge variant={track.is_active ? "default" : "secondary"}>
                          {track.is_active ? t("tracks.active") : t("tracks.inactive")}
                        </Badge>
                        <Badge variant="outline">{t("tracks.stepsCount", { count: trackSteps.length })}</Badge>
                      </div>
                      {trackDisplayDesc && (
                        <p className="text-sm text-muted-foreground mt-2">{trackDisplayDesc}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium text-foreground">{t("trackTarget.assignedLabel", "배정 대상")}:</span>{" "}
                        {formatTrackTargetLabel(track.target_scope || "all", {
                          countries: track.target_country_codes,
                          branchNames: (track.target_branch_ids || []).map((id) => branchNameMap[id]).filter(Boolean),
                          userNames: (track.target_user_ids || []).map((id) => userNameMap[id]).filter(Boolean),
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setExpandedTrack(isExpanded ? null : track.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditTrack(track)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: "track", id: track.id })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-3 border-t bg-muted/30">
                      {trackSteps.map((step, idx) => {
                        const courses = stepCourses.filter((sc) => sc.step_id === step.id);
                        const stepDisplayName = isEn && step.name_en ? step.name_en : step.name;
                        const stepSecondaryName = isEn && step.name_en ? step.name : step.name_en;
                        return (
                          <div key={step.id} className="bg-background rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: step.badge_color || "#3B82F6" }}>
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold">{stepDisplayName}</span>
                                    {stepSecondaryName && <span className="text-xs text-muted-foreground">/ {stepSecondaryName}</span>}
                                    {step.unlock_previous_required && idx > 0 && (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Lock className="h-3 w-3" /> {t("tracks.previousRequired")}
                                      </Badge>
                                    )}
                                  </div>
                                  {step.description && <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditStep(step)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: "step", id: step.id })}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div className="pl-11 space-y-2">
                              {courses.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">{t("tracks.noCoursesInStep")}</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {courses.map((sc) => (
                                    <li key={sc.id} className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded px-3 py-1.5">
                                      <span className="flex items-center gap-2 min-w-0">
                                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="truncate">{sc.course?.title || t("tracks.deletedCourse")}</span>
                                      </span>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDeleteTarget({ type: "course", id: sc.id })}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openCoursePicker(step.id)}>
                                <Plus className="h-3.5 w-3.5 mr-1" /> {t("tracks.addCourse")}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" size="sm" onClick={() => openAddStep(track.id)}>
                        <Plus className="h-4 w-4 mr-1" /> {t("tracks.addStep")}
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Track Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={setTrackDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTrack ? t("tracks.trackDialogEdit") : t("tracks.trackDialogCreate")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("tracks.trackNameKo")}</Label>
              <Input value={trackForm.name} onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })} placeholder={t("tracks.trackNameKoPlaceholder")} />
            </div>
            <div>
              <Label>{t("tracks.trackNameEn")}</Label>
              <Input value={trackForm.name_en} onChange={(e) => setTrackForm({ ...trackForm, name_en: e.target.value })} placeholder={t("tracks.trackNameEnPlaceholder")} />
            </div>
            <div>
              <Label>{t("tracks.descriptionKo")}</Label>
              <Textarea value={trackForm.description} onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>{t("tracks.descriptionEn")}</Label>
              <Textarea value={trackForm.description_en} onChange={(e) => setTrackForm({ ...trackForm, description_en: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("tracks.enable")}</Label>
              <Switch checked={trackForm.is_active} onCheckedChange={(v) => setTrackForm({ ...trackForm, is_active: v })} />
            </div>
            <TrackTargetSelector value={trackTarget} onChange={setTrackTarget} />
            {!editingTrack && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                {t("tracks.autoStepsHint")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrackDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => upsertTrack.mutate()} disabled={!trackForm.name.trim() || upsertTrack.isPending}>
              {upsertTrack.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingStep ? t("tracks.stepDialogEdit") : t("tracks.stepDialogCreate")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("tracks.stepNameKo")}</Label>
              <Input value={stepForm.name} onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })} placeholder={t("tracks.stepNameKoPlaceholder")} />
            </div>
            <div>
              <Label>{t("tracks.stepNameEn")}</Label>
              <Input value={stepForm.name_en} onChange={(e) => setStepForm({ ...stepForm, name_en: e.target.value })} />
            </div>
            <div>
              <Label>{t("tracks.description")}</Label>
              <Textarea value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>{t("tracks.descriptionEn")}</Label>
              <Textarea value={stepForm.description_en} onChange={(e) => setStepForm({ ...stepForm, description_en: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("tracks.order")}</Label>
                <Input type="number" value={stepForm.level_order} onChange={(e) => setStepForm({ ...stepForm, level_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>{t("tracks.badgeColor")}</Label>
                <Input type="color" value={stepForm.badge_color} onChange={(e) => setStepForm({ ...stepForm, badge_color: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("tracks.previousRequiredLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("tracks.previousRequiredHint")}</p>
              </div>
              <Switch checked={stepForm.unlock_previous_required} onCheckedChange={(v) => setStepForm({ ...stepForm, unlock_previous_required: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{isEn ? "Require quiz pass to complete" : "퀴즈 합격 필수 (단계 완료 조건)"}</Label>
                <p className="text-xs text-muted-foreground">
                  {isEn
                    ? "Students must pass every assessment in this step's courses, in addition to reaching 100% progress."
                    : "이 단계 강의의 모든 평가를 합격해야 단계가 완료된 것으로 인정됩니다."}
                </p>
              </div>
              <Switch
                checked={stepForm.require_assessment_pass}
                onCheckedChange={(v) => setStepForm({ ...stepForm, require_assessment_pass: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => upsertStep.mutate()} disabled={!stepForm.name.trim() || upsertStep.isPending}>
              {upsertStep.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Picker Dialog */}
      <Dialog open={coursePickerOpen} onOpenChange={setCoursePickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("tracks.coursePickerTitle")}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1">
            {allCourses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">{t("tracks.noPublishedCourses")}</p>
            ) : (
              allCourses.map((c) => {
                const alreadyAdded = existingCourseIdsForStep.has(c.id);
                const isSelected = selectedCourseIds.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-2.5 rounded-md border ${alreadyAdded ? "opacity-50 cursor-not-allowed bg-muted/40" : "cursor-pointer hover:bg-accent"}`}
                  >
                    <Checkbox
                      checked={isSelected || alreadyAdded}
                      disabled={alreadyAdded}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedCourseIds);
                        if (checked) next.add(c.id);
                        else next.delete(c.id);
                        setSelectedCourseIds(next);
                      }}
                    />
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt="" className="h-10 w-16 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-16 bg-muted rounded flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="flex-1 text-sm truncate">{c.title}</span>
                    {alreadyAdded && <Badge variant="outline" className="text-xs">{t("tracks.alreadyAdded")}</Badge>}
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoursePickerOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => addCoursesToStep.mutate()} disabled={selectedCourseIds.size === 0 || addCoursesToStep.isPending}>
              {selectedCourseIds.size > 0 ? t("tracks.addNCourses", { count: selectedCourseIds.size }) : t("tracks.selectFirst")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tracks.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "track" && t("tracks.deleteTrackDesc")}
              {deleteTarget?.type === "step" && t("tracks.deleteStepDesc")}
              {deleteTarget?.type === "course" && t("tracks.deleteCourseDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? t("tracks.deleting") : t("tracks.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}