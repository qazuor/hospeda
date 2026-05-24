# SPEC-157 — Web SEO Polish: Task Overview

**Spec:** SPEC-157 — Web SEO Polish — Audit Backlog Remediation
**Created:** 2026-05-24
**Total tasks:** 31 | **Progress:** 7/31 (23%) | **Avg complexity:** 2.16 | **All tasks complexity <= 4**

---

## Open Decisions (MUST resolve before marked tasks)

| Decision | Blocks | Description |
|----------|--------|-------------|
| **D-1** | T-014 | JSON-LD component strategy: adopt (recommended) or delete unused components |
| **D-2** | T-029 | `theme_color` brand value: green `#10B981` (current manifest), river blue, or neutral |

D-1 should be resolved during Phase 2 work. D-2 before Phase 3 starts.

---

## Phase 1 — Critical (REQ-1, REQ-2, REQ-3)

All Phase 1 tasks are unblocked and can start immediately.

| Task | Title | Complexity | Status | Type |
|------|-------|-----------|--------|------|
| T-001 | Write failing regression test for OG image PNG output (RED) | 2 | completed | test-first |
| T-002 | Fix OG image endpoint to return PNG (1200x630) | 3 | completed | impl — blocked by T-001 |
| T-003 | Write failing regression test for sitemap Spanish prefix (RED) | 2 | completed | test-first |
| T-004 | Fix sitemap-dynamic.xml.ts: change es prefix from '' to '/es' | 2 | completed | impl — blocked by T-003 |
| T-005 | Write failing regression test for LCP SSR hero image presence (RED) | 3 | completed | test-first |
| T-006 | Add SSR LCP hero image to accommodation detail page | 4 | completed | impl — blocked by T-005 |
| T-007 | Add SSR LCP hero image to home page HeroSection | 2 | completed | impl — blocked by T-005 |

**Phase 1 parallel tracks:**
- Track A: T-001 → T-002 (OG PNG)
- Track B: T-003 → T-004 (sitemap prefix)
- Track C: T-005 → T-006 + T-007 (LCP SSR, T-006 and T-007 parallel after T-005)

---

## Phase 2 — Important (REQ-4..12)

Start after Phase 1 is verified. Most Phase 2 tasks are independent of each other.

| Task | Title | Complexity | Status | Type |
|------|-------|-----------|--------|------|
| T-008 | Add preconnect resource hints to BaseLayout.astro | 2 | pending | impl — unblocked |
| T-009 | Add WebSite JSON-LD structured data to homepage | 3 | pending | impl — unblocked |
| T-010 | Add Organization JSON-LD structured data to homepage | 2 | pending | impl — unblocked |
| T-011 | Install @astrojs/rss and create blog RSS feed endpoint | 3 | pending | impl — unblocked |
| T-012 | Create events RSS feed endpoint and add RSS discovery links | 2 | pending | impl — blocked by T-011 |
| T-013 | Fix ArticleJsonLd.astro TLD bug (hospeda.com → hospeda.com.ar) | 1 | pending | impl — unblocked |
| T-014 | Resolve D-1: Wire or delete JSON-LD components on detail pages | 4 | pending | impl — blocked by T-013 + D-1 |
| T-015 | Write failing regression test for og:image absolute URL (RED) | 2 | pending | test-first — blocked by T-004 |
| T-016 | Fix SEOHead.astro: absolute URL coercion + dimension/alt meta | 2 | pending | impl — blocked by T-015 |
| T-017 | Add eager prop to AccommodationCard.astro for above-fold images | 2 | pending | impl — unblocked |
| T-018 | Remove body opacity:0 font gate from BaseLayout.astro | 2 | pending | impl — unblocked |
| T-019 | Write failing regression test for duplicate meta description (RED) | 2 | pending | test-first — unblocked |
| T-020 | Remove duplicate meta description from BaseLayout.astro | 1 | pending | impl — blocked by T-019 |
| T-021 | Write failing regression test for sitemap hreflang alternates (RED) | 2 | pending | test-first — blocked by T-004 |
| T-022 | Add hreflang xhtml:link alternates to dynamic sitemap | 3 | pending | impl — blocked by T-021 |

**Phase 2 parallel tracks (unblocked start):**
- Track A: T-008 (resource hints)
- Track B: T-009 + T-010 (homepage JSON-LD, can run in parallel)
- Track C: T-011 → T-012 (RSS feeds)
- Track D: T-013 → T-014 (JSON-LD component strategy)
- Track E: T-017 (eager cards)
- Track F: T-018 (remove font gate)
- Track G: T-019 → T-020 (duplicate description)

**Require T-004 first (sitemap prefix fix):**
- T-015 → T-016 (og:image absolute URL)
- T-021 → T-022 (hreflang alternates)

---

## Phase 3 — Minor (REQ-13..19)

Start after Phase 2 is verified. Resolve D-1 and D-2 before starting T-014 and T-029.

| Task | Title | Complexity | Status | Type |
|------|-------|-----------|--------|------|
| T-023 | Fix heading hierarchy in RelatedCarousel.astro (h3 → h2) | 1 | pending | impl — unblocked |
| T-024 | Fix empty alt text on event card images | 1 | pending | impl — unblocked |
| T-025 | Internationalize skip-link text in SkipToContent.astro | 2 | pending | impl — unblocked |
| T-026 | Write failing regression test for robots.txt Sitemap URL env (RED) | 2 | pending | test-first — unblocked |
| T-027 | Derive robots.txt Sitemap URL from SITE_URL env var | 1 | pending | impl — blocked by T-026 |
| T-028 | Align robots.txt Disallow rules with sitemap exclusions | 3 | pending | impl — unblocked |
| T-029 | Add meta theme-color and manifest link to layouts (BLOCKED D-2) | 2 | pending | impl — blocked by D-2 |
| T-030 | Write failing regression test for locale redirect 301 (RED) | 2 | pending | test-first — unblocked |
| T-031 | Change locale redirect from 302 to 301 in middleware | 1 | pending | impl — blocked by T-030 |

**Phase 3 parallel tracks (unblocked start):**
- Track A: T-023 (heading fix)
- Track B: T-024 (event card alt)
- Track C: T-025 (skip-link i18n)
- Track D: T-026 → T-027 (robots.txt env)
- Track E: T-028 (robots.txt Disallow sync)
- Track F: T-030 → T-031 (302 → 301)

**Decision-blocked:**
- T-029 waits on D-2 resolution

---

## Critical Path

The longest sequential chain is the LCP SSR track:

```
T-005 (test RED, complexity 3)
  → T-006 (impl, complexity 4)
  → (Phase 2 work after verification)
```

Secondary critical path is the sitemap chain:
```
T-003 (test RED)
  → T-004 (sitemap prefix fix)
    → T-021 (hreflang test RED)
      → T-022 (hreflang impl)
```

---

## Test-First Tasks (RED before implementation)

These tasks MUST be run to RED before their paired implementation task begins:

| Test Task | Impl Task | REQ |
|-----------|-----------|-----|
| T-001 | T-002 | REQ-1 (OG PNG) |
| T-003 | T-004 | REQ-2 (sitemap prefix) |
| T-005 | T-006 + T-007 | REQ-3 (LCP SSR) |
| T-015 | T-016 | REQ-8 (og:image absolute URL) |
| T-019 | T-020 | REQ-11 (duplicate description) |
| T-021 | T-022 | REQ-12 (hreflang) |
| T-026 | T-027 | REQ-16 (robots.txt env) |
| T-030 | T-031 | REQ-19 (301 redirect) |

---

## Decision-Blocked Tasks

| Task | Blocked By | REQ |
|------|-----------|-----|
| T-014 | D-1 (adopt vs delete JSON-LD components) | REQ-7 |
| T-029 | D-2 (theme_color brand value) | REQ-18 |

Both can proceed to the subtask "await decision" step immediately, but code changes must wait.

---

## Suggested First Task

**Start with T-001** (write failing OG PNG test) — it is unblocked, complexity 2, and directly unblocks the Phase 1 critical fix T-002. Alternatively, start T-003 (sitemap prefix test) in parallel on a second track.

**Parallel start recommendation:**
1. T-001 (OG PNG test — Track A)
2. T-003 (sitemap prefix test — Track B)
3. T-005 (LCP SSR test — Track C)

All three are unblocked and in Phase 1.
