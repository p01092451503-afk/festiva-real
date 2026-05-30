import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  type TLStoreSnapshot,
  loadSnapshot,
  getSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";
import { GripHorizontal } from "lucide-react";


interface Props {
  imageUrl: string;
  initialSnapshot?: unknown;
  readOnly?: boolean;
  onReady?: (api: { getSnapshot: () => TLEditorSnapshot; editor: Editor }) => void;
}

/**
 * Tldraw canvas overlaid on a handwritten answer photo. The image is rendered
 * as a plain <img> background, and tldraw sits on top with a transparent
 * background so users can pen, highlight, type and draw shapes directly over
 * the answer.
 */
const CorrectionCanvas = ({ imageUrl, initialSnapshot, readOnly, onReady }: Props) => {
  const editorRef = useRef<Editor | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  // Load image dimensions to size the canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setDims({ w: 800, h: 1100 });
    img.src = imageUrl;
  }, [imageUrl]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      try {
        editor.user.updateUserPreferences({ colorScheme: "light" });
      } catch (error) {
        console.debug("[CorrectionCanvas] color preference skipped", error);
      }

      if (initialSnapshot) {
        try {
          loadSnapshot(editor.store, initialSnapshot as Partial<TLEditorSnapshot> | TLStoreSnapshot);
        } catch (e) {
          console.warn("[CorrectionCanvas] snapshot load failed", e);
        }
      }

      if (readOnly) {
        editor.updateInstanceState({ isReadonly: true });
      } else {
        // Keep the user's chosen tool active after every action so the editor
        // doesn't auto-switch to the select tool (which is what causes the
        // accidental "drag groups shapes" behavior).
        try {
          editor.updateInstanceState({ isToolLocked: true });
        } catch (error) {
          console.debug("[CorrectionCanvas] tool lock preference skipped", error);
        }

        // Default to draw tool so mouse/pen/touch immediately writes
        try {
          editor.setCurrentTool("draw");
        } catch (error) {
          console.debug("[CorrectionCanvas] initial draw tool skipped", error);
        }
      }

      // Lock camera so drawings stay fixed on top of the photo
      try {
        editor.setCameraOptions({ isLocked: true });
        editor.setCamera({ x: 0, y: 0, z: 1 });
      } catch (error) {
        console.debug("[CorrectionCanvas] camera lock skipped", error);
      }

      onReady?.({
        getSnapshot: () => getSnapshot(editor.store),
        editor,
      });
    },
    [initialSnapshot, readOnly, onReady],
  );

  // Aspect ratio container based on the image
  const ratio = dims ? dims.h / dims.w : 11 / 8.5;

  // Make the tldraw toolbar movable. After mount, locate the toolbar element,
  // anchor it to the top-center of the canvas, and add a drag handle so users
  // can reposition it anywhere within the canvas.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (readOnly) return;
    const container = containerRef.current;
    if (!container) return;

    let toolbar: HTMLElement | null = null;
    let handle: HTMLElement | null = null;
    let cleanupHandle: (() => void) | null = null;

    const attach = () => {
      toolbar = container.querySelector<HTMLElement>(".tlui-toolbar");
      if (!toolbar || toolbar.dataset.movable === "1") return;
      toolbar.dataset.movable = "1";

      // Reset default bottom-center anchoring → free positioning
      toolbar.style.position = "absolute";
      toolbar.style.left = "50%";
      toolbar.style.top = "12px";
      toolbar.style.bottom = "auto";
      toolbar.style.transform = "translateX(-50%)";
      toolbar.style.zIndex = "300";

      // Insert drag handle
      handle = document.createElement("div");
      handle.setAttribute("aria-label", "툴바 이동");
      handle.title = "드래그하여 위치 이동";
      handle.style.cssText =
        "display:flex;align-items:center;justify-content:center;width:22px;cursor:grab;color:rgba(0,0,0,0.4);touch-action:none;user-select:none;";
      handle.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
      toolbar.prepend(handle);

      let startX = 0;
      let startY = 0;
      let originLeft = 0;
      let originTop = 0;

      const onPointerDown = (e: PointerEvent) => {
        if (!toolbar) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = toolbar.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        // Switch to pixel-based positioning from current visual location
        originLeft = rect.left - parentRect.left;
        originTop = rect.top - parentRect.top;
        toolbar.style.left = `${originLeft}px`;
        toolbar.style.top = `${originTop}px`;
        toolbar.style.transform = "none";
        startX = e.clientX;
        startY = e.clientY;
        handle!.style.cursor = "grabbing";
        handle!.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!toolbar || !handle?.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const parentRect = container.getBoundingClientRect();
        const tbRect = toolbar.getBoundingClientRect();
        const maxLeft = parentRect.width - tbRect.width;
        const maxTop = parentRect.height - tbRect.height;
        const nextLeft = Math.max(0, Math.min(maxLeft, originLeft + dx));
        const nextTop = Math.max(0, Math.min(maxTop, originTop + dy));
        toolbar.style.left = `${nextLeft}px`;
        toolbar.style.top = `${nextTop}px`;
      };
      const onPointerUp = (e: PointerEvent) => {
        if (handle?.hasPointerCapture(e.pointerId)) {
          handle.releasePointerCapture(e.pointerId);
        }
        if (handle) handle.style.cursor = "grab";
      };

      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);

      cleanupHandle = () => {
        handle?.removeEventListener("pointerdown", onPointerDown);
        handle?.removeEventListener("pointermove", onPointerMove);
        handle?.removeEventListener("pointerup", onPointerUp);
        handle?.removeEventListener("pointercancel", onPointerUp);
        handle?.remove();
      };
    };

    // Toolbar may not exist immediately; observe DOM until it appears.
    const observer = new MutationObserver(() => {
      attach();
      if (toolbar) observer.disconnect();
    });
    attach();
    if (!toolbar) observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanupHandle?.();
    };
  }, [readOnly, dims]);

  // Aspect ratio container based on the image
  const ratio = dims ? dims.h / dims.w : 11 / 8.5;

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div
        ref={containerRef}
        className="relative w-full border-2 border-border/60 rounded overflow-hidden bg-muted"
        style={{ paddingTop: `${ratio * 100}%` }}
      >
        <img
          src={imageUrl}
          alt="답안"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
        />
        <div className="absolute inset-0 tldraw-correction">
          <Tldraw onMount={handleMount} hideUi={!!readOnly} />
        </div>
      </div>
      <style>{`
        .tldraw-correction .tl-background { background-color: transparent !important; }
        .tldraw-correction .tl-canvas { background: transparent !important; }
      `}</style>
    </div>
  );
};


export default CorrectionCanvas;
