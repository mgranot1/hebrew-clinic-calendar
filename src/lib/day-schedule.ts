import { format } from "date-fns";
import type { Appointment, Break, WorkingHours } from "./clinic";
import { availableSlots, toMinutes, type Interval } from "./scheduling";

export const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Build the working window, breaks and booked intervals for one calendar date. */
export function daySchedule(date: Date, hours: WorkingHours[], breaks: Break[], appts: Appointment[]) {
  const dow = date.getDay();
  const h = hours.find((x) => x.day_of_week === dow);
  const open: Interval | null = h?.is_open ? { start: toMinutes(h.start_time), end: toMinutes(h.end_time) } : null;
  const dayBreaks = breaks.filter((b) => b.day_of_week === dow).map((b) => ({ start: toMinutes(b.start_time), end: toMinutes(b.end_time) }));
  const dayAppts = appts.filter((a) => a.appt_date === iso(date) && a.status !== "cancelled");
  const booked = dayAppts.map((a) => ({ start: toMinutes(a.start_time), end: toMinutes(a.start_time) + a.duration_minutes }));
  return { open, breaks: dayBreaks, booked, appts: dayAppts };
}

export type DayLoad = "closed" | "free" | "busy" | "full";

/** Classify a day for the month view based on remaining 15-minute openings. */
export function dayLoad(date: Date, hours: WorkingHours[], breaks: Break[], appts: Appointment[]): DayLoad {
  const s = daySchedule(date, hours, breaks, appts);
  if (!s.open) return "closed";
  const free = availableSlots(s.open, s.breaks, s.booked, 15).length;
  if (free === 0) return "full";
  return free <= 4 ? "busy" : "free";
}
