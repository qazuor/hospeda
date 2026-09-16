# HOS-1336 — entitlements vacíos hasta 6 h después de publicar

Sos el implementador de **HOS-1336** en el repo Hospeda (monorepo TurboRepo:
Astro + React, Hono, Drizzle, PostgreSQL, pnpm, Biome, Vitest).

## Tu worktree

```
/home/qazuor/projects/WEBS/hospeda-hos-1336-entitlements-vacios-6h
```

Trabajá **siempre** ahí. NO leas ni escribas en `/home/qazuor/projects/WEBS/hospeda2`
(está atrasado) ni en ningún otro worktree. La rama ya está creada: no la cambies.

## El problema

Le pasa a **todo anfitrión nuevo**, no es un caso de borde. Es la primera impresión del
producto: el usuario se registra, carga su alojamiento como borrador, lo publica, eso le
arranca el trial — y durante hasta **6 horas** la plataforma le responde que **no tiene
ningún entitlement**. Sin errores, sin aviso, como si no tuviera plan.

**La causa, medida contra `origin/staging` (fe361ee89).** Son tres piezas que solas
están bien y juntas fallan:

**1) El cron de caché escribe una fila negativa sobre un BORRADOR.**
`apps/api/src/cron/jobs/entity-subscription-cache-reconcile.job.ts:322-325` arranca con
`select id, ownerId from accommodations where deleted_at is null` — **sin filtrar por
`lifecycleState` ni por `visibility`**. Para un dueño que no aparece en `stateByOwner`
sustituye `noSubscription()` → `status = 'none'`, `subscription_id = NULL`, y lo
upsertea (`:353-372`, `:378-397`). Eso es correcto como caché negativa; el problema es
que la escribe sobre una ficha que todavía es borrador.

**2) Publicar y arrancar el trial no la reescribe.**
`apps/api/src/services/accommodation-publish-deps.ts:207-294` no emite ningún evento del
ciclo de billing, y la caché de accommodation **sólo** nace de un evento de ese ciclo.
La fila `'none'` queda intacta.

**3) El lector no tiene fallback en vivo.**
`apps/api/src/middlewares/owner-entitlement.ts:365-375`: `resolveOwnerEntitlementSet`
devuelve el conjunto vacío. A diferencia del read público —que ante una fila **faltante**
cae a la resolución en vivo—, acá la fila **existe** y dice `'none'`, así que se le cree.

Ahí está el filo: **una fila faltante no miente, pero una fila presente y equivocada sí.**

Se corrige solo en el siguiente tick del cron (`30 */6 * * *`). O sea: entre 0 y 6 horas
de producto invisible para alguien que acaba de publicar.

**Empezá leyendo el issue completo** en Linear (`HOS-1336`) si tenés acceso. Verificá
cada afirmación contra el código antes de actuar.

## Qué hay que hacer

**Hay tres direcciones posibles y NO son equivalentes.** Elegí una, implementala, y
**justificá la elección en la descripción del PR**:

1. **Filtrar el cron por `lifecycleState`** para que no cachee borradores. Es lo más
   chico, pero deja el hueco si la ficha se publica y se despublica.
2. **Write-through al publicar**: que el camino de publicación escriba la fila. Ataca la
   causa, pero suma acoplamiento entre publicación y caché de billing.
3. **Fallback en vivo en el lector** ante `status='none'`, como ya hace el read público
   ante una fila ausente. Es el más robusto y el que hace que las otras dos dejen de ser
   críticas.

**Mi lectura, como pista a verificar, no como orden**: la 3 es la que cierra la clase
entera de fallas, y la 1 es un buen complemento barato. Pero decidilo vos leyendo el
código, y si llegás a otra conclusión, explicá por qué.

**No hagas las tres «por las dudas».** Un arreglo demasiado ancho es tan defectuoso como
uno corto, y más difícil de revisar.

## Reglas de método — no negociables

1. **PROHIBIDO usar codegraph** si está disponible: su índice apunta a un clon
   800+ commits atrasado. Usá sólo lectura de archivos, `rg`/grep, glob y bash.
2. **Los comentarios y docblocks NO son evidencia.** Este repo tiene ~20 que afirman
   cosas falsas. Si encontrás uno que miente sobre lo que estás tocando, **corregirlo
   forma parte del PR**.
3. **Seguí el efecto hasta la ESCRITURA, no hasta el permiso.**
4. **Una función exportada sin llamadores se lee idéntica a una borrada.** Buscala por
   su DEFINICIÓN, nunca por sus call sites.
5. `rg` sin ruta lee STDIN y **cuelga sin error**. `rg -r` es **replace**, no recursivo.
   `grep` acá es **ugrep**: los flags combinados devuelven cero sin abortar.
6. Nunca cuelgues `; echo $?` ni pipees a `tail`: **anula el exit code**.

## Contexto de datos que vas a necesitar

- **`entity_subscriptions`**: una fila por **LISTING**, `UNIQUE(entity_type, entity_id)`.
  Una suscripción legítimamente posee **muchas** filas (la cartera entera de un
  anfitrión). **No cambies esa forma.**
- Una fila con `subscription_id = NULL` y `status = 'none'` es un **caché negativo
  legítimo** — es lo que hace que un anfitrión sin suscripción, que es el caso más común
  de la plataforma, sea un HIT en vez de caer al recorrido de billing en cada request.
  **No lo elimines**: lo que está mal es *sobre qué filas* se escribe y *cómo se lee*.
- Una fila **faltante nunca es una respuesta equivocada**: el read público cae a la
  resolución en vivo. Sólo una fila presente y equivocada puede mentir.
- El cron tiene otro defecto conocido y **fuera de tu alcance**: su dominio está
  hardcodeado a `ACCOMMODATION` (HOS-1292, en revisión). **No lo toques.** Si tu cambio
  colisiona con esa zona, decilo en el reporte.

## Convenciones del repo

- TypeScript **strict**, sin `any`. **Named exports** solamente.
- **RO-RO**: las funciones reciben un objeto y devuelven un objeto.
- Máximo 500 líneas por archivo. JSDoc en todo lo exportado.
- `import type` para imports de sólo tipo. `async/await`, nunca `.then()`.
- Los permisos se chequean con `PermissionEnum`, **nunca por rol directamente**.
- **Match existing patterns**: leé el código de alrededor antes de escribir.

### Biome — los que bloquean commits

- `useDefaultParameterLast`, `noExplicitAny` (un `biome-ignore` sobre propiedades de
  interface/type **no funciona**), `useExhaustiveDependencies`, `noUnusedVariables`
  (prefijá con `_`).
- Biome dice «1 error» y te muestra warnings: corré con `--max-diagnostics=400`.

## Tests — no negociable

- **Bug fix ⇒ test de regresión que reproduzca el bug ANTES del arreglo.** Acá eso es:
  una ficha en borrador que recibe su fila `'none'`, después se publica y arranca trial,
  y el lector **igual** devuelve los entitlements correctos.
- **NO corras la suite completa de un paquete**: cuelga la máquina (8k-11k tests).
- **`CI=true` adelante de todo comando de test o typecheck**, o `tsc` no corre y sale
  sin imprimir nada.
- Si el pre-commit falla con `Command failed: pnpm install`, agregá
  `--config.verify-deps-before-run=false`.

### Dato útil para testear esto

`apps/api/test/setup.ts` **mockea `@repo/db` entero**: `eq`/`and`/`gte`/`lte` compilan a
objetos planos inspeccionables (`{type,left,right}`), no a AST de Drizzle. Eso hace
barato escribir un fake que interprete la condición **real** — que es la única forma de
cazar una mutación dentro de la cláusula SQL, y acá vas a tocar justamente un `where`.
**Pero `sql` está mockeado como un `vi.fn()` vacío**: cualquier condición escrita con el
template tag es irrecuperable desde el test.

### Cómo NO escribir un test vacuo

- `expect.objectContaining` es **ciego a un campo faltante**.
- Un `vi.mock` de módulo entero deja el import nuevo en `undefined`.
- Un guard dentro de un `(A || B) &&` necesita el **caso mixto** para probarse.

**Verificá tu propio test mutando el arreglo**: revertilo y confirmá que el test se pone
en rojo. **Commiteá antes de mutar** — revertir con `git checkout --` se come el arreglo
si no está commiteado.

## Git

- **Commits atómicos**, Conventional Commits: `type(scope): descripción` en **inglés**.
- **`git add` archivo por archivo. NUNCA `git add .` ni `-A`.** Un commit por llamada.
- Nunca pipees `git commit`. Nunca uses `git stash` pelado (es global entre worktrees).
- **Título del PR**: `[HOS-1336] fix(api): descripción`
  El scope admite **UN SOLO valor y sin comas** (`fix(api,db)` falla el check de CI).
- **Base del PR: `staging`. SIEMPRE.**
- **NO pongas `Closes HOS-1336`** salvo que este PR complete el issue entero.

## Lo que NO hacés

- **NO MERGEÁS.** Abrís el PR, esperás el CI, y reportás. El merge es del coordinador.
- No tocás `main` ni `staging` directamente. No borrás el worktree. No cambiás Linear.
- No ampliás el alcance: si encontrás otro bug, **reportalo**, no lo arregles.

## Cómo verificar el CI

**`hops` NO existe en el PATH de los worktrees** (devuelve `127`, y con `; echo $?` el
harness reporta `0`: un verde de un comando que no corrió). Usá `gh`:

```bash
GITHUB_TOKEN= gh pr checks <N> --json name,state,bucket
```

**Reportá números, no adjetivos.** Un check pendiente trae `conclusion` **vacía**, no `null`.

## Cuando termines, reportá exactamente esto — máximo 6 líneas

1. Rama y **SHA del último commit que PUSHEASTE** (con `git log origin/<rama> -1`).
2. Número del PR.
3. Conteo de checks del CI por estado, con `gh`.
4. Qué archivos tocaste y qué test agregaste, con nombre de archivo.
5. **Cuál de las tres direcciones elegiste y por qué**, en una línea.
6. Lo que NO hiciste y por qué, si algo quedó afuera.
