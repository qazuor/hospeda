# SPEC-241: Host trades/services directory (24h emergency trades for hosts)

## Progress: 0/19 tasks (0%)

**Average Complexity:** 1.6/3 (max)
**Critical Path:** T-001 → T-003 → T-006 → T-007 → T-008 → T-010 → T-012 → T-014 → T-015 → T-016 (10 steps)
**Parallel Tracks:** setup track (enums/perms/i18n) runs in parallel; admin UI (T-017/T-018) parallel to web UI (T-014/T-015)

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Add HostTradeCategoryEnum to @repo/schemas enums
  - 13-value category enum (TS + Zod) + re-export + test
  - Blocked by: none
  - Blocks: T-003, T-005

- [ ] **T-002** (complexity: 1) - Add HOST_TRADE_* values to PermissionEnum + PermissionCategoryEnum
  - 7 permission values + HOST_TRADE category; PermissionPgEnum auto-picks them up
  - Blocked by: none
  - Blocks: T-010, T-011, T-012

- [ ] **T-003** (complexity: 2) - Create entities/host-trade schema files + tests
  - schema / crud / query / admin-search / http (public+admin) + index
  - Blocked by: T-001
  - Blocks: T-006, T-010

- [ ] **T-004** (complexity: 1) - Create i18n locale files host-trades.json (es/en/pt)
  - All spec keys incl. categories.*; locale parity
  - Blocked by: none
  - Blocks: T-014, T-015

### Core Phase

- [ ] **T-005** (complexity: 1) - Add HostTradeCategoryPgEnum to enums.dbschema.ts
  - pgEnum + enumToTuple
  - Blocked by: T-001
  - Blocks: T-006

- [ ] **T-006** (complexity: 2) - Create host_trade.dbschema.ts table + relations
  - hostTrades table, FKs, unique slug, relations to destinations/users
  - Blocked by: T-005, T-003
  - Blocks: T-007, T-008

- [ ] **T-007** (complexity: 1) - Generate and verify migration
  - pnpm db:generate, review SQL, verify db:migrate
  - Blocked by: T-006
  - Blocks: T-008, T-009

- [ ] **T-008** (complexity: 2) - Create HostTradeModel with findForHost + integration tests
  - BaseModel + findForHost(destinationIds) ordered query
  - Blocked by: T-006, T-007
  - Blocks: T-009, T-010

- [ ] **T-009** (complexity: 2) - Add example seed data for host_trades
  - data JSON + manifest + loader wired after destinations/users; db:fresh-dev verify
  - Blocked by: T-007, T-008
  - Blocks: none

- [ ] **T-010** (complexity: 3) - Create HostTradeService (BaseCrudService) + listForHost + slug dedup + tests
  - Admin CRUD + host listForHost + UNIQUE-slug de-duplication (-2/-3) + unit tests
  - Blocked by: T-002, T-003, T-008
  - Blocks: T-011, T-012

### Integration Phase

- [ ] **T-011** (complexity: 2) - Create admin API routes for host-trades
  - 8 routes via createAdminRoute factories + registration + guards tests
  - Blocked by: T-002, T-010
  - Blocks: T-013, T-017, T-018

- [ ] **T-012** (complexity: 2) - Create protected host route GET /protected/host-trades + tests
  - Server-side destination resolution; 200/empty/401/403 tests
  - Blocked by: T-002, T-010
  - Blocks: T-013, T-014

- [ ] **T-014** (complexity: 2) - Create Astro page directorio-proveedores (SSR + empty states)
  - Auth check, fetch, empty/denied states
  - Blocked by: T-004, T-012
  - Blocks: T-015

- [ ] **T-015** (complexity: 2) - Create TradesDirectory React island + TradeCard (CSS Modules)
  - Category pills + card grid; design tokens, no Tailwind
  - Blocked by: T-004, T-014
  - Blocks: T-016

- [ ] **T-017** (complexity: 2) - Create admin list page for host-trades
  - TanStack Query table + filters; nav under Plataforma > Directorio de oficios
  - Blocked by: T-011
  - Blocks: T-019

- [ ] **T-018** (complexity: 2) - Create admin create/edit form for host-trades
  - TanStack Form + safeParse; slug auto-from-name editable
  - Blocked by: T-011
  - Blocks: T-019

### Testing Phase

- [ ] **T-016** (complexity: 1) - Component tests for TradesDirectory + TradeCard
  - Filter/reset/empty + field-render/conditional tests
  - Blocked by: T-015
  - Blocks: none

- [ ] **T-019** (complexity: 1) - Write admin entity tests
  - List query mocks + form submit/validation tests
  - Blocked by: T-017, T-018
  - Blocks: none

### Docs Phase

- [ ] **T-013** (complexity: 1) - Add endpoint-gate-matrix rows for host-trade routes
  - 'none' gate for protected list; HOST_TRADE_* for admin routes
  - Blocked by: T-011, T-012
  - Blocks: none

---

## Dependency Graph (levels)

```
Level 0: T-001, T-002, T-004
Level 1: T-003, T-005
Level 2: T-006
Level 3: T-007
Level 4: T-008
Level 5: T-009, T-010
Level 6: T-011, T-012
Level 7: T-013, T-014, T-017, T-018
Level 8: T-015, T-019
Level 9: T-016
```

## Suggested Start

Begin with **T-001** (complexity: 1) — no dependencies, unblocks T-003 and T-005.
T-002 and T-004 are also dependency-free and can run in parallel.
