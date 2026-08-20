# Matrix Family Bot — Deploy Guide (Dashboard only, no terminal)

## 1. Create the Worker
Cloudflare Dashboard → Workers & Pages → Create → Worker → give it a name (e.g. `matrix-family-bot`) → Deploy.
Then open the Worker → **Edit code** and paste the contents of `worker.js`, replacing the default code. Save & Deploy.

## 2. Create and bind the D1 database
Workers & Pages → D1 → Create database (e.g. `matrix-family-db`).
Then open your Worker → Settings → Bindings → Add → D1 Database:
- Variable name: `DB`
- Database: the one you just created

You do **not** need to run any migration or SQL — the Worker creates all tables itself on first request.

## 3. Add secrets
Worker → Settings → Variables and Secrets → Add secret, three times:
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_WEBHOOK_SECRET` — any long random string you choose
- `OWNER_TELEGRAM_ID` — your numeric Telegram user ID

Save (this redeploys automatically).

## 4. Activate the Telegram webhook
In your browser, visit:

```
https://<your-worker-subdomain>.workers.dev/setup?token=<TELEGRAM_WEBHOOK_SECRET>
```

(use the same value you set for `TELEGRAM_WEBHOOK_SECRET`). You should see a JSON response with `"ok": true`. That's it — the bot is live.

## Notes
- Only one binding is required: `DB` (D1).
- No R2, KV, Queues, or Durable Objects are used.
- No `npm install`, `wrangler`, or SQL commands are ever required.
- Broadcasts process in batches automatically across incoming webhook calls, so large member lists don't block or time out the Worker.
