---
title: "Revisión del owner · aplicación del lote de casos vecinos al log y a la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · aplicación del lote de casos vecinos al log y a la matriz

El lote de [`23-aplicacion-casos-lote-k.md`](./23-aplicacion-casos-lote-k.md) §4 (4.1 los diecisiete
📌, 4.2 el `## Resumen`, 4.3 la matriz), escrito en `$D/01-decision-log.md` y
`$D/06-mp-validation-matrix.md` con el **OK del owner del 2026-09-29 al lote entero** («OK entero»).
Editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `a9910cd40f`, sin
commits. El log y la matriz no cambiaron entre `abafb960f0` (donde `23-` los grepeó) y ese HEAD. El
PDR no se tocó, ni los informes históricos. `D/01` es el log, `D/06` la matriz, `B/` es
`HOS-1354…/docs`, `$B/` y `$D/` las raíces.

**Antes de escribir** grepeé cada ID: existen los diecisiete `DEC` y `WH-6`; `EX-54` no existía (la
última `EX` era `EX-53`); *«casos vecinos»* no aparecía ni en el log ni en la matriz, así que
ninguna decisión tenía todavía un 📌 de éstos.

**Forma**, la de [`15-`](./15-aplicacion-log-y-matriz.md): los textos van exactos de `23-` §4.1, sin
las comillas de propuesta, sin la marca ✚ K y sin la *Razón*, que es la justificación ante el
owner y no parte del 📌 (`15-` tampoco la llevó); sólo cambió el ajuste de línea, al ancho de 100
del log. Cada 📌 va al final de su entrada, después de *Origen* o del último 📌, con la cabecera
*Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos)*; los que
traen una salvedad en `23-` (`DEC-DATA-005` y `DEC-ARCH-004`) la llevan en la cabecera, como `15-`
hizo con *sobre la implicación 5*. El *Estado* suma *precisada el 2026-09-29, con OK del owner
(revisión del owner, casos vecinos, casos; ver su 📌)* en las ocho que estaban en `ACCEPTED` a
secas, o *y precisada…* con *ver su último 📌* en las nueve que ya tenían precisiones. La raya larga
aparece sólo donde el formato del log ya la usa: la cadena de precisiones del *Estado*.

## 1. Qué se escribió

### 4.1 · los diecisiete 📌 y su *Estado*

Aplicado con un script sobre el archivo (`aplicar_log.py`, en el scratchpad de la sesión), que
extrae cada texto de `23-` §4.1 en vez de copiarlo a mano. **La primera pasada puso dos 📌 en una
entrada ajena** (ver § 4, punto 1): se restauró el log y se volvió a aplicar.

| `23-` §4.1 | decisión | *Estado* | 📌 |
|---|---|---|---|
| 1 | `DEC-MIG-006` | línea 6392 | `D/01:6414` «casos vecinos, casos 5 y 6): En el paso 0 se toman dos» |
| 2 | `DEC-DATA-006` | línea 6424 | `D/01:6441` «casos vecinos, casos 12, F-A y H-E): Todo fin de la pausa, por cualquier» |
| 3 | `DEC-DATA-007` | línea 6454 | `D/01:6473` «casos vecinos, casos 13, 14, 15 y H-G): Una ficha moderada desde `ARCHIVED` vuelve por» |
| 4 | `DEC-ARCH-012` | línea 6566 | `D/01:6592` «casos vecinos, casos 8, 9, 19, 41, F-B, F-D, H-A, H-B, I-D, J-B y K-B): El tipo de partner se renombra a» |
| 5 | `DEC-ARCH-013` | línea 6621 | `D/01:6648` «casos vecinos, casos 9, 42, 43 y 49): Las 11 migraciones de datos del seed» |
| 6 | `DEC-DATA-005` | línea 5774 | `D/01:5819` «I-C corrige la elección de H-C): La lista de pasos de la baja» |
| 7 | `DEC-ENT-002` | línea 610 | `D/01:639` «casos vecinos, casos 10 y 11): Con más de un título vivo ancla» |
| 8 | `DEC-TEST-001` | línea 4246 | `D/01:4401` «casos vecinos, casos 16 y 48): `G-R6-B` suma una tercera mitad: un lector» |
| 9 | `DEC-ARCH-007` | línea 2490 | `D/01:2545` «casos vecinos, casos 3 y 4): `rollout` queda cerrado: las ramas son el» |
| 10 | `DEC-SUB-023` | línea 6484 | `D/01:6508` «casos vecinos, casos 20 a 27, G-A, I-A e I-B): `S37` muta el monto siete días antes» |
| 11 | `DEC-SUB-008` | línea 1238 | `D/01:1292` «casos vecinos, casos 37, G-A, I-A e I-B): El descenso programado lo aplica `S38`, la» |
| 12 | `DEC-ARCH-004` | línea 2186 | `D/01:2285` «casos vecinos, caso 30, contra la recomendación): El package del cobro es un package» |
| 13 | `DEC-TEST-003` | línea 6527 | `D/01:6549` «casos vecinos, casos 28, 31, 32, 33, 35 y G-C): La segunda lista del falso lleva también» |
| 14 | `DEC-DATA-008` | línea 6662 | `D/01:6691` «casos vecinos, casos 43, 44, 45, 46, 47, 50 y H-F): Configurar el 90 y el 180, que» |
| 15 | `DEC-RF-008` | línea 6126 | `D/01:6169` «casos vecinos, casos F-C, H-D e I-C): Las acciones administrativas pasan de veintiuna a» |
| 16 | `DEC-AUTH-003` | línea 6365 | `D/01:6384` «casos vecinos, caso F-C): El» |
| 17 | `DEC-ARCH-006` | línea 2372 | `D/01:2478` «casos vecinos, casos G-B, I-E, J-A y K-C): El package del contrato tiene una quinta» |

Las ocho que suman a la cifra, con el *Estado* que tenían en `ACCEPTED` a secas:

- `D/01:6392` «Estado: ACCEPTED — precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 5 y 6; ver su 📌)»
- `D/01:6662` «Estado: ACCEPTED — precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 43, 44, 45, 46, 47, 50 y H-F; ver su 📌)»

Y una de las nueve que ya estaban contadas, con la forma *y precisada…*:

- `D/01:610` «y precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 10 y 11; ver su último 📌)»

El texto del §25 que cita el 📌 de `DEC-DATA-008` se verificó contra el PDR antes de escribirlo
(regla 5 del log): el §25 tiene sus apartados *Día 90* y *Día 180*.

### 4.2 · el `## Resumen`

Con el estilo tachado de las cifras anteriores, y una fila nueva al pie, como `15-`. En la fila de
apartamientos, el *«serían 10 si el owner declara…»* se tachó en lugar de borrarse.

| `23-` §4.2 | fila | dónde |
|---|---|---|
| 18 | apartamientos del PDR | `D/01:6720` «~~8~~ ~~9~~ 10» |
| 18 | la nota que sale | `D/01:6720` «~~; serían 10 si el owner declara el del §25 por los plazos configurables, `DEC-DATA-008`~~» |
| 18 | la nota que entra | `D/01:6720` «2026-09-29: suma `DEC-DATA-008`, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos vecinos, caso 46)» |
| 19 | precisadas sin `SUPERSEDED` | `D/01:6711` «~~47~~ ~~58~~ 66» |
| 19 | el recuento | `D/01:6711` «y recontado con script el 2026-09-29, tras los diecisiete 📌 de los casos vecinos de la revisión del owner» |
| 19 | la lista | `D/01:6711` «y desde el 2026-09-29 (revisión del owner, casos vecinos): `DEC-MIG-006`» |
| 20 | la fila nueva | `D/01:6724` «0 nuevas, 17 📌, 0 `SUPERSEDED`, del 2026-09-29, sobre los 76 casos vecinos decididos» |

La fila nueva suma, detrás del texto de §4.2 punto 20, dónde está el lote y este registro, como
hace la fila de la revisión del owner con `15-`.

### 4.3 · la matriz

`EX-54` va al final de la tabla de `EX-50`, debajo de `EX-53`, con la forma de esa fila (celdas de
fecha, entorno y evidencia en guion). En su columna de lo que toca nombra `DEC-SUB-023`, la decisión
de la migración de un plan retirado, junto al `B/10` §3.7 punto 4 que cita `23-`. El 📌 de `WH-6` va
al final de su conclusión, con la forma de los 📌 de celda de la matriz; su estado no cambia.

| `23-` §4.3 | fila | dónde |
|---|---|---|
| 21 | `EX-54`, `UNKNOWN` | `D/06:411` «¿Qué correo le manda el proveedor al pagador cuando le SUBIMOS el monto de un preapproval» |
| 22 | el 📌 de `WH-6` | `D/06:270` «Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 39 y G-D)» |
| encabezado | recuento | `D/06:17` «Recontado el 2026-09-29 tras los casos vecinos de la revisión del owner (abrir `EX-54`, caso 34)» |
| resumen | `UNKNOWN` | `D/06:445` «entró `EX-54` el 2026-09-29 (revisión del owner, casos vecinos, caso 34)» |
| resumen | pie | `D/06:450` «tras los casos vecinos de la revisión del owner: 55 · 17 · 23 · 17» |

## 2. Las cifras, recontadas

Todas coinciden con `23-` §4.4; ninguna se forzó.

| qué | cifra | comando (desde `$D`) |
|---|---|---|
| decisiones | **134** (ninguna nueva) | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` |
| precisadas sin `SUPERSEDED` | **66** (eran 58) | `python3 …/scratchpad/verif-v2/contar-precisadas.py 01-decision-log.md` |
| `SUPERSEDED` en su *Estado* | **11** | `rg -c "\*\*Estado\*\*.*SUPERSEDED" 01-decision-log.md` |
| 📌 de los casos vecinos | **17** en el log y **1** en la matriz | `rg -c "📌 \*\*Precisada el 2026-09-29, con OK del owner \(revisión del owner, casos vecinos"` |
| apartamientos del PDR | **10** | a mano: los nueve de antes más `DEC-DATA-008` |
| filas de la matriz | **112**: 55 · 17 · 23 · 17 | `python3 contar-filas-de-la-matriz.py` |

Las `UNKNOWN`, según el script: `PA-6`, `GR-2`, `WH-6`, `RC-8`, `RF-3`, `EX-42` a `EX-50`, `EX-52`,
`EX-53` y `EX-54`, las mismas que lista `23-` §4.4.

## 3. Espejos de las cifras en el texto vivo

Los que lista `15-` §3 para una fila nueva de la matriz, marcados *(revisión del owner, casos
vecinos, 2026-09-29, caso 34)*. Las cifras del log (134 decisiones) no se movieron, así que sus
espejos (`spec.md` del paraguas, `nucleo/00`) quedan como estaban. Buscados también *111* y
*dieciséis `UNKNOWN`* en el resto de las specs: no hay otro espejo vivo fuera de `03-handoff.md`
(ver § 4).

| espejo | dónde |
|---|---|
| la matriz en la tabla de documentos | `.specs/HOS-1352-billing-verticals-redesign/spec.md:85` «~~111~~ 112 filas, ~~92~~ ~~93~~ ~~94~~ 95 cerradas» |
| la FASE 1C en la tabla de fases | `.specs/HOS-1352-billing-verticals-redesign/spec.md:137` «29/09, recontado con el script tras los casos vecinos de la revisión del owner: entró `EX-54`» |
| el recuento de la matriz de billing | `$B/spec.md:257` «`EX-54` entró el 29/09» |
| el capítulo del proveedor | `B/06:28` «quedan diecisiete `UNKNOWN` y dieciséis son de este capítulo» |
| lo que sigue `UNKNOWN` | `B/06:408` «Doce de las diecisiete filas de 112» |
| el encabezado de §2.7 | `$B/descomposicion.md:401` «~~doce~~ trece filas `UNKNOWN`» |
| las cifras de §2.7 | `$B/descomposicion.md:404` «~~111~~ 112 filas de la matriz» |
| la unidad de `EX-54` | `$B/descomposicion.md:425` «B12 (la migración de un plan retirado, `S37`)» |

**La unidad de `EX-54` es `B12`** porque `S37`, la transición que aplica la migración de un plan
retirado, es de `B12` (`$B/descomposicion.md:149`, *`S37` → B12*), y el correo que la fila mide es
el tercero de esa migración. La fila no dice que bloquee ni que no bloquee: `23-` no lo dice, y no
lo agregué.

## 4. Lo que queda afuera

1. **Un error de la primera pasada, corregido.** El script buscaba el final de cada entrada en el
   separador `---`, y las entradas viejas del log no lo llevan entre sí: los 📌 de `DEC-ENT-002` y
   `DEC-SUB-008` cayeron al final de `DEC-OBS-001`. Se restauró el log desde la copia previa, el
   final de entrada pasó a ser el siguiente separador `---` o encabezado de nivel 2 o 3, y se verificó que cada uno de
   los diecisiete 📌 queda debajo del encabezado de su decisión.
2. **`DEC-DATA-008` conserva su campo *Sin decidir*** (`D/01:6684`), que dice que el apartamiento
   del §25 lo decide el owner y que *«no se suma al `## Resumen`»*. Su 📌 lo cierra y
   el `## Resumen` ya lo suma, pero el campo no se tachó, y la entrada no tiene el campo
   *Apartamiento del PDR, declarado* que sí tiene `DEC-ARCH-012`. `23-` no lo pide; es una
   decisión de forma para el owner (tachar el campo y sumar el de apartamiento, o dejarlo como
   está porque el 📌 manda).
3. **`03-handoff.md` quedó desactualizado** (`$D/03-handoff.md:83`, *«precisadas sin SUPERSEDED
   58»* y la matriz en 111 con 16 `UNKNOWN`). Lo actualiza el owner, como dice `15-` §3.
4. **`B/10` §3.7 punto 4** (`B/10:185`) sigue diciendo que la subida *«pide una fila propia de la
   matriz (caso 34)»*: la fila ya existe y se llama `EX-54`. No está en los espejos de `15-` §3 y
   no lo toqué.
5. **`EX-54` no tiene fila en la tabla de `B/06` §11 ni en la de `$B/spec.md`**, como `EX-52`,
   `EX-53` y `WH-6`: las dos lo dicen junto a la cifra. Darle *qué bloquea* y *cuándo se contesta*
   es diseño que `23-` no trae.
6. **`## Qué espera cada decisión` de la matriz** no nombra `EX-54` (`DEC-SUB-023` la usa para el
   tercer correo). No es una cifra y no lo toqué, como `15-` § 4 con `EX-52` y `EX-53`.

## Key Learnings

1. Un script que ubica el final de una entrada del log por su separador falla en las entradas
   viejas, que no lo tienen: el final es el siguiente separador **o** el siguiente encabezado, y
   después de insertar hay que verificar a qué encabezado quedó colgado cada 📌.
2. Extraer los textos del lote con el script, en vez de copiarlos, deja el diff de contenido en
   cero por construcción; lo único que queda por revisar a mano es dónde cayeron.
3. Un espejo de una cifra de la matriz puede ser prosa con dos cifras que se mueven juntas
   (*«dieciséis `UNKNOWN` y quince son de este capítulo»*): hay que recontar las dos, no sólo la
   que se buscó.
