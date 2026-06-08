---
id: SPEC-200-DELTA-1
title: "SPEC-200 Delta: Enrich AI Chat Context with Full Accommodation Data"
status: draft
parentSpec: SPEC-200
created: 2026-06-07
tags:
  - ai
  - chat
  - context
  - delta
---

# SPEC-200 Delta 1: Enrich AI Chat Context

## 1. Summary

Expand the accommodation AI context assembler (`accommodation-ai-context.ts`) to
include all structured data that helps the LLM answer tourist questions accurately.
The current context is thin (name, type, destination.name, summary, truncated
description, FAQs, amenity/feature names). This delta adds capacity, pricing,
ratings, full destination hierarchy, and — most importantly — the `iaData` table
(owner-authored content specifically written for the AI chatbot).

## 2. Motivation

Tourists ask questions about capacity ("¿cuántos dormitorios?"), price ("¿cuánto
cuesta por noche?"), ratings ("¿qué tan bien evaluado está?"), and specific
policies/rules. The current context forces the LLM to say "no tengo esa
información" for all of these, despite the data existing in the DB.

The `iaData` table is the highest-value addition: owners write structured
`{title, content, category}` entries specifically for AI consumption (house rules,
neighborhood info, pet policies, etc.). This is effectively the RAG knowledge base
for each accommodation.

## 3. Fields to Add

### 3.1 Capacity & Space (`extraInfo` JSONB)

| Field | Markdown line | Example |
|-------|--------------|---------|
| `extraInfo.capacity` | `**Capacidad**: 6 huéspedes` | Required in DB |
| `extraInfo.bedrooms` | `**Dormitorios**: 3` | Required in DB |
| `extraInfo.bathrooms` | `**Baños**: 2` | Required in DB |
| `extraInfo.beds` | `**Camas**: 4` | Optional |
| `extraInfo.minNights` | `**Mínimo de noches**: 2` | Required in DB |
| `extraInfo.maxNights` | `**Máximo de noches**: 30` | Optional |

### 3.2 Pricing (`price` JSONB)

| Field | Markdown line | Example |
|-------|--------------|---------|
| `price.price` | `**Precio**: $15000` | Optional |
| `price.currency` | `**Moneda**: ARS` | Optional |

Only include if `price.price` is non-null. Format as: `**Precio base**: $15000 ARS/noche`.

### 3.3 Ratings

| Field | Markdown line | Example |
|-------|--------------|---------|
| `averageRating` | `**Rating promedio**: 4.50/5` | Default 0 |
| `reviewsCount` | `**Reseñas**: 23` | Default 0 |

Only include if `reviewsCount > 0`.

### 3.4 Destination (full)

Replace the current `destination.name` with full hierarchy:

```
**Destino**: Concepción del Uruguay, Entre Ríos, Argentina
```

Load the destination's `name` + parent chain (or at minimum `destination.name` +
`destination.destinationType`). The destination service's `getById` already
returns the full entity — we just need to format the hierarchy.

### 3.5 IA Data (`accommodation_ia_data` table) — HIGHEST PRIORITY

```
### Información Especial

#### Reglas de la casa
[content of iaData entries with category "house_rules"]

#### Políticas
[content of iaData entries with category "policies"]

#### Barrio y alrededores
[content of iaData entries with category "neighborhood"]

#### Otros
[content of iaData entries with no category or uncategorized]
```

- Only include entries with `lifecycleState: ACTIVE`
- Max **10 entries** total
- Max **500 chars per entry** (truncate with `…` like descriptions)
- Group by `category` (if present), uncategorized last
- If `category` is null, use "Otros"

## 4. Context Block Format (updated)

```markdown
## Accommodation: [name]
**Type**: [type]
**Destino**: [hierarchy]
**Summary**: [summary]

### Capacidad
**Capacidad**: [capacity] huéspedes
**Dormitorios**: [bedrooms]
**Baños**: [bathrooms]
**Camas**: [beds]
**Mínimo de noches**: [minNights]
**Máximo de noches**: [maxNights]

### Precio
**Precio base**: $[price] [currency]/noche

### Valoración
**Rating promedio**: [averageRating]/5 ([reviewsCount] reseñas)

### Description
[truncated description]

### Información Especial
[iaData entries grouped by category]

### Amenities
- [amenity names]

### Features
- [feature names]

### FAQs
**Q: [question]**
A: [answer]
```

## 5. Implementation Changes

### File: `apps/api/src/services/accommodation-ai-context.ts`

1. **Update `AccommodationWithRelations` interface** — add `extraInfo`, `price`,
   `averageRating`, `reviewsCount`, `destination` (full object), `faqs` array

2. **Update `buildMarkdownContext`** — add new sections for capacity, pricing,
   ratings, destination hierarchy, and iaData

3. **Add `safeLoadIaData`** — Drizzle query against `accommodation_ia_data`
   filtered by `lifecycleState: ACTIVE`, limited to 10, with graceful fallback

4. **Update `assembleAccommodationContext`** — load iaData, pass to
   `buildMarkdownContext`

5. **Update `CONTEXT_FAQ_MAX`** — keep at 10

6. **Add `CONTEXT_IADATA_MAX = 10`** and `CONTEXT_IADATA_CONTENT_MAX_CHARS = 500`**

### Tests

- Update `apps/api/test/services/accommodation-ai-context.test.ts`
- Add tests for: capacity fields, pricing, ratings, destination hierarchy, iaData
  grouping/truncation, empty/null handling

## 6. Token Budget

Current context ≈ 400-600 tokens per call. Adding all fields ≈ 200-400 additional
tokens. Total ≈ 600-1000 tokens per call. Well within the 20-message exchange cap.

The iaData entries are the biggest variable — 10 entries × 500 chars ≈ 3500 chars
≈ 900 tokens. Total worst case ≈ 1500 tokens per call. Still safe.

## 7. Acceptance Criteria

- [ ] AC-1: Capacity fields appear in context when present
- [ ] AC-2: Pricing appears in context when `price.price` is non-null
- [ ] AC-3: Ratings appear when `reviewsCount > 0`
- [ ] AC-4: Destination shows full hierarchy (not just name)
- [ ] AC-5: IA data entries appear grouped by category
- [ ] AC-6: IA data entries truncated at 500 chars
- [ ] AC-7: Only ACTIVE iaData entries included
- [ ] AC-8: Max 10 iaData entries
- [ ] AC-9: Graceful fallback (empty arrays) on DB errors
- [ ] AC-10: Unit tests pass for all new sections
