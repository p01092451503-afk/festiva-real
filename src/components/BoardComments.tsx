import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, MessageSquare, Edit, Check, X } from "lucide-react";
import { toast } from "sonner";

interface BoardCommentsProps {
  postId: string;
}

const BoardComments = ({ postId }: BoardCommentsProps) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["board-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_comments" as any)
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["comment-profiles", postId],
    queryFn: async () => {
      if (comments.length === 0) return [];
      const authorIds = [...new Set(comments.map((c: any) => c.author_id))];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);
      return data || [];
    },
    enabled: comments.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("board_comments" as any).insert({
        post_id: postId,
        author_id: user!.id,
        content: newComment.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["board-comments", postId] });
    },
    onError: () => toast.error(t("common.error")),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("board_comments" as any)
        .update({ content: editContent.trim(), updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["board-comments", postId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("board_comments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-comments", postId] }),
  });

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        {t("board.comments", "댓글")} ({comments.length})
      </h3>

      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((c: any) => (
            <div key={c.id} className="group">
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground shrink-0">
                  {(profileMap.get(c.author_id) || "?")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {profileMap.get(c.author_id) || t("common.anonymous", "익명")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  {editingId === c.id ? (
                    <div className="mt-1 flex gap-1.5">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="text-xs min-h-[60px] flex-1"
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateMutation.mutate(c.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{c.content}</p>
                  )}
                </div>
                {editingId !== c.id && user?.id === c.author_id && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => { setEditingId(c.id); setEditContent(c.content); }}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {user && (
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t("board.commentPlaceholder", "댓글을 입력하세요...")}
            className="text-xs min-h-[60px] flex-1 resize-none"
          />
          <Button
            size="sm"
            className="self-end text-xs"
            disabled={!newComment.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            {t("board.submitComment", "등록")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default BoardComments;
