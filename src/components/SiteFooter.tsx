import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Youtube, Facebook, Globe, ImageIcon, Shield } from "lucide-react";
import { useSiteSettings, useNavItems } from "@/hooks/useSiteSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const SiteFooter = forwardRef<HTMLElement>((_props, ref) => {
  const { data: s } = useSiteSettings();
  const { data: footerNav = [] } = useNavItems("footer");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const logo = s?.footer_logo_url || s?.header_logo_url;

  return (
    <footer className="border-t border-border bg-muted/30 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {logo ? (
                <img
                  src={logo}
                  alt={s?.company_name || "Logo"}
                  className="h-8 max-w-[180px] object-contain"
                  width={180}
                  height={32}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="flex items-baseline text-2xl font-bold tracking-tight">
                  <span className="text-navy">fest</span>
                  <span className="text-brand-orange">cert</span>
                </span>
              )}
            </div>


            {s?.footer_description && (
              <p className="text-xs text-muted-foreground max-w-md">{s.footer_description}</p>
            )}

            <div className="space-y-1.5 text-sm text-muted-foreground">
              {s?.company_name && (
                <p className="font-medium text-foreground/70">
                  <span className="text-xs text-muted-foreground/50 mr-1">상호</span>
                  {s.company_name}
                </p>
              )}
              {s?.ceo_name && (
                <p><span className="text-xs text-muted-foreground/50 mr-1">대표</span>{s.ceo_name}</p>
              )}
              {s?.company_address && (
                <p><span className="text-xs text-muted-foreground/50 mr-1">주소</span>{s.company_address}</p>
              )}
              {s?.business_number && (
                <p><span className="text-xs text-muted-foreground/50 mr-1">사업자등록번호</span>{s.business_number}</p>
              )}
              {s?.company_phone && (
                <p><span className="text-xs text-muted-foreground/50 mr-1">전화</span>{s.company_phone}</p>
              )}
              {s?.company_email && (
                <p><span className="text-xs text-muted-foreground/50 mr-1">이메일</span>{s.company_email}</p>
              )}
            </div>

            {/* Footer nav links */}
            {footerNav.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                {footerNav.map((item) => {
                  const isExternal = /^https?:\/\//i.test(item.url);
                  return isExternal ? (
                    <a key={item.id} href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
                      {item.label}
                    </a>
                  ) : (
                    <Link key={item.id} to={item.url} className="text-xs text-muted-foreground hover:text-foreground">
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Social */}
            {(s?.instagram_url || s?.youtube_url || s?.facebook_url || s?.blog_url) && (
              <div className="flex items-center gap-2 pt-2">
                {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="Instagram"><Instagram className="h-3.5 w-3.5" /></a>}
                {s.youtube_url && <a href={s.youtube_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="YouTube"><Youtube className="h-3.5 w-3.5" /></a>}
                {s.facebook_url && <a href={s.facebook_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="Facebook"><Facebook className="h-3.5 w-3.5" /></a>}
                {s.blog_url && <a href={s.blog_url} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors" aria-label="Blog"><Globe className="h-3.5 w-3.5" /></a>}
              </div>
            )}
          </div>

          {/* Business Hours */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="text-xs font-medium tracking-widest text-muted-foreground/50 uppercase">Time</p>
            {s?.hours_weekday && <p className="font-medium text-foreground/70">{s.hours_weekday}</p>}
            {s?.hours_lunch && <p className="text-xs">{s.hours_lunch}</p>}
            {s?.hours_weekend && <p className="text-xs">{s.hours_weekend}</p>}
            {s?.hours_holiday && <p className="text-xs">{s.hours_holiday}</p>}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground/50 text-center">
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
