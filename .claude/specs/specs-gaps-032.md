# SPEC-032: Interactive CLI Tool - Gaps & Issues Report

> **Spec**: SPEC-032-interactive-cli-tool
> **Status declarado**: COMPLETED (18/18 tasks)
> **Status real**: INCOMPLETE (14/18 tasks realmente completadas)
> **Auditoria #1**: 2026-03-09 - Analisis exhaustivo spec vs codigo
> **Auditoria #2**: 2026-03-09 - Segunda pasada: bugs funcionales, UX, deduplicacion, imports
> **Auditoria #3**: 2026-03-09 - Tercera pasada: seguridad profunda, cobertura de tests por funcion, calidad de codigo, verificacion spec vs realidad
> **Auditoria #4**: 2026-03-09 - Cuarta pasada: 4 agentes especializados en paralelo (Security Engineer, QA Engineer, Software Architect, Spec Compliance)
> **Auditoria #5**: 2026-03-09 - Quinta pasada: Code Review senior (7-level framework) + Test Coverage Matrix exhaustiva funcion-por-funcion + verificacion cruzada de hallazgos
> **Auditoria #6**: 2026-03-09 - Sexta pasada: Verificacion cruzada codigo-real vs spec vs registry, validacion de scripts root, analisis de testabilidad, UX de modo interactivo

---

## Resumen Ejecutivo

La implementacion del CLI interactivo esta **funcionalmente operativa** (todos los modulos existen y la herramienta funciona), pero tiene **gaps criticos** en testing, seguridad, deduplicacion y robustez. El task state declara 18/18 tareas completadas, lo cual es **incorrecto**.. 3 archivos de test no existen, hay una vulnerabilidad de seguridad en el runner, y los comandos auto-descubiertos generan duplicados visibles al usuario.

### Metricas Clave

| Metrica | Valor | Target Spec |
|---------|-------|-------------|
| Modulos implementados | 11/11 | 11/11 |
| Tests existentes | 7/10 archivos | 10/10 archivos |
| Test cases | 124 | ~200+ estimado |
| Archivos de test faltantes | 3 (discovery, interactive, main) | 0 |
| Vulnerabilidades de seguridad | 1 CRITICA | 0 |
| Bugs funcionales visibles | 2 (deduplicacion, formato) | 0 |
| Cobertura estimada | ~65-70% | 90% minimo |
| Total gaps encontrados | 50 (3 CRITICOS, 8 ALTOS, 24 MEDIOS, 15 BAJOS) | 0 |
| Auditorias realizadas | 6 | - |
| Funciones sin test alguno | 8 (runCommand, formatExecutionInfo, formatDangerWarning, findMonorepoRoot, parseWorkspacePatterns, getPackagePrefix, isExcludedScript, discoverCommands) | 0 |

---

## Gaps Encontrados

### GAP-032-001: [CRITICO] `shell: true` habilita inyeccion de comandos en runner.ts

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: CRITICA
- **Prioridad**: P0 (fix inmediato)
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/runner.ts:97-100`
- **Decision**: ✅ HACER - Opcion A (eliminar `shell: true`)
- **Fecha decision**: 2026-03-09

**Problema**: `spawn()` se invoca con `shell: true`, lo que pasa el comando a `/bin/sh -c`. Esto significa que metacaracteres de shell (`;`, `|`, `&&`, `$()`, backticks) en argumentos o en scripts auto-descubiertos son interpretados literalmente por el shell.

```ts
const child = spawn(command, [...args], {
    stdio: 'inherit',
    shell: true   // <-- PELIGROSO
});
```

**Vector de ataque**: Un `package.json` malformado en un workspace podria tener un script como `"build": "echo pwned; rm -rf /"`. Con auto-discovery activado, este script seria descubierto y ejecutable. Ademas, argumentos pasados via `--` (`pnpm cli test -- '; malicious-command'`) serian interpretados por el shell.

**Solucion propuesta**:

1. **Opcion A (recomendada)**: Eliminar `shell: true`. Los tres tipos de ejecucion (`pnpm-root`, `pnpm-filter`, `shell`) ya producen command + args separados, que es la forma correcta para `spawn` sin shell
2. **Opcion B**: Sanitizar/escapar todos los argumentos antes de pasarlos a spawn

**Impacto de la solucion**: Minimo. Puede requerir ajustar como se resuelve el path de `pnpm` en algunos entornos (ya que sin `shell: true`, el command debe ser resolvible en PATH directamente)

**Recomendacion**: Fix directo en esta SPEC. No requiere spec nueva.

---

### GAP-032-002: [CRITICO] 3 archivos de test requeridos por la spec NO EXISTEN

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: CRITICA
- **Prioridad**: P0
- **Complejidad**: 4/10
- **Decision**: ✅ HACER - Implementar los 3 archivos de test
- **Fecha decision**: 2026-03-09
- **Archivos faltantes**:
  - `scripts/cli/__tests__/discovery.test.ts` (requerido por T-014)
  - `scripts/cli/__tests__/interactive.test.ts` (requerido por T-011)
  - `scripts/cli/__tests__/main.test.ts` (requerido por T-012)

**Problema**: El task state declara T-011, T-012 y T-014 como "completed", pero los archivos de test que estas tareas deben producir **no existen**. Esto viola la regla del proyecto "No tests = not done".

**Funciones sin cobertura**:

| Modulo | LOC | Funciones exportadas sin test |
|--------|-----|-------------------------------|
| discovery.ts | 164 | `parseWorkspacePatterns()`, `getPackagePrefix()`, `isExcludedScript()`, `discoverCommands()` |
| interactive.ts | 157 | `buildChoices()`, `runInteractiveLoop()` |
| main.ts | 48 | `main()` |

**Detalle por archivo faltante**:

#### discovery.test.ts (T-014)
Tests requeridos segun spec:
- `parseWorkspacePatterns` extrae patrones correctos de YAML
- `getPackagePrefix` maneja `@repo/*`, `hospeda-*`, nombres planos
- `isExcludedScript` filtra prepare, preinstall, postinstall
- `isExcludedScript` filtra turbo-orchestrated cuando existe curated
- Integration test: pipeline completo con mock filesystem
- Curated commands toman precedencia, no hay IDs duplicados

#### interactive.test.ts (T-011)
Tests requeridos segun spec:
- `buildChoices` crea estructura correcta con separators
- `buildChoices` incluye seccion recent cuando hay historial
- `buildChoices` omite seccion recent cuando no hay historial
- `buildChoices` agrupa por categoria en display order
- Search source function filtra con Fuse.js correctamente
- Dangerous command confirmation flow
- One-shot vs long-running post-execution behavior

#### main.test.ts (T-012)
Tests requeridos segun spec:
- `main()` rutea a direct mode cuando hay args
- `main()` rutea a interactive mode sin args
- `main()` maneja ExitPromptError gracefully
- `main()` maneja errores inesperados
- Parallel init (discovery + history) completa dentro del budget

**Solucion propuesta**: Implementar los 3 archivos de test. `buildChoices()` es pura y completamente testeable. `runInteractiveLoop()` y `main()` requieren mocks de `@inquirer/prompts` y modulos dependientes.

**Recomendacion**: Fix directo en esta SPEC. Es trabajo pendiente de tareas ya definidas.

---

### GAP-032-003: [ALTO] Falta handler de `error` en spawn que causa leak de signal handlers

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/runner.ts:114-115`
- **Decision**: ✅ HACER
- **Fecha decision**: 2026-03-09

**Problema**: En `runCommand()`, se registran handlers de SIGINT/SIGTERM en el proceso padre (lineas 114-115), y se remueven solo en el handler `close` (lineas 118-119). Pero si el child process emite `error` antes de `close` (ej: `ENOENT` cuando el binario no existe), los handlers nunca se limpian.

En modo interactivo, un usuario puede ejecutar multiples comandos en la misma sesion. Si algun comando falla con `error`, los signal handlers se acumulan hasta que Node emite `MaxListenersExceededWarning` (umbral default: 10).

```ts
// FALTA:
child.on('error', (err) => {
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    console.error(`Failed to start process: ${err.message}`);
    resolve(1);
});
```

**Solucion propuesta**: Agregar handler de `error` que limpie los signal handlers y resuelva con exit code 1.

**Recomendacion**: Fix directo en esta SPEC. Cambio de 5 lineas.

---

### GAP-032-004: [ALTO] Splitting de comandos `shell` rompe con argumentos quoted

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: 3/10
- **Archivo**: `scripts/cli/runner.ts:56`
- **Decision**: ✅ HACER - Opcion C (documentar limitacion en JSDoc, prohibir comillas en registry)
- **Fecha decision**: 2026-03-09

**Problema**: `execution.command.split(' ')` para el tipo `shell` rompe con argumentos que contengan espacios o esten entre comillas.

```ts
case 'shell': {
    const [shellCmd, ...baseArgs] = execution.command.split(' ');
```

Ejemplo: `tsx scripts/create-docs-structure.ts --arg "hello world"` produce `["tsx", "scripts/create-docs-structure.ts", "--arg", '"hello', 'world"']` en vez del array correcto.

**Estado actual**: Los comandos `shell` registrados son simples (`./scripts/dev.sh`, `node scripts/dev-admin.js`), pero es un bug latente que explotara cuando se agreguen comandos mas complejos.

**Solucion propuesta**:
1. **Opcion A**: Usar `/\s+/` como regex de split (arregla espacios multiples pero no quoted args)
2. **Opcion B**: Implementar tokenizer basico que respete comillas
3. **Opcion C**: Documentar la limitacion y prohibir comillas en comandos shell del registry

**Recomendacion**: Fix directo en esta SPEC. Opcion C es la mas practica dado que controlamos el registry.

---

### GAP-032-005: [ALTO] Validacion de entries del historial es insuficiente

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P2
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/history.ts:56-65`
- **Decision**: ✅ HACER
- **Fecha decision**: 2026-03-09

**Problema**: `readHistory()` valida que `entries` sea un array, pero NO valida la estructura de cada entry individual. Un archivo corrupto con `{ version: 1, entries: [null, 42, "string"] }` seria aceptado y casteado a `CliHistory`. El codigo downstream accede `e.id`, `e.lastRun`, `e.runCount` sin null checks, causando runtime errors.

**Solucion propuesta**:
```ts
const isValidEntry = (e: unknown): e is CliHistoryEntry =>
    typeof e === 'object' && e !== null &&
    typeof (e as Record<string, unknown>).id === 'string' &&
    typeof (e as Record<string, unknown>).lastRun === 'string' &&
    typeof (e as Record<string, unknown>).runCount === 'number';

// En readHistory():
return { version: 1, entries: (parsed.entries as unknown[]).filter(isValidEntry) };
```

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-006: [ALTO] Cobertura de dangerous commands incompleta en el registry

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P2
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/registry.ts`
- **Decision**: ✅ HACER - Agregar dangerous a db:push y env:push, clarificar db:seed
- **Fecha decision**: 2026-03-09

**Problema**: Hay comandos que modifican estado significativo pero no tienen `dangerous: true`:

| Comando | Descripcion | Riesgo |
|---------|-------------|--------|
| `db:push` | Push schema directly (no migration) | Puede causar schema drift o perdida de datos en BD activa |
| `env:push` | Push local env vars to Vercel | Sobrescribe variables de entorno de produccion |
| `db:seed` | Seed database | Si trunca tablas antes de seed, es destructivo |

**Solucion propuesta**: Agregar `dangerous: true` con `dangerMessage` apropiado a `db:push` y `env:push`. Clarificar descripcion de `db:seed`.

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-007: [MEDIO] `findMonorepoRoot` es fragil y esta en el modulo incorrecto

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 3/10
- **Archivo**: `scripts/cli/history.ts:31-35`
- **Decision**: ✅ HACER - Mover a utils.ts, detectar por marker file, unificar imports
- **Fecha decision**: 2026-03-09

**Problema doble**:

1. **Fragilidad**: Hardcodea "2 niveles arriba" (`join(thisDir, '..', '..')`) sin validar que el path resuelto sea realmente el root del monorepo. Si el archivo se mueve o se compila a un directorio diferente (ej: `dist/scripts/cli/`), se rompe silenciosamente.

2. **Ubicacion incorrecta**: `findMonorepoRoot` esta en `history.ts` pero se importa desde `main.ts` (acoplamiento sorpresivo). Deberia estar en un modulo util separado.

3. **Import duplicado en main.ts**:
```ts
import { readHistory } from './history.js';
import { findMonorepoRoot } from './history.js';
```
Deberian ser un solo import statement.

**Solucion propuesta**:
1. Mover `findMonorepoRoot` a un nuevo `utils.ts`
2. Usar deteccion por marker file (`pnpm-workspace.yaml`) subiendo directorios
3. Unificar imports en `main.ts`

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-008: [MEDIO] Parametro muerto `_categories` en buildChoices

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/interactive.ts:21-25`
- **Decision**: ✅ HACER
- **Fecha decision**: 2026-03-09

**Problema**: `_categories?: undefined` es un parametro que solo puede ser `undefined`. Es dead code que contamina la API publica.

```ts
export function buildChoices({
    commands,
    recentIds,
    _categories     // <-- DEAD CODE
}: {
    commands: readonly CliCommand[];
    recentIds: readonly string[];
    _categories?: undefined;  // <-- Solo puede ser undefined
}): SearchItem[] {
```

**Solucion propuesta**: Eliminar el parametro.

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-009: [MEDIO] Type system permite `dangerous: true` sin `dangerMessage`

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/types.ts:36-38`
- **Decision**: ✅ HACER - Discriminated union
- **Fecha decision**: 2026-03-09

**Problema**: Ambos campos son opcionales e independientes, lo que permite crear un comando con `dangerous: true` pero sin `dangerMessage`. `formatDangerWarning` renderizaria `undefined` como texto del mensaje.

```ts
readonly dangerous?: boolean;
readonly dangerMessage?: string;
```

**Solucion propuesta**: Usar discriminated union:
```ts
| { readonly dangerous?: false; readonly dangerMessage?: never }
| { readonly dangerous: true; readonly dangerMessage: string }
```

**Recomendacion**: Fix directo en esta SPEC. Mejora la type safety sin cambiar comportamiento.

---

### GAP-032-010: [MEDIO] Race condition en operaciones de archivo de historial

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 3/10
- **Archivo**: `scripts/cli/history.ts:90-118`
- **Decision**: ✅ HACER - Opcion B (documentar como known limitation en JSDoc)
- **Fecha decision**: 2026-03-09

**Problema**: `recordCommand` hace read-modify-write sin locking. Si dos terminales ejecutan la CLI simultaneamente, el ultimo writer gana y la actualizacion anterior se pierde silenciosamente. El atomic rename previene lecturas corruptas pero no el race condition de datos.

**Solucion propuesta**:
1. **Opcion A**: Usar file lock (ej: `proper-lockfile`)
2. **Opcion B**: Documentar la limitacion como "known issue" (impacto bajo para tool de desarrollo)

**Recomendacion**: Documentar como known limitation. El impacto es minimo para una herramienta de desarrollo local.

---

### GAP-032-011: [BAJO] Version hardcodeada en format.ts

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/format.ts:4`
- **Decision**: ✅ HACER - Leer version del package.json root
- **Fecha decision**: 2026-03-09

**Problema**: `const CLI_VERSION = '1.0.0'` esta hardcodeado y divergira del version real si se bump.

**Solucion propuesta**: Leer version del `package.json` root en runtime o en build time.

**Recomendacion**: Postergar. No afecta funcionalidad.

---

### GAP-032-012: [BAJO] Parser YAML es simplista y no documenta limitaciones

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/discovery.ts:31`
- **Decision**: ✅ HACER - Documentar limitaciones en JSDoc, corregir comentario
- **Fecha decision**: 2026-03-09

**Problema**: El parser de `pnpm-workspace.yaml` usa split+prefix matching y no maneja:
- YAML anchors
- Multi-line values
- Block scalars
- Inline arrays (`packages: [apps/*, packages/*]`)

El comentario dice "Uses regex" pero el codigo no usa regex sino string parsing. Ademas el comment dice "to avoid a YAML library dependency" pero no documenta las limitaciones.

**Estado actual**: El formato standard de `pnpm-workspace.yaml` es simple y el parser cubre el caso comun. Es un riesgo latente muy bajo.

**Solucion propuesta**:
1. Documentar limitaciones en JSDoc
2. Corregir el comentario ("string parsing" no "regex")
3. Opcionalmente, agregar manejo de inline arrays

**Recomendacion**: Postergar. El formato actual de pnpm-workspace.yaml del proyecto es compatible.

---

### GAP-032-013: [BAJO] Numero magico 48 en interactive.ts

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/interactive.ts:51`
- **Decision**: ✅ HACER - Extraer a constante SEPARATOR_FILL_WIDTH
- **Fecha decision**: 2026-03-09

**Problema**: `'─'.repeat(Math.max(0, 48 - label.length))` usa un magic number sin nombre.

**Solucion propuesta**: Extraer a constante `SEPARATOR_FILL_WIDTH = 48`.

**Recomendacion**: Fix directo si se tocan otros issues del mismo archivo.

---

### GAP-032-014: [INFO] Task state inexacto - 4 tareas marcadas incorrectamente como completed

- **Auditoria**: #1 (2026-03-09)
- **Severidad**: INFO (governance)
- **Prioridad**: P1 (para integridad del sistema de tareas)
- **Complejidad**: 1/10
- **Archivo**: `.claude/tasks/SPEC-032-interactive-cli-tool/state.json`
- **Decision**: ✅ HACER - Corregir task state para reflejar realidad
- **Fecha decision**: 2026-03-09

**Problema**: Las siguientes tareas estan marcadas como "completed" pero no cumplen con sus criterios de aceptacion:

| Task | Motivo |
|------|--------|
| T-005 (Discovery implementation) | Implementation OK, pero T-014 (sus tests) no existe |
| T-011 (Interactive mode) | Implementation OK, pero no hay interactive.test.ts |
| T-012 (Main entry) | Implementation OK, pero no hay main.test.ts |
| T-014 (Test Discovery) | discovery.test.ts NO EXISTE |

**Solucion propuesta**: Actualizar task state a reflect realidad:
- T-005: completed (la implementacion si esta, tests son T-014)
- T-011: in_progress (requiere tests de buildChoices)
- T-012: in_progress (requiere tests de main)
- T-014: pending (archivo de test no existe)

**Recomendacion**: Corregir inmediatamente para mantener integridad del task system.

---

## Aspectos Positivos (lo que esta bien)

Para ser justo con la implementacion, estos son los puntos fuertes:

- **Arquitectura modular** excelente: 11 modulos con responsabilidad unica
- **RO-RO pattern** consistente en todas las funciones exportadas
- **Discriminated union** en CommandExecution bien disenado
- **Atomic writes** en historial correctamente implementados
- **Signal handling** sigue convenciones Unix (130/143)
- **ExitPromptError** manejado en ambos niveles (main + interactive)
- **JSDoc** comprehensivo en la mayoria de funciones exportadas
- ~~**Deduplicacion** curated vs discovered bien implementada~~ (refutado en Auditoria #2 - ver GAP-015)
- **Fuse.js config** bien tuneada (ignoreLocation, minMatchCharLength, ignoreDiacritics)
- **Tests existentes** siguen AAA pattern de forma impecable
- **Calidad de codigo** muy alta en general, TypeScript strict sin any
- **Biome override** correctamente configurado en `packages/biome-config/biome.json` para `scripts/cli/**`
- **.gitignore** incluye `.cli-history.json` correctamente

---

## Gaps Encontrados en Auditoria #2 (2026-03-09)

### GAP-032-015: [CRITICO] Deduplicacion rota: comandos duplicados en --list-all y search

- **Auditoria**: #2 (2026-03-09)
- **Severidad**: CRITICA
- **Prioridad**: P0 (bug funcional visible al usuario)
- **Complejidad**: 3/10
- **Archivo**: `scripts/cli/discovery.ts:147-149`
- **Decision**: ✅ HACER - Opcion A (comparar por ejecucion subyacente, no por ID)
- **Fecha decision**: 2026-03-09

**Problema**: La logica de deduplicacion compara IDs literalmente, pero los IDs curated y discovered se construyen de forma diferente para el MISMO comando subyacente. El resultado es que `pnpm cli --list-all` muestra comandos duplicados que ejecutan exactamente lo mismo.

**Evidencia real** (output de `pnpm cli --list-all`):

```
# Curated                              vs  Discovered (DUPLICADO)
seed:required   (curated, @repo/seed)  →  seed:seed:required  (discovered, @repo/seed)
seed:example    (curated, @repo/seed)  →  seed:seed:example   (discovered, @repo/seed)
seed            (curated, @repo/seed)  →  seed:seed           (discovered, @repo/seed)
db:push         (curated, @repo/db)    →  db:db:push          (discovered, @repo/db)
db:studio       (curated, root)        →  db:db:studio        (discovered, @repo/db)
db:migrate      (curated, root)        →  db:db:migrate       (discovered, @repo/db)
```

**Causa raiz**: En `discovery.ts:147`:
```ts
const commandId = prefix === 'hospeda' ? scriptName : `${prefix}:${scriptName}`;
```

Para `@repo/seed` (prefix=`seed`) con script `seed:required`, el ID descubierto es `seed:seed:required`. Pero el curated ID es `seed:required`. La comparacion `curatedIds.has('seed:seed:required')` falla.

**Solucion propuesta**:

1. **Opcion A (recomendada)**: Comparar por ejecucion subyacente, no por ID. Antes de agregar un discovered command, verificar si ya existe un curated command con la misma execution (filter + script):
   ```ts
   const alreadyCurated = curatedCommands.some(c =>
       c.execution.type === 'pnpm-filter' &&
       c.execution.filter === pkgName &&
       c.execution.script === scriptName
   );
   if (alreadyCurated) continue;
   ```
2. **Opcion B**: Normalizar IDs antes de comparar (strip double-prefix)
3. **Opcion C**: Agregar los script names de los curated pnpm-filter commands al set de exclusion

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-016: [ALTO] IDs largos overflow el padding fijo causando output corrupto

- **Auditoria**: #2 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/format.ts:14, 92-98`
- **Decision**: ✅ HACER - Opcion A (padding dinamico basado en ID mas largo)
- **Fecha decision**: 2026-03-09

**Problema**: `ID_PAD = 22` es insuficiente para IDs auto-descubiertos largos. Cuando el ID excede 22 chars, `.padEnd(22)` no agrega padding y el ID se concatena directamente con la descripcion sin espacio.

**Evidencia real** (output de `pnpm cli --list-all`):

```
seed:migrate:accommodation-pricesmigrate:accommodation-prices (@repo/seed)         [@repo/seed]
seed:validate:accommodationsvalidate:accommodations (@repo/seed)              [@repo/seed]
```

Los IDs `seed:migrate:accommodation-prices` (35 chars) y `seed:validate:accommodations` (29 chars) exceden el padding de 22 y se fusionan visualmente con la descripcion.

**Solucion propuesta**:

1. **Opcion A (recomendada)**: Calcular el padding dinamicamente basado en el ID mas largo del conjunto actual:
   ```ts
   const maxIdLen = Math.max(...commands.map(c => c.id.length)) + 2;
   ```
2. **Opcion B**: Aumentar `ID_PAD` a un valor mas seguro (ej: 40)
3. **Opcion C**: Truncar IDs largos con `...` (ej: `seed:migrate:accommo...`)

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-017: [MEDIO] Imports dinamicos inconsistentes de @inquirer/prompts

- **Auditoria**: #2 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/interactive.ts:1, 99, 129` y `scripts/cli/direct.ts:131, 163`
- **Decision**: ✅ HACER - Unificar a imports estaticos
- **Fecha decision**: 2026-03-09

**Problema**: `search` y `Separator` se importan estaticamente al top de `interactive.ts` (linea 1), pero `confirm` e `input` se importan dinamicamente dentro de las funciones (lineas 99 y 129). En `direct.ts`, `input` y `confirm` tambien son imports dinamicos.

```ts
// ESTATICO (top level)
import { Separator, search } from '@inquirer/prompts';

// DINAMICO (dentro de funcion)
const { confirm } = await import('@inquirer/prompts');
const { input } = await import('@inquirer/prompts');
```

Esto es inconsistente. Dado que `search` ya se importa estaticamente, todo el modulo `@inquirer/prompts` se carga al inicio de todas formas, haciendo que los imports dinamicos sean overhead sin beneficio.

**Solucion propuesta**: Mover todos los imports de `@inquirer/prompts` a imports estaticos al top del archivo.

**Recomendacion**: Fix directo si se tocan estos archivos por otros gaps.

---

### GAP-032-018: [MEDIO] No existen tests de performance budget

- **Auditoria**: #2 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 3/10
- **Archivo**: Spec Section 6.4
- **Decision**: ✅ HACER - Incluir como suite en tests de GAP-002
- **Fecha decision**: 2026-03-09

**Problema**: La spec define budgets de performance:
- Startup time < 500ms
- Search latency < 50ms per keystroke

No existen tests que validen estos budgets. El test runner reporta 450ms de duracion total (transform + tests), lo que sugiere que el startup esta dentro del budget, pero esto no esta verificado explicitamente.

**Solucion propuesta**: Agregar un test basico de benchmark:
```ts
it('should startup within 500ms budget', async () => {
    const start = performance.now();
    const curated = getCuratedCommands();
    const fuse = createSearchIndex({ commands: curated });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
});
```

**Recomendacion**: Incluir en los tests faltantes de GAP-002 como suite separada.

---

### GAP-032-019: [MEDIO] `inferCategory` no cubre patrones de env y docs

- **Auditoria**: #2 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/categories.ts:60-81`
- **Decision**: ✅ HACER - Agregar 3 reglas de matching
- **Fecha decision**: 2026-03-09

**Problema**: La funcion `inferCategory` no tiene reglas para:
- `env:*` → deberia ser `environment`
- `docs:*` → deberia ser `documentation`
- `setup*` → deberia ser `infrastructure`

Esto no afecta a los comandos curated (ya tienen categoria asignada manualmente), pero los comandos auto-descubiertos que matcheen estos patrones caen al default `package-tools`, que es incorrecto.

**Ejemplo**: Si un paquete tuviera un script `env:validate`, seria categorizado como `package-tools` en vez de `environment`.

**Solucion propuesta**: Agregar reglas:
```ts
if (scriptName.startsWith('env:') || scriptName.startsWith('env')) return 'environment';
if (scriptName.startsWith('docs:') || scriptName.startsWith('doc')) return 'documentation';
if (scriptName.startsWith('setup')) return 'infrastructure';
```

**Recomendacion**: Fix directo en esta SPEC. Cambio de 3 lineas.

---

### GAP-032-020: [BAJO] `discovery.ts` comment dice "regex" pero usa string parsing

- **Auditoria**: #2 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/discovery.ts:29`
- **Decision**: ✅ HACER - Corregir comentario (subsumido por GAP-012)
- **Fecha decision**: 2026-03-09

**Problema**: El JSDoc dice "Uses regex to avoid a YAML library dependency" pero el codigo realmente usa `split('\n')` + `startsWith()` (string parsing, no regex). El unico regex en la funcion es `.replace(/^['"]|['"]$/g, '')` para strip comillas.

**Solucion propuesta**: Corregir comentario a "Uses simple string parsing to avoid a YAML library dependency."

**Recomendacion**: Fix trivial si se toca el archivo.

---

## Resumen Actualizado por Prioridad (Post Auditoria #2)

### P0 - Fix Inmediato (bloqueantes)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 001 | shell injection en runner.ts | CRITICA | 1 | #1 | Fix directo |
| 002 | 3 archivos de test faltantes | CRITICA | 4 | #1 | Fix directo |
| 015 | Deduplicacion rota en discovery | CRITICA | 3 | #2 | Fix directo |

### P1 - Fix Pronto (alto impacto)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 003 | Leak de signal handlers | ALTA | 2 | #1 | Fix directo |
| 004 | Shell command splitting | ALTA | 3 | #1 | Fix directo |
| 014 | Task state inexacto | INFO | 1 | #1 | Fix directo |
| 016 | ID overflow en formato | ALTA | 2 | #2 | Fix directo |

### P2 - Fix Planificado

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 005 | History entry validation | ALTA | 2 | #1 | Fix directo |
| 006 | Dangerous commands coverage | ALTA | 1 | #1 | Fix directo |
| 007 | findMonorepoRoot fragil | MEDIA | 3 | #1 | Fix directo |

### P3 - Mejoras

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 008 | Dead parameter _categories | MEDIA | 1 | #1 | Fix directo |
| 009 | Type safety dangerous/dangerMessage | MEDIA | 2 | #1 | Fix directo |
| 010 | Race condition historial | MEDIA | 3 | #1 | Documentar |
| 017 | Dynamic imports inconsistentes | MEDIA | 1 | #2 | Fix si se toca |
| 018 | No performance tests | MEDIA | 3 | #2 | Incluir en GAP-002 |
| 019 | inferCategory incompleto | MEDIA | 1 | #2 | Fix directo |

### P4 - Postergar

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 011 | Version hardcodeada | BAJA | 1 | #1 | Postergar |
| 012 | YAML parser limitaciones | BAJA | 2 | #1 | Postergar |
| 013 | Magic number 48 | BAJA | 1 | #1 | Fix si se toca |
| 020 | Comment incorrecto "regex" | BAJA | 1 | #2 | Fix trivial |

---

## Recomendacion General (Actualizada Post Auditoria #2)

**No se necesita una SPEC nueva**. Todos los gaps P0-P3 son correcciones dentro del alcance de SPEC-032. Se recomienda:

1. **Reabrir SPEC-032** cambiando status a `in-progress`
2. **Crear tareas nuevas o reabrir existentes**:
   - **T-NEW-1 [P0]**: Fix deduplicacion en discovery.ts (GAP-015)
   - **T-014 [reabrir, P0]**: Implementar `discovery.test.ts`
   - **T-011 [reabrir, P0]**: Implementar `interactive.test.ts` (al menos `buildChoices`)
   - **T-012 [reabrir, P0]**: Implementar `main.test.ts`
   - **T-NEW-2 [P0]**: Fix `shell: true` en runner.ts (GAP-001)
   - **T-NEW-3 [P1]**: Hardening runner (GAPs 003, 004, 016)
   - **T-NEW-4 [P2]**: Hardening types/registry/history (GAPs 005, 006, 007, 008, 009, 019)
3. Corregir task state para reflejar realidad (GAP-014)

**Esfuerzo estimado total**: ~8-10 horas de trabajo (actualizado post auditoria #3).
**Gaps totales**: 27 (3 CRITICOS, 6 ALTOS, 11 MEDIOS, 7 BAJOS)

---

## Gaps Encontrados en Auditoria #3 (2026-03-09)

> Tercera pasada realizada con 4 agentes especializados en paralelo:
> - **Security Engineer**: Auditoria de seguridad exhaustiva (inyeccion, traversal, DoS, leaks)
> - **QA Engineer**: Analisis de cobertura funcion-por-funcion con inventario de edge cases
> - **Software Architect**: Compliance spec vs codigo, type safety, biome, arquitectura
> - **Tech Lead**: Verificacion task state vs realidad, discrepancias spec/implementacion

### GAP-032-021: [ALTO] `runCommand()` no tiene tests - runner.test.ts solo cubre `buildSpawnArgs()`

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: 3/10
- **Archivo**: `scripts/cli/__tests__/runner.test.ts`
- **Decision**: ✅ HACER - Agregar tests de runCommand() con mocks de spawn
- **Fecha decision**: 2026-03-09

**Problema**: `runner.test.ts` existe y pasa 14 tests, pero TODOS son para `buildSpawnArgs()`. La funcion `runCommand()` (que contiene el `spawn`, signal handling, exit code mapping) tiene **cero cobertura de tests**. Esto es critico porque `runCommand()` es donde residen los gaps GAP-001 (shell: true) y GAP-003 (signal handler leak).

**Funciones sin test en runner.ts**:
- `runCommand()` lineas 83-137: spawn, stdio, shell: true, signal forwarding, exit code mapping
- SIGINT handler: linea 103
- SIGTERM handler: linea 107
- Exit code mapping: lineas 121-133 (null signal handling)

**Tests necesarios**:
```
- spawn llamado con argumentos correctos
- stdio: 'inherit' configurado
- shell: true presente (para luego validar fix GAP-001)
- SIGINT forwarding produce exit code 130
- SIGTERM forwarding produce exit code 143
- Senial desconocida produce exit code 1
- Exit code 0 normal
- Exit code non-zero propagado
- ENOENT error cuando binario no existe
- Signal handlers se limpian despues de child close
```

**Solucion propuesta**: Agregar tests para `runCommand()` usando mocks de `child_process.spawn`. Requiere mock de ChildProcess que emita eventos `close` y `error`.

**Recomendacion**: Fix directo en esta SPEC. Incluir en T-016 (test runner).

---

### GAP-032-022: [MEDIO] `formatExecutionInfo()` y `formatDangerWarning()` sin tests

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/__tests__/format.test.ts`
- **Decision**: ✅ HACER - Agregar tests al format.test.ts existente
- **Fecha decision**: 2026-03-09

**Problema**: `format.test.ts` cubre `formatBanner`, `formatCommandLine`, `formatHelp`, `formatList`, y `formatResult` (26 tests), pero omite:

1. **`formatExecutionInfo()`**: Muestra info pre-ejecucion (command ID, directory, argHint). Funcion publica exportada sin test.
2. **`formatDangerWarning()`**: Muestra warning amarillo para dangerous commands. Funcion publica exportada sin test.

**Tests necesarios**:
```
formatExecutionInfo:
- Muestra command ID correctamente
- Muestra working directory (process.cwd())
- Incluye argHint cuando esta definido
- Omite argHint cuando es undefined
- Muestra shell command para tipo 'shell'
- Muestra pnpm run <script> para tipo 'pnpm-root'

formatDangerWarning:
- Incluye prefijo WARNING
- Incluye dangerMessage del comando
- Usa colores amarillo/bold correctos
```

**Solucion propuesta**: Agregar tests al `format.test.ts` existente.

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-023: [MEDIO] `findMonorepoRoot()` sin tests y sin validacion

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/history.ts:31-35`
- **Decision**: ✅ HACER - Tests post-refactor de GAP-007
- **Fecha decision**: 2026-03-09

**Problema**: `findMonorepoRoot()` es una funcion publica exportada que calcula el root del monorepo hardcodeando "2 niveles arriba". No tiene NINGUN test. Combinado con GAP-007 (fragilidad del approach), esto es una funcion critica no validada.

**Diferencia con GAP-007**: GAP-007 identifica la fragilidad del approach. Este gap se enfoca en la falta total de tests.

**Tests necesarios**:
```
- Retorna un string que es un path absoluto
- El path retornado contiene package.json
- El path retornado contiene pnpm-workspace.yaml
- El path es consistente entre llamadas multiples
```

**Solucion propuesta**: Agregar tests basicos de smoke que validen que el root resuelto es realmente el monorepo root.

**Recomendacion**: Fix directo, incluir en los tests de history (T-015) o en el nuevo `main.test.ts`.

---

### GAP-032-024: [MEDIO] Path traversal en workspace patterns no validado

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/discovery.ts:114-115, 122`
- **Decision**: ✅ HACER - Defensa en profundidad, 3 lineas
- **Fecha decision**: 2026-03-09

**Problema**: Los patrones parseados de `pnpm-workspace.yaml` se usan directamente en glob sin validacion. Un pattern como `../../etc/` o un path absoluto `/tmp/hostile/` seria aceptado y globbeado, descubriendo packages fuera del monorepo.

**Vector de ataque**: En un escenario de supply chain (un contribuidor malicioso modifica pnpm-workspace.yaml), el CLI descubriria y ofreceria ejecutar scripts de directorios arbitrarios del filesystem.

**Nota**: El riesgo real es bajo porque:
1. `pnpm-workspace.yaml` esta bajo version control
2. El CLI es una herramienta de desarrollo local
3. Un atacante que modifica workspace.yaml ya tiene acceso al repo

**Solucion propuesta**:
```ts
// En parseWorkspacePatterns(), validar cada pattern:
if (pattern.startsWith('/') || pattern.includes('..')) {
    console.warn(`Skipping unsafe workspace pattern: ${pattern}`);
    continue;
}
```

**Recomendacion**: Fix directo, 3 lineas de codigo. Defensa en profundidad.

---

### GAP-032-025: [MEDIO] DoS por query de busqueda excesivamente larga

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/search.ts:64-79`
- **Decision**: ✅ HACER - Agregar guard de longitud maxima
- **Fecha decision**: 2026-03-09

**Problema**: `searchCommands()` pasa el query directamente a `fuse.search()` sin limitar longitud. Un query de 100K+ caracteres causaria una desaceleracion notable en Fuse.js (fuzzy matching es O(n*m) donde m es la longitud del query).

**Vector**: `pnpm cli "$(python3 -c 'print("a" * 100000)')"` causaria un hang temporal.

**Impacto**: Bajo (herramienta local, el usuario se ataca a si mismo). Pero viola el principio de input validation.

**Solucion propuesta**:
```ts
if (query.trim().length === 0 || query.length > 200) {
    return [];
}
```

**Recomendacion**: Fix directo si se toca search.ts por otros motivos.

---

### GAP-032-026: [BAJO] Command ID no validado permite ANSI injection en output

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/direct.ts:116`
- **Decision**: ✅ HACER - Validar commandId antes de imprimir
- **Fecha decision**: 2026-03-09

**Problema**: El command ID del usuario se imprime sin sanitizar:
```ts
console.log(`Command '${args.commandId}' not found. No similar commands found.`);
```

Si el usuario pasa un command ID con ANSI escape codes, estos se renderizarian en la terminal, potencialmente ocultando texto o cambiando colores.

**Impacto**: Muy bajo (el usuario se ataca a si mismo). Es mas una cuestion de higiene de codigo.

**Solucion propuesta**: Stripear ANSI codes del commandId antes de imprimirlo, o validar que sea alfanumerico + colons.

**Recomendacion**: Postergar. Impacto negligible.

---

### GAP-032-027: [BAJO] ExitPromptError detection fragil y duplicada

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivos**: `scripts/cli/main.ts:36-47`, `scripts/cli/interactive.ts:134-142`
- **Decision**: ✅ HACER - Crear type guard reutilizable isExitPromptError()
- **Fecha decision**: 2026-03-09

**Problema**: La deteccion de `ExitPromptError` se hace via duck-typing del `name` property en dos lugares diferentes con logica ligeramente distinta:

```ts
// main.ts - swallows non-ExitPromptError, exits 1
if (error.name === 'ExitPromptError') { process.exit(0); }
console.error('Unexpected error:', error);
process.exit(1);

// interactive.ts - rethrows non-ExitPromptError
if (error.name === 'ExitPromptError') { return; }
throw error;
```

Problemas:
1. **Duplicacion**: La misma logica de deteccion en 2 lugares
2. **Fragilidad**: Si `@inquirer/prompts` cambia el nombre del error, ambos fallan silenciosamente
3. **Inconsistencia**: main.ts swallows errors inesperados, interactive.ts los relanza

**Solucion propuesta**:
1. Crear un type guard reutilizable: `function isExitPromptError(error: unknown): boolean`
2. Importar `ExitPromptError` de `@inquirer/prompts` si lo exportan (verificar)
3. Centralizar en un solo lugar

**Recomendacion**: Fix directo, mejora mantenibilidad.

---

### GAP-032-028: [BAJO] Edge cases no cubiertos en tests existentes

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivos**: Varios test files
- **Decision**: ✅ HACER - Agregar edge cases a tests existentes
- **Fecha decision**: 2026-03-09

**Problema**: El analisis funcion-por-funcion revelo edge cases no testeados en modulos que SI tienen tests:

**categories.test.ts** (5 edge cases faltantes):
- scriptName vacio ('')
- scriptName con mayusculas ('Dev', 'BUILD')
- Prioridad de patrones ('db:migrate' vs 'migrate')

**search.test.ts** (4 edge cases faltantes):
- Diacritics handling (`migración` matchea `migracion`) - configurado en Fuse pero no testeado
- minMatchCharLength=2 enforcement (query de 1 char debe retornar [])
- Query con caracteres especiales ('@repo', './')
- createSearchIndex con commands vacio

**history.test.ts** (3 edge cases faltantes):
- HISTORY_FILE y MAX_ENTRIES constantes validadas
- ISO timestamp format validation
- File permission errors

**direct.test.ts** (4 edge cases faltantes):
- Danger confirmation: --yes bypasses, rejected returns 0
- Similarity search: user input NaN/out of range

**Solucion propuesta**: Agregar estos edge cases a los test files existentes (~25-30 tests adicionales).

**Recomendacion**: Incluir como parte del esfuerzo de GAP-002 (completar cobertura).

---

### GAP-032-029: [BAJO] Info disclosure via paths absolutos en warnings

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/discovery.ts:131`
- **Decision**: ✅ HACER - Usar path relativo al monorepo root
- **Fecha decision**: 2026-03-09

**Problema**: `console.warn('Warning: Could not read ${pkgPath}')` muestra el path absoluto completo del filesystem. En un entorno CI/CD donde los logs son publicos, esto podria revelar la estructura del filesystem del build server.

**Impacto**: Muy bajo para herramienta de desarrollo local.

**Solucion propuesta**: Usar path relativo al monorepo root.

**Recomendacion**: Postergar.

---

### GAP-032-030: [BAJO] Cobertura real estimada es ~62%, no ~65-70%

- **Auditoria**: #3 (2026-03-09)
- **Severidad**: BAJA (correccion de metricas)
- **Prioridad**: INFO
- **Complejidad**: N/A
- **Decision**: ℹ️ INFORMATIVO - Se resuelve con gaps de testing (002, 021, 022, 023, 028)
- **Fecha decision**: 2026-03-09

**Problema**: El analisis funcion-por-funcion detallado revela una cobertura mas baja que la estimada inicialmente:

| Archivo | LOC | Cobertura Estimada A2 | Cobertura Real A3 | Nota |
|---------|-----|-----------------------|-------------------|------|
| main.ts | 49 | 0% | 0% | Sin tests |
| discovery.ts | 165 | 0% | 0% | Sin tests |
| interactive.ts | 158 | 0% | 0% | Sin tests |
| runner.ts | 137 | ~60% | ~40% | runCommand() sin tests (50% del LOC) |
| format.ts | 179 | ~70% | ~65% | formatExecutionInfo/DangerWarning sin tests |
| history.ts | 150 | ~80% | ~70% | findMonorepoRoot sin tests |
| direct.ts | 190 | ~75% | ~70% | Danger/similarity branches parciales |
| registry.ts | 451 | ~80% | ~80% | Data validation OK |
| categories.ts | 109 | ~90% | ~90% | Bien cubierto |
| search.ts | 80 | ~85% | ~85% | Bien cubierto |
| types.ts | 66 | 100% | 100% | Solo tipos |

**Cobertura ponderada total estimada**: ~62% (target spec: 90%)

**Recomendacion**: Informativo. La cobertura se corregira al resolver GAPs 002, 021, 022, 023.

---

## Gaps Encontrados en Auditoria #4 (2026-03-09)

> Cuarta pasada con 4 agentes especializados ejecutados en paralelo:
> - **Security Engineer**: Auditoria de seguridad exhaustiva con vectores de ataque y PoC
> - **QA Engineer**: Analisis de calidad de codigo y cobertura funcion-por-funcion
> - **Software Architect**: Compliance spec vs codigo con matriz de 94 requisitos
> - **Spec Compliance**: Verificacion de cada requisito de la spec con PASS/FAIL/PARTIAL

### GAP-032-031: [ALTO] history.test.ts testea funciones DUPLICADAS, no el modulo real

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: 3/10
- **Decision**: ✅ HACER - Refactorizar funciones reales para aceptar rootDir, eliminar duplicados del test
- **Fecha decision**: 2026-03-09
- **Archivo**: `scripts/cli/__tests__/history.test.ts`

**Problema**: Los tests de history no importan ni testean las funciones reales `readHistory()` y `recordCommand()` del modulo `history.ts`. En su lugar, el archivo de test define funciones locales duplicadas `readFromDir()` y `recordInDir()` que replican la logica internamente. Esto significa que si el modulo real cambia (fix de bugs, refactoring), los tests seguirian pasando sin detectar regresiones.

**Impacto**: Los 20 tests de history dan una falsa sensacion de cobertura. Las funciones reales exportadas (`readHistory`, `recordCommand`) tienen efectivamente 0% de cobertura real, a pesar de que el test file existe y pasa.

**Funciones afectadas**:
- `readHistory()` (history.ts:47) - usa `findMonorepoRoot()` internamente
- `recordCommand()` (history.ts:87) - usa `findMonorepoRoot()` internamente
- `getRecentCommands()` (history.ts:123) - probablemente tambien afectada

**Causa raiz**: `findMonorepoRoot()` hardcodea paths relativos que no funcionan en el contexto de ejecucion de tests, asi que se crearon duplicados que aceptan un directorio parametrizable. La solucion correcta era hacer que las funciones reales acepten un `rootDir` opcional.

**Solucion propuesta**:
1. Refactorizar `readHistory()` y `recordCommand()` para aceptar un parametro `rootDir` opcional (default: `findMonorepoRoot()`)
2. En tests, pasar `rootDir` apuntando al `tempDir`
3. Eliminar las funciones duplicadas del test file
4. Alternativamente, mockear `findMonorepoRoot()` con vi.mock

**Recomendacion**: Fix directo en esta SPEC. Critico para la integridad del testing.

---

### GAP-032-032: [MEDIO] Falta `cwd` en buildSpawnArgs y spawn

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/runner.ts:36-65, 97-100`
- **Decision**: ✅ HACER - Agregar cwd a SpawnArgs y spawn options
- **Fecha decision**: 2026-03-09

**Problema**: La spec (seccion 4.3, "Command Construction") muestra explicitamente que `buildSpawnArgs` debe retornar un campo `cwd: root` y que `spawn` debe usar ese `cwd` como opcion. La implementacion no incluye `cwd` ni en `SpawnArgs` ni en la llamada a `spawn`.

**Spec dice**:
```ts
function buildSpawnArgs(cmd: CliCommand, extraArgs: string[]): SpawnArgs {
    // ...
    return { command: 'pnpm', args: ['run', script, ...], cwd: root };
}
```

**Implementacion actual**:
```ts
interface SpawnArgs {
    readonly command: string;
    readonly args: readonly string[];
    // NO hay cwd
}
```

**Impacto**: Funciona en la practica porque `pnpm cli` se ejecuta desde el root del monorepo via el script de package.json. Pero si alguien ejecuta `tsx scripts/cli.ts` desde un subdirectorio, los comandos `pnpm run` fallarian o ejecutarian en el directorio incorrecto.

**Solucion propuesta**:
1. Agregar `readonly cwd: string` a `SpawnArgs`
2. En `buildSpawnArgs`, calcular `cwd` usando `findMonorepoRoot()` (o recibirlo como parametro)
3. Pasar `cwd` a `spawn` options

**Recomendacion**: Fix directo en esta SPEC. Mejora robustez y cumplimiento con spec.

---

### GAP-032-033: [MEDIO] vitest.config.ts sin seccion de coverage

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/vitest.config.ts`
- **Decision**: ✅ HACER - Agregar seccion coverage
- **Fecha decision**: 2026-03-09

**Problema**: La spec (seccion 8) define explicitamente la configuracion de coverage:
```ts
coverage: {
    include: ['*.ts'],
    exclude: ['__tests__/**', 'vitest.config.ts']
}
```

La implementacion solo tiene la seccion `test` sin ninguna configuracion de `coverage`. Esto impide ejecutar `pnpm test:cli --coverage` con las inclusiones/exclusiones correctas.

**Solucion propuesta**: Agregar la seccion `coverage` al vitest.config.ts como indica la spec.

**Recomendacion**: Fix directo. Cambio trivial de 4 lineas.

---

### GAP-032-034: [MEDIO] Sin tsconfig.json propio para scripts/cli/

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/` (faltante)
- **Decision**: ✅ HACER - Crear tsconfig.json + script typecheck:cli
- **Fecha decision**: 2026-03-09

**Problema**: El directorio `scripts/cli/` no tiene un `tsconfig.json` propio. Esto significa que no hay verificacion de tipos independiente para el CLI. El comando `pnpm typecheck` ejecuta `tsc` en cada workspace package, pero `scripts/cli/` no es un workspace package, asi que sus tipos no se verifican en el pipeline de CI/CD.

**Impacto**: Errores de tipos en el CLI podrian pasar al main branch sin ser detectados por typecheck. El CLI depende de que `tsx` transpile en runtime sin verificar tipos.

**Solucion propuesta**:
1. Crear `scripts/cli/tsconfig.json` extendiendo la config root
2. Agregar un script `typecheck:cli` que ejecute `tsc --noEmit --project scripts/cli/tsconfig.json`
3. Incluirlo en el pipeline de typecheck general

**Recomendacion**: Fix directo. Mejora la seguridad de tipos en CI.

---

### GAP-032-035: [MEDIO] discovery.ts usa JSON.parse sin validacion Zod

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/discovery.ts:128`
- **Decision**: ✅ HACER - Validar con Zod safeParse
- **Fecha decision**: 2026-03-09

**Problema**: `JSON.parse(raw) as { name?: string; scripts?: Record<string, string> }` castea el resultado sin validacion. La regla del proyecto dice "Zod for all runtime inputs". Un `package.json` malformado donde `scripts` tenga valores no-string (ej: `{ "build": null }` o `{ "build": 42 }`) pasaria el type check en compilacion pero fallaria en runtime.

**Solucion propuesta**:
```ts
const PackageJsonSchema = z.object({
    name: z.string().optional(),
    scripts: z.record(z.string()).optional()
}).passthrough();

const pkg = PackageJsonSchema.safeParse(JSON.parse(raw));
if (!pkg.success) { continue; }
```

**Recomendacion**: Fix directo si se toca discovery.ts. Consistencia con las reglas del proyecto.

---

### GAP-032-036: [BAJO] Spec inconsistente: `--list --all` vs `--list-all`

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivos**: Spec seccion 5.2 vs seccion 7.2
- **Decision**: ✅ HACER - Subsumido por GAP-049 (agregar --all flag)
- **Fecha decision**: 2026-03-09

**Problema**: La spec se contradice a si misma sobre como listar todos los comandos:
- Seccion 5.2 dice: `pnpm cli --list --all`
- Seccion 7.2 dice: `pnpm cli --list-all`

La implementacion sigue la seccion 7.2 (`--list-all` como flag unico y `-la` como shorthand), lo cual es correcto. Pero `--list --all` como dos flags separados NO funciona (no hay flag `--all`).

**Solucion propuesta**: Actualizar la spec para ser consistente (usar `--list-all` en todas las secciones), o agregar soporte para `--all` como flag complementario.

**Recomendacion**: Postergar. El comportamiento actual es razonable.

---

### GAP-032-037: [MEDIO] pnpm-workspace.yaml missing deberia ser error fatal segun spec

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/discovery.ts:109-112`
- **Decision**: ✅ HACER - Opcion B (mantener degradacion graceful, actualizar spec)
- **Fecha decision**: 2026-03-09

**Problema**: La spec (seccion 6.6) dice explicitamente: "pnpm-workspace.yaml missing: Fatal error with message 'Cannot find pnpm-workspace.yaml. Run from monorepo root.'"

La implementacion hace `console.error()` y retorna un array vacio en vez de lanzar un error fatal o llamar `process.exit(1)`. El CLI continua funcionando pero solo con los comandos curated (sin auto-discovery).

**Solucion propuesta**: Hacer que `discoverCommands` lance un error o retorne un resultado que `main.ts` interprete como fatal. Alternativa: mantener el comportamiento actual (degradacion graceful) pero actualizar la spec para reflejarlo.

**Recomendacion**: Decidir si preferimos fail-fast (spec original) o degradacion graceful (implementacion actual). La degradacion graceful es mas user-friendly.. actualizar la spec.

---

### GAP-032-038: [MEDIO] Discovered package names/scripts no sanitizados antes de spawn

- **Auditoria**: #4 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2 (si GAP-001 no se corrige), P4 (si GAP-001 se corrige)
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/discovery.ts:140-155`
- **Decision**: ✅ HACER - Validar con regex como defensa en profundidad
- **Fecha decision**: 2026-03-09

**Problema**: Los `name` y claves de `scripts` de cada `package.json` descubierto se usan directamente para construir `execution.filter` y `execution.script` sin validacion. Con `shell: true` (GAP-001), un nombre malicioso como `@repo/db; curl attacker.com` seria interpretado por el shell.

**Nota**: Este gap se elimina casi completamente si GAP-001 se resuelve (eliminando `shell: true`). Sin embargo, como defensa en profundidad, se recomienda validar los nombres.

**Solucion propuesta**:
```ts
const SAFE_PKG_NAME = /^[@a-z0-9/_.-]+$/;
const SAFE_SCRIPT_NAME = /^[a-z0-9:_.-]+$/;
if (!SAFE_PKG_NAME.test(pkgName)) continue;
if (!SAFE_SCRIPT_NAME.test(scriptName)) continue;
```

**Recomendacion**: Fix directo como parte del hardening de GAP-001. Defensa en profundidad.

---

## Resumen Actualizado por Prioridad (Post Auditoria #4)

### P0 - Fix Inmediato (bloqueantes)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 001 | shell injection en runner.ts | CRITICA | 1 | #1 | Fix directo |
| 002 | 3 archivos de test faltantes | CRITICA | 4 | #1 | Fix directo |
| 015 | Deduplicacion rota en discovery | CRITICA | 3 | #2 | Fix directo |

### P1 - Fix Pronto (alto impacto)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 003 | Leak de signal handlers | ALTA | 2 | #1 | Fix directo |
| 004 | Shell command splitting | ALTA | 3 | #1 | Fix directo |
| 014 | Task state inexacto | INFO | 1 | #1 | Fix directo |
| 016 | ID overflow en formato | ALTA | 2 | #2 | Fix directo |
| 021 | runCommand() sin tests | ALTA | 3 | #3 | Fix directo |
| 031 | history.test.ts testea duplicados | ALTA | 3 | #4 | Fix directo |

### P2 - Fix Planificado

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 005 | History entry validation | ALTA | 2 | #1 | Fix directo |
| 006 | Dangerous commands coverage | ALTA | 1 | #1 | Fix directo |
| 007 | findMonorepoRoot fragil | MEDIA | 3 | #1 | Fix directo |
| 022 | formatExecutionInfo/DangerWarning sin tests | MEDIA | 2 | #3 | Fix directo |
| 023 | findMonorepoRoot sin tests | MEDIA | 2 | #3 | Fix directo |
| 024 | Path traversal en workspace patterns | MEDIA | 2 | #3 | Fix directo |
| 032 | Falta cwd en buildSpawnArgs/spawn | MEDIA | 2 | #4 | Fix directo |
| 038 | Package names no sanitizados | MEDIA | 2 | #4 | Fix directo |

### P3 - Mejoras

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 008 | Dead parameter _categories | MEDIA | 1 | #1 | Fix directo |
| 009 | Type safety dangerous/dangerMessage | MEDIA | 2 | #1 | Fix directo |
| 010 | Race condition historial | MEDIA | 3 | #1 | Documentar |
| 017 | Dynamic imports inconsistentes | MEDIA | 1 | #2 | Fix si se toca |
| 018 | No performance tests | MEDIA | 3 | #2 | Incluir en GAP-002 |
| 019 | inferCategory incompleto | MEDIA | 1 | #2 | Fix directo |
| 025 | DoS por query larga | MEDIA | 1 | #3 | Fix si se toca |
| 027 | ExitPromptError fragil y duplicado | BAJA | 2 | #3 | Fix directo |
| 028 | Edge cases en tests existentes | BAJA | 2 | #3 | Incluir en GAP-002 |
| 033 | vitest.config.ts sin coverage | MEDIA | 1 | #4 | Fix directo |
| 034 | Sin tsconfig.json para CLI | MEDIA | 2 | #4 | Fix directo |
| 035 | JSON.parse sin Zod en discovery | MEDIA | 2 | #4 | Fix directo |
| 037 | workspace.yaml missing no fatal | MEDIA | 1 | #4 | Actualizar spec |

### P4 - Postergar

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 011 | Version hardcodeada | BAJA | 1 | #1 | Postergar |
| 012 | YAML parser limitaciones | BAJA | 2 | #1 | Postergar |
| 013 | Magic number 48 | BAJA | 1 | #1 | Fix si se toca |
| 020 | Comment incorrecto "regex" | BAJA | 1 | #2 | Fix trivial |
| 026 | ANSI injection en command ID | BAJA | 1 | #3 | Postergar |
| 029 | Info disclosure via paths | BAJA | 1 | #3 | Postergar |
| 030 | Metricas de cobertura corregidas | INFO | N/A | #3 | Informativo |
| 036 | Spec inconsistente --list --all | BAJA | 1 | #4 | Postergar |

---

## Plan de Implementacion Recomendado (Post Auditoria #4)

### Fase 1: Fixes Criticos (P0) - ~3h

1. **Fix shell: true** (GAP-001): Eliminar `shell: true` de runner.ts, agregar `cwd` (GAP-032), sanitizar package names (GAP-038)
2. **Fix deduplicacion** (GAP-015): Comparar por execution subyacente en discovery.ts
3. **Crear discovery.test.ts** (parte de GAP-002): ~15 test cases cubriendo parseWorkspacePatterns, getPackagePrefix, isExcludedScript, discoverCommands. Agregar validacion Zod (GAP-035)

### Fase 2: Tests Faltantes y Signal Fix (P1) - ~4h

4. **Fix signal handler leak** (GAP-003): Agregar error handler + cleanup en runner.ts
5. **Fix history.test.ts** (GAP-031): Refactorizar funciones reales para aceptar rootDir, eliminar duplicados del test
6. **Crear tests de runCommand()** (GAP-021): ~10 test cases con mock de spawn
7. **Crear interactive.test.ts** (parte de GAP-002): ~12 test cases para buildChoices + mocks para runInteractiveLoop
8. **Crear main.test.ts** (parte de GAP-002): ~8 test cases con mocks de modulos
9. **Fix ID padding overflow** (GAP-016): Calcular padding dinamico

### Fase 3: Hardening (P2) - ~3h

10. **Fix shell command splitting** (GAP-004): Documentar limitacion o implementar tokenizer
11. **Fix history validation** (GAP-005): Agregar isValidEntry filter
12. **Fix dangerous commands** (GAP-006): Agregar db:push y env:push como dangerous
13. **Fix findMonorepoRoot** (GAP-007): Mover a utils.ts, detectar por marker file
14. **Agregar tests faltantes de format** (GAP-022): formatExecutionInfo, formatDangerWarning
15. **Validar workspace patterns** (GAP-024): Rechazar patterns con .. o absolutos
16. **Agregar cwd a SpawnArgs** (GAP-032): Incluir cwd en interface y spawn call

### Fase 4: Polish (P3) - ~2h (opcional, batch con otros)

17. Fixes menores: GAPs 008, 009, 017, 019, 025, 027, 028
18. **Coverage config** (GAP-033): Agregar seccion coverage a vitest.config.ts
19. **tsconfig.json** (GAP-034): Crear config de tipos para scripts/cli/
20. **Actualizar spec** (GAP-037): Documentar degradacion graceful como comportamiento esperado

**Esfuerzo total estimado**: 10-12 horas (ajustado con 8 gaps nuevos de auditoria #4)
**Cobertura estimada post-fix**: ~90%+ (cumpliendo target de spec)
**Total gaps (pre-auditoria #5)**: 38 (3 CRITICOS, 7 ALTOS, 17 MEDIOS, 11 BAJOS)

---

## Gaps Encontrados en Auditoria #5 (2026-03-09)

> Quinta pasada con Code Review senior (framework de 7 niveles priorizando seguridad, correctness, net-positive) + Test Coverage Matrix exhaustiva (funcion-por-funcion, edge case por edge case) + verificacion cruzada contra gaps previos.

### GAP-032-039: [ALTO] `formatDangerWarning()` renderiza literal "undefined" cuando falta `dangerMessage`

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: ALTA
- **Prioridad**: P1
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/format.ts:142`
- **Relacionado con**: GAP-009 (type system), GAP-022 (tests faltantes)
- **Decision**: ✅ HACER - Agregar fallback message con ??
- **Fecha decision**: 2026-03-09

**Problema**: A diferencia de GAP-009 que identifica el gap a nivel de tipos, este es un **bug de runtime concreto**. La linea:
```ts
return [`  ${YELLOW}⚠ Dangerous command: ${cmd.id}${RESET}`, `  ${cmd.dangerMessage}`, ''].join('\n');
```
Cuando `cmd.dangerMessage` es `undefined`, template interpolation produce el string literal `"  undefined"` en la terminal. Aunque todos los comandos curated peligrosos actualmente tienen `dangerMessage`, cualquier comando programaticamente construido (ej: desde discovery o futuras extensiones) con `dangerous: true` sin `dangerMessage` mostraria "undefined" como texto de advertencia al usuario.

**Solucion propuesta**:
```ts
const message = cmd.dangerMessage ?? 'This operation may be irreversible.';
return [`  ${YELLOW}⚠ Dangerous command: ${cmd.id}${RESET}`, `  ${message}`, ''].join('\n');
```

**Recomendacion**: Fix directo, 1 linea. Combinable con GAP-009 (type safety) y GAP-022 (tests).

---

### GAP-032-040: [MEDIO] `ID_PAD` inconsistente entre format.ts (22) e interactive.ts (20)

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 1/10
- **Archivos**: `scripts/cli/format.ts:14`, `scripts/cli/interactive.ts:79`
- **Relacionado con**: GAP-016 (ID overflow)
- **Decision**: ✅ HACER - Unificar constante, combinar con GAP-016
- **Fecha decision**: 2026-03-09

**Problema**: `format.ts` define `ID_PAD = 22` para alinear columnas en `--help` y `--list`. Pero `interactive.ts` usa `.padEnd(20)` hardcodeado directamente en `formatChoice()`. Esto causa que la misma lista de comandos tenga alineacion diferente en modo help vs modo interactivo.

Ademas, esto duplica la constante de alineacion en dos lugares sin relacion, lo que garantiza que divergiran aun mas en el futuro.

**Ejemplo visual**:
```
# --help (format.ts, pad=22)
db:start              Start PostgreSQL and Redis containers

# interactive mode (interactive.ts, pad=20)
db:start            Start PostgreSQL and Redis containers
```

**Solucion propuesta**: Exportar `ID_PAD` desde `format.ts` e importarlo en `interactive.ts`. O extraer a `constants.ts`.

**Recomendacion**: Fix directo junto con GAP-016. Trivial.

---

### GAP-032-041: [MEDIO] `TURBO_ORCHESTRATED_SCRIPTS` exclusion es demasiado gruesa

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/discovery.ts:80-90`
- **Decision**: ✅ HACER - Opcion C (excluir solo si curated command tiene type pnpm-root)
- **Fecha decision**: 2026-03-09

**Problema**: La exclusion de scripts turbo-orquestados opera a nivel de **nombre de script**, no de **command ID**. Si `build` esta en `TURBO_ORCHESTRATED_SCRIPTS`, TODOS los scripts `build` de TODOS los paquetes se excluyen del discovery, incluyendo `api:build`, `web:build`, `admin:build`, etc.

Esto es correcto para evitar duplicados con el curated `build` (que ejecuta `pnpm run build` en el root y turbo lo orquesta), pero impide que desarrolladores vean los per-package builds individuales (`pnpm --filter @repo/db build`) en la busqueda.

**Scripts afectados**: `build`, `lint`, `typecheck`, `check`, `test`, `dev`, `format`

**Solucion propuesta**:
1. **Opcion A (minima)**: Documentar la logica como intencionada y agregar comment explicativo
2. **Opcion B**: Solo excluir si el package es el root (not filtered), no sub-packages
3. **Opcion C**: Excluir solo si el curated command tiene `type: 'pnpm-root'` (turbo dispatches from root)

**Recomendacion**: Opcion A como fix inmediato. Opcion B si se necesita granularidad en el futuro.

---

### GAP-032-042: [BAJO] `handleDirect()` descarta flags desconocidos silenciosamente

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/direct.ts:59-64`
- **Decision**: ✅ HACER - Agregar warning para flags desconocidos
- **Fecha decision**: 2026-03-09

**Problema**: Un flag no reconocido como `--verbose` o un typo como `--ys` (en vez de `--yes`) se ignora silenciosamente. El usuario no recibe feedback de que su flag fue ignorado, lo que puede causar confusion (ej: creer que `--yes` esta activo cuando escribio `--ys`).

```ts
// parseCliArgs() simplemente ignora flags desconocidos
default:
    if (!arg.startsWith('-')) {
        commandId = arg;
    }
    // flags desconocidos: silencio total
```

**Solucion propuesta**:
```ts
default:
    if (arg.startsWith('-')) {
        console.warn(`Warning: unknown flag '${arg}' ignored.`);
    } else if (commandId === undefined) {
        commandId = arg;
    }
```

**Recomendacion**: Fix si se toca direct.ts por otros gaps.

---

### GAP-032-043: [BAJO] `EXCLUDED_SCRIPTS` no cubre lifecycle hooks completos de npm

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/discovery.ts:8`
- **Decision**: ✅ HACER - Agregar lifecycle hooks comunes al set de exclusion
- **Fecha decision**: 2026-03-09

**Problema**: Solo se excluyen `prepare`, `preinstall`, `postinstall`. Los lifecycle hooks estandar de npm como `prebuild`, `postbuild`, `pretest`, `posttest`, `predev`, `postdev` no se excluyen. Si algun paquete define estos hooks, aparecerian en el discovery como comandos ejecutables con IDs confusos (ej: `api:prebuild`).

**Estado actual**: Ningun paquete del monorepo usa estos hooks actualmente, asi que es latente.

**Solucion propuesta**:
1. Agregar pattern matching: `if (script.startsWith('pre') || script.startsWith('post'))` con whitelist de base scripts
2. O agregar al set: `prepublishOnly`, `prebuild`, `postbuild`, `pretest`, `posttest`

**Recomendacion**: Postergar. Riesgo latente bajo.

---

### GAP-032-044: [BAJO] `DANGEROUS_IDS` en registry.test.ts es un duplicado hardcodeado

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/__tests__/registry.test.ts:6`
- **Decision**: ✅ HACER - Derivar del data real, combinar con GAP-006
- **Fecha decision**: 2026-03-09

**Problema**: El test define un set hardcodeado de IDs peligrosos:
```ts
const DANGEROUS_IDS = new Set(['db:reset', 'db:fresh', 'db:fresh-dev', 'db:migrate:prod', 'clean']);
```

Esto se desincronizara silenciosamente cuando se agreguen o remuevan dangerous commands (ej: GAP-006 propone agregar `db:push` y `env:push`). Los tests seguirian pasando sin detectar la inconsistencia.

**Solucion propuesta**:
```ts
// En vez de hardcodear, derivar del data real
const dangerousCommands = getCuratedCommands().filter((c) => c.dangerous);
expect(dangerousCommands).toHaveLength(5); // assertion explicita de conteo
for (const cmd of dangerousCommands) {
    expect(cmd.dangerMessage).toBeDefined();
}
```

**Recomendacion**: Fix cuando se implemente GAP-006 (agregar nuevos dangerous commands).

---

### GAP-032-045: [BAJO] `getRecentCommands` no valida `maxCount` negativo

- **Auditoria**: #5 (2026-03-09)
- **Severidad**: BAJA
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/history.ts:138`
- **Decision**: ✅ HACER - Agregar Math.max(0, maxCount)
- **Fecha decision**: 2026-03-09

**Problema**: Si se pasa `maxCount: -1`, `Array.slice(0, -1)` retorna todos los elementos excepto el ultimo, que es un comportamiento incorrecto pero silencioso. `maxCount: 0` retorna `[]` que es correcto. No hay guard para valores invalidos.

**Solucion propuesta**:
```ts
const count = Math.max(0, maxCount);
return sorted.slice(0, count);
```

**Recomendacion**: Fix trivial si se toca history.ts por GAP-005 o GAP-031.

---

## Resumen Actualizado por Prioridad (Post Auditoria #5)

### P0 - Fix Inmediato (bloqueantes)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 001 | shell injection en runner.ts | CRITICA | 1 | #1 | Fix directo |
| 002 | 3 archivos de test faltantes | CRITICA | 4 | #1 | Fix directo |
| 015 | Deduplicacion rota en discovery | CRITICA | 3 | #2 | Fix directo |

### P1 - Fix Pronto (alto impacto)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 003 | Leak de signal handlers | ALTA | 2 | #1 | Fix directo |
| 004 | Shell command splitting | ALTA | 3 | #1 | Fix directo |
| 014 | Task state inexacto | INFO | 1 | #1 | Fix directo |
| 016 | ID overflow en formato | ALTA | 2 | #2 | Fix directo |
| 021 | runCommand() sin tests | ALTA | 3 | #3 | Fix directo |
| 031 | history.test.ts testea duplicados | ALTA | 3 | #4 | Fix directo |
| 039 | formatDangerWarning renderiza "undefined" | ALTA | 1 | #5 | Fix directo |

### P2 - Fix Planificado

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 005 | History entry validation | ALTA | 2 | #1 | Fix directo |
| 006 | Dangerous commands coverage | ALTA | 1 | #1 | Fix directo |
| 007 | findMonorepoRoot fragil | MEDIA | 3 | #1 | Fix directo |
| 022 | formatExecutionInfo/DangerWarning sin tests | MEDIA | 2 | #3 | Fix directo |
| 023 | findMonorepoRoot sin tests | MEDIA | 2 | #3 | Fix directo |
| 024 | Path traversal en workspace patterns | MEDIA | 2 | #3 | Fix directo |
| 032 | Falta cwd en buildSpawnArgs/spawn | MEDIA | 2 | #4 | Fix directo |
| 038 | Package names no sanitizados | MEDIA | 2 | #4 | Fix directo |
| 040 | ID_PAD inconsistente entre modulos | MEDIA | 1 | #5 | Fix directo |

### P3 - Mejoras

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 008 | Dead parameter _categories | MEDIA | 1 | #1 | Fix directo |
| 009 | Type safety dangerous/dangerMessage | MEDIA | 2 | #1 | Fix directo |
| 010 | Race condition historial | MEDIA | 3 | #1 | Documentar |
| 017 | Dynamic imports inconsistentes | MEDIA | 1 | #2 | Fix si se toca |
| 018 | No performance tests | MEDIA | 3 | #2 | Incluir en GAP-002 |
| 019 | inferCategory incompleto | MEDIA | 1 | #2 | Fix directo |
| 025 | DoS por query larga | MEDIA | 1 | #3 | Fix si se toca |
| 027 | ExitPromptError fragil y duplicado | BAJA | 2 | #3 | Fix directo |
| 028 | Edge cases en tests existentes | BAJA | 2 | #3 | Incluir en GAP-002 |
| 033 | vitest.config.ts sin coverage | MEDIA | 1 | #4 | Fix directo |
| 034 | Sin tsconfig.json para CLI | MEDIA | 2 | #4 | Fix directo |
| 035 | JSON.parse sin Zod en discovery | MEDIA | 2 | #4 | Fix directo |
| 037 | workspace.yaml missing no fatal | MEDIA | 1 | #4 | Actualizar spec |
| 041 | TURBO exclusion demasiado gruesa | MEDIA | 2 | #5 | Documentar |

### P4 - Postergar

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 011 | Version hardcodeada | BAJA | 1 | #1 | Postergar |
| 012 | YAML parser limitaciones | BAJA | 2 | #1 | Postergar |
| 013 | Magic number 48 | BAJA | 1 | #1 | Fix si se toca |
| 020 | Comment incorrecto "regex" | BAJA | 1 | #2 | Fix trivial |
| 026 | ANSI injection en command ID | BAJA | 1 | #3 | Postergar |
| 029 | Info disclosure via paths | BAJA | 1 | #3 | Postergar |
| 030 | Metricas de cobertura corregidas | INFO | N/A | #3 | Informativo |
| 036 | Spec inconsistente --list --all | BAJA | 1 | #4 | Postergar |
| 042 | Flags desconocidos descartados silenciosamente | BAJA | 1 | #5 | Fix si se toca |
| 043 | EXCLUDED_SCRIPTS incompleto para lifecycle hooks | BAJA | 1 | #5 | Postergar |
| 044 | DANGEROUS_IDS hardcodeado en test | BAJA | 1 | #5 | Fix con GAP-006 |
| 045 | maxCount sin validacion negativa | BAJA | 1 | #5 | Fix si se toca |

---

## Plan de Implementacion Recomendado (Actualizado Post Auditoria #5)

### Fase 1: Fixes Criticos (P0) - ~3h

1. **Fix shell: true** (GAP-001): Eliminar `shell: true` de runner.ts, agregar `cwd` (GAP-032), sanitizar package names (GAP-038)
2. **Fix deduplicacion** (GAP-015): Comparar por execution subyacente en discovery.ts
3. **Crear discovery.test.ts** (parte de GAP-002): ~15 test cases cubriendo parseWorkspacePatterns, getPackagePrefix, isExcludedScript, discoverCommands. Agregar validacion Zod (GAP-035)

### Fase 2: Tests Faltantes y Signal Fix (P1) - ~4h

4. **Fix signal handler leak** (GAP-003): Agregar error handler + cleanup en runner.ts
5. **Fix formatDangerWarning undefined** (GAP-039): Agregar fallback message
6. **Fix history.test.ts** (GAP-031): Refactorizar funciones reales para aceptar rootDir, eliminar duplicados del test
7. **Crear tests de runCommand()** (GAP-021): ~10 test cases con mock de spawn
8. **Crear interactive.test.ts** (parte de GAP-002): ~12 test cases para buildChoices + mocks para runInteractiveLoop
9. **Crear main.test.ts** (parte de GAP-002): ~8 test cases con mocks de modulos
10. **Fix ID padding overflow** (GAP-016 + GAP-040): Calcular padding dinamico, unificar constante

### Fase 3: Hardening (P2) - ~3h

11. **Fix shell command splitting** (GAP-004): Documentar limitacion o implementar tokenizer
12. **Fix history validation** (GAP-005): Agregar isValidEntry filter
13. **Fix dangerous commands** (GAP-006): Agregar db:push y env:push como dangerous + actualizar test (GAP-044)
14. **Fix findMonorepoRoot** (GAP-007): Mover a utils.ts, detectar por marker file
15. **Agregar tests faltantes de format** (GAP-022): formatExecutionInfo, formatDangerWarning
16. **Validar workspace patterns** (GAP-024): Rechazar patterns con .. o absolutos
17. **Agregar cwd a SpawnArgs** (GAP-032): Incluir cwd en interface y spawn call

### Fase 4: Polish (P3) - ~2h (opcional, batch con otros)

18. Fixes menores: GAPs 008, 009, 017, 019, 025, 027, 028, 041
19. **Coverage config** (GAP-033): Agregar seccion coverage a vitest.config.ts
20. **tsconfig.json** (GAP-034): Crear config de tipos para scripts/cli/
21. **Actualizar spec** (GAP-037): Documentar degradacion graceful como comportamiento esperado

**Esfuerzo total estimado**: 11-13 horas (ajustado con 7 gaps nuevos de auditoria #5)
**Cobertura estimada post-fix**: ~90%+ (cumpliendo target de spec)
**Total gaps**: 45 (3 CRITICOS, 8 ALTOS, 21 MEDIOS, 13 BAJOS)

---

## Gaps Encontrados en Auditoria #6 (2026-03-09)

> Sexta pasada: Verificacion cruzada exhaustiva de scripts reales del root package.json vs curated registry, analisis de testabilidad de main(), validacion de UX interactivo, y confirmacion empirica de gaps previos.
> Metodologia: lectura completa de los 11 archivos fuente + 7 test files + spec + ejecutar tests reales (7 passed, 124 tests, 537ms)

### GAP-032-046: [MEDIO] Script `format:md:claude` del root completamente invisible al CLI

- **Auditoria**: #6 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/registry.ts`
- **Decision**: ✅ HACER - Agregar al registro curado + actualizar test count
- **Fecha decision**: 2026-03-09

**Problema**: El root `package.json` contiene el script `format:md:claude` (39 scripts root totales), pero este NO esta en el registro curado (45 commands). Ademas, auto-discovery solo lee workspace packages (via `pnpm-workspace.yaml`), NO el root package.json. Resultado: `format:md:claude` es **completamente invisible** al CLI.. no aparece en `--help`, `--list`, `--list-all`, ni en busqueda interactiva.

**Verificacion empirica**: Se compararon los 39 scripts del root package.json contra los 45 IDs curados:

| Script root | En curated? | Razon de exclusion |
|-------------|-------------|-------------------|
| `format:md:claude` | NO | **Olvidado**.. deberia estar curado |
| `cli` | NO | Correcto.. es el CLI mismo |
| `test:cli` | NO | Correcto.. es el test del CLI |
| `prepare` | NO | Correcto.. lifecycle hook excluido |

**Solucion propuesta**: Agregar `format:md:claude` al registro curado en la categoria `code-quality`:
```ts
{
    id: 'format:md:claude',
    description: 'Format markdown in Claude config files',
    category: 'code-quality',
    execution: { type: 'pnpm-root', script: 'format:md:claude' },
    source: 'root',
    mode: 'one-shot',
    curated: true
}
```

**Nota**: Esto cambiaria el count de 45 a 46 comandos curados. El test de registry (`exactly 45 curated commands`) debera actualizarse.

**Recomendacion**: Fix directo en esta SPEC.

---

### GAP-032-047: [MEDIO] `process.exit()` en `main()` impide testabilidad unitaria

- **Auditoria**: #6 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P2
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/main.ts:31, 35, 43, 45`
- **Decision**: ✅ HACER - Opcion A (retornar exit code, mover process.exit al entry point)
- **Fecha decision**: 2026-03-09

**Problema**: La funcion `main()` llama `process.exit()` en 4 puntos:
```ts
// Linea 31: despues de direct mode
process.exit(exitCode);

// Linea 35: despues de interactive mode
process.exit(0);

// Linea 43: en ExitPromptError catch
process.exit(0);

// Linea 45: en error catch
process.exit(1);
```

Esto hace que sea **imposible** testear `main()` unitariamente sin mockear `process.exit()`. Un mock de `process.exit()` es fragil y puede causar side effects en el test runner. Esto explica parcialmente por que `main.test.ts` no existe (GAP-002).. la funcion no fue disenada para ser testeable.

**Solucion propuesta**:
1. **Opcion A (recomendada)**: Refactorizar `main()` para retornar el exit code en vez de llamar `process.exit()`. Mover `process.exit()` al entry point `scripts/cli.ts`:
```ts
// main.ts
export async function main(): Promise<number> {
    // ... logica ...
    return exitCode;
}

// cli.ts
import { main } from './cli/main.js';
main().then((code) => process.exit(code));
```

2. **Opcion B**: Mockear `process.exit` con `vi.spyOn(process, 'exit').mockImplementation()`

**Recomendacion**: Fix directo. Opcion A es la forma correcta y facilita GAP-002 (crear main.test.ts).

---

### GAP-032-048: [MEDIO] "Recent" section del modo interactivo no se actualiza durante la sesion

- **Auditoria**: #6 (2026-03-09)
- **Severidad**: MEDIA
- **Prioridad**: P3
- **Complejidad**: 2/10
- **Archivo**: `scripts/cli/interactive.ts:76-78`
- **Decision**: ✅ HACER - Recalcular defaultChoices despues de cada ejecucion
- **Fecha decision**: 2026-03-09

**Problema**: En `runInteractiveLoop()`, la variable `defaultChoices` se construye UNA sola vez antes del loop `while(true)`:
```ts
const recent = getRecentCommands({ history });
const recentIds = recent.map((e) => e.id);
const defaultChoices = buildChoices({ commands: allCommands, recentIds });

while (true) {
    // defaultChoices NUNCA se actualiza
    source: async (input) => {
        if (!input) return defaultChoices; // siempre la misma lista
    }
}
```

Si el usuario ejecuta `db:start` y luego vuelve al menu, la seccion "Recent" NO muestra `db:start` como reciente. Solo se actualizara al reiniciar el CLI. `recordCommand()` si escribe al archivo, pero `defaultChoices` ya fue materializado y no se regenera.

**Solucion propuesta**: Recalcular `defaultChoices` despues de cada ejecucion de comando:
```ts
while (true) {
    const updatedHistory = await readHistory();
    const recentIds = getRecentCommands({ history: updatedHistory }).map(e => e.id);
    const currentChoices = buildChoices({ commands: allCommands, recentIds });

    const commandId = await search({
        source: async (input) => {
            if (!input) return currentChoices;
            // ...
        }
    });
    // ...
}
```

**Recomendacion**: Fix directo. Mejora notable de UX sin complejidad adicional.

---

### GAP-032-049: [BAJO] Confirmacion empirica: `--list --all` (dos flags) NO funciona

- **Auditoria**: #6 (2026-03-09)
- **Severidad**: BAJA (expansion de GAP-036)
- **Prioridad**: P3
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/direct.ts:41-65`
- **Decision**: ✅ HACER - Agregar case para --all, combinar con GAP-042
- **Fecha decision**: 2026-03-09

**Problema**: Verificado por inspeccion de codigo que `pnpm cli --list --all` produce comportamiento incorrecto:

1. `--list` se reconoce y setea `list = true`
2. `--all` NO se reconoce (no hay case para `--all`), y como empieza con `-` se ignora silenciosamente (GAP-042)
3. `listAll` queda en `false`
4. Resultado: el usuario obtiene lista de curated-only, NO de todos los comandos

La spec seccion 5.2 dice `pnpm cli --list --all` deberia funcionar, pero solo `--list-all` y `-la` funcionan.

**Solucion propuesta**: Agregar un case para `--all`:
```ts
case '--all':
    listAll = true;
    break;
```

Combinado con el `if (listAll) list = true` existente en linea 67-69, esto haria que `--list --all` funcione como dos flags complementarios.

**Recomendacion**: Fix directo, 2 lineas. Combinable con GAP-042 (warning de flags desconocidos).

---

### GAP-032-050: [BAJO] Import duplicado de `history.js` en main.ts

- **Auditoria**: #6 (2026-03-09)
- **Severidad**: BAJA (detalle de GAP-007 verificado)
- **Prioridad**: P4
- **Complejidad**: 1/10
- **Archivo**: `scripts/cli/main.ts:3-4`
- **Decision**: ✅ HACER - Subsumido por GAP-007 (mover findMonorepoRoot a utils.ts)
- **Fecha decision**: 2026-03-09

**Problema**: Dos import statements del mismo modulo:
```ts
import { readHistory } from './history.js';
import { findMonorepoRoot } from './history.js';
```

Deberian fusionarse en:
```ts
import { findMonorepoRoot, readHistory } from './history.js';
```

Esto ya fue mencionado en GAP-007 pero como sub-punto. Este gap lo separa como accion atomica verificada.

**Recomendacion**: Fix trivial al tocar main.ts por otros gaps.

---

## Metricas Actualizadas (Post Auditoria #6)

| Metrica | Valor Pre-A6 | Valor Post-A6 | Target Spec |
|---------|-------------|---------------|-------------|
| Modulos implementados | 11/11 | 11/11 | 11/11 |
| Tests existentes | 7/10 archivos | 7/10 archivos | 10/10 archivos |
| Test cases | 124 | 124 | ~200+ estimado |
| Archivos de test faltantes | 3 | 3 | 0 |
| Tests que pasan | 124/124 | 124/124 | 200+/200+ |
| Vulnerabilidades de seguridad | 1 CRITICA | 1 CRITICA | 0 |
| Bugs funcionales visibles | 2 | 3 (+Recent no update) | 0 |
| Scripts root invisibles al CLI | desconocido | 1 (format:md:claude) | 0 |
| Cobertura estimada | ~62% | ~62% | 90% minimo |
| Total gaps | 45 | 50 | 0 |
| Auditorias realizadas | 5 | 6 | - |

---

## Resumen Actualizado por Prioridad (Post Auditoria #6)

### P0 - Fix Inmediato (bloqueantes)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 001 | shell injection en runner.ts | CRITICA | 1 | #1 | Fix directo |
| 002 | 3 archivos de test faltantes | CRITICA | 4 | #1 | Fix directo |
| 015 | Deduplicacion rota en discovery | CRITICA | 3 | #2 | Fix directo |

### P1 - Fix Pronto (alto impacto)

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 003 | Leak de signal handlers | ALTA | 2 | #1 | Fix directo |
| 004 | Shell command splitting | ALTA | 3 | #1 | Fix directo |
| 014 | Task state inexacto | INFO | 1 | #1 | Fix directo |
| 016 | ID overflow en formato | ALTA | 2 | #2 | Fix directo |
| 021 | runCommand() sin tests | ALTA | 3 | #3 | Fix directo |
| 031 | history.test.ts testea duplicados | ALTA | 3 | #4 | Fix directo |
| 039 | formatDangerWarning renderiza "undefined" | ALTA | 1 | #5 | Fix directo |

### P2 - Fix Planificado

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 005 | History entry validation | ALTA | 2 | #1 | Fix directo |
| 006 | Dangerous commands coverage | ALTA | 1 | #1 | Fix directo |
| 007 | findMonorepoRoot fragil | MEDIA | 3 | #1 | Fix directo |
| 022 | formatExecutionInfo/DangerWarning sin tests | MEDIA | 2 | #3 | Fix directo |
| 023 | findMonorepoRoot sin tests | MEDIA | 2 | #3 | Fix directo |
| 024 | Path traversal en workspace patterns | MEDIA | 2 | #3 | Fix directo |
| 032 | Falta cwd en buildSpawnArgs/spawn | MEDIA | 2 | #4 | Fix directo |
| 038 | Package names no sanitizados | MEDIA | 2 | #4 | Fix directo |
| 040 | ID_PAD inconsistente entre modulos | MEDIA | 1 | #5 | Fix directo |
| 046 | format:md:claude invisible al CLI | MEDIA | 1 | #6 | Fix directo |
| 047 | process.exit() impide testabilidad | MEDIA | 2 | #6 | Fix directo |

### P3 - Mejoras

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 008 | Dead parameter _categories | MEDIA | 1 | #1 | Fix directo |
| 009 | Type safety dangerous/dangerMessage | MEDIA | 2 | #1 | Fix directo |
| 010 | Race condition historial | MEDIA | 3 | #1 | Documentar |
| 017 | Dynamic imports inconsistentes | MEDIA | 1 | #2 | Fix si se toca |
| 018 | No performance tests | MEDIA | 3 | #2 | Incluir en GAP-002 |
| 019 | inferCategory incompleto | MEDIA | 1 | #2 | Fix directo |
| 025 | DoS por query larga | MEDIA | 1 | #3 | Fix si se toca |
| 027 | ExitPromptError fragil y duplicado | BAJA | 2 | #3 | Fix directo |
| 028 | Edge cases en tests existentes | BAJA | 2 | #3 | Incluir en GAP-002 |
| 033 | vitest.config.ts sin coverage | MEDIA | 1 | #4 | Fix directo |
| 034 | Sin tsconfig.json para CLI | MEDIA | 2 | #4 | Fix directo |
| 035 | JSON.parse sin Zod en discovery | MEDIA | 2 | #4 | Fix directo |
| 037 | workspace.yaml missing no fatal | MEDIA | 1 | #4 | Actualizar spec |
| 041 | TURBO exclusion demasiado gruesa | MEDIA | 2 | #5 | Documentar |
| 048 | Recent section no se actualiza en sesion | MEDIA | 2 | #6 | Fix directo |
| 049 | --list --all dos flags no funciona | BAJA | 1 | #6 | Fix directo |

### P4 - Postergar

| # | Gap | Severidad | Complejidad | Auditoria | Accion |
|---|-----|-----------|-------------|-----------|--------|
| 011 | Version hardcodeada | BAJA | 1 | #1 | Postergar |
| 012 | YAML parser limitaciones | BAJA | 2 | #1 | Postergar |
| 013 | Magic number 48 | BAJA | 1 | #1 | Fix si se toca |
| 020 | Comment incorrecto "regex" | BAJA | 1 | #2 | Fix trivial |
| 026 | ANSI injection en command ID | BAJA | 1 | #3 | Postergar |
| 029 | Info disclosure via paths | BAJA | 1 | #3 | Postergar |
| 030 | Metricas de cobertura corregidas | INFO | N/A | #3 | Informativo |
| 036 | Spec inconsistente --list --all | BAJA | 1 | #4 | Subsumido por GAP-049 |
| 042 | Flags desconocidos descartados silenciosamente | BAJA | 1 | #5 | Fix si se toca |
| 043 | EXCLUDED_SCRIPTS incompleto para lifecycle hooks | BAJA | 1 | #5 | Postergar |
| 044 | DANGEROUS_IDS hardcodeado en test | BAJA | 1 | #5 | Fix con GAP-006 |
| 045 | maxCount sin validacion negativa | BAJA | 1 | #5 | Fix si se toca |
| 050 | Import duplicado en main.ts | BAJA | 1 | #6 | Fix trivial |

---

## Plan de Implementacion Recomendado (Actualizado Post Auditoria #6)

### Fase 1: Fixes Criticos (P0) - ~3h

1. **Fix shell: true** (GAP-001): Eliminar `shell: true` de runner.ts, agregar `cwd` (GAP-032), sanitizar package names (GAP-038)
2. **Fix deduplicacion** (GAP-015): Comparar por execution subyacente en discovery.ts
3. **Crear discovery.test.ts** (parte de GAP-002): ~15 test cases cubriendo parseWorkspacePatterns, getPackagePrefix, isExcludedScript, discoverCommands. Agregar validacion Zod (GAP-035)

### Fase 2: Tests Faltantes y Signal Fix (P1) - ~4h

4. **Refactorizar main() para testabilidad** (GAP-047): Retornar exit code en vez de process.exit()
5. **Fix signal handler leak** (GAP-003): Agregar error handler + cleanup en runner.ts
6. **Fix formatDangerWarning undefined** (GAP-039): Agregar fallback message
7. **Fix history.test.ts** (GAP-031): Refactorizar funciones reales para aceptar rootDir, eliminar duplicados del test
8. **Crear tests de runCommand()** (GAP-021): ~10 test cases con mock de spawn
9. **Crear interactive.test.ts** (parte de GAP-002): ~12 test cases para buildChoices + mocks para runInteractiveLoop
10. **Crear main.test.ts** (parte de GAP-002): ~8 test cases (facilitado por GAP-047 fix)
11. **Fix ID padding overflow** (GAP-016 + GAP-040): Calcular padding dinamico, unificar constante

### Fase 3: Hardening (P2) - ~4h

12. **Fix shell command splitting** (GAP-004): Documentar limitacion o implementar tokenizer
13. **Fix history validation** (GAP-005): Agregar isValidEntry filter
14. **Fix dangerous commands** (GAP-006): Agregar db:push y env:push como dangerous + actualizar test (GAP-044)
15. **Fix findMonorepoRoot** (GAP-007): Mover a utils.ts, detectar por marker file
16. **Agregar tests faltantes de format** (GAP-022): formatExecutionInfo, formatDangerWarning
17. **Validar workspace patterns** (GAP-024): Rechazar patterns con .. o absolutos
18. **Agregar cwd a SpawnArgs** (GAP-032): Incluir cwd en interface y spawn call
19. **Agregar format:md:claude al registry** (GAP-046): +1 comando curado, actualizar test count

### Fase 4: Polish (P3) - ~3h (opcional, batch con otros)

20. Fixes menores: GAPs 008, 009, 017, 019, 025, 027, 028, 041, 048, 049
21. **Coverage config** (GAP-033): Agregar seccion coverage a vitest.config.ts
22. **tsconfig.json** (GAP-034): Crear config de tipos para scripts/cli/
23. **Actualizar spec** (GAP-037): Documentar degradacion graceful como comportamiento esperado
24. **Fix Recent section** (GAP-048): Recalcular defaultChoices despues de cada ejecucion
25. **Fix --list --all** (GAP-049): Agregar case para --all flag

**Esfuerzo total estimado**: 13-15 horas (ajustado con 5 gaps nuevos de auditoria #6)
**Cobertura estimada post-fix**: ~90%+ (cumpliendo target de spec)
**Total gaps**: 50 (3 CRITICOS, 8 ALTOS, 24 MEDIOS, 15 BAJOS)

---

## Recomendacion Final (Post 6 Auditorias)

**No se necesita una SPEC nueva**. Todos los 50 gaps son correcciones y completamiento de trabajo dentro del alcance de SPEC-032.

Se recomienda:

1. **Reabrir SPEC-032** cambiando status a `in-progress`
2. **Corregir task state** inmediatamente (GAP-014)
3. **Implementar Fases 1-3** como prioridad (gaps P0-P2)
4. **Fase 4** se puede hacer como cleanup batch o en paralelo con otros trabajos
5. **Gaps P4** se resuelven oportunisticamente cuando se toquen los archivos afectados
6. **Punto critico para testabilidad**: GAP-047 (refactorizar main() para retornar exit code) debe hacerse ANTES de crear main.test.ts, ya que sin ese cambio los tests son extremadamente fragiles
