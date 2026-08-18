import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag, Bell, LogOut, BookOpen, Receipt, Heart, Settings, ChevronDown, Menu, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import { useDemoPreset } from "@/contexts/DemoPresetContext";
import { useSiteSettings, useNavItems } from "@/hooks/useSiteSettings";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const StorefrontHeader = () => {
  const { user, profile, roles, signOut } = useUser();
  const { activePreset } = useDemoPreset();
  const { data: siteSettings } = useSiteSettings();
  const { data: navItems = [] } = useNavItems("header");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isEn = i18n.language?.startsWith("en");
  const logoUrl = siteSettings?.header_logo_url || activePreset?.logo_url;

  const { data: cartCount = 0 } = useQuery({
    queryKey: ["cart-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cart_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const initials = profile?.full_name
    ? profile.full_name.slice(0, 2)
    : user?.email?.slice(0, 2)?.toUpperCase() || "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-navy-dark bg-navy text-primary-foreground">
      <div className="max-w-7xl mx-auto flex h-24 items-center justify-between px-4">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={siteSettings?.company_name || activePreset?.brand_name || "Logo"}
              className="h-16 object-contain"
              width={240}
              height={64}
              loading="eager"
              {...({ fetchpriority: "high" } as any)}
              decoding="sync"
            />
          ) : (
            <span className="flex items-baseline text-4xl font-bold tracking-tight">
              <span className="text-primary-foreground">fest</span>
              <span className="text-brand-orange">cert</span>
            </span>
          )}
        </Link>

        {/* Center: Nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1 h-full">
          {navItems.length > 0 ? (
            navItems.map((item) => {
              const isExternal = /^https?:\/\//i.test(item.url);
              const label = isEn && item.label_en ? item.label_en : item.label;
              const isActive =
                !isExternal &&
                (pathname === item.url ||
                  (item.url !== "/" && pathname.startsWith(item.url)));
              const linkClass = `relative flex items-center h-24 px-8 text-lg font-semibold transition-colors border-b-4 ${
                isActive
                  ? "border-brand-orange text-primary-foreground"
                  : "border-transparent text-primary-foreground/80 hover:text-primary-foreground hover:border-brand-orange/50"
              }`;
              return isExternal ? (
                <a
                  key={item.id}
                  href={item.url}
                  target={item.open_in_new_tab ? "_blank" : undefined}
                  rel={item.open_in_new_tab ? "noopener noreferrer" : undefined}
                  className={linkClass}
                >
                  {label}
                </a>
              ) : (
                <Link key={item.id} to={item.url} className={linkClass} aria-current={isActive ? "page" : undefined}>
                  {label}
                </Link>
              );
            })
          ) : (
            <span className="text-sm text-primary-foreground/50 italic">메뉴를 등록해주세요</span>
          )}
        </nav>


        {/* Right: Actions (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          {!user ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/auth")}
                aria-label="장바구니"
              >
                <ShoppingBag className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                로그인
              </Button>
              <Button size="sm" onClick={() => navigate("/auth")}>
                무료로 시작
              </Button>
            </>
          ) : (
            <>
              {/* Cart */}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/cart")}
                aria-label="장바구니"
              >
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full"
                  >
                    {cartCount}
                  </Badge>
                )}
              </Button>

              {/* Notifications */}
              <NotificationBell />

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 pl-1.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/student")}>
                    <BookOpen className="h-4 w-4 mr-2" />{t("common.myClassroom")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/my/orders")}>
                    <Receipt className="h-4 w-4 mr-2" />{t("mypage.ordersTab")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/my/wishlist")}>
                    <Heart className="h-4 w-4 mr-2" />{t("mypage.wishlistTab")}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <Settings className="h-4 w-4 mr-2" />{t("common.adminPanel")}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />{t("auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t("common.menu")}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 pb-4 pt-2 space-y-2">
          {navItems.length > 0 && (
            <div className="space-y-1 pb-2 border-b border-border">
              {navItems.map((item) => {
                const isExternal = /^https?:\/\//i.test(item.url);
                const label = isEn && item.label_en ? item.label_en : item.label;
                return isExternal ? (
                  <a key={item.id} href={item.url} target={item.open_in_new_tab ? "_blank" : undefined} rel="noopener noreferrer" className="block px-2 py-2 text-sm text-foreground hover:bg-accent rounded-md" onClick={() => setMobileOpen(false)}>{label}</a>
                ) : (
                  <Link key={item.id} to={item.url} className="block px-2 py-2 text-sm text-foreground hover:bg-accent rounded-md" onClick={() => setMobileOpen(false)}>{label}</Link>
                );
              })}
            </div>
          )}
          {!user ? (
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>
                {t("auth.login")}
              </Button>
              <Button size="sm" onClick={() => { navigate("/auth"); setMobileOpen(false); }}>
                {t("common.freeStart")}
              </Button>
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => { navigate("/cart"); setMobileOpen(false); }}>
                <ShoppingBag className="h-4 w-4" />{t("common.cart")}{cartCount > 0 && ` (${cartCount})`}
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => { navigate("/student"); setMobileOpen(false); }}>
                <BookOpen className="h-4 w-4" />{t("common.myClassroom")}
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => { navigate("/my/orders"); setMobileOpen(false); }}>
                <Receipt className="h-4 w-4" />{t("mypage.ordersTab")}
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => { navigate("/my/wishlist"); setMobileOpen(false); }}>
                <Heart className="h-4 w-4" />{t("mypage.wishlistTab")}
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => { navigate("/admin"); setMobileOpen(false); }}>
                  <Settings className="h-4 w-4" />{t("common.adminPanel")}
                </Button>
              )}
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                <LogOut className="h-4 w-4" />{t("auth.logout")}
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default StorefrontHeader;
