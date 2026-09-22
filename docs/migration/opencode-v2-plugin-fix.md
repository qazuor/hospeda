# Corrección de plugins V1 cargados en OpenCode V2

Fecha: 2026-09-18.

## Diagnóstico

OpenCode 2.0.3 cargaba seis archivos globales instalados por Gentle-AI:

- `engram.ts`
- `model-variants.ts`
- `opencode-review-transport.ts`
- `sdd-task-result-artifacts.ts`
- `skill-registry.ts`
- `telemetry-runtime.ts`

Todos importan `@opencode-ai/plugin` y exportan la forma V1. OpenCode V2 exige
un `default` con `id` y `setup()` (o `effect()`); el log confirmaba el mismo
error de esquema para cada archivo. La documentación oficial advierte que los
plugins V1 no funcionan en V2 y que renombrar/mover archivos no los migra.

La integración MCP de Engram es independiente y sí conectaba con 18 tools; no
se desactivó.

## Corrección reversible aplicada

- Backup en:
  `~/.local/state/hospeda-opencode-migration/backups/opencode-v2-plugin-fix-2026-09-18/`
- Plugins incompatibles movidos a:
  `~/.config/opencode/plugins-v1-disabled/`
- Se eliminó de `~/.config/opencode/cli.json` sólo la entrada huérfana
  `opencode-subagent-statusline`.
- Se conservó `gentle-logo.tsx`.
- Se reinició el servicio OpenCode.

## Verificación

Después del reinicio, OpenCode devuelve `No authenticated integrations` (estado
esperado antes del login), Engram MCP conecta con 18 tools y Context7 conecta
con 2 tools. No aparecen nuevos errores de carga de plugins ni de statusline en
el tail del log.

## Próximo trabajo

Los seis plugins no deben restaurarse. Si alguna capacidad sigue siendo
necesaria, se porta individualmente a V2, empezando por el adaptador de Engram
sólo si aporta algo que el MCP no cubre. No se debe ejecutar `gentle-ai sync`
hasta confirmar que su preset no vuelve a instalar los archivos V1.
