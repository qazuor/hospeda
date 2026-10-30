# FASE 5 · Agente 4 · Superficies (web y admin) y el Eje 2

- **Área**: superficies de `apps/web` y `apps/admin` (fichas públicas de las tres verticales con ficha y de
  Partner, Mi Cuenta, pricing, checkout, pantallas admin de las acciones administrativas), cómo se decide
  hoy si una ficha es pública, la página de Partner gold/silver (HOS-294), revalidaciones ISR, i18n de lo
  que el diseño agrega, y los módulos de cada vertical (Eje 2).
- **Código de referencia**: `origin/staging` en `35e2d63e81` (`35e2d63e819d087cb871392ec923158b91630f30`),
  leído con `git show` / `git grep` desde el worktree del programa.
- **Fecha**: 2026-09-30.
- **Criterio**: `DEC-METH-017` (reglas de la FASE 5). Citas del diseño con archivo y §; citas del código
  con `ruta:línea` sobre `origin/staging`.

---

## Resumen

Conteo por categoría, sacado con script sobre la columna «cat.» de las tablas de este informe (el comando
está en «búsquedas de ausencia», B-10):

| categoría | piezas |
|---|---|
| CONFIRMA | 6 |
| CONTRADICE | 8 |
| FALTA | 9 |
| ADAPTAR | 10 |
| DELETE (lote N) | 13 |
| **total** | **46** |

**Las ALTA** (siete):

1. **F5-SUP-002** · Gastronomía y Experiencia no tienen un «publicar» ni un «despublicar» propio: publicar
   ES pagar (`start-subscription`), que es lote N. Después de `U1` esas dos verticales no tienen ningún
   camino para `PB1`/`PB6`.
2. **F5-SUP-005** · La web lee UN conjunto de entitlements por usuario, con UN plan, sin vertical
   (`entitlements-cache.ts`); el diseño pide todo por `user + vertical` y lo global como global.
3. **F5-SUP-010** · El diseño agrega a las tres tablas «el estado del cap. 03 §9» y no dice qué pasa con
   `lifecycle_state` + `visibility`, que son HOY el único criterio de «público» (150 usos en 104 archivos).
4. **F5-SUP-015** · Un admin con `ACCOMMODATION_UPDATE_ANY` publica la ficha de otro y le arranca el trial
   al dueño; el núcleo lo prohíbe.
5. **F5-SUP-017** · El admin borra (soft y hard) y restaura fichas por rutas propias, fuera de `PB9`/`PB12`:
   un borrado así no corre `A6` y el addon `LISTING` sigue cobrando.
6. **F5-SUP-018** · El cron `archive-abandoned-drafts` archiva borradores de alojamiento a los 30 días por
   `updated_at` (y le saca el rol HOST al dueño): un segundo reloj de retención que el diseño no nombra.
7. **F5-SUP-020** · Ninguna transición de la máquina de publicación manda revalidar el caché de páginas;
   los hooks de hoy disparan sobre `lifecycle_state`/`visibility`, que el diseño deja de mover.

---

## 1. Los ocho ítems del Eje 2, citados del núcleo

`NUCLEO/01-glosario.md` §4.3, *«La lista, completa»* — cita textual:

> Ocho decisiones, cada una con el § que la habilita:
>
> | # | decisión legítimamente por vertical |
> |---|---|
> | 1 | **Qué evento activa el trial** |
> | 2 | **Qué recurso publica**, y si publica alguno |
> | 3 | **Qué sección aporta a Mi Cuenta** |
> | 4 | **Qué claves de entitlement y de limit tienen sentido** en ella |
> | 5 | **Qué camino de alta admite**: self-service o administrado |
> | 6 | **Si hereda los beneficios de Turista VIP** |
> | 7 | **Qué métodos de pago admite** |
> | 8 | **Su página de pricing** |
>
> **Todo lo demás es Eje 1** […]

Y la regla de verificación (§4.4): *«Toda pieza que nombre una vertical y no implemente uno de los ocho
ítems es una violación del §7.»* La instancia por vertical está en `V/10` §1 (tabla de cinco verticales ×
ocho ítems), con la conclusión de `V/10` §1.1: *«Alojamiento, Gastronomía y Experiencia son idénticas en
siete de los ocho ítems»* y *«no pueden justificar una sola línea de código separado»*.

**Cómo aplico la regla 4 del criterio** en cada pieza de este eje: una pieza propia de una vertical **no se
penaliza por no ser genérica** si vive en el módulo de esa vertical; se le pide que sea correcta, que esté
testeada y que represente el modelo nuevo. En cada fila de la tabla del §2 la columna *«regla 4»* dice
cuál de las tres condiciones falla, si falla alguna.

---

## 2. Eje 2: una pieza por ítem

| id | ítem | cat. | sev. | lo que dice el diseño | lo que hace el código | regla 4 y argumento | unidad |
|---|---|---|---|---|---|---|---|
| F5-SUP-001 | 1 (Alojamiento) | CONFIRMA | BAJA | `V/10` §1 fila 1: el evento de Alojamiento es *«publicar una ficha»*; `V/03` §9 `PB1`: publica si está cubierto **o si esta publicación dispara `T1`**, y si no, *«suscribite para publicar»* | `apps/api/src/routes/accommodation/protected/publish.ts:25-45`: *«It DOES start the free trial when the owner still has one in this vertical […] The clock starts when the listing goes live»*; veredictos `first_publish` / `has_active_sub` / `subscription_required`; `packages/service-core/src/services/accommodation/accommodation.service.ts:1891` (`publish`) | **Vive en el módulo de Alojamiento, está testeado** (12 archivos de test con `first_publish`, B-6) **y el concepto representa el modelo nuevo**: publicar arranca el trial. Lo que NO se conserva es el mecanismo —la fila local en `billing_subscriptions` vía `buildAccommodationPublishDeps(() => getQZPayBilling())` (`publish.ts:17-23`), que es lote N—, así que confirma la regla, no el código. Ver F5-SUP-015 y 016 para lo que el mismo método hace mal | V4, V6 |
| F5-SUP-002 | 1 y 2 (Gastronomía, Experiencia) | FALTA | **ALTA** | `V/10` §1 filas 1 y 2: las dos publican *«una ficha»* y el evento es *«publicar una ficha»*, idénticas a Alojamiento; `V/03` §9 `PB1` y `PB6` (el dueño publica / despublica); `V/19` §4 fila 25 (confirmación de despublicar) | No hay ruta de publicar ni de despublicar en `apps/api/src/routes/gastronomy/protected` ni en `.../experience/protected` (búsqueda B-1). Publicar es pagar: `apps/api/src/routes/commerce/protected/start-subscription.ts:1-10` (*«Owner-scoped commerce checkout endpoint»*) y `trial-verdict.ts:16-18` (*«'Publicar' : 'Publicar y pagar'»*); la visibilidad la pone el reconciliador de billing (`packages/service-core/src/services/commerce/commerce-visibility.ts:7-14`) | **Falla «representa el modelo nuevo»**: en estas dos verticales la publicación es un efecto del cobro, no un acto del dueño. Y como `start-subscription` y el reconciliador son lote N (lista del §6), **después de `U1` el dueño de un restaurante o una experiencia no tiene ningún camino para publicar**. El diseño no lo dice porque supone que las tres verticales comparten el camino de Alojamiento (`V/10` §1.1), que en código no existe para dos de ellas | V6, V8 |
| F5-SUP-003 | 2 | CONFIRMA | BAJA | `V/02` §2.5: *«`listing` son las filas que ya existen […] `accommodations` […] `gastronomies` […] `experiences`»*; `V/02` §2.7: el contenido de la presencia de Partner vive en `partners` | Tablas `packages/db/src/schemas/accommodation/accommodation.dbschema.ts`, `.../gastronomy/`, `.../experience/experiences.dbschema.ts`; editores por vertical en `apps/web/src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/*` (12 páginas) y `.../comercio/[vertical]/[id]/editar/*` (13 páginas, compartido entre las dos por parámetro) | **Regla 4 cumplida**: cada contenido vive en su módulo; los editores tienen tests (`apps/web/test/components/host`: 78 archivos; `.../commerce`: 35, B-7). Que el editor de Gastronomía y Experiencia sea uno parametrizado es reutilización, no divergencia. La palabra del agrupamiento viejo en rutas y componentes (132 rutas en `apps/web`, B-8) es de `U1`, no de esta pieza | U1 (el nombre) |
| F5-SUP-004 | 3 | ADAPTAR | MEDIA | `V/10` §1 fila 3: cada vertical tiene sección en Mi Cuenta; `V/19` §4 filas 2, 18, 19, 20, 22, 24, 25, 30, 31: lo que la sección tiene que decir sobre cada estado de la ficha o de la presencia | Existen `mi-cuenta/propiedades/index.astro`, `mi-cuenta/comercio/index.astro`, `mi-cuenta/partner/index.astro`, `mi-cuenta/host-dashboard.astro` (listado de B-9) | **Regla 4: vive en el módulo y es legítimo que difiera; falla «representa el modelo nuevo»**: las secciones conocen `DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED` y no `UNPUBLISHED_BY_BILLING`, `MODERATED` ni `PURGED`, ni ninguno de los avisos del §4. Es adaptar, no reescribir: la estructura por vertical es la que el diseño pide | V8 |
| F5-SUP-005 | 4 | CONTRADICE | **ALTA** | `B/19` §3: *«cada cosa que se muestra dice en qué vertical vale […] Una pantalla que liste "tu suscripción" sin decir cuál no es ambigua: es incorrecta»*; *«lo global se muestra como global»*; `V/19` §1: la UI y el backend preguntan lo mismo al mismo lugar | `apps/web/src/lib/entitlements-cache.ts:27-35`: `EntitlementsData = { entitlements: string[]; limits; plan: {slug,name,status} \| null }`, leído de `GET /api/v1/protected/users/me/entitlements` (`:82`). Un solo conjunto y **un solo plan** por usuario; 149 archivos de `apps/web/src` nombran entitlements (B-2) | **Falla «representa el modelo nuevo»**: la forma no puede expresar dos verticales con planes distintos ni una clave global. No es de un módulo de vertical: es el lector común de todas las superficies, así que la regla 4 no la ampara. Corregir el código (la forma del lector y su endpoint); el diseño está bien | V3, V8, B13 |
| F5-SUP-006 | 5 (Partner) | CONTRADICE | MEDIA | `V/02` §2.7: `postulacion` es una entidad nueva con tres estados (`PENDIENTE`·`APROBADA`·`RECHAZADA`), `partner_id`, índice único parcial por correo en `PENDIENTE` y trigger de espera; `V/18` §2.4: reclamo con sesión y secreto de un solo uso con su hash en `partner.secreto_de_reclamo` | Ya existe una postulación: `packages/db/src/schemas/alliance/alliance_lead.dbschema.ts:32` (`kind`, `'partner'` entre cuatro), `:52` (`status` con **cuatro** valores `pending`·`reviewing`·`approved`·`rejected`), `:175` (`provisioned_partner_id`); aprobación en `apps/api/src/routes/alliance/admin/approve-and-provision-partner.ts:100`; reclamo con token de un solo uso y 404 uniforme en `apps/api/src/routes/alliance/protected/claim.ts:1-22,104`; formulario público `apps/web/src/pages/[lang]/sumate/partner/index.astro:1-12` | **El diseño no nombra `alliance_leads` en ningún capítulo** (B-3: una sola mención, sobre `alliance_leads.partner_type`, para la limpieza de `U1`). Supone una entidad nueva donde hay una con otra forma (cuatro estados, un `kind` que mezcla sponsor/editor/proveedor, token guardado de otra manera). **Qué corregir lo decide el owner**: o el diseño adopta `alliance_leads` (y dice cómo mapea `reviewing` y los otros `kind`), o `V7` la reemplaza y la borra. Regla 4: el camino administrado es legítimo de Partner; lo que falla es que el diseño y el código describen dos cosas | V7 |
| F5-SUP-007 | 6 | DELETE | — | lote N (`16-` §4.6 punto 1: *«el archivo de configuración de planes y lo que lo lee»*) | `packages/billing/src/config/plans.config.ts:66` (`TOURIST_VIP_ENTITLEMENTS`) y `:130` (se esparce en los planes de dueño) | Lote N. La herencia vuelve como dato declarado en base (`V/10` §1 fila 6) | U1 |
| F5-SUP-008 | 7 (Partner) | DELETE | — | lote N; y `V/18` §3: *«No: `if partner -> cash`»* | `apps/api/src/routes/partners/admin/manual-payment.ts:14-24`: *«Registers a manual payment for a partner (activates without QZPay)»* | Lote N. Es literalmente la rama que el §17.2 prohíbe; se va con `U1` y vuelve como método de pago por plan (`MP1`–`MP6`) | U1 |
| F5-SUP-009 | 8 | ADAPTAR | MEDIA | `B/19` §7: una pricing por vertical, Turista incluida, que lee *«la versión vigente y vendible, nada más»*; el botón sigue la regla de `V/19` §4 fila 23 (publicar / checkout / ninguno) | Cinco páginas, una por vertical: `apps/web/src/pages/[lang]/planes/{turistas,anfitriones,gastronomia,experiencias,aliados}/precios/index.astro`; los datos de `GET /api/v1/public/plans` (`apps/web/src/lib/billing/audience-plans.ts:24`), catálogo viejo; el CTA por defecto va al checkout (`apps/web/src/components/billing/AudiencePricingSections.astro:62,77`) | **Regla 4 cumplida en la estructura** (una página por vertical, en su lugar). **Falla «representa el modelo nuevo»** en la fuente de datos (lote N) y en el botón, que no conoce el caso *«mandar a publicar»* ni el de *«sin planes disponibles»* (fila 29). Adaptar la página; la fuente se reemplaza | V8, B13 |

---

## 3. Cómo se decide hoy si una ficha es pública, y qué lo reemplaza

| id | cat. | sev. | lo que dice el diseño | lo que hace el código | argumento | unidad |
|---|---|---|---|---|---|---|
| F5-SUP-010 | FALTA | **ALTA** | `V/02` §2.5: `listing` guarda *«estado del cap. 03 §9»* y se agregan columnas a las tres tablas; `V/03` §9: seis estados, trece transiciones. El único lugar donde el diseño nombra `lifecycle_state`/`visibility` es la tabla de traducción del corte (`V/21` §2.4, `L2`–`L8`), que los **lee** una vez (B-4) | «Público» es hoy `lifecycleState = ACTIVE` **y** `visibility = PUBLIC`: `accommodation.service.ts:969-977` (`_isPubliclyVisible`), `packages/service-core/src/services/commerce/commerce-revalidation.ts:64-69`, `apps/api/src/lib/indexnow-visibility.ts:51-58` (*«The repo-wide definition of "the public site serves this"»*). `LifecycleStatusEnum.ACTIVE` aparece 150 veces en 104 archivos fuera de tests; `VisibilityEnum.PUBLIC`, 61 en 47 (B-5) | **El diseño agrega el estado nuevo y no dice qué pasa con los dos viejos**: si conviven, hay dos fuentes de verdad sobre «publicada» y cada lectura pública de hoy sigue mirando la vieja; si el estado nuevo las reemplaza, hay que decirlo y migrar 104 archivos; si las transiciones escriben las dos, hay que decirlo en cada fila de `PB`. Ninguna de las tres está escrita. Sin la decisión, `V6` puede terminar con la máquina verde en sus tests y el sitio mostrando lo que dicen las columnas viejas. **Corregir el diseño** (`V/02` §2.5 y `V/03` §9) | V6 |
| F5-SUP-011 | ADAPTAR | MEDIA | `16-` §4.6 punto 1 y `V/21` §2.4: `owner_suspended`, `plan_restricted` y `billing_unpublished_at` sobreviven a `U1` y las borra una migración posterior a la clasificación de `V6` | Sus lectores fuera del cobro: `packages/db/src/models/accommodation/accommodation.model.ts:636,641,793,797,981,985,1221,1223`; `packages/service-core/src/services/accommodation/accommodation.permissions.ts:170,185`; `.../destination/destination.service.ts:627-628,1337-1338`; `.../owner-promotion/ownerPromotion.visibility.ts:27-28`; `apps/api/src/routes/accommodation/public/similar.ts:183-184` | El diseño nombra las columnas y la migración que las borra, **no a quién las lee**. Después de `U1` nadie las escribe (los escritores son del cobro viejo), así que los filtros quedan en `false` y son inocuos hasta el paso 3; ahí la migración las saca y esos lectores rompen el build. Hay que sacarlos en el mismo cambio que la migración, y **decidir antes con qué los reemplaza** la lectura pública (depende de F5-SUP-010) | V6 |
| F5-SUP-012 | CONFIRMA | BAJA | `V/18` §1.6 y `V/17` §1.2 precisiones 1 y 7: ajeno, archivado e inexistente son indistinguibles desde afuera | `accommodation.permissions.ts:156-163`: una ficha no `ACTIVE` lanza `entityNotFoundError` a quien no es dueño ni tiene `ACCOMMODATION_VIEW_ALL`; lo mismo `:169-176` y `:184-190` para las marcas | El patrón del 404 que el diseño pide ya está, para Alojamiento. Se conserva el patrón; las condiciones cambian con F5-SUP-010 | V5 |
| F5-SUP-013 | CONTRADICE | BAJA | `V/21` §2.4: *«`moderation_state` […] la columna nunca gobernó la visibilidad —el código de hoy lo dice (`accommodation.service.ts`: ninguna lectura pública filtra por `moderationState`)»* | Cierto para Alojamiento (`apps/api/src/routes/accommodation/admin/moderate.ts:19-25`: *«It does not gate public visibility»*). **Falso para Gastronomía y Experiencia**: `commerce-visibility.ts:261` (`moderationRejected`) y `:285` (`shouldBePublic = planCoversListing && complete && !moderationRejected`) | La afirmación generaliza a las tres tablas algo medido en una. No mueve el corte porque las otras dos tienen cero filas y el recuento de `B/21` §1.3 detiene el corte si aparece una. **Corregir el diseño** (la frase) | V6 |
| F5-SUP-014 | ADAPTAR | MEDIA | `V/03` §9 `PB10`, `PB11`, `PB13` y *«la moderación en dos niveles»*; `V/02` §2.5 `pedido_de_arreglo`; `NUCLEO/08` §3, fila de moderar, con motivo | Existen rutas de moderación de la ficha que escriben sólo `moderationState`: `apps/api/src/routes/accommodation/admin/moderate.ts:1-7`, `apps/api/src/routes/gastronomy/admin/moderate.ts`, `apps/api/src/routes/experience/admin/moderate.ts:1-9` (una sola implementación en `BaseCommerceListingService`) | Hay superficie, permiso propio (`ACCOMMODATION_MODERATION_CHANGE`, `COMMERCE_MODERATION_CHANGE`) y motivo; falta el estado `MODERATED`, los dos niveles, el origen para volver y el pedido de arreglo. **Y el diseño no dice qué pasa con la columna `moderation_state`** después del corte (sólo que no se traduce): conviviría con `MODERATED` sin que nadie la lea | V6, V8 |
| F5-SUP-015 | CONTRADICE | **ALTA** | `NUCLEO/08` §3: *«un acto de un actor distinto del dueño nunca es "el dueño publica", así que no ejerce el evento de activación ni dispara `T1`»*; acción 15: editar *«sin publicar»* | `publish.ts:59`: `bypassPermission: PermissionEnum.ACCOMMODATION_UPDATE_ANY` (y `unpublish.ts:43`); `accommodation.service.ts:1911-1913`: `isAdmin` por ese permiso habilita publicar, y `:1961` corre la elegibilidad del **dueño**, que con `first_publish` le arranca el trial. Además el formulario admin ofrece `lifecycleStatus` e `isPublished` editables con `ACCOMMODATION_PUBLISH` (`apps/admin/src/features/accommodations/config/sections/states-moderation.consolidated.ts:42,74`) | Hoy un admin puede publicar la ficha de otro y gastarle el trial de por vida. El diseño lo prohíbe con todas las letras. **Corregir el código**: la ruta de publicar no admite actor distinto del dueño, y la sección admin deja de exponer el estado | V5, V6 |
| F5-SUP-016 | CONTRADICE | MEDIA | `V/17` §4.3: ninguna autorización decide sólo por rol; las exenciones del owner son `permanent_grant` (`B/21` §2.4) | `accommodation.service.ts:276` (`holdsBillingExemptRole`) y su uso en `publish` (`:1945`): un dueño con rol ADMIN/SUPER_ADMIN/CLIENT_MANAGER publica sin cobertura ni trial | Una rama por rol dentro de la transición de publicar. En el diseño esa gente queda cubierta por un grant, que es una fuente como cualquier otra. **Corregir el código** en la reescritura de `PB1` | V6 |
| F5-SUP-017 | CONTRADICE | **ALTA** | `NUCLEO/08` §3: *«ningún borrado de ficha sale de otra fila que `PB9` o `PB12`, que es lo que hace correr `A6`»*; acción 23: el admin borra **a pedido del dueño y con motivo**, corriendo `PB12`; `V/03` §9: `PURGED` es final | Rutas admin propias: `apps/api/src/routes/accommodation/admin/delete.ts:24,39` (`softDelete`), `.../hardDelete.ts:25` (`ACCOMMODATION_HARD_DELETE`), `.../restore.ts:23,38`; lo mismo en `apps/api/src/routes/gastronomy/admin/{delete,hardDelete,restore}.ts` (B-9) | Tres caminos que el diseño no tiene: borrar sin `PB12` (sin `A6`, **así que el addon `LISTING` de esa ficha sigue cobrando**), borrar físico (se lleva reseñas de terceros que el §4.1 conserva) y restaurar desde borrado (contra `PURGED` final). Mueve plata si nadie lo ve | V6, V5 |
| F5-SUP-018 | CONTRADICE | **ALTA** | `V/03` §9 `PB5`: `DRAFT` → `ARCHIVED` a los `N` meses sobre `inactiva_desde` o el fin de la última pausa, con la versión de plazos de la ficha, relee cobertura y `retenciónDetenida`, avisa antes; `V/21` §2.4 `L3`: `ARCHIVED` viejo nace `DRAFT` | `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts:45` (`ARCHIVE_THRESHOLD_DAYS = 30`), `:288` (escribe `lifecycleState: ARCHIVED` sobre `updated_at`), `:384` (`revokeRole`: le saca el rol HOST al dueño); registrado en `apps/api/src/cron/registry.ts:14,83` | **Ningún capítulo de las épicas, del núcleo ni de `16-` lo nombra** (B-11: sólo aparece en el inventario de la FASE 1B). Es un segundo reloj de retención, propio de Alojamiento (no es ninguno de los ocho ítems, así que es Eje 1 con vertical: la violación del §7 que el núcleo §4.4 describe), con otro plazo, otro origen y otra columna, y que además toca roles. No es cobro viejo, así que `U1` no lo borra. Si sigue vivo después del corte, archiva a los 30 días lo que `PB5` protege y deja fichas `ARCHIVED` en la columna vieja que la máquina nueva no ve | V9 |
| F5-SUP-019 | ADAPTAR | BAJA | `V/19` §4 fila 21 (*«suscribite para publicar»*) y fila 29 (*«esta vertical no tiene planes disponibles»*, sin botón de suscribirse) | `apps/web/src/components/host/PublishButton.client.tsx:268` y `apps/web/src/components/host/editor/PublishReadyDialog.client.tsx:85`: ante `403 subscription_required` manda a la página de planes | La fila 21 existe para Alojamiento; la 29 no (no hay caso *«sin versión vendible»*). Es un agregado chico sobre un componente del módulo de Alojamiento | V8 |
| F5-SUP-020 | FALTA | **ALTA** | `V/03` §9 no le pide a ninguna transición que revalide páginas (B-12: cero menciones en el capítulo); el corte sí supone que existe: `V/21` §2.4 (tachado) *«la revalidación que `PB2` habría programado»*, y `16-` §4.2 paso 4c purga `list-accom`/`list-gastro`/`list-exp` y 22 destinos porque la escritura de nacimiento *«no es una transición»* | Los hooks que purgan disparan sobre las columnas viejas: `accommodation.service.ts:1091,1203,1319` (`_isPubliclyVisible` antes/después del cambio), `commerce-revalidation.ts:109` (`if (!isCommerceListingPubliclyVisible(entity)) return;`) | El diseño da por hecho que una transición de publicación programa la purga, y no lo escribe en ninguna fila. El código la programa cuando cambian `lifecycleState`/`visibility`, que las transiciones nuevas no mueven (F5-SUP-010). **Si nadie lo ve, `PB2`, `PB4`, `PB9` y sobre todo `PB10` (la moderación) dejan la página servida desde el borde hasta que venza su clase de caché**. Corregir el diseño (`V/03` §9: qué transiciones revalidan) y adaptar los hooks | V6, V9 |
| F5-SUP-021 | CONFIRMA | BAJA | `16-` §4.2 paso 4c: la etiqueta de colección por tipo (`packages/cache-tags/src/vocabulary.ts:84`) y la purga por destino (`packages/service-core/src/revalidation/entity-tag-mapper.ts:75`) | `vocabulary.ts:84-91` (`CACHE_TAG_COLLECTIONS`: `list-accom`, `list-gastro`, `list-exp`, …); `entity-tag-mapper.ts:68-80` (colección + home + página del destino) | Las dos citas del diseño son exactas. El mecanismo (servicio de revalidación, etiquetas) se conserva; ver la plantilla del PDR en el §5 | V6 |
| F5-SUP-022 | CONFIRMA | BAJA | `V/21` §2.4: *«`gastronomies` y `experiences` no tienen `billing_unpublished_at`, `owner_suspended` ni `plan_restricted` […] y `experiences` tiene en cambio `has_active_subscription`»* | `packages/db/src/schemas/experience/experiences.dbschema.ts:238` (`has_active_subscription`); las tres columnas no están en `packages/db/src/schemas/gastronomy` ni `.../experience` (B-13) | Exacto. `has_active_subscription` es una copia de billing: se va con lote N (`B/21` §4, *«las columnas que las copian»*) | U1 |

---

## 4. Partner: página gold, carrusel y postulación

| id | cat. | sev. | lo que dice el diseño | lo que hace el código | argumento | unidad |
|---|---|---|---|---|---|---|
| F5-SUP-023 | ADAPTAR | MEDIA | `V/18` §1.6: presencia sin máquina; sin la clave o **moderada** responde **404**; *«El código de hoy responde 410 al partner revocado, y la migración lo cambia»* (y `V/21` §4); el bit de moderación es una columna de `partners` (`V/18` §1.6 ⚠️ punto 2) | `packages/service-core/src/services/partner/partner.service.ts:627` (`if (partner.revokedAt) return { outcome: 'gone' }` → 410); `apps/web/src/pages/[lang]/partners/[slug].astro:62` (`status === 410 ? 410 : 404`); revocar escribe `lifecycleState = INACTIVE` + `revokedAt` (`partner.service.ts:950-981`) | **El diseño leyó bien el código** (la afirmación sobre el 410 se confirma) y dice qué cambiar. Falta la columna del bit (no existe: la revocación usa `revoked_at` + `lifecycle_state`). Adaptar: `revokedAt` pasa a ser el bit, la respuesta pasa a 404 en la API y en la página | V7 |
| F5-SUP-024 | ADAPTAR | MEDIA | `V/18` §1.2 y §1.6: la página pregunta por la clave *«página propia»* (Gold) y el carrusel por *«presencia en el carrusel»* (Gold y Silver), desde el caché del conjunto efectivo, **y** que no esté moderada | Página: `partner.service.ts:599` (`tier !== GOLD` → 404) y `:604-605` (`lifecycleState === ACTIVE && subscriptionStatus === ACTIVE`). Carrusel y listados: `packages/db/src/models/partner/partner.model.ts:93-94,174-175,254-255` (el mismo par) y orden por `tier` (`:140-142`) | Hoy la regla es *«tier gold + suscripción activa»* leída de dos columnas denormalizadas del cobro viejo (`subscription_status` copia `partner_subscriptions`, que `B/21` §4 retira con lote N). El resultado coincide con el diseño (Silver sin página, 404 al que deja de pagar), la fuente no. **Después de `U1` la columna desaparece y estas lecturas tienen que cambiar sí o sí**; son tres consultas y una rama | V7 |
| F5-SUP-025 | FALTA | BAJA | `V/02` §2.7: `UNIQUE(owner_user_id)` donde no es nulo, y `secreto_de_reclamo`; *«Hoy el índice sobre la columna es común, no único (código actual)»* | `packages/db/src/schemas/partner/partner.dbschema.ts:77` (`owner_user_id`, anulable), `:229` (`index(...)`, no `uniqueIndex`); no hay columna de secreto en `partners` (el token del reclamo vive en `alliance_leads`, F5-SUP-006) | La afirmación del diseño sobre el índice se confirma; lo que falta es la restricción. Cero filas de Partner, así que la migración no tiene población | V7 |

---

## 5. Admin, avisos, i18n y la capa de composición

| id | cat. | sev. | lo que dice el diseño | lo que hace el código | argumento | unidad |
|---|---|---|---|---|---|---|
| F5-SUP-026 | ADAPTAR | MEDIA | `V/19` §6: postulaciones atrasadas y aprobadas sin reclamar; `V/02` §2.7: *«aprobada sin reclamar»* = `APROBADA` + `owner_user_id` nulo | `apps/admin/src/routes/_authed/platform/alliance-leads/index.tsx` (listado de `alliance_leads`, B-9) | Hay panel; no marca atrasadas ni aprobadas sin reclamar. Depende de la decisión de F5-SUP-006 | V7, V8 |
| F5-SUP-027 | FALTA | MEDIA | `V/19` §6: *«el listado de arreglos pendientes»* | No hay entidad `pedido_de_arreglo` ni pantalla (B-14) | Pieza nueva del diseño | V8 |
| F5-SUP-028 | FALTA | MEDIA | `V/19` §6 y `B/19` §6: el editor de planes y claves, el de precios, complementos, promos, y **los plazos de las dos mitades en una sola pantalla**; acciones 18 a 22 de `NUCLEO/08` §3, sólo `SUPER_ADMIN` | Las pantallas de hoy son del catálogo viejo: `apps/admin/src/routes/_authed/billing/{plans,addon-catalog,promo-codes,settings}.tsx` (lote N, §6) | No hay nada que adaptar: lo viejo se va con `U1` y lo nuevo no existe | V2, V8, B13 |
| F5-SUP-029 | ADAPTAR | MEDIA | `NUCLEO/08` §3 acción 15: editar el contenido de una ficha ajena **sin publicar, sin destacar y sin borrar**; `V/19` §4 fila 26: aviso al dueño de que soporte le editó la ficha, cuándo y qué partes | Editores admin: `apps/admin/src/routes/_authed/accommodations/$id_.edit.tsx`, `.../gastronomies/$id_.edit.tsx`, `.../experiences/$id_.edit.tsx`; la sección de estados deja cambiar `lifecycleStatus`/`isPublished` (F5-SUP-015) | Existe la edición; le sobra el estado y le falta el aviso al dueño (búsqueda B-14 del texto del aviso: cero) | V8 |
| F5-SUP-030 | CONTRADICE | MEDIA | `NUCLEO/08` §3 acción 24: **dar de baja** una cuenta a pedido del dueño, con motivo; *«la cuenta no se borra»* (caso I-C); `V/21` y `V/02` §4: la fila de trial y su seudónimo sobreviven | `apps/api/src/routes/user/admin/delete.ts:25` (`USER_DELETE`) y `.../hardDelete.ts:24` (`USER_HARD_DELETE`) | El borrado físico de una cuenta contradice que la cuenta no se borra y que su rastro de trial sobrevive. **Corregir el código** (o decir en el diseño qué queda de esas dos rutas) | V5, V9 |
| F5-SUP-031 | ADAPTAR | MEDIA | `NUCLEO/08` §3 acción 26: asignar o quitar `SUPER_ADMIN`, con motivo; su permiso *«viene sólo con el rol y no se da suelto: un override por usuario no lo puede dar»* | `apps/api/src/routes/user/admin/roles.ts:109,176` (`USER_UPDATE_ROLES`), `apps/api/src/routes/user/admin/permissions.ts` (overrides por usuario); pantallas `apps/admin/src/routes/_authed/access/users/$id_.permissions.tsx` | La asignación existe; le falta el motivo obligatorio y que los permisos de las filas 17-22 y 26 no se puedan dar por override | V5 |
| F5-SUP-032 | FALTA | MEDIA | `B/19` §6: listado accionable de marcas `requiere_conciliación` con motivo y propuesta, migraciones de planes retirados, versiones retiradas con cuántas suscripciones ancladas; `NUCLEO/08` §3: cortesía, grant, pago manual, confirmar impago, cancelar, pausar, cambiar de plan, reembolsar, asentar, extender trial, cada una con su confirmación | Todas las pantallas de hoy son del cobro viejo (`apps/admin/src/routes/_authed/billing/*`, lote N, §6) | Todo nuevo; se lista para que no se lea como «ya hay panel de billing» | B11, B12, B13, V4 |
| F5-SUP-033 | FALTA | MEDIA | `V/19` §4 filas 27, 28 y 35: alerta de precio cerrada al llegar la ficha a `PURGED`; conversación en sólo lectura sobre una ficha `PURGED` o que dejó de publicarse | `packages/service-core/src/services/conversation/*`: ninguna condición por estado de la ficha (B-15) | Superficie y regla nuevas | V8, V9 |
| F5-SUP-034 | FALTA | MEDIA | 23 filas vivas en `V/19` §4 y 31 en `B/19` §4 (54 avisos, contados con script, B-16), en `es`/`en`/`pt` | `packages/i18n/src/locales/{es,en,pt}` (69 archivos en `es`); ninguna de las frases textuales del diseño está (B-16, con control positivo) | Todo lo que el diseño manda decir es texto nuevo. Además `packages/i18n` nombra la palabra del agrupamiento viejo en 29 archivos (B-8), que es de `U1` | V8, B13, U1 |
| F5-SUP-035 | CONFIRMA | BAJA | `V/19` §1: *«la UI y el backend preguntan lo mismo, al mismo lugar»* | `apps/api/src/routes/accommodation/protected/publishEligibility.ts` y `apps/api/src/routes/commerce/protected/trial-verdict.ts:16-23`: la UI pregunta al backend el veredicto en vez de derivarlo | El patrón existe y el diseño lo pide. Los dos endpoints son del cobro viejo (lote N); se conserva la forma, no el código | V8 |

---

## 6. DELETE (lote N): el checkout y las pantallas del cobro viejo

Criterio: regla 1 de `DEC-METH-017`. Todo lo de esta lista lo borra `U1` por `16-` §4.6 punto 1 (*«sus
rutas (los checkouts, el cambio de plan, los addons y el receptor de avisos […]), sus crons, su adaptador
y todo lo que sólo el sistema viejo usa»*) o por `B/21` §4 (tablas viejas y *«las columnas que las
copian»*). Sin otro argumento.

| id | qué | dónde (`origin/staging`) |
|---|---|---|
| F5-SUP-D01 | checkout web y sus retornos | `apps/web/src/pages/[lang]/suscriptores/checkout/{index,success,failure,pending}.astro`; `apps/web/src/pages/[lang]/partners/checkout/pending.astro`; `apps/web/src/pages/[lang]/suscriptores/plan1.astro` (página interna de prueba del cobro) |
| F5-SUP-D02 | Mi Suscripción, addons y canje de promo de hoy | `apps/web/src/pages/[lang]/mi-cuenta/suscripcion/index.astro`, `.../mi-cuenta/addons/index.astro`, `.../mi-cuenta/canjear/{index,[code]}.astro` |
| F5-SUP-D03 | panel admin de billing | `apps/admin/src/routes/_authed/billing/*` (13 rutas: `addon-catalog`, `addons`, `exchange-rates`, `invoices`, `metrics`, `payments`, `plans`, `promo-codes`, `reconciliation`, `settings`, `subscriptions`, y las dos de F5-SUP-D12) y `apps/admin/src/routes/_authed/account/billing.tsx` — 14 archivos (B-9) |
| F5-SUP-D04 | checkout de Gastronomía y Experiencia | `apps/api/src/routes/commerce/{protected,admin}/start-subscription.ts`, `.../protected/{change-plan,downgrade-preview,trial-verdict}.ts` |
| F5-SUP-D05 | la publicación manejada por el cobro | `packages/service-core/src/services/commerce/commerce-visibility.ts` y `entity_subscriptions` (`packages/db/src/schemas/billing/entity_subscription.dbschema.ts`); `apps/api/src/services/accommodation-winback-republish.service.ts` |
| F5-SUP-D06 | la elegibilidad de publicar leída del cobro viejo | `apps/api/src/services/accommodation-publish-deps.ts` (entra por `publish.ts:10,21`) |
| F5-SUP-D07 | el catálogo que alimenta la pricing | `GET /api/v1/public/plans` y `packages/service-core/src/services/billing/plan/plan.service.ts` |
| F5-SUP-D08 | Partner cobrado por el camino viejo | `apps/api/src/routes/partners/admin/{manual-payment,review-payment,list-plans}.ts` (y F5-SUP-008) |
| F5-SUP-D09 | columnas de `partners` que copian billing | `partner.dbschema.ts:55-57` (`subscription_status`), `:60-65` (`plan_id`, `subscription_id`) |
| F5-SUP-D10 | el destaque curado y el del cobro | `accommodation.dbschema.ts:83` (`is_featured`) y `:92` (`featured_by_entitlement`), con sus lectores y escritores (`B/21` §4: *«ninguna ficha nace destacada»*) |
| F5-SUP-D11 | la herencia VIP y los pagos de Partner en configuración | F5-SUP-007 y F5-SUP-008 (listados arriba en el §2) |
| F5-SUP-D12 | patrocinios y promociones de dueño **bajo `/billing/`** | `apps/admin/src/routes/_authed/billing/{sponsorships,owner-promotions}.tsx`: **sólo si** son del cobro viejo — ver *«lo que no pude cerrar»*, punto 1 |

*(D11 remite a dos filas del §2 y no se cuenta aparte; el total de DELETE del resumen son las once
filas D01–D10 y D12, más F5-SUP-007 y F5-SUP-008: **13**.)*

Excepción de la regla 1: `owner_suspended`, `plan_restricted` y `billing_unpublished_at` **no** están en
esta lista: sobreviven hasta el paso 3 del corte (F5-SUP-011).

---

## 7. La plantilla del PDR, para lo que el diseño conserva de fuera del cobro viejo

Las cinco condiciones del KEEP de `00-PDR.md` (FASE 5): correcto, genérico, bien testeado, usable por
todas las verticales necesarias, representa el modelo nuevo. Con la regla 4 para lo que es Eje 2.

| pieza conservada | veredicto | condición que decide |
|---|---|---|
| el servicio de revalidación y el vocabulario de etiquetas (`packages/service-core/src/revalidation/`, `packages/cache-tags/`) | **KEEP** el mecanismo | cumple las cinco para la purga en sí; los **disparadores** son ADAPT (F5-SUP-020) |
| las tablas de ficha como `listing` (`V/02` §2.5) | **ADAPT** | no representan el modelo nuevo hasta que se resuelva F5-SUP-010 |
| las páginas públicas de ficha por vertical (`alojamientos`, `gastronomia`, `experiencias`) | **KEEP** (regla 4, ítem 2) | propias de cada vertical, en su módulo; leen la API pública; su criterio de visibilidad es del backend |
| los editores de ficha del dueño (web) | **ADAPT** | regla 4 cumplida; falta representar los estados y avisos nuevos (F5-SUP-004) |
| el 404 indistinguible de la lectura de alojamiento | **KEEP** el patrón | F5-SUP-012 |
| la página de Partner y el carrusel | **ADAPT** | la regla cambia de fuente, no de forma (F5-SUP-023, 024) |
| `alliance_leads` y su reclamo | **decide el owner** entre ADAPT y REWRITE | F5-SUP-006: el diseño no la considera |
| las pantallas admin de moderar y de editar ficha ajena | **REWRITE** la moderación, **ADAPT** la edición | la moderación cambia de modelo (estado + dos niveles + pedido); la edición sólo pierde el estado y gana el aviso |
| el cron `archive-abandoned-drafts` | **DELETE** propuesto (no es lote N: lo decide el owner) | F5-SUP-018 |

---

## Búsquedas de ausencia

Todas sobre `origin/staging` (`35e2d63e81`), desde el worktree del programa, con
`R=origin/staging`.

- **B-1** · Gastronomía y Experiencia sin publicar/despublicar propio (F5-SUP-002).
  `git ls-tree -r --name-only $R -- apps/api/src/routes/experience/protected apps/api/src/routes/gastronomy/protected | grep -i -E "publish|lifecycle|visib|state"`
  → sin salida (exit 1). **Control positivo**: el mismo patrón sobre
  `apps/api/src/routes/accommodation/protected` devuelve `publish.ts`, `publishEligibility.ts` y
  `unpublish.ts`.
- **B-2** · Lector de entitlements de la web (F5-SUP-005).
  `git grep -l -i "entitlement" $R -- apps/web/src | wc -l` → 149; `git grep -n "api/v1\|domain\|vertical" $R:apps/web/src/lib/entitlements-cache.ts`
  → una sola URL (`/api/v1/protected/users/me/entitlements`), ninguna mención de dominio ni vertical.
- **B-3** · El diseño no nombra `alliance_leads` (F5-SUP-006).
  `rg -n -c "alliance|alliance_leads|provisioned_partner" HOS-1353*/ HOS-1354*/ HOS-1352*/docs/nucleo HOS-1352*/docs/12-contrato-de-cobertura.md HOS-1352*/docs/16-fase-7-del-paraguas.md`
  → dos hits: `V/descomposicion.md:485` y `V/21-migracion.md:550`, los dos sobre la limpieza de
  `U1` (`alliance_leads.partner_type`), ninguno sobre la postulación.
- **B-4** · El diseño no dice qué pasa con `lifecycle_state`/`visibility` (F5-SUP-010).
  `rg -n "lifecycle|visibility|lifecycleState|VisibilityEnum" HOS-1353*/docs HOS-1354*/docs HOS-1352*/docs/nucleo HOS-1352*/docs/12-contrato-de-cobertura.md`
  → sólo las filas `L2`–`L6` de `V/21-migracion.md:236-240` (la tabla de traducción).
- **B-5** · Conteo de lectores del criterio viejo (F5-SUP-010, 011).
  `git grep -c "<patrón>" $R -- apps packages | grep -v '/test/\|\.test\.' | awk -F: '{s+=$NF;n++} END{print s, n}'`
  → `LifecycleStatusEnum.ACTIVE`: 150 en 104 archivos; `VisibilityEnum.PUBLIC`: 61 en 47;
  `ownerSuspended`: 287 en 141; `planRestricted`: 599 en 151 (la mayoría, snapshots de migraciones:
  719 ocurrencias en `packages/db/src/migrations` para los dos juntos). *(Nota: un primer intento con
  pathspec `'apps/*/src'` dio cero; el pathspec de git no expandía así. Se repitió con `apps packages` y
  se validó contra `apps/api/src/lib/indexnow-visibility.ts`, que tiene un uso conocido.)*
- **B-6** · Tests del arranque del trial al publicar (F5-SUP-001).
  `git grep -l "first_publish" $R -- packages/service-core/test apps/api/test apps/web/test | wc -l` → 12.
- **B-7** · Tests de los editores por vertical (F5-SUP-003).
  `git ls-tree -r --name-only $R -- apps/web/test/components/<dir> | grep -c -E '\.test\.tsx?$'` →
  `host` 78, `commerce` 35, `billing` 34.
- **B-8** · La palabra del agrupamiento viejo (F5-SUP-003, 034).
  `git grep -l -i commerce $R -- <dir> | wc -l` y `git ls-tree -r --name-only $R -- <dir> | grep -i -c commerce`
  → `apps/web` 344 archivos / 132 rutas; `apps/admin` 73 / 16; `packages/i18n` 29 / 4.
- **B-9** · Inventario de rutas (varias). `git ls-tree -r --name-only $R -- apps/web/src/pages`,
  `-- apps/admin/src/routes`, `-- apps/api/src/routes/{accommodation,gastronomy}/admin`; el panel de
  billing: `git ls-tree -r --name-only $R -- apps/admin/src/routes/_authed/billing apps/admin/src/routes/_authed/account/billing.tsx | wc -l` → 14.
- **B-10** · El conteo del resumen.
  `rg -o "^\| F5-SUP-[0-9D]+ \|[^|]*\| (CONFIRMA|CONTRADICE|FALTA|ADAPTAR|DELETE) " <este archivo> -r '$1' | sort | uniq -c`
  sobre las tablas de los §2 a §5 (35 filas), más las 11 filas contables del §6 (D01–D10 y D12; D11 no
  se cuenta porque remite a F5-SUP-007 y 008, que ya están contadas en el §2).
- **B-11** · El cron de borradores no está en el diseño (F5-SUP-018).
  `rg -n -c "archive-abandoned|abandoned-drafts|last_warned_at|winback" HOS-1353*/ HOS-1354*/ HOS-1352*/docs/08-phase-1b-code-discovery.md HOS-1352*/docs/16-fase-7-del-paraguas.md HOS-1352*/docs/nucleo`
  → sólo `08-phase-1b-code-discovery.md` (4 hits, inventario).
- **B-12** · Ninguna transición de publicación revalida (F5-SUP-020).
  `rg -n -i "revalid|ISR\b|caché del borde|purga" HOS-1353*/docs/03-maquinas-de-estado.md` → ningún
  hit de revalidación (sólo `fichaPurgada` y «purgada», que son el estado `PURGED`). **Control positivo**:
  el mismo patrón sobre `16-fase-7-del-paraguas.md` devuelve el paso 4c (línea 142).
- **B-13** · Columnas de `L5`/`L7` en las otras dos tablas (F5-SUP-022).
  `git grep -n "billing_unpublished_at\|owner_suspended\|plan_restricted" $R -- packages/db/src/schemas/gastronomy packages/db/src/schemas/experience`
  → sin salida. **Control positivo**: `owner_suspended` aparece en
  `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:110`.
- **B-14** · Pedido de arreglo y aviso de edición de soporte (F5-SUP-027, 029).
  `git grep -n -i "pedido_de_arreglo\|fix_request\|fixRequest" $R -- packages apps` → sin salida (no se
  hizo control positivo propio: el nombre de la entidad es del diseño, no del código, así que un cero
  sólo dice que no existe con esos nombres).
- **B-15** · Conversaciones gobernadas por el estado de la ficha (F5-SUP-033).
  `git grep -n -i "lifecycleState\|readOnly\|read_only\|isPublic" $R -- packages/service-core/src/services/conversation`
  → sólo `readonly` de TypeScript (`access-token.service.ts:100-104`) y `ownerAccommodationIds`; ninguna
  condición por estado.
- **B-16** · Avisos del diseño en i18n (F5-SUP-034). Filas vivas:
  `awk '/^## 4\./{f=1} /^## 6\./{f=0} f && /^\| [0-9]/' V/docs/19-superficies.md | wc -l` → 23;
  `awk '/^## 4\./{f=1} /^### 4\.1/{f=0} f && /^\| [0-9]/' B/docs/19-superficies.md | wc -l` → 31
  (y 3 tachadas). Frases: `git grep -c -i "<frase>" $R -- packages/i18n/src/locales/es` para
  *«no tiene planes disponibles»*, *«suscribite para publicar»*, *«ya tiene dueño»*, *«Mercado Pago
  permite cobrar»*, *«se borró por inactividad»* → 0 cada una. **Control positivo**: *«archivada»* → 3.

---

## Lo que no pude cerrar

1. **Si `billing/sponsorships` y `billing/owner-promotions` del admin son cobro viejo** (F5-SUP-D12). Viven
   bajo `/billing/` y las promociones de dueño leen `plan_restricted` (`ownerPromotion.model.ts:110,162,228,293`),
   pero son funciones de contenido (el dueño publica una promo a turistas; un patrocinio de post). No
   encontré en `16-` §4.6 ni en `B/21` §4 que las nombre. Si no son lote N, son una pieza más: el
   `plan_restricted` de `owner_promotions` es una tercera columna homónima que la excepción del lote N no
   cubre (la excepción nombra las de `accommodations`).
2. **`apps/api/src/routes/partners/admin/{review-content,send-link}.ts`**: mezclan revisión de contenido
   con habilitar el cobro (*«Review the partner content before enabling payment»*,
   `partner.service.ts:170`). No separé qué parte es lote N y qué parte sobrevive como moderación de
   la presencia.
3. **Las claves de entitlement del paquete `packages/billing`** (ítem 4 del Eje 2): el catálogo de claves
   en código lo crea `V1`, y el archivo de planes lo borra `U1`, pero no verifiqué si el `EntitlementKey`
   que usan las 149 superficies de la web (F5-SUP-005) sale del archivo que `U1` borra o de otro que
   sobrevive. Si sobrevive, las superficies compilan tras `U1` leyendo claves que el catálogo nuevo puede
   no declarar.
4. **Si la caché de páginas de fichas tiene hoy una clase y un TTL conocidos** (para acotar F5-SUP-020).
   El diseño lo acota sólo para Partner (*«hoy ~2 h»*, `V/18` §1.6 ⚠️ punto 4); para fichas no lo medí.
5. **El detalle del reclamo de `alliance_leads`** (F5-SUP-006): el comentario de la ruta dice que *«the
   token plus the caller's own email address ARE the authorization»* (`claim.ts:14-16`), que podría exigir
   que el correo de la sesión coincida con el del formulario; el diseño (`V/18` §2.4, regla 1) vincula a la
   cuenta de la sesión sin mirar su correo. No leí el servicio para confirmar cuál de las dos hace.
