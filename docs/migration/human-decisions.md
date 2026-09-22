# Decisiones que requieren aprobación humana

Fecha: 2026-09-15.

Este documento separa decisiones de producto/tooling de tareas técnicas. No
autoriza cambios por sí mismo.

| Decisión | Opciones | Recomendación | Impacto | Reversibilidad |
|---|---|---|---|---|
| Memoria Engram | usar DB tal cual, sanear copia, export/import, no conectar todavía | sanear copia y mantener original intacta | alto: calidad del contexto y riesgo de ruido | alta si se conserva backup y no se toca original |
| Fuente de specs | `.specs`, Gentle SDD, híbrido | `.specs` + Linear; Gentle SDD para features complejas | medio/alto: cambia lifecycle de planificación | alta sin conversión masiva |
| Taskmaster | reinstalar, reemplazar, retirar | retirar inicialmente; recuperar sólo atajos medidos | medio: ergonomía y tracking interno | alta |
| Linear | API/CLI, MCP, ambos | API/CLI determinista + MCP opcional | alto: workflow de issues | alta con dry-run/read-back |
| Worktrees | `hops`, plugin OpenCode, híbrido | `hops` como única autoridad | alto: DB, puertos, cleanup | alta si se conserva contrato actual |
| Agentes | migrar todos, pocos roles, sólo skills | pocos roles + skills bajo demanda | medio: contexto y permisos | alta |
| Permisos Bash | comodín allow, allowlist, ask por categoría | endurecer por categorías antes de Hospeda | alto: seguridad operativa | alta con backup de config |
| Providers | sólo OpenAI, OpenAI + GLM/DeepSeek, Kilo | OpenAI primero; secundarios después de piloto | medio: costo, calidad y privacidad | alta |
| Plugins | ninguno, Gentle, pilotos comunitarios | sólo Gentle; pilotos uno por vez | medio: superficie y mantenimiento | alta con versiones fijadas |
| TUI/statusline | mantener entrada huérfana, retirarla, reemplazarla | validar runtime; retirar si no carga | bajo/medio: ergonomía | alta |
| Tooling reusable | dentro de Hospeda, repo global nuevo, repo existente | crear repo reusable sólo cuando el contrato esté estable | medio: mantenimiento entre proyectos | alta si se mantienen adaptadores |
| Retiro Claude | inmediato, coexistencia, retiro gradual | coexistencia hasta validación integral | alto: rollback y continuidad | alta durante período acordado |
| Bootstrap reproducible | manual, script local, repo reusable | repo reusable con adaptador Hospeda, manifest y rollback | alto: reinstalación futura | alta si es idempotente y genera backups |
| Alcance de `client-tools` | sólo comandos actuales, backlog P0, backlog completo | completar actuales + P0 antes de migrar; P1/P2 después según medición | alto: dependencia diaria de workflows | alta por comando |
| Distribución `hops` | dependencias globales, wrapper a checkout, bundle standalone | wrapper global a checkout estable ahora; bundle standalone después | medio: actualización y disponibilidad del CLI | alta |
| OpenKilo | no usar, perfil experimental, provider principal | perfil experimental sólo para tareas simples/no sensibles | medio: red externa, calidad y privacidad | alta |
| OpenChamber | no usar, UI alternativa, reemplazar TUI | UI alternativa opcional, sin reemplazar TUI ni `hops` | medio: servidor y superficie de acceso | alta |
| PTY/voz | instalar de entrada, pilotos, no usar | pilotos posteriores sólo ante gap medido | medio: procesos/red/audio | alta |

## Aprobaciones necesarias antes de implementar

1. aceptar la política de Engram y el procedimiento de revisión individual;
2. confirmar `.specs` + Linear como fuente principal y Gentle SDD sólo selectivo;
3. aprobar el endurecimiento de permisos antes de abrir Hospeda;
4. aprobar el primer alcance de `hops`/Linear read-only;
5. decidir si se crea un repositorio global de tooling;
6. decidir el período de coexistencia con Claude Code.

Las decisiones de distribución de `hops` y alcance provisional de estos cuatro
complementos ya fueron adoptadas como se indica en la tabla; no requieren otra
confirmación para la fase de análisis. Su instalación concreta seguirá
requiriendo pruebas aisladas.
