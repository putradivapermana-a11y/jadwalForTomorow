"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { submitInterviewMessage, finishOnboarding } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Message = { role: "user" | "ai"; content: string };

export function OnboardingChat({ initialMessages, isReady, extractedProfile }: { initialMessages: Message[], isReady: boolean, extractedProfile: Record<string, string | null> }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Review Your Profile</CardTitle>
          <CardDescription>Based on our chat, here is what I extracted. You can always edit this later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 text-sm bg-muted p-4 rounded-md">
            {Object.entries(extractedProfile || {}).map(([key, value]) => (
              <div key={key}>
                <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                <span>{String(value) || "Not specified"}</span>
              </div>
            ))}
          </div>
          <form action={async () => {
            setLoading(true);
            await finishOnboarding();
            router.push("/");
          }}>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & Finish
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>AI Setup Interview</CardTitle>
        <CardDescription>{"Let's get to know you so I can plan your schedule better."}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted max-w-[80%] rounded-lg p-3 flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> AI is typing...
            </div>
          </div>
        )}
      </CardContent>
      <div className="p-4 border-t">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            placeholder="Type your answer..." 
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>Send</Button>
        </form>
      </div>
    </Card>
  );
}