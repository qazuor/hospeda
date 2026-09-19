# Estado consolidado post-instalación limpia

Última verificación: 2026-09-19.

## Instalado y activo

- OpenCode CLI `1.18.31`, instalado como runtime operativo compatible con los
  plugins V1 de Gentle-AI. La instalación V2 `2.0.3` permanece respaldada para
  rollback y evaluación futura.
- Gentle-AI `2.9.0`, preset `full-gentleman`, persona `gentleman`.
- Engram `1.20.0`, con la DB histórica preservada y todavía sin saneamiento/apertura automática.
- OpenCode background subagents: no se usa como dependencia del flujo actual;
  el agente se abre sólo cuando `start-issue` recibe `--agent` explícito.
- Pi background subagents: desactivado.
- MCP administrados: Context7 y Engram.
- SDD, skills, agentes de review, permisos y logo TUI administrados por Gentle.
- La entrada `opencode-subagent-statusline` en `tui.json` no se resolvió en el
  filesystem y queda pendiente de validación; no se considera activa.

## Limpio por diseño

- No existe auth heredada de OpenCode (`auth.json`/`account.json`).
- La DB V1 opera separada de la DB V2 respaldada; ambas pasaron integridad
  SQLite en las comprobaciones read-only.
- OpenAI OAuth está configurado; Context7 y Engram aparecen conectados por MCP.
- Linear quedó conectado y se mantiene como integración externa; no se copian
  credenciales al repositorio.

## Configuración TUI

`~/.config/opencode/tui.json` fue restaurado para V1 con mouse desactivado, diff
automático, Home/End, Ctrl+Home/Ctrl+End, Ctrl+A/Ctrl+E, notificaciones sin
sonido y plugins TUI de Gentle. Falta una prueba visual interactiva.

## Preservado

- DB y binario Engram, backups Stage 0 y exports disponibles.
- Auditoría read-only de Engram sobre copia temporal completada; la memoria
  histórica todavía no fue saneada ni conectada como contexto automático.
- Claude Code, `.claude`, memorias file-based, skills y commands globales.
- CodeGraph e índices.
- Git, worktrees, `.specs`, scripts y documentación de Hospeda.

## Pendiente antes de integrar Hospeda

1. Resolver el bloqueo del filesystem root read-only y repetir los checks de
   persistencia/runtime en un entorno escribible.
2. Revalidar TUI en una sesión real iniciada por el launcher V1 y observar la
   rueda del mouse; `mouse=false` cambia la semántica de navegación conocida.
3. Sanear Engram sobre copias y probar restore/búsqueda. La ayuda de algunos
   subcomandos intenta migrar la DB, por lo que no se volverán a ejecutar sobre
   `~/.engram` directamente.
4. Configurar Linear explícitamente y probar sólo consultas read-only.
5. Desacoplar `hops` de `~/.claude` en el worktree de migración.
6. Añadir `AGENTS.md`, skills y commands de Hospeda.
7. Evaluar plugins comunitarios individualmente.

## Incidente de limpieza

`brew uninstall gentle-ai` ejecutó `autoremove` y retiró 53 fórmulas que Homebrew
consideraba huérfanas. No se reinstalaron automáticamente; su recuperación se
debe decidir por inventario y necesidad real.
