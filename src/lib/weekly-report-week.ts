/**
 * Vodium Ledger — weekly report period maths.
 *
 * Split out from lib/weekly-report.ts so it can be unit-tested directly: that
 * module imports prisma, and the test suite (tests/*.test.ts) deliberately only
 * imports pure libs.
 *
 * WEEK DEFINITION: calendar Monday 00:00 → Sunday 23:59:59.999, Africa/Lagos.
 *
 * Africa/Lagos is UTC+01:00 with NO daylight saving, ever, so the offset is a
 * constant. For this one zone a fixed offset is not a shortcut — it is the
 * correct answer, which is why no timezone library is pulled in.
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+01:00, no DST
const DAY_MS = 86_400_000;

/**
 * The Monday-to-Sunday week that has just ended, relative to `now`.
 *
 * On Monday this returns the previous Mon–Sun. Run it on any other day and it
 * STILL returns the last complete week, so a retry or a late cron reproduces the
 * same report rather than a half-finished one.
 */
export function lastCompleteWeek(now: Date = new Date()): { weekStart: Date; weekEnd: Date } {
  // Shift into Lagos local time so day-of-week and midnight read as local.
  const lagosNow = new Date(now.getTime() + LAGOS_OFFSET_MS);

  // getUTCDay on the shifted clock is the Lagos day-of-week: 0 = Sunday.
  const dayOfWeek = lagosNow.getUTCDay();
  // Days back to the Monday of the CURRENT Lagos week (Sunday counts as 6).
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const thisMondayLagos = Date.UTC(
    lagosNow.getUTCFullYear(),
    lagosNow.getUTCMonth(),
    lagosNow.getUTCDate() - daysSinceMonday
  );

  // Previous week's Monday 00:00 Lagos, converted back to a true UTC instant.
  const weekStart = new Date(thisMondayLagos - 7 * DAY_MS - LAGOS_OFFSET_MS);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS - 1);

  return { weekStart, weekEnd };
}

/** "11 – 17 Aug 2026" — the label used in the PDF and the WhatsApp message. */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "Africa/Lagos" };
  const start = weekStart.toLocaleDateString("en-NG", opts);
  const end = weekEnd.toLocaleDateString("en-NG", { ...opts, year: "numeric" });
  return `${start} – ${end}`;
}
