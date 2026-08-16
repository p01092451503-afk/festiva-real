import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  BookMarked, Shield, GraduationCap, Users, Search, X, ArrowRight, Info,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useUserRole } from "@/hooks/useUserRole";

/* -------------------------------------------------------------------------- */
/* 매뉴얼 데이터                                                               */
/* -------------------------------------------------------------------------- */

interface ManualFeature {
  /** 기능 이름 */
  title: string;
  /** 이 기능이 무엇인지 한 문장 설명 */
  summary: string;
  /** 화면 경로 (있으면 바로가기 버튼 노출) */
  href?: string;
  /** 좌측 메뉴 위치 안내 */
  where?: string;
  /** 따라 하기 단계 */
  steps: string[];
  /** 알아두면 좋은 점 */
  tips?: string[];
}

interface ManualSection {
  id: string;
  title: string;
  description: string;
  features: ManualFeature[];
}

const ADMIN_SECTIONS: ManualSection[] = [
  {
    id: "admin-start",
    title: "1. 시작하기 — 로그인과 화면 구조",
    description: "관리자 화면에 처음 들어왔을 때 무엇이 어디에 있는지 익히는 단계입니다.",
    features: [
      {
        title: "관리자로 로그인하기",
        summary: "관리자 계정으로 로그인하면 자동으로 관리자 대시보드가 열립니다.",
        href: "/admin",
        where: "좌측 메뉴 > 인사이트·통계 > 관리자 대시보드",
        steps: [
          "로그인 화면에서 관리자 계정의 이메일과 비밀번호를 입력합니다.",
          "로그인하면 역할에 따라 자동으로 /admin 화면이 열립니다.",
          "화면 왼쪽에 메뉴, 가운데에 내용, 위쪽에 알림·언어·프로필이 있습니다.",
        ],
        tips: [
          "비밀번호를 잊었다면 로그인 화면의 '비밀번호 재설정'을 이용하세요.",
          "관리자·강사·학생 권한을 함께 가진 계정은 상단의 '역할 전환' 버튼으로 화면을 바꿀 수 있습니다.",
        ],
      },
      {
        title: "역할 전환 (관리자 ↔ 강사 ↔ 학생)",
        summary: "실제 학습자가 보는 화면을 그대로 확인할 수 있는 미리보기 기능입니다.",
        where: "화면 상단 오른쪽 '역할 전환' 버튼",
        steps: [
          "상단 오른쪽의 '역할 전환' 버튼을 누릅니다.",
          "Admin / Teacher / Student 중 원하는 역할을 선택합니다.",
          "선택한 역할의 첫 화면으로 이동합니다. 다시 관리자로 돌아오려면 같은 버튼에서 Admin을 선택합니다.",
        ],
        tips: ["학생 모드일 때는 관리자 전용 화면에 들어갈 수 없습니다. 정상 동작이니 당황하지 마세요."],
      },
      {
        title: "좌측 메뉴 구조 이해하기",
        summary: "메뉴는 목적별 그룹(인사이트·회원·강의·학습·콘텐츠·커뮤니티·판매·다국어·시스템)으로 묶여 있습니다.",
        steps: [
          "그룹 이름을 누르면 하위 메뉴가 펼쳐집니다.",
          "메뉴가 너무 많다면 시스템 설정 > 사이드바 숨김 설정에서 사용하지 않는 메뉴를 감출 수 있습니다.",
          "화면이 좁을 때는 왼쪽 위 아이콘으로 메뉴를 접었다 펼 수 있습니다.",
        ],
      },
    ],
  },
  {
    id: "admin-members",
    title: "2. 회원 관리",
    description: "가입한 회원을 조회·수정하고, 권한과 소속을 관리합니다.",
    features: [
      {
        title: "회원 목록 조회 · 검색",
        summary: "이름, 이메일, 전화번호 뒷자리 등으로 회원을 통합 검색합니다.",
        href: "/admin/users",
        where: "좌측 메뉴 > 회원 > 회원 관리",
        steps: [
          "검색창에 이름·이메일·전화번호 일부를 입력하면 즉시 목록이 걸러집니다.",
          "표의 제목(이름, 가입일 등)을 클릭하면 오름차순/내림차순으로 정렬됩니다.",
          "목록 아래 페이지 번호로 다음 목록을 확인합니다.",
        ],
      },
      {
        title: "회원 상세 정보 보기 · 수정",
        summary: "한 회원의 학습 이력, 구매 내역, 접속 기록, 게시글까지 한 화면에서 확인합니다.",
        where: "회원 관리 목록에서 회원 이름 클릭",
        steps: [
          "회원 행을 클릭해 상세 화면으로 들어갑니다.",
          "이름·연락처·생년월일·성별·메모를 그 자리에서 수정하고 저장합니다.",
          "아래로 내리면 수강 강의, 주문/쿠폰, 접속 기록, 커뮤니티 글, 자료 다운로드 이력이 보입니다.",
        ],
        tips: ["개인정보 수정 이력은 시스템에 기록되므로 필요한 경우에만 수정하세요."],
      },
      {
        title: "일괄 선택 · 일괄 변경",
        summary: "여러 회원을 한 번에 골라 소속·등급·상태를 바꿉니다.",
        href: "/admin/users",
        steps: [
          "목록 왼쪽 체크박스로 대상 회원을 선택합니다. 맨 위 체크박스는 전체 선택입니다.",
          "상단에 나타나는 일괄 작업 영역에서 변경할 항목(소속/등급/상태)을 고릅니다.",
          "'적용'을 눌러 저장합니다.",
        ],
      },
      {
        title: "회원 정보 엑셀(CSV) 내려받기",
        summary: "선택한 회원 또는 전체 회원 목록을 표 파일로 저장합니다.",
        steps: [
          "필요하면 먼저 검색·필터로 대상을 좁힙니다.",
          "'엑셀 다운로드' 버튼을 누릅니다.",
          "내려받은 파일은 엑셀에서 바로 열 수 있습니다(한글 깨짐 방지 처리 완료).",
        ],
      },
      {
        title: "권한(역할) 부여",
        summary: "학생 / 강사 / 중간관리자 / 관리자 권한을 지정합니다.",
        where: "회원 상세 화면 > 역할 영역",
        steps: [
          "회원 상세에서 역할을 선택하고 저장합니다.",
          "강사 권한을 주면 해당 회원은 강사 화면과 첨삭 기능을 사용할 수 있습니다.",
          "관리자 권한은 꼭 필요한 담당자에게만 부여합니다.",
        ],
        tips: ["최고관리자만 관리자 권한을 부여/회수할 수 있습니다."],
      },
      {
        title: "조직(지점·팀) 관리",
        summary: "본사 - 지점 - 팀 구조로 회원을 묶어 통계와 권한을 나눕니다.",
        href: "/admin/branches",
        where: "좌측 메뉴 > 회원 > 지점 관리",
        steps: [
          "지점을 만들고 지점 코드를 입력합니다.",
          "지점 아래에 팀을 추가합니다.",
          "회원 상세에서 소속 지점·팀을 지정하면 지점별 통계에 반영됩니다.",
        ],
      },
    ],
  },
  {
    id: "admin-course",
    title: "3. 강의 · 차시 관리",
    description: "판매하거나 배정할 강의를 만들고, 강의 안에 차시(영상·자료·평가)를 채웁니다.",
    features: [
      {
        title: "강의 만들기",
        summary: "강의 제목, 소개, 썸네일, 카테고리, 가격을 등록합니다.",
        href: "/admin/courses",
        where: "좌측 메뉴 > 강의 > 강의 관리",
        steps: [
          "'강의 등록' 버튼을 누릅니다.",
          "제목·소개·카테고리·난이도를 입력하고 썸네일 이미지를 올립니다.",
          "한국어/영어 탭이 있으면 각각 입력합니다(영어는 자동 번역 후 수정 가능).",
          "저장하면 목록에 추가됩니다.",
        ],
        tips: ["썸네일은 가로가 긴 이미지(16:10 비율)가 가장 예쁘게 보입니다."],
      },
      {
        title: "차시(수업 회차) 추가",
        summary: "1개 강의 안에 여러 차시를 넣습니다. 차시에는 영상·문서·카드형 콘텐츠·평가를 담을 수 있습니다.",
        steps: [
          "강의 상세로 들어가 '차시 추가'를 누릅니다.",
          "콘텐츠 종류(영상 / 문서 / 카드 / 평가)를 고릅니다.",
          "영상은 CDN 업로드 또는 URL(YouTube·Vimeo 등)로 연결합니다.",
          "순서를 드래그하거나 번호로 조정하고 저장합니다.",
        ],
        tips: ["영상은 80% 이상 시청하면 자동으로 '수강 완료' 처리됩니다."],
      },
      {
        title: "동영상 업로드 · 관리",
        summary: "영상 파일을 CDN에 직접 올리고, 강의 차시에 연결합니다.",
        href: "/admin/videos",
        where: "좌측 메뉴 > 강의 > 동영상 관리",
        steps: [
          "'직접 업로드'를 눌러 파일을 선택하면 업로드 진행률이 표시됩니다.",
          "업로드가 끝나면 목록에 영상이 추가됩니다.",
          "차시 편집 화면에서 해당 영상을 선택해 연결합니다.",
        ],
      },
      {
        title: "수강 신청 승인",
        summary: "학습자가 신청한 강의를 검토하고 승인/거절합니다.",
        href: "/admin/enrollments",
        where: "좌측 메뉴 > 학습 > 수강 신청 관리",
        steps: [
          "'대기' 상태 목록을 확인합니다.",
          "승인하면 학습자 화면에 강의가 바로 나타납니다.",
          "거절 시 사유를 적으면 학습자에게 안내됩니다.",
        ],
      },
    ],
  },
  {
    id: "admin-learning",
    title: "4. 학습 운영 (진도 · 출석 · 평가 · 수료)",
    description: "학습자가 잘 따라오고 있는지 확인하고, 수료 처리까지 진행합니다.",
    features: [
      {
        title: "학습 현황 확인",
        summary: "수강생별 진도율, 점수, 상태를 표로 봅니다.",
        href: "/admin/learning",
        where: "좌측 메뉴 > 학습 > 학습 관리",
        steps: [
          "강의·상태로 목록을 걸러냅니다.",
          "수강생 행을 클릭하면 그 사람의 강의별 진도·점수 상세 창이 열립니다.",
          "필요하면 CSV로 내려받아 보고서에 활용합니다.",
        ],
      },
      {
        title: "출석 관리",
        summary: "온라인 접속 기록과 오프라인 수업 출결을 함께 관리합니다.",
        href: "/admin/attendance",
        where: "좌측 메뉴 > 학습 > 출석 관리",
        steps: [
          "날짜와 강의를 선택합니다.",
          "출석/지각/결석을 지정하고 저장합니다.",
          "출석률은 수료 조건 판정에 활용됩니다.",
        ],
      },
      {
        title: "평가 · 문제은행",
        summary: "시험 문제를 만들어 두고, 평가마다 고정 출제 또는 랜덤 출제로 사용합니다.",
        href: "/admin/question-bank",
        where: "좌측 메뉴 > 학습 > 문제은행 / 평가 현황",
        steps: [
          "문제은행에서 문제를 등록합니다(난이도·수준·카테고리 지정).",
          "평가를 만들 때 '고정 출제' 또는 '문제은행 랜덤 출제'를 선택합니다.",
          "랜덤 출제는 조건별로 몇 문항을 뽑을지 규칙을 정합니다.",
          "평가 현황에서 응시 결과와 합격률을 확인합니다.",
        ],
        tips: ["정답은 서버에서만 채점하므로 학습자가 정답을 미리 볼 수 없습니다."],
      },
      {
        title: "수료 처리 · 수료증 발급",
        summary: "조건을 충족한 학습자에게 수료증을 발급합니다.",
        href: "/admin/completion",
        where: "좌측 메뉴 > 학습 > 수료 관리",
        steps: [
          "수료 조건(진도율·평가 점수·출석)을 확인합니다.",
          "대상자를 선택해 '수료 처리'를 누릅니다.",
          "수료증이 자동 생성되어 학습자 화면에서 내려받을 수 있습니다.",
        ],
      },
    ],
  },
  {
    id: "admin-comm",
    title: "5. 소통 (공지 · 알림 · 게시판 · 커뮤니티)",
    description: "학습자에게 소식을 전하고, 게시판과 커뮤니티를 관리합니다.",
    features: [
      {
        title: "공지사항 등록",
        summary: "전체 또는 특정 대상에게 공지를 올립니다.",
        href: "/admin/announcements",
        where: "좌측 메뉴 > 커뮤니티 > 공지사항 관리",
        steps: [
          "'공지 등록'을 눌러 제목과 본문을 작성합니다.",
          "노출 대상(전체 / 특정 강의 / 특정 지점)을 지정합니다.",
          "저장하면 학습자 화면 공지 목록에 나타나고, 24시간 동안 NEW 표시가 붙습니다.",
        ],
      },
      {
        title: "알림 발송",
        summary: "학습 독려, 마감 안내 등 알림을 보냅니다.",
        href: "/admin/notifications",
        where: "좌측 메뉴 > 커뮤니티 > 알림 관리",
        steps: [
          "대상과 알림 내용을 작성합니다.",
          "즉시 발송 또는 예약 발송을 선택합니다.",
          "발송 결과는 목록에서 확인합니다.",
        ],
      },
      {
        title: "일괄 메시지 발송",
        summary: "등급별·소속별로 이메일 등 메시지를 한 번에 보냅니다.",
        href: "/admin/messaging",
        where: "좌측 메뉴 > 커뮤니티 > 메시지 발송",
        steps: [
          "받는 사람 조건(등급, 소속, 수강 강의)을 지정합니다.",
          "제목과 내용을 작성하고 미리보기로 확인합니다.",
          "'발송'을 누르면 결과가 기록됩니다.",
        ],
      },
      {
        title: "게시판 · 커뮤니티 관리",
        summary: "자료실 게시글과 커뮤니티 글/댓글을 관리하고 부적절한 글을 숨깁니다.",
        href: "/admin/board",
        where: "좌측 메뉴 > 커뮤니티 > 게시판 관리 / 커뮤니티 관리",
        steps: [
          "게시판 관리에서 글을 등록하고 파일을 첨부합니다.",
          "커뮤니티 관리에서 신고된 글을 확인하고 숨김/삭제 처리합니다.",
        ],
      },
    ],
  },
  {
    id: "admin-sales",
    title: "6. 판매 · 정산",
    description: "상품 등록부터 주문, 환불, 정산까지의 흐름입니다.",
    features: [
      {
        title: "상품 등록 · 상태 관리",
        summary: "강의/도서 등을 상품으로 등록하고 판매 상태를 지정합니다.",
        href: "/admin/market",
        where: "좌측 메뉴 > 판매 > 상품 관리",
        steps: [
          "상품 이름·가격·설명을 입력하고 썸네일을 올립니다.",
          "판매 상태를 고릅니다: 오픈알림 / 사전신청 / 신청하기 / 신청마감 / 품절.",
          "저장하면 스토어 화면의 버튼 문구가 상태에 맞게 바뀝니다.",
        ],
      },
      {
        title: "주문 · 환불 처리",
        summary: "결제된 주문을 확인하고 환불 요청을 처리합니다.",
        href: "/admin/orders",
        where: "좌측 메뉴 > 판매 > 주문 관리 / 환불 관리",
        steps: [
          "주문 목록에서 결제 상태를 확인합니다.",
          "환불 요청 건은 사유를 확인하고 승인/거절합니다.",
          "환불이 승인되면 해당 강의 수강 권한이 회수됩니다.",
        ],
      },
      {
        title: "쿠폰 · 포인트",
        summary: "할인 쿠폰을 발급하고 학습 활동 포인트를 관리합니다.",
        href: "/admin/coupons",
        where: "좌측 메뉴 > 판매 > 쿠폰 관리 / 포인트 관리",
        steps: [
          "쿠폰 종류(정액/정률), 사용 기간, 대상 상품을 지정합니다.",
          "특정 회원 또는 전체에게 발급합니다.",
          "포인트 관리에서는 적립·차감 이력을 확인하고 수동 조정할 수 있습니다.",
        ],
      },
      {
        title: "매출 통계",
        summary: "기간별 매출, 상품별 판매량을 그래프로 확인합니다.",
        href: "/admin/sales-stats",
        where: "좌측 메뉴 > 인사이트·통계 > 매출·주문 통계",
        steps: ["기간을 선택합니다.", "그래프와 표를 확인합니다.", "필요하면 CSV로 내려받습니다."],
      },
    ],
  },
  {
    id: "admin-system",
    title: "7. 시스템 설정",
    description: "사이트 전체에 영향을 주는 설정입니다. 변경 전 담당자와 확인하세요.",
    features: [
      {
        title: "시스템 설정 · 사이드바 숨김",
        summary: "역할 기능 on/off, 메뉴 노출 여부를 조정합니다.",
        href: "/admin/settings",
        where: "좌측 메뉴 > 시스템 > 시스템 설정",
        steps: [
          "역할별 카테고리에서 감출 메뉴의 체크를 해제합니다.",
          "변경은 즉시 저장되어 좌측 메뉴에 반영됩니다.",
        ],
      },
      {
        title: "디자인 · 팝업 관리",
        summary: "메인 배너, 팝업 이미지, 노출 기간을 설정합니다.",
        href: "/admin/design-manager",
        where: "좌측 메뉴 > 콘텐츠 > 디자인 관리",
        steps: [
          "팝업을 추가하고 이미지를 업로드하거나 이미지 URL을 입력합니다.",
          "맞춤/가운데/늘림 등 배치 옵션을 고르고 미리보기로 확인합니다.",
          "노출 기간을 지정하고 저장합니다.",
        ],
      },
      {
        title: "배포 전 체크리스트",
        summary: "환경 설정, 데이터베이스, 주요 기능이 정상인지 한 번에 점검합니다.",
        href: "/admin/deploy-check",
        where: "좌측 메뉴 > 시스템 > 배포 전 체크리스트",
        steps: ["화면에 들어가면 자동으로 점검이 실행됩니다.", "빨간색 항목이 있으면 담당 개발자에게 알려주세요."],
      },
    ],
  },
];

const STUDENT_SECTIONS: ManualSection[] = [
  {
    id: "stu-start",
    title: "1. 시작하기",
    description: "회원가입부터 첫 강의를 여는 데까지의 과정입니다.",
    features: [
      {
        title: "로그인 · 비밀번호 재설정",
        summary: "이메일과 비밀번호로 로그인합니다.",
        steps: [
          "로그인 화면에서 이메일과 비밀번호를 입력합니다.",
          "'아이디 저장'을 켜두면 다음부터 이메일이 자동 입력됩니다.",
          "비밀번호를 잊었다면 '비밀번호 재설정'을 눌러 메일로 재설정 링크를 받습니다.",
        ],
      },
      {
        title: "내 대시보드 보기",
        summary: "학습 현황, 이어보기, 공지, 마감 임박 과제를 한눈에 확인합니다.",
        href: "/student",
        steps: [
          "로그인하면 학습자 대시보드가 열립니다.",
          "'이어서 학습하기'를 누르면 마지막으로 본 차시부터 재생됩니다.",
        ],
      },
    ],
  },
  {
    id: "stu-learn",
    title: "2. 강의 수강하기",
    description: "강의를 찾고 신청해서 끝까지 듣는 과정입니다.",
    features: [
      {
        title: "강의 찾기 · 신청",
        summary: "카테고리와 검색으로 강의를 찾아 신청합니다.",
        href: "/student/courses",
        where: "좌측 메뉴 > 강의 찾기",
        steps: [
          "카테고리나 검색어로 강의를 찾습니다.",
          "강의 카드를 눌러 소개와 커리큘럼을 확인합니다.",
          "'수강 신청'을 누릅니다. 승인이 필요한 강의는 관리자 승인 후 시작할 수 있습니다.",
          "유료 강의는 장바구니에 담아 결제합니다. 이미 결제한 강의는 '수강중'으로 표시됩니다.",
        ],
      },
      {
        title: "영상 강의 듣기",
        summary: "차시를 재생하면 진도가 자동으로 저장됩니다.",
        steps: [
          "내 강의에서 강의를 열고 차시를 선택합니다.",
          "영상을 재생하면 시청 위치가 자동 저장되어 다음에 이어서 볼 수 있습니다.",
          "80% 이상 보면 자동으로 완료 처리됩니다.",
        ],
        tips: ["재생이 안 되면 브라우저를 새로고침하거나 다른 브라우저(크롬 권장)를 사용해 보세요."],
      },
      {
        title: "과제 제출",
        summary: "글과 파일(최대 5개, 각 10MB)을 제출합니다.",
        href: "/student/assignments",
        where: "좌측 메뉴 > 과제",
        steps: [
          "과제 목록에서 제출할 과제를 고릅니다.",
          "내용을 작성하고 필요한 파일을 첨부합니다.",
          "'제출'을 누릅니다. 마감 전에는 다시 수정할 수 있습니다.",
          "채점이 끝나면 점수와 피드백이 표시됩니다.",
        ],
      },
      {
        title: "평가(시험) 응시",
        summary: "정해진 시간 안에 문제를 풀고 즉시 결과를 확인합니다.",
        steps: [
          "평가 차시를 열고 '응시 시작'을 누릅니다.",
          "문제를 모두 풀고 '제출'을 누릅니다.",
          "채점 결과와 합격 여부가 바로 표시됩니다.",
        ],
      },
      {
        title: "영어 첨삭 받기",
        summary: "작성한 글을 제출하면 강사가 직접 표시하며 교정해 줍니다.",
        href: "/student/corrections",
        where: "좌측 메뉴 > 첨삭",
        steps: [
          "첨삭 메뉴에서 글이나 이미지(손글씨 에세이)를 제출합니다.",
          "강사가 첨삭을 완료하면 알림이 옵니다.",
          "첨삭 결과 화면에서 표시된 선·글씨·코멘트를 확인합니다.",
        ],
      },
    ],
  },
  {
    id: "stu-extra",
    title: "3. 학습 도우미 기능",
    description: "혼자서도 꾸준히 학습할 수 있게 돕는 기능들입니다.",
    features: [
      {
        title: "자기주도학습",
        summary: "학습 계획을 세우고, 요약 리포트와 복습 퀴즈를 받아봅니다.",
        href: "/student/self-learning",
        where: "좌측 메뉴 > 자기주도학습",
        steps: [
          "목표와 학습 가능 시간을 입력하면 주간 학습 계획이 만들어집니다.",
          "리포트에서 내 학습 습관과 부족한 부분을 확인합니다.",
          "복습 퀴즈로 배운 내용을 점검합니다.",
        ],
      },
      {
        title: "학습 트랙",
        summary: "여러 강의를 순서대로 묶은 과정입니다. 순서대로 따라가면 됩니다.",
        href: "/student/tracks",
        steps: ["트랙을 열어 단계 목록을 확인합니다.", "앞 단계를 마치면 다음 단계가 열립니다."],
      },
      {
        title: "수료증 · 배지 · 포인트",
        summary: "학습 성과를 기록으로 남깁니다.",
        href: "/student/certificates",
        steps: [
          "수료 조건을 채우면 수료증이 자동 발급됩니다.",
          "수료증 메뉴에서 PDF로 내려받거나 인쇄합니다.",
          "학습 활동에 따라 포인트와 배지가 쌓입니다(합격 30점, 완료 10점 등).",
        ],
      },
      {
        title: "커뮤니티 · 질문",
        summary: "다른 학습자와 정보를 나누고 질문을 올립니다.",
        href: "/student/community",
        steps: [
          "글쓰기에서 서식 편집기로 글을 작성합니다.",
          "질문 게시판에 올린 질문은 강사·다른 학습자가 답변합니다.",
        ],
      },
      {
        title: "마이페이지",
        summary: "프로필 사진, 개인정보, 구독·쿠폰·포인트를 관리합니다.",
        href: "/mypage",
        steps: [
          "프로필 사진은 준비된 아바타에서 고르거나 직접 올립니다.",
          "구독/쿠폰/포인트/환불 탭에서 내 결제 관련 정보를 확인합니다.",
        ],
      },
    ],
  },
];

const TEACHER_SECTIONS: ManualSection[] = [
  {
    id: "tc-start",
    title: "1. 강사 화면 시작하기",
    description: "강사 권한을 받은 후 처음 해야 할 일입니다.",
    features: [
      {
        title: "강사 대시보드",
        summary: "담당 강의, 수강생 수, 채점 대기 건수를 한눈에 봅니다.",
        href: "/teacher",
        steps: [
          "로그인하면 강사 대시보드가 열립니다(관리자 권한도 있으면 '역할 전환'에서 Teacher 선택).",
          "'채점 대기' 숫자를 눌러 바로 처리 화면으로 이동합니다.",
        ],
      },
    ],
  },
  {
    id: "tc-course",
    title: "2. 강의 · 수강생 관리",
    description: "담당 강의를 만들고 수강생을 살핍니다.",
    features: [
      {
        title: "강의 만들기 · 차시 구성",
        summary: "내가 담당할 강의를 만들고 수업 회차를 채웁니다.",
        href: "/teacher/courses",
        where: "좌측 메뉴 > 내 강의",
        steps: [
          "'강의 만들기'에서 제목·소개·썸네일을 입력합니다.",
          "차시를 추가하고 영상·자료·평가를 연결합니다.",
          "저장 후 관리자에게 공개 요청을 합니다(설정에 따라 즉시 공개될 수 있습니다).",
        ],
      },
      {
        title: "수강생 현황 보기",
        summary: "학생별 진도율, 과제 제출 여부, 점수를 확인합니다.",
        href: "/teacher/students",
        where: "좌측 메뉴 > 수강생",
        steps: [
          "수강생 목록에서 강의별로 필터링합니다.",
          "학생 이름을 클릭하면 상세 학습 이력이 열립니다.",
          "진도가 느린 학생에게는 알림을 보낼 수 있습니다.",
        ],
      },
    ],
  },
  {
    id: "tc-grade",
    title: "3. 과제 채점과 첨삭",
    description: "강사의 핵심 업무입니다. 순서대로 따라 하세요.",
    features: [
      {
        title: "과제 채점",
        summary: "제출물을 확인하고 점수와 피드백을 남깁니다.",
        href: "/teacher/assignments",
        where: "좌측 메뉴 > 과제 관리",
        steps: [
          "제출함에서 제출자 이름과 제출 시각을 확인합니다.",
          "제출 내용과 첨부 파일을 열어봅니다.",
          "점수와 피드백을 입력하고 저장합니다.",
          "여러 명을 한 번에 처리하려면 일괄 채점 기능을 사용합니다.",
        ],
        tips: ["AI 채점 보조를 켜면 초안 피드백이 자동 작성되며, 강사가 수정 후 확정합니다."],
      },
      {
        title: "첨삭하기 (그리기 도구)",
        summary: "학생이 제출한 글/이미지 위에 직접 선을 긋고 글씨를 써서 교정합니다.",
        href: "/corrections",
        where: "좌측 메뉴 > 첨삭 관리",
        steps: [
          "첨삭 대기 목록에서 학생 제출물을 엽니다.",
          "화면에 뜨는 편집 도구에서 펜·형광펜·글자·지우개를 고릅니다. 도구 막대는 드래그해 원하는 위치로 옮길 수 있습니다.",
          "이미지 위에 자유롭게 표시하고, 필요하면 코멘트를 덧붙입니다.",
          "'저장'을 누르면 학생에게 결과가 전달됩니다.",
        ],
        tips: [
          "학생 화면에서는 읽기 전용이라 도구가 보이지 않습니다. 강사 또는 관리자 역할일 때만 편집할 수 있습니다.",
          "여러 장 제출물은 페이지를 넘겨가며 첨삭할 수 있습니다.",
        ],
      },
      {
        title: "평가 결과 확인",
        summary: "담당 강의의 시험 응시 현황과 문항별 정답률을 봅니다.",
        steps: ["평가 현황에서 강의를 선택합니다.", "응시자·평균 점수·문항별 정답률을 확인해 보충 수업에 활용합니다."],
      },
    ],
  },
  {
    id: "tc-comm",
    title: "4. 소통",
    description: "학생과 연락하는 방법입니다.",
    features: [
      {
        title: "공지 · 알림 보내기",
        summary: "담당 강의 수강생에게 안내를 보냅니다.",
        href: "/teacher/announcements",
        steps: [
          "공지 작성에서 제목과 내용을 입력합니다.",
          "대상 강의를 선택하고 등록합니다.",
          "긴급 안내는 알림 발송을 함께 사용합니다.",
        ],
      },
      {
        title: "질문 답변",
        summary: "커뮤니티 질문 게시판에 올라온 학생 질문에 답합니다.",
        steps: ["질문 목록에서 미답변 글을 확인합니다.", "답변을 작성하면 학생에게 알림이 갑니다."],
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* 화면                                                                        */
/* -------------------------------------------------------------------------- */

const matchesQuery = (f: ManualFeature, q: string) => {
  if (!q) return true;
  const hay = [f.title, f.summary, f.where ?? "", ...f.steps, ...(f.tips ?? [])].join(" ").toLowerCase();
  return hay.includes(q);
};

const FeatureBlock = ({ feature }: { feature: ManualFeature }) => (
  <AccordionItem value={feature.title} className="border-b-2 border-border/80">
    <AccordionTrigger className="text-left hover:no-underline">
      <span className="flex flex-col gap-1 min-w-0 pr-2">
        <span className="font-medium">{feature.title}</span>
        <span className="text-xs text-muted-foreground font-normal">{feature.summary}</span>
      </span>
    </AccordionTrigger>
    <AccordionContent className="space-y-4 pb-5">
      {feature.where && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden />
          위치: {feature.where}
        </p>
      )}
      <div>
        <p className="text-xs font-semibold mb-2">따라 하기</p>
        <ol className="space-y-1.5 text-sm">
          {feature.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-muted text-[11px] flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="min-w-0">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      {feature.tips && feature.tips.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" aria-hidden />
            알아두세요
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {feature.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {feature.href && (
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to={feature.href}>
            바로가기
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      )}
    </AccordionContent>
  </AccordionItem>
);

const SectionList = ({ sections, query }: { sections: ManualSection[]; query: string }) => {
  const filtered = sections
    .map((s) => ({ ...s, features: s.features.filter((f) => matchesQuery(f, query)) }))
    .filter((s) => s.features.length > 0);

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">일치하는 항목이 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      {filtered.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {section.features.map((f) => (
                <FeatureBlock key={f.title} feature={f} />
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default function AdminRoleManual() {
  const { isAdmin, isSuperAdmin } = useUserRole();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"admin" | "student" | "teacher">("admin");
  const q = useMemo(() => query.trim().toLowerCase(), [query]);

  const counts = useMemo(
    () => ({
      admin: ADMIN_SECTIONS.reduce((n, s) => n + s.features.filter((f) => matchesQuery(f, q)).length, 0),
      student: STUDENT_SECTIONS.reduce((n, s) => n + s.features.filter((f) => matchesQuery(f, q)).length, 0),
      teacher: TEACHER_SECTIONS.reduce((n, s) => n + s.features.filter((f) => matchesQuery(f, q)).length, 0),
    }),
    [q],
  );

  const activeRole = (() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("nf-active-role") : null;
    } catch {
      return null;
    }
  })();

  if (!isAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  if (activeRole && activeRole !== "admin") {
    return <Navigate to={activeRole === "teacher" ? "/teacher" : "/student"} replace />;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <header className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <BookMarked className="h-6 w-6" aria-hidden />
            역할별 기능 매뉴얼
          </h1>
          <p className="text-muted-foreground mt-1">
            관리자·학습자·강사가 사용하는 모든 기능을 화면 위치와 따라 하기 순서로 안내합니다. 처음 사용하는 담당자 교육 자료로 그대로 활용할 수 있습니다.
          </p>
        </header>

        <div className="relative max-w-xl">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기능 검색 (예: 첨삭, 쿠폰, 수료증, 출석...)"
            className="pl-9 pr-9"
            aria-label="기능 매뉴얼 검색"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="검색 초기화"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {q && (
          <p className="text-xs text-muted-foreground -mt-2">
            검색 결과 — 관리자 <strong className="text-foreground">{counts.admin}</strong>건 · 학습자{" "}
            <strong className="text-foreground">{counts.student}</strong>건 · 강사{" "}
            <strong className="text-foreground">{counts.teacher}</strong>건
          </p>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="admin">
              <Shield className="h-4 w-4 mr-2" aria-hidden />
              관리자{q ? ` (${counts.admin})` : ""}
            </TabsTrigger>
            <TabsTrigger value="student">
              <GraduationCap className="h-4 w-4 mr-2" aria-hidden />
              학습자{q ? ` (${counts.student})` : ""}
            </TabsTrigger>
            <TabsTrigger value="teacher">
              <Users className="h-4 w-4 mr-2" aria-hidden />
              강사{q ? ` (${counts.teacher})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="mt-6">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="outline">회원</Badge>
              <Badge variant="outline">강의·차시</Badge>
              <Badge variant="outline">학습 운영</Badge>
              <Badge variant="outline">판매·정산</Badge>
              <Badge variant="outline">시스템</Badge>
            </div>
            <SectionList sections={ADMIN_SECTIONS} query={q} />
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <SectionList sections={STUDENT_SECTIONS} query={q} />
          </TabsContent>

          <TabsContent value="teacher" className="mt-6">
            <SectionList sections={TEACHER_SECTIONS} query={q} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
