import { getProfile } from "@/app/actions/profile";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { OnboardingChat } from "./OnboardingChat";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile();
  
  if (profile && profile.currentRole) {
    redirect("/");
  }

  const session = await prisma.onboardingSession.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  let initialMessages = session?.messages as { role: "user" | "ai", content: string }[];
  if (!initialMessages || initialMessages.length === 0) {
    initialMessages = [{ role: "ai", content: "Hi! I'm here to help set up your profile so I can plan your perfect schedule. To start, what do you currently do? (e.g., Student, Freelancer, Full-time Employee)" }];
  }

  const isReady = session?.status === "READY_FOR_REVIEW";

  const initialData = profile ? {
    currentRole: profile.currentRole || undefined,
    currentPhase: profile.currentPhase || undefined,
    passions: profile.passions || undefined,
    shortTermGoals: profile.shortTermGoals || undefined,
    longTermGoals: profile.longTermGoals || undefined,
    priorities: profile.priorities || undefined,
    productiveHours: profile.productiveHours || undefined,
    lowEnergyHours: profile.lowEnergyHours || undefined,
    sleepPreference: profile.sleepPreference || undefined,
    freeTimePolicy: profile.freeTimePolicy || undefined,
    lifeConstraints: profile.lifeConstraints || undefined,
  } : undefined;

  return (
    <div className="container max-w-3xl py-8 space-y-8 mx-auto">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Welcome to Jadwal</h1>
        <p className="text-muted-foreground text-lg">
          Before the AI can plan your days, it needs to understand who you are and how you work.
        </p>
      </div>

      <OnboardingChat 
        initialMessages={initialMessages} 
        isReady={isReady}
        extractedProfile={(session?.extractedProfile as Record<string, string | null>) || {}}
      />

      <div className="mt-12 opacity-50 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-semibold mb-4 text-center">Prefer manual entry?</h3>
        <ProfileForm initialData={initialData} isOnboarding={true} />
      </div>
    </div>
  );
}
