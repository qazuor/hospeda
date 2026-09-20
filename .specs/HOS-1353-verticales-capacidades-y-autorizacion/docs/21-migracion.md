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

### 2.4 Cómo amanece la población existente: se le siembra el trial

**El programa nunca preguntó esto, y la respuesta por omisión era mala.** Sin fila de `trial`, el
estado es `PRE_TRIAL` por construcción —*«`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene»*
(`V/03` §2)—, así que **el 100 % de los usuarios de producción amanece ahí**. Y el evento que los
sacaría **ya ocurrió**: `T1` dispara con *«la ficha queda publicada»*, que es la **transición** de
publicar, y **sus fichas ya están publicadas**.

**Qué pasa sin hacer nada, y ahora está determinado.** `PRE_TRIAL` **no cubre** —un reloj que no
arrancó no es un título (`12-contrato…` §2.4)— y `PB2` se dispara **por el cambio de `cubierto`**
(`V/03` §9), así que **las doce fichas del catálogo se despublican la mañana del corte**. No es una
ambigüedad entre dos ramas: es una consecuencia.

> **A cada dueño con ficha publicada se le siembra una fila de `trial` en `TRIAL_ACTIVE`, con los
> días que declare el plan de trial de su vertical.**

**Por qué el trial y no otro instrumento.** Es exactamente para lo que existe: **probar antes de
pagar**, que es la situación real de esa gente. La cortesía temporal no sirve —presupone una
suscripción, es una pausa sobre algo que se está cobrando, y ellos no tienen ninguna— y el *Free
Forever* es permanente, que no es lo que se quiere. Inventar un tercer instrumento para doce fichas
sería el tipo de mecanismo que el §56 pide no construir.

**Y no regala nada, y eso está medido**: **no hay un solo pago en la historia del sistema**. Nadie
estuvo pagando, así que esto no les devuelve un trial que ya hubieran consumido — **es el
onboarding normal, aplicado a gente que ya estaba**.

**Los días salen del plan, no de un número nuevo.** `DEC-TRIAL-003` ya fija que los días de trial
son configuración del plan por vertical; elegir un valor aparte para esta cohorte crearía un
segundo número que se desincroniza del primero.

**Lo que esto ejercita, y es la mitad del valor**: al vencer, `T3` dispara y el sistema hace lo que
tiene que hacer — o contratan, o se despublican. **El primer mes del sistema nuevo recorre el ciclo
completo** en vez de saltearlo, que es cuando más conviene descubrir si algo de ese camino falla.

**Y no contradice *«no se hereda ninguna fila»*, por la misma razón que la lápida del `B/21` §2.5**:
no transcribe estado viejo —no copia duraciones, ni fechas, ni lo que la persona tenía—, **crea
estado nuevo** para que el sistema arranque coherente. La regla que sigue en pie es la que importa:
**ninguna fila viva del sistema viejo pasa al nuevo**.

**Dónde se ejecuta**: es el paso 4 del orden del corte
([`16-fase-7-del-paraguas.md`](../../HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md)
§4.2), junto con las lápidas, y por el mismo motivo — la fila es del esquema nuevo.

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
