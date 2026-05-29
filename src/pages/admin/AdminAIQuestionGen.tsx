import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import AIQuestionGenerator from "@/components/admin/AIQuestionGenerator";

export default function AdminAIQuestionGen() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start gap-3">
          <Sparkles className="h-7 w-7 text-foreground mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isEn ? "AI Question Generator" : "AI 문제 생성"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "Generate exam questions automatically using AI."
                : "AI기반으로 평가 문항을 자동으로 생성합니다."}
            </p>
          </div>
        </div>

        <div className="border-2 border-border/80 rounded-md p-8 text-center space-y-4">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <p className="text-base font-medium">
              {isEn ? "Start generating questions from any article" : "기사 기반 문제 생성을 시작하세요"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "Paste text, a URL, or upload a PDF/image. The AI will create exam-ready questions based on various materials."
                : "텍스트 붙여넣기, URL 입력, PDF/이미지 업로드 — AI가 각종 자료에 기반한 시험 문항을 만들어드립니다."}
            </p>
          </div>
          <AIQuestionGenerator />
        </div>
      </div>
    </DashboardLayout>
  );
}
