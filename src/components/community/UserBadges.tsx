import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as Icons from "lucide-react";

type Props = { userId: string; size?: "sm" | "md" };

const UserBadges = ({ userId, size = "md" }: Props) => {
  const { data: badges = [] } = useQuery({
    queryKey: ["user-badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_user_badges" as any)
        .select("badge_id, awarded_at, community_badges:badge_id(code, name, description, icon, color)")
        .eq("user_id", userId);
      return (data as any[]) || [];
    },
  });

  if (badges.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b: any) => {
          const meta = b.community_badges || {};
          const IconComp = (meta.icon && (Icons as any)[meta.icon]) || Icons.Award;
          return (
            <Tooltip key={b.badge_id}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`gap-1 ${size === "sm" ? "text-[10px] px-1.5 py-0" : ""}`}>
                  <IconComp className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} text-primary`} />
                  {meta.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{meta.name}</p>
                {meta.description && <p className="text-xs text-muted-foreground">{meta.description}</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default UserBadges;