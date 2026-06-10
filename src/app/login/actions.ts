"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encrypt, sessionCookieOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Next.js redirect errors have a 'digest' property that starts with NEXT_REDIRECT
function isRedirectError(err: unknown): boolean {
  return err !== null && typeof err === 'object' && 'digest' in err && typeof (err as any).digest === 'string' && (err as any).digest.startsWith('NEXT_REDIRECT');
}

function logSafeError(action: string, error: unknown, durationMs: number, stage: string, stageDurationsMs?: Record<string, number>) {
  const err = error as Error & { code?: string };
  console.error(JSON.stringify({
    level: "error",
    action,
    stage,
    name: err?.name || "UnknownError",
    message: err?.message || "No error message",
    prismaCode: err?.code,
    durationMs,
    stageDurationsMs,
  }));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutErrorCode: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error("Database timeout saat autentikasi.") as Error & { code?: string };
      err.code = timeoutErrorCode;
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export async function login(formData: FormData) {
  const start = Date.now();
  let stage = "parse_form";
  let lastStageTime = start;
  const stageDurationsMs: Record<string, number> = {};

  const measureStage = (newStage: string) => {
    const now = Date.now();
    stageDurationsMs[stage] = now - lastStageTime;
    stage = newStage;
    lastStageTime = now;
  };

  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      redirect("/login?error=missing_fields");
    }

    measureStage("find_user");
    const user = await withTimeout(
      prisma.user.findUnique({ where: { email } }),
      15000,
      "DB_TIMEOUT_LOGIN_FIND"
    );
    
    if (!user || !user.passwordHash) {
      redirect("/login?error=login_failed");
    }

    measureStage("compare_password");
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      redirect("/login?error=login_failed");
    }

    measureStage("create_session");
    const session = await encrypt({ userId: user.id });

    measureStage("set_cookie");
    (await cookies()).set("session", session, sessionCookieOptions);

    measureStage("done");
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;

    const durationMs = Date.now() - start;
    logSafeError("login", err, durationMs, stage, stageDurationsMs);
    redirect("/login?error=server_error");
  }

  redirect("/");
}

export async function register(formData: FormData) {
  const start = Date.now();
  let stage = "parse_form";
  let lastStageTime = start;
  const stageDurationsMs: Record<string, number> = {};

  const measureStage = (newStage: string) => {
    const now = Date.now();
    stageDurationsMs[stage] = now - lastStageTime;
    stage = newStage;
    lastStageTime = now;
  };

  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      redirect("/login?error=missing_fields");
    }

    measureStage("find_user");
    const existing = await withTimeout(
      prisma.user.findUnique({ where: { email } }),
      15000,
      "DB_TIMEOUT_REGISTER_FIND"
    );
    if (existing) {
      redirect("/login?error=user_exists");
    }

    measureStage("hash_password");
    const passwordHash = await bcrypt.hash(password, 10);

    measureStage("create_user");
    const user = await withTimeout(
      prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      }),
      15000,
      "DB_TIMEOUT_REGISTER_CREATE"
    );

    measureStage("create_session");
    const session = await encrypt({ userId: user.id });

    measureStage("set_cookie");
    (await cookies()).set("session", session, sessionCookieOptions);

    measureStage("done");
  } catch (err: unknown) {
    if (isRedirectError(err)) throw err;
    
    const durationMs = Date.now() - start;
    logSafeError("register", err, durationMs, stage, stageDurationsMs);
    redirect("/login?error=server_error");
  }

  redirect("/");
}

export async function logout() {
  (await cookies()).set("session", "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/login");
}
