# HOS-1244 — «Actualizar medio de pago» da 403 y no avisa nada

Sos el implementador de **HOS-1244** en el repo Hospeda (monorepo TurboRepo:
Astro + React, Hono, Drizzle, PostgreSQL, pnpm, Biome, Vitest).

## Tu worktree

```
/home/qazuor/projects/WEBS/hospeda-hos-1244-medio-de-pago-403
```

Trabajá **siempre** ahí. NO leas ni escribas en `/home/qazuor/projects/WEBS/hospeda2`
(está atrasado) ni en ningún otro worktree. La rama ya está creada: no la cambies.

## El problema

Un cliente en mora entra a la única pantalla que la plataforma le ofrece para salir de
esa situación, toca **«Actualizar medio de pago»**, y la llamada **pega contra una ruta
de admin**: responde **403** y la interfaz **no muestra ningún aviso**. Falla muda.

El cliente quiere pagarte, no puede, y cree que el problema es suyo.

**Lo que está medido** (verificalo, no lo asumas): la pantalla llama a un endpoint del
carril `/api/v1/admin/*` en lugar del carril protegido. La falla se detectó muestreando
la red cada 700 ms — o sea, **no deja rastro visible en la UI**.

**Empezá leyendo el issue completo** en Linear (`HOS-1244`): tiene la evidencia con
archivo:línea del relevamiento original. **Verificala contra el código antes de
arreglar**, porque puede haber cambiado desde que se escribió.

## La arquitectura de rutas que tenés que respetar

La API tiene **tres carriles** y esto es exactamente lo que se violó:

| Carril | URL | Auth | Consumidor |
|---|---|---|---|
| Público | `/api/v1/public/*` | ninguna | web (páginas públicas) |
| Protegido | `/api/v1/protected/*` | sesión de usuario | web (features del usuario) |
| Admin | `/api/v1/admin/*` | admin + permisos | panel de admin |

**La app web usa sólo `/public/` y `/protected/`. Nunca `/admin/`.** La única excepción
del repo es `/api/v1/public/auth/me`.

Referencia completa: `apps/api/docs/route-architecture.md`.

## Qué hay que hacer

1. **Verificá primero** cuál es exactamente la llamada que da 403 y contra qué ruta
   pega. Si ya no pega contra admin, **pará y reportalo**.
2. **Apuntá la pantalla al carril protegido.** Si el endpoint protegido equivalente ya
   existe, usalo. Si no existe, hay que crearlo — y en ese caso **decilo en el reporte**,
   porque cambia el tamaño del trabajo.
3. **Arreglá también la falla muda.** Aunque la ruta quede bien, un 4xx en esa pantalla
   tiene que mostrarle algo al usuario. Un error que no se ve es un bug aparte del que
   lo causó, y este mismo caso lo demuestra: el 403 llevaba tiempo pasando y nadie lo
   sabía.
4. El mensaje de error tiene que decir **qué pasó y qué hacer**, en la línea del resto
   del producto. Nada de «Error inesperado». Y va por **`@repo/i18n`**, nunca hardcodeado
   (locales: `es`, `en`, `pt`; el default es `es`).

## El contrato de errores de la API

Lo fija `apps/api/docs/error-contract.md` y tiene un orden que **no se negocia**:
auth 401 → permiso 403 → forma del input 400 → existencia/propiedad 404 → reglas de
negocio. Tres reglas que muerden seguido:

- un 4xx **nunca** es `INTERNAL_ERROR`;
- un recurso de otro dueño responde **404, no 403** (un 403 confirma que el id existe);
- el actor invitado lleva un **UUID real**, así que un guard de auth pregunta
  `isGuestActor(actor)` y **nunca** `!actor?.id`.

## Reglas de método — no negociables

1. **PROHIBIDO usar codegraph** si está disponible: su índice apunta a un clon
   800+ commits atrasado. Usá sólo lectura de archivos, `rg`/grep, glob y bash.
2. **Los comentarios y docblocks NO son evidencia.** Este repo tiene ~20 que afirman
   cosas falsas. Si encontrás uno que miente sobre lo que estás tocando, **corregirlo
   forma parte del PR**.
3. **Seguí el efecto hasta la ESCRITURA, no hasta el permiso.**
4. `rg` sin ruta lee STDIN y **cuelga sin error**. `rg -r` es **replace**, no recursivo.
   `grep` acá es **ugrep**: los flags combinados devuelven cero sin abortar.
5. Nunca cuelgues `; echo $?` ni pipees a `tail`: **anula el exit code**.

## Convenciones del repo

- TypeScript **strict**, sin `any`. **Named exports** solamente. RO-RO en las funciones.
- Máximo 500 líneas por archivo. JSDoc en todo lo exportado. `import type` para tipos.
- Los permisos se chequean con **`PermissionEnum`**, nunca por rol directamente.
- **Web (`apps/web`)**: Astro por defecto, React sólo donde hace falta interactividad.
  Estilos con **CSS Modules / vanilla CSS** (`*.module.css` al lado del componente).
  **NADA de Tailwind acá** — Tailwind es sólo del admin. Formularios: HTML nativo + hooks
  propios, **no** TanStack Form.
- **Todo texto de cara al usuario va por `@repo/i18n`.**
- **Match existing patterns**: leé el código de alrededor antes de escribir.

### Biome — los que bloquean commits

- `useDefaultParameterLast`, `noExplicitAny` (un `biome-ignore` sobre propiedades de
  interface/type **no funciona**), `useExhaustiveDependencies` (pasá el objeto entero,
  no sus propiedades sueltas), `noUnusedVariables` (prefijá con `_`).
- Biome dice «1 error» y te muestra warnings: corré con `--max-diagnostics=400`.

## Tests — no negociable

- **Bug fix ⇒ test de regresión que reproduzca el bug ANTES del arreglo**: que la
  pantalla llame al carril correcto, **y** que ante un 4xx muestre algo.
- **NO corras la suite completa de un paquete**: cuelga la máquina (8k-11k tests).
- **`CI=true` adelante de todo comando de test o typecheck**, o `tsc` no corre y sale
  sin imprimir nada.
- Si el pre-commit falla con `Command failed: pnpm install`, agregá
  `--config.verify-deps-before-run=false`.

### Cómo NO escribir un test vacuo — casos medidos en este repo

- **Montar un componente no es renderizarlo**, y un elemento SSR no es un gate de
  hidratación.
- `getByLabelText` **no honra `aria-hidden`**: un asterisco de «campo requerido» dentro
  del label rompe la query, porque matchea `textContent` y no el nombre accesible. Usá
  regex.
- Un `queryByTestId` sobre un testid que el componente **nunca tuvo** pasa siempre.
- Un test sobre el fuente de un `.astro` no distingue lo **declarado** de lo
  **renderizado**.

**Verificá tu propio test mutando el arreglo**: revertilo y confirmá que se pone en rojo.
**Commiteá antes de mutar** — `git checkout --` se come el arreglo si no está commiteado.

## Git

- **Commits atómicos**, Conventional Commits: `type(scope): descripción` en **inglés**.
- **`git add` archivo por archivo. NUNCA `git add .` ni `-A`.** Un commit por llamada.
- Nunca pipees `git commit`. Nunca uses `git stash` pelado (es global entre worktrees).
- **Título del PR**: `[HOS-1244] fix(web): descripción`
  El scope admite **UN SOLO valor y sin comas** — `fix(web,api)` **falla el check de
  CI** aunque el PR toque las dos cosas. Elegí dónde está el grueso del cambio.
- **Base del PR: `staging`. SIEMPRE.**
- **NO pongas `Closes HOS-1244`** salvo que este PR complete el issue entero.

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
5. **Si el endpoint protegido ya existía o hubo que crearlo**, y qué le mostrás ahora al
   usuario ante un 4xx.
6. Lo que NO hiciste y por qué, si algo quedó afuera.
