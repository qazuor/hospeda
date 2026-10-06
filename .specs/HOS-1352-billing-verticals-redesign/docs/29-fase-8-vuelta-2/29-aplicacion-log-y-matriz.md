---
title: "FASE 9 vuelta 2 · aplicación del lote del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación del lote del log y la matriz

Las decisiones `V2-y` y `V2-z1` a `V2-z5` de
[`24-decisiones-del-owner-verificacion.md`](./24-decisiones-del-owner-verificacion.md), la sección
*«El lote del log y la matriz, y los últimos casos vecinos (2026-09-28)»*. `V2-y` aprueba en un lote
lo que propuso [`28-aplicacion-verificacion-cierre.md`](./28-aplicacion-verificacion-cierre.md) §6:
los quince 📌 del log y las filas `EX-48`, `EX-49` y `EX-50` de la matriz. Medido y editado en el
worktree `hospeda-spec-hos-1352-billing-redesign` sobre HEAD `348ee0222d`, sin commits.

**Excepción a las reglas comunes**, con OK explícito del owner (2026-09-28, `V2-y`): este tramo sí
edita `$D/01-decision-log.md` y `$D/06-mp-validation-matrix.md`. El PDR no se tocó. `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/01` es el log, `D/06` la matriz y `D/16` la FASE 7
del paraguas.

## 1. Qué se aplicó

### `V2-y` · el log: quince 📌 y quince *Estado*

Antes de tocar nada grepeé los quince IDs en el log: ninguno tenía un 📌 ni un *Estado* con `V2-`,
y los encabezados estaban en las líneas que `28-` §6 citaba sobre `18077a6d41` (no se movió
ninguno). Los textos van **exactos** de `28-` §6: un script los extrajo de ese § y comparó, con los
espacios colapsados, que cada 📌 y cada fragmento de *Estado* aparece una sola vez en el log (15 de
15, y 15 de 15). Sólo cambió el ajuste de línea, al ancho de 100 del log.

**Dónde va cada 📌.** Después del último 📌 de la entrada, con su sangría. Tres casos:

- `DEC-MIG-003`: su tercer 📌 vive dentro del punto *«El orden del corte»*, como sub-viñeta; el
  cuarto va ahí, con la misma sangría.
- `DEC-ADDON-002`: su 📌 vive dentro de la implicación 6, sin viñeta; el segundo va a continuación,
  igual.
- `DEC-RF-001`, `DEC-TEST-001` y las tres sin 📌 (`DEC-RF-003`, `DEC-RF-004`, `DEC-OBS-001`): al
  final de la entrada, después de *Origen*, como el 📌 de `DEC-MIG-005`. En `DEC-RF-001` el 📌 de la
  parte 1 está dentro de la parte 1, pero después vienen los de las partes 3 y 4; ponerlo al final
  hace verdadero el *«ver su último 📌»* de su *Estado*, y el texto se sostiene solo.

**El separador del *Estado*.** El de cada entrada: la raya larga en catorce, y la coma en `DEC-MIG-003`,
cuyo *Estado* encadena sus precisiones con coma. Es la raya que el log ya usa entre precisiones, no
prosa nueva; es la única raya larga de este tramo, y la dejo declarada.

| # | entrada | qué | dónde |
|---|---|---|---|
| 1 | `DEC-MIG-005` | *Estado* | `D/01:5884` «y precisada otra vez con OK del owner (FASE 9 vuelta 2, verificación: `V2-a` el 2026-09-27, `V2-m` y `V2-r`» |
| 1 | `DEC-MIG-005` | 📌 | `D/01:5961` «Precisado con OK del owner (FASE 9 vuelta 2, verificación: `V2-a` el 2026-09-27; `V2-m` y `V2-r`» |
| 2 | `DEC-MIG-003` | *Estado* | `D/01:2745` «y el paso 4c, precisado el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-t`: la página» |
| 2 | `DEC-MIG-003` | 📌 | `D/01:2848` «Precisado el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-t`): el paso 4c» |
| 3 | `DEC-SUB-009` | *Estado* | `D/01:1254` «y precisada otra vez el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-b`: la baja desde» |
| 3 | `DEC-SUB-009` | 📌 | `D/01:1303` «Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-b`): la baja desde» |
| 4 | `DEC-ADDON-002` | *Estado* | `D/01:1942` «y precisada otra vez el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d` y `V2-e`» |
| 4 | `DEC-ADDON-002` | 📌 | `D/01:2025` «Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d` y `V2-e`)» |
| 5 | `DEC-SUB-019` | *Estado* | `D/01:5406` «y precisada otra vez el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-q`: la marca 22» |
| 5 | `DEC-SUB-019` | 📌 | `D/01:5468` «Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-q`): si el complemento» |
| 6 | `DEC-RF-001` | *Estado* | `D/01:1637` «y la parte 1 precisada otra vez el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`» |
| 6 | `DEC-RF-001` | 📌 | `D/01:1722` «Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`): cuando `S36` corre» |
| 7 | `DEC-RF-003` | *Estado* | `D/01:4046` «precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`: tras `S36` la rama 6 no» |
| 7 | `DEC-RF-003` | 📌 | `D/01:4077` «Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`): tras `S36`, la» |
| 8 | `DEC-RF-004` | *Estado* | `D/01:4730` «precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-n`: `S12`-vía-`S26` pasa al lado que devuelve» |
| 8 | `DEC-RF-004` | 📌 | `D/01:4816` «Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-n`): la ampliación parte» |
| 9 | `DEC-RF-006` | *Estado* | `D/01:5033` «y precisada otra vez con OK del owner (FASE 9 vuelta 2, verificación: `V2-d` el 2026-09-27, `V2-n` y `V2-p`» |
| 9 | `DEC-RF-006` | 📌 | `D/01:5104` «Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-d` el 2026-09-27; `V2-n` y `V2-p`» |
| 10 | `DEC-OBS-001` | *Estado* | `D/01:2077` «precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-f` el 2026-09-27, `V2-s` el 2026-09-28: el cobro por» |
| 10 | `DEC-OBS-001` | 📌 | `D/01:2113` «Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-f` el 2026-09-27; `V2-s` el 2026-09-28)» |
| 11 | `DEC-TRIAL-004` | *Estado* | `D/01:431` «y precisada otra vez el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`, `V2-v`» |
| 11 | `DEC-TRIAL-004` | 📌 | `D/01:467` «Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`, `V2-v`» |
| 12 | `DEC-ARCH-011` | *Estado* | `D/01:6129` «y precisada otra vez el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y `V2-i`» |
| 12 | `DEC-ARCH-011` | 📌 | `D/01:6168` «Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y `V2-i`)» |
| 13 | `DEC-ARCH-006` | *Estado* | `D/01:2293` «y precisada otra vez el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `N-B-03` confirmado por `V2-x`» |
| 13 | `DEC-ARCH-006` | 📌 | `D/01:2390` «Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-x` sobre `N-B-03`): `PB9`» |
| 14 | `DEC-TEST-001` | *Estado* | `D/01:4135` «y enmendada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-k`, con su unidad confirmada el» |
| 14 | `DEC-TEST-001` | 📌 | `D/01:4282` «Enmendada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-k`): `G-R9` vigila la» |
| 15 | `DEC-DATA-005` | *Estado* | `D/01:5644` «y precisada otra vez con OK del owner (FASE 9 vuelta 2, verificación: `V2-l` el 2026-09-27, `V2-x` el 2026-09-28» |
| 15 | `DEC-DATA-005` | 📌 | `D/01:5682` «Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-l` el 2026-09-27; `V2-x` el 2026-09-28)» |

**El resumen del log.** La celda de *Precisadas sin `SUPERSEDED`* pasa de 44 a **47**, con el 44
tachado como los anteriores, la frase del recuento y los tres nombres en la lista de *«con 📌 o
puntero del owner»*:

- `D/01:6226` «~~44~~ 47»
- `D/01:6226` «suman `DEC-OBS-001`, `DEC-RF-003` y `DEC-RF-004`, que tenían el Estado en `ACCEPTED` a secas»
- `D/01:6226` «y desde el 2026-09-28 (FASE 9 vuelta 2, verificación, `V2-y`)»

### `V2-y` y `V2-z4` · la matriz: `EX-48`, `EX-49` y `EX-50`

Las tres van después de `EX-47`. `EX-48` y `EX-49` con el texto de `28-` §6. **`EX-50` acortada
según `V2-z4`**: la pregunta es sólo cuántas anuales del viejo siguen vivas; el `expire_date` pasa a
la conclusión como algo que se mide ahí si hay alguna.

- `D/06:404` «Leído por id el pago que aprobó un registro de cobro»
- `D/06:405` «¿Qué variantes de un correo entregan en la misma casilla, por proveedor?»
- `D/06:406` «¿Cuántas suscripciones del sistema viejo con ciclo anual (`frequency: 12`, `frequency_type: months`) siguen vivas el día del corte?»
- La conclusión acortada: `D/06:406` «Si hay alguna, el `expire_date` del registro de cobro abierto de cada una se mide ahí»
- El encabezado: `D/06:17` «Recontado el 2026-09-28 tras abrir `EX-48` a `EX-50`»
- El resumen, fila `UNKNOWN`: `D/06:440` «entraron tres el 2026-09-28: `EX-48` a `EX-50`»
- La línea del script: `D/06:445` «tras abrir `EX-48` a `EX-50`: 56 · 15 · 23 · 13»

### Espejos del conteo de la matriz

Busqué con `rg` (con ruta, sobre `.specs/` sin los informes `14-`…`29-`, el worklog ni el handoff)
«104», «10 `UNKNOWN`», «diez», «cinco lecturas», la lista `EX-42`…`EX-47` y «44» junto a
*precisadas*. El «44» del log no tiene espejo fuera del log. Según `28-` §6, los espejos de billing
suman `EX-48` y `EX-50` y no `EX-49`, que es de verticales: pasan de diez a **doce**, y cada uno lo
dice.

- `$B/spec.md` §5.2, el título: `$B/spec.md:222` «~~diez~~ doce filas que siguen `UNKNOWN`»
- `$B/spec.md:230` «De las trece, `EX-49`, la lista del seudónimo del correo, es de verticales»
- `$B/spec.md:248` «qué campo del pago que aprobó un registro de cobro en un reintento»
- `$B/spec.md:249` «cuántas suscripciones anuales del sistema viejo siguen vivas el día del corte»
- `$B/descomposicion.md` §2.7: `$B/descomposicion.md:388` «~~diez~~ doce filas `UNKNOWN`»
- `$B/descomposicion.md:394` «es de verticales y no va en esta tabla, así que acá caen doce»
- `$B/descomposicion.md:410` «es el dato con el que la regla de la marca decide»
- `$B/descomposicion.md:411` «dice cuándo cae la segunda corrida del detector del cobro sobre la lápida»
- `B/06`, la cifra del capítulo: `B/06:28` «quedan trece `UNKNOWN` y doce son de este capítulo»
- `B/06` §11: `B/06:401` «Doce de las trece filas de 107»
- `B/06:423` «Y el paso 1b no arranca sin él»
- `B/06:424` «cuántas suscripciones del sistema viejo con ciclo anual siguen vivas el día del corte»
- La frase que `28-` §6 pedía reescribir: `B/06:433` «y `EX-43` a `EX-48` y `EX-50` son siete lecturas del proveedor»
- `$D/spec.md`, que había quedado en 98 filas y 4 `UNKNOWN` desde el 26/09 (no tenía ni `EX-42`):
  `HOS-1352-billing-verticals-redesign/spec.md:85` «~~98~~ 107 filas»
- `HOS-1352-billing-verticals-redesign/spec.md:137` «~~98~~ 107 filas · ~~92~~ ~~93~~ 94 cerradas»

**Lo que decía *«propuesta»* y ya no lo es.** Dos capítulos remitían a la fila de la matriz como
propuesta al owner:

- `B/21:298` «es la fila `EX-48` de la matriz»
- `D/16:122` «Es la fila `EX-50` de la matriz, acortada al conteo»
- `D/16:122` «Es la fila `EX-49` de la matriz»
- Y el paso 0 nombra a `EX-48` junto a su medición: `D/16:122` «(`EX-48`; FASE 9 vuelta 2, verificación»

En el paso 0 la frase estaba **dos veces seguidas** tras el recuento de las anuales, y taché las
dos: `D/16:122` «La fila de la matriz está propuesta al owner en el registro de cierre de la verificación de la FASE 9 vuelta 2. La fila de la matriz está propuesta»

### `V2-z2` · `PB5` toma el lock

`PB5` sale de `DRAFT`, que comparte con `PB1`, `PB10` y `PB12`, los tres con lock.

- La fila: `V/03:584` «como `PB4`, `PB6`, `PB10` y `PB12`, porque lo comparte con `PB1`, `PB10` y `PB12`»
- La viñeta de las que no ocupan ni liberan cupo: `V/03:896` «que sale de `DRAFT` como `PB1`, `PB10` y `PB12`»
- La unidad V6: `$V/descomposicion.md:59` «y `PB5`, que comparte `DRAFT` con `PB1`»
- La tabla del §2.10: `$V/descomposicion.md:407` «y `PB5`, que sale de `DRAFT` como `PB1`»

### `V2-z3` · el tope de purgas del borde, en el paso 0

Junto a `EX-49`, sin fila de matriz: es configuración del borde, no una lectura del proveedor de
pagos.

- `D/16:122` «Y junto a `EX-49` se verifica el tope de purgas del plan del borde (Cloudflare)»
- El 4c remite al paso 0: `D/16:133` «y ese tope se verifica en el paso 0»

### `V2-z1` y `V2-z5` · sin cambio de texto

`V2-z1` confirma lo que `28-` ya escribió como costo: `B/03:1421` «que la persona pidió por `S11`
antes del anuncio». `V2-z5` deja el título: `B/03:867` «La baja tiene CUATRO filas y no una».

## 2. Conteos recontados

| lista | antes → ahora | comando | espejos |
|---|---|---|---|
| filas de la matriz y `UNKNOWN` | 104 / 10 → **107 / 13** (56 · 15 · 23 · 13) | `python3 contar-filas-de-la-matriz.py` desde `$D` | encabezado y resumen de `D/06`, `$B/spec.md` §5.2, `$B/descomposicion.md` §2.7, `B/06` (línea 28 y §11), `$D/spec.md` (dos) |
| `UNKNOWN` de billing | 10 → **12** | lectura: las 13 menos `EX-49` | los de billing de arriba |
| lecturas del proveedor de la FASE 9 vuelta 2, y en el paso 0 | 5 y 3 → **7 y 5** | lectura: `EX-43` a `EX-48` y `EX-50`; en el paso 0 `EX-44`, `EX-45`, `EX-47`, `EX-48`, `EX-50` | `B/06:433` |
| precisadas sin `SUPERSEDED` del log | 44 → **47** | script en `scratchpad/verif-v2/contar-precisadas.py`, con el criterio del resumen del log (campo *Estado* entero con precisada, recontada, enmendada o cerrada, y sin `SUPERSEDED`); da 44 sobre `git show HEAD:` y 47 sobre el árbol | sólo el resumen del log |
| decisiones del log | 126 → **126** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` | ninguna es nueva |
| transiciones de la ficha que toman el lock | 10 → **11** (todas menos `PB11`) | lectura de `V/03` §9 | `$V/descomposicion.md:59` y `:407` |

## 3. Preguntas abiertas

Ninguna. Las dos elecciones mías están declaradas en el §1: dónde va el 📌 de `DEC-RF-001` y el
separador del *Estado*.

## 4. Casos vecinos

1. **`$D/spec.md` tiene otras cifras viejas que no son de este tramo**: *«48 decisiones»* (línea 80)
   y *«106 decisiones»* (línea 147) contra las 126 del script. No las toqué: la tarea era el conteo
   de la matriz.
2. **El paso 0 de `D/16` nombra por ID a `EX-42`, `EX-48`, `EX-49` y `EX-50`, pero no a `EX-44`,
   `EX-45` ni `EX-47`**, que describe sólo por texto. No es falso; lo dejo dicho.
3. **`B/21:106` y `B/21:498` hablan del recuento de las anuales sin nombrar `EX-50`.** Tampoco es
   falso, y no los toqué.
4. **Con `PB5`, la viñeta de `V/03` §9 sobre las que *«no ocupan ni liberan cupo»* ya nombra a todas
   salvo `PB11`**: el lock lo toman once de doce. Si el owner quiere, se puede escribir como regla
   general con una excepción; hoy es una lista.
5. **La tabla *«Qué espera cada decisión»* de `D/06`** no tiene ninguna de `EX-43` a `EX-50`. Lo
   mantuve así, como quedó el 27/09.

## 5. Cómo se verificó

- Citas: `cd $D/27-fase-8-vuelta-1 && python3 verificar-citas.py ../29-fase-8-vuelta-2/29-aplicacion-log-y-matriz.md`.
- Matriz: `python3 contar-filas-de-la-matriz.py` desde `$D`: 107 filas, 56 `VERIFIED`, 15
  `PARTIALLY_SUPPORTED`, 23 `NOT_SUPPORTED`, 13 `UNKNOWN` (`PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42` a
  `EX-50`).
- Log: `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md | sort -u | wc -l` da 126.
- markdownlint desde la raíz del worktree sobre los once archivos tocados y este registro.

## Key Learnings

1. Un 📌 que cae *«después del último de la entrada»* puede quedar lejos de la parte que precisa
   (`DEC-RF-001`); el *Estado* que dice *«ver su último 📌»* es lo que decide dónde va.
2. Un espejo que no se tocó en dos lotes (`$D/spec.md` en 98 filas) no aparece buscando la cifra
   anterior (104): hay que buscar también la cifra de antes de esa.
3. Una frase *«propuesta al owner»* en un capítulo caduca el día que el owner aprueba, y ningún
   conteo la delata: se busca por la palabra.
