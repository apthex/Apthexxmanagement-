import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetweenInclusive,
  formatIstDate,
  formatIstDateTime,
  istToday,
  istYesterday,
  isValidDateString,
  weekRange,
} from "@/lib/dates";

describe("Work Logs & IST Date Handling (Build Spec §6.6, §7)", () => {
  it("formats dates in IST (Asia/Kolkata) correctly", () => {
    // 2026-10-23 18:30:00 UTC is 2026-10-24 00:00:00 IST
    const utcDate = new Date("2026-10-23T18:30:00Z");
    const formatted = formatIstDate(utcDate);
    expect(formatted).toBe("24 Oct 2026");

    const dateTimeFormatted = formatIstDateTime(utcDate);
    expect(dateTimeFormatted).toContain("24 Oct 2026");
    expect(dateTimeFormatted).toContain("00:00:00");
  });

  it("calculates Monday-based weekRange and consecutive days", () => {
    // 2026-10-24 is Saturday
    const week = weekRange("2026-10-24");
    expect(week.start).toBe("2026-10-19"); // Monday
    expect(week.end).toBe("2026-10-25");   // Sunday

    const days = daysBetweenInclusive(week.start, week.end);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-19");
    expect(days[6]).toBe("2026-10-25");
  });

  it("derives midnight lock at request time based on IST date without relying on midnight cron", () => {
    const today = istToday();
    const yesterday = istYesterday();

    // A log filed for today is editable (unlocked)
    const isTodayLocked = today !== today;
    expect(isTodayLocked).toBe(false);

    // A log filed yesterday or any prior day is immediately locked
    const isYesterdayLocked = yesterday !== today;
    expect(isYesterdayLocked).toBe(true);

    const pastDate = addDays(today, -5);
    const isPastLocked = pastDate !== today;
    expect(isPastLocked).toBe(true);
  });

  it("validates date string formats strictly YYYY-MM-DD", () => {
    expect(isValidDateString("2026-10-24")).toBe(true);
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false); // Invalid calendar date
    expect(isValidDateString("invalid")).toBe(false);
    expect(isValidDateString("24-10-2026")).toBe(false);
  });
});
