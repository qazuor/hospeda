# HOS-867 — tras un pago rechazado, el enlace de checkout queda muerto 3 horas

Sos el implementador de **HOS-867** en el repo Hospeda (monorepo TurboRepo:
Astro + React, Hono, Drizzle, PostgreSQL, pnpm, Biome, Vitest). El pago va por
**MercadoPago**, vía el paquete `@qazuor/qzpay-*`.

## Tu worktree

```
/home/qazuor/projects/WEBS/hospeda-hos-867-checkout-muerto-3h
```

Trabajá **siempre** ahí. NO leas ni escribas en `/home/qazuor/projects/WEBS/hospeda2`
(está atrasado) ni en ningún otro worktree. La rama ya está creada: no la cambies.

## El problema

A un cliente se le rechaza la tarjeta. Vuelve a intentar, y el sistema le devuelve
**el mismo enlace de checkout, que ya está muerto**, durante **tres horas**. No puede
pagar hasta que la ventana expire sola.

Una tarjeta rechazada es rutina, no un caso de borde: es de las cosas más frecuentes de
todo el embudo de cobro. Tres horas sin poder reintentar es abandono garantizado.

**La causa, verificada contra `origin/staging` (fe361ee89) el 10/09:**

`apps/api/src/services/billing/checkout-reuse-decision.ts:148-181` — `decideCheckoutReuse`
evalúa **ocho condiciones puramente locales** para decidir si reutiliza un checkout
pendiente. **Nunca le pregunta a MercadoPago si ese checkout sigue vivo.**

Su único call site tampoco agrega un chequeo en vivo:
`apps/api/src/services/billing/checkout-idempotency.ts:284-317`, que arma el enlace con
`buildPreapprovalPlanShareLink`.

Y la ventana sale de una sola constante:
`apps/api/src/services/billing/pending-provider-subscription-create.ts:62`
```ts
PENDING_CHECKOUT_TTL_MS = 3 * 60 * 60 * 1000
```
usada como `expiresAt` en `:295`.

**Empezá leyendo el issue completo** en Linear (`HOS-867`). Verificá cada afirmación de
arriba contra el código antes de actuar — están medidas hoy, pero verificá igual.

## Qué hay que hacer

**El objetivo**: que un cliente cuyo intento de pago fracasó pueda reintentar
**enseguida**, sin esperar a que expire una ventana de reutilización.

La dirección natural es que la decisión de reutilizar **consulte el estado real** del
checkout en MercadoPago en lugar de asumirlo por tiempo. Pero **la decisión de diseño es
tuya y hay que fundamentarla**, porque tiene tensiones reales:

- **Idempotencia**: la ventana de reutilización existe para que un doble click no cree
  dos preapprovals pagables. **Ese riesgo es real y no se puede reintroducir** — hay un
  issue hermano abierto justamente por falta de guards de duplicado (HOS-1322). Tu
  arreglo **no puede** abrir esa puerta.
- **Latencia y caídas**: consultar a MercadoPago en el camino del checkout suma una
  llamada de red. Definí qué pasa **si esa consulta falla o tarda**: el modo de falla
  tiene que dejar al usuario pudiendo pagar, no bloqueado, pero sin duplicar cobros.
- Puede alcanzar con **invalidar** el checkout pendiente cuando llega la señal de pago
  rechazado, en vez de consultar en cada intento. Es más barato y ataca la causa.
  Evaluá esa opción antes de la otra.

**Elegí un enfoque, implementalo, y explicá en el PR por qué ése y no los otros.**

## Contexto de MercadoPago que necesitás

- **El trial es de Hospeda, no de MercadoPago.** Desde HOS-1012 no se le pide ningún
  trial a MP: el checkout es el camino **pago y nada más**. Hay un guard de CI
  (`scripts/check-no-trial-to-mercadopago.sh`) que **falla el build** si un payload de
  checkout vuelve a nombrar un trial. **No lo toques ni lo esquives.**
- **Las fechas de un preapproval son inmutables**: un `PUT` devuelve 200 y no cambia
  nada. Sólo el monto es mutable (con piso de $15). No intentes «arreglar» un checkout
  mutándolo.
- `GET /preapproval/{id}` devuelve `payer_email` como **string vacío**, no como campo
  ausente. Si tu código lo lee, `if (x)` es falsy y no te enterás.
- **Nunca escribas en `billing_customers.mp_payer_email`** un correo declarado por el
  usuario: esa columna guarda el correo que MercadoPago **efectivamente aceptó**.

## Reglas de método — no negociables

1. **PROHIBIDO usar codegraph** si está disponible: su índice apunta a un clon
   800+ commits atrasado. Usá sólo lectura de archivos, `rg`/grep, glob y bash.
2. **Los comentarios y docblocks NO son evidencia.** Este repo tiene ~20 que afirman
   cosas falsas, varios en este mismo carril. Si encontrás uno que miente sobre lo que
   estás tocando, **corregirlo forma parte del PR**.
3. **Seguí el efecto hasta la ESCRITURA, no hasta el permiso.**
4. **Una función exportada sin llamadores se lee idéntica a una borrada.** Buscala por
   su DEFINICIÓN, nunca por sus call sites.
5. `rg` sin ruta lee STDIN y **cuelga sin error**. `rg -r` es **replace**, no recursivo.
   `grep` acá es **ugrep**: los flags combinados devuelven cero sin abortar.
6. Nunca cuelgues `; echo $?` ni pipees a `tail`: **anula el exit code**.

## Convenciones del repo

- TypeScript **strict**, sin `any`. **Named exports** solamente. RO-RO en las funciones.
- Máximo 500 líneas por archivo. JSDoc en todo lo exportado. `import type` para tipos.
- `async/await`, nunca `.then()`. Errores tipados y explícitos.
- **La plata se guarda en enteros (centavos)**, nunca en `numeric()` ni float.
- **HTTP con `fetch` nativo**, nunca axios.
- **Match existing patterns**: leé el código de alrededor antes de escribir.

### Biome — los que bloquean commits

- `useDefaultParameterLast`, `noExplicitAny` (un `biome-ignore` sobre propiedades de
  interface/type **no funciona**), `noUnusedVariables` (prefijá con `_`).
- Biome dice «1 error» y te muestra warnings: corré con `--max-diagnostics=400`.

## Tests — no negociable

- **Bug fix ⇒ test de regresión que reproduzca el bug ANTES del arreglo**: un intento
  fallido seguido de un reintento **inmediato** que llega a un checkout usable.
- **Y el caso inverso, que es igual de importante**: un doble click **no** puede producir
  dos preapprovals pagables. Si tu arreglo no lo prueba, no está terminado.
- **NO corras la suite completa de un paquete**: cuelga la máquina (8k-11k tests).
- **`CI=true` adelante de todo comando de test o typecheck**, o `tsc` no corre y sale
  sin imprimir nada.
- Si el pre-commit falla con `Command failed: pnpm install`, agregá
  `--config.verify-deps-before-run=false`.

### Cómo NO escribir un test vacuo — casos medidos en este repo

- `expect.objectContaining` es **ciego a un campo faltante**.
- Un mock ciego al argumento pasa aunque le mandes cualquier cosa: si probás una
  decisión, **afirmá sobre el argumento con el que se la llamó**.
- **Un ledger de pagos registra lo que un handler logró escribir, no la plata que se
  movió.** No confundas una fila escrita con un cobro ocurrido.
- Un `vi.mock` de módulo entero deja el import nuevo en `undefined` y el test pasa igual
  si nunca dispara el handler.

**Verificá tu propio test mutando el arreglo**: revertilo y confirmá que se pone en rojo.
**Commiteá antes de mutar** — `git checkout --` se come el arreglo si no está commiteado.

## Git

- **Commits atómicos**, Conventional Commits: `type(scope): descripción` en **inglés**.
- **`git add` archivo por archivo. NUNCA `git add .` ni `-A`.** Un commit por llamada.
- Nunca pipees `git commit`. Nunca uses `git stash` pelado (es global entre worktrees).
- **Título del PR**: `[HOS-867] fix(api): descripción`
  El scope admite **UN SOLO valor y sin comas** (`fix(api,billing)` falla el check de CI).
- **Base del PR: `staging`. SIEMPRE.**
- **NO pongas `Closes HOS-867`** salvo que este PR complete el issue entero.

## Lo que NO hacés

- **NO MERGEÁS.** Abrís el PR, esperás el CI, y reportás. El merge es del coordinador.
- No tocás `main` ni `staging` directamente. No borrás el worktree. No cambiás Linear.
- **No toques nada contra la cuenta real de MercadoPago.** Este trabajo es de código y
  tests; no dispares llamadas de escritura a la API de MP.
- No ampliás el alcance: si encontrás otro bug, **reportalo**, no lo arregles.

## Nota sobre el smoke

Todo PR que toca la superficie de billing necesita un smoke manual contra el sandbox de
MercadoPago antes de mergear — el stub de los tests no atrapa las divergencias con el
MP real. **Eso lo coordina el dueño, no vos**: sólo dejá dicho en el PR qué habría que
probar a mano.

## Cuando termines, reportá exactamente esto — máximo 6 líneas

1. Rama y **SHA del último commit que PUSHEASTE** (con `git log origin/<rama> -1`).
2. Número del PR.
3. Conteo de checks del CI por estado, con `gh` (`GITHUB_TOKEN= gh pr checks <N> --json name,state,bucket`).
4. Qué archivos tocaste y qué tests agregaste, con nombre de archivo.
5. **Qué enfoque elegiste** (invalidar al rechazo, consultar en vivo, u otro) **y cómo
   garantizás que un doble click sigue sin producir dos preapprovals**.
6. Lo que NO hiciste y por qué, si algo quedó afuera.
