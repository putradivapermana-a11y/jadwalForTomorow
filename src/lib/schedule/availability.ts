import prisma from "@/lib/prisma";
import { format, parseISO, areIntervalsOverlapping } from "date-fns";
import { ExtractedAvailability } from "@/lib/commands/types";

export type AvailabilityStatus = "FREE" | "BUSY" | "PARTIALLY_FREE" | "UNKNOWN";

export interface AvailabilityResult {
  status: AvailabilityStatus;
  message: string;
  conflicts: Array<{
    title: string;
    startTime: Date;
    endTime: Date;
    type: "FIXED_EVENT" | "SCHEDULE_BLOCK";
  }>;
}

export const PART_OF_DAY_RANGES = {
  pagi: { start: "08:00", end: "11:00" },
  siang: { start: "12:00", end: "15:00" },
  sore: { start: "15:00", end: "18:00" },
  malam: { start: "19:00", end: "22:00" }
};

export async function checkAvailability(userId: string, query: ExtractedAvailability): Promise<AvailabilityResult> {
  if (!query.date) {
    return {
      status: "UNKNOWN",
      message: "Tanggal tidak diketahui.",
      conflicts: []
    };
  }

  // Define the time window to check
  let queryStartTimeStr = query.startTime;
  let queryEndTimeStr = query.endTime;

  if (!queryStartTimeStr && query.partOfDay && PART_OF_DAY_RANGES[query.partOfDay]) {
    queryStartTimeStr = PART_OF_DAY_RANGES[query.partOfDay].start;
    queryEndTimeStr = queryEndTimeStr || PART_OF_DAY_RANGES[query.partOfDay].end;
  }

  const targetDateStr = query.date;
  const startOfDay = parseISO(`${targetDateStr}T00:00:00`);
  const endOfDay = parseISO(`${targetDateStr}T23:59:59`);

  let targetStart: Date | null = null;
  let targetEnd: Date | null = null;

  if (queryStartTimeStr) {
    targetStart = parseISO(`${targetDateStr}T${queryStartTimeStr}:00`);
    if (queryEndTimeStr) {
      targetEnd = parseISO(`${targetDateStr}T${queryEndTimeStr}:00`);
    } else {
      // If only start time provided, assume a 1 hour window for overlap check
      targetEnd = new Date(targetStart.getTime() + 60 * 60000);
    }
  }

  // Fetch active FixedEvents
  const activeEvents = await prisma.fixedEvent.findMany({
    where: {
      userId,
      status: "ACTIVE",
      startTime: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    orderBy: { startTime: 'asc' }
  });

  // Fetch active ScheduleBlocks via DailyPlan
  const activePlans = await prisma.dailyPlan.findMany({
    where: {
      userId,
      date: startOfDay, // using the date object matching the target date
      status: "ACTIVE"
    },
    include: {
      blocks: {
        orderBy: { startTime: 'asc' }
      }
    }
  });

  const activeBlocks = activePlans.flatMap(plan => plan.blocks);

  const conflicts: AvailabilityResult['conflicts'] = [];

  // Combine and sort all agendas
  const agendas = [
    ...activeEvents.map(e => ({ title: e.title, startTime: e.startTime, endTime: e.endTime, type: "FIXED_EVENT" as const })),
    ...activeBlocks.map(b => ({ title: b.title, startTime: b.startTime, endTime: b.endTime, type: "SCHEDULE_BLOCK" as const }))
  ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  if (!targetStart || !targetEnd) {
    // Date-only check
    if (agendas.length === 0) {
      const dateDisplay = format(startOfDay, "EEEE, d MMMM yyyy");
      return {
        status: "FREE",
        message: `${dateDisplay} masih free. Belum ada agenda aktif di hari itu.`,
        conflicts: []
      };
    } else {
      const dateDisplay = format(startOfDay, "EEEE, d MMMM");
      const agendaList = agendas.map(a => `${a.title} jam ${format(a.startTime, "HH:mm")}-${format(a.endTime, "HH:mm")}`).join(", ");
      return {
        status: "PARTIALLY_FREE",
        message: `${dateDisplay} ada ${agendas.length} agenda aktif: ${agendaList}.`,
        conflicts: agendas
      };
    }
  }

  // Time-range check
  for (const agenda of agendas) {
    if (areIntervalsOverlapping(
      { start: targetStart, end: targetEnd },
      { start: agenda.startTime, end: agenda.endTime }
    )) {
      conflicts.push(agenda);
    }
  }

  const timeDisplay = query.startTime ? `Jam ${query.startTime}` : (query.partOfDay ? query.partOfDay : "Waktu tersebut");

  if (conflicts.length === 0) {
    return {
      status: "FREE",
      message: `${timeDisplay} masih free. Mau gua catat agenda baru di jam itu?`,
      conflicts: []
    };
  }

  const conflictTitles = conflicts.map(c => c.title).join(" dan ");
  return {
    status: "BUSY",
    message: `${timeDisplay} bentrok dengan ${conflictTitles}, jadi lu nggak free di jam itu.`,
    conflicts
  };
}