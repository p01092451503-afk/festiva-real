/**
 * 매뉴얼 버전 이력
 * - 매뉴얼 내용을 수정하거나 새 기능이 추가되어 매뉴얼에 반영했을 때 이 배열의 맨 위에 항목을 추가하세요.
 * - 최상단 항목이 "현재 버전"으로 매뉴얼 페이지 헤더에 표시됩니다.
 * - date 는 ISO 형식(YYYY-MM-DD) 권장.
 */
export interface ManualVersion {
  version: string;
  date: string; // YYYY-MM-DD
  changes: string[];
}

export const MANUAL_VERSIONS: ManualVersion[] = [
  {
    version: "1.2.0",
    date: "2026-04-29",
    changes: [
      "문제은행(Question Bank) 관리 기능 추가 — 난이도(쉬움/보통/어려움) × 학습자 수준(입문/중급/고급) × 카테고리/태그",
      "평가 생성 시 출제 방식 선택: 고정 출제 / 문제은행 랜덤 출제(조건별 N문항 자동 추출)",
      "평가별 풀 출제 규칙 편집기 — 강의 풀·전역 풀 포함 여부 토글",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-29",
    changes: [
      "지점 중간관리자(Branch Admin) 역할 및 권한 토글 시스템 안내 추가",
      "매뉴얼 버전/생성일 관리 기능 도입",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-22",
    changes: [
      "초기 사용자 매뉴얼 공개 (학습자 흐름 6단계, 관리자 운영 흐름 7단계)",
      "키워드 검색 및 자동 하이라이트 기능 포함",
    ],
  },
];

export const CURRENT_MANUAL_VERSION = MANUAL_VERSIONS[0];