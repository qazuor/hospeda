# V20 · Qué grabar y qué fijos hacen falta

Lo que hay que tener en la mano al sentarse a grabar la pantalla de V20. El estándar de
grabación y de fijos está en [`../grabaciones.md`](../grabaciones.md); acá sólo lo que
aplica a este video.

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| A6 | Panel de estadísticas con los números | scroll | Entre T1 y T2 (4,0–18,0 s), a pantalla completa, 14,0 s |

## Fijos para las tiradas

El fijo es siempre el primer frame de la grabación, exportado a 1080 × 2340 (ratio
0,4615), nunca un screenshot.

El teléfono flotante del fondo `escena21` aparece en T1 y T2, y el panel de estadísticas
(A6) corta a **pantalla completa** entre las dos tomas de Hospedín — el recuadro mide 311
px de ancho y los números no se leerían ahí adentro. Pero el teléfono en sí **no puede
quedar con la pantalla gris**: aunque nada se compone encima suyo en edición, sigue
varios segundos encendido en cuadro, así que tiene que mostrar el panel desde el
arranque. Alcanza con que se lea como Hospeda, no con que los números se distingan.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| **T1** | `capturas/a6.png` | A6 · panel de estadísticas | primer frame del panel |
| **T2** | `capturas/a6.png` | A6 · panel de estadísticas | primer frame del panel |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | el panel de estadísticas en el teléfono flotante | **la dibuja Hailuo** desde `@######PANTALLA#######` | No hace falta |
| **grabación** | el panel de estadísticas, con scroll | grabación, pantalla completa | Sí |
| **T2** | el mismo panel de estadísticas en el teléfono flotante | **la dibuja Hailuo** desde `@######PANTALLA#######` | No hace falta |

Sin precios ni datos de terceros visibles en la grabación del panel.
