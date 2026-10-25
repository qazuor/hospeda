---
title: Decisiones abiertas — HOS-1787
linear: HOS-1787
statusSource: linear
created: 2026-10-25
---

# 04 · Decisiones abiertas

Al decidirse, entra al decision log con su `DEC-FAC-NNN`; la fila queda acá, cerrada y con su puntero.

Desde la resolución de la vuelta 1, cada una se pregunta al owner como `Q-NN` en
[`11-resolucion-vuelta-1/10-decisiones-del-owner.md`](11-resolucion-vuelta-1/10-decisiones-del-owner.md).
La columna «estado» dice en qué pregunta quedó. Las de la vuelta 2 (OD-17…OD-26) se preguntan como Q-11…Q-20 en
[`13-resolucion-vuelta-2/10-decisiones-del-owner.md`](13-resolucion-vuelta-2/10-decisiones-del-owner.md).

| id | pregunta | origen | estado |
|---|---|---|---|
| OD-01 | Trato de lo externo: carpetas Cloudinary y public ids guardados, propiedad PostHog `is_gastronomy_owner`, ids de What's New y tours, cache tags, reglas de Cloudflare a mano, títulos de planes en MP | DEC-FAC-016, discovery A §5 | **cerrada** · DEC-FAC-032 (Q-05). |
| OD-02 | `venue` choca con `venueEvents`/`GastronomyVenueEvents*`, `sports_venue` y `venueName`: ¿se renombran los existentes (p. ej. `venueEvents` → `listingEvents`) o se cambia el nombre de la vertical? | discovery A §3 | **cerrada** · DEC-FAC-031 (Q-04). |
| OD-03 | ¿Entran al renombrado las categorías de contenido (`EventCategoryEnum`/`PostCategoryEnum.GASTRONOMY`, POI, tags de blog) y la prosa en español? | discovery A §2 | **cerrada** · DEC-FAC-032 (Q-05). |
| OD-04 | Billing vivo: slugs `gastronomy-*`, addons, claves `*_gastronomy_*`, ids UUIDv5 posiblemente derivados del slug. ¿Se renombran? ¿Hay suscripciones o preapprovals vivos en prod? (medir) | discovery A §5 | **cerrada** · DEC-FAC-029 (Q-02) y 028 (Q-01). Dato corregido en la vuelta 1: los ids UUIDv5 sí derivan de la vertical; se resuelve editando el catálogo en su origen. |
| OD-05 | ¿Entran `gastro` (cache tags `gastro-<slug>`/`list-gastro`, clases CSS `gastro-*`) y `restaurante` (`publicar-restaurante`, títulos de addon)? | discovery A §5, §10 | **cerrada** · DEC-FAC-032 (Q-05). |
| OD-06 | Partición del renombrado (~1.500 archivos) en PRs sin dejar `staging` roto | discovery A §10 | **cerrada** · DEC-FAC-030 (Q-03). |
| OD-07 | Choque de nombre: *facet* ya es «faceta de filtro» en el web (`FacetId`, `facet-config.ts`, `facet-slugs.ts`) | discovery B §2 | **cerrada** · DEC-FAC-031 (Q-04). |
| OD-08 | ¿El renombrado cae antes o después del corte V6 de HOS-1352? (prod en 0124, staging en 0177, hoy 0178; el corte aplasta la historia) | F-V1-001 | **cerrada** · DEC-FAC-028 (Q-01). |
| OD-09 | ¿Los rubros se guardan como columna array con CHECK o como tablas de relación? (cambia la parte de base de DEC-FAC-007) | F-V1-027 | **cerrada** · DEC-FAC-026 (Q-06). |
| OD-10 | ¿Alojamiento y experiencia entran completos al catálogo y al resolvedor, o sólo al catálogo? ¿Se levanta el ocultamiento de indicaciones de HOS-1049? | F-V1-014 | **cerrada** · DEC-FAC-033 (Q-07). |
| OD-11 | ¿Cada tipo declara qué rubros admite (no sólo cuáles preselecciona)? ¿Se avisa al dueño cuando un tercero cambia sus rubros? | F-V1-020 | **cerrada** · DEC-FAC-034 (Q-08). |
| OD-12 | ¿Qué paga y qué le puntúan a un local sólo de noche (copy de planes, dimensiones de reseña)? | F-V1-021 | **cerrada** · DEC-FAC-035 (Q-09). |
| OD-13 | Forma final de `nightInfo` y si `PUB` entra como tipo | F-V1-038 | **cerrada** · DEC-FAC-036 (Q-10). |
| OD-14 | Medir en prod y staging los datos que hoy existen de la vertical (no es decisión: es una lectura que necesita autorización) | F-V1-026 | **cerrada sin medir** · DEC-FAC-027 (el owner confirma que no hay fichas reales en prod). |
| OD-15 | `PUB` ya se agrega como tipo (DEC-FAC-036). (Pregunta original) ¿Convive con `BAR`, con etiquetas y descripciones diferenciadas (hoy el enum describe BAR como «Bar or pub» y eso cambia; en inglés «Pub» y «Bar» se pisan, y el dueño tiene que saber cuál elegir), o `PUB` **reemplaza** a `BAR` (y entonces `BAR` se migra y se sale del enum)? Afecta el enum, las etiquetas es/en/pt, la matriz de DEC-FAC-034, el JSON-LD y los filtros de tipo | Q-10, 2026-10-25 | **cerrada** · DEC-FAC-038 (coexisten). |
| OD-16 | Paginación unificada. Hecho: alojamientos tiene `alojamientos/page/[page].astro` (más tipo, comodidades y características) que redirige la página 1 con 301 y hace `Astro.rewrite` a `?page=N`, con canónica `/page/N/`. Gastronomía **y** experiencias no tienen ruta `page/[page].astro`, pero su canónica apunta a `/page/N/` (404) mientras los enlaces de `<Pagination searchParams=…>` usan `?page=N`. El owner quiere **el mismo código para todas las verticales**. (Pregunta original) ¿Se crea `page/[page].astro` en las dos que no lo tienen (patrón de alojamientos), o las tres pasan a `?page=N` con canónica coherente? (bug previo #2, ya sin issue propio) | Q-10 / bugs previos, 2026-10-25 | **cerrada** · DEC-FAC-039 (mecanismo compartido, HOS-1797 bloquea el sub-spec 6). |
| OD-17 | ¿Se edita también la 0139 (y la 0132 por coherencia)? Sus CHECK sólo aceptan `'gastronomy'` y la 0176 editada inserta `'venue'`: `db:migrate` desde cero corta (CI, plantilla, reset de staging, prod en el paso 3 del corte) | F-V2-001 (CRÍTICA) | **cerrada** · DEC-FAC-060 (Q-11). |
| OD-18 | ¿Qué es la marcha atrás, si la «inversa ensayada» de DEC-FAC-030 no se puede escribir con el catálogo nacido `venue`? | F-V2-020 | **cerrada** · DEC-FAC-061 (Q-12). |
| OD-19 | ¿Dónde vive el enlace gratis a la carta (`menuUrl`)? ¿Un boliche puede publicar un enlace de carta? | F-V2-009 | **cerrada** · DEC-FAC-062 (Q-13), opción 3, no la recomendada. |
| OD-20 | ¿El dueño puede ver, borrar y exportar el contenido de una sección `absent`? | F-V2-042 | **cerrada** · DEC-FAC-063 (Q-14). |
| OD-21 | ¿Entra al MVP el aviso previo de qué deja de verse al bajar de plan? | F-V2-031 | **cerrada** · DEC-FAC-064 (Q-15). |
| OD-22 | ¿El formulario de reseña de venue empieza a pedir dimensiones? | F-V2-024 | **cerrada** · DEC-FAC-065 (Q-16), opción 2, no la recomendada. |
| OD-23 | ¿Cómo se resuelven las comodidades y características de cocina para la noche? | F-V2-027 | **cerrada** · DEC-FAC-066 (Q-17). |
| OD-24 | ¿La frontera entre `PUB` y `CERVECERIA` es «produce o no produce su cerveza»? | F-V2-028 | **cerrada** · DEC-FAC-067 (Q-18). |
| OD-25 | Textos es/en/pt de la vertical, rubros, colecciones, dress code y texto legal; tile «Gastronomía» de la home | F-V2-030 | **cerrada** · DEC-FAC-068 (Q-19). |
| OD-26 | ¿Se reescribe el copy del embudo (presentación, venta, precios, correos de prueba, ícono) para la noche en este programa? | F-V2-016 | **cerrada** · DEC-FAC-069 (Q-20). |
