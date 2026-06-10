import prisma from "@/lib/prisma";
import { BlockStatus } from "@prisma/client";
import { areIntervalsOverlapping } from "date-fns";

/**
 * Validates if the proposed time overlaps with any protected block in the same DailyPlan.
 * A block is protected if it's ACTIVE, and it's not the block we are currently editing.
 * Locked blocks are also protected, regardless of ACTIVE status (usually they are ACTIVE).
 */
export async function validateBlockOverlap(
  dailyPlanId: string,
  excludeBlockId: string,
  newStartTime: Date,
  newEndTime: Date
) {
  const otherBlocks = await prisma.scheduleBlock.findMany({
    where: {
      dailyPlanId,
      id: { not: excludeBlockId },
      status: "ACTIVE"
    }
  });

  for (const b of otherBlocks) {
    if (
      areIntervalsOverlapping(
        { start: newStartTime, end: newEndTime },
        { start: b.startTime, end: b.endTime },
        { inclusive: false }
      )
    ) {
      return { valid: false, conflict: b };
    }
  }

  return { valid: true };
}

export async function updateScheduleBlock(
  userId: string,
  blockId: string,
  data: {
    title?: string;
    category?: string | null;
    startTime?: Date;
    endTime?: Date;
  }
) {
  const block = await prisma.scheduleBlock.findUnique({
    where: { id: blockId }
  });

  if (!block || block.userId !== userId) {
    throw new Error("Block not found or unauthorized");
  }

  // If time is changing, check constraints
  const newStart = data.startTime || block.startTime;
  const newEnd = data.endTime || block.endTime;

  const timeChanged =
    newStart.getTime() !== block.startTime.getTime() ||
    newEnd.getTime() !== block.endTime.getTime();

  if (timeChanged) {
    if (newStart.getTime() >= newEnd.getTime()) {
      throw new Error("Start time must be before end time");
    }

    if (block.isLocked) {
      throw new Error("Cannot change time of a locked block. Unlock it first.");
    }

    if (block.blockType === "FIXED_EVENT") {
      throw new Error("Cannot move a fixed event block directly from timeline. Edit the actual event instead.");
    }

    const overlap = await validateBlockOverlap(block.dailyPlanId, block.id, newStart, newEnd);
    if (!overlap.valid) {
      throw new Error(`Time overlaps with another block: "${overlap.conflict?.title}"`);
    }
  }

  return await prisma.scheduleBlock.update({
    where: { id: blockId },
    data: {
      title: data.title,
      category: data.category,
      startTime: data.startTime,
      endTime: data.endTime
    }
  });
}

export async function setScheduleBlockStatus(userId: string, blockId: string, status: BlockStatus) {
  const block = await prisma.scheduleBlock.findUnique({
    where: { id: blockId }
  });

  if (!block || block.userId !== userId) {
    throw new Error("Block not found or unauthorized");
  }

  // If restoring to ACTIVE, validate overlap
  if (status === "ACTIVE" && block.status !== "ACTIVE") {
    const overlap = await validateBlockOverlap(block.dailyPlanId, block.id, block.startTime, block.endTime);
    if (!overlap.valid) {
      throw new Error(`Cannot restore. Time overlaps with active block: "${overlap.conflict?.title}"`);
    }
  }

  return await prisma.scheduleBlock.update({
    where: { id: blockId },
    data: { status }
  });
}

export async function toggleScheduleBlockLock(userId: string, blockId: string, isLocked: boolean) {
  const block = await prisma.scheduleBlock.findUnique({
    where: { id: blockId }
  });

  if (!block || block.userId !== userId) {
    throw new Error("Block not found or unauthorized");
  }

  if (block.blockType === "FIXED_EVENT" && !isLocked) {
    throw new Error("Fixed events must remain locked.");
  }

  return await prisma.scheduleBlock.update({
    where: { id: blockId },
    data: { isLocked }
  });
}

export async function archiveScheduleBlock(userId: string, blockId: string) {
  const block = await prisma.scheduleBlock.findUnique({
    where: { id: blockId }
  });

  if (!block || block.userId !== userId) {
    throw new Error("Block not found or unauthorized");
  }

  if (block.blockType === "FIXED_EVENT") {
    throw new Error("Cannot archive a fixed event block directly. Cancel the event instead.");
  }

  if (block.isLocked) {
    throw new Error("Cannot archive a locked block. Unlock it first.");
  }

  return await prisma.scheduleBlock.update({
    where: { id: blockId },
    data: { status: "ARCHIVED" }
  });
}