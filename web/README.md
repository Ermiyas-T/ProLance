# ProLance Web (frontend)

Next.js App Router frontend for the ProLance freelancer marketplace.

**Docs (keep them in sync; Architecture wins on conflict):**

- [`Architecture.md`](./Architecture.md) — folders, routes, query keys, 401 re-auth, entity types
- [`Project_breakdown.md`](./Project_breakdown.md) — screen intent, real API calls, build order (V1 only)

## Stack

- Next.js (App Router, TypeScript, Tailwind CSS)
- TanStack Query — one cache contract per backend domain in `src/features/*`
- shadcn/ui primitives in `src/components/ui` (add via `npx shadcn@latest add <component>`)

## Getting started

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to the FastAPI backend
npm run dev
```

## Status

Boilerplate scaffold only — folder structure, config, and stub files per `Architecture.md`. Feature implementation happens inside `src/features/<domain>/` and the route pages.
