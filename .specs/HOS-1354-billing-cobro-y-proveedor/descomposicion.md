---
title: Descomposición de la épica de billing
linear: HOS-1354
statusSource: linear
created: 2026-09-18
updated: 2026-09-27
status: CURRENT
---

# Descomposición de HOS-1354

> **Esto no es un plan de fechas ni el atomizado en tareas.** Es el corte en unidades de trabajo y
> el orden que sale de las dependencias del propio diseño. El atomizado de cada unidad se hace
> cuando esa unidad arranca, no ahora.
>
> **Y se hace entera, con la pasarela sin decidir.** Doce de los trece capítulos están escritos, así
> que el reparto no espera a nada. **Lo que sí espera es la construcción**: ver §2.3.
>
> ✅ **Desde el 2026-09-24 la pasarela está decidida y el diseño está completo** (FASE 9 completa,
> salida 3 de `DEC-METH-004`): `DEC-MP-005` fijó **Mercado Pago**, `DEC-MP-006` puso **el reloj de
> cobro del lado del proveedor**, y el capítulo 13 **no se escribió: se repartió** entre `B/02`
> §2.3, `B/03` `S29` y §6.1, `B/05` C5 y `B/06` §4.6 (`nucleo/00-indice.md`). **Con eso B6 dejó de
> ser la unidad sin diseño** (§2) y **nada del reparto espera ya a un tercero**. El recuadro de
> abajo y el §2.3 describen el estado de antes y quedan como rastro, tachados donde dejaron de ser
> ciertos.
>
> ---
>
> ### ~~⛔ Antes de empezar a construir: falta decidir la pasarela~~ ✅ La pasarela se decidió el 2026-09-24
>
> **De las trece unidades, nueve llaman a la pasarela**, y ~~ninguna de esas nueve se puede terminar
> sin saber cuál es~~ desde `DEC-MP-005` las nueve se construyen contra el adaptador de Mercado
> Pago. ~~La única que se puede hacer **entera** hoy es **B2 (el precio)**; de **B1** se
> puede escribir la interfaz y su guard, no el adaptador real.~~
>
> No es una demora administrativa: `DEC-ARCH-004` puso el ciclo de vida de nuestro lado, y **cuál
> pasarela sea decide la forma de casi todo el sistema de billing** — si el reloj de cobro es
> nuestro o suyo, si la pausa es nativa, si un addon es una autorización aparte o una línea, si la
> conciliación puede listar o tiene que leer de a una.
>
> Lo que **sí** se puede hacer hoy, y conviene hacer: **atomizar y especificar** las ~~doce~~
> **trece** unidades ~~cuyo diseño está escrito~~ — desde el 2026-09-24 todas tienen el diseño
> escrito. Su política no cambia con la respuesta.
>
> ~~**Qué la destraba**: los dos textos de la PRUEBA 0 y el mail de habilitación de Mobbex — los dos
> están en manos del owner ([`spec.md`](./spec.md) §7).~~ **Ya no hay nada que la destrabe**: la
> PRUEBA 0 y la cuenta de Mobbex quedaron sin objeto con `DEC-MP-005` ([`spec.md`](./spec.md) §7).

## 1. El criterio de corte

**Se corta por lo que sobrevive a la respuesta del capítulo 13**, no por capa técnica ni por
capítulo.

Cortar **por capa** tiene el problema conocido: nada funciona hasta el final, y el primer error de
modelado se descubre con tres capas encima. Cortar **por capítulo** es peor acá que en la otra
épica, porque los tres capítulos transversales —el `02`, el `03` y el `05`— no tienen materia
propia: se reparten entre cinco, seis y cuatro unidades respectivamente.

### 1.1 La restricción que la otra épica no tenía

**Doce de los trece capítulos se escribieron con la forma de Mercado Pago puesta** —el
`preapproval`, su checkout, su pausa nativa—, y `DEC-ARCH-004` llegó **al día siguiente** de casi
todos ellos: los capítulos son del 2026-09-17, la decisión del 18. Lo que esa decisión dice sobre
lo ya escrito está en su implicación 3: *«las 20 decisiones acopladas se revisan, no se
reescriben. En cada una la política sobrevive y lo que se revisa es la forma»*.

**Entonces el corte no puede seguir el mecanismo: tiene que seguir la política.** Una unidad
definida como *«crear el preapproval y mandar al checkout»* **deja de existir** si el 13 contesta
que el cargo puntual contra tarjeta guardada es el modelo canónico. Una definida como *«que exista
un compromiso de cobro vivo, con la ventana en que todavía no lo es»* sobrevive a las dos
respuestas, y lo que cambia adentro es qué se hace en esa ventana.

Las trece unidades de abajo están enunciadas así a propósito. Si el 13 contesta lo contrario de lo
que hoy hace Mercado Pago, **el reparto no se redibuja** — se revisa el interior de las que hablan
con la pasarela, que son nueve. **Que el corte aguante no quiere decir que la construcción pueda
empezar**: son dos cosas distintas, y el §2.3 las separa.

> ✅ **Y el 13 contestó lo mismo que hoy hace Mercado Pago** (`DEC-MP-006`, 2026-09-24): el reloj
> de cobro es del proveedor y el mandato es el modelo canónico, ~~con el cargo puntual **declarado
> como destino**~~ **sin destino pendiente** (📌 del 2026-09-26: la habilitación no tuvo respuesta). **El reparto no se redibujó**, que es lo que este § prometía; lo que cambió es el
> interior de B6 (§2). *(FASE 9 completa, salida 3 de `DEC-METH-004`.)*

### 1.2 La cadena que ordena

Cada eslabón deja **una pregunta contestada**:

```text
¿cómo se le habla a una pasarela, y cómo miente?   → B1
¿cuánto cuesta?                                     → B2
¿hay un compromiso de cobro vivo?                   → B3
¿esta persona está cubierta?                        → B4
¿qué dinero se movió?                               → B5
¿cómo se mueve el dinero?                           → B6   ← ya no está bloqueada (DEC-MP-006)
¿qué pasa cuando no entra?                          → B7
¿qué pasa cuando el cliente cambia de idea?         → B8
```

Las cinco últimas —concesiones, addons, conciliación, el catálogo que se retira y superficies— no
están en la cadena porque **no la condicionan**: se apoyan en ella.

### 1.3 Tres reglas que valen para las trece

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después se
   escribe contra código ya escrito, y para entonces hay call sites que lo violan: nace con una
   lista de excepciones, que es exactamente cómo un guard deja de servir. Y cada uno **lleva su
   caso que lo hace fallar a propósito** — un guard que no puede fallar es un comentario con exit
   code 0.
2. **Ninguna unidad le cree a un código de estado.** Toda mutación se verifica releyendo y
   comparando **campo por campo cada campo que se mandó**, y ninguna aserción de test se escribe
   sobre un `2xx`. No es criterio: está medido nueve veces que este proveedor **acepta y
   descarta**, y que un `PUT` con varios campos se aplica a medias con un solo `200` (`EX-20`).
3. **Lo que toca plata no se ejecuta solo.** Toda divergencia de monto, estado o cobro **abre una
   marca `requiere_conciliación`, con su MOTIVO** (`02` §2.5), y la mira una persona. Es el criterio
   del owner —*«toca plata o no toca plata»*— aplicado adentro de la épica que toca plata entera.
   **El motivo es parte de la regla**: el corpus escribe ~~quince~~ ~~dieciséis~~ ~~diecinueve~~ ~~veinte~~ ~~**veintidós**~~ ~~**veintitrés**~~ **veinticuatro** marcas distintas (FASE 8 completa: `F-8CB1-013`, `F-8CB3-009`, `F-8CB3-003`, `DEC-SUB-020`, y la pendiente 6, owner 2026-09-25; **y FASE 9 completa: el 21 con la decisión 3d y el 22 con `F-8CB2-003`**, `B/02` §2.5) sobre la misma
   casilla y ~~**seis**~~ ~~**siete**~~ ~~**ocho**~~ **nueve** dicen *«hay plata del cliente que devolver»* (el 23 y el 24, con su `SÍ`, desde la FASE 9 vuelta 2, `R4` y `R20`); sin el motivo todas llegaban
   iguales a la bandeja y las que se perdían eran ésas.

---

## 2. Las trece unidades

La columna **⛔** marca las que **llaman a la pasarela**: no se pueden terminar sin saber cuál es.

| # | unidad | ⛔ | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|---|
| **B1** | **El adaptador y el proveedor que miente** | ⛔ | las ocho capacidades como interfaz definida por lo que el dominio necesita, el adaptador falso que reproduce las mentiras medidas, y la regla de releer toda mutación | `06` entero · `20` §2–§3, §6 | `G9` `G10` `G11` `G12` |
| **B2** | **El precio** | ✅ | `billing_option`: el ciclo y su monto, en entero, colgando de la versión de plan y no del plan | `02` §2.1 · `06` §5 | `G7` |
| **B3** | **El alta y su ventana** | ⛔ | hay un compromiso de cobro vivo, y la ventana en que todavía no lo es vence, limpia y no se duplica — **y no nace en una vertical que ya no admite altas, ni como alta nueva ni como sucesión** (`S1`, owner 2026-09-25, 6a, `DEC-ARCH-011`); cada preapproval nace **suelto, sin plan del proveedor** (`DEC-MP-007`) | `03` §3.1–§3.4, §10 · `05` §1, C6 · `02` §2.2 **y §2.5** · **`01` §2.4, §2.5 y §2.6 (núcleo)** · **`10` §4.6** *(quién lee `admiteAltas`)* | **`G-R1-A`** **`G-R1-B`** **`G-R1-E`** **`G-R1-F`** |
| **B4** | **El contrato de cobertura, de verdad** | — | `cobertura()` responde con una fuente de billing viva, y el aviso de que cambió sale — **con los siete campos de la fuente** (`cobrada` en una `SUSCRIPCIÓN`, `piso` en un `GRANT`: owner 2026-09-25, 9h), y **una vertical discontinuada no cubre a nadie desde su fin de servicio** (contrato §2.6, `R11`, `DEC-ARCH-011`) —**con la fecha que calcula `B12`, no leída de verticales** (FASE 9 vuelta 2, `R5`), **que B4 prueba con una fila de `vertical_discontinuation` sembrada hasta que llegue `B12`** (`02` §2.1; FASE 9 vuelta 2, `Q-FECHA`)— | [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) **§2**, **§2.6**, §5.2, §6 | ~~`G13`~~ — *(`G13` lo construye `V4`, como dice el contrato §6.3: owner 2026-09-26, `G5-5`)* |
| **B5** | **El registro del dinero** | — | qué se cobró, qué se reembolsó y qué se registró a mano, sin que un hecho se aplique dos veces ni un período admita dos pagos — **con la máquina mínima del reembolso (`RF1`, `RF4`) y la acción administrativa 14, que asienta un cobro o una devolución ocurridos por fuera** (owner 2026-09-25, 5a, `DEC-RF-008`); **la primera cuota de un pagador manual lleva la fila a `ACTIVE`** (`S29`); y **la cuota impaga de quien se va queda `DECLARED_UNPAID` sin efecto** (`MP3`, tercera cláusula: owner 2026-09-25, 8f); **y la revocación del derecho de arrepentimiento como UNA operación, `S36`**: cancela el preapproval, corta el servicio en el acto y crea `RF1` por el total, sin el botón (owner 2026-09-26, `G5-4`); **y, desde la FASE 9 vuelta 2, owner 2026-09-27, sobre una sucesora sin pagos devuelve el de su predecesora, que encuentra por `sucedida_por`** (`R17`), **y la orfandad que `S36` causa devuelve por `RF1` el último cobro de cada complemento que cae dentro de sus propios 10 días** (`R1-b`, el `RF1` que `S21` crea); **y cada fila de `refund` guarda la clave, el id y el monto de cada devolución que mandó al proveedor** (FASE 9 vuelta 2, `F-8V2B2-002`) | `02` §2.3 · `03` §6 **y §6.1** *(la máquina, `RF1` y `RF4`; lo que va al proveedor es B6)*, §7, §10.2, **`S29`**, **`S36`** · `05` C5 · `22` §2.2 | — |
| **B6** | **Ejecutar el cobro y el reembolso** ~~🔒~~ | ⛔ | ~~**BLOQUEADA, y es la única sin diseño** — es el capítulo 13, el único de los 22 sin escribir~~ **el reembolso sale al proveedor y vuelve leído**: `RF2` lo manda con la clave de idempotencia persistida antes, `RF3` lo da por ejecutado **sólo releyendo por id**, `RF5` cierra el rechazo sin monto que reintentar, y un `2084` se reintenta con otro monto **que nunca pasa del confirmado** (FASE 9 vuelta 1, §4 punto 6 de `25-verificado-G5`); **pasado el plazo del proveedor la operación no se ofrece, y se dice** (`DEC-RF-007`). **El cobro no lo ejecuta ningún reloj nuestro**: es el mandato del proveedor, creado en B3 (`DEC-MP-006`), con una interfaz que no impide migrar al cargo puntual. *(Diseño completo desde el 2026-09-24: el 13 se repartió. FASE 9 completa, salida 3.)* **Y desde la FASE 9 vuelta 2**: `RF2` guarda el id de cada devolución que el proveedor devuelve y `RF3` suma sólo las de la fila (`F-8V2B2-002`); **y el cobro de única vez sale con la clave del pedido del cliente, y `A3` lo reenvía con esa clave antes de abandonar** (FASE 9 vuelta 2, owner 2026-09-27, `R4`; el modelo de la instancia es de B10) | ~~`13` *(sin escribir)*~~ `06` §4.6 · `03` §6.1 `RF2`, `RF3`, `RF5` | — |
| **B7** | **La mora** | ⛔ | un cobro que no entra abre un reloj que se cierra, el que nunca pagó no recibe diez días gratis, y **el pago que entra en plena sucesión no reactiva, no se pierde y tiene quién lo resuelva** — **y al vencer el grace `S6` cancela el preapproval** (`DEC-SUB-019`), también por un `paused` leído (`DEC-MP-008`) o un contracargo (`DEC-SUB-020`); **la sucesora de quien venía pagando entra en grace si falla su primer cobro, y el barrido la relee cada día y corta ese grace si el proveedor ya se rindió** (owner 2026-09-25, 3c, `DEC-SUB-022`); **un aviso de primer rechazo perdido lo recoge el barrido y corre `S4`** (9a); y **un *«todavía no se sabe»* que dura 3 días abre la marca 21** (3d); **y la fila que pagó mientras `S6` o `S3` ya mandaban cancelar va a `CANCEL_SCHEDULED` por el espejo, no a `CANCELLED`** (owner 2026-09-27, FASE 9 vuelta 2, `R18`) **y sus complementos recurrentes los cancela, como `S7`, la regla de `S11`** (owner 2026-09-27, FASE 9 vuelta 2, `R18-b`; el modelo del complemento es de B10) | `03` §4, S4–S7, **S19**, **§10.1** *(la salvedad de `R18`)* · `12` §1, §4, §5 · `05` §3 · **`09` §3** *(la relectura de la sucesora de 3c, y la rama de 9a en la fila «cobros del período»)* **y §6.2** *(la marca 21)* — asignación de la FASE 9 completa, salida 3, con el precedente de B9 y B10, que ya toman las comprobaciones del `09` §3 que sirven a sus transiciones | **`G-R1-D`** |
| **B8** | **Los cambios del compromiso** | ⛔ | cambiar de plan, de ciclo, pausar y darse de baja, cada uno por su camino y sin pisarse — **incluido el CIERRE de la sucesión con sus cinco escrituras**, y **con la dirección del cambio saliendo de `direcciónDeCambio` (contrato §4.1) y nunca del `rank`** — y **desde `GRACE_PERIOD` no se declara una sucesión** (`DEC-SUB-021`); **la suspensión de la principal pausa sus complementos recurrentes por `S32` y `S33` los reanuda al volver**, igual que una pausa (owner 2026-09-26, `G2-2`; el modelo del complemento es de B10); y **la vuelta anticipada de una pausa sigue libre**, con su detector en el barrido de B11 (owner 2026-09-26, `G5-3`); **y la baja desde `ACTIVE` cancela en el acto el cobro de los complementos recurrentes que dependen de la principal —la selección de `S32`— y los sostiene hasta el fin de servicio** (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`; el modelo del complemento es de B10); **y el fin de servicio de una sucesora que vive del crédito es `max(fórmula, fin del crédito)`** (FASE 9 vuelta 2, owner 2026-09-27, `R17`) | `03` §5, S8–S12, **S17–S18**, **S22–S24**, **S31** · `12` §2, §3, §6, §7 · `02` §2.6 · `05` C2, C4 | **`G-R1-C`** **`G-R5`** |
| **B9** | **Las concesiones** | ⛔ | promos, cortesías y grants componen de forma determinista y se enchufan como fuentes. **`S20` no es de acá**: el grant cancela la principal (`S13`) y el complemento lo apaga **B10**, que llega después en el camino crítico y es donde vive el modelo del addon. **Y desde la FASE 9 completa**: un canje o un apilado que deja el monto **bajo el piso del proveedor se rechaza al canjear**, con el motivo en pantalla (owner 2026-09-25, 4b y 9g); **los dos cruces cortesía × pausa tienen fila**, `S34` (cortesía sobre cortesía) y `S35` (la persona pausa sobre una cortesía); y **cada fuente `GRANT` lleva su `piso` por la firma** (9h) — **y la escritura de los dos `permanent_grant` del corte** (`21` §2.4; paso 3b de `D/16` §4.2), anclados al vendible de `rank` más alto ~~de Alojamiento en la vertical en que tenían `comp`~~ ~~**de la vertical en que tenían `comp`** —el de Alojamiento, si la cortesía era de Alojamiento—~~ **de Alojamiento, en la vertical en que tenían `comp`** (FASE 9 vuelta 1, `F-8V1C2-004`; owner 2026-09-26, `G1-3`; ~~FASE 9 vuelta 2, `F-8V2B3-009`~~ revertido por el owner el 2026-09-27, FASE 9 vuelta 2, `R11-3b`: las dos `comp` son suyas y de Alojamiento); **y anclar una vertical nueva a un grant emite el aviso de cobertura, igual que otorgarlo y revocarlo** (contrato §3, *«quién emite»*; FASE 9 vuelta 2, `F-8V2C1-003`); **y el piso de todo ancla —al otorgar, al anclar y en el corte— es la versión que trae el acto, aceptada sólo si `políticaDePlan(v).vigente`**: billing no resuelve la vigente ni ordena por `rank` (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`); **y la cortesía diferida que `S9` re-emite sobre una sucesora con crédito arranca al agotarse el crédito** (FASE 9 vuelta 2, owner 2026-09-27, `R17`); **y el monto compuesto se redondea una sola vez, hacia abajo, con el mismo cálculo para quien muta y para quien compara** (`14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`); **y el contador de una promo baja sólo con un cobro que salió con el descuento** (`14` §2.4, `03` `P1`; owner 2026-09-27, FASE 9 vuelta 2, `R20`) | `14` entero · `21` §2.4 *(los grants del corte)* · `03` S9, S13, **S30**, **S34**, **S35** · `02` §2.4 · `05` C3 · **`09` §3** *(la comparación de monto)* (orquestador, FASE 8 completa, pendiente 8) | — |
| **B10** | **Addons** | ⛔ | los dos ejes, qué es una suscripción válida, el addon a costo cero —**el que se elige gratis y el que ya se venía pagando y `S20` convierte**— y el huérfano que sigue cobrando —**con su cobro apagado por `S21`**—. **Y desde la FASE 9 completa los addons siguen a su título** (owner 2026-09-25, `DEC-ADDON-007`): **sus complementos recurrentes se pausan y se reanudan con la principal** (`S32`, `S33`, 4a); *válida* es `ACTIVE` **y ~~cobrada~~ pagando** (`A1`; *«pagando»*, `NUCLEO/01` §2, no el campo `cobrada` de `B4` — FASE 9 vuelta 1, `F-8V1D1-002`); la orfandad de `LISTING` se lee **sobre el conjunto** de principales y el ancla viva (4c), y la de `USER`/`GLOBAL` sobre principales **vivas y ~~cobradas~~ pagando** de sus verticales compatibles (4d); **un `USER`/`GLOBAL` se emite como fuente sólo en esas verticales** (4e, contrato §2.7); y **el borrado de la ficha sale sólo por `A6`** (`K-9`); y **emite la fuente `ADDON` entera**, en sus cuatro alcances —`LISTING` con su `objetivo`, que es la única fuente que alimenta el pliegue por ficha del contrato §2.7— (FASE 9 vuelta 1, `F-8V1C1-014`); **`A1` valida el objetivo leyendo `ficha` y la versión leyendo `políticaDeAddon`** (contrato §4.1; owner 2026-09-26, `G4-2`); **y consume el empuje *«la ficha llegó a `PURGED`»* del contrato §3.1 y corre `A6` al recibirlo, idempotente frente a su red —la consulta `fichaPurgada` del §4.1, leída por el barrido diario (`09` §3)—** (`16` §4.2; owner 2026-09-26, `G2-1`; la unidad, con OK del owner, FASE 9 vuelta 1, K); **`S32` y `S33` corren también sobre la suspensión de la principal** (owner 2026-09-26, `G2-2`); y **el destaque de una ficha que no se ve, con la principal viva, se sigue cobrando** —lo dice y ofrece la baja el acto que lo causa, en B13— (owner 2026-09-26, `G2-3`); **y, desde la FASE 9 vuelta 2, owner 2026-09-27**: `S36` entra a la lista de disparadores de la orfandad (`16` §4.3, catorce) y `S21` crea `RF1` en vez de marca cuando el cobro del complemento cae dentro de sus 10 días (`R1-b`); y **el addon `UNA_VEZ` nace con el identificador del pedido del cliente, único, del que sale la clave de su orden** —el doble clic reusa la orden— y **`A3` reenvía la orden antes de abandonar** (`R4`); y **en la fecha de fin `S21` toma el complemento en `CANCEL_SCHEDULED` antes que su propio `S12`, de `S11` o de `S26`, y abre el motivo 14** (owner 2026-09-27, FASE 9 vuelta 2, `R1-c`) | `16` entero · `03` §8 **y `S20`, `S21`, `S32` y `S33` de §3.2** · `02` §2.4 · `09` §3 *(tercera y cuarta comprobación, y las salvedades 1 y 4)* · `19` §4 filas 13 y 13-bis | **`G-R2-C`** (owner 2026-09-25; FASE 9 completa, decisión 10c; `V/descomposicion.md` §2.10) |
| **B11** | **Conciliación** | ⛔ | lo que creemos coincide con lo que hay, y lo que diverge en silencio aparece — **y un preapproval desconocido se re-vincula sólo si su `external_reference` nombra una fila nuestra sin otro vínculo vivo; todo otro abre marca** (`09` §2.4, owner 2026-09-25, 2b) — **y la lápida del corte** (`21` §2.5): la escritura con `clase = LÁPIDA` y `origen_de_lápida = CORTE`, que corre la herramienta del corte sobre el manifiesto del 1b, y el criterio de que una fila principal sin usuario ni versión la rechaza la base (`02` §2.2; FASE 9 vuelta 1, R6); **el cobro en vuelo del corte que sale bien no se devuelve**: se asienta sobre la lápida sin marca y se declara (owner 2026-09-26, `G3-1`) **—sólo el del día del corte: uno posterior abre `PAGO_TARDÍO_RECHAZADO`, desde su evento y desde la comparación de cobros, y el detector posterior al corte lista las lápidas del corte con `payment` (`21` §2.5 y «NO cierra»; owner 2026-09-27, FASE 9 vuelta 2, `R2`)—**; **la herramienta del paso 4 saltea una lápida del corte del mismo id y aborta sin escribir ante cualquier otra fila con ese id** (`21` §2.5; FASE 9 vuelta 2, `F-8V2B3-003`); **la exención de una terminal espera a que cierre el registro de cobro de su último ciclo** (`09` §3; owner 2026-09-27, FASE 9 vuelta 2, `R2`, `F-8V2B3-006`); **el handler no manda cancelar un id del manifiesto de sondas** (`09` §2.4; FASE 9 vuelta 2, `F-8V2B3-004`); **el cobro de un preapproval desconocido que no nombra ninguna fila vive en una lápida de recepción**, con la forma de fila de R6 y el `payment` y la marca colgados (owner 2026-09-26, `G3-2`), **que el handler cancela al escribirla y el barrido reintenta** por la salvedad 4 (owner 2026-09-26, `X-1`, `DEC-CONC-002`); y **el resumen del barrido lista las pausas de menos de un ciclo que cruzaron una fecha de cobro salteada** (owner 2026-09-26, `G5-3`); **y, desde la FASE 9 vuelta 2, la comprobación de órdenes pagadas —la instancia `UNA_VEZ` en `ABANDONED` cuya orden tiene un pago aprobado abre el motivo 23, colgado de la instancia— (FASE 9 vuelta 2, owner 2026-09-27, `R4`), y la relectura de todo `refund` en `CONFIRMED`, que separa por id la devolución de nuestro flujo de la del panel** (`F-8V2B2-002`, `F-8V2B2-005`); **la comparación de monto no corre sobre una fila cuyo preapproval la relectura ve `cancelled`** (`09` §3; FASE 9 vuelta 2, `F-8V2B3-007`); **y el asiento de un cobro sobre una lápida es `P1` sin `covered_period`, sin promo y sin aviso de cobertura** (`03` §6; FASE 9 vuelta 2, `F-8V2B3-005`); **y la comparación de cobros compara también el IMPORTE de cada cobro aprobado contra el esperado de su período, y abre el motivo 24 si cobró de más** (`09` §3, `02` §2.5; owner 2026-09-27, FASE 9 vuelta 2, `R20`) | `09` entero · `21` §2.5 *(la lápida)* | — |
| **B12** | **El catálogo que se retira** | ⛔ | retirar un plan no mueve a nadie, y discontinuar una vertical deja de cobrar antes de dejar de prestar — **incluidas las TRES transiciones que ejecutan el acto**, `S26`, `S27` y `S28`, **y `S25`, que cierra la pausa que el acto no interrumpe** (`DEC-SUB-015`; no tenía unidad: FASE 9 completa, salida 3); y ~~**el barrido del día invalida el caché de la vertical entera** (`10` §4.3, owner 2026-09-25, 6b, `DEC-ARCH-011`)~~ **la pregunta `finDeServicio` del contrato §4.1, que contesta la fecha de fin de servicio calculada con la fórmula del `10` §4.3: billing sólo avisa, y lo que corre sobre las fichas ese día —`PB2`, el hecho 4 y la invalidación de la vertical entera— lo ejecuta el reconciliador de V6** (owner 2026-09-27, FASE 9 vuelta 2, `R5`; `F-8V2A3-001`, `F-8V2C1-001`); **y la fecha la guarda `vertical_discontinuation`, una fila por vertical discontinuada que escribe la mitad de billing del acto del día 0 —después de la de verticales, que escribe `admite_altas`— y reescribe sólo el acortamiento del `10` §4.4** (`02` §2.1; owner 2026-09-27, FASE 9 vuelta 2, `Q-FECHA` y `Q-ALTAS`); **si esa mitad falla, la acción la reintenta hasta que entra y le muestra al admin el acto a medias, sin deshacer nunca la de verticales** (owner 2026-09-27, FASE 9 vuelta 2, `Q-ALTAS-b`) | `10` entero · `03` §3.2, ~~**S26–S28**~~ **S25–S28** · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §4.1 *(`finDeServicio`)* | — |
| **B13** | **Superficies y la baja** | — | la pricing, Mi Suscripción, la baja self-service, y la lista de lo que hay que decir — **con lo que la FASE 9 completa le agregó** (owner 2026-09-25): los avisos del grace ~~**no prometen que el reintento use la tarjeta nueva** (3a)~~ (tachado 2026-09-26) **dicen que al cambiar la tarjeta se reintenta el cobro en el momento** (3a, levantada por `GR-1` `VERIFIED` el 2026-09-26); el aviso de suspensión dice que **al volver se pierde la promo** (3b); **el botón de suscribirse manda a publicar a quien todavía no publicó en esa vertical** (6c, `B/19` fila 21) **si publicar le arrancaría el trial —la regla de `V/19` §4 fila 23, que `B/19` cita—** (FASE 9 vuelta 1, `F-8V1D1-004`); **la pricing no ofrece planes de una vertical que no admite altas** (6a, fila 20); y Admin tiene **la acción administrativa 14** (5a, `B/19` §6); y **el acto que deja de mostrar una ficha con destaques recurrentes vivos —moderar, despublicar— dice que se siguen cobrando y ofrece la baja** (`V/19` §4 filas 24 y 25; owner 2026-09-26, `G2-3`) | `19` entero · `22` §1 | — |

**⛔ nueve · — tres · ✅ una.** Las tres del guion —B4, B5 y B13— no llaman a la pasarela, pero
**dependen de una que sí**, así que tampoco arrancan antes. La única sin ninguna atadura con la
pasarela, ni propia ni heredada, es **B2**: su gate es `V2`, de la otra épica.

**Las ~~treinta y cinco~~ treinta y seis transiciones de la Suscripción, cada una con su unidad** (`S36` → **B5**, FASE 9 vuelta 1, `G5-4`; recontado el
2026-09-25 sobre `B/03` §3.2, FASE 9 completa, salida 3 de `DEC-METH-004`): `S1`–`S3` y
`S14`–`S16` → **B3**, que toma el §3.1–§3.4 por sección · `S4`–`S7` y `S19` → **B7** · `S8`–`S12`,
`S17`–`S18`, `S22`–`S24` y `S31` → **B8** · `S13`, `S30`, **`S34`** y **`S35`** → **B9** (y `S9`,
que comparte con B8) · `S20`, `S21`, **`S32`** y **`S33`** → **B10** · **`S25`**–`S28` → **B12** ·
**`S29`** → **B5**. **Hasta esta pasada `S25` y `S29` no figuraban en ninguna fila** —`S25` sólo se
nombraba de paso en el §2.8, y `S29` llegó con el reparto del 13 el 2026-09-24—, y `S32`–`S35` no
existían. Las cuatro nuevas van con la unidad donde vive lo que tocan: `S32`/`S33` pausan filas de
complemento, cuyo modelo es de B10 (la misma razón que `S20`/`S21`); `S34`/`S35` parten de
`PAUSED · COURTESY`, que no existe antes de que B9 emita cortesías. **Es asignación propuesta en
esta pasada, no decisión del owner.**

### 2.1 Los dos guards que nacieron acá y ya están en el catálogo

Se numeraron en esta descomposición **porque el `20` §2 no los nombraba**, y ahí quedó escrito
*«si el `20` se reescribe, los absorbe»*. **Los absorbió**: desde la FASE 9-bis-4 las dos filas
están en `20` §2 (`DEC-TEST-001`, *«y el catálogo estaba incompleto»*), así que **ya no viven
fuera del catálogo que CI leería**. La tabla queda acá porque **es esta tabla la que les asigna
unidad** —`G12` a `B1`, ~~`G13` a `B4`~~— y el catálogo cataloga, no reparte trabajo. **`G13` ya no es
de esta épica**: lo construye `V4`, como dice el contrato §6.3, y su fila está en `V/20` §2 (owner
2026-09-26, `G5-5`; la asignación la escribe `V/descomposicion.md` §2.3):

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| **`G12`** | se importa el SDK de la pasarela **fuera del adaptador** | `DEC-ARCH-004`, condición A |
| ~~**`G13`**~~ | ~~la implementación **de arranque** de `cobertura()` llega a producción~~ | ~~contrato §6.3~~ → `V4` (`G5-5`) |

### 2.2 Por qué el adaptador y el proveedor falso son la misma unidad, y van primeros

Porque son las **dos condiciones de `DEC-ARCH-004`** y ninguna de las dos se puede agregar después.

`G12` es el caso de libro de la regla 1: si llega en B5, para entonces hay cuatro unidades que
importan el SDK y el guard nace con su lista de excepciones. Y el adaptador falso es la **condición
B**, que la decisión justifica sin rodeos: *«es lo que prueba que la abstracción no miente — si no
se puede escribir sin filtrar conceptos de Mercado Pago, la interfaz está mal definida»*.

**Y el falso tiene que mentir desde el primer día**, no cuando se acuerde alguien. Un falso escrito
más tarde se escribe contra código que ya asumió un proveedor que se porta bien, y ese código
—medido— no es el que tenemos.

### 2.3 Qué se puede hacer ya, y qué ~~espera~~ esperaba a la pasarela

> ✅ **Este § describe el estado anterior al 2026-09-24 y se deja como rastro** (FASE 9 completa,
> salida 3 de `DEC-METH-004`). Con `DEC-MP-005` y `DEC-MP-006` **las trece tienen diseño y ninguna
> espera a un tercero**: lo que ordena la construcción desde entonces son sólo las dependencias del
> §3. Lo que sigue vigente de este § es la tabla *«Política y forma»*, con la columna de la forma ya
> contestada por Mercado Pago.

Se venían diciendo como una sola cosa **dos que no lo son**, y conviene separarlas porque llevan a
decisiones opuestas:

| | cuántas | qué significa |
|---|---|---|
| ~~**sin diseño**~~ | ~~**1** — B6~~ **0** | ~~su capítulo no está escrito y **su política no está decidida**. No se puede ni especificar~~ el 13 se repartió y `DEC-MP-006` decidió su política (2026-09-24) |
| ~~**con diseño, esperando la pasarela**~~ | ~~**11**~~ **0** | ~~su política está escrita y no cambia. **Se pueden atomizar y especificar hoy**; no se pueden terminar~~ la pasarela es Mercado Pago (`DEC-MP-005`) |
| **se puede ~~hacer entera hoy~~ construir** | ~~**1** — B2~~ **13** | ~~no llama a la pasarela ni depende de ninguna que llame~~ en el orden del §3 |

~~**Doce de trece tienen el diseño escrito. Doce de trece no se pueden construir todavía.** Las dos
frases son ciertas a la vez, y confundirlas es lo que hace que alguien lea *«una sola bloqueada»*
como *«se puede arrancar»*.~~

#### Por qué el alcance es tan ancho

Porque `DEC-ARCH-004` trajo el ciclo de vida de nuestro lado, y eso **no reduce** la dependencia de
la pasarela: la concentra. **Cuál sea decide la forma de casi todo el sistema**, y cada línea de
abajo es una decisión ya tomada que se escribió sobre una medición de Mercado Pago:

| lo que la pasarela decide | hoy, con Mercado Pago | unidades |
|---|---|---|
| **quién tiene el reloj de cobro** | suyo — el mandato cobra solo | B6, B7 |
| **si la pausa es nativa** | sí, y el reloj que reanuda es nuestro porque no hay auto-reanudación | B8, B9 |
| **si un addon es una autorización aparte o una línea** | aparte: el array de ítems da `400` y se descarta en silencio | B10 |
| **si se puede mutar el ciclo de una suscripción viva** | no — hay que cancelar y recrear | B8 |
| **si el inventario se puede listar** | no: el buscador devuelve un subconjunto plausible, 15 de 69 | B11 |
| **qué miente el falso** | las **quince** filas del `20` §3.2, todas suyas | B1 |
| **el piso y la moneda** | ARS 15 a 2.000.000, y sólo ARS | B2, B9 |

`DEC-ARCH-004` ya lo dijo, y es la parte que no conviene leer como consuelo: **«las pasarelas no
son intercambiables»**, y para cada capacidad hay que declarar qué pasa cuando el proveedor no la
tiene. Eso no se puede declarar contra un proveedor que no está elegido.

#### Política y forma, unidad por unidad

Lo que **no** cambia con la respuesta —y por eso la especificación se puede escribir hoy:

| | política, que sobrevive a las dos respuestas | forma, que espera |
|---|---|---|
| **B3** | hay una ventana entre *«empezamos»* y *«hay compromiso»*, tiene duración máxima, se limpia y el candado es nuestro y va antes | qué vive adentro: un checkout para autorizar un mandato, o la captura de una tarjeta |
| **B7** | el reloj del grace arranca en el **primer rechazo** de una renovación, leído por id —~~cuando **se agotan** los reintentos~~, reemplazado en la FASE 8 completa (`R1`): ese instante no emite evento (`GR-3`)—, y eso se observa releyendo, nunca contando días | de quién son esos reintentos — y si son nuestros, **son terreno regulado** |
| **B8** | cambiar de ciclo re-autoriza; la pausa es en meses enteros y el reloj que reanuda es nuestro | si hace falta cancelar y recrear — `DEC-ARCH-004` impl. 3: *«si se puede mutar el ciclo de una suscripción viva, `DEC-SUB-006` deja de necesitar el cancelar-y-recrear»* |
| **B9** | el orden de aplicación, el piso, y ~~que un 100 % es una cortesía~~ **que un canje o un apilado bajo el piso se rechaza al canjear, con un motivo que dice que el mínimo lo pone Mercado Pago** (owner 2026-09-25, 4b y 9g) | ~~si la cortesía se implementa pausando o simplemente no cobrando el ciclo~~ **sin sujeto**: la cortesía se implementa pausando (`DEC-GRANT-003`), y una promo ya no se ejecuta como cortesía |
| **B10** | los dos ejes, qué es una suscripción válida, el huérfano | si el huérfano recurrente **existe** — con un cargo puntual no hay autorización suelta que siga cobrando |
| **B11** | el inventario es nuestro y lo que toca plata lo mira una persona | si hace falta leer de a una por id |
| **B12** | se deja de cobrar antes de dejar de prestar | cómo se corta el cobro el día 0 |

~~**B6 no entra en esa tabla porque no tiene la columna izquierda todavía**: dos relojes sobre la
misma autorización **son** el doble cobro que `DEC-ARCH-004` declara como riesgo nuestro, y eso no
se esconde detrás de una interfaz.~~ **B6 ya tiene su columna izquierda** (`DEC-MP-006`,
2026-09-24): **un solo reloj, el del proveedor**, y el reembolso siempre confirmado por una persona
y verificado releyendo (`DEC-RF-002`, `B/03` §6.1). Su forma es la de Mercado Pago: el mandato
cobra solo y el reembolso va por `POST /v1/payments/{id}/refunds` con clave obligatoria (`B/06`
§4.6).

#### Lo que sí conviene hacer mientras tanto

> ✅ **Sin objeto desde el 2026-09-24**: la lista era para mientras la pasarela no estuviera
> decidida. Queda como rastro.

~~1. **Atomizar las once que tienen diseño** (todas menos B6 y B2). Su política no cambia, así que el
   atomizado no se tira.~~
~~2. **Construir B2 entera** — `billing_option`, el dinero en entero y `G7`. Su único gate es `V2`.~~
~~3. **Escribir la interfaz del adaptador y `G12`.** `DEC-ARCH-004` define esa API **por lo que
   Hospeda necesita, no por lo que una pasarela ofrece**, así que se puede escribir sin saber cuál
   es. Lo que no se puede escribir es el adaptador real ni las mentiras del falso.~~

**Y lo que no conviene**: escribir el adaptador contra Mercado Pago «para ir avanzando». Es
exactamente el error que `DEC-ARCH-004` fue a corregir — la alternativa (3) que descartó, *«acoplarse
a la pasarela elegida y aceptar que cambiarla sea una reescritura»*, es la que **nos trajo hasta
acá**. *(Sigue valiendo con la pasarela decidida: desde `DEC-MP-005` el adaptador real **es** el de
Mercado Pago, pero se escribe detrás de la interfaz, con `G12`, y `DEC-MP-005` declara que la
elección se revisa si aparece otra habilitación.)*

### 2.4 Por qué registrar el dinero y ejecutarlo son dos unidades

Es lo que permite que el bloqueo alcance a una sola.

**Registrar** es qué pasó: la máquina de Pago, la deduplicación por el id del hecho, el orden por la
fecha del hecho, la restricción que impide dos pagos acreditados en un período, el comprobante. Un
pago es un hecho con id y fecha **lo haya ejecutado el proveedor o lo hayamos ejecutado nosotros**,
así que todo eso se escribe hoy.

**Ejecutar** es cómo se mueve: el cargo, el reembolso y cómo se constata un pago manual. ~~Eso es el
13, y arrastra `RF-3` en `UNKNOWN` — el §61 prohíbe implementar sobre una fila abierta.~~ Desde el
2026-09-24 **el 13 se repartió** y lo que queda de ejecutar es poco: **el cargo lo hace el mandato
del proveedor** (`DEC-MP-006`), **cómo se constata un pago manual** es `MP1` y `S29` —registro, o
sea B5—, y **el reembolso** es `RF2`, `RF3` y `RF5` sobre `B/06` §4.6. **`RF-3` sigue `UNKNOWN` y
ya no bloquea** (`DEC-RF-007`): pasado el plazo, la operación no se ofrece y la reparación manual
se asienta por `RF4`, que es de B5.

Sin esta división, **B7 heredaría la falta de diseño** y serían cuatro los capítulos que hay que
escribir en vez de uno. Ojo con lo que esto **no** compra: B5 y B7 siguen esperando a la pasarela
como el resto (§2.3). Lo que la división separa es **poder especificar** de **poder construir**.
*(La razón del bloqueo desapareció el 2026-09-24; la división sigue siendo buena por otra: el
registro corre antes que la mora y la ejecución, que dependen de él.)*

### 2.5 Por qué el contrato de cobertura no va al final

Porque es lo que la otra épica está esperando, y porque la defensa §6.2 del contrato —*«un solo
juego de casos corre contra las dos implementaciones»*— sólo vale si la segunda llega **mientras el
juego todavía corre contra la primera**. Un contrato que se implementa al final convierte
*«billing reemplaza la implementación de arranque»* en un día de sorpresas, que es exactamente lo
que esa defensa existe para evitar.

Le alcanza con B3: **una suscripción viva ya es una fuente**. ~~Las otras dos —cortesía y grant— se
enchufan en B9~~ **Las otras tres se enchufan después —cortesía y grant en B9, y el addon en B10, con
su `alcance` —los cuatro—, su `objetivo` y su `hasta`—** (FASE 9 vuelta 1, `F-8V1C1-014`: son
cuatro fuentes de billing y no tres desde que el addon es fuente del contrato, §5.2) **sin tocar**
lo que B4 dejó, y ésa es su prueba.

~~**Y acá nace `G13`**, no antes: mientras la de arranque es la única implementación, un guard que
prohíba su llegada a producción falla desde el primer día. Es la misma razón por la que `G1` y `G3`
van primeros en la otra épica, leída al revés.~~ (tachado 2026-09-26) **`G13` no nace acá: nace en
`V4`**, como dice el contrato §6.3. El argumento de arriba lo contesta el propio §6.3: el guard
falla sobre un build destinado a producción, no sobre la rama, así que no falla desde el primer día
(owner 2026-09-26, `G5-5`).

### 2.6 Las dependencias con la otra épica: son ~~SEIS~~ ~~OCHO~~ ~~ONCE~~ DOCE, sobre ~~dos~~ cuatro unidades, ~~y todas tempranas~~ y las de V6 y V9 no son tempranas

**B2 no puede existir sin `plan_version`**, que es `V2` de verticales: `billing_option` cuelga de
ella con `UNIQUE(plan_version_id, ciclo)`. Es el corte de `DEC-ARCH-005` visto desde abajo — el
precio vive en **una sola tabla hoja** y todo lo que está encima es configuración de capacidades.

**No contradice la autonomía.** `V2` es la **segunda** unidad de la otra épica, y lo que B2 necesita
es esa unidad mergeada en la rama del paraguas, no la épica terminada. La segunda dependencia es la
de B4 sobre `V4`, que trae el contrato con su implementación de arranque.

**Este § decía *«esas dos, y ninguna más»* y eran seis.** La frase se escribió el **2026-09-18**;
la **dirección inversa del contrato** —lo que billing **LEE** de verticales— se declaró en
`12-contrato…` §4.1 el **2026-09-19**, *al día siguiente*, con **siete campos en tres preguntas**
*(así era ese día; hoy el §4.1 se cita sin cifra, FASE 9 vuelta 1)*,
y en cuatro días nadie cruzó los dos documentos. Las **cuatro** dependencias que ese § agrega son
todas contra `V2`, que es la unidad que las construye (`V/descomposicion.md` §2.9), y cada una está
medida contra el lector que la pide:

| # | quién lee | qué campo de la dirección inversa | contra |
|---|---|---|---|
| 1 | **B2** — `billing_option` cuelga de `plan_version` | *(no es la dirección inversa: es la tabla misma)* | **V2** |
| 2 | **B4** — el contrato con su implementación de arranque | *(la dirección de ida)* | **V4** |
| 3 | **B7** — el reloj del grace | `díasDeGrace`: *«el §20 fija el grace en 10 días y `DEC-SUB-002` lo dejó configurable **por versión de plan**»* (`12` §1) | **V2** |
| 4 | **B8** — la pausa | `permitePausa`: es el tercer término de `puedePausar()` (`NUCLEO/01` §3), que `S8` exige | **V2** |
| 5 | **B8** — el cambio de plan | `direcciónDeCambio`: es lo que decide si el monto se muta ya o si las capacidades caen al fin del ciclo. Sin él lo único a mano es el `rank`, que el diseño ya rechazó por escrito | **V2** |
| 6 | **B12** — el retiro y la discontinuación | `admiteAltas` ~~y `finDeServicio`~~ (`B/10` §4.6, que ya ~~las lee~~ la lee), y `vigente`/`vendible` — **`finDeServicio` dejó de ser una lectura de billing: la calcula `B12` y la contesta** (fila 13; FASE 9 vuelta 2, `R5`) | **V2** |
| 7 ✚ | **B3** — el alta y la sucesión (`S1`) | `admiteAltas`: desde la FASE 9 completa `S1` rechaza el alta nueva y la sucesión en una vertical que no admite altas (owner 2026-09-25, 6a, `DEC-ARCH-011`; contrato §4.1). **Y `vigente`/`vendible`**: desde la FASE 9 vuelta 1 `S1` rechaza también una versión retirada (`N-G4V-07`; `B/03` §3.2) | **V2** |
| ~~8~~ | ~~**B4** — la implementación real del contrato~~ | ~~`finDeServicio`: desde la FASE 8 completa deja de emitir en una vertical discontinuada (contrato §2.6 y §4.1, `F-8CC1-001`, `R11`)~~ **Tachada** (FASE 9 vuelta 2, `R5`): la fecha la calcula billing, así que `B4` la lee de `B12` y ya no cruza la frontera | ~~**V2**~~ |
| 9 ✚ | **B10** — `A1`, la venta de un addon | `ficha` (vertical, dueño **y `admiteDestaque`** del objetivo; FASE 9 vuelta 1, `N-G4V-06`) y `políticaDeAddon` (`addon`, vigencia, **`díasDeVigencia`**, tipo de scope de la versión; la firma del contrato §4.1 lo trae, `24-verificado-G4` §4 punto 5): contrato §4.1 (owner 2026-09-26, `G4-2`; FASE 9 vuelta 1, `F-8V1A3-008`, `F-8V1C1-008`) | **V6** y **V2** |
| 10 ✚ | **B9** — el canje de una extensión de trial | `extenderTrial`, **la única escritura** de la dirección inversa: billing asienta el canje sólo con `ACEPTADA` (owner 2026-09-26, `G4-2`; `F-8V1C1-009`) | **V4** |
| 11 ✚ | **B10** — `A6`, el addon `LISTING` cuya ficha llegó a `PURGED` | `fichaPurgada`, y el hecho empujado del contrato §3.1 (owner 2026-09-26, `G2-1`). ~~**Qué unidad de billing consume el empuje no está asignado** (FASE 9 vuelta 1; queda para el owner)~~ **El empuje lo consume `B10`, dueña de `A6`** (con OK del owner, 2026-09-26, FASE 9 vuelta 1, K) | **V6** (y **V9** para el empuje de `PB9`) |
| 12 ✚ | **B9** — el piso de un grant, al otorgar, al anclar y en el corte | `políticaDePlan(v).vigente`: billing acepta la versión que trae el acto sólo si es la vigente, porque no tiene cómo resolverla sin leer `plan_version` (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`). Es un consumidor más de un campo ya declarado | **V2** |
| 13 ✚ | **B12** — la respuesta real de `finDeServicio` | la pregunta es de la dirección de ida: la hace verticales y la contesta billing, y su respuesta de arranque, `NINGUNA`, la construye V4 con el resto de la implementación de arranque. `B12` enchufa la real sobre esa interfaz, como `B4` con `cobertura()` (fila 2) (contrato §4.1; owner 2026-09-27, FASE 9 vuelta 2, `R5`) | **V4** |

> **~~Las dos últimas~~ Las filas 7 y 8 se agregaron en la FASE 9 completa (salida 3 de `DEC-METH-004`) y no son campos
> nuevos**: el contrato §4.1 ya las declara como *«un consumidor más de un campo ya declarado»*, y
> esta tabla no las recogía. Recontado cruzando cada lector que el §4.1 nombra con la columna de
> capítulos del §2; ~~los siete campos siguen siendo siete~~ **los campos del §4.1 no cambiaron
> con ellas** *(la cifra se sacó en la FASE 9 vuelta 1, `F-8V1A3-014`)*. **No mueven el grafo**, por la misma razón
> que el párrafo de abajo da para las cuatro de antes: `V2` llega antes que B3 y que B4.

**Las filas 9 a 11 son de la FASE 9 vuelta 1, y son entradas nuevas del §4.1, no campos de las
que había** (`G2-1`, `G4-2`). La 9 y la 11 agregan una dependencia contra `V6`, que en el orden de
la otra épica llega después de `V5`: **no se midió si llega antes que `B10`**, y hasta que se mida
es una dependencia más del camino de billing, no una flecha nueva del §3. La 10 es contra `V4`,
que ya era gate de `B4`.

**La 8 se tachó y la 12 y la 13 son de la FASE 9 vuelta 2** (`R5`, `F-8V2C1-004`). Recontadas con
script sobre la tabla: once menos la 8 más dos, **doce**, sobre las mismas cuatro unidades. La 12
es un consumidor más de un campo ya declarado, contra `V2`. La 13 es la primera fila de la tabla en
que **billing contesta** en vez de leer: `finDeServicio` la pregunta verticales. Su flecha es
contra `V4` por la interfaz y la respuesta de arranque, igual que la 2. **La flecha inversa —V6 lee
la fecha que contesta `B12`— no es una dependencia de construcción**: verticales se construye
contra la respuesta de arranque, `NINGUNA`, como con `cobertura()` (`DEC-ARCH-006`). Ninguna de las
tres mueve el grafo del §3: `V2` y `V4` llegan antes que B9 y que B12.

**Y el conteo se recontó entero, no se le sumaron cuatro a dos.** Se recorrieron los ~~**siete**~~
campos del §4.1 uno por uno buscando su lector, y los que no aparecen en esta tabla es porque **hoy
ningún capítulo de esta épica los lee**: `díasDeTrial` lo consume la máquina de trial, que es de
`V4` y del otro lado de la frontera. **Y por eso salió de la firma** (FASE 9 vuelta 1,
`F-8V1C1-015`): se recorrieron otra vez las entradas del §4.1 el 2026-09-26 y cada campo que queda
tiene un lector en esta tabla.

> **La regla de vigilancia sigue en pie y ahora cuenta contra algo vivo.** *«Si aparece una
> séptima»* sería volver a congelar una cifra, que es exactamente el defecto que este § tenía. La
> forma correcta es la del contrato §4.2: **si billing necesita leer de verticales algo que ~~no está
> entre los siete campos del §4.1~~ no contesta ninguna de las preguntas del §4.1, el corte se está
> filtrando** — se mira, no se resuelve en el lugar. ~~El número que hay que vigilar es el de los
> campos, que vive en el § que los declara;~~ **Lo que hay que vigilar son las preguntas, que viven
> en el § que las declara, sin cifra** (FASE 9 vuelta 1, `F-8V1A3-014`); el de las dependencias es
> su consecuencia y se recuenta desde ahí.

**Y no mueve el grafo del §3.** Las cuatro nuevas son contra `V2`, que **ya era gate de B2** —la
unidad que arranca primero de esta épica— y es la **segunda** de nueve en la otra: las cuatro
llegan resueltas mucho antes que B7, B8 y B12, que están detrás de la pasarela. Lo que cambia no es
el orden: es que dejan de ser invisibles.

### 2.7 Dónde caen las ~~ocho~~ ~~seis~~ ~~cuatro~~ ~~cinco~~ diez filas `UNKNOWN`

~~Las 89 filas de la matriz, recontadas con `contar-filas-de-la-matriz.py`: **49 `VERIFIED`, 19
`NOT_SUPPORTED`, 13 `PARTIALLY_SUPPORTED`, 8 `UNKNOWN`.**~~ **Las ~~98~~ ~~99~~ 104 filas de la matriz,
recontadas el 2026-09-25 con `contar-filas-de-la-matriz.py`: ~~55~~ 56 `VERIFIED`, 23 `NOT_SUPPORTED`,
~~14~~ 15 `PARTIALLY_SUPPORTED`, ~~6~~ ~~5~~ ~~4~~ ~~5~~ 10 `UNKNOWN`**, con `RN-3` cerrada la noche del 25/09,
`GR-1` el 26/09, **`EX-42` abierta el 26/09** (owner, `Y-1`) y **`EX-43` a `EX-47` abiertas el 27/09** (FASE 9 vuelta 2, con OK del owner; recontado ese día) (FASE 9 completa, salida 3 de `DEC-METH-004`). La tabla vieja
queda tachada fila por fila: de sus ocho, **cuatro cerraron** y **dos entraron**.

| filas | unidad | qué bloquea de verdad |
|---|---|---|
| ~~`RN-2` `RN-3` `GR-1` `GR-2` `GR-3`~~ | ~~**B7**~~ | ~~son **el mismo hecho, un cobro que falla**, e imposibles de fabricar con Mercado Pago. Y gobiernan el grace **sólo mientras el reloj sea del proveedor**: con el reloj nuestro pasan a ser una nota del adaptador~~ |
| `RN-3` ~~`GR-1`~~ `GR-2` | **B7** | **`RN-2` y `GR-3` cerraron el 2026-09-22** en producción: el cobro fallido **sí** se fabricó, y `GR-3` midió que la ventana de reintentos dura un ciclo. Las ~~tres~~ que quedan **siguen gobernando el grace, porque el reloj es del proveedor** (`DEC-MP-006`); ~~**`GR-1` condiciona `DEC-SUB-021`**, y hasta medirla con el próximo rechazo mensual real la salida *«cambiá la tarjeta»* no se promete (owner 2026-09-25, 3a)~~ (tachado 2026-09-26) **`GR-1` quedó `VERIFIED` el 2026-09-26**: la salida *«cambiá la tarjeta»* está medida y la pantalla puede decir que al cambiarla se reintenta el cobro |
| ✚ `PA-6` | **B7** | si el proveedor cancela el preapproval ante cualquier primer rechazo. **No bloquea**: `DEC-SUB-022` no depende de su respuesta, que sólo decide **cuánto dura** el grace de la sucesora de quien venía pagando, y el barrido lo acota a un día (owner 2026-09-25, 3c) |
| ✚ `RC-8` | **B5** y **B7** | qué lee el pago en un contracargo (`P6`, `P7`; `S6` por su tercer evento). **Fuente documental**: `DEC-SUB-020` fija qué hacemos al leerlo, y la detección se apoya en la fila con su salvedad declarada |
| ~~`WH-5`~~ | ~~**B1**~~ | ~~nada crítico — se fuerza con el interruptor del receptor~~ **`VERIFIED` desde el 2026-09-23** |
| ✚ `EX-42` | **ninguna** — la herramienta del corte (`16-fase-7-del-paraguas.md` §4.2, paso 1a) | si el `expire` de qzpay vence una `Preference` de Checkout Pro. **No bloquea ninguna unidad de esta épica**: condiciona el vencimiento de las del cambio de plan del viejo en el 1a, y se mide en el paso 0 del corte (owner 2026-09-26, `Y-1`) |
| `RF-3` | **B6** | el caso viejo del reembolso. ~~Ya está en la unidad bloqueada~~ **Ya no bloquea** (`DEC-RF-007`): pasado el plazo del proveedor la operación no se ofrece, y la reparación manual se asienta por `RF4` (`DEC-RF-008`) |
| ~~`EX-1`~~ | ~~**B3**~~ | ~~nada: la ventana de autorización es nuestra justamente porque esta fila está abierta —y por eso `DEC-SUB-016` la pudo partir en **dos** plazos sin esperar respuesta del proveedor—, y cancelar al vencer **falla hacia el lado seguro sin saber la respuesta**~~ **`PARTIALLY_SUPPORTED` desde el 2026-09-23**; lo que la fila decía sobre la ventana sigue valiendo |

~~**Ninguna de las ocho bloquea una unidad que no estuviera ya bloqueada.** El §61 prohíbe empezar
una capability crítica con su fila abierta, y la única que lo está es B6.~~ **B6 dejó de estar
bloqueada por `RF-3`** (`DEC-RF-007`), y `PA-6` y `RC-8` están declaradas con su salvedad en las
decisiones que las usan. **Las tres del grace son el punto abierto**: `DEC-MP-006` las declaró
*«bloqueantes»* de diseño con el reloj del proveedor, y desde entonces el diseño del grace se
escribió sobre ellas (`DEC-SUB-019`, `-021`, `-022`); ~~hoy lo que condicionan a la vista es **qué se
le promete al cliente** (`GR-1`, 3a).~~ (tachado 2026-09-26): `GR-1` cerró `VERIFIED` y lo que se le promete
al cliente ya está medido; del grace queda `UNKNOWN` sólo `GR-2`, y `RN-3` quedó
`PARTIALLY_SUPPORTED`.) **Si el §61 exige tenerlas cerradas antes de declarar
terminada B7 no está escrito en ninguna decisión**, y no se decide acá.

### 2.8 Los seis guards de esta épica que no tenían unidad, más el que llega de la otra

La columna de arriba dejaba **seis** guards de `B/20` §2 sin ninguna unidad que los construya —**los
seis de `R1`**— y `C2` lo venía reportando **tres vueltas seguidas** (`F-8dC2-003` →
`F-8eC2-004`). La **quinta enmienda de `DEC-TEST-001`** decide repartirlos ahora, con tres
condiciones: **la razón va medida y con cita**, **la unidad nace ANTES o CON lo que el guard
vigila, nunca después**, y **lo que no tiene unidad clara se declara sin dueño**. Los seis tienen
unidad medida; lo que el §2.9 trataba aparte eran **dos** secciones sin capítulo, no asignaciones
faltantes, y **las dos quedaron resueltas ahí**.

| guard | unidad | qué construye esa unidad que hace que el guard pueda existir ahí |
|---|---|---|
| **`G-R1-A`** | **B3** | **el acto que escribe `sucede_a`** —la rama de sucesión de `S1`— y los dos candados del `02` §2.2 |
| **`G-R1-B`** | **B3** | **la ventana de autorización** y la columna con la fecha con que nace la fila |
| **`G-R1-E`** | **B3** | **la columna `sucede_a`** y la doctrina de que *«viva»* es parte del predicado |
| **`G-R1-F`** | **B3** | **la entidad `reconciliation_mark`** con su motivo, y `S14`/`S15` |
| **`G-R1-D`** | **B7** | **`S19`**, el pago pendiente — sin él el guard no tiene dominio |
| **`G-R1-C`** | **B8** | **`S18`** con sus cinco escrituras, y el inventario del `02` §2.6 contra el que se verifica |
| **`G-R5`** | **B8** | **el tope de la pausa** (`03` §5), que es el número que puede romperlo |

**Cuatro de los seis caen en B3, y no por comodidad: caen en `02` §2.2.** Ese § es la tabla que
crea `sucede_a`, `sucedida_por`, la fecha de primer cobro con la que nace la fila y la entidad
`reconciliation_mark`, y **es capítulo de B3**. Los cuatro guards que anclan ahí anclan en columnas,
no en caminos, y las columnas nacen todas en el mismo acto.

**`G-R1-A` va con B3 porque vigila un acto, y el acto es `S1`.** Su fila lo dice sin ambigüedad:
*«vigila el ACTO de declarar, no una propiedad permanente de la fila»* (`B/20` §2), y el acto es la
segunda rama de la condición de `S1` —*«no hay otro origen vivo para ese `user + vertical`, **o la
fila declara una sucesión** (`sucede_a`)»*— que vive en `03` §3.2, adentro del `03` §3.1–§3.4 de
B3. B3 es la **tercera** unidad del §3, así que las ~~**ocho**~~ ~~**diez**~~ **nueve** transiciones que después sacan a una
predecesora del conjunto de ~~tres~~ declaración —`S8` y `S9`, ~~`S6`,~~ **`S4`**, `S12`, `S13`, `S16`, el espejo del §10.1,
~~`S24`~~ y, desde la FASE 8 completa (`F-8CB1-002`), `S23` y `S27`; recontadas con `DEC-SUB-021`
(owner 2026-09-25), que sacó a `GRACE_PERIOD` del conjunto: `S6` y `S24` salen de la cuenta y
`S4` entra (`03` §3.2)— llegan repartidas en unidades
posteriores —B7, B8, B9 y, para `S27`, B12—, todas **después**. **`S22`, `S23` y `S24` van con B8**: son la baja que pide la persona estando pausada, suspendida o en el grace, y B8 es la unidad de *«darse de baja»*. La tabla de unidades no las nombraba; se agregaron a la columna de B8 en la FASE 8 completa. ~~⚠️~~ **`S31`** —la sucesora que se corta cuando un contracargo corta a su predecesora (`03` §3.2; FASE 8 completa, pendiente 8, owner 2026-09-25)— ~~**todavía no tiene unidad**: su disparador es `S6` (B7) o `S12` (B8) y cierra un saldo de cortesía diferida (B9); a cuál va no está decidido.~~ **va con B8** (FASE 8 completa, owner 2026-09-25): su disparador es `S6` (B7) o `S12` (B8) y cierra un saldo de cortesía diferida (B9), y el owner la asignó a B8. Se agregó a la columna de B8.

**`G-R1-B` va con B3 porque depende de una columna de B3 y compara contra la ventana de B3.** El
catálogo lo dice: es *«`D8` hecho verificable en vez de recordable, y por eso **depende de la
columna** que guarda la fecha con la que nació la fila (`02` §2.2)»*. Y lo que compara esa fecha
contra el **vencimiento de la ventana de autorización** — que es literalmente el nombre de la
unidad: B3 es *«El alta y su ventana»*. La escritura que vigila es el efecto de `S1` (*«si declara
sucesión, nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización»*),
también de B3. No hay ningún momento anterior en que el guard pueda existir, ni ninguno posterior
en que no llegue tarde.

**`G-R1-E` va con B3 porque está anclado en la columna, no en la palabra.** Su fila lo declara:
*«este guard se ancla en la **columna**, no en la palabra: todo predicado que mencione `sucede_a`
tiene que decir además en qué estado está quien lo escribió»*. `sucede_a` y `sucedida_por` nacen en
`02` §2.2 —B3—, y ahí mismo nace la doctrina que hace cumplir: *«el adjetivo «viva» es parte del
predicado y no un adorno»*. **Todos los predicados que cuenta llegan después**: `S19` con **B7**,
`S17` con **B8**, `S20`, `S21` y `A5` con **B10**, y los dos inventarios que su segunda mitad
sumó —*«grant vivo»* y *«ancla viva»*— con **B9** y **B10**. Naciendo en B3 los ve llegar uno por
uno, y cada uno tiene que traer su fila al inventario para pasar; naciendo con el último nace con
lista de excepciones. **Con una salvedad que hay que decir**: el caso que hoy lo hace fallar a
propósito —*«sacándole «viva» a la condición de `S19`»*— es de B7, así que **B3 tiene que traer el
suyo**, sobre los predicados que sí existen en su momento: los **dos índices parciales** del `02`
§2.2, que leen `estado ∈ {vivos}`, y la condición de `S1`.

**`G-R1-F` va con B3 porque la marca y sus dos actos son de B3, y eso ya está medido.** La entidad
`reconciliation_mark` está en `02` §2.2 —B3— con su *«**motivo** (enumeración cerrada, §2.5)»*, y
los dos actos que la abren y la levantan son `S14` y `S15`, que también son de B3: **la FASE
8-bis-4 lo midió y lo declaró suficiente** — *«la mitad *«`S14`–`S16` no caen en ningún rango
numérico»* sigue, y **no la reporto**: `B3` las toma por sección (`03` §3.1–§3.4) y eso alcanza»*
(`20-fase-8-bis-4/C2…`, veredicto de `F-8dC2-004`). Todo lo demás que el guard cuenta llega
después: los ~~**siete**~~ ~~**diez**~~ ~~**once**~~ ~~**doce**~~ **trece** motivos que `S14` trae de los casos que lo disparan —los tres
nuevos, el 17, el 18 y el 19, llegan con ~~`P1`,~~ `P6` (`03` §6, **B5**), `S6` (**B7**) y el `09` §3
(**B11**); FASE 8 completa, `F-8CB3-009`, `F-8CB3-003`, `DEC-SUB-020`; **y el 20, `COBRO_DUPLICADO`,
con `P1` (**B5**)**, partido del 19 en la pendiente 6, owner 2026-09-25; **y el 22,
`PAUSA_NO_APLICADA`, con la rama de fallo de `S8` (**B8**) y de `S9` (**B8**/**B9**)**, FASE 9
completa, `F-8CB2-003`; **y el 24, `IMPORTE_COBRADO_DE_MÁS`, con la comparación de cobros del `09` §3
(**B11**)**, FASE 9 vuelta 2, owner 2026-09-27, `R20`—, el **listado
accionable** del `19` §6 (**B13**, la anteúltima del camino crítico) y los inventarios de *«marca
abierta»* y *«cortesía diferida»* (**B9**). **Y la tabla que el guard lee es capítulo de B3, desde
esta pasada.** El `02` §2.5 —los ~~quince~~ ~~dieciséis~~ ~~diecinueve~~ ~~veinte~~ ~~**veintidós**~~ ~~**veintitrés**~~ **veinticuatro** motivos— **no figuraba en la columna de capítulos de
ninguna unidad** y era la primera de las dos preguntas del §2.9: `G-R1-F` compara contra esa
enumeración para decidir si un motivo existe, así que quien construyera el guard se encontraba con
una tabla que nadie había sembrado. **La fila faltaba en el reparto, no la respuesta**: el propio
§2.9 ya decía que *«la asignación a B3 no depende de la respuesta —la entidad y sus dos actos son
de B3 igual—, pero la tabla sí necesita dueño»*, y el dueño es el mismo que el de la entidad. El
§2.5 es **el catálogo de una columna que nace en el `02` §2.2**, y las dos únicas cosas que hay que
saber para sembrarlo —qué motivos hay y quién abre cada uno— salen de `S14` y `S15`, que son de
B3. **Con la parte que B3 no puede terminar sola, dicha**: ~~ocho de los quince~~ ~~**nueve de los dieciséis**~~ ~~**nueve de los diecinueve**~~ ~~**nueve
de los veinte**~~ ~~**diez de los veintidós**~~ ~~**once de los veintitrés**~~ **once de los veinticuatro** motivos los abren actos de otras unidades —**el 23, `ORDEN_PAGADA_SIN_INSTANCIA`, lo abre la comprobación de órdenes pagadas del `09` §3, que va con B11** (FASE 9 vuelta 2, `R4`); **el 21, `COBRO_DEL_PERÍODO_SIN_RESOLVER`, lo abre la lectura del `09` §4 que sigue en *«todavía no se sabe»* a los 3 días (`09` §6.2), que va con B7** (FASE 9 completa, 3d; asignación de esta pasada, §2)—, `S18` (B8), `S21` (B10), **que desde
`DEC-RF-006` abre dos**, ~~las seis comprobaciones del `09` §3 (B12)~~ **las comprobaciones de cero
llamadas del `09` §3 —la tercera y la cuarta en B10, las otras en B11, que tiene el `09` entero—**
y **el reintento del barrido sobre las salvedades 1 y 4 del `09` §3, que abre el 16** (FASE 8 completa, `F-8CB1-013`, owner
2026-09-25; esas dos salvedades están en la columna de B10). *(Corregido en la FASE 8 completa
contra la tabla de unidades: B12 es el catálogo que se retira y no tiene el `09` en su columna.)*—, así
que B3 siembra la tabla completa y **cada una de esas unidades trae su propia fila viva cuando
llega**, que es la misma forma con que `G-R1-E` recibe sus predicados.

**`G-R1-D` va con B7 porque antes de B7 no tiene dominio, y eso está escrito.** El guard vigila
**cuatro caminos que reactivan** —`S5`, `S7`, el efecto de `MP1` y el de `MP4`— más el reembolso
anticipado del pago que `S19` dejó pendiente. `S4`–`S7` y `S19` son de **B7** por nombre, igual que
`12` §5.3 y `05` §3, que son las otras dos fuentes de su fila. Los otros dos caminos, `MP1` y
`MP4`, viven en `03` §7 y son de **B5**, que corre antes — **y eso no lo manda a B5**, por la razón
que el propio catálogo ya tiene escrita: *«el tercer lugar sólo es real porque `S19` admite las dos
puertas del pago … Un guard cuyo dominio la tabla no puede satisfacer no está en rojo: **está
mirando a otro lado**»* (`B/20` §2). Antes de B7 no existe ni el pago pendiente ni la condición 3
del `05` §3 que decide entre reactivar y retener, así que los dos caminos de B5 **todavía no pueden
producir el daño**. B7 es la unidad más temprana en la que el guard puede fallar, que es el criterio
de la regla 1 leído entero.

**`G-R1-C` va con B8 porque el cierre es de B8, y también el inventario contra el que se verifica.**
Es *«el guard del CIERRE»*, y el cierre es `S18` con sus **cinco** escrituras: `S18` es de B8 por
nombre (*«`03` §5, S8–S12, **S17–S18**»*), y el inventario contra el que el guard comprueba
—*«el inventario contra el que se verifica es `B/02` §2.6»* (`B/20` §2)— **también es capítulo de
B8**. El criterio de terminación de B8 (§4) ya describe cuatro de las cinco escrituras, así que el
guard y su sujeto se escriben en el mismo acto. Y el **sexto camino** que ganó con `DEC-GRANT-010`
—`S25` difiriendo la cortesía con su `saldo_meses`— llega **después**: el `saldo_meses` cuelga del
`courtesy_grant` (`02` §2.4) y la re-emisión es `S9`, los dos de **B9**, la unidad siguiente del
camino crítico. Naciendo en B8 el guard **ve llegar** ese sexto camino en vez de heredarlo, que es
exactamente lo que su fila pide: *«un guard escrito sobre un camino no mira el segundo»*.

**`G-R5` llega de la otra épica, y llega acá porque el número que puede romperlo es de acá.**
`F-8eC2-004` midió que su única asignación —la celda de `V9` que decía *«el de `D16`»*— estaba en
la épica equivocada, y se confirma: el guard compara **el tope de una pausa**, que declara `03` §5
de esta épica (*«**4 pausas-mes** por pausa»*, y el mismo § dice *«Esa desigualdad es el invariante
`D16` y la vigila **`G-R5`, sobre el número que declara la fila de arriba**»*), contra **el día del
hard delete** del `V/02` §4.1. `V9` construye el segundo número, no el primero — y su fila del §3
la pone *«una vez que estén V4 y V6»*, o sea **antes de que el tope exista**, con lo cual el guard
nacía sin nada contra qué fallar. `03` §5 es capítulo de **B8**, así que B8 es la unidad más
temprana en la que las **dos** cifras existen y el guard puede dar rojo. La advertencia ya estaba
escrita en `B/20` §2 —*«si alguien sube el tope de pausa y el guard sólo vive en el catálogo de la
otra, el cambio se hace sin verlo»*— y esto la aplica al reparto del trabajo. Del lado de
verticales, el retiro de la celda está explicado en
[`V/descomposicion.md`](../HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md) §2.7.

### 2.9 Las dos secciones que ninguna unidad declaraba entre sus capítulos — las dos RESUELTAS

**Ninguna de las dos era un guard sin dueño**: eran secciones que **ninguna unidad declaraba entre
sus capítulos** y que los guards repartidos **leen**. Se anotaron como preguntas para el owner y
**no lo eran**: en las dos faltaba una fila en una tabla de reparto, no había dos políticas entre
las que elegir, y **la unidad se deduce del mismo criterio en los dos casos** — la que construye el
guard que lee la lista y el término que la lista enumera. Quedan resueltas acá, y se deja escrito
lo que las abrió para que nadie lo lea como una asignación inventada.

1. ~~**`02` §2.5 —la tabla de los motivos de la marca— no es capítulo de ninguna unidad.**~~
   **RESUELTA**: la tabla es capítulo de **B3**, y la fila del §2 lo dice (`02` §2.2 **y §2.5**).
   Lo medido que la abrió sigue siendo cierto —`02` §2.1 es de B2, §2.2 de B3, §2.3 de B5, §2.4 de
   B9 y B10, §2.6 de B8, **y §2.5 no aparecía**—, y lo que faltaba era **una fila en el reparto**,
   no una decisión entre dos políticas: el §2.5 es el catálogo de una columna que nace en el §2.2,
   y quien construye `G-R1-F` necesita esa tabla sembrada para que el guard compare contra algo. El
   razonamiento completo está arriba, en la fila de `G-R1-F`.
2. ~~**Los inventarios de `NUCLEO/01` §2.4, §2.5 y §2.6 tampoco lo son.**~~
   **RESUELTA**: los tres son capítulos de **B3**, y la fila del §2 lo dice (`01` §2.4, §2.5 y
   §2.6, núcleo). Lo medido que la abrió sigue siendo cierto y **llevaba dos vueltas reportado**
   —`F-8dC2-002` dice que cuatro capítulos del núcleo no son de ninguna unidad, y el veredicto de
   la FASE 8-bis-4 *«`nucleo/01` entró por `V9`»* es cierto **del §1.2**, los ~~cuatro~~ ~~cinco~~ **seis** hechos (el sexto, `PB11`: owner 2026-09-25, FASE 9 completa, 5b) de
   reinicio, y no de los inventarios del §2—. Lo que faltaba era **una fila en el reparto**, igual
   que en el punto 1, y el dueño se elige con el mismo criterio que allá: **la unidad que construye
   los guards que los leen y los términos que enumeran**.

   **Los dos guards que los cuentan son de B3**, y está escrito arriba: `G-R1-E` vigila los
   inventarios del §2.4 —*«fila viva»*, y desde su segunda mitad *«grant vivo»* y *«ancla viva»*—
   y `G-R1-F` los del §2.5 —*«marca abierta»*— y del §2.6 —*«cortesía diferida»*—. **Y el término
   más temprano de los tres nace en su capítulo**: las dos enumeraciones de *«fila viva»* son la
   de `02` §2.2 —los seis estados de la suscripción— y la de `03` §8, y `reconciliation_mark` con
   su columna anulable también es `02` §2.2. Quien construya los dos guards en B3 sin la tabla
   sembrada se encuentra con un guard que compara contra una enumeración vacía, que es exactamente
   el patrón del punto 1.

   **Lo que B3 no puede terminar solo, dicho igual que en el punto 1**: los inventarios enumeran
   **consumidores**, y la mayoría llega después —`S19` con B7, `S17` con B8, `S20`, `S21` y `A5`
   con B10, *«grant vivo»* y *«ancla viva»* con B9 y B10, y los ~~**diez**~~ **once** de *«cortesía diferida»*
   repartidos entre ~~B8, B9, B11 y B13~~ **B3 (el cierre del saldo en `S3`), B8 (`S18`, el `02` §2.6,
   `G-R1-C` y el cierre en `S31`, el undécimo), B9 (`S9`, `S13` y el `14` §4.4), B11 (la sexta
   comprobación), B12 (`S25`) y B13 (Mi Suscripción)** —recontado sobre `NUCLEO/01` §2.6 el
   2026-09-25, FASE 9 completa, salida 3—. **B3 siembra los tres inventarios y cada unidad trae su
   propia fila cuando llega**, que es literalmente la regla que los tres §§ ya declaran:
   *«quien escribe un consumidor nuevo agrega su fila acá en el mismo acto»*.

   **Y esto no muta el núcleo por una sola épica, que era la parte que costaba.**
   `DEC-ARCH-006` dice que ninguna de las dos lo puede mutar sola, y **los tres §§ son de billing
   por su propio contenido**: el inventario del §2.4 lo declara textualmente —*«Todos están del
   lado de billing y sobre filas de billing»*— y *«marca abierta»* y *«cortesía diferida»* son
   entidades de `B/02`. El único término del §2.4 que es de la frontera, *«fuente viva»*, **no
   tiene inventario que mantener**: se resuelve contra la respuesta del contrato en el momento. Y
   el precedente de que un § del núcleo sea capítulo de una unidad ya existe: el §1.2 es de `V9`.

---

## 3. El orden, y qué se puede hacer en paralelo

```text
B1 ──┐   ✅ la pasarela se decidió (DEC-MP-005, 24/09): esto ya no espera
     ├──► B3 ──┬──► B4 ◄──────┐   (B5 ──► B4: FASE 9 vuelta 1, F-8V1C1-005)
B2 ──┘   ✅    │              │
               └──► B5 ──┬────┘
                         ├──► B7 ──► B8 ──► B9 ──► B10 ──► B13 ──► B12
                         ├──► B11
                         └──► B6  ····  ✅ con diseño desde el 24/09 (el 13 se repartió)
```

| | |
|---|---|
| **camino crítico** | `B1 → B3 → B5 → B7 → B8 → B9 → B10 → B13 → B12` |
| **en paralelo** | **B2** con B1 (su gate es `V2`, no B1) · ~~**B4** una vez que estén B3 y `V4`~~ **B4** una vez que estén B3, **B5** y `V4` —`cobrada` se lee sobre pagos acreditados, que registra B5, y el aviso del primer pago lo emite `P1`, que también es de B5 (FASE 9 vuelta 1, `F-8V1C1-005`); no mueve el camino crítico: `B4` sigue en paralelo, ahora con `B7`— · **B11** una vez que esté B5 · **B6** una vez que esté B5 (y B1, porque el reembolso sale por el adaptador) |
| ~~**sin diseño**~~ **B6** | ~~**B6**, y~~ **desde la FASE 9-bis-3 detiene la EJECUCIÓN de un desenlace de B7** — ver §3.1. ~~Sin diseño~~ Con diseño desde el 2026-09-24 (FASE 9 completa, salida 3) |
| ~~**lo único que arranca hoy**~~ | ~~**B2**, y la interfaz de B1. **El resto del grafo espera a la pasarela** (§2.3)~~ **Nada espera a la pasarela desde el 2026-09-24**: el grafo se recorre en el orden de las flechas |

**B5 es la bisagra**: hasta ahí se construye el compromiso, y de ahí en adelante todo lee el
registro del dinero — el grace mira pagos acreditados, la compensación de días mira pagos
acreditados, y la conciliación compara contra ellos. Es también donde la regla *«se cuenta sobre
pagos acreditados, nunca sobre fechas»* pasa a tener un lugar donde vivir: una sola implementación
que mire fechas rompe **el agujero del grace y la compensación de días a la vez**.

**B4 es el hito de integración**, no el final: es donde la frontera deja de ser una definición.

### 3.1 B6 dejó de ser una hoja suelta: la rama 1 del cierre de la sucesión aterriza ahí

**Hasta la FASE 9-bis-2, `B6` podía quedarse sola sin detener nada** porque el reembolso era un
camino excepcional del capítulo 13. Dejó de serlo: `B/12` §5.3 movió el disparador al **cierre de
la sucesión**, `S19` creó el pago retenido, y `DEC-RF-002` declaró el camino **normal** —*«va a
pasar seguido sobre el camino de recuperación que `DEC-SUB-003` diseñó para que no fuera un
muro»*—. Esa rama vive en **B7**, que está en el camino crítico, y su desenlace es un reembolso,
que es **B6**. (`DEC-SUB-003` fue superada por `DEC-SUB-021`, owner 2026-09-25: desde el grace ya
no se declara una sucesión. **El pago retenido sigue teniendo población** —la predecesora de una
sucesión declarada en `ACTIVE` que entra en el grace durante la ventana, `B/03` §3.2—, así que la
dependencia de `B6` no cambia; lo que cambia es cuán seguido pasa, y eso no está medido.)

**El bloqueo alcanza a la ejecución, no al disparador, y la línea es exacta:**

> ✅ **Desde el 2026-09-24 ya no hay bloqueo** (FASE 9 completa, salida 3): B6 tiene diseño y la
> tabla de abajo se lee como **qué unidad construye cada paso**, no como qué espera. La
> dependencia de la última frase del §3.1 sigue en pie: la sucesión no se libera sin B6.

| qué | de qué unidad es | ¿se puede construir ~~hoy~~? |
|---|---|---|
| abrir la marca al cerrar la sucesión (`S18`, efecto 5) | ~~**B7**~~ **B8** *(`S18` está en la columna de B8; corregido el 2026-09-25 contra la tabla del §2)* | **sí** — es una escritura nuestra, no toca la pasarela |
| que la marca escale si nadie la mira (`B/09` §3, salvedades 2 y 3) | **B11** | **sí** |
| que el caso aparezca en el listado accionable con qué devolver (`NUCLEO/08` §4.3) | B13 y el núcleo | sí |
| **mover la plata de vuelta**, cuando el pago entró **por el proveedor** | **B6** ~~🔒~~ | ~~**no**: el capítulo 13 no está escrito y arrastra `RF-3` en `UNKNOWN`~~ **sí**: `RF2`, `RF3` y `RF5` sobre `B/06` §4.6; `RF-3` ya no bloquea (`DEC-RF-007`) |
| **mover la plata de vuelta**, cuando el pago entró **a mano** (`MP1`, `B/03` §7) | **B7**, con el asiento de `B/02` §2.3 — **el acto que lo asienta es `RF4`, la acción administrativa 14, y lo construye B5** (owner 2026-09-25, 5a) | **sí**: se devuelve por donde entró —una transferencia— y **no toca la pasarela**, así que `B6` no la bloquea. Lo único que faltaba era dónde asentarla, y es un `refund` sobre el `manual_payment`, **nacido `EXECUTED` por `RF4`** (`B/03` §6.1) |

O sea: **B7 puede quedar entera y correcta con B6 sin empezar**, y lo que queda pendiente es que
la persona que confirma el reembolso tenga con qué ejecutarlo. Lo que **no** se puede es liberar
~~el cambio de plan desde grace~~ la sucesión —cuyo pago retenido llega desde que la predecesora
entra en el grace durante la ventana (`DEC-SUB-021`)— sin B6 y llamarlo completo: habría casos acumulándose en el canal de
conciliación sin herramienta que los cierre.

**Y el criterio de terminación de B7 quedó describiendo el comportamiento que la tanda
reemplazó.** Su §4 dice *«un pago tardío que llega habiendo otra suscripción viva no reactiva nada
y el evento dice cuál de las cuatro condiciones falló»*. Desde `S19` ese pago **no sólo no
reactiva**: se registra, **queda pendiente**, **sin marca y sin evento crítico** (`B/05` §3, la
excepción), y su destino lo decide el cierre. Una implementación que descarte el pago —o que ponga
la marca al llegar, que es lo que el criterio sugiere— **satisface el criterio al pie de la letra y
pierde la plata**. El §4 queda corregido abajo.

**Y cada unidad trae la pantalla mínima que su propio flujo necesita** —el alta necesita un
checkout—. B13 es la unidad de las superficies que **leen el estado compuesto** y de la lista de lo
que hay que decir, no la que inventa las pantallas de las demás.

---

## 4. Lo que cada unidad tiene que dejar demostrado

No es una lista de tests: es **qué pregunta tiene que poder contestar alguien de afuera** cuando la
unidad se declara terminada.

> **Y hay una condición que vale para las trece y no está en la tabla, porque no depende de qué
> construye cada una**: **una unidad no está terminada mientras algún guard de su columna `guards`
> del §2 no esté escrito y no tenga su caso que lo hace fallar a propósito** (§2.1, *«un guard que
> no puede fallar es un comentario con exit code 0»*). La regla 1 del §1.3 dice **cuándo** va cada
> guard —*«con la pieza que protege, nunca al final»*— y hasta esta pasada **no había ningún lugar
> donde se comprobara que había ido**: la asignación vivía sólo en una columna que nadie consulta
> al declarar una unidad lista. **Los ~~29~~ ~~30~~ 31 guards ~~están repartidos~~ —~~30~~ **31** repartidos entre las 22 unidades, ~~13~~ ~~**14**~~ **13** en esta
> épica y ~~17~~ **18** en la otra (el nuevo, `G-R5-B`, de `V6`; FASE 8 completa, owner 2026-09-25;
> **13 y 18** desde que `G13` pasó a `V4`, owner 2026-09-26, `G5-5`: FASE 9 vuelta 1, §4 punto 1 de
> `25-verificado-G5`) —,
> contados sobre las dos columnas, ~~y uno sin unidad, `G-R2-C` (owner 2026-09-25, 4e; su unidad
> natural es `V3`, con `G-R2-B`, y la asignación es de `V/descomposicion.md`; recuento de `B/20`
> §2)~~ **y `G-R2-C` ya tiene unidad, `B10`** (owner 2026-09-25; FASE 9 completa, decisión 10c; fila
> `B10` de este §2) — y ninguno aparecía en ninguno de los 22
> criterios**, así que la quinta enmienda de `DEC-TEST-001` compró que todos tuvieran dueño y no
> compró que alguno se construya. El desarrollo, del lado de verticales, está en
> [`V/descomposicion.md`](../HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md) §4.
>
> **No se enumeran acá uno por uno a propósito**: duplicar la columna sería un segundo censo del
> mismo conjunto. **La columna es la lista; esto es lo que la vuelve una condición.**
>
> **Y hay una segunda condición de la misma forma, sobre los ESCRITORES** (`DEC-TEST-002`):
> **una unidad no está terminada mientras alguna escritura que sus capítulos le declaran a una de
> sus transiciones no esté implementada.** También vale para las trece, también es independiente de
> qué construye cada una, y también sale de una columna que ya existe — acá la de **capítulos** del
> §2, que es donde está declarado qué escribe cada transición.
>
> **De dónde sale, y es una contrapartida exacta y no una precaución general.** `G-R6` exige que
> *«al menos una transición del corpus»* escriba cada columna que una condición lee, y **el corpus
> son las tablas que los capítulos declaran**, nunca el subconjunto ya construido (`B/20` §2) —
> es lo que impide que el guard nazca en rojo sobre el camino normal entre `B5` y `B8`, donde
> `MP5` lee una fecha cuya tercera escritura es de `S10`, que construye `B8`. **El precio de esa
> elección está dicho en el mismo lugar donde se toma**: un escritor que el capítulo declara y que
> **nadie implementa pasa en verde**, y `B/20` §2 declara que esa clase **ningún guard la vigila**.
>
> **Por qué un criterio y no un guard, que es lo que el owner eligió entre las tres opciones.**
> Un guard que compare escritores **declarados** contra **implementados** sólo puede correr cuando
> exista el código —FASE 10 en adelante—, así que hasta entonces no vigila nada; el criterio, en
> cambio, actúa **en el instante en que la unidad se declara lista**, que es cuando el escritor
> tendría que estar, y no cuando alguien lea un dato vacío en producción. Es exactamente la forma
> del párrafo de arriba aplicada al otro conjunto.
>
> **Y no se enumeran acá tampoco, por la misma razón**: las tablas de transiciones de los capítulos
> ya declaran cada escritura, y copiarlas sería un segundo censo del mismo conjunto. **La
> declaración del capítulo es la lista; esto es lo que la vuelve una condición.**
>
> **Y esto NO revive el guard que `B/20` §2 rechaza sobre la misma dirección.** Allá lo rechazado
> es que **un guard estático** comprueba que un hecho tenga quien lo ejecute: *«pide una
> declaración, y un guard estático sólo puede comprobar que esté»*. Un criterio de terminación no
> es un guard —lo contesta una persona al declarar lista la unidad, con el código delante— así que
> la objeción **no lo alcanza**, y la dirección que allá sigue sin vigilancia automática queda con
> vigilancia humana en el único momento en que se puede ejercer.

| # | la unidad está lista cuando… |
|---|---|
| **B1** | el adaptador falso implementa la interfaz entera **sin nombrar un concepto de Mercado Pago**; importar el SDK afuera **falla**; y el falso **miente** — hay un caso donde acepta una mutación, devuelve `2xx`, **no la aplica**, y el código de arriba lo detecta releyendo |
| **B2** | un monto escrito en código **falla**; un precio con decimales **no se puede guardar**; y cambiar un precio deja demostrable contra un registro cuál era el anterior **sin que ninguna suscripción viva cambie de monto** |
| **B3** | diez altas simultáneas del mismo `user + vertical` dejan **una** fila y **un** id en el proveedor; una ventana que vence **cancela en el proveedor** y no sólo marca la fila; y dos webhooks que llegan al revés dejan **el mismo estado**; y **un alta o una sucesión en una vertical que ya no admite altas no nace**, con el mensaje *«esta vertical ya no admite altas»* (`S1`, owner 2026-09-25, 6a); **y un alta o una sucesión sobre una versión que no es vigente y vendible no nace**, aunque llegue por un link viejo al checkout (`S1`; FASE 9 vuelta 1, `N-G4V-07`) |
| **B4** | el juego de casos corre contra las dos implementaciones y ~~**hay al menos uno que la de arranque no pasa** — si pasan los dos con las dos, no está probando nada~~ **pasa entero contra las dos, y su caso distintivo falla contra una constante**; **los casos de las fuentes de billing van en el juego propio de la real, que corre sólo contra ella y tiene al menos uno que la de arranque no pasaría —una suscripción `ACTIVE` cubre—** (contrato §6.2; FASE 9 vuelta 2, `F-8V2C1-006`: un juego único con un caso que la de arranque no pasa está en rojo durante toda la épica de verticales, o lleva el caso condicionado, que no puede fallar); ~~y la de arranque **no puede llegar a producción**;~~ *(`G13` es de `V4`: owner 2026-09-26, `G5-5`; FASE 9 vuelta 1, `F-8V1C1-011`)* y **ninguna fuente sale de una vertical pasado su fin de servicio** (contrato §2.6) — **con un caso de `GRANT` que traiga su `piso`** en ~~el juego único~~ el juego de la real, cuando B9 enchufe los grants (owner 2026-09-25, 9h); **y un caso de `cobrada: no` sobre una `SUSCRIPCIÓN` `ACTIVE` sin pagos, que pasa a `sí` —con su aviso— al primer pago acreditado** (FASE 9 vuelta 1, `F-8V1C1-005`); **y el consumidor que relee `cobertura()` al recibir el aviso ve ya el estado nuevo: el aviso sale después del commit** (contrato §3; FASE 9 vuelta 2, `F-8V2C1-002`); **y el caso de *«ninguna fuente pasado el fin de servicio»* corre contra una fila de `vertical_discontinuation` sembrada en el juego, porque la escribe `B12`, que llega después** (`02` §2.1; FASE 9 vuelta 2, `Q-FECHA`) |
| **B5** | un reembolso que emite **tres notificaciones en dos formatos** produce **una** fila; un período con un pago acreditado **rechaza el segundo desde la base**, no desde un chequeo; y un hecho más viejo que el último aplicado **se registra y no se aplica**; y **sólo un `refund` en `EXECUTED` mueve el acumulado del pago** —un pedido sin confirmar o uno fallido no corre `P3`/`P4`—, **una devolución hecha por fuera se asienta por la acción administrativa 14 y nace `EXECUTED`** (`RF4`), y **el asiento de un cobro por fuera crea el `payment` en `PENDING` y corre ~~`P1`~~ la regla con la que la fila recibe el cobro** —sobre una `CANCEL_SCHEDULED` extiende con `max`, sobre una predecesora en curso retiene por `S19`, sobre una `SUSPENDED` con las cuatro condiciones corre `S7`— y registra el pago por `P1` (FASE 9 vuelta 1, `N-G3V-01` y `N-G3V-02`), que es lo que emite el comprobante y escribe `covered_period` (owner 2026-09-25, 5a, `DEC-RF-008`); y **una revocación sobre una sucesora que todavía no cobró crea `RF1` por el último pago de su predecesora** —si lo crea en cero o sin pago, está leyendo la fila y no la cadena de `sucedida_por`— (FASE 9 vuelta 2, owner 2026-09-27, `R17`); y **dos parciales de una misma devolución dejan dos ids en la misma fila de `refund`, y un id de devolución no está en dos filas** (FASE 9 vuelta 2, `F-8V2B2-002`) |
| **B6** | ~~🔒 **no se puede redactar todavía**: qué hay que demostrar depende de quién tenga el reloj. Lo que sí vale en las dos respuestas:~~ **ningún ~~cobro~~ reembolso sale sin su clave de idempotencia persistida antes**, y **nunca hay dos relojes sobre la misma autorización** —**el único es el del proveedor** (`DEC-MP-006`)—; **un reembolso confirmado queda `EXECUTED` sólo cuando la relectura por id lo muestra acreditado** (`RF3`), nunca por el `200` del pedido; **un `2084` no lo marca como no reembolsable**: se queda en `CONFIRMED` y se reintenta con otro monto **que nunca pasa del confirmado** —partido en parciales que suman lo confirmado— (`RF-8`, que midió que un monto mayor entró; `DEC-RF-001` parte 3, su 📌; FASE 9 vuelta 1, §4 punto 6 de `25-verificado-G5`); y **pasado el plazo del proveedor el sistema no ofrece la operación y lo dice**, y si el proveedor la rechaza igual, **el error no se traga**: `RF5` la deja `FAILED` con el caso identificado para el camino manual (`DEC-RF-007`). *(Redactado el 2026-09-25, FASE 9 completa, salida 3: la pregunta del reloj se contestó el 24/09.)* **Y desde la FASE 9 vuelta 2**: una devolución partida en dos parciales, con uno acreditado y el otro rechazado, **deja la fila en `CONFIRMED`** y el acumulado del pago sin mover —si pasa a `EXECUTED` por el total, `RF3` está leyendo el acumulado del pago y no los ids de la fila— (`F-8V2B2-002`); y **dos pedidos de compra de un addon `UNA_VEZ` con el mismo identificador producen una orden y un cobro** (FASE 9 vuelta 2, owner 2026-09-27, `R4`) |
| **B7** | un **primer** cobro rechazado **no da grace** — **salvo el de una sucesora cuya predecesora venía pagando** (declarada desde `ACTIVE` o `CANCEL_SCHEDULED`, con al menos un pago acreditado), que **entra en grace por `S4`**, y el barrido relee su preapproval cada día y la lleva a `SUSPENDED` por `S6` si lo lee `cancelled` o `paused` (owner 2026-09-25, 3c, `DEC-SUB-022`); **al vencer el grace, `S6` cancela el preapproval** y, si la cancelación falla, **no ocurre** en esa corrida (`DEC-SUB-019`); **una versión de plan con grace no más corto que su ciclo no se puede configurar** (`12` §1.2); **una fila `ACTIVE` con al menos un pago acreditado cuyo aviso de primer rechazo se perdió entra en grace igual**, porque la lectura del barrido corre `S4` (9a); y **un *«todavía no se sabe»* que dura 3 días abre la marca 21** en vez de dejar a `S6` esperando (3d); un cobro que el proveedor está reintentando deja el pago `PENDING` y la suscripción ~~`ACTIVE`~~ **en `GRACE_PERIOD` desde el primer rechazo** (`12` §1.2, FASE 8 completa `R1`); un pago tardío que llega habiendo **otra suscripción viva** para ese `user + vertical` **no reactiva nada** y el evento dice **cuál** de las cuatro condiciones falló — **salvo que esa otra fila sea su propia sucesora viva**, y ahí el pago **se registra y queda pendiente**, **sin marca y sin evento crítico** (`S19`, `05` §3), con su destino decidido por **cómo termina la sucesión** y no por su llegada; y **las SEIS ramas de `12` §5.3 tienen cada una un acto que apaga la bandera** —`S18` con la marca `REEMBOLSO_POR_CONFIRMAR`, en las ramas 1, 5 y 6; `S3` reevaluando; `S13` apagándola; y la 3 la resuelve la persona que ya está mirando la traba— de modo que **ninguna corrida deja un pago «pendiente» para siempre**; y **un pago registrado A MANO sobre una predecesora en sucesión entra por esa misma fila** —no cae en la marca, no reactiva y **no la suspende cuando vence el grace**—, con su devolución asentada igual que la de un cobro del proveedor (`03` §7, `02` §2.3); y **si `S6` mandó la cancelación y el reintento aprobado corre `S5` antes de que escriba, el `cancelled` que llega después deja la fila en `CANCEL_SCHEDULED` con `fin_de_servicio` en el fin del período pagado, sin marca, y `S12` la termina en esa fecha** —si la corta, el espejo está leyendo nuestra cancelación como una baja del proveedor— (FASE 9 vuelta 2, `R18`, `F-8V2B2-001`); y **en ese mismo acto el preapproval de su destaque recurrente, que seguía `authorized`, se cancela y la fila del destaque queda en `CANCEL_SCHEDULED` con el mismo `fin_de_servicio` —si sigue `ACTIVE` cobrando, el espejo no aplicó la regla de `S11`—, y lo mismo cuando `S7` lleva a `CANCEL_SCHEDULED` una principal cuyo destaque `S32` no alcanzó a pausar** (owner 2026-09-27, FASE 9 vuelta 2, `R18-b`) |
| **B8** | **un cambio hacia una versión de `rank` MAYOR con un solo limit menor sigue el camino de DOWNGRADE** —si sigue el de upgrade, la dirección se está derivando del `rank` en vez de pedírsela a `direcciónDeCambio` (contrato §4.1), y el cliente pierde el aviso previo del excedente—; un downgrade encima de otro **vuelve a preguntar** qué conservar; un aumento cuya fecha cae sobre una pausada se aplica en el **primer cobro posterior a la reanudación** y nunca recortando los 60 días; cancelar estando pausado corta el servicio **ese día**; **una predecesora que se muere sola con la sucesora todavía esperando autorización cierra la sucesión en el acto, y un alta nueva sobre ese `user + vertical` la rechaza la base**; y **un upgrade no le saca nada al cliente**: los complementos ~~y la redención de promo~~ terminan colgando de la sucesora~~, con el descuento vuelto a aplicar sobre el monto nuevo y verificado releyendo~~, y **la cortesía vigente NO se re-apunta: se cierra con su saldo de ~~días~~ meses y `S9` la re-emite sobre la sucesora cuando ésta autoriza** (`02` §2.6, `14` §4.4, `DEC-GRANT-007`) — **salvo la promo, que se pierde en todo cambio de plan** (`02` §2.6, `14` §2.2: FASE 8 completa, `R6`, pendiente 7; y la vuelta del suspendido por sucesión la pierde también, que se acepta y se dice: owner 2026-09-25, 3b). *(Corregido el 2026-09-25, FASE 9 completa, salida 3: el criterio seguía pidiendo el re-apunte de la redención que la FASE 8 completa eliminó.)*; y **en `GRACE_PERIOD` el cambio de plan no se ofrece ni se puede declarar** —la pantalla dice cómo regularizar— (`DEC-SUB-021`); y **darse de baja desde `ACTIVE` con un destaque recurrente cancela en el mismo acto los dos preapprovals, y el destaque se sigue viendo hasta el fin de servicio sin un cobro más** (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`); y **una baja sobre una sucesora que vive del crédito deja el servicio hasta el fin del crédito**, nunca en el acto (FASE 9 vuelta 2, owner 2026-09-27, `R17`) |
| **B9** | un 20 % y ARS 100 sobre ARS 1.000 dan **700 y nunca 720**; un descuento que deja el monto bajo ARS 15 ~~**pausa en vez de mutar**~~ **se rechaza al canjear, con el motivo en pantalla que dice que el mínimo lo pone Mercado Pago, y el código no se consume** (owner 2026-09-25, 4b y 9g; `14` §1.3); **una cortesía sobre una `PAUSED · COURTESY` suma meses sin cambiar de estado** (`S34`) y **pausar sobre una cortesía la cambia a `CUSTOMER_REQUEST` sólo después de avisar lo que se pierde** (`S35`); y agregar cortesía y grant como fuentes **no toca una línea** de lo que dejó B4 —**y cada `GRANT` sale con su `piso`** (9h)—; **y con `extenderTrial` → `RECHAZADA` el código de canje queda intacto, y el reintento con la misma `claveDeCanje` después de un `ACEPTADA` no extiende dos veces ni consume el código dos veces** (contrato §4.1; FASE 9 vuelta 1, `N-G4V-08`; la mitad de verticales está en el criterio de `V4`); y **una cortesía de N meses re-emitida sobre una sucesora con crédito saltea N cobros contados desde el fin del crédito** (FASE 9 vuelta 2, owner 2026-09-27, `R17`); **y otorgar o anclar un grant con una versión de piso que `políticaDePlan` no da por vigente se rechaza y no escribe ninguna fila** (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`); **y un 15 % y un 10 % apilados sobre ARS 9.999 mutan el preapproval a 7.649,23 y el barrido deriva lo mismo, sin marca** (`14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`); **y una promo de «primer cobro» canjeada después de creado el registro del ciclo, que cobra el precio entero, sigue con `cobros_restantes = 1`** (`14` §2.4; FASE 9 vuelta 2, `R20`) |
| **B10** | ~~cancelar el plan **deja vivo** el preapproval de cada addon recurrente, y el barrido **lo ve**;~~ **darse de baja (`S11`) cancela en el acto el preapproval de cada addon recurrente que depende de la principal** —la selección de `S32`— y el addon se sigue viendo hasta el fin de servicio (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`); **la principal que se va por otro camino deja vivo el preapproval hasta que corre la orfandad, y el barrido lo ve**; **una revocación (`S36`) corre la orfandad en el mismo acto** y crea `RF1` sobre el último cobro del complemento sólo si cae dentro de sus propios 10 días (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`); borrar una ficha **dice qué addons se pierden y por cuánto** antes de borrarla; `PERIÓDICO + DÍAS_FIJOS` **no se puede configurar**; y **un addon cuyo título muere mientras su checkout está abierto no llega a cobrar nunca** —se le cancela el preapproval esperando autorización, y si igual autoriza, el barrido lo encuentra vivo con el objetivo muerto (`03` §8, `16` §4.2 y §4.3, `09` §3 cuarta comprobación); y **a un beneficiario de *Free Forever* con `includesAddons: true` no se le cobra ni un peso más por un addon compatible** —su suscripción de complemento queda `CANCELLED` en el mismo acto del otorgamiento, **sin reembolso de lo ya cobrado**, la instancia sigue `ACTIVE` colgando del ancla, y **al revocar el grant se apaga y no vuelve sola**, ni siquiera con scope `USER` o `GLOBAL`, ~~donde el objetivo nunca murió~~ **aunque la persona conserve otro título** (desde 4d ningún scope queda del todo en *«el objetivo nunca murió»*: `16` §3.3, owner 2026-09-25) (`S20`, `03` §3.2 y §8, `16` §3.3 y §3.4); y **cuando un addon se apaga, su suscripción de complemento queda `CANCELLED` en el mismo acto** —sin período de gracia, sin fecha de fin de servicio y **sin reembolso automático** de lo ya cobrado—, así que no queda ninguna fila de complemento viva colgando de una instancia terminal (`S21`, `03` §3.2 y §8, `16` §4.4, `09` §3 salvedad 1); y, **desde la FASE 9 completa** (owner 2026-09-25, `DEC-ADDON-007`): **una pausa pedida por el cliente no deja ningún addon recurrente de esa vertical cobrando** —se pausa con ella por `S32` y vuelve por `S33`, y un `USER`/`GLOBAL` sólo si no le queda título en otra vertical compatible— (4a); **un upgrade abandonado no deja huérfano el `LISTING` de quien sigue pagando** (4c); **un `USER`/`GLOBAL` sin principal viva y ~~cobrada~~ pagando ni ancla viva en sus verticales compatibles queda huérfano** (4d; *«pagando»* como en la fila `B10` del §2 —`NUCLEO/01` §2—, no el campo `cobrada` de `B4`: la sucesora recién autorizada viene con `cobrada: no` y no deja huérfano el addon; FASE 9 vuelta 1, `F-8V1D1-002`); **un `USER`/`GLOBAL` no aparece como fuente en una vertical que su producto no declara compatible** (4e); y **borrar la ficha sólo lo ejecuta `A6`** (`K-9`); y **el empuje *«la ficha llegó a `PURGED`»* corre `A6` en el acto, sin esperar al barrido; si el empuje se pierde, lo corre el barrido al leer `fichaPurgada`; y recibir los dos no cancela dos veces una instancia ya `CANCELLED`** (contrato §3.1 y §4.1, `16` §4.2; `G2-1`; FASE 9 vuelta 1, K); y **un doble clic en «pagar» de un addon `UNA_VEZ` deja una instancia, una orden y un cobro**, y **una orden sin respuesta la reenvía `A3` con la misma clave antes de abandonar, y no abandona mientras el reenvío no tenga respuesta** (FASE 9 vuelta 2, owner 2026-09-27, `R4`); y **con la principal y su destaque en `CANCEL_SCHEDULED` hasta el 15/10 y el último cobro del destaque pagado hasta el 20/10, el 15/10 el destaque termina `CANCELLED` por `S21` con la marca 14 abierta y ese cobro colgado —si termina por su propio `S12`, sin marca, el orden está al revés—** (FASE 9 vuelta 2, owner 2026-09-27, `R1-c`) |
| **B11** | un barrido que liste desde el buscador del proveedor **no existe**; una suscripción que cobró y cuyo endpoint de cobros devuelve cero **no se reporta como divergencia**; un monto que el proveedor aceptó y no aplicó **aparece**, sin que haya llegado ningún webhook; y **una suscripción TERMINAL con la marca puesta o con un pago pendiente sigue en el barrido**, porque es lo único que hace que el reloj de la marca escale sobre el reembolso que `DEC-RF-002` volvió manual; y **un preapproval desconocido cuyo `external_reference` no nombra una fila nuestra sin otro vínculo vivo no se re-vincula: abre marca** (owner 2026-09-25, 2b); y **la herramienta del corte escribe una lápida por cada id cancelado y verificado del manifiesto, y ninguna sobre una sonda viva; una fila `subscription` principal o de complemento sin usuario, vertical, versión o billing option la rechaza la base** (FASE 9 vuelta 1, R6); y **una orden de única vez pagada cuya instancia terminó `ABANDONED` abre el motivo 23 al día siguiente, sin reenviar nada al proveedor** (FASE 9 vuelta 2, owner 2026-09-27, `R4`); y **un `refund` en `CONFIRMED` cuyo aviso se perdió termina en `EXECUTED` por el barrido y no en el motivo 18** (FASE 9 vuelta 2, `F-8V2B2-005`); y **sobre una lápida del corte, un cobro con `date_created` del día del corte se asienta sin marca y uno del día siguiente abre `PAGO_TARDÍO_RECHAZADO`, también si su evento se perdió y lo ve el barrido; una fila `CANCELLED` por el espejo con un registro de cobro en `recycling` sigue en el barrido hasta que el registro cierra; la herramienta del paso 4 corrida dos veces escribe cada lápida una sola vez, y ante una lápida de recepción del mismo id no escribe ninguna; y un cobro de una sonda del manifiesto escribe su lápida de recepción sin mandar cancelar el preapproval** (owner 2026-09-27, FASE 9 vuelta 2, `R2`; `F-8V2B3-003`, `F-8V2B3-004`, `F-8V2B3-006`); **y una `CANCEL_SCHEDULED` con el preapproval cancelado no abre `DIVERGENCIA_DE_MONTO` después de un aumento** (FASE 9 vuelta 2, `F-8V2B3-007`); **y un cobro sobre una lápida deja un `payment` en `SUCCEEDED` con su comprobante, sin `covered_period` y sin aviso de cobertura, y con el consumidor del aviso caído el `payment` y la marca quedan escritos** (FASE 9 vuelta 2, `F-8V2B3-005`); **y un cobro de ARS 30.000 sobre un período cuyo esperado es 15.000 abre el motivo 24 con propuesta de devolver 15.000, aunque el `transaction_amount` del preapproval ya diga 15.000; y un cobro igual al esperado no abre nada** (`09` §3; FASE 9 vuelta 2, owner 2026-09-27, `R20`, `F-8V2B3-001`) |
| **B12** | retirar un plan **no mueve a nadie** —ni un monto, ni una fecha, ni un entitlement—; y anunciar una discontinuación **corta el cobro el día 0** dejando el servicio prestándose hasta la fecha, nunca al revés; **una pausada no se interrumpe y, al terminar, `S25` la cancela en vez de reanudar** (`DEC-SUB-015`); y ~~**el día del fin de servicio el barrido invalida el caché de la vertical entera**, así que un grant, una cortesía o un trial de esa vertical dejan de otorgar ese mismo día (owner 2026-09-25, 6b)~~ **`finDeServicio` contesta la fecha de la fórmula del `10` §4.3 desde el anuncio, y la misma fecha pasado el fin de servicio; y el día del fin de servicio billing no escribe nada en verticales —ni `listing.inactiva_desde`, ni el caché, ni una transición de publicación—: lo ejecuta el reconciliador de V6** (contrato §4.1 y §4.2; owner 2026-09-27, FASE 9 vuelta 2, `R5`); y **anunciar escribe una fila de `vertical_discontinuation` con el anuncio y la fecha, y acortar la cola la reescribe: `finDeServicio` contesta la fecha nueva, y una vertical sin fila contesta `NINGUNA`; y billing no escribe `admite_altas`** (`02` §2.1, `10` §4.3 y §4.4; owner 2026-09-27, FASE 9 vuelta 2, `Q-FECHA`, `Q-ALTAS`); y **con la mitad de billing del acto fallando, la acción la reintenta hasta que la fila de `vertical_discontinuation` queda escrita y `S26`–`S28` corrieron, muestra al admin el acto a medias mientras tanto, y `admite_altas` sigue en `no` todo ese tiempo —si vuelve a `sí`, la acción deshizo la mitad de verticales—** (owner 2026-09-27, FASE 9 vuelta 2, `Q-ALTAS-b`) |
| **B13** | cancelar cuesta **los mismos pasos o menos** que suscribirse; **nuestro** correo sale antes que el del proveedor; y ninguna pantalla esconde algo que la autorización **no** rechazaría; y (owner 2026-09-25, FASE 9 completa) ~~**ningún aviso del grace promete que el reintento use la tarjeta nueva** (3a)~~ (tachado 2026-09-26) **el aviso del grace puede decir que al cambiar la tarjeta se reintenta el cobro en el momento, y no promete que ese cobro entre** (3a; `GR-1` `VERIFIED` el 2026-09-26), **el aviso de suspensión dice que al volver se pierde la promo** (3b), **el botón de suscribirse de quien no publicó en esa vertical lo manda a publicar y no al checkout** (6c), **la pricing no ofrece planes de una vertical que no admite altas** (6a), y **Admin ofrece la acción 14 con su permiso y su auditoría** (5a) |

---

## 5. Dónde vive cada unidad

Las trece están en Linear como sub-issues de `HOS-1354`, y cada una tiene su ficha publicada. El
estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se lleva en el
**[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles están
listas: una unidad lo está cuando todas sus dependencias están hechas.

| unidad | issue | ficha |
|---|---|---|
| **B1** | [HOS-1364](https://linear.app/hospeda-beta/issue/HOS-1364) | [ficha](https://claude.ai/artifact/XS15EzcyrUFXkHrqRPk7mp) |
| **B2** | [HOS-1365](https://linear.app/hospeda-beta/issue/HOS-1365) | [ficha](https://claude.ai/artifact/W7vHN5g24wAL6UcvPjMNmN) |
| **B3** | [HOS-1366](https://linear.app/hospeda-beta/issue/HOS-1366) | [ficha](https://claude.ai/artifact/SZWTgCVsibxQQBoCv1BqS1) |
| **B4** | [HOS-1367](https://linear.app/hospeda-beta/issue/HOS-1367) | [ficha](https://claude.ai/artifact/PhznPesGdJNckEgUJukffC) |
| **B5** | [HOS-1368](https://linear.app/hospeda-beta/issue/HOS-1368) | [ficha](https://claude.ai/artifact/TCjMHoQtCmbE1GDvJndrKu) |
| **B6** ~~🔒~~ | [HOS-1369](https://linear.app/hospeda-beta/issue/HOS-1369) | [ficha](https://claude.ai/artifact/7Rgsqbpv4xexx9dbzbaqwF) |
| **B7** | [HOS-1370](https://linear.app/hospeda-beta/issue/HOS-1370) | [ficha](https://claude.ai/artifact/BxvBsVpS1pypNgdaFqb9ZY) |
| **B8** | [HOS-1371](https://linear.app/hospeda-beta/issue/HOS-1371) | [ficha](https://claude.ai/artifact/UASiMLVL8iS9WVjPD2EU9d) |
| **B9** | [HOS-1372](https://linear.app/hospeda-beta/issue/HOS-1372) | [ficha](https://claude.ai/artifact/Fe1bqQkj8QThu75uKsHjev) |
| **B10** | [HOS-1373](https://linear.app/hospeda-beta/issue/HOS-1373) | [ficha](https://claude.ai/artifact/CcSEbDa1dofcH7KH1RwZp3) |
| **B11** | [HOS-1374](https://linear.app/hospeda-beta/issue/HOS-1374) | [ficha](https://claude.ai/artifact/TCB6UEHbuxKDnLqYkHHmTC) |
| **B12** | [HOS-1375](https://linear.app/hospeda-beta/issue/HOS-1375) | [ficha](https://claude.ai/artifact/TuSxTZSU9xcUTy7Fp9uE6q) |
| **B13** | [HOS-1376](https://linear.app/hospeda-beta/issue/HOS-1376) | [ficha](https://claude.ai/artifact/7rdj5o5UFqbar5vD5ixsLn) |

**Las otras fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ) ·
[la descomposición de verticales](../HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md).

---

## 6. Lo que esta descomposición NO decide

- ~~**Cuál es la pasarela**, que es lo que traba la construcción entera.~~ **DECIDIDA el 2026-09-24**:
  `DEC-MP-005` fija **Mercado Pago**. La evaluación no se completó — se cerró en el paso 4 de 6,
  porque la PRUEBA 0 y el KYC de Mobbex **nunca recibieron respuesta**, y MP tampoco contestó la
  consulta de `R-MP-01`. Con la decisión entró la directriz de que **lo que el proveedor no hace lo
  suple el diseño**, y con ella se destraba el capítulo 13 y la construcción de acá para abajo.
- ~~**El modelo canónico de cobro.** Es la pregunta de B6, y está planteada en la spec §5.1 con sus
  opciones y una recomendación. Esta descomposición la aísla; no la contesta.~~ **DECIDIDO el
  2026-09-24 por `DEC-MP-006`**: el reloj de cobro es del proveedor y el mandato es el modelo
  canónico; ~~el cargo puntual queda declarado como destino~~ **sin destino pendiente desde el
  2026-09-26** (📌 de `DEC-MP-006`; spec §5.1).
- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista.
- **Qué se reescribe y qué se reutiliza.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`) —
  salvo `qzpay`, que `DEC-ARCH-004` ya resolvió: **se absorbe**. Esta descomposición dice **qué hay
  que tener funcionando**, no de dónde sale.
- **Fechas y esfuerzo.** No hay estimaciones acá a propósito: salen del atomizado.
- **Las ~~seis~~ cinco preguntas legales de esta épica** (`B/22` §4; la sexta del pliego es de
  `V/22`: FASE 9 completa, C-11), que no las contesta el diseño. Lo que sí está cerrado es qué
  depende de cada una, y eso permite implementar el resto sin esperarlas.
- ~~**`B/21` no es capítulo de ninguna unidad.**~~ **`B/21` es capítulo de dos unidades, y sólo por
  dos escrituras del corte**: la lápida del §2.5, de B11, y los grants del §2.4, de B9 (FASE 9
  vuelta 1, R6 y `F-8V1C2-004`). Lo que billing construye desde ahí —la
  re-vinculación de un preapproval desconocido, owner 2026-09-25, 2b— vive en `B/09` §2.4 y es de
  **B11**; ~~el resto, el corte del paraguas, es de `D/16` §4.2~~ el resto, el corte del paraguas,
  es de `D/16` §4.2, que reparte sus herramientas en el párrafo *«Las herramientas del corte»*: la
  lápida del §2.5 a **B11** y los dos `permanent_grant` del §2.4 a **B9** (FASE 9 vuelta 1,
  `F-8V1C2-004`) (declarado por `DEC-METH-015`, FASE 9 completa).
- **`B/22` §2.2, el botón de arrepentimiento (`RF1` por revocación), no tiene unidad todavía
  porque está fuera de alcance hasta la consulta legal** (`22` §2.2, punto 3). La máquina de
  reembolso en sí es de **B5** (`RF1`/`RF4`, owner 2026-09-25, decisión 10d); si el owner mete el
  botón adentro, su unidad natural es **B13** —la única que hoy tiene capítulo `22` (su §1)—
  (declarado por `DEC-METH-015`, FASE 9 completa).
