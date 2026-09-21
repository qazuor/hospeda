---
title: Master Spec 21 — Migración
linear: HOS-1353
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

Mitad **VERTICALES** del capítulo 21 del programa. La otra mitad vive en la otra épica.

Este capítulo es corto por una razón que está medida: **no hay casi nada que migrar.**

Los tres huecos que cierra se contestan con el mismo número, y el número no se hereda del PDR:
se midió, y se re-midió al escribir este capítulo.

---

## 2. El trial ya consumido · cierra `M-MIG-01`

### 2.1 La pregunta ya no tiene sujeto: NO SE MIGRA

`M-MIG-01` preguntaba si alguien que consumió un trial bajo reglas distintas —otro alcance, otra
duración, otro disparador— arrastra el consumo al modelo nuevo. **La pregunta se disuelve porque
no se transcribe ninguna fila.**

> **El sistema nuevo no hereda una sola fila. Las ocho suscripciones vivas se cancelan, y quien
> tenga algo vivo se suscribe de nuevo.**

### 2.2 Qué hizo posible la decisión, y no fue un criterio técnico

Hasta que el owner aportó el dato, nadie sabía **de quién eran las ocho**. Con eso:

| las ocho | quiénes son |
|---|---|
| **2 `comp`** | **del propio owner.** No hay un cliente real detrás de ninguna |
| **3 `abandoned`** | no tienen **nada vivo** que migrar: abandonaron el checkout |
| **3 `trialing`** | clientes reales, **y contactables** — el owner puede hablarles para que se resuscriban |

Las tres `trialing` son las **únicas** con preapproval vivo (medido: 3 de 3, y ninguna de las otras
cinco), y sobre ellas se apoyaba **todo lo pesado** de la migración: el punto de no retorno, el
orden forzado y la ausencia de rollback. **Con las ocho recuperables por teléfono, esa carga no
tiene sujeto.**

### 2.3 Qué cuesta cada camino, y qué se pierde exactamente

| | |
|---|---|
| **migrar** | escribir una unidad de trabajo nueva, el orden forzado, el punto de no retorno **por fila**, y aceptar que el rollback no existe pasado cierto paso |
| **no migrar** | **tres llamadas** y dos cuentas propias |

**Qué se pierde, medido:**

- **Nada de plata.** No hay **un solo pago histórico**: ningún comprobante, ninguna serie que
  reconstruir.
- **El «trial ya consumido» de seis personas** —las tres `abandoned` y las tres `trialing`—, que
  sin migrarlo **podrían repetir trial**. Son seis personas conocidas, y tres ya habían abandonado
  el checkout igual.

**El argumento de fondo no es de pereza**: se estaba construyendo una migración para **ocho filas
sin un solo pago, todas de gente a la que se puede llamar**. Diseñarla, revisarla, ejecutarla y
garantizar su rollback es desproporcionado frente a un mensaje. Y el beneficio extra es real: **el
sistema nuevo arranca sin una sola fila heredada** —sin transcripciones, sin estados viejos, sin
dudas sobre si algo quedó mal migrado—. Es el escenario más limpio posible, y **sólo está
disponible ahora**, mientras son ocho.

### 2.4 Cómo amanece la población existente: se despublica, y se la llama

**El programa nunca preguntó esto.** Sin fila de `trial`, el estado es `PRE_TRIAL` por
construcción —*«`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene»* (`V/03` §2)—, así que **el
100 % de los usuarios de producción amanece ahí**. Y el evento que los sacaría **ya ocurrió**: `T1`
dispara con *«la ficha queda publicada»*, que es la **transición** de publicar, y sus fichas ya
están publicadas.

**Y la guarda nueva del par `T1`/`T6` no cambia esta conclusión, que es lo que hay que
verificar.** Desde que `T1` exige `cubierto` **falso** y `T6` lo exige **verdadero** (`V/03` §2),
el mismo evento podría mandar a alguien a `TRIAL_CONVERTED` en vez de a `TRIAL_ACTIVE`. **La
conclusión se sostiene, pero por el argumento del párrafo de arriba y no por `cubierto`: el evento
ya ocurrió, así que la mañana del corte no dispara NINGUNA de las dos.** Nadie publica una ficha
que ya está publicada, y sin evento no hay transición — para las ocho filas por igual. `T7`
tampoco: Alojamiento ya tiene sus días de trial en `> 0` y el corte no enciende nada.

**Dos correcciones sobre esta misma verificación, porque razonaba sobre el conjunto equivocado:**

1. **No es cierto que «nadie tiene un título vivo».** Las ocho suscripciones se cancelan (§2.1),
   sí, pero la otra mitad del corte **escribe dos `permanent_grant`** en el mismo acto —las dos
   cortesías del owner, `B/21` §2.4— y un `GRANT` con `hasta: NO_VENCE` es de clase **`TÍTULO`**
   (`12-contrato…` §2.4). Para esas dos cuentas `cubierto` es **verdadero** en cuanto el grant
   existe. No cambia lo de abajo —no dispara ninguna transición—, pero sí cambia **cuál
   dispararía** el día que publiquen algo nuevo, y eso es el punto 3.
2. **Y por eso `PB2` tampoco las alcanza.** Con `cubierto` verdadero no hay cambio de cobertura
   que despublique nada: **lo de abajo vale para seis de las ocho**, no para las ocho.
3. **El orden entre la escritura de los dos grants y el paso 4 no está fijado en ningún lado, y
   hay que fijarlo en el procedimiento del corte.** Si los grants se escriben **antes**, esas dos
   cuentas nunca pierden cobertura; si se escriben **después**, pasan por una ventana con
   `cubierto` falso en la que `PB2` les baja las fichas y `PB3` se las devuelve. Las dos ramas
   terminan igual y el residuo es una despublicación visible de minutos sobre dos cuentas del
   owner: **es un orden que hay que escribir, no una decisión de diseño**.

**Lo que este § NO decide es qué pasa con el trial de esas dos cuentas.** Cubiertas por un grant,
el día que publiquen una ficha dispara **`T6`** y su fila de `trial` nace **consumida**; y si ese
grant se revocara alguna vez, quedarían sin grant y sin el trial que nunca usaron. Eso es un
defecto de la máquina de trial, no del corte, **está abierto y lo decide el owner**. Acá sólo se
declara que el corte pone a dos cuentas en esa posición, y que las dos son suyas y *«regenerables
de cero»* (`B/21` §2.4) — que es lo que lo vuelve tolerable mientras se decide.

**Qué pasa entonces, y está determinado.** `PRE_TRIAL` **no cubre** —un reloj que no arrancó no es
un título (`12-contrato…` §2.4)— y `PB2` se dispara **por el cambio de `cubierto`** (`V/03` §9), así
que **las fichas publicadas de Alojamiento se despublican la mañana del corte**. No es una
ambigüedad entre dos ramas: es una consecuencia.

> **Y eso es lo que se hace: se despublican. No se siembra nada.** Se les avisa **antes** del corte,
> se los llama, contratan, y la ficha vuelve sola por `PB3` cuando la cobertura vuelve.

**Y vuelve sola aunque la llamada tarde.** El procedimiento depende de que alguien llame, así que
puede pasarse del día 90: ahí `PB4` archiva la ficha y la que la devuelve ya no es `PB3` sino
**`PB7`**, con el mismo disparador y el mismo desenlace (`V/03` §9). No cambia el resultado, sino
**de qué fila depende** — y conviene decirlo porque antes de la 9-bis-3 `PB7` no existía, así
que una demora de tres meses en la agenda de llamados convertía *«vuelve sola»* en un incidente
por cada cuenta.

**Por qué no sembrarles un trial, que era la alternativa.** Habría dejado las fichas arriba mientras
contratan, y **no cuesta menos: cuesta lo mismo más una siembra.** A esta gente **hay que llamarla
igual** —es lo que decide todo este capítulo: son pocos, la mayoría **no pagó nunca**, y el owner
**los conoce a todos**—, así que la siembra no ahorra una sola conversación. Agregar filas para
evitar un efecto que la llamada ya resuelve es el mecanismo que el §56 pide no construir: *«no
contaminar la arquitectura nueva para salvar unas pocas relaciones legacy»*.

**Qué se pierde, dicho sin adornos**: la ficha de cada uno está abajo **desde el corte hasta que esa
persona contrata**. Si alguno tarda una semana, estuvo una semana afuera. Lo que lo acota es que el
aviso va **antes** del corte, no después.

**Y qué se gana, que no es sólo ahorrarse la siembra**: el camino de vuelta —perder la cobertura,
recuperarla, y que la ficha se republique sola— **se ejercita el primer día**, sobre un puñado de
casos conocidos y con el owner al teléfono. Es exactamente cuando conviene descubrir que falla, si
falla.

**Consecuencia sobre la regla del capítulo, y es limpia**: del lado de verticales **no se escribe
ninguna fila**, así que *«el sistema nuevo no hereda una sola fila»* sigue siendo literal acá. La
única excepción del programa es la lápida del `B/21` §2.5, y tiene su razón propia — hace
reconocible un cobro viejo, que ninguna llamada puede evitar.

### 2.5 La condición de caducidad, que es lo único que hay que vigilar

> ⚠️ `DEC-MIG-002` decidió **seguir tomando altas durante el rediseño**, así que la cartera crece.
> Con ocho filas *«no migrar»* son tres llamadas; **el umbral medido está en unas veinte**, y
> arriba de eso deja de ser viable.

El aviso que el owner ya se comprometió a dar —*«si veo que empiezan a entrar registros nuevos, te
aviso»*— **ahora tiene una consecuencia concreta: hay que volver a discutir esta decisión.**

---

## 4. Lo que NO se migra, y no es una omisión

- **Gastronomía, experiencia y partner**: cero filas. El rediseño de esas tres verticales no
  toca un solo dato existente.
- **`commerce`**: el §55 ordena eliminarlo de fuentes activas, con la excepción histórica del
  §55.1 —auditoría, historia de migraciones, entender datos legacy— **marcada inequívocamente**.
  Eso es trabajo de FASE 5 y de código, no de datos.

---

## Lo que este capítulo NO cierra

- **Cómo se le avisa a las tres personas y cuándo se cancelan sus suscripciones** es FASE 7: acá
  está que no se migra, no el procedimiento de la conversación.
- **La clasificación del código legacy** en reusar o reescribir tiene su propio gate
  (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.
