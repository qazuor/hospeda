# Contrato entre `hops` y commands de agentes

Fecha: 2026-09-16

## Regla general

Cada operación debe implementarse primero en `hops` como lógica determinista,
testeable y reutilizable. El script hace la mayor cantidad posible de trabajo:
consultas, validaciones, derivaciones, clasificación, lectura de estado y
preparación de planes. No debe delegar al LLM cálculos que pueda resolver de
forma confiable.

La salida debe tener dos capas:

- una representación estructurada y estable para que OpenCode, Claude u otro
  CLI la consuma sin volver a leer el repo;
- una presentación humana compacta para invocaciones manuales.

Los comandos read-only deben ofrecer `--json` para consumidores automáticos;
el formato humano queda como default.

Cada command que tenga contraparte de agente debe mantener ambos lados juntos:
el script recolecta hechos y la contraparte prefijada `hops-` compone el prompt,
hallazgos, decisiones y contexto que el LLM no puede inferir del estado local.

Los commands de handoff deben encerrar su salida en marcadores visibles y
estables (`BEGIN/END HOSPEDA HANDOFF`) para facilitar copiarla completa.

El command del agente es una capa fina: llama a `hops`, agrega razonamiento o
contexto conversacional sólo cuando hace falta y respeta los permisos del
script. No duplica reglas de Linear, Git, worktrees, DB, smoke ni CI.

## Prefijo de commands

Todos los commands propios de Hospeda dentro del CLI del agente usan el prefijo
`hops-`: `hops-recap`, `hops-start-issue`, `hops-close-issue`,
`hops-handoff`, `hops-smoke-plan`, `hops-artifact-create`, etc. Esto los separa de
commands nativos de OpenCode y de Gentle-AI y permite listarlos rápidamente.

`/hops-recap` es el único command de recap del proyecto. Los aliases sin
prefijo de artifacts y recap fueron retirados una vez comprobada la cobertura;
no deben volver a agregarse.

## Contrato mínimo por command

- `--help` y errores claros;
- salida estructurada cuando la consuma otro proceso;
- modo read-only, `--dry-run` o `--plan` para operaciones sensibles;
- exit codes estables;
- tests del script, no sólo del prompt;
- ninguna dependencia de Claude Code.

## Contrato de Hops común y adaptadores de proyecto

## Decisión

`hops` será un CLI común para varios proyectos. La implementación no debe
preguntar si el proyecto es Hospeda para decidir su comportamiento. En cambio,
resuelve un adaptador desde la raíz del repositorio y ejecuta capacidades
genéricas con configuración declarativa.

## Capas

- **Núcleo genérico:** worktrees, puertos, lifecycle de servidores, estado,
  env drift, cleanup, verify, handoff, recap, update y guards comunes.
- **Adaptador de proyecto:** Linear/team, branch base, nombres de DB, fuente de
  envs, roles de servidores, comandos de build/health, seed, scripts especiales
  y políticas del proyecto.
- **Integración de cliente:** wrappers/adapters para OpenCode, Claude Code,
  Codex u otros agentes. Sólo traduce el comando y el contexto; no duplica la
  lógica pesada.

## Configuración propuesta

Cada proyecto podrá versionar un manifiesto como `.hops/project.json` (nombre
pendiente), sin secretos. Debe declarar un `schemaVersion`, `projectId`,
`adapter`, branch bases, worktree strategy, env sources, database strategy,
server roles, health checks y comandos permitidos. Las partes sensibles se
resuelven por referencias al entorno local, nunca desde el manifiesto.

Por ejemplo, `wt-create` debe conservar el flujo común de crear worktree,
copiar/reconciliar envs, preparar DB, asignar puertos y verificar servicios,
mientras que Hospeda sólo declara cómo se llaman sus tres apps y cómo se
prepara su template PostgreSQL.

## Compatibilidad

Durante la transición, Hospeda puede seguir usando `scripts/worktree` y su
configuración actual como adaptador implícito. Antes de incorporar un segundo
proyecto se extraerá el contrato explícito y se validará que ningún comando
genérico dependa de nombres `hospeda-*`, `HOSPEDA_*` o rutas específicas.
