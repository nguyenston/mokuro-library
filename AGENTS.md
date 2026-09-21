# Agent Guide for mokuro-library

## Project overview
- Monorepo with a Fastify backend (`backend/`) and a SvelteKit frontend (`frontend/`).
- Data persistence is SQLite via Prisma; Docker bundles backend + frontend + database.
- Primary docs live in `docs/` and `docs-wiki/`.

## Repository layout
- `backend/`: Fastify API, Prisma schema/migrations, PDF/ZIP export, OCR edit write-back.
- `frontend/`: SvelteKit UI, Tailwind CSS, reader/overlay views.
- `docs/architecture/`: system and feature design notes.
- `scripts/`: local tooling (ex: `dev-docker.mjs`).
- `data/`: runtime database/uploads (do not edit manually).

## Repo map (key entry points)
- Backend entry: `backend/src/server.ts` -> `backend/src/core/app.ts` (Fastify setup and route registration).
- Backend routes: `backend/src/routes/` (auth, library, files, export, ocr, settings, stats, contributions).
- Backend data: `backend/src/lib/prisma/prisma.ts` (Prisma client/extensions).
- Backend auth: `backend/src/plugins/auth.ts`.
- Frontend app shell: `frontend/src/routes/+layout.ts` and `frontend/src/routes/+layout.svelte`.
- Frontend protected home: `frontend/src/routes/(protected)/+page.svelte`.
- Frontend reader pages: `frontend/src/routes/(protected)/volume/[id]/+page.svelte`.
- Frontend API client: `frontend/src/lib/services/api.ts`.
- Frontend services: `frontend/src/lib/services/` (auth refresh, device fingerprinting, review/rebase APIs).
- Frontend state/store: `frontend/src/lib/states/` and `frontend/src/lib/stores/`.
- Frontend business logic by area:
  - Reader/OCR flow: `frontend/src/lib/states/reader/` and `frontend/src/lib/utils/ocr/`.
  - Metadata + scraping: `frontend/src/lib/states/metadata/` and `frontend/src/lib/states/scraping/`.
  - Contributions/rebase: `frontend/src/lib/states/contributions/` and `frontend/src/lib/states/rebase/`.
  - Selection + UI state: `frontend/src/lib/states/selection/` and `frontend/src/lib/states/ui/`.
  - Keybinds + actions: `frontend/src/lib/keybinds/` and `frontend/src/lib/actions/`.
  - Caching + network: `frontend/src/lib/utils/caching/` and `frontend/src/lib/utils/network/`.
- Frontend components by area: `frontend/src/lib/components/` (auth, layout, library, menu, ocr, readers, settings, modals, controls, charts, feedback, media).
- Frontend components (one level deeper):
  - Layout: `frontend/src/lib/components/layout/` and `frontend/src/lib/components/layout/contributions/`.
  - Modals: `frontend/src/lib/components/modals/` with subareas in `frontend/src/lib/components/modals/{contributions,rebase,scraping,statistics,submissions}/`.
  - Settings: `frontend/src/lib/components/settings/` and `frontend/src/lib/components/settings/test-runner/`.
  - Controls: `frontend/src/lib/components/controls/`.
  - Menus: `frontend/src/lib/components/menu/`.
- Tests: `backend/src/__tests__/` and `frontend/src/**/__tests__/`.

## Common workflows
- Dev via Docker (recommended):
  - `docker compose -f docker-compose.dev.yml up`
  - Or `npm run dev:docker` (uses `docker-compose` and injects `VITE_COMMIT_HASH`).
- Backend dev (non-docker): `cd backend && npm run dev`
- Frontend dev (non-docker): `cd frontend && npm run dev`

## Quality gates
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`

## Environment and secrets
- Docker uses `.env` and optional `.env.secrets` (see `.env.secrets.example`).
- JWT and cookie secrets are required for auth in production.

## Notes for changes
- Prefer edits in `backend/` or `frontend/` instead of `data/` or generated files.
- Add brief inline comments or annotations for any new or non-trivial logic you write.
- Add docstrings for new or modified classes, interfaces, functions, and similar structural blocks.
- Prisma migrations are handled by container entrypoint or `backend` dev script.
