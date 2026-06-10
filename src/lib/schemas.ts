import { z } from "zod";

// --- Enums ---

export const EntityStatusSchema = z.enum(["ACTIVE", "CANCELLED", "ARCHIVED", "MOVED"]);
export const TaskStatusSchema = z.enum(["TODO", "SCHEDULED", "DONE", "SKIPPED", "CANCELLED", "ARCHIVED"]);
export const PlanStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export const BlockTypeSchema = z.enum([
  "FIXED_EVENT",
  "TASK",
  "REST",
  "LEARNING",
  "FREE_TIME",
  "BUFFER",
  "PERSONAL",
  "SLEEP",
  "WIND_DOWN",
]);
export const InputStatusSchema = z.enum(["PENDING", "PROCESSING", "PROCESSED", "NEEDS_CLARIFICATION", "PENDING_CLARIFICATION", "PENDING_CONFIRMATION", "FAILED"]);

// --- Models ---

export const UserProfileSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(), // Make optional so client form doesn't need to inject it initially
  currentRole: z.string().optional().nullable(),
  currentPhase: z.string().optional().nullable(),
  passions: z.string().optional().nullable(),
  shortTermGoals: z.string().optional().nullable(),
  longTermGoals: z.string().optional().nullable(),
  priorities: z.string().optional().nullable(),
  productiveHours: z.string().optional().nullable(),
  lowEnergyHours: z.string().optional().nullable(),
  sleepPreference: z.string().optional().nullable(),
  freeTimePolicy: z.string().optional().nullable(),
  lifeConstraints: z.string().optional().nullable(),
});

export const FixedEventSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  startTime: z.date(),
  endTime: z.date(),
  location: z.string().optional().nullable(),
  status: EntityStatusSchema.default("ACTIVE"),
});

export const TaskSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  priority: z.number().int().default(1),
  dueDate: z.date().optional().nullable(),
  duration: z.number().int().optional().nullable(),
  status: TaskStatusSchema.default("TODO"),
});

export const DailyPlanSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  date: z.date(),
  status: PlanStatusSchema.default("DRAFT"),
});

export const ScheduleBlockSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  dailyPlanId: z.string(),
  blockType: BlockTypeSchema,
  title: z.string().min(1, "Title is required"),
  startTime: z.date(),
  endTime: z.date(),
  referenceId: z.string().optional().nullable(),
  isLocked: z.boolean().default(false),
});

export const CapturedInputSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  rawText: z.string().min(1, "Input text is required"),
  intentType: z.string().optional().nullable(),
  parsedJson: z.any().optional().nullable(), // Zod does not have a strict JSON type out of the box, using any for now
  confidence: z.number().optional().nullable(),
  status: InputStatusSchema.default("PENDING"),
  clarificationQuestion: z.string().optional().nullable(),
  missingFields: z.any().optional().nullable(),
});

export const CommandHistorySchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  rawText: z.string().min(1, "Input text is required"),
  intentType: z.string().optional().nullable(),
  confidence: z.number().optional().nullable(),
  matchedEntityType: z.string().optional().nullable(),
  matchedEntityId: z.string().optional().nullable(),
  actionStatus: z.string(),
  aiResponse: z.string().optional().nullable(),
  metadata: z.any().optional().nullable(),
});