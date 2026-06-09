# SPEC-195 — Production enablement runbook

The content auto-moderation engine ships **dark**: the code default is
`HOSPEDA_MODERATION_PROVIDER=stub`, which reproduces the pre-SPEC-195 v1 behavior
(binary blocklist from `HOSPEDA_MESSAGING_BLOCKED_WORDS` / `_BLOCKED_DOMAINS`). No
user text leaves the platform and no decision changes until you complete the steps below.

Decision (SPEC-195 §3): production runs **`openai` with fallback to `local`**.

## 1. Apply DB changes

On the VPS:

```bash
# Runs drizzle-kit migrate (0009 = enums + tables) AND apply-extras
# (012 = pending<reject CHECK, 013 = idempotent grants + default threshold row).
hops db-migrate --target=prod
```

Extras 013 grants the 10 `MODERATION_*` permissions to `admin` + `super_admin` and
ensures the `default` threshold row exists. Both are idempotent.

Optional — import the legacy env blocklist into the editable `content_moderation_terms`
corpus (only needed if you want the `local` fallback seeded from the old env vars;
admins can also add terms via the UI):

```bash
hops db-seed --target=prod --no-reset --no-example --pull --yes
```

## 2. Set env vars in Coolify (`hospeda-api-prod`)

| Key | Value | Notes |
| --- | --- | --- |
| `HOSPEDA_MODERATION_PROVIDER` | `openai` | switches the engine on |
| `HOSPEDA_OPENAI_API_KEY` | `sk-...` | **secret**; required when provider=openai |
| `HOSPEDA_MODERATION_TIMEOUT_MS` | `1500` | optional (default 1500) |
| `HOSPEDA_MODERATION_CACHE_TTL_SECONDS` | `300` | optional (default 300) |

CLI path:

```bash
hops env-set api HOSPEDA_MODERATION_PROVIDER openai
hops env-set api --secret HOSPEDA_OPENAI_API_KEY     # masked prompt
hops redeploy api
```

If `provider=openai` is set without a non-empty key, the engine throws
`EngineConfigError` at init — set the key first.

## 3. Verify

- API health: `GET /api/v1/admin/content-moderation/health` → `provider: "openai"`,
  `degradedCountLast24Hours: 0`.
- Admin panel → Content → Moderation terms / thresholds: list loads, an ADMIN user
  (not just super-admin) can edit a term and the `default` threshold.
- Post a clearly abusive test review/message → expect PENDING (review) or block
  (message); a clean one passes.
- Sentry: degraded-fallback events appear if OpenAI is unreachable (engine hook).

## 4. Rollback / kill-switch

Set `HOSPEDA_MODERATION_PROVIDER=stub` (or `local`) and redeploy. `stub` restores exact
v1 behavior with no external calls. No DB rollback is needed (all changes are additive).
