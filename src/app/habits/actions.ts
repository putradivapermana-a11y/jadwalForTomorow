"use server";

import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getJakartaNow, startOfJakartaDay } from "@/lib/schedule/date-utils";
import { HabitLogStatus } from "@prisma/client";

export async function createHabitAction(formData: FormData) {
  try {
    const user = await requireUser();
    const title = formData.get("title") as string;
    const category = formData.get("category") as string | null;
    const targetFrequency = formData.get("targetFrequency") as string | null;
    const preferredTime = formData.get("preferredTime") as string | null;

    if (!title || title.trim() === "") {
      return { success: false, message: "Judul habit wajib diisi." };
    }

    await prisma.habit.create({
      data: {
        userId: user.id,
        title,
        category,
        targetFrequency,
        preferredTime,
      }
    });

    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true, message: "Habit berhasil dibuat." };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Gagal membuat habit." };
  }
}

export async function markHabitAction(habitId: string, status: HabitLogStatus) {
  try {
    const user = await requireUser();
    const now = getJakartaNow();
    const today = startOfJakartaDay(now);

    // Verify habit belongs to user
    const habit = await prisma.habit.findUnique({
      where: { id: habitId, userId: user.id }
    });

    if (!habit) {
      return { success: false, message: "Habit tidak ditemukan." };
    }

    await prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: today
        }
      },
      update: {
        status
      },
      create: {
        userId: user.id,
        habitId,
        date: today,
        status
      }
    });

    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Gagal update habit." };
  }
}

export async function toggleHabitActiveAction(habitId: string, isActive: boolean) {
  try {
    const user = await requireUser();
    await prisma.habit.update({
      where: { id: habitId, userId: user.id },
      data: { isActive }
    });
    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Gagal ubah status habit." };
  }
}