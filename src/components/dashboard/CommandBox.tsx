"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, ArrowUp } from "lucide-react";
import { CommandResult } from "@/lib/commands/types";
import { Card } from "@/components/ui/card";

const SUGGESTIONS = [
  "Besok jam 9 meeting",
  "Jumat free nggak?",
  "Meeting Jumat cancel"
];

export function CommandBox() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input })
      });
      const data = await res.json();
      setLastResult(data);
      if (data.success && data.actionStatus === "SUCCESS") {
        setInput("");
      }
    } catch (error) {
      console.error(error);
      setLastResult({
        success: false,
        actionStatus: "FAILED",
        message: "Gagal memproses permintaan."
      });
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="border-none shadow-sm bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-primary">Asisten Jadwal</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="relative">
        <Textarea 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mau catat, cek, atau ubah jadwal?" 
          className="min-h-[80px] resize-none pr-12 pb-10 bg-background border-none shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 text-base"
          disabled={loading}
        />
        <div className="absolute bottom-2 right-2 flex items-center justify-between left-2">
           <span className="text-[10px] text-muted-foreground px-2">Natural AI Command</span>
           <Button 
            type="submit" 
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            disabled={loading || !input.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </Button>
        </div>
      </form>

      {lastResult && (
        <div className={`p-3 rounded-xl text-sm ${
          lastResult.actionStatus === "SUCCESS" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
          (lastResult.actionStatus === "NEEDS_CLARIFICATION" || lastResult.actionStatus === "NEEDS_CONFIRMATION") ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" :
          "bg-red-500/10 text-red-700 dark:text-red-400"
        }`}>
          <p className="font-semibold mb-1 text-xs uppercase tracking-wider">
            {lastResult.actionStatus === "SUCCESS" ? "Berhasil" :
             lastResult.actionStatus === "NEEDS_CLARIFICATION" ? "Butuh Info" : 
             lastResult.actionStatus === "NEEDS_CONFIRMATION" ? "Konfirmasi" : 
             "Gagal"}
          </p>
          <p className="whitespace-pre-wrap">{lastResult.clarificationQuestion || lastResult.message}</p>
        </div>
      )}

      {!lastResult && (
        <div className="flex flex-wrap gap-2 pt-1">
          {SUGGESTIONS.map((suggestion) => (
            <Badge 
              key={suggestion}
              variant="secondary" 
              className="bg-background/50 hover:bg-background cursor-pointer text-xs font-normal px-2.5 py-1"
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}