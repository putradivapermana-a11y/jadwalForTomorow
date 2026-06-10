import prisma from "@/lib/prisma";
import { getProfile } from "@/app/actions/profile";
import { notFound, redirect } from "next/navigation";
import { parseJakartaDate, formatJakarta } from "@/lib/schedule/date-utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditableTimeline } from "@/components/plan/EditableTimeline";
import { requireUser } from "@/lib/auth";

export default async function DailyPlanView({ params }: { params: Promise<{ date: string }> }) {
  await requireUser();
  const profile = await getProfile();
  if (!profile) {
    redirect("/onboarding");
  }

  const { date } = await params;
  const targetDate = parseJakartaDate(date);
  if (!targetDate) {
    notFound();
  }

  // Find plan
  const plan = await prisma.dailyPlan.findUnique({
    where: {
      userId_date: {
        userId: profile.userId,
        date: targetDate
      }
    },
    include: {
      blocks: {
        orderBy: { startTime: 'asc' }
      }
    }
  });

  if (!plan) {
    return (
      <div className="container py-12 text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">No Plan Found</h1>
        <p className="text-muted-foreground">Belum ada AI plan buat tanggal {formatJakarta(targetDate, "dd MMM yyyy")}.</p>
        <Link href="/plan/new">
          <Button>Generate Plan Sekarang</Button>
        </Link>
        <div className="mt-4">
          <Link href="/dashboard">
            <Button variant="ghost">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasBlocks = plan.blocks.length > 0;

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Plan: {formatJakarta(targetDate, "EEEE, dd MMM yyyy")}</h1>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>

      {hasBlocks ? (
        <EditableTimeline blocks={plan.blocks} planId={plan.id} dateStr={date} />
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg space-y-4">
          <p className="text-muted-foreground">Plan ini kosong (semua block sudah dihapus atau selesai).</p>
        </div>
      )}
    </div>
  );
}