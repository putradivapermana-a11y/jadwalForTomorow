import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { getProfile } from "@/app/actions/profile";
import { CommandBox } from "@/components/dashboard/CommandBox";
import prisma from "@/lib/prisma";
import { format, startOfDay } from "date-fns";
import { ScheduleBlock } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  await requireUser();
  const profile = await getProfile();
  const needsOnboarding = !profile || !profile.currentRole;

  if (needsOnboarding) {
    redirect("/onboarding");
  }

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Stats
  let tasksCount = 0;
  let eventsCount = 0;
  let latestPlan = null;
  let previewBlocks: ScheduleBlock[] = [];

  if (profile) {
    tasksCount = await prisma.task.count({ where: { userId: profile.userId, status: "TODO" } });
    eventsCount = await prisma.fixedEvent.count({ 
      where: { 
        userId: profile.userId, 
        status: "ACTIVE",
        startTime: { gte: today }
      } 
    });

    // Try tomorrow's plan first, then today
    latestPlan = await prisma.dailyPlan.findFirst({
      where: {
        userId: profile.userId,
        date: { gte: today, lte: tomorrow }
      },
      orderBy: { date: 'desc' },
      include: {
        blocks: { orderBy: { startTime: 'asc' }, take: 3 }
      }
    });

    if (latestPlan) {
      previewBlocks = latestPlan.blocks;
    }
  }

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Tomorrow&apos;s Daily Plan</h1>
        <p className="text-muted-foreground">
          Welcome back. Here is what your AI assistant has prepared for you.
        </p>
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Command Center */}
        <CommandBox />

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Focus Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Pending Tasks</span>
              <Badge variant="secondary">{tasksCount}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Upcoming Events</span>
              <Badge variant="outline">{eventsCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Schedule Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Preview
            </CardTitle>
            {latestPlan && (
              <Link href={`/plan/${format(latestPlan.date, 'yyyy-MM-dd')}`}>
                <Button variant="ghost" size="sm">View Full</Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {latestPlan ? (
              previewBlocks.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    {format(latestPlan.date, "EEEE, dd MMM")}
                  </div>
                  {previewBlocks.map(block => (
                    <div key={block.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{block.title}</span>
                        <span className="text-xs text-muted-foreground">{block.blockType}</span>
                      </div>
                      <Badge variant="outline">
                        {format(block.startTime, "HH:mm")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 py-8 border-2 border-dashed rounded-lg">
                  <div className="text-sm text-muted-foreground text-center">
                    Plan harian kosong (semua block sudah selesai / dibatalkan).
                  </div>
                  <Link href={`/plan/${format(latestPlan.date, 'yyyy-MM-dd')}`}>
                    <Button size="sm" variant="secondary">Lihat Detail</Button>
                  </Link>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-8 border-2 border-dashed rounded-lg">
                <div className="text-sm text-muted-foreground text-center">
                  Belum ada plan harian yang aktif.
                </div>
                <Link href="/plan/new">
                  <Button size="sm" variant="secondary">Generate Plan</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Action Card */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Plan Your Tomorrow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <p className="text-sm text-muted-foreground">
              Dump pikiran lu buat besok, kasih tau jadwal pastinya kalau ada, sisanya biar AI yang nyusun dan mikirin alokasi waktunya biar lu bisa fokus.
            </p>
            <Link href="/plan/new">
              <Button className="w-full">Buat Plan Besok</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}