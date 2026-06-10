import prisma from "@/lib/prisma";
import { askAI } from "@/lib/ai/model-router";
import { CANCEL_EXTRACTOR_PROMPT } from "./prompts";
import { CommandResult, ExtractedCancelSchema, ExtractedCancel } from "./types";
import { format } from "date-fns";
import { findMatchingEntities } from "@/lib/schedule/matching";

export async function handleCancelEvent(
  userId: string,
  rawText: string,
  capturedInputId: string
): Promise<CommandResult> {
  const now = new Date();

  const systemPrompt = CANCEL_EXTRACTOR_PROMPT
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

  let extracted: ExtractedCancel;
  try {
    const parsed = JSON.parse(responseText);
    extracted = ExtractedCancelSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to parse cancel extraction:", error);
    return {
      success: false,
      actionStatus: "FAILED",
      message: "Invalid AI extraction format",
    };
  }

  // Find match
  const matchResult = await findMatchingEntities(
    userId,
    extracted.targetType,
    extracted.title,
    extracted.date,
    extracted.time
  );

  if (matchResult.candidates.length === 0) {
    const msg = `Gua belum nemu ${extracted.targetType === "TASK" ? "tugas" : "jadwal"} yang cocok untuk di-cancel.`;
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
    
    const question = `Gua nemu beberapa jadwal. Pilih nomor yang mau dicancel:\n${choices.map(c => `${c.index}. ${c.label}`).join("\n")}`;
    
    await prisma.capturedInput.update({
      where: { id: capturedInputId },
      data: {
        status: "PENDING_CONFIRMATION",
        clarificationQuestion: question,
        parsedJson: {
          pendingAction: "CONFIRM_CANCEL",
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

  // One strong match -> ask confirmation
  const target = matchResult.bestMatch;
  const question = `Gua nemu "${target.title}" tanggal ${target.date || "tanpa tanggal"}${target.time ? ` jam ${target.time}` : ""}. Yakin mau cancel?`;

  await prisma.capturedInput.update({
    where: { id: capturedInputId },
    data: {
      status: "PENDING_CONFIRMATION",
      clarificationQuestion: question,
      parsedJson: {
        pendingAction: "CONFIRM_CANCEL",
        targetId: target.id,
        targetType: target.type,
        extracted: JSON.parse(JSON.stringify(extracted))
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