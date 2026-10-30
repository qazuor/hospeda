---
title: "Revisión del owner · el lote P de la verificación corta, en el diseño y en el log"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · el lote P de la verificación corta, en el diseño y en el log

Las tres letras del **lote P** de
[`32-decisiones-sobre-la-verificacion.md`](./32-decisiones-sobre-la-verificacion.md), que decidió
los dos ⚠️ de [`35-aplicacion-lote-o.md`](./35-aplicacion-lote-o.md) §3 (O-B-1 y O-B-2) y su caso
vecino (quién crea el package del contrato), aplicadas al diseño en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre el HEAD que ya trae la tanda de `35-`, sin commits.
Las tres son la recomendada. Con la excepción que dio el owner al lote N-J, **el log se escribió en
esta misma tanda** (§4); la matriz no cambia.

Marcas en el diseño: *(verificación corta, 2026-09-29, lote P-letra)*. Abreviaturas como en `35-`:
`B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/16` la FASE 7 del paraguas, `$B/` y `$V/`
las raíces de las sub-specs. Las ediciones las hicieron reemplazos de ocurrencia única que abortan
si el ancla no es única (`aplic-36/rep.py` del scratchpad); las citas de abajo las resolvió
`aplic-36/cit.py`, que busca cada frase en el archivo ya editado.

**No queda ninguna decisión para el owner.** Lo derivado va marcado en el diseño y listado en §6.

## 1. P-A · el Worker del borde que contesta `500`

### 1.1 Qué es y qué contesta

La ruta de avisos no se cierra con una regla de bloqueo (que contesta `4xx`) sino con **un Worker
del borde asignado a esa ruta, que contesta `500` a todo pedido sin pasarlo al servidor**, el único
código con reintento medido (`WH-4`). **Con una cabecera propia**, que derivé: sin ella la
verificación desde afuera no distingue el `500` del Worker del `500` que la aplicación contesta a
propósito ante un cobro que no resuelve (HOS-276).

- El ⚠️ de O-B-1, tachado: `D/16:137` «la regla de bloqueo del borde contesta un `4xx` (el `403` por defecto»
- La elección: `D/16:137` «la cierra un Worker del borde (Cloudflare) al que se le asigna esa ruta»
- La cabecera, marcada: `D/16:137` «La cabecera la derivé y la marco»
- Lo que recibe el proveedor: `D/16:137` «el proveedor recibe ~~error~~ el `500` del Worker y reintenta a la misma URL»
- En el 4b: `D/16:141` «que contesta ~~error~~ `500` desde un Worker (lote P-A)»
- En el párrafo de `DB-5`: `D/16:165` «el `500` del Worker del cierre (verificación corta, 2026-09-29, lote P-A)»
- Y no es un interruptor: `D/16:51` «desde el lote P-A, un Worker del borde que contesta `500`, que es código pero no de ninguno de los dos sistemas»

### 1.2 Cuándo se prende y se apaga

**Se prende** asignándole la ruta, antes de apagar el contenedor viejo (paso 3), verificado desde
afuera con la marca de Webhooks y sin ella; **se apaga** quitándole la ruta al final del paso 4, con
las lápidas verificadas, verificado desde afuera porque la respuesta ya no trae la cabecera.

- `D/16:137` «**Se prende** asignándole la ruta, antes de apagar el contenedor viejo»
- `D/16:137` «**se apaga** quitándole la ruta, al final del paso 4»
- El paso 4: `D/16:140` «quitándole la ruta al Worker que la cerró, verificado con una petición desde afuera que ya no vuelve con su cabecera»

### 1.3 La vuelta atrás

La (a) de la rama de aborto sigue siendo *«la ruta de avisos en el borde»*; ahora cerrar y abrir
tienen mecanismo. Siguen siendo tres las cosas afuera de la base.

- `D/16:385` «**Cerrar y abrir son asignarle y quitarle la ruta al Worker del paso 3**»

### 1.4 Quién lo deja listo

**Ninguna unidad**: vive versionado con el script del corte en `scripts/cutover/`, es de esta FASE 7
del paraguas como el punto 1 de *«las herramientas del corte»*, y se archiva con el script. **Lo
deja listo el paso 0**: el ensayo en `staging` lo prende, verifica su `500` con la cabecera, lo apaga
y mide cuánto dura el cierre; el 1a no arranca sin ese ensayo verde. Lo marqué como derivado: el
lote P-A elige el Worker y no dice quién lo escribe; ninguna unidad de las dos épicas es dueña del
borde (el punto 5 ya decía *«no código de ninguna épica»*), y `U1` no escribe piezas del diseño
nuevo.

- `D/16:325` «**El cierre de la ruta de avisos es un Worker del borde que contesta `500`**»
- `D/16:327` «vive versionado con el script del corte en `scripts/cutover/`, es de esta FASE 7 del paraguas»
- `D/16:331` «el lote P-A elige el Worker y no dice quién lo escribe»
- El paso 0: `D/16:131` «Y se ensaya en `staging` el Worker que cierra la ruta de avisos en los pasos 3 y 4»

### 1.5 Billing

- `B/21` §2.5, la herramienta de lápidas: `B/21:190` «con un Worker del borde que contesta `500`, así que el proveedor reintenta»
- `B/06` §7, el canal IPN: `B/06:537` «a los dos canales les contesta `500` un Worker del borde»
- Y lo que eso deja en IPN, derivado y marcado: `B/06:537` «por IPN el reintento no está medido»

## 2. P-B · el detector del día siguiente ve lo que se perdió

La primera corrida del detector (la de las lápidas del corte con `payment`) **lista también, por
cada lápida del corte, los registros que el proveedor da aprobados con un pago del día del corte y
que no tienen `payment`**, con la misma lectura del barrido (`authorized_payments` y el pago leído
por id con el campo de `EX-48`), sin abrir marca ni asentar. Se acota al **día del corte** porque
los anteriores son la historia del viejo, que no se conserva y ninguno tiene `payment` (la lista
serían todos), y los posteriores ya los compara el barrido y abren `PAGO_TARDÍO_RECHAZADO`.

Dos cosas derivadas, marcadas en `B/21`: la lista **no distingue** el cobro cuyo aviso se perdió del
cobro del día del corte que el viejo registró antes del paso 3 (la base nueva no lo conserva, y los
dos van a la llamada), y un registro de la lista todavía puede recibir su `payment` por un reintento
posterior a la corrida.

- `B/21`, el punto (3) de lo que no cierra: `B/21:512` «**Y no queda invisible: lo lista el detector del día siguiente al corte**»
- `B/21`, su *Detector*: `B/21:529` «**Y la primera corrida lista también, por cada lápida del corte, los»
- `B/21:533` «sin abrir marca ni asentar**. Es una lista para quien opera el corte»
- Lo derivado: `B/21:538` «Las dos últimas frases las derivé y las marco.»
- `B/09` §3: `B/09:175` «Esta misma lectura la hace el detector del día siguiente al corte»
- `D/16`, el paso 3, el ⚠️ de O-B-2 tachado: `D/16:137` «y que desde el lote P-B lista el detector del día siguiente al corte»
- `D/16`, las herramientas del corte, punto 2: `D/16:312` «y, en su primera corrida, los cobros del día del corte que el proveedor da aprobados y no tienen `payment`, sin abrir marca ni asentar»
- La fila de `B11`: `$B/descomposicion.md:137` «y, en su primera corrida, los cobros del día del corte que el proveedor da aprobados y no tienen `payment`, sin abrir marca ni asentar (verificación corta, 2026-09-29, lote P-B)»
- Y su criterio: `$B/descomposicion.md:796` «sale en la lista del detector, que no abre marca ni escribe nada»

## 3. P-C · `U1` crea el package del contrato vacío

### 3.1 La tercera cosa de `U1`, y su fila

`U1` hace ahora tres cosas en el mismo cambio: al terminar la limpieza, **crea el package del
contrato vacío**: la estructura (con el nombre que fije la FASE 5, su `package.json`, su
configuración de compilación y un punto de entrada que no exporta nada) y ningún contenido. Qué es
*«la estructura»* lo derivé y lo marco. La fila deja de decir *«sólo limpieza»*: su entregable es
la limpieza y el package vacío, y el criterio admite esa única pieza nueva.

- `D/16:503` «Hace ~~dos~~ tres cosas, en el mismo cambio»
- `D/16:520` «**Al terminar, crea el package del contrato vacío**»
- `D/16:524` «Qué es «la estructura» lo derivé y lo marco.»
- La decisión, con el *sólo* tachado: `D/16:549` «**y, al terminarla, crea vacío el package del contrato** (verificación corta, 2026-09-29, lote P-C).»
- La fila de `U1`: `D/16:562` «**la limpieza del principio y, al terminarla, el package del contrato vacío; nada más**»
- Su criterio: `D/16:562` «**salvo la estructura vacía del package del contrato, que entra al workspace, compila y no exporta nada**»

### 3.2 `V1` y `B1` en paralelo, y las once dependencias

`D/16` §4.6 lo dice en un párrafo propio: las dos dependen sólo de `U1`; lo que las ataba era el
package, en el que `B1` escribe la interfaz del reloj, y esa espera no estaba entre las once. Con el
package vacío la espera desaparece.

- `D/16:580` «**`V1` y `B1` arrancan en paralelo** (verificación corta, 2026-09-29, lote P-C)»
- `D/16:566` «que arrancan después, en paralelo (lote P-C), vuelvan a escribir»
- `$B/descomposicion.md` §2.6: `$B/descomposicion.md:330` «**El package lo crea `U1`, vacío (la estructura, sin contenido), al terminar la»
- `$B/descomposicion.md` §3: `$B/descomposicion.md:650` «**Y `B1` arranca en paralelo con `V1`**»
- Y el *sólo* de su § 3, tachado: `$B/descomposicion.md:650` «*(y, al terminarla, crea vacío el package del contrato: lote P-C)*»
- La fila de `B1`: `$B/descomposicion.md:127` «*(el package lo crea vacío `U1`, y esta unidad arranca en paralelo con `V1`: verificación corta, 2026-09-29, lote P-C)*»
- `$V/descomposicion.md`, la fila de `V1`: `$V/descomposicion.md:54` «*(desde el lote P-C lo crea vacío `U1`, y `V1` llena las cuatro primeras cosas»
- La fila del package en §2.11: `$V/descomposicion.md:471` «**`U1`** *(lo crea vacío)*, **V1** *(llena las cuatro primeras cosas)* y **B1** *(la interfaz del reloj)*»
- La fila de la limpieza: `$V/descomposicion.md:485` «hace ~~sólo~~ la limpieza y, al terminarla, crea vacío el package del contrato (lote P-C)»
- El § 3 de verticales: `$V/descomposicion.md:507` «**`V1` y `B1` arrancan en paralelo, y cada una llena su parte del package del contrato que `U1` deja vacío**»
- El contrato: `12-contrato-de-cobertura.md:1530` «**`U1` crea el package vacío, la estructura sin contenido, al terminar la limpieza del principio»
- La spec del paraguas: `.specs/HOS-1352-billing-verticals-redesign/spec.md:20` «salvo, desde el lote P-C, la estructura vacía del package del contrato»

**Recuento de dependencias entre épicas, con script** (las filas numeradas de la tabla de
`$B/descomposicion.md` §2.6, sin las tachadas): 1 a 7 y 9 a 12, **once**; la 8 y la 13, tachadas.
Ninguna fila nombra a `U1` ni a una espera de `B1` sobre `V1`.

### 3.3 Los guards

**Ninguno queda sin dueño.** El package vacío no pide guard propio: `G14` vigila que una mitad no
importe a la otra fuera del package, no el package, y sigue en `V1`; `G13` (la técnica que aparta
los simuladores de producción) sigue en `V4`. Entre `U1` y `V1` la frontera no la vigila nada
automático; si `B1` se mergea antes con un import que la cruza, `G14` nace rojo en el cambio de
`V1` y lo muestra. Lo marqué como derivado, igual que el hueco de `G16` (a) de O-A.

- `D/16:585` «**`G14` sigue en `V1`**: vigila»
- `D/16:588` «`G14` nace rojo en el cambio de»
- El contrato: `12-contrato-de-cobertura.md:1530` «`V1` construye `G14` y llena las cuatro primeras cosas»

Ninguna columna de guards se tocó (`git diff` sobre las dos descomposiciones y la fila de `U1`): el
reparto sigue **17 · 15 · 1 = 33**.

## 4. El log

Con la excepción del owner. **Cuatro 📌, ninguna decisión nueva, ningún `SUPERSEDED`.** Grepeado
antes: `DEC-ARCH-014` (la limpieza, cuyo 📌 del lote O dejaba abiertas O-B-1 y O-B-2),
`DEC-MIG-003` (el orden del corte, con el 📌 de O-B), `DEC-MIG-005` (dueña del detector del corte,
por su 📌 de `R2`) y `DEC-ARCH-006` (el package del contrato). Las dos que sugería la consigna más
las dos donde vive lo que cambió: el Worker es un detalle del orden del corte y el detector es de
`DEC-MIG-005`, así que registrarlos sólo en `DEC-ARCH-014` dejaba esas dos entradas describiendo un
corte que ya no es.

- `DEC-ARCH-014`, su 📌: `01-decision-log.md:6939` «Precisada el 2026-09-29, con OK del owner (verificación corta, lotes P-A, P-B y P-C)»
- Su *Estado*: `01-decision-log.md:6890` «(verificación corta, lote P: el Worker que cierra la ruta, el detector que ve lo perdido y el package del contrato que crea `U1`; ver su último 📌)»
- `DEC-MIG-003`: `01-decision-log.md:3006` «Precisado el 2026-09-29, con OK del owner (verificación corta, lote P-A)»
- Su *Estado*: `01-decision-log.md:2892` «(verificación corta, lote P-A: el Worker del borde que contesta `500`; ver su último 📌)»
- `DEC-MIG-005`: `01-decision-log.md:6201` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote P-B)»
- Su *Estado*: `01-decision-log.md:6114` «(verificación corta, lote P-B: el detector lista también los cobros del día del corte sin `payment`; ver su último 📌)»
- `DEC-ARCH-006`: `01-decision-log.md:2529` «Precisada el 2026-09-29, con OK del owner (verificación corta, lote P-C)»
- Su *Estado*: `01-decision-log.md:2405` «(verificación corta, lote P-C: quién crea el package del contrato; ver su último 📌)»
- El `## Resumen`: `01-decision-log.md:6976` «1 nueva, ~~10~~ ~~13~~ 17 📌, 0 `SUPERSEDED`»
- `01-decision-log.md:6976` «**y el lote P de `32-`** (lo que pidió elegir la tanda que aplicó el lote O, las tres la recomendada)»
- La nota de precisadas: `01-decision-log.md:6961` «tras los cuatro 📌 del lote P de la verificación corta: caen sobre decisiones ya precisadas»

**Las cifras, con script sobre el archivo final**, parado en `$D`:

| qué | antes | después | cómo |
|---|---|---|---|
| decisiones | 136 | **136** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` |
| funcionales | 121 | **121** | la misma, menos las 15 `DEC-METH` |
| precisadas sin `SUPERSEDED` | 69 | **69** | `contar-precisadas.py` sobre el archivo y sobre el de `HEAD`: mismo conjunto, `diff` vacío |
| `SUPERSEDED` | 11 | **11** | el mismo recorte del *Estado* |
| matriz | 114 = 61 · 15 · 24 · 14 | **igual** | `python3 contar-filas-de-la-matriz.py` |

**Por qué la de precisadas no cambia**: las cuatro ya tenían la marca en su *Estado* (`DEC-ARCH-014`
desde el lote O, las otras tres de antes), y ninguno de los cuatro 📌 trae `SUPERSEDED`.

## 5. Conteos que cambiaron

Ninguno. Lo que se verificó y no se movió: las once dependencias entre épicas (§3.2), los 33 guards
con su reparto 17 · 15 · 1 (§3.3), las 23 unidades, las tres cosas de la vuelta atrás afuera de la
base (§1.3), los pasos del corte (el Worker va dentro del 0, el 3 y el 4), las 136 decisiones, las
69 precisadas y la matriz. **Sí cambió** la cuenta de 📌 de la verificación corta en el resumen del
log, de 13 a 17 (§4).

## 6. Casos vecinos

Ninguno que bloquee. Lo derivado, todo marcado en el diseño: la cabecera propia del Worker (§1.1),
quién lo escribe y que lo deje listo el paso 0 (§1.4), lo que el cierre deja en IPN (§1.5), el
alcance *«del día del corte»* y las dos salvedades de la lista del detector (§2), qué es *«la
estructura»* del package (§3.1) y el rato sin `G14` (§3.3).

## 7. Para la implementación

1. **El Worker del cierre** no tiene issue ni dueño de código fuera de la FASE 7: lo escribe quien
   escribe el script del corte, en `scripts/cutover/`, y se ensaya en el paso 0.
2. **El `EX-46` y sus tres espejos** (`B/06` §3, `$B/descomposicion.md` §2.7, `$B/spec.md`) y la
   fila de la matriz siguen con la frase de M-4, *«el barrido diario lo relee»*, que `35-` §2.4
   mostró que quiere decir *«lo lee y no lo asienta»*. Están sin sujeto desde O-B y no los toqué;
   la matriz no la podía tocar.
3. **El nombre del package del contrato** sigue siendo FASE 5 (`12-contrato…` §7): `U1` lo necesita
   para crearlo, así que la FASE 5 tiene que haberlo fijado antes de `U1`.
4. **`03-handoff.md`** sigue sin el Worker, el detector ampliado y el package vacío: lo actualiza el
   owner.

## Key Learnings

1. Una lista de «cobros sin `payment`» sobre un preapproval del sistema viejo lista toda su
   historia: el filtro por fecha (el día del corte, con la fecha del pago de `EX-48`) es lo que la
   vuelve una lista de llamadas y no un volcado.
2. Un `500` del borde se confunde con un `500` de la aplicación (HOS-276): verificar desde afuera un
   cierre necesita una marca que sólo ponga el cierre.
3. Crear un package vacío en la unidad anterior es lo que convierte una espera oculta entre dos
   unidades en paralelo real, sin sumar una dependencia entre épicas.
