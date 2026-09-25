# Auditoría de cobertura de skills

La extracción inicial produjo 17 skills portables. Esta auditoría compara cada
skill con su `CLAUDE.md` de origen. El objetivo no es copiar las 10.000 líneas de
legacy, sino separar las reglas activas de los ejemplos históricos y detectar
invariantes que no pueden perderse.

## Resultado

| Dominio | Fuente | Skill | Cobertura inicial | Riesgo pendiente |
|---|---:|---:|---|---|
| API | 942 líneas | 92 | arquitectura, auth, errores y testing resumidos | gates de billing, permisos granulares y gotchas de tests requieren extracción explícita |
| Web | 1.331 | 87 | Astro, islands, i18n, SEO, auth y UI resumidos | facets, publishing, rutas de cuenta y reglas visuales específicas aún dependen del legacy |
| Admin | 812 | 83 | CRUD, SSR, auth, tablas y deploy resumidos | Nitro, healthcheck, build inicial y relation managers necesitan revisión puntual |
| DB | 877 | 63 | migraciones, queries, transacciones y template resumidos | carriles de migración, `safeIlike`, enums, extras y reglas de billing necesitan guards/docs |
| Schemas | 616 | 42 | organización, Zod y contratos resumidos | transforms y schemas de entidades complejas requieren comparación de consumidores |
| Services | 1.358 | 41 | CRUD, errores, permisos y transacciones resumidos | reglas de permisos, `super`, `hookState` y dominios especializados requieren revisión |
| Seeding | 935 | 42 | determinismo, fixtures y seguridad resumidos | matriz de usuarios, verticales, catálogo y prohibición de prod requieren guard |
| Billing | 170 | 43 | límites, entitlements y paridad | revisar invariantes concretas contra tests y configuración |
| Auth | 56 | 42 | actor, roles, permisos y sesión | cobertura suficiente; confirmar helpers reales |
| i18n | 340 | 38 | locales, tipos, pluralización y formatos | revisar claves de dominio y validadores |
| Email | 550 | 37 | layout, plantillas, auth y previews | catálogo de plantillas y configuración detallada requieren comparación |
| Media | 140 | 31 | fachada, Cloudinary, retries y fallback | revisar presets concretos y carrera de avatar |
| AI | 175 | 30 | providers, modelos, fail-loud y credenciales | sync de modelos y límites concretos requieren guard/documentación |
| Observabilidad | 308 | 31 | logging, redacción y formatos | revisar campos/correlación usados por runbooks |
| UI | 389 | 30 | tokens, iconos y accesibilidad | catálogo y reglas de animación son documentación normal, no skill global |
| Config | 48 | 31 | registry, schemas, env públicas y drift | falta conectar un guard automático al close/update |

## Invariantes que deben extraerse antes de retirar legacy

### API y servicios

- Los permisos se comprueban con `PermissionEnum`; no se deben comprobar roles
  directamente, incluso para rutas administrativas.
- Las respuestas pasan por `ResponseFactory`; no se agregan `c.json()` directos.
- Los gates de entitlements lanzan `ServiceError` y respetan el orden de
  middleware, invalidación de cache y bypass de staff documentado.
- Algunos tests mockean `@repo/db` o ni siquiera alcanzan el handler; un test
  verde no prueba integración por sí solo.
- Los overrides de permisos administrativos deben llamar a `super` en el orden
  requerido y tener un test de orden.
- Las llamadas externas quedan fuera de `withServiceTransaction`; el estado
  compartido entre hooks vive en `ctx.hookState`, no en campos de instancia.

### Web y Admin

- `apps/web` debe usar variables semánticas, `SEOHead`, `@repo/icons` y acceso
  tipado a env; no `import.meta.env` directo ni SVG inline.
- Las facetas publicadas en URL deben conservar canonicalización, límites,
  parámetros OR/AND y forwarding entre páginas.
- Las páginas Astro deben mantener SSR/islands; los tests de `apps/web` no están
  cubiertos por typecheck automáticamente.
- `apps/admin` necesita el plugin `nitro/vite`, healthcheck `/healthz` y ningún
  singleton por request del lado cliente.
- Un checkout fresco del admin requiere build de ciertos paquetes antes de
  `pnpm dev`; esto debe quedar en un comando/guard reproducible.
- Los secretos nunca se exponen mediante variables `VITE_` o `PUBLIC_`.

### DB y seeds

- Cada cambio de schema debe entrar en un único carril: migración Drizzle,
  extra idempotente o seed/catalog data.
- `drizzle-kit push` es sólo para desarrollo; no se ejecuta contra VPS o
  producción.
- Las búsquedas `ilike` usan `safeIlike`, no el helper crudo, salvo el archivo
  autorizado.
- Los seeds de reset, ejemplos y usuarios locales nunca se ejecutan contra
  producción ni staging compartido sin una decisión explícita.
- Los fixtures de usuarios, roles, billing, verticales y cuentas de sistema son
  una matriz coordinada, no datos independientes.
- El template de DB debe validarse por fingerprint antes de reutilizarse.

## Decisión de migración

Los skills nuevos son el índice operativo corto. Las reglas anteriores que son
invariantes ejecutables deben pasar a guards o tests. Los detalles de una entidad,
historial de issues, ejemplos de catálogo y notas de incidentes deben quedarse en
`docs/` o junto al código. No se copiarán automáticamente todas las secciones
legacy al skill.

## Próximo paso

1. Convertir las invariantes de seguridad, permisos, migraciones, env y seeds en
   guards/tests.
2. Añadir referencias desde cada skill a los guards que lo verifican.
3. Comparar los dominios restantes y marcar cada sección legacy como `migrada`,
   `documentación`, `guard`, `obsoleta` o `pendiente`.
4. Sólo después de esa revisión evaluar la eliminación de `CLAUDE.md`.

## Guards ya existentes

La auditoría no propone duplicar controles que ya están activos. El repositorio ya
protege varias invariantes mediante `pnpm check:guards` y sus pasos individuales:

| Invariante | Control existente |
|---|---|
| `safeIlike` y wildcard injection | `scripts/check-unsafe-ilike.sh` |
| variables, schemas y ejemplos de entorno | `check-env-*`, `env:doctor` y tests de `packages/config` |
| paridad i18n y placeholders | `check-i18n-key-coverage.ts` y tests de `packages/i18n` |
| Cloudinary y placeholders de media | `check-cloudinary-isolation.sh`, `check-bare-cloudinary-img.sh`, `check-local-media-placeholders.sh` |
| trial, preapproval, planes y billing | `check-no-trial-to-mp.sh`, `check-no-plan-id-to-own-preapproval.sh`, `check-no-price-trial-days.ts`, guards de billing |
| schemas de seed y migraciones | `check-seed-migration-schema-probe.sh` y tests de `packages/seed` |
| dialogs, formularios y UI | `check-dialog-panel.ts`, `check-form-error-cleared-on-submit.ts`, `check-no-native-dialogs.ts` |
| CSP y nonce | `check-csp-patterns.sh`, `check-no-inline-nonce.sh` |
| cambios de product domain | guards `product-domain-*`, `addon-*` y `subscription-domain-*` |

## Gaps reales que quedan

- No existe todavía un guard general que detecte permisos de API implementados
  por roles directos. Hay que delimitar primero excepciones legítimas de UI,
  jobs y configuración antes de crear uno fail-closed.
- No existe un guard general para prohibir `c.json()` en todos los handlers: hay
  helpers y middleware que lo necesitan. Debe limitarse a rutas de negocio y
  excluir infraestructura explícitamente.
- Healthcheck `/healthz`, plugin Nitro y singleton SSR están documentados pero no
  tienen un único guard transversal.
- La regla de seeds locales contra staging/producción requiere una decisión
  operativa antes de bloquearla automáticamente; el riesgo ya está documentado.
- El fingerprint del template de DB se valida en el workflow de worktree, pero
  todavía debe quedar enlazado como gate visible de `closeIssue`/`update`.

No se agregaron guards especulativos en esta etapa. Los existentes se enlazarán a
los skills y los gaps se implementarán sólo después de definir su alcance para no
crear falsos positivos ni listas de excepciones que vuelvan el control fail-open.
