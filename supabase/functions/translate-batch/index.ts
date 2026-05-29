import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContentType =
  | "course"
  | "content"
  | "assessment"
  | "question"
  | "announcement"
  | "board"
  | "track"
  | "track_step"
  | "category";

interface TableConfig {
  source_table: string;
  source_id_col: string;
  i18n_table: string;
  i18n_fk_col: string;
  title_col: string; // primary text col (title or question_text)
  body_col: string;  // secondary text col (description/content/explanation)
  extra_cols?: string[]; // for questions: hint, options(jsonb)
}

const CONFIG: Record<ContentType, TableConfig> = {
  course: { source_table: "courses", source_id_col: "id", i18n_table: "course_i18n", i18n_fk_col: "course_id", title_col: "title", body_col: "description" },
  content: { source_table: "course_contents", source_id_col: "id", i18n_table: "course_content_i18n", i18n_fk_col: "content_id", title_col: "title", body_col: "description" },
  assessment: { source_table: "assessments", source_id_col: "id", i18n_table: "assessment_i18n", i18n_fk_col: "assessment_id", title_col: "title", body_col: "description" },
  question: { source_table: "assessment_questions", source_id_col: "id", i18n_table: "assessment_question_i18n", i18n_fk_col: "question_id", title_col: "question_text", body_col: "explanation", extra_cols: ["hint", "options"] },
  announcement: { source_table: "announcements", source_id_col: "id", i18n_table: "announcement_i18n", i18n_fk_col: "announcement_id", title_col: "title", body_col: "content" },
  board: { source_table: "board_posts", source_id_col: "id", i18n_table: "board_post_i18n", i18n_fk_col: "post_id", title_col: "title", body_col: "content" },
  // Inline-EN kinds: store the translation directly on the source row
  // (no separate i18n table). i18n_* fields are unused for these.
  track: { source_table: "learning_tracks", source_id_col: "id", i18n_table: "", i18n_fk_col: "", title_col: "name", body_col: "description" },
  track_step: { source_table: "track_steps", source_id_col: "id", i18n_table: "", i18n_fk_col: "", title_col: "name", body_col: "name" },
  category: { source_table: "categories", source_id_col: "id", i18n_table: "", i18n_fk_col: "", title_col: "name", body_col: "description" },
};

const INLINE_KINDS = new Set<ContentType>(["track", "track_step", "category"]);

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function translateBatch(texts: string[], apiKey: string, glossary: Array<{ ko: string; en: string }> = []): Promise<string[]> {
  const filtered = texts.map((t) => t ?? "");
  if (filtered.every((t) => !t.trim())) return filtered.map(() => "");

  // Only send non-empty strings to the AI. Sending empty placeholders can cause
  // the model to hallucinate content (e.g. fill an empty description with text
  // from a different item it has seen). We preserve original positions so the
  // caller's index-based mapping (title=0, body=1, …) stays correct.
  const nonEmptyIndices: number[] = [];
  const nonEmptyTexts: string[] = [];
  filtered.forEach((t, i) => {
    if (t.trim()) {
      nonEmptyIndices.push(i);
      nonEmptyTexts.push(t);
    }
  });

  const glossaryBlock = glossary.length
    ? `Use this glossary strictly when the Korean term appears (case-insensitive substring match). Do not deviate.\n${glossary.map((g) => `- "${g.ko}" => "${g.en}"`).join("\n")}\n\n`
    : "";
  const prompt = `${glossaryBlock}Translate each of the following Korean texts to English. Return a JSON array of translated strings in the same order, exactly ${nonEmptyTexts.length} items. Do not invent or add content that is not present in the input. Return ONLY the JSON array, nothing else.\n\n${JSON.stringify(nonEmptyTexts)}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a professional Korean to English translator for an LMS. Translate accurately and naturally. Keep titles concise. Return ONLY a JSON array." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`AI gateway ${res.status}`);
  const result = await res.json();
  const content: string = result.choices?.[0]?.message?.content?.trim() ?? "";
  const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      // Remap translated values back into the original positions; empty inputs
      // stay empty so downstream code never writes hallucinated text.
      const out = filtered.map(() => "");
      nonEmptyIndices.forEach((origIdx, i) => {
        out[origIdx] = String(parsed[i] ?? "");
      });
      return out;
    }
  } catch {/* ignore */}
  return filtered.map(() => "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json();
    // auto mode: any authenticated user can request a background translation
    // for a content item they just created (mirrors KO -> EN). The function
    // never overwrites human_reviewed/published rows.
    const isAuto = body?.auto === true;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!isAuto) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
      if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      // auto mode also allows teachers (course creators)
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      const ok = (roles ?? []).some((r: { role: string }) => ["admin", "super_admin", "teacher"].includes(r.role));
      if (!ok) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const content_type = body.content_type as ContentType;
    const item_ids = (body.item_ids ?? []) as string[];
    if (!CONFIG[content_type] || !Array.isArray(item_ids) || item_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cfg = CONFIG[content_type];
    // Load active glossary (scope = 'all' or matches content_type)
    const { data: glossaryRows } = await admin
      .from("translation_glossary")
      .select("ko_term, en_term, scope, is_active")
      .eq("is_active", true)
      .in("scope", ["all", content_type]);
    const glossary = ((glossaryRows ?? []) as Array<{ ko_term: string; en_term: string }>)
      .map((g) => ({ ko: g.ko_term, en: g.en_term }));

    const colSet = new Set<string>([cfg.source_id_col, cfg.title_col, cfg.body_col, ...(cfg.extra_cols ?? [])]);
    const selectCols = Array.from(colSet).join(", ");
    const { data: sources, error: srcErr } = await (admin as any)
      .from(cfg.source_table)
      .select(selectCols)
      .in(cfg.source_id_col, item_ids);
    if (srcErr) throw srcErr;

    let translated = 0;
    let failed = 0;
    let skipped = 0;

    const existingMap = new Map<string, string>();
    if (!INLINE_KINDS.has(content_type)) {
      const { data: existingRows } = await (admin as any)
        .from(cfg.i18n_table)
        .select(`${cfg.i18n_fk_col}, translation_status`)
        .eq("language_code", "en")
        .in(cfg.i18n_fk_col, item_ids);
      for (const r of ((existingRows ?? []) as Array<Record<string, unknown>>)) {
        existingMap.set(String(r[cfg.i18n_fk_col]), String(r.translation_status ?? ""));
      }
    }

    for (const row of (sources ?? []) as Array<Record<string, unknown>>) {
      const id = row[cfg.source_id_col] as string;

      // Never overwrite human-curated translations.
      const existingStatus = existingMap.get(id);
      if (existingStatus === "reviewed" || existingStatus === "published" || existingStatus === "human_reviewed") {
        skipped++;
        continue;
      }

      const koTitle = String(row[cfg.title_col] ?? "");
      const koBody = cfg.body_col === cfg.title_col ? "" : String(row[cfg.body_col] ?? "");

      try {
        if (INLINE_KINDS.has(content_type)) {
          // tracks / categories: write name_en (and description_en when present)
          const [enTitle, enBody] = await translateBatch([koTitle, koBody], LOVABLE_API_KEY, glossary);
          const { error: rpcErr } = await (admin as any).rpc("apply_simple_i18n", {
            p_kind: content_type,
            p_item_id: id,
            p_name_en: enTitle || koTitle,
            p_description_en: enBody || null,
          });
          if (rpcErr) { failed++; console.error("apply_simple_i18n err", rpcErr); } else translated++;
        } else if (content_type === "question") {
          // Translate question_text + hint + explanation + each option
          const koHint = String((row as Record<string, unknown>)["hint"] ?? "");
          const koOptions = (row as Record<string, unknown>)["options"];
          const optionTexts: string[] = Array.isArray(koOptions)
            ? koOptions.map((o) => String(o ?? ""))
            : [];

          const inputs = [koTitle, koBody, koHint, ...optionTexts];
          const out = await translateBatch(inputs, LOVABLE_API_KEY, glossary);
          const enText = out[0] || koTitle;
          const enExpl = out[1] || koBody;
          const enHint = out[2] || koHint;
          const enOptions = optionTexts.length > 0 ? out.slice(3) : null;

          const hash = await sha256Hex(`${koTitle}|${koBody}|${koHint}|${optionTexts.join("|")}`);
          const upsertRow: Record<string, unknown> = {
            [cfg.i18n_fk_col]: id,
            language_code: "en",
            question_text: enText,
            explanation: enExpl || null,
            hint: enHint || null,
            options: enOptions,
            source_hash: hash,
            translation_status: "ai_generated",
            translated_at: new Date().toISOString(),
          };
          const { error: upErr } = await (admin as any)
            .from(cfg.i18n_table)
            .upsert(upsertRow, { onConflict: `${cfg.i18n_fk_col},language_code` });
          if (upErr) { failed++; console.error("upsert err", upErr); } else translated++;
        } else {
          const [enTitle, enBody] = await translateBatch([koTitle, koBody], LOVABLE_API_KEY, glossary);
          const hash = await sha256Hex(`${koTitle}|${koBody}`);
          const bodyKey = cfg.body_col === "description" ? "description" : "content";
          const upsertRow: Record<string, unknown> = {
            [cfg.i18n_fk_col]: id,
            language_code: "en",
            title: enTitle || koTitle,
            [bodyKey]: enBody || koBody,
            source_hash: hash,
            translation_status: "ai_generated",
            translated_at: new Date().toISOString(),
          };
          const { error: upErr } = await (admin as any)
            .from(cfg.i18n_table)
            .upsert(upsertRow, { onConflict: `${cfg.i18n_fk_col},language_code` });
          if (upErr) { failed++; console.error("upsert err", upErr); } else translated++;
        }
      } catch (e) {
        failed++;
        console.error("translate err", e);
      }
    }

    return new Response(JSON.stringify({ translated, failed, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-batch error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});