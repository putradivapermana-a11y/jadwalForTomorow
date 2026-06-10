"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encrypt, sessionCookieOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function logSafeError(action: string, error: unknown, durationMs: number) {
  const err = error as Error & { code?: string };
  console.error("[auth-action-error]", {
    action,
    name: err?.name || "UnknownError",
    message: err?.message || "No error message",
    code: err?.code,
    durationMs,
  });
}

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=missing_fields");
  }

  const start = Date.now();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !user.passwordHash) {
      redirect("/login?error=invalid_credentials");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      redirect("/login?error=invalid_credentials");
    }

    const session = await encrypt({ userId: user.id });
    (await cookies()).set("session", session, sessionCookieOptions);
  } catch (err: unknown) {
    // Do not catch redirects thrown by Next.js
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;

    const durationMs = Date.now() - start;
    logSafeError("login", err, durationMs);
    redirect("/login?error=server_error");
  }

  redirect("/");
}

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=missing_fields");
  }

  const start = Date.now();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      redirect("/login?error=user_exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    const session = await encrypt({ userId: user.id });
    (await cookies()).set("session", session, sessionCookieOptions);
  } catch (err: unknown) {
    // Do not catch redirects thrown by Next.js
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    
    const durationMs = Date.now() - start;
    logSafeError("register", err, durationMs);
    redirect("/login?error=server_error");
  }

  redirect("/");
}

export async function logout() {
  (await cookies()).set("session", "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/login");
}
