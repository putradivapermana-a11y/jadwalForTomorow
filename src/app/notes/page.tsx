import { requireUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lightbulb, Calendar as CalendarIcon, Edit3 } from "lucide-react";
import { formatJakarta } from "@/lib/schedule/date-utils";

export const metadata = {
  title: "Catatan Harian - JadwalForTomorrow",
};

export default async function NotesPage() {
  const user = await requireUser();
  const notes = await prisma.dailyNote.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 15,
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
          <h1 className="text-xl font-bold tracking-tight">Histori Jurnal</h1>
          <p className="text-xs text-muted-foreground">Catatan harian dan insight dari AI.</p>
        </div>
      </div>

      <div className="space-y-4">
        {notes.length === 0 ? (
          <Card className="border-dashed bg-transparent shadow-none p-8 text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-2">
              <Edit3 className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium">Belum ada jurnal.</p>
            <p className="text-xs text-muted-foreground">Tulis jurnal pertamamu di Beranda hari ini.</p>
          </Card>
        ) : (
          notes.map(note => {
            const learned = (note.learnedAboutUser as string[]) || [];
            
            return (
              <Card key={note.id} className="border-none shadow-sm bg-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-primary">
                      <CalendarIcon className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        {formatJakarta(note.date, "EEEE, dd MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {note.mood && (
                      <Badge variant="secondary" className="text-[10px] font-medium px-2 bg-muted/50">
                        {note.mood}
                      </Badge>
                    )}
                    {note.energyLevel && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        ⚡ {note.energyLevel}/10
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap pl-5 border-l-2 border-primary/20">
                  {note.rawText}
                </div>
                
                {learned.length > 0 && (
                  <div className="bg-primary/5 rounded-lg p-3 space-y-2 mt-2">
                    <h4 className="font-semibold flex items-center gap-1.5 text-xs text-primary">
                      <Lightbulb className="w-3.5 h-3.5" />
                      Insight AI dipelajari
                    </h4>
                    <ul className="space-y-1.5">
                      {learned.map((item, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 leading-tight">
                          <span className="text-primary/50 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}