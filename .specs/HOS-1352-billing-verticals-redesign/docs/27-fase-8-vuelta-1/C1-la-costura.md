---
title: "FASE 8 vuelta 1 · C1 — la costura"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · C1 — la costura

Ataqué la frontera entre las dos épicas: la firma de `cobertura()` con sus siete campos
(`cobrada` y `piso` incluidos), el aviso de cambio (quién lo emite, cuándo, qué pasa si se
pierde o llega antes que el estado), las tres consultas de vuelta del §4.1, el caché con su lista
de invalidación y el reconciliador diario. Crucé el contrato contra los capítulos que lo
implementan o lo consumen (`V/02`, `V/03`, `V/10`, `V/11`, `V/15`, `B/02`, `B/03`, `B/10`,
`B/14`, `B/16`, `B/19`) y contra las unidades que dependen de la frontera (`V2`, `V4`, `B4`),
buscando hechos que un lado necesita y el otro no produce, y lecturas que cruzan sin estar
declaradas.

Son **15 hallazgos**: **0 CRITICA, 3 ALTA, 8 MEDIA y 4 BAJA**. La idea más grave: el contrato
es de una sola vía de hechos (billing empuja, billing consulta política), pero billing depende de
**hechos de verticales que ningún canal transporta** —el borrado de una ficha, que es lo único
que apaga un destaque recurrente— y verticales depende de un **veredicto de dirección** cuya regla
no sabe qué es «bajar» para las claves donde menos es mejor.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal de una sola línea
del archivo, con su `archivo:línea`. Las rutas usan tres prefijos: `D/` es
`.specs/HOS-1352-billing-verticals-redesign/docs/`, `V/` es
`.specs/HOS-1353-verticales-capacidades-y-autorizacion/` y `B/` es
`.specs/HOS-1354-billing-cobro-y-proveedor/`.

## ALTA

### F-8V1C1-001 — El borrado de la ficha no cruza a billing, y el destaque recurrente sigue cobrando

**Qué se rompe.** Desde `K-9`, la única transición que apaga un addon `LISTING` cuando su ficha
se borra es `A6`, y su evento es **un hecho de verticales**: la llegada a `PURGED` por `PB9` o
`PB12`. El contrato transporta hechos en una sola dirección (billing → verticales) y la dirección
inversa son tres consultas de política; **no hay ningún canal por el que verticales le diga a
billing que una ficha llegó a `PURGED`**. La orfandad de `LISTING` ya no mira el borrado, así que
si `A6` no se entera, nada más la apaga.

**El camino.**

1. Juan tiene Premium en Alojamiento y un destaque mensual (addon `LISTING`, recurrente) sobre su
   ficha «Cabañas del Río».
2. Juan borra esa ficha (`PB12`, `DRAFT`/`PUBLISHED` → `PURGED`). Sigue pagando Premium por sus
   otras fichas, así que la principal de la vertical sigue viva.
3. `A6` espera *«se borra la ficha destino»*, pero el borrado ocurre en verticales y el contrato no
   lo lleva a billing. La orfandad (`B/16` §4.2) tampoco dispara: la principal está viva.
4. El preapproval del complemento sigue cobrando todos los meses un destaque sobre una ficha que no
   existe. La conciliación (`B/09`) compara proveedor contra nuestras filas, que coinciden: no lo
   ve nadie.

**La evidencia.**

- `B/docs/03-maquinas-de-estado.md:2484`:
  «cualquier llegada a `PURGED`**: `PB9`, el día 180, o `PB12`, el dueño»
- `B/docs/16-addons.md:428`:
  «**El borrado de la ficha ya no está en esta fila**: lo ejecuta sólo `A6`»
- `D/12-contrato-de-cobertura.md:812`:
  «Es lo único que billing le **empuja** a verticales.»
- `D/12-contrato-de-cobertura.md:946`:
  «La inversa transporta política y estado de catálogo, nunca**»
- `D/12-contrato-de-cobertura.md:1018`:
  «si billing necesita leer de verticales algo que no está entre **los»

**Qué haría falta decidir o escribir.** Un canal declarado verticales → billing para la llegada a
`PURGED` (evento o consulta, con su red si se pierde), o una comprobación de `A6` en el barrido de
billing que consulte a verticales por el estado de la ficha objetivo. Es una ampliación del
contrato, que ninguna épica puede hacer sola (`DEC-ARCH-006`): decisión del owner.

### F-8V1C1-002 — `direcciónDeCambio` no sabe qué es «bajar» en una clave donde menos es mejor

**Qué se rompe.** El veredicto que decide **cuándo se cobra** un cambio de plan se define como
«si algo baja, un limit…». El capítulo 15 declara dos estrategias donde el valor favorable **no
es el más alto**: `MÍNIMO` (gana el número más bajo, ej. tiempo de respuesta) y
`MEJOR_DECLARADO` (un orden propio, ej. nivel de soporte). La regla del veredicto no dice si
«baja» es numérico o de favorabilidad, y `V2`, que lo construye, lo va a leer numérico. Una mejora
de un compromiso de respuesta (24 h → 4 h) sale `BAJA`.

**El camino.**

1. Juan está en Básico (soporte por correo, respuesta en 24 h) y elige Premium (soporte
   prioritario, respuesta en 4 h, más fotos).
2. `direcciónDeCambio` compara las dos versiones: el limit de respuesta bajó de 24 a 4. «Cualquier
   baja manda»: el veredicto es `BAJA`.
3. Billing sigue el camino de downgrade: **el monto se muta ya** al precio de Premium y **las
   capacidades cambian al fin del ciclo**.
4. Juan paga Premium durante hasta un mes con capacidades de Básico. Ningún detector lo ve: el
   veredicto es la única fuente de la dirección.

**La evidencia.**

- `D/12-contrato-de-cobertura.md:955`:
  «entitlement, una cuota, sigue el camino de downgrade; si nada baja, el de upgrade»
- `B/docs/10-verticales-planes-billing-options.md:104`:
  «el camino de downgrade (`DEC-SUB-008`): el monto se muta ya, las capacidades bajan al fin del»
- `V/docs/15-entitlements-y-limits.md:62`:
  «| | `MÍNIMO` | gana el número más bajo | un compromiso de tiempo de respuesta |»
- `V/docs/15-entitlements-y-limits.md:69`:
  «Las tres de «no acumula» son la misma regla dicha tres veces: gana la fuente más favorable.»

La severidad depende de que el catálogo de `V1` tenga alguna clave `MÍNIMO` o `MEJOR_DECLARADO`
que difiera entre planes; el capítulo 15 las da como ejemplos de su propio catálogo.

**Qué haría falta decidir o escribir.** Que el criterio de `direcciónDeCambio` compare **por
favorabilidad según la estrategia de la clave** (la misma que usa el pliegue), no por el número; y
qué pasa con una clave presente en una sola de las dos versiones. Agregarlo al criterio de
terminación de `V2`, que hoy sólo prueba «`rank` mayor con un limit menor».

### F-8V1C1-003 — El orden entre el aviso, la invalidación y el commit no está escrito

**Qué se rompe.** El caché se invalida borrando, «la próxima lectura lo recalcula sola», y el
vencimiento por tiempo es sólo una red. Ningún documento dice si el borrado de la entrada y el
envío del aviso ocurren **después** de confirmar la transacción que cambió la cobertura. La
lectura natural —invalidar dentro de la operación que causó el cambio— abre la carrera clásica:
una lectura concurrente entre el borrado y el commit recalcula con el estado viejo y **vuelve a
cachear lo revocado**, sin ningún evento posterior que lo borre. Lo mismo con el aviso: si llega
antes del commit, el consumidor vuelve a preguntar, ve el estado viejo y no hace nada.

**El camino.**

1. Juan tiene *Free Forever* en Alojamiento y lo está usando en el panel.
2. Un admin revoca el grant. La operación borra las entradas de Juan en el caché y emite el aviso
   dentro de su transacción.
3. Antes del commit, una request del panel de Juan relee: la entrada no está, recalcula, el grant
   todavía figura vivo y lo cachea.
4. Commit. Nadie vuelve a invalidar. Juan conserva las capacidades del grant hasta la red de
   tiempo, que no tiene valor escrito. Si no tiene fichas publicadas, el reconciliador diario no
   encuentra diferencia y tampoco invalida.

**La evidencia.**

- `V/docs/02-modelo-de-datos.md:474`:
  «un entitlement que sigue vivo después de revocado es acceso indebido.»
- `V/docs/02-modelo-de-datos.md:484`:
  «**La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.**»
- `V/docs/02-modelo-de-datos.md:523`:
  «**Invalidar es borrar, no recalcular.** Recalcular dentro de la transacción que causó el»
- `D/12-contrato-de-cobertura.md:833`:
  «El aviso no tiene transporte durable —el outbox del núcleo es de correos—,»

**Qué haría falta decidir o escribir.** Que la invalidación y el aviso salen **después del
commit** (o que la entrada se versiona y una lectura no puede escribir sobre una invalidación
posterior), y el valor de la red de tiempo, que hoy es una red sin número.

## MEDIA

### F-8V1C1-004 — La «versión vigente» del grant no tiene quién la resuelva sin cruzar la frontera

**Qué se rompe.** La firma dice que `referencia` es una `versiónDePlan`. El ancla del grant
guarda un `plan_id`, no una versión, y `B/02` dice que **el grant** (billing) resuelve la vigente;
el contrato dice que la resuelve **el paso 6** (verticales) «de `referencia`». Si la resuelve
billing, tiene que leer `plan_version.vigente` por plan, y ninguna de las tres consultas del §4.1
contesta eso (`políticaDePlan` recibe una versión ya conocida). Si la resuelve verticales, billing
tiene que mandar alguna versión que no guarda, y la tentación obvia es el `piso`: un grant
resuelto literalmente contra su piso **queda congelado** y no sigue ninguna mejora. Además, la
fila de invalidación «versión nueva de un plan con grants anclados» exige saber **quiénes** están
anclados, que es un dato de billing sin consulta.

**El camino.**

1. A Juan le firman *Free Forever* anclado a Premium de Alojamiento; el piso es la v3.
2. Se publica la v4 de Premium, con más fotos.
3. Implementación A: billing lee `plan_version` para mandar la v4 (lectura no declarada, la regla
   de vigilancia se dispara). Implementación B: billing manda la v3 y verticales la usa tal cual:
   Juan no recibe las fotos que el «sigue las mejoras» le promete.
4. En los dos casos, verticales no sabe que tiene que invalidar la entrada de Juan al publicar la
   v4, porque la lista de beneficiarios anclados está en billing.

**La evidencia.**

- `B/docs/02-modelo-de-datos.md:735`:
  «y NO a una versión. El grant resuelve la versión vigente de»
- `D/12-contrato-de-cobertura.md:127`:
  «resuelve la versión vigente de `referencia` y nunca otorga menos que la de `piso`»
- `D/12-contrato-de-cobertura.md:984`:
  «Son siete campos en tres preguntas, y los dos últimos son los que importa declarar.»
- `V/docs/02-modelo-de-datos.md:501`:
  «un grant lee **la versión vigente** (`12-contrato…` §2.8), así que una versión nueva lo cambia»

**Qué haría falta decidir o escribir.** Quién resuelve la vigente (y, si es billing, una consulta
declarada `versiónVigente(plan)`; si es verticales, que `referencia` del `GRANT` sea un plan y no
una versión), y cómo sabe verticales a quién invalidar cuando publica una versión de un plan con
grants o suscripciones ancladas.

### F-8V1C1-005 — `B4` entrega `cobrada` y su aviso, pero corre antes de que exista el pago

**Qué se rompe.** `B4` promete la firma entera, con `cobrada`, y en el grafo arranca «una vez que
estén B3 y `V4`», en paralelo con `B5`. Pero `cobrada` se define sobre pagos acreditados —un
cobro leído por id (`B/09`, que es `B11`) o una cuota manual (`MP1`, que es `B5`)— y el aviso del
primer pago lo emite `P1`, que está en el §6 del `B/03`, capítulo de `B5`. La unidad puede
cerrarse sin su insumo, y su criterio de terminación no tiene ningún caso de `cobrada`.

**El camino.**

1. El equipo de `B4` termina antes que `B5`: no hay tabla de pagos, así que `cobrada` sale fijo.
2. Si sale `sí` al llegar a `ACTIVE`, Juan en `TRIAL_ACTIVE` se suscribe, `T2` convierte al
   autorizar, su primer cobro se rechaza (`S16`) y queda sin suscripción y sin trial: el defecto
   que `DEC-TRIAL-010` cerró.
3. El juego único de casos no lo detecta: el criterio de `B4` pide el caso de `piso` y no el de
   `cobrada`.

**La evidencia.**

- `B/descomposicion.md:130`:
  «el aviso de que cambió sale — **con los siete campos de la fuente**»
- `B/descomposicion.md:579`:
  «**B4** una vez que estén B3 y `V4`»
- `B/docs/03-maquinas-de-estado.md:1721`:
  «**Y si es el primer pago acreditado de una suscripción, emite el aviso de cobertura**»
- `D/12-contrato-de-cobertura.md:126`:
  «un cobro del proveedor aprobado, leído por id (`B/09` §4), o una cuota de pagador manual»

**Qué haría falta decidir o escribir.** La dependencia `B4 → B5` en el grafo (o partir `B4`: la
fuente sin `cobrada` primero, `cobrada` con `B5`), y un caso de `cobrada: no` sobre una `ACTIVE`
en el criterio de `B4`.

### F-8V1C1-006 — Nadie declara QUÉ actos emiten el aviso

**Qué se rompe.** El contrato define el aviso como «la cobertura cambió» y dice que la
implementación real se enchufa «como emisor». Las tablas de billing declaran la emisión sólo en
`P1` (y la mencionan en `S2`); ninguna fila de suscripción, cortesía, grant (revocación, anclaje)
ni addon (`A2`, `A4`, `A5`, `A6`) la lista entre sus efectos. Del otro lado, la implementación de
arranque «resuelve» el trial pero no dice que emita el aviso en `T1`/`T3`, y `PB2` confía en que
«el contrato ya emite el hecho». El censo de emisores no existe en ninguno de los dos lados.

**El camino.**

1. Un admin revoca el grant de Juan (acto sin transición de suscripción). El implementador de
   `B9` sigue la tabla de efectos y no emite nada.
2. Juan conserva el caché del grant (Turista VIP, claves globales) hasta la red de tiempo; si
   tiene fichas publicadas, el reconciliador diario las baja al día siguiente.
3. Con la implementación de arranque, el trial de Juan vence (`T3`) y nadie emite: su ficha sigue
   publicada hasta la corrida diaria, y el criterio de `V6` («un trial que vence baja la ficha»)
   pasa sólo con un día de atraso.

**La evidencia.**

- `D/12-contrato-de-cobertura.md:1090`:
  «se enchufa como fuente y como emisor del aviso.»
- `D/12-contrato-de-cobertura.md:1053`:
  «**No devuelve datos fijos.** Resuelve honestamente las **dos** fuentes que ya viven del lado de»
- `V/docs/03-maquinas-de-estado.md:541`:
  «**El contrato ya emite el hecho** —*«la cobertura de (user, vertical) cambió»* (`12-contrato…`»
- `B/docs/03-maquinas-de-estado.md:1721`:
  «**Y si es el primer pago acreditado de una suscripción, emite el aviso de cobertura**»

**Qué haría falta decidir o escribir.** Un censo de emisores del aviso (qué transiciones y qué
actos lo emiten, en los dos lados), con la misma forma que el censo de consumidores del §2.1, y
que la implementación de arranque emita en las transiciones de trial.

### F-8V1C1-007 — Si la sucesora entra en grace, la predecesora marcada vuelve a emitir

**Qué se rompe.** En la rama de la cancelación fallida, la predecesora no emite porque tiene
«una sucesora en `ACTIVE` apuntándola». Desde 3c, la sucesora de quien venía pagando **entra en
`GRACE_PERIOD`** si su primer cobro se rechaza. En ese instante la condición deja de cumplirse
—la sucesora ya no está en `ACTIVE`— y la predecesora, todavía viva por la cancelación que falló,
vuelve a emitir. Hay dos `SUSCRIPCIÓN` de clase `TÍTULO` para el mismo `user + vertical`, que el
contrato declara imposibles, y el pliegue las suma.

**El camino.**

1. Juan pasa de Básico (5 fichas) a Premium (20). La sucesora autoriza; la cancelación del
   preapproval de Básico falla y queda la marca.
2. El crédito difiere el primer cobro de Premium; cuando llega, se rechaza: la sucesora entra en
   `GRACE_PERIOD` (3c).
3. Básico tiene ahora una sucesora que no está en `ACTIVE`: vuelve a emitir. `SUMA` da 25 fichas
   mientras no paga ninguna de las dos, hasta que alguien resuelva la marca.

**La evidencia.**

- `D/12-contrato-de-cobertura.md:479`:
  «**una fila con una sucesora en `ACTIVE` apuntándola (`sucede_a`) no emite»
- `D/12-contrato-de-cobertura.md:487`:
  «en esta rama sólo emite la sucesora, así que `fuentes` nunca devuelve dos `SUSCRIPCIÓN` de clase»
- `D/12-contrato-de-cobertura.md:157`:
  «sucesora cuya predecesora venía pagando**, que desde la FASE 9 completa entra al grace cuando su»

**Qué haría falta decidir o escribir.** Que la condición sea «una sucesora viva apuntándola»
(que emita, en `ACTIVE` o `GRACE_PERIOD`), o qué emite la predecesora cuando la sucesora deja
`ACTIVE` sin morir.

### F-8V1C1-008 — Billing lee de verticales cosas que no están entre los siete campos

**Qué se rompe.** La regla de vigilancia dice que toda lectura de billing fuera de los siete
campos es un acoplamiento que nadie mira. Hay tres, escritas en capítulos de billing:

- `A1` llama a `cobertura()` **para averiguar si el único título de la vertical es un trial**, que
  es un hecho de verticales, y necesita la vertical de la ficha objetivo, que es una columna de
  `listing`.
- La pricing (`B13`) enumera **la versión vigente y vendible de cada plan** de una vertical, y
  ninguna consulta enumera: `políticaDePlan` contesta sobre una versión que ya se conoce.
- Mi Suscripción lee **el conjunto efectivo de entitlements y limits**, que son valores de
  capacidades, lo que el §4.1 dice que la inversa nunca transporta.

**El camino.** Juan quiere comprar un destaque para una ficha de Gastronomía. `A1` necesita saber
de qué vertical es la ficha y si en esa vertical Juan sólo tiene un trial; el implementador lee
`listing` y la tabla `trial` directamente, porque no hay otra vía. La próxima vez que verticales
cambie una de esas columnas, `A1` se rompe sin que ningún guard lo marque (el §4.2 admite que la
regla no tiene guard).

**La evidencia.**

- `B/docs/03-maquinas-de-estado.md:2479`:
  «en `cobertura(user, vertical del objetivo)`, ninguna fuente de clase `TÍTULO` que no sea de»
- `B/docs/19-superficies.md:44`:
  «la **versión vigente** de cada plan, y sólo si es vendible (`V/10` §2)»
- `B/docs/19-superficies.md:45`:
  «su estado, y el conjunto efectivo de entitlements y limits»
- `D/12-contrato-de-cobertura.md:946`:
  «La inversa transporta política y estado de catálogo, nunca**»

**Qué haría falta decidir o escribir.** O se declaran como consultas del §4.1 (con su
constructor en `V2`/`V3`), o se decide que las superficies son una capa de composición fuera de
las dos épicas y se dice dónde vive. Para `A1`, qué pregunta declarada contesta «¿esta ficha es
elegible como objetivo?».

### F-8V1C1-009 — La extensión de trial por promo o cortesía no tiene canal

**Qué se rompe.** `T4` extiende el trial por «promo de extensión o cortesía». El promo y la
cortesía son de billing (`B/14`, `B9`); la fila de `trial`, su fecha y el techo único de
extensiones son de verticales (`V/11` §3). Para canjear, billing tiene que leer si el trial está
en `TRIAL_ACTIVE` «en el instante de escribir», escribir la extensión y saber si el techo la
rechaza para no consumir el código. Nada de eso está en el contrato, en ninguna de las dos
direcciones: el aviso es informativo y el §4.1 son tres consultas de catálogo.

**El camino.** Juan canjea un código de «+7 días de trial». Billing escribe directo sobre `trial`
(acoplamiento no declarado) o verticales expone una operación que ninguna unidad construye; si
cada lado cuenta el techo por su cuenta, el promo pasa el techo de billing y rompe el de
verticales, o se consume un código que verticales rechazó.

**La evidencia.**

- `V/docs/03-maquinas-de-estado.md:54`:
  «| T4 | `TRIAL_ACTIVE` | promo de extensión o cortesía | `TRIAL_ACTIVE` |»
- `B/docs/14-promos-cortesias-y-grants.md:340`:
  «**El canje vale si y sólo si la fila del trial sigue en `TRIAL_ACTIVE` en el instante de»
- `V/docs/11-trial.md:153`:
  «Toda extensión cuenta contra ese mismo techo, venga de un promo del §32 o de»

**Qué haría falta decidir o escribir.** Una operación declarada en la frontera (billing le pide a
verticales «extendé N días», verticales contesta sí/no con el techo), su unidad constructora en
cada épica y su concurrencia con `T3`.

### F-8V1C1-010 — El aviso perdido del primer pago deja sin consumir la fila de `trial` (`T8`)

**Qué se rompe.** El ⚠️ del reconciliador declara qué pasa si se pierde el aviso que movería
`T2`/`T5`, pero no el que movería `T8`. `T8` es la única forma de consumir la fila de quien pagó
antes de publicar y ya ejerció el evento; si su aviso se pierde, la fila no se escribe nunca
—la red diaria no corre la máquina de trial— y la persona queda en `PRE_TRIAL` para siempre.

**El camino.**

1. Juan se suscribe a Alojamiento por el checkout, publica (`PB1`, cubierto) y en la ventana del
   primer cobro no dispara `T6`.
2. Llega el primer pago; su aviso se pierde. `T8` no corre.
3. Un año después Juan cancela. Publica una ficha nueva sin cobertura: `PB1` dispara `T1` y Juan
   recibe un trial entero, siendo alguien que ya fue cliente.

**La evidencia.**

- `V/docs/03-maquinas-de-estado.md:192`:
  «**Si se pierde el aviso del primer pago** (`12-contrato…` §3), `T2` no dispara, el trial sigue»
- `V/docs/03-maquinas-de-estado.md:226`:
  «en vez de al checkout (`V/19` §4, fila 23; `B/19`). **`T8` queda como red**»
- `V/docs/03-maquinas-de-estado.md:276`:
  «*«un trial gratis para quien ya fue cliente»*»

**Qué haría falta decidir o escribir.** Declararlo en el ⚠️ con su causa, o darle a la máquina de
trial una relectura (las guardas de `T8` son un estado evaluable, no un borde) en la corrida
diaria.

### F-8V1C1-011 — El dueño de `G13` está escrito distinto en el contrato y en las dos descomposiciones

**Qué se rompe.** El contrato, que ninguna épica puede mutar sola, dice que el guard que impide
llevar a producción la implementación de arranque es de `V4`, y justamente **no** de `B4`. Las dos
descomposiciones dicen que nace en `B4`, con un argumento («falla desde el primer día») que el
propio contrato refuta: el guard falla sobre un build destinado a producción, no sobre la rama.

**El camino.** El equipo de `V4` lee su descomposición y no lo construye; si `B4` se atrasa
respecto de la integración, la épica de verticales corre meses con la de arranque como única
implementación y sin la única de las tres defensas que dice «no se puede».

**La evidencia.**

- `D/12-contrato-de-cobertura.md:1139`:
  «**Su dueño es `V4`, la unidad de la épica de verticales**, y no `B4`.»
- `V/descomposicion.md:94`:
  «Nace en **B4** de la otra épica, que es donde aparece la segunda implementación.»
- `B/descomposicion.md:299`:
  «**Y acá nace `G13`**, no antes»
- `D/12-contrato-de-cobertura.md:1144`:
  «**Falla sobre un build destinado a producción, no sobre la rama**»

**Qué haría falta decidir o escribir.** Una sola asignación, en el contrato y en las dos
descomposiciones.

## BAJA

### F-8V1C1-012 — El censo de consumidores de `cubierto` no incluye a `PB1`

**Qué se rompe.** Desde el owner 2026-09-25, `PB1` publica «sólo si el dueño está cubierto»: es
un consumidor de `cubierto`, y la fila del §2.1 que se declara el censo no lo nombra. La regla
de vigilancia pregunta «¿está en esta fila?», así que hoy marcaría a `PB1` como filtración.

**El camino.** Un revisor aplica la regla de vigilancia sobre `V/03` §9, encuentra `PB1` leyendo
`cubierto`, no lo ve en la fila y lo trata como acoplamiento indebido.

**La evidencia.**

- `V/docs/03-maquinas-de-estado.md:506`:
  «**sólo si el dueño está cubierto** —`cubierto` verdadero en esa vertical—»
- `D/12-contrato-de-cobertura.md:134`:
  «agregue un consumidor **agrega su sintagma a esta fila en el mismo acto**»

**Qué haría falta decidir o escribir.** Agregar `PB1` a la fila.

### F-8V1C1-013 — `PB9` y `PB12` todavía mandan el borrado a `A5`

**Qué se rompe.** Las filas de verticales dicen que el addon `LISTING` de una ficha borrada
«queda huérfano (`A5`)»; desde `K-9` la orfandad no mira el borrado y la única puerta es `A6`.
Sin consecuencia de plata (las dos escriben el motivo 14), pero es la cita que un implementador
de la costura va a seguir.

**El camino.** Quien implementa `PB12` busca en `B/16` §4.2 la condición de orfandad por borrado,
no la encuentra y no sabe a qué transición avisar.

**La evidencia.**

- `V/docs/03-maquinas-de-estado.md:514`:
  «el addon `LISTING` que apuntaba a ella **queda huérfano** (`A5`)»
- `B/docs/16-addons.md:456`:
  «**de desenlace: el borrado de la ficha es ahora su ÚNICA puerta**»

**Qué haría falta decidir o escribir.** Corregir las dos filas a `A6`.

### F-8V1C1-014 — La descomposición de billing sigue contando tres fuentes, sin el addon

**Qué se rompe.** El contrato tachó «tres» por «cuatro» fuentes de billing al sumar el addon; el
§2.5 de la descomposición de billing sigue diciendo que después de la suscripción se enchufan
«las otras dos», y ninguna fila dice explícitamente qué unidad enchufa la fuente `ADDON` con su
`alcance: LISTING`, `objetivo` y `hasta` (`B10` sólo nombra la emisión de `USER`/`GLOBAL`).

**El camino.** Quien planifica `B9` y `B10` contra ese § no reserva la emisión de la fuente
`ADDON`; el pliegue por ficha del contrato §2.7 queda sin la única fuente que lo alimenta.

**La evidencia.**

- `B/descomposicion.md:296`:
  «**una suscripción viva ya es una fuente**. Las otras dos —cortesía y grant— se»
- `D/12-contrato-de-cobertura.md:1092`:
  «**Son cuatro y no tres desde que el addon es una fuente del contrato**»

**Qué haría falta decidir o escribir.** Nombrar la unidad que emite la fuente `ADDON` entera.

### F-8V1C1-015 — `díasDeTrial` está en la dirección inversa y billing no lo lee

**Qué se rompe.** El §4.1 declara `díasDeTrial` como campo que billing lee; la descomposición de
billing recorrió los siete campos y dice que ese lo consume la máquina de trial, del lado de
verticales. Es un campo del contrato sin lector del lado que lo declara leer.

**El camino.** Un implementador de `V2` construye y expone `díasDeTrial` en `políticaDePlan`
para un consumidor que no existe, y el conteo de «siete campos» que la regla de vigilancia cita
incluye uno muerto.

**La evidencia.**

- `B/descomposicion.md:339`:
  «ningún capítulo de esta épica los lee**: `díasDeTrial` lo consume la máquina de trial»

**Qué haría falta decidir o escribir.** Sacarlo de la firma o nombrar su lector de billing.

## Ataques que intenté y el diseño resistió

- **Duplicación y desorden del aviso.** Todo consumidor vuelve a preguntar y no decide con lo que
  trae el mensaje (§3), así que un aviso repetido o fuera de orden no hace daño por sí mismo.
- **Dos definiciones de «cobrada».** Billing usa «cobrada» con la sucesora de quien venía pagando
  (`A1`, orfandad) y el contrato no. Las recorrí contra la máquina de trial: quien tiene una
  predecesora que pagó ya convirtió su trial, así que la diferencia no mueve `T2`/`T8`.
- **Addon en una suscripción suspendida.** El descarte del pliegue sin título (`V/15` §2.6) y la
  orfandad de `USER`/`GLOBAL` sobre principales cobradas cierran las dos mitades.
- **Vertical discontinuada.** La regla de no emisión, la lectura de `finDeServicio` por
  `situaciónDeVertical` y la fila de invalidación del barrido son coherentes entre contrato,
  `V/02`, `B4` y `B12`.
- **`PRE_TRIAL` como cobertura perpetua.** La clase derivada del `hasta` (`SIN_EMPEZAR` → `BASE`)
  y el caso distintivo del §5.1 lo cierran en las dos implementaciones.

## Fuera de mi vector

- Una ficha en `MODERATED` con un destaque recurrente sigue cobrando: la orfandad no mira la
  moderación. Es política de producto (le toca al vector de addons/moderación).
- En la rama de la cancelación fallida, el preapproval vivo de la predecesora puede seguir
  cobrando mientras la sucesora cobra (doble cobro); es de conciliación y sucesión, no de la
  cobertura.
- El corte trata a los clientes actuales como nuevos (sin filas de `trial`), así que todos
  recibirán un trial al dejar de pagar; está decidido por el owner, lo anoto por si el vector de
  migración quiere medir su costo.

## Key Learnings

1. El contrato es simétrico en su enunciado (dos direcciones) pero asimétrico en su contenido: la
   ida lleva hechos, la vuelta sólo política; los hechos de verticales que billing necesita
   (borrado de ficha, estado del trial, extensión) no tienen canal.
2. Un veredicto «sube/baja» sobre claves con estrategias distintas necesita la misma noción de
   favorabilidad que el pliegue; sin ella la regla que decide cuándo se cobra depende del signo de
   un número.
3. Un censo de consumidores sin un censo de emisores deja al aviso sin obligación verificable: las
   tablas de transiciones son el lugar natural para declararlo y hoy no lo hacen.
4. Las condiciones de emisión escritas sobre un estado exacto («sucesora en `ACTIVE`») se rompen
   cada vez que una decisión posterior abre un estado vecino (3c): conviene escribirlas sobre
   «viva» o «emite».
5. La invalidación «por evento» es tan buena como su orden respecto del commit, y el diseño no lo
   fija.
