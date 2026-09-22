# OpenCode V2 — validación de instalación limpia (Gate 2)

Fecha: 2026-09-15

## Resultado

El binario activo es `opencode v2.0.3` y se ejecuta a través del launcher administrado por Gentle-AI (`~/.gentle-ai/bin/opencode`). El launcher habilita `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` si la variable no estaba definida y delega al binario instalado por npm. La sintaxis del launcher y de `~/.config/opencode/tui.json` es válida.

La instalación del ejecutable es nueva, pero el entorno efectivo todavía no es aislado de Claude: `opencode debug config` descubre `/home/qazuor/.claude`, el `.claude` del proyecto y `/home/qazuor/.agents`, además de la configuración global de OpenCode. Esto explica por qué una instalación limpia del binario no equivale a una configuración limpia del comportamiento.

## Rutas observadas

OpenCode reporta estas rutas de datos: `~/.local/share/opencode` (datos, base SQLite y logs), `~/.cache/opencode` (caché/binarios), `~/.config/opencode` (configuración), `~/.local/state/opencode` (estado), `/tmp/opencode` (temporales), `~/.local/share/opencode/repos` (repositorios) y `~/.local/share/opencode/opencode.db`.

La TUI actual valida JSON y conserva las decisiones acordadas: mouse desactivado, notificaciones de atención activas sin sonido, modo de diff automático, Home/End y Ctrl+Home/Ctrl+End con semántica normal. También referencia el statusline de subagentes y el logo de Gentle-AI; esos componentes deben auditarse antes de la limpieza final.

## Agentes, MCP y plugins

Ejecutando fuera del sandbox, `debug agents` terminó correctamente y produjo
6.172 líneas de configuración efectiva. Su salida es extensa y contiene
prompts/reglas, por lo que no se vuelca al reporte; el inventario nominal sigue
siendo el de la configuración auditada (23 agentes declarados). No se alteró
ningún archivo.

`opencode mcp list` informó que no hay servidores MCP activos y `opencode plugin list` informó que no hay plugins activos, aunque `opencode debug config` muestra claves de MCP (`context7` y `engram`) en la configuración global. La contradicción sigue vigente: una clave presente no demuestra que el runtime la use.

## Decisiones

1. No borrar todavía `.claude`, `.agents`, la configuración global ni la TUI. Son fuentes de comportamiento y deben entrar en el plan de retiro reversible.
2. Antes de instalar plugins o migrar más workflows, separar explícitamente configuración global reutilizable de configuración heredada de Claude.
3. Mantener la TUI versionada/documentada como decisión global, pero revisar si el plugin de statusline debe permanecer o si basta la funcionalidad nativa.
4. Repetir la validación de MCP/providers con un log escribible en una etapa posterior; esta ejecución no debe cambiar permisos ni crear logs globales.

## Referencias

- Documentación V2: <https://opencode.ai/v2/docs>
- Configuración: <https://opencode.ai/docs/config>
- TUI: <https://opencode.ai/docs/tui>
- Plugins: <https://opencode.ai/docs/plugins/>
