import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, CheckSquare, ArrowRight } from "lucide-react";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getJakartaNow, startOfJakartaDay } from "@/lib/schedule/date-utils";
import Link from "next/link";
import { revalidatePath } from "next/cache";

async function markHabit(habitId: string, status: "DONE" | "SKIPPED") {
  "use server";
  const user = await requireUser();
  const today = startOfJakartaDay(getJakartaNow());

  await prisma.habitLog.upsert({
    where: {
      habitId_date: {
        habitId,
        date: today
      }
    },
    update: {
      status
    },
    create: {
      userId: user.id,
      habitId,
      date: today,
      status
    }
  });

  revalidatePath("/");
  revalidatePath("/habits");
}

export async function HabitCard() {
  const user = await requireUser();
  const today = startOfJakartaDay(getJakartaNow());

  const activeHabits = await prisma.habit.findMany({
    where: { 
      userId: user.id,
      isActive: true
    },
    include: {
      logs: {
        where: { date: today }
      }
    },
    take: 3
  });

  return (
    <Card className="border-none shadow-sm bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          Habit Hari Ini
        </h2>
        <Link href="/habits">
          <span className="text-xs text-primary font-medium flex items-center gap-1">
            Lihat Semua <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      <div className="pt-1">
        {activeHabits.length === 0 ? (
          <div className="text-center py-4 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-3">Belum ada habit aktif.</p>
            <Link href="/habits">
              <Button size="sm" variant="outline" className="h-8">Buat Habit</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeHabits.map(habit => {
              const todayLog = habit.logs[0];
              const isDone = todayLog?.status === "DONE";

              return (
                <div key={habit.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{habit.title}</span>
                    {todayLog && (
                      <Badge variant="secondary" className={`text-[10px] font-medium ${isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {todayLog.status}
                      </Badge>
                    )}
                  </div>
                  
                  {!todayLog && (
                    <div className="flex gap-2">
                      <form action={markHabit.bind(null, habit.id, "DONE")} className="flex-1">
                        <Button type="submit" size="sm" variant="outline" className="w-full h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-transparent">
                          <Check className="w-3 h-3 mr-1" /> Selesai
                        </Button>
                      </form>
                      <form action={markHabit.bind(null, habit.id, "SKIPPED")} className="flex-1">
                        <Button type="submit" size="sm" variant="ghost" className="w-full h-8 text-xs text-muted-foreground bg-muted/50 hover:bg-muted">
                          <X className="w-3 h-3 mr-1" /> Skip
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}