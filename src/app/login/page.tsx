import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, register } from "./actions";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

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
    <div className="flex h-screen w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Jadwal</CardTitle>
          <CardDescription>Sign in or create an account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {error === "server_error" && (
            <div className="mb-4 p-3 rounded bg-destructive/15 text-destructive text-sm font-medium">
              Terjadi masalah saat login. Coba lagi atau cek konfigurasi server.
            </div>
          )}
          {error === "missing_fields" && (
            <div className="mb-4 p-3 rounded bg-destructive/15 text-destructive text-sm font-medium">
              Mohon isi email dan password.
            </div>
          )}
          {error === "invalid_credentials" && (
            <div className="mb-4 p-3 rounded bg-destructive/15 text-destructive text-sm font-medium">
              Email atau password salah.
            </div>
          )}
          {error === "user_exists" && (
            <div className="mb-4 p-3 rounded bg-destructive/15 text-destructive text-sm font-medium">
              Email sudah terdaftar.
            </div>
          )}
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="m@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit">Sign In</Button>
              <Button type="submit" formAction={register} variant="outline">Create Account</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}