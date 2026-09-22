# Configuración actual OpenCode + Gentle-AI

## Global — estado pre-limpieza

El relevamiento inicial de `~/.config/opencode/opencode.json` correspondía al
estado anterior a la limpieza y no debe usarse como baseline actual. El agente
por defecto es `gentle-orchestrator`; existen agentes SDD, judgment/review y
fallbacks `explore`/`general`. La lectura actual declara MCP de Context7
(remoto) y Engram (local mediante `engram mcp --tools=agent`); no aparece un
MCP de Linear activo en esta instalación. El share está desactivado y el tema
es `gentleman-kanagawa`.

La política actual permite `bash` con comodín global y pide autorización para
commit, push, rebase, reset, SSH, SCP y rsync. El acceso de lectura bloquea
extensiones y rutas sensibles (`.env`, `.pem`, `.key`, `.ssh`, credenciales,
secrets y similares). La base es prudente para lectura de archivos, pero el
`bash: "*": "allow"` es más amplio que la política deseada para una instalación
final: debe reemplazarse por permisos por categoría y confirmación para
mutaciones.

Aunque hay varios archivos `.ts` en `~/.config/opencode/plugins`, el runtime
debe distinguir los plugins administrados por `opencode.json` de las entradas de
la TUI. La TUI limpia declara actualmente dos entradas: `opencode-subagent-
statusline` y `/home/qazuor/.config/opencode/tui-plugins/gentle-logo.tsx`.
`opencode-sdd-engram-manage` no está declarado en `tui.json`. No se debe asumir
que todo archivo en `plugins/` se ejecuta; la activación efectiva debe
verificarse con una sesión aislada posterior.

## TUI — estado actual post-limpieza

Tras la reinstalación limpia se restauró `~/.config/opencode/tui.json` con los
atajos acordados: mouse desactivado,
Home/End y Ctrl+Home/Ctrl+End para línea/buffer, atención visual con
notificaciones y sin sonido. Debe probarse manualmente en una sesión real antes
de considerarlo definitivo.

La validación sintáctica pasó, pero una comprobación de filesystem encontró que
`/home/qazuor/.config/opencode/tui-plugins/gentle-logo.tsx` existe y
`opencode-subagent-statusline` no está resoluble como archivo local ni aparece
en los directorios globales inspeccionados. No se instaló ni se eliminó el
plugin; la entrada debe validarse con el runtime o corregirse en una etapa
posterior.

La recomendación provisional es tratar esa entrada como huérfana: mantenerla
fuera de una futura configuración versionada hasta demostrar que OpenCode la
resuelve y que aporta información útil. Si la sesión aislada confirma que no se
carga, debe retirarse en una limpieza TUI posterior; no debe instalarse un
reemplazo sólo para conservar el nombre.

## Verificación efectiva posterior a la reinstalación

La lectura directa de `~/.config/opencode/opencode.json` confirmó:

- 23 agentes declarados y `gentle-orchestrator` como agente por defecto.
- MCPs declarados: `context7` y `engram`.
- Cero plugins declarados en `opencode.json`.
- Seis archivos TypeScript presentes en `~/.config/opencode/plugins`; su sola
  presencia no demuestra que estén cargados por el runtime.
- El permiso global todavía contiene `bash: "*": "allow"`, con confirmación
  explícita para Git destructivo, push, SSH, SCP, SFTP y rsync.

Antes de conectar Hospeda debe verificarse en una sesión aislada qué plugins se
cargan realmente y debe revisarse el comodín global de Bash. Esta revisión no se
hará modificando la configuración administrada sin una decisión registrada.

OpenCode ofrece `debug config`, `debug agents` y `plugin list`, pero estos
comandos consultan el servicio de OpenCode. En un HOME temporal sin servicio
inicializado terminaron con `Server process exited with code 1`; no se interpretó
eso como fallo de la instalación global ni se reutilizó la sesión real para
forzar la prueba.

## Hospeda

La configuración project-local todavía no existe en el worktree de migración.
La futura capa versionada debe contener sólo lo específico de Hospeda:
`AGENTS.md`, skills de dominio, commands finos, adaptador `hops`, política de
Linear/worktrees y, si se adopta, configuración SDD/OpenSpec enlazada a HOS.
No se deben copiar al repo credenciales, auth, caches, DBs ni preferencias
globales.

## Externo — estado actual

- OpenAI y otros providers: no hay auth heredada en la instalación limpia. Se
  configurarán manualmente después de decidir routing; los nombres/modelos se
  documentan sin tokens.
- Linear: MCP o API/CLI, con escritura sólo desde commands explícitos.
- Engram: DB y MCP globales; su saneamiento y backup son independientes del repo.
- Context7: documentación remota, útil globalmente pero no requisito de cada
  skill.
- CodeGraph: índice local externo; su MCP requiere validación separada.

## Recomendación

Mantener Gentle-AI global para runtime, SDD genérico, Engram, Context7 y agentes
de revisión. Versionar en un repositorio genérico el adaptador de Linear,
worktrees y permisos compartidos. Versionar dentro de Hospeda únicamente las
skills, commands y reglas que codifican arquitectura y workflow propios.
