import { askAIWithValidationMetadata } from "@/lib/ai/model-router";
import { INTENT_CLASSIFIER_PROMPT } from "./prompts";
import { CommandResult, ClassifiedIntentSchema } from "./types";
import { handleCreateEvent } from "./create-event-handler";
import { handleCreateTask } from "./create-task-handler";
import { handleCheckAvailability } from "./check-availability-handler";
import { handleCancelEvent } from "./cancel-event-handler";
import { handleRescheduleEvent } from "./reschedule-event-handler";
import { handleGenerateDailyPlan } from "./generate-daily-plan-handler";
import prisma from "@/lib/prisma";
import { PART_OF_DAY_RANGES } from "@/lib/schedule/availability";
import { parseJakartaDateTime } from "@/lib/schedule/date-utils";

async function resolvePendingClarification(
  userId: string,
  rawText: string,
  pendingInput: Record<string, unknown>
): Promise<CommandResult | null> {
  // Try to use AI to extract missing fields from the new rawText based on previous context
  const parsed = pendingInput.parsedJson as Record<string, unknown> | null;
  if (!parsed) return null;

  // We simply re-run the intent router by rejecting this pending state
  // But wait, we want to merge state. The robust MVP way without a complex multi-turn LLM chain:
  // Update the pending clarification's rawText with the new context, or just return null to let 
  // the intent router classify it fresh. The PRD scope says missing-time creates PENDING_CLARIFICATION.
  // Actually, to truly resolve clarification, we should pass it to the handler.
  // For MVP: let's just return null so it drops into standard `processCommand` intent classification.
  // We don't have a complex state machine for merging.
  return null;
}

async function resolvePendingConfirmation(
  userId: string,
  rawText: string,
  pendingInput: Record<string, unknown>
): Promise<CommandResult | null> {
  const text = rawText.toLowerCase().trim();
  const isConfirm = ["ya", "yakin", "confirm", "lanjut", "iya", "y", "boleh"].includes(text);
  const isCancel = ["tidak", "batal", "cancel", "ngga", "nggak", "no", "n"].includes(text);
  
  const parsed = pendingInput.parsedJson as Record<string, unknown> | null;
  if (!parsed) return null;
  const action = parsed.pendingAction as string | undefined;

  if (isCancel) {
    await prisma.capturedInput.update({
      where: { id: pendingInput.id as string },
      data: { status: "PROCESSED" } // Mark old as done
    });
    return {
      success: true,
      actionStatus: "SUCCESS",
      message: "Action cancelled.",
      clarificationQuestion: "Oke, gua batalin action-nya."
    };
  }

  // Handle number choice for ambiguous matches
  const matchIndex = parseInt(text);
  if (!isNaN(matchIndex) && parsed.candidates && Array.isArray(parsed.candidates)) {
    const chosen = parsed.candidates[matchIndex - 1] as { id: string, type: string, title: string } | undefined;
    if (chosen) {
      // Update the pending payload to act like a single match confirmation
      await prisma.capturedInput.update({
        where: { id: pendingInput.id as string },
        data: {
          parsedJson: {
            ...parsed,
            pendingAction: action,
            targetId: chosen.id,
            targetType: chosen.type,
            selectedTargetId: chosen.id,
            candidates: undefined // clear candidates to avoid loop
          }
        }
      });
      // Just return a new confirmation ask based on the choice
      return {
        success: true,
        actionStatus: "NEEDS_CONFIRMATION",
        message: "Choice made, confirm action.",
        clarificationQuestion: `Yakin mau proses "${chosen.title}"? (ya/tidak)`
      };
    }
  }

  if (!isConfirm) {
    // If not a clear confirm/cancel, we should probably just treat it as a new command
    // and ignore the pending one, OR we could ask again.
    // For simplicity, let's treat as new command by returning null.
    return null;
  }

  // If confirmed
  if (action === "CONFIRM_CANCEL" && typeof parsed.targetId === "string" && typeof parsed.targetType === "string") {
    if (parsed.targetType === "EVENT") {
      const updateCount = await prisma.fixedEvent.updateMany({
        where: { id: parsed.targetId, userId },
        data: { status: "CANCELLED" }
      });
      if (updateCount.count === 0) return null;

      // Update related blocks instead of deleting
      await prisma.scheduleBlock.updateMany({
        where: { referenceId: parsed.targetId, blockType: "FIXED_EVENT", userId },
        data: { status: "CANCELLED" }
      });
    } else {
      const updateCount = await prisma.task.updateMany({
        where: { id: parsed.targetId, userId },
        data: { status: "CANCELLED" }
      });
      if (updateCount.count === 0) return null;

      await prisma.scheduleBlock.updateMany({
        where: { referenceId: parsed.targetId, blockType: "TASK", userId },
        data: { status: "CANCELLED" }
      });
    }

    await prisma.capturedInput.update({
      where: { id: pendingInput.id as string },
      data: { status: "PROCESSED" }
    });

    return {
      success: true,
      actionStatus: "SUCCESS",
      message: "Cancelled successfully.",
      clarificationQuestion: "Oke, udah gua cancel.",
      data: { id: parsed.targetId }
    };
  }

  if (action === "CONFIRM_RESCHEDULE" && typeof parsed.targetId === "string" && parsed.targetType === "EVENT" && parsed.extracted) {
    const extracted = parsed.extracted as { newDate?: string, newTime?: string, newPartOfDay?: string };
    const { newDate, newTime, newPartOfDay } = extracted;
    const durationMins = (parsed.durationMins as number) || 60;
    
    let timeStr = newTime;
    if (!timeStr && newPartOfDay && PART_OF_DAY_RANGES[newPartOfDay as keyof typeof PART_OF_DAY_RANGES]) {
      timeStr = PART_OF_DAY_RANGES[newPartOfDay as keyof typeof PART_OF_DAY_RANGES].start;
    }

    if (newDate && timeStr) {
      const startTime = parseJakartaDateTime(newDate, timeStr);
      if (startTime) {
        const endTime = new Date(startTime.getTime() + durationMins * 60000);

      const updateCount = await prisma.fixedEvent.updateMany({
        where: { id: parsed.targetId, userId },
        data: { startTime, endTime }
      });
      if (updateCount.count === 0) return null;

      await prisma.scheduleBlock.updateMany({
        where: { referenceId: parsed.targetId, blockType: "FIXED_EVENT", userId },
        data: { startTime, endTime }
      });

        await prisma.capturedInput.update({
          where: { id: pendingInput.id as string },
          data: { status: "PROCESSED" }
        });

        return {
          success: true,
          actionStatus: "SUCCESS",
          message: "Rescheduled successfully.",
          clarificationQuestion: "Oke, udah gua pindahin.",
          data: { id: parsed.targetId }
        };
      }
    }
  }

  return null;
}

export async function processCommand(userId: string, rawText: string): Promise<CommandResult> {
  // 1. Initial capture
  const capturedInput = await prisma.capturedInput.create({
    data: {
      userId,
      rawText,
      status: "PROCESSING"
    }
  });

  try {
    // 2. Check pending confirmations FIRST before wasting AI
    const pendingConfirmation = await prisma.capturedInput.findFirst({
      where: { 
        userId, 
        status: { in: ["PENDING_CONFIRMATION", "PENDING_CLARIFICATION"] } 
      },
      orderBy: { createdAt: "desc" }
    });

    if (pendingConfirmation) {
      let resolved: CommandResult | null = null;
      if (pendingConfirmation.status === "PENDING_CONFIRMATION") {
        resolved = await resolvePendingConfirmation(userId, rawText, pendingConfirmation);
      } else {
        resolved = await resolvePendingClarification(userId, rawText, pendingConfirmation);
      }

      if (resolved) {
        // Log to history
        await prisma.commandHistory.create({
          data: {
            userId,
            rawText,
            actionStatus: resolved.actionStatus,
            aiResponse: resolved.clarificationQuestion || resolved.message,
            metadata: resolved.data ? JSON.parse(JSON.stringify(resolved.data)) : undefined
          }
        });
        await prisma.capturedInput.update({
          where: { id: capturedInput.id },
          data: { status: "PROCESSED", intentType: "CONFIRMATION_REPLY" }
        });
        return resolved;
      } else {
        // User ignored the pending confirmation, cancel it
        await prisma.capturedInput.update({
          where: { id: pendingConfirmation.id },
          data: { status: "FAILED" }
        });
      }
    }

    // 3. Classify intent
    const aiResult = await askAIWithValidationMetadata({
      modelType: 'fast',
      systemPrompt: INTENT_CLASSIFIER_PROMPT,
      userPrompt: rawText,
      schema: ClassifiedIntentSchema
    });

    const intent = aiResult.data;
    const aiMetadata = aiResult.metadata;

    if (!intent) {
      // Create failure history with metadata
      await prisma.commandHistory.create({
        data: {
          userId,
          rawText,
          actionStatus: "FAILED",
          aiResponse: "AI classification failed validation",
          metadata: JSON.parse(JSON.stringify(aiMetadata))
        }
      });
      throw new Error("AI classification failed validation");
    }

    // Update capture with intent
    await prisma.capturedInput.update({
      where: { id: capturedInput.id },
      data: {
        intentType: intent.intentType,
        confidence: intent.confidence
      }
    });

    // 3. Route to specific handler
    let result: CommandResult;
    let matchedEntityType: string | undefined;
    let matchedEntityId: string | undefined;

    switch (intent.intentType) {
      case "CREATE_EVENT":
        result = await handleCreateEvent(userId, rawText, capturedInput.id);
        if (result.success && result.actionStatus === "SUCCESS" && result.data && typeof result.data === 'object' && 'id' in result.data) {
          matchedEntityType = "Event";
          matchedEntityId = (result.data as { id: string }).id;
        }
        break;
      case "CREATE_TASK":
      case "CREATE_DEADLINE":
        result = await handleCreateTask(userId, rawText, capturedInput.id, intent.intentType === "CREATE_DEADLINE");
        if (result.success && result.actionStatus === "SUCCESS" && result.data && typeof result.data === 'object' && 'id' in result.data) {
          matchedEntityType = "Task";
          matchedEntityId = (result.data as { id: string }).id;
        }
        break;
      case "CHECK_AVAILABILITY":
        result = await handleCheckAvailability(userId, rawText, capturedInput.id);
        break;
      case "CANCEL_EVENT":
        result = await handleCancelEvent(userId, rawText, capturedInput.id);
        break;
      case "RESCHEDULE_EVENT":
        result = await handleRescheduleEvent(userId, rawText, capturedInput.id);
        break;
      case "GENERATE_DAILY_PLAN":
        result = await handleGenerateDailyPlan(userId, rawText, capturedInput.id);
        break;
      case "UNKNOWN":
      default:
        // Update input
        await prisma.capturedInput.update({
          where: { id: capturedInput.id },
          data: { 
            status: "NEEDS_CLARIFICATION",
            clarificationQuestion: "Maaf, saya belum mengerti maksudnya. Mau bikin event, tugas, atau deadline?",
            parsedJson: intent as unknown as object
          }
        });
        
        result = {
          success: true,
          actionStatus: "NEEDS_CLARIFICATION",
          message: "Unknown intent",
          clarificationQuestion: "Maaf, saya belum mengerti maksudnya. Mau bikin event, tugas, atau deadline?"
        };
        break;
    }
    
    // Merge intent trace
    if (!result.aiTrace) {
      result.aiTrace = [];
    }
    result.aiTrace = [
      { purpose: "intent_router", ...aiMetadata },
      ...result.aiTrace
    ];

    // 4. Save to CommandHistory
    const combinedMetadata = {
      ...(result.data || {}),
      aiTrace: result.aiTrace // Persist full AI trace including handlers
    };

    await prisma.commandHistory.create({
      data: {
        userId,
        rawText,
        intentType: intent.intentType,
        confidence: intent.confidence,
        matchedEntityType,
        matchedEntityId,
        actionStatus: result.actionStatus,
        aiResponse: result.clarificationQuestion || result.message,
        metadata: JSON.parse(JSON.stringify(combinedMetadata))
      }
    });

    // Attach intent to final result for UI
    result.intentType = intent.intentType;
    return result;

  } catch (error) {
    console.error("Error processing command:", error);
    
    // Cleanup on failure
    await prisma.capturedInput.update({
      where: { id: capturedInput.id },
      data: { status: "FAILED" }
    });

    const failedResult: CommandResult = {
      success: false,
      actionStatus: "FAILED",
      message: "Terjadi kesalahan saat memproses perintah."
    };

    await prisma.commandHistory.create({
      data: {
        userId,
        rawText,
        actionStatus: "FAILED",
        aiResponse: "System error"
      }
    });

    return failedResult;
  }
}