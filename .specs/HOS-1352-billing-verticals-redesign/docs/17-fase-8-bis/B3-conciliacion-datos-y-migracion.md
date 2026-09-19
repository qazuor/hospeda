---
title: "FASE 8-bis · B3 — conciliación, datos, migración y acoplamiento"
linear: HOS-1354
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · B3 — conciliación, datos, migración y acoplamiento

Segunda pasada adversarial B3, **sobre el diseño que la FASE 9 produjo**. Mismo vector: el
mecanismo de conciliación, la pérdida de datos, el plan de migración, la retención y el
acoplamiento no declarado entre billing y verticales.

Se recorrió el dominio enumerado de [`15-fase-9/00-dominios-de-los-racimos.md`](../15-fase-9/00-dominios-de-los-racimos.md)
en lo que toca a este vector —los racimos `R1`, `R2` y `R5`—, y se releyeron enteros los 12
capítulos de `HOS-1354`, los cinco informes de resolución de la FASE 9, el contrato de cobertura,
las dos mitades del capítulo 02 y del 21, el §2.1 de `V/02`, el §2.5 de `V/15`, el §3 de `V/11` y
las filas `PA-3`, `PA-5`, `PS-4`, `PS-6`, `GT-1`, `EX-6`, `EX-19`, `EX-20` y `EX-39` de la matriz.

**12 hallazgos nuevos**: 2 `CRITICA`, 6 `ALTA`, 3 `MEDIA`, 1 `BAJA`. **Ocho de los doce los
introdujo un cambio de la FASE 9**, que es el dato que esta pasada existía para producir.

La reejecución de los 19 hallazgos de la FASE 8 está en la §2 y **no cuenta como hallazgos
nuevos**: **6 cortan, 13 siguen llegando** (2 de ellos ya declarados abiertos con su causa).

---

## 1. Hallazgos

### F-8bB3-001 — Una fila con la marca cubre, no se barre y no tiene reloj: el servicio gratis no tiene cota

**Qué se rompe.** Alguien cuya suscripción divergió —el proveedor la canceló, dejó de cobrar, o el
monto quedó mal aplicado— **conserva el servicio entero, indefinidamente, sin que se le cobre**, y
el único mecanismo que podría volver a mirarlo está apagado por regla escrita sobre esa misma fila.
No hay plazo, no hay vencimiento y no hay transición automática: la fila sale del barrido el día que
se marca y vuelve sólo si una persona la toca.

**El camino.**

1. El barrido diario encuentra una divergencia de monto, de estado o de cobro sobre una
   suscripción `ACTIVE`. `S14` **pone la marca y no mueve el estado**: *«divergencia que toca plata
   o estado | **el mismo estado** | **se pone la marca `requiere_conciliación`** (…) **cero
   decisiones destructivas automáticas**»* (`B/03` §3.2).
2. La fila **sigue cubriendo**: *«`requiere_conciliación` es una marca booleana sobre la fila, no un
   estado. La fila conserva el estado que tenía, **y sigue cubriendo a quien estaba cubierto**»*
   (`B/03` §3.1). Como `ACTIVE` es fuente de clase `TÍTULO`, `cubierto` sigue en sí
   (`12-contrato-de-cobertura.md` §2.4) y los entitlements siguen resueltos.
3. A partir de esa corrida **la fila deja de compararse**: *«**Y una fila con la marca
   `requiere_conciliación` puesta tampoco se barre.** No porque no pueda divergir, sino al revés:
   **ya divergió y hay una persona mirándola**»* (`B/09` §3).
4. Esa persona es el único reloj que existe. La salida declarada es `S15` —*«cualquiera **con la
   marca puesta** | una persona resuelve»* (`B/03` §3.2)— y *«Vuelve al barrido cuando `S15` levanta
   la marca»* (`B/09` §3). **Ningún capítulo le pone plazo, ni cuenta la antigüedad de las filas
   marcadas, ni degrada el servicio mientras tanto.** `B/19` §6 pide *«el listado accionable de las
   filas con la marca»* y nada más.
5. Desenlace: la persona usa la plataforma completa y nosotros no cobramos. Si la divergencia era
   que el proveedor canceló su preapproval —medido como posible y terminal en `B/12` §4.4— **no va a
   llegar ningún cobro nunca**, y el barrido, que es el único detector de lo que no emite webhook
   (`EX-15`), tiene prohibido mirarla.
6. Y el disparador no necesita mala fe: `F-8B3-004` —que sigue llegando (§2)— hace que el barrido
   marque cartera sana cuando la recomposición del monto difiere de lo mutado. **Cada falso positivo
   compra servicio gratis ilimitado y se auto-silencia**, porque a partir de la marca deja de
   gritar.

**Dónde lo permite el diseño.**

`HOS-1354/docs/09-conciliacion.md` §3: *«**Y una fila con la marca `requiere_conciliación` puesta
tampoco se barre.** (…) Volver a compararla no agrega información y sí agrega ruido (…) Vuelve al
barrido cuando `S15` levanta la marca»*.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.1: *«La fila conserva el estado que tenía, y sigue
cubriendo a quien estaba cubierto»*; §3.2, `S14` y `S15`.

`HOS-1352/docs/12-contrato-de-cobertura.md` §2.4: *«**`cubierto` se calcula sólo sobre las fuentes
de clase `TÍTULO`»*, y `SUSCRIPCIÓN` es una de las cuatro.

`HOS-1354/docs/02-modelo-de-datos.md` §2.2: *«**La marca no contradice esa razón: la cumple mejor.**
Con la marca la persona **no espera nada**, porque no pierde el servicio que tenía mientras alguien
mira el caso»*.

**Severidad.** `CRITICA` — alguien accede indefinidamente a lo que no está pagando, y el mecanismo
que lo detectaría está apagado sobre esa fila por regla escrita.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**: `D-11` convirtió
`RECONCILIATION_REQUIRED` en marca y `B/09` §3 agregó la exclusión del barrido. El estado viejo
sacaba la fila de los vivos y obligaba a recontratar; la marca la deja adentro, cubriendo, y sin
barrer. El §2.2 de `B/02` argumenta ese cambio sólo desde el lado del candado —*«la fila **ocupa**
el candado en vez de liberarlo»*— y **no evalúa qué pasa con la cobertura ni con el barrido durante
la espera**.

---

### F-8bB3-002 — «No se migra» tiró la única regla que hacía resoluble el id viejo, y el cobro viejo vuelve como huérfano

**Qué se rompe.** Las ocho suscripciones del sistema actual se cancelan en el proveedor y **no se
escribe nada**. Si alguna de las tres con preapproval vivo emite un cobro después del corte —porque
la cancelación se aceptó y no se aplicó, o porque el cobro ya estaba en vuelo—, ese webhook llega
como preapproval desconocido. El sistema nuevo tiene **un solo camino automático** para eso:
re-vincularlo. Y el destino más plausible del emparejamiento es **la suscripción nueva de esa misma
persona**, que acaba de contratar. El cobro viejo se imputa como pago del ciclo nuevo: la persona
pagó dos veces y el sistema registra una.

**El camino.**

1. `D-26` decide *«se arranca de cero»* y `B/21` §2.4 lo escribe: *«**El sistema nuevo no hereda una
   sola fila.**»* y *«se cancelan las ocho y quien tenga algo vivo se suscribe de nuevo»*.
2. `R5` —el informe que resolvió ese racimo— había escrito la regla que ese acto necesita, y la
   escribió **sabiendo exactamente este caso**: *«**`R5-G` · El compromiso viejo se conserva como una
   `subscription` en `CANCELLED` con su `provider_link`, escrita DESPUÉS de cancelarlo en el
   proveedor.** Es lo que hace resoluble para siempre el id del preapproval viejo: **si llega un
   webhook suyo, el barrido del `09` §2.2 lo encuentra y resuelve *«cancelado durante la migración»*
   en vez de *«huérfana»***»*, y dice dónde va: *«Va en `B/21`, en la §2 nueva»*
   ([`15-fase-9/06-R5-resuelto.md`](../15-fase-9/06-R5-resuelto.md) §1.5).
3. **Esa §2 nueva no existe.** `B/21` no contiene `R5-G`, ni `R5-D`, ni el rollback del §5 que la
   misma tabla de *«Qué queda pendiente de aplicar»* enumera. Lo que sí quedó escrito es la frase
   contraria: *«**Todo**: ninguna fila se transcribe (§2.4)»* (`B/21` §4).
4. `R5-G` no perdió sujeto con `D-26`. `D-26` elimina **la migración**; `R5-G` no migraba nada:
   hacía resoluble un id. Y la propia decisión dice qué se elimina —*«Cuatro de los cinco críticos de
   `R5` dejan de existir»*— **sin nombrar `R5-G`**.
5. Sin esa fila, el id viejo no está en nuestro inventario, y el capítulo 09 ya dijo qué significa
   eso: *«guardar ese id deja de ser una comodidad y pasa a ser **la condición de que la
   conciliación exista**. Una suscripción cuyo id se pierde **es invisible para el barrido**, y sólo
   reaparece si cobra y emite un webhook»* (§2.1).
6. Llega el webhook. Es el detector de huérfanas del §2.2 funcionando. Y el §2.4 lo repara solo:
   *«**Sólo se repara el vínculo automáticamente.** Re-vincular una huérfana reescribiendo su
   `external_reference` **no cambia plata ni estado**: sólo dice de quién es»*, sobre una vía medida
   como escribible en vivo (`EX-19`).
7. El emparejamiento sólo puede hacerse por **correo del pagador y estado** (`B/05` §1.2, porque
   `RC-1` mide que el buscador ignora nuestra referencia) — y el pagador del preapproval viejo **es
   la misma persona** que acaba de resuscribirse, porque `D-25` dice que las tres son *«clientes
   contactables»* a las que se les pide exactamente eso. El candidato es único y es el equivocado.
8. A partir de ahí, el cobro viejo entra como pago de la suscripción nueva, le extiende el período
   y **el barrido no lo encuentra**, porque el vínculo existe y es consistente consigo mismo
   (`F-8B3-005`, que sigue llegando).

**Dónde lo permite el diseño.**

`HOS-1354/docs/21-migracion.md` §2.4 y §4, citados arriba; §3.2(a): *«No hay nada que parar ni que
coexistir, y **tampoco nada que transcribir**»* —sobre un plan cuyo primer acto es **cancelar tres
autorizaciones vivas en el proveedor**—.

[`15-fase-9/06-R5-resuelto.md`](../15-fase-9/06-R5-resuelto.md) §1.5 (`R5-G`) y su tabla *«Qué queda
pendiente de aplicar»*, que lista `R5-B`, `R5-D`, `R5-G`, el orden y el rollback como texto a pegar
en `B/21`.

[`15-fase-9/07-decisiones-del-owner.md`](../15-fase-9/07-decisiones-del-owner.md) `D-26`, sección
*«Qué queda sin objeto»*: enumera cuatro hallazgos que se eliminan y **no nombra `R5-G`**.

`HOS-1354/docs/09-conciliacion.md` §2.1, §2.2 y §2.4.

**Severidad.** `CRITICA` — un cobro real que se imputa a otra relación comercial, sobre una persona
que ya pagó, y sin ningún mecanismo que lo encuentre después.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**, y de la forma más cara: la FASE 9
**encontró** la regla que lo evita y la aplicación de `D-26` la tiró junto con la migración que sí
había dejado de hacer falta. El costo de escribirla es tres filas a mano.

---

### F-8bB3-003 — `sucede_a` no se limpia nunca: se cambia de plan una sola vez en la vida de la relación

**Qué se rompe.** Después de un cambio de plan o de ciclo, la fila que queda viva es la **sucesora**
y nada la devuelve a ser origen. El segundo cambio de plan lo rechazan **dos** mecanismos a la vez,
y la única salida que queda —cancelar y recontratar— está cerrada hasta que se agote el período ya
pagado: para un anual, hasta doce meses.

**El camino.**

1. Un cliente mensual pasa a anual. La fila nueva nace con `sucede_a` apuntando a la vieja y entra
   por el candado `B`; la vieja se cancela al llegar el webhook (`D7`). Queda **una sola fila viva,
   `ACTIVE`, con `sucede_a` no nulo**.
2. **Ningún capítulo limpia esa columna.** `B/02` §2.2, `B/03` §3.2 (`S1`, `S2`) y `05-R1-resuelto`
   §2 describen cómo se **escribe** `sucede_a` y nunca cómo se apaga. La columna es *«FK anulable a
   `subscription`»* y su nulidad se usa como predicado de índice, no como estado que evolucione.
3. Seis meses después el cliente quiere subir de plan. La fila nueva declararía `sucede_a` = la
   sucesora viva. **El candado `B` la rechaza**: *«a lo sumo UNA fila principal **sucesora** viva por
   `user + vertical`»*, y el capítulo lo declara como propiedad buscada — *«una sucesora **no puede
   ser sucedida mientras viva**, sin ninguna regla extra, porque la segunda sucesora colisiona con la
   primera»*.
4. Y aunque el candado no estuviera, **el guard lo prohíbe igual**: *«`G-R1-A` — ninguna fila con
   `sucede_a` no nulo apunta a una predecesora fuera de `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`,
   **ni a una que a su vez tenga `sucede_a` no nulo**»*.
5. Declararla como origen tampoco entra: con `sucede_a IS NULL` la ve el candado `A`, y la sucesora
   viva ocupa… no: la sucesora tiene `sucede_a` no nulo, así que `A` está libre y **el `INSERT`
   entra**. El resultado es peor que el bloqueo: **dos compromisos principales vivos con dos
   preapprovals autorizados**, que es exactamente lo que el §11 y `EX-6` existen para impedir, y el
   §11 queda violado sin que ninguna clave lo vea.
6. La salida limpia es cancelar y volver a contratar. `S11` lleva a `CANCEL_SCHEDULED`, que **está
   entre los seis vivos**, así que el candado `A` rechaza el alta nueva hasta que llegue `S12` —o
   sea hasta el fin del período pagado—. Y el crédito de `DEC-SUB-006` no se aplica, porque no hay
   sucesión: el cliente pierde lo pagado sin usar.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.2: los dos índices parciales, *«**El máximo de filas
principales vivas pasa de una a dos, y no a un número abierto.** Dos, exactamente: un origen y su
única sucesora»* y *«**una sucesión no es una cadena**: al indexar `B` sobre `(user_id, vertical)`
(…) una sucesora no puede ser sucedida mientras viva»*.

[`15-fase-9/05-R1-resuelto.md`](../15-fase-9/05-R1-resuelto.md) §2, `G-R1-A`.

`HOS-1354/docs/03-maquinas-de-estado.md` §3.3: *«una sucesora **no puede ser sucedida mientras
viva** (el candado `B` la rechaza sin ninguna regla extra)»*, y la fila *«`CANCEL_SCHEDULED` →
`ACTIVE` | arrepentirse **no es una transición: es una sucesión**»* — que después del primer cambio
tampoco es ejecutable.

`HOS-1354/docs/02-modelo-de-datos.md` §2.2, lista de vivos: `CANCEL_SCHEDULED` incluido.

**Severidad.** `ALTA` — no es `CRITICA` por el criterio declarado: nadie paga de más por esto sin
elegirlo. Pero bloquea de por vida la operación que todo el racimo `R1` existe para habilitar, y la
rama del paso 5 deja dos autorizaciones vivas.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** El candado partido de `D-13` resolvió
la ventana de **una** sucesión y trató *«una sucesora no puede ser sucedida»* como una garantía
gratis. Lo es mientras la sucesión dure horas; deja de serlo en cuanto la sucesora **es** la
suscripción del cliente por años. El dominio de 90 pares
([`15-fase-9/05-R1-resuelto.md`](../15-fase-9/05-R1-resuelto.md) §4) recorre *«la fila existente está
en X»* por **estado**, y `sucede_a` no es un estado: por eso el par *(sucesora `ACTIVE`, `C2`/`C3`)*
no aparece en ninguna de las diez tablas.

---

### F-8bB3-004 — `S16` cuenta por `user + vertical` y el proveedor cancela por preapproval: la sucesora rechazada queda viva con una autorización muerta

**Qué se rompe.** Un cliente que venía pagando cambia de plan, y el primer cobro de la suscripción
nueva se rechaza. El proveedor **cancela ese preapproval de forma terminal** en el mismo
milisegundo. Nuestra máquina, en cambio, tiene prohibido usar `CHARGE_DECLINED` para él —porque la
condición mira los pagos del `user + vertical` y ese cliente **sí pagó antes**— y lo manda a
`GRACE_PERIOD`. Queda una fila viva, cubriendo, colgada de una autorización que no puede cobrar
nunca, y cuya salida declarada (`S7`, *«el cobro entró de verdad»*) es inalcanzable.

**El camino.**

1. `S16` sólo dispara con *«**ningún pago acreditado antes** para ese `user + vertical`»*
   (`B/03` §3.2), y `B/12` §4.5.1 lo subraya: *«**«Ningún pago acreditado» se cuenta por `user +
   vertical`, no por suscripción.**»*
2. El hecho del proveedor, en cambio, es **por preapproval**: *«sobre una suscripción cuyo **primer**
   cobro fue rechazado, el proveedor **cancela la suscripción en el mismo instante** (…) y esa
   cancelación es **terminal**: `PUT {status:"authorized"}` devuelve `400 "Invalid transition from
   cancelled to authorized"`»* (`B/12` §4.4). Para la sucesora, ese cobro **es** su primer cobro.
3. Entonces la sucesora no puede ir a `CHARGE_DECLINED` y va a `GRACE_PERIOD` por `S4`. El reloj
   arranca cuando el proveedor deja de reintentar (`B/12` §1.2) — que ya pasó, porque canceló.
4. Diez días después, `S6` la lleva a `SUSPENDED`. `S7` pide *«el cobro entró de verdad»* y el
   preapproval está cancelado de forma terminal: **no hay camino de vuelta en la tabla**.
5. Mientras tanto el barrido compara estado: el proveedor dice `cancelled`, nosotros
   `GRACE_PERIOD`, y no existe la transición `GRACE_PERIOD → CANCELLED`, así que *«se pone la
   **marca**»* (`B/09` §3). Con la marca puesta, la fila **deja de barrerse y sigue cubriendo**
   (F-8bB3-001) **y no puede declarar una sucesión** (`B/02` §2.2), así que el cliente tampoco puede
   reintentar por el camino del cambio de plan.
6. Y el §5.3 de `B/12` lo agrava: la cuota de la **predecesora** sigue en `recycling` y *«puede
   entrar»*. O sea que este cliente puede terminar pagando la deuda perdonada de una suscripción
   cancelada mientras la sucesora que sí quiso contratar está muerta del lado del proveedor.

**Dónde lo permite el diseño.**

`HOS-1354/docs/03-maquinas-de-estado.md` §3.2, `S16` y su condición; `S4`, `S6`, `S7`.

`HOS-1354/docs/12-suscripcion.md` §4.4 (la medición del 2026-09-17) y §4.5, precisión 1.

`HOS-1354/docs/09-conciliacion.md` §3, fila *«estado»*: *«**no se escribe el del proveedor**: se
evalúa la transición contra la tabla del cap. 03. Si no existe, se pone la **marca**»*.

**Severidad.** `ALTA` — deja a un cliente que pagó sin servicio recuperable y con una fila viva que
nadie puede mover sin intervención humana. No es `CRITICA` porque no produce por sí sola un cobro
indebido.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `CHARGE_DECLINED` (`S16`) y la sucesión
(`sucede_a`) entraron en la misma pasada y **no se cruzaron entre sí**: la condición de `S16` se
copió tal cual de `B/12` §4.3, que la escribió para un **alta**, donde *«por `user + vertical`»* es
la lectura correcta. Sobre una sucesión, esa misma redacción excluye justo el caso en que el hecho
del proveedor ocurre.

---

### F-8bB3-005 — El trinquete del grant no tiene por dónde cruzar la frontera

**Qué se rompe.** El grant permanente promete *«nunca otorga menos de lo que otorgaba el día que se
concedió»*. Ese piso vive en una columna de **billing** y la comparación se hace en **verticales**,
y el contrato —lo único que cruza— transporta **una sola referencia por fuente**. O el trinquete no
se aplica nunca —y el beneficiario de un *Free Forever* pierde en silencio lo que se le prometió
para siempre el día que el plan publica una versión que reparte distinto—, o billing emite dos
fuentes y entonces `SUMA` **duplica todos los limits acumulables** del beneficiario.

**El camino.**

1. `B/02` §2.4 crea **dos** columnas no anulables sobre `permanent_grant`: *«**el `plan` que
   otorga**»* y *«**el piso del trinquete**»*, esta última *«**la referencia a la versión que estaba
   vigente el día que se firmó**, nunca una copia de sus valores»*.
2. La comparación la hace verticales: *«Se compara igual que el del trial —al final, y sólo puede
   subir el resultado—»* (`V/15` §2.5), dentro de la resolución del conjunto efectivo, que es de esa
   épica (`DEC-ARCH-005`).
3. Para compararlo, verticales necesita **las dos referencias**: la vigente y el piso. El contrato
   sólo tiene un campo: *«`referencia: versiónDePlan | versiónDeAddon ← NO anulable`»*
   (`12-contrato-de-cobertura.md` §2), singular, *«una versión de plan o una versión de addon»*
   (§2.1). **No hay slot para el piso**, y el §4 cierra la puerta por el otro lado: *«**Nada más
   cruza la frontera**»* y *«No cruzan **los valores** de lo que otorga una fuente (…) Sólo la
   referencia»*.
4. Rama A — no se emite el piso: el trinquete **no existe** en el sistema. La columna se escribe, la
   promesa no se cumple, y nada lo denuncia, porque el resultado es un conjunto de entitlements
   plausible.
5. Rama B — billing emite el piso como una segunda fuente `GRANT`: el contrato dice que `fuentes` son
   *«**todas** las fuentes vivas»* (§2.2) y `V/15` §2.2 define `SUMA` como *«suma **todas** las
   fuentes vivas»*. Dos fuentes con el mismo plan detrás **duplican fotos, fichas y destaques**. Es un
   fail-open, y la dirección cara: no falla ruidosamente, regala.
6. El mismo hueco alcanza al piso del trial, con una diferencia que lo salva: ése vive en
   `trial` (`V/02` §2.2), **tabla de verticales**, y nunca cruza la frontera. El del grant es el único
   que tiene que cruzarla y no puede.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §2 (el bloque de la respuesta), §2.1, §2.2, §2.8 —*«El
grant se ancla al PLAN (…) **con un trinquete**»*— y §4.

`HOS-1354/docs/02-modelo-de-datos.md` §2.4: *«**`permanent_grant.piso_del_trinquete`** — la
referencia a la versión que estaba vigente el día que se firmó»*.

`HOS-1353/docs/15-entitlements-y-limits.md` §2.5: *«**El trinquete tiene un segundo sujeto, y es el
mismo mecanismo.** (…) Su piso es **lo que ese plan otorgaba el día que se firmó el grant**,
**guardado en la fila**»* — y la fila está del otro lado de la frontera.

**Severidad.** `ALTA` — la rama A incumple una promesa comercial en silencio y la rama B duplica
límites. No la marco `CRITICA` porque el diseño **no obliga** a la rama B: la deja sin decidir.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `D-05` (el grant anclado al plan con
trinquete) y `D-06`/§2.3 (la referencia única y no anulable) se decidieron en la misma pasada y
sobre el mismo racimo `R2`. La tabla de cierre de
[`15-fase-9/02-R2-resuelto.md`](../15-fase-9/02-R2-resuelto.md) §4 da por cerrado el par
*(`GRANT`, `versiónDePlan`)* **sin haber recorrido el par *(`GRANT`, el piso)***, que la misma
decisión acababa de crear.

---

### F-8bB3-006 — `UNIQUE(plan_id) WHERE vigente` no garantiza existencia: el «no anulable» mueve el nulo, no lo cierra

**Qué se rompe.** Toda la defensa nueva del contrato —*«una fuente sin referencia resoluble no se
puede expresar»*— se apoya en que *«la vigente»* de un plan **siempre existe**, y lo que se cita
para sostenerlo es una restricción de **unicidad**, que por construcción no puede garantizar
existencia. Un `permanent_grant` con `plan_id` escrito y cero versiones vigentes tiene la columna
llena y la referencia irresoluble: es exactamente el caso que la columna vino a eliminar, un salto
más adelante y sin ninguna restricción que lo ataje.

**El camino.**

1. El contrato afirma: *«`UNIQUE(plan_id) WHERE vigente` garantiza que *«la vigente»* es unívoca **y
   siempre existe**, así que la referencia nunca queda sin resolver (§2.3)»*
   (`12-contrato-de-cobertura.md` §2.8, punto 1), y `B/02` §2.4 lo repite palabra por palabra.
2. Un índice único parcial garantiza *«**a lo sumo** una»*. **Cero filas lo satisfacen
   perfectamente.** La afirmación de existencia no la sostiene ninguna restricción declarada en
   `V/02` §2.1, que lista esa misma `UNIQUE` y ninguna otra sobre `vigente`.
3. Escenarios con cero vigentes, todos dentro del diseño: un `plan` creado y todavía sin versión
   publicada —`plan` *«muta libremente»* y `plan_version` es otra tabla—; una publicación que escribe
   la versión nueva y apaga la vieja en dos pasos; un retiro mal ejecutado que apaga el flag en vez
   de publicar una versión no vendible (`B/10` §3.3 es el único que dice cómo se retira, y es una
   convención de procedimiento, no una restricción).
4. Con cero vigentes, el grant responde una fuente `GRANT` cuya referencia no resuelve. Las dos
   ramas que el §2.3 dice haber eliminado vuelven enteras: *«fallar cerrado la deja decorativa
   —cubre y no otorga nada—, fallar abierto la vuelve «toda clave de la vertical»»*. Con la defensa
   §6.1 (*«el default es negar»*), el beneficiario de un *Free Forever* queda **cubierto y sin una
   sola capacidad**, sin que nada avise.
5. El mismo agujero alcanza a `piso_del_trinquete` y a `courtesy_grant.subscription_id`: las tres
   columnas son *«no anulables»* y ninguna de las tres tiene declarado qué pasa cuando la fila
   apuntada deja de resolver a algo útil. **`B/02` §4.1 no clasifica ninguna de las tres entidades**
   para retención (`F-8B3-013`, que sigue llegando), así que tampoco hay nada que impida que la fila
   apuntada se borre.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §2.8, punto 1, y §2.3: *«**Una fuente sin referencia
resoluble no se puede expresar.**»*

`HOS-1354/docs/02-modelo-de-datos.md` §2.4: *«`UNIQUE(plan_id) WHERE vigente` garantiza que esa
versión es unívoca y siempre existe»*.

`HOS-1353/docs/02-modelo-de-datos.md` §2.1, fila `plan_version`: *«**`UNIQUE(plan_id) WHERE
vigente`** — cada plan tiene exactamente una versión vigente»*, que es la lectura que la restricción
no puede sostener.

**Severidad.** `ALTA` — deja sin capacidades a quien tiene el instrumento más fuerte del diseño, y
lo hace por la vía silenciosa. Se arregla con un mecanismo de publicación atómico y un guard de
catálogo, no con un rediseño.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**: la afirmación de existencia nació con
`D-05` y con la referencia no anulable de `R2`. Antes el campo simplemente no existía.

---

### F-8bB3-007 — `courtesy_grant.subscription_id` no anulable vuelve inescribible la cortesía durante el trial

**Qué se rompe.** El PDR §34.1 tiene una cortesía que se otorga **durante el trial**, y `V/11` §3 la
trata como instrumento vivo: acumula contra el mismo techo que las extensiones de promo. Durante un
trial **no hay suscripción** —lo dice el propio capítulo de addons— y la columna nueva no admite
nulo. La fila no se puede escribir, y el instrumento que `V/11` §3.2 usa para acotar el techo de
días deja de existir del lado de billing sin que ningún capítulo lo diga.

**El camino.**

1. `V/11` §3.1: *«el §26 prohíbe pausar un trial, el §32 permite extenderlo N días con un promo y **el
   §34.1 dice que una cortesía durante el trial también lo extiende**»*, y §3.2 la hace contar
   contra el techo: *«Toda extensión cuenta contra ese mismo techo, venga de un promo del §32 o de
   **una cortesía del §34.1**»*.
2. `B/16` §2.2 dice que durante el trial no hay suscripción: la fila *«trial, sin suscripción»* está
   en la tabla con **no**.
3. `B/02` §2.4: *«**`courtesy_grant`** | beneficiario, scope, días o meses, inicio, fin, quién lo
   firmó, motivo, **la suscripción que pausa** | (…) la suscripción **no es anulable**»*.
4. La justificación del cambio razona sólo sobre el mecanismo de `DEC-GRANT-003`: *«Las dos frases
   dicen que **una cortesía presupone una suscripción**»*
   ([`15-fase-9/02-R2-resuelto.md`](../15-fase-9/02-R2-resuelto.md) §2.3). Es cierto **para la
   cortesía del §34 sobre una suscripción viva**, y falso para la del §34.1, que no pausa nada
   porque no hay nada que cobrar: extiende una fecha.
5. Desenlace: o no se puede otorgar —y `V/11` §3.2 queda contando contra un techo un instrumento que
   no existe—, o alguien la escribe apuntando a cualquier suscripción para satisfacer la
   restricción, y entonces la referencia que el `tipo: CORTESÍA` transporta apunta a una versión de
   plan que no tiene nada que ver con lo que se otorgó.

**Dónde lo permite el diseño.**

`HOS-1353/docs/11-trial.md` §3.1 y §3.2, citados arriba; §2.3, que usa la cortesía como reparación
*«sobre la suscripción que tome después»* —el caso que sí tiene suscripción, y que es el que el
cambio miró—.

`HOS-1354/docs/16-addons.md` §2.2, fila *«trial, sin suscripción»*.

`HOS-1354/docs/02-modelo-de-datos.md` §2.4.

**Severidad.** `ALTA` — es una fila que no se puede escribir para un instrumento que dos capítulos
de la otra épica dan por existente y por acotado.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**: `E-4` de `R2` agregó la columna y la
declaró no anulable en el mismo movimiento, recorriendo el dominio de la cortesía **sobre
suscripción** y no el del §34.1.

---

### F-8bB3-008 — La dirección inversa dice seis campos, enumera siete, y billing lee tres cosas más — una de ellas es la que el §4 prohíbe cruzar

**Qué se rompe.** La mitad del contrato que la FASE 9 escribió para cerrar el acoplamiento **no
cubre las lecturas que hoy ya están escritas en los capítulos de billing**. La más grave es el
delta de entitlements y limits entre dos versiones de plan: `B/10` §3.5 lo necesita para decidir si
un cambio es upgrade o downgrade, y el mismo §4.1 que declara la dirección inversa dice que eso
**no cruza**. Sin él, la operación de cambiar de plan en un plan retirado no tiene forma de
resolverse; con él, el corte en dos épicas no existe.

**El camino.**

1. La declaración: *«`políticaDePlan(versiónDePlan) → { díasDeGrace, díasDeTrial, permitePausa,
   vigente, vendible }`»* y *«`situaciónDeVertical(vertical) → { admiteAltas, finDeServicio }`»*
   (`12-contrato-de-cobertura.md` §4.1). **La firma enumera siete nombres; el texto dice «Son seis
   campos»** —cuenta `vigente`/`vendible` como uno— y la regla de vigilancia del §4.2 se escribe
   contra *«los seis campos del §4.1»*. Un control que se aplique contando no va a coincidir con el
   que se aplique leyendo.
2. **Lectura no declarada 1 — el delta.** `B/10` §3.5: *«**si algo baja** —un limit, un entitlement,
   una cuota de un entitlement medido— el cambio sigue el camino de downgrade»*. Eso es comparar
   `plan_version_entitlement` y `plan_version_limit` de dos versiones, tablas de verticales. Y §4.1
   declara lo contrario en su propia conclusión: *«los entitlements y los limits siguen sin cruzar
   hacia billing»*.
3. **Lectura no declarada 2 — `rank`.** La dirección de un cambio de plan sale del `rank` en el caso
   normal (`B/10` §3.5 es la excepción *«su versión no participa del `rank`»*), y `rank` es columna
   de `plan_version` (`V/02` §2.1). No está entre los seis.
4. **Lectura no declarada 3 — resolver la vigente a partir del PLAN.** El grant *«resuelve la versión
   vigente de ese plan»* (`B/02` §2.4). La única función declarada toma **una versión** y devuelve
   política: no hay `versiónVigenteDe(plan)`. La operación central del instrumento más fuerte del
   diseño no tiene forma declarada de cruzar.
5. Y dos dependencias estructurales que ninguna de las dos funciones expresa:
   `billing_option` lleva `UNIQUE(plan_version_id, ciclo)` y `addon_product.version_id` es *«no
   anulable»* hacia `addon_version` — dos claves foráneas de billing hacia tablas de verticales
   (`B/02` §2.1 y §2.4).
6. O sea que la regla de vigilancia —*«si billing necesita leer de verticales algo que no está en los
   seis campos del §4.1, vale lo mismo»* (§4.2)— **se dispara tres veces el mismo día en que se
   escribe**, igual que el §4.2 en la otra dirección ya se había disparado cinco veces según
   `F-8B3-009`.

**Dónde lo permite el diseño.**

`HOS-1352/docs/12-contrato-de-cobertura.md` §4.1 (las dos firmas, *«Son seis campos»*) y §4.2.

`HOS-1354/docs/10-verticales-planes-billing-options.md` §3.5.

`HOS-1354/docs/02-modelo-de-datos.md` §2.1 (`billing_option`) y §2.4 (`addon_product`,
`permanent_grant`).

`HOS-1353/docs/02-modelo-de-datos.md` §2.1, fila `plan_version`.

**Severidad.** `ALTA` — deja una operación declarada (`B/10` §3.5) sin datos para ejecutarse y deja
el acoplamiento real fuera del único documento que lo vigila.

**¿Es nuevo, o es el arreglo?** **Es mitad y mitad.** El acoplamiento lo reportó `F-8B3-009`; el
arreglo (`D-06`) cerró dos de sus columnas y **declaró cerrado el resto**, cuando las lecturas de
`B/10` §3.5 ya estaban escritas desde el 2026-09-18. La lectura del delta es lo nuevo: sólo se
vuelve contradicción **porque ahora existe un §4.1 que declara qué puede cruzar**.

---

### F-8bB3-009 — `CORTESÍA` y `SUSCRIPCIÓN` transportan la misma referencia sobre la misma fila, y nada dice que se excluyan

**Qué se rompe.** Durante una cortesía, la suscripción sigue existiendo, `PAUSED` con motivo
`COURTESY`, y el `courtesy_grant` apunta a ella. Las dos fuentes transportan **la misma referencia**.
Si las dos entran en la lista —que es lo que el contrato dice que la lista contiene—, todo limit de
familia `SUMA` se duplica mientras dure la cortesía: el beneficiario publica el doble de fichas y
sube el doble de fotos, y vuelve a la mitad el día que la cortesía termina.

**El camino.**

1. `B/02` §2.4: *«la referencia que transporta el `tipo: CORTESÍA` es **la versión anclada de la
   suscripción que pausa** — **la misma que llevaría `SUSCRIPCIÓN`**»*.
2. El contrato define `fuentes` como *«**todas** las fuentes vivas, de las tres clases, no la que
   manda»* (§2.2), y no declara en ningún lado que una fila de `subscription` produzca **a lo sumo
   una** fuente, ni que `CORTESÍA` reemplace a `SUSCRIPCIÓN`.
3. `V/15` §2.2 define la agregación sin excepciones: *«`SUMA` | **suma todas las fuentes vivas** |
   fotos, fichas, destaques»*.
4. Desenlace: el conjunto efectivo de alguien en cortesía duplica cada clave acumulable. En las que
   no acumulan no se nota (`MÁXIMO` de dos iguales es el mismo), así que el error **es invisible
   salvo en las tres claves que más cuestan**.
5. La rama opuesta también está sin decidir y también rompe: si la cortesía **reemplaza** la fuente
   de suscripción, entonces una `PAUSED` por `COURTESY` tiene una sola fuente y el aviso del §6.3 de
   `V/15` —*«el aviso de qué se pierde»*— no puede distinguir *«se te terminó la cortesía»* de *«se
   te terminó la suscripción»*, que es justo lo que el `tipo` existe para decir.

**Dónde lo permite el diseño.**

`HOS-1354/docs/02-modelo-de-datos.md` §2.4, viñeta de `courtesy_grant.subscription_id`.

`HOS-1352/docs/12-contrato-de-cobertura.md` §2.2 y §2.1 (fila `fuentes`).

`HOS-1353/docs/15-entitlements-y-limits.md` §2.2.

**Severidad.** `ALTA` — es acceso a capacidades que no corresponden, pero la ambigüedad es de una
frase y se cierra declarando la exclusión; no obliga a rediseñar nada.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Antes de `E-4`, `CORTESÍA` no tenía
referencia y el solapamiento no era expresable. Al darle **la misma** referencia que `SUSCRIPCIÓN`
sin declarar la exclusión, la duplicación quedó disponible.

---

### F-8bB3-010 — Las dos `comp` que `B/21` manda escribir como `permanent_grant` no se pueden escribir, y el §4 del mismo capítulo dice que no se escriben

**Qué se rompe.** El capítulo de migración afirma tres cosas incompatibles en cuatro páginas: que no
se transcribe **ninguna** fila, que las dos cortesías del owner **se escriben como
`permanent_grant`**, y —vía el modelo— que un `permanent_grant` necesita dos referencias no
anulables que el día de la migración no existen o no significan nada.

**El camino.**

1. `B/21` §2.4 titula *«**No se migra**: se cancelan las ocho»* y declara *«**El sistema nuevo no
   hereda una sola fila.**»*, y dos párrafos después: *«**Las dos cortesías se escriben como
   `permanent_grant`**, exactamente como el *Free Forever* del diseño nuevo»*.
2. `B/21` §4 cierra la contradicción del lado equivocado: *«**Todo**: ninguna fila se transcribe
   (§2.4)»*.
3. Escribirlas exige `plan_id` **no anulable**. Las dos `comp` del sistema actual no tienen plan del
   catálogo nuevo: el catálogo lo siembra la implementación, y `06-R5-resuelto` §1.5 ya midió el caso
   gemelo —*«las versiones vigentes al arrancar eran las del 2026-08-27 y el 2026-09-01 — y **no
   existen**»*—.
4. Y exige `piso_del_trinquete` **no anulable**, definido como *«la referencia a la versión que estaba
   vigente **el día que se firmó**»*. Esas cortesías se firmaron bajo el sistema viejo. La regla que
   resolvía exactamente esto —`R5-F`: *«El piso del trinquete de una fila migrada es el catálogo
   vigente el día de la migración»*— **se escribió para `trial` y sólo se aplicó a `V/21`**; el
   `permanent_grant` no la tiene.
5. Desenlace práctico: quien ejecute la migración va a inventar los dos valores, y el trinquete de
   esas dos cortesías va a decir algo que nadie decidió.

**Dónde lo permite el diseño.**

`HOS-1354/docs/21-migracion.md` §2.4 y §4.

`HOS-1354/docs/02-modelo-de-datos.md` §2.4, fila `permanent_grant`: *«ídem; el plan **no es
anulable**»*, y la viñeta del piso.

[`15-fase-9/06-R5-resuelto.md`](../15-fase-9/06-R5-resuelto.md) §1.5, `R5-F`.

**Severidad.** `MEDIA` — son dos filas, del propio owner, regenerables; pero el capítulo se
contradice a sí mismo sobre el único acto de escritura que le queda, y la restricción que lo bloquea
es de la base.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo**, las dos mitades: `D-24` mandó escribir
las dos `comp` como grants y `D-05` volvió no anulables las dos referencias, en la misma pasada y
sin cruzarse.

---

### F-8bB3-011 — El umbral que hace caducar «no se migra» no está en ningún capítulo, su cita apunta a un § que no lo dice, y el que manda no se aplicó

**Qué se rompe.** La decisión de no migrar es válida *«mientras sean pocas»*, y lo único que
vigila esa condición es una promesa verbal. El número que la acota no está en ninguno de los dos
capítulos de migración de forma citable, y el umbral que la FASE 9 declaró **el que manda** —si
alguna fila ya cobró— no se aplicó a ningún archivo. El 2026-09-26, dentro de una semana, es la
fecha agendada en que ese umbral se cruza solo.

**El camino.**

1. `B/21` §3.3 dice: *«hoy son 8 y el umbral medido está en unas 20 **(§2.4)**»*. El §2.4 de ese
   archivo **no contiene ningún umbral**; el número vive en `V/21` §2.4, la otra épica, en un
   capítulo que el lector de billing no tiene por qué abrir.
2. `V/21` §2.4 lo llama *«el umbral **medido**»*. Lo medido en §2.3 son *«tres llamadas y dos cuentas
   propias»*; el veinte sale de un razonamiento de `06-R5-resuelto` §7.1 —*«los pasos 6 a 9 se
   ejecutan fila por fila y en serie»*—, que es un argumento, no una medición. Llamarlo medido lo
   blinda contra la revisión que sí necesita.
3. `06-R5-resuelto` §7.1 declara que ése **no es el umbral que manda**: *«**El umbral real no es
   cuántas filas hay: es si alguna ya cobró.** Con cero pagos, migrar es escribir títulos y volver a
   pedir un consentimiento. Con un pago, migrar pasa a incluir **una serie de comprobantes sin
   huecos**, que es lo único de todo el modelo que no se puede reconstruir después ni escribir a mano
   sin romper su propia restricción»*. **Ese párrafo no está en `B/21` ni en `V/21`.**
4. `B/21` §1.3 fija la re-verificación *«antes de implementar nada de FASE 10»* — o sea **después**
   del momento en que la decisión habría que rediscutirla, porque la cohorte crece durante el
   rediseño (`DEC-MIG-002`) y la FASE 10 es el final.
5. La única vigilancia declarada es *«el aviso que el owner ya se comprometió a dar — *si veo que
   empiezan a entrar registros nuevos, te aviso*»* (`V/21` §2.4). No hay consulta agendada, no hay
   conteo, no hay alarma.
6. Y `B/21` §3.3 **sigue declarando abierta** la decisión que `DEC-MIG-002` cerró el 2026-09-19
   —*«la única que este capítulo abre en vez de cerrar»*—, que es la mitad de `F-8B3-018` que sigue
   llegando.

**Dónde lo permite el diseño.**

`HOS-1354/docs/21-migracion.md` §1.3, §3.3 y §2.4.

`HOS-1353/docs/21-migracion.md` §2.3 y §2.4.

[`15-fase-9/06-R5-resuelto.md`](../15-fase-9/06-R5-resuelto.md) §7.1.

**Severidad.** `MEDIA` — no falla sola. Pero es la condición de caducidad de una decisión de
arquitectura, y hoy depende de que una persona se acuerde de mirar un número que ningún documento
deja consultable.

**¿Es nuevo, o es el arreglo?** **Nuevo sobre el arreglo**: el umbral nació con `D-26`. La mitad de
`F-8B3-018` que sigue llegando está marcada como tal en la §2 y no se cuenta dos veces.

---

### F-8bB3-012 — `plan_version` no lista la columna `vigente` que su propia restricción y el contrato leen

**Qué se rompe.** La columna sobre la que se apoyan el retiro de un plan, la pricing, la resolución
del grant y un campo declarado del contrato **no figura entre los campos de la entidad**. Quien
implemente leyendo el capítulo 02 —que por la regla del índice es el único lugar donde una entidad
se define— crea la tabla sin ella.

**El camino.**

1. `V/02` §2.1: *«**`plan_version`** | lo que tiene efecto y por eso **es inmutable**: `rank`, si es
   vendible, días de grace, días de trial, si permite pausa, si hereda Turista VIP»*. **No hay
   `vigente`.**
2. La misma fila la usa en sus restricciones: *«**`UNIQUE(plan_id) WHERE vigente`**»* y
   *«**`UNIQUE(vertical, rank) WHERE vendible AND vigente`**»*.
3. El contrato la declara como campo que cruza: *«`políticaDePlan(versiónDePlan) → { …, **vigente**,
   vendible }`»* (§4.1), y `D-06` dice que **ése** era el campo que decidía si el acoplamiento se
   cortaba.
4. Es el mismo patrón que `F-8B3-019` señaló en el núcleo (`outbox` y su `ocurrencia`, que sigue sin
   figurar), y por eso vale reportarlo: dos capítulos 02 distintos declaran una `UNIQUE` sobre una
   columna que su propia tabla no enumera.

**Dónde lo permite el diseño.**

`HOS-1353/docs/02-modelo-de-datos.md` §2.1, fila `plan_version`.

`HOS-1352/docs/12-contrato-de-cobertura.md` §4.1.

**Severidad.** `BAJA` — falta precisión, el mecanismo está definido en tres lugares y sólo hay que
reflejarlo en el modelo.

**¿Es nuevo, o es el arreglo?** **Nuevo sobre el arreglo**: `vigente` entró como campo del contrato
con `D-06` y como sostén del grant con `D-05`; hasta entonces era sólo un predicado de índice.

---

## 2. Los 19 hallazgos de la FASE 8, reejecutados sobre el texto nuevo

**No son hallazgos de esta pasada.** Se reejecutó cada camino paso por paso contra el texto de hoy.

| id | veredicto | dónde corta, o por qué sigue llegando |
|---|---|---|
| `F-8B3-001` · el `UNIQUE` vuelve imposible el cambio de plan | **CORTA** | **paso 3**: la fila nueva declara `sucede_a` y entra por el candado `B` (`B/02` §2.2). Pero ver `F-8bB3-003`: corta una vez, no dos |
| `F-8B3-002` · el candado de C5 no se puede construir | **SIGUE** | entero. `payment` sigue sin columna de período y `manual_payment` sigue siendo otra tabla (`B/02` §2.3); `B/05` §2 C5 sigue declarando la `UNIQUE`. **Declarado abierto con su causa** (cap. 13, `R1` #9) |
| `F-8B3-003` · el cobro de única vez de un addon no tiene fila | **SIGUE** | `B/16` §1.3 conserva la casilla y `B/02` §2.3 conserva `payment` colgando de una suscripción. **Declarado abierto con su causa** (cap. 13) |
| `F-8B3-004` · el precio efectivo no vive en ninguna tabla | **SIGUE** | **paso 2**: `subscription` ganó tres columnas y **ninguna es el monto**; `promo_redemption` sigue sin contador. **Agravado**: por `B/09` §3, el falso positivo del paso 5 ahora además **saca la fila del barrido** (F-8bB3-001) |
| `F-8B3-005` · la re-vinculación no tiene regla de emparejamiento | **SIGUE** | `B/09` §2.4 no cambió una palabra. **Agravado** por `F-8bB3-002`: la cancelación de las ocho crea candidatos nuevos |
| `F-8B3-006` · la migración deja los compromisos sin vínculo | **NO LLEGA** | **paso 1**: `D-26` eliminó la transcripción. Su consecuencia reaparece por otra puerta en `F-8bB3-002` |
| `F-8B3-007` · el contrato no transporta ni addon ni grant | **CORTA** | **paso 3**: `permanent_grant.plan_id` da la referencia del `GRANT`, y `ADDON` entró como `tipo` con `alcance`/`objetivo` (contrato §2, §2.7). Queda el residuo del piso: `F-8bB3-005` |
| `F-8B3-008` · el addon huérfano cae donde el barrido no mira | **SIGUE** | **paso 4** intacto: `B/09` §3 sigue diciendo *«los estados terminales no se barren»* y `B/16` §4.3 sigue diciendo que el barrido lo ve. **Agravado**: los terminales ahora son tres y las filas marcadas tampoco se barren |
| `F-8B3-009` · billing lee tablas de verticales | **SIGUE** | **corta en los pasos 3-4** —las dos columnas de `vertical` existen (`V/02` §2.1)— y **sigue llegando en los pasos 1, 2 y 5** por tres lecturas no declaradas: ver `F-8bB3-008` |
| `F-8B3-010` · el aumento programado no tiene entidad | **SIGUE** | entero. Las tres columnas nuevas de `subscription` no incluyen precio, fecha efectiva ni marca de aplicado (`B/02` §2.2) |
| `F-8B3-011` · `refund` no guarda el id del proveedor | **SIGUE** | entero. `B/02` §2.3, fila `refund`, sin cambios |
| `F-8B3-012` · el barrido no compara reembolsos | **SIGUE** | entero. `B/09` §3 sigue con cinco comparaciones y ninguna mira el reembolsado |
| `F-8B3-013` · la retención quedó con una fila | **SIGUE** | entero. `B/02` §4.1 sigue teniendo una sola fila. **Agravado**: tres entidades sin clasificar ganaron FK **no anulables** hacia otras tres (`B/02` §2.4), así que ahora borrar una rompe filas que sí se conservan |
| `F-8B3-014` · el addon a costo cero declara un campo que no existe | **SIGUE** | entero. `addon_instance` sigue con *«su suscripción de complemento si es recurrente»* como único campo de origen |
| `F-8B3-015` · `manual_payment` no guarda monto | **SIGUE** | entero, sin cambios en `B/02` §2.3 |
| `F-8B3-016` · transiciones que la tabla exhaustiva no declara | **SIGUE a medias** | **el paso 1 corta**: `S16` declara `ACTIVE → CHARGE_DECLINED`. **El paso 2 sigue**: `B/10` §4.3 y §4.5.3 mandan `GRACE_PERIOD`, `PAUSED` y `SUSPENDED` a `CANCEL_SCHEDULED` y la tabla sólo tiene `S11`, desde `ACTIVE` |
| `F-8B3-017` · un reembolso total deja el comprobante en pie | **SIGUE** | entero. `receipt` sin estado ni anulación |
| `F-8B3-018` · la medición caduca y la cohorte crece | **SIGUE** | **paso 2**: `B/21` §3.3 sigue declarando abierta una decisión cerrada el 2026-09-19. Lo demás se absorbe en `F-8bB3-011` y no se cuenta dos veces |
| `F-8B3-019` · `UNIQUE` sobre una columna que el modelo no lista | **SIGUE** · `NUCLEO` | `nucleo/02` §2.6 sigue sin `ocurrencia`. Su gemelo de esta pasada, fuera del núcleo, es `F-8bB3-012` |

**Conteo: 6 cortan** —`F-8B3-001`, `-006`, `-007`, y las mitades de `-009` y `-016`, más el paso 1
de `-016`— **y 13 siguen llegando**, de los cuales 2 están declarados abiertos con su causa
(`-002` y `-003`, los dos del capítulo 13). Contando cabezas enteras: **3 cortan del todo** (`-001`,
`-006`, `-007`), **2 cortan a medias** (`-009`, `-016`) y **14 siguen llegando enteros**.

---

## 3. Ataques que intenté y el diseño resistió

Once ataques que no produjeron hallazgo. El owner necesita saber qué aguantó tanto como qué se
rompió.

1. **Meter una tercera fila principal viva.** Intenté el `INSERT` que los dos candados parciales
   dejan pasar, recorriendo los diez caminos contra los nueve estados. No entra: la combinación
   *(origen vivo, sucesora viva)* satura las dos claves, y `ABANDONED`/`CANCELLED`/`CHARGE_DECLINED`
   son invisibles **a propósito**, porque ninguno tiene autorización que pueda cobrar. La única
   grieta que encontré no es una tercera fila sino la segunda sucesión, y es `F-8bB3-003`.

2. **Que la marca libere el candado.** Intenté reproducir el doble cobro viejo —la fila salía de los
   vivos con su preapproval intacto (`EX-6`)— sobre el texto nuevo. Está cerrado: la fila marcada
   conserva su estado, ocupa el candado, y `B/05` §3 condición 3 la cuenta. Es la única dirección en
   que el modelado nuevo aprieta en vez de aflojar, y es real. El costo está del otro lado
   (`F-8bB3-001`).

3. **Reactivar una predecesora superada con un pago tardío.** La condición 3 de `B/05` §3 ahora dice
   *«ni una sucesora de esta fila ya autorizada»* y la redacción vieja —*«no hay otra viva»*— ya no
   depende de un conjunto que excluía el estado de conciliación. El ataque muere en la condición.

4. **Destruir los addons de un cliente en un upgrade.** `B/16` §4.2 los re-apunta a la sucesora y
   define huérfano como *«llegó a `CANCELLED` **y no tiene sucesora**»*. Probé también el contador de
   promos: `B/14` §2.2 lo hereda. Los dos cierran.

5. **Que el título `BASE` otorgue algo.** Intenté que el piso cubriera o diera una clave comercial.
   No: es de clase `BASE`, `cubierto` sólo cuenta `TÍTULO`, y `G-R3` se comprueba **sobre las dos**
   versiones no vendibles de cada vertical. Y probé el camino inverso —que el addon cubra—, que es
   `D-01` y está explícitamente cerrado.

6. **Repetir el trial borrando la cuenta o re-registrándose.** `UNIQUE(hash_del_correo, vertical)`
   sin condición de estado, más la fila de `trial` que *«se conserva íntegro, siempre»* y el hash que
   no se anonimiza. Cerrado por los dos lados.

7. **Confundir el piso del trial con el del grant.** Intenté que uno usara la referencia del otro.
   `V/15` §2.5 los distingue por lo único que cambia —*«el del trial, contra las versiones vigentes
   al arrancar; el del grant, contra las vigentes al firmarlo»*— y los dos guardan referencia, nunca
   valores. Lo que no resiste es **transportar** el del grant, que es `F-8bB3-005`.

8. **Dejar sin nada a un *Free Forever* retirando su plan.** Es el ataque obvio contra `D-05` y está
   previsto: el grant lee la vigente *«vendible o no»*, y `B/10` §3.3 retira publicando una versión
   no vendible. Lo que falla no es el retiro sino la afirmación de existencia (`F-8bB3-006`).

9. **Perseguir `next_payment_date` como divergencia.** Intenté que el barrido suspendiera a alguien
   porque el proveedor le movió la fecha. `PS-6` mide que el movimiento es **hacia adelante** —el
   ciclo que vence estando pausada avanza sin cobrar— y `B/09` §3 declara esa fila *«no es por sí
   sola una divergencia»*. La dirección del error es la segura.

10. **Mover la fecha de cobro de una sucesora `pending` para reparar el crédito corto.** No se puede
    y está medido con control: `EX-39`, tres formas de mandar la fecha, `200` y `last_modified`
    congelado, mientras el `PUT` de monto sobre el mismo sujeto sí movió. El diseño eligió no llegar
    al caso en vez de corregirlo, y lo dice.

11. **Sacarle un dato de dinero al contrato.** Volví a intentar el §4 completo con los seis tipos
    nuevos: no cruza ningún monto, y `hasta` de una `ACTIVE` es `SIN_FECHA_CONOCIDA`, no el fin del
    período. La filtración que encontré sigue yendo en la dirección inversa (`F-8bB3-008`).

---

## 4. Lo que cae en el hueco del capítulo 13, y que esta fase movió

El 13 (Pagos) no existe a propósito y no se reporta como hallazgo. Lo que sí cambió: **la FASE 9
apoyó dos mecanismos nuevos en él sin decirlo.**

1. **La marca depende de que exista el concepto de período.** `F-8bB3-001` sale del barrido, y tres
   de sus cinco comparaciones —monto vigente, cobros del período y el reembolso que falta— hablan de
   entidades que define el 13. Mientras tanto, la marca se pone sobre divergencias que nadie puede
   calcular bien.

2. **`CHARGE_DECLINED` es un estado definido por un hecho de pago.** Su condición se cuenta *«sobre
   pagos acreditados, nunca sobre fechas»* (`B/12` §4.5.2), y qué es un pago acreditado y a qué
   período corresponde es del 13. `F-8bB3-004` vive exactamente en esa juntura.

3. **La cuota en `recycling` que puede entrar** (`D-15`, `B/12` §5.3) es un cobro sobre una fila
   cancelada, y su reembolso —la salida declarada— descansa en la única capacidad que el `B/06` §10
   declara en riesgo de plataforma.

4. **El primer cobro del 2026-09-26** convierte el umbral de `F-8bB3-011` en el otro: aparece
   `receipt` con su `UNIQUE(numero)` sin huecos, y ninguna regla del diseño dice qué se hace con una
   serie que arrancó en el sistema viejo.

---

## 5. Fuera de mi vector

- **[B1 — doble cobro]** El paso 5 de `F-8bB3-003`: una fila declarada como origen cuando ya existe
  una sucesora viva **entra por el candado `A`** y deja dos preapprovals autorizados. Es el §11
  violado sin que ninguna clave lo vea.

- **[B2 — máquinas y carreras]** `S15` levanta la marca y *«si además corresponde un cambio de
  estado, se ejecuta la transición de esta misma tabla que lo permita»*. Para el caso de
  `F-8bB3-004` —`GRACE_PERIOD` con el preapproval cancelado— **no hay ninguna transición que lo
  permita**, así que `S15` levanta la marca y deja la fila donde estaba.

- **[B2 — máquinas y carreras]** `B/10` §4.3 cancela **todas** las suscripciones de una vertical en
  un solo acto y `B/10` §4.6 declara el anuncio *«el punto sin retorno»*. Si esa ejecución falla a
  la mitad no hay forma de enumerar cuáles quedaron: es `F-8B3-010` sobre una operación irreversible.

- **`NUCLEO`** — `nucleo/02` §2.6 sigue sin la columna `ocurrencia` que `nucleo/07` §2 declara con
  restricción de unicidad (`F-8B3-019`).

- **`NUCLEO`** — `nucleo/04` §3 clasifica `D8` como sostenido por la **base**: *«la fecha con la que
  nació la fila se guarda en `subscription`, y un guard la verifica»*. Un guard estático sobre un
  valor que escribe el mismo camino que audita no es una restricción de base; la fila del cuadro
  debería decir *servicio + guard*, que es lo que `G-R1-B` realmente es.
