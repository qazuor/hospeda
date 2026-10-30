---
title: "Revisión del owner · el lote N de la verificación corta, en el diseño y en el log"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · el lote N de la verificación corta, en el diseño y en el log

Las diez letras del **lote N** de
[`32-decisiones-sobre-la-verificacion.md`](./32-decisiones-sobre-la-verificacion.md), que decidió
lo que pidió elegir [`33-aplicacion-lote-m-y-menores.md`](./33-aplicacion-lote-m-y-menores.md) §3,
aplicadas al diseño en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD
`222df18943`, sin commits. **N-A la reformuló el owner** (limpieza total del sistema viejo al
principio de la épica); de B a I son todas la recomendada, y **N-J es el OK al lote del log**, que
esta vez sí se escribió (§4).

Marcas en el diseño: *(verificación corta, 2026-09-29, lote N-letra)*. Abreviaturas: `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `D/16` la FASE 7 del paraguas,
`nucleo/` el núcleo, `$B/` y `$V/` las raíces de las sub-specs. Las ediciones las aplicaron dos
scripts con reemplazos de ocurrencia única que abortan sin escribir si un ancla no es única
(`aplic-34/aplicar.py` y `aplic-34/log.py` del scratchpad); las citas de abajo las resolvió otro
(`aplic-34/cit.py`), buscando cada frase en el archivo ya editado.

**Quedan dos decisiones para el owner** (§3), las dos de N-A: qué unidad hace la limpieza, y cómo se
reordenan los pasos 3 y 4b del corte. El diseño las marca con ⚠️ donde van.

## 1. N-A · la limpieza del principio

### 1.1 Dónde vive, y qué deja demostrado

La definí una vez, en un § nuevo de la FASE 7 del paraguas, porque cruza las dos mitades y el
programa ya pone ahí lo que es de la rama y del corte. Todo lo demás la nombra por su nombre,
*«la limpieza del principio»*, sin atarla a una unidad, porque qué unidad la hace es la decisión
N-A-1 (§3).

- El § nuevo: `D/16:481` «La limpieza del principio: el sistema viejo sale de la rama antes de construir el nuevo»
- La cita del owner: `D/16:484` «tenemos que estar 100 % seguros de eliminarlo por completo y no dejar código»
- El cobro viejo entero, con sus cinco `package.json`: `D/16:491` «Borra todo el cobro viejo»
- El esquema viejo y su migración: `D/16:496` «cuyo borrado genera la migración que las saca de la base en»
- El código que nombra el agrupamiento viejo, con la medición de `31-`: `D/16:502` «y además el código que la nombra»
- El criterio de los dos guards: `D/16:511` «Los dos guards corren sobre todo el repo, sin lista de pendientes de código, y nacen verdes.»
- Los casos 9 y 42, en el mismo cambio: `D/16:512` «Las 11 migraciones de datos del seed que importaban el archivo de planes compilan sin él»
- La rama compila: `D/16:515` «La rama sigue compilando»
- El simulador mientras la app está rota: `D/16:520` «Las dos mitades se construyen y se prueban contra el simulador del contrato»
- Producción no cambia: `D/16:523` «corre `main`, con el sistema viejo, hasta el paso 3 del corte»
- La dependencia de todo lo demás: `D/16:526` «Ninguna otra unidad de las dos épicas arranca antes de que esta limpieza esté mergeada»
- El ⚠️ de qué unidad la hace: `D/16:528` «Qué unidad la hace pide decisión del owner»
- Lo que no entra: `D/16:531` «Lo que no entra, y por qué:»
- El ⚠️ del corte: `D/16:535` «Y el orden del corte tiene un hueco que esta limpieza vuelve evidente»

### 1.2 Las dos descomposiciones

**Qué unidad**: la fila de la limpieza de verticales la sigue nombrando `V1`, con el ⚠️ de la otra
opción; el criterio de `V1` pierde el trinquete y gana *«ningún archivo de código la nombra ni
ningún `package.json` declara `qzpay`»*.

- La fila de la limpieza suma el código viejo y el cobro: `$V/descomposicion.md:485` «y todo el código del sistema viejo que la nombra, con el cobro viejo entero, en la limpieza del principio»
- Su unidad, con el ⚠️: `$V/descomposicion.md:485` «o una unidad propia que vaya antes de `V1` y de `B1`, si el owner la separa»
- Su criterio: `$V/descomposicion.md:485` «`G8` y `G16` nacen verdes sobre todo el repo, y la rama compila»
- El criterio de `V1`, sin trinquete: `$V/descomposicion.md:563` «el trinquete salió: después de la limpieza del principio no queda código que la nombre»

**Las dependencias**: en los dos §3, la limpieza es el primer nodo. **No cambian las once
dependencias entre épicas** mientras la decisión N-A-1 no esté tomada: con una unidad propia del
paraguas no hay flecha entre épicas nueva; con `V1`, `B1` pasa a esperar a `V1`, y eso sí sería una
fila nueva de `$B/descomposicion.md` §2.6 (lo dice el ⚠️ de billing).

- Verticales: `$V/descomposicion.md:504` «salvo de la limpieza del principio si el owner la separa en una unidad propia»
- Billing: `$B/descomposicion.md:646` «Antes de `B1` y de `B2` va la limpieza del principio»
- El costo de la otra opción, dicho: `$B/descomposicion.md:646` «con `V1`, `B1` pasa a esperar a `V1`»

**El archivo de configuración de planes** (caso 9 y 42) ya no es de *«ninguna»* unidad: lo borra la
limpieza, que es la que saca el cobro viejo.

- `$B/descomposicion.md:640` «que borra el cobro viejo entero»

### 1.3 `G8` y `G16`, sobre todo el repo

**`G8`**: el trinquete de M-E sale tachado con su causa, *«nada más»* vuelve a *«ninguna más»*, y
el guard lo construye la unidad que hace la limpieza, en el mismo cambio (con el ⚠️ de N-A-1).

- `V/20:56` «tres entradas por carpeta, y ninguna más»
- `V/20:56` «Sin trinquete y sin lista de pendientes de código»
- `V/20:56` «nace verde porque la limpieza va antes que él o con él»
- `V/20:56` «Lo construye ~~`V1` con el guard~~ la unidad que hace la limpieza del principio»

**Qué queda de las tres entradas.** Las revisé una por una y **las tres siguen haciendo falta**; lo
escribí en la misma fila:

1. **La historia de migraciones, hasta el paso 6**: una migración aplicada no se reescribe, y la
   limpieza misma genera una nueva que borra lo viejo y lo nombra (el esquema viejo de billing, y lo
   que tenga la palabra).
2. **Las migraciones de datos del seed, hasta el paso 6**: el ledger las anota como aplicadas en
   producción, y entre ellas están las 11 congeladas del caso 9. **El caso 9 sigue**: el archivo
   de planes se borra en la limpieza, así que las 11 se congelan en ese mismo cambio, y salen en el
   paso 6 como estaba escrito.
3. **Las carpetas del programa, hasta el cierre de HOS-1352**: los informes históricos la citan, y
   se reescriben o salen en ese commit.

- `V/20:56` «Las tres carpetas siguen haciendo falta»

**`G16`**: el predicado (a) vuelve al repo entero, con el acotamiento de M-D tachado y su causa.

- `B/20:67` «Mira todo el repo desde que nace»
- `$B/spec.md:108` «a cualquier `package.json` o import del repo»
- `$B/descomposicion.md:780` «cualquier `package.json` del repo pone `G16` en rojo»

**Los espejos del trinquete**, tachados: el paso 6 y el script del corte en `D/16`, el cierre en la
spec del paraguas, la spec de verticales, el invariante 32 y la limpieza de `V/21` §4, que además
pasa de *«no entra en esta limpieza»* a *«entra también»*.

- `D/16:145` «el trinquete salió antes de llegar al código: el sistema viejo sale de la rama en la limpieza del principio»
- `D/16:308` «el trinquete salió con el lote N-A»
- `.specs/HOS-1352-billing-verticals-redesign/spec.md:197` «El trinquete salió antes de llegar al código»
- `$V/spec.md:403` «sin lista de pendientes de código: el código del sistema viejo sale de la rama en la limpieza del principio»
- `nucleo/04:78` «y ninguna lista de código: el código del sistema viejo sale de la rama al principio de la épica»
- `V/21:534` «Y entra también el código del sistema viejo que lo nombra»
- `D/16` §4.5 punto 3, que tenía el ⚠️ de M-D sin unidad: `D/16:479` «Y el cobro viejo sale de la rama del paraguas al principio de la épica»
- Y quién limpia las specs de fuera: `V/20:56` «y las limpia ~~`V1`~~ la limpieza del principio en el mismo cambio»

**Lo demás que suponía el código viejo vivo en la rama**, recorrido con `rg` sobre el diseño: sólo
`B/21` §4, que decía que las tablas viejas de billing *«se retiran con el código que las lee (FASE
5)»* y que el archivo de planes *«es filtro 1 de FASE 5»*. Los dos pasan a la limpieza.

- `B/21:422` «la migración que genera ese borrado las saca de la base en el paso 3 del corte»
- `B/21:433` «y los dos salen de la rama en la limpieza del principio»
- `B/21:455` «y lo borra la limpieza del principio»

### 1.4 El simulador, mientras la app de la rama está rota

Escrito en los tres lugares donde el simulador ya estaba: el contrato §7.1, el §2.6 de billing
(donde el simulador vuelve de integración las dependencias) y el §3 de verticales.

- `D/12:1506` «Y mientras la app de la rama está rota, son lo único contra qué probar»
- `$B/descomposicion.md:331` «el simulador es lo único contra qué probar mientras la app de la rama está rota»
- `$V/descomposicion.md:506` «verticales se construye y se prueba contra el simulador de billing del contrato»

### 1.5 El orden del día del corte

**No lo rehíce: lo marqué y lo dejo al owner** (§3, N-A-2), porque hay dos formas razonables con
costos distintos. **El hueco ya estaba** (el contenedor viejo se apaga durante el rollout del paso 3,
`DB-5`, y la imagen nueva no sirve la ruta del viejo), pero dependía de un reintento cuyo destino no
está medido (`EX-46`), y con la limpieza del principio no queda ni siquiera la rama con el receptor
viejo adentro. El ⚠️ va en el paso 4b, que es donde el diseño explicaba por qué la URL sigue en el
viejo hasta ahí, y en el § nuevo.

- `D/16:141` «Y la ruta vieja no existe entre el paso 3 y el 4b»

## 2. N-B a N-I

### N-B · el `402` que no llega

- La regla, en el § de la compra: `B/16:120` «Y un `402` que no llega»
- El reenvío: `B/16:120` «El segundo pedido que la encuentra así reenvía la orden con la misma clave y el mismo cuerpo»
- El `409` y su texto: `B/16:120` «tu pago anterior se está procesando, probá en unos minutos»
- La excepción al doble clic: `B/16:104` «salvo que la instancia todavía no tenga id de orden: ahí reenvía la misma»
- `A7`: `B/03:2530` «Y si el `402` no llegó»
- El criterio de `B10`: `$B/descomposicion.md:789` «y con el `402` perdido, apretar «pagar» otra vez reenvía la misma orden»

### N-C · un cobro que llega después de la acción 24

- `puedeCobrarle` suma la marca: `D/12:1118` «o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta»
- `P1` sobre una cuenta dada de baja: `B/03:1760` «Salvo sobre una cuenta que la acción 24 ya dio de baja»
- Su efecto: `B/03:1760` «deja las dos columnas nulas y el comprobante sin enviar»
- El CHECK del comprobante lo admite: `B/02:378` «o sobre una cuenta que la acción 24 ya dio de baja»
- El paso 1 de la baja manual la espera: `nucleo/08:102` «Y no alcanza mientras una cancelación siga sin confirmar»
- La fila de la 24, el cobro que llega igual: `nucleo/08:203` «Y un cobro que llegue igual después de la baja»
- La fila de `puedeCobrarle` en verticales: `$V/descomposicion.md:475` «y con una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta tampoco»
- La fila de `B4`: `$B/descomposicion.md:130` «o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta; verificación corta»
- El criterio de `B5`: `$B/descomposicion.md:784` «y un cobro que llega sobre una cuenta que la acción 24 ya dio de baja deja el comprobante sin nombre»
- **Un espejo que faltaba**, arreglado de paso: la lista de lo que verticales le pregunta a billing en el contrato §7.1 no tenía `puedeCobrarle` desde M-F: `D/12:1496` «faltaba en esta lista desde el lote M-F»

### N-D · la verificación de la URL de IPN en el 4b

**Una precisión que no estaba en la letra, y la marco**: el pago chico sale **directo por la API de
pagos del proveedor, no como una orden**, porque las órdenes no avisan por ningún canal (`EX-15`,
`B/16` §1.4): una orden de única vez no produciría la entrega IPN que se quiere ver.

- `D/16:141` «Y se verifica con una entrega real de `payment`»
- `D/16:141` «la herramienta del corte hace un pago chico con la tarjeta del owner»
- `D/16:141` «porque las órdenes no avisan por ningún canal»
- La vuelta atrás, derivado: `D/16:373` «y a la vuelta no hay dónde verlo»

### N-E · el cliente `PARA_RESOLVER`

- La regla, en el punto 5 de la migración: `B/10:191` «Recibe sólo el correo del anuncio»
- Su salida: `B/10:195` «Su fila sale a `FUERA`»
- La cancelación: `B/10:217` «y a las `PARA_RESOLVER`, que también pasan a `CANCELADA`, sin correo»
- La regla de los terminales la alcanza: `B/03:190` «Alcanza a `PENDIENTE` y a `PARA_RESOLVER`»
- El ⚠️ que había dejado M-A, tachado: `B/03:190` «Una `PARA_RESOLVER` cuya suscripción termina sale igual a `FUERA`»
- El modelo: `B/02:62` «sale a `FUERA` con «cambió de plan» cuando una persona la resuelve»
- El correo del anuncio: `nucleo/07:246` «recibe sólo el del anuncio, con un texto propio: que lo van a contactar»
- El de la cancelación: `nucleo/07:247` «ni una `PARA_RESOLVER`, que sólo recibe el anuncio»

### N-F · el correo de `PB12` cuando soporte corre la 24 enseguida

- `nucleo/07:42` «Y la fila guarda la dirección del destinatario al encolarse»
- La jerarquía de supresión: `nucleo/07:162` «lo que se encola después de la baja»
- El correo de `PB12`: `nucleo/07:260` «Sale aunque soporte dé de baja la cuenta enseguida»

### N-G · la acción 25, vaciar la presencia de un Partner

**Dos cosas derivadas, que marco**: la **clase** (capacidad del actor, como la 24: no hay cupo que
la rechace, y después del paso 1 el Partner ya no tiene la clave de su página) y la **unidad**
(`V8`, con su panel, como la 23 y la 24, sobre la presencia de `V7`: la forma del caso H-D). Y una
consecuencia necesaria para que la acción sirva: **la 24 se rechaza también mientras la presencia
tenga contenido**, como con una ficha fuera de `PURGED`. **No toca la postulación**: la letra habla
de la presencia.

- El paso 2 de la baja: `nucleo/08:107` «Y, si la cuenta es de un Partner, se vacía su presencia»
- El paso 3 la espera: `nucleo/08:108` «ni una presencia de Partner con contenido (verificación corta, 2026-09-29, lote N-G).»
- La fila nueva: `nucleo/08:204` «vaciar la presencia de un Partner a pedido de su dueño ✚»
- Su clase: `nucleo/08:204` «Es capacidad del actor, como la vigesimocuarta»
- El recuento de la tabla: `nucleo/08:208` «La tabla tiene VEINTICUATRO filas vivas»
- La 24 la espera: `nucleo/08:203` «o una presencia de Partner con contenido (lote N-G)»
- La presencia de Partner ya no se conserva sin fin: `V/18:161` «Salvo que pida la baja»
- La lista de acciones con su clase, en `V/17` §3.2: `V/17:371` «veintidós acciones del capítulo 08 §3, las catorce primeras»
- La fila de verticales: `$V/descomposicion.md:483` «y la 25, sobre la presencia de V7»
- Su criterio: `$V/descomposicion.md:483` «y con un Partner, la 25 deja su presencia sin fotos, logo, secciones ni enlaces»

**El recuento, 23 → 24 acciones vivas, y sus espejos.** Conté con script las filas de la tabla de
`nucleo/08` §3: 25 filas, de las que sale sólo la de discontinuar una vertical (la 24 empieza con un
tachado por su renombre, y está viva). Busqué la cifra por número y por palabra en todo el diseño
(`rg` sobre *«veintitrés»* junto a *«acciones»* o a la serie tachada de las acciones, y sobre
*«23 acciones»*): **catorce espejos**, todos actualizados, más los dos del propio §3.

- `B/19:206` «veinticuatro (con la vigesimoquinta: verificación corta, 2026-09-29, lote N-G) del capítulo 08 §3»
- `V/17:356` «son escrituras, y las inspecciones del §48»
- `V/17:409` «acciones del capítulo 08 §3, y su»
- `V/17:445` «veinticuatro acciones del capítulo 08 §3.»
- `V/17:538` «veinticuatro acciones del cap. 08 §3 (verificación corta»
- `B/03:1960` «la vigesimoquinta con la verificación corta, 2026-09-29, lote N-G;»
- `B/03:2070` «la vigesimoquinta, vaciar la presencia de un Partner), y veintitrés desde»
- `B/03:2075` «dicen veinticuatro (con la vigesimoquinta»
- `$V/spec.md:213` «y la vigesimoquinta, vaciar la presencia de un Partner a pedido de su dueño»

### N-H · la versión de plazos el día del corte

- El paso 3 la crea: `D/16:137` «y, antes que las dos, la versión 1 de los plazos de cada mitad, con los quince valores»
- El 3a sólo la verifica: `D/16:138` «la versión 1 de los plazos la crea la migración estructural del paso 3, y acá sólo se verifica»
- La condición de los cinco sin valor, movida: `D/16:138` «la condición pasó al paso 3, con la versión 1 de los plazos»
- El núcleo: `nucleo/02:164` «la versión 1 de los plazos de cada mitad, con los quince valores, nace en la migración estructural del paso 3»
- El criterio de `V2`, tachado: `$V/descomposicion.md:487` «esa condición pasó a la migración que crea la versión 1 de los plazos»
- El de los plazos de verticales: `$V/descomposicion.md:488` «y la migración que crea la tabla escribe la versión 1 de los plazos de verticales»
- El de los plazos de billing: `$B/descomposicion.md:639` «y la migración que crea la tabla escribe la versión 1 de los plazos de billing»

### N-I · cuando muere el título que ancla la cuota

- `V/15:539` «Y lo mismo cuando cambia el título que ancla»
- `$V/descomposicion.md:473` «y cuando ese título muere la ventana en curso sigue hasta su fin»

## 3. Decisiones para el owner

**N-A-1 · Qué unidad hace la limpieza del principio.** El día que arranca el programa, Juan va a
construir `V1` y Ana `B1`. Si la limpieza es parte de `V1`, Ana espera a que Juan termine un cambio
de más de mil archivos (la mitad de ellos de billing) **y además** el catálogo, `G1`, `G3`, `G8`,
`G14` y el package del contrato. Si es una unidad propia, los dos esperan sólo al borrado, y después
arrancan en paralelo.

1. **Una unidad propia, del paraguas, que va antes de `V1` y de `B1`**, con un número nuevo que no
   reuse ninguno retirado. Hace la limpieza entera y construye `G8`; `G16` sigue en `B1`, porque su
   predicado (b) necesita el package del cobro. Costo: una fila y una issue más, y el reparto de
   guards cambia (verticales pasa de 18 a 17 y la unidad nueva lleva uno; el total sigue en 33).
   Riesgo: bajo; es un cambio grande pero de una sola clase (borrar y renombrar), que se revisa por
   sí mismo y no mezcla diseño nuevo. **Las dependencias entre épicas siguen en once.**
2. **`V1` crece**: su primer cambio es la limpieza entera, y después sigue con lo que ya tenía.
   Costo: ninguna fila nueva. Riesgo: `V1` pasa a ser la unidad más grande del programa y mezcla el
   borrado de la mitad de billing, que no es de su épica, con piezas de diseño nuevo; y `B1` pasa a
   esperar a `V1` entero, una dependencia entre épicas más (**doce**).

**Recomiendo la 1**: la limpieza cruza las dos mitades, así que no es de ninguna de las dos épicas;
deja a `V1` como estaba y no agrega una dependencia entre épicas. Si la elige, falta decidir en qué
issue de Linear vive (una sub-issue del paraguas es lo natural).

**N-A-2 · Cómo se reordenan los pasos 3 y 4b del corte.** Juan tenía una suscripción del sistema
viejo, cancelada en el 1b con un cobro en vuelo. El proveedor lo aprueba a las 10:05, dos minutos
después de que el paso 3 reemplazó la imagen. El aviso va a la URL configurada, que apunta a la ruta
del viejo, y esa ruta ya no la sirve nadie: el proveedor recibe error y reintenta a los 18 y a los
35 minutos (`WH-4`, que no midió cuántas veces en total). Si el 4b cambió la URL entre medio, no está
medido a dónde va el reintento (`EX-46`); si va a la vieja, el cobro de Juan queda sin asiento hasta
que el barrido lo relee. Hoy el diseño lo acepta así (mediciones del 2026-09-29, M-4); el owner pidió
que no haya hueco.

1. **El receptor nuevo sirve la misma ruta que el viejo, y la ruta se cierra en el borde hasta que
   las lápidas estén escritas.** La aplicación del proveedor ya apunta a
   `/api/v1/webhooks/mercadopago` para los dos canales (el viejo distingue Webhooks por una marca en
   la URL, medido en hospeda2 el 2026-09-29, `apps/api/src/routes/webhooks/mercadopago/router.ts`),
   así que no hay URL que cambiar. Para que ningún aviso de un id del manifiesto llegue antes de su
   lápida (la razón por la que el 4 va antes del 4b), la regla del borde del 0b cierra también esa
   ruta desde que se apaga el contenedor viejo hasta que el paso 4 terminó: el proveedor recibe
   error, reintenta **a la misma URL**, y los reintentos llegan con las lápidas escritas. El 4b deja
   de apuntar y sólo verifica: la sonda de Webhooks y el pago chico de IPN de N-D. Costo: el
   receptor nuevo hereda la ruta del viejo; la regla del borde suma una ruta; `EX-46` se queda sin
   sujeto; la vuelta atrás pierde dos de sus tres cosas, porque no hay URL que devolver. Riesgo: un
   cierre largo puede agotar los reintentos, cuya cantidad no está medida, así que el cierre dura
   lo que duran el despliegue, el 3a, el 3b y el paso 4; lo que se pierda lo relee el barrido.
2. **Rutas distintas, y el apuntado entra al paso 3**, apenas el proceso nuevo está sano y el paso 4
   (adelantado) escribió las lápidas. Costo: poco texto, y se conserva la separación de rutas.
   Riesgo: el hueco se achica a los minutos del despliegue pero no se cierra, y el destino del
   reintento sigue sin medir (`EX-46`).

**Recomiendo la 1**: es la única en que el proveedor nunca avisa a una ruta que no existe, y la que
vuelve conocido el destino del reintento. Cuida los cobros en vuelo del 1b y deja la verificación de
IPN de N-D como estaba.

## 4. El lote del log (N-J)

**Escrito en `01-decision-log.md`**, con el OK del owner (N-J): el lote de `33-` §4 más lo que
sumaron las letras A a I. **Una decisión nueva y diez 📌, sin `SUPERSEDED`.**

**La decisión nueva, `DEC-ARCH-014`**, porque la limpieza al principio no cabía en una existente: no
es sólo que el agrupamiento viejo desaparezca (`DEC-ARCH-012`) ni que `qzpay` salga (`DEC-ARCH-004`),
sino **cuándo** sale todo el sistema viejo, y eso cambia el orden de las dos épicas y lo que se prueba
contra qué. Grepeado: `DEC-ARCH-014` no existía.

- `01-decision-log.md:6857` «DEC-ARCH-014 — El sistema viejo sale entero de la rama al principio de la épica, antes de construir el nuevo»

**Los seis 📌 de `33-` §4, ajustados a lo que el lote N cambió el mismo día.** El de `DEC-ARCH-004`
(M-D) y el de `DEC-ARCH-012` (M-E) no se escribieron como decía `33-`, porque describían un
acotamiento de `G16` y un trinquete de `G8` que N-A retiró: los escribí con el estado final y una
frase que cuenta que el lote M los había puesto y el N los sacó. Los de `DEC-SUB-023`, `DEC-ARCH-006`
y `DEC-DATA-005` suman lo de E, C, F y G. El de `DEC-DATA-006` va como estaba.

- `01-decision-log.md:6587` «verificación corta, lotes M-A, M-B, M-C y N-E): Toda»
- `01-decision-log.md:2317` «Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-D y N-A)»
- `01-decision-log.md:6707` «El trinquete de archivos que el lote M-E le había sumado el»
- `01-decision-log.md:2518` «Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-F, N-A y N-C)»
- `01-decision-log.md:5884` «Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-F, M-G, N-C, N-F y N-G)»
- `01-decision-log.md:6509` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote M-H y `VC-VT-05`)»

**Los cuatro 📌 nuevos del lote N**, sobre decisiones ya precisadas (grepeadas en la lista del
script): `DEC-CONC-001` (B, la del candado contra el doble cobro, que ya tenía el 📌 de L-C sobre el
mismo camino), `DEC-MP-009` (D), `DEC-DATA-008` (H) y `DEC-ENT-002` (I).

- `01-decision-log.md:1530` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-B)»
- `01-decision-log.md:6847` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-D)»
- `01-decision-log.md:6799` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-H)»
- `01-decision-log.md:643` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-I)»

Cada *Estado* suma al final, antes de *«· Decide»*, con el separador *«—»* que el campo ya usa,
*«**y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes …; ver su
último 📌)»*. El `## Resumen` gana la fila *«Verificación corta»*, `DEC-ARCH-014` en *Decisiones
tomadas* y en *Funcionales*, y la nota del recuento en *Precisadas*.

- `01-decision-log.md:6919` «Verificación corta | 1 nueva, 10 📌, 0 `SUPERSEDED`»

**Las cifras, con script sobre el archivo final**, parado en `$D`:

| qué | antes | después | cómo |
|---|---|---|---|
| decisiones | 135 | **136** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` |
| funcionales | 120 | **121** | la misma, menos las 15 `DEC-METH` |
| precisadas sin `SUPERSEDED` | 68 | **68** | `contar-precisadas.py` (el de `24-`, `28-` y `29-`): el mismo conjunto, comparado con `diff` |
| `SUPERSEDED` | 11 | **11** | el mismo recorte del *Estado* |
| matriz | 114 = 61 · 15 · 24 · 14 | **igual** | `python3 contar-filas-de-la-matriz.py` |

Los diez 📌 caen sobre decisiones ya precisadas y la nueva nace sin precisar, así que la cifra de
precisadas no se mueve. **La matriz no cambia**: el pago chico de N-D es una verificación del corte,
no una medición del proveedor.

## 5. Conteos que cambiaron

| qué | antes | después | cómo |
|---|---|---|---|
| acciones administrativas vivas | 23 | **24** | filas de la tabla de `nucleo/08` §3 sin tachar el nombre de la acción (la 24 empieza con el nombre viejo tachado y está viva); 25 filas, sale la de discontinuar |
| lista de pendientes de `G8` | 3 carpetas y un trinquete | **3 carpetas** | `V/20` §2 |
| predicado (a) de `G16` | el package del cobro | **todo el repo** | `B/20` §2 |
| decisiones del log | 135 | **136** | §4 |

**Lo que no se movió**: los 33 guards (18 · 15), las once dependencias entre épicas, las 34
transiciones vivas de la suscripción, las 7 de la instancia, los 24 motivos de marca, las ocho
entradas del contrato (`puedeCobrarle` gana una condición, no una entrada), los 15 plazos, los
cinco estados de la fila de alcance y la matriz. Si el owner elige la 1 de N-A-1, se mueve el
reparto de guards por épica; si elige la 2, las dependencias entre épicas pasan a doce (§3).

## 6. Casos vecinos

Ninguno bloquea fuera de las dos decisiones del § 3.

## 7. Para la implementación

1. **Qué columna dice que una cuenta está dada de baja**, la que `P1` lee (N-C) y la jerarquía de
   supresión usa (N-F): la 24 la deja *«sin acceso»*, pero ningún capítulo nombra la columna.
2. **El cliente `PARA_RESOLVER` de una migración cancelada** recibió *«te vamos a contactar»* y no
   recibe nada más (la letra dice *«sólo el anuncio»*), y sale del listado: nadie lo contacta. Si se
   quiere, un texto propio en el correo *«ya no cambia nada»*.
3. **El pago chico de N-D llega también por Webhooks** al receptor nuevo, como un pago sin
   preapproval ni orden, que hoy *«no cae en ningún lugar»* (el «NO cierra» de `B/09`). Está en el
   manifiesto; que nada actúe sobre él se verifica en el ensayo. Y la herramienta tiene que
   tokenizar la tarjeta del owner para la API de pagos.
4. **`B/19` no tiene fila para los estados de la compra de un addon de única vez**: el texto del
   `409` (N-B) vive hoy sólo en `B/16` §1.4.
5. **La postulación de un Partner que se da de baja** no la toca la 25 (`VC-VT-07` la nombraba): se
   conserva como la de cualquier cuenta.
6. **Las tablas viejas de billing salen de la base en el paso 3** (derivado de la limpieza): ningún
   paso del corte las lee después del paso 2, verificado sobre `D/16` §4.2; conviene confirmarlo en
   el ensayo.
7. **`03-handoff.md`** sigue con las cifras de antes (135 decisiones, 23 acciones, el trinquete):
   lo actualiza el owner.

## Key Learnings

1. Una decisión que retira un mecanismo el mismo día que se aprobó (el trinquete de `G8`, el
   acotamiento de `G16`) no se escribe en el log como estaba aprobada y después se tacha: se escribe
   el estado final, con una frase que cuenta que existió.
2. Una pieza sin unidad decidida se puede definir igual, una vez y con nombre propio (*«la limpieza
   del principio»*), y dejar que todo lo demás la nombre: la decisión pendiente queda en un solo
   ⚠️ y no en veinte lugares.
3. Una verificación de un canal de avisos tiene que usar un objeto que ese canal efectivamente
   avisa: las órdenes del proveedor no avisan por ningún canal, así que el pago de prueba de IPN no
   puede ser una orden.
4. Recontar una tabla por *«filas que no empiezan tachadas»* cuenta mal cuando una fila viva empieza
   con su nombre viejo tachado: hay que mirar qué se tachó.
