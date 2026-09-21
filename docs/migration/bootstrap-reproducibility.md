# Bootstrap reproducible de la workstation de desarrollo y adaptadores de proyecto

Fecha: 2026-09-16

## Requisito

Antes de considerar terminada la migración, todos los comandos de
`scripts/client-tools` deben estar implementados, documentados y validados.
Esto incluye los comandos existentes y los candidatos aceptados del backlog:
`recap`, `issue-preflight`, `close-issue --plan`, `context`, `verify --changed`,
`smoke-plan` y `handoff --plan`, según el alcance final aprobado.

Los P0 `hops recap` e `hops issue-preflight`, y los P1 `hops context`,
`hops smoke-plan` y `hops verify --changed`, más `hops handoff --plan`, están
implementados y validados en el worktree. `/hops-recap` queda como capa
analítica sobre `hops recap`. La suite completa actual es 299/299 tests y 737
assertions; faltan únicamente gates E2E que requieren servicios reales y las
mutaciones explícitas de cierre.

La suite debe cubrir parsing, contratos, permisos, errores y modos read-only.
Cada comando operativo debe tener `--help`, dry-run o plan cuando corresponda,
y no depender de que Claude esté instalado.

## Arquitectura propuesta

El instalador se divide en dos capas:

1. `ai-dev-workstation-bootstrap`: instalador genérico para dejar una PC lista
   para trabajar con agentes CLI. Administra herramientas base, runtimes,
   OpenCode, Claude Code, Codex y otros clientes que el usuario elija, Engram,
   configuración global, proveedores, TUI, skills globales, permisos,
   guardrails, backups y manifests. No contiene reglas específicas de Hospeda.
2. Un adaptador por proyecto, por ejemplo `hospeda-workspace-bootstrap`, que
   administra sólo el entorno del proyecto: checkout operativo, Hops, envs,
   PostgreSQL/Redis, template DB, skills locales y verificaciones del monorepo.

El instalador genérico detectará adaptadores mediante un registro local de
proyectos y/o un manifiesto versionado dentro del repositorio. La detección sólo
propone o ejecuta `--plan`/`--verify`; nunca aplica cambios de proyecto sin una
selección explícita. Cada adaptador declara su identidad, versión, requisitos,
comandos de setup/verify y hashes de sus archivos administrados, sin secretos.

## Instalador futuro

Se debe crear un bootstrap versionado, idempotente y auditable, preferentemente
en un repositorio reusable separado de Hospeda, con un adaptador específico para
este proyecto. El flujo propuesto es:

1. verificar Ubuntu, arquitectura, usuario y herramientas base;
2. instalar versiones fijadas de Bun/Node, OpenCode, Gentle-AI y Engram;
3. instalar `client-tools` desde un checkout estable y sus dependencias;
4. generar wrappers globales de `hops` apuntando a ese checkout;
5. instalar configuración global versionada sin credenciales;
6. instalar/configurar TUI, skills, commands y agents aprobados;
7. restaurar Engram sólo después de verificar backups y compatibilidad;
8. ejecutar checks de versión, integridad, permisos y smoke read-only;
9. mostrar una lista de pasos manuales pendientes;
10. guardar un manifest de versiones y hashes para rollback.

## Lo que no debe automatizarse sin intervención

- login de OpenAI, GitHub, Linear, Sentry u otros proveedores;
- copia o restauración de secretos;
- selección final de memorias Engram;
- autorización de plugins de terceros;
- mutaciones Linear, Git, bases o producción;
- borrado de instalaciones anteriores.

El bootstrap debe admitir `--plan`, `--dry-run`, `--backup-dir`, `--restore` y
`--verify`, y fallar cerrado si una versión, checksum o permiso no coincide.
Debe generar un backup antes de tocar rutas existentes y conservar un rollback
claro. No se implementa el bootstrap todavía.
