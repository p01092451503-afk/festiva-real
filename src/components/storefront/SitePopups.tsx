import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Popup = {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  position: string | null;
  width: number | null;
  height: number | null;
  start_at: string | null;
  end_at: string | null;
  display_order: number | null;
  image_fit: string | null;
  image_position: string | null;
};

const posClass = (p: string | null) => {
  switch (p) {
    case "top-left":
      return "top-6 left-6";
    case "top-right":
      return "top-6 right-6";
    case "bottom":
      return "bottom-6 left-1/2 -translate-x-1/2";
    default:
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
  }
};

const imgStyle = (p: Popup): React.CSSProperties => ({
  objectFit: (p.image_fit || "cover") as React.CSSProperties["objectFit"],
  objectPosition: p.image_position || "center",
  height: p.height ? Math.round(p.height * 0.7) : undefined,
});

const hiddenKey = (id: string) => `popup_hidden_${id}`;

const isHiddenToday = (id: string) => {
  const v = localStorage.getItem(hiddenKey(id));
  return !!v && Number(v) > Date.now();
};

/** Renders admin-managed site popups (main page). */
const SitePopups = () => {
  const [closed, setClosed] = useState<string[]>([]);

  const { data: popups = [] } = useQuery({
    queryKey: ["site-popups-active"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("site_popups")
        .select("id,title,content,image_url,link_url,position,width,height,start_at,end_at,display_order,image_fit,image_position")
        .eq("is_active", true)
        .or(`start_at.is.null,start_at.lte.${nowIso}`)
        .or(`end_at.is.null,end_at.gte.${nowIso}`)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Popup[];
    },
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const visible = popups.filter((p) => !closed.includes(p.id) && !isHiddenToday(p.id));
  if (visible.length === 0) return null;

  const close = (id: string) => setClosed((c) => [...c, id]);
  const hideToday = (id: string) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    localStorage.setItem(hiddenKey(id), String(end.getTime()));
    close(id);
  };

  return (
    <>
      {visible.map((p, i) => (
        <div
          key={p.id}
          role="dialog"
          aria-label={p.title}
          className={`fixed z-50 ${posClass(p.position)} max-w-[92vw]`}
          style={{ width: p.width || 420, marginTop: i * 16, marginLeft: i * 16 }}
        >
          <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold truncate">{p.title}</h2>
              <button type="button" onClick={() => close(p.id)} aria-label="팝업 닫기" className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {p.image_url &&
                (p.link_url ? (
                  <a href={p.link_url} target="_blank" rel="noopener noreferrer">
                    <img src={p.image_url} alt={p.title} className="w-full" style={imgStyle(p)} loading="lazy" />
                  </a>
                ) : (
                  <img src={p.image_url} alt={p.title} className="w-full" style={imgStyle(p)} loading="lazy" />
                ))}
              {p.content && (
                <div className="px-4 py-4 text-sm text-muted-foreground whitespace-pre-wrap">{p.content}</div>
              )}
              {p.link_url && (
                <div className="px-4 pb-4">
                  <Button asChild size="sm" className="w-full">
                    <a href={p.link_url} target="_blank" rel="noopener noreferrer">자세히 보기</a>
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/40">
              <button type="button" onClick={() => hideToday(p.id)} className="text-xs text-muted-foreground hover:text-foreground">
                오늘 하루 보지 않기
              </button>
              <button type="button" onClick={() => close(p.id)} className="text-xs text-muted-foreground hover:text-foreground">
                닫기
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default SitePopups;
