---
title: "FASE 9 vuelta 3 · aplicación del lote del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 9
---

# FASE 9 vuelta 3 · aplicación del lote del log y la matriz

La fila AB de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) (OK del owner del
2026-09-30) aprueba lo que propuso [`14-aplicacion-cierre.md`](./14-aplicacion-cierre.md) § «Para
el owner»: las nueve propuestas para el log (siete 📌 y las nuevas `DEC-AUTH-004` y `DEC-AUTH-005`)
y las filas `EX-57`, `EX-58` y `EX-59` de la matriz, con tres agregados: el lote Q va a
`DEC-ARCH-006`, el lote Y a `DEC-CONC-001`, los valores del lote R a `DEC-DATA-008`, y el lote AA a
`DEC-AUTH-004`. Medido y editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre HEAD
`f45564e0f2`, sin commits.

Este tramo edita sólo `D/01` (el log) y `D/06` (la matriz). El PDR no se tocó, ni ningún archivo
del diseño (`$V`, `$B`, núcleo, contrato, `16-`), que en paralelo edita otra tanda.

## 1. Qué se aplicó en el log

Antes de tocar cada ID lo grepeé (`rg -n "^### DEC-XXX-NNN"`) y leí la entrada entera: los siete
existían en las líneas que `14-` citaba, y ninguno tenía un 📌 de la vuelta 3. `DEC-AUTH-004` y
`DEC-AUTH-005` estaban libres: el log llegaba a `DEC-AUTH-003`.

**Dónde va cada 📌.** Al final de la entrada, después del último 📌, como hicieron las tandas
anteriores. En `DEC-CONC-001` y `DEC-RF-001` la entrada no cierra con `---` sino con el encabezado
siguiente, y el 📌 va justo antes.

**El separador del *Estado*.** El punto y coma, que `DEC-ARCH-006` y `DEC-MIG-005` ya usan entre sus
últimas precisiones. Así no entra ninguna raya larga nueva. La única que escribí es la del
encabezado de las dos decisiones nuevas, que es la forma fija del log (`### DEC-<AREA>-<NNN> —
<título>`, sección *Formato*), y la dejo declarada.

### Los siete 📌 y sus siete *Estado*

- `DEC-DATA-005`, *Estado*: `D/01:5857` «FASE 9 vuelta 3, lote H: el seudónimo de la fila de `trial` tras la baja de la cuenta»
- `DEC-DATA-005`, 📌: `D/01:5932` «el seudónimo de la fila de `trial` se conserva hasta que el abogado conteste la pregunta 5»
- `DEC-ARCH-013`, *Estado*: `D/01:6858` «FASE 9 vuelta 3, lote C: la migración única del catálogo corre dentro de la migración estructural del paso 3»
- `DEC-ARCH-013`, 📌: `D/01:6896` «escritura `C` y de la prueba del corte, que la leen; el paso 3a sólo la verifica»
- `DEC-DATA-008`, *Estado*: `D/01:6903` «FASE 9 vuelta 3, lotes K y R: la lista cerrada pasa a dieciocho plazos, con los valores de los tres nuevos»
- `DEC-DATA-008`, 📌, la lista: `D/01:6951` «pasa de quince a dieciocho plazos: la ventana de relectura de la cancelación por rechazo»
- `DEC-DATA-008`, 📌, los valores del lote R: `D/01:6954` «el 16, 7 días; el 17, 7 días; el 18, 180 días»
- `DEC-ARCH-006`, *Estado*: `D/01:2414` «FASE 9 vuelta 3, lotes D y Q: `puedeCobrarle` sobre la cancelación confirmada y la última pérdida de cobertura de una ficha»
- `DEC-ARCH-006`, 📌, el lote Q: `D/01:2546` «Y el contrato devuelve cuándo perdió cobertura por última vez una ficha»
- `DEC-ARCH-006`, 📌, mientras falte el dato: `D/01:2547` «una ficha inactiva (`PB9`) cuenta su plazo desde ahí»
- `DEC-RF-001`, *Estado*: `D/01:1730` «FASE 9 vuelta 3, lote L: el addon de única vez comprado dentro de la ventana»
- `DEC-RF-001`, 📌: `D/01:1820` «comprado dentro de la ventana de revocación se devuelve por `RF1`, que crea `S36`»
- `DEC-CONC-001`, *Estado*: `D/01:1466` «FASE 9 vuelta 3, lotes E e Y: `A3` sólo confirma y la identidad de la compra»
- `DEC-CONC-001`, 📌: `D/01:1537` «y nunca crea: sin id de orden abandona sin reenviar»
- `DEC-CONC-001`, 📌, el lote Y: `D/01:1541` «recurrente vivo igual sobre el mismo objetivo»
- `DEC-MIG-005`, *Estado*: `D/01:6162` «FASE 9 vuelta 3, lotes F y G: nada se devuelve y el titular que sólo conoce el proveedor»
- `DEC-MIG-005`, 📌: `D/01:6259` «sandbox trae su pagador (`EX-59`); si ninguna, queda declarado sin detector»

Los textos son los de `14-` § «Propuestas para el log», con los tres agregados. Cuatro retoques,
todos declarados:

1. `DEC-DATA-008`: la propuesta decía *«sin valor escrito»* para los tres plazos nuevos, y el lote R
   les dio valor; el 📌 lleva los valores y dice que los cinco anteriores sin valor siguen
   pendientes. Suma además que la versión 1 del paso 3 lleva los dieciocho, porque el 📌 de N-H de
   la misma entrada dice *«con los quince valores»*.
2. `DEC-CONC-001` nombra `EX-57` junto a la búsqueda por el identificador del pedido, y
   `DEC-MIG-005` nombra `EX-59` junto a la lectura del pagador: son las filas que las condicionan.
3. `DEC-MIG-005` dice en su encabezado *«F contra la recomendación»*, como el log marca las otras
   elecciones contra la recomendación.
4. `DEC-ARCH-006` escribe la salida provisoria del lote Q (*«mientras no exista, no corre en la
   misma pasada»*), que es parte de la opción elegida en `10-`.

### Las dos decisiones nuevas

Van después de `DEC-AUTH-003` y antes de `DEC-MIG-006`, donde el log agrupa las `DEC-AUTH-*` que no
son la 001. Con la forma completa: Fecha, Estado, Decide, Problema, Alternativas, Decisión, Motivo,
Dónde y Origen.

- `DEC-AUTH-004`, encabezado: `D/01:6529` «El reclamo de un Partner vincula una sola vez y a la cuenta que reclama»
- `DEC-AUTH-004`, *Estado*: `D/01:6531` «**Estado**: ACCEPTED · **Decide**: owner»
- `DEC-AUTH-004`, *Decisión* (lotes A y B): `D/01:6546` «un solo uso; si verifica la cuenta, cierra todas sus sesiones y credenciales previas»
- `DEC-AUTH-004`, *Decisión* (lote AA): `D/01:6548` «soporte. El link de reclamo lleva un secreto de un solo uso que viaja sólo en el aviso»
- `DEC-AUTH-005`, encabezado: `D/01:6564` «Postular un Partner no exige cuenta: es la segunda excepción del guest en el paso 1»
- `DEC-AUTH-005`, *Decisión* (lotes I y M): `D/01:6575` «acotada a esa escritura, con captcha (Turnstile) y una sola postulación abierta por correo»
- `DEC-AUTH-005`, la elección contra la recomendación: `D/01:6576` «en el lote I; el lote M, la recomendada»

**¿Se apartan del PDR?** Leí el §17.3 (los dos caminos de alta de Partner), el §6 (*User* y
*Guest*) y el §17. **Ninguna se aparta**, y cada una lo dice en un campo *«Relación con el PDR»*
(no *«Apartamiento del PDR, declarado»*, para que nadie la cuente como tal):

- `DEC-AUTH-004` cubre la rama que el §17.3 deja sin escribir (qué hacer si el correo ya tiene
  usuario), y el PDR no dice cuántos Partners tiene una cuenta: `D/01:6554` «User Hospeda con el email»
- `DEC-AUTH-005` coincide con el camino A, que empieza por un formulario y recién al aprobar crea el
  usuario si no existe: `D/01:6581` «completa formulario de Partner»

Los apartamientos siguen en 10, y la celda lo dice: `D/01:7097` «no suman: el §17.3 no dice qué hacer si el correo ya tiene usuario»

### El resumen del log

- *Decisiones tomadas*: `D/01:7085` «~~137~~ 139»
- *Funcionales*: `D/01:7087` «~~121~~ 123»
- *Precisadas sin `SUPERSEDED`*, que no se mueve: `D/01:7088` «y `DEC-AUTH-004` y `DEC-AUTH-005` nacen sin precisar, así que la cifra no se mueve»
- Fila nueva de la vuelta: `D/01:7104` «2 nuevas, 7 📌, 0 `SUPERSEDED`, del 2026-09-30»
- Y el `updated` del frontmatter, al 2026-09-30.

## 2. Qué se aplicó en la matriz

Grepeé: la última fila era `EX-56`, y ninguna fila decía `EX-57` a `EX-59`. Las tres van después de
`EX-56`, con la marca ✚ y las ocho columnas de sus vecinas (`#`, comportamiento, para qué, estado,
fecha, entorno, evidencia, conclusión). Cada una cierra con *«Fila abierta el 2026-09-30, con OK del
owner»*. Las celdas vacías de fecha, entorno y evidencia de `EX-57` y `EX-59` llevan la raya larga
que la matriz usa como celda vacía en todas sus `UNKNOWN`: son las seis rayas nuevas de la matriz
(291 → 297), y no hay otra. En el log son dos (1211 → 1213), las de los encabezados.

- `EX-57`, `UNKNOWN`: `D/06:414` «¿Se puede encontrar una orden de `/v1/orders` por su `external_reference` sin conocer su id»
- `EX-58`, `PARTIALLY_SUPPORTED`: `D/06:415` «¿`POST /v1/orders/{id}/refund` exige y respeta `X-Idempotency-Key`»
- `EX-58`, la parte medida: `D/06:415` «un total y un parcial, `201`, releídos `refunded` y `partially_refunded`»
- `EX-59`, `UNKNOWN`: `D/06:416` «Para un preapproval cuyo `GET` trae `payer_email` vacío»
- El encabezado, recontado: `D/06:17` «Recontado el 2026-09-30 tras abrir `EX-57` a `EX-59`»
- El resumen, fila `PARTIALLY_SUPPORTED`: `D/06:447` «entró `EX-58` el 2026-09-30»
- El resumen, fila `UNKNOWN`: `D/06:450` «entraron dos el 2026-09-30 (FASE 9 vuelta 3, lote AB): `EX-57` y `EX-59`»
- La línea del script: `D/06:455` «tras abrir `EX-57` a `EX-59`: 61 · 16 · 24 · 16»

**Un retoque en `EX-58`**, que anoto porque va más allá del texto de `14-`: la tabla de la batería
IPN (`RESULTS-2026-09-29-bateria-ipn.md`, pasos 56·07 y 56·09) pone un id `REF…` en la columna
*«resultado releído»*. No dice si vino en la respuesta del `POST` o en la relectura, así que la
pregunta sigue abierta, y la conclusión lo dice.

El script de la matriz vio las tres sin tocarlo: su patrón tolera la negrita del identificador
(arreglo del 2026-09-24), y las dos `UNKNOWN` entran solas a su lista de *«esperan medición»*.

## 3. Conteos, antes → después

| lista | antes → ahora | comando |
|---|---|---|
| decisiones del log | 137 → **139** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l`, sobre `git show HEAD:` y sobre el árbol |
| funcionales | 121 → **123** | las del log menos las 16 de `DEC-METH-*` (15 en la celda, que no cambia) |
| precisadas sin `SUPERSEDED` | 69 → **69** | `contar-precisadas.py` del scratchpad de la verificación de la vuelta 2, con el log como argumento: 69 sobre `HEAD` y 69 sobre el árbol |
| `SUPERSEDED` | 11 → **11** | script ad hoc: *Estado* de cada entrada con `SUPERSEDED` |
| apartamientos del PDR | 10 → **10** | lectura del §17.3 contra las dos nuevas |
| filas de la matriz | 114 = 61 · 15 · 24 · 14 → **117 = 61 · 16 · 24 · 16** | `python3 contar-filas-de-la-matriz.py` desde `$D` |
| `UNKNOWN` que esperan medición | 12 → **14** | la misma corrida: suman `EX-57` y `EX-59` |

Las funcionales: la celda *De metodología* dice 15, y por prefijo hay 16 `DEC-METH-*` (001 a 016,
con la 016 del 2026-09-29). Lo dejo como caso vecino (§5.1): no es de este tramo y la celda de
funcionales (121 → 123) se movió igual por las dos nuevas.

## 4. Espejos fuera del log y la matriz, para el orquestador

No los toqué. `rg -n` por número y por palabra sobre `$V`, `$B`, `$D/nucleo`,
`$D/12-contrato-de-cobertura.md`, `$D/16-fase-7-del-paraguas.md` y `$D/spec.md`. En `$V`, núcleo,
contrato y `16-` no hay espejo de estas cifras. Las tres filas nuevas son de billing (`B/09`,
`B/03`, `B/22`, `B/21`), así que las `UNKNOWN` de billing pasan de 13 a **15** de 16 (`EX-49` sigue
siendo la única de verticales).

- `$D/spec.md`, fila 7 del índice: `HOS-1352-billing-verticals-redesign/spec.md:87` «~~112~~ 114 filas»
- `$D/spec.md`, la FASE 1C: `HOS-1352-billing-verticals-redesign/spec.md:139` «~~112~~ 114 filas · ~~92~~ ~~93~~ ~~94~~ ~~95~~ 100 cerradas»
- `$D/spec.md`, las decisiones del índice, que ya venían atrasadas (135, no 137): `HOS-1352-billing-verticals-redesign/spec.md:82` «135 decisiones»
- `$D/spec.md`, el mismo número en el estado del programa: `HOS-1352-billing-verticals-redesign/spec.md:151` «135 decisiones»
- `$B/spec.md` §5.2, el título, que ya decía doce con trece de billing: `HOS-1354-billing-cobro-y-proveedor/spec.md:249` «doce filas que siguen `UNKNOWN`»
- `$B/spec.md`, las cifras: `HOS-1354-billing-cobro-y-proveedor/spec.md:256` «~~112~~ 114 filas»
- `$B/descomposicion.md` §2.7, el título: `HOS-1354-billing-cobro-y-proveedor/descomposicion.md:420` «trece filas `UNKNOWN`»
- `$B/descomposicion.md`, las cifras: `HOS-1354-billing-cobro-y-proveedor/descomposicion.md:423` «~~112~~ 114 filas de la matriz»
- `B/06`, la cifra del capítulo: `B/06:28` «quedan catorce `UNKNOWN` y trece son de este capítulo»
- `B/06` §11: `B/06:433` «Doce de las catorce filas de 114»
- Fuera de la lista pedida, `D/03` (el handoff), que `14-` §4 ya había señalado: `03-handoff.md:77` «matriz **114 =»

Los tres capítulos de billing que las filas nuevas condicionan (`B/09` §3, `B/03` §6.1, `B/22`
§2.2, `B/21` §1.3) y `16-` §4.2 y §4.3 pueden querer nombrar su fila; es la tanda del diseño la que
decide.

## 5. Casos vecinos

1. **La celda *De metodología* del resumen del log dice 15**, y hay 16 `DEC-METH-*` desde
   `DEC-METH-016`. No la toqué.
2. **`$D/spec.md` sigue en 135 decisiones** (líneas 82 y 151), dos lotes atrás del 137 de ayer.
3. **La tabla *«Qué espera cada decisión»* de la matriz** no nombra ninguna de `EX-43` a `EX-59`.
   La mantuve así, como las tandas del 27 y el 28.
4. **`EX-58` y la tabla de la batería**: si el id `REF…` salió de la relectura, la tercera parte de
   la pregunta ya está contestada en sandbox; se ve releyendo `probe-56-lo-que-la-52-no-cubre.sh`
   o su salida, que no leí.

## 6. Cómo se verificó

- Citas: `cd $D/27-fase-8-vuelta-1 && python3 verificar-citas.py ../37-fase-8-vuelta-3/16-aplicacion-log-y-matriz.md`.
- markdownlint desde la raíz del worktree sobre `D/01`, `D/06` y este registro.
- Los conteos, con los comandos de la tabla del §3.

## Key Learnings

1. Un 📌 que agrega valores a una lista puede dejar mintiendo a un 📌 anterior de la misma entrada
   (*«con los quince valores»*): antes de cerrar, leer los 📌 vecinos, no sólo el *Estado*.
2. Decidir si una decisión nueva se aparta del PDR pide leer el PDR, no el título: `DEC-AUTH-005` va
   contra la recomendación del consolidado, pero a favor del §17.3, que ya suponía un postulante sin
   cuenta.
3. Un conteo que no se mueve (las precisadas, 69 → 69) también se corre con script contra `HEAD`:
   es la única forma de saber que no se movió y no que el script dejó de ver algo.
