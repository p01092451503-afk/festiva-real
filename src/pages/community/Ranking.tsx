import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Trophy } from "lucide-react";
import RankingPanel from "@/components/community/RankingPanel";

const Ranking = () => (
  <DashboardLayout>
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Trophy className="h-7 w-7 text-primary mt-1" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">커뮤니티 랭킹</h1>
          <p className="text-sm text-muted-foreground mt-1">활동 점수 기반 일별 랭킹입니다.</p>
        </div>
      </div>
      <RankingPanel />
    </div>
  </DashboardLayout>
);

export default Ranking;