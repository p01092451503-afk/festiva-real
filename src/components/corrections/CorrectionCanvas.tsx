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



  // Make the tldraw toolbar movable. Position it at top-center by default,
  // with a drag handle to reposition it anywhere within the canvas.
  // We use CSS variables + a stylesheet (with !important) so that tldraw's
  // internal React re-renders cannot overwrite the position.
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (readOnly) return;
    const container = containerRef.current;
    if (!container) return;

    let handle: HTMLElement | null = null;
    let toolbar: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    const attachHandle = (tb: HTMLElement) => {
      if (tb.querySelector(":scope > .correction-toolbar-handle")) return;

      handle = document.createElement("div");
      handle.className = "correction-toolbar-handle";
      handle.setAttribute("aria-label", "툴바 이동");
      handle.title = "드래그하여 위치 이동";
      handle.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';
      tb.prepend(handle);

      let startX = 0;
      let startY = 0;
      let originX = 0;
      let originY = 0;

      const readVar = (name: string) =>
        parseFloat(getComputedStyle(container).getPropertyValue(name)) || 0;

      const onPointerDown = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Lock position to current visual location in pixels
        const tbRect = tb.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        originX = tbRect.left - cRect.left;
        originY = tbRect.top - cRect.top;
        container.style.setProperty("--ctb-x", `${originX}px`);
        container.style.setProperty("--ctb-y", `${originY}px`);
        container.style.setProperty("--ctb-anchor", "0");
        startX = e.clientX;
        startY = e.clientY;
        handle!.style.cursor = "grabbing";
        handle!.setPointerCapture(e.pointerId);
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!handle?.hasPointerCapture(e.pointerId)) return;
        const cRect = container.getBoundingClientRect();
        const tbRect = tb.getBoundingClientRect();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxX = cRect.width - tbRect.width;
        const maxY = cRect.height - tbRect.height;
        const nx = Math.max(0, Math.min(maxX, originX + dx));
        const ny = Math.max(0, Math.min(maxY, originY + dy));
        container.style.setProperty("--ctb-x", `${nx}px`);
        container.style.setProperty("--ctb-y", `${ny}px`);
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

      cleanup = () => {
        handle?.removeEventListener("pointerdown", onPointerDown);
        handle?.removeEventListener("pointermove", onPointerMove);
        handle?.removeEventListener("pointerup", onPointerUp);
        handle?.removeEventListener("pointercancel", onPointerUp);
        handle?.remove();
        handle = null;
      };

      // Suppress var() so the default CSS centering kicks in initially
      container.style.setProperty("--ctb-anchor", "1");
    };

    const findAndAttach = () => {
      const tb = container.querySelector<HTMLElement>(".tlui-toolbar");
      if (tb && tb !== toolbar) {
        toolbar = tb;
        attachHandle(tb);
      } else if (tb && handle && !tb.contains(handle)) {
        // toolbar re-mounted by React; re-insert handle
        attachHandle(tb);
      }
    };

    findAndAttach();
    const observer = new MutationObserver(() => findAndAttach());
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [readOnly, dims]);

  // Aspect ratio container based on the image
  const ratio = dims ? dims.h / dims.w : 11 / 8.5;

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div
        ref={containerRef}
        className="relative w-full border-2 border-border/60 rounded overflow-hidden bg-muted"
        style={{ paddingTop: `${ratio * 100}%`, ["--ctb-anchor" as never]: "1" }}
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
        /* Movable toolbar: pinned top-center by default, then free position via CSS vars */
        .tldraw-correction .tlui-toolbar {
          position: absolute !important;
          bottom: auto !important;
          left: calc(var(--ctb-anchor, 1) * 50% + (1 - var(--ctb-anchor, 1)) * var(--ctb-x, 0px)) !important;
          top: calc(var(--ctb-anchor, 1) * 12px + (1 - var(--ctb-anchor, 1)) * var(--ctb-y, 0px)) !important;
          transform: translateX(calc(var(--ctb-anchor, 1) * -50%)) !important;
          z-index: 300 !important;
          width: max-content !important;
          max-width: calc(100% - 16px) !important;
        }
        .tldraw-correction .tlui-toolbar__tools { padding-left: 4px; }
        .correction-toolbar-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          align-self: stretch;
          cursor: grab;
          color: hsl(var(--muted-foreground) / 0.6);
          touch-action: none;
          user-select: none;
        }
        .correction-toolbar-handle:hover { color: hsl(var(--foreground)); }
      `}</style>
    </div>
  );
};



export default CorrectionCanvas;
