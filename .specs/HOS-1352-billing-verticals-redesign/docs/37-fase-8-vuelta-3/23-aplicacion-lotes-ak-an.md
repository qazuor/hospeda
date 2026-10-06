---
title: "FASE 9 vuelta 3 · aplicación — lotes AK a AN"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación: los lotes AK a AN

Aplica las filas AK a AN de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md), que
contestan las tres preguntas abiertas y las propuestas del §5 de
[`22-aplicacion-verificacion.md`](./22-aplicacion-verificacion.md). Un solo agente, con permiso
sobre `$V/*`, `$B/*`, `$D/nucleo/*`, el contrato y `16-`, y, por el lote AN, sobre el log y la
matriz en lo que AN dice. Medido en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin
commits. El origen de cada enmienda es `(FASE 9 vuelta 3, owner 2026-09-30, lote XX)`.

## 1. Qué se aplicó

### AK: `RF3` sobre una orden cuya relectura no trae el id de la devolución

- La fila de `RF3` en `B/03` §6.1: se tacha la pregunta abierta y entra la regla.
  `B/03:1852` «toma la devolución de la orden de su mismo monto**»
- Dos del mismo monto en la misma orden.
  `B/03:1852` «Con dos devoluciones del mismo monto en la misma orden, decide una persona»
- La medición que se suma a `EX-58`.
  `B/03:1852` «mide también si la relectura trae el monto de cada devolución»
- `B/06` §3.2, lo que no está medido de la devolución de una orden.
  `B/06:133` «orden trae el id y el monto de cada devolución»
- El criterio de `B6`, que ya no espera la pregunta.
  `$B/descomposicion.md:685` «la fila toma la devolución de la orden de su mismo monto y llega a»
- Su columna de qué mide.
  `$B/descomposicion.md:685` «y su monto**»
- `B/09` no tenía la marca: la pregunta sólo quedó en `B/03` §6.1 y en el criterio de `B6`
  (`rg` por `VC3-cobro-07`, `EX-58` y «no nombra el id» sobre `$B`).

### AL: la carga del catálogo en toda base que aplique las migraciones

- `16-` §4.2, paso 6: se tacha la pregunta y entra la regla del seed.
  `D/16:145` «el seed de demostración no carga catálogo donde ya hay uno»
- `NUCLEO/02` §1.4, junto a los datos de demostración fuera del dual-write.
  `nucleo/02:131` «Y el seed de demostración no carga catálogo en una base que ya»
- El criterio, en la fila del catálogo de `$V/descomposicion.md`, con su unidad.
  `$V/descomposicion.md:487` «el seed de demostración (`V2`), corrido»
- `V/21` §2.4 no tenía la pregunta (habla de producción) y no se tocó; tampoco
  `$B/descomposicion.md` ni `B/21` (`rg` por «desarrollo y en CI» y `VC3-VT-07` sobre los tres
  árboles).

### AM: `MP6` sobre una `ABANDONED` de pagador manual con la primera cuota impaga

- La fila de `MP6` en `B/03` §7.
  `B/03:1876` «Lo mismo sobre una `ABANDONED` de pagador manual»
- El NO cierra de `B/03`.
  `B/03:3053` «y lo mismo sobre una `ABANDONED` de pagador manual con la primera cuota»
- Quién abre el motivo 2 en `B/02` §2.5.
  `B/02:1018` «o sobre una `ABANDONED` de pagador manual con la primera cuota»
- El criterio de `B5`.
  `$B/descomposicion.md:690` «y lo mismo sobre una `ABANDONED` de pagador manual con la primera cuota»
- No había marca de pregunta abierta en el diseño: la pregunta vivía sólo en el registro `22-`.

### AN: el log y la matriz

- `DEC-ARCH-006`, su Estado.
  `D/01:2414` «precisada otra vez el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lote AE»
- `DEC-ARCH-006`, el 📌 nuevo.
  `D/01:2553` «contesta `sí` mientras no pase el plazo 16»
- `DEC-AUTH-005`, su Estado.
  `D/01:6574` «precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes AI y AJ»
- `DEC-AUTH-005`, el 📌 nuevo (AJ, contra la recomendación).
  `D/01:6599` «verificar el correo antes de postular»
- El mismo 📌, la acción 24 (AI).
  `D/01:6601` «de `NUCLEO/08` §3 a pedido de quien la escribió»
- El resumen, fila de metodología.
  `D/01:7100` «doce, de `DEC-METH-005` a `-016`»
- El resumen, precisadas sin `SUPERSEDED` (arrastre: `DEC-AUTH-005` deja de estar en `ACCEPTED` a
  secas).
  `D/01:7102` «~~**69**~~ **70**»
- La matriz, `EX-45`, la columna de para qué.
  `D/06:402` «y el criterio de exención del barrido y `S16`, con la ventana del plazo 16»
- La matriz, `EX-58`, la pregunta.
  `D/06:415` «¿Y trae el monto de cada una?»
- La matriz, `EX-58`, la columna de para qué.
  `D/06:415` «y la rama de `RF3` sobre una orden cuya relectura no trae el id»

## 2. Lo que no se aplicó y por qué

- Nada de AK a AN quedó sin aplicar.
- **Una derivación marcada**: AK dice qué pasa sin id y con dos del mismo monto; no dice qué pasa
  si `EX-58` da que la relectura tampoco trae el monto. Escribí que la fila queda para una
  persona, igual que con dos del mismo monto (`B/03:1852`, `$B/descomposicion.md:685`), porque sin
  id ni monto la regla de AK no tiene con qué comparar y es el único camino que ya existe (el de
  `RF2` cuando ningún reintento entra). No es mecanismo nuevo; si el owner lo lee de otra forma,
  es una frase.
- La columna de la pregunta de `EX-58` suma el monto: AN dice «para qué», pero una medición nueva
  sin su pregunta en la columna de la pregunta no se mediría. Lo marqué con su origen.

## 3. Conteos recontados

| lista | viejo → nuevo | comando | espejos actualizados |
|---|---|---|---|
| decisiones del log | 139, sin cambio | `rg -o "^### DEC-[A-Z]+-\d+" $D/01-decision-log.md \| sort -u \| wc -l` | ninguno |
| decisiones de metodología | 15 → 16 (123 + 16 = 139) | `rg -c "^### DEC-METH-" $D/01-decision-log.md` (16) | la fila de metodología del resumen; el `spec.md` del paraguas ya decía 16 |
| precisadas sin `SUPERSEDED` | 69 → 70 | `python3`: bloques `### DEC-`, campo *Estado* hasta *Decide*, con precisada/recontada/enmendada/cerrada y sin `SUPERSEDED` | la fila del resumen: cifra, recuento y lista |
| filas de la matriz | 117, sin cambio (61 · 16 · 24 · 16) | `cd $D && python3 contar-filas-de-la-matriz.py` | ninguno |
| motivos de `B/02` §2.5 | 24, sin cambio (el 2 suma una fuente) | `rg` | ninguno |

## 4. Para otro grupo

Ninguno: trabajé solo sobre los árboles, el log y la matriz.

## 5. Propuestas para el log y la matriz

Ninguna: lo que pedía AN está aplicado (§1). No hace falta 📌 por AK, AL ni AM: AK queda en
`EX-58`; AL precisa algo que `DEC-ARCH-013` no escribe (dónde corre la carga fuera de
producción) y es de implementación; AM es la regla de AF, que no tiene `DEC` propia.

## 6. Preguntas abiertas

Ninguna.

## 7. Casos vecinos

1. **El handoff (`03-handoff.md:446`) dice todavía *«15 de metodología»*.** Es de otra sesión y no
   lo toco; el `spec.md` del paraguas ya dice 16.
2. **El seed de demostración mira «si ya hay catálogo» por la tabla entera**: una base de
   desarrollo armada antes del merge de la migración del paso 3 tiene el catálogo de demostración
   y la migración le carga encima el de producción. No lo alcanza AL, que habla del seed; la
   carga de la migración choca o no según sus claves, y es de implementación de `V2`.

## Key Learnings

1. Una pregunta abierta que el registro dice haber dejado en «`B/03`/`B/09`» se busca por su id de
   origen y por su frase en todo el árbol: acá estaba en `B/03` y en el criterio de `B6`, no en
   `B/09`.
2. Precisar una decisión nacida sin precisar mueve también el recuento de precisadas del resumen,
   aunque el pedido sólo nombre la suma de decisiones: se recuenta con script sobre el *Estado*.
3. Una medición nueva pedida en el «para qué» de una fila de la matriz necesita también su lugar
   en la columna de la pregunta, o nadie la mide.
