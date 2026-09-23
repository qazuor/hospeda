# Auditoría de separación `qz` / adapter Hospeda — 2026-09-23

Revisión read-only de `scripts/client-tools` y `.qz/project.json`. No se
renombraron binarios ni se cambiaron comandos.

## Ya configurable

- Identificador de proyecto, equipo y patrón de issues.
- Rama base, promoción, back-merge y ramas protegidas.
- Patrón de worktrees y checkout protegido de variables.
- Estrategia, contenedor, template y variable de conexión de Postgres.
- Servidores, puertos, comandos de arranque y health paths.
- Prefijos declarados: `qz-` genérico y `hops-` específico.

## Acoplamientos encontrados

| Superficie | Acoplamiento actual | Adaptación recomendada |
|---|---|---|
| Linear | Normalización y textos asumen `HOS-NNN`; autenticación busca rutas `hospeda` | Resolver `teamKey`, patrón y ruta de config desde el adapter |
| Worktrees | nombres y badges usan `hospeda-` | Usar `projectId`/`displayName` y conservar override visual opcional |
| DB | defaults `hospeda-postgres`, `hospeda_template`, `hospeda_dev` | Todos deben salir de `database` del adapter; sin fallback Hospeda en núcleo |
| Servers | filtros `hospeda-api`/`hospeda-web` y puertos actuales | Declarar package/filter y comando por servidor en config |
| Branches | algunos defaults siguen `staging`; `merge/gate.ts` tiene base fija | El adapter debe ser la única autoridad; fallback genérico sólo `main`/config explícita |
| Stats | reportes y equipos default HOS/BETA | Mover equipos y labels a la integración del issue provider |
| Update | checkout fijo `hospeda-staging` y reconciliación Hospeda | Extraer `protectedCheckout` y hook de reconciliación al adapter |
| Env | `copy-env-to-worktree.sh` y registry son Hospeda | Mantenerlos en el adapter; `qz` sólo invoca contrato genérico |

## Diseño recomendado

1. Mantener `scripts/client-tools` como implementación, pero dividir el
   dispatcher en un núcleo `qz` y un adapter cargado desde `.qz/project.json`.
2. Hacer que cada comando declare explícitamente si es `generic` o `project`.
3. Prohibir nuevos defaults Hospeda en el núcleo; el guard debe detectar
   literales `hospeda`, `HOS-`, `hospeda_template` y `hospeda-postgres` fuera de
   adapters/documentación.
4. Generar wrappers `qz-*` sólo para comandos genéricos y `hops-*` para los de
   Hospeda. Las funciones internas pueden compartir implementación.
5. Migrar primero `context`, `recap`, `handoff`, `verify`, `branch-plan`,
   `promote/back-merge` y `artifact`; dejar DB/env/servers/Linear como adapters
   hasta que exista un segundo proyecto de prueba.

## Estado

El prefijo ya está declarado y los checks de manifest pasan, pero la separación
real todavía no está implementada. No conviene renombrar comandos ni crear
symlinks hasta extraer la configuración y añadir un proyecto fixture que pruebe
que el núcleo no depende de Hospeda.
