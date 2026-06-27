---
id: SPEC-278
title: MercadoLibre OAuth refresh-token flow (make the ML import tier production-viable)
status: draft
type: feature
complexity: high
dependsOn: []
---

# SPEC-278 — MercadoLibre OAuth refresh-token flow

> Unblocks the MercadoLibre accommodation-import tier (and SPEC-258 A3 enrichment),
> which is **not production-viable today**: it authenticates with a single static
> access token that expires in ~6 hours and has no refresh path, so the tier dies
> silently until someone manually rotates the token and redeploys.

## 1. Problem

The MercadoLibre import adapter calls the official ML Items API
(`GET https://api.mercadolibre.com/items/{id}`) with a **static Bearer token**:

- `apps/api/src/utils/env.ts:613` — `HOSPEDA_MERCADOLIBRE_TOKEN: z.string().optional()`
- `apps/api/src/routes/accommodation/protected/import-from-url.ts:322` —
  `mercadoLibreToken: env.HOSPEDA_MERCADOLIBRE_TOKEN`
- `packages/service-core/.../adapters/mercadolibre.adapter.ts:338,355-357` —
  `Authorization: Bearer ${ctx.credentials.mercadoLibreToken}`

**ML access tokens expire in ~6 hours.** There is no refresh logic anywhere. Once
the token lapses, every ML import returns `401` → the adapter degrades to
`credentials_missing` (SPEC-258 C.1) and the tier is dead until a human pastes a
fresh token into Coolify and redeploys. This is operationally unsustainable and is
why **SPEC-258 A3** (ML field enrichment: 2nd call to `/items/{id}/description`,
`attributes` scan for `PROPERTY_TYPE`/`BEDS`/amenities) was deferred — enriching an
unusable tier is wasted effort. Filed as Linear **BETA-96**.

## 2. Goal

Replace the static token with a proper **OAuth 2.0 authorization-code + refresh-token
rotation** flow and a token service that always hands the adapter a valid access
token, refreshing transparently. After this lands, the ML tier survives indefinitely
without manual intervention and A3 can resume.

## 3. Background — MercadoLibre OAuth specifics

ML uses standard OAuth 2.0 with a few sharp edges (verify against current ML docs at
implementation time — do NOT hardcode from memory):

- **Authorization**: redirect the operator to
  `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=<APP_ID>&redirect_uri=<CB>`.
- **Token exchange**: `POST https://api.mercadolibre.com/oauth/token` with
  `grant_type=authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`.
- **Refresh**: same endpoint with `grant_type=refresh_token`. ML uses **single-use
  refresh tokens (rotation)** — each refresh returns a NEW `refresh_token` that
  invalidates the previous one. The new value MUST be persisted atomically or the
  chain breaks and re-auth is required.
- **TTLs** (verify): access token ~6h (`expires_in` ≈ 21600s), refresh token ~6
  months. A refresh token unused past its window forces a fresh authorization.
- **Account model**: the import reads item data via a Hospeda **service account**
  (one ML account that owns the app), NOT per-end-user auth. So the OAuth dance is a
  one-time admin setup, and the persisted credential is a single app-level token,
  not one-per-user.

## 4. Scope

1. **OAuth app config** — `client_id` / `client_secret` / `redirect_uri` as new env
   vars (registered in `@repo/config` registry + Zod + `.env.example` + Coolify, per
   the env-var workflow). Keep `HOSPEDA_MERCADOLIBRE_TOKEN` only as a deprecated
   fallback during migration, then remove.
2. **Authorization + callback (admin-only)** — an admin endpoint to start the OAuth
   redirect and a callback route that exchanges the `code` for the initial
   access+refresh token pair. Behind admin permission.
3. **Credential persistence** — store the rotating `refresh_token` + current
   `access_token` + `expires_at` in the DB, **encrypted at rest**. New table (e.g.
   `external_oauth_credentials`, keyed by provider) or a typed settings row — decide
   at planning. Single row for the ML service account.
4. **Token service** — `getValidMercadoLibreToken()` in service-core: returns a live
   access token; if expired or within a refresh margin, calls the refresh endpoint,
   **persists the rotated refresh_token atomically**, and returns the new access
   token. Must be concurrency-safe (two imports refreshing at once must not clobber
   the rotation — a row lock / single-flight).
5. **Wire the adapter** — replace the static `ctx.credentials.mercadoLibreToken`
   with a token-provider port so the adapter stays decoupled (same pattern as
   `aiExtract`). On a refresh failure, degrade to `credentials_missing` (C.1 contract
   unchanged) and surface an admin-facing alert that re-auth is needed.
6. **Resume SPEC-258 A3** — once the tier is alive, add ML field enrichment: 2nd call
   to `/items/{id}/description` → `description`; scan `attributes` for
   `PROPERTY_TYPE`/`REAL_ESTATE_TYPE` → `type`, `BEDS` → `extraInfo.beds`, amenity
   attrs → `amenityNames`. (Could be a follow-up PR within this spec or split.)

## 5. Out of scope

- Per-end-user MercadoLibre OAuth (e.g. importing from a host's own ML account) —
  the import uses a Hospeda service account only.
- Selling/publishing to MercadoLibre, ML order/webhook integration — read-only item
  import only.
- A generic multi-provider OAuth framework — design the storage so it COULD extend
  to other providers, but only ML is in scope.

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Refresh-token rotation race (two concurrent refreshes invalidate each other) | High | Single-flight / row lock around refresh+persist; only one refresh in flight |
| Refresh token lost / chain broken | High | Encrypted persistence + atomic write of the rotated value; admin re-auth path + alert |
| Secret leakage (client_secret, tokens) | High | Secrets in Coolify (not committed); tokens encrypted at rest; never logged |
| ML API/contract drift (endpoints, TTLs) | Medium | Verify against live ML docs at implementation; non-mocked smoke against the ML sandbox/service account |
| Token service adds latency to every import | Low | Cache the access token in memory/DB until near expiry; refresh only on margin |

## 7. Open questions (resolve before atomizing)

1. **Storage** — new `external_oauth_credentials` table vs. a typed settings row? How
   is encryption keyed (existing app crypto util vs. a new KMS-style secret)?
2. **Service account** — does Hospeda already have a dedicated ML account + registered
   OAuth app, or does that need to be created first (ops prerequisite)?
3. **Refresh strategy** — lazy-on-use (refresh when within margin of expiry) only, or
   also a proactive keep-alive cron so the refresh token never lapses from disuse?
4. **A3 in this spec or split** — fold ML enrichment into this spec once the tier is
   live, or keep this spec to "make it viable" and do A3 as a separate follow-up?
5. **Migration** — keep `HOSPEDA_MERCADOLIBRE_TOKEN` as a fallback during rollout, or
   hard-cut to OAuth? If the OAuth setup isn't done, should the tier stay disabled
   rather than half-working?

## 8. References

- Linear **BETA-96** (ML OAuth refresh-token flow, blocks SPEC-258 A3).
- SPEC-258 (accommodation import; A3 deferred here). SPEC-258 C.1 failure-mode
  contract (`credentials_missing`) is the degradation target on refresh failure.

## Revision history

- 2026-06-24 — Spec created (draft) at owner request, formalizing Linear BETA-96. The
  static-token blocker was discovered during SPEC-258 workstream A (2026-06-23) and
  A3 was deferred pending this. Open questions for the owner before atomization.
