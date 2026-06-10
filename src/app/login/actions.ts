"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encrypt, sessionCookieOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function logSafeError(action: string, error: unknown, durationMs: number, stage: string) {
  const err = error as Error & { code?: string };
  console.error(JSON.stringify({
    level: "error",
    action,
    stage,
    name: err?.name || "UnknownError",
    message: err?.message || "No error message",
    prismaCode: err?.code,
    durationMs,
  }));
}

export async function login(formData: FormData) {
  const start = Date.now();
  let stage = "parse_form";
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      redirect("/login?error=missing_fields");
    }

    stage = "find_user";
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !user.passwordHash) {
      redirect("/login?error=login_failed");
    }

    stage = "compare_password";
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      redirect("/login?error=login_failed");
    }

    stage = "create_session";
    const session = await encrypt({ userId: user.id });

    stage = "set_cookie";
    (await cookies()).set("session", session, sessionCookieOptions);
  } catch (err: unknown) {
    // Do not catch redirects thrown by Next.js
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;

    const durationMs = Date.now() - start;
    logSafeError("login", err, durationMs, stage);
    redirect("/login?error=login_failed");
  }

  redirect("/");
}

export async function register(formData: FormData) {
  const start = Date.now();
  let stage = "parse_form";
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      redirect("/login?error=missing_fields");
    }

    stage = "find_user";
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      redirect("/login?error=user_exists");
    }

    stage = "hash_password";
    const passwordHash = await bcrypt.hash(password, 10);

    stage = "create_user";
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    stage = "create_session";
    const session = await encrypt({ userId: user.id });

    stage = "set_cookie";
    (await cookies()).set("session", session, sessionCookieOptions);
  } catch (err: unknown) {
    // Do not catch redirects thrown by Next.js
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    
    const durationMs = Date.now() - start;
    logSafeError("register", err, durationMs, stage);
    redirect("/login?error=register_failed");
  }

  redirect("/");
}

export async function logout() {
  (await cookies()).set("session", "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/login");
}
