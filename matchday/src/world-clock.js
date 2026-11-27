const REAL_DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const WEEKS_PER_YEAR = 52;
export const TEAM_SHEET_LOCK_MS = 30 * 60 * 1000;

export function worldDate(startAt, time) {
  const elapsed = time - startAt;
  if (elapsed < 0) return null;
  const gameDay = Math.floor(elapsed * DAYS_PER_WEEK / REAL_DAY_MS);
  const week = Math.floor(gameDay / DAYS_PER_WEEK);
  return {
    year: 1 + Math.floor(week / WEEKS_PER_YEAR),
    week: 1 + week % WEEKS_PER_YEAR,
    day: 1 + gameDay % DAYS_PER_WEEK
  };
}
