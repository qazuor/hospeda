# Inventario runtime global (read-only)

Fecha: 2026-09-17.

La inspección mostró que la instalación global actualmente contiene configuración
de OpenCode, assets administrados por Gentle-AI, plugins globales, TUI y bases de
datos locales. Sólo se listaron rutas, tamaños, permisos y nombres de claves; no
se leyeron valores de autenticación, tokens ni secretos.

## OpenCode

`~/.config/opencode/` contiene `opencode.json`, `cli.json`, `tui.json`,
`AGENTS.md`, comandos SDD, temas y seis plugins globales:

- `engram.ts`
- `model-variants.ts`
- `opencode-review-transport.ts`
- `sdd-task-result-artifacts.ts`
- `skill-registry.ts`
- `telemetry-runtime.ts`

`~/.local/share/opencode/` contiene `opencode.db` y auxiliares SQLite, además
del log global. El log no puede abrirse en el runtime actual porque el
filesystem raíz está montado como read-only.

## Gentle-AI

`~/.gentle-ai/` contiene estado administrado, telemetría y el binario enlazado de
OpenCode. Las claves observadas incluyen preset, persona, modo SDD, agentes
instalados y banderas de background-subagents; no se muestran sus valores.

## Engram

`~/.engram/` contiene `engram.db` y sus archivos WAL/SHM, además de
`protocol-mode.json`. La DB no fue abierta ni modificada en este gate.

## Riesgos y siguiente gate

Antes de cualquier reinstalación futura hay que respaldar estos directorios y
separar configuración versionable, estado local, bases y autenticación. No se
debe copiar automáticamente todo `~/.config/opencode/` a una instalación limpia:
los plugins y el estado administrado deben revalidarse uno por uno.
