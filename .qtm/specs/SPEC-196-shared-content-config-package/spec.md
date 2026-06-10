---
id: SPEC-196
slug: shared-content-config-package
title: Shared Config-as-Code Package — centralize curated content & catalog files
status: draft
owner: qazuor
created: 2026-06-05
relatedSpecs:
  - SPEC-175  # admin-whats-new — owns apps/api/src/data/whats-new/whats-new.ts
  - SPEC-174  # admin-welcome-tour — owns apps/admin/src/config/ia/tours.ts
  - SPEC-192  # billing-catalog-to-db — moved billing catalog READS to DB; the config files remain as seed/source-of-truth inputs
  - SPEC-154  # admin config-driven IA — defines the boundary between app IA config (stays) and curated content (moves)
tags:
  - architecture
  - config-as-code
  - content
  - monorepo
  - dx
---

# SPEC-196 — Shared Config-as-Code Package

> **Status: DRAFT (exploratory).** Owner decision 2026-06-05: capture the intent and
> inventory now; the options analysis and the concrete migration path are deliberately
> deferred to implementation time ("cuando nos toque hacerlo, analizamos mejor las
> opciones y el camino a seguir"). Do NOT start implementation from this document
> without first running the §5 decision workshop with the owner.

## 1. Problem

Curated, owner-editable "config as code" files are scattered across three (or more)
locations in the monorepo. Finding "where do I add a What's New entry / a tour / a
plan" requires tribal knowledge:

| Content | Current location | Consumer | Validated by |
|---|---|---|---|
| What's New entries | `apps/api/src/data/whats-new/whats-new.ts` | API (boot parse) | `WhatsNewCatalogSchema` (@repo/schemas) at import time |
| Admin tour catalog | `apps/admin/src/config/ia/tours.ts` | Admin (boot parse) | `ToursRecordSchema` + cross-checks §T1–T3 in `config/ia/schema.ts` |
| Billing plans | `packages/billing/src/config/plans.config.ts` | billing/seed (post SPEC-192: DB is the runtime source; config feeds seed/sync) | billing validation |
| Billing addons | `packages/billing/src/config/addons.config.ts` | idem | idem |
| Billing entitlements | `packages/billing/src/config/entitlements.config.ts` | idem | idem |
| Billing limits | `packages/billing/src/config/limits.config.ts` | idem | idem |
| Billing promo codes | `packages/billing/src/config/promo-codes.config.ts` | idem | idem |

The goal: ONE discoverable home (root-level or near-root shared package) for every
file a human curator edits, while keeping the boot-time Zod validation guarantees
each consumer already has.

## 2. Goals

1. A single, discoverable location (workspace package, e.g. `@repo/content` or
   `@repo/catalog`, possibly mounted at a root-level `content/` dir included in the
   pnpm workspace) for ALL curated config-as-code files.
2. Each consumer keeps its current boot-time validation semantics (a typo still
   fails startup, never production).
3. Zero behavior change for end users; pure relocation + import updates.
4. A curator-facing README/index in the new package: what each file is, how to edit,
   how it is validated, how it ships.
5. Convention for future additions (naming, schema-in-@repo/schemas, validation at
   the consumer boundary).

## 3. Non-goals

- Admin CRUD UIs for any of this content (stays repo-curated).
- Changing WHAT is validated or the runtime read paths (e.g. SPEC-192's DB-backed
  billing reads stay as they are; only the source files relocate).
- Moving app IA structure config (sections/dashboards/sidebars/roles of SPEC-154):
  that is application wiring, not curated content. Only `tours.ts` (editorial
  content) is in scope from the IA family — boundary to be ratified in §5.

## 4. Known constraints (verified 2026-06-05)

- A bare root folder is NOT importable across the monorepo; centralizing requires a
  workspace package (pnpm workspace + exports map). A root-level dir can BE that
  package (`content/` listed in `pnpm-workspace.yaml`) if root visibility is wanted.
- `tours.ts` is the hard case: it depends on `TourSchema`/`I18nLabelSchema`/permission
  gate primitives that live in `apps/admin/src/config/ia/` (tour.schema.ts,
  primitives.ts), and its cross-checks (§T1 targets, §T2 roles, §T3 routes) validate
  against the admin's live sections/roles config — those cross-checks CANNOT leave
  the admin app. Likely split: schemas → `@repo/schemas`, data → new package,
  cross-check validation stays in admin's `validate.ts`.
- `whats-new.ts` is the easy case: its schema already lives in `@repo/schemas`; the
  data file only imports from there. Near-free move.
- Billing configs: post SPEC-192 they are seed/source inputs, not runtime reads —
  confirm with the SPEC-192/193 owner-agent before moving (coordination point).
- Admin consumes workspace packages via Vite aliases to `src/` for ~8 packages and
  `dist/` for 4 (admin CLAUDE.md gotcha) — the new package must pick one mode
  deliberately; `src/`-aliased avoids the build-before-dev trap.
- apps/api e2e/test suites mutate `whatsNewEntries` in place via module path
  (`test/e2e/flows/whats-new/`) — import paths in tests must move in the same PR.

## 5. Decisions deferred to implementation (owner workshop)

- **D-1** Package name + mount point: `packages/content/` vs root `content/` in the
  workspace; name `@repo/content` vs `@repo/catalog` vs other.
- **D-2** Scope of first migration wave: whats-new only → tours → billing, or all at
  once.
- **D-3** Whether billing config files move at all (they are technical seed inputs;
  the owner said "incluyendo billing", but SPEC-192/193 ownership and the DB-backed
  flow may argue for leaving them and only LINKING them from the package README).
- **D-4** TourSchema relocation target (`@repo/schemas` vs inside the new package).
- **D-5** Internal layout (`<package>/src/whats-new.ts`, `<package>/src/admin-tours.ts`,
  `<package>/src/billing/*.ts`) and export map.
- **D-6** Interim discoverability: whether to land a root `CONTENT.md` index +
  curator guide in `docs/guides/` BEFORE the package exists (cheap, immediate value).

## 6. Rough effort

- Wave 1 (whats-new only): ~half day incl. test-path updates.
- Wave 2 (tours, with schema split): ~1 day incl. cross-check rewiring + suites.
- Wave 3 (billing, if D-3 says yes): ~half day + coordination with billing agent.
- Curator README + conventions doc: ~2h.

## 7. Acceptance (high level, to be refined at activation)

- All in-scope files live under the new package with a curator README.
- Every consumer still fails its OWN boot on invalid content (validation semantics
  unchanged, locations updated).
- Full pre-existing suites that reference moved modules pass (run the sweep rule:
  rg the moved symbols over all test dirs and run every match).
- `docs/guides/` has the curator guide; root has a pointer (CONTENT.md or README
  section).
