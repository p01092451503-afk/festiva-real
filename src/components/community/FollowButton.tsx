import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useIsFollowing, useToggleFollow } from "@/hooks/useFollow";
import { useUser } from "@/contexts/UserContext";

interface FollowButtonProps {
  targetUserId: string;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}

const FollowButton = ({ targetUserId, size = "sm", variant = "outline" }: FollowButtonProps) => {
  const { user } = useUser();
  const { data: isFollowing = false, isLoading } = useIsFollowing(targetUserId);
  const toggle = useToggleFollow(targetUserId);

  if (!user || user.id === targetUserId) return null;

  return (
    <Button
      size={size}
      variant={isFollowing ? "secondary" : variant}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate(isFollowing);
      }}
      disabled={isLoading || toggle.isPending}
      className="gap-1.5 whitespace-nowrap"
    >
      {toggle.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {isFollowing ? "팔로잉" : "팔로우"}
    </Button>
  );
};

export default FollowButton;