import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Instagram, Youtube, Facebook, Globe, Shield, ArrowRight } from "lucide-react";
import { useSiteSettings, useNavItems } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const SOCIAL_CLASS =
  "h-9 w-9 rounded-full bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors";

const SiteFooter = forwardRef<HTMLElement>((_props, ref) => {
  const { data: s } = useSiteSettings();
  const { data: footerNav = [] } = useNavItems("footer");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const logo = s?.footer_logo_url || s?.header_logo_url;

  const { data: notices = [] } = useQuery({
    queryKey: ["footer-notices"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, created_at, is_pinned")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) return [];
      return data ?? [];
    },
  });

  const infoLines = [
    s?.company_address,
    [
      s?.business_number && `사업자등록번호 : ${s.business_number}`,
      s?.company_name && `상호 : ${s.company_name}`,
      s?.ceo_name && `대표 : ${s.ceo_name}`,
    ]
      .filter(Boolean)
      .join("  "),
    [
      s?.company_phone && `고객센터 : ${s.company_phone}`,
      s?.company_email && `이메일 : ${s.company_email}`,
    ]
      .filter(Boolean)
      .join("  "),
  ].filter(Boolean) as string[];

  return (
    <footer ref={ref} className="bg-warm-900 text-primary-foreground">
      <div className="max-w-6xl mx-auto px-4">
        {/* 상단: 공지사항 + 고객센터 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 lg:gap-16 py-12 sm:py-14">
          <div className="min-w-0">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-primary-foreground">공지사항</h2>
              <Link
                to="/support"
                className="inline-flex items-center gap-1 text-base font-medium text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              >
                전체보기
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-6 space-y-4">
              {Array.isArray(notices) && notices.length > 0 ? (
                notices.map((n: any) => (
                  <li key={n.id}>
                    <Link
                      to="/support"
                      className="flex items-center justify-between gap-6 group min-w-0"
                    >
                      <span className="truncate text-base text-primary-foreground/85 group-hover:text-primary-foreground transition-colors">
                        {n.is_pinned ? "[공지] " : ""}
                        {n.title}
                      </span>
                      <span className="shrink-0 text-sm text-primary-foreground/45">
                        {new Date(n.created_at)
                          .toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })
                          .replace(/\.$/, "")}
                      </span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-base text-primary-foreground/50">등록된 공지사항이 없습니다.</li>
              )}
            </ul>
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-bold text-primary-foreground">고객센터</h2>
            {s?.company_phone && (
              <a
                href={`tel:${s.company_phone.replace(/[^0-9+]/g, "")}`}
                className="mt-4 block text-3xl sm:text-4xl font-bold tracking-tight text-brand-orange hover:opacity-90 transition-opacity"
              >
                {s.company_phone}
              </a>
            )}
            <div className="mt-4 space-y-1.5 text-sm text-primary-foreground/55 leading-relaxed">
              {s?.hours_weekday && <p>{s.hours_weekday}</p>}
              {s?.hours_lunch && <p>{s.hours_lunch}</p>}
              {s?.hours_weekend && <p>{s.hours_weekend}</p>}
              {s?.hours_holiday && <p>{s.hours_holiday}</p>}
            </div>
            <Link
              to="/support?tab=inquiry"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 px-5 py-2.5 text-base font-semibold leading-normal text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors"
            >
              1:1 문의하기
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* 하단: 사업자 정보 + 소셜 */}
        <div className="border-t border-primary-foreground/10 py-10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10">
            <div className="min-w-0 space-y-5">
              {logo ? (
                <img
                  src={logo}
                  alt={s?.company_name || "Logo"}
                  className="h-9 max-w-[220px] object-contain brightness-0 invert"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex items-baseline text-3xl font-bold tracking-tight">
                  <span className="text-primary-foreground">fest</span>
                  <span className="text-brand-orange">cert</span>
                </span>
              )}

              <div className="space-y-2">
                {infoLines.map((line) => (
                  <p key={line} className="text-sm text-primary-foreground/50 leading-relaxed break-words">
                    {line}
                  </p>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <button
                  type="button"
                  onClick={() => setPrivacyOpen(true)}
                  className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  개인정보처리방침
                </button>
                {footerNav.map((item) => {
                  const isExternal = /^https?:\/\//i.test(item.url);
                  return isExternal ? (
                    <a
                      key={item.id}
                      href={item.url}
                      target={item.open_in_new_tab ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.id}
                      to={item.url}
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {(s?.instagram_url || s?.youtube_url || s?.facebook_url || s?.blog_url) && (
              <div className="flex items-center gap-3 lg:pt-1.5">
                {s.instagram_url && (
                  <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Instagram">
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {s.youtube_url && (
                  <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="YouTube">
                    <Youtube className="h-4 w-4" />
                  </a>
                )}
                {s.facebook_url && (
                  <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Facebook">
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {s.blog_url && (
                  <a href={s.blog_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Blog">
                    <Globe className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          <p className="mt-10 text-sm text-primary-foreground/35">
            {s?.copyright_text ||
              `© ${new Date().getFullYear()} ${s?.company_name || "축제운영전문가 자격증 교육원"}. All rights reserved.`}
          </p>
        </div>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-4 w-4 text-primary" />
              개인정보처리방침
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {s?.privacy_policy ? (
              <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">{s.privacy_policy}</p>
            ) : (
              <p className="text-base text-muted-foreground italic py-8 text-center">개인정보처리방침이 아직 등록되지 않았습니다.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </footer>
  );
});
SiteFooter.displayName = "SiteFooter";

export default SiteFooter;
