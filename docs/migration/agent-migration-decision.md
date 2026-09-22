# Decisión sobre agentes

Fecha: 2026-09-15.

El repositorio tiene 17 agentes Claude project-locales. La mayoría son perfiles
largos que repiten conocimiento de stack y conceden Read/Write/Edit/Bash. Ese
patrón tiene costo de contexto y aumenta superficie de permisos.

## Conservar como agentes explícitos

- **debugger**: investigación de fallos con evidencia y reproducción.
- **code-reviewer**: revisión independiente, sólo cuando se solicita.
- **qa-engineer**: validación de aceptación y pruebas, después de implementar.
- **tech-lead**: revisión arquitectónica puntual para cambios transversales.

Estos cuatro roles son decisiones de proceso, no sólo conocimiento técnico.

## Convertir principalmente en skills

- `astro-engineer`, `hono-engineer`, `db-drizzle-engineer`,
  `tanstack-start-engineer`, `react-senior-dev`, `node-typescript-engineer`;
- `devops-engineer`, `ux-ui-designer`, `content-writer`.

Sus patrones de stack deben cargarse bajo demanda. Un agente general puede usar
la skill adecuada sin crear una delegación adicional.

## Reemplazar por workflow/skill de Gentle

- `product-functional` y `product-technical`: cubrirlos con explore/propose/
  design/spec de SDD sólo cuando la feature lo necesite.
- `design-reviewer`: usarlo como revisión especializada bajo demanda, no como
  agente residente.
- `design-cloner`: mantenerlo sólo para tareas visuales concretas con browser o
  referencias, no como parte del flujo diario.

## Reglas de migración

- No migrar los 17 perfiles como agentes OpenCode 1:1.
- No conservar modelos `sonnet`/`opus` como decisión: el routing futuro será
  explícito por provider/modelo.
- Reducir permisos: los agentes de lectura/revisión no deben recibir Bash o
  edición salvo que la tarea lo justifique.
- Preferir un agente con una skill cargada frente a una cadena de subagentes.
- Medir frecuencia real antes de crear agentes adicionales.

La primera configuración Hospeda debería arrancar con los agentes nativos de
Gentle y sólo agregar `debugger`, `reviewer` y `qa` si los workflows reales
demuestran que aportan valor separado.
