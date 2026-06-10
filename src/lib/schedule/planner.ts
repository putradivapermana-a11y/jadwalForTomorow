import { BlockType, FixedEvent, UserProfile, BlockStatus } from "@prisma/client";
import { ProposedBlock, findFreeSlot, getDefaultDuration, hasOverlap, parseTimeSafely, validateNoOverlappingBlocks } from "./time-slots";
import { ExtractedDailyPlan } from "@/lib/commands/types";
import { addMinutes, format } from "date-fns";
import { startOfJakartaDay } from "./date-utils";
import { fillEmptySlots, PersonalContext } from "./personal-fill";

export interface PlannerResult {
  blocks: ProposedBlock[];
  unscheduledTasks: { title: string; reason: string }[];
  reasoning: string[];
  hasConflict: boolean;
  conflictReason?: string;
}

export interface PreservedBlock {
  title: string;
  startTime: Date;
  endTime: Date;
  blockType: BlockType;
  isLocked: boolean;
  referenceId?: string | null;
  status?: BlockStatus | null;
  category?: string | null;
}

export function generateDailyTimeline(
  targetDate: Date,
  profile: UserProfile | null,
  existingEvents: FixedEvent[],
  extractedPlan: ExtractedDailyPlan,
  newEventsWithIds: { id: string; title: string; startTime: Date; endTime: Date }[],
  newTasksWithIds: { id: string; title: string; priority: number; duration: number | null; category?: string | null }[],
  preservedBlocks: PreservedBlock[] = [],
  personalContext?: PersonalContext
): PlannerResult {
  const blocks: ProposedBlock[] = [];
  const unscheduledTasks: { title: string; reason: string }[] = [];
  const reasoning: string[] = [];

  const dayStart = startOfJakartaDay(targetDate);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  // 0. Add preserved protected blocks (from safe regeneration)
  // Only push ACTIVE blocks to block time slots.
  // Inactive ones (DONE, SKIPPED, CANCELLED, ARCHIVED) shouldn't block slots.
  const activePreservedBlocks = preservedBlocks.filter(pb => (pb.status || "ACTIVE") === "ACTIVE");
  
  const preservedCount = activePreservedBlocks.length;
  if (preservedCount > 0) {
    for (const pb of activePreservedBlocks) {
      blocks.push({
        title: pb.title,
        startTime: pb.startTime,
        endTime: pb.endTime,
        blockType: pb.blockType,
        isLocked: pb.isLocked,
        referenceId: pb.referenceId || undefined,
        category: pb.category || undefined,
        status: "ACTIVE" as BlockStatus // we only push active ones
      });
    }
    reasoning.push(`Gua tetep keep ${preservedCount} block yang udah lu lock / active.`);
  }

  // 1. Add existing active events (only if they aren't already in preservedBlocks)
  let addedOldEvents = 0;
  for (const ev of existingEvents) {
    if (!blocks.find(b => b.referenceId === ev.id && b.blockType === "FIXED_EVENT")) {
      blocks.push({
        title: ev.title,
        startTime: ev.startTime,
        endTime: ev.endTime,
        blockType: "FIXED_EVENT",
        isLocked: true,
        referenceId: ev.id,
        status: "ACTIVE" as BlockStatus
      });
      addedOldEvents++;
    }
  }

  if (addedOldEvents > 0) {
    reasoning.push(`Ada ${addedOldEvents} agenda sebelumnya yang sudah gua masukin.`);
  }

  // 2. Add new extracted fixed events
  for (const ev of newEventsWithIds) {
    const proposed = {
      title: ev.title,
      startTime: ev.startTime,
      endTime: ev.endTime,
      blockType: "FIXED_EVENT" as BlockType,
      isLocked: true,
      referenceId: ev.id,
      status: "ACTIVE" as BlockStatus
    };

    if (hasOverlap({ start: proposed.startTime, end: proposed.endTime }, blocks)) {
      return {
        blocks: [],
        unscheduledTasks: [],
        reasoning: [],
        hasConflict: true,
        conflictReason: `Agenda "${ev.title}" jam ${format(ev.startTime, "HH:mm")} bentrok sama agenda lain yang udah ada.`
      };
    }
    blocks.push(proposed);
  }

  // 3. Add sleep/wind-down if provided
  const dayRangeStart = new Date(dayStart);
  dayRangeStart.setHours(8, 0, 0, 0); // Default start 08:00
  let dayRangeEnd = new Date(dayStart);
  dayRangeEnd.setHours(22, 0, 0, 0); // Default end 22:00

  if (extractedPlan.sleepTarget) {
    const sleepTime = parseTimeSafely(dayStart, extractedPlan.sleepTarget, 22);
    dayRangeEnd = sleepTime;

    const windDownStart = addMinutes(sleepTime, -30);
    
    if (!hasOverlap({ start: windDownStart, end: sleepTime }, blocks)) {
      blocks.push({
        title: "Wind Down / Prep Sleep",
        startTime: windDownStart,
        endTime: sleepTime,
        blockType: "WIND_DOWN",
        isLocked: true,
        status: "ACTIVE" as BlockStatus
      });
      reasoning.push(`Gua set wind-down jam ${format(windDownStart, "HH:mm")} buat target tidur jam ${format(sleepTime, "HH:mm")}.`);
    } else {
      reasoning.push(`Target tidur jam ${format(sleepTime, "HH:mm")} agak mepet sama agenda malam lu.`);
    }
  }

  // 4. Sort flexible tasks
  const sortedTasks = [...newTasksWithIds].sort((a, b) => b.priority - a.priority);

  // 5. Place tasks
  for (const task of sortedTasks) {
    const dur = task.duration || getDefaultDuration(task.title, task.category || null);
    
    // Check if task is already preserved (e.g. from existing daily plan tasks)
    if (blocks.some(b => b.referenceId === task.id)) {
      continue;
    }

    // Try to find slot
    const slot = findFreeSlot(dayRangeStart, dayRangeEnd, dur, blocks);
    if (slot) {
      blocks.push({
        title: task.title,
        startTime: slot.start,
        endTime: slot.end,
        blockType: "TASK",
        isLocked: false,
        referenceId: task.id,
        category: task.category || undefined,
        status: "ACTIVE" as BlockStatus
      });
    } else {
      // Try with smaller buffer or outside preferred hours if HIGH priority
      // But DO NOT push past absolute max (e.g., dayRangeEnd + 60mins, but only if sleepTarget isn't hard strict)
      const extendedEnd = extractedPlan.sleepTarget ? dayRangeEnd : addMinutes(dayRangeEnd, 60);
      const extendedSlot = findFreeSlot(
        addMinutes(dayRangeStart, -120), // start 6 AM
        extendedEnd,
        dur,
        blocks
      );

      if (extendedSlot && task.priority >= 3) {
        blocks.push({
          title: task.title,
          startTime: extendedSlot.start,
          endTime: extendedSlot.end,
          blockType: "TASK",
          isLocked: false,
          referenceId: task.id,
          category: task.category || undefined,
          status: "ACTIVE" as BlockStatus
        });
        reasoning.push(`Tugas "${task.title}" gua masukin di jam extended karena jadwal padat.`);
      } else {
        unscheduledTasks.push({
          title: task.title,
          reason: "Waktu nggak cukup / jadwal terlalu padat"
        });
      }
    }
  }

  if (unscheduledTasks.length > 0) {
    reasoning.push(`Ada ${unscheduledTasks.length} tugas yang nggak muat di jadwal besok, coba prioritasin ulang.`);
  } else if (sortedTasks.length > 0) {
    reasoning.push("Semua tugas berhasil dijadwalkan.");
  }

  // 6. Fill empty slots using personal context
  let finalBlocks = blocks;
  if (personalContext) {
    finalBlocks = fillEmptySlots(blocks, dayRangeStart, dayRangeEnd, personalContext);
    if (finalBlocks.length > blocks.length) {
      reasoning.push("Gua juga nambahin beberapa aktivitas personal/habit berdasarkan profile lu biar harinya tetap produktif & seimbang.");
    }
  }
  
  // Final safeguard
  const validation = validateNoOverlappingBlocks(finalBlocks);
  if (!validation.valid && validation.conflict) {
    return {
      blocks: [],
      unscheduledTasks: [],
      reasoning: [],
      hasConflict: true,
      conflictReason: `Internal planner error: Terjadi bentrok antara "${validation.conflict[0].title}" dan "${validation.conflict[1].title}".`
    };
  }

  return {
    blocks: finalBlocks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    unscheduledTasks,
    reasoning,
    hasConflict: false
  };
}
