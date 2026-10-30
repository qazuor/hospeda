---
title: "FASE 9 · inventario de los guards del repo frente al rediseño"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 · inventario de los guards del repo frente al rediseño

## 1. El resumen

De los **45** scripts `check-*` en `scripts/`, con la vara de "¿el diseño nuevo (HOS-1352 /
HOS-1353 / HOS-1354) le borra el sujeto que este guard vigila?":

| veredicto | cantidad |
|---|---|
| **MUERE** | **7** |
| **REVISAR** | 6 |
| **SOBREVIVE** | 32 |
| **total** | 45 |

**El "once" de `F-8C2-008` no coincide: son 7, no 11.** La diferencia es explicable y no es un
error de conteo de ninguno de los dos lados. Seis guards adicionales (todos los que dan
`REVISAR` acá) dependen de una decisión que la propia spec deja **abierta**: qué proveedor de
cobro se usa (`.specs/HOS-1354-billing-cobro-y-proveedor/spec.md` §1, "no está decidida la
pasarela" — Mercado Pago sigue bloqueado por un `403` comercial, Mobbex está en revisión de KYC,
y "ningún proveedor argentino ofrece el cobro a demanda como self-service"). Si `F-8C2-008` contó
esos seis como muertes seguras, la estimación decidió una pregunta que la spec todavía no
decidió; si este documento los cuenta como `REVISAR` en vez de `MUERE`, es porque el criterio
pedido es no adivinar. Sumando MUERE + REVISAR da 13, que tampoco es 11 — así que ninguna lectura
de este documento reproduce el número exacto de `F-8C2-008`, y esa es la respuesta honesta: la
estimación previa fue una estimación, y esta es la medición.

---

## 2. La tabla

### MUERE (7)

| guard | qué vigila | veredicto | evidencia |
|---|---|---|---|
| `check-qzpay-wave-convergence.sh` | que `pnpm-lock.yaml` resuelva una sola versión de `@qazuor/qzpay-core` entre los cinco paquetes qzpay | MUERE | `scripts/check-qzpay-wave-convergence.sh:34`; `.specs/HOS-1354-billing-cobro-y-proveedor/spec.md:234` ("salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: **se absorbe**") |
| `check-commerce-plan-resolution.sh` | que sólo `commerce-plan-resolver.ts` lea `HOSPEDA_COMMERCE_PLAN_SLUGS` y nadie más hardcodee un slug de plan comercial | MUERE | `scripts/check-commerce-plan-resolution.sh:18-23`; `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:29-43` (catálogo `vertical → plan → plan_version`, sin env var) |
| `check-no-price-trial-days.ts` | que ningún write a la tabla Drizzle `billingPrices` escriba `trialDays`/`trial_days` | MUERE | `scripts/check-no-price-trial-days.ts:40,62` (anclado en el símbolo de tabla `billingPrices`); `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:31` (el precio vive en `billing_option`, sin columna de trial; el trial vive en `plan_version`) |
| `check-product-domain-vocabulary.sh` | que ningún símbolo `productDomain` compare contra el literal `'commerce'` | MUERE | `scripts/check-product-domain-vocabulary.sh:21-26`; `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:43` (verticales: Turista/Alojamiento/Gastronomía/Experiencia/Partner, sin `commerce`) |
| `check-product-domain-raw-sql.sh` | que ningún SQL crudo escriba `product_domain = 'commerce'` | MUERE | `scripts/check-product-domain-raw-sql.sh:8,30`; mismo modelo nuevo — `product_domain` se reemplaza por `vertical` y `'commerce'` no es una vertical válida |
| `check-no-binary-vertical-ternary.sh` | que ningún `x === 'gastronomy' ? A : B` decida una vertical comercial de forma binaria | MUERE | `scripts/check-no-binary-vertical-ternary.sh:5-16` (ancla en `ProductDomainEnum` y en `packages/billing/src/config/commerce-limits.config.ts`, ambos del modelo viejo) |
| `check-subscription-domain-hydration.sh` | que todo call site que compara `subscriptionMatchesDomain(x, d)` con `d` ≠ accommodation hidrate antes con `hydrateSubscriptionProductDomains()` | MUERE | `scripts/check-subscription-domain-hydration.sh:13-16,33` (el bug es un defecto del CLIENTE de qzpay-core, que no completaba `productDomain`); `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:47` (`subscription.vertical` vive en la fila, sin mapper externo) |

### REVISAR (6)

| guard | qué vigila | veredicto | evidencia / qué falta saber |
|---|---|---|---|
| `check-no-trial-to-mercadopago.sh` | que ningún archivo que toque la API de qzpay/MercadoPago nombre `free_trial`/`freeTrial`/`freeTrialDays`/`start_date` | REVISAR | El ancla (`scripts/check-no-trial-to-mercadopago.sh:65-68`, "it imports from `@qazuor/qzpay-*`") desaparece seguro porque qzpay se absorbe. La REGLA de fondo sigue viva si el proveedor final es Mercado Pago (`.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:122-134`, §4.3 "Nunca se le pide un trial" — mismo mecanismo, `start_date` futuro dispara un trial solo). Falta saber: qué proveedor gana (§1 del spec.md de HOS-1354, todavía bloqueado) |
| `check-no-plan-id-to-own-preapproval.sh` | que un `POST /preapproval` propio nunca lleve `preapproval_plan_id` | REVISAR | Mismo ancla en qzpay (`scripts/check-no-plan-id-to-own-preapproval.sh:19-20`). El mecanismo de "creamos el preapproval por API primero" sigue siendo el punto de partida (`.specs/HOS-1352-billing-verticals-redesign/docs/00-PDR.md:427-439`, §5.6), pero esa misma sección dice explícitamente "NO asumir automáticamente que la implementación actual sea correcta". Falta saber: si el proveedor final es Mercado Pago con este mismo flujo, o cambia |
| `check-addon-webhook-routing.sh` | que todo handler de un pago autorizado llame `routeAddonAuthorizedPayment()` antes de resolver la suscripción local, para no tratar un addon como plan | REVISAR | El discriminador viejo (`product_domain = 'addon'` en `billing_subscriptions`, `scripts/check-addon-webhook-routing.sh:10`) se reemplaza por `subscription.clase` (principal/complemento) (`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:47`, y glosario §1.4). La NECESIDAD de rutear (un addon recurrente sigue creando su propia autorización, §1.4 "Suscripción de complemento") está confirmada; lo que falta es el mecanismo de webhook, que depende del proveedor (capacidad 8, "avisar", §1 de `06-proveedor.md`) |
| `check-addon-product-domain.sh` | que `createAddonCheckout` llame `subscriptionMatchesDomain()`, que `AddonResponseSchema` declare `productDomain`, y que nadie derive el dominio de un addon desde `affectsLimitKey` | REVISAR | El modelo nuevo reemplaza el campo escalar `productDomain` por una lista, "verticales compatibles", en `addon_product` (`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:79`). No queda claro si sigue haciendo falta un comparador tipo `subscriptionMatchesDomain` o si la restricción `UNIQUE(user_id, vertical) WHERE clase=principal` alcanza. Falta FASE 5/6 para fijar el mecanismo de checkout de addons |
| `check-product-domain-on-writes.ts` | que todo `INSERT` a `billingSubscriptions`/`billingPlans` declare `productDomain` explícito, nunca implícito | REVISAR | Rename directo: `billingSubscriptions`/`billingPlans` → `subscription`/`plan` (`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:47`; `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:40`), `productDomain` → `vertical`. La regla de fondo (nunca un create implícito) es de las que sí sobreviven a un rename según el criterio pedido, pero se marca `REVISAR` y no `SOBREVIVE` porque el nombre exacto y si sigue siendo Drizzle `.notNull()` sin default lo fija FASE 5 |
| `check-unlisted-plan-filter.sh` | que un plan marcado `unlisted` (negociado, precio exclusivo) nunca se sirva por `/public/plans`, `/protected/plans` ni `/protected/billing/plans/:id` | REVISAR | El modelo nuevo de `plan_version` sólo declara `vendible`/`vigente` (`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:41`); no hay mención de un plan "no listado pero vendible" en ningún doc de las tres épicas (búsqueda sin resultados). Falta saber si el caso de uso (plan negociado, ej. convenio con un municipio) sigue existiendo y, si sigue, con qué flag |

### SOBREVIVE (32)

| guard | qué vigila | veredicto | evidencia |
|---|---|---|---|
| `check-bare-cloudinary-img.sh` | que ningún `<img src>` embeba una URL de Cloudinary cruda en admin/web | SOBREVIVE | `scripts/check-bare-cloudinary-img.sh:4` — transversal a medios, sin relación con billing |
| `check-circular-deps.sh` | las reglas de capas del monorepo (`@repo/db` no depende de `service-core`, etc.) | SOBREVIVE | `scripts/check-circular-deps.sh:8` — arquitectura de paquetes, no de billing |
| `check-cloudinary-isolation.sh` | que sólo `packages/media/**` importe el SDK de Cloudinary | SOBREVIVE | `scripts/check-cloudinary-isolation.sh:4` |
| `check-cloudinary-uploads.ts` | qué assets existen en Cloudinary bajo el prefijo de seed | SOBREVIVE | `scripts/check-cloudinary-uploads.ts:2` — ver además §4 (no está enganchado a nada) |
| `check-csp-patterns.sh` | patrones incompatibles con CSP (`onclick=`, `eval(`, etc.) | SOBREVIVE | `scripts/check-csp-patterns.sh:2` |
| `check-dialog-panel.ts` | que todo `<dialog>` en `apps/web` declare `dialog-panel`/`dialog-viewport` | SOBREVIVE | `scripts/check-dialog-panel.ts:3` |
| `check-drop-column-release-gap.sh` | que un `DROP COLUMN` declare que el código que la leía ya se dejó de usar en un release anterior | SOBREVIVE | `scripts/check-drop-column-release-gap.sh:5` — mecanismo transversal de migraciones; **más relevante que nunca** durante el corte de HOS-1352 |
| `check-env-local.ts` | que cada `.env.local` tenga las vars `'always'`-requeridas de `ENV_REGISTRY` | SOBREVIVE | `scripts/check-env-local.ts:6` |
| `check-env-registry.sh` | que cada var Zod tenga su entrada espejo en `ENV_REGISTRY` | SOBREVIVE | `scripts/check-env-registry.sh:4` |
| `check-env-rules.ts` | reglas cruzadas entre vars de distintas apps (`env-cross-checks.ts`) | SOBREVIVE | `scripts/check-env-rules.ts:6` |
| `check-env-usage.ts` | que todo `process.env.X` tenga entrada en `ENV_REGISTRY` | SOBREVIVE | `scripts/check-env-usage.ts:9` |
| `check-form-error-cleared-on-submit.ts` | que un formulario de `apps/web` limpie el banner de error al reintentar | SOBREVIVE | `scripts/check-form-error-cleared-on-submit.ts:5` |
| `check-getbyid-tests.sh` | que los tests `getById.test.ts` de `service-core` afirmen sobre el método correcto | SOBREVIVE | `scripts/check-getbyid-tests.sh:4` — servicios de billing están deliberadamente FUERA de `BaseCrudService` (CLAUDE.md), este guard nunca los tocó |
| `check-hospeda-email-domain.sh` | que ningún `@hospeda.<x>` publicado sea distinto de `@hospeda.com.ar` | SOBREVIVE | `scripts/check-hospeda-email-domain.sh:4` |
| `check-i18n-key-coverage.ts` | que toda clave de i18n referenciada en código exista en los locales | SOBREVIVE | `scripts/check-i18n-key-coverage.ts:5` |
| `check-links.ts` | links internos rotos en Markdown | SOBREVIVE | `scripts/check-links.ts:4` |
| `check-local-date-math.sh` | aritmética de fechas en timezone local en código de servidor | SOBREVIVE | `scripts/check-local-date-math.sh:4` |
| `check-local-media-placeholders.sh` | que CI no dispare requests a `res.cloudinary.com` | SOBREVIVE | `scripts/check-local-media-placeholders.sh:5` |
| `check-locale-resolution-single-source.ts` | que sólo `resolveDisplayLocale`/`matchAcceptLanguage` decidan el locale | SOBREVIVE | `scripts/check-locale-resolution-single-source.ts:10` |
| `check-mergeable-contact-info.ts` | que toda columna JSONB `contact_info` esté en `mergeableJsonbColumns` | SOBREVIVE | `scripts/check-mergeable-contact-info.ts:5` — tablas de negocio (accommodations, gastronomies, etc.), no billing |
| `check-no-inline-nonce.sh` | que ningún `.astro` de `apps/web` lleve un nonce CSP inline | SOBREVIVE | `scripts/check-no-inline-nonce.sh:5` |
| `check-no-native-dialogs.ts` | que `apps/web` no use `confirm()`/`alert()`/`prompt()` nativos | SOBREVIVE | `scripts/check-no-native-dialogs.ts:5` |
| `check-partner-mention-copy.sh` | que la copy del log de menciones de Partner no hable de métricas que no se miden | SOBREVIVE | `scripts/check-partner-mention-copy.sh:3` — es sobre contenido/copy del programa de menciones, no sobre suscripción o billing |
| `check-qrcode-engine-isolation.sh` | que sólo un archivo importe el paquete `qrcode` | SOBREVIVE | `scripts/check-qrcode-engine-isolation.sh:6` |
| `check-schema-drift.sh` | que un cambio al schema Drizzle venga con su migración commiteada | SOBREVIVE | `scripts/check-schema-drift.sh:5` — mecanismo transversal, se va a usar MÁS durante la migración de HOS-1352 |
| `check-seed-dual-write.sh` | que un cambio a datos de seed ya vivos en prod venga con su data-migration numerada | SOBREVIVE | `scripts/check-seed-dual-write.sh:3` — mecanismo transversal de seed |
| `check-seed-migration-schema-probe.sh` | que las data-migrations de seed no se salteen por una probe de existencia de columna | SOBREVIVE | `scripts/check-seed-migration-schema-probe.sh:4` |
| `check-soft-delete-actor.ts` | que todo soft delete registre quién lo hizo | SOBREVIVE | `scripts/check-soft-delete-actor.ts:20` — mecanismo transversal de toda tabla con soft delete |
| `check-type-casts.sh` | que todo `as unknown as X` lleve comentario de justificación | SOBREVIVE | `scripts/check-type-casts.sh:4` — regla de higiene de TypeScript, aplica a cualquier paquete (incluido un `packages/billing` reescrito) |
| `check-unsafe-ilike.sh` | que nadie use `ilike()` crudo en vez de `safeIlike()` | SOBREVIVE | `scripts/check-unsafe-ilike.sh:4` |
| `check-web-loading-patterns.sh` | patrones de loading state en React de `apps/web` | SOBREVIVE | `scripts/check-web-loading-patterns.sh:4` |
| `check-whats-new-catalog.sh` | invariantes del catálogo hand-edited de "novedades" | SOBREVIVE | `scripts/check-whats-new-catalog.sh:10` |

---

## 3. Los que mueren, con su razón

**`check-qzpay-wave-convergence.sh`.** Vigila que el lockfile resuelva una sola versión de
`@qazuor/qzpay-core` entre los cinco paquetes hermanos de qzpay. El programa retira qzpay por
completo: *"salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: **se absorbe**"*
(`.specs/HOS-1354-billing-cobro-y-proveedor/spec.md:234`). Sin el paquete en el árbol de
dependencias, no hay ondas de versión que converjan ni que diverjan.

**`check-commerce-plan-resolution.sh`.** Vigila que sólo un módulo lea la env var
`HOSPEDA_COMMERCE_PLAN_SLUGS` para resolver el slug de plan de MercadoPago de una vertical
comercial. El catálogo nuevo reemplaza esa resolución por env var con tablas de primera clase:
*"`vertical (catálogo, espejo del enum) └──< plan ──< plan_version ──< billing_option"*
(`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:29-34`). No
hay slug que resolver desde una env var cuando el plan es una fila de base.

**`check-no-price-trial-days.ts`.** Vigila que ningún write a la tabla Drizzle `billingPrices`
escriba `trialDays`/`trial_days`, porque `@qazuor/qzpay-core` heredaba ese valor de la fila de
precio cuando el caller lo omitía. El modelo nuevo no tiene una tabla de precio separada con esa
columna: *"El precio cuelga de la versión, no del plan... `billing_option`: el ciclo y su precio"*
(`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:31-35`), y los días de
trial viven en `plan_version` (`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:54`).
Sin qzpay-core y sin `billingPrices`, no hay ni el bug ni la tabla que el guard anclaba.

**`check-product-domain-vocabulary.sh` y `check-product-domain-raw-sql.sh`.** Los dos vigilan
que ningún símbolo `productDomain`/`product_domain` compare contra el literal `'commerce'`. El
campo se renombra a `vertical` y el vocabulario nuevo son cinco verticales sin `commerce`:
*"**Vertical** | Categoría de producto dentro de Hospeda (§6). Hoy: Turista, Alojamiento,
Gastronomía, Experiencia, Partner"* (`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:43`).
No es sólo un rename: `'commerce'` no tiene equivalente en el vocabulario nuevo, así que no hay
literal que resucitar bajo ningún nombre. El propio modelo de HOS-1353 anticipa un guard
DISTINTO para el reemplazo (*"el guard de §1.2 verifica las dos direcciones"*,
`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:39`), que es
una pieza nueva, no la continuación de ésta.

**`check-no-binary-vertical-ternary.sh`.** Vigila el patrón `x === 'gastronomy' ? A : B` y ancla
explícitamente en `ProductDomainEnum` y en
`packages/billing/src/config/commerce-limits.config.ts` (`scripts/check-no-binary-vertical-ternary.sh:5-16`),
ambos del modelo de dominio de producto que el rediseño retira en favor de `vertical`. Es un
guard hermano de los dos anteriores y muere por la misma razón: el enum que ancla no existe más.

**`check-subscription-domain-hydration.sh`.** Vigila que todo comparador
`subscriptionMatchesDomain(x, d)` hidrate antes el campo con `hydrateSubscriptionProductDomains()`,
porque el cliente de qzpay-core no completaba `productDomain` al leer una suscripción. El modelo
nuevo guarda `vertical` directo en la fila de `subscription`
(`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:47`), sin un cliente de
librería externa de por medio que pueda omitir el campo. Sin qzpay y sin el mapper que lo
resolvía a medias, no hay hidratación que verificar.

---

## 4. Datos sueltos que encontré midiendo

- **8 de los 45 NO están en `check:guards`** (el agregado de `package.json` encadena 37):
  `check-cloudinary-uploads.ts`, `check-drop-column-release-gap.sh`, `check-env-local.ts`,
  `check-env-rules.ts`, `check-env-usage.ts`, `check-links.ts`, `check-schema-drift.sh`,
  `check-seed-dual-write.sh`. De estos, `check-env-usage.ts` y `check-schema-drift.sh` y
  `check-seed-dual-write.sh` y `check-drop-column-release-gap.sh` SÍ corren en CI igual, como
  pasos propios del job `guards` (líneas 392, 400, 408, 424 de `.github/workflows/ci.yml`) o de
  un job separado (`env:check:registry`/`env:check:usage`, líneas 417 y 424). `check-links.ts`
  corre en `.github/workflows/docs.yml`, no en `ci.yml`. `check-env-local.ts` y
  `check-env-rules.ts` **no corren en ningún CI** — el propio `ci.yml` lo documenta: *"env:check:local
  y env:check:rules need a real .env.local, which CI does not have (HOS-79 OQ-2)"*
  (`.github/workflows/ci.yml:421-422`).
- **`check-cloudinary-uploads.ts` es un script fantasma**: no aparece en ningún script de
  `package.json` (ni `check:*` ni ningún otro) ni en ningún workflow de `.github/workflows/`. Es
  el único de los 45 sin ningún punto de entrada — se ejecuta, si acaso, a mano.
- Los otros 37 SÍ están en `check:guards` y los 37 tienen su propio step en el job `guards` de
  `ci.yml` (confirmado línea por línea, sección 213-424) — ninguno de los 45 está en
  `check:guards` sin tener paso propio en CI. El comentario del propio
  `check-partner-mention-copy.sh:640-654` ya advierte sobre esta trampa exacta: *"adding a script
  to `check:guards` does NOT put it in CI"*.
- No encontré ningún guard duplicado ni ningún `check:*` de `package.json` que apunte a un
  archivo `scripts/check-*` inexistente.

---

## 5. Lo que este documento NO decide

Este inventario no borra ningún guard, no adapta ninguno, y no clasifica ningún código en
KEEP/ADAPT/REWRITE — esa clasificación es FASE 5 (`DEC-METH-003`), que el owner todavía no abrió.
Los siete `MUERE` de la §2 son un diagnóstico sobre el SUJETO que cada guard vigila, no una
instrucción de borrado: la decisión de qué hacer con el script (borrarlo, archivarlo, dejarlo
como documentación histórica) es de FASE 6. Los seis `REVISAR` quedan abiertos a propósito,
porque decidirlos hoy significaría adivinar una pregunta —qué proveedor de cobro se usa— que la
propia spec de HOS-1354 declara todavía sin resolver.
