import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortState } from "@/hooks/useTableSort";

interface SortHeaderProps {
  /** 정렬 기준 키 */
  sortKey: string;
  label: React.ReactNode;
  sort: SortState;
  onToggle: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}

/**
 * 목록 표 공통 머리글. 클릭 시 오름차순/내림차순/해제 순으로 순환하며
 * 현재 정렬 상태를 아이콘과 스크린리더 안내로 표시한다.
 */
const SortHeader = ({ sortKey, label, sort, onToggle, align = "left", className }: SortHeaderProps) => {
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort as "ascending" | "descending" | "none"}
      className={cn(
        "text-xs font-medium text-muted-foreground px-4 py-3",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors hover:text-foreground",
          active && "text-foreground font-semibold",
          align === "right" && "flex-row-reverse",
        )}
      >
        <span className="whitespace-nowrap">{label}</span>
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
        )}
        <span className="sr-only">
          {active ? (sort.dir === "asc" ? "오름차순 정렬됨" : "내림차순 정렬됨") : "정렬하려면 클릭"}
        </span>
      </button>
    </th>
  );
};

export default SortHeader;
