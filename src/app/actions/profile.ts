"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getDevUserId } from "@/lib/auth";
import { userProfileSchema, UserProfileFormValues } from "@/lib/validations/profile";

export async function saveProfile(data: UserProfileFormValues) {
  try {
    const userId = await getDevUserId();
    const validatedData = userProfileSchema.parse(data);

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: validatedData,
      create: {
        userId,
        ...validatedData,
      },
    });

    revalidatePath("/");
    revalidatePath("/settings/personality");
    
    return { success: true, profile };
  } catch (error) {
    console.error("Failed to save profile:", error);
    return { success: false, error: "Failed to save profile" };
  }
}

export async function getProfile() {
  try {
    const userId = await getDevUserId();
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });
    return profile;
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
}