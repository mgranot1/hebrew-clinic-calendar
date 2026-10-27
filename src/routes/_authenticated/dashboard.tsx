import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, isToday, startOfMonth, startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { appointmentsQuery, breaksQuery, hoursQuery, ils, type Appointment } from "@/lib/clinic";
import { dayLoad, iso, type DayLoad } from "@/lib/day-schedule";
import { TimeGrid } from "@/components/clinic/TimeGrid";
import { AppointmentDialog } from "@/components/clinic/AppointmentDialog";
import { AppointmentDetails } from "@/components/clinic/AppointmentDetails";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "יומן תורים – Etti" }] }),
  component: Dashboard,
});

type View = "month" | "week" | "day";

const LOAD_STYLE: Record<DayLoad, { dot: string; label: string }> = {
  free: { dot: "bg-success", label: "יש מקום" },
  busy: { dot: "bg-primary-glow", label: "כמעט מלא" },
  full: { dot: "bg-destructive", label: "מלא" },
  closed: { dot: "bg-border", label: "סגור" },
};

function Dashboard() {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(new Date());
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  // Visible date range for the current view.
  const [from, to] = useMemo(() => {
    if (view === "day") return [cursor, cursor];
    if (view === "week") return [startOfWeek(cursor), endOfWeek(cursor)];
    return [startOfWeek(startOfMonth(cursor)), endOfWeek(endOfMonth(cursor))];
  }, [view, cursor]);

  const { data: appts = [] } = useQuery(appointmentsQuery(iso(from), iso(to)));
  const { data: hours = [] } = useQuery(hoursQuery);
  const { data: breaks = [] } = useQuery(breaksQuery);
  const days = eachDayOfInterval({ start: from, end: to });

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "day" ? addDays(c, dir) : view === "week" ? addWeeks(c, dir) : addMonths(c, dir)));

  const title =
    view === "month" ? format(cursor, "LLLL yyyy", { locale: he })
    : view === "week" ? `${format(from, "d/M")} – ${format(to, "d/M/yyyy")}`
    : format(cursor, "EEEE, d בLLLL yyyy", { locale: he });

  const active = appts.filter((a) => a.status !== "cancelled");
  const expected = active.reduce((s, a) => s + Number(a.price), 0);
  const paid = appts.filter((a) => a.status === "paid").reduce((s, a) => s + Number(a.price), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">יומן תורים</h1>
          <p className="text-muted-foreground">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} className="rounded-lg border bg-card p-1">
            <ToggleGroupItem value="day">יום</ToggleGroupItem>
            <ToggleGroupItem value="week">שבוע</ToggleGroupItem>
            <ToggleGroupItem value="month">חודש</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="הקודם"><ChevronRight /></Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>היום</Button>
            <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="הבא"><ChevronLeft /></Button>
          </div>
          <Button variant="hero" onClick={() => setCreating(true)}><Plus /> תור חדש</Button>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4">
        <Stat label="תורים בתצוגה" value={String(active.length)} />
        <Stat label="הכנסה צפויה" value={ils(expected)} />
        <Stat label="שולם" value={ils(paid)} />
      </section>

      {view === "month" ? (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="grid grid-cols-7 border-b bg-secondary text-center text-xs font-medium text-secondary-foreground">
            {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const load = dayLoad(d, hours, breaks, appts);
              const count = appts.filter((a) => a.appt_date === iso(d) && a.status !== "cancelled").length;
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => { setCursor(d); setView("day"); }}
                  className={cn(
                    "flex min-h-24 flex-col items-start gap-1 border-b border-l p-2 text-right transition-colors hover:bg-accent",
                    !isSameMonth(d, cursor) && "opacity-40",
                    load === "closed" && "bg-muted",
                  )}
                >
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm", isToday(d) && "bg-primary text-primary-foreground")}>
                    {format(d, "d")}
                  </span>
                  {count > 0 && <span className="text-xs text-muted-foreground">{count} תורים</span>}
                  <span className="mt-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", LOAD_STYLE[load].dot)} />
                    {LOAD_STYLE[load].label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <TimeGrid days={days} hours={hours} breaks={breaks} appts={appts} onSelect={setSelected} />
      )}

      <AppointmentDialog open={creating} onOpenChange={setCreating} initialDate={view === "day" ? cursor : new Date()} />
      <AppointmentDetails appt={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
