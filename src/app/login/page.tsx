import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register } from "./actions";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Calendar } from "lucide-react";

export const runtime = "nodejs";
export const maxDuration = 30; // 30 seconds to mitigate Vercel serverless function timeouts

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;
  if (session) {
    redirect("/"); // Will be caught by redirect, but logic stands
  }

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2 shadow-sm">
            <Calendar className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">JadwalForTomorrow</h1>
          <p className="text-sm text-muted-foreground">
            Asisten AI cerdas untuk keseharianmu.
          </p>
        </div>

        <Card className="border-none shadow-sm bg-card p-2">
          <CardContent className="p-4 pt-6">
            {error === "login_failed" && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center">
                Login gagal. Cek email/password atau coba lagi.
              </div>
            )}
            {error === "register_failed" && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center">
                Registrasi gagal. Coba lagi beberapa saat.
              </div>
            )}
            {error === "missing_fields" && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center">
                Mohon isi email dan password.
              </div>
            )}
            {error === "user_exists" && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center">
                Email sudah terdaftar.
              </div>
            )}
            <form action={login} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="nama@email.com" className="h-12 bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                <Input id="password" name="password" type="password" required className="h-12 bg-muted/30" placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <Button type="submit" className="h-12 font-medium text-base rounded-xl">Masuk</Button>
                <Button type="submit" formAction={register} variant="secondary" className="h-12 font-medium text-base rounded-xl bg-muted hover:bg-muted/80">Daftar Akun Baru</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}