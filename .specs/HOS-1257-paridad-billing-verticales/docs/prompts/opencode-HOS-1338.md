# HOS-1338 — el attach del trial de comercio corre fuera de su transacción

Sos el implementador de **HOS-1338** en el repo Hospeda (monorepo TurboRepo:
Astro + React, Hono, Drizzle, PostgreSQL, pnpm, Biome, Vitest).

## Tu worktree

```
/home/qazuor/projects/WEBS/hospeda-hos-1338-attach-trial-fuera-de-transaccion
```

Trabajá **siempre** ahí. NO leas ni escribas en `/home/qazuor/projects/WEBS/hospeda2`
(está atrasado) ni en ningún otro worktree. La rama ya está creada: no la cambies.

## El problema

Es **el único defecto de datos de todo el relevamiento cuya información no se puede
reconstruir después**. Todos los demás se reparan con un `UPDATE` derivable; éste no.

Un dueño de gastronomía o de experiencia publica su ficha y eso le arranca el trial. Si
el attach falla justo después de que la suscripción se commiteó, queda una fila en
`billing_subscriptions` que **no está atada a ninguna ficha, y no hay forma de saber a
cuál correspondía**.

**La causa, medida contra `origin/staging` (fe361ee89):**

En `apps/api/src/services/commerce-trial-start.service.ts`,
`attachListingToSubscription` se llama **después** de `createTrialSubscription` y
**fuera de su transacción** — hay un comentario explícito que dice
*"Attach AFTER … outside its transaction"*.

Si ese attach tira:

- la suscripción ya está commiteada;
- **sin `domainMetadata`** — el insert del trial escribe
  `metadata: {source, createdBy, trialDays}` y nada más
  (`apps/api/src/services/subscription-trial-create.service.ts:194`), a diferencia de
  todo checkout de comercio, que sí estampa las coordenadas de la ficha;
- **y sin fila en `entity_subscriptions`**, que es la otra copia de esa relación.

Las dos copias de la información fallan juntas, porque la segunda es justamente la que
iba a escribir el paso que falló.

**Por qué no se recupera**: lo único que queda es derivar por el dueño (`billing_customers`
→ sus fichas de esa vertical → las que estén en PRIVATE con `created_at` cerca del
`trial_start`). Con **una** ficha es trivial; con **varias** es ambiguo y ningún dato
dirime. Y los planes de comercio venden 1, 3 y 10 fichas — «varias» es el caso que el
producto vende.

**Empezá leyendo el issue completo** en Linear (`HOS-1338`) si tenés acceso. Verificá
cada afirmación contra el código antes de actuar.

## Qué hay que hacer

1. **Verificá primero** que el attach sigue afuera de la transacción, y **leé el
   comentario que lo justifica**. Puede haber una razón real — un deadlock, un orden de
   FKs, una llamada externa. Entenderla antes de moverla es parte del trabajo.
2. **La solución preferida**: meter el attach **dentro** de la transacción del trial, de
   modo que la suscripción y su link se commiteen juntos o no se commitee ninguno.
3. **Si al leer el comentario descubrís que hay una razón real para mantenerlo afuera**,
   no fuerces la transacción: implementá la alternativa mínima — **estampar
   `domainMetadata` en el insert del trial**, como ya hace el checkout pago, de modo que
   quede al menos una copia de la relación. **Y explicá en el PR por qué elegiste esa
   rama.**
4. **No hagas las dos cosas «por las dudas».** Elegí una con fundamento.

## Reglas de método — no negociables

1. **PROHIBIDO usar codegraph** si está disponible: su índice apunta a un clon
   800+ commits atrasado. Usá sólo lectura de archivos, `rg`/grep, glob y bash.
2. **Los comentarios y docblocks NO son evidencia** — salvo el que te mando a leer, que
   es evidencia de *intención*, no de comportamiento. Este repo tiene ~20 docblocks que
   afirman cosas falsas. Si encontrás uno que miente sobre lo que estás tocando,
   **corregirlo forma parte del PR**.
3. **Seguí el efecto hasta la ESCRITURA, no hasta el permiso.**
4. **Una función exportada sin llamadores se lee idéntica a una borrada.** Buscala por
   su DEFINICIÓN, nunca por sus call sites.
5. `rg` sin ruta lee STDIN y **cuelga sin error**. `rg -r` es **replace**, no recursivo.
   `grep` acá es **ugrep**: los flags combinados devuelven cero sin abortar.
6. Nunca cuelgues `; echo $?` ni pipees a `tail`: **anula el exit code**.

## Contexto de datos que vas a necesitar

- **`entity_subscriptions`**: una fila por **LISTING**, `UNIQUE(entity_type, entity_id)`,
  con `entity_type ∈ {'accommodation','gastronomy','experience'}`. Una suscripción
  legítimamente posee **muchas** filas — un unique sobre `subscription_id` rechazaría la
  segunda ficha de todo dueño multi-ficha. **No toques esa forma.**
- Una fila con `subscription_id = NULL` y `status = 'none'` es un **caché negativo
  legítimo**, no una fila rota.
- El acceso a la DB va por modelos que extienden `BaseModel` en `@repo/db`. Usá
  transacciones para operaciones multi-paso — que es exactamente de lo que se trata acá.

## Convenciones del repo

- TypeScript **strict**, sin `any`. **Named exports** solamente.
- **RO-RO**: las funciones reciben un objeto y devuelven un objeto.
- Máximo 500 líneas por archivo. JSDoc en todo lo exportado.
- `import type` para imports de sólo tipo. `async/await`, nunca `.then()`.
- Errores tipados y explícitos; los servicios devuelven `Result<T>`.
- **Match existing patterns**: leé el código de alrededor antes de escribir.

### Biome — los que bloquean commits

- `useDefaultParameterLast`, `noExplicitAny` (un `biome-ignore` sobre propiedades de
  interface/type **no funciona**), `useExhaustiveDependencies`, `noUnusedVariables`
  (prefijá con `_`).
- Biome dice «1 error» y te muestra warnings: corré con `--max-diagnostics=400`.

## Tests — no negociable

- **Bug fix ⇒ test de regresión que reproduzca el bug ANTES del arreglo.** Acá eso
  significa: **un test que fuerce la falla del attach** y verifique que la suscripción
  **no** quedó commiteada huérfana. Ese es el corazón del PR.
- **Cubrí las dos verticales**: gastronomía y experiencias.
- **NO corras la suite completa de un paquete**: cuelga la máquina (8k-11k tests).
- **`CI=true` adelante de todo comando de test o typecheck**, o `tsc` no corre y sale
  sin imprimir nada.
- Si el pre-commit falla con `Command failed: pnpm install`, agregá
  `--config.verify-deps-before-run=false`.

### Dato útil para testear esto

`apps/api/test/setup.ts` **mockea `@repo/db` entero**: `eq`/`and`/`gte`/`lte` compilan a
objetos planos inspeccionables (`{type,left,right}`), no a AST de Drizzle. Eso hace
barato escribir un fake que interprete la condición real. **Pero `sql` está mockeado
como un `vi.fn()` vacío**: cualquier condición escrita con el template tag es
irrecuperable desde el test.

### Cómo NO escribir un test vacuo

- `expect.objectContaining` es **ciego a un campo faltante**.
- Un `vi.mock` de módulo entero deja el import nuevo en `undefined` y el test pasa igual
  si nunca dispara el handler.
- Un default de mock declarado en el `describe` equivocado igual pone verde:
  `clearAllMocks` **no borra implementaciones**.

**Verificá tu propio test mutando el arreglo**: revertilo y confirmá que el test se pone
en rojo. Si sigue verde, el test no prueba lo que dice. Después volvé a ponerlo.
**Commiteá antes de mutar**: revertir con `git checkout --` se come el arreglo si no
está commiteado.

## Git

- **Commits atómicos**, Conventional Commits: `type(scope): descripción` en **inglés**.
- **`git add` archivo por archivo. NUNCA `git add .` ni `-A`.** Un commit por llamada.
- Nunca pipees `git commit`: pierde el commit y la razón.
- Nunca uses `git stash` pelado: **es global entre worktrees**. Usá un commit WIP.
- **Título del PR**: `[HOS-1338] fix(api): descripción`
  El scope admite **UN SOLO valor y sin comas** (`fix(api,db)` falla el check de CI).
- **Base del PR: `staging`. SIEMPRE.**
- **NO pongas `Closes HOS-1338`** salvo que este PR complete el issue entero.

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
5. **Qué decía el comentario que justificaba el attach afuera, y qué rama elegiste
   (transacción o metadata) y por qué.**
6. Lo que NO hiciste y por qué, si algo quedó afuera.
