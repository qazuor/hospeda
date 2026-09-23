# Auditoría de versiones del ecosistema

Fecha de consulta: 2026-09-23.

Esta auditoría es read-only. No actualiza binarios, no ejecuta `sync`, no
modifica configuraciones y no toca la base de Engram.

## Estado instalado

| Componente | Instalado | Canal actual del plan | Estado |
|---|---:|---|---|
| OpenCode | 1.18.31 | V1 | Una versión V1 detrás de la última release consultada |
| Gentle-AI | 2.9.0 | V1-compatible | Muy atrasado; la línea estable actual es 3.6.1 |
| Engram | 1.20.0 | SQLite local | Muy atrasado; la línea estable actual es 2.0.0 |

## Fuentes actuales

- Gentle-AI releases: <https://github.com/Gentleman-Programming/gentle-ai/releases>
- Engram releases: <https://github.com/Gentleman-Programming/engram/releases>
- OpenCode releases: <https://github.com/anomalyco/opencode/releases>

## Hallazgos Gentle-AI

La release estable actual consultada es `v3.6.1`.

- `v3.0.0` convirtió ODD en el protocolo predeterminado y simplificó SDD.
- `v3.5.0` activó RDD/review por defecto, salvo que exista una configuración que
  lo desactive.
- `v3.6.0` corrigió hooks, sincronización de assets y rutas de provisioning.
- `v3.6.1` mejoró los diagnósticos del registro de skills de OpenCode, eliminó
  una herramienta Pi conflictiva y ajustó el routing proporcional de ODD.
- La documentación oficial indica ejecutar `gentle-ai sync` después de actualizar
  para alinear binario, skills, reviewers y runtime assets.

Impacto para Hospeda:

1. No se debe actualizar encima de la instalación actual sin backup completo.
2. Hay que decidir explícitamente si RDD/review continúa desactivado, porque la
   línea 3.5+ lo activa por defecto.
3. Hay que revisar los assets generados por Gentle-AI después de `sync`; no basta
   con comprobar la versión del binario.
4. Hay que revalidar la interacción entre ODD, `AGENTS.md`, comandos Hops y el
   lifecycle híbrido `.specs`/SDD.

## Hallazgos Engram

La release estable actual consultada es `v2.0.0`, la primera release estable de
la línea v2, con cientos de cambios desde `v1.20.0`.

Cambios relevantes:

- nuevo módulo Go `/v2`;
- resolución de proyecto más estricta y scoping por proyecto;
- relaciones y conflictos persistentes;
- diagnósticos y reparación más completos;
- export/import que preserva relaciones y observaciones fijadas;
- integración OpenCode 1.x mejorada;
- sincronización Cloud opcional, sin reemplazar SQLite local como autoridad;
- nuevas protecciones contra observaciones sin título y referencias huérfanas.

Riesgos para la migración:

- la DB actual debe conservarse con múltiples backups antes de abrirla con v2;
- los proyectos ambiguos pueden dejar de resolverse implícitamente;
- el upgrade puede requerir migración de esquema y revisión de `doctor`;
- hay problemas conocidos de contención SQLite y sesiones OpenCode obsoletas;
- no debe activarse Cloud como parte automática de esta actualización.

La documentación de Engram indica que `engram setup opencode` apunta actualmente
a OpenCode 1.x; esto es compatible con nuestra decisión de permanecer en V1 por
ahora.

## Hallazgos OpenCode

La última release V1 consultada es `1.18.32`, una actualización pequeña respecto
de la instalada `1.18.31`. La diferencia publicada contiene correcciones de
Bedrock y reporting de uso de Together AI. No cambia la decisión de mantener V1.

OpenCode V2 aparece como una línea separada y no debe mezclarse con esta
actualización: Engram todavía documenta que su adapter dedicado para OpenCode 2.x
no está incluido.

## Plan de actualización recomendado

1. Mantener los pins actuales hasta completar el backup y la aprobación humana.
2. Crear un backup binario verificable de Engram, más una copia de configuración y
   checksums.
3. Instalar los nuevos binarios en un staging temporal, sin reemplazar los activos.
4. Validar `gentle-ai doctor`, `gentle-ai review mode status` y el inventario de
   assets antes de sincronizar.
5. Ejecutar la migración de Engram v2 sólo sobre una copia restaurada y comparar
   conteos, proyectos, observaciones y búsquedas.
6. Revalidar MCP, OpenCode V1, wrappers Hops, TUI, comandos, permisos y skills.
7. Recién después reemplazar los binarios activos y ejecutar `gentle-ai sync`.

No se debe usar `@latest` directamente en producción de la workstation sin
registrar primero la versión resuelta, checksum, release notes y procedimiento de
rollback.
