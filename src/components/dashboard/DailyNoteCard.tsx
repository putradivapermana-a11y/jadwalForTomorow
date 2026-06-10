"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { saveTodayDailyNoteAction } from "@/app/notes/actions";
import { toast } from "sonner";
import { Loader2, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";
import { DailyNote } from "@prisma/client";

interface DailyNoteCardProps {
  todayNote: DailyNote | null;
}

export function DailyNoteCard({ todayNote }: DailyNoteCardProps) {
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState(todayNote?.rawText || "");
  const [mood, setMood] = useState(todayNote?.mood || "");
  const [energyLevel, setEnergyLevel] = useState(todayNote?.energyLevel?.toString() || "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rawText.trim()) {
      toast.error("Catatan tidak boleh kosong.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("rawText", rawText);
    if (mood) formData.append("mood", mood);
    if (energyLevel) formData.append("energyLevel", energyLevel);

    try {
      const res = await saveTodayDailyNoteAction(formData);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-none shadow-sm bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Jurnal Hari Ini
        </h2>
        <Link href="/notes">
          <span className="text-xs text-primary font-medium flex items-center gap-1">
            Histori <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 pt-1">
        <Textarea 
          id="rawText" 
          className="min-h-[80px] text-sm resize-none bg-muted/30 border-transparent focus-visible:ring-1 focus-visible:bg-background transition-colors placeholder:text-muted-foreground/60"
          value={rawText} 
          onChange={e => setRawText(e.target.value)} 
          placeholder="Bagaimana harimu berjalan? Ada pikiran atau insight yang mau dicatat?"
        />
        
        <div className="flex gap-2">
          <Input 
            className="flex-1 h-8 text-xs bg-muted/30 border-transparent"
            value={mood} 
            onChange={e => setMood(e.target.value)} 
            placeholder="Mood (contoh: fokus, capek)" 
          />
          <Input 
            type="number" 
            min="1" 
            max="10" 
            className="w-20 h-8 text-xs bg-muted/30 border-transparent"
            value={energyLevel} 
            onChange={e => setEnergyLevel(e.target.value)} 
            placeholder="Energi (1-10)" 
          />
        </div>

        <Button type="submit" size="sm" className="w-full h-8 gap-2" disabled={loading || !rawText.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Simpan Jurnal
        </Button>
      </form>
    </Card>
  );
}