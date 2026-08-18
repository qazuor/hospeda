# V30 · Qué grabar y qué fijos hacen falta

V30 es un video de patrón A (el portal): el celular viaja a primer plano y ahí se
compone la búsqueda. Necesita una grabación de pantalla y un fijo para la tirada de
Hailuo que empuja el celular hacia cámara. Catálogo completo de grabaciones y estándar
del fijo en [`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|---|---|---|---|
| **P4** | Buscador en lenguaje natural | acción | **T3** — se escribe la búsqueda en criollo y aparecen los resultados, a pantalla completa |
| P2 | Listado de alojamientos | scroll | alternativa a P4 en T3, si el lenguaje natural no luce tan claro como se espera |
| P3 | Buscador con filtros aplicados | acción | alternativa a P4 en T3, misma condición |

> P4 es la elección del montaje ([`montaje.md`](montaje.md)): cubre en una sola
> grabación de tipo "acción" los dos pasos que pedía el guion (escribir la búsqueda,
> ver los resultados). P2 y P3 quedan grabadas igual, por si en la toma real P4 no
> convence.

## Fijos para las tiradas

El fijo es siempre el **primer frame de la grabación**, exportado a 1080 × 2340
(ratio 0,4615) — nunca un screenshot. Ver el porqué en
[`../grabaciones.md`](../grabaciones.md#el-fijo-es-un-frame-de-la-grabación-no-un-screenshot).

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| **T2** | `pantalla.png` (legado) | — | la home de Hospeda, en el celular que se empuja hacia cámara |

⚠️ **`capturas/pantalla.png` es un screenshot de 1080 × 2117, no un frame de grabación**
(ver la advertencia en [`../grabaciones.md`](../grabaciones.md)). [`t2.md`](t2.md) ya
está aprobado y no se toca, pero antes de usarlo hay que reexportarlo como el primer
frame de una grabación de la home (equivalente a P1) a 1080 × 2340. T1 y T4 son primer
plano sin teléfono: no llevan fijo.

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T2** | la home de Hospeda en el celular que sostiene | la dibuja Hailuo desde `@######PANTALLA#######` | No, y no hace falta — solo tiene que leerse como Hospeda |
| **T3** | búsqueda en lenguaje natural: se escribe la frase y aparecen los resultados | grabación P4, pantalla completa | Sí |

T1 (primer plano) y T4 (primer plano, remate) no muestran pantalla. T5 es la placa de
cierre (`placas/final.png`), no una grabación.
