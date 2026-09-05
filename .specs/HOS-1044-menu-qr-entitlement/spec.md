---
title: Menu QR with scan analytics for gastronomy
linear: HOS-1044
statusSource: linear
created: 2026-09-04
type: feature
areas:
  - billing
  - api
  - db
  - web
  - admin
---

# Menu QR with scan analytics for gastronomy

## 1. Summary

A restaurant prints a QR, puts it on the table, and a diner scans it to read the
menu. The owner gets a panel showing how many scans that code got, when, and on
what kind of device.

**The metric is the product, not the QR.** Any free site generates a QR; knowing
that forty people scanned it on Tuesday at 21:00 is a fact the owner has no other
way to obtain. This is the only feature of the commerce batch that returns
information about the venue itself.

The generation engine and the scan recording are already built and merged
(HOS-981, HOS-1141). This spec builds four things: the menu's own page, the QR
that points at it, the aggregate read plus the owner's panel, and the premium
entitlement that gates them.

## 2. Problem

Three gaps, each verified against `origin/staging` at `59d5693b4`:

1. **The menu has no URL of its own.** It renders as a section inside the public
   listing (`apps/web/src/pages/[lang]/gastronomia/[slug].astro:338-343` →
   `GastronomyMenu.astro:154`, anchor `#gastro-menu`). A table QR pointing there
   lands the diner on the whole listing, and its destination is one fragment away
   from the door QR that HOS-982 builds for the same venue.
2. **Nothing in the repo reads `qr_code_scans` in aggregate.** The only access is
   the `INSERT` in `registerScan`. There is no count, no series, no endpoint, no
   component. The scans are being written and read by nobody.
3. **The QR would rot on a slug change.** `HostTradeService` repoints its code's
   `target_url` after an update (`host-trade.service.ts:419-456`);
   `GastronomyService` has no such hook. A venue that renames itself would leave
   a printed sticker pointing at a dead URL — the exact defect the whole
   redirect-by-identifier design exists to prevent.

## 3. Goals

- **G-1** — A public page that is the menu and only the menu, with a stable URL
  fit to be printed behind a redirect.
- **G-2** — A `purpose = MENU` QR per venue, minted through the central engine,
  whose target survives a slug change.
- **G-3** — An aggregate read of `qr_code_scans` for one code, and an owner panel
  that renders it.
- **G-4** — One new entitlement on `gastronomy-premium`, gated on the API, and
  visible on every plan-facing surface.
- **G-5** — The grant reaches already-seeded environments. Baseline plus a
  numbered data-migration, in the same PR.

## 4. Non-goals

- **NG-1** — No changes to QR generation, rendering, or scan recording. That is
  HOS-981's engine and it is done. Importing `qrcode` outside
  `apps/api/src/utils/qr-render.ts` fails CI
  (`scripts/check-qrcode-engine-isolation.sh`).
- **NG-2** — No new columns on `qr_code_scans`. HOS-1141 landed them yesterday
  (PR #3194, merged into staging at 17:43 on 2026-09-04) and closed the question
  of what is stored.
- **NG-3** — No geolocation, and no country in the panel. HOS-1141 decided
  against it with an argument this spec inherits: a table QR is scanned from
  inside the venue, so the column would read "Argentina" almost always, including
  for the tourists the metric means to count. `browser_language` answers the same
  question honestly — the language travels with the person, the IP travels with
  the network.
- **NG-4** — No referrer, and the UI must not promise one. A camera scan opens
  the URL directly with no `Referer` header. Device and language are as close as
  it gets.
- **NG-5** — Not the listing QR and not the printable PDF. Those are HOS-982.
  The two issues **order, they do not merge**: that one delivers the printed-QR
  infrastructure for the three verticals, this one delivers the metric.
- **NG-6** — `apps/web/src/pages/[lang]/publicar-restaurante/` is listed as a
  surface in the Linear issue and is **out of scope**: since HOS-941 it is a bare
  301 redirect to `/planes/gastronomia/` (`index.astro:1-55`) with no content of
  its own.

## 5. Current baseline

### What already exists and must be reused

| Piece | Location |
| -- | -- |
| `qr_codes` + `qr_code_scans` tables | `packages/db/src/schemas/qr-code/` |
| `QrCodeService.getOrCreateForEntity` | `packages/service-core/src/services/qr-code/qr-code.service.ts:574-582` |
| `QrCodePurposeEnum.MENU` | `packages/schemas/src/enums/qr-code-purpose.enum.ts:46` — **already declared**, tagged HOS-1044 |
| Public redirect that counts the scan | `apps/api/src/routes/qr-code/public/resolve.ts` + `apps/web/src/pages/qr/[slug].astro` |
| Slug-change repointing precedent | `HostTradeService._afterUpdate`, `host-trade.service.ts:419-456` |
| Owner analytics panel pattern | `apps/web/src/components/commerce/CommerceViewsWidget.client.tsx` |
| Menu section component | `apps/web/src/components/gastronomy/GastronomyMenu.astro` |

`getOrCreateForEntity` is idempotent on `(entityType, entityId, purpose)`, backed
by the partial unique index in `extras/040`, with race recovery in its `catch`
(lines 599-632). Calling it twice returns the same row, so it can be invoked from
a read without a backfill or a creation hook.

### Columns available for the panel

`qr_code_scans` (`qr_code_scan.dbschema.ts:58-164`): `id`, `qrCodeId`,
`scannedAt`, `userAgent`, `deviceType`, `os`, `browserLanguage`,
`targetUrlAtScan`, `userId`. Everything but `qrCodeId`/`scannedAt` is nullable —
the redirect records the scan best-effort and a garbage `user-agent` must never
cost us the count.

### This spec is a pre-announced follow-up

Two comments in the codebase name it by hand:
`CommerceViewsWidget.client.tsx:18-22` and `endpoints-protected.ts:3426-3429`
both list "QR scans" for gastronomy as explicitly out of scope for HOS-734,
"pending its own spec, per vertical". This is that spec.

### The entitlement doc is wrong — do not follow it

`docs/billing/adding-an-entitlement.md:81-96` and its checklist at 236-238 teach
that re-running the seed propagates a new grant to existing rows. **That is false
by two independent paths, both since HOS-39 (2026-07-02):**

1. `packages/billing/src/config/model-c-field-split.ts:95-103` reclassified
   `billing_plans.entitlements` from `capability` to `commercial`, so Model C
   never syncs it back. `billingPlans.seed.ts:260-263` says so in as many words:
   *"No handling here; DB wins."*
2. Commerce plans never reach Model C at all. `ensureCommercePlan`
   (`packages/seed/src/required/commercePlan.seed.ts:43-56`) is insert-only: an
   existing row is `skipped`. `gastronomy-premium` goes through exactly that path.

This is what HOS-1151 reports, and it is why G-5 is a goal rather than an
assumption.

## 6. Proposed design

### 6.1 The menu gets its own page

`apps/web/src/pages/[lang]/gastronomia/[slug]/carta.astro` — the menu, rendered
by the same `GastronomyMenu.astro` the listing already uses, with the venue's
name, hours, and a link back to the full listing. Nothing else.

**Public for any venue that has a menu loaded, with no entitlement gate.** The
menu is already public inside the listing; a second presentation of the same
content is not a new feature to sell. What is sold is the QR and the metric.

SEO: `<link rel="canonical">` pointing at the listing, and the page stays out of
the sitemap. It is a print destination, not a search-results page.

If the venue has no menu, the page answers **404** — not an empty shell.

### 6.2 The QR

Minted through the engine, never on the public page read:

```ts
qrCodeService.getOrCreateForEntity({
    actor,
    entityType: EntityTypeEnum.GASTRONOMY,
    entityId: <venue id>,
    purpose: QrCodePurposeEnum.MENU,
    targetUrl: `${siteUrl}/${lang}/gastronomia/${slug}/carta/`,
    label: <venue name>
})
```

**Minting happens inside the gated owner endpoint only.** Calling it from the
public page render would let any visitor to a non-premium venue's menu create a
live `qr_codes` row as a side effect of a `GET` — rows nobody asked for, on
venues that never bought the feature.

### 6.3 The target survives a slug change

`GastronomyService._afterUpdate`, copying the shape of
`HostTradeService._afterUpdate` (`host-trade.service.ts:419-456`), and copying
its four decisions rather than reinventing them:

1. **Reconcile, do not detect.** Always recompute the expected target; never try
   to spot that the slug changed.
2. **Never mint here.** `if (!code) return entity` — a venue with no QR yet stays
   without one. The code is created when it is asked for.
3. **`siteUrl` comes from the current `targetUrl`** via
   `resolveSiteUrlFromTargetUrl`, not from config.
4. **Log the failure, never throw.** The entity row is already written and there
   is no transaction to roll back. A repointing failure must not fail the update.

### 6.4 The aggregate read

A new method on `QrCodeService` that reads scans for one `qrCodeId`:

- total in the window,
- a daily series,
- a breakdown by `deviceType`, `os` and `browserLanguage`.

Counting is by `qr_code_id`, never by entity. That is the point: **a QR changes
destination — that is the feature.** Counting by entity splits the history in
half the day the code is repointed; counting by code survives it. And a physical
scan is not a web view — telling them apart is what the owner is paying for.

Exposed as a protected route under the gastronomy owner tier, gated as in §6.5.

### 6.5 The gate

One new key, `EntitlementKey.MENU_QR_SCAN_METRICS = 'menu_qr_scan_metrics'`, covering
the QR and the panel together. Splitting them would sell a code and its
measurement separately, and neither is worth anything alone.

Granted in `GASTRONOMY_PREMIUM_PLAN.extraEntitlements`
(`plans.config.ts:977-993`, slug `gastronomy-premium`). **Not** in
`ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map is the floor all three tiers
receive, and a premium-only key placed there would be given away to basic and pro.

Route wiring follows `uploadMenuItemPhoto.ts:206-220`:

```ts
middlewares: [
    createSlidingWindowPerUserRateLimit({ ... }),
    commerceVerticalEntitlementMiddleware('gastronomy'),
    requireEntitlement(EntitlementKey.MENU_QR_SCAN_METRICS)
]
```

The loader must precede the checker (HOS-1074): the global entitlement middleware
resolves the **accommodation** set, which never carries a commerce key. The
example in the entitlement doc is from the wrong vertical for this case.

### 6.6 The panel

A `*.client.tsx` widget in `/mi-cuenta/comercio/`, following
`CommerceViewsWidget.client.tsx`: `client:visible`, `loading/ready/error` states,
its own `*.module.css`. It shows the scan total, the daily series, and the device
and language breakdowns, plus the QR itself with a download.

It must **not** label any of this as location. Language and device, named as
such.

### 6.7 Seed dual write

Baseline (`entitlements.config.ts`, `plans.config.ts`) **and** data-migration
`0098-hos-1044-menu-qr-scan-metrics-entitlement.ts`, in the same PR, copying
`0091-hos-1043-multilingual-gastronomy-menu-entitlement.ts` verbatim in shape:

- frozen literal for the new entitlement (the migration must not import
  `ENTITLEMENT_DEFINITIONS` — it freezes the delta of the day it ran),
- idempotent `INSERT` of the lookup row,
- `UPDATE` of the plan's `entitlements` array **by union, never replacement**, so
  an operator's edits through the admin dialog survive,
- `destructive: false`.

Re-verify the free number against `origin/staging` immediately before committing;
numbering moves with every merge.

**No structural migration.** The columns landed with HOS-1141 and the entitlement
is data, not schema.

## 7. Data model / contracts

### New entitlement

| Field | Value |
| -- | -- |
| Enum member | `MENU_QR_SCAN_METRICS` in `packages/billing/src/types/entitlement.types.ts` (before line 341, `/** Complex entitlements`) |
| Value | `'menu_qr_scan_metrics'` |
| Definition | `ENTITLEMENT_DEFINITIONS` in `entitlements.config.ts` |
| Granted to | `gastronomy-premium` only |

### Endpoints

| Route | Gate | Returns |
| -- | -- | -- |
| `GET /api/v1/protected/gastronomies/{id}/menu-qr` | `MENU_QR_SCAN_METRICS` | the code (minting it if absent) + its image |
| `GET /api/v1/protected/gastronomies/{id}/menu-qr/scans` | `MENU_QR_SCAN_METRICS` | total, daily series, device/os/language breakdowns for a window |

Both need a row in `docs/billing/endpoint-gate-matrix.md` (format at line 803),
enforced by `apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts`.

### New public page

`/{lang}/gastronomia/{slug}/carta/` — 200 with a menu, 404 without one.

## 8. UX / UI behavior

- The panel lives in `/mi-cuenta/comercio/` next to the existing views widget.
- Non-premium venues see the feature as locked, consistent with how the tier is
  presented elsewhere — never a silent absence.
- The QR is downloadable as an image from the panel.
- Wording: **scans**, **device**, **language**. Never "location", "origin", or
  "country" — none of those are recorded, by decision.

## 9. Acceptance criteria

- **AC-1** — `GET /{lang}/gastronomia/{slug}/carta/` answers 200 and renders the
  menu for a venue that has one, and 404 for a venue that does not. Verified by
  request against a running app, not by typecheck.
- **AC-2** — Requesting the menu QR for a `gastronomy-premium` venue twice
  returns **the same** `qr_codes` row, with `purpose = 'MENU'`.
- **AC-3** — Both new endpoints answer **403** for a venue on gastronomy basic
  and pro, and 200 on premium. Asserted per tier, not once.
- **AC-4** — Loading the public menu page of a non-premium venue creates **zero**
  `qr_codes` rows. Asserted by counting rows before and after the request.
- **AC-5** — Renaming a venue's slug leaves its existing `MENU` code's
  `target_url` pointing at the new URL. A venue with no code still has none
  afterwards.
- **AC-6** — Scanning the code writes one `qr_code_scans` row and the panel's
  total goes up by exactly one. The daily series places it on the day of
  `scanned_at`.
- **AC-7** — A scan with a garbage or absent `user-agent` still counts: the row
  exists, the derived columns are null, and the redirect still answers 302.
- **AC-8** — Running the data-migration against a database whose
  `gastronomy-premium` row already carries operator-added entitlements preserves
  them and adds the new key. Running it twice changes nothing the second time.
- **AC-9** — The new key appears in the plan comparison table for gastronomy with
  its label in es, en and pt, and in the admin plan editor's `commerce` group.
- **AC-10** — Every frozen count listed in §12 is updated and its guard is green.

## 10. Risks

- **R-1 — The menu page duplicates the listing's content.** Mitigated by the
  canonical and by staying out of the sitemap. Worth a second look if organic
  traffic to `/carta/` ever appears.
- **R-2 — Minting on read.** Addressed in §6.2 by minting only inside the gated
  endpoint, and asserted by AC-4. This is the failure that would show up as
  orphan rows on venues that never bought the feature.
- **R-3 — The panel promising more than the data holds.** The issue's own words
  are "cuándo y desde dónde", and the "desde dónde" does not exist as location.
  Addressed in §8 and NG-3/NG-4.
- **R-4 — A new enum value trips frozen guards in several packages.** Known and
  enumerated in §12 rather than discovered in CI.
- **R-5 — Following the entitlement doc.** It teaches a seed propagation that has
  not worked since HOS-39. §5 spells out why; the data-migration is the only path.

## 11. Open questions

- **OQ-1** — Time windows for the panel. Proposal: mirror `CommerceViewsWidget`'s
  windows rather than invent new ones. Needs confirming against that component.
- **OQ-2** — Does `/carta/` belong in the sitemap? Proposal: no, per §6.1.
- **OQ-3** — Download format for the QR. Proposal: PNG only here; the printable
  PDF is HOS-982's, and building a second one would be exactly how the two loose
  generators of HOS-1129 appeared.
- **OQ-4** — Does the panel belong to gastronomy only, or should the read be
  built generically for any `purpose`? Proposal: build the service method
  generic by `qrCodeId`, expose it gastronomy-only for now. **Resolved in
  implementation**: generic by `qrCodeId`, exposed for gastronomy.
- **OQ-5** — Which language does a printed table QR land on? As built, the code
  is minted with the default locale, so its target is `/es/gastronomia/{slug}/carta/`
  and a Brazilian diner scanning at the table gets the menu in Spanish — the
  multilingual menu HOS-1043 just shipped is not reached by the QR that leads to
  it. Not urgent and not irreversible: the printed code encodes `/qr/{slug}`, so
  changing the language later is an edit to one row, not a reprint. Two
  candidate answers: leave it on the default locale, or have the public redirect
  resolve the language from `Accept-Language`. The second is a change to the
  shared QR engine (HOS-981's), not to this vertical, so it does not belong in
  this spec — but the data to justify it will exist, because HOS-1141 already
  records `browser_language` on every scan. **Revisit once the panel shows a
  real language breakdown.**

## 12. Implementation notes

### Frozen counts and guards that will go red

| File | What breaks | Action |
| -- | -- | -- |
| `packages/billing/CLAUDE.md:41` | `EntitlementKey enum members \| 51` | → 52 |
| `packages/billing/test/claude-md-key-counts.guard.test.ts` | reads that table against `Object.values(EntitlementKey).length` | green once the table is updated |
| `apps/admin/src/features/billing-plans/components/plan-entitlement-groups.ts:93-130` | hardcoded `commerce` group | add the key after `MULTILINGUAL_GASTRONOMY_MENU` |
| `apps/admin/test/billing-plans/plan-entitlement-groups.test.ts:28-31` | exhaustiveness (HOS-331): ungrouped must be `[]` | covered by the line above |
| `apps/web/src/lib/__tests__/entitlement-label-coverage.test.ts:58-73` | `billing.entitlement.<key>` in es/en/pt (H-49) | add three strings |
| `packages/billing/test/entitlements.test.ts` | its own frozen `commerceCount` category total, **separate** from the CLAUDE.md guard | 12 → 13 |
| `apps/web/test/components/billing/plan-comparison-rows.test.ts` | i18n coverage for comparison rows | **does NOT cover this row.** See the correction below |

**Correction (verified during implementation, 2026-09-04).** The i18n coverage
guard builds `ALL_RENDERED_ROWS` from `[...OWNER_GROUPS, ...TOURIST_GROUPS]`
only (`plan-comparison-rows.test.ts:425`). `GASTRONOMY_GROUPS` and
`EXPERIENCE_GROUPS` are never walked, so **every commerce comparison row is
unguarded**: today `gastronomyMenu`, `multilingualMenu` and `menuItemPhotos`
have `row.<id>` and no `rowDesc.<id>` in any locale, and CI is green. A missing
translation on a commerce row reaches production silently.

This spec still adds `row.menuQrScanMetrics` **and** `rowDesc.menuQrScanMetrics` in
es/en/pt — matching the guarded rows rather than the unguarded neighbours — but
widening the guard to the commerce groups is a separate concern and is **not**
done here.

Verified **not** frozen, so no time is spent on them: the
`ALL_COMMERCE_ENTITLEMENT_KEYS` assertion at
`packages/billing/test/entitlements.test.ts:218-241` reads the uniform floor,
which this key is deliberately not part of; `config-drift-check.test.ts:53`
operates on `ALL_PLANS`, which is accommodation-only; and
`entitlements.test.ts:118-123` is self-referential.

Note that `entitlements.test.ts` is on **both** lists: one assertion in it is
blind to this key and another one breaks on it. Clearing a file by reading one
of its assertions is how the `commerceCount` red above got missed when this
section was first written.

### Plan-facing surfaces

- `plan-comparison-rows.ts` — add a `RowConfig` to `GASTRONOMY_MENU_ROWS`
  (lines 354-385): `{ id, labelKey, cell: { kind: 'entitlement', key }, status }`.
  The per-tier yes/no cell is **derived** from `plan.entitlements` (HOS-329), so
  granting the key fills the column; only the row itself is manual. Also needs an
  entry in `comparison-row-icons.ts:100-101`.
- `suscriptores/planes/comparar/index.astro` — nothing. It consumes the rows file.
- `presentacion/gastronomia/index.astro:245-258` — hand-written prose. The
  existing bullets for menu photos and the multilingual menu are the exact
  pattern to copy, "Va en el escalón Premium" included.
- `funcionalidades` — curated prose, not an entitlement enumeration. Optional.
- HOS-1032 builds `/planes/:audiencia/precios/`. If it lands after this, verify
  the row appears there.

### Do not

- Import `qrcode` anywhere. `scripts/check-qrcode-engine-isolation.sh` allows it
  in `apps/api/src/utils/qr-render.ts` and nowhere else.
- Add columns to `qr_code_scans`.
- Count scans by entity.

## 13. Linear

Canonical tracking:
HOS-1044

Parent: HOS-1071. Unblocked by HOS-981 (engine, merged) and HOS-1141 (scan
columns, merged 2026-09-04). Ordered against HOS-982. Fixes for the doc it
contradicts are tracked in HOS-1151.
