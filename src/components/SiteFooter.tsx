import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Youtube, Facebook, Globe, Shield, Clock, Phone } from "lucide-react";
import { useSiteSettings, useNavItems } from "@/hooks/useSiteSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const SiteFooter = forwardRef<HTMLElement>((_props, ref) => {
  const { data: s } = useSiteSettings();
  const { data: footerNav = [] } = useNavItems("footer");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const logo = s?.footer_logo_url || s?.header_logo_url;

  return (
    <footer className="border-t border-border bg-muted/30 py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-16">
          {/* Company Info */}
          <div className="space-y-6 min-w-0">
            <div className="flex items-center gap-3">
              {logo ? (
                <img
                  src={logo}
                  alt={s?.company_name || "Logo"}
                  className="h-12 max-w-[260px] object-contain"
                  width={260}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex items-baseline text-4xl font-bold tracking-tight">
                  <span className="text-navy">fest</span>
                  <span className="text-brand-orange">cert</span>
                </span>
              )}
            </div>

            {s?.footer_description && (
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{s.footer_description}</p>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {s?.company_name && (
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-widest text-muted-foreground/60 uppercase mb-1">상호</dt>
                  <dd className="text-base font-semibold text-foreground">{s.company_name}</dd>
                </div>
              )}
              {s?.ceo_name && (
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-widest text-muted-foreground/60 uppercase mb-1">대표</dt>
                  <dd className="text-base text-foreground/80">{s.ceo_name}</dd>
                </div>
              )}
              {s?.company_address && (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-[11px] font-medium tracking-widest text-muted-foreground/60 uppercase mb-1">주소</dt>
                  <dd className="text-base text-foreground/80">{s.company_address}</dd>
                </div>
              )}
              {s?.business_number && (
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-widest text-muted-foreground/60 uppercase mb-1">사업자등록번호</dt>
                  <dd className="text-base text-foreground/80">{s.business_number}</dd>
                </div>
              )}
              {s?.company_phone && (
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-widest text-muted-foreground/60 uppercase mb-1">전화</dt>
                  <dd className="text-base text-foreground/80">{s.company_phone}</dd>
                </div>
              )}
              {s?.company_email && (
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium tracking-widest text-muted-foreground/60 uppercase mb-1">이메일</dt>
                  <dd className="text-base text-foreground/80 break-all">{s.company_email}</dd>
                </div>
              )}
            </dl>

            {/* Footer nav links */}
            {footerNav.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                {footerNav.map((item) => {
                  const isExternal = /^https?:\/\//i.test(item.url);
                  return isExternal ? (
                    <a key={item.id} href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.id} to={item.url} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Social */}
            {(s?.instagram_url || s?.youtube_url || s?.facebook_url || s?.blog_url) && (
              <div className="flex items-center gap-2 pt-1">
                {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>}
                {s.youtube_url && <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="YouTube"><Youtube className="h-4 w-4" /></a>}
                {s.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>}
                {s.blog_url && <a href={s.blog_url} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="Blog"><Globe className="h-4 w-4" /></a>}
              </div>
            )}
          </div>

          {/* Business Hours */}
          <div className="min-w-0 lg:justify-self-end w-full lg:w-auto">
            <div className="rounded-xl border border-border bg-background/70 p-6 lg:min-w-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">운영 시간</p>
              </div>
              {s?.hours_weekday && (
                <p className="text-xl font-semibold text-foreground tracking-tight">{s.hours_weekday}</p>
              )}
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {s?.hours_lunch && <p className="text-sm text-muted-foreground">{s.hours_lunch}</p>}
                {s?.hours_weekend && <p className="text-sm text-muted-foreground">{s.hours_weekend}</p>}
                {s?.hours_holiday && <p className="text-sm text-muted-foreground">{s.hours_holiday}</p>}
              </div>
              {s?.company_phone && (
                <a href={`tel:${s.company_phone.replace(/[^0-9+]/g, "")}`} className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                  <Phone className="h-3.5 w-3.5" />
                  {s.company_phone}
                </a>
              )}
            </div>
          </div>
        </div>


        {/* Copyright */}
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground/70 text-center">
            {s?.copyright_text || `© ${new Date().getFullYear()} ${s?.company_name || "축제운영전문가 자격증 교육원"}. All rights reserved.`}
          </p>
        </div>
      </div>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              개인정보처리방침
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {s?.privacy_policy ? (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{s.privacy_policy}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic py-8 text-center">개인정보처리방침이 아직 등록되지 않았습니다.</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </footer>
  );
});
SiteFooter.displayName = "SiteFooter";

export default SiteFooter;
