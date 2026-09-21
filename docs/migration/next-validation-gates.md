# Próximos gates de validación

Fecha: 2026-09-15.

Este documento ordena lo que todavía debe validarse antes de migrar tooling de
Hospeda. No autoriza por sí mismo cambios, importaciones ni mutaciones externas.

## Gate 1 — Integridad y rollback de Engram

- Trabajar únicamente sobre una copia de `~/.engram`.
- Engram `1.20.0` no tiene un subcomando `restore`; probar restauración mediante
  copia binaria de todo el directorio en una ubicación temporal.
- Usar `import` sólo en una prueba explícitamente separada: es mutante y no es
  equivalente a restaurar DB/WAL/SHM.
- Ejecutar `doctor` y export sobre esa copia, registrando schema y errores.
- No reparar, consolidar, importar ni borrar observaciones hasta revisar cada
  candidato individualmente.
- Mantener la DB original y todos sus archivos auxiliares intactos.

## Gate 2 — Validación interactiva de OpenCode (diagnóstico parcial completado)

- Probar una sesión aislada con el launcher de Gentle-AI.
- Confirmar que cargan el agente por defecto, MCPs, permisos y plugins esperados.
- Validar manualmente mouse desactivado, Home/End, Ctrl+A/E, Ctrl+Home/End,
  notificaciones y copia de mensajes.
- Confirmar que la TUI no inicia tareas, hooks ni sincronizaciones inesperadas.

Estado: diagnóstico de versión, launcher, rutas y TUI completado. La prueba
interactiva completa y la contradicción MCP/plugins quedan pendientes porque el
runtime intentó escribir un log global en un filesystem `EROFS`.

## Gate 3 — Política de permisos (auditoría completada; endurecimiento pendiente)

- Revisar el permiso global `bash: "*": "allow"` antes de usar OpenCode sobre
  Hospeda.
- Separar lectura, comandos reversibles, mutaciones locales y operaciones
  externas.
- Mantener bloqueados secretos, claves, credenciales y archivos `.env`.
- Definir qué operaciones requieren autorización explícita y cuáles deben estar
  prohibidas para el agente.

Estado: inventario read-only documentado en `opencode-permission-gate.md`. No se
modificó la política; el endurecimiento requiere una etapa aprobada.

## Gate 4 — Proveedores y modelos

- Configurar autenticación sólo después de decidir el routing.
- Usar OpenAI para tareas complejas.
- Evaluar GLM/DeepSeek únicamente para tareas simples, con datos sensibles
  excluidos y límites de contexto/costo documentados.
- Registrar modelo, proveedor, límites y fallback sin guardar secretos en Git.

Estado: baseline sin autenticación confirmado por inventario de archivos. Las
consultas CLI quedaron pendientes porque el runtime no pudo abrir su log global
(`EROFS`); ver `opencode-model-gate.md`.

## Gate 5 — Linear read-only

- Validar con una consulta segura que el adaptador identifica el equipo, estados
  y etiquetas esperados.
- No crear, actualizar ni cerrar issues durante esta prueba.
- Comparar la respuesta con `.claude/linear.json` y con el contrato de `hops`.
- Recién después diseñar el primer flujo mutante con `--plan` y confirmación.

Estado: inventario local y separación Claude/`hops` documentados. La consulta
remota read-only funcionó con HOS-1344 abierto; la derivación completa de
branch/slug quedó validada sin crear worktree.

## Gate 6 — Worktree y `hops`

- Ejecutar un preflight sobre una issue de prueba sin crear ni eliminar recursos
  permanentes.
- Verificar cálculo de branch, slug, puertos, variables referenciadas y estado
  de base de datos sin mostrar valores sensibles.
- Mantener `hops` como única autoridad para worktrees, servidores y limpieza.
- Probar lanzamiento explícito de OpenCode sin retirar todavía el launcher de
  Claude.

Estado: inspección de código y pruebas completada. Se confirmó que la autoridad
actual es `hops` más scripts de la skill worktree global; no se ejecutaron
mutaciones. La adaptación del launcher queda para la primera integración
versionada.

## Gate 7 — Memoria y conocimiento

- Revisar las memorias candidatas una por una usando la ficha de revisión.
- Contrastar cada regla con código, documentación, Linear y estado actual.
- Destinar reglas estables a `AGENTS.md`/skills, decisiones duraderas a Engram
  curado y estado operativo a Linear o `.specs`.
- Conservar `CLAUDE.md` y `MEMORY.md` como rollback hasta completar la auditoría.

Estado: metadatos y política revisados después de la limpieza. No se aprobó ni
se movió ninguna entrada; la revisión individual queda como fase posterior.

## Gate 8 — Primera integración versionada

La primera implementación debe ser pequeña y reversible:

1. contrato configurable del adaptador Linear;
2. launcher de `hops start-issue --agent opencode`;
3. comandos de diagnóstico sin mutación;
4. pruebas sobre un worktree temporal;
5. documentación y revisión antes de activar cierres automáticos.

No se deben introducir simultáneamente SDD, nuevos plugins, migración masiva de
skills, saneamiento de Engram y automatizaciones de cierre.

Estado: selección reversible `--agent opencode` agregada a `hops start-issue` en
el worktree. `client-tools` quedó validado con 299 tests y 737 assertions;
`server-tools`, con 334 tests y 501 assertions. No se ejecutaron workflows ni
mutaciones externas.

## Gate 9 — Complementos de seguridad y observabilidad (análisis completado)

- `cc-safety-net` y `opencode-ignore` quedan como candidatos para pruebas
  aisladas, comparando cobertura y falsos positivos con permisos nativos,
  `staged-secrets` y las reglas de `hops`.
- `opencode-sentry-monitor` queda opt-in y fuera del MVP; si se prueba, debe
  desactivar inputs/outputs y usar un proyecto Sentry separado.
- `mcp-system-monitor-js` queda fuera del núcleo; no habilitar su modo HTTP.

Estado: documentación y fuentes revalidadas el 2026-09-17. No se instaló ni
activó ningún complemento. La prueba sólo puede empezar después de aprobar una
matriz de permisos y aislamiento.
