import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useDemoPreset } from "@/contexts/DemoPresetContext";

interface LoginVisualPanelProps {
  backgroundImage?: string | null;
  brandName?: string;
  tagline?: string;
  accentColor?: string;
}

const LoginVisualPanel = memo(({
  backgroundImage,
  brandName = "WEBHEADS",
  tagline,
}: LoginVisualPanelProps) => {
  const { t } = useTranslation();
  const { activePreset } = useDemoPreset();
  
  const effectiveBrandName = activePreset?.brand_name || brandName;
  const effectiveBgImage = activePreset?.login_bg_image_url || backgroundImage;
  const displayTagline = activePreset?.brand_tagline || tagline || t("auth.heroTitle");
  const topText = activePreset?.login_top_text || effectiveBrandName;
  const subtitle = activePreset?.login_subtitle ?? "Learning Management System";
  // Allow per-client accent. Falls back to brand violet.
  const accent = activePreset?.accent_hsl?.trim() || "262 70% 45%";
  const accentDeep = activePreset?.accent_hsl?.trim() || "262 70% 40%";
  const accentSoft = activePreset?.accent_hsl?.trim() || "262 50% 92%";

  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ backgroundColor: `hsl(${accentSoft})` }}>
      {effectiveBgImage ? (
        <img
          src={effectiveBgImage}
          alt={effectiveBrandName}
          className="absolute inset-0 w-full h-full object-cover"
          {...({ fetchpriority: "high" } as any)}
          loading="eager"
          decoding="async"
        />
      ) : (
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ backgroundColor: `hsl(${accent})` }}
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="lvp-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.18" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Organic blobs */}
            <path
              d="M-40,180 C90,90 220,260 360,160 C480,80 600,200 660,120 L660,-40 L-40,-40 Z"
              fill="white"
              fillOpacity="0.10"
            />
            <path
              d="M-60,560 C120,470 240,640 400,540 C520,470 640,600 680,520 L680,860 L-60,860 Z"
              fill="black"
              fillOpacity="0.08"
            />
            <path
              d="M80,420 C180,340 280,500 420,400 C520,330 600,460 640,400"
              stroke="white"
              strokeOpacity="0.18"
              strokeWidth="1.2"
              fill="none"
            />
            <ellipse cx="120" cy="260" rx="180" ry="140" fill="url(#lvp-glow)" />
            <ellipse cx="500" cy="640" rx="220" ry="160" fill="url(#lvp-glow)" />
          </svg>
        </div>
      )}

      {/* Brand info overlay */}
      <div className="relative z-10 flex flex-col justify-between p-12 w-full">
        <div>
          <p className="tracking-[0.3em] uppercase text-white drop-shadow-sm">
            <span className="text-[1.3125rem] font-light leading-none align-middle">{topText}</span>
            {subtitle && <span className="text-sm align-middle ml-2">{subtitle}</span>}
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-medium leading-snug whitespace-pre-line text-white drop-shadow-sm">
            {displayTagline}
          </h2>
        </div>
      </div>
    </div>
  );
});

LoginVisualPanel.displayName = "LoginVisualPanel";

export default LoginVisualPanel;
