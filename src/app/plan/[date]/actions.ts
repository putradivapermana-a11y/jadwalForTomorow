"use server";

import { BlockStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/app/actions/profile";
import { 
  updateScheduleBlock, 
  setScheduleBlockStatus, 
  toggleScheduleBlockLock, 
  archiveScheduleBlock 
} from "@/lib/schedule/block-actions";
import prisma from "@/lib/prisma";
import { generateDailyTimeline } from "@/lib/schedule/planner";

export async function editBlockAction(blockId: string, data: { title?: string, category?: string | null, startTime?: Date, endTime?: Date }, dateStr: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error("Unauthorized");
    
    await updateScheduleBlock(profile.userId, blockId, data);
    revalidatePath(`/plan/${dateStr}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update block";
    return { success: false, message };
  }
}

export async function setBlockStatusAction(blockId: string, status: BlockStatus, dateStr: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error("Unauthorized");
    
    await setScheduleBlockStatus(profile.userId, blockId, status);
    revalidatePath(`/plan/${dateStr}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update block status";
    return { success: false, message };
  }
}

export async function toggleBlockLockAction(blockId: string, isLocked: boolean, dateStr: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error("Unauthorized");
    
    await toggleScheduleBlockLock(profile.userId, blockId, isLocked);
    revalidatePath(`/plan/${dateStr}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to toggle lock";
    return { success: false, message };
  }
}

export async function archiveBlockAction(blockId: string, dateStr: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error("Unauthorized");
    
    await archiveScheduleBlock(profile.userId, blockId);
    revalidatePath(`/plan/${dateStr}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to archive block";
    return { success: false, message };
  }
}

export async function safeRegeneratePlanAction(planId: string, dateStr: string) {
  try {
    const profile = await getProfile();
    if (!profile) throw new Error("Unauthorized");

    const plan = await prisma.dailyPlan.findUnique({
      where: { id: planId, userId: profile.userId },
      include: { blocks: true }
    });

    if (!plan) throw new Error("Plan not found");

    const targetDayStart = new Date(plan.date);
    targetDayStart.setHours(0,0,0,0);
    const targetDayEnd = new Date(targetDayStart);
    targetDayEnd.setHours(23,59,59,999);

    // Get active fixed events directly from source
    const existingEvents = await prisma.fixedEvent.findMany({
      where: {
        userId: profile.userId,
        status: "ACTIVE",
        startTime: { gte: targetDayStart, lte: targetDayEnd }
      }
    });

    // Ensure all missing statuses in DB are treated as ACTIVE
    // We update them in DB so they are consistent from now on
    const blocksWithMissingStatus = plan.blocks.filter(b => !b.status);
    if (blocksWithMissingStatus.length > 0) {
      await prisma.scheduleBlock.updateMany({
        where: { id: { in: blocksWithMissingStatus.map(b => b.id) } },
        data: { status: "ACTIVE" }
      });
      // update memory representation
      blocksWithMissingStatus.forEach(b => b.status = "ACTIVE");
    }

    // A block is "effectively active" if status is ACTIVE (or was null, which we just fixed)
    // We only preserve locks/fixed events if they are also ACTIVE.
    const preservedBlocks = plan.blocks.filter(b => 
      b.status === "ACTIVE" && (b.isLocked || b.blockType === "FIXED_EVENT")
    ).map(b => ({
      title: b.title,
      startTime: b.startTime,
      endTime: b.endTime,
      blockType: b.blockType,
      isLocked: b.isLocked,
      referenceId: b.referenceId,
      status: b.status,
      category: b.category
    }));

    // Find task blocks that were NOT locked and ARE ACTIVE
    const activeUnlockedTaskBlocks = plan.blocks.filter(b => 
      b.status === "ACTIVE" && !b.isLocked && b.blockType === "TASK"
    );

    // We will simulate "new tasks" using these active unlocked blocks
    // Note: We don't change duration, just use current block duration
    const tasksToReschedule = activeUnlockedTaskBlocks.map(b => ({
      id: b.referenceId || b.id, // Fallback if no ref id
      title: b.title,
      priority: 3, // default mid
      duration: (b.endTime.getTime() - b.startTime.getTime()) / 60000,
      category: b.category
    }));

    // Extract pseudo extracted plan
    const sleepTargetStr = "22:00"; // default
    const extractedPlan = { 
      entityType: "DAILY_PLAN" as const,
      tasks: [], 
      fixedEvents: [], 
      sleepTarget: sleepTargetStr,
      notes: [],
      confidence: 1,
      missingFields: []
    };

    const plannerResult = generateDailyTimeline(
      plan.date,
      await prisma.userProfile.findUnique({ where: { userId: profile.userId } }),
      existingEvents,
      extractedPlan,
      [],
      tasksToReschedule,
      preservedBlocks
    );

    if (plannerResult.hasConflict) {
      throw new Error(plannerResult.conflictReason || "Conflict detected during regeneration");
    }

    // Write back transactionally
    await prisma.$transaction(async (tx) => {
      // Archive old unlocked ACTIVE blocks so we don't hard delete them (history)
      await tx.scheduleBlock.updateMany({
        where: {
          dailyPlanId: plan.id,
          isLocked: false,
          status: "ACTIVE"
        },
        data: { status: "ARCHIVED" }
      });

      // We only insert the NEW blocks that were generated by planner
      // To find them, filter plannerResult.blocks that are NOT in preservedBlocks
      // But actually, it's easier to just insert them all if we hard-delete old ones
      // Since we ARCHIVED old active blocks, let's insert the newly generated TASK/WIND_DOWN blocks
      
      const newBlocksToInsert = plannerResult.blocks.filter(pb => {
        // A block is new if it doesn't match an exact preserved block
        const isPreserved = preservedBlocks.some(
          oldb => oldb.title === pb.title && 
                  oldb.startTime.getTime() === pb.startTime.getTime() && 
                  oldb.endTime.getTime() === pb.endTime.getTime() && 
                  oldb.isLocked === pb.isLocked
        );
        return !isPreserved;
      });

      if (newBlocksToInsert.length > 0) {
        await tx.scheduleBlock.createMany({
          data: newBlocksToInsert.map(b => ({
            userId: profile.userId,
            dailyPlanId: plan.id,
            blockType: b.blockType,
            title: b.title,
            category: b.category,
            startTime: b.startTime,
            endTime: b.endTime,
            isLocked: b.isLocked,
            referenceId: b.referenceId,
            status: "ACTIVE"
          }))
        });
      }
    });

    revalidatePath(`/plan/${dateStr}`);
    return { success: true };

  } catch (err) {
    const message = err instanceof Error ? err.message : "Regeneration failed";
    return { success: false, message };
  }
}
