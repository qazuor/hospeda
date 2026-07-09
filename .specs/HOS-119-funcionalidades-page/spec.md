---
title: "Página pública /funcionalidades — catálogo human-friendly de features (marketing)"
linear: HOS-119
statusSource: linear
type: feature
areas: [web, content]
created: 2026-07-09
---

# Página pública `/funcionalidades` — catálogo de features (marketing)

## 1. Overview

### Goal

Publicar una página pública, client-facing y "human-friendly" en `apps/web` en la ruta
`/[lang]/funcionalidades/` que muestre **todo lo que ofrece la plataforma Hospeda**, organizada
por AUDIENCIA (no por categoría técnica), replicando un diseño ya aprobado por el owner.

### Motivation

Hoy el catálogo de funcionalidades vive como un artifact de Claude
(`https://claude.ai/code/artifact/5ac4f7f5-8021-4434-a7bf-03722249f433`) que **requiere login de
claude.ai** para verse — inservible para compartir con clientes potenciales. Se necesita la misma
pieza como página real del sitio, con la identidad visual de Hospeda, para que el owner pueda pasar
el link a interesados (anfitriones, comercios, marcas).

### Referencia de diseño (fuente de verdad del layout y el copy)

`/tmp/claude-1000/-home-qazuor-projects-WEBS-hospeda2/0f2b9959-8919-404d-bf5a-a97dfe2efa16/scratchpad/hospeda-brochure.html`
— el HTML final aprobado. El implementador DEBE leerlo completo para extraer estructura, orden de
secciones, copy exacto y el contenido de las tablas de planes. Este spec define CÓMO portarlo a las
convenciones de `apps/web`; el brochure define QUÉ dice y cómo se ve.

> El brochure se puede archivar como referencia en `apps/web/docs/` o en la carpeta de la spec para
> que no dependa del scratchpad efímero (ver tarea de setup).

### Success criteria

- `GET /es/funcionalidades/` responde 200 y renderiza la página completa en SSR.
- El resultado visual coincide con el brochure aprobado (hero, subnav por audiencia, 4 secciones de
  audiencia, tablas de planes sin precios, sección "Próximamente", CTA de cierre).
- Cero texto hardcodeado: todo el copy pasa por `t()` (namespace `features`, locale `es`).
- Cero color hardcodeado: todo vía tokens de `global.css` → dark mode funciona automáticamente.
- Sin precios en ninguna parte.
- No está enlazada desde el header ni el footer (se comparte manualmente).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` verdes; `pnpm check-locales` sin faltantes.

## 2. User Stories & Acceptance Criteria

### US-1 — Visitante anónimo ve el catálogo completo

**Como** cliente potencial con el link, **quiero** ver todo lo que ofrece Hospeda en lenguaje claro,
**para** entender si me sirve.

- **AC-1.1** — Given un visitante sin sesión, When entra a `/es/funcionalidades/`, Then ve la página
  completa sin requerir login (ruta pública, no bajo `/mi-cuenta/`).
- **AC-1.2** — Given la página cargada, Then muestra, en este orden: (1) hero con logo + tagline
  manuscrita + lede + stat pills, (2) subnav de audiencias, (3) "Un vistazo" (4 pilares), (4) Viajeros,
  (5) Anfitriones, (6) Gastronomía y Experiencias, (7) Marcas, (8) Y además, (9) Próximamente, (10) CTA.
- **AC-1.3** — Given cualquier texto visible, Then proviene de `t('features.*')` (verificable: el
  source de la página no contiene literales de copy en español hardcodeados salvo `aria-label`/fallbacks).

### US-2 — Navegación por audiencia con scroll-spy

- **AC-2.1** — Given el subnav, When el visitante hace click en una audiencia, Then la página scrollea
  suavemente a esa sección (respetando `scroll-margin-top` por el header sticky).
- **AC-2.2** — Given el visitante scrollea, Then el item del subnav correspondiente a la sección en
  viewport recibe estado activo (`data-active`), reusando el patrón de `PostTocActive.client.tsx`.
- **AC-2.3** — Given `prefers-reduced-motion: reduce`, Then el scroll es instantáneo y el hero no anima.

### US-3 — Planes sin precios, con cupos

- **AC-3.1** — Given la tabla de Viajeros, Then muestra columnas Gratis / Plus / VIP con los cupos del
  brochure (favoritos 5/25/∞, colecciones –/10/25, comparar –/3/5, alertas –/5/∞, IA 10/50/200, etc.)
  y SIN montos en pesos.
- **AC-3.2** — Given la tabla de Anfitriones, Then muestra Básico / Pro / Premium con sus cupos
  (publicaciones 1/3/10, fotos 15/30/50, IA importar 10/50/250, mejorar 50/250/1.250, traducir
  200/1.000/5.000, chat huéspedes 50/250/1.250, etc.) SIN precios.
- **AC-3.3** — Given una tabla en viewport angosto (mobile), Then la tabla scrollea horizontalmente
  dentro de su contenedor (`overflow-x: auto`) sin romper el ancho de la página.
- **AC-3.4** — Given el plan del medio (Plus / Pro), Then lleva un marcador "popular".

### US-4 — Sección "Próximamente" honesta

- **AC-4.1** — Given la sección Próximamente, Then lista los 8 items (tarjeta turista, alojamientos
  multi-propiedad, perfil público del anfitrión, responder reseñas, calendario + sync, WhatsApp en la
  ficha, fotos en reseñas, asistente IA de soporte) con un badge "Pronto" y estilo diferenciado
  (borde punteado).
- **AC-4.2** — Los items NO se presentan como disponibles hoy (nada de CTA de compra/uso sobre ellos).

### US-5 — SEO correcto

- **AC-5.1** — Given la página, Then el layout emite `SEOHead` con title/description del namespace y
  canonical `/es/funcionalidades/`.
- **AC-5.2** — Then incluye JSON-LD `CollectionPage` + `ItemList` (audiencias/pilares como items) +
  `BreadcrumbList` en `slot="head-extra"`.
- **AC-5.3** — Indexable por defecto (`noindex` NO seteado). [Decisión reversible — ver Open Questions.]

## 3. Technical Approach

### Ruta y rendering

- Página: `apps/web/src/pages/[lang]/funcionalidades/index.astro`.
- **SSR** (sin `export const prerender`), consistente con `nosotros`/`beneficios` (la app es
  `output: 'server'`; la tabla "SSG" de `apps/web/CLAUDE.md` está desactualizada). Cacheable por
  Cloudflare como el resto.
- Locale: `const locale = Astro.locals.locale as SupportedLocale;`.
- Trailing slash + `buildUrl()` para cualquier link interno (CTA a la home/pricing si aplica).

### Layout

- Usar `MarketingLayout.astro` (full-width, sin container) — el mismo de `beneficios` y
  `suscriptores/*`. Props: `locale`, `title`, `description`, `canonicalPath`. JSON-LD via
  `slot="head-extra"`.

### Estructura (monolítica, por decisión del owner)

- Una sola página `.astro` con las secciones inline y un bloque `<style>` scoped (o
  `funcionalidades.css` colocalizado e importado). Portar el CSS del brochure reemplazando **todos**
  los valores por tokens (ver mapeo abajo).
- Datos estructurados (filas de tablas, items, mapeo de íconos, keys i18n) en un módulo
  `apps/web/src/lib/features-content.ts` (named export, RO-RO) para mantener el `.astro` legible.
  El copy real NO va acá — va en `features.json`; este módulo solo referencia keys + íconos + cupos.
- Subnav con scroll-spy: island mínimo `apps/web/src/components/features/FeaturesSubnav.client.tsx`
  (`client:idle`) que reusa el patrón de `PostTocActive.client.tsx` (IntersectionObserver que togglea
  `data-active` sobre los anchors estáticos). El markup del subnav es estático en el `.astro`.

### Mapeo de tokens (brochure → global.css)

| Brochure | Token del sitio |
|---|---|
| río azul (`--river`) | `--brand-primary` / `--hospeda-river` |
| sol naranja (`--sun`) | `--brand-accent` |
| bosque verde (`--forest`) | `--hospeda-forest` |
| cielo (`--sky`) | `--hospeda-sky` |
| arena / banda cálida | `--surface-warm` / `--hospeda-sand` |
| ink / muted / card / bg | `--core-foreground` / `--core-muted-foreground` / `--core-card` / `--core-background` |
| radios | `--radius-card` / `--radius-md` / `--radius-pill` |
| fuentes | `--font-heading` (Geologica) / `--font-sans` (Roboto) / `--font-decorative` (Caveat) |
| badge "Pronto" (gold) | derivar de `--warning` o `--rating-star` vía `color-mix` |

- **NO** embeber fuentes (ya están globales). **NO** usar `--radius-organic*` (deprecado). Dark mode
  sale gratis usando tokens; verificar contraste del hero y de los badges en ambos temas.
- Hero: rehacer los "blobs" animados con CSS (radiales + `@keyframes` lentos) usando los tokens de
  color, con `@media (prefers-reduced-motion: reduce)` que desactiva la animación.

### Íconos (`@repo/icons`, NO svg inline)

Mapeo verificado contra el barrel: `SearchIcon`, `HomeIcon`, `ForkKnifeIcon` (gastronomía),
`ShieldIcon` (verificación), `UserIcon`, `CalendarIcon`, `ChatIcon`, `SparkleIcon`/`AskToAiIcon` (IA),
`CreditCardIcon` (tarjeta turista), `BuildingsIcon` (multi-propiedad), `WhatsappIcon`, `CheckIcon`
(ticks de las listas), `ArrowRightIcon` (CTA), `GlobeIcon`/`LanguageIcon` (idiomas), `CloudSunIcon`
(clima), `TagIcon`/`PriceIcon`, `MailIcon` (newsletter), `ListIcon`, `BriefcaseIcon` (proveedores).
**Ojo**: no existe `CameraIcon` → usar `GalleryIcon`/`ImageIcon` para "fotos en reseñas".

### i18n (namespace nuevo `features`, solo `es`)

1. Crear `packages/i18n/src/locales/es/features.json` con TODO el copy del brochure (hero, secciones,
   filas de tablas, próximamente, CTA, footer). Crear `en/features.json` y `pt/features.json` como
   copias del `es` (fallback hasta traducir).
2. Registrar en `packages/i18n/src/config.shared.ts`: agregar `'features'` a `webNamespaces`, los 3
   imports (`featuresEs/En/Pt`) y los 3 spreads en `trans`.
3. Correr `pnpm gen:i18n-types` (tipos de `t()`) y `pnpm check-locales` (paridad es/en/pt).

- Acceso: `const { t } = createTranslations(locale)`; en el island, `locale` como prop.

### SEO / JSON-LD

- `MarketingLayout` ya emite `SEOHead`. Pasar en `head-extra`: `CollectionPageJsonLd`
  (name/description/url), `ItemListJsonLd` (los 4 mundos + "Próximamente" como items) y
  `BreadcrumbJsonLd` (Inicio → Funcionalidades).

### Navegación

- **Ninguna** entrada en `Header.astro` ni en el footer (decisión del owner: link compartido a mano).
  Cero cambios en `nav.json` / `Header.astro` / `Footer.astro`.

## 4. Testing Strategy (no tests = not done)

- **Página (`apps/web/test/pages/funcionalidades/index.test.ts`)** — patrón source-string
  (`readFileSync` + `toContain`/`toMatch`): (a) usa `MarketingLayout`, (b) no setea `prerender = true`,
  (c) usa `var(--` y NO contiene colores hardcodeados (`#`, `rgb(`, `oklch(` con literal), (d) usa
  `createTranslations`/`t('features.`, (e) importa íconos de `@repo/icons` y NO tiene `<svg` inline,
  (f) renderiza las 10 secciones (chequear anchors/ids), (g) incluye los 3 JSON-LD, (h) el hero
  respeta `prefers-reduced-motion`.
- **Content module (`features-content.ts`)** — unit test: estructura de las tablas (cantidad de filas,
  cupos correctos por plan, 8 items de próximamente, todas las keys i18n referenciadas existen).
- **Island (`FeaturesSubnav`)** — `@testing-library/react`: togglea `data-active` según sección; SSR-safe.
- **i18n** — `pnpm check-locales` verde (paridad de keys es/en/pt del namespace `features`).
- **A11y** — la página entra en el sweep axe existente sin nuevas violaciones (contraste de badges/hero
  en ambos temas, focus visible en subnav, tablas con scroll accesible).

## 5. Out of Scope

- No tocar billing ni conectar a la API de planes (contenido estático de marketing, precedente
  `pricing-fallbacks.ts`).
- No portar la búsqueda/filtro del artifact (es folleto de lectura).
- No traducir a `en`/`pt` (solo `es`; los otros caen por fallback).
- No agregar la página a la navegación (header/footer) ni a la home.
- No implementar las features de "Próximamente" (cada una tiene su propia spec: HOS-5, HOS-6, HOS-19,
  HOS-21, HOS-22, HOS-42, etc.).

## 6. Risks

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fidelidad de íconos (no hay `CameraIcon`, restaurant es marker) | Bajo | Mapeo ya resuelto (GalleryIcon, ForkKnifeIcon); revisar visualmente. |
| Contraste del hero/badges en dark mode al mapear a tokens | Medio | Verificar ambos temas; ajustar con `color-mix` si algún token no da contraste. |
| Copy grande → muchas keys i18n | Medio | Un único namespace `features`; `check-locales` como red de seguridad. |
| El `<style>` scoped monolítico crece mucho | Bajo | Aceptable (página única de marketing); portar 1:1 del brochure con tokens. |
| Volumen de copy hardcodeado tentador | Medio | Test que falla si el `.astro` tiene literales de copy fuera de `t()`. |

## 7. Tasks (sugeridas, por fase)

- **setup**: (T) archivar el brochure de referencia en la carpeta de la spec / `apps/web/docs`;
  (T) crear namespace `features` en i18n (json es/en/pt + config.shared.ts + gen types + check-locales).
- **core**: (T) `features-content.ts` (estructura tablas/items/íconos/keys, sin precios);
  (T) página `index.astro` con las 10 secciones + estilos scoped portados a tokens;
  (T) hero con blobs CSS + reduced-motion; (T) tablas responsive con `overflow-x`.
- **integration**: (T) subnav island scroll-spy (patrón PostTocActive); (T) JSON-LD (CollectionPage +
  ItemList + Breadcrumb) en head-extra; (T) wiring de `MarketingLayout` + SEOHead.
- **testing**: (T) test de página (source assertions); (T) test de `features-content.ts`; (T) test del
  island; (T) verificar check-locales + sweep a11y.
- **docs**: (T) nota en `apps/web/docs` sobre la página y su naturaleza "no enlazada / share manual".
- **cleanup**: (T) typecheck + lint + test verdes; revisión visual en ambos temas.

## 8. Open Questions

- **OQ-1 (indexabilidad)**: la página no está enlazada pero se comparte a mano. Default propuesto:
  **indexable** (sin `noindex`). Si el owner prefiere mantenerla fuera de buscadores, setear `noindex`
  en `SEOHead` (1 línea). — *Pendiente de confirmación del owner; default asumido = indexable.*

## Internal Review Notes

- **Completeness**: filas exactas de las tablas y copy viven en el brochure (fuente de verdad citada);
  el implementador no adivina. Íconos, tokens, layout, i18n y tests están con paths concretos.
- **Coherencia técnica**: SSR + `MarketingLayout` + JSON-LD triple + i18n namespace + source-string
  tests = todos patrones ya existentes en `apps/web` (verificado por exploración 2026-07-09).
- **Sin APIs externas** que verificar (contenido estático).
- **Testabilidad**: cada AC mapea a un test source-string, unit o testing-library concreto.
- Verificado contra código (2026-07-09): los 8 items de "Próximamente" son features definidas sin ruta
  construida, cada una con su spec Linear; el "Directorio de proveedores" (host-trades) SÍ está
  construido y va como feature real de Anfitriones (no en Próximamente).
