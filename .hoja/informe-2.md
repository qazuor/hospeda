## Estado

PARCIAL. Quedó cableada la composición de producción, la ruta del dueño y el listener. Falta la integración API completa de T3→PB2→PB3 y la matriz API de rechazos/rutas; la corrida de integración actual espera el flock ocupado por otra hoja. No se tocó la parte D porque A-C todavía no están verdes.

## AC

- **AC:V6:1 — PARCIAL.** La composición de PB2/PB3 está en `apps/api/src/utils/listing-publication/ports.ts:20`; listener en `apps/api/src/utils/listing-publication/coverage-listener.ts:11`; wiring de arranque en `apps/api/src/index.ts:354`. `TEST:V6:1` parcial: `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:31` ejecuta PB2 real y sella tres fichas; falta hacer vencer T3 con el listener y luego probar la restitución PB3.
- **AC:V6:2 — PARCIAL.** PB1 y T1 se componen en `apps/api/src/services/listing-publication/listing-publication.service.ts:17`; mapeo de denegaciones en `:91`; ruta en `apps/api/src/routes/accommodation/protected/publish.ts:56`. `TEST:V6:2` parcial en `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:108` (dos PB1 reales con lock y T1) y `apps/api/test/services/listing-publication/listing-publication.service.test.ts:5` (mapeo); falta matriz de la ruta API real para cobertura, sin trial, `UNPUBLISHED_BY_BILLING` y guarda de completitud.
- **AC:V6:3 — PARCIAL.** El UoW toma `trialMachineLockKey` y enlaza el modelo en `apps/api/src/utils/listing-publication/ports.ts:28`; listener y PB1 reutilizan el mismo UoW. `TEST:V6:3` parcial en `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:108` para dos PB1; faltan las demás parejas API y el resultado de la corrida concurrente final, todavía bloqueada por flock.
- **AC:V6:4 — HECHO para la primera rama de PB2.** `recalculateCoverage` de la corrida 1 se compone con el modelo real en `apps/api/src/utils/listing-publication/ports.ts:38`. `TEST:V6:4` en `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts:31` verifica el reloj en `PUBLISHED`, `DRAFT` y `UNPUBLISHED_BY_BILLING` al perder cobertura. La rama del excedente no se implementó por pertenecer a V6.3.

## Archivos tocados (A/M/D y una línea)

- M `apps/api/src/index.ts`: instala el listener una vez al arrancar y lo desarma al apagar.
- M `apps/api/src/routes/accommodation/protected/publish.ts`: deriva PB1 al servicio fino y conserva analítica/schema/strip.
- M `apps/api/src/routes/accommodation/protected/unpublish.ts`: deriva PB6 al servicio fino.
- A `apps/api/src/services/listing-publication/listing-publication.service.ts`: guarda, T1/PB1/PB6, relectura y mapeo HTTP.
- A `apps/api/src/utils/listing-publication/ports.ts`: transacción, lock, modelo, cobertura, límite, reloj y efectos post-commit.
- A `apps/api/src/utils/listing-publication/coverage-listener.ts`: suscripción idempotente, filtro de vertical y captura de fallas.
- A `apps/api/test/routes/accommodation-protected-publish.test.ts`: actualiza el test de contrato HTTP al servicio de la ruta nuevo.
- A `apps/api/test/services/listing-publication/listing-publication.service.test.ts`: prueba mapeos de PB1.
- A `apps/api/test/utils/listing-publication/coverage-listener.test.ts`: listener, filtro y no-throw.
- A `apps/api/test/integration/listing-publication/coverage-recalculation.test.ts`: integración DB PB2, sellado de tres estados, PB1/T1 concurrente y PB6.
- M `apps/api/vitest.config.integration.ts`: incluye la carpeta de integración nueva.
- M `packages/service-core/src/services/accommodation/accommodation.service.ts`: extrae el guard público y `publish()` lo sigue llamando.
- M `.hoja/progreso.md`: historial de pasos.
- A `.hoja/informe-2.md`: este informe.

## Pedidos de alcance

Vacío.

## Preguntas

Vacío.

## Gates

- `./node_modules/.bin/tsc --noEmit --project apps/api/tsconfig.json`: OK.
- `./node_modules/.bin/biome check` sobre los 12 archivos de esta corrida: OK.
- `pnpm --dir apps/api exec vitest run test/utils/listing-publication/coverage-listener.test.ts test/services/listing-publication/listing-publication.service.test.ts test/routes/accommodation-protected-publish.test.ts`: OK, 3 archivos, 11 tests.
- `pnpm --dir packages/service-core exec vitest run test/services/accommodation/publish.test.ts`: OK, 1 archivo, 24 tests.
- `HOSPEDA_TEST_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@172.23.0.3:5432/postgres CI=false flock /home/qazuor/projects/WEBS/.hos1352-integration.lock pnpm --dir apps/api exec vitest run --config vitest.config.integration.ts test/integration/listing-publication/coverage-recalculation.test.ts`: una versión anterior de la integración pasó con 2 tests; la última versión añadió la carrera PB1 y quedó esperando el lock compartido, ocupado por otra hoja. Resultado de esa versión pendiente.
- Mutación del listener y mutación de `subscription_required`: pendientes hasta el commit requerido; `pnpm check:guards`: pendiente, debe correrse después del commit.
- Parte D / marcadores H-5: PENDIENTE; los gates A-C aún no están verdes.
