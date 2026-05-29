import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Award } from "lucide-react";

type Program = { id: string; title: string };
type Project = { id: string; title: string };
type Applicant = {
  id: string;
  program_id: string;
  applicant_user_id: string | null;
  applicant_name: string;
  applicant_email: string | null;
  status: string;
};
type Member = {
  id: string;
  project_id: string;
  user_id: string | null;
  member_name: string;
  member_email: string | null;
  role: string | null;
};

export default function CertBulkIssueTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sourceType, setSourceType] = useState<"program" | "project">("program");
  const [sourceId, setSourceId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: programs = [] } = useQuery({
    queryKey: ["bulk_programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programs").select("id, title").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["bulk_projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ia_projects").select("id, title").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["bulk_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ops_cert_templates").select("id, name, is_default").order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: applicants = [] } = useQuery<Applicant[]>({
    queryKey: ["bulk_applicants", sourceId],
    enabled: sourceType === "program" && !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_applications")
        .select("id, program_id, applicant_user_id, applicant_name, applicant_email, status")
        .eq("program_id", sourceId).eq("status", "approved");
      if (error) throw error;
      return (data ?? []) as Applicant[];
    },
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["bulk_members", sourceId],
    enabled: sourceType === "project" && !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ia_project_members")
        .select("id, project_id, user_id, member_name, member_email, role")
        .eq("project_id", sourceId);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const rows = useMemo(() => {
    if (sourceType === "program") {
      return applicants.map((a) => ({
        key: a.id,
        user_id: a.applicant_user_id,
        name: a.applicant_name,
        email: a.applicant_email,
        sub: "승인된 신청자",
      }));
    }
    return members.map((m) => ({
      key: m.id,
      user_id: m.user_id,
      name: m.member_name,
      email: m.member_email,
      sub: m.role || "팀원",
    }));
  }, [sourceType, applicants, members]);

  const sourceTitle = useMemo(() => {
    if (sourceType === "program") return programs.find((p) => p.id === sourceId)?.title || "";
    return projects.find((p) => p.id === sourceId)?.title || "";
  }, [sourceType, sourceId, programs, projects]);

  const toggle = (key: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.key));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.key)));

  const issue = useMutation({
    mutationFn: async () => {
      if (!sourceId) throw new Error("출처를 선택하세요");
      if (selected.size === 0) throw new Error("발급할 대상을 선택하세요");
      const targets = rows.filter((r) => selected.has(r.key));
      const payload = targets.map((t) => ({
        template_id: templateId || null,
        source_type: sourceType,
        source_id: sourceId,
        source_title: sourceTitle,
        recipient_user_id: t.user_id,
        recipient_name: t.name,
        recipient_email: t.email,
      }));
      const { error } = await supabase.from("ops_certificates").insert(payload);
      if (error) throw error;
      return targets.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count}건의 인증서가 발급되었습니다` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["ops_certificates"] });
    },
    onError: (e: any) => toast({ title: "발급 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>출처 종류</Label>
              <Select value={sourceType} onValueChange={(v: any) => { setSourceType(v); setSourceId(""); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="program">프로그램</SelectItem>
                  <SelectItem value="project">산학프로젝트</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{sourceType === "program" ? "프로그램" : "프로젝트"} 선택</Label>
              <Select value={sourceId} onValueChange={(v) => { setSourceId(v); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="선택…" /></SelectTrigger>
                <SelectContent>
                  {(sourceType === "program" ? programs : projects).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>템플릿</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="기본 사용" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " (기본)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {sourceId && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                <span className="text-sm">전체 선택 ({selected.size}/{rows.length})</span>
              </div>
              <Button onClick={() => issue.mutate()} disabled={issue.isPending || selected.size === 0}>
                <Award className="w-4 h-4 mr-1" /> 선택 대상에 발급
              </Button>
            </div>
            <div className="border rounded-md divide-y max-h-[420px] overflow-y-auto">
              {rows.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">대상자가 없습니다.</div>
              ) : rows.map((r) => (
                <label key={r.key} className="flex items-center gap-3 p-3 hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={selected.has(r.key)} onCheckedChange={() => toggle(r.key)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.email || "-"} · {r.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}