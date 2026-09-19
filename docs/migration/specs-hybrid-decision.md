# Decisión propuesta para `.specs` y Gentle SDD

## Decisión recomendada

Mantener `.specs` + Linear como identidad canónica de Hospeda y usar Gentle SDD de forma selectiva para cambios complejos. No migrar masivamente las 147 specs existentes ni introducir un segundo estado macro.

## Reglas de entrada

| Tipo de trabajo | Flujo |
|---|---|
| Bug, fix pequeño, NO-SPEC | Linear + `hops` + verify/closeout mínimo |
| Feature acotada | Linear + `.specs/HOS-NNN-*` existente |
| Feature compleja o arquitectura | `.specs` como vínculo Hospeda + Gentle `explore → propose → spec → design → tasks → apply → verify → archive` |
| Épica | Linear Project + issues HOS hijos; cada hijo conserva su propio registro |

## Fuente de verdad

- Linear posee identidad, estado macro, prioridad, dependencias y decisiones del dueño.
- `.specs/HOS-NNN-*` posee el contrato técnico Hospeda, closeout y enlaces a evidencia.
- Gentle SDD posee artefactos de razonamiento y verificación del change complejo.
- Git posee el código y el historial de implementación.

Ningún estado de Gentle debe reemplazar el estado de Linear. El adapter debe conservar `HOS-NNN` en el nombre del change y enlazarlo al directorio `.specs`.

## Integración mínima necesaria

1. `qz/hops sdd-start HOS-NNN` comprueba Linear y crea o enlaza el change.
2. El change guarda `linearIssue`, `specPath` y `worktree` en metadata versionada.
3. `verify` produce un resumen compatible con el closeout de `.specs`.
4. `archive` no mueve ni borra `.specs`; agrega evidencia y marca el change como archivado.
5. `close-issue --plan` comprueba ambos lados y muestra cualquier divergencia.

## Qué no migrar

- Specs históricas completas.
- `.qtm` legacy salvo cuando un issue vuelva a trabajarse.
- Task Master como dependencia global de todos los agentes.
- Un índice macro paralelo dentro de OpenSpec/Gentle.

Task Master puede conservarse dentro de una spec sólo mientras aporte seguimiento real. Si no hay uso, se reemplaza gradualmente por `tasks.md`/estado SDD sin tocar el contrato Linear.

## Riesgos y mitigaciones

- **Dos estados divergentes:** un único adapter actualiza/enlaza; Linear gana en conflictos.
- **Ceremonia excesiva:** entrada selectiva; bugs pequeños no pasan por SDD.
- **Lock-in:** conservar Markdown y metadata explícita, sin depender de una DB privada.
- **Cierre incompleto:** closeout requiere evidencia de verify y estado Linear compatible.

La decisión requiere aprobación humana antes de implementar comandos SDD o adaptar specs nuevas.
