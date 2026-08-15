import { useTranslation } from "react-i18next";
import PageLoading from "@/components/PageLoading";

interface ChartLoadingStateProps {
  /** Optional override for the main label. */
  label?: string;
  /** Optional override for the secondary description (unused, kept for compatibility). */
  description?: string;
  /** Container height — default matches the typical chart panel. */
  height?: string;
}

/**
 * Loading indicator for chart panels.
 * Skeleton bars were removed — a single calm spinner is shown instead.
 */
const ChartLoadingState = ({ label, height = "h-[260px]" }: ChartLoadingStateProps) => {
  const { t } = useTranslation();
  const heading = label ?? t("common.chartLoading", "차트를 불러오는 중입니다");

  return (
    <div className={`w-full ${height} flex items-center justify-center rounded-xl border border-border/50 bg-card`}>
      <PageLoading label={heading} />
    </div>
  );
};

export default ChartLoadingState;
