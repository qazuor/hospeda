---
title: "FASE 9 vuelta 2 · aplicación de la verificación, tramo verticales"
linear: HOS-1352
statusSource: linear
created: 2026-09-28
updated: 2026-09-28
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación de la verificación: el tramo verticales y la acción 16

Las decisiones `V2-g` a `V2-l` y `V2-j1` a `V2-j4` de
[`24-decisiones-del-owner-verificacion.md`](./24-decisiones-del-owner-verificacion.md), con el
insumo de [`25-lista-de-proveedores-del-seudonimo.md`](./25-lista-de-proveedores-del-seudonimo.md),
y los arreglos de texto sin decisión de la mitad de verticales: `N-B-01`, `N-B-02`, `N-B-03` (de
`22-`), `N-C-07` (de `23-`), las dos notas de texto vencido de `22-` §5, los casos vecinos
heredados que `22-` §4 clasifica como texto (`PB10` contra `PB3` y `PB9`, y la *«primera
corrida»*), y el caso vecino 6 que dejó el tramo billing en
[`26-`](./26-aplicacion-verificacion-billing.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign` sobre HEAD `ce4f5790ca`, sin commits. Leí entero `26-`
para no pisar lo suyo: no toqué `V2-a` a `V2-f` ni sus espejos. `B/` es `HOS-1354…/docs`, `V/` es
`HOS-1353…/docs`, `D/12` es el contrato y `D/16` es la FASE 7 del paraguas.

## 1. Qué se aplicó

### `V2-j1` a `V2-j3` · la lista del seudónimo, proveedor por proveedor (`R23`, `22-` P1)

La lista de `R23` sacaba puntos y `+alias` a la vez en *«Gmail y Outlook, y los que se midan»*, y
en todo otro dominio comparaba tal cual. Quedó reescrita como una tabla por proveedor, la del §5
de `25-`: Gmail quita puntos y `+` y unifica `googlemail.com` si la medición lo confirma;
Microsoft consumidor sólo quita el `+`, sin puntos ni unificación entre dominios; Proton unifica
sus dominios y quita el `+`, y los puntos, guiones y guiones bajos sólo si la medición lo confirma;
iCloud unifica si la medición lo confirma y quita el `+`; Yahoo no unifica y quita el `+` sólo si
la medición lo confirma; el resto nombrado queda tal cual; y todo dominio que la lista no nombra
pierde sólo el `+alias` (`V2-j3`).

- La regla vieja, tachada: `V/02:343` «y sin el `+alias` ni los puntos de la parte local sólo en una lista»
- La nueva: `V/02:347` «y con lo que diga la lista cerrada de abajo, proveedor por proveedor»
- El porqué, con el ejemplo: `V/02:349` «La lista anterior le quitaba»
- La fila de Microsoft: `V/02:357` «| Microsoft consumidor |»
- La fila de los dominios propios: `V/02:362` «**todo dominio que la lista no nombra**»
- Las tres reglas, con la de no normalizar ante la duda: `V/02:364` «**(b) Ante la duda, no»
- Lo que vuelve al owner: `V/02:367` «lo que la medición muestre fuera de la tabla vuelve al owner antes de aplicarse»
- Cuándo queda fija: `V/02:372` «**La lista queda fija con el paso 0, antes de la primera fila de `trial`**»
- Lo que no cierra, con los dos costos nuevos: `V/02:395` «**Y desde la lista por proveedor**»
- Espejo en la tabla del §2.10 de la descomposición: `$V/descomposicion.md:403` «qué se quita lo dice, proveedor por proveedor, la lista cerrada de `02` §2.2»
- Espejo en el criterio de V9, con los ejemplos: `$V/descomposicion.md:528` «ni `ana.maria@hotmail.com` y `anamaria@hotmail.com`»
- Espejo en el capítulo legal: `V/22:84` «con la normalización del cap. 02 §2.2, que quita los puntos y el `+alias` según la lista cerrada de proveedores»

**Dos derivaciones mías, dichas.** La primera: **un dominio que la lista no nombra cuenta como
dominio propio**. `V2-j3` quita el `+` *«en todos los dominios»* propios, y desde el correo no hay
forma de distinguir un dominio propio de un proveedor público que la lista no nombra; la única
lectura construible es que la fila de los dominios propios es la del resto. La segunda: **qué pasa
con cada *«a medir»* sin medición**. `V2-j2` eligió la lista del §5 de `25-`, que marca varias
celdas como *«medir»*, y `V2-j1` sólo dice qué pasa si la medición contradice a Microsoft. Apliqué
la regla del §3.4 de `25-` que el pedido nombra: lo que la tabla da como *«si la medición lo
confirma»* no entra sin la medición, y lo que la medición muestre fuera de la tabla vuelve al
owner. Con eso la lista sin medir es la conservadora, y el corte no espera la medición (abajo).

**Fastmail queda partido en dos.** Un dominio propio alojado en Fastmail pierde el `+` (es de la
fila del resto), y `fastmail.com` no (está nombrado *«tal cual»* en el §5 de `25-`). Es la letra de
`V2-j2` más `V2-j3`, y quedó declarado en el «NO cierra» junto con Yandex y Yahoo.

### `V2-j4` · la medición en el paso 0 del corte

- `D/16:117` «**Y se mide la lista de proveedores del seudónimo del correo**»
- La distribución de dominios: `D/16:117` «**la distribución de dominios de la tabla de usuarios de producción**»
- La prueba, con las cuentas del owner: `D/16:117` «**con cuentas receptoras nuevas que crea el owner**»
- Qué prueba cada resultado: `D/16:117` «Un rebote a la variante sin puntos prueba que los puntos cuentan»
- Cuándo queda fija la lista: `D/16:117` «**Con el resultado queda fija la lista que lleva el despliegue del paso 3**»
- Que no bloquea: `D/16:117` «**No es condición del corte**: lo que la tabla de `V/02` §2.2 da como»

**Por qué no bloquea, y la de `V2-a` sí vuelve al owner.** La de `V2-a` da el dato con el que la
regla decide, y sin él no hay regla. Ésta tiene una lectura sin medir que es segura: no normalizar
lo que no se confirmó. Lo que queda sin medir es un falso negativo (un trial regalado), no un
falso positivo. La fila de la matriz la propongo en el §3; no la nombré con un ID en el capítulo.

### `V2-g` · acortar la cola entra en la fila 16

- La fila: `nucleo/08:162` «**o acortar su cola** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-g`)»
- La confirmación y el reembolso: `nucleo/08:162` «**su confirmación dice la fecha nueva y cuántos compromisos se reembolsan**»
- La lista de las acciones que son una sola sobre el mismo instrumento: `nucleo/08:174` «**y *«discontinuar una vertical o acortar su cola»*** (FASE 9 vuelta 2, verificación, `V2-g`)»
- `B/10` §4.4, donde vive el acto: `B/10:416` «el mismo instrumento, `vertical_discontinuation`, y el mismo»
- `B/10:419` «la reescritura de la fecha, que ninguna fila nombraba, es de ésta»
- `V/17` §3.2 regla 1: `V/17:336` «su cola**, de `SUPER_ADMIN`»
- `V/17` §3.3, la plata: `V/17:418` «también**, que es la misma acción y reembolsa»
- `B/19` §6: `B/19:200` «**o acortar su cola**: owner 2026-09-27»
- La unidad `B12`, fila y criterio: `$B/descomposicion.md:133` «**o acortar su cola** (`V2-g`)»
- `$B/descomposicion.md:746` «**acortar la cola sin el permiso de `SUPER_ADMIN`, o sin confirmar, no reescribe la fecha»

**No mueve conteos**: entra en una fila que ya existía, así que la tabla sigue en dieciséis filas y
la regla 3 en quince capacidades del actor.

### `V2-h` · la acción 16 es capa de composición (`N-C-04`)

- La regla de vigilancia: `D/12:1268` «**Y tampoco la acción 16 de `NUCLEO/08` §3»
- La exención nombra sólo esta acción: `D/12:1273` «**La exención nombra esta acción y sólo ésta**»
- La fila 16: `nucleo/08:162` «**Y la acción es capa de composición**»
- `B/10` §4.3: `B/10:164` «**Y la acción que las orquesta es capa de composición, fuera de las máquinas de las dos»
- `V/02` §2.1: `V/02:122` «y la acción es capa de composición, fuera de las máquinas de las dos»
- La unidad `B12`: `$B/descomposicion.md:133` «**como capa de composición, fuera de las máquinas de las dos épicas»
- La tabla del §2.10 de verticales: `$V/descomposicion.md:405` «**como capa de composición, fuera de las máquinas de las dos épicas,**»

No toqué el recuento de entradas del §4.1 del contrato: la decisión elige la opción que **no**
agrega una escritura, así que siguen ocho.

### `V2-i` · el reintento es automático, con la firma de quien confirmó (`N-C-05`)

- `V/17` §3.3, como la excepción que no es una acción nueva: `V/17:421` «**La excepción que no es una acción nueva: el reintento de la mitad de billing de la»
- `V/17:424` «**Lleva la firma y la correlación del `SUPER_ADMIN` que confirmó el acto**»
- Su alcance: `V/17:428` «excepción es ésta sola»
- La fila 16: `nucleo/08:162` «**El reintento es automático y lleva la firma y la correlación del `SUPER_ADMIN` que confirmó el acto**»
- `B/10` §4.3: `B/10:176` «**El reintento es automático, con la firma y la correlación del»
- `V/02` §2.1: `V/02:121` «el reintento es automático, con la firma del `SUPER_ADMIN` que confirmó»
- La unidad `B12` y su criterio: `$B/descomposicion.md:133` «**con el reintento automático bajo la firma y la correlación del `SUPER_ADMIN` que confirmó**»
- `$B/descomposicion.md:746` «**el reintento de la mitad de billing corre sin que nadie lo dispare»

No agregué el reintento a la tabla del enrutado de `NUCLEO/08` §3 (*«las cinco son actos de
sistema»*): la decisión pide decirlo en `V/17` §3.3 y la fila 16 ya lo dice, así que el conteo de
esa tabla queda en cinco.

### `V2-k` · el guard de la lista cerrada de `PURGED`

- La fila del catálogo: `V/20:65` «| **G-R9** ✚ |»
- Qué no afirma: `V/20:65` «**No afirma que el tratamiento de cada fila sea el correcto**»
- La lista lo nombra: `V/02:719` «**La vigila `G-R9`**»
- `V/02:735` «**y si no entra, `G-R9` falla**»
- La unidad V6, en la columna de guards: `$V/descomposicion.md:54` «**`G-R9`** *(la lista cerrada de `PURGED`, que `PB12` aplica antes que `PB9`»
- La fila del §2.10: `$V/descomposicion.md:397` «| ✚ `G-R9`: el guard de la lista cerrada de `PURGED`»
- El criterio de V6: `$V/descomposicion.md:525` «**y el recorrido del esquema de `G-R9` da 29 tablas con FK y 11 con `entity_type`»

**`G-R9` va con V6 y no con V9, y es una elección mía.** La lista la aplican `PB12` (V6) y `PB9`
(V9), y V9 llega después de V6 (§3 de la descomposición). Es el argumento del §2.5, que puso a
`G-R6-B` en V6 por la misma razón: un guard que llega con la segunda unidad llega después de su
primer consumidor. **El nombre también es mío**: `G-R9`, por el racimo `R9` de la vuelta 2, que
armó la lista. Si choca con la serie `G-R*` de la FASE 8, se renombra sin mover nada más.

**El predicado incluye `entity_type` a secas**, como dice `V2-k`, y por eso atrapa
`revalidation_config`, que tiene `entity_type` sin `entity_id` y no nombra ninguna ficha. Para que
el guard nazca verde la sumé a la fila de lo que `PURGED` no toca, con la razón (`14-` ya la había
dejado afuera por lectura): `V/02:732` «**La configuración de revalidación es por tipo**»

### Los arreglos de texto sin decisión

- **`N-B-01`**, `T8` contra la vuelta por `PB3`/`PB7`: `V/03:255` «**Y si esa `SUSCRIPCIÓN` ya trae `cobrada: sí` y la persona está en `PRE_TRIAL`, `PB3` y `PB7`»
- `V/03:282` «**Lo mismo entre `T8` y la vuelta por `PB3` o `PB7`**»
- La fila de `PB3`: `V/03:577` «**Y si la sube bajo una `SUSCRIPCIÓN` que ya trae `cobrada: sí` y la persona está en `PRE_TRIAL`, evalúa `T8` adentro**»
- La de `PB7`: `V/03:581` «**y evalúa `T8` adentro como `PB3`**»
- La unidad y el criterio: `$V/descomposicion.md:400` «y con la `SUSCRIPCIÓN` ya cobrada evalúan `T8` dentro del lock»
- `$V/descomposicion.md:525` «**y con el primer cobro acreditado y `T8` evaluado antes de que `PB3` suba la ficha»
- **`N-B-02`**, `posts` y el recuento: `V/02:716` «**Son 29 tablas con FK a»
- `V/02:732` «**La nota del blog que nombra la ficha como alojamiento relacionado es contenido editorial de Hospeda**»
- **`N-B-03`**, `PB9` el día del fin de servicio: `V/03:583` «**Y no borra una ficha de una vertical cuya `finDeServicio` ya pasó si su `inactiva_desde` es anterior a esa fecha**»
- `V/03:1306` «**Y hasta que esa corrida escriba el hecho 4, `PB9` no borra»
- El tercer lector de `finDeServicio`: `D/12:1112` «**y `PB9`, que no borra una ficha de la vertical cuyo hecho 4 está pendiente**»
- El criterio de V9: `$V/descomposicion.md:528` «**el día del fin de servicio, antes de que corra el reconciliador, `PB9` no borra»
- **La primera corrida**, el caso vecino de `13-` que `22-` §4 da como texto: `V/03:1303` «**cada corrida con la fecha cumplida**»
- **`PB10` contra `PB3` y `PB9`** (caso vecino de `14-`): `V/03:889` «**`PB10` libera cupo y también lo toma, porque comparte `desde` con `PB3` y con `PB9`**»
- `V/03:584` «**Toma el lock del `user + vertical` y relee adentro su `desde`**, porque lo comparte con `PB3` y `PB9`»
- `$V/descomposicion.md:402` «**y `PB10` también, porque comparte `desde` con `PB3` y `PB9`**»
- **`N-C-07`**, los listados en el 4c: `D/16:128` «**Y los listados que muestran su tarjeta**»
- `D/16:128` «**verificado pidiendo desde afuera un listado que mostraba la tarjeta de una ficha bajada**»
- `V/21:160` «**y con ella los listados que muestran su»
- `$V/descomposicion.md:399` «**y los listados que muestran su tarjeta por la etiqueta de colección de cada tipo**»
- **Texto vencido 1 de `22-` §5**, la cita de `B/10` §4.6: `B/10:457` «*«`admite_altas` la lee billing»* (desde que»
- **Texto vencido 2**, la fila de `G13`: `V/20:52` «**un build destinado a producción importa el módulo de la implementación de arranque que contesta por billing**»

**`N-B-03`: de las dos salidas de `22-` elegí la que no depende del orden de los jobs.** `22-`
daba dos: que `PB9` no borre con el hecho 4 pendiente, o que la corrida del reconciliador corra
antes que el job de `PB9`. La segunda deja la ventana abierta el día que el reconciliador falla y
`PB9` no. La primera cuesta un lector más de `finDeServicio`, y lo sumé al recuento del contrato
(*«dos lugares»* pasa a tres). Con ella, además, la *«primera corrida»* se pudo reescribir como
*«cada corrida con la fecha cumplida»* sin memoria de la anterior: el costo es invalidar la caché
de una vertical discontinuada en cada corrida, que `22-` §4 ya había medido como barato.

**`N-C-07` suma la portada**, además de las etiquetas de colección que pide `23-`: el mapeo de
etiquetas del código actual (`packages/service-core/src/revalidation/entity-tag-mapper.ts:74`)
agrega la de la portada a todo cambio de alojamiento, porque la portada muestra los destacados.
Las páginas de destino, que también listan alojamientos, quedan como caso vecino (§5).

**`PB10`: extendí la viñeta y no la regla general.** `22-` daba las dos. La regla general
(*«toda escritura verifica su `desde` en la misma escritura»*) alcanza también a `PB4`, `PB6` y
`PB12`, que tienen la misma forma y `22-` no nombró; la dejo como caso vecino (§5) en vez de vaciar
la viñeta de las que liberan cupo sin que nadie lo haya pedido.

### El caso vecino 6 de `26-`

- **Los avisos del anuncio una sola vez**: se cierra con texto. `B/10:181` «**Y un reintento no repite los avisos ni mueve el anuncio**»
- `B/10:183` «un reintento que la encuentra escrita conserva su instante del anuncio y su fecha»
- **El sujeto de la acción 16**: pide decisión, va al §5 con su pregunta.

### `V2-l` · la clase del correo de la alerta cerrada, confirmada

- `nucleo/07:238` «confirmado por el owner: el turista pidió el servicio»

## 2. Conteos recontados

| lista | antes → ahora | comando | espejos |
|---|---|---|---|
| filas de `V/20` §2 | 20 → **21** | `awk` sobre el § y `rg -c '^\| \**G'` | `$V/spec.md` fila `20`, `B/20` §6 (fila *«filas de `V/20` §2»*) |
| guards del programa | 31 → **32** (19 verticales / 13 billing) | `python3` sobre la columna de guards de las dos descomposiciones, descontando tachados e IDs de decisión | `$V/descomposicion.md` §4, `$B/descomposicion.md` §4, `B/20` §6 (*«guards distintos»* y *«con unidad»*); **no** edité `D/03-handoff.md:129` (no es un capítulo) ni `01-decision-log.md:4140` (histórico) |
| tablas que cuelgan de `listing` | 28 → **29 con FK**, **11 con `entity_type`** | `python3` sobre `packages/db/src/schemas` con el `references(` en varias líneas | la columna de tablas de `V/02` §4.1 nombra las 40, verificado con script, sin faltantes ni sobrantes |
| lectores de `finDeServicio` en verticales | dos → **tres** | lectura | `D/12` §4.1 |
| filas del catálogo de acciones | 16 → **16** | sin cambio de filas | `V2-g` entra en la fila 16 |
| entradas del contrato §4.1 | 8 → **8** | sin cambio | `V2-h` no agrega escritura |
| actos de sistema del enrutado | 5 → **5** | sin cambio | `V2-i` va en `V/17` §3.3 y la fila 16 |

## 3. Para el log y la matriz (pide OK del owner)

### Matriz (`$D/06-mp-validation-matrix.md`)

1. **`EX-49`** (`V2-j4`), después de la `EX-48` que propuso `26-`. **Qué agrega**: la lista del
   seudónimo depende de hechos que la web no confirma. **Razón**: `V2-j4` pide la fila. No es una
   medición del proveedor de pagos; si el owner prefiere que la matriz no la tenga, el paso 0 la
   lleva igual. Los guiones de las celdas vacías son la convención de la matriz, no prosa.
   > | **EX-49** ✚ | ¿Qué variantes de un correo entregan en la misma casilla, por proveedor? Sin puntos, con `+t1`, en mayúsculas y en los dominios hermanos, sobre cuentas receptoras nuevas del owner en Outlook, Hotmail, Yahoo, Proton, iCloud y Gmail (unos 30 correos, `29-…/25-` §4); y la distribución de dominios de la tabla de usuarios | la lista cerrada del seudónimo del correo (`V/02` §2.2; FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2), antes del despliegue que lleva la lista. Un rebote 550 prueba que la variante cuenta; que llegue, que se ignora; *nada a los 30 minutos* no prueba nada y se repite. Lo que la tabla da como *«si la medición lo confirma»* entra sólo si lo confirma; lo que la medición muestre fuera de la tabla vuelve al owner |

   **Recuento si el owner la acepta**: con `EX-48`, la matriz pasa de 104 a 106 filas y los
   `UNKNOWN` de 10 a 12. Sus espejos de billing (`$B/spec.md` §5.2, `B/06` §11, `$B/descomposicion.md`
   §2.7) no la llevan: la construye la herramienta del corte con la lista de **V9**; si el owner la
   quiere en un censo, es el de verticales.

### Log (`$D/01-decision-log.md`)

1. **`DEC-TRIAL-004`**, el 📌 de `R23` (`:462`). **Qué cambia**: *«Gmail, Outlook y los que se
   midan»* queda falso.
   > 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-j1` a
   > `V2-j4`)**: la normalización sigue la lista por proveedor de `V/02` §2.2. Gmail quita puntos y
   > `+`; Microsoft consumidor sólo el `+`, sin unificar dominios; Proton e iCloud unifican y quitan
   > el `+`; todo dominio que la lista no nombra quita el `+`. Lo marcado *«a medir»* entra sólo si
   > la medición del paso 0 lo confirma, y lo que la medición muestre fuera de la lista vuelve al
   > owner.
2. **`DEC-ARCH-011`** (discontinuar una vertical). **Qué cambia**: la acción gana el acortamiento,
   el reintento automático y su lugar fuera de las máquinas.
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y
   > `V2-i`)**: la acción 16 es *«discontinuar una vertical o acortar su cola»*, con el mismo permiso,
   > y la confirmación del acortamiento dice cuántos compromisos se reembolsan. Es capa de
   > composición, fuera de las máquinas de las dos épicas, y la única que la regla de vigilancia
   > exime por nombre. Si la mitad de billing falla, el reintento es automático y lleva la firma y
   > la correlación del `SUPER_ADMIN` que confirmó.
3. **`DEC-TEST-001`**. **Qué cambia**: un guard más.
   > 📌 **Enmendada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-k`)**: `G-R9`
   > vigila la lista cerrada de `PURGED` recorriendo el esquema, y lo construye V6. El programa pasa
   > a 32 guards, 19 de verticales y 13 de billing.
4. **`DEC-DATA-005`** o la entrada de `R9`. **Qué cambia**: la clase del correo, confirmada.
   > 📌 **Confirmada el 2026-09-27 (FASE 9 vuelta 2, verificación, `V2-l`)**: el correo de la
   > alerta de precio cerrada es transaccional.

No verifiqué el número de línea de `DEC-ARCH-011`, `DEC-TEST-001` y la entrada de `R9` en el log:
quien escriba los 📌 los ubica.

## 4. Preguntas abiertas

Ninguna de las decisiones pidió elegir entre lecturas, salvo las derivaciones que declaro en el §1
(el dominio no nombrado como propio, el *«a medir»* sin medición, `G-R9` en V6 y su nombre, la
salida de `N-B-03`, la portada en el 4c y la viñeta de `PB10`).

## 5. Casos vecinos

1. **El sujeto de la acción 16** (`18-` §5, caso vecino 6 de `26-`). La regla 5 de `V/17` §3.2
   compara `actor` y `sujeto`, y el resumen de `DEC-OBS-001` lista cada acción que mueve plata
   con los dos. El acto recae sobre una vertical y sobre todos sus dueños, así que la regla 5 se
   cumple sola, y un `SUPER_ADMIN` que además es dueño en esa vertical se discontinúa a sí mismo
   sin que el paso 3 lo vea. **Pide decisión**: (a) el sujeto es la vertical y el resumen muestra
   la vertical y cuántos dueños alcanza, sin más regla; (b) el paso 3 rechaza la acción 16 cuando
   el actor es dueño en esa vertical, como la regla 5 con una cuenta. Con (a), el caso del
   `SUPER_ADMIN` dueño queda declarado con el detector del resumen; con (b), el owner que opera
   solo y tiene una ficha en esa vertical necesita otra cuenta para discontinuarla.
2. **Las páginas de destino en el 4c.** Listan los alojamientos de su destino, y el código las
   invalida por la etiqueta de cada destino, no por una de colección. El 4c no las nombra: una
   ficha bajada se sigue viendo en la página de su destino hasta la detección de páginas viejas.
   Es texto (sumarlas), pero son una purga por destino y el tope de purgas del borde es bajo, así
   que puede pedir decidir cómo.
3. **`PB4`, `PB6` y `PB12` tienen la forma de `PB10`**: liberan cupo, no toman el lock y comparten
   `desde` con `PB3` o `PB9`. `PB12` contra `PB3`: el dueño borra una ficha mientras `PB3` la
   restituye, y `PB3` escribe `PUBLISHED` sobre una ficha que acaba de pasar a `PURGED`. El arreglo
   es el mismo de `PB10` o la regla general de `22-` §4, y vacía la viñeta de las que liberan cupo.
   No lo apliqué porque nadie lo nombró; es texto, pero cambia una viñeta de diseño.
4. **Fastmail y Yandex**: documentan el `+` y quedan *«tal cual»* por el §5 de `25-`, así que dan
   un trial por `+alias`. Quedó declarado en el «NO cierra» de `V/02` §2.2. Si el owner quiere
   cerrarlo, es sumarlos a la fila del `+`.
5. **La medición de `V2-j4` sobre la tabla de usuarios de producción** lee correos de personas.
   El paso 0 sólo cuenta dominios; no lo escribí como restricción porque la decisión no la nombra,
   pero conviene que la herramienta no exporte las casillas.

## Key Learnings

1. Una decisión que dice *«en todos los dominios»* sobre un subconjunto (los propios) sólo se
   construye si ese subconjunto es el complemento de la lista: desde un correo no se distingue un
   dominio propio de un proveedor que la lista no nombra.
2. Un guard que recorre el esquema por una columna (`entity_type`) atrapa tablas que la lista dejó
   afuera por lectura (`revalidation_config`): para que nazca verde, la lista tiene que nombrar
   también lo que no toca.
3. De dos arreglos de texto equivalentes para una carrera entre jobs, el que no depende del orden
   (`PB9` no borra con el hecho 4 pendiente) además libera a la otra pieza de recordar su corrida
   anterior.
4. Extender una viñeta de lock a una transición (`PB10`) muestra que la justificación de la
   exención (*«sólo liberan cupo»*) valía para el conteo y no para el `desde`: las otras tres de la
   misma viñeta tienen la misma forma.
5. Un reintento automático no choca con *«el sistema no ejecuta acciones de plata»* si ejecuta lo
   que una persona ya confirmó y nada más: es la forma de `S9`, y la excepción tiene que nombrar su
   alcance para no abrir las otras quince.
