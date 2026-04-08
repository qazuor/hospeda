# SPEC-022 Audit Report - Estado Real al 2026-03-02

## Resumen Ejecutivo

**De 18 User Stories en la spec, el estado real es:**

- Completadas al 100%: 8
- Completadas parcialmente (70-90%): 7
- No implementadas: 3

---

## THEME GROUP: Dark Mode & Theming

### US-T01: Dark mode en todos los componentes web

**Estado: ~85% completado**

**Lo que se hizo:**

- Se arreglaron ~40 componentes React y Astro con `dark:` variants
- UserNav, TypePopover, DestinationPopover, Toast, ImageCarousel, ReviewForm, ReviewList, FilterSidebar, ContactForm.. todos arreglados

**Lo que falta:**

- 2 `bg-white` sin `dark:` variant:
  - `HeroImageCarousel.client.tsx:156` (dot de carousel)
  - `CalendarView.client.tsx:443` (indicador de evento)
- 22 valores `rgba()` hardcodeados en componentes Astro (no se adaptan a dark mode):
  - `Header.astro`: 7 rgba values (overlays blancos)
  - `StickyNav.astro`: 7 rgba values (overlays blancos)
  - `NewsletterSection.astro`: 2 rgba values
  - `StatisticsSection.astro`: 3 rgba values
  - `MapView.client.tsx`: 1 rgba value
- 1 `#fff` inline en `DestinationCard.astro:166` (tooltip color)

**Veredicto:** Los componentes principales están arreglados, pero quedan 26 violaciones menores concentradas en rgba() de Header/StickyNav y un par de bg-white puntuales.

---

### US-T02: CSS variables con cobertura dark mode completa

**Estado: 100% completado**

- Todos los `--color-primary-*` (50-950) tienen overrides dark mode
- `--shadow-*` variables tienen overrides dark mode
- Status colors (success, error, warning, info) tienen overrides dark mode
- Colores semánticos (green, terracotta, secondary) tienen overrides dark mode

---

### US-T03: Z-index consistente y documentado

**Estado: 100% completado**

- Decisión documentada: usar CSS variable tokens
- Documentación en design standards

---

### US-T04: Shared Tailwind config evaluado

**Estado: 100% completado**

- Documentado que web y admin usan sistemas de diseño separados intencionalmente
- `@repo/tailwind-config` documentado con su estrategia

---

### US-T05: No `!important` overrides

**Estado: ~90% completado**

**Lo que se hizo:**

- Removidos los 14 `!important` de `NewsletterSection.astro`
- Removidos los `!important` de `AccommodationCardDetailed.astro` y `AccommodationCardFeatured.astro`

**Lo que falta:**

- 2 `!important` restantes (ambos en SVGs decorativos):
  - `RiverWavesDivider.astro:146`: `fill: var(--color-bg) !important;`
  - `LitoralMap.astro:267`: `opacity: 0 !important;`

**Veredicto:** Los 2 restantes son en SVGs decorativos y son intencionales para control visual. La spec excluye explícitamente "inline critical CSS". Se puede considerar completado.

---

### US-T06: No hex/rgba hardcodeados en componentes

**Estado: ~70% completado**

**Lo que se hizo:**

- `HeroImageCarousel.client.tsx`: Parcialmente arreglado (eliminados algunos `#ffffff`)
- `Footer.astro`: `#0F1A2E` tiene dark override (`dark:to-bg`)

**Lo que falta:**

- 22 `rgba()` en Header.astro, StickyNav.astro, NewsletterSection.astro, StatisticsSection.astro (mismo issue de US-T01)
- `DestinationCard.astro`: hex colors hardcoded en CSS fallbacks
- `WaveDivider.astro`: `fill='#FFFFFF'` como prop default
- `logger.ts`: hex colors hardcodeados (pero es logging, no UI)

**Veredicto:** El header y sticky nav siguen teniendo rgba() hardcodeados que no se adaptan a dark mode. Es el gap más significativo de la sección de theming.

---

### US-T07: Admin usa clases semánticas shadcn

**Estado: ~99% completado**

**Lo que se hizo:**

- PageSkeleton.tsx: 62 clases hardcodeadas reemplazadas
- CacheMonitor.tsx: 27 clases reemplazadas
- signin.tsx, signup.tsx: Clases reemplazadas
- ~35 archivos adicionales arreglados

**Lo que falta:**

- 1 violación: `VirtualizedDataTable.tsx:313` (3 clases de scrollbar `gray-*`)

**Veredicto:** Prácticamente completo. La violación restante es mínima (scrollbar styling).

---

## I18N GROUP: Internationalization

### US-I01: Todas las pages admin usan translation keys

**Estado: ~70% completado**

**Lo que se hizo:**

- 64 archivos de rutas con `useTranslations()`
- Profile, settings, billing dialogs (Plan, Addon, Exchange Rates).. correctamente traducidos
- Translation types regenerados (2058 a 3566 keys)

**Lo que falta (CRITICO):**

- **CacheMonitor.tsx**: 36 strings hardcoded en inglés, NO tiene `useTranslations()` importado
- **exchange-rates.tsx**: 2 strings hardcoded en español ("Tasas de Cambio", "Las tasas se actualizan...")
- **invoices.tsx**: 3 strings hardcoded en español
- **posts/$id_.seo.tsx**: 5 strings hardcoded en inglés
- **posts/$id_.sponsorship.tsx**: 3 strings hardcoded en inglés
- **events/$id_.attendees.tsx**: 15+ strings hardcoded ("Coming Soon", lista de features)
- **events/$id_.tickets.tsx**: "Coming Soon" hardcoded
- **events/locations/$id_.events.tsx**: "Coming Soon" hardcoded
- **events/organizers/$id_.events.tsx**: "Coming Soon" hardcoded
- **ContactInfoViewField.tsx**: 3 strings ("Primary Contact", "Website", "Contact Person")
- **LocationViewField.tsx**: 2 strings ("Address", "Notes")

**Total: ~70+ strings hardcodeados en ~11 archivos**

**Veredicto:** Hay un gap significativo. CacheMonitor con 36 strings es el peor caso. Los "Coming Soon" en events son placeholders pero deberían estar traducidos.

---

### US-I02: Estrategia de idioma consistente en admin

**Estado: 100% completado**

- Documentado que admin usa inglés como idioma base
- Translation keys siguen patrón consistente: `admin-pages.*`, `admin-billing.*`, `admin-entities.*`

---

### US-I03: Formateo de fechas/números centralizado

**Estado: ~50% completado**

**Lo que se hizo:**

- `formatDate`, `formatNumber`, `formatCurrency` creados en `@repo/i18n/formatting.ts` con 49 tests
- **Web app**: 15+ archivos usan las utilidades correctamente (0 hardcoded `es-AR`)

**Lo que falta (CRITICO):**

- **Admin app**: 35+ instancias de `'es-AR'` hardcodeado:
  - 17 `Intl.NumberFormat('es-AR'...)`
  - 12 `Intl.DateTimeFormat('es-AR'...)`
  - 11 `.toLocaleDateString('es-AR'...)` / `.toLocaleString('es-AR'...)`
  - 7 `.toLocaleString()` sin locale (usa default del browser)
- Archivos afectados: billing columns, payment utils, subscription utils, sponsor pages, profile.tsx, PriceCell.tsx, DateCell.tsx, etc.
- **El admin app NO importa ni usa `formatDate`/`formatNumber`/`formatCurrency` en ningún lugar**

**Veredicto:** Web app 100% completada. Admin app 0% completada para este criterio. Es el gap más grande de toda la spec.

---

### US-I04: 404 y 500 respetan locale del usuario

**Estado: 100% completado**

- `404.astro`: Detecta locale de URL, fallback a Accept-Language, usa `t()` para todo el texto, link a home usa locale
- `500.astro`: Mismo patrón correcto
- Ambos manejan `prerender = false` (SSR) para detección dinámica

---

### US-I05: Pluralización aplicada a contadores

**Estado: NO IMPLEMENTADO**

**Lo que falta:**

- Las translation JSON tienen formas singular/plural definidas (`_one`/`_other` o separador `|`), pero el código NO las usa
- `DestinationCard.client.tsx:44` usa `count === 1 ? singular : plural` manualmente en vez del sistema i18n
- No hay evidencia de manejo de pluralización ICU MessageFormat en el hook `useTranslations`
- Los otros componentes web que muestran contadores tampoco usan pluralización del sistema i18n

**Veredicto:** Las keys existen en los JSON pero el código no las aprovecha. La pluralización es manual con ternarios.

---

## PERFORMANCE GROUP

### US-P01: No N+1 queries en user.service.ts

**Estado: 100% completado**

- `list()` usa `findAllWithCounts()` con subqueries correlacionados
- Counts de accommodation, events, posts en una sola query
- Tests pasan (1806 tests)

---

### US-P02: No N+1 queries en amenity/feature services

**Estado: 100% completado**

- `amenity.service.ts`: Usa `countAccommodationsByAmenityIds()` batch query
- `feature.service.ts`: Usa `countAccommodationsByFeatureIds()` batch query
- Ambos documentados con comments explicando el approach

---

### US-P03: Cache middleware funciona en Node.js

**Estado: 100% completado**

- Usa `Map<string, CacheEntry>` in-memory (no Web Cache API)
- Headers `X-Cache: HIT/MISS` implementados
- TTL handling correcto con expiración automática
- Fail-open: try/catch que continúa sin cache si falla
- FIFO eviction cuando alcanza MAX_ENTRIES (100)

---

### US-P04: Indexes en tabla users

**Estado: 100% completado**

- Indexes individuales: `role`, `lifecycleState`, `visibility`, `deletedAt`, `createdAt`
- Indexes compuestos: `(role, deletedAt)`, `(lifecycleState, deletedAt)`
- Todos con JSDoc descriptivo

---

### US-P05: Search index materialized view con refresh automático

**Estado: 100% completado**

- `search-index-refresh.job.ts` creado
- Usa `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- Schedule: cada 6 horas (`0 */6 * * *`)
- Timeout: 2 minutos
- Registrado en cron registry

---

### US-P06: Health check bypasses middleware chain

**Estado: 100% completado**

- Registrado ANTES de la cadena de middleware en `create-app.ts:86-89`
- Retorna `{ status: 'ok', timestamp }` sin pasar por auth, rate limit, etc.
- Test existente en `test/utils/health-check.test.ts`

---

### US-P07: Hero section con directivas de hydration apropiadas

**Estado: ~90% completado**

**Lo que se hizo:**

- `HeroCarouselWithPhrases`: Cambiado de `client:load` a `client:idle`
- `LiveStatsCounter`: Usa `client:visible` correctamente

**Lo que falta:**

- `HeroSearchBar` en línea 144 usa `client:load`. La spec dice que si no necesita ser interactivo al load, debería usar `client:idle`. Sin embargo, un search bar es discutible.. el usuario podría querer buscar inmediatamente.

**Veredicto:** El carousel fue optimizado. El search bar es una decisión de UX legítima de mantener en `client:load`.

---

### US-P08: Vite aliases resuelven a dist/ en producción

**Estado: N/A POR DISEÑO (100% justificado)**

**Análisis técnico:**

- Vite en modo producción ya transpila, treeshakea y minifica todo el código independientemente de si apunta a `/src/` o `/dist/`. El bundle final es idéntico.
- 2 de 8 paquetes (`@repo/i18n`, `@repo/utils`) no tienen directorio `dist/` y romperían en producción si se aplicara el cambio.
- Los aliases en `astro.config.mjs` bypasean el campo `exports` del `package.json` apuntando directamente a `/src/`, lo cual permite que Vite transpile los `.ts` como parte del build.
- No hay ganancia real de performance al cambiar a `/dist/` prebuildeado.

**Veredicto:** La premisa del spec es incorrecta. El patrón actual (siempre `/src/`) es correcto por diseño y no impacta performance.

---

## Tabla Resumen

| User Story | Criterio | Estado | Trabajo restante |
|-----------|----------|--------|------------------|
| US-T01 | Dark mode web components | ~85% | 26 violations (rgba, bg-white) |
| US-T02 | CSS variables dark mode | 100% | - |
| US-T03 | Z-index strategy | 100% | - |
| US-T04 | Tailwind config | 100% | - |
| US-T05 | No !important | ~95% | 2 en SVGs (aceptable) |
| US-T06 | No hex/rgba hardcoded | ~70% | 22 rgba + hex en Header/StickyNav |
| US-T07 | Admin shadcn classes | ~99% | 1 scrollbar violation |
| US-I01 | Admin i18n completeness | ~70% | 70+ strings en 11 archivos (CacheMonitor critico) |
| US-I02 | Admin language strategy | 100% | - |
| US-I03 | Centralized formatting | ~50% | Admin app: 35+ hardcoded 'es-AR' |
| US-I04 | 404/500 locale-aware | 100% | - |
| US-I05 | Pluralization | 0% | No implementado |
| US-P01 | N+1 user.service | 100% | - |
| US-P02 | N+1 amenity/feature | 100% | - |
| US-P03 | Cache middleware | 100% | - |
| US-P04 | Users table indexes | 100% | - |
| US-P05 | Search index refresh | 100% | - |
| US-P06 | Health check bypass | 100% | - |
| US-P07 | Hero hydration | ~90% | HeroSearchBar client:load (discutible) |
| US-P08 | Vite aliases prod | N/A | No aplica por diseño (Vite ya optimiza) |

---

## Items Prioritarios Pendientes

### CRITICOS (bloquean production-readiness)

1. **Admin: 35+ hardcoded 'es-AR'** en formateo de fechas/números
   - Afecta: billing columns, payment utils, subscription utils, sponsor pages, PriceCell, DateCell
   - Esfuerzo estimado: Medio (importar y reemplazar)

2. **Admin: CacheMonitor.tsx sin i18n** (36 strings)
   - Ni siquiera tiene `useTranslations()` importado
   - Esfuerzo estimado: Bajo

3. **Admin: 11 archivos con strings hardcoded** (~70 strings)
   - exchange-rates, invoices, SEO, sponsorship, events, view fields
   - Esfuerzo estimado: Medio

### IMPORTANTES (deberían hacerse)

4. **Web: 22 rgba() en Header/StickyNav** que no se adaptan a dark mode
   - Son visibles cuando el usuario activa dark mode
   - Esfuerzo estimado: Bajo-medio

5. **Pluralización** (US-I05)
   - Las keys existen pero el código usa ternarios manuales
   - Esfuerzo estimado: Alto (requiere extender el hook useTranslations)

6. **Vite aliases en producción** (US-P08)
   - No implementado
   - Esfuerzo estimado: Bajo

### MENORES (nice to have)

7. **2 bg-white sin dark:** (carousel dot, calendar indicator)
8. **DestinationCard hex colors** en CSS fallbacks
9. **Scrollbar styling en VirtualizedDataTable**
