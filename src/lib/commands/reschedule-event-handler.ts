import prisma from "@/lib/prisma";
import { askAI } from "@/lib/ai/model-router";
import { RESCHEDULE_EXTRACTOR_PROMPT } from "./prompts";
import { CommandResult, ExtractedRescheduleSchema, ExtractedReschedule } from "./types";
import { format, differenceInMinutes } from "date-fns";
import { findMatchingEntities } from "@/lib/schedule/matching";
import { checkAvailability } from "@/lib/schedule/availability";

export async function handleRescheduleEvent(
  userId: string,
  rawText: string,
  capturedInputId: string
): Promise<CommandResult> {
  const now = new Date();

  const systemPrompt = RESCHEDULE_EXTRACTOR_PROMPT
    .replace("{CURRENT_DATE}", format(now, "yyyy-MM-dd"))
    .replace("{CURRENT_TIME}", format(now, "HH:mm"));

  const responseText = await askAI({
    modelType: 'fast',
    systemPrompt,
    userPrompt: rawText,
    responseFormat: 'json_object'
  });

  if (!responseText) {
    return {
      success: false,
      actionStatus: "FAILED",
      message: "AI extraction failed",
    };
  }

  let extracted: ExtractedReschedule;
  try {
    const parsed = JSON.parse(responseText);
    extracted = ExtractedRescheduleSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to parse reschedule extraction:", error);
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Invalid AI extraction format",
    };
  }

  // Find match (only EVENTS for now, tasks don't have block duration typically to reschedule this way, mostly due date)
  const matchResult = await findMatchingEntities(
    userId,
    "EVENT",
    extracted.targetTitle,
    extracted.oldDate,
    extracted.oldTime
  );

  if (matchResult.candidates.length === 0) {
    const msg = `Gua belum nemu jadwal yang cocok untuk di-reschedule.`;
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: {
        status: "PROCESSED",
        parsedJson: extracted as unknown as object
      }
    });
    return {
      success: true,
      actionStatus: "SUCCESS",
      message: msg,
      data: extracted
    };
  }

  if (matchResult.isAmbiguous || !matchResult.bestMatch) {
    const choices = matchResult.candidates.map((c, i) => ({
      id: c.id,
      label: `${c.title} (${c.date || "No date"} ${c.time || ""})`,
      index: i + 1
    }));
    
    const question = `Gua nemu beberapa jadwal. Pilih nomor yang mau di-reschedule:\n${choices.map(c => `${c.index}. ${c.label}`).join("\n")}`;
    
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: {
        status: "PENDING_CONFIRMATION",
        clarificationQuestion: question,
        parsedJson: {
          pendingAction: "CONFIRM_RESCHEDULE",
          candidates: matchResult.candidates.map(c => ({
            id: c.id,
            type: c.type,
            title: c.title,
            date: c.date,
            time: c.time,
            confidence: c.confidence
          })),
          extracted: JSON.parse(JSON.stringify(extracted))
        }
      }
    });

    return {
      success: true,
      actionStatus: "NEEDS_CONFIRMATION",
      message: "Multiple matches found.",
      clarificationQuestion: question,
      choices
    };
  }

  const target = matchResult.bestMatch;
  const originalEvent = target.originalEntity as { startTime: Date, endTime: Date };
  
  // Need new date and time
  if (!extracted.newDate || (!extracted.newTime && !extracted.newPartOfDay)) {
    const question = `Mau dipindah ke kapan tepatnya? (Butuh tanggal dan jam)`;
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: {
        status: "PENDING_CLARIFICATION",
        clarificationQuestion: question,
      parsedJson: {
        pendingAction: "CONFIRM_RESCHEDULE",
        targetId: target.id,
        targetType: target.type,
        extracted: JSON.parse(JSON.stringify(extracted))
      }
      }
    });

    return {
      success: true,
      actionStatus: "NEEDS_CLARIFICATION",
      message: "Missing new time/date info.",
      clarificationQuestion: question
    };
  }

  // Calculate new duration based on old event
  const durationMins = differenceInMinutes(originalEvent.endTime, originalEvent.startTime);

  // Check availability
  const avail = await checkAvailability(userId, {
    entityType: "AVAILABILITY_QUERY",
    date: extracted.newDate,
    startTime: extracted.newTime,
    endTime: null, // Let checkAvailability use partOfDay or 1 hr default, but we'll manually check duration below
    partOfDay: extracted.newPartOfDay,
    confidence: 1,
    missingFields: []
  });

  // Filter out the event itself from conflicts
  avail.conflicts = avail.conflicts.filter(c => !(c.type === "FIXED_EVENT" && c.title === target.title && c.startTime.getTime() === originalEvent.startTime.getTime()));
  
  if (avail.conflicts.length > 0) {
    const conflictTitles = avail.conflicts.map(c => c.title).join(" dan ");
    const msg = `${extracted.newDate} ${extracted.newTime || extracted.newPartOfDay} bentrok dengan ${conflictTitles}. Mau pilih jam lain?`;
    
    // Still save state in case they reply with new time
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: {
        status: "PENDING_CLARIFICATION",
        clarificationQuestion: msg,
      parsedJson: {
        pendingAction: "CONFIRM_RESCHEDULE",
        targetId: target.id,
        targetType: target.type,
        extracted: JSON.parse(JSON.stringify(extracted))
      }
      }
    });

    return {
      success: true,
      actionStatus: "NEEDS_CLARIFICATION",
      message: msg,
      clarificationQuestion: msg
    };
  }

  // Free -> ask confirmation
  const timeStr = extracted.newTime ? `jam ${extracted.newTime}` : extracted.newPartOfDay;
  const question = `Jadwal ${extracted.newDate} ${timeStr} masih kosong. Mau gua pindahin "${target.title}" ke waktu tersebut?`;

  await prisma.capturedInput.update({
    where: { id: capturedInputId },
    data: {
      status: "PENDING_CONFIRMATION",
      clarificationQuestion: question,
      parsedJson: {
        pendingAction: "CONFIRM_RESCHEDULE",
        targetId: target.id,
        targetType: target.type,
        extracted: JSON.parse(JSON.stringify(extracted)),
        durationMins
      }
    }
  });

  return {
    success: true,
    actionStatus: "NEEDS_CONFIRMATION",
    message: "Confirmation required.",
    clarificationQuestion: question
  };
}