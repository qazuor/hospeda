---
title: Master Spec 21 — Migración
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 21
cierra:
  - M-MIG-01
  - O-MIG-01
  - R-MIG-01
---

# 21 · Migración

Mitad **BILLING** del capítulo 21 del programa. La otra mitad vive en la otra épica.

Este capítulo es corto por una razón que está medida: **no hay casi nada que migrar.**

Los tres huecos que cierra se contestan con el mismo número, y el número no se hereda del PDR:
se midió, y se re-midió al escribir este capítulo.

---

## 1. La premisa del §56, medida · cierra `O-MIG-01`

### 1.1 La objeción

El §56 razona: *«Como hay pocos customers actuales: si migrar automáticamente agrega mucha
complejidad/riesgo: preferir coordinación manual y nueva subscription»*. **La premisa —*«hay pocos
customers»*— es una afirmación sobre el estado real del sistema y el PDR no da el número.** Toda
la preferencia por la coordinación manual descansa ahí, y también el tamaño del riesgo de
`R-MIG-01`.

`O-MIG-01` pedía **medirla, no heredarla**. Es el §61 aplicado al propio PDR.

### 1.2 Está medida, y la premisa es cierta por mucho

Medición de producción del **2026-09-15**, sólo lectura
([`07-facts-inventory.md`](../../HOS-1352-billing-verticals-redesign/docs/07-facts-inventory.md)), **re-verificada el 2026-09-17 a las 12:52
`-03`** con la consulta 2 de ese documento, **sin un solo cambio**:

| | |
|---|---|
| **pagos registrados en toda la historia** | **0** |
| suscripciones vivas | 8, **todas mensuales** |
| con compromiso de cobro vivo | **3** (`trialing`, alojamiento) |
| cortesías sin vínculo con el proveedor | **2** (`comp`) |
| gastronomías · experiencias · partners | **0 · 0 · 0** |

**«Pocos customers» son tres compromisos de cobro y cero pagos cobrados en la historia del
sistema.** No hay historial de pagos que preservar, y tres de las cinco verticales no tienen un
solo dato: su rediseño no arrastra deuda de datos, sólo de código.

**`DEC-MIG-001` queda apoyada en una premisa verificada**, no en una heredada. La objeción se
cerró midiendo, que es la única forma en que se cierra una objeción de este tipo.

### 1.3 Y caduca

`S-METH-01`: esta medición vale mientras el hecho no cambie, y **este hecho cambia solo** — el
2026-09-26 (§3). Se re-verifica antes de implementar nada de FASE 10, con la consulta que el
inventario deja escrita.

---

## 3. El cobro durante el rediseño · cierra `R-MIG-01`

### 3.1 El hueco cambia de forma cuando se lo mide

`R-MIG-01` lo planteaba así: *«si hay débitos automáticos activos, siguen corriendo durante todo
el programa»*, y lo llamaba **el riesgo operativo más grande del programa**.

**No hay débitos corriendo.** Cero pagos en la historia del sistema. Lo que hay son **tres
compromisos que todavía no cobraron**, con fecha:

| compromiso | primer cobro |
|---|---|
| 1 | **2026-09-26** |
| 2 | 2026-11-25 |
| 3 | 2026-11-30 |

### 3.2 Y entonces son tres problemas distintos, no uno

**(a) Las ocho relaciones vivas.** No hay nada que parar ni que coexistir, y **tampoco nada que
transcribir**: **no se migra ninguna** (§2.4). Las tres `abandoned` no tienen nada vivo, las dos
`comp` son del owner, y las tres `trialing` son clientes contactables que se resuscriben. Ninguna
de las tres opciones que el hueco planteaba —coexistencia de dos motores, corte con migración
asistida, congelamiento— hace falta para éstas.

**(b) El 2026-09-26.** Esa fecha llega **durante FASE 2 o 3**, y la implementación está en FASE 10
(§65). O sea que **ese primer cobro de la historia del sistema ocurre bajo el sistema ACTUAL, no
bajo éste.** No es una pregunta de migración: es una operación que necesita a alguien mirándola el
día que pase. Este capítulo la registra con fecha para que no llegue por sorpresa.

**(c) Las altas nuevas.** Es lo único de los tres que sigue abierto, y **no lo cierra esta spec.**

### 3.3 Las altas nuevas son una decisión del owner, y se declara abierta

Qué pasa con quien se suscriba **mientras dura el rediseño** es una decisión comercial, no
técnica: congelar altas tiene costo de negocio, y no congelarlas agranda la cohorte que después
hay que transcribir a mano —que es precisamente lo que hoy hace barata a la opción (a)—.

Las tres opciones del hueco, con lo que cuesta cada una **dado el número medido**:

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **seguir tomando altas** en el sistema actual | ninguno comercial | la cohorte crece, y con ella se vuelve inviable *«no migrar»*: hoy son 8 y el umbral medido está en unas 20 (§2.4) |
| 2 | **congelar altas nuevas** hasta FASE 10 | comercial, y no es chico: tres verticales todavía no vendieron nada | cero cohorte nueva |
| 3 | **coexistencia de dos motores** | el más caro de construir | contamina la arquitectura nueva, que es lo que el §56 pide no hacer |

**No se completa en silencio** (§67). Queda declarada como decisión del owner en
[`04-open-decisions.md`](../../HOS-1352-billing-verticals-redesign/docs/04-open-decisions.md) — la única que este capítulo abre en vez de
cerrar.

---

### 2.4 No se migra: se cancelan las ocho y quien tenga algo vivo se suscribe de nuevo

> **El sistema nuevo no hereda una sola fila.**

La opción no existía hasta que el owner dijo de quién eran las ocho: **dos son suyas** —sin cliente
real detrás, regenerables de cero— y **las tres `trialing` son clientes contactables**. Las tres
`abandoned` no tienen nada vivo. La migración estaba bien resuelta; lo que cambió es que **dejó de
hacer falta**. El detalle del costo de cada camino y de qué se pierde está en el §2 de la mitad de
verticales.

**Las dos cortesías se escriben como `permanent_grant`, exactamente como el *Free Forever* del
diseño nuevo**, sin nada especial — y se pueden **regenerar de cero** si conviene. Es el
instrumento del diseño nuevo para *«esta persona tiene esto sin pagar, indefinidamente»*, y
converge con el grant anclado al plan del cap. 02 §2.4: **no hace falta inventar nada para
cortesías heredadas, son el caso normal**.

**Y esas dos filas cruzan la frontera, así que la mitad de verticales las tiene que ver.** Un
`GRANT` con `hasta: NO_VENCE` es de clase `TÍTULO` (`12-contrato…` §2.4), de modo que las dos
cuentas amanecen con `cubierto` **verdadero**: no las alcanza `PB2` y, el día que publiquen algo,
la transición que dispara es `T6` y no `T1`. La verificación completa —y el orden entre esta
escritura y el paso 4, que hay que fijar en el procedimiento— está en la mitad de verticales,
cap. 21 §2.4. Se dice acá porque **el efecto lo produce esta escritura y se observa allá**.

**Con una precisión que no es de forma: un ANCLA por cada vertical de su scope, sobre UNA sola fila
de grant.** Un grant ancla **un plan por vertical** (`12-contrato…` §2.8, `B/02` §2.4), porque un
plan pertenece a una sola. Las dos formas equivocadas quedaron descartadas por escrito y conviene
nombrar las dos: escribir **un grant con un plan** para un scope de dos verticales es el defecto
que el contrato cerró —*«la segunda vertical resolvería sus capacidades leyendo el plan de la
primera»*—; y escribir **dos grants** de una vertical cada uno es el otro extremo, porque revocar
pasaría a ser dos actos en vez de uno. Lo que se multiplica es la fila de
`permanent_grant_vertical`, **nunca la concesión**.

### 2.5 Cancelar no es olvidar: el compromiso viejo se conserva

**Ésta es la única fila que el sistema nuevo sí escribe**, y no contradice *«no se hereda ninguna
fila»*: no se hereda **nada vivo**. Lo que se escribe es una lápida.

> **El compromiso viejo se conserva como una `subscription` en `CANCELLED` con su `provider_link`,
> escrita DESPUÉS de cancelarlo en el proveedor.**

**Qué pasa sin ella, y es el caso que la justifica.** Las tres con preapproval vivo se cancelan en
el proveedor y no queda rastro. Si alguna emite un cobro después del corte —porque la cancelación
se aceptó y no se aplicó, o porque el cobro ya estaba en vuelo— **ese webhook llega como un
preapproval desconocido**, y el sistema nuevo tiene **un solo camino automático** para un
desconocido: re-vincularlo. El candidato más plausible del emparejamiento es **la suscripción nueva
de esa misma persona**, que acaba de contratar. **El cobro viejo se imputa como pago del ciclo
nuevo: pagó dos veces y el sistema registra una.**

Con la lápida, el barrido del cap. 09 **encuentra el id** y resuelve *«cancelado durante el
corte»* en vez de *«huérfana»*. Y **no compite por el candado del §11**, porque `CANCELLED` no está
entre los estados vivos (cap. 02 §2.2).

> **Y el barrido la recorre de verdad, que es lo que hacía falta decir.** La lápida es una
> `CANCELLED`, o sea un estado terminal, y *«los estados terminales de una suscripción no se
> barren»* la sacaba del barrido **en el mismo acto de escribirla**: el capítulo le atribuía a un
> mecanismo un trabajo que ese mecanismo tenía escrito que no hacía. La cubre la **salvedad 4**
> del cap. 09 §3, porque su preapproval lo canceló una llamada **nuestra, hecha a mano y sin
> nadie que verifique** ([`16-fase-7-del-paraguas.md`](../../HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md)
> §4.2), así que vuelve al barrido **hasta que la relectura la vea `cancelled`**. Es exactamente
> el caso que el párrafo de arriba describe —*«la cancelación se aceptó y no se aplicó»*—, y sin
> la salvedad el único aviso llegaba **después del cobro**, por la vía del webhook del §2.2.
>
> **La lápida es la única fila `CANCELLED` de todo el sistema que ninguna transición produce**, y
> eso no es exclusivo del corte: cualquier escritura manual futura hereda el mismo agujero. Por
> eso la exención del cap. 09 §3 quedó escrita como **criterio** —quién dejó al preapproval sin
> poder cobrar— y no como enumeración de transiciones: una fila que no nace de ninguna transición
> no aparece en ninguna enumeración de transiciones.

**El orden importa y es parte de la regla**: primero se cancela en el proveedor, después se
escribe. Al revés quedaría una lápida sobre un preapproval que sigue vivo, que es peor que no
tenerla — afirmaría que está cerrado algo que cobra.

> ⚠️ **Esta regla ya estaba escrita y no se aplicó.** Se decidió junto con el resto de la
> migración, y **al decidir que no se migra se la llevó puesta el mismo movimiento** — aunque no
> migra nada: sólo conserva el rastro de lo que se cancela. Es el modo de falla que conviene
> recordar: **una decisión que vuelve innecesario un trabajo puede llevarse algo que seguía
> haciendo falta.**

**Qué deja de existir con esto, y no es que se resuelva: se elimina.** La migración dejaba afuera
las relaciones con trial, transcribía un trial y dejaba los compromisos sin vínculo, tenía un punto
de no retorno sin lado elegido, describía dos operaciones distintas en dos lugares, y **nadie la
ejecutaba**. Los cinco problemas **pierden sujeto**, y la unidad de trabajo que iba a escribirla no
se crea.

**Lo único que sobrevive es de otro tamaño**: el **rollback del PROGRAMA** —qué se hace si hay que
volver atrás el reemplazo entero del sistema de cobro— que no es el rollback de ocho filas y no se
escribe acá.

---

## 4. Lo que NO se migra, y no es una omisión

- **Todo lo vivo**: ninguna fila se transcribe (§2.4). Lo único que se escribe es la lápida del
  §2.5, que no es una transcripción: es el rastro del id que se canceló.
- **Los pagos**: no hay ninguno.
- **`commerce`**: el §55 ordena eliminarlo de fuentes activas, con la excepción histórica del
  §55.1 —auditoría, historia de migraciones, entender datos legacy— **marcada inequívocamente**.
  Eso es trabajo de FASE 5 y de código, no de datos.

---

## Lo que este capítulo NO cierra

- **Qué pasa con las altas nuevas durante el rediseño** (§3.3): decisión del owner, declarada
  abierta.
- **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
  (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.
