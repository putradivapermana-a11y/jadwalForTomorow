import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const start = Date.now();
  try {
    await prisma.user.count();
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    const durationMs = Date.now() - start;
    
    console.error("[health-db-error]", {
      action: "health/db",
      name: err?.name || "UnknownError",
      message: err?.message || "No error message",
      code: err?.code,
      durationMs,
    });

    return NextResponse.json(
      { ok: false, error: "DB_UNREACHABLE" },
      { status: 503 }
    );
  }
}