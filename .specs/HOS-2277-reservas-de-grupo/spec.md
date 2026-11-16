---
title: Reservas de grupo con nombre
linear: HOS-2277
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Reservas de grupo con nombre (premium)

## 1. Resumen

Una sola reserva para N personas con un nombre de grupo ("Despedida de Sofi, 12
personas"). Quien reserva puede compartir un link para que los demás confirmen que van.
El local ve el grupo como **una unidad** en el panel, con la cantidad confirmada. Gate
`venue_group_reservations`.

Es una **extensión** del modelo de reservas (HOS-2275), no un modelo paralelo: suma
columnas opcionales a `venue_reservation` y una tabla de integrantes.

Aplica las decisiones del owner del 16/11/2026 (HOS-2260) y el modelo de HOS-2275:
solicitud con aceptación del local que vence a las 24 h o 1 h antes de la fecha, y
**capacidad = aforo total en personas por noche** (un solo entero por local). Un grupo de N
personas retiene N personas del aforo desde que se pide (pendiente incluida). El pase por
persona (HOS-2276) lo valida solo la cuenta del dueño.

## 2. Problema

Despedidas, cumpleaños de 15 y salidas de oficina son el negocio fuerte de un local de
noche. Hoy el organizador pasa una lista por WhatsApp y el local no sabe cuántos vienen
de verdad hasta que llegan.

## 3. Goals

- G-1: reservar para un grupo con nombre y cantidad.
- G-2: compartir un link; cada integrante confirma con su cuenta.
- G-3: el local ve el grupo como unidad: nombre, cantidad pedida, cantidad confirmada.
- G-4: un pase QR por persona confirmada, sin pasar de la cantidad reservada.
- G-5: mismo modelo, mismos estados y mismas notificaciones que una reserva común.

## 4. Non-goals

- NG-1: pagos o división de cuenta.
- NG-2: que los integrantes elijan su plato o consumo.
- NG-3: grupos que se parten en varias mesas o noches; asignar mesas al grupo (plano de mesas, HOS-2295). Un grupo es **una** reserva que descuenta N personas del aforo.
- NG-4: chat del grupo.

## 5. Estado actual del código

- No hay reservas ni grupos (ver HOS-2275 y HOS-2260, sección 5).
- Patrón de "link para unirse" más cercano: el token de conversación
  (`conversation-token-*` en `apps/api/src/cron/jobs/`), y los `short_code` de
  `generateShortId` (`packages/utils/src/short-id.ts`).
- `PermissionEnum`, `listing-access` con `capabilities`: ver HOS-2275.
- Páginas neutrales al idioma para enlaces: `qr/[slug].astro` y `isLanguageNeutralRoute`.

## 6. Diseño propuesto

### 6.1 Cambios de datos (migración aditiva sobre HOS-2275)

`venue_reservation_setting` (HOS-2275; no hay tipos de reserva, OQ-C):

| Columna | Tipo | Nota |
|---|---|---|
| `allows_groups` | boolean not null default false | el local marca si acepta grupos; sin esto la opción no se ofrece |

`venue_reservation` (columnas nuevas, todas opcionales):

| Columna | Tipo | Nota |
|---|---|---|
| `group_name` | varchar(80) null | su presencia define "es un grupo" |
| `group_invite_token` | varchar(32) null, único | 128 bits aleatorios; se genera al confirmarse |
| `group_invite_closed_at` | timestamptz null | el organizador puede cerrar el link |

Índice único parcial en `group_invite_token WHERE group_invite_token IS NOT NULL`.
CHECK en extras: si `group_name IS NULL` entonces `group_invite_token IS NULL`.

`venue_reservation_member` (nueva):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `reservation_id` | uuid fk RESTRICT | |
| `user_id` | uuid fk `users` | |
| `display_name` | varchar(120) | PII; copia del perfil |
| `status` | enum `venue_reservation_member_status` | `CONFIRMED`, `LEFT`, `CANCELLED_BY_VENUE`, `CHECKED_IN` |
| `joined_at`, `left_at` | timestamptz | |
| `anonymized_at` | timestamptz null | cron de retención (90 días) |
| auditoría + soft delete | | |

Único parcial `(reservation_id, user_id) WHERE status IN ('CONFIRMED','CHECKED_IN')`.
La tabla cuelga de `venue_reservation`; el guard `check-purged-closed-list` la cubre por
su padre solo si cuenta como "colgada de un listing"; si no, igual se agrega fila por
prolijidad y se confirma con el guard.

El organizador **cuenta** dentro de `party_size`; los integrantes confirmados son
`party_size − 1` como máximo.

### 6.2 Reglas

- Pedir un grupo: igual que una reserva (HOS-2275, 6.3) más `groupName` (3 a 80
  caracteres, sin URL) y un local con `allows_groups = true`. `party_size` debe ser **≥ 2**,
  hasta 50 y dentro del aforo disponible esa noche (HOS-2275, 6.1): el grupo retiene sus N
  personas igual que una reserva común.
- Gate: pedir un grupo exige que el **dueño** tenga `venue_group_reservations`; el público
  solo ve la opción de grupo (`allows_groups`) si el plan lo incluye (mismo mecanismo de lectura
  pública que HOS-2275, 6.4). Sin la clave, 403 `ENTITLEMENT_REQUIRED` en el POST de grupo
  y la opción no se muestra.
- El link se crea cuando la reserva pasa a `CONFIRMED` (no antes: no se comparte algo que
  el local todavía puede rechazar). Se **revoca** si la reserva se cancela, vence o se
  rechaza.
- Unirse: `POST /protected/venue-group-invites/:token/join` con sesión y email
  verificado. Reglas: el token existe, el grupo está `CONFIRMED`, el link no está
  cerrado, hay lugar, el usuario no es el organizador ni ya integrante. Errores: 404
  token inexistente o cerrado (misma respuesta); 409 `ALREADY_EXISTS` con
  `details.reason` `GROUP_FULL`, `ALREADY_MEMBER`, `GROUP_CLOSED`.
- Concurrencia: bloqueo de la fila de la reserva y conteo de integrantes activos antes de
  insertar, como el cupo de la lista.
- Salir: `POST /protected/me/venue-group-memberships/:id/leave` hasta 2 h antes. El
  organizador cancela con `cancel` (HOS-2275) y se cancelan los integrantes.
- Si el local cancela: se cancela el grupo entero y se avisa a todos.
- Cada integrante ve el nombre del grupo, fecha y local; **no** ve los datos de los demás
  ni el teléfono del organizador. El organizador ve los nombres de los integrantes.

### 6.3 Pases (OQ-I)

Recomendada: **un QR por persona confirmada**, más el del organizador:

- Al confirmarse el grupo, el pase del organizador admite `admits = party_size − integrantes`
  (todos los lugares que nadie reclamó) y baja a medida que alguien se une, nunca por
  debajo de 1. Cada integrante recibe un pase propio con `admits = 1` (`subject_type =
  RESERVATION_MEMBER`, HOS-2276).
- El total que puede entrar nunca supera `party_size`.
- Si el pase del organizador ya fue usado, el link se cierra solo (no se une nadie más).
- Si todo el grupo prefiere un solo QR, el organizador entra con todos (`admits` =
  `party_size`) y nadie se une: es el caso por defecto si no se comparte el link.

### 6.4 Rutas

| Método y ruta | Tier | Quién |
|---|---|---|
| `POST /protected/venue-reservations` (con `groupName`) | protected | turista; ver gate |
| `GET /public/venue-group-invites/:token` | public | `{ groupName, venueName, date, time, full }`. Sin cantidades ni nombres |
| `POST /protected/venue-group-invites/:token/join` | protected | turista |
| `POST /protected/me/venue-group-memberships/:id/leave` | protected | integrante |
| `POST /protected/me/venue-reservations/:id/group-link/close` | protected | organizador |
| `GET /protected/venues/:id/reservations?date=` | protected | dueño; ahora con `group: { name, confirmed, size }` |

Rate limit de `join`: 10 por hora por usuario. El `GET` público es de solo lectura y con
`Cache-Control` corto.

### 6.5 Notificaciones (tipos nuevos, `TRANSACTIONAL`, es/en/pt)

- `VENUE_GROUP_JOINED`: al organizador, "X confirmó que va".
- `VENUE_GROUP_MEMBER_CONFIRMED`: al integrante, con su pase.
- `VENUE_GROUP_CANCELLED_BY_VENUE`: a todos.
- Las del ciclo de la reserva (HOS-2275) siguen valiendo para el organizador.
- Para no inundar al organizador, los avisos de "X confirmó" se agrupan en un resumen
  diario si hay más de 5 en un día. (Si es mucho para la etapa 1, se manda uno por
  integrante y se agrupa después.)

## 7. UX / UI

- **Reserva:** casilla "Es un grupo" con nombre del grupo (solo si el local acepta grupos y el
  plan del local lo incluye). Tras la confirmación: botón "Compartir link" (Web Share API
  con copiar como alternativa).
- **Página `/grupo/[token]`** (neutral al idioma, SSR sin caché, sin sesión): nombre,
  fecha, local y botón "Confirmar que voy" (isla). Sin sesión, lleva a ingresar y vuelve.
  Estados: lleno, cerrado, ya confirmado.
- **Mi cuenta:** el organizador ve integrantes; el integrante ve su pase.
- **Panel del local:** el grupo es una fila expandible: "Despedida de Sofi, 7 de 12
  confirmados".

## 8. i18n

`venue.group.*`, `account.groups.*`, correos. es, en, pt. El nombre del grupo es texto
libre del usuario (no se traduce) y se **escapa** en correos y panel.

## 9. Criterios de aceptación

- AC-1: dado un plan sin `venue_group_reservations`, pedir un grupo responde 403
  `ENTITLEMENT_REQUIRED` y el público no ve la opción de grupo.
- AC-2: pedir un grupo en un local con `allows_groups = false` responde 400 `VALIDATION_ERROR`.
- AC-2b: un grupo de 12 con aforo 40 y 30 personas retenidas responde 409 `NO_AVAILABILITY`; con 20 retenidas queda `REQUESTED` y retiene 12.
- AC-3: el grupo pasa por `REQUESTED → CONFIRMED` como cualquier reserva y recién ahí
  existe el link.
- AC-4: un integrante se une con sesión; el contador sube y el organizador recibe aviso.
- AC-5: con `party_size = 3` y 2 integrantes, un tercero recibe 409 `GROUP_FULL`.
- AC-6: 20 uniones simultáneas a un grupo de 6 dejan exactamente 5 integrantes.
- AC-7: un usuario no se une dos veces (409 `ALREADY_MEMBER`); el organizador no se une.
- AC-8: token inexistente o link cerrado responde 404 igual.
- AC-9: la suma de lo admitido por los pases del grupo nunca supera `party_size`.
- AC-10: si el local cancela, todos los integrantes y pases quedan cancelados y avisados.
- AC-11: el integrante no ve datos de otros integrantes ni el teléfono del organizador.
- AC-12: el panel muestra el grupo como una unidad con "confirmados de total".
- AC-13: un nombre de grupo con HTML se muestra escapado en web y correo.
- AC-14: tras una baja de plan, los grupos ya confirmados siguen funcionando (unirse,
  salir, ingresar); no se aceptan grupos nuevos.

## 10. Plan de pruebas

- Unit: tabla de transiciones de integrante, cálculo de `admits`, validación del nombre.
- Integración con base: concurrencia de uniones (AC-6), índices parciales, CHECK, RESTRICT.
- Rutas: gate, 404 uniforme, rate limit, contrato de errores, visibilidad de datos.
- Guards: `check-purged-closed-list`, páginas sin sesión (`/grupo/[token]`).
- E2E: organizar, compartir, unirse con otra cuenta, validar ambos pases en la puerta.

## 11. Riesgos

- R-1: `admits` dinámico del organizador es la parte delicada. Se recalcula en la misma
  transacción que la unión o la salida, y se prueba.
- R-2: spam con el link por un tercero. Requiere cuenta verificada, límite y cierre del link.
- R-3: PII de terceros que el organizador "anota". No se anota a nadie: cada integrante
  confirma con su propia cuenta.
- R-4: depende de HOS-2275 y HOS-2276.

## 12. Preguntas abiertas para el owner

- OQ-I: **QR por grupo o por persona.** Sigue abierta (menor); el QR lo valida solo la
  cuenta del dueño (HOS-2276, OQ-6 decidida). (1) Uno por grupo: simple; entra uno y pasan
  todos, sin asistencia individual. (2) **Uno por persona confirmada, con el del
  organizador cubriendo los lugares sin reclamar (recomendada)**: da asistencia real y no
  obliga a todos a unirse. Impacto: la tabla de integrantes y el recálculo de `admits`.
- OQ-J: **tamaño mínimo para ser "grupo".** Recomendada: 2 (lo marca el organizador) y
  que el local decida con `allows_groups` si acepta grupos. Alternativa: mínimo fijo
  de 6 (coincide con el ejemplo de cumpleaños de HOS-2278).
- OQ-K: **Decidido (owner, 16/11/2026): sí, los integrantes necesitan cuenta** con email verificado (OQ-4 de HOS-2260).

## 13. Dependencias

- Bloqueado por: HOS-2275 (modelo y aforo), HOS-2276 (pase por integrante), HOS-2259. Asignación de mesas a grupos: HOS-2295.
- Habilita: HOS-2278 (cumpleaños, que suele ser un grupo).

## 14. Smoke y What's New

`status-needs-smoke-staging`. What's New: sí, junto a las reservas.

## 15. Desglose de tareas

1. T-1: migración aditiva (`allows_groups` en `venue_reservation_setting`, columnas de grupo, tabla de integrantes), CHECK,
   enum y fila PURGED (1 día).
2. T-2: servicio de grupos (pedir, unirse, salir, cerrar link) con bloqueo (1 día).
3. T-3: recálculo de `admits` y pases por integrante, junto a HOS-2276 (1 día).
4. T-4: rutas públicas y protegidas, gate, rate limit (1 día).
5. T-5: notificaciones y plantillas (0,5 día).
6. T-6: página `/grupo/[token]` e isla de unirse (1 día).
7. T-7: formulario de reserva con grupo, Mi cuenta, panel (1 día).
8. T-8: integración, E2E y guards (1 día).

## 16. Linear

Canonical tracking:
HOS-2277
