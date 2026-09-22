# Gate de complementos — candidatos prioritarios

Fecha: 2026-09-15

Este gate no instala plugins. Se actualiza la evaluación de los candidatos que
el usuario pidió considerar después de la instalación limpia.

| Proyecto | Tipo | Utilidad concreta | Riesgo/solapamiento | Decisión provisional |
|---|---|---|---|---|
| [OpenKilo](https://github.com/AnganSamadder/openkilo) | plugin/provider gateway | modelos gratuitos y gateway Kilo | red externa, disponibilidad y supply chain; no usar en datos sensibles | probar sólo en perfil experimental |
| [OpenChamber](https://github.com/openchamber/openchamber) | app UI sobre OpenCode server | interfaz web/desktop, sesiones y operación visual | segundo frontend y servidor; puede capturar entorno/auth | probar aparte, no núcleo de TUI |
| [opencode-pty](https://github.com/shekohex/opencode-pty) | plugin PTY + UI web | procesos interactivos y background observables | solapa con `hops servers`; shell, red local y procesos persistentes | sólo si `hops` no cubre un caso concreto |
| smart-voice-notify | plugin de notificaciones/TTS | avisos de finalización para sesiones largas | audio/red y solapamiento con atención nativa | piloto posterior, no requisito inicial |

## Decisión de arquitectura

`hops` sigue siendo autoridad para worktrees, DB y servidores. OpenChamber es
una interfaz opcional, no un reemplazo del TUI ni del lifecycle. PTY sólo se
incorpora si una prueba demuestra una carencia real de `hops`; no se habilita
para duplicar sus sesiones. OpenKilo queda aislado de tareas críticas y no debe
recibir secretos, datos de clientes ni código sensible. Las notificaciones de
voz esperan una validación de permisos, privacidad y utilidad.

La investigación actual confirma que OpenKilo se instala como plugin/provider y
usa el gateway `api.kilo.ai`; OpenChamber puede iniciar o conectarse a un
servidor OpenCode; `opencode-pty` respeta permisos `bash` y expone una UI web.
La compatibilidad exacta con `v2.0.3` y la actividad de smart-voice-notify
quedan no verificadas hasta una revisión específica del repositorio/release.

## Revalidación de repositorios — 2026-09-17

| Proyecto | Evidencia actual | Evaluación actualizada |
|---|---|---|
| OpenKilo | README ofrece 40+ modelos gratuitos vía `api.kilo.ai`, instala paquete npm global y guarda auth/cache fuera del repo; repositorio observado con 1 commit y 13 stars | **Interesante / probar aislado**. No usar para código sensible ni tareas críticas; gateway y disponibilidad son externos. |
| OpenChamber | Workspace multiplataforma con goals persistentes, multi-run, worktrees opcionales, preview y relay privado; repositorio con 3.613 commits, 1.1k forks y 434 issues | **Interesante / probar separado**. Duplica TUI, sesiones y parte de worktrees; no entra al núcleo inicialmente. |
| opencode-pty | PTYs persistentes, buffer de 50k líneas, WebSocket UI y notificación al salir; `ask` se trata como deny y `external_directory=ask` como allow | **No recomendado para el núcleo**. `hops` ya gobierna servidores/worktrees y el modelo de permisos tiene una asimetría relevante. |
| smart-voice-notify | TTS local/cloud, notificaciones desktop, webhooks, recordatorios y sonidos por proyecto; genera config/assets/logs automáticamente | **Interesante / piloto posterior**. La superficie de red/audio y configuración automática requieren aislamiento; la atención nativa cubre el caso básico. |

Fuentes: [OpenKilo](https://github.com/AnganSamadder/openkilo),
[OpenChamber](https://github.com/openchamber/openchamber),
[opencode-pty](https://github.com/shekohex/opencode-pty) y
[smart-voice-notify](https://github.com/MasuRii/opencode-smart-voice-notify),
consultadas el 2026-09-17. No se instaló ninguno.

## Utilidades menores y coordinación — 2026-09-17

| Proyecto | Evaluación | Decisión |
|---|---|---|
| `opencode-md-table-formatter` | Formatea tablas Markdown al finalizar la respuesta; útil sólo para tablas TUI y requiere hook `experimental.text.complete`. | **Redundante** con el renderer de artifacts y el Markdown nativo; no agregar otra transformación global. |
| `opencode-froggy` | Bundle V2 con hooks, muchos agentes, skills, comandos y herramientas (incluye Linear stale-check y TDD). | **No recomendado**: sociedad de agentes y comandos duplicados; Gentle y Hospeda ya tienen responsabilidades equivalentes. |
| `open-trees` | Gestor de worktrees con herramientas de crear/abrir/fork/limpiar y estado propio en `~/.config/opencode/open-trees/state.json`. | **Redundante/incompatible con la arquitectura elegida**: `hops` es la autoridad para worktrees, puertos, DB y cleanup. |
| `opencode-browser` | Plugin de automatización Chrome con skill de browser; 70 commits y 15 issues observados. | **Interesante / probar** sólo para QA visual, aislado del workflow base y con permisos browser explícitos. |
| `opencode-plugin-peers` | Mensajería entre sesiones, colas durables y auto-entrega de mensajes; los turnos inyectados auto-aprueban permisos por defecto. | **No recomendado inicialmente** por superficie de coordinación y riesgo de acciones no supervisadas; evaluar sólo si aparece un caso multi-sesión real. |
| `opencode-tell-sessions` | Mensajería directa entre sesiones, 45 commits y 2 PR abiertos. | **Redundante** frente a peers y handoff propio; no sumar dos buses de mensajes. |
| `opencode-smart-voice-notify` | TTS multi-engine, reminders, webhooks y sonidos; OpenCode ya ofrece notificaciones básicas. | **Interesante / piloto posterior**; mantener opt-in y preferir TTS local, sin credenciales cloud por defecto. |

Enfoque principal: una sola autoridad por capacidad (`hops` para worktrees y
workflow, artifacts para reportes, OpenCode/Gentle para agentes y review). Los
complementos de UI/browser/voz quedan aislados y sólo se prueban frente a un
caso de uso medible.

Fuentes: [table formatter](https://github.com/franlol/opencode-md-table-formatter),
[Froggy](https://github.com/smartfrog/opencode-froggy),
[Open Trees](https://github.com/0xSero/open-trees),
[opencode-browser](https://github.com/different-ai/opencode-browser),
[peers](https://github.com/jkrandom-sudo/opencode-plugin-peers),
[tell-sessions](https://github.com/ThomasSanna/opencode-tell-sessions) y
[smart voice](https://github.com/MasuRii/opencode-smart-voice-notify), consultadas
el 2026-09-17. No se instaló ninguno.

## Orquestación visual y gateways externos — 2026-09-17

| Proyecto | Hallazgo | Decisión |
|---|---|---|
| `octto` | UI browser de brainstorming con 14 tipos de preguntas, ramas paralelas y plan final; usa tres agentes y guarda diseños en `docs/plans/`. Tiene 244 commits y 502 stars. | **Interesante / probar** para exploración de features complejas, pero no instalar por defecto: solapa con artifacts y Gentle SDD. Si se prueba, usarlo sólo como frontend de preguntas y conservar `.specs`/SDD como fuente de verdad. |
| `openwork` | Plataforma remota/desktop y MCP con gateway externo, OAuth, skills y servicios compartidos; repositorio grande y muy activo. | **No recomendado para Hospeda inicialmente**: introduce control plane, autenticación y supply chain remota. No conectar código o credenciales del proyecto hasta una necesidad organizacional explícita. |
| `opencode-browser` | Automatiza Chrome y trae skill de browser; 70 commits, 15 issues y 4 PR observados. | **Prueba aislada de QA**; no convertirlo en dependencia de Linear/worktrees. |

La arquitectura mantiene artifacts para reportes interactivos y Gentle/SDD para
decisiones técnicas. Octto sólo podría complementar la etapa de preguntas; no
debe crear una segunda fuente de verdad ni otra jerarquía de agentes.

Fuentes: [octto](https://github.com/vtemian/octto),
[OpenWork](https://github.com/different-ai/openwork) y
[opencode-browser](https://github.com/different-ai/opencode-browser), consultadas
el 2026-09-17. No se instaló ninguno.

## Contexto, tokens y cuotas — 2026-09-17

| Proyecto | Hallazgo actual | Decisión |
|---|---|---|
| Dynamic Context Pruning | Compresión selectiva, deduplicación y purge de errores; desarrollo nuevo se mueve a Sleev, licencia AGPL-3.0, reduce cache hits en pruebas (aprox. 85% vs 90%) | **Interesante / probar aislado**, sólo después de medir contra compaction nativa; no activar junto con otro pruning. |
| TokenScope | Lee telemetría persistida de OpenCode, separa uso registrado de estimaciones, incluye subagentes, caché, skills y herramientas; verificado contra OpenCode 1.17.18 y requiere plugin >=1.1.48 | **Recomendado para probar primero** como analizador puntual. No instalar automáticamente: validar compatibilidad con V2. |
| mystatus | Consulta cuotas de OpenAI, Zhipu, Copilot y Google desde archivos de auth y APIs de proveedores | **Interesante / probar con cuidado**. Útil para statusline, pero toca auth y red; nunca mostrar tokens ni cuentas completas. |
| opencode-costs | Sidebar TUI con coste/tokens por agente, sólo proyecto/directorio actual, 4 commits y 3 stars | **No recomendado inicialmente**. Aporta una vista menor que TokenScope y su mantenimiento es débil. |

Enfoque principal recomendado: TokenScope para auditoría bajo demanda; métricas
nativas para la TUI; mystatus sólo si necesitamos cuotas de proveedores; DCP
queda como experimento separado y costs no se agrega.

Fuentes: [DCP](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning),
[TokenScope](https://github.com/ramtinJ95/opencode-tokenscope),
[mystatus](https://github.com/vbgate/opencode-mystatus) y
[costs](https://github.com/iamantonreznik/opencode-costs), consultadas el
2026-09-17. No se instaló ninguno.

## Planificación, review y UX de shell — 2026-09-17

| Proyecto | Hallazgo actual | Decisión |
|---|---|---|
| Plannotator OpenCode | UI local para anotar planes, feedback estructurado y revisión `submit_plan`; soporte V2 experimental, con fallback CLI y comprobación de updates contra GitHub sin opt-out | **Interesante / probar** para features complejas, pero no requisito base. Validar privacidad, puerto local y compatibilidad con SDD antes de activarlo. |
| CodeNomad | Cockpit desktop/server con sesiones, worktrees, voz, sidecars, auth y acceso remoto; servidor requiere password y puede usar HTTPS/autenticación | **No instalar junto a OpenChamber inicialmente**. Elegir una sola UI externa si aparece una necesidad concreta. |
| opencode-shell-strategy | Instrucciones para shell no interactivo, flags fail-fast, evitar pagers/REPLs y no saltar controles; v1.1.0 agrega verificación local sin dependencias | **Recomendado como referencia para un skill/AGENTS**, preferentemente vendorizado y revisado, no como instrucción remota viva. |

El enfoque principal sigue siendo: SDD/Gentle para planes y review, `hops` para
workflow determinista y reglas locales de shell para seguridad/ergonomía.

Fuentes: [Plannotator](https://github.com/backnotprop/plannotator/tree/main/apps/opencode-plugin),
[CodeNomad](https://github.com/NeuralNomadsAI/CodeNomad) y
[shell-strategy](https://github.com/JRedeker/opencode-shell-strategy), consultadas
el 2026-09-17. No se instaló ninguno.

## Complementos de workflow revisados — 2026-09-17

| Proyecto | Hallazgo | Decisión |
|---|---|---|
| `opencode-worktree` | Repositorio archivado el 16/09/2026, explícitamente V1-only y sin port a V2; recomienda usar worktrees nativos/Git. Su eliminación puede auto-commitear cambios. | **Incompatible/abandonado para este stack**. `hops` sigue siendo la autoridad. |
| `opencode-background-agents` | También archivado el 16/09/2026 y V1-only; recomienda subagentes background nativos de V2. Sólo permitía delegaciones read-only por límites de undo/branching. | **No instalar**. Gentle/OpenCode nativo cubren el caso y el usuario decidió no activar background agents. |
| `opencode-background` | Plugin archivado el 14/03/2026; mantiene procesos en memoria, con procesos globales y comandos shell persistentes. | **No recomendado**. Duplica lifecycle de `hops servers` y no ofrece mantenimiento actual. |
| `opencode-handoff` | Genera handoff con decisiones/archivos y puede leer la sesión anterior; nuestro `hops handoff` ya genera hechos, límites y marcadores BEGIN/END. | **Redundante**. Mantener implementación propia para integrar Linear/worktrees/specs. |

Fuentes: [opencode-worktree](https://github.com/kdcokenny/opencode-worktree),
[opencode-background-agents](https://github.com/kdcokenny/opencode-background-agents),
[opencode-background](https://github.com/zenobi-us/opencode-background) y
[opencode-handoff](https://github.com/joshuadavidthomas/opencode-handoff),
consultadas el 2026-09-17. No se instaló ninguno.

## Seguridad y observabilidad — 2026-09-17

| Proyecto | Tipo/superficie | Hallazgo verificado | Decisión para Hospeda |
|---|---|---|---|
| `cc-safety-net` | guard pre-ejecución para OpenCode y otros CLIs; también API embebible | Bloquea comandos destructivos y acceso a rutas sensibles antes de ejecutar; soporta OpenCode, rulebooks versionables y auditoría local. No establece permisos del sistema, no contiene red/procesos y no inspecciona texto enviado a una sesión persistente vía `write_stdin`. | **Interesante / probar aislado**. Primero evaluar su API como complemento de `hops` y de `staged-secrets`; no instalar el hook global sin comparar falsos positivos y cobertura. Si se adopta, el preset debe ser explícito y sus reglas versionadas. |
| `opencode-ignore` | plugin de control de acceso a archivos basado en `.ignore` gitignore-style | Intercepta `read`, `write`, `edit`, `list` y filtra `glob`/`grep`; permite negaciones y normaliza rutas. Si falta `.ignore`, permite todo. No protege shell ni garantiza seguridad del sistema operativo. | **Interesante / probar** para una política declarativa por proyecto, especialmente worktrees con archivos locales sensibles. No reemplaza permisos nativos ni `staged-secrets`; revisar primero interacción con `.gitignore` y riesgos de negaciones. |
| `opencode-sentry-monitor` | plugin de telemetría Sentry para sesiones, herramientas y tokens | Envía spans y métricas a Sentry; puede registrar inputs/outputs (redactados y truncados según README), usa DSN/config/env y red externa. La configuración permite apagar inputs/outputs y métricas. | **No recomendado inicialmente**. Sólo considerar con aprobación explícita de privacidad, proyecto Sentry separado y `recordInputs=false`/`recordOutputs=false`; no es necesario para el MVP porque ya tenemos logs y métricas locales. |
| `mcp-system-monitor-js` | MCP/HTTP server de observabilidad del host | Expone información de OS, CPU, memoria, disco, red, procesos, batería y USB; el modo HTTP puede quedar público si no se configura API key. La evidencia consultada muestra actualización v0.2.1 (2026-01-25). | **No recomendado**. Demasiada superficie de sistema y solapamiento con diagnóstico local de `hops`; sólo evaluar en un entorno aislado y estrictamente stdio/read-only si aparece una necesidad concreta. Nunca habilitar su HTTP público. |

Enfoque principal: mantener primero los permisos nativos de OpenCode, los guards
versionados de Hospeda y `hops`; sumar una única capa externa sólo después de una
prueba que demuestre una brecha concreta. `cc-safety-net` y `opencode-ignore`
son candidatos de evaluación, no dependencias del núcleo. Sentry queda opt-in y
sin payloads por defecto; el MCP de sistema queda fuera del stack base.

Fuentes: [CC Safety Net](https://github.com/kenryu42/cc-safety-net),
[opencode-ignore](https://github.com/lgladysz/opencode-ignore),
[opencode-sentry-monitor](https://github.com/stolinski/opencode-sentry-monitor) y
[mcp-system-monitor-js](https://github.com/DarkPhilosophy/mcp-system-monitor-js),
consultadas el 2026-09-17. No se instaló ninguno.

## Sesiones, contexto de tipos, entorno y visión — 2026-09-17

| Proyecto | Tipo y beneficio | Riesgo/solapamiento | Decisión |
|---|---|---|---|
| `opencode-senses` | plugin local de visión que autoinspecciona imágenes y ofrece OCR, detección, diff y anotación mediante runtime Python/Moondream; requiere GPU/Apple Silicon y descarga inicial aproximada de 3,9 GB | auto-provisiona venv/modelos, consume CPU/RAM/disco y puede descargar imágenes remotas; no está probado con el runtime actual | **Interesante / probar aislado** sólo si los modelos OpenAI no cubren una necesidad de screenshots. No habilitar autoInspect inicialmente. |
| `type-inject` | plugin/MCP TypeScript que inyecta firmas de tipos en lecturas y reporta errores en escrituras; prioriza tipos para reducir contexto | analiza código automáticamente en cada lectura/escritura, posible latencia y ruido; compatibilidad V2 actual no verificada | **Interesante / medir** contra TypeScript/Biome y el costo real de contexto antes de adoptarlo. |
| `opencode-direnv` | carga `.envrc` al crear sesión ejecutando `direnv export json` | ejecuta código de entorno del proyecto y puede introducir secretos en `process.env`; solapa con el setup de worktrees | **No instalar inicialmente**. Preferir `hops`/shell explícito y evaluar sólo con `.envrc` confiables y política documentada. |
| `opensession` | visor web de sesiones OpenCode; repositorio pequeño con 2 commits y 19 stars | segundo servidor/UI, actividad y seguridad limitadas; solapa con artifact server y OpenChamber | **No recomendado**. No aporta una necesidad que no cubran logs/artifacts. |
| `portal` | UI web con servidor OpenCode, terminal, Git, workspaces aislados y selección automática de puertos | cockpit adicional, terminal remoto y workspaces propios; solapa fuertemente con `hops` y OpenChamber | **No recomendado inicialmente**. Sólo investigar si necesitamos operación remota; no combinar con otro cockpit. |
| `opencode-handoff` | comando/plugin que genera prompt editable y puede leer sesiones previas | nuestro `hops handoff` ya incorpora Linear, worktree, hechos, límites y marcadores; duplica lifecycle | **Redundante**. Mantener `hops handoff`. |

La visión local merece una prueba sólo si aparece un gap real en QA visual; no
debe entrar en la instalación base por su runtime y descarga de modelos. Los
plugins que ejecutan `.envrc` o exponen sesiones web requieren una revisión de
seguridad antes de considerarse.

Fuentes: [OpenCode Senses](https://github.com/itsmeadarsh2008/opencode-senses),
[type-inject](https://github.com/nick-vi/type-inject),
[opencode-direnv](https://github.com/simonwjackson/opencode-direnv),
[OpenSession](https://github.com/R44VC0RP/opensession), [Portal](https://github.com/hosenur/portal)
y [opencode-handoff](https://github.com/joshuadavidthomas/opencode-handoff),
consultadas el 2026-09-17. No se instaló ninguno.
