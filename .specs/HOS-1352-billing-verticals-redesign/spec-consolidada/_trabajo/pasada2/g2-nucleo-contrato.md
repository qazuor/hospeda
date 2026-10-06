# Pasada 2 · g2-nucleo-contrato

> Generado por `scripts/pasada2.py` sobre el HEAD `9b40071800`; fuentes `f80c0f2715` → `17f9702675`. Los archivos generados (01, 04, B4–B7) no se editan a mano: lo que les toca se arregla en su generador (`scripts/generadores/`).

| qué | cuántos |
|---|---|
| Ítems nuevos a definir (R1) | 1 |
| AC y tests nuevos (R7 · R7b · R18) | 0 |
| Ítems con contenido de fuente cambiado desde f80c0f2715 | 1 |
| Citas sobre texto cambiado (reanclar.py, sin remapear) | 12 |
| Secciones R17 sin citar asignadas | 3 |
| R17 cubierto | 0 |
| R17 parcial | 1 |
| R17 ausente | 2 |

## `02-nucleo-glosario.md`

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 454: `V/descomposicion.md:72` — texto en f80c0f2715: «| **V9a** | **El registro de los actos del dueño** | el registro de los actos del dueño sobre la ficha que no son transiciones —crearla, editarla, exportarla—, que es la fuente del hecho 1 del reloj, guardando sólo el no» — candidata en 17f9702675: `V/descomposicion.md:72` «| **V9a** | **El registro de los actos del dueño** | el registro de los actos del dueño sobre la ficha que no son transiciones —crearla, editarla, exportarla—, que es la fuente del hecho 1 del reloj, guardando sólo el no»
- línea 454: `V/descomposicion.md:73` — texto en f80c0f2715: «| **V9b** | **Retención** *(después)* | el resto de `V9`: el reloj de 90 y 180 días con sus cinco hechos de reinicio —el hecho 1 lo lee del registro de `V9a`—, `PB9` hacia `PURGED` con todo lo que la fila de `V9` le fija» — candidata en 17f9702675: `V/descomposicion.md:73` «| **V9b** | **Retención** *(después)* | el resto de `V9`: el reloj de 90 y 180 días con sus cinco hechos de reinicio —el hecho 1 lo lee del registro de `V9a`—, `PB9` hacia `PURGED` con todo lo que la fila de `V9` le fija»
- línea 689: `D/nucleo/01-glosario.md:714` — texto en f80c0f2715: «> 8 completa, owner 2026-09-25; el 20, `COBRO_DUPLICADO`, desde la pendiente 6 —el 21 y el 22 desde la FASE 9 completa (`B/02` §2.5: `COBRO_DEL_PERÍODO_SIN_RESOLVER`, decisión 3d, y `PAUSA_NO_APLICADA`, `F-8CB2-003`)—) y» — candidata en 17f9702675: `D/nucleo/01-glosario.md:714` «> 8 completa, owner 2026-09-25; el 20, `COBRO_DUPLICADO`, desde la pendiente 6 —el 21 y el 22 desde la FASE 9 completa (`B/02` §2.5: `COBRO_DEL_PERÍODO_SIN_RESOLVER`, decisión 3d, y `PAUSA_NO_APLICADA`, `F-8CB2-003`)—) y»

## `02-nucleo-modelo-y-maquinas.md`

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 168: `D/nucleo/02-modelo-de-datos.md:262` — texto en f80c0f2715: «| **`domain_event`** | qué pasó, sobre qué entidad, quién lo causó, cuándo, **qué campos cambiaron** — no una copia del contenido; **de los campos de contenido de una ficha, sólo el nombre** (cap. 08 §1.2; owner 2026-09-» — candidata en 17f9702675: `D/nucleo/02-modelo-de-datos.md:263` «| **`domain_event`** | qué pasó, sobre qué entidad, quién lo causó, cuándo, **qué campos cambiaron** — no una copia del contenido; **de los campos de contenido de una ficha, sólo el nombre** (cap. 08 §1.2; owner 2026-09-»

## `02-nucleo.md`

### Ítems nuevos a definir (R1)

- `PLAZO:19` — D/nucleo/02-modelo-de-datos.md:191 — se define acá (asignacion.json); dueña del AC: **B11**

### Ítems con contenido de fuente cambiado desde f80c0f2715

- **define**: `ACC:1` (MIXTO) — vieja `D/nucleo/08-auditoria-y-observabilidad.md:191` → nueva `D/nucleo/08-auditoria-y-observabilidad.md:191` — cambio: {+**Revocar es reanudar antes del fin: corre `S10` por su tercer evento, con `fin_real`, la relectura, sin reembolso y con el aviso a la persona; lo construye `B9b`** (corte del MVP, owner 2026-10-02, BO)+}

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 833: `D/nucleo/04-invariantes.md:207` — texto en f80c0f2715: «1. **Qué pasa cuando una suscripción principal muere y quedan complementos vivos.** El §41 dice» — candidata en 17f9702675: `D/nucleo/04-invariantes.md:207` «1. ~~**Qué pasa cuando una suscripción principal muere y quedan complementos vivos.** El §41 dice»
- línea 918: `D/nucleo/08-auditoria-y-observabilidad.md:191` — texto en f80c0f2715: «| otorgar o revocar una **cortesía temporal** — **en meses enteros y sólo sobre un plan mensual**; sobre ~~un anual~~ **uno no mensual —trimestral, semestral o anual—** no está disponible (FASE 8 completa, `F-8CB1-001`; » — candidata en 17f9702675: `D/nucleo/08-auditoria-y-observabilidad.md:191` «| otorgar o revocar una **cortesía temporal** — **en meses enteros y sólo sobre un plan mensual**; sobre ~~un anual~~ **uno no mensual —trimestral, semestral o anual—** no está disponible (FASE 8 completa, `F-8CB1-001`; »
- línea 1458: `D/nucleo/02-modelo-de-datos.md:192` — texto en f80c0f2715: «**Son dieciocho** (FASE 9 vuelta 3: el 16 por el lote K, owner 2026-09-30; el 17 y el 18 por» — candidata en 17f9702675: `D/nucleo/02-modelo-de-datos.md:193` «**Son ~~dieciocho~~ diecinueve** (el 19, la ventana del resumen de conciliación, desde el lote BK a BV del corte del MVP, owner 2026-10-02, BU: su valor lo fija el owner antes del merge de ~~`B11`~~ `B2`; ~~*con qué valo»
- línea 1634: `D/nucleo/02-modelo-de-datos.md:192` — texto en f80c0f2715: «**Son dieciocho** (FASE 9 vuelta 3: el 16 por el lote K, owner 2026-09-30; el 17 y el 18 por» — candidata en 17f9702675: `D/nucleo/02-modelo-de-datos.md:193` «**Son ~~dieciocho~~ diecinueve** (el 19, la ventana del resumen de conciliación, desde el lote BK a BV del corte del MVP, owner 2026-10-02, BU: su valor lo fija el owner antes del merge de ~~`B11`~~ `B2`; ~~*con qué valo»
- línea 1709: `D/nucleo/02-modelo-de-datos.md:250` — texto en f80c0f2715: «**Quién lo construye**: la tabla de plazos de cada mitad y la operación de cambiarlos, `V9` en» — candidata en 17f9702675: `D/nucleo/02-modelo-de-datos.md:251` «**Quién lo construye**: la tabla de plazos de cada mitad y la operación de cambiarlos, ~~`V9`~~ **`V6`** en»

## `03-contrato-de-cobertura.md`

### Citas sobre texto cambiado (reanclar.py, sin remapear)

- línea 93: `D/12-contrato-de-cobertura.md:79` — texto en f80c0f2715: «El capítulo 13 tiene abierta una pregunta grande: si el reloj de cobro es nuestro o del proveedor.» — candidata en 17f9702675: `D/12-contrato-de-cobertura.md:79` «~~El capítulo 13 tiene abierta una pregunta grande~~ El capítulo 13 de billing, que ya no existe, tenía abierta una pregunta grande: si el reloj de cobro es nuestro o del proveedor *(la cerró `DEC-MP-006`, abajo; residuo»
- línea 1494: `D/12-contrato-de-cobertura.md:1520` — texto en f80c0f2715: «del package**y en qué package vive cada implementación sigue siendo FASE 5 (`DEC-METH-003`).» — candidata en 17f9702675: `D/12-contrato-de-cobertura.md:1520` «del package** y en qué package vive cada implementación sigue siendo FASE 5 (`DEC-METH-003`).~~»
- línea 1696: `B/descomposicion.md:405` — texto en f80c0f2715: «es una dependencia más del camino de billing, no una flecha nueva del §3. La 10 es contra `V4`,» — candidata en 17f9702675: `B/descomposicion.md:405` «es una dependencia más del camino de billing, no una flecha nueva del §3.~~ **llega antes que `B10`: `V6` es del corte y `B10` de la Fase 3** (Z, AW; residuo corregido el 2026-10-02). La 10 es contra `V4`,»

### Secciones R17 sin citar asignadas

- `D/11-particion-del-programa.md:91–133` ## 3. La interfaz entre las dos épicas: un hecho y un aviso — §3 — por qué acá: D/11 §3 «un hecho y un aviso» es la interfaz que el contrato (`D/12`, consolidado en 03) fija en su §2 (el hecho) y §3 (el aviso); regla del orquestador de la pasada 2 (D/11 → 00-indice o 03-contrato) — **parcial** (17% del texto en la spec; sobre todo en `03-contrato-de-cobertura.md`): revisar qué falta
- `D/11-particion-del-programa.md:134–150` ### 3.1 El valor por defecto que hace posible construir sin billing — §3.1 — por qué acá: D/11 §3 «un hecho y un aviso» es la interfaz que el contrato (`D/12`, consolidado en 03) fija en su §2 (el hecho) y §3 (el aviso); regla del orquestador de la pasada 2 (D/11 → 00-indice o 03-contrato) — **contenido ausente** (4%)
- `D/11-particion-del-programa.md:151–168` ### 3.2 Lo que queda inactivo, declarado y no escondido — §3.2 — por qué acá: D/11 §3 «un hecho y un aviso» es la interfaz que el contrato (`D/12`, consolidado en 03) fija en su §2 (el hecho) y §3 (el aviso); regla del orquestador de la pasada 2 (D/11 → 00-indice o 03-contrato) — **contenido ausente** (1%)
