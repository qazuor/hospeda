# HOS-1337 — la ficha de comercio queda pagada e invisible hasta 1 h

Sos el implementador de **HOS-1337** en el repo Hospeda (monorepo TurboRepo:
Astro + React, Hono, Drizzle, PostgreSQL, pnpm, Biome, Vitest).

## Tu worktree

```
/home/qazuor/projects/WEBS/hospeda-hos-1337-ficha-comercio-invisible
```

Trabajá **siempre** ahí. NO leas ni escribas en `/home/qazuor/projects/WEBS/hospeda2`
(está atrasado) ni en ningún otro worktree. La rama ya está creada: no la cambies.

## El problema

Un dueño de gastronomía o de experiencia paga, su ficha se marca visible en la base, y
el índice público la sigue ocultando **hasta una hora**. No hay error en ningún lado:
el estado en la base es correcto y la caché de borde sirve la versión vieja.

**La causa, medida contra `origin/staging` (fe361ee89):**

`packages/service-core/src/services/commerce/commerce-visibility.ts:295` escribe
`visibility` con el modelo crudo y **nunca llama a
`scheduleCommerceListingRevalidation`**.

Esa llamada **sí existe** en los otros caminos: create y update por servicio, y el de
media. O sea: la primitiva ya está construida y probada — al camino de billing no se la
cablearon.

El índice de comercio está en la clase de caché `catalog`: `s-maxage 3600` +
`stale-while-revalidate 3600`. De ahí sale la hora.

**Empezá leyendo el issue completo**: contiene la evidencia y el contexto. Si tenés
acceso a Linear, `HOS-1337`. Si no, lo de arriba alcanza — pero verificá cada
afirmación contra el código antes de actuar, porque puede haber cambiado.

## Qué hay que hacer

1. **Verificá primero** que el defecto sigue ahí: abrí
   `commerce-visibility.ts` y confirmá que el camino que escribe `visibility` no invoca
   la revalidación. Si ya la invoca, **pará y reportalo** — no inventes un arreglo para
   un bug que no existe.
2. **Mirá cómo lo hacen los otros tres caminos** (create, update, media) y seguí esa
   forma exactamente. No inventes una variante: la consistencia con el código existente
   vale más que tu preferencia.
3. **Cableá la revalidación** en el camino de billing.
4. **Revisá el sentido inverso**: cuando una suscripción cae y la ficha se despublica,
   ¿se purga la caché? Una ficha que dejó de estar paga y sigue visible en el índice es
   **peor** que la inversa. Si ese hueco también existe, arreglalo en el mismo PR y
   decilo en la descripción. Si no existe, decilo también.

## Reglas de método — no negociables

1. **PROHIBIDO usar codegraph** si está disponible: su índice apunta a un clon
   800+ commits atrasado. Usá sólo lectura de archivos, `rg`/grep, glob y bash.
2. **Los comentarios y docblocks NO son evidencia.** Este repo tiene ~20 que afirman
   cosas falsas. Verificá contra el código que ejecuta. Si encontrás uno que miente
   sobre lo que estás tocando, **corregirlo forma parte del PR**.
3. **Seguí el efecto hasta la ESCRITURA, no hasta el permiso.** Cuando un flujo tiene
   gate, confirmación y escritura en archivos distintos, leé los tres.
4. **Una función exportada sin llamadores se lee idéntica a una borrada.** Buscala por
   su DEFINICIÓN, nunca por sus call sites.
5. `rg` sin ruta lee STDIN y **cuelga sin error**. `rg -r` es **replace**, no recursivo.
   `grep` acá es **ugrep**: los flags combinados (`-qxF`) devuelven cero sin abortar.
6. Nunca cuelgues `; echo $?` ni pipees a `tail`: **anula el exit code** y te da un
   verde falso.

## Convenciones del repo

- TypeScript **strict**, sin `any`. **Named exports** solamente.
- **RO-RO**: las funciones reciben un objeto y devuelven un objeto.
- Máximo 500 líneas por archivo. JSDoc en todo lo exportado.
- `import type` para imports de sólo tipo. `async/await`, nunca `.then()`.
- **Match existing patterns**: leé el código de alrededor y seguí sus convenciones
  (nombres, estructura, manejo de errores, imports) antes de escribir.

### Biome — los que bloquean commits

- `useDefaultParameterLast`: los parámetros con default van **después** de los requeridos.
- `noExplicitAny`: un `biome-ignore` sobre propiedades de interface/type **no funciona**.
- `useExhaustiveDependencies`: pasá el objeto entero (`[config]`), no sus propiedades sueltas.
- `noUnusedVariables`: prefijá con `_` los parámetros sin usar.
- Biome dice «1 error» y te muestra warnings: el error real está entre los que no
  mostró. Corré con `--max-diagnostics=400`.

## Tests — no negociable

- **Bug fix ⇒ test de regresión que reproduzca el bug ANTES del arreglo.** Escribilo,
  vejo fallar, después arreglá.
- **Cubrí las dos verticales**: gastronomía y experiencias. Un PR que arregla una y no
  prueba la otra reabre la brecha en el mismo acto de cerrarla.
- **NO corras la suite completa de un paquete**: cuelga la máquina (8k-11k tests).
  Corré sólo los archivos que tocaste.
- **`CI=true` adelante de todo comando de test o typecheck**, o `tsc` no corre y sale
  sin imprimir nada.
- Si el pre-commit falla con `Command failed: pnpm install`, agregá
  `--config.verify-deps-before-run=false`.
- Patrón AAA (Arrange, Act, Assert).

### Cómo NO escribir un test vacuo

Este repo tiene precedentes medidos de tests que pasan sin probar nada:

- Un `expect.objectContaining` es **ciego a un campo faltante**.
- Un `toMatch(/<A>[\s\S]*?<B>/)` sobre el fuente entero pasa con el bug puesto.
- Un `vi.mock` de módulo entero deja el import nuevo en `undefined` y nadie se entera.
- Montar un componente **no es** renderizarlo.

**Verificá tu propio test mutando el arreglo**: revertí la línea que arreglaste y
confirmá que el test se pone en rojo. Si sigue verde, el test no prueba lo que dice.
Después volvé a poner el arreglo.

## Git

- **Commits atómicos**, Conventional Commits: `type(scope): descripción` en **inglés**.
- **`git add` archivo por archivo. NUNCA `git add .` ni `-A`.** Un commit por llamada,
  nunca encadenés varios `git add` sin commitear en el medio.
- Nunca pipees `git commit`: **pierde el commit y la razón**, y los archivos se cuelan
  en el commit siguiente.
- Nunca uses `git stash` pelado: **el stash es global entre worktrees**. Si necesitás
  guardar algo, hacé un commit WIP.
- **Título del PR**: `[HOS-1337] fix(service-core): descripción`
  El scope admite **UN SOLO valor y sin comas** — el validador de CI usa
  `\([a-z0-9._-]+\)`, así que `fix(api,web)` falla el check. Elegí el scope donde está
  el grueso del cambio.
- **Base del PR: `staging`. SIEMPRE.** Nunca `main`.
- **NO pongas `Closes HOS-1337`** en el cuerpo salvo que este PR complete el issue entero.

## Lo que NO hacés

- **NO MERGEÁS.** Abrís el PR, esperás el CI, y reportás. El merge es del coordinador.
- No tocás `main` ni `staging` directamente.
- No borrás el worktree.
- No cambiás el estado en Linear.
- No ampliás el alcance: si encontrás otro bug, **reportalo**, no lo arregles.

## Cómo verificar el CI

**`hops` NO existe en el PATH de los worktrees.** Devuelve `127`, y leído con
`; echo $?` el harness reporta `0` — un verde de un comando que no corrió. Usá `gh`:

```bash
GITHUB_TOKEN= gh pr checks <N> --json name,state,bucket
```

**Reportá números, no adjetivos.** «Está verde» no es un reporte: pasá el conteo por
estado. Ojo: un check pendiente trae `conclusion` **vacía**, no `null`.

## Cuando termines, reportá exactamente esto — máximo 6 líneas

1. Rama y **SHA del último commit que PUSHEASTE** (verificalo con
   `git log origin/<rama> -1`, no con tu local).
2. Número del PR.
3. Conteo de checks del CI por estado, con `gh`.
4. Qué archivos tocaste y qué test agregaste, con nombre de archivo.
5. Si el camino inverso (despublicación) tenía el mismo hueco: sí o no.
6. Lo que NO hiciste y por qué, si algo quedó afuera.
