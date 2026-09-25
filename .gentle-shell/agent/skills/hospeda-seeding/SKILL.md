---
name: hospeda-seeding
description: Reglas para seeds, fixtures deterministas, datos de prueba y sincronización de datos de Hospeda.
triggers:
  - packages/seed
  - seed
  - fixture
  - datos de prueba
  - usuarios de test
  - base inicial
---

# Hospeda Seeding

Usá este skill cuando el cambio toque `packages/seed`, fixtures, datos iniciales
o preparación de bases para tests y worktrees.

## Reglas

- Separá seeds requeridos de ejemplos y fixtures específicos de una prueba.
- Mantené datos deterministas: ids, relaciones y resultados reproducibles.
- Respetá la regla dual-write cuando una entidad se replica entre fuentes.
- No uses Faker o aleatoriedad para datos que una prueba deba localizar.
- Actualizá seeds cuando un cambio de schema o una nueva invariante los vuelva
  inválidos.
- Nunca incluyas credenciales reales, tokens o datos personales reales.

## Verificación

- Ejecutá seeds en una base descartable y repetilos para comprobar idempotencia.
- Verificá usuarios, roles, permisos, billing y fixtures de las verticales que
  toque el cambio.
- Confirmá que el template de worktree puede reconstruirse con los datos actuales.
- Usá `qz-verify --changed` y reportá qué datos fueron realmente comprobados.

## Checklist

- [ ] Seed requerido y fixture de ejemplo están separados.
- [ ] Datos deterministas e idempotentes.
- [ ] Roles, permisos y billing siguen válidos.
- [ ] No hay secretos ni PII real.
- [ ] Repetición y base descartable verificadas.
