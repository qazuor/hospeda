---
title: Master Spec 09 — Conciliación
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 2
capitulo: 9
---

# 09 · Conciliación

El §23 pide un proceso periódico contra el proveedor que detecte webhooks faltantes,
duplicados, pagos y suscripciones huérfanas, estados que no coinciden y preapprovals
desconocidos.

`DEC-CONC-002` ya decidió la forma. Este capítulo la ejecuta: qué corre, cuándo, qué compara y
qué hace con cada diferencia.

---

## 1. Por qué la forma canónica no aplica

Lo normal sería extraer dos inventarios en paralelo —el nuestro y el del proveedor— y
enfrentarlos. **Acá uno de los dos no se puede obtener**, y no es una opinión: está medido.

El buscador de suscripciones del proveedor **falla en tres direcciones y no avisa en ninguna**
(`RC-1`):

| lo que se le pide | lo que devuelve |
|---|---|
| filtrar por nuestra referencia | **la ignora** y devuelve todo |
| filtrar por un estado inválido | **cero resultados con `200`** — no un error |
| filtrar por un estado válido | **un subconjunto plausible**: en producción, `cancelled` trajo **15 de 69** |

**El tercero es el peor**: un barrido que liste desde el proveedor procesa parte de la cartera y
**termina en verde**. Y para cerrar el punto, el buscador devuelve **menos campos** que el `GET`
por id (`RC-4`), mientras que leer **por id sí es confiable** (`RC-2`).

---

## 2. Las cuatro partes

### 2.1 El inventario sale de nuestra base

Se guarda el id de cada suscripción y se leen **de a una, por id**. **El buscador del proveedor
no es fuente de verdad de nada.**

**Consecuencia que conviene decir en voz alta**: guardar ese id deja de ser una comodidad y pasa
a ser **la condición de que la conciliación exista**. Una suscripción cuyo id se pierde es
invisible para el barrido, y sólo reaparece si cobra y emite un webhook.

### 2.2 Las huérfanas se detectan por webhook, no por barrido

Si sólo miramos los ids que ya tenemos, una suscripción que **nunca registramos** no aparecería
jamás. La cubre el otro lado: **toda suscripción que cobra emite un webhook**, así que uno que
llegue de un preapproval desconocido **es** la detección.

### 2.3 Un barrido diario para lo que el webhook no cubre

Sobre todo para lo que **diverge en silencio**. El caso exacto: **mutar el monto no emite
webhook** (`EX-15`), así que un cambio de precio que el proveedor aceptó y no aplicó no tiene
ninguna vía de aviso — sólo aparece releyendo.

### 2.4 Sólo se repara el vínculo automáticamente

Re-vincular una huérfana reescribiendo su `external_reference` **no cambia plata ni estado**:
sólo dice de quién es. Y está medido que se puede hacer sobre una suscripción viva (`EX-19`).

**Toda divergencia de monto, estado o cobro emite `RECONCILIATION_REQUIRED` y la mira una
persona.** Es el criterio del owner aplicado por tercera vez: **la línea no es «automático contra
manual», es «toca plata o no toca plata»**.

---

## 3. Qué compara el barrido, campo por campo

Por cada suscripción de nuestro inventario que no esté en un estado terminal:

| se compara | contra | si difieren |
|---|---|---|
| estado | el del proveedor, leído por id | **no se escribe el del proveedor**: se evalúa la transición contra la tabla del cap. 03. Si no existe, `RECONCILIATION_REQUIRED` |
| monto vigente | `transaction_amount` | `RECONCILIATION_REQUIRED` — es el caso que no avisa por ningún canal |
| fecha del próximo cobro | `next_payment_date` | se registra; **no es por sí sola una divergencia**, porque el proveedor la mueve solo en casos medidos (`PS-6`) |
| cobros del período | los `authorized_payments` del preapproval | ver §4 |
| la `version` del recurso | la última que aplicamos | si la del proveedor es mayor, **el recurso cambió sin avisarnos**: se relee entero |

**Los estados terminales no se barren**: `CANCELLED` y `ABANDONED` no pueden divergir hacia nada
que nos importe, y barrerlos es gastar llamadas sobre la parte de la cartera que más crece.

---

## 4. Los tres modos de «cero cobros», y ninguno se distingue solo

Es la trampa mejor documentada de este carril, y casi produce dos conclusiones falsas durante la
medición. `GET /authorized_payments/search?preapproval_id=` devuelve **cero** por tres causas
distintas:

| causa | cómo se distingue |
|---|---|
| **no cobró nunca** | el preapproval tiene `charged_quantity` en cero o nulo |
| **lag**: cobró y el endpoint todavía no lo indexó | **el contador del preapproval se actualiza ANTES que el endpoint de cobros** — está medido: a las 21:33 decía `charged_quantity: 1` y el search devolvía 0; minutos después devolvía 1 |
| **el id es de otra cuenta** | la lectura por id del preapproval falla |

**La regla que sale de esto: la conciliación nunca concluye «no cobró» desde ese endpoint.**
Concluye desde el contador del preapproval, y usa el endpoint para traer el detalle. Al revés, un
reconciliador que vea subir el contador y vaya a buscar el cobro **no lo encuentra**, y eso no es
una divergencia.

---

## 5. El bug vivo que pasa a ser caso de uso

Hay un error real en producción —webhooks de suscripción que fallan porque el preapproval no
resuelve a ninguna suscripción nuestra, la API responde `500` y los encola hasta cinco veces—
registrado durante FASE 1C y **no tocado**, porque el §4 prohíbe tocar código productivo.

**Ese error es exactamente el detector de §2.2 funcionando.** El sistema detecta la huérfana
bien; lo que está mal es lo que hace después. **Cuando se arregle, no debe silenciarse: tiene que
convertirse en el disparador de la re-vinculación.**

> Esto aparece acá como **modo de falla ya observado**, no como razón de diseño: la forma de la
> conciliación la fija `DEC-CONC-002`, no este incidente.

---

## 6. Dos límites que no se pueden correr

1. **Más allá de doce meses, la única fuente somos nosotros.** La documentación del proveedor
   dice que su buscador de pagos cubre sólo los últimos doce meses. El histórico es nuestro o no
   existe — y eso alcanza al histórico de reembolsos (`DEC-RF-001`).
2. **El cobro del proveedor llega tarde y el retraso es variable**: ~33 minutos en una renovación
   de sandbox, ~26 en producción, ~100 segundos en un alta. **El barrido no puede tratar como
   divergencia un cobro que todavía no apareció**, y por eso su ventana de tolerancia se fija
   contra el retraso medido, no contra la fecha nominal.

---

## 7. Frecuencia y orden

| proceso | cuándo | por qué esa frecuencia |
|---|---|---|
| **detección por webhook** | continua | es el camino principal (§2.2) |
| **barrido de la cartera** | **diario** | es lo que `DEC-CONC-002` fijó, y alcanza para lo que diverge en silencio: un monto mal aplicado cuesta un ciclo, no un día |
| **barrido de creaciones sin respuesta** | **cada pocos minutos** | es el estado intermedio de `DEC-CONC-001`: una creación que quedó sin respuesta puede haber cobrado, y ahí el tiempo sí importa |

**Los dos barridos son idempotentes**: correrlos dos veces no produce nada distinto, porque
ninguno escribe salvo la reparación de vínculo del §2.4.

---

## Lo que este capítulo NO cierra

- **`RF-3` sigue `UNKNOWN`**: qué pasa al reembolsar un pago de más de 180 días. Alcanza a la
  reparación de una divergencia vieja y es del capítulo 13.
- **Las cinco filas del grace** (`RN-2`, `RN-3`, `GR-1`, `GR-2`, `GR-3`) se contestan el
  2026-09-17. Hasta entonces, **la ventana de tolerancia del §6.2 no se puede fijar para el caso
  de un cobro fallido**, porque no se sabe cuántas veces reintenta el proveedor ni en qué estado
  deja la suscripción mientras lo hace.
