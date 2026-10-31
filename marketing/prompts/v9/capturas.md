# V9 · Qué grabar y qué fijos hacen falta

V9 es el molde de la serie: cuatro tiradas de Hailuo, grabación de pantalla y la placa
de cierre. El estándar de grabación —proporciones, tipos, cómo nombrar los fijos— está
en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| P1 | Home | scroll | T2 — fijo para el celular que Hailuo dibuja |
| P5 | Ficha de alojamiento completa, sección por sección | scroll | T3 — pantalla completa |
| P6 | Botón de contacto → WhatsApp abriéndose | acción | T4 (compuesta en el recuadro) y T5 (pantalla completa) |

> ⚠️ P1 no figura en la columna "Videos" de la tabla de `grabaciones.md` para este
> video, pero V9 T2 sí depende de ella: el fijo `capturas/pantalla.png` que ya existe es
> justamente un frame de P1. Vale la pena corregir esa tabla cuando se audite
> `grabaciones.md`.

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T2 | `capturas/pantalla.png` | primer frame de P1 (home) | la home de Hospeda, dibujada por Hailuo en el celular que empuja hacia cámara |
| T4 | `capturas/p6.png` | primer frame de P6 (botón de contacto) | el botón de contacto de la ficha, dibujado por Hailuo en el recuadro flotante |

> ⚠️ `capturas/pantalla.png` mide hoy 1080 × 2117: es un screenshot, no un frame de
> grabación. Hay que reexportarlo como el primer frame de P1 antes de usarlo en T2 — ver
> la advertencia en [`../grabaciones.md`](../grabaciones.md#los-fijos--la-pantalla-nunca-sale-gris).

T4 antes dejaba el recuadro plano, vacío y gris, a la espera de que la grabación de P6
se compusiera encima en edición. Se corrigió: el recuadro no se mueve en ningún momento
de la toma, pero igual no puede quedar en gris durante los 2,5 s que dura — Hailuo lo
dibuja desde el fijo de P6 y el resto queda igual de quieto que antes.

## Qué pantalla se ve en cada toma

Cuatro tomas muestran una pantalla, y no son lo mismo: dos son grabación a pantalla
completa (T3, T5) y dos las dibuja Hailuo desde un fijo (T2, T4).

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| T1 | ninguna — primer plano, sin pantalla | no aplica | — |
| T2 | la home de Hospeda en el celular que sostiene | la dibuja Hailuo desde `@######PANTALLA#######` (fijo de P1) | No, y no hace falta |
| T3 | la ficha del alojamiento: fotos, título, datos | grabación, pantalla completa (P5) | Sí |
| T4 | el botón de contacto, ampliado | la dibuja Hailuo desde `@######PANTALLA#######` (fijo de P6) | No, y no hace falta |
| T5 | el mensaje del turista llegando | grabación, pantalla completa (P6, momento posterior) | Sí |
| T6 | ninguna — plano corto, sin pantalla | no aplica | — |
| T7 | la placa de cierre | `placas/final.png`, imagen fija ya existente | Sí |

Los tres momentos de grabación cuentan una progresión y por eso no repiten: publicación
(T3) → contacto (T4) → mensaje (T5). Detalle completo de por qué en
[`montaje.md`](montaje.md#qué-se-ve-en-cada-pantalla).
