import { supabase } from "@/integrations/supabase/client";

export async function translateKoToEn(texts: string[]): Promise<string[]> {
  const filtered = texts.filter((t) => t.trim());
  if (filtered.length === 0) return texts.map(() => "");

  const { data, error } = await supabase.functions.invoke("translate", {
    body: { texts: filtered },
  });

  if (error) {
    console.error("Translation error:", error);
    throw new Error("Translation failed");
  }

  return data.translations || [];
}

/**
 * Auto-translate Korean content to English in the background after a save.
 *
 * Fire-and-forget: never blocks the UI, never throws. Failures are logged but
 * silenced so that the primary save flow always succeeds even if the AI gateway
 * is rate-limited or briefly unavailable.
 *
 * The edge function will:
 *  - generate `ai_generated` rows in the matching *_i18n table
 *  - skip rows already marked `reviewed` / `published` / `human_reviewed`
 *    (so manual edits are never overwritten)
 */
export type AutoTranslateContentType =
  | "course"
  | "content"
  | "assessment"
  | "question"
  | "announcement"
  | "board";

export function autoTranslateInBackground(
  contentType: AutoTranslateContentType,
  itemIds: string[],
) {
  const ids = (itemIds ?? []).filter(Boolean);
  if (ids.length === 0) return;
  // Fire and forget — do not await
  void supabase.functions
    .invoke("translate-batch", {
      body: { content_type: contentType, item_ids: ids, auto: true },
    })
    .then(({ error }) => {
      if (error) console.warn(`[auto-translate] ${contentType}`, error);
    })
    .catch((e) => console.warn(`[auto-translate] ${contentType}`, e));
}

/**
 * Translate a short Korean string immediately and synchronously.
 * Used by notifications (sent in user's preferred language at delivery time).
 * Returns the original text on any failure so notifications never break.
 */
export async function translateOneOrFallback(text: string): Promise<string> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return text;
  try {
    const out = await translateKoToEn([trimmed]);
    return out?.[0] || text;
  } catch {
    return text;
  }
}

/**
 * Translate a short label (branch name, team name, etc.) to English with a
 * persistent localStorage cache. Used by certificates / receipts where DB
 * mapping (departments.name_en) is missing and we need to force an EN value.
 *
 * Returns the original text on any failure so the rendering never breaks.
 */
const LABEL_CACHE_KEY = "nfl-label-en-cache";

const readLabelCache = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(LABEL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeLabelCache = (cache: Record<string, string>) => {
  try {
    localStorage.setItem(LABEL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota errors – ignore */
  }
};

export async function translateLabelCached(text: string | null | undefined): Promise<string> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  // Already ASCII (likely English) – no translation needed.
  if (!/[\u3131-\uD79D]/.test(trimmed)) return trimmed;

  const cache = readLabelCache();
  if (cache[trimmed]) return cache[trimmed];

  try {
    const [out] = await translateKoToEn([trimmed]);
    const en = (out || "").trim();
    if (en) {
      cache[trimmed] = en;
      writeLabelCache(cache);
      return en;
    }
  } catch (e) {
    console.warn("[translateLabelCached] failed:", e);
  }
  return trimmed;
}
