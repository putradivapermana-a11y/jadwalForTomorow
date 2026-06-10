"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2 } from "lucide-react";
import { CommandResult } from "@/lib/commands/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SUGGESTIONS = [
  "Jumat tanggal 14 ada meeting sama client jam 8 malam",
  "Besok jam 10 kuliah",
  "Jumat tanggal 14 gua free nggak?",
  "Besok jam 2 kosong nggak?",
  "Meeting Jumat cancel",
  "Meeting pindah Sabtu jam 10"
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
        message: "Failed to send command."
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="md:col-span-2 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Command Center
        </CardTitle>
        <CardDescription>
          Natural language commands for your schedule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., 'Jumat jam 8 malam ada meeting client'" 
            className="flex-1"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : "Send"}
          </Button>
        </form>

        {lastResult && (
          <div className={`p-4 rounded-md text-sm border ${
            lastResult.actionStatus === "SUCCESS" ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400" :
            (lastResult.actionStatus === "NEEDS_CLARIFICATION" || lastResult.actionStatus === "NEEDS_CONFIRMATION") ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
            "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
          }`}>
            <p className="font-medium mb-1">
              {lastResult.actionStatus === "SUCCESS" ? "Success" :
               lastResult.actionStatus === "NEEDS_CLARIFICATION" ? "Clarification Needed" : 
               lastResult.actionStatus === "NEEDS_CONFIRMATION" ? "Confirmation Needed" : 
               "Error"}
            </p>
            <p className="whitespace-pre-wrap">{lastResult.clarificationQuestion || lastResult.message}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-muted-foreground">Try:</span>
          {SUGGESTIONS.map((suggestion) => (
            <Badge 
              key={suggestion}
              variant="secondary" 
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}