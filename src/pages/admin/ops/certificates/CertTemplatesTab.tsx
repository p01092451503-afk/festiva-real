import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star } from "lucide-react";

type Template = {
  id: string;
  name: string;
  cert_type: string;
  title: string;
  subtitle_en: string;
  body_template: string;
  issuer_name: string | null;
  issuer_title: string | null;
  accent_color: string;
  is_default: boolean;
};

const empty = (): Partial<Template> => ({
  name: "",
  cert_type: "completion",
  title: "수 료 증",
  subtitle_en: "Certificate of Completion",
  body_template: "위 사람은 {{program_title}}을(를) 성실히 이수하였기에 이 증서를 수여합니다.",
  issuer_name: "",
  issuer_title: "",
  accent_color: "#3182F6",
  is_default: false,
});

export default function CertTemplatesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["ops_cert_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ops_cert_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const save = useMutation({
    mutationFn: async (t: Partial<Template>) => {
      const payload: any = { ...t };
      if (!payload.name?.trim()) throw new Error("템플릿 이름을 입력하세요");
      if (t.id) {
        const { error } = await supabase.from("ops_cert_templates").update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ops_cert_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "저장되었습니다" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["ops_cert_templates"] });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ops_cert_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다" });
      qc.invalidateQueries({ queryKey: ["ops_cert_templates"] });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing(empty())}>
          <Plus className="w-4 h-4 mr-1" /> 새 템플릿
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">템플릿이 없습니다. 새 템플릿을 만들어주세요.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-1">
                      {t.is_default && <Star className="w-4 h-4 fill-current text-amber-500" />}
                      {t.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.cert_type === "completion" ? "수료증" : "참가확인서"}</div>
                  </div>
                  <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: t.accent_color }} />
                </div>
                <div className="text-sm font-medium">{t.title}</div>
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body_template}</p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(t)}><Pencil className="w-3 h-3 mr-1" />수정</Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("삭제하시겠습니까?")) remove.mutate(t.id); }}>
                    <Trash2 className="w-3 h-3 mr-1" />삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.id ? "템플릿 수정" : "새 템플릿"}</DialogTitle>
                <DialogDescription>본문에서 <code>{`{{program_title}}`}</code>, <code>{`{{recipient_name}}`}</code> 토큰을 사용할 수 있습니다.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>이름 *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>종류</Label>
                    <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={editing.cert_type ?? "completion"}
                      onChange={(e) => setEditing({ ...editing, cert_type: e.target.value })}>
                      <option value="completion">수료증</option>
                      <option value="participation">참가확인서</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>강조 색상</Label>
                    <Input type="color" value={editing.accent_color ?? "#3182F6"} onChange={(e) => setEditing({ ...editing, accent_color: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>제목(국문)</Label>
                    <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>제목(영문)</Label>
                    <Input value={editing.subtitle_en ?? ""} onChange={(e) => setEditing({ ...editing, subtitle_en: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>본문</Label>
                  <Textarea rows={4} value={editing.body_template ?? ""} onChange={(e) => setEditing({ ...editing, body_template: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>발급자</Label>
                    <Input value={editing.issuer_name ?? ""} onChange={(e) => setEditing({ ...editing, issuer_name: e.target.value })} placeholder="사업단장" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>발급자 직함</Label>
                    <Input value={editing.issuer_title ?? ""} onChange={(e) => setEditing({ ...editing, issuer_title: e.target.value })} placeholder="OO대학교 OO사업단" />
                  </div>
                </div>
                <div className="flex items-center justify-between border rounded-md px-3 py-2">
                  <Label>기본 템플릿으로 설정</Label>
                  <Switch checked={!!editing.is_default} onCheckedChange={(c) => setEditing({ ...editing, is_default: c })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
                <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>저장</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}