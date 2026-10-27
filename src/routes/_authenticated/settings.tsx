import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  breaksQuery, DAY_LABEL, hoursQuery, pricingQuery, TREATMENT_LABEL,
  useAddBreak, useDeleteBreak, useSaveHours, useUpsertPricing, type WorkingHours,
} from "@/lib/clinic";
import { allowedDurations, type TreatmentType } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "הגדרות – Etti" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">הגדרות</h1>
      <Tabs defaultValue="hours" dir="rtl">
        <TabsList>
          <TabsTrigger value="hours">שעות פעילות והפסקות</TabsTrigger>
          <TabsTrigger value="pricing">מחירון טיפולים</TabsTrigger>
        </TabsList>
        <TabsContent value="hours"><HoursEditor /></TabsContent>
        <TabsContent value="pricing"><PricingEditor /></TabsContent>
      </Tabs>
    </div>
  );
}

const hhmm = (t: string) => t.slice(0, 5);

function HoursEditor() {
  const { data = [] } = useQuery(hoursQuery);
  const { data: breaks = [] } = useQuery(breaksQuery);
  const [rows, setRows] = useState<WorkingHours[]>([]);
  const save = useSaveHours();
  const addBreak = useAddBreak();
  const delBreak = useDeleteBreak();
  useEffect(() => setRows(data), [data]);
  const patch = (dow: number, p: Partial<WorkingHours>) => setRows((r) => r.map((x) => (x.day_of_week === dow ? { ...x, ...p } : x)));

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-6 shadow-soft">
      {rows.map((r) => (
        <div key={r.day_of_week} className="flex flex-wrap items-center gap-4 border-b pb-3 last:border-0">
          <span className="w-16 font-medium">{DAY_LABEL[r.day_of_week]}</span>
          <Switch checked={r.is_open} onCheckedChange={(v) => patch(r.day_of_week, { is_open: v })} />
          {r.is_open ? (
            <>
              <Input type="time" step={900} className="w-32" value={hhmm(r.start_time)} onChange={(e) => patch(r.day_of_week, { start_time: e.target.value })} />
              <span>עד</span>
              <Input type="time" step={900} className="w-32" value={hhmm(r.end_time)} onChange={(e) => patch(r.day_of_week, { end_time: e.target.value })} />
              <div className="flex flex-wrap items-center gap-2">
                {breaks.filter((b) => b.day_of_week === r.day_of_week).map((b) => (
                  <span key={b.id} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                    הפסקה {hhmm(b.start_time)}–{hhmm(b.end_time)}
                    <button onClick={() => delBreak.mutate(b.id)} aria-label="הסרת הפסקה"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <BreakAdder onAdd={(s, e) => addBreak.mutate({ day_of_week: r.day_of_week, start_time: s, end_time: e })} />
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">סגור</span>
          )}
        </div>
      ))}
      <Button variant="hero" onClick={() => save.mutate(rows)} disabled={save.isPending}>שמירת שעות</Button>
    </div>
  );
}

function BreakAdder({ onAdd }: { onAdd: (start: string, end: string) => void }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState("13:00");
  const [e, setE] = useState("13:30");
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Plus /> הפסקה</Button>;
  return (
    <span className="flex items-center gap-1">
      <Input type="time" className="h-8 w-28" value={s} onChange={(x) => setS(x.target.value)} />
      <Input type="time" className="h-8 w-28" value={e} onChange={(x) => setE(x.target.value)} />
      <Button size="sm" onClick={() => { if (s < e) { onAdd(s, e); setOpen(false); } }}>הוספה</Button>
    </span>
  );
}

function PricingEditor() {
  const { data = [] } = useQuery(pricingQuery);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const save = useUpsertPricing();
  const key = (t: string, d: number) => `${t}:${d}`;
  useEffect(() => setPrices(Object.fromEntries(data.map((p) => [key(p.treatment_type, p.duration_minutes), String(p.price)]))), [data]);

  function submit() {
    const rows = (["waxing", "electrolysis"] as TreatmentType[]).flatMap((t) =>
      allowedDurations(t).map((d) => ({ treatment_type: t, duration_minutes: d, price: Number(prices[key(t, d)] || 0) })),
    );
    save.mutate(rows);
  }

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-soft">
      {(["waxing", "electrolysis"] as TreatmentType[]).map((t) => (
        <div key={t}>
          <h2 className="mb-3 font-display text-xl">{TREATMENT_LABEL[t]}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {allowedDurations(t).map((d) => (
              <label key={d} className="space-y-1 rounded-xl border p-3">
                <span className="text-xs text-muted-foreground">{d} דקות</span>
                <div className="flex items-center gap-1">
                  <span>₪</span>
                  <Input type="number" min={0} className="h-8" value={prices[key(t, d)] ?? ""}
                    onChange={(e) => setPrices({ ...prices, [key(t, d)]: e.target.value })} />
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button variant="hero" onClick={submit} disabled={save.isPending}>שמירת מחירון</Button>
    </div>
  );
}
