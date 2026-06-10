"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function NewPlanClient() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input })
      });
      
      const data = await res.json();
      
      if (!res.ok || data.actionStatus === "FAILED") {
        toast.error("Error", {
          description: data.clarificationQuestion || data.message || "Failed to generate plan."
        });
      } else {
        toast.success("Plan Generated", {
          description: "Berhasil nyusun jadwal buat besok!"
        });
        if (data.data?.dateString) {
          router.push(`/plan/${data.data.dateString}`);
        } else if (data.data?.date) {
          // fallback just in case
          const d = new Date(data.data.date);
          const dateStr = d.toISOString().split("T")[0];
          router.push(`/plan/${dateStr}`);
        } else {
          router.push("/");
        }
      }
    } catch {
      toast.error("Error", {
        description: "Gagal memproses permintaan."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Generate Daily Plan</h1>
        <Link href="/">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Tell me about your tomorrow
          </CardTitle>
          <CardDescription>
            Dump semua agenda lu buat besok. Kasih tau jam spesifik kalau ada, atau kasih tau aja tugas apa aja yang mau diselesaiin dan kapan lu mau tidur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="Contoh: Besok kuliah jam 8-10, terus harus ngerjain tugas web. Siang mau freelance cari 3 lead. Jam 7 malam mau ketemu cewe. Pengennya tidur jam 11 malam maksimal."
            className="min-h-[200px] resize-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />

          <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Pastikan profil onboarding lu udah lengkap ya, biar AI tau jam tidur default dan prioritas hidup lu. Kalau lu minta bikin plan di hari yang sama, dia bakal nyoba ngisi waktu yang masih kosong aja.
            </p>
          </div>

          <Button 
            className="w-full font-semibold" 
            size="lg"
            onClick={handleGenerate}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Thinking & Planning...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-5 w-5" />
                Generate Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}