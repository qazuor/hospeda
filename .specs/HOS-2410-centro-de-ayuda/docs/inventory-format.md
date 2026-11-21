# HOS-2410 — Phase 1: inventory format and acceptance

The inventory is both the content plan (Phase 5) and the seed of guard (b)'s
exemption file (Phase 3). Parent: [`../spec.md`](../spec.md). This document
defines the output. It does not perform the inventory.

## 1. Output

One file: `.specs/HOS-2410-centro-de-ayuda/docs/inventory.md`, delivered by PR-1
(docs-only, no magic word).

### 1.1 Structure

```text
# HOS-2410 inventory (generated YYYY-MM-DD from origin/staging @ <sha>)
## 0. Counts            ← table of §3, with the command that produced each number
## 1. accommodation (host)
## 2. venue (gastronomy + nightlife)
## 3. experience
## 4. provider (host trades)
## 5. partner
## 6. account-wide (all audiences)
## 7. Out of scope (tourist, editorial) and no-user-surface
## 8. Article plan       ← one row per planned article
```

### 1.2 Row format (sections 1–7)

One table per section, one row per surface:

| Column | Content |
|---|---|
| `anchor` | Exact anchor string per `data-model.md` §2.2 (`page:…`, `section:…`, `entitlement:…`, `limit:…`, `enum:…`, `tool:…`, `activation:…`). For surfaces with no anchor kind (emails, crons, `publicar/*`, `planes/*`), use `email:<NotificationType>`, `cron:<job-name>`, `page:<template>` respectively, marked `(no gate)` |
| `kind` | page · section · entitlement · limit · state · tool · activation · email · cron |
| `audiences` | subset of host, venue, experience, provider, partner |
| `what the owner sees` | One sentence, user-facing words (button label, page title, email subject) |
| `source` | `path:line`, verified by reading |
| `plannedArticle` | Article id (new or one of the 16) or `—` |
| `exempt` | Empty, or `out-of-scope: <reason>` / `no-user-surface: <reason>` |

### 1.3 Article plan (section 8)

| id | folder | audiences | verticals | covers (anchors) | entryFor | depends on (HOS-…) |
|---|---|---|---|---|---|---|

Rules: every in-scope row of sections 1–6 appears in at least one article's
`covers` or `entryFor`. An entitlement, limit, tool or enum anchor may appear in
the `covers` of several sibling articles (D-H11; owner, 2026-11-20). Guard (c)
then flags every one of them when that anchor changes. Every page and section row appears in exactly one
`entryFor`. Ids follow `data-model.md` §2 and never reuse a retired id.

## 2. Acceptance criteria (PR-1)

- INV-1 Every `.astro` under `apps/web/src/pages/[lang]/mi-cuenta/` has a row.
  Count check: `fd -e astro . 'apps/web/src/pages/[lang]/mi-cuenta' | wc -l` equals
  the number of `page:mi-cuenta/*` rows.
- INV-2 Every web editor section slug per vertical has a `section:` row, including
  non-catalog sections (`politicas`, `preguntas-ia`).
- INV-3 Every `EntitlementKeyEnum` and `LimitKeyEnum` value has a row
  (`packages/schemas/src/catalog/key-enums.ts:2`, `:65`).
- INV-4 Every tool in `MCP_TOOL_DEFINITIONS` (`apps/api/src/mcp/tools/registry.ts:33-55`) has a row.
- INV-5 Every value of `PublicationStatusEnum`, `SUBSCRIPTION_STATUSES` and
  `TrialStatusEnum` has a row, plus each vertical's activation event.
- INV-6 Every `NotificationType` (`packages/notifications/src/types/notification.types.ts:4`)
  whose recipient is an owner, provider or partner has an `email:` row. The others
  are listed once in section 7 with their recipient.
- INV-7 Every job in `apps/api/src/cron/schedules.manifest.ts` whose effect the
  owner can see (state change, email, deadline) has a `cron:` row. The others are
  listed in section 7 in one line each.
- INV-8 Owner flows outside `/mi-cuenta`: `publicar/*`, `planes/*`, and the
  public pages a host sees about their own listing, as `page:` rows marked
  `(no gate)`.
- INV-9 Every `source` was read, not guessed. A row whose behaviour could not be
  verified carries `UNVERIFIED: <why>` in "what the owner sees", and is listed
  in section 0.
- INV-10 Section 0 reproduces every count with the exact command used, so a
  reviewer can re-run it.
- INV-11 Section 8 lists, per article, the HOS issues it waits on (HOS-2341 for any
  `faqKey` it names, HOS-2066 for subscription-dependent content, etc.).

## 3. Size estimate (sampled 2026-11-20 on `origin/staging`)

| Set | Count | Source | In scope (estimate) |
|---|---|---|---|
| Account pages | 77 `.astro` | `apps/web/src/pages/[lang]/mi-cuenta/**` | ≈ 62 (minus 9 tourist: `alertas`, `favoritos` ×2, `historial-busquedas`, `ofertas-exclusivas`, `recomendaciones`, `resenas`, `consultas` ×2; minus 6 editorial: `publicaciones` ×3, `eventos` ×3) |
| Editor pages | 32 of the 77 (accommodation 13 sections + hub; venue/experience 17 section files + hub) | `propiedades/[id]/editar/*`, `comercio/[vertical]/[id]/editar/*` | all |
| Editor section anchors | ≈ 39 (accommodation 11 catalog + `politicas` + `preguntas-ia`; venue 14 + `preguntas-ia`; experience 10 + `preguntas-ia`) | `packages/portal-routes/src/portal-routes.ts:261-302`, `apps/web/src/lib/editor/accommodation-editor-sections.ts:91,112`, `listing-editor-registry.ts:112` | all |
| Entitlement keys | 59 | `key-enums.ts:2-62` | ≈ 55 |
| Limit keys | 23 | `key-enums.ts:65-89` | ≈ 16 (tourist: favorites, collections, search history, alerts, compare, consumer chat, …) |
| MCP tools | 22 | `registry.ts:33-55` | all |
| State values | 6 + 9 + 3 | `publication-status.enum.ts:21-28`, `subscription.dbschema.ts:22-32`, `trial-status.enum.ts:14-18` | all |
| Notification types | 43 | `notification.types.ts:4` | ≈ 30. The owner-relevant template folders hold about 100 `.tsx` files: `billing` 45, `trial` 13, `subscription` 12, `verticals` 11, `host-trade` 6, `conversation` 5, `alliance` 5, `partner` 2, `listing` 2 |
| Cron jobs | 57 entries | `schedules.manifest.ts` | ≈ 16 (the billing/verticals jobs named in the root CLAUDE.md) |
| Existing topics | 16 | `apps/api/src/data/owner-help/topics/*.ts` | migrated in PR-3 |

**Totals:** about 270 inventory rows; about 70–90 articles (host ≈ 20, venue ≈ 18,
experience ≈ 12, provider ≈ 6, partner ≈ 5, common ≈ 15–25, including the 16).
Article count matters more than row count, because one article covers many
anchors (e.g. one "Fotos" article covers three section anchors and one limit).

**Effort signal:** the inventory is read-only work over about 150 files. It splits
naturally by section (1–7), so it can be parallelized across agents, one per
vertical, merged into one file by the owner of PR-1.
