import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, type Editor, type TLStoreSnapshot, loadSnapshot, getSnapshot } from "tldraw";
import "tldraw/tldraw.css";

interface Props {
  imageUrl: string;
  initialSnapshot?: any;
  readOnly?: boolean;
  onReady?: (api: { getSnapshot: () => any; editor: Editor }) => void;
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
      // Transparent background so the photo behind shows through
      try {
        editor.user.updateUserPreferences({ colorScheme: "light" });
      } catch {}
      if (initialSnapshot) {
        try {
          loadSnapshot(editor.store, initialSnapshot as TLStoreSnapshot);
        } catch (e) {
          console.warn("[CorrectionCanvas] snapshot load failed", e);
        }
      }
      if (readOnly) {
        editor.updateInstanceState({ isReadonly: true });
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
