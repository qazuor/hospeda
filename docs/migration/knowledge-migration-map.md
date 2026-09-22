# Mapa de migración de conocimiento Hospeda

Este documento define cómo se trasladará el conocimiento de Claude Code a OpenCode V1 + Gentle-AI. Es una especificación de migración; no reemplaza todavía ningún `CLAUDE.md` ni crea skills operativos.

## Regla de carga

- `AGENTS.md` raíz: solo reglas universales, arquitectura global, invariantes y verificación mínima.
- `AGENTS.md` anidados: reglas que aplican a un área concreta y que deben cargarse automáticamente al explorarla.
- Skills: conocimiento especializado que conviene cargar bajo demanda y que puede reutilizarse en varias tareas.
- Commands: operaciones deterministas, repetibles y con parámetros claros; deben delegar en scripts cuando sea posible.
- Agents: roles pocos y explícitos, con permisos propios; no se crearán agentes por cada tecnología.
- Documentación normal: explicación extensa, histórica o de referencia que no debe entrar en cada contexto.
- `AGENTS.md`: será la fuente canónica común para Claude Code, OpenCode V1 y Codex.
- `CLAUDE.md`: no tendrá contenido propio. Claude Code 2.1.277+ ya lee `AGENTS.md` cuando no existe un `CLAUDE.md` del proyecto; la versión instalada es 2.1.278. Se mantendrá sólo como symlink/shim opcional si necesitamos compatibilidad con versiones antiguas o proveedores Bedrock/Vertex/Foundry, donde AGENTS aún no está disponible.
- `MEMORY.md`: se conserva como material histórico; sólo el conocimiento estable y deduplicado debe transformarse en skills o AGENTS. No se importará completo a Engram.

## Inventario verificado (2026-09-15)

El repositorio contiene 25 `CLAUDE.md`: uno en la raíz, 3 en `apps/`, 18 en
`packages/` y 3 instrucciones de subdominio bajo `packages/schemas/src`. Hay 17
agentes Claude, 19 commands, 36 skills y 147 directorios de `.specs` con 257
archivos. El raíz tiene 980 líneas; los documentos grandes son `apps/web`,
`packages/service-core`, `apps/admin`, `apps/api`, `packages/db` y
`packages/seed`.

La extracción estructural confirma que los documentos mayores concentran
procedimientos locales y changelogs, no sólo invariantes: `service-core` tiene
1.336 líneas, `apps/web` 1.172, `apps/admin` 812, `apps/api` 805, `packages/db`
824 y `packages/seed` 779. Los temas repetidos más frecuentes son testing,
auth, billing, specs, seguridad y deploy. Por eso no conviene convertir cada
`CLAUDE.md` completo en un skill; primero hay que separar reglas duraderas,
procedimientos deterministas y contexto histórico.

## Destino propuesto

### `AGENTS.md` raíz

Debe contener:

- mapa del monorepo y dependencias entre apps/packages;
- comandos canónicos de pnpm, calidad y tests rápidos;
- invariantes de TypeScript, Biome, Drizzle, Hono, Astro y TanStack;
- reglas de seguridad y manejo de secretos;
- reglas Git y límites de producción;
- referencia a `hops`, Linear, worktrees y specs sin describir toda su implementación;
- índice de skills y documentación especializada.

No debe contener listas extensas de casos de negocio, historiales de specs, instrucciones repetidas por package ni prompts de agentes.

### Skills project-local

Se crearán solo después de deduplicar el material actual:

| Skill | Fuentes principales | Carga |
|---|---|---|
| `hospeda-architecture` | `CLAUDE.md` raíz, docs de arquitectura | cambios que cruzan áreas |
| `hospeda-web-astro` | `apps/web/CLAUDE.md`, docs web | UI, SSR, islands, estilos |
| `hospeda-api-hono` | `apps/api/CLAUDE.md`, docs API | rutas, middleware, contratos |
| `hospeda-admin-tanstack` | `apps/admin/CLAUDE.md` | pantallas y routing admin |
| `hospeda-db-drizzle` | `packages/db/CLAUDE.md` | schema, queries, migraciones |
| `hospeda-schemas-zod` | `packages/schemas/CLAUDE.md` | validación y contratos |
| `hospeda-service-core` | `packages/service-core/CLAUDE.md` | servicios y errores |
| `hospeda-billing` | `packages/billing/CLAUDE.md`, specs billing | planes, entitlements, pagos |
| `hospeda-auth` | auth packages/docs | Better Auth y permisos |
| `hospeda-i18n` | `packages/i18n/CLAUDE.md` | traducciones y locales |
| `hospeda-testing` | testing docs y comandos | Vitest, smoke y gates |
| `hospeda-seed` | `packages/seed/CLAUDE.md` | fixtures y migraciones de datos |
| `hospeda-media-email` | packages media/email/notifications | integraciones auxiliares |
| `hospeda-linear-workflow` | `.claude/linear.json`, `hops`, docs | issues, specs y cierre |
| `hospeda-worktrees` | scripts/client-tools y docs | puertos, DB, env y cleanup |

Cada skill tendrá fuentes enlazadas y una sección de límites para evitar duplicar `AGENTS.md`.

### Commands y scripts

- Mantener `hops` como capa determinista para Linear, worktrees, puertos, bases, smoke y limpieza.
- Exponer commands OpenCode finos (`startIssue`, `closeIssue`, `recap`, `handoff`) solo cuando agreguen una interfaz conversacional útil.
- No convertir procedimientos narrativos o listas de convenciones en commands.
- Los commands no deben ocultar mutaciones: deben mostrar el plan y respetar permisos.

### Agents

El objetivo inicial es conservar solo roles de exploración, implementación y revisión especializada cuando sus permisos o contexto aporten algo que una skill no resuelve. Los agentes tecnológicos del inventario Claude se consolidarán por capacidad, no por framework.

### Orden de extracción recomendado

1. `hospeda-architecture`, testing/quality y seguridad: afectan casi cualquier
   tarea y deben definir límites comunes.
2. `hospeda-web-astro`, `hospeda-api-hono`, `hospeda-admin-tanstack` y
   `hospeda-db-drizzle`: concentran los tres runtimes principales.
3. schemas/Zod, service-core, auth, billing e i18n: cargarlos sólo cuando la
   tarea toque esos dominios.
4. Linear/worktrees/hops/specs: convertirlos en skills y commands después de
   estabilizar los contratos deterministas.
5. deploy, observabilidad, MercadoPago, performance y accesibilidad: mantener
   inicialmente como documentación o skills de uso explícito, no en el contexto
   base.

### Clasificación inicial del `CLAUDE.md` raíz

| Sección actual | Destino recomendado | Motivo |
|---|---|---|
| Project Overview, arquitectura y mapa de apps/packages | `AGENTS.md` breve + skill `hospeda-architecture` | invariantes globales, con detalle bajo demanda |
| Key Commands y comandos `hops` | documentación/skill `hospeda-tooling` | la lista cambia y no debe llenar el contexto base |
| Development Guidelines, naming, Git protegido y ramas | `AGENTS.md` | reglas universales de casi toda tarea |
| Testing y Code Quality | `AGENTS.md` mínimo + skill `hospeda-testing` | conservar gates, mover recetas largas |
| Database, env y migraciones | skills DB/config + docs de referencia | son sensibles al dominio y tienen procedimientos extensos |
| Billing quick reference y smokes | skill `hospeda-billing` | conocimiento especializado y de alto riesgo |
| Patterns and Conventions por framework | skills web/API/admin/DB | cargar según rutas afectadas |
| Spec & Task Management | skill `hospeda-linear-specs` + commands finos | workflow operativo, no regla universal |
| Common Gotchas y changelogs históricos | documentación normal | útiles para consulta, costosos en contexto permanente |
| enlaces a documentación y legacy `.qtm` | README/documentación de migración | referencia y compatibilidad, no instrucciones activas |

El `AGENTS.md` raíz no debe absorber el contenido de billing, smoke,
MercadoPago, despliegue ni historiales de specs. `CLAUDE.md` se conservará para
compatibilidad futura, pero se reducirá gradualmente sólo después de validar los
skills equivalentes.

## Secuencia de migración

1. Extraer headings y comandos de cada `CLAUDE.md`.
2. Detectar duplicados y reglas contradictorias.
3. Marcar contenido obsoleto o ligado a specs históricas.
4. Redactar `AGENTS.md` raíz corto.
5. Crear skills project-local con fuentes y límites.
6. Portar commands deterministas a OpenCode y mantener `hops` como implementación.
7. Validar con una tarea real de cada app/package.
8. Mantener `CLAUDE.md` intactos hasta completar el período de rollback.

## Restricciones

- No se copiarán secretos, tokens, credenciales ni valores de `.env`.
- No se instalarán skills comunitarios sin revisar fuente, permisos y mantenimiento.
- Las configuraciones de worktree no deben trasladar `connStringTemplate` ni
  ningún DSN con credenciales embebidas; sólo deben migrarse nombres de variables
  y referencias a archivos locales protegidos.
- No se eliminará un `CLAUDE.md` hasta tener reemplazo probado y aprobación explícita.
- Todo cambio de este documento se realiza en el worktree de migración dedicado.

## Estado de los documentos raíz

`AGENTS.md` quedó reducido a 40 líneas de reglas universales, arquitectura
global, invariantes y workflow mínimo. `CLAUDE.md` sigue teniendo 980 líneas y
conserva detalles de billing, smoke, specs, comandos, worktrees y gotchas para
compatibilidad histórica. No se migrará como segundo archivo canónico: se
extraerá el contenido útil a `AGENTS.md`, skills y documentación.

Durante la transición puede existir un shim `CLAUDE.md` apuntando a
`AGENTS.md`, pero OpenCode debe usar `AGENTS.md` como autoridad. Claude Code
2.1.277+ también lo cargará si no encuentra `CLAUDE.md`; esto evita mantener dos
copias divergentes. El contenido especializado debe pasar gradualmente a skills
o documentación canónica. Cuando haya diferencias de proceso (por ejemplo,
políticas de commit o permisos), la configuración activa de OpenCode y la
autorización humana prevalecen; no se debe duplicar la regla en ambos archivos
sin registrar cuál es la autoridad.

## Verificación AGENTS.md entre CLIs (2026-09-21)

- **Claude Code 2.1.278**: soporte oficial desde 2.1.277. En un proyecto sin
  `CLAUDE.md`, carga `AGENTS.md`; se puede cambiar en `/config` → `Project
  instructions`. La compatibilidad todavía no está disponible en Bedrock,
  Vertex ni Foundry.
- **OpenCode V1 1.18.31**: carga `AGENTS.md` y usa `CLAUDE.md` sólo como
  fallback si no existe `AGENTS.md`. La documentación V1 confirma esta
  precedencia.
- **Codex CLI 0.155.1**: descubre `AGENTS.md` desde `~/.codex` y desde la raíz
  del repositorio hasta el CWD, combinando los archivos por profundidad.

Decisión: mantener un único contenido canónico en `AGENTS.md`. No copiar el
archivo a tres formatos. Si se necesita compatibilidad con un Claude antiguo,
crear un `CLAUDE.md` symlink/shim que remita a `AGENTS.md`, sin instrucciones
independientes.

## Mapa de secciones de `CLAUDE.md`

| Sección actual | Destino recomendado |
|---|---|
| Project Overview, stack y arquitectura | `AGENTS.md` resumido + `hospeda-architecture` |
| API Route Architecture | `hospeda-api-hono` |
| comandos de desarrollo y `hops` | README de `hops` + command/skill de worktrees |
| testing, quality y guards | `hospeda-testing-quality` + CI/guards |
| billing, QZPay y smoke productivo | `hospeda-billing` + documentación de runbooks |
| Git, branches y PR tags | `AGENTS.md` sólo como invariantes + docs de workflow |
| patrones Hono/service-core/DB/Web/Admin | skills específicas por área |
| environment configuration | skill de seguridad/configuración + docs de env |
| Single Source of Truth | `AGENTS.md` como regla universal |
| Spec & Task Management | `hospeda-linear-specs` + adaptador versionado |
| legacy `.qtm` | documentación histórica; no skill activa |
| Spec Workflow + Worktrees | `hospeda-worktrees` + `hops`; no duplicar en un agent |

Las secciones de billing y despliegue contienen detalles sensibles al tiempo;
deben mantener una fuente documental canónica y no copiarse enteras a cada
skill. Las instrucciones de ejecución deben apuntar a scripts con permisos y
dry-run, no a recetas narrativas de shell.
