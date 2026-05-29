import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { translateLabelCached } from "@/lib/translate";

/**
 * Reactively returns an English translation for a Korean free-text label
 * (position, team name, etc.) using the persistent localStorage cache in
 * `translateLabelCached`. Falls back to the original text on any failure
 * and while the async translation is in flight.
 *
 * - In Korean (KO) mode: returns the original text untouched.
 * - In English (EN) mode: returns the cached/AI translation when ready;
 *   until then returns the original text so the UI never flashes empty.
 */
export const useTranslatedLabel = (text: string | null | undefined): string => {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const trimmed = (text ?? "").trim();
  const [value, setValue] = useState<string>(trimmed);

  useEffect(() => {
    if (!trimmed) {
      setValue("");
      return;
    }
    if (!isEn) {
      setValue(trimmed);
      return;
    }
    let cancelled = false;
    translateLabelCached(trimmed)
      .then((en) => {
        if (!cancelled) setValue(en || trimmed);
      })
      .catch(() => {
        if (!cancelled) setValue(trimmed);
      });
    return () => {
      cancelled = true;
    };
  }, [trimmed, isEn]);

  return value;
};