# AGENTS.md

Quackback — open-source customer feedback platform. Bun monorepo (`apps/web` TanStack Start app, `packages/*`, `scripts/*`), PostgreSQL + Drizzle, BullMQ on a Redis-compatible store, Tailwind v4 + shadcn/ui. See `CLAUDE.md` for repository conventions (TypeIDs, UI sizing, tier limits) and `README.md` for the tech stack.

## Cursor Cloud specific instructions

The Cloud Agent environment is defined by the committed files in `.cursor/` (`environment.json` → Dockerfile base + `install.sh` + `start.sh`). These are the source of truth; do not duplicate their contents into a dashboard/snapshot update script. The Dockerfile provides Bun (pinned to `packageManager` in `package.json`) and Docker Engine; `install.sh` runs `bun install --frozen-lockfile` and builds the widget; `start.sh` boots the datastores and applies migrations per boot.

Services (all local, no cloud credentials needed for core dev):

| Service    | What it is                                                              | How it runs                                                                                                               |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `web`      | The app — TanStack Start, serves http://localhost:3000                  | `bun run dev` (the `dev` terminal). Root `/` redirects to the public portal; admin is at `/admin` (login `/admin/login`). |
| PostgreSQL | App DB, with `pg_cron` + `pgvector` (custom image in `docker/postgres`) | `docker compose up -d postgres` — port 5432, `postgres`/`password`                                                        |
| MinIO      | S3-compatible storage for uploads; console on :9001                     | `docker compose up -d minio minio-init` — bucket `quackback` auto-created                                                 |
| Dragonfly  | Redis-compatible store for BullMQ queues                                | `docker compose up -d dragonfly` — port 6379                                                                              |
| Mailpit    | Catches outbound dev email; web UI on :8025                             | `docker compose up -d mailpit`                                                                                            |

Non-obvious gotchas:

- Docker runs nested inside the VM via `dockerd` with the `fuse-overlayfs` storage driver and `containerd-snapshotter` disabled (see `.cursor/Dockerfile` `daemon.json`). On Docker 29+, leaving `containerd-snapshotter` enabled breaks `fuse-overlayfs`. `iptables` must be set to the legacy backend. `start.sh` launches `dockerd` per boot; if `docker` commands fail with "Cannot connect to the Docker daemon", it is not running — start it and `sudo chmod 666 /var/run/docker.sock`.
- `docker-compose.yml` is dev infrastructure only (no app service); the app runs on the host via `bun run dev`. `docker-compose.prod.yml` is the self-host bundle (do not use it for dev).
- Two databases exist: `quackback` (dev) and `quackback_test` (used by the DB-backed parts of the test suite). `start.sh` creates and migrates both. Point `DATABASE_URL` at `quackback_test` only for tests.
- `.env` is created from `.env.example` with a generated `SECRET_KEY`; it is gitignored. Do not quote values or add inline comments in `.env` — Docker's env-file parser reads them literally.
- `apps/web` imports the built widget bundle (`packages/widget/dist/browser.js`) via Vite `?raw`, so `packages/widget` must be built before any web `build`. `install.sh` handles this; if a web build fails on a missing `browser.js`, run `bun run --filter @quackback/widget build`.
- `bun run test` starts Vitest in watch mode. For a single run use `bunx vitest run [path]`. The root suite excludes `*-integration.test.ts` and the widget package (own config); run the DB-backed API integration test with `bun run test:api`.
- AI, external email (SMTP/Resend/IMAP), and third-party integrations are all opt-in via `.env` and are OFF by default — core feedback flows work without any keys.
