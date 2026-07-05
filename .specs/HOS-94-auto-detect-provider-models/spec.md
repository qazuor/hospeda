---
title: Auto-detect provider models (sync model catalog from provider API) — hybrid
linear: HOS-94
statusSource: linear
created: 2026-07-05
type: feature
areas:
  - api
  - admin
---

# Auto-detect provider models (sync model catalog from provider API) — hybrid

## 1. Summary

Let the admin panel **auto-detect** the list of models available for an AI provider
by querying that provider's list-models endpoint with the stored (decrypted) API
key, instead of maintaining the list entirely by hand against a hardcoded catalog.

The chosen shape is **Option 2 — hybrid**: auto-detection feeds a curated list. The
provider's raw model list is fetched, filtered to chat/text-generation-capable
models, and merged with the existing hardcoded `KNOWN_PROVIDERS` catalog (which
keeps supplying curated metadata: baseURL, suggested defaults, capabilities). The
operator still toggles which detected models are enabled and can still add custom
ones manually. The result persists to `ai_provider_credentials.metadata.models`,
exactly as today.

## 2. Problem

Today the per-provider model list is maintained **manually**:

- The enabled-models list for each provider lives in
  `ai_provider_credentials.metadata.models` (a free-form JSONB array).
- The admin UI (`apps/admin/src/routes/_authed/ai/credentials.tsx`) drives it
  against a **hardcoded** `KNOWN_PROVIDERS` catalog (11 providers, each with a
  suggested `models: string[]`, `baseURL`, `keyUrl`). The operator toggles the
  suggested models and can add custom ones.

Consequences:

- Every time a provider ships a new model (OpenAI, Anthropic, etc.), someone has to
  **edit code and redeploy** to surface it in the suggested list.
- The hardcoded catalog silently goes stale; the operator has no in-product way to
  discover "what models does my key actually have access to right now?".

The owner asked for auto-detection directly: put an API key, and the panel pulls the
available models and self-manages the list.

## 3. Goals

- **G-1** — Add a **list-models capability** to the provider layer that, given a
  provider's decrypted credential, returns the raw model IDs the account has access
  to. Implemented as a **direct REST fetch** per provider (the Vercel AI SDK does
  not expose list-models), so it is decoupled from the AI SDK generate/stream types.
- **G-2** — Add an admin API endpoint that decrypts the credential, calls the
  provider's list-models, **filters** to chat/text-capable models, **merges** with
  the `KNOWN_PROVIDERS` curated metadata, and returns the resulting suggested list
  (detected ∪ curated, de-duplicated, annotated by source).
- **G-3** — Wire the admin credentials UI: a **"Sync models"** action per provider
  that calls the endpoint, shows detected-vs-curated, and preserves the existing
  toggle + custom-add UX. The enabled selection persists to `metadata.models` via
  the existing `PATCH /{providerId}` route.
- **G-4** — Handle the provider-specific differences: OpenAI / OpenAI-compatible
  (`GET /v1/models`), Anthropic (`GET /v1/models`), Google Gemini
  (`GET /v1beta/models`), and the **Ollama special case** (`/api/tags`), plus
  base-URL-driven compatible providers.
- **G-5** — Robust error handling: invalid/expired key, provider unreachable, rate
  limit, unexpected response shape — surfaced as typed, actionable errors in the UI
  without breaking the credentials page.

## 4. Non-goals

- **NG-1** — Auto-populating `modelRates` / pricing. No provider list-models
  endpoint returns pricing or context-window metadata; cost rates stay curated
  (in-code `MODEL_RATES` + admin `ai_settings.modelRates` overrides).
- **NG-2** — Changing how the **per-feature active model** is selected. That lives
  in `ai_settings` (`{ primaryProvider, fallbackChain, model, params }`) and is out
  of scope; this spec only manages the *catalog of available models per provider*.
- **NG-3** — Adding new providers or new provider adapters. Only list-models on the
  providers already supported.
- **NG-4** — Auto-enabling detected models. Detection **suggests**; the operator
  always confirms what gets enabled (unless OQ-3 decides otherwise).

## 5. Current baseline

Relevant files (all read during discovery):

- **Credential vault (storage + crypto)**
  - `packages/db/src/schemas/ai/ai_provider_credentials.dbschema.ts` — table with
    `providerId`, AES-256-GCM `ciphertext`/`iv`/`authTag`, `label`, `metadata`
    (jsonb), partial unique index → one active credential per provider.
  - `apps/api/src/services/ai-credential-vault.service.ts` — `createAiProviderCredential`,
    `rotateAiProviderCredential`, `updateCredentialMetadata`, `deleteAiProviderCredential`,
    `listAiProviderCredentials`, **`getDecryptedAiProviderCredential`** (the decrypt
    primitive this spec reuses).
  - `apps/api/src/utils/ai-vault.ts` — `encryptSecret`/`decryptSecret`, keyed by
    `HOSPEDA_AI_VAULT_MASTER_KEY`.
- **Admin credential routes** — `apps/api/src/routes/ai/credentials/index.ts`:
  `GET /`, `POST /`, `POST /{providerId}/rotate`, `PATCH /{providerId}`,
  `DELETE /{providerId}`. All via `createAdminRoute` / `createAdminListRoute`, gated
  by `PermissionEnum.AI_SETTINGS_MANAGE` (SUPER_ADMIN). Mounted at
  `/api/v1/admin/ai/credentials`.
- **Zod schemas** — `packages/schemas/src/entities/ai/ai-credential.schema.ts`
  (`AiCredentialMaskedSchema`, `...CreateInputSchema`, `...UpdateInputSchema`,
  `...MutationResultSchema`) and `ai-provider.schema.ts` (`AiProviderIdSchema`,
  `AiFeatureSchema`). `metadata` is `z.record(z.string(), z.unknown())` — the
  `{ baseURL, models }` shape is a convention, not enforced today.
- **Provider abstraction** — `packages/ai-core/src/providers/ai-provider.interface.ts`
  (`interface AiProvider`, credential injected at construction) + adapters
  `vercel-openai.adapter.ts` (`OpenAiAdapter`, also handles OpenAI-compatible via
  `baseURL`), `vercel-anthropic.adapter.ts` (`AnthropicAdapter`), `stub.provider.ts`.
  Vendor SDK imports are **confined to `src/providers/`** (CI-enforced,
  `ac4-isolation-guard.test.ts`).
- **Instantiation from stored keys** —
  `apps/api/src/services/ai-service.factory.ts::createConfiguredAiService()` +
  `buildGetProvider(keyMap, metadataMap)` — synchronous factory; any provider ID
  that isn't openai/anthropic/stub → `OpenAiAdapter` with `metadata.baseURL`.
- **Admin UI** — `apps/admin/src/routes/_authed/ai/credentials.tsx`:
  `KNOWN_PROVIDERS` (11 providers, suggested `models`/`baseURL`/`keyUrl`), the
  toggle/custom-add UX, and `apps/admin/src/features/ai-settings/hooks.ts`
  (TanStack Query hooks: `useAiCredentialsQuery`, `useUpdateAiCredentialMutation`, …).

Key constraint: **`ai-core` never reads env or vault secrets** — credentials arrive
by parameter from `apps/api`. So the decrypt-and-call orchestration lives in
`apps/api`; only the provider-specific HTTP shape can live in `ai-core/providers`
(or a dedicated fetcher — see OQ-4).

## 6. Proposed design

Three layers, mirroring the existing credential flow.

### 6.1 Provider layer — list-models capability

Add a list-models operation to the provider layer. Two viable homes (OQ-4):

- **(a)** A new `listModels()` method on the `AiProvider` interface, implemented by
  each adapter as a **direct REST `fetch`** (NOT through the AI SDK). Pro: single
  provider contract. Con: touches the interface + every adapter, and overlaps with
  HOS-88's edits to `vercel-openai.adapter.ts`.
- **(b)** A standalone `listProviderModels({ providerId, apiKey, baseURL })` fetcher
  module in `ai-core/providers/` (or a small `apps/api` service), separate from the
  `AiProvider` interface. Pro: fully decoupled from the generate/stream contract and
  from HOS-88's type changes; simpler. Con: a second provider dispatch surface
  alongside `buildGetProvider`.

Either way, the per-provider HTTP shape is:

| Provider family | Endpoint | Auth | Notes |
|---|---|---|---|
| OpenAI + OpenAI-compatible (Groq, DeepSeek, Together, Mistral, Moonshot, Zhipu, Baidu) | `GET {baseURL|https://api.openai.com/v1}/models` | `Authorization: Bearer <key>` | `data[].id` |
| Anthropic | `GET https://api.anthropic.com/v1/models` | `x-api-key: <key>` + `anthropic-version` | `data[].id` |
| Google Gemini | `GET https://generativelanguage.googleapis.com/v1beta/models?key=<key>` | query param | `models[].name` (strip `models/` prefix) |
| Ollama | `GET {baseURL}/api/tags` | none (local) | `models[].name` |

### 6.2 Filtering (detected → chat-capable)

The raw list includes embeddings, tts, whisper, dall-e, moderation, and deprecated
models. Filter to chat/text-generation-capable models. Strategy is OQ-1; the leading
approach is a **per-provider classifier**: a denylist of known non-chat families
(`text-embedding`, `whisper`, `tts`, `dall-e`, `*-moderation`, …) plus, where the
provider exposes it, any capability hint. Anything the classifier can't confidently
place is surfaced as "uncertain — enable manually" rather than dropped silently.

### 6.3 Merge (detected ∪ curated)

Merge the filtered detected list with `KNOWN_PROVIDERS[providerId].models`:

- Model in both → curated metadata wins, flagged `source: 'both'`.
- Detected only → `source: 'detected'` (this is the value-add: brand-new models).
- Curated only → `source: 'curated'` (kept so a temporarily-missing model doesn't
  vanish from the UI).

`KNOWN_PROVIDERS` shifts from "source of truth for which models exist" to "source of
curated metadata". Whether the merged catalog is DB-backed or stays in-code UI
config is OQ-3.

### 6.4 API endpoint

New admin route under the existing credentials router
(`/api/v1/admin/ai/credentials`), gated by `PermissionEnum.AI_SETTINGS_MANAGE`,
built with `createAdminRoute`:

```
POST /api/v1/admin/ai/credentials/{providerId}/sync-models   (action-POST; see note)
```

Handler: resolve actor → `getDecryptedAiProviderCredential(providerId)` → call the
list-models fetcher (with `metadata.baseURL` when present) → filter → merge → return
the annotated suggested list. It does **not** auto-write `metadata.models` (NG-4 /
OQ-2); persistence stays with the existing `PATCH /{providerId}` once the operator
confirms. Action-POST (not GET) because it triggers an outbound side-effecting call
with a provider cost/rate-limit footprint and must not be cached.

### 6.5 Admin UI

In `credentials.tsx`, add a **"Sync models"** button per provider row. On click it
calls the new endpoint (new TanStack Query mutation in
`features/ai-settings/hooks.ts`), then renders detected/curated/both with source
badges. The existing enable-toggle + custom-add UX is preserved; confirming writes
`metadata.models` via the existing update mutation. Loading, empty ("no models
detected"), and error states (bad key / provider down / rate limit) are explicit.

## 7. Data model / contracts

- **No DB migration required for the minimal path.** The enabled list continues to
  live in `ai_provider_credentials.metadata.models`; only the *source* of
  suggestions changes. (If OQ-3 chooses to persist the full detected catalog with
  timestamps/source, that adds a column or a `metadata.detectedModels` sub-object —
  decide in Phase 2.)
- **New Zod schemas** in `packages/schemas/src/entities/ai/`:
  - `AiProviderModelSchema` — `{ id: string, source: 'detected'|'curated'|'both',
    label?: string, capabilityHint?: string, deprecated?: boolean }`.
  - `AiSyncModelsResultSchema` — `{ providerId, models: AiProviderModel[],
    fetchedAt: string, warnings?: string[] }`.
- **New route** — `POST /api/v1/admin/ai/credentials/{providerId}/sync-models`,
  `requestParams: { providerId }`, `responseSchema: AiSyncModelsResultSchema`,
  `requiredPermissions: [AI_SETTINGS_MANAGE]`.
- **Provider-layer contract** — either `AiProvider.listModels()` returning
  `readonly string[]` (raw IDs) or `listProviderModels(input): Promise<{ ids: string[] }>`
  (OQ-4). Filtering/merging happens in `apps/api`, not in the adapter, to keep the
  adapter dumb and the classifier testable in isolation.
- **Errors** — reuse the AI error family: invalid key → typed
  `PROVIDER_UNCONFIGURED`/auth error; upstream failure → a `SYNC_MODELS_FAILED`
  ServiceError mapped to a 4xx/5xx with a human message.

## 8. UX / UI behavior

- Each configured provider on the credentials page gets a **"Sync models"** button.
- Clicking it fetches and shows the merged list, grouped/badged by source
  (`Detected`, `Curated`, `Both`). New detected models are visually highlighted.
- The operator toggles which models are enabled (unchanged mechanic) and can still
  type a custom model ID. "Save" persists the enabled set to `metadata.models`.
- States: loading spinner during sync; "No chat models detected for this key" empty
  state; inline error banner for auth/network/rate-limit with a retry.
- Nothing auto-enables; sync only refreshes the suggestion pool (NG-4 / OQ-2).

## 9. Acceptance criteria

- **AC-1** — With a valid OpenAI credential stored, clicking "Sync models" returns a
  filtered list of OpenAI chat models (no embeddings/tts/whisper/dall-e), merged with
  the curated catalog, each annotated by source.
- **AC-2** — Anthropic, an OpenAI-compatible provider (via `baseURL`), Google Gemini,
  and Ollama each return a correctly-parsed, filtered list through their respective
  endpoint shapes. Ollama uses `/api/tags`; Gemini strips the `models/` prefix.
- **AC-3** — The endpoint requires `AI_SETTINGS_MANAGE`; a non-super-admin gets 403.
- **AC-4** — Invalid/expired key → typed, human-readable error in the UI; the
  credentials page stays functional (no crash, other providers unaffected).
- **AC-5** — Confirming a selection persists to `metadata.models` via the existing
  `PATCH /{providerId}`; a page reload shows the persisted enabled set.
- **AC-6** — The AI SDK isolation guard still passes (no `ai`/`@ai-sdk/*` import
  outside `src/providers/`); `ai-core` reads no env/secret.
- **AC-7** — Unit tests cover the per-provider parser + the chat-capability filter +
  the merge (detected/curated/both), using fixtures — **no real provider calls**
  (StubProvider only, per `ai-core` testing rules).

## 10. Risks

- **R-1 — HOS-88 file overlap.** The AI SDK v4 migration (HOS-88) edits
  `vercel-openai.adapter.ts`; a `listModels` method on the adapter overlaps. Mitigation:
  prefer the standalone-fetcher home (OQ-4 option b), or land after HOS-88 / rebase.
- **R-2 — Dirty detection lists.** Provider list-models responses mix in non-chat
  models; a weak filter pollutes the UI. Mitigation: conservative per-provider
  classifier + "uncertain" bucket instead of silent drops.
- **R-3 — Provider API drift.** Endpoints/response shapes change over time (Anthropic
  only recently shipped `/v1/models`). Mitigation: parser per provider with a tested
  fixture; unknown shape → warning, not a crash.
- **R-4 — Outbound call cost/rate-limit.** Sync is a live provider call. Mitigation:
  action-POST (not cached), super-admin-only, manual trigger (OQ-2), optional
  debounce.
- **R-5 — Secret handling.** The flow decrypts a key to call a provider. Mitigation:
  decrypt only inside `apps/api` (never in `ai-core`), never log the key, never
  return it; reuse `getDecryptedAiProviderCredential`.

## 11. Open questions

- **OQ-1 — Filtering strategy**: per-provider allowlist regex vs. denylist of known
  non-chat families vs. capability hints where available? (Leaning: denylist +
  "uncertain" bucket.)
- **OQ-2 — Sync trigger**: manual "Sync models" button only, or also auto-sync on
  credential create/rotate? (Leaning: manual only in v1; auto later.)
- **OQ-3 — Persistence of detected catalog**: keep suggestions ephemeral (fetch each
  time) vs. persist the detected list (with `fetchedAt`/source) to DB for history and
  offline display? (Leaning: ephemeral v1, no migration.)
- **OQ-4 — Provider-layer home**: `listModels()` on the `AiProvider` interface
  (single contract, but overlaps HOS-88 and touches every adapter) vs. a standalone
  `listProviderModels` fetcher decoupled from the generate/stream contract? (Leaning:
  standalone fetcher, to fully decouple from HOS-88.)
- **OQ-5 — Ollama/base-URL discovery**: for compatible providers behind a custom
  `baseURL`, do we assume `/v1/models` universally, or make the list-models path
  configurable per credential?

## 12. Implementation notes

- **Reuse, don't reinvent**: the decrypt primitive is
  `getDecryptedAiProviderCredential`; the persist path is the existing
  `PATCH /{providerId}` (`updateCredentialMetadata`); the UI already has the toggle +
  custom-add mechanic — this spec swaps the *suggestion source*, it doesn't rebuild
  the editor.
- **Keep the adapter dumb**: the adapter/fetcher returns raw IDs only. Filtering and
  merging live in `apps/api` (testable, provider-agnostic), not in `ai-core/providers`.
- **HOS-88 coordination**: check HOS-88's status before starting implementation. If
  HOS-88 is unmerged, prefer OQ-4 option (b) to avoid editing
  `vercel-openai.adapter.ts`; if merged, either home is fine on the V4 line.
- **Follow `ai-core` HARD RULES**: no `@ai-sdk/*` outside `src/providers/`, no
  `process.env`, no `@repo/db` outside `src/storage/`. The list-models fetch is
  plain `fetch` — it doesn't need the AI SDK at all, which is what makes it
  SDK-version-independent.
- **Route pattern**: action-POST via `createAdminRoute`, registered in the same
  `credentials/index.ts` router assembly; add the OpenAPI metadata and a gate-matrix
  row (per `apps/api/CLAUDE.md` route conventions).

## 13. Linear

Canonical tracking:
HOS-94

Related: HOS-88 (AI SDK v4 migration — file overlap on `vercel-openai.adapter.ts`).
