# Evaluación de CodeGraph

Fecha: 2026-09-17.

## Estado observado

- CodeGraph CLI `1.1.2` está disponible en el PATH.
- Existen índices locales para Hospeda y Hospeda2. Sus archivos SQLite ocupan
  aproximadamente 344 MiB y 433 MiB respectivamente, sin abrir las bases en
  este gate.
- Los hooks Claude `codegraph-nudge.sh` y `codegraph-sync.sh` siguen presentes;
  son integración específica de Claude y no se deben copiar automáticamente a
  OpenCode.
- La ayuda confirma consultas de símbolos, impacto, callers/callees, MCP y
  daemon.
- No se ejecutaron `init`, `index`, `sync`, `daemon`, `install`, `uninstall` ni
  `upgrade` durante esta migración.

## Valor para Hospeda

CodeGraph resuelve navegación estructural e impacto de cambios en un monorepo.
Es complementario a Engram: CodeGraph responde “qué depende de este símbolo” y
Engram conserva decisiones y contexto narrativo. No deben compartir funciones ni
volcar consultas estructurales completas a memoria.

## Recomendación

Mantener CodeGraph como CLI externo en la primera instalación. Evaluar su MCP
después de validar:

1. compatibilidad con OpenCode V2 y Gentle;
2. latencia y tamaño de respuestas;
3. límites de filesystem y acceso a índices;
4. consumo de contexto frente a `rg`, TypeScript y herramientas nativas;
5. comportamiento por worktree y riesgo de índice obsoleto.

Si el MCP supera esas pruebas, habilitarlo sólo para el agente de exploración y
consultas explícitas de impacto. No instalar daemon global ni regenerar índices
como parte de `startIssue`.

## Decisión provisional

**Conservar CLI; MCP opcional posterior; no instalar ni regenerar ahora.** Esta
decisión evita duplicar contexto y mantiene CodeGraph independiente de Engram,
OpenCode y Gentle.
