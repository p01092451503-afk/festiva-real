import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Home block: instructor introductions. */
const HomeInstructorsSection = ({ title, subtitle }: { title?: string | null; subtitle?: string | null }) => {
  const { data: instructors = [] } = useQuery({
    queryKey: ["home-instructors"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instructor_profiles")
        .select("user_id, photo_url, headline, bio, expertise")
        .limit(8);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return rows.map((r: any) => ({ ...r, full_name: nameMap.get(r.user_id) || "강사" }));
    },
  });

  if (instructors.length === 0) return null;

  return (
    <section className="bg-accent/30">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title || "강사 소개"}</h2>
          <p className="text-sm text-muted-foreground mt-1">{subtitle || "분야별 전문 강사진"}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {instructors.map((i: any) => (
            <div key={i.user_id} className="border border-border rounded-lg p-5 bg-background min-w-0">
              <div className="w-14 h-14 rounded-full bg-muted overflow-hidden flex items-center justify-center mb-3">
                {i.photo_url ? (
                  <img src={i.photo_url} alt={`${i.full_name} 강사 사진`} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <UserRound className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <p className="font-medium truncate">{i.full_name}</p>
              {i.headline && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{i.headline}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomeInstructorsSection;
