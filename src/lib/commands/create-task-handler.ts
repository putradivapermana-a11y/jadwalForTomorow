import prisma from "@/lib/prisma";
import { askAI } from "@/lib/ai/model-router";
import { TASK_EXTRACTOR_PROMPT } from "./prompts";
import { CommandResult, ExtractedTaskSchema, ExtractedTask } from "./types";
import { format } from "date-fns";

export async function handleCreateTask(
  userId: string, 
  rawText: string, 
  capturedInputId: string,
  isDeadline: boolean
): Promise<CommandResult> {
  const now = new Date();
  
  const systemPrompt = TASK_EXTRACTOR_PROMPT
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

  let extracted: ExtractedTask;
  try {
    const parsed = JSON.parse(responseText);
    // Enforce entityType based on intent to make parsing safer if AI gets confused
    if (!parsed.entityType) {
      parsed.entityType = isDeadline ? "DEADLINE" : "TASK";
    }
    extracted = ExtractedTaskSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to parse/validate task extraction:", error);
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Invalid AI extraction format",
    };
  }

  // Completeness rules for Deadline vs Task
  const missing = extracted.missingFields || [];
  
  if (isDeadline) {
    if (!extracted.date && !missing.includes("date")) missing.push("date");
  }
  // For tasks, date/time is optional. If title is there, we're good.
  
  if (missing.length > 0) {
    // Incomplete, mark for clarification
    let question = `Saya butuh informasi lebih: ${missing.join(', ')} untuk ${isDeadline ? 'deadline' : 'tugas'} "${extracted.title}". Kapan tepatnya?`;
    if (missing.includes('date') && isDeadline) {
      question = `Deadline "${extracted.title}" tanggal berapa?`;
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
      message: "Need more info to create task/deadline",
      clarificationQuestion: question,
      data: extracted
    };
  }

  // Complete, create Task
  let dueDate: Date | null = null;
  if (extracted.date) {
    const timeStr = extracted.time || "23:59"; // default to end of day if no time specified
    dueDate = new Date(`${extracted.date}T${timeStr}:00`);
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title: extracted.title,
      priority: extracted.priority || 1,
      dueDate,
      status: "TODO"
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
    message: `${isDeadline ? 'Deadline' : 'Task'} created: ${task.title}`,
    data: task
  };
}