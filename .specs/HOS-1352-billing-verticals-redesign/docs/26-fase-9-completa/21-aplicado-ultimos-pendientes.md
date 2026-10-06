---
title: "FASE 9 completa · aplicado: los últimos pendientes fuera de carril de `18` y `19`"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa — últimos pendientes fuera de carril

Aplica a los capítulos de `V` (`HOS-1353`) y `B` (`HOS-1354`) las decisiones del owner (`10a`–`10e`,
sobre todo `10c`) y las citas fuera de carril que [`18`](./18-subspecs-verticales.md) §5 y
[`19`](./19-subspecs-billing.md) §6 habían dejado desalineadas. No se tocó el log, la matriz, el
PDR ni ningún informe `14`–`26`. No se commiteó.

## 1. Cambios aplicados

| archivo:línea | qué cierra | qué cambió |
|---|---|---|
| `V/docs/20-testing.md:59` (fila `G-R2-C`) | `18` §5, fila 2 | agregado *«Lo construye `B10`»*, con la decisión 10c, como pide la fila de `G-R5` |
| `V/docs/20-testing.md:355-356` | `18` §5, fila 1 | tachado *«qué unidad lo construye no está asignado»*; agregado que la descomposición lo propone para `B10` |
| `B/docs/20-testing.md` (tabla de conteo, filas *con unidad*/*sin unidad*) | `18` §5, fila 3 | `con unidad`: ~~30~~ **31** (agrega `G-R2-C`/`B10`); `sin unidad`: ~~1~~ **0** |
| `B/descomposicion.md` §2, fila `B10` (columna guards) | `18` §5, fila 4 | de `—` a **`G-R2-C`**, citando `V/descomposicion.md` §2.10 y la decisión 10c |
| `B/descomposicion.md` §4 (párrafo *«Los 29 30 31 guards…»*) | `18` §5, fila 5 | `13 en esta [épica]` → **14**; retirada la cláusula *«uno sin unidad… su unidad natural es `V3`»* |
| `V/descomposicion.md` §2.9 (párrafo *«no va a `B10`…»*, líneas ~405-408) | consistencia con 10c | tachada la condicional *«hasta entonces sigue sin unidad»*; ahora dice que el owner decidió `B10` |
| `V/descomposicion.md` §4 (párrafo *«Los 29 30 31 guards…»*, líneas ~448-453) | consistencia con 10c | `13` → **14** en la otra épica; retirada la condicional *«esta pasada lo propone… cuando `B/descomposicion.md` lo escriba»* |
| `V/descomposicion.md:193-195` | `19` §6, bullet 1 | tachada la cita de `B/descomposicion.md` §2.3 (*«lo único que arranca es B2…»*, ya tachada allá el 25/09); agregado el texto propuesto sobre `B/descomposicion.md` §3 |
| `V/docs/18-partner.md:191` (§2.1) | `18` §5, fila 6 | agregada la nota *«hoy diez, con el reembolso»* junto a *«es la novena»* |
| `B/docs/02-modelo-de-datos.md:939` (fila motivo 22) y `:909` (párrafo de conteo) | `19` §6, bullet 3 | agregado `S32` entre quienes abren la marca 22, junto a `S8`/`S9` (owner 2026-09-25, 4a); el conteo de `S14` (doce) no cambia — mismo motivo |
| `B/descomposicion.md` §6 (*«Lo que esta descomposición NO decide»*) | `19` §6, bullets 4 y 5 | dos bullets nuevos: `B/21` no es de ninguna unidad (su re-vinculación es de `B/09` §2.4, **B11**; el corte es del paraguas); `B/22` §2.2 (botón de arrepentimiento, `RF1` por revocación) sin unidad mientras esté fuera de alcance, con **B13** como unidad natural si el owner lo mete adentro — ambos marcados *«declarado por `DEC-METH-015`, FASE 9 completa»* |

## 2. Ya estaba aplicado (verificado, sin cambios)

Los tres puntos de `B/descomposicion.md` que pedía la tarea ya estaban en el texto antes de esta
pasada (aplicados por `13`/`15`/`17`), y se verificaron contra el archivo actual sin encontrar
divergencia:

- **B12**: *«el barrido del día invalida el caché de la vertical entera»* (`10` §4.3, owner
  2026-09-25, 6b, `DEC-ARCH-011`) — ya en la fila.
- **B13**: *«el botón de suscribirse manda a publicar a quien todavía no publicó en esa vertical»*
  (6c, `B/19` fila 21) — ya en la fila.
- **B4**: *«con los siete campos de la fuente (`cobrada` en una `SUSCRIPCIÓN`, `piso` en un
  `GRANT`: owner 2026-09-25, 9h)»* — ya en la fila.

## 3. No pude aplicar / fuera de mi carril

Ninguno. Todos los puntos pedidos caían en `V` o `B` (docs y descomposición), y ninguno tocaba el
log, la matriz, el PDR ni un informe `14`–`26`.

## 4. Recuentos de listas cerradas

```text
$ rg -n "G-R2-C" \
  HOS-1353-verticales-capacidades-y-autorizacion/{docs,descomposicion.md,spec.md} \
  HOS-1354-billing-cobro-y-proveedor/{docs,descomposicion.md,spec.md}
```

Resultado después de aplicar: **31 guards distintos, 31 con unidad, 0 sin unidad** (antes: 30 con
unidad, 1 sin unidad, `G-R2-C` huérfana); del lado de billing, **14** guards de esta épica (antes
13); del lado de verticales, **17** (sin cambio — `G-R2-C` es de billing, no suma acá). Ninguna otra
cita de *«30 con unidad»*, *«13 en esta épica»* o *«sin unidad: 1»* quedó fuera de los dos archivos
de conteo (`B/20` §2 y las dos `descomposicion.md`) al buscar sobre el árbol completo fuera de los
informes `14`–`26`.

`markdownlint-cli2` corrido sobre los seis archivos tocados: **0 issues**.

## 5. Citas fuera de mi carril, para el orquestador

Ninguna nueva. Las que `19` §6 ya señalaba como fuera de carril (los históricos con la cifra vieja
de la matriz: `04-open-decisions.md:156,326`, `10-evaluacion-de-proveedor.md:39-40`,
`03-handoff.md:1075,1262`) siguen sin tocar — son de `D`, prohibidos para este carril, y `19` ya
dijo que no piden corrección salvo que el orquestador quiera una nota.
