import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CategorySelectProps {
  value: string;
  onValueChange: (v: string) => void;
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const CategorySelect = ({ value, onValueChange }: CategorySelectProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug, is_active")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, slug: slugify(name) || `cat-${Date.now()}` })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onValueChange(data.id);
      setDialogOpen(false);
      setNewName("");
      toast({ title: "카테고리가 추가되었습니다." });
    },
    onError: (e: any) => {
      toast({ title: "카테고리 추가 실패", description: e.message, variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("categories")
        .update({ name, slug: slugify(name) || `cat-${Date.now()}` })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      setEditingName("");
      toast({ title: "카테고리가 수정되었습니다." });
    },
    onError: (e: any) => {
      toast({ title: "수정 실패", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // soft delete - mark inactive to avoid breaking courses
      const { error } = await supabase.from("categories").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "카테고리가 삭제되었습니다." });
    },
    onError: (e: any) => {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const saveEdit = () => {
    const trimmed = editingName.trim();
    if (!trimmed || !editingId) return;
    renameMutation.mutate({ id: editingId, name: trimmed });
  };

  // Open dialogs after Select fully closes to avoid Radix focus-stealing on dialog inputs.
  const openWithDelay = (fn: () => void) => {
    setTimeout(fn, 60);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Select
            value={value}
            onValueChange={(v) => {
              if (v === "__add_new") {
                openWithDelay(() => setDialogOpen(true));
                return;
              }
              if (v === "__manage") {
                openWithDelay(() => setManageOpen(true));
                return;
              }
              onValueChange(v);
            }}
          >
            <SelectTrigger className="h-11 rounded-xl border-border">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[9999] max-h-60 overflow-y-auto">
              {categories.length === 0 ? (
                <SelectItem value="__empty" disabled>카테고리 없음</SelectItem>
              ) : (
                categories.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))
              )}
              <div className="border-t border-border mt-1 pt-1">
                <SelectItem value="__add_new" className="text-primary font-medium">
                  <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> 새 카테고리 추가</span>
                </SelectItem>
                <SelectItem value="__manage" className="text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> 카테고리 관리</span>
                </SelectItem>
              </div>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 px-3 rounded-xl shrink-0"
          onClick={() => setManageOpen(true)}
          aria-label="카테고리 관리"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-sm"
          onOpenAutoFocus={(e) => {
            // ensure the input keeps focus across IME composition
            e.preventDefault();
            const el = document.getElementById("new-category-input");
            (el as HTMLInputElement | null)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>새 카테고리 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              id="new-category-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="카테고리 이름"
              className="h-11 rounded-xl"
              onKeyDown={(e) => {
                // ignore IME composition Enter
                if ((e as any).nativeEvent?.isComposing) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? "추가 중..." : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={manageOpen} onOpenChange={(o) => { setManageOpen(o); if (!o) { setEditingId(null); setEditingName(""); } }}>
        <DialogContent
          className="sm:max-w-md"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>카테고리 관리</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">등록된 카테고리가 없습니다.</p>
            )}
            {categories.map((cat: any) => {
              const isEditing = editingId === cat.id;
              return (
                <div key={cat.id} className="flex items-center gap-2 py-1">
                  {isEditing ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="h-9 rounded-lg flex-1"
                        onKeyDown={(e) => {
                          if ((e as any).nativeEvent?.isComposing) return;
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                        }}
                      />
                      <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={saveEdit} disabled={renameMutation.isPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => { setEditingId(null); setEditingName(""); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-foreground truncate">{cat.name}</span>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(cat.id, cat.name)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`"${cat.name}" 카테고리를 삭제할까요?`)) deleteMutation.mutate(cat.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setManageOpen(false); openWithDelay(() => setDialogOpen(true)); }}>
              <Plus className="h-4 w-4 mr-1" /> 새 카테고리
            </Button>
            <Button onClick={() => setManageOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategorySelect;
