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

## Setup Instructions

1. Clone repository
2. Run `npm install`
3. Setup Neon Database:
   - Create a project on Neon.
   - Copy the `DATABASE_URL` (ensure connection pooling `?pgbouncer=true` if using direct URLs without Prisma Neon adapter, but we use `@prisma/adapter-neon` with WebSockets).
4. Create `.env` file based on `.env.example`
   - **AI Configuration**:
     - `AI_PROVIDER=mock`: Built-in mock responses, no API key needed.
     - `AI_PROVIDER=openai-compatible`: Works with Ollama, Groq, local APIs. Requires `AI_BASE_URL` and `AI_API_KEY`.
     - `AI_PROVIDER=google`: Works with Gemini REST API. Requires `AI_API_KEY`.
   - **AI Models & Fallbacks**:
     - Supports routing to `fast`, `fast_backup`, `worker`, `review`, and `critical` roles.
     - Validation: System will parse and validate JSON schemas via Zod. If `fast` fails, `fast_backup` is called automatically.
     - Configure `AI_ALLOW_PAID_FALLBACK=true` to let the system use the `critical` model for complex scenarios or if validation continuously fails.
5. Run `npx prisma generate`
6. Run `npx prisma db push`
7. Run `npx prisma db seed` to create the default user (`user@example.com`) and seed schedule blocks.
8. Start the dev server: `npm run dev`
