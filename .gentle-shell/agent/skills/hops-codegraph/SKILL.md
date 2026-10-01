---
name: hops-codegraph
description: Exploración estructural opcional de Hospeda con CodeGraph.
triggers:
  - codegraph
  - exploración estructural
  - call graph
  - impacto de cambios
  - entender varios archivos
---

# CodeGraph en Hospeda

CodeGraph es una ayuda opcional para entender relaciones entre muchos archivos
o símbolos. No es un requisito del proyecto ni una dependencia del flujo de
issues.

## Uso

- Si el MCP `codegraph` está conectado y existe un índice `.codegraph/`, usalo
  primero para preguntas estructurales: `explore`, `node`, `impact`, `callers`
  y `callees`.
- Usá lectura y búsqueda exacta para confirmar la implementación, revisar
  contenido literal o trabajar cuando el MCP no esté disponible.
- No bloquees una tarea por falta de CodeGraph y no inventes resultados del
  índice. Indicá cuando una conclusión proviene sólo de búsqueda textual.
- Para cambios pequeños o un archivo ya localizado, no agregues la exploración
  del grafo por ceremonia.

## Alcance y seguridad

- La configuración del servidor y sus credenciales son externas al repositorio;
  nunca las copies a este skill ni a un archivo versionado.
- El índice es una caché local ignorada por Git; no lo uses como fuente de
  verdad técnica.
- La misma regla aplica a OpenCode, Claude, Codex y Gentle Shell: el skill
  describe una preferencia, pero cada harness puede usar su propio adapter MCP.
