---
title: Social Posts — Settings Enforcement Fix
linear: HOS-64
statusSource: linear
created: 2026-07-02
updated: 2026-07-02
type: fix
areas:
  - content
  - api
  - admin
  - db
---

# Social Posts — Settings Enforcement Fix

> Sub-spec of [HOS-13](https://linear.app/hospeda-beta/issue/HOS-13) (Social Posts
> Module Overhaul), split "297a" per the discovery phase. See
> `.specs/HOS-13-social-posts-module-overhaul/spec.md` OQ-2/G-1 for the full audit
> that produced this scope.
>
> **Scope expanded 2026-07-02** during implementation kickoff: while resolving G-2
> (which hard-coded constants to promote to settings) and G-3 (the
> `make_webhook_url`/`HOSPEDA_MAKE_API_KEY` storage asymmetry) with the owner,
> investigation found `social_settings` has NO encryption at rest (masking is
> cosmetic, service-layer only, and bypassed by raw-model reads) and that the
> operator PIN check is a known, already-flagged piece of tech debt ("TEMPORARY:
> restore a hashed comparison before production" — `packages/config/src/env-registry.hospeda.ts`).
> The owner decided to fold a proper secrets vault (G-4) into this spec rather than
> defer it.

## 1. Summary

The discovery audit for HOS-13 found the original premise wrong: all 7 seeded
`social_settings` rows ARE read at runtime. The real gaps are: (1) one genuine
server-side enforcement bug (G-1), (2) several operational constants that were
never modeled as settings (G-2), and (3) four social-module secrets that are
currently stored with no encryption at rest — plaintext env vars or a plaintext
DB column — that need a proper encrypted vault (G-4), following the pattern
already proven by the AI Vault (SPEC-173).

## 2. Problem

### 2a. Enforcement gap (G-1)

`max_hashtags_instagram/facebook/x` settings are read and surfaced to the GPT as
advisory text via `/api/v1/ai/social/catalog`, but nothing enforces them
server-side. An operator changing the setting changes only what the LLM is told,
not what the API accepts — a draft with more hashtags than the configured max is
still ingested without error.

### 2b. Never-modeled operational constants (G-2)

`MAX_RETRY_COUNT` (3), `MAKE_WEBHOOK_TIMEOUT_MS` (40_000),
`DOWNLOAD_TIMEOUT_MS` (15_000), `SOCIAL_ASSETS_FOLDER`, and the dispatch cron
cadence (`*/5 * * * *`) are hard-coded constants with no corresponding
`social_settings` row.

### 2c. Secrets with no encryption at rest (G-4)

Four credentials used by the social posts module are stored insecurely:

- `make_webhook_url` — a `social_settings` row. The `value` column
  (`packages/db/src/schemas/social/social_settings.dbschema.ts:19`) is plain
  `text`, no ciphertext. `maskSecretValue()`
  (`packages/service-core/src/services/social/social-setting.service.ts:22-36`)
  only redacts API *responses* from the permission-gated service — it is
  cosmetic, not encryption, and is bypassed entirely by the raw-model reads in
  `apps/api/src/routes/ai/social/catalog.ts` (lines 28, 107) and
  `social-publish-dispatch.service.ts` (lines 60, 472, 494), both of which get
  the plaintext value.
- `HOSPEDA_MAKE_API_KEY` — plaintext env var, sent as the `x-make-apikey` header.
- `HOSPEDA_AI_SOCIAL_KEY` — plaintext env var, validates the inbound
  `x-hospeda-ai-key` header from the Custom GPT.
- `HOSPEDA_OPERATOR_PIN` — plaintext env var, compared via `timingSafeEqual`
  in `apps/api/src/routes/ai/social/drafts.ts:56-74` against the operator PIN
  the human types into the Custom GPT. A dead legacy var,
  `HOSPEDA_OPERATOR_PIN_HASH`, is still declared but unused — the registry
  explicitly flags this as **"TEMPORARY: restore a hashed comparison
  (HOSPEDA_OPERATOR_PIN_HASH) before production."**

None of these four are encrypted at rest today.

## 3. Goals

- **G-1**: Add server-side validation in the draft ingestion path that
  rejects/truncates a draft's hashtag count against the `max_hashtags_<platform>`
  setting for each target platform.
- **G-2** (narrowed to non-secret operational knobs): promote
  `MAX_RETRY_COUNT`, `MAKE_WEBHOOK_TIMEOUT_MS`, `DOWNLOAD_TIMEOUT_MS`,
  `SOCIAL_ASSETS_FOLDER`, and the dispatch cron cadence to `social_settings`
  rows. None of these are secrets — no encryption needed, they stay in the
  existing plain key-value table.
- **G-4** (supersedes the original G-3 asymmetry question): build a **Social
  Credentials Vault**, extending the AES-256-GCM pattern already proven by the
  AI Vault (SPEC-173: `apps/api/src/utils/ai-vault.ts` +
  `ai_provider_credentials` table + `ai-credential-vault.service.ts` +
  `apps/admin/.../ai/credentials.tsx`), to store these 4 secrets encrypted at
  rest:
  - `make_webhook_url` (migrated off the plaintext `social_settings` row)
  - `HOSPEDA_MAKE_API_KEY` (migrated off env var)
  - `HOSPEDA_AI_SOCIAL_KEY` (migrated off env var)
  - `HOSPEDA_OPERATOR_PIN` (migrated off env var; retires the dead
    `HOSPEDA_OPERATOR_PIN_HASH` too)

  Uses a **dedicated master key** `HOSPEDA_SOCIAL_VAULT_MASTER_KEY` (separate
  blast radius from the AI vault's `HOSPEDA_AI_VAULT_MASTER_KEY`). After the
  one-time migration confirms the vault is populated and code reads from it,
  **all 4 legacy env vars are removed entirely** — no fallback period, no dual
  source of truth (see R-2 for the required deploy sequencing).

## 4. Non-goals

- NG-1: Building new UI for the G-2 operational settings — the existing generic
  settings CRUD admin page (`social/settings/`) already handles new key-value
  rows unaffected.
- NG-2: Migrating any settings currently read correctly (timezone, campaign/batch
  default slugs) — those already work end-to-end.
- NG-3: A generic multi-domain vault abstraction. G-4 creates a
  social-specific table/service mirroring the AI vault's code shape (same
  reasoning the AI vault itself used — no premature cross-domain abstraction).
  Only the low-level crypto primitives (`encryptSecret`/`decryptSecret`) are
  extracted into a shared, domain-agnostic util — the table, service, and audit
  log layers stay domain-specific.

## 5. Current baseline

- `packages/service-core/src/services/social/social-setting.service.ts` —
  permission-gated CRUD (`SOCIAL_SETTINGS_MANAGE`), used only by admin routes.
- Raw `socialSettingModel` reads happen in `social-publish-dispatch.service.ts` and
  `apps/api/src/routes/ai/social/catalog.ts` (no-actor contexts: cron/system/API-key).
- `packages/seed/src/required/socialAutomation.seed.ts:300-351` seeds exactly 7
  `social_settings` rows; all 7 are read somewhere.
- Hashtag count validation gap: confirmed via repo-wide grep for
  `maxHashtags`/`max_hashtags` — zero hits outside `catalog.ts`.
- `apps/api/src/routes/ai/social/drafts.ts:56-74` — `validateOperatorPin()`,
  reads `env.HOSPEDA_OPERATOR_PIN` (plaintext), `timingSafeEqual` against the
  request body's `operatorPin`. The service layer
  (`social-draft-ingestion.service.ts`) explicitly does NOT re-validate the
  PIN — it's route-only, by design.
- `packages/schemas/src/entities/social/social-draft.http.schema.ts:142,247-259`
  — `operatorPin` required string field; comments are stale, still reference
  the old hash-based scheme.
- **AI Vault precedent (SPEC-173)**, the pattern G-4 extends:
  - `apps/api/src/utils/ai-vault.ts` — `encryptSecret`/`decryptSecret`,
    AES-256-GCM, key = `sha256(HOSPEDA_AI_VAULT_MASTER_KEY)`, random 12-byte
    IV, 16-byte auth tag, all base64.
  - `packages/db/src/schemas/ai/ai_provider_credentials.dbschema.ts` —
    `ciphertext`/`iv`/`auth_tag` columns, never plaintext, soft-delete,
    partial unique index per provider.
  - `apps/api/src/services/ai-credential-vault.service.ts` — create/rotate/
    update/delete/decrypt, each mutation paired with an append-only
    `ai_credential_audit` row in the same transaction.
  - `apps/admin/src/routes/_authed/ai/credentials.tsx` — card-based UI,
    password-type inputs, create/rotate/edit-metadata/delete, list shows only
    masked metadata (never ciphertext/iv/authTag).

## 6. Proposed design

### 6.1 G-1 — hashtag enforcement

For each target platform on an incoming draft, look up `max_hashtags_<platform>`
from `social_settings` (reuse the existing raw-model read pattern already used
by `catalog.ts`, since ingestion also runs in a no-actor GPT/API-key context)
and reject or truncate hashtags beyond that count, returning a clear validation
error to the GPT caller. (Reject vs. truncate: decide during implementation —
default to reject with a clear error, since silent truncation could surprise
the operator about what actually got posted.)

### 6.2 G-2 — operational settings

Add 5 new `social_settings` seed rows (`socialAutomation.seed.ts`) for
`MAX_RETRY_COUNT`, `MAKE_WEBHOOK_TIMEOUT_MS`, `DOWNLOAD_TIMEOUT_MS`,
`SOCIAL_ASSETS_FOLDER`, and the cron cadence expression. Replace the
hard-coded constants in `social-publish-dispatch.service.ts` (and wherever the
cron is scheduled) with reads from `social_settings`, reusing the existing
raw-model read pattern (no-actor context). No encryption needed.

### 6.3 G-4 — Social Credentials Vault

**Crypto primitives (shared, extracted)**: pull `encryptSecret`/`decryptSecret`
out of `apps/api/src/utils/ai-vault.ts` into a domain-agnostic util (e.g.
`apps/api/src/utils/secret-vault-crypto.ts`), parameterized by which
master-key env var to use. `ai-vault.ts` becomes a thin wrapper calling the
shared util with `HOSPEDA_AI_VAULT_MASTER_KEY` — a pure extraction, no
behavior change (the AI vault's existing tests must still pass unchanged).

**New table** `social_credentials` (mirrors `ai_provider_credentials`): `id`
(uuid pk), `key` (varchar, unique — `make_webhook_url` / `make_api_key` /
`ai_social_key` / `operator_pin`), `ciphertext` (text), `iv` (text),
`auth_tag` (text), timestamps, soft-delete.

**New table** `social_credential_audit` (mirrors `ai_credential_audit`): one
row per mutation, written in the same transaction as the mutation.

**New service** (mirror the AI vault's location —
`apps/api/src/services/social-credential-vault.service.ts`):
create/rotate/update/delete/decrypt, each paired with an audit row. Uses
`HOSPEDA_SOCIAL_VAULT_MASTER_KEY`.

**Runtime read-sites to migrate** (all become "decrypt from vault" instead of
"read env var / read social_settings row"):

- `validateOperatorPin()` in `drafts.ts` → decrypt `operator_pin`, keep the
  existing `timingSafeEqual` comparison (that part was already correct).
- `x-make-apikey` header send site (dispatch service) → decrypt `make_api_key`.
- `x-hospeda-ai-key` inbound validation → decrypt `ai_social_key`.
- `make_webhook_url` read sites → decrypt from vault; remove the row from
  `social_settings` and from `socialAutomation.seed.ts`.

**Admin UI**: new page mirroring `apps/admin/src/routes/_authed/ai/credentials.tsx`
(e.g. `apps/admin/src/routes/_authed/social/credentials.tsx`) — card-based,
password-type inputs, create/rotate/edit-metadata/delete, list shows only
masked metadata.

**One-time data migration**: a script/task that reads the CURRENT env var
values (and the current `make_webhook_url` social_settings row) and seeds the
vault table with them encrypted. Runs once per environment as part of
rollout — see R-2 for required sequencing before removing the legacy env vars.

## 7. Data model / contracts

- NEW migration: `social_credentials` table (id, key unique, ciphertext, iv,
  auth_tag, timestamps, soft-delete) — via `packages/db/src/migrations/`
  (structural, drizzle-generated).
- NEW migration: `social_credential_audit` table (mirrors
  `ai_credential_audit` shape) — same carril.
- `social_settings`: no schema change. G-2 rows are additive seed data; the
  `make_webhook_url` row is deleted as part of the G-4 migration (data change,
  not schema).
- New admin routes for the vault (path/permission to match the
  `ai-credential-vault` route's convention exactly — confirm during
  implementation whether that reuses `SOCIAL_SETTINGS_MANAGE` or needs a
  dedicated `SOCIAL_CREDENTIALS_MANAGE` permission, matching whatever
  granularity the AI vault's own route uses).

## 8. UX / UI behavior

- G-2: no new UI — existing generic settings CRUD table picks up the 5 new
  rows automatically.
- G-4: new admin page for social credentials, same interaction pattern as the
  AI Credentials page — masked list, password inputs on create/rotate, no
  plaintext round-trip.

## 9. Acceptance criteria

- AC-1: Submitting a draft with hashtags exceeding the configured
  `max_hashtags_<platform>` for any target platform is rejected with a clear
  error, not silently accepted.
- AC-2: A regression test reproduces the current bug (over-limit hashtags
  currently accepted) before the fix.
- AC-3: The 5 non-secret G-2 knobs (retry count, webhook timeout, download
  timeout, assets folder, cron cadence) are `social_settings` rows, read at
  runtime instead of hard-coded constants.
- AC-4: All 4 secrets (`make_webhook_url`, `MAKE_API_KEY`, `AI_SOCIAL_KEY`,
  `OPERATOR_PIN`) are stored encrypted (AES-256-GCM) in `social_credentials`,
  never in plaintext in the DB or in a deployed env var after migration.
- AC-5: Every vault mutation (create/rotate/update/delete) writes exactly one
  `social_credential_audit` row in the same transaction.
- AC-6: The admin UI never renders a decrypted secret value in a list view —
  only on explicit reveal/rotate action.
- AC-7: The legacy env vars (`HOSPEDA_MAKE_API_KEY`, `HOSPEDA_AI_SOCIAL_KEY`,
  `HOSPEDA_OPERATOR_PIN`, `HOSPEDA_OPERATOR_PIN_HASH`) are removed from the
  registry/`env.ts`/`.env.example` after the vault migration runs successfully
  in each environment.

## 10. Risks

- R-1: If a misconfigured retry count or webhook timeout is set via G-2,
  dispatch reliability could degrade — validate bounds (min/max) on these
  settings.
- R-2 (critical sequencing): the one-time data migration must run
  successfully in staging AND prod BEFORE removing the legacy env vars, or
  the social posts flow breaks entirely (operator PIN check, Make.com
  dispatch, GPT auth). Deploy sequence: (1) ship vault code + migration
  script, (2) run the migration per environment, (3) verify vault reads work
  end-to-end, (4) ONLY THEN ship the follow-up removing the legacy env vars.
  Do not remove env vars in the same deploy that introduces the vault.
- R-3: `HOSPEDA_SOCIAL_VAULT_MASTER_KEY` must be set in Coolify for every
  environment before the vault code can decrypt anything — follows this
  repo's standard "new env var" workflow (register → validate → `.env.example`
  → document → set in Coolify → stop and tell the user).

## 11. Open questions

- None outstanding — all prior open items (G-2 knob selection, the G-3
  asymmetry, and secrets scope) were resolved with the owner during
  implementation kickoff (2026-07-02).

## 12. Implementation notes

- Reuse `catalog.ts`'s raw no-actor-context read pattern for G-1/G-2 (unchanged
  advice from the original spec).
- For G-4, follow the AI vault's code shape file-for-file where reasonable
  (table shape, service method names, audit pairing, admin page structure) —
  this repo has zero other precedent for domain-secret vaults, so consistency
  with the one existing example matters more than any bespoke redesign.
- Sequence the implementation: **G-1 first** (independent, smallest, already
  fully speced), then **G-2** (small, additive), then **G-4** (largest, most
  sensitive — migration+deploy sequencing per R-2 matters most here).

## 13. Linear

Canonical tracking:
HOS-64
