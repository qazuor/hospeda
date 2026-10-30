---
title: "FASE 9 vuelta 2 · verificación C (grupos E y F, y el mecanismo nuevo de 16-, 17- y 18-)"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · verificación C: grupos E y F, y lo nuevo

**Ningún caso CRITICA.** Lo más alto que sale son cuatro MEDIA que piden decisión del owner
(§5 y §6) y una MEDIA de texto sobre el motivo 24 (`N-C-02`).

Verificación con el criterio de `DEC-METH-004` (opción 3), sobre el texto del worktree
`hospeda-spec-hos-1352-billing-redesign` al 2026-09-27, HEAD `d421d1ddf1`. Dos alcances:

1. Los hallazgos de la tabla de `16-aplicacion-decisiones-tardias.md` §6 cuyo **primer** grupo es
   E (`15-`) o F (`16-`).
2. El mecanismo nuevo que metieron `16-`, `17-` y `18-`: la acción administrativa 16, la entidad
   `vertical_discontinuation`, la pregunta `finDeServicio`, `R5` y los motivos 23 y 24 con sus
   defaults.

`B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` el contrato, `D/16` la FASE 7 del
paraguas. Decisiones del owner tomadas como salida esperada: las de `10-`, incluidas `R1-c` y
`R11-3b` (contra la recomendación). No edité ningún archivo del repo salvo este informe.

## 1. Resumen

El conteo del alcance, con script sobre la tabla de `16-` §6 (primera letra de la columna
*grupo · registro*):

```text
python3 - <<'EOF'
import re
t=re.findall(r'(?m)^\| `(F-8V2[A-D]\d-\d{3})` \| (R\d+) \|[^|]*\| ([A-F]) · ',
   open('16-aplicacion-decisiones-tardias.md').read())
print(len(t), sorted((i,r,g) for i,r,g in t if g in 'EF'))
EOF
# 56 · 8: A3-005 R24 F · B2-001 R18 F · B3-001 R20 F · B3-005 R25 E · B3-007 R20 E
#         B3-008 R20 E · C2-006 R27 E · C2-007 R13 E
```

**8 DEJA · 0 SIGUE · 0 DECLARADO · 0 OTRA.** Los seis racimos (R13, R18, R20, R24, R25, R27)
tienen el dominio cubierto en lo que su regla promete. Del recorrido salen **siete casos vecinos
nuevos** (§5: tres MEDIA y cuatro BAJA). De los **veinte** casos vecinos heredados de `15-` a
`18-`, **seis** ya los cerró un registro posterior o no llegan, **tres** quedan declarados, y
**once** siguen abiertos (§4).

| hallazgo | veredicto | línea que lo corta |
|---|---|---|
| `F-8V2B2-001` (R18) | DEJA | `B/03:2776` «Eso no es la baja del proveedor: la fila va a `CANCEL_SCHEDULED`» |
| `F-8V2B3-001` (R20) | DEJA | `B/09:163` «Y cada registro aprobado que sí tenemos acreditado se compara por IMPORTE» |
| `F-8V2B3-007` (R20) | DEJA | `B/09:161` «ni sobre una fila cuyo preapproval la relectura ve `cancelled`» |
| `F-8V2B3-008` (R20) | DEJA | `B/14:52` «Y el redondeo es uno, al final» |
| `F-8V2A3-005` (R24) | DEJA | `V/03:51` «y la vertical tiene al menos una versión de plan vigente y vendible» |
| `F-8V2B3-005` (R25) | DEJA | `B/03:1796` «el asiento es este `P1`, con menos efectos» |
| `F-8V2C2-006` (R27) | DEJA | `D/16:133` «revalidar las páginas públicas de toda ficha que nació `UNPUBLISHED_BY_BILLING` o `PURGED`» |
| `F-8V2C2-007` (R13) | DEJA | `D/16:126` «`RC-1` mide que leer por id es confiable» |

## 2. Los racimos

### 2.1 R18 · la transición que cancela antes de escribir y pierde la carrera

**Camino de Juan re-ejecutado.** Juan está en `GRACE_PERIOD`, cambia la tarjeta el último día.
El barrido corre `S6`: encola el correo *«antes de cancelar»*, lo manda y cancela el preapproval.
El reintento del proveedor entra, `S5` lleva la fila a `ACTIVE`, `S6` choca y no escribe. Llega el
`cancelled`: el par `cancelled` × vivo encuentra la salvedad nueva, que reconoce la cancelación
por el correo de ese `S6`, y la fila va a `CANCEL_SCHEDULED` con la fórmula de `S11`; `S12` la
termina al final del período que pagó. Su destaque recurrente se cancela por la regla de `S11`
(`R18-b`). **El paso 5 del camino original (*«se espeja la baja»*) ya no llega**, y el 6 tampoco:
la pantalla es la fila 22 de `B/19` §4.

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| `S6` por su primer evento contra `S5` | `B/05:97` «Pero si `S6` ya había mandado la cancelación» | sí |
| `S3` contra `S2` | `B/03:2776` «`S6` por su primer evento, o `S3`, mandaron la cancelación» | sí |
| la pantalla, también para `S7` | `B/19:140` «pagó el período mientras nosotros ya habíamos mandado» | sí |
| los complementos de esa principal (`R18-b`) | `B/03:2776` «Y sus complementos los cancela como `S11`» | sí |
| el reintento de la cancelación de esos complementos | `B/09:271` «Cuenta como de `S11` la fila de complemento que el espejo de `R18`» | sí |
| la unidad y su criterio (B7) | `$B/descomposicion.md:740` «el `cancelled` que llega después deja la fila en `CANCEL_SCHEDULED`» | sí |
| las otras transiciones que mandan cancelar (`S16`, `S24`, `S26`, `S28`, `S13`, `S36`) | `B/03:2831` «vuelve a leer y reevalúa la» | sí: o escriben antes de llamar (las quince de la salvedad 4 de `B/09` §3, `S16` incluida) o su evento sigue valiendo sobre `ACTIVE` y la reevaluación del §10.3 las vuelve a encontrar (`S24` pasa a ser `S11`) |
| `S6` por su **segundo** evento (`paused` leído) contra `S5` | la salvedad nombra sólo el primero | **no**: caso vecino `N-C-01` (BAJA) |

**Dominio cubierto: sí**, con el residuo de `N-C-01`. Lo revisé porque la forma de `R18`
(*«llama y después escribe»*) la tienen sólo `S6` y `S17` (precisión 2 del correo antes de
cancelar), y `S17` no compite con un pago por la misma fila.

### 2.2 R20 · la comparación de monto mira el preapproval y no el cobro

**Camino de Juan re-ejecutado.** Juan canjea un 50 % minutos antes del lote y el registro, creado
antes, cobra 30.000. `P1` acredita, pero el contador de la promo **no** baja, porque el importe
pasa del esperado con la promo aplicada, así que `S30` no restaura nada. Al otro día la
comparación de cobros compara 30.000 contra el esperado **del período**, con la promo según su
contador **antes** de ese cobro (15.000), abre el motivo 24 y propone devolver 15.000 por `RF1`.
**El paso final del camino original (*«30.000 contra 30.000, no marca nada»*) ya no llega.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| el importe cobrado contra el esperado del período | `B/09:163` «no se abre sobre un pago que ya cuelga de otra marca abierta» | sí, sin doble propuesta sobre un mismo pago abierto |
| la promo no se gasta con un cobro sin descuento | `B/03:1796` «sólo si el cobro salió con el descuento» | sí |
| el motivo, su `SÍ` y quién lo abre | `B/02:999` «No se abre sobre un pago colgado de otra marca abierta» | sí |
| el default en el listado | `B/19:228` «el proveedor cobró más que el monto esperado del período» | sí |
| la comparación de monto sobre preapprovals cancelados (`B3-007`) | `B/14:312` «cuyo preapproval la relectura ve `cancelled`» | sí; el predicado cubre la `CANCEL_SCHEDULED`, la `SUSPENDED` de tarjeta y cualquier otra fila con el preapproval ya cancelado |
| un solo redondeo para quien muta y quien compara (`B3-008`) | `B/09:161` «redondeado una sola vez y hacia abajo» | sí; el motivo 24 y la guarda de `P1` usan el mismo esperado |
| el pagador manual | `B/02:999` «un registro aprobado del proveedor que tenemos acreditado» | sí: no hay registro del proveedor que comparar |
| la lápida del corte, cobro del día | `B/09:163` «Sobre una lápida del corte no se comparan» | sí |
| un cobro por **debajo** del esperado | ninguna comparación | **no**: caso heredado de `16-` §5, MEDIA (§4 y pregunta 1) |
| la marca 24 ya levantada, o el pago ya devuelto en parte | ninguna regla | **no**: caso vecino `N-C-02` (MEDIA) |
| cómo corre la devolución de la diferencia | `B/02:999` «que al ejecutarse corre `P3` como devolución parcial» | texto vencido: caso vecino `N-C-03` (BAJA) |

**Dominio cubierto: sí** en lo que el owner decidió (el cobro de más), con los dos vecinos.

### 2.3 R24 · retirar todos los planes no cierra la vertical a trials

**Camino de Juan re-ejecutado.** El owner retira los tres planes de Gastronomía. Juan publica: `T1`
no dispara porque la vertical no tiene ninguna versión vigente y vendible, `T6` tampoco (no está
cubierto), y `PB1` no publica. La pantalla le dice que la vertical no tiene planes disponibles, sin
ofrecerle suscribirse. **El paso del camino original (*«se le consume el trial de por vida»*) ya no
llega.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| `T1` sin versión vendible | `V/03:308` «pero la vertical no tiene ninguna versión de plan vigente y vendible» | sí |
| `S1` (alta y sucesión) | `B/03:149` «`políticaDePlan(versión).vigente` y `.vendible`» | sí, desde la vuelta 1 |
| la pantalla al publicar | `V/19:76` «esta vertical no tiene planes disponibles» | sí |
| el botón de suscribirse | `V/19:70` «si la vertical no tiene ninguna versión de plan vigente y vendible» | sí |
| su espejo en billing | `B/19:139` «cuatro desenlaces son publicar, el checkout» | sí |
| la situación de la vertical | `B/10:430` «también con todos los planes retirados» | sí |
| lo tachado de `B/10` §4.1 | `B/10:135` «Y tampoco la cierra» | sí |
| `T7` (el encendido) | sin versión vendible no hay plan de trial que encender | sí, por construcción |

**Dominio cubierto: sí.**

### 2.4 R25 · qué corre al asentar un cobro sobre una lápida

**Camino re-ejecutado.** El handler asienta el cobro sobre la lápida de Juan: el `payment` pasa a
`SUCCEEDED` en la misma transacción, sin `covered_period`, sin promo y **sin aviso de cobertura**,
así que no hay consumidor que rechace un `user` nulo. La marca va en la misma transacción. Emite el
comprobante, que queda sin enviar. **El paso del camino original (*«la transacción se revierte»*)
ya no llega.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| lápida del corte y de recepción | `B/21:280` «Asentar es `P1` con menos efectos» | sí |
| el aviso de cobertura | `B/03:1796` «y no emite el aviso de cobertura» | sí |
| el comprobante (`R25`) | `B/03:1796` «Sí emite el comprobante» | sí |
| la comparación de importe del motivo 24 sobre el pago de una lápida | `B/09:163` «Sobre una lápida del corte no se comparan» | sí (la de recepción ya cuelga de la marca 7) |

**Dominio cubierto: sí.**

### 2.5 R27 · el corte despublica por escritura directa y el caché no se entera

**Camino re-ejecutado.** La ficha de Juan nace `UNPUBLISHED_BY_BILLING` en el paso 3. En el 4c
quien opera el corte revalida las páginas de toda ficha que nació abajo o `PURGED` y lo verifica
pidiendo una página de cada clase desde afuera. **El turista ya no encuentra la ficha en su página
horas después.**

| caso del dominio | dónde se contesta | ¿cubierto? |
|---|---|---|
| la ficha que nace abajo o `PURGED` | `D/16:133` «verificado pidiendo desde afuera la página de una ficha de cada clase» | sí |
| su lugar, fuera de la rama de aborto | `D/16:320` «lo revalida el 4c» | sí |
| la herramienta (V6) | `D/16:270` «de las páginas de las fichas que nacieron despublicadas» | sí |
| el capítulo de verticales | `V/21:163` «página pública la revalida el paso 4c del corte» | sí |
| los listados y buscadores que muestran la tarjeta de esa ficha | el 4c nombra sólo la página de la ficha | **a medias**: caso vecino `N-C-07` (BAJA) |

**Dominio cubierto: sí** para la página de la ficha, que es lo que el hallazgo pedía.

### 2.6 R13 · la cita de `RC-2` (`F-8V2C2-007`)

Busqué `RC-2` en `$B`, `$V`, el núcleo, el contrato y `D/16`: quedan sólo tachadas o citas que
hablan del historial de pagos, que es lo que `RC-2` mide.

| lugar | cita | ¿cubierto? |
|---|---|---|
| `D/16` paso 2 | `D/16:126` «`RC-1` mide que leer por id es confiable» | sí |
| `B/02` | `B/02:321` «id es otra cosa y es» | sí |
| `B/06` | `B/06:72` «por id, confiable» | sí |
| `B/09` | `B/09:39` «por id sí es confiable» | sí |
| `B/03` §10.1 | `B/03:2743` «Está medido que ese camino es el confiable» | sí |

**Dominio cubierto: sí.**

## 3. El mecanismo nuevo (`16-`, `17-`, `18-`)

### 3.1 Listas cerradas que tenían que nombrarlo

Recontado con `python3` sobre `$B`, `$V`, el núcleo, el log, el contrato y `D/16`, descontando lo
tachado, por número y por palabra (*quince*, *catorce*, *dieciséis*, *decimosexta*,
*veintitrés*, *veinticuatro*, *ocho*, *nueve*).

| lista | ¿lo nombra? | evidencia |
|---|---|---|
| catálogo de acciones, `NUCLEO/08` §3 | sí, fila 16 | `nucleo/08:167` «Es capacidad del actor: ningún cliente puede discontinuar una vertical» |
| el recuento de la tabla | sí | `nucleo/08:171` «La tabla tiene DIECISÉIS filas» |
| la lista de §3.1 regla 1 | sí | `nucleo/08:269` «y la decimosexta la de» |
| `V/17` §3.2 regla 3 (capacidad del actor: quince) | sí | `V/17:359` «las catorce primeras y la decimosexta» |
| `V/17` §3.3 (el actor de sistema) | sí | `V/17:419` «La decimosexta, discontinuar una vertical, es plata» |
| `V/17` §3.4 (la analogía con el reloj) | sí | `V/17:432` «quince acciones administrativas» |
| `B/19` §6 | sí | `B/19:202` «dieciséis del capítulo 08 §3 (núcleo)» |
| `B/03`, las siete líneas de la cifra | sí | `B/03:2198` «dieciséis (la decimosexta» |
| el log, `DEC-RF-008` | sí | `$D/01-decision-log.md:5935` «El catálogo tiene dieciséis acciones» |
| motivos, `B/02` §2.5 (24, nueve `SÍ`) | sí | `nucleo/08:158` «veinticuatro» |
| defaults de `B/19` §6 (23 y 24) | sí | `B/19:227` «`ORDEN_PAGADA_SIN_INSTANCIA` (motivo 23)» |
| entidades de billing, `B/02` §2.1 | sí | `B/02:26` «desde la FASE 9 vuelta 2, `vertical_discontinuation`» |
| entradas del contrato §4.1 (ocho) | sí | `D/12:1104` «la pregunta verticales, la contesta billing» |
| lo que no se ejecuta sin fila, sobre el grant | sí | `nucleo/08:176` «cada fila es UNA acción, aunque varias nombren más de una escritura» |
| lo que el panel muestra, `B/19` §6 | **no**: falta el acto a medias | caso vecino `N-C-06` |

Ninguna cifra vieja sin tachar: *«las otras veintitrés»* (`B/02`, `B/05`, `nucleo/08`) es el
total menos uno y está bien.

### 3.2 Cada escritura nueva, con su fila

| escritura | quién la hace | fila del catálogo o transición | ¿está? |
|---|---|---|---|
| `vertical.admite_altas = no` | la mitad de verticales (V2) | acción 16 | sí: `V/02:118` «Y la escribe verticales, en una sola ocasión» |
| alta de `vertical_discontinuation` con el anuncio | la mitad de billing (B12) | acción 16 | sí: `B/02:32` «nada más la toca» |
| `S26`–`S28` y los avisos | la mitad de billing | transiciones del §3.2 | sí |
| el reintento de la mitad de billing | «la acción» | acción 16 | **a medias**: no dice quién es el actor del reintento (`N-C-05`) |
| la llamada de la acción a la mitad de verticales | B12, que construye la acción | ninguna entrada del contrato | **no**: `N-C-04` |
| reescritura de la fecha al acortar la cola | `SUPER_ADMIN` | **ninguna** | **no**: caso heredado de `18-` §5 (pregunta 2) |
| `PB2`, hecho 4 e invalidación el día del fin | el reconciliador de V6 | `V/03` §9 | sí: `V/03:1290` «Verticales lo ejecuta en el reconciliador diario de cobertura» |
| la respuesta `NINGUNA` de arranque | V4 | contrato §5.1 | sí: `D/12:1313` «`finDeServicio` (§4.1) contesta `NINGUNA`» |

**`R5` (billing sólo avisa)**: no queda ningún texto sin tachar que le mande al barrido de billing
correr `PB2`, escribir `inactiva_desde` o invalidar el caché, y `vertical.fin_de_servicio` sólo
aparece tachado o como historia en `B/10`.

## 4. Casos vecinos heredados (`15-` a `18-`)

| origen | caso | hoy | severidad | ¿plata? | ¿decisión? |
|---|---|---|---|---|---|
| `15-` §5 | segunda enumeración de `B/16` §4.3 (*«muere la sucesora que relevaba»*) sin `S16`/`S24`/`S36` sobre una sucesora | abierto; la cuarta comprobación del barrido (motivo 11) lo ve al día siguiente | BAJA | no | no, texto |
| `15-` §5 | el paso 5 no espera al 4c | abierto por diseño (`R27`) | BAJA | no | no |
| `15-` §5 | asiento del motivo 19 sobre una lápida | **no llega**: el 19 no se abre sobre una lápida | n/a | n/a | n/a |
| `15-` §5 | comprobantes de sondas consumen numeración | abierto | BAJA | sí, del owner, sin cliente | no |
| `16-` §5 | `NUCLEO/08` sin la fila de discontinuar | **cerrado** por `Q-ACC16` (`nucleo/08:167`) | n/a | n/a | n/a |
| `16-` §5 | **cobro por debajo del esperado** | abierto | **MEDIA** | sí, de Hospeda | **sí**, pregunta 1 |
| `16-` §5 | Outlook en la lista de `R23` sin medir | abierto | BAJA | no | no: medir (`y los que se midan`) |
| `16-` §5 | pasada de `R21-b` antes del 0b | **DECLARADO** en `B/21` «NO cierra» | BAJA | sí, del cliente, declarado | no |
| `16-` §5 | motivo 24 sobre un pagador manual | **cerrado** por la letra de la fila 24 | n/a | n/a | n/a |
| `16-` §5 | lectura de la selección de `S32` con `CANCEL_SCHEDULED` | abierto sólo como confirmación; el texto aplicado es el seguro | BAJA | no con la aplicada | confirmación, pregunta 5 |
| `16-` §5 | clase del correo de la alerta de precio cerrada | abierto como confirmación; aplicada *transaccional* | BAJA | no | confirmación, pregunta 5 |
| `17-` §5 | `B/09` nombra sólo `S11` y `S26` en cuatro lugares | **cerrado**: `B/09:271` los cuenta como de `S11` | n/a | n/a | n/a |
| `17-` §5 | marca 22 abierta sobre un complemento que `S7` ya canceló | abierto | BAJA | no | no, texto |
| `17-` §5 | avisos del anuncio una sola vez si se reintenta | **cerrado** por el núcleo: el outbox encola en la transacción de dominio (`NUCLEO/07` §1.1) y deduplica por evento (§2); falta decirlo en `B/10` §4.3 | BAJA | no | no, texto |
| `17-` §5 | residuo de `S7` con el complemento pausado | **DECLARADO** en `B/16` «NO cierra» | BAJA | no | no |
| `18-` §5 | el sujeto de la acción 16 no es una cuenta | abierto | BAJA | no | no, texto |
| `18-` §5 | **acortar la cola no tiene fila** | abierto | **MEDIA** | sí | **sí**, pregunta 2 |
| `18-` §5 | los tres avisos contados desde el anuncio | **no llega**: los dos últimos cuentan hacia atrás desde la fecha | n/a | n/a | n/a |
| `18-` §5 | `V/17` §3.3 *«Doce mueven dinero»* | **no llega**: la 14 y la 16 se nombran una por una como plata | n/a | n/a | n/a |
| `18-` §5 | el reintento conserva el instante del anuncio | **DECLARADO de hecho**: `B/02` dice que sólo el acortamiento reescribe la fila | BAJA | no | no |

### El cobro por debajo del esperado (con cuidado)

**Qué pasa.** La comparación del motivo 24 sólo mira el cobro de más, y la del monto mira el
`transaction_amount` del preapproval, no el cobro. Un cobro **menor** que el esperado, con el
preapproval ya corregido, no lo ve nadie.

- `B/09:163` «Si cobró de más, se abre la marca con motivo `IMPORTE_COBRADO_DE_MÁS`»

**Cuándo ocurre.** Cuando una mutación que **sube** el monto cae entre la creación del registro
del ciclo y su cobro, y el registro cobra el viejo: el aumento de `DEC-MP-002`, o `S30`
restaurando el precio al agotarse una promo. Si pasa o no es `EX-47` (`UNKNOWN`). **En un aumento
es sistemático**: la mutación corre sobre toda la cartera de la vertical en la misma fecha, así
que, si `EX-47` da *«cobra el viejo»*, cada suscriptor cuyo registro ya estaba creado paga un ciclo
al precio anterior.

**Severidad: MEDIA.** A favor de bajarla: es plata de Hospeda y no del cliente (nadie paga de
más, no hay riesgo legal ni de reputación), está acotada a un ciclo por mutación y por fila, y el
diseño ya acepta por escrito una pérdida de la misma forma. A favor de no bajarla más: hoy **ni
siquiera se mide**, contra el principio que el owner fijó para la pausa regalada (*«el costo
aceptado se mide, no se impide»*), y en un aumento alcanza a toda la cartera de una vez.

- `B/14:313` «ese mes sale con descuento, y se acepta»
- `nucleo/08:312` «Y un tipo del resumen que no nace de una marca»

## 5. Casos vecinos nuevos

### `N-C-01` · BAJA · la salvedad de `R18` nombra sólo el primer evento de `S6`

**Vecino de qué.** `S6` también manda cancelar antes de escribir por su **segundo** evento (el
`paused` leído en el proveedor), y su correo *«antes de cancelar»* se encola igual, con el hecho
que la dispara como ocurrencia. Si un pago en vuelo entra por `S5` en ese intervalo, la
reevaluación ya no ve `paused` (lo ve `cancelled`), `S6` no escribe, y el espejo corta la fila,
porque la salvedad dice *«por su primer evento»*.

- `B/03:2776` «`S6` por su primer evento, o `S3`, mandaron la cancelación»
- `B/03:362` «el vencimiento del reloj, el `paused` o el `cancelled` leídos»

**Por qué BAJA.** Un preapproval pausado por mora no cobra, así que hace falta un pago que ya
estaba en vuelo cuando el proveedor pausó. La decisión `R18` habla de *«`S6`/`S3` ya mandaban
cancelar»*, sin evento, así que el arreglo es de texto: reconocer la cancelación por el correo de
`S6` sea cual sea su evento.

### `N-C-02` · MEDIA · el motivo 24 se vuelve a abrir sobre un pago ya resuelto

**Vecino de qué.** La unicidad de la marca vale sólo mientras está abierta, y la comparación se
repite en cada corrida sobre *«cada registro aprobado que sí tenemos acreditado»*. El exceso de un
cobro no desaparece al resolverlo: si la persona devolvió la diferencia, el importe cobrado del
registro sigue siendo el mismo; si se apartó y no devolvió, también.

- `B/02:56` «`UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL`»
- `B/09:163` «no se abre sobre un pago que ya cuelga de otra marca abierta»

**Camino de Juan.** El barrido abre el 24 por 15.000; una persona confirma `RF1` por 15.000 y
levanta la marca. En la corrida siguiente el registro sigue diciendo 30.000 contra 15.000: se abre
otro 24, con el default *«devolver la diferencia»*. Si alguien lo confirma, Hospeda devuelve dos
veces. Si la persona había decidido no devolver, el caso vuelve todos los días.

**Por qué MEDIA.** Es plata de Hospeda y pasa por una confirmación humana (`RF2`), que ve el pago
ya en `PARTIALLY_REFUNDED`; pero el default empuja a confirmar, y la variante *«no devolver»* se
vuelve imposible de sostener. **Arreglo de texto, sin decisión**: el 24 no se abre sobre un pago
que ya tuvo un 24 levantado, y el exceso se calcula neto de las devoluciones ejecutadas de ese pago.

### `N-C-03` · BAJA · la devolución de la diferencia no corre `P3`

`P3` es el reembolso **total** y `P4` el parcial; `RF3` corre uno u otro según el acumulado.

- `B/02:999` «que al ejecutarse corre `P3` como devolución parcial»
- `B/03:1885` «corre **`P3` o `P4`** sobre el pago, según el acumulado»

Texto vencido: debería decir `P4` (o *«`P3` o `P4`, según el acumulado»*).

### `N-C-04` · MEDIA · la acción 16 la construye billing y escribe en verticales fuera del contrato

**Vecino de qué.** `Q-ALTAS` sacó de billing la escritura de `admite_altas` porque el contrato
admite una sola escritura de billing en verticales. Pero la acción que orquesta las dos mitades la
construye **B12**, una unidad de billing, y para correr la mitad de verticales tiene que invocar
una escritura de verticales que **ninguna entrada del §4.1** declara. La regla de vigilancia marca
exactamente eso, y exime sólo a las superficies de la capa de composición, que son lecturas.

- `$B/descomposicion.md:138` «esa acción es la 16 de `NUCLEO/08` §3»
- `D/12:1268` «verticales algo que no sea `extenderTrial`»

**Camino.** El constructor de B12 escribe la acción; necesita que verticales ponga
`admite_altas = no`. O la escribe directo en la tabla de verticales (la filtración que `R5` y
`Q-ALTAS` quisieron sacar), o inventa una operación que el contrato no tiene. El guard de la
frontera, si lo hay, se pone rojo.

**Por qué MEDIA.** No toca plata; obliga a adivinar en el borde que el programa entero protege.
Pide decisión (pregunta 3).

### `N-C-05` · MEDIA · el reintento de la mitad de billing no tiene actor

**Vecino de qué.** `Q-ALTAS-b` dice que *«la acción»* reintenta hasta que entra. Si el reintento
es automático, lo corre un proceso, y la regla de autorización prohíbe a un actor de sistema
ejecutar cualquiera de las dieciséis acciones, la 16 incluida porque es plata. Si es manual, el
texto no dice que el admin lo dispara.

- `V/17:408` «Un actor de sistema no puede ejecutar ninguna de las»
- `nucleo/08:167` «la acción la reintenta hasta que entra»

**Precedente**: la re-emisión de una cortesía diferida la hace `S9` como efecto y lleva la firma
original de `SUPER_ADMIN`, así que no es una concesión nueva (`nucleo/08` §3, tabla del enrutado).

**Por qué MEDIA.** El reintento corre `S26`–`S28`, que cancelan en el proveedor. Un implementador
lo hace job (y rompe `D11` a la letra) y otro lo deja manual sin pantalla. Pide decisión
(pregunta 4).

### `N-C-06` · BAJA · el panel de `B/19` §6 no lista el acto a medias

`Q-ALTAS-b` le pide a la acción que le muestre al admin el acto a medias, y la fila 16 lo repite,
pero la lista de lo que el panel tiene que mostrar como salida del diseño no lo nombra.

- `B/19:205` «Tres cosas que el panel necesita mostrar»

Texto, sin decisión.

### `N-C-07` · BAJA · el 4c revalida la página de la ficha, no los listados

El 4c nombra la página de cada ficha y la verificación pide *«la página de una ficha de cada
clase»*. Los listados y el buscador que muestran su tarjeta también están en caché. El código
actual ya tiene la etiqueta de colección, que invalida todos los listados de un tipo en una sola
purga (y evita el tope de purgas del plan del borde).

- `packages/service-core/src/revalidation/revalidation.service.ts:43` «already covers every listing/facet page that could show one of its members»

Texto, sin decisión: sumar la purga de la etiqueta de colección al 4c.

## 6. Preguntas para el owner

1. **El cobro por debajo del esperado (`16-` §5, MEDIA).**
   - **A (recomendada): una línea del resumen de `DEC-OBS-001`, sin marca.** La comparación de
     cobros ya calcula el esperado; lista el cobro de menos con el sujeto y la diferencia, como la
     pausa regalada. **Costo**: una línea en `NUCLEO/08` §4.1 y en `B/09` §3; no mueve el conteo
     de motivos. **Riesgo**: ninguno; se mide, no se cobra.
   - **B: motivo 25, con *«no»***. **Costo**: mueve otra vez los conteos (25 motivos) con todos sus
     espejos. **Riesgo**: una persona por caso para decidir que no hay nada que devolver.
   - **C: declararlo en el «NO cierra»** con la cota de un ciclo. **Riesgo**: en un aumento no se
     sabe cuántos fueron.
   - **Juan**: el aumento de su plan entra el 1/11 y su registro, creado el 29/10, cobra 10.000 en
     vez de 12.000. Con A, el resumen del día siguiente dice *«Juan, −2.000»*; con C nadie lo sabe.
2. **Acortar la cola no tiene fila en el catálogo (`18-` §5, MEDIA).**
   - **A (recomendada): entra en la fila 16 como *«discontinuar una vertical o acortar su
     cola»***, el mismo instrumento (`vertical_discontinuation`) y el mismo permiso, como
     *«otorgar, anclar o revocar»*. **Costo**: una frase; no mueve ningún conteo. **Riesgo**: la
     confirmación tiene que decir cuántos compromisos se reembolsan.
   - **B: fila 17 propia.** **Costo**: dieciséis pasa a diecisiete y quince a dieciséis en las
     capacidades, con todos los espejos de `18-`.
   - **Juan** pagó un anual en Gastronomía el día antes del anuncio. Si el owner acorta la cola, la
     fecha de Juan se adelanta y se le reembolsa lo no prestado: con A ese acto tiene permiso,
     auditoría y una confirmación que dice *«se reembolsan N compromisos»*; hoy no tiene fila.
3. **La acción 16 y el contrato (`N-C-04`, MEDIA).**
   - **A (recomendada): declarar la acción 16 capa de composición**, fuera de las máquinas de las
     dos épicas, y decirlo en la regla de vigilancia. **Costo**: una frase en `D/12` §4.2 y en
     `nucleo/08`. **Riesgo**: la exención tiene que nombrar esta acción, no *«las acciones»*.
   - **B: una segunda escritura en el contrato** (*«cerrarAltas»*). **Costo**: las entradas del
     §4.1 pasan de ocho a nueve, con sus recuentos.
   - **Juan** no ve nada: es un borde de construcción, pero es el que decide si el guard de la
     frontera se pone rojo el día que se escribe la acción.
4. **Quién reintenta la mitad de billing (`N-C-05`, MEDIA).**
   - **A (recomendada): automático, con la firma y la correlación del `SUPER_ADMIN` que confirmó**,
     como la re-emisión de `S9`, y dicho en `V/17` §3.3 como la excepción que no es una acción
     nueva. **Riesgo**: bajo; nadie paga de más mientras tanto.
   - **B: manual**: el panel muestra el acto a medias y el admin aprieta *«reintentar»*.
     **Riesgo**: si nadie mira, la vertical queda sin altas y sin fecha indefinidamente.
   - **Juan**, que ya pagaba en la vertical, no nota nada en ninguna de las dos: sigue igual hasta
     que la mitad entra y le llega el aviso.
5. **Dos confirmaciones que quedaron colgadas** (BAJA, recomiendo confirmar lo aplicado): la
   exclusión de `CANCEL_SCHEDULED` en la selección de `S32` al darse de baja (`11-` §1), y la clase
   *transaccional* del correo de la alerta de precio cerrada (`14-` §4, pregunta 4). **Juan** con
   la otra lectura: paga un ciclo más de su destaque global después de sus dos bajas, o no se
   entera de que su alerta dejó de vigilar porque tenía el opt-out.

## Key Learnings

1. La forma *«llama y después escribe»* la tienen sólo `S6` y `S17`: las demás transiciones que
   cancelan escriben primero o conservan su evento en la reevaluación. Por eso `R18` no tiene
   gemelas en otras transiciones, pero sí en el **segundo evento** de la propia `S6`.
2. Una unicidad parcial (`WHERE levantada_en IS NULL`) junto a una comparación que se repite cada
   día convierte cualquier condición persistente en una marca que vuelve. El motivo 24 es el
   primero cuya condición no desaparece al resolverlo.
3. Sacar una escritura del lado que no es su dueño (`Q-ALTAS`) no alcanza si el orquestador que la
   invoca vive en ese mismo lado: la frontera se cruza igual, un nivel más arriba.
4. *«La acción reintenta»* esconde un actor. Toda repetición automática de un acto humano tiene que
   decir con qué firma corre, o choca con la regla del actor de sistema.
5. El cobro de menos tiene precedente de aceptación (`B/14` §2.4) y de medición (`NUCLEO/08` §4.1),
   así que la salida barata ya existe en el diseño y no pide un motivo nuevo.
