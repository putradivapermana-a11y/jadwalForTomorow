import prisma from "@/lib/prisma";
import { CommandResult, ExtractedDailyPlanSchema } from "./types";
import { askAIWithValidationMetadata } from "@/lib/ai/model-router";
import { DAILY_PLAN_EXTRACTOR_PROMPT } from "./prompts";
import { generateDailyTimeline } from "@/lib/schedule/planner";
import { parseDateWithFallback, parseTimeSafely, priorityToInt, getDefaultDuration } from "@/lib/schedule/time-slots";
import { formatJakarta, getJakartaNow } from "@/lib/schedule/date-utils";

export async function handleGenerateDailyPlan(
  userId: string,
  rawText: string,
  capturedInputId: string
): Promise<CommandResult> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Profil belum lengkap.",
      clarificationQuestion: "Bro, lu belum isi profile onboarding. Isi dulu gih biar gua bisa atur jadwal sesuai gaya hidup lu."
    };
  }

  const now = getJakartaNow();
  const dateStr = formatJakarta(now, "yyyy-MM-dd");
  const timeStr = formatJakarta(now, "HH:mm");

  const prompt = DAILY_PLAN_EXTRACTOR_PROMPT
    .replace("{CURRENT_DATE}", dateStr)
    .replace("{CURRENT_TIME}", timeStr);

  const aiResult = await askAIWithValidationMetadata({
    modelType: "worker",
    systemPrompt: prompt,
    userPrompt: rawText,
    schema: ExtractedDailyPlanSchema,
    isDailyPlan: true
  });

  const extraction = aiResult.data;
  const aiTrace = [{ purpose: "daily_plan_extractor", ...aiResult.metadata }];

  if (!extraction) {
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: { status: "FAILED" }
    });
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Gagal ekstrak jadwal harian.",
      clarificationQuestion: "Sorry, gua gagal ngekstrak jadwal dari teks lu. Formatnya nggak valid walau udah coba repair.",
      aiTrace
    };
  }
  const targetDate = parseDateWithFallback(extraction.targetDateText ?? null, now);
  // Default logic: If they didn't specify, assume tomorrow if requested late in day, else today.
  // Actually, usually they say "besok".

  // Dedupe extraction events in memory
  const uniqueFixedEvents = [];
  const seenEventKeys = new Set<string>();
  for (const ev of extraction.fixedEvents) {
    const start = parseTimeSafely(targetDate, ev.startTime || null, 9);
    const end = parseTimeSafely(targetDate, ev.endTime || null, 10);
    if (end.getTime() <= start.getTime()) {
      end.setHours(start.getHours() + 1);
    }
    const key = `${ev.title.trim().toLowerCase()}_${start.getTime()}_${end.getTime()}`;
    if (!seenEventKeys.has(key)) {
      seenEventKeys.add(key);
      uniqueFixedEvents.push({ ...ev, startTimeDate: start, endTimeDate: end });
    }
  }

  // Check if DailyPlan already exists for this date
  const existingPlan = await prisma.dailyPlan.findUnique({
    where: {
      userId_date: {
        userId,
        date: targetDate
      }
    }
  });

  if (existingPlan) {
    // If it exists, let's treat it as a plan update/append. 
    // Wait, PRD says same date overwrite should not be silent. It should probably ask confirmation or reject.
    // For MVP, we reject and tell user to regenerate from UI, as full state merge is complex.
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: { status: "FAILED", parsedJson: extraction as unknown as object }
    });
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Jadwal sudah ada untuk tanggal ini.",
      clarificationQuestion: `Jadwal buat tanggal ${formatJakarta(targetDate, "dd MMM yyyy")} udah ada. Kalo mau nambah acara baru, mending bikin event/task aja satu-satu, atau regenerate via UI timeline. Gua nggak berani nindih jadwal full.`,
      aiTrace
    };
  }

  // Load existing ACTIVE fixed events for that day
  const targetDayStart = new Date(targetDate);
  targetDayStart.setHours(0,0,0,0);
  const targetDayEnd = new Date(targetDayStart);
  targetDayEnd.setHours(23,59,59,999);

  const existingEvents = await prisma.fixedEvent.findMany({
    where: {
      userId,
      status: "ACTIVE",
      startTime: { gte: targetDayStart, lte: targetDayEnd }
    }
  });

  // Prepare memory objects for planner
  // Generate random IDs for planner reference, we will remap after actual DB creation
  const tempEvents = uniqueFixedEvents.map((ev, i) => ({
    id: `temp_ev_${i}`,
    title: ev.title,
    startTime: ev.startTimeDate,
    endTime: ev.endTimeDate
  }));

  const tempTasks = extraction.tasks.map((task, i) => ({
    id: `temp_task_${i}`,
    title: task.title,
    priority: priorityToInt(task.priority ?? "MEDIUM"),
    duration: task.estimatedMinutes || getDefaultDuration(task.title, task.category || null)
  }));

  // Generate timeline BEFORE writing anything to DB
  const plannerResult = generateDailyTimeline(
    targetDate,
    profile,
    existingEvents,
    extraction,
    tempEvents,
    tempTasks
  );

  if (plannerResult.hasConflict) {
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: { status: "FAILED", parsedJson: extraction as unknown as object }
    });
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Ada bentrok di jadwal.",
      clarificationQuestion: plannerResult.conflictReason || "Ada jadwal yang bentrok nih, gak bisa gua proses.",
      aiTrace
    };
  }

  // All good, write to DB transactionally
  try {
    const txResult = await prisma.$transaction(async (tx) => {
      // Create events
      const dbEventsMap = new Map<string, string>();
      for (const tempEv of tempEvents) {
        const created = await tx.fixedEvent.create({
          data: {
            userId,
            title: tempEv.title,
            startTime: tempEv.startTime,
            endTime: tempEv.endTime,
            status: "ACTIVE"
          }
        });
        dbEventsMap.set(tempEv.id, created.id);
      }

      // Create tasks
      const dbTasksMap = new Map<string, string>();
      for (const tempTask of tempTasks) {
        const created = await tx.task.create({
          data: {
            userId,
            title: tempTask.title,
            priority: tempTask.priority,
            duration: tempTask.duration,
            status: "TODO"
          }
        });
        dbTasksMap.set(tempTask.id, created.id);
      }

      // Remap block reference IDs
      const mappedBlocks = plannerResult.blocks.map(b => {
        let refId = b.referenceId;
        if (refId && dbEventsMap.has(refId)) refId = dbEventsMap.get(refId);
        else if (refId && dbTasksMap.has(refId)) refId = dbTasksMap.get(refId);

        return {
          userId, // required by schema
          blockType: b.blockType,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          isLocked: b.isLocked,
          referenceId: refId
        };
      });

      const dailyPlan = await tx.dailyPlan.create({
        data: {
          userId,
          date: targetDate,
          status: "ACTIVE",
          blocks: {
            create: mappedBlocks
          }
        }
      });

      await tx.capturedInput.update({
        where: { id: capturedInputId },
        data: { parsedJson: extraction as unknown as object, status: "PROCESSED" }
      });

      return dailyPlan;
    });

    const reply = `Jadwal tanggal ${formatJakarta(targetDate, "dd MMM yyyy")} udah gua susun. ` + plannerResult.reasoning.join(" ");
    
    // Explicitly format date as string to prevent timezone drift on client
    const dateString = formatJakarta(targetDate, "yyyy-MM-dd");

    return {
      success: true,
      actionStatus: "SUCCESS",
      message: "Jadwal harian berhasil dibuat.",
      clarificationQuestion: reply,
      data: {
        planId: txResult.id,
        date: targetDate,
        dateString,
        unscheduledTasks: plannerResult.unscheduledTasks
      },
      aiTrace
    };

  } catch (error: unknown) {
    // Check unique constraint violation on daily plan
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      await prisma.capturedInput.update({
        where: { id: capturedInputId },
        data: { status: "FAILED", parsedJson: extraction as unknown as object }
      });
      return {
        success: false,
        actionStatus: "FAILED",
        message: "Jadwal sudah ada.",
        clarificationQuestion: `Jadwal buat tanggal ${formatJakarta(targetDate, "dd MMM yyyy")} keburu dibikin. Gak bisa numpuk.`
      };
    }
    throw error;
  }
}
