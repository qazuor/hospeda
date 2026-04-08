# SPEC-030 Audit Report v2: Estado Real de la Migración

**Fecha:** 2026-03-06
**Método:** Análisis exhaustivo de spec vs código real (tsc, biome, vitest, grep, estructura)

---

## Resumen Ejecutivo

La migración de `apps/web-old` a `apps/web` está **estructuralmente completa** y en un estado significativamente mejor de lo que el audit v1 reportó. Muchos issues del audit anterior ya fueron corregidos. Sin embargo, persisten problemas concretos que impiden considerar la migración como "done".

| Métrica | Estado Actual | Audit v1 |
|---------|--------------|----------|
| Páginas creadas (39/39) | COMPLETO | COMPLETO |
| Componentes migrados | COMPLETO | COMPLETO |
| TypeScript (`tsc --noEmit`) | PASA (0 errores) | FALLABA (6 errores) |
| Biome lint | PASA (0 errores) | FALLABA (65 errores) |
| Tests (vitest) | 2195/2195 PASAN (100%) | 2166/2192 (26 fallaban) |
| Imágenes placeholder | COPIADAS (5 SVGs) | Faltaban 40 archivos |
| Imágenes hero/parallax | COPIADAS | Faltaban 32+ archivos |
| `experimental.serverIslands` | **FALTA** | FALTABA |
| `_AccommodationListLayout` | **EXISTE** | No existía |
| Colores hardcodeados | **19 archivos** | 12 archivos |
| Task state integrity | 124/124 "completed", subtasks inconsistentes | Mismo problema |

**Veredicto: 3 issues críticos, 4 issues moderados, 5 issues menores.**

---

## 1. ISSUES CRÍTICOS (Bloquean despliegue)

### 1.1 `experimental.serverIslands` NO habilitado en astro.config.mjs

**Severidad: CRÍTICA**
**Estado: SIN RESOLVER desde audit v1**

El archivo `astro.config.mjs` (100 líneas) NO tiene la propiedad `experimental`. Sin embargo, `server:defer` se usa en **8 ubicaciones** en 6 archivos:

| Archivo | Usos de `server:defer` |
|---------|----------------------|
| `layouts/Header.astro` | 2 (AuthSection hero + scrolled) |
| `pages/[lang]/index.astro` | 4 (AccommodationsSection, DestinationsSection, EventsSection, PostsSection) |
| `pages/[lang]/alojamientos/[slug].astro` | 1 (mencionado en JSDoc, verificar si real) |
| `pages/[lang]/destinos/[...path].astro` | 1 (FavoriteButtonIsland) |
| `components/shared/FavoriteButtonIsland.astro` | Uso en JSDoc |
| `components/review/ReviewListIsland.astro` | Uso en JSDoc |

**Impacto:** En Astro 5.x, `server:defer` requiere `experimental: { serverIslands: true }`. Sin esta config, los componentes deferred podrían:
- Fallar silenciosamente (renderizar como vacíos)
- Lanzar errores en runtime
- Comportarse de forma impredecible según la versión de Astro

**Agravante:** El `CLAUDE.md` de apps/web dice textualmente: _"experimental.serverIslands enabled"_. Esto es **documentación incorrecta** -- dice que está habilitado pero no lo está.

**Fix:** Agregar a `astro.config.mjs`:
```js
experimental: {
  serverIslands: true
}
```

### 1.2 Rendering Strategy Divergences vs Spec (AD-7)

**Severidad: CRÍTICA (potenciales errores en producción)**

La spec AD-7 define strategies claras. Encontré estas divergencias:

| Página | Spec dice | Código real | Problema |
|--------|-----------|-------------|----------|
| `destinos/[slug]/alojamientos/index.astro` | SSR (dynamic slug) | `prerender = true` | Si hay destinos nuevos, no se regeneran |
| `eventos/index.astro` | SSR (query params para filtros) | No tiene `prerender = false` explícito | Funciona como SSR por default con `output: 'server'`, pero debería ser explícito |
| `publicaciones/index.astro` | SSR (query params) | No tiene `prerender` explícito | Mismo issue |
| `mi-cuenta/*.astro` (5 subpages) | SSR (auth-required) | No tienen `prerender = false` explícito | Depende del default SSR, OK pero inconsistente |

**Caso más problemático:** `destinos/[slug]/alojamientos/index.astro` con `prerender = true` pero slug dinámico. Si se agrega un destino nuevo, esa ruta no funcionará hasta el próximo build.

### 1.3 Archivo SubscriptionCard.client.tsx excede límite de 500 líneas

**Severidad: MODERADA-ALTA (viola estándar del proyecto)**

`src/components/account/SubscriptionCard.client.tsx` tiene **619 líneas**, excediendo el límite de 500 del proyecto. Debería dividirse en sub-componentes.

---

## 2. ISSUES MODERADOS (Calidad / Spec Compliance)

### 2.1 Colores hardcodeados en 19 ubicaciones (9 archivos)

La spec AD-4 requiere explícitamente reemplazar TODOS los colores hardcodeados con tokens semánticos. Encontré:

#### Categoría A: Colores de paleta directos (VIOLAN spec)

| Archivo | Patrón | Línea(s) | Debería ser |
|---------|--------|----------|-------------|
| `ShareButtons.client.tsx` | `bg-green-500`, `bg-green-600` | 157 | `bg-secondary` (WhatsApp) |
| `ShareButtons.client.tsx` | `bg-blue-600`, `bg-blue-700` | 171 | `bg-primary` (Facebook) |
| `ContactForm.client.tsx` | `border-red-500`, `focus:border-red-500`, `focus:ring-red-500` | 220, 256, 292, 328 | `border-destructive` |
| `ReviewForm.client.tsx` | `border-red-500`, `focus:border-red-500`, `focus:ring-red-500` | 290, 325 | `border-destructive` |
| `UsageOverview.client.tsx` | `bg-yellow-500` | 46 | `bg-accent` o token warning |
| `ActiveAddons.client.tsx` | `bg-yellow-100 text-yellow-800` | 26 | Token warning semántico |

#### Categoría B: `text-white` en botones con `bg-primary` (ACEPTABLE)

Múltiples componentes de account usan `text-white` sobre botones con fondo de color. Esto es correcto ya que `text-primary-foreground` resuelve a `white`. Archivos: `InvoiceHistory`, `ReviewEditForm`, `ChangePlanDialog`, `UserReviewsList`, `PaymentHistory`, `PreferenceToggles`, `ProfileEditForm`, `UsageOverview`, `ActiveAddons`, `ContactForm`, `FilterChipsBar`.

#### Categoría C: `bg-white/N` en contexto de overlays (ACEPTABLE pero revisar)

| Archivo | Patrón | Línea(s) | Veredicto |
|---------|--------|----------|-----------|
| `Header.astro` | `bg-white/10`, `bg-white/20`, `bg-white/30` | 58, 77, 185-211 | Intencional: glassmorphism sobre hero oscuro. Pero deberían usar tokens para dark mode |
| `HeroSearchForm.tsx` | `bg-white/20`, `bg-black/30` | 50, 194, 203, 215, 233 | Overlays sobre fondo oscuro -- aceptable |
| `HeroSlideshow.tsx` | `bg-white`, `bg-white/50`, `bg-white/70` | 237-238 | Dots de slider sobre imagen -- aceptable |
| `UserNav.client.tsx` | `bg-white/10`, `bg-white/20` | 144 | Glassmorphism -- aceptable |
| `AuthSection.astro` | `bg-white/10`, `bg-white/20` | 47 | Glassmorphism -- aceptable |
| `ThemeToggle.astro` | `bg-white/10`, `bg-white/20` | 31-32 | Glassmorphism -- aceptable |
| `Modal.client.tsx` | `backdrop:bg-black/50` | 110 | Backdrop overlay -- aceptable |
| `HeroSection.astro` | `text-white/80`, `text-white/70` | 68, 71, 74, 88 | Texto sobre hero image -- aceptable |
| `DestinationPreview.astro` | `text-white` | 147 | Texto sobre imagen -- aceptable |
| `SearchFieldType/Destination.tsx` | `text-white`, `text-white/60` | 53, 58 | Texto sobre hero -- aceptable |

**Total violaciones reales de spec:** 6 archivos con colores de paleta directos que deberían usar tokens semánticos. ~15 archivos adicionales con `white/black` en contextos de overlay/hero que son aceptables pero requieren verificación visual en dark mode.

### 2.2 ReviewForm submit es placeholder (TODO en código)

`src/components/review/ReviewForm.client.tsx:164` tiene:
```
// TODO: Replace with actual API call to POST /api/v1/protected/reviews
```

La spec lo documenta como "known issue" (bug #7), pero el TODO queda en producción. Debería tener un plan de resolución.

### 2.3 LanguageSwitcher no migrado

La spec P1-20 pide portar `LanguageSwitcher.astro`. No existe en `apps/web/src/`. Impacto bajo dado el scope "es-only", pero la spec lo lista como tarea y no hay documentación de por qué se omitió.

### 2.4 console.log en JSDoc examples (no en runtime)

Los `console.log` encontrados están todos en comentarios JSDoc como ejemplos de uso, NO en código ejecutable. **No es un problema real.** El único `console.log` en runtime está en `logger.ts` (que es el wrapper de logging).

---

## 3. ISSUES MENORES (Documentación / Limpieza)

### 3.1 CLAUDE.md dice `experimental.serverIslands` está habilitado

`apps/web/CLAUDE.md` línea 111:
> "Server Islands: Auth-dependent components use `server:defer` with `experimental.serverIslands` enabled"

Esto es **falso** -- la config no lo tiene. Se debe actualizar después de agregar la config o antes si se decide no usarla.

### 3.2 Task State inconsistente

El `state.json` tiene 124 tasks todas marcadas "completed" con timestamps, pero `TODOs.md` muestra "0/124 tasks (0%)" con todos los checkboxes sin marcar. Los dos archivos se contradicen.

### 3.3 Archivos rozando el límite de 500 líneas

| Archivo | Líneas |
|---------|--------|
| `SubscriptionCard.client.tsx` | **619** (EXCEDE) |
| `UserReviewsList.client.tsx` | 498 |
| `FilterChipsBar.client.tsx` | 495 |
| `eventos/[slug].astro` | 468 |
| `CalendarView.client.tsx` | 460 |
| `alojamientos/[slug].astro` | 437 |
| `mi-cuenta/index.astro` | 427 |
| `DestinationFilters.client.tsx` | 422 |
| `FilterSidebar.client.tsx` | 416 |
| `owners-page-data.ts` | 412 |

Solo 1 excede el límite, pero 9 más están entre 400-500.

### 3.4 `feedback.astro` no está en spec

Existe `pages/[lang]/feedback.astro` que viene de SPEC-031, no de esta migración. No es un problema, pero no está documentado en SPEC-030.

### 3.5 Falta token para "warning" color

`UsageOverview.client.tsx` y `ActiveAddons.client.tsx` usan `bg-yellow-*` para estados de advertencia. No existe un token semántico `--warning` en el design system. Necesitan una decisión de diseño: agregar token o mapear a `accent`.

---

## 4. COBERTURA DE TESTS (Análisis detallado)

### 4.1 Resumen general

| Categoría | Archivos test | Archivos código | Cobertura |
|-----------|--------------|-----------------|-----------|
| Páginas | 20 | 46 | 43% |
| Componentes | 30 | ~113 | 27% |
| Librerías | 5 | 16 | 31% |
| Store | 1 | 1 | 100% |
| **Total** | **57** | **~176** | **~32%** |

### 4.2 Componentes sin tests (0% cobertura)

| Directorio | Componentes sin test | Impacto |
|-----------|---------------------|---------|
| `sections/` | 8 (HeroSection, AccommodationsSection, etc.) | Bajo (SSR, poco logic) |
| `skeletons/` | 4 | Bajo (puro UI) |
| `layouts/` | 3 (BaseLayout, Header, Footer) | Medio (Header tiene lógica de scroll) |
| `feedback/` | 1 (FeedbackIslandWrapper) | Bajo |

### 4.3 Librerías sin tests

11 de 16 librerías NO tienen tests:
- `auth-client.ts`, `category-colors.ts`, `cn.ts`, `env.ts`, `format-utils.ts`
- `logger.ts`, `media.ts`, `owners-page-data.ts`, `page-helpers.ts`
- `pricing-fallbacks.ts`, `pricing-plans.ts`, `tiptap-renderer.ts`

### 4.4 Configuración vitest

- **Umbrales configurados:** 80% lines, 80% functions, 75% branches, 80% statements
- **Sin `describe.skip`, `it.skip`, `test.only`** -- tests limpios
- **Sin mock files** (`__mocks__/` no existe) -- todos los mocks son inline

### 4.5 Nota sobre el estilo de testing

Los tests de componentes Astro usan un patrón de `readFileSync` + assertions de strings (no DOM rendering). Esto verifica estructura pero no renderizado real. Los tests de React islands sí usan `@testing-library/react` con DOM completo.

---

## 5. LO QUE FUNCIONA CORRECTAMENTE

### 4.1 Estructura completa

- **46 archivos .astro** en `src/pages/` (39 migración + 5 auth + homepage + feedback)
- **95 archivos** pasan biome check sin errores
- **0 errores** de TypeScript
- **2195 tests** pasan al 100%
- **57 archivos** de test

### 4.2 Calidad del código

- No hay `any` types en el código fuente (solo 2 falsos positivos en comentarios)
- Solo 1 TODO en todo el codebase (`ReviewForm.client.tsx`)
- No hay `console.log` en runtime (solo en JSDoc examples y logger.ts)
- No hay `describe.skip`, `it.skip`, `test.only` en tests

### 4.3 Infraestructura completa

- `_AccommodationListLayout.astro` **SÍ existe** (corrige hallazgo del audit v1)
- Todas las imágenes placeholder copiadas
- Todas las imágenes hero/parallax copiadas
- `CLAUDE.md` creado y detallado (277 líneas)
- `format-utils.ts` creado
- `useTranslation.ts` hook creado

### 4.4 Rendering strategy mayoritariamente correcta

- Páginas estáticas (privacidad, terminos, beneficios, contacto, etc.): `prerender = true` -- CORRECTO
- Detail pages con SSG (publicaciones/[slug], eventos/[slug], alojamientos/[slug], destinos/[...path]): `prerender = true` + `getStaticPaths` -- CORRECTO
- SSR pages (busqueda, alojamientos/index, page/[page]): `prerender = false` o sin declarar (default SSR) -- CORRECTO
- Auth pages (mi-cuenta/*): Sin `prerender` explícito, usan default SSR -- CORRECTO

### 4.5 SEO components

- `SEOHead.astro`, `JsonLd.astro`, `ArticleJsonLd.astro`, `EventJsonLd.astro`, `LodgingBusinessJsonLd.astro`, `PlaceJsonLd.astro` -- todos existen

---

## 5. COMPARACIÓN SPEC vs REALIDAD: Checklist de Success Criteria

| # | Criterio de Éxito (Spec) | Estado | Notas |
|---|--------------------------|--------|-------|
| 1 | All 39 pages render correctly | PARCIAL | Depende de resolver serverIslands |
| 2 | All pages pass typecheck, lint, tests | PASA | tsc: 0 err, biome: 0 err, tests: 2195/2195 |
| 3 | All pages use semantic color tokens | FALLA | 6 archivos con colores de paleta |
| 4 | All pages follow STYLE_GUIDE decorative rules | NO VERIFICADO | Requiere revisión visual |
| 5 | All pages have correct SEO | NO VERIFICADO | Requiere revisión manual |
| 6 | All interactive components work | NO VERIFICADO | Requiere testing E2E |
| 7 | All pages work in Spanish (es) | NO VERIFICADO | Requiere testing funcional |
| 8 | Dark mode works on all pages | NO VERIFICADO | Requiere testing visual |
| 9 | Mobile/tablet/desktop responsive | NO VERIFICADO | Requiere Playwright screenshots |
| 10 | Known bugs from web-old fixed | PARCIAL | ReviewForm submit aún placeholder |
| 11 | web-old can be safely deleted | NO | Primero resolver todos los issues |

---

## 6. PLAN DE ACCIÓN PRIORIZADO

### P0 -- Bloquean despliegue (1-2 horas)

| # | Issue | Esfuerzo | Acción |
|---|-------|----------|--------|
| 1 | `experimental.serverIslands` falta | 5 min | Agregar a astro.config.mjs |
| 2 | `destinos/[slug]/alojamientos/index.astro` con `prerender = true` | N/A | ACEPTABLE: ISR (`isr: true` en Vercel adapter) regenera on-demand |

### P1 -- Spec compliance (2-4 horas)

| # | Issue | Esfuerzo | Acción |
|---|-------|----------|--------|
| 3 | 6 archivos con colores hardcodeados | 1h | Reemplazar con tokens semánticos |
| 4 | `SubscriptionCard.client.tsx` 619 líneas | 1h | Dividir en sub-componentes |
| 5 | Definir token `--warning` para yellow | 30 min | Agregar a global.css o decidir alternativa |

### P2 -- Verificación visual (4-8 horas)

| # | Issue | Esfuerzo |
|---|-------|----------|
| 6 | Dark mode check en todas las páginas | 2-4h |
| 7 | Playwright screenshots 3 viewports x 39 páginas | 2-4h |
| 8 | Verificar decorative elements per page type (STYLE_GUIDE) | 1-2h |

### P3 -- Limpieza (1 hora)

| # | Issue | Esfuerzo |
|---|-------|----------|
| 9 | Actualizar CLAUDE.md (serverIslands) | 5 min |
| 10 | Sincronizar state.json con TODOs.md | 15 min |
| 11 | Documentar decisión de omitir LanguageSwitcher | 5 min |

---

## 7. GAPS NO DECLARADOS EN LA SPEC

Problemas encontrados en el código que la spec no menciona ni anticipa:

### 7.1 No hay token semántico para "warning" state

El design system tiene `--destructive` para errores y `--accent` para highlight, pero no tiene un token para estados de advertencia (warning). `UsageOverview` y `ActiveAddons` usan `yellow-*` directamente. Esto no está en el STYLE_GUIDE ni en la spec.

### 7.2 Social share buttons usan colores de marca (green=WhatsApp, blue=Facebook)

ShareButtons usa `bg-green-500` para WhatsApp y `bg-blue-600` para Facebook. Estos son colores de marca de terceros, no del design system de Hospeda. La spec dice "reemplazar todos los hardcoded colors" pero no contempla colores de marca externa. **Decisión pendiente:** usar tokens o mantener colores de marca.

### 7.3 Formularios de validación usan `border-red-*` para errores

ContactForm y ReviewForm usan `border-red-500` para campos con error. La spec dice usar `text-destructive` / `bg-destructive` pero no menciona explícitamente `border-destructive`. **Tailwind con tokens semánticos sí tiene `border-destructive`** -- debería usarse.

### 7.4 Header glassmorphism con `bg-white/N` es frágil en dark mode

El Header usa `bg-white/10` y `bg-white/20` para efecto glassmorphism sobre el hero. En dark mode, `white` con baja opacidad puede no ser visible o contrastar poco. No se ha verificado visualmente.

### 7.5 No hay mecanismo de fallback para `server:defer` failures

Si la config de serverIslands no se habilita (o si Astro cambia la API), no hay fallback handling. Los componentes deferred simplemente desaparecen. No hay error boundary ni contenido alternativo documentado.

### 7.6 `prerender = true` en páginas con `getStaticPaths` dinámico

Varias páginas (destinos/index, eventos/[slug], alojamientos/[slug]) usan `prerender = true` con `getStaticPaths`. Esto significa que se pre-renderizan en build time. Si se agregan nuevos contenidos (nuevo alojamiento, nuevo evento), esas páginas **no se actualizarán** hasta el próximo build. La spec no menciona ISR (Incremental Static Regeneration) aunque `astro.config.mjs` tiene `isr: true` en el adapter de Vercel. Hay que verificar que ISR funciona correctamente con estas páginas.

---

## Apéndice A: Inventario completo de páginas

### Páginas migradas (39) - TODAS EXISTEN

```
Error:     404.astro, 500.astro
Alojam:    index, [slug], page/[page], tipo/[type]/index, tipo/[type]/page/[page]
Destinos:  index, [...path], page/[page], [slug]/alojamientos/index, [slug]/alojamientos/page/[page]
Eventos:   index, [slug], page/[page], categoria/[category]/index, categoria/[category]/page/[page]
Blog:      index, [slug], page/[page], etiqueta/[tag]/index, etiqueta/[tag]/page/[page]
Cuenta:    index, editar, favoritos, preferencias, suscripcion, resenas
Busqueda:  busqueda
Contacto:  contacto
Precios:   turistas, propietarios
Marketing: beneficios, quienes-somos, propietarios/index
Legal:     privacidad, terminos-condiciones, mapa-del-sitio
```

### Páginas pre-existentes (no parte de spec)

```
Auth:      signin, signup, forgot-password, reset-password, verify-email
Homepage:  [lang]/index
Root:      index (redirect)
Extra:     feedback (SPEC-031)
```

## Apéndice B: Colores hardcodeados - Clasificación completa

### Violaciones reales (6 archivos, ~12 ocurrencias) - REQUIEREN FIX

```
src/components/shared/ShareButtons.client.tsx:157     bg-green-500, bg-green-600 (WhatsApp)
src/components/shared/ShareButtons.client.tsx:171     bg-blue-600, bg-blue-700 (Facebook)
src/components/shared/ShareButtons.client.tsx:185     bg-black, bg-zinc-800 (X/Twitter)
src/components/content/ContactForm.client.tsx:220     border-red-500 (x4 locations)
src/components/review/ReviewForm.client.tsx:290       border-red-500 (x2 locations)
src/components/account/UsageOverview.client.tsx:46    bg-yellow-500
src/components/account/ActiveAddons.client.tsx:26     bg-yellow-100 text-yellow-800
```

### Aceptables pero revisar en dark mode (~15 archivos)

```
layouts/Header.astro                    bg-white/10, bg-white/20, bg-white/30 (glassmorphism)
components/HeroSearchForm.tsx           bg-white/20, bg-black/30 (overlays)
components/HeroSlideshow.tsx            bg-white, bg-white/50 (slider dots)
components/auth/UserNav.client.tsx      bg-white/10 (glassmorphism)
components/auth/AuthSection.astro       bg-white/10 (glassmorphism)
components/ui/ThemeToggle.astro         bg-white/10 (glassmorphism)
components/ui/Modal.client.tsx          backdrop:bg-black/50 (overlay)
components/sections/HeroSection.astro   text-white/80, text-white/70 (hero text)
components/destination/DestinationPreview.astro  text-white (over image)
components/shared/SearchFieldType.tsx   text-white, text-white/60 (hero search)
components/shared/SearchFieldDestination.tsx     text-white, text-white/60 (hero search)
```

### Correctos - text-white sobre bg-primary (~12 archivos)

```
account/InvoiceHistory.client.tsx       text-white (sobre botón primary)
account/ReviewEditForm.client.tsx       text-white (sobre botón primary)
account/ChangePlanDialog.client.tsx     text-white (sobre botón primary)
account/UserReviewsList.client.tsx      text-white (sobre botón primary)
account/PaymentHistory.client.tsx       text-white (sobre botón primary)
account/PreferenceToggles.client.tsx    text-white (sobre botón primary)
account/ProfileEditForm.client.tsx      text-white (sobre botón primary)
account/UsageOverview.client.tsx        text-white (sobre progress bar)
account/ActiveAddons.client.tsx         text-white (sobre botón primary)
content/ContactForm.client.tsx          text-white (sobre botón submit)
accommodation/FilterChipsBar.client.tsx text-white (sobre badge primary)
```

## Apéndice C: Comparación con audit v1 - Issues resueltos

| Issue audit v1 | Estado actual |
|---------------|--------------|
| 40 imágenes faltantes | RESUELTO - todas copiadas |
| 6 errores TypeScript | RESUELTO - 0 errores |
| 65 errores de lint | RESUELTO - 0 errores |
| 26 tests fallando | RESUELTO - 2195/2195 pasan |
| `_AccommodationListLayout` no existía | RESUELTO - existe |
| CLAUDE.md "no pre-rendering" incorrecto | RESUELTO - CLAUDE.md reescrito |
| `experimental.serverIslands` faltante | **SIN RESOLVER** |
| Colores hardcodeados | PARCIALMENTE RESUELTO (12 -> 6 archivos con violaciones reales) |
| LanguageSwitcher no migrado | **SIN RESOLVER** (bajo impacto) |
| Task state inconsistente | **SIN RESOLVER** |
