import { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";

interface OpsStubPageProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  upcoming: string[];
}

/**
 * 산학프로젝트 모듈의 1단계용 공통 플레이스홀더.
 * 메뉴 토글 검증과 라우트 연결을 위한 임시 페이지입니다.
 */
export default function OpsStubPage({
  icon: Icon,
  title,
  subtitle,
  description,
  upcoming,
}: OpsStubPageProps) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <Icon className="h-6 w-6 text-foreground mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          </div>
        </header>

        <section className="stat-card !p-6 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">{description}</p>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase mb-2">
              곧 제공될 기능
            </p>
            <ul className="space-y-1.5">
              {upcoming.map((line, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-foreground">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            본 화면은 시스템 설정 → 기능 모듈에서 ON/OFF 할 수 있는 임시 화면입니다. 다음 단계 작업에서 실제 기능이 채워집니다.
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}