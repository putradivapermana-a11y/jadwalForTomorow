"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { submitInterviewMessage, finishOnboarding } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

type Message = { role: "user" | "ai"; content: string };

export function OnboardingChat({ initialMessages, isReady, extractedProfile }: { initialMessages: Message[], isReady: boolean, extractedProfile: Record<string, string | null> }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      await submitInterviewMessage(userMsg);
      router.refresh(); // Let server push new messages down
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (isReady) {
    return (
      <div className="px-4 py-8 space-y-6 w-full max-w-md mx-auto">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
            <span className="text-2xl">✨</span>
          </div>
          <h2 className="text-2xl font-bold">Profil Tersimpan!</h2>
          <p className="text-sm text-muted-foreground">
            Berdasarkan obrolan kita, aku sudah merangkum profilmu. Kamu bisa ubah ini kapan saja nanti.
          </p>
        </div>

        <Card className="border-none shadow-sm bg-muted/30">
          <CardContent className="p-4">
            <div className="space-y-3 text-sm">
              {Object.entries(extractedProfile || {}).map(([key, value]) => {
                if (!value) return null;
                const formattedKey = key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{formattedKey}</span>
                    <span className="font-medium text-foreground">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <form action={async () => {
          setLoading(true);
          await finishOnboarding();
          router.push("/");
        }}>
          <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl font-medium text-base">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Mulai Gunakan Jadwal
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-muted text-foreground rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 bg-muted flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            placeholder="Ketik jawabanmu..." 
            disabled={loading}
            className="h-12 rounded-xl bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50 px-4"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={loading || !input.trim()}
            className="h-12 w-12 rounded-xl shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}