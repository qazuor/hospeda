# V13 · Qué grabar y qué fijos hacen falta

V13 depende de una sola grabación, tageada a propósito para que nunca se lea un
importe: la comparación de planes se muestra por función, no por precio. El catálogo
completo de grabaciones y el estándar del fijo están en
[`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| A8 | Planes, sin que se lean los importes | quieta | T2, compuesta dentro del rectángulo de T1 congelado |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `a8.png` | primer frame de A8 | la comparación de planes, arrancando en el rectángulo flotante |
| T3 | — | sin rectángulo en cuadro | medio, más cerca, sólo el personaje |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | comparación de planes, arranque | **la dibuja Hailuo** desde `@######PANTALLA#######` | No todavía: el rectángulo recién arranca, y su último frame es el que se congela para T2 |
| **T2** | comparación de planes, función por función | grabación A8, **compuesta dentro del rectángulo** (último frame de T1, congelado) | Sí, es el objetivo del video: 15 s dedicados a que se lea |
| **T3** | — | no hay rectángulo en el plano | — |

**T1 es la única toma de Hailuo con el rectángulo, y su último frame importa el doble**:
además de mostrar el arranque de la comparación, ese frame se usa congelado como fondo
de los 15 s de T2, así que el fijo `a8.png` tiene que calzar con lo primero que muestra
la grabación real compuesta encima. **T3 no lleva teléfono ni rectángulo** —es la vuelta
al personaje solo, sin nada que mostrar en pantalla— así que no necesita ningún fijo.

⚠️ **Ningún cuadro compuesto dentro del rectángulo puede mostrar un número de precio.**
Es el chequeo más importante de este video, tanto para `a8.png` como para cada recorte
de A8 que se use en T2: revisar antes de componer, no confiar en que "ya se grabó sin
precios".
