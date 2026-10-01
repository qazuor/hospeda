# Política de specs y workflows de desarrollo

Este documento fija el comportamiento vigente del proyecto durante la migración
de Claude Code a OpenCode, Codex y Gentle Shell. Evita que una instrucción
histórica de `CLAUDE.md` reactive accidentalmente un flujo que ya no es el
predeterminado.

## Decisión operativa

Hospeda usa **ODD (Outcome-Driven Development)** como flujo normal. El objetivo
es llegar a un resultado verificable con el mínimo de documentación necesaria,
manteniendo trazabilidad en Linear y evidencia técnica en el repositorio.

- **Linear** es la fuente de verdad para issues `HOS-NNN`, estado macro,
  prioridad, dependencias, decisiones, migraciones y variables de entorno.
- **`.specs/`** conserva el contexto técnico durable de una feature compleja,
  fix de riesgo o cambio que necesite una decisión compartida. No es un tablero
  de estado y no reemplaza Linear.
- **Task Master** queda limitado al seguimiento interno de tareas dentro de una
  spec existente. No asigna números, no es roadmap y no debe usarse por inercia.
- **SDD/OpenSpec de Gentle-AI** está deprecado para el flujo normal. Sólo se
  usa cuando el usuario lo pide explícitamente o cuando una integración externa
  exige ese formato. `hops gentle-sdd-status` es únicamente diagnóstico
  read-only y no debe iniciar una mutación.

## Enrutamiento por tamaño y riesgo

| Situación | Flujo principal | Artefactos mínimos |
|---|---|---|
| Consulta, diagnóstico, cambio local reversible | ODD directo | Linear si cambia el repositorio; evidencia de verificación |
| Bug o tarea pequeña bien definida | ODD + `qz/hops` | issue, cambio, tests/guard apropiado, cierre |
| Feature mediana con varias áreas | ODD con plan explícito | issue Linear, plan breve, skills de dominio, verificación |
| Feature compleja, contrato público, migración o alto riesgo | ODD + `.specs` | `spec.md`, criterios, riesgos, tareas sólo si ayudan, `closeout.md` si corresponde |
| Pedido explícito de SDD/OpenSpec | SDD excepcional | artefactos requeridos por Gentle-AI y referencia al `HOS-NNN` |

ODD no significa saltar el análisis: significa que la documentación se escala
al riesgo real. Una spec no debe crearse sólo porque el cambio tiene varios
archivos, y no debe omitirse cuando hay contrato, datos, seguridad o una
decisión que otros agentes necesitarán reutilizar.

## Orden de autoridad

Cuando aparecen instrucciones contradictorias, aplicar este orden:

1. pedido actual del usuario;
2. `AGENTS.md` y `.qz/project.json`;
3. `.specs/README.md` y este documento;
4. guards/scripts ejecutables y configuración vigente;
5. documentación de skills;
6. `CLAUDE.md` y `.claude/docs/` legacy.

Las referencias legacy que dicen “SDD obligatorio”, “Plan → Spec → Tasks” o
que tratan Task Master como sistema global se consideran históricas hasta que
se revisen. No deben imponer pasos adicionales a OpenCode, Codex o Gentle Shell.

## Reglas para agentes

Antes de modificar código:

1. identificar el proyecto y el `HOS-NNN` si existe;
2. consultar Linear de forma read-only y buscar una spec local relacionada;
3. escoger el nivel ODD adecuado según la tabla anterior;
4. usar `qz-*` para workflows genéricos y `hops-*` para el adapter de Hospeda;
5. cargar sólo los skills de dominio necesarios;
6. ejecutar la verificación adecuada y registrar el resultado.

Si el trabajo necesita una spec nueva, primero se crea o reutiliza el issue
Linear con `kind-needs-spec`; la etiqueta `kind-spec` sólo corresponde cuando
`spec.md` ya existe. Las tareas internas se promueven a Linear únicamente si
bloquean otro trabajo, requieren otro agente, sobreviven al alcance actual,
representan una decisión del dueño o afectan el roadmap.

## Qué hacer con documentación antigua

Los `CLAUDE.md` siguen en convivencia hasta completar la auditoría de contenido.
No se borran ni se toman como fuente superior por el solo hecho de existir. La
extracción hacia `.qz/knowledge/skills/` y la sincronización con los cuatro
clientes se valida mediante `qz-kit project sync --check --client all`.

La migración termina cuando cada regla útil tiene un único hogar, el flujo ODD
queda reflejado en la documentación activa y ningún cliente necesita leer un
`CLAUDE.md` residual para trabajar correctamente.
