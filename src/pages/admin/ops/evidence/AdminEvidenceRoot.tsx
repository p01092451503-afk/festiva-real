import { useState } from "react";
import { FolderCheck } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EvidenceCategoriesTab from "./EvidenceCategoriesTab";
import EvidenceSubmissionsTab from "./EvidenceSubmissionsTab";

export default function AdminEvidenceRoot() {
  const [tab, setTab] = useState("submissions");
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex items-start gap-3">
          <FolderCheck className="h-6 w-6 text-foreground mt-0.5" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">증빙자료 관리</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              증빙 카테고리를 정의하고, 제출된 자료를 검토·승인·반려합니다.
            </p>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="submissions">제출 자료</TabsTrigger>
            <TabsTrigger value="categories">카테고리</TabsTrigger>
          </TabsList>
          <TabsContent value="submissions" className="mt-4">
            <EvidenceSubmissionsTab />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <EvidenceCategoriesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}