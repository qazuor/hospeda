---
name: hospeda-web
description: Reglas específicas para desarrollar y verificar `apps/web` de Hospeda con Astro, React islands, i18n, auth, SEO y estilos.
triggers:
  - apps/web
  - Astro
  - React island
  - SEO
  - i18n web
  - páginas públicas
  - frontend Hospeda
---

# Hospeda Web

Usá este skill cuando el cambio toque `apps/web`, páginas Astro, islands React,
SEO, navegación pública, estilos, i18n, auth web o pruebas de frontend.

## Fuente de verdad

- Reglas detalladas durante la transición: `apps/web/CLAUDE.md`.
- Rutas y layouts: `apps/web/src/pages/` y `apps/web/src/layouts/`.
- Islands y componentes: `apps/web/src/components/`.
- Integración API: `apps/web/src/lib/`.
- Traducciones: `packages/i18n/`.
- Tokens y estilos: `packages/design-tokens/`, `packages/tailwind-config/` y
  los estilos locales de la app.

Antes de copiar una regla del documento legacy, confirmá que todavía coincide
con el código y con los tokens actuales.

## Astro e islands

- Mantené la separación entre render server de Astro e interactividad React.
- No conviertas una página completa en island para resolver una interacción
  local.
- Elegí la directiva de hidratación más pequeña que satisfaga el caso.
- Evitá acceder a `window`, `document` o storage durante SSR.
- Conservá los tipos de `App.Locals` y los contratos de datos de la ruta.
- Respetá los orígenes de cada archivo indicado en la sección de procedencia de
  `apps/web/CLAUDE.md`.
- El HTML SSR debe contener los datos críticos antes de hidratar; no uses
  placeholders como fuente inicial de precios, conteos, ratings o badges.
- `client:only` sólo corresponde a contenido no indexable o cuando el contenido
  indexable ya existe en markup Astro hermano.

## UI, estilos y accesibilidad

- Reutilizá componentes y tokens existentes antes de crear variantes nuevas.
- No introduzcas colores, tipografías o espaciados fuera del sistema sin una
  decisión explícita.
- Los estados de carga, error, vacío, foco y teclado forman parte del diseño.
- Los botones sólo con icono requieren nombre accesible.
- No uses `max-height` local en diálogos si el patrón compartido ya controla su
  tamaño.
- Probá dark mode y viewport móvil cuando el cambio sea visual.

## i18n y contenido

- Todo texto visible nuevo debe pasar por el sistema de traducciones.
- Generá y validá los tipos de traducción después de agregar o cambiar claves.
- Conservá pluralización, interpolación y formato de fechas/números del paquete
  `@repo/i18n`.
- No uses claves de otro locale como fallback silencioso en una ruta pública.

## Auth, SEO y datos

- Las rutas protegidas deben seguir middleware y constantes existentes.
- No filtres datos privados en páginas públicas ni en JSON-LD.
- Usá `SEOHead` y los helpers existentes para title, canonical, Open Graph y
  JSON-LD.
- Verificá que metadata y contenido renderizado coincidan con el locale y la
  ruta real.
- Las facetas en URL deben canonicalizar orden, límites y combinación OR/AND;
  los helpers de canonical/noindex son la fuente de esa decisión.

## Variables públicas

- Las variables `HOSPEDA_*` nunca llegan al browser. En Astro usá el acceso
  tipado de `src/lib/env.ts`, no `import.meta.env` directo.
- `PUBLIC_*` es explícitamente público; revisá el registry y los build args
  antes de agregar una variable nueva.

## Testing y verificación

- Ejecutá tests de la app y validación de tipos relevantes; `.astro` también se
  typecheckea en CI.
- Para cambios acotados preferí `qz-verify --changed`.
- En cambios visuales verificá al menos desktop, móvil, dark mode y teclado.
- Diferenciá errores de navegador, SSR, hidratación y API al reportar resultados.

## Checklist

- [ ] La solución conserva SSR/islands y no hidrata de más.
- [ ] No hay acceso browser-only durante SSR.
- [ ] Textos y formatos pasan por i18n.
- [ ] Tokens, responsive, dark mode y foco son consistentes.
- [ ] SEO y auth respetan los helpers existentes.
- [ ] Tests, typecheck y verificación visual relevantes pasaron.
- [ ] No se expusieron datos privados ni secretos.
