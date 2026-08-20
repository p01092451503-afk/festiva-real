import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Instagram, Youtube, Facebook, Globe, Shield, ArrowRight, MessageCircle } from "lucide-react";
import { useSiteSettings, useNavItems } from "@/hooks/useSiteSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

const SOCIAL_CLASS =
  "text-footer-muted hover:text-footer-foreground transition-colors";

const SiteFooter = forwardRef<HTMLElement>((_props, ref) => {
  const { data: s } = useSiteSettings();
  const { data: footerNav = [] } = useNavItems("footer");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const logo = s?.footer_logo_url || s?.header_logo_url;

  const { data: latestNotice } = useQuery({
    queryKey: ["footer-latest-notice"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, created_at")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
  });

  const infoLines = [
    [s?.ceo_name && `대표이사 : ${s.ceo_name}`].filter(Boolean).join(""),
    [s?.business_number && `사업자등록번호 ${s.business_number}`, s?.company_name && `상호 ${s.company_name}`]
      .filter(Boolean)
      .join("  "),
    s?.company_address,
  ].filter(Boolean) as string[];

  const contactEmail = s?.company_email || "themiceseoul@naver.com";
  const contactPhone = s?.company_phone || "02-723-7708";
  const contactAddress = s?.company_address || "서울시 종로구 인사동길12 대일빌딩 1005호";


  const workingHours = [
    s?.hours_weekday,
    s?.hours_lunch,
    s?.hours_weekend,
    s?.hours_holiday,
  ].filter(Boolean) as string[];

  return (
    <footer ref={ref} className="bg-footer text-footer-foreground mt-20 sm:mt-28 lg:mt-36">

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
        {/* 상단 2단: 공지사항 + 고객센터 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* 공지사항 */}
          <div className="lg:col-span-7 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">공지사항</h2>
              <Link
                to="/student/announcements"
                className="inline-flex items-center gap-1 text-base text-footer-muted hover:text-footer-foreground transition-colors"
              >
                전체보기 <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {latestNotice ? (
              <Link
                to="/student/announcements"
                className="mt-4 flex items-center justify-between gap-4 py-3 border-b border-footer-border hover:opacity-80 transition-opacity"
              >
                <span className="truncate text-lg sm:text-xl font-medium">{latestNotice.title}</span>
                <span className="shrink-0 text-base text-footer-muted">
                  {new Date(latestNotice.created_at).toLocaleDateString("ko-KR", {
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
              </Link>
            ) : (
              <div className="mt-4 py-3 border-b border-footer-border text-base text-footer-muted">
                등록된 공지사항이 없습니다.
              </div>
            )}
          </div>

          {/* 고객센터 */}
          <div className="lg:col-span-5 min-w-0 lg:text-right lg:items-end">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">고객센터</h2>
            <div className="mt-4 space-y-1.5 text-lg text-footer-muted leading-relaxed">
              {workingHours.length > 0 ? (
                workingHours.map((line) => <p key={line}>{line}</p>)
              ) : (
                <>
                  <p>평일 09:00 - 18:00</p>
                  <p>점심 12:00 - 13:00</p>
                  <p>주말 · 공휴일 휴무</p>
                </>
              )}
            </div>
            <Link
              to="/support?tab=inquiry"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-footer-border px-7 py-3 text-lg font-medium hover:bg-footer-foreground hover:text-footer transition-colors"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              1:1 문의하기
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* 구분선 */}
        <div className="mt-10 sm:mt-12 border-t border-footer-border" />

        {/* 하단: 로고 + 회사 정보 + 링크 */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 로고 + 회사 정보 */}
          <div className="lg:col-span-7 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt={s?.company_name || "festcert"}
                className="h-8 sm:h-9 max-w-[220px] object-contain brightness-0 invert"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Link to="/" className="inline-flex items-center text-3xl sm:text-4xl font-bold tracking-tight">
                <span className="text-footer-foreground">fest</span>
                <span className="text-brand-orange">cert</span>
              </Link>
            )}
            <div className="mt-5 space-y-1.5 text-base sm:text-lg text-footer-muted leading-relaxed">
              {infoLines.map((line) => (
                <p key={line} className="break-words">{line}</p>
              ))}
            </div>

            {(s?.instagram_url || s?.youtube_url || s?.facebook_url || s?.blog_url) && (
              <div className="mt-6 flex items-center gap-6">
                {s?.facebook_url && (
                  <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Facebook">
                    <Facebook className="h-6 w-6" />
                  </a>
                )}
                {s?.youtube_url && (
                  <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="YouTube">
                    <Youtube className="h-6 w-6" />
                  </a>
                )}
                {s?.instagram_url && (
                  <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Instagram">
                    <Instagram className="h-6 w-6" />
                  </a>
                )}
                {s?.blog_url && (
                  <a href={s.blog_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Blog">
                    <Globe className="h-6 w-6" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 링크 + 저작권 */}
          <div className="lg:col-span-5 min-w-0 flex flex-col gap-5 lg:text-right lg:items-end">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
              <Link to="/support" className="text-base font-semibold text-footer-foreground hover:opacity-70 transition-opacity">
                고객센터 안내
              </Link>
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="text-base font-semibold text-brand-orange hover:opacity-70 transition-opacity"
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
                    className="text-base text-footer-muted hover:text-footer-foreground transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.id}
                    to={item.url}
                    className="text-base text-footer-muted hover:text-footer-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <p className="text-base text-footer-muted/80">
              {s?.copyright_text || `© ${new Date().getFullYear()} (사)마이스홍보교육학회. All rights reserved.`}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
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
