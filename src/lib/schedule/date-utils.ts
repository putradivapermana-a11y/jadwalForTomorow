import { formatInTimeZone, toDate } from "date-fns-tz";
import { startOfDay } from "date-fns";

const JAKARTA_TZ = "Asia/Jakarta";

/**
 * Returns the current date and time in Jakarta timezone as a Date object.
 * Note: The internal timestamp is UTC, but the fields (hours, etc) align with Jakarta time.
 */
export function getJakartaNow(): Date {
  const now = new Date();
  const jakartaStr = formatInTimeZone(now, JAKARTA_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return new Date(jakartaStr);
}

/**
 * Formats a Date object to a string in Jakarta timezone.
 */
export function formatJakarta(date: Date | number, formatStr: string): string {
  return formatInTimeZone(date, JAKARTA_TZ, formatStr);
}

/**
 * Parses a YYYY-MM-DD string into a Date object representing the start of that day in Jakarta timezone.
 * Returns null if invalid.
 */
export function parseJakartaDate(dateStr: string): Date | null {
  try {
    const d = toDate(`${dateStr}T00:00:00+07:00`);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Parses a YYYY-MM-DD string and HH:mm string into a Date object in Jakarta timezone.
 * Returns null if invalid.
 */
export function parseJakartaDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const d = toDate(`${dateStr}T${timeStr}:00+07:00`);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Ensures a Date object is pinned to the start of its day in Jakarta timezone.
 */
export function startOfJakartaDay(date: Date): Date {
  const dateStr = formatJakarta(date, "yyyy-MM-dd");
  return parseJakartaDate(dateStr) || startOfDay(date);
}