---
id: change-plan
title: "Cambiar de plan"
summary: "Cómo pasar a otro plan o frecuencia de cobro, cuándo rige el cambio y por qué a veces no se puede."
audiences:
  - host
  - venue
  - experience
verticals:
  - accommodation
  - venue
  - experience
keywords:
  - "mi plan"
  - "cambiar de plan"
  - "cambiar plan"
  - "planes y precios"
  - "suscripcion"
  - "upgrade"
  - "mejorar plan"
  - "bajar de plan"
  - "cancelar suscripcion"
  - "dar de baja la suscripcion"
destinations:
  - kind: subscription
    label: "Suscripción"
  - kind: plans
    vertical: accommodation
    label: "Planes para alojamientos"
  - kind: plans
    vertical: venue
    label: "Planes para comercios"
  - kind: plans
    vertical: experience
    label: "Planes para experiencias"
public: false
related:
  - owner-promotions
  - addons
  - publish-requirements
  - calendar
covers:
  - "page:mi-cuenta/suscripcion"
  - "page:planes/anfitriones"
  - "page:planes/comer-y-salir"
  - "page:planes/experiencias"
  - "file:apps/web/src/components/account/PlanChangeOffer.client.tsx"
entryFor:
  - "page:mi-cuenta/suscripcion"
reviewedAt: "2026-11-26"
---

## Qué podés hacer

Cambiar el plan o la frecuencia de cobro de una suscripción activa desde {{link:subscription|Suscripción}}.

Comparar los planes en {{link:plans:accommodation|planes para alojamientos}}, {{link:plans:venue|planes para comercios}} o {{link:plans:experience|planes para experiencias}}.

## Cómo se hace

1. Entrá a «Suscripción». Ahí ves tus suscripciones, el estado de cada una y el resumen de tu prueba gratis.
2. En la suscripción activa, tocá «Cambiar de plan».
3. Elegí otro plan u otra frecuencia de cobro entre las opciones que se listan. Los importes los ves en esa lista y en la página de planes.
4. Leé cómo funciona el cambio: si requiere autorización, vas al checkout de Mercado Pago y tu plan actual sigue hasta que autorices; si se programa, ves la fecha exacta desde la que rige el plan nuevo.
5. Ingresá el correo con el que vas a pagar en Mercado Pago y tocá «Confirmar cambio».
6. Si «Cambiar de plan» no aparece o el sitio dice que no se puede, te explica el motivo: un pago pendiente, la suscripción pausada, un cambio ya programado o que todavía no llegó la fecha en que podés cambiar.
7. Para dejar de pagar, usá «Dar de baja» en la misma suscripción: se corta el cobro automático y seguís con el servicio hasta el final del período pago.

## Qué esperar

- Si el cambio requiere autorización, pasás por el checkout de Mercado Pago y tu plan actual sigue hasta que autorices.
- Si el cambio se programa, ves la fecha exacta desde la que rige.
- Los importes se ven en la lista de opciones y en la página de planes.

## Qué NO esperar

- Cambiar de plan con un pago pendiente, con la suscripción pausada o con otro cambio ya programado.
- Que dar de baja la suscripción corte el servicio en el acto: seguís hasta el final del período pago.

## Problemas comunes

### No aparece el botón para cambiar {#no-aparece}

El sitio te explica el motivo. Si lo que querés es sumar algo puntual, quizás te sirva {{article:addons|un complemento}}.

### Me rechazaron el primer pago {#pago-rechazado}

Durante unos días después del rechazo, «Suscripción» te muestra el aviso y el botón para volver a intentarlo. Cuando ese aviso deja de aparecer, si en esa categoría no tenés otra suscripción activa, aparece «Empezar de nuevo» para elegir el plan otra vez.

### Mi plan no incluye el calendario {#sin-calendario}

Mirá {{article:calendar|el calendario de ocupación}} para saber qué depende del plan.
