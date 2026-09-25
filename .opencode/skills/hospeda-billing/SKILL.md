---
name: hospeda-billing
description: Reglas de billing, entitlements, límites, trial y sincronización comercial de Hospeda.
triggers:
  - billing
  - entitlements
  - límites comerciales
  - trial
  - suscripción
  - packages/billing
---

# Hospeda Billing

Usá este skill cuando el cambio toque billing, planes, entitlements, límites,
trial, suscripciones o sincronización entre verticales.

## Reglas

- Tratá capability y capa comercial como conceptos separados.
- Conservá la matriz de límites y sus claves; agregá cambios de forma exhaustiva.
- Verificá que configuración, schema, servicio, API, UI y seeds compartan el
  mismo contrato.
- No agregues gates fantasma ni bypasses permanentes para hacer pasar tests.
- Invalidaciones de cache y cambios de estado deben respetar las invariantes
  existentes.
- Las tres verticales deben conservar paridad cuando la regla sea común.

## Verificación

- Probá límites, trial, upgrades, cancelación, estados inválidos y bypass de
  staff donde corresponda.
- Revisá snapshots/matrices de gates y ambos caminos de integración.
- Confirmá que los cambios no rompen fixtures o entitlements existentes.
- Reportá diferencias entre comportamiento leído y comportamiento ejercitado.

## Checklist

- [ ] Matriz y metadata de límites exhaustivas.
- [ ] Capability y comercial no quedaron acoplados accidentalmente.
- [ ] Cache, estados y bypasses respetan invariantes.
- [ ] Las verticales relevantes mantienen paridad.
- [ ] Tests de límites y transiciones pasaron.
