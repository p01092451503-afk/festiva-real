import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Upload, User, Pencil, BookOpen, X, Search, Sparkles, Users, Check,
} from "lucide-react";

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

interface EnrichedInstructor extends Teacher {
  profile: InstructorProfile | null;
  courseCount: number;
}

interface Props {
  value: string | null;
  onChange: (instructorId: string | null) => void;
  categoryId?: string | null;
}

export default function InstructorPicker({ value, onChange, categoryId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

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
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          <label className="text-sm font-medium">담당 강사 <span className="text-destructive">*</span></label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between h-11"
            onClick={() => setMatchOpen(true)}
          >
            {selectedTeacher ? (
              <span className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={instructorProfile?.photo_url || selectedTeacher.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <span className="truncate">{selectedTeacher.full_name || "(이름없음)"}</span>
                {instructorProfile?.headline && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {instructorProfile.headline}</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">강사를 검색·매칭하여 선택하세요</span>
            )}
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 h-11"
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
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {matchOpen && (
        <InstructorMatchDialog
          value={value}
          categoryId={categoryId || null}
          onClose={() => setMatchOpen(false)}
          onPick={(id) => {
            onChange(id);
            setMatchOpen(false);
          }}
        />
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

/* -------------------- 매칭 다이얼로그 -------------------- */
function InstructorMatchDialog({
  value, categoryId, onClose, onPick,
}: {
  value: string | null;
  categoryId: string | null;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "admin">("all");
  const [sortBy, setSortBy] = useState<"match" | "courses" | "experience" | "name">("match");

  // Category name (for recommendation matching)
  const { data: category } = useQuery({
    queryKey: ["match-category", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, name_en, slug")
        .eq("id", categoryId!)
        .maybeSingle();
      return data as { name: string; name_en: string | null; slug: string } | null;
    },
  });

  // All instructors (teachers/admins) + profiles + course counts
  const { data: instructors = [], isLoading } = useQuery({
    queryKey: ["instructor-match-list"],
    queryFn: async (): Promise<EnrichedInstructor[]> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["teacher", "admin", "super_admin"]);
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (ids.length === 0) return [];

      const [{ data: profs }, { data: ipfs }, { data: courses }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, avatar_url").in("user_id", ids),
        (supabase as any).from("instructor_profiles").select("*").in("user_id", ids),
        supabase.from("courses").select("instructor_id").in("instructor_id", ids),
      ]);

      const profileMap = new Map((ipfs || []).map((p: any) => [p.user_id, p as InstructorProfile]));
      const countMap = new Map<string, number>();
      (courses || []).forEach((c: any) => {
        if (!c.instructor_id) return;
        countMap.set(c.instructor_id, (countMap.get(c.instructor_id) || 0) + 1);
      });
      const roleMap = new Map<string, string[]>();
      (roles || []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) || [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });

      return (profs || []).map((p: any) => ({
        ...p,
        profile: profileMap.get(p.user_id) || null,
        courseCount: countMap.get(p.user_id) || 0,
        _roles: roleMap.get(p.user_id) || [],
      } as any));
    },
  });

  // Matching score against category
  const scoreOf = useMemo(() => {
    const tokens: string[] = [];
    if (category?.name) tokens.push(category.name.toLowerCase());
    if (category?.name_en) tokens.push(category.name_en.toLowerCase());
    if (category?.slug) tokens.push(category.slug.toLowerCase());
    return (ins: EnrichedInstructor) => {
      if (tokens.length === 0) return 0;
      const exp = (ins.profile?.expertise || []).map((e) => e.toLowerCase());
      const head = (ins.profile?.headline || "").toLowerCase();
      let s = 0;
      for (const t of tokens) {
        if (exp.some((e) => e.includes(t) || t.includes(e))) s += 3;
        if (head.includes(t)) s += 2;
      }
      return s;
    };
  }, [category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = instructors.filter((i) => {
      if (roleFilter !== "all") {
        const rs = (i as any)._roles as string[];
        if (roleFilter === "teacher" && !rs.includes("teacher")) return false;
        if (roleFilter === "admin" && !(rs.includes("admin") || rs.includes("super_admin"))) return false;
      }
      if (!q) return true;
      const hay = [
        i.full_name, i.email, i.profile?.headline, i.profile?.bio,
        ...(i.profile?.expertise || []),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    list = list.map((i) => ({ ...i, _score: scoreOf(i) } as any));
    list.sort((a: any, b: any) => {
      if (sortBy === "match") {
        if (b._score !== a._score) return b._score - a._score;
        return b.courseCount - a.courseCount;
      }
      if (sortBy === "courses") return b.courseCount - a.courseCount;
      if (sortBy === "experience") return (b.profile?.years_experience || 0) - (a.profile?.years_experience || 0);
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
    return list;
  }, [instructors, search, roleFilter, sortBy, scoreOf]);

  const recommended = useMemo(
    () => (category ? filtered.filter((i: any) => i._score > 0).slice(0, 3) : []),
    [filtered, category]
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> 강사 매칭
          </DialogTitle>
          <DialogDescription>
            이름·이메일·전문분야로 검색하거나, 카테고리 기반 추천 강사를 확인하세요.
            {category && <> 현재 카테고리: <span className="font-medium text-foreground">{category.name}</span></>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 이메일, 한 줄 소개, 전문분야로 검색"
              className="pl-9 h-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 역할</SelectItem>
              <SelectItem value="teacher">강사</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="match">매칭순</SelectItem>
              <SelectItem value="courses">담당강의순</SelectItem>
              <SelectItem value="experience">경력순</SelectItem>
              <SelectItem value="name">이름순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {recommended.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> 카테고리 기반 추천
            </div>
            <div className="flex flex-wrap gap-2">
              {recommended.map((i: any) => (
                <button
                  key={i.user_id}
                  onClick={() => onPick(i.user_id)}
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent transition"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={i.profile?.photo_url || i.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px]"><User className="h-2.5 w-2.5" /></AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{i.full_name || "(이름없음)"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 -mx-2 px-2">
          <div className="space-y-2 pb-2">
            {isLoading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> 강사 목록을 불러오는 중...
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground">
                조건에 맞는 강사가 없습니다.
              </div>
            )}
            {filtered.map((i: any) => {
              const selected = i.user_id === value;
              const matched = i._score > 0;
              return (
                <button
                  key={i.user_id}
                  onClick={() => onPick(i.user_id)}
                  className={`w-full text-left flex items-start gap-3 rounded-lg border p-3 transition hover:bg-accent ${
                    selected ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={i.profile?.photo_url || i.avatar_url || undefined} />
                    <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{i.full_name || "(이름없음)"}</span>
                      {matched && (
                        <Badge variant="secondary" className="gap-1 text-[10px] bg-primary/10 text-primary border-0">
                          <Sparkles className="h-2.5 w-2.5" /> 매칭
                        </Badge>
                      )}
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    {i.profile?.headline && (
                      <div className="text-xs text-muted-foreground truncate">{i.profile.headline}</div>
                    )}
                    {i.email && (
                      <div className="text-[11px] text-muted-foreground truncate">{i.email}</div>
                    )}
                    {!!i.profile?.expertise?.length && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {i.profile.expertise.slice(0, 6).map((e: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-[10px]">{e}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> 강의 {i.courseCount}</span>
                      {i.profile?.years_experience != null && <span>· 경력 {i.profile.years_experience}년</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="text-xs text-muted-foreground mr-auto">총 {filtered.length}명</div>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
