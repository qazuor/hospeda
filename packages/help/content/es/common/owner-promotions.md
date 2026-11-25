---
id: owner-promotions
title: "Crear promociones y elegir quién las ve"
summary: "Cómo se crea una promoción, qué cambia entre «Para todos» y «Solo VIP» y por qué un turista puede no verla."
audiences:
  - host
  - venue
verticals:
  - accommodation
  - venue
keywords:
  - "promocion"
  - "promociones"
  - "oferta"
  - "descuento"
  - "solo vip"
  - "para todos"
  - "promo borrosa"
  - "no ven mi promocion"
destinations:
  - kind: page
    page: promotions
    label: "Mis promociones"
  - kind: ownEditorSection
    vertical: venue
    section: promotions
    label: "Promociones de tu comercio"
  - kind: plans
    vertical: accommodation
    label: "Planes para alojamientos"
  - kind: plans
    vertical: venue
    label: "Planes para comercios"
public: true
related:
  - change-plan
  - pause-resume
covers:
  - "entitlement:create_promotions"
  - "entitlement:vip_only_promotions"
  - "limit:max_active_promotions"
  - "limit:max_free_visible_promotions"
entryFor:
  - "page:mi-cuenta/promociones"
  - "page:mi-cuenta/promociones/nueva"
  - "section:venue.promociones"
reviewedAt: "2026-11-25"
---

## Qué podés hacer

Crear promociones para tus alojamientos en {{link:page:promotions|Mis promociones}} y para tu comercio en {{link:section:venue:promociones|las promociones de tu comercio}}. En cada promoción elegís quién la ve: «Para todos» o «Solo VIP».

## Cómo se hace

1. Entrá a «Mis promociones» (alojamientos) o a la sección «Promociones» del editor de tu comercio.
2. Tocá «Nueva promoción» ({{link:page:promotionNew|crear una promoción de alojamiento}}) y cargá el título, el beneficio y las fechas.
3. Elegí quién la ve: «Para todos» o «Solo VIP».
4. Guardá. Podés cambiar la opción cuando quieras editando la promoción.

### «Para todos» y «Solo VIP» {#opciones}

- «Para todos»: todos los turistas suscriptos la ven. Los turistas con el plan gratis ven una cantidad limitada de promociones por página, elegidas al azar, así que a veces la ven y a veces no.
- «Solo VIP»: solo la ven los turistas suscriptos, y les avisamos por correo. Los turistas con el plan gratis la ven borrosa, con una invitación a suscribirse.

## Qué esperar

- Crear promociones depende de tu plan, y tu plan fija cuántas pueden estar activas a la vez: {{limit:max_active_promotions:accommodation}}.
- «Solo VIP» también depende de tu plan. Si tu plan no la incluye, la opción aparece con un candado y un enlace a los planes.
- Una promoción borrosa muestra solo el valor y el tipo de beneficio. El nombre del lugar no aparece: en su lugar va un nombre de relleno.
- En la búsqueda, las tarjetas muestran «Promo» si el lugar tiene una promoción «Para todos» y «VIP» si tiene una «Solo VIP». Si tiene de las dos, se ven las dos.
- Los turistas suscriptos reciben una vez por semana un correo con las promociones nuevas de esa semana, de los dos tipos.

### Ejemplo {#ejemplo}

Tenés tres promociones «Para todos» y una «Solo VIP». Un turista suscripto ve las cuatro. Un turista con el plan gratis ve algunas de las tres «Para todos», distintas en cada visita, y la «Solo VIP» borrosa.

## Qué NO esperar

- Elegir qué promociones «Para todos» ve cada turista gratis: la selección es al azar en cada visita.
- Que una promoción «Solo VIP» pase sola a «Para todos». Si tu plan deja de incluir «Solo VIP», esas promociones se pausan y te avisamos por correo. Para reactivarlas, volvé a un plan que la incluya o cambialas a «Para todos».

## Problemas comunes

### ¿Por qué un turista no vio mi promoción? {#no-la-vio}

Puede pasar por varias razones:

- Es «Para todos» y el turista tiene el plan gratis: ve una cantidad limitada por página, al azar. En otra visita puede verla.
- Es «Solo VIP» y el turista tiene el plan gratis: la ve borrosa, sin el nombre del lugar.
- La promoción no está activa: está pausada, todavía no empezó o ya terminó.

### «Solo VIP» aparece con un candado {#opcion-bloqueada}

Tu plan no incluye promociones «Solo VIP». Mirá {{link:plans:accommodation|los planes para alojamientos}} o {{link:plans:venue|los planes para comercios}}, o {{article:change-plan|cambiá de plan}}.

### Mis promociones «Solo VIP» se pausaron {#pausadas}

Tu plan dejó de incluir «Solo VIP». Están pausadas, no borradas: editalas y elegí «Para todos», o volvé a un plan que incluya «Solo VIP».
