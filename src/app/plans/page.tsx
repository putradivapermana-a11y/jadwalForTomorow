import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { getProfile } from "@/app/actions/profile";
import prisma from "@/lib/prisma";
import { formatJakarta } from "@/lib/schedule/date-utils";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PlansPage() {
  await requireUser();
  const profile = await getProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  const plans = await prisma.dailyPlan.findMany({
    where: { userId: profile.userId },
    orderBy: { date: 'desc' },
    include: { blocks: true }
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Daftar Plan</h1>
        <p className="text-sm text-muted-foreground">
          Riwayat jadwal harian yang pernah kamu buat.
        </p>
      </div>

      <div className="flex">
        <Link href="/plan/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto gap-2">
            <Sparkles className="w-4 h-4" />
            Buat Plan Baru
          </Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed bg-transparent shadow-none">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-base font-medium">Belum ada plan harian</p>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              Jadwal harianmu masih kosong. Yuk mulai hari ini dengan rencana yang baik.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {plans.map((plan) => {
            const totalBlocks = plan.blocks.length;
            const doneBlocks = plan.blocks.filter(b => b.status === "DONE").length;
            const dateStr = formatJakarta(plan.date, "yyyy-MM-dd");

            return (
              <Link href={`/plan/${dateStr}`} key={plan.id}>
                <Card className="border-none shadow-sm bg-card hover:bg-muted/50 transition-colors p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-base">
                        {formatJakarta(plan.date, "EEEE, dd MMM")}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={plan.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">
                          {plan.status === "ACTIVE" ? "Aktif" : plan.status}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground mt-1" />
                  </div>
                  
                  <div className="flex gap-4 text-xs font-medium bg-muted/30 p-2 rounded-lg">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{totalBlocks} kegiatan</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{doneBlocks} selesai</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}