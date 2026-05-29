import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

export function useFollowCounts(userId?: string) {
  return useQuery({
    queryKey: ["follow-counts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("community_follows" as any).select("id", { count: "exact", head: true }).eq("following_id", userId!),
        supabase.from("community_follows" as any).select("id", { count: "exact", head: true }).eq("follower_id", userId!),
      ]);
      return { followers: followers.count || 0, following: following.count || 0 };
    },
  });
}

export function useIsFollowing(targetUserId?: string) {
  const { user } = useUser();
  return useQuery({
    queryKey: ["is-following", user?.id, targetUserId],
    enabled: !!user?.id && !!targetUserId && user!.id !== targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_follows" as any)
        .select("id")
        .eq("follower_id", user!.id)
        .eq("following_id", targetUserId!)
        .maybeSingle();
      return !!data;
    },
  });
}

export function useToggleFollow(targetUserId?: string) {
  const { user } = useUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (!user?.id || !targetUserId) throw new Error("로그인이 필요합니다");
      if (user.id === targetUserId) throw new Error("자기 자신은 팔로우할 수 없습니다");
      if (currentlyFollowing) {
        const { error } = await supabase
          .from("community_follows" as any)
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("community_follows" as any)
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, currentlyFollowing) => {
      toast.success(currentlyFollowing ? "팔로우를 취소했습니다" : "팔로우했습니다");
      qc.invalidateQueries({ queryKey: ["is-following", user?.id, targetUserId] });
      qc.invalidateQueries({ queryKey: ["follow-counts", targetUserId] });
      qc.invalidateQueries({ queryKey: ["follow-counts", user?.id] });
      qc.invalidateQueries({ queryKey: ["my-following-ids", user?.id] });
      qc.invalidateQueries({ queryKey: ["community-feed", user?.id] });
    },
    onError: (e: any) => toast.error(e.message || "처리 중 오류가 발생했습니다"),
  });
}

export function useMyFollowingIds() {
  const { user } = useUser();
  return useQuery({
    queryKey: ["my-following-ids", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_follows" as any)
        .select("following_id")
        .eq("follower_id", user!.id);
      return ((data as any[]) || []).map((r) => r.following_id as string);
    },
  });
}