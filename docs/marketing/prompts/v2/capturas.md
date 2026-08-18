# V2 · Qué grabar y qué fijos hacen falta

V2 es la publicación de presentación de la marca: dos tiradas de Hailuo (T1 y T7) y cinco
bloques de grabación de pantalla a pantalla completa (T2 a T6), un recorrido por las
cinco secciones de la plataforma. El estándar de grabación está en
[`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| P2 | Listado de alojamientos | scroll | T2 — pantalla completa |
| P7 | Página de destino | scroll | T3 — pantalla completa |
| P8 | Gastronomía: listado y ficha | scroll | T4 — pantalla completa |
| P9 | Experiencias: listado y ficha | scroll | T5 — pantalla completa |
| P10 | Agenda de eventos | scroll | T6 — pantalla completa |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `capturas/p2.png` | primer frame de P2 (listado de alojamientos) | el listado, dibujado por Hailuo en el rectángulo flotante |

El rectángulo se mantiene plano y quieto toda la toma, pero **no puede quedar en gris**:
el corte a T2 nunca lo reemplaza (es un corte seco entre dos tomas distintas, no una
composición sobre el mismo cuadro), así que la pantalla plantada durante todo T1 tiene
que leerse como Hospeda desde el frame 1. Como nada se compone encima, alcanza con que
se lea el listado, no que sea legible letra por letra.

**T7** no lleva fijo: el rectángulo muestra una tarjeta de cierre simple (el logo de
Hospeda sobre fondo claro) que Hailuo dibuja directamente en la tirada. No es una
grabación de `grabaciones.md`, así que no usa el marcador `@######PANTALLA#######`.

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| T1 | el listado de alojamientos, en el rectángulo flotante | la dibuja Hailuo desde `@######PANTALLA#######` (fijo de P2) | No, y no hace falta |
| T2 | listado de alojamientos | grabación, pantalla completa (P2) | Sí |
| T3 | página de destino | grabación, pantalla completa (P7) | Sí |
| T4 | gastronomía: listado y ficha | grabación, pantalla completa (P8) | Sí |
| T5 | experiencias: listado y ficha | grabación, pantalla completa (P9) | Sí |
| T6 | agenda de eventos | grabación, pantalla completa (P10) | Sí |
| T7 | tarjeta de cierre: logo + hospeda.com.ar | la dibuja Hailuo directamente, no es una grabación | Sí — es chica y simple |

Los cinco cortes de grabación cuentan un recorrido por secciones distintas —
alojamientos, destino, gastronomía, experiencias, eventos— y por eso no chocan contra la
regla de no repetir tamaño de plano entre tomas seguidas: el sujeto cambia en cada corte.
Detalle completo en [`montaje.md`](montaje.md#por-qué-el-recorrido-es-grabación-a-pantalla-completa-no-dentro-del-inserto).
