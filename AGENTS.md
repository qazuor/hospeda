# Hospeda — instrucciones universales para agentes

## Alcance

Hospeda es un monorepo TypeScript administrado con pnpm y Turborepo.
Las aplicaciones principales son:

- `apps/web`: Astro y React islands.
- `apps/api`: Hono y servicios HTTP.
- `apps/admin`: TanStack Start.

Los paquetes compartidos incluyen Drizzle/PostgreSQL (`packages/db`), Zod
(`packages/schemas`), billing, autenticación, i18n, notificaciones, logging y
utilidades.

Las reglas especializadas viven en skills, documentación del paquete y el
adapter del proyecto. Este archivo contiene sólo invariantes globales.

## Fuente de verdad y estado

- Confirmar siempre el repositorio, worktree, branch e issue antes de editar.
- Leer `.qz/project.json` y usar el adapter declarado para workflows repetibles.
- `qz-*` identifica comandos portables; `hops-*` identifica comandos propios de
  Hospeda.
- Usar `qz`/`hops` antes de reconstruir manualmente un workflow existente.
- Mantener Git como fuente de verdad técnica y no cambiar de branch sin una
  instrucción explícita.
- Usar ODD como flujo normal; crear `.specs` sólo cuando el riesgo o la
  complejidad lo justifique. SDD/OpenSpec es excepcional y requiere pedido
  explícito.

## Reglas de implementación

- TypeScript estricto, exports nombrados y `import type` cuando corresponda.
- Validar entradas externas con Zod y devolver errores tipados.
- Preferir funciones pequeñas, inmutabilidad y `async/await`.
- No introducir secretos, tokens, cookies, claves privadas ni valores de `.env`
  en archivos, logs, commits o respuestas.
- No duplicar reglas entre aplicaciones: reutilizar paquetes compartidos.

## Verificación

- Para cambios rápidos usar `qz-verify --changed` cuando corresponda.
- Ejecutar los checks específicos del área modificada y reportar los resultados.
- Distinguir hechos verificados, inferencias y tareas pendientes.
- No declarar listo un cambio sólo porque compila: revisar tests, CI y gates del
  adapter cuando apliquen.

## Seguridad y operaciones

- Las consultas read-only se pueden ejecutar directamente.
- Pedir confirmación antes de operaciones destructivas, producción, push, merge,
  cambios externos o mutaciones en Linear.
- No ejecutar comandos sobre bases, servidores o worktrees ajenos al contexto
  actual.
- No leer ni mostrar valores sensibles aunque estén disponibles localmente.

## Documentación y conocimiento

- Mantener este archivo corto y estable.
- Poner conocimiento especializado en skills cargados bajo demanda.
- Poner procedimientos ejecutables en comandos o scripts versionados.
- Poner decisiones y explicación extensa en `docs/`, no en estas instrucciones.
