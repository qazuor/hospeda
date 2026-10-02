# B9b · Promos y cortesías (después)

Pieza posterior. Mitad *b* de la unidad `B9` («Las concesiones»), partida por el owner en el corte
del MVP (Z): promos con su piso del proveedor y su redondeo, cortesías, `S9` (que comparte con
`B8b`), `S30`, `S34`, `S35`, el canje con `extenderTrial` y la acción 21 con su editor (BH).

**Fase y gate.** Va en la **Fase 2**, con [B8b](B8b.md#pieza-b8b), en su rama épica que entra a
`staging` entera ([GATE:FP.F2](../30-el-corte.md#gate-fp-f2)), con el gate de toda fase posterior
([GATE:FP](../30-el-corte.md#gate-fp)): el momento 2 sobre la rama
([GATE:FP.1](../30-el-corte.md#gate-fp-1)), el checklist de smoke extendido
([GATE:FP.2](../30-el-corte.md#gate-fp-2)) y el drift guard sin migración estructural
([GATE:FP.3](../30-el-corte.md#gate-fp-3)); y el momento 1 por pieza
([GATE:M1](../30-el-corte.md#gate-m1)).

## Objetivo, alcance y fuera de alcance

<a id="pieza-b9b"></a>

### PIEZA:B9b — en la lista de piezas

| pieza | unidad | cuándo | fuente |
|---|---|---|---|
| `B9b` | `B9` | después | Z; el editor de códigos promocionales, con la acción 21 (BH) |

De `B9`: promos, cortesías, `S9`, `S34`, `S35` y el canje con `extenderTrial` (Z); el editor de
códigos promocionales (BH); **y las filas 7-bis y 13-ter del `19` §4** (BH; el reparto por fila lo
infiere la fuente y lo marca).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:965, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:743

<a id="fila-b9b"></a>

### FILA:B9b — «Promos y cortesías (después)»

Llama a la pasarela (⛔). Deja funcionando **el resto de `B9`: promos con su piso del proveedor y su
redondeo, cortesías, `S9` (que comparte con `B8b`), `S30`, `S34`, `S35`, y el canje con
`extenderTrial`** (corte del MVP, owner 2026-10-01, Z); **sin migración estructural: el esquema lo
creó `B3`** (AP; corte del MVP, owner 2026-10-01, BG); **y la acción administrativa 21, *«crear o
cerrar un código promocional»*, con su editor del panel, que deja de ser de `B13`** (corte del MVP,
owner 2026-10-01, BH), **y sólo agrega lo que crea filas** (AS); **y revocar una cortesía temporal
(acción 1) como un tercer evento de `S10`, reanudar antes del fin por un acto del `SUPER_ADMIN`: con
`fin_real` y la relectura, sin reembolso y con el aviso a la persona, y su fila en el `19` §4**
(corte del MVP, owner 2026-10-02, [BO](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bo)).

Capítulos: `14` (promos y cortesías) · `03` S9, **S30**, **S34**, **S35** · **`09` §3** (la
comparación de monto) · **`NUCLEO/08` §3** (la acción 21 y su editor, BH). `05` C3 pasa a `B9a`, con
`S13` (Z). Guards: ninguno.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:147

La fila de origen, [FILA:B9](../10-corte/B9a.md#fila-b9), y su criterio,
[LISTA:B9](../10-corte/B9a.md#lista-b9), están definidos en la mitad *a*.

**Fuera de alcance** (y dónde vive): los grants, su fuente, su piso, `S13`, `S20`, la fuente
`CORTESÍA` real y la herramienta del 3b, en [B9a](../10-corte/B9a.md#pieza-b9a); el segundo
disparador de `S9` (la re-emisión sobre la sucesora), en [B8b](B8b.md#tpz-s9); el esquema de promos
y cortesías, en [B3](../10-corte/B3.md#pieza-b3) ([ESQ:6](../10-corte/B3.md#esq-6),
[ESQ:7](../10-corte/B3.md#esq-7)); `T4`, la extensión del trial de verticales, en
[V4](../10-corte/V4.md#pieza-v4).

## Historias de usuario y criterios de aceptación

### Historias de usuario

<a id="us-b9b-1"></a>
**US:B9b:1**

Actor: anfitrión

Como anfitrión, quiero canjear un código promocional y saber cuánto voy a pagar y por cuántos
cobros, o que se me diga por qué no se puede, para no llevarme sorpresas en el resumen.

Fuente: [DEC-PROMO-001](../01-decisiones-vigentes.md#dec-promo-001) · [DEC-PROMO-001#📌2](../01-decisiones-vigentes.md#dec-promo-001-p2) · [TRANS:B:S30](../04-catalogos.md#trans-b-s30)

<a id="us-b9b-2"></a>
**US:B9b:2**

Actor: admin

Como `SUPER_ADMIN`, quiero otorgar una cortesía temporal en meses a un cliente mensual —y poder
revocarla antes de su fin—, y crear o cerrar códigos desde el panel, para hacer concesiones que no
cobren de más ni regalen de más. *Ejemplo*: Juan está en una cortesía temporal; si `SUPER_ADMIN` la
revoca, su suscripción vuelve a `ACTIVE`, no se le devuelve nada y se le dice qué día se le cobra.

Fuente: [ACC:1](../02-nucleo.md#acc-1) · [ACC:21](../02-nucleo.md#acc-21) · [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003)

<a id="us-b9b-3"></a>
**US:B9b:3**

Actor: anfitrión

Como anfitrión en cortesía, quiero que si pido pausar se me avise que pierdo lo que me queda, para
decidir sabiendo.

Fuente: [DEC-GRANT-004](../01-decisiones-vigentes.md#dec-grant-004) · [TRANS:B:S35](../04-catalogos.md#trans-b-s35)

### Criterios de aceptación

<a id="ac-b9b-1"></a>
**AC:B9b:1** — la composición: porcentuales primero, un redondeo al final

- **Dado** promos apilables vivas sobre una fila
- **Cuando** se compone el monto —quien muta (el canje, `S30`, el aumento) y quien compara (el
  barrido)—
- **Entonces** van **todos los porcentuales primero y después todos los fijos**, sin redondear en el
  medio, y el resultado **se redondea una sola vez, hacia abajo**, a la unidad mínima, con el mismo
  cálculo para los dos: **un 20 % y ARS 100 sobre ARS 1.000 dan 700 y nunca 720**; **un 15 % y un
  10 % apilados sobre ARS 9.999 mutan el preapproval a 7.649,23 y el barrido deriva lo mismo, sin
  marca**.

Fuente: [LISTA:B9b](#lista-b9b) · [LISTA:B9](../10-corte/B9a.md#lista-b9) · [FILA:B9b](#fila-b9b)

<a id="ac-b9b-2"></a>
**AC:B9b:2** — el piso del proveedor, al canjear

- **Dado** un canje —o un apilado con otra promo viva— cuyo monto compuesto cae bajo ARS 15
- **Cuando** la persona canjea
- **Entonces** el monto se valida contra el rango **antes** de mutar; el canje **se rechaza**, con el
  motivo en pantalla *«este código deja el importe por debajo del mínimo que Mercado Pago permite
  cobrar»* —el texto dice que el mínimo lo pone Mercado Pago, no nosotros—; y **el código no se
  consume**.

Fuente: [DEC-PROMO-001#📌1](../01-decisiones-vigentes.md#dec-promo-001-p1) · [DEC-PROMO-001#📌2](../01-decisiones-vigentes.md#dec-promo-001-p2) · [LISTA:B9](../10-corte/B9a.md#lista-b9)

<a id="ac-b9b-3"></a>
**AC:B9b:3** — cupo total, ventana de validez y un uso por persona

- **Dado** un código con su cupo total de canjes y su ventana de validez
- **Cuando** se canjea con el cupo agotado, fuera de la ventana, o por segunda vez por la misma
  persona
- **Entonces** se rechaza, y quien llega tarde ve **un error claro que dice que el código ya no está
  disponible**, no un silencio que se lea como que no existe; los dos campos tienen default.

Fuente: [DEC-PROMO-001](../01-decisiones-vigentes.md#dec-promo-001)

<a id="ac-b9b-4"></a>
**AC:B9b:4** — el contador baja sólo con un cobro que salió con el descuento

- **Dado** una promo de «primer cobro» canjeada después de creado el registro del ciclo
- **Cuando** ese ciclo cobra el precio entero
- **Entonces** la redención **sigue con `cobros_restantes = 1`**: el contador baja sólo con un cobro
  que salió con el descuento.

Fuente: [LISTA:B9b](#lista-b9b) · [FILA:B9](../10-corte/B9a.md#fila-b9)

<a id="ac-b9b-5"></a>
**AC:B9b:5** — `S30`: la promo que se agota, y su aviso

- **Dado** una fila en `ACTIVE` o `GRACE_PERIOD` con una redención cuyo contador `P1` deja en 0
- **Cuando** corre `S30`
- **Entonces** se muta `transaction_amount` al monto **sin esa promo**, recalculado con las que siguen
  vivas, y se verifica releyendo; si la mutación no se aplica, el barrido la reintenta 3 días desde
  esta transición y después abre `DIVERGENCIA_DE_MONTO`; si el contador llega a 0 con la fila
  `PAUSED`, `S30` no ocurre y ese mes sale con descuento, declarado; y **7 días antes** del último
  cobro con descuento (plazo 14, configurable) sale nuestro aviso *«tu promo termina»*, que anticipa
  el correo del proveedor.

Fuente: [TRANS:B:S30](../04-catalogos.md#trans-b-s30) · [TPZ:S30](#tpz-s30) · [PLAZO:14](../02-nucleo.md#plazo-14)

<a id="ac-b9b-6"></a>
**AC:B9b:6** — el canje de una extensión de trial con `extenderTrial`

- **Dado** un código de extensión de trial y una `claveDeCanje`
- **Cuando** billing llama a `extenderTrial` —contra el simulador del contrato mientras `V4` no esté
  integrada—
- **Entonces** **asienta el canje sólo con `ACEPTADA`**; con `RECHAZADA` el código queda intacto; y el
  reintento con la misma `claveDeCanje` después de un `ACEPTADA` **no extiende dos veces ni consume el
  código dos veces**.

Fuente: [DEP:10](../03-contrato-de-cobertura.md#dep-10) · [LISTA:B9](../10-corte/B9a.md#lista-b9)

<a id="ac-b9b-7"></a>
**AC:B9b:7** — otorgar una cortesía temporal (el primer disparador de `S9`)

- **Dado** una suscripción `ACTIVE` sin pausa vigente
- **Cuando** `SUPER_ADMIN` le otorga una cortesía temporal
- **Entonces** sólo se puede **en meses enteros y sobre un plan mensual** —sobre uno trimestral,
  semestral o anual la operación no está disponible y el admin ve el motivo y lo que le queda: la
  cortesía permanente o una promo sobre la renovación—; la cortesía no gasta la cuota de pausas del
  cliente, no depende de que el plan permita pausar y alcanza al pagador manual; se implementa
  **pausando en el proveedor** (`PAUSED · COURTESY`) y **el servicio lo sostenemos nosotros**; el
  `PUT paused` se confirma por relectura, y si no se aplicó la cortesía no ocurre, se pone
  `PAUSA_NO_APLICADA` y el aviso a `SUPER_ADMIN` lo dice. N meses saltean exactamente N cobros.

Fuente: [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003) · [DEC-GRANT-003#📌1](../01-decisiones-vigentes.md#dec-grant-003-p1) · [ACC:1](../02-nucleo.md#acc-1) · [TRANS:B:S9](../04-catalogos.md#trans-b-s9)

<a id="ac-b9b-8"></a>
**AC:B9b:8** — los tres cruces cortesía × pausa

- **Dado** una fila en cortesía (`PAUSED · COURTESY`), y otra en una pausa pedida por la persona
- **Cuando** `SUPER_ADMIN` le otorga otra cortesía a la primera (`S34`), la persona de la primera pide
  pausar (`S35`), y `SUPER_ADMIN` intenta otorgarle una cortesía a la segunda
- **Entonces** en `S34` **se suman meses**, no se reemplazan —a `courtesy_grant.fin` y a
  `subscription_pause.fin_previsto`—, al proveedor no se manda nada y el aviso dice la fecha de fin
  nueva; en `S35`, sólo después de que la persona confirmó el aviso de que **pierde la cortesía que le
  quedaba**, y con los términos de `puedePausar()` salvo el de estado (cupo y ciclo mensual), se
  cierra la pausa de la cortesía con `fin_real` hoy, se abre una nueva de la persona que sí cuenta
  contra los topes, al proveedor no se manda nada, y los complementos se pausan por `S32`; y la
  tercera **se bloquea**, avisando que la suscripción está pausada.

Fuente: [TRANS:B:S34](../04-catalogos.md#trans-b-s34) · [TPZ:S34](#tpz-s34) · [TRANS:B:S35](../04-catalogos.md#trans-b-s35) · [TPZ:S35](#tpz-s35) · [DEC-GRANT-004](../01-decisiones-vigentes.md#dec-grant-004) · [DEC-GRANT-004#📌1](../01-decisiones-vigentes.md#dec-grant-004-p1)

<a id="ac-b9b-9"></a>
**AC:B9b:9** — la acción 21 y su editor: crear o cerrar un código

- **Dado** `SUPER_ADMIN` en el editor de códigos del panel
- **Cuando** crea un código —su efecto, su alcance, sus usos y su vigencia— o cierra uno
- **Entonces** la confirmación dice el efecto, a quién alcanza y hasta cuándo; **cerrar un código
  rechaza el canje siguiente y no toca los ya canjeados**; y un admin que no es `SUPER_ADMIN` no
  puede ninguna de las dos.

Fuente: [ACC:21](../02-nucleo.md#acc-21) · [LISTA:B9b](#lista-b9b)

<a id="ac-b9b-10"></a>
**AC:B9b:10** — la cortesía temporal es una acción auditada que mueve plata

- **Dado** el catálogo administrativo
- **Cuando** `SUPER_ADMIN` otorga una cortesía temporal
- **Entonces** el acto exige su permiso, deja su auditoría por grant y pide confirmación explícita;
  re-emitir una cortesía diferida y cerrar su saldo **no** son filas de esta acción: son efectos de
  `S9` y de `S3`.

Fuente: [ACC:1](../02-nucleo.md#acc-1)

<a id="ac-b9b-11"></a>
**AC:B9b:11** — salida de la pieza (el *«Lista cuando»* de `B9b`)

- **Dado** `B9b` mergeada en la rama de la Fase 2, después de `B8b`
- **Cuando** se corre su juego y se cumple el gate de la fase
- **Entonces** se cumple **el criterio de `B9` sin las dos cláusulas de los grants**
  ([LISTA:B9](../10-corte/B9a.md#lista-b9), cláusulas 1, 2, 3, 5, 6, 8 y 9) —incluida **una cortesía
  de N meses re-emitida sobre una sucesora con crédito que saltea N cobros contados desde el fin del
  crédito**—; **y crear o cerrar un código desde el editor del panel funciona: cerrar un código
  rechaza el canje siguiente y no toca los ya canjeados**; **y revocar una cortesía temporal la
  termina en el acto por `S10`, con `fin_real` escrito y la relectura, sin reembolso, la suscripción
  vuelve a `ACTIVE` y el aviso dice qué día se le cobra** ([AC:B9b:13](#ac-b9b-13)); y la rama no
  trae migración estructural.

Fuente: [LISTA:B9b](#lista-b9b) · [FILA:B9b](#fila-b9b) · [GATE:FP.F2](../30-el-corte.md#gate-fp-f2)

<a id="ac-b9b-12"></a>
**AC:B9b:12** — lo que hay que decir en los actos de esta pieza (filas 7-bis, 13-ter y 13-quinquies)

- **Dado** las filas 7-bis y 13-ter del `B/19` §4, que van con su acto a esta pieza (BH; reparto por
  fila inferido en la fuente), y la 13-quinquies, que construye esta pieza (BO)
- **Cuando** la persona canjea una promo de «primer cobro» o de «N cobros», o `SUPER_ADMIN` otorga o
  revoca una cortesía temporal
- **Entonces** cada superficie dice lo que su fila exige (fila por fila, en la sección *UI web y
  admin, e i18n*): el canje dice cuántos cobros lleva el descuento, qué monto paga después y que va a
  recibir un correo del proveedor; otorgar dice que es en meses enteros y sólo sobre un plan mensual
  y, si ya hay una vigente, que se suman meses con la fecha de fin nueva; y la confirmación de revocar
  dice que pierde la cortesía que le quedaba, sin reembolso, que vuelve a `ACTIVE` y qué día se le va
  a cobrar.

Fuente: [PIEZA:B9b](#pieza-b9b) · [FILA:B9b](#fila-b9b) · [ACC:1](../02-nucleo.md#acc-1) · [OWN:41-corte-del-mvp:t7:BH](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-bh) · [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003)

<a id="ac-b9b-13"></a>
**AC:B9b:13** — revocar una cortesía temporal es el tercer evento de `S10`

- **Dado** una suscripción mensual en `PAUSED · COURTESY` por una cortesía temporal vigente
- **Cuando** `SUPER_ADMIN` la revoca (acción 1) y confirma
- **Entonces** corre **`S10` por su tercer evento** —reanudar antes del fin por un acto suyo, y no una
  transición propia—: se manda `PUT status=authorized`, y **confirmado por relectura** la fila vuelve
  a `ACTIVE`, con **`fin_real` escrito en el acto** en la `subscription_pause`, con los efectos de
  `S10` ([AC:B8b:3](B8b.md#ac-b8b-3)); **sin reembolso**; y **el mismo día va el aviso a la persona que dice
  qué día se le cobra** (fila 13-quinquies). **Si la relectura sigue viendo `paused`, `S10` no ocurre**:
  la fila se queda en `PAUSED` con la marca `REANUDACIÓN_NO_APLICADA`. El acto exige su permiso, deja
  su auditoría y pide confirmación explícita, porque mueve plata.

Fuente: [ACC:1](../02-nucleo.md#acc-1) · [TRANS:B:S10](../04-catalogos.md#trans-b-s10) · [TPZ:S10](B8b.md#tpz-s10) · [OWN:41-corte-del-mvp:t9:BO](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bo) · [DEC-ARCH-017#📌6](../01-decisiones-vigentes.md#dec-arch-017-p6) · [LISTA:B9b](#lista-b9b)

### El criterio de terminación

<a id="lista-b9b"></a>

#### LISTA:B9b — el *«Lista cuando»* de `B9b`

**El criterio de `B9` sin las dos cláusulas de los grants, que fueron a `B9a`** (corte del MVP,
owner 2026-10-01, Z); **y crear o cerrar un código desde el editor del panel: cerrar un código
rechaza el canje siguiente y no toca los ya canjeados** (§2.10; corte del MVP, owner 2026-10-01, BH);
**y revocar una cortesía temporal la termina en el acto por `S10`, con `fin_real` escrito y la
relectura, sin reembolso, la suscripción vuelve a `ACTIVE` y el aviso dice qué día se le cobra**
(corte del MVP, owner 2026-10-02, BO).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1055

## Reglas

- transiciones: [TRANS:B:S30](../04-catalogos.md#trans-b-s30),
  [TRANS:B:S34](../04-catalogos.md#trans-b-s34), [TRANS:B:S35](../04-catalogos.md#trans-b-s35), y el
  primer disparador de [TRANS:B:S9](../04-catalogos.md#trans-b-s9) (compartida con `B8b`);
- acciones: [ACC:1](../02-nucleo.md#acc-1), [ACC:21](../02-nucleo.md#acc-21);
- plazo: [PLAZO:14](../02-nucleo.md#plazo-14); dependencia entre épicas:
  [DEP:10](../03-contrato-de-cobertura.md#dep-10);
- decisiones: [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003) con su
  [📌1](../01-decisiones-vigentes.md#dec-grant-003-p1),
  [DEC-GRANT-004](../01-decisiones-vigentes.md#dec-grant-004) con su
  [📌1](../01-decisiones-vigentes.md#dec-grant-004-p1),
  [DEC-PROMO-001](../01-decisiones-vigentes.md#dec-promo-001) con sus
  [📌1](../01-decisiones-vigentes.md#dec-promo-001-p1) y
  [📌2](../01-decisiones-vigentes.md#dec-promo-001-p2);
- y lo que ejerce sin ser su dueña: la configuración y la acción 21 en la base,
  [DEC-ARCH-013](../01-decisiones-vigentes.md#dec-arch-013) y
  [DEC-ARCH-017#📌4](../01-decisiones-vigentes.md#dec-arch-017-p4) (BH); el permiso,
  [DEC-GRANT-002](../01-decisiones-vigentes.md#dec-grant-002); una cortesía por suscripción,
  [DEC-GRANT-006](../01-decisiones-vigentes.md#dec-grant-006); la re-emisión,
  [DEC-GRANT-007](../01-decisiones-vigentes.md#dec-grant-007) y
  [DEC-GRANT-007#📌1](../01-decisiones-vigentes.md#dec-grant-007-p1); el scope de las futuras,
  [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002); el contador,
  [DEC-RF-006#📌1](../01-decisiones-vigentes.md#dec-rf-006-p1); la acción 21 como escritura de su
  mitad, [DEC-RF-008#📌3](../01-decisiones-vigentes.md#dec-rf-008-p3); la autorización que cubre la
  cortesía, [INV:30](../02-nucleo.md#inv-30); la pausa con motivo, [INV:D3](../02-nucleo.md#inv-d3);
  los motivos [MOT:5](../04-catalogos.md#mot-5) y [MOT:12](../04-catalogos.md#mot-12); el piso del
  proveedor, [RP:RP3](../04-catalogos.md#rp-rp3); `P1`, que dispara `S30`,
  [TRANS:B:P1](../04-catalogos.md#trans-b-p1); y `T4`, que el canje llama,
  [TRANS:V:T4](../04-catalogos.md#trans-v-t4).

### Las transiciones de la Suscripción que construye esta pieza

<a id="tpz-s30"></a>
**TPZ:S30** — `S30` → `B9b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:857

<a id="tpz-s34"></a>
**TPZ:S34** — `S34` → `B9b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:861

<a id="tpz-s35"></a>
**TPZ:S35** — `S35` → `B9b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:862

## Modelo de datos y migraciones

**Sin migración estructural** ([FILA:B9b](#fila-b9b); [GATE:FP.3](../30-el-corte.md#gate-fp-3)): el
esquema de promos —códigos y redenciones— y de cortesías lo crea `B3` al corte
([ESQ:6](../10-corte/B3.md#esq-6), [ESQ:7](../10-corte/B3.md#esq-7)). Esta pieza **sólo agrega lo
que crea filas** (AS): códigos, redenciones con su `cobros_restantes`, `courtesy_grant` en meses y
las pausas de cortesía.

## API

El canje es una operación del dueño (tier `/api/v1/protected/*`); otorgar o revocar una cortesía
temporal y crear o cerrar un código son acciones del panel, sólo `SUPER_ADMIN` (tier
`/api/v1/admin/*`). El canje de extensión llama a `extenderTrial` del contrato. **Las rutas una por
una y sus códigos de error no los cierra la fuente** (`B/19`): los propone el PR de esta pieza
siguiendo lo escrito del repo, los aprueba la revisión de contexto fresco del momento 1 (y el owner
en el PR cuando es un permiso nuevo), y quedan escritos en esta sección al mergear
([BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).

## UI web y admin, e i18n

- **Admin**: el editor de códigos promocionales (acción 21, con su operación: BH).
- **Web**: el rechazo del canje bajo el piso con su texto literal ([AC:B9b:2](#ac-b9b-2)) y el aviso
  de pausar en cortesía ([AC:B9b:8](#ac-b9b-8); la fila 5, que va con el acto de pausar a
  [B8b](B8b.md#ac-b8b-25)).
- **Las filas del `B/19` §4 que avisan los actos de esta pieza** (BH; el reparto por fila lo infiere
  la fuente y lo marca), más la 13-quinquies, que construye esta pieza (BO) ([AC:B9b:12](#ac-b9b-12)):
  - **7-bis — al canjear una promo de «primer cobro» o de «N cobros»** (web): **cuántos cobros lleva
    el descuento, qué monto paga después**, y que cuando termine **va a recibir un correo del
    proveedor** diciendo que el vendedor cambió el monto. **En una promo de «primer cobro» este aviso
    es también el de *«tu promo termina»***: los dos se unifican, porque el último cobro con descuento
    es el primero; en una de «N cobros» ese correo sale aparte, 7 días antes del último cobro con
    descuento, configurable (plazo 14). **Al pagador manual el canje no se le ofrece**: no hay promos
    de monto para él; **la extensión de trial sí**. **Y si el canje —o el apilado con otra promo viva—
    deja el monto por debajo del piso del proveedor (ARS 15), se rechaza con el motivo en pantalla**:
    *«este código deja el importe por debajo del mínimo que Mercado Pago permite cobrar»* —el texto
    dice que ese mínimo lo pone Mercado Pago, no nosotros—, y el código **no se consume**
    ([AC:B9b:2](#ac-b9b-2)).
  - **13-ter — al otorgar una cortesía temporal** (admin): **que es en meses enteros y sólo sobre un
    plan mensual** —sobre una suscripción de plan no mensual (trimestral, semestral o anual) la
    operación **no está disponible**, y la pantalla lo dice con su motivo: en pausa el proveedor se
    saltea fechas de cobro enteras y al reanudar no corre la fecha, así que treinta días que cruzan la
    renovación de un anual regalan un año (y de un trimestral, tres meses)—. **Y qué le queda** al
    admin: la cortesía permanente o una promo sobre la renovación. **Si ya hay una cortesía vigente,
    que se suman meses**, con la **fecha de fin nueva** dicha (`S34`).
  - **13-quinquies — la confirmación de revocar una cortesía temporal** (acción 1, admin): que la
    persona **pierde la cortesía que le quedaba**, sin reembolso, que su suscripción vuelve a `ACTIVE`,
    y **qué día se le va a cobrar**; el mismo día va el aviso a la persona con esa fecha
    ([AC:B9b:13](#ac-b9b-13)).
- La confirmación dice qué va a pasar y no pregunta si estás seguro, y cada aviso lleva la fecha de
  ese cliente (`B/19` §4.1). El texto lo propone el PR de esta pieza y lo aprueba el owner en el PR,
  por ser texto al cliente (BS). Copy por `@repo/i18n`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:115, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:126, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:128

## Cron y outbox

- El aviso *«tu promo termina»*, 7 días antes del último cobro con descuento (plazo 14), por el outbox
  común.
- El reintento de 3 días de la mutación de `S30` lo hace el barrido de `B11`; esta pieza toma la
  comparación de monto con promos compuestas.

## Variables de entorno

N/A — los 7 días del aviso son el plazo 14 de la tabla versionada, no una variable de entorno
([PLAZO:14](../02-nucleo.md#plazo-14)).

## Auditoría y observabilidad

Otorgar o revocar una cortesía temporal y crear o cerrar un código son acciones del catálogo con su
auditoría ([ACC:1](../02-nucleo.md#acc-1), [ACC:21](../02-nucleo.md#acc-21)); la cortesía se audita
por grant. Revocar es destructiva: deja al cliente sin la cortesía que le quedaba, y por eso pide
confirmación explícita ([AC:B9b:13](#ac-b9b-13)).

## Seguridad

Sólo `SUPER_ADMIN` otorga una cortesía temporal y crea o cierra un código; el backend lo exige
aunque la UI oculte la operación (`B/19` §1).

## Testing esperado

| AC | tests | tipo |
|---|---|---|
| [AC:B9b:1](#ac-b9b-1) | [TEST:B9b:1](#test-b9b-1) | unitario |
| [AC:B9b:2](#ac-b9b-2) | [TEST:B9b:2](#test-b9b-2) | e2e web |
| [AC:B9b:3](#ac-b9b-3) | [TEST:B9b:3](#test-b9b-3) | integración con DB |
| [AC:B9b:4](#ac-b9b-4) | [TEST:B9b:4](#test-b9b-4) | integración con DB |
| [AC:B9b:5](#ac-b9b-5) | [TEST:B9b:5](#test-b9b-5) | integración con DB |
| [AC:B9b:6](#ac-b9b-6) | [TEST:B9b:6](#test-b9b-6) | integración con DB |
| [AC:B9b:7](#ac-b9b-7) | [TEST:B9b:7](#test-b9b-7) | integración con DB |
| [AC:B9b:8](#ac-b9b-8) | [TEST:B9b:8](#test-b9b-8) | integración con DB |
| [AC:B9b:9](#ac-b9b-9) | [TEST:B9b:9](#test-b9b-9) | e2e admin |
| [AC:B9b:10](#ac-b9b-10) | [TEST:B9b:10](#test-b9b-10) | ruta API |
| [AC:B9b:11](#ac-b9b-11) | [TEST:B9b:11](#test-b9b-11), [TEST:B9b:14](#test-b9b-14) | migración desde cero, integración con DB |
| [AC:B9b:12](#ac-b9b-12) | [TEST:B9b:12](#test-b9b-12), [TEST:B9b:13](#test-b9b-13) | e2e web, e2e admin |
| [AC:B9b:13](#ac-b9b-13) | [TEST:B9b:14](#test-b9b-14), [TEST:B9b:15](#test-b9b-15) | integración con DB, ruta API |

<a id="test-b9b-1"></a>
**TEST:B9b:1** — la composición determinista

Tipo: unitario

Cubre: [AC:B9b:1](#ac-b9b-1)

Fuente: [LISTA:B9b](#lista-b9b)

1.000 con 20 % y 100 da 700; 9.999 con 15 % y 10 % da 7.649,23 en la función que muta y en la que
compara; cambiar el orden de entrada no cambia el resultado.

<a id="test-b9b-2"></a>
**TEST:B9b:2** — el rechazo bajo el piso

Tipo: e2e web

Cubre: [AC:B9b:2](#ac-b9b-2)

Fuente: [DEC-PROMO-001#📌2](../01-decisiones-vigentes.md#dec-promo-001-p2) · [DEC-PROMO-001#📌1](../01-decisiones-vigentes.md#dec-promo-001-p1)

Un código que deja el monto en ARS 14 muestra el texto literal, el falso no recibe ninguna mutación
y el cupo del código no baja.

<a id="test-b9b-3"></a>
**TEST:B9b:3** — cupo, ventana y uso por persona

Tipo: integración con DB

Cubre: [AC:B9b:3](#ac-b9b-3)

Fuente: [DEC-PROMO-001](../01-decisiones-vigentes.md#dec-promo-001)

El canje número cupo + 1, uno fuera de fecha y un segundo canje de la misma persona se rechazan con
el error de *«ya no está disponible»* donde corresponde.

<a id="test-b9b-4"></a>
**TEST:B9b:4** — el contador con el registro ya creado

Tipo: integración con DB

Cubre: [AC:B9b:4](#ac-b9b-4)

Fuente: [LISTA:B9b](#lista-b9b)

Con el registro del ciclo creado en el falso antes del canje, el cobro de precio entero deja
`cobros_restantes = 1`.

<a id="test-b9b-5"></a>
**TEST:B9b:5** — `S30` y sus bordes

Tipo: integración con DB

Cubre: [AC:B9b:5](#ac-b9b-5)

Fuente: [TRANS:B:S30](../04-catalogos.md#trans-b-s30) · [PLAZO:14](../02-nucleo.md#plazo-14)

Con el último cobro con descuento, el falso recibe la mutación sin esa promo; con el falso sin
aplicarla, a los 3 días se abre la 5; sobre una `PAUSED` no corre; el aviso se encola 7 días antes.

<a id="test-b9b-6"></a>
**TEST:B9b:6** — `extenderTrial`, con su clave

Tipo: integración con DB

Cubre: [AC:B9b:6](#ac-b9b-6)

Fuente: [DEP:10](../03-contrato-de-cobertura.md#dep-10)

Con el simulador contestando `RECHAZADA`, el código no se consume; con `ACEPTADA`, se asienta una
vez, y el reintento con la misma clave no asienta ni consume de nuevo.

<a id="test-b9b-7"></a>
**TEST:B9b:7** — la cortesía temporal

Tipo: integración con DB

Cubre: [AC:B9b:7](#ac-b9b-7)

Fuente: [DEC-GRANT-003#📌1](../01-decisiones-vigentes.md#dec-grant-003-p1) · [TRANS:B:S9](../04-catalogos.md#trans-b-s9)

Sobre un mensual la fila queda `PAUSED · COURTESY` y la fuente `CORTESÍA` emite; sobre un anual se
rechaza con su motivo; sobre un pagador manual se otorga sin `PUT`; con el falso sin aplicar la
pausa, la fila sigue `ACTIVE` con la marca 22.

<a id="test-b9b-8"></a>
**TEST:B9b:8** — `S34`, `S35` y el bloqueo

Tipo: integración con DB

Cubre: [AC:B9b:8](#ac-b9b-8)

Fuente: [TRANS:B:S34](../04-catalogos.md#trans-b-s34) · [TRANS:B:S35](../04-catalogos.md#trans-b-s35) · [DEC-GRANT-004](../01-decisiones-vigentes.md#dec-grant-004)

Dos cortesías suman sus meses sin llamada al falso; pausar en cortesía sin confirmar el aviso no
cambia nada y confirmándolo deja una pausa nueva de la persona con la de la cortesía cerrada; otorgar
sobre una pausa de la persona se rechaza.

<a id="test-b9b-9"></a>
**TEST:B9b:9** — el editor de códigos

Tipo: e2e admin

Cubre: [AC:B9b:9](#ac-b9b-9)

Fuente: [ACC:21](../02-nucleo.md#acc-21) · [LISTA:B9b](#lista-b9b)

Crear un código muestra la confirmación con efecto, alcance y vigencia; cerrarlo hace fallar el canje
siguiente y deja intactas las redenciones previas.

<a id="test-b9b-10"></a>
**TEST:B9b:10** — permisos de las dos acciones

Tipo: ruta API

Cubre: [AC:B9b:10](#ac-b9b-10)

Fuente: [ACC:1](../02-nucleo.md#acc-1)

Sin `SUPER_ADMIN`, otorgar una cortesía y crear un código reciben el rechazo de permiso; con permiso,
cada uno deja su auditoría.

<a id="test-b9b-11"></a>
**TEST:B9b:11** — la rama sin migración estructural

Tipo: migración desde cero

Cubre: [AC:B9b:11](#ac-b9b-11)

Fuente: [FILA:B9b](#fila-b9b)

Sobre una base migrada sólo con las migraciones del corte, las tablas de promos y cortesías existen y
la suite de la pieza corre completa; la rama de la fase no agrega migración estructural.

<a id="test-b9b-12"></a>
**TEST:B9b:12** — el aviso del canje (fila 7-bis)

Tipo: e2e web

Cubre: [AC:B9b:12](#ac-b9b-12)

Fuente: [PIEZA:B9b](#pieza-b9b) · [DEC-PROMO-001](../01-decisiones-vigentes.md#dec-promo-001)

Canjear una promo de «N cobros» muestra cuántos cobros lleva el descuento, el monto de después y el
correo del proveedor que va a llegar; en una de «primer cobro» el mismo aviso dice que la promo
termina; a un pagador manual el canje de monto no se le ofrece.

<a id="test-b9b-13"></a>
**TEST:B9b:13** — las confirmaciones de otorgar y revocar una cortesía (filas 13-ter y 13-quinquies)

Tipo: e2e admin

Cubre: [AC:B9b:12](#ac-b9b-12)

Fuente: [ACC:1](../02-nucleo.md#acc-1) · [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003)

Sobre un anual la operación de otorgar aparece no disponible con su motivo y las dos alternativas;
sobre un mensual con una cortesía vigente la confirmación dice la fecha de fin nueva; y la
confirmación de revocar dice que pierde lo que le quedaba, sin reembolso, que vuelve a `ACTIVE` y el
día del cobro.

<a id="test-b9b-14"></a>
**TEST:B9b:14** — revocar corre `S10` por su tercer evento

Tipo: integración con DB

Cubre: [AC:B9b:13](#ac-b9b-13), [AC:B9b:11](#ac-b9b-11)

Fuente: [TRANS:B:S10](../04-catalogos.md#trans-b-s10) · [ACC:1](../02-nucleo.md#acc-1)

Sobre una `PAUSED · COURTESY`, revocar deja la fila `ACTIVE` con `fin_real` del día, ningún `refund`,
el aviso con la fecha del cobro encolado el mismo día y el falso con un `PUT status=authorized`; con el
falso devolviendo `paused` en la relectura, la fila sigue `PAUSED` con `REANUDACIÓN_NO_APLICADA`; y
no existe una transición distinta de `S10` para la revocación.

<a id="test-b9b-15"></a>
**TEST:B9b:15** — revocar exige su permiso

Tipo: ruta API

Cubre: [AC:B9b:13](#ac-b9b-13)

Fuente: [ACC:1](../02-nucleo.md#acc-1)

Sin `SUPER_ADMIN`, revocar una cortesía recibe el rechazo de permiso y la fila queda igual; con
permiso, el acto deja su registro de auditoría.

## Smoke y etiquetas

Sin etiquetas en la pieza ([GATE:M1](../30-el-corte.md#gate-m1)). Lo manual de la fase —el correo
del proveedor al mutar un monto (`CT-3`), al pausar por una cortesía y al reanudar por una
revocación— entra en la extensión del checklist de la Fase 2
([GATE:FP.2](../30-el-corte.md#gate-fp-2)); quién la escribe, ver
[abiertos](../_trabajo/abiertos/g9-b8-b13.md).

## Dependencias, rollback y despliegue

- **Espera a** [B8b](B8b.md#pieza-b8b) (`B8b → B9b`) y a [B9a](../10-corte/B9a.md#pieza-b9a)
  (`B9a → B9b`); integra `extenderTrial` de `V4` ([DEP:10](../03-contrato-de-cobertura.md#dep-10)).
- **La espera** [B10](../20-fase-3/B10.md#pieza-b10) (`B9b → B10`).
- **Despliegue**: rama épica de la Fase 2, con el gate de arriba.
- **Rollback**: la fuente no fija uno por pieza.

## Labels de Linear

Pasa a `Done` al mergearse en la rama de su fase; sin etiquetas `status-needs-smoke-*`
([GATE:M1](../30-el-corte.md#gate-m1)).

## Abiertos

- «Quién escribe la extensión del checklist de cada fase», en
  [abiertos de g9](../_trabajo/abiertos/g9-b8-b13.md). La revocación de una cortesía la cerró BO; las
  filas del `B/19` §4, BH (el reparto por fila, inferido en la fuente); las rutas, los códigos y los
  textos, BS.

## Origen

`B/descomposicion.md` §2 (fila `B9b`), §2.6 (fila 10), §2.10, §2.12 y §4 (fila `B9b`); `B/14` §1 a
§4; `B/03` §3.2 (`S9`, `S10` por su tercer evento, `S30`, `S34`, `S35`); `B/19` §4 (filas 7-bis,
13-ter y 13-quinquies) y §4.1; `NUCLEO/08` §3 (acciones 1 y 21); `NUCLEO/02` §1.5 (plazo 14);
`01-decision-log.md`; `D/16` §4.7; `41-corte-del-mvp/10-decisiones-del-owner.md` (Z, AS, BG, BH, BO,
BS).
