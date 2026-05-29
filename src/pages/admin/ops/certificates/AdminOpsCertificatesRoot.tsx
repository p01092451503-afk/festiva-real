import { useState } from "react";
import { Award } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CertTemplatesTab from "./CertTemplatesTab";
import CertIssuancesTab from "./CertIssuancesTab";
import CertBulkIssueTab from "./CertBulkIssueTab";

export default function AdminOpsCertificatesRoot() {
  const [tab, setTab] = useState("issuances");
  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">수료증 / 참가확인서</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            템플릿을 등록하고 프로그램·프로젝트 참여자에게 인증서를 발급합니다.
          </p>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="issuances">발급 이력</TabsTrigger>
            <TabsTrigger value="bulk">일괄 발급</TabsTrigger>
            <TabsTrigger value="templates">템플릿 관리</TabsTrigger>
          </TabsList>
          <TabsContent value="issuances" className="mt-6"><CertIssuancesTab /></TabsContent>
          <TabsContent value="bulk" className="mt-6"><CertBulkIssueTab /></TabsContent>
          <TabsContent value="templates" className="mt-6"><CertTemplatesTab /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}