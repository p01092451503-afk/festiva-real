import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type QType = "multiple_choice_4" | "ox" | "short_answer" | "essay";

interface GenerateRequest {
  // Source — provide ONE of: text, url, file (base64 with mime)
  text?: string;
  url?: string;
  file?: { mimeType: string; dataBase64: string }; // pdf or image
  // Options
  questionTypes: QType[]; // which types to generate
  count: number; // total questions across types
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  learnerLevel?: "beginner" | "intermediate" | "advanced";
  language?: "ko" | "en";
  topicHint?: string;
}

interface GeneratedQuestion {
  question_type: QType;
  question_text: string;
  options: string[] | null; // 4 for MC, ["O","X"] for OX, null otherwise
  correct_answer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  source_quote?: string; // 근거 문장
}

export type UrlFetchErrorCode =
  | "INVALID_URL"
  | "TIMEOUT"
  | "DNS_OR_NETWORK"
  | "BLOCKED"          // 401/403/429/451
  | "NOT_FOUND"        // 404/410
  | "SERVER_ERROR"     // 5xx
  | "HTTP_ERROR"       // other non-2xx
  | "UNSUPPORTED_TYPE" // non-html content
  | "TOO_SHORT"        // extracted body too small
  | "UNKNOWN";

export class UrlFetchError extends Error {
  code: UrlFetchErrorCode;
  status?: number;
  constructor(code: UrlFetchErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function fetchUrlText(url: string): Promise<string> {
  // Validate URL shape first
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("non-http");
    }
  } catch {
    throw new UrlFetchError("INVALID_URL", "Invalid URL format. Must start with http(s)://");
  }

  // 12s timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LovableLMSBot/1.0; +https://lovable.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (controller.signal.aborted) {
      throw new UrlFetchError("TIMEOUT", "Request timed out after 12s");
    }
    throw new UrlFetchError("DNS_OR_NETWORK", `Network error: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403 || status === 429 || status === 451) {
      throw new UrlFetchError("BLOCKED", `Site blocked the request (HTTP ${status})`, status);
    }
    if (status === 404 || status === 410) {
      throw new UrlFetchError("NOT_FOUND", `Page not found (HTTP ${status})`, status);
    }
    if (status >= 500) {
      throw new UrlFetchError("SERVER_ERROR", `Origin server error (HTTP ${status})`, status);
    }
    throw new UrlFetchError("HTTP_ERROR", `HTTP ${status}`, status);
  }

  const ctype = res.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml|text\/plain/i.test(ctype)) {
    throw new UrlFetchError("UNSUPPORTED_TYPE", `Unsupported content type: ${ctype || "unknown"}`);
  }

  const html = await res.text();
  // Very simple HTML → text. Strip scripts/styles, then tags.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  const out = stripped.slice(0, 16000);
  if (out.length < 100) {
    throw new UrlFetchError(
      "TOO_SHORT",
      "Extracted text is too short. The site likely blocks scraping or renders content via JavaScript.",
    );
  }
  return out;
}

function buildSystemPrompt(lang: "ko" | "en") {
  if (lang === "en") {
    return `You are an expert assessment author for an LMS. Given an article (news, report, study material), generate high-quality exam questions strictly grounded in the article content. Avoid trivia outside the article. Each question must have a clear, unambiguous answer derivable from the article. For multiple choice, distractors must be plausible but clearly wrong. Provide a brief explanation citing the article. Match the requested difficulty and types. Always respond using the provided tool.`;
  }
  return `당신은 LMS의 평가 출제 전문가입니다. 제공된 기사(뉴스, 리포트, 학습자료)를 근거로 고품질 시험 문제를 생성하세요. 기사에 없는 내용을 묻지 마세요. 정답은 기사에서 명확히 도출되어야 하며, 객관식 오답은 그럴듯하지만 분명히 틀려야 합니다. 해설에는 기사 근거를 간략히 제시하세요. 요청된 난이도와 유형을 준수하세요. 반드시 제공된 도구를 호출해 응답하세요.`;
}

type StylePreset =
  | "balanced"
  | "fairness"
  | "concise"
  | "deep"
  | "applied"
  | "exam";

function presetGuideline(preset: StylePreset | undefined, lang: "ko" | "en"): string {
  const p: StylePreset = preset || "balanced";
  const guides: Record<StylePreset, { ko: string; en: string }> = {
    balanced: {
      ko: "균형 잡힌 난이도와 표현으로 출제하세요.",
      en: "Aim for balanced difficulty and phrasing.",
    },
    fairness: {
      ko: "공정성을 최우선으로: 특정 배경지식 없이 기사만으로 풀 수 있어야 하며, 함정/모호한 표현을 피하세요. 오답도 길이·형식이 정답과 유사해야 합니다.",
      en: "Prioritize fairness: solvable from the article alone, avoid trick wording, keep distractors similar in length/format to the answer.",
    },
    concise: {
      ko: "간결하게: 문항은 1~2문장(최대 40자 내외), 보기는 8~15자 내외로 짧게 작성하세요. 군더더기 없는 표현을 사용하세요.",
      en: "Be concise: questions in 1–2 sentences (~25 words), options 3–8 words. Avoid filler.",
    },
    deep: {
      ko: "심화: 단순 사실 확인을 넘어 인과·비교·추론을 묻는 다단계 사고 문항을 출제하세요. 오답은 흔한 오개념을 반영해 그럴듯하게 만드세요.",
      en: "Deep: go beyond fact recall — require cause/effect, comparison, multi-step inference. Distractors should reflect common misconceptions.",
    },
    applied: {
      ko: "적용형: 기사 내용을 새로운 시나리오·사례에 적용해 판단하도록 묻는 문항을 만드세요.",
      en: "Applied: pose new scenarios/cases that require applying the article's concepts.",
    },
    exam: {
      ko: "시험형: 공식 시험 톤으로 격식 있는 문체, 명확한 지시문, 하나의 정확한 정답을 보장하세요.",
      en: "Exam-style: formal tone, precise stems, guarantee a single unambiguous correct answer.",
    },
  };
  const text = guides[p][lang];
  return "\n\n" + (lang === "ko" ? "추가 지침: " : "Additional guidance: ") + text;
}

function buildUserInstruction(req: GenerateRequest, articleText: string | null) {
  const lang = req.language === "en" ? "English" : "Korean";
  const lines = [
    `Language of generated questions: ${lang}`,
    `Total questions: ${req.count}`,
    `Allowed question types: ${req.questionTypes.join(", ")}`,
    `Difficulty: ${req.difficulty || "mixed"}`,
    `Learner level: ${req.learnerLevel || "intermediate"}`,
    req.topicHint ? `Topic focus: ${req.topicHint}` : "",
    "",
    "ARTICLE:",
    articleText ? articleText : "(provided as attached file — read it carefully)",
  ];
  return lines.filter(Boolean).join("\n");
}

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_questions",
    description: "Return generated exam questions grounded in the article.",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question_type: {
                type: "string",
                enum: ["multiple_choice_4", "ox", "short_answer", "essay"],
              },
              question_text: { type: "string" },
              options: {
                type: "array",
                items: { type: "string" },
                description:
                  "For multiple_choice_4: exactly 4 choices. For ox: ['O','X']. For others: empty array.",
              },
              correct_answer: {
                type: "string",
                description:
                  "For MC: the exact text of the correct option. For OX: 'O' or 'X'. For short_answer: the keyword(s). For essay: a model answer (used as grading rubric).",
              },
              explanation: { type: "string" },
              difficulty: {
                type: "string",
                enum: ["easy", "medium", "hard"],
              },
              source_quote: {
                type: "string",
                description: "Short quote from the article supporting the answer.",
              },
            },
            required: [
              "question_type",
              "question_text",
              "options",
              "correct_answer",
              "explanation",
              "difficulty",
            ],
            additionalProperties: false,
          },
        },
        article_summary: {
          type: "string",
          description: "2-3 sentence summary of the article used.",
        },
      },
      required: ["questions", "article_summary"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ===== AuthZ: admin / super_admin 전용 =====
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: roleRows } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as GenerateRequest;

    // Validate
    if (!body.questionTypes || body.questionTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: "questionTypes is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!body.count || body.count < 1 || body.count > 30) {
      return new Response(
        JSON.stringify({ error: "count must be 1-30" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Resolve source
    let articleText: string | null = null;
    let attachedFile: GenerateRequest["file"] | undefined;

    if (body.text && body.text.trim()) {
      articleText = body.text.trim().slice(0, 16000);
    } else if (body.url && body.url.trim()) {
      try {
        articleText = await fetchUrlText(body.url.trim());
      } catch (e) {
        if (e instanceof UrlFetchError) {
          return new Response(
            JSON.stringify({
              error: e.message,
              errorCode: e.code,
              httpStatus: e.status ?? null,
              url: body.url.trim(),
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            error: e instanceof Error ? e.message : "Failed to fetch URL",
            errorCode: "UNKNOWN" as UrlFetchErrorCode,
            url: body.url.trim(),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (body.file?.dataBase64) {
      attachedFile = body.file;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide one of: text, url, or file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lang = body.language === "en" ? "en" : "ko";
    const systemPrompt =
      buildSystemPrompt(lang) + presetGuideline(body.stylePreset, lang);
    const userText = buildUserInstruction(body, articleText);

    // Build messages — multimodal if file is attached
    const userContent: any = attachedFile
      ? [
          { type: "text", text: userText },
          {
            type: "image_url",
            image_url: {
              url: `data:${attachedFile.mimeType};base64,${attachedFile.dataBase64}`,
            },
          },
        ]
      : userText;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_questions" } },
        temperature: 0.4,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI 크레딧이 부족합니다. 워크스페이스 설정에서 충전해주세요." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error ${aiResp.status}`);
    }

    const result = await aiResp.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured questions");
    }

    let parsed: { questions: GeneratedQuestion[]; article_summary: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args:", toolCall.function.arguments);
      throw new Error("AI returned invalid JSON");
    }

    // Sanitize per type
    const cleaned = (parsed.questions || []).map((q) => {
      let options: string[] | null = null;
      if (q.question_type === "multiple_choice_4") {
        options = (q.options || []).slice(0, 4);
        while (options.length < 4) options.push("");
      } else if (q.question_type === "ox") {
        options = ["O", "X"];
      }
      return {
        question_type: q.question_type,
        question_text: q.question_text || "",
        options,
        correct_answer: q.correct_answer || "",
        explanation: q.explanation || "",
        difficulty: q.difficulty || "medium",
        source_quote: q.source_quote || "",
      };
    });

    return new Response(
      JSON.stringify({
        questions: cleaned,
        article_summary: parsed.article_summary || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-questions-from-article error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
