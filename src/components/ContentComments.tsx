import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, X, Send, Trash2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommentRow {
  id: string;
  content_id: string;
  course_id: string | null;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
  courseId?: string | null;
}

const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일`;
  return `${Math.floor(diff / 86400 / 7)}주`;
}

export function ContentComments({ open, onOpenChange, contentId, courseId }: Props) {
  const { user, profile } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["content-comments", contentId],
    enabled: !!contentId && open,
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from("content_comments")
        .select("*")
        .eq("content_id", contentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CommentRow[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set(comments.map((c) => c.user_id))),
    [comments],
  );

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["content-comments-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Record<string, ProfileLite>> => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      const map: Record<string, ProfileLite> = {};
      for (const p of (data || []) as ProfileLite[]) map[p.user_id] = p;
      return map;
    },
  });

  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const m: Record<string, CommentRow[]> = {};
    for (const c of comments) {
      if (c.parent_id) (m[c.parent_id] = m[c.parent_id] || []).push(c);
    }
    return m;
  }, [comments]);

  const addMutation = useMutation({
    mutationFn: async (payload: { body: string; parent_id: string | null }) => {
      if (!user) throw new Error("login required");
      const { error } = await supabase.from("content_comments").insert({
        content_id: contentId,
        course_id: courseId || null,
        user_id: user.id,
        parent_id: payload.parent_id,
        body: payload.body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      setText("");
      setReplyTo(null);
      if (vars.parent_id) setExpanded((s) => ({ ...s, [vars.parent_id!]: true }));
      qc.invalidateQueries({ queryKey: ["content-comments", contentId] });
    },
    onError: (e: any) => toast({ title: "댓글 작성 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-comments", contentId] }),
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const handleSubmit = () => {
    const body = text.trim();
    if (!body) return;
    if (!user) {
      toast({ title: "로그인이 필요합니다" });
      return;
    }
    addMutation.mutate({ body, parent_id: replyTo?.id ?? null });
  };

  const onReply = (c: CommentRow) => {
    const name = profilesMap[c.user_id]?.full_name || "사용자";
    setReplyTo({ id: c.parent_id || c.id, name });
    setText((t) => (t.startsWith(`@${name} `) ? t : `@${name} `));
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const renderComment = (c: CommentRow, isReply = false) => {
    const p = profilesMap[c.user_id];
    const name = p?.full_name || "사용자";
    const initials = name.slice(0, 1);
    const canDelete = user?.id === c.user_id;
    return (
      <div key={c.id} className={cn("flex gap-3", isReply && "pl-11")}>
        <Avatar className={cn("shrink-0", isReply ? "h-7 w-7" : "h-9 w-9")}>
          <AvatarImage src={p?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug break-words">
            <span className="font-semibold mr-1.5">{name}</span>
            <span className="text-foreground/90 whitespace-pre-wrap">{c.body}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{timeAgo(c.created_at)}</span>
            {!isReply && (
              <button
                className="font-semibold hover:text-foreground transition-colors"
                onClick={() => onReply(c)}
              >
                답글 달기
              </button>
            )}
            {isReply && (
              <button
                className="font-semibold hover:text-foreground transition-colors"
                onClick={() => onReply(c)}
              >
                답글 달기
              </button>
            )}
            {canDelete && (
              <button
                className="hover:text-destructive transition-colors inline-flex items-center gap-1"
                onClick={() => deleteMutation.mutate(c.id)}
                aria-label="삭제"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 [&>button]:hidden"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <div className="w-8" />
          <SheetTitle className="text-base font-semibold">댓글</SheetTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </SheetHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-12">불러오는 중...</div>
          ) : roots.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center mt-8">
              <Heart className="h-14 w-14 text-muted-foreground/40 stroke-[1.5] mb-3" />
              <p className="font-semibold text-foreground">아직 댓글이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">첫 번째 댓글을 남겨보세요!</p>
            </div>
          ) : (
            <ul className="space-y-5">
              {roots.map((c) => {
                const replies = repliesByParent[c.id] || [];
                const isOpen = expanded[c.id];
                return (
                  <li key={c.id} className="space-y-3">
                    {renderComment(c)}
                    {replies.length > 0 && (
                      <div className="pl-11">
                        <button
                          onClick={() =>
                            setExpanded((s) => ({ ...s, [c.id]: !s[c.id] }))
                          }
                          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <span className="h-px w-6 bg-border" />
                          {isOpen ? "답글 숨기기" : `답글 ${replies.length}개 보기`}
                        </button>
                      </div>
                    )}
                    {isOpen && (
                      <div className="space-y-3">
                        {replies.map((r) => renderComment(r, true))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Emoji quick row */}
        <div className="px-3 pt-2 pb-1 border-t border-border flex items-center justify-between gap-1 overflow-x-auto">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setText((t) => t + e);
                inputRef.current?.focus();
              }}
              className="text-xl px-1.5 py-1 hover:scale-125 transition-transform"
              aria-label={`이모지 ${e}`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Reply hint */}
        {replyTo && (
          <div className="px-4 py-1.5 bg-muted/50 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">@{replyTo.name}</span>에게 답글 작성 중
            </span>
            <button
              onClick={() => {
                setReplyTo(null);
                setText("");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              취소
            </button>
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-3 border-t border-border flex items-center gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {profile?.full_name?.slice(0, 1) || "나"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex items-end gap-2 rounded-full bg-muted/60 pl-4 pr-1 py-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, 2000));
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 100) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={user ? "댓글 추가..." : "로그인 후 댓글을 작성할 수 있어요"}
              disabled={!user || addMutation.isPending}
              className="flex-1 bg-transparent text-sm resize-none outline-none py-1.5 max-h-[100px] placeholder:text-muted-foreground/70"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full shrink-0 text-primary hover:text-primary disabled:opacity-40"
              onClick={handleSubmit}
              disabled={!user || !text.trim() || addMutation.isPending}
              aria-label="게시"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface TriggerProps {
  contentId: string;
  courseId?: string | null;
}

export function ContentCommentsTrigger({ contentId, courseId }: TriggerProps) {
  const [open, setOpen] = useState(false);
  const { data: count = 0 } = useQuery({
    queryKey: ["content-comments-count", contentId],
    enabled: !!contentId,
    queryFn: async () => {
      const { count } = await supabase
        .from("content_comments")
        .select("id", { count: "exact", head: true })
        .eq("content_id", contentId);
      return count || 0;
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-3 shadow-lg hover:scale-105 transition-transform"
        aria-label="댓글 열기"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-semibold tabular-nums">{count}</span>
      </button>
      <ContentComments
        open={open}
        onOpenChange={setOpen}
        contentId={contentId}
        courseId={courseId}
      />
    </>
  );
}

export default ContentComments;
