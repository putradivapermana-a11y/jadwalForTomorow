import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const secretKey = process.env.SESSION_SECRET;
if (!secretKey || secretKey.length < 16) {
  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify({
      level: "error",
      message: "SESSION_SECRET environment variable is required in production and must be at least 16 characters long.",
    }));
  }
  throw new Error("SESSION_SECRET environment variable is required and must be at least 16 characters long.");
}
const key = new TextEncoder().encode(secretKey);

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function encrypt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30 days from now")
    .sign(key);
}

export async function decrypt(input: string): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function getSession() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
    include: { profile: true },
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Returns the ID of the authenticated user.
 */
export async function getAuthenticatedUserId(): Promise<string> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user.id;
}
