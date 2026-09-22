# Paquete para aprobación humana — Engram

Fecha: 2026-09-17.

Este documento prepara la revisión humana posterior a la instalación limpia.
No autoriza borrados, importaciones, merges, consolidaciones ni cambios en la
DB activa.

## Estado que se revisará

- DB activa: 9.754 observaciones, 11.801 sesiones, 55 proyectos, 23 tipos y 2
  scopes.
- Integridad SQLite: correcta en copia read-only.
- Referencias observación→sesión huérfanas: 97, preexistentes y sin reparar.
- Métricas de ruido: 33 filas sin contenido, 16 sin título, 1 grupo de hash
  duplicado (33 filas) y 259 grupos de títulos repetidos (1.445 filas).
- Concentración: `tmp`/pasivo 5.257; sin proyecto 1.103; `hospeda` 1.990;
  `hospeda2` 963.

Los números sólo priorizan; no son criterio de eliminación.

## Orden de aprobación

1. Lote A: vacíos/sin título.
2. Lote B: hash duplicado.
3. Lote C: `tmp` y pasivo.
4. Lote D: sin proyecto.
5. Lote E: títulos repetidos.
6. Lote F: memorias durables de Hospeda.
7. Lote G: Hospeda2 y worktrees históricos.

Cada decisión se registra por ID en una copia de trabajo con una de estas
clasificaciones: `vigente`, `vigente-con-ajuste`, `histórica`, `contradicha`,
`duplicada`, `ruidosa` o `secreta`.

## Reglas de aprobación

- Nunca aprobar por título, fecha, tipo o hash solamente.
- Toda entrada que cambie comportamiento requiere evidencia actual y
  aprobación explícita.
- Las entradas con posible secreto quedan fuera y no se muestran en reportes.
- Las reglas estables se destinan a skills/`AGENTS.md`; el estado operativo va
  a Linear o specs; Engram conserva decisiones duraderas y gotchas verificados.
- La DB original, sus archivos auxiliares y el backup binario permanecen
  intactos hasta completar una prueba de restore y una búsqueda comparativa.

## Resultado esperado

La aprobación no moverá datos directamente. Autorizará un lote concreto, su
destino y el procedimiento reversible. Después se ejecutará sobre una copia,
se verificará la búsqueda y recién entonces se evaluará una importación o
activación controlada.

## Prueba de copia — 2026-09-17

Se copió temporalmente todo `~/.engram` incluyendo DB, WAL, SHM y metadatos.
Sobre esa copia, `sqlite3 -readonly` devolvió `PRAGMA integrity_check = ok` y
modo de journal `wal`; se calcularon checksums de los tres archivos. El comando
`engram doctor --json` no terminó dentro de 20 segundos porque intenta consultar
actualizaciones de GitHub y la resolución de red estaba indisponible. No se
considera fallo de la DB ni se ejecutó ningún comando mutante.
