---
title: "FASE 8-bis-3 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · B2 — máquinas, idempotencia y carreras

Cuarta pasada de este vector sobre `HOS-1354`. La anterior tuvo una respuesta corta —*«`S17`
termina la vida de la fila borrando la evidencia de que hubo una sucesión»*—. Ésta también, y es
la que la tanda de arreglos dejó justo al lado de la que arregló:

> **La tanda partió `S17` de `S18` y le puso a la sucesión una columna durable, `sucedida_por`, para
> que la muerte de la predecesora y el cierre de la sucesión dejaran de ser un acto. Lo que no hizo
> es darle un fin a la sucesión que NO se cierra.** `sucede_a` **sigue sin tener quien lo limpie
> cuando la sucesora muere**: `S18` es *«el único acto»* que lo hace y exige la sucesora `ACTIVE`,
> así que una sucesora que abandona el checkout deja el puntero puesto para siempre. Los dos
> candados sobreviven a eso —son parciales sobre `estado ∈ {vivos}`, y una `ABANDONED` no ocupa
> nada—, pero **los predicados en prosa que la tanda escribió encima de ese puntero no filtran por
> estado**: `S19`, la condición de `S5`, la de `S7`, la de `S6` y `G-R1-D` preguntan *«¿tiene una
> sucesora con `sucede_a` apuntándola?»* **sin exigir que esté viva**, que es exactamente el
> adjetivo que `B/16` §4.2 sí exige y explica por qué (*«La fila viva es parte del predicado, no un
> adorno»*). La base quedó bien y la prosa no.

Y una segunda, que atraviesa tres hallazgos: **la tanda escribió tres reglas de dinero cuyo
disparador no está en ninguna tabla de transiciones.** El reembolso de la rama 1 de `B/12` §5.3
ocurre *«al cerrar la sucesión»* y los efectos de `S18` no lo nombran; la marca de esa misma rama
tampoco; y el pago manual que `MP1` deriva a `S19` no entra por el evento que `S19` declara. Es la
regla 1 del núcleo aplicada contra la propia tanda: *«lo que la tabla no declara, no pasa»*, y lo
que no pasa acá es devolver plata.

**Catorce hallazgos. Cinco `CRITICA`, cinco `ALTA` —una de ellas es un hallazgo de la 8-bis-2 que
sigue llegando—, tres `MEDIA`, una `BAJA`.**

**Lo que medí yo, y cómo.** Todo sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`, el 2026-09-21: las **19**
filas de la tabla de transiciones de `B/03` §3.2 y las **6** de su tabla de recorrido; las **8**
filas y los **2** comodines de `B/03` §10.1; las **10** filas de `12-contrato…` §2.6; los **9**
guards de `B/20` §2; las **4** tablas de transiciones de la épica de billing y las **3** de la de
verticales, contadas con `rg "^\| # \| desde \| evento"` sobre los dos árboles de `docs/`; las
**5** apariciones de *«sucesión en curso»* como predicado, contadas con `rg "sucesión en curso"`
sobre las dos épicas, el núcleo y el contrato. **Ningún número de este informe viene de otro
informe**; las citas ajenas las verifiqué contra el texto del capítulo.

Abreviaturas: `B` es `HOS-1354-…/docs/`, `V` es `HOS-1353-…/docs/`, `NUCLEO` es
`HOS-1352-…/docs/nucleo/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

---

## CRITICAS

### F-8dB2-001 — Nadie limpia `sucede_a` cuando la sucesora abandona, y cuatro de los cinco predicados que lo leen no exigen que esté viva: el cliente queda en `GRACE_PERIOD` con servicio entero, con el reloj apagado, para siempre

**Qué se rompe.** Alguien en `GRACE_PERIOD` pide un cambio de plan —que `DEC-SUB-003` diseñó como
*«el camino de recuperación»*—, la cuota reciclada entra, y después **abandona el checkout**. A
partir de ahí su fila queda congelada en `GRACE_PERIOD`: `S5` y `S7` no la pueden reactivar, `S6`
no la puede suspender, y `GRACE_PERIOD` **emite fuente** con `hasta: SIN_FECHA_CONOCIDA`, o sea
servicio entero (§20). **Paga un período y recibe servicio sin cota, sin que nada vuelva a evaluar
nada.** El *«tope de 72 h»* con que `B/12` §5.3 defiende la regla **no está escrito en ninguna
condición**.

**El camino.**

1. Cliente en `GRACE_PERIOD`. Pide un cambio de plan. `S1` inserta la sucesora con `sucede_a`
   apuntando a la predecesora (`B/03` §3.2, `S1`: *«o la fila declara una sucesión (`sucede_a`)»*).
2. La cuota impaga sigue en `recycling` y entra dentro de la ventana. `S19`: *«el pago se registra
   y queda pendiente de resolución … Mientras esté pendiente, `S6` no corre»* (`B/03` §3.2).
3. El cliente abandona. A las 72 h, `S3`: *«pasaron **72 h** sin autorizar»* → `ABANDONED`, y su
   columna de efectos dice, entera: *«se cancela el preapproval en el proveedor; **la fila se
   conserva**»*. **No limpia `sucede_a`.**
4. **Y no lo limpia nadie más.** `B/02` §2.2 lo declara con un solo dueño: *«`sucede_a` no nulo →
   **sucesión en curso**. La escribe `S1`, **la limpia `S18`**»*. Y `S18` exige *«la **sucesora**,
   en `ACTIVE`»* como `desde` (`B/03` §3.2), que una `ABANDONED` no va a ser nunca —`S3` es
   terminal y `ABANDONED → ACTIVE` está en la lista de las que no existen (§3.3)—. El puntero queda
   puesto de por vida.
5. **Ahora la pregunta: ¿la predecesora sigue siendo «la predecesora de una sucesión en curso»?**
   Conté las cinco apariciones del predicado y **cuatro de las cinco contestan que sí**, porque no
   nombran el estado de la sucesora:
   - `B/02` §2.2: *«`sucede_a` no nulo → **sucesión en curso**»*;
   - `B/03` §3.2, `S19`, columna condición: *«la fila **tiene una sucesora con `sucede_a`
     apuntándola**»*;
   - `B/03` §3.2, tabla de los tres estados de la relación: *«| **sucesión en curso** | la sucesora
     con `sucede_a` no nulo |»*;
   - `B/12` §5.3: *«la fila que **tiene** una sucesora con `sucede_a` apuntándola (`B/02` §2.2)»*;
   - `B/20` §2, `G-R1-D`: *«**(tiene una sucesora con `sucede_a` apuntándola)**»*.

   La quinta —y la única que lo hace bien— es `B/16` §4.2, que exige *«**y no hay una fila viva**
   con `sucede_a` apuntándola»* y dedica un párrafo a por qué: *«**La fila viva es parte del
   predicado, no un adorno**»*.
6. **Con la lectura que la tabla manda, los tres relojes se apagan a la vez.** `S5` y `S7` llevan
   *«que esta fila **no sea la predecesora de una sucesión en curso**»* → no reactivan. `S6` lleva
   *«**no hay un pago acreditado del período pendiente de resolución** por `S19`»* → no suspende. Y
   `S19` no tiene salida propia: es *«el mismo estado»*.
7. **El servicio no se corta.** `12-contrato…` §2.6: *«| `GRACE_PERIOD` | **sí** |
   `SIN_FECHA_CONOCIDA` | el §20 da **servicio entero** durante el grace |»*.
8. **Y el backstop lee al revés que la tabla.** `B/09` §3 pregunta si la fila *«ya **no** es la
   predecesora de una sucesión en curso —**la sucesora murió**, o la sucesión se cerró—»* y en ese
   caso manda resolver *«por la rama que le corresponda de las cuatro de `B/12` §5.3»*. La rama que
   corresponde es la 2: *«la sucesora vence su ventana (`S3` → `ABANDONED`) | **no se reembolsa:
   reactiva** … `S5` o `S7`, según el estado»*. **Y la condición de `S5` y `S7` la prohíbe**, porque
   ellas leen el otro conjunto. El backstop deriva a una transición cuya guarda lo rechaza: por la
   regla 1 del núcleo eso es un intento no declarado, y termina en la marca — sobre el camino que
   `B/12` §5.3 declara normal.

**El «tope de 72 h» no existe como condición.** `B/03` §3.2 lo enuncia —*«El tope es la ventana: 72
h, y después el pago se resuelve por una de las cuatro ramas»*— y `B/12` §5.3 lo repite —*«**No es
una gracia extra —es un tope de 72 h, el de la ventana—**»*—. Recorrí las condiciones de `S5`,
`S6`, `S7` y `S19`: **ninguna nombra la ventana, ni una fecha, ni una duración.** Lo único que
apaga el reloj es el booleano *«hay un pago pendiente por `S19`»*, y ese booleano se apaga cuando
la sucesión termina, que es justo lo que el paso 4 vuelve inalcanzable.

**Lo que hace que esto sea de prosa y no de base, y conviene decirlo porque es la mitad buena.**
Los dos candados de `B/02` §2.2 **no se rompen**: son parciales sobre `estado ∈ {vivos}`, y una
`ABANDONED` no está entre los seis, así que el candado `B` queda libre y el cliente puede volver a
intentar el cambio de plan. La base leyó *«viva»* bien. Lo que la leyó mal son los cinco predicados
que la tanda escribió encima del mismo puntero.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S3` efectos, `S5`, `S6`, `S7`, `S18` `desde`, `S19`
condición, y la tabla de los tres estados de la relación) y §3.3 (`ABANDONED → ACTIVE` no existe);
`B/02` §2.2 (el dueño único de la limpieza y los dos candados); `B/12` §5.3 (el sujeto y las cuatro
ramas); `B/09` §3 (la segunda comprobación); `B/16` §4.2 (el único predicado que exige *«fila
viva»*); `B/20` §2 (`G-R1-D`); `12-contrato…` §2.6 (qué emite `GRACE_PERIOD`);
`NUCLEO/01` §2.4 (los dos conjuntos y la regla 2 de uso).

**Severidad.** `CRITICA` — alguien paga de menos: un período cobrado compra servicio completo sin
fecha de fin y sin ningún mecanismo que lo cierre. Es el mismo daño que el §4.3 de `B/12` describe
—*«el grace no es un beneficio de entrada … diez días por ciclo, repetible»*— con el reloj sacado
en vez de con el estado mal elegido, y esta vez **sin tope**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 12** (`S19`, la condición en `S5`/`S6`/`S7`,
`G-R1-D`), apoyado en el **10** (`sucedida_por`) y en el **8** (`S17`/`S18` partidas). El 10 agregó
la columna durable **para la muerte de la predecesora** y nadie escribió la simétrica: qué pasa con
el puntero cuando la que muere es **la sucesora**. El 12 escribió cinco predicados nuevos encima de
ese puntero en el mismo día, y `B/16` §4.2 —que es del arreglo 10 y sí exige *«fila viva»*— quedó
como el único que lo hace bien.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término redefinido es
`sucede_a` —uno de los nueve que `C1` §2.3 ya había enumerado—. El commit del pago tardío
(`99e9d4e24`) no toca `B/16`, y un `rg "sucede_a"` sobre `B/16` devuelve, en §4.2, la frase *«no hay
**una fila viva** con `sucede_a` apuntándola»* con su párrafo de justificación al lado. Resolver esa
aparición contra el predicado nuevo —*«tiene una sucesora con `sucede_a` apuntándola»*— es leer los
dos uno debajo del otro y ver que a uno le falta el adjetivo. **La regla existía y no se ejecutó.**

---

### F-8dB2-002 — `S13` ahora alcanza también las suscripciones de complemento, y ninguna regla mueve la instancia del addon: el beneficiario de *Free Forever* pierde los addons que pagó —contra la frase del contrato— o se queda con uno que ya nadie paga

**Qué se rompe.** El día que `SUPER_ADMIN` regala *Free Forever*, el beneficiario **pierde de golpe
todos sus addons de scope `VERTICAL_SUBSCRIPTION`**, con sus preapprovals cancelados de forma
irreversible (`PA-5`) y **sin reembolso** (`DEC-GRANT-001`) — incluido el *«Boost 30 días»* que
compró ayer. Y en la dirección opuesta, sus addons de scope `USER` o `GLOBAL` **quedan `ACTIVE` con
su cobro cancelado**: capacidad encendida que nadie paga, sin transición que la apague. El contrato
dice textualmente lo contrario de lo primero.

**El camino.**

1. Un cliente `ACTIVE` en Gastronomía tiene dos addons recurrentes. Cada uno es **su propia
   suscripción**: `DEC-ADDON-002`, y `B/03` §3 lo declara en el alcance de la máquina —*«Las de
   complemento —una por addon recurrente, `DEC-ADDON-002`— usan **esta misma máquina**, sin tope
   propio»*—.
2. `SUPER_ADMIN` otorga *Free Forever* con ancla en Gastronomía. `S13`, con el dominio que le puso
   el arreglo 9: *«**toda fila viva** del beneficiario en **cada vertical que el grant ancla** …
   los seis estados»*, efecto *«§35.3: se cancela toda obligación de pago, **sin reembolso** …
   **se cancela el preapproval de cada una**»* (`B/03` §3.2).
3. **«Toda fila viva del beneficiario» no dice «principal».** Una suscripción de complemento es una
   fila de `subscription` con su `clase` y su `vertical` (`B/02` §2.2), viva y del beneficiario, en
   la vertical que el grant ancla. Entra en el dominio, y su preapproval se cancela.
4. **Y eso es, con esas palabras, lo que el §41 prohíbe.** `B/16` §4.3 lo cita: *«`DEC-ADDON-002`
   implicación 6: **cancelar el plan NO cancela los addons**»*, y el §41 ordena *«**no cancelar
   ciegamente**»* y hacerlo *«sólo cuando queda efectivamente huérfano»*. `S13` no evalúa la
   condición del §4.2: cancela por pertenecer al conjunto.
5. **Y la principal cae en el mismo acto, así que los addons quedan huérfanos por la otra puerta
   también.** `B/16` §4.2: *«| `VERTICAL_SUBSCRIPTION` | la suscripción de esa vertical **dejó de
   ser fila viva** (`NUCLEO/01` §2.4) **y ninguna sucesión la releva**»*. Un grant **no es una
   sucesión**, así que la salvedad no aplica. `A5` → `CANCELLED`, y `B/16` §4.3 manda cancelar el
   preapproval *«de inmediato»*.
6. **El contrato dice explícitamente que esto no pasa.** `12-contrato…` §2.4: *«**El caso que NO
   cambia, y conviene decirlo**: un `GRANT` permanente **es** de clase `TÍTULO`, así que quien
   tiene *Free Forever* y un addon **conserva los dos**.»* Verificado contra el texto: la frase está
   entera y sin salvedad.
7. **Y la dirección opuesta es igual de mala.** Para un addon de scope `USER` o `GLOBAL` el
   objetivo es la cuenta, que no se borró (`B/16` §4.2, fila `USER · GLOBAL`): **no queda
   huérfano**. Pero `S13` ya canceló el preapproval de su suscripción de complemento. La instancia
   queda `ACTIVE` —la máquina de addon no tiene ninguna transición cuyo evento sea *«mi suscripción
   de complemento fue cancelada»*: `A4` es su fecha de fin, `A5` es la orfandad y `A6` el borrado de
   la ficha (`B/03` §8)—. Si el grant lleva `includesAddons: false`, esa capacidad sigue encendida
   **gratis y para siempre**.
8. **Y nadie avisa.** `B/16` §3.3 obliga a nombrar la pérdida del addon **al revocar** —*«la
   confirmación del capítulo 08 §3.1 tiene que nombrarlo igual»*—. **Al otorgar no hay ninguna
   obligación equivalente en ningún capítulo**, y `B/16` §3.2 aclara que el grant *«habilita; no
   enciende»* y que la persona los elige *«uno por uno»*: para recuperar lo que perdió tiene que
   enterarse sola de que lo perdió.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S13`, dominio y efectos) y §3 (el alcance de la
máquina sobre las de complemento) y §8 (`A4`, `A5`, `A6`); `B/16` §4.2 (las tres filas de scope),
§4.3 (el §41 y el efecto) y §3.2/§3.3 (habilita/no enciende, y la obligación de avisar sólo al
revocar); `B/02` §2.2 (la `clase` de la fila) y §2.4 (`addon_instance`);
`12-contrato…` §2.4 (*«conserva los dos»*); `01-decision-log.md`, `DEC-GRANT-001` y
`DEC-ADDON-001` (*«se consume: no se libera ni se reasigna»*); `06-mp-validation-matrix.md`,
`PA-5`.

**Severidad.** `CRITICA` — en una dirección se pierde sin vuelta una capacidad comprada y pagada,
con la cancelación que `PA-5` mide irreversible y con `DEC-GRANT-001` negando el reembolso; en la
otra se accede a una capacidad que nadie paga. Las dos salen del mismo acto.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 9**, cruzado con el **14**. Antes del 9, `S13`
enumeraba *«cuatro estados y **una sola fila**»* —así lo dice el propio §3.2 al justificar el
cambio—, y esa fila era la principal: el preapproval del complemento no lo tocaba `S13`, lo tocaba
la orfandad del §4.2, que sí evalúa una condición. El 9 lo convirtió en un barrido por pertenencia
al conjunto. Y la frase del contrato *«conserva los dos»* es del arreglo 2 de la tanda anterior, o
sea que la premisa que el 9 vuelve falsa es la de otro arreglo: es la obligación 2 de
`DEC-METH-008`, sin ejecutar.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término redefinido es **«toda fila
viva»** —*«viva»* está entre los nueve de `C1` §2.3—. El commit de la sucesión (`3692d5deb`) es el
que amplía `S13`; un `rg "fila viva"` sobre `B/16`, que ese commit no toca, devuelve la fila
`VERTICAL_SUBSCRIPTION` de §4.2, y resolver esa aparición es preguntarse si `S13` hace que la
suscripción deje de ser fila viva —sí— y si hay sucesión que la releve —no—. Y un `rg "Free
Forever"` sobre `12-contrato…` devuelve la frase *«conserva los dos»* en una línea.

---

### F-8dB2-003 — El reembolso de la rama 1 no está en los efectos de `S18` y el backstop de `B/09` nombra la única rama que no puede alcanzar: el pago que `S17` se llevó puesto no se devuelve nunca, y nada lo detecta

**Qué se rompe.** El caso central del arreglo 13 —el cliente en grace que cambia de plan, cobra la
cuota reciclada y **completa** el checkout— termina con el cliente habiendo pagado un período
entero que `S17` le canceló, **sin reembolso, sin marca y sin ningún detector abierto**. `B/12`
§5.3 decide que se devuelve; ninguna tabla lo dispara y el barrido que se escribió como red no
llega a la fila.

**El camino.**

1. Predecesora en `GRACE_PERIOD` con una sucesión en curso. Entra la cuota reciclada: `S19`, *«el
   pago se registra y queda pendiente de resolución … **no pone la marca** — es un caso diseñado,
   no una divergencia»* (`B/03` §3.2).
2. La sucesora autoriza. `S17` mata a la predecesora → `CANCELLED`. `S18` cierra la sucesión.
3. `B/12` §5.3, rama 1: *«la sucesora autoriza (`S2`) → `S17` mata a la predecesora y `S18` cierra
   | **se reembolsa, y lo confirma una persona** (`DEC-RF-002`): **al cerrar la sucesión se pone la
   marca** y el caso entra al canal de conciliación»*.
4. **«Al cerrar la sucesión» es `S18`, y los efectos de `S18` no lo dicen.** Cité la celda entera:
   *«**cierra la sucesión, y es el único acto que lo hace**: se escribe **`sucedida_por`** en la
   predecesora, se **limpia `sucede_a`** en la sucesora, y los complementos de la predecesora se
   **re-apuntan** a ella (`B/16` §4.2). La sucesora pasa a ser el origen»* (`B/03` §3.2). **No
   nombra la marca ni el pago pendiente.**
5. **Y `S14` tampoco lo puede poner, porque no hay divergencia.** Su evento es *«divergencia que
   toca plata o estado»*, y `S19` acaba de declarar por escrito que esto **no** es una divergencia.
   Así que la marca de la rama 1 no tiene transición: por la regla 1 del núcleo —*«lo que no está,
   no pasa»*—, no se pone. Es el mismo argumento con que este § justificó crear `S19`: *«La regla
   que lo impide tiene que estar en esta tabla, no sólo en la prosa de otro capítulo»* (`B/03`
   §3.2). La que devuelve la plata quedó sólo en la prosa.
6. **Y el backstop no alcanza la fila.** `B/09` §3 lo escribió para esto: *«**Y una segunda que
   tampoco le pregunta nada al proveedor: el pago pendiente por `S19` cuya sucesión ya terminó.** Si
   una fila tiene un pago acreditado **pendiente de resolución** … y ya **no** es la predecesora de
   una sucesión en curso —la sucesora murió, **o la sucesión se cerró**—, su destino estaba
   determinado y nadie lo ejecutó»*. Pero el § **abre** delimitando su propio sujeto: *«Por cada
   fila de nuestro inventario … **que no esté en un estado terminal**, más las terminales que la
   salvedad del complemento devuelve al barrido»*. Tras el paso 2 la predecesora está `CANCELLED`,
   que el mismo § enumera entre los tres terminales exentos, y la salvedad que devuelve terminales
   al barrido es **sólo la del complemento**. **La comprobación nombra explícitamente la rama que su
   propio alcance excluye.**
7. El pago está en `payment`, colgado de la predecesora (`B/02` §2.3: *«suscripción, monto,
   moneda…»*), así que tampoco aparece por la fila de la sucesora.

**Y el caso no es raro: es el desenlace principal.** De las cuatro ramas de `B/12` §5.3, la 1 es
*«la sucesora autoriza»*, o sea el cambio de plan que sale bien. La rama 2 (abandono) sí la ve el
backstop mientras la predecesora siga viva; la 3 ya tiene un humano; la 4 declara que no se
devuelve. **La única de las cuatro que exige mover dinero es la única que queda sin disparador y
sin red.**

**Dónde lo permite el diseño.** `B/03` §3.2 (`S17`, `S18` columna efectos, `S19`, `S14`);
`B/12` §5.3 (la tabla de las cuatro ramas y la frase *«al cerrar la sucesión se pone la marca»*);
`B/09` §3 (el sujeto del barrido, los tres terminales exentos, la salvedad del complemento y la
segunda comprobación); `B/02` §2.3 (`payment` cuelga de la suscripción); `NUCLEO/03` §1 regla 1;
`01-decision-log.md`, `DEC-RF-002`.

**Severidad.** `CRITICA` — alguien paga de más: un período completo que el propio diseño declara
*«no le compró nada»*, con el reembolso decidido y ningún camino que lo ejecute ni lo señale. Y el
daño es silencioso en las dos direcciones: el cliente no sabe que le corresponde y el sistema no
tiene fila que mirar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos de la misma familia.** El **13** movió
el disparador del reembolso *«de la llegada del pago al cierre de la sucesión»* y lo dejó en la
prosa de `B/12`; el **12** creó `S18` con sus efectos enumerados y no lo incorporó. La segunda
comprobación de `B/09` §3 es de la misma tanda y se escribió como la red de `S19` —*«cubre el único
estado que el arreglo de `S19` puede dejar colgado: **un pago retenido para siempre**»*—, contra un
alcance que el §14 (*«la exención de terminales se acota … sólo el complemento»*) acababa de dejar
cerrado para las suscripciones.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No**, y es el dato que importa. El término
redefinido es *«el disparador del reembolso»* / *«pago pendiente»*, y **las dos mitades del defecto
viven en capítulos que el mismo commit toca**: `99e9d4e24` toca `B/12` §5.3 **y** `B/09` §3, y el
cierre `1c972a07b` vuelve a tocar los dos. La regla busca *«sobre los capítulos que el commit NO
toca»*; acá el choque es entre dos párrafos del mismo § de `B/09` —su frase de alcance y su
comprobación nueva— y entre dos capítulos del mismo commit. **La regla no alcanza**, y lo que
faltaría es la simétrica: buscar el término también **adentro** de los capítulos que el commit
toca, incluida la prosa de alcance que el commit no editó.

---

### F-8dB2-004 — `S19` sólo admite «la cuota que sigue en `recycling`», así que el pago manual que `MP1` le deriva no matchea ninguna fila: `S6` corre y el cliente que pagó por transferencia durante su cambio de plan termina `SUSPENDED`

**Qué se rompe.** Un cliente en `GRACE_PERIOD` que está cambiando de plan paga por fuera del
proveedor —transferencia, efectivo— y el admin lo registra. El pago existe, está acreditado y tiene
comprobante. Y aun así **el reloj del grace sigue corriendo y lo suspende**: sin listado público,
sin edición, sin creación, sin entitlements comerciales (§21). Pagó el período y lo perdió.

**El camino.**

1. Predecesora en `GRACE_PERIOD` con una sucesora declarada.
2. El admin registra el pago manual. `MP1` (`B/03` §7): *«la suscripción sale de `GRACE_PERIOD` por
   `S5` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: el efecto
   de `MP1` es el de `S5` y hereda su condición, **porque el daño no depende de por qué puerta
   entró el pago**»*. O sea: `MP1` deriva explícitamente a `S19`.
3. **`S19` no lo recibe.** Su columna evento, entera: *«**entra el pago de la cuota que sigue en
   `recycling`**»* (`B/03` §3.2). Un pago manual no es una cuota en `recycling` — `recycling` es un
   estado **del proveedor**, medido en producción y descrito en `B/12` §1.3 como *«el proveedor
   rechazó y **va a reintentar**»*. El §3.2 lo repite al justificar la fila: *«su cuota impaga sigue
   en `recycling` **del lado del proveedor**, que la reintenta solo (`B/12` §1.3, medido)»*.
4. `S5` tampoco lo recibe: su condición lleva *«que esta fila **no sea la predecesora** de una
   sucesión en curso»*, y lo es.
5. **Entonces no hay transición, y la regla 1 hace lo que el propio §3.2 dijo que había que
   evitar.** `NUCLEO/03` §1 regla 1: *«Un intento de transición que la tabla no declara **no se
   ejecuta** … si tocaba plata o estado, **pone la marca**»*. Es literalmente el desenlace que `S19`
   existe para impedir: *«Sin `S19`, el pago entrante sería una transición no declarada y la regla 1
   lo mandaría a la marca, convirtiendo el camino normal del cambio de plan desde grace en un
   incidente»* (`B/03` §3.2).
6. **Y el reloj no se apaga, que es la parte cara.** `S6` no mira si entró plata: mira **un
   booleano definido sobre `S19`** — *«no hay un pago acreditado del período **pendiente de
   resolución por `S19`**»*. Si `S19` no corrió, no hay nada *«pendiente por `S19`»*, así que la
   condición de `S6` **se cumple** y el reloj vence normalmente → `SUSPENDED`.
7. `SUSPENDED` **no emite fuente** (`12-contrato…` §2.6), así que `cubierto` pasa a falso y sus
   fichas se despublican por `PB2`. El cliente pagó, tiene comprobante, y está afuera.
8. **Y si alguien lo deriva igual a `S19`, el destino del pago tampoco existe.** Las cuatro ramas de
   `B/12` §5.3 están escritas sobre un pago del proveedor: la rama 1 *«se reembolsa»* y el modelo no
   tiene con qué — `refund` cuelga de **`payment`**, no de `manual_payment`, que es otra entidad con
   su propio juego de estados `AWAITING · REGISTERED · DECLARED_UNPAID` (`B/02` §2.3, `B/03` §7). No
   hay estado de *«reembolsado»* para un pago manual.

**Por qué esto no es un borde.** El pago manual no es un caso exótico: el §30 lo define como *«Mismo
motor de Subscription. Payment method distinto»*, `B/03` §7 le da su propia máquina y `B/20` §2 lo
cuenta como **uno de los tres sitios** donde la regla se ejecuta —`G-R1-D`: *«la regla se ejecuta en
tres lugares y no en uno: `S5`, `S7` y **el efecto de `MP1`**»*—. El guard nuevo asume que `MP1`
llega a `S19`; la tabla de `S19` no lo deja entrar.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S5`, `S6`, `S19` columna evento) y §7 (`MP1`);
`B/12` §1.3 (qué es `recycling`, medido) y §5.3 (las cuatro ramas); `B/02` §2.3 (`payment`,
`refund`, `manual_payment`); `B/20` §2 (`G-R1-D` y su párrafo *«los tres lugares»*);
`12-contrato…` §2.6 (`SUSPENDED` no emite); `NUCLEO/03` §1 regla 1.

**Severidad.** `CRITICA` — alguien paga de más: entrega dinero real, queda registrado, y el sistema
lo suspende igual por un reloj cuya condición está escrita contra un evento que su pago no dispara.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 12.** La cláusula de `MP1` que deriva a `S19`
—*«o queda pendiente por `S19`, si es la predecesora de una sucesión en curso»*— y la condición de
`S6` se escribieron en el mismo acto que `S19`; lo que no se escribió es el evento de `S19` en
términos que cubran las dos puertas. El propio `MP1` declara el principio correcto —*«el daño no
depende de por qué puerta entró el pago»*— y la fila a la que deriva nombra una sola puerta.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es `S19` /
*«pago pendiente»*, y **las dos mitades viven en el mismo capítulo y en el mismo commit**: `S19` en
`B/03` §3.2 y `MP1` en `B/03` §7, los dos editados por `99e9d4e24`. Una búsqueda *«sobre los
capítulos que el commit NO toca»* no mira ahí. Es el mismo modo de falla que `F-8dB2-003`, con otro
par de §.

---

### F-8dB2-005 — Un addon que autoriza DESPUÉS de que su título murió nace `ACTIVE` con su preapproval vivo, cobra todos los meses, no otorga nada, y el barrido lo aprueba: `A5` sale sólo de `ACTIVE` y la re-evaluación que `B/16` §4.3 promete no tiene evento

**Qué se rompe.** Alguien compra un addon recurrente, y durante las 72 h en que su checkout está
abierto su suscripción principal muere. El addon autoriza igual, **nace `ACTIVE` con su propio
preapproval cobrando todos los meses**, y sus capacidades quedan apagadas porque no hay título. Es
textualmente el modo de falla que `B/16` §4.3 llama *«el que no puede fallar»*: *«un preapproval
huérfano sin cancelar es un débito mensual a alguien que ya no es cliente»*.

**El camino.**

1. Cliente `ACTIVE`, que es el único estado desde el que se puede comprar (`B/16` §2.2: *«Válida es
   `ACTIVE`, y sólo `ACTIVE`»*). Contrata un addon recurrente: `A1` → `PENDING_AUTHORIZATION`, con
   *«mismas 72 h que `S3`»* (`B/03` §8, `A3`).
2. Dentro de esas 72 h la principal deja de ser fila viva. Cualquiera de las cinco sirve; dos no
   necesitan que nadie toque un botón: `S12` (*«llega la fecha de fin de servicio»*) y `S16`, cuyo
   cobro real `PA-3` mide **entre 26 y 44 minutos** después de autorizar.
3. **El disparador de `B/16` §4.3 se dispara ahí, y no encuentra a quién aplicarle.** El §4.3 dice
   *«cuando un título **deja de ser fila viva** … los complementos pueden quedar huérfanos | **se
   cancelan en el proveedor, de inmediato**»*, y la transición que lo ejecuta es `A5`, cuyo `desde`
   es **`ACTIVE`** y nada más (`B/03` §8). La instancia está en `PENDING_AUTHORIZATION`: `A5` no
   aplica.
4. La persona completa el checkout del addon. `A2` → `ACTIVE`, *«recurrente: su propio preapproval
   (`DEC-ADDON-002`)»*. **Ninguna condición de `A2` mira el título**: la validez se chequeó en la
   compra, que es lo que `B/16` §2.2 resuelve.
5. **Y la re-evaluación que el §4.3 promete no tiene evento declarado.** El § dice *«**Y se
   re-evalúa**, porque es una condición sobre estados: el caso que lo obliga es una sucesora que
   autoriza tarde o abandona después de que su predecesora ya murió (§4.2)»* — o sea que nombra
   **un** caso, el de la sucesión, y no el de una instancia que autoriza tarde. No hay fila en
   `B/03` §8 cuyo evento sea *«el addon llega a `ACTIVE` sobre un título que ya no está»*.
6. **Los dos detectores están cerrados.** El de `B/16` §4.3 busca *«un addon **en estado terminal**
   con su preapproval vivo»*; acá la instancia está `ACTIVE`. Y el barrido de `B/09` §3 recorre la
   suscripción de complemento comparando *«estado | el del proveedor, leído por id»*: nuestra fila
   dice `ACTIVE` y el proveedor dice `authorized`. **Coinciden.** La salvedad de `B/09` §3 —la que
   devuelve las terminales de complemento al barrido— tampoco alcanza: esta fila no es terminal.
7. Y la capacidad no se entrega: sin ninguna fuente de clase `TÍTULO`, *«**El pliegue del conjunto
   efectivo DESCARTA las fuentes de clase `COMPLEMENTO`**»* (`12-contrato…` §2.4). Cobra y no
   otorga.

**Dónde lo permite el diseño.** `B/03` §8 (`A1`, `A2`, `A3`, `A5` con su `desde`); `B/16` §2.2 (la
validez se evalúa al comprar), §4.2 (la condición de orfandad) y §4.3 (el disparador, las cinco
transiciones, el detector y *«se re-evalúa»*); `B/09` §3 (qué compara el barrido y cuál es la
salvedad de los terminales); `12-contrato…` §2.4 (el descarte del `COMPLEMENTO`);
`06-mp-validation-matrix.md`, `PA-3`.

**Severidad.** `CRITICA` — débito mensual con dinero real sobre una capacidad que el diseño apaga
en el mismo movimiento, sin ninguna vía de detección. Es la misma forma que `F-8cB2-004` de la
pasada anterior, que el arreglo 14 cerró por la puerta del estado de llegada; **ésta entra por la
ventana de autorización del addon**, que el arreglo no recorrió.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad, y la mitad nueva es la que lo vuelve afirmable.**
Que `A5` salga sólo de `ACTIVE` es anterior a esta tanda. Lo que hizo el arreglo **14** fue mover el
disparador del §4.3 de *«cuando un título muere»* a *«**deja de ser fila viva**»* y **enumerar las
cinco transiciones** que lo cumplen — una lista de **instantes**, y los cinco pueden caer **antes**
de que la instancia llegue a `ACTIVE`. El mismo § declara que la respuesta a eso es *«se
re-evalúa»* y deja la re-evaluación sin evento, que es lo que `NUCLEO/03` regla 1 no admite. Antes
del 14 el disparador era una palabra suelta y el hueco no era alcanzable como afirmación; ahora la
lista está escrita y se puede contar contra la máquina de addon.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es *«deja de ser
fila viva»* y el commit `f5731fd65` toca **`B/16` §4.3 y `B/03` §8 juntos** — las dos mitades del
defecto—, así que la búsqueda *«sobre los capítulos que el commit NO toca»* no las cruza. Y aunque
se hubiera corrido sobre `B/03` §8, lo que hay que ver ahí no es una aparición del término sino
**su ausencia**: la columna `desde` de `A5` dice `ACTIVE` y no dice nada sobre filas vivas. Una
búsqueda de texto encuentra apariciones, no huecos.

---

## ALTAS

### F-8dB2-006 — `S17` y `S18` comparten `(ACTIVE, la sucesora quedó autorizada)` y lo que las separa es un ROL escrito en la columna `desde`, no una guarda: `G-R4` cuenta tres pares o cuatro según cómo lea esa columna, y la regla 7 congela el número que el guard devuelva

**Qué se rompe.** El único control de la regla 7 del núcleo es un guard cuyo predicado está definido
sobre `(desde, evento)`, y la columna `desde` de `B/03` §3.2 **no contiene sólo estados**: en cuatro
de sus diecinueve filas contiene un **rol** dentro de la sucesión. Con eso, `G-R4` tiene dos
comportamientos posibles y los dos son malos: o cuenta un cuarto par y **se pone en rojo sobre el
camino normal de todo cambio de plan**, o está anclado en el texto literal del evento y entonces no
verifica la propiedad que dice verificar.

**El camino.**

1. La regla, textual: `NUCLEO/03` §1 regla 7 — *«**Dos filas que comparten `(desde, evento)` tienen
   guardas disjuntas** … se exige que **las condiciones no se puedan satisfacer las dos a la vez**,
   y una tabla que no lo cumpla es un defecto de la tabla»*. Y su cierre: *«**Que sean tres y no
   cuatro no es una afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**»*.
2. Los tres declarados: `T1`/`T6`, `S5`/`S19` y `S7`/`S19`. Los verifiqué contra las dos tablas y
   son correctos.
3. **El cuarto.** `S17`: `desde` = *«la **predecesora**, si sigue siendo fila viva — las cinco
   alcanzables: **`ACTIVE`**, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`»*, evento =
   *«su sucesora quedó **autorizada**, confirmado por relectura»*, `hacia` = `CANCELLED`. `S18`:
   `desde` = *«la **sucesora**, en **`ACTIVE`**»*, evento = *«**la misma autorización que disparó
   `S2`**, o una resolución de `S15` sobre la sucesión trabada»*, `hacia` = *«el mismo estado»*.
   **Mismo estado de origen, mismo hecho del mundo, dos destinos distintos** — que es exactamente
   la forma que la regla 7 define.
4. **Y lo que las separa no está en la columna condición.** La de `S17` es *«la fila tiene una
   sucesora con `sucede_a` apuntándola»*; la de `S18` es *«la predecesora ya no es fila viva»*, que
   sobre una fila que **no tiene** predecesora no es falsa: es **vacua**. Lo que de verdad las
   separa —predecesora contra sucesora— está escrito **adentro de la celda `desde`**, mezclado con
   los estados.
5. **Y la mezcla no es de dos filas: es de cuatro.** Recorrí las diecinueve filas de la tabla y las
   celdas `desde` que no son un estado son `S13` (*«toda fila viva del beneficiario en cada vertical
   que el grant ancla»*), `S17` (*«la predecesora…»*), `S18` (*«la sucesora…»*) y `S19` (*«la
   predecesora de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED`»*) — más `S14` y `S15`, que
   ponen *«cualquiera»*. **Seis de diecinueve celdas `desde` no son estados.**
6. Con eso, la afirmación del núcleo —*«son tres»*— **depende de qué lee `G-R4` en esa columna**, y
   ninguno de los dos capítulos lo declara. Si lee el estado, hay cuatro y el cuarto se dispara en
   cada cambio de plan que sale bien. Si lee el rol, hay tres — y entonces el guard tiene que
   entender la sucesión, que es justo lo que `B/20` §2.1 advierte que no se puede simular: *«el texto
   con que falla **no puede afirmar más de lo que el predicado verifica**»*.

**Por qué importa aunque el par sea realmente disjunto.** Lo es: `B/02` §2.2 impide que una fila
tenga `sucede_a` y `sucedida_por` a la vez y el candado `B` impide que una sucesora sea sucedida
mientras viva. **El defecto no es que el sistema elija mal: es que el único control de la regla 7
está definido sobre una columna cuyo contenido no está tipado**, y la lección que la misma tanda
sacó de `G-R1-A` aplica igual — *«un guard que falla sobre el camino normal es un guard que alguien
va a relajar»* (`B/20` §2).

**Dónde lo permite el diseño.** `NUCLEO/03` §1 regla 7 (el enunciado, la tabla de tres y la
delegación en `G-R4`); `B/03` §3.2 (las diecinueve filas, y `S13`, `S14`, `S15`, `S17`, `S18`,
`S19`); `B/20` §2 (`G-R4` y §2.1); `V/20` §2 (la definición de `G-R4`); `V/03` §2 (*«es **el
único** par `(desde, evento)` con dos destinos distintos de esta épica**, y uno de los **tres** que
el diseño declara hoy»*).

**Severidad.** `ALTA` — no mueve plata por sí solo: el par es disjunto de verdad. Lo que queda sin
apoyo es la regla que garantiza que **los próximos** pares lo sean, sobre la tabla que la tanda
acaba de hacer crecer de dieciséis filas a diecinueve.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 8**, que partió `S17` de `S18`, cruzado con el
**12**, que agregó `S19` y con él los dos pares nuevos que obligaron a escribir la regla 7 y su
tabla. La regla y el guard se escribieron contando los pares que el arreglo **sabía** que había
creado; la fila que el mismo arreglo creó al lado —`S18`, con `ACTIVE` en su `desde`— no se contó.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es *«`(desde,
evento)`»* / *«los tres pares»*, y las apariciones están en `NUCLEO/03` §1, `V/03` §2 y `B/20` §2 —
los tres **tocados por el mismo commit del trial** (`49eb99f34`) o por el de la sucesión. Y lo que
hay que ver no es una aparición: es que una celda `desde` de la tabla nueva repite un estado que
otra fila ya usa con el mismo hecho. **Eso se cuenta recorriendo la tabla, no buscando un
término** — es el modo que `DEC-METH-009` declara que no cubre, con otra cara.

---

### F-8dB2-007 — «Espejar la baja decidida por el proveedor» no es ninguna fila de `B/03` §3.2: la baja por mora, que `B/12` §1.4 declara el final normal de ese camino, es una transición no declarada — y es la SEXTA que saca una fila principal de las filas vivas, contra las cinco que `B/16` §4.3 enumera

**Qué se rompe.** El cliente al que **el proveedor** da de baja por impagos acumulados no llega a
`CANCELLED`: llega a la **marca**. La regla 1 del núcleo convierte el desenlace normal del camino de
mora en un incidente, y mientras tanto la fila conserva el estado que tenía —`GRACE_PERIOD`, que
**emite fuente** con servicio entero— sobre un preapproval que el proveedor ya canceló.

**El camino.**

1. `B/12` §1.4 declara el hecho y lo declara normal: *«Si el proveedor da de baja la suscripción por
   su cuenta tras acumular impagos, **eso es un hecho suyo** (§64.18) y entra por la regla de
   no-retroceso: se relee y se escribe lo leído»*, con su consecuencia operativa: *«en el camino de
   mora, **cuándo se termina el vínculo no lo decidimos nosotros**. Nuestro grace puede ser más
   largo que la paciencia del proveedor»*.
2. `B/03` §10.1 le da su celda: *«| `cancelled` | **cualquier estado vivo que no sea
   `CANCEL_SCHEDULED`** | **`S12`** si hay una baja programada; si no, **espejar la baja decidida
   por el proveedor** (`B/12` §1.4) |»*.
3. **Y el mismo § declara que espejar tiene que ser una fila de la tabla:** *«**Espejar un estado
   leído por id es una transición declarada de esta tabla, no un acto aparte.**»* Y explica por qué
   se enumeró en vez de hacer una excepción: *«La excepción … abría un camino que **escribe estado
   sin transición declarada**, que es exactamente lo que la regla 1 existe para impedir»*.
4. **No hay tal fila.** Recorrí las diecinueve de `B/03` §3.2 buscando `hacia = CANCELLED`: son
   **tres** — `S12` (desde `CANCEL_SCHEDULED`), `S13` (grant) y `S17` (sucesión). **Ninguna sale de
   `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED` o `PAUSED` por una baja del proveedor.** El propio §10.1 lo
   dice al descartar `S12` en ese caso.
5. Entonces la celda que el §10.1 escribió para cerrar el choque con la regla 1 **lo reabre en su
   propio renglón**: se relee `cancelled`, hay que espejar, no hay transición → regla 1 → *«se
   registra como evento de dominio y, si tocaba plata o estado, **pone la marca**»*.
6. **Y es la sexta transición que saca una fila principal de las filas vivas**, contra las **cinco**
   que `B/16` §4.3 enumera (*«`S3`, `S12`, `S13`, `S16` y `S17`»*) y contra las **seis** de la tabla
   de recorrido de `B/03` §3.2, ninguna de las cuales es ésta. El propio §4.3 se defiende —*«si
   mañana entra una sexta, **el predicado ya la cubre**»*—, y es cierto para el addon; **lo que no
   cubre es la lista, que el mismo § declara que existe *«para poder auditar que ninguna se
   olvidó»***. Se olvidó una, y no es hipotética: es la que `B/12` §1.4 declara inevitable.

**Y el mismo hueco alcanza a tres conteos más, que verifiqué uno por uno.** `B/09` §3 justifica la
exención de los tres terminales enumerando quién canceló el preapproval en cada uno —*«`S3` canceló
el preapproval …, `S12` y `S17` lo cancelan …, y en `CHARGE_DECLINED` **lo canceló el proveedor**»*—
y no nombra la cuarta forma de llegar a `CANCELLED`, que es que el proveedor cancele una fila que no
está en `CANCEL_SCHEDULED`. `12-contrato…` §2.6 afirma *«no es alcanzable por ningún otro camino»*
contando **seis** transiciones de la ventana. Y `B/20` §2 explica `G-R1-A` contando *«**seis**
transiciones normales»*. Los tres conteos están hechos sobre la misma tabla incompleta.

**Dónde lo permite el diseño.** `B/03` §10.1 (la celda y el bloque *«espejar … es una transición
declarada de esta tabla»*) y §3.2 (las tres filas con `hacia = CANCELLED` y la tabla de recorrido de
seis); `B/12` §1.4; `B/16` §4.3 (las cinco y el para qué de la lista); `B/09` §3 (la exención de los
tres terminales y su justificación); `12-contrato…` §2.6; `B/20` §2 (`G-R1-A`);
`NUCLEO/03` §1 regla 1.

**Severidad.** `ALTA` — el daño de plata está acotado: la marca lleva a un humano y el reloj del
grace, si no hay pago pendiente, termina suspendiendo. Lo que se rompe es que **el final normal del
camino de mora es un incidente**, sobre la parte de la cartera que más crece, y que la lista de
auditoría que la tanda escribió para poder preguntar *«¿están todas?»* contesta que sí cuando falta
una.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, y con un sujeto nuevo.** La tabla par-por-par es
del arreglo 18 de la tanda anterior, y sus pares faltantes los reporté como `F-8cB2-005` (`C1` lo
dejó en `ALTA`). **Esto no es aquello**: aquél era sobre pares que la tabla **no lista**; éste es
sobre un par que la tabla **sí lista**, con un veredicto que nombra una transición inexistente. Lo
que lo vuelve afirmable ahora es el arreglo **14**, que enumeró *«las cinco transiciones que sacan
una fila principal de las filas vivas»* y creó por primera vez una lista contra la cual contar.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, en su mitad de la lista.** El término
redefinido por el 14 es *«deja de ser fila viva»* / *«las cinco transiciones»*. El commit
`f5731fd65` no toca `B/12`; un `rg "baja decidida por el proveedor"` o `rg "1.4"` sobre `B/12`
devuelve el §1.4 y su declaración de que la baja por mora la decide el proveedor, que es
exactamente la sexta. Resolver esa aparición es preguntarse con qué fila de `§3.2` se espeja.

---

### F-8dB2-008 — «Son dos filas y un solo acto: o corren las dos o no corre ninguna» contradice la tabla de seis del mismo §, y el peligro que declara para `S18` sin `S17` no existe en ninguno de los casos que su propia tabla enumera

**Qué se rompe.** El párrafo que la tanda escribió para explicar por qué `S17` y `S18` son dos filas
termina prohibiendo la combinación que su propia tabla de seis exige. Quien implemente la frase
—*«o corren las dos o no corre ninguna»*— **bloquea `S18` cada vez que la predecesora murió por otra
transición**, y eso deja el candado `A` **vacío**, que es el estado que el mismo § describe como el
que permite *«que un alta nueva entre sin que nada la rechace y queden dos preapprovals cobrando»*.

**El camino.**

1. El párrafo, textual (`B/03` §3.2): *«**Son dos filas y un solo acto: o corren las dos o no corre
   ninguna.** Partirlas es lo que hace que el cierre sea alcanzable —`S18` no depende de que `S17`
   tenga sujeto—, **no una licencia para ejecutar una sin la otra**: `S17` sin `S18` deja el candado
   `A` **vacío**, y **`S18` sin `S17` deja viva una autorización que el `D7` manda cancelar**. Lo
   vigila `G-R1-C`»*.
2. **La tabla de seis, doce líneas más arriba, dice lo contrario.** En tres de los seis casos la
   predecesora deja de ser fila viva **sin `S17`** —`S12`, `S13` y `S16`—, y el § cierra: *«las tres
   últimas ya no lo son, y ahí **`S17` simplemente no aplica: no hay nada que cancelar y no hay nada
   que matar**. **En los seis casos `S18` corre igual**»*.
3. **Y el peligro que la frase declara para esa combinación es falso en los tres.** *«`S18` sin
   `S17` deja viva una autorización que el `D7` manda cancelar»*: en `S12` el preapproval lo canceló
   `S11` *«de inmediato»* (`DEC-SUB-009`); en `S13` lo cancela el efecto del propio `S13`; en `S16`
   **lo canceló el proveedor en el mismo milisegundo del rechazo** (`B/12` §4.4, medido el
   2026-09-17). Lo verifiqué contra `B/09` §3, que usa exactamente ese argumento para eximirlos del
   barrido. **En los tres casos `S18` sin `S17` no deja viva ninguna autorización.**
4. Y `G-R1-C`, que la frase invoca como su vigilancia, **no vigila eso**: su predicado es *«un camino
   escribe **`sucedida_por` sin limpiar `sucede_a`**, o limpia `sucede_a` sin escribir
   `sucedida_por`»* (`B/20` §2) — las dos mitades **de `S18`**, no el emparejamiento de `S17` con
   `S18`. La frase promete un guard para una propiedad distinta de la que el guard verifica, que es
   lo que `B/20` §2.1 prohíbe con esas palabras.
5. Si alguien implementa la frase igual: predecesora muerta por `S12`, sucesora autoriza, `S18`
   bloqueado por falta de `S17`. La sucesora conserva `sucede_a`, el candado `A` queda vacío, y lo
   detecta `B/09` §3 —*«`S18` no corrió. Se pone la **marca**»*—. O sea: el camino normal del
   arrepentimiento termina en un incidente, detectado, pero incidente.

**Dónde lo permite el diseño.** `B/03` §3.2 (el párrafo *«Son dos filas y un solo acto»*, la tabla
de seis y su cierre, `S12`, `S13`, `S16`, `S17`, `S18`); `B/20` §2 (`G-R1-C` y §2.1); `B/09` §3 (la
justificación de la exención de terminales y la comprobación de la sucesión abierta); `B/12` §4.4;
`01-decision-log.md`, `DEC-SUB-009`.

**Severidad.** `ALTA` — no mueve plata mal por sí solo y el desenlace está detectado por `B/09`. Lo
que rompe es la única frase que un implementador va a leer para decidir si puede correr `S18` sin
`S17`, y la respuesta correcta es **sí, en tres de los seis casos** que la misma página enumera.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 8.** El párrafo se escribió en el mismo acto que
partió `S17` de `S18`, y su primera mitad es correcta y es la razón del arreglo. La segunda mitad
—la advertencia simétrica— se escribió por simetría retórica y **no se verificó contra la tabla que
el mismo arreglo puso al lado**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es `S17`/`S18` y
las dos mitades del choque están **en el mismo § del mismo capítulo, escritas en el mismo commit**
(`3692d5deb` sobre `B/03` §3.2). La regla busca afuera del commit; esto es una contradicción interna
a doce líneas de distancia, del mismo tipo que `B/02` §2.2 documenta para el verbo *«declarar»*
(*«Las dos lecturas eran razonables y estaban a quince líneas de distancia»*).

---

### F-8dB2-009 — La regla que `B/02` §2.2 llama deliberada —«mientras la marca esté puesta, ningún `sucede_a` puede apuntarla»— no la hace cumplir nada: ni los dos índices parciales, ni la condición de `S1`, ni `G-R1-A`, que es el guard del acto de declarar

**Qué se rompe.** La única defensa que el diseño le pone a *«cancelar y recrear con una divergencia
de plata sin resolver»* —el movimiento que `DEC-CONC-002` parte 4 manda que mire una persona— está
enunciada como una prohibición firme y **no tiene dónde ejecutarse**. Y la excepción que lleva
encima, con su relectura obligatoria, es una salvedad de una regla que nada aplica.

**El camino.**

1. La regla, textual: `B/02` §2.2 — *«**Y la marca sí bloquea algo, a propósito**: mientras esté
   puesta sobre una fila, **ningún `sucede_a` puede apuntarla** — o sea que esa fila no puede ser
   sucedida»*. Y su excepción: *«una fila marcada **puede suceder cuando está en
   `CANCEL_SCHEDULED`, si una relectura del preapproval por su id confirma que efectivamente está
   cancelado**»*, con el párrafo que explica por qué la verificación *«es lo que la vuelve
   segura»*.
2. **La base no la aplica.** Los dos índices parciales de §2.2 filtran por `clase`, `sucede_a` y
   `estado ∈ {vivos}`; **ninguno menciona `requiere_conciliación`**. Y §5, que enumera *«los que la
   base puede hacer cumplir sola»*, lista cinco filas y ésta no está.
3. **La tabla de transiciones no la aplica.** La condición de `S1` es, entera: *«no hay otro
   **origen** vivo para ese `user + vertical`, **o la fila declara una sucesión** (`sucede_a`)»*
   (`B/03` §3.2). No nombra la marca. Y `B/03` §3.3 la enuncia **como prosa**, no como condición:
   *«una fila **con la marca `requiere_conciliación` puesta no puede ser sucedida**»*.
4. **Y el guard tampoco.** `G-R1-A`, entero: *«el camino que declara una sucesión escribe `sucede_a`
   apuntando a una predecesora que **en ese acto** está fuera de
   `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, o a una que a su vez tenga `sucede_a` no nulo»*
   (`B/20` §2). Dos cláusulas, y ninguna es la marca. Peor: la excepción del §2.2 vive
   **exactamente** en `CANCEL_SCHEDULED`, que es uno de los tres estados que `G-R1-A` **permite**,
   así que ni siquiera cae del lado prohibido por accidente.
5. Y `B/20` §2 afirma la completitud: *«**Los cuatro de `R1` son la contracara de las dos claves, y
   conviene decir qué impide cada uno**»*, con el reparto *«`A` vigila cómo nace la sucesión, `C`
   cómo termina, y `D` lo que puede pasar mientras dura»*. La marca es parte de *«cómo nace»* y `A`
   no la mira.

**Dónde lo permite el diseño.** `B/02` §2.2 (la regla, la excepción con relectura y los dos
índices) y §5 (lo que la base sostiene sola); `B/03` §3.2 (`S1`) y §3.3; `B/20` §2 (`G-R1-A` y el
párrafo de los cuatro `R1`); `01-decision-log.md`, `DEC-CONC-002` parte 4.

**Severidad.** `ALTA` — habilita el movimiento que el diseño identifica como el peligroso: una fila
con una divergencia de plata abierta puede ser sucedida y quedar `CANCELLED` por `S17`, cerrando el
caso del lado del cliente con el dinero sin conciliar y con el preapproval de la predecesora en
estado indeterminado, que es la premisa que la marca pone en duda. No la subo a `CRITICA` porque
para que haya doble cobro hace falta además que la cancelación de `S17` falle, y esa rama sí está
declarada.

**¿Es nuevo, o es el arreglo?** **La regla es anterior; lo que esta tanda agregó es la afirmación de
completitud que la vuelve contable.** La marca salió de la tanda 9-bis (el retiro de
`RECONCILIATION_REQUIRED`); lo nuevo es que el arreglo **8** re-ancló `G-R1-A` *«al ACTO de
declarar»* y el catálogo pasó a declarar que los cuatro `R1` cubren los tres momentos de la
sucesión. Re-escribir el predicado de `G-R1-A` era el momento exacto para incorporar la segunda
prohibición del §2.2, y se re-escribió sin ella.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término que el arreglo 8 redefine es
*«el acto de declarar»* / `sucede_a`, y buscarlo en los capítulos que el commit no toca sí lleva a
`B/02` §2.2 — pero lo que hay que ver ahí es una **segunda** regla sobre `sucede_a` escrita con
otro término, `requiere_conciliación`, que el arreglo no redefinió y por lo tanto no iba a buscar.
La regla nombra **un** término por arreglo; acá hace falta cruzar dos.

---

### F-8cB2-010 (sigue llegando) — La cortesía otorgada durante la ventana de una sucesión sigue muriendo con la predecesora: `S18` enumeró por fin qué se re-apunta, y nombró sólo los complementos

**Qué se rompe.** Lo mismo que reporté en la 8-bis-2 y con el mismo desenlace: un `SUPER_ADMIN`
firma una cortesía, el cliente completa un cambio de plan que ya tenía en curso, y la cortesía
desaparece — la fila de `courtesy_grant` sobrevive apuntando a una suscripción `CANCELLED`, deja de
emitir fuente, y nadie la re-apunta.

**En qué paso llega ahora.** El arreglo **10** creó el acto que faltaba —`S18`— y le puso una lista
**explícita** de qué se arrastra al cerrar la sucesión: *«se escribe **`sucedida_por`** en la
predecesora, se **limpia `sucede_a`** en la sucesora, y **los complementos de la predecesora se
re-apuntan a ella** (`B/16` §4.2)»* (`B/03` §3.2). Verifiqué qué cuelga hoy de una suscripción y son
**tres** cosas: los complementos (`B/16` §4.2), el contador de promos (`B/14` §2.2) y
**`courtesy_grant.subscription_id`**, que `B/02` §2.4 declara **no anulable** y que
`DEC-GRANT-006` acaba de dejar como **la única referencia que la cortesía tiene** al retirarle el
`scope` (*«Una cortesía cubre **la suscripción que pausa**, y nada más»*). La lista de `S18` nombra
una de las tres.

**Lo que cambió respecto de la pasada anterior, y empeora el caso.** Antes el re-apunte era *«en el
mismo acto del upgrade»*, sin instante y sin inventario: se podía leer como que arrastraba todo.
Ahora hay una enumeración cerrada en la columna de efectos de una transición, y por la regla 1 del
núcleo **lo que no está enumerado no pasa**. Y `DEC-GRANT-006` cerró la única salida alternativa:
sin `scope`, la cortesía no puede reemitirse sobre otra vertical ni sobre otra fila sin un acto
administrativo nuevo, y `B/02` §2.4 remata que *«si alguna vez se quiere el gesto único, es una
acción de superficie … **no una columna que vuelve al modelo**»*.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S9`, `S17`, `S18` columna efectos) y §5;
`B/02` §2.4 (`courtesy_grant.subscription_id` no anulable, y el desarrollo de `DEC-GRANT-006`);
`12-contrato…` §2.3 y §2.6 (una `PAUSED` por `COURTESY` emite, una `CANCELLED` no);
`B/16` §4.2; `B/14` §2.2; `01-decision-log.md`, `DEC-GRANT-004` y `DEC-GRANT-006`.

**Severidad.** `ALTA` — se pierde un beneficio firmado por `SUPER_ADMIN`, en silencio: el barrido no
compara grants, la fila no queda marcada, y el cliente lo nota cuando le cobran. No es `CRITICA`
porque la fila del grant sobrevive y una persona puede volver a emitirlo.

**¿Es nuevo, o es el arreglo?** Es **`F-8cB2-010` que sigue llegando**, con su ID viejo como pide el
§4 de las instrucciones. La mitad nueva es del arreglo **10**: la enumeración de efectos de `S18`
era la oportunidad de nombrar la tercera entidad y la enumeración se escribió con dos.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término redefinido por el 10 es
`sucedida_por` / *«se re-apuntan»*. El commit `3692d5deb` toca `B/02` §2.2 y `B/16` §4.2, **no toca
`B/02` §2.4** como sujeto de la cortesía ni `B/14`; un `rg "subscription_id"` o `rg "cortesía"`
sobre `B/02` §2.4 devuelve la columna no anulable y su justificación —*«una cortesía presupone una
suscripción, y la fila no decía cuál»*— que es exactamente la aparición a resolver contra la
sucesión.

---

## MEDIAS

### F-8dB2-010 — El segundo evento de `S18` nombra la única rama en la que su propia condición es, por el mismo §, insatisfacible

**Qué se rompe.** La salida que `S15` le promete a una sucesión trabada queda descrita en dos
lugares que se contradicen, y el que un implementador va a leer primero —la columna evento de la
tabla— manda escribir una escritura que la base rechaza.

**El camino.**

1. `S18`, columna evento: *«la misma autorización que disparó `S2`, **o una resolución de `S15`
   sobre la sucesión trabada**»* (`B/03` §3.2). Columna condición: *«la predecesora **ya no es fila
   viva**»*.
2. El mismo § define la rama trabada y declara que ahí la condición **no se cumple**: *«**La única
   rama en la que la sucesión NO se cierra es que la cancelación en el proveedor falle sobre un
   preapproval que la relectura vio vivo.** Ahí `S17` no ocurre, **`S18` tampoco —su condición no se
   cumple**—, la marca se pone y una persona lo mira»*. La predecesora sigue viva por definición de
   la rama.
3. Y el § explica qué pasa si alguien la corre igual: *«limpiar `sucede_a` ahí sería, además de
   mentira, **imposible** — la sucesora pasaría a competir por el candado `A` con una predecesora
   que lo sigue ocupando, **y la base rechaza la escritura**»*.
4. **La salida real es otra, y el § la tiene escrita**: *«el disparador de las dos es un **ESTADO**,
   no una entrega … se puede volver a evaluar mañana»*, así que la persona resuelve cancelando el
   preapproval, `S17` se re-evalúa y corre, y **recién entonces** `S18`. O sea que el evento de `S18`
   que corresponde a la resolución humana es el del caso **contrario** al que su celda nombra: aquél
   en que `S17` **sí** corrió y `S18` no —el estado que `B/09` §3 detecta con su comprobación de
   *«sucesión abierta sobre una fila muerta»*—, que es el único en que la condición se cumple y
   nadie la ejecutó.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S18`, la nota de la rama trabada y el párrafo *«el
disparador de las dos es un ESTADO»*), `S15`, `S17`; `B/02` §2.2 (el candado `A`); `B/09` §3.

**Severidad.** `MEDIA` — el camino correcto existe y está escrito en el mismo §; lo que está mal es
la celda que lo nombra. Es la clase de defecto que `F-8cB2-011` describió en la pasada anterior: una
razón caduca bajo una conclusión correcta, que ningún guard ve.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 8**, y responde a mi `F-8cB2-014`. La respuesta
—hacer el disparador re-evaluable— es correcta y cierra el hallazgo; la celda se escribió nombrando
la rama trabada porque era la del hallazgo, sin verificar contra la condición de su propia fila.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No**: las dos mitades están en la misma fila
y en el mismo § del mismo commit.

---

### F-8dB2-011 — La tabla de «los tres estados de la relación» omite el cuarto —la sucesión que murió sin cerrarse— y su columna de candados es falsa para él

**Qué se rompe.** El § que declara *«el dominio queda recorrido en los dos ejes»* publica una tabla
de tres estados que no tiene fila para el caso que `B/16` §4.2 nombra explícitamente, y su columna
*«qué candado ocupa»* dice algo falso para ese caso. Es la mitad documental de `F-8dB2-001`, y la
separo porque la corrección es otra: aquélla se arregla agregando *«viva»* a cuatro predicados, ésta
agregando una fila a una tabla.

**El camino.**

1. La tabla (`B/03` §3.2): tres filas — *«no hay sucesión»* (`sucede_a` nulo y `sucedida_por` nulo),
   *«sucesión en curso»* (la sucesora con `sucede_a` no nulo, *«`A` la predecesora, **`B` la
   sucesora**»*) y *«sucesión terminada»*.
2. **El cuarto estado:** la sucesora murió con `sucede_a` puesto —`S3` a las 72 h, o `S13`— y nadie
   lo limpió. No es *«no hay sucesión»* (el puntero está), no es *«terminada»* (`sucedida_por` es
   nulo), y la fila *«en curso»* miente en su columna de candados: la sucesora **no ocupa `B`**,
   porque el índice es parcial sobre `estado ∈ {vivos}` (`B/02` §2.2) y una `ABANDONED` no está
   entre los seis.
3. **`B/16` §4.2 sí lo nombra**, y lo cuenta como uno de los tres: *«son los **tres** estados de la
   relación que `B/03` §3.2 recorre: sucesión **en curso** (una fila viva con `sucede_a`
   apuntándola), sucesión **terminada** (`sucedida_por` no nulo) y **no hay sucesión que la releve**
   —nunca la hubo, **o la que hubo se murió sin cerrarse**—»*. Verificado contra el texto: los dos
   capítulos dicen *«tres»* y **no son los mismos tres**. `B/16` funde *«nunca la hubo»* con *«se
   murió sin cerrarse»*; `B/03` tiene *«no hay sucesión»* y no tiene la segunda.
4. Y el mismo `S13` produce el cuarto por escrito: *«la sucesora queda `CANCELLED` **con su
   `sucede_a` escrito**, que es el registro fiel de lo que pasó»* (`B/03` §3.2) — una fila que
   ninguna de las tres describe.

**Dónde lo permite el diseño.** `B/03` §3.2 (la tabla de tres, `S3`, `S13`, `S18`);
`B/16` §4.2 (los *«tres»* que no son los mismos); `B/02` §2.2 (los índices parciales y las tres
viñetas de las dos columnas).

**Severidad.** `MEDIA` — por sí sola es una tabla incompleta; su consecuencia de plata está contada
en `F-8dB2-001`, y no la cuento dos veces.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 10.** La tabla de tres es la que el arreglo puso
para demostrar que la segunda columna cerraba el dominio, y se recorrió sobre las salidas de la
**predecesora** sin recorrer las de la **sucesora** — que es el mismo eje que el § anterior se
felicita por haber agregado (*«La versión anterior de este § recorrió el dominio sobre la
sucesora … y puso la precondición sobre la predecesora, que es el eje que no recorrió»*), invertido.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí**, por el mismo camino que
`F-8dB2-001`: `rg "sucede_a"` sobre `B/16`, que el commit no toca, devuelve la enumeración de tres
estados de §4.2 y basta ponerlas una al lado de la otra.

---

### F-8dB2-012 — `G-R4` declara cubrir «las seis tablas de esta épica» y «las nueve máquinas»: conté cuatro tablas de transiciones en billing y siete en el programa, y las dos que faltan son las dos que el núcleo declara que no son máquinas

**Qué se rompe.** El guard al que `NUCLEO/03` §1 le delega el número de pares —*«Que sean tres y no
cuatro … es lo que `G-R4` cuenta en cada PR»*— tiene su alcance declarado sobre un conjunto que no
existe. Un guard que declara mirar seis tablas y encuentra cuatro, o no falla y nadie se entera, o
falla por una razón que no es la suya.

**Los conteos, medidos por mí el 2026-09-21** con
`rg "^\| # \| desde \| evento" HOS-1354-…/docs/ HOS-1353-…/docs/`:

| épica | tablas de transiciones | cuáles |
|---|---|---|
| billing | **4** | `B/03` §3.2 (suscripción), §6 (pago), §7 (pago manual), §8 (addon) |
| verticales | **3** | `V/03` §2 (trial), §9 (publicación), §11 (postulación de Partner) |
| **total** | **7** | |

Contra lo que declaran los dos catálogos: `B/20` §2, fila `G-R4` — *«cubre las **seis** tablas de
esta épica»*; `V/20` §2, fila `G-R4` — *«sobre las **nueve** máquinas, en las dos épicas»*.

**Y las dos que sobran tienen nombre.** `NUCLEO/01` §2.2 y `NUCLEO/03` §1 regla 6 declaran que
**Grace y Pausa no son máquinas propias**: *«Son sub-estados de Suscripción con reloj propio y datos
propios»*. `B/03` §4 y §5 las describen con tablas de dos columnas (*«| |»*), sin `desde` ni
`evento`. El número nueve sale del §63 del PDR más Partner; el número de **tablas** es siete, y el de
billing es cuatro, no seis.

**Dónde lo permite el diseño.** `B/20` §2 (`G-R4`); `V/20` §2 (`G-R4`); `NUCLEO/03` §1 reglas 6 y 7;
`NUCLEO/01` §2.2; `B/03` §4 y §5.

**Severidad.** `MEDIA` — no hay daño de plata y las cuatro tablas reales sí están adentro de
cualquier lectura razonable del alcance. Lo que queda mal es el único número que la regla 7 no
verifica por sí misma y delega, y las instrucciones de esta fase son explícitas en que un conteo se
cuenta.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 3**, que creó `G-R4` y la regla 7 en el mismo
acto. El alcance se escribió contra el número de máquinas del §63, no contra el número de tablas del
corpus.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es `G-R4`, y sus
apariciones están en los dos capítulos de testing y en el núcleo, los tres tocados por el mismo
commit del trial. Y lo que hay que comprobar no es una aparición del término: es **contar las
tablas**, que es lo que hace el propio guard.

---

## BAJA

### F-8dB2-013 — La rama 4 deja el pago marcado «pendiente de resolución» sobre una fila terminal que el barrido no alcanza, así que la bandera no la apaga nadie

**Qué se rompe.** Cuando cae un grant *Free Forever* sobre una sucesión con un pago pendiente por
`S19`, `B/12` §5.3 rama 4 decide **no reembolsar** (`DEC-GRANT-001`). Nada declara que la bandera
*«pendiente de resolución»* se levante, y la fila queda `CANCELLED` —terminal— así que la segunda
comprobación de `B/09` §3 tampoco la alcanza para cerrarla.

**El camino.** `S13` lleva las dos filas a `CANCELLED` (`B/03` §3.2). `B/12` §5.3, rama 4: *«no se
reembolsa, y es una excepción declarada»* — sin decir qué pasa con la marca del pago. `B/09` §3
recorre sólo lo no terminal. `B/03` §3.2, `S19`: la bandera existe para que *«`S6` no corra»*, y
sobre una `CANCELLED` `S6` es irrelevante, así que no hay consecuencia operativa.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S13`, `S19`); `B/12` §5.3 (rama 4); `B/09` §3.

**Severidad.** `BAJA` — el desenlace de plata es el correcto y está decidido; lo que queda es un
registro que dice *«pendiente»* para siempre sobre un caso cerrado, y que cualquier informe o
tablero que cuente pagos pendientes va a contar de más.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 13**, que escribió las cuatro ramas. Tres de las
cuatro tienen un acto que apaga la bandera; la cuarta decide no hacer nada y no dice que eso incluya
apagarla.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** No aplica al conteo de críticos; y la respuesta
es **no**, por la misma razón que `F-8dB2-003`: las dos mitades viven en capítulos del mismo commit.

---

## Ataques que intenté y el diseño resistió

Once, y van porque el valor de esta sección es que la próxima pasada no los repita.

1. **`S17` deja dos filas vivas si la cancelación al proveedor tarda o falla.** Cerrado, y bien. La
   rama está declarada entera en `B/03` §3.2 (*«Ahí `S17` no ocurre, `S18` tampoco … la marca se
   pone»*), su costo de cobertura está escrito en `12-contrato…` §2.6 (*«Dos fuentes `SUSCRIPCIÓN`
   de clase `TÍTULO` … son posibles, y sólo en ese caso»*) y el § explica por qué no se desempata
   (*«en esa rama el cliente está pagando las dos»*). Lo verifiqué contra los dos textos.

2. **El arrepentimiento desde `CANCEL_SCHEDULED` termina en `400` medido y deja la sucesión abierta
   para siempre** (`F-8cB2-006`, y era el defecto #8 de los diecisiete). **Cerrado por el arreglo
   8.** El efecto de `S17` pasó a ser condicional —*«se cancela en el proveedor **si su preapproval
   sigue vivo**; si la relectura dice que ya está `cancelled`, `D7` **ya está cumplido y no se manda
   nada**»*— y el §3.3 lo escribe otra vez en la celda del arrepentimiento con `PA-5` citado. El
   camino normal deja de ser un incidente garantizado.

3. **`S17` declara estados de predecesora que `G-R1-A` declara violación** (`F-8cB2-007`).
   **Cerrado por el arreglo 8**, y por el lado correcto: `G-R1-A` pasó a vigilar *«el **ACTO** de
   declarar»* con el conjunto de tres, y `S17` pasó a nombrar las cinco alcanzables **con su
   derivación escrita** —la tabla de seis transiciones—. Verifiqué las cinco contra esa tabla y
   contra las salidas de los tres estados de origen: `PENDING_AUTHORIZATION` es el único de los seis
   vivos que no puede alcanzarse, porque ninguna transición llega a él salvo `S1`. La derivación es
   correcta.

4. **`S13` deja viva la obligación que no ve** (el defecto #9 de los diecisiete). **Cerrado por el
   arreglo 9** en su mitad de la sucesora: `PENDING_AUTHORIZATION` está adentro con su párrafo de
   justificación y el efecto cancela *«esté autorizado o esperando autorización»*. Lo que el mismo
   arreglo abrió del otro lado es `F-8dB2-002`.

5. **El candado `A` queda vacío cuando `S17` corre y `S18` no.** No pasa sin detección: `B/09` §3
   agregó una comprobación que cuesta cero llamadas —*«si una fila … tiene `sucede_a` no nulo y la
   predecesora ya no es fila viva … se pone la **marca**»*— con su excepción para la sucesora en
   `PENDING_AUTHORIZATION` correctamente acotada por *«con su ventana abierta»*. Intenté que la
   excepción tapara el caso real y no: cuando la ventana vence, `S3` la mata y la fila sale del
   barrido por terminal, no por la excepción.

6. **`G-R1-C` se puede satisfacer escribiendo las dos mitades sobre filas equivocadas.** No: el
   predicado nombra las dos columnas y las dos filas (*«`sucedida_por` en la predecesora … `sucede_a`
   en la sucesora»*), `B/02` §2.2 prohíbe que las dos estén puestas en la misma fila, y `B/20` §2.1
   pide el caso que lo rompe a propósito. El guard es de la forma correcta y es estático de verdad —
   a diferencia de `G-R1-B`, cuya segunda mitad sigue sin poder correr sin red (`F-8cB2-009`,
   `NUCLEO`, para la pasada C).

7. **La condición 3 del pago tardío se puede evaluar cuando el pago llega tarde de verdad.** Sí:
   el arreglo la partió sobre las dos columnas (*«`sucedida_por` no nulo … o una sucesora con
   `sucede_a` apuntándola que ya autorizó»*) y `B/05` §3 explica por qué una sola no alcanzaba.
   Intenté el caso *«llega el pago después del cierre»* y la condición lo contesta bien. **Lo que no
   contesta es el caso simétrico** —la sucesora murió— y eso es `F-8dB2-001`.

8. **Un `S15` humano puede ejecutar `S5` sobre una predecesora y saltear `G-R1-D`.** No lo sostengo:
   `S15` dice *«se ejecuta **la transición de esta misma tabla** que lo permita»*, así que pasa por
   la guarda de `S5`, y `G-R1-D` vigila los tres sitios donde la regla se ejecuta. El agujero del
   pago manual no es éste: es que `S19` no lo admite (`F-8dB2-004`).

9. **Dos webhooks del mismo preapproval en paralelo producen dos `S17`.** No: `UNIQUE(proveedor,
   id_del_hecho)` (`B/05` §C6) más la concurrencia optimista de `B/03` §10.3 —*«una escritura que no
   coincide no reintenta a ciegas: vuelve a leer y **reevalúa la transición contra la tabla**»*—, y
   `S17` reevaluado sobre una predecesora ya `CANCELLED` no tiene sujeto. El mecanismo está completo.

10. **`S19` se puede disparar dos veces sobre el mismo cobro reciclado.** No: la deduplicación es por
    id del hecho (`B/03` §10.2, `B/05` §C6) y `S19` no cambia de estado, así que su reejecución es
    idempotente por construcción. Anoto el intento porque el efecto de `S19` —*«el pago se registra
    y queda pendiente»*— es una escritura y podría haberlo sido; el `UNIQUE` sobre `payment` la
    cubre.

11. **Una pausa tomada dentro de la ventana de la sucesión se pierde con la predecesora.** Lo volví a
    intentar y sigo sin sostenerlo como hallazgo propio, por la misma razón que la pasada anterior:
    la cuota del §26.3 se cuenta por `user + vertical` y *«sobrevive a cancelar y volver a
    suscribirse»* (`DEC-SUB-004`), así que consumirla es la política y no un defecto. Lo que sí se
    pierde en ese camino es la cortesía, y va como `F-8cB2-010`.

---

## Lo que cae fuera de mi vector, y a quién le toca

- **El monto exacto del crédito** cuando el pago pendiente se reembolsa o se conserva (las ramas 1 y
  2 de `B/12` §5.3 vistas desde `DEC-SUB-006`): es de `B1`.
- **`F-8dB2-002` visto desde la cobertura** —qué le pasa a `PB2` y al reconciliador de excedentes
  cuando un beneficiario de *Free Forever* pierde sus addons en el acto del regalo— es de `A2`.
- **La detección de `F-8dB2-005` desde el barrido** —si el inventario de complementos tiene que
  cruzarse contra el título y no sólo contra el proveedor— se toca con `B3`.
- **`G-R1-B`, segunda mitad** (`F-8cB2-009` de la pasada anterior): el reparto de niveles de `D8` es
  de `nucleo/04`. **`NUCLEO`**, para la pasada C.
- **`F-8dB2-006` y `F-8dB2-012`** son defectos de la regla 7 y de su guard, que viven en
  `NUCLEO/03` §1. La mitad corregible del primero es la columna `desde` de `B/03` §3.2 y por eso va
  acá; **el enunciado de la regla y el alcance del guard son `NUCLEO`**.
