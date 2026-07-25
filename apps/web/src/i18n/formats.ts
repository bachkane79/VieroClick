import type { Formats } from "next-intl";

/**
 * Shared next-intl format presets (Phase 7 — date/number/relative-time migration).
 * The active locale drives separators automatically (vi: DD/MM/YYYY, `.` thousands,
 * `,` decimal). Reference these by name at call sites: `format.dateTime(d, "short")`,
 * `format.number(x, "whole")`.
 *
 * Every preset here has at least one call site — a preset with no caller is copy
 * waiting to drift, so add one only when a real site needs it.
 */
export const formats = {
  dateTime: {
    short: { day: "2-digit", month: "2-digit", year: "numeric" }, // 25/07/2026
    dayMonth: { day: "2-digit", month: "2-digit" }, // 25/07
    time: { hour: "2-digit", minute: "2-digit" },
    dateTime: {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    /** Workspace-home greeting line: "Thứ Sáu, 25 tháng 7". */
    weekdayDate: { weekday: "long", day: "numeric", month: "long" },
    /** Calendar header: "tháng 7 2026". */
    monthYear: { month: "long", year: "numeric" },
    /** Compact due-date chip: "25 thg 7". */
    dayMonthShort: { day: "numeric", month: "short" },
    /** Comment timestamps: "25 thg 7, 14:30". */
    dayMonthTime: { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
    /** Gantt day-column headers — single letter. */
    weekdayNarrow: { weekday: "narrow" },
  },
  number: {
    /** Scores and counts shown without decimals. */
    whole: { maximumFractionDigits: 0 },
    /** Ratings and file sizes — always exactly one decimal place. */
    decimal1: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
  },
} satisfies Formats;
