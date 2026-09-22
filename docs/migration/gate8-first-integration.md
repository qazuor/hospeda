# Gate 8 — primera integración reversible

Fecha: 2026-09-15

## Cambio realizado en el worktree

`hops start-issue` ahora acepta `--agent claude|opencode`. Claude sigue siendo
el valor por defecto para preservar compatibilidad; `--no-claude` continúa
siendo un alias de no lanzar ningún agente. Con `--agent opencode`, el mismo
worktree y el mismo prompt `/startIssue HOS-NNN` se entregan al binario
`opencode`. No se cambió la creación del worktree, Linear, bases, puertos,
servidores ni cleanup.

La selección está encapsulada en el launcher del comando, de modo que una etapa
posterior pueda reemplazar Claude sin duplicar el workflow. El cambio está en
el worktree dedicado y no tiene commit.

## Validación

Se agregaron pruebas de parsing para el agente por defecto, OpenCode y
`--no-claude`. Se instalaron únicamente las dependencias propias de
`scripts/client-tools` (`bun install` en ese directorio). La suite focalizada
pasó: 28 tests, 0 fallos. La suite completa pasó: 288 tests, 0 fallos y 616
aserciones.

Esto confirma que `hops` no necesita instalar las dependencias del monorepo
completo. Cada checkout de `client-tools` necesita su propio entorno Bun; para
el futuro se puede distribuir un bundle standalone o apuntar el wrapper global
a un checkout estable, pero no conviene usar dependencias globales compartidas.

## Decisión adoptada

Por ahora el wrapper global de `hops` deberá apuntar a un checkout estable de
`scripts/client-tools`, con sus dependencias locales instaladas. Más adelante,
cuando el CLI y su contrato de comandos estén estabilizados, se evaluará un
bundle standalone para eliminar incluso esa dependencia del checkout. Esta
La decisión queda aplicada al wrapper global: ahora apunta a este checkout de
migración para que `hops --agent opencode` esté disponible. Al finalizar esta
migración, debemos volver a apuntar los wrappers a
`/home/qazuor/projects/WEBS/hospeda-staging`.

No se ejecutó `start-issue`, no se consultó Linear, no se creó ningún worktree y
no se lanzó OpenCode.
