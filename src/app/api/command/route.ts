import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
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

    const userId = await getAuthenticatedUserId();
    const result = await processCommand(userId, text);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Command API error:", error);
    // Return standard CommandResult shape instead of raw error to avoid breaking client assumptions
    return NextResponse.json(
      { 
        success: false, 
        actionStatus: "FAILED", 
        message: "Wah, ada error tak terduga nih pas ngeproses command lu." 
      },
      { status: 500 }
    );
  }
}
