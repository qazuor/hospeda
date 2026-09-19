---
title: "FASE 8-bis · B2 — máquinas, idempotencia y carreras"
linear: HOS-1354
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · B2 — máquinas, idempotencia y carreras

Segunda pasada adversarial B2 sobre `HOS-1354`, ahora sobre el diseño que la FASE 9 produjo. La
pregunta que ordena la fase —*«¿qué rompió el arreglo?»*— tiene respuesta corta en este vector:

> **La sucesión resolvió el `INSERT` y no resolvió el resto de la vida de la fila.** El racimo `R1`
> agregó una columna, dos claves, un estado y un invariante, y **no agregó una sola transición**.
> La tabla del `B/03` §3.2 pasó de quince renglones a dieciséis, y el que entró (`S16`) no es
> ninguno de los que el mecanismo nuevo necesita: falta el que consume la sucesión, falta el que
> espeja una baja del proveedor, y falta el que limpia `sucede_a`.

Y hay una segunda respuesta, que atraviesa cinco de los diecisiete hallazgos: **la marca
`requiere_conciliación` dejó de ser un destino excepcional y pasó a ser el destino por defecto.**
La regla 1 del núcleo, reescrita en esta misma pasada de arreglos, dice que *«un intento de
transición que la tabla no declara no se ejecuta … **pone la marca `requiere_conciliación`** y emite
el §22.1»* (`NUCLEO/03` §1). Con una tabla a la que le faltan las transiciones de arriba, esa regla
convierte en incidente varios caminos que el diseño declara normales — y `B/09` §3, también de esta
pasada, decidió que **una fila marcada no se vuelve a barrer**.

**Diecisiete hallazgos. Cinco `CRITICA`, ocho `ALTA`, cuatro `MEDIA`.**

Dos advertencias de lectura antes de la lista:

1. **No ataco la sucesión como mecanismo.** `EX-6` mide que el proveedor deja convivir seis
   autorizaciones del mismo pagador, `D7` exige la convivencia y `EX-33` mide tres veces que la
   fecha futura se respeta. El mecanismo es correcto; lo que no está escrito es qué pasa después
   del `INSERT`.
2. **El núcleo no es mío.** Donde un defecto vive en `docs/nucleo/` va marcado `NUCLEO` y no lo
   resuelvo. Donde el choque es **entre** el núcleo y un capítulo de billing lo reporto acá, porque
   la mitad corregible es la de billing.

---

## CRITICAS

### F-8bB2-001 — Ningún renglón de la tabla cancela a la predecesora cuando su sucesora queda autorizada, y la regla 1 convierte ese hueco en una marca

**Qué se rompe.** El cliente que hace un upgrade o un cambio de ciclo termina con **dos
preapprovals vivos** y paga dos veces. El acto que `D7` declara obligatorio —cancelar la vieja al
recibir el webhook de que la nueva quedó autorizada— **no tiene transición** en la tabla del `B/03`
§3.2, y la regla 1 del núcleo manda, para un intento que la tabla no declara, poner la marca y
emitir el §22.1. O sea: la ejecución normal del mecanismo más caro del sistema termina en un
incidente y en una fila sin cancelar.

**El camino.**

1. Un cliente `ACTIVE` pide el anual. Nace la sucesora en `PENDING_AUTHORIZATION` con `sucede_a`
   apuntando a la vieja, y entra por el candado `B` (`B/02` §2.2).
2. El cliente autoriza. Llega el webhook. `S2` lleva la sucesora a `ACTIVE`.
3. Toca ejecutar `D7`: *«**La suscripción vieja se cancela sólo al recibir el webhook de que la
   nueva quedó autorizada**»* (`NUCLEO/04` §3, `D7`).
4. Se busca la transición. Desde `ACTIVE` salen `S4` (falla un cobro), `S8`/`S9` (pausa), `S11`
   (*«la persona pide la baja»*), `S13` (`SUPER_ADMIN` otorga *Free Forever*) y `S16` (primer cobro
   rechazado). **Ninguna declara el evento «su sucesora quedó autorizada»**, y `NUCLEO/03` §1 regla
   1 dice *«La tabla de transiciones es exhaustiva. Lo que no está, no pasa»*.
5. La misma regla 1 dice qué pasa entonces: *«Un intento de transición que la tabla no declara **no
   se ejecuta**: se registra como evento de dominio y, si tocaba plata o estado, **pone la marca
   `requiere_conciliación`** y emite el §22.1»*. Tocaba plata **y** estado.
6. La predecesora queda `ACTIVE`, **marcada**, con su preapproval `authorized`. `EX-6` mide que el
   proveedor no frena la segunda. Los dos cobran.
7. Y la marca cierra la puerta de salida: `B/02` §2.2 declara que *«mientras esté puesta **no se
   puede declarar una sucesión** sobre esa fila»*, y `B/09` §3 que *«una fila con la marca
   `requiere_conciliación` puesta tampoco se barre»*. Nadie vuelve a mirarla salvo una persona.

**La salida por `S11` tampoco cierra, y conviene decirlo porque es la que alguien va a elegir.**
`S11` cancela el preapproval —eso sí resuelve el doble cobro— pero su evento declarado es *«pide la
baja»*, su destino es `CANCEL_SCHEDULED`, y ese estado *«sostiene servicio hasta el fin del período
pagado»* (`B/03` §3.1). Un cliente que sube de plan quedaría con el plan viejo **sirviendo** y el
nuevo cobrando, y con dos filas vivas ocupando los candados `A` y `B` a la vez.

**Dónde lo permite el diseño.**

- `docs/03-maquinas-de-estado.md` §3.2: las dieciséis transiciones; ninguna tiene como evento la
  autorización de una sucesora.
- `nucleo/04-invariantes.md` §3, `D7`: *«La suscripción vieja se cancela sólo al recibir el webhook
  de que la nueva quedó autorizada»*, con columna de sostén *«servicio»* — o sea que el invariante
  **no está sostenido por la base ni por la tabla**.
- `nucleo/03-maquinas-de-estado.md` §1 regla 1: *«Lo que no está, no pasa … pone la marca
  `requiere_conciliación` y emite el §22.1»*.
- `docs/02-modelo-de-datos.md` §2.2: *«mientras esté puesta **no se puede declarar una sucesión**»*.
- `docs/09-conciliacion.md` §3: *«una fila con la marca `requiere_conciliación` puesta tampoco se
  barre»*.

**Severidad.** `CRITICA` — débito duplicado con dinero real en el camino declarado normal, sin
detección automática.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, en sus dos mitades.** La sucesión (cambio 7 y 10
de `R1`) creó el par de filas que hay que resolver, y la reescritura de la regla 1 (cambio 8)
convirtió la ausencia de transición en una marca en vez de en un error ruidoso. Antes de `R1` el
`INSERT` fallaba y el mecanismo entero era inejecutable (`F-8B2-001`): el defecto se movió un paso
más tarde y se volvió silencioso.

---

### F-8bB2-002 — `sucede_a` no se limpia nunca: la primera sucesión consume el candado `B` para siempre, y nadie puede cambiar de plan dos veces

**Qué se rompe.** Después de su primer upgrade o cambio de ciclo, **un cliente no puede volver a
cambiar de plan ni de ciclo nunca más**. Su suscripción actual es la sucesora, lleva `sucede_a` no
nulo y está viva, así que ocupa el candado `B` de forma permanente; la segunda sucesora colisiona
con ella. El diseño escribe esa consecuencia y la lee como una virtud.

**El camino.**

1. Cliente `ACTIVE` en mensual (`O`, origen, `sucede_a IS NULL`). Pide el anual.
2. Nace `S₁` con `sucede_a = O`. Entra por `B`. Autoriza; `O` se resuelve como sea (ver
   `F-8bB2-001`) y muere. **`S₁` queda `ACTIVE`, y sigue teniendo `sucede_a` no nulo**: ninguna
   línea del diseño lo pone en `NULL` al consumarse la sucesión.
3. Seis meses después el cliente quiere subir a Premium. Nace `S₂` con `sucede_a = S₁`.
4. `S₂` tiene `sucede_a IS NOT NULL` y estado vivo; `S₁` también. **Colisionan en el candado `B`:**
   `UNIQUE (user_id, vertical) WHERE clase = principal AND sucede_a IS NOT NULL AND estado ∈
   {vivos}`. El `INSERT` se rechaza.
5. Y no es un descuido del índice: el guard `G-R1-A` lo prohíbe por escrito —*«o a una que a su vez
   tenga `sucede_a` no nulo»*— y el invariante `D15` lo congela en el núcleo: *«una sucesora **no
   puede ser sucedida**»*.
6. Tampoco sirve declarar la sucesión sobre el origen: `O` ya no existe o no está en
   `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, que es lo que `G-R1-A` exige de una predecesora.

**El texto dice exactamente esto y lo celebra.** `B/02` §2.2: *«**una sucesión no es una cadena**:
al indexar `B` sobre `(user_id, vertical)` —y no sobre `sucede_a`— una sucesora no puede ser
sucedida **mientras viva**, sin ninguna regla extra, porque la segunda sucesora colisiona con la
primera»*. La frase quiere decir *«no se encadenan sucesiones simultáneas»*; lo que la clave
implementa es *«no hay una segunda sucesión en la vida del cliente»*, porque **la sucesora vive
para siempre: es su suscripción**.

**Dónde lo permite el diseño.**

- `docs/02-modelo-de-datos.md` §2.2, candado `B` y el párrafo *«una sucesión no es una cadena»*.
- `docs/20-testing.md` §2, `G-R1-A`: *«una fila con `sucede_a` no nulo apunta a una predecesora
  **fuera de** `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, **o a una que a su vez tenga `sucede_a`
  no nulo**»*.
- `nucleo/04-invariantes.md` §3, `D15`: *«Una sucesión es un compromiso, no dos: a lo sumo una
  sucesora viva por `user + vertical`, **y una sucesora no puede ser sucedida**»*.
- Ningún archivo del corpus contiene una regla que devuelva `sucede_a` a `NULL`, ni un momento en
  que la sucesión se declare consumada. Medido con `rg` sobre las tres épicas el 2026-09-19: las
  veintiséis apariciones de `sucede_a`/`sucesora`/`sucesión` son la columna, las dos claves, los dos
  guards, `D15`, el re-apuntado de addons y promos, y la condición 3 de `B/05` §3.

**Severidad.** `CRITICA` — inhabilita el upgrade y el cambio de ciclo para todo cliente que ya usó
uno, que es exactamente el cliente que más paga. `DEC-SUB-006` y `DEC-SUB-007` quedan inejecutables
a partir del segundo uso.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** Es `F-8B2-001` / `F-8B1-001` / `F-8B3-001`
desplazado del primer cambio de plan al segundo. `EX-33` ya había anticipado el patrón por otro
camino —*«de replicarse acá, el mecanismo de compensación fallaría en el segundo o tercer cambio de
plan de cada cliente, que es una situación normal»*— y lo descartó para el proveedor; lo que nadie
volvió a mirar es que **nuestro propio candado lo produce**.

---

### F-8bB2-003 — «Ningún pago acreditado antes» es histórico y sin ventana: todo cliente que vuelve cae en un `GRACE_PERIOD` que no se puede pagar, y muere en `SUSPENDED` sin salida ni alta nueva

**Qué se rompe.** `S16` sólo alcanza a quien **nunca pagó en su vida** en esa vertical. Todo cliente
que pagó alguna vez y vuelve —el caso más común de una cartera con un año— cae, ante un primer cobro
rechazado, en `S4 → GRACE_PERIOD` sobre un preapproval que el proveedor **ya canceló de forma
terminal**. Diez días de servicio completo que la regla de `§4.3` existe para negar, después
`SUSPENDED`, cuya única salida exige un cobro que ningún preapproval puede ejecutar, y **el candado
`A` ocupado para siempre**: no puede ni volver a contratar.

**El camino.**

1. Un cliente pagó tres ciclos en 2025, canceló, y su fila quedó `CANCELLED`.
2. En 2026 vuelve. `C6` de `R1` §4.8: *«no colisiona → **ENTRA**»*. Nace la fila, autoriza, `S2` la
   lleva a `ACTIVE`.
3. El primer cobro de esta alta se rechaza. Se evalúa `S16`, cuya condición es **«ningún pago
   acreditado antes para ese `user + vertical`»**. Hay tres pagos acreditados de 2025. **`S16` no
   aplica.**
4. `B/12` §4.5 punto 1 lo confirma y lo quiso así: *««Ningún pago acreditado» se cuenta por
   `user + vertical`, **no por suscripción**»*, con la razón de cerrar el abuso. No hay ventana
   temporal, ni distinción de clase, ni de suscripción.
5. Entonces se aplica `S4`: `ACTIVE → GRACE_PERIOD`. Diez días de servicio completo (§20), que es
   exactamente el *«beneficio de entrada»* que `R-SUB-01` pidió cerrar y `§4.3` cerró para el otro
   cliente.
6. Pero está medido que **no hay con qué pagar**: `B/12` §4.4, producción 2026-09-17, sobre un
   primer cobro rechazado *«el proveedor **cancela la suscripción en el mismo instante** … y esa
   cancelación es **terminal**»*. `S5` (*«entra el pago»*) es inalcanzable.
7. A los diez días, `S6 → SUSPENDED`. `S7` pide *«el cobro entró de verdad»*: imposible.
8. El cliente arregla su tarjeta y quiere volver a contratar. `R1` §4.6, `C1`: *«candado `A`
   rechaza — **RECHAZA**, su autorización puede seguir viva: serían dos cobros»*. Acá **no** puede
   seguir viva, y el candado no distingue. Queda bloqueado sin ninguna transición disponible.

**Es el mismo camino por la puerta de la sucesión.** Un cliente `ACTIVE` con historial pide un
upgrade; la sucesora autoriza; `D7` mata a la predecesora; el primer cobro de la sucesora se
rechaza. Hay pagos acreditados (los de la predecesora, mismo `user + vertical`), así que `S16` no
aplica y la sucesora entra en grace y muere en `SUSPENDED` — **con `sucede_a` no nulo**, o sea
ocupando además el candado `B` de forma permanente (`F-8bB2-002`).

**Dónde lo permite el diseño.**

- `docs/03-maquinas-de-estado.md` §3.2, `S16`, columna condición: *«**ningún pago acreditado antes**
  para ese `user + vertical`»*.
- `docs/12-suscripcion.md` §4.3 y §4.5 punto 1.
- `docs/12-suscripcion.md` §4.4: la medición de la cancelación terminal.
- `docs/03-maquinas-de-estado.md` §3.2, `S7`, condición: *«el cobro entró de verdad»*.
- `docs/02-modelo-de-datos.md` §2.2: `SUSPENDED` sigue entre los vivos.

**Severidad.** `CRITICA` — servicio que no corresponde para el cliente recurrente, y un cliente
legítimo con la tarjeta rechazada queda sin ninguna forma de volver a ser cliente.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** `F-8B2-008` fue declarado cortado *«en el paso
2»* por `R1` §3.5, y corta sólo para el sujeto que la medición usó: el alta de alguien que nunca
pagó. `R1` §4.6 `C5` escribe el veredicto *«el alta que nunca cobró ya no llega acá … el par,
cerrado»* sobre una celda que la condición histórica de `S16` deja abierta para todos los demás.
El recorrido del dominio miró la fila existente y no la **historia de pagos**, que es el eje nuevo
que `S16` introdujo.

---

### F-8bB2-004 — La excepción que deja suceder a una `CANCEL_SCHEDULED` marcada se apoya, textualmente, en el hecho que la marca puede estar denunciando

**Qué se rompe.** La marca bloquea declarar una sucesión, salvo desde `CANCEL_SCHEDULED`, y la
excepción se justifica diciendo que ahí *«`S11` ya canceló el preapproval, así que el daño que la
marca previene no puede ocurrir»*. Pero **la divergencia más probable sobre una
`CANCEL_SCHEDULED` es justamente que esa cancelación no se aplicó**, y es lo que pone la marca. La
excepción se concede sobre la premisa que la marca acaba de poner en duda: nace una sucesora que
cobra mientras el preapproval de la predecesora, vivo, cobra también.

**El camino.**

1. Un cliente pide la baja. `S11`: *«se cancela en el proveedor **de inmediato**»* y la fila queda
   `CANCEL_SCHEDULED` con fin de servicio a 20 días.
2. El `PUT` de cancelación devuelve `200` y **no aplica**. Está medido que pasa: `EX-20`,
   producción, *«se aplica A MEDIAS, con un solo `200`»*, y `D5` existe por eso.
3. La verificación por relectura de `D5` detecta la divergencia: nuestro estado dice
   `CANCEL_SCHEDULED`, el proveedor dice `authorized`. Toca plata y estado → `S14` pone la marca.
   (El barrido diario llega a la misma conclusión por `B/09` §3, fila *«estado»*.)
4. El cliente se arrepiente antes del vencimiento. `B/03` §3.3 declara que arrepentirse *«es una
   sucesión»*, y `B/02` §2.2 le concede la excepción: *«una fila marcada **sí puede suceder cuando
   está en `CANCEL_SCHEDULED`** … en ese estado `S11` ya canceló el preapproval, así que el daño que
   la marca previene **no puede ocurrir ahí**»*.
5. Nace la sucesora, autoriza, cobra. El preapproval de la predecesora **nunca se canceló** y cobra
   también. `EX-6` mide que el proveedor no frena la segunda; `GT-1` —*«cancelar frena el cobro»*—
   no aplica porque la cancelación no entró.
6. Y la fila marcada **no se barre** (`B/09` §3), así que el segundo cobro no tiene detección por
   ese lado.

**Dónde lo permite el diseño.**

- `docs/02-modelo-de-datos.md` §2.2: *«**La excepción, y es una sola**: una fila marcada **sí puede
  suceder cuando está en `CANCEL_SCHEDULED`**. No es una excepción de criterio sino de mecanismo:
  en ese estado `S11` ya canceló el preapproval, así que el daño que la marca previene no puede
  ocurrir ahí»*.
- `docs/03-maquinas-de-estado.md` §3.2, `S11`: *«**se cancela en el proveedor de inmediato**»* — el
  efecto declarado, no verificado.
- `nucleo/04-invariantes.md`, `D5`: toda mutación se verifica releyendo — y `docs/03` §10.4:
  *«toda mutación se verifica releyendo y comparando campo por campo … porque está medido que un
  `PUT` con varios campos **se aplica a medias con un solo `200`** (`EX-20`)»*.
- `06-mp-validation-matrix.md`, `EX-20`, `NOT_SUPPORTED`, producción.

**Severidad.** `CRITICA` — doble cobro con dinero real, sobre el único camino al que el diseño le
abrió la puerta a propósito.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, entero.** Ni la marca ni su excepción existían
antes de `R1`; la excepción es la salida (a) que `R1` §6 ítem 3 recomendó para el par abierto
`CANCEL_SCHEDULED × C9`. La recomendación es razonable **si** la cancelación se aplicó, y no declara
que ese «si» es precisamente lo que la marca puede estar reportando.

---

### F-8bB2-005 — Seis de los ocho pares (estado nuestro, estado del proveedor) no tienen transición declarada, y la regla 1 los convierte en marca: la regla de no-retroceso no puede escribir lo que lee

**Qué se rompe.** El §10.1 dice *«se **relee** el recurso por su id y **se escribe lo leído**»*, y la
regla 1 del núcleo dice que lo que la tabla no declara **no se escribe**, se marca. Las dos reglas
gobiernan el mismo acto y dan resultados opuestos. Como la tabla sólo declara dos de los mapeos que
el proveedor puede devolver, la defensa central contra el desorden de webhooks **termina emitiendo
un incidente en vez de espejar un hecho**, y la fila se queda en un estado que el proveedor ya
abandonó — con servicio completo.

**El camino.** El proveedor tiene cuatro estados (`pending`, `authorized`, `paused`, `cancelled`).
Estos son los pares que una relectura puede producir, contra la tabla del §3.2:

| nuestro estado | lo leído | ¿hay transición? |
|---|---|---|
| `PENDING_AUTHORIZATION` | `authorized` | **sí** — `S2` |
| `PENDING_AUTHORIZATION` | `cancelled` | **no** — ver `F-8bB2-014` |
| `ACTIVE` | `cancelled` (baja por mora, o el cliente canceló desde su cuenta del proveedor) | **no** |
| `ACTIVE` | `paused` (el cliente pausó desde el proveedor) | **no** — `S8`/`S9` declaran eventos nuestros |
| `GRACE_PERIOD` | `cancelled` | **no** |
| `SUSPENDED` | `cancelled` | **no** — y `B/12` §1.4 lo nombra explícitamente como camino de salida |
| `CANCEL_SCHEDULED` | `cancelled` | **no** — `S12` exige *«llega la fecha de fin de servicio»* |
| `PAUSED` | `authorized` | **sí** — `S10` |

1. Un cliente `ACTIVE` acumula impagos y el proveedor da de baja la suscripción por su cuenta.
2. `B/12` §1.4: *«**eso es un hecho suyo** (§64.18) y entra por la regla de no-retroceso: **se relee
   y se escribe lo leído**»*.
3. Se relee: `cancelled`. Se intenta escribir `CANCELLED`. **La tabla no tiene `ACTIVE →
   CANCELLED`** salvo `S13`, cuyo evento es *«`SUPER_ADMIN` otorga *Free Forever*»*.
4. Regla 1: no se ejecuta, se pone la marca, sale el §22.1.
5. La fila sigue `ACTIVE`: publicada, editable, con entitlements comerciales (§20/§21 no la
   alcanzan) y **cubierta** para el contrato de cobertura, porque `cubierto` se calcula sobre las
   fuentes de clase `TÍTULO` y una `ACTIVE` lo es.
6. Y por `B/09` §3 la fila marcada **no se barre**, así que la única vía que quedaba —el barrido
   diario— también se apaga. Servicio completo, gratis, hasta que una persona abra el caso.
7. Agravante de detección: `EX-15` mide qué operaciones **no** emiten webhook y `B/16` §4.3 lo
   generaliza —*«como mutar o cancelar **no emiten webhook**, nadie se entera desde adentro»*—.
   Nada dispara el paso 2 salvo el barrido, que el paso 6 acaba de apagar para esa fila.

**Dónde lo permite el diseño.**

- `docs/03-maquinas-de-estado.md` §10.1: *«**Nunca se escribe el estado que trae el evento** … se
  **relee el recurso por su id** en el proveedor y **se escribe lo leído**»*.
- `nucleo/03-maquinas-de-estado.md` §1 regla 1: *«La tabla de transiciones es exhaustiva. Lo que no
  está, no pasa … pone la marca `requiere_conciliación` y emite el §22.1»*.
- `docs/12-suscripcion.md` §1.4: *«Si el proveedor da de baja la suscripción por su cuenta … se
  relee y se escribe lo leído»*.
- `docs/09-conciliacion.md` §3: los terminales exentos y *«una fila con la marca … tampoco se
  barre»*.
- `docs/16-addons.md` §4.3: *«como mutar o cancelar no emiten webhook, nadie se entera desde
  adentro»*.

**Severidad.** `CRITICA` — servicio completo indefinido sin pago, con las dos vías de detección
apagadas por la misma regla, sobre el camino de mora, que es de alto volumen.

**¿Es nuevo, o es el arreglo?** **Las dos cosas.** El hueco de transiciones es viejo; lo que lo
volvió peligroso es el arreglo: antes de `R1`, la regla 1 no decía qué hacer con un intento no
declarado, y `B/09` §3 barría la fila todas las noches. Ahora el intento produce una marca y la
marca produce una exención, así que el primer síntoma silencia el segundo.

---

## ALTAS

### F-8bB2-006 — El evento de `S16` contradice el §1.3: un primer cobro rechazado deja el pago en `PENDING` y la fila en `ACTIVE`, así que la transición nueva no se dispara por su propio evento

**Qué se rompe.** `S16` se dispara cuando *«el **primer** cobro se rechaza»*. `B/12` §1.3 define,
para toda la épica, que un cobro rechazado que el proveedor va a reciclar es **`PENDING`** y la
suscripción **sigue `ACTIVE`** — y que `FAILED` significa *«el proveedor se dio por vencido»*. La
medición del §4.4 dice que el primer cobro rechazado va a `recycling` (o sea: `PENDING`) **y** que
el preapproval queda `cancelled` en el mismo milisegundo. Con las dos reglas juntas, el estado nuevo
es inalcanzable por el único evento que lo alcanza, y el cliente se queda `ACTIVE` con un pago que
no va a entrar nunca.

**El camino.**

1. Alta. La tarjeta pasa la validación de ARS 0 (`PA-3`). El primer cobro real, 26 a 44 minutos
   después, se rechaza.
2. `B/12` §1.3, tabla: *«el proveedor rechazó y **va a reintentar** | **`PENDING`** | sigue
   `ACTIVE`»*. La cuota está en `recycling`, que es literalmente ese renglón — medido: *«la cuota
   `7032034055` quedó en `status: recycling` con su pago en `rejected / cc_rejected_high_risk`»*.
3. `S16` pide *«el primer cobro se rechaza»*. Según §1.3 eso todavía no es un veredicto: no hay
   `FAILED`, y por la misma regla tampoco hay `S4`. **Ninguna de las dos transiciones se dispara.**
4. El reloj que resolvería el empate tampoco existe: §1.2 dice que el grace *«arranca cuando el
   proveedor deja de reintentar, **y eso se detecta releyendo el recurso, nunca contando días**»*.
   La relectura devuelve `cancelled`, que no es *«dejó de reintentar»* ni ninguno de los dos
   renglones de la tabla de §1.3.
5. Y si se intenta escribir `cancelled`, entra `F-8bB2-005`: no hay transición `ACTIVE → CANCELLED`
   y sale una marca.
6. Resultado: `ACTIVE`, servicio completo, pago `PENDING` para siempre, y `CHARGE_DECLINED` —el
   estado que esta pasada creó para este caso exacto— **nunca ocupado**.

**Dónde lo permite el diseño.** `docs/12-suscripcion.md` §1.3 y §1.2; `docs/03-maquinas-de-estado.md`
§3.2 (`S16`, `S4`); `docs/12-suscripcion.md` §4.4 (la medición).

**Severidad.** `ALTA` — el daño de fondo (servicio indefinido sin pago) ya está registrado como
`F-8B2-009`; lo que reporto acá es que la transición nueva no tiene un evento que ocurra, y que la
regla que lo impide es del mismo capítulo que la creó.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** `S16` se escribió leyendo el §4.4 (*«el proveedor
cancela en el mismo instante»*) sin releer el §1.3 del mismo capítulo, que gobierna cómo se
interpreta un rechazo. Es la forma exacta que la fase busca: una regla corregida en una sección que
contradice a otra sección que nadie volvió a leer.

---

### F-8bB2-007 — Una fila marcada sale del barrido y no sale del camino de webhooks: la única fila que nadie vuelve a comparar es la única que puede cambiar sin ser comparada

**Qué se rompe.** `B/09` §3 exime del barrido a toda fila marcada, con el argumento de que *«ya
divergió y hay una persona mirándola»*. Pero nada exime a esa fila del camino de webhooks del §10.1,
que **sí escribe estado**. Mientras el caso está abierto, el estado que la persona está mirando
puede moverse por debajo, y cuando `S15` levante la marca la resolución se aplica sobre otra fila
que la que se diagnosticó. En el sentido contrario, si nadie resuelve el caso, la exención es
permanente: la fila con la divergencia más cara es la única que el sistema decidió no volver a mirar
nunca.

**El camino.**

1. El barrido detecta una divergencia de monto sobre una `ACTIVE` (`EX-15`: mutar no emite webhook,
   y la `version` saltó de 5 a 9). Se pone la marca.
2. `B/09` §3: *«**una fila con la marca `requiere_conciliación` puesta tampoco se barre** … Vuelve
   al barrido cuando `S15` levanta la marca»*. La fila sale del barrido.
3. El proveedor sigue cobrando el monto divergente todos los meses. Cada cobro **sí** emite webhook
   (`B/09` §2.2, *«toda suscripción que cobra emite un webhook»*), y cada webhook se procesa
   normalmente: relee, escribe lo leído, registra el pago. Nada en el §10.1 ni en el §3.2 menciona
   la marca.
4. Un mes después el proveedor da de baja la suscripción por mora. La fila marcada se mueve (o
   intenta moverse, `F-8bB2-005`).
5. La persona abre el caso con el diagnóstico de la noche 1 y resuelve sobre un estado de la noche
   30. `S15` dice *«se levanta la marca; si además corresponde un cambio de estado, se ejecuta la
   transición de esta misma tabla **que lo permita**»* — evaluada contra el estado de hoy, que no es
   el que produjo el incidente.
6. Y si nadie abre el caso, el punto 2 no tiene vencimiento: no hay plazo, ni escalamiento, ni
   ningún mecanismo que devuelva la fila al barrido salvo una acción humana.

**Dónde lo permite el diseño.** `docs/09-conciliacion.md` §3 (la exención y su razón);
`docs/03-maquinas-de-estado.md` §10.1 y §3.2 (`S15`); `docs/19-superficies.md` §6 (el listado
accionable, sin plazo ni escalamiento declarados).

**Severidad.** `ALTA` — convierte un ruido diario en un punto ciego permanente, y el volumen lo
garantiza: por `F-8B2-004`, reejecutado abajo, **cada baja de la cartera** entra a ese listado.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** La exención de las filas marcadas es el cambio 14
de `R1`, escrito para cortar el paso 6 de `F-8B2-002` (*«se repite todas las noches»*). Corta el
ruido y, en el mismo movimiento, corta la única vigilancia que había.

---

### F-8bB2-008 — La cola que el §3.3.1 retiró conserva un consumidor vivo: el aumento de precio del §29 sobre una suscripción pausada

**Qué se rompe.** `B/03` §3.3.1 retira la promesa de *«se encola y se aplica al reanudar»* para el
cambio de plan, con el motivo correcto: *«la cola de `B/12` §2.1 **es de entitlements, no de
checkouts**»*. Pero `B/12` §6.2 encola otra cosa en esa misma cola inexistente —**el aumento de
precio del §29**, que es una **mutación de monto en el proveedor**, no un entitlement— y nadie
volvió a leer ese §. El aumento se pierde o lo aplica cada implementación a su manera, y el §29
tiene valor probatorio declarado en el capítulo 22.

**El camino.**

1. Un cliente pausa (`S8`). `EX-11` `VERIFIED`: estando pausada el proveedor rechaza toda
   modificación, incluidos monto y frecuencia.
2. Cae la fecha efectiva de un aumento de `DEC-MP-002` sobre ese cliente.
3. `B/12` §6.2: *«**El aumento espera a la reanudación y se aplica ahí.** `DEC-SUB-010` ya lo había
   anticipado en su implicación 3: *«todo cambio pedido durante la pausa se aplica DESPUÉS de
   reanudar»*»*.
4. ¿Dónde espera? `B/12` §2.1 dice que la única cola del diseño *«es una cola **nuestra, de
   entitlements**. **No es una cola de cambios en el proveedor** — el proveedor no tiene ninguna»*, y
   §2.2 enumera sus cuatro colisiones, todas de descensos programados.
5. `B/03` §3.3.1 acaba de declarar, para el cambio de plan, que esa promesa tenía *«un destino que
   no existe»*. **La misma frase alcanza al aumento, y el §3.3.1 no lo nombra.**
6. Al reanudar, `DEC-SUB-010` obliga a mostrar *«una sola cosa: qué día se le cobra»* y `B/12` §6.3
   resuelve el aviso diciendo *«cuándo se le cobra **y cuánto**»* — un aviso que describe una
   mutación que nadie guardó.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §3.3.1, fila `PAUSED`;
`docs/12-suscripcion.md` §6.2, §2.1, §2.2, §6.3; `docs/22-lo-legal.md` §1.2 (el valor probatorio del
aviso del §29).

**Severidad.** `ALTA` — un aumento de precio que no se aplica, o que se aplica por un camino que
nadie escribió, sobre el único aviso del sistema con valor probatorio.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** El §3.3.1 es nuevo de esta pasada y retira la cola
para un consumidor de los dos que tenía. El otro quedó apuntando a un destino que el mismo commit
declaró inexistente.

---

### F-8bB2-009 — «En el mismo acto del upgrade» no nombra un instante: el re-apuntado de addons y del contador de promos cae dentro de una ventana de 72 h con dos desenlaces

**Qué se rompe.** `B/16` §4.2 ordena que el addon *«se re-apunta a la sucesora, **en el mismo acto
del upgrade**»* y `B/14` §2.2 que *«la sucesora lo hereda»* para el contador de N cobros. **El
upgrade no es un acto: es una ventana de 72 h con dos instantes** —crear la sucesora y recibir el
webhook de autorizada— y el re-apuntado es seguro en uno solo. Elegir el otro cuelga los bienes
pagados del cliente de una fila que puede morir.

**El camino.**

1. Cliente `ACTIVE` con dos addons recurrentes de scope `VERTICAL_SUBSCRIPTION` y una promo de tres
   cobros con dos consumidos. Pide un upgrade. Nace la sucesora `PENDING_AUTHORIZATION`.
2. **Lectura A — se re-apunta al crear.** El cliente abandona el checkout. A las 72 h, `S3` lleva la
   sucesora a `ABANDONED`. Los addons cuelgan de una fila muerta y el contador de promo también. Y
   no quedan huérfanos en el sentido de `B/16` §4.2 —esa definición exige `CANCELLED`—, así que
   **nada los repara**: quedan apuntando a una fila terminal mientras la predecesora sigue `ACTIVE`
   y pagando.
3. **Lectura B — se re-apunta al autorizar.** Entre `D7` (cancelar la vieja) y el re-apuntado hay
   una ventana en la que la predecesora ya está resuelta como `CANCELLED` y los addons todavía
   cuelgan de ella: por `B/16` §4.2 quedan huérfanos y por §4.3 *«**se cancelan en el proveedor, de
   inmediato**»*. La condición *«y no tiene sucesora»* salva el caso sólo si el re-apuntado ya
   ocurrió, que es exactamente lo que está en duda.
4. Las dos lecturas son defendibles contra el texto. Quien implemente elige, y en las dos
   direcciones el error es silencioso.

**Dónde lo permite el diseño.** `docs/16-addons.md` §4.2 (*«en el mismo acto del upgrade»*) y §4.3;
`docs/14-promos-cortesias-y-grants.md` §2.2 (*«la sucesora lo hereda»*);
`docs/03-maquinas-de-estado.md` §3.2, `S3` (las 72 h) y `S1`.

**Severidad.** `ALTA` — destrucción silenciosa de bienes pagados, que es la clase de defecto que el
cambio 18 de `R1` vino a cerrar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** El re-apuntado es el cambio 18 de `R1` y la
respuesta a `F-8B2-005`. Resuelve el veredicto y no fija el instante, que es el único dato que el
mecanismo necesita para ser seguro.

---

### F-8bB2-010 — La fecha de primer cobro de una sucesora se fija a un día dentro de una ventana de 72 h, y es inmutable: puede estar en el pasado antes de que nadie autorice

**Qué se rompe.** `D8` es *«la precondición de seguridad de todo cambio de plan o de ciclo»* y el
arreglo la volvió verificable fijando el mínimo en **un día**. La ventana de autorización dura
**72 h**, y `EX-39` mide que la fecha de una `pending` **no se puede mover** —tres formas, tres
`200`, `last_modified` congelado—. Entonces, en hasta dos de las tres jornadas de la ventana, la
precondición de seguridad está **vencida** y nadie puede corregirla. Qué hace el proveedor al
autorizar un preapproval cuya `start_date` ya pasó **no está medido**, y `G-R1-B` no lo ve porque
verifica el nacimiento.

**El camino.**

1. Cliente `ACTIVE` pide un cambio de ciclo. La sucesora nace con fecha de primer cobro a `t+24 h`
   (`B/12` §5.2: *«**Toda sucesora nace con fecha de primer cobro a un día como mínimo.** Ninguna
   cobra hoy»*).
2. `G-R1-B` verifica *«nace con fecha de primer cobro estrictamente futura»*. Pasa.
3. El cliente no autoriza ese día. A `t+30 h` la fecha ya pasó. `EX-39`: no se puede mover, ni sobre
   una `pending`. `B/12` §5.4 lo concluye: *«**la inmutabilidad de las fechas no depende del
   estado** … `start_date` sirve **sólo al crear**, y punto»*.
4. El cliente autoriza a `t+50 h`. Lo único medido sobre una autorización con fecha futura es
   `EX-33`, y sus tres sujetos tenían `start_date` a **+3, +2 y +5 días**: ninguno mide una fecha
   pasada.
5. Si el proveedor cobra en el acto (que es lo que `PA-3` mide cuando **no** hay `start_date`), `D8`
   queda violado dentro de la ventana en que `D7` todavía no canceló a la predecesora. Si el
   proveedor rechaza la autorización, el cambio de ciclo falla al final de la ventana y el cliente
   se entera en el checkout.
6. Y el mínimo se eligió explícitamente por uniformidad, no por seguridad: *«Así vale para toda
   sucesión, venga de donde venga, `D8` queda en una línea sin excepciones»*. El número que la
   uniformidad eligió es **menor que la ventana que tiene que cubrir**.

**Dónde lo permite el diseño.** `docs/12-suscripcion.md` §5.2 y §5.4; `docs/02-modelo-de-datos.md`
§2.2 (la columna); `docs/20-testing.md` §2, `G-R1-B`; `docs/03-maquinas-de-estado.md` §3.4 punto 1
(las 72 h); `06-mp-validation-matrix.md`, `EX-39` y `EX-33`.

**Severidad.** `ALTA` — el daño concreto depende de una medición que no existe, y las dos ramas son
malas. La mitad de plata es de `B1`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** La regla del día mínimo es nueva (cambio 10 de la
tabla de la FASE 9), y su justificación escrita razona contra una precondición **más precisa**, no
contra la duración de la ventana en la que tiene que valer.

---

### F-8bB2-011 — `CHARGE_DECLINED` entró a los terminales exentos del barrido apoyado en una sola medición de un solo modo de rechazo

**Qué se rompe.** `B/09` §3 suma `CHARGE_DECLINED` a los estados que **no se barren**, con el
argumento de que *«no pueden divergir hacia nada que nos importe»*. Ese argumento depende de una
afirmación sobre el proveedor —que ante un primer cobro rechazado cancela el preapproval de forma
terminal— medida **una vez, el 2026-09-17, sobre un rechazo `cc_rejected_high_risk`**. Si hay un
modo de rechazo que no cancela (fondos insuficientes, por ejemplo), la fila queda en un estado
terminal, exento del barrido, con su preapproval vivo: es `R4` otra vez, con un estado que `R4` no
alcanzó a enumerar.

**El camino.**

1. Un alta nueva cuyo primer cobro se rechaza por un motivo distinto del medido.
2. `S16` lleva la fila a `CHARGE_DECLINED`, cuyo efecto declarado es una afirmación sobre el
   proveedor: *«el proveedor **ya canceló** el preapproval de forma **terminal**»*. No es un efecto
   nuestro: no hay ningún `PUT` de cancelación en la columna.
3. `B/02` §2.2 lo deja fuera de los vivos por esa misma afirmación: *«los tres porque **no tienen
   autorización que pueda cobrar**»*.
4. `B/09` §3 lo deja fuera del barrido por la misma.
5. Si el preapproval está vivo, cobra a alguien cuya fila local está muerta y a quien la superficie
   le dijo *«tu tarjeta rechazó el cobro; volvé a empezar»*. El webhook de ese cobro cae en el
   `SubscriptionNotResolvedError` que `B/09` §5 registra como bug vivo.
6. Y la misma afirmación sin verificar habilita el alta nueva (`R1` §4.10, `C1` → **ENTRA**), así
   que el cliente termina con dos preapprovals.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §3.1 y §3.2 (`S16`, columna
efectos); `docs/02-modelo-de-datos.md` §2.2; `docs/09-conciliacion.md` §3 y §5;
`docs/12-suscripcion.md` §4.4 (la medición, con su fecha y su `status_detail`).

**Severidad.** `ALTA` — no es *«esto no está medido»* a secas: es qué se rompe si esa medición vuelve
al revés, y la respuesta es un cobro recurrente sin detección. La forma barata de cerrarlo es un
efecto nuestro en `S16` (cancelar y verificar) en vez de una afirmación sobre el proveedor.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** `CHARGE_DECLINED` y su exención del barrido son
los cambios 6, 9 y 14 de `R1`. El estado entró a las dos listas —los no-vivos y los no-barridos— por
la misma medición, así que un solo error de medición abre las dos.

---

### F-8bB2-012 — El Partner que paga por transferencia cae en `CHARGE_DECLINED`, un estado terminal cuya justificación es un preapproval que él no tiene

**Qué se rompe.** La regla de `§4.3` —*«una suscripción cuyo **primer** cobro falla, para un
`user + vertical` sin ningún pago acreditado, no pasa por `GRACE_PERIOD`: va a **`CHARGE_DECLINED`**,
que es terminal»*— no acota el medio de pago. Un Partner de alta administrada cuya primera
transferencia tarda dos días queda **muerto de forma terminal**, y la salida que el capítulo le
ofrece —*«el reintento es un alta nueva»*— es una operación que él no puede ejecutar. El §7 del mismo
capítulo 03 dice lo contrario: que el pago manual va a `GRACE_PERIOD` *«los mismos días
configurables que el resto»*.

**El camino.**

1. Un Partner se configura con pago manual (§17.2). No hay preapproval, no hay tarjeta, no hay
   débito.
2. Llega el vencimiento del primer período y la transferencia no aparece.
3. `B/03` §7 dice que *«si falta el pago, va a `GRACE_PERIOD` **los mismos días configurables** que
   el resto»* y que se notifica al admin, *«el único caso donde una notificación es parte del flujo»*.
4. `B/12` §4.3 dice que un `user + vertical` sin ningún pago acreditado **no pasa por
   `GRACE_PERIOD`**: va a `CHARGE_DECLINED`, terminal.
5. Las dos reglas se aplican al mismo sujeto y dan destinos opuestos, y uno de los dos es
   irreversible.
6. Peor: la justificación de que `CHARGE_DECLINED` sea terminal es *«el proveedor ya canceló el
   preapproval de forma terminal»* y *«no hay vuelta»*. En pago manual **no hay preapproval**, así
   que el estado es terminal por una razón que no existe en ese camino.
7. Y el aviso de `§4.5` punto 3 —*«se le dice que **el cobro no entró** y cómo volver a
   intentarlo»*— se le manda a alguien que hizo una transferencia.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §7 y §3.2 (`S16`);
`docs/12-suscripcion.md` §4.3, §4.4 y §4.5 punto 3.

**Severidad.** `ALTA` — fin irreversible de una relación comercial administrada por una demora
bancaria de dos días.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** `F-8B2-018` ya reportaba que el pago manual choca
con `§4.3`; lo que cambió es el destino: antes era `SUSPENDED`, que al menos promete `S7`, y ahora es
un estado declarado **terminal**. El arreglo empeoró el mismo camino.

---

### F-8bB2-013 — La «ventana reducida» del §5.4 es un mecanismo sin modelo, y puede caer por debajo del piso que justifica las 72 h

**Qué se rompe.** `B/12` §5.4 resuelve el crédito corto diciendo que *«cuando falten pocos días para
la renovación de la predecesora, el cambio de plan se ofrece con **ventana reducida**»*, y cierra:
*«Cuántos días es «pocos» queda por definir: **es un número, no un mecanismo**»*. No es un número:
la duración de la ventana es la condición de `S3`, vive en las opciones **globales** de billing
(§3.4 punto 1), y el modelo no tiene dónde guardar una ventana por fila. Y su justificación fija un
piso —*«tiene que ser más largo que cualquier demora del proveedor»*— que una ventana reducida puede
violar en silencio.

**El camino.**

1. Un cliente pide un cambio de ciclo a tres días de su renovación. Se le ofrece con ventana
   reducida: digamos 6 h.
2. La condición de `S3` es *«pasaron **72 h** sin autorizar»* y el §3.4 punto 1 dice que ese valor
   *«es configuración, no constante (§9), y vive en las **opciones globales de billing**»*. No hay
   columna por suscripción: `B/02` §2.2 enumera lo que `subscription` guarda y la ventana no está.
3. Si el job de limpieza lee la ventana global, la reducción no se aplica y el problema que §5.4
   quería evitar vuelve. Si la lee de algún lado que no existe, hay que agregarlo al modelo — o sea,
   un mecanismo.
4. Y el piso: la ventana se dimensionó *«más larga que cualquier demora del proveedor —medida hasta
   ~33 min— y más corta que el ciclo más corto que vendemos»*. `WH-4` mide reintentos de webhook a
   **+18,8 min** y **+35,1 min** tras un `500`. Una ventana de 6 h aguanta; una de 30 min, que es lo
   que «faltan pocas horas» pediría, no — y el modo de falla es `F-8B2-003`: el job cancela,
   irreversible, una autorización real.

**Dónde lo permite el diseño.** `docs/12-suscripcion.md` §5.4; `docs/03-maquinas-de-estado.md` §3.4
punto 1 y §3.2 (`S3`); `docs/02-modelo-de-datos.md` §2.2; `06-mp-validation-matrix.md`, `WH-4`.

**Severidad.** `ALTA` — es la única defensa escrita contra el crédito corto de §5.4, y no se puede
implementar sin tocar el modelo ni sin fijar un piso que hoy no tiene.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** El §5.4 entero es de esta pasada.

---

## MEDIAS

### F-8bB2-014 — `S15` no tiene transición de destino para dos resoluciones que el diseño ya declara: la de `C2` y la de una autorización que el proveedor mató antes de tiempo

**Qué se rompe.** `S15` dice que *«si además corresponde un cambio de estado, se ejecuta **la
transición de esta misma tabla que lo permita**»*. Hay al menos dos resoluciones declaradas en otros
capítulos para las que **no existe esa transición**, y en las dos la persona que resuelve queda sin
poder ejecutar lo que el diseño le manda hacer.

**Los dos casos.**

1. **`C2`, la rama del cobro anterior a la cancelación.** `B/05` §2 `C2` manda *«se **extiende la
   fecha de fin de servicio** hasta cubrirlo»*. Si `S12` ya corrió, la fila es `CANCELLED`, y `B/03`
   §3.3 prohíbe de frente *«`CANCELLED` → cualquier cosa»*. La única transición que lo permitiría no
   está en la tabla, así que por la regla 1 el intento vuelve a poner una marca — la misma que `S15`
   acaba de levantar.
2. **Una `PENDING_AUTHORIZATION` cuyo preapproval el proveedor canceló.** Es el segundo renglón de
   la tabla de `F-8bB2-005`, y su daño propio es de mensaje: sin destino, la fila espera las 72 h y
   `S3` la lleva a `ABANDONED`, que le dice al cliente *«nadie autorizó en 72 h»* cuando lo que pasó
   fue *«intentó y lo rechazaron»*. **Es el residuo que `B/12` §4.4 punto 2 declara cerrado** —*«las
   dos muertes ya no comparten estado»*— reabierto por una carrera: `WH-4` mide que un webhook
   reintentado tras un `500` llega a **+35,1 min**, y `PA-3` que el cobro real llega a los **26 a 44
   minutos**, así que el rechazo puede preceder a la confirmación de la autorización. Y `S2` exige
   *«confirmado por relectura»*: la relectura, tras el rechazo, devuelve `cancelled`, así que `S2`
   **nunca se puede confirmar**.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §3.2 (`S15`, `S2`, `S3`) y §3.3;
`docs/05-idempotencia-y-concurrencia.md` §2, `C2`; `docs/12-suscripcion.md` §4.4 punto 2;
`06-mp-validation-matrix.md`, `WH-4` y `PA-3`.

**Severidad.** `MEDIA` — no falla solo, pero es la respuesta concreta a la pregunta *«¿qué caso queda
sin destino?»*, y el segundo caso reabre un residuo que el diseño da por cerrado.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** El primer caso es `F-8B2-019` punto 5, que sigue
llegando. El segundo lo creó el arreglo: `CHARGE_DECLINED` sólo se alcanza desde `ACTIVE`, y la
carrera que impide llegar a `ACTIVE` no estaba mirada.

---

### F-8bB2-015 — La `version` de `provider_link` avanza al releer sin aplicar, y descarta después los eventos que sí traían hechos

**Qué se rompe.** El §10.1 descarta *«sin gastar una relectura»* todo evento cuya `version` no sea
mayor que *«la última aplicada»*. El barrido de `B/09` §3 relee el recurso entero cuando la `version`
del proveedor es mayor, **y explícitamente no escribe el estado**. Si esa lectura actualiza la
`version` guardada, la columna pasa a afirmar *«aplicamos hasta la N»* sobre algo que no se aplicó, y
los eventos intermedios se descartan. Si no la actualiza, el barrido vuelve a releer entero todas las
noches sobre la misma divergencia. Ninguna de las dos está escrita.

**El camino.**

1. Se muta el monto. `EX-15`: *«la `version` del recurso saltó de 5 a 9, o sea que el recurso cambió
   y el proveedor no avisó»*.
2. El barrido lo detecta: *«si la del proveedor es mayor, **el recurso cambió sin avisarnos**: se
   relee entero»* (`B/09` §3). Compara, encuentra la divergencia de monto y **pone la marca** — no
   escribe estado.
3. Si se guarda `version = 9` en `provider_link` (*«la última `version` del recurso que aplicamos»*,
   `B/02` §2.2), todo evento con `version` 6, 7 u 8 que llegue después —y `WH-4` mide reintregas a
   +35,1 min, y `WH-2` demoras de hasta 32 s— se descarta *«ahí mismo»*, sin relectura, aunque traiga
   un hecho que no se aplicó.
4. La fila, además, ya está marcada y por lo tanto fuera del barrido (`F-8bB2-007`), así que la
   relectura que hubiera corregido el descarte tampoco corre.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §10.1;
`docs/02-modelo-de-datos.md` §2.2 (`provider_link`, *«la última `version` del recurso que
aplicamos»*); `docs/09-conciliacion.md` §3, última fila.

**Severidad.** `MEDIA` — el mecanismo de descarte no distingue *leer* de *aplicar*, y la palabra
elegida en el modelo (*«que aplicamos»*) dice lo correcto mientras el único camino que la escribe no
aplica nada.

**¿Es nuevo, o es el arreglo?** **Nuevo**, destapado al recorrer la interacción entre la regla de
no-retroceso y la exención de las filas marcadas, que sí es del arreglo.

---

### F-8bB2-016 — El candado sólo ataja la carrera si la fila se inserta antes de llamar al proveedor, y ningún capítulo declara ese orden

**Qué se rompe.** Todo el argumento de `R1` —*«diez altas simultáneas dejan **una** fila»*, *«el
segundo `INSERT` lo rechaza la base»*— supone que el `INSERT` local ocurre **antes** de la llamada al
proveedor. Lo único que el diseño declara con ese orden es la **clave de idempotencia**
(`DEC-CONC-001`: *«se persiste antes de la primera llamada»*). Si el `INSERT` de `subscription` va
después —porque alguien quiere guardar el id del proveedor en la misma transacción—, el candado no
ataja nada: salen dos llamadas, nacen dos preapprovals, y el segundo `INSERT` falla dejando uno
huérfano y vivo que `B/09` §2.1 declara **invisible para el barrido**.

**El camino.**

1. Doble clic en *«cambiar de ciclo»*. Dos requests, dos claves de idempotencia distintas —`B/03`
   §3.3: *«Volver a intentar crea una fila nueva, con **clave de idempotencia nueva**»*—, así que
   `UNIQUE(clave)` no colisiona.
2. Si el orden es `INSERT` → llamada: el candado `B` rechaza el segundo `INSERT` y sólo sale una
   llamada. ✅
3. Si el orden es llamada → `INSERT`: `EX-17` mide que el proveedor *«no deduplica por ningún
   mecanismo: diez intentos, diez ids»*. Nacen dos preapprovals; el segundo `INSERT` colisiona; el
   segundo preapproval queda sin `provider_link`.
4. `B/09` §2.1: *«una suscripción cuyo id se pierde **es invisible para el barrido**, y sólo
   reaparece si cobra y emite un webhook»*. Y si cobra, cobra dos veces.
5. El único barrido que lo alcanzaría —*«creaciones sin respuesta, cada pocos minutos»*, `B/09` §7—
   está escrito para el caso en que la respuesta **se perdió**, no para el caso en que la respuesta
   llegó y el `INSERT` falló.

**Dónde lo permite el diseño.** `docs/02-modelo-de-datos.md` §2.2 y §2.3;
`docs/05-idempotencia-y-concurrencia.md` §1.1 y §1.2; `docs/09-conciliacion.md` §2.1 y §7;
`docs/03-maquinas-de-estado.md` §3.2 (`S1`, columna efectos: declara el orden **de la clave**, no el
de la fila).

**Severidad.** `MEDIA` — el daño concreto está contado en `F-8B2-022` y `F-8B2-006`; lo que agrego es
que la defensa de la que `R1` depende entera tiene una precondición de orden que no está escrita en
ningún lado, ni siquiera en `S1`, que es donde se escribió la otra.

**¿Es nuevo, o es el arreglo?** **Nuevo sobre el arreglo.** `R1` apoyó todo su razonamiento en *«la
base lo impide»* sin declarar la condición bajo la cual la base llega a enterarse.

---

### F-8bB2-017 — Un `PAUSED` por `COURTESY` recibe el mismo «reanudá para cambiar de plan» que un `PAUSED` por `CUSTOMER_REQUEST`, y reanudar le consume el regalo

**Qué se rompe.** El §3.3.1 y la fila 17 de `B/19` §4 fijan un mensaje único para `PAUSED`:
*«reanudá tu suscripción para cambiar de plan»*. La máquina, sin embargo, insiste en que el motivo
**no es un adorno** y que una cortesía y una pausa pedida por el cliente son cosas distintas. A un
cliente en cortesía ese mensaje le está pidiendo que renuncie a los días que le regalamos, sin
decirlo, y `S10` no tiene forma de devolverle lo que consume.

**El camino.**

1. `SUPER_ADMIN` otorga una cortesía de dos meses. `S9`: la suscripción queda `PAUSED` con motivo
   `COURTESY` y *«el servicio se sostiene de nuestro lado»* (`DEC-GRANT-003`).
2. Al mes, el cliente quiere cambiar de plan. La superficie le dice *«reanudá tu suscripción para
   cambiar de plan»*.
3. `S10` —*«llega el fin, **o la persona vuelve antes**»*— la lleva a `ACTIVE`. La cortesía termina:
   `B/03` §5 declara el aviso simétrico para el caso vecino (*«en cortesía pide pausar → se permite,
   **avisando que pierde la cortesía que le quedaba**»*) y `B/19` §4 fila 5 lo obliga; **para esta
   puerta no hay ninguna de las dos cosas**.
4. Y al reanudar, `DEC-SUB-010` manda mostrar *«una sola cosa: qué día se le va a cobrar»*, así que
   el aviso que existe es justamente el que no puede decirle qué perdió.
5. `subscription_pause` admite *«a lo sumo una sin `fin_real` por suscripción»*, así que la fila de
   cortesía se cierra y con ella se pierde el dato de cuántos días de regalo quedaban.

**Dónde lo permite el diseño.** `docs/03-maquinas-de-estado.md` §3.3.1 (fila `PAUSED`) y §5;
`docs/19-superficies.md` §4, filas 5, 6 y 17; `docs/02-modelo-de-datos.md` §2.2
(`subscription_pause`).

**Severidad.** `MEDIA` — pérdida de un beneficio otorgado, sin aviso, por seguir una instrucción de
la propia superficie.

**¿Es nuevo, o es el arreglo?** **Es el arreglo.** El §3.3.1 y las filas 16/17 de `B/19` §4 son de
esta pasada, y fijan un mensaje por **estado** en un capítulo cuya tesis central es que sobre
`PAUSED` no se decide nada por estado, sino por motivo.

---

## Los veintidós hallazgos de la FASE 8, reejecutados sobre el texto nuevo

Esto **no cuenta como hallazgos nuevos**. Reejecuté los veintidós caminos de
[`14-fase-8-adversarial/B2-maquinas-idempotencia-y-carreras.md`](../14-fase-8-adversarial/B2-maquinas-idempotencia-y-carreras.md)
paso por paso contra los capítulos de hoy.

**Tres cortan enteros. Cinco cortan a medias. Catorce siguen llegando.**

| # | título abreviado | veredicto | dónde corta, o por qué sigue |
|---|---|---|---|
| `F-8B2-001` | el §11 vuelve imposible todo upgrade | **CORTA** | paso 4: la sucesora declara `sucede_a`, el candado `A` no la ve (`B/02` §2.2). Reaparece un paso más tarde → `F-8bB2-002` |
| `F-8B2-002` | `RECONCILIATION_REQUIRED` es una trampa | **CORTA** | paso 2: el estado dejó de existir (`B/03` §3.1). Los seis pasos caen con un solo cambio de modelado |
| `F-8B2-003` | el job de 72 h cancela una autorización real | **SIGUE entero** | `B/03` §3.4 punto 2 no cambió: sigue sin pedir relectura antes de cancelar. Y `F-8bB2-013` lo agrava |
| `F-8B2-004` | el barrido fabrica un incidente por cada baja | **SIGUE hasta el paso 5** | pasos 1-5 intactos: `CANCEL_SCHEDULED` no está exento (`B/09` §3 exime `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED`) y `S12` sigue con su condición de fecha. **Corta el paso 6** (*«se repite todas las noches»*) por la exención de las filas marcadas, y deja de llegar *«sale de los vivos»*. Lo que el paso 6 compró está en `F-8bB2-007` |
| `F-8B2-005` | dos capítulos discrepan sobre el upgrade | **CORTA** | paso 3: `B/14` §2.1 está partido por dirección (*«bajar … muta el monto … subir … cancela y recrea»*) |
| `F-8B2-006` | doble clic en un addon = dos preapprovals | **SIGUE entero** | `addon_instance` sigue con una sola restricción declarada (`B/02` §2.4) y `A1` sigue sin más condición que la principal |
| `F-8B2-007` | el barrido no mira los terminales | **SIGUE entero** | `B/09` §3 y `B/16` §4.3 siguen diciendo lo contrario, y ahora el conjunto exento es **más grande**: suma `CHARGE_DECLINED` y toda fila marcada |
| `F-8B2-008` | `SUSPENDED` tras un primer cobro rechazado | **CORTA sólo para quien nunca pagó** | paso 2 corta por `CHARGE_DECLINED`. Para todo cliente con un pago acreditado histórico llega entero → `F-8bB2-003` |
| `F-8B2-009` | `GRACE_PERIOD` inalcanzable | **SIGUE**, y dejó de ser hipotético | su punto 3 ya no es *«si la medición vuelve así»*: `B/12` §4.4 la trae. Su rama simétrica (punto 6) es `F-8bB2-006` |
| `F-8B2-010` | dos `UNIQUE` sobre `payment` se confunden | **SIGUE entero** | `C5`/`C6` sin cambios, y `R1` §5 declara el candado **incerrable** hasta el capítulo 13 |
| `F-8B2-011` | *Free Forever* cancela los addons | **SIGUE entero** | `B/16` §4.2 exime *«y no tiene sucesora»*; `S13` va a `CANCELLED` **sin** sucesora, así que el addon sigue quedando huérfano |
| `F-8B2-012` | ninguna transición declara el aviso de cobertura | **SIGUE la primera mitad; la segunda, a medias** | la columna «efectos» del §3.2 sigue sin nombrar el aviso del contrato §3. De *«qué estados cubren»*: `PAUSED` quedó resuelto por motivo (`B/02` §2.4) y `GRACE`/`CANCEL_SCHEDULED` por el contrato §4 y §2.6; **`PENDING_AUTHORIZATION` y `CHARGE_DECLINED` siguen sin respuesta**, y el segundo es nuevo |
| `F-8B2-013` | la clave del outbox no distingue períodos | **SIGUE entero** | `NUCLEO/07` §2 sin cambios |
| `F-8B2-014` | el correo que bloquea la cancelación | **SIGUE entero** | `NUCLEO/07` §4.2/§5.3 sin cambios, y el camino que lo dispara —la cancelación de la vieja— ahora además no tiene transición (`F-8bB2-001`) |
| `F-8B2-015` | pausar en cortesía: decidido, prohibido, imposible | **SIGUE entero** | `B/03` §5 y §3.3 sin cambios. `F-8bB2-017` agrega la otra puerta del mismo estado |
| `F-8B2-016` | `A3` no cancela nada en el proveedor | **SIGUE entero** | `B/03` §8, `A3`, sin efectos sobre el proveedor |
| `F-8B2-017` | `A2` autoriza sobre una principal ya inválida | **SIGUE entero**, agravado | `A2` sigue sin condición, y ahora la principal puede además haber sido **sucedida** y cancelada dentro de la misma ventana |
| `F-8B2-018` | la máquina de pago manual no tiene entrada | **SIGUE entero**, agravado | `AWAITING` sigue sin transición de entrada, y el destino del §4.3 pasó de `SUSPENDED` a un terminal irreversible → `F-8bB2-012` |
| `F-8B2-019` | las prohibiciones del §3.3 contra el *«desde: cualquiera»* de `S14` | **CORTA la mitad** | `S14` ya no es una transición, así que no choca con §3.3. **Sigue el punto 5**: `C2` exige mover una fila `CANCELLED` → `F-8bB2-014` |
| `F-8B2-020` | la cortesía consume la cuota de pausa | **SIGUE entero** | `B/03` §5 sigue contando por `user + vertical` sin mirar el motivo |
| `F-8B2-021` | `MP2` dispara `S6` sin su evento; `S15` aterriza en *«el que corresponda»* | **CORTA la mitad** | `S15` ya no elige estado. **Sigue `MP2`**, que invoca `S6` *«sin esperar el reloj»*, o sea anulando su evento declarado |
| `F-8B2-022` | el candado de idempotencia no define la contención | **SIGUE entero** | `B/05` §1.1/§1.2 sin cambios. `F-8bB2-016` agrega la precondición de orden que `R1` presupone |

---

## Ataques que intenté y el diseño resistió

Los lugares donde busqué y no encontré. Van con el detalle de qué los sostiene, porque es lo que
permite no volver a gastarlos en la próxima vuelta.

1. **Dos declaraciones de sucesión concurrentes (doble clic en «cambiar de ciclo»).** El candado `B`
   es una restricción de la base sobre `(user_id, vertical)` con el mismo predicado de estados, así
   que la segunda colisiona sin ninguna coordinación. Es el nivel correcto, igual que el §11 y que
   `UNIQUE(promo_code_id, user_id)`. Lo único que le falta es la precondición de orden
   (`F-8bB2-016`), que no es del candado sino de cuándo se lo consulta.
2. **Una cadena de sucesiones simultáneas** (`O → S₁ → S₂` con las tres vivas). Cerrado por
   construcción, y el argumento de indexar `B` sobre `(user_id, vertical)` en vez de sobre `sucede_a`
   es elegante. Lo que no está cerrado es la consecuencia no simultánea, que es `F-8bB2-002`.
3. **`S16` llegando dos veces.** Idempotente por dos caminos independientes: el destino es terminal
   y `S16` sólo sale de `ACTIVE`, así que la segunda evaluación no encuentra origen; y el hecho
   —un pago— deduplica por `UNIQUE(proveedor, id_del_hecho)` (`B/02` §2.3), que es el nivel de
   `C6`. No encontré por dónde entrarle.
4. **La marca puesta dos veces, o levantada dos veces.** Es un booleano: `S14` sobre una fila ya
   marcada no cambia nada, y `S15` sobre una sin marca tampoco. Es la ventaja concreta y no
   declarada de haber dejado de modelarlo como estado — un estado habría necesitado una regla de
   idempotencia propia.
5. **El pago tardío reactivando a una predecesora superada.** La condición 3 de `B/05` §3 fue
   reescrita sobre el eje nuevo y la reescritura **endurece**: la fila marcada conserva su estado y
   entra en la cuenta, que era el agujero de `F-8B1-002` paso 5. Y el caso que parecía el borde —una
   sucesora en `PENDING_AUTHORIZATION` que no bloquea— está razonado con `D8` y es correcto: todavía
   no puede cobrar.
6. **Dos webhooks del proveedor desordenados.** Sigue resistiendo por la misma razón que en la
   FASE 8: los dos releen y los dos escriben lo leído. Lo que encontré no es un retroceso sino que
   *lo leído* muchas veces no se puede escribir (`F-8bB2-005`), que es otra cosa.
7. **La carrera del canje de promo el día del vencimiento del trial.** Intacta y sigue siendo el
   mejor diseño de carrera del programa: *«gana el estado escrito, nunca la hora»* más la relectura
   dentro de la transacción del job, más *«un canje rechazado no se consume»*.
8. **`C1`, el pago que entra mientras corre la suspensión.** La reevaluación de la transición dentro
   de la transacción que escribe, con la versión de la fila (§10.3), cierra el intermedio sin elegir
   ganador.
9. **El reuso de la ventana de `PENDING_AUTHORIZATION`.** El cambio 12 de `R1` lo movió de una regla
   de servicio a una consecuencia de la restricción, y eso es estrictamente mejor: `R1` §4.1 recorre
   los diez caminos y ocho rechazan por el candado `A`, sin depender de que nadie se acuerde.
10. **Deduplicar por id de notificación.** El diseño no lo usa: usa la `version` para descartar y el
    id del **hecho** para los cobros, y `WH-4` mide que el reintento cambia el id y re-firma
    mientras la `version` se mantiene. Lo que sí encontré es qué significa esa `version` cuando se
    lee sin aplicar (`F-8bB2-015`).
11. **La cuota de pausa sobreviviendo a cancelar y resuscribirse**, y **el mismo razonamiento
    aplicado a «ningún pago acreditado»**. Los dos cuentan por `user + vertical` y los dos cierran su
    bypass evidente. El segundo cierra de más, y eso es `F-8bB2-003`.

---

## Lo que cae en el hueco del capítulo 13

De mi vector, y sólo lo que **esta fase movió**. Lo demás sigue como lo dejó la FASE 8.

1. **Qué dispara la relectura de una baja decidida por el proveedor.** `B/12` §1.4 la manda y no
   dice quién la llama; `EX-15` y `B/16` §4.3 miden que cancelar y mutar no avisan; y el barrido,
   único candidato, ahora se apaga sobre las filas marcadas. Es la mitad de `F-8bB2-005` que no es
   una transición faltante sino un disparador faltante.
2. **Quién evalúa `S16`, y contra qué.** La condición es sobre **nuestros** pagos acreditados, y
   ningún capítulo dice quién escribe un `payment` acreditado ni con qué clave antes de que exista
   el id del hecho. `F-8B2-010` ya dependía de eso; `S16` ahora también.
3. **El período, otra vez.** `R1` §5 declaró el candado de `C5` incerrable hasta el 13 y nombró la
   forma que tendría. Sigue siendo el único crítico del racimo que llega entero, y la decisión que
   lo destraba —unificar `payment` y `manual_payment`— cambia el modelo.
4. **Qué le pasa a un preapproval `pending` cuya `start_date` ya venció al autorizar.** `EX-39`
   cerró que no se puede mover y `EX-33` midió el caso con fecha futura. El caso con fecha pasada no
   está medido y es alcanzable por el mínimo de un día (`F-8bB2-010`). Es una sonda de sandbox, sin
   costo.

---

## Fuera de mi vector

- **`B1` (doble cobro / pérdida de pago)** — le cedo las mitades de plata de `F-8bB2-001`,
  `F-8bB2-004` y `F-8bB2-010`. La de `F-8bB2-001` es la más cara: durante una ventana sin cota, dos
  preapprovals del mismo `user + vertical` cobran, y la fila que habría que cancelar está marcada,
  o sea fuera del barrido.
- **`B3` (conciliación, datos, migración)** — el **listado accionable** de `B/19` §6 pasó a ser el
  destino por defecto de la regla 1 del núcleo y de cada baja de la cartera (`F-8B2-004`, que sigue
  llegando), y **no tiene plazo, escalamiento ni vencimiento declarados**. Con la exención de
  `B/09` §3, una entrada que nadie abre es una fila que nadie vuelve a mirar nunca. Es materia de
  conciliación y de operación, no de máquinas.
- **`B3`** — `provider_link` sigue sin columna de estado ni máquina propia, que es la dimensión que
  `00-dominios` §2 declara inenumerable. `CHARGE_DECLINED` entró a los terminales exentos **sin**
  recorrer esa dimensión (`F-8bB2-011`), así que el dominio de `R4` creció de 28 a 30 casos y los
  dos nuevos no están mirados.
- **`NUCLEO`** — `nucleo/03-maquinas-de-estado.md` §1 regla 1 y `docs/03-maquinas-de-estado.md`
  §10.1 se contradicen de frente sobre el mismo acto: la regla 1 dice que lo que la tabla no declara
  **no se escribe**, y el §10.1 que **se escribe lo leído**. La mitad corregible es la de billing
  —agregar las transiciones que faltan— pero la regla 1 es la que decide qué pasa mientras no estén,
  y hoy decide *«marcar»*. Es `F-8bB2-005`, y lo dejo nombrado acá porque la pasada `C` va a tener
  que dirimir cuál de las dos gana.
- **`NUCLEO`** — `nucleo/04-invariantes.md` §3, `D7` declara su sostén en la columna *«servicio»* y
  `D15` en *«base»*. `D15` está sostenido por los dos índices, como dice; `D7` no está sostenido por
  nada: no hay transición, no hay restricción y no hay guard. Un invariante cuyo sostén declarado es
  «servicio» y cuya ejecución la tabla no admite es peor que uno sin sostén, porque la columna
  afirma que alguien lo cuida.
- **Producto** — `F-8bB2-012` y `F-8bB2-017` necesitan, cada uno, una línea de copy que hoy no
  existe: qué se le dice a un Partner cuya transferencia no llegó, y qué se le dice a alguien en
  cortesía que quiere cambiar de plan.
