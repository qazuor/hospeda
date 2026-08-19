# V3 · Qué grabar y qué fijos hacen falta

V3 es la versión corta de V2 para historias: cinco bloques de grabación de pantalla
rápidos (3,0 s cada uno, sin narración) y una sola tirada de Hailuo de cierre (T6). Sale
del mismo material que V2 — no hay que grabar de nuevo. El estándar de grabación está en
[`../grabaciones.md`](../grabaciones.md).

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| P2 | Listado de alojamientos | scroll | T1 — pantalla completa |
| P8 | Gastronomía: listado y ficha | scroll | T2 — pantalla completa |
| P11 | Puntos de interés | scroll | T3 — pantalla completa |
| P9 | Experiencias: listado y ficha | scroll | T4 — pantalla completa |
| P10 | Agenda de eventos | scroll | T5 — pantalla completa |
| P1 | Home | scroll | T6 — fijo para el celular que Hailuo dibuja |

## Fijos para las tiradas

El fijo es el primer frame de la grabación exportado a 1080 × 2340 (ratio 0,4615), nunca
un screenshot.

| Toma | Fijo | Sale de | Qué se ve |
|---|---|---|---|
| T6 | `capturas/p1.png` | primer frame de P1 (home) | la home de Hospeda, dibujada por Hailuo en el celular que levanta hacia cámara |

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| T1 | listado de alojamientos | grabación, pantalla completa (P2) | Sí |
| T2 | gastronomía: listado y ficha | grabación, pantalla completa (P8) | Sí |
| T3 | puntos de interés | grabación, pantalla completa (P11) | Sí |
| T4 | experiencias: listado y ficha | grabación, pantalla completa (P9) | Sí |
| T5 | agenda de eventos | grabación, pantalla completa (P10) | Sí |
| T6 | la home de Hospeda en el celular que sostiene | la dibuja Hailuo desde `@######PANTALLA#######` (fijo de P1) | No, y no hace falta |

T6 es la única toma con Hospedín y con teléfono. El prompt original dejaba la pantalla
plana y gris, "compuesta después en edición" — pero el teléfono se levanta y se mueve
durante la acción, así que eso no se puede trackear. Se corrigió para que Hailuo dibuje
la pantalla desde el fijo de P1, siguiendo el molde de [V9 T2](../v9/t2.md).
