# V7 · Qué grabar y qué fijos hacen falta

V7 es "si tenés un alojamiento, esto es para vos": dos tiradas de Hailuo con el teléfono
flotante del patrón B (T1 y T3) y una grabación de pantalla completa en el medio (T2).
El estándar de grabación está en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| P5 | Ficha de alojamiento completa, sección por sección | scroll | T2 — pantalla completa |

Es la misma grabación que reutilizan V8, V9 y V10: conviene grabarla una sola vez, con
un alojamiento lindo y bien cargado.

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot. El teléfono flotante de `escena15.png` se mantiene plano y quieto en las
dos tiradas de Hospedín, pero en ninguna de las dos puede quedar en gris: como el corte
a la siguiente toma nunca lo reemplaza (nada se compone encima de estas dos), la pantalla
tiene que estar puesta desde el frame 1.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `capturas/p5.png` | primer frame de P5 (portada de la ficha) | la portada de la ficha, la misma que abre el recorrido de T2 |
| T3 | `capturas/p5-contacto.png` | un momento posterior de P5 (sección de contacto) | la sección de contacto, el final del recorrido de T2 |

Como nada se compone encima en ninguna de las dos tiradas, alcanza con que la pantalla se
lea como Hospeda — no hace falta que el texto sea legible letra por letra.

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| T1 | la portada de la ficha, en el teléfono flotante | la dibuja Hailuo desde `@######PANTALLA#######` (fijo de P5) | No, y no hace falta |
| T2 | la ficha de alojamiento completa, sección por sección | grabación, pantalla completa (P5) | Sí |
| T3 | la sección de contacto de la ficha, en el teléfono flotante | la dibuja Hailuo desde `@######PANTALLA#######` (fijo de P5-contacto) | No, y no hace falta |

**Por qué T2 no va adentro del inserto:** el recuadro de patrón B solo deja leer títulos
y botones (311 px de ancho), y acá el guion pide un recorrido por seis secciones
distintas de la ficha — a esa escala quedaría ilegible. Detalle completo en
[`montaje.md`](montaje.md#por-qué-t2-va-a-pantalla-completa-y-no-adentro-del-inserto).
