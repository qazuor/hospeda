# Abiertos del grupo g3-catalogos

Huecos que encontré al escribir `04-catalogos.md` y que las fuentes congeladas
(`f80c0f27154ca023d97a016707d823ff826cf76a`) no deciden. No llevan letra: la asigna el orquestador.

## 1. `M8` dice que no tiene fila en la matriz, y la matriz ya la tiene (`EX-51`)

- **Qué falta**: saber contra qué fila de la matriz se valida `M8` en `G15`. La lista de mentiras
  dice que `M8` sale de *«la medición de lotes del 2026-09-24 en producción, **sin fila propia en la
  matriz**»* y que *«**M8 no pasa `G15` hasta que su medición tenga fila en la matriz**»*. Pero la
  matriz ya tiene esa fila: `EX-51`, `VERIFIED`, abierta el 2026-09-28 *«sobre una medición ya
  hecha, con OK del owner»* y descrita como *«la M8 de la lista del proveedor falso, que no tenía
  fila y que `G15` pide»*.
- **Qué afecta**: [`M:M8`](../../04-catalogos.md#m-m8), [`GUARD:G15`](../../04-catalogos.md#guard-g15),
  [`MP:EX-51`](../../04-catalogos.md#mp-ex-51) y el *«Lista cuando»* de `B1` (dueña de `M8` y de
  `G15`): si se lee `B/20` literal, `G15` falla sobre `M8` y `B1` no cierra.
- **Por qué las fuentes no lo deciden**: `B/20-testing.md:510` y `:517` (sin `EX-51`) contra
  `D/06-mp-validation-matrix.md:408` (con `EX-51`). `DEC-METH-019`, implicación 4: *«la matriz no
  cambia»*, así que no se puede arreglar del lado de la matriz; y la consolidación no edita
  fuentes, así que tampoco del lado de `B/20`.
- **Pregunta propuesta para el owner**: ¿con qué fila de la matriz cumple `M8` el dato *«la fila de
  la matriz de la que sale»* que pide `G15`?
  1. **`EX-51` (y `PA-3`), y la consolidada lo dice en `M:M8`** — costo: una línea en el catálogo
     y en el AC de `B1`; riesgo: ninguno, `EX-51` es exactamente esa medición. **Recomendada.**
  2. **`M8` queda exceptuada de `G15` por nombre** — costo: una excepción en el guard; riesgo: abre
     la puerta a mentiras sin medición, que es lo que `G15` prohíbe.
  3. **`M8` sale de la lista hasta nueva medición** — costo: el falso deja de cobrar en tandas;
     riesgo: el código vuelve a suponer que el cobro entra a la hora exacta.
- **Ejemplo**: Juan, anfitrión de una cabaña en Colón, se suscribe al Básico la semana siguiente al
  corte con fecha de cobro a las 13:15; el proveedor real le cobra a las 14:02 (`EX-51`). Con la
  opción 1, el falso reproduce ese lote y la prueba de `B1` demuestra que nada en `B3`/`B7` supone
  que el cobro de Juan entra 13:15.
