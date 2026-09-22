# Linear — Gate 5 read-only

Fecha: 2026-09-15

## Inventario local

La integración está implementada en `scripts/client-tools/src/lib/linear.ts` y
`linear-auth.ts`, con consumidores en `start-issue`, estadísticas y servicios
de feedback de la API. El cliente usa GraphQL y devuelve un contrato mínimo
(`identifier`, título, estado, labels y URL). `start-issue` deriva branch/slug,
prepara el worktree y actualmente puede lanzar Claude; esa última acción es el
acoplamiento que se reemplazará por OpenCode en una etapa posterior.

`.claude/linear.json` y los comandos Claude documentan el contexto de Hospeda,
pero la lógica determinista de lectura y derivación vive en `hops`. El diseño
recomendado mantiene API/CLI como autoridad y deja MCP como interfaz opcional.

## Prueba realizada

En este gate sólo se inspeccionaron rutas, nombres de archivos, contratos y
código local. No se leyó ninguna clave, no se llamó a la API de Linear y no se
ejecutaron transiciones, comentarios, creación de issues ni cierres.

La lectura remota se probó de forma controlada con `hops start-issue --dry-run
--no-claude` sobre HOS-1257, HOS-1322 y HOS-1247. Linear respondió correctamente
y devolvió sus estados (`Canceled`/`Done`); el comando se detuvo antes de
calcular el plan porque esos issues están cerrados y la ejecución no era
interactiva. No se creó worktree ni se mutó Linear. Falta repetir con un issue
abierto para validar branch/slug completos.

La prueba pendiente se completó con HOS-1344: Linear devolvió `Backlog`, labels
y título; `hops` derivó correctamente `fix/hos-1344-el-mapa-de-mensajes-http-
solo-cubre-0` y terminó en `--dry-run` sin crear nada.

## Recomendación

Conservar `hops` y separar `preflight`, `plan`, `apply` y `read-back`. Exponer
commands OpenCode delgados y reemplazar sólo el launcher de Claude. No instalar
un MCP de Linear como dependencia de los workflows críticos.
