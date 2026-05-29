import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Props = { postId: string; postAuthorId: string };

const QnaAnswers = ({ postId, postAuthorId }: Props) => {
  const { user } = useUser();
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: answers = [] } = useQuery({
    queryKey: ["qna-answers", postId],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_qna_answers" as any)
        .select("*")
        .eq("post_id", postId)
        .order("is_accepted", { ascending: false })
        .order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
  });

  const authorIds = Array.from(new Set(answers.map((a: any) => a.author_id)));
  const { data: authors = [] } = useQuery({
    queryKey: ["qna-authors", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, position")
        .in("user_id", authorIds as string[]);
      return data || [];
    },
  });
  const aMap = new Map((authors as any[]).map((a) => [a.user_id, a]));

  const addAnswer = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) return;
      const { error } = await supabase
        .from("community_qna_answers" as any)
        .insert({ post_id: postId, author_id: user.id, content: content.trim() } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["qna-answers", postId] });
      toast.success("답변이 등록되었습니다.");
    },
    onError: (e: any) => toast.error(e.message || "등록 실패"),
  });

  const accept = useMutation({
    mutationFn: async (answerId: string) => {
      const { error } = await supabase
        .from("community_qna_answers" as any)
        .update({ is_accepted: true } as any)
        .eq("id", answerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qna-answers", postId] });
      toast.success("답변을 채택했습니다.");
    },
    onError: (e: any) => toast.error(e.message || "채택 실패"),
  });

  const remove = useMutation({
    mutationFn: async (answerId: string) => {
      const { error } = await supabase.from("community_qna_answers" as any).delete().eq("id", answerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qna-answers", postId] }),
  });

  const isOwner = user?.id === postAuthorId;
  const hasAccepted = answers.some((a: any) => a.is_accepted);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" /> 답변 {answers.length}
        {hasAccepted && <Badge variant="outline" className="ml-1 text-emerald-700 border-emerald-300">채택 완료</Badge>}
      </h2>

      {user && (
        <div className="space-y-2">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="답변을 작성하세요" rows={4} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => addAnswer.mutate()} disabled={!content.trim() || addAnswer.isPending}>
              답변 등록
            </Button>
          </div>
        </div>
      )}

      <div>
        {answers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">첫 답변을 남겨보세요.</p>
        ) : (
          answers.map((a: any) => {
            const au = aMap.get(a.author_id) as any;
            return (
              <div key={a.id} className={`border-b-2 border-border/80 py-4 ${a.is_accepted ? "bg-emerald-50/40" : ""}`}>
                <div className="flex items-start gap-3">
                  <Link to={`/community/members/${a.author_id}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={au?.avatar_url || undefined} />
                      <AvatarFallback>{au?.full_name?.[0] || "?"}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Link to={`/community/members/${a.author_id}`} className="font-medium text-foreground hover:underline">
                        {au?.full_name || "멤버"}
                      </Link>
                      {au?.position && <span>· {au.position}</span>}
                      <span>·</span>
                      <span>{new Date(a.created_at).toLocaleString("ko-KR")}</span>
                      {a.is_accepted && (
                        <Badge className="ml-1 gap-1 bg-emerald-600 hover:bg-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> 채택됨
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed">{a.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {isOwner && !a.is_accepted && !hasAccepted && (
                        <Button size="sm" variant="outline" onClick={() => accept.mutate(a.id)} className="gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 채택
                        </Button>
                      )}
                      {(user?.id === a.author_id) && (
                        <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => {
                          if (confirm("삭제할까요?")) remove.mutate(a.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default QnaAnswers;