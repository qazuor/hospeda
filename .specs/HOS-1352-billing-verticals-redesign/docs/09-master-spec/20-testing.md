---
title: Master Spec 20 — Estrategia de testing
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 2
capitulo: 20
---

# 20 · Estrategia de testing

El §62 abre diciendo que *«testing forma parte del diseño desde el comienzo»* y reparte el trabajo
en cuatro capas. Este capítulo dice **qué va en cada una** y, sobre todo, resuelve las dos cosas
que el §62 deja sin decir y que deciden si la suite sirve:

- **qué tiene que mentir el proveedor falso** (§3), porque uno que se porte bien no prueba nada
  sobre el código que tiene que sobrevivir al real;
- **qué son exactamente los guards** que los capítulos anteriores fueron dejando (§2), que hoy
  están repartidos en siete lugares.

---

## 1. Las cuatro capas

| capa | qué cubre | contra qué corre |
|---|---|---|
| **dominio e integración** (§62.1) | los escenarios funcionales: estados, transiciones, trial, billing, grace, pausa, cancelación, upgrade, downgrade, promo, cortesía, grant, addons, entitlements, limits, autorización, conciliación, **carreras** e **idempotencia** | base real, proveedor falso |
| **guards** | propiedades del **código**, no de una ejecución | el árbol de fuentes, en CI |
| **sandbox del proveedor** (§62.3) | *«suite real más pequeña pero obligatoria»* | Mercado Pago sandbox |
| **E2E** (§62.4) | *«los flujos críticos que hoy requieren smoke manual»* | el sistema entero |

**El §62.1 dice algo que conviene no suavizar: *«cubrir 100 % de escenarios funcionales
relevantes. No obsesionarse con 100 % lines»*.** Un porcentaje de líneas se sube ejecutando
código sin afirmar nada sobre él; un escenario faltante es un caso que nadie pensó. Las dos
métricas no miden lo mismo y sólo una importa.

---

## 2. Los guards, en un solo lugar

Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| G1 | una pieza **nombra una vertical** sin implementar uno de los ocho ítems del Eje 2 | cap. 01 §4.4 |
| G2 | una operación de dominio **no declara** su contexto de vertical | cap. 17 §2.3 |
| G3 | una clave usada en código **no existe en la base**, o una de la base **no existe en el catálogo** — las dos direcciones | cap. 02 §1.2 |
| G4 | una transición de suscripción o de trial **escribe roles** | cap. 17 §4.4 |
| G5 | una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes | cap. 15 §4.2 |
| G6 | una autorización **decide sólo por rol** | invariantes §64.12 y §64.13 |
| G7 | un valor comercial vive **en código** | invariantes §64.15 y §64.16 |
| G8 | aparece `commerce` en fuentes activas | invariante §64.32, §55 |
| G9 | el `reason` que se manda al proveedor es **un identificador interno** y no copy para el cliente | `D9`, `EX-19` |
| G10 | un `init_point` del proveedor se muestra **sin sanear** | `D10`, `EX-37` |
| G11 | se le pide un **trial al proveedor** | `D12` |

**G1 y G2 son la pinza** y ya se explicó en el capítulo 17 §2.3: uno acota **quién puede** nombrar
una vertical, el otro obliga a que las operaciones **lo hagan**. Por separado cada uno deja pasar
lo que el otro atrapa.

### 2.1 Un guard se prueba rompiéndolo

**Todo guard de esta lista lleva un caso que lo hace fallar a propósito.** No es rigor de más: un
guard que no puede fallar es un comentario con exit code 0, y no hay forma de distinguirlo de uno
que funciona salvo rompiéndolo.

Vale igual para el mensaje: **el texto con que falla no puede afirmar más de lo que el predicado
verifica.** Un guard que dice *«ninguna operación cruza verticales»* y sólo mira una forma
sintáctica está mintiendo con precisión, que es peor que no estar.

---

## 3. El proveedor falso tiene que mentir

### 3.1 La tesis

El §62.2 dice que *«la gran mayoría de escenarios se prueba contra provider falso/controlado»* y
no dice **cómo se comporta** ese falso. Si se lo escribe con el comportamiento razonable —acepta y
aplica, rechaza y explica, avisa cuando algo cambia— **se está probando el código contra un
proveedor que no tenemos.**

El capítulo 06 y la matriz midieron lo contrario, repetidamente: **este proveedor acepta y no
aplica, responde `2xx` sobre operaciones que descarta, y avisa de cosas que sus propios datos
desmienten.**

> **El stub no simula al proveedor: reproduce sus mentiras medidas.** Cada una está fechada y con
> su fila; ninguna es una hipótesis sobre cómo podría fallar.

### 3.2 Las mentiras que el stub tiene que poder hacer

| lo que hace el proveedor real | fila |
|---|---|
| mutar el monto **no emite ningún webhook** — nos enteramos releyendo o no nos enteramos | `EX-15` |
| un `PUT` mixto **se aplica a medias**, con `200` | `EX-20` |
| la **fecha** de una suscripción viva es inmutable: cuatro formas de pedirlo, cuatro `200`, cero cambios | `EX-34` |
| **estando pausada rechaza toda modificación** con `400`, pero sí deja cancelar | `EX-11` |
| el campo `items` devuelve `201` y **se descarta en silencio** | `EX-5` |
| el `search` **ignora** nuestra referencia y devuelve todo; con un `status` inválido devuelve `200` y cero; y con `status=cancelled` devuelve **un subconjunto plausible** — 15 de 69 | `RC-1`, `RC-4` |
| el `init_point` **viene roto** | `EX-37` |
| el token de tarjeta es de **un solo uso** | `EX-12` |
| el cobro llega **tarde y con retraso variable**: ~26 min en producción, 33 medidos en sandbox | `PA-3` |
| le **escribe al cliente por su cuenta y primero**, en el alta, el cambio de monto, la pausa y la cancelación — y tres de esos correos afirman cosas falsas | `EX-3` |
| el reembolso idempotente devuelve **`200` y no `201`**, con **cuerpo vacío** | `RF-6` |
| `X-Idempotency-Key` es obligatoria y falla **antes** de toda validación de negocio | `RF-4` |
| hay un **rechazo sin explicar**: sobre el mismo pago, ARS 5 se rechaza con `2084` y ARS 14 entra | `RF-8` |
| piso **ARS 15**, techo **ARS 2.000.000**, con los mensajes exactos | `PC-2` |
| otra moneda da `400` | `EX-18` |

**El retraso variable del cobro merece su propia línea** porque es el que más código rompe: un
test cuyo cobro llega en el mismo instante en que vence el período **nunca ejecuta** el camino que
en producción se recorre siempre. El stub tiene que poder llegar tarde, y la suite tiene que
tener casos donde llega tarde.

### 3.3 Y de ahí sale qué es un escenario de carrera

El §62.1 pide cubrir *«races»* sin decir cuáles. Los seis cruces de concurrencia ya están
enumerados en el capítulo 05, y la lista de arriba agrega los que sólo existen porque el proveedor
se comporta así: el cobro que llega después de suspender, la mutación que se acepta y no se
aplica, el webhook que no llega nunca, y el cliente que recibe el correo del proveedor **antes**
que el nuestro.

---

## 4. La suite de sandbox es chica, y prueba otra cosa

El §62.3 la pide *«más pequeña pero obligatoria»* y dice que *«verifica assumptions e integración
real»*. Conviene ser exacto sobre qué significa eso acá, porque no es lo mismo que probar nuestro
código:

**la suite de sandbox es una suite de regresión sobre la matriz de validación, no sobre el
sistema.**

`S-METH-01` fijó que **toda medición caduca cuando cambia el hecho que mide**, y no hay forma de
enterarse de que el proveedor cambió salvo volviendo a medir. Las mentiras del §3.2 son el
contrato con el que está escrito todo el código de proveedor: **si una deja de ser cierta, el
stub queda mintiendo de una forma que el real ya no tiene, y toda la capa de dominio pasa a estar
verificada contra una ficción.**

Entonces la suite de sandbox corre **las filas de la matriz**, no los casos de uso. Es chica
porque son pocas filas las que sostienen decisiones, y es obligatoria porque es lo único que
convierte a `S-METH-01` de una advertencia en un control.

**Con dos límites que el capítulo 06 ya fijó y que valen igual acá**: guard de entorno y guard de
presupuesto — una sonda que pueda correr contra producción por error, o gastar más de lo
autorizado, no se ejecuta.

---

## 5. E2E: lo que hoy se hace a mano

El §62.4 lo dice sin ambigüedad: *«el objetivo es que cambios futuros no obliguen a repetir
manualmente todo billing»*. Los flujos críticos son los que mueven plata o cortan servicio:

1. alta y autorización de una suscripción, incluido **el checkout abandonado** que muere a las
   72 h (cap. 03, S3);
2. el ciclo completo de **impago**: cobro fallido → grace → suspensión → regularización;
3. **cambio de plan** y **cambio de ciclo**, que no son el mismo mecanismo (`DEC-SUB-006`,
   `DEC-SUB-007`, `DEC-SUB-008`);
4. **pausa** y reanudación, las dos formas: al vencer y anticipada;
5. **cancelación** con servicio sostenido hasta el fin del período (`DEC-SUB-009`);
6. **revocación**: reembolso total más cancelación en un solo acto (`DEC-RF-001`);
7. **trial** completo: activación, campaña previa, vencimiento, campaña de recuperación y
   conversión tardía;
8. **contratación y vencimiento de un addon**, con el excedente que dispara.

**Lo que E2E no reemplaza** es el smoke contra el proveedor real: el §62.3 existe porque el stub y
el real pueden divergir, y un E2E que corre contra el stub hereda esa divergencia entera.

---

## 6. Una regla que atraviesa las cuatro capas

**Ninguna aserción se escribe sobre un código de estado.** Está medido nueve veces que este
proveedor devuelve `2xx` sobre operaciones que no aplicó (`D5`, cap. 04). Un test que afirma
*«devolvió 200»* pasa exactamente igual con la operación aplicada y sin aplicar, que es la
definición de un test que no prueba nada.

**Se afirma sobre el estado releído**, campo por campo — que es la misma regla que el invariante
`D5` le impone al código de producción. El test y el sistema comprueban lo mismo de la misma
forma, y no por elegancia: si el test pudiera conformarse con menos, sería el test el que deja
pasar lo que el sistema no.
