import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16,
    nodeEnv: process.env.NODE_ENV,
  });
}