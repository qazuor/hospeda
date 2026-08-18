# V19 · Qué grabar y qué fijos hacen falta

V19 depende de una sola grabación real: las opiniones de Google conectándose y las
estrellas apareciendo en la ficha. El catálogo completo de grabaciones y el estándar
del fijo están en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| A5 | Opiniones de Google: conectar, aparecen las estrellas | acción | entre T1 y T2, a pantalla completa |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `a5.png` | primer frame de A5 | la ficha sin estrellas, arranque de la grabación, en el celular que empuja hacia cámara |
| T2 | — | sin pantalla visible | el celular queda bajo y de espaldas a cámara, no se le ve la pantalla |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | la ficha sin estrellas, arranque de A5 | **la dibuja Hailuo** desde `@######PANTALLA#######` | No: el celular está en movimiento hacia la cámara |
| **grabación** | la ficha sin estrellas → se conecta → aparecen las estrellas | grabación, pantalla completa | Sí, es el mensaje del video: el cambio visual tiene que registrarse |
| **T2** | — | el celular está bajo, la pantalla no mira a cámara | No aplica |

**T1 es un portal, no un inserto fijo**: el celular viaja hacia la cámara y el corte a
la grabación ocurre apenas llega, así que usar el mismo fijo `a5.png` que arranca la
grabación real evita cualquier salto de contenido entre lo que dibuja Hailuo y lo que
entra después en pantalla completa. **T2 no necesita ningún fijo**: el celular baja a
un costado del cuerpo y su pantalla deja de mirar a cámara, así que no hay superficie
gris (ni ninguna otra) que Hailuo tenga que dibujar.
