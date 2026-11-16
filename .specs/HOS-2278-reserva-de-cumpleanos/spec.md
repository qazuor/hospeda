---
title: Reserva de cumpleaños con beneficio
linear: HOS-2278
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Reserva de cumpleaños con beneficio (premium)

## 1. Resumen

El local ofrece un **beneficio de cumpleaños** (entrada free, champagne, postre) con un
texto, condiciones ("grupo de 6 o más") y si pide DNI en la puerta. El turista marca "Es
mi cumpleaños" al reservar, y el local ve la reserva destacada. La ficha pública muestra
"Festejá tu cumple acá". Mismo gate que los grupos: `venue_group_reservations`.

Es una **extensión** del modelo de reservas (HOS-2275), no un modelo aparte. Aplica las
decisiones del owner del 16/11/2026 (HOS-2260): reserva por solicitud con vencimiento de 24
h o 1 h antes de la fecha, y capacidad = aforo total en personas por noche. Una reserva de
cumpleaños retiene sus personas del aforo como cualquier otra.

## 2. Problema

El cumpleaños es el motivo más frecuente de una reserva grande, y los locales ya lo
ofrecen por Instagram. Falta un lugar donde publicarlo, pedirlo y verlo destacado.

## 3. Goals

- G-1: el local define su beneficio de cumpleaños, una sola vez por local.
- G-2: el turista lo elige al reservar y ve qué incluye y qué se le va a pedir.
- G-3: el local ve la reserva destacada, con el beneficio.
- G-4: la puerta sabe qué entregar y si pedir DNI.
- G-5: la ficha pública lo promociona.

## 4. Non-goals

- NG-1: cobrar o descontar. El beneficio es un texto; el local lo cumple.
- NG-2: verificar la edad o el cumpleaños dentro de la plataforma (el DNI se pide en la
  puerta, a mano).
- NG-3: varios beneficios por local o por plan. Uno por local.
- NG-4: guardar la fecha de nacimiento del usuario.
- NG-5: promos de cumpleaños como promos genéricas (HOS-2270) o con la promo del mes.

## 5. Estado actual del código

- No existe nada de cumpleaños. Hay un CTA gratuito en toda la ficha: **"Aceptamos
  eventos"** (`apps/web/src/components/venue/VenueEventsCta.astro`, HOS-1055), un botón
  que ancla al bloque de contacto. No es esto: no tiene beneficio, reserva ni gate, y
  convive sin conflicto (es "alquilá el salón"; esto es "festejá tu cumple con nosotros").
  Ojo con el texto en la ficha para no mostrar dos botones que parezcan lo mismo.
- Campo multilang del local con precedente: `entryNoteI18n`
  (`packages/db/src/schemas/venue/venue.dbschema.ts:88`, tipo `I18nText`,
  `packages/schemas/src/common/i18n.schema.ts`). Se reusa el formato.
- Modelo de reservas y grupos: HOS-2275 y HOS-2277.
- Pase y validación: HOS-2276 (solo la cuenta del dueño valida; la tarjeta lleva un campo `display`).
- Rubros: `business-lines.ts:26-39`; la sección va en ambos rubros.

## 6. Diseño propuesto

### 6.1 Datos

`venue_birthday_benefit` (1 a 1 con el local):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `venue_id` | uuid fk `venues` ON DELETE CASCADE, único | cuelga del listing (PURGED) |
| `is_active` | boolean default true | |
| `title_i18n` | jsonb `I18nText` | "Cumple free" |
| `description_i18n` | jsonb `I18nText` | texto del beneficio, máx. 300 caracteres |
| `min_party_size` | smallint null | "grupo de 6 o más"; null = sin mínimo |
| `requires_id` | boolean default false | pide DNI en la puerta |
| `valid_weekdays` | smallint[] null | días en que aplica; null = todos |
| auditoría + soft delete | | |

CHECK en extras: `min_party_size between 2 and 50`, `valid_weekdays` con valores 0 a 6.

`venue_reservation` (columnas nuevas, opcionales):

| Columna | Tipo | Nota |
|---|---|---|
| `is_birthday` | boolean not null default false | |
| `birthday_benefit_id` | uuid null fk (ON DELETE RESTRICT) | |
| `birthday_benefit_snapshot` | jsonb null | copia del título, texto y `requires_id` **al pedir** |

El **snapshot** evita que el local cambie el beneficio después de que el turista lo
eligió: la reserva honra lo que se le mostró. Es el mismo criterio de "lo ya confirmado
se respeta" de la decisión 6 del owner.

No se guarda la fecha de nacimiento ni se pide el nombre del cumpleañero: se toma el
nombre de la reserva. Si el que cumple es otra persona, el local lo coordina por la nota.

### 6.2 Reglas

- Para reservar con cumpleaños: el local tiene un beneficio `is_active`, el dueño tiene
  `venue_group_reservations`, `party_size >= min_party_size` si hay mínimo, y el día de la
  semana está en `valid_weekdays` si está definido. Incumplirlo: 409 `ALREADY_EXISTS` con
  `details.reason` `BIRTHDAY_NOT_AVAILABLE`, `BIRTHDAY_MIN_PARTY` o `BIRTHDAY_DAY_NOT_VALID`.
  El formulario ya filtra, y el servidor valida igual.
- Se puede combinar con grupo (HOS-2277): un cumpleaños de 10 es un grupo con el
  beneficio.
- La reserva de cumpleaños es una reserva común (mesa o VIP según el rubro, `kind`) que descuenta `party_size` del aforo (HOS-2275, 6.1): no hay tipo especial de cumpleaños ni tipos de reserva.
- **Condiciones y consecuencias.** Si el turista cancela o no se presenta, no hay costo.
  Si el local cambia o apaga el beneficio, las reservas ya confirmadas **conservan el
  snapshot**; las nuevas ven el vigente.
- Tras una baja de plan: el beneficio deja de ofrecerse al público y no se edita; las
  reservas ya pedidas lo conservan (snapshot).

### 6.3 Gate y permisos

- Configurar el beneficio: `listingAccess` `{ vertical: VENUE, operation: 'EDIT',
  listingSection: birthday, capabilities: [venue_group_reservations] }` (sección nueva
  `birthday`, `common: false`, `entitlementKey: K.VENUE_GROUP_RESERVATIONS`; los rubros
  `food` y `nightlife` la incluyen).
- Pedir con cumpleaños: `POST /protected/venue-reservations` con `isBirthday: true`; el
  servicio exige que el **dueño** tenga la clave (se lee del conjunto efectivo del dueño,
  como HOS-2277 6.2). Sin ella: 403 `ENTITLEMENT_REQUIRED`.
- Sin permisos nuevos de plataforma: autoriza el pipeline y la propiedad de la fila.

### 6.4 Rutas

| Método y ruta | Tier | Quién |
|---|---|---|
| `GET/PUT /protected/venues/:id/birthday-benefit` | protected | dueño (gate) |
| `DELETE /protected/venues/:id/birthday-benefit` | protected | dueño; desactiva |
| `GET /public/venues/:id/birthday-benefit` | public | `{ title, description, minPartySize, requiresId, validWeekdays }` solo si está activo y el plan lo incluye |
| `POST /protected/venue-reservations` (con `isBirthday`) | protected | turista |

La respuesta pública no incluye nada del dueño. La lectura pública también viene dentro
de la ficha (`by-slug`, `by-id`, `list`, `by-destination`): misma disciplina que HOS-1792
(ver HOS-2275, 6.4).

## 7. UX / UI

- **Ficha pública:** bloque "Festejá tu cumple acá" con el título del beneficio, la
  descripción, la condición ("grupo de 6 o más") y "Si reservás con cumpleaños te vamos a
  pedir el DNI en la puerta" cuando `requires_id`. Botón "Reservar para mi cumple", que
  abre el formulario de reserva con la casilla marcada. No puede quedar pegado visualmente
  al CTA "Aceptamos eventos".
- **Formulario de reserva:** casilla "Es mi cumpleaños" (solo si hay beneficio vigente);
  muestra las condiciones y avisa si no se cumplen con la cantidad elegida.
- **Panel del local:** la fila de la reserva lleva una insignia con un ícono de
  `@repo/icons` (no emojis ni SVG sueltos). Filtro "Solo cumpleaños". Detalle: texto
  del beneficio y "Pedir DNI".
- **Validación del dueño (HOS-2276):** la tarjeta muestra "Cumpleaños: <título>" y "Pedir DNI" si aplica,
  para que quien está en la puerta no tenga que abrir el panel.
- **Editor del local:** sección "Cumpleaños" con los campos del beneficio, con el
  candado de upsell (`VenueSectionLockedPanel`) si el plan no lo incluye.

## 8. i18n

`venue.birthday.*` (ficha, formulario, panel, puerta), es/en/pt. El título y la
descripción del beneficio son del local, en el mismo formato multilang que
`entryNoteI18n`; si falta una traducción, se cae al español, como el resto de la ficha.

## 9. Criterios de aceptación

- AC-1: dado un plan sin `venue_group_reservations`, guardar el beneficio responde 403
  `ENTITLEMENT_REQUIRED` y la UI muestra el upsell.
- AC-2: un local con beneficio activo muestra "Festejá tu cumple acá" con el texto y las
  condiciones; sin beneficio o con plan sin la clave, el bloque no aparece.
- AC-3: reservar con `isBirthday` en un local sin beneficio activo responde 409
  `BIRTHDAY_NOT_AVAILABLE`.
- AC-4: con `min_party_size = 6`, una reserva de 4 con cumpleaños responde 409
  `BIRTHDAY_MIN_PARTY`.
- AC-5: con `valid_weekdays = [5, 6]`, reservar un martes responde 409
  `BIRTHDAY_DAY_NOT_VALID`.
- AC-6: la reserva guarda un snapshot del beneficio; si el local lo edita después, la
  reserva conserva el texto original.
- AC-7: el panel destaca la reserva de cumpleaños y permite filtrar por ellas.
- AC-8: con `requires_id`, la tarjeta de validación del dueño muestra "Pedir DNI".
- AC-9: un cumpleaños puede ser también un grupo; los dos flujos conviven.
- AC-10: tras bajar de plan, el beneficio deja de ofrecerse y las reservas ya hechas lo
  conservan y se pueden validar.
- AC-11: no se guarda fecha de nacimiento ni DNI en la plataforma.
- AC-12: el texto del beneficio se escapa en web y correo.

## 10. Plan de pruebas

- Unit: validación de condiciones (`min_party_size`, `valid_weekdays`), snapshot,
  esquema multilang.
- Integración con base: CHECK, FK RESTRICT, snapshot inmutable.
- Rutas: gate, contrato de errores, lectura pública con plan del dueño sin la clave,
  cobertura de las cuatro lecturas públicas.
- Web: formulario (filtra condiciones), bloque público, panel.
- E2E: configurar beneficio, reservar con cumpleaños, aceptar, validar en la puerta.
- Guards: `check-purged-closed-list` (`venue_birthday_benefit` cuelga de `venues`).

## 11. Riesgos

- R-1: el beneficio promete algo y el local no lo cumple. Fuera del alcance técnico; se
  cubre con reseñas y reporte. El snapshot al menos deja registro de qué se prometió.
- R-2: abuso: marcar cumpleaños sin serlo. El DNI en la puerta lo mitiga; el local decide.
- R-3: dos CTA parecidos en la ficha ("Aceptamos eventos" y "Festejá tu cumple"). Revisar
  con diseño.
- R-4: menores en la reserva. No se pide edad ni DNI en línea.

## 12. Preguntas abiertas para el owner

Decididas en HOS-2260 (16/11/2026): OQ-1, OQ-3, OQ-4, OQ-8. Específicas, todas abiertas (menores):

- OQ-L: **¿un beneficio por local o varios?** Recomendada: uno (KISS y alcanza para el
  caso de "cumple free"). Alternativa: una lista de beneficios por local (champagne,
  postre, entrada). Contra: más UI y más reglas de elegibilidad.
- OQ-M: **¿el beneficio se aplica solo con reserva aceptada?** Recomendada: sí; la
  solicitud rechazada o vencida no lo da. Alternativa: sin reserva, como cartel de ficha.
- OQ-N: **¿la ficha puede mostrar "Festejá tu cumple" a locales sin plan premium?**
  Recomendada: no (es parte del plan, decisión de la épica).

## 13. Dependencias

- Bloqueado por: HOS-2275 (modelo de reservas y aforo), HOS-2276 (validación), HOS-2277 (se combina),
  HOS-2259 (clave).
- Habilita: HOS-2283 (asignar a planes).

## 14. Smoke y What's New

`status-needs-smoke-staging`. What's New: sí, junto a grupos y reservas.

## 15. Desglose de tareas

1. T-1: tabla `venue_birthday_benefit`, columnas en `venue_reservation`, CHECK y fila PURGED
   (1 día).
2. T-2: esquemas Zod (I18nText, límites) y servicio del beneficio (1 día).
3. T-3: validación de elegibilidad y snapshot en el pedido de reserva (1 día).
4. T-4: rutas del dueño y lectura pública, gate y las cuatro lecturas públicas (1 día).
5. T-5: sección `birthday` en el catálogo de secciones y rubros (0,5 día).
6. T-6: editor del beneficio y upsell (1 día).
7. T-7: bloque público y casilla en el formulario (1 día).
8. T-8: panel (insignia y filtro) y tarjeta de validación (0,5 día).
9. T-9: i18n es/en/pt, integración, E2E y guards (1 día).

## 16. Linear

Canonical tracking:
HOS-2278
