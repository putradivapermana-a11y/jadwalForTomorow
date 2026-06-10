import { requireUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toggleHabitActiveAction } from "./actions";
import { getJakartaNow, startOfJakartaDay } from "@/lib/schedule/date-utils";
import Link from "next/link";
import { ArrowLeft, Plus, CheckCircle2, CircleDashed } from "lucide-react";

export default async function HabitsPage() {
  const user = await requireUser();
  const today = startOfJakartaDay(getJakartaNow());

  const habits = await prisma.habit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      logs: {
        where: { date: today }
      }
    }
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight">Habit Tracker</h1>
          <p className="text-xs text-muted-foreground">Lacak dan bangun kebiasaan baikmu.</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* Habit List */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Daftar Habit</h2>
          {habits.length === 0 ? (
            <Card className="border-dashed bg-transparent shadow-none p-8 text-center space-y-2">
              <p className="text-sm font-medium">Belum ada habit.</p>
              <p className="text-xs text-muted-foreground">Buat habit pertamamu di bawah.</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {habits.map(habit => {
                const todayLog = habit.logs[0];
                const isDone = todayLog?.status === "DONE";
                
                return (
                  <Card key={habit.id} className={`border-none shadow-sm transition-all ${habit.isActive ? "bg-card" : "bg-muted/30 opacity-60"} p-4 space-y-3`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <CircleDashed className="w-4 h-4 text-muted-foreground" />
                          )}
                          <h3 className={`font-semibold text-sm ${isDone ? "text-muted-foreground line-through" : ""}`}>
                            {habit.title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 ml-6">
                          {habit.category && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                              {habit.category}
                            </span>
                          )}
                          {habit.preferredTime && (
                            <span className="text-[10px] text-muted-foreground">
                              ⏳ {habit.preferredTime}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <form action={async () => {
                          "use server";
                          await toggleHabitActiveAction(habit.id, !habit.isActive);
                        }}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                            {habit.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </form>
                      </div>
                    </div>
                    
                    {habit.isActive && (
                      <div className="ml-6 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Status hari ini:</span>
                        {todayLog ? (
                          <span className={`font-semibold ${isDone ? "text-green-600 dark:text-green-500" : "text-orange-600 dark:text-orange-500"}`}>
                            {todayLog.status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Belum dicatat</span>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* New Habit Form */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Habit Baru</h2>
          <Card className="border-none shadow-sm bg-muted/20">
            <CardContent className="p-4">
              <form action={async (formData) => {
                "use server";
                const { createHabitAction } = await import("./actions");
                await createHabitAction(formData);
              }} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="title" className="text-xs font-semibold text-muted-foreground">Judul Habit</label>
                  <Input id="title" name="title" className="h-9 text-sm" placeholder="Contoh: Belajar AI 1 jam" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="category" className="text-xs font-semibold text-muted-foreground">Kategori</label>
                    <Input id="category" name="category" className="h-9 text-sm" placeholder="Opsional" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="preferredTime" className="text-xs font-semibold text-muted-foreground">Waktu</label>
                    <Input id="preferredTime" name="preferredTime" className="h-9 text-sm" placeholder="Pagi/Malam" />
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full h-9 gap-2 mt-2">
                  <Plus className="w-4 h-4" />
                  Tambah Habit
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}