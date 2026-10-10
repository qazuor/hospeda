## Estado

HECHO. El helper y las 13 rutas de estadísticas quedaron cableados al conjunto efectivo; los gates dirigidos y las verificaciones de mutación pasaron.

## AC

AC:V5:27 en las rutas de esta corrida. Ninguna de estas lecturas pide cupo (paso 7); cada fila de `TEST:V5:32` está en `apps/api/test/routes/commercial-gates.stats.test.ts`.

- `GET /views/accommodations/me`: `view_basic_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/views/protected/accommodations-me.ts:55`; fila `:94`.
- `GET /views/accommodations/me/daily-series`: `view_basic_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/views/protected/daily-series.ts:58`; fila `:104`.
- `GET /conversations/me/monthly-inquiries`: `view_basic_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/conversations/protected/monthly-inquiries.ts:68`; fila `:114`.
- `GET /conversations/me/response-rate`: `view_basic_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/conversations/protected/response-rate.ts:57`; fila `:124`.
- `GET /accommodations/my/favorites-breakdown`: `view_advanced_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/accommodation/protected/hostFavoritesBreakdown.ts:55`; fila `:134`.
- `GET /accommodations/my/market-comparison`: `view_advanced_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/accommodation/protected/hostMarketComparison.ts:70`; fila `:144`.
- `GET /gastronomies/mine/views`: `view_basic_stats`, GASTRONOMY, sin cupo; `apps/api/src/routes/gastronomy/protected/viewStats.ts:56`; fila `:154`.
- `GET /gastronomies/mine/views/daily-series`: `view_basic_stats`, GASTRONOMY, sin cupo; `apps/api/src/routes/gastronomy/protected/viewStatsDailySeries.ts:50`; fila `:163`.
- `GET /experiences/mine/views`: `view_basic_stats`, EXPERIENCE, sin cupo; `apps/api/src/routes/experience/protected/viewStats.ts:56`; fila `:172`.
- `GET /experiences/mine/views/daily-series`: `view_basic_stats`, EXPERIENCE, sin cupo; `apps/api/src/routes/experience/protected/viewStatsDailySeries.ts:50`; fila `:181`.
- `GET /gastronomies/{id}/menu-qr`: `menu_qr_scan_metrics`, GASTRONOMY, sin cupo; `apps/api/src/routes/gastronomy/protected/menuQr.ts:157 (step6Key)`; fila `:190`.
- `GET /gastronomies/{id}/menu-qr/scans`: `menu_qr_scan_metrics`, GASTRONOMY, sin cupo; `apps/api/src/routes/gastronomy/protected/menuQrScans.ts:109 (step6Key)`; fila `:200`.
- `GET /host/dashboard`: `view_basic_stats`, ACCOMMODATION, sin cupo; `apps/api/src/routes/host/protected/dashboard.ts:199`; fila `:210` y caso adicional de `plan: null` en `:290`.

## Archivos tocados

- A `apps/api/src/utils/listing-access/user-gate.ts`: centraliza pasos 6 y 7 para usuario y lectura booleana con falla cerrada.
- M `apps/api/src/routes/views/protected/accommodations-me.ts`: exige estadísticas básicas efectivas.
- M `apps/api/src/routes/views/protected/daily-series.ts`: exige estadísticas básicas efectivas.
- M `apps/api/src/routes/conversations/protected/monthly-inquiries.ts`: exige estadísticas básicas efectivas.
- M `apps/api/src/routes/conversations/protected/response-rate.ts`: exige estadísticas básicas efectivas.
- M `apps/api/src/routes/accommodation/protected/hostFavoritesBreakdown.ts`: exige estadísticas avanzadas y declara el permiso previo que el servicio ya exigía.
- M `apps/api/src/routes/accommodation/protected/hostMarketComparison.ts`: exige estadísticas avanzadas y declara el permiso previo que el servicio ya exigía.
- M `apps/api/src/routes/host/protected/dashboard.ts`: exige estadísticas básicas fuera del `catch`; conserva `plan: null`.
- M `apps/api/src/routes/gastronomy/protected/viewStats.ts`: exige estadísticas básicas de GASTRONOMY.
- M `apps/api/src/routes/gastronomy/protected/viewStatsDailySeries.ts`: exige estadísticas básicas de GASTRONOMY.
- M `apps/api/src/routes/experience/protected/viewStats.ts`: exige estadísticas básicas de EXPERIENCE.
- M `apps/api/src/routes/experience/protected/viewStatsDailySeries.ts`: exige estadísticas básicas de EXPERIENCE.
- M `apps/api/src/routes/gastronomy/protected/menuQr.ts`: declara `READ_OWN_COMMERCIAL` con la clave de QR y evita duplicar propiedad.
- M `apps/api/src/routes/gastronomy/protected/menuQrScans.ts`: declara el mismo acceso para el agregado de scans.
- A `apps/api/test/utils/listing-access/user-gate.test.ts`: cubre clave, cupo, orden, alcance de usuario y falla cerrada.
- A `apps/api/test/routes/commercial-gates.stats.test.ts`: 13 filas de rutas, prioridades de errores y caso adicional de dashboard.
- M `apps/api/test/routes/views/protected/accommodations-me.test.ts`: fixture de conjunto efectivo para que los tests de handler lleguen al servicio.
- M `apps/api/test/routes/views/protected/daily-series.test.ts`: mismo motivo.
- M `apps/api/test/routes/conversations/protected/response-rate.test.ts`: mismo motivo.
- M `apps/api/test/routes/accommodation/protected/host-favorites-breakdown.test.ts`: fixture de `view_advanced_stats` para conservar las pruebas de servicio.
- M `apps/api/test/routes/host/dashboard.test.ts`: fixture de `view_basic_stats` para conservar las pruebas de respuesta y degradación.
- M `apps/api/test/routes/gastronomy/protected/menu-qr.test.ts`: fixtures de hechos de ficha y clave efectiva para conservar los casos de QR y 404.
- M `apps/api/test/routes/gastronomy/protected/menu-qr-scans.test.ts`: mismos fixtures para conservar scans, cero histórico y 404.
- A `.hoja/progreso.md`: registro de pasos requerido por la hoja; no commiteado.
- A `.hoja/informe.md`: este informe; no commiteado.

## Defaults usados

- H-1: alcance limitado a las 13 rutas de estadísticas de esta corrida.
- H-2: `enforceUserGate` evalúa cada clave por separado (todas obligatorias) y luego el cupo; `readEffectiveKeys` devuelve booleanos sin 403.
- H-3: el helper evalúa sólo pasos 6 y 7; no consulta cobertura.
- H-4: cada estadística usa la vertical de su función y el `userId` del actor; QR usa GASTRONOMY y el dueño que resuelve `listingAccess`.
- H-6: dashboard pide sólo `view_basic_stats`; `plan` queda `null`, como lectura de datos separada del gate.
- H-12: el helper importa `ServiceError` de la raíz de `@repo/service-core`, igual que `middlewares/listing-access.ts`; las rutas reales de gastronomía y experiencia devolvieron 403.
- H-18: QR usa `READ_OWN_COMMERCIAL` por ficha; `/mine/views` usa el helper de usuario.

## Pedidos de alcance

Vacío. El guard de cobertura de escritura pasó sin cambios; QR y scans son lecturas.

## Preguntas

Vacío.

## Gates

- `CI=true pnpm --filter hospeda-api typecheck`: pasó, incluido después del último commit.
- `CI=true pnpm --filter hospeda-api lint`: pasó; 23 advertencias preexistentes de supresiones sin efecto, ninguna en archivos tocados.
- `CI=true pnpm --filter hospeda-api exec vitest run test/utils/listing-access/user-gate.test.ts test/routes/commercial-gates.stats.test.ts test/routes/coverage-step.protected.test.ts test/routes/content-gates.gastronomy-experience.test.ts`: 179 tests pasaron antes del caso adicional de dashboard; después, `CI=true pnpm --filter hospeda-api exec vitest run test/routes/commercial-gates.stats.test.ts`: 48 pasaron.
- `CI=true pnpm --filter hospeda-api exec vitest run test/routes/coverage-step-coverage.guard.test.ts test/routes/content-edit-gate-coverage.guard.test.ts test/utils/error-contract.guard.test.ts test/middlewares/listing-access.test.ts`: 160 pasaron después de los commits.
- `CI=true pnpm --filter hospeda-api exec vitest run test/routes/views/protected/accommodations-me.test.ts test/routes/views/protected/daily-series.test.ts test/routes/conversations/protected/response-rate.test.ts test/routes/conversations/protected/monthly-inquiries.test.ts test/routes/accommodation/protected/host-favorites-breakdown.test.ts test/routes/accommodation/protected/host-market-comparison.test.ts test/routes/host/dashboard.test.ts test/routes/gastronomy/protected/menu-qr.test.ts test/routes/gastronomy/protected/menu-qr-scans.test.ts`: 63 tests pasaron en 7 archivos existentes; los dos nombres de archivo ausentes no se ejecutaron. `git ls-files 'apps/api/test/**/*[vV]iew*[sS]tats*'` no devolvió archivos.
- `CI=true pnpm --filter hospeda-api exec vitest run test/utils/listing-access/user-gate.test.ts test/routes/commercial-gates.stats.test.ts`: 56 pasaron tras restaurar las mutaciones a-d; 57 pasaron después del caso adicional de dashboard y del ajuste final del `warn`.
- `rg 'bootstrap' apps/api/src/utils/listing-access`: sólo encontró el vínculo ya existente en `ports.ts` y el lector bootstrap existente; el helper nuevo no importa bootstrap. G13 no se ejecutó por instrucción de la hoja.
- Una invocación de `pnpm --filter hospeda-api exec biome check --write` disparó el `prepare` de pnpm, que regeneró `packages/i18n/src/types.ts` con contenido idéntico; `git status` no mostró cambios fuera de `permitidas.txt`. Las correcciones de formato posteriores usaron `node_modules/.bin/biome` directamente.
- `git grep -n 'HOS-1352: transitional until V3' -- apps/api/src/routes/views/protected/accommodations-me.ts apps/api/src/routes/views/protected/daily-series.ts apps/api/src/routes/conversations/protected/monthly-inquiries.ts apps/api/src/routes/conversations/protected/response-rate.ts apps/api/src/routes/accommodation/protected/hostFavoritesBreakdown.ts apps/api/src/routes/accommodation/protected/hostMarketComparison.ts apps/api/src/routes/host/protected/dashboard.ts apps/api/src/routes/gastronomy/protected/viewStats.ts apps/api/src/routes/gastronomy/protected/viewStatsDailySeries.ts apps/api/src/routes/gastronomy/protected/menuQr.ts apps/api/src/routes/gastronomy/protected/menuQrScans.ts apps/api/src/routes/experience/protected/viewStats.ts apps/api/src/routes/experience/protected/viewStatsDailySeries.ts`: salida vacía (exit 1 esperado).
- Mutación (a): `user-gate.ts` pidió la clave con otro `userId`; el comando de dos tests nuevos ejecutó 56, fallaron 12 (uno del unit y 11 filas de ruta). Restaurada.
- Mutación (b): `hostMarketComparison.ts` pidió `view_basic_stats`; `commercial-gates.stats.test.ts` ejecutó 47, falló 1: el dueño básico recibió 200 en vez de 403. Restaurada.
- Mutación (c): `gastronomy/protected/viewStats.ts` usó ACCOMMODATION; el mismo test ejecutó 47, falló 1 por vertical incorrecta. Restaurada.
- Mutación (d): `menuQr.ts` perdió `step6Key`; el mismo test ejecutó 47, fallaron 2 por respuestas 500. Restaurada.
- Mutación (e): se agregó el marcador en `accommodations-me.ts`; el `git grep` final lo detectó en línea 3. Esta verificación es estática y no ejecuta tests; no se agregó el guard de AC:V5:29, que pertenece a HOS-1645. Restaurada; la salida final volvió a ser vacía.

## Commits

- `a2a8562a9553e0cbe47fe384344dced3b935e0e5` feat(api): add the user-level gate helper for effective keys and limits (HOS-1644)
- `e1eca778abc20ca940912095ee5d5e28dbc90d01` feat(api): restore the stats gates on the effective set (HOS-1644)
- `662c961eb65da85c79baa3272ef8ff3648230e70` test(api): cover the stats gates (HOS-1644)
- `891f2c31bf2035df68de7effe61fa234cbc39914` test(api): assert the dashboard plan stays null behind its stats gate (HOS-1644)
- `616a5f86ca3dee7f44d0db2b338905d58a1cbe50` fix(api): keep effective-set read failures out of warning payloads (HOS-1644)

## Corrección 1

- Revertidos los `requiredPermissions` agregados en `hostFavoritesBreakdown.ts` y `hostMarketComparison.ts`; ambas rutas conservan el gate `view_advanced_stats` de la épica.
- Quitado `permission` de las dos filas de `commercial-gates.stats.test.ts`; el test comprueba el rechazo `ENTITLEMENT_REQUIRED` cuando falta la clave comercial efectiva.
- Corregidas las referencias de `menuQr.ts` y `menuQrScans.ts` para señalar `step6Key` (líneas 157 y 109).
- Gates: `CI=true pnpm --filter hospeda-api typecheck` pasó; `CI=true pnpm --filter hospeda-api lint` pasó con 23 advertencias preexistentes.
- Vitest, envuelto en el lock compartido y con `HOSPEDA_TEST_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@172.23.0.3:5432/postgres`: pasaron 63 tests en 3 archivos (`user-gate.test.ts`, `commercial-gates.stats.test.ts` y `host-favorites-breakdown.test.ts`). No existe un test `host-market-comparison.test.ts` en el worktree.
