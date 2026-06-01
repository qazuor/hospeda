# SPEC-046: CSP Post-Deployment Verification

## Progress: 0/15 tasks (0%)

**Average Complexity:** 2.5/4 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-005 → T-014 (5 steps)
**Parallel Tracks:** 5 identified (integration build, CSS refactor, frame-src, CF disable, authenticated crawl)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) — Scaffold csp-nonce-injector Astro integration package
  - Path: `apps/web/integrations/csp-nonce-injector/`. Files: `index.ts` (skeleton) + `README.md`. No logic, just shell.
  - Blocked by: none
  - Blocks: T-002, T-003

- [ ] **T-006** (complexity: 2) — Catalogue inline `style=` patterns
  - Inventory of files using `transition-delay`, `--corner-bg`, `--brand-accent`, `--wave-header-padding-top`, `width:0%; opacity:0`. Output: `inventory-09a.md`.
  - Blocked by: none
  - Blocks: T-007, T-008, T-009

### Core Phase

- [ ] **T-002** (complexity: 4) — Implement HTML walker that stamps nonce on unguarded tags
  - Streaming parser (parse5/htmlparser2). Skip existing nonces and `<noscript>` content.
  - Blocked by: T-001
  - Blocks: T-003, T-004

- [ ] **T-007** (complexity: 3) — Refactor stagger pattern to `data-stagger-index` + CSS
  - Replace `style={transition-delay}` across `.astro` pages with `data-stagger-index` + CSS rules for 0-6.
  - Blocked by: T-006
  - Blocks: T-014

- [ ] **T-008** (complexity: 4) — Refactor CSS-var inline patterns to data-attrs + CSS map
  - `--corner-bg`, `--brand-accent`, `--wave-header-padding-top`. Create `css-var-themes.css`.
  - Blocked by: T-006
  - Blocks: T-014

- [ ] **T-009** (complexity: 2) — Refactor reveal-animation start state to CSS class
  - `width:0%; opacity:0` → `.is-reveal-initial`.
  - Blocked by: T-006
  - Blocks: T-014

- [ ] **T-010** (complexity: 1) — Add `frame-src 'none'` to `buildCspHeader()`
  - GAP-046-12.
  - Blocked by: none
  - Blocks: T-011

### Integration Phase

- [ ] **T-003** (complexity: 3) — Wire integration into `astro.config.mjs` + thread `cspNonce` from middleware
  - Register hook, read `context.locals.cspNonce`, call `injectNonce()`.
  - Blocked by: T-001, T-002
  - Blocks: T-005, T-014

### Testing Phase

- [ ] **T-004** (complexity: 3) — Unit tests for `injectNonce` walker
  - 10 cases (script, style, existing nonce, `<noscript>`, malformed, etc.).
  - Blocked by: T-002
  - Blocks: T-014

- [ ] **T-005** (complexity: 3) — Integration smoke test on built HTML
  - `pnpm build` + `pnpm preview` (or `dist/` inspection). Assert nonce on every emitted tag.
  - Blocked by: T-003
  - Blocks: T-014

- [ ] **T-011** (complexity: 1) — Test asserting CSP header includes `frame-src 'none'`
  - Blocked by: T-010
  - Blocks: T-014

- [ ] **T-014** (complexity: 3) — Re-crawl staging post-deploy and verify all GAPs closed
  - Persist Logs, home → listing → detail → auth → signup. Assert 6 outcomes (a-f).
  - Blocked by: T-003, T-004, T-005, T-007, T-008, T-009, T-011, T-013
  - Blocks: none

- [ ] **T-015** (complexity: 3) — Crawl authenticated `/mi-cuenta/*` + billing (optional)
  - Requires staging test account. Closes §1C.8 coverage gap.
  - Blocked by: none (hard block: staging test account provision)
  - Blocks: none

### Docs Phase

- [ ] **T-012** (complexity: 2) — Coordinate CF Web Analytics disable with SPEC-140 (Umami)
  - Write `cf-analytics-disable-plan.md`. Get SPEC-140 owner go-ahead.
  - Blocked by: none
  - Blocks: T-013

### Cleanup Phase

- [ ] **T-013** (complexity: 1) — Disable Cloudflare Web Analytics in CF dashboard (manual ops)
  - Both `hospeda.com.ar` and `staging.hospeda.com.ar`. Verify beacon stops appearing.
  - Blocked by: T-012
  - Blocks: T-014

---

## Dependency Graph

```
Level 0 (parallel start): T-001, T-006, T-010, T-012, T-015
Level 1:                  T-002 (←T-001)
                          T-007, T-008, T-009 (←T-006)
                          T-011 (←T-010)
                          T-013 (←T-012)
Level 2:                  T-003 (←T-001, T-002)
                          T-004 (←T-002)
Level 3:                  T-005 (←T-003)
Level 4:                  T-014 (←T-003, T-004, T-005, T-007, T-008, T-009, T-011, T-013)
```

## Phase Distribution

| Phase | Count | Avg complexity |
|---|---:|---:|
| setup | 2 | 2.0 |
| core | 5 | 2.8 |
| integration | 1 | 3.0 |
| testing | 5 | 2.6 |
| docs | 1 | 2.0 |
| cleanup | 1 | 1.0 |

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the longest path (integration build → wire → smoke test → verify).

In parallel, you can ALSO start:

- **T-006** (complexity: 2) — discovery for the 09a refactor, unblocks 3 CSS tasks
- **T-010** (complexity: 1) — `frame-src 'none'` one-liner, smallest win
- **T-012** (complexity: 2) — SPEC-140 coordination, blocks T-013

These four (T-001, T-006, T-010, T-012) cover four independent tracks and can be done concurrently.

T-015 is independent and can start whenever a staging test account exists; if no account is feasible, document the decision and accept residual coverage risk.

## Complexity Guarantee

All 15 tasks have complexity ≤ 4 ✓
No tasks require further splitting ✓
