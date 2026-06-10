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
    initialMessages = [{ role: "ai", content: "Halo! Aku asisten AI-mu. Agar aku bisa menyusun jadwal terbaik, ceritakan sedikit tentang dirimu. Apa kesibukan utamamu saat ini? (Contoh: Mahasiswa, Freelancer, Pegawai)" }];
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
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {!isReady && (
        <div className="px-4 pt-8 pb-4 shrink-0">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Kenalan Dulu</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ngobrol sebentar biar aku bisa menyesuaikan gaya jadwalmu.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col relative w-full max-w-md mx-auto">
        <OnboardingChat 
          initialMessages={initialMessages} 
          isReady={isReady}
          extractedProfile={(session?.extractedProfile as Record<string, string | null>) || {}}
        />
      </div>

      {isReady && (
        <div className="mt-8 px-4 pb-12 w-full max-w-md mx-auto">
          <h3 className="text-sm font-semibold mb-3 text-center text-muted-foreground uppercase tracking-wider">Atau Isi Manual</h3>
          <div className="opacity-70 hover:opacity-100 transition-opacity">
            <ProfileForm initialData={initialData} isOnboarding={true} />
          </div>
        </div>
      )}
    </div>
  );
}