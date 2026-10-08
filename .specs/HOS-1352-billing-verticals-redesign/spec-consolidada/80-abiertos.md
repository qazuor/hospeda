# 80 · Abiertos

Lo que las fuentes **declaran no cerrado**, y las preguntas al owner que dejó la redacción de esta
spec. **Un abierto no es un criterio**: acá no hay US, AC ni tests ([AL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-al));
cuando el owner contesta, la respuesta se registra en el log y en el ítem que corresponde, y el
abierto sale de acá. Las citas son `archivo:línea` en el SHA congelado
`284c6dd583156a728876950ce0171d7c43ce7084`. Abreviaturas de ruta: `D/` es
`.specs/HOS-1352-billing-verticals-redesign/docs/`, `NUCLEO/` es `D/nucleo/`, `V/` es
`.specs/HOS-1353-verticales-capacidades-y-autorizacion/` y `B/` es
`.specs/HOS-1354-billing-cobro-y-proveedor/`.

## 1. Lo que la propuesta del corte no pudo verificar

`D/41-corte-del-mvp/10-decisiones-del-owner.md`, *«Lo que la propuesta no pudo verificar (sigue
abierto)»* (línea 240), que [DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017), implicación 4, deja
abierto:

1. Si `partners` tiene filas en producción: decide si el `UNIQUE` parcial sobre `owner_user_id` de
   [AB](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-ab) es seguro. (línea 242) **Cómo se
   contesta lo cerró [BT](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bt)**: la pieza que lo
   necesita mide con `hops psql --target=prod`, en sólo lectura y contando, antes de su merge, y
   deja el número en el PR; si da cero no hay nada que decidir, y si no, vuelve al owner con el
   número antes del merge. Una salida vacía de `hops psql` no es un cero: se repite. Lo que sigue
   abierto es el número. (línea 145)
2. La duración del trial y los plazos de retención, que fija el owner antes del merge de `V6`.
   (línea 243; ver el [paso 3](30-el-corte.md#paso-3): la migración falla si alguno de los plazos
   sin valor escrito está vacío) **Y el plazo 19**, la ventana `N` del resumen de conciliación
   ([BU](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bu)): **cerrado por
   [BX](01-decisiones-vigentes.md#own-41-corte-del-mvp-t10-bx) cuándo se fija**, antes del merge
   de `B2` y no de `B11`, porque la versión 1 de los plazos falla con una clave vacía sin
   excepciones; lo que sigue abierto es el valor. (líneas 146 y 157)
3. Dependencias internas ocultas en las mitades *a* más allá de la de `S1`. (línea 244) **Lo que se
   hace cuando una pieza anterior llama a algo que construye una posterior lo cerró
   [BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)** (la anterior escribe su rama
   entera y llama por interfaz; la posterior trae la implementación). (línea 137) **Y
   [BY](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-by) la extendió a una lectura**: la
   guarda de `S15` y el predicado (f) de `G-R1-F`, de `B3`, leen `reconciliation_mark_payment`, que
   nace en `B5`; `B3` los escribe contra una interfaz interna y `B5` trae la implementación, con el
   criterio en su *«Lista cuando»*. (línea 168)
4. El tamaño de cada pieza: el diseño no tiene estimaciones. (línea 245)
5. Si la baja self-service tiene una exigencia legal con fecha. (línea 246)
6. Si `retenciónDetenida` real sobre cero pausas cumple el juego de casos de la real. (línea 247)

## 2. Las filas `UNKNOWN` de la matriz de Mercado Pago

Las 14 filas que siguen `UNKNOWN` en `D/06-mp-validation-matrix.md`. Se definen en
[04-catalogos.md](04-catalogos.md); acá sólo se listan con su estado. Una pieza que se apoya en una
de ellas no termina sin sus dos ramas escritas y una prueba por rama contra el proveedor falso
([GATE:M1.4](30-el-corte.md#gate-m1-4)).

| fila | qué no se sabe | estado según la fuente | línea |
|---|---|---|---|
| [MP:PA-6](04-catalogos.md#mp-pa-6) | si el proveedor cancela el preapproval ante **cualquier** primer cobro rechazado o sólo ante el antifraude | no bloquea: `S16` cancela de nuestro lado; decide cuánto dura el grace de la sucesora, acotado a un día; hay un indicio de sandbox, no medición | 177 |
| [MP:GR-2](04-catalogos.md#mp-gr-2) | el pago tardío, después de suspender (§22) | ya no depende: `DEC-SUB-019` cancela el preapproval al suspender; queda abierto el pagador manual y los bordes (un cobro en vuelo en el instante de `S6`, un preapproval reactivado a mano) | 201 |
| [MP:RC-8](04-catalogos.md#mp-rc-8) | qué estado lee el pago de un contracargo y qué aviso llega | sólo fuente documental, sin verificar; `DEC-SUB-020` la usa con esa salvedad; no se puede fabricar a voluntad | 283 |
| [MP:RF-3](04-catalogos.md#mp-rf-3) | el plazo máximo para reembolsar un cobro | mayor que 65 días; el sujeto (`167913214814`) cumple 180 días el 2027-01-04; lo que sigue sin medirse es si a los 180 días el reembolso entra | 305 |
| [MP:EX-42](04-catalogos.md#mp-ex-42) | si una llamada directa vence una `Preference` de Checkout Pro | no se mide, por decisión del owner (S-59); queda sin bloquear nada | 399 |
| [MP:EX-43](04-catalogos.md#mp-ex-43) | si reenviar una orden con la misma clave y el mismo cuerpo horas después devuelve la misma orden, y qué devuelve si nunca se creó | pendiente de sonda; si devuelve error, el caso cae en la comprobación de órdenes pagadas del barrido | 400 |
| [MP:EX-44](04-catalogos.md#mp-ex-44) | si cancelar un preapproval corta el reciclado de un registro de cobro abierto | se mide en sandbox antes de `B11`, fuera del paso 0 (S-60); hay un indicio, no medición | 401 |
| [MP:EX-45](04-catalogos.md#mp-ex-45) | si una cancelación leída `cancelled` sigue `cancelled` releída horas después | se mide en sandbox antes de `B11`, fuera del paso 0 (S-60) | 402 |
| [MP:EX-46](04-catalogos.md#mp-ex-46) | a qué URL va el reintento de una notificación emitida antes de cambiar la URL | no se mide (M-4) y queda sin sujeto: la URL no cambia en el corte (O-B) | 403 |
| [MP:EX-47](04-catalogos.md#mp-ex-47) | si un registro de cobro creado antes de mutar el monto cobra el viejo o el nuevo | se mide en sandbox antes de `B11` (S-61); si cobra el viejo, lo ve el motivo 24 | 404 |
| [MP:EX-48](04-catalogos.md#mp-ex-48) | qué campo del pago trae el instante de la aprobación en un reintento | no se mide, por decisión del owner (S-57): su único sujeto salió | 405 |
| [MP:EX-49](04-catalogos.md#mp-ex-49) | qué variantes de un correo entregan en la misma casilla, por proveedor, y la distribución de dominios | se mide en el paso 0 del corte y es condición del corte ([PASO:0](30-el-corte.md#paso-0)) | 406 |
| [MP:EX-50](04-catalogos.md#mp-ex-50) | cuántas suscripciones anuales del viejo siguen vivas el día del corte | no se mide, por decisión del owner (S-58): el owner ya dio el hecho, no hay anuales vivas | 407 |
| [MP:EX-54](04-catalogos.md#mp-ex-54) | qué correo le manda el proveedor al pagador cuando le subimos el monto de un preapproval | no se mide, por decisión del owner (M-5); la sonda 54 no se corre | 411 |

## 3. El código de error del rechazo de la compra de Turista VIP

[BJ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t8-bj) y el quinto 📌 de
[DEC-ARCH-017](01-decisiones-vigentes.md#dec-arch-017-p5) ponen en `B3` la guarda de `S1` que rechaza
comprar Turista VIP mientras el plan vigente lo hereda (la mitad de
[DEC-ENT-003](01-decisiones-vigentes.md#dec-ent-003) que ninguna pieza construía), y dejan dicho:
**el código de error del rechazo queda abierto**: `apps/api/docs/error-contract.md` no lo fija.
(`D/41-corte-del-mvp/10-decisiones-del-owner.md:124`; `D/01-decision-log.md:7992`.) **Cómo se fija
lo cerró [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)**, la regla de los detalles
que las fuentes dejan a la implementación (`error.code` entre ellos): lo propone el PR de la pieza
dueña, `B3`, siguiendo lo escrito del repo; lo aprueba la revisión de contexto fresco del momento 1
(y el owner en el PR cuando es texto al cliente o un permiso nuevo); y queda escrito en la sección
de `B3` en esta spec al mergear. Lo que sigue abierto es el valor, hasta ese PR.
(`D/41-corte-del-mvp/10-decisiones-del-owner.md:144`.)

## 4. Lo que el corte declara y no resuelve

El §4.3 de `D/16` (*«lo que este orden NO resuelve»*) se escribe entero en
[30-el-corte.md](30-el-corte.md#paso-2b), con la rama de aborto y el rollback: el defecto grave
pasado el paso 3 se arregla bajo presión; una autorización viva que el recorrido sin filtro no
devuelve sobrevive al corte; un aviso de Mercado Pago entre el apagado del viejo y el levantamiento
de la imagen nueva puede perderse; y las dos situaciones que una restauración no deshace, que se
releen antes del ensayo. Y en el §4.7: **que la fase 4 pueda adelantarse a la 2 o a la 3 no lo dice
AW** (la fuente lo marca; `D/16-fase-7-del-paraguas.md:1175`;
[GATE:FP](30-el-corte.md#gate-fp)). Y en el §4.2: **qué pieza escribe el encendido del drift guard sobre la rama de la primera fase
posterior** (*«cómo se enciende sobre una rama `epic/**` lo fija `DEC-CI-001`»*): la fuente lo marca
como lo que falta escribir al abrir la primera fase (`D/16-fase-7-del-paraguas.md:1023`;
[GATE:FP.3](30-el-corte.md#gate-fp-3)).

## 4-bis. Pendientes del owner agregados el 2026-10-07

1. **El orden de `MIN` y `BEST_DECLARED`.** Cuando aparezca la primera clave del catálogo que declare
   la estrategia `MÍNIMO` (`MIN`) o `MEJOR_DECLARADO` (`BEST_DECLARED`), el owner confirma el orden que
   la clave declara —qué valor es «mejor» para el cliente— antes del merge de la hoja que la agrega
   ([AC:V3:1](10-corte/V3.md#ac-v3-1), [AC:V2:4](10-corte/V2.md#ac-v2-4)).
2. **Qué es exportar una ficha y qué pieza lo construye** (Coord-4,
   `docs/41-corte-del-mvp/10-decisiones-del-owner.md`): la pieza natural es `V8a`. **Contestado el
   2026-10-08 (DE)**: se difiere fuera del MVP; lo que sigue abierto está en §4-ter.

## 4-ter. Pendientes del owner agregados el 2026-10-08

1. **Definir si exportar una ficha se queda en la spec y en qué fase** (DE,
   `docs/41-corte-del-mvp/10-decisiones-del-owner.md`). El owner no recuerda haber acordado la
   funcionalidad y la difirió fuera del MVP. La spec la nombra en `10-corte/V5.md:531-553` (el paso 4
   y la versión de piso autorizan al dueño a «verla, exportarla, reactivarla y borrarla») y en
   `10-corte/V9a.md:215-216` (exportar como acto del dueño que reinicia el reloj de inactividad).
   Si se queda, hace falta la pieza que construya la operación; el registro de `V9a` le suma el
   evento en forma aditiva. Si sale, hay que limpiar esas dos menciones y la de [AC:V9a:1](10-corte/V9a.md#ac-v9a-1).

## 5. Lo que cada capítulo declara que NO cierra

Las secciones *«Lo que este capítulo (o esta mitad) NO cierra»* de los capítulos del diseño, en su
texto vigente (sin tachados) y por párrafo, con la línea donde empieza cada uno. Muchas entradas ya
dicen **cerrado** o **sale**: se dejan porque la fuente las conserva en la sección y sirven para no
reabrirlas. Las del paraguas (`D/16` §4.3 y §5) están en [30-el-corte.md](30-el-corte.md#paso-2b) y
en el [momento 2](30-el-corte.md#gate-m2).

### `NUCLEO/01-glosario.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:975`–`980`.

- `NUCLEO/01-glosario.md:977` — **`M-ARCH-02`** (caché e invalidación) es del capítulo 02: depende del modelo de datos.
- `NUCLEO/01-glosario.md:978` — **Las transiciones** entre los estados nombrados en §2.2 son del capítulo 03. Acá están los nombres, no las reglas de movimiento.
- `NUCLEO/01-glosario.md:980` — **Qué pasa cuando una suscripción principal se va y quedan complementos vivos** es del capítulo 16 (`E-ADDON-04`).

### `NUCLEO/02-modelo-de-datos.md` — Lo que esta mitad NO cierra

Fuente: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:272`–`274`.

- `NUCLEO/02-modelo-de-datos.md:274` — **Los tipos, los índices y el plan de migración** son de FASE 4 y FASE 7.

### `NUCLEO/03-maquinas-de-estado.md` — Lo que esta mitad NO cierra

Fuente: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:172`–`177`.

- `NUCLEO/03-maquinas-de-estado.md:174` — **Las restricciones de base** que hacen cumplir estas máquinas son del capítulo 02.
- `NUCLEO/03-maquinas-de-estado.md:175` — **Qué correo sale en cada transición** es del capítulo 07 (núcleo).
- `NUCLEO/03-maquinas-de-estado.md:176` — **Los relojes**, como jobs concretos con su horario y su idempotencia, son de cada subdominio.

### `NUCLEO/07-outbox-y-notificaciones.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:372`–`382`.

- `NUCLEO/07-outbox-y-notificaciones.md:374` — **El texto de cada correo** no es parte de esta spec.
- `NUCLEO/07-outbox-y-notificaciones.md:375` — **Qué pasa si un cliente responde un correo** — no hay canal de entrada modelado, y el §5.2 mide que el proveedor manda todo a nuestra puerta. Queda anotado como superficie de soporte del capítulo 19, no como hueco de notificaciones.
- `NUCLEO/07-outbox-y-notificaciones.md:378` — **El envío es al menos una vez, no exactamente una** (FASE 8 completa, `F-8CB2-011`; declarado por `DEC-METH-015`, FASE 9 completa). La clave del §2 impide encolar dos veces, no mandar dos: un proceso que manda y muere antes de marcar `sent` pierde el `processing` por vencimiento (§1.2) y la fila sale de nuevo. El daño es un correo repetido —también el que sale antes de cancelar (cap. 03 (billing) §3.2, precisión 3)—, nunca una acción de dominio. **Causa**: el proveedor de correo no está elegido y no se sabe si acepta una clave de idempotencia.

### `NUCLEO/08-auditoria-y-observabilidad.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:509`–`520`.

- `NUCLEO/08-auditoria-y-observabilidad.md:511` — **Qué hace el reconciliador para detectar**, y con qué frecuencia, es el capítulo 09.
- `NUCLEO/08-auditoria-y-observabilidad.md:512` — **Las superficies del Admin** —cómo se ven estas acciones y este listado— son del capítulo 19.
- `NUCLEO/08-auditoria-y-observabilidad.md:513` — **Cerrado por la decisión 5a** (FASE 8 completa, `F-8CB3-016`; FASE 9 completa, `DB-4`). La excepción del §4.1 lo nombraba y ninguna comprobación lo producía —**causa**: `DEC-RF-001` declaró el acto, no su falla—. Desde la máquina del reembolso su productor es **`RF5`**, la llegada de un `refund` de una revocación a `FAILED` (cap. 03 (billing) §6.1), que la fila declara como *«su productor»*. Lo que este capítulo no dice es con qué plantilla sale ese correo inmediato: es del catálogo del cap. 07 §6 ([02-nucleo-outbox.md](02-nucleo-outbox.md) §6), que desde BR tiene su fila, *«reembolso de revocación fallido»*, como el `COBRO_DUPLICADO`, *«cobro duplicado detectado»*; los dos los construye [B11](10-corte/B11.md#pieza-b11) (corte del MVP, owner 2026-10-02, [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br); `NUCLEO/08-auditoria-y-observabilidad.md:519`).

### `V/docs/02-modelo-de-datos.md` — Lo que esta mitad NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:1023`–`1024`.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:1023

- `V/docs/02-modelo-de-datos.md:1025` — **`OD-ARCH-01`** (retiro de un plan del catálogo) lo cerró el capítulo 10: acá está el flag de vendible y el de vigente, que son el mecanismo; **la política es de la épica de billing**.
- `V/docs/02-modelo-de-datos.md:1027` — **Discontinuar una vertical** (`M-SUB-03`; revisión del owner, 2026-09-28, C8): **fuera de esta versión; si algún día hace falta, se diseña entonces** (`B/10` §4). La fila de `vertical` sigue sin borrarse nunca, por su espejo del enum de código. Retirar todos los planes de una vertical sigue siendo posible y la deja en operación (`B/10` §3.6).

### `V/docs/10-verticales-planes-billing-options.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/10-verticales-planes-billing-options.md:149`–`154`.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/10-verticales-planes-billing-options.md:149

- `V/docs/10-verticales-planes-billing-options.md:151` — **Qué claves de entitlement y de limit tiene cada vertical** (el ítem 4 de la tabla) es del capítulo 15 (épica de verticales): acá está que el subconjunto es por vertical, no cuál es.
- `V/docs/10-verticales-planes-billing-options.md:153` — **La pricing como superficie** es del capítulo 19. Acá está qué lee, no cómo se ve.

### `V/docs/11-trial.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:460`–`474`.

- `V/docs/11-trial.md:462` — **`BD-TRIAL-01`** —qué pasa cuando la versión de la que deriva el plan de trial cambia en mitad de un trial— sigue abierto desde `DEC-TRIAL-001`.
- `V/docs/11-trial.md:464` — **El evento de activación de Partner** queda diferido, no respondido (`DEC-TRIAL-003`): hoy su trial está en cero **y no se enciende en esta versión** (revisión del owner, 2026-09-28, N7; §8).
- `V/docs/11-trial.md:468` — **Cerrado** (revisión del owner, 2026-09-28, C4): por la fecha del ciclo de cada persona (`15` §7), y la del trial **también** es mensual, desde el día en que arrancó (§4.3, `L2-f1`).
- `V/docs/11-trial.md:472` — **Qué significa exactamente archivar** un borrador pre-trial depende de `C-DATA-01` (`DEC-TRIAL-007`), y sigue abierta.

### `V/docs/15-entitlements-y-limits.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:570`–`594`.

- `V/docs/15-entitlements-y-limits.md:572` — **Cuáles son las claves de cada vertical** —el ítem 4 del Eje 2 (cap. 10 §1)— es configuración, no diseño: acá está que el subconjunto se declara por vertical y que cada clave lleva **cuatro** atributos declarados —scope, estrategia de agregación, `enforcementStrategy` y **clase** (§3.4)—. *(Eran tres hasta esta pasada; la clase entró porque sin ella el predicado de `G-R3` no se podía formar.)*
- `V/docs/15-entitlements-y-limits.md:577` — **Cerrado** (revisión del owner, 2026-09-28, C4): corre por la fecha del ciclo de cada persona, §7.
- `V/docs/15-entitlements-y-limits.md:580` — **Qué es una suscripción «válida» para comprar un addon** (`A-ADDON-02`) es del capítulo 16 (épica de billing).
- `V/docs/15-entitlements-y-limits.md:581` — **El orden de aplicación entre promo, cortesía y grant** (`A-PROMO-01`, `A-PROMO-02`) es del capítulo 14 (épica de billing): acá se agregan **capacidades**, allá se compone **dinero**.
- `V/docs/15-entitlements-y-limits.md:583` — **Qué dice el aviso con ventana del fin de una cortesía cuando detrás viene `S10`** (FASE 8 completa, `F-8CC1-008`, owner 2026-09-25; declarado por `DEC-METH-015`). La tabla del §4.4 le da ventana al fin de una cortesía, y lo normal ese día es que la suscripción se reanude con la misma versión anclada: no se pierde nada. Verticales no puede saberlo —el estado de la suscripción no cruza, `12-contrato…` §4—, así que el aviso anuncia una pérdida que en ese caso no ocurre. El desarrollo está en el `12-contrato…` §2.6. **El fin del trial va sin ventana, como dice el §4.4**: el contrato decía lo contrario y se alineó a esta tabla.
- `V/docs/15-entitlements-y-limits.md:590` — **El fin de una suscripción en `CANCEL_SCHEDULED` no está en la tabla del §4.4** (FASE 9 completa, borde del informe `06`; declarado por `DEC-METH-015`, FASE 9 completa). El contrato lo pone entre los `hasta: fecha` y remite la ventana acá (`12-contrato…` §2.6), y la tabla no lo clasifica. La baja la pidió la persona y sus avisos son los de `B/19` §4; **este capítulo no le promete una ventana para elegir qué fichas conservar, porque no queda título que conserve ninguna**. **Causa**: la tabla se escribió sobre lo que se quita sin pedirlo. No mueve plata ni acceso.

### `V/docs/17-autorizacion.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:787`–`817`.

- `V/docs/17-autorizacion.md:789` — **Qué tiene el visitante sin cuenta** (`A-ENT-02`) es del capítulo 15. Acá está que es un actor real, no cuáles son sus capacidades.
- `V/docs/17-autorizacion.md:791` — **El scope global de entitlements** (`M-ENT-03`) es del capítulo 15. Acá está que lo global es la fuente y nunca la operación.
- `V/docs/17-autorizacion.md:793` — **Cómo se agrega cada limit y cómo se hace cumplir un excedente** (`M-ENT-01`, `M-ENT-02`) son del capítulo 15: el paso 7 pregunta si queda cupo, no cómo se calculó.
- `V/docs/17-autorizacion.md:795` — **Las superficies** —qué se oculta en la UI— son del capítulo 19, y con la regla del §45 por delante: *«autorización backend jamás depende de ocultar UI»*.
- `V/docs/17-autorizacion.md:797` — **La misma persona con dos cuentas** (owner 2026-09-26, `Y-2`; declarado por `DEC-METH-015`; FASE 9 vuelta 1, `N-1`). La regla 5 del §3.2 compara cuentas: una persona con una cuenta de staff y otra de cliente opera lo suyo desde la primera y la regla no lo ve. **Causa**: con un solo operador, la confirmación por una segunda persona bloquea la operación, y vincular las cuentas de una persona lo declara el propio interesado, así que lo elude quien quiera eludirlo. **Lo que queda es el detector** —el resumen de `DEC-OBS-001` lista cada acción que mueve plata con actor y sujeto, `NUCLEO/08` §4.1—, que no distingue a la persona: la revisión es humana. La confirmación por una segunda persona entra cuando haya otra persona con el permiso.
- `V/docs/17-autorizacion.md:805` — **Sale** (revisión del owner, 2026-09-28, C8): la acción 16 ya no existe.
- `V/docs/17-autorizacion.md:807` — **«Entrar como» el cliente** (revisión del owner, 2026-09-28, C7): **no está en esta versión y se va a agregar**. Su condición queda escrita hoy: **se registra como hecho por el admin en nombre del cliente** (actor el admin, sujeto el cliente, nunca `actor = sujeto` en el registro, §3.2 regla 5), así que no es la impersonación de la regla 4. **Cuando se diseñe se reabre la frase *«ni las que se agreguen»* de `NUCLEO/08` §3**: si publicar en nombre del cliente le arranca la prueba al cliente o no. No agrega unidades ni guards en esta versión.
- `V/docs/17-autorizacion.md:813` — **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): **fuera de esta versión; si algún día hace falta, se diseña entonces**. No hay acción administrativa que la haga, ni permiso que la pida. Retirar planes, también todos los de una vertical, sigue siendo posible y no es una acción de esta tabla sino una publicación del catálogo.

### `V/docs/18-partner.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:392`–`408`.

- `V/docs/18-partner.md:394` — **La presencia no tiene ciclo de publicación: lo cierra el §1.6**, y el capítulo 19 remite acá (FASE 8 completa, `R13`, owner 2026-09-25). Lo que el §1.6 deja declarado con su causa está en su ⚠️. **Y el carrusel y la bajada deliberada del admin tampoco**: el carrusel lee su propia clave y la presencia moderada no se ve (§1.6; FASE 9 completa, 7b y 7c).
- `V/docs/18-partner.md:400` — **Cómo se registra un pago manual** es del capítulo 13 (épica de billing).
- `V/docs/18-partner.md:401` — **Si algún día Partner enciende su trial** (fuera de esta versión: el panel no deja pasar sus días de 0 a más de 0, revisión del owner, 2026-09-28, N7), tiene que declarar su evento de activación (`DEC-TRIAL-003`, implicación 1), y ahí el §10.5 pasa a alcanzarlo. **Cuál** es ese evento sigue abierto, y **qué hay que hacer ese día también**: el procedimiento del capítulo 11 §8 y `T7` salieron con el encendido (revisión del owner, 2026-09-28, N7); se diseña si algún día hace falta.
- `V/docs/18-partner.md:406` — **La lista de aprobadas sin reclamar sólo crece** (FASE 9 vuelta 1, `F-8V1A2-005`). **Causa**: no hay daño que evitar (§2.5), y una baja sería un estado más.

### `V/docs/19-superficies.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:97`–`112`.

- `V/docs/19-superficies.md:99` — **La presencia de Partner no tiene ciclo de publicación, y la regla vive en el cap. 18 §1.6** (épica de verticales): la lectura pública pregunta por el entitlement **«página propia»** (FASE 9 vuelta 1, `F-8V1A1-004`) y, si falta, responde que no existe. Este capítulo y aquél se remitían el uno al otro; ahora éste remite y aquél decide (FASE 8 completa, `R13`, owner 2026-09-25). **Lo mismo el carrusel de la home**, que lee la clave *«presencia en el carrusel»* (Gold y Silver), **y la presencia moderada**, que no se ve en ninguna de las dos superficies (cap. 18 §1.6; FASE 9 completa, 7b y 7c). Lo que este capítulo agrega es la fila 22.
- `V/docs/19-superficies.md:108` — **La home no tiene destacados hasta que exista el complemento de destaque** (FASE 5, owner 2026-09-30, lote 1 F, `F5-BD-032`, `F5-U1-045`): `U1` retira las dos marcas de destaque de las tres tablas de fichas, también la que hoy pone el equipo a mano (cap. 02 §2.5), y el destaque vuelve sólo como complemento pagado.

### `V/docs/21-migracion.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:722`–`778`.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md:722

- `V/docs/21-migracion.md:724` — **Cómo se le avisa a las cinco cuentas de la lista** lo decide el owner, que les avisa por privado y sin nada programado (`DEC-MIG-007`, punto 4; FASE 5, simplificación del corte, S-51 y S-53); **cuándo se cancelan sus suscripciones** es FASE 7: acá está que no se migra, no el procedimiento de la conversación.
- `V/docs/21-migracion.md:729` — **La clasificación del código legacy** en reusar o reescribir tiene su propio gate (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.
- `V/docs/21-migracion.md:731` — **Sale**: no hay agenda de llamados (FASE 5, simplificación del corte, S-77).
- `V/docs/21-migracion.md:738` — **El trial de los clientes actuales no se preserva** (§2.3 y §2.4; declarado por `DEC-METH-015`, FASE 9 completa, `2g`): quien tenía ficha o suscripción en el sistema viejo estrena el trial en el sistema nuevo, aunque ya lo hubiera usado. **Y desde C12 cada una de las cinco cuentas de la lista (FASE 5, S-12) lo estrena el día del corte**, sin tener que publicar (revisión del owner, 2026-09-28, C12). **Causa**: decisión del owner, que los trata como clientes nuevos y sólo les respeta la ficha.
- `V/docs/21-migracion.md:743` — **Sale** (revisión del owner, 2026-09-28, C12, `L1-b`): el dueño del corte con una ficha a la vista amanece en prueba y convierte por `T2` al contratar, y las fichas bajadas por el viejo nacen en borrador, así que la regla `R15` que este ítem describía cae entera. Lo que decía: **Quien contrata sin publicar paga desde el primer cobro** (§2.4; declarado por `DEC-METH-015`, FASE 9 vuelta 1, R1). Si un dueño del corte llega al checkout por otro camino, `S1` lo cubre, `PB3` le sube la ficha y **`T8` le consume el trial al primer cobro: la vuelta de su ficha por `PB3` bajo un título que paga cuenta como ejercicio del evento para `T8`, y sólo para ella** (`V/03` §2; owner 2026-09-27, FASE 9 vuelta 2, `R15`). Ya no conserva un trial para el día que cancele. **Causa**: el guion y el botón lo mandan a publicar; cobrarle al que elige pagar no es un defecto. No da acceso indebido ni borra nada.
- `V/docs/21-migracion.md:754` — **Sale**: una ficha por cuenta es premisa (`DEC-MIG-007`, punto 3), y sale el recuento del paso 0 (FASE 5, simplificación del corte, S-08).
- `V/docs/21-migracion.md:762` — **Sale**: las cinco son de Alojamiento (`DEC-MIG-001`, `G1-3`; FASE 5, simplificación del corte, S-11).
- `V/docs/21-migracion.md:770` — **Sale**: la J del lote 1 borra todas las fichas que no son de las cinco, sin distinguir quién las borró (FASE 5, simplificación del corte, S-05).

### `V/docs/22-lo-legal.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:137`–`142`.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:137

- `V/docs/22-lo-legal.md:139` — **La pregunta 5, la única que queda** (FASE 9 vuelta 3, `F-8V3A3-009`), por definición. Lo que sí queda cerrado es **qué depende de cada una**, que es lo que permite implementar el resto sin esperarlas.

### `B/docs/03-maquinas-de-estado.md` — Lo que esta mitad NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2849`–`3062`.

- `B/docs/03-maquinas-de-estado.md:2851` — **`S10` deja volver antes cuando la persona quiera, y eso regala hasta un ciclo: se acepta y se declara** (owner 2026-09-26, `G5-3`, contra la recomendación de volver en el aniversario mensual; FASE 9 vuelta 1, `F-8V1B1-001`). La premisa de `DEC-SUB-010` —la pausa dura ciclos enteros porque se vuelve *«el mismo día del mes en que pausó»*— no vale con la vuelta libre, y con `PS-2`, `PS-5` y `PS-6` medidos **toda pausa que cruza una fecha de cobro y termina fuera del aniversario, dure lo que dure** (FASE 9 vuelta 1, `N-2`: con tres meses de pausa y vuelta al segundo día del ciclo son 29 días de regalo) **no la cobra**: el proveedor la salteó mientras la fila estaba `paused`, y al volver se cobra en el ciclo siguiente. El sobrecobro inverso —pausar el 5 y volver el 25— también queda. **Causa**: el owner mantiene *«volver cuando quiera»* del §26.2 a la letra (invariante 24, `NUCLEO/04`). **Ninguna transición lo detecta** —nuestro estado y el del proveedor coinciden en cada paso—, así que el detector es del barrido: lista esas pausas en el resumen de `DEC-OBS-001` (`NUCLEO/08` §4.1, `B/09` §2.3). El costo para el cliente está en `B/12`, *«lo que este capítulo NO cierra»*.
- `B/docs/03-maquinas-de-estado.md:2864` — **CERRADA** por el owner el 2026-09-25 (FASE 8 completa, `F-8CB1-013`): **entra en la misma regla de reintento**, con su par propio en el §10.1 —`authorized`/`paused`/`pending` × `CANCEL_SCHEDULED`— y sin tocar el par `cancelled` × `CANCEL_SCHEDULED`.
- `B/docs/03-maquinas-de-estado.md:2874` — **Cerrado el 2026-09-25**: se mide tiempo —3 días desde la transición que decidió la cancelación, 1 día desde el registro de cobro para el `B/09` §6, punto 2— (`B/09` §3 punto 2).
- `B/docs/03-maquinas-de-estado.md:2877` — **Cerrado el 2026-09-25 (owner)**: la sucesión no lo frena; `S6` corre igual y la sucesora también se corta (§3.2, `S6`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- `B/docs/03-maquinas-de-estado.md:2882` — **Cerrado el 2026-09-25 (owner)**: si la fila da servicio se corta en el acto, si no sólo la marca; la `CANCEL_SCHEDULED` pasa a `CANCELLED` ya, por `S12` (§3.2, §6 `P6`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- `B/docs/03-maquinas-de-estado.md:2887` — **Cerrado el 2026-09-25 (owner)**: mismo tratamiento que sobre `SUCCEEDED` (§6).
- `B/docs/03-maquinas-de-estado.md:2890` — **Cerrado el 2026-09-25 (owner)**: fin de servicio en el acto y cancelación del preapproval, como `S24` (§3.2, `S11`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- `B/docs/03-maquinas-de-estado.md:2894` — **Cerrado el 2026-09-25 (owner)**: es **`S31`** (§3.2), `ABANDONED` desde `PENDING_AUTHORIZATION` y **`CANCELLED`** desde `ACTIVE` (FASE 8 completa, owner 2026-09-25); el saldo diferido se cierra con `CONTRACARGO_DE_LA_PREDECESORA` (`B/02` §2.4) y el pago retenido por `S19` se reevalúa por la rama 2 de `B/12` §5.3 (FASE 8 completa, pendiente 8, owner 2026-09-25).
- `B/docs/03-maquinas-de-estado.md:2906` — **Cerrado el 2026-09-25 (owner)**: corre `S31` sobre su sucesora (§3.2, `S12`; pendiente 8).
- `B/docs/03-maquinas-de-estado.md:2910` — **Cerrado el 2026-09-25 (owner)**: se corta; `S6` la toma por su tercer evento, la cortesía se cierra y la fila pasa a `SUSPENDED` (§3.2, §3.3; pendiente 8). La pausada por `CUSTOMER_REQUEST` sigue con sólo la marca.
- `B/docs/03-maquinas-de-estado.md:2915` — **Cerrado el 2026-09-25 (orquestador, derivado de `DEC-SUB-020`)**: el mismo correo de contracargo (`NUCLEO/07` §6; pendiente 8).
- `B/docs/03-maquinas-de-estado.md:2919` — ⚠️ **Lo que `S31` deja abierto** (FASE 8 completa, pendiente 8):
- `B/docs/03-maquinas-de-estado.md:2920` — **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: desde `ACTIVE`, `S31` lleva a la sucesora a **`CANCELLED`**, no a `SUSPENDED`. Deja de ser fila viva, la sucesión se cae como en `S3` —sin `S18`—, la reevaluación de la rama 2 encuentra cumplida la condición 3, y la persona vuelve por la predecesora `SUSPENDED` con una sucesión desde `SUSPENDED` de tarjeta (`G-R1-A`).
- `B/docs/03-maquinas-de-estado.md:2930` — **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: el barrido; `S31` entra en la salvedad 4 de `B/09` §3, que pasa de once a doce filas (y a **trece** con `S16`, FASE 8 completa, owner 2026-09-25).
- `B/docs/03-maquinas-de-estado.md:2936` — **Qué aviso recibe la persona por la sucesora cortada.** El de `S3` —*«venció tu plazo»*— no aplica; si el correo de contracargo de la predecesora lo cubre no está dicho.
- `B/docs/03-maquinas-de-estado.md:2938` — **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: el barrido relee también los pagos en `CHARGED_BACK` hasta que su `status_detail` se resuelva —`settled` o `reimbursed`—, y esa lectura dispara el correo que corresponde de `NUCLEO/07` §6 (`B/09` §3).
- `B/docs/03-maquinas-de-estado.md:2945` — **Cerrado el 2026-09-25 (FASE 9 completa, contradicción 2 de `03` §R6.5)**: `S31` entra en las dos enumeraciones de `B/16` §4.3 —la lista pasa de doce a trece— y `A5` remite a esa lista en vez de copiarla (§8).
- `B/docs/03-maquinas-de-estado.md:2954` — **Los seis cruces del §52** son `E-CONC-01`, del capítulo 05. Acá quedan nombrados **uno** —el pago manual simultáneo al del proveedor — sin resolverlos. **El cambio de plan en grace ya no es un cruce: no existe** desde `DEC-SUB-021` (owner 2026-09-25).
- `B/docs/03-maquinas-de-estado.md:2957` — **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: antes de aceptar el cambio de plan de un pagador con tarjeta, `S1` relee por id el preapproval de la predecesora `ACTIVE` y exige `authorized`; si no lo está, el cambio no se ofrece —*«tu último cobro no entró, actualizá tu tarjeta»*, el camino de `DEC-SUB-021`— y la relectura corre la transición que corresponda por el §10.1, que sobre `paused` es `S6` por su segundo evento (§3.2, `S1` y `S6`; `B/20` §2, `G-R1-A`; `B/19` §4 fila 17-ter).
- `B/docs/03-maquinas-de-estado.md:2967` — **CERRADA** por `DEC-SUB-014` (owner, 2026-09-21): corta en el acto, con la fecha de fin de servicio en el día de la cancelación, y la ejecuta **`S24`** (§3.2). De las dos respuestas posibles que este § declaraba abiertas —cortar hoy o dejar correr el reloj del grace— el owner eligió la primera, por el criterio que ya gobierna `S22` y `S23`: *«no queda período pagado que sostener»*.
- `B/docs/03-maquinas-de-estado.md:2972` — **CERRADA LA MITAD DEL CHOQUE**, por `DEC-SUB-015` (owner, 2026-09-21), y **no dándole a la pausada la fila que le faltaba sino sacándola del acto**: la pausada **no entra al piso**, se queda `PAUSED` sobre una vertical que ya tiene fecha de cierre —eso es legal y está escrito en `B/10` §4.3—, se le avisa **el día del anuncio** (`NUCLEO/07` §6, `B/19` §4 fila 14-bis) y su fila termina cuando la pausa termina, por **`S25`** (§3.2). **El §3.3 no cede**: sigue sin existir `PAUSED → CANCEL_SCHEDULED`, y la contradicción se resolvió corrigiendo la instrucción que lo pedía, no la prohibición.
- `B/docs/03-maquinas-de-estado.md:2980` — **CERRADA** por la FASE 9-bis-5 (defecto `F3` del censo), y **no era una pregunta al owner**: `B/10` §4.3 ordena el movimiento, `S11` no lo ejecuta —su evento es *«pide la baja»*, un acto del cliente sobre su propia fila, y esto lo decide `SUPER_ADMIN` sobre la cartera entera de una vertical— y lo único que faltaba eran las filas. **Son tres y no una** —`S26`, `S27` y `S28` (§3.2)—, porque el destino cambia con lo que cada estado emite: `ACTIVE` y `GRACE_PERIOD` al piso de `CANCEL_SCHEDULED`, `SUSPENDED` a `CANCELLED` y `PENDING_AUTHORIZATION` a `ABANDONED`. **`DEC-SUB-015` no resolvió esto y no pretendía hacerlo**: resolvió a quién alcanza el piso, no qué transición lo ejecuta.
- `B/docs/03-maquinas-de-estado.md:2989` — **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): las dos entradas de arriba quedan como historia, porque **el acto ya no existe**. `S25`–`S28` están retiradas en la tabla del §3.2 con su número, y discontinuar una vertical queda **fuera de esta versión; si algún día hace falta, se diseña entonces** (`B/10` §4). Retirar todos los planes de una vertical sigue siendo posible y no mueve ninguna fila de esta máquina (`B/10` §3.6).
- `B/docs/03-maquinas-de-estado.md:2994` — **Un cobro en vuelo que se acredita después de un `S6` por contracargo** entra por `S7` a `CANCEL_SCHEDULED` y devuelve servicio hasta el fin de ese período (FASE 9 completa, borde R3-c; declarado por `DEC-METH-015`). **Causa**: `S7` se escribió para el borde del impago, y sus condiciones no miran por qué evento corrió `S6`. Tiene que coincidir un reintento en vuelo con un contracargo sobre la misma fila, y la marca `CONTRACARGO` ya abierta pone a una persona delante.
- `B/docs/03-maquinas-de-estado.md:3000` — **`S6` y `S17` no tienen plazo en la rama transitoria del correo** (FASE 9 completa, borde 1 de §R5.5.2 de `04`; declarado por `DEC-METH-015`). Reintentan su propia transición en cada corrida y, mientras el correo no sale, el moroso conserva el servicio (`S6`) o la predecesora sigue cobrando (`S17`, ya dicho en `B/12` §5.4). **Causa**: el plazo de 3 días se escribió para las filas que el barrido reintenta (`B/09` §3), y estas dos no son de ese grupo. Es de borde mientras la falla sea transitoria de verdad: la que no pasa —el correo que agota sus reintentos— ya no bloquea desde la decisión 1 del owner (2026-09-25; §3.2, *«el correo antes de cancelar»*, tercera rama), así que la cota es la de los reintentos del outbox.
- `B/docs/03-maquinas-de-estado.md:3008` — **Un contracargo sobre una predecesora `SUSPENDED` no corta a su sucesora** (FASE 9 completa, borde 3 de §R7.5.2 de `04`; declarado por `DEC-METH-015`). `S31` corre sólo detrás de `S6` o `S12`, y desde `SUSPENDED` ninguno de los dos corre: la regla del 📌 de `DEC-SUB-020` —*«si la fila da servicio, se corta; si no, sólo la marca»*— se aplicó a la fila y no a su sucesión. **Causa**: la sucesión desde `SUSPENDED` (`G-R1-A`) y el corte de la sucesora (`S31`) se escribieron en pasadas distintas. La marca `CONTRACARGO` queda abierta y la persona que la sigue ve la sucesora.
- `B/docs/03-maquinas-de-estado.md:3015` — **El grace de una sucesora que nunca cobró puede correr hasta un día sobre un preapproval que el proveedor ya canceló** (FASE 9 completa, 3c; declarado por `DEC-METH-015`). Desde la decisión 3c del owner, la sucesora cuya predecesora venía pagando va a `S4` y no a `S16` (§3.2), y si el proveedor canceló el preapproval al rechazar el primer cobro (`PA-6`, `UNKNOWN`: medido sólo ante el antifraude), ese grace no puede terminar en pago. **El control es el barrido diario**, que relee el preapproval por id y corre `S6` en el acto sobre `cancelled` o `paused`; entre el rechazo y esa corrida la persona tiene servicio sin cobrar. **Causa**: el owner eligió no dejar sin nada a quien venía pagando, contra la recomendación, sobre una fila `UNKNOWN`. Cuando `PA-6` se mida, se revisa.
- `B/docs/03-maquinas-de-estado.md:3024` — **`S6` por su segundo o su tercer evento que muere entre la llamada y la escritura** (FASE 9 vuelta 1, `F-8V1B2-004`; declarado por `DEC-METH-015`). El espejo del §10.1 lleva la fila a `CANCELLED` en vez de `SUSPENDED`, sin el aviso de suspensión. **Causa**: esos dos eventos —la pausa del proveedor y el contracargo— no dejan en nuestra base un dato que el par pueda leer antes de que `S6` escriba; el primero sí —el reloj agotado—, y por eso tiene su salvedad en el par. No mueve plata: el preapproval ya está cancelado. En el caso del contracargo sobre una predecesora, la sucesora sobrevive con la marca `CONTRACARGO` abierta, que es su detector.
- `B/docs/03-maquinas-de-estado.md:3031` — **El espejo reconoce una cancelación nuestra por el correo «antes de cancelar», no por la llamada** (FASE 9 vuelta 3, `F-8V3B2-004`; declarado por `DEC-METH-015`, residuo del arreglo `R18` de la vuelta 2). Falla en las dos direcciones: el correo de un `S6` que releyó el pago y no llamó sigue ahí meses después, y una baja que la persona da desde su cuenta de Mercado Pago recibe `CANCEL_SCHEDULED` en vez del corte (regala el período ya pagado); y sobre un destinatario suprimido (`NUCLEO/07` §4.2, rebote duro) `S6` cancela sin correo, así que si además perdió su escritura frente a `S5`, el espejo corta en el acto a quien acababa de pagar. **Causa**: la llamada de cancelación no deja en nuestra base un registro persistido antes de salir, y agregarlo es un mecanismo que ninguna decisión pidió. Las dos ramas exigen una carrera y otra condición (una baja desde la cuenta meses después, o un rebote duro con la escritura perdida); la primera no mueve plata y la segunda la ve la persona que reclama con su cobro.
- `B/docs/03-maquinas-de-estado.md:3042` — **La segunda transferencia del mismo período, y la que llega sobre una fila `CANCELLED`, se asientan por `MP6`** (FASE 9 vuelta 3, owner 2026-09-30, lote W): un segundo pago del período que abre `COBRO_DUPLICADO` con propuesta de devolver (§7), **o, sobre una `CANCELLED` cuya última cuota quedó `DECLARED_UNPAID`, un cobro posterior a la baja que abre `COBRO_POSTERIOR_A_LA_BAJA`, también con propuesta de devolver** (FASE 9 vuelta 3, owner 2026-09-30, lote AF), **y lo mismo sobre una `ABANDONED` de pagador manual con la primera cuota `DECLARED_UNPAID`** (FASE 9 vuelta 3, owner 2026-09-30, lote AM). **Lo que queda, declarado por `DEC-METH-015`**: la transferencia que llega **de más** dentro de una cuota abierta no se ve, porque la fila de `manual_payment` no guarda monto y el admin registra la cuota con `MP1`; la diferencia la devuelve por fuera, sin rastro. **Causa**: el monto no se guarda a propósito (`B/02` §2.3). No da acceso ni borra, y la plata la ve la persona que reclama con su comprobante. **Lo mismo con la transferencia sobre una suscripción que nunca tuvo un cobro acreditado ni una cuota**: `MP6` no tiene período con qué chocar y no corre, así que también se devuelve por fuera. Exige una transferencia a una suscripción que nunca llegó a cobrar.

### `B/docs/05-idempotencia-y-concurrencia.md` — 4. Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:544`–`557`.

- `B/docs/05-idempotencia-y-concurrencia.md:546` — **El reembolso de un duplicado** lo confirma una persona (`DEC-CONC-001`) y su asiento es el de `B/02` §2.3, con la máquina de `B/03` §6.1 (FASE 9 completa, C-R7-5: el capítulo 13 no existe, se repartió).
- `B/docs/05-idempotencia-y-concurrencia.md:550` — **La conciliación periódica** —lo que encuentra lo que estos cruces dejaron pasar— es del capítulo 09.
- `B/docs/05-idempotencia-y-concurrencia.md:552` — **El de un cobro más viejo que el plazo del proveedor no se implementa** (`DEC-RF-007`; `RF-3` sigue `UNKNOWN`): si hay que devolverlo, se hace por fuera y se asienta por `RF4` (`B/03` §6.1) (FASE 9 completa, C-R7-5).

### `B/docs/06-proveedor.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:508`–`570`.

- `B/docs/06-proveedor.md:510` — **Escrita acá el 2026-09-24, en el §4.6**, porque es **trato con el proveedor** y no otra cosa. Y ya no arrastra `RF-3`: `DEC-RF-007` sacó del alcance la operación que esa fila medía.
- `B/docs/06-proveedor.md:513` — **La conciliación** es del capítulo 09.
- `B/docs/06-proveedor.md:514` — **Los correos que el proveedor manda por su cuenta** son del capítulo 07.
- `B/docs/06-proveedor.md:515` — **Cerrado el 2026-09-25 por `EX-41`** (sonda 51, sandbox): es idempotente por la clave. Queda sólo producción.
- `B/docs/06-proveedor.md:518` — **Los dos canales de avisos del proveedor: medidos el 2026-09-29, y el canal IPN se escucha y se guarda sin actuar** (revisión del owner, 2026-09-28, N9 y `L3-g`; mediciones del 2026-09-29, M-2 y punto 2). El proveedor avisa por **dos canales**, Webhooks e IPN, y un mismo hecho puede llegar por los dos (`RF-7`: tres entregas por una devolución, una de Webhooks y dos de IPN). **El código de hoy descarta en silencio todo lo que llega por IPN**: el receptor de hospeda2 contesta `200` a toda entrega sin el marcador `source_news=webhooks` que el propio sistema le agrega a la URL, con un log de nivel `debug` (HOS-159). No es de `qzpay`. **Lo medido** (`WH-6`, `WH-5` y `EX-15`, 2026-09-29, sandbox con los dos canales escuchando y producción por sus logs): **IPN entrega sólo `payment`**, sin firma que se pueda verificar con la clave de la aplicación (`EX-13`) y sin `version` (`EX-2`); **ningún hecho de suscripción llega por IPN que no llegue por Webhooks**; y **cada `payment` llega una vez por cada canal**, a milisegundos y sin canal que llegue primero. La contaminación que esta entrada temía no estaba: `WH-5` y `EX-15` se cerraron con los dos canales escuchando. La salvedad de `RF-7` sigue: en producción IPN trajo una vez un `merchant_order` tras un reembolso de `/v1/payments`. **Qué hace el receptor nuevo con IPN, decidido por el owner** (mediciones del 2026-09-29, M-2, que reemplaza a los casos 39 y G-D): **escucha el canal y guarda cada entrega, sin actuar**. La guarda entera en **`provider_notification`** (`B/02` §2.7), una tabla sólo de altas que **ninguna decisión lee** y que `G17` nombra (`B/20` §2), con **180 días de retención técnica, no configurable** (`NUCLEO/02` §1.5); y no hace nada más con ella: **las entregas `payment` llegan por los dos canales, y el receptor procesa sólo la de Webhooks**. **Y guarda en la misma tabla cada entrega de Webhooks, con su canal**, además de procesarla, para que la revisión de HOS-1399 tenga los dos lados; esa copia tampoco la lee nadie (mediciones del 2026-09-29, lote L-B, que le cambió el nombre a la tabla). **Se revisa tres meses después del corte** (HOS-1399 (`https://linear.app/hospeda-beta/issue/HOS-1399`)): lo guardado de IPN contra lo recibido por Webhooks, para decidir si se apaga. **El panel de la aplicación de producción queda con IPN activo**, y **su URL no cambia en el corte: el receptor nuevo sirve la misma ruta que el viejo, `/api/v1/webhooks/mercadopago`, para los dos canales, y el 4b sólo verifica que llega** (`16-fase-7…` §4.2, pasos 3, 4 y 4b; verificación corta, 2026-09-29, lote O-B). **El Worker del borde que cerraba la ruta del paso 3 al 4 salió, con las lápidas del corte que esperaba**: un aviso de un débito viejo que llega es un desconocido más (FASE 5, simplificación del corte, S-45). **Cómo sabe el receptor por qué canal entró una entrega**: por la URL a la que llegó, que es una por canal en el panel, como hoy (`source_news=webhooks` en la de Webhooks); nunca por el cuerpo, que `G17` le prohíbe leer. **Y el requisito del owner sigue**, ahora sobre un solo canal procesado: **un aviso duplicado del mismo hecho no puede producir efecto doble**: ninguna escritura, ningún correo ni ningún aviso de cobertura dos veces. Con `D17` la relectura por id ya lo sostiene en el estado, pero no alcanza con decirlo: **lleva su prueba explícita**, un mismo `payment` entregado dos veces por Webhooks a medio segundo (`WH-1`) y una por IPN en el mismo segundo, en cualquier orden, que deja exactamente una escritura y un correo, y las tres entregas guardadas en `provider_notification`, cada una con su canal, y la de IPN en ningún otro lado (mediciones del 2026-09-29, punto 3 y lote L-B). **Causa**: el filtro se agregó porque a veces llegaban dos avisos del mismo hecho, uno por cada canal (hecho del owner).

### `B/docs/09-conciliacion.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:1166`–`1312`.

- `B/docs/09-conciliacion.md:1168` — **`RF-3` sigue `UNKNOWN` pero ya no bloquea**: `DEC-RF-007` decidió que reembolsar un cobro más viejo que el plazo del proveedor **no se implementa**, la reparación es manual y con rastro. El capítulo 13 no existe: se repartió (`nucleo/00-indice.md`).
- `B/docs/09-conciliacion.md:1173` — **Actualizado el 2026-09-24**: ya se sabe cuántas veces reintenta y en qué estado deja la suscripción —cuatro intentos dentro de **un ciclo**, y al vencer **pausa** (`GR-3`, sonda 49)—, y con `DEC-SUB-019` el grace cancela el preapproval antes de que eso pase. (tachado 2026-09-26): `RN-3` salió a `PARTIALLY_SUPPORTED` el 25/09 noche y `GR-1` a `VERIFIED` el 26/09) **Sigue `UNKNOWN` `GR-2`**; ninguna bloquea este capítulo. El número que quedaba —cuántas corridas espera el barrido un cobro *«todavía no se sabe»*— **lo fijó el owner el mismo día: una** (§6.2), **y a los 3 días abre la marca con motivo `COBRO_DEL_PERÍODO_SIN_RESOLVER`** (§6.2; owner 2026-09-25, FASE 9 completa, 3d).
- `B/docs/09-conciliacion.md:1185` — **El pago del addon de única vez no está en el inventario de este capítulo** (corrección de diseño, FASE 8 completa, `F-8CB1-008`). Se cobra por `/v1/orders`, sin preapproval (`B/16` §1.4), y su `payment` cuelga de la instancia y no de una suscripción (`B/02` §2.3): el §2.1 arma el inventario de suscripciones, el §2.2 detecta huérfanas por *«un preapproval desconocido»* y el §4 lee `authorized_payments`, así que **ninguna de las tres partes lo alcanza**. **Desde la FASE 9 vuelta 2 (owner 2026-09-27, `R4`) hay una comprobación, y una marca que cuelga de la instancia**: la orden pagada cuya instancia terminó `ABANDONED` (§3, el motivo 23). **Lo que sigue sin escribir es el resto**: el pago de una instancia que llegó a `ACTIVE` no se relee —un contracargo o un reembolso desde el panel sobre él no lo ve nadie—. **Sale la parte del corte** (FASE 5, owner 2026-09-30, simplificación del corte, S-43, S-44 y S-72): no se vencen por API las `Preference` del viejo ni cuenta la ventana de 30 minutos; quien tenga una abierta es una de las cinco cuentas, a quien el owner le pide no pagar nada en el viejo (`DEC-MIG-007`). El vacío de arriba, el del pago de única vez, es producto y queda.
- `B/docs/09-conciliacion.md:1210` — **Cerrado el 2026-09-25**: se mide tiempo, 3 días desde la transición y 1 día desde el registro de cobro del §6.2 (§3, punto 2), y vale también para la `CANCEL_SCHEDULED` de `S11` (FASE 8 completa, `F-8CB1-013`; `S26` salió con la revisión del owner, 2026-09-28, C8).
- `B/docs/09-conciliacion.md:1212` — **CERRADA** por el owner el 2026-09-25: **abierta la marca, el barrido deja de reintentar** (§3, *«el reintento de una cancelación nuestra»*, punto 2).
- `B/docs/09-conciliacion.md:1217` — **CERRADA** por el owner el 2026-09-25: **sale una vez por cancelación, antes del primer intento**, y los reintentos no lo repiten si ya se entregó (`B/03` §3.2, precisión 3).
- `B/docs/09-conciliacion.md:1222` — **La longitud de la ventana de la comprobación de pagos acreditados** (§3; FASE 8 completa, `F-8CB3-009`). Es configuración **(entra a la lista cerrada de `NUCLEO/02` §1.5 con valor a proponer al owner; FASE 9 vuelta 3, `F-8V3B3-003`)** y **no está medida**: ninguna fila de la matriz dice cuánto después de acreditado un pago puede llegarle un contracargo. Y todo el comportamiento del proveedor en un contracargo es **documental** (`RC-8`, `UNKNOWN`): no se puede fabricar uno a voluntad.
- `B/docs/09-conciliacion.md:1229` — **Cerrado el 2026-09-25 (owner)**: el segundo es el motivo **20**, `COBRO_DUPLICADO`, con `SÍ` y default de devolución (`B/02` §2.5, `B/19` §6; FASE 8 completa, pendiente 6, owner 2026-09-25).
- `B/docs/09-conciliacion.md:1235` — **Cerrado el 2026-09-25 (orquestador, FASE 8 completa, pendiente 8)**: lleva **no** —la plata entró bien, falta asentarla—, y la columna se recontó entera: siete SÍ, tres puede, diez no (`B/02` §2.5).
- `B/docs/09-conciliacion.md:1240` — **Cerrado el 2026-09-25 (owner)**: `S5` asienta el cobro en el mismo acto —lo lee por id y corre `P1`, creando la fila si no existe—, y si no puede, no ocurre en esa corrida (`B/03` §3.2; FASE 8 completa, pendiente 6, owner 2026-09-25).
- `B/docs/09-conciliacion.md:1245` — **Cerrado el 2026-09-25 (owner)**: busca por `payer_email` sin filtro de estado, clasifica de nuestro lado y, si encuentra un `pending`, lo reusa (§7; FASE 8 completa, pendiente 6, owner 2026-09-25).
- `B/docs/09-conciliacion.md:1250` — **El registro de corridas del §7.1 no tiene entidad en `B/02`** (FASE 8 completa, `F-8CB3-007`). **La mitad del vigía se cerró el 2026-09-25 (owner)**: es un monitor de cron externo que recibe un ping por corrida completa (§7.1; FASE 8 completa, pendiente 6, owner 2026-09-25). Siguen abiertos la elección concreta (FASE 10), si el plan contratado lo incluye y el canal de su alerta.
- `B/docs/09-conciliacion.md:1255` — **`COBRO_DUPLICADO` desde `P1` casi no tiene población** (FASE 9 completa, borde 1 de §R7.5.2 de `04`; declarado por `DEC-METH-015`). El período de un cobro del proveedor se identifica por el `date_created` de su registro (`B/02` §2.3), que es un instante y distinto en cada registro, así que el `UNIQUE` de `covered_period` sólo choca si dos cobros de la misma suscripción comparten registro, y eso lo resuelve antes `C6`. **Causa**: se eligió la fecha que no se mueve con un reintento, y ese mismo rasgo la vuelve única. Un doble cobro entre dos preapprovals de la misma persona sigue siendo el de la condición 3 de `B/05` §3, no éste.
- `B/docs/09-conciliacion.md:1262` — **Una fila cuya lectura por id falla siempre vuelve incompleta toda corrida** (FASE 9 completa, borde 2 de §R7.5.2 de `04`; declarado por `DEC-METH-015`). Es el modo *«id de otra cuenta»* del §4, y con él el vigía del §7.1 alerta todos los días. **Causa**: *«completa»* se definió como cero filas fallidas sin distinguir la falla transitoria de la permanente. Hasta que se distinga, una fila así se resuelve a mano antes de que la alerta pierda sentido.
- `B/docs/09-conciliacion.md:1267` — **Un `pending` duplicado que aparece recién después de `S2` queda vivo** (FASE 9 vuelta 1, `F-8V1B2-008`; declarado por `DEC-METH-015`). **Causa**: el barrido de creaciones deja de buscar cuando la fila sale de `PENDING_AUTHORIZATION` (§7), y un `pending` no vence (`EX-1`). No mueve plata: su enlace nunca se le mostró a nadie, porque la respuesta de esa creación se perdió. Si igual se autorizara y cobrara, llega como desconocido que nombra una fila vinculada: `PAGO_TARDÍO_RECHAZADO`, con **SÍ** (§2.4).
- `B/docs/09-conciliacion.md:1273` — **La cortesía diferida cuya sucesora cayó en `GRACE_PERIOD` sin que `S9` corriera no la ve nadie hasta que la fila vuelve a `ACTIVE`** (owner 2026-09-26, P1; FASE 9 vuelta 1). **Causa**: la sexta comprobación de cero llamadas del §3 busca la sucesora en `ACTIVE`, y se eligió no ensancharla porque sobre una fila en el grace `S9` no tiene `desde` y la marca no tendría acción posible. La población exige un proceso caído entre `S2` y `S9` —el `PUT` fallido ya deja `PAUSA_NO_APLICADA`—, un primer cobro antes del barrido, que se rechace y una predecesora que venía pagando (`DEC-SUB-022`). **Lo que deja**: si la persona no paga, `S6` la suspende, pierde acceso durante meses que tenía regalados, recibe avisos de mora por un período que la cortesía cubría, y el saldo queda diferido sin emitir —ninguno de los `motivo_cierre` de `B/02` §2.4 describe ese desenlace —. **La reparación**: `SUPER_ADMIN` vuelve a otorgar la cortesía cuando la fila vuelva a `ACTIVE`, el primer disparador de `S9`, con el mismo argumento que `DEC-GRANT-011`. Si paga en el grace, `S5` la devuelve a `ACTIVE` y la comprobación la levanta con su devolución.
- `B/docs/09-conciliacion.md:1286` — **La marca de la sonda del manifiesto nace proponiendo devolverle al owner su propio cobro** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-p`; caso 3 de `29-fase-8-vuelta-2/12-` §5; declarado por `DEC-METH-015`). El cobro de una sonda enumerada en el manifiesto del corte abre `PAGO_TARDÍO_RECHAZADO` (§2.4), y el listado de `B/19` §6 propone devolver en toda marca de ese motivo, porque la propuesta no depende de nada más que el motivo (`DEC-RF-006`). **Lo que deja**: una propuesta que no se sigue, sobre la tarjeta del owner. **El owner la levanta sin devolver, y no hay motivo nuevo**: uno propio para la sonda rompía la regla de que la propuesta sale del motivo, por una población que es sólo del owner y se cierra con la medición. **Causa**: la sonda cobra por diseño mientras su medición está abierta, y el id que lo explica está en el manifiesto, no en la marca.
- `B/docs/09-conciliacion.md:1296` — **La orden de un addon de única vez que `A3` abandonó sin id sólo se ve si el proveedor deja buscarla por el identificador del pedido** (FASE 9 vuelta 3, owner 2026-09-30, lote E, `F-8V3B1-001`). **El proveedor la deja buscar: `EX-57` es `VERIFIED` desde el 2026-09-30, en sandbox y con ventana, y la compra sin id de orden tiene detector** (§3, la comprobación de órdenes pagadas; residuo corregido el 2026-10-02). **Lo que queda abierto** es lo que la medición no cubrió: producción, que se lee sin mutar con la referencia de la primera orden real, y un pedido de más de 30 días, el rango máximo de la búsqueda (matriz, `EX-57`). **Causa**: `A3` dejó de reenviar para no crear órdenes que nadie pidió (`EX-43`, `UNKNOWN`), y sin el id de la orden **la única lectura es esa búsqueda**. Exige una respuesta perdida y un proveedor que igual creó y cobró la orden.
- `B/docs/09-conciliacion.md:1308` — **Dos devoluciones parciales del mismo monto sobre el mismo pago, las dos con la respuesta perdida**, no se pueden atar solas a su fila (sobre una orden no pasa: sus devoluciones se serializan y la nueva sale por resta, §3; FASE 5, owner 2026-09-30, lote 5 F) (FASE 9 vuelta 3, `F-8V3B1-004`, `F-8V3B2-003`; declarado por `DEC-METH-015`): el reenvío de la misma clave no trae el id (`RF-6`) y la relectura del pago muestra dos candidatas iguales. El barrido no elige y abre el motivo 18 con la fila `CONFIRMED` a la vista; la persona que lo resuelve ve las dos. **Causa**: el proveedor no devuelve el id en la repetición. Es de borde: exige dos parciales iguales y dos respuestas perdidas.
- `B/docs/09-conciliacion.md:1316` — **Si el preapproval de una fila cancelada por el proveedor tras un rechazo vuelve a leerse vivo pasada la ventana de relectura de la cancelación por rechazo**, la fila ya salió del barrido y sólo la devuelve el aviso del cobro (FASE 9 vuelta 3, owner 2026-09-30, lote K, `F-8V3B3-002`). **Causa**: la ventana acota la relectura en el tiempo, que es lo que el owner eligió frente a releer para siempre; su valor es de 7 días al inicio, fijado por el owner sin medición (FASE 9 vuelta 3, owner 2026-09-30, lote R), y `EX-45` dirá si alcanza. **Dentro de la ventana, en cambio, el barrido manda la cancelación** (lote U, §3).

### `B/docs/10-verticales-planes-billing-options.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:248`–`271`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:248

- `B/docs/10-verticales-planes-billing-options.md:250` — **El detalle del cambio de plan** —cómo se ejecuta contra el proveedor, qué se compensa— es del capítulo 12 (épica de billing). Acá está sólo qué hace billing con el veredicto de dirección —que rige todo cambio de plan y lo emite verticales (`12-contrato…` §4.1, `DEC-ARCH-008`)—, escrita junto al caso del plan retirado.
- `B/docs/10-verticales-planes-billing-options.md:254` — **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora** sigue abierto: lo dejó anotado `DEC-MP-002` y no lo cierra este capítulo.
- `B/docs/10-verticales-planes-billing-options.md:256` — **La migración de un plan retirado** (§3.7) deja una cosa sin cerrar, declarada: **qué pasa si la fecha de aplicación cae sobre una suscripción en mora**, que es el mismo hueco que `DEC-MP-002` dejó para el aumento (arriba): el §3.7 la hace esperar a que se ponga al día. **Eso vale para el día de `S37`**: con el monto ya mutado, la fecha la aplica `S38` igual en `GRACE_PERIOD`, y al volver por `S7` en `SUSPENDED` (revisión del owner, casos vecinos, 2026-09-29, caso G-A), vuelva a `ACTIVE` o a `CANCEL_SCHEDULED` (caso I-A); y con un pagador con tarjeta que vuelve como sucesora, muere con la fila vieja (caso I-B). **Un cliente con una cortesía temporal vigente el día de su migración espera, como está**: está `PAUSED · COURTESY`, espera a volver, y su fecha se corre tantos meses como le queden de cortesía (revisión del owner, casos vecinos, 2026-09-29, caso 27).
- `B/docs/10-verticales-planes-billing-options.md:268` — **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): **fuera de esta versión; si algún día hace falta, se diseña entonces** (§4). Lo que sí existe es retirar todos sus planes (§3.6), que la deja en operación sin vender.

### `B/docs/12-suscripcion.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1104`–`1191`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1104

- `B/docs/12-suscripcion.md:1106` — **La vuelta anticipada de una pausa regala hasta un ciclo, y se acepta** (owner 2026-09-26, `G5-3`, contra la recomendación; FASE 9 vuelta 1, `F-8V1B1-001`). `S10` deja volver el día que la persona quiera —*«volver cuando quiera»*, §26.2 del PDR a la letra—, y con `PS-2`, `PS-5` y `PS-6` medidos el día de arranque y el de vuelta deciden cuánto se paga: quien cobra el 1, pausa el 30 y vuelve el 2 tiene el mes siguiente gratis, porque el proveedor salteó el cobro mientras estaba `paused` y al volver cobra en el ciclo siguiente. **Y no depende de cuánto dure la pausa**: pausar tres meses y volver el segundo día de un ciclo regala 29 días (FASE 9 vuelta 1, `N-2`). Son **hasta tres ciclos gratis por año por cliente**, y **el sobrecobro inverso** —pausar el 5 y volver el 25— **sigue existiendo**: la persona paga el ciclo entero en el que casi no tuvo servicio. **Causa**: la premisa de `DEC-SUB-010` —*«vuelve el mismo día del mes en que pausó»*, así que la pausa dura ciclos enteros y la aritmética se compensa sola— no se sostiene con la vuelta libre, y el owner prefirió la libertad del §26.2 a acotarla al aniversario mensual. **Nada lo impide y nada lo compara** —nuestro estado y el del proveedor coinciden en cada paso—, así que lo que queda es **medirlo**: el barrido lista esas pausas en el resumen de `DEC-OBS-001` (`NUCLEO/08` §4.1; `B/09` §2.3). La misma entrada está en `B/03`, *«lo que esta mitad NO cierra»*.
- `B/docs/12-suscripcion.md:1121` — **Cerrado**: `GR-3` está `VERIFIED` y la ventana es el ciclo (§1.5). Queda sin medir la ventana mensual y anual, que (tachado 2026-09-26) **ya no condiciona esa salida: `GR-1` quedó `VERIFIED` el 2026-09-26 y el cambio de tarjeta dispara su propio reintento** (§1.5).
- `B/docs/12-suscripcion.md:1127` — **Qué pasa si la fecha de un aumento cae sobre una suscripción en MORA** —no pausada— lo dejó abierto `DEC-MP-002` (implicación 6) y **sigue abierto**: el §6 resuelve la pausa, no el grace.
- `B/docs/12-suscripcion.md:1129` — **Está escrito en `B/06`, desde el 2026-09-24**: el checkout y su ventana en su §6, el saneo del `init_point` en su §4.2, la verificación por relectura en su §4.1 — y **la mecánica del reembolso en su §4.6**. Es **trato con el proveedor**, y por eso vive en el capítulo del proveedor.
- `B/docs/12-suscripcion.md:1134` — **Deja de ser borde: corregido** (owner 2026-09-25; FASE 9 completa, 9a). El barrido corre `S4` cuando su lectura da *«intentó y se rechazó»* sobre el período en curso de una fila `ACTIVE` con al menos un pago acreditado (§1.2; `B/09` §3; `B/03` §3.2 fila `S4`).
- `B/docs/12-suscripcion.md:1144` — **Lo que 9a deja afuera: la sucesora de 3c cuyo primer rechazo se pierde entero** (FASE 9 completa, 9a; declarado por `DEC-METH-015`, FASE 9 completa). La rama del barrido exige al menos un pago acreditado **en la fila**, y la sucesora que venía pagando todavía no tiene ninguno: si el aviso de su primer rechazo no llega, queda `ACTIVE` hasta que el proveedor la pause o la cancele y la comparación de estado del barrido lo lea (`B/03` §10.1; §4.3). **Causa**: el owner acotó la rama nueva a la fila con pago propio. Es un ciclo de servicio sin cobrar como mucho, sobre una población de borde de otra.
- `B/docs/12-suscripcion.md:1150` — **Una sucesora con tarjeta cuyo crédito cubre menos que su ventana** emite desde `S2` hasta su primer cobro sin haber pagado esa diferencia —hasta 72 h— (§4.3; FASE 9 completa, borde R8-a de `01`; declarado por `DEC-METH-015`). **Causa**: `D8` pone el primer cobro después de la ventana y el crédito puede ser menor. Una vez por cambio de plan y sobre alguien que venía pagando. Desde `DEC-SUB-021` la sucesora **sin** crédito ya no existe (la de `SUSPENDED` cobra al autorizar), así que lo que queda es la de **poco** crédito.
- `B/docs/12-suscripcion.md:1156` — **La ventana reducida con dos minutos de margen, o con `S17` fallida** (§5.4; FASE 9 completa, borde R8-b de `01`; declarado por `DEC-METH-015`). Si la fecha del cobro de la predecesora cae apenas pasadas las 00:00, el margen entre la relectura del corte y el primer lote es de **dos minutos** —y no está medido que los lotes corran todas las horas—; y si la cancelación de `S17` falla por una causa transitoria, `S17` no ocurre en esa corrida (`B/09` §3) y la predecesora cobra igual. En los dos casos ese cobro **no tiene detector**: entra `SUCCEEDED` sobre una fila que `S17` después cierra con relectura, y el barrido la deja exenta. **Causa**: la corrección relee en el corte, y el primer lote puede caer dos minutos después. Tiene que coincidir una autorización en los últimos minutos, un webhook demorado y, o bien un cobro fechado a las 00:00-00:02, o una cancelación de `S17` fallida: es doble cobro, sobre la intersección de tres bordes.
- `B/docs/12-suscripcion.md:1166` — **Cancelar o pausar desde la cuenta de Mercado Pago, y no desde Hospeda: medido el 2026-09-29; queda un hueco, y el owner lo acepta** (revisión del owner, 2026-09-28, N8; mediciones del 2026-09-29, punto 1 y lote L-A). **Se detecta**: el aviso dispara una relectura por id (`B/03` §10.1) y el barrido relee cada día toda fila no terminal (`B/09` §3), así que a más tardar al día siguiente. **Lo medido** (`EX-52`, `EX-53`, `EX-56`): **el pagador puede cancelar desde su cuenta y no puede pausar**, y su baja llega como un aviso del preapproval, sólo por Webhooks, **sin ningún campo que la distinga de una nuestra**: la autoría sólo la da nuestro propio registro (si no la pedimos, vino de afuera). **Y el autoservicio existe porque el alta de este diseño va por checkout** (`B/06` §2, fila 1): un alta por API con token queda a nombre de un pagador invitado que no la ve. **De los dos huecos, uno se cerró con la medición y el otro sigue**: (1) **cancelar desde la app del proveedor corta el servicio en el acto y pierde lo pagado, sin aviso nuestro**: el espejo de `cancelled` sobre una fila viva sin baja programada la lleva a `CANCELLED` (§1.4, `B/03` §10.1), así que quien paga el 1 y se da de baja desde Mercado Pago el 10 pierde veinte días que desde Hospeda conservaría (`DEC-SUB-009`), y ninguna fila de `B/19` §4 le dice qué pasa con sus fichas. **Sigue, y se deja así por decisión del owner, contra la recomendación** (mediciones del 2026-09-29, lote L-A; `30-revision-del-owner/27-…`, lote L, letra A): esa baja se espeja como una del proveedor y corta en el acto (§1.4), sin regla nueva. **Consecuencia aceptada**: quien se da de baja desde Mercado Pago pierde los días que ya pagó, y la misma baja da dos resultados según dónde se dio; (2) **cerrado: el pagador no puede pausar** (`EX-53`, mirado en la web y en la app), así que un `paused` sin un `PUT` nuestro es la mora de `DEC-MP-008`, que es lo que el par ya supone. **Causa**: §1.4 y `DEC-MP-008` se escribieron para las bajas y pausas **del proveedor**, y hasta el 2026-09-29 ninguna fila de la matriz medía un acto **del pagador** desde su cuenta.

### `B/docs/14-promos-cortesias-y-grants.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:685`–`743`.

- `B/docs/14-promos-cortesias-y-grants.md:687` — **El cupo y la ventana de validez** de un código ya los fijó `DEC-PROMO-001`, y el scope *«todas las verticales futuras»* lo fijó `DEC-PROMO-002`. No se reabren.
- `B/docs/14-promos-cortesias-y-grants.md:689` — **Cómo se ejecuta la mutación del monto contra el proveedor** —y cómo se verifica— es del capítulo 13, apoyado en el 06.
- `B/docs/14-promos-cortesias-y-grants.md:691` — **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora o en grace** sigue abierto desde `DEC-MP-002` (implicación 6).
- `B/docs/14-promos-cortesias-y-grants.md:693` — **Compensar días sobre una suscripción en deuda** (`E-SUB-05`) es del capítulo 12.
- `B/docs/14-promos-cortesias-y-grants.md:694` — **Lo que la pendiente 7 dejaba abierto quedó cerrado en la pendiente 8 de la FASE 8 completa** (owner 2026-09-25 para el 4 y el 5; orquestador para el 1, el 2 y el 3):
- `B/docs/14-promos-cortesias-y-grants.md:697` — **Cerrado**: **el pedido del downgrade** (`B/12` §2) escribe `cobros_restantes = 0` (§2.2; el pedido y no el acto desde la FASE 9 completa, contradicción 1 de `03` §R6.5).
- `B/docs/14-promos-cortesias-y-grants.md:705` — **Cerrado**: el reintento de 3 días vale sólo para mutaciones nuestras —`S30` o un aumento de `DEC-MP-002`— y cuenta desde esa transición; cualquier otra divergencia abre `DIVERGENCIA_DE_MONTO` en el acto (§2.4).
- `B/docs/14-promos-cortesias-y-grants.md:712` — **Cerrado**: la comparación saltea las filas `PAUSED`, y al reanudar los 3 días corren desde `S10` (§2.4).
- `B/docs/14-promos-cortesias-y-grants.md:718` — **Cerrado**: 7 días antes, configurable; en una promo de «primer cobro» se unifica con el aviso del canje (§2.4).
- `B/docs/14-promos-cortesias-y-grants.md:723` — **Cerrado**: no la alcanza; la regla es sólo para las promos de monto (§2.5).
- `B/docs/14-promos-cortesias-y-grants.md:726` — **Lo que la pendiente 8 dejaba abierto quedó cerrado** (FASE 8 completa, owner 2026-09-25):
- `B/docs/14-promos-cortesias-y-grants.md:727` — **Cerrado**: en esa ventana el monto esperado es el del plan nuevo desde el pedido, porque `DEC-SUB-008` muta el monto en ese acto (§2.4) —**y sin promos**: el mismo pedido escribe `cobros_restantes = 0` (FASE 9 completa, contradicción 1 de `03` §R6.5; el §2.4 decía *«plan vigente»*, que en esa ventana es el viejo).
- `B/docs/14-promos-cortesias-y-grants.md:734` — **Cerrado** (residuo de la fuente): desde la FASE 9 vuelta 1 `S30` sale de `ACTIVE` **o `GRACE_PERIOD`**, y con la fila en grace `S5` y `S30` corren en el mismo acto y la mutación se aplica ([TRANS:B:S30](04-catalogos.md#trans-b-s30); [AC:B9b:5](20-fase-2/B9b.md#ac-b9b-5)). (`B/03` §3.2, fila `S30`: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:180`, `F-8V1B1-006`)
- `B/docs/14-promos-cortesias-y-grants.md:739` — **Cerrado**, y precisado por BZ: el aumento a un anclado es una migración por `S37`, y los 3 días del reintento de monto corren desde `S37`, que muta el monto siete días antes de la fecha efectiva (`B/14`, cierre de «El instante del aumento de precio»; `B/09` §3; `DEC-MP-002` y su 📌 de CC), como dice la fuente (corte del MVP, owner 2026-10-02, [BZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-bz)).

### `B/docs/16-addons.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:1039`–`1154`.

- `B/docs/16-addons.md:1041` — **Mover un destaque de una ficha a otra** queda fuera de alcance: el PDR no lo cubre y `DEC-ADDON-001` lo dejó anotado como tal.
- `B/docs/16-addons.md:1043` — **Qué pasa con una suscripción de complemento cuando la principal se va** es el §41 en su otra dirección, y está resuelto en §4.2, §4.3 y §4.4: no lo decide el estado de la principal sino si el objetivo del addon sobrevive — y cuando no sobrevive, **la fila de complemento queda `CANCELLED` en el acto** (`S21`, §4.4). **Para `LISTING` la principal sí entra en la pregunta desde la FASE 8 completa** (`F-8CA2-003`, owner 2026-09-25): no por su estado, sino porque su orfandad remite a la condición de `VERTICAL_SUBSCRIPTION` leída sobre ella (§4.2) —**sobre el conjunto de las principales de su vertical** desde la FASE 9 completa (4c)—, **y para `USER`/`GLOBAL` también**: las principales vivas y pagando de sus verticales compatibles (4d). **Y la pausa que pide el cliente pausa sus complementos** (4a, §4.2), **y la suspensión también** (owner 2026-09-26, `G2-2`), **y la baja desde `ACTIVE` les cancela el cobro en el acto y los sostiene hasta el fin de servicio** (`S11`; owner 2026-09-27, FASE 9 vuelta 2, `R1-a`): la orfandad no alcanzaba a la ventana `CANCEL_SCHEDULED`, que es fila viva, y el complemento cobraba un ciclo más. **El caso en que la principal se va porque cae un grant lo resuelve el §3.4**, y ahí la respuesta es la otra: el objetivo sobrevive y lo que se apaga es el cobro.
- `B/docs/16-addons.md:1058` — **Está escrito en `B/06`**: la ventana y sus dos plazos en su §6, y el saneo del `init_point` en su §4.2, que ya declara que *«con `DEC-ADDON-002` deja de ser un call site: cada contratación de addon necesita uno»* — **de addon recurrente** desde la FASE 8 completa: el de única vez no crea preapproval (§1.4, `F-8CB1-008`).
- `B/docs/16-addons.md:1063` — **RETIRADO el 2026-09-24: era un deber mal atribuido.** Esa implicación describía un flujo que el diseño **no tiene**, y se contradice con la implicación 1 de su propia decisión —*«no se tokeniza del lado del servidor… no manejamos datos de tarjeta»*—. **`EX-36` mide que el PROVEEDOR permite cambiar la tarjeta, no que nosotros lo hagamos**, así que **no hay operación nuestra que pueda quedar a medias**. Lo que sí vale: si el cliente no la cambia, **cada suscripción falla por separado** y corre su propio dunning (`GR-3`, `DEC-MP-003`), que ya está diseñado. Ver la corrección completa en `DEC-ADDON-002`.
- `B/docs/16-addons.md:1071` — **El cobro de única vez por `/v1/orders` (§1.4) deja tres cosas abiertas**, declaradas y no resueltas (corrección de diseño, FASE 8 completa, `F-8CB1-008`): **las dos primeras quedaron cerradas por `EX-41`** (idempotente por la clave; una orden sin respuesta se reenvía con la misma clave); **y la tercera quedó acotada el 2026-09-27** (owner, FASE 9 vuelta 2, `R4`): la clave sale del pedido y el doble clic reusa la orden; `A3` sólo confirma y nunca reenvía (FASE 9 vuelta 3, lote E); **la orden pagada cuya instancia terminó `ABANDONED` la ve el barrido y abre una marca colgada de la instancia**, con el motivo `ORDEN_PAGADA_SIN_INSTANCIA` (`B/09` §3, `B/02` §2.5); y **la devolución va por la acción administrativa 14**: la persona devuelve desde el panel del proveedor y la asienta, con el cobro que faltaba (`NUCLEO/08` §3, `RF4`). **Lo que sigue sin ver la conciliación** es el pago de una instancia que sí llegó a `ACTIVE`: un contracargo o un reembolso desde el panel sobre él no lo relee ninguna comprobación, porque la de pagos acreditados selecciona pagos de suscripción. **Y está medido sólo en sandbox** (`EX-30`).
- `B/docs/16-addons.md:1087` — **La orden pagada cuya instancia `A3` abandonó sin id sólo se ve si el proveedor deja buscar una orden por el identificador del pedido** (FASE 9 vuelta 3, owner 2026-09-30, lote E). La medición es `EX-57`, **`VERIFIED` desde el 2026-09-30, en sandbox y con ventana: la compra sin id de orden tiene detector** (`B/09` §3; residuo corregido el 2026-10-02). **Lo que queda abierto** es lo que la medición no cubrió: producción, que se lee sin mutar con la referencia de la primera orden real, y un pedido de más de 30 días, el rango máximo de la búsqueda (matriz, `EX-57`). Exige una respuesta perdida y un proveedor que igual creó y cobró la orden.
- `B/docs/16-addons.md:1096` — **Cerrado**: la identidad de la compra frena también un addon recurrente igual sobre un objetivo que ya tiene uno vivo, así que dos instancias `ACTIVE` iguales no pueden existir (FASE 9 vuelta 3, owner 2026-09-30, lote Y; §1.4, `B/02` §2.4).
- `B/docs/16-addons.md:1102` — **Qué hace un contracargo sobre el cobro de un addon periódico** (FASE 9 completa, borde 4 de §R7.5.2 de `04`; declarado por `DEC-METH-015`). `P6` abre la marca `CONTRACARGO` sobre la suscripción de complemento, que es la dueña del pago; si además corre `S6` sobre ella —y qué le pasa a la instancia— no está escrito. **Causa**: `DEC-SUB-020` se decidió sobre la principal. El monto es el de un addon y la marca ya lo pone delante de una persona.
- `B/docs/16-addons.md:1107` — **En qué verticales se emite un addon `USER`/`GLOBAL`** lo fija el contrato, no este capítulo: sólo en las verticales compatibles de su producto (`12-contrato-de-cobertura.md` §2.7), con el guard gemelo de `G-R2-B`, `G-R2-C` (`V/20` §2; owner 2026-09-25, FASE 9 completa, 4e, `F-8CA1-008`). Lo que billing aporta es el dato: la lista de verticales compatibles de `addon_product` (`B/02` §2.4), que es la misma que la orfandad del §4.2 lee desde 4d. Se nombra acá para que nadie lea el §2.2 —*«compatible»* al comprar— como la regla de emisión.
- `B/docs/16-addons.md:1113` — **El destaque de una ficha borrada todavía puede cobrar una vez más, si el empuje se pierde** (FASE 9 vuelta 1; owner 2026-09-26, `G2-1`, elegida contra la recomendación). `A6` corre **al recibir el empuje** *«la ficha llegó a `PURGED`»* (`12-contrato…` §3.1), **que sale después del commit del borrado** (FASE 9 vuelta 1, `N-G2V-01`), y eso cierra el caso en el camino principal. **Pero el empuje no tiene transporte durable** —el outbox del núcleo es de correos—: si se pierde, **la red es la consulta `fichaPurgada`** (contrato §4.1), que el barrido diario lee (`B/09` §3), y vuelve el día de atraso; si el cobro del complemento cae en ese día, entra, y `S21` lo pone delante de una persona con el motivo 14 (propuesta *no devolver*, que la persona puede cambiar). Lo mismo, y sin empuje, para una ficha que desaparece sin pasar por `PB9` ni por `PB12` : **desde `G5-2` el admin no tiene ninguno** (`NUCLEO/08` §3: *«ningún borrado de ficha sale de otra fila que `PB9` o `PB12`»*); el que queda es **el borrado de la cuenta pedido por el propio usuario**, pendiente en `NUCLEO/08` §1 (fuera de esta épica, a mano por soporte con una lista de pasos, HOS-1393 (`https://linear.app/hospeda-beta/issue/HOS-1393`): revisión del owner, 2026-09-28, N7, `g1`; FASE 9 vuelta 1, §4 punto 1 de `22-verificado-G2`, como el contrato §3.1). **Y son dos mecanismos para un mismo hecho**: `A6` tiene que ser idempotente frente a los dos —una instancia ya `CANCELLED` no se vuelve a cancelar—. **Causa**: el owner no acepta ni un cobro de más, y el único camino a cero atraso es un empuje, que en este programa no tiene transporte durable.
- `B/docs/16-addons.md:1131` — **El complemento que no se reanuda al volver de una suspensión no tiene detector** (FASE 9 vuelta 1; owner 2026-09-26, `G2-2`). Su pausa por `S6` no tiene `fin_previsto`, así que la quinta comprobación de `B/09` §3 no lo ve. Falla hacia **no** cobrar. **Causa**: la suspensión no tiene fecha de fin. **Y cuando `S7` saca a la principal de `SUSPENDED` hacia `CANCEL_SCHEDULED`** —el cobro entró sobre un preapproval que `S6` ya había cancelado—, **`S33` no corre**: su evento pide la principal `ACTIVE`. El complemento sigue pausado mientras la principal da servicio hasta su fin de período, sin cobrar ni dar nada, y al llegar `S12` la orfandad lo apaga (`A5`, `S21`). **Desde `R18-b`, `S7` cancela como `S11` los complementos que siguen en `ACTIVE`** (owner 2026-09-27, FASE 9 vuelta 2), y éste no es uno: la regla de `S11` deja afuera lo que no está `ACTIVE`, así que el pausado por `S32` sigue siendo este residuo. Declarado por `DEC-METH-015`: falla hacia no cobrar, no da acceso y no borra nada. **Causa**: reanudarlo cobraría un complemento de una principal que ya se va (FASE 9 vuelta 1, §4 punto 3 de `22-verificado-G2`).
- `B/docs/16-addons.md:1144` — **Un destaque recurrente sobre una ficha que no se ve con la principal viva se sigue cobrando** —`MODERATED`, bajada por excedente, `DRAFT` por `PB6`, `ARCHIVED` por `PB5` **(su aviso de archivado los nombra desde la FASE 9 vuelta 1, R3 caso `m`: `V/19` §4 fila 18)**, **o un borrador que nunca se publicó, donde el acto es la compra y lo dice la pantalla de compra (`B/19` §4 fila 3-ter; `N-G2V-02`)**— (FASE 9 vuelta 1; owner 2026-09-26, `G2-3`). El acto que lo causa lo dice y ofrece la baja (`V/19` §4, `NUCLEO/07` §6), que es la primera cláusula de `A5`; si la persona no actúa, el débito sigue sin tope. **Causa**: el objetivo existe (§41 del PDR) y la causa es un acto del dueño o una sanción.
- `B/docs/16-addons.md:1152` — **Un complemento que autoriza durante la pausa de su principal cobra hasta que ella vuelva** (FASE 9 vuelta 1, residuo de 4a; y de la suspensión desde `G2-2`). `S32` corre cuando la principal se pausa o se suspende; si el complemento llega a `ACTIVE` después (`A2`), nadie lo pausa. En la pausa lo acota su tope; en la suspensión no hay tope, pero necesita que `S6` caiga dentro de la ventana de autorización del addon recién comprado. **Causa**: el evento de `S32` es el paso a `PAUSED` o a `SUSPENDED`, no el estado. **Y lo mismo en la baja** (FASE 9 vuelta 2, `R1-a`): un complemento que autoriza después de `S11` —o que estaba en `GRACE_PERIOD` y no entró en su selección— cobra hasta que `S12` saque a la principal de las filas vivas, y ese cobro `S21` lo pone en el motivo
- `B/docs/16-addons.md:1160` — **Causa**: el evento de `S11` es la baja, no el estado `CANCEL_SCHEDULED`.

### `B/docs/19-superficies.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:327`–`346`.

- `B/docs/19-superficies.md:329` — **El diseño visual**, que no es materia de esta spec.
- `B/docs/19-superficies.md:330` — **Qué endpoints expone la API**, uno por uno: lo que este capítulo fija es **qué lee cada superficie**, y de ahí sale la API. Enumerarla antes de FASE 3 sería anticipar el trabajo de las épicas.
- `B/docs/19-superficies.md:333` — **Cerrado**: lo dice la fila 22 del §4, que el owner escribió para el espejo de `R18` con `S7` como precedente, y que cubre los dos caminos a `CANCEL_SCHEDULED` con el mismo texto (owner 2026-09-27, FASE 9 vuelta 2, `R18`).
- `B/docs/19-superficies.md:340` — **La vuelta del suspendido con tarjeta pierde su promo** (owner 2026-09-25; FASE 9 completa, 3b). Se aceptó y se dice en el aviso de suspensión (§4 fila 10), porque la vuelta es una sucesión y `S18` no re-apunta la redención (cap. 14 §2.2). **Anotado por el owner para mejorar en el futuro**: la regla de perder la promo se escribió para el cambio de plan que la persona elige, y quien vuelve al mismo plan tras un rechazo de tarjeta no cambia de plan. Las alternativas —re-apuntar la redención cuando la sucesora ancla la misma versión, o siempre desde `SUSPENDED`— están en `26-fase-9-completa/01-…` §2.5, pendiente 2.
- `B/docs/19-superficies.md:120` — si el texto final del aviso de contracargo lleva *«ya no se le va a cobrar»* y *«una persona sigue el caso»* no está decidido; lo cierra el PR de `B7` por BS (texto al cliente: lo aprueba el owner en el PR; [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).

### `B/docs/21-migracion.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:581`–`697`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:581

- `B/docs/21-migracion.md:583` — Cerrado: §3.3 (FASE 9 completa, `C-9`).
- `B/docs/21-migracion.md:585` — **Un contracargo o un reclamo sobre un pago del sistema viejo no tiene comprobante del lado de Hospeda después del corte** (declarado por `DEC-METH-015`, FASE 9 completa; `F-8CB3-014`, `F-8CA3-007`). **Causa**: el owner decidió no conservar nada del sistema viejo (`2a`); la población son los pocos pagos que el sistema actual cobre entre el 2026-09-26 y el corte, de clientes que el owner llama uno por uno. El comprobante sigue existiendo del lado de MercadoPago.
- `B/docs/21-migracion.md:590` — **Lo pagado en el sistema viejo por un período que el corte corta, o por un addon vigente, se pierde y no se devuelve** (declarado por `DEC-METH-015`; owner 2026-09-26, `G1-4`, elegida contra la recomendación de devolver completo antes del corte; `F-8V1C2-002`). El cliente que pagó un ciclo el 25/11 y ve el corte el 05/12 pierde los días que le quedaban, y el addon que compró deja de existir con las tablas viejas (§4). **No se devuelve, para nadie, y el trial no se presenta como compensación**: al publicar su ficha estrena el trial de un cliente nuevo (`V/21` §2.4), que no es una equivalencia de lo perdido (FASE 9 vuelta 3, owner 2026-09-30, lote F). El owner aporta el hecho que acota la población: **no hay anuales vivas en el sistema viejo ni las va a haber antes del corte**. **Qué les dice lo decide el owner, que les avisa por privado** (`DEC-MIG-007`, punto 4; el guion del aviso salió: FASE 5, simplificación del corte, S-50). **Causa**: es la posición coherente con `2a` (no se conserva nada del sistema viejo) y con `2d` (la diferencia de un corte abortado no se devuelve); el owner prefiere un trial nuevo a unos pocos reembolsos a mano. **Mueve plata, y su población son las cuentas de la lista cerrada, que el owner conoce** (`DEC-MIG-007`, punto 3; la re-verificación del §1.3 salió: FASE 5, simplificación del corte, S-29); un reclamo que llegue después del corte se atiende contra el comprobante del proveedor (punto anterior), no contra nada nuestro. *(Lo de la constancia sale: lo cubre `DEC-MIG-007`; FASE 5, simplificación del corte, S-53.)* **Y un cobro tardío de un débito viejo después del corte le aparece al owner**, marcado para decidir la devolución (§2.5; FASE 5, simplificación del corte, lote C). **Salvo el aviso que llegue entre apagar lo viejo y levantar lo nuevo**: en esos minutos no hay servidor que lo atienda ni Worker del borde que conteste `500`, así que puede no reintentarse y no aparecer; se declara y se acepta, porque son minutos y tres cuentas con débito que el owner conoce, y si pasa lo ve en su cuenta de Mercado Pago o se lo dice la persona (`DEC-MIG-007`, puntos 3 y 4; FASE 5, lote de la aplicación, owner 2026-09-30, C).
- `B/docs/21-migracion.md:642` — *(El titular que sólo conoce el proveedor sale: FASE 5, simplificación del corte, S-37 y S-38; el lote 3 de la FASE 5 ya había descartado `R5-22` por `DEC-MIG-007`.)*
- `B/docs/21-migracion.md:688` — *(Sale entero con la lápida del corte: ese cobro ya no se asienta sin marca, entra por la lápida de recepción y le aparece al owner con la propuesta de devolverlo, §2.5. FASE 5, simplificación del corte, lote C; S-40, S-41, S-42, S-74.)*
- `B/docs/21-migracion.md:691` — **Cerrado el 2026-09-25**: está escrita en el cap. 09 §2.4, con el motivo 6 (`TRANSICIÓN_NO_DECLARADA`), y las dos redacciones coinciden (FASE 9 completa, `2b`).
- `B/docs/21-migracion.md:695` — **La clasificación del código legacy** en reusar o reescribir tiene su propio gate (`DEC-METH-003`) y es FASE 5. No se anticipa acá ni implícitamente.

### `B/docs/22-lo-legal.md` — Lo que este capítulo NO cierra

Fuente: `.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:182`–`197`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:182

- `B/docs/22-lo-legal.md:184` — **Las cinco preguntas de esta épica** (FASE 9 completa, C-11), por definición. Lo que sí queda cerrado es **qué depende de cada una**, que es lo que permite implementar el resto sin esperarlas.
- `B/docs/22-lo-legal.md:186` — **El comprobante no fiscal** ya lo decidió `DEC-LEGAL-001` y no se reabre: se emite por cada cobro, **nunca se lo llama factura fiscal**, y no tiene fecha ni disparador de revisión hasta ARCA. **Quién lo emite ya está escrito** (FASE 8 completa, `F-8CB3-006`): `P1` para el cobro del proveedor y `MP1`/`MP4` para el manual (cap. 03 §6 y §7), colgando de un `payment` **o** de un `manual_payment` (cap. 02 §2.3), y numerado sin huecos por un contador en fila incrementado en la misma transacción que emite. **Cerrado el 2026-09-25 (owner)**: **el contador serializado se mantiene** para la numeración correlativa sin huecos, **por decisión del owner aunque no sea requisito legal**, y **no se lleva al pliego legal**: no es una de las preguntas del §4 (FASE 8 completa, pendiente 6, owner 2026-09-25; `B/02` §2.3).

## 6. Consulta legal pendiente

El pliego de la consulta legal tiene **seis preguntas**: cinco de la épica de billing (`B/22` §4) y
una de la de verticales, la 5 (`V/22` §4). **Ninguna la contesta el diseño**: no se resuelven por
analogía ni con una búsqueda web, y piden revisión profesional. Lo que sí está cerrado es **qué
parte del diseño depende de cada respuesta** y qué cambia si la respuesta no es la que se asumió,
que es lo que permite implementar el resto sin esperarlas.

### 6.1 La pregunta que queda de verticales: el seudónimo del correo

`V/22` §2 (*«La pregunta legal que queda»*), §2.3 (*«Las señales de identidad: finalidad, plazo, y
un conflicto concreto»*):

- **Teléfono, identificador fiscal y dispositivo NO se guardan** (revisión del owner, 2026-09-28,
  N7, `g2`): sólo observaban y nunca bloqueaban, y guardarlos pedía finalidad y plazo legal para un
  abuso que hoy no está medido. **La consulta legal de verticales queda sólo por el seudónimo del
  correo** (`V/22` §3.3, pregunta 5). Si algún día hace falta observarlas, el seguimiento es
  [HOS-1394](https://linear.app/hospeda-beta/issue/HOS-1394).
- [DEC-TRIAL-004](01-decisiones-vigentes.md#dec-trial-004) decidió que **sólo el correo
  normalizado** bloquea un trial nuevo. Su implicación 2 dejaba `M-LEGAL-02` abierto como
  prerequisito de la parte de observación de las otras tres señales; esa parte salió con ellas
  (N7), así que lo que la decisión todavía necesita de la consulta es la pregunta 5.
- Las tres preguntas del §2.3 eran **finalidad declarada**, **plazo de conservación** y **cómo se
  responde a un pedido de acceso o supresión**. Desde
  [DEC-DATA-005](01-decisiones-vigentes.md#dec-data-005) los 180 días de retención sólo alcanzan el
  contenido de las fichas, nunca los datos de la persona, así que la tercera ya no es de plazo contra
  la retención: es cómo se responde al pedido, que la retención no cubre. Con las señales afuera,
  las tres se reducen a la pregunta 5 sobre el seudónimo.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:33, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:35, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:37, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:43, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:48

*(Que las tres preguntas del §2.3 se reducen a la 5 lo dice la fuente para la consulta —*«La
consulta legal queda sólo por el seudónimo del correo»*—; que la implicación 2 de `DEC-TRIAL-004`
quedó sin sujeto con N7 es inferido.)*

### 6.2 La pregunta más pesada de billing: el silencio ante un aumento

`B/22` §2 (*«Las tres preguntas legales»*), §2.1 (*«¿El silencio del cliente vale como aceptación
de un aumento?»*). **Es la más pesada, y es estructural.**

| | |
|---|---|
| **qué se asumió** | que sí. [DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002) parte 3: **`S37` muta el monto automáticamente siete días antes de la fecha efectiva**, y **ningún cobro sale al precio nuevo antes de esa fecha** (`DEC-MP-002`, 📌 de CC, leído con BZ); el cliente no acepta nada, puede cancelar antes |
| **en qué se apoya** | es el modelo estándar de la industria, y [MP:PC-3](04-catalogos.md#mp-pc-3) **`VERIFIED`** midió que el proveedor **no pide un consentimiento nuevo** para mutar el monto |
| **qué NO está verificado** | que eso sea válido en Argentina, que es justo el terreno donde la normativa de consumo suele ser restrictiva |
| **qué cambia si la respuesta es no** | **`DEC-MP-002` cambia de forma, no de redacción.** Haría falta **aceptación activa**, y a quien no responda **no se lo podría aumentar**: la cartera quedaría partida en dos precios por tiempo indefinido, y todo el diseño de la ventana de 60 días con tres contactos pasaría a ser otra cosa |

**Riesgo declarado y aceptado por el owner (2026-09-16): avanzar así y corregir si la consulta dice
otra cosa.** Con una condición práctica: **conviene resolverla antes de implementar**, porque
corregirla después no es editar un texto. Por
[BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm), ningún precio cambia hasta el momento 5,
y el aviso y la mutación a los ya anclados (la parte 2 de `DEC-MP-002`) llegan con
[B12](20-fase-3/B12.md#pieza-b12).

Las otras dos preguntas del §2 (la ventana de revocación y el botón de arrepentimiento, `B/22`
§2.2) son las filas 2, 3 y 4 de la tabla del §6.3.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:79, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:81, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:83, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:85, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:92

### 6.3 El resumen, para llevar a la consulta

Las seis preguntas del pliego, con su número de pliego (`V/22` §4 y `B/22` §4):

| # | pregunta | qué depende | qué pasa si la respuesta es la contraria |
|---|---|---|---|
| 1 | ¿el **silencio** vale como aceptación de un aumento? | [DEC-MP-002](01-decisiones-vigentes.md#dec-mp-002) parte 3 | **cambia el diseño**: aceptación activa, y a quien no responda no se lo aumenta |
| 2 | ¿cada renovación abre una **ventana de revocación** nueva? | el diseño de la revocación | **cambia el diseño**: cada cobro arrastra su ventana |
| 3 | ¿cuál es el **plazo** de revocación? (la búsqueda propia dice 10 días corridos) | un número | sólo un número |
| 4 | ¿hace falta el **botón de arrepentimiento**? | está fuera de alcance por decisión del owner | **es un incumplimiento, no una feature faltante** |
| 5 | ¿se puede conservar un **seudónimo determinístico del correo** tras un borrado, para no regalar un segundo trial? | [DEC-TRIAL-004](01-decisiones-vigentes.md#dec-trial-004) y el cap. 02 §4 de verticales | **cambia un mecanismo** —un escritor nuevo que borra el seudónimo y una columna anulable— **y lo que se promete** (`V/22` §3.3; FASE 9 completa, `C-1`) |
| 6 | ¿hay **plazo de preaviso** obligatorio para un aumento? | los 60 días son **decisión comercial**, no normativa | sólo un número, **si es menor a 60** |

**Las cinco de billing (1, 2, 3, 4 y 6) y la 5 de verticales piden revisión profesional, no una
búsqueda web.** Las tres en negrita de billing —1, 2 y 4— cambian diseño o crean incumplimiento; las
otras dos de billing —3 y 6— cambian un número (FASE 9 completa, C-11, `F-8CB3-017`: la tabla de
billing tiene cinco filas); la 5 cambia un mecanismo y lo que se promete.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:129, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/22-lo-legal.md:133, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:163, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:165, .specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:175

## 7. Lo que las descomposiciones NO deciden

`V/descomposicion.md` §6 y `B/descomposicion.md` §6, en su forma vigente. Lo que una decisión o una
letra posterior ya cerró va con quien lo cerró; no es un abierto.

### 7.1 Lo que sigue sin decidir

- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista. (Las dos descomposiciones.)
- **Fechas y esfuerzo.** No hay estimaciones a propósito: salen del atomizado. (Las dos; es también
  el punto 4 del §1.)
- **Las cinco preguntas legales de billing** (`B/22` §4; la sexta del pliego, la 5, es de `V/22`:
  FASE 9 completa, C-11), que no las contesta el diseño. Lo que sí está cerrado es qué depende de
  cada una, y eso permite implementar el resto sin esperarlas. Están en el §6.
- **El botón de arrepentimiento (`RF1` por revocación, `B/22` §2.2) no tiene unidad todavía, porque
  está fuera de alcance hasta la consulta legal** (`B/22` §2.2, punto 3). La máquina de reembolso en
  sí es de [B5](10-corte/B5.md#pieza-b5) (`RF1`/`RF4`, owner 2026-09-25, decisión 10d); si el owner
  mete el botón adentro, su unidad natural es `B13`, la única que tiene capítulo `22` (su §1)
  (declarado por `DEC-METH-015`, FASE 9 completa). *(La fuente es anterior a la partición de
  [Z](01-decisiones-vigentes.md#own-41-corte-del-mvp-t1-z) y no dice si sería `B13a` o `B13b`.)*

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:756, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:758, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:766, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1118, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1130, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1140, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1141, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1153

### 7.2 Lo que ya cerró una decisión o una letra posterior

- **Cuál es la pasarela: cerrado por [DEC-MP-005](01-decisiones-vigentes.md#dec-mp-005)**
  (2026-09-24): **Mercado Pago**. La evaluación no se completó —se cerró en el paso 4 de 6, porque la
  PRUEBA 0 y el KYC de Mobbex nunca recibieron respuesta, y MP tampoco contestó la consulta de
  `R-MP-01`—. Con la decisión entró la directriz de que **lo que el proveedor no hace lo suple el
  diseño**, y con ella se destrabaron el capítulo 13 y la construcción.
- **El modelo canónico de cobro: cerrado por [DEC-MP-006](01-decisiones-vigentes.md#dec-mp-006)**
  (2026-09-24): el reloj de cobro es del proveedor y el mandato es el modelo canónico, **sin destino
  pendiente desde el 2026-09-26** (su 📌).
- **Qué se reescribe y qué se reutiliza: cerrado por
  [DEC-METH-017](01-decisiones-vigentes.md#dec-meth-017)** (la FASE 5), **y lo que dejó sin
  veredicto —las piezas de autorización y de base que se conservan y tres guards del repo sin
  destino— lo contesta el pase de la FASE 6, que corre en paralelo a `U1`**
  ([DEC-METH-018](01-decisiones-vigentes.md#dec-meth-018); FASES 6 y 7, owner 2026-09-30, G). Salvo
  `qzpay`, que [DEC-ARCH-004](01-decisiones-vigentes.md#dec-arch-004) ya resolvió: **se saca y queda
  sólo como referencia de lectura** (revisión del owner, 2026-09-28, N2). Las descomposiciones dicen
  **qué hay que tener funcionando**, no de dónde sale.
- **Si cada unidad es un issue de Linear: cerrado por el momento 1** ([GATE:M1](30-el-corte.md#gate-m1);
  FASES 6 y 7, D-2): cada unidad pasa a `Done` en Linear al mergearse en la rama del paraguas, y las
  etiquetas de smoke van sólo en `HOS-1352`, *«si no, 25 issues quedan meses en In Review»*. El
  árbol de Linear sale de esta spec (`D/41-corte-del-mvp/10-decisiones-del-owner.md:250`). *(Que el
  momento 1 cierre esta pregunta es inferido de su texto.)*
- **De qué unidad es `B/21`** (declarado por `DEC-METH-015`, FASE 9 completa): **de una, y sólo por
  una escritura del corte** —la lápida del corte salió (FASE 5, simplificación del corte, S-40)—: los
  dos `permanent_grant` del §2.4, que construye [B9a](10-corte/B9a.md#pieza-b9a) (FASE 9 vuelta 1, R6
  y `F-8V1C2-004`; la mitad *a* por Z). Lo que billing construye desde ahí —la re-vinculación de un
  preapproval desconocido, owner 2026-09-25, `2b`— vive en `B/09` §2.4 y es de
  [B11](10-corte/B11.md#pieza-b11); el resto, el corte del paraguas, es de `D/16` §4.2, en
  [30-el-corte.md](30-el-corte.md), que reparte sus herramientas: los dos `permanent_grant` del
  [paso 3b](30-el-corte.md#paso-3b) a `B9a`.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:760, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:767, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1120, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1125, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1132, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1144, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:1035

## 8. Abiertos de la redacción

Las preguntas al owner que dejaron los redactores de esta spec (los archivos
`_trabajo/abiertos/*.md`). **Hoy no queda ninguna pregunta de la redacción abierta**: las del triage de la primera
pasada las contestaron las letras BK a BX, y las de la segunda, BY a CB
(`D/41-corte-del-mvp/10-decisiones-del-owner.md`, líneas 136 a 147, 156, 157 y 168 a 171). Lo
único vivo son **tres datos operativos**, con su dueño y su momento, abajo. Lo demás se deja
listado como cerrado, con quien lo cerró, para no reabrirlo.

<!-- abiertos-redaccion -->

### Los de la primera pasada

Los 55 abiertos de `_trabajo/abiertos/g1-*.md` a `g9-*.md`, con la clasificación del triage
(`_trabajo/triage/vuelta-1/triage.json`, sobre `f80c0f2715`, y la re-verificación de
`_trabajo/triage/vuelta-2/triage.json`, sobre `17f9702675`, que manda cuando existe):

| abierto | archivo | cómo se cerró, o si sigue vivo |
|---|---|---|
| AB-g1-1 · Las cuatro decisiones `SUPERSEDED EN PARTE` no tienen adjudicación de su parte muerta | `g1-decisiones.md`:6 | [BK](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bk) |
| AB-g1-2 · `DEC-ARCH-017#📌1` sigue diciendo que promos y cortesías las crea `B9a` | `g1-decisiones.md`:36 | residuo de la fuente: corregido por adjudicación (triage, vuelta 1) |
| AB-g1-3 · Las decisiones «precisadas por otra decisión» no tienen su parte superada marcada | `g1-decisiones.md`:53 | [BK](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bk) |
| AB-g2-1 · La prosa sin ítem de inventario no cuenta para la red R17 | `g2-nucleo-contrato.md`:8 | no es pregunta al owner: herramienta (`trazar.py`) |
| AB-g2-2 · Los valores de los cinco plazos sin valor escrito | `g2-nucleo-contrato.md`:42 | **vivo, dato operativo**: ver abajo, *«Los de la segunda pasada»* |
| AB-g2-3 · No hay plantilla para los correos inmediatos a `SUPER_ADMIN` | `g2-nucleo-contrato.md`:74 | [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br) |
| AB-g3-1 · `M8` dice que no tiene fila en la matriz, y la matriz ya la tiene (`EX-51`) | `g3-catalogos.md`:6 | residuo de la fuente: corregido en la fuente (triage, vuelta 1) |
| AB-g4-1 · Los tipos de test mínimos de cuatro ítems del corte chocan con lo que admite `CORTE` | `g4-corte-indice.md`:5 | no es pregunta al owner: herramienta, arreglada en `cobertura.py` desde `17f9702675`; la nota *«Inferido»* de [TEST:CORTE:18](30-el-corte.md#test-corte-18) salió |
| AB-g4-2 · El ensayo no dice si recorre la rama de aborto | `g4-corte-indice.md`:31 | [BQ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bq) |
| AB-g4-3 · Con qué etiqueta va el smoke de la medición de `EX-49` | `g4-corte-indice.md`:52 | [BQ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bq) |
| AB-g5-1 · Las etiquetas `kind-*`/`area-*` de las piezas en Linear | `g5-u-v1-v4.md`:9 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) con su default ([DEC-METH-019#📌5](01-decisiones-vigentes.md#dec-meth-019-p5)): `kind-spec` más las `area-*` de cada fila |
| AB-g5-2 · El nombre de la tabla del outbox y el nombre neutro de la bitácora | `g5-u-v1-v4.md`:28 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g5-3 · El plazo de vencimiento de `processing` y la frecuencia del envío | `g5-u-v1-v4.md`:44 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g5-4 · A dónde se mueven las filas vivas del rol de dueño de comercio, sus permisos y la tabla de contactos | `g5-u-v1-v4.md`:59 | [BT](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bt): lo mide `U1` antes de su merge y deja el número en el PR |
| AB-g5-5 · La lista nominal de las diez variables que sólo usa el sistema viejo | `g5-u-v1-v4.md`:76 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g5-6 · Cuáles son *«las tres tablas»* de `is_featured` y `featured_by_entitlement` | `g5-u-v1-v4.md`:89 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g5-7 · Las credenciales del script del corte y el monto del pago chico | `g5-u-v1-v4.md`:101 | las credenciales, [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) con su default ([DEC-METH-019#📌5](01-decisiones-vigentes.md#dec-meth-019-p5)): variables de entorno de la sesión de quien opera, nunca versionadas; **el monto del pago chico sigue vivo como dato operativo**: ver abajo |
| AB-g5-8 · Qué pieza arma con `db:migrate` las bases de desarrollo, de integración y del e2e nocturno | `g5-u-v1-v4.md`:118 | derivado, no de las fuentes: `V1`, dueña de [DEC-ARCH-013#📌3](01-decisiones-vigentes.md#dec-arch-013-p3) en el mapa de cobertura porque construye `G18`, lleva la cláusula (d) de [AC:V1:4](10-corte/V1.md#ac-v1-4); ninguna fuente nombra la pieza (`D/01-decision-log.md:7344`, `D/38-fase-5/10-decisiones-del-owner.md:57`) *(lo marco)* |
| AB-g5-9 · Dónde vive el script TypeScript que genera el SQL del catálogo y de la tabla de claves | `g5-u-v1-v4.md`:135 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs): lo propone el PR de `V1` |
| AB-g5-10 · Las rutas, permisos y códigos de error de las acciones 18 y 11 | `g5-u-v1-v4.md`:147 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g5-11 · Dónde vive el caché del conjunto efectivo y cómo se observa una entrada sospechosa | `g5-u-v1-v4.md`:162 | [CB](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-cb): en el Redis que la API ya usa, lectura en vivo si Redis no responde, y un contador de entradas sospechosas en los logs estructurados |
| AB-g5-12 · Los mínimos de tipos de test del mapa de cobertura que no tienen una lectura en la pieza | `g5-u-v1-v4.md`:175 | no es pregunta al owner: herramienta (`cobertura.py` deduce tipos de migración del texto de `DEC-ARCH-006`, `DEC-ENT-006` y `DEC-TEST-001#📌1`; sólo avisa, R18 ⚠) |
| AB-g6-1 · V5 · El carril del retiro de `USER_IMPERSONATE` | `g6-v5-v9.md`:7 | `V5` lo saca (`V/descomposicion.md:544`: *«el permiso no existe en el enum»*); que salga **de la base** con el carril del lote 1 I (recrear el enum y borrar sus filas de roles y overrides) es derivación del principio que `F5-AUT-023` fija para `U1` y los permisos del cobro viejo (`V/17-autorizacion.md:762`) *(lo marco)* |
| AB-g6-2 · V8a · El código de error del rechazo de la acción 24 por precondición | `g6-v5-v9.md`:31 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g6-3 · V7 · ¿El aviso de reclamo y la comunicación del rechazo van por el outbox común de `U2`? | `g6-v5-v9.md`:57 | [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br), por transitividad: `U2 → V4 → V5 → V7` |
| AB-g6-4 · V9a · Qué pieza crea `domain_event`, el registro donde `V9a` escribe los actos del dueño | `g6-v5-v9.md`:69 | [BW](01-decisiones-vigentes.md#own-41-corte-del-mvp-t10-bw): `U2`; precisa la aplicación de BN |
| AB-g6-5 · V9b · Quién engancha el aviso «al archivar», que sale con el acto de `PB4`/`PB5` (de `V6`, al corte) | `g6-v5-v9.md`:88 | [BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) |
| AB-g6-6 · V9b · Cómo se calcula «la primera fecha en que un aviso de retención podría salir» (gate de la Fase 1) | `g6-v5-v9.md`:108 | [BV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bv) |
| AB-g6-7 · V6 · Los valores de los cinco plazos de verticales sin valor escrito | `g6-v5-v9.md`:128 | **vivo, dato operativo**: ver abajo, *«Los de la segunda pasada»* |
| AB-g6-8 · V6 · Si `partners` tiene filas en producción (seguridad del `UNIQUE` parcial) | `g6-v5-v9.md`:150 | [BT](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bt): lo mide `V6` antes de su merge y deja el número en el PR (§1, punto 1) |
| AB-g6-9 · V6 · El código de error al rechazar un plazo que contradice a otro | `g6-v5-v9.md`:168 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g7-1 · El código de error del rechazo de Turista VIP heredado (`B3`, `S1`) | `g7-b1-b3.md`:8 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g7-2 · Cuándo y por qué transición se cancela el Turista VIP heredado (`B3`, `DEC-ENT-004`) | `g7-b1-b3.md`:26 | [BP](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bp) |
| AB-g7-3 · Tablas de `B5` que `B3` escribe o referencia antes de que `B5` exista | `g7-b1-b3.md`:47 | [BN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bn) |
| AB-g7-4 · Si el cuerpo de la rama de sucesión de `S1` se escribe en `B3` | `g7-b1-b3.md`:71 | [BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) |
| AB-g7-5 · Qué rama de `S14` lee el esquema de promos y cortesías | `g7-b1-b3.md`:87 | resuelto por las fuentes: `S14` lee la cortesía diferida (motivo 12) y las promos vivas por el monto esperado (motivo 24) (triage, vuelta 2) |
| AB-g7-6 · *«Compra»* en el modelo de addons: ¿tabla o identidad? | `g7-b1-b3.md`:101 | resuelto por las fuentes: la *«compra»* es la identidad sobre `addon_instance` (triage, vuelta 2) |
| AB-g7-7 · Rutas concretas y cadencia del job de la ventana (`B2`, `B3`) | `g7-b1-b3.md`:113 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g7-8 · *«Fijar el precio de un ciclo»*: ¿edita la versión o publica otra? (`B2`) | `g7-b1-b3.md`:128 | [BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm) |
| AB-g7-9 · Quién aplica al corte el aumento en su fecha efectiva (`B2`) | `g7-b1-b3.md`:144 | [BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm) |
| AB-g7-10 · Un precio por debajo del piso del proveedor (`B2`) | `g7-b1-b3.md`:159 | [BM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bm) |
| AB-g7-11 · El *«Lista cuando»* de `B1` necesita el grace de `B7` (`B1`) | `g7-b1-b3.md`:169 | [BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) |
| AB-g7-12 · AC:B1:12 compara contra una tabla que crea `B3` (`B1`) | `g7-b1-b3.md`:182 | no es pregunta al owner: herramienta (`cobertura.py`, tipos de test) |
| AB-g7-13 · Qué variables de entorno de Mercado Pago son (`B1`) | `g7-b1-b3.md`:195 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g8-1 · Las llamadas de `B5` y `B7` a transiciones de `B8b` (`S18`, `S31`, `S38`) en el corte | `g8-b4-b7.md`:8 | [BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) |
| AB-g8-2 · Qué pieza escribe la migración del índice parcial de `refund` sobre la orden | `g8-b4-b7.md`:53 | [BN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bn) |
| AB-g8-3 · La mitad `fichaPurgada` de la cuarta comprobación del barrido | `g8-b4-b7.md`:79 | [BL](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) |
| AB-g8-4 · La ruta, el permiso y los códigos de error de las acciones 3, 4, 8, 13 y 14 | `g8-b4-b7.md`:107 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g8-5 · Dónde se persiste `coberturaPerdidaEn` | `g8-b4-b7.md`:134 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g9-1 · Rutas y códigos de error | `g9-b8-b13.md`:9 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |
| AB-g9-2 · Las filas del `B/19` §4 que avisan actos de piezas posteriores | `g9-b8-b13.md`:37 | residuo de la fuente: corregido en la fuente (triage, vuelta 1; el mapeo por fila, inferido) |
| AB-g9-3 · Quién escribe la extensión del checklist de smoke de cada fase | `g9-b8-b13.md`:61 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) con su default ([DEC-METH-019#📌5](01-decisiones-vigentes.md#dec-meth-019-p5)): cada pieza posterior escribe la sección de su fase en el checklist de smoke, con el formato de `B13a` |
| AB-g9-4 · Cómo se revoca una cortesía temporal | `g9-b8-b13.md`:80 | [BO](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bo) |
| AB-g9-5 · La forma de la ventana `N` del correo agregado | `g9-b8-b13.md`:100 | [BU](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bu) |
| AB-g9-6 · El texto de los avisos que la fuente no fija literal | `g9-b8-b13.md`:116 | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) |

### Los de la segunda pasada

Los abiertos que dejó la segunda pasada de redacción (`_trabajo/abiertos/pasada2-*.md`).

<!-- abiertos-pasada2 -->

**Vivos: tres datos operativos, con su dueño y su momento** (triage, vuelta 2, *«Datos operativos
con dueño y momento»*). No son preguntas de diseño: la regla de cada uno ya está escrita, y falta el
número.

| dato | dueño | antes de | dónde está la regla |
|---|---|---|---|
| los valores de [PLAZO:3](02-nucleo.md#plazo-3), [PLAZO:4](02-nucleo.md#plazo-4), [PLAZO:7](02-nucleo.md#plazo-7), [PLAZO:8](02-nucleo.md#plazo-8) y [PLAZO:9](02-nucleo.md#plazo-9), de verticales | el owner | el merge de [V6](10-corte/V6.md#pieza-v6) | `02-nucleo.md` §4.2: la migración estructural del corte falla si alguno está vacío; §1, punto 2 |
| el valor de [PLAZO:19](02-nucleo.md#plazo-19), la ventana `N` del resumen de conciliación, de billing | el owner | el merge de [B2](10-corte/B2.md#pieza-b2) | [BU](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bu), [BX](01-decisiones-vigentes.md#own-41-corte-del-mvp-t10-bx): la versión 1 de los plazos falla con una clave vacía, sin excepciones |
| el monto del pago chico del [paso 4b](30-el-corte.md#paso-4b) | el owner | el ensayo del corte | [BS](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs) con su default ([DEC-METH-019#📌5](01-decisiones-vigentes.md#dec-meth-019-p5)), como el del 5c |

**Cerrados por el lote BY a CB, o por las fuentes**:

| abierto | archivo | cómo se cerró |
|---|---|---|
| AB2-g7-1 · la guarda de `S15` (`B3`) lee `reconciliation_mark_payment`, que nace en `B5` | `pasada2-g7.md` §1 | [BY](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-by): `B3` la escribe, con el predicado (f) de `G-R1-F`, contra una interfaz interna; `B5` trae la implementación y prueba el rechazo con filas sembradas, en su *«Lista cuando»* |
| AB2-g9-1 · por qué camino llega el aumento a los anclados en `B12` | `pasada2-g9.md` | [BZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-bz): una migración a la versión nueva por `S37` y `S38`, con el motivo *«aumento»* y el plazo 11, sin la cohorte `PARA_RESOLVER` y conservando la promo viva |
| AB2-g5-1 · qué pieza construye las dos superficies de la suspensión de `V/15` §6.3 | `pasada2-g5-u-v1-v4.md` §1 | [CA](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-ca): el aviso de suspensión y la cláusula espejo de `S7`, `B7`; la advertencia en la compra de Turista VIP, `B13a` |
| AB-g5-11 · dónde vive el caché del conjunto efectivo (seguía abierto en `pasada2-g5-u-v1-v4.md`) | `g5-u-v1-v4.md`:162 | [CB](01-decisiones-vigentes.md#own-41-corte-del-mvp-t11-cb) |
| los tipos de test de `CORTE` (seguía abierto en `pasada2-g4-corte-indice.md`) | `g4-corte-indice.md`:5 | herramienta, arreglada en `cobertura.py` desde `17f9702675` |
| el carril de `USER_IMPERSONATE` y los correos de `V7` (seguían abiertos en `pasada2-g6.md`) | `g6-v5-v9.md`:7, :57 | resueltos por las fuentes y por [BR](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-br), como en la tabla de arriba |
| los puntos 8, 9 y 12 de `g5` (seguían abiertos en `pasada2-g5-u-v1-v4.md`) | `g5-u-v1-v4.md`:118, :135, :175 | como en la tabla de arriba |

### Los de la tercera pasada

Los abiertos que deje la tercera pasada de redacción (`_trabajo/abiertos/pasada3-*.md`), fundidos
cuando existan. Al cerrar la pasada de este archivo no había ninguno.

<!-- abiertos-pasada3 -->
