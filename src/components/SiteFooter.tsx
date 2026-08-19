import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Youtube, Facebook, Globe, Shield, ArrowRight } from "lucide-react";
import { useSiteSettings, useNavItems } from "@/hooks/useSiteSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const SOCIAL_CLASS =
  "text-muted-foreground/60 hover:text-foreground transition-colors";

const SiteFooter = forwardRef<HTMLElement>((_props, ref) => {
  const { data: s } = useSiteSettings();
  const { data: footerNav = [] } = useNavItems("footer");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const logo = s?.footer_logo_url || s?.header_logo_url;

  const infoLines = [
    [s?.ceo_name && `대표이사 : ${s.ceo_name}`].filter(Boolean).join(""),
    [s?.business_number && `사업자등록번호 ${s.business_number}`, s?.company_name && `상호 ${s.company_name}`]
      .filter(Boolean)
      .join("  "),
    s?.company_address,
    s?.company_email,
    s?.company_phone,
  ].filter(Boolean) as string[];

  return (
    <footer ref={ref} className="bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-12">
        {/* 좌측 정보 블록 */}
        <div className="mt-16 max-w-xl">
          <Link
            to="/store/courses"
            className="inline-flex items-center justify-center gap-3 border border-border px-8 py-4 text-base font-medium hover:bg-muted transition-colors"
          >
            강의 안내 보기
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <div className="mt-10 space-y-3">
            {infoLines.map((line) => (
              <p key={line} className="text-sm sm:text-base text-foreground/80 leading-relaxed break-words">
                {line}
              </p>
            ))}
          </div>

          {(s?.hours_weekday || s?.hours_lunch || s?.hours_weekend || s?.hours_holiday) && (
            <div className="mt-6 space-y-1.5 text-sm text-muted-foreground/70 leading-relaxed">
              {s?.hours_weekday && <p>{s.hours_weekday}</p>}
              {s?.hours_lunch && <p>{s.hours_lunch}</p>}
              {s?.hours_weekend && <p>{s.hours_weekend}</p>}
              {s?.hours_holiday && <p>{s.hours_holiday}</p>}
            </div>
          )}

          {(s?.instagram_url || s?.youtube_url || s?.facebook_url || s?.blog_url) && (
            <div className="mt-10 flex items-center gap-7">
              {s?.facebook_url && (
                <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {s?.youtube_url && (
                <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="YouTube">
                  <Youtube className="h-5 w-5" />
                </a>
              )}
              {s?.instagram_url && (
                <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
              )}
              {s?.blog_url && (
                <a href={s.blog_url} target="_blank" rel="noopener noreferrer" className={SOCIAL_CLASS} aria-label="Blog">
                  <Globe className="h-5 w-5" />
                </a>
              )}
            </div>
          )}

          {logo && (
            <img
              src={logo}
              alt={s?.company_name || "Logo"}
              className="mt-12 h-8 max-w-[200px] object-contain opacity-80"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>

        {/* 하단 링크 + 저작권 */}
        <div className="mt-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/support" className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity">
              고객센터 안내
            </Link>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity"
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
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.id}
                  to={item.url}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground/70">
            {s?.copyright_text || `© EST. ${new Date().getFullYear()}`}
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
