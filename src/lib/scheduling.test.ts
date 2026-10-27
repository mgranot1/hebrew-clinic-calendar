import { describe, expect, it } from "vitest";
import { availableSlots, toMinutes, fromMinutes, isPastDay } from "./scheduling";

const day = { start: toMinutes("10:00"), end: toMinutes("12:00") };
const slots = (booked: { start: number; end: number }[], d: number, breaks = []) =>
  availableSlots(day, breaks, booked, d).map(fromMinutes);

describe("scheduling rules", () => {
  it("only offers quarter-hour starts", () => {
    expect(slots([], 5).slice(0, 3)).toEqual(["10:00", "10:15", "10:30"]);
  });

  it("10-min appointment at 10:00 frees 10:15 next", () => {
    const s = slots([{ start: 600, end: 610 }], 15);
    expect(s[0]).toBe("10:15");
  });

  it("15-min appointment at 10:00 pushes next slot to 10:30", () => {
    const s = slots([{ start: 600, end: 615 }], 15);
    expect(s[0]).toBe("10:30");
  });

  it("keeps 5-minute buffer before an existing appointment", () => {
    // booked 10:30-10:45; a 15-min slot at 10:15 ends 10:30 with no buffer
    const s = slots([{ start: 630, end: 645 }], 15);
    expect(s).toContain("10:00");
    expect(s).not.toContain("10:15");
  });

  it("slots must end within working hours and skip breaks", () => {
    const s = slots([], 30, [{ start: 660, end: 690 }] as never);
    expect(s).not.toContain("11:00");
    expect(s).not.toContain("11:45");
    expect(s).toContain("11:30");
  });

  it("closed day has no slots", () => {
    expect(availableSlots(null, [], [], 15)).toEqual([]);
  });
  it("a date before today is not bookable", () => {
    expect(isPastDay("2026-10-26", "2026-10-27")).toBe(true);
    expect(isPastDay("2026-10-27", "2026-10-27")).toBe(false);
    expect(isPastDay("2026-10-28", "2026-10-27")).toBe(false);
  });
});
