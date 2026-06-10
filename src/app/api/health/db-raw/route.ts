import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const durationMs = Date.now() - start;
    return NextResponse.json({ ok: true, durationMs, errorCode: null });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    const durationMs = Date.now() - start;
    
    console.error(JSON.stringify({
      level: "error",
      action: "health/db-raw",
      name: err?.name || "UnknownError",
      message: err?.message || "No error message",
      code: err?.code,
      durationMs,
    }));

    return NextResponse.json(
      { ok: false, durationMs, errorCode: err?.code || "DB_RAW_UNREACHABLE" },
      { status: 503 }
    );
  }
}