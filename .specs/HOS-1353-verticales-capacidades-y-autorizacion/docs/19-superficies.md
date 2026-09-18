---
title: Master Spec 19 — Superficies: API, Web y Admin
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-18
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

---

## 6. Admin

| qué | por qué existe |
|---|---|
| las **postulaciones de Partner atrasadas** y las **aprobadas sin reclamar** | nada vence por tiempo, así que la visibilidad es el único control (cap. 18 §2.3, §2.5, épica de verticales) |

---

## Lo que este capítulo NO cierra

- **El ciclo de publicación de la presencia de Partner** (cap. 18, épica de verticales): que
  existe y que la da el plan Gold está decidido; cómo se publica es diseño de producto, no de
  billing.
