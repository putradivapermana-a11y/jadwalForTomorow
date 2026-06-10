"use server";

import { requireUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getJakartaNow, startOfJakartaDay } from "@/lib/schedule/date-utils";
import { revalidatePath } from "next/cache";
import { extractDailyNoteInsights } from "@/lib/profile/daily-note-insights";
import { Prisma } from "@prisma/client";

export async function saveTodayDailyNoteAction(formData: FormData) {
  try {
    const user = await requireUser();
    
    const rawText = formData.get("rawText") as string;
    const mood = formData.get("mood") as string | null;
    const energyLevelStr = formData.get("energyLevel") as string | null;
    
    if (!rawText || rawText.trim() === "") {
      return { success: false, message: "Catatan tidak boleh kosong." };
    }

    const energyLevel = energyLevelStr ? parseInt(energyLevelStr, 10) : null;
    
    const jakartaNow = getJakartaNow();
    const today = startOfJakartaDay(jakartaNow);

    // Initial save (without AI processing to ensure it's saved quickly)
    const dailyNote = await prisma.dailyNote.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      },
      update: {
        rawText,
        mood: mood || null,
        energyLevel: energyLevel && energyLevel >= 1 && energyLevel <= 10 ? energyLevel : null,
      },
      create: {
        userId: user.id,
        date: today,
        rawText,
        mood: mood || null,
        energyLevel: energyLevel && energyLevel >= 1 && energyLevel <= 10 ? energyLevel : null,
      }
    });

    // Run AI Extractor asynchronously if not pure empty
    const insightResult = await extractDailyNoteInsights(rawText);
    
    if (insightResult.data) {
      // Update with AI insight
      await prisma.dailyNote.update({
        where: { id: dailyNote.id },
        data: {
          highlights: insightResult.data.highlights as Prisma.InputJsonValue,
          struggles: insightResult.data.struggles as Prisma.InputJsonValue,
          learnedAboutUser: insightResult.data.learnedAboutUser as Prisma.InputJsonValue,
          suggestedProfileUpdates: insightResult.data.suggestedProfileUpdates as Prisma.InputJsonValue,
          aiTrace: insightResult.metadata as unknown as Prisma.InputJsonValue
        }
      });
    }

    revalidatePath("/");
    revalidatePath("/notes");

    return { success: true, message: "Catatan berhasil disimpan." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan catatan.";
    return { success: false, message };
  }
}

export async function getLatestDailyNotesAction(limit = 3) {
  try {
    const user = await requireUser();
    
    const notes = await prisma.dailyNote.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: limit
    });
    
    return { success: true, data: notes };
  } catch {
    return { success: false, message: "Gagal mengambil catatan.", data: [] };
  }
}
