---
name: hospeda-services
description: Reglas para service-core, servicios CRUD, contexto, errores, validación y logging de Hospeda.
triggers:
  - packages/service-core
  - BaseCrudService
  - servicio de dominio
  - ServiceError
  - CRUD service
---

# Hospeda Services

Usá este skill cuando el cambio toque `packages/service-core` o servicios de
entidad utilizados por API, jobs o tareas de dominio.

## Reglas

- El servicio concentra lógica de dominio; la ruta sólo coordina HTTP.
- Usá `BaseCrudService` y su contexto cuando el caso encaje en el patrón.
- Conservá result types, errores tipados y códigos estables.
- Validá entradas en el límite y no confíes en datos ya tipados por el llamador.
- Respetá actor, permisos, tenant y contexto de request.
- Logging estructurado debe incluir contexto útil sin payloads sensibles.
- Extensiones específicas deben ser pequeñas y cubrir invariantes de negocio.
- Las autorizaciones se expresan con `PermissionEnum` granular; no uses el rol
  como bypass, incluso para operaciones administrativas.
- Un override de permiso administrativo debe conservar la llamada a `super` y
  su orden; agregá un test de orden cuando exista.
- Las llamadas externas quedan fuera de `withServiceTransaction`; compartí
  datos entre hooks mediante `ctx.hookState`, no mediante estado mutable del
  servicio.

## Testing

- Probá éxito, not-found, conflicto, autorización, validación y fallas de
  persistencia según el servicio.
- Recordá que mocks completos de DB pueden ocultar errores de integración.
- Si cambia una transacción o query, agregá una prueba que llegue al camino real.
- Usá `qz-verify --changed` como primer gate.

## Checklist

- [ ] La lógica quedó en el servicio correcto.
- [ ] Resultados y errores conservan el contrato.
- [ ] Actor/permisos/contexto se preservan.
- [ ] Logging no expone secretos.
- [ ] Tests unitarios e integración relevantes pasaron.
