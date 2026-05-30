import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  DefaultToolbar,
  type Editor,
  type TLComponents,
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
 * Draggable toolbar built on top of tldraw's DefaultToolbar. Position is
 * managed in React state, and dragging uses pointer events on a small grip
 * handle. The toolbar is rendered via tldraw's `components.Toolbar` slot so
 * tldraw never re-positions or re-creates it from underneath us.
 */
const DraggableToolbar = ({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // null = use default centered position (top-center)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;
    const wRect = wrapper.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: wRect.left - cRect.left,
      originY: wRect.top - cRect.top,
      pointerId: e.pointerId,
    };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const wrapper = wrapperRef.current;
    const container = containerRef.current;
    if (!wrapper || !container) return;
    const wRect = wrapper.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const maxX = Math.max(0, cRect.width - wRect.width);
    const maxY = Math.max(0, cRect.height - wRect.height);
    const nx = Math.max(0, Math.min(maxX, drag.originX + dx));
    const ny = Math.max(0, Math.min(maxY, drag.originY + dy));
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      dragRef.current = null;
    }
  };

  const style: React.CSSProperties = pos
    ? {
        position: "absolute",
        left: pos.x,
        top: pos.y,
        transform: "none",
        zIndex: 300,
        pointerEvents: "auto",
      }
    : {
        position: "absolute",
        left: "50%",
        top: 12,
        transform: "translateX(-50%)",
        zIndex: 300,
        pointerEvents: "auto",
      };

  return (
    <div
      ref={wrapperRef}
      style={style}
      className="correction-draggable-toolbar flex items-stretch rounded-lg bg-background/95 backdrop-blur shadow-md border border-border/60"
    >
      <div
        role="button"
        aria-label="툴바 이동"
        title="드래그하여 위치 이동"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex items-center justify-center px-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none select-none border-r border-border/60"
      >
        <GripHorizontal size={14} />
      </div>
      <div className="correction-toolbar-inner">
        <DefaultToolbar />
      </div>
    </div>
  );
};

const CorrectionCanvas = ({ imageUrl, initialSnapshot, readOnly, onReady }: Props) => {
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

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
        try {
          editor.updateInstanceState({ isToolLocked: true });
        } catch (error) {
          console.debug("[CorrectionCanvas] tool lock preference skipped", error);
        }
        try {
          editor.setCurrentTool("draw");
        } catch (error) {
          console.debug("[CorrectionCanvas] initial draw tool skipped", error);
        }
      }

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

  // Inject a custom Toolbar component into tldraw's UI slot.
  const components: TLComponents = readOnly
    ? {}
    : {
        Toolbar: () => <DraggableToolbar containerRef={containerRef} />,
      };

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
          <Tldraw onMount={handleMount} hideUi={!!readOnly} components={components} />
        </div>
      </div>
      <style>{`
        .tldraw-correction .tl-background { background-color: transparent !important; }
        .tldraw-correction .tl-canvas { background: transparent !important; }
        /* Let our absolutely-positioned wrapper escape tldraw's bottom layout. */
        .tldraw-correction .tlui-layout__bottom { inset: 0 !important; pointer-events: none !important; }
        .tldraw-correction .tlui-layout__bottom > * { pointer-events: auto; }
        /* Strip the default toolbar chrome so our wrapper provides it. */
        .correction-draggable-toolbar .tlui-toolbar {
          position: static !important;
          transform: none !important;
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 2px !important;
          width: max-content !important;
        }
        .correction-draggable-toolbar .tlui-toolbar__tools { background: transparent !important; }
      `}</style>
    </div>
  );
};

export default CorrectionCanvas;
