import { askAI } from "@/lib/ai/model-router";
import { INTENT_CLASSIFIER_PROMPT } from "./prompts";
import { CommandResult, ClassifiedIntentSchema, ClassifiedIntent } from "./types";
import { handleCreateEvent } from "./create-event-handler";
import { handleCreateTask } from "./create-task-handler";
import { handleCheckAvailability } from "./check-availability-handler";
import { handleCancelEvent } from "./cancel-event-handler";
import { handleRescheduleEvent } from "./reschedule-event-handler";
import prisma from "@/lib/prisma";
import { PART_OF_DAY_RANGES } from "@/lib/schedule/availability";

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
      await prisma.fixedEvent.update({
        where: { id: parsed.targetId },
        data: { status: "CANCELLED" }
      });
      // Try delete related block
      await prisma.scheduleBlock.deleteMany({
        where: { referenceId: parsed.targetId, blockType: "FIXED_EVENT" }
      });
    } else {
      await prisma.task.update({
        where: { id: parsed.targetId },
        data: { status: "CANCELLED" }
      });
      await prisma.scheduleBlock.deleteMany({
        where: { referenceId: parsed.targetId, blockType: "TASK" }
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
      const startTime = new Date(`${newDate}T${timeStr}:00`);
      const endTime = new Date(startTime.getTime() + durationMins * 60000);

      await prisma.fixedEvent.update({
        where: { id: parsed.targetId },
        data: { startTime, endTime }
      });

      await prisma.scheduleBlock.updateMany({
        where: { referenceId: parsed.targetId, blockType: "FIXED_EVENT" },
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

  return null;
}

export async function processCommand(userId: string, rawText: string): Promise<CommandResult> {
  // 0. Check pending confirmations
  const pending = await prisma.capturedInput.findFirst({
    where: { userId, status: "PENDING_CONFIRMATION" },
    orderBy: { createdAt: "desc" }
  });

  // 1. Initial capture
  const capturedInput = await prisma.capturedInput.create({
    data: {
      userId,
      rawText,
      status: "PROCESSING"
    }
  });

  try {
    // 2. Classify intent
    const responseText = await askAI({
      modelType: 'fast',
      systemPrompt: INTENT_CLASSIFIER_PROMPT,
      userPrompt: rawText,
      responseFormat: 'json_object'
    });

    if (!responseText) {
      throw new Error("AI classification returned empty");
    }

    const parsed = JSON.parse(responseText);
    const intent: ClassifiedIntent = ClassifiedIntentSchema.parse(parsed);

    // Resolve pending confirmation if active
    if (pending) {
      const resolved = await resolvePendingConfirmation(userId, rawText, pending);
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
        // We still created a new capturedInput (PROCESSING), let's mark it processed since it acted as a reply
        await prisma.capturedInput.update({
          where: { id: capturedInput.id },
          data: { status: "PROCESSED", intentType: "CONFIRMATION_REPLY" }
        });
        return resolved;
      } else {
        // User ignored the pending confirmation, cancel it
        await prisma.capturedInput.update({
          where: { id: pending.id },
          data: { status: "FAILED" } // or processed/ignored
        });
      }
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

    // 4. Save to CommandHistory
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
        metadata: result.data ? JSON.parse(JSON.stringify(result.data)) : undefined
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