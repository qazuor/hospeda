---
title: Host-editable translations for accommodations
linear: HOS-583
statusSource: linear
created: 2026-08-17
type: feature
areas:
  - web
  - api
  - content
---

# Host-editable translations for accommodations

## 1. Summary

Turn the accommodation editor's "Traducciones" panel from a read-only presence
indicator into a **view + edit** surface: the host reads the English and
Portuguese text that is published under their business name, corrects it per
locale, and the correction is frozen against future AI runs. Generating with AI
stays premium; **correcting is free**.

The pattern already exists for commerce
(`apps/web/src/components/commerce/CommerceTranslationPanel.client.tsx`). This
spec ports it to accommodations and adds the two things commerce does not have:
the freeze (`translationMeta.<field>.<locale>.autoTranslated = false`) and the
"the Spanish original changed" notice with a per-field regenerate.

## 2. Problem

The AI publishes content under the host's commercial name, in two languages the
host usually does not speak. Today they can neither read it nor fix it.

`TranslationPanel.client.tsx` renders, per field × locale, a presence badge and
nothing else (`:110-191`). The code says so itself — *"the endpoint returns the
text but nothing here renders it"* (`translation-status.ts:130-134`). The only
control is "Generar traducciones faltantes"
(`POST /api/v1/protected/ai/translate`), which always runs with
`onlyMissing: true`, so it fills holes and never corrects.

The only correction path that exists is admin-only: `PUT /admin/ai/translate/override`,
permission `AI_SETTINGS_MANAGE`, SUPER_ADMIN in practice
(`ai-translate.service.ts::applyManualOverride`).

A wrong, misleading or simply bad translation is therefore indexed, attributed
to the host, and unfixable by them.

## 3. Goals

- **G-1** — The host reads the stored `en` / `pt` text for `name`, `summary`,
  `description` and (when entitled) `richDescription`, in the editor.
- **G-2** — The host edits any of those per locale and saves through the normal
  section PATCH, with no plan requirement.
- **G-3** — A manual correction is frozen: no AI run overwrites it
  (`autoTranslated: false`, the mechanism `applyManualOverride` already uses).
- **G-4** — When the Spanish source of a field changes after a correction, that
  field shows a "the original changed" notice plus a **per-field** regenerate
  button, so a frozen translation is never a permanent trap.
- **G-5** — AI generation stays gated by `AI_TRANSLATE` +
  `MAX_AI_TRANSLATE_PER_MONTH`; `richDescriptionI18n` stays gated by
  `CAN_USE_RICH_DESCRIPTION` on **both** read and write.

## 4. Non-goals

- **NG-1** — No rich-text editor in the translation panel. Four plain
  textareas, exactly like the commerce panel; `richDescription` translations are
  edited as raw Markdown.
- **NG-2** — No translation editing for `destination`, `event`, `post` or `poi`.
  The `translationMeta` mechanism is shared by all five tables, but only the
  accommodation host-facing surface is in scope here.
- **NG-3** — No automatic re-translation on a Spanish edit. The notice is
  informational; regenerating is always an explicit host action (it costs quota).
- **NG-4** — No change to the admin override endpoint or the admin
  `TranslationStatus` component.
- **NG-5** — Commerce is not retrofitted with the freeze in this spec (see R-4).

## 5. Current baseline

Verified against `origin/staging` on 2026-08-17.

### 5.1 The BETA-199 prerequisite is ALREADY DONE

The Linear issue states that the entitlement strip has to be ported to
`GET /api/v1/protected/accommodations/:id`. **It is already there** — HOS-317
shipped it. `getById.ts:244-264` resolves the *owning* host's entitlements
(`resolveOwnerRichDescriptionEntitlements`) and applies
`stripRichDescriptionFields` when `CAN_USE_RICH_DESCRIPTION` is absent. That
route is the only one on `AccommodationProtectedSchema` allowed to emit the
premium pair; the other seven strip it unconditionally.

No work is needed here. The read-side gate this spec depends on exists.

### 5.2 Read path — the text already reaches the browser

- `AccommodationProtectedSchema` picks `nameI18n`, `summaryI18n`,
  `descriptionI18n` (always) and the premium pair `richDescription` /
  `richDescriptionI18n` (gated per §5.1) — `accommodation.access.schema.ts:460-592`.
- `transformAccommodationTranslations` (`apps/web/src/lib/api/transforms.ts:2036`)
  already carries the **full per-locale strings** into
  `AccommodationTranslationData` (`types.ts:339`). The panel simply does not
  render them.
- `translationMeta` is **NOT** picked into the protected schema (*"internal and
  deliberately NOT picked"*). The host cannot see provenance today.

So the "view" half is a front-end change plus the provenance projection of D-2,
not an API rewrite.

### 5.3 Write path — the PATCH cannot carry a translation today

- `AccommodationUpdateHttpSchema`
  (`accommodation.http.schema.ts:468`) is derived from
  `AccommodationCreateHttpSchema`, a flat hand-written HTTP shape with **no
  `*I18n` keys at all**. A translation edit sent today is silently dropped.
- The DOMAIN input `AccommodationUpdateInputSchema`
  (`accommodation.crud.schema.ts:128`) is derived from `AccommodationSchema`
  minus an omit list, so it **already accepts** the four `*I18n` fields — and
  also `translationMeta`, which no route exposes but which is not omitted
  either (see R-3).
- `httpToDomainAccommodationUpdate` must forward whatever the HTTP schema gains.
- The editor saves per section through `useAccommodationSectionForm`, diffing
  and sending only `ownFields`
  (`apps/web/src/components/host/editor/use-accommodation-section-form.ts`).
  `traducciones.astro` currently has no form at all — it renders the read-only
  panel.

### 5.4 `translationMeta` has exactly one writer

`apps/api/src/services/ai-translate.service.ts`, in two places:

- `persistTranslations:513-539` — merges per (field × locale), and already
  **skips any pair flagged `autoTranslated: false`** (`:523`).
- `applyManualOverride:679-688` — the admin override, writes
  `{ autoTranslated: false, translatedAt }`.

Both gate the write with `TranslationMetaSchema.safeParse` before touching the
DB (HOS-190 slice 3). Nothing else in `apps/api`, `packages/service-core` or
`apps/web` writes that column.

### 5.5 Generation gate

`POST /api/v1/protected/ai/translate` (`apps/api/src/routes/ai/protected/translate.ts`)
runs `createAiQuotaMiddleware('translate')`, which enforces
`EntitlementKey.AI_TRANSLATE` and `LimitKey.MAX_AI_TRANSLATE_PER_MONTH`
(`ai-quota.ts:80-103`). It accepts `entityType`, `entityId`, `sourceLocale`,
`targetLocales` — **no field selection**, and always calls `translateEntity`
with `onlyMissing: true` (`:148`).

### 5.6 Finding: that route has no ownership check

The handler loads and mutates by `entityId` with no verification that the actor
owns the row (`translate.ts:112-220`). Any authenticated actor holding
`AI_TRANSLATE` can persist translations onto **any** accommodation,
destination, event or post by id. It burns the caller's own quota, but it writes
to someone else's row.

This is pre-existing, not introduced here. It matters to this spec because the
per-field regenerate button rides this same route and widens its parameter
surface. See OQ-1.

## 6. Proposed design

### 6.1 Panel: badges stay, textareas arrive

`TranslationPanel.client.tsx` keeps its field-card / locale-badge visual
language (it is the panel hosts already know) and gains the commerce panel's
editing model:

- Locale tab bar `ES | EN | PT`; the tab carries the presence badge already
  rendered today.
- Inside the active tab, one labelled textarea per in-scope field. The label
  carries the locale — `Descripción (EN)` — for the exact reason the commerce
  panel does (HOS-371: without it a screen reader announces the same name as the
  editor's own field, and `getByRole('textbox', { name })` matches both).
- The `ES` tab is **read-only**: Spanish is the source, edited on its own
  section pages. Showing it read-only is what lets the host compare while
  correcting.
- The `richDescription` row keeps its current three-state handling: absent key →
  row hidden (plan does not include it), present but empty → shown as having no
  source. That distinction already exists in
  `transformAccommodationTranslations` and must survive.

### 6.2 Persistence: the section PATCH

Decided by the owner: the edit rides the accommodation PATCH.

1. Add `nameI18n`, `summaryI18n`, `descriptionI18n`, `richDescriptionI18n` to
   `AccommodationUpdateHttpSchema` (typed `I18nTextSchema`-compatible, nullish),
   and forward them in `httpToDomainAccommodationUpdate`.
2. `traducciones.astro` adopts `useAccommodationSectionForm` with
   `ownFields = ['nameI18n', 'summaryI18n', 'descriptionI18n', 'richDescriptionI18n']`,
   so the translations page can never clobber another section's data — the
   invariant the hook exists to hold.
3. The panel becomes stateless with respect to persistence (commerce model): it
   calls `onChange` with the full i18n state; the page owns the dirty diff and
   the save button.

**The diff must be deep for these four keys.** The hook's per-field comparison
is written for scalars; an `I18nText` is an object, so a shallow identity check
would mark the field dirty on every keystroke-free re-render or, worse, never.
This is an implementation requirement, not a nicety.

### 6.3 Freeze: one writer, no second merge

When a PATCH changes an `(field, locale)` pair, that pair is marked
`autoTranslated: false`.

**The accommodation service must not hand-roll a second `translationMeta`
merge.** This repo has already paid for that pattern twice in billing (a
canonical helper created, call sites left on their own copy). Extract the merge
from `ai-translate.service.ts` into a single exported primitive — e.g.
`markManualTranslationOverrides({ entityType, entityId, pairs })` — and have
both `applyManualOverride` and the accommodation update path call it. One
writer, one Zod gate, one place to get it right.

Rules:

- Only pairs whose value **actually changed** are marked. Re-saving the form
  without touching `en` must not freeze `en`.
- Only `en` / `pt` get entries. `es` is the source, not a translation; it never
  gets a `translationMeta` entry.
- Clearing a locale to empty is a legitimate edit (the host wants that language
  gone) and **does** freeze it — otherwise the next AI run refills it and the
  host's deletion is undone.

### 6.4 Write-side entitlement gate for `richDescriptionI18n`

This is the hole the spec opens if ignored. `gateRichDescription()`
(`accommodation-entitlements.ts:84-121`) inspects only `body.description`. Once
`richDescriptionI18n` is writable, a host without `CAN_USE_RICH_DESCRIPTION`
could write premium content through the translation panel.

Extend the gate to cover the i18n key, following the HOS-216 convention already
established there: **neutralize, do not reject** — drop the
`richDescriptionI18n` key from the effective body and let the rest of the PATCH
proceed, logging a warning. A 403 would block a host from saving their `name`
translation because of a field their plan does not include.

The same reasoning applies to `gateVideoEmbed()` if a video URL can reach a
translated description; treat it symmetrically.

### 6.5 "The original changed" notice + per-field regenerate

Two parts.

**Detection — decided (owner, 2026-08-17): a fingerprint of the source text,
stored in `translationMeta`.**

Every writer of a `(field, locale)` pair also records `sourceHash` — a digest of
the **source-locale text the translation was produced from**:

```
translationMeta.description.en = {
    autoTranslated: false,
    translatedAt: "2026-08-17T...",
    sourceHash: "a3f9c1..."      // digest of accommodations.description at write time
}
```

A pair is stale ⇔ `hash(current source value) !== sourceHash`. Editing the price
leaves every hash untouched, so it produces zero notices; editing the Spanish
`description` invalidates exactly `(description, en)` and `(description, pt)`.

The key is **optional** on `TranslationMetaSchema` — additive, which the
schema-compat policy allows. Pairs written before this ships carry no hash;
absence means *unknown*, which renders **no notice** (never a false one), and
self-heals on the first write to that pair.

Two rejected alternatives, recorded so they are not re-proposed:

- A per-field `sourceUpdatedAt` timestamp compared against `translatedAt`.
  Equally precise, but it needs a new write on the accommodation update path for
  every field plus a new place to store it — strictly more moving parts for the
  same answer, with the same backfill gap.
- `accommodations.updatedAt` vs `translatedAt`. One price edit marks all four
  fields stale; the notice becomes noise and hosts learn to ignore it.

**Regenerate** — a button on the stale field only. It calls the existing
translate route with three things it does not accept today:

- a field selection (`fields: ['description']`),
- `onlyMissing: false`,
- an explicit intent to overwrite the frozen pair.

Without the third, `persistTranslations:523` skips the pair and the button does
nothing — silently. The intent must be explicit and scoped to the exact pairs
the host asked to regenerate; a blanket "ignore all manual overrides" flag would
undo every correction on the row.

Regenerating is an AI call: it stays behind `AI_TRANSLATE` +
`MAX_AI_TRANSLATE_PER_MONTH`. A host without the entitlement sees the notice and
can fix it by hand — which is free — but has no regenerate button.

### 6.6 Free to correct, premium to generate

No entitlement is required to `PATCH` the i18n fields. The baseline
`requireEntitlement(EDIT_ACCOMMODATION_INFO)` on the PATCH route stays as it is
(it is granted on every host tier); nothing new is added on the write path
except the `richDescriptionI18n` content gate of §6.4.

## 7. Data model / contracts

**No migration.** All four `*I18n` columns and `translation_meta` already exist
on `accommodations`.

| Surface | Change |
| --- | --- |
| `AccommodationUpdateHttpSchema` | + `nameI18n`, `summaryI18n`, `descriptionI18n`, `richDescriptionI18n` (nullish) |
| `httpToDomainAccommodationUpdate` | forward the four new keys |
| `AccommodationProtectedSchema` | + a computed per-pair provenance projection (`autoTranslated`, `translatedAt`, `isStale`) — never the raw `translationMeta` column (D-2) |
| `TranslationMetaSchema` | + optional `sourceHash` per (field, locale) — additive, allowed by the schema-compat policy (D-1) |
| `POST /protected/ai/translate` | + `fields?: string[]`, + `onlyMissing?: boolean`, + scoped override-manual intent |
| `ai-translate.service.ts` | extract the shared `translationMeta` merge primitive (§6.3) |
| `gateRichDescription()` | also inspect / neutralize `richDescriptionI18n` |

Web:

| File | Change |
| --- | --- |
| `TranslationPanel.client.tsx` | tabs + textareas + stale notice + per-field regenerate; `onChange` up to the page |
| `translation-status.ts` | drop `TRANSLATED_MARKER` (the stand-in for text the panel never rendered); model per-pair provenance/staleness |
| `traducciones.astro` | adopt `useAccommodationSectionForm` with the four `ownFields` |
| `transforms.ts` | carry provenance/staleness into `AccommodationTranslationData` |
| `types.ts` | extend `TranslatableFieldStatus` with per-locale provenance |
| `@repo/i18n` | new keys for the panel (labels, placeholder, stale notice, regenerate, freeze hint) |

## 8. UX / UI behavior

- Landing on `/mi-cuenta/propiedades/:id/editar/traducciones/`, the host sees
  the `ES` tab with the source text, read-only, and the two target tabs with
  whatever is stored.
- A field whose translation was written by AI shows a discreet provenance mark
  ("traducido automáticamente"); one the host corrected shows "corregido por
  vos" and is never touched by a generation run again.
- A corrected field whose Spanish source later changed shows a notice and a
  regenerate button, on that field only.
- The bulk "Generar traducciones faltantes" button stays, with its current
  `onlyMissing: true` semantics: it fills holes, never overwrites.
- Saving is the section's normal save button, with the editor's normal dirty
  guard and toasts. No per-field save.
- Every string goes through `t()`. The panel is an island: the locale arrives as
  a prop.

## 9. Acceptance criteria

- **AC-1** — The panel renders the stored `en` and `pt` text for `name`,
  `summary` and `description`; the `es` tab renders the source read-only.
- **AC-2** — A host with no paid plan edits `en`/`pt` and saves successfully;
  the values persist and are returned by the protected GET.
- **AC-3** — A host **without** `CAN_USE_RICH_DESCRIPTION` does not see the
  `richDescription` row, and a PATCH carrying `richDescriptionI18n` from such a
  host does not write it — while the rest of that same PATCH does persist
  (neutralize, not reject).
- **AC-4** — A host **with** `CAN_USE_RICH_DESCRIPTION` sees the row and can
  edit it.
- **AC-5** — After a manual correction of `(description, en)`, a subsequent
  generation run leaves that pair untouched, and `translationMeta.description.en.autoTranslated === false`.
- **AC-6** — Saving the form without touching `en` does not freeze `en`.
- **AC-7** — Editing an unrelated field (price) does **not** mark any
  translation as stale.
- **AC-8** — Editing the Spanish `description` marks `(description, en)` and
  `(description, pt)` stale, and only those.
- **AC-9** — The per-field regenerate overwrites the frozen pair for that field
  only; other frozen pairs on the same accommodation stay frozen.
- **AC-10** — A host without `AI_TRANSLATE` (or over `MAX_AI_TRANSLATE_PER_MONTH`)
  gets no regenerate button, and the route rejects the call if it is made
  directly.
- **AC-11** — Clearing a locale to empty persists as empty and is not refilled
  by the next generation run.
- **AC-12** — The translations page's PATCH body contains only the four `*I18n`
  keys — no other section's fields.

## 10. Risks

- **R-1 — A second `translationMeta` writer.** Mitigated by §6.3 (one extracted
  primitive). If the accommodation service grows its own merge, the two will
  drift, exactly as `normalizeStoredSubscriptionStatus` and
  `isEntitlementGrantingStatus` did in billing.
- **R-2 — Premium leak through the translation panel.** `richDescriptionI18n`
  becomes writable; without §6.4 a basic host writes premium content by the back
  door. A regression test on the write gate is mandatory, not optional.
- **R-3 — `translationMeta` is writable on the domain update schema.**
  `AccommodationUpdateInputSchema` does not omit it. No route exposes it today,
  but this spec adds the first host-driven path into that update. Omit
  `translationMeta` from the update input as part of this work, so the only way
  to write it is the §6.3 primitive.
- **R-4 — Commerce has the same freeze gap.** `CommerceTranslationPanel` edits
  are not marked `autoTranslated: false`, so a batch AI run can overwrite an
  owner's correction there. Out of scope; file a Linear follow-up once the
  primitive from §6.3 exists, since it makes the commerce fix small.
- **R-5 — Stale detection with no backfill.** Rows translated before this ships
  carry no baseline, so staleness is unknown for them. Fail quiet: show no
  notice rather than a false one. It self-heals on the next write.
- **R-6 — The i18n-client-namespaces guard does not distinguish `import type`.**
  If the panel imports a type from a module that names i18n keys, the whole
  bundle is pulled into every visitor's payload. Put shared types in a
  `*.types.ts`.

## 11. Decisions taken and open questions

### D-1 — Staleness detection: source fingerprint (owner, 2026-08-17)

Resolved. See §6.5 for the mechanism and the two rejected alternatives.

### D-2 — Provenance is exposed as a computed projection, not the raw column

The panel needs, per (field, locale): AI or human, when, and whether it is
stale. The protected GET returns a **reduced per-pair object**
(`autoTranslated`, `translatedAt`, `isStale`) built server-side, rather than
picking `translationMeta` into `AccommodationProtectedSchema` raw.

Two reasons. `provider` and `model` stay internal, which is what the schema's
existing *"internal and deliberately NOT picked"* comment protects. And
staleness is computed once, in the place that owns the rule (it needs the source
text and the hash, both of which the API already has in hand), instead of being
re-derived in the browser where a second implementation would drift from the
first.

### OQ-1 — The ungated translate route (§5.6)

`POST /protected/ai/translate` writes to any entity id with no ownership check.
Fix it inside this spec, or as its own Linear issue?

**Recommendation: its own issue, merged before this ships.** It is a small
ownership check but it is a security fix that deserves its own PR, its own
regression test, and a title a reviewer can read as such — not a line buried in
a translation-panel diff.

## 12. Implementation notes

- Suggested slicing: (1) the `translationMeta` primitive extraction + the
  `translationMeta` omit on the update input (pure API, no UI); (2) the write
  contract — HTTP schema, mapper, `richDescriptionI18n` gate, with the gate's
  regression test; (3) the panel's read+edit UI and the section form; (4)
  `sourceHash` + the staleness projection + the per-field regenerate.
- Slices 1–3 deliver the owner's decision #1 and #3 (view, edit, free) on their
  own. Slice 4 delivers decision #2's second half (the escape hatch) and is the
  only one that touches the AI route, so it is also the one that wants OQ-1
  resolved first.
- Write `sourceHash` from slice 1 onwards even though nothing reads it until
  slice 4 — every pair written in between then arrives with a baseline, which is
  exactly the backfill gap R-5 describes.
- The bulk generate button's `onlyMissing: true` is load-bearing: it is what
  makes today's button incapable of overwriting anything. Do not repurpose it
  for the per-field regenerate — add the explicit scoped intent instead.
- `TRANSLATED_MARKER` (`translation-status.ts:81`) exists only because the panel
  never rendered real text. Once the text is rendered, the marker is a lie
  waiting to be displayed; remove it with `applyRunToTranslations`'s fold.
- The web transform already distinguishes "premium key absent" from "premium key
  present but empty" by key membership, not truthiness
  (`transforms.ts:2043`). Preserve that; it is what hides a row that can never
  fill in.
- Verify in a browser, not only in vitest: the panel is a hydrated island and
  jsdom cannot see the tab focus behaviour.

## 13. Linear

Canonical tracking:
HOS-583

Related: HOS-480 (G7 epic), BETA-199 (absorbed), HOS-317 (shipped the
entitlement strip this spec assumed it had to build).
