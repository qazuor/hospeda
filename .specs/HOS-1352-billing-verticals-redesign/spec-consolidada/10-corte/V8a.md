# V8a · Superficies, al corte

<a id="pieza-v8a"></a>
**[PIEZA:V8a](#pieza-v8a)** — pieza `V8a`, mitad *a* de la unidad `V8`; **cuándo**: al corte;
**fuente**: Z (lista de piezas del corte, `16-fase-7-del-paraguas.md` §4.6; [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) puntos
1 y 3). Su otra mitad es [PIEZA:V8b](../20-fase-4/V8b.md#pieza-v8b), de la Fase 4.
Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:955

## Objetivo, alcance y fuera de alcance

**Objetivo.** Que las superficies de verticales digan lo que el diseño obliga a decir y no decidan
nada por sí mismas, y que soporte tenga sus tres acciones sobre lo ajeno —editar el contenido de una
ficha, borrarla y dar de baja una cuenta, siempre a pedido y con rastro—, todo lo que hace falta
desde el día uno (`41-corte-del-mvp/00-propuesta.md` §1, citado en [FILA:V8a](#fila-v8a)).

<a id="fila-v8"></a>
**FILA:V8 — Superficies** *(unidad partida en [PIEZA:V8a](#pieza-v8a), al corte, y [PIEZA:V8b](../20-fase-4/V8b.md#pieza-v8b), después:
corte del MVP, owner 2026-10-01, Z)*. Qué deja funcionando la unidad, en su forma vigente:

1. **Mi Cuenta, los mensajes que hay que decir, el panel de postulaciones** —éste es de Partner y va
   a `V8b`—;
2. **el botón de suscribirse que, a quien todavía no publicó en esa vertical, lo manda a publicar en
   vez de al checkout si publicar le arrancaría el trial** (FASE 9 vuelta 1, `F-8V1D1-004`; `19` §4
   fila 23, donde está la regla entera; owner 2026-09-25, FASE 9 completa, 6c; el espejo de billing
   es `B/19` §4, de `B13a`);
3. **las filas 20 a 22** del `19` §4: la ficha `PURGED`, *«suscribite para publicar»* y la presencia
   que dejó de verse o está moderada —la 22 es de Partner y va a `V8b`—;
4. **la acción administrativa 15, *«editar el contenido de una ficha ajena»***: crearla en borrador a
   nombre de su dueño, corregirla, restaurar contenido, **sin publicar, sin destacar y sin borrar**,
   **con permiso propio** (el *«sin borrar»* vale para la edición de contenido: borrar a pedido del
   dueño son las acciones 23 y 24; revisión del owner, casos vecinos, 2026-09-29, caso F-C),
   auditada con el actor, el sujeto y el *«por qué»* de `NUCLEO/08` §1.2, y con el aviso al dueño de
   la **fila 26** del `19` y su correo de `NUCLEO/07` §6 (`NUCLEO/08` §3; [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003); owner
   2026-09-26, `G5-2`; la unidad, con OK del owner, FASE 9 vuelta 1, L; la fila, FASE 9 vuelta 2,
   `F-8V2D1-002`), **con sus pasos 5 a 7 evaluados sobre el dueño de la ficha y no sobre el admin**
   (`17` §3.2 regla 3; FASE 9 vuelta 2, `F-8V2A1-004`);
5. **las acciones administrativas 23 y 24, borrar una ficha ajena por `PB12` y dar de baja una
   cuenta** (caso I-C), **las dos a pedido de su dueño y con motivo** (§2.11; revisión del owner,
   casos vecinos, 2026-09-29, caso F-C);
6. **las filas 27 y 28 del `19` §4**: la alerta de precio cerrada y la conversación en sólo lectura
   sobre una ficha `PURGED` (owner 2026-09-27, FASE 9 vuelta 2, `R9`);
7. **la fila 29 del `19` §4**: la vertical sin planes disponibles (owner 2026-09-27, FASE 9 vuelta 2,
   `R24`);
8. **en la acción 24, el borrado de las filas de `accounts` de la cuenta en la misma transacción que
   la baja** (`AUT-015`; FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, G).

**Capítulos**: `19` · `08` §1.2 y §3 (núcleo). **Guards**: ninguno.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:68

<a id="fila-v8a"></a>
**FILA:V8a — Superficies, al corte.** **Todo lo de `V8` salvo lo de Partner**: Mi Cuenta y los
mensajes que hay que decir, el botón de suscribirse de la fila 23, las filas 20, 21, 27, 28 y 29 del
`19` §4, y las acciones administrativas 15, 23 y 24, cada una con lo que la fila de `V8` le fija
(corte del MVP, owner 2026-10-01, Z; `41-corte-del-mvp/00-propuesta.md` §1: *«el botón de la fila
23, la fila 29 y la acción 24 … hacen falta desde el día uno»*). *(Que el resto de `V8` también va
en `V8a` lo derivó la fuente de que lo de Partner es «lo único que la ata a `V7`», y lo marca como
inferido.)* **Capítulos**: `19`, salvo las filas 22, 32, 33 y 34, que son de Partner (Z) · `08` §1.2
y §3 (núcleo). **Guards**: ninguno.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:69

**Alcance, además de la fila.** Las decisiones de las que esta pieza es dueña: [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003) con
[DEC-AUTH-003#📌3](../01-decisiones-vigentes.md#dec-auth-003-p3); la baja de cuenta manual de [DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5), [DEC-DATA-005#📌6](../01-decisiones-vigentes.md#dec-data-005-p6) y
[DEC-DATA-005#📌7](../01-decisiones-vigentes.md#dec-data-005-p7); los recuentos vigentes de [DEC-RF-008#📌1](../01-decisiones-vigentes.md#dec-rf-008-p1) y [DEC-RF-008#📌4](../01-decisiones-vigentes.md#dec-rf-008-p4) (en lo vivo:
qué son la 15, la 23 y la 24; las cifras que ahí figuran están muertas); y las acciones [ACC:15](../02-nucleo.md#acc-15),
[ACC:23](../02-nucleo.md#acc-23) y [ACC:24](../02-nucleo.md#acc-24). **Y lo que implementa como «también»**: el aviso del botón *Empezar* de
Turista ([DEC-TRIAL-006](../01-decisiones-vigentes.md#dec-trial-006), fila 1), el botón que manda a publicar ([DEC-TRIAL-010#📌1](../01-decisiones-vigentes.md#dec-trial-010-p1)), su mitad
de la pantalla única de plazos y el editor de planes y claves del panel ([ACC:18](../02-nucleo.md#acc-18), [ACC:22](../02-nucleo.md#acc-22),
[DEC-DATA-008#📌1](../01-decisiones-vigentes.md#dec-data-008-p1), [DEC-ARCH-013](../01-decisiones-vigentes.md#dec-arch-013)), las superficies de la alerta cerrada y la conversación en
sólo lectura ([DEC-DATA-005#📌2](../01-decisiones-vigentes.md#dec-data-005-p2)), el correo de `PB12` con la línea de que fue a pedido
([DEC-DATA-007#📌1](../01-decisiones-vigentes.md#dec-data-007-p1)), el listado de arreglos y los avisos de la moderación ([DEC-DATA-007](../01-decisiones-vigentes.md#dec-data-007)), y el
reemplazo del correo de una postulación sin cuenta por la acción 24 ([DEC-AUTH-005#📌1](../01-decisiones-vigentes.md#dec-auth-005-p1)); lee
`puedeCobrarle` ([DEC-ARCH-006#📌8](../01-decisiones-vigentes.md#dec-arch-006-p8)).

**Fuera de alcance:**

- lo de Partner —el panel de postulaciones, las filas 22, 32, 33 y 34 y la acción 25—: [FILA:V8b](../20-fase-4/V8b.md#fila-v8b);
- la clase de la acción 15 (pasos 5 a 7 sobre el dueño) y el permiso de acción en las rutas de ficha
  de la 15 y la 23: `V5` ([FILA:V5](V5.md#fila-v5));
- `PB12` y su lista cerrada de lo que cuelga de `listing`: `V6` ([TRANS:V:PB12](../04-catalogos.md#trans-v-pb12));
- `puedeCobrarle` real: `B4`; la copia del nombre y el correo en el comprobante y el comprobante sin
  nombre de `P1`: `B5`;
- la baja desde Mi Cuenta: fuera de la épica ([HOS-1393](https://linear.app/hospeda-beta/issue/HOS-1393),
  [DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5));
- la tarea puntual que borraría los seudónimos de las cuentas dadas de baja si el abogado contesta en
  contra la pregunta 5 de `V/22`: no es una fila del catálogo ni se construye ahora; corre una vez,
  fuera del panel, y se anota quién y cuándo ([DEC-DATA-005#📌7](../01-decisiones-vigentes.md#dec-data-005-p7); [ACC:24](../02-nucleo.md#acc-24));
- *«entrar como»* el cliente: versión posterior (`17`, *«Lo que este capítulo NO cierra»*).

## Historias de usuario y criterios de aceptación

<a id="lista-v8"></a>
**LISTA:V8 — «Lista cuando» de la unidad** *(partida: ver [LISTA:V8a](#lista-v8a) y [LISTA:V8b](../20-fase-4/V8b.md#lista-v8b); corte del
MVP, owner 2026-10-01, Z)*, en su forma vigente:

1. **ninguna superficie decide por sí misma**: lo que se oculta ya está rechazado por `V5`;
2. **el botón de suscribirse de quien todavía no publicó en esa vertical lo manda a publicar, no al
   checkout** (owner 2026-09-25; FASE 9 completa, 6c), **si publicar le arrancaría el trial; en una
   vertical con los días de trial en cero, sin evento declarado o con el hash con fila lo manda al
   checkout** (la regla de `19` §4 fila 23; FASE 9 vuelta 1, `F-8V1D1-004`, `F-8V1A1-008`; el caso
   de la vertical sin altas salió con la revisión del owner, 2026-09-28, C8);
3. **la acción 15 edita el contenido de una ficha ajena y no la publica, no la destaca ni la borra
   —un acto ajeno no dispara `T1`—; un admin sin su permiso no la ejecuta, aunque tenga otros, y cada
   ejecución deja su registro de auditoría con actor distinto del sujeto y el aviso al dueño**
   ([DEC-AUTH-002](../01-decisiones-vigentes.md#dec-auth-002), [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003); `G5-2`; FASE 9 vuelta 1, L);
4. **en una vertical sin ninguna versión de plan vigente y vendible la pantalla dice *«esta vertical
   no tiene planes disponibles»* y no muestra ningún botón de suscribirse** (`19` §4 fila 29; FASE 9
   vuelta 2, `R24`);
5. **la acción 24 deja la cuenta sin filas en `accounts` y sin favoritos, y sus pruebas lo afirman**
   (`AUT-015`, y `BD-013`: el trigger que borra los favoritos al escribir `deleted_at` no tenía test;
   FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, G).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:719

<a id="lista-v8a"></a>
**LISTA:V8a — «Lista cuando» (la pieza está lista cuando…)**: **el criterio de `V8` entero**
([LISTA:V8](#lista-v8), las cinco cláusulas), **que no tiene ninguna cláusula de Partner** (corte del MVP,
owner 2026-10-01, Z). *(La fuente marca como inferido que ninguna cláusula del criterio de `V8`
nombra la fila 22 ni el panel de postulaciones.)*
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:720

### Historias de usuario

<a id="us-v8a-1"></a>
**US:V8a:1** — Como anfitrión que todavía no publicó en una vertical, quiero que el botón de
suscribirme me mande a publicar si eso me arranca la prueba gratis, para no pagar algo que podía
probar sin cargo.
Actor: anfitrión
Fuente: [LISTA:V8](#lista-v8), [FILA:V8](#fila-v8)

<a id="us-v8a-2"></a>
**US:V8a:2** — Como anfitrión, quiero que Mi Cuenta me diga qué pasó con mis fichas —borrada por
inactividad, sin poder publicar sin suscripción, editada por soporte— y que en una vertical sin
planes no me ofrezca nada que no se puede contratar.
Actor: anfitrión
Fuente: [FILA:V8a](#fila-v8a), [LISTA:V8](#lista-v8), [ACC:15](../02-nucleo.md#acc-15)

<a id="us-v8a-3"></a>
**US:V8a:3** — Como turista, quiero que mis alertas de precio y mis conversaciones me digan que la
ficha ya no existe cuando llega a `PURGED`, para no quedar esperando una respuesta que no va a
llegar.
Actor: turista
Fuente: [FILA:V8](#fila-v8), [FILA:V8a](#fila-v8a)

<a id="us-v8a-4"></a>
**US:V8a:4** — Como admin de soporte, quiero editar el contenido de la ficha de un cliente, borrarle
una ficha y darle de baja la cuenta cuando él lo pide, cada cosa con su permiso, su motivo y su
registro, para ayudarlo sin pedirle la contraseña.
Actor: admin
Fuente: [ACC:15](../02-nucleo.md#acc-15), [ACC:23](../02-nucleo.md#acc-23), [ACC:24](../02-nucleo.md#acc-24), [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003)

### Criterios de aceptación

<a id="ac-v8a-1"></a>
**AC:V8a:1** — Ninguna superficie decide por sí misma.

- **Dado** una operación que la UI de verticales oculta o deshabilita (por ejemplo publicar sin
  cobertura, o una acción administrativa sin su permiso)
- **Cuando** se la invoca directo contra la API, sin pasar por la UI
- **Entonces** la rechaza la resolución de `V5`, y la UI pregunta lo mismo al mismo lugar: no tiene
  una copia propia del criterio.
Fuente: [LISTA:V8](#lista-v8), [FILA:V8](#fila-v8)

<a id="ac-v8a-2"></a>
**AC:V8a:2** — El botón de suscribirse manda a publicar a quien publicar le arrancaría el trial.

- **Dado** una cuenta con `cubierto` falso en una vertical que declara evento, con días de trial
  mayores que cero, en `PRE_TRIAL`, que todavía no ejerció el evento de activación según el registro
  del sistema nuevo y cuyo hash de correo no tiene fila
- **Cuando** toca el botón de suscribirse de esa vertical
- **Entonces** la manda a publicar y le dice que el trial arranca al publicar; y en cualquier otro
  caso con `cubierto` falso (ya ejerció el evento, ya consumió su trial, la vertical no declara
  evento, los días están en cero o el hash ya tiene fila) la manda al checkout. El predicado lo expone
  verticales y el botón lo pregunta al mismo lugar que `PB1`.
Fuente: [LISTA:V8](#lista-v8), [FILA:V8](#fila-v8)

<a id="ac-v8a-3"></a>
**AC:V8a:3** — La vertical sin planes no ofrece nada.

- **Dado** una vertical sin ninguna versión de plan vigente y vendible
- **Cuando** una cuenta sin cobertura intenta publicar, o mira el botón de suscribirse
- **Entonces** la pantalla dice *«esta vertical no tiene planes disponibles»*, que la ficha sigue
  sin publicar y que no hay nada que contratar ni trial que arrancar, no muestra ningún botón de
  suscribirse y no dice *«suscribite»*.
Fuente: [LISTA:V8](#lista-v8), [FILA:V8](#fila-v8)

<a id="ac-v8a-4"></a>
**AC:V8a:4** — Filas 20 y 21: la ficha borrada y *«suscribite para publicar»*.

- **Dado** un anfitrión con una ficha `PURGED` por inactividad, y otro sin cobertura que no puede
  arrancar un trial (ya lo consumió, la vertical no declara evento o tiene los días en cero, o el
  hash de su correo ya tiene fila) en una vertical que sí tiene planes vendibles
- **Cuando** el primero abre Mi Cuenta y el segundo intenta publicar
- **Entonces** el primero ve que la ficha existió y que su contenido se borró por inactividad; el
  segundo ve *«suscribite para publicar»*: que la ficha sigue sin publicar y que publicar pide una
  suscripción en esa vertical.
Fuente: [FILA:V8a](#fila-v8a), [FILA:V8](#fila-v8)

<a id="ac-v8a-5"></a>
**AC:V8a:5** — Filas 27 y 28: lo que cuelga de una ficha `PURGED`.

- **Dado** un turista con una alerta de precio y una conversación sobre una ficha que llega a
  `PURGED` (por `PB9` o `PB12`)
- **Cuando** mira sus alertas y su bandeja (y el dueño la suya)
- **Entonces** la alerta figura cerrada porque esa ficha ya no existe, sin decir por qué dejó de
  existir, y le llegó el correo; la conversación dice *«esta ficha ya no existe»*, se ve entera en las
  dos bandejas y no admite mensajes nuevos.
Fuente: [FILA:V8](#fila-v8), [FILA:V8a](#fila-v8a)

<a id="ac-v8a-6"></a>
**AC:V8a:6** — Los demás mensajes de verticales que la fila lleva.

- **Dado** cada situación de las filas no Partner del `19` §4 que esta pieza muestra —el botón
  *Empezar* de Turista (1), despublicar en trial (2), el total de días de trial (4), el excedente (8 y
  9), el archivado (18), la restitución (19), la moderación (24 y 30), la confirmación de despublicar
  (25), el borrado de una moderada (31) y la conversación sobre una ficha que dejó de publicarse
  (35)—
- **Cuando** la cuenta llega a esa pantalla o recibe ese correo
- **Entonces** la superficie dice lo que la fila del `19` §4 obliga a decir, con los datos que lee
  de lo que el núcleo resolvió, y no decide nada; el correo que acompaña a una fila lo encola la
  transición que la dispara (de `V6` o de `V9b`), no esta pieza.
Fuente: [FILA:V8a](#fila-v8a), [FILA:V8](#fila-v8)

<a id="ac-v8a-7"></a>
**AC:V8a:7** — La acción 15 edita contenido y nada más.

- **Dado** un admin con el permiso de la acción 15 y la ficha `DRAFT` de una anfitriona en
  `PRE_TRIAL`
- **Cuando** le crea una ficha en borrador a su nombre, le corrige el texto y le restaura fotos
- **Entonces** la ficha queda con el contenido nuevo y en el mismo estado: no se publica, no se
  destaca ni se borra, y como es un acto ajeno no dispara `T1`; el registro de auditoría guarda actor
  (el admin) distinto del sujeto (la dueña), el *«por qué»* y, en los campos de contenido, sólo el
  nombre del campo; la dueña ve el aviso de la fila 26 en Mi Cuenta y recibe el correo *«contenido de
  tu ficha editado por soporte»* (cuándo, qué partes, que no se publicó, destacó ni borró, y a quién
  responder).
Fuente: [ACC:15](../02-nucleo.md#acc-15), [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003), [DEC-RF-008#📌1](../01-decisiones-vigentes.md#dec-rf-008-p1), [LISTA:V8](#lista-v8)

<a id="ac-v8a-8"></a>
**AC:V8a:8** — La acción 15 pide su propio permiso y no sirve para borrar.

- **Dado** un admin con otros permisos administrativos pero sin el de la acción 15
- **Cuando** intenta editar el contenido de una ficha ajena, y cuando un admin con el permiso de la 15
  intenta borrar la ficha por esa vía
- **Entonces** el primero contesta *«sin permiso»*; el segundo no borra: el borrado a pedido del
  dueño es otra fila, la 23, con su permiso.
Fuente: [DEC-AUTH-003#📌3](../01-decisiones-vigentes.md#dec-auth-003-p3), [ACC:15](../02-nucleo.md#acc-15), [LISTA:V8](#lista-v8)

<a id="ac-v8a-9"></a>
**AC:V8a:9** — La acción 23: borrar una ficha ajena a pedido de su dueño.

- **Dado** Juan, anfitrión de una cabaña en Colón, que le pide a soporte que borre sus dos fichas, y un
  admin con el permiso de la acción 23
- **Cuando** el admin confirma la acción con el motivo en *«por qué»*
- **Entonces** la confirmación dijo qué ficha, que su contenido se borra y no vuelve, y que el
  destaque que apuntaba a ella se cancela; corre `PB12` sobre cada ficha, con su lock, su borrado de
  contenido, su empuje a billing y su correo de confirmación, que lleva una línea más que dice que se
  borró a pedido suyo; sus pasos 5 a 7 se evalúan sobre Juan y ningún cupo la rechaza; sin motivo no
  se ejecuta; y queda en el registro con actor, sujeto y motivo.
Fuente: [ACC:23](../02-nucleo.md#acc-23), [DEC-RF-008#📌4](../01-decisiones-vigentes.md#dec-rf-008-p4), [DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5)

<a id="ac-v8a-10"></a>
**AC:V8a:10** — La acción 24 se rechaza mientras quede algo que cobrar, una ficha o una presencia.

- **Dado** una cuenta a la que le queda una suscripción, principal o de complemento, que todavía
  puede cobrar —también una `CANCEL_SCHEDULED` o una terminal cuya cancelación ninguna relectura
  confirmó todavía, una terminal que canceló el proveedor tras un cobro rechazado dentro del plazo 16,
  o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta—, o una ficha fuera de `PURGED`, o una presencia de
  Partner con contenido
- **Cuando** soporte intenta darla de baja con la acción 24
- **Entonces** la acción relee `puedeCobrarle`, las fichas y la presencia y se rechaza sin escribir
  nada; y una vez que `puedeCobrarle` contesta `no` (la `CANCEL_SCHEDULED` con su cancelación ya
  confirmada por Mercado Pago no la traba) y no queda ficha fuera de `PURGED` ni presencia con
  contenido, la baja pasa. No se traba por una fila viva que verticales no puede evaluar.
Fuente: [ACC:24](../02-nucleo.md#acc-24), [DEC-DATA-005#📌6](../01-decisiones-vigentes.md#dec-data-005-p6), [DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5)

<a id="ac-v8a-11"></a>
**AC:V8a:11** — Qué escribe la acción 24.

- **Dado** la cuenta de Juan, ya sin cobro que pueda cobrar ni fichas fuera de `PURGED`, con una fila
  de `trial`, comprobantes emitidos, una postulación de Partner con su correo, favoritos que otras
  personas guardaron sobre la cuenta, y dos correos de confirmación de `PB12` encolados un minuto antes
- **Cuando** soporte confirma la baja con motivo (la confirmación dice de quién es la cuenta y que no
  le queda cobro ni ficha)
- **Entonces**, en una sola transacción: la fila de `user` no se borra, se seudonimiza —nombre, correo
  y teléfono reemplazados—; se escribe `user.deleted_at`; se cierran sus sesiones; se borran sus filas
  de `accounts` (contraseña y vinculaciones con proveedores externos); se reemplaza el correo de toda
  postulación que lleve el de la cuenta; el trigger `trg_softdelete_bookmarks_on_users` borra los
  favoritos que otras personas guardaron sobre esa cuenta; **no** se tocan el registro de auditoría
  (actor y sujeto por id), los cobros, la copia del nombre y el correo en cada comprobante, ni la fila
  de `trial` con su seudónimo; ninguna sesión nace sobre la cuenta (el paso 1 la ve sin actor
  autenticado); y los dos correos ya encolados salen a la dirección real.
Fuente: [ACC:24](../02-nucleo.md#acc-24), [DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5), [DEC-DATA-005#📌7](../01-decisiones-vigentes.md#dec-data-005-p7), [LISTA:V8](#lista-v8)

<a id="ac-v8a-12"></a>
**AC:V8a:12** — La acción 24 sobre una postulación hecha sin cuenta.

- **Dado** una persona que postuló un Partner sin cuenta y pide que se borre su correo
- **Cuando** soporte ejecuta la acción 24 sobre esa postulación, con motivo
- **Entonces** la confirmación dice de qué postulación es el correo que reemplaza; se reemplaza ese
  correo con registro (el sujeto es quien postuló, identificado por el correo de la postulación); y no
  se evalúan las precondiciones de cuenta (`puedeCobrarle`, fichas, presencia) porque no hay cuenta.
Fuente: [ACC:24](../02-nucleo.md#acc-24), [DEC-RF-008#📌4](../01-decisiones-vigentes.md#dec-rf-008-p4)

<a id="ac-v8a-13"></a>
**AC:V8a:13** — La 23 y la 24 son actos de soporte, uno por pedido y nunca sobre sí mismo.

- **Dado** un pedido de baja de un dueño que además es del equipo
- **Cuando** su propia cuenta de staff intenta la 23 o la 24 sobre sí misma
- **Entonces** contesta *«sin permiso»* en el paso 3 y la hace otra cuenta con el permiso; las dos
  piden su permiso propio, motivo y confirmación por destructivas; la 24 es capacidad del actor y la
  23 se evalúa sobre el sujeto.
Fuente: [DEC-RF-008#📌4](../01-decisiones-vigentes.md#dec-rf-008-p4), [ACC:23](../02-nucleo.md#acc-23), [ACC:24](../02-nucleo.md#acc-24)

<a id="ac-v8a-14"></a>
**AC:V8a:14** — Salida: la pieza está lista.

- **Dado** la rama con `V8a` mergeada
- **Cuando** se corren los casos de [AC:V8a:1](#ac-v8a-1) a [AC:V8a:13](#ac-v8a-13)
- **Entonces** se cumplen las cinco cláusulas del criterio de `V8` ([LISTA:V8](#lista-v8)), que es el de
  `V8a` entero, y las pruebas de la acción 24 afirman que la cuenta queda sin filas en `accounts` y
  sin favoritos.
Fuente: [LISTA:V8a](#lista-v8a), [LISTA:V8](#lista-v8), [FILA:V8a](#fila-v8a)

## Reglas

- **La regla del §45**: *«autorización backend jamás depende de ocultar UI»*; la UI y el backend
  preguntan lo mismo, al mismo lugar (`19` §1).
- **Las superficies son una capa de composición** (`19` §2; [DEC-ARCH-006#📌8](../01-decisiones-vigentes.md#dec-arch-006-p8) para
  `puedeCobrarle`): leen de las dos épicas porque no deciden.
- **El admin escribe sobre lo ajeno sólo con una fila de `NUCLEO/08` §3**: la 15 ([ACC:15](../02-nucleo.md#acc-15)), la 23
  ([ACC:23](../02-nucleo.md#acc-23)) y la 24 ([ACC:24](../02-nucleo.md#acc-24)) son las de esta pieza; un acto ajeno nunca es *«el dueño publica»*
  y ningún borrado de ficha sale de otra fila que `PB9`/`PB12` ([DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003)).
- **Actor y sujeto**: [DEC-AUTH-002](../01-decisiones-vigentes.md#dec-auth-002) (nunca `actor = sujeto`); la 15 y la 23 se evalúan sobre el
  sujeto, la 24 es capacidad del actor ([DEC-RF-008#📌4](../01-decisiones-vigentes.md#dec-rf-008-p4)).
- **La baja de cuenta manual**, tres pasos y en este orden: la baja del cobro, `PB12` por cada ficha
  (y en un Partner, la acción 25), y la cuenta ([DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5), `NUCLEO/08` §1.3).
- **Transiciones que esta pieza dispara**: [TRANS:V:PB12](../04-catalogos.md#trans-v-pb12) (por la 23); el registro de auditoría es
  append-only y en los campos de contenido guarda sólo el nombre (`NUCLEO/08` §1.2–§1.3).

## Diseño de origen: las superficies (`V/19` §1, §2, §4 y §6)

*(Contenido vigente del capítulo `19`, sin lo tachado y con las decisiones del owner aplicadas. Es
de la unidad `V8` entera: lo de Partner —las filas 22, 32, 33 y 34 y el panel de postulaciones— lo
construye `V8b` ([FILA:V8b](../20-fase-4/V8b.md#fila-v8b)), que lo referencia acá.)*

### La regla que gobierna todo lo demás (`V/19` §1)

El §45 la escribe en una línea y no admite matices:

> *«Autorización backend jamás depende de ocultar UI.»*

**Ocultar un botón no es un control de acceso: es una comodidad.** Todo lo que la UI esconde tiene
que estar rechazado por la resolución de autorización de `V/17` (la cadena de `V5`,
[FILA:V5](V5.md#fila-v5)), y la UI lo esconde **porque ya sabe** que sería rechazado, nunca para que no lo
intenten.

De ahí sale la única regla de diseño que las tres superficies comparten: **la UI y el backend
preguntan lo mismo, al mismo lugar.** Si la UI tuviera su propia copia del criterio, las dos se
separarían en la primera decisión que alguien cambie en un solo lado.
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:23, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:25, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:27, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:29, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:30, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:31, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:34, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:35, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:36, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:38

### Qué lee cada superficie (`V/19` §2)

| superficie | qué lee | qué NO lee |
|---|---|---|
| **Admin** (§48) | todo lo anterior, de cualquier persona, **como actor distinto del sujeto** (`V/17` §3; [DEC-AUTH-002](../01-decisiones-vigentes.md#dec-auth-002)), **para leer —con el permiso de inspección de cada entidad, y el sujeto leído del recurso (`V/17` §3.2 regla 1 y §1.2 precisión 8; FASE 9 vuelta 2, `F-8V2A1-002`)—; para escribir, sólo lo que nombra una fila de `NUCLEO/08` §3** —entre ellas, editar el contenido de una ficha ajena, sin publicarla, destacarla ni borrarla ([ACC:15](../02-nucleo.md#acc-15); owner 2026-09-26, `G5-2`; FASE 9 vuelta 1, `F-8V1A1-003`), **y, a pedido del dueño y con motivo, borrar una ficha suya por `PB12` o dar de baja su cuenta, que son otras dos filas, la 23 y la 24** ([ACC:23](../02-nucleo.md#acc-23), [ACC:24](../02-nucleo.md#acc-24); revisión del owner, casos vecinos, 2026-09-29, caso F-C; verificación corta, 2026-09-29, VC-VT-11)— | — |
| **la pricing, Mi Suscripción y el botón de suscribirse** (capa de composición; owner 2026-09-26, `G4-2`) | lo que cada épica resolvió, leyendo sus consultas públicas: el catálogo vendible y su presentación, el conjunto efectivo del paso 6, el predicado del botón (§4 fila 23) y el estado de la suscripción. **Estas lecturas son de la capa de composición** (`12-contrato…` §4.1): una superficie puede leer de las dos épicas porque no decide; **si alguna vez decide algo, deja de ser superficie y su lectura entra al §4.1** | nada que decida: ni un guard ni una máquina leen por acá |

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:40, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:42, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:43, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:44, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:45, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:47

### Lo que hay que decir, y no es una mejora de UX (`V/19` §4)

**Cada línea de esta tabla es la mitad de una decisión.** No son advertencias amables: son la
condición bajo la cual se aceptó una regla que, sin el aviso, sería indefendible o directamente
injusta. Si la superficie no lo dice, **la decisión se convierte en lo que se le permitió no ser.**

| # | dónde | qué tiene que decir | de dónde sale |
|---|---|---|---|
| 1 | el botón **Empezar** de la pricing de Turista | que **consume el trial**, que es de por vida | [DEC-TRIAL-006](../01-decisiones-vigentes.md#dec-trial-006), impl. 2 |
| 2 | al **despublicar** una ficha en trial | que **el reloj del trial no se detiene** | `V/11` §1.2 |
| 4 | Mi Suscripción y el panel | el **total acumulado de días de trial** y su origen | `V/11` §3.5 |
| 8 | el aviso de **excedente** | **el criterio**: cae lo más reciente primero; **y los destaques recurrentes sobre las fichas que baja, que se siguen cobrando hasta que los dé de baja** (FASE 9 vuelta 1; owner 2026-09-26, `G2-3`) | [DEC-SUB-008](../01-decisiones-vigentes.md#dec-sub-008), `V/03` §9, [DEC-ADDON-001](../01-decisiones-vigentes.md#dec-addon-001) |
| 9 | cuando el excedente **no tiene ventana** | **qué se hizo**, no una ventana simulada | `V/15` §4.4 |
| 18 | el aviso de **ficha archivada** (`PB4`, día 90, **y `PB5`, el borrador de `N` meses: es el mismo aviso, el *«al archivar»* de la fila de retención de `NUCLEO/07` §6** —FASE 9 vuelta 1, R3 caso `m`, `N-G2V-02`—; lo encola `V6` en el acto, con su plantilla: corte del MVP, owner 2026-10-02, BL) | **que no se borró nada**; **los destaques recurrentes sobre esa ficha, si tiene, que se siguen cobrando aunque esté archivada, hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`, como las filas 24 y 25— (FASE 9 vuelta 1, R3 caso `m`); que la sigue viendo y puede exportarla; que **vuelve sola cuando recupere la cobertura —o cuando el cupo vuelva a alcanzar— si hay lugar para ella** (`PB7`), **con el criterio de cuáles vuelven primero** —sólo la que archivó `PB4`: la de `PB5` era un borrador, `PB7` no la toma y esta frase no va (FASE 9 vuelta 1)—, y que puede traerla a borrador cuando quiera, sin pagar (`PB8`); y **la fecha** a partir de la cual el contenido sí se borra, que es **`listing.borrado_anunciado`, la que el archivado escribió con la versión de plazos de la ficha** (residuo visto al publicar, 2026-09-30) | `V/03` §9, `V/02` §2.5, `V/02` §4.2 regla 3, `V/15` §4.3, [DEC-DATA-001](../01-decisiones-vigentes.md#dec-data-001), [DEC-DATA-003](../01-decisiones-vigentes.md#dec-data-003), `NUCLEO/07` §6 |
| 19 | el aviso de **restitución**, cuando el cupo vuelve a alcanzar y las fichas se republican solas (`PB3`, `PB7`) | **cuáles volvieron**, **cuáles no** y **el criterio**: vuelve primero la que cayó al final, hasta llenar el cupo —y las fichas del sistema viejo que nunca se publicaron en el nuevo, primero y por antigüedad de carga (`V/03` §9, *«cuáles vuelven»*; FASE 9 vuelta 1, `N-G1-01`)—. Y que las que no entraron **siguen ahí y no se borran** | [DEC-DATA-003](../01-decisiones-vigentes.md#dec-data-003), `V/03` §9, `V/15` §4.3, `NUCLEO/07` §6 |
| 20 | Mi Cuenta, sobre una ficha **`PURGED`** (`PB9`, día 180) | **que la ficha existió y que su contenido se borró por inactividad** | [DEC-DATA-005](../01-decisiones-vigentes.md#dec-data-005), `V/03` §9 (`PB9`), `V/02` §4.1; FASE 8 completa, `F-8CA2-008`, owner 2026-09-25 |
| 21 | al **publicar** una ficha **sin estar cubierto y sin poder arrancar un trial** —`PB1` no publica: el dueño no está cubierto y esa publicación no dispara `T1` (ya consumió su trial, la vertical no declara evento o tiene los días en cero, o el hash de su correo ya tiene fila)—. **Y si la causa es que la vertical no tiene ninguna versión de plan vigente y vendible, no aplica: es la fila 29** (owner 2026-09-27, FASE 9 vuelta 2, `R24`) | ***«suscribite para publicar»***: que la ficha **sigue sin publicar** (puede estar en `UNPUBLISHED_BY_BILLING`; FASE 9 vuelta 1, R1) y que publicar pide una suscripción en esa vertical | `V/03` §9 (`PB1`) y §2 (`T1`); FASE 8 completa, owner 2026-09-25 |
| 22 | *(de `V8b`)* Mi Cuenta de Partner, **cuando la página o el carrusel dejan de mostrarlo** | **que no se borró nada**, que la presencia **vuelve sola** si recupera el plan que la otorga, y que mientras tanto responde como inexistente —**y, si la bajó un admin, que está moderada y por qué** (el motivo de la acción)— | `V/18` §1.6; FASE 9 completa, `R13`, `B4` del informe `08`; decisiones 7b y 7c |
| 23 | el **botón de suscribirse** de una vertical —la pricing, un llamado a la acción— **cuando la persona todavía no publicó en esa vertical** —en general, no ejerció su evento de activación (`V/10` §1, ítem 1)—. **Lo que se lee es el registro del sistema nuevo**, el mismo que lee `T8` (`V/03` §2; `T7` salió, N7): haber publicado en el sistema viejo no cuenta, así que **el dueño del corte que tenía una ficha a la vista no llega acá: amanece en prueba, cubierto, y su botón es el de plan actual; toda otra cuenta, cuyas fichas se borraron en el corte, sí llega acá como quien todavía no publicó** (`V/21` §2.4; revisión del owner, 2026-09-28, C12; FASE 5, lote 1 J y simplificación del corte, S-02: sólo las cinco cuentas de la lista cerrada conservan su ficha) | **La regla del botón está escrita sólo acá, y `B/19` §4 fila 21 la cita** (FASE 9 vuelta 1, `F-8V1D1-004`, `F-8V1A1-008`). Con `cubierto` falso en esa vertical —con un título el botón es el de *plan actual y cambio* del §47—: **(1-bis) si la vertical no tiene ninguna versión de plan vigente y vendible**, no ofrece ni suscripción ni publicación: dice *«esta vertical no tiene planes disponibles»* (fila 29; owner 2026-09-27, FASE 9 vuelta 2, `R24`); **(2) si publicar le arrancaría el trial** —está en `PRE_TRIAL`, **todavía no ejerció el evento de activación** (el registro que lee `T8`) y se cumplen las demás condiciones de `T1`: la vertical declara evento, su plan de trial tiene días > 0 y el hash de su correo no tiene fila—, **la manda a publicar** y le dice que el trial arranca al publicar; **(3) en todo otro caso, la manda al checkout**: ya ejerció el evento, ya consumió su trial, la vertical no declara evento, los días están en cero o el hash ya tiene fila. Publicar no le daría un trial, y mandarla a publicar la devuelve al botón por la fila 21. Quien llega al checkout por otro camino tiene la red de `T8`. El predicado del punto 2 lo expone verticales y la pricing lo pregunta al mismo lugar que `PB1` (§1: *la UI y el backend preguntan lo mismo*); es una lectura de la capa de composición (`12-contrato…` §4.1, owner 2026-09-26, `G4-2`). *(El caso 1, *«esta vertical ya no admite altas»*, salió con la revisión del owner, 2026-09-28, C8.)* | `V/03` §2 ([TRANS:V:T1](../04-catalogos.md#trans-v-t1), `T6`, [TRANS:V:T8](../04-catalogos.md#trans-v-t8)); owner 2026-09-25, FASE 9 completa, decisión 6c (el espejo de billing es `B/19` §4) |
| 24 | al **moderar** una ficha (`PB10`) | el motivo; que la ficha no se ve hasta que un admin levante la moderación; **qué puede hacer mientras tanto: verla, exportarla, editarla y borrarla, no publicarla** (revisión del owner, 2026-09-28, `g3`); y **los destaques recurrentes sobre esa ficha, que se siguen cobrando hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— | `V/03` §9 ([TRANS:V:PB10](../04-catalogos.md#trans-v-pb10)), [DEC-ADDON-001](../01-decisiones-vigentes.md#dec-addon-001), `B/16` §4.2; FASE 9 vuelta 1, owner 2026-09-26, `G2-3` |
| 25 | la **confirmación de despublicar** una ficha (`PB6`) | **los destaques recurrentes sobre esa ficha, que se siguen cobrando aunque no esté publicada, hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— | `V/03` §9 ([TRANS:V:PB6](../04-catalogos.md#trans-v-pb6)), [DEC-ADDON-001](../01-decisiones-vigentes.md#dec-addon-001), `B/16` §4.2; FASE 9 vuelta 1, owner 2026-09-26, `G2-3` |
| 26 | Mi Cuenta y el correo al dueño, **cuando soporte edita el contenido de su ficha** (la acción administrativa 15, [ACC:15](../02-nucleo.md#acc-15)) | **que el contenido de su ficha lo editó soporte, cuándo y qué partes**; que la ficha no se publicó, no se destacó ni se borró por eso; y a quién responder si no lo pidió. **Existe porque el dueño no está mirando**: es el único rastro que ve de una escritura ajena sobre lo suyo | `NUCLEO/08` §3 fila 15, `NUCLEO/07` §6; FASE 9 vuelta 2, `F-8V2D1-002` |
| 27 | las alertas de precio del turista y el correo, **cuando la ficha de una alerta suya llega a `PURGED`** (`PB9` o `PB12`) | **que la alerta se cerró porque esa ficha ya no existe**. No dice por qué dejó de existir: eso es del dueño (fila 20) | `V/02` §4.1, la lista de lo que cuelga de `listing`; owner 2026-09-27, FASE 9 vuelta 2, `R9` |
| 28 | la **conversación** entre un turista y un dueño **sobre una ficha que llegó a `PURGED`**, en la bandeja de los dos | ***«esta ficha ya no existe»***, y la conversación en **sólo lectura**: se ve entera y no admite mensajes nuevos | `V/02` §4.1, la lista de lo que cuelga de `listing`; owner 2026-09-27, FASE 9 vuelta 2, `R9` |
| 29 | al **publicar** una ficha sin estar cubierto, y el **botón de suscribirse**, **en una vertical que no tiene ninguna versión de plan vigente y vendible** —se retiraron todos sus planes; las verticales no se discontinúan (revisión del owner, 2026-09-28, C8)— | ***«esta vertical no tiene planes disponibles»***: que la ficha sigue sin publicar, que no hay nada que contratar ni trial que arrancar, **y ningún botón de suscribirse**. No dice *«suscribite»* —la fila 21 lo diría sobre una vertical sin nada que vender— | `V/03` §2 (`T1`) y §9 (`PB1`), `B/10` §3.6; owner 2026-09-27, FASE 9 vuelta 2, `R24`, `F-8V2A3-005` |
| 30 | Mi Cuenta y el correo al dueño, **cuando un admin le pide un arreglo sin bajar la ficha**, **cuando cambia de nivel** y **cuando lo levanta** (revisión del owner, 2026-09-28, C10, `L2-i`) | **el pedido**: el motivo, la fecha sugerida si la hay, que la ficha sigue a la vista y **un botón para avisar que ya lo corrigió**; **el cambio de nivel**: si la bajaron, lo de la fila 24; si la volvieron a sólo pedido, a dónde volvió (publicada si había cobertura y cupo, borrador si era borrador); **al levantar**, a dónde volvió y, si fue a borrador, que publicarla es suyo | `V/03` §9 (*«la moderación en dos niveles»*), `NUCLEO/07` §6 |
| 31 | Mi Cuenta y el correo al dueño, **al borrar una ficha `MODERATED`** (`PB12`; revisión del owner, 2026-09-28, `g3`) | que se borró, qué se borró y que no vuelve | `V/03` §9 ([TRANS:V:PB12](../04-catalogos.md#trans-v-pb12)), `NUCLEO/07` §6 |
| 32 | *(de `V8b`)* al abrir un **link de reclamo de un Partner que ya tiene dueño** (FASE 9 vuelta 3, owner 2026-09-30, lote A) | que ese Partner ya fue reclamado y que, si es suyo, lo resuelve soporte, con cómo contactarlo: *«este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte»* (lote AG). **Sólo con el secreto correcto del link**: con uno equivocado o sin él, la pantalla es la de un Partner que no existe. No lo vincula ni dice a qué cuenta está vinculado | `V/18` §2.4, regla 4 |
| 33 | *(de `V8b`)* al **reclamar un segundo Partner** desde una cuenta que ya es dueña de uno (FASE 9 vuelta 3, owner 2026-09-30, lote B) | que una cuenta es dueña de un solo Partner, que el segundo negocio se reclama con otra cuenta, y que soporte lo ayuda, con cómo contactarlo | `V/18` §2.4, regla 5; `V/02` §2.7 |
| 34 | *(de `V8b`)* al **postular un Partner con sesión y el correo de la cuenta sin verificar** (FASE 9 vuelta 3, owner 2026-09-30, lote AJ) | que para postular primero tiene que verificar su correo, con el botón que le reenvía la verificación; no acepta la postulación mientras tanto | `V/17` §1.2 precisión 9; `V/18` §2.4 |
| 35 | la **conversación** entre un turista y un dueño **sobre una ficha que dejó de publicarse sin llegar a `PURGED`**, en la bandeja del turista (FASE 9 vuelta 3, verificación, VC3-VT-11) | la conversación entera en **sólo lectura** y que por ahora no puede mandar mensajes sobre esa ficha. **No dice por qué** (borrador, archivada, moderada o bajada por billing): contestarlo es lo que la precisión 7 le niega a quien no es el dueño. Si la ficha vuelve a publicarse, puede escribir otra vez | `V/17` §1.2 precisión 7 |

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:49, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:51, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:53, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:54, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:55, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:56, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:58, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:59, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:60, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:61, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:62, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:63, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:65, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:67, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:68, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:69, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:70, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:71, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:72, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:73, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:74, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:75, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:76, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:77, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:78, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:79, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:80, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:81, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:82, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:84

### Admin (`V/19` §6)

| qué | por qué existe |
|---|---|
| *(de `V8b`)* las **postulaciones de Partner atrasadas** y las **aprobadas sin reclamar** | nada vence por tiempo, así que la visibilidad es el único control (`V/18` §2.3, §2.5). **Lee `postulacion`, no la lista de `alliance_leads` que el panel tiene hoy**, que queda para los otros tipos de alianza (`V/18` §2.1; FASE 5, owner 2026-09-30, lote 4 A, `F5-SUP-026`) |
| **el listado de arreglos pendientes** (revisión del owner, 2026-09-28, C10) | los pedidos de arreglo abiertos, con su antigüedad, la fecha sugerida vencida y los que el dueño ya avisó que corrigió; desde ahí el admin cierra el pedido, baja la ficha o la levanta (`NUCLEO/08` §3). Sin él, un pedido que no baja la ficha no tiene quién lo vuelva a mirar (`V/03` §9, *«la moderación en dos niveles»*; [DEC-DATA-007](../01-decisiones-vigentes.md#dec-data-007)) |
| **el editor del catálogo de planes y claves, y el de los plazos de verticales** (revisión del owner, 2026-09-28, N1, C9, `L1-f`) | es la superficie de *«publicar una versión de plan»* ([ACC:18](../02-nucleo.md#acc-18)) y de *«cambiar un plazo»* ([ACC:22](../02-nucleo.md#acc-22)) sobre las claves de verticales (`NUCLEO/08` §3; `NUCLEO/02` §1.4 y §1.5): muestra la versión vigente al lado de la que se va a publicar, clave por clave, y cada rechazo de validación con su mensaje; junto a la cuota de trial, el costo máximo por persona que resulta (cuota × verticales con trial encendido × meses que permite el techo; `V/11` §4.2) *(derivado: la superficie de quien fija la cuota es este editor; lo marco)*; en los plazos, el valor actual, el nuevo y que los relojes ya arrancados conservan el suyo. Sin él, la configuración de planes que vive en la base no la podía cambiar nadie. **Los plazos de las dos mitades van en una sola pantalla, compuesta en la app del panel** (revisión del owner, casos vecinos, 2026-09-29, caso 47; [DEC-DATA-008#📌1](../01-decisiones-vigentes.md#dec-data-008-p1)): cada mitad construye su parte y cada cambio lo ejecuta la acción de la mitad dueña de la clave. **La app del panel lee las dos mitades por la API, sin importar ninguna**, así que `G14` no la marca y no hace falta exceptuarla: la única raíz de composición sigue siendo la de `apps/api` (`V/20` §2) (caso H-F) |
| **moderar o levantar la moderación de la presencia de un Partner**, con motivo | es la bajada deliberada que no mueve plata: sin ella, bajar una página era cancelar la suscripción. Es la misma acción administrativa que modera una ficha (`NUCLEO/08` §3; `V/18` §1.6; owner 2026-09-25, FASE 9 completa, decisión 7c); la construye `V7` ([FILA:V7](../20-fase-4/V7.md#fila-v7)) |

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:86, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:88, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:89, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:90, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:91, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:92, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:93, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:95, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:220, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:221

## Modelo de datos y migraciones

- **Sin tablas ni columnas nuevas** (el esquema nace entero en la rama, [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) punto 7).
- La acción 24 escribe sobre lo existente: `user` (nombre, correo y teléfono reemplazados,
  `deleted_at`), las filas de `accounts` (borradas), las sesiones (cerradas), `postulacion.correo`
  (reemplazado); el trigger del carril de extras `trg_softdelete_bookmarks_on_users`
  (`packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql`) sobrevive al corte y
  borra los favoritos de terceros sobre la cuenta ([ACC:24](../02-nucleo.md#acc-24)).
- **No toca**: la fila de `trial` (FK `ON DELETE RESTRICT`, con el hash del correo), el registro de
  auditoría, los cobros ni la copia del nombre y el correo de cada `receipt` ([DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5)).

## API

- **Rutas admin** (`/api/v1/admin/*`): las de las acciones 15, 23 y 24, cada una con su permiso propio
  (en las rutas de ficha de la 15 y la 23, el permiso de la acción en lugar del `_ANY`, con el dueño
  como sujeto: [FILA:V5](V5.md#fila-v5)), motivo obligatorio en la 23 y la 24, y el contrato de errores de `V5`:
  *«sin permiso»* para el paso 3 (también `actor = sujeto`), *«no existe»* para lo ajeno.
- **Rechazo de la 24 por precondición**: la fuente no fija el código de error del rechazo; lo
  propone el PR de `V8a` siguiendo lo escrito del repo (`apps/api/docs/error-contract.md`), lo aprueba
  la revisión de contexto fresco del momento 1 y queda escrito en esta sección al mergear ([BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).
- **Rutas web** (`/api/v1/public/*` y `/protected/*`): las lecturas de Mi Cuenta y el predicado del
  botón de suscribirse, que expone verticales y la pricing pregunta al mismo lugar que `PB1` (`19` §4
  fila 23).

## UI web y admin, e i18n

- **Web — Mi Cuenta y los mensajes** (`19` §4): las filas 1, 2, 4, 8, 9, 18, 19, 20, 21, 23, 24, 25,
  26, 27, 28, 29, 30, 31 y 35, con el texto que cada una obliga a decir; **no** las 22, 32, 33 y 34,
  de Partner ([FILA:V8b](../20-fase-4/V8b.md#fila-v8b)).
- **Admin** (`19` §6): las pantallas de las acciones 15, 23 y 24 con sus confirmaciones (la 23 dice
  qué ficha, que no vuelve y que el destaque se cancela; la 24, de quién es la cuenta y que no le
  queda cobro ni ficha, o de qué postulación es el correo); **el listado de arreglos pendientes**
  ([DEC-DATA-007](../01-decisiones-vigentes.md#dec-data-007)); y su mitad del **editor del catálogo de planes y claves y de la pantalla única
  de plazos**, compuesta en la app del panel, que lee las dos mitades por la API sin importar
  ninguna ([ACC:18](../02-nucleo.md#acc-18), [ACC:22](../02-nucleo.md#acc-22), [DEC-DATA-008#📌1](../01-decisiones-vigentes.md#dec-data-008-p1)).
- **i18n**: todo texto de las filas va por `@repo/i18n` en los tres idiomas del sitio; los literales
  que la fuente cita entre comillas (*«suscribite para publicar»*, *«esta vertical no tiene planes
  disponibles»*, *«esta ficha ya no existe»*) son el contenido en español.

## Cron y outbox

- **Outbox** (de `U2`): la acción 15 encola el correo *«contenido de tu ficha editado por soporte»*
  (`NUCLEO/07` §6) en la transacción de dominio; la 23 hace que `PB12` encole su correo de
  confirmación con la línea *«a pedido suyo»*. La fila guarda la dirección al encolarse, así que un
  correo encolado antes de la 24 sale a la dirección real ([DEC-DATA-005#📌6](../01-decisiones-vigentes.md#dec-data-005-p6)).
- **Cron**: N/A — la pieza no tiene jobs (su fila no nombra ninguno: [FILA:V8a](#fila-v8a)).

## Variables de entorno

N/A — la fila de la pieza no declara variables de entorno ([FILA:V8a](#fila-v8a)).

## Auditoría y observabilidad

- Cada ejecución de la 15, la 23 y la 24 deja su registro con los campos de `NUCLEO/08` §1.2: actor
  distinto del sujeto, tipo de actor, correlación, *«qué cambió»* (en los campos de contenido, sólo el
  nombre) y el *«por qué»* ([ACC:15](../02-nucleo.md#acc-15), [ACC:23](../02-nucleo.md#acc-23), [ACC:24](../02-nucleo.md#acc-24)).
- La 24 no reescribe el registro: conserva actor y sujeto por id ([DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5)).

## Seguridad

- Sin impersonación: la 15 es la herramienta de soporte que evita pedirle la contraseña al cliente
  ([ACC:15](../02-nucleo.md#acc-15), [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003)).
- La 24 deja la cuenta sin acceso con dato (`user.deleted_at`) y sin credenciales (las filas de
  `accounts` borradas), para que ninguna siga verificando aunque el control del hook se rompa
  ([ACC:24](../02-nucleo.md#acc-24)).
- Datos personales: la 24 seudonimiza y conserva lo que la ley obliga (comprobantes) y la traba
  contra repetir la prueba (la fila de `trial`) ([DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5), [DEC-DATA-005#📌7](../01-decisiones-vigentes.md#dec-data-005-p7)).

## Testing esperado

<a id="test-v8a-1"></a>
**TEST:V8a:1** — Ruta API: cada operación que la UI de verticales oculta, invocada directo, la
rechaza la resolución con el mismo código que la UI anticipa.
Tipo: ruta API
Cubre: [AC:V8a:1](#ac-v8a-1)
Fuente: [LISTA:V8](#lista-v8)

<a id="test-v8a-2"></a>
**TEST:V8a:2** — Unitario del predicado del botón: un caso por rama (manda a publicar; checkout por
evento ejercido, trial consumido, sin evento declarado, días en cero, hash con fila).
Tipo: unitario
Cubre: [AC:V8a:2](#ac-v8a-2)
Fuente: [LISTA:V8](#lista-v8), [FILA:V8](#fila-v8)

<a id="test-v8a-3"></a>
**TEST:V8a:3** — E2E web: cuenta en `PRE_TRIAL` sin publicar toca suscribirse y llega a publicar;
otra que ya consumió el trial llega al checkout.
Tipo: e2e web
Cubre: [AC:V8a:2](#ac-v8a-2)
Fuente: [LISTA:V8](#lista-v8)

<a id="test-v8a-4"></a>
**TEST:V8a:4** — E2E web: vertical con todos sus planes retirados muestra *«esta vertical no tiene
planes disponibles»* y ningún botón de suscribirse, al publicar y en la pricing.
Tipo: e2e web
Cubre: [AC:V8a:3](#ac-v8a-3)
Fuente: [LISTA:V8](#lista-v8)

<a id="test-v8a-5"></a>
**TEST:V8a:5** — E2E web: Mi Cuenta sobre una ficha `PURGED` (fila 20) y *«suscribite para
publicar»* al publicar sin cobertura ni trial posible (fila 21).
Tipo: e2e web
Cubre: [AC:V8a:4](#ac-v8a-4)
Fuente: [FILA:V8a](#fila-v8a)

<a id="test-v8a-6"></a>
**TEST:V8a:6** — Integración: con una ficha que llega a `PURGED`, la alerta del turista queda cerrada
con su correo encolado y la conversación no acepta un mensaje nuevo; e2e de las dos bandejas.
Tipo: integración con DB
Cubre: [AC:V8a:5](#ac-v8a-5)
Fuente: [FILA:V8](#fila-v8)

<a id="test-v8a-7"></a>
**TEST:V8a:7** — E2E web: un caso por fila no Partner del `19` §4 listada en [AC:V8a:6](#ac-v8a-6), afirmando
el texto obligatorio.
Tipo: e2e web
Cubre: [AC:V8a:6](#ac-v8a-6)
Fuente: [FILA:V8a](#fila-v8a)

<a id="test-v8a-8"></a>
**TEST:V8a:8** — Integración: la acción 15 sobre una ficha `DRAFT` de una dueña en `PRE_TRIAL` deja
el estado, no escribe `trial`, registra actor ≠ sujeto con sólo nombres de campos de contenido y
encola el correo; la fila 26 aparece en Mi Cuenta.
Tipo: integración con DB
Cubre: [AC:V8a:7](#ac-v8a-7)
Fuente: [ACC:15](../02-nucleo.md#acc-15), [DEC-AUTH-003](../01-decisiones-vigentes.md#dec-auth-003)

<a id="test-v8a-9"></a>
**TEST:V8a:9** — Ruta API: admin sin el permiso de la 15 → *«sin permiso»*; la ruta de la 15 no
borra.
Tipo: ruta API
Cubre: [AC:V8a:8](#ac-v8a-8)
Fuente: [DEC-AUTH-003#📌3](../01-decisiones-vigentes.md#dec-auth-003-p3)

<a id="test-v8a-10"></a>
**TEST:V8a:10** — Integración: la 23 con motivo corre `PB12` (ficha `PURGED`, empuje después del
commit, correo con la línea *«a pedido suyo»*); sin motivo se rechaza.
Tipo: integración con DB
Cubre: [AC:V8a:9](#ac-v8a-9)
Fuente: [ACC:23](../02-nucleo.md#acc-23), [DEC-DATA-005#📌5](../01-decisiones-vigentes.md#dec-data-005-p5)

<a id="test-v8a-11"></a>
**TEST:V8a:11** — E2E admin: la confirmación de la 23 dice qué ficha, que no vuelve y que el destaque
se cancela; la de la 24, de quién es la cuenta y que no le queda cobro ni ficha.
Tipo: e2e admin
Cubre: [AC:V8a:9](#ac-v8a-9), [AC:V8a:11](#ac-v8a-11)
Fuente: [ACC:23](../02-nucleo.md#acc-23), [ACC:24](../02-nucleo.md#acc-24)

<a id="test-v8a-12"></a>
**TEST:V8a:12** — Integración: la 24 se rechaza con `puedeCobrarle` = `sí` (una por causa:
suscripción viva, `CANCEL_SCHEDULED` sin confirmar, terminal dentro del plazo 16, marca
`CANCELACIÓN_SIN_CONFIRMAR`), con una ficha fuera de `PURGED` y con una presencia con contenido;
pasa con la `CANCEL_SCHEDULED` confirmada. Contra el simulador de `puedeCobrarle` del contrato.
Tipo: integración con DB
Cubre: [AC:V8a:10](#ac-v8a-10)
Fuente: [ACC:24](../02-nucleo.md#acc-24), [DEC-DATA-005#📌6](../01-decisiones-vigentes.md#dec-data-005-p6)

<a id="test-v8a-13"></a>
**TEST:V8a:13** — Integración: después de la 24, `user` seudonimizado con `deleted_at`, cero filas en
`accounts`, sesiones cerradas, correo de la postulación reemplazado, favoritos de terceros borrados
por el trigger, `trial` intacta con su seudónimo, auditoría y comprobantes intactos; un intento de
sesión se rechaza; los correos encolados antes conservan la dirección real.
Tipo: integración con DB
Cubre: [AC:V8a:11](#ac-v8a-11), [AC:V8a:14](#ac-v8a-14)
Fuente: [ACC:24](../02-nucleo.md#acc-24), [DEC-DATA-005#📌7](../01-decisiones-vigentes.md#dec-data-005-p7), [LISTA:V8](#lista-v8)

<a id="test-v8a-14"></a>
**TEST:V8a:14** — Integración: la 24 sobre una postulación sin cuenta reemplaza su correo con registro
y no consulta `puedeCobrarle`.
Tipo: integración con DB
Cubre: [AC:V8a:12](#ac-v8a-12)
Fuente: [ACC:24](../02-nucleo.md#acc-24)

<a id="test-v8a-15"></a>
**TEST:V8a:15** — Ruta API: la 23 y la 24 con `actor = sujeto` → *«sin permiso»*; cada una exige su
permiso propio.
Tipo: ruta API
Cubre: [AC:V8a:13](#ac-v8a-13)
Fuente: [DEC-RF-008#📌4](../01-decisiones-vigentes.md#dec-rf-008-p4)

<a id="test-v8a-16"></a>
**TEST:V8a:16** — Salida: la suite de la pieza (TEST:V8a:1 a TEST:V8a:15) corre verde en el PR, con
los e2e adaptados en el mismo PR.
Tipo: e2e web
Cubre: [AC:V8a:14](#ac-v8a-14)
Fuente: [LISTA:V8a](#lista-v8a)

## Smoke y etiquetas

N/A — `V8a` no lleva etiqueta `status-needs-smoke-*`: van sólo en `HOS-1352` ([GATE:M1](../30-el-corte.md#gate-m1)). Las
superficies que el diseño declara no simulables (checkout real, correos del proveedor) son del
checklist del sistema nuevo que escribe `B13a` ([GATE:SMOKE](../30-el-corte.md#gate-smoke)).

## Dependencias, rollback y despliegue

- **Espera a**: `V6` (`V/descomposicion.md` §3: `V6 ──► V8a`); por lo que lee, a `V5` (la cadena) y a
  `V4` (la de arranque de `puedeCobrarle`, que contesta `no`; la real la integra `B4`).
- **La espera**: `V8b` (`V8a → V8b`).
- **Despliegue**: al corte, en la rama del paraguas ([DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017)); terminada por el momento 1
  ([GATE:M1](../30-el-corte.md#gate-m1)).
- **Rollback**: el del corte (`16-fase-7-del-paraguas.md` §3); nada llega a producción antes.

## Labels de Linear

- La pieza todavía no tiene issue: entra al árbol de Linear desde esta spec (`V/descomposicion.md` §5;
  [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017), implicación 3). Pasa a `Done` al mergearse en la rama ([GATE:M1](../30-el-corte.md#gate-m1)).
- **Sin** etiqueta `status-needs-smoke-*` ([GATE:M1](../30-el-corte.md#gate-m1)).
- Las etiquetas son `kind-spec` más las `area-*` de la fila, y quedan escritas acá al mergear (owner
  [BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs), con sus defaults en
  [DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5); `16-fase-7-del-paraguas.md` §4.7,
  momento 1); el PR de la pieza propone las `area-*` siguiendo lo escrito del repo.

## Abiertos

N/A — el único abierto de la pieza, el código de error con que la API rechaza la acción 24 por
precondición, lo cerró el owner: lo propone el PR de la pieza y lo aprueba la revisión del momento 1
([BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).

**Lo que el capítulo `19` no cierra** (`V/19`, *«Lo que este capítulo NO cierra»*) vive en
[80-abiertos.md](../80-abiertos.md): que la presencia de Partner no tiene ciclo de publicación —la regla vive en `V/18`
§1.6: la lectura pública pregunta por la clave *«página propia»* y, si falta, responde que no
existe; lo mismo el carrusel de la home, que lee *«presencia en el carrusel»* (Gold y Silver), y la
presencia moderada, que no se ve en ninguna de las dos; este capítulo agrega la fila 22—, y que la
home no tiene destacados hasta que exista el complemento de destaque, porque `U1` retira las dos
marcas de destaque de las tres tablas de fichas (FASE 5, owner 2026-09-30, lote 1 F, `F5-BD-032`,
`F5-U1-045`).
Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:97, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:99, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:100, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:101, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:102, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:103, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:104, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:105, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:106, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:107, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:108, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:109, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:110, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:111

## Origen

- `V/descomposicion.md` §2, filas `V8` y `V8a` (l. 68 y 69); §2.10 y §2.11; §3; §4, filas `V8` y
  `V8a` (l. 719 y 720).
- `V/docs/19-superficies.md` §1, §2, §4 y §6.
- `NUCLEO/08` §1.2, §1.3 y §3 (acciones 15, 23 y 24, l. 205, 213 y 214); `NUCLEO/07` §1.1 y §6.
- `16-fase-7-del-paraguas.md` §4.6 (l. 951) y §4.7.
- `01-decision-log.md`: `DEC-AUTH-002`, `DEC-AUTH-003`, `DEC-DATA-005`, `DEC-RF-008`, `DEC-ARCH-017`.

**Preámbulos de las fuentes, contexto sin norma.** Cada fuente de abajo abre con un texto entre su título y su primera sección. No trae una regla propia: lo que presenta está escrito en las secciones que la siguen, y se cita acá para que la red de cobertura (R17) lo vea.

- `V/19`, el texto entre su título y su primera sección (contexto, sin norma): qué es el capítulo: la lista de lo que hay que decirle a la gente.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/19-superficies.md:14
