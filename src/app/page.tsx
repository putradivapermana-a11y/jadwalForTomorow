import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getProfile } from "@/app/actions/profile";
import { CommandBox } from "@/components/dashboard/CommandBox";

export default async function Dashboard() {
  const profile = await getProfile();
  const needsOnboarding = !profile || !profile.currentRole;

  return (
    <div className="container py-8 space-y-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Tomorrow&apos;s Daily Plan</h1>
        <p className="text-muted-foreground">
          Welcome back. Here is what your AI assistant has prepared for you.
        </p>
      </div>

      {needsOnboarding && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertCircle className="w-5 h-5" />
              Complete Your Profile
            </CardTitle>
            <CardDescription className="text-yellow-600/80 dark:text-yellow-500/80">
              The AI needs to know your life context, goals, and constraints to generate the best schedule for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/onboarding">
              <Button variant="outline" className="border-yellow-500/50 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/20">
                Go to Onboarding
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Command Center */}
        <CommandBox />

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Focus Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tasks Today</span>
              <Badge>0/5</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Events Today</span>
              <Badge variant="outline">3</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Schedule Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded-lg">
              No events scheduled yet. Try adding one via Command Center.
            </div>
          </CardContent>
        </Card>

        {/* Task List Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Top Priorities
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded-lg">
              No tasks found.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}