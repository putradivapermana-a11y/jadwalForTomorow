import prisma from "@/lib/prisma";
import { parseISO, format } from "date-fns";

export interface MatchCandidate {
  id: string;
  type: "EVENT" | "TASK";
  title: string;
  date: string | null;
  time: string | null;
  confidence: number;
  originalEntity: Record<string, unknown>;
}

export interface MatchResult {
  bestMatch: MatchCandidate | null;
  candidates: MatchCandidate[];
  isAmbiguous: boolean;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const words1 = s1.split(" ");
  const words2 = s2.split(" ");
  const intersection = words1.filter(w => words2.includes(w));
  return intersection.length / Math.max(words1.length, words2.length);
}

export async function findMatchingEntities(
  userId: string,
  targetType: "EVENT" | "TASK" | "DEADLINE" | "UNKNOWN",
  title: string | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined
): Promise<MatchResult> {
  const candidates: MatchCandidate[] = [];
  
  // Base date range: if specific date provided use that, else upcoming 30 days
  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  let endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 30);

  if (date) {
    startDate = parseISO(`${date}T00:00:00`);
    endDate = parseISO(`${date}T23:59:59`);
  }

  // 1. Search FixedEvents if applicable
  if (targetType === "EVENT" || targetType === "UNKNOWN") {
    const events = await prisma.fixedEvent.findMany({
      where: {
        userId,
        status: "ACTIVE",
        startTime: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    for (const event of events) {
      let confidence = 0;

      if (title) {
        const titleSim = calculateStringSimilarity(title, event.title);
        confidence += titleSim * 0.6;
      } else {
        confidence += 0.3; // Give baseline if no title but date/time match
      }

      if (date) {
        const eventDate = format(event.startTime, "yyyy-MM-dd");
        if (eventDate === date) {
          confidence += 0.2;
        } else {
          confidence -= 0.5; // Penalty for wrong date
        }
      }

      if (time) {
        const eventTime = format(event.startTime, "HH:mm");
        if (eventTime === time) {
          confidence += 0.2;
        } else {
          // Check proximity
          const targetMin = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]);
          const eventMin = parseInt(eventTime.split(":")[0]) * 60 + parseInt(eventTime.split(":")[1]);
          if (Math.abs(targetMin - eventMin) <= 60) {
            confidence += 0.1;
          } else {
            confidence -= 0.3;
          }
        }
      }

      if (confidence > 0.4) {
        candidates.push({
          id: event.id,
          type: "EVENT",
          title: event.title,
          date: format(event.startTime, "yyyy-MM-dd"),
          time: format(event.startTime, "HH:mm"),
          confidence: Math.min(1.0, confidence),
          originalEntity: event
        });
      }
    }
  }

  // 2. Search Tasks if applicable
  if (targetType === "TASK" || targetType === "DEADLINE" || targetType === "UNKNOWN") {
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        status: { in: ["TODO", "SCHEDULED"] }
      }
    });

    for (const task of tasks) {
      let confidence = 0;
      
      if (title) {
        const titleSim = calculateStringSimilarity(title, task.title);
        confidence += titleSim * 0.7;
      }

      if (date && task.dueDate) {
        const taskDate = format(task.dueDate, "yyyy-MM-dd");
        if (taskDate === date) {
          confidence += 0.3;
        } else {
          confidence -= 0.4;
        }
      }

      if (confidence > 0.4) {
        candidates.push({
          id: task.id,
          type: "TASK",
          title: task.title,
          date: task.dueDate ? format(task.dueDate, "yyyy-MM-dd") : null,
          time: task.dueDate ? format(task.dueDate, "HH:mm") : null,
          confidence: Math.min(1.0, confidence),
          originalEntity: task
        });
      }
    }
  }

  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return { bestMatch: null, candidates: [], isAmbiguous: false };
  }

  if (candidates.length === 1) {
    return { bestMatch: candidates[0], candidates, isAmbiguous: false };
  }

  // Check ambiguity
  const topConfidence = candidates[0].confidence;
  const secondConfidence = candidates[1].confidence;
  const isAmbiguous = (topConfidence - secondConfidence) < 0.2;

  return {
    bestMatch: isAmbiguous ? null : candidates[0],
    candidates,
    isAmbiguous
  };
}