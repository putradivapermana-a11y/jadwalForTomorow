import { addMinutes, isBefore, isAfter, areIntervalsOverlapping, parseISO, differenceInMinutes, parse } from "date-fns";
import { BlockType } from "@prisma/client";
import { parseJakartaDate, startOfJakartaDay } from "./date-utils";

export const PART_OF_DAY_RANGES = {
  pagi: { start: "08:00", end: "11:00" },
  siang: { start: "12:00", end: "15:00" },
  sore: { start: "15:00", end: "18:00" },
  malam: { start: "19:00", end: "22:00" }
};

export const CATEGORY_DEFAULT_MINUTES: Record<string, number> = {
  "meeting": 60,
  "kuliah": 120,
  "uas": 120,
  "uts": 120,
  "relationship": 120,
  "personal": 120,
  "learning": 60,
  "freelance": 60,
  "task": 60,
  "tugas": 60,
  "default": 60
};

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface ProposedBlock {
  title: string;
  startTime: Date;
  endTime: Date;
  blockType: BlockType;
  isLocked: boolean;
  referenceId?: string; // e.g. FixedEvent.id or Task.id
  status?: string; // e.g. BlockStatus
  category?: string;
}

/**
 * Get default duration for a given category/title in minutes
 */
export function getDefaultDuration(title: string, category?: string | null): number {
  const cat = (category || "").toLowerCase();
  const tit = title.toLowerCase();
  
  for (const [key, val] of Object.entries(CATEGORY_DEFAULT_MINUTES)) {
    if (cat.includes(key) || tit.includes(key)) {
      return val;
    }
  }
  return CATEGORY_DEFAULT_MINUTES["default"];
}

/**
 * Check if a proposed time overlaps with any existing blocks.
 * Uses inclusive: false so back-to-back events (10-11 and 11-12) do not overlap.
 */
export function hasOverlap(proposed: TimeSlot, existingBlocks: ProposedBlock[]): boolean {
  for (const block of existingBlocks) {
    if (areIntervalsOverlapping(
      { start: proposed.start, end: proposed.end },
      { start: block.startTime, end: block.endTime },
      { inclusive: false }
    )) {
      return true;
    }
  }
  return false;
}

/**
 * Asserts that the entire block array has no overlaps among itself.
 */
export function validateNoOverlappingBlocks(blocks: ProposedBlock[]): { valid: boolean; conflict?: [ProposedBlock, ProposedBlock] } {
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (areIntervalsOverlapping(
        { start: blocks[i].startTime, end: blocks[i].endTime },
        { start: blocks[j].startTime, end: blocks[j].endTime },
        { inclusive: false }
      )) {
        return { valid: false, conflict: [blocks[i], blocks[j]] };
      }
    }
  }
  return { valid: true };
}

/**
 * Find the first available free slot of `durationMins` between `rangeStart` and `rangeEnd`
 */
export function findFreeSlot(
  rangeStart: Date,
  rangeEnd: Date,
  durationMins: number,
  existingBlocks: ProposedBlock[]
): TimeSlot | null {
  // Sort blocks chronologically
  const sortedBlocks = [...existingBlocks]
    .filter(b => isBefore(b.startTime, rangeEnd) && isAfter(b.endTime, rangeStart))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  let currentStart = new Date(rangeStart);

  for (const block of sortedBlocks) {
    // Is there enough space before this block?
    if (differenceInMinutes(block.startTime, currentStart) >= durationMins) {
      return {
        start: currentStart,
        end: addMinutes(currentStart, durationMins)
      };
    }
    // Move current start past this block
    if (isAfter(block.endTime, currentStart)) {
      currentStart = new Date(block.endTime);
    }
  }

  // Check remaining time after last block
  if (differenceInMinutes(rangeEnd, currentStart) >= durationMins) {
    return {
      start: currentStart,
      end: addMinutes(currentStart, durationMins)
    };
  }

  return null; // No slot found
}

/**
 * Priority string to integer mapping
 */
export function priorityToInt(priority: string): number {
  switch (priority.toUpperCase()) {
    case "HIGH": return 5;
    case "MEDIUM": return 3;
    case "LOW": return 1;
    default: return 3;
  }
}

/**
 * Try to parse a date string safely relative to today, pinned to Jakarta.
 */
export function parseDateWithFallback(dateStr: string | null, referenceDate: Date): Date {
  if (!dateStr) return startOfJakartaDay(referenceDate);
  
  const d = parseJakartaDate(dateStr);
  if (d) return d;
  
  try {
    const parsed = parseISO(dateStr);
    if (!isNaN(parsed.getTime())) return startOfJakartaDay(parsed);
  } catch {
    // fallback
  }
  return startOfJakartaDay(referenceDate);
}

/**
 * Try to parse time HH:mm
 */
export function parseTimeSafely(date: Date, timeStr: string | null, fallbackHours: number = 9): Date {
  if (!timeStr) {
    const fallback = new Date(date);
    fallback.setHours(fallbackHours, 0, 0, 0);
    return fallback;
  }
  try {
    const parsed = parse(timeStr, "HH:mm", date);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    // fallback
  }
  const fallback = new Date(date);
  fallback.setHours(fallbackHours, 0, 0, 0);
  return fallback;
}