---
title: Una ficha = un local físico = una dirección (con dirección estructurada de venue)
linear: HOS-1810
statusSource: linear
created: 2026-11-14
status: final
type: feature
areas:
  - api
  - web
  - admin
  - db
smokeGates:
  - status-needs-smoke-staging
---

# HOS-1810 · Una ficha = un local físico = una dirección

> Esta spec cubre DOS issues de Linear, en dos fases con un PR de implementación cada una:
>
> - **Fase A · HOS-2189**: el venue («Comer y salir») pasa a tener una dirección estructurada equivalente al `location` de alojamiento. **Bloquea** la fase B.
> - **Fase B · HOS-1810**: la regla «una ficha = un local físico = una dirección», sobre alojamiento y venue.
>
> Relacionada con HOS-1787 y no la bloquea (DEC-FAC-081, owner, 2026-10-25). Verificada contra `origin/staging` (HEAD `bc2abd8c26`, 2026-11-14).

## Decisiones del owner (14/11/2026)

Finales. Esta spec no deja decisiones abiertas.

1. **Verticales**: alojamiento **y** venue. Experiencias quedan **fuera** (tienen `meetingPoint` de texto libre, que no es una dirección). El venue recibe primero una dirección estructurada (fase A, HOS-2189).
2. **Detección**: dirección normalizada = calle + número + destino + piso/departamento. Una dirección «s/n» (sin número) **no produce clave** y nunca es un duplicado.
3. **Contra quién**: bloquea **sólo si el duplicado es del MISMO dueño**. Un duplicado de **otro** dueño **no bloquea**: queda marcado para revisión del admin, y no se le revela nada al que publica (ni id ni existencia).
4. **Al detectar**: aviso mientras la ficha es borrador; **bloqueo al publicar** con 409 `DUPLICATE_LOCATION`.
5. **Excepciones**: un admin concede una excepción **con motivo** (complejos de cabañas, patios gastronómicos, restaurante de un hotel). Piso/departamento participa en la clave.
6. **Fichas existentes**: sin tratamiento. El owner confirmó que hay pocas y ninguna viola la regla. **No hay informe ni migración de datos existentes** (más allá de la dirección de los venues de seed, ver §4.3).
7. **Por vertical**: la detección es **por vertical**. Un venue nunca choca con un alojamiento y viceversa. Ver §3 y riesgo R-3.

## 1. Problema

HOS-1787 decidió que un local con varios rubros (resto-bar) es **una sola ficha** con varios `business_lines`, no dos fichas. Falta la regla que lo haga cumplir. Sin ella, un dueño puede publicar dos fichas del mismo local y:

1. duplica su presencia en listados y colecciones;
2. divide las reseñas entre dos fichas;
3. evade el tope de fichas de su plan.

El punto 3 tiene dinero adentro: una ficha ocupa cupo recién cuando está `PUBLISHED` (`packages/schemas/src/enums/publication-status.enum.ts`, «`PUBLISHED`: public; occupies a quota slot») y el tope es un límite del catálogo (`max_accommodations`, `max_venues`, `packages/schemas/src/catalog/limit-keys.ts`). Por eso el momento de bloquear es la **publicación**, no la creación del borrador.

## 2. Hallazgos que condicionan el diseño

### 2.1 Sólo alojamiento tiene dirección estructurada

| Vertical | Qué tiene hoy | Dónde |
|---|---|---|
| Alojamiento | `location` JSONB: `street`, `number`, `floor`, `apartment`, `coordinates{lat,long}`. Ciudad/barrio/departamento salen del `destinationId` | `packages/db/src/schemas/accommodation/accommodation.dbschema.ts`; `packages/schemas/src/entities/accommodation/accommodation.location.schema.ts` |
| Venue | **Nada.** Sólo `destinationId` y `contactInfo`. Sin columna `location` | `packages/db/src/schemas/venue/venue.dbschema.ts` |
| Experiencia | `meetingPoint` texto libre + `meetingPointLat/Long`. **Fuera de alcance** | `packages/db/src/schemas/experience/experiences.dbschema.ts` |

El caso que originó la regla (resto-bar publicado dos veces como venue) **no se puede detectar** hasta que el venue guarde un lugar. De ahí la fase A.

### 2.2 No hay detección de duplicados ni utilidades de normalización

No existe ningún chequeo de dirección repetida en `packages/service-core/src/services/{accommodation,venue}`. Tampoco hay `unaccent`, `pg_trgm` ni PostGIS en las migraciones: la normalización se hace en TypeScript. `slugify` (`packages/utils/src/string.ts`) es una pieza reutilizable para quitar acentos.

### 2.3 Medición sobre el seed (no sobre la base real)

En `packages/seed/src/data/accommodation/**`: 104 alojamientos con `location`; 34 dueños, 25 con más de una ficha. Los únicos pares con misma calle y número normalizados son dos direcciones rurales `s/n` («camino al arroyo s/n», «camino al bosque s/n») a decenas de kilómetros entre sí: **falsos positivos puros**. De ahí la decisión 2: `s/n` no genera clave. En venues hay 6 fixtures en `packages/seed/src/data/venue/` y ninguno tiene dirección.

### 2.4 Dónde engancha la regla

- La publicación pasa por `ListingPublicationService.publish` (`apps/api/src/services/listing-publication/listing-publication.service.ts`), que ya hace el pre-chequeo de completitud por vertical antes de PB1. El chequeo de duplicado entra ahí, junto a la completitud, **antes** de la transición PB1 y del chequeo de cupo.
- `@repo/verticals` no importa `@repo/db`: la regla queda en la composición de la API y en el servicio; no se toca `packages/verticals`.
- Mecanismo de edición del venue: PATCH por sección (`apps/api/src/routes/venue/protected/patch.ts`), catálogo de secciones `LISTING_SECTIONS` (`packages/schemas/src/catalog/listing-sections.ts`) y editor compartido venue/experiencia (`apps/web/src/components/listing/`, `apps/web/src/lib/editor/`).

### 2.5 Compatibilidad con el contrato de errores

`apps/api/docs/error-contract.md` fija el orden: 401 → 403 (cuenta, permiso) → 400 (forma) → 404 (existencia/propiedad) → **reglas de negocio 409/422**. El 409 `DUPLICATE_LOCATION` es un **conflicto de estado** (tabla del contrato: «State conflict → 409 `ALREADY_EXISTS`») y vive en el paso 6, después de que la forma (400) y la propiedad (404: una ficha ajena responde 404, nunca 409) ya se resolvieron. Encaja sin tocar el orden. El `error.code` es `ALREADY_EXISTS` con `details.reason = 'DUPLICATE_LOCATION'`, igual que `SECTION_ABSENT`. Para que el cliente lea `details`, la razón se agrega a la lista corta de `PUBLIC_DETAILS_ERROR_CODES` (`apps/api/src/utils/response-helpers.ts`) **y** a la tabla del contrato en el mismo PR (así lo exige el propio contrato).

## 3. Alcance

### Dentro

- **Fase A**: dirección estructurada del venue (columna, schemas, servicio, API protegida/pública/admin, editor web del dueño, formulario admin, página pública, seed).
- **Fase B**: función de normalización y clave; chequeo en publicación y al editar la ubicación de una ficha publicada; aviso en borrador; excepción administrada con motivo; marca de duplicado entre dueños para el admin; i18n es/en/pt.
- La detección corre **por vertical**: la clave se compara sólo contra fichas de la **misma tabla**. Un venue jamás choca con un alojamiento.

### Fuera

- Experiencias (decisión 1).
- Informe o migración de datos existentes (decisión 6).
- Geocodificación (completar coordenadas desde la calle), fusión automática de fichas, mover reseñas.
- Detección por proximidad de coordenadas (descartada por la decisión 2; ver R-2).
- Cambios de planes, topes o precios.

## 4. Fase A · HOS-2189 · Dirección estructurada del venue

### 4.1 Modelo de datos (carril estructural)

- `venues.location jsonb NULL`, mismo tipo que `accommodations.location`: `{ street, number, floor, apartment, coordinates: { lat, long } }`. Se **reutiliza** el schema Zod de alojamiento (`AccommodationLocationSchema` / `AccommodationLocationReadSchema`), moviéndolo o re-exportándolo a un módulo común sin duplicar la definición (Single Source of Truth). Ciudad, barrio y departamento salen de `destinationId`, igual que en alojamiento (SPEC-095).
- Migración generada con `pnpm db:generate`. La última migración en `staging` es `0202`; **re-chequear el número contra `origin/staging` y los PRs abiertos justo antes de generar** (a la fecha, ningún PR abierto toca migraciones).
- Expand-only: columna nula, sin default, sin `DROP`.
- La dirección es **opcional** para publicar (no se agrega a la completitud de publicación en esta spec): ninguna ficha existente quedaría con un requisito nuevo. La regla de fase B sólo actúa cuando hay clave.

### 4.2 Schemas, servicio y API

- `VenueSchema` y sus proyecciones (protegida, pública, admin) incluyen `location`. Editable por el dueño: se agrega `location` a `VenueOwnerUpdateInputSchema` y al catálogo `LISTING_SECTIONS.venue` como sección **`location`** (grupo `property`), con su entrada en `LISTING_SECTION_PRESENTATION` (slug `ubicacion`) y su estado en el mapa de secciones (`GET /api/v1/protected/venues/:id/sections`).
- PATCH protegido (`/api/v1/protected/venues/:id`) y admin (`/api/v1/admin/venues/:id`) aceptan `location`. Los guards congelados del repo que cuentan secciones/campos se actualizan en el mismo PR (conteos recontados, no sumados a ciegas).
- Lectura pública: `location` viaja en la proyección pública del venue (`apps/api/src/utils/public-listing-projector.ts`). Coordinar con HOS-2042 (contactInfo público): ambos tocan el mismo schema y proyector; los conflictos se resuelven de forma **aditiva**.
- Ruta de tiers respetada: web usa `/public/` y `/protected/`; admin usa `/admin/`.

### 4.3 Seed (dual-write, regla HOS-25)

Los 6 venues de `packages/seed/src/data/venue/` son contenido curado con id determinista: llevan `location` en el fixture (baseline) **y** una data-migration numerada (`pnpm db:seed:make`, siguiente al `0169`) que setea `location` sólo en las filas con esas ids y sólo si `location IS NULL`, idempotente. `scripts/check-seed-dual-write.sh` debe quedar verde.

### 4.4 UI

- **Web (CSS Modules, sin Tailwind)**: nueva sección «Ubicación» en el editor del comerciante: página `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/ubicacion.astro` (calle, número, piso, departamento, destino ya elegido en «Información básica», coordenadas). El mapa/selector de coordenadas reutiliza lo que ya usa `LocationForm` de alojamiento. Formularios nativos + hooks propios (no TanStack Form).
- **Página pública del venue** (`apps/web/src/pages/[lang]/comer-y-salir/[slug].astro`): bloque con la dirección (calle y número, ciudad desde el destino) y enlace/mapa si hay coordenadas. La página sigue **session-blind** (`cacheable-pages-are-session-blind.guard.test.ts` verde): la dirección es dato público de la ficha, no depende de la sesión. Se suma al `VenueJsonLd` (`postalAddress`/`geo`) cuando existe.
- **Admin (Tailwind v4 + Shadcn, TanStack Form + schemas de `@repo/schemas`)**: grupo «Ubicación» en el formulario de venue (`apps/admin/src/features/venue/config/venue-consolidated.config.ts`).
- i18n es/en/pt en `@repo/i18n`, sin literales en componentes.

### 4.5 Criterios de aceptación (fase A)

1. Un dueño edita calle, número, piso, departamento y coordenadas de su venue desde el editor; el cambio persiste y se ve al recargar.
2. Un admin edita los mismos campos desde el formulario admin.
3. La página pública del venue muestra la dirección cuando existe y no muestra nada (ni un bloque vacío) cuando no existe.
4. La respuesta pública incluye `location` sin campos privados.
5. Un `location` inválido (calle de 1 carácter, coordenadas fuera de rango) responde 400 con claves `zodError.*` existentes de alojamiento.
6. Un dueño ajeno recibe 404 (no 403) al intentar editar la ubicación.
7. Los 6 venues de seed tienen `location` tras `db:seed:migrate` y el fixture coincide.
8. Alojamiento y experiencia no cambian de comportamiento.
9. La página sigue session-blind y la sección existe en es, en y pt.

## 5. Fase B · HOS-1810 · La regla

### 5.1 Normalización y clave (función pura)

`buildLocationKey({ street, number, floor, apartment, destinationId })` → `string | null`, RO-RO, en `packages/utils` (o `packages/schemas` si el guard de dependencias lo prefiere), con JSDoc. Se escribe **test primero**.

- `normalize`: minúsculas; sin acentos ni diéresis; sin prefijo de vía al inicio (`calle`, `av`, `av.`, `avda`, `avenida`, `bv`, `bulevar`, `boulevard`, `ruta`, `rn`, `rp`, `pasaje`, `psje`, `diag`, `diagonal`); sin puntuación; espacios colapsados.
- Clave: `calle|número|destinationId` y, si existen y no son vacíos, `|piso|departamento`. Piso y departamento se normalizan igual («1°», «1º», «PB», «planta baja» se unifican a un token estable; «Depto. A» y «a» coinciden).
- **Sin clave** (`null`) cuando: falta calle; falta número; el número es `s/n`, `sn`, `s n`, `S/N`, `sin número`, `0` o no contiene ningún dígito; falta `destinationId`.
- Idempotente y determinista; no depende del orden de los campos ni del idioma.
- Casos obligatorios de test: acentos, mayúsculas, «Av. San Martín 123» vs «san martin 123» vs «Avenida San Martín 123» (misma clave), `s/n` y variantes (null), número vacío (null), piso/depto distintos (claves distintas), piso/depto vacíos vs ausentes (misma clave), espacios dobles, puntuación, destino distinto (clave distinta). Cobertura ≥ 90 %.

### 5.2 Modelo de datos (carril estructural)

En **ambas** tablas, `accommodations` y `venues` (mismas columnas, simetría):

- `location_key text NULL` + índice **no único** `…_location_key_idx` parcial `WHERE location_key IS NOT NULL AND deleted_at IS NULL`. No único a propósito: qué hacer con el choque es política de aplicación (mismo dueño / otro dueño / excepción), no de la base.
- `location_exception_by uuid NULL` (FK `users.id` `ON DELETE SET NULL`), `location_exception_reason text NULL`, `location_exception_at timestamptz NULL`. La excepción vigente es «las tres no nulas».
- Expand-only, columnas nulas. Re-chequear el número de migración contra `origin/staging` y PRs abiertos.

**Mantenimiento de la clave**: `AccommodationService` y `VenueService` recalculan `location_key` en `_beforeCreate`/`_beforeUpdate` cuando cambia `location` o `destinationId` (un solo lugar por servicio; ninguna ruta puede escribirla; ni el body de create/patch ni el admin la aceptan, y el registro de campos server-written la lista). No hay backfill de filas existentes (decisión 6): el owner confirmó que no hay violaciones, y una ficha sin clave simplemente no participa hasta que alguien edite su dirección. **Consecuencia aceptada y documentada**: una ficha preexistente cuya dirección no se editó no genera clave, de modo que no será detectada como ocupante hasta su próxima edición.

### 5.3 Permiso nuevo

Se agrega a `PermissionEnum` **un único permiso, agnóstico de vertical**: `PermissionEnum.LISTING_LOCATION_EXCEPTION_MANAGE = 'listing.locationException.manage'`, junto a `listing.moderate`. Gobierna las rutas de excepción y el informe de direcciones repetidas de **ambas** verticales (alojamiento y venue). Se asigna a `SUPER_ADMIN` y `ADMIN` (carril 3: data-migration `0173`, porque `role_permission` tiene filas vivas; más el baseline del seed de roles) y el valor del enum entra por la migración estructural. La familia `venue.*` queda intacta (está congelada en 7 miembros espejo de la familia retirada). `permission-naming-convention.guard.test.ts` debe quedar verde y la clave se declara en `KNOWN_SYSTEM_FALLBACK_KEYS` junto a sus hermanas `LISTING_*`. Nunca se decide por rol.

### 5.4 API

| Tier | Ruta | Cambio |
|---|---|---|
| Protected | `POST /api/v1/protected/{accommodations,venues}/:id/publish` | Antes de PB1: si hay clave y existe otra ficha **publicada, viva, del mismo dueño, de la misma vertical, con la misma clave y sin excepción vigente en la ficha que se publica**, responde **409** `ALREADY_EXISTS`, `details: { reason: 'DUPLICATE_LOCATION', existingListingId }`. El `existingListingId` es del propio dueño, por lo tanto no filtra nada |
| Protected | `PATCH /api/v1/protected/{accommodations,venues}/:id` con cambio de `location` o `destinationId` sobre una ficha `PUBLISHED` | Mismo chequeo y mismo 409; la ubicación guardada **no cambia** |
| Protected | proyección protegida de la ficha (`GET …/:id`, `…/mine`) | `locationDuplicate: boolean` (sólo duplicado **propio**), para que el aviso de borrador no necesite otro request. No incluye ids |
| Admin | `POST /api/v1/admin/{accommodations,venues}/:id/location-exception` body `{ reason }` y `DELETE` | Concede/retira la excepción. Motivo obligatorio (mín. 10 caracteres). Permiso de §5.3. Registra admin, motivo y fecha |
| Admin | `GET /api/v1/admin/{accommodations,venues}/location-duplicates` | Lista, por vertical, los grupos de ≥2 fichas publicadas vivas con la misma clave y **sin** excepción, con `sameOwner` por grupo. Es la «marca» de duplicado entre dueños: se calcula al consultar, no se persiste. `page`+`pageSize` (nunca `limit`). Permiso de §5.3 |

Reglas:

- El chequeo compara contra fichas `PUBLISHED` y no borradas (`deleted_at IS NULL`); `DRAFT`, `ARCHIVED`, `PURGED`, `MODERATED` y demás no cuentan.
- Se excluye a la propia ficha. Un duplicado de **otro dueño** no bloquea, no cambia la respuesta y no se menciona al que publica; sólo aparece en el listado admin.
- Una ficha con excepción vigente publica sin bloqueo, y no cuenta como ocupante en el chequeo de otras fichas del mismo dueño (la excepción habilita al local compartido en ambos sentidos).
- 400 para un `id` que no es UUID, antes de tocar la base. Una ficha ajena → 404, nunca 403 ni 409. Un 4xx nunca es `INTERNAL_ERROR`.
- Se registra en `apiLogger` cada bloqueo (`ownerId`, `listingId`, `vertical`, `reason`), sin la dirección completa.
- Se mantiene el orden del contrato (§2.5). Se actualiza `apps/api/docs/error-contract.md` y `PUBLIC_DETAILS_ERROR_CODES`.

### 5.5 UI

- **Web (CSS Modules)**: en la sección «Ubicación» del editor de alojamiento (`mi-cuenta/propiedades/[id]/editar/ubicacion.astro`) y del venue (fase A) un aviso persistente cuando `locationDuplicate` es true, con enlace a la ficha existente. El publicador mapea el 409 `DUPLICATE_LOCATION` a un mensaje claro (mismo lugar donde ya se mapean `LIMIT_REACHED` y `SECTION_ABSENT`), nunca a un error genérico.
- **Admin (Tailwind v4 + Shadcn)**: en el formulario de alojamiento y de venue, un bloque «Excepción de ubicación» (conceder con motivo, ver quién y cuándo, retirar) y una pantalla «Direcciones repetidas» con TanStack Table (grupo, fichas, dueños, mismo dueño sí/no).

### 5.6 i18n (es / en / pt)

Claves nuevas en `@repo/i18n`, tres idiomas, sin literales en componentes: aviso de borrador, mensaje de bloqueo, textos del bloque de excepción y de la pantalla admin. Mensaje base (es): «Esta dirección ya tiene una ficha publicada tuya. Cada local físico va en una sola ficha: sumale el rubro que falta en vez de crear otra.»

### 5.7 Criterios de aceptación (fase B)

1. Dos alojamientos del mismo dueño, mismo destino, misma calle y número normalizados («Av. San Martín 123» vs «san martin 123»): el segundo `POST …/publish` responde **409** `ALREADY_EXISTS` con `details.reason = 'DUPLICATE_LOCATION'` y el `existingListingId` del primero. Ídem para venues.
2. El mismo caso con el segundo en `DRAFT`: no bloquea; `locationDuplicate` es true y el editor muestra el aviso.
3. Una dirección `s/n` o sin número no genera clave y nunca bloquea (regresión de «camino al arroyo s/n»).
4. Un duplicado de **otro** dueño no bloquea ni cambia el cuerpo de ninguna respuesta del que publica; aparece en `location-duplicates` del admin con `sameOwner = false`.
5. Piso o departamento distintos en la misma calle y número → claves distintas → no bloquea.
6. Un venue y un alojamiento con la misma calle, número y destino **no** chocan (por vertical).
7. Editar `location` de una ficha `PUBLISHED` hacia una dirección ya ocupada por otra ficha publicada del mismo dueño → 409 y la ubicación guardada no cambia.
8. Una ficha `DRAFT`, `ARCHIVED`, `PURGED`, `MODERATED` o borrada no cuenta como ocupante.
9. Con excepción vigente (concedida por un admin con motivo) la ficha publica sin bloqueo; alta y baja quedan registradas con admin, motivo y fecha; sin motivo → 400; sin permiso → 403; sin sesión → 401.
10. `location_key` se recalcula al cambiar `location` o `destinationId` y ninguna ruta puede escribirla directamente.
11. El mensaje de bloqueo, el aviso y los textos admin existen en es, en y pt.
12. Experiencias no cambian de comportamiento.

## 6. Tests

- **Unit** de `buildLocationKey` (§5.1), cobertura ≥ 90 %; propiedad de idempotencia.
- **Servicio** (`packages/service-core`): recálculo de clave en create/update de alojamiento y venue; el cambio de destino la cambia; detección por dueño/vertical/estado/excepción.
- **Integración API** (`apps/api/test/integration/`, con `flock` sobre la base compartida): AC 1, 2, 4, 6, 7, 8, 9 de fase B; 401/400/404 del contrato; test de **claves exactas** del 409 y de la ausencia de ids ajenos.
- **Fase A**: schemas (valid/invalid), servicio, PATCH protegido y admin, proyección pública con `location`, test de la página/componente pública y del editor, guard session-blind, JSON-LD.
- **Guards**: `check-seed-dual-write.sh`, `permission-naming-convention.guard.test.ts`, guards de campos server-written y de conteo de secciones, `pnpm check:guards`.
- **Data-migration** de la fase A (idempotente, sólo `location IS NULL`) y la del permiso de la fase B.
- **Regresión de falsos positivos**: test con las dos direcciones `s/n` reales del seed.
- **Web/Admin**: mapeo del 409, aviso del editor, bloque de excepción, sin literales (guard de i18n).

## 7. Plan de PRs y orden

1. **Docs PR** `[HOS-1810] docs(spec): …` (este archivo), label `whats-new-none`, sin palabra mágica.
2. **PR A** `[HOS-2189] feat(api): …`, cuerpo `Closes HOS-2189`, desde `staging`. Fase A completa.
3. **PR B** `[HOS-1810] feat(api): …`, cuerpo `Closes HOS-1810`, apilado sobre PR A (rama cortada desde la rama de A; al mergear A, se retargetea/rebasa sobre `staging`). `staging` se mergea seguido por el solapamiento con HOS-2042.

## 8. Smoke (`status-needs-smoke-staging`)

**PR A (HOS-2189)**: (1) con un dueño de comercio, abrir el editor de un venue, sección «Ubicación», cargar calle, número, piso y coordenadas y guardar; (2) recargar y confirmar que persiste; (3) abrir la página pública del venue y ver la dirección (y que no cambia con la sesión); (4) como admin, editar la dirección en el formulario de venue; (5) en un venue sin dirección, la página pública no muestra bloque.

**PR B (HOS-1810)**: (1) con un dueño, publicar un venue con dirección; (2) crear otro con la misma dirección («Av.» vs «Avenida») y ver el aviso en borrador; (3) intentar publicar y ver el 409 y el mensaje en el idioma de la cuenta; (4) cambiar a un piso distinto y publicar; (5) con otra cuenta, publicar una ficha en la misma dirección: no hay bloqueo ni mensaje; (6) como admin, ver ese par en «Direcciones repetidas» y conceder una excepción con motivo; (7) repetir (2)-(3) con alojamientos; (8) editar la dirección de una publicada hacia una ocupada: 409 y dirección sin cambios.

## 9. Riesgos

- **R-1 Falsos positivos** (complejos de cabañas, patios gastronómicos, restaurante de hotel; F-V1-046 de HOS-1787). Mitigación: sólo el mismo dueño bloquea, `s/n` no genera clave, piso/depto participan, excepción administrada con motivo.
- **R-2 Falsos negativos**: «San Martín 123» vs «Gral. San Martín 123» o mala ortografía no coinciden. Aceptado: la regla frena lo evidente, no lo adversarial. La proximidad por coordenadas no se implementa (decisión 2).
- **R-3 Venues y alojamientos son vecinos pero no se cruzan**: por la decisión 7, un hotel con su restaurante cargado como venue en la misma dirección **no choca**, y tampoco un mismo local cargado como alojamiento y como venue. **No es una decisión del producto sino un riesgo a vigilar**: si aparecen duplicados entre verticales, ampliar la detección requiere decidir contra quién y con qué mensaje (la clave ya es comparable entre tablas porque usa el mismo formato).
- **R-4 Fichas existentes sin clave** (decisión 6): una ficha publicada y no editada no participa de la detección. Aceptado por el owner (no hay violaciones y son pocas).
- **R-5 Evasión por edición**: publicar y luego cambiar la dirección. Cubierta por el chequeo en el PATCH (AC 7).
- **R-6 Privacidad entre dueños**: un mensaje de error que filtre el id de otra ficha. Cubierta por el test de claves exactas; el único id que viaja es el propio.
- **R-7 Solapamiento con HOS-2042** en el schema y la página pública del venue. Mitigación: merge frecuente de `staging` y resolución aditiva.
- **R-8 Sección nueva en el catálogo** (`LISTING_SECTIONS.venue`): hay guards y conteos congelados que se rompen al agregarla; se actualizan en el mismo PR.

## Historial de revisiones

- **2026-11-14**: §5.3 pasa de dos permisos (uno por entidad: `accommodation.locationException.manage` y `venue.locationException.manage`) a uno solo, `listing.locationException.manage`. Motivo: un permiso `venue.*` nuevo hace crecer la familia `venue.*`, que está congelada en 7 miembros por `permission-venue-experience.test.ts` como espejo de la familia retirada; un valor `listing.*` evita eso y cubre ambas verticales con un solo valor, igual que `listing.moderate`. Aprobado por el coordinador.
