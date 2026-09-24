# Comparación de harnesses: OpenCode, Codex, Claude Code y Gentle Shell

Fecha de relevamiento: 2026-09-24. El alcance es el **harness**: interfaz, control de sesiones, herramientas, extensiones, permisos, automatización, memoria, worktrees e integración con el repositorio. No se comparan modelos, calidad de inferencia ni precios.

## Versiones locales relevadas

| Harness | Versión local | Observación |
|---|---:|---|
| OpenCode | 1.18.32 | Es la instalación V1 que elegimos mantener por compatibilidad con Gentle-AI. La documentación oficial actual está orientada a V2; sus capacidades no deben asumirse automáticamente en V1. |
| Codex CLI | 0.155.1 | CLI local de OpenAI, con sandbox y aprobación como límites de seguridad principales. |
| Claude Code | 2.1.282 | CLI maduro con hooks, plugins, subagentes, equipos, MCP y worktrees nativos. |
| Gentle-AI | 3.7.0 | No es un cuarto harness base: instala y coordina capacidades sobre distintos clientes. Su release actual es del 23-09-2026. |
| Gentle Shell | no instalado | Harness separado, construido sobre Pi. No es un plugin de OpenCode ni una capa de OpenCode. |

## Qué se está comparando

OpenCode, Codex y Claude Code son clientes/harnesses interactivos que abren sesiones de trabajo sobre un repositorio. Gentle Shell es una experiencia completa basada en Pi. Gentle-AI es una capa de metodología, configuración y automatización que puede convivir con más de un cliente; no debe confundirse con Gentle Shell.

## Matriz funcional detallada

Estados usados: **Nativo** significa que forma parte del harness; **Extensión** significa plugin/MCP/configuración; **Externo** significa que debe vivir en `qz/hops` o en otro servicio; **Caveat** indica una diferencia de versión o un límite relevante.

| Capacidad | OpenCode | Codex CLI | Claude Code | Gentle Shell |
|---|---|---|---|---|
| Interfaz principal | TUI y CLI; arquitectura cliente/servidor en evolución | TUI/CLI local; modos interactivo y no interactivo | CLI/TUI, además de integraciones de escritorio | TUI de Pi con workspace propio |
| Ejecución headless | CLI y sesiones automatizables | Modo no interactivo, app-server y GitHub Actions documentados | CLI y automatización mediante hooks/CI | Posible vía Pi, pero su foco es interactivo |
| Configuración global | `~/.config/opencode`; precedencia global, proyecto y subdirectorios | `~/.codex/config.toml`, perfiles y políticas administradas | `~/.claude`, `~/.claude.json` y settings globales | `~/.gentle-shell/agent`; puede enlazar `~/.pi/agent` |
| Configuración por proyecto | `opencode.json`, `.opencode/` y `AGENTS.md` | `AGENTS.md`, configuración del proyecto y skills | `.claude/`, `CLAUDE.md`, reglas, settings y `.mcp.json` | Workspace Pi y archivos administrados por Gentle |
| Instrucciones persistentes | `AGENTS.md`; el campo `instructions` existe pero la doc actual dice que no carga entradas, por lo que se debe usar `AGENTS.md` | `AGENTS.md` con jerarquía global/proyecto/subdirectorio | `CLAUDE.md` cargado al inicio; reglas con alcance por path | Instrucciones/skills de Pi y Gentle |
| Skills | Nativo: global, proyecto, URLs y `.opencode/skills` | Nativo: directorios de skills y registro de skills | Nativo: skills con descripción cargada y cuerpo bajo demanda | Nativo dentro del ecosistema Pi/Gentle |
| Commands/prompts reutilizables | Nativo: `.opencode/commands` y comandos globales | Slash commands y prompts configurables; automatizaciones más complejas suelen ir a scripts | Comandos `.claude/commands`, skills invocables y plugins | Comandos/skills Pi; ODD guía la ruta |
| Agentes especializados | Nativo: agentes primarios/subagentes, archivos Markdown, permisos propios | Agentes y perfiles; documentación actual incluye approvals, skills, hooks y plugins | Subagentes aislados, agent teams peer-to-peer y plugins | Agentes enfocados de Gentle, gestionados por Pi |
| Herencia de permisos entre agentes | Cada subagente usa su propia configuración; el padre no limita automáticamente al hijo | Sandbox/approvals y políticas del entorno controlan la ejecución | Permisos y modos del subagente; el aislamiento es explícito, no una garantía universal | Depende de Pi y de cómo se provisionen los agentes |
| Hooks de ciclo de vida | Disponible en el ecosistema actual mediante plugins/configuración; validar superficie exacta en V1 | Hooks documentados y gobernables; administradores pueden exigir hooks aprobados | Muy completo: comandos, HTTP, MCP tools, prompts y subagentes, con eventos de ciclo de vida | Review/guardrails propios de Gentle/Pi |
| MCP | Servidores locales/remotos, OAuth, env, timeouts y configuración de herramientas | MCP documentado en configuración y CLI | MCP nativo, `.mcp.json`, scopes y plugins | Puede usar MCP a través de Pi, pero no es su abstracción central |
| Plugins | Plugins locales y desde paquetes/configuración; supply chain a evaluar | Plugins/marketplaces en la CLI actual; superficie todavía en evolución | Plugins y marketplaces maduros que agrupan skills, hooks, subagentes y MCP | Paquetes Pi/Gentle; no plugins de OpenCode |
| Marketplace/paquetización | Paquetes npm y configuración local; menos opinión sobre distribución | Marketplace de plugins y paquetes administrables | Marketplace oficial/comunitario y plugins empaquetados | Provisionamiento de paquetes Pi/Gentle |
| Permisos interactivos | Reglas allow/ask/deny ordenadas; shell, edit, web, MCP y subagentes | Approval policy + sandbox; Suggest, Auto Edit y Full Auto | Modos default, plan, acceptEdits, auto/bypass; reglas de permisos | La política se reparte entre Pi, Gentle y el shell |
| Sandbox | Depende de configuración/entorno; no asumir aislamiento fuerte en V1 | Es la frontera de seguridad más clara: sandbox y approvals separados; Full Auto restringe red y cwd | Permisos fuertes, pero no equivale siempre a sandbox de sistema | No reemplaza un sandbox del SO; depende de Pi/entorno |
| Seguridad de subprocesos | Caveat: un agente hijo puede tener permisos más amplios si así está configurado | Políticas y approvals centralizados, con soporte administrado | Hooks y plugins pueden ejecutar shell/HTTP; requieren revisión de supply chain | Agentes, review y shell comparten el entorno Pi |
| Worktrees | Git/worktree integrado en la configuración actual; plugins pueden cambiar la estrategia | Documentación actual incluye Git worktrees | Worktrees nativos, `.worktreeinclude` y worktrees de escritorio/CLI | Workspace de Pi; no es equivalente a nuestro `wt-create` |
| Worktree operativo | No resuelve por sí solo env, DB template, puertos, health checks ni cleanup de Hospeda | Tampoco; requiere `qz/hops` | Tampoco; el worktree nativo no conoce nuestro PostgreSQL ni scripts | Workspace propio, pero no conoce el contrato Hospeda |
| Snapshots/undo | Snapshots y revert documentados en V2; validar qué ofrece 1.18.32 | Git/sesiones y recuperación; no usarlo como reemplazo de Git | Checkpoints, sesiones y recuperación; Git sigue siendo la fuente de verdad | Historial Pi/Gentle; no sustituye Git |
| Reanudar sesiones | Sesiones y servidor local; soporte varía entre V1/V2 | Resume de sesiones y app-server | Reanudar sesiones, auto-archive de sesiones cerradas | Estado del workspace Pi |
| Compaction/contexto | Compaction automática/local/provider-native en docs V2; validar en V1 | Gestión de contexto y compaction del runtime | Compaction y memoria de sesión integradas | Pi/Gentle gestionan contexto y memoria |
| Memoria persistente | No es una base de memoria por sí mismo; usar Engram/MCP | No es una base de memoria por sí mismo; usar Engram/MCP | Auto-memory y archivos locales; Engram puede agregarse por MCP | Memoria/skills integrados en el ecosistema Gentle/Pi |
| Estado estructurado para herramientas | MCP, comandos y scripts; `qz/hops` debe emitir JSON estable | MCP, app-server y scripts; buena opción para automatización | Hooks/MCP/commands; salida puede requerir normalización | Pi tool calls y estado Gentle |
| Browser/web | MCP/plugins o herramientas externas | MCP/browser externo | MCP/browser/plugins; ecosistema amplio | Depende de Pi y paquetes |
| Archivos multimedia | Configuración actual de OpenCode contempla media; validar versión | Entrada multimodal soportada por la CLI | Soporte de archivos/adjuntos en CLI y superficies asociadas | Depende de Pi |
| Git/GitHub | Herramientas y plugins; política de entrega debe vivir en `qz/hops` | Integración GitHub/Actions documentada | Integración GitHub, PRs, revisión y automatización | No es un gestor de entrega propio |
| Linear | MCP o `qz/hops`; no debe acoplarse a un cliente | MCP/API o `qz/hops` | MCP/API/hooks o `qz/hops` | No aporta un conector Linear propio |
| Review y gates | Permisos, agentes y plugins; nuestros guards deben ser scripts deterministas | Auto-review/security y approvals documentados | Hooks, subagentes, review y plugins; muy flexible | Review guardrails y TDD integrados en Gentle |
| TDD/evidencia | No es una metodología propia; integrar en skills/commands | No impone TDD; integrar en scripts/skills | No impone TDD; integrar en skills/hooks | Gentle Shell lo presenta como parte del flujo |
| Background agents | Subagentes; plugins pueden aportar background | Agentes y app-server; revisar costo/aislamiento por caso | Agent teams y subagentes paralelos maduros | Agentes enfocados/background dentro de Pi |
| Notificaciones/statusline | TUI configurable y plugins | CLI/app-server; status depende de extensiones | Statusline, hooks y extensiones | Status/uso/diff son parte de la experiencia Pi |
| Telemetría/observabilidad | Depende de plugins/configuración | OpenTelemetry y logs documentados en el ecosistema | Hooks/logs y opciones de organización; revisar políticas | Depende de Pi/Gentle |
| Neutralidad de proveedor | Alta a nivel de harness; proveedores se configuran aparte | Baja/media: el producto está centrado en OpenAI aunque admite integraciones | Baja/media: centro de gravedad Anthropic | Baja: Pi + Gentle |
| Portabilidad de instrucciones | `AGENTS.md` + scripts portables | `AGENTS.md` + scripts portables | `CLAUDE.md`/rules requieren adaptador o migración | Requiere Pi/Gentle |
| Portabilidad de workflows | Alta si el workflow vive en `qz/hops` | Alta si se invoca `qz/hops` | Alta si se invoca `qz/hops` | Baja para workflows diseñados fuera de Pi |
| Coste de extensibilidad | Configuración/plugin/MCP; revisar compatibilidad V1/V2 | Skills/MCP/hooks/plugins; APIs oficiales en expansión | Hooks/plugins/marketplaces muy completos, pero mayor superficie | Ecosistema integrado, pero otro runtime |
| Riesgo de lock-in | Medio por versión y plugins, bajo si la autoridad es `qz/hops` | Medio por CLI/ecosistema OpenAI | Alto si la lógica queda en hooks/CLAUDE.md/plugins | Alto: Pi + Gentle Shell + estructura propia |
| Encaje con Hospeda | Alto como TUI principal junto a Gentle-AI y `qz/hops` | Alto como cliente secundario seguro y compatible con `AGENTS.md` | Alto como compatibilidad/rollback, no como autoridad futura | Bajo mientras el proyecto excluya Pi |

## Fortalezas y límites por harness

### OpenCode

Es el mejor candidato para la interfaz diaria de Hospeda porque combina TUI, configuración por proyecto, MCP, skills, commands, agentes y plugins sin obligar a que el workflow pertenezca a un proveedor de modelos. Su principal riesgo no es funcional sino de compatibilidad: tenemos V1 instalada y la documentación actual describe V2. Por eso no debemos copiar configuraciones V2 sin una prueba explícita en 1.18.32.

OpenCode debe ser el **cliente interactivo**, no la autoridad de branches, Linear, env, bases, puertos ni closeout. Esa autoridad debe permanecer en `qz/hops`, con salida JSON para los agentes y salida humana para nosotros. La existencia de snapshots, worktrees nativos o agentes no justifica crear una segunda implementación de esos flujos.

### Codex CLI

Su diferencia más valiosa es la frontera de seguridad: approvals y sandbox son conceptos separados y explícitos. La CLI también tiene `AGENTS.md`, skills, MCP, hooks, plugins, perfiles, modo no interactivo, app-server, integraciones de GitHub y documentación para worktrees. Esto lo vuelve un cliente secundario muy útil para tareas acotadas, validaciones y operaciones donde queremos máxima fricción antes de ejecutar shell.

No conviene convertirlo en la autoridad del proyecto. La CLI evoluciona rápido, su centro de gravedad es OpenAI y la superficie de plugins/marketplaces todavía debe validarse en cada actualización. El mismo `AGENTS.md`, los mismos scripts `qz/hops` y los mismos guards permiten usar Codex sin duplicar workflows.

### Claude Code

Es el harness más completo en automatización de ciclo de vida: reglas por path, skills bajo demanda, commands, subagentes aislados, agent teams, MCP, plugins, hooks de comandos/HTTP/MCP/prompt/subagente, memoria y worktrees. Esa riqueza explica por qué nuestro entorno anterior acumuló tanta lógica.

El coste es el acoplamiento: si la lógica de negocio de Hospeda queda en hooks, `CLAUDE.md`, plugins o memoria específica de Claude, volveremos a tener divergencia entre clientes. Claude debe quedar como cliente de compatibilidad y rollback mientras validamos OpenCode/Codex; los comandos comunes deben invocar `qz/hops` y los guards deben funcionar fuera de Claude.

### Gentle Shell

No es “Gentle-AI para OpenCode”. Es un harness Pi-native que integra ODD, agentes enfocados, estado, diff/uso, memoria, review y TDD dentro de su propia experiencia. Tiene sentido si elegimos Pi como runtime principal. Con OpenCode V1 como base, instalar Gentle Shell agregaría otra TUI, otro home de agente, otra forma de administrar sesiones y otra superficie de plugins.

Para Hospeda lo dejaría fuera por ahora. Podemos adoptar sus ideas de ODD, revisión y evidencia mediante Gentle-AI + `qz/hops` sin introducir el runtime Pi. Se debe reevaluar sólo si decidimos cambiar de OpenCode a Pi, no como complemento casual.

## Puntuación para Hospeda

Puntuación de 1 a 5, sólo para el uso del harness con nuestra arquitectura (no mide modelos):

| Criterio | OpenCode | Codex | Claude Code | Gentle Shell |
|---|---:|---:|---:|---:|
| Encaje con `AGENTS.md` común | 5 | 5 | 3 | 2 |
| Seguridad nativa y control de shell | 4 | 5 | 4 | 3 |
| Extensibilidad | 5 | 4 | 5 | 4 |
| MCP/integraciones | 5 | 4 | 5 | 3 |
| Workflows portables | 5 | 5 | 4 | 2 |
| Worktrees propios de Hospeda | 3 (con `qz/hops`) | 3 (con `qz/hops`) | 3 (con `qz/hops`) | 2 |
| Madurez para uso diario | 4 | 4 | 5 | 3 |
| Riesgo de lock-in | 4 | 3 | 2 | 2 |
| Compatibilidad con nuestra decisión ODD | 5 | 4 | 3 | 5 |
| **Resultado recomendado** | **4.5** | **4.1** | **3.9** | **2.9** |

Las puntuaciones no significan que un harness sea “mejor” en abstracto. Claude gana en amplitud madura; Codex gana en la frontera sandbox/approval; Gentle Shell gana si se elige Pi; OpenCode gana como base neutral para nuestra arquitectura concreta.

## Arquitectura recomendada

1. **OpenCode V1**: harness interactivo principal durante esta etapa de migración.
2. **Gentle-AI 3.7.0**: capa de ODD, memoria Engram y componentes opcionales; SDD/OpenSpec sólo cuando se pida de forma explícita.
3. **`qz/hops`**: autoridad portable para Linear, start/close issue, worktrees, env, DB template, puertos, guards, promoción de branches, handoff, recap y reportes.
4. **Codex CLI**: cliente secundario para tareas seguras, automatización no interactiva y validaciones donde sandbox/approval sea prioritario.
5. **Claude Code**: compatibilidad y rollback hasta cerrar la migración; no agregar lógica nueva exclusiva de Claude.
6. **Gentle Shell**: no instalar ahora; reevaluar sólo con una decisión explícita de adoptar Pi como harness principal.

La regla de diseño es: **el harness ofrece la sesión; el repositorio y `qz/hops` ofrecen el proceso**. Así cambiar de OpenCode a Codex o Claude no cambia el estado de Linear, branches, worktrees, bases ni evidencias.

## Decisión

Continuar con OpenCode como harness principal, Codex como segundo cliente de seguridad/automatización, Claude Code como compatibilidad temporal y Gentle Shell fuera del stack actual. No migrar workflows de Hospeda a features exclusivas de ningún harness. Mantenerlos en scripts versionados y adaptadores delgados para cada CLI.

## Fuentes primarias consultadas

- [OpenCode configuration](https://opencode.ai/v2/docs/config), [agents](https://dev.opencode.ai/v2/docs/agents/), [plugins](https://opencode.ai/docs/plugins/) y [MCP servers](https://opencode.ai/docs/mcp-servers/).
- [Codex repository](https://github.com/openai/codex), [CLI approvals and sandbox](https://help.openai.com/en/articles/11096431), [Codex security](https://developers.openai.com/codex/security), [skills](https://developers.openai.com/codex/skills), [AGENTS.md](https://developers.openai.com/codex/guides/agents-md), [MCP](https://developers.openai.com/codex/mcp) y [plugin CLI](https://github.com/openai/codex/blob/main/codex-rs/cli/src/plugin_cmd.rs).
- [Claude Code project configuration](https://code.claude.com/docs/fr/claude-directory), [skills/hooks/rules/subagents](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more), [power-user capabilities](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips) y [FAQ](https://support.claude.com/en/articles/14554922-claude-code-user-faq).
- [Gentle-AI intended usage](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/intended-usage.md), [trigger rules](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/trigger-rules.md), [releases](https://github.com/Gentleman-Programming/gentle-ai/releases), [Gentle Shell](https://github.com/Gentleman-Programming/gentle-shell) y [Pi integration](https://github.com/Gentleman-Programming/gentle-ai/blob/main/docs/pi.md).
