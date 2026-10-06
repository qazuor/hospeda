---
title: "FASE 8-bis-2 · A2 — máquinas de estado, carreras y huérfanos"
linear: HOS-1352
statusSource: linear
created: 2026-09-20
updated: 2026-09-20
status: CURRENT
fase: 8
---

# FASE 8-bis-2 · A2 — máquinas de estado, carreras y huérfanos

Tercera pasada adversarial A2, corrida sobre el diseño que la **9-bis** produjo. Vector:
transiciones que faltan, transiciones que nadie dispara, transiciones que se pisan entre sí,
estados sin salida, relojes sin dueño, efectos huérfanos y carreras.

**Quince hallazgos: 3 `CRITICA`, 6 `ALTA`, 5 `MEDIA`, 1 `BAJA`.**
**Atribución: 14 de 15 los introdujo —o los volvió alcanzables— un arreglo de la 9-bis. De los 3
`CRITICA`, 3 de 3.**

**El resultado en una línea.** `DEC-METH-008` funcionó donde se aplicó y no se aplicó en todas
partes: los tres arreglos que **sí** recorrieron el dominio que creaban —la tabla de 6 × 4 del
§2.4, los nueve estados del §2.6, los dos valores de `sucede_a` del `B/03` §3.2— dejaron **su
propio dominio** en orden, y los tres se rompen **contra el dominio del arreglo de al lado**. El
caso testigo es el mejor que dio esta pasada: `PB2` pasó a dispararse por el **cambio** de
`cubierto` (arreglo 9) para no depender de una lista congelada, y con eso **la mañana del corte no
hay cambio que disparar** — el arreglo 22 apoya toda la migración de verticales en un `PB2` que,
por el arreglo 9, no ocurre.

Los paths se abrevian como en los documentos anteriores: `NUCLEO` es `HOS-1352-…/docs/nucleo/`,
`V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y dónde.** Los conteos de este informe salen de contar las filas de los
capítulos con `sed`/`grep` sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-20: 24 celdas en
la tabla de clases del `12-contrato…` §2.4, 10 filas en la de invalidación de `V/02` §3.2 (3 en
negrita), 10 filas / 9 estados en la de emisión del `12-contrato…` §2.6, 8 filas y 40 pares
posibles en la del espejo de `B/03` §10.1, 10 guards en `V/20` §2. **No medí nada contra el
proveedor**: donde hablo de Mercado Pago cito la medición que el capítulo ya trae, con su
identificador.

---

## 1. Los hallazgos

### CRITICA

### F-8cA2-001 — `PB2` se dispara por el CAMBIO de `cubierto`, y la mañana del corte no hay cambio: las fichas de toda la producción quedan publicadas sin ninguna relación comercial, y nada las baja nunca

**Qué se rompe.** El 100 % de las fichas publicadas de Alojamiento amanece el día del corte
**publicada y sin cobertura**, y se queda así indefinidamente. El capítulo de migración de
verticales está escrito entero sobre lo contrario —*«se despublican la mañana del corte»*— y lo
declara *«una consecuencia, no una ambigüedad»*, así que nadie va a construir el mecanismo que
falta. Servicio comercial gratis, sobre toda la cartera, sin ningún proceso que lo encuentre.

**El camino.**

1. `V/21` §2.4 fija el punto de partida: *«Sin fila de `trial`, el estado es `PRE_TRIAL` por
   construcción … así que **el 100 % de los usuarios de producción amanece ahí**»*, y sus fichas
   **siguen publicadas**, porque ninguna fila de `listing` se toca.
2. El mismo § deriva el desenlace: *«`PRE_TRIAL` **no cubre** … y `PB2` se dispara **por el cambio
   de `cubierto`** (`V/03` §9), así que **las fichas publicadas de Alojamiento se despublican la
   mañana del corte**. No es una ambigüedad entre dos ramas: es una consecuencia.»*
3. **Y ése es el paso que no se sostiene.** `V/03` §9 dice, textual: `| PB2 | PUBLISHED | **`cubierto`
   pasa a falso** | UNPUBLISHED_BY_BILLING |`, y su justificación remacha que el disparador es el
   hecho de cambiar: *«`PB2` y `PB3` se disparan por el CAMBIO de `cubierto`, no por una lista de
   transiciones»*. **Un cambio necesita un valor anterior.** El sistema nuevo nunca calculó
   `cubierto` para esa gente: el día del corte lo calcula por primera vez y le da falso. No pasa de
   verdadero a falso. **Nace en falso.**
4. Tampoco llega el aviso que lo produciría. El `12-contrato…` §3 declara que lo único que billing
   empuja es *«la cobertura de (user, vertical) cambió»*, y en el corte **billing no transiciona
   nada**: `16-fase-7-del-paraguas.md` §4.2 pone la cancelación de los tres preapprovals en el
   **paso 1**, ejecutada por *«el sistema **viejo**, que todavía corre»*, y el despliegue en el
   paso 3. El sistema viejo no tiene contrato de cobertura y no emite ese evento; el nuevo, cuando
   arranca, no tiene nada de qué enterarse.
5. Tampoco lo levanta un recálculo. `V/15` §4.2 dice que el reconciliador *«se dispara cuando el
   conjunto efectivo de un `user + vertical` se recalcula»* y que la lista de disparadores *«es la
   misma lista que invalida el caché»* — las diez entradas de `V/02` §3.2, que conté una por una:
   **ninguna es «el sistema arrancó», «se desplegó una versión» ni «alguien tenía cobertura en otro
   sistema y ya no»**. Un usuario que no toca nada no recalcula nada.
6. Tampoco lo levanta un barrido: `F-8A2-005` sigue llegando y esta pasada lo confirma — no existe
   ningún proceso periódico que compare publicación contra cobertura del lado de verticales.
7. El paso 4 del corte (`16-fase-7` §4.2) es *«sembrar las lápidas»*, y el quinto acto son **las
   llamadas**. Ninguno de los dos baja una ficha, y el § lo dice él mismo: las fichas *«vuelven
   solas cuando cada dueño contrata»* — describiendo la vuelta de un viaje de ida que no ocurrió.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9, fila de `PB2` y el párrafo *«`PB2` y `PB3` se disparan por el
  CAMBIO de `cubierto`, no por una lista de transiciones»*.
- `V/21-migracion.md` §2.4 completo, y en especial *«No es una ambigüedad entre dos ramas: es una
  consecuencia»* y *«se despublican. No se siembra nada»*.
- `16-fase-7-del-paraguas.md` §4.2, los cuatro pasos y el quinto acto; *«Las fichas publicadas de
  Alojamiento **se despublican la mañana del corte** —es una consecuencia, no una falla
  (`V/21` §2.4)—»*.
- `12-contrato-de-cobertura.md` §3: *«Es lo único que billing le **empuja** a verticales.»*
- `V/02-modelo-de-datos.md` §3.2, las diez entradas.
- `V/15-entitlements-y-limits.md` §4.2: *«no se dispara por evento: se dispara por condición»*.

**Severidad.** `CRITICA`. Es la ficha pública de toda la cartera de Alojamiento sostenida sin
ninguna relación comercial viva, sin fecha de fin y sin proceso que la encuentre — y con dos
capítulos afirmando por escrito que eso no pasa, que es lo que garantiza que nadie lo busque.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y son dos arreglos de dos tandas
distintas.** El arreglo **9** cambió el disparador de `PB2` de una lista de transiciones al
**cambio** de `cubierto`; el arreglo **22** decidió que la población existente *«se despublica y se
la llama»* apoyándose en ese disparador, y el **23** escribió el orden del corte sin un paso que lo
produzca. Con el disparador viejo —*«cancelación consumada (S12)»* y compañía— tampoco disparaba,
pero por otra razón y sin que ningún capítulo afirmara que sí. **Es exactamente la forma de
`F-8bA2-001` del ciclo anterior —cobertura perpetua sobre toda la plataforma— reconstruida por el
otro extremo: aquella venía de que `PRE_TRIAL` cubría, ésta viene de que dejó de cubrir y nadie
observó el instante en que dejó.**

---

### F-8cA2-002 — `T6` dispara sobre cuatro estados que están «vivos» y no cubren: el cliente pierde su trial de por vida en el acto de publicar, y no recibe nada a cambio

**Qué se rompe.** Alguien suspendido por impago, o con un checkout abierto sin autorizar, publica
su primera ficha en esa vertical. `T6` decide que *«ya hay una suscripción viva»* y le escribe la
fila de trial **ya consumida**. El trial es único de por vida, `V/03` §10.2 no lo devuelve, y la
fila *«sobrevive al borrado de la cuenta»* con el hash de su correo. **Perdió su prueba sin haberla
tenido un solo día, y no hay ninguna transición que se la devuelva.** La suscripción que `T6`
invocó como su título **no emite ninguna fuente de cobertura**.

**El camino.**

1. `V/03` §2 declara `T6`: `| T6 | PRE_TRIAL | el evento de activación declarado por la vertical |
   TRIAL_CONVERTED | **ya hay una suscripción viva** para ese`user + vertical` | **crea la fila de
   `trial`, consumida**, sin reloj y sin campaña |`.
2. Su justificación es una premisa sobre lo que significa «viva»: *«el título es la suscripción, que
   es exactamente lo que `TRIAL_CONVERTED` significa»*, y *«Lo que no pierde es nada: **no necesita
   probar lo que ya está pagando**»*.
3. **La palabra «viva» tiene un único conjunto enumerado en todo el programa**, y es el del candado:
   `B/02` §2.2, *«Los «vivos» siguen siendo los mismos seis: `PENDING_AUTHORIZATION`, `ACTIVE`,
   `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`»*.
4. **Y el arreglo 16 volvió falsa la premisa de `T6` sobre cuatro de esos seis.** El
   `12-contrato…` §2.6 enumera qué emite cada estado, y de los seis vivos **cuatro no emiten
   nada**: `PENDING_AUTHORIZATION` (*«Una suscripción esperando autorización NO emite fuente de
   cobertura»*), `SUSPENDED` (*«el §21 lo deja sin entitlements comerciales»*), `PAUSED` por
   `CUSTOMER_REQUEST` (*«el servicio está detenido»*) y —fuera del candado pero igual de
   relevante— `CHARGE_DECLINED`.
5. El caso limpio y sin ambigüedad es `SUSPENDED`. Una persona dejó de pagar en Gastronomía; su
   fila está `SUSPENDED`, que es de los seis vivos. Nunca publicó ahí, así que en la máquina de
   trial está en `PRE_TRIAL`. Publica. `T6` dispara. La fila de trial nace **consumida**.
6. Lo que recibe es nada: `TRIAL_CONVERTED` **no es fuente viva** (`V/03` §2, tabla: `|
   TRIAL_CONVERTED | no | — (el título pasó a ser la suscripción) | — |`) y su suscripción
   `SUSPENDED` tampoco emite. Su única fuente es el piso `BASE`, que no cubre.
7. `T6` es la **única** salida de `PRE_TRIAL` además de `T1`, y `TRIAL_CONVERTED` no tiene ninguna
   salida en la tabla. `V/03` §2 lo cierra: *«No existe transición de vuelta a `PRE_TRIAL` ni a
   `TRIAL_ACTIVE`»*, y `V/11` §7 cierra la extensión (`T4` exige `TRIAL_ACTIVE`). **No hay camino
   de vuelta en ningún nivel.**
8. El caso `PENDING_AUTHORIZATION` es el mismo con una vuelta más: la persona abre el checkout, no
   lo autoriza, publica, `T6` le quema el trial, y a las 72 h `S3` la manda a `ABANDONED` — un
   estado que no está ni entre los vivos. Queda sin suscripción y sin trial, habiendo hecho un solo
   clic de más.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2, fila `T6` y sus dos párrafos de justificación; tabla de
  emisión por estado del trial; y *«No existe transición de vuelta»*.
- `12-contrato-de-cobertura.md` §2.6, la tabla *«Qué emite cada estado de la suscripción — los
  nueve, sin huecos»*, filas `PENDING_AUTHORIZATION`, `SUSPENDED` y `PAUSED` por
  `CUSTOMER_REQUEST`.
- `B/02-modelo-de-datos.md` §2.2: la enumeración de los seis vivos.
- `V/02-modelo-de-datos.md` §2.2 (`UNIQUE(user_id, vertical)` *«sin condición de estado … el trial
  es único **de por vida**»*) y §4.1 (*«Se conserva íntegro, siempre … la fila de `trial`»*).
- `12-contrato-de-cobertura.md` §4: *«El estado exacto de la suscripción no cruza»* — o sea que
  verticales **ni siquiera puede leer** el predicado que `T6` le pide evaluar. Lo único que el
  contrato le entrega es `cubierto` y `fuentes`, y bajo esa lectura los cuatro estados dicen *«no
  hay suscripción»*, que es la respuesta opuesta.

**Severidad.** `CRITICA`. Un beneficio único de por vida se destruye sin contraprestación y sin
vuelta, y la evidencia de que se destruyó está diseñada para sobrevivir al borrado de la cuenta.
Es *«un dato se pierde sin vuelta»* en su forma más literal.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y es el cruce exacto que
`DEC-METH-008` manda recorrer.** `T6` es el **arreglo 8** y nace con una premisa —*«suscripción
viva ⇒ el título es la suscripción»*— que el **arreglo 16** (los nueve estados con su emisión)
volvió falsa para cuatro de los seis estados vivos. Los dos se escribieron en tandas distintas y
ninguno recorrió al otro: el 8 usó «viva» con el único conjunto enumerado que existe, y el 16
enumeró que ese conjunto **no es** el de la cobertura. **La pregunta «¿qué premisa de otro arreglo
estoy volviendo falsa?» tiene acá su respuesta más limpia de la pasada.**

---

### F-8cA2-003 — «`S5` no se aplica sobre una fila que ya declaró sucesión» nombra a la sucesora, y la que recibe el cobro es la predecesora: el arreglo 15 no cubre el caso que vino a cerrar

**Qué se rompe.** El daño que el `B/12` §5.3 describe entero —*«en plena sucesión la persona queda
con **las dos vivas**, y el crédito de la sucesora **ya se computó en cero** … paga un período
entero que **no le compra nada**, y la fórmula que lo ignoró ya no se puede corregir»*— sigue
ocurriendo, porque la regla que lo bloquea está escrita sobre **la otra fila**. Es doble cobro con
dinero real sobre el mecanismo que el propio capítulo llama *«el más caro del sistema»*.

**El camino.**

1. El caso es el del `B/12` §5.3: una persona en `GRACE_PERIOD` cambia de plan —*«es el camino de
   recuperación»* (`DEC-SUB-003`)—. Se crea la **sucesora**, con `sucede_a` apuntando a la
   predecesora, y su crédito se computa en **cero** porque *«En grace, el período en curso no se
   pagó»*.
2. La cuota vieja sigue en `recycling` y puede entrar: *«Mientras la predecesora siga viva su cuota
   sigue en `recycling` (§1.3, medido) y **puede entrar**»*. Ese cobro **le llega a la
   predecesora**, que es la que está en `GRACE_PERIOD`.
3. El arreglo lo bloquea así: *«**`S5` no se aplica sobre una fila que ya declaró sucesión.** El
   pago entra, se registra, y **se reembolsa**; la predecesora sigue su camino a `CANCELLED` por
   `S17`.»*
4. **«La fila que declaró la sucesión» es la sucesora, no la predecesora**, y no es una lectura
   mía: es el vocabulario que el propio corpus fijó. `B/03` §3.2, condición de `S1`: *«no hay otro
   **origen** vivo para ese `user + vertical`, **o la fila declara una sucesión** (`sucede_a`)»* —
   la fila que se está insertando, la sucesora, con su `sucede_a` puesto. Y `B/02` §2.2 escribe los
   dos candados sobre esa misma división: `A` es `sucede_a IS NULL` (el origen, o sea la
   predecesora) y `B` es `sucede_a IS NOT NULL` (la sucesora). **La predecesora tiene `sucede_a`
   nulo: no declaró nada.**
5. Leída al pie de la letra, entonces, la regla exime a la **sucesora** —que está en
   `PENDING_AUTHORIZATION` y **no puede estar en `GRACE_PERIOD`**, así que `S5` nunca la alcanza: la
   regla es vacua— y **deja intacta** la aplicación de `S5` sobre la predecesora, que es la única
   fila a la que ese cobro puede llegar.
6. Con `S5` aplicándose, la predecesora vuelve a `ACTIVE`: dos filas vivas con dos autorizaciones,
   el crédito cero de la sucesora ya escrito, y el reembolso que la regla ordenaba nunca se emite
   porque la regla que lo ordena no se disparó.
7. **Y la ambigüedad no es sólo mía: el corpus usa la frase en los dos sentidos.** `B/03` §3.3 dice
   *«una fila **con la marca `requiere_conciliación` puesta no puede declarar una sucesión**, salvo
   desde `CANCEL_SCHEDULED`»* — y *«desde `CANCEL_SCHEDULED`»* sólo tiene sentido si la fila que
   *«declara»* es la **predecesora**, la que está siendo sucedida. Las dos frases están en el mismo
   capítulo, a quince líneas de distancia, con sujetos opuestos.

**Dónde lo permite el diseño.**

- `B/12-suscripcion.md` §5.3, subsección *«Y si entra, NO reactiva a la predecesora»*, la cita
  completa de la regla.
- `B/03-maquinas-de-estado.md` §3.2, condición de `S1`; y §3.3, *«Dos cosas que el §11 sigue
  prohibiendo»*.
- `B/02-modelo-de-datos.md` §2.2, los dos índices parciales partidos por `sucede_a IS NULL` /
  `IS NOT NULL`.
- `B/03-maquinas-de-estado.md` §3.2, `S5`: `| S5 | GRACE_PERIOD | entra el pago | ACTIVE | — | se
  apaga el reloj |` — sin ninguna condición que mencione la sucesión.

**Severidad.** `CRITICA`. Es dinero real cobrado dos veces por el mismo período, sobre el camino
que el diseño eligió como *«salida del problema en vez de un muro»*, y con el reembolso —la
reparación— sin disparar. Que la fila de `S5` en la tabla de transiciones no lleve la condición es
lo que lo cierra: `NUCLEO/03` regla 1 dice que la tabla es exhaustiva, y la excepción vive sólo en
la prosa de otro capítulo.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 15**, que es literalmente esta regla. El
daño que describe es real y lo detectó bien; lo que falló es el sujeto. Y el sujeto se equivocó
**por vocabulario que otro arreglo acababa de fijar**: los arreglos 11 y 12 (`S17` y la limpieza de
`sucede_a`) son los que convirtieron *«declarar una sucesión»* en una expresión con lado
—`sucede_a IS NOT NULL`— y el 15 la usó con el lado contrario.

---

### ALTA

### F-8cA2-004 — La tabla del espejo enumera 8 pares de 40, y los tres pares «coinciden» más frecuentes no están: la relectura normal de una suscripción al día produce una divergencia, una marca, y le bloquea el cambio de plan

**Qué se rompe.** Cada webhook de una suscripción `ACTIVE` dispara la relectura obligatoria del
preapproval, que devuelve `authorized`. Ese par —`authorized` × `ACTIVE`— **no figura en la tabla
del espejo**, y la regla que la cierra dice que lo que no figura *«es divergencia real»*. Cada
renovación de cada cliente al día emite entonces un evento crítico del §22.1, un correo a
`SUPER_ADMIN` y una alerta en Admin, y deja la fila **marcada** — y una fila marcada *«no puede
declarar una sucesión»*, o sea que **nadie puede cambiar de plan**.

**El camino.**

1. `B/03` §10.1 obliga a releer: *«si lo es, se **relee el recurso por su id** en el proveedor y se
   escribe lo leído»*.
2. La tabla del §10.1 tiene **ocho filas**, y las conté: cubren **21 de los 40 pares** posibles
   (cuatro estados del proveedor × los nueve estados de `B/03` §3.1 más el renglón `(sin fila)`).
   Quedan **19 sin veredicto**.
3. El cierre del § es explícito sobre qué pasa con ésos: *«Lo que **no** figura acá es divergencia
   real, y ahí la marca es la respuesta correcta»*.
4. Entre los 19 están los **tres pares de coincidencia perfecta más comunes del sistema**:
   `authorized` × `ACTIVE`, `paused` × `PAUSED` y `cancelled` × `CANCELLED`. La tabla escribió
   *«nada: coinciden»* para `pending` × `PENDING_AUTHORIZATION` y para `cancelled` ×
   `CANCEL_SCHEDULED`, y no lo escribió para los otros tres.
5. `S14` pone la marca y emite *«evento crítico, correo a `SUPER_ADMIN`, alerta en Admin»*. `B/02`
   §2.2: *«mientras esté puesta **no se puede declarar una sucesión** sobre esa fila»*. Un
   downgrade pedido por un cliente marcado no se puede ejecutar, así que **sigue pagando el plan
   caro**.
6. El desagüe tampoco existe: `B/09` §3 agrega que *«La marca lleva reloj. Si sigue puesta pasado
   su plazo, **escala**»* — con toda la cartera marcada, la escalación es el estado normal del
   sistema.
7. Los otros 16 pares sin veredicto no son de relleno: `authorized` × `CHARGE_DECLINED` y
   `cancelled` × `CHARGE_DECLINED` son la lectura **esperada** de una fila que `S16` acaba de
   terminar, y `authorized` × `(sin fila)` es el preapproval huérfano de `B/09` §2.2.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §10.1, la tabla de ocho filas y su cierre: *«Lo que **no** figura
  acá es divergencia real»*; y *«El proveedor devuelve **cuatro** estados de preapproval»*.
- `B/03-maquinas-de-estado.md` §3.1, los nueve estados más el renglón `(sin fila)`.
- `B/03-maquinas-de-estado.md` §3.2, `S14`.
- `B/02-modelo-de-datos.md` §2.2, el bloqueo de la sucesión por la marca.
- `B/09-conciliacion.md` §3, *«La marca lleva reloj … escala»*.

**Severidad.** `ALTA`, y es el hallazgo que más cerca quedó de `CRITICA`. No lo pongo ahí porque
nadie pierde cobertura —`B/03` §3.1 es explícito: *«La fila conserva el estado que tenía, y sigue
cubriendo a quien estaba cubierto»*— y el daño de plata es indirecto (un downgrade que no se puede
ejecutar). Lo que sí destruye con certeza es el detector: un canal de incidentes donde **todo** es
un incidente no señala nada, y `B/09` §3 acaba de argumentar por escrito que la marca es *«el único
detector»*.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 18.** Antes de él espejar no era una
transición declarada y el choque entre *«se escribe lo leído»* y la regla 1 del núcleo estaba
abierto; el arreglo lo resolvió **enumerando**, que es la decisión correcta, y **declaró cerrado un
dominio que dejó cubierto a la mitad**. La propia instrucción de esta pasada pregunta si los ocho
pares son ocho de verdad: son ocho filas sobre cuarenta pares, y la incompletitud está del lado de
lo nuestro, no del proveedor —los cuatro estados del proveedor son consistentes con `B/12` §4.4, y
**yo no los medí**.

---

### F-8cA2-005 — `T1` y `T6` salen del mismo estado con el mismo evento, sus condiciones se solapan, y ninguna regla dice cuál gana

**Qué se rompe.** Quien contrata antes de publicar satisface **las dos** condiciones el día que
publica. `T1` le da treinta días de trial y lo deja en `TRIAL_ACTIVE`; `T6` le consume el trial y lo
deja en `TRIAL_CONVERTED`. Son desenlaces opuestos sobre el mismo acto, y cuál ocurre depende del
orden en que una implementación evalúe dos filas de una tabla. Si gana `T1`, el resultado es
exactamente el estado sin salida que `T6` se escribió para impedir.

**El camino.**

1. `V/03` §2 declara `T1` y `T6` con **el mismo `desde` y el mismo evento**: `PRE_TRIAL`, *«el
   evento de activación declarado por la vertical»*. Lo único que las distingue es la condición.
2. Las condiciones **no son excluyentes**. `T1`: *«la vertical declara evento **y** su plan de trial
   tiene días de trial > 0»*. `T6`: *«ya hay una suscripción viva para ese `user + vertical`»*. Una
   persona con suscripción viva en Gastronomía —que declara evento y tiene días > 0— cumple las dos.
3. **`T1` ya no pregunta por la suscripción.** El propio § lo explica: la condición vieja *«se cae
   por **redundante**, no por permisiva»*, y la redundancia que se argumenta es contra el estado de
   origen, no contra la suscripción. Nada quedó en `T1` que la desactive cuando `T6` aplica.
4. `NUCLEO/03` §1 tiene seis reglas de lectura y **ninguna es de precedencia**. La regla 1 dice qué
   pasa con lo que no está declarado; no dice qué pasa cuando hay **dos** declaradas y las dos
   aplican. El caso no existía antes porque ninguna máquina del programa tenía dos filas con el
   mismo par (origen, evento) — es el primero.
5. Si gana `T1`, el desenlace lo describe el propio capítulo: *«lo dejaría en `TRIAL_ACTIVE` **sin
   salida alcanzable** — `T3` no puede vencerlo porque exige que no haya suscripción autorizada, y
   `T2` espera **un evento que ya ocurrió**»*. O sea: el texto **sabe** cuál es el resultado malo, y
   lo evita sólo si `T6` gana.
6. Y la población que llega por ahí no es marginal: `V/21` §2.4 pone al **100 % de los usuarios de
   producción** en `PRE_TRIAL`, y el camino previsto es que contraten primero y publiquen después.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2, filas `T1` y `T6`, y el párrafo *«`T6` es `T1` para quien ya
  paga, y sin él el trial queda colgado»*.
- `NUCLEO/03-maquinas-de-estado.md` §1, las seis reglas.
- `V/21-migracion.md` §2.4.

**Severidad.** `ALTA`. El resultado es indeterminado y una de las dos ramas es un estado terminal
sin salida sobre un cliente que paga. No es `CRITICA` porque bajo la rama que el diseño
evidentemente quiere —`T6` primero— el resultado es el correcto, y la corrección es una línea de
precedencia.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 8**, que agregó la segunda fila sobre el
par (origen, evento) que `T1` ya ocupaba, sin volver a `T1` a acotarla ni agregar una regla de
precedencia al núcleo. Es el dominio que el arreglo crea —un par de transiciones nuevo— sin
recorrer.

---

### F-8cA2-006 — El arreglo 16 enumeró la emisión de fuente de una máquina y dejó la otra: ningún documento dice qué estados de la INSTANCIA DE ADDON emiten, y `PENDING_AUTHORIZATION` de addon repite la respuesta cara

**Qué se rompe.** El contrato transporta seis tipos de fuente y dos de ellos salen de máquinas de
estado: `SUSCRIPCIÓN` y `ADDON`. El arreglo 16 escribió el mapa estado → emisión de la primera
—*«los nueve, sin huecos»*— y **no escribió ninguno para la segunda**. La consecuencia concreta es
la misma que el §2.6 acaba de declarar *«la respuesta cara»*: un addon en `PENDING_AUTHORIZATION`
que emita da **hasta 72 horas de sus capacidades gratis, repetibles**, abandonando el checkout y
empezando de nuevo.

**El camino.**

1. `12-contrato…` §2.1 pone `ADDON` entre los seis `tipo`, y §2.3 dice que su referencia es la
   `versiónDeAddon`. `B/02` §2.4 confirma que la fuente `ADDON` la transporta **la instancia**:
   *«la `addon_version` que ANCLÓ al comprarse»*.
2. `B/03` §8 le da a la instancia su propia máquina, con **cinco** estados alcanzables:
   `PENDING_AUTHORIZATION` (A1), `ACTIVE` (A2), `ABANDONED` (A3), `EXPIRED` (A4) y `CANCELLED`
   (A5/A6).
3. **Ningún documento dice cuáles de los cinco emiten fuente.** El mapa del `12-contrato…` §2.6
   está titulado *«Qué emite cada estado **de la suscripción**»* y sus diez filas son las nueve de
   `B/03` §3.1. La tabla de clases del §2.4 clasifica `ADDON` por `hasta` (`fecha` →
   `COMPLEMENTO`, `SIN_FECHA_CONOCIDA` → `COMPLEMENTO`) y **la clase no es la emisión**: dice qué
   hace la fuente **si está**, no si está.
4. El contrato además **prohíbe resolverlo del otro lado**: §4, *«Tampoco cruza el estado de la
   instancia de addon … lo único que verticales necesita saber es si la fuente está en la lista»*.
   O sea que la decisión es exclusivamente de billing, y billing no la escribió.
5. El estado que importa es `PENDING_AUTHORIZATION`, y su costo está calculado **en el capítulo de
   al lado, para la suscripción**: *«Emitirla significa **hasta 72 horas de servicio completo
   gratis, y repetibles** —se abandona el checkout y se empieza de nuevo—»*. Un addon es más barato
   pero el mecanismo es idéntico, y `A3` le da la misma ventana: *«mismas 72 h que `S3`»*.
6. La defensa de `12-contrato…` §6.1 —*«Una fuente no implementada responde **que no**»*— no
   alcanza: la fuente `ADDON` **sí** está implementada; lo que falta es uno de sus estados. El
   default de negar cubre el olvido de una fuente entera, no el de una fila de su máquina — que es
   textualmente la distinción que ese mismo §6.1 hace al explicar por qué la referencia no anulable
   lo *«sube un escalón»*.

**Dónde lo permite el diseño.**

- `12-contrato-de-cobertura.md` §2.6, el título y las diez filas del mapa; y §2.4, la tabla de
  clases.
- `12-contrato-de-cobertura.md` §4, tercera ausencia declarada.
- `B/03-maquinas-de-estado.md` §8, las seis transiciones de la instancia.
- `B/02-modelo-de-datos.md` §2.4, `addon_instance`.
- `12-contrato-de-cobertura.md` §6.1.

**Severidad.** `ALTA`. Es acceso a capacidades sin contraprestación y repetible, pero está
**indeterminado** y no decidido en la dirección mala, y la cultura del documento (§6.1, §2.6) empuja
al implementador hacia negar. Si lo resuelve al revés, es `CRITICA`.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 16 por omisión, y la omisión es
diagnosticable.** El arreglo nació porque *«El `hasta` estaba enumerado por **situación** y no por
**estado**, y así quedaban cuatro de los nueve estados de la suscripción sin respuesta declarada»*.
El mismo diagnóstico vale palabra por palabra para la instancia de addon, y el arreglo recorrió una
sola de las dos máquinas que alimentan el contrato.

---

### F-8cA2-007 — `S17` cancela la predecesora contra una autorización que el arreglo 14 garantiza que todavía no cobró: si ese primer cobro se rechaza, el cliente queda sin nada y la suscripción que funcionaba está cancelada sin vuelta

**Qué se rompe.** Un cliente al día pide un cambio de plan. La sucesora se autoriza, `S17` cancela
la predecesora **en el proveedor**, que está medido como irreversible. Días después entra el primer
cobro de la sucesora y se rechaza: `S16` la manda a `CHARGE_DECLINED`, *«terminal … no hay servicio,
no hay autorización y no hay vuelta»*. **El cliente se queda sin cobertura, sus fichas bajan, y la
suscripción que venía pagando sin problemas fue destruida por nosotros** — a cambio de una
autorización que, por diseño, nunca había cobrado nada.

**El camino.**

1. `S17` dispara con *«webhook de que **su sucesora** quedó autorizada, confirmado por relectura»* y
   manda la predecesora a `CANCELLED`, con el efecto *«**se cancela en el proveedor** (es `D7`)»*.
2. **Autorizada no es cobrada, y el arreglo 14 lo garantiza.** `B/12` §5.2: *«**Toda sucesora nace
   con fecha de primer cobro POSTERIOR AL VENCIMIENTO DE SU VENTANA DE AUTORIZACIÓN.** Ninguna
   puede cobrar antes de que su propia ventana se cierre»* — la ventana son 72 h (`B/03` §3.4). O
   sea: en **toda** sucesión, `S17` ocurre antes del primer cobro de la sucesora. No es un borde, es
   la regla.
3. El primer cobro entra y se rechaza. `S16`: `| S16 | ACTIVE | el **primer** cobro se rechaza |
   CHARGE_DECLINED | es el primer cobro DE ESA autorización, y el proveedor la canceló al
   rechazarlo |`, con efecto *«el reintento **es un alta nueva**»*.
4. La vuelta atrás no existe en ningún nivel: `CHARGE_DECLINED` es terminal; la predecesora está en
   `CANCELLED` y `B/03` §3.3 dice *«Una suscripción terminada no revive»*; y en el proveedor
   `PA-5` mide que cancelar es irreversible.
5. El cliente queda sin fuente de cobertura de clase `TÍTULO` y sus fichas caen por `PB2`. Su
   recuperación es *«un alta nueva»*, con otra tarjeta o el mismo rechazo.
6. La asimetría es lo que lo vuelve un defecto y no una consecuencia natural del impago: **la
   tarjeta que falló es la de la sucesora**, y la que venía funcionando era la de la predecesora,
   que nosotros cancelamos. El cliente no dejó de pagar: pidió cambiar de plan.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §3.2, `S17` y `S16`; §3.3, *«`CANCELLED` → cualquier cosa»*.
- `B/12-suscripcion.md` §5.2, la regla de la fecha de primer cobro.
- `B/03-maquinas-de-estado.md` §3.4 punto 1, las 72 h.
- `B/03-maquinas-de-estado.md` §3.1, *«`CHARGE_DECLINED` … **Terminal**»*, y `B/12` §4.4 citado
  ahí: *«`PUT {status:"authorized"}` devuelve `400 "Invalid transition from cancelled to
  authorized"`»*.

**Severidad.** `ALTA`. Se pierde una relación comercial que funcionaba —ingreso que deja de
entrar— y el cliente pierde el servicio, pero nadie paga de más y ningún dato se destruye. Lo que
lo acota es que la ventana entre `S17` y el primer cobro es corta y la recuperación existe, aunque
sea incómoda.

**¿Es nuevo, o es el arreglo?** **Lo introdujo la composición de tres arreglos de tres tandas.**
`S17` (arreglos **11 y 12**) es lo que hace que la predecesora **efectivamente** se cancele — antes
*«ninguna fila de esta tabla lo ejecutaba»*, así que el cliente conservaba la vieja por omisión.
El arreglo **14** convirtió *«puede que la sucesora no haya cobrado»* en *«la sucesora nunca cobró
todavía»*. Y `S16` con `CHARGE_DECLINED` (arreglo del racimo de `B/03` §3.1) es el estado terminal
que cierra la salida. **La premisa que 11/12 vuelven falsa es la de 14**: 14 empujó el primer cobro
para que la sucesora no cobrara antes de tiempo, y 11/12 apoyaron una cancelación irreversible
sobre el instante que 14 acababa de vaciar de información.

---

### F-8cA2-008 — El reconciliador de excedentes sigue leyendo «la misma lista … con sus siete entradas» y la lista tiene diez: «una lista, dos consumidores» dejó de ser cierto con el arreglo 4

**Qué se rompe.** La invalidación del caché y el reconciliador de excedentes comparten lista por
decisión explícita. El arreglo 4 le agregó entradas a la lista en `V/02` §3.2 y **no tocó al
segundo consumidor**, que sigue nombrando *«sus siete entradas»*. Con la lista partida, un recorte
de límite que llega por una de las entradas nuevas invalida el caché y **no dispara el
reconciliador**: el excedente queda publicado por encima del límite, que es literalmente el daño
que ese § enumera.

**El camino.**

1. `V/15` §4.2: *«Y no hace falta una lista nueva: **es la misma lista que invalida el caché**
   (cap. 02 §3.2), con sus **siete entradas**. Una lista, dos consumidores»*, y el aviso: *«que
   falte un disparo es una capacidad regalada o un límite incumplido»*.
2. Conté las filas de `V/02` §3.2: **diez**, tres de ellas en negrita como nuevas.
3. Ejemplo concreto con una de las nuevas, *«se publica una versión nueva de un `addon_version`»*:
   un addon que otorgaba 30 fotos publica una versión con 10. El caché se invalida (entrada 10). El
   reconciliador, implementado contra las siete que `V/15` §4.2 nombra, **no corre**. Las 20 fotos
   de más quedan publicadas por encima del límite.
4. El paso 7 de la autorización bloqueará las **próximas**, así que el sistema no queda incoherente
   hacia adelante; lo que queda sin corregir es el excedente que ya existe, que es exactamente el
   trabajo del reconciliador: `V/15` §4.3, *«Archiva, despublica o deshabilita»*.
5. El guard tampoco lo ve: `G5` verifica *«ninguna fuente se apaga sin pasar por el reconciliador»*
   comprobándose *«sobre los efectos declarados de las transiciones del capítulo 03»*, y **publicar
   una versión de `addon_version` no es una transición de ninguna máquina** — es el mismo hueco que
   `F-8A2-017` ya nombra, ahora con tres entradas más afuera.

**Dónde lo permite el diseño.**

- `V/15-entitlements-y-limits.md` §4.2, las dos citas.
- `V/02-modelo-de-datos.md` §3.2, las diez filas y el párrafo *«Las cuatro últimas son de la FASE 9
  y ninguna entraba por las siete de arriba»*.
- `V/20-testing.md` §2, `G5`.

**Severidad.** `ALTA`. Es un límite incumplido de forma persistente, sobre el mecanismo que el
propio capítulo llama el que *«no hace falta una lista nueva»* porque comparte la de al lado — y
dejó de compartirla.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 4.** Agregó entradas a una lista que
tiene **dos** consumidores declarados y actualizó uno. El número *«siete»* no es una glosa: es la
forma en que el segundo consumidor identifica la lista, así que congelarlo la parte en dos.

---

### F-8cA2-009 — Las transiciones que el arreglo 18 declaró —espejar— y la del arreglo 11/12 —`S17`— tienen actor de sistema y ninguna clase declarada, y las dos ramas posibles rompen algo

**Qué se rompe.** `V/17` §3.4 creó una clase de operación para las transiciones cuyo actor no es
una persona, la acotó a *«las disparadas por el reloj»*, y le puso una propiedad de seguridad
verificada por guard: *«**Una transición de esta clase nunca otorga.**»* La 9-bis agregó nueve
transiciones cuyo actor tampoco es una persona —`S17` y los ocho espejos del `B/03` §10.1— **que no
las dispara el reloj sino un webhook**. Quedan fuera de la clase, y los dos caminos posibles fallan:
si se las mete en la clase, el guard tiene que rechazar dos de ellas; si no, sus pasos 5, 6 y 7 se
evalúan sobre el cliente, que no tiene ninguna capacidad que otorgue «cancelame la suscripción».

**El camino.**

1. `V/17` §3.3 declara al sistema como actor y separa dos: *«los **jobs** y los **webhooks** operan
   sin persona detrás»*. Son dos.
2. `V/17` §3.4 resuelve **uno solo**: *«Las transiciones disparadas por **el reloj** son una segunda
   clase de operación … los pasos 5, 6 y 7 se resuelven sobre la capacidad del ACTOR»*. Los webhooks
   no entran, y *«**La clase se declara transición por transición**, nunca se infiere»* impide que
   alguien los meta al leer.
3. `V/17` §3.5 no las deja afuera de la resolución: *«**Toda operación la corre**, escriba o no»*, y
   pasa por el paso 5 *«sólo si escribe estado del negocio y es auditable»* — `S17` y los ocho
   espejos escriben estado y lo auditan (`NUCLEO/03` regla 4).
4. **Rama A, no son de la clase.** Entonces vale el default de `V/17` §3.2 regla 3: los pasos 5, 6 y
   7 se evalúan **sobre el sujeto**, y las únicas excepciones declaradas son *«las doce acciones del
   capítulo 08 §3»*. `S17` le pregunta al cliente si su conjunto efectivo le otorga que le cancelen
   la suscripción. Nadie se lo otorga: la operación cae en el paso 6 y **la predecesora no se
   cancela** — que es el incidente que `S17` se escribió para evitar, con dos preapprovals vivos.
5. **Rama B, sí son de la clase.** Entonces las alcanza el guard `G-R3-B`: *«una transición
   **disparada por el reloj** otorga algo, en vez de quitar»* falla. Y dos de los ocho espejos
   **otorgan**: `authorized` × `PAUSED` → **`S10`** *(«el proveedor reanudó»*, que restituye el
   servicio) y `authorized` × `PENDING_AUTHORIZATION` → **`S2`** (*«arranca el período»*). El guard
   los rechaza, y con razón según su propio enunciado.
6. No hay tercera rama escrita, porque el lugar donde se declararía la clase sigue sin existir: las
   tablas de transiciones son `V/03` §2, §9, §11 y `B/03` §3.2, §8, y **ninguna tiene columna de
   clase** — es `F-8bA2-005`, que sigue llegando y ahora tiene nueve sujetos más.

**Dónde lo permite el diseño.**

- `V/17-autorizacion.md` §3.3, §3.4 (las tres citas y el guard), §3.5 y §3.2 regla 3.
- `B/03-maquinas-de-estado.md` §10.1, la tabla del espejo y *«Espejar un estado leído por id es una
  transición declarada de esta tabla, no un acto aparte»*; y §3.2, `S17`.
- `V/20-testing.md` §2, `G-R3-B`; y §2.1, *«un guard que no puede fallar es un comentario con exit
  code 0»*.

**Severidad.** `ALTA`. La rama A deja sin ejecutar la transición que sostiene el mecanismo más caro
del sistema; la rama B rompe un guard obligatorio. Ninguna de las dos pierde plata por sí sola —hay
un camino de incidente declarado para la primera— y la corrección es una declaración, no un
rediseño.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad nueva es cuantificable.** El hueco de
que el §3.4 cubra sólo el reloj y no al webhook es anterior (`S2` y `S3` ya estaban). Lo que la
9-bis agregó son **nueve transiciones más** en esa misma condición —los arreglos **18** (ocho
espejos, y es el arreglo que las convierte en transiciones *«declaradas»*, o sea que antes no
contaban) y **11/12** (`S17`)—, y con ellas el caso nuevo de que **dos de las nueve otorgan**, que
es el que vuelve incompatibles a las dos ramas.

---

### MEDIA

### F-8cA2-010 — La tabla de 6 × 4 del §2.4 afirma «tres combinaciones imposibles … por una razón escrita, no por omisión»: conté dos razones y trece celdas en blanco

**Qué se rompe.** El arreglo 1 recorrió el dominio que creaba —la clase derivada del `tipo` **y**
del `hasta`— y publicó la tabla como prueba de que lo recorrió. La tabla no cubre el dominio, y su
frase de cierre afirma que sí. Un lector que la use como la enumeración de casos —que es para lo
que se escribió— va a creer que los blancos son iguales entre sí, y son tres cosas distintas:
imposible con razón, imposible sin razón, y no mirado.

**El camino.**

1. `12-contrato…` §2.4 presenta la tabla como el recorrido: *«**El dominio que esta regla crea,
   recorrido** — seis `tipo` × cuatro `hasta`»*.
2. Conté las 24 celdas: **9 clasificadas**, **2 marcadas imposibles con su razón** (`TRIAL` ×
   `NO_VENCE`, *«el trial siempre vence»*; `SUSCRIPCIÓN` × `SIN_EMPEZAR`, *«una suscripción que no
   arrancó no emite fuente»*) y **13 en blanco, con un guión y nada más**.
3. El cierre dice: *«**Las tres combinaciones imposibles lo son por una razón escrita, no por
   omisión**, y es lo que impide que la regla se vuelva a romper por un extremo que nadie miró»*.
   Las razones escritas son dos, y los extremos no mirados son trece.
4. El daño operativo está acotado porque **la regla en prosa sí es total**: las tres filas de clases
   cubren todo el dominio por construcción. La tabla es la verificación, no el mecanismo. Por eso
   esto no es `ALTA`.
5. Pero la prosa tiene un solapamiento que la tabla, completa, habría mostrado: `BASE` se define
   como *«`tipo = BASE`, **o cualquier fuente con `hasta = SIN_EMPEZAR`**»* y `COMPLEMENTO` como
   *«`tipo = ADDON`»*. Un `ADDON` con `hasta = SIN_EMPEZAR` satisface las dos, y esa celda es una de
   las trece en blanco. Es alcanzable si y sólo si un `addon_instance` en `PENDING_AUTHORIZATION`
   emite — que es la pregunta abierta de `F-8cA2-006`.

**Dónde lo permite el diseño.**

- `12-contrato-de-cobertura.md` §2.4, la tabla de 6 × 4 y su párrafo de cierre; las tres filas de
  la tabla de clases.

**Severidad.** `MEDIA`. La regla es total y falla en la dirección correcta; lo roto es la
verificación que se presenta como prueba de haberla recorrido, más un solapamiento que sólo se
vuelve real si `F-8cA2-006` se resuelve mal.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 1**: la tabla no existía antes. Y el
enunciado de la pasada —*«el contrato ya trae esa tabla: verificala, no le creas»*— acertó: la tabla
afirma una completitud que no tiene.

---

### F-8cA2-011 — El reloj nuevo de la marca no es transición de ninguna máquina, no declara actor ni clase, y «escala» no tiene destino

**Qué se rompe.** El arreglo 19 le puso reloj a la marca `requiere_conciliación` para que el
servicio que sostiene una fila divergente tenga cota. El reloj no es una transición, así que ninguna
de las tres defensas que el programa tiene sobre lo que el reloj hace lo alcanza, y su acción
—*«escala»*— no nombra un estado, un destinatario ni un efecto. Una fila puede quedar marcada,
escalada y **sirviendo** indefinidamente, que es el estado sin cota que el arreglo venía a cerrar.

**El camino.**

1. `B/09` §3: *«**La marca lleva reloj.** Si sigue puesta pasado su plazo, **escala**: es una
   divergencia de plata que nadie resolvió, y sin reloj el servicio que la fila sostiene **no tiene
   cota**. El plazo es configuración»*.
2. La marca **no es un estado** —`B/03` §3.1 lo decidió a propósito: *«`requiere_conciliación` es
   una marca booleana sobre la fila, no un estado»*— así que vencerla no puede ser una transición de
   la tabla del §3.2, y no hay ninguna.
3. `V/17` §3.4 define la clase de actor sobre **transiciones**, `G-R3-B` verifica **transiciones**, y
   `G5` se comprueba *«sobre los efectos declarados de las transiciones del capítulo 03»*. El reloj
   de la marca no es ninguna de las tres cosas.
4. `NUCLEO/03` cierra con *«**Los relojes**, como jobs concretos con su horario y su idempotencia,
   son de cada subdominio»*, y `B/09` no lo declara como job: no dice cada cuánto corre, ni si es
   idempotente, ni qué escribe.
5. *«Escala»* no tiene destino declarado. Las dos únicas transiciones que tocan la marca son `S14`
   (la pone) y `S15` (la levanta, *«intervención humana registrada»*). No hay una tercera que la
   convierta en otra cosa, así que la fila sigue marcada después de escalar, y el reloj —si es
   periódico— vuelve a escalar cada corrida, contra la regla que el mismo § acaba de establecer:
   *«Lo que se agrega es el AVISO … lo que no vuelve a emitir es una alerta por corrida sobre un
   caso ya abierto»*.

**Dónde lo permite el diseño.**

- `B/09-conciliacion.md` §3, el párrafo del reloj y el de *«Lo que se agrega es el AVISO»*.
- `B/03-maquinas-de-estado.md` §3.1 y §3.2, `S14` y `S15`.
- `V/17-autorizacion.md` §3.4; `V/15-entitlements-y-limits.md` §4.2 (`G5`);
  `NUCLEO/03-maquinas-de-estado.md`, *«Lo que esta mitad NO cierra»*.

**Severidad.** `MEDIA`. La dirección es la correcta —la marca es conservadora y no destruye nada— y
lo que falta es la mecánica. No es `ALTA` porque el servicio que sostiene una fila marcada es el que
ya tenía, no uno nuevo.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 19**, que es exactamente *«la marca lleva
reloj»*. Es el tercer reloj sin dueño del programa —los otros dos son el de retención y
`vertical.fin_de_servicio`, `F-8bA2-006`— y el primero que nace **después** de que `V/17` §3.4
declarara que un actor de reloj tiene que declararse.

---

### F-8cA2-012 — El «evento de activación» no está definido ni como transición ni como estado, y bajo una de las dos lecturas `PB3` lo satisface: recuperar una ficha consume un trial

**Qué se rompe.** El único disparador de `T1` y `T6` es *«el evento de activación declarado por la
vertical»*, y el programa lo nombra de dos formas incompatibles: como **la transición `PB1`** en un
capítulo y como **el hecho de que la ficha quede publicada** en otro. `PB3` —la republicación
automática cuando vuelve la cobertura— satisface la segunda y no la primera. Bajo esa lectura, toda
recuperación de una ficha `UNPUBLISHED_BY_BILLING` consume el trial de su dueño.

**El camino.**

1. `V/02` §2.1 lo modela como **una columna**: `vertical.evento_de_activacion`, *«Sin ella el lado
   izquierdo del «si y sólo si» no se puede leer»*. La columna existe; su dominio no está escrito en
   ninguna parte.
2. `V/03` §9 lo identifica con la **transición**: la nota de `PB1` dice *«publicar es quedar visible,
   y **es el evento que consume el trial** en las verticales con ficha»*.
3. `V/21` §2.4 lo identifica con el **hecho**: *«el evento que los sacaría **ya ocurrió**: `T1`
   dispara con *«la ficha queda publicada»*, que es la **transición** de publicar»* — la frase
   entrecomillada nombra un estado alcanzado y la glosa lo llama transición, en la misma línea.
4. Las dos lecturas divergen sobre `PB3`, que también termina en `PUBLISHED` y no es `PB1`. Bajo la
   lectura «hecho», una persona en `PRE_TRIAL` cuya ficha vuelve por `PB3` dispara `T1` o `T6`; bajo
   la lectura «transición», no.
5. La población afectada es la del corte: `V/21` §2.4 pone al 100 % de los usuarios en `PRE_TRIAL` y
   diseña la vuelta *«sola por `PB3` cuando la cobertura vuelve»*. Bajo la lectura «hecho», **el día
   que contratan y su ficha vuelve, `T6` les consume el trial** — que para un cliente que acaba de
   pagar es defendible (es lo que `T6` argumenta) pero no es lo que nadie decidió.

**Dónde lo permite el diseño.**

- `V/02-modelo-de-datos.md` §2.1, `vertical.evento_de_activacion`.
- `V/03-maquinas-de-estado.md` §9, nota de `PB1` y fila de `PB3`; §2, evento de `T1` y `T6`.
- `V/21-migracion.md` §2.4.

**Severidad.** `MEDIA`. Las dos lecturas producen desenlaces distintos sobre el consumo de un
beneficio único, pero la peor de las dos alcanza sólo a gente que ya está pagando, que es el caso
que `T6` declara aceptable.

**¿Es nuevo, o es el arreglo?** **Lo volvió alcanzable el arreglo 9.** Antes `PB3` salía de una
lista cerrada de tres transiciones (`S5`, `S7`, `T5`), todas posteriores a un trial ya resuelto;
desde que dispara por *«`cubierto` pasa a verdadero»* alcanza a cualquiera, incluido alguien en
`PRE_TRIAL`. El arreglo **22** es el que produce la población entera en esa situación.

---

### F-8cA2-013 — `S1` deja declarar una sucesión sobre una predecesora `SUSPENDED`, que es exactamente lo que `B/03` §3.1 argumenta que hay que bloquear

**Qué se rompe.** El capítulo argumenta por escrito que un `SUSPENDED` no puede tener una segunda
suscripción —*«su preapproval puede seguir vivo, y una segunda suscripción serían dos cobros»*— y
la condición de `S1` le deja la puerta abierta por el lado de la sucesión. Durante la ventana de
autorización hay **dos autorizaciones vivas** sobre el mismo `user + vertical`, y la de la
predecesora suspendida es justamente la que el capítulo dice que puede seguir cobrando.

**El camino.**

1. `B/03` §3.1 declara la intención: *«Con `CHARGE_DECLINED` afuera, **`SUSPENDED` vuelve a
   significar una sola cosa** … y ahí bloquear **es lo correcto**: su preapproval puede seguir vivo,
   y una segunda suscripción serían dos cobros. **Su salida no es el candado**: es pagar (`S7`) …»*.
2. `S1` lo permite igual: *«no hay otro **origen** vivo para ese `user + vertical`, **o la fila
   declara una sucesión** (`sucede_a`)»*. La rama de la derecha no pregunta en qué estado está el
   origen.
3. `S17` lo confirma desde el otro lado: dispara desde *«la **predecesora**, en **cualquier estado
   vivo**»*, y `SUSPENDED` es uno de los seis.
4. `B/03` §3.3 enumera lo que la sucesión sigue prohibiendo —una sucesora no puede ser sucedida, y
   una fila marcada no puede declarar sucesión— y **`SUSPENDED` no está en esa lista**. §3.3.1
   agrega los dos estados desde los que el cambio *«no se ofrece»* (`PENDING_AUTHORIZATION` y
   `PAUSED`) y tampoco lo incluye, y aclara que esos dos son *«de superficie, no de modelo»*.
5. La ventana de daño está acotada por `S17`, que cancela la predecesora cuando la sucesora se
   autoriza — pero son hasta 72 h (`B/03` §3.4) con el preapproval suspendido vivo, y `B/12` §1.3
   está citado en el §5.3 midiendo que una cuota en `recycling` *«puede entrar»*.

**Dónde lo permite el diseño.**

- `B/03-maquinas-de-estado.md` §3.1 (el argumento sobre `SUSPENDED`), §3.2 (`S1`, `S17`), §3.3 y
  §3.3.1.
- `B/02-modelo-de-datos.md` §2.2, los dos candados y los seis vivos.

**Severidad.** `MEDIA`. La ventana es corta, el cliente está volviendo a pagar, y el cobro viejo que
pudiera entrar es *«visible y reversible»* según el criterio de `PA-5` que el programa ya aplica. Lo
que está roto es que una intención declarada en prosa no tiene ninguna restricción que la sostenga
— el patrón que `V/17` abre condenando.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** La partición del candado por `sucede_a` es
anterior a la 9-bis. Lo que la 9-bis agregó es `S17` (arreglos **11 y 12**), que convirtió la
sucesión en un acto que **termina** y por lo tanto en una ruta normal y repetible; mientras
`sucede_a` no se limpiaba nunca, *«nadie podía cambiar de plan dos veces»* y esta puerta era de un
solo uso. La instrucción de recorrer `sucede_a` × los nueve estados es lo que la destapa.

---

### F-8cA2-014 — La lápida apoya su valor en que «el barrido del cap. 09 encuentra el id», y el §3 de ese capítulo excluye del barrido los estados terminales, `CANCELLED` entre ellos

**Qué se rompe.** El arreglo 21 escribe la lápida para que un preapproval cancelado durante el corte
sea reconocible si vuelve. El mecanismo que declara —el barrido diario— **no mira las filas
`CANCELLED`**, así que el caso que la lápida nombra como su justificación (*«la cancelación se
aceptó y no se aplicó»*) no se detecta hasta que el preapproval **cobra**. El dinero se mueve
primero y el sistema se entera después.

**El camino.**

1. `B/21` §2.5: *«Con la lápida, **el barrido del cap. 09 encuentra el id** y resuelve *«cancelado
   durante el corte»* en vez de *«huérfana»*»*.
2. `B/09` §3 abre con *«Por cada suscripción de nuestro inventario **que no esté en un estado
   terminal**»* y cierra el punto: *«**Los estados terminales no se barren**: `CANCELLED`,
   `ABANDONED` y `CHARGE_DECLINED` no pueden divergir hacia nada que nos importe»*.
3. La lápida **es** una `subscription` en `CANCELLED` (*«El compromiso viejo se conserva como una
   `subscription` en `CANCELLED` con su `provider_link`»*), así que no se barre nunca.
4. El escenario que la lápida declara defender es precisamente una divergencia hacia algo que sí
   importa: *«porque la cancelación se aceptó y no se aplicó»*. La premisa de `B/09` §3 —*«no pueden
   divergir hacia nada que nos importe»*— es falsa para esta fila en particular, y el capítulo que
   la crea lo dice.
5. Lo que sí funciona es el otro camino, y conviene decirlo porque es lo que evita que esto sea
   `ALTA`: `provider_link` lleva `UNIQUE(proveedor, id_del_proveedor)`, así que un webhook tardío de
   ese preapproval **resuelve a la lápida** en vez de a *«un preapproval desconocido»*, y el cobro
   no se imputa mal — que es el daño concreto que el §2.5 enumera. Lo que se pierde es la detección
   **antes** de que cobre.

**Dónde lo permite el diseño.**

- `B/21-migracion.md` §2.5, las dos citas.
- `B/09-conciliacion.md` §3, el encabezado y *«Los estados terminales no se barren»*; y §2.2, *«Las
  huérfanas se detectan por webhook, no por barrido»*.
- `B/02-modelo-de-datos.md` §2.2, `provider_link`.

**Severidad.** `MEDIA`. El daño que la lápida existe para evitar —imputar un cobro viejo al ciclo
nuevo— **sí** queda evitado, por `provider_link`. Lo que falla es la justificación escrita y la
detección temprana de los tres preapprovals que el `16-fase-7` §4.1 llama el punto de no retorno del
programa.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 21**, que es la lápida. La exclusión de
los terminales del barrido convive en el mismo capítulo que el arreglo 19 tocó, y el 21 citó un
mecanismo sin verificarlo contra el § que lo describe.

---

### BAJA

### F-8cA2-015 — La lista de invalidación dice «las cuatro últimas» y «las siete de arriba» sobre una tabla de diez filas: el arreglo 4 prometió cuatro entradas y hay tres marcadas

**Qué se rompe.** No se puede verificar si el arreglo 4 está completo. Su enunciado —*«**cuatro
entradas nuevas** en la invalidación del caché»*— y el texto del capítulo —*«Las **cuatro** últimas
son de la FASE 9 y ninguna entraba por las **siete** de arriba»*— suman once sobre una tabla de
diez. O falta una entrada, o dos se fundieron en una fila y el texto no lo dice. Las dos lecturas
tienen consecuencias distintas y ninguna se puede descartar leyendo.

**El camino.**

1. Conté la tabla de `V/02` §3.2: **diez filas** de datos, **tres** en negrita.
2. El párrafo siguiente dice *«las cuatro últimas»* y *«las siete de arriba»*: 4 + 7 = 11 ≠ 10.
3. **Lectura A**: la fila *«se publica una versión nueva de la de PISO o de la de PRE-TRIAL»* cuenta
   como dos entradas fundidas, y entonces la cuenta cierra en concepto y la tabla está completa.
4. **Lectura B**: falta una cuarta entrada y nadie lo sabe. La regla que el propio § da para
   detectarlo —*«si una fuente puede cambiar **lo que otorga** sin que cambie **ninguna fila del
   `user + vertical`**, necesita su propia entrada»*— es justamente la que habría que volver a
   recorrer, y el conteo equivocado es lo que impide saber si alguien la recorrió entera.
5. Se compone con `F-8cA2-008`: el segundo consumidor de la lista sigue diciendo *«siete»*, así que
   hoy hay **tres** números distintos —siete, diez y once— nombrando la misma lista.

**Dónde lo permite el diseño.**

- `V/02-modelo-de-datos.md` §3.2, la tabla y el párrafo *«Las cuatro últimas son de la FASE 9»*.
- `V/15-entitlements-y-limits.md` §4.2, *«sus siete entradas»*.

**Severidad.** `BAJA`. Es un conteo, y bajo la lectura A no hay defecto funcional. Lo reporto porque
es el conteo con el que se verifica un arreglo, y porque `F-8cA2-008` demuestra que estos números se
usan como identificadores de la lista y no como glosa.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 4.**

---

## 2. Hallazgos anteriores que siguen llegando sobre el texto nuevo

No cuentan como hallazgos nuevos (§4 de las instrucciones). Sólo los que **siguen llegando** y
cambiaron de forma o de alcance con la 9-bis; los que llegan igual que antes están en
[`../17-fase-8-bis/A2-maquinas-carreras-y-huerfanos.md`](../17-fase-8-bis/A2-maquinas-carreras-y-huerfanos.md)
§2 y no los repito.

| ID | veredicto | en qué paso llega ahora |
|---|---|---|
| `F-8bA2-001` | **CORTA** | **paso 3**. El arreglo 1 lo cerró: `12-contrato…` §2.4 deriva la clase también del `hasta`, y `PRE_TRIAL` cae en `BASE`. El desenlace que producía —cobertura perpetua sobre toda la plataforma— **vuelve por otro camino**, y es `F-8cA2-001`. |
| `F-8bA2-002` | **CORTA en su orden B, SIGUE en el A** | El orden B (publicar teniendo suscripción) lo cierra `T6`, **si `T6` gana la carrera** (`F-8cA2-005`). El orden A (contratar y no publicar) lo cierra el arreglo 1, y `V/03` §2 lo dice: *«Desde que un reloj que no arrancó no es un título, esa fuente ya no cubre»*. |
| `F-8bA2-003` | **CORTA** | **paso 4**. El arreglo 9 lo resolvió en la raíz: `PB3` dispara por *«`cubierto` pasa a verdadero»* y ya no por la lista `S5, S7, T5`. El capítulo lo nombra como su motivo. |
| `F-8bA2-004` | **CORTA** | **paso 3**. Misma razón: `PB2` ya no enumera causas. La enumeración que queda —el excedente— es la que **no** cambia `cubierto`, y está justificada. |
| `F-8bA2-005` | **SIGUE** | **paso 2**. Ninguna de las cinco tablas de transiciones ganó columna de clase; conté sus encabezados. `G-R3-B` sigue sin dominio que recorrer, y ahora hay **nueve transiciones más** en la misma condición (`F-8cA2-009`). |
| `F-8bA2-006` | **SIGUE** | **paso 3**. El reloj de retención y `vertical.fin_de_servicio` siguen sin ser transiciones. Se agrega un tercero, nacido en la 9-bis: el reloj de la marca (`F-8cA2-011`). |
| `F-8bA2-007` | **SIGUE** | **paso 3**. Ningún capítulo declara que `PB1` y `T1` compartan transacción; la fila de `PB1` en `V/03` §9 sigue sin mencionar a `T1`. Con `T6` el problema se **duplica**: son dos transiciones de trial que pueden fallar detrás de la misma publicación. |
| `F-8bA2-010` | **SIGUE a medias** | **paso 3**. Las tres fuentes que faltaban entraron a `V/02` §3.2 (arreglo 4). Lo que sigue llegando es el **segundo consumidor**: `V/15` §4.2 quedó en siete (`F-8cA2-008`). |
| `F-8bA2-011` | **SIGUE, y empeora** | **paso 2**. Sigue sin haber correspondencia estado → fuente **enumerada** del lado de la máquina de suscripción… salvo que ahora **sí la hay**, en `12-contrato…` §2.6, y es del otro lado de la frontera. Lo que sigue es que *«vivo»* nombra dos conjuntos y que `T6` usa el equivocado (`F-8cA2-002`). |
| `F-8A2-005` | **SIGUE** | **paso 5**. Confirmado en esta pasada: no existe ningún barrido periódico que compare publicación contra cobertura. Es lo que convierte a `F-8cA2-001` en permanente. |
| `F-8A2-013` | **SIGUE** | **paso 2**. Verticales sigue sin capítulo de concurrencia, y el dominio creció otra vez: `T1`/`T6` es una carrera **dentro** de la misma tabla. |
| `F-8A2-017` | **SIGUE** | **paso 2**. `G5` se sigue comprobando *«sobre los efectos declarados de las transiciones del capítulo 03»* y la lista que vigila tiene ahora **cinco** entradas que no son transiciones. |

---

## 3. Ataques que intenté y el diseño resistió

1. **Conseguir un segundo trial con `T6`.** Intenté usar `T6` para escribir una segunda fila de
   trial —dispararla sobre alguien que ya consumió el suyo— y no se puede en tres niveles: `T6` sale
   de `PRE_TRIAL`, no hay transición de vuelta a `PRE_TRIAL`, y la `UNIQUE(user_id, vertical)` de
   `V/02` §2.2 rechaza el `INSERT`. El arreglo 8 no abrió esa puerta.
2. **Hacer que `S17` se disparara dos veces sobre la misma sucesión.** La segunda corrida no
   encuentra sujeto: `S17` exige *«la fila tiene una sucesora con `sucede_a` apuntándola»* y el
   primer acto limpia ese `sucede_a`. El efecto es idempotente por construcción, no por candado, que
   es la forma cara pero correcta.
3. **Dejar la sucesión a mitad de camino con `sucede_a` en un tercer valor.** No existe: `B/03` §3.2
   recorre el dominio él mismo —*«no nulo (sucesión en curso) … nulo (sucesión terminada). **No hay
   un tercer estado**»*— y declara el camino de falla (*«Si la cancelación en el proveedor falla,
   `S17` no ocurre: la marca se pone»*). **Es el mejor ejemplo de `DEC-METH-008` bien aplicado que
   encontré en la tanda**: el arreglo recorrió el dominio que creaba y lo escribió.
4. **Encadenar sucesiones —una sucesora sucedida por una tercera.** Cortado por la base sin regla
   extra: `B/02` §2.2 indexa el candado `B` sobre `(user_id, vertical)` y no sobre `sucede_a`, así
   que la tercera colisiona con la segunda. El razonamiento está escrito y es correcto.
5. **Usar `S15` para saltar a un estado arbitrario al resolver una conciliación.** Cerrado: `S15`
   *«no mueve la columna de estado»* y el cambio, si corresponde, *«se ejecuta con la transición de
   esta misma tabla que lo permita»*. Intenté encontrar un estado alcanzable sólo por ahí y no hay
   ninguno.
6. **Reactivar una `CANCEL_SCHEDULED` marcada para colar una sucesión sobre un preapproval vivo.**
   La excepción existe y **lleva relectura obligatoria por id** (`B/02` §2.2, arreglo 17), con el
   argumento explícito de por qué sin ella se apoyaba en lo que la marca pone en duda. Si la
   relectura dice que sigue vivo, bloquea. Cerrado y bien argumentado.
7. **Hacer que una relectura escribiera un estado que la tabla no declara.** El arreglo 18 eligió
   enumerar en vez de declarar una excepción a la regla 1, y esa decisión es la correcta: la
   excepción habría abierto *«un camino que escribe estado sin transición declarada»*. Lo que falla
   es la cobertura de la enumeración (`F-8cA2-004`), no la forma.
8. **Extender un trial ya consumido por `T6` con una cortesía.** Cerrado: `T4` exige `TRIAL_ACTIVE`
   y `T6` aterriza en `TRIAL_CONVERTED`. `V/11` §7 cierra la otra vía. La pérdida de
   `F-8cA2-002` es irreparable, que es lo que la vuelve `CRITICA` — pero no es explotable al revés.
9. **Volver a publicar desde `DRAFT` para consumir otro trial.** `V/11` §1.2 lo resuelve por
   escrito: *«Desde `DRAFT` se vuelve por `PB1` dentro de la ventana que quede, **sin consumir nada
   nuevo**: el trial ya está consumido, lo que corre es su reloj»*. `T1` y `T6` salen de
   `PRE_TRIAL`, así que no alcanzan a nadie en `TRIAL_ACTIVE`.
10. **Hacer que `T6` disparara en Partner** para consumirle el trial a toda la base. Falla cerrado y
    por dato: `T6` comparte el evento con `T1`, y `V/18` §1.5 mide que Partner *«no declara evento de
    activación (`DEC-TRIAL-006`)»*. Sin evento, ninguna de las dos dispara. La defensa es la misma
    que ya resistía para `T1`.
11. **Dejar una fila con la marca puesta fuera del barrido para que el cobro equivocado siguiera
    saliendo.** Cerrado por el arreglo 19, y con el mejor argumento de la tanda: *«lo que se apaga
    así no es el ruido: es el único detector»*. Lo que agregué encima es que ese detector se satura
    solo (`F-8cA2-004`) y que su reloj no tiene mecánica (`F-8cA2-011`), no que la decisión esté
    mal.
12. **Cobrar dos veces durante el corte re-vinculando un preapproval viejo a la suscripción nueva.**
    Cerrado por la lápida (arreglo 21) vía `UNIQUE(proveedor, id_del_proveedor)` en `provider_link`.
    El camino que el §2.5 describe —*«El candidato más plausible del emparejamiento es la suscripción
    nueva de esa misma persona»*— queda cortado porque el id ya tiene dueño. Lo que no funciona es la
    detección temprana (`F-8cA2-014`), no la protección.

---

## 4. Fuera de mi vector

Anotado y no perseguido.

1. **`NUCLEO`** — `NUCLEO/03` §1 tiene seis reglas de lectura y **ninguna resuelve dos transiciones
   declaradas con el mismo (origen, evento)**. `T1`/`T6` es el primer par así del programa
   (`F-8cA2-005`); la regla de precedencia, si se agrega, es del núcleo. **Pasada C.**
2. **`NUCLEO`** — `B/03` §3.1 lista `(sin fila)` como un renglón de la tabla de estados y después
   cuenta *«nueve»* sin él, mientras `NUCLEO/03` §1 regla 2 dice que *«es un estado porque tiene
   reglas declaradas y una salida declarada, no porque tenga fila»*. Es inocuo para la emisión de
   fuente y **no lo es para el espejo**: `authorized` × `(sin fila)` es uno de los 19 pares sin
   veredicto de `F-8cA2-004`. **Pasada C.**
3. **Autorización (A1)** — `V/17` §1.2 cierra con *«Quedan **nueve pasos** y una precondición»* y la
   tabla que sigue tiene **siete** filas numeradas. Dos de los nueve están fundidos (el paso 4
   contiene existencia, estado y dueño). Es un conteo, no un hueco, pero es el conteo con el que se
   verifica que la lista del §13 quedó corregida.
4. **Testing (A1 o C1)** — `V/20` §2 lista los guards y numera `G1`…`G6`, `G8`, `G-R3`, `G-R3-B`,
   `G-R3-C`: **no hay `G7`**. El § se presenta como *«lo que permite preguntar «¿están todos?» una
   vez en vez de siete»*, y un hueco en la numeración es exactamente lo que impide contestarlo.
5. **Testing (A1 o C1)** — **`T6` no aparece en ningún capítulo fuera de `V/03` §2.** Lo verifiqué
   con `rg` sobre los once capítulos de `HOS-1353`: cero apariciones en `11-trial.md`, en
   `20-testing.md` y en `21-migracion.md`. El §5 de `V/20` enumera el E2E de trial —*«activación,
   campaña previa, vencimiento, campaña de recuperación y conversión tardía»*— y la conversión **sin
   trial** no está entre los cinco.
6. **Doble cobro (B1/B2)** — `F-8cA2-003` y `F-8cA2-013` son daños de plata y los reporto porque el
   defecto es de máquina —el sujeto de una condición y una condición que no filtra un estado—. La
   cuantificación del doble cobro es de la pasada B.
7. **La costura (C1)** — la palabra **«vivo»** sigue nombrando dos conjuntos, y desde el arreglo 16
   la distancia entre los dos es **medible**: cuatro de los seis estados «vivos» del candado no
   emiten fuente. `T6` es el primer consumidor que se equivocó de conjunto; no va a ser el último
   mientras la palabra sea una sola.
