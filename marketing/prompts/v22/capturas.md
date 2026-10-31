# V22 · Qué grabar y qué fijos hacen falta

Lo que hay que tener en la mano al sentarse a grabar la pantalla de V22. El estándar de
grabación y de fijos está en [`../grabaciones.md`](../grabaciones.md); acá sólo lo que
aplica a este video. V22 es uno de los dos videos del lote (con V23) que usa grabaciones
**fuera de la plataforma**.

## Grabaciones que usa este video

| # | Grabar | Tipo | Dónde entra |
|:-:|---|---|---|
| E2 | Consulta a una IA que menciona un alojamiento | acción | T2 (4,0–9,0 s), a pantalla completa, 5,0 s |
| E1 | Búsqueda en Google que devuelve la ficha | acción | T4 (14,0–32,0 s), a pantalla completa, 18,0 s |

## Fijos para las tiradas

El fijo es siempre el primer frame de la grabación, exportado a 1080 × 2340 (ratio
0,4615), nunca un screenshot.

**Este video no necesita ningún fijo.** Las cuatro tiradas de Hospedín (T1, T3, T5, T6)
usan patrón D — objeto en la mano, la lamparita de idea — no un teléfono: `escena4`
muestra por defecto a Hospedín con un celular, pero el prompt de cada una de esas tomas
reemplaza explícitamente ese celular por la lamparita. Ningún teléfono entra en cuadro en
todo el video, así que no hay pantalla que Hailuo tenga que dibujar. E1 y E2 cortan
directo a pantalla completa.

## Qué pantalla se ve en cada toma

| Toma | Qué pantalla | De dónde sale | ¿Se lee? |
|---|---|---|---|
| **T1** | ninguna — sostiene la lamparita, no un teléfono | no aplica | No aplica |
| **T2** | consulta a una IA que menciona un alojamiento | grabación, pantalla completa | Sí |
| **T3** | ninguna — sostiene la lamparita, no un teléfono | no aplica | No aplica |
| **T4** | búsqueda en Google que devuelve la ficha, scroll y acercamiento | grabación, pantalla completa | Sí |
| **T5** | ninguna — sostiene la lamparita, no un teléfono | no aplica | No aplica |
| **T6** | ninguna — primer plano, sin manos en cuadro | no aplica | No aplica |

En T4, resaltar visualmente el nombre del alojamiento y la palabra "Google" en la
grabación (círculo, subrayado o un pequeño zoom), porque después de que la voz en off
termina la frase la pantalla queda un rato más en silencio.
