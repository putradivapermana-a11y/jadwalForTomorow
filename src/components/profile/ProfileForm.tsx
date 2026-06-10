"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { userProfileSchema, UserProfileFormValues } from "@/lib/validations/profile"
import { saveProfile } from "@/app/actions/profile"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

interface ProfileFormProps {
  initialData?: Partial<UserProfileFormValues>
  isOnboarding?: boolean
}

export function ProfileForm({ initialData, isOnboarding = false }: ProfileFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const form = useForm<UserProfileFormValues>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      currentRole: initialData?.currentRole || "",
      currentPhase: initialData?.currentPhase || "",
      passions: initialData?.passions || "",
      shortTermGoals: initialData?.shortTermGoals || "",
      longTermGoals: initialData?.longTermGoals || "",
      priorities: initialData?.priorities || "",
      productiveHours: initialData?.productiveHours || "",
      lowEnergyHours: initialData?.lowEnergyHours || "",
      sleepPreference: initialData?.sleepPreference || "",
      freeTimePolicy: initialData?.freeTimePolicy || "",
      lifeConstraints: initialData?.lifeConstraints || "",
    },
  })

  async function onSubmit(data: UserProfileFormValues) {
    setIsPending(true)
    const result = await saveProfile(data)
    setIsPending(false)

    if (result.success) {
      if (isOnboarding) {
        router.push("/")
      } else {
        router.refresh()
      }
    } else {
      console.error(result.error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Identity & Current State */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Identity & Current State</h3>
            <FormField
              control={form.control}
              name="currentRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Role</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Frontend Developer, Student" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentPhase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Phase of Life</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Looking for jobs, Building a startup" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passions & Interests</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Open source, Machine Learning, Piano" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Goals & Priorities */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Goals & Priorities</h3>
            <FormField
              control={form.control}
              name="shortTermGoals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short-term Goals</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Finish portfolio by next month" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="longTermGoals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Long-term Goals</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Become a Senior Engineer in 3 years" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priorities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Top Priorities Right Now</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g. Health, Career transition" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Time Preferences & Energy */}
          <div className="space-y-4 md:col-span-2">
            <h3 className="text-lg font-semibold">Time & Energy Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productiveHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Most Productive Hours</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 8 AM - 12 PM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lowEnergyHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Energy Hours</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2 PM - 4 PM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sleepPreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sleep Preferences</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Need 8 hours, usually 11 PM to 7 AM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="freeTimePolicy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Free Time Policy</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Keep weekends completely free" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lifeConstraints"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Life Constraints / Non-Negotiables</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. Must pick up kids at 3 PM, Tuesday nights are for family" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : isOnboarding ? "Complete Onboarding" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  )
}