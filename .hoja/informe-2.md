## Estado

PARCIAL. La composición de producción y el listener quedaron cableados; se verificaron PB2, T3→PB2→PB3 y la carrera PB1 contra PostgreSQL. Falta la matriz de tests de las rutas HTTP reales y el mapeo de todos sus rechazos; por eso AC:V6:2 y el gate A-C no quedan verdes. Parte D queda PENDIENTE según el alcance condicional.

## AC

- **AC:V6:1 — HECHO para el escenario de cobertura y restitución descrito.** Puertos transaccionales y recálculo en `apps/api/src/utils/listing-publication/ports.ts:20`; listener en `apps/api/src/utils/listing-publication/coverage-listener.ts:11`; arranque en `apps/api/src/index.ts:354`. `TEST:V6:1`: `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:239` ejecuta T3 real y el listener, baja la ficha publicada a `UNPUBLISHED_BY_BILLING`, restaura sólo esa ficha por PB3, y conserva la ficha DRAFT. La primera rama PB2 también verifica `inactiva_desde` en publicada, DRAFT y excedente preexistente (`:39`).
- **AC:V6:2 — PARCIAL.** PB1/T1 y traducción de errores están en `apps/api/src/services/listing-publication/listing-publication.service.ts:17` y `:91`; ruta real cableada en `apps/api/src/routes/accommodation/protected/publish.ts:56`; guard de completitud extraído en `packages/service-core/src/services/accommodation/accommodation.service.ts:2084`. `TEST:V6:2`: integración de dos PB1 con un cupo y T1 único en `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:125`, y casos unitarios de traducción en `apps/api/test/services/listing-publication/listing-publication.service.test.ts:5`. Falta la matriz HTTP con fábrica real para positivo autenticado, sin cobertura/trial, `UNPUBLISHED_BY_BILLING`, cupo y completitud; no se da por probada.
- **AC:V6:3 — PARCIAL.** El UoW usa el lock `trialMachineLockKey` y relee dentro de transacción en `apps/api/src/utils/listing-publication/ports.ts:28`; PB1 y el listener reutilizan estos puertos. `TEST:V6:3`: la carrera real PB1 está en `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:125`. No se probó toda la matriz de concurrencia de transiciones de la pieza.
- **AC:V6:4 — HECHO para la primera rama PB2.** El recálculo usa modelo y reloj reales vía `apps/api/src/utils/listing-publication/ports.ts:38`. `TEST:V6:4`: `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:39` verifica el instante en las tres fichas; el escenario T3 también está en `:239`. La rama de excedente pertenece a V6.3 y no se implementó.

## Archivos tocados (A/M/D y una línea)

- M `apps/api/src/index.ts`: suscribe una vez al listener en el inicio y lo desarma al apagar.
- M `apps/api/src/routes/accommodation/protected/publish.ts`: usa el servicio PB1, conservando el contrato de ruta.
- M `apps/api/src/routes/accommodation/protected/unpublish.ts`: usa el servicio PB6.
- A `apps/api/src/services/listing-publication/listing-publication.service.ts`: guard, T1/PB1/PB6 y traducción de rechazos.
- A `apps/api/src/utils/listing-publication/ports.ts`: transacción, lock, modelo, cobertura, límite, reloj y efectos post-commit.
- A `apps/api/src/utils/listing-publication/coverage-listener.ts`: suscripción idempotente, filtro de vertical, recálculo y captura de fallas.
- A `apps/api/test/routes/accommodation-protected-publish.test.ts`: adapta el test de ruta al servicio nuevo.
- A `apps/api/test/services/listing-publication/listing-publication.service.test.ts`: verifica traducciones de errores.
- A `apps/api/test/utils/listing-publication/coverage-listener.test.ts`: verifica suscripción, filtro y no-throw.
- A `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts`: integración DB de PB2, T3/PB2/PB3 y carrera PB1/T1.
- M `apps/api/vitest.config.integration.ts`: incluye la carpeta nueva de integración.
- M `packages/service-core/src/services/accommodation/accommodation.service.ts`: extrae la guarda pública manteniendo el uso de `publish()`.
- M `.hoja/progreso.md`: registro de pasos y gates.
- A `.hoja/informe-2.md`: resultado de esta corrida.

## Pedidos de alcance

Vacío.

## Preguntas

Vacío.

## Gates

- `./node_modules/.bin/tsc --noEmit --project apps/api/tsconfig.json`: OK.
- `./node_modules/.bin/biome check` sobre los archivos modificados de la implementación: OK; el test de integración extendido pasó `biome check --write` y queda sujeto a un check final.
- `pnpm --dir apps/api exec vitest run test/utils/listing-publication/coverage-listener.test.ts test/services/listing-publication/listing-publication.service.test.ts test/routes/accommodation-protected-publish.test.ts`: OK, 3 archivos y 11 tests.
- `pnpm --dir packages/service-core exec vitest run test/services/accommodation/publish.test.ts`: OK, 24 tests.
- `HOSPEDA_TEST_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@172.23.0.3:5432/postgres CI=false flock /home/qazuor/projects/WEBS/.hos1352-integration.lock pnpm --dir apps/api exec vitest run --config vitest.config.integration.ts test/integration/listing-publication/coverage-recalculation.test.ts`: OK, 1 archivo y 3 tests, incluye T3→listener→PB2, restitución PB3 y carrera PB1. El log registró un fallo best-effort de invalidación de caché que no interrumpió la transición.
- Mutación del listener (suprimir recálculo): el test de `coverage-listener` falló como se esperaba; archivo restaurado con `git checkout -- apps/api/src/utils/listing-publication/coverage-listener.ts`.
- Mutación de `subscription_required` (`FORBIDDEN`→`INTERNAL_ERROR`): el test del servicio falló como se esperaba; archivo restaurado con `git checkout -- apps/api/src/services/listing-publication/listing-publication.service.ts`.
- `pnpm check:guards`: primero detectó el ternario no exhaustivo; tras el arreglo con mapa exhaustivo y el commit correctivo, pasó.
- `UPDATE_ROUTE_MANIFEST=1 CI=true pnpm --filter hospeda-api exec vitest run test/route-manifest/route-manifest.test.ts`: no ejecutado; el manifiesto no cambió.
- Tests HTTP completos de rechazos y positivo autenticado: PENDIENTE; por ello las partes A-C no están totalmente verdes.
- Parte D / marcadores H-5: PENDIENTE, condición de entrada (gates A-C verdes) no satisfecha.
