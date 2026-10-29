import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ils, PAYMENT_LABEL, transactionsQuery, useAddTransaction, useDeleteTransaction, type PaymentMethod } from "@/lib/clinic";
import { iso } from "@/lib/day-schedule";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "הכנסות והוצאות – Etti" }] }),
  component: FinancePage,
});

function FinancePage() {
  const [month, setMonth] = useState(new Date());
  const { data: txns = [] } = useQuery(transactionsQuery(iso(startOfMonth(month)), iso(endOfMonth(month))));
  const add = useAddTransaction();
  const del = useDeleteTransaction();
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(iso(new Date()));
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const incomes = txns.filter((t) => t.kind === "income");
  const sum = (list: typeof txns) => list.reduce((s, t) => s + Number(t.amount), 0);
  const income = sum(incomes);
  const cashIncome = sum(incomes.filter((t) => t.payment_method === "cash"));
  const transferIncome = sum(incomes.filter((t) => t.payment_method === "transfer"));
  const unknownIncome = income - cashIncome - transferIncome;
  const expense = txns.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);

  async function submit() {
    const n = Number(amount);
    if (!n || n <= 0) return;
    await add.mutateAsync({
      kind,
      amount: n,
      description: desc.trim().slice(0, 200),
      txn_date: date,
      payment_method: kind === "income" ? method : null,
    });
    setAmount(""); setDesc("");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">הכנסות והוצאות</h1>
          <p className="text-muted-foreground">{format(month, "LLLL yyyy", { locale: he })}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}><ChevronRight /></Button>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronLeft /></Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card label="הכנסות" value={ils(income)} tone="text-success">
          <p className="mt-2 text-sm text-muted-foreground">
            מזומן {ils(cashIncome)} · העברה {ils(transferIncome)}
            {unknownIncome > 0 && <> · לא צוין {ils(unknownIncome)}</>}
          </p>
        </Card>
        <Card label="הוצאות" value={ils(expense)} tone="text-destructive" />
        <Card label="רווח" value={ils(income - expense)} tone="text-primary" />
      </section>

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-soft">
        <Select value={kind} onValueChange={(v) => setKind(v as "income" | "expense")}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">הוצאה</SelectItem>
            <SelectItem value="income">הכנסה</SelectItem>
          </SelectContent>
        </Select>
        {kind === "income" && (
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger className="w-32" aria-label="אמצעי תשלום"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{PAYMENT_LABEL.cash}</SelectItem>
              <SelectItem value="transfer">{PAYMENT_LABEL.transfer}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Input className="w-32" type="number" min={0} placeholder="סכום" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input className="min-w-48 flex-1" placeholder="תיאור (למשל: חומרים, שכירות)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Input className="w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="hero" onClick={submit} disabled={add.isPending}>הוספה</Button>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary">
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">תיאור</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">אמצעי תשלום</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {txns.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">אין רישומים בחודש זה</TableCell></TableRow>}
            {txns.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{new Date(t.txn_date).toLocaleDateString("he-IL")}</TableCell>
                <TableCell>{t.description}</TableCell>
                <TableCell>{t.kind === "income" ? (t.appointment_id ? "תשלום טיפול" : "הכנסה") : "הוצאה"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.payment_method ? PAYMENT_LABEL[t.payment_method as PaymentMethod] : t.kind === "income" ? "לא צוין" : ""}
                </TableCell>
                <TableCell className={t.kind === "income" ? "text-success" : "text-destructive"}>
                  {t.kind === "income" ? "+" : "−"}{ils(Number(t.amount))}
                </TableCell>
                <TableCell className="text-left">
                  {!t.appointment_id && (
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)} aria-label="מחיקה"><Trash2 /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Card({ label, value, tone, children }: { label: string; value: string; tone: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-3xl ${tone}`}>{value}</p>
      {children}
    </div>
  );
}
