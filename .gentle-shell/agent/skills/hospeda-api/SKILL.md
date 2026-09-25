---
name: hospeda-api
description: Reglas específicas para desarrollar y verificar `apps/api` de Hospeda con Hono, factories de rutas, auth, servicios y PostgreSQL.
triggers:
  - apps/api
  - rutas Hono
  - middleware API
  - OpenAPI
  - autorización
  - errores de API
  - tests de rutas
---

# Hospeda API

Usá este skill cuando el cambio toque `apps/api`, rutas HTTP, middleware,
autenticación/autorización, contratos OpenAPI, servicios invocados por la API o
sus pruebas.

## Fuente de verdad

- Reglas detalladas históricas: `apps/api/CLAUDE.md` durante la transición.
- Rutas y registro: `apps/api/src/routes/`.
- Factories: `apps/api/src/lib/route-factory/`.
- Servicios compartidos: `packages/service-core/`.
- Contratos Zod: `packages/schemas/`.
- Variables registradas: `packages/config/` y `apps/api/.env.example`.

No copies contenido de `CLAUDE.md` sin verificarlo contra el código actual. Cada
regla migrada debe quedar aquí o en un documento enlazado, pero no duplicada en
varios skills.

## Arquitectura de rutas

- Preferí las factories existentes para conservar respuesta, validación,
autorización, OpenAPI y manejo de errores uniforme.
- Separá rutas simples de health/info, rutas CRUD OpenAPI y rutas paginadas.
- Registrá las rutas en el índice correspondiente; una ruta nueva que no se
registra no existe para la aplicación.
- Mantené la estructura por entidad y evitá handlers monolíticos.
- Validá params, query y body con Zod antes de invocar servicios.

## Actor, auth y permisos

- Obtené el actor desde el contexto de auth existente; no reconstruyas sesiones
manualmente en cada handler.
- Aplicá la cadena de middleware en el orden definido por la factory.
- No agregues bypass de permisos para facilitar tests o desarrollo.
- Los bypass de staff/admin sólo pueden seguir las invariantes ya declaradas en
el código y sus pruebas.
- Nunca registres tokens, cookies, secretos ni payloads sensibles.

## Respuestas y errores

- Conservá el contrato de respuesta estándar de la API.
- Usá `ServiceError` y sus códigos; no devuelvas errores ad-hoc desde cada ruta.
- Diferenciá errores de validación, autenticación, autorización, conflicto,
not-found y fallas internas.
- No filtres detalles de infraestructura al cliente.

## Servicios y base de datos

- La ruta coordina HTTP; la lógica de dominio vive en servicios.
- Reutilizá `packages/service-core` y los servicios de entidad antes de crear
queries locales.
- Usá transacciones cuando una operación modifica varias entidades relacionadas.
- Respetá los contratos de `packages/db` y `packages/schemas`; no dupliques
schemas Zod dentro de handlers.
- Si el cambio altera esquema o migraciones, activá también el skill de DB.

## Testing y verificación

- Antes de declarar listo un cambio, ejecutá el test específico de la ruta o
servicio y el guard correspondiente.
- Recordá que algunos tests de rutas mockean `@repo/db` completo: un test verde
puede no alcanzar el handler real.
- Verificá casos de auth, autorización, validación, errores y paginación según
corresponda.
- Para cambios acotados preferí `qz-verify --changed`; ampliá la verificación
si cambia un contrato compartido.
- Si una prueba depende de servicios externos, marcá qué quedó verificado y qué
quedó pendiente.

## Checklist

- [ ] La ruta usa la factory y middleware adecuados.
- [ ] Params/query/body están validados con el schema correcto.
- [ ] El actor y los permisos se obtienen mediante la infraestructura existente.
- [ ] La lógica de dominio no quedó duplicada en el handler.
- [ ] Respuestas y errores conservan el contrato común.
- [ ] Tests cubren éxito, validación y autorización relevantes.
- [ ] No se expusieron secretos ni datos sensibles.
