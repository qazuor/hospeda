---
title: "FASE 8 vuelta 3 · C1 — la costura"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · C1 — la costura

Ataqué la frontera entre las dos épicas: el contrato de cobertura entero (la firma de `cobertura()`,
las clases de fuente, el aviso y su censo de emisores, el empuje inverso de `PURGED`, las ocho
entradas del §4.1, las tres defensas y el package del §7.1), contra lo que cada lado dice hacer: las
filas `V4`, `V8`, `V9` y la tabla de reparto de `V/descomposicion.md`, las filas `B1`, `B4`, `B9` y
`B10` y el §2.6 de `B/descomposicion.md`, `V/20` §2 (`G13`, `G14`), `V/02` §2.1 (catálogo de addons
y `trial`), `B/02` §2.4 y §2.5, `B/03` §3.2 y la regla del correo antes de cancelar, `B/14` §3,
`NUCLEO/01` (inventario de *«fila viva»*, fila 27), `NUCLEO/08` §1.3 y §3 (acción 24), y el §4.6 de
`16-fase-7-del-paraguas.md` (`U1`, el package vacío, `V1` y `B1` en paralelo). Medí contra el HEAD
`923b23586b` del worktree `hospeda-spec-hos-1352-billing-redesign`.

Son **8 hallazgos**: **0 CRITICA, 3 ALTA, 4 MEDIA y 1 BAJA**. La idea más grave: `puedeCobrarle`,
la única pregunta que protege la baja de una cuenta contra un cobro posterior, contesta `no` sobre
una `CANCEL_SCHEDULED` dando por hecho que el proveedor ya canceló, cuando billing declara una
ventana de hasta tres días en que la cancelación se reintenta y el preapproval sigue vivo; y la
guarda que impide que la respuesta de arranque (`no`) llegue a producción no nombra esa pregunta.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3C1-001 — `puedeCobrarle` da por cancelada en el proveedor una fila que billing sigue reintentando

**Qué se rompe.** El contrato define `puedeCobrarle` excluyendo `CANCEL_SCHEDULED` con una razón
de hecho: *«ya está dada de baja en el proveedor»*. Billing escribe lo contrario: `S11` manda la
cancelación, pero si el correo previo o la llamada fallan de forma transitoria la cancelación no se
ejecuta y el barrido la reintenta durante hasta 3 días, con la fila viva en `CANCEL_SCHEDULED` y el
preapproval `authorized`; la marca `CANCELACIÓN_SIN_CONFIRMAR` recién se abre al tercer día. En
esa ventana la pregunta contesta `no` con un preapproval que puede cobrar, y la acción 24 da de baja
la cuenta. Lo mismo vale para una fila terminal durante los 3 días previos a la marca.

**El camino.**

1. Juan pide a soporte dar de baja su cuenta. Soporte ejecuta el paso 1, *«cancelar una
   suscripción»*: `S11` lleva su fila a `CANCEL_SCHEDULED` y manda la cancelación a Mercado Pago.
2. El correo *«antes de cancelar»* falla de forma transitoria (o la llamada falla): la cancelación
   no se ejecuta en esta corrida; queda para el barrido, que tiene 3 días antes de abrir la marca.
3. Soporte hace los pasos 2 y 3 en el mismo rato. La acción 24 pregunta `puedeCobrarle(Juan)`:
   la única fila está en `CANCEL_SCHEDULED` y no hay marca abierta, así que contesta `no`.
4. La cuenta de Juan queda dada de baja: correo y nombre reemplazados, sin acceso.
5. La fecha de cobro del preapproval cae dentro de esos 3 días (Juan pidió la baja cerca de su
   renovación): Mercado Pago le cobra el mes.
6. `P1` registra el cobro con un comprobante sin nombre ni correo y sin enviar (`NUCLEO/08` §3):
   Juan pagó un mes sobre una cuenta que ya no existe y no recibe ni el comprobante.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1118`
  — "porque ésa ya está dada de baja en el proveedor y termina sola por `S12` en su fecha de fin"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:291`
  — "si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:298`
  — "hasta 3 días después de la transición que decidió la cancelación"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:305`
  — "`CANCEL_SCHEDULED`, por el par `authorized`/`paused`/`pending` × `CANCEL_SCHEDULED` del §10.1"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1023`
  — "Antes de los 3 días no abre nada"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:203`
  — "una `CANCEL_SCHEDULED` ya está dada de baja en el proveedor y termina sola por `S12`, sobre la cuenta ya dada de baja"

**Qué haría falta decidir o escribir.** Si `puedeCobrarle` tiene que contestar sobre *«la
cancelación en el proveedor está confirmada»* (releída `cancelled`) en vez de sobre el estado de
la fila; o, si no, qué pasa con el cobro que entra dentro de la ventana de reintento sobre una
cuenta ya dada de baja (a quién se le devuelve y cómo se lo contacta).

### F-8V3C1-002 — `G13` no cubre la respuesta de arranque de `puedeCobrarle`, y `V/20` tampoco la de `retenciónDetenida`

**Qué se rompe.** La tercera defensa define *«la de arranque»* como el cableado que contesta por
billing y lo enumera: el `no` a las cuatro fuentes y el `no` de `retenciónDetenida`. `puedeCobrarle`,
cuya respuesta de arranque también es `no` y también la construye `V4`, no está en esa lista, así
que nada obliga a ponerla en el módulo que `G13` vigila. Y la fila de `G13` en `V/20` §2, que es
la que el implementador de `V4` construye, nombra sólo las cuatro fuentes: tampoco
`retenciónDetenida`. Si al merge (el PR que *«nadie lo puede revisar de verdad»*) la raíz de
composición queda con cualquiera de esas dos respuestas de arranque, `G13` sigue verde.

**El camino.**

1. `V4` construye las respuestas de arranque de `puedeCobrarle` y `retenciónDetenida` (`no`) fuera
   del módulo que lista `V/20` §2, porque esa fila no las nombra.
2. `B4` integra la real de `cobertura()`; la raíz de composición sigue inyectando la de arranque de
   las otras dos. El build de producción no importa el módulo vigilado: `G13` verde.
3. Juan pausa su suscripción por pedido propio. `retenciónDetenida` contesta `no` en producción:
   `PB4` archiva y `PB9` borra sus fichas al día 180 aunque la pausa detenía el reloj.
4. Otro cliente con una suscripción `ACTIVE` pide la baja de su cuenta sin el paso 1: la acción 24
   pregunta `puedeCobrarle`, recibe `no` y lo da de baja; Mercado Pago le sigue cobrando cada mes.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1463`
  — "el `no` a las cuatro fuentes de billing"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1340`
  — "y a `puedeCobrarle` contesta `no`, porque sin billing no hay suscripción que cobre"
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:57`
  — "un build destinado a producción importa el módulo de la implementación de arranque que contesta por billing"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1469`
  — "justo ese `no`: `cubierto` falso para todo cliente que paga, y `PB2` bajándole las fichas mientras"
- Silencio: `sed -n '1444,1470p' .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md | rg -c puedeCobrarle`
  no devuelve nada (cero apariciones en el §6.3).

**Qué haría falta decidir o escribir.** Si el módulo vigilado por `G13` es *«toda respuesta de
arranque que contesta por billing»* (dicho por regla, no por lista) y la fila de `V/20` §2 se
alinea con el contrato; y si `G13` lleva un caso que falla con cada una de las respuestas de
arranque de la dirección de ida, no sólo con las de `cobertura()`.

### F-8V3C1-003 — La clave de canje de `extenderTrial` se declara idempotente y verticales no la guarda en ningún lado

**Qué se rompe.** El contrato, `B/14` §3.2 y la fila de `V4` dicen que la clave de canje vuelve
idempotente el reintento. La idempotencia exige que quien corre `T4` recuerde la clave, y del lado
de verticales no hay columna ni tabla que la guarde: la fila de `trial` no la tiene y ningún
documento de verticales la nombra. Billing reintenta confiando en una deduplicación que no existe.

**El camino.**

1. Juan, en `TRIAL_ACTIVE` con 14 días, canjea un código de 10 días de extensión.
2. Billing llama `extenderTrial(Juan, vertical, 10, K)`; verticales corre `T4`, commitea (+10) y
   contesta `ACEPTADA`, pero la respuesta se pierde (timeout, el proceso de billing se cae).
3. Billing reintenta con la misma clave `K`. Verticales no tiene dónde buscarla y corre `T4` otra
   vez: +10 más, si el techo de `V/11` §3 lo admite, y contesta `ACEPTADA`.
4. Billing gasta el código una sola vez. Juan tiene 20 días gratis por un código de 10. Si el
   techo no admite el segundo, la respuesta es `RECHAZADA`, billing no gasta el código y Juan se
   queda con la extensión y con el código sin gastar.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1166`
  — "se pisan. Billing asienta el canje sólo con `ACEPTADA`; la clave de canje hace idempotente el"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:362`
  — "`extenderTrial(user, vertical, días, claveDeCanje)` (`12-contrato…` §4.1), verticales corre `T4`"
- Silencio: `rg -n "claveDeCanje|clave de canje" .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs`
  no devuelve nada; en `V/02` §2.1 la fila de `trial` (línea 303) no tiene columna para la clave.

**Qué haría falta decidir o escribir.** Dónde guarda verticales la clave (columna, tabla de canjes
aplicados, o registro en la fila de `trial`) y qué contesta a un reintento con una clave ya
aplicada; y un caso del juego de la dirección inversa que reintente la misma clave.

## MEDIA

### F-8V3C1-004 — El inventario de *«fila viva»* define `puedeCobrarle` sin la marca que el contrato le agregó

**Qué se rompe.** El contrato (§4.1), `NUCLEO/08` §3 y la fila `B4` dicen que `puedeCobrarle`
contesta `sí` también con una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta. La fila 27 del
inventario de consumidores de *«fila viva»*, que es la que `G-R1-E` vigila y la que declara la
evaluación del lado de billing, sigue diciendo *«cinco de los seis»* estados y nada de la marca.
Quien construya la pregunta desde el inventario deja afuera justo el caso en que el barrido ya
dejó de reintentar.

**El camino.**

1. La cancelación del preapproval de Juan no se confirma en 3 días: se abre la marca y el barrido
   deja de reintentar. La fila está terminal.
2. `B4` implementó `puedeCobrarle` leyendo la fila 27: cinco estados vivos, sin marca. Contesta `no`.
3. Soporte da de baja la cuenta de Juan; el preapproval vivo le cobra todos los meses hasta que
   una persona resuelva la marca, sobre una cuenta sin correo.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:569`
  — "Son cinco de los seis a propósito"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1118`
  — "porque su cancelación en el proveedor no se confirmó y el preapproval todavía puede cobrar"

**Qué haría falta decidir o escribir.** Alinear la fila 27 con el §4.1 (o declarar cuál de los dos
manda) y que `G-R1-E` cuente también ese predicado.

### F-8V3C1-005 — *«Cada entrada entra con la unidad que construye su implementación»* contradice probar contra el simulador antes

**Qué se rompe.** El §7.1 dice que `V1` llena las interfaces y los simuladores, y en la misma
frase que cada entrada entra con la unidad que construye su implementación. Las dos lecturas dan
órdenes distintos: con la segunda, `ficha` y `fichaPurgada` entran con `V6`, `extenderTrial` con
`V4`, y `retenciónDetenida` y `puedeCobrarle` con `B4`. Billing dice que `B10` se prueba contra el
simulador de `ficha` antes de que exista la unidad de verticales, y a la vez que no se midió si
`V6` llega antes que `B10`; y `V4`, `V8` y `V9` consumen dos preguntas cuya entrada, leída así,
llega recién con `B4`, que va después de `B3` y `B5`.

**El camino.**

1. `B10` llega antes que `V6`. El package no trae `ficha` porque su entrada llega con `V6`.
2. El equipo de `B10` escribe un falso propio de `ficha`, o lee la tabla de fichas por `@repo/db`
   para validar `admiteDestaque`: una lectura que `G14` no ve, porque no es un import.
3. El falso propio contesta `admiteDestaque: sí` sobre una ficha `MODERATED`; Juan compra un
   destaque para una ficha que no se ve, que por `G2-3` se sigue cobrando.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1531`
  — "unidad que construye su implementación (§4.1, *«quién construye»*), y la épica de billing lo"
- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:326`
  — "`políticaDeAddon`, y el barrido con `fichaPurgada`) se construyen y se prueban contra el simulador"
- `.specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:370`
  — "la otra épica llega después de `V5`: no se midió si llega antes que `B10`, y hasta que se mida"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1250`
  — "`G2-1` y `G4-2`—, y `retenciónDetenida` en `B4`, con la respuesta de arranque en V4 (revisión del"

**Qué haría falta decidir o escribir.** Si `V1` escribe las ocho interfaces y sus simuladores de
entrada (y cada unidad trae sólo la implementación), o si cada interfaz entra con su unidad; y en
ese caso, qué unidad escribe la interfaz de las dos preguntas de ida antes de `V4`.

### F-8V3C1-006 — La interfaz del reloj la construye `B1`, y verticales la necesita sin declarar la dependencia

**Qué se rompe.** El §7.1 pone en el package la interfaz del reloj que el código de producción de
*las dos mitades* usa para leer la hora, y la construye `B1`. `V4` (el vencimiento del trial) y
`V9` (los 90 y 180 días) leen la hora, pero `V/descomposicion.md` no declara ninguna dependencia de
`B1` ni nombra la interfaz, y el paraguas afirma que `V1` y `B1` no dependen una de la otra y que
las dependencias entre épicas siguen en once. Si `V4` se construye antes de que `B1` publique la
interfaz, lee la hora del sistema directo, y el reloj adelantable de las pruebas no la mueve.

**El camino.**

1. `V4` se mergea antes que `B1` y lee la hora del sistema.
2. Las pruebas que adelantan el reloj compartido para vencer un trial no mueven la hora de `V4`:
   el caso *«un trial vence de verdad»* se condiciona o se saltea.
3. Una regresión deja a `T3` sin disparar: Juan conserva el trial para siempre y nadie lo ve,
   porque el caso que lo detectaba ya no puede fallar.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1513`
  — "La interfaz del reloj ✚ con que el código de producción de las dos mitades lee la hora,"
- `.specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:581`
  — "sólo de `U1`, y ninguna de la otra. Lo que las ataba era el package del contrato, que antes creaba"
- Silencio: `rg -n "la hora|adelant|inyect" .specs/HOS-1353-verticales-capacidades-y-autorizacion`
  no devuelve ninguna mención de la interfaz del reloj ni de `B1` como dependencia.

**Qué haría falta decidir o escribir.** Si la interfaz del reloj pasa a `V1` (o a `U1`, con el
package vacío), o si `V4` y `V9` declaran la dependencia de `B1` como la duodécima entre épicas.

### F-8V3C1-007 — Publicar una versión de addon escribe en una tabla de billing y ningún acto ni unidad lo tiene

**Qué se rompe.** Verticales define que publicar una versión nueva de addon *es* re-apuntar
`addon_product.version_id`, y esa columna es de billing. Crear la versión (verticales) y re-apuntar
el producto (billing) es una acción que escribe en las dos épicas, y la regla de vigilancia dice
que toda acción así entra como escritura cruzada; el §4.1 no declara ninguna. No hay fila en el
catálogo de `NUCLEO/08` §3 ni unidad en las dos descomposiciones que construya ese acto. Dos
implementadores lo resuelven distinto: el editor del panel escribe la tabla de billing por
`@repo/db` (cruce que `G14` no ve), o no hay forma de publicar y alguien edita la versión en su lugar.

**El camino.**

1. Juan compró el addon *«+30 fotos»*; su instancia ancla la versión 1.
2. El admin quiere venderlo como *«+40 fotos»* y no encuentra cómo publicar una versión nueva.
3. Se edita la versión 1 en su lugar (la única escritura disponible): todas las instancias vivas,
   la de Juan incluida, pasan a otorgar otra cosa sin comprar nada. Si el cambio fuera hacia abajo,
   Juan pierde lo que pagó.

**La evidencia.**

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:93`
  — "era `addon_product.version_id`, que es del producto. Re-apuntarlo —que es cómo se publica una"
- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1288`
  — "vertical, ya no existe. Toda acción que escriba en las dos épicas entra en esta mitad como"
- Silencio: `rg -n "versión de addon|addon_product.version_id"` sobre
  `nucleo/08-auditoria-y-observabilidad.md`, `V/descomposicion.md` y `B/descomposicion.md` no
  devuelve nada.

**Qué haría falta decidir o escribir.** Qué acto publica una versión de addon, de qué épica es,
cómo cruza la frontera el re-apunte (una entrada del §4.1 o un acto de billing que recibe la
versión y la valida) y qué unidad lo construye.

## BAJA

### F-8V3C1-008 — El §7.1 dice que billing consume el simulador inverso desde `B1`, que ahora corre en paralelo con quien lo construye

**Qué se rompe.** Con `U1` creando el package vacío, `V1` y `B1` arrancan en paralelo y el
simulador de la dirección inversa es de `V1`. La frase que dice que billing lo consume *desde `B1`*
quedó de cuando `V1` creaba el package antes; `B1` no puede consumir algo que `V1` todavía no
escribió.

**El camino.**

1. El equipo de `B1` lee el §7.1 y planifica sus pruebas contra el simulador inverso.
2. `V1` no está mergeada: el package está vacío. `B1` espera a `V1` (la espera que el lote P-C
   dijo haber quitado) o arma un falso propio. Juan no ve nada; es un texto vencido.

**La evidencia.**

- `.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:1532`
  — "consume desde `B1` con el simulador de la dirección inversa (`V/descomposicion.md`,"

**Qué haría falta decidir o escribir.** Ajustar la frase a la unidad de billing que de verdad lee
la dirección inversa primero (`B3` con `vigente`/`vendible`, o `B7`).

## Ataques que intenté y el diseño resistió

- **Aviso emitido dentro de la transacción**: el §3 y el §3.1 fijan *«después del commit»* para
  los dos eventos y para cada emisor; un aviso previo al commit ya no se consume en vano.
- **Dos `SUSCRIPCIÓN` de clase `TÍTULO` durante una sucesión con la cancelación fallida**: sólo
  emite la sucesora desde que autorizó, en cualquier estado posterior; no se suma cupo impago.
- **Addon que sostiene a un suspendido**: el addon es `COMPLEMENTO`, no cuenta para `cubierto`, y
  el pliegue lo descarta sin título (`V/15` §2.6, `G-R2`).
- **Grant que filtra capacidades entre verticales**: un ancla por vertical, FK compuesta al plan de
  esa vertical y `piso` por la firma; billing no lee `plan_version`.
- **Empuje de `PURGED` perdido**: la red es `fichaPurgada` en el barrido y `A6` relee antes de
  cancelar; el borrado de cuenta fuera de `PB9`/`PB12` lo alcanza porque la fila inexistente da `sí`.
- **Emisores faltantes en el censo**: la regla manda sobre la lista; revisé `S20`, `S32`/`S33`,
  `S37`, `S38` y el anclaje de grants, y ninguno cambia un campo de la fuente sin estar cubierto.
- **`cobrada` antes del primer pago**: no entra en la clase ni en `cubierto`; sólo la leen `T2`,
  `T5`, `T6` y `T8`, y el primer pago acreditado emite aviso.

## Fuera de mi vector

- **Escritores de `trial` en `V/02` §2.1**: la fila de `trial` nombra a `T7` como escritor, que
  salió con la revisión del owner, y no nombra a `T3` ni a `T4`, que también la escriben. Texto
  vencido de verticales, vector de modelo de datos.

## Key Learnings

1. Una razón de hecho escrita en un predicado (*«ya está dada de baja en el proveedor»*) hay que
   cruzarla contra los reintentos que la otra épica declara: acá la ventana de 3 días la invalida.
2. Una defensa definida por lista (*«el cableado que contesta por billing: esto y esto»*) caduca
   cada vez que el contrato gana una pregunta de ida; `puedeCobrarle` entró y la lista no.
3. «Idempotente por clave» del lado que llama no vale nada si el lado que ejecuta no guarda la
   clave: hay que buscar la columna, no la frase.
4. Cuando un catálogo se parte por campo entre dos épicas (addon: versión en verticales, producto
   en billing), el acto de publicar queda repartido y sin dueño.
