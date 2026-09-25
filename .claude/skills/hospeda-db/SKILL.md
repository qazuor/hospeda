---
name: hospeda-db
description: Reglas para Drizzle, PostgreSQL, migraciones, transacciones, queries y bases por worktree en Hospeda.
triggers:
  - packages/db
  - Drizzle
  - PostgreSQL
  - migración de base
  - schema DB
  - query SQL
  - template database
---

# Hospeda DB

Usá este skill cuando el cambio toque `packages/db`, schemas Drizzle, migraciones,
queries, transacciones, seeds dependientes de estructura o bases de worktrees.

## Fuente de verdad

- Reglas de transición: `packages/db/CLAUDE.md`.
- Schemas: `packages/db/src/schemas/`.
- Migraciones: `packages/db/src/migrations/` y `packages/db/src/migrations/extras/`.
- Config del adapter: `.qz/project.json`.
- Seeds: `packages/seed/`.

## Reglas de cambios

- Determiná primero si el cambio es schema, migración versionada, extra idempotente
  o sólo query.
- No edites una migración ya aplicada para corregir historia.
- Las migraciones Drizzle generadas van en `src/migrations/`; las extras escritas
  a mano deben ser idempotentes y documentar su motivo.
- Preservá relaciones, índices, constraints, nombres y tipos existentes.
- Preferí query builder y modelos compartidos; SQL crudo sólo cuando sea necesario
  y con parámetros seguros.
- Operaciones que modifican varias entidades deben usar transacción.

## Worktrees y template

- La base de cada worktree puede salir del template declarado por el adapter.
- Antes de usar un template, verificá su fingerprint contra schemas, migraciones,
  seeds y configuración de billing.
- Si el fingerprint no coincide, no ocultes el drift: reconstruí o marcá el
  template como obsoleto según el workflow del proyecto.
- Nunca conectes una prueba o desarrollo local a producción.

## Verificación

- Ejecutá tests del paquete y validá migraciones en una base descartable.
- Revisá reversibilidad, datos existentes y compatibilidad con seeds.
- Para cambios acotados usá `qz-verify --changed`; para schema ampliá la prueba.
- Reportá explícitamente qué se probó y qué requiere una base real.
- No muestres URLs, passwords ni valores de variables de entorno.

## Checklist

- [ ] Se eligió el carril correcto de migración.
- [ ] No se reescribió historia aplicada.
- [ ] Relaciones, índices y constraints siguen cubiertos.
- [ ] Queries parametrizadas y transacciones correctas.
- [ ] Template/fingerprint de worktree considerados.
- [ ] Tests y migración verificadas sin tocar producción.
