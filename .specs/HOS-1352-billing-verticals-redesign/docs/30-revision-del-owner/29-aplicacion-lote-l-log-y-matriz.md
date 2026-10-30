---
title: "Revisión del owner · el lote L y el lote de las mediciones, en el diseño, el log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · el lote L y el lote de las mediciones, en el diseño, el log y la matriz

El **lote L** de [`27-decisiones-sobre-las-mediciones.md`](./27-decisiones-sobre-las-mediciones.md)
(las cuatro decisiones que dejó [`28-`](./28-aplicacion-mediciones-al-diseno.md) § 3, más la letra
E, el OK al lote de `28-` § 4), aplicado al diseño y escrito en `$D/01-decision-log.md`,
`$D/06-mp-validation-matrix.md` y `$D/contar-filas-de-la-matriz.py`. Para esta tarea el owner dio OK
a editar esos tres archivos (letra E); el PDR y los informes históricos no se tocaron. Editado en el
worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `61aa571c18`, sin commits. El log,
la matriz y el script eran idénticos a las copias de `28-` (`aplic-28/*-original.*`), así que los
textos de § 4 se aplicaron tal cual salvo lo que el lote L cambia, que se dice abajo.

Marca en el diseño: *(mediciones del 2026-09-29, lote L-letra)*. Abreviaturas: `B/` es
`HOS-1354…/docs`, `D/01` el log, `D/06` la matriz, `$B/` y `$D/` las raíces.

## 1. Qué se aplicó al diseño

### L-A · la baja desde la cuenta de Mercado Pago se deja como está (contra la recomendación)

Sin regla nueva: la baja del pagador cae en el par `cancelled` × *(estado vivo)* del espejo, como
una del proveedor, y corta en el acto. Se declara donde se trata la baja del proveedor, en el «NO
cierra» que la dejaba pendiente, y en el par de la tabla.

- `B/12:141` «se espeja como una del proveedor: corta en el acto»
- La consecuencia, en el mismo §1.4: `B/12:146` «esa persona pierde los días que ya pagó»
- El NO cierra, encabezado: `B/12:1159` «queda un hueco, y el owner lo acepta»
- El NO cierra, hueco (1): `B/12:1175` «se deja así por decisión del owner, contra la recomendación»
- La tabla del espejo: `B/03:2759` «no se distingue de la del proveedor (`EX-52`) y corta igual»

### L-B · la tabla guarda los dos canales y cambia de nombre

**El nombre lo elegí yo y lo marco para que el owner lo vea: `provider_notification`**, en inglés y
en singular como las demás, con el prefijo de `provider_link`, y *notification* porque es como el
proveedor llama a lo que entrega por los dos canales. Dice los dos canales porque no nombra
ninguno; si el owner lo quiere literal, `ipn_webhook_delivery` es un reemplazo en los mismos
lugares. Se grepearon **todos** los espejos de `ipn_delivery` fuera de los informes: ocho
menciones en cinco archivos, todas tachadas con el nombre nuevo al lado; no queda ninguna viva.

- El modelo, encabezado: `B/02:1219` «Las entregas de los dos canales, guardadas, que nadie lee»
- La fila, con el canal: `B/02:1227` «por cualquiera de los dos canales, IPN y Webhooks, tal cual»
- Por qué guarda Webhooks: `B/02:1231` «Por qué guarda también»
- La retención: `B/02:1252` «las entregas guardadas de los dos canales, `provider_notification`»
- `G17` (c): `B/20:68` «tampoco el receptor, ni para la entrega de Webhooks que procesa»
- Su criterio en `B1`: `$B/descomposicion.md:776` «el alta que hace el receptor ni su borrado»
- La unidad del receptor: `$B/descomposicion.md:129` «y en la misma tabla, con su canal, cada entrega de Webhooks que procesa»
- El receptor: `B/03:2716` «Una entrega de Webhooks también se guarda ahí, con su canal»
- El NO cierra de `B/06`: `B/06:530` «la misma tabla cada entrega de Webhooks, con su canal»
- La prueba de `L3-g`: `B/06:547` «las tres entregas guardadas en `provider_notification`»
- El plazo técnico: `nucleo/02:171` «una entrega de aviso, por cualquiera de los dos canales»

**Lo que el predicado (c) de `G17` suma**: antes no decía si el receptor podía leer la tabla. Ahora
que guarda la entrega de Webhooks que después procesa, la tentación es deduplicar leyéndola; el
predicado lo prohíbe, que es lo que *«sin que nadie la lea»* pide. El criterio de `B1` decía
*«que no sea el receptor»* y se alineó a *«el alta que hace el receptor»*.

### L-C · un rechazo cierra la compra del complemento de pago único

Una transición nueva de la instancia, **`A7`**: `PENDING_AUTHORIZATION` → `ABANDONED` cuando la
orden vuelve rechazada, sólo en `UNA_VEZ`. El segundo intento es otro pedido (otro identificador,
otra instancia por `A1`, otra clave). `A7` no se había usado nunca como transición (`A7` existe en
`10-evaluacion-de-proveedor.md` como otra numeración, la de los hallazgos del proveedor, y
`29-fase-8-vuelta-2/D1` lo nombraba como id inexistente, lo que era cierto entonces).

- La fila: `B/03:2528` «Un rechazo cierra la compra en el acto»
- `B/16` §1.4: `B/16:119` «y la compra se cierra en el acto»
- El segundo intento: `B/16:124` «la pantalla arranca un pedido nuevo»
- La conversión de `S20`: `B/16:405` «no corre ninguna de ~~`A1`–`A6`~~ `A1`–`A7`»
- La comprobación de órdenes pagadas: `B/09:786` «o `A7` abandonaron»
- Toda `ABANDONED` tiene su id: `B/09:789` «y `A7` abandona con el id que vino en el»
- El proveedor: `B/06:139` «y la compra se cierra en el acto»
- La unidad: `$B/descomposicion.md:136` «un rechazo de la orden cierra la compra en el acto»
- Su criterio: `$B/descomposicion.md:785` «una orden rechazada (`402`, `failed`) deja la instancia `ABANDONED` en el acto»

**Espejos revisados sin cambio**: la tabla de la regla 7 del `NUCLEO/03` §1 (el par de `A7` tiene
una sola fila; lo dice la propia fila); el censo de emisores del contrato (§3.1), porque `A7`, como
`A3`, sale de un estado que no aportaba ninguna fuente; la salvedad 1 de `B/09` §3, que es de
complementos recurrentes con preapproval.

### L-D · no se abre issue

El diseño no mencionaba abrirlo. Para que *«cuando se arregle»* no se lea como un arreglo del
receptor de hoy, lo dije al pie del caso de producción:

- `B/09:903` «no se arregla aparte»

## 2. El log y la matriz (letra E)

Aplicado con un script (`aplic-29/aplicar.py` del scratchpad) que importa los textos de
`aplic-28/propuestas.py` y `aplic-28/propuestas_log.py`, les aplica el lote L con reemplazos de una
sola ocurrencia, y ubica cada 📌 al final de su entrada (el siguiente `---` o encabezado de nivel 2
o 3, la corrección de `24-` § 4). Verificado por línea que cada 📌 quedó bajo su encabezado. Los
📌 nuevos se ajustaron al ancho de 100.

### 2.1 La matriz, como `28-` § 4.1 salvo tres cosas

Las seis marcas 🚫 van tal cual (`WH-2`, `WH-3`, `WH-4`, `EX-13`, `EX-46`, `EX-54`).

- `D/06:266` «la cola de demoras largas no se re-mide»
- `D/06:411` «la sonda 54 no se corre»
- El 📌 de `WH-6`, con el lote L-B: `D/06:270` «y guarda también cada entrega de Webhooks en la misma tabla, con su canal»
- La fila de N8, con el lote L-A: `D/06:553` «se deja como está, corta en el acto como una del proveedor»
- La fila de IPN, con el lote L-B: `D/06:554` «y Webhooks también se guarda, con su canal»

**Las tres diferencias con `28-`**: en `WH-6` el nombre `provider_notification` y la oración de
Webhooks; en la fila de N8, *«Queda una elección del owner»* pasa a lo decidido; en la de IPN, el
agregado de Webhooks.

### 2.2 El script de conteo

El de `28-` § 4.1 (`aplic-28/contar-propuesto.py`), copiado entero: agrega la marca y las dos listas
al final, sin cambiar cómo cuenta.

- `$D/contar-filas-de-la-matriz.py:75` «POR_DECISION = "🚫 No se mide, por decisión"»

### 2.3 El log

`DEC-MP-009` nueva y los cuatro 📌 de `28-` § 4.2, más dos 📌 del lote L. Grepeados antes:
`DEC-MP-009` no existía; existían `DEC-MP-008`, `DEC-SUB-009`, `DEC-TEST-003`, `DEC-DATA-008` y
`DEC-CONC-001`.

| decisión | *Estado* | 📌 | qué suma el lote L |
|---|---|---|---|
| `DEC-SUB-009` | línea 1305 | `D/01:1361` «punto 1 y lote L-A)» | su última oración ya no deja la baja pendiente: dice lo decidido y la consecuencia |
| `DEC-CONC-001` ✚ | línea 1461 | `D/01:1518` «lote L-C)» | 📌 nuevo, ver abajo |
| `DEC-MP-008` | línea 5617 | `D/01:5674` «(mediciones del 2026-09-29, punto 1)» | nada |
| `DEC-TEST-003` | línea 6546 | `D/01:6580` «puntos 3 y 4)» | nada |
| `DEC-DATA-008` | línea 6686 | `D/01:6725` «M-2 y lote L-B)» | el aviso IPN pasa a ser una entrega de aviso de cualquiera de los dos canales |
| `DEC-MP-009` ✚ | línea 6733 | `D/01:6764` «lote L-B)» | 📌 nuevo, ver abajo |

- La decisión nueva: `D/01:6731` «DEC-MP-009 — El canal IPN se escucha y se guarda, sin actuar»
- Su implicación (4), cerrada: `D/01:6758` «lo decidió el owner en el lote L, letra B»

**Dos cambios al texto de `DEC-MP-009` de `28-`**: su *Estado* nace precisado (el 📌 de L-B), y la
implicación (4), que dejaba *«como decisión del owner»* lo que guarda Webhooks, remite a la letra B.
El cuerpo sigue diciendo `ipn_delivery`, que es el nombre con que se decidió M-2: el 📌 dice que
cambió, como se hace con toda precisión del log.

**Dónde va L-C, y por qué ahí.** Ninguna decisión del log gobierna la compra de un complemento de
pago único: `DEC-ADDON-002` es de los recurrentes, y la clave del pedido (`R4`, FASE 9 vuelta 2)
sólo dejó rastro en el log como el motivo 23 de `DEC-RF-006`. Lo puse en **`DEC-CONC-001`**, el
candado contra el doble cobro, porque lo que L-C cambia es cuándo un reintento reusa la clave y
cuándo arranca otra: su implicación 2 (*«la clave se genera y se persiste antes de la primera
llamada»*) sigue, y el 📌 dice que un rechazo cierra su pedido. **Si el owner prefiere una decisión
propia** (`DEC-ADDON-008`, la compra de pago único), son 136 y cambian las cifras de § 3; no la
abrí porque la letra E pide 📌, no decisiones nuevas, más allá de `DEC-MP-009`.

**L-A no suma un 📌 aparte**: `28-` § 4.2 ya preveía que el 📌 de `DEC-SUB-009` cambiara con la
decisión 1, y cambió en su última oración.

### 2.4 El `## Resumen` y los espejos de la cifra de decisiones

- Decisiones: `D/01:6778` «~~134~~ 135 — con `DEC-MP-009`»
- Funcionales: `D/01:6780` «~~119~~ 120»
- Precisadas: `D/01:6781` «~~66~~ 68»
- La fila nueva: `D/01:6795` «1 nueva, 6 📌, 0 `SUPERSEDED`»
- El frontmatter: `D/01:6` «updated: 2026-09-29»
- La tabla de documentos del paraguas: `.specs/HOS-1352-billing-verticals-redesign/spec.md:80` «~~134 decisiones~~ 135 decisiones»
- El párrafo de la partición: `.specs/HOS-1352-billing-verticals-redesign/spec.md:149` «metodología y 120 funcionales, al 2026-09-29»
- El índice del núcleo: `nucleo/00:44` «~~134 al 2026-09-28~~ 135 al 2026-09-29»

## 3. Las cifras, recontadas

Desde `$D`, sobre los archivos reales. Ninguna se forzó.

| qué | antes | después | comando |
|---|---|---|---|
| filas de la matriz | 114: 61 · 15 · 24 · 14 | **114: 61 · 15 · 24 · 14** | `python3 contar-filas-de-la-matriz.py` |
| `UNKNOWN` que esperan medición | 14 (no se distinguía) | **12** | el mismo script, lista nueva |
| no se miden, por decisión | 0 | **6**: `WH-2`, `WH-3`, `WH-4`, `EX-13`, `EX-46`, `EX-54` | el mismo script, lista nueva |
| decisiones | 134 | **135** | `rg -o "^### DEC-[A-Z]+-\d+" 01-decision-log.md \| sort -u \| wc -l` |
| precisadas sin `SUPERSEDED` | 66 | **68** | `contar-precisadas.py` (el de `24-` y `28-`) |
| `SUPERSEDED` | 11 | **11** | `rg -c "\*\*Estado\*\*.*SUPERSEDED" 01-decision-log.md` |
| transiciones de la instancia de addon | 6 | **7** (`A7`) | filas `A<n>` de la tabla de `B/03` §8; ningún espejo las cuantifica |

**Por qué 68 y no 66, que es lo que `28-` § 4.2 simuló**: los cuatro 📌 de `28-` caen sobre
decisiones ya precisadas y no suman, como decía `28-`; los dos que suma el lote L sí: `DEC-MP-009`,
que nace y se precisa el mismo día (L-B), y `DEC-CONC-001`, que estaba en `ACCEPTED` a secas (L-C).
El script lo confirma: entran exactamente esas dos y no sale ninguna.

**Lo que no se movió**: los 33 guards, las 33 transiciones vivas de la suscripción, los 24 motivos,
las 21 acciones administrativas, los cuatro pares de la regla 7 que cuenta `G-R4`, los tres
predicados de `G17`, las entidades del modelo (`provider_notification` es la misma, renombrada) y
los 15 plazos configurables.

## 4. Casos vecinos

Ninguno bloquea.

## 5. Para la implementación

1. **El orden entre guardar y procesar una entrega de Webhooks** no está escrito: el diseño dice
   que se guarda y que se procesa, y que el receptor sólo contesta error si no pudo procesar ni
   guardar. Si guardar falla y procesar no, la revisión de HOS-1399 pierde esa entrega; es un dato
   para una revisión, no plata, así que no lo elevé.
2. **La baja desde Mercado Pago sigue sin correo nuestro** y sin fila en `B/19` §4 que le diga qué
   pasa con sus fichas (`B/12`, «NO cierra»). La letra A eligió la opción 2, no la 3 (el correo), así
   que es lo aceptado; lo anoto porque la frase sigue en el hueco (1) y alguien puede leerla como
   pendiente.
3. **El caso de `A5` en la regla 7 del `NUCLEO/03` §1** dice que comparte el `desde` *«con `A2` y
   con `A3`»*, y desde `K-9` también lo comparte `A6`, y ahora `A7`. No es de este lote y la regla
   ya se cumple (eventos distintos); es una enumeración incompleta.
4. **`03-handoff.md`** sigue con las cifras viejas (134 decisiones, 66 precisadas, N8 y `L3-g` por
   decidir): lo actualiza el owner (`15-` § 3).

## Key Learnings

1. Una decisión nueva que otra del mismo día precisa sube la cifra de precisadas aunque la
   simulación anterior dijera que no: la simulación no conocía la segunda decisión. Recontar con el
   script sobre el archivo final, no heredar la cifra simulada.
2. Una decisión de diseño sin `DEC` donde colgarse (la compra de pago único no tiene ninguna) obliga
   a elegir entre abrir una nueva o precisar la más cercana; hay que decir cuál se eligió y qué
   cifras cambia la otra.
3. Guardar una copia de lo que además se procesa abre una lectura tentadora (deduplicar contra la
   copia); el guard tiene que nombrar también al que escribe, no sólo a los demás.
