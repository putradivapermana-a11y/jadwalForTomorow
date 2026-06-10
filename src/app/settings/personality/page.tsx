import { getProfile } from "@/app/actions/profile";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function PersonalitySettingsPage() {
  const profile = await getProfile();

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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Personality & Life Context</h3>
        <p className="text-sm text-muted-foreground">
          Update your profile so the AI scheduling engine understands your constraints and goals.
        </p>
      </div>
      <ProfileForm initialData={initialData} isOnboarding={false} />
    </div>
  );
}