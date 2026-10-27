import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clientsQuery, ils, useDeleteClient, useSaveClient, type Client } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "לקוחות – Etti" }] }),
  component: ClientsPage,
});

const clientSchema = z.object({
  full_name: z.string().trim().min(1, "יש להזין שם").max(100),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email("אימייל לא תקין").max(255).or(z.literal("")).optional(),
  notes: z.string().max(1000).optional(),
  debt: z.coerce.number().min(0, "חוב לא יכול להיות שלילי"),
});

type Draft = Partial<Client>;

function ClientsPage() {
  const { data: clients = [] } = useQuery(clientsQuery);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const del = useDeleteClient();
  const filtered = clients.filter((c) => c.full_name.includes(q) || c.phone?.includes(q));
  const totalDebt = clients.reduce((s, c) => s + Number(c.debt), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">לקוחות</h1>
          <p className="text-muted-foreground">{clients.length} לקוחות · חובות פתוחים {ils(totalDebt)}</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-64 pr-9" placeholder="חיפוש לפי שם או טלפון" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="hero" onClick={() => setEditing({ debt: 0 })}><Plus /> לקוחה חדשה</Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-right">שם</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">אימייל</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right">חוב</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">אין לקוחות עדיין</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.full_name}</TableCell>
                <TableCell dir="ltr" className="text-right">{c.phone}</TableCell>
                <TableCell dir="ltr" className="text-right">{c.email}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{c.notes}</TableCell>
                <TableCell className={Number(c.debt) > 0 ? "font-semibold text-destructive" : ""}>{ils(Number(c.debt))}</TableCell>
                <TableCell className="whitespace-nowrap text-left">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)} aria-label="עריכה"><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label="מחיקה"
                    onClick={() => confirm(`למחוק את ${c.full_name}?`) && del.mutate(c.id)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && <ClientForm draft={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ClientForm({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [form, setForm] = useState<Draft>(draft);
  const save = useSaveClient();
  const set = (k: keyof Client) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    const parsed = clientSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    await save.mutateAsync({ ...parsed.data, id: draft.id });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle className="font-display text-2xl">{draft.id ? "עריכת לקוחה" : "לקוחה חדשה"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>שם מלא</Label><Input value={form.full_name ?? ""} onChange={set("full_name")} /></div>
          <div className="space-y-1.5"><Label>טלפון</Label><Input dir="ltr" value={form.phone ?? ""} onChange={set("phone")} /></div>
          <div className="space-y-1.5"><Label>אימייל</Label><Input dir="ltr" value={form.email ?? ""} onChange={set("email")} /></div>
          <div className="space-y-1.5"><Label>חוב פתוח (₪)</Label><Input type="number" min={0} value={form.debt ?? 0} onChange={set("debt")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>הערות</Label><Textarea value={form.notes ?? ""} onChange={set("notes")} /></div>
        </div>
        <DialogFooter><Button variant="hero" onClick={submit} disabled={save.isPending}>שמירה</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
