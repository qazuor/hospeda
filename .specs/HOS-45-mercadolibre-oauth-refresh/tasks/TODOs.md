# HOS-45: MercadoLibre OAuth refresh-token flow

## Progress: 18/19 tasks (95%) + 1 cancelled (T-003, superseded — see below)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-001 -> T-004 -> T-005 -> T-008 -> T-009 -> T-010 -> T-014 -> T-015 -> T-019 (9 steps) — DONE
**Status:** Implementation complete. All lint/typecheck/test gates green across every touched package (apps/api, packages/db, packages/config, packages/schemas, packages/service-core).

> Architecture note: crypto + the token service live in `apps/api` (mirrors the
> existing `ai-vault.ts` + `ai_provider_credentials` isolation pattern — AC-4).
> `packages/service-core` never touches the vault; it only receives a
> `mercadoLibreTokenProvider` port on `ImportContext`, mirroring the existing
> `aiExtract` port. SPEC-258 A3 (ML field enrichment) is explicitly OUT of this
> task set — follow-up spec once this lands.

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Register MercadoLibre OAuth + vault env vars

### Core Phase

- [x] **T-002** (complexity: 3) - Create external_oauth_credentials table + migration (0042_clear_tyrannus.sql)
- [x] ~~**T-003** (complexity: 2) - Create ExternalOauthCredentialModel + unit tests~~ **CANCELLED**
  - Superseded: `ai-credential-vault.service.ts` precedent shows no Model layer is used for credential vaults in this repo — T-005 queries the table directly.
- [x] **T-004** (complexity: 2) - Implement OAuth vault crypto util in apps/api (`oauth-vault.ts`, mirrors `ai-vault.ts`)
- [x] **T-005** (complexity: 3) - Implement ML credential repository (`ml-credential.repository.ts`)
- [x] **T-006** (complexity: 2) - Implement ML OAuth API client (`ml-oauth-client.ts`)
- [x] **T-007** (complexity: 1) - Define MLTokenRefreshError with terminal/transient classification
- [x] **T-008** (complexity: 3) - Implement token read/cache/expiry-check logic
- [x] **T-009** (complexity: 3) - Implement concurrency-safe refresh + atomic persist (single-flight guard)
- [x] **T-010** (complexity: 2) - Implement admin re-auth alert on terminal refresh failure

### Integration Phase

- [x] **T-011** (complexity: 2) - Admin-only OAuth authorization-start endpoint (`GET /api/v1/admin/mercadolibre-oauth/authorize`)
- [x] **T-012** (complexity: 3) - OAuth callback route (`GET /api/v1/admin/mercadolibre-oauth/callback`)
- [x] **T-013** (complexity: 3) - Add token-provider port to ImportContext + wire injection
- [x] **T-014** (complexity: 3) - Rewire ML adapter to token-provider port + credentials_missing degradation

### Cleanup Phase

- [x] **T-015** (complexity: 2) - Remove HOSPEDA_MERCADOLIBRE_TOKEN entirely (hard-cut, no fallback)

### Testing Phase

- [x] **T-016** (complexity: 3) - Integration tests: OAuth authorization+callback flow
- [x] **T-017** (complexity: 2) - Integration tests: token refresh + concurrency race
- [x] **T-018** (complexity: 2) - Integration tests: adapter degradation + alert

### Docs Phase

- [x] **T-019** (complexity: 1) - Update env-var + import docs for ML OAuth

---

## Notable discoveries during implementation

1. **T-003 cancelled**: the real precedent for encrypted credential vaults in this repo (`ai-credential-vault.service.ts`) queries the Drizzle table directly from `apps/api`, no `packages/db` Model layer — the original task plan assumed a Model that doesn't match established convention.
2. **T-011 hardening**: the authorize route would have silently redirected to MercadoLibre with empty `client_id`/`redirect_uri` if unconfigured — fixed to return 503 with a regression test.
3. **T-010 discovery**: `NotificationType.ADMIN_SYSTEM_EVENT` existed in `@repo/notifications` but was dead code (zero call sites) before this task wired it up.
4. **T-015 discovery**: a pre-existing drift in `packages/config/src/__tests__/env-registry.test.ts`'s `EXPECTED_VAR_COUNT` snapshot (stale from T-001's 4 new vars never bumping it) — fixed as part of cleanup.
5. **Out of scope, confirmed deliberately deferred**: SPEC-258 A3 (ML field enrichment) — separate follow-up spec once this tier is live in production.

## Follow-ups for the owner (not part of this spec's scope)

- Set real `HOSPEDA_MERCADOLIBRE_CLIENT_ID` / `_CLIENT_SECRET` / `_REDIRECT_URI` / `HOSPEDA_OAUTH_VAULT_MASTER_KEY` values in Coolify for staging/prod, then run the one-time authorization flow (`GET /api/v1/admin/mercadolibre-oauth/authorize`) to provision the initial credential.
- Run `pnpm db:apply-extras`/`pnpm db:migrate` (migration `0042_clear_tyrannus.sql`) on staging/prod.
- Staging smoke test against the real MercadoLibre OAuth sandbox before promoting to `main` (this repo's billing-style manual smoke discipline applies to any live third-party OAuth integration).
