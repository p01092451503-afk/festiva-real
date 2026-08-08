import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users2, Plus, Trash2, Award, Percent } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

/** 회원 그룹 / 회원 등급 / 강의별 그룹·등급 할인 관리 */
const AdminMemberGroups = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState("groups");

  // form states
  const [groupForm, setGroupForm] = useState({ name: "", code: "", discount_percent: "0" });
  const [gradeForm, setGradeForm] = useState({ name: "", code: "", rank: "0", discount_percent: "0" });
  const [discForm, setDiscForm] = useState({ course_id: "", target_type: "group", ref_id: "", discount_type: "percent", discount_value: "0" });
  const [memberEmail, setMemberEmail] = useState("");
  const [memberGroupId, setMemberGroupId] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["member-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_groups").select("*").order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["member-grades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("member_grades").select("*").order("rank");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, title").order("title").limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ["course-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_discounts")
        .select("*, courses(title), member_groups(name), member_grades(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["member-group-members", memberGroupId],
    enabled: !!memberGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_group_members")
        .select("id, user_id, profiles:user_id(full_name, email)")
        .eq("group_id", memberGroupId);
      if (error) throw error;
      return data as any[];
    },
  });

  const run = (fn: () => Promise<any>, msg: string, keys: string[]) =>
    fn()
      .then(() => {
        toast.success(msg);
        keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      })
      .catch((e: any) => toast.error(e.message));

  const addGroup = () =>
    run(async () => {
      if (!groupForm.name.trim()) throw new Error("그룹명을 입력하세요.");
      const { error } = await supabase.from("member_groups").insert({
        name: groupForm.name.trim(),
        code: groupForm.code.trim() || null,
        discount_percent: Number(groupForm.discount_percent) || 0,
      });
      if (error) throw error;
      setGroupForm({ name: "", code: "", discount_percent: "0" });
    }, "그룹이 추가되었습니다.", ["member-groups"]);

  const addGrade = () =>
    run(async () => {
      if (!gradeForm.name.trim()) throw new Error("등급명을 입력하세요.");
      const { error } = await supabase.from("member_grades").insert({
        name: gradeForm.name.trim(),
        code: gradeForm.code.trim() || null,
        rank: Number(gradeForm.rank) || 0,
        discount_percent: Number(gradeForm.discount_percent) || 0,
      });
      if (error) throw error;
      setGradeForm({ name: "", code: "", rank: "0", discount_percent: "0" });
    }, "등급이 추가되었습니다.", ["member-grades"]);

  const addDiscount = () =>
    run(async () => {
      if (!discForm.course_id || !discForm.ref_id) throw new Error("강의와 대상을 선택하세요.");
      const { error } = await supabase.from("course_discounts").insert({
        course_id: discForm.course_id,
        target_type: discForm.target_type,
        group_id: discForm.target_type === "group" ? discForm.ref_id : null,
        grade_id: discForm.target_type === "grade" ? discForm.ref_id : null,
        discount_type: discForm.discount_type,
        discount_value: Number(discForm.discount_value) || 0,
      });
      if (error) throw error;
      setDiscForm({ ...discForm, ref_id: "", discount_value: "0" });
    }, "할인 정책이 추가되었습니다.", ["course-discounts"]);

  const addMember = () =>
    run(async () => {
      if (!memberGroupId) throw new Error("그룹을 먼저 선택하세요.");
      const { data: p, error: e0 } = await supabase
        .from("profiles").select("user_id").eq("email", memberEmail.trim()).maybeSingle();
      if (e0) throw e0;
      if (!p) throw new Error("해당 이메일의 회원을 찾을 수 없습니다.");
      const { error } = await supabase.from("member_group_members").insert({ group_id: memberGroupId, user_id: p.user_id });
      if (error) throw error;
      setMemberEmail("");
    }, "회원이 그룹에 추가되었습니다.", ["member-group-members"]);

  const del = (table: "member_groups" | "member_grades" | "course_discounts" | "member_group_members", id: string, key: string) =>
    run(async () => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    }, "삭제되었습니다.", [key]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Users2 className="h-6 w-6" /> 회원 그룹·등급 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            그룹/등급을 만들고, 강의별로 그룹·등급 할인을 설정합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="groups">회원 그룹</TabsTrigger>
            <TabsTrigger value="grades">회원 등급</TabsTrigger>
            <TabsTrigger value="discounts">강의별 할인</TabsTrigger>
          </TabsList>

          {/* 그룹 */}
          <TabsContent value="groups" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4 items-end">
              <div className="min-w-0">
                <Label>그룹명</Label>
                <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="예) 임직원" />
              </div>
              <div className="min-w-0">
                <Label>코드</Label>
                <Input value={groupForm.code} onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })} placeholder="STAFF" />
              </div>
              <div className="min-w-0">
                <Label>기본 할인율(%)</Label>
                <Input type="number" value={groupForm.discount_percent} onChange={(e) => setGroupForm({ ...groupForm, discount_percent: e.target.value })} />
              </div>
              <Button onClick={addGroup}><Plus className="h-4 w-4 mr-1" /> 그룹 추가</Button>
            </div>

            <div className="border rounded-xl divide-y">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-3 p-3 min-w-0">
                  <span className="font-medium truncate">{g.name}</span>
                  {g.code && <Badge variant="outline" className="whitespace-nowrap">{g.code}</Badge>}
                  <Badge variant="secondary" className="whitespace-nowrap">{g.discount_percent}%</Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setMemberGroupId(g.id); }}>회원 보기</Button>
                    <Button size="sm" variant="ghost" onClick={() => del("member_groups", g.id, "member-groups")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 그룹이 없습니다.</p>}
            </div>

            {memberGroupId && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">그룹 소속 회원</h2>
                <div className="flex gap-2 max-w-md">
                  <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="추가할 회원 이메일" />
                  <Button onClick={addMember}>추가</Button>
                </div>
                <div className="border rounded-xl divide-y">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 min-w-0">
                      <span className="truncate">{m.profiles?.full_name || "-"}</span>
                      <span className="text-xs text-muted-foreground truncate">{m.profiles?.email}</span>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => del("member_group_members", m.id, "member-group-members")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {members.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">소속 회원이 없습니다.</p>}
                </div>
              </div>
            )}
          </TabsContent>

          {/* 등급 */}
          <TabsContent value="grades" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-5 items-end">
              <div className="min-w-0">
                <Label>등급명</Label>
                <Input value={gradeForm.name} onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })} placeholder="예) VIP" />
              </div>
              <div className="min-w-0">
                <Label>코드</Label>
                <Input value={gradeForm.code} onChange={(e) => setGradeForm({ ...gradeForm, code: e.target.value })} placeholder="VIP" />
              </div>
              <div className="min-w-0">
                <Label>순위</Label>
                <Input type="number" value={gradeForm.rank} onChange={(e) => setGradeForm({ ...gradeForm, rank: e.target.value })} />
              </div>
              <div className="min-w-0">
                <Label>기본 할인율(%)</Label>
                <Input type="number" value={gradeForm.discount_percent} onChange={(e) => setGradeForm({ ...gradeForm, discount_percent: e.target.value })} />
              </div>
              <Button onClick={addGrade}><Plus className="h-4 w-4 mr-1" /> 등급 추가</Button>
            </div>

            <div className="border rounded-xl divide-y">
              {grades.map((g) => (
                <div key={g.id} className="flex items-center gap-3 p-3 min-w-0">
                  <Award className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{g.name}</span>
                  <Badge variant="outline" className="whitespace-nowrap">순위 {g.rank}</Badge>
                  <Badge variant="secondary" className="whitespace-nowrap">{g.discount_percent}%</Badge>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => del("member_grades", g.id, "member-grades")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {grades.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 등급이 없습니다.</p>}
            </div>
          </TabsContent>

          {/* 강의별 할인 */}
          <TabsContent value="discounts" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-5 items-end">
              <div className="min-w-0">
                <Label>강의</Label>
                <Select value={discForm.course_id} onValueChange={(v) => setDiscForm({ ...discForm, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label>대상 유형</Label>
                <Select value={discForm.target_type} onValueChange={(v) => setDiscForm({ ...discForm, target_type: v, ref_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">회원 그룹</SelectItem>
                    <SelectItem value="grade">회원 등급</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label>대상</Label>
                <Select value={discForm.ref_id} onValueChange={(v) => setDiscForm({ ...discForm, ref_id: v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {(discForm.target_type === "group" ? groups : grades).map((x: any) => (
                      <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label>할인</Label>
                <div className="flex gap-2">
                  <Select value={discForm.discount_type} onValueChange={(v) => setDiscForm({ ...discForm, discount_type: v })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="amount">원</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={discForm.discount_value} onChange={(e) => setDiscForm({ ...discForm, discount_value: e.target.value })} />
                </div>
              </div>
              <Button onClick={addDiscount}><Plus className="h-4 w-4 mr-1" /> 할인 추가</Button>
            </div>

            <div className="border rounded-xl divide-y">
              {discounts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 min-w-0">
                  <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{d.courses?.title}</span>
                  <Badge variant="outline" className="whitespace-nowrap">
                    {d.target_type === "group" ? `그룹 · ${d.member_groups?.name ?? "-"}` : `등급 · ${d.member_grades?.name ?? "-"}`}
                  </Badge>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {d.discount_type === "percent" ? `${d.discount_value}%` : `${Number(d.discount_value).toLocaleString()}원`}
                  </Badge>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => del("course_discounts", d.id, "course-discounts")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {discounts.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 할인 정책이 없습니다.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminMemberGroups;
