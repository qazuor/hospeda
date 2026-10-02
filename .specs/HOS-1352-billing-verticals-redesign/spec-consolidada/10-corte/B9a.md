# B9a · Los grants

Pieza del corte. Mitad *a* de la unidad `B9` («Las concesiones»), partida por el owner en el corte
del MVP (Z): los grants, su fuente con su `piso`, el piso del ancla, `S13`, `S20` (AS), la fuente
`CORTESÍA` real (AQ) y la herramienta del paso 3b.

## Objetivo, alcance y fuera de alcance

<a id="pieza-b9a"></a>

### PIEZA:B9a — en la lista de piezas

| pieza | unidad | cuándo | fuente |
|---|---|---|---|
| `B9a` | `B9` | corte | Z; la fuente `CORTESÍA` (AQ) y `S20` (AS); el esquema de promos y cortesías pasa a `B3` (BG) |

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:959, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:742

<a id="fila-b9"></a>

### FILA:B9 — la fila de origen (`B9`, «Las concesiones»)

`B9` está **partida en `B9a`, al corte, y `B9b`, después** (corte del MVP, owner 2026-10-01, Z).
Llama a la pasarela (⛔). Lo que deja funcionando, entre las dos mitades:

- promos, cortesías y grants componen de forma determinista y se enchufan como fuentes;
- **`S20` no es de acá**: el grant cancela la principal (`S13`) y el complemento lo apaga **B10**,
  que llega después en el camino crítico y es donde vive el modelo del addon. *(Esta frase de la
  fuente no está tachada, pero la superaron AS —`S20` pasa a `B9a`— y AV —el modelo del addon lo
  crea `B3`—, que la fila de [B9a](#fila-b9a) y la de `B10` ya recogen; se conserva por ser la letra
  de la fila y se reporta como resto de fuente.)*
- **desde la FASE 9 completa**: un canje o un apilado que deja el monto **bajo el piso del proveedor
  se rechaza al canjear**, con el motivo en pantalla (owner 2026-09-25, 4b y 9g);
- **los dos cruces cortesía × pausa tienen fila**, `S34` (cortesía sobre cortesía) y `S35` (la
  persona pausa sobre una cortesía);
- **cada fuente `GRANT` lleva su `piso` por la firma** (9h);
- **la escritura de los dos `permanent_grant` del corte** (`21` §2.4; paso 3b de `D/16` §4.2),
  anclados al vendible de `rank` más alto **de Alojamiento, en la vertical en que tenían `comp`**
  (FASE 9 vuelta 1, `F-8V1C2-004`; owner 2026-09-26, `G1-3`; revertido por el owner el 2026-09-27,
  FASE 9 vuelta 2, `R11-3b`: las dos `comp` son suyas y de Alojamiento);
- **anclar una vertical nueva a un grant emite el aviso de cobertura, igual que otorgarlo y
  revocarlo** (contrato §3, *«quién emite»*; FASE 9 vuelta 2, `F-8V2C1-003`);
- **el piso de todo ancla —al otorgar, al anclar y en el corte— es la versión que trae el acto,
  aceptada sólo si `políticaDePlan(v).vigente`**: billing no resuelve la vigente ni ordena por
  `rank` (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`);
- **la cortesía diferida que `S9` re-emite sobre una sucesora con crédito arranca al agotarse el
  crédito** (FASE 9 vuelta 2, owner 2026-09-27, `R17`);
- **el monto compuesto se redondea una sola vez, hacia abajo, con el mismo cálculo para quien muta y
  para quien compara** (`14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`);
- **el contador de una promo baja sólo con un cobro que salió con el descuento** (`14` §2.4, `03`
  `P1`; owner 2026-09-27, FASE 9 vuelta 2, `R20`).

Capítulos: `14` entero · `21` §2.4 (los grants del corte) · `03` S9, S13, **S30**, **S34**, **S35** ·
`02` §2.4 · `05` C3 · **`09` §3** (la comparación de monto) (orquestador, FASE 8 completa, pendiente
8). Guards: ninguno.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:145

Las secciones de el capítulo `14`, entero, que la columna de capítulos de la fila le asigna:

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:34, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:46, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:66, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:99, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:101, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:122, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:209, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:234, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:337, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:350, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:352, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:357, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:374, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:385, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:393, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:395, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:401, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:416, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:454, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:502, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:545, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:613, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:645, .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:685

<a id="fila-b9a"></a>

### FILA:B9a — «Los grants»

Llama a la pasarela (⛔). Deja funcionando **los grants, su fuente con su `piso`, el piso del ancla
leído con `políticaDePlan(v).vigente`, `S13`, y la herramienta del paso 3b que escribe los dos
`permanent_grant` del corte** (corte del MVP, owner 2026-10-01, Z; `41-corte-del-mvp/00-propuesta.md`
§1: *«el paso 3b escribe los dos `permanent_grant` con la herramienta de `B9`»*); **y la fuente
`CORTESÍA` real, junto con la de `GRANT`, contestando sobre la tabla vacía hasta `B9b`** (corte del
MVP, owner 2026-10-01, AQ); el esquema de promos y cortesías pasa a `B3` (corte del MVP, owner
2026-10-01, BG); **y `S20`, que corre en el mismo acto que `S13`, con el cierre del saldo de una
cortesía diferida (`DEC-GRANT-013`), enteros sobre el esquema vacío** (AS).

Capítulos: `14` (los grants) · `21` §2.4 · `03` S13, **S20** · `02` §2.4 · **`05` C3** (sobre `S13`:
corte del MVP, owner 2026-10-01, Z) · **`09` §3** (la tercera comprobación, motivo 10,
`FAN_OUT_DE_GRANT_INCOMPLETO`, que sirve a `S13` y `S20`: corte del MVP, owner 2026-10-01, AS).
*(Inferido por la fuente, que lo marca: el precedente de la fila de `B7` —las unidades «toman las
comprobaciones del `09` §3 que sirven a sus transiciones»— leído con `S13` y `S20` en `B9a` (Z y AS)
y `A5` en `B5` (AV); y `B11` ya tiene `09` entero.)* Guards: ninguno.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:146

**Fuera de alcance** (y dónde vive): promos, cortesías, `S9`, `S30`, `S34`, `S35`, el canje con
`extenderTrial` y la acción 21, en [B9b](../20-fase-2/B9b.md#pieza-b9b); el esquema de promos y
cortesías, en [B3](B3.md#pieza-b3) (BG); las confirmaciones de revocar y de anclar (filas 13 y 13-bis
del `B/19` §4), en [B13a](B13a.md#pieza-b13a) (BH); el permiso «sólo `SUPER_ADMIN`», en
[V5](V5.md#pieza-v5); la orfandad que apaga los addons al revocar (`A5`), en [B5](B5.md#pieza-b5).

## Historias de usuario y criterios de aceptación

### Historias de usuario

<a id="us-b9a-1"></a>
**US:B9a:1**

Actor: admin

Como `SUPER_ADMIN`, quiero otorgar un *Free Forever* —o anclarle una vertical nueva a uno vivo— y que
en el mismo acto deje de cobrarse lo que el grant cubre, sin reembolso, para que el beneficiario no
pague nunca más algo que le regalamos.

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001) · [ACC:2](../02-nucleo.md#acc-2)

<a id="us-b9a-2"></a>
**US:B9a:2**

Actor: admin

Como `SUPER_ADMIN`, quiero revocar un grant dejando escrito por qué, sabiendo que no se repara nada,
para que el acto sea defendible seis meses después.

Fuente: [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009)

<a id="us-b9a-3"></a>
**US:B9a:3**

Actor: anfitrión

Como anfitrión con un *Free Forever* que incluye addons, quiero que los addons compatibles que ya
venía pagando pasen a costo $0, para no pagar todos los meses algo declarado gratis.

Fuente: [TRANS:B:S20](../04-catalogos.md#trans-b-s20) · [INV:28](../02-nucleo.md#inv-28)

<a id="us-b9a-4"></a>
**US:B9a:4**

Actor: sistema/cron

Como sistema, quiero que la herramienta del paso 3b escriba los dos `permanent_grant` del corte una
sola vez aunque se corra dos veces, para que las dos cuentas de cortesía del owner queden cubiertas.

Fuente: [PASO:3b](../30-el-corte.md#paso-3b) · [FILA:B9a](#fila-b9a)

### Criterios de aceptación

<a id="ac-b9a-1"></a>
**AC:B9a:1** — otorgar un grant corta el cobro en el acto (`S13`)

- **Dado** un beneficiario con filas vivas PRINCIPALES en una vertical —en cualquiera de los seis
  estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos—
- **Cuando** `SUPER_ADMIN` le otorga un *Free Forever* con un ancla en esa vertical
- **Entonces** cada una de esas filas pasa a `CANCELLED` y **se cancela su preapproval** en el
  proveedor —autorizado o esperando autorización— con la regla de `S17` (si la relectura dice que ya
  está `cancelled`, no se manda nada) y con **nuestro correo antes de cada llamada** (falla
  transitoria: esa cancelación no se ejecuta en esta corrida y se reintenta; sin destinatario: se
  cancela igual y se escala); **sin reembolso** del período ya cobrado; el acceso pasa a darlo el
  grant; una fila que retenía un pago pendiente por `S19` **apaga la bandera en el mismo acto, sin
  reembolso**; una fila `PAUSED` cierra su pausa con `fin_real`; las filas de complemento **no
  entran**. El proceso es **idempotente y reanudable fila por fila**.

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [TPZ:S13](#tpz-s13) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001) · [ACC:2](../02-nucleo.md#acc-2)

<a id="ac-b9a-2"></a>
**AC:B9a:2** — anclar una vertical nueva es el mismo acto, y los tres emiten el aviso de cobertura

- **Dado** un grant vivo sin ancla en la vertical V y un beneficiario que paga en V
- **Cuando** `SUPER_ADMIN` le ancla V con un plan de V y un piso de ese mismo plan
- **Entonces** corre `S13` sobre las principales vivas de V, como al otorgar; y **otorgar, anclar y
  revocar emiten el aviso de cobertura**. Una vertical **sin ancla no recibe nada**: el grant no
  emite fuente donde no ancló, y extenderlo es anclar (desanclar no está declarado).

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [FILA:B9](#fila-b9) · [ACC:2](../02-nucleo.md#acc-2) · [INV:29](../02-nucleo.md#inv-29)

<a id="ac-b9a-3"></a>
**AC:B9a:3** — otorgar cierra el saldo de una cortesía diferida (sembrada)

- **Dado** un beneficiario con una `courtesy_grant` sembrada con `saldo_meses` no nulo y sin cerrar,
  en una vertical que el acto ancla (AS)
- **Cuando** se otorga el grant o se ancla esa vertical
- **Entonces** `S13` cierra el saldo con `saldo_cerrado_en` y `motivo_cierre =
  GRANT_PERMANENTE_OTORGADO`; esos meses no vuelven, tampoco si el grant se revoca después; y escribir
  un cierre ya escrito **no escribe nada**.

Fuente: [DEC-GRANT-013](../01-decisiones-vigentes.md#dec-grant-013) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [FILA:B9a](#fila-b9a)

<a id="ac-b9a-4"></a>
**AC:B9a:4** — `S20` convierte a $0 los complementos compatibles, en ese orden (sembrado)

- **Dado** un beneficiario con filas DE COMPLEMENTO sembradas (AS) en cualquiera de los seis estados
  de la suscripción, con su instancia en uno de sus dos estados vivos y su `addon_product` compatible
  con la vertical que el acto ancla —y, para `VERTICAL_SUBSCRIPTION` y `LISTING`, con el objetivo en
  esa vertical—, una de ellas con la instancia en `PENDING_AUTHORIZATION` y otra `PAUSED` por `S32`
- **Cuando** se otorga, o se ancla, un grant con **`includesAddons: true`**
- **Entonces** en cada fila, **primero la instancia**: una `ACTIVE` sigue `ACTIVE` y pasa a colgar
  del **ancla** como su título; una `PENDING_AUTHORIZATION` no se convierte, muere por `A3` al vencer
  su ventana y la pantalla de *«esperando que completes el pago»* deja de ofrecer el enlace en el
  acto; **después el cobro**: se cancela el preapproval con la regla de `S17` y el correo antes, y la
  fila de complemento llega a `CANCELLED`; **sin reembolso**; la fila `PAUSED` por `S32` cierra la
  pausa con `fin_real`. El proceso es **reanudable fila por fila bajo ese orden**. **Con
  `includesAddons: false`, `S20` no corre** y el complemento sigue cobrando. La fuente sigue
  transportando `addon_instance.addon_version_id`: convertir a $0 no es volver a comprar.

Fuente: [TRANS:B:S20](../04-catalogos.md#trans-b-s20) · [TPZ:S20](#tpz-s20) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003) · [INV:28](../02-nucleo.md#inv-28)

<a id="ac-b9a-5"></a>
**AC:B9a:5** — lo que el grant no hace con los addons

- **Dado** un beneficiario sin ningún addon comprado, y otro con un addon cuyo producto **no** declara
  compatible la vertical anclada
- **Cuando** se le otorga un grant con `includesAddons: true`
- **Entonces** al primero **no se le enciende ningún addon**: no nace ninguna instancia (lo único
  automático de `S20` es el fin de un cobro); y el segundo **sigue cobrándose**, porque el grant es
  título sólo donde ancló.

Fuente: [INV:27](../02-nucleo.md#inv-27) · [INV:28](../02-nucleo.md#inv-28) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003)

<a id="ac-b9a-6"></a>
**AC:B9a:6** — la fuga del `USER`/`GLOBAL` se deja

- **Dado** un addon sembrado de scope `USER` o `GLOBAL` cuyo producto declara compatibles dos
  verticales, en un beneficiario cuyo grant ancla una sola
- **Cuando** se otorga el grant con `includesAddons: true`
- **Entonces** `S20` lo convierte a $0 y queda gratis **también en la vertical que el grant no
  ancló**; no se relee el producto ni se le pide al grant anclar las dos; y la conversión se apaga
  con el grant al revocarlo (`A5`, de `B5`).

Fuente: [DEC-ADDON-005](../01-decisiones-vigentes.md#dec-addon-005) · [TRANS:B:S20](../04-catalogos.md#trans-b-s20)

<a id="ac-b9a-7"></a>
**AC:B9a:7** — revocar: se guarda el motivo y no se repara nada

- **Dado** un grant vivo que convirtió addons a $0 y cuyo beneficiario consumió su trial al recibirlo
- **Cuando** `SUPER_ADMIN` lo revoca
- **Entonces** se escriben **juntas** las tres columnas de la revocación —`revocado_en`, quién la
  firmó y `motivo_de_revocación` en texto libre— y ninguna se escribe sola; **no se borra ninguna
  fila**, ni el grant ni sus anclas; el beneficiario queda **sin grant y sin suscripción** y **no se
  reanuda el débito viejo**; los addons que el grant había pasado a $0 **se apagan y no vuelven
  solos**; **el trial no vuelve**: no hay transición de vuelta; y la confirmación del acto declara
  las tres cosas (la pantalla es de [B13a](B13a.md#ac-b13a-6)).

Fuente: [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001) · [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003) · [ACC:2](../02-nucleo.md#acc-2)

<a id="ac-b9a-8"></a>
**AC:B9a:8** — a lo sumo un grant vivo por beneficiario, por la base

- **Dado** un beneficiario con un grant vivo y otros dos revocados
- **Cuando** se intenta escribir un segundo grant vivo para el mismo beneficiario
- **Entonces** **la base lo rechaza** por el `UNIQUE(beneficiario) WHERE revocado_en IS NULL`; los
  revocados no cuentan; y un grant sin ningún ancla no otorga nada.

Fuente: [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009)

<a id="ac-b9a-9"></a>
**AC:B9a:9** — sólo `SUPER_ADMIN`, en las tres escrituras

- **Dado** un admin que no es `SUPER_ADMIN`
- **Cuando** intenta otorgar, anclar una vertical nueva o revocar un grant
- **Entonces** la operación se rechaza en el backend en los tres casos, y no se escribe nada; la misma
  autorización cubre las tres escrituras sobre el instrumento.

Fuente: [INV:30](../02-nucleo.md#inv-30) · [ACC:2](../02-nucleo.md#acc-2)

<a id="ac-b9a-10"></a>
**AC:B9a:10** — el scope: parcial, global, y *«todas las futuras»* sin tope

- **Dado** un grant con anclas en una, en varias o en todas las verticales actuales
- **Cuando** se crea una vertical nueva
- **Entonces** el grant **no emite fuente** en ella hasta que `SUPER_ADMIN` le ancle un plan —un acto
  del catálogo, auditado, que dispara `S13`—; y ningún grant lleva vencimiento ni tope de verticales
  obligatorio.

Fuente: [INV:29](../02-nucleo.md#inv-29) · [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002)

<a id="ac-b9a-11"></a>
**AC:B9a:11** — el piso del ancla, validado con `políticaDePlan(v).vigente`

- **Dado** un acto —otorgar, anclar o la herramienta del 3b— que trae una versión de piso
- **Cuando** `políticaDePlan(v).vigente` para esa versión es falso (contra el simulador del contrato
  mientras `V2` no esté integrada)
- **Entonces** el acto **se rechaza y no escribe ninguna fila**; billing no resuelve la vigente ni
  ordena por `rank`; con `vigente` verdadero, el piso queda escrito como referencia a esa versión del
  plan del ancla, nunca como copia de sus valores.

Fuente: [DEP:12](../03-contrato-de-cobertura.md#dep-12) · [LISTA:B9a](#lista-b9a) · [FILA:B9](#fila-b9)

<a id="ac-b9a-12"></a>
**AC:B9a:12** — las fuentes `GRANT` y `CORTESÍA` reales

- **Dado** `B4` mergeada, con la fuente `ADDON` y las de arranque del contrato
- **Cuando** `B9a` agrega la fuente `GRANT` y la `CORTESÍA` real
- **Entonces** **no se toca una línea de lo que dejó `B4`**; **cada `GRANT` sale con su `piso`**; y la
  fuente `CORTESÍA` contesta **desde los datos sobre la tabla vacía** —sin cortesías, no emite
  nada— y su caso del juego de la real pasa sobre una fila sembrada.

Fuente: [LISTA:B9a](#lista-b9a) · [FILA:B9a](#fila-b9a)

<a id="ac-b9a-13"></a>
**AC:B9a:13** — un cobro que entra después del grant (`05` C3)

- **Dado** una suscripción que `S13` canceló al otorgar
- **Cuando** se acredita un cobro posterior —uno o varios ciclos, si la cancelación sigue sin
  confirmarse—
- **Entonces** `S14` pone la marca con motivo `COBRO_POSTERIOR_AL_GRANT` con el cobro colgado y, si
  ya hay una abierta con ese motivo, los siguientes cuelgan de **ésa**; el barrido reintenta la
  cancelación 3 días y después abre `CANCELACIÓN_SIN_CONFIRMAR`; el grant no espera al cobro.

Fuente: [LOCK:C3](../04-catalogos.md#lock-c3) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13)

<a id="ac-b9a-14"></a>
**AC:B9a:14** — la tercera comprobación del barrido: el fan-out incompleto

- **Dado** un otorgamiento cuyo `S13` o `S20` quedó a medias —una fila cubierta por un ancla viva
  sigue viva o su complemento sigue cobrando—
- **Cuando** corre la tercera comprobación del `B/09` §3, que toma esta pieza
- **Entonces** se abre la marca con motivo `FAN_OUT_DE_GRANT_INCOMPLETO` y la acción es reanudar
  `S13`/`S20`, que es idempotente y reanudable fila por fila.

Fuente: [MOT:10](../04-catalogos.md#mot-10) · [FILA:B9a](#fila-b9a) · [TRANS:B:S13](../04-catalogos.md#trans-b-s13)

<a id="ac-b9a-15"></a>
**AC:B9a:15** — la herramienta del paso 3b

- **Dado** la base del corte, después de que el script escribió las cinco pruebas
- **Cuando** quien opera el corte corre la herramienta de `B9a` con la versión que elige
- **Entonces** escribe los **dos** `permanent_grant` de las cortesías del owner, **anclados al vendible
  de `rank` más alto de Alojamiento, en la vertical en que tenían `comp`**, con esa versión aceptada
  sólo si `políticaDePlan(v).vigente`; el grant convierte las dos pruebas del corte de esas cuentas;
  y **correrla dos veces da lo mismo**: saltea el `permanent_grant` ya escrito para ese beneficiario y
  esa vertical y no escribe un segundo.

Fuente: [PASO:3b](../30-el-corte.md#paso-3b) · [FILA:B9a](#fila-b9a) · [FILA:B9](#fila-b9)

<a id="ac-b9a-16"></a>
**AC:B9a:16** — salida de la pieza (el *«Lista cuando»* de `B9a` y lo que toma de `B9`)

- **Dado** `B9a` mergeada en la rama del paraguas, con `B4` y `B8a` adentro
- **Cuando** se corre su juego sobre una base creada desde cero, con filas sembradas para lo que sólo
  existe después (AS)
- **Entonces** **agregar el grant como fuente no toca una línea de lo que dejó `B4`, y cada `GRANT`
  sale con su `piso`** (9h); **otorgar o anclar un grant con una versión de piso que `políticaDePlan`
  no da por vigente se rechaza y no escribe ninguna fila** (`F-8V2C1-004`); **y la fuente `CORTESÍA`
  real contesta desde los datos sobre la tabla vacía, con su caso en el juego de la real sobre una
  fila sembrada** (AQ). Las cláusulas de `B9` que no son de los grants se demuestran en
  [B9b](../20-fase-2/B9b.md#lista-b9b).

Fuente: [LISTA:B9a](#lista-b9a) · [LISTA:B9](#lista-b9) · [FILA:B9a](#fila-b9a) · [FILA:B9](#fila-b9)

### Los criterios de terminación de origen

<a id="lista-b9"></a>

#### LISTA:B9 — el criterio de `B9`, en su forma vigente (partido: ver `B9a` y `B9b`)

1. un 20 % y ARS 100 sobre ARS 1.000 dan **700 y nunca 720**;
2. un descuento que deja el monto bajo ARS 15 **se rechaza al canjear, con el motivo en pantalla que
   dice que el mínimo lo pone Mercado Pago, y el código no se consume** (owner 2026-09-25, 4b y 9g;
   `14` §1.3);
3. **una cortesía sobre una `PAUSED · COURTESY` suma meses sin cambiar de estado** (`S34`) y
   **pausar sobre una cortesía la cambia a `CUSTOMER_REQUEST` sólo después de avisar lo que se
   pierde** (`S35`);
4. agregar cortesía y grant como fuentes **no toca una línea** de lo que dejó B4 —**y cada `GRANT`
   sale con su `piso`** (9h)—;
5. **con `extenderTrial` → `RECHAZADA` el código de canje queda intacto, y el reintento con la misma
   `claveDeCanje` después de un `ACEPTADA` no extiende dos veces ni consume el código dos veces**
   (contrato §4.1; FASE 9 vuelta 1, `N-G4V-08`; la mitad de verticales está en el criterio de `V4`);
6. **una cortesía de N meses re-emitida sobre una sucesora con crédito saltea N cobros contados
   desde el fin del crédito** (FASE 9 vuelta 2, owner 2026-09-27, `R17`);
7. **otorgar o anclar un grant con una versión de piso que `políticaDePlan` no da por vigente se
   rechaza y no escribe ninguna fila** (contrato §2.8; FASE 9 vuelta 2, `F-8V2C1-004`);
8. **un 15 % y un 10 % apilados sobre ARS 9.999 mutan el preapproval a 7.649,23 y el barrido deriva
   lo mismo, sin marca** (`14` §1.2; FASE 9 vuelta 2, `F-8V2B3-008`);
9. **una promo de «primer cobro» canjeada después de creado el registro del ciclo, que cobra el
   precio entero, sigue con `cobros_restantes = 1`** (`14` §2.4; FASE 9 vuelta 2, `R20`).

Las cláusulas 4 (la mitad del grant) y 7 son de `B9a`; las demás, de
[B9b](../20-fase-2/B9b.md#lista-b9b).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1024

<a id="lista-b9a"></a>

#### LISTA:B9a — el *«Lista cuando»* de `B9a`

De las cláusulas de `B9`, las de los grants: **agregar el grant como fuente no toca una línea de lo
que dejó `B4`, y cada `GRANT` sale con su `piso`** (9h); **y otorgar o anclar un grant con una
versión de piso que `políticaDePlan` no da por vigente se rechaza y no escribe ninguna fila**
(`F-8V2C1-004`) (corte del MVP, owner 2026-10-01, Z); **y la fuente `CORTESÍA` real contesta desde
los datos sobre la tabla vacía, con su caso en el juego de la real sobre una fila sembrada** (corte
del MVP, owner 2026-10-01, AQ). *(Lo sembrado, con el mismo precedente que la fuente `ADDON` en
`B4`; la fuente lo marca.)*

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1025

## Reglas

- transiciones: [TRANS:B:S13](../04-catalogos.md#trans-b-s13),
  [TRANS:B:S20](../04-catalogos.md#trans-b-s20);
- candado: [LOCK:C3](../04-catalogos.md#lock-c3) (sobre `S13`; pasa de `B9b` a esta pieza, Z);
- motivo: [MOT:10](../04-catalogos.md#mot-10), y el 3, que abre `S14` desde `C3`,
  [MOT:3](../04-catalogos.md#mot-3) (dueña `B11`; esta pieza lo ejerce);
- invariantes: [INV:27](../02-nucleo.md#inv-27), [INV:28](../02-nucleo.md#inv-28),
  [INV:29](../02-nucleo.md#inv-29), [INV:30](../02-nucleo.md#inv-30); y el ancla por vertical de
  [INV:10](../02-nucleo.md#inv-10) (dueña `V5`);
- decisiones: [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001),
  [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008),
  [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009),
  [DEC-GRANT-013](../01-decisiones-vigentes.md#dec-grant-013),
  [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003),
  [DEC-ADDON-005](../01-decisiones-vigentes.md#dec-addon-005),
  [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002),
  [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009);
- y las que ejerce sin ser su dueña («también» y «provee»): el grant anclado con su fuente y su piso,
  [DEC-GRANT-005](../01-decisiones-vigentes.md#dec-grant-005) y
  [DEC-ARCH-006#📌3](../01-decisiones-vigentes.md#dec-arch-006-p3); el permiso,
  [DEC-GRANT-002](../01-decisiones-vigentes.md#dec-grant-002); la cortesía una por suscripción y su
  cierre, [DEC-GRANT-006](../01-decisiones-vigentes.md#dec-grant-006) y
  [DEC-GRANT-014](../01-decisiones-vigentes.md#dec-grant-014); la revocación que dispara la orfandad,
  [DEC-ADDON-006](../01-decisiones-vigentes.md#dec-addon-006); los grants del 3b,
  [DEC-MIG-003](../01-decisiones-vigentes.md#dec-mig-003),
  [DEC-MIG-003#📌2](../01-decisiones-vigentes.md#dec-mig-003-p2),
  [DEC-MIG-006](../01-decisiones-vigentes.md#dec-mig-006) y
  [DEC-MIG-006#📌2](../01-decisiones-vigentes.md#dec-mig-006-p2); la fuente `CORTESÍA` que
  [ACC:1](../02-nucleo.md#acc-1) y [DEC-GRANT-003](../01-decisiones-vigentes.md#dec-grant-003)
  necesitan; y la partición, [DEC-ARCH-017#📌1](../01-decisiones-vigentes.md#dec-arch-017-p1) (AQ, AS).

### Las transiciones de la Suscripción que construye esta pieza

<a id="tpz-s13"></a>
**TPZ:S13** — `S13` → `B9a`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:815

<a id="tpz-s20"></a>
**TPZ:S20** — `S20` → `B9a` (AS).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:822

## Modelo de datos y migraciones

- **`permanent_grant` y `permanent_grant_vertical`** (`B/02` §2.4), que esta pieza crea por ser la
  dueña de los grants y tener `02` §2.4 entre sus capítulos *(inferido de la fila: el §4.6 de `D/16`
  lista sólo el esquema de lo posterior)*: el grant con beneficiario, `includesAddons`, firmante,
  motivo, suscripciones afectadas y las **tres columnas de la revocación**, que van juntas
  ([DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008)); **`UNIQUE(beneficiario) WHERE
  revocado_en IS NULL`** ([DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009)); el ancla con
  `UNIQUE(permanent_grant_id, vertical)`, el plan no anulable con FK compuesta sobre
  `plan(id, vertical)` y el piso no anulable con FK compuesta sobre `plan_version(id, plan_id)`.
  Carril: migración estructural de la rama, antes del corte (AD).
- **Lee, sin crearlas**: cortesías (`courtesy_grant`, con `saldo_meses`, `saldo_cerrado_en` y
  `motivo_cierre`), creadas por `B3` (BG); y el título de `addon_instance`, de `B3` (AV).

## API

Las tres escrituras sobre el instrumento —otorgar, anclar una vertical nueva y revocar— son la fila
del grant permanente del catálogo administrativo ([ACC:2](../02-nucleo.md#acc-2)): tier admin, sólo
`SUPER_ADMIN` ([INV:30](../02-nucleo.md#inv-30)), confirmación explícita. El rechazo por piso no
vigente no escribe nada ([AC:B9a:11](#ac-b9a-11)). **Las rutas una por una y los códigos de error no
los cierra la fuente** (`B/19`, *«Lo que este capítulo NO cierra»*): ver
[abiertos](../_trabajo/abiertos/g9-b8-b13.md).

## UI web y admin, e i18n

N/A en esta pieza — las confirmaciones de revocar y de anclar (filas 13 y 13-bis del `B/19` §4) las
construye [B13a](B13a.md#fila-b13a) (BH); esta pieza entrega los datos que dicen (qué cobros corta,
qué complementos, qué saldo cierra).

## Cron y outbox

- **La tercera comprobación del barrido** ([AC:B9a:14](#ac-b9a-14)), que corre en el barrido diario.
- **El correo antes de cada cancelación** de `S13` y `S20`, por el outbox común de `U2`.
- **El aviso de cobertura** al otorgar, anclar y revocar.

## Variables de entorno

N/A — ninguna fila de esta pieza declara una variable de entorno ([FILA:B9a](#fila-b9a)).

## Auditoría y observabilidad

- Las tres escrituras son una acción del catálogo, auditada con su firmante
  ([ACC:2](../02-nucleo.md#acc-2)); la revocación guarda además su motivo
  ([DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008)).
- Las marcas que deja ante una persona: `COBRO_POSTERIOR_AL_GRANT` ([MOT:3](../04-catalogos.md#mot-3))
  y `FAN_OUT_DE_GRANT_INCOMPLETO` ([MOT:10](../04-catalogos.md#mot-10)).

## Seguridad

Sólo `SUPER_ADMIN` otorga, ancla o revoca ([INV:30](../02-nucleo.md#inv-30)); el permiso lo
construye [V5](V5.md#pieza-v5) y el backend lo exige aunque la UI oculte el botón (`B/19` §1). El
rechazo se prueba por ruta ([TEST:B9a:9](#test-b9a-9)).

## Testing esperado

| AC | tests | tipo |
|---|---|---|
| [AC:B9a:1](#ac-b9a-1) | [TEST:B9a:1](#test-b9a-1) | integración con DB |
| [AC:B9a:2](#ac-b9a-2) | [TEST:B9a:2](#test-b9a-2) | integración con DB |
| [AC:B9a:3](#ac-b9a-3) | [TEST:B9a:3](#test-b9a-3) | integración con DB |
| [AC:B9a:4](#ac-b9a-4) | [TEST:B9a:4](#test-b9a-4) | integración con DB |
| [AC:B9a:5](#ac-b9a-5) | [TEST:B9a:5](#test-b9a-5) | integración con DB |
| [AC:B9a:6](#ac-b9a-6) | [TEST:B9a:6](#test-b9a-6) | integración con DB |
| [AC:B9a:7](#ac-b9a-7) | [TEST:B9a:7](#test-b9a-7) | integración con DB |
| [AC:B9a:8](#ac-b9a-8) | [TEST:B9a:8](#test-b9a-8), [TEST:B9a:15](#test-b9a-15) | migración desde cero, migración sobre datos |
| [AC:B9a:9](#ac-b9a-9) | [TEST:B9a:9](#test-b9a-9) | ruta API |
| [AC:B9a:10](#ac-b9a-10) | [TEST:B9a:10](#test-b9a-10) | integración con DB |
| [AC:B9a:11](#ac-b9a-11) | [TEST:B9a:11](#test-b9a-11) | integración con DB |
| [AC:B9a:12](#ac-b9a-12) | [TEST:B9a:12](#test-b9a-12) | unitario |
| [AC:B9a:13](#ac-b9a-13) | [TEST:B9a:13](#test-b9a-13) | integración con DB |
| [AC:B9a:14](#ac-b9a-14) | [TEST:B9a:14](#test-b9a-14) | integración con DB |
| [AC:B9a:15](#ac-b9a-15) | [TEST:B9a:16](#test-b9a-16) | integración con DB |
| [AC:B9a:16](#ac-b9a-16) | [TEST:B9a:8](#test-b9a-8), [TEST:B9a:11](#test-b9a-11), [TEST:B9a:12](#test-b9a-12) | migración desde cero, integración con DB, unitario |

<a id="test-b9a-1"></a>
**TEST:B9a:1** — `S13` sobre los seis estados

Tipo: integración con DB

Cubre: [AC:B9a:1](#ac-b9a-1)

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [DEC-GRANT-001](../01-decisiones-vigentes.md#dec-grant-001)

Una principal por cada estado vivo: todas terminan `CANCELLED`, el falso registra una cancelación
por preapproval vivo y ninguna por el ya `cancelled`, ningún `refund`, la bandera de `S19` apagada,
la pausa con `fin_real`; con la llamada del falso cortada a la mitad, una segunda corrida completa lo
que faltaba sin repetir lo hecho.

<a id="test-b9a-2"></a>
**TEST:B9a:2** — anclar una vertical nueva y el aviso de cobertura

Tipo: integración con DB

Cubre: [AC:B9a:2](#ac-b9a-2)

Fuente: [TRANS:B:S13](../04-catalogos.md#trans-b-s13) · [ACC:2](../02-nucleo.md#acc-2)

Anclar V corre `S13` sólo sobre V; otorgar, anclar y revocar encolan cada uno el aviso de cobertura;
en una vertical sin ancla la fuente `GRANT` no aparece.

<a id="test-b9a-3"></a>
**TEST:B9a:3** — el cierre del saldo diferido

Tipo: integración con DB

Cubre: [AC:B9a:3](#ac-b9a-3)

Fuente: [DEC-GRANT-013](../01-decisiones-vigentes.md#dec-grant-013)

Con una `courtesy_grant` sembrada con saldo, el otorgamiento escribe el cierre con el motivo; una
segunda corrida no escribe nada; revocar después no reabre el saldo.

<a id="test-b9a-4"></a>
**TEST:B9a:4** — `S20` y su orden, sembrado

Tipo: integración con DB

Cubre: [AC:B9a:4](#ac-b9a-4)

Fuente: [TRANS:B:S20](../04-catalogos.md#trans-b-s20) · [INV:28](../02-nucleo.md#inv-28)

Con las filas sembradas: la instancia cuelga del ancla antes de que el falso registre la cancelación;
cortado el proceso entre las dos escrituras, la corrida siguiente termina la segunda; con
`includesAddons: false` el falso no registra ninguna cancelación de complemento.

<a id="test-b9a-5"></a>
**TEST:B9a:5** — el grant no enciende addons

Tipo: integración con DB

Cubre: [AC:B9a:5](#ac-b9a-5)

Fuente: [INV:27](../02-nucleo.md#inv-27)

Sin addons, otorgar con `includesAddons: true` no crea ninguna `addon_instance`; un addon no
compatible con la vertical anclada conserva su preapproval vivo.

<a id="test-b9a-6"></a>
**TEST:B9a:6** — la fuga del `USER`/`GLOBAL`

Tipo: integración con DB

Cubre: [AC:B9a:6](#ac-b9a-6)

Fuente: [DEC-ADDON-005](../01-decisiones-vigentes.md#dec-addon-005)

El `USER` compatible con dos verticales y grant en una queda convertido y su fuente aparece sin cobro
en las dos.

<a id="test-b9a-7"></a>
**TEST:B9a:7** — revocar sin reparar

Tipo: integración con DB

Cubre: [AC:B9a:7](#ac-b9a-7)

Fuente: [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [DEC-TRIAL-009](../01-decisiones-vigentes.md#dec-trial-009)

La revocación escribe las tres columnas juntas; un intento de escribir sólo una la rechaza la base;
ninguna fila se borra; el falso no registra ninguna reanudación; el trial sigue consumido.

<a id="test-b9a-8"></a>
**TEST:B9a:8** — el esquema de los grants desde cero

Tipo: migración desde cero

Cubre: [AC:B9a:8](#ac-b9a-8), [AC:B9a:16](#ac-b9a-16)

Fuente: [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009) · [DEC-GRANT-008](../01-decisiones-vigentes.md#dec-grant-008) · [FILA:B9a](#fila-b9a)

Sobre una base vacía migrada con la rama: existen las dos tablas con sus `UNIQUE`, sus FK compuestas
y las tres columnas de la revocación; un segundo grant vivo para el mismo beneficiario falla.

<a id="test-b9a-15"></a>
**TEST:B9a:15** — el `UNIQUE` parcial sobre filas ya escritas

Tipo: migración sobre datos

Cubre: [AC:B9a:8](#ac-b9a-8)

Fuente: [DEC-GRANT-009](../01-decisiones-vigentes.md#dec-grant-009) · [DEC-ADDON-003](../01-decisiones-vigentes.md#dec-addon-003)

Con filas sembradas antes de aplicar la restricción —un beneficiario con dos grants revocados y uno
vivo, y una instancia colgando de un ancla—, la migración aplica sin error, las filas siguen iguales
y un segundo vivo se rechaza.

<a id="test-b9a-9"></a>
**TEST:B9a:9** — sólo `SUPER_ADMIN`, por ruta

Tipo: ruta API

Cubre: [AC:B9a:9](#ac-b9a-9)

Fuente: [INV:30](../02-nucleo.md#inv-30)

Un admin sin `SUPER_ADMIN` recibe el rechazo de permiso del contrato de errores en otorgar, anclar y
revocar, y la base queda igual.

<a id="test-b9a-10"></a>
**TEST:B9a:10** — una vertical nueva no recibe nada sin ancla

Tipo: integración con DB

Cubre: [AC:B9a:10](#ac-b9a-10)

Fuente: [INV:29](../02-nucleo.md#inv-29) · [DEC-PROMO-002](../01-decisiones-vigentes.md#dec-promo-002)

Con una vertical sembrada después del grant, la fuente `GRANT` no aparece en ella; anclarla la hace
aparecer y corre `S13`.

<a id="test-b9a-11"></a>
**TEST:B9a:11** — el piso con `políticaDePlan(v).vigente`

Tipo: integración con DB

Cubre: [AC:B9a:11](#ac-b9a-11), [AC:B9a:16](#ac-b9a-16)

Fuente: [DEP:12](../03-contrato-de-cobertura.md#dep-12)

Con el simulador del contrato contestando `vigente: no`, otorgar, anclar y la herramienta del 3b no
escriben ninguna fila; con `sí`, el ancla queda con la referencia a esa versión.

<a id="test-b9a-12"></a>
**TEST:B9a:12** — las fuentes `GRANT` y `CORTESÍA` en el juego de la real

Tipo: unitario

Cubre: [AC:B9a:12](#ac-b9a-12), [AC:B9a:16](#ac-b9a-16)

Fuente: [LISTA:B9a](#lista-b9a)

El diff de `B9a` no modifica archivos de `B4`; cada fuente `GRANT` del juego trae `piso`; la
`CORTESÍA` real no emite sobre la tabla vacía y emite sobre la fila sembrada.

<a id="test-b9a-13"></a>
**TEST:B9a:13** — `C3`, cobros posteriores al grant

Tipo: integración con DB

Cubre: [AC:B9a:13](#ac-b9a-13)

Fuente: [LOCK:C3](../04-catalogos.md#lock-c3) · [MOT:3](../04-catalogos.md#mot-3)

Con el falso sin aplicar la cancelación, dos cobros de ciclos seguidos cuelgan de una sola marca
`COBRO_POSTERIOR_AL_GRANT`; a los 3 días se abre `CANCELACIÓN_SIN_CONFIRMAR`.

<a id="test-b9a-14"></a>
**TEST:B9a:14** — la tercera comprobación

Tipo: integración con DB

Cubre: [AC:B9a:14](#ac-b9a-14)

Fuente: [MOT:10](../04-catalogos.md#mot-10)

Con `S13` cortado a la mitad, el barrido abre `FAN_OUT_DE_GRANT_INCOMPLETO`; reanudado, la corrida
siguiente no la vuelve a abrir.

<a id="test-b9a-16"></a>
**TEST:B9a:16** — la herramienta del 3b, dos veces

Tipo: integración con DB

Cubre: [AC:B9a:15](#ac-b9a-15)

Fuente: [PASO:3b](../30-el-corte.md#paso-3b)

Sobre una base con las cinco pruebas escritas, la herramienta escribe dos grants anclados a
Alojamiento con la versión dada; la segunda corrida no escribe nada; con una versión no vigente no
escribe ninguno.

## Smoke y etiquetas

N/A — sin etiquetas `status-needs-smoke-*` en la pieza ([GATE:M1](../30-el-corte.md#gate-m1)); la
herramienta del 3b se ejecuta en el ensayo del corte y en el corte real, que son de la pseudo-pieza
`CORTE` ([PASO:3b](../30-el-corte.md#paso-3b)).

## Dependencias, rollback y despliegue

- **Espera a** `B8a` (`B8a → B9a`), a `B4` (`B4 → B9a`) y, por la dependencia entre épicas de la
  fila 12, a `V2` para integrarse ([DEP:12](../03-contrato-de-cobertura.md#dep-12)); se prueba antes
  contra el simulador del contrato.
- **La esperan** [B13a](B13a.md#pieza-b13a) (`B9a → B13a`, BH) y [B9b](../20-fase-2/B9b.md#pieza-b9b).
- **Despliegue**: PR a la rama `epic/HOS-1352-verticales-billing` con el momento 1
  ([GATE:M1](../30-el-corte.md#gate-m1)); la herramienta del 3b corre en el corte.
- **Rollback**: la fuente no fija uno por pieza; pasado el paso 3 del corte sólo se arregla hacia
  adelante (`16-fase-7…` §4.3).

## Labels de Linear

Pasa a `Done` al mergearse en la rama del paraguas; sin etiquetas `status-needs-smoke-*`
([GATE:M1](../30-el-corte.md#gate-m1)).

## Abiertos

- «Rutas y códigos de error de los actos de las piezas `B8`–`B13`», en
  [abiertos de g9](../_trabajo/abiertos/g9-b8-b13.md).

## Origen

`B/descomposicion.md` §2 (filas `B9` y `B9a`), §2.6 (fila 12), §2.12 y §4 (filas `B9` y `B9a`);
`D/16` §4.2 (paso 3b, *«las herramientas del corte»*) y §4.6; `B/03` §3.2 (`S13`, `S20`); `B/05` C3;
`B/02` §2.4 y §2.5 (motivo 10); `NUCLEO/04` (27 a 30); `NUCLEO/08` §3 (la fila del grant);
`01-decision-log.md`; `41-corte-del-mvp/10-decisiones-del-owner.md` (Z, AQ, AS, BG, BH).
