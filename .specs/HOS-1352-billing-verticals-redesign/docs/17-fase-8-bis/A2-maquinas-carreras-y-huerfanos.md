---
title: "FASE 8-bis · A2 — máquinas de estado, carreras y huérfanos"
linear: HOS-1353
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 8
---

# FASE 8-bis · A2 — máquinas de estado, carreras y huérfanos

Segunda pasada adversarial A2 sobre `HOS-1353`, corrida **sobre el diseño que la FASE 9 produjo**.
Vector: transiciones que faltan, transiciones que nadie dispara, estados sin salida, relojes sin
cadencia declarada, efectos huérfanos y carreras.

**Trece hallazgos nuevos: 3 `CRITICA`, 7 `ALTA`, 3 `MEDIA`.** Y la reejecución de los dieciocho de
la FASE 8: **3 cortan, 15 siguen llegando** (§2, no cuenta como hallazgos nuevos).

**El resultado en una línea.** Los tres cambios de la FASE 9 que caen en este vector resolvieron lo
que venían a resolver, y los tres dejaron su consecuencia sin recorrer: `T1` ahora dispara pero
nadie declaró que `PB1` y `T1` sean una transacción; `PRE_TRIAL` pasó a ser **fuente viva de clase
`TÍTULO`** y con eso `cubierto` se volvió verdadero para casi toda la plataforma, que es
exactamente el disparador que `PB2` necesita perder; y la clase de actor del reloj se declaró en un
capítulo de verticales **transición por transición**, sobre tablas de transiciones que no tienen
dónde declararla.

Los paths se abrevian como en los documentos de la FASE 9: `NUCLEO` es `HOS-1352-…/docs/nucleo/`,
`V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

---

## 1. Los hallazgos

### CRITICA

### F-8bA2-001 — `PRE_TRIAL` cuenta para `cubierto`, así que `PB2` no puede disparar sobre nadie que no haya consumido su trial — y en Partner no dispara nunca

**Qué se rompe.** Toda persona que todavía no consumió su trial en una vertical está **`cubierto:
sí`** en esa vertical, para siempre y sin haber pagado nada. `PB2` —la transición que baja una
ficha cuando se pierde la cobertura— tiene como evento *«se pierde la cobertura»*, y la cobertura
de esa persona **nunca se pierde**, porque su fuente de trial en `PRE_TRIAL` no vence. En Partner,
donde `T1` no puede disparar nunca, esto alcanza a **todos los usuarios de la plataforma**: una
presencia Gold publicada sigue publicada después de que la suscripción que la pagaba muera.

**El camino.**

1. `V/03` §2 declara que el trial es **fuente viva en `PRE_TRIAL`**, con `referencia` = la versión
   de pre-trial y `hasta: SIN_EMPEZAR`.
2. El mismo § cierra: *«Y `PRE_TRIAL` no es un `tipo` nuevo del contrato: la fuente sigue siendo
   `tipo: TRIAL`.»*
3. El contrato deriva la clase del tipo, y `TRIAL` es de clase **`TÍTULO`**, que **sí** cuenta para
   `cubierto`.
4. Entonces `cubierto(user, vertical) = sí` para cualquiera en `PRE_TRIAL`, en cualquier vertical.
   `PRE_TRIAL` es, por el propio §2, *«el estado más poblado del sistema»*.
5. `PB2` dispara por *«se pierde la cobertura»*. Una fuente que nunca vence y que no tiene ninguna
   transición de salida salvo `T1` **no se pierde nunca**.
6. En Partner el caso es total y permanente: `V/18` §1.5 dice que *«Partner no tiene trial … así
   que la transición `T1` no puede ocurrir»*. Nadie sale de `PRE_TRIAL` en Partner, así que
   `cubierto(·, partner)` es verdadero para **toda** la base de usuarios, siempre.
7. Un Partner Gold deja de pagar. Su suscripción cae por `S6` o `S12`. La fuente de suscripción se
   apaga — y `cubierto` **sigue en sí**, porque queda la de trial en `PRE_TRIAL`. La presencia
   pública no baja.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2: `| PRE_TRIAL | **sí** | la versión de **pre-trial** de la
  vertical | SIN_EMPEZAR |`, y *«Y `PRE_TRIAL` no es un `tipo` nuevo del contrato: la fuente sigue
  siendo `tipo: TRIAL`.»*
- `12-contrato-de-cobertura.md` §2.4: *«La clase se deriva del `tipo` y no se transporta»*, con la
  fila `| **`TÍTULO`** |`TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT`| **sí** |`, y el subrayado
  *«**`cubierto` se calcula sólo sobre las fuentes de clase `TÍTULO`.**»*
- `12-contrato-de-cobertura.md` §2.1: *«**`cubierto`** | si hay al menos una fuente viva **de clase
  `TÍTULO`** … | `PB2`; el §6 del capítulo 15; el reconciliador»*.
- `V/03-maquinas-de-estado.md` §9: `| PB2 | PUBLISHED | **se pierde la cobertura** |
  UNPUBLISHED_BY_BILLING |`.
- `V/18-partner.md` §1.5: *«**Partner no tiene trial.** Sus planes lo tienen en cero
  (`DEC-TRIAL-003`) y no declara evento de activación (`DEC-TRIAL-006`), así que la transición `T1`
  no puede ocurrir.»*

**Y el propio contrato se contradice.** `12-contrato…` §2.5 abre con *«`Turista Free`, `Guest` y
`TRIAL_EXPIRED` no tienen ninguna de las cuatro fuentes de clase `TÍTULO`»*. Un `Turista Free` que
no consumió su trial de Alojamiento **sí tiene una**: la de `PRE_TRIAL`. La premisa que justifica el
título `BASE` sólo es cierta para `TRIAL_EXPIRED`.

**Severidad.** `CRITICA`. Servicio comercial —una ficha o una presencia Gold en el sitio público—
sostenido indefinidamente sobre alguien sin ninguna relación comercial viva.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y lo introdujeron dos racimos que nadie
compuso.** `R3` hizo del trial en `PRE_TRIAL` una fuente viva (cambio 13) y `R2` definió `cubierto`
sobre la clase `TÍTULO` (cambio 1). Cada uno es correcto solo. `V/03` §2 **argumenta explícitamente
la mitad de abajo** —*«si `TRIAL_EXPIRED` siguiera cubriendo, `PB2` no dispararía nunca»*— y no
recorre la mitad de arriba, que produce el mismo desenlace por el otro extremo del ciclo. Es la
forma exacta de `D-01` y `D-20`.

---

### F-8bA2-002 — Suscribirse desde `PRE_TRIAL` no mueve el trial, y las dos salidas posibles terminan en un título vivo perpetuo

**Qué se rompe.** El cliente que contrata **antes** de publicar conserva su título de `PRE_TRIAL`
mientras paga; el día que cancela, esa fuente sigue cubriendo y no pierde nada. Si en cambio
publica después de contratar, `T1` dispara sobre alguien que ya paga y lo deja en `TRIAL_ACTIVE`
**sin ninguna transición de salida alcanzable** — `T3` bloqueada por su condición y `T2` esperando
un evento que ya ocurrió.

**El camino, en sus dos órdenes.**

1. **Orden A — contrata y no publica.** Una persona entra a Gastronomía (`PRE_TRIAL`, sin fila) y
   contrata. La versión de piso y la de pre-trial otorgan *«la de contratar una suscripción»*, así
   que la operación pasa los nueve pasos. La suscripción queda `ACTIVE` por `S2`.
2. `S2` declara entre sus efectos *«si venía de un trial, `T2`»*. No venía: `T2` sale de
   `TRIAL_ACTIVE` y esta persona está en `PRE_TRIAL`. Por la regla 1 del núcleo —*«Lo que no está,
   no pasa»*— **no hay transición**. El trial se queda en `PRE_TRIAL`.
3. Meses después cancela. `S11` → `S12` → `CANCELLED`. La fuente de suscripción se apaga y la de
   `PRE_TRIAL` **queda**: `cubierto` sigue en sí (F-8bA2-001) y `PB2` no dispara. Servicio gratis
   indefinido.
4. **Orden B — contrata y después publica.** Misma persona, mismo `PRE_TRIAL`, ya con suscripción
   `ACTIVE`. Aprieta publicar. La condición de `T1` es *«la vertical declara evento **y** su plan de
   trial tiene días de trial > 0»* — las dos son verdaderas para Gastronomía, **y ninguna pregunta
   por la suscripción**, porque la condición que lo hacía se cayó en la FASE 9.
5. `T1` dispara: crea la fila, asigna el plan de trial y **arranca el reloj**. Un cliente que paga
   acaba de consumir su trial sin recibir nada a cambio, y el §10.2 dice que no se devuelve.
6. Llega la fecha de fin. `T3` exige *«no hay suscripción autorizada»* y la hay: **`T3` no
   dispara**. `T2` necesita el evento *«se autoriza una suscripción»*, que ocurrió **antes** de que
   la fila existiera y no vuelve a ocurrir. `T4` sólo corre la fecha. **El trial queda en
   `TRIAL_ACTIVE` con la fecha de fin vencida, para siempre.**
7. `TRIAL_ACTIVE` es fuente viva de clase `TÍTULO`. Cuando cancela la suscripción, vuelve a pasar el
   paso 3: `cubierto` sigue en sí y la ficha no baja nunca.

**Y no es un borde: es el camino de la migración.** `V/21` §2.1 decide que *«El sistema nuevo no
hereda una sola fila»* y que *«quien tenga algo vivo se suscribe de nuevo»*. Las ocho filas medidas
entran al sistema nuevo **contratando desde `PRE_TRIAL`**, que es el paso 1 de este camino.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §2, tabla: `T2` sale de `TRIAL_ACTIVE`; `T3` lleva la condición *«no
  hay suscripción autorizada»*; `T1` lleva *«la vertical declara evento **y** su plan de trial tiene
  días de trial > 0»*. **Ninguna fila sale de `PRE_TRIAL` salvo `T1`.**
- `B/03-maquinas-de-estado.md` §3.2, `S2`: *«arranca el período; si venía de un trial, `T2`»*.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1: *«La tabla de transiciones es exhaustiva. Lo que no
  está, no pasa.»*
- `V/02-modelo-de-datos.md` §2.1: la versión de piso y la de pre-trial otorgan *«la de contratar una
  suscripción»*.
- `V/21-migracion.md` §2.1: *«El sistema nuevo no hereda una sola fila … quien tenga algo vivo se
  suscribe de nuevo.»*

**Severidad.** `CRITICA`. En el orden A alguien recibe servicio comercial sin pagar, sin fin; en el
orden B alguien **paga** y pierde su trial, y además hereda el mismo desenlace del orden A al
cancelar.

**¿Es nuevo, o es el arreglo?** **El arreglo lo volvió alcanzable.** Los dos huecos de la máquina
—la falta de una salida de `PRE_TRIAL` que no sea `T1`, y la condición de `T3`— son anteriores;
mientras `T1` no podía disparar (`F-8A2-001`) ningún cliente llegaba acá. La caída de la condición
vieja de `T1` (cambio 13) abrió el orden B, y `R2` (cambio 1) le puso el efecto de cobertura
perpetua a los dos.

---

### F-8bA2-003 — `PB3` vuelve sólo por `S5`, `S7` y `T5`: el que recontrata después de cancelar paga y su ficha no se vuelve a publicar nunca

**Qué se rompe.** Una ficha que `PB2` bajó por una cancelación consumada queda en
`UNPUBLISHED_BY_BILLING`. El dueño contrata de nuevo, el cobro entra, la suscripción queda `ACTIVE`
por `S2` — y `S2` **no está entre los disparadores de `PB3`**. La ficha no vuelve, y el dueño no
puede sacarla a mano porque `PB1` sale sólo de `DRAFT`. Paga todos los meses por una ficha que
nadie ve.

**El camino.**

1. Una persona con suscripción `ACTIVE` y su ficha publicada pide la baja. `S11` → `CANCEL_SCHEDULED`
   → `S12` → `CANCELLED`. Se pierde la cobertura y `PB2` baja la ficha a
   `UNPUBLISHED_BY_BILLING` — la causa está enumerada: *«cancelación consumada (S12)»*.
2. Dos meses después vuelve. `B/03` §3.3 es explícito: *«`CANCELLED` → cualquier cosa … Una
   suscripción terminada no revive»*, así que recontratar es **un alta nueva**: `S1` →
   `PENDING_AUTHORIZATION` → `S2` → `ACTIVE`.
3. La cobertura se recupera: hay una fuente `SUSCRIPCIÓN` viva y `cubierto` vuelve a ser verdadero.
4. `PB3` declara tres disparadores: **`S5`, `S7`, `T5`**. `S5` es volver del grace, `S7` es
   regularizar una suspensión, `T5` es convertir un trial vencido. **Ninguno ocurrió y ninguno puede
   ocurrir**: esta persona no estuvo en `GRACE_PERIOD`, no estuvo en `SUSPENDED`, y su trial no está
   en `TRIAL_EXPIRED`.
5. El dueño tampoco puede republicar: `PB1` sale de `DRAFT` y la ficha está en
   `UNPUBLISHED_BY_BILLING`. Por la regla 1 del núcleo, lo que la tabla no declara no pasa.
6. La misma trampa alcanza a los dos caminos que la FASE 9 **acaba de crear**: `S16` declara que
   ante un primer cobro rechazado *«el reintento **es un alta nueva**»*, y `B/03` §3.3.1 manda al
   cliente en `PENDING_AUTHORIZATION` a *«terminá o cancelá el checkout»*, desde donde `ABANDONED`
   obliga a *«crear una fila nueva»*. Los tres desembocan en `S2`, y `PB3` no conoce `S2`.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9: `| PB3 | UNPUBLISHED_BY_BILLING | se recupera la cobertura |
  PUBLISHED | **S5, S7, T5** |` y `| PB1 | **`DRAFT`** | el dueño publica | PUBLISHED |`.
- `B/03-maquinas-de-estado.md` §3.2: `S2` es *«webhook de autorizada, confirmado por relectura → `ACTIVE`»*;
  `S5` sale de `GRACE_PERIOD`, `S7` de `SUSPENDED`.
- `B/03-maquinas-de-estado.md` §3.3: *«`CANCELLED` → cualquier cosa | ídem. Una suscripción
  terminada no revive»*; §3.2, `S16`: *«el reintento **es un alta nueva**»*.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1.

**Severidad.** `CRITICA`. El cliente paga y no recibe el servicio, y no existe ningún camino —ni
suyo ni del sistema— que lo saque del estado.

**¿Es nuevo, o es el arreglo?** **La omisión es anterior; el arreglo le agregó dos caminos más y
no revisó la lista.** `F-8A2-007` había tocado el mismo estado por la causa *limit*; ésta es la
causa *cobertura*, que es la que `PB3` dice cubrir. `S16` y la salida de `PENDING_AUTHORIZATION`
(cambios 9 y 12) son de la FASE 9 y las dos desembocan en `S2`.

---

### ALTA

### F-8bA2-004 — `PB2` enumera cuatro causas de pérdida de cobertura y `S16` no está entre ellas

**Qué se rompe.** El estado `CHARGE_DECLINED` entró en la FASE 9 y es **no vivo**: *«no hay
servicio, no hay autorización y no hay vuelta»*. La cobertura se pierde. Pero la nota de `PB2`
enumera cuatro causas y `S16` no es ninguna, así que la ficha de quien nunca llegó a pagar su
primer cobro se queda publicada.

**El camino.**

1. `S2` deja la suscripción `ACTIVE` y la ficha se publica.
2. El primer cobro se rechaza. `S16` la manda a `CHARGE_DECLINED`, que `B/02` §2.2 deja **fuera de
   los vivos** junto con `ABANDONED` y `CANCELLED`, *«porque no tienen autorización que pueda
   cobrar»*.
3. `PB2` declara sus causas: *«trial vencido (T3), suspensión (S6), cancelación consumada (S12), o
   excedente tras un downgrade»*. `S16` no está.
4. Quien lea esa columna como la lista de disparadores —que es exactamente cómo se lee la columna
   gemela de `PB3`, donde *«S5, S7, T5»* **es** la lista— no baja la ficha.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9, `PB2`, columna de nota: *«trial vencido (T3), suspensión (S6)
  (épica de billing), cancelación consumada (S12) (épica de billing), o excedente tras un downgrade
  (épica de billing)»*.
- `B/03-maquinas-de-estado.md` §3.1 y §3.2, `S16`; `B/02-modelo-de-datos.md` §2.2: *«Quedan afuera
  `ABANDONED`, `CANCELLED` y `CHARGE_DECLINED`»*.

**Severidad.** `ALTA`. No es `CRITICA` porque el evento declarado de `PB2` sigue siendo genérico
—*«se pierde la cobertura»*— y una implementación que lo lea así hace lo correcto. Lo que está roto
es la única enumeración escrita, y su gemela de `PB3` demuestra que esa columna **sí** se lee como
normativa.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** `S16` y `CHARGE_DECLINED` son el
cambio 9 de la FASE 9, aplicados en `B/03`; la lista congelada de `PB2` vive en `V/03`, en la otra
épica, y nadie la volvió a leer.

---

### F-8bA2-005 — La clase de actor del reloj no tiene dónde declararse, y `PB4` y `PB5` son relojes que nadie declaró

**Qué se rompe.** `V/17` §3.4 crea una clase de operación *«declarada transición por transición»*,
y **ninguna de las dos tablas de transiciones del programa tiene columna para declararla**. La
única transición nombrada es `T3`, en prosa. `G-R3-B` —el guard que sostiene la propiedad que vuelve
segura a la clase— se queda sin dominio: no hay conjunto que recorrer, así que pasa en verde
siempre. Y las otras dos transiciones de verticales disparadas por el reloj, `PB4` y `PB5`, quedan
afuera de la clase, con la regla *«nunca se infiere»* impidiendo que alguien las meta al leer.

**El camino.**

1. `V/17` §3.4 declara: *«Las transiciones disparadas por el reloj son una segunda clase de
   operación … los pasos 5, 6 y 7 se resuelven sobre la capacidad del ACTOR»*, y acto seguido: *«**La
   clase se declara transición por transición**, nunca se infiere»*.
2. Las tablas donde vive una transición son `V/03` §2, §9, §11 y `B/03` §3.2, §8. Sus columnas son
   `#`, `desde`, `evento`, `hacia`, `condición`/`nota` y `efectos`. **Ninguna tiene columna de
   clase**, y ninguna fila la menciona.
3. Entonces el conjunto de transiciones declaradas de esta clase es **vacío**, salvo la mención de
   `T3` en la prosa del §3.4. `G-R3-B` dice verificar que *«una transición **disparada por el
   reloj** otorga algo, en vez de quitar»*: o infiere el conjunto —y contradice el §3.4— o lee la
   declaración —y no hay ninguna que leer—.
4. `PB4` (*«día 90 de inactividad»*) y `PB5` (*«N meses sin actividad»*) son transiciones disparadas
   por el reloj. No están declaradas. Por el §3.4, sus pasos 5, 6 y 7 se evalúan **sobre el
   sujeto**, o sea que el sistema le pregunta al dueño de la ficha si su conjunto efectivo le otorga
   *«archivarme la ficha»*. No se lo otorga nadie: caen en el paso 6 y **no se ejecutan**.
5. El §3.5 cierra la última salida: toda operación de dominio *«escribe estado del negocio y es
   auditable»*, y `PB4` y `PB5` escriben estado y lo auditan (regla 4 del núcleo). Son operaciones
   de dominio y recorren los nueve pasos.

**Dónde lo permite el diseño.**

- `V/17-autorizacion.md` §3.4, las tres citas de arriba, y el guard: *«**Una transición de esta
  clase nunca otorga. `T3` quita.**»*
- `V/20-testing.md` §2: `| G-R3-B | una transición **disparada por el reloj** otorga algo, en vez de
  quitar | cap. 17 §3.4 |`; y §2.1: *«un guard que no puede fallar es un comentario con exit code
  0»*.
- `V/03-maquinas-de-estado.md` §9, `PB4` y `PB5`.
- `V/17-autorizacion.md` §3.5, punto 1: el criterio de operación de dominio.

**Severidad.** `ALTA`. La clase está bien elegida y su propiedad de seguridad es la correcta; lo que
falta es el lugar físico donde se declara. Sin él, la defensa que el §3.4 promete no existe y las
dos transiciones que más se parecen a `T3` quedan sin resolver.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Es el cambio 17 de la FASE 9, y el
propio `03-R3-resuelto.md` §6 ítem 2 lo anticipó a medias: *«Riesgo: bajo mientras la propiedad … se
verifique; medio si nadie la verifica»*. Hoy nadie la puede verificar, porque no hay declaración
que leer.

---

### F-8bA2-006 — El reloj de retención y `vertical.fin_de_servicio` no son transiciones, así que la clase del reloj, `G-R3-B` y `G5` no los alcanzan

**Qué se rompe.** El único borrado irreversible del programa —el hard delete del día 180— y el
único reloj nuevo que la FASE 9 agregó al modelo de verticales —`vertical.fin_de_servicio`— **no
son transiciones de ninguna máquina**. Las tres defensas que el programa tiene sobre lo que el reloj
hace se comprueban sobre transiciones, así que ninguna de las tres los ve.

**El camino.**

1. `V/02` §4.1 ordena borrar al día 180 *«el contenido publicable de la ficha (textos, fotos, FAQ,
   horarios), los borradores, las preferencias de la cuenta»*. Ese borrado no figura en ninguna
   tabla de transiciones: `PB4` llega a `ARCHIVED` al día 90 y no hay fila que salga de ahí.
2. `V/17` §3.4 define la clase sobre **transiciones**; `G-R3-B` verifica **transiciones**; y `G5`
   —*«ninguna fuente se apaga sin pasar por el reconciliador»*— *«se comprueba sobre los efectos
   declarados de las transiciones del capítulo 03»*.
3. El borrado del día 180 no es ninguna de esas tres cosas. No tiene actor declarado, no tiene clase,
   no tiene guard, y `NUCLEO/03` cierra con *«Los relojes, como jobs concretos con su horario y su
   idempotencia, son de cada subdominio»* — y ningún capítulo de verticales lo declara como job.
4. Lo mismo con `vertical.fin_de_servicio`, que `V/02` §2.1 agrega como columna nueva: es una fecha
   que dispara algo, y del lado de verticales **no dispara ninguna transición**. Qué pasa con las
   fichas publicadas de una vertical cuyo servicio termina no lo contesta `PB2` —su evento es
   perder la cobertura, y la cobertura no cambia porque la vertical cierre—.
5. Se compone con `F-8A2-004`, que sigue llegando: ese mismo reloj no tiene condición de parada
   declarada.

**Dónde lo permite el diseño.**

- `V/02-modelo-de-datos.md` §4.1 (la tabla de retención) y §2.1 (*«`admite_altas` y
  `fin_de_servicio`»* como columnas de `vertical`).
- `V/15-entitlements-y-limits.md` §4.2: *«**El guard**: ninguna fuente se apaga sin pasar por el
  reconciliador. Se comprueba sobre los efectos declarados de las transiciones del capítulo 03.»*
- `NUCLEO/03-maquinas-de-estado.md`, *«Lo que esta mitad NO cierra»*: *«**Los relojes**, como jobs
  concretos con su horario y su idempotencia, son de cada subdominio.»*

**Severidad.** `ALTA`. El reloj sin dueño es el que destruye datos, y es el único del programa que
no se puede revertir.

**¿Es nuevo, o es el arreglo?** **Mitad y mitad.** El reloj de retención sin dueño es anterior; lo
que la FASE 9 agregó es una defensa (`V/17` §3.4 + `G-R3-B`) cuyo alcance **excluye por
construcción** al caso más caro, y una columna-reloj nueva (`fin_de_servicio`, cambio 15) que nace
del lado de verticales sin transición que la consuma.

---

### F-8bA2-007 — `PB1` y `T1` son dos transiciones de dos máquinas sobre un solo evento, y ningún capítulo declara que sean una transacción

**Qué se rompe.** Si `PB1` confirma y `T1` no, queda **una ficha publicada sin fila de trial**: su
dueño sigue en `PRE_TRIAL`, su cobertura es la de pre-trial —que no otorga ninguna capacidad
comercial—, y **nada baja esa ficha nunca**, porque `PB2` necesita una pérdida de cobertura que no
ocurre. Es el huérfano exacto que la partición de `T1` creó.

**El camino.**

1. `V/03` §9 dice de `PB1` que *«publicar es quedar visible, y es el evento que consume el trial en
   las verticales con ficha»*. `V/03` §2 dice de `T1` que su evento es *«el evento de activación
   declarado por la vertical»*, que para esas tres verticales **es `PB1`**.
2. Son dos transiciones de dos máquinas distintas disparadas por un solo acto. La regla 3 del núcleo
   dice que *«una transición es atómica junto con sus efectos locales»* — **`T1` no es un efecto de
   `PB1`**: es una transición con su propia fila en su propia tabla, con su propia condición y sus
   propios efectos.
3. Ningún capítulo declara que las dos compartan transacción. `03-R3-resuelto.md` §1.3 paso 6 lo
   afirma —*«`PB1` ejecuta, y **`T1` es su efecto**, en la misma transacción»*— y **eso no se
   aplicó a ningún capítulo**: la fila de `PB1` en `V/03` §9 no menciona a `T1`, y la de `T1` no
   menciona a `PB1`.
4. `T1` tiene motivos concretos para fallar después de `PB1`: la `UNIQUE(hash_del_correo_normalizado,
   vertical)` nueva (F-8bA2-008), la `UNIQUE(user_id, vertical)` en una carrera de dos publicaciones
   simultáneas, o la ausencia de versión vendible de la que derivar (`F-8A2-016`, que sigue
   llegando).
5. Sin atomicidad declarada, el desenlace es una ficha `PUBLISHED` cuyo dueño está en `PRE_TRIAL`
   para siempre: no hay trial que venza, así que `T3` no existe, así que `PB2` no tiene disparador.

**Dónde lo permite el diseño.**

- `V/03-maquinas-de-estado.md` §9, `PB1`; §2, `T1` y sus efectos *«**crea la fila de `trial`**; se
  asigna el plan de trial; arranca el reloj; se agenda la campaña previa»*.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 3: *«Una transición es atómica junto con sus efectos
  locales.»*
- `V/20-testing.md` §1: la capa de dominio dice cubrir *«carreras»* sin que ningún capítulo de esta
  épica declare contra qué regla.

**Severidad.** `ALTA`. Deja un recurso público sin ninguna relación comercial y sin ningún proceso
que lo encuentre, y el arreglo es una línea de declaración — no un rediseño.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Antes de la FASE 9 la fila no la creaba
`T1`, así que la falla de `T1` no podía dejar a `PB1` huérfano de esa forma. El cambio 13 movió la
creación de la fila adentro de `T1` sin declarar la frontera transaccional entre las dos máquinas.

---

### F-8bA2-008 — `T1` puede tener su condición satisfecha y aun así no poder ejecutarse, y ninguna regla de lectura cubre ese caso

**Qué se rompe.** El re-registrado con el mismo correo entra a `PRE_TRIAL` —es la ausencia de
fila—, pasa los nueve pasos completos (el paso 6 le otorga la capacidad de activación, porque es
**dato de la versión de pre-trial de la vertical**, no del historial de la persona) y su `T1` muere
contra una restricción de base. No hay estado al que ir, no hay mensaje declarado, y la persona
queda en `PRE_TRIAL` chocando contra el mismo error cada vez que aprieta publicar.

**El camino.**

1. Una persona consume su trial en Gastronomía. `T1` creó la fila con el hash de su correo
   normalizado.
2. Borra la cuenta —o pasan los 180 días—. La fila *«sobrevive al borrado de la cuenta»* con su
   hash intacto.
3. Se registra de nuevo con el mismo correo y obtiene otro `user_id`. Para ese `user + vertical`
   **no hay fila**, y no haber fila **es** `PRE_TRIAL` (`NUCLEO/03` §1, regla 2). Su cobertura es la
   de pre-trial.
4. Publica. Paso 5: sí. Paso 6: la versión de pre-trial de Gastronomía **otorga la capacidad de
   activación**, porque la vertical declara evento y su plan de trial tiene días > 0 — el «si y sólo
   si» de `V/02` §2.1 cuantifica sobre la **vertical**, no sobre la persona. Paso 7: pasa.
5. `T1` corre su condición —*«la vertical declara evento y su plan de trial tiene días de trial >
   0»*— y **la cumple**. Intenta el `INSERT` y la `UNIQUE(hash_del_correo_normalizado, vertical)` lo
   rechaza.
6. La regla 1 del núcleo cubre *«un intento de transición que la tabla no declara»*. Ésta **está
   declarada y su condición se cumple**: lo que falla es la escritura. Ninguna regla dice qué pasa,
   qué se le contesta, ni si eso pone la marca `requiere_conciliación`.
7. El resultado depende de una decisión que nadie tomó: con `PB1` y `T1` en la misma transacción, un
   error de base sin mensaje; sin atomicidad declarada (F-8bA2-007), una ficha publicada y un trial
   que no existe.

**Dónde lo permite el diseño.**

- `V/02-modelo-de-datos.md` §2.2: *«**`UNIQUE(hash_del_correo_normalizado, vertical)`**, sin
  condición de estado»*, y su justificación: *«Alguien se registra de nuevo con el mismo correo,
  obtiene un `user_id` nuevo, entra en `PRE_TRIAL` y **publica**»*.
- `V/02-modelo-de-datos.md` §2.1: *«La capacidad de activación está en la versión de pre-trial de
  una vertical **si y sólo si esa vertical** declara evento de activación y su plan de trial tiene
  días > 0.»*
- `V/03-maquinas-de-estado.md` §2, `T1`: la condición, que ya no menciona a la persona.
- `NUCLEO/03-maquinas-de-estado.md` §1, regla 1: cubre sólo *«un intento de transición que la tabla
  no declara»*.

**Severidad.** `ALTA`. El bloqueo funciona —el segundo trial no ocurre, que es lo que importa— pero
su modo de falla no está diseñado, y deja a una persona real sin poder publicar y sin explicación.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo, y es la contracara directa del cambio
13.** La condición vieja de `T1` —*«no hay trial previo para ese `user + vertical`»*— era el lugar
donde este rechazo se evaluaba **como condición**, o sea de forma controlada. Se cayó por
redundante contra `user_id`, y con ella se fue el único punto donde el rechazo por identidad tenía
una respuesta declarada. El bloqueo se mudó a la base (cambio 16) y el camino de vuelta no se
escribió.

---

### F-8bA2-009 — El invariante §64.6 lo sostiene un override del plan de trial que todavía no está asignado cuando se autoriza la publicación que dispara `T1`

**Qué se rompe.** *«Máximo una ficha en trial»* se hace cumplir con el primer override del **plan de
trial**, y `T1` asigna el plan de trial **después** de que la publicación esté autorizada. La única
publicación que se resuelve contra la versión de **pre-trial** es justamente la que enciende el
trial, y esa versión no declara ningún limit de fichas: el paso 7 no tiene contra qué contar.

**El camino.**

1. `NUCLEO/04` §2.2 ubica el invariante 6 —*«máximo una ficha en trial»*— en *«el primer override de
   esa misma lista (`DEC-TRIAL-001`)»*, o sea en la resolución del **plan de trial**.
2. `V/03` §2 dice que `T1` *«asigna el plan de trial»* entre sus efectos, y `V/02` §2.1 que la
   versión de pre-trial *«otorga exactamente tres cosas»*: borradores ilimitados, la capacidad de
   activación y la de contratar. **Ningún limit de fichas publicadas.**
3. `V/18` §1.3 fija la lectura: *«Una clave que una vertical no declara no vale cero: **no existe
   para esa vertical**.»* Aplicado acá, un limit que la versión no declara no acota nada.
4. Entonces el paso 7 de la publicación que dispara `T1` se resuelve contra un conjunto efectivo sin
   tope de fichas. Con un solo hilo el daño es cero —esa publicación es la primera y `T1` saca a la
   persona de `PRE_TRIAL`—; con dos publicaciones simultáneas las dos pasan el paso 7, y el único
   freno es la `UNIQUE(user_id, vertical)` sobre la fila de `T1`, que acota **el trial**, no las
   fichas. Cuántas fichas quedan publicadas depende de si `PB1` y `T1` comparten transacción, que es
   lo que F-8bA2-007 mide que nadie declaró.
5. `F-8A2-013` —esta épica no tiene capítulo de concurrencia— sigue llegando, así que no hay ninguna
   regla de serialización que cerrar el caso por otro lado.

**Dónde lo permite el diseño.**

- `NUCLEO/04-invariantes.md` §2.2: `| 6 | máximo una ficha en trial | el primer override de esa
  misma lista (`DEC-TRIAL-001`) |`.
- `V/02-modelo-de-datos.md` §2.1: *«Otorga exactamente tres cosas: … borradores ilimitados, **sin
  ninguna capacidad comercial**—, **la capacidad de activación de la vertical**, y la de contratar
  una suscripción.»*
- `V/03-maquinas-de-estado.md` §2, `T1`, efectos: *«se asigna el plan de trial»*.
- `V/18-partner.md` §1.3: *«Una clave que una vertical no declara no vale cero: no existe para esa
  vertical.»*

**Severidad.** `ALTA`. El invariante figura entre los catorce *«que sostiene un servicio»* y su sede
declarada no está aplicada en el único instante en que hace falta.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** La versión de pre-trial y su
enumeración cerrada de tres cosas son el cambio 13/`R3-C`. `03-R3-resuelto.md` §1.3 paso 5 afirma
*«el limit de fichas publicadas de la versión de pre-trial es **1** — es el §64.6»*, y **ese cuarto
ítem no llegó al capítulo**: `V/02` §2.1 dice «exactamente tres».

---

### F-8bA2-010 — Publicar una versión nueva del plan de piso, del de pre-trial, o de un plan con grants anclados no invalida ningún caché ni dispara el reconciliador

**Qué se rompe.** La lista de siete eventos que invalidan el conjunto efectivo sólo conoce planes
*«al que hay **suscripciones** ancladas»*. Los tres anclajes que la FASE 9 agregó —`BASE` al plan de
piso, `PRE_TRIAL` al de pre-trial, y el grant al plan con su versión vigente— **no son
suscripciones**. Una capacidad que se saca de una de esas tres versiones sigue viva en el caché de
todo el mundo, y el reconciliador de excedentes, que se dispara con la misma lista, nunca corre.

**El camino.**

1. `V/02` §3 abre diciendo que acá *«un error es de seguridad y no de rendimiento: un entitlement
   que sigue vivo después de revocado es acceso indebido»*.
2. La lista de §3.2 tiene siete entradas. La única que cubre un cambio de catálogo es *«se publica
   una versión nueva de un plan al que hay **suscripciones ancladas**»*.
3. El plan de piso y el de pre-trial son **no vendibles**, uno por vertical: nadie se suscribe a
   ellos, así que ninguna suscripción los ancla. Publicarles una versión nueva no invalida nada.
4. El grant tampoco: `12-contrato…` §2.8 decide que *«El grant se ancla al PLAN … y resuelve la
   versión vigente»*. Publicar una versión nueva de ese plan cambia lo que el grant otorga y **no
   hay suscripción anclada** que dispare la entrada 6.
5. El camino de reparación que el propio diseño prevé es el que más lo necesita: `V/02` §2.1 advierte
   que *«si alguien le siembra una clave comercial a la de piso o a la de pre-trial, **toda la
   plataforma la recibe gratis, para siempre**»*. `G-R3` lo detecta en CI; corregirlo es publicar una
   versión nueva — y esa corrección **no llega a ningún caché**.
6. `V/15` §4.2 apoya el reconciliador en *«la misma lista que invalida el caché … Una lista, dos
   consumidores»*, y advierte que *«que falte un disparo es una capacidad regalada o un límite
   incumplido»*. Faltan tres.

**Dónde lo permite el diseño.**

- `V/02-modelo-de-datos.md` §3.2, la tabla de siete, entrada: *«se publica una versión nueva de un
  plan al que hay suscripciones ancladas»*; y §3: *«un entitlement que sigue vivo después de
  revocado es acceso indebido»*.
- `12-contrato-de-cobertura.md` §2.5 (`BASE` → versión de piso), §2.8 (*«El grant se ancla al PLAN,
  no a una versión, y resuelve la versión vigente»*).
- `V/02-modelo-de-datos.md` §2.1, el aviso sobre las dos versiones no vendibles.
- `V/15-entitlements-y-limits.md` §4.2.

**Severidad.** `ALTA`. Es una revocación que no se propaga, sobre las dos versiones que el propio
capítulo llama *«un punto único de falla»*.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo.** Las tres fuentes que quedaron fuera de
la lista —piso, pre-trial y el anclaje del grant al plan— son los cambios 5, 13 y 14 de la FASE 9.
La lista de siete es anterior y nadie la volvió a contar.

---

### F-8bA2-011 — Ningún documento enumera qué estados de la máquina de suscripción emiten una fuente de cobertura, y la palabra «vivo» ya nombra un conjunto que incluye `SUSPENDED`

**Qué se rompe.** El paso 5 pregunta por *«al menos una fuente viva»* y `cubierto` cuenta *«fuentes
vivas de clase `TÍTULO`»*. Del otro lado de la frontera, lo único enumerado con esa palabra son los
**seis estados vivos** del candado, que incluyen `SUSPENDED` y `PENDING_AUTHORIZATION`. Si la
implementación de billing hace corresponder los dos conjuntos —que es la lectura literal— un
suspendido queda cubierto: el mismo fail-open que `D-01` cerró para el addon, por la otra puerta.

**El camino.**

1. `12-contrato…` §4 decide que *«El estado exacto de la suscripción no cruza»* y que verticales *«no
   distingue `ACTIVE` de `GRACE_PERIOD`»*. Quién decide si una suscripción emite fuente es, por
   construcción, **billing**.
2. Ningún documento de billing lo enumera. Lo único enumerado es el conjunto de `B/02` §2.2: *«Los
   «vivos» siguen siendo los mismos seis: `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`,
   `PAUSED`, `SUSPENDED` y `CANCEL_SCHEDULED`»* — y ese conjunto es el del candado de unicidad, no
   el de la cobertura.
3. Los dos usan la misma palabra. Leídos juntos, un `SUSPENDED` emite fuente y queda `cubierto`.
4. El diseño dice lo contrario en dos lugares —`12-contrato…` §1.1: *«**suspendido es no tener
   cobertura**»*, y la nota de `PB2`: *«suspensión (S6)»* entre las causas de pérdida— pero ninguno
   de los dos es una enumeración: son dos frases sueltas contra un conjunto escrito.
5. `PENDING_AUTHORIZATION` es la otra mitad, y su respuesta decide otro hallazgo: si emite fuente,
   quien abre un checkout y no lo autoriza tiene 72 h de servicio; si no emite, `S2` **tiene** que
   ser disparador de `PB3`, y no lo es (F-8bA2-003).

**Dónde lo permite el diseño.**

- `12-contrato-de-cobertura.md` §2.1 y §2.4 (*«fuente viva»*, *«al menos una fuente viva de clase
  `TÍTULO`»*); §1.1 (*«suspendido es no tener cobertura»*); §4.
- `B/02-modelo-de-datos.md` §2.2: la enumeración de los seis vivos.
- `V/17-autorizacion.md` §1.2, paso 5: *«¿hay **al menos una fuente viva** para ese `user +
  vertical`?»*
- `V/03-maquinas-de-estado.md` §9, nota de `PB2`.

**Severidad.** `ALTA`. Es la correspondencia estado→fuente de la máquina más grande del programa, y
hoy se resuelve leyendo prosa de dos capítulos de épicas distintas.

**¿Es nuevo, o es el arreglo?** **El arreglo lo volvió reportable.** `R2` separó fuentes en clases y
puso `cubierto` a depender de cuáles están vivas (cambio 1), y `R1` reescribió el conjunto de
estados vivos del candado partiéndolo en dos claves (cambio 7). Los dos usan «vivo» para conjuntos
distintos y ninguno enumera el que el paso 5 necesita.

---

### MEDIA

### F-8bA2-012 — Ningún guard verifica que cada vertical **tenga** su versión de piso y su versión de pre-trial: `G-R3` comprueba lo que otorgan, no que existan

**Qué se rompe.** Las dos versiones no vendibles son ahora el único piso del paso 5 y el único
título de `PRE_TRIAL`. Si una falta en una vertical, la fuente correspondiente **no se puede
expresar** —la referencia no es anulable— y desaparece en silencio: sin la de piso, un
`TRIAL_EXPIRED` de esa vertical no puede volver a contratar nunca; sin la de pre-trial, nadie
enciende su trial ahí.

**El camino.**

1. `12-contrato…` §2.3 decide que *«**Una fuente sin referencia resoluble no se puede expresar.**»*
2. `12-contrato…` §2.5 y `V/02` §2.1 anclan `BASE` a la versión de piso y `PRE_TRIAL` a la de
   pre-trial, *«uno por vertical»* cada una.
3. `G-R3` se enuncia sobre lo que esas versiones **otorgan**: *«ninguna de las dos versiones no
   vendibles de una vertical otorga una clave de la clase comercial ni ningún entitlement medido»*,
   más el «si y sólo si» de la capacidad de activación. Sobre una vertical donde la versión no
   existe, el predicado se cumple vacuamente.
4. Una vertical nueva —o una siembra incompleta— deja a toda su población sin fuente `BASE`. El paso
   5 vuelve a rechazar a todo el mundo ahí, que es exactamente el estado que `R3` fue a corregir, y
   falla en silencio.

**Dónde lo permite el diseño.**

- `12-contrato-de-cobertura.md` §2.3 y §2.5.
- `V/02-modelo-de-datos.md` §2.1: el enunciado de `G-R3`, *«Se comprueba sobre el catálogo, en CI, en
  las dos direcciones»*.

**Severidad.** `MEDIA`. Falla cerrado, que es la dirección correcta, pero apaga una vertical entera
sin que nada lo avise.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo** (cambios 13 y 14): las dos versiones no
vendibles, y el guard que las vigila, nacen en la FASE 9 — y el guard vigila la mitad del riesgo.

---

### F-8bA2-013 — `T1` no lee `admite_altas` ni `fin_de_servicio`: una vertical que se está discontinuando sigue encendiendo trials nuevos

**Qué se rompe.** Las dos columnas nuevas de `vertical` existen porque billing las lee para no dar
de alta en una vertical que cierra. La máquina de trial, que vive del lado de verticales, no las
lee: alguien publica su primera ficha en una vertical con fecha de fin de servicio y `T1` le
enciende un trial de treinta días que termina después del cierre.

**El camino.**

1. `V/02` §2.1 agrega a `vertical` las columnas *«**si admite altas** y **su fecha de fin de
   servicio**»*, y declara que *«las **lee billing** (`B/10` §4.6)»*.
2. La condición de `T1` es *«la vertical declara evento **y** su plan de trial tiene días de trial >
   0»*. Ninguna de las dos columnas entra.
3. Se anuncia la discontinuación de Experiencia: `admite_altas` pasa a falso y se fija
   `fin_de_servicio`. Del lado de billing no entran altas nuevas.
4. Una persona que ya estaba en `PRE_TRIAL` publica su primera ficha. `T1` dispara, asigna el plan de
   trial y arranca el reloj. Se le prometió una prueba en una vertical que se apaga, y la única
   salida que la prueba tiene —suscribirse— está cerrada por `admite_altas`.

**Dónde lo permite el diseño.**

- `V/02-modelo-de-datos.md` §2.1: las dos columnas y su consumidor declarado.
- `V/03-maquinas-de-estado.md` §2, `T1`: la condición.
- `12-contrato-de-cobertura.md` §4.1: `situaciónDeVertical(vertical) → { admiteAltas, finDeServicio }`
  — la dirección inversa, declarada para billing y sólo para billing.

**Severidad.** `MEDIA`. Daño acotado y reparable con una cortesía, pero es un trial consumido que el
§10.2 no devuelve.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo** (cambio 15): las columnas nacen en la
FASE 9, con un consumidor declarado de un solo lado.

---

## 2. Los dieciocho hallazgos de la FASE 8, reejecutados

`3 cortan · 15 siguen llegando.` Esta sección **no cuenta como hallazgos nuevos** (§4 de las
instrucciones). «En qué paso» refiere al camino tal como está escrito en
[`14-fase-8-adversarial/A2-maquinas-carreras-y-huerfanos.md`](../14-fase-8-adversarial/A2-maquinas-carreras-y-huerfanos.md).

| ID | veredicto | dónde corta, o por qué sigue llegando |
|---|---|---|
| `F-8A2-001` | **CORTA** | **paso 3**. El paso 5 tiene respuesta para `PRE_TRIAL`: es fuente viva y apunta a la versión de pre-trial (`V/03` §2). `T1` dispara. |
| `F-8A2-002` | **CORTA** | **paso 4**. `PRE_TRIAL` no tiene fila y eso no lo vuelve la ausencia de un estado (`NUCLEO/03` §1, regla 2). La `UNIQUE(user_id, vertical)` queda intacta y su glosa pasa a ser cierta. |
| `F-8A2-003` | **SIGUE** | **paso 3**. *«Invalidar es borrar»* y el reconciliador *«actúa sólo si algo bajó»* siguen tal cual; nada guarda el conjunto anterior. Agravado por F-8bA2-010: hay tres disparadores más que ni siquiera entran a la lista. |
| `F-8A2-004` | **SIGUE** | **paso 3**. `T5` sigue declarando *«corta la campaña de recuperación; se restituye la publicación»* y nada más; `PB3` tampoco toca el reloj de retención. Ahora además ese reloj queda fuera de la clase del actor (F-8bA2-006). |
| `F-8A2-005` | **SIGUE** | **paso 5**. `PB2` sigue disparando por el hecho de perder la cobertura y el reconciliador sigue disparándose *«por condición»*; no apareció ningún barrido periódico que compare publicación contra cobertura. |
| `F-8A2-006` | **SIGUE** | **paso 2**. `T3` y `T4` siguen sin condición de concurrencia ni re-verificación de guarda al confirmar; `V/03` §2 sigue declarando el cruce *«imposible por construcción»* sobre un argumento de estados. |
| `F-8A2-007` | **SIGUE** | **paso 4**. `PB3` sigue con *«S5, S7, T5»* y `PB1` sigue saliendo sólo de `DRAFT`. Agravado: F-8bA2-003 muestra que la lista tampoco cubre la causa *cobertura*, que es la que `PB3` dice cubrir. |
| `F-8A2-008` | **SIGUE** | **paso 3**. Ninguna fila de `V/03` §9 parte de `ARCHIVED`, y §4.2 regla 3 de `V/02` sigue prometiendo *«exportarla o reactivarla»*. |
| `F-8A2-009` | **SIGUE** | **paso 1**. `V/02` §2 sigue modelando `vertical`, `plan`, `plan_version`, sus dos hijas, `addon_version` con sus dos hijas, `trial` y `listing`. **`postulacion` no está.** |
| `F-8A2-010` | **CORTA** | **paso 5**. `V/02` §2.2 agrega *«**`UNIQUE(hash_del_correo_normalizado, vertical)`**, sin condición de estado»*, y el bloqueo vuelve a ser de base. **Dos residuos**: las dos tablas que enumeran los invariantes sostenidos por la base (`NUCLEO/04` §2.1 y `V/02` §5) siguen citando sólo `UNIQUE(user_id, vertical)`; y el **modo de falla** que la restricción produce es F-8bA2-008. |
| `F-8A2-011` | **SIGUE** | **paso 4**. Los estados del outbox siguen siendo cinco y ninguno significa *«ya no corresponde»*. Y el texto nuevo de `NUCLEO/07` §2 resuelve la contradicción **en la dirección que vuelve segura la duplicación**: *«La ocurrencia entonces incluye la fecha objetivo vigente»*, así que la fila vieja conserva su clave, sigue en `pending`, y sale. |
| `F-8A2-012` | **SIGUE** | **paso 3**. La ocurrencia sigue siendo *«el sujeto más el hito»* con un solo `<id>` de trial, y `V/11` §6.2 sigue exigiendo una pieza por persona con tres sujetos. |
| `F-8A2-013` | **SIGUE** | **paso 2**. `11-particion` §4 sigue mandando el capítulo 05 entero a billing y verticales sigue sin regla de concurrencia propia. El dominio **creció**: `T1` ahora escribe una fila, y F-8bA2-007 y F-8bA2-009 son dos carreras nuevas. |
| `F-8A2-014` | **SIGUE** | **paso 1**. `PB4` sigue declarando `PUBLISHED` entre sus orígenes, sin columna de condición. |
| `F-8A2-015` | **SIGUE** | **paso 1**. `V/11` §1.2 sigue diciendo *«ventana de calendario que arranca en T1»* sin fijar el borde. |
| `F-8A2-016` | **SIGUE** | **paso 4**. `V/02` §2.1 y `V/10` §2 siguen derivando de *«las versiones vigentes y vendibles»* sin regla para el conjunto vacío. Ahora además `T1` escribe el piso del trinquete contra ese mismo conjunto. |
| `F-8A2-017` | **SIGUE** | **paso 2**. `G5` sigue comprobándose *«sobre los efectos declarados de las transiciones del capítulo 03»* y la lista de siete sigue con dos entradas que no son transiciones — y con tres disparadores que le faltan (F-8bA2-010). |
| `F-8A2-018` | **SIGUE** | **paso 3**. *«Cae lo más reciente primero»* sigue sin decir qué fecha. |

---

## 3. Ataques que intenté y el diseño resistió

1. **Conseguir un segundo trial re-registrándome con el mismo correo.** Cortado en la base por la
   `UNIQUE(hash_del_correo_normalizado, vertical)` nueva. Es el nivel correcto —`NUCLEO/04` §1:
   *«base antes que servicio»*— y `V/02` §2.2 además declara que aplicar el arreglo del trial antes
   que la restricción abre una ventana. Lo que queda es el modo de falla (F-8bA2-008), no el segundo
   trial.
2. **Hacer que el título `BASE` mantuviera cubierto a un `TRIAL_EXPIRED`.** No se puede: `BASE` es de
   clase `BASE` y `12-contrato…` §2.4 subraya que *«`cubierto` se calcula sólo sobre las fuentes de
   clase `TÍTULO`»*. `PB2` sigue disparando cuando el trial vence y el criterio del §5.1 —*«un trial
   vence de verdad»*— se sigue pudiendo ejercer. El §2.5 punto 1 lo dice y se verifica contra la
   definición del §2.4. **El agujero simétrico existe, pero por el otro extremo del ciclo**
   (F-8bA2-001), no por acá.
3. **Usar `SIN_EMPEZAR` como `NO_VENCE` para regalar cobertura perpetua.** El §2.6 nombra
   explícitamente esa confusión y la dirección en que falla: *«no falla ruidosamente, regala»*. La
   defensa está escrita y es la correcta.
4. **Volver a `PRE_TRIAL` o a `TRIAL_ACTIVE` desde `TRIAL_EXPIRED`.** Sigue sin haber puerta, en tres
   niveles: la tabla no lo declara, el §10.2 lo prohíbe, y ahora la fila que `T1` creó es la
   evidencia que sobrevive al borrado de la cuenta.
5. **Extender un trial ya vencido con una cortesía para revivir la campaña.** `V/11` §7 sigue
   cerrándolo por las dos vías por separado, y la condición de `T4` no se tocó. El único camino
   sigue siendo la carrera de `F-8A2-006`.
6. **Reentrada del job de vencimiento a la mitad de una tanda.** La guarda de `T3` exige origen
   `TRIAL_ACTIVE` y la regla 1 del núcleo cierra la puerta sin candado. Sigue resistiendo.
7. **Hacer que `T1` dispare en Partner.** Falla cerrado **por dato, no por rama**: su versión de
   pre-trial no lleva la capacidad de activación, porque el «si y sólo si» de `V/02` §2.1 lo
   excluye. El rechazo cae en el paso 6, que es donde corresponde. El problema de Partner es otro y
   es el opuesto: que nunca sale de `PRE_TRIAL` (F-8bA2-001).
8. **Dejar un estado colgado con `RECONCILIATION_REQUIRED`.** El cambio 8 lo cierra bien y en la
   dirección correcta: la marca no pisa la columna de estado, la fila conserva a dónde volver, y
   `S15` ya no adivina. Intenté producir una fila sin estado alcanzable y no hay ninguna.
9. **Mantener cubierto a un suspendido con su propio addon vivo.** Cerrado por `D-01` / `12-contrato…`
   §2.4: `ADDON` es de clase `COMPLEMENTO` y no cuenta para `cubierto`. La defensa es explícita y
   trae su propio contraejemplo escrito.
10. **Hacer que `PB6` —despublicar— devolviera el trial, o que el reloj se frenara al despublicar.**
    Cerrado dos veces: la nota de `PB6` (*«y **no devuelve el trial**»*) y `V/11` §1.2, que además
    nombra la variante lenta —publicar, despublicar, volver en seis meses— como el motivo de la
    regla.

---

## 4. Fuera de mi vector

Anotado y no perseguido.

1. **`NUCLEO`** — `NUCLEO/04-invariantes.md` §3 tiene ahora **quince** filas (`D1`…`D15`, con `D15`
   agregado por el cambio 7), y el §5 y su cierre siguen diciendo *«14»*, *«Cincuenta y un
   invariantes»* y *«ocho los sostiene la base»*. Es **la misma corrección que la FASE 8 ya aplicó
   una vez** (nota al pie del §5, sobre `D13`/`D14`): la aritmética se rehízo contra la cuenta de
   entonces y el cambio siguiente la volvió a desactualizar. Pasada C.
2. **`NUCLEO`** — `NUCLEO/04` §2.1, invariante 1, y `V/02` §5 siguen sosteniendo *«trial máximo una
   vez por `user + vertical`»* sólo sobre `UNIQUE(user_id, vertical)`. La segunda restricción que lo
   sostiene de verdad —la del hash— está en `V/02` §2.2 y no llegó a ninguna de las dos
   enumeraciones. Es el residuo de `F-8A2-010`.
3. **`NUCLEO`** — `NUCLEO/07` §2 sigue teniendo las dos frases enfrentadas (*«el reloj no entra en la
   clave»* contra *«La ocurrencia entonces incluye la fecha objetivo vigente»*), sólo que ahora la
   segunda trae su justificación. Cuál rige decide si `F-8A2-011` manda un correo de más o de menos.
4. **Autorización (A1)** — `G-R3-C` exige que *«toda operación de dominio **declara** si pasa por el
   paso 5»* y que *«el build falla si alguna no lo declara»*. Su predicado no dice nada sobre el
   **valor** declarado, así que la exención por ruta que todo el capítulo 17 existe para impedir pasa
   a ser una casilla obligatoria en vez de algo prohibido. Es la regla de `V/20` §2.1 —*«el texto con
   que falla no puede afirmar más de lo que el predicado verifica»*— sobre un guard de la FASE 9.
5. **Datos y acoplamiento (A3)** — `postulacion` sigue sin aparecer en el modelo de datos de ninguna
   de las dos épicas, pese a ser la novena máquina. Lo reporto como defecto de máquina en
   `F-8A2-009`; que además falte del reparto es materia del agente de acoplamiento.
6. **La costura (C1)** — la palabra **«vivo»** nombra dos conjuntos distintos en dos épicas: los seis
   estados vivos del candado (`B/02` §2.2) y las fuentes vivas de la cobertura (`12-contrato…` §2.1).
   Lo reporto como F-8bA2-011 por el lado de la máquina; la colisión de vocabulario en sí es de la
   costura.
