# V18 · Qué grabar y qué fijos hacen falta

V18 depende de una sola grabación real, de una sola toma sin cortes: la ficha, el botón
de contacto y WhatsApp abriéndose con la conversación entrando. El catálogo completo de
grabaciones y el estándar del fijo están en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| P6 | Botón de contacto → WhatsApp abriéndose | acción | entre T1 y T2, a pantalla completa |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `p6.png` | primer frame de P6 | la ficha, arranque de la grabación, en el celular que empuja hacia cámara |
| T2 | — | sin pantalla visible | el celular queda bajo y de espaldas a cámara, no se le ve la pantalla |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | la ficha, arranque de P6 | **la dibuja Hailuo** desde `@######PANTALLA#######` | No: el celular está en movimiento hacia la cámara |
| **grabación** | la ficha → botón de contacto → WhatsApp abriéndose | grabación, pantalla completa, de una sola toma | Sí |
| **T2** | — | el celular está bajo, la pantalla no mira a cámara | No aplica |

**T1 es un portal sobre el fondo 18**, el único de patrón A que no fue pensado como
portal —es un fondo de patrón J, "apoyado"— pero ya trae a Hospedín con el celular en
la mano a la altura del pecho, así que se aprovecha tal cual. El fijo `p6.png` que
arranca la grabación real evita cualquier salto de contenido entre lo que dibuja Hailuo
y lo que entra después en pantalla completa. **T2 no necesita ningún fijo**: el celular
baja a un costado del cuerpo y su pantalla deja de mirar a cámara, así que no hay
superficie gris (ni ninguna otra) que Hailuo tenga que dibujar.

⚠️ **P6 tiene que ser de una sola toma, sin cortes**: si se corta y se retoma al
grabarla, se nota, y acá el video entero depende de que se vea un flujo continuo desde
la ficha hasta la conversación de WhatsApp entrando.
