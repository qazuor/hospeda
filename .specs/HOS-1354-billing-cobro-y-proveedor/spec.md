---
title: Billing — cobro, suscripción y proveedor detrás de un adaptador
linear: HOS-1354
statusSource: linear
created: 2026-09-18
updated: 2026-09-26
type: feature
areas:
  - billing
  - api
  - db
parent: HOS-1352
---

# Billing — cobro, suscripción y proveedor detrás de un adaptador

> **Esta épica se sostiene sola en su diseño, y desde el 2026-09-24 ya no está bloqueada.** ~~Trece
> capítulos escritos, uno sin escribir —el `13` (Pagos)—, que se difirió porque era el que más
> dependía de con qué pasarela íbamos a cobrar. **`DEC-MP-005` fijó Mercado Pago**, así que el `13`
> se escribe entero. Lo que queda antes de escribirlo no viene de afuera: es **una decisión de
> diseño**, quién tiene el reloj de cobro.~~ **Trece capítulos escritos y ninguno pendiente**: el
> `13` (Pagos) **no se escribió, se repartió** entre los capítulos que lo reclamaban (2026-09-24,
> §2 y [`nucleo/00-indice.md`](../HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md)).
> **`DEC-MP-005` fijó Mercado Pago** y **`DEC-MP-006` contestó quién tiene el reloj de cobro: el
> proveedor** (§5.1). *(Corregido el 2026-09-25, FASE 9 completa, salida 3 de `DEC-METH-004`: el
> párrafo describía el estado de la mañana del 24/09.)*
>
> **No sale a producción sola** (`DEC-ARCH-007`): las dos épicas llegan juntas y terminadas.

## 1. ~~Qué la bloquea, exactamente~~ Qué la bloqueaba, y ya no

> ✅ **Nada la bloquea desde el 2026-09-24** (FASE 9 completa, salida 3 de `DEC-METH-004`): la
> pasarela es **Mercado Pago** (`DEC-MP-005`), el reloj de cobro es **del proveedor**
> (`DEC-MP-006`) y la evaluación de proveedor se cerró en el paso 4 de 6 sin completarse. Lo que
> sigue en este § es **el estado de antes de esa decisión** y se deja como rastro: la PRUEBA 0 no
> se envió y ya no hace falta, y la sonda de Mobbex nunca tuvo cuenta contra la que correr.

~~**No es el diseño: es que no está decidida la pasarela.**~~ `DEC-ARCH-004` puso el ciclo de vida de
nuestro lado y dejó la pasarela detrás de un adaptador — al proveedor se le pide **cobrar,
reembolsar, leer y avisar**, y nada más. Pero el adaptador de referencia ~~sigue sin decidirse~~
estuvo sin decidirse hasta el 2026-09-24:

| | |
|---|---|
| **Mercado Pago** | niega el cobro a demanda con un `403 "The application is not authorized to perform this type of payment"` en **las cuatro variantes** del request. Es un portón comercial, no un error del pedido. La PRUEBA 0 (§5.0 del documento 10) son dos textos ya redactados que **el owner tiene que enviar** |
| **Mobbex** | documenta el cobro a demanda **con monto libre** —exactamente lo que `DEC-ARCH-004` necesita— pero el alta propia quedó en **revisión manual de KYC**. Sin entidad aprobada no hay token. La batería de sondas está escrita y lista |
| **el resto de la plaza** | búsqueda externa del 2026-09-18: **ningún proveedor argentino ofrece el cobro a demanda como self-service**; los cinco relevados exigen alta comercial previa |

**Lo que NO la bloquea**: casi todo el diseño. Suscripción, grace, pausa, promos, cortesías,
grants, addons, conciliación, idempotencia y las máquinas de estado del dinero **ya están
escritos**.

## 2. El diseño de esta épica

Trece capítulos en [`docs/`](./docs/), y **cinco de ellos son billing sin una sola fisura** —
ninguna de sus secciones sobrevive sin la pasarela.

| # | capítulo | qué resuelve |
|---|---|---|
| `02` | [modelo de datos](./docs/02-modelo-de-datos.md) | `billing_option` —donde vive el precio—, suscripción, pausa, el vínculo con el proveedor, el dinero, addons y concesiones |
| `03` | [máquinas de estado](./docs/03-maquinas-de-estado.md) | ~~**siete**~~ **ocho**: Suscripción (~~`S1`–`S35`~~ ~~`S1`–`S36`~~ ~~`S1`–`S37`~~ `S1`–`S38`: `S36`, la revocación, owner 2026-09-26, `G5-4`; **`S37`, la aplicación de una migración**, revisión del owner, 2026-09-28, C15; **`S38`, la que aplica la cola de cambios programados**, revisión del owner, casos vecinos, 2026-09-29, caso 37; `S25`–`S28` retiradas con su número, C8), Grace, Pausa, Pago, **Reembolso** (§6.1, `RF1`–`RF5`: owner 2026-09-25, `DEC-RF-008`), Pago manual, Addon, y la regla de no-retroceso |
| `05` | [idempotencia y concurrencia](./docs/05-idempotencia-y-concurrencia.md) | los tres mecanismos, los seis cruces del §52, y qué hace seguro a un pago tardío |
| `06` | [proveedor](./docs/06-proveedor.md) | las ocho capacidades, las seis reglas duras de trato, el riesgo de plataforma |
| `09` | [conciliación](./docs/09-conciliacion.md) | las cuatro partes, los ~~tres~~ **cuatro** modos de «cero cobros» (§4, reescrito el 2026-09-24 por `RC-5`), y el bug vivo que pasa a ser caso de uso |
| `10` | [retiro de plan ~~y vertical discontinuada~~](./docs/10-verticales-planes-billing-options.md) | retirar no mueve a nadie, **tampoco retirar todos los planes de una vertical**; ~~discontinuar **deja de cobrar antes de dejar de prestar**~~ discontinuar una vertical queda fuera de esta versión (revisión del owner, 2026-09-28, C8) |
| `12` | [suscripción](./docs/12-suscripcion.md) | el grace, la cola de cambios programados, el precio que cambia entre programar y ejecutar |
| `14` | [promos, cortesías y grants](./docs/14-promos-cortesias-y-grants.md) | el orden de aplicación y el piso, y cómo se combinan entre sí |
| `16` | [addons](./docs/16-addons.md) | dos ejes, qué es una suscripción «válida», el addon a costo cero, el huérfano **y el estado en que queda su cobro** — y desde el 2026-09-25 **los addons siguen a su título**: *válida* es `ACTIVE` y ~~cobrada~~ pagando (`NUCLEO/01` §2, no el campo `cobrada` del contrato; FASE 9 vuelta 1, `F-8V1D1-002`), se pausan con la pausa del cliente (`S32`, `S33`), la orfandad se lee sobre el conjunto de principales y anclas vivas, y un `USER`/`GLOBAL` se emite sólo en sus verticales compatibles (owner, `DEC-ADDON-007`) |
| `19` | [superficies](./docs/19-superficies.md) | la pricing, Mi Suscripción y la baja |
| `20` | [testing](./docs/20-testing.md) | las cuatro capas y ~~**dieciséis guards**~~ ~~**quince guards**~~ ~~**catorce guards**~~ **diecisiete guards** —`G7`, ~~`G9`–`G13`~~ `G9`–`G12` (`G13` pasó a `V/20` §2 y lo construye `V4`: owner 2026-09-26, `G5-5`), **`G15`–`G17`** (revisión del owner, 2026-09-28: las dos listas del falso, `qzpay` que vuelve y la decisión sin releer), los seis de `R1` y las ~~**cuatro**~~ **tres** referencias cruzadas (sale `G-R5`: revisión del owner, 2026-09-28, C14)—, el proveedor falso que **tiene que mentir** ~~, y la suite de sandbox~~ **con sus dos listas cerradas, la batería que vigila a Mercado Pago, y el E2E que reemplaza el smoke manual sección por sección** (revisión del owner, 2026-09-28, C13, N3) |
| `21` | [migración](./docs/21-migracion.md) | la premisa del §56 medida, y el cobro durante el rediseño — **y la cartera actual no se migra: de su billing no se conserva nada, y se conservan el usuario, sus preferencias y sus fichas** (owner 2026-09-25, `DEC-MIG-005`) |
| `22` | [lo legal](./docs/22-lo-legal.md) | el aumento, la revocación y el botón de arrepentimiento |

✅ **El `13` (Pagos) NO existe, y no es un pendiente: se repartió** (2026-09-24). Ver §5.1 y el
reparto completo en [`nucleo/00-indice.md`](../HOS-1352-billing-verticals-redesign/docs/nucleo/00-indice.md).

### 2.1 Lo que cita y no contiene

| qué | dónde |
|---|---|
| **el núcleo** — reglas de escritura, glosario, invariantes, outbox, auditoría, y el método del modelo de datos y de las máquinas | [`docs/nucleo/`](../HOS-1352-billing-verticals-redesign/docs/nucleo/) |
| **el contrato de cobertura** — la frontera con la otra épica | [`12-contrato-de-cobertura.md`](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) |
| **el PDR, el decision log y la matriz del proveedor** | [`docs/`](../HOS-1352-billing-verticals-redesign/docs/) |

---

## 3. Las definiciones declaradas

### 3.1 Al proveedor se le piden cuatro cosas, y el ciclo de vida es nuestro

`DEC-ARCH-004`. **Cobrar, reembolsar, leer y avisar.** El package concentra el dominio entero —el
reloj de la pausa, el dunning, los reintentos, las cortesías y el candado contra el doble cobro— y
**la pasarela queda como un detalle al fondo**.

Dos condiciones que lo hacen exigible: un **guard estático** que prohíba importar el SDK fuera del
adaptador, y un **adaptador falso en memoria desde el día uno** — que es lo que prueba que la
abstracción no miente.

**`qzpay` se saca, y el cobro nuevo se escribe en un package compartido del monorepo ~~que se puede
publicar solo~~** (revisión del owner, 2026-09-28, N2). Todo el cobro nuevo vive **bien encapsulado
en un package compartido**, ~~escrito de modo que mañana se pueda publicar como package npm propio
**sin reescribirlo**~~ **del repo; publicarlo en npm pediría reescribir sus dependencias internas**
(revisión del owner, casos vecinos, 2026-09-29, caso 30): **no depende de ninguna app ni de la
mitad de verticales, salvo del package del contrato** (`12-contrato…` §7.1). **Sí puede depender
de otros packages internos de Hospeda** (`@repo/*`), con la regla del owner, textual: *«siempre
que sea simple evitar la dependencia de otro package de Hospeda, evitalo; si es complejo, la
dejamos y en el futuro se reverá»*, porque *«no quiero demorar la salida de esta épica por
eso»*. `G16` falla si vuelve `@qazuor/qzpay` ~~**al package del cobro** (verificación corta, 2026-09-29, lote M-D)~~ **a cualquier `package.json` o import del repo**, del que la limpieza del principio lo saca antes de `B1` (verificación corta, 2026-09-29, lote N-A; `16-fase-7…` §4.6), o si el package importa de `apps/` (`B/20` §2), **y
no mira sus dependencias hacia packages internos**; y `G14` ya vigila que no importe de
verticales. **`qzpay` queda sólo como
referencia de lectura**: su adaptador de Mercado Pago sirve para ver cómo se arma un pedido o se
verifica una firma; **su motor y su esquema no**, porque el modelo nuevo es otro (`DEC-METH-007`,
`DEC-MIG-003`). Lo que se toma de él pasa el filtro 2 de `DEC-METH-007`: un test que falla si se
rompe, contra una fila de la matriz. Y **se congela y se archiva después del corte**
(`16-fase-7-del-paraguas.md` §4.5).

**Y las pasarelas NO son intercambiables.** La API no expone el mínimo común denominador: **para
cada capacidad se declara qué pasa cuando el proveedor no la tiene** — se emula, se degrada, o se
bloquea la función del producto. Un adaptador que finge paridad es peor que ninguno, porque el
código de arriba le cree.

### 3.2 El riesgo se trasladó hacia nosotros, y está declarado

Con el ciclo de vida de nuestro lado, **un doble cobro es nuestro bug y es plata de un cliente
real**. Está medido que ni Mercado Pago ni Mobbex ofrecen idempotencia en la creación, así que
**el candado es nuestro y va antes de llamar al proveedor** (`DEC-CONC-001`).

Se aceptó el trade por dos razones: un bug nuestro se arregla y uno del proveedor no, y **nadie
puede testear lo que no controla**.

### 3.3 El código de estado no cierra ninguna mutación

**Toda mutación se verifica releyendo y comparando campo por campo.** No es criterio: es medición
—de ocho operaciones que el PDR pediría, **cinco devuelven `2xx` y no aplican nada**—. No es un
proveedor que rechaza lo que no soporta: es uno que **acepta y descarta**. (Las cinco tienen fila
en la matriz: `EX-4`, `EX-21`, `EX-34`, `EX-35` y `CN-1`, la M1 de `B/20` §3.2, que suma `EX-5`; el
*«de ocho»* es de este párrafo y no de una fila. La presentación lo cita como *«5 de 8»* y se
corrige al publicarla: revisión del owner, casos vecinos, 2026-09-29, caso 29.)

Y no alcanza con releer «la» mutación: un `PUT` con varios campos **se aplica a medias con un solo
`200`**. El que falla no arrastra al que funciona.

### 3.4 Las cuatro decisiones de mecanismo que ya están tomadas

| | |
|---|---|
| **la pausa** | es la **nativa del proveedor**, en **meses enteros**, y los días no usados del ciclo en curso se pierden — con ciclos enteros el cliente vuelve el mismo día del mes, así que lo perdido se compensa con lo que gana al volver. **El reloj que la reanuda es nuestro** (`DEC-SUB-010`) |
| **la cortesía temporal** | se implementa **pausando** en el proveedor y sosteniendo el servicio de nuestro lado. Es la única de las cuatro estrategias medidas que **no mueve un peso** (`DEC-GRANT-003`) |
| **cada addon recurrente** | es **una autorización aparte**, no una línea del monto del plan. Subir el monto toca plata cada vez, en el punto exacto donde el proveedor acepta sin aplicar — y esa mutación **no emite aviso** (`DEC-ADDON-002`) |
| **el cambio de precio** | se muta el monto de la autorización vigente; el aviso previo se cumple **de nuestro lado** (`DEC-MP-001`) |

### 3.5 Nunca se le pide un trial al proveedor

Está medido que **una fecha de primer cobro futura se convierte en un free trial sola**: el request
no lo nombra, el objeto queda con uno, y al comprador se le anuncia *«Tu prueba gratis comenzó»*.

Como la fecha futura es la **precondición de seguridad** de todo cambio de plan y de ciclo, no se
puede evitar: **se anticipa, no se desmiente**. Y el guard tiene que mirar la relectura, porque
**en el payload no hay nada que ver**.

### 3.6 La copy del proveedor no sostiene ninguna decisión

Tres textos suyos contradicen sus propios datos. **Regla para soporte, que sale directo de la
medición: ante un reclamo, mirar el PAGO, nunca el correo.**

### 3.7 El proveedor falso tiene que mentir

No alcanza con que responda bien: **tiene que reproducir los modos de falla medidos** —aceptar y no
aplicar, responder `2xx` sobre lo que descartó— porque un doble tiene que fallar como el original.
**Y miente sólo donde dice una lista cerrada de trece mentiras medidas**, con las reglas propias
del proveedor en otra lista, y una batería que corre contra el real cada semana en la cuenta de
pruebas, cada mes en producción y a mano cuando se quiera, que avisa y no ajusta nada (`B/20` §3.2
y §4.1; revisión del owner, 2026-09-28, C13, `L3-c` y `L3-d`).
El e2e que corre hoy contra un stub honesto **no puede, por construcción, detectar divergencias**
con el proveedor real.

---

## 4. El contrato con la épica de verticales

Esta épica **entrega** un hecho y un aviso, y nada más: una consulta de cobertura por
`user + vertical`, y el evento que avisa que esa cobertura cambió. Los dos están definidos —y
**sólo** definidos— en
[`12-contrato-de-cobertura.md`](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md):
**la firma exacta, con todos sus campos y su tabla de qué es cada uno, es su §2**; el aviso es su
§3; qué emite cada uno de los nueve estados de la suscripción, su §2.6.

> **Acá no va una copia de la firma, y la ausencia es el arreglo.** `DEC-ARCH-006` protege al
> contrato de que una épica lo mute sola, pero **una copia no necesita que nadie la mute para
> divergir: alcanza con que el contrato avance**. Ésta existió y divergió — publicaba **tres campos
> de cinco**, sin `alcance` y sin `objetivo`, que son justamente los dos que esta épica tiene que
> llenar para que un addon comprado para una ficha no habilite su capacidad en toda la cartera
> (`F-8dC2-001`). El campo que haga falta acá se lee allá.

**Lo que esta épica implementa son cuatro de las seis fuentes** —suscripción, cortesía, grant y
addon—; las otras dos, el trial y el título `BASE`, son de la otra épica y ya existen (contrato
§5.1 y §5.2). Se enchufa: **no modifica nada de lo construido**.

**Y devuelve un puntero, nunca los valores.** Quién sabe *qué otorga* un plan es verticales;
quién sabe *cuál plan* tiene esta persona es esta épica. Devolver los entitlements resueltos
mudaría la resolución del capítulo 15 para este lado y sería la segunda fuente de algo que tiene
que tener una sola.

**No cruzan la frontera** montos, precios, estados de pago, ids del proveedor ni fechas de cobro
—sobre cobros cruza un solo bit, `cobrada`, declarado en el contrato §4 (`DEC-TRIAL-010`)—.
**Y una fuente `GRANT` lleva además su `piso`**, la versión de plan del trinquete (owner
2026-09-25; FASE 9 completa, 9h): la firma pasó a ~~**siete campos por fuente**~~ **siete campos
por fuente, y a ocho con `desde`** (revisión del owner, 2026-09-28, C4: el instante en que la
fuente empezó a cubrir, que ancla la cuota mensual y no es fecha de cobro), y el piso sigue
siendo **un puntero, no un valor** — por eso cruza sin romper la regla de arriba, y verticales deja
de leerlo de `permanent_grant_vertical`.
Ni siquiera el estado exacto de la suscripción: verticales no distingue `ACTIVE` de
`GRACE_PERIOD`, porque durante el grace **el servicio sigue**.

---

## 5. Lo que no se puede cerrar todavía

### 5.1 El capítulo 13 (Pagos), y la pregunta que lo gobierna — ✅ CONTESTADA el 2026-09-24

~~Es el único de los 22 sin escribir, y se difirió a propósito.~~ **Ya no existe como capítulo**:
lo que debía se repartió el 2026-09-24 entre `B/02` §2.3, `B/03` `S29` y §6.1, `B/05` C5 y `B/06`
§4.6 (`nucleo/00-indice.md`, *«El capítulo `13` NO existe»*). **La pregunta que lo gobernaba era
ésta:**

> **¿El capítulo 13 adopta el cargo puntual contra tarjeta guardada como modelo canónico, tratando
> el mandato del proveedor —lo que Mercado Pago hace hoy— como modo degradado?**

<!-- -->

> ✅ **Contestada por `DEC-MP-006`: NO. El reloj de cobro es del proveedor, y el mandato
> (`preapproval`) es el modelo canónico.** No por preferencia: **`EX-31` midió que el cargo puntual
> contra credencial guardada devuelve `403` en las cuatro formas de pedirlo**, y el rechazo es del
> **permiso**, no del pedido — la misma orden sin esos nodos entra con `201`. ~~El cargo puntual queda
> **declarado como destino**, con la habilitación pedida en paralelo y~~ **El cargo puntual dejó de
> ser destino el 2026-09-26** (📌 de `DEC-MP-006`: la habilitación no tuvo respuesta y no se espera
> más), y queda la obligación de que la interfaz del capítulo 13 no impida migrar. **Lo que el §5.2 anota abajo sigue valiendo entonces**:
> con el reloj del proveedor, las filas del cobro fallido **siguen siendo bloqueantes de diseño**.

No se puede esquivar, porque decide **quién tiene el reloj**, y eso no se esconde detrás de una
interfaz: **dos relojes sobre la misma autorización son el doble cobro** que `DEC-ARCH-004`
declara como riesgo nuestro.

**Un costo que la decisión no enumeró** y que trajo la búsqueda externa: si el reloj es nuestro,
**los reintentos también lo son, y son terreno regulado** — hay códigos de rechazo que no se pueden
reintentar nunca, hay techo de intentos por ventana y hay multas por excederlo. Hoy eso lo absorbe
Mercado Pago dentro del `preapproval`.

### 5.2 Las ~~ocho~~ ~~seis~~ ~~cuatro~~ ~~cinco~~ ~~diez~~ doce filas que siguen `UNKNOWN`

~~De las 89 de la matriz, contadas con `contar-filas-de-la-matriz.py`. **Cinco son el mismo hecho —
un cobro que falla** — y con Mercado Pago resultó **imposible de fabricar**: `RN-2`, `RN-3`,
`GR-1`, `GR-2`, `GR-3`. Más `WH-5`, `RF-3` y `EX-1`.~~

**Recontadas el 2026-09-25** con `contar-filas-de-la-matriz.py` (FASE 9 completa, salida 3 de
`DEC-METH-004`): **~~98~~ ~~99~~ ~~104~~ ~~107~~ ~~111~~ ~~112~~ 114 filas — ~~55~~ ~~56~~ ~~55~~ 61 `VERIFIED`, ~~14~~ ~~15~~ ~~17~~ 15 `PARTIALLY_SUPPORTED`, ~~23~~ 24 `NOT_SUPPORTED`, ~~6~~ ~~5~~ ~~4~~ ~~5~~ ~~10~~ ~~13~~ ~~16~~ ~~17~~ 14
`UNKNOWN`** (`RN-3` cerró la noche del 25/09; `GR-1` el 26/09, `VERIFIED`; **`EX-42` entró el 26/09**, owner, `Y-1`; **`EX-43` a `EX-47` entraron el 27/09**, FASE 9 vuelta 2, con OK del owner; recontado ese día; **`EX-48` a `EX-50` entraron el 28/09**, FASE 9 vuelta 2, verificación, con OK del owner, `V2-y`; recontado ese día; **`EX-51` a `EX-53` y `WH-6` entraron el 28/09**, revisión del owner, y **`WH-5` y `EX-15` se reabrieron** a `PARTIALLY_SUPPORTED`; recontado ese día; **`EX-54` entró el 29/09** (revisión del owner, casos vecinos, 2026-09-29, caso 34), recontado ese día; **el 29/09 cerraron `WH-5`, `WH-6`, `EX-15`, `EX-52` y `EX-53` y entraron `EX-55` y `EX-56`** (mediciones de los dos canales), recontado ese día). De las ~~trece~~ ~~dieciséis~~ ~~diecisiete~~ catorce, **`EX-49`**, la lista del seudónimo del correo, **es de verticales** (`V/02` §2.2) y no va en esta tabla: acá se listan doce; ~~y las tres del 28/09 (`EX-52`, `EX-53` y `WH-6`) todavía no tienen fila en ella, ni `EX-54` (revisión del owner, casos vecinos, 2026-09-29, caso 34)~~ `EX-52`, `EX-53` y `WH-6` salieron el 29/09 (mediciones de los dos canales), y `EX-54` no tiene fila (revisión del owner, casos vecinos, 2026-09-29, caso 34). De las ocho de antes cerraron `RN-2` y `GR-3` (el 22/09: el cobro fallido **sí** se
fabricó, en producción), `WH-5` (`VERIFIED`) y `EX-1` (`PARTIALLY_SUPPORTED`), y entraron dos
nuevas. ~~Las seis~~ Las que quedan (`RN-3` ya no es `UNKNOWN` pero sigue condicionando el grace;
`GR-1` salió el 2026-09-26), y qué condiciona cada una:

| fila | qué condiciona |
|---|---|
| `RN-3` · `GR-2` | la recuperación tras un cobro fallido y el pago tardío después de suspender (§22). Las lee el grace de `B7`; la cita de `RN-3` que usa `DEC-SUB-019` se lee *«observado, no registrado»* (su 📌 del 2026-09-25) |
| ~~`GR-1`~~ | ~~**condiciona `DEC-SUB-021`**: si un pago con la tarjeta cambiada durante el grace cierra el ciclo fallido. Se mide con el próximo rechazo mensual real, y mientras tanto la pantalla y los correos del grace no lo prometen (owner 2026-09-25, 3a)~~ (tachado 2026-09-26) **`VERIFIED` el 2026-09-26** (sonda 49): un pago dentro de la ventana cierra el ciclo fallido, y cambiar el medio dispara un reintento en el momento que cobra con el nuevo. `DEC-SUB-021` deja de estar condicionada y la pantalla puede decir que al cambiar la tarjeta se reintenta el cobro |
| `PA-6` ✚ | si el proveedor cancela el preapproval ante cualquier primer rechazo. **No decide** `DEC-SUB-022`: decide **cuánto dura** el grace de la sucesora de quien venía pagando, y el barrido lo acota a un día (owner 2026-09-25, 3c) |
| `RC-8` ✚ | qué estado lee el pago en un contracargo. **Fuente documental**: `DEC-SUB-020` fija qué hacemos al leerlo, no cómo se comporta el proveedor |
| `RF-3` | el plazo máximo para reembolsar. **Ya no bloquea** (`DEC-RF-007`): pasado el plazo la operación no se ofrece y la reparación es manual, asentada por `RF4` (`DEC-RF-008`) |
| `EX-42` ✚ | si el `expire` de qzpay vence una `Preference` de Checkout Pro y la relectura lo confirma. **No es de esta épica**: condiciona el paso 1a del corte (`16-fase-7-del-paraguas.md` §4.2), que vence las del cambio de plan del viejo, y se mide en su paso 0 (owner 2026-09-26, `Y-1`) |
| `EX-43` ✚ | si reenviar una orden con la misma clave y el mismo cuerpo horas después, con el token de la tarjeta ya vencido, devuelve la misma orden si existía, y qué devuelve si nunca se creó. Condiciona `A3` sobre el addon de única vez (`B/03` §8; `R4`), y la mide **B10**. **No bloquea**: si devuelve error con la orden existente, el caso cae en la comprobación de órdenes pagadas del barrido de **B11**, motivo 23 (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| `EX-44` ✚ | si cancelar un preapproval corta el reciclado de un registro de cobro abierto, o un cambio de medio posterior todavía lo cobra. Condiciona el cobro sobre la lápida del corte y la exención de las terminales (`B/21` §2.5, `B/09` §3; `R2`). **No bloquea**: da el tamaño de la población. Se mide en el paso 0 del corte (`16-fase-7…` §4.2), y la lee **B11** (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| `EX-45` ✚ | si una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato sigue `cancelled` releída horas después. Condiciona el gate del paso 2 del corte y el cobro sobre su lápida (`F-8V2C2-004`). **No es de esta épica**: se mide en el paso 0 del corte; el código actual registra seis que no (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| `EX-46` ✚ | a qué URL va el reintento de una notificación emitida antes de cambiar la URL de la aplicación. Condiciona el paso 4b del corte (`F-8V2C2-002`). **No se mide, por decisión del owner**: si el día del corte se pierde un reintento, el barrido diario lo relee (mediciones del 2026-09-29, M-4). **No bloquea una unidad**: si va a la vieja, el evento se pierde y su cobro cae en el punto (3) del «NO cierra» de `B/21` sobre `G3-1`, que ve el barrido de **B11** (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| `EX-47` ✚ | si un registro de cobro ya creado cobra el monto viejo o el nuevo cuando la mutación del preapproval cae en medio. Condiciona la comparación del importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; `F-8V2B3-001`, `R20`), que es de **B11**. **No bloquea**: si cobra el viejo, lo ve el motivo 24 cuando la mutación bajó el monto, y la línea del resumen del cobro de menos cuando lo subió (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`). Se mide en el paso 0 del corte (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) |
| `EX-48` ✚ | qué campo del pago que aprobó un registro de cobro en un reintento, leído por id, trae el instante de esa aprobación, distinto del `date_created` del registro. Condiciona la ventana del corte: si un cobro sobre la lápida es posterior al corte (`B/21` §2.5, `B/09` §3, `B/05` §3; `F-8V2B3-002`), y la lee **B11**. **No bloquea una unidad**: se mide en el paso 0 del corte, y el paso 1b no arranca sin este dato; si ningún campo es confiable, la ventana vuelve al owner (FASE 9 vuelta 2, verificación, con OK del owner, `V2-a`, `V2-m` y `V2-y`) |
| `EX-50` ✚ | cuántas suscripciones anuales del sistema viejo siguen vivas el día del corte; si hay alguna, el `expire_date` de su registro de cobro abierto se mide ahí. Condiciona cuándo cae la segunda corrida del detector del cobro sobre la lápida (`B/21` §1.3 y «NO cierra»), que lee **B11**. **No bloquea**: no es condición del corte, y se cuenta en el paso 0 sobre el recorrido del proveedor del 1b (FASE 9 vuelta 2, verificación, con OK del owner, `V2-r`, `V2-z4` y `V2-y`) |

~~**Y hay una consecuencia de la pregunta de arriba que conviene tener presente**: esas cinco
gobiernan el diseño del grace **sólo mientras el reloj sea del proveedor**. Con el reloj nuestro
dejan de ser bloqueantes de diseño y pasan a ser una nota del adaptador de Mercado Pago.~~ **Y la
pregunta de arriba se contestó con el reloj del proveedor** (`DEC-MP-006`), así que las filas del
cobro fallido **siguen gobernando el diseño del grace**, como `DEC-MP-006` dejó escrito.

### 5.3 El riesgo de plataforma

**De las ocho capacidades, la única que vive en una API anunciada como discontinuada es
reembolsar** — y es justamente la que el derecho de revocación necesita. La guía de migración del
proveedor **excluye explícitamente a las suscripciones**. Su interfaz no puede filtrar el nombre de
ningún endpoint hacia el dominio.

---

## 6. Cómo se integra, y cómo se libera

**El código de esta épica no va a `staging` por su cuenta** (`DEC-ARCH-007`). Corta de la rama de
integración del paraguas —`epic/HOS-1352-verticales-billing`— y mergea ahí. La unidad que llega a
`staging` es el paraguas, con las dos épicas adentro.

**«Terminada» no significa «en producción»**: significa lista y verificada contra el contrato.

Y la obligación que hace viable todo lo anterior: **`staging` se mergea periódicamente hacia la
rama del paraguas**, nunca al revés hasta el final.

---

## 7. Lo que necesita del owner ~~para destrabar~~

> ✅ **Nada que destrabe** (FASE 9 completa, salida 3 de `DEC-METH-004`): los tres puntos de abajo
> quedaron sin objeto el 2026-09-24 — `DEC-MP-005` cerró la evaluación de proveedor sin la PRUEBA 0
> ni la cuenta de Mobbex, y `DEC-MP-006` contestó el §5.1.

~~1. **Enviar los dos textos de la PRUEBA 0** (§5.0 de
   [`10-evaluacion-de-proveedor.md`](../HOS-1352-billing-verticals-redesign/docs/10-evaluacion-de-proveedor.md))
   — el formulario comercial pide una facturación esperada que decide él, y los dos necesitan el ID
   de aplicación.~~
~~2. **Avisar cuando llegue el mail de habilitación de Mobbex**, para vincular la entidad y sacar el
   `x-access-token`. La batería de sondas está escrita, con su gatillo, su orden y sus trampas.~~
~~3. **Responder la pregunta del §5.1** cuando haya con qué medirla.~~

**Lo que sí queda en sus manos, y no traba ninguna unidad:**

1. ~~**Pedir la habilitación de *«pagos automáticos»*** por el canal comercial, en paralelo
   (`DEC-MP-006`, cláusula 1): es lo que volvería disponible el cargo puntual declarado como destino.~~
   (tachado 2026-09-26) **Cerrado sin respuesta**: el owner decidió no esperar más y el mandato queda
   sin destino pendiente (📌 de `DEC-MP-006`).
2. ~~**Medir `GR-1` con el próximo rechazo mensual real** (owner 2026-09-25, 3a): hasta entonces la
   salida *«cambiá la tarjeta»* de `DEC-SUB-021` no se le promete al cliente.~~ (tachado 2026-09-26)
   **Hecho el 2026-09-26**: `GR-1` `VERIFIED` con la sonda 49; la salida se le puede decir al cliente.

---

## 8. Lo que esta spec NO decide

- ~~**Cuál es la pasarela.**~~ **DECIDIDA el 2026-09-24**: `DEC-MP-005` fija **Mercado Pago**, con la
  directriz de que lo que el proveedor no hace lo suple el diseño. La evaluación se cerró en el paso
  4 de 6 sin completarse, porque los dos pasos que faltaban dependían de respuestas que no llegaron.
- ~~**El modelo canónico de cobro.**~~ **DECIDIDO el 2026-09-24 por `DEC-MP-006`**: es el **mandato
  del proveedor**, y el reloj de cobro es suyo. Ver §5.1.
- **El orden de implementación.** Sale de las dependencias entre capítulos.
- **Qué se reescribe y qué se reutiliza del código actual.** Es FASE 5, con su gate propio
  (`DEC-METH-003`) — salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: ~~**se absorbe**~~ **se saca, y queda
  sólo como referencia de lectura** (revisión del owner, 2026-09-28, N2; §3.1).
- **Nada de la épica de verticales.** Su diseño se sostiene solo en
  [HOS-1353](../HOS-1353-verticales-capacidades-y-autorizacion/spec.md).
