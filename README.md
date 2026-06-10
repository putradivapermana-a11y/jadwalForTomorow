# Jadwal (Tomorrow)

An AI-native personal assistant tailored to schedule and manage your tasks.
Currently in development.

## MVP Manual QA Checklist

- [ ] Connect to DB and run `npx prisma db push` + `npx prisma db seed`.
- [ ] Sign in with any email (dev mode auto-bypasses actual auth).
- [ ] View Dashboard, ensure demo Tasks & Events load correctly.
- [ ] View Onboarding Profile, ensure it's populated from the seed.
- [ ] Test the "Command Box" with natural language (e.g. "Besok ada meeting jam 10 pagi").
- [ ] Create a New Daily Plan using natural language.
- [ ] Modify timeline blocks (Drag & Drop, Edit duration).
- [ ] Switch to Mobile view (devtools), ensure UI is responsive.

## Mobile PWA Installation

JadwalForTomorrow supports PWA installation for a native-like experience on mobile. 
Note: Backend connectivity is still required; offline mode only caches the application shell.

**Android (Chrome):**
1. Open the app URL over HTTPS.
2. Tap the three dots menu (⋮).
3. Select "Add to Home screen" or "Install App".
4. Follow the prompt to install.

**iOS (Safari):**
1. Open the app URL over HTTPS.
2. Tap the Share button.
3. Scroll down and tap "Add to Home Screen".
4. Confirm by tapping "Add".

## Tech Stack
- Next.js 14 App Router
- Prisma ORM + Neon Serverless Postgres
- Tailwind CSS + shadcn/ui
- LangChain / OpenAI / Anthropic (Planned for AI)

## Features (Sprint 2 - User Context)
- User Profile tracking (goals, constraints, energy hours, roles).
- `onboarding` flow to capture user context for the AI.
- `settings/personality` to edit the profile.
- Dashboard CTA for incomplete profiles.

## Vercel Deployment Guide

1. Connect your GitHub repository to Vercel.
2. Set the following environment variables in Vercel:
   - `DATABASE_URL`: Connection string to your Postgres database (e.g. Neon).
   - `SESSION_SECRET`: A secure random string (at least 16 chars) for JWT.
   - `AI_PROVIDER`: `mock`, `openai-compatible`, or `google`.
   - `AI_BASE_URL`: Required for `openai-compatible`.
   - `AI_API_KEY`: Required for `openai-compatible` or `google`.
   - `AI_MODEL_FAST`: e.g. `llama3-8b` or `gemini-1.5-flash`.
   - `AI_MODEL_FAST_BACKUP`: Fallback fast model.
   - `AI_MODEL_WORKER`: e.g. `llama3-70b` or `gemini-1.5-pro`.
   - `AI_MODEL_REVIEW`: e.g. `llama3-70b` or `gemini-1.5-pro`.
   - `AI_MODEL_CRITICAL`: Paid/heavy model, e.g. `claude-3-5-sonnet`.
   - `AI_ALLOW_PAID_FALLBACK`: `true` or `false`.
   - `AI_PAID_ONLY_FOR`: Specify components restricted to paid models.
   - `AI_TIMEZONE`: `Asia/Jakarta`.
   - `ALLOW_PROD_SEED`: `false` (do not enable in production unless required).
   - `NEXT_PUBLIC_APP_URL`: (Optional) The deployed Vercel URL.
3. Deploy the application. Vercel will run `prisma generate` during `postinstall` automatically.
4. Run Database Migrations manually:
   - Ensure your Postgres DB exists.
   - Run `npx prisma db push` from your local machine with `DATABASE_URL` pointing to your production DB.
   - Do NOT configure `prisma db push` as part of the Vercel build.
5. Verification:
   - Test PWA installation.
   - Test login and onboarding.
   - Test the command box and daily plan generation.

## Local Setup Instructions

1. Clone repository
2. Run `npm install`
3. Setup Neon Database:
   - Create a project on Neon.
   - Copy the `DATABASE_URL` (we use `@prisma/adapter-neon` with WebSockets).
4. Create `.env` file based on `.env.example`
   - See AI Configuration details in the Vercel section above.
5. Run `npx prisma generate`
6. Run `npx prisma db push`
7. Run `npm run seed` to create the default user (`user@example.com`) and seed schedule blocks.
8. Start the dev server: `npm run dev`
