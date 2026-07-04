# HOS-74: CSP header missing on prerendered (SSG) routes

## Progress: 0/9 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Approach:** Option B — remove `prerender` from the 14 routes so middleware-set CSP reaches them (mirrors the home-page fix, commit `1b28a62a0`).
**Critical Path:** T-001..T-005 (parallel) -> T-008 -> T-009

---

### Core Phase — route conversions (parallel)

- [ ] **T-001** (complexity: 2) - Convert legal routes (terminos, privacidad, cookies) to SSR
  - Remove prerender + getStaticPaths, switch to `Astro.locals.locale`
  - Blocked by: none · Blocks: T-007, T-008, T-009

- [ ] **T-002** (complexity: 2) - Convert nosotros, preguntas-frecuentes, contacto to SSR
  - Blocked by: none · Blocks: T-007, T-008, T-009

- [ ] **T-003** (complexity: 2) - Convert colaborar (index, editores, reportar, fotos) to SSR
  - Blocked by: none · Blocks: T-007, T-008, T-009

- [ ] **T-004** (complexity: 2) - Convert beneficios, suscriptores/propietarios, guest/messages/verify-expired to SSR
  - Blocked by: none · Blocks: T-007, T-008, T-009

- [ ] **T-005** (complexity: 3) - Convert beta/[...slug] catch-all to SSR (runtime slug lookup)
  - ⚠ Loses build-time resilience (docs available if SSR down) — flag to owner
  - Blocked by: none · Blocks: T-007, T-008, T-009

### Integration Phase

- [ ] **T-006** (complexity: 1) - Correct the misleading CSP prerender comment in middleware.ts
  - Blocked by: none · Blocks: T-009

### Testing Phase

- [ ] **T-007** (complexity: 2) - Generalize the no-prerender test guard to all web pages
  - Blocked by: T-001..T-005 · Blocks: T-009

- [ ] **T-008** (complexity: 3) - Add over-the-wire CSP regression test (build + standalone + fetch)
  - The test class that would have caught HOS-74
  - Blocked by: T-001..T-005 · Blocks: T-009

### Docs / Verification Phase

- [ ] **T-009** (complexity: 2) - Local verification + perf/cache sign-off
  - curl 14 routes, unknown-lang 404, cache-control, status-needs-smoke-staging
  - Blocked by: T-001..T-008 · Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-004, T-005, T-006
Level 1: T-007, T-008
Level 2: T-009

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, establishes the SSR conversion pattern the other route tasks reuse.
