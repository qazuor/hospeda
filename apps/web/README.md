# 🌐 Estructura y Renderizado del Portal Público `hosped.ar`

Este documento describe la estrategia de renderizado, cacheo y actualización de contenido del sitio público del portal turístico `hosped.ar`, así como la estructura de componentes para mantener un código modular, limpio y escalable.

---

## 🚀 Estrategia de Renderizado, Cache y Rebuild

Cada ruta del sitio utiliza una estrategia de renderizado adaptada a su función y frecuencia de cambio de datos. Las páginas que muestran contenido dinámico pero importante para el SEO usan `SSG con rebuild`, mientras que otras utilizan `SSR`, `Prerendering` o `CSR` según necesidad.

| **Columna** | **Descripción** |
|-------------|-----------------|
| **Ruta** | URL o patrón de ruta |
| **Tipo de Render** | Estrategia de renderizado en Astro: prerender, SSR, CSR, etc. |
| **Data visible** | Información que se ve directamente en la página o cards |
| **Rehidratación** | Elementos interactivos que se activan en el navegador (Islas React) |
| **Cache** | Tipo de caché según estrategia |
| **Rebuild (medio y frecuencia)** | Cuándo y cómo se actualiza la página en producción |

---

### 📋 Tabla de rutas

| Ruta                     | Tipo de Render               | Data visible                                                                                   | Rehidratación                                                                 | Cache                                      | Rebuild (medio y frecuencia)                                     |
|--------------------------|------------------------------|------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|---------------------------------------------|------------------------------------------------------------------|
| /                        | Prerender + Islas React      | Destinos (nombre, imagen, resumen), Alojamientos destacados (nombre, imagen, tipo, destino...) | Buscador, carruseles, newsletter                                              | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /destinos                | Prerender                    | Listado de destinos: nombre, imagen, resumen corto, puntaje si aplica                         | Filtros (región, categoría) si se aplican                                     | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /destinos/[slug]         | SSG con rebuild cada 12h     | Nombre, descripción, galería, mapa, alojamientos, eventos, posts relacionados                 | Mapa interactivo, favoritos si el user está logueado                         | Cache con rebuild programado                | Cada 12h vía cron job en backend (forzable desde admin panel)   |
| /destinos/[slug]/[tab]   | SSR                          | Contenido del tab (alojamientos, eventos, etc.)                                               | Filtros en cada tab si aplica                                                | Cache corto (CDN/stale-while-revalidate)    | No requiere rebuild, renderiza en runtime                       |
| /alojamientos            | CSR con React (client:only)  | Grid de alojamientos: imagen, nombre, destino, precio desde                                  | Toda la página es CSR                                                        | No aplica (fetch en cliente)                | No aplica                                                     |
| /alojamientos/[slug]     | SSR                          | Nombre, galería, descripción, servicios, reviews, contacto                                    | Mapa, botón de contacto, favoritos                                           | Cache corto (CDN/stale-while-revalidate)    | No requiere rebuild, renderiza en runtime                       |
| /buscar                  | SSR                          | Resultados de búsqueda según filtros                                                          | Filtros dinámicos, favoritos                                                 | Cache corto (CDN/stale-while-revalidate)    | No requiere rebuild, renderiza en runtime                       |
| /eventos                 | Prerender                    | Listado: imagen, nombre, fecha, destino                                                       | Filtros si se aplican                                                        | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /eventos/[slug]          | SSR                          | Nombre, fecha, descripción, ubicación, mapa                                                   | Mapa interactivo, favoritos                                                  | Cache corto (CDN/stale-while-revalidate)    | No requiere rebuild, renderiza en runtime                       |
| /blog                    | Prerender                    | Listado de posts con imagen, título, resumen                                                  | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /blog/[slug]             | Prerender                    | Contenido completo del post, relacionados                                                     | Botones compartir, comentarios si se agregan                                | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /beneficios              | Prerender                    | Descripción general + CTAs a beneficios específicos                                           | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /beneficios/anfitriones  | Prerender                    | Texto informativo, beneficios, CTAs                                                           | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /beneficios/viajeros     | Prerender                    | Texto informativo, descuentos, promos                                                         | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /beneficios/empresas     | Prerender                    | Texto informativo, programa de alianzas                                                       | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /quienes-somos           | Prerender                    | Historia, equipo, misión                                                                      | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /terminos                | Prerender                    | Texto legal                                                                                    | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /privacidad              | Prerender                    | Texto legal                                                                                    | Ninguna                                                                      | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |
| /contacto                | Prerender + Isla React       | Formulario de contacto (nombre, email, mensaje)                                               | Validación, envío del formulario                                             | Cache permanente (build time)               | Solo en build; manual o al hacer deploy                         |

---

## 🧱 Estructura de Componentes `/src/components`

Para mantener un código limpio y modular, se propone organizar los componentes por dominio semántico y función.

```plaintext
/src/components
│
├── common/                  # Componentes UI genéricos reutilizables
│   ├── Button.astro
│   ├── Card.astro
│   ├── Icon.astro
│   ├── Heading.astro
│   └── Badge.astro
│
├── layout/                  # Header, footer, layouts de página
│   ├── Header.astro
│   ├── Footer.astro
│   ├── MainLayout.astro
│   └── PageContainer.astro
│
├── hero/
│   └── HeroSearch.astro
│
├── destinos/
│   ├── DestinoCard.astro
│   ├── DestinoGallery.astro
│   ├── DestinoMap.client.tsx
│   ├── DestinoTabs.astro
│   └── DestinoRating.astro
│
├── alojamientos/
│   ├── AlojamientoCard.astro
│   ├── AlojamientoGallery.astro
│   ├── AlojamientoMap.client.tsx
│   ├── AlojamientoRating.astro
│   ├── AlojamientoFaq.astro
│   └── AlojamientoContactForm.client.tsx
│
├── eventos/
│   ├── EventoCard.astro
│   └── EventoDetalle.astro
│
├── blog/
│   ├── PostCard.astro
│   └── PostContent.astro
│
├── beneficios/
│   └── BeneficioSection.astro
│
├── contacto/
│   └── ContactForm.client.tsx
│
├── newsletter/
│   └── NewsletterForm.client.tsx
│
├── search/
│   └── SearchResults.client.tsx
│
├── sections/                # Secciones completas por página
│   ├── DestinosDestacados.astro
│   ├── AlojamientosDestacados.astro
│   ├── EventosProximos.astro
│   ├── UltimosPosts.astro
│   └── CallToActions.astro
│
├── shared/                  # Islas React compartidas
│   ├── FavoriteButton.client.tsx
│   └── RatingStars.astro
│
└── ui/                      # Controles UI puros
    ├── Carousel.client.tsx
    ├── Modal.client.tsx
    ├── Tabs.astro
    ├── Accordion.astro
    └── Tooltip.astro
```

---

## ✅ Próximos pasos sugeridos

- [ ] Generar los `index.ts` para cada carpeta para facilitar imports
- [ ] Implementar cron job de rebuild para rutas SSG
- [ ] Agregar botón en el panel admin para forzar regeneración
- [ ] Crear utilidades de fetch para cada tipo de entidad (destinos, alojamientos, etc.)

---

¿Tenés dudas? Contactá a Leo en `/contacto` 😄
