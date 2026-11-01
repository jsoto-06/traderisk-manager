// =============================================================================
// TradeRisk Manager — Prop Firm New York Timezone & Session Reset (Paso 8.2)
// =============================================================================

/** Default timezone used by major prop firms and CME futures */
export const PROP_FIRM_TIMEZONE = 'America/New_York';
export const DEFAULT_RESET_HOUR = 17; // 17:00 (5:00 PM) New York time

/**
 * Calculates the exact Start of Trading Day timestamp for America/New_York at 17:00.
 * Automatically respects daylight saving time (EDT UTC-4 in summer, EST UTC-5 in winter).
 *
 * If the current time is 18:00 on Nov 1st NY time, the session started today at 17:00 NY time.
 * If the current time is 14:00 on Nov 1st NY time, the session started yesterday at 17:00 NY time.
 *
 * @param date Reference date (defaults to now)
 * @param resetHour Reset hour in 24h format (defaults to 17)
 * @returns Date object representing the exact UTC moment of the session start
 */
export function getNewYorkSessionStart(date: Date = new Date(), resetHour = DEFAULT_RESET_HOUR): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PROP_FIRM_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;

  // If before resetHour today in NY, the current trading day started yesterday at resetHour
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  if (hour < resetHour) {
    targetDate.setUTCDate(targetDate.getUTCDate() - 1);
  }

  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();
  const targetDay = targetDate.getUTCDate();

  // Search candidate offsets (EDT is UTC-4, EST is UTC-5; search 3-6 hours)
  for (let offsetHours = 3; offsetHours <= 6; offsetHours++) {
    const candidate = new Date(Date.UTC(targetYear, targetMonth, targetDay, resetHour + offsetHours, 0, 0, 0));
    const candParts = Object.fromEntries(formatter.formatToParts(candidate).map(p => [p.type, p.value]));
    let candHour = parseInt(candParts.hour, 10);
    if (candHour === 24) candHour = 0;
    if (
      parseInt(candParts.year, 10) === targetYear &&
      parseInt(candParts.month, 10) === targetMonth + 1 &&
      parseInt(candParts.day, 10) === targetDay &&
      candHour === resetHour &&
      parseInt(candParts.minute, 10) === 0
    ) {
      return candidate;
    }
  }

  // Fallback to standard UTC-5 if Intl parts matching did not trigger
  return new Date(Date.UTC(targetYear, targetMonth, targetDay, resetHour + 5, 0, 0, 0));
}

/**
 * Determines whether two timestamps fall into the same New York trading session.
 */
export function isSameNewYorkTradingSession(
  dateA: Date | string,
  dateB: Date | string,
  resetHour = DEFAULT_RESET_HOUR
): boolean {
  const dA = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const dB = typeof dateB === 'string' ? new Date(dateB) : dateB;

  if (isNaN(dA.getTime()) || isNaN(dB.getTime())) return false;

  const startA = getNewYorkSessionStart(dA, resetHour).getTime();
  const startB = getNewYorkSessionStart(dB, resetHour).getTime();

  return startA === startB;
}
