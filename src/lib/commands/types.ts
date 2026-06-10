import { z } from "zod";

export const IntentTypeSchema = z.enum([
  "CREATE_EVENT",
  "CREATE_TASK",
  "CREATE_DEADLINE",
  "CHECK_AVAILABILITY",
  "CANCEL_EVENT",
  "RESCHEDULE_EVENT",
  "UNKNOWN"
]);

export type IntentType = z.infer<typeof IntentTypeSchema>;

export const ClassifiedIntentSchema = z.object({
  intentType: IntentTypeSchema,
  confidence: z.number().min(0).max(1),
  entities: z.record(z.string(), z.unknown()).optional(),
  missingFields: z.array(z.string()),
  needsClarification: z.boolean()
});

export type ClassifiedIntent = z.infer<typeof ClassifiedIntentSchema>;

export const ExtractedEventSchema = z.object({
  entityType: z.literal("FIXED_EVENT"),
  title: z.string(),
  category: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // YYYY-MM-DD
  startTime: z.string().optional().nullable(), // HH:MM
  endTime: z.string().optional().nullable(), // HH:MM
  isLocked: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string())
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

export const ExtractedTaskSchema = z.object({
  entityType: z.enum(["TASK", "DEADLINE"]),
  title: z.string(),
  category: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // YYYY-MM-DD
  time: z.string().optional().nullable(), // HH:MM
  priority: z.number().int().min(1).max(5).default(1),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string())
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

export const ExtractedAvailabilitySchema = z.object({
  entityType: z.literal("AVAILABILITY_QUERY"),
  date: z.string().optional().nullable(), // YYYY-MM-DD
  startTime: z.string().optional().nullable(), // HH:MM
  endTime: z.string().optional().nullable(), // HH:MM
  partOfDay: z.enum(["pagi", "siang", "sore", "malam"]).optional().nullable(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string())
});

export type ExtractedAvailability = z.infer<typeof ExtractedAvailabilitySchema>;

export const ExtractedCancelSchema = z.object({
  entityType: z.literal("CANCEL_REQUEST"),
  targetType: z.enum(["EVENT", "TASK", "DEADLINE", "UNKNOWN"]).default("UNKNOWN"),
  title: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string())
});

export type ExtractedCancel = z.infer<typeof ExtractedCancelSchema>;

export const ExtractedRescheduleSchema = z.object({
  entityType: z.literal("RESCHEDULE_REQUEST"),
  targetTitle: z.string().optional().nullable(),
  oldDate: z.string().optional().nullable(),
  oldTime: z.string().optional().nullable(),
  newDate: z.string().optional().nullable(),
  newTime: z.string().optional().nullable(),
  newPartOfDay: z.enum(["pagi", "siang", "sore", "malam"]).optional().nullable(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string())
});

export type ExtractedReschedule = z.infer<typeof ExtractedRescheduleSchema>;

export interface CommandResult {
  success: boolean;
  intentType?: IntentType;
  actionStatus: string;
  message: string;
  clarificationQuestion?: string;
  choices?: Array<{ id: string; label: string; index: number }>;
  data?: unknown;
}
