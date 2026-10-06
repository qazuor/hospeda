---
title: "FASE 9-bis-5 · las instrucciones de la tanda de arreglos"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9
---

# FASE 9-bis-5 — instrucciones

**La tanda de arreglos de la quinta vuelta.** Cierra los **8 críticos** que la FASE 8-bis-5
dictaminó y los **6 defectos** que el censo de preguntas levantó.

**Corre EN SERIE, una familia por vez.** Las familias tocan los mismos capítulos —`B/03`,
`nucleo/01`, `V/02`— y dos agentes en paralelo se pisan. La 9-bis-4 corrió así y es la razón por la
que sus 76 commits son una secuencia limpia.

---

## 1. Las dos obligaciones, y una es nueva

### `DEC-METH-011` — el rastro por aparición es un ARCHIVO

Ya corrió una tanda entera bajo esta regla, con **cobertura 47 de 47** sobre los commits que editan
el corpus y **1.030 apariciones** justificadas. No es una regla nueva: es la que hizo bajar la serie.

1. **El alcance es TODO EL CORPUS y la unidad es el PÁRRAFO, no el archivo.**
2. **La resolución se escribe POR APARICIÓN, en un ARCHIVO**: `23-fase-9-bis-5/rastro-<sha>.md`, con
   archivo, §, la cita y **por qué sigue siendo correcta**, por cada aparición **no corregida** que
   vive en un párrafo que ninguno de los commits de la familia tocó.
3. **Se grepea el término NUEVO y el VIEJO**, con y sin backticks.
4. **La obligación alcanza a TODO commit que edite el corpus**, incluidos los de decisiones del
   owner.

### `DEC-METH-012` — la justificación cubre el CUANTIFICADOR de la cita — **NUEVA**

Salió de medir esta última tanda: **la regla llegó al lugar correcto en 4 de los 6 críticos
atribuidos y resolvió mal**. No es que no se ejecutara: la aparición estaba en el rastro, recorrida,
con justificación escrita, y la justificación era falsa.

> **La justificación de cada aparición responde por la cláusula entera que cita —su cuantificador
> incluido— y no afirma nada que no esté verificado en la cita misma.**

**La forma operativa, que sale de las cuatro que fallaron**: ⚠️ **la justificación NO puede empezar
con *«lo que cambió es…»***. Las tres del modo por delta empiezan así —*«lo que cambió es de dónde se
lee»*, *«lo que cambió es el motivo»*, *«lo que cambia es el alcance del remedio»*—. **Nombrar el
cambio y descartarlo en la misma frase es la firma del modo.**

Las dos formas de fallar, para reconocerlas mientras escribís:

| modo | qué pasa | ejemplo medido |
|---|---|---|
| **dice MENOS que la cita** | verificás un sujeto más angosto que el que la cita cuantifica | se verificó que **los tres avisos estuvieran**, no que **los lectores fueran cinco** |
| **dice MÁS que la cita** | le agregás una garantía que nadie verificó, y esa cláusula cierra el caso en falso | *«…y ahora esa ficha **además tiene cómo volver** cuando el cupo se libere»* |

**La forma correcta no hay que inventarla**: copiala de las dos líneas del 2 % bueno de la tanda
anterior — *«la cláusula que la salva es la que ella misma escribe»*
([`../21-fase-9-bis-4/rastro-f21d5d828.md`](../21-fase-9-bis-4/rastro-f21d5d828.md) sobre `B/02`
§2.2, que además **enumera los seis sitios que deliberadamente no tocó y por qué**) y *«si alguna se
hubiera escrito como «el último» o «de seis», sería falsa»*
([`../21-fase-9-bis-4/rastro-032f761e0.md`](../21-fase-9-bis-4/rastro-032f761e0.md) sobre los
ordinales del espejo).

### Lo que las dos reglas NO cubren, declarado

- **La caducidad**: una línea verdadera el día que se escribe y falsa por un commit POSTERIOR de la
  misma tanda. **Fueron 6 de las 16 falsas.** El owner decidió no agregar el barrido que la
  detectaría (`DEC-METH-012`, riesgo aceptado). **Si tu familia invalida una línea de un rastro
  anterior —propio o de la 9-bis-4—, decilo en tu §5**, que es como se detectaron las seis.
  ⚠️ Y si se te ocurre detectarlas con `git log -S` sobre la cita: **está medido que no funciona**,
  devuelve cero. La caducidad no cambia la cita, cambia lo que la hace verdadera, que vive en otro
  archivo.
- **La prosa que el propio commit escribe o edita** (2 de 6).
- **La aparición que vive FUERA del corpus** — en el decision log, que el alcance excluye por
  definición. Es el cuarto desenlace, descubierto en la 8-bis-5.

---

## 2. Qué hay que cerrar

### 2.1 Los ocho críticos

Mapa completo con su deduplicación en
[`../22-fase-8-bis-5/C1-la-costura.md`](../22-fase-8-bis-5/C1-la-costura.md) §2.2.

| # | qué se rompe | IDs | de dónde salió |
|---|---|---|---|
| **1** | **`G-R3` sólo sabe prohibir**: nada exige que la versión de piso OTORGUE sus tres cosas, y la defensa entera del hard delete del día 180 cuelga de una fila de catálogo cuya ausencia no ve ningún guard | `F-8fA1-001` + `F-8fA1-002` (`ALTA`) | la retención + `DEC-TEST-001` |
| **2** | **El hard delete relee la cobertura en UNA línea de seis**: con el aviso perdido —el modo de falla que el propio diseño declara— se borra el contenido de un cliente que ya volvió | `F-8fA2-001` | la retención (`5ac5e92c9`) |
| **3** | **El hecho 2 está enunciado como CAMBIO y ejecutado como ESTADO**: el guard se pone en rojo sobre el arreglo y no sobre el defecto | `F-8fA3-001` + `F-8fA3-004` (`ALTA`) | la retención + 3ª enmienda de `DEC-TEST-001` |
| **4** | **El tope de `MP4` deja la fecha en el instante de la reactivación y `MP5` dispara en el acto**: el que vuelve paga el período que pasó suspendido **y** el que arranca, y `S4` lo devuelve al grace el mismo día | `F-8fB1-001` + `F-8fB1-004` (`ALTA`) | el pagador manual |
| **5** | **`PAGO_TARDÍO_RECHAZADO` entra al catálogo con *«¿hay plata que devolver? no»*** y sus cuatro condiciones sólo fallan cuando la plata ya entró; y el mismo hecho tiene dos motivos declarados en el mismo capítulo | `F-8fB1-002` | la sucesión |
| **6** | **Una marca por `(fila, motivo)` y UNA FK al pago**: del segundo cobro en adelante la plata queda sin fila que la nombre, y quien hace bien su trabajo cierra el caso con el resto adentro | `F-8fB2-001`, `F-8fB3-002` + `F-8eB1-004` (`ALTA`) | la sucesión + `DEC-RF-003` |
| **7** | **`charged_quantity` cuenta INTENTOS**: `B/09` §4 concluye *«sí cobró»* sobre una suscripción que no cobró un peso, y es la regla de la cuarta de las cinco comparaciones del barrido | `F-8fB3-001` | **`RC-5`**, medido en producción. **No lo introdujo ninguna tanda** |
| **8** | **La dirección inversa del contrato no la construye ninguna de las 22 unidades**: la regla que decide *«qué se le cobra a alguien y qué día»* vive en la última unidad y el cambio de plan lo construye la octava | `F-8fC2-001` + `F-8fC2-003`, `F-8fC1-002` (`ALTA`) | **anterior a la tanda** (18-19/09) |

### 2.2 Los seis defectos del censo

De [`../22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md`](../22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md).
Estaban escritos como preguntas al owner y **no eran preguntas**.

| id | sev | qué se rompe |
|---|---|---|
| **`I1`** | `ALTA` | `G-R6` exige que *«al menos una transición del corpus»* escriba cada columna leída, y el corpus se construye por partes: la fecha del próximo cobro la escribe `S10` (unidad `B8`) y la lee una condición de `B5`. **El guard nace en rojo sobre el camino normal durante `B5`→`B7`→`B8`**, y quien se choque con ese rojo lo va a relajar |
| **`F3`** | `ALTA` | `B/10` §4.3 **ordena** mandar a `CANCEL_SCHEDULED` cada suscripción viva de una vertical discontinuada y **ninguna transición numerada lo ejecuta**. Falta una fila en `B/03` §3.2 |
| **`E2`** | `MEDIA` | *«otorgar un grant termina cualquier cortesía vigente»* lo hace **cancelando la suscripción que la pausaba**, y sobre una cortesía **diferida** no hay suscripción que cancelar |
| **`H2`** | `MEDIA` | `G-R6-B` vigila que no haya intrusos pero **no comprueba que sus lectores declarados sigan existiendo**: el día que el hard delete deje de leer `inactiva_desde`, el guard sigue verde |
| **`I2`** | `MEDIA` | la tabla de los trece motivos de la marca (`B/02` §2.5) **no es capítulo de ninguna unidad** y `G-R1-F` la lee. Unidad candidata identificada: `B3` |
| **`I3`** | `MEDIA` | los inventarios de `NUCLEO/01` §2.4/§2.5/§2.6 tampoco, y `G-R1-E`/`G-R1-F` los cuentan. **Segunda vuelta reportado** (`F-8dC2-002`) |

### 2.3 Las cuatro decisiones nuevas, que hay que implementar en los capítulos

| decisión | qué hay que escribir |
|---|---|
| **`DEC-GRANT-011`** *(el saldo que nadie completó)* | al vencer la ventana de autorización (`S3` → `ABANDONED`), **la misma transición cierra el `courtesy_grant` diferido**, con su motivo asentado como toda revocación desde `DEC-GRANT-008` |
| **`DEC-GRANT-012`** *(la cortesía se muestra con su condición)* | una fila de copy en `B/19` §3: *«te quedan N días, que empiezan a correr cuando completes el pago»*, atada al `saldo_días` de `courtesy_grant`. **Y el aviso del CIERRE, que no está escrito en ningún capítulo** |
| **`DEC-MP-003`** *(la pausa del proveedor)* | el motivo **`PROVIDER_DUNNING`**: el espejo del §10.1 lo escribe en lugar de `CUSTOMER_REQUEST`, los motivos pasan de dos a tres, y **todo lo que lee el motivo de pausa hay que recorrerlo** — `puedePausar()`, los topes del §26, y las salidas `S10`, `S22`, `S25` y `PB*`. ⚠️ **La mitad que decide qué hace el dunning con esa fila ESPERA la sonda 49** |
| **`DEC-MP-004`** *(el alta rechazada)* | el mensaje se deriva del `status_detail`, con mapa explícito y genérico obligatorio. **`RC-6` midió que el `status_detail` cambia entre intentos**: en el alta no molesta, en una renovación sí, y el mapa no debe leerse temprano |

**Las dos `DEC-MP-*` no tienen HOY ninguna línea en los capítulos** — sus commits tocan sólo el log.
Medido el 2026-09-22.

---

## 3. El orden, y por qué

**En serie. Una familia, su rastro, y recién después la siguiente.**

| # | familia | cierra | espera |
|---|---|---|---|
| **1** | **la retención y el piso** | críticos #1, #2, #3 · `H2`, `I1` | — |
| **2** | **el pagador manual** | crítico #4 | — |
| **3** | **la marca y los motivos** | críticos #5, #6 · `I2` | — |
| **4** | **la cortesía diferida** | `DEC-GRANT-011`, `DEC-GRANT-012` · `E2`, `F3` | — |
| **5** | **la dirección inversa y las unidades** | crítico #8 · `I3` | — |
| **6** | **la conciliación y el contador** | crítico #7 | ⏳ **la sonda 49 del 24/09** |
| **7** | **la pausa del proveedor** | `DEC-MP-003`, `DEC-MP-004` | ⏳ **la sonda 49 del 24/09** |

**Las familias 6 y 7 esperan al 24/09 a propósito.** La sonda 49 decide si la ventana de reintentos
del proveedor es **fija de 24 h** o es **el ciclo**, y de eso dependen dos cosas: la mitad de
`DEC-MP-003` que dice qué hace el dunning con la fila pausada, y —según `C1`— **si `RC-5` es un
crítico o dos**, porque `B/09` §4 y la ventana de reintentos leen el mismo objeto. Escribirlas antes
es escribir sobre un diseño que el dato puede dar vuelta, que es exactamente lo que `DEC-MP-003`
evitó al declararse a medias.

---

## 4. Cómo se escribe un rastro

Un archivo por familia: `23-fase-9-bis-5/rastro-<sha-del-último-commit>.md`, con frontmatter
(`title`, `linear: HOS-1352`, `statusSource: linear`, `created`, `updated`, `status: CURRENT`,
`fase: 9-bis-5`) y esta estructura, que es la que la 9-bis-4 consolidó:

1. **Los commits** — tabla sha → qué cierra.
2. **Qué se arregló**, una frase por cambio.
3. **Qué se grepeó** — los términos nuevos **y los viejos**, con y sin backticks, y sobre qué alcance.
4. **Las N apariciones no corregidas, una por una** — archivo, §, cita, **por qué sigue siendo
   correcta** bajo `DEC-METH-012`.
5. **Premisas ajenas que el arreglo volvió falsas y se corrigieron en el mismo acto.**
   ⚠️ Esta sección es **la más falsable del rastro** y por eso la más auditada: declara
   *«corregí X en el archivo Y §Z»*, que se verifica con un `rg` y sin razonar. En la 8-bis-5 una de
   sus filas resultó **ejecutada a la mitad** (2 de 6 apariciones). **Si declarás una corrección,
   ejecutala entera.**
6. **Lo que este rastro vuelve falso de los anteriores**, propios o de la 9-bis-4.
7. **Preguntas para el owner**, si quedan.
   ⚠️ **Y si dejás una, decilo en tu respuesta.** La tanda anterior dejó 33 repartidas en once
   documentos y **ninguna llegó a ningún registro**: 11 seguían abiertas dos días después, y dos de
   ellas eran decisiones que costaban plata. **Una pregunta escrita en un rastro no es una pregunta
   hecha.**

---

## 5. Reglas duras

- **El PDR (`00-PDR.md`) no se edita NUNCA.**
- **La matriz (`06-mp-validation-matrix.md`) y el decision log no se tocan sin consultar al owner.**
- **No edites los informes de la 8-bis-5 ni los rastros de la 9-bis-4.**
- **Los conteos se cuentan**, y **un número que no mediste vos lleva su fuente**. Hoy el log tiene
  **92 decisiones** (93 encabezados `### DEC-` menos la plantilla), **12 de metodología y 80
  funcionales**. La matriz tiene **89 filas** — 50 `VERIFIED`, 13 `PARTIALLY_SUPPORTED`, 20
  `NOT_SUPPORTED`, 6 `UNKNOWN` — contadas con `contar-filas-de-la-matriz.py`.
- **Un conteo congelado que tu arreglo mueve se RECUENTA entero, no se le suma uno.** El censo de
  `F-8fC1-004` midió **25 conteos congelados y 14 falsos**, y 12 de los 14 viven **fuera** del
  documento dueño del conjunto.
- **Grepeá siempre con y sin backticks**, y acordate de que **`rg -r` es replace, no recursivo**.
- **Medí siempre sobre este worktree**, nunca sobre el clone principal.
- **Sin código productivo hasta FASE 10.** Esta fase escribe diseño.
- **commitlint**: subject en minúscula, sin empezar con identificador en mayúsculas. Stageá archivo
  por archivo. Sin atribución de IA.
- **markdownlint**: cuidado con MD028, MD036 (un párrafo en negrita solo no es un encabezado) y
  MD056. Escapá los pipes de una cita con tabla adentro como `\|`. **El pre-commit corre
  `markdownlint --fix` y REESCRIBE el archivo**: releé justo antes de cada `Edit`.
- Todo en **español**, con acentos.
