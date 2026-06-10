import { askAIWithValidationMetadata } from "@/lib/ai/model-router";
import { z } from "zod";

export const ProfileExtractionSchema = z.object({
  currentRole: z.string().optional(),
  currentPhase: z.string().optional(),
  passions: z.string().optional(),
  shortTermGoals: z.string().optional(),
  longTermGoals: z.string().optional(),
  priorities: z.string().optional(),
  productiveHours: z.string().optional(),
  lowEnergyHours: z.string().optional(),
  sleepPreference: z.string().optional(),
  freeTimePolicy: z.string().optional(),
  lifeConstraints: z.string().optional(),
});

export type ExtractedProfile = z.infer<typeof ProfileExtractionSchema>;

export async function extractFinalProfile(
  history: { role: "user" | "ai"; content: string }[]
): Promise<ExtractedProfile> {
  const systemPrompt = `You are a data extraction AI. Read the following interview transcript and extract a comprehensive User Profile.
If a piece of information is missing or unclear, leave the field undefined/null.
Synthesize the information clearly and concisely. Keep the tone objective.`;

  const historyText = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join("\n");
  
  const res = await askAIWithValidationMetadata({
    modelType: "worker",
    systemPrompt,
    userPrompt: `Interview Transcript:\n${historyText}\n\nExtract the profile fields now.`,
    schema: ProfileExtractionSchema,
  });

  if (!res.data) {
    throw new Error("Failed to extract final profile");
  }

  return res.data;
}