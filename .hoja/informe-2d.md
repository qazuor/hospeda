# HOS-1479 · corrida 2d · PR #3548

## Cuatro fallas de CI

1. **Verticals, typecheck e integración.** El test T3 del merge insertaba `inactiveSince: null` y omitía `deadlinesVersion`, aunque V6.9 exige ambos valores. Ahora inserta el instante fijo `2026-09-01T12:00:00Z` y versión 1; verifica ese instante y conserva la aserción de igualdad antes/después de T3. `rg -l` y revisión de todos los `insert(accommodations|gastronomies|experiences)` en tests de `packages/verticals`, `packages/service-core` y `apps/api` no hallaron otro `inactiveSince: null` ni una inserción sin las columnas nuevas.
2. **Unit shard 4.** El test de `publication_status.dbschema.test.ts` aún esperaba columnas nullable de V6.8a. Ahora afirma `NOT NULL` para `publication_status`, `inactive_since` y `deadlines_version` en las tres tablas. `deletion_announced_at` conserva su aserción nullable.
3. **Seed dual-write.** El commit `90fd42968e` agregó las columnas de publicación al seed inline de experiencias. La migración estructural `0148_cut_paso_3` ya escribe esas columnas en filas vivas (`packages/db/src/migrations/0148_cut_paso_3.sql:158-169`), pero el guard `scripts/check-seed-dual-write.sh:120-136` sólo acepta excepciones `demo-only` o `non-deterministic`; ninguna describe este cambio. Por eso se creó con `pnpm db:seed:make` la migración reservada `0111-hos1479-experience-publication-state`, que sincroniza el estado de los cinco slugs existentes sin insertar contenido de ejemplo. **No corresponde línea `[skip-seed-migration]` ni edición del cuerpo del PR.**
4. **E2E ACC-03.** El fixture crea la ficha con `publication_status='PUBLISHED'` (`apps/e2e/fixtures/api-helpers.ts:602-612`); el test cambiaba sólo `lifecycle_state` a `DRAFT`. La lectura pública usa un actor guest (`apps/api/src/routes/accommodation/public/getById.ts:45-61`) y `resolveEffectivePublicationStatus` prioriza todo estado escrito (`packages/verticals/src/authorization/listing-facts.ts:5-23`), así que la ficha seguía autorizada. El SQL directo del test ahora escribe `publication_status='DRAFT'` junto con `lifecycle_state='DRAFT'` (`apps/e2e/tests/accommodation/acc-03-unpublish.spec.ts:62-72`). Las aserciones de GET, lista y persistencia permanecen.

## Gates y salidas reales

- `CI=true pnpm --filter @repo/verticals typecheck`: exit 0.
- `CI=true pnpm --filter @repo/db typecheck`: exit 0.
- `CI=true pnpm --filter hospeda-api typecheck`: exit 0.
- `CI=true pnpm --filter @repo/seed typecheck`: exit 0 (adicional por la migración).
- `CI=true pnpm --filter @repo/db exec vitest run test/schemas/publication_status.dbschema.test.ts`: 1 archivo, 6 tests passed.
- Integración `@repo/verticals` bajo `flock /home/qazuor/projects/WEBS/.hos1352-integration.lock`, base indicada, `vitest.integration.config.ts test/integration/trial-machine-t3.integration.test.ts`: 1 archivo, 4 tests passed. El nombre `vitest.config.integration.ts` del pedido no existe en este paquete; el primer intento no cargó config. El segundo detectó una comparación `Date`/texto del driver, que se corrigió antes del pase final.
- `CI=true pnpm check:guards`: exit 0.
- `BASE_SHA=$(git merge-base origin/develop HEAD) bash scripts/check-seed-dual-write.sh`: exit 0; detectó baseline modificado y nueva data-migration en el diff commiteado.
- `CI=true pnpm exec biome check` sobre los cuatro archivos TS y `git diff --check`: exit 0.
- **ACC-03 E2E pendiente de ejecución:** el repositorio documenta un spec suelto en `apps/e2e/README.md:42-46`, pero la API local no estaba levantada (`curl` al puerto 18001 devolvió 000). `pnpm --filter hospeda-e2e e2e:up` falló antes de iniciar los servicios: Docker no pudo resolver `registry-1.docker.io` (`permission denied` de DNS) y no dispone localmente de `postgres:15-alpine`. No se ejecutó ningún test E2E; la corrección se fundamenta en la cadena de código anterior.

## Commits de código

- `e35e625aa9824daf97b6bb0e5d73a7f422828c45` · T3.
- `64a8a7eb8b6110607b434fa67441012389dca1b2` · test de esquema.
- `63ffc8b43ff243090db15013e5e684c8a8d19768` · migración de seed.
- `5e32f5fe7b98e7e08ad6822ca81219e1c4db4e9f` · ACC-03.

Estos SHAs y el commit del presente informe se pushean juntos a `origin/feat/HOS-1479-v69-migracion-paso3`; el SHA del informe consta en el `git log origin/...` de la verificación final.

## Hallazgo adicional al verificar CI remoto

La primera corrida sobre `183780a23d` pasó Build, Lint, Guards, Typecheck, Integration Tests y E2E P0. `Unit Tests (shard 2/5)` encontró otro fixture de `packages/service-core/test/services/experience/experience.service.test.ts` sin las columnas nuevas: `makeExperienceEntity` omitía `publicationStatus`, `inactiveSince` y `deadlinesVersion`; el caso «should allow owner to view their own PRIVATE listing» recibía `NOT_FOUND` porque `readListingAccessFacts` no podía resolver un estado escrito. El fixture ahora deriva el estado de lifecycle/visibility, agrega fecha y versión, y tipa los overrides como `Partial<Experience>`; completó `adminInfo.favorite` donde ese tipo lo exige. La aserción de acceso se conservó. Gates adicionales: archivo focalizado, 1 archivo y 31 tests passed; `CI=true pnpm --filter @repo/service-core typecheck`, exit 0; Biome, exit 0 (cuatro warnings de supresiones preexistentes). Commit: `c8192288e1`.

La segunda corrida sobre `9262d435bb` pasó Integration Tests, E2E P0 y Typecheck, pero `Unit Tests (shard 4/5)` mostró cuatro aserciones de `accommodation.permissions.test.ts` aún alimentadas por una ficha mock sin estado V6.9. Se agregó `MockAccommodation` al factory con las tres columnas nuevas y se derivó su estado de lifecycle, visibility y restricciones. Los casos que cambian lifecycle o restricciones después de crear el mock escriben también `publicationStatus: DRAFT`, para conservar la coherencia del fixture y sus aserciones de acceso. Gates: 1 archivo focalizado, 48 tests passed; `CI=true pnpm --filter @repo/service-core typecheck`, exit 0; Biome y `git diff --check`, exit 0. Commit: `2c51de67df`.
