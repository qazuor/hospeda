---
title: "FASE 8 completa · A1 — Acceso cruzado y autorización"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · A1 — Acceso cruzado y autorización

Ataqué la resolución de autorización (`V/17`), el pliegue de entitlements y limits (`V/15`), el
caché (`V/02` §3), Partner (`V/18`), las superficies (`V/19`) y el contrato de cobertura
(`12-contrato…`) en lo que concede acceso: uso de capacidades de una vertical desde otra, fichas y
suscripciones ajenas, cuentas multi-rol, admin/sistema/guest, qué emite cada estado de la
suscripción, carreras sobre los limits, grants y addons que abren de más, 403 vs 404 y cachés que
mienten.

Son **14 hallazgos**: **1 CRITICA**, **6 ALTA**, **6 MEDIA**, **1 BAJA**. La idea más grave en una
línea: **el diseño obliga a declarar la vertical de toda operación y prohíbe deducirla del recurso,
pero ningún paso ni guard exige que la vertical declarada sea la del recurso**, así que una persona
con Alojamiento pago publica su ficha de Gastronomía declarando Alojamiento — el caso exacto del §13.

El resto se agrupa en tres familias: (1) **lo que cruza verticales sin tener transporte** —la
herencia de Turista VIP y las claves globales— y queda a merced de un caché que se invalida por
`user + vertical`; (2) **reglas escritas en prosa que el gate que las ejecuta no tiene** —los cortes
del addon frente al trial, la presencia de Partner sin ciclo, el `hasta` como segunda línea—; y (3)
**concurrencia y clases de actor no declaradas** sobre los limits.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila. **Ninguno de estos ataques depende de una medición del
proveedor**: son todos de la lógica de autorización del lado nuestro, y por eso no cito filas de
`06-mp-validation-matrix.md`.

---

## CRITICA

### F-8CA1-001 — La vertical declarada no se compara con la del recurso: un plan de Alojamiento publica una ficha de Gastronomía

**Qué se rompe.** Acceso cruzado entre verticales, que es el problema con nombre propio del §13 y
el invariante §64.10. Una persona usa las capacidades pagas de una vertical sobre un recurso de
otra donde no paga nada. Y como `PB2` se dispara por el cambio de `cubierto` **de la vertical de la
ficha**, que nunca cambió, la ficha queda publicada sin cobertura indefinidamente.

**El camino.**

1. Juan tiene Alojamiento Premium `ACTIVE` y una ficha de Gastronomía en `DRAFT`. En Gastronomía no
   tiene ningún título: su trial está `TRIAL_EXPIRED` y su conjunto efectivo es la versión de piso.
2. Juan invoca la operación de publicar (`PB1`) **declarando `vertical = Alojamiento`** y pasando el
   id de su ficha de Gastronomía. La firma lo admite: la vertical es obligatoria y no se deduce del
   recurso.
3. Paso 4: la ficha existe, está en `DRAFT` (acepta publicar) y es suya. Pasa. Nada pregunta de qué
   vertical es.
4. Pasos 5-7 resueltos contra `user + Alojamiento`: tiene título, la clave de publicar y cupo. Pasa.
5. La ficha de Gastronomía queda `PUBLISHED`. `cobertura(Juan, Gastronomía)` nunca cambió (era falso
   antes y lo sigue siendo), así que el aviso del contrato no se emite para Gastronomía y `PB2` no
   dispara.
6. La única red es `PB4` al día 90 de inactividad, y cualquier edición de la ficha es el hecho 1 que
   reinicia el reloj: con editar cada 89 días, la ficha queda publicada para siempre sin pagar
   Gastronomía. Además consume cupo de Alojamiento en vez del de Gastronomía, así que el conteo
   por vertical también queda mal.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:146-147` §2.2:

> **Ninguna operación de dominio se puede expresar sin su contexto de vertical.** Es obligatorio en
> la firma, no un parámetro opcional ni un valor que se deduzca del recurso.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:67` §1.2, paso 4
(no incluye la vertical entre lo que se verifica del recurso):

> | 4 | **el recurso: existencia, estado y dueño** | ¿existe, está en un estado que acepta esto, y es del sujeto? | **no existe** — las tres juntas |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:151-153` §2.2 (la
defensa depende de que la vertical declarada sea la verdadera, y eso no se verifica):

> con Gastronomía ejecute algo de Alojamiento, la operación tendría que haber sido invocada
> **declarando Alojamiento**, y ahí su conjunto efectivo es el de Alojamiento — donde no tiene nada.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:51` (el guard sólo mira
que se declare, no que coincida):

> | G2 | una operación de dominio **no declara** su contexto de vertical | cap. 17 §2.3 (épica de verticales) |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:294` (`PB2`
depende del cambio de `cubierto`, que en la vertical real nunca ocurre):

> | PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` | o el excedente tras un downgrade, que no cambia `cubierto` y sí el cupo |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:54` (editar reinicia el reloj
de la única red):

> | 1 | un **acto del dueño** sobre la ficha: crearla, editarla, publicarla, despublicarla, exportarla, reactivarla | …

Verifiqué la ausencia: `rg` sobre las dos épicas, el núcleo y el contrato por *«vertical del
recurso»*, *«vertical de la ficha»*, *«listing.vertical»* y variantes: la única aparición es la línea
147 citada, que dice lo contrario (no deducir). `listing` sí guarda su vertical
(`V/02` §2.5, línea 284), así que el dato para comparar existe y nadie lo compara.

**Severidad**: `CRITICA`. Es acceso indebido directo, reproducible por cualquier cliente con dos
verticales, sin carrera ni estado raro, y persistente porque la transición que lo corregiría mira
otra vertical.

**Necesita decisión del owner**: **no**. Es corrección de diseño: agregar al paso 4 *«el recurso
pertenece a la vertical declarada»* (respondiendo *no existe*, por la precisión 1) y a `G2` su
gemelo. No cambia ninguna política.

---

## ALTA

### F-8CA1-002 — La herencia de Turista VIP no tiene transporte en el contrato, y el caché de Turista no se entera de que el plan que la otorga se suspendió

**Qué se rompe.** La herencia es una fuente que vive en **otra vertical** que la que resuelve
(`plan_version.hereda Turista VIP` en Alojamiento, consumida en Turista). El contrato no tiene un
`tipo` para ella y `cobertura(user, Turista)` sólo devuelve fuentes de Turista. Quedan dos lecturas y
las dos rompen algo: o la herencia **no se entrega nunca** (un beneficio pago que no llega), o se
resuelve leyendo la cobertura de las otras verticales, y entonces la entrada `user + Turista` del
caché **no se invalida** cuando se suspende el plan de Alojamiento: el suspendido conserva VIP, y el
bloqueo de compra de `DEC-ENT-003` se evalúa sobre el mismo dato viejo.

**El camino.**

1. Juan tiene Alojamiento Premium, cuya versión declara `hereda Turista VIP`. Usa un beneficio de
   Turista VIP: el conjunto de `Juan + Turista` queda cacheado con la herencia adentro.
2. Juan deja de pagar: `S6` lo lleva a `SUSPENDED`. La transición invalida **la entrada de
   `Juan + Alojamiento`** (fila *«toda transición de la máquina de suscripción»*).
3. La entrada `Juan + Turista` no está en la lista de nada: ninguna fila de su suscripción de Turista
   cambió, porque no tiene suscripción de Turista.
4. Juan sigue con los beneficios VIP y, si intenta comprar VIP, la API lo rechaza con el mismo dato
   cacheado *«tu plan comercial ya te lo da»*. Es lo contrario de lo que `V/15` §6.2 promete: *«el
   bloqueo de compra se levanta en el mismo instante de la suspensión»*.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:88` §2 (los seis
`tipo`; no hay herencia):

> tipo:       TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | BASE | ADDON

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:52-54` §1.1 (afirma el
efecto sin decir por dónde cruza la fuente):

> comerciales»*, así que **suspendido es no tener cobertura**, y los beneficios heredados de Turista
> VIP se pierden porque su fuente dejó de otorgar — no por una regla aparte.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:363-364` §3.1 (la
herencia entra al valor cacheado):

> **El conjunto efectivo de entitlements y limits de un `user + vertical`.** Es lo caro: agregar
> versión de plan, herencia de Turista VIP, addons, cortesía y grant, cada uno con su vigencia.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:373` §3.2:

> Invalidan la entrada de un `user + vertical`:

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:410` §6.2:

> **El bloqueo de compra se levanta en el mismo instante de la suspensión.**

**Severidad**: `ALTA`. Da acceso indebido a un suspendido (y le niega una compra legítima) en una
población real (todo plan comercial que herede VIP), pero el beneficio es de Turista y hay
recuperación cuando la entrada vence por la red de tiempo.

**Necesita decisión del owner**: **no**. Falta declarar cómo cruza la herencia (un `tipo` o una
regla de resolución) y la invalidación entre verticales. No cambia qué se hereda.

---

### F-8CA1-003 — Una clave global se resuelve «por user», pero el caché y su invalidación son por `user + vertical`: la insignia sobrevive en las otras verticales

**Qué se rompe.** `V/15` §3 declara claves globales que se resuelven por `user` y que, al perder la
única fuente, *«se van en todas las verticales»*. Pero lo único que el diseño cachea es el conjunto
por `user + vertical`, y cada operación se evalúa dentro de una vertical (`V/17` §2.4). La clave
global que se lee desde Gastronomía sale de la entrada `user + Gastronomía`; la transición que la
quita invalida la de Alojamiento. Es el mismo defecto que el F-8CA1-002 con otra fuente.

**El camino.**

1. El plan Premium de Alojamiento otorga la clave global *«insignia en el perfil»* (el ejemplo del
   propio §3.3). Juan también tiene Gastronomía `ACTIVE`.
2. Juan opera en Gastronomía; el paso 6 resuelve la insignia y la entrada `Juan + Gastronomía` queda
   cacheada con ella.
3. Alojamiento pasa a `SUSPENDED`. Se invalida `Juan + Alojamiento`.
4. En Gastronomía la insignia sigue: ninguna fila de `Juan + Gastronomía` cambió, y la regla del
   propio capítulo dice que eso es exactamente lo que necesita una entrada propia en la lista.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:198-201`
§3.2:

> | scope de la clave | cómo se resuelve |
> |---|---|
> | **de vertical** | por `user + vertical` |
> | **global** | por `user` |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:210-212`
§3.3:

> única fuente era ese plan y el plan se va, la insignia se va, **en todas las verticales**, porque
> la clave es global.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:395-397` §3.2 (la
regla que el caso incumple):

> **La regla detrás, para que no vuelva a faltar una**: si una fuente puede cambiar **lo que otorga**
> sin que cambie **ninguna fila del `user + vertical`**, necesita su propia entrada. Las siete
> originales cubrían el caso contrario.

Verifiqué la ausencia: `rg -i global` sobre `V/02` no devuelve nada; la lista de invalidación no
tiene ninguna fila para claves globales ni para *«todas las verticales del user»*.

**Severidad**: `ALTA`. Capacidad revocada que sigue funcionando, que `V/02` §3 declara *«de
seguridad y no de rendimiento»*. Acotada a claves globales otorgadas por fuentes de otra vertical.

**Necesita decisión del owner**: **no**. Es una fila que falta en la lista de invalidación (o una
declaración de que las claves globales no se cachean).

---

### F-8CA1-004 — Los cortes del addon frente al trial están en prosa y ningún gate los ejecuta: el trial es `TÍTULO` y el pliegue le suma el addon

**Qué se rompe.** El invariante §64.7 (*«no se compran addons en trial»*) y el §10.5. `V/11` §5.2 y
§5.3 escriben dos reglas —la ficha en trial no es objetivo elegible; un addon `USER`/`GLOBAL` no
aporta a una vertical cuyo único título es un trial— pero el único gate del pliegue (`V/15` §2.6,
`G-R2`) admite complementos **si hay cualquier `TÍTULO`**, y un trial corriendo **es** `TÍTULO`. `A1`
sólo verifica que la persona no esté *«solamente»* en trial.

**El camino.**

1. Juan tiene Alojamiento `ACTIVE` y está en `TRIAL_ACTIVE` de Gastronomía (que le da el plan
   premium derivado con máximo una ficha).
2. **Scope `USER`/`GLOBAL`**: compra un addon `USER` compatible con las dos verticales (por ejemplo
   *«+20 fotos»*). `A1` lo acepta: tiene una suscripción principal válida.
3. Juan opera en Gastronomía. `cobertura(Juan, Gastronomía)` trae el trial (`TÍTULO`, `hasta: fecha`)
   y el addon (`COMPLEMENTO`). El conjunto plegable admite el complemento porque hay un `TÍTULO`
   vivo. El addon suma en la vertical en trial, que es lo que `V/11` §5.3 prohíbe.
4. **Scope `LISTING`**: con la misma suscripción de Alojamiento compra un *Boost 7 días* compatible
   con Gastronomía y elige como objetivo **su ficha de Gastronomía en trial**. `A1` no mira de qué
   vertical es el objetivo y el delta por ficha del pliegue lo admite por la misma condición.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:249-250` §5.3 (la regla):

> **Un addon de scope `USER` o `GLOBAL` no aporta nada a una vertical cuyo único título es un
> trial.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:243`:

> | `LISTING` | una ficha concreta que la persona elige | la ficha en trial **no es elegible como objetivo** |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:130-132`
§2.6 (el gate real, que no tiene el corte):

> > **El conjunto plegable de un `user + vertical` son sus fuentes de clase `TÍTULO` y `BASE`, más
> > las de clase `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva.

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:179` §2.4 (el trial
corriendo es `TÍTULO`):

> | **`TÍTULO`** | `tipo ∈ {TRIAL, SUSCRIPCIÓN, CORTESÍA, GRANT}` **y `hasta ≠ SIN_EMPEZAR`** | **sí** | …

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:57` (`G-R2` sólo mira
la ausencia de `TÍTULO`):

> | G-R2 | el pliegue del conjunto efectivo **recibe una fuente de clase `COMPLEMENTO`** cuando el conjunto no tiene ninguna de clase `TÍTULO` viva — en cualquiera de sus dos tramos | cap. 15 §2.6 |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2038` (`A1` no mira el
objetivo):

> | A1 | *(sin fila)* | se contrata | `PENDING_AUTHORIZATION` | exige una suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5) |

Verifiqué la ausencia: la única aparición de *«único título»* en todo el corpus permitido es
`V/11:249`; `V/15` §2.6, `G-R2` y `A1` no lo recogen.

**Severidad**: `ALTA`. Rompe un invariante enumerado (§64.7) por un camino común (cliente
multi-vertical), pero el cliente pagó el addon: lo que se regala es la capacidad durante el trial,
no plata.

**Necesita decisión del owner**: **no**. Las reglas ya están decididas en `V/11`; lo que falta es
escribirlas en el pliegue (condición: *«hay un `TÍTULO` que no es `TRIAL`»* para los complementos
`USER`/`GLOBAL`/`LISTING`) y en `G-R2`, más la verificación del objetivo en `A1`.

---

### F-8CA1-005 — La presencia pública de Partner Gold no tiene ciclo de publicación: nadie la baja cuando el partner deja de pagar o baja de plan

**Qué se rompe.** Lo único que Partner Gold vende públicamente es su página. Las fichas tienen
`PB2` (se despublica al perder cobertura) y el reconciliador (se despublica el excedente). La
presencia no es una ficha, es un entitlement booleano que ninguno de los dos alcanza, y los dos
capítulos que podrían declarar su ciclo se remiten mutuamente. Un partner `SUSPENDED` —y los partners
pagan a mano, así que su `SUSPENDED` es *«reabrible indefinidamente»*— conserva la página.

**El camino.**

1. Partner Gold con pago manual. El admin confirma que no pagó (una de las doce acciones) y la
   suscripción pasa a `SUSPENDED`: no emite fuente, así que el paso 6 le niega editar la presencia.
2. Ninguna transición de ninguna máquina tiene la presencia como sujeto: `PB2` es de `listing`, y el
   reconciliador actúa sobre limits contables, no sobre booleanos.
3. La página sigue publicada. Lo mismo pasa con un downgrade Gold → Silver: la clave desaparece del
   conjunto y la página sigue.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:186-187`:

> - **El ciclo de publicación de la presencia** es del capítulo 19: acá está que existe, que la da
>   el plan Gold y que no es una ficha.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:79-81` (el 19 lo
devuelve):

> - **El ciclo de publicación de la presencia de Partner** (cap. 18, épica de verticales): que
>   existe y que la da el plan Gold está decidido; cómo se publica es diseño de producto, no de
>   billing.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/18-partner.md:49-50`:

> respuesta es que no es una cantidad: es una capacidad que se tiene o no se tiene. **Es un
> entitlement booleano**, y encaja sin excepciones en la resolución del capítulo 15.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:233` (es
una clave que *sostiene* presencia, o sea que necesita quien la retire):

> | **`COMERCIAL`** | su ejercicio **produce o sostiene presencia pública** en la vertical, …

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:287-289`
(la máquina de publicación es sólo de la ficha):

> Es la máquina de la ficha, y el §63 la pide aparte porque no coincide con la de la suscripción:

Verifiqué la ausencia: `rg presencia` sobre las dos épicas, el núcleo y el contrato; fuera de
`V/18` y de los dos renglones de *«NO cierra»*, sólo aparece como ejemplo o como clasificación, nunca
como sujeto de una transición.

**Severidad**: `ALTA`. Presencia pública sostenida sin pagar para toda la clase Gold. No es
`CRITICA` porque la población es chica y administrada: el admin la puede bajar a mano.

**Necesita decisión del owner**: **no** en el fondo (que la presencia se retire al perder la clave
ya lo implica `V/18` §1.2); **sí** en la forma, porque el propio `V/19` declara que cómo se publica
*«es diseño de producto»* — con el pedido de que al menos el retiro no quede sin dueño.

---

### F-8CA1-006 — Los limits se cuentan y se escriben sin serialización, y el reconciliador no se entera del excedente que deja una carrera

**Qué se rompe.** Una persona supera el cupo que paga, y el exceso **no se corrige**. El paso 7
cuenta y el alta escribe después; el diseño no declara ningún candado ni lectura serializada para
los limits (el capítulo de concurrencia es sólo de billing). Y el reconciliador que podría ver el
exceso se dispara **cuando el conjunto efectivo se recalcula**, no cuando cambia el conteo: una
carrera no mueve ninguna fila de la lista de invalidación.

**El camino.**

1. Juan tiene Alojamiento Básico con cupo de 2 fichas publicadas y 1 publicada. Tiene 3 borradores.
2. Manda tres `PB1` en paralelo (tres pestañas, o un script).
3. Las tres pasan el paso 7 leyendo *«1 de 2»* y las tres publican: quedan 4 de 2.
4. Ningún evento de la lista de `V/02` §3.2 ocurrió (no cambió plan, suscripción, trial, grant ni
   addon), así que el conjunto no se recalcula y el reconciliador no dispara. Las 4 quedan publicadas
   hasta el próximo evento de la lista, que puede no llegar nunca.
5. Variante sin mala fe: la restitución de `PB3`/`PB7` (el cupo vuelve a alcanzar) y un `PB1` del
   dueño en el mismo instante compiten por el mismo último lugar.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:102-104` §1.2
(contar es leer datos, sin más):

> 3. **Los limits van últimos porque son los únicos que necesitan contar.** Todos los pasos
>    anteriores se responden con lo que ya está resuelto; éste lee datos. Ponerlo antes hace
>    trabajo que la mayoría de los rechazos no necesita.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:285-287`
§4.2 (el disparador es el recálculo del conjunto, no el conteo):

> Enumerar seis puntos de invocación es cómo se olvida el séptimo. **El reconciliador de excedentes
> se dispara cuando el conjunto efectivo de un `user + vertical` se recalcula, y actúa cuando el
> conjunto y el límite dejaron de coincidir — en las DOS direcciones.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:399-400`
(se reconoce la competencia por el cupo, pero sólo entre las dos restituciones, no contra `PB1`):

> **`PB3` y `PB7` compiten por el mismo cupo**, se disparan con el mismo hecho y en el mismo
> instante, y con cinco fichas abajo y lugar para tres **cuáles tres suben es una decisión de

Verifiqué la ausencia: `rg -i "carrera|concurren|candado|lock|serializ|simultáne"` sobre `V/*` y el
núcleo sólo devuelve la mención genérica de `V/20:31` (*«carreras»* como escenario de test) y el
candado de idempotencia de billing (`D4`); `rg "limit|cupo|ficha"` sobre
`B/05-idempotencia-y-concurrencia.md` no devuelve nada.

**Severidad**: `ALTA`. Acceso por encima de lo pagado, trivial de provocar y sin detector. No es
`CRITICA` porque lo que se regala es cupo del mismo cliente que ya paga la vertical.

**Necesita decisión del owner**: **no**. Falta declarar la serialización del paso 7 por
`user + vertical + clave` (o que la escritura verifique el cupo en la misma transacción) y que la
restitución y `PB1` compartan ese candado.

---

### F-8CA1-007 — La «segunda línea» del `hasta` no existe detrás del caché: que pase la fecha no invalida nada

**Qué se rompe.** El contrato declara que una fuente con `hasta: fecha` deja de emitirse cuando la
fecha pasa, **aunque su estado se haya atascado**, como red contra una máquina sin salida. Pero lo
que responde el paso 6 es el caché, y la lista de invalidación sólo tiene eventos: el paso de una
fecha no es ninguno. Si la transición que debía mover el estado no corre (job caído, cola trabada),
la capacidad sigue en el caché exactamente en el escenario para el que la red existe.

**El camino.**

1. Juan está en `CANCEL_SCHEDULED` con fin de servicio el día 30 (`hasta: fecha`). Su conjunto está
   cacheado con el plan.
2. El día 30 el job que ejecuta `S12` falla (o `T3`, para un trial; o `A4`, para un addon
   `DÍAS_FIJOS`).
3. `cobertura()` ya no emitiría la fuente, pero nadie la llama: el paso 6 lee la entrada cacheada,
   que no se invalidó porque no ocurrió ninguna transición.
4. Juan sigue publicando y usando el plan hasta que el job se recupere o venza la red de tiempo, que
   el diseño declara *«nunca el mecanismo»* y no dimensiona.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:323-324` §2.6:

> > **El `hasta` es el fin de la emisión, no una etiqueta: una fuente con `hasta: fecha` deja de
> > aparecer en `fuentes` cuando esa fecha pasa.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:330-332`:

> desenlace del trial que quedaba en `TRIAL_ACTIVE` sin salida alcanzable (`V/03` §2). La máquina que
> emite la fuente es la responsable de tener salida; este renglón es la segunda línea, para que un
> estado atascado se note como fuente que se apaga en vez de como capacidad que no se apaga nunca.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:369-371` §3.2:

> **La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.** Un
> TTL como defensa principal deja una ventana en la que un permiso revocado sigue funcionando, y
> esa ventana es exactamente el error de seguridad que este punto viene a evitar.

**Severidad**: `ALTA`. Servicio después del fin pagado, en los cuatro casos con `hasta: fecha`
(trial, `CANCEL_SCHEDULED`, cortesía, addon `DÍAS_FIJOS`), justo cuando falla la primera línea. Es
recuperable porque el job vuelve.

**Necesita decisión del owner**: **no**. La entrada cacheada tiene que llevar el menor `hasta` de sus
fuentes como vencimiento propio (o la lista de invalidación, una fila *«llega el `hasta` de una
fuente»*).

---

## MEDIA

### F-8CA1-008 — El contrato no dice en qué verticales se emite un addon `USER`/`GLOBAL`, y la compatibilidad vive en billing sin que nadie la aplique

**Qué se rompe.** Un addon `USER`/`GLOBAL` no tiene vertical propia. Las *«verticales compatibles»*
son un campo de `addon_product`, del lado de billing, y el contrato no dice si `cobertura(user, V)`
lo emite sólo cuando `V` es compatible o en toda vertical. Dos implementadores lo resuelven distinto,
y uno de los dos entrega la capacidad de un addon comprado para Alojamiento en cualquier vertical
donde Juan tenga un título y la clave exista (las claves son un catálogo compartido con subconjuntos
por vertical: *«fotos»* existe en las tres verticales con ficha).

**El camino.** Juan compra un addon `USER` *«+20 fotos»* compatible sólo con Alojamiento. Tiene
también Gastronomía `ACTIVE`. Billing implementa `cobertura(Juan, Gastronomía)` devolviendo todos sus
addons de alcance `USER`. El pliegue lo admite (hay `TÍTULO`) y Gastronomía recibe +20 fotos.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:451-453` §2.7 (el
mapeo no dice nada de compatibilidad):

> | suscripción, cortesía, trial, `BASE` | — (cubren su vertical) | `VERTICAL` |
> | grant | *«scope de verticales»* (§35.1) | una fuente `VERTICAL` **por cada vertical de su scope**, y cada una transporta **el ancla de esa vertical** (§2.8) — nunca la de otra |
> | addon | los cuatro del §40 | `LISTING` · `VERTICAL` · `USER` · `GLOBAL` |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:411`:

> | **`addon_product`** | **precio, recurrencia y verticales compatibles**, …

El grant sí recibió la regla de *«por vertical, nunca la de otra»* (`G-R2-B`); el addon sin vertical
no la tiene. **No confundir con la fuga que `B/16:256` decide aceptar**: ésa es la de un addon
compatible con dos verticales convertido por un grant, y está bien decidida; ésta es la de un addon
que **no** es compatible con la vertical donde aparece.

**Severidad**: `MEDIA`. Ambigüedad que dos implementadores resuelven distinto; en la lectura mala es
acceso cruzado.

**Necesita decisión del owner**: **no**. Es escribir en el §2.7 que la fuente `USER`/`GLOBAL` se emite
sólo en las verticales compatibles de su producto.

---

### F-8CA1-009 — Las transiciones del sistema disparadas por evento (`PB2`, `PB3`, `PB7`, el reconciliador) no tienen declarado sobre quién se evalúan los pasos 5-7

**Qué se rompe.** `V/17` declara dos clases de operación con actor distinto del sujeto: las doce
acciones administrativas y las del reloj, y en las dos los pasos 5-7 se evalúan **sobre el actor**.
`PB3` y `PB7` tienen actor de sistema, no son del reloj (`V/03` lo dice expresamente) y **otorgan**
(publican). La regla *«a qué clase pertenece una operación se declara, nunca se infiere»* las deja
sin clase. El implementador que las ponga *«por analogía»* con el reloj evalúa el paso 7 sobre el
actor de sistema, que no tiene cupo que agotar, y la restitución publica sin mirar el límite del
dueño.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:258-260` §3.4:

> > **Las transiciones disparadas por el reloj son una segunda clase de operación, evaluada por
> > analogía con las doce acciones administrativas: los pasos 5, 6 y 7 se resuelven sobre la
> > capacidad del ACTOR, no sobre la del sujeto.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:496-498`:

> 3. **`PB7` no es una transición de la clase del reloj**, así que no la alcanza la propiedad
>    *«nunca otorga»* del cap. 17 §3.4. Las de esa clase en esta máquina son `PB4` y `PB5`, y las
>    dos **quitan**; …

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:222-223` §3.2 regla
1 (tampoco encaja: el sistema no tiene permisos de acción):

> 1. **`actor ≠ sujeto` exige un permiso de esa acción concreta**, no una condición general de
>    «es administrador». …

**Severidad**: `MEDIA`. El texto de `PB3`/`PB7` ya dice *«y el cupo alcanza»*, así que la lectura
correcta es plausible; pero no está declarada y la analogía disponible lleva a la incorrecta.

**Necesita decisión del owner**: **no**. Declarar una tercera clase —*«sistema por evento: pasos
5-7 sobre el sujeto»*— o nombrar `PB2`/`PB3`/`PB7` y el reconciliador en la de operaciones normales.

---

### F-8CA1-010 — El paso 2 («estado de la persona») no tiene dato, transición ni acción que lo escriba, y no baja lo que ya está publicado

**Qué se rompe.** `V/17` agrega el paso 2 porque *«alguien inhabilitado por abuso pasa las ocho»*.
Pero *«inhabilitado»* no existe en ningún modelo de datos, ninguna máquina ni el catálogo cerrado de
doce acciones administrativas; no hay forma declarada de inhabilitar a nadie. Y aunque existiera, el
paso 2 sólo bloquea operaciones nuevas: las fichas del inhabilitado siguen publicadas, porque `PB2`
mira `cubierto` y su suscripción está al día.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:48`:

> | **el estado de la persona** | alguien con el correo sin verificar o **inhabilitado por abuso** pasa las ocho con su suscripción al día |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/08-auditoria-y-observabilidad.md:131-132`
(el catálogo cerrado, que no la incluye):

> **Cada acción lleva tres cosas: permiso propio, registro de auditoría, y confirmación explícita
> si es destructiva o mueve dinero.**

Verifiqué la ausencia: `rg -i "inhabilit|estado de la persona|correo sin verificar"` sobre las dos
épicas, el núcleo y el log devuelve sólo las tres líneas de `V/17` (48, 65, 99).

**Severidad**: `MEDIA`. El control existe en el orden de pasos y no tiene de dónde leer; cada
implementación va a inventar su columna y su efecto sobre lo publicado.

**Necesita decisión del owner**: **sí**. Qué es inhabilitar, quién lo hace y si retira lo publicado
son políticas, no correcciones.

---

### F-8CA1-011 — El paso 4 exige «es del sujeto» a toda lectura, y la lectura pública de una ficha ajena no tiene respuesta declarada

**Qué se rompe.** `V/17` §3.5 corrigió que las lecturas no pasaran por ningún paso: ahora pasan por
ocho, incluido el 4, que pregunta si el recurso *«es del sujeto»*. Un turista o un guest que lee la
ficha publicada de María no es su dueño, así que el paso 4 contesta *«no existe»*. El diseño no
declara en ningún lado la lectura pública (qué estados son legibles por no-dueños, sobre quién se
evalúa). Cada superficie pública va a inventar su exención —exactamente la *«exención por
superficie»* que el mismo § descarta— y ahí es donde se cuela leer un `DRAFT` o un `ARCHIVED` ajeno.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:289-290` §3.5:

> - **¿pasa por el paso 5?** Sólo si **escribe estado del negocio y es auditable**. Una lectura
>   que no muta nada **no pasa por el 5** — y **sí por los otros ocho**.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:292-297` (el
problema que se quiso cerrar, que ahora aparece del otro lado):

> > ⚠️ **Los nueve pasos no vienen en bloque, y decir que una lectura «no es de dominio» la
> > sacaba de los nueve.** Con eso **ninguna lectura tenía autorización**: …

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:377-378`
(lo único que se dice del guest son booleanos «de lectura pública», sin definir qué es público):

> **El visitante sin cuenta no recibe ningún entitlement medido.** De los booleanos recibe
> únicamente los de lectura pública.

**Severidad**: `MEDIA`. Ambigüedad sobre la superficie más usada del sitio; en la resolución mala es
filtración de borradores ajenos.

**Necesita decisión del owner**: **no**. Falta declarar la lectura pública como caso del paso 4
(*«el recurso está en un estado público»* en lugar de *«es del sujeto»*), con la lista cerrada de
estados públicos.

---

### F-8CA1-012 — Las dos fuentes `SUSCRIPCIÓN` se suman con el argumento «está pagando las dos», que es falso si la predecesora está en `GRACE_PERIOD`

**Qué se rompe.** El contrato admite dos `SUSCRIPCIÓN` vivas en la misma vertical cuando la
cancelación de la predecesora falló, y el pliegue las suma (por ejemplo, fichas `SUMA`). Lo justifica
diciendo que el cliente paga las dos. Pero el cambio de plan está permitido **desde el grace**
(`DEC-SUB-003`), y el grace es justamente un período que no se pagó: la predecesora en
`GRACE_PERIOD` emite (servicio entero) y suma su cupo sobre el de la sucesora, sin haber cobrado.

**El camino.** Juan en `GRACE_PERIOD` con Premium (5 fichas) cambia a Básico (2) para salir del
impago. La sucesora autoriza; la cancelación de la predecesora falla. Mientras la marca está abierta,
`fuentes` trae las dos y el pliegue le da 7 fichas, pagando sólo 2.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:394-395`:

> **No se desempata porque en esa rama el cliente está pagando las dos**, y desempatar sería la
> única forma de cobrarle dos planes y darle uno. …

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:345`:

> | `GRACE_PERIOD` | **sí** | `SIN_FECHA_CONOCIDA` | el §20 da **servicio entero** durante el grace |

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:680`:

> ### DEC-SUB-003 — Cambiar de plan en grace está permitido, y es el camino de recuperación

**Severidad**: `MEDIA`. Es un incidente declarado, con marca y una persona mirando, y el excedente
se reconcilia al cerrar la marca. Pero la razón escrita no cubre este caso.

**Necesita decisión del owner**: **no**. Basta con acotar la frase (o no sumar una predecesora en
`GRACE_PERIOD`); no cambia ninguna política de cobro.

---

### F-8CA1-013 — La lista cerrada del piso no tiene clave para leer «Mi Cuenta» ni el billing, y las lecturas ahora pasan por el paso 6

**Qué se rompe.** `V/17` §4 funda *«el rol no se revoca»* en tres promesas del §21: *«Mi Cuenta
read-only»*, *«billing accesible»* y *«recuperación posible»*. Un `SUSPENDED` resuelve contra la
versión de piso, cuya lista es **cerrada** en tres cosas: nada comercial, contratar, recuperar lo suyo
(sobre una ficha). Como las lecturas pasan por el paso 6 (F-8CA1-011), leer Mi Cuenta o el estado del
billing necesita una clave que el piso no tiene, y `G-R3` (b) sólo exige las dos de la lista.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:181-182`:

> Otorga exactamente lo mínimo para que alguien exista en la plataforma, **pueda recuperar lo suyo**
> y pueda volver a contratar. Son **tres** cosas y la lista es cerrada:

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:326-327`:

> 1. **El §21 promete tres cosas que necesitan el rol vivo**: *«Mi Cuenta read-only»*, *«billing
>    accesible»* y *«recuperación posible»*. …

**Severidad**: `MEDIA`. No da acceso de más sino de menos, sobre la población que necesita
regularizar; dos implementadores lo resuelven distinto (clave nueva vs. *«las lecturas propias no
consultan el 6»*).

**Necesita decisión del owner**: **no**. Declarar si las lecturas de lo propio consultan el paso 6 y,
si lo hacen, agregar la clave al piso y a `G-R3` (b).

---

## BAJA

### F-8CA1-014 — El 410 del partner revocado que responde el código de hoy contradice «ajeno, archivado e inexistente son indistinguibles», y la migración no lo nombra

**Qué se rompe.** Coexistencia/migración. La ruta pública actual de partners responde 410 cuando el
partner fue revocado, a propósito (distingue *«existió y se retiró»*). `V/17` precisión 1 dice que
desde afuera un recurso archivado y uno inexistente no se distinguen. Nadie decidió cuál de los dos
queda al migrar.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:74-76`:

> 1. **El paso 4 responde «no existe» a las tres cosas.** Un recurso ajeno, uno archivado y uno
>    inexistente son indistinguibles desde afuera. Contestar *«no es tuyo»* confirma que el
>    identificador existe, y eso es información que el que pregunta no tenía.

`apps/api/src/routes/partners/public/get-by-slug.ts:25`:

```text
* - `gone` -> HTTP 410. The partner was deliberately REVOKED. 410 is the one
```

`rg 410` sobre `V/*`, el núcleo y `B/21-migracion.md`: sin resultados.

**Severidad**: `BAJA`. Es una lectura pública con motivo de SEO, no una fuga de datos sensibles; lo
que falta es el registro de la decisión.

**Necesita decisión del owner**: **sí**. Es elegir entre la regla nueva y el comportamiento
deliberado de HOS-294.

---

## Ataques que intenté y el diseño resistió

- **Suspendido que conserva lo que su addon otorga.** `V/15` §2.6 descarta los `COMPLEMENTO` sin
  `TÍTULO` en los dos tramos del pliegue, y `G-R2` lo vigila (`V/20:57`).
- **Grant de varias verticales que lee el plan de otra.** Un ancla por vertical, plan de esa vertical
  y trinquete por vertical (`12-contrato…` §2.8); `G-R2-B` lo vigila (`V/20:58`).
- **Checkout abandonado repetido para usar el plan gratis.** `PENDING_AUTHORIZATION` no emite fuente
  (`12-contrato…:342`, `:353`).
- **Todo el mundo cubierto por estar en `PRE_TRIAL`.** `SIN_EMPEZAR` es clase `BASE` y no cuenta para
  `cubierto` (`12-contrato…:180`, `:194-195`).
- **Piso o pre-trial con una clave comercial sembrada.** `G-R3` (a), y la versión nueva invalida el
  caché de todos (`V/02:384`).
- **Admin que opera sin rastro o «entra como» el cliente.** Actor y sujeto son dos campos, toda
  operación con `actor ≠ sujeto` se audita y no existe la impersonación (`V/17` §3.2 reglas 2 y 4).
- **Job que otorga una cortesía o un grant.** Un actor de sistema no ejecuta ninguna de las doce
  acciones (`V/17:246`), y las transiciones del reloj nunca otorgan (`G-R3-B`).
- **Revocar el rol al perder acceso, o autorizar sólo por rol.** Guards `G4` y `G6`.
- **Averiguar permisos probando operaciones desde una cuenta inhabilitada.** El paso 2 va antes del 3
  (`V/17:99-101`). El orden resiste; lo que falla es el dato (F-8CA1-010).
- **Segundo trial por re-registro.** `UNIQUE(hash_del_correo_normalizado, vertical)` (`V/02:267`).
- **Doble `PB1` en `PRE_TRIAL` para publicar dos fichas en trial.** `T1` es una transición de la
  máquina de trial, está en la lista de invalidación, y el recálculo dispara el reconciliador contra
  el límite de una ficha. (La misma carrera **sin** transición de por medio es F-8CA1-006.)
- **Addon `USER`/`GLOBAL` que queda gratis en una vertical que el grant no ancló.** Es una fuga real
  pero decidida y acotada por escrito (`B/16:256-284`); no la reabro.
- **Archivar/borrar la ficha del excedente de un dueño cubierto.** `PB4` y el día 180 releen la
  cobertura antes de actuar (`V/03:358-379`).

## Fuera de mi vector

- **Addon cobrado que no entrega nada.** `A1` acepta *«una suscripción principal válida y
  compatible»* en cualquier vertical (`B/03:2038`), no en la del objetivo: un addon `LISTING` para una
  ficha de una vertical sin título se cobra y el pliegue lo descarta (`V/15:130-132`). Es plata
  cobrada sin servicio, del vector de cobro.
- **La herencia de Turista VIP en la dirección inversa del contrato.** Si la resolución de Turista
  tiene que leer la cobertura de las otras cuatro verticales (F-8CA1-002), eso es una lectura entre
  verticales que el §4.2 del contrato no censa; le toca a quien revise el acoplamiento del contrato.

## Key Learnings

1. El agujero más grave de autorización del diseño no está en ningún paso sino **entre** dos: la
   vertical es obligatoria en la firma (`V/17` §2.2) y el recurso se verifica en el paso 4, pero nada
   compara una con otra. Lo estructural de la vertical protege la resolución, no el recurso.
2. Todo lo que otorga **desde otra vertical** —herencia de Turista VIP, claves globales, addons
   `USER`/`GLOBAL`— choca con un caché y un contrato que son por `user + vertical`. Es una familia,
   no tres casos.
3. Varias reglas del diseño viven sólo en prosa del capítulo que las decide y no en el gate que las
   ejecuta (cortes del addon frente al trial en `V/11` §5 vs. `V/15` §2.6 / `G-R2` / `A1`). Conviene
   buscarlas cruzando *«regla declarada»* contra *«predicado del guard»*.
4. Los mecanismos que reaccionan a **eventos** (`PB2`, reconciliador, invalidación) no ven lo que
   ocurre sin evento: una carrera sobre el cupo, el paso de una fecha, una capacidad booleana que
   desaparece. Cada uno necesita su propio disparador o una verificación en la escritura.
5. Un puntero circular de *«NO cierra»* entre dos capítulos (`V/18` → `V/19` → `V/18`) es un
   hallazgo por sí solo: la presencia de Partner quedó sin ciclo.
