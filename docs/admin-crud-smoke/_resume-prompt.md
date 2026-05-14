# Resume prompt — SPEC-117 (paste in next session)

```text
Estoy retomando SPEC-117 (Admin Pages Stabilization) post-context-reset.

Contexto + estado completo en estos 3 lugares (leelos en este orden):

1. `memory/project_spec_117_in_flight.md` (memoria condensada, la fuente
   más práctica para arrancar)
2. `.claude/specs/SPEC-117-admin-pages-stabilization/spec.md` Part 5
   ("Implementation progress (in-flight)") — tabla de tasks completadas,
   discoveries §1-§8, verification status, "Branch state" con los 10
   commits y el shift arquitectónico de API-en-worktree
3. Engram topic `spec/SPEC-117/checkpoint-2026-05-14` — recap de
   decisiones técnicas + lecciones aprendidas

Estado en una línea:
- Worktree `../hospeda-admin-pages-audit` branch `fix/admin-pages-audit`,
  **clean**, 10 commits atómicos
- Phase 0 / Phase 1 / Phase 2 ✅; Phase 4 i18n: T-012 ✅, T-013 ✅;
  **T-014 / T-015 / T-016 pendientes**

Setup operativo (CAMBIÓ a media sesión — leer con atención):

- API local en :3001 ahora corre desde el WORKTREE
  (`~/projects/WEBS/hospeda-admin-pages-audit/apps/api`), no más desde
  main repo. Workflow simplificado: editar en worktree, no hay mirror.
- Admin local en :3000 corre desde el worktree (lifecycle a tu cargo).
- DB postgres `localhost:5436` (`hospeda_user/hospeda_pass/hospeda_dev`).
- Super-admin: `superadmin@hospeda.com` / `Audit2026!` (Better Auth puede
  forzar change-password — ver memoria para el SQL de reset).
- Para editar `@repo/schemas` o `@repo/service-core`:
  `pnpm turbo run build --filter='@repo/schemas' --filter='@repo/service-core'`
  desde el worktree; Hono dev auto-recarga, no hace falta pedir restart.
- Para editar `packages/i18n/src/locales/*/*.json`: **clear Vite cache
  y reiniciar admin** — `rm -rf apps/admin/node_modules/.vite/deps && pnpm dev`.
  Vite cachea `@repo/i18n` agresivamente.

Lo primero que hay que hacer (próximas 3 tasks de Phase 4):

A. **T-014 (I-5)** — sweep `apps/admin/src/features/<entity>/config/<entity>.columns.ts`
   files para reemplazar headers hardcoded en inglés ("Destination",
   "Owner", "Attractions", etc.) por `t(...)` calls contra
   `admin-entities` o `admin-tables`. Verificar visualmente en
   `/accommodations` y `/destinations` (las 2 surfaces confirmadas).

B. **T-015 (I-3)** — mover role names + descriptions de seed data a
   i18n. Seed produce solo el enum value (`SUPER_ADMIN`); el admin UI
   en `/access/roles` resuelve labels + descriptions vía
   `admin-entities.roles.<KEY>.name|description|capabilities[]`.
   Más grande que T-014 (toca seed + i18n + page).

C. **T-016 (I-4)** — agregar `admin-entities.permissions.categories.<key>`
   y resolver en `/access/permissions` page.

Después de Phase 4: Phase 3 (M-2 retry policy), Phase 5 (B-* billing
503/429 + N-1/N-2 newsletter + M-1 plan-limit + A2 dev workflow),
Phase 6 (D-* CRUD smoke continuations), Phase 7 (V-CRIT visuals), 8, 9.

Reglas de estilo:
- Hablo en rioplatense, vos también.
- No commits hasta que yo diga "ok / commiteamos / dale".
- Antes de tirar fix de schema/route, hacer build del package afectado
  y verificar en el browser via chrome-devtools MCP.

Findings nuevos descubiertos en la sesión anterior (NO en el §4
original del spec) que debés tener presente:
- **I-6**: 11/12 `<entity>-consolidated.config.ts` hardcodean Spanish.
  Solo `accommodation` fue fixeado. Los otros 11 son una sweep
  follow-up (puede ir bundleado con T-014 si querés cerrar el
  capítulo i18n entero).
- Main repo `~/projects/WEBS/hospeda` tiene 17 stale mirror files
  (sobras de cuando la API corría desde ahí). `git restore <files>`
  es seguro — no hay nada único, todo está committeado en el worktree.

Arrancá leyendo los 3 lugares de contexto + status del worktree
(`git -C ~/projects/WEBS/hospeda-admin-pages-audit status` debería
salir vacío). Después dame un resumen breve para confirmar
alineación antes de empezar T-014.
```
