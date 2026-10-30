---
title: "Revisión del owner · el lote M y los menores de la verificación corta, en el diseño"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · el lote M y los menores de la verificación corta, en el diseño

Las ocho letras del **lote M** de
[`32-decisiones-sobre-la-verificacion.md`](./32-decisiones-sobre-la-verificacion.md) (todas la
recomendada) y los catorce hallazgos menores de
[`30-verificacion-cobro.md`](./30-verificacion-cobro.md) (`VC-cobro-05` a `11`) y
[`31-verificacion-verticales-y-transversal.md`](./31-verificacion-verticales-y-transversal.md)
(`VC-VT-05` a `11`), aplicados al diseño en el worktree `hospeda-spec-hos-1352-billing-redesign`
sobre el HEAD `d5b8da2ad6`, sin commits. El log, la matriz y el PDR no se tocaron: lo que necesitan
está en el § 4.

Marcas en el diseño: *(verificación corta, 2026-09-29, lote M-letra)* y, para los menores,
*(verificación corta, 2026-09-29, `ID`)*. Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es
`HOS-1353…/docs`, `D/12` el contrato, `D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$B/` y
`$V/` las raíces de las sub-specs. Las ediciones las aplicó un script con reemplazos de una sola
ocurrencia (`aplic-33/aplicar.py` del scratchpad), que abortaba sin escribir si un ancla no era
única.

## 1. El lote M

### M-A · la fila de alcance `PENDIENTE` sale sola cuando la suscripción termina

Una regla y un lugar: toda llegada a un estado terminal, por cualquier camino (una transición, el
espejo del §10.1, `S17` al morir la predecesora), pasa la fila `PENDIENTE` a `FUERA` con un tercer
motivo, *«terminó»*, en la misma transacción. Los correos de 30 y 7 días y el de la cancelación
leen `PENDIENTE`, así que dejan de salir.

- La regla, después de la tabla de transiciones: `B/03:190` «Toda llegada a un estado terminal cierra la fila de alcance de una migración»
- Su alcance: `B/03:190` «Sólo alcanza a `PENDIENTE`»
- El tercer motivo en el modelo: `B/02:62` «se dio de baja o terminó»
- Su restricción: `B/02:62` «Una `PENDIENTE` cuya suscripción llega a un estado terminal»
- El punto 8 de la migración: `B/10:209` «Y sale igual si su suscripción termina por»
- Los correos: `nucleo/07:239` «Los de 30 y 7 días salen sólo si la fila de alcance del cliente sigue `PENDIENTE`»
- El de la cancelación: `nucleo/07:240` «(su fila de alcance en `PENDIENTE`; una `FUERA` no lo»
- La prueba E2E: `B/20:718` «y el que termina por otro camino»

**Qué estados entran a la cohorte** (la otra mitad de la letra). Lo derivé y no lo elegí, y lo
marco para que el owner lo vea: entran las filas principales de la versión retirada en los cinco
estados vivos que tienen una renovación por delante, y **`CANCEL_SCHEDULED` no entra**, porque no
tiene próxima renovación (la fecha de aplicación no se puede calcular), ninguna transición la
devuelve a `ACTIVE` y termina sola por `S12`. `PENDING_AUTHORIZATION` y `SUSPENDED` entran y esperan
como una pausada: si no vuelven, terminan y salen por *«terminó»*. Por eso el recálculo de la fecha,
que decía *«`PAUSED` o en `GRACE_PERIOD`»*, pasa a *«mientras no esté `ACTIVE`»*: sin eso una
`SUSPENDED` de pagador manual que vuelve por `S7` después de su fecha quedaba sin `S37`.

- La cohorte: `B/10:156` «La cohorte son las filas principales de la versión retirada»
- La exclusión: `B/10:156` «`CANCEL_SCHEDULED` no entra»
- La espera: `B/10:197` «Lo mismo una `SUSPENDED` o una»
- El recálculo: `B/02:62` «de alcance está `PENDIENTE` y su suscripción no está `ACTIVE`»

**Qué no alcanza**: una `APLICADA` queda como está (la sucesión de I-B), y una `PARA_RESOLVER` cuya
suscripción termina es parte de `VC-cobro-11`, que dejé para el owner (§ 3); el diseño lo dice con
un ⚠️ en la misma regla.

### M-B · el pagador manual en una migración

Sobre un pagador manual `S37` no relee ni muta: encola el cambio de versión, manda el tercer correo
y pasa la fila a `APLICADA` en el mismo acto. `S38` corre antes que `MP5` cuando caen el mismo día,
así que la cuota de ese período ya sale con el precio destino.

- La guarda: `B/03:187` «Sobre un pagador manual no relee ni muta»
- El efecto: `B/03:187` «sólo encola el cambio de versión para la fecha de aplicación, manda el tercer»
- El orden en `S38`: `B/03:188` «`S38` corre antes»
- El orden en `MP5`: `B/03:1868` «lo aplica `S38` primero»
- La migración: `B/10:176` «Sobre un pagador manual no hay monto que mutar»
- La prueba E2E: `B/20:718` «el pagador manual, que cambia de versión sin mutar nada»

### M-C · el barrido entre `S37` y `S38`

La línea gemela de la del downgrade, en los tres lugares donde está la del downgrade, y el motivo
24 con el precio de la versión que rige el período que cubre el cobro.

- `B/14` §2.4: `B/14:311` «Entre `S37` y el `S38` que aplica ese cambio, el monto esperado es el precio de lista»
- `B/09` §3, la fila del monto: `B/09:173` «la ventana gemela, en una migración»
- `B/12` §2, al lado de la del downgrade: `B/12:271` «Y la migración tiene la ventana gemela»
- `S37`, donde dice que el barrido retoma: `B/03:187` «que en esa ventana espera el precio de la»
- El motivo 24 en `B/09`: `B/09:175` «de la versión que rige el período que cubre ese»
- El motivo 24 en el modelo: `B/02:1031` «que rige el período que cubre el cobro (la destino»

### M-D · `G16` (a) mira el package del cobro

- El predicado: `B/20:67` «del package del cobro (su `package.json` y»
- Por qué, con la medición de `30-`: `B/20:67` «Mira el package del cobro y no el repo»
- La spec de billing: `$B/spec.md:108` «al package del cobro»
- El criterio de `B1`: `$B/descomposicion.md:778` «el `package.json` del package del cobro pone»
- Un punto 3 en `D/16` §4.5: `D/16:479` «Y el cobro viejo sale del repositorio después del corte»

**La unidad o el paso que borra el cobro viejo no lo inventé**: ninguna unidad de las dos épicas lo
tiene y ningún paso del corte lo nombra (el §4.5 archiva el repositorio de `qzpay`, no saca sus
dependencias de Hospeda). Lo escribí como ⚠️ y va como decisión para el owner (§ 3, D-1), junto
con lo que vacía el trinquete de `G8`, que es el mismo trabajo.

- `D/16:479` «Qué unidad o qué paso lo borra no está escrito»

### M-E · el trinquete de `G8`

**Cómo queda la lista.** No subsume las tres entradas, y lo explico porque la tarea lo pedía: las
tres son **carpetas** (la historia de migraciones, las migraciones de datos del seed y las carpetas
del programa en `.specs/`), y en las tres aparecen archivos **nuevos** que pueden nombrar la palabra
hasta su salida (una migración estructural que borra una tabla vieja la nombra; un informe tachado
también). Un trinquete de archivos las rompería: toda migración nueva fallaría. Así que la lista
pasa a tener **dos clases de pendiente**: tres carpetas, con su salida fechada (el paso 6 para las
dos historias, el cierre de HOS-1352 para las carpetas del programa), y un **trinquete** de
archivos, que nace medido y sólo se achica. *«Ninguna más»* pasa a *«nada más»*: no entra una
cuarta carpeta ni un archivo nuevo al trinquete.

- `V/20:56` «tres entradas por carpeta y un trinquete»
- `V/20:56` «una cuarta carpeta, y el trinquete no»

**El mecanismo.** Falla un archivo que la nombra fuera de la lista (también en el nombre), falla un
archivo de la lista que ya no la nombra o no existe (la unidad que lo reescribe o lo borra lo saca en
el mismo cambio), y falla una lista que crece.

- `V/20:56` «La lista sólo se achica»

**Cómo se genera.** Un script que construye `V1` con el guard, que es el propio `G8` en modo de
generación: el mismo patrón armado en partes y el mismo conjunto de archivos, los versionados del
árbol del commit de `V1`, **después** de la limpieza que ese commit hace. Excluye el PDR y las tres
carpetas; lo que `V1` limpia (el `CLAUDE.md` raíz, el i18n, las specs de fuera y `.qtm/`, el rol,
los permisos, la tabla de contactos y el tipo de partner) ya no la nombra y no entra. La lista
guarda las rutas con la palabra enmascarada, porque 326 rutas la llevan en el nombre y la lista, si
la escribiera, fallaría sobre sí misma. La cifra de `31-` (1229 archivos sobre `origin/staging`
`35e2d63e81`) queda como referencia; la lista real la genera `V1`, no este registro.

- `V/20:56` «La genera un script»
- `V/20:56` «La lista no escribe la»

**La relación con las dos reglas.** La del paso 6 no alcanza al trinquete: el código viejo se borra
después del corte (M-D), así que un build de producción después del corte todavía lo tiene. La del
cierre de HOS-1352 sí: la lista entera no vacía falla, así que el programa no cierra con el
trinquete sin vaciar.

- `V/20:56` «La regla que enciende el paso 6 no lo alcanza»
- `D/16:145` «y el trinquete de archivos, que no es de este paso»
- `.specs/HOS-1352-billing-verticals-redesign/spec.md:197` «Eso incluye el trinquete de archivos de `G8`»

**Una lectura mía, que marco**: *«la épica no cierra con la lista sin vaciar»* lo escribí como el
cierre de HOS-1352, porque es el commit que ya extiende la regla a la lista entera. Si el owner lo
quería por sub-épica (HOS-1353 y HOS-1354 no cierran con archivos suyos en el trinquete), hay que
atribuir cada archivo a una mitad, y eso depende de D-1.

**Espejos.**

- La spec de verticales: `$V/spec.md:403` «y un trinquete de archivos, la»
- La fila de la limpieza: `$V/descomposicion.md:485` «y el trinquete nace con la»
- El criterio de `V1`: `$V/descomposicion.md:561` «y salvo en los archivos del trinquete»
- La limpieza en `V/21` §4: `V/21:534` «El código del sistema viejo que lo nombra no entra en esta limpieza»
- El invariante 32, con su cierre de lista viejo tachado: `nucleo/04:78` «lleva además un trinquete»
- El script del corte (con `VC-VT-11`): `D/16:308` «ni a sus tres carpetas ni a su»

### M-F y M-G · `puedeCobrarle`, la segunda pregunta de ida

**El nombre lo elegí yo y lo marco**: `puedeCobrarle(user) → sí | no`, con la forma de las demás
entradas del §4.1 y la pregunta de la letra F, *«¿le queda algo que todavía pueda cobrarle?»*. Si
el owner quiere otro, es un reemplazo en los lugares de abajo.

Contesta `sí` si a la cuenta, en cualquier vertical, le queda una suscripción principal o de
complemento en `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`: las filas
vivas sin `CANCEL_SCHEDULED` (M-G). La de arranque contesta `no`, que es la respuesta honesta sin
billing, como `retenciónDetenida` (§5.1).

- La firma: `D/12:1074` «puedeCobrarle(user)»
- El párrafo que la define: `D/12:1118` «es la otra pregunta de la dirección de ida»
- Sin estado: `D/12:1118` «Contesta sobre la cuenta entera y sin estado»
- Su lector: `D/12:1118` «Su único lector es la acción 24»
- La apertura de la frontera, en el §4: `D/12:1050` «Y se abre por otro más»
- Los espejos que decían una sola pregunta: `D/12:1083` «le pregunta dos cosas»
- `D/12:1088` «es ~~la~~ una pregunta de la dirección de ida»
- `D/12:1139` «Y la de ida son dos preguntas»
- La regla de vigilancia: `D/12:1268` «ni es la pregunta `puedeCobrarle` del §4.1»
- Los constructores: `D/12:1248` «seis entradas dicen su constructor»
- `D/12:1251` «y `puedeCobrarle` en `B4`, con la respuesta de arranque»
- La de arranque: `D/12:1340` «y a `puedeCobrarle` contesta `no`»
- La unidad `B4`: `$B/descomposicion.md:130` «y la de `puedeCobrarle`»
- La fila de `V4` y `V8`: `$V/descomposicion.md:475` «la respuesta de arranque (`no`) y su lector»

**El recuento del contrato**, con script sobre el bloque de firmas del §4.1: **7 → 8 entradas**
(siete preguntas y una operación); **13 campos en 4 consultas, sin cambio**, porque la nueva es un
sí o no, como `fichaPurgada`: pasan a ser **dos** sí o no.

- `D/12:1217` «Son ocho entradas: siete preguntas y una operación»
- `D/12:1220` «dos sí o no, `fichaPurgada` y `puedeCobrarle`»

**El inventario de *«fila viva»***: fila 27, en el grupo A, del lado de billing, que es donde se
evalúa. **26 → 27 filas.** `G-R1-E` no cuenta filas: exige que el consumidor figure, y figura.

- `nucleo/01:569` «la respuesta de `puedeCobrarle`»

**Las dependencias entre épicas no cambian: siguen once.** La pregunta la cubre la fila 2
(`B4` contra `V4`, *«la dirección de ida»*), como `retenciónDetenida`; y la flecha inversa, `V8` que
lee lo que contesta `B4`, no es de construcción, por el mismo argumento que la fila 13 tachada
(`DEC-ARCH-006`). Lo dejé escrito debajo de la tabla, para que nadie la sume.

- `$B/descomposicion.md:380` «`puedeCobrarle` no suma fila»

**La acción 24 y la baja manual (M-G).**

- El paso 1 termina cuando nada puede cobrar: `nucleo/08:102` «Alcanza con que ninguna pueda cobrar»
- El paso 3: `nucleo/08:116` «conteste `sí` (`12-contrato…` §4.1: una suscripción que todavía puede cobrar»
- La fila de la 24: `nucleo/08:203` «conteste `sí`, es decir mientras le quede»
- El criterio de `V8`: `$V/descomposicion.md:483` «a la que `puedeCobrarle` le»

### M-H · los avisos de retención y `pausaTerminadaEn`

- `nucleo/07:248` «los dos previos contados desde el más tardío de dos instantes»
- El criterio de la fila de `retenciónDetenida`: `$V/descomposicion.md:474` «y el aviso previo al archivado»

El previo al borrado conserva lo que ya decía (nunca antes de la fecha que anunció el archivado): la
fila ahora dice que los dos previos apuntan al día en que actuaría su lector, que es lo que hace
`PB9` con sus dos fechas.

## 2. Los catorce menores

### 2.1 Aplicados (texto, espejo o derivados sin elección)

**`VC-cobro-05`**: `A7` decide releyendo la orden por el id que vino en el error. No es una
elección: `D17` ya lo exige, y la alternativa era declararle una excepción.

- `B/03:2530` «leído releyendo por id la orden cuyo id vino en el cuerpo del error»
- `B/16:120` «La cierra releyendo la orden»
- `B/06:139` «releyendo la orden por su id (`A7`»

**`VC-cobro-07`**: la regla del error del receptor, reescrita como la recomendación.

- `B/03:2725` «Contesta error si no pudo guardar la entrega»

**`VC-cobro-08`, la mitad que es espejo**: la URL de IPN entra a la vuelta atrás como tercera cosa,
con su inverso. La otra mitad, cómo se verifica el apuntado, es una elección (§ 3, D-4), y el diseño
la marca con ⚠️ en el 4b y en la vuelta atrás.

- `D/16:366` «tres cosas, cada una con su inverso»
- `D/16:373` «(c) la URL de IPN»
- `D/16:141` «Cómo se verifica ese apuntado no está escrito»

**`VC-cobro-10`**: la frase de población de `B/12` §1.4, acotada a la baja por mora.

- `B/12:150` «por mora llega desde `GRACE_PERIOD`»

**`VC-VT-05`**: la *(d)* de `G-R6-B` vigila las dos mitades de F-A, en `V/20` y en su espejo de `B/20`.

- `V/20:70` «o no cuenta desde el más tardío de los dos instantes»
- `B/20:63` «o no cuenta desde el más tardío de los dos instantes»

**`VC-VT-10`**: la migración de `V1` reescribe toda columna que guarde un valor de
`PartnerTypeEnum`. Derivado: una fila con el valor viejo deja de validar cuando el enum ya no lo
tiene.

- `V/21:530` «y todo valor viejo en cualquier otra»
- `$V/descomposicion.md:485` «y ninguna otra columna que guarde un valor de `PartnerTypeEnum`»

**`VC-VT-11`**: *«que sigue en dos»* (en el mismo cambio que M-E) y los dos espejos del nombre
viejo de la 24.

- `V/19:44` «dar de baja su cuenta»
- `V/17:434` «dar de baja su cuenta»

### 2.2 Dejados para el owner

`VC-cobro-06`, `VC-cobro-08` (la verificación), `VC-cobro-09`, `VC-cobro-11`, `VC-VT-06`,
`VC-VT-07`, `VC-VT-08` y `VC-VT-09`: cada uno pide elegir entre caminos con costo distinto. Están
en el § 3.

## 3. Decisiones para el owner

**D-1 · Quién borra el sistema viejo después del corte (M-D, y la cola del trinquete de M-E).**
Hoy nadie. El cobro viejo (con sus cinco `package.json` que declaran `qzpay`) y el resto del código
viejo que nombra el agrupamiento viejo siguen en el repositorio después del corte, sin unidad que
los saque. *Con Juan*: el corte salió bien, Juan ya paga en el sistema nuevo, y tres meses después
`apps/api` todavía tiene las rutas del cobro viejo, sin usar, y el cierre de HOS-1352 no puede
pasar porque el trinquete no está vacío.

1. **Dos unidades nuevas, `B14` (retirar el cobro viejo) y `V10` (retirar el código viejo de
   verticales), que corren después del corte**. Cada una borra lo suyo, saca sus archivos del
   trinquete y, `B14`, las dependencias de `qzpay`. Costo: dos filas más en las descomposiciones y
   dos PRs. Riesgo: bajo; es código muerto, y cada unidad tiene criterio y revisión.
2. **Un paso 7 del corte**: una persona borra todo en un commit, el mismo día o la semana del
   corte. Costo: un paso más en un día ya cargado. Riesgo: un borrado grande sin revisión por
   partes, justo cuando algo del corte puede pedir mirar el código viejo.
3. **Dentro del commit del paso 6.** Costo: ninguno aparte. Riesgo: alto; mezcla el reemplazo de
   la historia de la base, que ya es delicado, con un borrado de más de mil archivos.

**Recomiendo la 1**: el trabajo es de las dos mitades, cada una sabe qué es suyo, y no carga el día
del corte. Los números `B14` y `V10` no se usaron nunca (grepeado).

**D-2 · Un `402` que no llega (`VC-cobro-06`).** Juan compra *«destacar 7 días»*, la tarjeta se
rechaza y la respuesta se pierde; aprieta *«pagar»* otra vez y no pasa nada hasta 72 horas después.

1. **El segundo pedido que encuentra la instancia con clave y sin id de orden reenvía con la misma
   clave y el mismo cuerpo** (seguro por `EX-41`): vuelve el `402` y corre `A7`. **Y un `409`** (otra
   tarjeta, mismo pedido) **muestra *«tu pago anterior se está procesando, probá en unos minutos»***,
   sin abrir un pedido nuevo. Costo: una rama en la pantalla. Riesgo: ninguno de doble cobro.
2. Lo mismo, pero **el `409` se trata como un rechazo y abre un pedido nuevo** (lo que recomendaba
   `30-`). Riesgo: si la primera orden en realidad se aprobó y lo perdido fue la aprobación, Juan
   paga dos veces; lo atrapa la comprobación de órdenes pagadas (motivo 23) y se devuelve, un día
   después.
3. **Dejarlo como está**: 72 horas pendiente. Sin costo; Juan no puede comprar en ese tiempo.

**Recomiendo la 1**: arregla la espera sin abrir un camino a un cobro doble.

**D-3 · Un cobro que llega después de la acción 24 (`VC-cobro-09`).** Juan pide la baja; su
cancelación en el proveedor no se confirmó, el barrido abre `CANCELACIÓN_SIN_CONFIRMAR` y deja de
reintentar, y el preapproval cobra el ciclo siguiente: el comprobante sale a nombre del seudónimo.
Con M-G esto es un poco más probable, porque la 24 ya no espera a que una `CANCEL_SCHEDULED`
termine.

1. **Las dos**: la 24 se rechaza también mientras la cuenta tenga una marca `CANCELACIÓN_SIN_CONFIRMAR`
   abierta (se suma a lo que contesta `puedeCobrarle`), y, si igual llega un cobro sobre una cuenta
   dada de baja, `P1` deja el nombre y el correo nulos y el comprobante sin enviar, como sobre una
   lápida, y el CHECK lo admite. Costo: una condición en `puedeCobrarle` y una rama en `P1`.
2. **Sólo la primera**: achica la población y no la cierra (un cobro en vuelo igual puede llegar).
3. **Sólo la segunda**: cierra el daño, pero soporte da de baja cuentas que todavía pueden cobrar.

**Recomiendo la 1**: son compatibles, y la segunda es la red de la primera.

**D-4 · Cómo se verifica el apuntado de la URL de IPN en el 4b (`VC-cobro-08`).** Si el 4b la apunta
mal, nadie lo ve hasta la revisión de HOS-1399, tres meses después.

1. **Verificarla con una entrega real de `payment`**: la herramienta del corte crea y paga una orden
   chica con la tarjeta del owner, mira que la entrega IPN se guardó, y la devuelve. Costo: un cobro
   y una devolución el día del corte, y unos minutos. Riesgo: bajo.
2. **Aceptar explícitamente que no se verifica**, escrito en el 4b. Sin costo; no mueve plata (el
   viejo descarta IPN), pero la tabla de HOS-1399 puede llegar vacía.

**Recomiendo la 1**, por robustez: el paso ya verifica los Webhooks con una entrega real, y el
IPN queda sin ninguna. La vuelta atrás ya la tiene como tercera cosa (§ 2.1).

**D-5 · El cliente `PARA_RESOLVER` (`VC-cobro-11`).** Juan paga un anual y el destino no ofrece el
anual: queda `PARA_RESOLVER`. Hoy no está escrito si recibe los correos (que prometen una fecha y un
precio que él no tiene), a qué pasa su fila cuando se lo resuelve, ni qué le hace una cancelación.

1. **Recibe sólo el correo del anuncio, con un texto que dice que lo van a contactar**; su fila sale
   a `FUERA` (*«cambió de plan»*) cuando se lo resuelve, o (*«terminó»*) si su suscripción termina
   antes, como M-A; y cancelar la migración la pasa a `CANCELADA`. Costo: un texto de correo y tres
   líneas en `B/10` §3.7.
2. Recibe los tres correos con un texto propio. Costo: tres textos. Riesgo: le anuncia una fecha
   que no existe.
3. No recibe ninguno: lo contacta una persona. Riesgo: se entera tarde, si nadie lo llama.

**Recomiendo la 1** (la de `30-`, más la extensión de M-A).

**D-6 · El correo de `PB12` cuando soporte corre la 24 enseguida (`VC-VT-06`).** Soporte borra las
dos fichas de Juan y un minuto después da de baja la cuenta: los dos correos de confirmación se
suprimen o salen hacia el seudónimo, según cómo se implemente.

1. **La fila de outbox guarda la dirección al encolarse, y la supresión por *«cuenta borrada»* no
   alcanza a lo encolado antes de la 24.** Costo: una columna en el outbox. Riesgo: ninguno.
2. **La 24 se rechaza mientras la cuenta tenga correos transaccionales pendientes.** Costo: una
   condición. Riesgo: frena a soporte unos minutos, y a veces más si un correo reintenta.

**Recomiendo la 1**, que no frena a soporte.

**D-7 · La presencia de un Partner que se da de baja (`VC-VT-07`).** Juan es Partner, pide la baja,
y su presencia (fotos, logo, secciones) queda en la base para siempre, sin verse.

1. **Declararlo**: la presencia se conserva sin mostrarse, como el contenido de una moderada. Costo:
   una línea en `nucleo/08` §1.3. Riesgo: guarda datos de una cuenta dada de baja sin plazo.
2. **Un paso más en la baja manual que la vacíe**, con una acción administrativa nueva (sería la 25).
   Costo: una acción, su unidad y su prueba. Riesgo: bajo. Cumple *«que soporte pueda borrar todo»*.

**Recomiendo la 2**, por lo que pidió el owner (*«todo»*), aunque `31-` recomendaba la 1 por
costo; si el owner prefiere no sumar una acción, la 1 es honesta.

**D-8 · La versión de plazos que guarda el corte (`VC-VT-08`).** La escritura `C` y la prueba del
paso 3 guardan una versión de plazos que nace después, en el 3a.

1. **La migración estructural crea la versión 1 de los plazos con los quince valores**, y el 3a
   sólo la verifica. Costo: los valores viven en la migración estructural. Riesgo: ninguno; la FK
   vale desde la primera escritura.
2. **La escritura `C` guarda el id de la versión 1, conocido de antemano, y el 3a la crea con ese
   id.** Riesgo: entre el paso 3 y el 3a la FK no se puede declarar, o hay que diferirla.

**Recomiendo la 1**.

**D-9 · Cuando muere el título que ancla la cuota (`VC-VT-09`).** Juan arranca la prueba el 5 y
contrata el 20: el ancla pasa al 20.

1. **La ventana en curso sigue hasta su fin, y la próxima arranca con el ancla nueva** (extender la
   regla 5 a *«cambia el título que ancla»*). Costo: una línea en `V/15` §7. Riesgo: ninguno.
2. **La ventana se corta el 20 y arranca otra.** Riesgo: dos cuotas en un mes, o una a medias.

**Recomiendo la 1**, que es el tratamiento que la regla 5 ya da al cambio de plan.

## 4. Para el log y la matriz (pide OK del owner)

Ninguna decisión nueva, ninguna `SUPERSEDED`, ninguna fila de matriz: **seis 📌**, todos sobre
decisiones que ya estaban precisadas. Grepeados antes: existen `DEC-SUB-023`, `DEC-ARCH-004`,
`DEC-ARCH-012`, `DEC-ARCH-006`, `DEC-DATA-005` y `DEC-DATA-006`, y las seis figuran en la lista de
precisadas del script. Cada 📌 va al final de su entrada, y cada *Estado* suma al final, antes de
*«· Decide»*, con el separador que el campo ya usa entre sus precisiones, el texto de la columna de
abajo.

| decisión | qué suma al *Estado* |
|---|---|
| `DEC-SUB-023` | **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-A, M-B y M-C; ver su último 📌) |
| `DEC-ARCH-004` | **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-D; ver su último 📌) |
| `DEC-ARCH-012` | **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-E y `VC-VT-10`; ver su último 📌) |
| `DEC-ARCH-006` | **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-F; ver su último 📌) |
| `DEC-DATA-005` | **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-F y M-G; ver su último 📌) |
| `DEC-DATA-006` | **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-H y `VC-VT-05`; ver su último 📌) |

Los seis 📌, con el texto exacto:

```markdown
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-A, M-B y M-C)**: Toda
  llegada de una suscripción a un estado terminal, por cualquier camino, también la muerte de la
  predecesora en una sucesión, pasa su fila de alcance `PENDIENTE` a `FUERA` en la misma
  transacción, con un tercer motivo, "terminó"; los correos de la migración leen `PENDIENTE` y dejan
  de salir. La cohorte son las filas principales de la versión retirada en `PENDING_AUTHORIZATION`,
  `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`; `CANCEL_SCHEDULED` no entra, y las que no están
  `ACTIVE` esperan como una pausada. Sobre un pagador manual `S37` no relee ni muta: encola el
  cambio de versión para la fecha de aplicación y pasa la fila a `APLICADA`, y `S38` cambia la
  versión antes de que `MP5` abra la cuota de ese período. Entre `S37` y su `S38` el monto esperado
  es el precio de lista de la versión destino para su ciclo, sin promos, como en el downgrade, y el
  motivo 24 deriva el precio de la versión que rige el período que cubre el cobro.
```

```markdown
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote M-D)**: El predicado (a)
  de `G16` mira el package del cobro, su `package.json` y sus imports, y no el repo: el sistema
  viejo corre con `qzpay` hasta el corte, y el 2026-09-29 lo declaraban cinco `package.json` del
  repo. El cobro viejo sale del repositorio después del corte, con sus dependencias de `qzpay`
  (`D/16` §4.5, punto 3).
```

Si el owner decide D-1, este 📌 suma al final: *«Lo borra `<la unidad o el paso elegido>`.»*

```markdown
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote M-E y `VC-VT-10`)**:
  Además de sus tres carpetas, la lista de pendientes de `G8` lleva un trinquete de archivos: `G8`
  nace con la lista medida de los archivos que ese día nombran el agrupamiento viejo fuera de las
  carpetas y del PDR, que es el código del sistema viejo (unos 1229 el 2026-09-29, sobre
  `origin/staging`). La lista sólo se achica: falla una aparición nueva, falla un archivo de la
  lista que ya no lo nombra o que ya no existe, y la unidad que lo reescribe o lo borra lo saca en
  el mismo cambio, y falla una lista que crece. La genera un script que es el propio `G8` en modo de
  generación, sobre el árbol del commit de `V1`, y guarda las rutas con el nombre enmascarado. La
  regla del paso 6 no lo alcanza; la que extiende el cierre de HOS-1352 sí, así que el programa no
  cierra con el trinquete sin vaciar. Y la migración de datos de V1 reescribe a `business` el valor
  viejo en toda columna que guarde un valor del tipo de partner, también
  `alliance_leads.partner_type`.
```

```markdown
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote M-F)**: La dirección de
  ida gana una segunda pregunta, `puedeCobrarle(user) → sí | no`, que billing contesta sobre la
  cuenta entera y sin estado: `sí` si le queda una suscripción, principal o de complemento, en
  `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`, las filas vivas sin
  `CANCEL_SCHEDULED`. Su único lector es la acción 24; la real la construye `B4` y la de arranque,
  que contesta `no`, `V4`. El contrato pasa a ocho entradas, siete preguntas y una operación, con
  los mismos trece campos, y la pregunta entra al inventario de consumidores de "fila viva" que
  vigila `G-R1-E`. No suma dependencia entre épicas: la cubre la de la dirección de ida, y siguen
  siendo once.
```

```markdown
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-F y M-G)**: La acción
  24 se rechaza mientras `puedeCobrarle` conteste `sí` o le cuelgue una ficha fuera de `PURGED`, y
  no mientras le cuelgue una fila viva, que verticales no puede evaluar. Una suscripción en
  `CANCEL_SCHEDULED` no la traba: ya está dada de baja en el proveedor y termina sola por `S12`,
  sobre la cuenta ya dada de baja. El paso 1 de la baja manual termina cuando ninguna suscripción de
  la cuenta puede cobrar.
```

```markdown
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote M-H y `VC-VT-05`)**: Los
  avisos previos de retención cuentan desde el más tardío de los dos instantes, con la versión de
  plazos de la ficha, y apuntan al día en que actuaría su lector; la fecha objetivo de su ocurrencia
  sale de esa cuenta. Y la mitad (d) de `G-R6-B` falla también sobre un lector de retención que
  consulta `retenciónDetenida` y no cuenta desde el más tardío de los dos instantes.
```

**El `## Resumen` del log**: una fila nueva, al final de la tabla.

```markdown
| Verificación corta | **0 nuevas, 6 📌, 0 `SUPERSEDED`**, del 2026-09-29, sobre los ocho hallazgos que bloquean (el lote M de `30-revision-del-owner/32-`, todas la recomendada) y los menores que se aplicaron sin elección (`30-` y `31-`). 📌: `DEC-SUB-023` (M-A, M-B, M-C), `DEC-ARCH-004` (M-D), `DEC-ARCH-012` (M-E, `VC-VT-10`), `DEC-ARCH-006` (M-F), `DEC-DATA-005` (M-F, M-G) y `DEC-DATA-006` (M-H, `VC-VT-05`). Registro: `30-revision-del-owner/33-aplicacion-lote-m-y-menores.md` |
```

Y en la celda de precisadas, al final de su paréntesis de recuentos: *«; y recontado con script el
2026-09-29, tras los seis 📌 de la verificación corta: caen sobre decisiones ya precisadas y no
suman»*.

**Cifras simuladas con script** (el log con los seis *Estado* cambiados, en
`aplic-33/log-sim.md`): **135 decisiones → 135**, **68 precisadas sin `SUPERSEDED` → 68**, **11
`SUPERSEDED` → 11**. La matriz no cambia: **114 = 61 · 15 · 24 · 14**. Si el owner elige la 1 de
D-4, no suma fila: es una verificación del corte, no una medición del proveedor.

## 5. Conteos que cambiaron

| qué | antes | después | cómo |
|---|---|---|---|
| entradas del contrato (§4.1) | 7 | **8** | script sobre el bloque de firmas: líneas con flecha |
| campos en consultas | 13 en 4 | **13 en 4** | el mismo script: campos entre llaves |
| sí o no del contrato | 1 | **2** | el mismo script |
| consumidores de *«fila viva»* | 26 | **27** | filas numeradas entre los dos encabezados de inventario de `nucleo/01` §2.4 |
| dependencias entre épicas | 11 | **11** | filas vivas de la tabla de `$B/descomposicion.md` §2.10 |
| motivos de un `FUERA` | 2 | **3** | `B/02` §2.2 |
| pendientes de `G8` | 3 entradas | **3 carpetas y un trinquete** | `V/20` §2 |

**Lo que no se movió**: los 33 guards, las 34 transiciones vivas de la suscripción, las 7 de la
instancia, los 24 motivos de marca, las 23 acciones administrativas vivas, los 15 plazos
configurables, los cinco estados de la fila de alcance, y la matriz.

## 6. Casos vecinos

Ninguno bloquea.

## 7. Para la implementación

1. **Un addon `UNA_VEZ` en `PENDING_AUTHORIZATION` puede cobrar después de la 24**, si `A3`
   reenvía su orden dentro de las 72 horas. `puedeCobrarle` pregunta por suscripciones, como la
   precondición que reemplaza. Es la población de D-3 en chico; si el owner elige la 1 de D-3, la
   rama de `P1` la cubre también.
2. **`S12` corre sobre una cuenta ya dada de baja** (M-G), y sus correos van a una cuenta
   seudonimizada: es la jerarquía de supresión de D-6.
3. **La fila (6) de lectores de `inactiva_desde` en `V/02` §2.5** imprime *«`inactiva_desde` +
   180»* al archivar; con una pausa terminada después, la fecha real es la del más tardío. Es la
   misma forma que M-H en otro lector; no lo toqué porque la fecha impresa sale de
   `listing.borrado_anunciado`, que `PB9` ya respeta.
4. **`03-handoff.md`** sigue con las cifras de antes (siete entradas del contrato, tres pendientes de
   `G8`): lo actualiza el owner.

## Key Learnings

1. Un trinquete de archivos no puede reemplazar una lista de carpetas donde nacen archivos
   nuevos legítimos: son dos clases de pendiente, y hay que decir cuál tiene fecha de salida y cuál
   sólo se achica.
2. Una lista de rutas que tiene que vigilar una palabra prohibida la contiene en sus propios
   nombres de archivo: la lista tiene que enmascararla igual que el guard arma su patrón.
3. Una pregunta nueva de un contrato no suma una dependencia de construcción si la dirección ya
   estaba cubierta y el lector se construye contra la respuesta de arranque; decirlo al pie de la
   tabla evita que alguien la sume.
4. Escribir qué estados entran a una cohorte obliga a revisar la regla de espera: al sumar
   `SUSPENDED` y `PENDING_AUTHORIZATION`, el recálculo que sólo nombraba pausa y grace dejaba una
   fila sin `S37`.
