# Auditoría de cobertura de skills

La extracción produjo 16 skills de dominio portables. Esta auditoría compara cada
skill con su `CLAUDE.md` de origen. El objetivo no es copiar las 10.000 líneas de
legacy, sino separar las reglas activas de los ejemplos históricos y detectar
invariantes que no pueden perderse.

## Resultado

| Dominio | Fuente | Skill | Cobertura inicial | Riesgo pendiente |
|---|---:|---:|---|---|
| API | 942 líneas | 103 | arquitectura, auth, errores, billing y testing resumidos | guard transversal para roles directos y `c.json()` de negocio |
| Web | 1.331 | 100 | Astro, islands, i18n, SEO, auth, facetas y variables públicas | publishing y rutas de cuenta muy específicas siguen en docs/legacy |
| Admin | 812 | 94 | CRUD, SSR, auth, tablas, Nitro, healthcheck y build | relation managers específicos siguen en documentación del área |
| DB | 877 | 71 | migraciones, queries, transacciones, `safeIlike` y template | `closeIssue --plan` ya informa drift; falta decidir si `update` también debe bloquear |
| Schemas | 616 | 46 | organización, Zod, transforms y compatibilidad aditiva | consumidores complejos se validan por tests del área |
| Services | 1.358 | 48 | CRUD, errores, permisos, `super`, `hookState` y transacciones | guards automáticos de permisos aún no son transversales |
| Seeding | 935 | 49 | determinismo, fixtures, dual-write y seguridad | política automática contra staging/prod requiere decisión operativa |
| Billing | 170 | 51 | límites, entitlements, paridad y estados | se mantiene validación por guards/tests existentes |
| Auth | 56 | 42 | actor, roles, permisos y sesión | cobertura suficiente; confirmar helpers reales al tocar auth |
| i18n | 340 | 38 | locales, tipos, pluralización y formatos | reglas de dominio poco frecuentes quedan en docs |
| Email | 550 | 41 | layout, plantillas, auth, previews y transportes | catálogo detallado queda junto al paquete |
| Media | 140 | 31 | fachada, Cloudinary, retries, fallback y avatar race | presets concretos quedan en configuración/docs |
| AI | 175 | 30 | providers, modelos, fail-loud y credenciales | sync de modelos y límites se validan sólo al tocar AI |
| Observabilidad | 308 | 33 | logging, redacción, formatos y correlación | campos específicos quedan en runbooks |
| UI | 389 | 30 | tokens, iconos, accesibilidad y composición | catálogo y animaciones son documentación normal |
| Config | 48 | 31 | registry, schemas, env públicas y drift | mantener reconciliación conectada a workflows |

## Invariantes ya extraídos

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

## Próximos pasos

1. Convertir los gaps delimitados de seguridad y permisos en guards con
   excepciones explícitas, evitando heurísticas fail-open.
2. Mantener el mapa de verificaciones centralizado para no duplicar listas de
   guards dentro de cada skill.
3. Evaluar si `hops update` debe mostrar o bloquear por drift del template; el
   preflight de `closeIssue` ya lo informa sin mutar la base.
4. Comparar los dominios restantes y marcar cada sección legacy como `migrada`,
   `documentación`, `guard`, `obsoleta` o `pendiente`.
5. Sólo después de esa revisión evaluar la eliminación de `CLAUDE.md`.

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

## Mapa operativo skill → verificación

Los skills apuntan a esta matriz como índice único. El agente debe ejecutar el
guard específico cuando exista y `pnpm check:guards` antes de cerrar una tarea
que cambie el dominio correspondiente.

| Skill | Verificación principal | Estado |
|---|---|---|
| `hospeda-api`, `hospeda-services`, `hospeda-auth` | `pnpm check:guards`; revisión de permisos granulares y respuestas | guard transversal pendiente para roles directos y `c.json()` de negocio |
| `hospeda-web`, `hospeda-admin`, `hospeda-ui` | `pnpm check:guards`; CSP, dialogs, formularios, iconos y patrones visuales | healthcheck/Nitro/SSR aún requieren guard delimitado |
| `hospeda-db` | `scripts/check-unsafe-ilike.sh`, `check-seed-migration-schema-probe.sh`, `pnpm check:guards` | fingerprint de template debe quedar visible en `closeIssue`/`update` |
| `hospeda-seeding` | guards de seed/migración y `pnpm check:guards` | política de bloqueo contra staging/prod requiere decisión operativa |
| `hospeda-config` | `env:doctor`, `check-env-local`, `check-env-registry`, `pnpm check:guards` | operativo y ejecutado por CI/local |
| `hospeda-billing` | guards de trial, preapproval, planes y dominios de producto | operativo; revisar excepciones sólo al cambiar billing |
| `hospeda-i18n` | cobertura de claves/placeholders y `pnpm check:guards` | operativo |
| `hospeda-media` | aislamiento Cloudinary, placeholders y `pnpm check:guards` | operativo |
| `hospeda-observability`, `hospeda-email`, `hospeda-ai` | `pnpm check:guards` más tests del paquete afectado | detalles de campos y proveedores permanecen en docs del paquete |

Este mapa no reemplaza la prueba del cambio: indica el control que debe
acompañar al skill. Una brecha se mantiene como pendiente hasta que exista un
guard con alcance claro y excepciones explícitas.
