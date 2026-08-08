/** 상품(강의·교보재) 공통 판매 상태 정의 */
export type SaleStatus = "open_alert" | "presale" | "on_sale" | "closed" | "sold_out";

export const SALE_STATUS_ORDER: SaleStatus[] = [
  "open_alert",
  "presale",
  "on_sale",
  "closed",
  "sold_out",
];

export const SALE_STATUS_META: Record<
  SaleStatus,
  { label: string; labelEn: string; desc: string; className: string }
> = {
  open_alert: {
    label: "오픈알림",
    labelEn: "Open alert",
    desc: "알림 신청을 받는 단계입니다. 오픈 예정일·수강신청일·운영시작일을 안내합니다.",
    className: "text-sky-700 bg-sky-50 border-sky-200",
  },
  presale: {
    label: "사전신청",
    labelEn: "Pre-order",
    desc: "정식 오픈 전 사전 신청을 받습니다.",
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
  on_sale: {
    label: "신청하기",
    labelEn: "On sale",
    desc: "신청 가능 상태입니다. 신청 완료 시 알림톡이 자동 발송됩니다.",
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  closed: {
    label: "신청마감",
    labelEn: "Closed",
    desc: "신청이 마감되었습니다.",
    className: "text-muted-foreground bg-secondary border-border",
  },
  sold_out: {
    label: "품절",
    labelEn: "Sold out",
    desc: "재고가 소진되었습니다.",
    className: "text-rose-700 bg-rose-50 border-rose-200",
  },
};

export const saleStatusLabel = (status?: string | null, isEn = false) => {
  const meta = SALE_STATUS_META[(status || "on_sale") as SaleStatus];
  if (!meta) return status || "-";
  return isEn ? meta.labelEn : meta.label;
};

export const saleStatusClass = (status?: string | null) =>
  SALE_STATUS_META[(status || "on_sale") as SaleStatus]?.className ??
  "text-muted-foreground bg-secondary border-border";

/** 회원 상태 */
export type MemberStatus = "active" | "dormant" | "suspended" | "withdrawn";

export const MEMBER_STATUS_ORDER: MemberStatus[] = ["active", "dormant", "suspended", "withdrawn"];

export const MEMBER_STATUS_META: Record<MemberStatus, { label: string; labelEn: string; className: string }> = {
  active: { label: "활성", labelEn: "Active", className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  dormant: { label: "휴면", labelEn: "Dormant", className: "text-amber-700 bg-amber-50 border-amber-200" },
  suspended: { label: "정지", labelEn: "Suspended", className: "text-rose-700 bg-rose-50 border-rose-200" },
  withdrawn: { label: "탈퇴", labelEn: "Withdrawn", className: "text-muted-foreground bg-secondary border-border" },
};

export const memberStatusLabel = (status?: string | null, isEn = false) => {
  const meta = MEMBER_STATUS_META[(status || "active") as MemberStatus];
  if (!meta) return status || "-";
  return isEn ? meta.labelEn : meta.label;
};

export const memberStatusClass = (status?: string | null) =>
  MEMBER_STATUS_META[(status || "active") as MemberStatus]?.className ??
  "text-muted-foreground bg-secondary border-border";

export const GENDER_LABEL: Record<string, string> = {
  male: "남성",
  female: "여성",
  other: "기타",
};
