# HOS-33: Vite 7 Migration for TanStack Start

## Progress: 0/13 tasks (0%)

**Average Complexity:** 1.8/3
**Critical Path:** T-001 -> T-005 -> T-006 -> T-009/T-010 -> T-011 -> T-012 -> T-013 (7 steps)
**Parallel Tracks:** T-002, T-003, T-004, T-005, T-007 (all blocked only by T-001, run in any order)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Bump TanStack Start/Router family and Vite in apps/admin
  - vite ^7.0.0, react-start 1.168.27, react-router 1.170.17, router-plugin 1.168.19, ssr-query 1.167.1, devtools 1.167.0; remove @vitejs/plugin-react
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005, T-007

### Core Phase

- [ ] **T-002** (complexity: 1) - Remove @vitejs/plugin-react from vite.config.ts
  - Blocked by: T-001
  - Blocks: T-008

- [ ] **T-003** (complexity: 2) - Rewrite server.ts to the new non-curried createStartHandler API
  - Blocked by: T-001
  - Blocks: T-008

- [ ] **T-004** (complexity: 1) - Rename getWebRequest() to getRequest() in auth-session.ts
  - Blocked by: T-001
  - Blocks: T-008

- [ ] **T-005** (complexity: 2) - Replace registerGlobalMiddleware with createStart() in start.ts
  - Blocked by: T-001
  - Blocks: T-006, T-008

- [ ] **T-007** (complexity: 1) - Verify middleware.ts compatibility with the new TanStack Start version
  - Blocked by: T-001
  - Blocks: T-008

### Integration Phase

- [ ] **T-006** (complexity: 3) - Wire CSP nonce pipeline in router.tsx
  - getCspNonce via createIsomorphicFn, ssr.nonce, HeadContent meta tag
  - Blocked by: T-005
  - Blocks: T-009, T-010

### Testing Phase

- [ ] **T-008** (complexity: 2) - Verify dev server, build, typecheck, lint after core rewrite
  - Blocked by: T-002, T-003, T-004, T-005, T-007
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Validate third-party Vite 7 compatibility
  - better-auth workaround, vite-tsconfig-paths, tailwind vite, manualChunks
  - Blocked by: T-006, T-008
  - Blocks: T-011

- [ ] **T-010** (complexity: 3) - Verify CSP header coverage on SSR initial page loads and nonce hydration
  - Blocked by: T-006
  - Blocks: T-011

- [ ] **T-011** (complexity: 2) - Re-validate /healthz behavior on the upgraded TanStack Start version
  - Blocked by: T-009, T-010
  - Blocks: T-012

### Cleanup Phase

- [ ] **T-012** (complexity: 1) - Lift the @tanstack/react-router Dependabot ignore
  - Blocked by: T-011
  - Blocks: T-013

### Docs Phase

- [ ] **T-013** (complexity: 1) - Update apps/admin/CLAUDE.md /healthz documentation
  - Blocked by: T-012
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002, T-003, T-004, T-005, T-007
Level 2: T-006, T-008
Level 3: T-009, T-010
Level 4: T-011
Level 5: T-012
Level 6: T-013

## Suggested Start

Begin with **T-001** (complexity: 2) - no dependencies, unblocks 5 other tasks.
