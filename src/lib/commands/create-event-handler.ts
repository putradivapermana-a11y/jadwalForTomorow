import prisma from "@/lib/prisma";
import { askAI } from "@/lib/ai/model-router";
import { EVENT_EXTRACTOR_PROMPT } from "./prompts";
import { CommandResult, ExtractedEventSchema, ExtractedEvent } from "./types";
import { format } from "date-fns";

function getEventDuration(category: string | null | undefined): number {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('kuliah') || cat.includes('uas')) return 120;
  if (cat.includes('meeting')) return 60;
  return 60; // default 60 minutes
}

export async function handleCreateEvent(
  userId: string, 
  rawText: string, 
  capturedInputId: string
): Promise<CommandResult> {
  const now = new Date();
  
  const systemPrompt = EVENT_EXTRACTOR_PROMPT
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

  let extracted: ExtractedEvent;
  try {
    const parsed = JSON.parse(responseText);
    extracted = ExtractedEventSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to parse/validate event extraction:", error);
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Invalid AI extraction format",
    };
  }

  // Completeness rules
  const missing = extracted.missingFields || [];
  if (!extracted.date && !missing.includes("date")) missing.push("date");
  if (!extracted.startTime && !missing.includes("startTime")) missing.push("startTime");

  if (missing.length > 0) {
    // Incomplete, mark for clarification
    // Specific friendly formatting for typical missing fields
    let question = `Saya butuh informasi lebih: ${missing.join(', ')} untuk event "${extracted.title}". Kapan tepatnya?`;
    if (missing.includes('startTime') && !missing.includes('date')) {
        question = `${extracted.title}-nya jam berapa?`;
    } else if (missing.includes('date') && !missing.includes('startTime')) {
        question = `${extracted.title}-nya tanggal berapa?`;
    }

    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: {
        status: "PENDING_CLARIFICATION",
        clarificationQuestion: question,
        parsedJson: extracted as unknown as object,
        missingFields: missing
      }
    });

    return {
      success: true,
      actionStatus: "PENDING_CLARIFICATION",
      message: "Need more info to create event",
      clarificationQuestion: question,
      data: extracted
    };
  }

  // Complete, create FixedEvent
  const startDateStr = `${extracted.date}T${extracted.startTime}:00`;
  const startTime = new Date(startDateStr);
  
  let endTime: Date;
  if (extracted.endTime) {
    endTime = new Date(`${extracted.date}T${extracted.endTime}:00`);
  } else {
    // Infer duration
    const durationMins = getEventDuration(extracted.category);
    endTime = new Date(startTime.getTime() + durationMins * 60000);
  }

  const event = await prisma.fixedEvent.create({
    data: {
      userId,
      title: extracted.title,
      startTime,
      endTime,
      status: "ACTIVE"
    }
  });

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
    message: `Event created: ${event.title}`,
    data: event
  };
}