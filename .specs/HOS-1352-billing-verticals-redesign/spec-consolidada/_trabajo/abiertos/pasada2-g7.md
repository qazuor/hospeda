# Abiertos de la pasada 2 · g7 (`B1`, `B2`, `B3`)

Fuentes en `17f9702675`. Una entrada por hueco; sin letra (la asigna el orquestador).

## 1. La guarda de `S15` lee `reconciliation_mark_payment`, que nace en `B5` (`B3`)

- **Qué falta**: BN dice dónde nace una tabla y que **la rama que la escribe** se completa con la dueña
  de la tabla destino. `S15` (de `B3`) no la escribe: la **lee**, en su guarda *«ningún pago colgado sin
  resolver»*. Con BN, `reconciliation_mark_payment` nace en `B5` (su FK apunta a `payment`), así que
  cuando se mergea `B3` la guarda de `S15` no tiene tabla que leer.
- **Afecta**: `TRANS:B:S15`, `TPZ:S15`, `ACC:7`; [AC:B3:15](../../10-corte/B3.md#ac-b3-15) y TEST:B3:15; también el
  predicado (f) de `G-R1-F` (levantar una marca con un pago colgado sin resolver), de `B3`.
- **Lo escrito en la pasada 2 (inferido, marcado así en el AC)**: apliqué BL a la lectura —`B3` escribe
  la guarda contra una interfaz interna y `B5` trae la implementación; el rechazo con un pago sin
  resolver se prueba en `B5` con filas sembradas—.
- **Por qué no lo deciden las fuentes**: `41-corte-del-mvp/10-decisiones-del-owner.md`, BN: *«la rama
  que la escribe se completa ahí»*; BL habla de *«una pieza anterior que llama a algo que construye una
  posterior»*. Ninguna de las dos nombra una lectura de una tabla posterior. `B/descomposicion.md`
  l. 808-811 (BN aplicada) tampoco nombra `S15`.
- **Pregunta al owner**:
  1. **BL aplicada a la lectura** (lo escrito): `B3` escribe la guarda de `S15` contra una interfaz
     interna; `B5` la implementa y prueba el rechazo con filas sembradas, y el criterio va al *«Lista
     cuando»* de `B5`. Costo: una línea en la fila de `B5`. Riesgo: bajo; entre el merge de `B3` y el de
     `B5` no hay pagos colgados que proteger, porque nadie los escribe. **Recomendada.** Ejemplo: Juan
     no tiene ninguna marca con un pago colgado antes de `B5`, porque `P1` todavía no existe.
  2. `reconciliation_mark_payment` nace en `B3` sin la `FK` a `payment`, y `B5` la agrega. Costo: una
     migración en `B5` que toca una tabla de `B3`. Riesgo: contradice BN (*«nace con todas sus
     restricciones»*).
  3. `S15` entera pasa a `B5`. Costo: mover una transición de pieza. Riesgo: `B3` queda con `S14` (abre la
     marca) sin la transición que la levanta durante el intervalo.
