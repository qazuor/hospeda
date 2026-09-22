# Plan de migración: OpenCode V1 + Gentle-AI + Engram

Estado: planificación + Stage 0/instalación base ejecutados. Este documento ya no describe un entorno intacto: la limpieza global y reinstalación inicial se registran en el execution log. Las etapas de integración Hospeda siguen pendientes.

Última revisión: 2026-09-15.

## Propósito

Definir una migración reversible desde Claude Code hacia OpenCode V1 y Gentle-AI, preservando el conocimiento y los workflows valiosos de Hospeda, reduciendo duplicación y manteniendo Git como fuente de verdad técnica. V1 es la línea operativa temporal porque Gentle-AI 2.9.0 todavía depende de sus plugins V1.

Este documento separa decisiones y trabajo futuro de las operaciones ya ejecutadas. Las acciones nuevas siguen requiriendo una etapa explícita y registro en el execution log.

## Decisiones adoptadas

- El runtime operativo será OpenCode V1.18.31 hasta que Gentle-AI publique y valide plugins V2 compatibles. V2 queda respaldado, no eliminado.
- Gentle-AI será la base del ecosistema, instalado con sus componentes seleccionados y mantenido con un procedimiento explícito de actualización y sincronización.
- Engram se preservará antes de abrirlo con una versión nueva. La DB original no se usará para pruebas de migración.
- OpenAI por suscripción será el proveedor principal para tareas complejas.
- GLM, DeepSeek y Kilo se evaluarán para tareas simples, con límites de datos, costo y riesgo.
- Linear, `hops`, worktrees y el lifecycle de Hospeda seguirán siendo una capa propia versionada y neutral respecto del agente.
- El gestor existente de worktrees seguirá siendo el dueño de DBs, puertos, servidores y cleanup.
- `.specs` se conservará. Gentle SDD se probará para features complejas, sin conversión masiva ni reemplazo automático de la historia existente.
- Task-master no se migrará inicialmente. Se comparará con Gentle SDD antes de decidir si conservar partes de su comportamiento.
- `AGENTS.md` será la fuente principal de instrucciones para OpenCode y permanecerá corto.
- `AGENTS.md` será la única fuente de instrucciones compartidas; no se mantendrá `CLAUDE.md`.
- El conocimiento especializado se moverá a skills bajo demanda.
- La configuración TUI validada actualmente vive en `~/.config/opencode/tui.json`; no asumir `cli.json` sin verificar el esquema de la versión instalada.
- La TUI objetivo tendrá mouse desactivado, diff automático, Home/End normales, Ctrl+A/Ctrl+E para línea, Ctrl+Home/Ctrl+End para el buffer, notificaciones visuales y sonido desactivado.
- No se instalarán dos gestores de worktrees, dos sistemas de memoria ni varios orquestadores de agentes para resolver el mismo problema.
- No se retirará Claude Code hasta que el nuevo flujo pase validaciones integrales y exista rollback probado.

## Arquitectura objetivo

```text
Repositorio global de tooling
├── OpenCode V2
├── configuración de TUI y proveedores sin secretos
├── Gentle-AI y política de actualización
├── integración genérica de Linear
├── lifecycle genérico de worktrees
├── permisos y guards generales
└── plugins generales fijados por versión

Repositorio Hospeda
├── AGENTS.md
├── AGENTS.md
├── .opencode/
│   ├── skills/
│   ├── commands/
│   ├── agents/
│   └── plugins/             # solo código específico de Hospeda
├── .specs/
├── docs/
├── scripts/client-tools/
├── configuración HOS de Linear
└── adaptadores de DB, puertos, apps, smoke y deploy

Servicios externos
├── Linear
├── GitHub
├── Engram local
├── OpenAI y proveedores secundarios
├── Sentry
└── infraestructura de Hospeda
```

La configuración global reusable no debe terminar mezclada con reglas propias de Hospeda. Los secretos, tokens, cookies, DBs operativas y bases de memoria no se versionarán en Git.

### Fronteras de propiedad

| Capa | Debe contener | No debe contener |
|---|---|---|
| Global/tooling | OpenCode, Gentle, TUI, routing, plugins genéricos y permisos base | reglas HOS, nombres de tablas de Hospeda, Linear hardcodeado |
| Hospeda | `AGENTS.md`, skills de dominio, adaptadores HOS, `hops`, `.specs`, smoke y deploy | tokens, auth global, DB Engram, preferencias de otros repos |
| Externa | Linear, GitHub, Engram, providers, Sentry e infraestructura | lógica de dominio que sólo puede verificarse en el repo |

La integración genérica de Linear y el lifecycle de worktrees deberían vivir en
un repositorio de tooling reusable, con adaptadores configurables para Hospeda.
Los comandos/skills que describen arquitectura, rutas, billing o smoke de HOS
deben permanecer en este repositorio.

## Diferencia OpenCode V1 / V2

La instalación activa validada es OpenCode V1 (`1.18.31`). V2 (`2.0.3`) permanece respaldado para una futura migración cuando Gentle-AI publique plugins compatibles.

OpenCode V2 introduce cambios incompatibles en:

- permisos: `permission`/`bash`/`task` pasan al modelo ordenado `permissions` con acciones como `shell` y `subagent`;
- plugins: el API V1 no funciona automáticamente en V2;
- configuración de TUI: la documentación y el binario instalados deben verificarse juntos; la configuración activa validada usa `tui.json`;
- agentes: nuevos campos, modos y permisos por agente;
- configuración de plugins: `plugins` y objetos de opciones;
- instrucciones: `AGENTS.md` es la única fuente compartida; no se mantiene `CLAUDE.md`.

Por eso no se copiarán configuraciones ni plugins V1 literalmente. Se conservarán backups separados y se portarán los componentes necesarios.

## TUI objetivo

La configuración validada actualmente es:

```json
{
    "$schema": "https://opencode.ai/tui.json",
  "mouse": false,
  "diff_style": "auto",
  "attention": {
    "enabled": true,
    "notifications": true,
    "sound": false
  },
  "keybinds": {
    "input_line_home": "home,ctrl+a",
    "input_line_end": "end,ctrl+e",
    "input_buffer_home": "ctrl+home",
    "input_buffer_end": "ctrl+end"
  }
}
```

El statusline se considera una capa separada: modelo, contexto, cuota, subagentes, Engram, branch, worktree y estado de `hops`. La configuración global se versionará en el repositorio de tooling; los indicadores HOS específicos quedarán en la capa Hospeda.

## Engram

### Estado conocido

La instalación actual contiene una DB SQLite con observaciones, sesiones, prompts y datos de sincronización. Se detectaron nombres separados para Hospeda, Hospeda2, Hospeda3, `tmp` y worktrees. No se debe asumir que todo pertenece al mismo proyecto.

### Política

Engram debe ser memoria curada, no un depósito de transcripciones. Se guardarán decisiones, descubrimientos, bugs complejos, restricciones duraderas, convenciones y handoffs útiles. No se capturarán indiscriminadamente logs, comandos, tests repetidos ni cada turno del agente.

### Limpieza segura futura

1. Detener escritores y registrar versiones.
2. Respaldar todo `~/.engram`, incluyendo DB, WAL y SHM.
3. Crear backup SQLite consistente, export lógico y checksums.
4. Probar restauración en otra ubicación.
5. Trabajar sobre una copia.
6. Usar `engram tui` para explorar y buscar.
7. Revisar nombres, duplicados, contradicciones y observaciones ruidosas.
8. Usar consolidación de proyectos solo con pertenencia confirmada.
9. Preferir actualización o borrado lógico antes que destrucción definitiva.
10. Validar búsquedas antes de activar la memoria depurada.

La DB original nunca será el primer objeto de prueba de una versión nueva.

Los `MEMORY.md` de Claude se clasificarán antes de importar:

- reglas universales → `AGENTS.md`;
- conocimiento especializado → skills;
- decisiones históricas → Engram;
- invariantes comprobables → guards o tests;
- procedimientos deterministas → scripts/commands;
- pendientes → Linear;
- contenido obsoleto → archivo histórico.

No se importarán completos como observaciones gigantes.

## Linear, `hops` y worktrees

### Linear

La recomendación es una arquitectura híbrida:

- API/CLI propia para operaciones deterministas y transiciones;
- MCP oficial para consultas, búsqueda y trabajo conversacional;
- un único contrato de estados, labels y validación;
- lectura posterior a cada mutación importante;
- preview antes de crear o modificar issues.

La integración genérica aceptará equipo, prefijo, estados, labels, ramas, artefactos y gates como configuración. Hospeda aportará sus adaptadores HOS.

### `startIssue`

El núcleo debería:

1. normalizar la issue;
2. consultar y validar Linear;
3. resolver asociación HOS ↔ branch ↔ worktree;
4. actualizar la referencia base de forma verificable;
5. crear o reutilizar worktree;
6. preparar DB, entorno, servidores y puertos;
7. registrar estado estructurado;
8. abrir OpenCode en el directorio correcto.

El command `/startIssue` será un adaptador breve. No debe duplicar el gestor de recursos.

### `closeIssue`

El cierre se separará en:

- evaluar evidencias;
- validar tests, review y smoke;
- registrar closeout;
- actualizar Linear con read-back;
- ejecutar cleanup explícito y reintentable.

No se eliminará la DB del worktree antes de confirmar que el resto del teardown puede continuar. Un cierre repetido debe ser idempotente.

### Worktrees

`hops` seguirá siendo el único dueño de:

- naming;
- DB por worktree;
- puertos;
- variables de entorno;
- servidores;
- inventario;
- cleanup.

No se incorporarán `opencode-worktree` ni `open-trees` como segundo sistema.

## Specs y Gentle SDD

Se usará un modelo híbrido:

### Cambios pequeños

```text
Linear → hops start → implementación → tests → smoke si aplica → close
```

### Cambios complejos

```text
Linear HOS-NNN
→ exploration
→ proposal
→ spec/design
→ tasks
→ implementation
→ verification
→ closeout
→ archive
```

Gentle SDD podrá administrar fases de trabajo. `.specs` conservará el vínculo técnico, la identidad HOS, la aceptación, dependencias, smoke y closeout. No se hará conversión masiva de specs históricas.

Task-master se mantendrá fuera de la instalación inicial y se evaluará con tres tareas piloto: bug pequeño, feature multi-app y cambio de DB/billing.

## Conocimiento y skills

`AGENTS.md` tendrá solo arquitectura, invariantes, convenciones universales, comandos principales, seguridad y referencias.

Los skills se agruparán por necesidad:

- arquitectura general;
- web/Astro;
- API/Hono;
- admin/TanStack;
- DB/Drizzle/Postgres;
- schemas/Zod;
- i18n;
- testing;
- CI/deploy;
- Linear/workflow;
- billing/MercadoPago;
- auth;
- observabilidad;
- performance;
- seguridad;
- documentación y UI.

Cada skill indicará cuándo cargarlo, sus fuentes, invariantes y verificaciones. No duplicará todo `AGENTS.md` ni copiará código completo.

Los 17 agentes Claude no se migrarán uno a uno. La base tendrá Build/Plan, un reviewer read-only y agentes especializados solo cuando una prueba demuestre valor.

## Guards y pre-commit

Los controles deterministas tendrán prioridad sobre instrucciones repetidas:

- escaneo de secretos staged sin imprimir valores;
- imports y límites entre paquetes;
- traducciones y placeholders;
- schema de specs;
- estados de smoke;
- branches protegidas;
- archivos generados;
- configuración inválida;
- DB objetivo y destino de operaciones.

El pre-commit será rápido. Builds completos, E2E, review con modelo y consultas externas irán a `hops verify`, pre-push o CI.

`cc-safety-net` se evaluará como defensa adicional, no como sandbox ni sustituto de permisos OpenCode.

## Codegraph

Se evaluará su integración con OpenCode V2 porque actualmente está instalado y el proyecto declara soporte para OpenCode.

Condiciones:

- configuración V2 revisada manualmente;
- índice y frescura visibles;
- fallback seguro a `rg`/LSP;
- no bloquear desarrollo si el índice falla;
- definir si el índice representa clone principal o cada worktree;
- medir costo de CPU, disco, memoria y tokens.

No se ejecutará un instalador automático que modifique Claude y OpenCode simultáneamente.

## Plugins

Orden de evaluación:

1. Tokenscope;
2. OpenChamber;
3. `opencode-pty`;
4. Plannotator;
5. `cc-safety-net`;
6. OpenKilo;
7. `smart-voice-notify`;
8. Mystatus/Handoff si una necesidad concreta lo justifica.

Cada plugin tendrá versión fijada, permisos mínimos, prueba aislada, criterio de rollback y responsable claro.

OpenKilo se reservará para tareas simples y no confidenciales hasta validar tratamiento de datos, límites, disponibilidad y calidad. Los modelos gratuitos cambian, pueden tener rate limits y algunos proveedores pueden registrar prompts y respuestas.

### Decisión preliminar sobre los cuatro complementos adicionales

| Complemento | Clasificación | Decisión inicial |
|---|---|---|
| OpenKilo | interesante/probar | piloto aislado para tareas simples no sensibles; sin fallback automático |
| OpenChamber | interesante/probar | evaluar como interfaz opcional; no mezclar sus worktrees con `hops` |
| `opencode-pty` | interesante/probar | sólo si `hops` necesita PTY persistente; revisar shell/red y servidor local |
| `smart-voice-notify` | interesante/probar | piloto de accesibilidad con TTS local; webhooks y red desactivados |

Ninguno está aprobado para instalación todavía. La prueba debe medir utilidad,
permisos, telemetría, costo de contexto y convivencia con Gentle/OpenCode antes
de incorporarlo.

## Modelo de actualizaciones

Cada actualización futura seguirá este ciclo:

1. detectar versiones disponibles;
2. revisar changelog y breaking changes;
3. respaldar configuración y datos;
4. actualizar en entorno aislado;
5. sincronizar assets administrados por Gentle;
6. validar OpenCode, Engram, TUI, MCP, permisos y plugins;
7. ejecutar smoke de tooling;
8. registrar versión, checksums y resultado;
9. promover a uso diario;
10. conservar rollback.

No se actualizará un plugin o Gentle sin considerar la compatibilidad con el contrato V2.

## Etapas de implementación futura

### Stage 0 — Backups (completado; restore de Engram pendiente)

Se respaldaron Engram, Claude, OpenCode, Gentle, auth, plugins, sesiones,
snapshots, worktrees, specs y configuraciones en el backup Stage 0. La prueba de
restauración de Engram todavía debe hacerse sobre una copia separada.

### Stage 1 — OpenCode V2 limpio (completado; validación final pendiente)

Instalar y verificar versión, estado vacío, permisos, `tui.json`, agentes y MCPs. OpenCode `2.0.3` y Gentle `2.9.0` ya están activos; Linear, auth de providers y prueba visual TUI siguen pendientes.

### Stage 2 — Gentle-AI completo (completado; integración pendiente)

Instalar versión estable actual, sincronizar assets, seleccionar componentes y registrar todo. Gentle `2.9.0` pasó 62/62 verificaciones con background OpenCode activo y Pi desactivado.

### Stage 3 — Engram (binario listo; memoria pendiente)

Engram `1.20.0` está activo; la DB existente sigue preservada. Falta saneamiento sobre copias, prueba de restore, búsqueda y activación controlada.

### Stage 4 — Linear

Extraer contrato genérico, conservar HOS como adaptador y unificar mutaciones/read-back.

### Stage 5 — Worktrees y `hops`

Desacoplar scripts de `~/.claude`, corregir cleanup, salida estructurada y asociación HOS.

### Stage 6 — Conocimiento

Reducir `AGENTS.md`, conservar `CLAUDE.md`, migrar skills y revisar contradicciones.

### Stage 7 — Specs/SDD

Ejecutar pilotos y decidir task-master mediante evidencia.

### Stage 8 — Guards

Implementar pre-commit, `hops verify`, permisos V2 y safety-net opcional.

### Stage 9 — Codegraph y plugins

Evaluar uno por vez, con versiones fijadas y rollback.

### Stage 10 — Validación integral

Probar start, reanudación, DB, puertos, tests, smoke, close, cleanup interrumpido, memoria y permisos.

### Stage 11 — Retiro de Claude

Desactivar hooks y launchers, conservar backups durante un período acordado y retirar los ejecutables sólo al final.

## Qué no se debe borrar

- `~/.engram`;
- `.git`;
- worktrees útiles;
- `.specs`, `openspec` y `.qtm` históricos;
- `scripts/client-tools`;
- configuración de Linear;
- credenciales y almacenes de autenticación;
- sesiones y snapshots útiles de OpenCode;
- configuración de servidores y DBs de desarrollo.

## Decisiones pendientes

- versión exacta de OpenCode V2 y canal estable/beta;
- componentes concretos de Gentle que quedarán activos;
- política de telemetría;
- estrategia de limpieza de `tmp` y proyectos Engram fragmentados;
- modelo secundario: GLM, DeepSeek, Kilo u otro;
- si OpenChamber será interfaz diaria u opcional;
- si `opencode-pty` se justifica además de `hops`;
- motor de voz para `smart-voice-notify`;
- resultado de los pilotos `.specs` versus Gentle SDD;
- ubicación y alcance del repositorio global de tooling;
- duración del período de rollback antes de retirar Claude.

## Regla de las etapas pendientes

Hasta aprobar explícitamente cada etapa pendiente, no ejecutar:

- nuevas instalaciones, upgrades o limpiezas fuera del manifiesto ya aprobado;
- `gentle-ai sync`, `upgrade` o equivalentes;
- import/export/consolidación de Engram;
- mutaciones de Linear;
- cambios Git, commits, pushes o branches;
- modificaciones de configuración operativa;
- limpieza o borrado de datos.
