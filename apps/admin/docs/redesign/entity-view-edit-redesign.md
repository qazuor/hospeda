# Rediseño de páginas View / Edit del Admin — Definiciones

> **Estado:** En discusión · documento vivo (se actualiza a medida que iteramos el mockup).
> **Branch:** `feat/admin-entity-view-edit-redesign`
> **Entidad piloto:** Accommodation (alojamiento). Las definiciones se generalizan luego al resto de las entidades.
> **Última actualización:** 2026-05-27

---

## 1. Contexto y objetivo

Las páginas de **detalle (view)** y **edición (edit)** de las entidades del admin son poco amigables: confusas, desorganizadas, todo mezclado. El objetivo es rediseñar la **UI/UX** de view y edit (empezando por accommodation) priorizando jerarquía, claridad y consistencia, sin romper la naturaleza config-driven del admin.

El admin es config-driven (post SPEC-154): toda la estructura de view/edit sale de configuración tipada por entidad. El rediseño se apoya en eso.

---

## 2. Diagnóstico (problemas actuales)

### View

- Secciones sin datos ocupan una pantalla completa con "No hay datos para mostrar".
- Ruido meta: cada campo muestra label + descripción-del-label + valor; la descripción compite con el dato real.
- Dos columnas mal balanceadas (huecos grandes).
- Arranca con texto plano, sin identidad visual (la foto aparece recién al fondo).
- Iconos sueltos sin significado claro.

### Edit (peor)

- **Tres navegaciones compitiendo a la vez**: tabs superiores + breadcrumb de secciones + sidebar de secciones.
- **Gamificación ansiosa**: "Progreso del formulario 18%", "0/6 secciones completas", barras por sección. Estás editando algo que ya existe; el % de relleno angustia y no aporta.
- **Premium mezclado con lo editable**: cajas "X - Premium" intercaladas entre los campos reales.
- **Scroll infinito**: todo el form en una sola tira vertical.
- **Galería duplicada**: vive dentro de "General" y además como tab aparte.

### Causas raíz

- **A. Falta de jerarquía y filtrado.** Todo pesa igual: lo vacío como lo lleno, la meta-descripción como el dato, lo premium como lo editable.
- **B. Arquitectura de información sin resolver.** Tres sistemas de organización peleándose; nunca se decidió uno.

---

## 3. Principios del rediseño

1. **View y Edit son problemas distintos** aunque compartan ADN: view = leer rápido (jerarquía, escaneo); edit = modificar sin perderse (foco, validación). Comparten arquitectura, no inventario.
2. **Una sola navegación.** Matar las tres que compiten.
3. **Jerarquía y filtrado.** Lo importante arriba; lo vacío/secundario, mínimo.
4. **Señal sí, ruido no.** Se elimina el ruido estático; se suma señal dinámica útil.
5. **Una sola fuente de verdad.** Las validaciones/constraints salen del schema Zod, no se hardcodean.
6. **Desktop y mobile de verdad.** El host edita desde el celular; mobile no es "que no se rompa".

---

## 4. Decisiones tomadas

### 4.1 Navegación / Arquitectura de información

- **Acordeón único, sin tabs.** Todo el contenido se reorganiza como secciones de un solo acordeón. Mismo modelo en view y edit, idéntico en desktop y mobile.
  - Descartado **wizard**: malo para editar algo puntual (secuencial).
  - Descartado **master-detail** (estilo Airbnb): en mobile obliga a drill-down de dos niveles = doble layout a mantener.
- **Resumen en la sección colapsada.** Cada sección, cerrada, muestra un resumen de su valor.
  Ej: `Datos principales → Hotel Plaza · Hotel · Gualeguaychú` · `Galería → 8 fotos` · `Contacto → sin datos`.
  (Idea tomada de Airbnb #15: da el "estado de todo de un vistazo" sin pagar el master-detail.)
- **Lo vacío/secundario colapsa a una línea** (cura las "pantallas de No hay datos"). Sub-acordeones para lo secundario (estilo MercadoLibre #14).

### 4.2 Anatomía de una sección

- **Ruido meta:**
  - **View:** solo **label + valor**. Se elimina la descripción-del-label estática.
  - **Edit:** la guía va a un **ícono de ayuda (?)** o a un texto chico/apagado, **solo cuando haga falta**.
  - Criterio: el ruido estático se mata; la señal dinámica se suma.
- **Layout de campos:** **label arriba del input** + **grilla automática de 2 columnas**.
  - El **span sale del TIPO de campo** (no se micro-configura por campo): textarea / descripción / galería → ancho completo; campos normales → 1 celda del grid.
  - **Mobile → 1 columna** (todo apilado).
  - Mismo esquema en view y edit.
  - Descartado **label-al-lado** (estilo #1/#10): condena a 1 columna, desperdicia ancho en campos cortos, alarga el form, y los labels en español tienen largo desigual.
- **Metadata dinámica por campo** (solo donde aporta):
  - Texto largo → `245 / 300 caracteres`
  - Galería → `8 fotos` · `falta texto alternativo en 2`
  - Imagen principal → `cargada` / `falta`
  - Listas / multiselect → `6 servicios activos`
  - Fechas → absoluta + relativa (`26/05/2026 · hace 1 día`)
  - Campos opcionales vacíos → `— sin completar`
  - Reseñas / rating → `4,24 · 7 reseñas`
  - **Contador inline** en la esquina del campo, estilo #4. **Solo el contador**, **sin floating label** (costo de accesibilidad).
  - Regla: metadata = señal accionable o informativa, **nunca decorado**. En nombre/tipo no se mete.
- **Prefijos / sufijos no editables** (affix), estilo #7: `$ monto`, `https:// web`, `+54 whatsapp`, `superficie m²`. Modelado como propiedad `prefix` / `suffix` del field.
- **Semáforo de calidad:**
  - La metadata por campo es **neutral** (no se pinta por campo → evita el "arcoíris de ansiedad").
  - Todas las micro-señales alimentan **un único score de calidad GLOBAL** de la entidad (estilo MercadoLibre "Calidad 80"), que **reemplaza el "% de progreso" ansioso**.
- **Constraints desde el schema (SSOT):** los límites (max/min de longitud, min/max numérico, required) salen del **schema Zod** (`@repo/schemas`), no hardcodeados.
  - **Limitación:** solo se extraen constraints simples (`.max`/`.min`/`.maxLength`...). `refine`/regex/`superRefine` no dan un número mostrable → ahí no hay metadata.
  - **Costo técnico:** hoy config y schema están **desconectados** (la config declara campos a mano). Hay que cablear que `FieldConfig` sepa de qué campo del schema sacar el constraint. Trabajo arquitectónico real del rediseño.

### 4.3 Header de la página

Modelo **híbrido thumbnail** (ni hero a pantalla completa ni solo texto):

```
+----------------------------------------------------------------+
| [img]  Hotel Plaza                      Calidad      [ Volver ] |
|        Hotel · Gualeguaychu              [####__ 80]  [ Editar ] |
|        * Publicado  * Activo  * Aprobado                        |
+----------------------------------------------------------------+
```

- **Izquierda:** thumbnail chico + nombre + subtítulo (tipo · destino) + badges de estado.
- **Derecha:** el **score de calidad** (vive acá, siempre visible) + las acciones.
- **Acciones por modo:** View → `Volver` + `Editar`. Edit → `Cancelar` + `Guardar` (con indicador "sin guardar / guardando").
- **Score:** protagonista en edit (guía mientras se carga), presente pero sobrio en view.
- **Sticky con versión reducida:** al scrollear se reduce (thumbnail se achica o desaparece; quedan nombre + score + acciones) y queda pegado arriba. Así `Guardar` y el score están siempre a mano en un acordeón largo. En mobile, la versión reducida es de una sola línea.

### 4.4 Orden de secciones por ROL

El orden **depende del rol** (no es una lista única). La sección de moderación se ancla arriba para staff y no existe para el host.

```
EDIT · host                 EDIT · staff
1 Datos principales         1 Estados y moderacion   <- anclada arriba
2 Galeria                   2 Datos principales
3 Precios                   3 Galeria
4 Ubicacion y contacto      4 Precios
5 Servicios                 5 Ubicacion y contacto
                            6 Servicios

VIEW · host                 VIEW · staff
1 Datos principales         1 Estados y moderacion   <- anclada arriba
2 Galeria                   2 Datos principales
3 Precios                   3 Galeria
4 Ubicacion y contacto      4 Precios
5 Servicios                 5 Ubicacion y contacto
6 Bloque informativo        6 Servicios
  (resenias/rating/metricas)7 Bloque informativo
```

- **Requisito de config:** orden/prioridad por rol (no array fijo). La sección de moderación se "ancla arriba" para staff.
- Razón: el staff que entra a un alojamiento viene a **moderar**; ponerle lo suyo arriba respeta su caso de uso real. Como es acordeón colapsado, esa sección arriba es apenas una fila.

### 4.5 Inventarios View vs Edit

- **Edit** incluye solo lo **editable**: Datos principales, Galería, Precios, Ubicación y contacto, Servicios, (Estados y moderación · staff).
- **View** incluye **todo lo editable en read-only** + un **bloque informativo al final**: **reseñas, rating, métricas**.
- La config ya separa `viewSections` de `editSections`, así que es soportable.

### Detalles de secciones acordados

- **Ubicación y contacto** (fusionadas en una sección) → dos sub-bloques internos: *"Dónde está"* y *"Cómo contactar"*.
- **Servicios y comodidades** → contiene **dos** sub-bloques internos: **Amenidades** y **Características**. Son **catálogos distintos en DB** (tablas/relaciones separadas). En el alojamiento se **seleccionan de una lista** (multiselect desde catálogo), no se escriben a mano. Reemplaza los viejos tabs duplicados de Amenidades.
- **Galería** → sube alto (las fotos venden un alojamiento), no al fondo.
- **Precios** → después de Galería.
- **Reseñas** → solo view (nadie las edita); el host las ve en el bloque informativo.

### 4.6 Campos especiales

Más allá del campo estándar (label arriba + input), hay tipos especiales con comportamiento propio:

- **Descripción (rich text):** editor **TipTap** con toolbar (negrita, itálica, encabezados, listas, cita, link). **Se persiste en Markdown.** En view se muestra el contenido renderizado.
- **Coordenadas → mapa con geocoding:** el campo abre un mapa.
  - Al cargar, **ubica el punto según la dirección** (geocoding directo dirección → coordenadas).
  - Si el usuario hace click y **aún no escribió dirección**, el mapa **centra el destino** del alojamiento.
  - Si se puede inferir la dirección desde el punto marcado (reverse geocoding), **autocompletamos la dirección** solo si estaba vacía.
  - Las coordenadas resultantes quedan visibles; en view, mapa estático + coordenadas.
- **Amenidades / Características (multiselect desde catálogo):** chips seleccionables; el catálogo sale de DB; en view, chips de los seleccionados. Cada chip ocupa el **ancho de su contenido** (no full-width) y se acomodan en fila con wrap.
- **Galería (edición):** además del listado, el modo edit tiene:
  - **Subir** (drag & drop o elegir archivos) y **borrar** por imagen.
  - **Reordenar** (drag handle).
  - **Datos por imagen**: texto alternativo (obligatorio, accesibilidad), leyenda, descripción.
  - **Imagen principal** separada de la galería.
- **Estado de error de validación:** el campo en error muestra **borde rojo + label rojo + mensaje** debajo (`⚠ ...`). El mensaje sale de la validación del schema. El mensaje **cuelga debajo del input sin descuadrar la grilla**: las celdas se alinean arriba (`align-items:start`), así el input con error queda a la misma altura que sus vecinos.

### 4.7 Entitlements / Premium / Límites

El gating tiene **tres sabores**, y hay que distinguirlos visualmente (hoy todo está mezclado e intercalado):

1. **Feature gate puntual** — una funcionalidad bloqueada (ej. redes sociales). Bloque agrupado con descripción + botón "Mejorar plan". **No** intercalado entre campos editables.
2. **Límite cuantitativo** — un tope por plan (ej. `8 / 10 fotos`, máx. alojamientos). Se muestra como aviso con barra de progreso del límite + CTA de upgrade, junto al recurso que limita.
3. **Sección/bloque completo gated** — una sección entera premium (ej. Videos y tour 360°). Para el host sin plan: la sección muestra el upsell en lugar de los campos. Para staff/admin: muestra los campos reales.

**Regla de rol (tentativa, a confirmar):** el **host** sin plan ve los gates con upsell; el **staff/admin** no tiene plan → **ve todo habilitado, sin gating**. (Pendiente confirmar comportamiento exacto para staff.)

### 4.8 Reglas de implementación (cuando se codee de verdad)

- **No inventar ni olvidar campos.** Antes de implementar, **mirar los schemas reales** (`@repo/schemas` + DB schemas en `@repo/db`), sus **relaciones** y constraints. El inventario y los tipos de cada campo salen de ahí, no de la maqueta. La maqueta usa ejemplos.
- **Validaciones desde el schema** (ver 4.2): límites, requeridos y mensajes salen del Zod schema, no hardcodeados.
- Amenidades y Características son **relaciones a catálogos** (no campos de texto); respetar esas tablas/relaciones.

### 4.9 Score de calidad

Reemplaza el "% de progreso" ansioso. Mide **qué tan competitiva está la publicación** (cuánto ayuda a vender), no "campos completados / total". Tono **positivo/motivacional**. Patrón MercadoLibre #14.

**Forma:**

- Número + barra en el **header** (siempre visible). Es **clickeable** → despliega un **popover** con el desglose.
- El popover tiene **tres grupos** claramente separados:
  1. **Cumplido** — objetivos logrados (✓).
  2. **Para mejorar** — pendientes que **suben el puntaje**, cada uno con su **acción** + **link que abre la sección** del acordeón.
  3. **Llevalo más lejos · Premium** — palancas premium que el plan del host no incluye: se muestran **disabled** con **"Mejorar plan"**, y **NO afectan el puntaje** (upsell honesto, separado para no generar disonancia con el número).

**Composición:**

- **Señales ponderadas, no uniformes**: fotos, precio y descripción pesan más (impactan conversión).
- **Config-driven por entidad**: cada entidad define su set de señales y pesos.
- **Premium no penaliza**: lo que depende de una feature fuera del plan no baja el score (pero se muestra en el grupo Premium del popover).
- **En vivo en edit**: el score sube mientras se carga; en view es el estado actual.

**Señales para accommodation (ejemplo, a validar contra schema):** imagen principal · ≥5 fotos · fotos con texto alternativo · descripción completa · resumen · ubicación marcada · ≥1 contacto · servicios cargados · precio.

**Por público:**

- **Host:** popover accionable + grupo Premium con upsell.
- **Staff/admin:** sin grupo Premium (esos campos son normales y editables); el score es informativo.

### 4.10 Create (alta de entidad)

**Create mínimo → Edit.** No se muestra el acordeón completo vacío (abruma y mezcla "lo necesario para crear" con "lo que mejora la ficha").

- **Pantalla corta** con el **mínimo indispensable**. Al crear → **redirige al Edit** del nuevo registro, donde el acordeón completo + el score de calidad guían la completitud.
- **Esto ya existe en la web**: el flujo de primera publicación del host (`apps/web` → `/publicar/nueva`) redirige a `/admin/accommodations/{id}/edit` para usuarios con panel. El create del admin **unifica** ese patrón, no lo inventa.
- **Una sola pantalla, no wizard.**

**Campos mínimos (replican el create de la web, validados por `AccommodationCreateDraftHttpSchema` en `packages/schemas/src/entities/accommodation/accommodation.http.schema.ts`):**

| Campo | Tipo | Requerido |
|-------|------|-----------|
| Nombre | texto (3-100) | sí |
| Descripción corta (summary) | textarea (10-300) | sí |
| Tipo | select (enum) | sí |
| Ciudad (destino) | select async (UUID) | sí |
| **Propietario** | select | **solo staff** |

- **Propietario**: la web no lo pide (owner = usuario actual). En el admin, **el staff crea para otro host** → debe elegir propietario. Para un host creando su propio alojamiento, el owner es él mismo (no se pide).
- **Defaults backend**: `owner` = según contexto, `lifecycleState` = DRAFT, resto de defaults del servicio.
- **Header del create**: "Nuevo alojamiento" + acciones `Cancelar` / `Crear` (sin thumbnail/badges/score — la entidad aún no existe).
- **Lenguaje visual**: el create reusa el **mismo tratamiento de card/sección** que el edit (card blanca con header de sección + separador), para que no se vea "suelto" y mantenga el ritmo del edit.

### 4.11 Generalización a otras entidades (arquetipos)

Lo **genérico aplica a todas** (acordeón, header, anatomía de sección, orden por rol, errores, affixes). Lo que cambia por entidad es el **inventario de secciones/campos** (sale del schema) y **qué módulos opcionales aplican**. No todas necesitan toda la maquinaria. Tres arquetipos:

**1. Publicables ricas** — accommodation (hecho), destinations, events, posts.

- Patrón completo: acordeón, descripción rich (TipTap), media/galería, relaciones, estados/moderación (staff), create, bloque informativo según corresponda.
- Por entidad: destinations (ubicación/mapa, atracciones, galería; bloque info = métricas, no reseñas); events (fechas inicio/fin, event-location, organizador, entradas/precios, galería); posts (cuerpo rich text grande protagonista, SEO, autor, sponsorship, imagen destacada).

**2. Persona / cuenta** — users.

- No es publicación: header con **avatar**, **sin score**. Secciones: perfil, permisos/roles (staff), actividad/auditoría, plan/billing. Mayormente staff-only. Create propio.

**3. Catálogos simples** — amenities, features, attractions, event-locations, event-organizers, sponsors.

- Pocos campos (nombre, slug, ícono, descripción, categoría, quizá imagen). Acordeón de 1-2 secciones (o una card). Sin galería/score/bloque informativo. Gestionados por staff.

**Reglas confirmadas (decisión del usuario):**

- **Score de calidad: SOLO accommodation, posts y events.** No destinations, no users, no catálogos.
- **Create mínimo→edit: SOLO accommodation.** Todas las demás (incl. destinations/events/posts, users y catálogos) usan **create entero en una sola pantalla**.
- **users: tratamiento propio** (avatar, sin score, secciones de cuenta/permisos).

> La definición detallada por entidad (secciones + campos exactos) se construye relevando los schemas reales (`@repo/schemas` + `@repo/db`) — ver §6 y secciones por entidad a completar.

### 4.12 Definición por entidad (detalle)

> Los campos exactos viven en cada schema (`packages/schemas/src/entities/<entity>/`) y en las configs admin existentes (`apps/admin/src/features/<entity>/config/sections/*.consolidated.ts`). Acá se define la **estructura de secciones**, los **módulos que aplican** y las **particularidades vs accommodation**.

#### Destination — publicable rica · **sin score**

Secciones (acordeón):

1. **Datos principales** — name, slug, destinationType, summary, description, isFeatured
2. **Ubicación y coordenadas** — country, state, city, zipCode, lat/long (**mapa**)
3. **Galería** — featuredImage + gallery
4. **Atracciones** — relación a catálogo attraction (view; link/unlink)
5. **FAQs** — editable (pregunta/respuesta/categoría)
6. **Tags**
7. **Estados y visibilidad** *(staff)* — visibility, lifecycleState
8. **Bloque informativo** *(view-only)* — alojamientos count, reviews count, rating (breakdown multi-dimensión)

Módulos: galería ✓ · mapa ✓ · rich text ✗ (summary/description son textarea hoy) · catálogo relacionado (atracciones) · FAQs.
Particularidades: **NO tiene moderationState** (solo visibility + lifecycle). Tiene jerarquía geográfica (parentDestinationId) que se resuelve en el create. Sin precios ni servicios.

#### Event — publicable rica · **con score**

Secciones (config real):

1. **Datos principales** — name, slug, summary, description, category, isFeatured, tags
2. **Fecha y precios** — date (start/end/isAllDay/recurrence) + pricing (isFree, price, currency, rangos, early-bird, descuentos por grupo)
3. **Contacto y multimedia** — contactInfo + media (featuredImage, gallery, **videos**)
4. **Ubicación y organizador** — locationId (EVENT_LOCATION_SELECT), organizerId (EVENT_ORGANIZER_SELECT), destinationId
5. **Estados y moderación** *(staff)* — visibility, lifecycleState, moderationState, adminInfo

Módulos: galería ✓ · fechas (rango + recurrencia) · pricing complejo · relaciones (location/organizer) · SEO · rich text ✗. Mapa ✗ en el event (la coord vive en event-location).

#### Post — publicable rica · **con score (completitud/SEO)**

Secciones (config real):

1. **Datos principales** — title, slug, summary, category, isFeatured, isFeaturedInWebsite, isNews
2. **Contenido** — **content = rich text grande (TipTap → markdown), protagonista** · readingTimeMinutes
3. **SEO** — seo.title, seo.description, seo.keywords
4. **Medios** — featuredImage, gallery
5. **Relaciones** — authorId (USER_SELECT, req), relatedDestination/Accommodation/Event, sponsorshipId (POST_SPONSORSHIP_SELECT)
6. **Estados y moderación** *(staff)* — visibility, lifecycleState, moderationState, publishedAt, expiresAt, adminInfo
7. **Bloque informativo** *(view-only)* — likes, comments, shares

Módulos: **rich text ✓ (el corazón)** · galería ✓ · SEO · relaciones · sponsorship. Mapa ✗. El score mide completitud + SEO.

#### User — persona/cuenta · **sin score** · header con avatar

Secciones (config real + a consolidar):

1. **Información básica** — displayName, firstName, lastName, slug, birthDate
2. **Contacto** — email, phone (view-only), website, location
3. **Avatar y perfil** — image, imageCaption, profile (bio, occupation) *(a consolidar)*
4. **Rol y permisos** *(staff)* — role, authProvider (view-only), permisos
5. **Estados** *(staff)* — visibility, lifecycleState, banned/banReason/banExpires
6. **Onboarding y servicios** *(staff)* — profileCompleted, setPasswordPrompted, serviceSuspended *(a consolidar)*
7. **Preferencias** — settings (tema, idioma, notificaciones, newsletter)
8. **Plan y facturación** *(staff, view-only)* — subscriptions, payments *(a consolidar)*

Particularidades: header con **avatar** (no thumbnail). **Sin score.** Mayoría staff-only; algunos campos los edita el propio usuario (perfil, contacto, preferencias). Create propio (no mínimo→edit).

#### Catálogos simples — sin galería/score/bloque info · create entero · staff

- **Amenity** (`/content/accommodation-amenities`): 3 secciones — Básica (name, slug, description, icon, displayWeight, **type** enum 12 valores) · Config (isFeatured, isBuiltin) · Estado (lifecycleState).
- **Feature** (`/content/accommodation-features`): igual que amenity **sin type**. 3 secciones.
- **Attraction** (`/content/destination-attractions`): 2 secciones — Básica (name, slug, description **req**, icon **req**, displayWeight, isFeatured, isBuiltin RO, destinationId opcional) · Estado.
- **Event-location**: 2 secciones — Básica (placeName, slug, destinationId) · Dirección (street, number, floor, apartment, coords). Solo lifecycle.
- **Event-organizer**: 4 secciones — Básica (name, slug, description, logo) · Contacto · Redes sociales · Estado.
- **Sponsor** (PostSponsor): 4 secciones — Básica (name, type, description, logo) · Contacto · Redes sociales · Estado (**solo lifecycle, sin visibility**).

Comunes a catálogos: `icon` = nombre de ícono (no URL) · descripción texto plano (no rich) · sin moderationState (solo lifecycleState) · `adminInfo` (notes/favorite) staff.

#### Hallazgos transversales (relevamiento)

- **Las configs consolidated YA existen** para todas: el rediseño reaprovecha el inventario, no lo inventa.
- **Rich text**: hoy NINGUNA usa editor rich real (son textarea); `post.content` es el más cercano (HTML, 100-50k). El rediseño introduce TipTap→markdown en accommodation (descripción) y post (content).
- **Mapa**: aplica a accommodation, destination, event-location (tienen coords).
- **moderationState**: lo tienen accommodation, event, post. NO destination ni catálogos.

---

## 5. Público objetivo

Dos públicos usan el edit del admin:

- **Hosts (dueños):** no técnicos, mobile real, conocen MercadoLibre. Desde la web solo hacen su **primera publicación** (básica); **toda modificación posterior vive en el admin**. Editan **su** alojamiento.
- **Staff (admins / moderadores):** power-users, desktop, gestionan todo y **moderan**.

El diseño sirve a ambos: secciones filtradas por rol, orden adaptado al rol, y el score de calidad como herramienta especialmente valiosa para el host (lo ayuda a mejorar su anuncio).

---

## 6. Pendientes (a definir)

- **Sección Galería** en detalle (imagen principal + galería ordenable + videos + tour 360): es la sección más compleja.
- **Premium / entitlement gating**: cómo se muestra lo premium (upsell para el host, comportamiento para staff). Hoy está intercalado entre campos; hay que sacarlo de ahí.
- **Create**: variante del edit (¿subconjunto de secciones?, ¿guía para campos requeridos?).
- **Score de calidad en detalle**: cómo se compone, qué muestra al abrirlo, qué micro-señales suma.
- **Estado colapsado de sección**: detalle visual del resumen, chevron, sección vacía, indicadores.
- **Generalización al resto de entidades** (destinations, events, posts, users, etc.).

---

## 7. Referencias visuales

Carpeta del usuario: `~/Desktop/hospeda screens/forms/`

- **#14 MercadoLibre (publicar inmueble)** — mismo dominio, mina de oro: cards por sección, grid denso, sub-acordeones para lo secundario, score de calidad de la publicación.
- **#15 Airbnb (editor del anuncio)** — master-detail (descartado como navegación, pero de acá sale el "resumen por sección").
- **#4 Appinio** — contador inline en la esquina del campo.
- **#7 Create project / budget** — prefijos/sufijos (affix) no editables.
- **#8 Notifications / #10 Appsflyer / #13 BLU** — colapso de secciones y densidad.
- **#1 iForm / #10 Appsflyer** — label-al-lado (evaluado y **descartado**).

---

## 8. Impacto técnico (preliminar)

Archivos que tocará el rediseño (ver relevamiento previo):

- `apps/admin/src/components/entity-pages/*` — `EntityPageBase`, `EntityViewContent`, `EntityEditContent`, `EntityCreateContent`.
- `apps/admin/src/components/entity-form/EntityViewSection.tsx` + `EntityFormSection.tsx` — renderers de sección.
- `apps/admin/src/components/entity-form/navigation/Smart*` — se reemplazan por el acordeón.
- `apps/admin/src/components/layout/PageTabs.tsx` — a eliminar (no más tabs).
- Consolidated configs por entidad (`features/<entity>/config/...`).
- **Cablear `FieldConfig` ↔ `@repo/schemas`** para los constraints (nuevo).

---

## Registro de decisiones (changelog)

- **2026-05-27** — Documento inicial. Cerrado: navegación (acordeón único), anatomía de sección, header (híbrido sticky), orden por rol, inventarios view/edit. Pendiente: galería, premium, create, score detalle.
- **2026-05-27** — 1er mockup HTML + feedback. Agregado: Servicios = Amenidades + Características (catálogos DB, multiselect); Descripción = TipTap → Markdown; Coordenadas = mapa con geocoding (directo desde dirección, fallback destino, reverse para autocompletar); Galería editable (subir/borrar/reordenar + datos por imagen); estado de error de validación; entitlements en 3 sabores (feature gate / límite / sección completa) con regla de rol; regla de implementación "mirar schemas, no inventar campos". Pendiente aún: score de calidad en detalle, Create, generalización.
- **2026-05-27** — Score de calidad definido (§4.9): popover clickeable desde el header con 3 grupos (Cumplido / Para mejorar con links a sección / Premium disabled+upsell que no afecta el puntaje); señales ponderadas config-driven; premium no penaliza; en vivo en edit. Plasmado en el mockup. Pendiente aún: Create, generalización a otras entidades.
- **2026-05-27** — Create definido (§4.10): mínimo → edit, replica el create de la web (`/publicar/nueva`, `AccommodationCreateDraftHttpSchema`); 4 campos (nombre, summary, tipo, ciudad) + propietario solo staff; una pantalla, no wizard; al crear redirige al edit (patrón que la web ya usa). Plasmado en el mockup (3er modo del toggle). Pendiente aún: generalización a otras entidades.
- **2026-05-27** — Generalización (§4.11 arquetipos + §4.12 detalle por entidad), relevando los schemas + configs consolidated reales de las 10 entidades. Decisiones: score solo accommodation/post/event; create mínimo→edit solo accommodation (resto create entero); users tratamiento propio (avatar, sin score). Hallazgo: todas las entidades ya tienen configs consolidated → el rediseño reaprovecha el inventario. **Definición de diseño COMPLETA — próximo: implementación.**
