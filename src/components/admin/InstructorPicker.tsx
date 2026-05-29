import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, User, Pencil, BookOpen, X } from "lucide-react";

interface Teacher {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface InstructorProfile {
  user_id: string;
  photo_url: string | null;
  headline: string | null;
  bio: string | null;
  expertise: string[];
  years_experience: number | null;
  website_url: string | null;
  public_email: string | null;
}

interface Props {
  value: string | null;
  onChange: (instructorId: string | null) => void;
}

export default function InstructorPicker({ value, onChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  // Teachers list (users with teacher/admin/super_admin role)
  const { data: teachers = [] } = useQuery({
    queryKey: ["instructor-picker-teachers"],
    queryFn: async (): Promise<Teacher[]> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["teacher", "admin", "super_admin"]);
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", ids);
      return (profs || []) as Teacher[];
    },
  });

  // Selected instructor profile + base profile
  const { data: selectedTeacher } = useQuery({
    queryKey: ["instructor-base-profile", value],
    enabled: !!value,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .eq("user_id", value!)
        .maybeSingle();
      return data as Teacher | null;
    },
  });

  const { data: instructorProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["instructor-profile", value],
    enabled: !!value,
    queryFn: async (): Promise<InstructorProfile | null> => {
      const { data } = await (supabase as any)
        .from("instructor_profiles")
        .select("*")
        .eq("user_id", value)
        .maybeSingle();
      return data;
    },
  });

  const { data: assignedCourses = [] } = useQuery({
    queryKey: ["instructor-assigned-courses", value],
    enabled: !!value,
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, status")
        .eq("instructor_id", value!)
        .order("updated_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium">담당 강사 *</label>
          <Select value={value || ""} onValueChange={(v) => onChange(v || null)}>
            <SelectTrigger>
              <SelectValue placeholder="강사를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {teachers.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground">등록된 강사가 없습니다</div>
              )}
              {teachers.map((tc) => (
                <SelectItem key={tc.user_id} value={tc.user_id}>
                  {tc.full_name || "(이름없음)"} {tc.email ? `· ${tc.email}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!value}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" /> 강사정보 편집
        </Button>
      </div>

      {value && selectedTeacher && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={instructorProfile?.photo_url || selectedTeacher.avatar_url || undefined} />
            <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{selectedTeacher.full_name || "(이름없음)"}</div>
            {instructorProfile?.headline && (
              <div className="text-xs text-muted-foreground truncate">{instructorProfile.headline}</div>
            )}
            {!!instructorProfile?.expertise?.length && (
              <div className="mt-1 flex flex-wrap gap-1">
                {instructorProfile.expertise.slice(0, 6).map((e, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{e}</Badge>
                ))}
              </div>
            )}
            {assignedCourses.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> 담당 강의 {assignedCourses.length}개
              </div>
            )}
          </div>
        </div>
      )}

      {editOpen && value && (
        <InstructorEditDialog
          instructorId={value}
          baseProfile={selectedTeacher || null}
          existing={instructorProfile || null}
          assignedCourses={assignedCourses as any}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            refetchProfile();
            queryClient.invalidateQueries({ queryKey: ["instructor-assigned-courses", value] });
            toast({ title: "강사정보가 저장되었습니다" });
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function InstructorEditDialog({
  instructorId,
  baseProfile,
  existing,
  assignedCourses,
  onClose,
  onSaved,
}: {
  instructorId: string;
  baseProfile: Teacher | null;
  existing: InstructorProfile | null;
  assignedCourses: { id: string; title: string; status: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(existing?.photo_url || "");
  const [headline, setHeadline] = useState(existing?.headline || "");
  const [bio, setBio] = useState(existing?.bio || "");
  const [expertiseText, setExpertiseText] = useState((existing?.expertise || []).join(", "));
  const [years, setYears] = useState<string>(existing?.years_experience?.toString() || "");
  const [website, setWebsite] = useState(existing?.website_url || "");
  const [publicEmail, setPublicEmail] = useState(existing?.public_email || "");
  const [fullName, setFullName] = useState(baseProfile?.full_name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhotoUrl(existing?.photo_url || "");
    setHeadline(existing?.headline || "");
    setBio(existing?.bio || "");
    setExpertiseText((existing?.expertise || []).join(", "));
    setYears(existing?.years_experience?.toString() || "");
    setWebsite(existing?.website_url || "");
    setPublicEmail(existing?.public_email || "");
    setFullName(baseProfile?.full_name || "");
  }, [existing, baseProfile]);

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${instructorId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("instructor-photos").upload(path, file, {
        cacheControl: "3600", upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("instructor-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (e: any) {
      toast({ title: "사진 업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const expertise = expertiseText
        .split(",").map((s) => s.trim()).filter(Boolean);
      const { error } = await (supabase as any)
        .from("instructor_profiles")
        .upsert({
          user_id: instructorId,
          photo_url: photoUrl || null,
          headline: headline || null,
          bio: bio || null,
          expertise,
          years_experience: years === "" ? null : Number(years),
          website_url: website || null,
          public_email: publicEmail || null,
        }, { onConflict: "user_id" });
      if (error) throw error;

      // Optionally update base profile name
      if (fullName && fullName !== baseProfile?.full_name) {
        await supabase.from("profiles").update({ full_name: fullName }).eq("user_id", instructorId);
      }
      onSaved();
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>강사정보 편집</DialogTitle>
          <DialogDescription>강사 사진, 약력, 전문분야 등을 관리합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={photoUrl || undefined} />
              <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                사진 업로드
              </Button>
              {photoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl("")}>
                  <X className="h-4 w-4 mr-1" /> 제거
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">강사 이름</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">한 줄 소개 (헤드라인)</label>
              <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="예: 노동법 전문 변호사 · 20년 경력" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">경력 (년)</label>
              <Input type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">공개 이메일</label>
              <Input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">웹사이트 URL</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">전문 분야 (쉼표로 구분)</label>
              <Input
                value={expertiseText}
                onChange={(e) => setExpertiseText(e.target.value)}
                placeholder="예: 노동법, 인사관리, 산업안전"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">약력 / 소개</label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[120px]"
                placeholder="강사의 학력, 경력, 저서, 강의 이력 등을 자유롭게 작성하세요" />
            </div>
          </div>

          {assignedCourses.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> 담당 강의 ({assignedCourses.length})
              </div>
              <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                {assignedCourses.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.title}</span>
                    <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
