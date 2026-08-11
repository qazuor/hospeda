---
title: Editor de alojamiento — navegación por secciones (una sección, una página)
linear: HOS-318
statusSource: linear
created: 2026-08-09
type: feature
areas:
  - web
---

# Editor de alojamiento — navegación por secciones (una sección, una página)

## 1. Summary

Partir el editor de alojamiento de `apps/web` — hoy una sola página con 13 secciones
apiladas — en **10 rutas, una por sección**. El layout de desktop no cambia de forma:
la columna de navegación de 220px que ya existe pasa de hacer scroll a anclas a
navegar a rutas reales. En mobile, donde hoy no hay navegación alguna, `/editar/`
pasa a ser un hub tipo lista de ajustes.

## 2. Problem

`AccommodationEditor.client.tsx` (783 líneas) renderiza 13 secciones apiladas en una
sola columna, **todas montadas simultáneamente**. Tres problemas concretos:

1. **En mobile no hay navegación.** `AccommodationEditor.module.css` tiene
   `.navSlot { display: none }` por defecto y sólo la muestra a partir de 1100px —
   fue una decisión explícita de BETA-138 ("stacked cards con scroll natural, sin nav
   en tablet/mobile"). En la práctica, para llegar a "Fotos" el anfitrión scrollea a
   ciegas por 12 secciones.
2. **Se monta todo de una.** Las secciones más pesadas del repo viven acá:
   `CalendarSection` (35 KB), `ExternalReputationSection` (35 KB), `FaqSection`
   (33 KB), `TranslationPanel` (26 KB), `PhotoSection` (24 KB). Un anfitrión que
   entra a cambiar el precio paga el costo de montar el calendario y el panel de
   traducciones.
3. **El scroll no termina nunca.** ~20 campos de formulario más un mapa, una galería,
   un calendario y un editor de FAQs en una sola página.

Agrava el cuadro el perfil de usuario: el anfitrión de Hospeda es mayormente una
persona mayor, poco familiarizada con la tecnología. Para ese perfil, la ambigüedad
de navegación no es una molestia, es un bloqueo.

## 3. Goals

- **G-1** — Que ninguna pantalla del editor supere ~10 campos.
- **G-2** — Que exista navegación entre secciones en mobile (hoy no existe).
- **G-3** — Que el JS montado por pantalla sea sólo el de esa sección.
- **G-4** — Que la navegación tenga **una sola regla, sin excepciones**: un item del
  nav es siempre una página.
- **G-5** — Que el shell de `/mi-cuenta` (sidebar de cuenta) **no cambie nunca** de
  forma ni de contenido al entrar o salir del editor.
- **G-6** — Que mobile y desktop expongan exactamente el mismo árbol de rutas.

## 4. Non-goals

- **NG-1** — No se rediseña `AccountLayout` ni su sidebar. No hay "modo foco".
- **NG-2** — No es un wizard/stepper. La creación ya tiene el suyo
  (`CreatePropertyMiniForm.client.tsx`); en edición el anfitrión entra a cambiar UNA
  cosa y debe llegar directo.
- **NG-3** — No se introduce autosave. El guardado sigue siendo explícito y con
  confirmación visible.
- **NG-4** — No hay cambios de backend: ni endpoints nuevos, ni schemas, ni
  migraciones.
- **NG-5** — No se replica (todavía) en `EventEditor` / `PostEditor`. Ver R-4.
- **NG-6** — HOS-218 (loop de `GET /public/features`) es un bug aparte y se arregla
  por su cuenta. Ver Implementation notes.

## 5. Current baseline

### Archivos

| Archivo | Rol |
|---|---|
| `apps/web/src/components/host/AccommodationEditor.client.tsx` | Orquestador, 783 líneas |
| `apps/web/src/components/host/AccommodationEditor.module.css` | Layout 2 columnas ≥1100px |
| `apps/web/src/components/host/editor/*` | 13 componentes de sección |
| `apps/web/src/components/host/editor/EditorSectionNav.client.tsx` | Nav sticky con scrollspy |
| `apps/web/src/pages/[lang]/mi-cuenta/propiedades/[id]/editar.astro` | Página, dentro de `AccountLayout` |

### La división que el código ya tiene

Sólo 7 de las 13 secciones participan del formulario compartido. Las otras 6 reciben
únicamente `accommodationId`, tienen su propia API y su propio guardado — **no
aparecen en `buildPatchPayload`**:

| Participan del PATCH global | Ya guardan solas |
|---|---|
| básica, capacidad, precio, ubicación, contacto, redes, servicios | FAQs, fotos, calendario, traducciones, reputación externa, destacado |

Esta spec formaliza esa división en vez de inventar una nueva.

### El endpoint ya es parcial

`accommodationEditApi.update({ id, data })` (`endpoints-protected.ts:2758`) hace
`PATCH /api/v1/protected/accommodations/:id` con un body arbitrario. Cinco páginas
distintas pueden mandar cada una sus propios campos sin ningún cambio de contrato.

Además, `AccommodationService.update` (`accommodation.service.ts:1656`) **ya trata
amenities/features como una operación aparte**: abre una transacción propia cuando
`amenityIds`/`featureIds` están presentes (SPEC-172). Separarlos en la UI alinea el
frontend con lo que el backend ya hace.

### Restricción de layout

`editar.astro` renderiza dentro de `AccountLayout.astro`, que **ya tiene un sidebar
persistente** con la nav de cuenta (`account-nav__group`, `account-nav__doors`) y, en
mobile, un toggle que muestra la sección activa. Hoy no hay conflicto porque las
secciones del editor son anclas. Al volverse rutas, dos navegaciones laterales
compiten — resuelto en D-1.

## 6. Proposed design

### Decisiones cerradas

| # | Decisión | Motivo |
|---|---|---|
| **D-1** | El layout de desktop **no cambia de forma**. El `navSlot` de 220px que ya existe sigue donde está; lo único que cambia es que sus links navegan en vez de scrollear. | Se evaluó y **descartó** un "modo foco" (retraer el sidebar de cuenta dentro del editor, à la Stripe/Notion): para un usuario mayor, que el menú se transforme según dónde esté es desorientante. La constancia vale más que la elegancia. |
| **D-2** | **Un item del nav = una página. Sin excepciones.** | Un nav donde algunos items navegan y otros hacen scroll, sin nada en pantalla que lo anuncie, es peor que la página larga de hoy. Se descarta distinguirlos con indentación o iconos: obliga a aprender una convención sutil. |
| **D-3** | "Datos" se parte en **3 páginas** (básicos / capacidad y precio / contacto y redes). | Como item único tendría ~20 campos. En mobile seguiría siendo una pantalla larguísima: habríamos movido el problema, no resuelto. |
| **D-4** | **Ubicación** es página propia. | Es un mapa: interacción de pantalla completa y componente pesado. Un mapa embebido en un scroll largo es de lo peor en mobile. |
| **D-5** | **Servicios** es página propia. | Pedido explícito del owner. Barato: mismo PATCH parcial, y el servicio ya lo trata transaccionalmente aparte. |
| **D-6** | Mobile y desktop exponen **las mismas 10 rutas**. La única diferencia es dónde vive el nav. | Si divergen, agregar una sección obliga a tocar dos árboles. |
| **D-7** | Las 10 rutas se agrupan en **3 grupos con encabezado**. | 10 items planos obligan a leer los 10 para encontrar uno. Ya hay precedente en el propio producto: `AccountLayout` usa `account-nav__group` + `account-nav__group-label`. |
| **D-8** | `/editar/` muestra **el mismo hub en ambos anchos**. No redirige a la primera sección. | Un redirect rompe el botón atrás: desde una sección, "atrás" vuelve a `/editar/`, que re-redirige, y el usuario queda trabado. Para alguien poco técnico eso es de lo más frustrante. En desktop el hub funciona además como resumen de la propiedad. |
| **D-9** | `EditorSectionNav` **pierde el scrollspy**. El item activo sale de la URL. | Hoy usa un `IntersectionObserver` con `rootMargin: '-120px 0px -60% 0px'` ajustado a mano. Con rutas, el activo es exacto en vez de aproximado — menos código y más confiable. |
| **D-10** | El toggle de destacado (`FeaturedToggleSection`) **no recibe item de nav**. Se renderiza al pie del hub. | Se autooculta (`return null`) para quien no tiene el entitlement `FEATURED_LISTING`. Un item de nav dead-endearía para la mayoría — el mismo motivo por el que hoy tampoco lo tiene (ver comentario en `AccommodationEditor.client.tsx:748`). |

### Las 10 rutas

Base: `/{lang}/mi-cuenta/propiedades/{id}/editar/`

| # | Grupo | Ruta | Campos / contenido | Guardado |
|---|---|---|---|---|
| 1 | La propiedad | `datos/` | nombre, resumen, descripción, tipo, destino | PATCH parcial (**nuevo**) |
| 2 | La propiedad | `capacidad-precio/` | huéspedes, dormitorios, baños, precio, moneda | PATCH parcial (**nuevo**) |
| 3 | La propiedad | `ubicacion/` | mapa + lat/long | PATCH parcial (**nuevo**) |
| 4 | La propiedad | `servicios/` | amenities + features | PATCH parcial (**nuevo**) |
| 5 | Contenido | `fotos/` | `PhotoSection` | ya autónoma |
| 6 | Contenido | `preguntas/` | `FaqSection` | ya autónoma |
| 7 | Contenido | `contacto/` | teléfono, whatsapp, email, web, 6 redes | PATCH parcial (**nuevo**) |
| 8 | Gestión | `calendario/` | `CalendarSection` tras `PlanEntitlementGate` | ya autónoma |
| 9 | Gestión | `traducciones/` | `TranslationPanel` (sólo si hay `translationData`) | ya autónoma |
| 10 | Gestión | `reputacion/` | `ExternalReputationSection` | ya autónoma |

**5 formularios nuevos**, todos chicos, todos contra el mismo `accommodationEditApi.update`
con distintos campos, todos con `useZodForm` instanciado sobre su porción del schema.
Es repetir 5 veces un patrón ya resuelto, no inventar nada.

### Costo asumido conscientemente

La propuesta original prometía *"no hay que tocar la lógica de guardado"*. **D-2 y D-3
la tocan**: se pasa de 1 formulario con PATCH global a 5 formularios con su propio
submit, su propio guard de cambios sin guardar y su propio manejo de errores. Es
consecuencia directa de la restricción de usuarios mayores, y fue aceptado
explícitamente por el owner.

## 7. Data model / contracts

**Sin cambios.** Ni endpoints, ni schemas, ni migraciones, ni i18n de dominio.

- `PATCH /api/v1/protected/accommodations/:id` se sigue usando tal cual, con bodies
  más chicos.
- `AccommodationEditFormSchema` (hoy en `AccommodationEditor.client.tsx`) se extrae a
  un módulo propio y cada página deriva su porción. **Ojo (HOS-425 / Zod 4)**: si el
  slicing se hace con `.pick()`/`.omit()` sobre un schema con `.refine()`, Zod 4 lo
  rechaza. Preferir declarar las porciones por composición.
- i18n: nuevas claves para los 3 encabezados de grupo y las migas de pan. Las claves
  `host.properties.editor.section.*` existentes se reusan como títulos de página.

## 8. UX / UI behavior

### Desktop (≥1100px) — el layout no cambia

```
┌──────────┬──────────────────────────────────────┐
│ Mi cuenta│  Mis propiedades › Casa del Sol › …   │
│ ─────────│                                       │
│ Panel    │  ┌────────────┬───────────────────┐   │
│ Propied. │  │ LA PROPIEDAD                   │   │
│ Favoritos│  │  Datos     │                   │   │
│ Mensajes │  │  Capacidad │   [ contenido ]   │   │
│ Ajustes  │  │  Ubicación │                   │   │
│          │  │  Servicios │                   │   │
│          │  │            │                   │   │
│          │  │ CONTENIDO  │                   │   │
│          │  │  Fotos   ● │                   │   │
│          │  │  Preguntas │                   │   │
│          │  │  Contacto  │                   │   │
│          │  │            │                   │   │
│          │  │ GESTIÓN    │                   │   │
│          │  │  Calendario│                   │   │
│          │  │  Traduccio.│                   │   │
│          │  │  Reputación│  [ Guardar ]      │   │
│          │  └────────────┴───────────────────┘   │
└──────────┴──────────────────────────────────────┘
```

El sidebar de cuenta (izquierda) queda intacto. El ancho ya está probado en
producción: hoy conviven a partir de 1100px.

### Mobile (<1100px) — hub → pantalla → volver

```
  /editar/  (hub)                  /editar/fotos/
┌─────────────────────┐          ┌─────────────────────┐
│ ← Casa del Sol      │          │ ← Casa del Sol      │
│ Publicada           │          │ Fotos               │
├─────────────────────┤          ├─────────────────────┤
│ LA PROPIEDAD        │          │                     │
│  Datos            › │          │  [ ≤10 campos,      │
│  Capacidad y precio›│  ──────► │    entra en un      │
│  Ubicación        › │          │    scroll ]         │
│    ⚠ Sin coordenadas│          │                     │
│  Servicios        › │          │                     │
│    12 seleccionados │          │                     │
├─────────────────────┤          ├─────────────────────┤
│ CONTENIDO           │          │  [ Guardar ] sticky │
│  Fotos            › │          └─────────────────────┘
│    6 fotos          │
│  Preguntas        › │
│  Contacto y redes › │
├─────────────────────┤
│ GESTIÓN             │
│  Calendario       › │
│  Traducciones     › │
│  Reputación       › │
└─────────────────────┘
```

**La segunda línea de cada fila es información, no decorado**: "6 fotos", "⚠ Sin
coordenadas", "12 seleccionados". Eso convierte al hub en un panel de estado de la
propiedad, que es valor que la página larga de hoy no puede dar.

### Reglas transversales (por el perfil de usuario)

- **Migas de pan siempre visibles**: `Mis propiedades › Casa del Sol › Fotos`. El
  anfitrión nunca tiene que deducir dónde está.
- **Texto, no iconos solos.** En el hub el icono acompaña al texto, nunca lo reemplaza.
- **Guardar explícito y con confirmación visible.** Se mantiene el toast
  "Cambios guardados" que ya existe. Nada de autosave silencioso.
- **Navegación suave.** Con View Transitions de Astro, para que el cambio de página no
  se perciba como "se me fue la pantalla".
- **Guard de cambios sin guardar por página.** `useUnsavedChangesGuard` (HOS-373) se
  reusa tal cual, ahora instanciado en cada uno de los 5 formularios.
- **Foco al primer campo inválido.** La infra de `fieldIdPrefix` / `fieldIdSuffixes`
  (HOS-373/385) se reusa por página.

## 9. Acceptance criteria

- **AC-1** — Existen las 10 rutas de la tabla, cada una renderizando exactamente una
  sección. `/editar/` renderiza el hub y **no redirige**.
- **AC-2** — El sidebar de `AccountLayout` es idéntico dentro y fuera del editor: mismo
  contenido, mismo lugar, mismo comportamiento en los dos anchos.
- **AC-3** — En desktop, todos los items del nav de secciones navegan a una ruta.
  Ninguno hace scroll a un ancla.
- **AC-4** — En mobile, `/editar/` muestra el hub con las 10 filas agrupadas en 3
  grupos con encabezado, y cada fila lleva una segunda línea de estado.
- **AC-5** — Ninguna pantalla del editor supera 10 campos de formulario.
- **AC-6** — Cada una de las 5 páginas de formulario guarda **sólo sus propios campos**
  y muestra el toast de confirmación. Salir con cambios sin guardar dispara el guard.
- **AC-7** — Ninguna pantalla monta el JS de una sección que no está mostrando.
  Verificable: entrar a `/datos/` no debe cargar el chunk del calendario.
- **AC-8** — El botón atrás del navegador funciona en toda la jerarquía sin loops de
  redirección, incluido `sección → /editar/ → lista de propiedades`.
- **AC-9** — `EditorSectionNav` ya no contiene `IntersectionObserver`; el estado activo
  se deriva de la URL.
- **AC-10** — Sin cambios en `apps/api`, `packages/db`, `packages/schemas` ni
  migraciones.
- **AC-11** — Verificado en un dispositivo real, recorriendo las 10 secciones. El suite
  verde no alcanza para esto (requisito heredado del texto original de HOS-318).

## 10. Risks

- **R-1 — Tests existentes rompen.** `apps/web/test/components/host/AccommodationEditor.test.tsx`
  y `accommodation-field-ids.test.tsx` asumen que las 13 secciones se renderizan en un
  árbol. Hay que repartirlos por página, no borrarlos.
- **R-2 — Regresión de UX para el usuario objetivo.** El riesgo que motivó D-1 y D-2.
  Mitigación: AC-2, AC-8 y AC-11.
- **R-3 — Percepción de lentitud.** Cada clic pasa a ser una navegación real.
  Mitigación: View Transitions.
- **R-4 — `EditorSectionNav` tiene 3 consumidores.** También lo usan
  `EventEditor.client.tsx` y `PostEditor.client.tsx`. Cambiarlo de scrollspy a nav de
  rutas los afecta. Mitigación: el componente acepta ambos modos, o se hace un
  `EditorRouteNav` separado y los otros dos editores migran después (fuera de alcance,
  NG-5). **Decidir en implementación.**
- **R-5 — Fragmentación del guardado.** 5 formularios significa 5 lugares donde puede
  aparecer un bug de dirty-tracking. Mitigación: extraer un hook compartido
  (`useAccommodationSectionForm`) en vez de copiar el patrón 5 veces.
- **R-6 — Deep links viejos.** Cualquier link a `…/editar/#editor-fotos` deja de
  funcionar. Bajo impacto (son URLs privadas), pero conviene que `/editar/` ignore el
  hash sin romperse.

## 11. Open questions

- **OQ-1** — "Contacto y redes" quedó en el grupo **Contenido**. Cabe discutir si va en
  "La propiedad": son datos del anfitrión, no contenido publicable. Decisión de bajo
  impacto, resoluble en implementación.
- **OQ-2** — R-4: ¿`EditorSectionNav` con dos modos, o `EditorRouteNav` nuevo?
- **OQ-3** — El estado de cada fila del hub ("6 fotos", "⚠ Sin coordenadas") requiere
  calcularse por sección. `PublishPrecheckPanel.astro` ya calcula qué le falta a una
  propiedad para publicarse — **revisar si sirve como fuente** antes de escribir esa
  lógica de nuevo.

## 12. Implementation notes

- **Orden sugerido, incremental.** Cada paso es mergeable por separado:
  1. Crear el hub `/editar/` y mover las **6 secciones ya autónomas** a sus rutas.
     No toca ninguna lógica de guardado. Saca de un saque el grueso del peso JS.
  2. Partir el formulario core en las 5 páginas restantes.
  3. Convertir `EditorSectionNav` a nav de rutas y borrar el scrollspy.
- **Relación con HOS-218** (loop de `GET /public/features`): al mover amenities/features
  a `/servicios/`, ese fetch deja de ejecutarse en las otras 9 pantallas. **Eso no
  arregla el bug** — sólo reduce su superficie. HOS-218 se arregla por su cuenta.
- **`PlanEntitlementGate` se mantiene** en `/calendario/`: la ruta existe siempre y
  muestra el gate a quien no tiene el entitlement. Un 404 sería peor: el anfitrión no
  entendería por qué desapareció una sección que un vecino sí tiene.
- **`/traducciones/`** sólo aparece en el nav y en el hub cuando hay `translationData`,
  igual que hoy.
- **Peso**: las secciones más pesadas hoy son `CalendarSection` (35 KB),
  `ExternalReputationSection` (35 KB), `FaqSection` (33 KB), `TranslationPanel` (26 KB),
  `PhotoSection` (24 KB). Las cinco salen de la pantalla principal en el paso 1.
- **Smoke**: aplica `status-needs-smoke-local`. AC-11 pide dispositivo real.

## 13. Linear

Canonical tracking:
[HOS-318](https://linear.app/hospeda-beta/issue/HOS-318/mejorar-la-ui-del-formulario-de-edicion-de-alojamiento-en-mobile)
