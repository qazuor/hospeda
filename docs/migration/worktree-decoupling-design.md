# Diseño de desacople del workflow de worktrees

Fecha: 2026-09-15.

## Estado actual

`hops` resuelve correctamente el repo, worktree, branch y estado local, pero
delegan servidores y cleanup a scripts ubicados en
`~/.claude/skills/worktree/scripts/`. La configuración del proyecto define base
branch, patrones de nombres, tres servidores, reescritura de variables de
puerto, preparación de `.env`, DB por worktree y fingerprints de schema.

El archivo actual también contiene campos sensibles de conexión de DB. No debe
copiarse tal cual ni quedar como configuración portable.

El repositorio tiene actualmente 29 worktrees registrados, incluyendo el
checkout principal, `staging`, worktrees de issues y algunos worktrees internos
de agentes/scratchpads. Una instalación limpia de OpenCode/Gentle no debe
confundir esos directorios con residuos eliminables ni intentar recrearlos con
otro plugin.

Una inspección read-only de estado encontró 12 worktrees con cambios, 16
limpios y uno que no pudo leerse. Hay 62 entradas de cambio acumuladas en los
worktrees sucios. No se muestran rutas ni archivos para evitar exponer contexto
de otros agentes; antes de cualquier cleanup se debe presentar un inventario
explícito y excluir todo worktree con cambios.

La implementación actual de `start-issue` ya separa varias piezas reutilizables:

- normaliza `273`, `HOS-273`, `#273` y prefijos de otros equipos;
- consulta Linear y rechaza estados completados/cancelados sin confirmación
  interactiva;
- deriva `feat`/`fix`/`refactor` desde labels;
- genera un slug estable y limitado a 40 caracteres;
- soporta `--dry-run`, `--bare` y `--no-claude`;
- extrae la ruta real emitida por `wt-create.sh` en vez de adivinarla;
- deja el worktree creado aunque el launcher falle.

La adaptación debe conservar ese contrato y reemplazar sólo la última decisión:
`claude`, `opencode`, ningún launcher u otro comando configurable. El prompt
debe ser un argumento explícito y no una inferencia basada en el binario
disponible. El modo `--dry-run` debe seguir siendo completamente read-only.

## Diseño recomendado

### Capa genérica versionable

- librería/CLI de lifecycle: create, inspect, servers-up/down y cleanup;
- resolución del root Git y estado por worktree;
- patrones de branch/path parametrizables;
- asignación de puertos y health checks;
- estado local gitignored por worktree;
- contratos de salida JSON para que OpenCode sólo consuma resultados;
- hooks de autorización antes de borrar DB, worktree, branch o remoto.

### Adaptador Hospeda

- comandos de pnpm para API, admin y web;
- nombres de variables de puertos y URLs públicas;
- comandos de migración/seed y sentinel tables;
- estrategia Docker/Postgres y nombres de DB;
- `copy-env-to-worktree.sh` y `worktree-extra-env.json.example`;

La copia de archivos ignorados tiene dos capas. `copy-env-to-worktree.sh`
acepta `HOPS_ENV_SOURCE_ROOT` para seleccionar explícitamente un checkout local
confiable que posee los archivos reales; nunca imprime sus contenidos. Después
`wt-create.sh` ejecuta `wt-env-prepare.sh` sobre el worktree nuevo cuando la
herramienta está disponible, generando placeholders desde los `.env.example`
del propio worktree. Así un checkout limpio puede ejecutar los guards de env
sin depender de secretos, y el entorno real se copia sólo cuando el operador
lo selecciona explícitamente.

- reglas de smoke y cleanup específicas de Hospeda.

### Secretos

La configuración versionada sólo debe declarar nombres de variables, rutas de
archivos y placeholders. Credenciales, DSN completos y cookies deben llegar por
el entorno local protegido o un archivo gitignored validado por el CLI.

## Migración propuesta

1. Extraer scripts desde la skill Claude a un paquete genérico fuera de
   `~/.claude`, preservando comportamiento y tests.
2. Inyectar la ruta de scripts mediante una variable/configuración explícita,
   con validación de que pertenece a una versión aprobada.
3. Mantener `hops` como única interfaz para worktrees de Hospeda.
4. Hacer que los commands OpenCode (`startIssue`, `closeIssue`) invoquen `hops`
   y no manipulen Docker, Postgres o Git directamente.
5. Añadir dry-run para create/cleanup y exigir confirmación para toda mutación.
6. Retirar la dependencia `~/.claude` sólo después de una prueba integral en un
   worktree descartable.

No se implementó este diseño todavía.
