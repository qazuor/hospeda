---
title: Venue minimum-age scope (all day, from a time, or one sector)
linear: HOS-2098
statusSource: linear
created: 2026-11-09
type: feature
areas:
  - web
  - api
  - content
smokeGates:
  - status-needs-smoke-staging
---

# Venue minimum-age scope (all day, from a time, or one sector)

## Problem

A venue stores one minimum age (`policies.minAge`, for example 18) with no
scope. The chat cannot know whether it applies all day or only at night. The
typical case is a family restaurant at noon that turns into a +18 club at
night: a tourist asks "can I go for lunch with my 10-year-old?" and the bot
must refer them to the venue, because the HOS-2095 rules only let it narrow
the age from an explicit sentence in the owner's free text.

## Owner decisions (09/11/2026, final)

- The owner picks ONE of three options:
  - «Rige todo el día» — the default for every venue that already exists.
  - «Rige desde las HH:MM».
  - «Rige solo en un sector o actividad», with a short text ("pista", "show").
- The public ficha shows the scope next to the minimum age and the legal
  notice, e.g. «Edad mínima: +18 · Rige desde las 00:00». Ficha and chat say
  the same thing.
- The chat may say a minor CAN go only when the question falls outside the
  stored scope (another time, or an area/activity other than the sector).
  With «todo el día», or no scope stored, the current conservative rule stays:
  minimum age + verbatim legal notice + refer to the venue, never permission.
- Legally sensitive (Ley 24.788): the legal-notice text is never weakened.

## Design

### Data — `policies.minAgeScope` (no new column)

`minAge` already lives in the venue `policies` JSONB (HOS-2060), so the scope
is one more key there. No structural migration, no backfill.

```ts
type VenueMinAgeScope =
  | { kind: 'all_day' }
  | { kind: 'from_time'; from: 'HH:MM' }          // 24 h, 00:00–23:59
  | { kind: 'area'; area: { es; en; pt } };       // ≤ 60 chars each, ≥ 1 non-blank
```

- Zod: `VenueMinAgeScopeSchema` (discriminated union on `kind`) in
  `packages/schemas/src/entities/venue/subtypes/venue.policies.schema.ts`,
  added to `VenuePoliciesSchema` as `minAgeScope: ...nullish()`. Error
  messages are `zodError.venue.minAgeScope.*` keys (es/en/pt).
- **Unset ≡ `all_day`.** Existing venues get the default by reading, not by
  writing: page, chat and editor treat an absent key exactly as `all_day`.
- The catalog's `nightInfo` section claims the key
  (`policyKeys: [..., 'minAgeScope']`), so it is gated, projected and
  sections-touched together with `minAge`.
- The scope means nothing without an age: page and chat ignore it when
  `minAge` is absent; the editor hides the selector without an age and clears
  the scope when the age is cleared.

### Editor (`NightInfoSection`)

Under the minimum age: a select with the three options (unset shows «Rige
todo el día»), an `HH:MM` time input for «desde las», and an es/en/pt short
text for «solo en un sector o actividad». Saved through the existing
`onPolicyChange` → `policies` PATCH path (`null` deletes the key).

### Public ficha (`VenueNightInfo.astro`)

The age row renders `+18 · <scope label>` then the unchanged legal notice:

| scope | es | en | pt |
|---|---|---|---|
| all_day / unset | Rige todo el día | Applies all day | Vale o dia todo |
| from_time | Rige desde las {{time}} | Applies from {{time}} | Vale a partir das {{time}} |
| area | Rige solo en: {{area}} | Applies only to: {{area}} | Vale só para: {{area}} |

`{{area}}` resolves to the page locale with `es` fallback. The page stays
session-blind.

### Chat context (`venue-night-context.ts` / `venue-ai-context.ts`)

`toVenueNightContext` resolves the scope to the SAME localized label the page
shows; the block prints `**Alcance de la edad mínima**: <label>` right after
`**Edad mínima**`. The area text is owner free text and goes inside the
owner-data fence.

### Chat rule (`DEFAULT_RULES.chat_venue`)

The scope sentences stop reading the listing TEXT and read only the stored
scope line:

- Narrowing comes ONLY from the "Alcance de la edad mínima" line; description,
  FAQs, notes, venue type, menu or hours never narrow it.
- «desde las HH:MM» covers that time until closing that night; earlier hours
  of the day are outside it.
- Out-of-scope question (clearly another time / another area or activity):
  "yes" for that part, age only as the limit of the restricted part with its
  scope, legal notice, confirm with the venue.
- Everything else (all day, no scope line, the restricted part, or an unclear
  time/area): no permission wording; age + verbatim legal notice + refer.

Carried to live environments with a seed data-migration (`before` = the rules
staging holds, byte for byte; `after` = new `DEFAULT_RULES`), following
`0159`/`0160`.

## Acceptance criteria

1. The schema accepts the three kinds and rejects a bad time (`24:00`, `7:5`),
   a blank area, an area over 60 chars and an unknown kind.
2. The editor saves each option, and clearing the age removes the scope.
3. The public ficha renders each option in es/en/pt next to the age, with the
   legal notice unchanged; unset renders as «Rige todo el día».
4. The chat context carries the same label as the page; the area is fenced.
5. The rules let the bot say "yes" only for a question outside a `from_time` /
   `area` scope; `all_day` / unset never yields permission wording
   (regression test).
6. The data-migration's `before` equals the staging rules and `after` equals
   `DEFAULT_RULES`; the previous migration's anti-drift test is chained.
7. The legal notice literal (`venue.detail.nightInfo.legalAge`, three
   locales) is byte-identical before and after.

## Out of scope

- Admin panel editing (the admin already excludes the night keys).
- Several scopes at once, or a time window with an end ("from 20 to 4").
- Seed fixtures: no venue fixture carries a scope (unset ≡ all day), so the
  dual-write rule does not apply.
