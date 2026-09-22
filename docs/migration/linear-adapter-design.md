# Diseño del adaptador genérico de Linear

Fecha: 2026-09-15.

## Objetivo

Conservar la integración útil de Hospeda sin acoplarla a Claude, Gentle-AI ni a
un MCP concreto. El adaptador debe poder reutilizarse en otros repositorios con
configuración de equipo, estados y etiquetas.

## Capas

### Cliente Linear genérico

- transporte GraphQL;
- autenticación desde entorno/secret manager externo;
- timeout, reintentos acotados y errores estructurados;
- operaciones `getIssue`, `searchIssue`, `transitionIssue`, `addComment`,
  `listLabels` y `getPullRequestLinks`;
- nunca imprime tokens ni cuerpos completos de errores que puedan contenerlos.

### Contrato de workflow

- `start`: validar identificador, leer issue, derivar branch/slug y preparar un
  plan de worktree; la transición a In Progress es una mutación explícita.
- `close`: preflight completo, comprobar gates, preparar plan y luego marcar
  Done sólo con confirmación.
- `handoff`: registrar progreso sin marcar Done; commit y comentarios son pasos
  independientes.
- `stats`: lecturas agregadas y cache local opcional, sin mutaciones.

### Adaptador de proyecto

Hospeda aporta:

- equipo `HOS` y sus estados/labels;
- patrón `HOS-NNN` y reglas de branch;
- relación Linear ↔ `.specs`;
- gates de smoke y requisitos de PR;
- integración con `hops` y Engram.

Otro repositorio sólo debería reemplazar este adaptador, no el cliente ni la
máquina de estados.

La auditoría de los comandos globales confirma que `startIssue` y `closeIssue`
no son simples atajos de Linear. Incluyen contratos adicionales que deben
quedar explícitos en una futura capa genérica:

- `startIssue` exige issue existente, evita duplicar worktrees, corta desde
  `origin/staging`, cambia el estado a In Progress y registra el worktree;
- `closeIssue` es idempotente, bloquea estados ya cerrados, exige resolver gates
  de smoke, advierte si no hay PR mergeado, exige árbol limpio y sólo después
  puede marcar Done, guardar closeout y retirar el worktree;
- `handoff` puede crear commits y sincronizar estado, por lo que no debe
  confundirse con un diagnóstico read-only.

La API/CLI futura debe modelar estos pasos como operaciones separadas
(`preflight`, `plan`, `apply`, `read-back`) y no como una mutación monolítica
disparada por un prompt.

## Smoke como gate de dominio

El comando actual `/smoke` aporta invariantes que deben permanecer en el
adaptador Hospeda, independientemente del agente:

- nunca retirar un label `status-needs-smoke-*` sin escribir primero el comentario
  de evidencia;
- distinguir `local`, `staging` y `prod`, sin aceptar evidencia de staging para
  cerrar un gate de producción;
- distinguir resultado (`PASO`, `PARCIAL`, `FALLO`, `PENDIENTE`) de grado de
  evidencia (`ejecutado` o `declarado-de-memoria`);
- retirar sólo los labels satisfechos y cerrar únicamente cuando no quedan
  entornos requeridos;
- ante `FALLO`, conservar el gate, volver a In Progress y crear un issue de
  seguimiento enlazado.

Esto debe implementarse como una máquina de estados y validaciones del adaptador
Linear/Hospeda. Un command OpenCode puede recolectar respuestas y mostrar el
plan, pero no debe contener estas reglas dispersas en un prompt.

## MCP versus API/CLI

La recomendación es conservar API/CLI como camino determinista para `hops` y
usar MCP únicamente como interfaz opcional para el agente. Así los workflows
siguen funcionando aunque OpenCode, Gentle o un MCP cambien de versión. Las
mutaciones deben pasar por un comando/CLI que emita plan, autorización y
read-back.

## Seguridad

- credenciales sólo fuera del repositorio;
- lectura permitida por defecto en diagnóstico;
- escritura Linear, GitHub y Engram requiere autorización explícita;
- nunca fallback silencioso a otra cuenta o equipo;
- toda mutación devuelve ID, estado anterior y estado posterior;
- si el resultado es ambiguo, detenerse sin reintentar a ciegas.

## Migración

1. Extraer el cliente GraphQL actual de `scripts/client-tools` a una librería
   genérica.
2. Mantener `hops` como consumidor principal.
3. Implementar commands OpenCode finos que sólo llamen al adaptador.
4. Añadir MCP Linear sólo como superficie conversacional opcional.
5. Validar primero lecturas y dry-run; probar mutaciones en un issue de prueba
   con autorización explícita.

No se configuró Linear ni se ejecutaron consultas o mutaciones durante esta
etapa.
