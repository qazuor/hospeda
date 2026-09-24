---
title: Rastro de la familia 6 — la conciliación y el contador
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 6 — la conciliación y el contador

Cierra el **crítico #7** (`F-8fB3-001`, `22-fase-8-bis-5/B3-conciliacion-datos-y-migracion.md`):
`B/09` §4 decidía *«no cobró nunca»* con `charged_quantity`, que cuenta registros de cobro
incluido el rechazado, y concluía *«sí cobró»* sobre una suscripción que no pagó un peso (`RC-5`).
Arrastra `RC-6`, la otra mitad de la misma regla.

**Decidió el owner**, el 2026-09-24: arreglar y no declarar con causa (`DEC-METH-013` cláusula 4:
un crítico de dinero lo lee el owner).

**Un crítico, no dos.** El `C1` de la 8-bis-5 (§8) dejó abierto si `RC-5` era uno o dos porque
*«`B/09` §4 y la ventana de reintentos leen el mismo objeto»*. La sonda 49 dio que la ventana es
**el ciclo**, y `DEC-SUB-019` hizo que el grace cancele el preapproval antes de que esa ventana
importe: ninguna regla del diseño decide nada leyendo la ventana. Queda uno.

## 1. Los commits

| sha | qué cierra |
|---|---|
| `9559162796` | `B/09` §4 reescrito; §6.2 con la cadencia de cobro medida; *«Lo que este capítulo NO cierra»* actualizado |
| `3c69fc80df` | `S6` trata *«todavía no se sabe»* como lectura fallida |
| `1ae75e92c4` | inventario de compensación: `RC-5` y `RC-6` compensadas, 25 de 25 |

## 2. Qué se arregló

- **«¿Cobró?» se lee de `payment.status` = `approved`**, registro por registro, leído por id
  (`GET /authorized_payments/{id}`, `EX-16`, `D17`). No del `status` del registro (`RC-6`), ni del
  `status_detail` temprano (`RC-6`), ni de `charged_quantity` (`RC-5`), ni de `last_charged_date`.
- **`charged_quantity` pasa a responder otra pregunta**: si el inventario de intentos está completo.
  Medido el 2026-09-24 que cuenta **registros** —5/5, 5/5, 7/7, 2/2 sobre los cuatro sujetos de
  producción— y que los reintentos de un ciclo viven **dentro** de un mismo registro
  (`retry_attempt: 4`).
- **Cuatro modos de «cero cobros», no tres**: se agrega *«intentó y se rechazó»*, el de `RC-5`.
- **Tres respuestas, no dos**: *«cobró»*, *«no cobró»* y *«todavía no se sabe»*. La tercera no es
  divergencia y, para `S6`, equivale a una lectura fallida.
- **§6.2**: la forma del retraso —lotes al minuto `:02`— y la consecuencia de que la tolerancia ya
  no sostiene la corrección.
- **`charged_amount` no decide**: sumó los aprobados en los cinco sujetos medidos, pero no se midió
  cuándo se actualiza.

## 3. Qué se grepeó

Alcance: `HOS-1354-…/docs`, `HOS-1353-*/docs`, `nucleo/`, `12-contrato-de-cobertura.md` y el
inventario, con `rg -F` (literal), el 2026-09-24 **después** de los tres commits.

| término | apariciones fuera del §4 nuevo |
|---|---|
| `tres modos` (viejo) | 0 — sólo la cita histórica del §4 (`09-conciliacion.md:544`) |
| `concluye desde el contador` (viejo) | 0 |
| `contador del preapproval` (viejo) | 0 — sólo la cita histórica (`:546`) |
| `charged_quantity` | 1 — la fila `RC-5` del inventario, correcta |
| `payment.status` (nuevo) | 2 — las filas `RC-5`/`RC-6` del inventario, correctas |
| `todavía no se sabe` (nuevo) | 3 ajenas, ver §4 |

Los identificadores se buscaron sin backticks: `rg -F` sobre el nombre desnudo también encuentra la
forma con backticks.

## 4. Las 3 apariciones no corregidas

1. `12-contrato-de-cobertura.md:317`, fila `SIN_FECHA_CONOCIDA` — otra cosa: una fecha de fin que
   no se conoce. Sigue correcta.
2. `12-suscripcion.md:610` — el momento en que entra un pago durante la ventana de una sucesión.
   Sigue correcta.
3. `03-maquinas-de-estado.md:127`, fila `S6` — es la que este rastro escribió.

## 5. Premisas ajenas que el arreglo volvió falsas, y se corrigieron en el mismo acto

- `09-conciliacion.md`, *«Lo que este capítulo NO cierra»*: decía que `RF-3` *«es del capítulo 13»*
  y que las filas del grace *«se contestan el 2026-09-17»*. Tachadas y reemplazadas: `DEC-RF-007`,
  el capítulo 13 repartido, `GR-3` y la sonda 49.
- `03-maquinas-de-estado.md` fila `S6`: sólo contemplaba *«la lectura falla»*; ahora también
  *«todavía no se sabe»*.

## 6. Lo que este rastro vuelve falso de los anteriores

- La fila `RC-5` de la matriz dice que `charged_quantity` *«cuenta INTENTOS»*. **Es impreciso**:
  cuenta registros, y un registro lleva hasta cuatro intentos adentro. La matriz no se tocó —pide
  consulta al owner—; queda como pregunta abajo.
- El handoff del 2026-09-24 dice que la familia 6 *«ya no espera nada»* y lista `RC-6` con ella:
  sigue siendo cierto y queda cumplido.

## 7. Preguntas para el owner

1. **¿Se agrega a la fila `RC-5` de la matriz la precisión *«cuenta registros, no intentos»*, con
   la medición del 2026-09-24?** No cambia el estado (`NOT_SUPPORTED`) ni ningún conteo.
2. **¿Cuántas corridas espera el barrido un cobro *«todavía no se sabe»* antes de mirarlo?** Es un
   número, no un mecanismo (`B/09` §6.2).
