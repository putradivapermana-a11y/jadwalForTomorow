import { requireUser } from "@/lib/auth";
import { getProfile } from "@/app/actions/profile";
import { redirect } from "next/navigation";
import NewPlanClient from "./NewPlanClient";

export default async function NewPlanPage() {
  await requireUser();
  const profile = await getProfile();
  
  if (!profile) {
    redirect("/onboarding");
  }

  return <NewPlanClient />;
}