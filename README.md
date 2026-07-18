# Workifyr

> Work, verified, faster.

A unified business OS for SMEs. CRM and HRM in a single application — one identity, one permission model, one audit trail, one design language, and a pair of integrated AI assistants that turn the system into something you can converse with.

## What's in this repository

This is the foundation of Workifyr — the database, the application scaffold, and the AI plumbing — committed in a state where every piece is wired correctly even where the screens are still stubs.

### Database (Supabase, Postgres 17)
- 50+ tables across foundation, CRM, HRM, and AI concerns
- Row-Level Security on every table (multi-tenant isolation by `org_id`)
- Role-aware policies on payroll, leave approval, employee documents, and AI usage
- A SECURITY DEFINER `signup_create_org` RPC that bootstraps an org, seeds the six system roles, the default sales pipeline with five stages, and India-typical leave policies (CL/SL/EL)
- Helper functions `current_org_id()`, `has_role()`, `has_any_role()` for use in policies
- Audit log table that captures every mutation (the application writes through it)

The schema lives in Supabase migrations under the project — see the migration history in the dashboard. Re-running `supabase db push` from a local CLI checkout would apply them in order.

### Application (Next.js 16)
- App Router, Server Components, TypeScript strict
- Tailwind v4 with a token system anchored on viridian `#40826D` against a pure white canvas
- `@supabase/ssr` cookie-based session management — server, client, and middleware variants
- Boot-time env validation via Zod
- Auth pages: signup (with org creation RPC), login, magic-link callback
- App shell: viridian-accented sidebar, top bar with the AI sparkle, AI chat panel as a slide-out
- Dashboard with live aggregates from the user's org
- Stub pages for every CRM, HRM, and Admin route so navigation works end-to-end

### AI (OpenRouter, Gemma 4 31B Instruct)
- Streaming SSE endpoint at `/api/ai/[module]` (module = `crm` or `hrm`)
- System prompts that ground the assistant in the caller's org, role, and any focused record
- Tool definitions for both modules — search, summarize, draft — executed server-side using the caller's Supabase session, so RLS is enforced on every tool call
- Tool-call loop with a 6-iteration cap, prompt-injection scan on user input, secret-redaction on output
- In-memory per-user rate limiter (60/hour, 500/day default)
- Chat panel UI streams tokens as they arrive, renders tool-call cards inline, persists nothing yet (chat history persistence lives in the `ai_conversations` and `ai_messages` tables and lands in the next session)

## Brand and design language

| Token | Value |
|---|---|
| Viridian (primary) | `#40826D` |
| Viridian dark (hover) | `#2F6451` |
| Viridian light | `#5FA088` |
| Viridian pale (selection) | `#E8F1ED` |
| Canvas | `#FFFFFF` |
| Ink (primary text) | `#000000` |
| Ink secondary | `#4B5563` |
| Border | `#E5E7EB` |

Inter for UI, Instrument Serif italic for marketing surfaces and brand wordmarks. Viridian is the only chromatic accent in the product — status colors (success / warning / danger / info) exist for genuine status, never for visual hierarchy.

## Running it locally

Requires Node 20+.

```bash
cp .env.example .env.local
# Fill in OPENROUTER_API_KEY (optional — falls back to the :free tier)
# Fill in SUPABASE_SERVICE_ROLE_KEY (only required for admin tooling)

npm install
npm run dev
```

The app will be at `http://localhost:3000`. Sign up creates a real organization in the connected Supabase project, seeds default pipeline stages and leave policies, and drops you on the dashboard.

## Architecture decisions worth knowing

- **RLS does the tenancy work, not the application.** Every business table has `org_id` and a policy filtering by `current_org_id()`. The application cannot leak across organizations even if a query is written wrong.
- **The AI calls Supabase with the caller's session.** It cannot read what the user can't read. Every AI tool call is therefore inherently permission-aware — an employee asking "what's HR's salary" gets back "permission denied", not a hallucination.
- **Manual data entry first.** No email sync, no third-party CRM integrations, no bank wires in payroll. The product is the system of record plus the AI on top.
- **Two assistants, not one.** The CRM AI and HR AI share UI scaffolding but have different system prompts, different tool sets, and different access scopes. The HR AI is permission-aware in a way that means it returns different data depending on whether HR or an employee is asking.

## What's next

The next session adds the screens behind the stubs — Contacts table with side-sheet creation and three-pane detail view, Pipelines Kanban with dnd-kit, the Employee 360, the payroll engine, the invoice template gallery, the audit log viewer, and conversation persistence for the AI panels. The schema is complete, the auth flow works, and the AI endpoint streams; the rest is now a matter of building screens on top of a stable foundation.

## License

Proprietary — © Workifyr.
