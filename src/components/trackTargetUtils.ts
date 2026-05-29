import { getCountryName } from "@/components/TargetScopeSelector";

/** Compact label for showing track audience on the admin list. */
export const formatTrackTargetLabel = (
  scope: string,
  ctx: {
    countries?: string[] | null;
    branchNames?: string[] | null;
    userNames?: string[] | null;
  }
): string => {
  if (scope !== "targeted") return "전체";
  const parts: string[] = [];
  if (ctx.countries?.length) {
    parts.push(`🌐 ${ctx.countries.map((c) => getCountryName(c)).join(", ")}`);
  }
  if (ctx.branchNames?.length) {
    parts.push(`🏢 ${ctx.branchNames.join(", ")}`);
  }
  if (ctx.userNames?.length) {
    parts.push(`👤 ${ctx.userNames.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "대상 미지정";
};