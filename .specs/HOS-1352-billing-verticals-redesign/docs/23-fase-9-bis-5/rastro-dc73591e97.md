---
title: Rastro de la familia 7 — la pausa del proveedor
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 7 — la pausa del proveedor

Lleva a los capítulos las dos decisiones que el 2026-09-22 **no tenían ninguna línea en ellos**
(`00-instrucciones.md` §2): `DEC-MP-003` y `DEC-MP-004`. Con esta familia **la 9-bis-5 queda
completa: siete de siete.**

**`DEC-MP-003` no se llevó como estaba: se enmendó.** Llevar el motivo `PROVIDER_DUNNING` exigía
recorrer 22 apariciones en 9 archivos y diseñar lo que había dejado abierto —servicio, salida,
cupo— para un caso que `DEC-SUB-019`, del mismo día, volvió un borde. El owner eligió **`DEC-MP-008`**:
una pausa del proveedor por mora dispara `S6`, sin motivo nuevo. Las dos posiciones están en la
entrada del log.

## 1. Los commits

| sha | qué cierra |
|---|---|
| `7b02d1fcc2` | `DEC-MP-008` en el log; `DEC-MP-003` `SUPERSEDED EN PARTE`; puntero en `DEC-SUB-019`; resumen recontado (110 · 13 · 97 · 4 superadas) |
| `cd4df105b8` | el índice del núcleo cuenta 110 |
| `38ea122a0d` | `B/03`: `S6` con su segundo evento; la tabla §10.1 lleva `paused` a `S6`, no a `S8`; la tabla de salidas de la predecesora |
| `289b39e7c4` | `B/19` §4 fila 19: el mensaje del alta rechazada (`DEC-MP-004`) |
| `2f5f107efe` | `NUCLEO/07`: el aviso del alta rechazada, y la puerta manual acotada al pagador manual |
| `ae9c7d3008` | `B/03` `S16` remite al mapa |
| `e9b6341343` | `B/12` §1.4: la pausa por mora no pasa por la baja espejada |
| `444522bc6e` · `d51b722cbd` | el núcleo (glosario y máquinas) nombra el segundo camino a `SUSPENDED` |
| `40a421aeae` | **decisión del owner**: la pausa por mora no suspende en medio de una sucesión |
| `6d64f0f113` | **decisión del owner**: *fila viva* ocupa el lugar, no sólo cobra |
| `06bfca5266` · `278ea07f7e` · `dc73591e97` | `S7`, el test del ciclo de impago y el aviso de suspensión: cómo vuelve cada método de pago |

## 2. Qué se arregló

- **Una pausa que no pedimos es mora, y termina el grace**: `S6` sale también de `ACTIVE` por ese
  evento. Antes se espejaba con `S8` como `CUSTOMER_REQUEST`, que es el error que `DEC-MP-003` había
  diagnosticado.
- **El alta rechazada le dice a la persona qué hacer según por qué la rechazaron**; el contenido del
  mapa queda abierto, como decía `DEC-MP-004`.
- **Dos huecos que abrió la revisión en frío, decididos por el owner**: (1) la pausa por mora no
  suspende a la predecesora de una sucesión en curso; (2) la definición de *fila viva* decía *«puede
  cobrar»*, falso para una `SUSPENDED` de tarjeta desde `DEC-SUB-019`: se reescribió como *«ocupa el
  lugar»*, y la lista no cambió.
- **La vuelta de un suspendido con tarjeta estaba decidida en `DEC-SUB-019` y escrita en un solo
  lugar**: ahora está en el glosario, en `S7`, en el test y en el aviso de suspensión.

## 3. Qué se grepeó

Alcance: `HOS-1354-…/docs`, `HOS-1353-*/docs`, `nucleo/` y `12-contrato-de-cobertura.md`, con
`rg -F`, **después** del último commit.

| término | resultado |
|---|---|
| `PROVIDER_DUNNING` | **0** en los capítulos (vive sólo en el log, en `DEC-MP-003` y `DEC-MP-008`) |
| `Espejar, con motivo` (el mapeo viejo a `S8`) | 1 — tachado en la fila `paused` de §10.1 |
| `regularizar un pago` | 1 — el glosario, ya acotado por método de pago |
| `puede cobrar` | 17 — ver §4 |

## 4. Las apariciones no corregidas de *«puede cobrar»*

Las 17 hablan de **una autorización concreta que puede cobrar** —el preapproval de un alta
pendiente, de un addon, de una pausa— y **no** de la definición de *fila viva*, salvo una:
`nucleo/01-glosario.md:451`, que dice que el peligro que vigila el conjunto 6 es *«una autorización
que puede cobrar, que es éste»*. **Sigue siendo correcta como guarda**: el conjunto de filas vivas
**contiene** a todas las que pueden cobrar —ahora contiene además a la `SUSPENDED` de tarjeta, que
no puede—, así que no deja pasar ningún doble cobro. Es un superconjunto, no un conjunto distinto.

## 5. Premisas ajenas que el arreglo volvió falsas, y se corrigieron en el mismo acto

- `NUCLEO/07`, aviso *«cambio de plan con una cuota en reintento»*: la misma *«puerta manual»* para
  un pagador con tarjeta que la propagación de `DEC-SUB-019` había escrito en `B/03`, `B/05`, `B/12`,
  `B/19` y `B/20`. Acotada.
- `B/12` §1.4: su reemplazo de la mañana decía que el espejo respondía a *«una baja o una pausa del
  proveedor»*; la pausa ahora va por `S6`.

## 6. Lo que este rastro vuelve falso de los anteriores

- El rastro de la familia 6 y el handoff del 2026-09-24 nombran la familia 7 como pendiente: queda
  hecha.
- `00-instrucciones.md` §2 dice que *«las dos `DEC-MP-*` no tienen HOY ninguna línea en los
  capítulos»*: deja de ser cierto. No se edita —es la consigna de la tanda—; lo dice este rastro.

## 7. Preguntas para el owner

**Ninguna abierta.** Las dos que salieron de la revisión se hicieron y se contestaron en la sesión:
la sucesión en curso (extender la protección) y *fila viva* (mantener `SUSPENDED` y reescribir la
razón, más la vuelta por método de pago en tres lugares y el aviso de cómo volver).
