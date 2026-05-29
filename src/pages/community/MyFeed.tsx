import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Rss } from "lucide-react";
import MyFeedPanel from "@/components/community/MyFeedPanel";

const MyFeed = () => (
  <DashboardLayout>
    <div className="space-y-6 min-w-0">
      <header>
        <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
          <Rss className="h-5 w-5" /> 내 피드
        </h1>
        <p className="text-muted-foreground mt-1">팔로우한 멤버들의 최신 게시글을 한 곳에서 확인하세요.</p>
      </header>
      <MyFeedPanel />
    </div>
  </DashboardLayout>
);

export default MyFeed;