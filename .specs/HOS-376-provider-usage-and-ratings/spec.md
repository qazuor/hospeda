---
title: Registrar el uso del beneficio y valoraciones entre proveedor y anfitrión
linear: HOS-376
statusSource: linear
created: 2026-08-02
type: feature
areas:
  - web
  - api
  - db
---

# Registrar el uso del beneficio y valoraciones entre proveedor y anfitrión

## 1. Summary

HOS-278 hace que el proveedor (`host_trade`) entre gratis al directorio a cambio de
aportar un beneficio a anfitriones que pagan por acceder. La idea natural que sigue
es que el anfitrión y/o el proveedor registren que el servicio se usó, y que se
valoren mutuamente — así el proveedor vería en `/mi-cuenta` cuántas veces se usó su
beneficio y qué opinan de él, y esos números sostendrían con datos la promesa de la
landing ("cartera de clientes curados y abundante").

Esta spec se separó deliberadamente de HOS-278 (2026-08-02) porque es un producto
aparte, más grande que todo el resto de proveedor junto, y porque tiene un problema
de fondo sin resolver que **no se puede tapar diseñando bien el resto**. El objetivo
de este documento no es construir la feature: es dejar el problema al frente,
diseñar el modelo asumiendo que se resuelve —para no partir de cero el día que se
decida— y ser explícito sobre qué la hace fracasar.

## 2. Problem

**Nadie tiene incentivo para registrar nada.** Marcar "usé este servicio" es trabajo
voluntario sin recompensa para ninguna de las dos partes: el anfitrión no gana nada
concreto por hacerlo, y el proveedor —que sí se beneficiaría de las estadísticas—
depende de que el anfitrión, no él, haga el trabajo. La tasa de carga espontánea de
algo así tiende a cero en cualquier producto que lo intentó sin resolver el
incentivo primero.

Si nadie registra, el panel de estadísticas del proveedor queda vacío. Eso es **peor
que no prometerlo**: es una promesa de la landing ("vas a ver cuánta gente te usó")
que se cumple con un cero permanente.

**La pregunta que hay que contestar antes de escribir una línea de código es: ¿qué
gana el anfitrión por registrar que usó un beneficio?** Sin una respuesta concreta —
no genérica, no "porque ayuda al proveedor"— la feature nace muerta.

Es además la única pieza de todo el modelo de aliados (HOS-278) que necesita que
**dos personas cooperen**. Partner paga y depende sólo de sí mismo. Editor carga
contenido y depende sólo de sí mismo. Esto depende de que un anfitrión, que no tiene
nada que ganar, se acuerde de hacer un trámite extra después de resolver un problema
doméstico.

## 3. Goals

Dado que esta spec no construye la feature (§4), sus objetivos son los del propio
documento:

- **G-1** — Dejar explícito, como precondición no resuelta, qué gana cada parte por
  registrar uso. Sin eso no se abre ninguna tarea de implementación.
- **G-2** — Diseñar el modelo de datos y el flujo de dos partes asumiendo que el
  incentivo se resuelve, para que el día que haya respuesta no haga falta investigar
  de nuevo qué tablas y endpoints hacen falta.
- **G-3** — Definir cómo se evita que el proveedor infle su propio uso — el riesgo
  más obvio de dejar que cualquiera de las dos partes autodeclare sin control.
- **G-4** — Definir la moderación de una valoración sobre el trabajo de una persona
  real: pública o privada, con o sin derecho a réplica.
- **G-5** — Definir qué se muestra en `/mi-cuenta` mientras no hay datos, que —dado
  el problema de §2— va a ser el caso durante mucho tiempo, tal vez para siempre.

## 4. Non-goals

- **NG-1** — **No se implementa nada de esta spec ahora.** Es diseño-antes-de-decidir,
  no una spec lista para pasar a tareas.
- **NG-2** — **No se resuelve acá la pregunta del incentivo.** Es una decisión del
  owner (§11 OQ-1), no algo que un diseño técnico pueda contestar por sí solo.
- **NG-3** — No cubre valoraciones entre otros tipos de aliado (partner, sponsor,
  editor) ni entre anfitriones entre sí. Sólo anfitrión↔proveedor de `host_trade`.
- **NG-4** — No modifica el sistema de reviews de alojamiento (`accommodation_reviews`)
  ni sus tablas hermanas (`destinationReview`, `experience.review`,
  `gastronomy.review`) — se usa sólo como precedente de lectura, no se toca código.
- **NG-5** — Asume que `host_trade.owner_user_id` (propuesto en HOS-278 §7) ya existe.
  Sin dueño en la ficha, no hay a quién mostrarle estadísticas ni a quién notificar.
  Este documento no depende de que HOS-278 esté implementado para existir, pero
  cualquier endpoint que proponga en §7 sí depende de esa columna.

## 5. Current baseline

### 5.1 El proveedor hoy no tiene dueño

`packages/db/src/schemas/host-trade/host_trade.dbschema.ts` no tiene ninguna columna
que vincule una fila a la cuenta de usuario que la gestiona (`createdById` /
`updatedById` son auditoría de admin, no dueño). HOS-278 propone agregar
`owner_user_id` (nullable) — esta spec da por hecho que esa columna aterriza antes de
que cualquier pieza de acá pueda implementarse.

### 5.2 Cómo un anfitrión ve proveedores hoy

`apps/api/src/routes/host-trade/protected/list.ts` (`GET
/api/v1/protected/host-trades`) devuelve el directorio acotado server-side a los
`destinationId` derivados de las accommodations del propio actor —no todo el
directorio, sólo lo relevante para dónde tiene propiedades. Un host sin
accommodations recibe `[]`, nunca error. Cualquier flujo de "marcá que usaste este
servicio" colgaría de esta misma superficie: el host sólo puede declarar uso de un
proveedor que ya ve en su directorio scoped.

### 5.3 El precedente más cercano: `accommodation_reviews`

Es el sistema de reviews que ya existe en el repo, pero resuelve un problema
distinto y no es un molde para copiar tal cual:

| | `accommodation_reviews` (existe) | esta feature (propuesta) |
|---|---|---|
| Qué se valora | una propiedad | el trabajo de una persona real |
| Rating | jsonb, 6 dimensiones + `averageRating` calculado | a definir, probablemente más simple |
| `moderationState` | **default `APPROVED`** — publica de inmediato salvo que el scan de moderación de texto lo frene (`accommodation_review.dbschema.ts:44-47`) | debería nacer **siempre en revisión** (§6.3) — el riesgo reputacional es mayor |
| Unicidad | `uniqueIndex(userId, accommodationId)` — un review por usuario por alojamiento (`:61-63`) | análogo: un rating por uso, no por par arbitrario (§7) |
| Derecho a réplica | **no existe** — ni campo ni método de servicio para que el alojamiento responda | debería existir (§6.3) — acá el afectado es una persona, no una entidad abstracta |
| Gate de "¿de verdad lo usaste?" | **no existe tampoco.** No hay tabla de bookings/reservas en todo el repo — cualquier usuario autenticado puede reseñar cualquier alojamiento sin evidencia de haberse alojado ahí | el mismo problema se replicaría acá si no se diseña un gate explícito (§6.1, §10 R-2) |

El último punto es relevante: el precedente que existe en el repo **tampoco resolvió**
el problema de verificar que el uso ocurrió de verdad. No hay ejemplo interno de
cómo se haría bien.

### 5.4 No existe ningún patrón "A declara, B confirma" en el repo

Se buscó explícitamente cualquier flujo de dos partes (`pending`→`confirmed`/
`accepted` con dos roles de usuario distintos, tipo reserva o pedido de trabajo). No
hay tabla de bookings ni de `serviceOrder`/`professionalServiceOrder` implementada
(sólo strings de permiso reservados en el enum, sin tabla). Lo más parecido son
flujos admin-revisa-solicitud (`alliance_leads`, moderación de reviews) — pero ahí
quien confirma es siempre staff, nunca la otra parte del intercambio. **El flujo de
dos partes de esta spec no tiene precedente que reusar: se diseñaría desde cero.**

### 5.5 Notificaciones

`packages/notifications` sólo tiene implementado el transporte de email
(`src/transports/email/`, Resend); pese a que la documentación menciona in-app y
push, no hay código de esos canales. Un `NotificationType` nuevo se registra en
`packages/notifications/src/types/notification.types.ts` (enum + interfaz de
payload) y una plantilla en `src/templates/<domain>/`. Cualquier notificación que
esta feature necesite ("che, ¿usaste tal servicio?", "te valoraron, respondé") saldría
sólo por mail, salvo que se construya infraestructura in-app aparte —cosa que hoy no
existe pese a lo que dice el README del paquete.

## 6. Proposed design

Todo lo que sigue **asume que §11 OQ-1 tiene respuesta**. Es el diseño que evita
volver a investigar el modelo el día que haya incentivo — no una autorización para
implementarlo ya.

### 6.1 Quién declara el uso, y por qué sólo esa parte

El uso lo declara **el anfitrión, nunca el proveedor**. Es la única forma simple de
cerrar el riesgo central de §2/§10: si el proveedor pudiera cargar sus propios usos,
las estadísticas que se le muestran a los demás anfitriones ("cuánta gente lo usó")
dejan de ser confiables — el proveedor tiene el incentivo directo opuesto (inflar su
propio número) y ningún costo por hacerlo.

Esto no resuelve el problema de fondo (el anfitrión sigue sin incentivo, §2), sólo
evita agregar un segundo problema encima (falsificación) al primero.

Confirmación del proveedor sobre una declaración del host: **abierta** (§11 OQ-3). Un
diseño posible es que la declaración del host quede en un estado intermedio hasta que
el proveedor la confirme —pero eso reintroduce parte del problema de incentivo del
lado del proveedor (¿por qué confirmaría a tiempo?) y es exactamente el tipo de
decisión que no corresponde tomar en este documento sin la definición de producto de
OQ-1.

### 6.2 La valoración depende de un uso, no es libre

Una valoración sólo puede crearse sobre un uso ya declarado — no hay campo de
"opiná sobre un proveedor" suelto en el directorio. Esto es más estricto que
`accommodation_reviews` (que no tiene ningún gate de uso real, §5.3) y es deliberado:
sin ese gate, cualquiera podría dejar una opinión sobre el trabajo de una persona
real sin haber interactuado con ella.

Es unidireccional por default (anfitrión → proveedor) salvo que §11 OQ-2 se responda
que sí es mutuo. El caso mutuo es más difícil de justificar: el proveedor no paga
por estar en el directorio, así que "valorar al anfitrión" no tiene el mismo rol que
"valorar al alojamiento" tiene para el huésped que sí pagó.

### 6.3 Moderación y derecho a réplica

A diferencia de `accommodation_reviews` (default `APPROVED`, §5.3), toda valoración
nueva debería nacer en `moderationState = PENDING` sin excepción. El motivo no es
simetría de código sino el objeto valorado: acá se opina sobre el trabajo de una
persona identificable (un electricista, un plomero), con consecuencias reales para
su negocio si algo despectivo o falso queda público sin revisión.

El proveedor debería tener **derecho a réplica** — un campo de respuesta, que
`accommodation_reviews` no tiene para nada (§5.3). Sin eso, una valoración injusta
queda con la última palabra de quien la escribió.

Visibilidad: por default, **sólo el proveedor y staff ven las valoraciones**; no se
muestran en el directorio público a menos que se decida explícitamente lo contrario
(§11 OQ-4). Es la opción más conservadora dado que se trata de reputación de una
persona real y el volumen esperado es bajo — publicar tres valoraciones sueltas de
un proveedor puede ser más engañoso que no publicar nada.

### 6.4 Qué se muestra sin datos

Dado que §2 hace probable que pase mucho tiempo sin ningún registro, el panel del
proveedor en `/mi-cuenta` debe tener un estado vacío explícito y honesto —"todavía no
se registró ningún uso"— nunca un contador en cero que se lea como medición real
(mismo patrón de honestidad que el endpoint de usage de billing, que declara
`isMeasured` en vez de mostrar un 0 ambiguo). Esto es un requisito de diseño
independiente de si el incentivo se resuelve: aun resuelto, el arranque va a tener
cero datos.

### 6.5 El disparador de la notificación no existe

Cualquier recordatorio tipo "¿usaste este servicio? contanos" necesita un evento que
dispare el envío. No hay ninguno: no existe una reserva, un pedido de trabajo, ni
ningún registro de que el anfitrión efectivamente contactó al proveedor. La única
señal disponible hoy sería un timer genérico ("cada tanto, recordale a los hosts que
tienen proveedores en su directorio que los valoren") — que es spam sin contexto, no
un recordatorio relevante, y probablemente empeora la tasa de carga en vez de
mejorarla.

## 7. Data model / contracts

Todo lo que sigue es **diseño de referencia, no una migración a aplicar**. Ninguna
tabla ni endpoint de esta sección se crea con esta spec.

### Migraciones (hipotéticas)

| tabla | forma | notas |
|---|---|---|
| `host_trade_usages` | `id, host_trade_id (FK), host_user_id (FK), accommodation_id (FK, nullable), note (text, nullable), declared_at, created_at` | Declarado únicamente por el anfitrión (§6.1). `accommodation_id` nullable porque no siempre hay una propiedad concreta asociada al uso. |
| `host_trade_ratings` | `id, usage_id (FK única — un rating por uso), host_trade_id (FK, denormalizado para queries), host_user_id (FK), rating (numérico, forma exacta abierta), comment (text, nullable), moderation_state (PENDING default), moderated_by_id, moderated_at, moderation_reason, reply_text (nullable), replied_at (nullable)` | `usage_id` único fuerza el gate de §6.2: sin uso no hay rating. |
| `host_trade` | `owner_user_id` | **Prerequisito de HOS-278**, no de esta spec. Sin esto no hay a quién mostrarle nada de lo de arriba. |

### Endpoints (hipotéticos)

| método | ruta | notas |
|---|---|---|
| `POST` | `/api/v1/protected/host-trades/:id/usages` | Sólo el anfitrión declara; el proveedor no puede llamarlo sobre su propia ficha. |
| `GET` | `/api/v1/protected/host-trades/:id/usages/mine` | Historial del propio anfitrión para ese proveedor. |
| `POST` | `/api/v1/protected/host-trades/:id/ratings` | Requiere un `usage_id` propio y sin rating previo. |
| `GET` | `/api/v1/protected/host-trades/mine/ratings` | Vista del proveedor (requiere `owner_user_id` de HOS-278) — agregado + lista, respetando `moderation_state`. |
| `POST` | `/api/v1/protected/host-trades/ratings/:id/reply` | Derecho a réplica del proveedor (§6.3). |

Ninguna de estas rutas debería cachearse (son actor-dependientes, mismo criterio que
HOS-278 §12).

## 8. UX / UI behavior

Descriptivo del diseño de referencia, no de una implementación planeada:

- **Directorio del anfitrión** (`/mi-cuenta/directorio-proveedores/`, superficie
  existente de `host_trade`) — junto a cada proveedor que el host ya ve scoped por
  destino (§5.2), un CTA para declarar uso. Sin incentivo visible en el CTA, es
  esperable que nadie lo toque (§2).
- **Panel del proveedor** (`/mi-cuenta`, vía HOS-278) — contador de usos, rating
  agregado si hay al menos uno, lista de comentarios moderados y aprobados, y campo
  de respuesta por comentario. Estado vacío explícito mientras no haya datos (§6.4).
- **Ninguna valoración se muestra en el directorio público** salvo decisión explícita
  en contrario (§6.3, §11 OQ-4).
- Toda copy, si se implementa, va por i18n en es/en/pt.

## 9. Acceptance criteria

Como esta spec no se implementa (§4 NG-1), lo que sigue son invariantes de diseño que
cualquier implementación futura debe cumplir — no un checklist para cerrar esta
tarea.

- **AC-1** — No se abre ninguna tarea de implementación de esta spec hasta que el
  owner responda §11 OQ-1 con un incentivo concreto para el anfitrión.
- **AC-2** — Un proveedor no puede crear un registro de uso sobre su propia ficha;
  sólo el anfitrión que la ve en su directorio scoped puede declararlo.
- **AC-3** — Una valoración no puede crearse sin un uso declarado previamente
  (`usage_id` obligatorio y único por rating).
- **AC-4** — Toda valoración nueva nace en `moderationState = PENDING`, nunca
  autopublicada (a diferencia de `accommodation_reviews`).
- **AC-5** — El proveedor puede responder a una valoración una vez que existe.
- **AC-6** — Mientras no haya usos ni valoraciones, el panel del proveedor muestra un
  estado vacío explícito, nunca un cero indistinguible de una medición real.
- **AC-7** — Ninguna valoración es visible en el directorio público por default; se
  requiere una decisión explícita documentada (§11 OQ-4) para cambiarlo.

## 10. Risks

- **R-1 — El incentivo sin resolver mata la feature antes de nacer.** Es el riesgo
  central de §2: cualquier diseño técnico, por bueno que sea, no genera carga si
  nadie tiene motivo para cargar.
- **R-2 — El precedente interno no resolvió el gate de "uso real".**
  `accommodation_reviews` no verifica que el reviewer se haya alojado ahí (§5.3) — no
  hay ejemplo interno de cómo hacerlo bien, y el diseño de §6.2 (rating atado a un
  `usage_id`) es una respuesta propia, no una que ya esté probada en este repo.
- **R-3 — Aun con "sólo el host declara", el host puede declarar sin haber usado
  nada.** §6.1 cierra el riesgo de que el *proveedor* infle su propio número, pero no
  impide que el host declare un uso falso (positivo o negativo) sin costo. No hay
  verificación de terceros posible sin un sistema de pedidos/reservas que hoy no
  existe.
- **R-4 — Costo de moderación sobre volumen probablemente ínfimo.** Si R-1 se
  concreta, moderar valoraciones sobre personas reales es trabajo de staff permanente
  para un goteo de contenido que puede no justificarlo.
- **R-5 — No hay disparador confiable de notificación** (§6.5): sin evento real que
  marque "el host acaba de usar el servicio", cualquier recordatorio es un timer
  genérico, con más riesgo de leerse como spam que de mejorar la tasa de carga.
- **R-6 — Consecuencias reputacionales reales.** Una valoración negativa sobre un
  proveedor real (un electricista, un plomero) afecta su negocio fuera de la
  plataforma. Moderación y derecho a réplica (§6.3) no son mejoras opcionales — son
  la condición para que esto sea defendible si se construye.

## 11. Open questions

- **OQ-1 (la que bloquea todo lo demás)** — ¿Qué gana el anfitrión por registrar que
  usó un beneficio? Sin una respuesta concreta del owner, ninguna tarea de esta spec
  se implementa (§2, AC-1). Candidatos que NO son respuesta válida por sí solos:
  "ayuda al proveedor" (el host no tiene por qué priorizar eso), "mejora el
  directorio" (beneficio difuso, no del host). Necesita algo que el host gane él
  mismo, en el momento de registrar.
- **OQ-2** — ¿Es bidireccional de verdad (el proveedor también valora al anfitrión),
  o sólo el anfitrión valora al proveedor? §6.2 asume sólo-anfitrión por default; si
  el owner quiere mutuo, cambia el modelo de datos de §7.
- **OQ-3** — ¿La declaración de uso del anfitrión necesita confirmación del proveedor
  antes de contar en las estadísticas, o alcanza con la palabra del anfitrión?
  Confirmación agrega una segunda dependencia de cooperación (§2) sobre una parte que
  tampoco tiene incentivo claro para confirmar rápido.
- **OQ-4** — ¿Las valoraciones llegan a ser públicas en el directorio alguna vez, o
  quedan siempre privadas (proveedor + staff)? §6.3 propone privado por default.
- **OQ-5** — ¿Qué evento, si alguno, podría disparar una notificación de "registrá
  este uso" sin ser spam genérico? (§6.5) — puede no haber respuesta sin construir
  antes algún tipo de registro de contacto/pedido, lo cual es una feature en sí misma.
- **OQ-6** — Si el proveedor deja de estar activo (`isActive=false`) o se desvincula
  de su usuario (mismo gap que nota HOS-278 §12 para la ficha), ¿el historial de uso
  y las valoraciones sobreviven, se archivan, o se ocultan?
- **OQ-7** — ¿Corresponde alguna variante de esta feature para los otros tipos de
  aliado (partner, editor) o es exclusiva de proveedor por ser el único caso
  "gratis + beneficio" del modelo de HOS-278?

## 12. Implementation notes

- Nada de esta spec se implementa sin resolver §11 OQ-1 primero (NG-1, AC-1).
- Depende de que `host_trade.owner_user_id` (HOS-278 §7) exista — sin dueño no hay a
  quién mostrarle estadísticas.
- El precedente más cercano en el repo (`accommodation_reviews`,
  `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts`) resuelve
  un problema distinto (reseña de una propiedad, publica por default, sin derecho a
  réplica, sin gate de uso real) — no es un molde para copiar, sólo una referencia de
  qué campos y patrones ya existen en el repo (`moderationState`, `ModerationStatusPgEnum`,
  índice único compuesto).
- No existe en el repo ningún patrón "A declara, B confirma" — se buscó explícitamente
  (§5.4) y el flujo de dos partes de §6 se diseñaría desde cero si se implementa.
- `packages/notifications` sólo tiene transporte email — cualquier notificación de
  este flujo sale por mail únicamente hasta que exista infraestructura in-app.

## 13. Linear

Canonical tracking:
HOS-376

Separado de: HOS-278 (el modelo de aliados — el proveedor arranca sin esto).
