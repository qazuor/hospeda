# Resume prompt — SPEC-117 (paste in next session)

```
Estoy retomando SPEC-117 (Admin Pages Stabilization) post-context-reset.

Contexto + estado completo en estos 3 lugares (leelos en este orden):

1. `memory/project_spec_117_in_flight.md` (memoria condensada)
2. `.claude/specs/SPEC-117-admin-pages-stabilization/spec.md` Part 5 ("Implementation
   progress (in-flight)") — la sección al final tiene la tabla de tasks completadas,
   files modificados, qué está verificado y qué falta.
3. `docs/admin-crud-smoke/_a1-diagnosis.md` — diagnóstico ejemplar del patrón A-1
   que se replicó en T-002, T-003, T-010.

Ambiente:
- Worktree: `../hospeda-admin-pages-audit` branch `fix/admin-pages-audit`.
- API local en :3001 corre desde main repo `/home/qazuor/projects/WEBS/hospeda/apps/api`.
- Admin local en :3000 corre desde el worktree (yo te pido que lo levantes vos).
- DB postgres `localhost:5436` (`hospeda_user/hospeda_pass/hospeda_dev`).
- Super-admin: `superadmin@hospeda.com` / `Audit2026!` (puede que necesite reset; ver memoria).

Workflow para cualquier fix de schema o service-core:
1. Edit file in WORKTREE
2. Edit MIRROR in main repo (porque API corre desde ahí)
3. `pnpm turbo run build --filter='@repo/{schemas,service-core}'` en main repo
4. Pedirme reiniciar el API en mi terminal (no podés hacerlo solo)
5. Verificar via curl o desde el browser

Lo primero que hay que hacer:

A. Verificar T-010 end-to-end (admin debe estar corriendo):
   - `GET /api/v1/admin/accommodations/{id}` debe retornar 200.
   - `/accommodations/{id}` admin detail page carga sin "Cargando…".
   - Tabs `/{id}/amenities` y `/{id}/features` siguen funcionando (tienen su
     propio endpoint, no afectados por el workaround).
   Si sigue 500: pedíme el log del API server y aplicamos el siguiente schema fix.

B. Revertir el TEMP debug en `apps/api/src/utils/response-helpers.ts` (main repo
   solamente). Líneas que agregan los issues al error message — restaurar el throw
   original `'Response payload does not match declared schema'`. O migrar a
   `NODE_ENV === 'development'` gated.

C. Cerrar T-010 (marcar completed en TaskList si está abierta).

Después seguimos con Implementation Phase 2 (C-1 / C-2 / C-3 / C-4 client-side
crashes en billing pages + revalidation — todos comparten signature
`undefined.reduce/map`, probablemente single fix).

Reglas de estilo:
- Hablo en rioplatense, vos también.
- No commits hasta que yo diga "ok / commiteamos / dale".
- Cuando edites schemas/service-core, edita en AMBOS repos (worktree + main repo)
  porque el API live corre desde main repo.

Arrancá leyendo los 3 archivos de contexto y dame un resumen breve del estado para
confirmar que estamos alineados antes de seguir.
```
