# Registro de ejecución: OpenCode V2 + Gentle-AI

Este archivo registra la ejecución de la migración. Se actualiza después de cada etapa relevante.

## Estado inicial

- Inicio: 2026-09-14.
- Etapa actual: Stage 0 — preparación, inventario y backups.
- Objetivo: instalar OpenCode V2 y Gentle-AI estable actual, conservar Engram, y migrar gradualmente el tooling de Hospeda.
- Regla: cada etapa debe ser verificable y reversible.

## Orden de trabajo

1. Inventario y backups.
2. OpenCode V2 aislado.
3. Gentle-AI y assets administrados.
4. Engram sobre una copia validada.
5. Providers y modelos.
6. TUI V2.
7. Linear, `hops` y worktrees.
8. Conocimiento, skills y `CLAUDE.md`/`AGENTS.md`.
9. Specs/SDD.
10. Codegraph y plugins.
11. Validación integral.
12. Retiro gradual de Claude Code.

## Registro

### 2026-09-14 — Inicio

- Creado este registro.
- No se instalaron paquetes.
- No se modificaron configuraciones operativas.
- No se modificaron Linear, Git, worktrees ni Engram.
- Próximo paso: inventario seguro y diseño de backups antes de abrir instalaciones nuevas.

### 2026-09-14 — Backup Stage 0

- Se creó un backup privado fuera del repositorio en `/home/qazuor/.local/state/hospeda-opencode-migration/backups/2026-09-14-stage0`.
- Se copiaron los estados locales de Engram, OpenCode, Gentle-AI y Claude, junto con el archivo de configuración local de Claude y los binarios disponibles.
- El backup ocupa aproximadamente 11 GiB.
- Se generó un manifiesto de rutas, tamaños y permisos sin mostrar contenidos sensibles.
- Los checksums de la DB Engram quedaron pendientes de completar sobre las rutas reales del backup; no se considera todavía una prueba de restauración.
- La copia original de Engram no fue modificada ni abierta para escritura.
- No se instalaron paquetes ni se ejecutaron comandos de Gentle-AI.

### 2026-09-14 — Verificación posterior del backup Stage 0

- Se completó el inventario de la carpeta de backup y se calcularon checksums de los binarios activos respaldados y de la copia de Engram disponible allí.
- La integridad lógica se verificó sobre una copia de trabajo de la DB, nunca sobre la DB original. Todavía no se hizo una restauración destructiva ni se reemplazó ninguna instalación; la prueba de restore completa queda para Stage 0 de la instalación futura.

### 2026-09-14 — Versiones iniciales

- OpenCode actual: `1.14.20`.
- Gentle-AI actual: `1.33.2`.
- Engram actual: `1.9.1`.
- Codegraph actual: `1.1.2`.
- Estas versiones quedaron registradas como baseline para rollback; todavía no se reemplazó ninguna.

### 2026-09-14 — OpenCode V2

- Se consultó npm y la versión estable disponible fue `@opencode/cli 2.0.3`.
- Se instaló globalmente `@opencode/cli@2.0.3` después del backup.
- Verificación exitosa: `opencode v2.0.3`.
- La instalación anterior bajo `~/.opencode/bin/opencode` no fue eliminada; queda disponible como referencia/rollback hasta completar la validación.
- La primera ejecución dentro del sandbox no pudo crear el log local; la verificación repetida con acceso al directorio de datos funcionó.
- Todavía no se inició la TUI, no se conectaron providers, no se importaron sesiones y no se ejecutó Gentle-AI.

### 2026-09-14 — Gentle-AI staging

- Homebrew ofrece Gentle-AI `1.36.7`, todavía por debajo de la release oficial `2.9.0`; no se usó Homebrew para evitar instalar una versión intermedia.
- Se obtuvo y compiló la release oficial `gentle-ai 2.9.0` mediante el módulo Go oficial.
- Binario de staging: `/home/qazuor/.local/state/hospeda-opencode-migration/stage/gentle-ai-2.9.0/gentle-ai`.
- Verificación exitosa: `gentle-ai 2.9.0`.
- SHA-256 del binario de staging: `a99f22c1df07a60a7856e6c1f6f8580d78f029e9657e0787b07e236a898bf48b`.
- No se reemplazó todavía el binario Homebrew `1.33.2`.
- El instalador de Gentle requiere una interfaz terminal interactiva y el entorno automatizado no renderizó su TUI; los intentos fueron `--dry-run` y fueron interrumpidos por timeout, sin cambios detectados en la configuración.
- El preset recomendado para la instalación completa es `full-gentleman`: Engram, SDD, skills, Context7, GGA, permissions, persona y theme. CodeGraph y RTK aparecen como Community Tools opt-in y quedan separados del preset.

### 2026-09-14 — Dry-run no interactivo validado

- La release v2.9.0 realiza una comprobación de actualización automática antes de procesar `install`; esa comprobación puede esperar red y no es adecuada para una ejecución controlada.
- El código fuente oficial documenta `GENTLE_AI_NO_SELF_UPDATE=1` para omitir esa comprobación durante la operación.
- Con esa variable, el dry-run terminó correctamente sin crear ni modificar archivos.
- Selección preparada: agente `opencode`, preset `full-gentleman`, persona `gentleman`, SDD `single`, scope `global`, background subagents de OpenCode y Pi en `off`.
- Componentes resueltos: `claude-theme`, `context7`, `persona`, `engram`, `gga`, `opencode-gentle-logo`, `permissions`, `sdd`, `skills`.
- Plan reportado: 2 pasos de preparación y 11 pasos de aplicación. La instalación efectiva aún no se ejecutó al cerrar esta entrada.

### 2026-09-14 — Instalación Gentle-AI 2.9.0

- Se ejecutó la instalación global para OpenCode usando el preset `full-gentleman`, con persona `gentleman`, SDD `single` y background subagents desactivados.
- Verificación del instalador: 62 checks pasaron, 0 fallaron, 0 warnings y 0 skipped.
- Se instalaron los componentes administrados: theme, Context7, persona, integración Engram, GGA, logo TUI, permissions, SDD y skills.
- Se instalaron plugins/archivos administrados en `~/.config/opencode`; no se modificaron archivos dentro del repositorio Hospeda.
- El instalador dejó indicado que el binario Engram presente es `1.9.1` y que existe una versión posterior `1.20.0`; por eso la actualización del binario Engram queda como paso separado y respaldado.
- El instalador reportó telemetría anónima de Gentle-AI. No se modificó esa preferencia durante esta operación; queda para decisión explícita en la configuración posterior.
- GGA quedó instalado globalmente, pero no se ejecutó `gga init` ni `gga install` sobre Hospeda.
- Se verificó que el backup de Engram sigue disponible y que la DB original no fue reemplazada por la instalación de Gentle-AI.

### 2026-09-14 — Engram 1.20.0 y activación de binarios

- Se compiló Engram `1.20.0` en staging desde el módulo oficial.
- Se validó el binario contra una copia de la DB respaldada usando `ENGRAM_DATA_DIR` temporal y `engram stats`: 11.772 sesiones, 9.850 observaciones, 65 prompts y 27 proyectos registrados. La DB original no se abrió para escritura durante esta validación.
- Se activó Engram `1.20.0` en `~/.local/bin/engram`. El binario anterior `1.9.1` permanece en el backup Stage 0.
- SHA-256 Engram 1.20.0 activo: `f156ed71799fc2f9f747249867626fc81ff77040c99ea5ff541dddde6d98759b`.
- Se activó Gentle-AI `2.9.0` en `~/.local/bin/gentle-ai`; el ejecutable anterior `1.22.0` fue copiado al backup Stage 0 antes del reemplazo.
- SHA-256 Gentle-AI 2.9.0 activo: `a99f22c1df07a60a7856e6c1f6f8580d78f029e9657e0787b07e236a898bf48b`.
- Se cambió el symlink `~/.local/bin/opencode` para resolver a OpenCode `2.0.3`; la instalación V1 bajo `~/.opencode/bin/opencode` sigue intacta.
- La verificación de `opencode --version` requiere acceso de escritura a su log de usuario; con permisos adecuados devuelve `opencode v2.0.3`.
- Pendiente: revisar y ajustar la configuración TUI V2 preservando los atajos acordados; la instalación de Gentle-AI agregó sus plugins/tema y dejó ese ajuste para la etapa TUI.
- Dry-run posterior a la activación volvió a resolver el preset completo sin errores.

### 2026-09-14 — TUI V2

- Se respaldó el `tui.json` generado por Gentle-AI como `tui-after-gentle-2.9.0.json` dentro del backup Stage 0.
- En el estado previo se describían tres plugins TUI administrados por
  Gentle-AI; esa observación es histórica y no representa el estado actual.
- Se agregaron `mouse: false`, `diff_style: auto`, atención visual con notificaciones y sin sonido.
- Se agregaron los atajos acordados: Home/End para línea y Ctrl+Home/Ctrl+End para el buffer; Ctrl+A/Ctrl+E quedan como aliases de inicio/fin de línea.
- El JSON fue validado sintácticamente. La validación visual en una TUI real queda pendiente para la etapa de validación.

### 2026-09-14 — Verificación final de esta tanda

- Versiones activas verificadas con acceso al directorio de datos: OpenCode `2.0.3`, Gentle-AI `2.9.0`, Engram `1.20.0` y CodeGraph `1.1.2`.
- Checksums registrados de los binarios activos: OpenCode `86fde5351c6417a9aea047f7ec9f5d11c2835bba2446fa178a0904bb15bba19c`, Gentle-AI `a99f22c1df07a60a7856e6c1f6f8580d78f029e9657e0787b07e236a898bf48b`, Engram `f156ed71799fc2f9f747249867626fc81ff77040c99ea5ff541dddde6d98759b`.
- Engram mostró un aviso de consulta de actualización por falta de acceso/rate limit de GitHub; no afecta la versión instalada ni la DB.
- El repositorio Hospeda conserva únicamente sus archivos de documentación de migración nuevos y el directorio `.atl/` que ya estaba sin trackear; no se modificó código ni configuración del proyecto.
- No se ejecutaron `gga init`, `gga install`, `engram setup`, `engram save`, `engram export/import`, Linear, worktrees, Git commits/push ni plugins comunitarios adicionales.

### 2026-09-14 — Diagnóstico read-only de Engram y OpenCode

- Engram 1.20 agrega superficies explícitas para mantenimiento: `doctor`, `projects list`, `projects consolidate --dry-run`, conflictos y una TUI con navegación y borrado confirmado de sesiones. No se ejecutó ninguna operación de borrado, reparación ni consolidación aplicada.
- El diagnóstico se realizó sobre clones temporales derivados del backup, nunca sobre la DB original.
- `engram doctor --json` sobre el clon detectó: 2 checks OK, 1 warning y 1 bloqueo. El warning fue deriva entre proyecto de sesión y proyecto inferido del directorio (1.047 hallazgos); el bloqueo fue payloads de `sync_mutations` con campos obligatorios faltantes (6.030 hallazgos). Esto confirma que la memoria necesita saneamiento guiado antes de usarla como fuente automática.
- `sqlite_lock_contention` resultó OK en el clon.
- `projects consolidate --all --dry-run` encontró 4 grupos de nombres similares. Uno afecta variantes de Asistia; otro agrupa muchas variantes de Hospeda. No se aplicará automáticamente: primero hay que definir un mapa canónico y separar proyectos reales, worktrees e históricos.
- La documentación oficial de Engram confirma que `doctor` es read-only y que las reparaciones permitidas son acotadas a reclasificación de proyectos, con `--plan`/`--dry-run` antes de `--apply` y backup automático en la aplicación.
- En OpenCode global quedaron configurados los MCP `context7`, `engram` y `linear`; los agentes y comandos SDD fueron generados por Gentle-AI. Se registraron sus nombres y cantidades sin leer credenciales ni tokens.
- El `stats` contra la DB original no se considera validación de integridad porque el entorno restringido devolvió un error de migración SQLite de solo lectura; por eso todas las comprobaciones de datos se basaron en clones.
- Un `doctor repair --plan` sobre el clon, limitado a `hospeda2`, proyectó reclasificar 966 sesiones, 206 observaciones y 9 prompts hacia el proyecto canónico inferido. El mismo plan para `hospeda` no encontró acciones. Esto es evidencia para revisar nombres/proyectos, no autorización para aplicar la reparación.
- `opencode --help` terminó correctamente con OpenCode V2 y no inició una sesión ni una TUI; la validación interactiva de atajos sigue pendiente porque requiere una terminal real.
- Se inspeccionó la DB original con SQLite en modo `mode=ro`, sin usar la capa de migración de Engram y sin leer contenidos de memorias. Se observaron 11.772 sesiones, 9.850 observaciones, 65 prompts, 47.065 mutaciones de sync y 18 tablas. La distribución de tipos está dominada por `passive` (5.632), `decision` (1.040), `session_summary` (917), `discovery` (801) y `bugfix` (621).
- Esta inspección confirma que la limpieza debe ser selectiva: no conviene borrar masivamente por tipo. Primero hay que separar ruido pasivo, duplicados, deriva de proyectos y mutaciones de sync incompletas, manteniendo decisiones, arquitectura, configuración y conocimiento operativo útil.

### 2026-09-14 — Evaluación inicial de complementos solicitados

- **OpenKilo**: es un plugin/provider npm de un repositorio pequeño (1 commit visible, 13 stars en la revisión), que enruta modelos gratuitos hacia `api.kilo.ai` y anuncia actualización automática del registro de modelos. Puede servir para tareas simples, pero introduce una red externa adicional, prompts fuera de OpenAI y un mecanismo de autenticación propio. Queda como piloto aislado, nunca para secretos, Linear sensible ni producción.
- **OpenChamber**: no es un plugin TUI de OpenCode sino una interfaz desktop/web/VS Code que administra sesiones y puede iniciar o conectarse a un servidor OpenCode. Tiene funcionalidades propias de worktrees, terminal, timeline, voz y proveedores. Se solapa con la TUI y con el workflow `hops`; se recomienda dejarlo opcional hasta decidir si será interfaz diaria.
- **`opencode-pty`**: plugin real para procesos PTY persistentes, entrada interactiva, buffers, regex y notificaciones. Tiene acceso a shell y filesystem mediante comandos, además de un servidor web local para observar sesiones. Puede complementar los procesos largos de `hops`, pero sus permisos `ask` se interpretan como deny y los directorios externos pueden permitirse; requiere política explícita y pruebas antes de instalar.
- **`smart-voice-notify`**: plugin real de notificaciones con TTS, desktop notifications, recordatorios, webhooks y endpoints OpenAI-compatible. Puede acceder a red, ejecutar integraciones locales de audio y escribir configuración/assets automáticamente. Es redundante para notificaciones básicas de OpenCode y Gentle; solo tendría sentido como piloto de accesibilidad, con TTS local y webhooks desactivados inicialmente.
- Ninguno de estos cuatro complementos fue instalado. La decisión actual es instalar primero solo componentes con beneficio claro y superficie de seguridad acotada; los demás quedan en evaluación documentada.
- Fuentes revisadas: [OpenKilo](https://github.com/AnganSamadder/openkilo), [OpenChamber](https://github.com/openchamber/openchamber), [`opencode-pty`](https://github.com/shekohex/opencode-pty) y [`smart-voice-notify`](https://github.com/MasuRii/opencode-smart-voice-notify).

### 2026-09-14 — Worktree exclusivo de migración

- Se creó la rama `chore/opencode-gentle-ai-migration` en el worktree `/home/qazuor/projects/WEBS/hospeda-opencode-gentle-ai`.
- Los dos documentos de migración fueron copiados a este worktree y quedaron sin trackear, listos para versionarse cuando se apruebe el primer commit.
- No se modificaron los worktrees existentes ni el checkout principal; toda futura edición dentro del repositorio se hará desde este worktree.
- Se creó `docs/migration/knowledge-migration-map.md` con la propuesta de separación entre `AGENTS.md`, skills, commands, agents y documentación. No se modificaron todavía los `CLAUDE.md` existentes.

### 2026-09-14 — Inventario postinstalación de datos OpenCode

- `~/.config/opencode` contiene configuración, skills, comandos, plugins y assets de Gentle-AI; la configuración global registra MCP de Context7, Engram y Linear.
- `~/.local/share/opencode/opencode.db` mide aproximadamente 1,3 GB. En modo SQLite read-only pasó `PRAGMA integrity_check = ok` y contiene 254 sesiones, 22.028 mensajes, 100.504 partes y 8 proyectos.
- También existen logs y `tool-output` históricos muy grandes. No se eliminaron: son candidatos a una política de retención separada y deben respaldarse antes de limpiar.
- La instalación actual no es una instalación de datos vacía; es una activación de OpenCode V2 sobre el estado histórico existente. La versión V1 y sus datos quedan preservados para rollback hasta validar el nuevo entorno.
- Una prueba aislada con `XDG_CONFIG_HOME` y `XDG_DATA_HOME` temporales inició OpenCode V2.0.3 correctamente y creó solo su log temporal. Esto confirma que una futura instalación limpia puede separarse de la base histórica sin borrarla.

### 2026-09-14 — Estado de agentes administrados

- El estado de Gentle-AI ya contenía `claude-code`, `opencode` y `vscode-copilot` antes de esta instalación; la instalación nueva no debe interpretarse como una desinstalación de Claude Code.
- La configuración generada para OpenCode contiene agentes SDD, revisión, exploración y orquestación de Gentle-AI, además de MCP de Context7, Engram y Linear.
- Se observaron cambios recientes en algunos metadatos de `~/.claude` fuera del momento de instalación; no se atribuyen automáticamente a Gentle-AI y no se tocaron ni inspeccionaron contenidos sensibles.
- No hay procesos persistentes de `opencode`, `engram` ni `gentle-ai` ejecutándose actualmente; Engram se activará más adelante con un proyecto explícito y sin escritura automática hasta cerrar su saneamiento.

### 2026-09-14 — Compatibilidad CLAUDE.md / AGENTS.md

- La documentación oficial V2 consultada indica que OpenCode reconoce `AGENTS.md` y no usa `CLAUDE.md` como fallback. Otra página de documentación de desarrollo todavía describe compatibilidad de `CLAUDE.md`, por lo que existe una contradicción entre superficies documentales.
- Decisión operativa: no depender de `CLAUDE.md` para que funcione OpenCode V2. Se conservarán los archivos `CLAUDE.md` de Hospeda por compatibilidad futura con Claude Code, pero las instrucciones activas de OpenCode deberán vivir en `AGENTS.md`, skills o commands versionados.
- Antes de migrar contenido se hará una clasificación de los 98.000 caracteres del `CLAUDE.md` raíz y de los `CLAUDE.md` por app/package, evitando duplicar conocimiento especializado en el AGENTS raíz.

### Inventario inicial de conocimiento Hospeda

- Hay 21 archivos `CLAUDE.md`: uno raíz, 3 de apps y 17 de packages. El raíz tiene 980 líneas; los más grandes son `apps/web` (1.171), `packages/service-core` (1.335), `apps/admin` (812), `apps/api` (805), `packages/db` (824) y `packages/seed` (779).
- Candidato a `AGENTS.md` raíz: arquitectura del monorepo, invariantes universales, comandos mínimos de verificación, reglas Git/seguridad y referencias a la documentación especializada.
- Candidatos a skills project-local: Astro/web, Hono/API, TanStack/admin, Drizzle/Postgres, schemas/Zod, seed/migraciones, service-core, billing, i18n, auth, media, email, testing/quality y deploy.
- Candidatos a commands/scripts: operaciones deterministas de `hops`, start/close issue, worktrees, smoke gates y validaciones rápidas. El conocimiento narrativo no debe convertirse en command.
- Candidatos a documentación normal: explicaciones históricas de specs cerradas, tablas extensas de casos de negocio y referencias detalladas que no se necesitan en cada sesión.
- No se generaron todavía `AGENTS.md` ni skills nuevos; la migración de conocimiento se hará después de comparar duplicados y obsolescencia.

### Criterio preliminar de saneamiento Engram

- Los payloads de `sync_mutations` con campos obligatorios faltantes no tienen reparación automática soportada por Engram. No se deben inventar campos ni eliminar esas filas durante esta etapa.
- La primera reparación candidata es la reclasificación de sesiones/proyectos, siempre sobre un clon y con un mapa canónico aprobado; la reparación aplica únicamente columnas de proyecto y genera su propio backup.
- La consolidación de nombres debe tratarse como una operación posterior independiente. No se debe mezclar con eliminación de observaciones, deduplicación semántica ni reparación de sync.
- El procedimiento futuro será: backup binario + export JSON, diagnóstico, planes dry-run, revisión de conteos, aplicación por proyecto, verificación de invariantes y recién después activación del MCP sobre la DB saneada.

### 2026-09-14 — Primer `AGENTS.md` universal

- Se creó `AGENTS.md` en la raíz del worktree exclusivo `/home/qazuor/projects/WEBS/hospeda-opencode-gentle-ai`.
- Contiene únicamente reglas transversales: seguridad y manejo de secretos, arquitectura general del monorepo, invariantes de TypeScript/API/DB, validación, trazabilidad Linear/specs/worktrees y política de documentación.
- Se evitó copiar el `CLAUDE.md` raíz completo para no mantener un bloque monolítico de contexto.
- Los 21 archivos `CLAUDE.md` permanecen sin modificar para conservar compatibilidad futura con Claude Code. La migración de conocimiento especializado a skills se hará en pasos posteriores, con extracción por dominio y validación de fuentes.

### 2026-09-14 — Relevamiento de `hops`, Linear y worktrees

- `scripts/client-tools` es un CLI Bun/TypeScript versionado dentro de Hospeda. `hops start-issue` consulta un issue de Linear mediante GraphQL read-only, normaliza `HOS-NNN`, deriva el tipo de branch desde labels, genera un slug estable y delega la creación al script `~/.claude/skills/worktree/scripts/wt-create.sh`.
- La implementación actual acopla el último paso a Claude Code: después de crear/reutilizar el worktree ejecuta `claude` y le pasa `/startIssue HOS-NNN`. El lookup, el naming y la mayor parte del bootstrap son independientes de Claude y conviene conservarlos.
- `wt-create.sh` no es read-only: hace fetch opcional, crea worktree/branch, copia archivos de entorno, instala dependencias, compila y escribe estado local. Por eso no se ejecutó durante este relevamiento.
- El entorno de worktree incluye DB por worktree, template de esquema, puertos dinámicos, archivos de entorno y servidores con health checks. `wt-up`/`wt-down`/`wt-remove` son lifecycle scripts distintos: `up` prepara y arranca, `down` conserva DB/worktree, `remove` detiene, elimina DB, borra worktree y puede borrar branch. Ninguno debe ser duplicado por un plugin sin comparar garantías.
- La dependencia más frágil a migrar es la ruta externa `~/.claude/skills/worktree`; la futura adaptación debería mover el contrato genérico de worktrees a un repositorio/tooling versionado y hacer que `hops` abra OpenCode sólo como adaptador opcional.
- No se encontró un comando `close-issue` equivalente en `scripts/client-tools`; el cierre parece vivir principalmente en comandos Claude/documentación y debe relevarse por separado antes de diseñar su reemplazo. No se ejecutaron mutaciones de Linear.

### 2026-09-14 — Relevamiento del sistema `.specs`

- `.specs/` declara explícitamente que Linear (team Hospeda, identificadores `HOS-NNN`) es la fuente de verdad macro; el repositorio conserva detalle técnico y tracking interno, no prioridades ni estados globales.
- Cada spec nueva usa `.specs/HOS-<n>-<slug>/spec.md` con `linear:` y `statusSource: linear`; `tasks/` es opcional y pertenece sólo a la implementación de esa spec. `closeout.md` conserva resultado, decisiones y follow-ups.
- Task Master está acotado a microtareas internas. Promueve una tarea a Linear sólo si bloquea, requiere paralelismo, sobrevive al alcance, representa una decisión o afecta release/deploy. Esta regla evita convertir cada microtarea en issue.
- Las specs reales recientes muestran trazabilidad fuerte: criterios medibles, tareas con dependencias/quality gates, replanificaciones explícitas, tareas canceladas y closeout con PR/tests/follow-ups. También preservan decisiones de producto y límites de alcance.
- La debilidad principal es de ergonomía y mantenimiento: hay variación histórica, muchos documentos grandes y dependencia de comandos Claude para navegar/lanzar el flujo. La estructura y metadata, sin embargo, son valiosas y no conviene abandonarlas de forma abrupta.
- Recomendación preliminar: conservar `.specs` como formato canónico de Hospeda y evaluar Gentle-AI SDD como orquestador/adaptador para features complejas. No migrar automáticamente todas las specs históricas ni mantener dos fuentes de estado.

### 2026-09-14 — Inventario preliminar de commands y agents

- Se agregó `docs/migration/claude-component-inventory.md` con una fila por command y agent Claude detectado, su función, dependencias y destino preliminar.
- La recomendación es conservar la lógica determinista en `hops`, exponer sólo wrappers conversacionales finos en OpenCode y convertir los agentes por framework en skills bajo demanda.
- Se identifican como agentes candidatos a conservar únicamente review general, debugging y posiblemente revisión visual/browser; `tech-lead` y varios agentes de dominio se solapan con Gentle/OpenCode o con skills.

### 2026-09-14 — Acoplamiento adicional detectado en Task Master

- `.claude/project.config.json` configura Task Master con backend Linear para el team `Hospeda`/key `HOS`, dentro de `.specs`. El comentario del propio archivo indica que las escrituras en Linear ocurren cuando se ejecutan comandos reales del plugin Task Master y su skill de sincronización; leer `tasks/state.json` manualmente no actualiza Linear.
- Esto confirma que Task Master no es sólo un formato de archivos: existe un acoplamiento operativo al plugin Claude `qazuor-claude-code-plugins`. La migración debe decidir entre retirar ese backend, reemplazarlo por Gentle SDD o conservar un adaptador explícito; no se debe asumir equivalencia por compartir JSON.
- El mismo archivo contiene configuración local de worktrees/DB y campos de credenciales de desarrollo. No se registraron valores y no se volverán a exponer en el informe.

### 2026-09-14 — Inventario de memorias file-based de Claude

- Se detectaron cinco `MEMORY.md` asociados a proyectos Claude. Los dos más relevantes para Hospeda son los perfiles de `hospeda` (11.816 bytes) y `hospeda2` (25.668 bytes); también existen perfiles históricos de `hospeda3`, un subárbol de `apps/web` y otros proyectos.
- Sólo se registraron rutas y tamaños; no se leyó ni se mostró el contenido. Antes de incorporarlas a OpenCode/Gentle se necesita una etapa de curación que separe invariantes permanentes, decisiones históricas, gotchas temporales y material duplicado.
- Recomendación: conservar los originales en el backup, transformar únicamente conocimiento estable a skills/AGENTS y mantener el resto como archivo histórico consultable, evitando importar memorias completas de forma automática a Engram.

### 2026-09-14 — Relevamiento de CodeGraph

- CodeGraph está instalado como CLI `1.1.2` en el PATH. La ayuda confirma que ofrece índice SQLite, consultas de símbolos/impacto/callers/callees, MCP para OpenCode y otros agentes, además de daemon, sync e instalación.
- Hay índices locales en `hospeda` y `hospeda2`; el índice de `hospeda2` reporta 11.268 archivos, 123.081 nodos, 407.147 aristas y aproximadamente 433 MB, en SQLite WAL. El índice se reporta actualizado. No se ejecutaron `init`, `index`, `sync`, `daemon`, `install`, `uninstall` ni `upgrade`.
- Recomendación preliminar: conservar CodeGraph como herramienta estructural opcional para exploración/impacto en monorepos grandes. No usarlo como memoria narrativa ni duplicar sus consultas con Engram; instalar su MCP sólo después de medir latencia, costo de contexto y compatibilidad con OpenCode V2.

### 2026-09-14 — Guards, pre-commit y seguridad

- Se agregó `docs/migration/security-guards-assessment.md` con la política propuesta para OpenCode/Gentle y el pre-commit.
- El pre-commit existente ya cubre secretos básicos, lint-staged, `safeIlike()` y validación de documentación; CI concentra guards de dominio, Semgrep, dependencias y suites costosas.
- Recomendación: mantener los guards de dominio versionados en scripts/CI, ejecutar en pre-commit sólo checks locales rápidos y reservar red, Linear, GitHub, DB, Engram, plugins y operaciones Git para autorización explícita.

### 2026-09-14 — Revisión específica de `closeIssue`

- La búsqueda exhaustiva en `.claude/`, `scripts/`, `.specs/` y el caché del plugin Task Master no encontró un archivo implementando `closeIssue`; sólo hay referencias documentales desde `recap` y tareas históricas.
- El plugin Task Master sí contiene commands de tareas/specs, skills de sincronización y quality gate, pero no un cierre genérico de Linear. Por lo tanto, `closeIssue` parece haber sido una convención conversacional/documental o una pieza externa no presente en este checkout, y no debe inventarse una implementación basada sólo en referencias.
- Consecuencia: antes de migrar o reemplazar el cierre hay que localizar el artefacto original (otro plugin, alias, script global o historial de sesiones). Si no aparece, diseñaremos un cierre nuevo con contrato explícito y dry-run por defecto.

### 2026-09-14 — Localización del workflow global de issues

- El artefacto sí existe fuera del repositorio: `~/.claude/commands/startIssue.md`, `~/.claude/commands/closeIssue.md` y `~/.claude/commands/handoff.md`. El checkout de Hospeda sólo contiene referencias, porque estos commands son globales.
- `startIssue` hace: validar issue/config, reutilizar o crear worktree desde `origin/staging`, entrar al worktree, poner Linear en In Progress y guardar memoria Engram. `hops start-issue` duplica el bootstrap técnico pero abre `claude` desde la terminal; son dos interfaces que hoy pueden divergir.
- `closeIssue` hace: resolver HOS o legacy SPEC, bloquear si ya está cerrado o tiene labels `status-needs-smoke-*`, verificar PR mergeado y árbol limpio, marcar Linear Done vía `index-sync`, guardar memoria Engram y retirar el worktree con `wt-remove.sh` sin `--force`. Si edita documentación, crea un PR separado con `Closes HOS-N`.
- `handoff` compromete cambios locales, guarda resumen Engram, sincroniza Task Master/Linear y emite un prompt de continuación. Es una operación con efectos persistentes y no debe ser un command automático de OpenCode sin confirmación por etapa.
- Existe un incidente documentado en memoria global: un cierre anterior marcó una spec de billing como Done sin exigir smoke staging/prod. La versión actual de `closeIssue.md` ya incluye ese gate; debe conservarse como requisito de seguridad durante la migración.
- Recomendación: unificar la lógica en un CLI genérico versionado (Linear/worktree/spec/closeout), y dejar `startIssue`, `closeIssue` y `handoff` de OpenCode como adaptadores delgados con dry-run y confirmación explícita para cada escritura.

### 2026-09-14 — Comparación concreta `.specs` vs Gentle SDD

- Se agregó `docs/migration/sdd-comparison.md` con el lifecycle real de los artefactos Gentle/OpenSpec y una comparación contra `.specs`/Task Master.
- Recomendación: arquitectura híbrida. Linear y `HOS-NNN` siguen siendo identidad operativa; `.specs` sigue siendo registro técnico de Hospeda; Gentle aporta fases explícitas y verificación estricta sólo para features complejas.
- No se migrarán specs históricas en masa ni se permitirá que `archive` de Gentle mueva o borre `.specs`. La compatibilidad debe resolverse mediante enlaces/adaptadores y una sola fuente de estado.

### 2026-09-14 — Separación global / Hospeda / externo

- Se agregó `docs/migration/opencode-global-config-assessment.md`.
- OpenCode V2 tiene como agente por defecto `gentle-orchestrator`, MCP de Context7/Engram/Linear y permisos de lectura sensibles bloqueados. El permiso `bash: "*": "allow"` es demasiado amplio para la política final y debe revisarse antes de dar por terminada la migración.
- Los archivos de plugins presentes en `~/.config/opencode/plugins` no aparecen
  declarados en `opencode.json`; el registro de tres plugins TUI pertenece al
  baseline anterior. El estado actual declara dos entradas y requiere validar
  qué carga realmente el runtime en una sesión aislada.
- La configuración project-local futura debe versionar sólo reglas y adaptadores de Hospeda; auth, caches, DBs, Engram y preferencias de providers permanecen externos.

### 2026-09-14 — Providers y routing de modelos

- Se agregó `docs/migration/model-routing-assessment.md`.
- La auth local de OpenCode tiene entradas para OpenAI, GitHub Copilot, Anthropic, OpenCode Go y OpenCode; no se leyeron valores.
- Gentle mantiene aliases abstractos `opus`/`sonnet`/`haiku`; OpenCode todavía no tiene un catálogo de modelos fijado en `opencode.json`.
- GLM y DeepSeek no aparecen configurados. OpenKilo debe tratarse como gateway experimental separado.
- Recomendación: OpenAI para arquitectura, billing, seguridad, SDD y revisiones; GLM/DeepSeek para tareas simples después de validarlos; OpenKilo sólo para tareas no sensibles y experimentales, sin fallback silencioso en operaciones críticas.

### 2026-09-14 — Corrección de alcance: instalación aún no limpia

- Se corrige una interpretación importante: la instalación realizada hasta este punto fue una actualización de binarios y una instalación administrada de Gentle-AI sobre configuración global existente, no una instalación limpia desde cero del ecosistema.
- `~/.local/share/opencode/auth.json` ya contenía entradas de providers antes de esta etapa. No se leyeron valores de autenticación ni se configuraron providers nuevos durante el relevamiento.
- OpenCode/Gentle conservaron o ampliaron estado global existente (`~/.config/opencode`, caches, plugins administrados y auth). Por lo tanto, cualquier evaluación actual de providers, plugins o comportamiento no representa todavía un baseline limpio.
- La etapa correcta debe ser: preservar backups verificables, inventariar qué se conservará, aislar o retirar configuraciones/auth/caches previas según una lista aprobada, instalar en un perfil/directorios nuevos y validar desde cero antes de reintroducir Engram y componentes seleccionados.
- Se pausa la evaluación de routing de modelos hasta corregir esta etapa. No se borrará ni moverá ninguna configuración existente sin una operación separada, explícita y reversible.

### 2026-09-14 — Manifiesto de limpieza global pendiente

- Se agregó `docs/migration/clean-install-manifest.md` con las rutas que pertenecen a OpenCode/Gentle-AI, las rutas que deben conservarse y el orden de reinstalación.
- El inventario confirmó estado OpenCode en `~/.config/opencode`, `~/.local/share/opencode`, `~/.cache/opencode`, `~/.opencode` y residuos del cliente Desktop; también existe estado de Gentle en `~/.gentle-ai`.
- La DB/auth/sesiones de OpenCode ocupan un volumen significativo y se consideran descartables sólo después de validar el backup. Engram, Claude Code, CodeGraph, Git, worktrees y `.specs` quedan explícitamente fuera de la limpieza.
- No se ejecutó ningún borrado. La siguiente acción destructiva requiere confirmar el manifiesto exacto y luego se hará con backup y rollback documentados.

### 2026-09-14 — Limpieza global ejecutada

- Se retiraron las rutas OpenCode/Gentle-AI del manifiesto: configuración, datos, auth, sesiones, snapshots, caches, instalación histórica, cliente Desktop, paquete CLI y binarios activos.
- Se preservaron Engram (`~/.local/bin/engram`, `~/.engram`), Claude Code (`~/.claude`), CodeGraph, repositorios/worktrees y el backup Stage 0.
- Se detectó y retiró también la fórmula Homebrew `gentle-ai 1.33.2`, que seguía disponible en el PATH.
- Efecto colateral: `brew uninstall gentle-ai` ejecutó `autoremove` y retiró 53 fórmulas que Homebrew consideraba huérfanas. Esto no estaba previsto en el manifiesto. No se reinstalarán automáticamente; primero se debe obtener un inventario y decidir una recuperación selectiva.
- Estado posterior: `opencode` y `gentle-ai` ya no se resuelven en el PATH; `engram` continúa disponible. No se instaló aún ninguna versión nueva.

### 2026-09-14 — Reinstalación limpia OpenCode + Gentle-AI

- Se instaló globalmente `@opencode/cli 2.0.3` con npm después de retirar su configuración, auth, sesiones, caches y cliente Desktop anteriores.
- Se activaron los binarios verificados `gentle-ai 2.9.0` y `engram 1.20.0`.
- Se ejecutó Gentle-AI `2.9.0` con preset `full-gentleman`, persona `gentleman`, SDD `single`, scope global, `opencode-background-subagents=on` y `pi-background-subagents=off`.
- Resultado del instalador: 62 checks pasaron, 0 fallaron, 0 warnings y 0 skipped. Quedaron instalados SDD, skills, permisos, Context7, Engram, GGA, review transport, statusline y launcher administrado.
- El launcher para background agents quedó en `~/.gentle-ai/bin/opencode`; el wrapper exporta `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true` y delega al CLI 2.0.3. Para usar background agents hay que iniciar OpenCode desde ese launcher y reiniciar la sesión/TUI.
- Revalidación inicial: OpenCode `2.0.3`, Gentle-AI `2.9.0`, Engram `1.20.0`. La configuración nueva declara MCP de Context7 y Engram; Linear no quedó declarado en esta instalación limpia y debe configurarse explícitamente más adelante, sin copiar auth anterior.
- La reinstalación también regeneró `tui.json`, por lo que los atajos personalizados y `mouse:false` no están todavía restaurados; se revalidarán y reaplicarán después de confirmar el esquema actual.

### 2026-09-14 — Revalidación de instalación limpia y TUI

- Se confirmó que no existe `~/.local/share/opencode/auth.json`, `account.json`, DB, WAL/SHM ni sesiones heredadas. La instalación parte sin providers autenticados ni historial OpenCode.
- El `opencode.json` limpio contiene agentes Gentle/SDD y MCP de Context7 + Engram. Linear no fue agregado automáticamente y queda como integración explícita posterior.
- Se restauró `~/.config/opencode/tui.json` preservando los plugins Gentle y agregando `mouse:false`, `diff_style:auto`, atención con notificaciones sin sonido y los atajos Home/End/Ctrl+Home/Ctrl+End acordados.
- La validación visual de la TUI y una sesión real iniciada mediante `~/.gentle-ai/bin/opencode` siguen pendientes; no se ejecutó ninguna tarea del proyecto ni se conectó la memoria histórica de Engram.

### 2026-09-14 — Revalidación documental post-clean

- Se revisaron los documentos de migración contra el estado efectivo posterior a la limpieza global y reinstalación.
- `current-state.md` quedó como referencia consolidada: OpenCode `2.0.3`, Gentle-AI `2.9.0`, Engram `1.20.0`, background OpenCode activo, Pi desactivado, TUI restaurada y sin auth/providers heredados.
- `opencode-global-config-assessment.md`, `model-routing-assessment.md`, `clean-install-manifest.md` y `opencode-gentle-ai-plan.md` fueron corregidos para distinguir baseline pre-clean, estado actual y trabajo pendiente.
- Las entradas históricas anteriores se conservan deliberadamente para mantener trazabilidad; no deben interpretarse como estado actual si contradicen `current-state.md`.
- Se confirmó que no hubo cambios en el código de Hospeda, Linear, Git, worktrees, `.specs`, Engram histórico ni Claude Code durante esta revalidación.

### 2026-09-14 — Precaución Engram durante el relevamiento

- La ayuda de `engram` mostró que algunos subcomandos aparentemente informativos
  (`tui --help` y `export --help`) intentan abrir una migración de la DB. Se
  detuvo esa línea de prueba y no se ejecutarán más comandos sobre la DB activa
  hasta trabajar con una copia aislada.
- Se compararon los checksums de `~/.engram/engram.db`, WAL y SHM contra el
  backup Stage 0: coinciden exactamente. No se observó modificación de la
  memoria histórica.
- La interfaz TUI, `doctor`, exportación y consolidación se probarán después
  sobre una copia de Engram, con variables/directorios aislados y rollback.

### 2026-09-15 — Auditoría read-only de Engram sobre copia

- Se creó una copia temporal de `~/.engram` y se ejecutaron `projects list`,
  `stats` y `export` usando `ENGRAM_DATA_DIR` aislado.
- La copia reportó 11.772 sesiones, 9.850 observaciones, 65 prompts y 199
  nombres de proyecto. Los grupos principales fueron `tmp`, `hospeda`,
  `hospeda2` y observaciones sin proyecto.
- El inventario confirma mezcla de memoria pasiva, resúmenes, decisiones y
  proyectos temporales. Se agregó `engram-audit-readonly.md` con el plan de
  curación.
- No se ejecutaron operaciones destructivas ni se modificó la DB histórica.

### 2026-09-15 — Dry-run de consolidación Engram

- Sobre la copia temporal, `projects consolidate --all --dry-run` detectó cuatro
  grupos. La sugerencia de fusionar todos los nombres HOS/SPEC/worktree en
  `hospeda` es demasiado amplia, y la sugerencia `claude-config` → `tmp` es
  incorrecta.
- Se descarta la consolidación automática global. Cualquier fusión futura será
  explícita, pequeña, exportada previamente y revisada por pertenencia.
- `conflicts stats` no encontró relaciones para el proyecto `hospeda`.

### 2026-09-15 — Detección de duplicados sobre export Engram

- El análisis por hash encontró un único grupo de 33 observaciones con contenido
  vacío y 16 observaciones sin título.
- Hay 259 grupos de títulos repetidos, pero el título solo no permite concluir
  que el contenido sea duplicado; no se eliminará por ese criterio.
- Las observaciones sin proyecto contienen mayormente decisiones,
  descubrimientos, bugfixes y arquitectura, por lo que deben clasificarse antes
  de asignarlas o descartarlas.

### 2026-09-15 — Revisión de configuración global post-install

- La configuración limpia confirma MCP de Context7 y Engram, agente primario
  `gentle-orchestrator`, agentes SDD/review administrados por Gentle y el
  launcher con background OpenCode activo.
- La política generada por Gentle todavía permite `bash: "*"` globalmente,
  aunque mantiene bloqueos de lectura para credenciales y confirmaciones para
  operaciones Git/SSH. Se conserva como hallazgo pendiente; no se modificó
  automáticamente para evitar alterar el contrato de Gentle sin una política
  aprobada.
- La TUI limpia declara dos entradas (`opencode-subagent-statusline` y el logo
  de Gentle). Se corrigió la documentación que describía tres; el plugin de
  gestión SDD/Engram pertenece a la configuración runtime y no a `tui.json`.
- No existe `opencode.json` project-local en el worktree de migración. La
  configuración global tiene 23 agentes: uno primario y 22 subagentes. El
  comodín Bash global sigue permitido para el agente principal; `review-validator`
  es una excepción correctamente restringida a su comando de inspección.

### 2026-09-15 — Recuento del conocimiento de Hospeda

- El checkout contiene 25 `CLAUDE.md`, 17 agentes, 19 commands, 36 skills y 147
  directorios `.specs` con 257 archivos.
- El mapa de conocimiento tenía un conteo histórico de 21 `CLAUDE.md`; se
  corrigió a 25 y se separaron los tres documentos anidados de schemas.
- No se crearon todavía skills ni commands project-locales; el inventario sigue
  siendo la base para una extracción deduplicada.

### 2026-09-15 — Extracción estructural de `CLAUDE.md`

- Se compararon tamaños, headings y temas de los 25 documentos sin volcar su
  contenido al reporte.
- Los documentos más grandes son `packages/service-core` (1.336 líneas),
  `apps/web` (1.172), `packages/db` (824), `apps/admin` (812), `apps/api` (805)
  y `packages/seed` (779).
- Testing, auth, billing, specs, seguridad y deploy aparecen repetidos en varias
  áreas. La migración debe deduplicar por responsabilidad y no copiar cada
  archivo completo como un skill.

### 2026-09-15 — Uso real de `.specs`

- El checkout contiene 147 directorios `.specs`, 146 `spec.md`, 5 `closeout.md`,
  45 carpetas `tasks/` con 86 archivos de tareas/estado y 41 `TODOs.md`
  asociados a tareas Claude.
- `statusSource: linear` aparece en los 147 directorios. No existe un formato
  `tasks.md` único y uniforme; el seguimiento está repartido entre carpetas de
  tareas, Linear y `.claude/tasks`.
- Esto refuerza la arquitectura híbrida: conservar `.specs`/Linear y usar
  Gentle SDD sólo para cambios complejos con enlaces explícitos.

### 2026-09-15 — Clasificación del `CLAUDE.md` raíz

- Se clasificaron sus secciones por destino: reglas universales a `AGENTS.md`,
  conocimiento especializado a skills, operaciones deterministas a commands o
  `hops`, y contexto histórico a documentación normal.
- Billing, smoke, MercadoPago, deploy y changelogs no deben entrar en el
  contexto base.
- `CLAUDE.md` se conservará durante la transición y sólo se reducirá después de
  validar los reemplazos equivalentes.

### 2026-09-15 — Ajuste mínimo de `AGENTS.md`

- Se agregaron sólo invariantes universales que faltaban: límites de rutas API,
  fuentes únicas de verdad por paquete, diferencia `HOS`/`BETA` y work tags
  obligatorios para PRs.
- `AGENTS.md` continúa corto; las recetas específicas y el conocimiento de
  dominio permanecen fuera del contexto base.

### 2026-09-15 — Backlog de skills

- Se agregó un backlog priorizado de skills P0/P1/P2 con triggers, fuentes y
  límites de duplicación.
- La primera ola queda limitada a arquitectura, testing/quality, seguridad,
  web, API, admin y DB. No se crean directorios ni se activa carga automática
  hasta validar esas fuentes.

### 2026-09-15 — Backlog de commands OpenCode

- Se agregó una matriz de destino para los commands Claude, separando wrappers
  finos de `hops`, scripts deterministas, skills y legacy.
- `startIssue`, `closeIssue` y `handoff` quedan explícitamente fuera de toda
  automatización silenciosa; checks y audits permanecen read-only.

### 2026-09-15 — Frontera `hops`/OpenCode

- El registry real de `@hospeda/client-tools` expone 19 comandos y ya declara
  scopes, carga bajo demanda y exit codes composables.
- DB, servers, worktrees, env, verify, tests, CI y merge deben permanecer en
  `hops`; OpenCode sólo necesita wrappers finos para start/close/recap/handoff.
- El único acoplamiento de launcher confirmado es `start-issue` ejecutando
  `claude`; se documentó reemplazarlo por un launcher configurable.

### 2026-09-15 — Candidatos para ampliar `hops`

- Se agregó un backlog de funciones deterministas que pueden reducir consumo de
  tokens: `recap`, `issue-preflight`, launcher configurable, `close-issue --plan`,
  `context`, `verify --changed` y `smoke-plan`.
- Se descartó agregar prompts conversacionales, otro gestor de worktrees,
  orquestación de agentes o mutaciones Linear sin plan/read-back.
- No se implementó ningún comando todavía.

### 2026-09-15 — Revisión de pre-commit y guards

- El hook actual cubre secretos staged, lint-staged, `ilike()` inseguro y un
  hook tolerante de GitHub workflow; los guards de dominio completos quedan en
  CI.
- Se propusieron guards locales baratos para `.env`/DSN, worktree, branches
  protegidas, config válida, metadata HOS/NOSPEC y archivos generados.
- No se modificaron `.husky`, `package.json` ni ningún guard.

### 2026-09-15 — Decisión provisional sobre CodeGraph

- Se agregó una evaluación separada. CodeGraph queda como CLI externo; su MCP
  se evaluará después por latencia, contexto, permisos, worktrees e índices
  obsoletos.
- No se ejecutaron indexaciones, daemon, instalación, sync ni upgrade.

### 2026-09-15 — Dependencia concreta de `hops` respecto de Claude

- La inspección de `scripts/client-tools` confirmó que `hops servers-up`,
  `hops servers-down` y `hops wt-clean` buscan scripts en
  `~/.claude/skills/worktree/scripts/`.
- El dispatcher y la resolución local de worktrees son propios del repositorio,
  pero los scripts de servidores/cleanup todavía dependen de la instalación
  global de Claude. Esto es un gap técnico real para la migración y debe
  resolverse con una ruta configurable/versionada antes de retirar Claude.
- El ejemplo del skill de worktree incluye campos de conexión de DB con
  credenciales embebidas. No se copiaron valores; la configuración futura debe
  usar referencias seguras y nunca versionar credenciales.

### 2026-09-15 — Revisión del contrato Linear de `hops start-issue`

- `hops start-issue` consulta Linear mediante GraphQL read-only, deriva branch y
  slug, crea el worktree y luego lanza `claude` con un prompt opcional.
- La autenticación busca una variable de entorno o archivos locales protegidos;
  no se inspeccionaron valores.
- La migración puede conservar la consulta y el contrato de errores, cambiando
  el launcher mediante una opción explícita para OpenCode. No conviene detectar
  el agente implícitamente ni duplicar la consulta en un command OpenCode.

### 2026-09-15 — Gates de `closeIssue` y `handoff`

- `closeIssue` requiere preflight idempotente, gate de smoke, evidencia de PR
  mergeado y árbol limpio antes de escribir. Después puede mutar Linear, Engram,
  GitHub y retirar el worktree.
- `handoff` puede crear commits y sincronizar estado. Ambos deben migrarse como
  workflows explícitos con dry-run y confirmaciones por mutación, nunca como
  automatizaciones silenciosas del agente.

### 2026-09-15 — Contrato futuro del adaptador Linear

- Se documentó una separación entre cliente GraphQL genérico, máquina de
  estados del workflow y adaptador específico de Hospeda.
- La recomendación es mantener API/CLI como camino determinista y usar MCP
  Linear sólo como interfaz opcional del agente.
- Linear permanece sin configurar y no se ejecutaron consultas ni mutaciones.

### 2026-09-15 — Diseño de desacople de worktrees

- Se documentó la separación entre una capa genérica versionable de lifecycle y
  un adaptador específico de Hospeda.
- `hops` seguirá siendo la única interfaz de worktrees; los commands OpenCode
  sólo deberán invocarlo y no manipular Docker/Postgres/Git directamente.
- La configuración futura no contendrá credenciales ni DSN completos.

### 2026-09-15 — Política de memorias Claude

- Se inventariaron `MEMORY.md` de Hospeda, Hospeda2, Hospeda3, otros proyectos y
  worktrees. Se conservarán intactos como rollback.
- Se documentó una política de admisión: reglas estables a `AGENTS.md`/skills,
  decisiones duraderas a Engram curado, estado de issues a Linear/`.specs` y
  handoffs temporales con expiración.
- No se importó ni modificó ninguna memoria.

### 2026-09-15 — Gate de validación individual de memoria

- Se incorporó como requisito que cada memoria candidata se revise una por una,
  se contraste con el estado actual y se clasifique antes de migrarse.
- Se agregó una ficha de revisión para registrar evidencia, conflictos, destino
  y decisión sin copiar contenido sensible.
- No se permitirá importación masiva por tipo, fecha, título o proyecto.

### 2026-09-15 — Política de mantenimiento y actualización continua

- Se documentó un procedimiento de actualización por capas para OpenCode,
  Gentle-AI, Engram y plugins: inventario y checksums, lectura de release notes,
  backup, una actualización por vez, validación aislada y rollback.
- No se habilitarán actualizaciones automáticas ni se ejecutará `sync` sin
  revisar el diff que pueda regenerar configuración o skills.
- Engram queda sujeto a una regla adicional: no actualizar el schema sobre la
  DB histórica sin una copia restaurable y una prueba separada.
- No se ejecutaron `upgrade`, `sync`, `install` ni `restore` en esta iteración.

### 2026-09-15 — Orden de validación posterior a la instalación limpia

- Se agregó un documento de gates para separar validaciones de Engram, TUI,
  permisos, modelos, Linear, worktrees, memoria y primera integración.
- El siguiente trabajo recomendado es validar primero rollback de Engram sobre
  una copia y la sesión aislada de OpenCode; todavía no corresponde migrar
  memorias ni activar mutaciones de Linear.

### 2026-09-15 — Interfaz de backup/restore de Engram

- La inspección aislada de Engram `1.20.0` confirmó que no existe un comando
  `restore`; `import` recibe un archivo y modifica la DB.
- El rollback seguro debe basarse en una copia consistente de todo `~/.engram`
  (incluidos DB, WAL, SHM y metadatos), con checksums y prueba en una ubicación
  temporal. El export JSON queda como evidencia/auditoría, no como sustituto del
  backup binario.
- No se ejecutó `import`, no se modificó la DB original y no se intentó reparar
  la memoria.

### 2026-09-15 — Verificación efectiva de permisos y plugins globales

- La configuración actual declara 23 agentes y sólo los MCPs `context7` y
  `engram`; no declara plugins en `opencode.json`.
- Hay seis archivos TypeScript en el directorio global de plugins, pero su
  presencia no prueba que el runtime los cargue. Queda pendiente verificarlo en
  una sesión aislada.
- El comodín global `bash: "*": "allow"` sigue siendo demasiado amplio para
  Hospeda. No se modificó porque pertenece a la configuración global
  administrada y requiere una decisión explícita sobre el modelo de permisos.

### 2026-09-15 — Diagnóstico aislado de OpenCode V2

- `opencode --help` confirmó los subcomandos de diagnóstico `debug config`,
  `debug agents`, `debug paths` y `plugin list`.
- `debug paths` en HOME temporal mostró rutas aisladas para DB, cache, logs y
  estado. `debug config`, `debug agents` y `plugin list` requieren un servicio
  inicializado; en ese entorno terminaron con `Server process exited with code
  1`.
- No se abrió TUI, no se inició una sesión de proyecto y no se modificó la
  configuración global. La carga real de plugins queda pendiente de una prueba
  controlada del servicio aislado.

### 2026-09-15 — Matriz operativa de permisos

- Se agregó una matriz que separa lectura/edición local, shell, Git, servicios
  externos, Engram, plugins/MCP y providers.
- La matriz mantiene OpenAI como ruta para tareas críticas, deja GLM/DeepSeek y
  OpenKilo para evaluación controlada y prohíbe fallback silencioso cuando hay
  datos sensibles.
- No se implementó ninguna regla en OpenCode, hooks o `hops`; queda como diseño
  pendiente de aprobación.

### 2026-09-15 — Consistencia de TUI y plugin de statusline

- `tui.json` es JSON válido y conserva mouse desactivado, atención sin sonido y
  los atajos Home/End acordados.
- El archivo local de Gentle logo existe. La entrada
  `opencode-subagent-statusline` no se resolvió en filesystem ni en los
  directorios globales inspeccionados.
- No se instaló ni se eliminó nada. La entrada queda como pendiente de
  validación con el runtime antes de considerar definitiva la configuración TUI.

### 2026-09-15 — Resolución del statusline pendiente

- No existen referencias adicionales a `opencode-subagent-statusline` en
  `~/.gentle-ai`, `~/.local/share/opencode` ni en la configuración local aparte
  de `tui.json`.
- Se clasifica provisionalmente como entrada huérfana. No se instalará un
  reemplazo ni se mantendrá en una configuración versionada hasta comprobar su
  carga efectiva y utilidad.

### 2026-09-15 — Frontera real de `hops`

- La inspección del registro confirma 19 comandos, pero no existe un
  `close-issue` implementado en `scripts/client-tools`.
- El cierre actual está repartido entre comandos/workflows Claude y capacidades
  ya existentes de `hops` (preflight, CI, merge y cleanup).
- Se documentó que el futuro `close-issue --plan` debe componer esas capacidades
  y empezar como salida read-only, sin copiar el prompt ni crear un segundo
  gestor de worktrees.

### 2026-09-15 — Contrato verificable de `start-issue`

- La implementación y sus tests cubren normalización de IDs, equipos distintos
  de HOS, derivación de tipo de branch, slug estable, dry-run, worktree
  existente y manejo de estados cerrados.
- El único acoplamiento operativo final es `spawn('claude', ...)`; Linear,
  naming, `wt-create.sh`, lectura de la ruta y el fallback sin launcher son
  independientes del agente.
- La migración debe conservar esos comportamientos y parametrizar únicamente el
  launcher y el prompt. No se debe reescribir el bootstrap en OpenCode.

### 2026-09-15 — Auditoría de comandos globales de cierre y handoff

- `~/.claude/commands/startIssue.md` confirma que el flujo también actualiza
  Linear a In Progress y registra memoria, además de crear/reutilizar el
  worktree.
- `closeIssue` exige idempotencia, gates de smoke, advertencia por PR no
  mergeado, árbol limpio y retiro seguro del worktree; no debe reducirse a
  “marcar Done”.
- `handoff` mezcla commit local, Engram, tracking formal y generación de prompt;
  debe migrarse por partes y nunca activarse como operación automática de
  OpenCode.

### 2026-09-15 — Smoke como gate de Linear

- `/smoke` exige comentario de evidencia antes de retirar labels, separa
  local/staging/prod y distingue resultado de grado de evidencia.
- `PARCIAL`/`PENDIENTE` no cambia estado; `FALLO` conserva el gate, devuelve el
  issue a In Progress y requiere un seguimiento; sólo `PASO` sin entornos
  pendientes permite cerrar.
- Estas invariantes deben vivir en el adaptador versionado de Linear/Hospeda,
  no únicamente en un command OpenCode ni en instrucciones de un agente.

### 2026-09-15 — Hallazgo sensible en configuración de worktree

- La inspección estructural de `.claude/project.config.json` encontró un campo
  `connStringTemplate` con forma de DSN y credencial local embebida.
- No se registró ni se volverá a mostrar su valor. No se copió la configuración
  al worktree de migración.
- Antes de reutilizarla debe diseñarse una sustitución por referencias seguras y
  un guard que bloquee secretos en JSON versionado.

### 2026-09-15 — Taskmaster no forma parte de la instalación limpia

- La configuración del repo declara backend Linear para taskmaster, pero la
  instalación limpia de OpenCode/Gentle no incluye ese plugin Claude.
- El repo conserva `.specs`/Linear como sistema activo y archivos `.claude/tasks`
  y `.qtm` como legado o compatibilidad histórica.
- No se recomienda reinstalar taskmaster 1:1. Primero debe medirse el uso real;
  si hacen falta sus atajos, se implementarán como comandos deterministas sobre
  `.specs` y Linear.

### 2026-09-15 — Decisión preliminar sobre agentes

- El repo tiene 17 agentes Claude project-locales; la mayoría repite patrones
  de stack que encajan mejor como skills bajo demanda.
- Se propone conservar sólo debugger, code-reviewer, qa-engineer y tech-lead como
  roles explícitos, sujetos a validación de uso.
- Los perfiles de framework pasan a skills; product planning se cubre con SDD
  cuando corresponde; no se migrarán los 17 agentes 1:1.

### 2026-09-15 — Inventario efectivo de commands

- Se contaron 19 commands project-locales y 7 commands globales Claude.
- `code-check`, `run-tests`, `hops-stats` y partes de `quality-check` ya tienen
  una base determinista en `hops`/scripts y no deben duplicarse como prompts.
- `smoke` se agregó al backlog como command fino sobre el adaptador Linear/Hospeda
  porque sus invariantes de evidencia y labels son de dominio, no de Claude.
- `init-project` queda legacy; `commit` sigue siendo ayuda opcional con
  autorización explícita.

### 2026-09-15 — Inventario estructural de memoria Claude

- Se localizaron 566 archivos `MEMORY.md` o notas bajo directorios `memory/`.
- Hospeda2 concentra 490 archivos y Hospeda 59; también aparecen proyectos
  auxiliares, worktrees, skills del plugin Engram y un archivo retirado.
- No se leyó ni se importó el contenido durante este inventario. El volumen
  refuerza la regla de revisión individual y descarta cualquier migración
  masiva por proyecto, fecha o tipo.

### 2026-09-15 — Familias para lotes de revisión de memoria

- El inventario nominal agrupa aproximadamente 297 `feedback`, 192 `project`,
  29 `spec`, 8 `issue`, 7 `gotcha`, 5 `MEMORY.md` y un `RETIRED.md`.
- Se definió un orden operativo: gotchas/issues vigentes, decisiones de
  specs/proyectos y feedback al final.
- La familia sólo sirve para ordenar el trabajo; cada entrada sigue requiriendo
  corroboración individual y no se importó ninguna.

### 2026-09-15 — Filtro preventivo de nombres sensibles

- Un filtro sólo por nombre detectó 68 archivos de memoria con términos
  relacionados con credenciales, OAuth, cookies, SSH, API o autenticación.
- Esto es una señal preventiva, no una afirmación de que todos contengan
  secretos. Quedan excluidos de lotes automáticos y deberán revisarse con
  redacción fuera del repositorio.
- No se abrió ni copió ninguno de esos archivos.

### 2026-09-15 — Estado de complementos adicionales

- OpenKilo, OpenChamber, `opencode-pty` y `smart-voice-notify` quedan en
  categoría “interesante/probar”, no aprobados para instalación.
- OpenChamber no debe introducir un segundo sistema de worktrees; `opencode-pty`
  sólo se justifica si `hops` no cubre PTY persistente; la voz debe comenzar con
  TTS local y sin webhooks/red.

### 2026-09-15 — Consolidación del mapa de solapamientos

- Se creó un mapa único con una herramienta principal por problema: `hops` para
  worktrees/servidores, `.specs` + Linear para trazabilidad, Engram para memoria
  curada, OpenCode/Gentle para agentes y permisos, y CI/guards para invariantes.
- Los plugins quedan subordinados a gaps medidos y no pueden crear una segunda
  fuente de verdad.

### 2026-09-15 — Fronteras de propiedad de la arquitectura objetivo

- Se explicitó la separación Global/Tooling, Hospeda y Externo.
- La integración genérica de Linear y el lifecycle reutilizable de worktrees se
  proyectan fuera del repo Hospeda, con adaptadores HOS versionados aquí.
- Tokens, auth global, DB Engram y preferencias de otros repos quedan fuera del
  repositorio del proyecto.

### 2026-09-15 — Inventario de worktrees existentes

- `git worktree list` registra 29 worktrees, incluyendo `staging`, issues
  activos, worktrees auxiliares y el worktree dedicado de esta migración.
- Ninguno se eliminó ni se modificó. La limpieza de OpenCode/Gentle debe dejar
  Git y esos worktrees fuera de su alcance.
- Este inventario refuerza la decisión de mantener `hops` como único lifecycle
  y no agregar un plugin que compita con él.

### 2026-09-15 — Estado de cambios en worktrees

- De los 29 worktrees registrados, 12 tienen cambios, 16 están limpios y uno no
  pudo leerse durante la inspección read-only.
- Se contabilizaron 62 entradas de cambio en los worktrees sucios, sin mostrar
  nombres ni contenidos.
- Ningún cleanup automático es seguro con este estado; cualquier retiro futuro
  debe excluir worktrees sucios y requerir una lista revisada.

### 2026-09-15 — Revisión de consistencia documental

- Se revisaron 29 documentos Markdown bajo `docs/migration` y no se encontraron
  enlaces relativos rotos.
- Se comprobó que las referencias a credenciales en documentación preexistente
  son placeholders, y que los documentos nuevos no contienen DSN con valores
  reales.
- El worktree conserva únicamente documentación/`AGENTS.md` sin commits; no se
  modificó código, configuración global, Linear, Engram ni Git.

### 2026-09-15 — Tamaño y frontera de conocimiento raíz

- `AGENTS.md` tiene 40 líneas y contiene sólo reglas transversales y
  invariantes; `CLAUDE.md` conserva 980 líneas de compatibilidad y conocimiento
  especializado.
- Se registró que las diferencias entre ambos deben resolverse con una fuente
  activa explícita, no duplicando reglas. OpenCode no debe depender de leer
  `CLAUDE.md` automáticamente.

### 2026-09-15 — Mapa de extracción de `CLAUDE.md`

- Se mapeó cada bloque grande de `CLAUDE.md` a `AGENTS.md`, una skill específica,
  `hops`/commands o documentación normal.
- Billing, despliegue y smoke quedan fuera de `AGENTS.md` por su detalle y
  volatilidad; se cargarán bajo demanda con límites de seguridad.
- `.qtm` queda como documentación histórica y no como skill activa.

### 2026-09-15 — Revalidación de estado consolidado

- `current-state.md` y el plan se actualizaron a la verificación del 15 de
  septiembre.
- Se corrigió la descripción para no presentar el statusline faltante como
  activo: sólo el logo TUI está confirmado; la entrada de statusline queda
  pendiente.

### 2026-09-15 — Corrección de referencias históricas

- Se marcaron como históricas las referencias al baseline pre-limpieza que
  describían tres plugins TUI.
- El estado actual documentado conserva dos entradas TUI, de las cuales sólo el
  logo local está resuelto; el statusline sigue pendiente.

### 2026-09-15 — Índice de documentación

- Se agregó `docs/migration/README.md` con enlaces a estado, ejecución, memoria,
  Linear/specs, seguridad, arquitectura y plugins.
- El índice aclara que los documentos son análisis y gates; no autoriza ejecutar
  etapas pendientes.

### 2026-09-15 — Registro de decisiones humanas

- Se agregó una tabla de decisiones con opciones, recomendación, impacto y
  reversibilidad.
- La implementación futura queda bloqueada conceptualmente hasta decidir
  Engram, specs/SDD, permisos, alcance inicial de `hops`/Linear, repositorio de
  tooling y período de coexistencia con Claude.

### 2026-09-15 — Checkpoint documental

- El índice reúne 32 documentos de migración y la verificación de enlaces no
  detecta referencias relativas rotas.
- Todo el material sigue sin commits en el worktree dedicado
  `chore/opencode-gentle-ai-migration`; el checkout principal no fue usado para
  estas ediciones.
- El próximo paso recomendado es revisar y aprobar las decisiones humanas y
  ejecutar sólo el Gate 1 (backup/restore de Engram sobre copia temporal).

### 2026-09-15 — Revalidación de Engram después de limpieza externa

- El estado actual contiene 9.706 observaciones, frente a 9.850 en el inventario
  anterior: 149 IDs fueron eliminados y 5 observaciones nuevas aparecieron.
- Las 149 eliminadas eran del proyecto `hospeda`; predominan decisiones,
  descubrimientos y bugfixes. No se las restaurará automáticamente.
- La copia actual pasa `integrity_check`; las 97 violaciones de foreign key
  observación→sesión ya existían antes de la limpieza según la copia anterior.
- Se actualizó la política para descartar exports viejos como fuente de
  restauración automática y rehacer el inventario antes de continuar.

## Backups

El backup Stage 0 está creado y verificado en
`/home/qazuor/.local/state/hospeda-opencode-migration/backups/2026-09-14-stage0`.
Su manifiesto, tamaño y checksums se conservaron antes de la limpieza. La prueba
de restauración de Engram todavía queda pendiente y deberá hacerse sobre una
copia separada antes de sanear o activar esa memoria.

## Decisiones y cambios

Se agregarán aquí decisiones tomadas durante la ejecución, con su motivo y etapa. No se registrarán secretos ni valores de credenciales.

## Problemas y rollback

Se registrarán aquí fallos, operaciones parciales y el procedimiento de reversión asociado.

## 2026-09-15 — relevamiento de artifacts visuales

- Se localizaron 271 HTML en los `tool-results` de Claude (~50.3 MiB).
- Por SHA-256 hay 232 grupos de contenido exacto; 39 archivos son duplicados.
- La mayor concentración está en `hospeda2` (224 archivos), seguida por
  trabajos HOS-1257 (38). Los títulos se agruparon sin copiar contenido: issues/
  triage 65, producto/paridad 46, smoke/calidad 35 y otras familias.
- El HTML capturado incluye el runtime/frame del visor de Claude; no es una
  representación portable segura para copiar directamente.
- La documentación actual de OpenCode V2 no muestra un Artifact viewer o
  servicio de publicación equivalente. Sus plugins/tools permiten construir un
  renderer propio.
- Gentle-AI tiene artifacts de SDD para trazabilidad (OpenSpec/Engram), no un
  sistema visual HTML.
- Recomendación provisional: contrato JSON/YAML + renderer HTML autocontenido +
  command/tool `artifact-render` + preview local opt-in; publicación externa
  desacoplada y posterior.
- No se migró ni publicó ningún artifact.

## 2026-09-15 — corrección: artifacts online de Claude

- Se corrigió la distinción entre HTML locales de `tool-results` y Artifacts
  hospedados en `claude.ai/code/artifact/:uuid` / `claude.ai/artifact/:id`.
- El inventario real de artifacts online, sus URLs y su historial no está
  disponible en disco y queda pendiente de catálogo desde la cuenta/galería de
  Claude; no se intentará inferirlo ni enumerar UUIDs.
- Se documentó una propuesta de servidor común con URL estable, revisiones
  inmutables, selector de versiones, restauración por nueva versión, privado
  por defecto, compartir/revocar y adaptadores OpenCode/Gentle/hops.
- Quedaron siete decisiones humanas sobre hosting, audiencia, edición, refresh,
  interactividad, catálogo y compatibilidad futura con Claude.

## 2026-09-15 — decisiones sobre la mini app de artifacts

- El usuario confirmó una mini app multi-proyecto, potencialmente desplegada en
  Vercel, para artifacts nuevos; no se migrarán los artifacts históricos de
  Claude por ahora.
- Lectura pública sin cuenta es aceptable, con `noindex,nofollow`; se documentó
  que esto no es confidencialidad ni control de acceso.
- El visor será interactivo, pero el markup quedará separado de datos JSON.
  La persistencia debe modelarse como eventos tipados, no como mutación libre
  del HTML ni como única escritura en `localStorage`.
- Publicación y actualización serán snapshots explícitos desde OpenCode/hops.
- Se detectó una decisión técnica obligatoria: un visor público no puede tener
  escritura anónima abierta. Se propusieron capability tokens por acción o
  autenticación, con lista permitida, rate limit e idempotencia.
- Recomendación MVP: interacción de lectura (tabs/filtros/búsqueda) y luego un
  único widget persistente con datos no sensibles.

## 2026-09-15 — alcance confirmado del MVP de artifacts

- El MVP será una mini app local, sin despliegue remoto inicial.
- Incluirá galería/listado, página individual, selector de versiones y un
  checklist persistente desde la primera versión.
- Se usará SQLite aislado de Engram, con repositorios abstractos para poder
  reemplazarlo luego por API + SQL/Blob remoto.
- Las mutaciones locales requerirán sesión/token local; no se agregará OAuth en
  esta etapa. El servidor escuchará solo en 127.0.0.1.
- Se definieron gates de reinicio, versionado, restauración, export/import y
  validación antes de evaluar Vercel.

## 2026-09-15 — contrato `artifact/v1`

- Se definió el contrato preliminar para la app local: artifact estable,
  versiones inmutables, `data`, `view`, capabilities, fuentes y HTML derivado.
- El primer evento persistente será `reviewChecklist.itemToggled`, con payload
  estricto, idempotencia y reconstrucción desde log.
- Restaurar será una nueva versión basada en una anterior; no se borrará
  historial.
- Se definió la API local y el criterio de aceptación antes de implementar.

## 2026-09-15 — prototipo local inicial

- Se creó `tools/artifact-app` en el worktree de migración, aislado de las
  apps de Hospeda y sin agregar dependencias al workspace.
- El prototipo usa Node 22 `node:sqlite`, escucha solo en `127.0.0.1`, tiene
  galería, página de artifact, selector de versiones y endpoint de eventos.
- `publish-sample.mjs` crea un checklist de demo; el toggle se persistió y se
  recuperó mediante una prueba efímera en `/tmp`.
- Se corrigió el selector para leer la versión solicitada en la URL.
- Aún no está integrado con OpenCode, hops, Linear, Engram ni con publicación
  remota. Es una validación del contrato, no una instalación productiva.

## 2026-09-15 — publicación y restauración del prototipo

- Se agregó `publish-bundle.mjs` para publicar snapshots `artifact/v1` desde
  JSON, creando artifact o nueva versión según el slug.
- El servidor ahora expone POST de nueva versión y restauración; restaurar crea
  una versión nueva con `basedOnVersion` y conserva las anteriores.
- Se validó la sintaxis de ambos scripts. La prueba HTTP adicional quedó
  pendiente de una ejecución con lifecycle de servidor controlado; la prueba
  previa de evento persistente sí pasó en `/tmp`.

## 2026-09-15 — sesión local y prueba completa del MVP

- Las mutaciones del prototipo ahora requieren una cookie de sesión efímera y
  `Origin` local; un POST sin sesión responde 401.
- Se validó en `/tmp`: 401 sin sesión, toggle autenticado, restauración de
  versión 1 como versión 2 y listado de ambas versiones.
- La sesión no se guarda en el repositorio ni en Engram. OAuth y autenticación
  remota quedan para la etapa Vercel.

## 2026-09-15 — integración inicial con hops

- Se agregó `hops artifact publish <bundle.json>` y `hops artifact list` al
  dispatcher de `scripts/client-tools`, más el alias `hops-artifact`.
- `publish` delega al publisher determinista de `tools/artifact-app`; no llama
  modelos, Linear, Engram ni Git.
- `list` consulta únicamente el servidor local.
- El comando se compiló con Bun correctamente. El typecheck global del repo no
  fue concluyente por dependencias del workspace ausentes en este worktree;
  ese fallo es preexistente y ajeno al command.

## 2026-09-15 — commands de OpenCode

- Se agregaron `.opencode/commands/artifact-publish.md` y
  `.opencode/commands/artifact-list.md`.
- `artifact-publish` exige leer metadata segura y confirmación humana antes de
  delegar en `hops artifact publish`; no publica remotamente ni toca Linear,
  Engram o Git.
- `artifact-list` usa el agente de planificación y solo consulta metadata local.

## 2026-09-15 — corrección del modelo: artifacts desde lenguaje natural

- Se corrigió el alcance: el usuario no debe preparar JSON. OpenCode debe
  investigar un pedido conversacional y producir el bundle internamente.
- Se definieron bloques visuales declarativos: hero, métricas, narrativa,
  callouts, tablas, timelines, diagramas SVG, checklists, código y enlaces.
- Se agregó la skill `.opencode/skills/visual-artifact` y el command
  `.opencode/commands/artifact-create.md`, con investigación, incertidumbre,
  preview y confirmación antes de publicar.
- El prototipo actual de bundle/checklist se conserva como capa técnica; todavía
  falta implementar el renderer rico y el validador formal.

## 2026-09-15 — decisión de división LLM/renderer

- Se decidió que el LLM genera análisis, datos y composición declarativa; el
  script genera HTML/CSS/JS, controles, sanitización y persistencia.
- Se conservará variedad visual mediante componentes y variantes de layout
  declarativas, sin permitir markup o scripts arbitrarios.
- Los componentes especiales se agregan al renderer una vez y luego se
  reutilizan; HTML libre queda fuera del MVP.

## 2026-09-15 — validador artifact/v1

- Se agregó `tools/artifact-app/validate-bundle.mjs` y `hops artifact validate`.
- Valida schema, slug, bloques permitidos, markup ejecutable, URLs externas,
  claves con forma de credencial y tamaño máximo.
- El bundle válido fue aceptado y el bundle con `<script>` fue rechazado.
- El validador es un gate read-only previo a cualquier publicación.

## 2026-09-15 — renderer de bloques visuales

- El visor ahora renderiza bloques declarativos `hero`, `prose`, `callout`,
  `metricGrid`, `table`, `timeline` y `checklist`.
- Los textos se escapan antes de entrar al HTML; la interactividad de checklist
  conserva el endpoint de eventos existente.
- Si una versión no declara secciones, se mantiene el fallback de checklist.
- Se validó la sintaxis del servidor; falta una prueba visual completa de cada
  componente antes de considerar estable el renderer.

## 2026-09-15 — validación del renderer rico

- Se agregaron estilos base para hero, métricas, callouts, tablas, timelines y
  bloques scrolleables.
- Se publicó un bundle de demostración efímero con múltiples componentes.
- La página servida contenía título, métricas, narrativa, timeline y checklist;
  no se cargaron recursos externos.
- La prueba fue local y temporal en `/tmp`; no se creó ningún artifact real.

## 2026-09-15 — validación adicional del renderer rico

- Se agregaron estilos base para hero, métricas, callouts, tablas, timelines y
  bloques scrolleables.
- Se publicó un bundle de demostración efímero con múltiples componentes.
- La página servida contenía título, métricas, narrativa, timeline y checklist;
  no se cargaron recursos externos.
- La prueba fue local y temporal en `/tmp`; no se creó ningún artifact real.

## 2026-09-15 — tema visual del visor

- El renderer inicia en dark mode para acercarse al lenguaje visual de los
  Artifacts de Claude.
- Se agregó selector Oscuro/Claro/Sistema.
- La preferencia queda en `localStorage` y no contamina `artifact-state` ni los
  eventos persistentes.

## 2026-09-15 — cierre del frente Artifacts

- Se da por terminado este frente de análisis/prototipo para continuar con los
  demás componentes de la migración.
- Queda documentado el objetivo de replicar en el futuro la experiencia visual
  completa de Claude (layout editorial, cards, toolbar, historial y controles),
  pero no se intentará hacer una réplica pixel-perfect en esta etapa.
- El prototipo local queda como base técnica: contrato declarativo, renderer,
  galería, versiones, checklist persistente, validación y commands OpenCode/hops.
- Se detuvo el servidor temporal y no quedaron procesos del prototipo activos.

## 2026-09-15 — Gate 1 Engram: diagnóstico y rollback

- `engram --help` confirmó que `doctor` es read-only y que `export` recibe la
  ruta como argumento posicional; `engram export --help` creó accidentalmente
  un export llamado `--help`, que fue eliminado inmediatamente.
- Export read-only explícito a `/tmp` completó: 11.777 sesiones, 9.711
  observaciones, 65 prompts, archivo de 19.133.297 bytes.
- Se copió `~/.engram` a `/tmp` y el checksum SHA-256 de `engram.db` coincidió
  exactamente con el original.
- `PRAGMA integrity_check` sobre la copia devolvió `ok`.
- `engram doctor --json` quedó sin salida y excedió un timeout de 20 s incluso
  sobre la copia; stderr solo mostró el intento fallido de consulta de updates
  a GitHub (401). No se interpreta como diagnóstico aprobado.
- Todos los temporales fueron eliminados. La base original no fue modificada.

## 2026-09-15 — Gate 2 OpenCode V2: validación read-only

- `opencode --version` confirmó `v2.0.3`.
- Se validaron sintácticamente el launcher de Gentle-AI y `~/.config/opencode/tui.json`.
- `opencode debug paths` confirmó las rutas de datos, caché, configuración,
  estado, temporales, repositorios y base local documentadas en
  `opencode-gate2-validation.md`.
- `opencode debug config` confirmó que el runtime descubre `.claude` global,
  `.claude` del proyecto y `.agents`; por lo tanto la instalación del binario
  es limpia, pero la configuración efectiva todavía hereda fuentes anteriores.
- `opencode mcp list` y `opencode plugin list` no reportaron servidores ni
  plugins activos, pese a que la configuración global contiene claves MCP.
  La discrepancia queda pendiente de validación controlada.
- Un intento de `opencode debug agents` no pudo completar porque OpenCode
  intentó abrir su log global y encontró `EROFS`; no se modificó ningún archivo.

## 2026-09-15 — Gate 3: auditoría de permisos

- Se inspeccionó únicamente la estructura de `~/.config/opencode/opencode.json`.
- Se registraron 15 reglas `bash` y 14 reglas `read`, sin exponer valores
  sensibles.
- El shell tiene `* = allow` y las operaciones Git/red más delicadas están en
  `ask`; las rutas de secretos tienen reglas `read = deny`.
- Se documentó la necesidad de probar la precedencia de reglas y reducir la
  superficie antes de usar agentes sobre Hospeda. No se cambiaron permisos.

## 2026-09-15 — Gate 4: proveedores y modelos

- Se confirmó por inventario read-only que el baseline limpio no contiene
  `auth.json` ni `account.json` de OpenCode.
- `opencode models --help` y `opencode auth --help` no pudieron ejecutarse:
  OpenCode intentó abrir el log global y encontró `EROFS`.
- No se inició autenticación ni se mostraron credenciales. La disponibilidad
  concreta de modelos queda pendiente hasta contar con una ejecución controlada
  con log escribible.

## 2026-09-15 — Gate 5: Linear read-only

- Se inspeccionaron los módulos locales de Linear, `start-issue`, servicios de
  feedback y comandos de estadísticas.
- Se confirmó que la lógica determinista vive en `hops`; el acoplamiento a
  Claude está concentrado en el launcher posterior a la creación del worktree.
- No se leyó ninguna credencial, no se llamó a Linear y no se ejecutaron
  mutaciones. La consulta remota queda pendiente de una sesión controlada.

## 2026-09-15 — Gate 6: worktrees y `hops`

- Se inspeccionaron `start-issue`, la librería de worktrees, resolución de DB,
  servidores, puertos y pruebas unitarias.
- Se confirmó que Linear y la gestión de recursos son independientes del agente;
  el acoplamiento Claude está en los scripts globales de la skill y en
  `spawn('claude')`.
- No se crearon worktrees, no se levantaron servidores y no se modificó Git.
- Se recomienda conservar `hops` como autoridad única y adaptar sólo su
  launcher para OpenCode en una etapa versionada posterior.

## 2026-09-15 — Gate 7: memoria y conocimiento

- Se relevaron sólo ubicaciones y tamaños de `CLAUDE.md`/`MEMORY.md` y los
  archivos de Engram; no se expuso contenido sensible.
- Se confirmó que la reducción reciente de Engram es el nuevo baseline y que
  exports previos no se deben reimportar automáticamente.
- Se reafirmó la separación `AGENTS.md`/skills/commands/Linear/Engram y la
  revisión individual obligatoria antes de mover cualquier memoria.
- No se copiaron, importaron, consolidaron ni eliminaron memorias.

## 2026-09-15 — Gate 8: primera integración reversible

- `hops start-issue` acepta `--agent claude|opencode`; Claude sigue siendo el
  default y `--no-claude` mantiene su semántica.
- El cambio sólo selecciona el proceso posterior a la creación del worktree;
  Linear, Git, DB, puertos, servidores y cleanup permanecen iguales.
- Se agregaron pruebas de parsing, pero Bun no pudo cargar `@clack/prompts`
  porque faltan dependencias en el worktree. No se instalaron dependencias.
- No se ejecutó `start-issue`, no se creó worktree y no se lanzó ningún agente.

## 2026-09-15 — Gate 8: dependencias de `hops`

- Se confirmó que `scripts/client-tools` tiene `package.json` y `bun.lock`
  propios; no depende del workspace pnpm completo.
- Se instaló `bun install` únicamente dentro de ese paquete del worktree de
  migración. No se instaló nada global.
- La suite focalizada pasó: 28 tests, 0 fallos. La suite completa pasó después:
  288 tests, 0 fallos y 616 aserciones.
- Se recomienda mantener dependencias locales al paquete y evaluar más adelante
  un bundle standalone o wrapper global contra un checkout estable.

## 2026-09-15 — Decisión de distribución de `hops`

- Se adopta temporalmente un wrapper global apuntando a un checkout estable de
  `client-tools`.
- El bundle standalone queda como evolución posterior, cuando el CLI estabilice
  su contrato.
- No se modificó el wrapper global en esta etapa.

Nota: el wrapper global fue regenerado temporalmente con `--here` para apuntar
al worktree de migración. Al finalizar, debe volver a apuntar a
`/home/qazuor/projects/WEBS/hospeda-staging`.

## 2026-09-15 — Gate de complementos prioritarios

- Se actualizó la evaluación read-only de OpenKilo, OpenChamber, opencode-pty y
  smart-voice-notify.
- Se mantuvo `hops` como autoridad de worktrees/servidores y la TUI nativa como
  interfaz base.
- No se instaló ningún plugin; todos quedan sujetos a prueba aislada y revisión
  de permisos, mantenimiento y supply chain.

## 2026-09-15 — Diagnóstico del bloqueo de logs de OpenCode

- Se verificó que el filesystem que contiene `~/.local/share/opencode` está
  montado `ro`; el archivo y directorio tienen permisos nominales de usuario.
- Los subcomandos runtime continúan fallando al abrir el log global incluso con
  `OPENCODE_LOG_DIR=/tmp/opencode-log`.
- No se cambiaron permisos, ownership, symlinks ni configuración. MCP, modelos,
  agentes y plugins quedan pendientes hasta una sesión con almacenamiento
  escribible.

## 2026-09-15 — Runbook runtime preparado

- Se dejó un procedimiento reproducible para repetir los checks de OpenCode
  cuando el filesystem sea escribible.
- El runbook limita la validación a nombres/estados y prohíbe login, instalación,
  mutaciones, Linear, Engram write, Git y worktrees.

## 2026-09-16 — Runtime validado fuera del sandbox

- Ejecutando fuera del sandbox read-only, `opencode v2.0.3` y sus subcomandos
  de ayuda funcionaron sin error de log.
- `opencode models` devolvió catálogo de `github-copilot`, `ollama` y
  `opencode`; no se guardaron ni mostraron credenciales.
- `opencode mcp list` y `opencode plugin list` informaron cero activos.
- El bloqueo queda clasificado como limitación del sandbox de esta sesión, no
  como fallo de la instalación real.
- `opencode auth list` mostró únicamente una entrada de GitHub; se registró el
  proveedor, nunca identidad, token ni contenido de credenciales.
- `opencode debug agents` terminó correctamente fuera del sandbox y generó
  6.172 líneas; se registró sólo el conteo porque la salida contiene prompts y
  reglas que no deben publicarse.

## 2026-09-16 — Linear read-only remoto

- `hops start-issue --dry-run --no-claude` contactó Linear correctamente para
  HOS-1257, HOS-1322 y HOS-1247.
- Los tres issues están cerrados (`Canceled`/`Done`), por lo que el comando se
  detuvo antes de derivar branch/slug al exigir confirmación interactiva.
- No se creó worktree, no se cambió estado en Linear y no se expusieron claves.
- HOS-1344 está en `Backlog`; la consulta read-only derivó
  `fix/hos-1344-el-mapa-de-mensajes-http-solo-cubre-0` y terminó correctamente
  en `--dry-run`. No se creó worktree ni se mutó Linear.

## 2026-09-16 — Gap de `closeIssue`

- La inspección no encontró implementación ejecutable de `closeIssue`; las
  referencias disponibles son documentación/estado histórico.
- Se corrigió el backlog para tratarlo como construcción nueva: primero
  `hops close-issue --plan` read-only, luego mutaciones separadas con
  autorización y read-back.

Actualización: `hops close-issue --plan` ya está implementado en el worktree y
la suite completa pasó con 288 tests, 0 fallos y 625 aserciones. No aplica
mutaciones de Linear, Git ni worktrees.

El preflight también acepta `--issue HOS-NNN`; HOS-1344 fue consultado desde la
branch de migración y devolvió `Backlog` correctamente, sin mutaciones.

El plan local ahora informa presencia de `closeout.md` y `tasks/state.json`;
la prueba volvió a pasar sin crear recursos.

## 2026-09-16 — Requisitos de completitud y reinstalación

- Se agregó como gate obligatorio que todos los comandos actuales y los P0 de
  `client-tools` estén implementados y validados antes de usar OpenCode como
  entorno principal.
- Se documentó un bootstrap futuro, versionado, idempotente y con backups,
  manifest, `--plan`/`--dry-run` y rollback para reinstalar la máquina sin
  repetir el trabajo manual.
- El bootstrap no automatizará logins, secretos, aprobación de plugins,
  selección de memorias ni mutaciones externas.

Se implementó el P0 `hops recap` como comando read-only con resumen de worktree,
branch, issue, Git, DB, servidores y últimos commits. La suite completa quedó
en 288 tests, 0 fallos y 634 aserciones.

Se agregó `.opencode/commands/recap.md`: `/recap` usa `hops recap` para hechos
estáticos y el modelo agrega contexto de sesión, hallazgos, problemas,
pendientes, riesgos y siguiente paso, sin escribir memoria ni mutar servicios.

Se estableció el contrato transversal: `hops` concentra la lógica pesada y
ofrece salida estructurada/humana; los commands propios del agente usan el
prefijo `hops-`. Se agregó `/hops-recap` como nombre canónico y `/recap` queda
como alias transitorio.

Se agregó consulta read-only de PR/CI reutilizando `findPr`; HOS-1344 desde la
branch de migración devolvió `sin PR` sin mutaciones.

El preflight ahora imprime labels y detecta gates `status-needs-smoke-*`; con
HOS-1344 no había gates de ese tipo y no se modificó Linear.

La suite completa de `client-tools` se ejecutó nuevamente tras estos cambios:
288 tests, 0 fallos y 625 aserciones.

Se validó `hops start-issue HOS-1344 --agent opencode --dry-run`: Linear,
derivación de branch y selección del agente funcionaron; no se creó worktree ni
se lanzó OpenCode.

El catálogo de modelos no mostró entradas `openai/*` ni `gpt/*`; los GPT
disponibles aparecen bajo `github-copilot/*`. OpenAI directo sigue pendiente de
configuración y autenticación explícita.

Se consultó `opencode auth login --help` sin iniciar login; el flujo acepta un
target de integración y un método explícito. Queda preparado para una etapa
autorizada de autenticación.

`hops recap` ahora ofrece `--json` con contrato estable para agentes; la salida
humana sigue siendo el comportamiento predeterminado.

Se implementó `hops issue-preflight HOS-NNN` para consultar Linear, labels,
worktrees asociados y guía de PR/CI sin mutaciones. HOS-1344 fue validado; la
suite completa quedó en 288 tests, 0 fallos y 643 aserciones.

Se implementó `hops context HOS-NNN` con salida humana y `--json`; HOS-1344 fue
validado y la suite completa pasó con 288 tests, 0 fallos y 652 aserciones.

Se implementó `hops smoke-plan HOS-NNN` con salida humana y `--json`; HOS-1344
devolvió cero gates y la suite completa pasó con 288 tests, 0 fallos y 661
aserciones.

Se implementó `hops handoff --plan` con salida humana y `--json`; prepara cambios,
estado Git, commits recientes y pendientes sin commit ni escritura de memoria.
La suite completa pasó con 288 tests, 0 fallos y 670 aserciones.

Se agregó `/hops-handoff` como contraparte OpenCode: consume el JSON de `hops`
y redacta el prompt autocontenido con contexto, hallazgos, decisiones,
problemas, pendientes, bloqueos y próximo paso, sin mutaciones.

El prompt queda encerrado entre `===== BEGIN HOSPEDA HANDOFF =====` y
`===== END HOSPEDA HANDOFF =====` para que sea fácil identificar y copiar sus
límites.

Se completó la capa de contrapartes OpenCode con prefijo `hops-`: `hops-recap`,
`hops-handoff`, `hops-context`, `hops-issue-preflight`, `hops-smoke-plan`,
`hops-close-issue`, `hops-start-issue` y los tres comandos de artifacts. Cada
command es deliberadamente fino: invoca el script determinista, presenta sus
hechos y agrega narrativa sólo cuando corresponde. Las variantes que pueden
crear estado (`hops-start-issue` sin `--dry-run` y publicación de artifacts)
quedan explícitamente protegidas por autorización. Los nombres sin prefijo se
mantienen como aliases transitorios donde ya existían.

Se completó además la cobertura documental de los 26 comandos del registro
(`stats`, worktrees, DB, servidores, CI, merge, env, run y update incluidos).
OpenCode dispone ahora de una contraparte `hops-*` para cada comando; cada una
declara si es read-only o si necesita autorización por iniciar procesos,
escribir estado o ejecutar una operación destructiva. El catálogo de artifacts
conserva tres aliases prefijados adicionales para sus operaciones específicas.

El paquete `@hospeda/client-tools` fue alineado con esta superficie: ahora
declara también los binarios prefijados de handoff, smoke-plan, context,
issue-preflight, recap y close-issue; `uninstall.sh` los contempla para una
retirada completa. `bun run typecheck` y la suite volvieron a pasar: 288 tests,
0 fallos y 670 aserciones.

Se hizo una validación end-to-end read-only de `hops ci` y `hops merge` contra
GitHub desde la branch de migración. Ambos resolvieron correctamente la branch
`chore/opencode-gentle-ai-migration` y devolvieron `No hay PR`, sin ejecutar
mutaciones. Quedan pendientes los estados que requieren PR real (verde, rojo,
pendiente, conflicto y merge-base atrasado); los tests unitarios cubren sus
reglas, pero no sustituyen esa prueba integrada.

Se agregó `hops-command-status.md` para distinguir comandos completos,
parciales, preflight-only y candidatos todavía no implementados. En particular,
`ci` y `merge` tienen gates y tests unitarios, pero quedan pendientes de
validación end-to-end contra GitHub; los comandos de DB/servidores también
requieren una prueba controlada por sus efectos externos. El backlog conserva
como candidatos `verify --changed`, `guard`, `quality-check`, `docs-check`,
`smoke` y `linear-backlog`.

Se incorporó `hops verify --changed`: activa los tests de los paquetes afectados
además de los pasos de lint, guards y typecheck leídos desde CI. La contraparte
`.opencode/commands/hops-verify.md` instruye al agente a usarlo antes de lanzar
verificaciones manuales o suites amplias. `--tests` queda como alias explícito
y `--full` conserva la ejecución completa bajo demanda.

Se agregó una prueba integrada del binario `hops-ci` con un ejecutable `gh`
simulado en un directorio temporal. Cubre PR verde, rojo, pendiente, conflicto,
sin checks, sin PR y error de credenciales, verificando códigos de salida y
mensajes sin tocar GitHub. La suite completa quedó en 289 tests, 0 fallos y
684 aserciones.

Se generó y validó el artifact `hops-command-catalog` con bloques hero,
callout, métricas, tabla, timeline, acordeón y checklist persistente. Fue
publicado como versión local 1 en la base de artifacts; visor esperado:
`http://127.0.0.1:4317/artifacts/hops-command-catalog` cuando se inicia el
servidor local.

Se corrigió el visor tras detectar dos fallos visuales: reglas CSS duplicadas
dejaban tarjetas blancas en modo oscuro y el handler del selector de versión
reemplazaba al del selector de tema. El renderer ahora usa variables de color
para dark/light/system y IDs independientes (`theme` y `version-selector`). La
respuesta HTML de una instancia temporal fue verificada con ambos selectores y
la versión corregida se publicó como snapshot local v2. Para verla hay que
reiniciar el servidor local, porque una instancia ya ejecutándose conserva el
código anterior.

Se agregó autoreload del visor: la página del artifact consulta cada 3 segundos
`/api/artifacts/<slug>/meta` y navega a la última versión cuando detecta un
snapshot nuevo. La galería se actualiza cada 5 segundos. La prueba temporal
confirmó el endpoint `latestVersion`, los IDs separados de tema/versión y el
script de polling. Una instancia del servidor que ya estaba abierta debe
reiniciarse una vez para cargar este código.

Se generalizó la persistencia de interacciones: además de checks, el renderer
acepta campos declarativos `text`, `select` y `multiselect` dentro de bloques
`form`. Cada cambio se guarda como evento `widget.valueChanged`; el endpoint de
estado devuelve el mapa persistente y `hops artifact state <slug>` lo expone al
agente en JSON. Una prueba temporal marcó un text input y confirmó que el valor
se recupera desde la API después de la interacción, sin usar `localStorage`.
El validador `artifact/v1` reconoce ahora el bloque `form`.

Se generó el artifact vivo de la épica `claude-opencode-migration`, publicado
como snapshot local v3. Está dividido en fases de relevamiento, instalación,
memoria, workflow/hops, specs/SDD, seguridad, artifacts y validación final.
Cada ítem contiene título, categoría, descripción, notas y estado inicial; los
trabajos ya verificados están marcados por defecto. La API de estado ahora
incluye esos defaults además de los eventos del usuario, por lo que el agente
puede distinguir lo completado de lo que falta.

El checklist de migración se amplió de 36 a 72 ítems. Se incorporaron tareas
de providers/modelos, TUI, proyectos y deduplicación Engram, extracción de
CLAUDE.md, Linear/worktrees/ports/DB/pass/cleanup, trazabilidad specs-SDD,
guards y supply chain, generación de artifacts desde lenguaje natural, y
evaluación de OpenKilo/OpenChamber/PTY/voz, además de rollback y aprobación
final. Cada ítem conserva título, categoría, descripción, notas y `done`.
El snapshot publicado es la versión 4 de `claude-opencode-migration`.

Se documentó la operación 24/7 en `artifact-server-24x7.md`: el contenido se
actualiza sin reinicio mediante snapshots y polling; sólo los cambios del motor
requieren un restart controlado. La arquitectura objetivo usa una única
instancia estable fuera de los worktrees, DB externa al checkout, servicio de
usuario con health-check y rollback.

Se reprodujo y corrigió un rechazo `400 invalid_event` al marcar checks: el
servidor sólo validaba la colección legacy `data.widgets.reviewChecklist`,
aunque el artifact usaba el bloque declarativo `data.sections[].type=checklist`.
Ahora acepta ambas representaciones. La prueba aislada confirmó POST `201` y
recuperación de `{\"changed\":true}` vía `/state`; la instancia del visor debe
reiniciarse para cargar la corrección.

Se comenzó el desacople del workflow de worktrees: los scripts de `~/.claude/skills/worktree/scripts` se copiaron al árbol versionado `scripts/worktree/`, y `start-issue` ahora prefiere esa copia; el fallback global queda sólo para compatibilidad temporal. `client-tools` pasó typecheck y los 28 tests de start-issue. El typecheck del monorepo raíz no pudo ejecutarse porque este worktree no tiene instaladas las dependencias de Turbo.

El artifact `claude-opencode-migration` se actualizó a la versión 5 y marca este desacople inicial como completado, manteniendo pendientes las pruebas reales de ports, DB, servidores y cleanup.

## 2026-09-16 — Gate 6b: comandos y worktree versionado

- `client-tools` quedó verificado con typecheck y la suite completa: 289 tests ejecutados; una primera corrida tuvo un timeout aislado de carga dinámica de comandos y la repetición focalizada pasó (13/13). No se modificó el código para ocultar el timeout; queda como señal de estabilidad a vigilar.
- Se documentaron en el README todos los comandos disponibles y sus binarios prefijados `hops-*`, incluyendo la lectura de estado de artifacts.
- `start-issue` admite `HOPS_WORKTREE_SCRIPT_DIR` para instalaciones externas, pero prioriza siempre `scripts/worktree/` versionado del proyecto. El fallback de Claude sólo evita romper instalaciones antiguas.
- Se actualizó el bundle de migración con esa precisión. No se marcaron como terminadas las pruebas E2E que todavía requieren worktree, DB, puertos y servidores reales.
- `hops verify --changed --list` fue ejecutado en el paquete de tooling y mostró
  los pasos de lint, 36 guards y typecheck; las instalaciones y el baseline de
  CI quedaron correctamente fuera por ser responsabilidades del runner.

## 2026-09-16 — Gate 6c: E2E aislado de worktree

- Se ejecutó `wt-create.sh` en un repositorio Git temporal con configuración
  mínima: creó branch/worktree y el archivo de estado esperado.
- `wt-ports.sh` asignó dos puertos distintos (3100 y 4100) según los defaults,
  sin tocar los worktrees de Hospeda.
- `wt-remove.sh` rechazó correctamente un worktree sucio; luego `--force`
  eliminó sólo el worktree temporal y su branch. El repositorio temporal quedó
  con un único worktree.
- Esto valida el núcleo create/ports/safety/cleanup. No valida todavía DB,
  pass/env ni servidores reales; esas tareas permanecen pendientes.

## 2026-09-16 — Gate 6d: E2E aislado de env y puertos

- En un repositorio temporal se validó `wt-env-prepare.sh`: conserva un valor
  existente y agrega sólo claves activas de `.env.example`.
- Se validó `wt-env.sh` con una configuración sintética: reescribe `PORT` y
  `PUBLIC_URL` usando el puerto elegido, sin leer archivos de Hospeda.
- La prueba no usó pass, `.env` ni credenciales reales. Por eso el gate de
  secretos y pass queda pendiente; tampoco se marcaron como terminadas las
  colisiones entre worktrees reales.

## 2026-09-16 — Gate 6e: colisión de puertos

- Se crearon dos worktrees temporales con estados sintéticos. El primero
  reservaba el puerto 3100; al consultar desde el segundo, `wt-ports.sh`
  asignó 3101, evitando la reserva registrada.
- La prueba confirmó que la asignación considera estados de otros worktrees y
  que no necesita consultar ni modificar servicios de Hospeda.
- Se marcó como completado el ítem de asignación de puertos del artifact. La
  validación de DB, servidores y pass sigue separada.

## 2026-09-16 — Gate 6f: DB aislada y guard de volumen

- En un worktree temporal con `createdb`/`psql` simulados se validó que el nombre
  de DB deriva de forma estable del directorio (`hospeda_wt_HOS_DB`), se guarda
  en `worktree-state.local.json` y se escribe en `DATABASE_URL`.
- Se probó el guard de modo `fresh`: una configuración cuyo comando contiene
  `docker compose down -v` fue rechazada antes de ejecutar cualquier operación.
- No hubo conexión a PostgreSQL real, Docker, migraciones ni seed. La prueba
  valida contratos y límites, no la disponibilidad del servicio real.

## 2026-09-16 — Gate 6g: lifecycle de servidores

- En un worktree temporal se configuró un servidor sintético (`sleep`) y se
  validó `wt-servers.sh start`: registra PID, puerto, log y proceso en el state.
- `wt-servers.sh stop` terminó el grupo de procesos y limpió `.servers` del
  estado. No se levantaron servidores de Hospeda ni se ocuparon sus puertos.
- Quedan pendientes los health checks HTTP reales y la secuencia completa de
  `wt-up` con DB y build del monorepo.

## 2026-09-16 — Gate 6h: health checks fail-closed

- La prueba de `wt-up` con un servidor sintético reveló que un timeout de health
  se imprimía como `TIMEOUT`, pero el proceso terminaba con código 0 y decía
  `wt-up complete`.
- Se corrigió `scripts/worktree/wt-up.sh`: ahora acepta `HOPS_HEALTH_TIMEOUT`
  para diagnósticos deterministas y devuelve exit 1 cuando cualquier servidor no
  pasa su health check. La prueba temporal confirmó el nuevo comportamiento.
- El sandbox no permitió abrir sockets para validar HTTP real; no se modificaron
  servicios existentes y el proceso sintético fue detenido y limpiado.
- `bash -n scripts/worktree/*.sh`, typecheck de `client-tools` y las pruebas
  focalizadas de `start-issue`/binarios pasaron (41/41). El typecheck del
  monorepo raíz sigue sin poder correr aquí porque no están instaladas las
  dependencias de Turbo.

## 2026-09-16 — Gate 7: cobertura de comandos OpenCode

- Se comparó automáticamente el registro de 26 comandos de `client-tools` con
  `.opencode/commands/`.
- Faltaba una contraparte agrupadora para `artifact`; se agregó
  `.opencode/commands/hops-artifact.md`, que documenta validate/publish/list/state
  y mantiene al script como autoridad determinista.
- La comprobación ahora informa `COMMAND_COVERAGE_OK`: 26 comandos cubiertos,
  con 30 wrappers porque artifact tiene cuatro operaciones explícitas.
- `hops artifact --help` confirmó la interfaz `validate|publish|list|state`.

## 2026-09-16 — Gate 7b: retiro de aliases sin prefijo

- Se compararon `artifact-create`, `artifact-list`, `artifact-publish` y
  `recap` con sus equivalentes `hops-*` antes de eliminarlos.
- Los comandos prefijados quedaron autocontenidos: describen investigación,
  renderer declarativo, validación, confirmación y lectura/persistencia de estado.
- Se eliminaron los cuatro archivos sin prefijo. La comprobación automática
  confirmó cobertura de los 26 comandos registrados y ningún alias duplicado.
- `/hops-recap` y `hops-artifact-*` quedan como interfaz canónica del proyecto.
- La auditoría posterior confirmó frontmatter válido en los 30 commands
  `hops-*`, sin referencias a archivos eliminados y con una llamada explícita
  al CLI `hops` en cada uno.

## 2026-09-17 — Estabilidad de carga del registro

- La prueba que carga dinámicamente los 26 módulos del registro podía agotar el
  timeout por el cold start de Bun, aunque los módulos fueran correctos.
- Se aumentó sólo el timeout de esa prueba a 15 segundos para distinguir carga
  lenta de un error real. No se relajaron asserts ni se ocultaron fallos.
- Typecheck y suite completa pasaron: **289 tests, 0 fallos, 684 expect**.

## 2026-09-17 — Gate 8: bootstrap seguro inicial

- Se agregó `scripts/bootstrap/opencode-gentle-bootstrap.sh` como base
  versionada para reinstalaciones reproducibles.
- `--plan` imprime el orden de backup, instalación, configuración, Engram y
  verificación. `--verify` inspecciona sólo presencia y primera línea de versión
  de Bash, Git, jq, Bun, Node, OpenCode, Gentle-AI y Engram, además de existencia
  de rutas globales.
- El script declara explícitamente `secret-values=not-read` y
  `mutations=none`. No instala, borra, autentica ni restaura nada.
- La prueba pasó sintaxis, plan y verify. La implementación de `--apply` queda
  pendiente de aprobación y diseño de rollback.

## 2026-09-17 — Gate 9: guard de secretos staged

- Se reemplazó el escaneo inline del pre-commit por
  `scripts/guards/staged-secrets.sh`.
- El guard bloquea archivos `.env`, claves privadas, dumps y patrones comunes de
  tokens/DSN en líneas agregadas. Reporta sólo la regla, nunca el valor.
- Se probó en repositorio temporal: un cambio normal pasa; un token sintético
  falla y el valor no aparece en la salida.
- `bash -n` y `git diff --check` pasaron. El guard quedó integrado al pre-commit
  del worktree; no se ejecutó ningún commit.

## 2026-09-17 — Gate 10: rollback de cleanup

- Se creó un worktree temporal con un archivo sin commit y se ejecutó
  `wt-remove.sh` sin `--force`.
- El comando devolvió exit 1, conservó el directorio, la branch local y el
  contenido sin commit. Esto confirma el rollback seguro ante un cleanup que
  podría perder trabajo.
- `--force` sigue siendo una acción separada y explícita; no se cambia el
  comportamiento por defecto.

## 2026-09-17 — Gate 11: launcher OpenCode read-only

- `hops start-issue --help` confirma la interfaz explícita
  `--agent claude|opencode` y `--dry-run`.
- La ejecución read-only con `HOS-1344 --agent opencode --dry-run` no pudo
  consultar Linear porque el entorno actual no permite conectar al endpoint.
  El comando falló cerrado, sin crear worktree, branch ni mutar Linear.
- La derivación y selección del agente siguen cubiertas por tests unitarios;
  queda pendiente repetir el dry-run con conectividad read-only disponible.

## 2026-09-17 — Gate 11b: Linear read-only restablecido

- Con la conectividad de Linear disponible, `hops start-issue HOS-1344
  --agent opencode --dry-run` consultó el issue real y devolvió estado Backlog,
  labels, tipo `fix`, slug y branch esperada.
- El comando terminó con exit 0 y confirmó que no creó worktree ni mutó Linear.
- La ejecución mutante que crea el worktree y lanza OpenCode queda separada para
  una prueba controlada; no se ejecutó automáticamente.

## 2026-09-17 — Gate 11c: launcher OpenCode E2E sintético

- Se ejecutó `start-issue HOS-1344 --agent opencode` con Linear real, un
  `wt-create.sh` sintético y un binario `opencode` sintético en `/tmp`.
- Se confirmó la secuencia completa: consulta de issue, selección de branch/slug,
  extracción de ruta, cwd del worktree y prompt `/startIssue HOS-1344` recibido
  por el agente.
- La prueba no creó worktrees Git ni modificó Linear. La creación real con los
  scripts versionados de Hospeda y sus recursos queda pendiente.

## 2026-09-17 — Gate 11d: start-issue real controlado

- Se ejecutó `hops start-issue HOS-1344 --no-claude` contra Linear real y los
  scripts versionados de `scripts/worktree/`.
- Se creó el worktree real y su branch derivada, se copiaron los archivos de
  entorno disponibles y se compiló el conjunto de paquetes configurado. El
  proceso tardó 3m17s y terminó con exit 0.
- El refresco preventivo de `hospeda_dev`/`hospeda_template` intentó `db:push`,
  no pudo conectar a PostgreSQL y continuó como advertencia no bloqueante; el
  worktree quedó sin DB registrada, tal como exige la ruta fallida segura.
- Se verificó que el worktree no tenía cambios propios y se eliminó con
  `wt-remove.sh --force`, incluyendo la branch temporal. No se modificó el
  issue en Linear.
- Combinado con el E2E sintético del launcher, el flujo `start-issue` queda
  validado; DB/servers reales permanecen como gates separados.

## 2026-09-17 — Gate 12: close-issue read-only

- `hops close-issue --plan --issue HOS-1344` consultó Linear/GitHub sin mutar
  nada y produjo un preflight accionable.
- Detectó correctamente que el worktree de migración está dirty, que no hay
  spec/closeout/tasks, que HOS-1344 sigue en Backlog y que no existe PR.
- El comando terminó exitosamente como plan read-only y no confundió la falta de
  condiciones con un cierre autorizado. El cierre mutante sigue sin implementarse.

## 2026-09-17 — Gate 12b: issue-preflight JSON

- `issue-preflight --json` ignoraba la bandera y siempre emitía texto humano.
- Se agregó un contrato JSON estable con issue/state/labels/url, worktrees,
  referencia a CI/PR, acciones vacías y `readOnly: true`; la salida humana se
  conserva por defecto.
- La consulta real de HOS-1344 devolvió JSON válido con estado Backlog y cero
  worktrees. Typecheck y tests focalizados pasaron (41/41).

## 2026-09-17 — Gate 12c: close-issue JSON

- `close-issue --plan --json` ahora devuelve un contrato estructurado con branch,
  issue, estado Git, specs/closeout/tasks, Linear, smoke, PR, `actions: []` y
  `readOnly: true`.
- La salida humana sigue siendo la predeterminada y el modo JSON no habilita
  ninguna mutación.
- HOS-1344 real validó JSON parseable (dirty=true, Linear Backlog). Typecheck y
  tests focalizados pasaron (41/41).

## 2026-09-17 — Gate 12d: JSON de context, smoke y handoff

- Se ejecutaron `context HOS-1344 --json`, `smoke-plan HOS-1344 --json` y
  `handoff --plan --json` en modo read-only.
- Las tres salidas fueron parseables y contienen contratos diferenciados:
  contexto del worktree, gates de smoke y handoff con cambios/tests/próximo paso.
- No escribieron Linear, Engram, Git ni archivos del proyecto.

## 2026-09-17 — Gate 13: JSON de CI y merge

- `hops ci --json` y `hops merge --json` ahora emiten contratos estructurados
  para consultas inmediatas: branch, PR, verdict, checks o razón de error,
  siempre con `readOnly: true`.
- `--json` no se combina con `--wait`; la espera conserva su contrato textual y
  códigos 3/4 hasta diseñar un estado temporal estructurado.
- En la branch actual ambos comandos devolvieron `no-pr` con exit 1, JSON válido
  y sin mutaciones. Typecheck y tests focalizados pasaron (45/45).

## 2026-09-17 — Gate 13b: suite completa de client-tools

- Se ejecutaron `bun run typecheck` y la suite completa de `scripts/client-tools`.
- Resultado: 289 tests pasaron, 0 fallaron y 684 assertions; duración 2.12s.
- Quedan separados los gates que requieren servicios reales: PostgreSQL para
  aislamiento de DB y servidores de worktree para health checks. La suite no
  sustituye esas validaciones de entorno.

## 2026-09-17 — Gate 13c: plan de verify --changed

- `hops verify --changed --list` leyó el workflow real de CI y mostró los jobs
  lint, guards, typecheck y tests afectados, sin ejecutar comandos ni modificar
  el worktree.
- El plan confirmó que las instalaciones de dependencias son pasos del runner
  de CI y no deben repetirse dentro de este modo local; el agente debe usar
  este comando como preflight antes de lanzar verificaciones manuales.

## 2026-09-17 — Gate 14: disponibilidad del entorno de worktrees

- La inspección read-only confirmó que el cliente Docker está instalado, pero
  no hay daemon Docker disponible; `docker ps` no devolvió un servidor activo.
- `psql` está instalado, pero PostgreSQL en `/var/run/postgresql:5433` no
  responde.
- No se iniciaron contenedores, bases, servidores ni procesos para forzar la
  prueba. El E2E de worktrees queda correctamente pendiente hasta disponer de
  un entorno controlado; los gates sintéticos previos siguen siendo válidos.

## 2026-09-17 — Gate 15: bootstrap reproducible en modo verify

- `scripts/bootstrap/opencode-gentle-bootstrap.sh --verify` confirmó bash, git,
  jq, Bun, Node, OpenCode, Gentle-AI 2.9.0 y Engram 1.20.0, además de las
  rutas esperadas de configuración.
- El bootstrap no leyó valores de secretos ni ejecutó mutaciones.
- OpenCode sigue mostrando el error conocido al intentar abrir su log global en
  el runtime actual (`FileSystem.open ... opencode.log`); el binario está
  presente, pero la validación interactiva continúa pendiente.

## 2026-09-17 — Gate 15b: causa del bloqueo del log global

- La ruta de log existe y pertenece al usuario correcto, con permisos de
  escritura normales.
- La causa es el filesystem raíz montado `ro` (read-only), no una ausencia de
  directorio ni un problema de propietario. Incluso al redirigir
  `XDG_STATE_HOME` a `/tmp`, OpenCode sigue usando la ruta global del log.
- No se cambiaron permisos, mounts ni archivos. La corrección futura debe
  hacerse en el entorno de ejecución (montaje writable o una opción oficial de
  directorio de log), no mediante una modificación arbitraria del proyecto.

## 2026-09-17 — Gate 15c: documentación oficial de logging

- La documentación oficial actual confirma `~/.local/share/opencode/log/` como
  ruta Linux y sólo documenta `--log-level`; no documenta una variable soportada
  para cambiar el directorio de logs.
- Se actualizó `opencode-runtime-log-blocker.md` con la fuente y se descartó
  seguir buscando un workaround no documentado dentro del proyecto.

## 2026-09-17 — Gate 16: inventario runtime global

- Se listaron rutas, tamaños, permisos y claves de configuración de OpenCode,
  Gentle-AI y Engram sin leer valores sensibles.
- Se detectaron seis plugins globales de OpenCode, comandos SDD administrados,
  estado de Gentle-AI, bases SQLite locales y la DB/WAL/SHM de Engram.
- El inventario quedó documentado en `runtime-inventory-2026-09-17.md`.
- No se copió ni modificó ningún estado. La futura instalación limpia deberá
  respaldar y revalidar estos grupos por separado.

## 2026-09-17 — Gate 17: clasificación del backup Stage 0

- Se verificó que el backup externo existe, conserva su manifest y ocupa
  aproximadamente 11 GB.
- Se clasificaron sus grupos en memoria crítica, autenticación, conocimiento,
  historial, integraciones, tooling, instaladores y runtime OpenCode.
- La matriz quedó en `backup-classification.md`; no se borró, restauró ni
  copió ningún archivo.

## 2026-09-17 — Gate 18: Engram activo post-limpieza

- Se repitió la auditoría sobre una copia temporal de la instalación activa,
  separándola del backup Stage 0.
- `integrity_check` devolvió `ok`; `foreign_key_check` conserva 97 anomalías ya
  conocidas.
- La copia tiene 9.754 observaciones, 11.801 sesiones, 65 prompts y 47.461
  mutaciones locales de sync. `tmp`, `hospeda` y `hospeda2` siguen siendo los
  grupos principales; `passive` continúa siendo el tipo dominante.
- No se ejecutó ninguna operación mutante y no se mostraron contenidos de
  memoria. La diferencia con checkpoints previos queda pendiente de comparar
  por IDs/hashes antes de cualquier curación.

## 2026-09-17 — Gate 19: métricas de curación Engram

- En copia temporal se midieron 33 observaciones vacías, 16 sin título, un
  grupo de hash duplicado de 33 filas y 259 grupos de títulos repetidos que
  involucran 1.445 filas.
- `tmp/passive` concentra 5.257 observaciones; también hay decisiones,
  descubrimientos y bugfixes sin proyecto.
- Las métricas sólo crean candidatos para revisión humana. No se eliminaron,
  fusionaron ni reasignaron observaciones.

## 2026-09-17 — Gate 20: cola de revisión Engram

- Se creó `engram-review-batches.md` con lotes A–G, criterios, tamaños,
  riesgos y destinos posibles.
- La cola prioriza ruido estructural, duplicados, `tmp`, entradas sin proyecto y
  luego memoria durable de Hospeda, sin ejecutar ninguna mutación.

## 2026-09-17 — Gate 21: bootstrap reproducible en modo plan

- `scripts/bootstrap/opencode-gentle-bootstrap.sh --plan` enumeró backup,
  verificación de herramientas, instalación fijada, wrappers, TUI/skills,
  checksums y restauración de Engram condicionada a aprobación.
- El plan confirma que login, plugins y decisiones de memoria quedan manuales;
  el modo apply/install permanece deliberadamente no disponible.

## 2026-09-17 — Gate 22: CodeGraph post-instalación limpia

- CodeGraph CLI `1.1.2` sigue disponible globalmente.
- Hay índices locales grandes para Hospeda y Hospeda2; no se abrieron ni se
  regeneraron durante este gate.
- Los hooks `codegraph-nudge.sh` y `codegraph-sync.sh` son integración Claude;
  no se trasladan automáticamente.
- Se mantiene la recomendación: conservar CLI, evaluar MCP opcional después y
  no acoplar indexación al flujo `startIssue`.

## 2026-09-17 — Gate 23: plugins y MCP efectivos declarados

- La configuración actual declara 23 agentes, MCP de Context7 y Engram, y no
  declara MCP de Linear.
- Hay seis archivos TypeScript de plugins globales administrados, pero su
  presencia en disco no demuestra que estén activos.
- La discrepancia anterior que describía Linear como MCP activo quedó corregida
  en `opencode-global-config-assessment.md`.

## 2026-09-17 — Gate 24: TUI declarada y entrada huérfana

- `tui.json` conserva `mouse=false`, `diff_style=auto`, atención con
  notificaciones sin sonido y los cuatro atajos Home/End acordados.
- El plugin local `gentle-logo.tsx` existe; la entrada
  `opencode-subagent-statusline` no corresponde a un archivo resoluble en los
  directorios inspeccionados.
- No se retiró la entrada ni se instaló un reemplazo. La validación visual en
  una TUI real queda pendiente por el bloqueo del filesystem global.

## 2026-09-17 — Gate 25: revalidación de complementos prioritarios

- Se revisaron los README/repositorios actuales de OpenKilo, OpenChamber,
  opencode-pty y smart-voice-notify.
- OpenKilo y OpenChamber quedan como pruebas aisladas; opencode-pty no entra al
  núcleo por solapamiento con `hops` y asimetrías de permisos; smart-voice queda
  para un piloto posterior.
- La matriz actualizada está en `plugin-gate-focused.md`. No se instaló ningún
  complemento.

## 2026-09-17 — Gate 26: worktrees, background y handoff comunitarios

- `opencode-worktree` y `opencode-background-agents` están archivados y son
  explícitamente V1-only; no se consideran compatibles con OpenCode V2.
- `opencode-background` también está archivado y duplica el lifecycle de
  servidores de `hops`.
- `opencode-handoff` es útil como referencia, pero resulta redundante frente a
  `hops handoff`, que ya integra hechos, Linear, worktrees y marcadores visibles.
- La matriz actualizada está en `plugin-gate-focused.md`; no se instaló ningún
  complemento.

## 2026-09-17 — Gate 27: contexto, tokens y cuotas

- Se revisaron Dynamic Context Pruning, TokenScope, mystatus y opencode-costs.
- TokenScope queda como primer candidato para una prueba aislada de auditoría;
  DCP requiere compararse con compaction nativa y no debe combinarse con otro
  pruning; mystatus sólo si necesitamos cuotas; costs queda fuera inicialmente.
- La matriz está en `plugin-gate-focused.md`. No se instaló ningún plugin.

## 2026-09-17 — Gate 28: planificación, review y shell UX

- Plannotator queda como prueba opcional para planes complejos; su soporte V2
  es experimental y tiene actividad de red de actualización.
- CodeNomad no se combina con OpenChamber: ambos son cockpits externos con
  sesiones/worktrees y superficie de acceso remoto.
- `opencode-shell-strategy` aporta reglas útiles para un skill local revisado,
  pero no se cargará como instrucción remota sin auditarla.
- Matriz actualizada en `plugin-gate-focused.md`; no se instaló ningún plugin.

## 2026-09-17 — Gate 29: seguridad y observabilidad de complementos

- `cc-safety-net`: guard pre-ejecución compatible con OpenCode, con rulebooks y API embebible. Bloquea comandos destructivos y secretos, pero no sustituye permisos del sistema, sandbox o control de red, y documenta una brecha para texto enviado mediante `write_stdin`. Queda como prueba aislada.
- `opencode-ignore`: plugin `.ignore` que bloquea read/write/edit/list y filtra glob/grep. Puede complementar una política por proyecto, pero no cubre shell ni seguridad del host y debe probarse junto a permisos nativos y `.gitignore`.
- `opencode-sentry-monitor`: telemetría remota de sesiones, herramientas y tokens. Queda fuera del MVP por privacidad y dependencia de red; si se evalúa, será opt-in con inputs/outputs desactivados.
- `mcp-system-monitor-js`: MCP/HTTP con datos de CPU, memoria, disco, red, procesos y hardware. Queda fuera del núcleo por superficie amplia y porque el modo HTTP puede ser público sin API key.

Decisión: conservar como base permisos nativos de OpenCode, guards de Hospeda y `hops`; no instalar estos complementos durante la instalación limpia. Fuentes y matriz detallada: `docs/migration/plugin-gate-focused.md`.

## 2026-09-17 — Gate 31: utilidades menores y coordinación

Se revisaron formatter de tablas, Froggy, Open Trees, browser, peers, tell-sessions y smart-voice. Formatter y Froggy quedan redundantes; Open Trees no se combina con `hops`; browser queda como prueba aislada para QA visual; peers/tell-sessions no se incorporan por coordinación no necesaria; voz queda como piloto posterior con TTS local preferido. No se instaló ningún complemento.

## 2026-09-17 — Gate 32: orquestación visual y gateways externos

Se revalidaron Octto, OpenWork y opencode-browser. Octto queda como prueba opcional para exploración visual, sin desplazar artifacts ni SDD; OpenWork queda fuera por gateway remoto, OAuth y control plane; browser queda limitado a QA visual aislado. No se instaló ningún complemento.

## 2026-09-17 — Gate 33: paquete de aprobación Engram

Se preparó `docs/migration/engram-human-approval-packet.md` con el checkpoint actual, lotes de revisión, clasificación permitida, reglas de evidencia y procedimiento reversible. No se expusieron contenidos de memoria y no se modificó la DB activa.

## 2026-09-17 — Gate 34: restore read-only de Engram

Se copió temporalmente todo `~/.engram` (DB, WAL, SHM y metadatos). La copia pasó `PRAGMA integrity_check = ok` y conservó journal WAL; se calcularon checksums de DB/WAL/SHM. `engram doctor --json` quedó bloqueado por su consulta de actualización a GitHub cuando la red no resolvía, por lo que no se usó como criterio de integridad. La copia fue eliminada al terminar y la DB activa no fue modificada.

## 2026-09-17 — Gate 35: política de permisos y bloqueo de runtime

La matriz allow/ask/deny y los guards pre-commit quedaron consolidados como especificación. La consulta de ayuda de `opencode auth` no llegó a ejecutarse porque OpenCode intenta abrir `~/.local/share/opencode/log/opencode.log` y el filesystem global está montado read-only (`EROFS`). Gentle-AI 2.9.0 respondió normalmente y no se ejecutó ningún comando mutante.

## 2026-09-18 — Gate 36: causa del filesystem read-only

Se confirmó que el `ro` pertenece al sandbox administrado de Codex (`codex-linux-sandbox`), no a un problema de permisos o corrupción de Ubuntu. Dentro del sandbox OpenCode falla al abrir su log; fuera del sandbox `opencode auth --help` funciona y `opencode auth list` devuelve `No authenticated integrations` sin mostrar credenciales. No se ejecutó ningún remount, fsck ni cambio de sistema.

## 2026-09-18 — Gate 37: flujo correcto de autenticación OpenCode

OpenCode 2.0.3 tiene el subcomando `auth login`, pero sin una integración registrada devuelve `No authentication integrations are available`. La documentación oficial actual indica usar `/connect` en la TUI para descubrir OpenAI y elegir ChatGPT Plus/Pro OAuth o API key; `/models` se usa después para seleccionar modelos. No se inició ningún login ni se tocaron credenciales.

## 2026-09-18 — Gate 38: corrección de plugins V1 incompatibles

Se respaldaron y movieron seis plugins V1 instalados por Gentle-AI a `plugins-v1-disabled`; se quitó la entrada huérfana `opencode-subagent-statusline` de `cli.json` y se reinició el servicio. Engram MCP volvió a conectar con 18 tools y Context7 con 2; no aparecen nuevos fallos de carga ni de statusline. La corrección es reversible y quedó detallada en `opencode-v2-plugin-fix.md`.

## 2026-09-17 — Gate 30: sesiones, contexto de tipos, entorno y visión

Se revisaron OpenCode Senses, type-inject, opencode-direnv, OpenSession, Portal y opencode-handoff. Senses y type-inject quedan como experimentos medibles; direnv queda fuera inicialmente por ejecutar `.envrc`; OpenSession y Portal quedan fuera por duplicar UI/sesiones/workspaces; handoff es redundante frente a `hops handoff`. No se instaló ningún complemento.

## Gate 39 · Rollback operativo a OpenCode V1 por compatibilidad Gentle-AI

Fecha: 2026-09-18.

Decisión: usar OpenCode V1 como runtime diario hasta que Gentle-AI publique plugins V2 funcionales. Se eligió la última release V1 verificada disponible, OpenCode 1.18.31, en lugar de restaurar una versión histórica no verificable.

Acciones reversibles realizadas:

- Se descargó y verificó el binario oficial `opencode-linux-x64.tar.gz` de OpenCode `v1.18.31`.
- Se preservó el binario/configuración V2 en `~/.local/state/hospeda-opencode-migration/backups/opencode-pre-v1-switch-2026-09-18-*`.
- Se preservó la DB de sesiones V2 completa, incluyendo su estado SQLite, sin modificarla.
- Se activó el binario V1 mediante un enlace reversible.
- Se restauraron los seis plugins Gentle V1 aislados.
- Se eliminó de `tui.json` la entrada `opencode-subagent-statusline`, que no estaba instalada y generaba reconciliación bloqueada.
- Se dejó que V1 cree su propia DB de sesiones compatible.

Verificaciones:

- `opencode --version` devuelve `1.18.31`.
- `opencode models` funciona y enumera modelos disponibles.
- La TUI V1 inicia en pseudo-terminal y crea sesión.
- `model-variants.ts` genera `~/.gentle-ai/cache/model-variants.json`.
- Engram MCP conecta con 18 herramientas.
- No se modificó la DB de Engram.
- No se modificó Hospeda ni Linear.

Pendientes antes de uso diario:

- Login interactivo de provider desde la TUI V1.
- Prueba funcional de Engram plugin V1 con una sesión real.
- Prueba de review transport y SDD task artifacts.
- Resolver warnings de skills duplicadas sin eliminar todavía archivos que puedan seguir siendo usados por Claude.
- Definir política de actualización fijada para no saltar accidentalmente a V2.

Alineación adicional:

- El launcher `~/.gentle-ai/bin/opencode` también quedó apuntando al binario V1.18.31 para evitar un bypass accidental hacia el paquete V2.
- El launcher original V2 quedó respaldado junto al resto del rollback.
- La TUI muestra warnings de skills duplicadas entre `.claude/skills`, `.agents/skills` y `.config/opencode/skills`; no se eliminaron archivos porque Claude y otros agentes todavía podrían utilizarlos.

## Gate 40 · Pins V1 y validación de Gentle

- `gentle-ai review status` terminó read-only con autoridad limpia.
- `gentle-ai sdd-status` terminó read-only y detectó dos cambios OpenSpec ambiguos en el repositorio Hospeda; no se seleccionó ni modificó ninguno.
- El bootstrap read-only ahora declara y verifica el canal `v1-gentle-compatible`:
  - OpenCode `1.18.31`.
  - Gentle-AI `2.9.0`.
  - Engram `1.20.0`.
- `scripts/bootstrap/opencode-gentle-bootstrap.sh --verify` devuelve los tres pins en estado `ok` y `mutations=none`.
- El flujo `--apply/install` continúa deliberadamente sin implementar.

## Gate 41 · Integridad de bases de sesiones

Se verificaron en modo SQLite read-only la DB V2 preservada y la DB V1 operativa. Ambas devuelven `PRAGMA integrity_check = ok`; la DB V2 conserva 20 tablas y la DB V1 también. No se abrió ninguna de las dos en modo escritura durante esta comprobación.

## Gate 42 · Auditoría de skills duplicadas

OpenCode V1 carga 87 skills y emite warnings por nombres repetidos entre `.claude/skills`, `.agents/skills` y `.config/opencode/skills`. Se compararon hashes: la mayoría de las copias Gentle entre `.agents` y `.config/opencode` son idénticas; varias copias Claude divergen y deben preservarse. Se documentó la fuente canónica propuesta en `skill-duplicate-audit-v1.md`. No se eliminó ni movió ningún skill.

## Gate 43 · Cuarentena de duplicados OpenCode

Se movieron 25 `SKILL.md` byte a byte idénticos desde `~/.config/opencode/skills` a una cuarentena reversible con manifest y SHA-256. Se conservaron `_shared`, `strict-tdd.md` y `strict-tdd-verify.md` porque no tienen un duplicado equivalente en `.agents`. No se tocó `~/.claude/skills`.

La TUI V1 fue iniciada nuevamente: no hubo `failed to load plugin` ni `plugin operation stalled`; el cache de model variants sigue presente. Persisten 15 warnings intencionales entre Claude y Gentle, necesarios mientras se preserve compatibilidad con ambos agentes.

## Gate 44 · Smoke operativo V1 final

- No quedan referencias activas a `opencode-subagent-statusline` en la configuración runtime.
- `opencode mcp list` devuelve Context7 y Engram conectados.
- La TUI V1 inicia una sesión nueva en `1.18.31` sin `failed to load plugin` ni `plugin operation stalled`.
- La DB V1 mantiene integridad y el cache de variantes contiene 343796 bytes.
- No se ejecutaron herramientas de escritura de Engram ni operaciones sobre Hospeda/Linear.

## Gate 45 · Inventario operativo V1

- OpenCode V1 conserva el agente primario `gentle-orchestrator` y los agentes SDD/review administrados por Gentle.
- Las commands globales SDD (`sdd-*`), `skill-registry` y skills RDD/SDD siguen presentes.
- `opencode providers list` funciona sin revelar credenciales; actualmente hay 0 credenciales persistidas y una variable de entorno detectada para GitHub Copilot.
- Context7 y Engram continúan conectados por MCP.
- El login de OpenAI y la prueba de ejecución con provider siguen pendientes porque requieren interacción del usuario.

## Gate 46 · Corrección de TUI V1: mouse y Home/End

La configuración anterior tenía dos conflictos:

- `mouse=false` en V1 hace que la rueda se interprete como navegación del historial del prompt en lugar de scroll del viewport (comportamiento conocido del runtime).
- `Home`/`End` estaban asignadas simultáneamente al viewport (`messages_first/messages_last`) y al editor.

Corrección aplicada con backup:

- `mouse=true` para recuperar scroll de viewport con rueda.
- `input_line_home=ctrl+a` y `input_line_end=ctrl+e`.
- `input_buffer_home=home,ctrl+home` y `input_buffer_end=end,ctrl+end`.
- `messages_first=ctrl+g` y `messages_last=ctrl+alt+g`.

OpenCode V1 cargó el archivo nuevo y creó sesión sin errores de plugins. Falta validación manual del gesto exacto de rueda/Home dentro de una sesión interactiva.

## Gate 47 · Semántica final Home/End

Se ajustaron los bindings solicitados:

- `Home` → principio de la línea actual.
- `Ctrl+Home` → principio del prompt multilinea.
- `End` → final de la línea actual.
- `Ctrl+End` → final del prompt multilinea.

OpenCode V1 cargó la configuración en una TUI nueva sin errores. Se conservó backup en `tui-v1-before-line-buffer-rebind-2026-09-18.json`.

## Gate 48 · Provider OpenAI y auditoría post-login

- OpenAI OAuth quedó autenticado; `opencode providers list` muestra una credencial sin exponer su contenido.
- V1 enumera modelos OpenAI disponibles, incluidos GPT-5.x/GPT-6.
- Context7 y Engram MCP siguen conectados.
- La auditoría SQLite read-only de Engram detectó que el contador de observaciones pasó de 9754 a 9774 durante las pruebas autenticadas. La captura automática proviene del plugin Engram V1; no se leyó contenido, no se guardaron observaciones manuales y no se ejecutó limpieza.
- Esas 20 observaciones nuevas deben entrar en la revisión humana antes de considerarse memoria válida.

## Gate 49 · Atribución de observaciones Engram recientes

La hipótesis del agente Claude paralelo quedó respaldada por metadatos read-only:

- Las 14 observaciones pasivas recientes están asociadas a sesiones con IDs del workflow Claude y `tool_name=engram-autosave-SessionEnd`.
- Las sesiones OpenCode recientes usan IDs `ses_*` y produjeron observaciones `architecture`/`session_summary`, no esa captura pasiva.
- Engram es una DB compartida entre ambos runtimes; la actividad de Claude puede aumentar los contadores mientras OpenCode está abierto.

No se leyó contenido, no se alteró Engram y no se modificó la política de captura.

## Gate 50 · Estado de Gentle RDD, telemetría y background

- RDD/review está `off` por defecto; no se modificó.
- Telemetría Gentle está habilitada por default. `telemetry preview --json` muestra sólo metadatos de instalación, versión, OS/arquitectura, agentes, componentes y estado RDD; no se expusieron valores.
- No se ejecutó `telemetry trigger`, `enable` ni `disable`.
- Gentle registra `opencode_background_subagents=on` y `pi_background_subagents=off`. No se activó ningún subagente background durante esta comprobación.
- La decisión de mantener o desactivar telemetría queda pendiente de política de privacidad; no bloquea el runtime V1.

## Gate 51 · Reconciliación y Hops/closeIssue

- Se reconciliaron en el artifact los estados ya verificados: OpenAI OAuth,
  modelos, Engram MCP, `verify`, CI y `closeIssue`.
- La suite de `scripts/client-tools` pasó con **289 tests, 0 fallos y 684
  aserciones**; `bun run typecheck` también pasó.
- La validación de comandos standalone y del registry confirmó que cada comando
  registrado tiene binario y `--help`; `verify --list` leyó el workflow real de
  CI y enumeró lint, guards y typecheck.
- `hops close-issue --plan` ahora deriva acciones propuestas a partir de Git,
  specs/closeout, Linear, smoke labels y PR/CI. Continúa siendo estrictamente
  read-only.
- `/hops-close-issue` consume el script y no duplica lógica ni ejecuta
  mutaciones.
- El nuevo bundle del artifact se validó localmente y quedó listo para publicar.
- `close-issue --plan --issue HOS-1344 --json` fue probado en modo read-only:
  devolvió las acciones propuestas y exit code `1` porque Linear y GitHub no
  eran accesibles desde este entorno; no confundió una consulta incompleta con
  un cierre válido.
- El snapshot reconciliado quedó publicado como versión **61** en el servidor
  local de artifacts; el servidor temporal se detuvo al terminar la publicación.
- Se agregó cobertura de superficie para `close-issue`: la suite quedó en **292
  tests, 0 fallos y 687 aserciones**; `bun run typecheck` sigue pasando.

## Gate 52 · Validación read-only con servicios reales

- `hops issue-preflight HOS-1344 --json` consultó Linear correctamente y no
  encontró worktrees asociados.
- `hops start-issue HOS-1344 --agent opencode --dry-run` derivó la branch
  `fix/hos-1344-el-mapa-de-mensajes-http-solo-cubre-0` sin crear worktree ni
  cambiar Linear.
- `hops ci --wt hospeda-hos-1244-medio-de-pago-403 --json` leyó el PR real
  #3352, todos sus checks y el estado merged, sin mutar GitHub.
- `hops close-issue --wt hospeda-hos-1244-medio-de-pago-403 --plan --issue
  HOS-1244 --json` leyó Linear, Git, spec/closeout y PR/CI reales; devolvió
  acciones propuestas y no ejecutó ninguna mutación.
- Docker responde con servidor `29.6.1`; todavía no se levantaron contenedores,
  no se crearon worktrees y no se tocaron bases.
- GitHub detectó una variable `GITHUB_TOKEN` inválida en el entorno, aunque la
  consulta de `hops ci` funcionó usando la autenticación almacenada de `gh`.
  No se mostró ningún valor secreto.

## Gate 53 · Entorno de worktree

- En HOS-635, la copia inicial no encontró archivos locales porque el checkout
  de migración no contiene secretos ignorados; `hops env` falló sólo por
  archivos ausentes.
- `copy-env-to-worktree.sh` ahora acepta `HOPS_ENV_SOURCE_ROOT`, valida que la
  fuente sea un checkout confiable y reporta únicamente nombres, contadores y
  rutas, nunca contenidos.
- Se seleccionó `/home/qazuor/projects/WEBS/hospeda2` como fuente explícita
  sólo para esta prueba y se copiaron cinco archivos locales; los archivos de
  test ya existentes no fueron sobrescritos.
- La regla API/Web detectó valores distintos para
  `HOSPEDA_REVALIDATION_SECRET`; se sincronizó esa única variable en el
  worktree tomando API como fuente, sin modificar `hospeda2`.
- `hops env` pasó los seis checks: env doctor, env local, env rules, env usage,
  registry y examples. Quedó sólo una condición opcional informativa para
  `HOSPEDA_INTERNAL_REQUEST_SECRET` ausente en ambos lados.
- `wt-create.sh` ahora ejecuta automáticamente `wt-env-prepare.sh` cuando la
  herramienta existe, para que los nuevos worktrees puedan validar defaults
  desde `.env.example` aun sin secretos locales.
- Una repetición dentro del sandbox falló antes de ejecutar los checks por
  `EPERM` en los pipes de `tsx` y `EROFS` al escribir caches temporales de
  Vitest. La misma ejecución con filesystem escribible pasó los seis checks;
  queda confirmado que el fallo anterior era ambiental, no de variables.

## Gate 54 · Fuente fija de entorno y frescura de staging

- Se confirmó que `hospeda-staging` es el checkout que `hops` usa por defecto
  para tooling. Estaba 1.589 commits detrás de `origin/staging`.
- Se actualizó `hospeda-staging` con `fetch` y fast-forward hasta
  `origin/staging`. El checkout quedó limpio en el commit vigente.
- Se reconciliaron sus archivos locales ignorados usando los valores actuales
  de `hospeda2` como entrada única de esta migración. Las claves se filtraron
  contra los templates actuales: no quedaron claves obsoletas y todas las
  claves documentadas quedaron presentes, con opcionales no configuradas como
  comentarios.
- La variable cruzada `HOSPEDA_REVALIDATION_SECRET` quedó igual en API y Web,
  tomando API como fuente. No se imprimieron valores.
- `pnpm env:doctor`, `env:check:local`, `env:check:rules`, `env:check:usage`,
  `env:check:registry` y `env:check:examples` pasaron. Sólo queda la condición
  parcial no bloqueante de `HOSPEDA_INTERNAL_REQUEST_SECRET` ausente en ambos
  lados.
- La política documentada queda en
  `docs/migration/env-source-of-truth.md`: `hospeda-staging` es la fuente
  operativa fija; `hops update` mantiene el checkout sincronizado sin traer
  secretos desde GitHub; los nuevos worktrees heredan el entorno desde esa
  fuente y pueden usar `HOPS_ENV_SOURCE_ROOT` como override explícito.
- Pendiente: hacer que el resolver de `copy-env-to-worktree.sh` elija staging
  automáticamente y agregar preflight de frescura a los workflows principales.

## Gate 55 · Automatización de drift y fuente predeterminada

- `copy-env-to-worktree.sh` ahora resuelve automáticamente el checkout
  hermano `hospeda-staging` a partir del worktree principal. Se conserva
  `HOPS_ENV_SOURCE_ROOT` como override explícito para recuperación o bootstrap.
- Se agregó `scripts/reconcile-local-env.sh`: conserva valores vigentes,
  incorpora claves nuevas desde los templates, mantiene opcionales sin valor
  como comentarios y elimina claves obsoletas. Nunca imprime valores.
- `hops update` ejecutará esa reconciliación después del reset de staging
  cuando el script esté disponible; también la ejecuta aunque el checkout ya
  estuviera al día. Durante la transición muestra un aviso si el checkout
  remoto todavía no contiene el script.
- `hops env --drift` y `hops env --drift --json` ya devuelven, por archivo,
  `missing`, `obsolete` y `needsValue`, además de `mismatched` y
  `absentCrossChecks`, sin devolver secretos.
- Las commands OpenCode de `hops-env`, `hops-start-issue` y
  `hops-close-issue`, junto con `AGENTS.md`, instruyen al agente a consultar el
  drift antes de iniciar o cerrar trabajo y a pedir intervención humana para
  valores secretos.
- Verificación: typecheck y suite completa de client-tools pasan: 294 tests,
  0 fallos y 693 aserciones. El drift real de `hospeda-staging` está limpio;
  sólo informa `HOSPEDA_INTERNAL_REQUEST_SECRET` ausente en ambos lados.

## Gate 56 · Runtime HOS-635: bloqueo detectado en DB compartida

- El drift inicial de HOS-635 detectó archivos locales antiguos; el
  reconciliador los dejó limpios antes de intentar levantar servicios.
- `hops db-start` intentó crear un stack por worktree y chocó con Redis ya
  ocupado en `6381`. PostgreSQL propio de la prueba llegó a iniciar, pero no
  se pudo crear el Redis duplicado.
- El diagnóstico mostró la causa: `docker/.env` no tenía un
  `COMPOSE_PROJECT_NAME` estable y Compose derivaba el nombre del directorio.
  Eso contradice la documentación de DB compartida.
- Se agregó `COMPOSE_PROJECT_NAME=hospeda` al template versionado de Docker y
  se dejó el valor en el archivo local de staging. La corrección todavía debe
  llegar al checkout activo de `client-tools` antes de repetir `db-start`.
- Se eliminaron únicamente los dos contenedores creados por la prueba fallida
  de HOS-635; no se eliminaron volúmenes ni se tocaron contenedores de otros
  worktrees.
- El gate de DB, servidores y health checks queda pendiente hasta validar el
  stack compartido con el contenedor canónico `hospeda-postgres` y el Redis
  existente.

## Gate 57 · Seguridad del auto-heal de esquema

- La reparación del stack compartido funcionó: `hospeda-postgres` fue recreado
  con el compose vigente, conservando su volumen, y Postgres/Redis quedaron
  saludables.
- Al repetir `servers-up` en HOS-635, Drizzle encontró una diferencia con
  potencial pérdida de datos (`billing_customers.mp_payer_email`) y rechazó la
  confirmación al ejecutarse sin TTY. El flujo continuó aplicando extras de
  todos modos; eso es inseguro y podía dejar el esquema parcialmente
  reconciliado.
- El extra 041 falló después porque el clon antiguo todavía no tenía
  `billing_addon_purchases.mp_subscription_id`. La columna sí está declarada
  en el schema/migraciones actuales; no corresponde saltar ni modificar ese
  extra para ocultar el problema.
- Se endureció `scripts/worktree/wt-db.sh` en el worktree de migración: el
  auto-heal dejó de usar `db:push` y ahora usa el journal de `db:migrate`, que
  aplica sólo migraciones versionadas; si falla, aborta antes de
  `db:apply-extras`. Esto evita que una comparación contra el schema TypeScript
  intente borrar columnas pertenecientes al carril de extras.
- La segunda prueba mostró que `hospeda_template`, `hospeda_dev` y el clon
  HOS-635 no tienen `drizzle.__drizzle_migrations`: son bases históricas
  creadas con `db:push`. El script ahora detecta `missing/empty` y se detiene
  antes de intentar reproducir el baseline sobre tablas existentes.
- Gate pendiente: reconstruir de forma controlada el template desde una base
  vacía usando migraciones versionadas, extras y seed; luego repetir el E2E.
  No se forzó `--yes`, no se estampó el journal, no se borró la base compartida
  y no se tocaron datos de producción.

## Gate 58 · Cadena limpia de migraciones validada

- Se creó una base PostgreSQL descartable, separada de `hospeda_template`,
  `hospeda_dev` y HOS-635.
- `pnpm --filter @repo/db db:migrate` aplicó las 125 migraciones y creó el
  journal `drizzle.__drizzle_migrations`; la columna
  `billing_addon_purchases.mp_subscription_id` quedó presente.
- `pnpm db:apply-extras` aplicó los 42 extras, incluido
  `041-hos847-addon-purchases-mp-id-unique.index.sql`, sin errores.
- La base descartable fue eliminada al finalizar la prueba.
- Conclusión: la cadena versionada es válida; el único bloqueo es reconstruir
  el template histórico que fue creado con `db:push` y no conserva journal.

## Gate 59 · Worktree E2E con template candidato

- Se dejó persistido el candidato local `hospeda_template_candidate_20260919`
  con migraciones, extras y seed de ejemplo completos. No reemplaza todavía a
  `hospeda_template`.
- La DB descartable de HOS-635 se recreó desde ese candidato y
  `servers-up` completó la cadena: env prepare, DB ready, build de paquetes y
  arranque de API/Admin/Web.
- Verificación HTTP: API `/health`, Admin `/` y Web `/` respondieron 200 en
  los puertos asignados 3101, 3100 y 4421. `hops context --json` informó los
  tres servidores y la DB correctos.
- `servers-down` detuvo los tres servicios; se eliminó además el proceso API
  huérfano que no quedó dentro del grupo esperado. No quedan servidores de
  HOS-635 ejecutándose; la DB y el candidato se conservaron para la siguiente
  revisión.
- El seed de usuarios creó 46 usuarios locales; tres usuarios de planes
  `complex-*` no pudieron asociarse porque esos planes no existen en la
  configuración actual. Es un hallazgo del seed, no un fallo de migración ni
  de health checks.

## Gate 60 · Template versionado y promoción con rollback

- Se agregó `scripts/worktree/template.sh` para consultar estado, escribir
  manifest y construir candidatos desde una base vacía. El manifest vive en
  `hospeda_tooling.template_manifest` dentro de la base y contiene fingerprint,
  commit fuente, journal y fecha; ya no depende sólo de estado en `~/.claude`.
- Se agregó `templateFingerprintPaths` para incluir schemas, migraciones,
  extras, seeds y configuración de billing en la frescura del template.
- `wt-create.sh` ahora adquiere un lock y bloquea clones si el template no
  tiene journal/manifest o si su fingerprint no coincide con el ref base.
- Se promovió `hospeda_template_candidate_20260919` después de validar 125
  migraciones, 42 extras, seed y worktree E2E. El template histórico quedó
  conservado como `hospeda_template_backup_20260919t043358z` para rollback.
- El nuevo template activo coincide con el fingerprint de `origin/staging`.
- Se documentó el ciclo en `docs/migration/template-lifecycle.md`. La
  promoción rechaza conexiones activas y no elimina backups automáticamente.

## Gate 61 · Hops expone el lifecycle seguro del template

- `hops db-update-template` dejó de ejecutar el flujo histórico que podía
  borrar y reconstruir `hospeda_template` directamente.
- La interfaz ahora delega en el script versionado único:
  `status`, `build-candidate <nombre>` y `promote <candidata> --confirm`.
- Una promoción sin `--confirm` termina antes de tocar la base; los nombres de
  DB/candidata se validan contra un conjunto seguro de caracteres.
- TypeScript del paquete `scripts/client-tools` y las pruebas focalizadas de
  registry/binarios pasaron: 20 tests, 0 fallos.
- El item correspondiente del artifact fue marcado como hecho. Queda pendiente
  integrar este bloque en `hospeda-staging` y repetir el E2E usando los wrappers
  globales.

## Gate 62 · Primer bloque operativo integrado en hospeda-staging

- El commit `5d848e885` fue aplicado limpiamente sobre el checkout operativo
  como `3c7bbac64`.
- Se integraron Hops extendido, scripts versionados de worktree, reconciliación
  de envs, guards, configuración de fingerprint y wrappers de cierre/contexto.
- La suite de client-tools ejecutada desde `hospeda-staging` terminó con 411
  tests y 0 fallos; el typecheck también pasó.
- La prueba de CI se aisló en un repositorio temporal con branch de feature:
  la protección real de `staging`/`main` no se relajó para satisfacer fixtures.
- `hospeda-staging` quedó limpio después de la integración.
- Pendiente: probar los wrappers globales y el E2E real de `wt-create` desde el
  checkout operativo, incluyendo template, envs, DB, puertos, servers y cleanup.

## Gate 63 · Wrappers globales restaurados al checkout operativo

- Los wrappers Fish `hops*` dejaron de apuntar al worktree de migración y vuelven
  a resolver `/home/qazuor/projects/WEBS/hospeda-staging`.
- Desde una shell Fish se validó `hops context --json`: branch `staging`, repo
  limpio y status estructurado correcto.
- Desde la misma shell se validó `hops env --drift --json`: las cuatro fuentes
  locales están limpias; sólo queda reportada la variable opcional ausente
  `HOSPEDA_INTERNAL_REQUEST_SECRET`, sin mostrar valores.
- Se ajustó el resumen de `start-issue` para indicar que el agente es opcional.
- Pendiente: E2E real de creación de worktree desde el wrapper global.

## Gate 64 · E2E operativo completo desde wrappers globales

- Se creó el worktree temporal `test/migration-e2e-20260919` desde el branch local
  `staging` del checkout operativo, no desde un `origin/staging` atrasado.
- `wt-create.sh` reutilizó el template activo y verificó que el esquema estuviera
  vigente. Copió los cinco archivos `.env.local` desde
  `/home/qazuor/projects/WEBS/hospeda-staging`; no quedaron variables faltantes ni
  variables nuevas pendientes de merge.
- `servers-up` creó/verificó la DB descartable, confirmó migraciones y usuarios,
  asignó los puertos 3101 (API), 3100 (Admin) y 4421 (Web), ejecutó el build de
  paquetes y pasó los tres health checks configurados.
- API `/health` respondió JSON `status: ok`; Admin respondió el cliente Vite y Web
  respondió el servidor Astro. Las rutas raíz de Admin/Web no se usan como health
  checks porque su comportamiento depende de redirecciones/render de la aplicación;
  la disponibilidad TCP quedó verificada por `wt-up`.
- `hops context --json` informó issue sintético, branch, DB y los tres servidores.
  `hops env --drift --json` quedó limpio, con sólo el secreto opcional ausente ya
  conocido y sin mostrar valores.
- `servers-down` detuvo API, Admin y Web; `wt-remove --force` eliminó únicamente el
  worktree, branch y DB temporales. No quedan procesos ni puertos de esa prueba.
- Una ejecución anterior quedó invalidada por procesos residuales que ocupaban los
  puertos; se limpiaron exclusivamente procesos del worktree temporal y se repitió
  la prueba desde cero antes de considerar este gate exitoso.

## Gate 65 · Límite de validación de `hops update`

- Se ejecutó `hops update --dry-run` desde el wrapper global apuntando a
  `hospeda-staging`.
- El comando llegó al checkout operativo, pero Git no pudo escribir `FETCH_HEAD`
  porque el `.git` compartido de la sesión está montado read-only. No alcanzó a
  ejecutar reset, reconciliación ni instalación y no se modificó código.
- El comportamiento queda documentado como pendiente de una sesión con filesystem
  escribible o de un checkout Git independiente. No se ejecutará contra el
  `staging` local adelantado hasta contar con esa condición, para no arriesgar sus
  commits no publicados.

## Gate 66 · Wrapper Hops para Engram

- Se agregó `hops engram` y el alias `hops-engram` al client-tools versionado.
- El wrapper delega al binario oficial, ofrece ayuda con `tui`, `doctor`,
  `projects`, `stats`, `search`, `context` y `conflicts`, y exige `--confirm`
  para operaciones que pueden escribir memoria o configuración.
- No añade flags destructivos (`--hard`, `--apply`, `--all`) ni copia la DB al
  repositorio. La autoridad sigue siendo la instalación local de Engram.
- Se validó typecheck, suite completa de client-tools (412 tests, 0 fallos),
  ayuda global y rechazo de una mutación sin confirmación. El doctor real no se
  ejecutó contra la DB porque el filesystem de la sesión la expone read-only.
- El commit `58e0eed06` quedó integrado en `hospeda-staging` y las funciones Fish
  globales fueron regeneradas apuntando al checkout operativo.

## Gate 67 · `hops update --dry-run` realmente read-only

- Se corrigió `scripts/client-tools/src/commands/update/update.ts`: en modo
  `--dry-run` usa `git fetch --dry-run` y obtiene el SHA remoto con
  `git ls-remote`, sin actualizar refs ni escribir `FETCH_HEAD`.
- Typecheck y suite del worktree de migración pasaron: 294 tests, 0 fallos.
- El cambio quedó integrado en `hospeda-staging` como `8bfeafb53`.
- La prueba global posterior ya no falló por filesystem read-only; alcanzó la
  consulta remota y fue bloqueada únicamente por DNS/red restringida para
  `github.com`. No se ejecutó reset, reconciliación ni instalación.
- Pendiente: repetir con conectividad GitHub para validar el resultado completo
  de `--dry-run` y luego una prueba aislada de la reconciliación real.

## Gate 68 · `hops update` completo en checkout aislado

- Se creó un clon temporal con remoto local para no tocar `hospeda-staging`.
- La primera ejecución creó el checkout hermano de staging, ejecutó fetch,
  reconciliación de envs y dejó el checkout al día.
- Para probar el camino de actualización se añadió un commit sintético sólo en
  ese checkout temporal. `hops update` lo detectó, hizo reset a `origin/staging`,
  reconcilió los envs, reinstaló dependencias cuando cambió el lockfile y
  regeneró todos los wrappers Fish.
- Se verificó que el commit sintético desapareciera y que no quedaran cambios ni
  procesos. Los clones temporales fueron eliminados.
- Se regeneraron nuevamente los wrappers desde `hospeda-staging`; vuelven a
  apuntar al checkout operativo permanente.

## Gate 69 · Bootstrap read-only endurecido

- `scripts/bootstrap/opencode-gentle-bootstrap.sh` quedó versionado y disponible
  en `hospeda-staging` (`20c4c1034`).
- La interfaz acepta `--plan`, `--dry-run`, `--verify` y `--backup-dir PATH`.
  `--restore PATH` termina con error explícito porque la etapa de aplicación y
  restauración todavía no está implementada.
- El script mantiene la política segura: no instala, no elimina, no copia
  secretos, no restaura Engram, no cambia Git/Linear y no imprime valores.
- Se validaron `bash -n`, plan con backup-dir, rechazo de restore y verify de
  herramientas/pines actuales.
- El item de bootstrap sigue pendiente hasta implementar y probar la etapa de
  aplicación idempotente en un entorno descartable.

## Gate 70 · Separación del bootstrap genérico y adaptadores de proyecto

- El nombre dejó de ser específico de OpenCode/Gentle-AI: el script base ahora se
  llama `scripts/bootstrap/ai-dev-workstation-bootstrap.sh`.
- La arquitectura acordada separa un instalador genérico de workstation (runtimes,
  agentes CLI, Engram, configuración global, skills, permisos, guardrails,
  backups y manifests) de adaptadores por proyecto.
- Hospeda tendrá un adaptador propio para checkout operativo, Hops, envs,
  PostgreSQL/Redis, template DB, skills locales y verificaciones del monorepo.
- El descubrimiento se basará en un registro local de proyectos y/o un manifiesto
  versionado dentro del repositorio. La detección sólo propone o verifica; no
  aplica cambios específicos sin selección explícita.
- El script sigue siendo sólo planificador/verificador. No se implementó todavía
  la etapa `apply`.

## Gate 71 · Hops genérico + adaptadores de proyecto

- Se confirmó que la separación de instaladores también debe reflejarse en Hops.
- El CLI `hops` será común: tendrá un núcleo reusable y resolverá un adaptador
  desde la configuración del proyecto.
- `wt-create` conservará un flujo genérico de worktree, envs, DB, puertos y
  health checks; Hospeda declarará sus nombres de apps, Linear, template y
  scripts mediante un manifiesto sin secretos.
- La implementación se difiere hasta contar con un segundo proyecto real. Hasta
  entonces Hospeda sigue usando su adaptador implícito actual para evitar una
  abstracción especulativa.

## Gate 72 · Prefijo `qz` para el núcleo común

- Se corrigió la nomenclatura: el conjunto reusable no se llamará `hops`, porque
  ese nombre pertenece a Hospeda.
- El núcleo multi-proyecto tendrá identidad `qz` (`qz wt-create`, `qz env`,
  `qz verify`, etc.). Hospeda conserva `hops-*` como capa/adaptador específico.
- La configuración futura del núcleo se documenta bajo `.qz/project.json`;
  Hospeda declarará allí su adapter, mientras mantiene compatibilidad con sus
  scripts actuales durante la transición.
- La extracción real de `qz` se difiere hasta disponer de un segundo proyecto.

## Gate 73 · `start-issue` y `close-issue` genéricos

- Se confirmó que iniciar y cerrar issues también pertenece al núcleo `qz`, no a
  Hospeda.
- `qz start-issue` deberá orquestar issue, branch, worktree, env/DB, contexto y
  agente opcional usando un adapter declarativo.
- `qz close-issue` deberá orquestar preflight, closeout, estados, cleanup y
  acciones remotas mediante el mismo adapter.
- El adapter declara proveedor de issues, identificadores, estados, labels,
  branch base, nombres de branch y acciones Linear/GitHub.
- Hospeda conservará `hops-start-issue` y `hops-close-issue` como aliases de
  compatibilidad que seleccionan el adapter Hospeda.
