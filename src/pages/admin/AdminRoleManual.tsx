import { useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  BookMarked, Shield, GraduationCap, Users, Search, X, ArrowRight, Info,
  MousePointerClick, Keyboard, AlertTriangle, FormInput,
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

interface ManualField {
  /** 입력 항목 이름 */
  label: string;
  /** 무엇을 어떻게 입력하는지 */
  desc: string;
}

interface ManualTrouble {
  /** 증상 */
  problem: string;
  /** 해결 방법 */
  fix: string;
}

interface ManualFeature {
  /** 기능 이름 */
  title: string;
  /** 이 기능이 무엇인지 한 문장 설명 */
  summary: string;
  /** 화면 경로 (있으면 바로가기 버튼 노출) */
  href?: string;
  /** 좌측 메뉴 위치 안내 */
  where?: string;
  /** 화면 구성 요소 — 어떤 버튼이 어디에 있고 무엇을 하는지 */
  ui?: string[];
  /** 따라 하기 단계 (클릭 위치까지 구체적으로) */
  steps: string[];
  /** 입력 항목 설명 */
  fields?: ManualField[];
  /** 단축키 · 마우스 조작 */
  shortcuts?: string[];
  /** 알아두면 좋은 점 */
  tips?: string[];
  /** 이렇게 하면 안 됩니다 */
  cautions?: string[];
  /** 자주 겪는 문제와 해결 */
  troubleshoot?: ManualTrouble[];
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
    title: "1. 시작하기 — 로그인과 화면 조작 기본",
    description: "관리자 화면에 처음 들어왔을 때 어떤 버튼이 어디에 있고, 어떻게 눌러야 하는지 익히는 단계입니다.",
    features: [
      {
        title: "관리자로 로그인하기",
        summary: "관리자 계정으로 로그인하면 자동으로 관리자 대시보드가 열립니다.",
        href: "/admin",
        where: "좌측 메뉴 > 인사이트·통계 > 관리자 대시보드",
        ui: [
          "로그인 화면 왼쪽: 브랜드 이미지 영역 (조작 요소 없음)",
          "오른쪽 가운데: 이메일 입력칸 → 비밀번호 입력칸 → 파란 테두리의 둥근 '로그인' 버튼",
          "비밀번호 칸 아래: '아이디 저장' 체크박스와 '비밀번호 재설정' 링크",
        ],
        steps: [
          "주소창에 사이트 주소를 입력하고 Enter 를 눌러 접속합니다.",
          "이메일 칸을 클릭해 관리자 이메일을 입력하고, Tab 키를 눌러 비밀번호 칸으로 이동합니다.",
          "비밀번호를 입력한 뒤 Enter 또는 '로그인' 버튼을 클릭합니다.",
          "로그인에 성공하면 주소가 /admin 으로 바뀌며 관리자 대시보드가 열립니다.",
          "화면 구조를 확인합니다 — 왼쪽=메뉴, 가운데=내용, 오른쪽 위=알림 종·언어·프로필·역할 전환.",
        ],
        fields: [
          { label: "이메일", desc: "가입 시 등록한 주소를 전부 입력합니다(예: name@company.com)." },
          { label: "비밀번호", desc: "대소문자를 구분합니다. Caps Lock 이 켜져 있는지 확인하세요." },
          { label: "아이디 저장", desc: "체크하면 이 브라우저에 이메일만 저장됩니다(비밀번호는 저장되지 않음)." },
        ],
        shortcuts: ["Tab: 다음 입력칸으로 이동", "Enter: 로그인 실행", "Shift+Tab: 이전 입력칸으로"],
        troubleshoot: [
          { problem: "로그인 버튼을 눌러도 반응이 없음", fix: "이메일 형식(@ 포함)이 맞는지 확인하고, 브라우저 새로고침(F5) 후 다시 시도합니다." },
          { problem: "'비밀번호가 올바르지 않습니다' 표시", fix: "'비밀번호 재설정'을 눌러 메일로 온 링크에서 새 비밀번호를 지정합니다." },
        ],
      },
      {
        title: "역할 전환 (관리자 ↔ 강사 ↔ 학생)",
        summary: "실제 학습자·강사가 보는 화면을 그대로 확인할 수 있는 미리보기 조작입니다.",
        where: "화면 상단 오른쪽 '역할 전환' 버튼",
        ui: [
          "상단 바 오른쪽: '역할 전환' 글자가 붙은 버튼",
          "클릭하면 아래로 목록(Admin / Teacher / Student)이 펼쳐집니다.",
          "현재 역할에는 체크 표시가 붙습니다.",
        ],
        steps: [
          "화면 오른쪽 위 '역할 전환' 버튼을 클릭합니다.",
          "펼쳐진 목록에서 보고 싶은 역할을 클릭합니다.",
          "선택한 역할의 첫 화면(/teacher 또는 /student)으로 자동 이동합니다.",
          "관리자로 돌아오려면 같은 버튼을 눌러 'Admin'을 선택합니다.",
        ],
        cautions: [
          "학생·강사 모드로 둔 채 브라우저를 닫으면 다음 접속에도 그 역할로 열립니다. 작업이 끝나면 Admin 으로 되돌려 두세요.",
        ],
        troubleshoot: [
          { problem: "관리자 메뉴를 눌러도 학생 화면으로 튕김", fix: "역할이 Student 로 전환된 상태입니다. '역할 전환'에서 Admin 을 선택하세요." },
        ],
      },
      {
        title: "좌측 메뉴 다루기 (검색 · 접기 · 숨김)",
        summary: "메뉴는 목적별 그룹으로 묶여 있고, 검색·접기·숨김으로 정리할 수 있습니다.",
        ui: [
          "메뉴 맨 위: 로고 / 그 아래 고정된 '메뉴 검색' 입력칸(스크롤해도 사라지지 않음)",
          "그룹 이름(예: 회원, 강의) 오른쪽의 화살표 아이콘: 하위 메뉴 펼침/접힘",
          "메뉴 맨 위 접기 아이콘: 사이드바 전체를 아이콘만 남기고 접기",
        ],
        steps: [
          "찾는 화면 이름 일부를 '메뉴 검색' 칸에 입력하면 즉시 해당 메뉴만 남습니다.",
          "그룹 이름을 클릭해 하위 메뉴를 펼칩니다.",
          "메뉴를 클릭하면 페이지가 열리고, 클릭한 메뉴가 사이드바 가운데로 부드럽게 스크롤됩니다.",
          "화면을 넓게 쓰고 싶으면 접기 아이콘을 눌러 사이드바를 접습니다.",
          "쓰지 않는 메뉴는 시스템 설정 > 사이드바 숨김에서 체크를 해제해 감춥니다.",
        ],
        shortcuts: ["검색칸에서 Esc: 검색어 지우기", "모바일에서는 왼쪽 위 햄버거 아이콘 → 메뉴 열기, X 로 닫기"],
      },
      {
        title: "목록 화면 공통 조작 (검색 · 정렬 · 페이지 · 다운로드)",
        summary: "회원·주문·강의 등 모든 목록 화면은 같은 방식으로 조작합니다. 한 번만 익히면 됩니다.",
        ui: [
          "목록 위쪽: 검색 입력칸 + 상태/기간 등 필터 선택 상자 + 'CSV 다운로드' 버튼",
          "표 제목(헤더): 클릭 가능하며 정렬 화살표(▲▼)가 표시됩니다.",
          "표 왼쪽 첫 칸: 선택 체크박스(맨 위 체크박스는 현재 페이지 전체 선택)",
          "목록 아래: 페이지 번호와 '이전/다음' 버튼, 페이지당 표시 개수 선택",
        ],
        steps: [
          "검색칸에 키워드를 입력합니다(입력하는 즉시 걸러집니다. Enter 불필요).",
          "필터 상자를 눌러 상태·기간 등 조건을 추가로 지정합니다.",
          "정렬하려면 표 제목을 클릭합니다. 한 번=오름차순(▲), 다시 클릭=내림차순(▼), 한 번 더=정렬 해제.",
          "필요한 행의 체크박스를 켜고, 위쪽에 나타나는 일괄 작업 영역에서 원하는 동작을 실행합니다.",
          "결과를 파일로 받으려면 'CSV 다운로드'를 클릭합니다(화면에 적용된 검색·필터 조건 그대로 내려받습니다).",
        ],
        tips: [
          "정렬·검색 상태에서 다운로드하면 보이는 그대로 저장됩니다. 전체를 받으려면 검색어를 먼저 비우세요.",
          "CSV 는 엑셀에서 바로 열리도록 한글 깨짐 방지 처리가 되어 있습니다.",
        ],
        troubleshoot: [
          { problem: "목록이 비어 있음", fix: "검색어나 필터가 남아 있는지 확인하고 검색칸의 X 를 눌러 초기화합니다." },
        ],
      },
    ],
  },
  {
    id: "admin-members",
    title: "2. 회원 관리",
    description: "가입한 회원을 조회·수정하고, 권한과 소속을 관리하는 실제 조작 순서입니다.",
    features: [
      {
        title: "회원 목록 조회 · 검색",
        summary: "이름, 이메일, 전화번호 일부로 회원을 통합 검색합니다.",
        href: "/admin/users",
        where: "좌측 메뉴 > 회원 > 회원 관리",
        ui: [
          "상단: 통합 검색칸 / 역할·상태·소속 필터 / 'CSV 다운로드' 버튼",
          "표 열: 체크박스 · 이름 · 이메일 · 연락처 · 소속 · 역할 · 가입일 · 상태",
        ],
        steps: [
          "좌측 메뉴 '회원 관리'를 클릭해 목록을 엽니다.",
          "검색칸에 이름·이메일·전화번호 일부를 입력합니다(예: '010-1234' 대신 '1234'만 입력해도 됩니다).",
          "역할 필터에서 '학생/강사/관리자' 중 하나를 골라 범위를 좁힙니다.",
          "표의 '가입일' 제목을 클릭해 최신 가입자부터 보이도록 정렬합니다.",
          "원하는 회원 행을 클릭하면 상세 화면으로 이동합니다.",
        ],
        tips: ["같은 사람이 두 번 보이면 이메일이 다른 별도 계정입니다. 통합이 필요하면 개발 담당자에게 요청하세요."],
      },
      {
        title: "회원 상세 정보 보기 · 수정",
        summary: "한 회원의 학습 이력, 구매 내역, 접속 기록, 게시글까지 한 화면에서 확인하고 수정합니다.",
        where: "회원 관리 목록에서 회원 이름 클릭",
        ui: [
          "맨 위: 프로필 사진 · 이름 · 역할 배지 · '뒤로' 버튼",
          "기본 정보 카드: 각 항목이 입력칸으로 되어 있고 오른쪽 아래 '저장' 버튼",
          "아래쪽 카드들: 수강 강의 / 주문·쿠폰 / 접속 기록 / 커뮤니티 글 / 자료 다운로드 이력",
        ],
        steps: [
          "목록에서 회원 행을 클릭합니다.",
          "수정할 항목의 입력칸을 클릭해 내용을 고칩니다.",
          "오른쪽 아래 '저장'을 클릭합니다. 화면 가운데에 저장 완료 알림이 잠깐 뜹니다.",
          "학습 상태를 보려면 아래로 스크롤해 '수강 강의' 카드에서 진도율을 확인합니다.",
          "돌아가려면 맨 위 '뒤로' 버튼 또는 브라우저 뒤로가기를 누릅니다.",
        ],
        fields: [
          { label: "이름", desc: "실명 기준으로 입력합니다. 수료증에 그대로 인쇄됩니다." },
          { label: "연락처", desc: "숫자만 입력해도 자동으로 형식이 맞춰집니다." },
          { label: "소속(지점/팀)", desc: "선택 상자에서 고릅니다. 지점별 통계에 바로 반영됩니다." },
          { label: "메모", desc: "관리자만 보는 내부 메모입니다. 학습자에게는 보이지 않습니다." },
        ],
        cautions: ["개인정보 수정 이력은 시스템에 기록됩니다. 꼭 필요한 경우에만 수정하세요."],
        troubleshoot: [
          { problem: "회원을 클릭했는데 빈 화면", fix: "삭제된 수강 정보가 남은 경우입니다. 새로고침 후에도 같으면 '회원을 찾을 수 없습니다' 안내가 표시됩니다." },
        ],
      },
      {
        title: "일괄 선택 · 일괄 변경",
        summary: "여러 회원을 한 번에 골라 소속·등급·상태를 바꿉니다.",
        href: "/admin/users",
        ui: [
          "표 헤더 왼쪽 체크박스: 현재 페이지 전체 선택",
          "선택하면 목록 위에 '○명 선택됨' 과 함께 일괄 작업 영역이 나타납니다.",
        ],
        steps: [
          "먼저 검색·필터로 대상 범위를 좁힙니다.",
          "각 행의 체크박스를 클릭하거나, 헤더 체크박스로 현재 페이지 전체를 선택합니다.",
          "연속된 행을 선택할 때는 첫 행을 클릭한 뒤 Shift 를 누른 채 마지막 행 체크박스를 클릭합니다.",
          "위쪽 일괄 작업 영역에서 변경 항목(소속/등급/상태)을 고릅니다.",
          "'적용'을 클릭하고 확인 창에서 '확인'을 누릅니다.",
        ],
        cautions: [
          "일괄 변경은 되돌리기 기능이 없습니다. 적용 전 '○명 선택됨' 숫자를 반드시 확인하세요.",
          "페이지를 넘기면 선택이 초기화됩니다. 페이지당 표시 개수를 늘린 뒤 작업하세요.",
        ],
      },
      {
        title: "회원 정보 엑셀(CSV) 내려받기",
        summary: "선택한 회원 또는 전체 회원 목록을 표 파일로 저장합니다.",
        steps: [
          "검색·필터로 내려받을 대상을 먼저 지정합니다.",
          "목록 위 'CSV 다운로드' 버튼을 클릭합니다.",
          "브라우저 하단(또는 오른쪽 위)에 파일이 저장됩니다. 클릭하면 엑셀에서 열립니다.",
        ],
        tips: ["파일명에 다운로드 날짜가 들어가므로 여러 번 받아도 덮어써지지 않습니다."],
      },
      {
        title: "권한(역할) 부여",
        summary: "학생 / 강사 / 중간관리자 / 관리자 권한을 지정합니다.",
        where: "회원 상세 화면 > 역할 영역",
        steps: [
          "회원 상세 화면을 엽니다.",
          "'역할' 영역에서 부여할 역할을 클릭해 체크합니다(여러 역할 동시 부여 가능).",
          "'저장'을 클릭합니다.",
          "해당 회원에게 재로그인을 안내하면 즉시 반영됩니다.",
        ],
        tips: [
          "강사 권한을 주면 강사 화면과 첨삭 편집 도구를 사용할 수 있습니다.",
          "여러 역할을 가진 계정은 '역할 전환' 버튼으로 화면을 바꿉니다.",
        ],
        cautions: ["관리자 권한은 최고관리자만 부여·회수할 수 있으며, 꼭 필요한 담당자에게만 부여하세요."],
      },
      {
        title: "조직(지점·팀) 관리",
        summary: "본사 - 지점 - 팀 구조로 회원을 묶어 통계와 권한을 나눕니다.",
        href: "/admin/branches",
        where: "좌측 메뉴 > 회원 > 지점 관리",
        steps: [
          "'지점 추가' 버튼을 클릭합니다.",
          "지점명과 지점 코드(영문·숫자)를 입력하고 '저장'을 누릅니다.",
          "만들어진 지점 행의 '팀 추가'를 클릭해 하위 팀을 등록합니다(팀은 코드 없이 이름만 입력).",
          "회원 상세 화면에서 소속 지점·팀을 지정하면 지점별 통계에 집계됩니다.",
        ],
        cautions: ["소속 회원이 있는 지점을 삭제하면 해당 회원의 소속이 비게 됩니다. 먼저 회원 소속을 옮기세요."],
      },
    ],
  },
  {
    id: "admin-course",
    title: "3. 강의 · 차시 관리",
    description: "강의를 만들고, 그 안에 차시(영상·자료·평가)를 채우는 전체 조작 흐름입니다.",
    features: [
      {
        title: "강의 만들기",
        summary: "강의 제목, 소개, 썸네일, 카테고리, 가격을 등록합니다.",
        href: "/admin/courses",
        where: "좌측 메뉴 > 강의 > 강의 관리",
        ui: [
          "목록 오른쪽 위: '강의 등록' 버튼",
          "등록 화면: 한국어/영어 탭 → 기본 정보 입력칸 → 썸네일 업로드 영역 → 아래쪽 '저장' 버튼",
        ],
        steps: [
          "'강의 등록' 버튼을 클릭합니다.",
          "한국어 탭에서 제목·소개·카테고리·난이도를 입력합니다.",
          "썸네일 영역을 클릭해 이미지 파일을 고르거나, 파일을 영역 위로 끌어다 놓습니다.",
          "영어 탭을 클릭하면 자동 번역된 내용이 채워집니다. 필요한 부분만 손으로 고칩니다.",
          "'저장'을 클릭하면 목록에 추가되고, 목록에서 다시 클릭해 차시를 채웁니다.",
        ],
        fields: [
          { label: "제목", desc: "학습자 화면과 수료증에 그대로 노출됩니다." },
          { label: "카테고리", desc: "스토어 화면의 분류 탭 기준입니다." },
          { label: "썸네일", desc: "가로가 긴 16:10 비율 이미지를 권장합니다(JPG/PNG)." },
          { label: "가격", desc: "0 으로 두면 무료 강의로 처리됩니다." },
        ],
        tips: ["영어 탭을 직접 수정하면 이후 자동 번역이 그 항목을 덮어쓰지 않습니다."],
      },
      {
        title: "차시(수업 회차) 추가 · 순서 변경",
        summary: "1개 강의 안에 여러 차시를 넣습니다. 영상·문서·카드형 콘텐츠·평가를 담을 수 있습니다.",
        ui: [
          "강의 상세 화면 아래: 차시 목록과 '차시 추가' 버튼",
          "각 차시 행 왼쪽: 드래그 손잡이(⋮⋮) / 오른쪽: 수정(연필)·삭제(휴지통) 아이콘",
        ],
        steps: [
          "강의 목록에서 강의를 클릭해 상세로 들어갑니다.",
          "'차시 추가'를 클릭하고 콘텐츠 종류(영상 / 문서 / 카드 / 평가)를 고릅니다.",
          "영상이면 'CDN에서 선택' 또는 'URL 입력'(YouTube·Vimeo 주소 붙여넣기) 중 하나를 사용합니다.",
          "차시 제목과 예상 학습 시간을 입력하고 '저장'을 누릅니다.",
          "순서를 바꾸려면 왼쪽 손잡이(⋮⋮)를 마우스로 누른 채 위아래로 끌어다 놓습니다.",
        ],
        tips: [
          "영상은 80% 이상 시청하면 자동으로 '수강 완료' 처리됩니다.",
          "차시 제목 앞에 '1차시.' 같은 번호를 넣지 않아도 됩니다. 화면에서 자동으로 정리됩니다.",
        ],
        troubleshoot: [
          { problem: "영상이 재생되지 않음", fix: "URL 이 '공개' 설정인지 확인하고, 미리보기로 재생 테스트 후 저장하세요." },
        ],
      },
      {
        title: "동영상 업로드 · 관리",
        summary: "영상 파일을 CDN 에 직접 올리고, 강의 차시에 연결합니다.",
        href: "/admin/videos",
        where: "좌측 메뉴 > 강의 > 동영상 관리",
        steps: [
          "'직접 업로드' 버튼을 클릭합니다.",
          "파일 선택 창에서 영상 파일(mp4 권장)을 고릅니다.",
          "업로드 진행률 막대가 100% 가 될 때까지 창을 닫지 않고 기다립니다.",
          "완료되면 목록 맨 위에 영상이 추가되고 상태가 '처리중 → 준비완료'로 바뀝니다.",
          "차시 편집 화면에서 'CDN에서 선택'을 눌러 해당 영상을 연결합니다.",
        ],
        cautions: ["업로드 중 브라우저 탭을 닫으면 전송이 중단됩니다. 큰 파일은 유선 네트워크에서 올리세요."],
        troubleshoot: [
          { problem: "상태가 계속 '처리중'", fix: "영상 길이에 따라 변환에 몇 분 걸립니다. 5분 후 새로고침(F5)해 확인하세요." },
        ],
      },
      {
        title: "미리보기와 편집 화면 오가기",
        summary: "관리자가 스토어 미리보기로 들어가도 한 번에 편집 화면으로 되돌아올 수 있습니다.",
        steps: [
          "강의 편집 화면에서 '미리보기'를 클릭하면 학습자에게 보이는 강의 소개 화면이 열립니다.",
          "화면 맨 위에 '관리자 미리보기 화면입니다' 안내 바가 표시됩니다.",
          "안내 바의 '강의 편집 화면으로 돌아가기' 버튼을 클릭하면 원래 편집 화면으로 이동합니다.",
        ],
      },
      {
        title: "수강 신청 승인",
        summary: "학습자가 신청한 강의를 검토하고 승인/거절합니다.",
        href: "/admin/enrollments",
        where: "좌측 메뉴 > 학습 > 수강 신청 관리",
        steps: [
          "상태 필터를 '대기'로 선택합니다.",
          "신청자·강의·신청일을 확인합니다.",
          "행 오른쪽의 '승인'을 클릭하면 학습자 화면에 강의가 즉시 나타납니다.",
          "거절할 경우 '거절'을 누르고 사유를 입력한 뒤 '확인'을 클릭합니다.",
          "여러 건은 체크박스로 선택해 '일괄 승인'을 사용합니다.",
        ],
      },
    ],
  },
  {
    id: "admin-learning",
    title: "4. 학습 운영 (진도 · 출석 · 평가 · 수료)",
    description: "학습자가 잘 따라오고 있는지 확인하고 수료 처리까지 진행하는 실무 조작입니다.",
    features: [
      {
        title: "학습 현황 확인",
        summary: "수강생별 진도율, 점수, 상태를 표로 보고 상세 창까지 엽니다.",
        href: "/admin/learning",
        where: "좌측 메뉴 > 학습 > 학습 관리",
        steps: [
          "강의 선택 상자에서 확인할 강의를 고릅니다.",
          "상태 필터로 '수강중 / 수료 / 중도포기'를 걸러냅니다.",
          "'진도율' 제목을 클릭해 낮은 순으로 정렬하면 관리가 필요한 학습자가 위로 옵니다.",
          "수강생 이름을 클릭하면 강의별 진도·점수 상세 창이 열립니다.",
          "창을 닫으려면 오른쪽 위 X 또는 Esc 키를 누릅니다.",
        ],
        shortcuts: ["Esc: 상세 창 닫기"],
      },
      {
        title: "출석 관리",
        summary: "온라인 접속 기록과 오프라인 수업 출결을 함께 관리합니다.",
        href: "/admin/attendance",
        where: "좌측 메뉴 > 학습 > 출석 관리",
        steps: [
          "상단에서 날짜를 선택하고 강의를 고릅니다.",
          "명단에서 각 학습자의 출석/지각/결석 버튼을 클릭합니다.",
          "전원 출석 처리하려면 '전체 출석' 버튼을 누른 뒤 예외만 개별 변경합니다.",
          "'저장'을 클릭해 확정합니다.",
        ],
        tips: ["출석률은 수료 조건 판정에 자동 반영됩니다."],
      },
      {
        title: "평가 · 문제은행",
        summary: "문제를 등록해 두고, 평가마다 고정 출제 또는 랜덤 출제로 사용합니다.",
        href: "/admin/question-bank",
        where: "좌측 메뉴 > 학습 > 문제은행 / 평가 현황",
        steps: [
          "문제은행에서 '문제 추가'를 클릭합니다.",
          "문제 유형(객관식/주관식/OX)을 고르고 지문·보기·정답을 입력합니다.",
          "난이도(쉬움/보통/어려움), 학습자 수준(입문/중급/고급), 카테고리·태그를 지정하고 저장합니다.",
          "평가를 만들 때 출제 방식에서 '고정 출제' 또는 '문제은행 랜덤 출제'를 선택합니다.",
          "랜덤 출제면 '조건별 문항 수'(예: 보통 난이도 5문항)를 규칙으로 추가합니다.",
          "평가 현황 화면에서 응시자 수·평균 점수·합격률을 확인합니다.",
        ],
        tips: [
          "문제를 여러 개 올릴 때는 '일괄 업로드' 양식을 내려받아 엑셀로 작성한 뒤 올리면 빠릅니다.",
          "정답은 서버에서만 채점되므로 학습자가 정답을 미리 볼 수 없습니다.",
        ],
      },
      {
        title: "수료 처리 · 수료증 발급",
        summary: "조건을 충족한 학습자에게 수료증을 발급합니다.",
        href: "/admin/completion",
        where: "좌측 메뉴 > 학습 > 수료 관리",
        steps: [
          "강의를 선택하고 수료 조건(진도율·평가 점수·출석)을 확인합니다.",
          "조건 충족자만 보려면 '수료 가능' 필터를 켭니다.",
          "대상자 체크박스를 선택하고 '수료 처리'를 클릭합니다.",
          "확인 창에서 '확인'을 누르면 수료증이 자동 생성됩니다.",
          "학습자는 본인 화면의 수료증 메뉴에서 PDF 로 내려받습니다.",
        ],
        cautions: ["수료 처리 후 취소하면 발급된 수료증 번호도 무효 처리됩니다. 명단을 먼저 확인하세요."],
      },
    ],
  },
  {
    id: "admin-comm",
    title: "5. 소통 (공지 · 알림 · 게시판 · 커뮤니티)",
    description: "학습자에게 소식을 전하고 게시판·커뮤니티를 관리하는 조작 방법입니다.",
    features: [
      {
        title: "공지사항 등록",
        summary: "전체 또는 특정 대상에게 공지를 올립니다.",
        href: "/admin/announcements",
        where: "좌측 메뉴 > 커뮤니티 > 공지사항 관리",
        steps: [
          "'공지 등록' 버튼을 클릭합니다.",
          "제목을 입력하고, 본문은 서식 편집기에서 굵게·목록·링크·이미지를 사용해 작성합니다.",
          "'노출 대상'에서 전체 / 특정 강의 / 특정 지점 중 하나를 고릅니다.",
          "중요 공지는 '상단 고정' 스위치를 켭니다.",
          "'등록'을 클릭합니다. 학습자 목록에 즉시 보이며 24시간 동안 NEW 표시가 붙습니다.",
        ],
        shortcuts: ["편집기에서 Ctrl+B 굵게, Ctrl+I 기울임, Ctrl+K 링크 삽입"],
      },
      {
        title: "알림 발송",
        summary: "학습 독려, 마감 안내 등 알림을 보냅니다.",
        href: "/admin/notifications",
        where: "좌측 메뉴 > 커뮤니티 > 알림 관리",
        steps: [
          "'알림 작성'을 클릭합니다.",
          "받는 대상(전체/강의별/지점별)을 지정합니다.",
          "제목과 내용을 짧게 작성합니다(알림 종에 표시되는 문구입니다).",
          "'즉시 발송' 또는 '예약 발송'을 고르고 예약이면 날짜·시간을 지정합니다.",
          "'발송'을 클릭하고 목록에서 발송 결과를 확인합니다.",
        ],
        cautions: ["발송된 알림은 회수할 수 없습니다. 대상과 문구를 다시 확인하고 보내세요."],
      },
      {
        title: "일괄 메시지 발송",
        summary: "등급별·소속별로 이메일 등 메시지를 한 번에 보냅니다.",
        href: "/admin/messaging",
        where: "좌측 메뉴 > 커뮤니티 > 메시지 발송",
        steps: [
          "받는 사람 조건(등급, 소속, 수강 강의)을 차례로 지정합니다. 오른쪽에 예상 수신 인원이 표시됩니다.",
          "제목과 내용을 작성합니다.",
          "'미리보기'를 눌러 실제 발송 형태를 확인합니다.",
          "'발송'을 클릭하면 진행률과 성공/실패 건수가 기록됩니다.",
        ],
      },
      {
        title: "게시판 · 커뮤니티 관리",
        summary: "자료실 게시글과 커뮤니티 글/댓글을 관리하고 부적절한 글을 숨깁니다.",
        href: "/admin/board",
        where: "좌측 메뉴 > 커뮤니티 > 게시판 관리 / 커뮤니티 관리",
        steps: [
          "게시판 관리에서 '글 등록'을 눌러 제목·본문을 작성하고 파일을 첨부합니다(드래그해서 올릴 수 있습니다).",
          "커뮤니티 관리에서 '신고됨' 필터를 켜 문제 글을 확인합니다.",
          "글 오른쪽 메뉴(⋯)에서 '숨김' 또는 '삭제'를 선택합니다.",
          "숨김 처리한 글은 작성자에게만 보이고 목록에서는 사라집니다.",
        ],
      },
    ],
  },
  {
    id: "admin-sales",
    title: "6. 판매 · 정산",
    description: "상품 등록부터 주문, 환불, 정산까지의 조작 흐름입니다.",
    features: [
      {
        title: "상품 등록 · 판매 상태 관리",
        summary: "강의/도서 등을 상품으로 등록하고 5단계 판매 상태를 지정합니다.",
        href: "/admin/market",
        where: "좌측 메뉴 > 판매 > 상품 관리",
        steps: [
          "'상품 등록'을 클릭합니다.",
          "상품명·가격·설명을 입력하고 썸네일 영역을 클릭해 이미지를 올립니다.",
          "'판매 상태' 선택 상자에서 상태를 고릅니다: 오픈알림 / 사전신청 / 신청하기 / 신청마감 / 품절.",
          "'저장'을 클릭합니다. 스토어 화면의 버튼 문구가 상태에 맞게 자동으로 바뀝니다.",
        ],
        fields: [
          { label: "오픈알림", desc: "아직 판매 전. 학습자는 '오픈 알림 신청' 버튼만 누를 수 있습니다." },
          { label: "사전신청", desc: "정식 오픈 전 선접수. 결제 가능." },
          { label: "신청하기", desc: "정상 판매 중." },
          { label: "신청마감", desc: "접수 종료. 버튼이 비활성 표시됩니다." },
          { label: "품절", desc: "재고 소진. 구매 불가 표시." },
        ],
      },
      {
        title: "주문 · 환불 처리",
        summary: "결제된 주문을 확인하고 환불 요청을 처리합니다.",
        href: "/admin/orders",
        where: "좌측 메뉴 > 판매 > 주문 관리 / 환불 관리",
        steps: [
          "주문 목록에서 기간 필터를 지정하고 결제 상태를 확인합니다.",
          "주문 번호를 클릭해 상세(구매자·상품·결제수단·금액)를 봅니다.",
          "환불 관리에서 요청 건의 사유를 확인합니다.",
          "'승인' 또는 '거절'을 클릭하고 메모를 남깁니다.",
          "승인하면 결제 취소가 진행되고 해당 강의 수강 권한이 회수됩니다.",
        ],
        cautions: ["환불 승인은 되돌릴 수 없습니다. 결제 금액과 구매자를 반드시 대조하세요."],
      },
      {
        title: "쿠폰 · 포인트",
        summary: "할인 쿠폰을 발급하고 학습 활동 포인트를 관리합니다.",
        href: "/admin/coupons",
        where: "좌측 메뉴 > 판매 > 쿠폰 관리 / 포인트 관리",
        steps: [
          "'쿠폰 생성'을 클릭합니다.",
          "할인 방식(정액 원 / 정률 %)과 값, 사용 기간, 대상 상품을 지정합니다.",
          "발급 대상을 '특정 회원' 또는 '전체'로 고르고 '발급'을 클릭합니다.",
          "포인트 관리에서는 회원을 검색해 '적립' 또는 '차감'을 누르고 사유를 입력해 수동 조정합니다.",
        ],
        tips: ["포인트는 합격 30점, 완료 10점 등 학습 활동에 따라 자동 적립됩니다."],
      },
      {
        title: "매출 통계",
        summary: "기간별 매출, 상품별 판매량을 그래프로 확인합니다.",
        href: "/admin/sales-stats",
        where: "좌측 메뉴 > 인사이트·통계 > 매출·주문 통계",
        steps: [
          "상단 기간 선택기에서 시작일과 종료일을 클릭해 지정합니다.",
          "그래프 위에 마우스를 올리면 해당 날짜의 정확한 값이 말풍선으로 표시됩니다.",
          "아래 표에서 상품별 판매량을 확인하고, 필요하면 'CSV 다운로드'로 저장합니다.",
        ],
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
        summary: "역할별 기능 on/off 와 메뉴 노출 여부를 조정합니다.",
        href: "/admin/settings",
        where: "좌측 메뉴 > 시스템 > 시스템 설정",
        steps: [
          "역할 탭(관리자/강사/학생)을 고릅니다.",
          "카테고리를 펼쳐 감출 메뉴의 스위치를 끕니다.",
          "변경은 즉시 저장되며 좌측 메뉴에 바로 반영됩니다(새로고침 불필요).",
          "되돌리려면 같은 스위치를 다시 켭니다.",
        ],
        cautions: ["사용 중인 메뉴를 끄면 담당자가 화면을 찾지 못할 수 있습니다. 변경 내용을 공유하세요."],
      },
      {
        title: "디자인 · 팝업 관리",
        summary: "메인 배너, 팝업 이미지, 노출 기간을 설정합니다.",
        href: "/admin/design-manager",
        where: "좌측 메뉴 > 콘텐츠 > 디자인 관리",
        steps: [
          "'팝업 추가'를 클릭합니다.",
          "이미지를 파일로 올리거나 이미지 주소(URL)를 붙여넣습니다.",
          "배치 옵션(맞춤 / 가운데 / 늘림)을 골라 오른쪽 미리보기로 확인합니다.",
          "노출 시작일·종료일과 '오늘 하루 보지 않기' 사용 여부를 지정합니다.",
          "'저장'을 클릭합니다. 수정은 목록의 연필 아이콘, 삭제는 휴지통 아이콘입니다.",
        ],
        troubleshoot: [
          { problem: "URL 이미지가 미리보기에 안 나옴", fix: "주소가 https 로 시작하고 이미지 파일로 끝나는지 확인하세요(직접 브라우저 주소창에 붙여 넣어 열리는지 테스트)." },
        ],
      },
      {
        title: "배포 전 체크리스트",
        summary: "환경 설정, 데이터베이스, 주요 기능이 정상인지 한 번에 점검합니다.",
        href: "/admin/deploy-check",
        where: "좌측 메뉴 > 시스템 > 배포 전 체크리스트",
        steps: [
          "화면에 들어가면 자동으로 점검이 실행됩니다.",
          "항목별 초록(정상)·노랑(주의)·빨강(오류) 표시를 확인합니다.",
          "'다시 점검' 버튼으로 재실행할 수 있습니다.",
          "빨간 항목이 있으면 항목 이름과 메시지를 캡처해 개발 담당자에게 전달합니다.",
        ],
      },
    ],
  },
];

const STUDENT_SECTIONS: ManualSection[] = [
  {
    id: "stu-start",
    title: "1. 시작하기",
    description: "로그인부터 첫 강의를 여는 데까지, 클릭 순서대로 안내합니다.",
    features: [
      {
        title: "로그인 · 비밀번호 재설정",
        summary: "이메일과 비밀번호로 로그인합니다.",
        ui: ["이메일 칸 → 비밀번호 칸 → 둥근 '로그인' 버튼", "그 아래 '아이디 저장' 체크박스와 '비밀번호 재설정' 링크"],
        steps: [
          "이메일과 비밀번호를 입력하고 '로그인'을 클릭합니다(Enter 키도 동일).",
          "'아이디 저장'을 체크해 두면 다음부터 이메일이 자동 입력됩니다.",
          "비밀번호를 잊었다면 '비밀번호 재설정'을 눌러 이메일을 입력합니다.",
          "메일로 온 링크를 클릭해 새 비밀번호를 두 번 입력하고 저장합니다.",
        ],
        troubleshoot: [
          { problem: "재설정 메일이 오지 않음", fix: "스팸함을 확인하고, 5분 뒤에도 없으면 다시 요청하세요." },
        ],
      },
      {
        title: "내 대시보드 보기",
        summary: "학습 현황, 이어보기, 공지, 마감 임박 과제를 한눈에 확인합니다.",
        href: "/student",
        ui: ["위쪽: 학습 요약 카드(수강중/완료/평균 진도)", "가운데: '이어서 학습하기' 카드", "오른쪽·아래: 공지와 마감 임박 과제 목록"],
        steps: [
          "로그인하면 학습자 대시보드가 자동으로 열립니다.",
          "'이어서 학습하기'를 클릭하면 마지막으로 본 차시가 그 위치부터 재생됩니다.",
          "마감 임박 과제의 D-day 배지를 클릭하면 바로 과제 화면으로 이동합니다.",
        ],
      },
    ],
  },
  {
    id: "stu-learn",
    title: "2. 강의 수강하기",
    description: "강의를 찾고 신청해서 끝까지 듣는 과정의 구체적인 조작법입니다.",
    features: [
      {
        title: "강의 찾기 · 신청 · 결제",
        summary: "카테고리와 검색으로 강의를 찾아 신청하거나 결제합니다.",
        href: "/student/courses",
        where: "좌측 메뉴 > 강의 찾기",
        steps: [
          "카테고리 탭을 클릭하거나 검색칸에 키워드를 입력합니다.",
          "강의 카드를 클릭해 소개·커리큘럼·강사 정보를 확인합니다.",
          "무료·승인형 강의는 '수강 신청'을 클릭합니다(승인이 필요하면 '대기'로 표시됩니다).",
          "유료 강의는 '장바구니 담기' → 오른쪽 위 장바구니 아이콘 → '결제하기' 순서로 진행합니다.",
          "결제가 끝나면 카탈로그의 해당 강의 버튼이 '수강중'으로 바뀝니다.",
        ],
        tips: ["장바구니에서 이전 화면으로 돌아가려면 화면 위쪽 '계속 쇼핑하기' 또는 브라우저 뒤로가기를 사용하세요."],
      },
      {
        title: "영상 강의 듣기",
        summary: "차시를 재생하면 진도가 자동 저장됩니다.",
        ui: ["왼쪽: 차시 목록(완료된 차시에는 체크 표시)", "가운데: 영상 플레이어", "아래: 요약·질문·메모 탭"],
        steps: [
          "'내 강의'에서 강의를 클릭하고 왼쪽 목록에서 차시를 선택합니다.",
          "재생 버튼을 눌러 학습을 시작합니다.",
          "재생 중 위치가 자동 저장되어 다음 접속 시 이어서 볼 수 있습니다.",
          "80% 이상 보면 차시에 자동으로 완료 표시가 붙습니다.",
          "다음 차시로 넘어가려면 목록에서 다음 항목을 클릭합니다.",
        ],
        shortcuts: ["Space: 재생/일시정지", "← →: 5초 뒤로/앞으로", "F: 전체화면", "M: 음소거"],
        troubleshoot: [
          { problem: "영상이 재생되지 않음", fix: "새로고침(F5) 후에도 안 되면 크롬 브라우저로 다시 시도하고, 광고 차단 확장 프로그램을 끄세요." },
        ],
      },
      {
        title: "과제 제출",
        summary: "글과 파일(최대 5개, 각 10MB)을 제출합니다.",
        href: "/student/assignments",
        where: "좌측 메뉴 > 과제",
        steps: [
          "과제 목록에서 제출할 과제를 클릭합니다.",
          "내용 입력칸에 답안을 작성합니다.",
          "'파일 첨부'를 눌러 파일을 고르거나, 파일을 입력 영역 위로 끌어다 놓습니다.",
          "'제출'을 클릭합니다. 마감 전에는 다시 열어 수정 후 재제출할 수 있습니다.",
          "채점이 끝나면 목록의 상태가 '채점완료'로 바뀌고 점수·피드백이 표시됩니다.",
        ],
        cautions: ["파일 1개당 10MB, 최대 5개까지입니다. 초과하면 업로드가 거절됩니다."],
      },
      {
        title: "평가(시험) 응시",
        summary: "정해진 시간 안에 문제를 풀고 즉시 결과를 확인합니다.",
        steps: [
          "평가 차시를 열고 '응시 시작'을 클릭합니다(시작하면 제한 시간이 흐릅니다).",
          "문제마다 보기를 클릭하거나 답을 입력하고 '다음'으로 이동합니다.",
          "화면 위 문항 번호를 클릭하면 해당 문제로 바로 이동합니다.",
          "모두 풀었으면 '제출'을 클릭하고 확인 창에서 '확인'을 누릅니다.",
          "채점 결과와 합격 여부가 바로 표시됩니다.",
        ],
        cautions: ["응시 중 새로고침하거나 창을 닫으면 남은 시간은 계속 줄어듭니다."],
      },
      {
        title: "영어 첨삭 받기",
        summary: "작성한 글이나 손글씨 사진을 제출하면 강사가 직접 표시하며 교정해 줍니다.",
        href: "/student/corrections",
        where: "좌측 메뉴 > 첨삭",
        steps: [
          "첨삭 메뉴에서 '첨삭 요청'을 클릭합니다.",
          "글을 직접 쓰거나, 손글씨 에세이 사진을 업로드합니다(여러 장 가능).",
          "'제출'을 누르면 상태가 '대기'로 표시됩니다.",
          "강사가 첨삭을 마치면 알림 종에 알림이 옵니다.",
          "결과 화면에서 강사가 표시한 선·글씨·코멘트를 확대해 확인합니다.",
        ],
        tips: ["학습자 화면은 읽기 전용이라 편집 도구가 보이지 않는 것이 정상입니다."],
      },
    ],
  },
  {
    id: "stu-extra",
    title: "3. 학습 도우미 기능",
    description: "혼자서도 꾸준히 학습할 수 있게 돕는 기능들의 사용법입니다.",
    features: [
      {
        title: "자기주도학습",
        summary: "학습 계획을 세우고, 요약 리포트와 복습 퀴즈를 받아봅니다.",
        href: "/student/self-learning",
        where: "좌측 메뉴 > 자기주도학습",
        steps: [
          "'학습 계획' 탭에서 목표와 주당 학습 가능 시간을 입력합니다.",
          "'계획 만들기'를 클릭하면 요일별 학습 계획이 자동 생성됩니다.",
          "'리포트' 탭에서 내 학습 습관과 부족한 부분을 확인합니다.",
          "'복습 퀴즈' 탭에서 '퀴즈 생성'을 눌러 배운 내용을 점검합니다.",
        ],
      },
      {
        title: "학습 트랙",
        summary: "여러 강의를 순서대로 묶은 과정입니다.",
        href: "/student/tracks",
        steps: [
          "트랙 카드를 클릭해 단계 목록을 확인합니다.",
          "현재 단계의 '학습 시작'을 클릭합니다.",
          "앞 단계를 마치면 잠금 아이콘이 풀리며 다음 단계가 열립니다.",
        ],
      },
      {
        title: "수료증 · 배지 · 포인트",
        summary: "학습 성과를 기록으로 남깁니다.",
        href: "/student/certificates",
        steps: [
          "수료 조건을 채우면 수료증이 자동 발급되고 알림이 옵니다.",
          "수료증 메뉴에서 'PDF 내려받기' 또는 '인쇄'를 클릭합니다.",
          "성취 메뉴에서 배지와 포인트 적립 내역을 확인합니다(합격 30점, 완료 10점 등).",
        ],
      },
      {
        title: "커뮤니티 · 질문",
        summary: "다른 학습자와 정보를 나누고 질문을 올립니다.",
        href: "/student/community",
        steps: [
          "'글쓰기'를 클릭하고 게시판(자유/질문)을 고릅니다.",
          "서식 편집기에서 굵게·목록·이미지·링크를 사용해 작성합니다.",
          "'등록'을 클릭합니다. 질문 글은 강사·다른 학습자가 답변합니다.",
          "답변이 달리면 알림 종에 표시됩니다.",
        ],
        shortcuts: ["Ctrl+B 굵게 · Ctrl+I 기울임 · Ctrl+K 링크 · 이미지 붙여넣기(Ctrl+V) 지원"],
      },
      {
        title: "마이페이지",
        summary: "프로필 사진, 개인정보, 구독·쿠폰·포인트를 관리합니다.",
        href: "/mypage",
        steps: [
          "오른쪽 위 프로필을 클릭하고 '마이페이지'를 선택합니다.",
          "'아바타' 탭에서 준비된 이미지를 고르거나 사진을 직접 올립니다.",
          "개인정보를 수정하고 '저장'을 클릭합니다.",
          "구독/쿠폰/포인트/환불 탭에서 결제 관련 정보를 확인합니다.",
        ],
      },
    ],
  },
];

const TEACHER_SECTIONS: ManualSection[] = [
  {
    id: "tc-start",
    title: "1. 강사 화면 시작하기",
    description: "강사 권한을 받은 후 처음 해야 할 조작입니다.",
    features: [
      {
        title: "강사 대시보드",
        summary: "담당 강의, 수강생 수, 채점 대기 건수를 한눈에 봅니다.",
        href: "/teacher",
        steps: [
          "로그인하면 강사 대시보드가 열립니다.",
          "관리자 권한도 함께 있다면 오른쪽 위 '역할 전환'에서 Teacher 를 선택합니다.",
          "'채점 대기' 숫자를 클릭하면 바로 처리 화면으로 이동합니다.",
        ],
      },
    ],
  },
  {
    id: "tc-course",
    title: "2. 강의 · 수강생 관리",
    description: "담당 강의를 만들고 수강생을 살피는 방법입니다.",
    features: [
      {
        title: "강의 만들기 · 차시 구성",
        summary: "내가 담당할 강의를 만들고 수업 회차를 채웁니다.",
        href: "/teacher/courses",
        where: "좌측 메뉴 > 내 강의",
        steps: [
          "'강의 만들기'를 클릭하고 제목·소개·썸네일을 입력합니다.",
          "저장 후 강의를 다시 클릭해 '차시 추가'로 영상·자료·평가를 연결합니다.",
          "차시 순서는 왼쪽 손잡이(⋮⋮)를 드래그해 바꿉니다.",
          "완료되면 '공개 요청'을 누릅니다(설정에 따라 즉시 공개될 수 있습니다).",
        ],
      },
      {
        title: "수강생 현황 보기",
        summary: "학생별 진도율, 과제 제출 여부, 점수를 확인합니다.",
        href: "/teacher/students",
        where: "좌측 메뉴 > 수강생",
        steps: [
          "강의 선택 상자에서 담당 강의를 고릅니다.",
          "'진도율' 제목을 클릭해 낮은 순으로 정렬합니다.",
          "학생 이름을 클릭하면 상세 학습 이력이 열립니다.",
          "진도가 느린 학생을 체크하고 '알림 보내기'로 독려 메시지를 보냅니다.",
        ],
      },
    ],
  },
  {
    id: "tc-grade",
    title: "3. 과제 채점과 첨삭",
    description: "강사의 핵심 업무입니다. 도구 사용법까지 순서대로 따라 하세요.",
    features: [
      {
        title: "과제 채점",
        summary: "제출물을 확인하고 점수와 피드백을 남깁니다.",
        href: "/teacher/assignments",
        where: "좌측 메뉴 > 과제 관리",
        steps: [
          "'제출함' 탭에서 제출자 이름·제출 시각·상태를 확인합니다.",
          "행을 클릭해 제출 내용과 첨부 파일을 엽니다(첨부는 클릭하면 새 탭에서 열립니다).",
          "점수 칸에 숫자를 입력하고 피드백을 작성합니다.",
          "'저장'을 클릭하면 학생에게 알림이 갑니다.",
          "여러 명을 처리하려면 체크박스로 선택 후 '일괄 채점'을 사용합니다.",
        ],
        tips: ["AI 채점 보조를 켜면 초안 피드백이 자동 작성됩니다. 반드시 검토·수정 후 저장하세요."],
      },
      {
        title: "첨삭하기 (그리기 도구 사용법)",
        summary: "학생이 제출한 글/이미지 위에 직접 선을 긋고 글씨를 써서 교정합니다.",
        href: "/corrections",
        where: "좌측 메뉴 > 첨삭 관리",
        ui: [
          "가운데: 학생 제출물 이미지(캔버스)",
          "떠 있는 편집 도구 막대: 선택 · 펜 · 형광펜 · 글자 · 도형 · 지우개 · 색상",
          "도구 막대 왼쪽 끝의 손잡이 부분: 마우스로 누른 채 끌면 원하는 위치로 이동",
          "아래쪽: 여러 장 제출물일 때 페이지 이동 버튼, 오른쪽 위 '저장' 버튼",
        ],
        steps: [
          "첨삭 대기 목록에서 학생 제출물을 클릭해 엽니다.",
          "도구 막대에서 '펜'을 클릭한 뒤 이미지 위에서 마우스를 누른 채 끌어 선을 긋습니다.",
          "색을 바꾸려면 색상 버튼을 클릭해 원하는 색을 고릅니다.",
          "글자를 넣으려면 '글자' 도구를 고르고 이미지의 원하는 위치를 클릭한 뒤 입력합니다.",
          "잘못 그린 것은 '지우개'로 지우거나 Ctrl+Z 로 되돌립니다.",
          "도구 막대가 내용을 가리면 손잡이를 끌어 화면 위쪽·옆으로 옮깁니다.",
          "여러 장이면 아래 페이지 버튼으로 넘기며 계속 첨삭합니다.",
          "마지막으로 오른쪽 위 '저장'을 클릭하면 학생에게 결과가 전달됩니다.",
        ],
        shortcuts: ["Ctrl+Z 되돌리기 · Ctrl+Shift+Z 다시 실행", "마우스 휠: 확대/축소", "Space 를 누른 채 드래그: 화면 이동"],
        cautions: [
          "저장 전에 브라우저를 닫으면 표시한 내용이 사라집니다. 중간중간 '저장'을 눌러 두세요.",
          "학생 화면(/student)에서는 읽기 전용이라 도구가 보이지 않습니다. 강사 또는 관리자 역할로 전환해야 편집할 수 있습니다.",
        ],
        troubleshoot: [
          { problem: "편집 도구가 보이지 않음", fix: "현재 역할이 학생인지 확인하고 '역할 전환'에서 Teacher 또는 Admin 을 선택하세요." },
          { problem: "선이 그어지지 않음", fix: "캔버스를 한 번 클릭해 초점을 준 뒤 다시 그려 보세요. 그래도 안 되면 새로고침(F5) 후 재시도합니다." },
        ],
      },
      {
        title: "평가 결과 확인",
        summary: "담당 강의의 시험 응시 현황과 문항별 정답률을 봅니다.",
        steps: [
          "평가 현황에서 강의를 선택합니다.",
          "응시자 수·평균 점수·합격률을 확인합니다.",
          "문항별 정답률을 클릭해 오답이 많은 문제를 찾아 보충 수업에 활용합니다.",
        ],
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
          "'공지 작성'을 클릭해 제목과 내용을 입력합니다.",
          "대상 강의를 선택합니다.",
          "'등록'을 클릭하면 학생 공지 목록에 표시됩니다.",
          "긴급 안내는 알림 발송을 함께 사용해 알림 종에도 뜨게 합니다.",
        ],
      },
      {
        title: "질문 답변",
        summary: "커뮤니티 질문 게시판에 올라온 학생 질문에 답합니다.",
        steps: [
          "질문 목록에서 '미답변' 필터를 켭니다.",
          "질문을 클릭해 내용을 확인합니다.",
          "답변 입력칸에 작성하고 '등록'을 클릭하면 학생에게 알림이 갑니다.",
        ],
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* 화면                                                                        */
/* -------------------------------------------------------------------------- */

const matchesQuery = (f: ManualFeature, q: string) => {
  if (!q) return true;
  const hay = [
    f.title,
    f.summary,
    f.where ?? "",
    ...(f.ui ?? []),
    ...f.steps,
    ...(f.fields ?? []).flatMap((x) => [x.label, x.desc]),
    ...(f.shortcuts ?? []),
    ...(f.tips ?? []),
    ...(f.cautions ?? []),
    ...(f.troubleshoot ?? []).flatMap((x) => [x.problem, x.fix]),
  ]
    .join(" ")
    .toLowerCase();
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

      {feature.ui && feature.ui.length > 0 && (
        <div className="rounded-md border border-border/80 p-3">
          <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
            화면에서 이렇게 생겼어요
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {feature.ui.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
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

      {feature.fields && feature.fields.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <FormInput className="h-3.5 w-3.5" aria-hidden />
            입력 항목 설명
          </p>
          <dl className="text-xs space-y-1.5">
            {feature.fields.map((f, i) => (
              <div key={i} className="flex gap-2 min-w-0">
                <dt className="shrink-0 font-medium w-24 sm:w-28">{f.label}</dt>
                <dd className="text-muted-foreground min-w-0">{f.desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {feature.shortcuts && feature.shortcuts.length > 0 && (
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            단축키 · 마우스 조작
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {feature.shortcuts.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

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

      {feature.cautions && feature.cautions.length > 0 && (
        <div className="rounded-md border border-destructive/40 p-3">
          <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            주의하세요
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {feature.cautions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {feature.troubleshoot && feature.troubleshoot.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">이럴 땐 이렇게</p>
          <ul className="text-xs space-y-1.5">
            {feature.troubleshoot.map((t, i) => (
              <li key={i} className="min-w-0">
                <span className="font-medium">{t.problem}</span>
                <span className="text-muted-foreground"> → {t.fix}</span>
              </li>
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
            매뉴얼
          </h1>
          <p className="text-muted-foreground mt-1">
            기능 설명에서 그치지 않고, 어떤 버튼이 어디에 있고 어떤 순서로 클릭해야 하는지까지 안내합니다. 입력 항목 설명·단축키·주의사항·문제 해결을 함께 담아 신규 담당자 교육 자료로 그대로 사용할 수 있습니다.
          </p>
        </header>

        <div className="relative max-w-xl">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기능·조작법 검색 (예: 첨삭, 단축키, 정렬, 쿠폰...)"
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
              <Badge variant="outline">화면 구성</Badge>
              <Badge variant="outline">클릭 순서</Badge>
              <Badge variant="outline">입력 항목</Badge>
              <Badge variant="outline">단축키</Badge>
              <Badge variant="outline">문제 해결</Badge>
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
