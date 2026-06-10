import { askAIWithValidationMetadata } from "@/lib/ai/model-router";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const InterviewResponseSchema = z.object({
  aiResponse: z.string().describe("What the AI says back to the user to ask the next question, confirm info, or conclude."),
  isComplete: z.boolean().describe("True if the AI believes it has collected enough information to generate a good profile."),
  extractedData: z.record(z.string(), z.any()).optional().describe("Any structured data extracted from this specific message."),
});

export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;

export async function processInterviewStep(
  userId: string,
  userMessage: string,
  history: { role: "user" | "ai"; content: string }[]
): Promise<InterviewResponse> {
  const systemPrompt = `You are an AI assistant tasked with interviewing a user to build their schedule profile.
Your goal is to learn about their:
- Current Role & Phase in life
- Passions & Interests
- Short-term & Long-term goals
- Priorities
- Productive vs Low Energy Hours
- Sleep Preferences
- Free time policies & constraints

Instructions:
1. Be conversational, empathetic, and concise. MUST speak clearly in Bahasa Indonesia (with a slightly casual/professional tone).
2. Ask ONE topic at a time. Don't overwhelm them.
3. If they give vague answers, gently ask for clarification in Bahasa Indonesia.
4. Review the conversation history. If you have enough to form a complete profile, set 'isComplete' to true and say a concluding message in Bahasa Indonesia.
5. Extract key facts into 'extractedData' as you go (e.g., {"sleepPreference": "Needs 8 hours, sleeps at midnight"}).
`;

  const historyText = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join("\n");
  const fullPrompt = `History:\n${historyText}\n\nUSER: ${userMessage}`;

  const res = await askAIWithValidationMetadata({
    modelType: "fast",
    systemPrompt,
    userPrompt: fullPrompt,
    schema: InterviewResponseSchema,
  });

  if (!res.data) {
    throw new Error("Failed to process interview step");
  }

  // Record AI trace
  await prisma.onboardingSession.updateMany({
    where: { userId, status: "IN_PROGRESS" },
    data: {
      aiTrace: res.metadata as Record<string, any>
    }
  });

  return res.data;
}