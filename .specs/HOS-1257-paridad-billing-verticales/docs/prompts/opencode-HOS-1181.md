# HOS-1181 — paga después del trial vencido y su ficha no vuelve online

Sos el implementador de **HOS-1181** en el repo Hospeda (monorepo TurboRepo:
Astro + React, Hono, Drizzle, PostgreSQL, pnpm, Biome, Vitest).

> **Este issue va DESPUÉS de HOS-1337**, que toca el mismo terreno (visibilidad de
> comercio y su reconciliador). **Antes de arrancar, confirmá con el coordinador que
> HOS-1337 ya está mergeado en `staging`**, y cortá tu rama de un `origin/staging`
> fresco. Si arrancás antes, vas a conflictuar.

## Tu worktree

```
/home/qazuor/projects/WEBS/hospeda-hos-1181-ficha-no-vuelve-online
```

Trabajá **siempre** ahí. NO leas ni escribas en `/home/qazuor/projects/WEBS/hospeda2`
(está atrasado) ni en ningún otro worktree. La rama ya está creada: no la cambies.

## El problema

Se le vence el trial a un anfitrión, el cron le despublica la ficha. Días después decide
pagar. Paga. **Y su ficha no vuelve a estar online**: ningún camino de billing la
republica.

Peor: **dos mails de win-back le prometen textualmente que no hace falta que haga nada**.
Así que ni siquiera sabe que tiene que avisar. Paga, no ve su ficha, y espera.

Es exactamente el público que una campaña de captación produce en masa: el que convierte
tarde.

**Empezá leyendo el issue completo** en Linear (`HOS-1181`): tiene la evidencia con
archivo:línea del relevamiento. **Verificala contra el código antes de arreglar**, porque
puede haber cambiado — y porque HOS-1337 acaba de tocar esa zona.

## Qué hay que hacer

1. **Verificá primero** el camino completo: qué despublica la ficha al vencer el trial, y
   qué pasa exactamente cuando esa misma persona paga después. Confirmá que efectivamente
   nadie la republica.
2. **Cableá la republicación** en el camino de confirmación del pago.
3. **Leé los dos mails de win-back** y verificá qué prometen. Si tu arreglo hace que la
   promesa sea cierta, perfecto. Si no la cubre del todo, **el copy hay que corregirlo en
   el mismo PR** — una promesa que el producto no cumple es parte del bug, no un detalle
   aparte. El texto va por **`@repo/i18n`** (locales `es`, `en`, `pt`; default `es`),
   nunca hardcodeado.
4. **Pensá qué ficha republicar.** Un anfitrión puede tener varias, y no todas estaban
   publicadas cuando se le venció el trial. **Republicar lo que el usuario no había
   publicado es un bug peor que no republicar nada** — una ficha que él tenía en borrador
   a propósito no puede aparecer online porque pagó. Determiná cómo se distingue y decilo
   en el PR.

## El reconciliador — pieza central, y hay una regla que no se rompe

`reconcileSubscriptionLinkedEntities`
(`apps/api/src/services/subscription-linked-entities.service.ts`) es **el único puente**
entre el ciclo de vida de billing y el resto de la plataforma. Tiene 6 call sites y todos
pasan por ahí.

**Su mitad de accommodation IGNORA el status que le pasan y RE-DERIVA** la suscripción
actual del dueño desde la base. Eso es deliberado: evita que un webhook tardío de una
suscripción superada despublique la que el usuario está pagando. **No lo "simplifiques"
haciéndole caso al status recibido.**

Contexto de datos que vas a tocar:

- **`entity_subscriptions`**: una fila por **LISTING**, `UNIQUE(entity_type, entity_id)`.
  Una suscripción legítimamente posee **muchas** filas (la cartera entera de un
  anfitrión). **No cambies esa forma.**
- Una fila con `subscription_id = NULL` y `status = 'none'` es un **caché negativo
  legítimo**, no una fila rota.
- Una fila **faltante nunca es una respuesta equivocada**: el read público cae a la
  resolución en vivo.

## Reglas de método — no negociables

1. **PROHIBIDO usar codegraph** si está disponible: su índice apunta a un clon
   800+ commits atrasado. Usá sólo lectura de archivos, `rg`/grep, glob y bash.
2. **Los comentarios y docblocks NO son evidencia.** Este repo tiene ~20 que afirman
   cosas falsas. Si encontrás uno que miente sobre lo que estás tocando, **corregirlo
   forma parte del PR**.
3. **Seguí el efecto hasta la ESCRITURA, no hasta el permiso.** Acá eso es literal: el
   cambio de status de la suscripción **no es** el cambio de visibilidad de la ficha.
   Seguilo hasta `accommodations.lifecycleState` / `visibility`.
4. **Una función exportada sin llamadores se lee idéntica a una borrada.** Buscala por
   su DEFINICIÓN, nunca por sus call sites.
5. `rg` sin ruta lee STDIN y **cuelga sin error**. `rg -r` es **replace**, no recursivo.
   `grep` acá es **ugrep**: los flags combinados devuelven cero sin abortar.
6. Nunca cuelgues `; echo $?` ni pipees a `tail`: **anula el exit code**.

## Un caso vecino que conviene que conozcas

Hay un camino medido en el que una ficha queda **publicada gratis para siempre**: si el
despublicado falla, `expireLocalTrial` devuelve `outcome: 'unpublish-failed'` **a
propósito** sin sellar la expiración, para reintentar al día siguiente — pero esa
madrugada `preapproval-less-expiry` la sella en `expired`, y con la fila ya en `expired`
nunca vuelve a calificar para despublicar.

**No es tu issue** y no lo arregles acá. Pero si tu cambio toca esa zona, **decilo en el
reporte**: puede que tu arreglo lo roce o lo vuelva más fácil de resolver después.

## Convenciones del repo

- TypeScript **strict**, sin `any`. **Named exports** solamente. RO-RO en las funciones.
- Máximo 500 líneas por archivo. JSDoc en todo lo exportado. `import type` para tipos.
- Los permisos se chequean con **`PermissionEnum`**, nunca por rol directamente.
- **Todo texto de cara al usuario va por `@repo/i18n`.**
- **Match existing patterns**: leé el código de alrededor antes de escribir.

### Biome — los que bloquean commits

- `useDefaultParameterLast`, `noExplicitAny` (un `biome-ignore` sobre propiedades de
  interface/type **no funciona**), `useExhaustiveDependencies`, `noUnusedVariables`
  (prefijá con `_`).
- Biome dice «1 error» y te muestra warnings: corré con `--max-diagnostics=400`.

## Tests — no negociable

- **Bug fix ⇒ test de regresión que reproduzca el bug ANTES del arreglo**: trial vencido
  con ficha despublicada, pago confirmado, ficha online de nuevo.
- **Y el caso que no debe pasar**: una ficha que el usuario tenía en borrador **no**
  puede quedar publicada por haber pagado. Si tu arreglo no lo prueba, no está terminado.
- **Cubrí las tres verticales** donde aplique (alojamiento, gastronomía, experiencias).
  Un PR que arregla una y no prueba las otras reabre la brecha en el mismo acto de
  cerrarla.
- **NO corras la suite completa de un paquete**: cuelga la máquina (8k-11k tests).
- **`CI=true` adelante de todo comando de test o typecheck**, o `tsc` no corre y sale
  sin imprimir nada.
- Si el pre-commit falla con `Command failed: pnpm install`, agregá
  `--config.verify-deps-before-run=false`.

### Cómo NO escribir un test vacuo — casos medidos en este repo

- `expect.objectContaining` es **ciego a un campo faltante**.
- **Editar una plantilla de email no la despacha**: si tocás el copy, el test tiene que
  probar el texto que efectivamente sale, no el archivo que lo define.
- Un `vi.mock` de módulo entero deja el import nuevo en `undefined` y el test pasa igual
  si nunca dispara el handler.
- Un guard dentro de un `(A || B) &&` necesita el **caso mixto** para probarse.

**Verificá tu propio test mutando el arreglo**: revertilo y confirmá que se pone en rojo.
**Commiteá antes de mutar** — `git checkout --` se come el arreglo si no está commiteado.

## Git

- **Commits atómicos**, Conventional Commits: `type(scope): descripción` en **inglés**.
- **`git add` archivo por archivo. NUNCA `git add .` ni `-A`.** Un commit por llamada.
- Nunca pipees `git commit`. Nunca uses `git stash` pelado (es global entre worktrees).
- **Título del PR**: `[HOS-1181] fix(api): descripción`
  El scope admite **UN SOLO valor y sin comas** (`fix(api,i18n)` falla el check de CI).
- **Base del PR: `staging`. SIEMPRE.**
- **NO pongas `Closes HOS-1181`** salvo que este PR complete el issue entero.
- Si tu rama quedó atrás de `staging`, **mergeá `staging` en tu rama antes de correr los
  tests**: hay fallas que existen sólo en el merge y son invisibles en cualquiera de las
  dos ramas por separado.

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
4. Qué archivos tocaste y qué tests agregaste, con nombre de archivo.
5. **Cómo distinguís qué fichas republicar** de las que el usuario tenía en borrador, y
   si tocaste el copy de los mails de win-back.
6. Lo que NO hiciste y por qué, si algo quedó afuera.
