---
spec-id: SPEC-097
title: Interactive Maps with Privacy-Aware Location for Accommodations and Destinations
type: feature
complexity: high
status: draft
created: 2026-05-01
---

# SPEC-097: Interactive Maps with Privacy-Aware Location

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Mostrar la ubicación geográfica de **alojamientos** y **destinos** en la web pública mediante mapas interactivos basados en Leaflet, con un mecanismo de **aproximación de ubicación** para alojamientos (privacidad del host) y **ubicación exacta** para destinos (información pública).

**Motivation:**
- La ubicación es uno de los factores top-3 de decisión en hospedaje turístico. Hoy `LocationSection.astro` es un placeholder estático con coordenadas como texto.
- Los hosts no quieren publicar su dirección exacta a visitantes anónimos (riesgo de seguridad y precio de listing más bajo si se revela exactamente). Patrón industry-standard: Airbnb, VRBO, Booking — todos usan círculo aproximado.
- Los destinos (ciudades, pueblos, parques) son lugares públicos cuya ubicación NO es información sensible.

**Success Metrics:**
- 100% de alojamientos publicados muestran un mapa con círculo aproximado en la página de detalle (no requieren editar nada extra los hosts existentes — usa coords ya cargadas).
- 100% de destinos publicados muestran un mapa con pin exacto en su página de detalle.
- El offset aproximado es **determinístico** (mismo accommodation → mismo círculo siempre) e **irreversible** (no se puede recuperar la coord exacta desde la API pública).
- Bundle inicial del web app NO crece con Leaflet en páginas que no usan mapa (code-split via `client:only="react"`).
- Lighthouse Performance score en mobile no baja más de 3 puntos en pages con mapa.
- Cero CSP errors en producción.

**Target Users:**
- **Visitante anónimo / logged-in regular:** ve círculo aproximado en alojamientos, pin exacto en destinos.
- **Host (owner del accommodation):** ve coord exacta en el admin, donde edita su propiedad. **Puede cargar la ubicación con autocomplete de dirección + drag pin (no necesita conocer lat/lng decimal).**
- **Admin / super-admin:** ve coord exacta en cualquier accommodation desde el panel admin.

---

### 2. User Stories & Acceptance Criteria

#### US-01 — Visitante anónimo ve ubicación aproximada de alojamiento
**Como** visitante anónimo del sitio web,
**Quiero** ver en qué zona aproximada está ubicado un alojamiento,
**Para** evaluar si está cerca de mis intereses (centro, río, etc.) sin acceder a su dirección exacta.

**AC:**
- **Given** un accommodation publicado con `coordinates.lat` y `coordinates.long` cargadas,
  **When** entro a `/{locale}/alojamientos/{slug}`,
  **Then** veo un mapa interactivo con un **círculo semi-transparente de ~500m de radio** sobre la zona aproximada (sin pin exacto).
- **Given** el mapa está visible,
  **When** intento hacer zoom in,
  **Then** el zoom máximo permitido es 17 (no puedo acercar más para inferir la ubicación exacta).
- **Given** el mapa renderiza,
  **Then** veo un disclaimer visible: "Ubicación aproximada. La dirección exacta se compartirá con la reserva confirmada."
- **Given** mismo accommodation visto en sesiones distintas,
  **When** comparo el centro del círculo,
  **Then** es siempre el mismo (offset determinístico).

#### US-02 — Visitante anónimo ve ubicación exacta del destino
**Como** visitante anónimo,
**Quiero** ver dónde queda geográficamente un destino,
**Para** entender la región del Litoral Argentino.

**AC:**
- **Given** un destino publicado (ej. Chajarí) con coordinates,
  **When** entro a `/{locale}/destinos/{slug}`,
  **Then** veo un mapa con un **pin exacto** en la ubicación de la ciudad.
- **Given** el mapa,
  **Then** el zoom es libre (no se cap a 17).
- **Given** existen accommodations en ese destino con coordenadas,
  **Then** [scope opcional fase 5] el mapa puede mostrar también múltiples círculos aproximados de los alojamientos del destino.

#### US-03 — Owner ve ubicación exacta de su alojamiento en admin
**Como** owner de un alojamiento,
**Quiero** ver y editar las coordenadas exactas de mi propiedad,
**Para** confirmar que la ubicación está bien cargada.

**AC:**
- **Given** soy owner de un accommodation,
  **When** entro al admin `/admin/accommodations/{id}`,
  **Then** veo un mapa con un **pin exacto** sobre la propiedad.
- **Given** edito el accommodation,
  **When** muevo el pin o ingreso lat/lng manualmente,
  **Then** las coordenadas exactas se guardan (sin obfuscation).

#### US-04 — Admin ve ubicación exacta
**Como** admin,
**Cuando** entro al detalle de un accommodation desde el admin panel,
**Entonces** veo coordenadas exactas (no aproximadas).

#### US-06 — Toggle Lista/Mapa en listing de alojamientos
**Como** visitante,
**Quiero** alternar entre vista de lista y vista de mapa en el listing de alojamientos,
**Para** explorar las propiedades por su ubicación.

**AC:**
- **Given** estoy en `/{locale}/alojamientos`,
  **When** clickeo el toggle "Mapa",
  **Then** veo un mapa con todos los accommodations visibles como **círculos aproximados** (no pins exactos — respeta la privacidad de §6).
- **Given** hay >20 accommodations en viewport,
  **Then** los círculos se agrupan en **clusters** con número de accommodations adentro (usando `react-leaflet-cluster`).
- **Given** muevo el mapa o cambio el zoom,
  **Then** el listing en sidebar se actualiza con los accommodations dentro del bbox visible (search por bbox).
- **Given** hover sobre una card en el sidebar,
  **Then** el círculo correspondiente se resalta visualmente.
- **Given** click sobre un círculo del mapa,
  **Then** se abre un mini-popup con thumbnail + nombre + precio + link al detalle.
- **Given** el toggle no está accionado,
  **Then** el bundle del mapa no se carga (lazy import).

#### US-07 — Toggle Lista/Mapa en listing de destinos
**Como** visitante,
**Quiero** ver los destinos en un mapa,
**Para** entender geográficamente la región del Litoral.

**AC:**
- **Given** estoy en `/{locale}/destinos`,
  **When** clickeo el toggle "Mapa",
  **Then** veo un mapa con todos los destinos como **pins exactos** (son ubicaciones públicas).
- **Given** click sobre un pin,
  **Then** se abre popup con nombre del destino, count de accommodations y link al detalle.

#### US-08 — Host carga ubicación de su alojamiento sin conocer coordenadas
**Como** host que está cargando un alojamiento por primera vez,
**Quiero** indicar la ubicación escribiendo la dirección y ajustando un pin en un mapa,
**Para** no tener que abrir Google Maps externamente y copiar/pegar lat/lng decimales.

**AC:**
- **Given** estoy en el formulario de creación/edición de un accommodation,
  **When** entro al campo "Ubicación",
  **Then** veo un input de búsqueda de dirección con autocomplete (sugerencias on-the-fly desde **Photon**, sesgadas a Argentina) y debajo un mapa con un pin movible.
- **Given** escribo "Av. Belgrano 123, Concepción del Uruguay",
  **When** aparecen sugerencias,
  **And** clickeo una,
  **Then** el mapa centra en esa ubicación con el pin allí, y los campos de dirección estructurada (`street`, `number`, `city`, etc.) se autocompletan.
- **Given** la sugerencia no es exacta,
  **When** arrastro el pin,
  **Then** las coordenadas (lat/long) se actualizan en tiempo real.
- **Given** muevo el pin,
  **When** suelto,
  **Then** opcionalmente se hace **reverse geocoding** (pin → dirección) vía **Nominatim** y los campos de dirección se actualizan (con un debounce de 800ms para no abusar del rate limit).
- **Given** el geocoding/autocomplete falla (sin internet, rate limit, provider down),
  **Then** los campos siguen siendo editables manualmente y el pin se puede mover; un toast informa "Servicio de búsqueda no disponible, podés cargar la ubicación manualmente".
- **Given** guardo el accommodation,
  **Then** las coords exactas quedan persistidas en `location.coordinates`.

#### US-09 — Host usa "Mi ubicación actual" si está en la propiedad
**Como** host que está físicamente en la propiedad,
**Quiero** poder cargar la ubicación con un click,
**Para** no tener que escribir nada.

**AC:**
- **Given** estoy en el formulario de ubicación,
  **When** clickeo el botón "Usar mi ubicación actual",
  **And** el browser pide permiso de geolocalización,
  **And** lo otorgo,
  **Then** el pin se mueve a mis coords actuales (Geolocation API) y se hace reverse geocoding para llenar la dirección.
- **Given** rechazo el permiso o el browser no soporta geolocalización,
  **Then** el botón muestra un mensaje de fallback y no se rompe nada.

#### US-05 — Atribución legal y a11y
**Como** usuario con tecnología asistiva,
**Quiero** que el mapa cumpla a11y básica,
**Para** poder usar la página.

**AC:**
- El mapa incluye atribución visible y legal: "© OpenStreetMap contributors".
- Botones de zoom tienen `aria-label` traducidos (`map.zoomIn`, `map.zoomOut`).
- El mapa respeta `prefers-reduced-motion` (sin animaciones de pan/zoom auto).
- El contenedor reserva altura fija (`min-height: 400px` desktop, `300px` mobile) → cero CLS.

---

### 3. Non-Goals / Out of Scope

- **Reveal exacto post-reserva**: no existe flow de booking todavía en Hospeda. Cuando se construya (spec futura), se agregará un permission `ACCOMMODATION_LOCATION_EXACT_VIEW_BOOKED` y la projection se extenderá. Hoy fuera de scope.
- **Driving directions / isochrones / distancia a POIs**: features de mapping avanzado, no entran.
- **Custom map styles / dark mode del mapa**: usar default OSM, no diseñar tiles propios.
- **Geocoding** (convertir dirección → coords automáticamente): los hosts hoy cargan coords manualmente, no se cambia.
- **Maps en emails / PDFs**: solo web frontend.
- **Drag & drop pin en admin** para editar coords: el admin actual usa input numérico — esto se puede mejorar después en spec aparte.
- **Migración a vector tiles (MapLibre)**: el plan deja el migration path claro, pero no se hace ahora.

---

## Part 2 — Technical Analysis

### 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                            apps/web (Astro)                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  LocationSection.astro (SSR)                                 │   │
│  │    └─ <LocationMap client:only="react" mode="approximate"   │   │
│  │           lat={...} lng={...} radiusMeters={500} />          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  DestinationLocationSection.astro (SSR)                      │   │
│  │    └─ <LocationMap client:only="react" mode="exact"         │   │
│  │           lat={...} lng={...} markerLabel={destination.name}/>│  │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑ HTTP GET
                                    │ (response trae approximateLocation o coordinates)
┌─────────────────────────────────────────────────────────────────────┐
│                            apps/api (Hono)                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  /api/v1/public/accommodations/:slug                         │   │
│  │  /api/v1/public/destinations/:slug                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                    ↓                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  AccommodationService → projectAccommodationApproximate-     │   │
│  │     Location(entity, salt) → returns { approximateLocation } │   │
│  │  DestinationService → returns coordinates as-is              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
                    HOSPEDA_LOCATION_SALT (env, server-only)
```

### 5. Data Model & Schema Changes

**5.1 Sin cambios en la DB** — las coordenadas exactas siguen guardándose como hoy en `accommodation.location.coordinates.lat/long` (strings). El offset NO se persiste, se computa en cada request.

**5.2 Nuevo schema en `@repo/schemas`:**

```ts
// packages/schemas/src/common/location.schema.ts
export const ApproximateLocationSchema = z.object({
  lat: z.number(),                    // ya como number, no string
  lng: z.number(),                    // alias de "long" para frontend (Leaflet usa lng)
  radiusMeters: z.number().int().positive(),
});
export type ApproximateLocation = z.infer<typeof ApproximateLocationSchema>;
```

**5.3 Modificar `accommodation.public.schema.ts`:**
- Agregar campo `approximateLocation: ApproximateLocationSchema.optional()`.
- **NO exponer** `coordinates` (lat/long exactas) ni `street`/`number` en el response público.

**5.4 Modificar `accommodation.detail.schema.ts` (admin/owner view):**
- Mantener `coordinates` exactas como hoy.
- Agregar también `approximateLocation` opcional (útil para preview "así lo ve el visitante").

**5.5 Modificar `destination.public.schema.ts`:**
- Asegurar que `coordinates: { lat, long }` está en el response público (hoy podría estar filtrado).
- NO necesita approximate para destinos.

### 6. Approximation Algorithm

**Decisión: HMAC-SHA256 deterministic offset + circle visualization (Airbnb-style).**

**Pseudocódigo del algoritmo:**

```ts
// packages/service-core/src/utils/location-obfuscation.ts (NEW)
import { createHmac } from 'node:crypto';

const APPROXIMATE_RADIUS_METERS = 500;
const MAX_OFFSET_METERS = 350;       // offset bound; visual radius is 500m

export function obfuscateCoordinates(args: {
  exactLat: number;
  exactLng: number;
  accommodationId: string;
  salt: string;                      // from env: HOSPEDA_LOCATION_SALT
}): ApproximateLocation {
  const { exactLat, exactLng, accommodationId, salt } = args;

  // HMAC produces 32 bytes; we use first 8 bytes for lat-offset, next 8 for lng-offset
  const hmac = createHmac('sha256', salt).update(accommodationId).digest();
  const latRand = readFloat01(hmac, 0);   // [0, 1)
  const lngRand = readFloat01(hmac, 8);   // [0, 1)

  // Convert random [0,1) to signed offset in [-MAX, +MAX] meters
  const latOffsetMeters = (latRand * 2 - 1) * MAX_OFFSET_METERS;
  const lngOffsetMeters = (lngRand * 2 - 1) * MAX_OFFSET_METERS;

  // Convert meters to degrees (latitude: 1° ≈ 111_111m; longitude depends on lat)
  const latOffsetDeg = latOffsetMeters / 111_111;
  const lngOffsetDeg = lngOffsetMeters / (111_111 * Math.cos((exactLat * Math.PI) / 180));

  return {
    lat: exactLat + latOffsetDeg,
    lng: exactLng + lngOffsetDeg,
    radiusMeters: APPROXIMATE_RADIUS_METERS,
  };
}
```

**Propiedades garantizadas:**
- **Determinismo:** mismo `(accommodationId, salt)` → mismo offset siempre.
- **Irreversibilidad:** sin conocer el salt, no se puede recuperar la coord exacta.
- **Salt rotation:** cambiar el salt invalida los offsets cacheados (ok, las coords reales no se afectan).
- **Bound:** offset máximo ±350m, dentro de un círculo visual de 500m → garantiza que la coord real está adentro del círculo mostrado.
- **No predecible cross-property:** el HMAC distribuye uniformemente.

**Por qué 500m radio (no 200m, no 1km):**
- 200m: muy preciso, host pierde privacidad significativa.
- 1km: muy vago, baja la utilidad para el visitante.
- 500m es el sweet spot que usa la industria (Airbnb avg 457m, VRBO ~500m).

### 7. New Permissions

Agregar a `packages/schemas/src/enums/permission.enum.ts`:

```ts
ACCOMMODATION_LOCATION_EXACT_VIEW = 'accommodation.location.exact.view',
```

**Mapping a roles** (en `packages/seed/` o donde se siembren los roles):
- SUPER_ADMIN, ADMIN: lo tienen.
- HOST: lo tiene **solo para sus propios accommodations** (check de ownership en service, no por permission directo — patrón ya usado en `update.own`).
- USER (logged-in regular), GUEST (anónimo): NO lo tienen → ven approximate.

### 8. Service Layer Changes

**8.1 Nuevo util** en `packages/service-core/src/utils/location-obfuscation.ts` (testeable, puro):
- `obfuscateCoordinates(args)` — el algoritmo de §6.
- 100% test coverage requerido (es código de seguridad).

**8.2 Nueva projection function** en `packages/service-core/src/services/accommodation/accommodation.projections.ts`:

```ts
export function projectAccommodationApproximateLocation(
  entity: AccommodationEntity,
  salt: string,
): { approximateLocation?: ApproximateLocation } {
  if (!entity.location?.coordinates) return {};
  const lat = parseFloat(entity.location.coordinates.lat);
  const lng = parseFloat(entity.location.coordinates.long);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  return {
    approximateLocation: obfuscateCoordinates({
      exactLat: lat,
      exactLng: lng,
      accommodationId: entity.id,
      salt,
    }),
  };
}
```

**8.3 Modificar `AccommodationService`:**
- En métodos de read público (`getBySlug`, `searchPublic`, `getByDestination` cuando llamado por public route), aplicar `projectAccommodationApproximateLocation` antes de serializar y **stripear** `location.coordinates` y campos de dirección sensibles del response.
- En métodos admin/owner, dejar `coordinates` exactas.

**8.4 Decisión de gating:**
- Hoy, **el gating es por endpoint** (público vs admin), no por permission del actor en el endpoint público.
- Razón: la projection siempre devuelve approximate en endpoints `/public/*`, sin importar si el actor está logueado. Esto es más simple y seguro (no hay risk de leak por permission misconfig).
- Cuando se construya el booking flow, ahí sí el endpoint público devolverá exact si `actor.bookings.includes(thisAccommodation)`.

### 9. Environment Variable

Agregar en `apps/api/src/utils/env.ts` (`ApiEnvBaseSchema`):

```ts
HOSPEDA_LOCATION_SALT: z.string().min(32, 'Must be at least 32 chars'),
```

- Valor: 32+ caracteres random, generado con `openssl rand -base64 48`.
- Documentar en `apps/api/.env.example` y `docs/guides/environment-variables.md`.
- En tests: usar un salt fijo de testing (ej. `'test-salt-fixed-for-determinism-32chars'`).
- **Rotación:** documentar que rotar el salt cambia los offsets visibles (esperado, no romper nada).

### 10. API Changes

**Endpoints afectados** (sin cambios de URL, solo response schema):

| Endpoint | Antes | Después |
|----------|-------|---------|
| `GET /api/v1/public/accommodations` (list) | sin coords | `summary` con `approximateLocation` opcional + filtros bbox (`bboxNorth`, `bboxSouth`, `bboxEast`, `bboxWest`) |
| `GET /api/v1/public/accommodations/:slug` | sin coords | response con `approximateLocation` |
| `GET /api/v1/public/destinations` (list) | con coords (verificar) | con `coordinates` exactas |
| `GET /api/v1/public/destinations/:slug` | con coords (verificar) | con `coordinates` exactas |
| `GET /api/v1/admin/accommodations/:id` | con coords | sin cambios — coords exactas + approximateLocation preview |

**Filtros bbox para listing maps:** El endpoint público de accommodations debe aceptar `bboxNorth`/`bboxSouth`/`bboxEast`/`bboxWest` (números, lat/lng) para filtrar por viewport del mapa. **Importante:** el filtro se aplica con la **coord exacta server-side** (no con la aproximada) para que el conteo sea correcto. Lo que se devuelve al cliente sigue siendo el `approximateLocation` (coord obfuscated). Esto preserva privacidad sin sacrificar UX del search.

**Tests de integración nuevos** en `apps/api/test/integration/`:
- Public accommodation: response NO tiene `coordinates`/`street`/`number`, sí tiene `approximateLocation`.
- Public accommodation: el `approximateLocation` cambia si cambio el salt en env.
- Public accommodation: la distancia entre `approximateLocation.{lat,lng}` y la coord real está siempre ≤ 500m.
- Admin accommodation: response tiene coordinates exactas.
- Distintas instancias del mismo accommodation devuelven el mismo approximate (determinismo).

### 11. Frontend Architecture (apps/web)

**11.1 Nueva dependencia** en `apps/web/package.json`:
```json
"dependencies": {
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1",
  "react-leaflet-cluster": "^2.1.0"
},
"devDependencies": {
  "@types/leaflet": "^1.9.12"
}
```

**11.2 Actualizar CSP** en `apps/web/src/lib/middleware-helpers.ts` (función `buildCspHeader`):
```ts
'img-src': [..., 'https://*.tile.openstreetmap.org', 'https://*.openstreetmap.org'],
'connect-src': [..., 'https://*.tile.openstreetmap.org'],
```

**11.3 Componente nuevo** `apps/web/src/components/maps/LocationMap.client.tsx`:

```tsx
interface LocationMapProps {
  mode: 'exact' | 'approximate';
  lat: number;
  lng: number;
  radiusMeters?: number;          // requerido si mode='approximate'
  markerLabel?: string;           // requerido si mode='exact'
  zoom?: number;                  // default 14
  ariaLabel: string;              // a11y
  i18nStrings: {
    attribution: string;
    zoomIn: string;
    zoomOut: string;
    approximateDisclaimer: string;
  };
}
```

- `client:only="react"` (Leaflet usa `window`, no SSR-ea).
- Import dinámico opcional para garantizar code-split.
- Aplicar workaround de marker icon (`L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })` con paths de `leaflet/dist/images/`).
- En modo `approximate`: render `<Circle center={[lat,lng]} radius={radiusMeters} />` + `maxZoom={17}`.
- En modo `exact`: render `<Marker position={[lat,lng]}><Popup>{markerLabel}</Popup></Marker>` + `maxZoom={19}` (default OSM).
- Contenedor con `min-height: 400px` (desktop), `300px` (mobile).
- Disclaimer en bottom-left si mode=approximate.

**11.3.b Componente nuevo** `apps/web/src/components/maps/ListingMap.client.tsx` (para US-06/US-07):
```tsx
interface ListingMapProps {
  mode: 'accommodation-list' | 'destination-list';
  items: Array<{
    id: string;
    slug: string;
    name: string;
    thumbnailUrl?: string;
    price?: { amount: number; currency: string };
    // For accommodations:
    approximateLocation?: ApproximateLocation;
    // For destinations:
    coordinates?: { lat: number; lng: number };
  }>;
  initialBounds?: BBox;
  onBoundsChange?: (bbox: BBox) => void;  // for sidebar search-by-viewport
  hoveredItemId?: string | null;          // for hover sync from sidebar
  onMarkerClick?: (id: string) => void;
  i18nStrings: {...};
}
```
- Usa `react-leaflet-cluster` (~10KB extra) para agrupar cuando hay muchos items.
- En `accommodation-list` mode: render Circle por cada item.
- En `destination-list` mode: render Marker por cada item.
- Emite `onBoundsChange` con debounce 300ms.
- Highlight visual cuando `hoveredItemId === item.id`.

**11.3.c Hook nuevo** `apps/web/src/hooks/useViewportSearch.ts`:
- Wrappea TanStack Query para refetch del listing cuando el bbox cambia.
- Debounce 500ms para evitar spam de requests durante pan.

**11.4 Integración en pages:**

- `apps/web/src/components/accommodation/LocationSection.astro` → reemplazar placeholder por `<LocationMap client:only="react" mode="approximate" lat={data.approximateLocation.lat} lng={data.approximateLocation.lng} radiusMeters={data.approximateLocation.radiusMeters} ... />`.
- `apps/web/src/pages/[locale]/destinos/[slug]/index.astro` (path real a verificar) → agregar sección con `<LocationMap mode="exact" ... />`.
- `apps/web/src/pages/[locale]/alojamientos/index.astro` → agregar toggle "Lista / Mapa". El toggle persiste en URL (`?view=map`). Cuando view=map, render `<ListingMap client:only="react" mode="accommodation-list" ... />` con sidebar de cards.
- `apps/web/src/pages/[locale]/destinos/index.astro` → mismo patrón pero `mode="destination-list"`.

**11.5 Lazy loading verification:**
- El bundle del mapa NO debe estar en el chunk inicial. Verificar con `pnpm build` y revisar el output.
- `client:only="react"` garantiza que solo se carga cuando la página se hidrata.

### 12. i18n Keys

Crear nuevo archivo `packages/i18n/src/locales/{es,en,pt}/maps.json`:

```json
{
  "attribution": "© Colaboradores de OpenStreetMap",
  "zoomIn": "Acercar",
  "zoomOut": "Alejar",
  "approximateDisclaimer": "Ubicación aproximada. La dirección exacta se compartirá con la reserva confirmada.",
  "openInExternalMap": "Abrir en mapa externo",
  "ariaLabelAccommodation": "Mapa con ubicación aproximada del alojamiento",
  "ariaLabelDestination": "Mapa con ubicación del destino"
}
```

Registrar en `packages/i18n/src/index.ts` el nuevo namespace `maps`.

### 13. Admin Changes (IN SCOPE — geocoding & location picker)

**13.1 Reemplazar `LocationViewField.tsx` por `LocationPickerField.tsx`** en `apps/admin/src/features/accommodations/components/edit/fields/`. El nuevo componente:

```tsx
interface LocationPickerFieldProps {
  value: {
    coordinates?: { lat: string; long: string };
    street?: string;
    number?: string;
    floor?: string;
    apartment?: string;
  };
  onChange: (next: typeof value) => void;
  destinationId?: string;        // pre-bias autocomplete to this destination
  defaultCenter?: [number, number]; // fallback center if no value
  errors?: Record<string, string>;
}
```

**Layout:**
- Input de búsqueda con autocomplete (debounce 300ms, llama a Photon API directamente desde el browser).
- Botón "📍 Usar mi ubicación actual" (Geolocation API).
- Mapa Leaflet con pin draggable (`<Marker draggable={true}>` de react-leaflet).
- Campos editables manualmente: `street`, `number`, `floor`, `apartment` (`city`/`state`/`country` vienen del destinationId, no se editan acá).

**13.2 Geocoding strategy:**

| Operación | Provider | Cuándo | Rate limit handling |
|-----------|----------|--------|---------------------|
| **Autocomplete** (input → sugerencias) | **Photon** (Komoot, gratis, sin API key) | On user typing, debounce 300ms | Si falla, input sigue funcionando como text |
| **Forward geocoding** (dirección → coords) | **Nominatim** (gratis, sin API key) | Cuando usuario selecciona sugerencia o submit form | 1 req/seg, queue server-side si batch |
| **Reverse geocoding** (pin movido → dirección) | **Nominatim** | Después de drag pin, debounce 800ms | Si rate limit, skip silently |

**Endpoints usados:**
- Photon: `https://photon.komoot.io/api/?q={query}&lang=es&bbox=-73.5,-55.0,-53.6,-21.8` (bbox = Argentina)
- Nominatim: `https://nominatim.openstreetmap.org/search?q={query}&format=json&countrycodes=ar`
- Nominatim reverse: `https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json`

**13.3 Backend service:** `packages/service-core/src/services/geocoding/geocoding.service.ts` (NEW)
- Wrapper sobre Photon + Nominatim con fallback chain.
- Cache LRU in-memory (10min TTL) para queries repetidas.
- Rate limiting interno (1 req/seg para Nominatim).
- Permite que el frontend llame a `apps/api` en vez de directo al provider externo (mejor para CSP, control y observability).

**Endpoints API nuevos:**
- `GET /api/v1/admin/geocoding/autocomplete?q=...` (auth required: ACCOMMODATION_LOCATION_EDIT) → proxy a Photon
- `GET /api/v1/admin/geocoding/reverse?lat=...&lng=...` → proxy a Nominatim reverse
- `GET /api/v1/admin/geocoding/forward?q=...` → proxy a Nominatim search

**13.4 User-Agent header obligatorio:** Nominatim requiere User-Agent identificable (`Hospeda/1.0 (admin@hospeda.ar)`). Configurable vía env var `HOSPEDA_GEOCODING_USER_AGENT`.

**13.5 CSP en admin** (`apps/admin/src/...` — verificar paths):
- `connect-src` debe permitir `https://photon.komoot.io` y `https://nominatim.openstreetmap.org` si el frontend llama directo (alternativa: solo nuestro `/api/v1/admin/geocoding/*` y el server proxea — esta es la opción recomendada por seguridad).
- `img-src` debe permitir tiles de OSM como en web.

**Decisión:** **Server-side proxy** para todas las llamadas a geocoding providers. Razones:
- Cero exposure de detalles del provider al frontend.
- Single source de rate limiting + cache.
- User-Agent control centralizado.
- Si en el futuro switch a Mapbox, solo cambia el server.

**13.6 Plan B documentado:** Si Photon/Nominatim no rinden bien en zonas rurales argentinas (probable para algunas localidades chicas), switch a **Mapbox Search API**. Migration: cambiar el geocoding service para usar Mapbox SDK en server-side, agregar `HOSPEDA_MAPBOX_GEOCODING_TOKEN` env var, mantener el mismo API contract para el frontend.

**13.7 Promotion del componente Map a shared package:**

El `LocationMap.client.tsx` original (web) y el nuevo `LocationPickerField.tsx` (admin) comparten lógica de mapa. **Decisión:** crear `packages/ui-maps/` con:
- `LocationMap` (read-only, web)
- `LocationPicker` (interactive, admin)
- `ListingMap` (read-only, web)
- Shared utilities (Leaflet config, marker icons workaround, types).

Esto evita duplicación. Justificación: con admin entrando in-scope, ya hay 2 consumidores → DRY justifica el package.

### 14. Observability

- `@repo/logger` log en `obfuscateCoordinates` solo en debug level (no loguear coords exactas en prod, eso anula el propósito).
- Sentry breadcrumb cuando un accommodation no tiene coords y se renderiza la sección sin mapa (data quality signal).
- Ningún log de coordenadas reales debe llegar a logs estructurados de prod.

### 15. Testing Strategy

**Unit (Vitest):**
- `packages/service-core/src/utils/location-obfuscation.test.ts`:
  - Determinismo (mismo input → mismo output).
  - Distancia ≤ 350m del offset al original (límite teórico).
  - Distintos salts → distintos offsets.
  - Edge cases: lat 0, lng 0, antemeridiano, polos.
- `packages/service-core/src/services/accommodation/accommodation.projections.test.ts`:
  - Projection con coords válidas.
  - Projection con coords inválidas/missing.
  - Projection NO incluye coords exactas en output.

**Integration (apps/api/test):**
- `accommodation.public.routes.integration.test.ts`:
  - Response NO incluye `coordinates`/`street`/`number`.
  - Response incluye `approximateLocation` cuando hay coords reales.
  - Response NO incluye `approximateLocation` cuando no hay coords.
  - Determinismo entre llamadas.
- `destination.public.routes.integration.test.ts`:
  - Response incluye `coordinates` exactas.

**Component (apps/web/test/):**
- `LocationMap.client.test.tsx` con happy-dom + mock de Leaflet:
  - Renderiza Circle en mode=approximate.
  - Renderiza Marker en mode=exact.
  - maxZoom=17 cuando approximate.
  - Disclaimer visible cuando approximate.
  - i18n strings se aplican.

**E2E (Playwright, apps/e2e):**
- Test que entra a `/es/alojamientos/<seed-slug>`, espera el mapa, screenshot del círculo.
- Test que entra a `/es/destinos/<seed-slug>`, screenshot del pin.
- Test que entra a `/es/alojamientos?view=map`, verifica toggle, hover sync card↔círculo, click en círculo abre popup.
- Test que cambia el viewport (pan/zoom) y verifica que el listing se actualiza.
- Test que entra a `/es/destinos?view=map`, verifica pins.
- Verifica zero CSP errors en console.

**Listing-specific tests (Vitest + happy-dom):**
- `useViewportSearch` debounce funciona (500ms).
- `ListingMap` agrupa items en cluster cuando hay >cluster-threshold.
- `bboxNorth/South/East/West` query params se construyen bien desde el bounds del map.

---

## 16. Implementation Phases

### Phase 1 — Foundation (backend + algoritmo) [~6h]
1. Permission `ACCOMMODATION_LOCATION_EXACT_VIEW` en enum + grants en seeds.
2. Env var `HOSPEDA_LOCATION_SALT` + Zod validation + .env.example + docs.
3. Util `location-obfuscation.ts` + tests unitarios al 100%.
4. `ApproximateLocationSchema` en `packages/schemas/src/common/location.schema.ts`.
5. Projection `projectAccommodationApproximateLocation` + tests.

### Phase 2 — API integration [~4h]
1. Modificar `accommodation.public.schema.ts` (agregar approximateLocation, remover coords).
2. Modificar `destination.public.schema.ts` (asegurar coordinates exposed).
3. Modificar service para invocar projection en endpoints públicos.
4. Tests de integración para ambos endpoints.
5. Verificar manual con curl.

### Phase 3 — Frontend foundation [~5h]
1. Dependencias en `apps/web/package.json` (leaflet, react-leaflet, @types/leaflet).
2. CSP update en `middleware-helpers.ts`.
3. i18n: nuevo namespace `maps` en es/en/pt.
4. Componente `LocationMap.client.tsx` + tests con happy-dom.
5. Workaround del marker icon documentado.

### Phase 4 — Detail page integration [~4h]
1. Reemplazar placeholder en `LocationSection.astro` (accommodation detail).
2. Crear sección equivalente en destination detail page.
3. Smoke tests E2E con Playwright.
4. Lighthouse audit en mobile (verificar no degradación).
5. QA cross-browser (Chrome, Firefox, Safari).

### Phase 5 — Listing maps [~8h]
1. Backend: agregar filtros `bboxNorth/South/East/West` al endpoint público de accommodations + tests.
2. Frontend: componente `ListingMap.client.tsx` con `react-leaflet-cluster`.
3. Frontend: hook `useViewportSearch` con debounce 500ms.
4. Toggle "Lista / Mapa" en `/{locale}/alojamientos/index.astro` (state en URL `?view=map`).
5. Hover sync sidebar ↔ map (highlight visual de círculos cuando hover en card y viceversa).
6. Mini-popup en click sobre círculo (thumbnail + nombre + precio + link).
7. Toggle equivalente en `/{locale}/destinos/index.astro` (con pins exactos).
8. Tests E2E para listing maps.
9. Performance audit con muchos accommodations (verificar clustering rinde, no lag).

### Phase 6 — Admin geocoding & location picker [~10h]
1. Crear package `packages/ui-maps/` con componentes compartidos (`LocationMap`, `LocationPicker`, `ListingMap`) extraídos de web.
2. Backend: `geocoding.service.ts` con Photon + Nominatim, cache LRU, rate limiting interno.
3. Backend: 3 endpoints proxy `/api/v1/admin/geocoding/{autocomplete,forward,reverse}` con auth + permission `ACCOMMODATION_LOCATION_EDIT`.
4. Env vars: `HOSPEDA_GEOCODING_USER_AGENT`.
5. Frontend admin: `LocationPickerField.tsx` con autocomplete + drag pin + "mi ubicación actual".
6. Reemplazar uso del `LocationViewField` legacy en `accommodations/components/edit/`.
7. Actualizar CSP del admin (solo permitir nuestro server, no providers directos).
8. i18n: agregar keys de admin (`admin.locationPicker.*`).
9. Tests: unit tests del geocoding.service (con mocks de Photon/Nominatim), tests del LocationPickerField, smoke E2E del flow de carga.
10. Migration: actualizar 1-2 accommodations existentes en seeds para verificar que el nuevo flow no rompe lo cargado.

**Total Phases 1-6:** ~37h de trabajo focused.

---

## 17. Risk Assessment

| Riesgo | Severidad | Mitigación |
|--------|-----------|-----------|
| Salt leak por log accidental | Alta | Code review + linter rule "no logging of LOCATION_SALT" + Sentry scrubbing |
| Salt rotation rompe UX (círculos cambian de lugar para usuarios habituales) | Baja | Documentar como "expected behavior", rotación es rara |
| OSM rate-limits si Hospeda crece | Media | Plan B: switch a Stadia Maps (free tier 100k tiles/mes) cambiando una URL constant |
| Bundle size de Leaflet (~48KB) | Baja | `client:only="react"` garantiza code-split |
| CLS por mapa que carga tarde | Media | `min-height` fijo + skeleton mientras hidrata |
| Coordenadas como string en DB (legacy schema) | Baja | `parseFloat` en projection con guards `Number.isFinite` |
| Algoritmo de offset no es perfectamente uniforme | Baja | HMAC garantiza distribución uniforme; tests cubren range bound |
| Visitante que sabe Hospeda usa offset determinístico podría usar análisis de imagen para deducir patrón | Muy baja | Salt secreto server-side hace inviable; radio 500m da suficiente uncertainty |
| Hosts se quejan que el círculo es "muy grande" | Media | Comunicar pre-launch que es estándar industry, mostrar Airbnb como ejemplo |
| Map CSP block en producción por proveedor de tiles distinto | Alta | Test pre-deploy + CSP report-uri |
| Performance pobre del listing map con cientos de accommodations | Media | `react-leaflet-cluster` agrupa, debounce 500ms en bbox search, virtualización del sidebar si >100 items |
| Search por bbox lento en backend | Media | Index en `accommodation.location.coordinates` (PostGIS GIST si crece, índice b-tree por lat/lng como punto de partida) |
| Toggle Lista/Mapa rompe SEO (los crawlers no ejecutan JS para ver el listado) | Media | El listing en HTML SSR siempre está; el toggle solo cambia view client-side. SEO intacto. |
| Photon/Nominatim cobertura pobre en zonas rurales AR | Alta | Plan B: switch a Mapbox Search (free tier 100k/mes); arquitectura del geocoding service permite swap sin cambiar frontend |
| Nominatim rate limit (1 req/seg) en momentos pico | Media | Cache LRU server-side (10min TTL), debounce frontend (300ms autocomplete, 800ms reverse), queue en server |
| Drag pin en mobile no es intuitivo | Media | Botón "Tap to drop pin", permitir input manual de lat/lng como fallback, UX testing con hosts reales |
| Geolocation API rechazada por usuario | Baja | Botón es opcional, fallback elegante con texto "Permiso denegado, escribí tu dirección abajo" |
| User-Agent obligatorio de Nominatim no respetado → ban | Alta | Header configurable vía env var, validación en CI que esté presente, monitoring de respuestas 403 |

---

## 18. Dependencies & Order

```
SPEC-097 dependencies:
  - Ninguna spec previa bloqueante
  - Recomendado tener SPEC-095 (destination refactor) completa → ✅ ya está done
  - SPEC-092 (E2E suite) en curso → útil para Phase 4 (E2E tests), pero no bloquea

SPEC-097 unblocks:
  - SPEC-XXX (futura): Booking flow con reveal exacto post-reserva
  - SPEC-XXX (futura): Drag-pin admin editor para coords
  - SPEC-XXX (futura): Custom tiles / dark mode del mapa
```

---

## 19. Critical Files (Reference)

**Backend:**
- `packages/schemas/src/enums/permission.enum.ts` — agregar permission
- `packages/schemas/src/common/location.schema.ts` — agregar `ApproximateLocationSchema`
- `packages/schemas/src/entities/accommodation/accommodation.public.schema.ts` — modificar
- `packages/schemas/src/entities/accommodation/accommodation.detail.schema.ts` — modificar (preview)
- `packages/schemas/src/entities/destination/destination.public.schema.ts` — verificar coords expuestas
- `packages/service-core/src/utils/location-obfuscation.ts` — **NEW**
- `packages/service-core/src/services/accommodation/accommodation.projections.ts` — extender
- `packages/service-core/src/services/accommodation/accommodation.service.ts` — wire projection
- `apps/api/src/utils/env.ts` — `HOSPEDA_LOCATION_SALT` + `HOSPEDA_GEOCODING_USER_AGENT`
- `apps/api/.env.example` — documentar salt y geocoding user-agent
- `packages/service-core/src/services/geocoding/geocoding.service.ts` — **NEW** (Photon + Nominatim wrapper)
- `apps/api/src/routes/admin/geocoding/autocomplete.ts` — **NEW**
- `apps/api/src/routes/admin/geocoding/forward.ts` — **NEW**
- `apps/api/src/routes/admin/geocoding/reverse.ts` — **NEW**
- `apps/api/src/routes/accommodation/public/list.ts`, `get-by-slug.ts` — verificar invocación de projection
- `apps/api/src/routes/destination/public/list.ts`, `get-by-slug.ts` — verificar coords expuestas
- `packages/seed/src/data/permission/` — grant nueva permission a admin/super-admin

**Frontend (web):**
- `apps/web/package.json` — deps
- `apps/web/src/lib/middleware-helpers.ts` — CSP
- `apps/web/src/components/accommodation/LocationSection.astro` — reemplazar placeholder
- `apps/web/src/pages/[locale]/destinos/[slug]/index.astro` — agregar sección (verificar path real)
- `apps/web/src/pages/[locale]/alojamientos/index.astro` — agregar toggle Lista/Mapa
- `apps/web/src/pages/[locale]/destinos/index.astro` — agregar toggle Lista/Mapa
- `apps/web/src/hooks/useViewportSearch.ts` — **NEW**

**Frontend (admin):**
- `apps/admin/package.json` — deps (consume `@repo/ui-maps`)
- `apps/admin/src/lib/csp.ts` (o donde esté el CSP del admin) — permitir tiles + nuestro `/api/v1/admin/geocoding/*`
- `apps/admin/src/features/accommodations/components/edit/fields/LocationPickerField.tsx` — **NEW**
- `apps/admin/src/features/accommodations/components/view/fields/LocationViewField.tsx` — refactor para mostrar mapa embebido en vez de link a Google
- `apps/admin/src/features/accommodations/api/geocoding.api.ts` — **NEW** (TanStack Query wrappers para los 3 endpoints proxy)

**Shared package (NEW):**
- `packages/ui-maps/` — **NEW PACKAGE**
  - `src/LocationMap.tsx` — read-only viewer (detail pages)
  - `src/LocationPicker.tsx` — interactive editor (admin)
  - `src/ListingMap.tsx` — multiple markers + clustering
  - `src/utils/leaflet-config.ts` — marker icons workaround, Leaflet defaults
  - `src/types.ts` — shared types
  - `package.json`, `tsconfig.json`, `vitest.config.ts`

**i18n:**
- `packages/i18n/src/locales/es/maps.json` — **NEW**
- `packages/i18n/src/locales/en/maps.json` — **NEW**
- `packages/i18n/src/locales/pt/maps.json` — **NEW**
- `packages/i18n/src/index.ts` — registrar namespace

**Tests:**
- `packages/service-core/src/utils/location-obfuscation.test.ts` — **NEW**
- `packages/service-core/src/services/accommodation/accommodation.projections.test.ts` — extender
- `apps/api/test/integration/accommodation.public.test.ts` — extender
- `apps/api/test/integration/destination.public.test.ts` — extender
- `packages/ui-maps/src/LocationMap.test.tsx` — **NEW**
- `packages/ui-maps/src/LocationPicker.test.tsx` — **NEW**
- `packages/ui-maps/src/ListingMap.test.tsx` — **NEW**
- `packages/service-core/src/services/geocoding/geocoding.service.test.ts` — **NEW**
- `apps/web/test/hooks/useViewportSearch.test.ts` — **NEW**
- `apps/admin/test/features/accommodations/LocationPickerField.test.tsx` — **NEW**
- `apps/api/test/integration/admin/geocoding.test.ts` — **NEW**
- `apps/e2e/tests/accommodation-map.spec.ts` — **NEW** (detail + listing)
- `apps/e2e/tests/destination-map.spec.ts` — **NEW** (detail + listing)
- `apps/e2e/tests/admin-location-picker.spec.ts` — **NEW** (host carga ubicación con autocomplete + drag)

**Docs:**
- `docs/guides/environment-variables.md` — documentar `HOSPEDA_LOCATION_SALT` y `HOSPEDA_GEOCODING_USER_AGENT`
- `docs/decisions/ADR-018-location-privacy.md` — **NEW** ADR explicando el algoritmo
- `docs/decisions/ADR-019-geocoding-provider.md` — **NEW** ADR explicando elección Photon+Nominatim y plan B Mapbox
- `packages/ui-maps/CLAUDE.md` — **NEW** instrucciones del package nuevo

---

## 20. Verification Plan (End-to-End)

**Local (manual):**
```bash
# 1. Setup
cd /home/qazuor/projects/WEBS/hospeda
echo 'HOSPEDA_LOCATION_SALT=$(openssl rand -base64 48)' >> apps/api/.env.local
pnpm install
pnpm db:fresh-dev
pnpm dev

# 2. Backend smoke
curl -s http://localhost:3001/api/v1/public/accommodations/cabana-chajari | jq '.data | {coordinates, approximateLocation, street}'
# Expect: coordinates undefined, street undefined, approximateLocation { lat, lng, radiusMeters: 500 }

curl -s http://localhost:3001/api/v1/public/destinations/chajari | jq '.data.coordinates'
# Expect: { lat: "-30.7500", long: "-57.9833" }

# 3. Determinism check
curl -s http://localhost:3001/api/v1/public/accommodations/cabana-chajari | jq '.data.approximateLocation' > /tmp/r1.json
sleep 2
curl -s http://localhost:3001/api/v1/public/accommodations/cabana-chajari | jq '.data.approximateLocation' > /tmp/r2.json
diff /tmp/r1.json /tmp/r2.json
# Expect: no diff

# 4. Frontend
# Open http://localhost:4321/es/alojamientos/cabana-chajari
# - Confirm: circle visible, no pin, disclaimer present
# - Confirm: zoom locked at 17
# - DevTools → Network: tiles load from openstreetmap.org, no CSP errors
# - DevTools → Performance: no CLS spike

# Open http://localhost:4321/es/destinos/chajari
# - Confirm: pin visible, free zoom
# - DevTools: no console errors

# 5. Tests
pnpm test --filter @repo/service-core
pnpm test --filter @repo/api
pnpm test --filter @repo/web
pnpm typecheck
pnpm lint

# 6. Build & bundle audit
pnpm build
# Inspect web build output: leaflet should be in a separate chunk, not in main bundle

# 7. E2E
pnpm --filter @repo/e2e test:headed accommodation-map destination-map
```

**Cross-browser QA:**
- Chrome desktop + mobile emulator (Pixel 7)
- Firefox desktop
- Safari desktop + iOS simulator
- Verificar: marker/circle render OK, atribución OSM legible, sin CSP warnings.

**Performance budget:**
- Lighthouse mobile en `/es/alojamientos/<slug>`:
  - Performance ≥ baseline - 3 puntos
  - LCP no impactado (mapa carga abajo del fold)
  - CLS = 0
- Bundle del mapa code-split confirmado en stats.

---

## 21. Decisiones Confirmadas

1. ✅ **Radio del círculo aproximado:** 500m (industry standard).
2. **Disclaimer text:** "Ubicación aproximada. La dirección exacta se compartirá con la reserva confirmada." (revisable en QA).
3. ✅ **Listing maps:** IN SCOPE en SPEC-097 (Phase 5 obligatoria).
4. ✅ **Map provider tiles:** OSM default, Stadia documentado como Plan B.
5. **i18n locales:** es/en/pt (los actuales del proyecto).
6. ✅ **Admin geocoding UX:** Autocomplete + drag pin (US-08, US-09).
7. ✅ **Geocoding provider:** Photon (autocomplete) + Nominatim (forward/reverse), Mapbox como Plan B.
8. ✅ **Admin geocoding scope:** IN SCOPE en SPEC-097 (Phase 6).
9. ✅ **Promotion a package compartido:** SÍ — crear `packages/ui-maps/` (web + admin lo consumen).

---

## 22. References

- **Airbnb location obfuscation research**: https://techscience.org/a/2018100902/
- **VRBO address policy**: https://help.vrbo.com/articles/What-is-the-property-address-release-policy
- **Privacy patterns — Location Granularity**: https://privacypatterns.org/patterns/Location-granularity
- **Leaflet docs**: https://leafletjs.com/
- **react-leaflet docs**: https://react-leaflet.js.org/
- **OSM Tile Usage Policy**: https://operations.osmfoundation.org/policies/tiles/
- **Stadia Maps (backup provider)**: https://stadiamaps.com/
- **MDN: HMAC**: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign

---

## Appendix A — Sample API Response

**Public accommodation (`/api/v1/public/accommodations/cabana-chajari`):**
```json
{
  "data": {
    "id": "acc_01HXZ...",
    "slug": "cabana-chajari",
    "name": "Cabaña Retiro Soleado",
    "summary": "...",
    "approximateLocation": {
      "lat": -30.7503,
      "lng": -58.0445,
      "radiusMeters": 500
    },
    "cityDestination": {
      "id": "dest_01HX...",
      "slug": "chajari",
      "name": "Chajarí",
      "level": "CITY",
      "destinationType": "CITY"
    }
    // Note: NO `coordinates`, NO `location.street`, NO `location.number`
  }
}
```

**Public destination (`/api/v1/public/destinations/chajari`):**
```json
{
  "data": {
    "id": "dest_01HX...",
    "slug": "chajari",
    "name": "Chajarí",
    "level": "CITY",
    "destinationType": "CITY",
    "coordinates": { "lat": "-30.7500", "long": "-57.9833" }
  }
}
```

---

## Appendix B — Decision Log

| # | Decision | Rationale |
|---|---------|-----------|
| 1 | Leaflet over MapLibre/Mapbox/Google | 5x menor bundle, $0 con OSM, ecosistema React maduro, suficiente para use case puntual |
| 2 | Aproximación via círculo + offset deterministic HMAC | Industry standard (Airbnb), determinístico, irreversible, simple |
| 3 | Radio 500m | Sweet spot entre privacidad y utilidad (Airbnb avg 457m) |
| 4 | Salt server-side via env var | Irreversibilidad sin DB extra; rotable |
| 5 | Gating por endpoint (público vs admin), no por permission del actor en endpoint público | Más simple, menos risk de leak por config error; cuando booking exista, ahí sí gating granular |
| 6 | maxZoom: 17 cuando approximate | Previene over-zoom para inferir precision |
| 7 | NO mover el componente a package compartido aún | YAGNI, admin todavía no lo usa |
| 8 | Listing maps IN SCOPE (Phase 5 obligatoria) | User decisión: shippear sistema completo en una unidad. Implica clustering + bbox search en backend. |
| 8.b | Filtro bbox usa coords exactas server-side, devuelve approximate al cliente | Privacy + UX correctos: el conteo del search es preciso, pero el cliente nunca ve la coord exacta. |
| 9 | Admin geocoding IN SCOPE (Phase 6) con autocomplete + drag pin | Sin esto los nuevos accommodations no cargan coords y mapas públicos quedan vacíos |
| 10 | Coordenadas siguen como string en DB | No vale la pena migrar el schema solo para esto; convertir con `parseFloat` en projection |
| 11 | Geocoding via Photon (autocomplete) + Nominatim (forward/reverse) | Gratis, sin API key, cobertura AR aceptable; Plan B Mapbox documentado si rinde mal |
| 12 | Server-side proxy para todas las llamadas a geocoding | Cero exposure del provider al frontend, cache + rate limit centralizado, swap de provider sin tocar frontend |
| 13 | Crear nuevo package `packages/ui-maps/` | Web + admin consumen los mismos componentes; DRY justifica el package |
| 14 | "Mi ubicación actual" via Geolocation API en admin | UX bonus para hosts presentes en la propiedad; opcional, fallback elegante |
| 15 | Reverse geocoding solo después de drag con debounce 800ms | Respeta rate limit Nominatim (1 req/seg) |
