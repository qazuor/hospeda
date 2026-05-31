# SPEC-143 Block 1 Handoff Prompt — 2026-05-24

Paste the block below (everything between the `---` lines) into a fresh session after `/clear`.

---

Retomamos SPEC-143 Block 1 después de un checkpoint estructurado. La sesión anterior decidió pivotear de smoke-staging a smoke-local porque el deploy cycle costaba 5-10min por iteración para validaciones que no necesitan MP real.

## Contexto cargado (leé estos pins de engram PRIMERO)

```
mem_search "spec-143/checkpoint-pivot-to-local"             # state actual + decisiones + open questions
mem_search "spec-143/smoke-block-1-1.15-A.1-fixes-shipped"  # findings #8/9/10/11 fixed
mem_search "billing/entitlement-enforcement-gap-hypothesis" # downgraded por audit (Finding #7 resolved)
mem_search "workflow/post-merge-new-branch-mandatory"       # regla mandatoria post-merge
```

Y leé estos docs (son la fuente de verdad):
```
.qtm/specs/SPEC-143-billing-testing-coverage/docs/local-test-users-seed-plan.md  # ← PRIMER PASO: implementar esto
.qtm/specs/SPEC-143-billing-testing-coverage/docs/smoke-execution-plan.md        # findings tracker + Block plan
.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md     # checklist con run-logs ya filleadas para 1.15-A.1
```

## Estado del SPEC-143 Block 1

**5 PRs merged a staging hoy** (en orden):
- #1236 — Finding #21 polling docs + Findings #8/#9/#10/#11 fixes (envelope LIMIT_REACHED + schema description + host-onboarding limit + X-Usage-Warning doc).
- #1239 — Finding #15 fix (enforcePhotoLimit en `POST /api/v1/admin/media/upload`) + audit matrix de 21 middlewares cerrando Finding #7.
- #1240 — Finding #14 fix (admin accommodation update/patch → service-layer perm check).
- #1241 — Bundle: Finding #14 extension (5 routes más: addFaq/removeFaq/updateFaq/delete/restore) + Finding #13 (UI gallery pre-gate dropped) + Finding #12 (sidebar `/mi-cuenta` nav).

**Section 1.15-A.1 status**: PASS w/ caveats — todos los findings encontrados están fixed y validados en staging.

**2 BUGS NUEVOS reportados por el user post-deploy de #1241, NO diagnosticados todavía**:
1. **Banner "Límite alcanzado" sigue saliendo** en el admin gallery aunque #1241 sacó el `limitKey` config. Hipótesis A: stale admin bundle (build no agarró el cambio). Hipótesis B: otro componente/path renderiza el banner. Diagnóstico local resuelve esto en 5 min.
2. **Foto subida no persiste**: el upload va OK (file llega a Cloudinary), pero al guardar el form y recargar, la foto desapareció. Hipótesis: admin form PUT payload no incluye el campo `media`, o el upload guarda en Cloudinary pero no actualiza `accommodation.media` JSONB. Necesita inspección de DevTools Network o reproducción local.

## Tu primera tarea: implementar el test users seed

Per `local-test-users-seed-plan.md`:

1. **Investigá las open questions** (la sección "Open questions for the next session" del design doc). Específicamente:
   - Mejor camino para signup programático con Better Auth (importar `auth.api.signUpEmail` desde donde se exporta — buscá `betterAuth(...)` en apps/api/src/lib/auth.ts).
   - API exacta de qzpay-drizzle para crear billing_customer + billing_subscription con `status='active'` (puede requerir state machine, no creación directa).
2. **Implementá** `packages/seed/src/optional/testUsers.seed.ts` con los 13 users del matrix (4 staff + 3 tourist tiers + 3 host tiers + 3 complex tiers). Pseudo-código en el design doc.
3. **Wire en CLI**: `pnpm --filter @repo/seed seed:test-users`. Opcional: alias raíz `pnpm db:seed:test-users`.
4. **Actualizá** `packages/seed/CLAUDE.md` + root `CLAUDE.md` (nueva sección "Local testing for billing") + `staging-smoke-checklist.md` (marcar qué sections van local vs staging).
5. **Validá local**: `pnpm db:fresh-dev` + `pnpm db:seed:test-users` + `pnpm dev` + signin como `host-basico@local.test`/`Password123!` + replay smoke 1.15-A.1 → debería pasar limpio.

## Después del seed, retomá el smoke desde local

Orden sugerido:

1. **Diagnosticar los 2 bugs nuevos** (banner persiste + foto no persiste) reproduciéndolos local con `host-basico@local.test`. Probablemente ~30 min cada uno.
2. **Validar 1.15-A.2** (MAX_PHOTOS=5): subir 5 fotos OK, 6ta → 403 LIMIT_REACHED. Local.
3. **Validar 1.15-A.3** (MAX_ACTIVE_PROMOTIONS=0): POST a `/api/v1/protected/owner-promotions` → 403. Local.
4. **1.15-B/C/E** (positivo / negativo / cache): C es mayormente "stubs sin endpoint" según el audit del Finding #7; tocar lo que SÍ tiene endpoint, documentar el resto. Local.
5. **Block 2 (new monthly user)**: usá `host-basico@local.test` directamente (ya es monthly). O agregá un user 2do en el seed si necesitás monthly específico vs annual.
6. **Block 3 (HOST trial)**: trial lifecycle requiere setup de subscription en `trialing` status — extender el seed o testear via servicio directo.
7. **Block 4 (webhooks)**: VOLVER A STAGING. Esto sí requiere MP real.
8. **Block 5 (admin/advanced)**: mix; algunos local-ables, otros requieren admin tooling.

## Restricciones operacionales (no romper)

- **Post-merge orphan trap**: después de que el user mergea un PR, ANTES de hacer commit siguiente, SIEMPRE `git fetch origin staging && git checkout -b <new-branch> origin/staging`. Caí 3 veces en esta sesión antes de internalizar. Engram `workflow/post-merge-new-branch-mandatory`.
- Branches con PR cerrado son tóxicos — `gh pr list --head <branch> --state all --json state,mergedAt` antes de push.
- Commits atómicos por finding, conventional commits, NO co-author de AI.
- Biome lint clean obligatorio antes de commit. Subject del commit no puede empezar con palabra capitalizada (commitlint rule).
- `pnpm lint`/`biome` strict — biome-ignore comments con `as any` cuando el any no aparece = error CI (caí 1 vez).
- Para deploy a staging el user es quien deployea via Coolify; CI del repo está broken en free plan (jobs fallan en <1s, no es tu código).
- Schema compat policy: adicional siempre OK, tightening en write side requiere migration path. Read side puede relajarse libremente.

## Restricciones de scope

- NO refactorices más middlewares del audit ya cerrado en PR #1239. 15 son stubs esperando features futuras — no las wires todavía.
- NO toques tourist-entitlements.ts ni accommodation-entitlements.ts (mismo antipattern HTTPException, pero scope explícitamente diferido).
- Si encontrás un finding nuevo gordo durante el smoke, BUNDLEÁLO con los próximos para evitar el deploy treadmill.

## Test user actual de staging (NO usar local)

`qazuor+billtest-annual2@gmail.com` / draft accommodation `a404c854-15e7-4dcd-a477-c084646befa6` / owner-basico annual active. Este queda en staging; los 13 nuevos del seed son LOCAL only.

## PRs abiertos / cerrados al checkpoint

Todos cerrados. La branch `fix/SPEC-143-block-1-bundle` del PR #1241 está mergeada a staging. La worktree actual está limpia.

---

Arrancá leyendo los engram pins + el design doc del seed, después contame qué encontrás de las open questions antes de empezar a codear.
