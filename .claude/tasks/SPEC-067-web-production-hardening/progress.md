# SPEC-067: Web App Production Hardening - Progress

## Status: pending

**Total tasks**: 35
**Completed**: 0
**In progress**: 0
**Pending**: 35

---

## Phase Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| core | 22 | 0/22 complete |
| integration | 5 | 0/5 complete |
| cleanup | 5 | 0/5 complete |
| testing | 5 | 0/5 complete |

---

## Critical Path

The longest sequential dependency chain. Start here first.

```
TASK-067-001 (404/500 pages)
  → TASK-067-003 (logo image fix)
    → TASK-067-004 (all local images via <Image>)
      → TASK-067-005 (hero image getImage())
        → TASK-067-006 (image fallback script)
          → TASK-067-007 (AccommodationCard + client:load)
            → TASK-067-008 (nonce-based CSP)
              → TASK-067-009 (JSON-LD escaping)
                → TASK-067-010 (img-src + connect-src hardening)
                  → TASK-067-038 (lib/ unit tests)
                    → TASK-067-039 (API layer tests)
                      → TASK-067-040 (middleware-helpers tests)
                        → TASK-067-041 (auth component tests)
                          → TASK-067-042 (page tests)
```

---

## Parallel Tracks

Tasks within the same track can start immediately without waiting for the critical path.

| Track | Can start now | Label |
|-------|--------------|-------|
| A | TASK-067-001 | Critical path (sequential) |
| B | TASK-067-011, TASK-067-012 | SEO config (independent) |
| C | TASK-067-002 then TASK-067-013 | SEO + OG images |
| D | TASK-067-015, TASK-067-017 | Title fix + Vercel redirect (independent) |
| E | TASK-067-024, TASK-067-025, TASK-067-026, TASK-067-027, TASK-067-028 | Performance (all independent) |
| F | TASK-067-029 then TASK-067-030-032-033-034 | Code quality chain |
| G | TASK-067-019 chain | i18n completeness |

---

## Task List

### Phase: core

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|------------|------------|
| TASK-067-001 | Create 404 and 500 error pages | pending | 3 | - |
| TASK-067-002 | Fix canonical URL generation | pending | 2 | TASK-067-001 |
| TASK-067-003 | Fix logo image paths in Header and Footer | pending | 2 | TASK-067-001 |
| TASK-067-004 | Use Astro Image for all local images | pending | 3 | TASK-067-003 |
| TASK-067-005 | Fix hero image optimization via getImage() | pending | 2 | TASK-067-004 |
| TASK-067-006 | Create generic image fallback script | pending | 2 | TASK-067-005 |
| TASK-067-008 | Implement nonce-based CSP in middleware and BaseLayout | pending | 4 | TASK-067-007 |
| TASK-067-009 | Fix JSON-LD script injection vulnerability | pending | 2 | TASK-067-008 |
| TASK-067-010 | Restrict CSP img-src and validate connect-src env var | pending | 2 | TASK-067-009 |
| TASK-067-011 | Create robots.txt | pending | 1 | - |
| TASK-067-012 | Fix site.webmanifest and footer newsletter input type | pending | 2 | - |
| TASK-067-013 | Create dynamic OG image generation endpoint | pending | 3 | TASK-067-002 |
| TASK-067-015 | Fix duplicate title appending | pending | 1 | - |
| TASK-067-017 | Add root redirect to vercel.json | pending | 1 | - |
| TASK-067-019 | Translate Header navigation labels and sign-in page labels | pending | 2 | TASK-067-001 |
| TASK-067-020 | Translate post category labels and all hardcoded aria-labels | pending | 3 | TASK-067-019 |
| TASK-067-021 | Create language switcher component | pending | 2 | TASK-067-020 |
| TASK-067-023 | Remove deprecated t() overload and fix coverage exclusion patterns | pending | 2 | TASK-067-019 |
| TASK-067-024 | Lazy-load GLightbox CSS and optimize Google Fonts | pending | 2 | - |
| TASK-067-025 | Configure Astro prefetch | pending | 1 | - |
| TASK-067-026 | Fix IntersectionObserver memory leak in scroll reveal | pending | 2 | - |
| TASK-067-027 | Fix Header scroll listener accumulation | pending | 1 | - |
| TASK-067-034 | Add React Error Boundary | pending | 2 | - |

### Phase: integration

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|------------|------------|
| TASK-067-007 | Integrate image fallback into AccommodationCard and change HeroImageRotator to client:load | pending | 1 | TASK-067-006 |
| TASK-067-014 | Integrate OG image endpoint with SEOHead | pending | 2 | TASK-067-013 |
| TASK-067-016 | Add BreadcrumbList JSON-LD to detail pages | pending | 2 | TASK-067-002 |
| TASK-067-018 | SEO meta tag audit and verification | pending | 1 | TASK-067-015 |
| TASK-067-022 | Integrate language switcher into Header | pending | 1 | TASK-067-021 |
| TASK-067-028 | Add View Transition morph animations | pending | 2 | - |

### Phase: cleanup

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|------------|------------|
| TASK-067-029 | Deduplicate type definitions | pending | 3 | - |
| TASK-067-030 | Split data/types.ts (588 lines) | pending | 3 | TASK-067-029 |
| TASK-067-031 | Split AccommodationCard.astro (653 lines) | pending | 3 | TASK-067-030 |
| TASK-067-032 | Split mi-cuenta/index.astro (672 lines) | pending | 3 | TASK-067-030 |
| TASK-067-033 | Remove dead mock data files and fix utility bugs | pending | 2 | TASK-067-031, TASK-067-032 |

### Phase: testing

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|------------|------------|
| TASK-067-038 | Write tests for src/lib/ utilities | pending | 4 | TASK-067-010, TASK-067-023, TASK-067-033 |
| TASK-067-039 | Write tests for API layer | pending | 3 | TASK-067-038 |
| TASK-067-040 | Write tests for middleware-helpers | pending | 2 | TASK-067-008, TASK-067-039 |
| TASK-067-041 | Write tests for auth components | pending | 3 | TASK-067-022, TASK-067-034, TASK-067-040 |
| TASK-067-042 | Write tests for 404/500 pages and mi-cuenta | pending | 2 | TASK-067-041 |

---

## Spec Requirements Coverage

| Requirement | Task(s) |
|-------------|---------|
| REQ-067-01 (404/500 pages) | TASK-067-001 |
| REQ-067-02 (canonical URLs) | TASK-067-002 |
| REQ-067-03 (logo image paths) | TASK-067-003 |
| REQ-067-04 (Astro Image for all local) | TASK-067-004 |
| REQ-067-05 (hero image getImage) | TASK-067-005 |
| REQ-067-06 (image fallback system) | TASK-067-006, TASK-067-007 |
| REQ-067-07 (HeroImageRotator client:load) | TASK-067-007 |
| REQ-067-08 (nonce-based CSP) | TASK-067-008 |
| REQ-067-09 (JSON-LD escaping) | TASK-067-009 |
| REQ-067-10 (CSP img-src restriction) | TASK-067-010 |
| REQ-067-11 (CSP connect-src validation) | TASK-067-010 |
| REQ-067-12 (robots.txt) | TASK-067-011 |
| REQ-067-13 (web manifest) | TASK-067-012 |
| REQ-067-14 (dynamic OG images) | TASK-067-013, TASK-067-014 |
| REQ-067-15 (duplicate title fix) | TASK-067-015 |
| REQ-067-16 (BreadcrumbList JSON-LD) | TASK-067-016 |
| REQ-067-17 (newsletter input type) | TASK-067-012 |
| REQ-067-18 (Header nav labels) | TASK-067-019 |
| REQ-067-19 (signin page labels) | TASK-067-019 |
| REQ-067-20 (post category labels) | TASK-067-020 |
| REQ-067-21 (hardcoded aria-labels) | TASK-067-020 |
| REQ-067-22 (language switcher) | TASK-067-021, TASK-067-022 |
| REQ-067-23 (lazy GLightbox CSS) | TASK-067-024 |
| REQ-067-24 (Google Fonts loading) | TASK-067-024 |
| REQ-067-25 (Astro prefetch) | TASK-067-025 |
| REQ-067-26 (IntersectionObserver leak) | TASK-067-026 |
| REQ-067-27 (Header scroll listener) | TASK-067-027 |
| REQ-067-28 (View Transition morphs) | TASK-067-028 |
| REQ-067-29 (type deduplication) | TASK-067-029 |
| REQ-067-30 (split oversized files) | TASK-067-030, TASK-067-031, TASK-067-032 |
| REQ-067-31 (remove dead mock data) | TASK-067-033 |
| REQ-067-32 (React Error Boundary) | TASK-067-034 |
| REQ-067-33 (isLoggingEnabled fix) | TASK-067-033 |
| REQ-067-34 (loadStats silent failure) | TASK-067-033 |
| REQ-067-35 (deprecated t() overload) | TASK-067-023 |
| REQ-067-36 (coverage exclusion patterns) | TASK-067-023 |
| REQ-067-37 (Vercel root redirect) | TASK-067-017 |
| REQ-067-38 (test lib/ utilities) | TASK-067-038 |
| REQ-067-39 (test API layer) | TASK-067-039 |
| REQ-067-40 (test middleware) | TASK-067-040 |
| REQ-067-41 (test auth components) | TASK-067-041 |
| REQ-067-42 (test pages) | TASK-067-042 |

---

## Notes

- IDs jump from TASK-067-034 to TASK-067-038 intentionally. IDs 035-037 were merged into adjacent tasks to stay within the 15-task-per-phase limit and avoid artificial task fragmentation.
- TASK-067-018 is a low-complexity SEO audit sweep to catch anything missed in TASK-067-011 through TASK-067-017.
- The spec lists 42 requirements but 35 tasks because several requirements were batched into single atomic tasks (e.g., REQ-067-33/34 into TASK-067-033; REQ-067-23/24 into TASK-067-024; REQ-067-18/19 into TASK-067-019).
