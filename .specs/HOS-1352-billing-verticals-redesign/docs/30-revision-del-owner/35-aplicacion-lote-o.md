---
title: "Revisión del owner · el lote O de la verificación corta, en el diseño y en el log"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · el lote O de la verificación corta, en el diseño y en el log

Las dos letras del **lote O** de
[`32-decisiones-sobre-la-verificacion.md`](./32-decisiones-sobre-la-verificacion.md), que decidió
los dos ⚠️ que dejó [`34-aplicacion-lote-n.md`](./34-aplicacion-lote-n.md) §3 (N-A-1 y N-A-2),
aplicadas al diseño en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD
`222df18943` más la tanda de `34-`, sin commits. Las dos son la recomendada. Con la excepción que
dio el owner al lote N-J, que alcanza a lo que se deriva de N-A, **el log y la matriz se escribieron
en esta misma tanda** (§4).

Marcas en el diseño: *(verificación corta, 2026-09-29, lote O-letra)*. Abreviaturas como en `34-`:
`B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/16` la FASE 7 del paraguas, `$B/` y `$V/`
las raíces de las sub-specs. Las ediciones las hicieron reemplazos de ocurrencia única que abortan
si el ancla no es única; las citas de abajo las resolvió `aplic-35/cit.py` del scratchpad, que busca
cada frase en el archivo ya editado.

**Quedan dos decisiones para el owner** (§3), las dos de O-B: con qué código contesta el borde
cerrado, y qué pasa con lo que se pierda. No son de la letra, pero la letra pedía cuidarlas, y al
cuidarlas aparecieron dos premisas que no se sostienen tal como estaban escritas.

## 1. O-A · `U1`, la unidad del paraguas que hace la limpieza

### 1.1 El nombre

**`U1`.** Las unidades del programa son una letra y un número desde 1, con la inicial de su épica
(`V1`–`V9`, `B1`–`B13`). La del paraguas sería `P`, pero `P1`–`P4` son las transiciones del pago y
`P` prefija `PB` y `PP`: un `P1` de unidad se leería como una transición. Recorrí con `rg` las tres
carpetas del programa las familias `[A-Z]\d{1,2}`: la `U` no aparece nunca (tampoco `U0` ni `U1`),
así que no choca con nada ni reusa un número retirado. El `1` y no el `0`, porque cada familia de
unidades empieza en 1; `V0` o `B0` la hubieran metido en una épica que no es la suya.

- `D/16:539` «convención de las otras veintidós, una letra y un número desde 1»
- `D/16:542` «`U` no la usa ninguna familia de ids del programa»

### 1.2 Su fila, su criterio y sus guards

La fila vive en `D/16` §4.6, donde ya estaba la definición de la limpieza, porque el paraguas no
tiene descomposición propia; las dos descomposiciones la nombran y remiten ahí.

- La decisión, con el ⚠️ tachado: `D/16:535` «La hace `U1`, una unidad propia del paraguas, que hace sólo la limpieza»
- La fila: `D/16:549` «la limpieza del principio, y nada más»
- El criterio suma lo de *qué deja demostrado* y la ruptura a propósito de `G8`: `D/16:549` «y se rompe a propósito agregando la palabra en un archivo de código»
- Y el límite de la unidad: `D/16:549` «Ningún código nuevo: si el cambio escribe una pieza del diseño nuevo, no es esta unidad»
- La primera unidad del programa ya tiene nombre: `D/16:494` «La primera unidad de trabajo del programa, `U1`»

**Los guards: `G8` con `U1`, `G16` sigue en `B1`.** Pensado como pedía la letra. `G8` es un
recorrido de texto sin dependencias, y construirlo en el mismo cambio es lo que demuestra la
limpieza y lo que impide que `V1` o `B1` vuelvan a escribir la palabra. `G16` tiene dos predicados
y el (b) mira el package del cobro, que crea `B1`: partirlo lo volvería dos guards. El precio,
dicho en el diseño: entre `U1` y `B1` el predicado (a) no lo vigila nada automático, y el criterio
de `U1` lo comprueba una vez en su cambio.

- `D/16:551` «Por qué `G8` con `U1` y `G16` no.»
- `D/16:555` «Entre `U1` y `B1` el predicado (a) queda sin»
- En el catálogo de verticales: `V/20:56` «la unidad del paraguas que va antes de `V1` y de `B1`»
- En el recuento de billing: `B/20:392` «la unidad del paraguas que hace la limpieza del principio: verificación corta, 2026-09-29, lote O-A),»
- La columna de `V1` pierde `G8`: `$V/descomposicion.md:54` «`G8` pasó a `U1`, la unidad del paraguas que hace la limpieza del principio»
- El criterio de `V1` lo dice sin tacharlo, porque las cláusulas de `G8` tienen tachados adentro: `$V/descomposicion.md:566` «Las cláusulas de `G8` de este criterio son desde el lote O-A de `U1`»

### 1.3 Las dependencias, y por qué siguen siendo once

**`V1` y `B1` dependen de `U1`; `B2` la espera por `V2`.** Ninguna de las dos flechas es entre
épicas, porque `U1` no es de ninguna. **Verificado con recuento sobre la tabla de
`$B/descomposicion.md` §2.6**: filas 1 a 7 y 9 a 12, once; la 8 y la 13 están tachadas. Ninguna
fila de esa tabla nombra a `U1`, ni tiene por qué. (Ver §6: el recuento está bien, pero el texto del
mismo § dice algo que no entra en la tabla.)

- En `D/16`: `D/16:563` «No es una dependencia entre épicas**: `U1` no es»
- Verticales, la fila de *nada arranca antes que V1*: `$V/descomposicion.md:507` «depende sólo de `U1`, la limpieza del principio, que es del paraguas»
- Verticales, el grafo: `$V/descomposicion.md:495` «U1 (del paraguas: la limpieza del principio, lote O-A)»
- Verticales, el camino crítico: `$V/descomposicion.md:505` «`U1 → V1 → V2 → V3 → V4 → V5 → V6 → V8`»
- Billing, el § 3 con el ⚠️ tachado: `$B/descomposicion.md:646` «`B1` depende de `U1` y no de `V1`, y `B2` la espera por `V2`»
- Billing, el recuento: `$B/descomposicion.md:646` «filas 1 a 7 y 9 a 12; la 8 y la 13, tachadas»
- Billing, el grafo: `$B/descomposicion.md:649` «U1 (del paraguas: la limpieza del principio, lote O-A) ──► B1»
- Billing, el camino crítico: `$B/descomposicion.md:662` «`U1 → B1 → B3 → B5 → B7 → B8 → B9 → B10 → B13 → B12`»

### 1.4 Los espejos: las filas que nombraban la limpieza sin unidad, y las specs

- La fila de la limpieza en verticales: `$V/descomposicion.md:485` «**`U1`**, la unidad del paraguas, dueña de `G8`, que va antes de `V1` y de `B1`»
- La del archivo de planes en billing: `$B/descomposicion.md:640` «que borra el cobro viejo entero: **`U1`**, la unidad del paraguas (lote O-A)»
- El criterio de `B1`: `$B/descomposicion.md:782` «que hace `U1` antes de esta unidad, ningún `package.json` lo declara»
- `V/21` §4, las tres menciones de `V1` que eran de la limpieza: `V/21:529` «reescribe a»
- `V/21:534` «Lo construye ~~`V1`~~ **`U1`**, la unidad del paraguas»
- `V/21:534` «La hace `U1` (lote O-A).»
- La spec del paraguas, que decía que el paraguas no se implementa: `.specs/HOS-1352-billing-verticals-redesign/spec.md:19` «Salvo una unidad propia, `U1`, la limpieza del principio»
- Y su cierre: `.specs/HOS-1352-billing-verticals-redesign/spec.md:203` «que hace `U1`, la unidad del paraguas (lote O-A).»
- La de verticales, en la fila de `G8`: `$V/spec.md:403` «que hace `U1`, la unidad del paraguas, y construye este guard en el mismo cambio»
- La de billing, en `G16`: `$B/spec.md:108` «(`U1`, la unidad del paraguas: lote O-A) lo saca antes de `B1`»

### 1.5 Donde se cuentan unidades

**22 → 23** en los dos párrafos que reparten los guards entre las unidades (las dos
descomposiciones, §4). Las otras menciones de *«22 unidades»* (`$V/descomposicion.md` §2.9,
`nucleo/01`, el log) cuentan un hecho de su fecha, *«no era capítulo de ninguna de las 22»*, y no se
tocan. *«Las nueve»* y *«las trece»* siguen siendo las de cada épica.

- `$V/descomposicion.md:529` «están repartidos entre las ~~22~~ **23** unidades»
- `$B/descomposicion.md:732` «repartidos entre las ~~22~~ **23** unidades»
- `D/16:544` «Con ella el programa tiene **23 unidades**»

## 2. O-B · la misma ruta, cerrada en el borde

### 2.1 Qué quedó escrito

**El receptor nuevo sirve `/api/v1/webhooks/mercadopago`**, con la marca `source_news=webhooks` en
la URL de Webhooks y sin ella en la de IPN, como hoy (releído en hospeda2 el 2026-09-29,
`apps/api/src/routes/webhooks/mercadopago/router.ts:86` y `:207`). No hay URL que apuntar en
ningún paso. **El borde la cierra antes de apagar el contenedor viejo** (paso 3, `DB-5`) y **la
abre al final del paso 4, con las lápidas verificadas**; el 4b queda en verificar, con la sonda de
Webhooks y el pago chico de IPN de N-D, sin cambios.

- El paso 3: `D/16:137` «Y la ruta del receptor nuevo es la misma que la del viejo, `/api/v1/webhooks/mercadopago`»
- El cierre: `D/16:137` «El borde (Cloudflare) cierra esa ruta antes de que se apague el contenedor viejo»
- El paso 4 la abre: `D/16:140` «Y, con las lápidas verificadas, abrir en el borde la ruta de avisos que cerró el paso 3»
- Y su razón: `D/16:140` «Y va con la ruta de avisos cerrada en el borde, y la ruta se abre recién con las lápidas verificadas»
- El 4b, que sólo verifica: `D/16:141` «sin apuntar nada, porque la URL no cambia»
- IPN, en el mismo 4b: `D/16:141` «Y el canal IPN, que queda activo, llega a la misma ruta, sin la marca de Webhooks, y tampoco se apunta»
- El ⚠️ de N-A-2, tachado: `D/16:141` «Y no hay rato en que la ruta no exista»
- El de `EX-46` en el 4b: `D/16:141` «El destino del reintento ya no es una pregunta»
- El párrafo de `DB-5`: `D/16:165` «Y el borde la cierra antes de apagar el contenedor»
- La ventana entre el 1 y el 3: `D/16:178` «—el reintento le llega ~~después del 4b~~ cuando el paso 4 abre la ruta en el borde»
- La fila de interruptores del §1: `D/16:51` «y el cierre de la ruta de avisos de los pasos 3 y 4»
- La herramienta del borde: `D/16:323` «y el cierre de la ruta de avisos** (pasos 3 y 4, y su inverso en la rama de aborto»
- El ⚠️ del § 4.6: `D/16:575` «se cerró sin mover la URL»
- Billing, el canal IPN en `B/06` §7: `B/06:537` «su URL no cambia en el corte: el receptor nuevo sirve la misma ruta que el viejo»
- Billing, la herramienta de lápidas en `B/21` §2.5: `B/21:190` «el borde abra la ruta de avisos, que el receptor nuevo comparte con el viejo y que el paso 3 dejó cerrada»
- `B/21:197` «la ruta no se abrió: lote O-B»

### 2.2 Qué contesta el borde cerrado

**Tiene que ser un código que el proveedor reintente, y el único medido es el `500`** (`WH-4`:
*«Reintenta ante un `500`»*). La regla de bloqueo de Cloudflare contesta `403` por defecto, y con
respuesta propia un código **entre 400 y 499**, desde el plan Pro (documentación de Cloudflare,
*WAF custom rules → Configure a custom response for blocked requests*, leída el 2026-09-29). Ningún
`4xx` está medido. **No lo elegí**: es la O-B-1 del §3. El diseño lo dice con su ⚠️.

- `D/16:137` «El borde cerrado tiene que contestar un código que el proveedor reintenta»
- `D/16:137` «la regla de bloqueo del borde contesta un `4xx`»

### 2.3 Cuánto puede durar cerrado

Con la escalera de `WH-4` (duplicado a +0,5 s; reintentos a 994–1224 s del duplicado, a unos
2107 s del anterior y a 21.870 s del anterior), un aviso emitido apenas se cierra la ruta tiene
**tres** reintentos después de abrir si el cierre dura menos de unos 16 minutos, **dos** si dura
menos de unos 50, y **uno** si dura menos de unas 7 horas; después del quinto no está medido.
El cierre dura el despliegue, el 3a, el 3b y el paso 4, y se mide en el ensayo del corte en
`staging`. **No escribí un techo**: fijar uno, y qué hacer si se pasa, sería una elección; las
cifras quedan a la vista.

- `D/16:137` «Por la escalera medida»
- `D/16:137` «El cierre dura lo que duran el despliegue, el 3a, el 3b y el paso 4»

### 2.4 Lo que el barrido cubre, y lo que no

**La letra dice que el barrido cubre lo que se pierda, y para esta población no es así.** Lo único
que puede perderse durante el cierre son los avisos de los ids del censo del 1b (el sistema nuevo no
tiene altas hasta el paso 5, y las sondas se crean en el 4b, con la ruta abierta), y sobre una
lápida del corte **el barrido no compara ni asienta los cobros del día del corte**: *«Sobre una
lápida del corte no se comparan los cobros del día del corte ni los anteriores»* (`B/09` §3), y
`B/21` lo dice en su punto (3): *«si el evento de ese cobro se pierde, tampoco queda el
`payment`»*. El detector del día siguiente lista las lápidas del corte **con** `payment`, así que
tampoco lo ve. Lo que `M-4` escribió, *«el barrido diario lo relee»*, releído contra esos dos
lugares, quiere decir que el barrido lo lee y no hace nada. Con el cierre la pérdida exige una
escalera cortada o un cierre de más de unas 7 horas, pero cuando pasa es invisible. **Es la O-B-2
del §3**; en el diseño va con su ⚠️, sin afirmar la cobertura.

- `D/16:137` «sobre el que el barrido no asienta nada»

### 2.5 La vuelta atrás

Las tres cosas que el corte cambió afuera de la base siguen siendo tres, dos distintas:

1. **(a) la ruta en el borde**, en vez de la URL de notificación: si el paso 3 la cerró, se abre
   recién con la imagen vieja desplegada y su webhook reencendido, verificada con una sonda como
   antes; si el paso 4 ya la había abierto, se vuelve a cerrar mientras se redespliega.
2. **(b) la sonda**, sin cambios.
3. **(c) el pago chico del 4b**, en vez de la URL de IPN, que ya no se apunta. **Derivado, y lo
   marco**: el pago de N-D es plata del owner que el corte movió afuera de la base, y el 4b que lo
   hizo pudo abortar antes de devolverlo. Antes de restaurar, se devuelve y se relee por id.

- `D/16:371` «(a) la ruta de avisos en el borde»
- `D/16:374` «si el paso 4 ya la había abierto, se vuelve a»
- `D/16:377` «No hay URL que devolver»
- `D/16:379` «(c) el pago chico del 4b»
- `D/16:366` «desde el lote O-B la tercera es el pago chico del 4b»

### 2.6 `EX-46`, sin sujeto

Nota en la fila, sin cambiar el estado (sigue `UNKNOWN`, y sigue entre las *«no se miden, por
decisión»* del script), y en sus tres espejos de billing.

- La matriz: `06-mp-validation-matrix.md:403` «Sin sujeto desde el 2026-09-29, con OK del owner»
- `B/06`: `B/06:447` «Y desde el lote O-B queda sin sujeto»
- `$B/descomposicion.md` §2.7: `$B/descomposicion.md:423` «Sin sujeto desde el lote O-B**: la URL no cambia en el corte»
- `$B/spec.md`: `$B/spec.md:273` «Sin sujeto desde el lote O-B»

## 3. Decisiones para el owner

**O-B-1 · Con qué código contesta el borde cerrado.** Juan tenía una suscripción del sistema viejo
cancelada en el 1b, y el proveedor aprueba su cobro en vuelo a las 10:05, con la ruta cerrada. Si
el borde contesta algo que el proveedor no reintenta, ese aviso no vuelve nunca y el cobro de Juan
queda sin asiento (y sin nadie que lo vea: O-B-2). El único código con reintento medido es el `500`
(`WH-4`), y la regla de bloqueo del borde sólo contesta `4xx`.

1. **Medir antes del corte que el proveedor reintenta un `4xx`** (el `403` por defecto, u otro de
   la respuesta propia), con la misma sonda y el mismo receptor compartido de `WH-4`, puesto en
   `fail` con ese código; una fila nueva de la matriz, condición del corte como `EX-42`. Costo:
   una medición de una hora (los dos primeros reintentos alcanzan) y una fila. Riesgo: si no
   reintenta, se cae a la 2 con el corte más cerca.
2. **Que el borde conteste `500`**, con algo que no sea la regla de bloqueo: un Worker de
   Cloudflare sobre esa ruta que contesta `500` mientras está activo, u otra regla del plan que
   permita un `5xx`. Costo: una pieza más del borde que se construye, se ensaya en `staging` y se
   verifica desde afuera el día del corte; sigue sin ser un interruptor en el código de ningún
   sistema. Riesgo: bajo; contesta exactamente lo que ya está medido.
3. **Aceptar el `403` sin medir.** Costo: ninguno. Riesgo: todo aviso del cierre depende de una
   conducta no medida del proveedor, que es lo que el programa evitó en todas partes.

**Recomiendo la 2**: descansa sólo en lo medido, y el Worker se ensaya como el resto del borde.

**O-B-2 · Lo que se pierde durante el cierre no lo ve nadie.** El mismo cobro de Juan: si su
escalera se corta, o el cierre dura más de unas 7 horas, el aviso no llega, y el barrido, que lee
sus registros de cobro todos los días, no compara ni asienta los del día del corte sobre una lápida
(`B/09` §3, `B/21` punto (3)). El detector del día siguiente lista sólo las lápidas **con**
`payment`. Hoy eso está aceptado por `G3-1` y `R2`, y `M-4` lo dio por cubierto.

1. **Dejarlo como está**, y corregir el texto: lo perdido cae en el punto (3), que el owner ya
   aceptó, y la frase *«el barrido lo relee»* se precisa a *«lo lee y no lo asienta»*. Costo:
   ninguno. Riesgo: un cobro sin asiento ni aviso, que sólo aparece si el cliente reclama.
2. **El detector del día siguiente lista también, por cada lápida del corte, los registros de
   cobro que el proveedor da aprobados y no tienen `payment`**, con la misma lectura que el barrido
   ya hace (`authorized_payments`), sin abrir marca ni asentar: una lista para quien opera el
   corte, como la de las lápidas con `payment`. Costo: una consulta más en la herramienta de
   `B11` y una línea en su criterio. Riesgo: bajo; no toca la regla de `G3-1`.

**Recomiendo la 2**: convierte una pérdida invisible en una línea de una lista que ya se mira, sin
cambiar qué se hace con el cobro.

## 4. El log y la matriz

Con la excepción del owner (N-J extendido a lo que se deriva de N-A). **Tres 📌, ninguna decisión
nueva, ningún `SUPERSEDED`.** Grepeado: `DEC-ARCH-014`, `DEC-MIG-003` y `DEC-MP-009` existen y son
las que describen la limpieza, el orden del corte y el canal IPN.

- `DEC-ARCH-014`, que nace precisada: `01-decision-log.md:6907` «Precisada el 2026-09-29, con OK del owner (verificación corta, lotes O-A y O-B)»
- Su *Estado*: `01-decision-log.md:6872` «(verificación corta, lotes O-A y O-B: la unidad que hace la limpieza y el corte sin URL que mover; ver su 📌)»
- `DEC-MIG-003`, la del orden del corte: `01-decision-log.md:2993` «Precisado el 2026-09-29, con OK del owner (verificación corta, lote O-B)»
- Su *Estado*: `01-decision-log.md:2887` «(verificación corta, lote O-B: la ruta de avisos cerrada en el borde y el 4b que sólo verifica; ver su último 📌)»
- `DEC-MP-009`, porque su 📌 de N-D decía que la URL de IPN se apuntaba y se devolvía: `01-decision-log.md:6862` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote O-B)**: La URL de IPN no»
- El `## Resumen`: `01-decision-log.md:6946` «1 nueva, ~~10~~ 13 📌, 0 `SUPERSEDED`»
- Y la nota de precisadas: `01-decision-log.md:6931` «tras los tres 📌 del lote O de la verificación corta: suma `DEC-ARCH-014`»

**Las cifras, con script sobre el archivo final**, parado en `$D`:

| qué | antes | después | cómo |
|---|---|---|---|
| decisiones | 136 | **136** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` |
| funcionales | 121 | **121** | la misma, menos las 15 `DEC-METH` |
| precisadas sin `SUPERSEDED` | 68 | **69** | `contar-precisadas.py` (el de `24-` a `34-`), y `diff` contra el de `HEAD`: la única diferencia es `DEC-ARCH-014` |
| `SUPERSEDED` | 11 | **11** | el mismo recorte del *Estado* |
| matriz | 114 = 61 · 15 · 24 · 14 | **igual** | `python3 contar-filas-de-la-matriz.py`; `EX-46` sigue `UNKNOWN` y entre las seis *«no se miden, por decisión»* |

**Por qué la de precisadas cambia**: `DEC-ARCH-014` nació el mismo día con el *Estado* en
`ACCEPTED` a secas, y su 📌 le suma la marca; `DEC-MIG-003` y `DEC-MP-009` ya estaban contadas.

## 5. Conteos que cambiaron

| qué | antes | después | cómo |
|---|---|---|---|
| unidades del programa | 22 | **23** | 9 + 13 + `U1` |
| reparto de guards | 18 · 15 | **17 · 15 · 1** (33) | recorrido de la columna `guards` de cada §2 y de la fila de `U1`, sin lo tachado ni los paréntesis en cursiva (`aplic-35`, script en línea) |
| inversos de la vuelta atrás | 3 | **3** | cambian dos de las tres: la URL por la ruta del borde, la URL de IPN por el pago chico |
| precisadas del log | 68 | **69** | §4 |

**Lo que no se movió**: las once dependencias entre épicas (§1.3), los 33 guards, las 24
acciones administrativas vivas, las transiciones, los motivos, las entradas del contrato, los pasos
del corte (el cierre y la apertura van dentro del 3 y del 4) y la matriz.

## 6. Casos vecinos

**Uno que bloquea la promesa de O-A, no su aplicación.** La elección de O-A se apoyaba en que,
después de `U1`, `V1` y `B1` arrancan a la vez. Pero `$B/descomposicion.md` §2.6 dice *«El package
lo crea `V1`, y esta épica lo consume desde `B1`»*, y la fila de `B1` pone en ese package *«la
interfaz del reloj que lee producción, en el package del contrato, que construye esta unidad»*.
Si `B1` escribe en un package que crea `V1`, `B1` espera a `V1`, y esa espera **no está entre las
once** de la tabla. No lo resolví; lo que sale depende de una elección: que `V1` cree el package
primero y `B1` lo espere (una dependencia entre épicas más, doce), que `U1` deje creado el package
vacío (contra *«sólo la limpieza»*), o que `B1` cree la parte del reloj y `V1` la del contrato, cada
uno la suya. En `D/16` evité decir *«en paralelo»* por eso.

## 7. Para la implementación

1. **La issue de `U1`** no existe: la crea quien abre el programa, como sub-issue de HOS-1352. El
   tablero y las fichas publicadas no la conocen.
2. **El ensayo del corte en `staging`** mide cuánto dura el cierre y verifica desde afuera el
   código que contesta el borde cerrado.
3. **`03-handoff.md`** sigue con las cifras de antes (22 unidades, el 4b que apunta URL): lo
   actualiza el owner.

## Key Learnings

1. Cuando la letra del owner trae una premisa (*«el barrido cubre lo que se pierda»*), se relee
   contra el capítulo que la sostiene antes de escribirla: acá el barrido lee esos cobros pero,
   sobre una lápida y el día del corte, no los asienta.
2. «El borde contesta error» no alcanza para un proveedor que reintenta según el código: el único
   medido es el `500`, y la regla de bloqueo de Cloudflare sólo contesta `4xx`.
3. Un recuento de dependencias sobre una tabla puede estar bien y el texto del mismo § contradecirlo:
   verificar un conteo es también leer la prosa que lo rodea.
