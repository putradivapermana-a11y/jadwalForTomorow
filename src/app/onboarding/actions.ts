"use server";

import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { processInterviewStep } from "@/lib/profile/interview";
import { extractFinalProfile } from "@/lib/profile/profile-extractor";

export async function submitInterviewMessage(message: string) {
  const user = await requireUser();

  let session = await prisma.onboardingSession.findFirst({
    where: { userId: user.id, status: "IN_PROGRESS" },
  });

  if (!session) {
    session = await prisma.onboardingSession.create({
      data: {
        userId: user.id,
        messages: [{ role: "ai", content: "Hi! I'm here to help set up your profile so I can plan your perfect schedule. To start, what do you currently do? (e.g., Student, Freelancer, Full-time Employee)" }],
      },
    });
  }

  const messages = session.messages as { role: "user" | "ai"; content: string }[];
  messages.push({ role: "user", content: message });

  const aiResponse = await processInterviewStep(user.id, message, messages);
  
  messages.push({ role: "ai", content: aiResponse.aiResponse });

  await prisma.onboardingSession.update({
    where: { id: session.id },
    data: {
      messages,
      status: aiResponse.isComplete ? "READY_FOR_REVIEW" : "IN_PROGRESS",
    },
  });

  if (aiResponse.isComplete) {
    const extracted = await extractFinalProfile(messages);
    await prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        extractedProfile: extracted,
      },
    });
  }
}

export async function finishOnboarding(formData: FormData) {
  const user = await requireUser();
  const session = await prisma.onboardingSession.findFirst({
    where: { userId: user.id, status: "READY_FOR_REVIEW" },
  });

  if (!session || !session.extractedProfile) {
    throw new Error("No completed session found");
  }

  const p = session.extractedProfile as any;
  
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      currentRole: p.currentRole || "User",
      currentPhase: p.currentPhase || "",
      passions: p.passions || "",
      shortTermGoals: p.shortTermGoals || "",
      longTermGoals: p.longTermGoals || "",
      priorities: p.priorities || "",
      productiveHours: p.productiveHours || "",
      lowEnergyHours: p.lowEnergyHours || "",
      sleepPreference: p.sleepPreference || "",
      freeTimePolicy: p.freeTimePolicy || "",
      lifeConstraints: p.lifeConstraints || "",
    },
    update: {
      currentRole: p.currentRole,
      currentPhase: p.currentPhase,
      passions: p.passions,
      shortTermGoals: p.shortTermGoals,
      longTermGoals: p.longTermGoals,
      priorities: p.priorities,
      productiveHours: p.productiveHours,
      lowEnergyHours: p.lowEnergyHours,
      sleepPreference: p.sleepPreference,
      freeTimePolicy: p.freeTimePolicy,
      lifeConstraints: p.lifeConstraints,
    },
  });

  await prisma.onboardingSession.update({
    where: { id: session.id },
    data: { status: "COMPLETED" },
  });
}