# Jadwal (Tomorrow)

An AI-native personal assistant tailored to schedule and manage your tasks.
Currently in development.

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
5. Run `npx prisma generate`
6. Run `npx prisma db push`
7. Run `npm run seed` to create the default user (`user@example.com`).
8. Start the dev server: `npm run dev`
