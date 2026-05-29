import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useFeatureModules, type FeatureModuleKey } from "@/hooks/useFeatureModules";
import { FullScreenSkeleton } from "@/components/PageSkeletons";

interface FeatureGateProps {
  module: FeatureModuleKey;
  children: ReactNode;
  /** true면 비활성 시 / 로 리다이렉트, false면 null 반환 */
  redirectIfDisabled?: boolean;
}

/**
 * 산학프로젝트 기능 모듈 게이트.
 * - 모듈이 비활성화되어 있으면 자식 컴포넌트를 렌더링하지 않습니다.
 * - 라우트 보호용으로 사용 시 `redirectIfDisabled`로 홈 이동.
 */
export default function FeatureGate({
  module,
  children,
  redirectIfDisabled = true,
}: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeatureModules();

  if (isLoading) return <FullScreenSkeleton />;

  if (!isEnabled(module)) {
    return redirectIfDisabled ? <Navigate to="/" replace /> : null;
  }

  return <>{children}</>;
}