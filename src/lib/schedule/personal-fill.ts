import { BlockType, Habit, HabitLog, Task, UserProfile } from "@prisma/client";
import { ProposedBlock, findFreeSlot } from "./time-slots";
import { addMinutes } from "date-fns";

export interface PersonalContext {
  profile: UserProfile | null;
  activeHabits: Habit[];
  todayHabitLogs: HabitLog[];
  unfinishedTasks: Task[];
  latestNoteInsights: string | null;
}

export function fillEmptySlots(
  blocks: ProposedBlock[],
  dayRangeStart: Date,
  dayRangeEnd: Date,
  context: PersonalContext
): ProposedBlock[] {
  const resultBlocks = [...blocks];
  
  if (!context.profile) {
    return resultBlocks; // Need profile to personalize
  }

  // 1. Collect candidates
  const candidates: { title: string; type: BlockType; category: string; duration: number; priority: number }[] = [];

  // 1a. Unfinished high priority tasks (that aren't already scheduled)
  const scheduledTaskIds = new Set(resultBlocks.filter(b => b.blockType === "TASK" && b.referenceId).map(b => b.referenceId));
  for (const task of context.unfinishedTasks) {
    if (!scheduledTaskIds.has(task.id) && task.priority >= 3) {
      candidates.push({
        title: task.title,
        type: "TASK",
        category: "Backlog",
        duration: task.duration || 60,
        priority: task.priority
      });
    }
  }

  // 1b. Active habits not DONE today
  const doneHabitIds = new Set(context.todayHabitLogs.filter(l => l.status === "DONE").map(l => l.habitId));
  for (const habit of context.activeHabits) {
    if (!doneHabitIds.has(habit.id)) {
      candidates.push({
        title: habit.title,
        type: "PERSONAL",
        category: habit.category || "Habit",
        duration: 45, // default habit duration
        priority: 4 // pretty high
      });
    }
  }

  // 1c. Interests / Goals from Profile
  const passions = (context.profile.passions || "").split(",").map(s => s.trim()).filter(Boolean);
  const goals = (context.profile.shortTermGoals || "").split(",").map(s => s.trim()).filter(Boolean);
  
  if (passions.length > 0) {
    // Add one random passion exploration
    candidates.push({
      title: `Eksplorasi: ${passions[0]}`,
      type: "LEARNING",
      category: "Interest",
      duration: 60,
      priority: 2
    });
  }

  if (goals.length > 0) {
    // Add progress toward goal
    candidates.push({
      title: `Progress Goal: ${goals[0]}`,
      type: "PERSONAL",
      category: "Goal",
      duration: 60,
      priority: 3
    });
  }

  // 1d. Daily Note Insights
  if (context.latestNoteInsights) {
    candidates.push({
      title: "Daily Reflection / Review Insights",
      type: "PERSONAL",
      category: "Reflection",
      duration: 30,
      priority: 2
    });
  }

  // Sort candidates by priority desc
  candidates.sort((a, b) => b.priority - a.priority);

  // 2. Identify large empty slots (>60 mins) and fill them, but leave some buffer
  // We don't want 100% productivity
  
  let filledCount = 0;
  for (const candidate of candidates) {
    // Break if we already added enough generated blocks (e.g., max 3 to prevent overwhelming)
    if (filledCount >= 3) break;

    // Try to find a slot that fits the candidate + 15 min buffer
    const neededMins = candidate.duration + 15; 
    const slot = findFreeSlot(dayRangeStart, dayRangeEnd, neededMins, resultBlocks);

    if (slot) {
      // Create candidate block
      resultBlocks.push({
        title: candidate.title,
        startTime: slot.start,
        endTime: addMinutes(slot.start, candidate.duration),
        blockType: candidate.type,
        isLocked: false,
        isAiGenerated: true,
        category: candidate.category,
        status: "ACTIVE"
      });

      // Fill remaining 15 min with Buffer/Rest
      resultBlocks.push({
        title: "Istirahat / Buffer",
        startTime: addMinutes(slot.start, candidate.duration),
        endTime: addMinutes(slot.start, candidate.duration + 15),
        blockType: "BUFFER",
        isLocked: false,
        isAiGenerated: true,
        category: "Rest",
        status: "ACTIVE"
      });

      filledCount++;
    }
  }

  return resultBlocks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}