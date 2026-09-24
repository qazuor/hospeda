# Decisión propuesta para `.specs`, ODD y Gentle SDD

## Decisión recomendada revisada tras ODD

Mantener `.specs` + Linear como identidad canónica de Hospeda y usar **ODD como camino normal de Gentle-AI**. SDD/OpenSpec queda como modo explícito, elegido por la persona, cuando se necesitan proposal, spec, design, tasks y verify separados. No migrar masivamente las 147 specs existentes ni introducir un segundo estado macro.

La documentación actual de Gentle-AI describe ODD como el flujo cotidiano, incluso para trabajo sustancial autorizado: el agente explora, resuelve decisiones reales, implementa y verifica; para trabajo que deba sobrevivir una interrupción conserva un único documento recuperable en `odd/tasks/<feature-name>.md`. SDD continúa soportado, pero no se activa por tamaño, incertidumbre o riesgo automáticamente.

## Reglas de entrada

| Tipo de trabajo | Flujo |
|---|---|
| Bug, fix pequeño, NO-SPEC | Linear + `hops` + verify/closeout mínimo |
| Feature acotada | Linear + `.specs/HOS-NNN-*` existente |
| Feature compleja o arquitectura | ODD por defecto; `.specs` como vínculo Hospeda. SDD sólo si se solicita explícitamente una revisión por fases y artefactos separados |
| Épica | Linear Project + issues HOS hijos; cada hijo conserva su propio registro |

## Fuente de verdad

- Linear posee identidad, estado macro, prioridad, dependencias y decisiones del dueño.
- `.specs/HOS-NNN-*` posee el contrato técnico Hospeda, closeout y enlaces a evidencia.
- ODD posee el documento recuperable de ejecución; Gentle SDD posee artefactos formales sólo cuando se elige ese modo.
- Git posee el código y el historial de implementación.

Ningún estado de Gentle debe reemplazar el estado de Linear. El adapter debe conservar `HOS-NNN` en el nombre del change y enlazarlo al directorio `.specs`.

## Integración mínima necesaria

1. El flujo ODD guarda un único documento recuperable con `linearIssue`, `specPath` y `worktree` cuando el trabajo lo requiere.
2. `.specs` se crea o enlaza sólo cuando la feature necesita un contrato técnico duradero.
3. Si la persona solicita SDD, `qz/hops sdd-start HOS-NNN` comprueba Linear y crea o enlaza el change formal.
4. `verify` produce evidencia compatible con el closeout de `.specs`.
5. `archive` no mueve ni borra `.specs`; agrega evidencia y marca el change como archivado.
6. `close-issue --plan` comprueba ambos lados y muestra cualquier divergencia.

## Qué no migrar

- Specs históricas completas.
- `.qtm` legacy salvo cuando un issue vuelva a trabajarse.
- Task Master como dependencia global de todos los agentes.
- Un índice macro paralelo dentro de OpenSpec/Gentle.

Task Master puede conservarse dentro de una spec sólo mientras aporte seguimiento real. Si no hay uso, se reemplaza gradualmente por el documento ODD y/o `tasks.md`, sin tocar el contrato Linear.

## Gentle Shell

Gentle Shell (`gentle-shell`, paquete publicado históricamente como `gentle-pi`) es un harness nativo de Pi, no un plugin de OpenCode. Tiene su propio home (`~/.gentle-shell/agent`), provisioning, paquetes, TUI y credenciales. No debe instalarse como parte de esta migración porque Hospeda está adoptando OpenCode y Pi fue descartado. Se mantiene como opción futura independiente, sin compartir estado automáticamente con OpenCode.

## Riesgos y mitigaciones

- **Dos estados divergentes:** un único adapter actualiza/enlaza; Linear gana en conflictos.
- **Ceremonia excesiva:** entrada selectiva; bugs pequeños no pasan por SDD.
- **Lock-in:** conservar Markdown y metadata explícita, sin depender de una DB privada.
- **Cierre incompleto:** closeout requiere evidencia de verify y estado Linear compatible.

La decisión requiere aprobación humana antes de implementar comandos SDD o adaptar specs nuevas.
