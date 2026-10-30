---
title: "FASE 9 completa · aplicado: `GR-1` medida en producción"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 completa — `GR-1` medida

Registra el cierre de `GR-1` (decisión 10e del owner: *«intentemos medirlo»*) y su propagación a
la matriz, el log (sólo 📌 de registro, sin reabrir decisiones), los capítulos, las sub-specs, el
spec del paraguas, el handoff y el worklog. No se tocó el PDR ni ningún informe `14`–`26` fuera de
este archivo. No se commiteó.

## 1. El hecho

**Medido** (producción, sólo `GET`, 2026-09-26 04:33 UTC,
`mp-probes/probe-49-la-ventana-de-reintentos.mjs leer` con
`MANIFIESTO=$HOME/.hos1352-sonda-49-c.json`): sonda 49, preapproval `f0be57a1…`, ciclo de 2 días,
ARS 15. El registro de cobro del 2026-09-24 18:02 `-04`, que estaba `rejected`
(`cc_rejected_high_risk` y después `payment_method_not_ready`, `retry=3`), pasó a
**`approved/accredited` con `retry=4`**, `last_charged_date` 2026-09-26T00:31:45 `-04`,
`charged_amount` 15 → 30, `expire` 2026-09-26 18:02 `-04`. **Es el mismo registro, no uno nuevo.**

**Informado por el owner** (2026-09-26 01:34 `-03`, no leído de la API): cambió el medio de pago
desde su cuenta de MP alrededor de las 01:30 `-03` (= 00:30 `-04`).

**Lectura**: un pago que entra dentro de la ventana de reintentos cierra el ciclo fallido, y
cambiar el medio de pago durante la ventana **dispara un reintento inmediato** (≈1-2 min después),
que cobra con el medio nuevo. El reintento cayó **fuera del patrón de lotes al minuto :02**
(`RN-1`). **Borde**: la hora del cambio es del owner y es **una sola muestra**, sobre un ciclo de
2 días.

## 2. Cambios aplicados

| archivo | qué cambió |
|---|---|
| `06-mp-validation-matrix.md` encabezado | tachado el recuento 55 · 15 · 23 · 5; nuevo **56 · 15 · 23 · 4** (2026-09-26); `updated` → 2026-09-26 |
| `06` fila `GR-1` | `UNKNOWN` → **`VERIFIED`**, fecha, entorno y evidencia; 📌 con el hecho, la observación del :02 marcada como observación; tachada *«Hasta entonces la superficie del grace no lo promete»* |
| `06` Resumen | `VERIFIED` ~~55~~ **56** (con `GR-1`); `UNKNOWN` ~~5~~ **4**; tachado *«`GR-1` y `GR-2` esperan…»*; párrafo de recálculo con fecha 2026-09-26 |
| `06` tabla de dependencias | fila `DEC-SUB-021`: tachada *«condicionada»*, `GR-1` ✅ |
| `01-decision-log.md` `DEC-SUB-021` | puntero en *Estado* y 📌 **«cerrada 2026-09-26: `GR-1` `VERIFIED`, la salida *cambiá la tarjeta* deja de estar condicionada»**, que levanta el punto 1 de la precisión 3a; el contenido no se editó |
| `01` Resumen | *Decisiones condicionadas a FASE 1C* ~~2~~ **1** (tachada la de `DEC-SUB-021`). `DEC-MP-008` y `DEC-SUB-003` no condicionan a `GR-1` como salida: no se tocaron |
| `B/12` §1.5 (punto 1, párrafo final) y lista de pendientes | tachado *«condicionada a `GR-1`… no prometen…»*; ahora: medida, la pantalla puede decir que al cambiar la tarjeta se reintenta el cobro; el borde de la hora queda |
| `B/20` | tachado *«condicionado a `GR-1`»*; medido |
| `B/09` §8 | tachado *«Siguen `UNKNOWN` `RN-3`, `GR-1` y `GR-2`»*; sigue `GR-2` |
| `B/19` §4 filas 9 y 17-bis | tachada la frase que no prometía; la nueva dice que al cambiar la tarjeta se reintenta en el momento, con fecha de fin del grace y el borde |
| `B/03` (tabla `GRACE_PERIOD` y párrafo del tercer caso) | tachada la condición; *«la pantalla lo dice»* |
| `B/06` §11 | ~~Seis~~ **Cuatro filas de 98**; fila `GR-1` ✅ `VERIFIED`; ~~Cuatro de las seis~~ **Dos de las cuatro** son un cobro que falla (`GR-2`, `PA-6`) |
| `nucleo/07` fila *cobro fallido / grace* | tachado *«ninguno promete…»*; los correos dicen que al cambiar la tarjeta se reintenta |
| `B/descomposicion.md` | B13 (fila y criterio), recuento ~~55~~ 56 · ~~5~~ 4, fila de grace, y el párrafo del §61 que era el criterio de B7: tachado *«lo que condicionan… `GR-1`, 3a»*; la pregunta del §61 queda abierta para `GR-2` |
| `B/spec.md` §5.2 y lista de pasos | ~~seis~~ **cuatro** filas; recuento; fila `GR-1` tachada con el estado nuevo; paso 2 *«Medir `GR-1`»* tachado, hecho |
| `spec.md` del paraguas | ~~93~~ **94 cerradas**, ~~5~~ **4 `UNKNOWN`** (dos citas); el camino del cobro fallido queda en `GR-2` y `PA-6` |
| `03-handoff.md` §*Última actualización: 2026-09-25, noche* | paso *«Medir `GR-1`»* tachado con ✅; conteos ~~55~~ 56 · ~~5~~ 4 |
| `02-worklog.md` entrada 25/09 noche | una línea 📌 con la lectura y el recuento |

## 3. Recuento

```text
$ python3 contar-filas-de-la-matriz.py
filas contadas: 98
  VERIFIED                56
  PARTIALLY_SUPPORTED     15
  NOT_SUPPORTED           23
  UNKNOWN                  4
sin cerrar (UNKNOWN): PA-6, GR-2, RC-8, RF-3
```

## 4. Lo que no se hizo

- Los informes `14`–`26` y las secciones históricas del handoff conservan sus conteos: son foto de
  su fecha.
- `B/06` §11 y `B/spec.md` §5.2 todavía listan `RN-3` en su tabla (cerró el 25/09 noche, antes de
  esta pasada); sólo se corrigió el conteo.
- La hora exacta del cambio de medio no está leída de la API: si el owner la confirma con precisión,
  va como 📌 en la fila `GR-1`.
