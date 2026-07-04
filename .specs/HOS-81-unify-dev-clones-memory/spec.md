---
title: Consolidar los 3 clones y la memoria de Claude Code en un único proyecto (hospeda)
linear: HOS-81
statusSource: linear
created: 2026-07-04
type: chore
areas:
  - devops
---

# Consolidar los 3 clones y la memoria de Claude Code en un único proyecto (hospeda)

> Spec en español por pedido explícito del owner. El análisis nota-por-nota vive en
> [`docs/analisis-consolidacion-memoria.md`](docs/analisis-consolidacion-memoria.md).

## 1. Contexto y problema

Hoy conviven **tres clones** del monorepo bajo `~/projects/WEBS`:

| Clone | Estado físico | Rama | Tiene |
|-------|---------------|------|-------|
| `hospeda` | ✅ existe | `staging` | **`.codegraph` (352M)**, `.remember` (3.5M), 58 notas de memoria |
| `hospeda2` | ✅ existe | `chore/vitest-5shard-oom-mitigation` | `settings.local.json` (trivial), `.remember` (11M), 68 notas |
| `hospeda3` | ❌ **ya borrado** | — | dejó 7 notas + 271 sesiones + projects en engram |

Como Claude Code (y engram, y el plugin `remember`) derivan el "proyecto" **del path
del `cwd`** (`/` → `-`), cada clone —y cada git worktree, que vive en `../hospeda-{slug}}`—
generó su **propio proyecto separado**. Consecuencia: la memoria, el historial y el
conocimiento acumulado quedaron **fragmentados en decenas de silos** que no se ven entre sí.

Evidencia medida (2026-07-04):

- **Memoria file-based**: 58 + 68 + 7 notas en 3 dirs, **0 solapamiento por nombre de
  archivo** pero **mucho solapamiento semántico** (mismo concepto, distinto filename).
- **Historial de sesiones** (`~/.claude/projects/*/`): ~1.8 GB en **~40 project-dirs**
  (los 3 clones + un dir por cada worktree histórico + subdirs sueltos como `apps-web`,
  `apps-api`).
- **Engram**: 8523 sesiones / 7563 observaciones repartidas en decenas de proyectos
  (`hospeda`, `hospeda2`, `hospeda3`, `hospeda3-*`, `hospeda-api`, `admin`, `web`, `seed`,
  `hospeda-hos-66-...`, `hospeda-spec-NNN-...`, etc.).
- **codegraph**: indexado sólo en `hospeda`.

## 2. Objetivo

Dejar **un único clone canónico (`hospeda`)** con toda la memoria/conocimiento unificado
y depurado, eliminar `hospeda2` y `hospeda3`, y ajustar reglas + tooling para que la
fragmentación **no vuelva a ocurrir** aunque se trabaje en worktrees.

### Objetivos concretos (goals)

- **G-1 — Unificar memoria file-based**: mergear las notas de `hospeda2` + `hospeda3` +
  las 2 sueltas dentro de `hospeda/memory/`, deduplicadas y con un `MEMORY.md` índice
  único reescrito.
- **G-2 — Depurar basura/obsoleto**: eliminar notas de estado efímero de specs cerradas
  y de sistemas retirados (`.qtm`, `specs-prioritization.csv`, numbering local SPEC-NNN).
- **G-3 — Eliminar los clones sobrantes**: borrar físicamente `hospeda2` (y el rastro de
  `hospeda3`), sin perder trabajo (verificado: todo mergeado / respaldado en `origin`).
- **G-4 — codegraph siempre vivo**: garantizar índice + daemon de auto-sync corriendo en
  `hospeda`, y una regla que obligue a consultarlo primero para entender estructura.
- **G-5 — Engram un único proyecto**: que toda la memoria semántica de hospeda quede (o se
  consulte) bajo el project `hospeda`, no fragmentada.
- **G-6 — Referencias user-level a un solo hospeda**: en `~/.claude` (CLAUDE.md global,
  reglas, memorias) cualquier referencia a `hospeda`/`hospeda2`/`hospeda3` apunta a
  `hospeda`.
- **G-7 — Prohibir tocar código en el clone base**: regla dura — en `hospeda` NO se edita
  código; todo cambio de código va **obligatoriamente** a un worktree.
- **G-8 — Guardado de memoria siempre a hospeda**: todo `mem_save` y toda nota file-based
  se escriben apuntando al proyecto `hospeda`, nunca a un derivado del worktree.
- **G-9 — Memoria unificada aun en worktrees**: resolver el problema técnico de que
  `~/.claude/projects/` deja de fragmentarse por path cuando se trabaja en un worktree.
- **G-10 — Decidir worktree de git vs de Claude**: analizar y elegir el mecanismo de
  aislamiento que mejor soporte G-7/G-8/G-9.

## 3. Análisis del estado actual (detallado)

### 3.1 Memoria file-based

`hospeda` (destino, 58) vs `hospeda2` (68) vs `hospeda3` (7) + 2 sueltas
(`hospeda-apps-web`: 1, `hospeda-spec-143-billing-testing-coverage`: 1) = **77 notas de
origen** a procesar. El mapeo completo (cada nota → MOVER / FUSIONAR / BORRAR-duplicado /
BORRAR-obsoleto) está en el **anexo**. Resumen ejecutivo:

| Acción | Cant. | Qué es |
|--------|-------|--------|
| **MOVER** | 57 | Conocimiento único reutilizable (feedback, gotchas, root-causes). Se portan tal cual. |
| **FUSIONAR** | 6 | Se doblan con una nota existente de hospeda → se funde el contenido, no se crea archivo. |
| **BORRAR-duplicado** | 2 | Ya cubiertas 1:1 por una nota de hospeda (una es byte-idéntica). |
| **BORRAR-obsoleto** | 12 | Estado efímero de specs cerradas o sistemas retirados. |
| **PURGAR en hospeda** | 3 | Notas del propio destino ya obsoletas (numbering local retirado). |

**Resultado**: de un `58 + 77 = 135` ingenuo, quedan **112 notas** depuradas en `hospeda`.

Hallazgos clave del análisis:

- El escaneo por nombre de archivo **pierde ~la mitad** de los duplicados semánticos: la
  regla "no correr tareas pesadas en paralelo" existe en los 3 dirs con 3 nombres
  distintos; una nota es copia byte-a-byte con el mismo `originSessionId`.
- Los nombres tipo `project_specNNN_shipped` **esconden gotchas durables** (override de
  zod scoping, `.d.ts` ambientes, JSONB null-merge, Accept-header rompiendo SSE) — por eso
  MOVER domina (57 de 77): descartar por nombre perdería conocimiento valioso.
- El destino **no siempre está "más adelantado"**: `project_pr2019_oom_stale_tanstack`
  (hospeda2) tiene la conclusión **resuelta** de un incidente que la nota de hospeda dejó
  abierto → el origen debe **sobrescribir**, no sólo anexar.
- **2 contradicciones factuales** a resolver al portar (no reconciliar en silencio):
  1. `AccommodationTypeEnum`: `project_spec214` dice que faltan `apart_hotel/estancia/
     bed_and_breakfast`; el `MEMORY.md` dice que **sí existen** (SPEC-213). → Son reales;
     corregir la línea al portar.
  2. Token MP `TEST-`: `project_api_log_billing_hardening` lo da por válido;
     `gotcha_mercadopago_credentials` dice que **no existe** ese prefijo. → Verificar
     contra código antes de portar.

### 3.2 `.remember/` (historial del plugin)

Ambos clones tienen ~35 archivos (`now.md`, `today-*.md`, `recent.md`, `archive.md`,
`core-memories.md`, `logs/`, `tmp/`). Merge: los `today-*.md` por fecha coexisten sin
conflicto; `archive.md` y `core-memories.md` se **concatenan y depuran duplicados**.
Valor medio (es historial conversacional, no conocimiento estructurado).

### 3.3 `settings.local.json`

**Nada que migrar.** El de `hospeda2` es trivial (sólo `spinnerTipsEnabled`, permisos
vacíos). `hospeda` no tiene uno.

### 3.4 Engram

`mem_search` **ya es cross-project** (busca en todos los proyectos sin filtrar), así que
la memoria semántica de `hospeda2`/`hospeda3`/`hospeda-*` **no se pierde** aunque quede
etiquetada con otro project. El problema es organizativo/cosmético. Ver decisión en §4.

### 3.5 codegraph

Vive sólo en `hospeda` (352M). El `CLAUDE.md` global ya dice "Currently indexed: hospeda",
así que quedarnos con `hospeda` **evita re-indexar**. Falta garantizar que el daemon de
auto-sync esté siempre activo y que la regla de "consultá codegraph primero" se cumpla.

### 3.6 Basura / huérfanos

- Archivo `-` (0 bytes) en `hospeda2` → borrar.
- ~40 project-dirs huérfanos en `~/.claude/projects/` (transcripts de worktrees muertos,
  ~1 GB) → candidatos a archivar/borrar.

## 4. Decisiones técnicas y preguntas abiertas

### 4.1 Worktree de git vs worktree de Claude (G-10)

- **git worktree** (mecanismo actual, skill `worktree` + `wt-create.sh`): crea el worktree
  en `../hospeda-{slug}` (hermano del repo). Path totalmente distinto → **project-dir y
  project de engram separados**. Es la causa directa de la fragmentación.
- **Claude worktree** (`EnterWorktree`/`isolation: worktree`): crea el worktree en
  `hospeda/.claude/worktrees/agent-X`. El path **también** es distinto del repo base
  (`-home-...-hospeda--claude-worktrees-agent-X`), así que **por sí solo tampoco unifica**
  el project-dir.

**Conclusión preliminar**: elegir git-vs-Claude worktree **no alcanza** para G-9; el
problema real es que Claude/engram derivan el project **del path del cwd**. La decisión de
worktree hay que combinarla con un mecanismo de "project key fijo" (§4.2). Se documenta
como **OQ-1**: confirmar durante la implementación cuál de los dos mecanismos permite
forzar un project key estable (ver opciones abajo) con menor fricción.

### 4.2 Cómo unificar el project key aunque se trabaje en worktrees (G-9)

Opciones a evaluar (OQ-2):

1. **Override de project en la config del harness/hook**: investigar si existe un ajuste
   (settings.json / variable / hook `SessionStart`) que fije el project name a `hospeda`
   independientemente del `cwd`. Es la solución ideal si existe.
2. **Redirección por symlink** de los `~/.claude/projects/-...-hospeda-<slug>/memory`
   hacia el `memory/` de `hospeda`. Unifica la memoria file-based pero no los transcripts;
   frágil ante recreación de dirs.
3. **Hook `SessionStart`** que, al abrir sesión en un worktree, apunte el `memory/` y el
   project de engram al canónico `hospeda`.
4. **Convención de trabajo**: no abrir sesiones "sueltas" en subdirs (`apps/web`,
   `apps/api`) — siempre desde la raíz del worktree — para no multiplicar projects.

Para **engram** (G-5/G-8): investigar cómo el plugin deriva el project (parece basename
del `cwd` o del git root); definir si se fuerza vía config del plugin o pasando siempre
`project: "hospeda"` explícito en `mem_save`. Dado que `mem_search` ya es cross-project,
el re-etiquetado masivo de observaciones viejas es **opcional** (bajo valor / riesgo sobre
la SQLite de engram) — se decide en OQ-3.

### 4.3 Regla dura: no tocar código en el clone base (G-7)

- Modificar el `~/.claude/CLAUDE.md` global: pasar de "worktree default-on para specs,
  preguntar para el resto" a **"en `hospeda` NUNCA se edita código; todo cambio de código
  exige un worktree"** (docs de spec siguen permitidos en Fase 1, sin worktree).
- Reforzar con un **hook** (`PreToolUse` sobre Edit/Write) que bloquee ediciones de código
  cuando el `cwd` es el clone base `hospeda` (y/o la rama es `main`/`staging`). OQ-4:
  definir el alcance exacto del bloqueo (por path del repo base vs por rama protegida).

### 4.4 Referencias user-level (G-6)

Barrer `~/.claude/CLAUDE.md`, `~/.claude/rules/*`, y las memorias file-based/engram que
mencionen `hospeda2`/`hospeda3` y reescribirlas a `hospeda`. Incluye actualizar la nota
`project_two_full_clones_hospeda` (que se auto-obsoleta cuando esto termine).

## 5. Plan de trabajo por fases

### Fase 0 — Prerrequisito (bloqueante)

- **T-0**: Confirmar que la **sesión concurrente OOM cerró**. Mientras siga viva, escribe
  memoria en `hospeda2` (`MEMORY.md` cambió durante el análisis) → un merge-snapshot
  perdería lo que agregue después. Bloquea todo lo que toque `hospeda2`.

### Fase 1 — Merge de lo que NO depende de la sesión activa (seguro ya)

- **T-1**: Portar las 4 notas MOVER de `hospeda3` + 1 de la suelta `spec-143` a
  `hospeda/memory/`.
- **T-2**: Aplicar los BORRAR-obsoleto de `hospeda3` (3) + suelta `apps-web` (1).
- **T-3**: Purgar las 3 notas obsoletas propias de `hospeda`.
- **T-4**: Borrar basura (`-` en hospeda2 no bloquea; huérfanos que no sean de hospeda2).

### Fase 2 — Merge de la memoria de hospeda2 (tras Fase 0)

- **T-5**: Portar las 53 notas MOVER de `hospeda2` (con las 2 correcciones factuales).
- **T-6**: Aplicar las 6 FUSIONES (incluida la sobrescritura del OOM resuelto).
- **T-7**: Aplicar los 2 BORRAR-duplicado.
- **T-8**: Reescribir el `MEMORY.md` índice unificado (112 entradas).
- **T-9**: Mergear `.remember/` (concatenar+depurar `archive.md`/`core-memories.md`).

### Fase 3 — Reglas y tooling (G-4/G-6/G-7/G-8/G-9/G-10)

- **T-10**: Actualizar `~/.claude/CLAUDE.md` global: referencias a un solo `hospeda`;
  regla dura "no código en el clone base".
- **T-11**: Hook `PreToolUse` que bloquea edición de código en el clone base (OQ-4).
- **T-12**: Mecanismo de project-key fijo para worktrees (OQ-1/OQ-2) — implementar la
  opción elegida (hook `SessionStart` / override / symlink).
- **T-13**: Garantizar codegraph daemon + regla "consultá codegraph primero".
- **T-14**: Definir política engram (forzar `project: hospeda`; re-etiquetado sí/no).

### Fase 4 — Eliminación del clone sobrante y verificación

- **T-15**: Borrar físicamente `hospeda2` (tras confirmar 0 trabajo sin respaldar).
- **T-16**: Limpiar project-dirs huérfanos de `~/.claude/projects/`.
- **T-17**: Verificación: abrir un worktree nuevo y confirmar que la memoria/engram
  apuntan a `hospeda` y que editar código en el clone base se bloquea.

## 6. Riesgos

- **R-1 (alto)**: Sesión concurrente OOM viva escribiendo en `hospeda2` → merge parcial
  perdería notas. Mitigación: Fase 0 bloqueante.
- **R-2 (medio)**: Borrar el clone `hospeda2` no borra su historial en `~/.claude` ni sus
  observaciones en engram → limpiar aparte (T-16), o quedan como referencia inerte.
- **R-3 (medio)**: Re-etiquetar engram sobre su SQLite puede corromper la base. Mitigación:
  preferir "dejar como está" (cross-project ya funciona) salvo necesidad real.
- **R-4 (bajo)**: Las 2 contradicciones factuales se portan mal si se copian sin criterio.
  Mitigación: T-5 las corrige explícitamente.
- **R-5 (bajo)**: Un hook de bloqueo mal calibrado (T-11) frena trabajo legítimo de docs.
  Mitigación: OQ-4 acota el alcance (código sí, docs/spec no).

## 7. Criterios de aceptación

- Existe **un solo clone** físico (`hospeda`); `hospeda2` y `hospeda3` no existen.
- `hospeda/memory/` tiene **112 notas** depuradas + un `MEMORY.md` índice coherente, sin
  duplicados semánticos ni estado efímero de specs cerradas.
- Editar código con `cwd` en el clone base `hospeda` es **bloqueado** por hook; el mismo
  cambio en un worktree pasa.
- Abrir una sesión en un worktree guarda memoria (file + engram) bajo `hospeda`, no bajo un
  derivado del path.
- codegraph responde en `hospeda` (índice presente + daemon corriendo).
- `~/.claude/CLAUDE.md` global no referencia `hospeda2`/`hospeda3`.

## 8. Preguntas abiertas

- **OQ-1**: ¿git worktree o Claude worktree como mecanismo estándar, dado que ninguno
  unifica el project-dir por sí solo?
- **OQ-2**: ¿Qué mecanismo fija el project key a `hospeda` para worktrees (override /
  hook / symlink)?
- **OQ-3**: ¿Se re-etiquetan las observaciones viejas de engram, o se deja (cross-project
  ya funciona)?
- **OQ-4**: ¿El hook de bloqueo de edición se dispara por path del clone base, por rama
  protegida, o ambos?
