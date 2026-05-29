import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  excludeId?: string | null;
}

const PackagePicker = ({ selected, onChange, excludeId }: Props) => {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["package-candidate-courses", excludeId ?? ""],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select("id, title")
        .order("created_at", { ascending: false });
      if (excludeId) q = q.neq("id", excludeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Array<{ id: string; title: string }>;
    },
  });

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">패키지 구성 강의 선택</label>
      <div className="space-y-2 max-h-64 overflow-auto border border-border rounded-xl p-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : courses.length === 0 ? (
          <p className="text-xs text-muted-foreground">선택 가능한 강의가 없습니다.</p>
        ) : (
          courses.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="truncate">{c.title}</span>
            </label>
          ))
        )}
      </div>
      <p className="text-xs text-muted-foreground">선택 {selected.length}개</p>
    </div>
  );
};

export default PackagePicker;
