import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  type Editor,
  type TLEditorSnapshot,
  type TLShapePartial,
  type TLStoreSnapshot,
  loadSnapshot,
  getSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";

interface Props {
  imageUrl: string;
  initialSnapshot?: Partial<TLEditorSnapshot> | TLStoreSnapshot;
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

  const lockUnlockedShapes = useCallback((editor: Editor) => {
    const isActivelyCreating =
      editor.inputs.getIsPointing() ||
      editor.inputs.getIsDragging() ||
      editor.inputs.getIsPinching() ||
      !!editor.getEditingShapeId();

    if (isActivelyCreating) return;

    const unlockedShapes = editor.getCurrentPageShapes().filter((shape) => !shape.isLocked);
    if (unlockedShapes.length === 0) return;

    editor.updateShapes(
      unlockedShapes.map((shape) => ({
        id: shape.id,
        type: shape.type,
        isLocked: true,
      })) as TLShapePartial[],
    );
    editor.selectNone();
    try {
      editor.setCurrentTool("draw");
    } catch (error) {
      console.debug("[CorrectionCanvas] draw tool reset skipped", error);
    }
  }, []);

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
      // Transparent background so the photo behind shows through
      try {
        editor.user.updateUserPreferences({ colorScheme: "light" });
      } catch (error) {
        console.debug("[CorrectionCanvas] color preference skipped", error);
      }
      if (initialSnapshot) {
        try {
          loadSnapshot(editor.store, initialSnapshot);
        } catch (e) {
          console.warn("[CorrectionCanvas] snapshot load failed", e);
        }
      }
      if (readOnly) {
        editor.updateInstanceState({ isReadonly: true });
      } else {
        const unlockHandler = editor.sideEffects.registerOperationCompleteHandler(() => {
          lockUnlockedShapes(editor);
        });
        editor.disposables.add(unlockHandler);

        // Default to draw tool so mouse/pen/touch immediately writes
        try {
          editor.setCurrentTool("draw");
        } catch (error) {
          console.debug("[CorrectionCanvas] initial draw tool skipped", error);
        }
      }
      // Lock camera so drawings stay fixed on top of the photo
      // (no pan/zoom from wheel, pinch, or drag)
      try {
        editor.setCameraOptions({ isLocked: true });
        editor.setCamera({ x: 0, y: 0, z: 1 });
      } catch (error) {
        console.debug("[CorrectionCanvas] camera lock skipped", error);
      }
      lockUnlockedShapes(editor);
      onReady?.({
        getSnapshot: () => getSnapshot(editor.store),
        editor,
      });
    },
    [initialSnapshot, readOnly, onReady, lockUnlockedShapes],
  );

  // Aspect ratio container based on the image
  const ratio = dims ? dims.h / dims.w : 11 / 8.5;

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div
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
