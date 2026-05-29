import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

/**
 * 콘텐츠 플레이어 보호 레이어 (Tier 1).
 *
 * 적용 효과:
 * - 우클릭 / 텍스트 선택 / 드래그 / 길게 누르기 메뉴 차단
 * - 개발자도구 단축키 (F12, Ctrl+Shift+I/J/C, Ctrl+U) 차단
 * - 인쇄(Ctrl+P) / 저장(Ctrl+S) 차단
 * - PrintScreen 키 감지 시 경고 토스트
 *
 * 한계: 이 코드로는 OS 레벨 스크린샷·화면녹화(예: Win+Shift+S, ⌘+Shift+4,
 * 스마트폰 전원+볼륨, Xbox Game Bar, QuickTime)는 절대 막을 수 없습니다.
 * 외부 카메라 촬영 역시 불가능합니다. 완전 차단이 필요하다면 Bunny DRM
 * (Widevine/FairPlay)을 별도로 켜야 합니다.
 */
export const ContentProtection = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const blockSelectStart = (e: Event) => {
      const target = e.target as HTMLElement | null;
      // 폼 입력은 허용 (검색·답변 입력 가능해야 함)
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
    };

    const blockDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen 키 → 경고
      if (e.key === "PrintScreen") {
        toast({
          title: t("protection.captureDetected", "화면 캡처가 감지되었습니다"),
          description: t("protection.captureWarning", "강의 콘텐츠의 무단 복제는 금지되어 있습니다."),
          variant: "destructive",
        });
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // F12: 개발자도구
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }

      if (ctrl) {
        const k = e.key.toLowerCase();
        // Ctrl+Shift+I/J/C: 개발자도구
        if (e.shiftKey && (k === "i" || k === "j" || k === "c")) {
          e.preventDefault();
          return;
        }
        // Ctrl+U: 페이지 소스 보기
        if (k === "u") {
          e.preventDefault();
          return;
        }
        // Ctrl+S: 페이지 저장
        if (k === "s") {
          e.preventDefault();
          return;
        }
        // Ctrl+P: 인쇄
        if (k === "p") {
          e.preventDefault();
          return;
        }
      }
    };

    const blockBeforePrint = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("selectstart", blockSelectStart);
    document.addEventListener("dragstart", blockDragStart);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeprint", blockBeforePrint);

    // 모바일 길게 누르기 메뉴 / 사용자 선택 차단 (스타일)
    const prevUserSelect = document.body.style.userSelect;
    const prevTouchCallout = (document.body.style as any).webkitTouchCallout;
    document.body.style.userSelect = "none";
    (document.body.style as any).webkitTouchCallout = "none";

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("selectstart", blockSelectStart);
      document.removeEventListener("dragstart", blockDragStart);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", blockBeforePrint);
      document.body.style.userSelect = prevUserSelect;
      (document.body.style as any).webkitTouchCallout = prevTouchCallout;
    };
  }, [toast, t]);

  return null;
};
