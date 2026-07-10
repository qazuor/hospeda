# TODOs: SEO/AEO on-page hardening (HOS-117)

Status: in-progress | Progress: 10/17 active tasks (Wave 0; T-013/T-018; T-014 FAQ i18n + T-020 tests; T-022 in PR #2225)

> **Replan 2026-07-09**: owner will delete all example/seed data from prod within
> 2-3 days. Wave 1 (demo-content exclusion) is obsolete — deleting the data
> deindexes demo pages via 404/410 without a throwaway gate. Cancelled T-008/009/010
> (Wave 1) + T-019 (its test) + T-011 (FAQ coverage of seed content being deleted).
> Added T-022 (serve 410 Gone) as the real-value replacement.

## Setup & Audit

- [x] T-001: Audit client:* islands for SSR↔hydration mismatch (complexity: 3)
- [x] T-002: Confirm thin-content predicate + count fields (complexity: 2)
- [ ] T-003: Capture baseline CWV measurement + page inventory (complexity: 2)

## Wave 0 — Credibility bugs (P0) ✅ shipped (PR #2217)

- [x] T-004: SSR-render stat counters' final value + isMeaningfulStat guard (complexity: 3)
- [x] T-005: SSR seasonal-average weather fallback + SSR-first principle doc (complexity: 3)
- [x] T-006: noindex + sitemap-exclude thin/empty destinations (complexity: 3)
- [x] T-007: BreadcrumbJsonLd on gastronomy/experience + CI guard 4→6 (complexity: 2)

## Post-purge cleanup (replaces Wave 1)

- [ ] T-022: Serve 410 Gone for deleted entity URLs (complexity: 2) [NEW]

## Wave 2 — Coverage & docs polish (P2)

- [ ] T-012: Programmatic landings — geo×type go/no-go + unique-prose requirement (complexity: 2)
      Note: actual prose depends on real content (post purge).
- [x] T-013: Update json-ld-audit.md to typed-component reality (complexity: 1) [blocked by T-007 ✓]
      Done 2026-07-10: rewrote to typed-component reality, all 6 entities
      (+ RestaurantJsonLd / TouristAttractionJsonLd), points to json-ld-coverage.test.ts.

## Wave 3 — Content i18n (P2) ✅ FAQ i18n support + destination SEO parity

- [x] T-014: FAQ i18n support + destination SEO parity (complexity: 3)
      Retargeted 2026-07-10 (owner): SPEC-212 already shipped name/desc i18n +
      AI translation pipeline → OQ-2 = keep-shrunk, no sub-spec. Owner chose
      4-table schema scope (accommodation/destination/experience/gastronomy).
      Additive question_i18n/answer_i18n columns (migration 0050) + BaseFaqSchema;
      resolveI18nText wired into the 4 FAQ transforms with legacy-es fallback;
      honest FAQPage inLanguage via faqSetInLanguage (accommodation+destination);
      destination detail title/meta via pickLocalizedSeo + summary/description
      i18n (name stays untranslated proper noun). Seed stays Spanish-only via
      legacy fields (mirrors accommodation description) — NO seed dual-write;
      translations authored later by AI pipeline / real content.

## Wave 4 — Rendering strategy & CWV (P2, measurement-gated)

- [ ] T-015: Classify pages prerender / SSR+edge-cache / pure-SSR (complexity: 2) [blocked by T-003]
- [ ] T-016: Verify Cloudflare edge caching; prerender static pages (complexity: 3) [blocked by T-015]
- [ ] T-017: Measurement-gated CWV fixes before/after (complexity: 2) [blocked by T-016]

## Testing

- [x] T-018: Wave 0 raw-SSR-HTML tests (complexity: 3) [blocked by T-004✓ T-005✓ T-006✓ T-007✓]
      Done 2026-07-10: gap analysis showed counters (AnimatedCounter behavioral),
      sitemap exclusion, and 6/6 breadcrumb were already covered. Filled the 2 real
      wiring gaps: StatsSection isMeaningfulStat filter + destinos noindex={isThinContent}.
- [x] T-020: Wave 3 i18n fallback tests (complexity: 2) [blocked by T-014 ✓]
      resolveI18nText/resolveI18nLocale fallback + faqSetInLanguage + toDestinationFaqs
      i18n tests (resolve-i18n-text.test.ts, faq-i18n.test.ts). Wave 2 FAQ-coverage
      assertion dropped (T-011 cancelled).

## Docs

- [ ] T-021: Docs, closeout, off-page follow-up + data-deletion/410 decision (complexity: 2) [blocked by T-018, T-020]

## Cancelled (replan 2026-07-09 — example data being deleted)

- ~~T-008: Decide demo-content exclusion mechanism~~ (cancelled)
- ~~T-009: Implement chosen exclusion mechanism~~ (cancelled)
- ~~T-010: Add granular isSeed/noIndex flag~~ (cancelled)
- ~~T-011: Raise FAQ coverage of seed accommodations~~ (cancelled)
- ~~T-019: Wave 1 demo-exclusion toggle test~~ (cancelled)

## Suggested next

**T-022** (410 Gone, no deps) pairs naturally with the imminent data purge, or
**T-003 → Wave 4** (CWV measurement) for durable value. T-014 (i18n) → decide the
sub-spec split (OQ-2) before starting.
