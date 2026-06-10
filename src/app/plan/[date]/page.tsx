import prisma from "@/lib/prisma";
import { getProfile } from "@/app/actions/profile";
import { notFound, redirect } from "next/navigation";
import { parseJakartaDate, formatJakarta } from "@/lib/schedule/date-utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EditableTimeline } from "@/components/plan/EditableTimeline";
import { requireUser } from "@/lib/auth";
import { ArrowLeft, Calendar } from "lucide-react";

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
      <div className="flex flex-col gap-6 px-4 py-8 items-center text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-2">
          <Calendar className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Belum ada Plan</h1>
          <p className="text-sm text-muted-foreground">Belum ada jadwal harian untuk {formatJakarta(targetDate, "dd MMM yyyy")}.</p>
        </div>
        <Link href="/plan/new" className="w-full sm:w-auto mt-4">
          <Button className="w-full sm:w-auto">Generate Plan Sekarang</Button>
        </Link>
        <Link href="/dashboard" className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full sm:w-auto">Kembali ke Dashboard</Button>
        </Link>
      </div>
    );
  }

  const hasBlocks = plan.blocks.length > 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" className="shrink-0 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight line-clamp-1">Plan {formatJakarta(targetDate, "dd MMM")}</h1>
          <p className="text-xs text-muted-foreground">{formatJakarta(targetDate, "EEEE, dd MMMM yyyy")}</p>
        </div>
      </div>

      {hasBlocks ? (
        <EditableTimeline blocks={plan.blocks} planId={plan.id} dateStr={date} />
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-xl space-y-3">
          <p className="text-sm text-muted-foreground">Plan ini kosong (semua block sudah dihapus).</p>
        </div>
      )}
    </div>
  );
}