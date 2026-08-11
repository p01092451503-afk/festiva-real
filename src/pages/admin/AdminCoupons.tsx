import { useMemo, useState } from "react";
import { useTableSort, sortRows } from "@/hooks/useTableSort";
import SortHeader from "@/components/table/SortHeader";
import TablePagination, { usePagination } from "@/components/table/TablePagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CouponForm { id?: string; code: string; name: string; discount_type: string; discount_value: number; min_order_amount: number; max_discount_amount: number | null; usage_limit: number | null; starts_at: string; ends_at: string; is_active: boolean; }
const emptyForm: CouponForm = { code: "", name: "", discount_type: "fixed", discount_value: 0, min_order_amount: 0, max_discount_amount: null, usage_limit: null, starts_at: "", ends_at: "", is_active: true };

const AdminCoupons = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => { const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => { const { error } = await supabase.from("coupons").update({ is_active }).eq("id", id); if (error) throw error; },
    onMutate: async ({ id, is_active }) => { queryClient.setQueryData(["admin-coupons"], (old: any[]) => (old || []).map((c) => (c.id === id ? { ...c, is_active } : c))); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }),
  });

  const saveCoupon = useMutation({
    mutationFn: async (data: CouponForm) => {
      const payload = { code: data.code.toUpperCase(), name: data.name, discount_type: data.discount_type, discount_value: data.discount_value, min_order_amount: data.min_order_amount, max_discount_amount: data.discount_type === "percentage" ? data.max_discount_amount : null, usage_limit: data.usage_limit, starts_at: data.starts_at || null, ends_at: data.ends_at || null, is_active: data.is_active };
      if (data.id) { const { error } = await supabase.from("coupons").update(payload).eq("id", data.id); if (error) throw error; }
      else { const { error } = await supabase.from("coupons").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }); setDialogOpen(false); toast({ title: "쿠폰이 저장되었습니다." }); },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("coupons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-coupons"] }); toast({ title: "쿠폰이 삭제되었습니다." }); },
  });

  const generateCode = () => setForm((f) => ({ ...f, code: crypto.randomUUID().slice(0, 8).toUpperCase() }));

  const openEdit = (c: any) => { setForm({ id: c.id, code: c.code, name: c.name, discount_type: c.discount_type, discount_value: c.discount_value, min_order_amount: c.min_order_amount, max_discount_amount: c.max_discount_amount, usage_limit: c.usage_limit, starts_at: c.starts_at || "", ends_at: c.ends_at || "", is_active: c.is_active }); setDialogOpen(true); };

  const { sort, toggleSort } = useTableSort({ defaultKey: "created", defaultDir: "desc" });
  const sortedCoupons = useMemo(
    () =>
      sortRows(coupons as any[], sort, {
        code: (c: any) => c.code,
        name: (c: any) => c.name,
        discount: (c: any) => Number(c.discount_value) || 0,
        used: (c: any) => Number(c.used_count) || 0,
        active: (c: any) => (c.is_active ? 1 : 0),
        created: (c: any) => (c.created_at ? new Date(c.created_at).getTime() : null),
      }),
    [coupons, sort],
  );
  const { page, setPage, pageSize, setPageSize, total, totalPages, pageRows } = usePagination(sortedCoupons, 20);


  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2"><Tag className="h-6 w-6" /> 쿠폰 관리</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">할인 쿠폰을 관리합니다.</p>
          </div>
          <Button className="rounded-xl gap-2 w-full sm:w-auto" onClick={() => { setForm(emptyForm); setDialogOpen(true); }}><Plus className="h-4 w-4" /> 쿠폰 생성</Button>
        </div>

        {/* Desktop Table */}
        <div className="stat-card !p-0 overflow-hidden hidden md:block">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/30">
              <SortHeader sortKey="code" label="코드" sort={sort} onToggle={toggleSort} />
              <SortHeader sortKey="name" label="이름" sort={sort} onToggle={toggleSort} />
              <SortHeader sortKey="discount" label="할인" sort={sort} onToggle={toggleSort} align="center" className="hidden md:table-cell" />
              <SortHeader sortKey="used" label="사용/제한" sort={sort} onToggle={toggleSort} align="center" className="hidden lg:table-cell" />
              <SortHeader sortKey="active" label="활성" sort={sort} onToggle={toggleSort} align="center" />
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">관리</th>
            </tr></thead>
            <tbody>
              {pageRows.map((coupon: any) => (

                <tr key={coupon.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><code className="text-sm font-mono font-semibold text-foreground bg-secondary px-2 py-0.5 rounded">{coupon.code}</code></td>
                  <td className="px-4 py-3 text-sm text-foreground">{coupon.name}</td>
                  <td className="px-4 py-3 text-center hidden md:table-cell text-sm text-foreground">{coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `${coupon.discount_value.toLocaleString()}원`}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-xs text-muted-foreground">{coupon.used_count}/{coupon.usage_limit ?? "∞"}</td>
                  <td className="px-4 py-3 text-center"><Switch checked={coupon.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: coupon.id, is_active: v })} /></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(coupon)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteCoupon.mutate(coupon.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div></td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">등록된 쿠폰이 없습니다.</td></tr>}
            </tbody>
          </table>
          <TablePagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} unit="개" />
        </div>


        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {coupons.map((coupon: any) => (
            <div key={coupon.id} className="stat-card !p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono font-semibold text-foreground bg-secondary px-2 py-0.5 rounded">{coupon.code}</code>
                    <span className="text-xs font-semibold text-foreground">
                      {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `${coupon.discount_value.toLocaleString()}원`}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1.5 truncate">{coupon.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">사용 {coupon.used_count}/{coupon.usage_limit ?? "∞"}</p>
                </div>
                <Switch checked={coupon.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: coupon.id, is_active: v })} />
              </div>
              <div className="flex items-center justify-end gap-1 mt-2 -mr-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(coupon)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteCoupon.mutate(coupon.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {coupons.length === 0 && <div className="stat-card !p-8 text-center text-sm text-muted-foreground">등록된 쿠폰이 없습니다.</div>}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{form.id ? "쿠폰 수정" : "쿠폰 생성"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>쿠폰 코드 *</Label><div className="flex gap-2"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE10" className="font-mono" /><Button type="button" variant="outline" size="sm" onClick={generateCode}>자동 생성</Button></div></div>
              <div className="space-y-2"><Label>쿠폰 이름 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="신규회원 할인" /></div>
              <div className="space-y-2"><Label>할인 타입</Label><div className="flex gap-3"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={form.discount_type === "fixed"} onChange={() => setForm({ ...form, discount_type: "fixed" })} />정액 (원)</label><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={form.discount_type === "percentage"} onChange={() => setForm({ ...form, discount_type: "percentage" })} />정률 (%)</label></div></div>
              <div className="space-y-2"><Label>{form.discount_type === "percentage" ? "할인율 (%)" : "할인 금액 (원)"}</Label><Input type="number" value={form.discount_value || ""} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} min={0} /></div>
              <div className="space-y-2"><Label>최소 주문 금액 (원)</Label><Input type="number" value={form.min_order_amount || ""} onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })} min={0} /></div>
              {form.discount_type === "percentage" && <div className="space-y-2"><Label>최대 할인 금액 (원)</Label><Input type="number" value={form.max_discount_amount ?? ""} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value ? Number(e.target.value) : null })} /></div>}
              <div className="space-y-2"><Label>사용 횟수 제한 (비우면 무제한)</Label><Input type="number" value={form.usage_limit ?? ""} onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })} min={1} /></div>
              <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><span className="text-sm text-foreground">활성화</span></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button onClick={() => saveCoupon.mutate(form)} disabled={!form.code || !form.name || saveCoupon.isPending}>{saveCoupon.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminCoupons;
