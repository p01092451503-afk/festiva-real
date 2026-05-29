import { BookOpen, GraduationCap, Shield, ChevronRight, PlayCircle, ClipboardCheck, Trophy, Users, BookMarked, BarChart3, Bell, Settings, Layers, ExternalLink, ArrowRight, Search, X, History, Calendar } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { MANUAL_VERSIONS, CURRENT_MANUAL_VERSION } from "./manualVersions";

/**
 * 사용자 매뉴얼 페이지
 * - 학생(학습자) 수업 흐름 가이드
 * - 관리자 운영 흐름 가이드
 * - 고객사 안내용 자료로 활용
 */
export default function AdminManual() {
  const { isAdmin, isSuperAdmin } = useUserRole();
  const [query, setQuery] = useState("");
  const studentAccordionRef = useRef<HTMLDivElement>(null);
  const adminAccordionRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"student" | "admin">("student");
  const [matches, setMatches] = useState<{ student: number; admin: number }>({ student: 0, admin: 0 });

  const normalized = useMemo(() => query.trim().toLowerCase(), [query]);

  // 검색어 변경 시 각 Accordion 내 AccordionItem 의 textContent 를 검사하여
  // 미일치 항목을 hidden 처리하고, 일치 항목 본문에는 <mark> 하이라이트를 적용한다.
  useEffect(() => {
    // 이전 하이라이트 제거 (mark.nf-mark → 텍스트로 환원)
    const clearHighlights = (root: HTMLElement | null) => {
      if (!root) return;
      const marks = root.querySelectorAll<HTMLElement>("mark.nf-mark");
      marks.forEach((m) => {
        const parent = m.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(m.textContent || ""), m);
        parent.normalize();
      });
    };
    // 본문 텍스트 노드 안에서 query 와 일치하는 부분을 mark.nf-mark 로 감싼다.
    const highlight = (root: HTMLElement, q: string) => {
      if (!q) return;
      const lower = q.toLowerCase();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          // mark, script, style, deep-link 버튼 안은 제외
          if (["MARK", "SCRIPT", "STYLE", "BUTTON"].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
          return node.nodeValue.toLowerCase().includes(lower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      const targets: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) targets.push(n as Text);
      targets.forEach((textNode) => {
        const value = textNode.nodeValue || "";
        const lowerValue = value.toLowerCase();
        const frag = document.createDocumentFragment();
        let i = 0;
        while (i < value.length) {
          const idx = lowerValue.indexOf(lower, i);
          if (idx === -1) {
            frag.appendChild(document.createTextNode(value.slice(i)));
            break;
          }
          if (idx > i) frag.appendChild(document.createTextNode(value.slice(i, idx)));
          const mark = document.createElement("mark");
          mark.className = "nf-mark";
          mark.textContent = value.slice(idx, idx + lower.length);
          frag.appendChild(mark);
          i = idx + lower.length;
        }
        textNode.parentNode?.replaceChild(frag, textNode);
      });
    };

    const filterContainer = (root: HTMLDivElement | null): number => {
      if (!root) return 0;
      // 항상 이전 하이라이트는 먼저 제거
      clearHighlights(root);
      const items = root.querySelectorAll<HTMLElement>("[data-manual-item]");
      if (!normalized) {
        items.forEach((el) => { el.hidden = false; });
        return items.length;
      }
      let visible = 0;
      items.forEach((el) => {
        const text = (el.textContent || "").toLowerCase();
        const ok = text.includes(normalized);
        el.hidden = !ok;
        if (ok) {
          visible++;
          highlight(el, normalized);
        }
      });
      return visible;
    };
    const s = filterContainer(studentAccordionRef.current);
    const a = filterContainer(adminAccordionRef.current);
    setMatches({ student: s, admin: a });
    // 검색 결과가 한쪽 탭에만 있을 경우 자동 전환
    if (normalized) {
      if (s === 0 && a > 0 && tab !== "admin") setTab("admin");
      else if (a === 0 && s > 0 && tab !== "student") setTab("student");
    }
  }, [normalized, tab]);

  const activeRole = (() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem("nf-active-role") : null;
    } catch {
      return null;
    }
  })();

  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  if (activeRole && activeRole !== "admin") {
    const target = activeRole === "teacher" ? "/teacher" : "/student";
    return <Navigate to={target} replace />;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="h-6 w-6" aria-hidden />
              사용자 매뉴얼
            </h1>
            <p className="text-muted-foreground mt-1">
              플랫폼의 핵심 기능을 학습자 흐름과 관리자 운영 흐름 중심으로 안내합니다. 고객사 담당자 교육 자료로 활용할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
              <span className="font-semibold">v{CURRENT_MANUAL_VERSION.version}</span>
            </Badge>
            <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
              <Calendar className="h-3 w-3" aria-hidden />
              {CURRENT_MANUAL_VERSION.date}
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap">
                  <History className="h-3.5 w-3.5" aria-hidden />
                  변경 이력
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" aria-hidden />
                    매뉴얼 변경 이력
                  </DialogTitle>
                  <DialogDescription>
                    추가/수정된 기능을 매뉴얼에 반영한 이력입니다. 신규 기능 반영이 필요하면 운영 담당자에게 요청해주세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {MANUAL_VERSIONS.map((v, idx) => (
                    <div
                      key={v.version}
                      className={idx === MANUAL_VERSIONS.length - 1 ? "" : "border-b-2 border-border/80 pb-4"}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={idx === 0 ? "default" : "outline"} className="font-semibold">
                          v{v.version}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden />
                          {v.date}
                        </span>
                        {idx === 0 && (
                          <Badge variant="secondary" className="text-[10px]">현재 버전</Badge>
                        )}
                      </div>
                      <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                        {v.changes.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* 검색 입력 */}
        <div className="relative max-w-xl">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="키워드 검색 (예: 인증서, 트랙, 평가, 출석...)"
            className="pl-9 pr-9"
            aria-label="매뉴얼 검색"
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
        {normalized && (
          <p className="text-xs text-muted-foreground -mt-2">
            검색 결과: 학습자 흐름 <strong className="text-foreground">{matches.student}</strong>건 · 관리자 흐름 <strong className="text-foreground">{matches.admin}</strong>건
            {matches.student + matches.admin === 0 && " — 일치하는 항목이 없습니다."}
          </p>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "student" | "admin")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-2xl">
            <TabsTrigger value="student">
              <GraduationCap className="h-4 w-4 mr-2" aria-hidden />
              학습자 수업 흐름{normalized ? ` (${matches.student})` : ""}
            </TabsTrigger>
            <TabsTrigger value="admin">
              <Shield className="h-4 w-4 mr-2" aria-hidden />
              관리자 운영 흐름{normalized ? ` (${matches.admin})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* 학생 흐름 */}
          <TabsContent value="student" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">한눈에 보는 학습 사이클</CardTitle>
              </CardHeader>
              <CardContent>
                <FlowSteps
                  steps={[
                    { label: "로그인", desc: "이메일/비밀번호 또는 ID 저장 로그인" },
                    { label: "대시보드", desc: "오늘 학습 / 진행률 / 알림 확인" },
                    { label: "강의 수강", desc: "차시별 영상·자료·플립러닝" },
                    { label: "평가 응시", desc: "퀴즈·시험 자동 채점" },
                    { label: "수료 / 인증서", desc: "기준 충족 시 자동 발급" },
                  ]}
                />
              </CardContent>
            </Card>

            <div ref={studentAccordionRef}>
            <Accordion type="single" collapsible defaultValue="s1" className="w-full">
              <AccordionItem value="s1" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Users className="h-4 w-4" /> 1. 로그인 및 대시보드</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p>관리자가 발급한 계정으로 로그인합니다. ID 저장 옵션을 사용하면 다음 접속 시 이메일이 자동 입력됩니다.</p>
                  <p>대시보드에서는 <strong>오늘의 학습</strong>, <strong>전체 진행률</strong>, <strong>마감 임박 과제</strong>, <strong>새 공지/알림</strong>을 한 화면에서 확인할 수 있습니다.</p>
                  <p className="text-muted-foreground">※ 다중 역할 보유 시 우측 상단 역할 전환 메뉴로 학생/강사 모드를 전환할 수 있습니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/student", label: "학생 대시보드" },
                      { to: "/mypage", label: "마이페이지" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="s2" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><BookMarked className="h-4 w-4" /> 2. 강의 탐색 및 수강 신청</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>강의 카탈로그</strong>에서 카테고리별 강의를 탐색합니다. 일반 공개/필수 교육/유료 강의가 구분되어 표시됩니다.</p>
                  <p>수강신청 시 관리자 승인이 필요한 강의는 <Badge variant="secondary">승인 대기</Badge> 상태로 표시되며, 승인 후 학습이 시작됩니다.</p>
                  <p>학습 트랙(Track)에 포함된 경우 트랙 단위로 일괄 수강신청이 가능합니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/dashboard/courses", label: "강의 카탈로그" },
                      { to: "/dashboard/courses?tab=tracks", label: "학습 트랙" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="s3" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4" /> 3. 차시 학습 (영상·자료)</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p>강의는 <strong>여러 차시(Lesson)</strong>로 구성되며, 영상·PDF·플립러닝(Mangoboard)·외부 링크 등 다양한 형식을 지원합니다.</p>
                  <p><strong>시청 진도는 실시간 자동 저장</strong>되며, <strong>80% 이상 시청 시 자동 완료</strong> 처리됩니다.</p>
                  <p>학습 중 메모(노트)를 작성할 수 있으며, 마이페이지의 학습 노트에서 모아볼 수 있습니다.</p>
                  <p className="text-muted-foreground">※ 동영상 보안: Kollus JWT 토큰 방식으로 무단 다운로드를 차단합니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/dashboard/courses", label: "내 강의" },
                      { to: "/student/notes", label: "학습 노트" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="s4" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> 4. 평가 및 과제 제출</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p>각 차시 또는 강의 종료 후 <strong>퀴즈/시험</strong>을 응시합니다. 객관식·주관식·서술형을 지원하며 자동 채점됩니다.</p>
                  <p>과제는 텍스트 답안과 파일 첨부(최대 5개, 각 10MB)가 가능하며, 강사/관리자가 일괄 채점합니다.</p>
                  <p>응시 중에는 정답이 클라이언트에 절대 노출되지 않으며, 채점은 서버에서만 수행됩니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/dashboard/assignments", label: "과제 목록" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="s5" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Trophy className="h-4 w-4" /> 5. 수료 및 인증서 발급</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p>관리자가 설정한 수료 기준(진도율·평가 점수·출석 등)을 충족하면 <strong>자동으로 수료 처리</strong>됩니다.</p>
                  <p>수료 시 <strong>인증서가 자동 발급</strong>되며, 마이페이지에서 PDF로 다운로드할 수 있습니다.</p>
                  <p>수료 시 포인트가 적립되어 게이미피케이션 보상에 반영됩니다(Pass 30pt / Complete 10pt).</p>
                  <DeepLinks
                    links={[
                      { to: "/dashboard/achievements", label: "성취·인증서" },
                      { to: "/mypage", label: "마이페이지" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="s6" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> 6. 알림·공지·게시판</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p>관리자/강사가 발송한 알림은 우측 상단 종 아이콘으로 확인할 수 있습니다.</p>
                  <p>공지사항은 작성 후 24시간 이내 글에 <Badge variant="destructive" className="mx-1">NEW</Badge> 배지가 표시됩니다.</p>
                  <p>게시판/자료실에서 자료 다운로드 및 댓글 소통이 가능합니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/student/announcements", label: "공지사항" },
                      { to: "/student/board", label: "게시판" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </div>
            {normalized && matches.student === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                학습자 흐름에서 일치하는 항목이 없습니다.
              </p>
            )}
          </TabsContent>

          {/* 관리자 흐름 */}
          <TabsContent value="admin" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">한눈에 보는 운영 사이클</CardTitle>
              </CardHeader>
              <CardContent>
                <FlowSteps
                  steps={[
                    { label: "조직 구성", desc: "지점·팀·회원 등록" },
                    { label: "콘텐츠 등록", desc: "강의·차시·평가 제작" },
                    { label: "수강 배정", desc: "트랙·필수교육·승인" },
                    { label: "운영·모니터링", desc: "출석·진도·통계" },
                    { label: "수료·리포트", desc: "수료 처리·인증서·CSV" },
                  ]}
                />
              </CardContent>
            </Card>

            <div ref={adminAccordionRef}>
            <Accordion type="single" collapsible defaultValue="a1" className="w-full">
              <AccordionItem value="a1" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Users className="h-4 w-4" /> 1. 회원·조직 관리</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>지점 관리</strong>에서 본사 → 지점(코드 부여) → 팀 구조로 조직을 구성합니다.</p>
                  <p><strong>학습자 관리</strong>에서 회원/학습자를 개별 등록하거나, <strong>대량 추가(엑셀)</strong> 기능으로 한 번에 수십~수백 명을 일괄 등록할 수 있습니다(중복 이메일 자동 검출).</p>
                  <p>역할은 Super Admin / Admin / Dept Admin / Teacher / Student의 5단계 RBAC로 관리됩니다.</p>
                  <p className="text-muted-foreground">메뉴: <code className="bg-muted px-1 rounded">회원·조직 → 학습자 관리 / 지점 관리</code></p>
                  <DeepLinks
                    links={[
                      { to: "/admin/users", label: "학습자 관리" },
                      { to: "/admin/branches", label: "지점 관리" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="a2" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> 2. 강의·차시 콘텐츠 제작</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>강의 관리</strong>에서 강의를 생성하고, 1강의 = N차시 구조로 콘텐츠를 추가합니다.</p>
                  <p>지원 콘텐츠: YouTube, Vimeo, Bunny.net CDN, Kollus, 플립러닝(Mangoboard), PDF, 카드형 콘텐츠, 외부 링크.</p>
                  <p>한국어/영어 탭에서 동시에 작성하며, 미입력 항목은 Gemini Flash로 <strong>자동 번역</strong>됩니다(수동 편집 시 자동 번역 중단).</p>
                  <p className="text-muted-foreground">메뉴: <code className="bg-muted px-1 rounded">콘텐츠 → 강의 관리 / 학습 트랙 관리 / 동영상 관리</code></p>
                  <DeepLinks
                    links={[
                      { to: "/admin/courses", label: "강의 관리" },
                      { to: "/admin/tracks", label: "학습 트랙 관리" },
                      { to: "/admin/videos", label: "동영상 관리" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="a3" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> 3. 학습 트랙 & 필수 교육</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>학습 트랙</strong>은 여러 강의를 묶어 커리큘럼처럼 운영하는 기능입니다. 트랙 단위로 수강 배정·진도 관리가 가능합니다.</p>
                  <p><strong>필수 교육</strong>은 마감일을 설정하면 D-day 배지가 표시되고, 마감 3일 전 자동 알림이 발송됩니다.</p>
                  <p>대상 범위는 전사·지점·팀·개인 단위로 정밀하게 지정할 수 있습니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/admin/tracks", label: "학습 트랙 관리" },
                      { to: "/admin/enrollments", label: "수강 관리" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="a4" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> 4. 수강 신청 & 평가 운영</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>수강 관리</strong>에서 학습자의 신청을 승인/반려합니다. 자동 승인 설정도 가능합니다.</p>
                  <p><strong>평가 현황</strong>에서 응시 결과를 일괄 조회·채점하고, 주관식은 AI 채점 보조를 활용할 수 있습니다.</p>
                  <p><strong>출석 관리</strong>는 user_sessions 기반으로 자동 기록되며, 수료 기준에 반영됩니다.</p>
                  <p className="text-muted-foreground">메뉴: <code className="bg-muted px-1 rounded">학습 운영 → 수강 / 학습 / 출석 / 평가 / 수료</code></p>
                  <DeepLinks
                    links={[
                      { to: "/admin/enrollments", label: "수강 관리" },
                      { to: "/admin/learning", label: "학습 현황" },
                      { to: "/admin/attendance", label: "출석 관리" },
                      { to: "/admin/assessments", label: "평가 현황" },
                      { to: "/admin/completion", label: "수료 관리" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="a5" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Bell className="h-4 w-4" /> 5. 커뮤니케이션</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>알림 관리</strong>: 특정 대상에게 푸시/인앱 알림을 발송합니다.</p>
                  <p><strong>공지사항·게시판</strong>: 다국어 작성을 지원하며, 첨부파일은 board-files 버킷에 저장됩니다.</p>
                  <p><strong>설문 관리</strong>: 강의 종료 후 설문을 자동 노출하고, 결과는 CSV로 다운로드 가능합니다.</p>
                  <DeepLinks
                    links={[
                      { to: "/admin/notifications", label: "알림 관리" },
                      { to: "/admin/announcements", label: "공지사항" },
                      { to: "/admin/board", label: "게시판" },
                      { to: "/admin/surveys", label: "설문 관리" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="a6" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> 6. 통계 & 모니터링</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>관리자 대시보드</strong>: 회원 수, 강의 수, 진행률, 오늘 운영 현황을 30초 간격으로 실시간 갱신.</p>
                  <p><strong>통계 현황(/admin/traffic)</strong>: 시간별 접속, 인기 페이지, 지점별 학습 통계, 회원가입 추이를 시각화.</p>
                  <p><strong>글로벌 대시보드</strong>: 다국가 운영 시 지역별 사용 패턴을 한눈에 확인.</p>
                  <DeepLinks
                    links={[
                      { to: "/admin", label: "관리자 대시보드" },
                      { to: "/admin/traffic", label: "통계 현황" },
                      { to: "/admin/global-dashboard", label: "글로벌 대시보드" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="a7" data-manual-item>
                <AccordionTrigger>
                  <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> 7. 사이트 & 시스템 설정</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-relaxed">
                  <p><strong>사이트 설정</strong>: 로고·배너·카테고리·B2C 스토어프론트·강사 역할 활성화 등 외관 및 기능 토글.</p>
                  <p><strong>시스템 설정</strong>: 인증서 템플릿, 수료 기준 일괄 적용, 다국어 자동 번역 설정.</p>
                  <p><strong>다국어 관리</strong>: 번역 용어집 관리 및 일괄 재번역.</p>
                  <DeepLinks
                    links={[
                      { to: "/admin/site-settings", label: "사이트 설정" },
                      { to: "/admin/settings", label: "시스템 설정" },
                      { to: "/admin/translation-glossary", label: "번역 용어집" },
                      { to: "/admin/i18n-dashboard", label: "다국어 대시보드" },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </div>
            {normalized && matches.admin === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                관리자 흐름에서 일치하는 항목이 없습니다.
              </p>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">권장 운영 루틴</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="whitespace-nowrap">매일</Badge>
                  <p>대시보드 / 알림 확인, 수강 신청 승인, 신규 게시글·문의 응답</p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="whitespace-nowrap">매주</Badge>
                  <p>학습 진도 점검, 미이수자 알림 발송, 평가 채점 마감</p>
                </div>
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="whitespace-nowrap">매월</Badge>
                  <p>지점·팀별 통계 리포트 추출(CSV), 수료 일괄 처리, 신규 콘텐츠 등록</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          ※ 본 매뉴얼은 표준 기능 기준이며, 고객사 별 설정에 따라 일부 메뉴/항목이 다르게 표시될 수 있습니다.
        </p>
      </div>
    </DashboardLayout>
  );
}

function FlowSteps({ steps }: { steps: { label: string; desc: string }[] }) {
  return (
    <ol className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0">
      {steps.map((s, i) => (
        <li key={s.label} className="flex sm:flex-1 items-stretch min-w-0">
          <div className="flex-1 rounded-md border border-border/80 bg-muted/30 px-3 py-2 min-w-0">
            <div className="text-xs text-muted-foreground">STEP {i + 1}</div>
            <div className="text-sm font-medium truncate">{s.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="hidden sm:flex items-center px-1 text-muted-foreground">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * 매뉴얼 설명 하단에 노출되는 메뉴 바로가기 버튼 그룹.
 * - /admin/* 경로는 같은 탭에서 즉시 이동.
 * - /student/* · /dashboard/* · /mypage 경로는 새 탭에서 학생 모드로 진입할 수 있도록
 *   nf-active-role 을 임시로 student 로 설정한 뒤 새 창을 연다(현재 admin 세션은 유지).
 */
function DeepLinks({ links }: { links: { to: string; label: string }[] }) {
  const isAdminPath = (to: string) => to.startsWith("/admin");

  const handleStudentNav = (to: string) => {
    try {
      const prev = localStorage.getItem("nf-active-role");
      localStorage.setItem("nf-active-role", "student");
      window.open(to, "_blank", "noopener,noreferrer");
      // 현재 admin 페이지 유지 → 원래 값 복원
      setTimeout(() => {
        if (prev) localStorage.setItem("nf-active-role", prev);
        else localStorage.removeItem("nf-active-role");
      }, 100);
    } catch {
      window.open(to, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {links.map((l) =>
        isAdminPath(l.to) ? (
          <Button
            key={l.to}
            asChild
            size="sm"
            variant="outline"
            className="h-8 text-xs"
          >
            <Link to={l.to}>
              {l.label}
              <ArrowRight className="h-3 w-3 ml-1" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button
            key={l.to}
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => handleStudentNav(l.to)}
          >
            {l.label}
            <ExternalLink className="h-3 w-3 ml-1" aria-hidden />
          </Button>
        )
      )}
    </div>
  );
}