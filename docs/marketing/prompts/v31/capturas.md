# V31 · Qué grabar y qué fijos hacen falta

V31 es un video de patrón F (sentado en la reposera): el celular nunca viaja a cámara,
queda apoyado en la falda todo el tiempo, tanto en las dos tiradas de Hailuo como en la
grabación de pantalla. Catálogo completo de grabaciones y estándar del fijo en
[`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|---|---|---|---|
| **P12** | Favoritos: marcar varios y verlos juntos | acción | **T2** (marcar varios alojamientos, primer momento) y **T4** (verlos todos juntos en la cuenta, momento posterior) |

> Una sola grabación de una sola toma, sin cortes ([`montaje.md`](montaje.md)), usada en
> dos momentos distintos del video: T2 muestra el gesto de marcar, T4 la vista de todos
> los favoritos juntos. Se necesita una cuenta de turista real, no la de super admin.

## Fijos para las tiradas

El fijo es siempre el **primer frame de la grabación**, exportado a 1080 × 2340
(ratio 0,4615) — nunca un screenshot. Ver el porqué en
[`../grabaciones.md`](../grabaciones.md#el-fijo-es-un-frame-de-la-grabación-no-un-screenshot).

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| **T1** | `p12.png` | primer frame de P12 | el listado, antes de marcar ningún favorito |
| **T3** | `p12-marcados.png` | un frame posterior de P12, después de marcar | el listado con algunos alojamientos ya marcados como favoritos |

En ambas tomas el celular está apoyado y quieto en la falda, de frente a cámara — así
lo trae el fondo `escena13`, con la pantalla en gris liso como máscara de posición.
Hailuo la reemplaza por el fijo real: ver
[`../README.md`](../README.md#la-pantalla-del-teléfono).

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | el listado de alojamientos, sin marcar todavía | la dibuja Hailuo desde `@######PANTALLA#######` | No, y no hace falta — solo tiene que reconocerse como Hospeda |
| **T2** | se marcan varios alojamientos como favoritos | grabación P12a, pantalla completa | Sí |
| **T3** | el listado, ya con algunos favoritos marcados | la dibuja Hailuo desde `@######PANTALLA#######` | No, y no hace falta |
| **T4** | los favoritos marcados, todos juntos en la cuenta | grabación P12b, pantalla completa | Sí |

T5 es la placa de cierre (`placas/final.png`), no una grabación.
