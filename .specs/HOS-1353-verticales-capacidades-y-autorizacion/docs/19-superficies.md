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
| **Admin** (§48) | todo lo anterior, de cualquier persona, **como actor distinto del sujeto** (cap. 17 §3, épica de verticales), **para leer; para escribir, sólo lo que nombra una fila de `NUCLEO/08` §3** —entre ellas, editar el contenido de una ficha ajena, sin publicarla, destacarla ni borrarla (owner 2026-09-26, `G5-2`; FASE 9 vuelta 1, `F-8V1A1-003`)— | — |
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
| 18 | el aviso de **ficha archivada** (`PB4`, día 90) | **que no se borró nada**; que la sigue viendo y puede exportarla; que **vuelve sola cuando recupere la cobertura —o cuando el cupo vuelva a alcanzar— si hay lugar para ella** (`PB7`), **con el criterio de cuáles vuelven primero**, y que puede traerla a borrador cuando quiera, sin pagar (`PB8`); y **la fecha** a partir de la cual el contenido sí se borra, que es **`listing.inactiva_desde` + 180** | cap. 03 §9, cap. 02 §2.5, cap. 02 §4.2 regla 3, cap. 15 §4.3, `DEC-DATA-001`, `DEC-DATA-003`, cap. 07 §6 (núcleo) |
| 19 | el aviso de **restitución**, cuando el cupo vuelve a alcanzar y las fichas se republican solas (`PB3`, `PB7`) | **cuáles volvieron**, **cuáles no** y **el criterio**: vuelve primero la que cayó al final, hasta llenar el cupo. Y que las que no entraron **siguen ahí y no se borran** | `DEC-DATA-003`, cap. 03 §9, cap. 15 §4.3, cap. 07 §6 (núcleo) |
| 20 | Mi Cuenta, sobre una ficha **`PURGED`** (`PB9`, día 180) | **que la ficha existió y que su contenido se borró por inactividad** | `DEC-DATA-005`, cap. 03 §9 (`PB9`), cap. 02 §4.1; FASE 8 completa, `F-8CA2-008`, owner 2026-09-25 |
| 21 | al **publicar** una ficha **sin estar cubierto y sin poder arrancar un trial** —`PB1` no publica: el dueño no está cubierto y esa publicación no dispara `T1` ~~(ya consumió su trial, la vertical no admite altas, o el hash de su correo ya tiene fila)~~ (ya consumió su trial, la vertical no declara evento o tiene los días en cero, o el hash de su correo ya tiene fila). **Si la causa es que la vertical no admite altas, esta fila no aplica**: la pantalla dice lo de `B/19` fila 20 —*«esta vertical ya no admite altas»*—, porque ahí tampoco hay suscripción que ofrecer (FASE 9 vuelta 1, `F-8V1A1-008`)— | ***«suscribite para publicar»***: que la ficha ~~**sigue en borrador**~~ **sigue sin publicar** (desde R1 puede estar en `UNPUBLISHED_BY_BILLING`; FASE 9 vuelta 1) y que publicar pide una suscripción en esa vertical | cap. 03 §9 (`PB1`) y §2 (`T1`); FASE 8 completa, owner 2026-09-25 |
| 22 | Mi Cuenta de Partner, **cuando la página o el carrusel dejan de mostrarlo** | **que no se borró nada**, que la presencia **vuelve sola** si recupera el plan que la otorga, y que mientras tanto responde como inexistente — **y, si la bajó un admin, que está moderada y por qué** (el motivo de la acción) | cap. 18 §1.6 (épica de verticales); FASE 9 completa, `R13`, `B4` del informe `08`; decisiones 7b y 7c |
| 23 | el **botón de suscribirse** de una vertical —la pricing, un llamado a la acción— **cuando la persona todavía no publicó en esa vertical** —en general, no ejerció su evento de activación (cap. 10 §1, ítem 1)—. **Lo que se lee es el registro del sistema nuevo**, el mismo que leen `T7` y `T8` (cap. 03 §2): haber publicado en el sistema viejo no cuenta, así que todo dueño del corte llega acá como quien todavía no publicó y el botón lo manda a publicar su ficha (`V/21` §2.4; FASE 9 vuelta 1, R1) | ~~**no la manda al checkout: la manda a publicar** —a ejercer ese evento—, que arranca su trial (`T1`), y le dice que el trial arranca al publicar. El checkout queda para quien ya publicó o ya consumió su trial —el que no puede arrancar uno, porque publicar no se lo daría (fila 21)—. Quien llega al checkout por otro camino tiene la red de `T8`: su trial se consume al primer pago, no al publicar~~ **La regla del botón está escrita sólo acá, y `B/19` §4 fila 21 la cita** (FASE 9 vuelta 1, `F-8V1D1-004`, `F-8V1A1-008`). Con `cubierto` falso en esa vertical —con un título el botón es el de *plan actual y cambio* del §47—: **(1) si la vertical no admite altas**, no ofrece ni suscripción ni publicación: dice *«esta vertical ya no admite altas»*, con la fecha de fin de servicio si la tiene (`B/19` fila 20); **(2) si publicar le arrancaría el trial** —está en `PRE_TRIAL`, **todavía no ejerció el evento de activación** (el registro que leen `T7` y `T8`) y se cumplen las demás condiciones de `T1`: la vertical declara evento, su plan de trial tiene días > 0 y el hash de su correo no tiene fila—, **la manda a publicar** y le dice que el trial arranca al publicar; **(3) en todo otro caso, la manda al checkout**: ya ejerció el evento, ya consumió su trial, la vertical no declara evento, los días están en cero o el hash ya tiene fila. Publicar no le daría un trial, y mandarla a publicar la devuelve al botón por la fila 21. Quien llega al checkout por otro camino tiene la red de `T8`. El predicado del punto 2 lo expone verticales y la pricing lo pregunta al mismo lugar que `PB1` (§1: *la UI y el backend preguntan lo mismo*); es una lectura de la capa de composición (`12-contrato…` §4.1, owner 2026-09-26, `G4-2`) | cap. 03 §2 (`T1`, `T6`, `T8`); owner 2026-09-25, FASE 9 completa, decisión 6c (el espejo de billing es `B/19` §4) |
| 24 | al **moderar** una ficha (`PB10`) | el motivo; que la ficha no se ve hasta que un admin levante la moderación; y **los destaques recurrentes sobre esa ficha, que se siguen cobrando hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— | cap. 03 §9 (`PB10`), `DEC-ADDON-001`, `B/16` §4.2; FASE 9 vuelta 1, owner 2026-09-26, `G2-3` |
| 25 | la **confirmación de despublicar** una ficha (`PB6`) | **los destaques recurrentes sobre esa ficha, que se siguen cobrando aunque no esté publicada, hasta que los dé de baja** —los lee de `fuentes`: `alcance: LISTING` y `objetivo`— | cap. 03 §9 (`PB6`), `DEC-ADDON-001`, `B/16` §4.2; FASE 9 vuelta 1, owner 2026-09-26, `G2-3` |

---

## 6. Admin

| qué | por qué existe |
|---|---|
| las **postulaciones de Partner atrasadas** y las **aprobadas sin reclamar** | nada vence por tiempo, así que la visibilidad es el único control (cap. 18 §2.3, §2.5, épica de verticales) |
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
