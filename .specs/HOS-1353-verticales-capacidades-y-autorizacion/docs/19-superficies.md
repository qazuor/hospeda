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
| **Admin** (§48) | todo lo anterior, de cualquier persona, **como actor distinto del sujeto** (cap. 17 §3, épica de verticales) | — |

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
| 8 | el aviso de **excedente** | **el criterio**: cae lo más reciente primero | `DEC-SUB-008`, cap. 03 §9 |
| 9 | cuando el excedente **no tiene ventana** | **qué se hizo**, no una ventana simulada | cap. 15 §4.4 (épica de verticales) |
| 18 | el aviso de **ficha archivada** (`PB4`, día 90) | **que no se borró nada**; que la sigue viendo y puede exportarla; que **vuelve sola cuando recupere la cobertura —o cuando el cupo vuelva a alcanzar— si hay lugar para ella** (`PB7`), **con el criterio de cuáles vuelven primero**, y que puede traerla a borrador cuando quiera, sin pagar (`PB8`); y **la fecha** a partir de la cual el contenido sí se borra, que es **`listing.inactiva_desde` + 180** | cap. 03 §9, cap. 02 §2.5, cap. 02 §4.2 regla 3, cap. 15 §4.3, `DEC-DATA-001`, `DEC-DATA-003`, cap. 07 §6 (núcleo) |
| 19 | el aviso de **restitución**, cuando el cupo vuelve a alcanzar y las fichas se republican solas (`PB3`, `PB7`) | **cuáles volvieron**, **cuáles no** y **el criterio**: vuelve primero la que cayó al final, hasta llenar el cupo. Y que las que no entraron **siguen ahí y no se borran** | `DEC-DATA-003`, cap. 03 §9, cap. 15 §4.3, cap. 07 §6 (núcleo) |
| 20 | Mi Cuenta, sobre una ficha **`PURGED`** (`PB9`, día 180) | **que la ficha existió y que su contenido se borró por inactividad** | `DEC-DATA-005`, cap. 03 §9 (`PB9`), cap. 02 §4.1; FASE 8 completa, `F-8CA2-008`, owner 2026-09-25 |
| 21 | al **publicar** una ficha **sin estar cubierto y sin poder arrancar un trial** —`PB1` no publica: el dueño no está cubierto y esa publicación no dispara `T1` (ya consumió su trial, la vertical no admite altas, o el hash de su correo ya tiene fila)— | ***«suscribite para publicar»***: que la ficha **sigue en borrador** y que publicar pide una suscripción en esa vertical | cap. 03 §9 (`PB1`) y §2 (`T1`); FASE 8 completa, owner 2026-09-25 |
| 22 | Mi Cuenta de Partner, **cuando la página o el carrusel dejan de mostrarlo** | **que no se borró nada**, que la presencia **vuelve sola** si recupera el plan que la otorga, y que mientras tanto responde como inexistente — **y, si la bajó un admin, que está moderada y por qué** (el motivo de la acción) | cap. 18 §1.6 (épica de verticales); FASE 9 completa, `R13`, `B4` del informe `08`; decisiones 7b y 7c |
| 23 | el **botón de suscribirse** de una vertical —la pricing, un llamado a la acción— **cuando la persona todavía no publicó en esa vertical** —en general, no ejerció su evento de activación (cap. 10 §1, ítem 1)— | **no la manda al checkout: la manda a publicar** —a ejercer ese evento—, que arranca su trial (`T1`), y le dice que el trial arranca al publicar. El checkout queda para quien ya publicó o ya consumió su trial —el que no puede arrancar uno, porque publicar no se lo daría (fila 21)—. Quien llega al checkout por otro camino tiene la red de `T8`: su trial se consume al primer pago, no al publicar | cap. 03 §2 (`T1`, `T6`, `T8`); owner 2026-09-25, FASE 9 completa, decisión 6c (el espejo de billing es `B/19` §4) |

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
  §1.6** (épica de verticales): la lectura pública pregunta por el entitlement de presencia y, si
  falta, responde que no existe. Este capítulo y aquél se remitían el uno al otro; ahora éste
  remite y aquél decide (FASE 8 completa, `R13`, owner 2026-09-25). **Lo mismo el carrusel de la
  home**, que lee la clave *«presencia en el carrusel»* (Gold y Silver), **y la presencia moderada**,
  que no se ve en ninguna de las dos superficies (cap. 18 §1.6; FASE 9 completa, 7b y 7c). Lo que
  este capítulo agrega es la fila 22.
