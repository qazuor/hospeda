---
title: Master Spec 19 — Superficies: API, Web y Admin
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 19
---

# 19 · Superficies: API, Web y Admin

Mitad **VERTICALES** del capítulo 19 del programa. La otra mitad vive en la otra épica.

Las superficies no deciden nada. Leen lo que el núcleo resolvió y lo muestran. Por eso este
capítulo es el más corto de la Parte III en lo conceptual y el más largo en una sola cosa: **la
lista de lo que hay que decirle a la gente**, que los capítulos anteriores fueron dejando y que
nadie tiene junta.

---

## 1. La regla que gobierna todo lo demás

El §45 la escribe en una línea y no admite matices:

> *«Autorización backend jamás depende de ocultar UI.»*

**Ocultar un botón no es un control de acceso: es una comodidad.** Todo lo que la UI esconde
tiene que estar rechazado por la resolución de autorización del capítulo 17 (épica de
verticales), y la UI lo esconde **porque ya sabe** que sería rechazado, nunca para que no lo
intenten.

De ahí sale la única regla de diseño que las tres superficies comparten: **la UI y el backend
preguntan lo mismo, al mismo lugar.** Si la UI tuviera su propia copia del criterio, las dos se
separarían en la primera decisión que alguien cambie en un solo lado.

---

## 2. Qué lee cada superficie

| superficie | qué lee | qué NO lee |
|---|---|---|
| **Admin** (§48) | todo lo anterior, de cualquier persona, **como actor distinto del sujeto** (cap. 17 §3, épica de verticales), **para leer —con el permiso de inspección de cada entidad, y el sujeto leído del recurso (cap. 17 §3.2 regla 1 y §1.2 precisión 8; FASE 9 vuelta 2, `F-8V2A1-002`)—; para escribir, sólo lo que nombra una fila de `NUCLEO/08` §3** —entre ellas, editar el contenido de una ficha ajena, sin publicarla, destacarla ni borrarla (owner 2026-09-26, `G5-2`; FASE 9 vuelta 1, `F-8V1A1-003`), **y, a pedido del dueño y con motivo, borrar una ficha suya por `PB12` o ~~su cuenta~~ **dar de baja su cuenta** (verificación corta, 2026-09-29, VC-VT-11), que son otras dos filas, la 23 y la 24** (revisión del owner, casos vecinos, 2026-09-29, caso F-C)— | — |
| **la pricing, Mi Suscripción y el botón de suscribirse** (capa de composición; owner 2026-09-26, `G4-2`) | lo que cada épica resolvió, leyendo sus consultas públicas: el catálogo vendible y su presentación, el conjunto efectivo del paso 6, el predicado del botón (§4 fila 23) y el estado de la suscripción. **Estas lecturas son de la capa de composición** (`12-contrato…` §4.1): una superficie puede leer de las dos épicas porque no decide; **si alguna vez decide algo, deja de ser superficie y su lectura entra al §4.1** | nada que decida: ni un guard ni una máquina leen por acá |

---

## 4. Lo que hay que decir, y no es una mejora de UX

Ésta es la parte que sólo puede escribirse ahora, con los capítulos ya escritos.

**Cada línea de esta tabla es la mitad de una decisión.** No son advertencias amables: son la
condición bajo la cual se aceptó una regla que, sin el aviso, sería indefendible o directamente
injusta. Si la superficie no lo dice, **la decisión se convierte en lo que se le permitió no
ser.**

| # | dónde | qué tiene que decir | de dónde sale |
|---|---|---|---|
| 1 | el botón **Empezar** de la pricing de Turista | que **consume el trial**, que es de por vida | `DEC-TRIAL-006`, impl. 2 |
| 2 | al **despublicar** una ficha en trial | que **el reloj del trial no se detiene** | cap. 11 §1.2 (épica de verticales) |
| 4 | Mi Suscripción y el panel | el **total acumulado de días de trial** y su origen | cap. 11 §3.5 (épica de verticales) |
| 8 | el aviso de **excedente** | **el criterio**: cae lo más reciente primero; **y los destaques recurrentes sobre las fichas que baja, que se siguen cobrando hasta que los dé de baja** (FASE 9 vuelta 1; owner 2026-09-26, `G2-3`) | `DEC-SUB-008`, cap. 03 §9, `DEC-ADDON-001` |
| 9 | cuando el excedente **no tiene ventana** | **qué se hizo**, no una ventana simulada | cap. 15 §4.4 (épica de verticales) |
| 18 | el aviso de **ficha archivada** (`PB4`, día 90 **—y `PB5`, el borrador de `N` meses: es el mismo aviso, el *«al archivar»* de la fila de retención de `NUCLEO/07` §6— (FASE 9 vuelta 1, R3 caso `m`, `N-G2V-02`)**) | **que no se borró nada**; **los destaques recurrentes sobre esa ficha, si tiene, que se siguen cobrando aunque esté archivada, hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`, como las filas 24 y 25— (FASE 9 vuelta 1, R3 caso `m`: la NO cierra de `G2-3` en `B/16` afirmaba que el archivado de `PB5` lo decía, y ningún aviso lo decía); que la sigue viendo y puede exportarla; que **vuelve sola cuando recupere la cobertura —o cuando el cupo vuelva a alcanzar— si hay lugar para ella** (`PB7`), **con el criterio de cuáles vuelven primero** **—sólo la que archivó `PB4`: la de `PB5` era un borrador, `PB7` no la toma y esta frase no va (FASE 9 vuelta 1)—**, y que puede traerla a borrador cuando quiera, sin pagar (`PB8`); y **la fecha** a partir de la cual el contenido sí se borra, que es **`listing.inactiva_desde` + 180** | cap. 03 §9, cap. 02 §2.5, cap. 02 §4.2 regla 3, cap. 15 §4.3, `DEC-DATA-001`, `DEC-DATA-003`, cap. 07 §6 (núcleo) |
| 19 | el aviso de **restitución**, cuando el cupo vuelve a alcanzar y las fichas se republican solas (`PB3`, `PB7`) | **cuáles volvieron**, **cuáles no** y **el criterio**: vuelve primero la que cayó al final, hasta llenar el cupo **—y las fichas del sistema viejo que nunca se publicaron en el nuevo, primero y por antigüedad de carga (`03` §9, *«cuáles vuelven»*; FASE 9 vuelta 1, `N-G1-01`)—**. Y que las que no entraron **siguen ahí y no se borran** | `DEC-DATA-003`, cap. 03 §9, cap. 15 §4.3, cap. 07 §6 (núcleo) |
| 20 | Mi Cuenta, sobre una ficha **`PURGED`** (`PB9`, día 180) | **que la ficha existió y que su contenido se borró por inactividad** | `DEC-DATA-005`, cap. 03 §9 (`PB9`), cap. 02 §4.1; FASE 8 completa, `F-8CA2-008`, owner 2026-09-25 |
| 21 | al **publicar** una ficha **sin estar cubierto y sin poder arrancar un trial** —`PB1` no publica: el dueño no está cubierto y esa publicación no dispara `T1` ~~(ya consumió su trial, la vertical no admite altas, o el hash de su correo ya tiene fila)~~ (ya consumió su trial, la vertical no declara evento o tiene los días en cero, o el hash de su correo ya tiene fila). ~~**Si la causa es que la vertical no admite altas, esta fila no aplica**: la pantalla dice lo de `B/19` fila 20 —*«esta vertical ya no admite altas»*—, porque ahí tampoco hay suscripción que ofrecer (FASE 9 vuelta 1, `F-8V1A1-008`)~~ (revisión del owner, 2026-09-28, C8: `admite_altas` salió)—. **Y si la causa es que la vertical no tiene ninguna versión de plan vigente y vendible, tampoco aplica: es la fila 29** (owner 2026-09-27, FASE 9 vuelta 2, `R24`) | ***«suscribite para publicar»***: que la ficha ~~**sigue en borrador**~~ **sigue sin publicar** (desde R1 puede estar en `UNPUBLISHED_BY_BILLING`; FASE 9 vuelta 1) y que publicar pide una suscripción en esa vertical | cap. 03 §9 (`PB1`) y §2 (`T1`); FASE 8 completa, owner 2026-09-25 |
| 22 | Mi Cuenta de Partner, **cuando la página o el carrusel dejan de mostrarlo** | **que no se borró nada**, que la presencia **vuelve sola** si recupera el plan que la otorga, y que mientras tanto responde como inexistente — **y, si la bajó un admin, que está moderada y por qué** (el motivo de la acción) | cap. 18 §1.6 (épica de verticales); FASE 9 completa, `R13`, `B4` del informe `08`; decisiones 7b y 7c |
| 23 | el **botón de suscribirse** de una vertical —la pricing, un llamado a la acción— **cuando la persona todavía no publicó en esa vertical** —en general, no ejerció su evento de activación (cap. 10 §1, ítem 1)—. **Lo que se lee es el registro del sistema nuevo**, el mismo que ~~leen `T7` y~~ lee `T8` (cap. 03 §2; `T7` salió, N7): haber publicado en el sistema viejo no cuenta, así que ~~todo dueño del corte llega acá como quien todavía no publicó y el botón lo manda a publicar su ficha (`V/21` §2.4; FASE 9 vuelta 1, R1)~~ **el dueño del corte que tenía una ficha a la vista no llega acá: amanece en prueba, cubierto, y su botón es el de plan actual; el que sólo tenía fichas en borrador sí llega acá como quien todavía no publicó** (`V/21` §2.4; revisión del owner, 2026-09-28, C12) | ~~**no la manda al checkout: la manda a publicar** —a ejercer ese evento—, que arranca su trial (`T1`), y le dice que el trial arranca al publicar. El checkout queda para quien ya publicó o ya consumió su trial —el que no puede arrancar uno, porque publicar no se lo daría (fila 21)—. Quien llega al checkout por otro camino tiene la red de `T8`: su trial se consume al primer pago, no al publicar~~ **La regla del botón está escrita sólo acá, y `B/19` §4 fila 21 la cita** (FASE 9 vuelta 1, `F-8V1D1-004`, `F-8V1A1-008`). Con `cubierto` falso en esa vertical —con un título el botón es el de *plan actual y cambio* del §47—: ~~**(1) si la vertical no admite altas**, no ofrece ni suscripción ni publicación: dice *«esta vertical ya no admite altas»*, con la fecha de fin de servicio si la tiene (`B/19` fila 20);~~ (el caso 1 salió con la revisión del owner, 2026-09-28, C8) **(1-bis) si la vertical no tiene ninguna versión de plan vigente y vendible**, tampoco: dice *«esta vertical no tiene planes disponibles»* (fila 29; owner 2026-09-27, FASE 9 vuelta 2, `R24`); **(2) si publicar le arrancaría el trial** —está en `PRE_TRIAL`, **todavía no ejerció el evento de activación** (el registro que ~~leen `T7` y~~ lee `T8`; `T7` salió: revisión del owner, 2026-09-28, N7) y se cumplen las demás condiciones de `T1`: la vertical declara evento, su plan de trial tiene días > 0 y el hash de su correo no tiene fila—, **la manda a publicar** y le dice que el trial arranca al publicar; **(3) en todo otro caso, la manda al checkout**: ya ejerció el evento, ya consumió su trial, la vertical no declara evento, los días están en cero o el hash ya tiene fila. Publicar no le daría un trial, y mandarla a publicar la devuelve al botón por la fila 21. Quien llega al checkout por otro camino tiene la red de `T8`. El predicado del punto 2 lo expone verticales y la pricing lo pregunta al mismo lugar que `PB1` (§1: *la UI y el backend preguntan lo mismo*); es una lectura de la capa de composición (`12-contrato…` §4.1, owner 2026-09-26, `G4-2`) | cap. 03 §2 (`T1`, `T6`, `T8`); owner 2026-09-25, FASE 9 completa, decisión 6c (el espejo de billing es `B/19` §4) |
| 24 | al **moderar** una ficha (`PB10`) | el motivo; que la ficha no se ve hasta que un admin levante la moderación; **qué puede hacer mientras tanto: verla, exportarla, editarla y borrarla, no publicarla** (revisión del owner, 2026-09-28, `g3`); y **los destaques recurrentes sobre esa ficha, que se siguen cobrando hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— | cap. 03 §9 (`PB10`), `DEC-ADDON-001`, `B/16` §4.2; FASE 9 vuelta 1, owner 2026-09-26, `G2-3` |
| 25 | la **confirmación de despublicar** una ficha (`PB6`) | **los destaques recurrentes sobre esa ficha, que se siguen cobrando aunque no esté publicada, hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— | cap. 03 §9 (`PB6`), `DEC-ADDON-001`, `B/16` §4.2; FASE 9 vuelta 1, owner 2026-09-26, `G2-3` |
| 26 ✚ | Mi Cuenta y el correo al dueño, **cuando soporte edita el contenido de su ficha** (la acción administrativa 15, `NUCLEO/08` §3) | **que el contenido de su ficha lo editó soporte, cuándo y qué partes**; que la ficha no se publicó, no se destacó ni se borró por eso; y a quién responder si no lo pidió. **Existe porque el dueño no está mirando**: es el único rastro que ve de una escritura ajena sobre lo suyo | `NUCLEO/08` §3 fila 15, `NUCLEO/07` §6; FASE 9 vuelta 2, `F-8V2D1-002` (el núcleo apuntaba a la fila 1, que es el botón Empezar de Turista) |
| 27 ✚ | las alertas de precio del turista y el correo, **cuando la ficha de una alerta suya llega a `PURGED`** (`PB9` o `PB12`) | **que la alerta se cerró porque esa ficha ya no existe**. No dice por qué dejó de existir: eso es del dueño (fila 20) | cap. 02 §4.1, la lista de lo que cuelga de `listing`; owner 2026-09-27, FASE 9 vuelta 2, `R9` |
| 28 ✚ | la **conversación** entre un turista y un dueño **sobre una ficha que llegó a `PURGED`**, en la bandeja de los dos | ***«esta ficha ya no existe»***, y la conversación en **sólo lectura**: se ve entera y no admite mensajes nuevos | cap. 02 §4.1, la lista de lo que cuelga de `listing`; owner 2026-09-27, FASE 9 vuelta 2, `R9` |
| 29 ✚ | al **publicar** una ficha sin estar cubierto, y el **botón de suscribirse**, **en una vertical que no tiene ninguna versión de plan vigente y vendible** —se retiraron todos sus planes ~~sin discontinuarla~~ (las verticales no se discontinúan: revisión del owner, 2026-09-28, C8)— | ***«esta vertical no tiene planes disponibles»***: que la ficha sigue sin publicar, que no hay nada que contratar ni trial que arrancar, **y ningún botón de suscribirse**. No dice *«suscribite»* —la fila 21 lo diría sobre una vertical sin nada que vender— ~~ni *«ya no admite altas»* —la vertical no se discontinuó—~~ | cap. 03 §2 (`T1`) y §9 (`PB1`), ~~`B/10` §4.1~~ `B/10` §3.6; owner 2026-09-27, FASE 9 vuelta 2, `R24`, `F-8V2A3-005` |
| 30 ✚ | Mi Cuenta y el correo al dueño, **cuando un admin le pide un arreglo sin bajar la ficha**, **cuando cambia de nivel** y **cuando lo levanta** (revisión del owner, 2026-09-28, C10, `L2-i`) | **el pedido**: el motivo, la fecha sugerida si la hay, que la ficha sigue a la vista y **un botón para avisar que ya lo corrigió**; **el cambio de nivel**: si la bajaron, lo de la fila 24; si la volvieron a sólo pedido, a dónde volvió (publicada si había cobertura y cupo, borrador si era borrador); **al levantar**, a dónde volvió y, si fue a borrador, que publicarla es suyo | cap. 03 §9 (*«la moderación en dos niveles»*), `NUCLEO/07` §6 |
| 31 ✚ | Mi Cuenta y el correo al dueño, **al borrar una ficha `MODERATED`** (`PB12`; revisión del owner, 2026-09-28, `g3`) | que se borró, qué se borró y que no vuelve | cap. 03 §9 (`PB12`), `NUCLEO/07` §6 |

---

## 6. Admin

| qué | por qué existe |
|---|---|
| las **postulaciones de Partner atrasadas** y las **aprobadas sin reclamar** | nada vence por tiempo, así que la visibilidad es el único control (cap. 18 §2.3, §2.5, épica de verticales) |
| **el listado de arreglos pendientes** ✚ (revisión del owner, 2026-09-28, C10) | los pedidos de arreglo abiertos, con su antigüedad, la fecha sugerida vencida y los que el dueño ya avisó que corrigió; desde ahí el admin cierra el pedido, baja la ficha o la levanta (`NUCLEO/08` §3). Sin él, un pedido que no baja la ficha no tiene quién lo vuelva a mirar (cap. 03 §9, *«la moderación en dos niveles»*) |
| **el editor del catálogo de planes y claves, y el de los plazos de verticales** ✚ (revisión del owner, 2026-09-28, N1, C9, `L1-f`) | es la superficie de *«publicar una versión de plan»* y de *«cambiar un plazo»* sobre las claves de verticales (`NUCLEO/08` §3; `NUCLEO/02` §1.4 y §1.5): muestra la versión vigente al lado de la que se va a publicar, clave por clave, y cada rechazo de validación con su mensaje; en los plazos, el valor actual, el nuevo y que los relojes ya arrancados conservan el suyo. Sin él, la configuración de planes que vive en la base no la podía cambiar nadie. **Los plazos de las dos mitades van en una sola pantalla, compuesta en la app del panel** (revisión del owner, casos vecinos, 2026-09-29, caso 47): cada mitad construye su parte y cada cambio lo ejecuta la acción de la mitad dueña de la clave. **La app del panel lee las dos mitades por la API, sin importar ninguna**, así que `G14` no la marca y no hace falta exceptuarla: la única raíz de composición sigue siendo la de `apps/api` (`V/20` §2) (revisión del owner, casos vecinos, 2026-09-29, caso H-F). |
| **moderar o levantar la moderación de la presencia de un Partner**, con motivo | es la bajada deliberada que no mueve plata: sin ella, bajar una página era cancelar la suscripción. Es la misma acción administrativa que modera una ficha (`NUCLEO/08` §3; cap. 18 §1.6; owner 2026-09-25, FASE 9 completa, decisión 7c) |

---

## Lo que este capítulo NO cierra

- ~~**El ciclo de publicación de la presencia de Partner** (cap. 18, épica de verticales): que
  existe y que la da el plan Gold está decidido; cómo se publica es diseño de producto, no de
  billing.~~ **La presencia de Partner no tiene ciclo de publicación, y la regla vive en el cap. 18
  §1.6** (épica de verticales): la lectura pública pregunta por el entitlement ~~de presencia~~ **«página propia»** (FASE 9 vuelta 1, `F-8V1A1-004`) y, si
  falta, responde que no existe. Este capítulo y aquél se remitían el uno al otro; ahora éste
  remite y aquél decide (FASE 8 completa, `R13`, owner 2026-09-25). **Lo mismo el carrusel de la
  home**, que lee la clave *«presencia en el carrusel»* (Gold y Silver), **y la presencia moderada**,
  que no se ve en ninguna de las dos superficies (cap. 18 §1.6; FASE 9 completa, 7b y 7c). Lo que
  este capítulo agrega es la fila 22.
