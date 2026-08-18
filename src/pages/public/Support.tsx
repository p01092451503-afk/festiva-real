import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Megaphone, MessageSquare, HelpCircle, Star, Pin } from "lucide-react";
import { toast } from "sonner";
import StorefrontHeader from "@/components/StorefrontHeader";
import { PageBanner } from "@/components/PagePattern";
import { pageBg } from "@/config/pageBackgrounds";
import SiteFooter from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * 학습운영·문의 (/support)
 * 명세서 3.7 — 공지사항 / 1:1 문의 / FAQ / 리뷰게시판 4개 탭.
 * 콘텐츠는 모두 DB(announcements, support_inquiries, support_faqs, support_reviews) 기반.
 */
const TABS = [
  { value: "notice", label: "공지사항", icon: Megaphone },
  { value: "inquiry", label: "1:1 문의", icon: MessageSquare },
  { value: "faq", label: "FAQ", icon: HelpCircle },
  { value: "review", label: "리뷰게시판", icon: Star },
] as const;

const INQUIRY_TYPES = [
  { value: "course", label: "수강 관련" },
  { value: "payment", label: "결제 관련" },
  { value: "tech", label: "기술 문제" },
  { value: "etc", label: "기타" },
];

const STATUS_LABEL: Record<string, string> = { pending: "접수", answered: "답변 완료", closed: "종료" };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function Support() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab") ?? "notice";
  const tab = TABS.some((t) => t.value === raw) ? raw : "notice";
  const { user } = useUser();
  const queryClient = useQueryClient();

  const [openNotice, setOpenNotice] = useState<any | null>(null);
  const [form, setForm] = useState({ inquiry_type: "course", title: "", content: "" });

  useEffect(() => {
    document.title = "학습운영·문의 | festcert 축제운영전문가 자격증 교육원";
  }, []);

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "notice") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const { data: notices = [] } = useQuery({
    queryKey: ["support-notices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,content,is_pinned,created_at")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: faqs = [] } = useQuery({
    queryKey: ["support-faqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_faqs")
        .select("id,question,answer")
        .eq("is_published", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["support-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_reviews")
        .select("id,author_label,course_label,rating,content,published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myInquiries = [] } = useQuery({
    queryKey: ["support-my-inquiries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_inquiries")
        .select("id,inquiry_type,title,content,status,answer,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitInquiry = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("support_inquiries").insert({
        user_id: user.id,
        inquiry_type: form.inquiry_type,
        title: form.title.trim(),
        content: form.content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("문의가 접수되었습니다. 평일 기준 24시간 이내 답변드립니다.");
      setForm({ inquiry_type: "course", title: "", content: "" });
      queryClient.invalidateQueries({ queryKey: ["support-my-inquiries"] });
    },
    onError: (e: any) => toast.error(e.message ?? "문의 접수에 실패했습니다"),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StorefrontHeader />

      <PageBanner
        config={pageBg("support")}
        eyebrow="SUPPORT"
        title="학습운영·문의"
        description="공지사항과 자주 묻는 질문을 확인하고, 궁금한 점은 1:1 문의로 남겨주세요. 평일 09:00~18:00 · 24시간 내 답변"
      />



      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 min-w-0">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 text-base">
                <t.icon className="w-4 h-4" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 공지사항 */}
          <TabsContent value="notice" className="mt-8">
            {notices.length === 0 ? (
              <p className="text-muted-foreground">등록된 공지가 없습니다.</p>
            ) : (
              <div className="border-t-2 border-border/80">
                {notices.map((n: any) => (
                  <button
                    key={n.id}
                    onClick={() => setOpenNotice(n)}
                    className="w-full text-left grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-1 sm:gap-6 py-5 border-b-2 border-border/80 hover:bg-accent/40 transition-colors px-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {n.is_pinned && <Pin className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />}
                      <span className="font-semibold text-lg truncate">{n.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground sm:text-right whitespace-nowrap">{formatDate(n.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 1:1 문의 */}
          <TabsContent value="inquiry" className="mt-8 space-y-8">
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">1:1 문의하기</h2>
                  <p className="text-sm text-muted-foreground">평일 09:00~18:00 · 24시간 내 답변</p>
                </div>

                {!user ? (
                  <p className="text-muted-foreground">문의 접수는 로그인 후 이용할 수 있습니다.</p>
                ) : (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!form.title.trim() || !form.content.trim()) {
                        toast.error("제목과 내용을 입력해 주세요");
                        return;
                      }
                      submitInquiry.mutate();
                    }}
                  >
                    <div className="space-y-2 max-w-xs">
                      <Label htmlFor="inquiry-type">문의 유형</Label>
                      <Select value={form.inquiry_type} onValueChange={(v) => setForm((f) => ({ ...f, inquiry_type: v }))}>
                        <SelectTrigger id="inquiry-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INQUIRY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inquiry-title">제목</Label>
                      <Input id="inquiry-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inquiry-content">내용</Label>
                      <Textarea id="inquiry-content" rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} required />
                    </div>
                    <Button type="submit" size="lg" disabled={submitInquiry.isPending}>문의 접수하기</Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {user && myInquiries.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-lg font-semibold">내 문의 내역</h3>
                <div className="border-t-2 border-border/80">
                  {myInquiries.map((q: any) => (
                    <div key={q.id} className="py-5 border-b-2 border-border/80 space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{INQUIRY_TYPES.find((t) => t.value === q.inquiry_type)?.label ?? "기타"}</Badge>
                        <Badge variant={q.status === "answered" ? "default" : "secondary"}>{STATUS_LABEL[q.status] ?? q.status}</Badge>
                        <span className="font-semibold">{q.title}</span>
                        <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">{formatDate(q.created_at)}</span>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{q.content}</p>
                      {q.answer && (
                        <div className="bg-brand-blue-light rounded-md p-4 whitespace-pre-wrap leading-relaxed">
                          <span className="font-semibold text-navy">답변 </span>
                          {q.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq" className="mt-8">
            <Accordion type="single" collapsible className="border-t-2 border-border/80">
              {faqs.map((f: any) => (
                <AccordionItem key={f.id} value={f.id} className="border-b-2 border-border/80">
                  <AccordionTrigger className="text-left text-lg font-semibold">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed text-base">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* 리뷰게시판 */}
          <TabsContent value="review" className="mt-8 space-y-4">
            {reviews.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="p-6 space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-lg">{r.author_label}</span>
                    <Badge variant="outline">{r.course_label}</Badge>
                    <span className="text-brand-orange tracking-tight" aria-label={`평점 ${r.rating}점`}>
                      {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">{formatDate(r.published_at)}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{r.content}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!openNotice} onOpenChange={(o) => !o && setOpenNotice(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{openNotice?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{openNotice && formatDate(openNotice.created_at)}</p>
          <p className="whitespace-pre-wrap leading-relaxed text-base">{openNotice?.content}</p>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
