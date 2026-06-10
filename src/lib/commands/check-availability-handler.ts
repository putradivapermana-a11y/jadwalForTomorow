import prisma from "@/lib/prisma";
import { askAI } from "@/lib/ai/model-router";
import { AVAILABILITY_EXTRACTOR_PROMPT } from "./prompts";
import { CommandResult, ExtractedAvailabilitySchema, ExtractedAvailability } from "./types";
import { format } from "date-fns";
import { checkAvailability } from "@/lib/schedule/availability";

export async function handleCheckAvailability(
  userId: string,
  rawText: string,
  capturedInputId: string
): Promise<CommandResult> {
  const now = new Date();

  const systemPrompt = AVAILABILITY_EXTRACTOR_PROMPT
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

  let extracted: ExtractedAvailability;
  try {
    const parsed = JSON.parse(responseText);
    extracted = ExtractedAvailabilitySchema.parse(parsed);
  } catch (error) {
    console.error("Failed to parse/validate availability extraction:", error);
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Invalid AI extraction format",
    };
  }

  const missing = extracted.missingFields || [];
  if (!extracted.date && !missing.includes("date")) {
    missing.push("date");
  }

  if (missing.includes("date")) {
    const question = `Tanggal berapa lu pengen cek jadwal?`;
    
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
      message: "Butuh info lebih untuk cek ketersediaan",
      clarificationQuestion: question,
      data: extracted
    };
  }

  // Call the logic service
  const availabilityResult = await checkAvailability(userId, extracted);

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
    message: "Cek ketersediaan berhasil",
    clarificationQuestion: availabilityResult.message,
    data: {
      ...extracted,
      availabilityResult
    }
  };
}