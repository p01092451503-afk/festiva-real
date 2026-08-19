import { Link } from "react-router-dom";
import { FileCheck2, Check, Award, Truck, Mail, ListChecks, GraduationCap, CalendarClock } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COMPLETION_CONDITIONS, ISSUE_METHODS, STEPS, ISSUE_NOTES } from "@/pages/public/About";

export default function StudentCertGuide() {
  return (
    <DashboardLayout role="student">
      <div className="space-y-8 min-w-0">
        <header className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">발급 절차 안내</h1>
          <p className="text-sm text-muted-foreground">
            수료 조건 충족 후 신청 가능합니다. PDF + 실물 자격증이 함께 발급됩니다.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">수료 조건 안내</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COMPLETION_CONDITIONS.map((c) => (
              <Card key={c.label} className="border-border/70 text-center">
                <CardContent className="p-5 space-y-2">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-blue-light text-navy mx-auto">
                    <c.icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-lg font-bold text-navy">{c.value}</p>
                  <Badge variant="secondary" className="whitespace-nowrap text-xs">{c.note}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">발급 방법 — PDF + 실물 동시 발급</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ISSUE_METHODS.map((m) => (
              <Card key={m.title} className="border-border/70">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-blue-light text-navy shrink-0">
                        <m.icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <p className="text-base font-bold text-navy min-w-0">{m.title}</p>
                    </div>
                    <Badge variant="secondary" className="whitespace-nowrap text-xs">{m.fee}</Badge>
                  </div>
                  <ul className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
                    {m.lines.map((l) => (
                      <li key={l} className="flex gap-2">
                        <Check className="w-4 h-4 mt-0.5 text-brand-blue shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{l}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">수강부터 발급까지</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STEPS.map((s) => (
              <li key={s.step}>
                <Card className="h-full border-border/70 shadow-sm">
                  <CardContent className="p-5 space-y-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-navy text-xs font-bold text-white shadow-sm">{s.step}</span>
                    <h4 className="text-base font-bold text-navy">{s.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <Card className="border-border/70 bg-muted/30">
          <CardContent className="p-5 flex flex-col sm:flex-row gap-4">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-navy/5 text-navy shrink-0">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="space-y-2 min-w-0">
              <h3 className="text-base font-bold">발급 전 확인 사항</h3>
              <ul className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
                {ISSUE_NOTES.map((n) => (
                  <li key={n} className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-brand-blue shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-brand-blue-light border-navy/10">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-bold text-navy">이미 수료하셨나요?</p>
              <p className="text-sm text-muted-foreground mt-1">발급 신청·내역에서 자격증을 신청하고 다운로드할 수 있습니다.</p>
            </div>
            <Button asChild size="default" className="whitespace-nowrap text-sm">
              <Link to="/student/certificates">발급 신청하기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
