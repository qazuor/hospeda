# V32 · Qué grabar y qué fijos hacen falta

V32 es un video de patrón B (presentador al costado): la grabación real ocupa más de
la mitad del video a pantalla completa, porque la tabla comparativa es el argumento y
no entra legible dentro del recuadro flotante de 311 px. Catálogo completo de
grabaciones y estándar del fijo en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|---|---|---|---|
| **P13** | Comparador: agregar 3 y la tabla | acción | **T2** — pantalla completa, 12 de los 20 segundos del video |

> Una sola toma, sin cortes ([`montaje.md`](montaje.md)), con una cuenta de turista
> real. Se agregan tres alojamientos al comparador y la tabla completa tiene que verse
> entera y legible en algún momento del recorrido.

## Fijos para las tiradas

El fijo es siempre el **primer frame de la grabación**, exportado a 1080 × 2340
(ratio 0,4615) — nunca un screenshot. Ver el porqué en
[`../grabaciones.md`](../grabaciones.md#el-fijo-es-un-frame-de-la-grabación-no-un-screenshot).

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| **T1** | `p13.png` | primer frame de P13 | el comparador vacío, antes de agregar alojamientos |
| **T3** | `p13-tabla.png` | un frame posterior de P13, con la tabla ya armada | la tabla comparativa completa, con los tres alojamientos |

El fondo `escena23` trae el celular flotante ya con la forma y proporción de un
teléfono real (alto 2,17 veces el ancho), con la pantalla en gris liso como máscara de
posición. Hailuo la reemplaza por el fijo real en las dos tomas — el rectángulo **no
queda vacío**, aunque el guion original de las tomas lo pedía así: ver
[`../README.md`](../README.md#la-pantalla-del-teléfono).

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | el comparador vacío, antes de empezar | la dibuja Hailuo desde `@######PANTALLA#######` | No, y no hace falta — solo tiene que reconocerse como Hospeda |
| **T2** | se agregan tres alojamientos y aparece la tabla comparativa | grabación P13, pantalla completa | Sí — es el argumento del video, tiene que leerse completa |
| **T3** | la tabla comparativa ya completa | la dibuja Hailuo desde `@######PANTALLA#######` | No, y no hace falta |

T4 es la placa de cierre (`placas/final.png`), no una grabación.
