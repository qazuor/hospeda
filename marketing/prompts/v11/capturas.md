# V11 · Qué grabar y qué fijos hacen falta

V11 depende de una sola grabación de una sola toma: el alta completa, de registro a
publicado, sin cortes internos. El catálogo completo de grabaciones y el estándar del
fijo están en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| A1 | Alta completa: registro → publicado, sin cortes | acción | T2, a pantalla completa |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T1 | `a1.png` | primer frame de A1 | la pantalla de registro, el arranque del alta |
| T3 | `a1-publicado.png` | un momento más tarde de A1 | la ficha ya publicada, para que el teléfono confirme lo que la voz acaba de decir |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | el registro, arranque del alta | **la dibuja Hailuo** desde `@######PANTALLA#######` | No |
| **T2** | el alta entera, de registro a publicado | grabación, pantalla completa | Sí, es el objetivo del video: tiene que verse el trámite entero sin pasos escondidos |
| **T3** | la ficha ya publicada | **la dibuja Hailuo** desde `@######PANTALLA#######` | No |

**T1 y T3 usan dos momentos distintos de la misma grabación A1**, no el mismo fijo: T1
muestra el arranque (coherente con el gesto tranquilizador antes de empezar) y T3
muestra el resultado (coherente con el cierre entusiasmado, después de ver el trámite
completo). Ninguna de las dos tiradas de Hailuo lleva la grabación compuesta encima —eso
pasa sólo en T2, a pantalla completa—; el teléfono de T1 y T3 sólo necesita mostrar algo
reconocible, nunca la pantalla gris que traía el fondo antes.
