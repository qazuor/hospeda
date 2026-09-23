# Ruta de cierre de la migración

Fecha: 2026-09-17.

El artifact actual tiene 87 puntos: 53 completos y 34 pendientes. Los
pendientes no representan 34 bloqueos equivalentes; varios son decisiones opcionales,
pruebas que requieren infraestructura o trabajo posterior a la adopción.

## Para considerar la migración operativa

1. Validar TUI en una terminal con filesystem escribible.
2. Aprobar el primer lote de Engram y probar restore en copia; la conexión MCP
   ya está validada, pero la curación sigue pendiente.
3. Completar la mutación futura de `close-issue` sólo después de validar el
   preflight read-only; mantener la
   mutación de Linear detrás de plan, confirmación y read-back.
4. Ejecutar worktree E2E cuando Docker/PostgreSQL estén disponibles: pass/env,
   puertos, DB y cleanup.
5. Restaurar los wrappers globales apuntando al checkout estable de `hops` y
   validarlos desde `hospeda-staging`.
6. Aprobar la decisión `.specs` + Linear con Gentle SDD sólo selectivo; no
   migrar masivamente mientras no haya evidencia de beneficio.
7. Endurecer permisos y pre-commit; definir allow/ask/deny.
8. El flujo de artifacts desde lenguaje natural ya está definido en la skill
   `visual-artifact` y en `/hops-artifact-create`: el agente investiga, produce
   `artifact/v1`, valida secretos y composición, y el renderer genera el HTML.
   Falta una prueba conversacional end-to-end con el agente y una fuente real
   como Linear antes de marcarlo como cierre definitivo.
9. Ejecutar los gates integrales y el rollback drill.

## Puede esperar sin bloquear el uso diario

- migración de artifacts históricos de Claude;
- GLM/DeepSeek/Ollama y OpenKilo;
- OpenChamber, browser, Octto, TokenScope, Senses, type-inject, voz y demás
  plugins;
- implementación completa de SDD híbrido y archive policy;
- retiro definitivo de Claude Code;
- automatización total del bootstrap con instalación y login.

## Bloqueos externos actuales

- El daemon Docker y PostgreSQL de prueba no están disponibles en cada sesión,
  por lo que el E2E de worktrees/DB debe repetirse en una sesión con servicios
  vivos antes del cierre definitivo.
- El filesystem global está montado read-only y OpenCode no puede completar la
  validación interactiva de logs/TUI hasta ejecutarse en un entorno escribible.
- La revisión de Engram requiere aprobación humana entrada por entrada o por
  lotes explícitamente definidos; no debe automatizarse.

## Plan acotado

El cierre se puede organizar en cuatro bloques: (A) decisiones humanas y
Engram, (B) permisos/providers/TUI, (C) `hops` + Linear + worktrees E2E, y (D)
artifacts + validación/rollback. Después de D se puede usar OpenCode/Gentle a
diario y tratar plugins, SDD avanzado y retiro de Claude como evolución
separada.
