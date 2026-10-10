# Corrida E — HOS-1457 V5.3 / Coord-54

## Resultado

- Extraje el alta de trial del seed a `apps/e2e/fixtures/listing-owner-trial.ts`. Selecciona la versión trial vigente, el piso de entitlements de mayor rango y el piso de límites de menor rango de la vertical; conserva días, estado `TRIAL_ACTIVE`, pseudónimo y versión de deadlines del seed anterior.
- `apps/e2e/seeds/e2e-seed.ts:107-109` usa la función compartida para dueños de alojamiento, gastronomía y experiencias.
- `apps/e2e/fixtures/api-helpers.ts:623` la usa después de insertar un alojamiento, antes de devolverlo. La función retorna sin cambiar un trial existente y usa `ON CONFLICT (user_id, vertical) DO NOTHING` para concurrencia.
- Revisé `apps/e2e/fixtures/`: no hay helpers que creen dueños o listings de gastronomía o experiencias. `listing-editor-helpers.ts` opera editores existentes.

## Evidencia y gates

- Lectura: `apps/e2e/tests/accommodation/acc-02-edit-revalidation.spec.ts:54-62` crea el HOST y llama a `createAccommodation`; `apps/e2e/tests/resilience/res-06-concurrent-edit.spec.ts:48-56` hace lo mismo. Ambos reciben el trial antes de ejecutar PATCH. El resolver y el 403 no se probaron en ejecución.
- `pnpm --filter hospeda-e2e typecheck`: pasó.
- `pnpm --filter hospeda-e2e lint`: pasó con una advertencia preexistente `noDocumentCookie` en `apps/e2e/fixtures/browser-helpers.ts:38`.
- `git diff --check`: pasó.
- No corrí Playwright ni tests de integración, según el alcance indicado. No se tocó la base compartida.

## Límite observado

`apps/e2e/support/test-cleanup.ts:48-57` no incluye `trial` en `CLEANUP_TABLES`. Por lectura, el teardown individual deja la fila de trial de un usuario creado durante el spec; el reset de la base E2E al comienzo de la suite la elimina. Corregir ese teardown requiere ampliar el alcance fuera de `fixtures/` y `seeds/`.
