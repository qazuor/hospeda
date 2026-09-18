---
title: El contrato de cobertura — la única frontera entre las dos épicas
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-18
status: CURRENT
---

# 12 · El contrato de cobertura

> **Este documento es de la frontera, no de una épica.** Lo citan `HOS-1353` y `HOS-1354`, y
> **ninguna de las dos lo puede mutar sola** (`DEC-ARCH-006`). Una copia que una de las dos pueda
> tocar sin que la otra se entere es `F-1B-132` otra vez: seis repartos sobre las mismas tablas y
> ninguno coincide.

---

## 1. Qué problema resuelve

`DEC-ARCH-005` parte el programa en dos épicas autónomas, y eso sólo sirve si la de verticales
**puede correr sin que exista la de billing**. El punto de contacto no es teórico: el **paso 5**
de la resolución de autorización (cap. 17 §1.2) pregunta *«¿tiene trial, suscripción, cortesía o
grant que lo cubra?»*, y **tres de esas cuatro fuentes son de billing**.

Este contrato es ese paso 5, enunciado una sola vez, para que verticales lo pueda responder hoy y
billing lo pueda responder de verdad mañana **sin que verticales cambie**.

### 1.1 El mismo hecho, en cuatro lugares

Lo que verticales necesita de billing no está repartido: es **un hecho**, que el diseño ya pedía
en cuatro lugares distintos con cuatro nombres distintos.

| dónde | cómo se llama ahí |
|---|---|
| cap. 17 §1.2, paso 5 | *«¿tiene trial, suscripción, cortesía o grant que lo cubra?»* |
| cap. 03 §9, transición `PB2` | *«se pierde la cobertura»* |
| cap. 15 §6 | *«su plan comercial está `SUSPENDED`»* |
| cap. 02 §3.2 · cap. 15 §4.2 | el disparador del recálculo del conjunto efectivo |

El tercero parece distinto y no lo es: el §21 dice que un plan suspendido queda *«sin entitlements
comerciales»*, así que **suspendido es no tener cobertura**, y los beneficios heredados de Turista
VIP se pierden porque su fuente dejó de otorgar — no por una regla aparte.

### 1.2 Y no depende de lo que billing todavía no decidió

El capítulo 13 tiene abierta una pregunta grande: si el reloj de cobro es nuestro o del proveedor.
**Este contrato se escribe igual en los dos mundos** — en los dos hay un título con un estado y
una fecha hasta la cual cubre. Se puede definir hoy sin prejuzgar el 13.

---

## 2. La pregunta, y lo que contesta

```text
cobertura(user, vertical) → {
    cubierto:  sí | no
    fuentes:   [ { tipo, versiónDePlan, hasta } ]
}
```

Una sola pregunta, con la vertical **obligatoria en la firma** — no opcional, no deducible del
recurso. Es la misma forma estructural que el capítulo 17 §2.2 le dio a toda operación de dominio,
y por el mismo motivo: **una resolución que no se puede invocar sin el dato no tiene un control
que alguien pueda olvidar.**

### 2.1 Qué es cada campo, y quién lo consume

| campo | qué es | quién lo necesita |
|---|---|---|
| **`cubierto`** | si hay **al menos una** fuente viva. Es el §36 — *«permanece activo mientras al menos una source exista»* | el paso 5 de la autorización; `PB2`; el §6 del capítulo 15 |
| **`fuentes`** | **todas** las fuentes vivas, no la que manda | el aviso de qué se pierde (cap. 15 §6.3) y el reconciliador, que necesita saber si apagar una deja las otras |
| **`tipo`** | `TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` | los avisos, que dicen cosas distintas según por qué se perdió |
| **`versiónDePlan`** | **la referencia, no los valores** | el paso 6: es cómo verticales sabe qué otorga esa fuente |
| **`hasta`** | la fecha hasta la que cubre, o **sin fecha** para un grant permanente | los avisos con ventana (cap. 15 §4.4) |

### 2.2 `fuentes` es una lista, y eso no es de más

Podría parecer que alcanza con `cubierto`. No alcanza, y el caso está en el diseño: **quitar una
fuente no quita la cobertura si queda otra.** Un reconciliador que no vea las demás apaga
capacidades que la persona sigue teniendo, que es exactamente lo que el capítulo 15 §4 va a
evitar. La lista es lo que permite decidir sin volver a preguntar.

### 2.3 `versiónDePlan` es un puntero, y ahí está la división del trabajo

Es la parte más fina del contrato y conviene decirla despacio.

**El paso 6 pregunta qué otorga la fuente. Quién sabe *qué otorga* un plan es verticales** —
`plan_version_entitlement` y `plan_version_limit` son tablas suyas (`DEC-ARCH-005`). **Quién sabe
*cuál plan* tiene esta persona es billing**, porque la suscripción ancla su versión (`DEC-ARCH-001`).

Entonces el contrato devuelve **el puntero y nunca los valores**: billing dice *«esta persona está
cubierta por la versión de plan X»* y verticales sabe qué otorga X. Si el contrato devolviera los
entitlements resueltos, la resolución del capítulo 15 —las cuatro estrategias de agregación, los
scopes, el trinquete— pasaría a vivir del lado de billing, y sería **la segunda fuente** de algo
que tiene que tener una sola.

---

## 3. El aviso

```text
evento: la cobertura de (user, vertical) cambió
```

Es lo único que billing le **empuja** a verticales. Lleva qué fuente cambió y en qué dirección, y
alimenta dos cosas que ya existen en el diseño: la transición `PB2` de publicación y la lista de
invalidación del caché (cap. 02 §3.2), que es la **misma lista** que dispara el reconciliador de
excedentes (cap. 15 §4.2) — *«una lista, dos consumidores»*.

**El evento no reemplaza la consulta.** El reconciliador *«no se dispara por evento: se dispara
por condición»* (cap. 15 §4.2): el aviso dice que hay que recalcular, y el recálculo vuelve a
preguntar. Un consumidor que decidiera con lo que trae el evento estaría creyéndole a un mensaje
en vez de al estado, que es el error que el capítulo 03 §10 ya prohibió para los eventos del
proveedor.

---

## 4. Lo que NO cruza la frontera

Declarado en positivo, porque es la mitad del valor de tener un contrato:

**No cruzan** montos, precios, monedas, ciclos, estados de pago, ids del proveedor, fechas de
cobro, medios de pago, comprobantes ni reembolsos.

Dos ausencias que parecen faltas y son decisiones:

- **El estado exacto de la suscripción no cruza.** Verticales no distingue `ACTIVE` de
  `GRACE_PERIOD`: el §20 y el §21 dicen que durante el grace **el servicio sigue**, así que los dos
  cubren y la diferencia es de billing. Pasarla sería invitar a que alguien escriba una regla de
  producto sobre un estado de cobranza.
- **El precio del plan no cruza**, aunque la `versiónDePlan` sí. Es exactamente el corte de
  `DEC-ARCH-005`: `plan_version` es de verticales, `billing_option` es de billing.

> **Regla de vigilancia**: si aparece un quinto lugar que necesita algo de billing **y no es este
> hecho**, es señal de que el corte se está filtrando. Se mira, no se resuelve en el lugar.

---

## 5. Las dos implementaciones

El contrato nace con dos, desde el día uno. Es la **condición B de `DEC-ARCH-004`** aplicada a
esta frontera: *«es lo que prueba que la abstracción no miente»*.

### 5.1 La de arranque resuelve el trial de verdad

**No devuelve datos fijos.** Resuelve honestamente la única fuente que ya existe del lado de
verticales —el trial, con su máquina de estados del capítulo 03 §2— y responde que no a las otras
tres.

**Por qué esto y no un valor hardcodeado**, que es la parte que más cambia el resultado del
ejercicio:

| implementación | qué pasa |
|---|---|
| contesta **siempre que sí** | es un fail-open, y **la mitad interesante nunca se ejerce**: perder la cobertura, `PB2`, el reconciliador, el aviso de qué se hizo |
| contesta **siempre que no** | todo queda apagado; no se ejerce nada |
| **resuelve el trial** | **los dos caminos se ejercen completos**, porque un trial vence de verdad |

Lo único que se siembra es un plan con sus entitlements para que el trial tenga de dónde derivar
(cap. 02 §2.1: *«sus limits y entitlements no se guardan: se derivan»*). **Eso es un dato, no una
rama en el código** — y la distinción importa, porque una rama es lo que después queda viva.

### 5.2 La real la escribe la épica de billing

Agrega las otras tres fuentes —suscripción, cortesía, grant— y **no toca nada de lo construido**:
se enchufa como fuente y como emisor del aviso.

### 5.3 Son dos, y no hay una tercera

**No existe una implementación que lea el billing actual.** Se propuso —un adaptador sobre el
sistema que corre hoy, para que verticales pudiera llegar a producción sin esperar a la otra
épica— y **se descartó porque su premisa no existía**: `DEC-ARCH-007` es explícita en que las dos
llegan juntas, así que nadie necesita que una salga sola.

Queda escrito acá porque la idea es tentadora y va a volver: es código real sobre un sistema
condenado, escrito para tirarlo, resolviendo un problema que el programa no tiene.

---

## 6. Las tres defensas

Ninguna es opcional, y las tres son parte de la decisión (`DEC-ARCH-006`), no una recomendación.

### 6.1 El default es negar

Una fuente no implementada responde **que no**. Así, **un olvido apaga funciones en vez de
regalarlas** — y regalarlas es lo que nadie descubre hasta que ya pasó.

Este proyecto ya tiene el caso escrito: un fallback comentado como seguro que era el permisivo.

### 6.2 Un solo juego de casos corre contra las dos implementaciones

Es lo que convierte *«billing reemplaza la implementación de arranque»* en un evento verificable
en vez de un día de sorpresas. Para cuando llegue, ese juego ya corrió meses contra la otra.

Y vale la regla del capítulo 20 §2.1: **un caso que no puede fallar es un comentario con exit code
0.** El juego incluye el caso que distingue una implementación correcta de una que contesta
siempre lo mismo — si pasa con las dos, no está probando nada.

### 6.3 Un guard impide que la implementación de arranque llegue a producción

Es la única de las tres que convierte *«no lo hagas»* en *«no se puede»*, que es la misma razón
por la que `DEC-ARCH-004` pidió su condición A.

---

## 7. Lo que este contrato NO decide

- **Cómo se resuelven los entitlements y los limits.** Es el capítulo 15, y es de verticales. Acá
  está de dónde sale el puntero, no qué se hace con él.
- **Qué es una suscripción, una cortesía o un grant por dentro.** Son los capítulos 12 y 14, y son
  de billing. Acá está qué aportan, no cómo funcionan.
- **Quién tiene el reloj de cobro.** Es el capítulo 13, sigue abierto, y este contrato se escribe
  igual en los dos desenlaces (§1.2).
- **En qué package vive cada cosa.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`). Lo que
  este documento fija es el contrato, no su domicilio.
