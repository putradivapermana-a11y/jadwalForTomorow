import { NextResponse } from "next/server";
import { getDevUserId } from "@/lib/auth";
import { processCommand } from "@/lib/commands/command-router";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Invalid text input" },
        { status: 400 }
      );
    }

    const userId = await getDevUserId();
    const result = await processCommand(userId, text);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Command API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}