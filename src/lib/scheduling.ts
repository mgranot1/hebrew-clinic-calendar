/**
 * Pure scheduling rules for the clinic.
 * - Appointments start only on quarter-hour marks (:00, :15, :30, :45).
 * - At least BUFFER_MINUTES must separate consecutive appointments.
 * - A slot must fit fully inside working hours and outside breaks.
 */

export const SLOT_STEP = 15;
export const BUFFER_MINUTES = 5;
export const WAXING_DURATION = 15;
export const ELECTROLYSIS_DURATIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

export type TreatmentType = "waxing" | "electrolysis";

export interface Interval {
  start: number; // minutes from midnight
  end: number;
}

/** "09:30" or "09:30:00" -> 570 */
export function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
export function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 45 -> "45 דק׳", 60 -> "1 ש׳", 135 -> "2 ש׳ 15 דק׳" */
export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} דק׳`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} ש׳ ${m} דק׳` : `${h} ש׳`;
}

export function allowedDurations(type: TreatmentType): number[] {
  return type === "waxing" ? [WAXING_DURATION] : ELECTROLYSIS_DURATIONS;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Returns every valid start time (in minutes) for a new appointment.
 * @param open working window for the day, or null when closed
 * @param breaks break intervals for the day
 * @param booked existing (non-cancelled) appointments for the day
 * @param duration requested duration in minutes
 */
export function availableSlots(
  open: Interval | null,
  breaks: Interval[],
  booked: Interval[],
  duration: number,
): number[] {
  if (!open || duration <= 0) return [];
  const slots: number[] = [];
  const first = Math.ceil(open.start / SLOT_STEP) * SLOT_STEP;
  for (let s = first; s + duration <= open.end; s += SLOT_STEP) {
    const candidate = { start: s, end: s + duration };
    if (breaks.some((b) => overlaps(candidate, b))) continue;
    // Pad each booked appointment with the buffer on both sides.
    const clash = booked.some((b) =>
      overlaps(candidate, { start: b.start - BUFFER_MINUTES, end: b.end + BUFFER_MINUTES }),
    );
    if (!clash) slots.push(s);
  }
  return slots;
}

/**
 * True when a calendar date (yyyy-MM-dd) is earlier than today.
 * ISO dates sort correctly as plain strings, so a string compare is enough.
 */
export function isPastDay(dateIso: string, todayIso: string): boolean {
  return dateIso < todayIso;
}
