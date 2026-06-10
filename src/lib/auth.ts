import prisma from "@/lib/prisma";

/**
 * Returns the ID of the default development user.
 * In production or after adding proper auth, this should be replaced
 * by a session check (e.g., getServerSession).
 */
export async function getDevUserId(): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { email: "user@example.com" },
  });

  if (!user) {
    throw new Error("Dev user not found. Did you run `npm run seed`?");
  }

  return user.id;
}