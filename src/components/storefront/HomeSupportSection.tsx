import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock, HelpCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** 공지사항 / 자주 묻는 질문 + 학습 지원 안내 홈 섹션 */
const HomeSupportSection = () => {
  const [tab, setTab] = useState<"notice" | "faq">("notice");

  const { data: notices = [] } = useQuery({
    queryKey: ["home-support-notices"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, created_at, is_pinned")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: faqs = [] } = useQuery({
    queryKey: ["home-support-faqs"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_faqs")
        .select("id, question, sort_order")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .limit(4);
      if (error) return [];
      return data ?? [];
    },
  });

  const items =
    tab === "notice"
      ? (notices as any[]).map((n) => ({
          id: n.id,
          label: n.title,
          meta: new Date(n.created_at).toLocaleDateString("ko-KR"),
          pinned: n.is_pinned,
        }))
      : (faqs as any[]).map((f) => ({ id: f.id, label: f.question, meta: "", pinned: false }));

  if (items.length === 0) return null;

  return (
    <section className="border-b border-border bg-muted/20">
      <div className="max-w-6xl mx-auto px-4 py-14 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 공지 / FAQ 탭 */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-background overflow-hidden">
          <div className="grid grid-cols-2" role="tablist" aria-label="공지사항 및 자주 묻는 질문">
            {(
              [
                { key: "notice", label: "공지사항" },
                { key: "faq", label: "자주 묻는 질문(FAQ)" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`py-4 text-base font-semibold transition-colors ${
                  tab === t.key
                    ? "bg-navy text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-navy border-b border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-border last:border-b-0">
                <Link
                  to={tab === "notice" ? "/support" : "/support?tab=faq"}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-muted/40 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {item.pinned && (
                      <span className="shrink-0 text-xs font-bold text-brand-orange">필독</span>
                    )}
                    <span className="truncate text-base text-foreground/90">{item.label}</span>
                  </span>
                  {item.meta && (
                    <span className="shrink-0 text-sm text-muted-foreground">{item.meta}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 학습 지원 안내 */}
        <div className="rounded-2xl border border-border bg-background p-7 text-center flex flex-col">
          <p className="text-base font-semibold text-muted-foreground">학습운영 · 문의 안내</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-navy">1:1 온라인 문의</p>
          <div className="mt-4 space-y-1.5 text-base text-muted-foreground">
            <p className="flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" aria-hidden="true" />
              평일 09:00 ~ 18:00
            </p>
            <p>점심시간 12:00 ~ 13:00</p>
            <p>(토·일요일 및 공휴일 휴무)</p>
            <p className="text-sm">접수 후 24시간 내 답변</p>
          </div>
          <div className="mt-6 space-y-2">
            <Link
              to="/support?tab=inquiry"
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-orange px-5 py-3.5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              1:1 문의하기
            </Link>
            <Link
              to="/support?tab=faq"
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-3.5 text-base font-semibold text-navy transition-colors hover:bg-muted/50"
            >
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
              자주 묻는 질문
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeSupportSection;
