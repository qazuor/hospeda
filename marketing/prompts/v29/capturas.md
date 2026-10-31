# V29 · Qué grabar y qué fijos hacen falta

Lo que hay que tener en la mano al sentarse a grabar la pantalla de V29. El estándar de
grabación y de fijos está en [`../grabaciones.md`](../grabaciones.md); acá sólo lo que
aplica a este video. Es el que más grabaciones encadena de todo el lote: cinco, una
detrás de otra.

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| P7 | Página de destino | scroll | T2 (4,5–8,5 s), a pantalla completa, 4,0 s |
| P8 | Gastronomía: listado y ficha | scroll | T3 (8,5–12,5 s), a pantalla completa, 4,0 s |
| P9 | Experiencias: listado y ficha | scroll | T4 (12,5–16,5 s), a pantalla completa, 4,0 s |
| P10 | Agenda de eventos | scroll | T5 (16,5–20,5 s), a pantalla completa, 4,0 s |
| P11 | Puntos de interés | scroll | T6 (20,5–24,5 s), a pantalla completa, 4,0 s |

> El guion narra seis paradas (destino, alojamiento, gastronomía, actividades, eventos,
> lugares), pero sólo hay cinco grabaciones: la búsqueda de alojamiento cae dentro de la
> misma P7 (la página de destino ya incluye alojamientos destacados). Si al filmar P7 no
> queda claro ese tramo, hay que reconsiderar sumar P2 como una sexta toma — ver
> [`montaje.md`](montaje.md#el-diálogo-completo).

## Fijos para las tiradas

El fijo es siempre el primer frame de la grabación, exportado a 1080 × 2340 (ratio
0,4615), nunca un screenshot.

El rectángulo flotante de `escena23` aparece en T1 y T8, y las cinco pantallas
encadenadas (P7 a P11) cortan directo a **pantalla completa** entre esas dos tomas de
Hospedín — a 311 px de ancho el texto y los números no se leerían compuestos ahí
adentro. Pero el rectángulo **no puede quedar con la pantalla gris**: queda varios
segundos en cuadro en T1 y en T8, así que tiene que mostrar contenido real desde el
arranque. Como nada se compone encima en edición, alcanza con que se lea como Hospeda.

**T1 abre el recorrido y T8 lo cierra**, así que cada fijo coincide con la grabación
pegada a ese extremo de la cadena: T1 corta hacia P7 (la primera parada), y T8 llega
después de que P11 cerró la cadena en T6 (la última parada, justo antes del primer plano
de remate).

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| **T1** | `capturas/p7.png` | P7 · página de destino | primer frame de la página de destino |
| **T8** | `capturas/p11.png` | P11 · puntos de interés | primer frame de puntos de interés |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | la página de destino en el rectángulo flotante | **la dibuja Hailuo** desde `@######PANTALLA#######` | No hace falta |
| **T2** | página de destino, incluye alojamientos destacados | grabación, pantalla completa | Sí |
| **T3** | gastronomía: listado y ficha | grabación, pantalla completa | Sí |
| **T4** | experiencias: listado y ficha | grabación, pantalla completa | Sí |
| **T5** | agenda de eventos | grabación, pantalla completa | Sí |
| **T6** | puntos de interés | grabación, pantalla completa | Sí |
| **T7** | ninguna — primer plano, sin teléfono en cuadro | no aplica | No aplica |
| **T8** | puntos de interés en el rectángulo flotante | **la dibuja Hailuo** desde `@######PANTALLA#######` | No hace falta |

Que las cinco grabaciones (P7 a P11) mantengan el mismo tamaño de recuadro al
componerlas en edición — si una queda más grande o más chica que las otras, la cadena se
nota.
