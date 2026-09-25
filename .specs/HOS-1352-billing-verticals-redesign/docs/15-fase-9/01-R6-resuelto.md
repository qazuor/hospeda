---
title: "FASE 9 · R6 resuelto — el andamiaje del programa"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 · R6 resuelto — el andamiaje del programa

`DEC-METH-004` exige dos cosas para declarar un racimo resuelto: que el camino de cada hallazgo,
reejecutado, ya no llegue, **y** que la regla corregida se verifique contra todo el dominio que
cuantifica. El dominio de R6 está enumerado en
[`00-dominios-de-los-racimos.md`](./00-dominios-de-los-racimos.md) §R6: **82 casos**. Acá están los
82 recorridos, los ocho caminos reejecutados, y lo que R6 **no** puede cerrar.

**Este documento no aplica ningún cambio.** El §65 del PDR pone el código productivo en la FASE 10
y la decisión de cuándo se aplica esto es del owner. Lo que sigue es la resolución escrita y
verificada: qué cambiar, en qué archivo, por qué, y contra qué se verificó.

**Todo lo medido acá se midió sobre este worktree** —el de la spec, no el clone principal—,
el 2026-09-19. El clone principal está parado en `cd4e59164` y **no tiene dos de los quince
workflows**; medirlo ahí es lo que produjo la corrección que el documento de dominios ya lleva.

---

## 0. Los dos catálogos de guards, que no son el mismo

Es la confusión que hay que deshacer antes de leer nada más, porque las dos mitades del programa la
arrastran y producen conteos incompatibles.

| | el catálogo del **programa** | el catálogo del **repo** |
|---|---|---|
| **qué es** | `G1`…`G13`, guards **de diseño** que las unidades van a construir | scripts que ya corren |
| **dónde vive** | `V/20` §2 (7), `B/20` §2 (4), las descomposiciones (2) | `scripts/check-*.sh\|.ts` |
| **cuántos son** | **13**; el `20` cataloga **11** | **45** scripts, **37** en `check:guards` |
| **cuántos corren hoy** | **cero**: ninguno existe | los 53 pasos, en cada PR a `main` y a `staging` |
| **cuál es su defecto** | `G12` y `G13` fuera del catálogo | once vigilan el modelo que el programa borra |

**Los dos catálogos no se tocan en ningún punto.** Ni un solo `G` del programa está implementado, y
ni un solo guard del repo está nombrado en los capítulos `20`. Toda afirmación del tipo *«los guards
no corren en el paraguas»* es cierta **por dos razones distintas y con dos arreglos distintos**: los
del repo no corren porque el disparador no alcanza la rama; los del programa no corren porque
todavía no existen.

Y hay una regla del propio repo que decide si un guard del programa va a correr alguna vez, escrita
como comentario dentro de `ci.yml`, job `guards`:

> Being listed in `pnpm check:guards` is NOT what makes a guard run here: this job invokes each
> script as its own step, so a guard added only to that npm script would never execute in CI.

**Un `G` que se agregue sólo al script npm no corre en CI.** Va en los dos lugares o no va.

---

## 1. Qué cambia, exactamente

Seis cambios. Cuatro tocan archivos del repo y dos tocan capítulos de las épicas. Ninguno está
aplicado.

### C-1 · `.github/workflows/ci.yml`, el bloque `on:` (líneas 14 a 26)

Es el cambio central: es el workflow que trae lint, security, los 53 guards, build, typecheck,
tests unitarios, tests de integración, CSP y `CI Pass`.

```yaml
on:
  push:
    branches:
      - main
      - staging
      - 'epic/**'
  pull_request:
    branches:
      - main
      - staging
      - 'epic/**'
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review
```

`types:`, `workflow_call:`, `workflow_dispatch:` y el bloque `concurrency` quedan **sin tocar**.

**Las dos mitades hacen falta y hacen cosas distintas.** `pull_request` cubre `F-8C2-003` (el PR de
sub-épica al paraguas); `push` cubre `F-8C2-004` (el merge periódico de `staging` hacia el paraguas,
que no es un PR y por lo tanto ningún disparador de `pull_request` alcanza).

**Lo que este cambio NO rompe, verificado contra el texto de los jobs.** `test-unit` decide entre la
corrida con cobertura y la corrida sin cobertura preguntando `github.base_ref == 'main'`
(líneas 600, 622 y 635); un PR a `epic/**` cae en la rama **sin cobertura**, que es la barata y la
misma que toma un PR a `staging`. `coverage-check` (línea 704) se saltea por la misma condición, y
`ci-pass` **acepta `skipped`** para ese job y sólo para ese. O sea que `CI Pass` cierra verde en un
PR al paraguas sin ninguna otra modificación.

**Lo que este cambio SÍ cambia y hay que decirlo**: los dos jobs que trabajan por diff
—`security` (semgrep `--baseline-commit`) y el paso «Check seed dual-write rule» del job `guards`—
resuelven su base con `scripts/resolve-ci-baseline.sh`, que en un `push` usa `github.event.before`.
En el commit de merge de `staging` → paraguas esa base es el HEAD anterior del paraguas, así que
**todo el delta de `staging` aparece como introducido por ese merge**. La corrida va a ser ruidosa
en esos dos, y no en los demás. El instrumento para evitarlo ya existe y no hay que construirlo:
re-disparar `ci.yml` con `workflow_dispatch` e `baseline_ref: staging`, que hace que el script
resuelva `git merge-base HEAD origin/staging` — la base correcta para un merge desde `staging`.

### C-2 · `.github/workflows/e2e-pr.yml`, el bloque `on:`

```yaml
on:
  pull_request:
    branches:
      - staging
      - main
      - 'epic/**'
```

**Por qué sí.** Es la única suite que arranca la aplicación entera contra una base real. El programa
reemplaza el modelo de dinero completo; un typecheck verde sobre un árbol al que le falta media
tabla es exactamente el modo de falla de `F-8C2-004`. Sin `push:` acá a propósito: la suite tarda y
el merge periódico ya queda cubierto por el `push` de `ci.yml`.

### C-3 · `.github/workflows/validate-pr-title.yml`, el bloque `on:`

```yaml
on:
  pull_request:
    branches:
      - staging
      - main
      - 'epic/**'
    types:
      - opened
      - edited
      - reopened
      - synchronize
```

El validador acepta `[HOS-NNN]` con el patrón `HOS-[0-9]+`, así que los 22 tags del programa
(`HOS-1355`…`HOS-1376`) pasan sin tocar la expresión. Cuesta dos minutos de runner y es lo que
mantiene la trazabilidad unidad ↔ PR dentro del paraguas.

### C-4 · `scripts/check-umbrella-branch-target.sh` (nuevo) + su paso en `ci.yml`

Es la mitad que convierte *«no lo hagas»* en *«no se puede»*, y es la que `DEC-ARCH-007` pide
textualmente. Sin esto, C-1 a C-3 sólo agregan CI al camino correcto y dejan el camino prohibido tan
abierto como estaba.

El predicado no es por nombre de rama sino por ascendencia, que es lo que no se puede evadir
renombrando:

```bash
UMBRELLA="origin/epic/HOS-1352-verticales-billing"
# Si el paraguas todavía no existe, no hay nada que proteger.
git rev-parse --verify --quiet "$UMBRELLA" >/dev/null 2>&1 || exit 0
if git merge-base --is-ancestor "$UMBRELLA" HEAD; then
    echo "DEC-ARCH-007: una rama cortada del paraguas no puede apuntar a staging ni a main."
    exit 1
fi
```

**Va en el job `guards` de `ci.yml`, no en `validate-pr-title.yml`.** El job `guards` ya hace
`checkout` con `fetch-depth: 0`, que es lo que este predicado necesita; `validate-pr-title.yml` no
hace checkout en absoluto y su comentario declara esa ausencia como decisión de mínimo privilegio.
Meterlo ahí costaría un clone completo en un job que hoy sólo lee un campo del evento.

Y por la regla del §0, va en **dos** lugares: como paso propio en el job `guards`, inmediatamente
después de «Resolve diff baseline», y como entrada en `pnpm check:guards` del `package.json` raíz.

El paso se activa sólo cuando el destino es protegido:

```yaml
      - name: A branch cut from the umbrella may not target staging or main (DEC-ARCH-007)
        if: github.base_ref == 'staging' || github.base_ref == 'main'
        run: bash scripts/check-umbrella-branch-target.sh
```

### C-5 · Los dos capítulos `20-testing.md` §2 — la regla de enchufado y los dos huérfanos

No es un cambio de workflow: es lo que hace que los 13 `G` del programa lleguen a correr alguna vez.
Dos ediciones, una en cada épica, **sin aplicar**:

1. **Adoptar `G12` y `G13` en el catálogo.** Hoy viven sólo en `HOS-1354-…/descomposicion.md` §2.1.
   Un catálogo que dice *«acá está la lista, que es lo que permite preguntar ¿están todos? una vez
   en vez de siete»* y que no contiene dos de los suyos no puede contestar esa pregunta. Van a
   `B/20-testing.md` §2, que es donde nacen (`DEC-ARCH-004` condición A y contrato §6.3).
2. **Agregar la regla de enchufado**, con la cita del propio `ci.yml`: todo `G` de esta lista se
   enchufa en **dos** lugares —`pnpm check:guards` y un paso propio en el job `guards` de
   `ci.yml`— y el caso que lo hace fallar a propósito (§2.1) se corre **contra el job**, no sólo
   contra el script.

### C-6 · `.github/workflows/validate-docs.yml` — un filtro muerto, que no es de R6 pero se encontró midiendo

Su `branches:` es `[main, develop]`. **Medido: `git ls-remote --heads origin develop` devuelve
cero.** La mitad `develop` del filtro no puede disparar nunca. No afecta a R6 —el paraguas no toca
`CLAUDE.md` ni `.claude/**`— y se deja anotado acá para que quien aplique C-1 a C-4 lo vea y decida
si lo saca en el mismo PR. **Si además se escribe la excepción de `DEC-ARCH-007` en el `CLAUDE.md`
del repo** (recomendado en §5, punto 2), entonces este workflow sí tiene que alcanzar `epic/**`,
porque es el que vigila ese archivo.

### Los `branches:` resultantes de los quince, en una tabla

Es lo que pide el criterio: para cada workflow, el bloque que queda. **Once de quince no cambian**,
y para cada uno hay una razón, no una omisión.

| # | workflow | `branches:` resultante | ¿cambia? |
|---|---|---|---|
| W1 | `ci.yml` | push y `pull_request`: `main`, `staging`, `epic/**` | **sí** (C-1) |
| W2 | `e2e-pr.yml` | `pull_request`: `staging`, `main`, `epic/**` | **sí** (C-2) |
| W3 | `lighthouse.yml` | `pull_request`: `staging`, `main` | no — §5 punto 4 |
| W4 | `a11y-sweep.yml` | `pull_request`: `staging` | no — §5 punto 4 |
| W5 | `smoke-gate-sync.yml` | `pull_request closed`: `staging`, `main` | **no, deliberado** |
| W6 | `validate-pr-title.yml` | `pull_request`: `staging`, `main`, `epic/**` | **sí** (C-3) |
| W7 | `codeql.yml` | push y `pull_request`: `main` | no |
| W8 | `codeql-staging.yml` | sin `branches:` — `schedule`, con `ref: staging` fijo | no |
| W9 | `docs.yml` | `pull_request` **sin filtro de rama** + `push: main` | no — ya alcanza |
| W10 | `validate-docs.yml` | `main`, `develop` | condicional — C-6 |
| W11 | `e2e-nightly.yml` | sin `branches:` — `schedule` sobre la rama default | no |
| W12 | `e2e-local.self-hosted.yml` | sin `branches:` — dispatch con input `branch` | no — ya alcanza |
| W13 | `sync-main-to-staging.yml` | push: `main` | no |
| W14 | `whats-new-gate.yml` | `pull_request`: `main` | no |
| W15 | `whats-new-resolve-dates.yml` | push: `main` | no |

**`W5` es el que más importa justificar, porque la intuición dice lo contrario.**
`smoke-gate-sync.yml` reacciona a un `pull_request` **cerrado** y, si el issue referenciado todavía
lleva una etiqueta `status-needs-smoke-*`, lo mueve a **In Review**. Un PR de sub-épica que mergea al
paraguas **no libera nada**: la unidad no llegó a ningún entorno. Hacer que este workflow alcance
`epic/**` movería las 22 unidades a In Review meses antes de que exista algo que smokear, que es
exactamente el estado que la sección de smoke-gates del `CLAUDE.md` describe como el que varó 220
issues. **No corre en el paraguas a propósito.**

---

## 2. Los caminos de los hallazgos, reejecutados

Ocho hallazgos. **Dos dejan de llegar enteros, tres llegan a medias y tres siguen llegando
completos.** Lo que sigue va en ese orden, empezando por lo que no se arregla.

### `F-8C2-006` — SIGUE LLEGANDO, entero

El camino tiene seis pasos y **ninguno se corta**. Ni siquiera el que parecía de herramienta.

| paso | qué dice | ¿llega tras C-1…C-6? |
|---|---|---|
| 1 | `V1` no depende de nada y nada arranca antes | **sí** |
| 2 | su columna de guards es `G1 G3 G8`, y el guard va con la pieza | **sí** |
| 3 | `G8` falla si **queda** `commerce` en fuentes activas | **sí** |
| 4 | `commerce` aparece en cinco lugares del diseño, todos diciendo que es FASE 5 | **sí** |
| 5 | ninguna de las 22 unidades es «sacar `commerce`» | **sí** |
| 6 | `DEC-METH-003`: no se clasifica ninguna pieza antes de abrir el gate | **sí** |

**Ningún cambio de workflow puede hacer pasar `G8`.** Lo que C-1 agrega es que el día que `G8`
exista, corra en el PR de `V1` — que es justamente lo que lo va a hacer fallar antes, no después.
**El arreglo de R6 empeora el síntoma a propósito**: hoy `G8` fallaría en silencio porque no corre
nada; mañana falla en el primer PR del programa, que es donde tiene que fallar.

Se cierra abriendo `P1`, y eso es del owner (§4 y §5 punto 1).

### `F-8C2-007` — SIGUE LLEGANDO, entero

Los seis pasos siguen llegando. No hay un paso donde un workflow, un guard o una rama intervengan:
el camino es «49 filas `VERIFIED` son de Mercado Pago» → «el §58 prohíbe código productivo de
billing sobre filas no medidas» → «`DEC-ARCH-007` impl. 5 declara que la 1C no se parte». Es un
hallazgo de **alcance**, no de andamiaje, y está agrupado en R6 porque comparte la causa *«el
programa no puede empezar»*, no porque comparta el mecanismo. **R6 no lo cierra y no puede.**

### `F-8C2-010` — SIGUE LLEGANDO, con un solo ítem movido

De los diez ítems del §65 FASE 7, los cambios de §1 tocan **uno**: la fila `staging`, que era
*«⚠️ sólo como obligación de merge hacia el paraguas»*, pasa a ser una obligación **con
verificación** (el `push: epic/**` de C-1). Los otros nueve quedan igual, incluidos los cuatro con
cero apariciones —`rollout`, `coexistence`, `feature flags`, `rollback`—. El paso 4 del camino
(*«la única fase entre el diseño y el código es justamente la que se partió»*) llega intacto.
Se cierra nombrando a quién escribe la FASE 7 del paraguas (§5 punto 5).

### `F-8C2-008` — LLEGA A MEDIAS

| paso | qué dice | ¿llega? |
|---|---|---|
| 1 | el job `guards` tiene 53 pasos y once nombran el modelo actual | **sí** — es medición, no defecto |
| 2 | ese job corre en `main` y `staging`; por `F-8C2-003` no en el paraguas | **no** — C-1 lo hace correr |
| 3 | el programa borra el vocabulario que esos once vigilan | **sí** |
| 4 | *«en el PR final se topan **a la vez** con un árbol sin su sujeto»* | **no** — de a uno |
| 5 | ninguna de las dos épicas lista esos guards | **sí** |

El paso 4 es el corazón del hallazgo —*«a la vez»* y *«en el PR que nadie puede revisar»*— y deja de
llegar: los once se encuentran con el árbol nuevo **distribuidos** entre los PRs que los rompen, y
cada uno es una decisión tomada en un PR chico y revisable, que es exactamente lo que
`DEC-ARCH-007` punto 4 pide. Los once que verifiqué por nombre son los pasos 15, 16, 17, 18, 19, 21,
22, 23, 25, 26 y 28 del job.

**El paso 5 sigue llegando y es el §0 de este documento**: los dos catálogos no se conocen. C-5
adopta `G12` y `G13` pero **no** hace que las épicas listen los 53 del repo, y eso no se arregla con
una lista: se arregla en FASE 5, cuando cada uno de los once reciba su veredicto (se retira, se
reescribe, se excepciona). Queda abierto y declarado.

### `F-8C2-014` — LLEGA A MEDIAS

La mitad **nacimiento** deja de llegar. El paso 1 dice que *«nace cuando exista el primer código»*
no es comprobable. Con C-1 aplicado **antes** de que la rama exista, el nacimiento produce dos
registros consultables: `git ls-remote --heads origin 'epic/*'` (hoy, medido: **cero filas**) y la
primera corrida de `ci.yml` sobre esa rama, con su fecha. El §6 los deja como comando.

La mitad **cota** llega entera: los pasos 3 y 4 —*«nada declara cuándo la espera dejó de ser
tolerable»*— no los toca ningún workflow. Es del owner (§5 punto 6).

### `F-8C2-003` — NO LLEGA

| paso | qué dice | dónde se corta |
|---|---|---|
| 1 | `DEC-ARCH-007` manda cortar del paraguas, mergear a él y revisar ahí | llega — es la regla |
| 2 | ningún workflow nombra `epic` ni un comodín | **se corta**: C-1, C-2 y C-3 lo nombran en tres |
| 3 | el PR al paraguas dispara **cero** checks | **se corta**: dispara `ci.yml`, `e2e-pr.yml` y el título |
| 4 | el camino prohibido dispara todos y **nada lo bloquea** | **se corta**: C-4 bloquea por ascendencia |
| 5 | el merge periódico no corre nada: su destino no es `staging` | **se corta**: `push: epic/**` de C-1 |
| 6 | revisión sin CI en cada PR, y CI sin revisión en uno | **se corta**: es la conjunción de 3, 4 y 5 |

**Cinco de seis pasos se cortan y el que queda es el enunciado de la regla.** Es el hallazgo que R6
cierra limpio.

Queda un residuo que no estaba en el camino y que aparece al aplicarlo: hacer que los PRs de
sub-épica lleven `[HOS-NNNN]` los pone al alcance de la automatización de Linear que el `CLAUDE.md`
documenta como footgun vivo —*«On PR merge, move to Done»*, que dispara con un `HOS-N` en el
**título**, sin palabra mágica—. Mergear `V1` al paraguas cerraría `HOS-1355` con el programa sin
desplegar. **Es del owner** y está en §5 punto 3.

### `F-8C2-004` — NO LLEGA, pero el mecanismo sobrevive

| paso | qué dice | dónde se corta |
|---|---|---|
| 1 | el paraguas vive meses esperando la pasarela | llega |
| 2 | se mergea `staging` → paraguas periódicamente | llega |
| 3 | el paraguas está eliminando el sistema que ese código llama | llega |
| 4 | un archivo borrado de un lado y llamado del otro **mergea limpio y roto** | **llega** — git no cambia |
| 5 | *«ahí no corre ni typecheck»* | **se corta**: `push: epic/**` corre typecheck, build y las dos suites |
| 6 | la primera vez que alguien lo ve es el PR final | **se corta**, por el 5 |

El paso 4 no se corta y **no debe cortarse**: es cómo funciona git, no un defecto. Lo que el
hallazgo reprocha es que *«nadie lo ve hasta el PR final»*, y eso son los pasos 5 y 6. Y hay una
razón por la que este arreglo funciona donde el merge periódico no: **typecheck, build y las suites
no trabajan por diff.** Miran el árbol entero, así que un archivo que `staging` agregó llamando a
algo que el paraguas borró falla aunque el diff del merge no tenga un solo conflicto. Los dos jobs
que **sí** trabajan por diff —`security` y el paso de seed dual-write— son justamente los que C-1
declara ruidosos en ese merge, y por eso no son los que sostienen este cierre.

### `F-8C2-016` — verificado cerrado en su núcleo; su paso 4 no tiene texto

No se reabre. Se verifica, que es lo que pide el encargo.

- Pasos 1 a 3 (110 hallazgos sin criterio de salida, sin lista de bloqueantes, sin forma de contar)
  — **cerrados por `DEC-METH-004`**, leído en `01-decision-log.md`: fecha 2026-09-19, estado
  `ACCEPTED`, alternativa (3) elegida, cuatro salidas declaradas, y la implicación 2 que convierte
  «resuelto» en un acto verificable (*«se cierra reejecutando su camino sobre el texto nuevo»*). El
  recuento ya vive en un solo lugar: la §1 de `00-hallazgos.md`, hecho con script sobre los ocho
  informes.
- **Paso 4 — no tiene texto que lo cierre.** El hallazgo pedía *«ningún documento dice: la FASE 10 no
  arranca con un `CRITICA` abierto»*, al modo del §61 para una fila `UNKNOWN`. Leí `DEC-METH-004`
  entero: define qué es «resuelto», enumera las cuatro salidas y fija el orden de propagación, y
  **no enuncia esa puerta**. Queda como §5 punto 8. No es una reapertura del hallazgo: es el
  resultado de verificar que quedó cerrado.

---

## 3. El dominio recorrido — los 82 casos

Cuatro bloques: 30 + 26 + 22 + 4. Los **66 que nadie había mirado** son los 26 guards × destino, las
22 unidades, los 15 workflows × `staging` y las puertas `P3` y `P4` — o sea todo menos la primera
tabla y dos filas de la última.

### 3.1 · Los 15 workflows × destino `epic/**` (15 casos, ya probados fallando)

La pregunta de cada caso: *¿corre sobre un PR de sub-épica al paraguas, y es lo que el programa
necesita?*

| # | workflow | hoy | ¿debe? | veredicto tras C-1…C-4 |
|---|---|---|---|---|
| W1 | `ci.yml` | no | **sí** | **corre** — PR y push; `coverage-check` se saltea y `CI Pass` lo acepta |
| W2 | `e2e-pr.yml` | no | **sí** | **corre** en PR; sin `push` a propósito (duración) |
| W3 | `lighthouse.yml` | no | por dispatch | **no por PR**; por dispatch antes del PR final (§6, ch. 7) |
| W4 | `a11y-sweep.yml` | no | por dispatch | ídem `W3`; su `workflow_dispatch` ya acepta `update_baseline` |
| W5 | `smoke-gate-sync.yml` | no | **no** | **deliberado**: llevaría las 22 a In Review sin deploy |
| W6 | `validate-pr-title.yml` | no | **sí** | **corre**; `HOS-[0-9]+` ya acepta `HOS-1355`…`HOS-1376` |
| W7 | `codeql.yml` | no | **no** | el SAST por PR lo cubre el job `security` de `W1` (semgrep, 4 packs) |
| W8 | `codeql-staging.yml` | no | **no** por defecto | `schedule` con `ref: staging` fijo; ver §5 punto 7 |
| W9 | `docs.yml` | **sí** | sí | **ya corre**: sin filtro de rama. Dispara si el diff toca sus seis paths |
| W10 | `validate-docs.yml` | no | condicional | sólo si la excepción se escribe en el `CLAUDE.md` (C-6) |
| W11 | `e2e-nightly.yml` | no | **no** | `schedule` sobre la rama default; `W2` ya cubre el PR |
| W12 | `e2e-local.self-hosted.yml` | **sí** | sí | **ya alcanza**: `workflow_dispatch` con input `branch` |
| W13 | `sync-main-to-staging.yml` | no | **no** | automatiza el back-merge desde `main`; no aplica |
| W14 | `whats-new-gate.yml` | no | **no** | es la puerta de la promoción a `main`, no del desarrollo |
| W15 | `whats-new-resolve-dates.yml` | no | **no** | push a `main`; no aplica |

**Cerrados: 15 de 15.** Seis corren (dos ya corrían, tres por cambio, uno condicional), nueve no
corren y cada uno tiene su razón escrita.

**Una precisión sobre `W9` que el dominio no traía**: sus paths son `docs/**`, `apps/**/docs/**`,
`packages/**/docs/**`, `.markdownlint.json`, `scripts/check-links.ts` y `scripts/validate-examples.ts`.
**`.specs/**` no está en la lista**, así que los documentos del propio programa —incluido éste— no
disparan `W9`. Lo que `W9` alcanza de un PR al paraguas es documentación **del repo**, no de la spec.

### 3.2 · Los 15 workflows × destino `staging` (15 casos, sin mirar)

La pregunta de cada caso: *¿corre sobre un PR que va a `staging`, y eso es lo que el programa
necesita?* El dominio lo marca como *«el camino que la decisión prohíbe y el único con CI»*. El
resultado del recorrido es que **el defecto no es que corran**: es que nada impide que una rama de
sub-épica los use.

| # | workflow | corre en PR a `staging` | ¿es lo que el programa necesita? |
|---|---|---|---|
| W1 | `ci.yml` | **sí** | sí, para el resto del repo. **Y acá vive el bloqueo (C-4)** |
| W2 | `e2e-pr.yml` | **sí** | sí, sin cambio |
| W3 | `lighthouse.yml` | **sí** | sí, sin cambio |
| W4 | `a11y-sweep.yml` | **sí** | sí, sin cambio |
| W5 | `smoke-gate-sync.yml` | **sí** (en `closed`) | sí — el único lugar donde el programa lo **quiere** |
| W6 | `validate-pr-title.yml` | **sí** | sí, sin cambio |
| W7 | `codeql.yml` | **no** — sólo `main` | correcto: `W1` cubre el PR a `staging` |
| W8 | `codeql-staging.yml` | **no** — `schedule` | correcto: barre `staging` una vez por día, fuera del PR |
| W9 | `docs.yml` | **sí**, si toca sus paths | sí, sin cambio |
| W10 | `validate-docs.yml` | **no** — `main`/`develop` | hueco previo, ajeno a R6; `develop` no existe |
| W11 | `e2e-nightly.yml` | **no** | correcto |
| W12 | `e2e-local.self-hosted.yml` | **no** — sólo dispatch | correcto |
| W13 | `sync-main-to-staging.yml` | **no** — push a `main` | correcto; es lo que abre el PR de back-merge |
| W14 | `whats-new-gate.yml` | **no** — sólo `main` | correcto |
| W15 | `whats-new-resolve-dates.yml` | **no** | correcto |

**Cerrados: 15 de 15.** Ocho corren y deben seguir corriendo; siete no corren y está bien. El único
cambio que este bloque produce es el **paso de C-4 dentro de `W1`**, que es dónde el camino
prohibido deja de estar abierto. **Ningún workflow se saca de `staging`.**

### 3.3 · Los 13 guards × 2 destinos (26 casos, sin mirar)

La pregunta: *¿corre sobre un PR a `epic/**`, sobre uno a `staging`, y es lo que el programa
necesita?* El §0 ya da la respuesta común a los 26 y hay que decirla sin adornos: **ninguno de los
trece existe como código hoy**, así que hoy ninguno corre en ningún destino. Lo que el recorrido
produce no es un veredicto de ejecución sino la **condición de enchufado** de cada uno, que es lo
único verificable antes de FASE 10.

| # | guard | unidad que lo construye | destino `epic/**` | destino `staging` | qué falta |
|---|---|---|---|---|---|
| G1 | vertical fuera del Eje 2 | `V1` | al construirse + C-1 + enchufe | idem, en el PR final | enchufe |
| G2 | operación sin contexto de vertical | `V5` | idem | idem | enchufe |
| G3 | clave de código ↔ base, doble dirección | `V1` | idem | idem | enchufe |
| G4 | transición que escribe roles | `V5` | idem | idem | enchufe |
| G5 | fuente que se apaga sin reconciliador | `V6` | idem | idem | enchufe |
| G6 | autorización que decide sólo por rol | `V5` | idem | idem | enchufe |
| G7 | valor comercial en código | `B2` | idem | idem | enchufe; `B2` es la única de billing de hoy |
| G8 | `commerce` en fuentes activas | `V1` | **corre y falla el día uno** | idem | **`P1`, no el enchufe** |
| G9 | `reason` como identificador interno | `B1` | idem | idem | enchufe + `P2` |
| G10 | `init_point` sin sanear | `B1` | idem | idem | enchufe + `P2` |
| G11 | pedirle un trial al proveedor | `B1` | idem | idem | enchufe + `P2` |
| G12 | SDK de la pasarela fuera del adaptador | `B1` | idem | idem | **fuera del catálogo** (C-5) + `P2` |
| G13 | arranque de `cobertura()` en producción | `B4` | idem | idem | **fuera del catálogo**; nace en `B4` |

**Veredicto de los 26: contestados los 26, cerrados ninguno todavía, y la razón no es la misma para
todos.** Veintidós esperan sólo al enchufe y a que su unidad se construya. Dos (`G12`, `G13`, en sus
dos destinos = cuatro casos) arrastran además el defecto de catálogo que C-5 corrige. Y `G8`, en sus
dos destinos, no espera al enchufe sino a `P1`.

**Y hay una asimetría entre los dos destinos que conviene no perder**: para los trece, el destino
`staging` se alcanza **una sola vez**, en el PR final del paraguas. O sea que la única corrida de
los trece guards del programa sobre el camino que llega a producción ocurre en el PR que
`DEC-ARCH-007` declara irrevisable. Eso no es un defecto que R6 pueda cerrar —es la forma del
despliegue único— pero sí es la razón por la que el destino `epic/**` tiene que funcionar: es el
único lugar donde los trece corren **muchas veces**.

### 3.4 · Las 22 unidades de trabajo (22 casos, sin mirar)

La pregunta: *¿qué conjunto de verificaciones dispara el PR de esta unidad?* Antes de C-1 la
respuesta es la misma para las 22 —**ninguna**, salvo `docs.yml` si el diff toca `docs/**`—. Después
de C-1 a C-4 la respuesta también es la misma para las 22, y ése es el punto: **la cobertura de CI no
depende de la unidad**.

El conjunto base, idéntico para las 22: `ci.yml` completo (lint · security · 53 guards ·
build · typecheck · test-unit sin cobertura · test-integration · csp-headers · `CI Pass`), más
`e2e-pr.yml`, más `validate-pr-title.yml`. Más los `G` propios de la unidad, cuando existan.

| unidad | `G` propios | conjunto base tras C-1…C-4 | lo que además la traba |
|---|---|---|---|
| `V1` | `G1` `G3` `G8` | ✅ | **`P1`** — `G8` (`F-8C2-006`). Es la traba de todo el programa |
| `V2` | — | ✅ | `V1` |
| `V3` | — | ✅ | `V1` → `V2` |
| `V4` | — (`G13` nace en `B4`) | ✅ | `V1`…`V3`; su tercera defensa no tiene guard hasta `B4` |
| `V5` | `G2` `G4` `G6` | ✅ | `V1`…`V4` |
| `V6` | `G5` | ✅ | `V1`…`V5` |
| `V7` | — | ✅ | `V5` |
| `V8` | — | ✅ | `V6` y `V7` |
| `V9` | — | ✅ | `V4` y `V6` |
| `B1` | `G9` `G10` `G11` `G12` | ✅ | ⛔ **`P2`** — salvo la interfaz y `G12`, que se pueden escribir hoy |
| `B2` | `G7` | ✅ | `V2`. **La única de billing sin atadura con la pasarela** |
| `B3` | — | ✅ | ⛔ `P2` |
| `B4` | `G13` | ✅ | `B3` y `V4` |
| `B5` | — | ✅ | `B3` |
| `B6` | — | ✅ | 🔒 **`P4`** — el capítulo 13 no existe, y `RF-3` sigue `UNKNOWN` |
| `B7` | — | ✅ | ⛔ `P2` |
| `B8` | — | ✅ | ⛔ `P2` |
| `B9` | — | ✅ | ⛔ `P2` |
| `B10` | — | ✅ | ⛔ `P2` |
| `B11` | — | ✅ | ⛔ `P2` |
| `B12` | — | ✅ | ⛔ `P2` |
| `B13` | — | ✅ | `B10` |

**Cerrados: 22 de 22** para la pregunta que el dominio hace (*«¿su PR verifica algo?»*). Las trabas
de la última columna no son casos de este bloque: son las cuatro puertas de §3.5, y contarlas dos
veces inflaría el resultado.

**Lo que el recorrido de este bloque agrega y no estaba enumerado**: los `G` propios se reparten muy
desparejo. **Dieciséis de las 22 unidades no llevan ningún `G`** —`V2`, `V3`, `V4`, `V7`, `V8`,
`V9`, `B3`, `B5`, `B6`, `B7`, `B8`, `B9`, `B10`, `B11`, `B12` y `B13`— y los trece se concentran
en seis: `V1` (3), `V5` (3), `B1` (4), y uno cada una en `V6`, `B2` y `B4`. No es un
defecto: es la consecuencia de la regla *«cada guard va con la pieza que protege, nunca al final»*.
Lo que sí conviene ver es que **`B4` lleva el único guard del contrato** y es la unidad de la que
depende que la frontera deje de ser una definición.

### 3.5 · Las 4 puertas (4 casos; 2 ya probados fallando, 2 sin mirar)

La pregunta: *¿qué la abre y quién la abre?*

| # | puerta | estado medido | qué la abre | quién | ¿la cierra R6? |
|---|---|---|---|---|---|
| P1 | gate de FASE 5 | cerrado; 1B terminado (132 hallazgos) | una decisión, hoy | **el owner** | **no** |
| P2 | elección de pasarela | abierta, paso 4 de 6 | `PRUEBA 0` + KYC + re-medir | **owner**+`P3` | **no** |
| P3 | KYC de Mobbex | en revisión manual desde 2026-09-18, sin SLA | un tercero | **Mobbex** | **no** |
| P4 | capítulo 13 (Pagos) | sin escribir | escribirlo, y antes su política | **owner**, tras `P2` | **no** |

**Cuatro de cuatro contestadas, cero cerradas.** Y hay un orden entre ellas que el dominio no
declaraba y que el recorrido deja a la vista: **`P1` es la única que se puede abrir hoy sin esperar
a nadie de afuera.** `P2` espera a `P3`, que es de un tercero; `P4` espera a `P2`. `P1` espera sólo
a una conversación, y es la que traba `V1`, que traba las 21 unidades restantes.

### 3.6 · El recuento de los 82

| bloque | casos | cerrados | abiertos |
|---|---|---|---|
| 15 workflows × `epic/**` | 15 | **15** | 0 |
| 15 workflows × `staging` | 15 | **15** | 0 |
| 13 guards × 2 destinos | 26 | 0 | **26** |
| 22 unidades | 22 | **22** | 0 |
| 4 puertas | 4 | 0 | **4** |
| **total** | **82** | **52** | **30** |

**52 cerrados, 30 abiertos.** De los 30: **26** son los guards del programa, que no se pueden cerrar
escribiendo —se cierran construyéndolos, con la condición de enchufado de C-5 y §0—; y **4** son las
puertas, que son del owner y de un tercero.

**Ninguno de los 30 abiertos está abierto por falta de análisis.** Los 82 tienen veredicto escrito;
30 de ellos son «abierto, y acá está exactamente qué lo cierra y quién».

---

## 4. Lo que R6 NO puede cerrar

Tres cosas, y es importante no presentarlas como resueltas porque el racimo tenga arreglos baratos.

### 4.1 · `F-8C2-007` — la pasarela reabre la FASE 1C

**No se arregla con un workflow, con un guard ni con una rama.** El camino es de alcance: 49 filas
`VERIFIED` medidas contra Mercado Pago, el §58 que prohíbe código productivo de billing sobre filas
no medidas, y `DEC-ARCH-007` impl. 5 que declara que la 1C no se parte. Si la pasarela elegida no es
Mercado Pago, **81 filas vuelven a abrirse** y hay que repetir la 1C entera antes de que `B1` pueda
terminarse.

**De quién depende**: del owner, en el paso 5 de
[`10-evaluacion-de-proveedor.md`](../10-evaluacion-de-proveedor.md). Lo que el hallazgo reclama no es
la decisión sino que **el costo de re-medir no está escrito ahí**, y por lo tanto no pesa en la
elección. Corregir eso es editar la evaluación, que no es un archivo de R6.

**Queda abierto**: `P2` y, por dependencia, `P3` y `P4`, más las nueve unidades ⛔ de billing.

### 4.2 · `F-8C2-006` — `V1` necesita que se abra el gate de FASE 5

El camino de seis pasos llega entero (§2). Lo que R6 aporta es **acotarlo**: no es un defecto del
diseño de `V1` ni de `G8`, es que **ninguna de las 22 unidades es «sacar `commerce`»** y por lo tanto
el trabajo que `G8` exige no tiene dueño.

**De quién depende**: del owner, y `DEC-METH-003` dice con qué se toma —*«con el inventario de 1B
terminado»*— que **está terminado**. Es la única de las cuatro puertas que se puede abrir hoy.

**Queda abierto**: `P1`, `V1`, y por dependencia las otras 21 unidades.

Y hay una consecuencia del propio arreglo de R6 que conviene declarar: **aplicar C-1 hace que `G8`
falle en el primer PR del programa en vez de no correr nunca.** Eso es deseable, y es también la
razón por la que C-1 y `P1` conviene que se decidan juntos: aplicar C-1 sin abrir `P1` deja al
programa con un guard rojo desde el día uno, que es el antipatrón que la §2.1 de la descomposición
de verticales nombra por su nombre.

### 4.3 · Los once guards del repo que vigilan el modelo que el programa borra

`F-8C2-008` cierra su paso 4 (el encuentro deja de ser simultáneo y deja de ocurrir en el PR
irrevisable) y **no cierra su paso 5**: ninguna de las dos épicas lista los 53 guards del repo, y
decidir cuál de los once se retira, cuál se reescribe contra el modelo nuevo y cuál se excepciona es
trabajo de FASE 5 — el mismo `P1`.

**De quién depende**: de `P1`, otra vez. Y el propio hallazgo declara su límite: leyó los **nombres**
de los pasos, no los scripts, así que *cuál* de los once falla no está medido y no se puede medir
antes de la 5.

---

## 5. Qué requiere decisión del owner

Ocho. Cada uno con lo que cuesta y lo que arriesga no hacerlo.

1. **Abrir el gate de entrada de FASE 5 (`DEC-METH-003`) y darle dueño al §55.**
   **Costo**: definir el criterio de `KEEP`/`REWRITE` con el inventario de 1B a la vista, y una
   unidad de trabajo nueva («sacar `commerce` de fuentes activas») que hoy no está entre las 22.
   **Riesgo de no hacerlo**: `V1` no arranca, y `V1` traba las otras 21. Es el bloqueo más caro del
   programa y el único que se puede levantar hoy sin esperar a nadie de afuera.

2. **Cuándo se aplican C-1 a C-4 — y la respuesta correcta es «antes de que nazca el paraguas».**
   **Costo**: un PR de unas veinte líneas sobre tres workflows, más un script nuevo. Medido hoy:
   `git ls-remote --heads origin 'epic/*'` devuelve **cero**, así que la ventana está abierta.
   **Riesgo de no hacerlo**: si la rama nace primero, el primer PR del programa entra sin
   verificación, y descubrirlo con meses de código adentro cuesta lo que un PR hoy no cuesta.
   Conviene decidirlo **junto con el punto 1**, por lo que dice §4.2.

3. **Qué se hace con la automatización de Linear «On PR merge, move to Done» sobre los PRs de
   sub-épica.**
   **Costo**: un cambio de configuración en el equipo Hospeda (`No action`), o la convención de no
   poner el `HOS-N` en el título — que choca con C-3, que lo exige.
   **Riesgo de no hacerlo**: las 22 unidades se marcan `Done` a medida que mergean al paraguas,
   meses antes de que exista nada desplegado. El `CLAUDE.md` documenta dos incidentes reales de esta
   misma automatización (PRs #1982 y #1983).

4. **Si `lighthouse.yml` y `a11y-sweep.yml` corren en cada PR de sub-épica o sólo por dispatch.**
   **Costo**: agregarlos es una línea en cada uno y minutos de runner que en un repo público son
   gratis; el costo real es ruido —`a11y-sweep` compara contra un baseline y una pantalla nueva lo
   mueve—. **Riesgo de no hacerlo**: el PR final vuelve a ser la primera vez que corren, que es la
   forma exacta de `F-8C2-008`. La mitigación escrita en §6 (chequeo 7) es un dispatch obligatorio
   sobre el paraguas antes del PR final; si el owner prefiere no depender de un paso manual, van
   por PR.

5. **Quién escribe la FASE 7 del paraguas.**
   **Costo**: una fase que hoy no es de nadie, con seis de sus diez ítems sin dónde vivir —`rollout`,
   `coexistence`, `feature flags`, `rollback` con cero apariciones—. **Riesgo de no hacerlo**: el
   programa despliega el sistema de cobro entero una sola vez y sin forma escrita de volver
   (`F-8C2-005`), y esa elección de riesgo queda tomada por omisión.

6. **Si la espera del paraguas tiene cota.**
   **Costo**: una revisión agendada («si a los N meses billing sigue bloqueada, se vuelve a mirar
   `DEC-ARCH-007`»). **Riesgo de no hacerlo**: la condición que hacía razonable liberar junto —que
   las dos épicas terminen parecido— nunca se vuelve a evaluar (`F-8C2-014`, mitad «cota»).

7. **Si `codeql-staging.yml` debe barrer también el paraguas mientras viva.**
   **Costo**: hoy tiene `ref: staging` fijo; alcanzarlo pide una segunda corrida o un input.
   **Riesgo de no hacerlo**: meses de código nuevo sin barrido profundo de seguridad, cubierto sólo
   por semgrep por diff. Es menor mientras el paraguas viva poco, y crece con la espera del punto 6.

8. **Cuál es la condición de salida de la FASE 9 — la puerta que el paso 4 de `F-8C2-016` pedía.**
   **Costo**: una línea en el registro, del tipo *«la FASE 10 no arranca con un `CRITICA` abierto»*,
   al modo del §61 para una fila `UNKNOWN`. **Riesgo de no hacerlo**: `DEC-METH-004` definió qué es
   «resuelto» para un hallazgo y no cuándo la fase termina, así que la 10 puede arrancar con
   críticos abiertos sin que nada lo señale.

---

## 6. Cómo se verifica que esto quedó aplicado

Siete chequeos. Los seis primeros son ejecutables desde la raíz del repo y devuelven exit code; el
séptimo es una obligación con evidencia consultable. **Todos se corren sobre el worktree o sobre un
clone al día, nunca sobre uno parado** — el chequeo 0 es justamente eso.

```bash
# 0 · El árbol que se está midiendo tiene los quince workflows.
#     Un clone desactualizado devuelve 13 y toda la verificación siguiente miente.
test "$(ls .github/workflows/*.yml | wc -l)" -eq 15 || echo 'FALLA: no son 15 workflows'
```

```bash
# 1 · Los tres que deben alcanzar el paraguas lo nombran.
for f in ci.yml e2e-pr.yml validate-pr-title.yml; do
    rg -q "epic/\*\*" ".github/workflows/$f" || echo "FALLA: falta epic/** en $f"
done
```

```bash
# 2 · Los que NO deben nombrarlo, no lo nombran. Salida vacía = correcto.
rg -l 'epic/\*\*' .github/workflows/ \
  | rg -v 'ci\.yml|e2e-pr\.yml|validate-pr-title\.yml'
```

```bash
# 3 · ci.yml dispara en las DOS mitades. Sin el push, F-8C2-004 vuelve.
#     PyYAML parsea la clave `on:` como el booleano True; por eso el d[True].
python3 - <<'PY'
import yaml
d = yaml.safe_load(open('.github/workflows/ci.yml'))
on = d[True] if True in d else d['on']
for ev in ('push', 'pull_request'):
    assert 'epic/**' in on[ev]['branches'], f'FALLA: {ev} no alcanza el paraguas'
print('OK: ci.yml alcanza epic/** en push y pull_request')
PY
```

```bash
# 4 · El bloqueo del camino prohibido existe, y existe en los DOS lugares
#     (la regla del §0: estar sólo en el script npm no lo hace correr en CI).
test -f scripts/check-umbrella-branch-target.sh \
  || echo 'FALLA: no existe el guard de destino'
rg -q 'check-umbrella-branch-target' .github/workflows/ci.yml \
  || echo 'FALLA: el guard no tiene paso propio en el job guards'
rg -q 'check:umbrella-branch-target' package.json \
  || echo 'FALLA: el guard no esta en check:guards'
```

```bash
# 5 · El nacimiento del paraguas, verificable y fechado.
#     Hoy, medido: cero filas. Cuando exista, la primera corrida es su acta.
git ls-remote --heads origin 'epic/*'
GITHUB_TOKEN= gh run list --branch epic/HOS-1352-verticales-billing --limit 1 \
  --json headBranch,createdAt,conclusion
```

```bash
# 6 · Un PR de sub-epica al paraguas dispara de verdad. Se corre sobre el
#     primer PR real, no antes. `gh pr checks` devuelve subconjuntos
#     todo-verdes: se lee el rollup y se exige que `CI Pass` haya concluido.
GITHUB_TOKEN= gh pr view <N> --json baseRefName,statusCheckRollup --jq '
  .baseRefName + " -> " + (.statusCheckRollup | length | tostring) + " checks; CI Pass="
  + ((.statusCheckRollup[] | select(.name=="CI Pass") | .conclusion) // "AUSENTE")'
# Esperado: base epic/..., un conteo >= 10, y CI Pass = SUCCESS.
# Un `conclusion` VACIO no es null: un check pendiente lo devuelve como "".
```

```bash
# 7 · Obligacion antes del PR final del paraguas a staging: correr por
#     workflow_dispatch los dos que no corren por PR (decision del owner, §5.4).
GITHUB_TOKEN= gh workflow run lighthouse.yml  --ref epic/HOS-1352-verticales-billing
GITHUB_TOKEN= gh workflow run a11y-sweep.yml  --ref epic/HOS-1352-verticales-billing
# Evidencia: `gh run list --workflow lighthouse.yml --branch epic/...` con
# conclusion=success, fechada despues del ultimo merge al paraguas.
```

**Y un chequeo que no es de workflows pero es el que decide si los trece `G` del programa van a
correr alguna vez**, a repetir cada vez que una unidad construya el suyo:

```bash
# 8 · Enchufe de un guard del programa, en los dos lugares. Ejemplo con G8.
rg -q 'check:g8' package.json            || echo 'FALLA: G8 no esta en check:guards'
rg -q 'scripts/check-g8' .github/workflows/ci.yml \
  || echo 'FALLA: G8 no tiene paso propio en el job guards'
```

---

## Lo que este documento NO hace

- **No aplica ningún cambio.** Ni a los workflows, ni al PDR, ni al decision log, ni a la matriz, ni
  a ningún capítulo de las dos épicas. El §65 pone el código productivo en la FASE 10 y el momento
  de aplicar esto es una decisión del owner (§5 punto 2).
- **No abre ninguna de las cuatro puertas.** Las cuatro siguen cerradas y cada una tiene dueño
  escrito en §3.5.
- **No reabre `F-8C2-016`.** Lo verifica: cerrado en su núcleo por `DEC-METH-004`, y su paso 4 sin
  texto que lo cierre, lo cual va como §5 punto 8 y no como hallazgo nuevo.
- **No resuelve los otros cinco racimos.** R6 es el único que se arregla, en su mayor parte, en un
  PR de workflows; eso no dice nada sobre los otros.
- **No cuenta un caso dos veces.** Las trabas de la última columna de §3.4 son las puertas de §3.5 y
  se cuentan una sola vez, en §3.5.

---

## 7. La decisión del owner, 2026-09-19 — y qué ajusta de la §1

El owner revisó los cambios propuestos y **decidió el reparto workflow por workflow**. Lo que sigue
es lo aprobado; donde difiere de la §1, **manda esta sección**.

**La forma es una regla del proyecto, no una excepción temporal.** Una excepción en diez archivos
que nadie va a recordar retirar es deuda garantizada — y es la misma forma del defecto que este
programa combate: una regla escrita para un caso puntual. Queda como `DEC-CI-001` y vive en el
`CLAUDE.md` del repo, donde ya viven las reglas de `main` y `staging`.

**Y el criterio que ordena el reparto**: el riesgo no es que corran ramas `epic/` ajenas — que una
épica futura reciba lint y tests es deseable. El riesgo es que corra **lo caro** y, sobre todo,
**lo que tiene efectos afuera del repo**.

| workflow | ¿`epic/**`? | motivo |
|---|---|---|
| `ci.yml` | **sí** | lint, typecheck, tests y los guards del repo. Es todo el punto. `C-1` **sin cambios** |
| `validate-pr-title.yml` | **sí** | barato; mantiene la trazabilidad de los PRs de sub-épica. `C-3` **sin cambios** |
| `validate-docs.yml` | **sí** | barato. **Falta en la §1 y hay que agregarlo** |
| `codeql.yml` | **sí** | seguridad; una rama que vive meses la necesita más, no menos. **Falta en la §1** |
| `docs.yml` | ya corre | no tiene filtro de rama, sólo de paths. Nada que hacer |
| `e2e-pr.yml` | **sí** | ⚠️ **revisado el mismo día — ver §7.4.** `C-2` **vuelve a estar vigente**. Medido: corre **sólo P0, con los externos mockeados y techo de 25 min**, así que el costo por PR es asumible |
| `lighthouse.yml` | **no** | mide performance de páginas desplegadas, y en el paraguas no hay deploy que medir |
| `a11y-sweep.yml` | **no** | mismo caso |
| `whats-new-gate.yml` | **no** | es de `main` por diseño |
| **`smoke-gate-sync.yml`** | **NO, y es el punto de riesgo** | ver abajo |

### 7.1 Por qué `smoke-gate-sync.yml` no puede correr en el paraguas

Ese workflow **mueve issues de Linear al mergear un PR**. Si corriera en los PRs de sub-épica →
paraguas, y esos PRs llevan `[HOS-NNNN]` en el título —que es justo lo que `validate-pr-title`
exige—, **cerraría las 22 unidades como hechas sin que haya nada desplegado**.

No es un riesgo teórico: es el footgun que el `CLAUDE.md` del repo documenta **con dos incidentes
reales**, el PR #1982 que cerró `HOS-36` y el #1983 que cerró `HOS-54`, los dos sin trabajo real y
los dos revertidos a mano. Esto cierra el punto 3 de la §5.

### 7.2 Lo que NO se toca, y cambia de motivo

**`C-6` queda cancelado.** La §1 proponía limpiar el filtro `[main, develop]` de
`validate-docs.yml` porque `develop` no existe. **El owner decidió no tocarlo, y la razón vuelve
falso el diagnóstico**: no es un filtro muerto por descuido, es una condición **adelantada** a una
rama que sí quiere tener —le hizo falta hace semanas, para trabajo que todavía no debía llegar a
`staging`— y que se va a crear **con su propio trabajo**: tocar workflows, reglas de rama e
instrucciones de los agentes. Eso lo toma otra persona, en otro momento.

> **Queda anotado para quien lo haga**, no como limpieza pendiente: `develop` está nombrada en
> `validate-docs.yml` y **no existe en el remoto** (`git ls-remote --heads origin develop` → cero
> el 2026-09-19).

### 7.3 Qué queda pendiente de aplicar

Los cambios **no están aplicados**: son archivos del repo, y el PDR §65 reserva el código
productivo para la FASE 10. Lo que queda listo para que alguien lo ejecute:

| | qué | estado |
|---|---|---|
| `C-1` | `ci.yml` ← `epic/**` en `push` **y** en `pull_request` | aprobado, sin aplicar |
| `C-3` | `validate-pr-title.yml` ← `epic/**` | aprobado, sin aplicar |
| **`C-7`** | `validate-docs.yml` ← `epic/**` (**sin tocar `develop`**) | **nuevo**, sin aplicar |
| **`C-8`** | `codeql.yml` ← `epic/**` | **nuevo**, sin aplicar |
| `C-4` | `scripts/check-umbrella-branch-target.sh` + su paso en `ci.yml` | aprobado, sin aplicar |
| `C-5` | la regla de enchufado en los dos `20-testing.md` | aprobado, sin aplicar |
| `C-2` | `e2e-pr.yml` ← `epic/**` | **revivido** por §7.4, sin aplicar |
| ~~`C-6`~~ | ~~`validate-docs.yml`, el filtro `develop`~~ | **cancelado** por §7.2 |

**La ventana sigue abierta**: `git ls-remote --heads origin 'epic/*'` devuelve **cero** al
2026-09-19. Mientras el paraguas no exista, aplicar esto no obliga a migrar nada.

Y lo que la §1 advierte sobre `C-1` **sigue valiendo entero**: la mitad `push` es la que cubre
`F-8C2-004`, y el merge periódico de `staging` hacia el paraguas va a ser ruidoso en los dos jobs
que trabajan por diff, con el instrumento para evitarlo ya existente (`workflow_dispatch` con
`baseline_ref: staging`).

### 7.4 `e2e-pr.yml` vuelve a entrar — revisado el mismo día

La §7 lo había dejado afuera por caro. **Se midió y el motivo era falso**: `e2e-pr.yml` corre **sólo
la suite P0, con los externos mockeados y `timeout-minutes: 25`**. No es la suite completa. El costo
por PR de sub-épica es asumible, así que **`C-2` vuelve a estar vigente**.

**Pero la razón por la que entra no es la que se propuso.** Se planteó que e2e sería lo que proteja
de que la separación y duplicación de código por vertical vuelva a pasar, y **eso no lo hace un
e2e**: un `x === 'gastronomy' ? A : B` que responde mal para `accommodation` y `partner` **pasa
todos los e2e** si ninguno ejerce esas dos verticales. No es hipotético — es `HOS-1079`, once sitios
en `apps/api` con esa forma exacta, ninguno detectado en runtime y todos cazados después por un
guard estático. **Esa defensa es estática y ya existe**: diez scripts en `scripts/`, empezando por
`check-no-binary-vertical-ternary`, y corren dentro de `ci.yml`, que sí alcanza `epic/**` por §7.

**Lo que e2e sí aporta en el paraguas** es lo otro: que el flujo de cobro siga funcionando mientras
la épica lo reemplaza.

> ⚠️ **Y trae una consecuencia que se declara ahora para que no muerda después.** Los e2e actuales
> prueban el billing **viejo**, que este programa borra. En algún punto de la épica el código nuevo
> los va a hacer fallar **por razones que no son bugs**. El modo de falla conocido es rojo crónico →
> se lo ignora → el día que falla de verdad nadie mira.
>
> **La regla que lo evita**: una unidad que reemplaza un flujo de billing **adapta sus e2e en el
> mismo PR**. No después, no en un issue aparte.
