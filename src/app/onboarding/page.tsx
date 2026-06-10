import { getProfile } from "@/app/actions/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const profile = await getProfile();
  
  // If user already has a profile with a role, assume onboarding is done
  if (profile?.currentRole) {
    redirect("/");
  }

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
    <div className="container max-w-4xl py-10 mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Jadwal!</h1>
          <p className="text-muted-foreground">
            Let&apos;s get to know you better. The AI will use this personality profile to tailor your schedule uniquely to you.
          </p>
        </div>
        <ProfileForm initialData={initialData} isOnboarding={true} />
      </div>
    </div>
  );
}