---
id: SPEC-212
slug: ai-content-translation
title: AI Content Translation for Multi-Language Listings
status: draft
owner: qazuor
created: 2026-06-10
parentSpec: SPEC-173
relatedSpecs:
  - SPEC-173  # AI foundation — this spec consumes it
  - SPEC-198  # AI text improvement — sibling feature, same pattern
  - SPEC-172  # amenities/features I18nText migration — the pattern we extend
  - SPEC-168  # admin plans — determines entitlement tiers
  - SPEC-145  # billing entitlements enforcement
tags: [ai, feature, i18n, translation, content, multi-language, admin]
---

# SPEC-212 — AI Content Translation for Multi-Language Listings

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every
> single case — without exception — if a change or decision is not *extremely*
> clear-cut, if there is even the slightest ambiguity, or if there is more than
> one viable option, **STOP and consult the owner (qazuor)**. Do not decide
> autonomously. See SPEC-173 §12.

## 1. Summary

Add an AI-powered translation capability as a new `translate` feature in the AI
infrastructure. When a HOST creates or updates an accommodation, destination,
event, or post (all user-generated content entities), the system automatically
translates the Spanish text fields to English and Portuguese using the existing
AI engine. Translations are stored as `I18nText` JSONB objects (`{ es, en, pt }`)
following the same pattern already established for amenities and features
(SPEC-172).

The HOST always writes in Spanish (the platform's primary language). Translation
happens async in the background — the HOST never waits for it. Admin users can
review and manually override auto-translations per field.

**V1 scope (owner-decided 2026-06-10):**

- Auto-translate on content create/update (background job)
- Batch translate existing content (backfill)
- Admin UI to view translation status and override per-locale
- No tourist-facing translation request endpoint (content is pre-translated)

This spec covers the AI feature registration, translation service, schema
changes for content entities, API routes, batch backfill, and admin UI. The
entire AI engine, quota enforcement, streaming primitive, and safety layer are
provided by `@repo/ai-core` and `apps/api` from SPEC-173.

## 2. Context and Motivation

### 2.1 The problem

The web app supports 3 locales (`es`, `en`, `pt`) via URL routing and UI
translations (`@repo/i18n`). However, ALL user-generated content — accommodation
names, descriptions, summaries; destination descriptions; event descriptions;
post titles and content — is stored as plain strings in Spanish only.

When a tourist browses `/en/` or `/pt/`, they see the Spanish content with no
translation. This defeats the purpose of multi-locale routing and provides a
poor experience for non-Spanish speakers.

### 2.2 What the foundation provides (SPEC-173 — verified)

- **`createConfiguredAiService()`** — `apps/api/src/services/ai-service.factory.ts`
- **`AiService.generateText({ feature, prompt, locale })`** — returns
  `{ text, usage, provider, model, finishReason }`. Non-streaming, returns
  complete translated text. Ideal for translation (no SSE needed).
- **`AiFeatureSchema`** — `z.enum(['text_improve', 'chat', 'search', 'support'])`.
  Adding `'translate'` is additive (append-only policy).
- **`DEFAULT_PROMPTS`** — `Readonly<Record<AiFeature, string>>`. Adding a new
  feature member requires a corresponding entry (TypeScript exhaustiveness).
- **`I18nTextSchema`** / `i18nText()` factory — already in `@repo/schemas`.
  Used by amenity/feature (SPEC-172). Ready to extend to content entities.
- **`resolveI18nText(value, locale)`** — `apps/web/src/lib/resolve-i18n-text.ts`.
  Already handles `I18nText | string | null` defensively.
- **Entitlement/limit pattern** — `ai_translate` gate + `max_ai_translate_per_month`
  limit keys, same as `text_improve`.

### 2.3 What this spec must build

1. **Extend `AiFeatureSchema`** with `'translate'` member.
2. **Add `DEFAULT_PROMPTS['translate']`** with translation-specific system prompt.
3. **Add entitlement/limit keys** for the translate feature.
4. **Schema changes** — migrate content entity text fields from `string` to
   `I18nText` (jsonb) in DB + Zod schemas.
5. **Translation service** — orchestrates AI calls, handles batching, manages
   retry/fallback logic.
6. **API routes** — trigger translation, check status, manual override.
7. **DB migration** — add `I18nText` columns, backfill existing data.
8. **Admin UI** — translation status indicator, per-locale override editors.
9. **Auto-translate hook** — fires on content create/update.

## 3. Goals and Non-goals

### Goals

1. All new/updated content is automatically translated to `en` and `pt`.
2. Existing content can be batch-translated via a one-time backfill job.
3. Admin users can view translation status and manually override any locale.
4. Translation uses the existing AI engine (same provider routing, kill-switch,
   fallback, retry, cost ceiling, usage metering).
5. Cost is可控 — batch translation uses the cheapest available provider.
6. The HOST experience is zero-friction — write in Spanish, translations appear
   automatically.

### Non-goals

1. Tourist-facing "translate this page" button (content is pre-translated).
2. Real-time translation of chat or search results.
3. Translation quality review/crowdsourcing (admin manual override is V1).
4. Translation of system-generated content (SEO metadata, slugs, etc.).
5. Support for additional locales beyond `es`/`en`/`pt` in V1.
6. Any change to the AI engine internals or billing enforcement mechanism.

## 4. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Which entities? | Accommodation, Destination, Event, Post — the four content entities with user-generated text. |
| Q2 | Which fields per entity? | See §4.1 below. |
| Q3 | Translation trigger? | Async background job on content create/update. HOST does not wait. |
| Q4 | Provider? | Cheapest available (Gemini Flash preferred, OpenAI GPT-4o-mini fallback). Configurable via admin AI settings. |
| Q5 | Manual override? | Yes — admin can edit any locale per field. Manual edits set `_autoTranslated: false`. |
| Q6 | Backfill? | CLI/script endpoint that iterates existing content and translates. Not a one-time migration — repeatable. |
| Q7 | Entitlement? | `ai_translate` gate granted to `owner-*` and `complex-*` plans. Tourist plans excluded. |
| Q8 | Quota? | `max_ai_translate_per_month` — 200 calls/month for owner-basico, 500 for owner-pro, unlimited for complex. Each entity+field combo translated to 2 target locales = 2 calls. |

### 4.1 Field scope per entity

| Entity | Fields to translate |
|--------|-------------------|
| Accommodation | `name`, `summary`, `description`, `richDescription` |
| Destination | `name`, `summary`, `description` |
| Event | `name`, `summary`, `description` |
| Post | `title`, `summary`, `content` |

**NOT translated** (stays as-is): `slug`, `type`/`category`/`destinationType`
enums, `contactInfo`, `location`, `media`, `seo` JSONB, `pricing` JSONB,
`date` JSONB. These are either non-text, structured data, or user-managed URLs.

## 5. Architecture

### 5.1 New AI feature: `translate`

**File: `packages/schemas/src/entities/ai/ai-provider.schema.ts`** (MODIFY)

```ts
// Add 'translate' to the AiFeatureSchema enum (append-only):
export const AiFeatureSchema = z.enum([
  'text_improve', 'chat', 'search', 'support', 'translate'
]);
```

**File: `packages/ai-core/src/engine/default-prompts.ts`** (MODIFY)

```ts
translate: `You are a professional translator specializing in tourism and hospitality content for Argentina's Litoral region. \
Translate the provided Spanish text into the target language while: \
1. Preserving all factual information, proper nouns, geographic references, and formatting. \
2. Adapting tourism terminology naturally: "cabaña" → "cabin", "quincho" → "covered BBQ area", "pileta" → "pool" (NOT "pit"), "parrilla" → "grill/BBQ". \
3. Maintaining the original tone (warm, inviting, tourism-oriented). \
4. Keeping markdown formatting intact in rich text fields. \
5. NOT adding information that is not in the original text. \
6. NOT translating proper nouns, brand names, or place names that are commonly kept in Spanish. \
Output ONLY the translated text with no explanations, prefixes, or metadata.`
```

**New entitlement/limit keys** in `packages/billing/src/types/`:

```ts
// Add to EntitlementKey enum:
AI_TRANSLATE = 'ai_translate'

// Add to LimitKey enum:
MAX_AI_TRANSLATE_PER_MONTH = 'max_ai_translate_per_month'
```

**Feature mapping** in `packages/ai-core/` (same pattern as text_improve):

```ts
AI_ENTITLEMENT_BY_FEATURE['translate'] = EntitlementKey.AI_TRANSLATE;
AI_LIMIT_BY_FEATURE['translate'] = LimitKey.MAX_AI_TRANSLATE_PER_MONTH;
```

### 5.2 Schema changes: content entities → I18nText

Each content entity's text fields change from `text` (string) to `jsonb`
(I18nText). This is the same migration done for amenity/feature in SPEC-172.

**Database migration strategy** (three-phase, non-breaking):

**Phase 1 — Add new columns (this spec):**

```sql
-- Accommodation
ALTER TABLE accommodations ADD COLUMN name_i18n jsonb;
ALTER TABLE accommodations ADD COLUMN summary_i18n jsonb;
ALTER TABLE accommodations ADD COLUMN description_i18n jsonb;
ALTER TABLE accommodations ADD COLUMN rich_description_i18n jsonb;

-- Destination
ALTER TABLE destinations ADD COLUMN name_i18n jsonb;
ALTER TABLE destinations ADD COLUMN summary_i18n jsonb;
ALTER TABLE destinations ADD COLUMN description_i18n jsonb;

-- Event
ALTER TABLE events ADD COLUMN name_i18n jsonb;
ALTER TABLE events ADD COLUMN summary_i18n jsonb;
ALTER TABLE events ADD COLUMN description_i18n jsonb;

-- Post
ALTER TABLE posts ADD COLUMN title_i18n jsonb;
ALTER TABLE posts ADD COLUMN summary_i18n jsonb;
ALTER TABLE posts ADD COLUMN content_i18n jsonb;
```

**Phase 2 — Backfill** (translation script fills `*_i18n` from `es` values).

**Phase 3 — Swap** (future spec): rename `*_i18n` → original column name,
drop old column. **NOT in this spec** — V1 reads from both columns with
`_i18n` taking priority.

**Zod schema changes** (additive — new optional fields):

```ts
// packages/schemas/src/entities/accommodation/accommodation.schema.ts
// ADD new optional I18nText fields alongside existing string fields:
nameI18n: I18nTextSchema.optional(),
summaryI18n: I18nTextSchema.optional(),
descriptionI18n: I18nTextSchema.optional(),
richDescriptionI18n: I18nTextSchema.optional(),
```

**Web app resolution** (defensive, handles both shapes):

```ts
// apps/web/src/lib/api/transforms.ts
// Use resolveI18nText() which already handles I18nText | string | null:
name: resolveI18nText(accommodation.nameI18n ?? accommodation.name, locale),
```

### 5.3 Translation service

**New file: `apps/api/src/services/ai-translate.service.ts`**

```ts
/**
 * Orchestrates AI translation for content entities.
 * Uses the existing AI engine (createConfiguredAiService) with feature='translate'.
 *
 * Design:
 * - Single-entity translate: translates one entity's fields to target locales.
 * - Batch translate: iterates entities with a simple queue (concurrency=3).
 * - No streaming — uses generateText (complete response, not token-by-token).
 * - Retry: 1 automatic retry on transient errors, then skip + log.
 * - Fallback: if target locale translation fails, keep Spanish value.
 */

interface TranslateEntityInput {
  entityType: 'accommodation' | 'destination' | 'event' | 'post';
  entityId: string;
  fields: Record<string, string>;  // field name → Spanish text
  targetLocales: readonly ('en' | 'pt')[];
}

interface TranslateResult {
  fieldType: string;
  locale: string;
  translatedText: string;
  success: boolean;
  error?: string;
}

interface TranslateEntityResult {
  entityId: string;
  translations: TranslateResult[];
  totalTokens: number;
  provider: string;
  model: string;
}
```

**Translation flow:**

```
1. Receive TranslateEntityInput
2. For each target locale (en, pt):
   a. For each field:
      - Build user prompt: "Translate the following to {locale}:\n\n{fieldValue}"
      - Call aiService.generateText({ feature: 'translate', prompt, locale })
      - Store result in I18nText shape
3. Return TranslateEntityResult with all translations
4. Caller persists to DB (or triggers batch persistence)
```

**Batch translate** (for backfill):

```ts
interface BatchTranslateInput {
  entityType: 'accommodation' | 'destination' | 'event' | 'post';
  cursor?: string;       // pagination cursor (entity ID)
  batchSize?: number;    // default 10
  concurrency?: number;  // default 3 parallel entity translations
}

// Returns { translated: number, failed: number, nextCursor?: string }
```

**Concurrency control**: translate up to `concurrency` entities in parallel.
Each entity's fields are translated sequentially (to respect rate limits).
Delay 500ms between entity batches to avoid provider throttling.

### 5.4 API routes

#### 5.4.1 Trigger translation for a single entity

```
POST /api/v1/protected/ai/translate
Content-Type: application/json
```

**New file: `apps/api/src/routes/ai/protected/translate.ts`**

```ts
// Request body:
{
  entityType: 'accommodation' | 'destination' | 'event' | 'post',
  entityId: string,          // UUID
  targetLocales?: ('en' | 'pt')[]  // default: ['en', 'pt']
}

// Response (non-streaming):
{
  success: true,
  data: {
    entityId: string,
    translations: [
      { fieldType: 'name', locale: 'en', translatedText: 'River Cabin', success: true },
      { fieldType: 'name', locale: 'pt', translatedText: 'Cabana do Rio', success: true },
      // ...
    ],
    totalTokens: 450,
    provider: 'google',
    model: 'gemini-1.5-flash'
  }
}
```

**Middleware stack** (same as text_improve):

```ts
options.middlewares: [
  entitlementMiddleware(),
  ...createAiRateLimitMiddlewares('translate'),
  createAiQuotaMiddleware('translate'),
]
```

#### 5.4.2 Batch translate (backfill)

```
POST /api/v1/admin/ai/translate/batch
Content-Type: application/json
```

**New file: `apps/api/src/routes/ai/admin/translate-batch.ts`**

```ts
// Request body:
{
  entityType: 'accommodation' | 'destination' | 'event' | 'post',
  cursor?: string,
  batchSize?: number     // default 10, max 50
}

// Response:
{
  success: true,
  data: {
    translated: number,
    failed: number,
    nextCursor?: string,  // null if no more pages
    errors: Array<{ entityId: string; error: string }>
  }
}
```

**Admin-only route** — no entitlement check (admin bypasses quotas).

#### 5.4.3 Manual translation override

```
PUT /api/v1/admin/ai/translate/override
Content-Type: application/json
```

```ts
// Request body:
{
  entityType: 'accommodation' | 'destination' | 'event' | 'post',
  entityId: string,
  locale: 'en' | 'pt',
  fieldType: string,      // e.g. 'name', 'description'
  value: string           // manually written translation
}

// Response: { success: true }
```

Persists the manual override and sets `_autoTranslated: false` for that
field+locale combination.

### 5.5 Auto-translate on content create/update

**Integration point**: the existing content CRUD services (accommodation,
destination, event, post) call the translation service after a successful
create/update.

**Pattern**: fire-and-forget async call. The CRUD operation returns immediately
with the Spanish content. Translation runs in the background.

```ts
// In the accommodation service create/update method:
// After successful DB write:
translateEntityAsync({
  entityType: 'accommodation',
  entityId: newAccommodation.id,
  fields: {
    name: newAccommodation.name,
    summary: newAccommodation.summary,
    description: newAccommodation.description,
    richDescription: newAccommodation.richDescription ?? '',
  },
  targetLocales: ['en', 'pt'],
}).catch(err => {
  // Log error but do NOT fail the CRUD operation
  logger.error('Translation failed', { entityId: newAccommodation.id, err });
});
```

**`translateEntityAsync`** is a thin wrapper that:

1. Checks entitlement (does the plan include `ai_translate`?)
2. Calls `aiTranslateService.translateEntity(input)`
3. Persists the resulting `I18nText` objects to the DB
4. Catches and logs errors (never throws back to the caller)

### 5.6 Admin UI: translation status + manual override

**New component: `apps/admin/src/features/content/components/TranslationStatus.tsx`**

Shows per-field translation status in the entity edit page:

```
┌─────────────────────────────────────────────────────────────┐
│ Name                                                        │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Cabaña del Río                                       │    │
│ └─────────────────────────────────────────────────────┘    │
│ 🌐 EN: River Cabin  ✅ auto    [Edit]                      │
│ 🌐 PT: Cabana do Rio  ✅ auto   [Edit]                     │
├─────────────────────────────────────────────────────────────┤
│ Description                                                 │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Junto al río Uruguay, con parrilla y pileta...      │    │
│ └─────────────────────────────────────────────────────┘    │
│ 🌐 EN: Next to the Uruguay River, with BBQ and pool...    │
│    ✅ auto  [Edit]                                          │
│ 🌐 PT: [pending translation...]  [Translate now]           │
└─────────────────────────────────────────────────────────────┘
```

**States per field+locale:**

- `pending` — not yet translated (grey badge, "Translate now" button)
- `auto` — auto-translated (green badge, "Edit" button)
- `manual` — manually overridden (blue badge, "Edit" button)
- `error` — translation failed (red badge, "Retry" button)

**File map:**

| File | Status |
|------|--------|
| `apps/admin/src/features/content/components/TranslationStatus.tsx` | NEW |
| `apps/admin/src/features/content/components/TranslationOverrideModal.tsx` | NEW |
| `apps/admin/src/features/content/hooks/useTranslationStatus.ts` | NEW |
| `apps/admin/src/routes/_authed/accommodations/$id_.edit.tsx` | MODIFY — add TranslationStatus |
| `apps/admin/src/routes/_authed/destinations/$id_.edit.tsx` | MODIFY — add TranslationStatus |
| `apps/admin/src/routes/_authed/events/$id_.edit.tsx` | MODIFY — add TranslationStatus |
| `apps/admin/src/routes/_authed/posts/$id_.edit.tsx` | MODIFY — add TranslationStatus |

### 5.7 Data model: translation metadata

**New DB column per entity** (tracks translation state):

```sql
-- Added alongside the *_i18n columns
ALTER TABLE accommodations ADD COLUMN translation_meta jsonb DEFAULT '{}';
ALTER TABLE destinations ADD COLUMN translation_meta jsonb DEFAULT '{}';
ALTER TABLE events ADD COLUMN translation_meta jsonb DEFAULT '{}';
ALTER TABLE posts ADD COLUMN translation_meta jsonb DEFAULT '{}';
```

**Shape of `translation_meta`:**

```ts
interface TranslationMeta {
  [field: string]: {
    [locale: string]: {
      autoTranslated: boolean;  // true = AI-generated, false = manual override
      translatedAt: string;     // ISO timestamp
      provider?: string;        // 'google', 'openai', etc.
      model?: string;           // 'gemini-1.5-flash', etc.
    };
  };
}
```

Example:

```json
{
  "name": {
    "en": { "autoTranslated": true, "translatedAt": "2026-06-10T15:30:00Z", "provider": "google", "model": "gemini-1.5-flash" },
    "pt": { "autoTranslated": true, "translatedAt": "2026-06-10T15:30:01Z", "provider": "google", "model": "gemini-1.5-flash" }
  },
  "description": {
    "en": { "autoTranslated": false, "translatedAt": "2026-06-10T16:00:00Z" }
  }
}
```

### 5.8 Default prompt (owner-approved)

The `translate` default prompt is defined in §5.1 above. Key aspects:

- **Domain-specific**: knows tourism terminology for Argentina's Litoral region
- **Terminology glossary**: built into the prompt (cabaña→cabin, quincho→BBQ area, etc.)
- **Markdown preservation**: keeps formatting in rich text fields
- **No hallucination**: does not add information not in the original
- **Output-only**: no explanations, prefixes, or metadata in the response

The prompt is the mandatory in-code fallback. A SUPER_ADMIN can override it
via `ai_prompt_versions` at runtime.

### 5.9 Error handling

| Scenario | Behavior |
|----------|----------|
| Single field translation fails | Keep Spanish value for that field, continue with others |
| All fields fail for one entity | Log error, mark entity as having failed translations |
| Provider outage | Retry with fallback provider (same as SPEC-173 engine fallback) |
| Rate limit hit | Wait 500ms, retry once, then skip + log |
| Quota exhausted | Stop batch, return partial results + nextCursor |
| Content updated during batch | Re-translate the updated entity on next batch run |

## 6. Data

### 6.1 New database columns

See §5.2 (I18nText columns) and §5.7 (translation_meta). All are additive
(nullable JSONB with default `'{}'`). No existing columns are modified or
dropped.

### 6.2 Migration file

**New file: `packages/db/src/migrations/XXXX_ai_content_translation.sql`**

Generated via `pnpm db:generate` after schema changes. Idempotent column
additions (`ADD COLUMN IF NOT EXISTS`).

### 6.3 Existing data

Existing Spanish content stays in the original `text` columns. The `*_i18n`
columns start as `NULL`. The backfill script (§5.4.2) populates them.

**Backfill strategy:**

1. Admin triggers batch translate via `/api/v1/admin/ai/translate/batch`
2. Script iterates entities in pages of 10
3. For each entity: copies Spanish text to `*_i18n.es`, translates to `en` and `pt`
4. Progress is visible in admin UI (translated count / total)
5. Script is idempotent — re-running skips already-translated entities

**Estimated backfill cost** (200 accommodations × 4 fields × 2 locales):

| Metric | Value |
|--------|-------|
| API calls | 200 × 4 × 2 = 1,600 |
| Characters per call | ~7,500 avg |
| Total characters | ~12M |
| Gemini Flash cost | ~$0.30 USD |
| Duration (concurrency 3) | ~8 minutes |

## 7. Acceptance Criteria (BDD)

- **AC-1 (feature registration)** — *Given* the `AiFeatureSchema` enum, *when*
  inspecting its members, *then* `'translate'` is present. The TypeScript type
  `AiFeature` includes `'translate'`. `DEFAULT_PROMPTS` has an entry for
  `'translate'`.

- **AC-2 (entitlement gate)** — *Given* a user on `tourist-free` plan (lacks
  `ai_translate`), *when* they call `POST /api/v1/protected/ai/translate`,
  *then* they receive `403 ENTITLEMENT_REQUIRED`.

- **AC-3 (single entity translation)** — *Given* an entitled HOST with a valid
  accommodation, *when* they call the translate endpoint with valid body, *then*
  the response contains `I18nText` objects for each field in each target locale.

- **AC-4 (auto-translate on create)** — *Given* a HOST creates a new
  accommodation, *when* the create succeeds, *then* translation runs async in
  the background. The accommodation is immediately available with Spanish content.
  Within a few seconds, `en` and `pt` translations appear.

- **AC-5 (auto-translate on update)** — *Given* an accommodation with existing
  translations, *when* the HOST updates the `description` field, *then* only the
  `description` is re-translated (not `name`, `summary`, etc.).

- **AC-6 (manual override)** — *Given* an admin views an accommodation edit page,
  *when* they click "Edit" on an EN translation, *then* a modal opens with the
  current translation. They can edit and save. The `autoTranslated` flag flips
  to `false`.

- **AC-7 (backfill)** — *Given* the admin triggers batch translate for
  accommodations, *when* the batch runs, *then* entities are translated in pages.
  Progress is trackable. Already-translated entities are skipped.

- **AC-8 (field scope)** — *Given* a translation request for an accommodation,
  *then* only `name`, `summary`, `description`, and `richDescription` are
  translated. `slug`, `type`, `contactInfo`, `location`, `media`, `seo` are NOT
  translated.

- **AC-9 (cost metering)** — *Given* a translation call, *then* the AI engine
  records usage in `ai_usage` with `feature: 'translate'`. The HOST's monthly
  quota is decremented.

- **AC-10 (fallback on failure)** — *Given* a translation API call fails, *then*
  the Spanish value is preserved. The error is logged. The CRUD operation that
  triggered the translation is NOT affected.

- **AC-11 (resolution in web)** — *Given* an accommodation with `nameI18n: {
  es: 'Cabaña', en: 'Cabin', pt: 'Cabana' }`, *when* the web app renders the
  accommodation card at `/en/`, *then* the name shows "Cabin". At `/pt/` it shows
  "Cabana". At `/es/` it shows "Cabaña".

- **AC-12 (defensive resolution)** — *Given* an accommodation where
  `nameI18n` is `null` (not yet translated), *when* the web app renders at
  `/en/`, *then* `resolveI18nText(null, 'en')` falls back to the original
  `name` string field. The card shows the Spanish name.

- **AC-13 (batch idempotency)** — *Given* batch translate runs twice on the same
  entity, *then* the second run skips already-translated fields (no redundant
  API calls).

- **AC-14 (admin-only batch)** — *Given* a non-admin user calls the batch
  endpoint, *then* they receive `403 FORBIDDEN`.

## 8. i18n Keys

All new keys belong to the `admin-common` namespace.

### Spanish (`es`)

```json
"aiTranslate": {
  "status": "Traducciones",
  "statusTooltip": "Estado de las traducciones de contenido",
  "autoTranslated": "auto",
  "manualTranslated": "manual",
  "pending": "pendiente",
  "failed": "error",
  "editButton": "Editar",
  "translateNow": "Traducir ahora",
  "retryButton": "Reintentar",
  "overrideTitle": "Editar traducción",
  "overrideSave": "Guardar",
  "overrideCancel": "Cancelar",
  "overrideSaved": "Traducción guardada",
  "batchStart": "Iniciar traducción masiva",
  "batchProgress": "Traduciendo... {translated}/{total}",
  "batchComplete": "Traducción masiva completada",
  "batchError": "Error en la traducción masiva",
  "field.name": "Nombre",
  "field.summary": "Resumen",
  "field.description": "Descripción",
  "field.richDescription": "Descripción (rico)",
  "field.title": "Título",
  "field.content": "Contenido",
  "error.TRANSLATION_FAILED": "Error al traducir. El contenido en español no fue modificado.",
  "error.ENTITLEMENT_REQUIRED": "Tu plan no incluye traducción con IA. Actualizá tu plan para acceder.",
  "error.LIMIT_REACHED": "Alcanzaste el límite mensual de traducciones. Esperá el próximo mes."
}
```

### English (`en`)

```json
"aiTranslate": {
  "status": "Translations",
  "statusTooltip": "Content translation status",
  "autoTranslated": "auto",
  "manualTranslated": "manual",
  "pending": "pending",
  "failed": "error",
  "editButton": "Edit",
  "translateNow": "Translate now",
  "retryButton": "Retry",
  "overrideTitle": "Edit translation",
  "overrideSave": "Save",
  "overrideCancel": "Cancel",
  "overrideSaved": "Translation saved",
  "batchStart": "Start batch translation",
  "batchProgress": "Translating... {translated}/{total}",
  "batchComplete": "Batch translation complete",
  "batchError": "Batch translation error",
  "field.name": "Name",
  "field.summary": "Summary",
  "field.description": "Description",
  "field.richDescription": "Description (rich)",
  "field.title": "Title",
  "field.content": "Content",
  "error.TRANSLATION_FAILED": "Translation failed. Spanish content was not modified.",
  "error.ENTITLEMENT_REQUIRED": "Your plan does not include AI translation. Upgrade to access.",
  "error.LIMIT_REACHED": "Monthly translation limit reached. Wait for next month."
}
```

### Portuguese (`pt`)

```json
"aiTranslate": {
  "status": "Traduções",
  "statusTooltip": "Estado das traduções de conteúdo",
  "autoTranslated": "auto",
  "manualTranslated": "manual",
  "pending": "pendente",
  "failed": "erro",
  "editButton": "Editar",
  "translateNow": "Traduzir agora",
  "retryButton": "Tentar novamente",
  "overrideTitle": "Editar tradução",
  "overrideSave": "Salvar",
  "overrideCancel": "Cancelar",
  "overrideSaved": "Tradução salva",
  "batchStart": "Iniciar tradução em lote",
  "batchProgress": "Traduzindo... {translated}/{total}",
  "batchComplete": "Tradução em lote concluída",
  "batchError": "Erro na tradução em lote",
  "field.name": "Nome",
  "field.summary": "Resumo",
  "field.description": "Descrição",
  "field.richDescription": "Descrição (rica)",
  "field.title": "Título",
  "field.content": "Conteúdo",
  "error.TRANSLATION_FAILED": "Falha na tradução. O conteúdo em espanhol não foi modificado.",
  "error.ENTITLEMENT_REQUIRED": "Seu plano não inclui tradução com IA. Atualize para ter acesso.",
  "error.LIMIT_REACHED": "Limite mensal de traduções atingido. Aguarde o próximo mês."
}
```

## 9. Testing Strategy

### 9.1 Unit tests — schemas

**File: `packages/schemas/src/entities/ai/__tests__/ai-translate.schema.test.ts`** (NEW)

```ts
describe('AiTranslateRequestSchema', () => {
  it('accepts valid accommodation translation request');
  it('accepts valid destination translation request');
  it('accepts valid event translation request');
  it('accepts valid post translation request');
  it('accepts request without targetLocales (defaults to en+pt)');
  it('rejects unknown entityType');
  it('rejects invalid entityId (not UUID)');
  it('rejects unknown keys (strict mode)');
  it('accepts partial targetLocales array');
  it('rejects empty targetLocales array');
  it('rejects locale es in targetLocales (already Spanish)');
});
```

### 9.2 Unit tests — translation service

**File: `apps/api/src/services/__tests__/ai-translate.service.test.ts`** (NEW)

```ts
describe('AiTranslateService', () => {
  it('translates a single field to target locales');
  it('translates multiple fields to target locales');
  it('preserves Spanish value when translation fails');
  it('respects concurrency limit in batch mode');
  it('skips already-translated fields (idempotent)');
  it('handles provider fallback on transient error');
  it('records usage in ai_usage table');
});
```

### 9.3 Unit tests — route handler

**File: `apps/api/src/routes/ai/protected/__tests__/translate.test.ts`** (NEW)

```ts
describe('POST /api/v1/protected/ai/translate', () => {
  it('calls aiTranslateService with correct input');
  it('returns 400 on invalid request body');
  it('returns 403 ENTITLEMENT_REQUIRED for tourist plan');
  it('returns translation results on success');
});
```

### 9.4 Integration tests

**File: `apps/api/test/integration/ai/translate.test.ts`** (NEW)

```ts
describe('POST /api/v1/protected/ai/translate — integration', () => {
  it('401 — unauthenticated');
  it('403 — tourist plan');
  it('200 — entitled HOST, returns I18nText objects');
  it('400 — invalid entityType');
  it('400 — invalid entityId');
});
```

### 9.5 Frontend component tests

**File: `apps/admin/src/features/content/components/__tests__/TranslationStatus.test.tsx`** (NEW)

```ts
describe('TranslationStatus', () => {
  it('shows pending state for untranslated field');
  it('shows auto-translated badge');
  it('shows manual-translated badge');
  it('shows error state with retry button');
  it('opens override modal on Edit click');
  it('calls translateNow handler on button click');
});
```

### 9.6 Coverage requirement

Minimum 90% on new code paths.

## 10. Risks

### R-1 — Schema migration complexity

**Risk**: Changing content entity text fields from `string` to `I18nText` is a
significant schema change. Existing code reads/writes these fields as strings.

**Mitigation**: Three-phase migration (§5.2). V1 adds `*_i18n` columns alongside
existing columns. No existing code breaks. The web app reads from `*_i18n` with
fallback to the original string field via `resolveI18nText()` (which already
handles both shapes defensively).

### R-2 — Translation cost at scale

**Risk**: High content volume could lead to unexpected AI costs.

**Mitigated**: Entitlement gate + monthly quota limits per plan. Cost ceiling
from SPEC-173 provides a hard stop. Gemini Flash pricing (~$0.075/1M input
chars) makes this negligible for typical platform volumes.

### R-3 — Translation quality for tourism content

**Risk**: Generic AI translation may miss domain-specific nuances.

**Mitigated**: The system prompt includes a built-in glossary for Argentine
tourism terms. Admin manual override provides a quality escape hatch. Future
improvement: custom glossary per entity type.

### R-4 — Auto-translate on every update

**Risk**: Frequent content edits trigger many translation calls, increasing cost.

**Mitigated**: The auto-translate hook only re-translates fields that changed.
The monthly quota provides a natural cap. The HOST can be educated to batch
edits before publishing.

### R-5 — Backfill duration for large datasets

**Risk**: Batch translating thousands of entities takes a long time.

**Mitigated**: Batch endpoint is paginated and idempotent. Admin can run it in
multiple sessions. Concurrency=3 with 500ms delay keeps API calls reasonable.
1,000 accommodations ≈ 16 minutes.

## 11. Dependencies

### Internal (upstream, already shipped)

- SPEC-173 (completed) — all foundation exports confirmed present.
- SPEC-172 — I18nText pattern on amenity/feature (the migration pattern to follow).
- SPEC-198 — text_improve feature (the feature registration pattern to follow).
- `@repo/schemas` — I18nTextSchema, i18nText() factory already exist.
- `@repo/billing` — entitlement/limit key pattern established.
- `resolveI18nText()` — defensive resolver in web app handles both shapes.

### External packages

No new external packages. Uses the existing AI engine from SPEC-173.

## 12. Migration and Rollback

### Database migrations

Additive only: `ADD COLUMN IF NOT EXISTS` for `*_i18n` and `translation_meta`
columns. Nullable with default. No data loss.

### Rollback

Drop the new columns:

```sql
ALTER TABLE accommodations DROP COLUMN IF EXISTS name_i18n;
ALTER TABLE accommodations DROP COLUMN IF EXISTS summary_i18n;
-- ... etc
ALTER TABLE accommodations DROP COLUMN IF EXISTS translation_meta;
```

The original string columns are untouched. No data loss.

### Code rollback

Revert route files, service files, and admin components. Remove `'translate'`
from `AiFeatureSchema` enum (breaking — requires coordinated deploy). Remove
`DEFAULT_PROMPTS['translate']` entry.

## 13. Task Breakdown Hint

| # | Task | Files | Depends on |
|---|------|-------|------------|
| T-1 | Add `'translate'` to `AiFeatureSchema` + `DEFAULT_PROMPTS` | `ai-provider.schema.ts`, `default-prompts.ts` | — |
| T-2 | Add entitlement/limit keys for `ai_translate` | `packages/billing/src/types/` | T-1 |
| T-3 | DB migration: add `*_i18n` + `translation_meta` columns | `packages/db/src/migrations/`, schema files | — |
| T-4 | Zod schemas: add `*I18n: I18nTextSchema.optional()` to entities | `packages/schemas/src/entities/*/` | — |
| T-5 | Schema unit tests | `packages/schemas/src/entities/ai/__tests__/` | T-4 |
| T-6 | Translation service | `apps/api/src/services/ai-translate.service.ts` | T-1 |
| T-7 | Service unit tests | `apps/api/src/services/__tests__/` | T-6 |
| T-8 | API route: single translate | `apps/api/src/routes/ai/protected/translate.ts` | T-6 |
| T-9 | API route: batch translate | `apps/api/src/routes/ai/admin/translate-batch.ts` | T-6 |
| T-10 | API route: manual override | `apps/api/src/routes/ai/admin/translate-override.ts` | T-6 |
| T-11 | Mount routes in barrels | `apps/api/src/routes/ai/protected/index.ts`, `apps/api/src/routes/ai/index.ts` | T-8, T-9, T-10 |
| T-12 | Auto-translate hook in CRUD services | `packages/service-core/src/services/*/` | T-6 |
| T-13 | Web app: update transforms to use `resolveI18nText()` | `apps/web/src/lib/api/transforms.ts` | T-4 |
| T-14 | Admin: TranslationStatus component | `apps/admin/src/features/content/components/` | T-4 |
| T-15 | Admin: TranslationOverrideModal component | `apps/admin/src/features/content/components/` | T-14 |
| T-16 | Admin: wire into entity edit pages | `apps/admin/src/routes/_authed/*/` | T-14 |
| T-17 | i18n keys | `packages/i18n/src/locales/{es,en,pt}/admin-common.json` | — |
| T-18 | Route integration tests | `apps/api/test/integration/ai/` | T-8 |
| T-19 | Frontend component tests | `apps/admin/src/features/content/components/__tests__/` | T-14 |
