---
title: Sub-spec 9 · Copy neutro del embudo de «Comer y salir»
linear: HOS-1787 (hijo: lo crea el orquestador al cerrar la revisión)
statusSource: linear
created: 2026-10-25
status: draft
revised: 2026-10-25 (resolución de la vuelta 3)
---

# 9 · Copy neutro del embudo

Decisiones: DEC-FAC-069 (Q-20 = 1), con los textos de DEC-FAC-068 y la frontera de tipos de DEC-FAC-067. Hallazgo:
F-V2-016 (B-006).

**Por qué es un hijo propio y no parte del sub-spec 6** (DEC-FAC-069): toca superficies que el 6 no toca (correos de
`packages/notifications`, la página de precios, la de publicar, el footer, el ícono); no depende de la paginación de
HOS-1797, que bloquea al 6; y es una tarea de contenido en tres idiomas que se revisa mejor sola. El número 8 queda para
la migración del editor de alojamiento (hijo 8, pendiente de crear), por eso este es el 9.

**Depende de** 1 (los nombres y rutas ya renombrados) y 2 (las descripciones de tipo). **Bloquea el merge de los
sub-specs 5 y 6** (DEC-FAC-076): son los que ofrecen el rubro `nightlife` (selector del alta, colección `/rubro/noche/`),
y no se mergean antes que este hijo. Así la noche nunca llega a `staging` (ni a prod en una promoción) con el copy de
restaurante, sin depender de recordarlo al promover. Puede ir en paralelo con 3, 4 y 7.

## Regla

El copy de la **vertical** nombra las dos cosas («tu local», «para comer o para salir», «carta o barra»); lo que sólo
vale para la cocina (platos, carta, menú del día) vive **dentro** de las secciones, que ya se ocultan por rubro. Los
correos van por usuario + vertical, no por ficha, así que son **neutros**: nunca se ramifican por rubro (regla 1 del
paraguas, G-FAC-03). Ningún archivo de esta lista lee `business_lines`.

## Inventario cerrado

| superficie | dónde (nombres tras el sub-spec 1) | qué cambia |
|---|---|---|
| presentación (landing) | `apps/web/src/pages/[lang]/presentacion/comer-y-salir/index.astro` y sus claves | copy neutro de vertical; secciones que muestran la carta, rotuladas como del rubro gastronomía |
| venta / planes | `planes/comer-y-salir/index.astro`, comparativa (sub-spec 6) | encabezados y beneficios neutros; las filas de rubro las marca la comparativa |
| precios | `es/pricing.json:235` y equivalentes en/pt | «publicar tu restaurante, parrilla, rotisería o carrito» → neutro |
| publicar | `es/publish.json:41,46,57,72` y equivalentes | idem, sin «dónde comer» como única promesa |
| intro de la vertical | `es/venue.json` (ex `gastronomy.json:11,143`) | «los mejores restaurantes, bares y sabores» → incluye la noche |
| footer | `footer.json` (enlace de la vertical) | etiqueta «Comer y salir» (la categoría temática `footer.categoryGastronomy` no se toca) |
| puertas de descubrimiento | `apps/web/src/config/discovery-doors.ts:157` | texto e ícono |
| ícono de la vertical | `discovery-doors.ts`, página de precios | deja `ForkKnifeIcon`; **propuesta del agente**: un ícono existente de `@repo/icons` que represente un local (no cubiertos); si no hay uno adecuado, se agrega por el flujo de `@repo/icons` |
| correos de la serie de prueba | `packages/notifications/src/utils/product-domain-copy.ts:69-77` (y `:140`) | «cargá tu menú con tus platos» → «completá tu local: horarios, fotos y lo que ofrecés» |
| correo de recordatorio de renovación | `packages/notifications/src/templates/billing/renewal-reminder.tsx` (su línea de cierre sale de `product-domain-copy.ts:111`) | línea de cierre neutra de vertical |
| What's New de lanzamiento | `apps/api/src/data/whats-new/whats-new.ts`, escrito por el flujo de HOS-1214 (sign-off del smoke) | anuncia «Comer y salir» con los dos rubros; `publishedAt: 'on-promotion'` |

Todo en es, en y pt. **Relevado** (F-V3-015): no existe un correo de bienvenida propio de la vertical; las plantillas
con copy de vertical son la serie de prueba (nueve plantillas que leen `product-domain-copy.ts`) y el recordatorio de
renovación; `newsletter-welcome-email.tsx` no habla de la vertical. Un ítem nuevo que aparezca en la tarea entra a esta
tabla en el mismo PR.

## Consecuencia del enlace de carta pago (DEC-FAC-062)

Relevado (F-V3-005): ni el embudo, ni la comparativa, ni `scripts/production-catalog/catalog.ts` prometen el enlace a la
carta gratis. La única promesa está en el **editor** (`gastronomy.json:216`, upsell de la carta) y la corrige el
sub-spec 5. Si aparece otra en la tarea, se corrige acá: desde DEC-FAC-062 el enlace es parte de la carta y es pago.

## Criterio de aceptación

- Ningún texto del inventario dice «restaurante», «platos» o «menú» como descripción de la vertical (sí dentro de lo
  que es del rubro gastronomía); revisión del owner sobre las tres lenguas.
- Los correos de la serie de prueba no varían por rubro; test que renderiza la plantilla para un dueño de un boliche y
  verifica que no menciona carta ni platos.
- G-FAC-R1 en verde (las claves nuevas no reintroducen la palabra retirada).
- Smoke en staging (`status-needs-smoke-staging`): recorrer presentación → precios → publicar → alta como boliche y
  recibir el primer correo de prueba.
