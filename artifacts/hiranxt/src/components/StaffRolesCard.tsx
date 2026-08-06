import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, getListStaffQueryKey,
} from "@workspace/api-client-react";
import type { Staff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Pencil, Trash2, Ban, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { InfoTooltip } from "@/components/InfoTooltip";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full access except managing other staff",
  accountant: "Accountant — Accounting module only, no Settings",
  salesperson: "Salesperson — Billing, Customers, Inventory, Repairs, Custom Orders",
};

interface StaffForm { name: string; email: string; mobile: string; password: string; role: string; }

export default function StaffRolesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);

  const { data: staff, isLoading } = useListStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const addForm = useForm<StaffForm>({ defaultValues: { role: "salesperson" } });
  const editForm = useForm<Partial<StaffForm>>();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });

  const onAdd = (data: StaffForm) => {
    createStaff.mutate({ data: { name: data.name, email: data.email, mobile: data.mobile || null, password: data.password, role: data.role } }, {
      onSuccess: () => { invalidate(); toast({ title: `${data.name} added — they can now log in with their own email/password` }); setAddOpen(false); addForm.reset({ role: "salesperson" }); },
      onError: (err: any) => toast({ title: err?.error ?? "Failed to add staff member", variant: "destructive" }),
    });
  };

  const openEdit = (s: Staff) => {
    setEditStaff(s);
    editForm.reset({ name: s.name, email: s.email, mobile: s.mobile ?? "", role: s.role, password: "" });
  };

  const onEditSubmit = (data: Partial<StaffForm>) => {
    if (!editStaff) return;
    const payload: Record<string, unknown> = { name: data.name, email: data.email, mobile: data.mobile || null, role: data.role };
    if (data.password) payload.password = data.password;
    updateStaff.mutate({ id: editStaff.id, data: payload }, {
      onSuccess: () => { invalidate(); toast({ title: "Staff member updated" }); setEditStaff(null); },
      onError: (err: any) => toast({ title: err?.error ?? "Failed to update staff member", variant: "destructive" }),
    });
  };

  const toggleActive = (s: Staff) => {
    updateStaff.mutate({ id: s.id, data: { isActive: !s.isActive } }, {
      onSuccess: () => { invalidate(); toast({ title: s.isActive ? "Access revoked" : "Access restored" }); },
      onError: (err: any) => toast({ title: err?.error ?? "Failed", variant: "destructive" }),
    });
  };

  const remove = (s: Staff) => {
    if (!confirm(`Remove ${s.name}? They'll no longer be able to log in.`)) return;
    deleteStaff.mutate({ id: s.id }, {
      onSuccess: () => { invalidate(); toast({ title: "Staff member removed" }); },
      onError: (err: any) => toast({ title: err?.error ?? "Failed to remove staff member", variant: "destructive" }),
    });
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />Staff &amp; Roles
          <InfoTooltip text="Give employees their own login instead of sharing yours. Each role controls what they can see: Salesperson can't touch Settings or Accounting; Accountant can't touch Settings; only Admin (or you) can manage staff." />
        </CardTitle>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}><Plus className="w-3.5 h-3.5" />Add Staff</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>New Staff Login</DialogTitle></DialogHeader>
            <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3">
              <div><Label>Name *</Label><Input {...addForm.register("name", { required: true })} placeholder="e.g. Priya Sharma" /></div>
              <div><Label>Email * (they'll log in with this)</Label><Input type="email" {...addForm.register("email", { required: true })} /></div>
              <div><Label>Mobile</Label><Input {...addForm.register("mobile")} /></div>
              <div><Label>Password * (min 8 characters)</Label><Input type="password" {...addForm.register("password", { required: true, minLength: 8 })} /></div>
              <div>
                <Label>Role</Label>
                <Select value={addForm.watch("role") ?? "salesperson"} onValueChange={v => addForm.setValue("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salesperson">Salesperson</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">{ROLE_LABELS[addForm.watch("role") ?? "salesperson"]}</p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createStaff.isPending}>{createStaff.isPending ? "Adding..." : "Add Staff Member"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (staff ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">No staff logins yet — you're the only one with access. Add one so an employee doesn't need your password.</p>
        )}
        {(staff ?? []).map(s => (
          <div key={s.id} className={`flex items-center justify-between p-3 rounded-lg border border-border ${!s.isActive ? "opacity-50" : ""}`}>
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                {s.name}
                <Badge variant="outline" className="text-[10px] capitalize">{s.role}</Badge>
                {!s.isActive && <Badge variant="secondary" className="text-[10px]">Access revoked</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">{s.email}{s.mobile ? ` · ${s.mobile}` : ""}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => openEdit(s)}><Pencil className="w-3 h-3" />Edit</Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => toggleActive(s)} disabled={user?.staffId === s.id}>
                {s.isActive ? <><Ban className="w-3 h-3" />Revoke</> : <><RotateCcw className="w-3 h-3" />Restore</>}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-600" onClick={() => remove(s)} disabled={user?.staffId === s.id}>
                <Trash2 className="w-3 h-3" />Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editStaff} onOpenChange={v => { if (!v) setEditStaff(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Staff Member</DialogTitle></DialogHeader>
          {editStaff && (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
              <div><Label>Name</Label><Input {...editForm.register("name")} /></div>
              <div><Label>Email</Label><Input type="email" {...editForm.register("email")} /></div>
              <div><Label>Mobile</Label><Input {...editForm.register("mobile")} /></div>
              <div><Label>New Password <span className="text-muted-foreground/60">(leave blank to keep current)</span></Label><Input type="password" {...editForm.register("password")} /></div>
              <div>
                <Label>Role</Label>
                <Select
                  value={editForm.watch("role") ?? editStaff.role}
                  onValueChange={v => editForm.setValue("role", v)}
                  disabled={user?.staffId === editStaff.id}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salesperson">Salesperson</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {user?.staffId === editStaff.id && <p className="text-[11px] text-muted-foreground mt-1">You can't change your own role.</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditStaff(null)}>Cancel</Button>
                <Button type="submit" disabled={updateStaff.isPending}>{updateStaff.isPending ? "Saving..." : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
