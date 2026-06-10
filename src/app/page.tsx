import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getProfile } from "@/app/actions/profile";
import { CommandBox } from "@/components/dashboard/CommandBox";
import { DailyNoteCard } from "@/components/dashboard/DailyNoteCard";
import { HabitCard } from "@/components/dashboard/HabitCard";
import prisma from "@/lib/prisma";
import { getJakartaNow, startOfJakartaDay, formatJakarta } from "@/lib/schedule/date-utils";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScheduleBlock } from "@prisma/client";

export default async function Dashboard() {
  await requireUser();
  const profile = await getProfile();
  const needsOnboarding = !profile || !profile.currentRole;

  if (needsOnboarding) {
    redirect("/onboarding");
  }

  const jakartaNow = getJakartaNow();
  const today = startOfJakartaDay(jakartaNow);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let displayPlan = null;
  let planLabel = "";
  
  const todayNote = await prisma.dailyNote.findUnique({
    where: {
      userId_date: {
        userId: profile.userId,
        date: today
      }
    }
  });

  const todayPlan = await prisma.dailyPlan.findFirst({
    where: { userId: profile.userId, date: today },
    include: { blocks: { orderBy: { startTime: 'asc' } } }
  });

  const tomorrowPlan = await prisma.dailyPlan.findFirst({
    where: { userId: profile.userId, date: tomorrow },
    include: { blocks: { orderBy: { startTime: 'asc' } } }
  });

  if (todayPlan) {
    displayPlan = todayPlan;
    planLabel = "Hari Ini";
  } else if (tomorrowPlan) {
    displayPlan = tomorrowPlan;
    planLabel = "Besok";
  }

  // Get upcoming blocks from the display plan (e.g. from current time onwards)
  let upcomingBlocks: ScheduleBlock[] = [];
  if (displayPlan) {
    if (displayPlan.date.getTime() === today.getTime()) {
      upcomingBlocks = displayPlan.blocks.filter(b => b.startTime >= jakartaNow).slice(0, 3);
      if (upcomingBlocks.length === 0) {
        // If all blocks are in the past, just show the last one or empty
        upcomingBlocks = displayPlan.blocks.slice(-2);
      }
    } else {
      upcomingBlocks = displayPlan.blocks.slice(0, 3);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Halo, Kawan 👋</h1>
        <p className="text-sm text-muted-foreground">
          Ini ringkasan harimu.
        </p>
      </div>

      {/* Main Action / Quick Command */}
      <CommandBox />

      {/* Plan Preview Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Plan {planLabel || "Harian"}
          </h2>
          {displayPlan && (
            <Link href={`/plan/${formatJakarta(displayPlan.date, 'yyyy-MM-dd')}`}>
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                Buka <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          )}
        </div>
        
        <Card className="border-none shadow-sm bg-card overflow-hidden">
          {displayPlan ? (
            upcomingBlocks.length > 0 ? (
              <div className="flex flex-col divide-y divide-border">
                {upcomingBlocks.map(block => (
                  <div key={block.id} className="flex items-center justify-between p-4 bg-background/50 hover:bg-background transition-colors">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium line-clamp-1">{block.title}</span>
                      <span className="text-xs text-muted-foreground capitalize">{block.blockType.toLowerCase()}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="font-medium bg-secondary/50">
                        {formatJakarta(block.startTime, "HH:mm")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round((new Date(block.endTime).getTime() - new Date(block.startTime).getTime()) / 60000)}m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Plan hari ini sudah selesai.
              </div>
            )
          ) : (
            <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">Belum ada plan untuk {planLabel || "hari ini"}.</p>
              <Link href="/plan/new" className="w-full">
                <Button size="sm" variant="secondary" className="w-full gap-2">
                  <Sparkles className="w-4 h-4" />
                  Buat Plan
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Habit Card */}
        <HabitCard />

        {/* Daily Note Card */}
        <DailyNoteCard todayNote={todayNote} />
      </div>

    </div>
  );
}