---
title: Verificar si los add-ons de visibilidad entregan el destacado
linear: HOS-2290
statusSource: linear
created: 2026-11-16
type: fix
areas:
  - billing
  - api
  - web
---

# Verificar si los add-ons de visibilidad entregan el destacado

> Este documento es un **informe de verificación**. Se leyó el código de `origin/staging`
> (merge `92994b9dc6`, 2026-11-16). No se tocó nada. Lo que depende de datos de producción
> está marcado como **PENDIENTE DE SQL** y se resuelve con las consultas de la sección 7.

## 1. Veredicto

**Dos respuestas distintas, y la segunda es la que importa.**

| Pregunta | Veredicto |
|---|---|
| ¿El destacado se **entrega** cuando existe un add-on de visibilidad activo? (alojamiento, local y experiencia) | **SÍ.** Existe un escritor de `featuredByEntitlement` desde HOS-1718 (mergeado el 2026-11-12). La frase del `CLAUDE.md` raíz «`featuredByEntitlement` currently has NO writer» está **vencida**. |
| ¿Esos add-ons se pueden **comprar** hoy? | **NO desde la web, en ningún entorno.** Los 6 productos son de pago único (`UNA_VEZ`) y la pantalla de compra web los esconde hasta HOS-2094. Solo se compran llamando a la API con un token de tarjeta, que la web no genera. |

Consecuencia: **el escenario de la issue («un local paga y no aparece destacado») no puede
ocurrir por la web**, porque nadie puede pagar. El riesgo real es otro y es doble:

1. Cuando HOS-2094 habilite la compra web, el destacado **ya funciona**: no hay que
   adelantar HOS-929 (está Done) ni retirar productos.
2. Mientras tanto, **hay copy que promete lo que no se puede comprar** (página de
   presentación, `/funcionalidades`, comparador de planes). Eso se trata en HOS-2284.

**Recomendación:** no retirar los productos y no adelantar nada. Cerrar la verificación
con este informe, corregir el `CLAUDE.md`, y dejar la habilitación de compra en HOS-2094.
Lo único urgente es confirmar con SQL (sección 7) que no hay instancias de pago único
activas en producción comprobables por API.

## 2. Problema

La issue sospechaba que el destacado no tenía escritor y que un add-on de visibilidad
pagado no se vería en el listado. Había que verificar los tres verticales con producto
de visibilidad (alojamiento, local de Comer y salir, experiencia) y decidir: retirar de
la venta o adelantar el mecanismo.

## 3. Alcance y fuera de alcance

Dentro: informe, corrección de docs vencidos, SQL de verificación en producción,
y los arreglos chicos que el informe justifique (sección 9).

Fuera: habilitar el pago único en la web (HOS-2094), el destacado de evento
(HOS-2279, HOS-2288), cualquier cambio de catálogo, y el borrado del código muerto
`syncFeaturedByEntitlementFor*`, que maneja la sesión epica-billing (decidido por el owner,
16/11/2026; no es parte de este programa).

Alcance de los add-ons: este informe cubre solo los 6 `visibility-boost-*`, que destacan
**fichas** con la clave `featured_listing`. Los packs nuevos de Comer y salir (HOS-2285,
2286, 2287, 2289) son mensuales y otorgan límites o la carta en idiomas: **no** destacan nada.
El destacado de evento (HOS-2288) usa otra clave (`featured_event`), se aplica al local con
alcance `LISTING` guardando el `event_id`, y su lectura es propia, sin pasar por
`syncListingFeatured`.

## 4. Estado actual del código (con citas)

### 4.1 Quién escribe `featuredByEntitlement`

Hay **un solo escritor** por todo el repo: `setFeatured` de los puertos de producción.

- `apps/api/src/utils/listing-featured/listing-featured-ports.ts:76-140`: `UPDATE ... SET featured_by_entitlement = to, updated_at = now()`
  con compare-and-set (`featuredByEntitlement = from`), para `accommodations` (L82-100),
  `venues` (L101-119) y `experiences` (L120-138). Corre dentro de un lock por
  `(user, vertical)` (L30-34).
- La lógica de decisión: `packages/verticals/src/featured/sync-listing-featured.ts:28-113`.
  - Plan: destaca **todas** las fichas del dueño en esa vertical si el set efectivo trae
    `featured_listing` con valor > 0 (L60-62).
  - Add-on: destaca **solo la ficha objetivo** si hay una fuente `ADDON` con scope `LISTING`
    cuya versión trae el entitlement `featured_listing` (L63-87).
  - El trial **nunca** destaca (L24, L42-47, L60 sobre cobertura sin `TRIAL`; PM-627).
  - Después del commit revalida cache solo de las filas que cambiaron (L109-111).
- `syncFeaturedByEntitlementFor{Owner,Accommodation}`
  (`packages/service-core/src/services/accommodation/accommodation.sync-featured-by-entitlement.ts`)
  **sigue sin llamador de producción**: es el vestigio al que se refiere el `CLAUDE.md`.
  El camino vigente es `syncListingFeatured`. Su borrado lo maneja la sesión epica-billing
  (no este programa); acá solo se lo documenta como código muerto.

### 4.2 Quién dispara la sincronización

1. **Aviso de cobertura:** `apps/api/src/utils/listing-featured/featured-sync-listener.ts:25-46`
   se suscribe a `onCoverageChanged`; está cableado al arranque en
   `apps/api/src/index.ts:360` (se desuscribe en L467).
2. **Reconciliador diario** `listing-coverage-reconciler`, `0 5 * * *`
   (`apps/api/src/cron/schedules.manifest.ts:61-64`): llama a `syncListingFeatured` por cada par
   (`packages/verticals/src/publication/coverage-reconciler.ts:42-55`), con los puertos de
   `apps/api/src/utils/listing-publication/reconciler-ports.ts:48-51`. Cura avisos perdidos.
3. **Quién emite el aviso en el ciclo de vida del add-on:**
   - Alta del pago único: `addon-instance-a2-one-time.ts:174-177` → `emitAddonCoverageAdded`
     (`addon-instance-a2.ts:122-155`, `change: 'ADDED'`).
   - Alta recurrente: `addon-instance-a2.ts` y `notice/complement-authorized.ts:54`.
   - Vencimiento de `FIXED_DAYS`: `expire-addon-instances.service.ts:50-110` marca `EXPIRED` y
     emite el aviso de baja (L100). El job es `subscription-window-expiry`, cada 15 minutos
     (`schedules.manifest.ts:133-136`, `7-59/15 * * * *`; el job llama
     `expireAddonInstances` en `subscription-window-expiry.job.ts:134`).
   - Cancelación/retiro: `addon-instance-a5.ts` (emite baja tras el commit).
4. **Cobertura sin reloj:** `addon-sources.ts:134-142` descarta la fuente `FIXED_DAYS` cuya
   `ends_at` ya pasó, así que cualquier sincronización posterior al vencimiento ya la ve apagada.
   El destacado puede durar hasta 15 min de más sobre `ends_at` (la cadencia del cron).

### 4.3 Quién lo lee (público)

- `resolvePublicIsFeatured` = `Boolean(featuredByEntitlement)`
  (`apps/api/src/utils/accommodation-featured.ts:97-98`). Es la **única** fuente desde
  HOS-1419 (`is_featured` ya no existe).
- Aplicado en los públicos de venue (`routes/venue/public/list.ts:65`, `getByDestination.ts:56`,
  `getById.ts:55`, `getBySlug.ts:133`) y de experiencia (`routes/experience/public/list.ts:70`,
  `getByDestination.ts:56`, `getById.ts:53`, `getBySlug.ts:82`) y los 7 de alojamiento.
- Orden: el modelo ordena por la columna directo (`venue.model.ts:39`,
  `featuredFirstColumn = 'featuredByEntitlement'`). La página `/comer-y-salir/` ordena por
  `isFeatured desc` por defecto (`apps/web/src/pages/[lang]/comer-y-salir/index.astro:121-128, 144-170`).
- Marca visual: `VenueCard.astro:58` y `:118-120` («Destacado»).

### 4.4 Qué productos de visibilidad hay

Catálogo de producción: `scripts/production-catalog/commercial-catalog.ts:144-165` (helper
`visibilityBoost`) y `:210-252` (6 productos). Cargados por la migración
`packages/db/src/migrations/0176_production_catalog_prices_addons.sql`:

| slug | vertical (`compatible_verticals`) | días | precio (ARS) | SQL |
|---|---|---|---|---|
| `visibility-boost-7d` | accommodation | 7 | 5.000 | L33, L43, L57 |
| `visibility-boost-30d` | accommodation | 30 | 15.000 | L34, L44, L58 |
| `visibility-boost-venue-7d` | venue | 7 | 5.000 | L35, L45, L59 |
| `visibility-boost-venue-30d` | venue | 30 | 15.000 | L36, L46, L60 |
| `visibility-boost-experience-7d` | experience | 7 | 5.000 | L37, L47, L61 |
| `visibility-boost-experience-30d` | experience | 30 | 15.000 | L38, L48, L62 |

Todos: `validity = FIXED_DAYS`, `scope_type = LISTING`, entitlement `featured_listing`,
`charge_kind = UNA_VEZ`, `cycle = NULL` (L43-48 y L57-62; `addon_version_entitlement` L51-56).

Planes que otorgan `featured_listing` (línea base 0144; verificar el vivo con SQL):
solo `owner-pro` y `owner-premium` (`scripts/production-catalog/catalog.ts:272` y `:456`).
**Ningún plan de venue ni de experiencia lo otorga** (confirmado también con HOS-2279).

### 4.5 ¿Se puede comprar? (el hallazgo central)

- **API:** `POST /api/v1/protected/billing/addons/purchases`
  (`apps/api/src/routes/billing-addon/purchase.ts:28-161`). Para `UNA_VEZ` **exige**
  `parsed.payment` o responde 400 (L40-48) y luego `sendOneTimeOrder` con un token de
  tarjeta de `/v1/orders` de MercadoPago. El listado `GET .../addons/offers` devuelve todo
  producto con `retired_at IS NULL` (`apps/api/src/services/addon-offers/addon-offers.service.ts:32-34`),
  o sea, **los 6 se listan en la API**.
- **Web:** `apps/web/src/lib/billing/addon-purchase.ts:10-13`
  `purchasableOffers` filtra a `chargeKind === 'PERIODICO'` («Only recurring addons can be
  purchased from the web screen»), y `AddonPurchase.client.tsx:81` lo aplica a la lista
  que ve el usuario. Commit `26ab20073d` «exclude one-time addons from web purchase until
  HOS-2094». Los 6 son `UNA_VEZ`: **no aparecen en `/mi-cuenta/complementos/`**.
- **Admin web:** no hay pantalla de compra de add-ons en `apps/admin`; el admin solo
  gestiona el catálogo (`features/billing-addon-catalog`). No existe oferta alternativa.
- **HOS-2094** (Backlog, sin dueño): medir Checkout Pro como redirect y habilitar la compra
  web de los 6. Debe resolverse «antes del corte o aceptar salir sin esos add-ons».
- **Reglas que se aplican cuando se habilite:**
  - Hace falta un principal que **paga** o un ancla de grant vivo en la vertical
    (`purchase-addon-eligibility.ts:22-45, 107-123`; rechazo `NO_VALID_TITLE`, 409).
    Un local solo con trial **no puede** comprar.
  - La ficha objetivo debe ser del comprador, de la vertical compatible y con
    `acceptsFeature` (`:61-80`). `ACCEPTS_FEATURE` (`packages/verticals/src/publication/listing-inverse.ts:79-86`):
    DRAFT, PUBLISHED, UNPUBLISHED_BY_BILLING y ARCHIVED aceptan; MODERATED y PURGED no.
  - No hay unicidad para pago único activo (el índice parcial
    `uq_addon_instance_purchase_identity` solo cubre pendientes y activos con complemento,
    `addon-product.dbschema.ts:134-142`): se puede **recomprar** sobre la misma ficha.

### 4.6 Cobertura de tests

- `apps/e2e/tests/verticals/featured-01-listing-boost.spec.ts` (boost de alojamiento, `UNA_VEZ`
  con el proveedor falso), `featured-02`, `featured-03`, `featured-04-venue-experience-order`
  (venue/experiencia, usa un producto `PERIODICO` sembrado: `:162`).
- Unit: `packages/verticals/test/featured/sync-listing-featured*.test.ts`,
  `apps/api/test/utils/listing-featured/featured-sync-listener*.test.ts`,
  `apps/api/test/integration/listing-featured/*`.
- **Hueco:** ningún test cubre el producto real `visibility-boost-venue-*` de la migración 0176
  de punta a punta (el e2e de venue siembra un producto propio, ver fixture
  `apps/e2e/fixtures/listing-featured.ts:100-125`).

## 5. Verificación vertical por vertical

| Vertical | Escritor | Lectura pública | Orden | Producto comprable por web |
|---|---|---|---|---|
| Alojamiento | sí (`setFeatured` L82-100) | sí | sí | **no** (`UNA_VEZ`) |
| Local (venue) | sí (L101-119) | sí | sí (`venue.model.ts:39`) | **no** |
| Experiencia | sí (L120-138) | sí | sí | **no** |

## 6. Riesgos y observaciones (no bloquean el veredicto)

- **R-1. Copy que promete algo no comprable.**
  - `/presentacion/comer-y-salir/` (L297-302) lista «Destacar tu local por 7 o 30 días» como
    complemento vigente y dice «desde Mi cuenta > Complementos... sin llamar a nadie» (L304).
  - `plan-comparison-rows.ts:262-272` dice que cualquier plan puede comprar el boost.
  - Decidido (owner, 16/11/2026): «Destacar 7 o 30 días» queda como está en la página; se
    vuelve verdadero cuando salga HOS-2094. Las otras tres afirmaciones falsas se corrigen en
    HOS-2284. Mientras HOS-2094 siga abierta, esa frase promete algo no comprable (aceptado).
- **R-2. Al habilitar el pago único, comprar para una ficha oculta quema días.** La alerta de
  ficha oculta solo existe para `PERIODICO` (`addon-purchase.ts:17-32`,
  `hiddenListingNoticeKind` devuelve `null` si `chargeKind !== 'PERIODICO'`). Un boost de
  7 días comprado sobre un borrador corre el reloj sin que nadie lo vea. Va como criterio
  de aceptación de HOS-2094.
- **R-3. Selector de ficha muestra el UUID**, no el nombre (`AddonTargetPicker.tsx:32`).
  Mala UX pero no de entrega.
- **R-4. Latencia de hasta 15 min** al vencer (cron `7-59/15`).
- **R-5. Documentación vencida.** `CLAUDE.md:288-296` (bloque «`featuredByEntitlement`
  currently has NO writer») y el comentario `apps/web/src/components/billing/plan-comparison-rows.ts:268-272`
  hablan de SPEC-309 / «per-accommodation»; hay que actualizarlos.
- **R-6. Si ya hubiera instancias `UNA_VEZ` activas en producción** (compradas por API directa)
  el destacado se entregó solo si el cutover ejecutó la sincronización (la corre el reconciliador
  diario). Ver SQL de la sección 7.

## 7. SQL de solo lectura para producción (lo corre el coordinador)

`hops psql --target=prod` (ver nota de memoria: la palabra `slug` en la consulta rompe
`hops psql`; si pasa, usar el alias `a.name` o filtrar por `addon_id`).

```sql
-- Q1. ¿Los productos de visibilidad están a la venta (retired_at null)?
SELECT ap.id AS product_id, a.slug, ap.charge_kind, ap.price, ap.compatible_verticals,
       ap.retired_at, av.validity, av.validity_days, av.scope_type
FROM addon_product ap
JOIN addon a ON a.id = ap.addon_id
JOIN addon_version av ON av.id = ap.version_id
WHERE a.slug LIKE 'visibility-boost-%'
ORDER BY a.slug;

-- Q2. ¿Existe alguna instancia de visibilidad, en cualquier estado?
SELECT a.slug, ai.status, count(*) AS n, min(ai.created_at) AS first_at, max(ai.created_at) AS last_at
FROM addon_instance ai
JOIN addon_product ap ON ap.id = ai.product_id
JOIN addon a ON a.id = ap.addon_id
WHERE a.slug LIKE 'visibility-boost-%'
GROUP BY a.slug, ai.status
ORDER BY a.slug, ai.status;

-- Q3. Instancias ACTIVAS: ¿la ficha objetivo está efectivamente destacada?
SELECT ai.id, ai.owner_id, a.slug, ai.target_id, ai.starts_at, ai.ends_at,
       COALESCE(ac.featured_by_entitlement, v.featured_by_entitlement, e.featured_by_entitlement) AS featured_now,
       CASE WHEN ac.id IS NOT NULL THEN 'accommodation' WHEN v.id IS NOT NULL THEN 'venue'
            WHEN e.id IS NOT NULL THEN 'experience' ELSE 'MISSING' END AS listing_kind
FROM addon_instance ai
JOIN addon_product ap ON ap.id = ai.product_id
JOIN addon a ON a.id = ap.addon_id
LEFT JOIN accommodations ac ON ac.id = ai.target_id
LEFT JOIN venues v ON v.id = ai.target_id
LEFT JOIN experiences e ON e.id = ai.target_id
WHERE a.slug LIKE 'visibility-boost-%' AND ai.status = 'ACTIVE';

-- Q4. Fichas destacadas hoy por vertical (para ver si el plan ya destaca venues).
SELECT 'accommodation' AS k, count(*) FILTER (WHERE featured_by_entitlement) AS featured, count(*) AS total FROM accommodations WHERE deleted_at IS NULL
UNION ALL SELECT 'venue', count(*) FILTER (WHERE featured_by_entitlement), count(*) FROM venues WHERE deleted_at IS NULL
UNION ALL SELECT 'experience', count(*) FILTER (WHERE featured_by_entitlement), count(*) FROM experiences WHERE deleted_at IS NULL;

-- Q5. ¿Qué versiones vigentes de plan otorgan featured_listing? (confirma que venue/experience no)
SELECT p.vertical, p.slug AS plan, pv.id AS plan_version_id
FROM plan_version_entitlement pve
JOIN plan_version pv ON pv.id = pve.plan_version_id
JOIN plan p ON p.id = pv.plan_id
WHERE pve.key = 'featured_listing'
ORDER BY p.vertical, p.slug;
```

Lectura: **Q1** dice si «se pueden comprar» a nivel catálogo (la web igual los esconde).
**Q2 con cero filas** confirma que nunca se compró uno: el veredicto queda cerrado sin urgencia.
**Q3 con `featured_now = false`** en alguna fila ACTIVA sería un bug de entrega real (abrir issue
de urgencia; el reconciliador de las 05:00 debería haberla curado). **Q5** valida el §4.4.
Para el tamaño del catálogo en la tabla: los nombres exactos de tabla/columna están en
`packages/db/src/schemas/vertical/addon-product.dbschema.ts` y `plan-catalog.dbschema.ts`.

## 8. Criterios de aceptación

- AC-1. Dado el informe, la issue HOS-2290 queda respondida con las 3 preguntas: (1) sí
  hay escritor, (2) no son comprables por web en ningún entorno, (3) no se retira nada
  ni se adelanta HOS-929 (Done).
- AC-2. Dado el resultado de Q2/Q3 en producción, si hay una instancia `ACTIVE` con
  `featured_now = false`, se abre una issue urgente de entrega; si no hay filas, se registra
  «sin instancias» en la issue.
- AC-3. El bloque de `CLAUDE.md` sobre `featuredByEntitlement` describe el escritor vigente
  (`syncListingFeatured`, listener, reconciliador diario) y que `syncFeaturedByEntitlementFor*`
  es código muerto (su borrado lo maneja la sesión epica-billing, fuera de este programa).
- AC-4. El comentario de `plan-comparison-rows.ts` ya no habla de «per-accommodation» ni de SPEC-309.
- AC-5. HOS-2094 lleva como criterio explícito: alerta de ficha oculta también para `UNA_VEZ`
  (R-2) y selector por nombre de ficha (R-3), y un e2e con los productos reales de 0176.

## 9. Plan de trabajo (tareas atómicas)

1. Correr Q1-Q5 en producción y pegar el resultado en la issue. (coordinador, 30 min)
2. Actualizar `CLAUDE.md` (bloque de `featuredByEntitlement`) y el comentario de
   `plan-comparison-rows.ts`. Commit aparte de docs. (1 h)
3. Comentar en HOS-2094 los criterios nuevos de AC-5. (30 min)
4. (Fuera de este programa) El borrado de `syncFeaturedByEntitlementFor*` lo maneja la sesión
   epica-billing, ya avisada; acá no se crea issue.
5. Cerrar HOS-2290 con el informe.

## 10. Preguntas abiertas y decisiones

Decidido (owner, 16/11/2026):

1. **Copy actual de la presentación y de `/funcionalidades` sobre el boost.** «Destacar 7 o
   30 días» queda como está y se vuelve verdadero cuando salga HOS-2094. Las otras tres
   afirmaciones falsas sí se corrigen en HOS-2284. Es la opción C del informe original
   (priorizar HOS-2094), sin retirar el copy.
2. **`syncFeaturedByEntitlementFor{Owner,Accommodation}` (vestigio sin llamador).** Lo maneja
   la sesión epica-billing; no se crea issue en este programa.

Sin preguntas abiertas.

## 11. Dependencias

- HOS-2094 (compra web del pago único): bloquea que el destacado sea comprable.
- HOS-929 y HOS-1357 están **Done**: no bloquean nada. La issue HOS-2279 los marca como
  bloqueantes y esa marca está vencida (ver spec de HOS-2279).
- HOS-1352 (pase final del catálogo): este informe no toca catálogo.
- Sesión epica-billing: dueña del borrado del código muerto `syncFeaturedByEntitlementFor*`.
- HOS-2288 (destacado de evento) y HOS-2292 (elegibilidad de add-ons): no bloquean este
  informe; HOS-2288 queda fuera de su alcance y usa otra clave y otra lectura.

## 12. Smoke y Novedades

- Sin etiqueta de smoke propia: es verificación y docs. Si Q3 encontrara una instancia mal
  entregada, la issue de arreglo lleva `status-needs-smoke-staging`.
- Sin entrada de Novedades.

## 13. Linear

Canonical tracking:
HOS-2290
