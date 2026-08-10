import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type SortDir = "asc" | "desc";
export type SortState = { key: string | null; dir: SortDir };

export type SortAccessor<T> = (row: T) => string | number | Date | null | undefined;

interface Options {
  /** 기본 정렬 기준 컬럼 키 */
  defaultKey?: string;
  /** 기본 정렬 방향 */
  defaultDir?: SortDir;
  /** URL 쿼리스트링에 정렬 상태를 저장할지 여부 (기본 true) */
  syncUrl?: boolean;
  /** URL 파라미터 접두사 (한 화면에 표가 여러 개일 때 구분) */
  paramPrefix?: string;
}

/**
 * 목록 화면 공통 정렬 훅.
 * - 머리글 클릭 시 오름차순 -> 내림차순 -> 기본값 순으로 순환
 * - 정렬 상태를 주소(URL)에 반영하여 뒤로가기/링크 공유 시 동일 화면 재현
 */
export function useTableSort(options: Options = {}) {
  const { defaultKey = null, defaultDir = "desc", syncUrl = true, paramPrefix = "" } = options;
  const sortParam = `${paramPrefix}sort`;
  const dirParam = `${paramPrefix}dir`;

  const [searchParams, setSearchParams] = useSearchParams();
  const [localSort, setLocalSort] = useState<SortState>({ key: defaultKey, dir: defaultDir });

  const sort: SortState = useMemo(() => {
    if (!syncUrl) return localSort;
    const key = searchParams.get(sortParam);
    const dir = searchParams.get(dirParam);
    return {
      key: key ?? defaultKey,
      dir: dir === "asc" || dir === "desc" ? dir : defaultDir,
    };
  }, [syncUrl, localSort, searchParams, sortParam, dirParam, defaultKey, defaultDir]);

  const applySort = useCallback(
    (next: SortState) => {
      if (!syncUrl) {
        setLocalSort(next);
        return;
      }
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (!next.key || (next.key === defaultKey && next.dir === defaultDir)) {
            params.delete(sortParam);
            params.delete(dirParam);
          } else {
            params.set(sortParam, next.key);
            params.set(dirParam, next.dir);
          }
          return params;
        },
        { replace: true },
      );
    },
    [syncUrl, setSearchParams, sortParam, dirParam, defaultKey, defaultDir],
  );

  /** 머리글 클릭 처리: 오름차순 -> 내림차순 -> 기본값 */
  const toggleSort = useCallback(
    (key: string) => {
      if (sort.key !== key) {
        applySort({ key, dir: "asc" });
        return;
      }
      if (sort.dir === "asc") {
        applySort({ key, dir: "desc" });
        return;
      }
      applySort({ key: defaultKey, dir: defaultDir });
    },
    [sort, applySort, defaultKey, defaultDir],
  );

  return { sort, toggleSort, setSort: applySort };
}

const normalize = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value;
};

/**
 * 정렬 기준에 따라 배열을 정렬한다(원본 불변).
 * 값이 없는 항목은 정렬 방향과 무관하게 항상 뒤로 보낸다.
 */
export function sortRows<T>(
  rows: T[],
  sort: SortState,
  accessors: Record<string, SortAccessor<T>>,
): T[] {
  if (!sort.key) return rows;
  const accessor = accessors[sort.key];
  if (!accessor) return rows;

  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = normalize(accessor(a));
    const bv = normalize(accessor(b));
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), "ko", { numeric: true, sensitivity: "base" }) * factor;
  });
}
