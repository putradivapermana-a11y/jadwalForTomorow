import { z } from "zod";

export const userProfileSchema = z.object({
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

export type UserProfileFormValues = z.infer<typeof userProfileSchema>;