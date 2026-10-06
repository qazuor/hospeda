---
title: FASE 9-bis-4 — Rastro por aparición de la familia del pagador manual
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `8f9f31ac0`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que ninguno de los cuatro commits tocó**, van el archivo, la línea, el §, la cita y **por
qué sigue siendo correcta**. No hay agregados: cada línea de abajo se puede tomar sola y mostrarse
falsa.

## Los cuatro commits

| sha | qué cierra |
|---|---|
| `11aac0088` | `F-8eB1-002` y `F-8eB1-001` juntos — la columna que `MP5` lee gana quién la mueva, y el re-anclaje de `MP4` deja de ser incondicional |
| `89a38386c` | corrección del anterior: la vuelta de una pausa espeja `PS-6`, no el tope |
| `243c90069` | la otra mitad de `F-8eB1-001` — la pantalla y el correo dicen cuándo vence la próxima cuota |
| `8f9f31ac0` | la mitad de la pausa cuelga de una medición abierta de `DEC-SUB-010`, y queda escrito en el § |

## 1. Qué se arregló, en una frase cada uno

- **`F-8eB1-002`** — la condición de `MP5` leía *«el período actual arrancó y no tiene fila»* y
  **nadie avanzaba esa columna**. La columna pasa a llamarse **«la fecha del próximo cobro»** —lo
  que guarda es una fecha, no un período— y gana **tres escrituras declaradas y un tope**: la
  estrena `S2`, la avanzan un ciclo `MP1` y `MP4` al quedar registrada la cuota, y `S10` la avanza
  los ciclos que vencieron durante una pausa.
- **`F-8eB1-001`** — el avance de `MP4` **lleva un tope y no un re-anclaje**: sólo si ese avance
  cae en el pasado la fecha pasa al instante de la reactivación. El que transfiere el día 20 de un
  período que arrancó el día 0 conserva los diez días que pagó.
- **Cómo interactúan**: el arreglo de 001 **es una de las tres escrituras que 002 necesitaba**, y
  002 es lo que vuelve seguro el arreglo de 001. Sin la fecha que avanza sola, no re-anclar dejaba
  el período congelado para siempre —la enfermedad de 002—; sin el tope, la única escritura que
  movía la columna la movía de más y cobraba dos veces.

## 2. Qué se grepeó

**Términos NUEVOS** (los que las correcciones definen): *«la fecha del próximo cobro»* como
columna de `subscription` · *«avanza un ciclo»* al registrarse la cuota · *«tantos ciclos como
hayan vencido durante la pausa»* · el **tope** de `MP4` · *«el período se identifica por su fecha
de inicio»*.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no
aparece buscando el nuevo: *«período actual»* · *«el período no avanza mientras el pago no entra:
`S5` es lo que lo cierra»* · *«se re-ancla»* / *«RE-ANCLA»* / *«el período nuevo arranca EN LA
REACTIVACIÓN»* · *«de golpe todas las cuotas»* · *«no, y la población es vacía»* (la fila
`GRACE_PERIOD`) · *«Dice dos cosas y ninguna es opcional»* · *«arranca el período»* / *«inicio de
período»* / *«inicio del período»*.

**Términos VECINOS**, grepeados porque nombran la misma cifra desde otro lado y son donde un
consumidor se rompe sin nombrar ninguno de los dos: `PS-6` · `DEC-SUB-010` · *«el período que
cubre»* · *«el fin del período pagado»* · *«un ciclo»* / *«el ciclo siguiente»* / *«el ciclo en
curso»*.

**Alcance**: los **40 archivos** del corpus —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición y el decision log—, con y sin
backticks, **incluidos los archivos que los commits tocan**.

**Medido sobre el árbol en `8f9f31ac0`**: **117** líneas con al menos una aparición; **52** en
párrafos que algún commit de esta tanda tocó; **65** en párrafos que ninguno tocó, que son las que
van abajo, una por una. La partición se calculó con los rangos `+` de
`git diff --unified=0 64e3f0dbe..HEAD`, expandidos al párrafo entero, no a ojo.

## 3. Las 65 apariciones no corregidas, una por una

### `01-decision-log.md` (31)

**El decision log NO se toca por instrucción de la fase.** Las tres apariciones de `DEC-SUB-013`
que quedan más abajo son las únicas del corpus entero que la corrección vuelve más estrechas que
su texto, y por eso van repetidas como pregunta al owner en el §4.

- **L635 · `DEC-ENT-004`** — «(1) no se renueva, conservando el período pagado» → sigue correcta:
  es una **alternativa descartada** de una decisión sobre el VIP previo, no una regla vigente, y
  no habla de ninguna suscripción de pagador manual.
- **L645 · `DEC-ENT-004`, implicación 2** — «El día que exista un ciclo anual de Turista VIP, el
  monto retenido puede ser de hasta once meses» → sigue correcta: es el disparador de revisión de
  esa decisión. La cadencia de la que habla es la del plan, que es justamente el *«un ciclo del
  `billing_option`»* que el avance usa; nada la cambia.
- **L817 · `DEC-GRANT-001`** — «(2) no se renueva, conservando el período pagado» → ídem L635:
  alternativa descartada, sobre un grant permanente.
- **L836 · `DEC-GRANT-001`, implicación 5** — «el día que exista un ciclo anual, el monto retenido
  puede ser de once meses» → ídem L645.
- **L955 · `DEC-SUB-005`** — «bajar de tier con el mismo ciclo espera al fin del período» → sigue
  correcta y es de otra población: gobierna el **cambio de plan**, que sobre un pagador manual no
  cambia por este arreglo. El *«fin del período»* de ahí lo fija el proveedor.
- **L1099 · `DEC-SUB-007`** — «subir de plan es gratis hasta el próximo cobro» → sigue correcta, y
  **es la misma cifra que acá se nombra**: el *«próximo cobro»* del pagador con tarjeta lo tiene el
  proveedor, que es el régimen que `B/02` §2.2 deja intacto.
- **L1103 · `DEC-SUB-007`** — «el proveedor no prorratea ni cobra la diferencia del ciclo en curso»
  → sigue correcta: es una medición (`UP-1`/`UP-2`) sobre el proveedor, y el arreglo no toca nada
  que el proveedor haga.
- **L1113 · `DEC-SUB-007`** — «(A) aceptar el upgrade gratis hasta el próximo cobro» → alternativa
  descartada; sigue correcta como descripción de lo que el proveedor hace solo.
- **L1124 · `DEC-SUB-007`** — «subir de plan y cancelar antes del cobro entrega un ciclo de plan
  caro casi gratis» → sigue correcta: describe el agujero de la alternativa (A), no el mecanismo
  adoptado.
- **L1180 · `DEC-SUB-008`** — «el próximo cobro ya corresponde al plan nuevo y sale correcto solo»
  → sigue correcta **y se apoya justamente en que el proveedor tiene la fecha**: es el régimen con
  débito, donde nuestra columna es una copia.
- **L1218 · `DEC-SUB-009`, título** — «La baja a fin de período cancela YA» → sigue correcta: el
  arreglo no cambia cuándo termina un período, cambia quién escribe cuándo empieza el siguiente.
- **L1240 · `DEC-SUB-009`** — «sostener el servicio de nuestro lado hasta el fin del período
  pagado» → sigue correcta, y el §7.2 la usa: es lo que hace que en `CANCEL_SCHEDULED` no empiece
  ningún período nuevo.
- **L1335 · `DEC-MP-002`** — «conserva el servicio hasta el fin del período que pagó» → ídem
  L1240, sobre el camino del aumento de precio.
- **L1590 · `DEC-SUB-010`, título** — «el que vuelve antes paga el ciclo siguiente completo» →
  sigue correcta, **y es exactamente lo que el arreglo le da al pagador manual**: `S10` avanza la
  fecha a ese ciclo siguiente en vez de dejarla donde estaba.
- **L1601 · `DEC-SUB-010`, contexto medido** — «`PS-6` `NOT_SUPPORTED`: el ciclo que vence estando
  pausada avanza la fecha +1 ciclo sin cobrar» → sigue correcta **y gana un consumidor**: es la
  medición que el §7.2 cita para fijar qué hace `S10` sobre un pagador manual. No se corrige
  porque no cambió: lo que cambió es que ahora alguien más la lee.
- **L1614 · `DEC-SUB-010`** — «(C) pausar ya, en múltiplos de un ciclo entero, sin compensación de
  ninguna clase» → sigue correcta: es la alternativa elegida, y el arreglo la respeta —el pagador
  manual tampoco recibe compensación, recibe la misma fecha corrida.
- **L1616 · `DEC-SUB-010`** — «los días no usados del ciclo en curso se pierden» → sigue correcta
  para los dos métodos de pago: sobre el manual, `S10` no abre cuota por esos días y tampoco los
  devuelve.
- **L1639 · `DEC-SUB-010`, motivo** — «sólo le da los días que van de la reanudación al próximo
  cobro gratis» → sigue correcta, **y es el argumento que hace que el tope NO corra en `S10`**: esos
  días gratis son los que el pagador con tarjeta recibe, y quitárselos al manual sería el `if` por
  método que `B/06` §7 prohíbe.
- **L1640 · `DEC-SUB-010`, motivo** — «Lo único que pierde es lo que ya estaba decidido: los días
  del ciclo en curso» → ídem L1616.
- **L1704 · `DEC-GRANT-003`, motivo** — «el reloj que pausa y reanuda hay que construirlo igual por
  `DEC-SUB-010`. La cortesía es otro motivo para el mismo mecanismo» → sigue correcta y **es la
  razón de que el arreglo escriba la regla en `S10` y no en una fila nueva**: un mecanismo, dos
  motivos.
- **L1720 · `DEC-GRANT-003`, implicación 6** — «Lo que `PS-6` mide —que el ciclo vencido en pausa
  se pierde— acá no aplica: durante la cortesía el servicio lo damos igual» → **sigue correcta y no
  contradice al arreglo**, y conviene decir por qué porque parece que sí. Lo que esa implicación
  declara inaplicable es la **pérdida de servicio**, no el **avance de la fecha**: la fecha la
  corre el proveedor igual, `EX-34` dice que es inmutable para nosotros, y lo que hacemos es
  sostener el servicio. `S10` sobre un pagador manual hace las dos mitades a la vez —no abre cuota
  y corre la fecha—, así que el beneficiario recibe exactamente lo mismo por los dos métodos.
- **L1750 · `DEC-GRANT-004`, motivo** — «introduce un mecanismo que `DEC-SUB-010` ya había
  descartado: ahí se decidió que la pausa empieza cuando el cliente la pide, sin diferir nada» →
  sigue correcta: el arreglo no difiere ninguna pausa, escribe qué pasa **al volver**.
- **L1755 · `DEC-GRANT-004`** — «la misma operación sin sentido económico que `DEC-SUB-010` eliminó
  para la pausa intra-ciclo» → sigue correcta: habla de pausar **durante** una cortesía, que el
  arreglo no toca.
- **L1923 · `DEC-ARCH-004`** — «de las ocho capacidades del capítulo 06 ya traíamos cinco de
  nuestro lado —el reloj de la pausa, … la compensación de días y la baja a fin de período—» →
  sigue correcta, y el arreglo **no agrega una sexta**: escribir la fecha del pagador manual es el
  mismo *«reloj de la pausa»* que esa cuenta ya incluye, ejecutado sobre la población sin
  proveedor.
- **L2518 · `DEC-MIG-003`** — «si alguno no se pudo cancelar, el corte no avanza» → sigue correcta:
  es el gate del corte y el *«no avanza»* es de otro sujeto, no del período.
- **L3149 · `DEC-ADDON-004`** — «sostener el servicio hasta el fin del período pagado, que era la
  alternativa» → sigue correcta: describe el patrón de `DEC-SUB-009` que esa decisión descarta para
  `S21`.
- **L3328 · `DEC-SUB-013`** — «Al reabrir por `MP4`, el período se RE-ANCLA al instante de la
  reactivación» → **el capítulo ahora dice algo más estrecho**, y no se corrige acá porque la
  fase prohíbe tocar el log. Ver §4, pregunta 1.
- **L3329 · `DEC-SUB-013`** — «con el ancla vieja el reloj crearía de golpe todo el atraso» →
  **el mecanismo es falso** —`MP5` crea una cuota por corrida— y el desenlace que describe sigue
  siendo real. Ver §4, pregunta 1.
- **L3331 · `DEC-SUB-013`** — «no se escribe en `S7`, porque el pagador con tarjeta no re-ancla
  (`EX-39`)» → **sigue verdadera en su razón y el arreglo la respeta**: el tope no se escribió en
  `S7` sino en la celda de `MP4`, que es la puerta del pagador manual. Lo que sí ganó una cláusula
  es `S10`, que esa frase no nombraba.
- **L3516 · Resumen** — «`BD-MP-01` (pausa) la cerró `DEC-SUB-010`» → sigue correcta: el arreglo no
  reabre ese bloqueante, lo consume.
- **L3517 · Resumen** — «Decisiones condicionadas a FASE 1C: 1 — `DEC-SUB-010`, a la segunda
  lectura del reloj (¿la fecha corre +1 ciclo por vencimiento indefinidamente, o sólo la primera
  vez?)» → **sigue correcta, sigue siendo UNA, y ahora tiene un segundo dependiente**: `8f9f31ac0`
  lo dejó escrito en `B/03` §7.2 en vez de suponerlo. No se agrega una condicionada nueva: es la
  misma medición pendiente, con un consumidor más.

### `12-contrato-de-cobertura.md` (2)

- **L382 · §2.6** — «El `hasta` de una suscripción `ACTIVE` es `SIN_FECHA_CONOCIDA`, nunca el fin
  del período» → **sigue correcta y deja de ser peligrosa**. Era la mitad que volvía indefinida la
  cobertura del pagador manual que no volvía a pagar; con la fecha que avanza, esa fila sale de
  `ACTIVE` por `S4` en cuanto se abre la cuota siguiente, así que el `hasta` abierto ya no sostiene
  nada. El contrato no cambia: cambia cuánto dura el estado que lo emite.
- **L383 · §2.6** — «el §4 declara que no cruzan *«ciclos … fechas de cobro»*; poner el fin del
  período ahí es …» → **sigue correcta, y es la razón de que el arreglo viva entero del lado de
  billing**: la fecha del próximo cobro **no** cruza la frontera, así que ninguna regla de
  verticales la lee y el arreglo no le agrega un dato al contrato.

### `16-fase-7-del-paraguas.md` (1)

- **L115 · §4.2** — «si alguno no se pudo cancelar, el corte no avanza» → sigue correcta: el sujeto
  del *«no avanza»* es el corte, no un período.

### `NUCLEO/01-glosario.md` (2)

- **L413 · §3** — «los 120 días del §26.3 son 4 pausas-mes y los 240 son 8 (`DEC-SUB-010`)» →
  sigue correcta: son los topes de la pausa, que el arreglo no toca. Lo que `S10` escribe es la
  fecha de cobro, no la duración de la pausa.
- **L425 · §3** — «La pausa se pide en meses enteros y empieza cuando el cliente la pide» → sigue
  correcta, **y es lo que hace computable el avance de `S10`**: con meses enteros, *«cuántos ciclos
  vencieron»* es una cuenta y no una estimación.

### `NUCLEO/04-invariantes.md` (2)

- **L65 · §2.2, invariante 22** — «la cancelación normal conserva el período pagado — `S11` + `S12`,
  con nuestra fecha de fin de servicio» → sigue correcta: el arreglo no toca `S11` ni `S12`, y la
  fila `CANCEL_SCHEDULED` del §7.2 se apoya en este invariante en vez de contradecirlo.
- **L67 · §2.2, invariante 24** — «la pausa puede terminar anticipadamente — `S10`, el mismo reloj
  para el fin previsto y el anticipado» → sigue correcta: el avance de la fecha se computa **al
  volver**, así que vale igual para el fin previsto y para la vuelta anticipada. No agrega un
  segundo reloj, que es lo único que este invariante prohíbe.

### `HOS-1354/docs/02-modelo-de-datos.md` (2)

- **L281 · §2.3** — «La cuota se abre al inicio del período —*«el mismo instante en que el
  proveedor habría cobrado»*, `B/03` §7.2—» → sigue correcta **y recién ahora es ejecutable**: ese
  instante es el valor de la columna, que antes nadie movía.
- **L287 · §2.3** — «el `UNIQUE(subscription_id, período)` de `B/05` §C5 ya la presuponía … ni la
  condición 2 del `B/05` §3 tienen contra qué evaluarse» → sigue correcta, y el párrafo que se le
  agregó debajo es lo que la completa: dice **cómo** se identifica ese período.

### `HOS-1354/docs/03-maquinas-de-estado.md` (6)

- **L49 · §3.1** — «`CANCEL_SCHEDULED`: dada de baja en el proveedor, con servicio sostenido hasta
  el fin del período pagado» → sigue correcta: es la definición del estado y la premisa que usa la
  fila `CANCEL_SCHEDULED` del §7.2.
- **L623 · §8** — «`A4` tampoco, y su población es vacía: un preapproval propio existe sólo si el
  cobro es `PERIÓDICO`» → sigue correcta y es de otra máquina (instancia de addon). El *«población
  vacía»* que este arreglo retiró es el de la fila `GRACE_PERIOD` del §7.2, no éste.
- **L628 · §8** — «cancela en el proveedor de inmediato y sostiene el servicio de nuestro lado
  hasta el fin del período pagado» → sigue correcta: cita `DEC-SUB-009` para descartarlo en `S21`.
- **L799 · §5** — «unidad: meses enteros (`DEC-SUB-010`). No existe la pausa intra-ciclo» → sigue
  correcta, y es la premisa de que el avance de `S10` sea un número entero de ciclos.
- **L802 · §5** — «qué pasa al volver: se cobra normal en el ciclo siguiente; reanudar cambia sólo
  el estado y no dispara cobro de recuperación ni deja deuda (`PS-5`)» → **sigue correcta y recién
  ahora vale para los dos métodos**. Enunciada sola describía lo que el proveedor hace; el arreglo
  la hace verdadera también donde no hay proveedor, sin cambiarle una palabra. Y *«no deja deuda»*
  es exactamente lo que el avance sin cuota garantiza.
- **L1491 · §8** — «en el convertido su población es vacía» → sigue correcta: habla del addon que
  un grant convierte a $0, otra máquina y otro sujeto.

### `HOS-1354/docs/05-idempotencia-y-concurrencia.md` (2)

- **L88 · §C2** — «el cobro es por adelantado, así que pagó el período que va a usar. Se extiende
  la fecha de fin de servicio hasta cubrirlo» → sigue correcta: es el cruce cobro-vs-cancelación
  sobre un pagador con tarjeta, donde el cobro lo hace el proveedor. En un pagador manual no hay
  cobro que llegue después de la baja.
- **L159 · §3, condición 2** — «el monto coincide con el esperado para el período que cubre» →
  sigue correcta **y es la que el arreglo cita dos veces**: `MP4` registra el importe del período
  impago, no un prorrateo, y por eso el que reabre dentro del período tiene días pagos por
  delante.

### `HOS-1354/docs/06-proveedor.md` (2)

- **L85 · §5** — «correr la fecha de cobro de una viva: `NOT_SUPPORTED`, cuatro formas, cuatro
  `200`, nada escrito (`EX-34`) — la pausa se toma en meses enteros y la aritmética se compensa
  sola» → **sigue correcta y es el límite que el arreglo respeta**: sobre un pagador con tarjeta la
  fecha no se corre porque no se puede; sobre uno manual no hay a quién pedírselo, y la corre
  nuestra propia transición. La capacidad de la tabla no cambia.
- **L87 · §5** — «agendar la baja a fin de período: `PARTIALLY_SUPPORTED` … cancelar ya y sostener
  el servicio de nuestro lado» → sigue correcta: otra capacidad, otro §.

### `HOS-1354/docs/09-conciliacion.md` (2)

- **L87 · §3** — «fecha del próximo cobro contra `next_payment_date`: se registra; no es por sí
  sola una divergencia, porque el proveedor la mueve solo en casos medidos (`PS-6`)» → **sigue
  correcta y sin tocar, y es la escritura del otro régimen**. El arreglo la cita como la prueba de
  que la columna ya tenía nombre y ya tenía quién la escribiera **del lado con proveedor**; del
  lado sin proveedor el barrido no tiene preapproval que leer, así que esta fila no gana población.
- **L456 · §6** — «un monto mal aplicado cuesta un ciclo, no un día» → sigue correcta: justifica la
  cadencia diaria del barrido, y el *«ciclo»* es el del plan, que el arreglo no cambia.

### `HOS-1354/docs/12-suscripcion.md` (8)

- **L74 · §1.4** — «sostenemos el servicio hasta el fin del período pagado. No gobierna el camino
  de mora» → sigue correcta, y la segunda mitad es la que evita el choque: el pagador manual que no
  paga está en el camino de mora, que es el del §7.
- **L130 · §2** — «Las dos cosas caen en el mismo instante —el fin del período pagado— y ahí no hay
  capacidades que bajar» → sigue correcta: `CANCEL_SCHEDULED` más un downgrade, sin pagador manual
  de por medio.
- **L534 · §5.4** — «Si la predecesora renueva dentro de esa ventana, el crédito quedó corto por un
  ciclo entero» → sigue correcta: es el crédito del cambio de plan, computado al crear la sucesora.
  El arreglo no toca el crédito ni la ventana.
- **L576 · §6.2** — «`DEC-SUB-010` ya lo había anticipado en su implicación 3: todo cambio pedido
  durante la pausa se aplica DESPUÉS de reanudar» → **sigue correcta y el arreglo es un caso
  suyo**: el avance de la fecha también se aplica al reanudar y no durante.
- **L585 · §6.3** — «al reanudar se le muestra una sola cosa, qué día se le va a cobrar» → sigue
  correcta, **y recién ahora ese día existe sobre un pagador manual**. Sigue siendo **una sola
  cosa**: el conteo no se mueve.
- **L606 · §7.1** — «`E-SUB-02` razonaba que el §26.4 corre el fin del período hacia adelante» →
  sigue correcta como descripción del razonamiento que ese § refuta.
- **L609 · §7.1** — «`DEC-SUB-010` decidió que los días no usados del ciclo en curso se pierden. No
  hay período extendido que esperar» → sigue correcta: el avance de `S10` **no extiende** ningún
  período, corre el inicio del siguiente. Es la misma aritmética que esta frase describe.
- **L610 · §7.1** — «lo que corre es la fecha del proveedor (`PS-6`: el ciclo que vence estando
  pausada avanza la fecha sin cobrar)» → **sigue correcta y es la cita que el arreglo espeja**. No
  se corrige porque no es falsa: es incompleta sólo en el sentido de que no nombra la población sin
  proveedor, y esa población la nombra `B/03` §7.2, que es su dueño.

### `HOS-1354/docs/16-addons.md` (1)

- **L636 · §4.4** — «`A4` tampoco, porque su población es vacía» → sigue correcta: es el gemelo de
  `B/03` L623, sobre la instancia de addon.

### `HOS-1354/docs/19-superficies.md` (1)

- **L121 · §5** — «el servicio sigue hasta el fin del período pagado (`DEC-SUB-009`), con esa fecha
  a la vista» → sigue correcta: es la pantalla de la baja, no la de la reapertura. La fila que sí
  le faltaba la fecha es la 10-bis, y se corrigió.

### `HOS-1354/docs/20-testing.md` (1)

- **L240 · §5** — «cancelación con servicio sostenido hasta el fin del período (`DEC-SUB-009`)» →
  sigue correcta: es un caso de la suite y el arreglo no le cambia el desenlace.

### `HOS-1354/docs/22-lo-legal.md` (1)

- **L46 · §2** — «`DEC-SUB-009` cancela en el proveedor de inmediato y sostiene el servicio hasta
  el fin del período pagado» → sigue correcta: es el desenlace de la baja *«sin teléfono, sin
  formulario de contacto y sin hablar con nadie»*, y el arreglo no toca `S11`/`S12`. Va en la misma
  dirección: el que reabre dentro del período conserva los días que compró.

### `HOS-1354/spec.md` (1)

- **L111 · §2** — «la pausa es la nativa del proveedor, en meses enteros, y los días no usados del
  ciclo en curso se pierden — con ciclos enteros el cliente vuelve el mismo día del mes, así que lo
  perdido se compensa con lo que gana al volver» → **sigue correcta, y su segunda mitad es la
  razón exacta de que `S10` NO lleve tope**: *«lo que gana al volver»* son los días que el tope le
  habría sacado al pagador manual. Esta línea es la que habría delatado el error si el commit
  `11aac0088` se hubiera declarado aplicado sin recorrer el corpus; la encontró este recorrido y la
  corrección está en `89a38386c`.

## 4. Preguntas para el owner

No las resuelvo: tocan el decision log, que esta fase tiene prohibido editar.

1. **`DEC-SUB-013` quedó más ancha que su capítulo, en dos viñetas.** El log dice *«el período se
   RE-ANCLA al instante de la reactivación. **No es una elección**»* y *«el reloj crearía **de
   golpe** todo el atraso»*. El capítulo ahora dice: avanza **un ciclo**, y sólo si ese avance cae
   en el pasado va al instante de la reactivación; y el *«de golpe»* es falso, porque `MP5` nombra
   **un** período por corrida. La **mitad (2)** de la decisión —*«el que vuelve paga el período que
   arranca, no los que pasó suspendido»*— se cumple entera con el tope; lo que cambia es el
   alcance del remedio, no la elección. ¿Se enmienda la viñeta de `DEC-SUB-013`, o queda el log
   como registro de lo que se eligió y el capítulo como el texto vigente?
2. **Misma decisión, la razón de `GRACE_PERIOD`.** `DEC-SUB-013` enumera por qué `MP5` no corre en
   los otros cinco estados y para `GRACE_PERIOD` dice *«porque el período no avanza hasta que entra
   el pago y la cuota ya existe»*. La primera mitad es falsa con la fecha que avanza sola —si el
   grace configurado es más largo que un ciclo, la fecha llega estando la fila en grace—; la
   segunda alcanza sola, y lo que impide abrir la cuota es el `desde` de `MP5`. El capítulo ya está
   corregido. ¿Se enmienda también la viñeta?
3. **Un guard que el programa no tiene y este crítico pide.** `F-8eB1-002` es de una clase que
   ningún guard vigila: **una condición de transición que lee una columna que ninguna transición
   escribe**. Es barato de enunciar —*«toda condición que nombre una columna tiene que poder nombrar
   las transiciones que la escriben»*— y caro de olvidar: acá costó un crítico que el grep
   encontraba y la lectura no. No lo agrego porque el catálogo de guards de `B/20` §2 no es de esta
   familia y numerarlo es una decisión. ¿Va?
