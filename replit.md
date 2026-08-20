# Matrix Family Telegram Bot

A production-oriented Telegram webhook bot for Matrix Family membership applications, support, moderation, admin workflows, persistent sessions, Cloudflare D1, and Cloudflare R2 media storage.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — development Express adapter and health endpoint
- `pnpm --filter @workspace/api-server run worker:typecheck` — Cloudflare Worker typecheck
- `pnpm --filter @workspace/api-server run worker:build` — bundle the Worker entry point
- `pnpm --filter @workspace/api-server run worker:dev` — run locally with Wrangler
- `pnpm --filter @workspace/api-server run d1:migrate:local` — apply D1 migrations locally
- `pnpm run typecheck` — full workspace typecheck
- `pnpm run build` — full workspace build

## Architecture

The production entry point is `artifacts/api-server/src/worker.ts`. It uses the Web Fetch API and Cloudflare bindings only:

`Telegram webhook → update handlers → services/repositories → D1 and R2`

The existing Express server remains a lightweight Replit development adapter. It is not the production runtime.

## Production setup

1. Copy `.env.example` to your deployment secret manager and set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `OWNER_TELEGRAM_ID`.
2. Create a D1 database and an R2 bucket, then replace the placeholders in `wrangler.jsonc`.
3. Run `pnpm --filter @workspace/api-server run d1:migrate:remote`.
4. Deploy with `pnpm --filter @workspace/api-server run worker:deploy`.
5. Configure Telegram:

   `https://api.telegram.org/bot<token>/setWebhook?url=https://<worker-domain>/telegram/webhook&secret_token=<secret>`

The Worker validates `X-Telegram-Bot-Api-Secret-Token` before processing updates. Do not put real secrets in `wrangler.jsonc`, `.env.example`, or source control.

## Database

The D1 migration creates users, admins, settings, membership requests, request images, request voice, persistent form sessions, support tickets/messages, audit logs, broadcasts, and broadcast recipients. Media metadata stays in D1; binary storage is designed for the `MEDIA` R2 binding.

## Security

- Admin and Owner authorization is checked against D1 and the Owner secret.
- Callback actions are validated server-side and review updates are atomic (`WHERE status = 'OPEN'`).
- User content is HTML escaped before Telegram messages.
- Sessions expire after one hour and are stored in D1.
- Telegram errors do not crash the webhook handler.

## Known deployment requirement

The Worker requires a real D1 binding and the three Telegram secrets before it can process live updates. This repository intentionally contains placeholders for infrastructure identifiers and no live credentials.