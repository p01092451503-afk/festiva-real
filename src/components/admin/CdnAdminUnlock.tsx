import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Hides CDN/원본 영상 주소(예: bunny://GUID, .m3u8 등)를 기본으로 마스킹하고,
 * 관리자가 본인 비밀번호를 다시 입력해야만 일시적으로 노출/복사할 수 있게 합니다.
 *
 * 사용 예:
 *   const { unlocked, button, dialog, mask } = useCdnAdminUnlock();
 *   return (<>
 *     {button}
 *     {dialog}
 *     <span>{mask(url)}</span>
 *   </>);
 */
export function maskCdnUrl(url?: string | null): string {
  if (!url) return "—";
  if (url.startsWith("bunny://")) return "bunny://••••••••  (CDN 보호됨)";
  // m3u8 / mp4 직접 주소 같은 것도 도메인만 남기고 가립니다.
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/••••••••  (보호됨)`;
  } catch {
    return "•••••• (보호됨)";
  }
}

export function useCdnAdminUnlock() {
  const { user } = useUser();
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    if (!user?.email) {
      toast({ title: "사용자 정보를 확인할 수 없습니다.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwd,
    });
    setLoading(false);
    if (error) {
      toast({ title: "비밀번호가 올바르지 않습니다.", variant: "destructive" });
      return;
    }
    setUnlocked(true);
    setOpen(false);
    setPwd("");
    toast({ title: "CDN 주소가 일시적으로 노출됩니다." });
  };

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => (unlocked ? setUnlocked(false) : setOpen(true))}
    >
      {unlocked ? (
        <>
          <EyeOff className="h-4 w-4 mr-1" /> CDN 주소 가리기
        </>
      ) : (
        <>
          <Lock className="h-4 w-4 mr-1" /> CDN 주소 보기
        </>
      )}
    </Button>
  );

  const dialog = (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPwd(""); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> 관리자 인증
          </DialogTitle>
          <DialogDescription>
            CDN 원본 주소(GUID 포함)는 보안상 기본 숨김 처리되어 있습니다. 본인
            계정의 비밀번호를 다시 입력하시면 일시적으로 노출됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">비밀번호</Label>
          <Input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && pwd && !loading) verify();
            }}
            placeholder="현재 로그인 비밀번호"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button onClick={verify} disabled={!pwd || loading}>
            {loading ? "확인 중..." : "확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { unlocked, button, dialog, mask: maskCdnUrl };
}
