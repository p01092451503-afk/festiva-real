import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  type TLShape,
  type TLShapePartial,
  type TLStoreSnapshot,
  loadSnapshot,
  getSnapshot,
} from "tldraw";
import { DefaultColorStyle, DefaultSizeStyle, type TLDefaultColorStyle, type TLDefaultSizeStyle } from "@tldraw/tlschema";
import "tldraw/tldraw.css";
import { ArrowUpRight, Eraser, Highlighter, MousePointer2, Pencil, Redo2, Type, Undo2 } from "lucide-react";

interface Props {
  imageUrl: string;
  initialSnapshot?: unknown;
  readOnly?: boolean;
  onReady?: (api: { getSnapshot: () => TLEditorSnapshot; editor: Editor }) => void;
}

type PageDimensions = { w: number; h: number };

const PAGE_EDGE_TOLERANCE = 0.5;
const TLDRAW_OPTIONS = { edgeScrollSpeed: 0 } as const;

const getPageCameraOptions = (dims: PageDimensions) => ({
  isLocked: false,
  panSpeed: 0,
  zoomSpeed: 0,
  wheelBehavior: "none" as const,
  zoomSteps: [1],
  constraints: {
    bounds: { x: 0, y: 0, w: dims.w, h: dims.h },
    padding: { x: 0, y: 0 },
    origin: { x: 0, y: 0 },
    initialZoom: "fit-x" as const,
    baseZoom: "fit-x" as const,
    behavior: "fixed" as const,
  },
});

const getShapePageOffset = (editor: Editor, shape: TLShape, dims: PageDimensions) => {
  const bounds = editor.getShapePageBounds(shape);
  if (!bounds) return null;

  let dx = 0;
  let dy = 0;

  if (bounds.w >= dims.w) {
    dx = -bounds.x + (dims.w - bounds.w) / 2;
  } else if (bounds.x < 0) {
    dx = -bounds.x;
  } else if (bounds.maxX > dims.w) {
    dx = dims.w - bounds.maxX;
  }

  if (bounds.h >= dims.h) {
    dy = -bounds.y + (dims.h - bounds.h) / 2;
  } else if (bounds.y < 0) {
    dy = -bounds.y;
  } else if (bounds.maxY > dims.h) {
    dy = dims.h - bounds.maxY;
  }

  if (Math.abs(dx) <= PAGE_EDGE_TOLERANCE && Math.abs(dy) <= PAGE_EDGE_TOLERANCE) return null;
  return { dx, dy };
};

const confineShapeToPage = (editor: Editor, shape: TLShape, dims: PageDimensions) => {
  const offset = getShapePageOffset(editor, shape, dims);
  if (!offset) return;

  editor.updateShapes([
    {
      id: shape.id,
      type: shape.type,
      x: shape.x + offset.dx,
      y: shape.y + offset.dy,
    } as TLShapePartial<TLShape>,
  ]);
};

const TOOL_OPTIONS = [
  { id: "select", label: "선택", icon: MousePointer2, lock: false },
  { id: "draw", label: "펜", icon: Pencil, lock: true },
  { id: "eraser", label: "지우개", icon: Eraser, lock: true },
  { id: "highlight", label: "형광펜", icon: Highlighter, lock: true },
  { id: "arrow", label: "화살표", icon: ArrowUpRight, lock: false },
  { id: "text", label: "텍스트", icon: Type, lock: false },
] as const;

const COLOR_OPTIONS: Array<{ value: TLDefaultColorStyle; label: string; cls: string }> = [
  { value: "red", label: "빨강", cls: "bg-destructive" },
  { value: "blue", label: "파랑", cls: "bg-primary" },
  { value: "black", label: "검정", cls: "bg-foreground" },
  { value: "orange", label: "주황", cls: "bg-warning" },
];

const SIZE_OPTIONS: Array<{ value: TLDefaultSizeStyle; label: string }> = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

const CorrectionToolbar = ({ editor }: { editor: Editor | null }) => {
  const [activeTool, setActiveTool] = useState("draw");
  const [activeColor, setActiveColor] = useState<TLDefaultColorStyle>("red");
  const [activeSize, setActiveSize] = useState<TLDefaultSizeStyle>("m");

  const setTool = (tool: (typeof TOOL_OPTIONS)[number]) => {
    if (!editor) return;
    editor.updateInstanceState({ isToolLocked: tool.lock });
    editor.setCurrentTool(tool.id);
    setActiveTool(tool.id);
    try { editor.focus(); } catch { /* noop */ }
  };

  const setColor = (color: TLDefaultColorStyle) => {
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultColorStyle, color);
    editor.setStyleForSelectedShapes(DefaultColorStyle, color);
    setActiveColor(color);
  };

  const setSize = (size: TLDefaultSizeStyle) => {
    if (!editor) return;
    editor.setStyleForNextShapes(DefaultSizeStyle, size);
    editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
    setActiveSize(size);
  };

  return (
    <div className="absolute left-1/2 top-3 z-[60] flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-lg border border-border/80 bg-background/95 p-1.5 shadow-lg backdrop-blur pointer-events-auto">
      {TOOL_OPTIONS.map((tool) => {
        const Icon = tool.icon;
        const selected = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={selected}
            onClick={() => setTool(tool)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors ${
              selected ? "border-primary bg-primary text-primary-foreground" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
      <div className="mx-1 h-6 w-px bg-border" />
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color.value}
          type="button"
          title={color.label}
          aria-label={color.label}
          aria-pressed={activeColor === color.value}
          onClick={() => setColor(color.value)}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${activeColor === color.value ? "border-primary bg-muted" : "border-transparent hover:bg-muted"}`}
        >
          <span className={`h-4 w-4 rounded-full border border-border ${color.cls}`} />
        </button>
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      {SIZE_OPTIONS.map((size) => (
        <button
          key={size.value}
          type="button"
          title={`두께 ${size.label}`}
          aria-label={`두께 ${size.label}`}
          aria-pressed={activeSize === size.value}
          onClick={() => setSize(size.value)}
          className={`h-8 min-w-8 rounded-md border px-2 text-xs font-medium transition-colors ${activeSize === size.value ? "border-primary bg-primary text-primary-foreground" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
        >
          {size.label}
        </button>
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <button type="button" title="실행 취소" aria-label="실행 취소" onClick={() => editor?.undo()} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" title="다시 실행" aria-label="다시 실행" onClick={() => editor?.redo()} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
};

const CorrectionCanvas = ({ imageUrl, initialSnapshot, readOnly, onReady }: Props) => {
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const boundaryCleanupRef = useRef<(() => void) | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dims, setDims] = useState<PageDimensions | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setDims({ w: 800, h: 1100 });
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!editor || !dims) return;
    try {
      editor.user.updateUserPreferences({ edgeScrollSpeed: 0 });
      editor.setCameraOptions(getPageCameraOptions(dims));
      editor.setCamera({ x: 0, y: 0, z: editor.getInitialZoom() }, { reset: true });
    } catch (error) {
      console.debug("[CorrectionCanvas] page boundary setup skipped", error);
    }
  }, [editor, dims]);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setEditor(editor);
      try {
        editor.user.updateUserPreferences({ colorScheme: "light", edgeScrollSpeed: 0 });
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
          editor.setStyleForNextShapes(DefaultColorStyle, "red");
          editor.setStyleForNextShapes(DefaultSizeStyle, "m");
        } catch (error) {
          console.debug("[CorrectionCanvas] tool lock preference skipped", error);
        }
        try {
          editor.setCurrentTool("draw");
        } catch (error) {
          console.debug("[CorrectionCanvas] initial draw tool skipped", error);
        }
      }

      onReady?.({
        getSnapshot: () => getSnapshot(editor.store),
        editor,
      });
    },
    [initialSnapshot, readOnly, onReady],
  );

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
          <Tldraw onMount={handleMount} hideUi options={TLDRAW_OPTIONS} />
        </div>
        {!readOnly && <CorrectionToolbar editor={editor} />}
      </div>
      <style>{`
        .tldraw-correction .tl-background { background-color: transparent !important; }
        .tldraw-correction .tl-canvas { background: transparent !important; }
      `}</style>
    </div>
  );
};

export default CorrectionCanvas;
