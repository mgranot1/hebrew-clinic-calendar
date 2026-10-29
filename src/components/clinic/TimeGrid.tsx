import { format, isToday } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { typeTint, type Appointment, type Break, type WorkingHours, type AppointmentStatus, type TreatmentType } from "@/lib/clinic";

import { daySchedule } from "@/lib/day-schedule";
import { formatDuration, fromMinutes, toMinutes } from "@/lib/scheduling";

const PX_PER_MIN = 1.6;

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  scheduled: "bg-status-scheduled border-primary",
  completed: "bg-status-completed border-chart-5",
  paid: "bg-status-paid border-success",
  cancelled: "bg-status-cancelled border-border line-through opacity-60",
};

interface Props {
  days: Date[];
  hours: WorkingHours[];
  breaks: Break[];
  appts: Appointment[];
  types: TreatmentType[];
  onSelect: (a: Appointment) => void;
}

/** Week/day time grid with appointments positioned by minute. */
export function TimeGrid({ days, hours, breaks, appts, types, onSelect }: Props) {
  // Appointments store the type name, so color is looked up by name (same color for every duration).
  const colorByType = new Map(types.map((t) => [t.name, t.color]));
  const open = hours.filter((h) => h.is_open);
  const startMin =
    Math.floor(Math.min(...open.map((h) => toMinutes(h.start_time)), 8 * 60) / 60) * 60;
  const endMin = Math.ceil(Math.max(...open.map((h) => toMinutes(h.end_time)), 18 * 60) / 60) * 60;
  const height = (endMin - startMin) * PX_PER_MIN;
  const hourMarks = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60);

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <div className="flex min-w-[640px]">
        <div className="w-16 shrink-0 border-l">
          <div className="h-14" />
          <div className="relative" style={{ height }}>
            {hourMarks.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-2 text-xs text-muted-foreground"
                style={{ top: (m - startMin) * PX_PER_MIN }}
              >
                {fromMinutes(m)}
              </span>
            ))}
          </div>
        </div>
        {days.map((d) => {
          const s = daySchedule(d, hours, breaks, appts);
          const all = appts.filter((a) => a.appt_date === format(d, "yyyy-MM-dd"));
          return (
            <div key={d.toISOString()} className="min-w-0 flex-1 border-l last:border-l-0">
              <div
                className={cn(
                  "flex h-14 flex-col items-center justify-center border-b",
                  isToday(d) && "bg-accent",
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {format(d, "EEEE", { locale: he })}
                </span>
                <span className="font-display text-lg">{format(d, "d/M")}</span>
              </div>
              <div className={cn("relative", !s.open && "bg-muted")} style={{ height }}>
                {hourMarks.map((m) => (
                  <div
                    key={m}
                    className="absolute inset-x-0 border-t border-dashed border-border/70"
                    style={{ top: (m - startMin) * PX_PER_MIN }}
                  />
                ))}
                {s.open && (
                  <>
                    <div
                      className="absolute inset-x-0 top-0 bg-muted"
                      style={{ height: (s.open.start - startMin) * PX_PER_MIN }}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 bg-muted"
                      style={{ top: (s.open.end - startMin) * PX_PER_MIN }}
                    />
                  </>
                )}
                {s.breaks.map((b, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 flex items-center justify-center bg-muted text-[10px] text-muted-foreground"
                    style={{
                      top: (b.start - startMin) * PX_PER_MIN,
                      height: (b.end - b.start) * PX_PER_MIN,
                    }}
                  >
                    הפסקה
                  </div>
                ))}
                {all.map((a) => {
                  const st = toMinutes(a.start_time);
                  const color = colorByType.get(a.treatment_type);
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border-r-4 px-2 py-0.5 text-right text-xs shadow-sm transition-transform hover:z-10 hover:scale-[1.02]",
                        STATUS_CLASS[a.status as AppointmentStatus],
                      )}
                      style={{
                        top: (st - startMin) * PX_PER_MIN,
                        height: Math.max(a.duration_minutes * PX_PER_MIN, 18),
                        ...(color && { backgroundColor: typeTint(color) }),
                      }}
                      title={`${a.client_name} ${fromMinutes(st)} · ${formatDuration(a.duration_minutes)}`}
                    >
                      <span className="block truncate font-semibold">
                        {fromMinutes(st)} · {formatDuration(a.duration_minutes)}
                      </span>
                      <span className="block truncate">{a.client_name}</span>
                      {a.duration_minutes >= 15 && (
                        <span className="block truncate opacity-70">{a.treatment_type}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
