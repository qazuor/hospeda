# V16 · Qué grabar y qué fijos hacen falta

V16 depende de una sola grabación real: el calendario conectándose y las fechas
bloqueándose solas. El catálogo completo de grabaciones y el estándar del fijo están en
[`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| A3 | Calendario: conectar y ver las fechas bloquearse | acción | entre T1 y T2, a pantalla completa |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `a3.png` | primer frame de A3 | el calendario, antes de conectarse, en el celular que empuja hacia cámara |
| T2 | — | sin pantalla visible | el celular queda bajo y de espaldas a cámara, no se le ve la pantalla |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | el calendario, arranque de A3 | **la dibuja Hailuo** desde `@######PANTALLA#######` | No: son fracciones de segundo con el celular en movimiento hacia la cámara |
| **grabación** | el calendario conectándose y las fechas bloqueándose | grabación, pantalla completa | Sí, es el centro del video |
| **T2** | — | el celular está bajo, la pantalla no mira a cámara | No aplica |

**T1 es un portal, no un inserto fijo**: el celular viaja hacia la cámara y el corte a
la grabación ocurre apenas llega, así que usar el mismo fijo `a3.png` que arranca la
grabación real evita cualquier salto de contenido entre lo que dibuja Hailuo y lo que
entra después en pantalla completa. **T2 no necesita ningún fijo**: el celular baja a
un costado del cuerpo y su pantalla deja de mirar a cámara, así que no hay superficie
gris (ni ninguna otra) que Hailuo tenga que dibujar.
