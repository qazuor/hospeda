---
title: "FASE 5 · aplicación — el paraguas: el corte, la limpieza y las unidades"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación del paraguas

Aplica al paraguas las decisiones de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) y
las piezas de [`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md). Estilo: lo que
cambia queda tachado al lado de lo nuevo, con su origen. Sin commits.

## 1. Archivos tocados

- `$D/16-fase-7-del-paraguas.md` (§1, §4.2 entero, los párrafos que lo siguen, las herramientas del
  corte, la rama de aborto, §4.3 y §4.6).
- `$D/11-particion-del-programa.md` (filas 07 y 08 de la tabla de capítulos).
- `.specs/HOS-1352-billing-verticals-redesign/spec.md` (encabezado, conteo de decisiones y cierre).

## 2. Qué se aplicó

Las citas son de la línea actual del archivo. `16` = `$D/16-fase-7-del-paraguas.md`.

### Lote de simplificación del corte (A a E) y sus piezas

**§1 (feature flags).**

- `16:51` «no son interruptores**: son actos» — el Worker sale (S-45) y entra el apagado de crons
  con `HOSPEDA_CRON_ADAPTER` como acto operativo (lote 3 E).

**Paso 0 (S-16, S-33, S-34, S-35, S-57 a S-61, S-08, S-28, S-45).**

- `16:131` «tres cosas y ninguna en producción» — ensayo en `staging`, lista del seudónimo y tope de
  purgas.
- `16:131` «`EX-42` no se mide, por decisión» (S-59, S-43).
- `16:131` «`EX-44` y `EX-45` pierden el sujeto del corte» (S-60, S-61: sandbox antes de `B11`).
- `16:131` «`EX-48` no se mide, por decisión» (S-57).
- `16:131` «`EX-50` no se mide, por decisión» (S-58).
- `16:131` «las cinco pruebas que el script del corte escribe después de la migración del paso 3»
  (S-12, lote 2 D).
- `16:131` «Salen los dos recuentos: el 4c corre siempre» (S-08, S-28); el ensayo del Worker, tachado.

**Paso 0b (S-25, S-26, S-72, S-43).**

- `16:132` «bloquear toda escritura: una sola regla en el borde» — sin lista de rutas ni 30 minutos.

**Pasos 1a, 1b y 2 (S-07, S-43, S-44, S-57, S-31, S-36).**

- `16:133` «sale el vencimiento de las `Preference`: FASE 5».
- `16:133` «Sale el recuento: cualquier ficha de esas verticales».
- `16:134` «Sale la condición: la ventana del corte y `EX-48` salieron».
- `16:135` «el paso 2 es esto y nada más: la relectura por id y la completitud del recorrido».

**Paso 2b (lote D; S-15, S-22).**

- `16:136` «abortar es eso y nada más: restaurar este backup».

**Paso 3 (lote 3 E y F, lote 1 J, lote 2 D, lote 3 A, B y D; S-01, S-02, S-04, S-09, S-12, S-14,
S-26, S-27, S-45).**

- `16:137` «desplegar, en tres actos y con los crons apagados».
- `16:137` «se exige la igualdad de commit».
- `16:137` «y borra las filas de las fichas de todas las demás cuentas, sin conservar nada».
- `16:137` «y borra las columnas viejas del estado de la ficha» (lote 3 A) y las tres que
  sobrevivieron a `U1` (lote 3 B).
- `16:137` «Después de migrar, el script del corte escribe las cinco pruebas con sus seudónimos».
- `16:137` «Qué herramienta las escribe vuelve al owner» (abajo, §5, 2).
- `16:137` «antes del merge de `V6`» (lote 3 D; S-78 no se toca: sólo cambia el cuándo).
- `16:137` «Salen los recuentos repetidos: con la regla del 0b nadie crea nada» (S-27).
- `16:137` «La ruta de avisos no se cierra: la regla del 0b la deja abierta, el Worker salió» (S-45).
- `16:137` «Qué pasa con un aviso emitido entre el apagado del viejo» (abajo, §5, 3).
- `16:137` «Despliega bajo la regla del 0b, que es una sola para los dos sitios» (S-26).

**Pasos 3a, 3b, 4, 4b, 4c, 5 y 5b.**

- `16:138` «en SQL generado por un script TypeScript y vigilado por un guard» (lote 2 D).
- `16:139` «las otras tres de la lista del owner, y el grant convierte esas dos pruebas» (S-02,
  S-13 sin cambio de fondo); sale *«como la del paso 4»*.
- `16:140` «no hay lápidas del corte ni ruta que abrir» — el paso 4 entero, tachado (S-40, S-45).
- `16:141` «su ruta de siempre, que la regla del 0b deja abierta» y «Este paso no mueve nada, sólo
  mira.» (S-48 se mantiene).
- `16:142` «borró y que el viejo servía, las tres colecciones y los 22 destinos. Corre siempre»
  (S-28).
- `16:143` «levantar la regla del 0b y prender los crons»; «ni sus crons mandaron nada» (lote 3 E);
  la segunda situación de §4.3 sale de la celda (S-17).
- `16:144` «borrar las fotos en el almacenamiento externo y revocar en el proveedor el token de
  calendario» (S-04); «y de dónde saca el 5b la lista de lo que borra» (abajo, §5, 4).

**Paso 6 (lote 2 C y D, lote 1 C).**

- `16:145` «como `e2e-pr`**, así que las filas de referencia tienen una sola fuente» (lote 2 C).
- `16:145` «genera el SQL del catálogo que esa migración lleva» (lote 2 D).
- `16:145` «Salen antes, en `U1`, con todas las migraciones de datos del seed» (lote 1 C).

**Párrafos que siguen a la tabla.**

- `16:165` «ya no hay lápidas del corte: S-40» (manifiesto de sondas; S-47 se mantiene).
- `16:178` «cuando levanta la imagen nueva, y le llegan como desconocidos» (S-45, S-46).
- `16:195` «le llega al receptor nuevo como un desconocido más» (S-40, S-41, S-46).
- `16:201` «Y en esa ventana nadie escribe nada» (S-25); `16:205` «cuando él elija» (S-52).
- `16:217` «Las cinco pruebas que se escriben después de migrar, el 5b y el 6 son las tres
  escrituras a mano» (S-40, lote 2 D).
- `16:227` «Un cobro viejo que llega tarde entra como desconocido» (S-40, S-46).
- `16:240` «Las cinco fichas de la lista del owner nacen `PUBLISHED`» (S-01, S-02).
- `16:245` «El owner elige cuándo avisa» (S-52); `16:256` «Va a las cinco cuentas de la lista»
  (S-51); `16:272` «Salen la pasada del» (S-37, S-38).
- `16:278` «Sale el guion del aviso» — los cinco puntos, tachados (S-50).
- `16:316` «queda constancia del aviso lo cubre `DEC-MIG-007`» (S-53); el correo de baja del viejo
  queda (S-54).
- `16:323` «Un aborto ya no reactiva planes: S-15.»

**Las herramientas del corte (S-69, S-39, S-75, S-40, S-42, S-73, S-74, S-25, S-45).**

- `16:327` «simplificación del corte son cinco» — de seis a cinco.
- `16:339` «El manifiesto lleva los ids» cancelados y releídos, sin datos de personas (S-39, S-75).
- `16:363` «lápidas del corte ni detector posterior» — el punto 2, tachado.
- `16:376` «sobre las cinco» (S-67, en lo que toca a `16`).
- `16:384` «La regla que bloquea toda escritura»; `16:394` «(sale el Worker: S-45)».

**Rama de aborto (lote D; S-15, S-24).**

- `16:421` «abortar es restaurar el backup del 2b y volver a la imagen».
- `16:424` «Qué pasa con la regla del 0b después» (abajo, §5, 1).
- Puntos 1, 3 y 4 tachados (`16:476` «(S-15: nadie se re-suscribe)»); en el 2 salen el inverso (a)
  de la ruta en el borde (S-24) y las lápidas.

**§4.3 (S-17, S-18, S-21, S-38, S-44).**

- `16:517` «Sale la parte del corte» (S-44).
- `16:522` «dos situaciones, declaradas por decisión del owner»; `16:546` «sale: su población son
  las tres cuentas conocidas; S-17»; la cuarta, tachada con `(… S-18)` en `16:564`.
- `16:566` «Estas dos se releen» (S-21).
- `16:581` «`R5-22` por la misma premisa, `DEC-MIG-007`, punto 3.)» (S-38).

### Lote 1 (A a J) y lote 2 E — `U1` crece (§4.6)

- `16:640` «cuatro cosas, en el mismo cambio».
- `16:682` «Suelta lo que el cobro viejo dejaba enredado en lo que sobrevive», con una viñeta por
  letra: `16:684` «saca los gates de entitlement y de limits de las rutas de las verticales» (A);
  `16:689` «renombra `billing_notification_log` a un nombre neutro» (B); `16:692` «saca de la rama
  las migraciones de datos del seed que usan el cobro viejo» (C); `16:695` «borra las columnas de
  pago de `partners`, sus FK y los tres crons de partner» (D); `16:697` «borra
  `users.service_suspended`, `owner_promotions.plan_restricted` y» (E); `16:700` «retira
  `is_featured` y `featured_by_entitlement` en las tres tablas» (F); `16:702` «borra el cron
  `archive-abandoned-drafts`» (G); `16:703` «reescribe los extras `032` (nombre y comentarios) y
  `033` (comentario)» (H); `16:705` «recrea los enums de la base sin los valores del cobro viejo»
  (I); `16:708` «borra las cuatro variables de rate limit del cobro y las diez que sólo usa el
  sistema viejo» (lote 2 E).
- `16:720` «Las migraciones de datos del seed que usan el cobro viejo ya no están en la rama» (lote
  1 C, en *«qué deja demostrado»*).
- `16:753` «Y lo del punto 4, cada ítem con la lista cerrada» (fila de `U1`).
- La J del lote 1 no es de `U1`: va en el paso 3 (arriba).

### Lote 3 B y S-09 — las tres columnas que sobreviven

- `16:654` «no las usa sólo el cobro viejo:» — corrige *«sólo las usa el cobro viejo»*; siguen
  vivas hasta `V6` por la B del lote 3 y sale la razón `L5`/`L7` y la condición de orden.

### Lote 2 A y B — la unidad `U2`

- `16:748` «tiene 24 unidades: nueve de verticales, trece de billing y».
- `16:754` «| **U2** ✚ | **el outbox común**» — la fila: qué deja funcionando, guards (`16:754`
  «ninguno de los 33 guards del programa es del outbox»), y cuándo está lista, sólo con lo que
  `NUCLEO/07` §1 a §4 y `NUCLEO/08` §2 ya dicen; `16:754` «Ningún correo del catálogo de
  `NUCLEO/07` §6» va marcado como derivado.
- `16:763` «**`U2` no suma ninguno**» (guards: siguen 33).
- `16:768` «`V1`, `B1` **y `U2`**» (quién depende de `U1`).
- `16:775` «**`U2`, el outbox común** (FASE 5, owner 2026-09-30, lote 2 A y B)» — dónde vive,
  dependencias y quién depende; `16:783` «no le suma ninguna a las doce de `B/descomposicion.md`
  §2.6».
- `16:810` «el cierre del borde y las lápidas salieron» (el cierre de §4.6).

### `11-` y `spec.md`

- `11-particion-del-programa.md:183` «y lo construye `U2`, una unidad del paraguas» (lote 2 A).
- `11-particion-del-programa.md:184` «y la correlación la construye `U2`, con el outbox» (lote 2 B).
- `spec.md:19` «dos unidades propias»; `spec.md:24` «24 unidades**: nueve de verticales».
- `spec.md:85` «**142 decisiones** (al 2026-09-28» y `spec.md:156` «**142 decisiones**, 17 de» —
  recontadas con script (§6), con `DEC-METH-017`, `DEC-ARCH-015` y `DEC-MIG-007`.
- `spec.md:208` «primera unidad del paraguas».

## 3. Lo que no se aplicó y por qué

- **No están en mis archivos**: S-03 (`DEC-MIG-002`, `B/21`), S-05, S-06, S-10, S-11, S-56, S-77
  (`V/21`), S-29, S-30, S-76 (`B/21`), S-57 a S-65 en la matriz, S-66 y S-70 (`B`), S-67 en
  `V/descomposicion.md`. De S-67 apliqué lo que `16` dice de `V6` (herramientas, punto 4).
- **MANTENER, sin tocar**: S-13, S-14, S-19, S-20, S-22, S-23, S-31 a S-35, S-46 a S-49, S-54,
  S-55, S-64, S-65, S-68, S-71, S-78 (de S-78 sólo cambia el cuándo, por el lote 3 D).
- **Lote 3 C (`R5-17`)**, lotes 4 a 6 (`R5-23` a `R5-29`) y `R5-18`: ninguno toca mis archivos.
- **`U1` y la portada del 4c**: la purga de la portada queda en el 4c aunque la home pierda los
  destacados (lote 1 F); lo marqué como derivado en la celda, sin decidir nada nuevo.

## 4. Para otro dueño

- **`V/21` §2.4, l.220-222** (dueño de `V/21`): *«sólo las usa el cobro viejo»* → *«tienen lectores
  fuera del cobro, que `V6` retira en el mismo cambio que la migración que las borra (FASE 5, lote
  3 B)»*; y sale la razón `L5`/`L7` (S-09).
- **`V/20` §2** (dueño de `V/20`): la lista de pendientes de `G8` deja de cubrir `extras/` (lote 1 H;
  `16:703` lo remite ahí).
- **`V/descomposicion.md` y `B/descomposicion.md`**: `U2` entra como dependencia de `V6`, `V9`, `B4` y
  `B12`, y el total de unidades pasa a 24; no suma dependencias entre épicas (las doce de
  `B/descomposicion.md` §2.6 siguen).
- **`NUCLEO/02` §1.5 (dueño del núcleo)**: los plazos sin valor se fijan *«antes del merge de `V6`»*,
  no *«antes del ensayo del corte en `staging`»* (lote 3 D), si no lo aplicó ya.
- **Log (su dueño)**: los cambios de estado del §11 de `20-` (lote E).

## 5. Vuelve al owner

**1 · La regla que bloquea toda escritura, después de un aborto.** Elegiste que abortar sea
restaurar y volver a la imagen vieja *«sin reabrir la venta»*, y que una sola regla bloquee toda
escritura *«hasta abrir el sistema nuevo»*. Si abortamos, el sistema nuevo no se abre ese día, y no
está dicho si la regla sigue puesta hasta el reintento. Juan, que vive del sitio, no puede ni
loguearse mientras siga.

1. **La regla queda puesta hasta el reintento.** Costo: cero de diseño. Riesgo: si el reintento
   tarda días, toda la plataforma queda en sólo lectura ese tiempo, no sólo el cobro.
2. **La regla se levanta al abortar.** Costo: cero. Riesgo: el viejo vuelve a vender por su checkout
   propio (el preapproval sin plan), contra *«sin reabrir la venta»*; quien se suscriba ahí no está
   en tu lista, y en el reintento su débito se cancela y su ficha se borra.
3. **Se levanta la regla general y se pone, hasta el reintento, una sobre las rutas de venta del
   viejo** (checkout, su reintento, cambio de plan, cambio de medio de pago, compra de addon).
   Costo: vuelve, sólo para el aborto, la lista de rutas que retiraste en B. Riesgo: olvidar una
   ruta. **Recomendada**: es la única que cumple *«sin reabrir la venta»* sin dejar el sitio en
   sólo lectura por un plazo que nadie fijó.

**2 · Qué herramienta escribe las cinco pruebas.** En el lote 2 D elegiste que las pruebas y sus
seudónimos los escriba *«después el script del corte, con la función de la aplicación»*. Pero el
script del corte, desde L3-a y C2, no importa código de ninguno de los dos sistemas, y la función del
seudónimo es del sistema nuevo. Para escribir la prueba de Juan hay que usar esa función.

1. **La escribe la herramienta del corte de `V6`**, que es del sistema nuevo, como la de los grants
   de `B9`; el script suelto sigue sin importar nada. Costo: bajo, `V6` ya es dueña de la prueba.
   Riesgo: bajo. **Recomendada**.
2. **El script suelto importa la función de la aplicación.** Costo: bajo. Riesgo: rompe L3-a/C2;
   el script pasa a depender del sistema nuevo.
3. **El script reimplementa la función.** Costo: dos implementaciones de una función que no puede
   cambiar. Riesgo: medio (la normalización por proveedor), lo que `R5-13` ya descartaba.

**3 · Un aviso de Mercado Pago en el rato entre apagar el viejo y levantar la imagen nueva.** Con el
Worker afuera (C1), la ruta de avisos queda abierta en el borde, pero en ese rato no la atiende
ningún servidor. El Worker, además de cuidar las lápidas, garantizaba un `500`, el único código
medido que Mercado Pago reintenta (`WH-4`). Si un cobro en vuelo de Juan (una de las tres cuentas con
débito) avisa justo ahí y Mercado Pago no reintenta, ese cobro no llega al sistema nuevo y no te
aparece para decidir la devolución. Filtrado contra `DEC-MIG-007`: la población son las tres
cuentas que conocés, pero C1 te prometía que el cobro te aparecería.

1. **Declararlo y aceptarlo**: son minutos y tres cuentas; si pasa, te enterás por la persona o por
   tu cuenta de Mercado Pago (punto 4 de `DEC-MIG-007`). Costo: cero. Riesgo: bajo, un cobro que no
   ves desde adentro. **Recomendada**, por `DEC-MIG-007` puntos 3 y 4.
2. **Medir en sandbox si Mercado Pago reintenta ante la respuesta del borde con el servidor caído**,
   antes del ensayo; una fila nueva de la matriz. Costo: una medición. Riesgo: bajo.
3. **Volver a un Worker mínimo sólo para ese rato.** Costo: el Worker que retiraste en C, más su
   ensayo. Riesgo: bajo.

**4 · De dónde saca el 5b la lista de lo que borra.** La migración del paso 3 borra las filas de las
fichas que no son de las cinco, y el 5b, días después, tiene que borrar sus fotos y revocar sus
tokens de calendario. Sin las filas, no queda en la base qué fotos eran de la ficha de Juan.

1. **Antes del paso 3, con la regla del 0b puesta, la herramienta de `V6` lee de producción la lista
   de fotos y tokens de esas fichas y la guarda, fuera del repositorio, hasta el 5b.** Con la regla
   puesta, nada cambia en el medio. Costo: bajo. Riesgo: bajo. **Recomendada**: no agrega tabla ni
   barrido.
2. **La migración, antes de borrar, copia esas referencias a una tabla de paso** que el 5b lee y
   después borra. Costo: una tabla más en la migración del corte. Riesgo: bajo.
3. **El 5b barre el almacenamiento y borra toda foto sin fila que la nombre.** Costo: bajo. Riesgo:
   medio, puede tocar archivos de otras entidades si comparten almacenamiento.

## 6. Conteos

| qué | antes | después | comando |
|---|---|---|---|
| unidades del programa | 23 | 24 | `rg -c '24 unidades\|23 unidades'` sobre `16` y `spec.md`, y lectura de la fila |
| herramientas del corte en `16` | 6 | 5 | lectura de la lista numerada; el punto 2 queda tachado |
| situaciones de §4.3 que no deshace una restauración | 4 | 2 | ídem, puntos 2 y 4 tachados |
| guards | 33 | 33 | `U2` no suma ninguno; `rg -n -i outbox` sobre los dos `20-testing.md` → 0 |
| decisiones del log | 139 (en `spec.md`) | 142 | `rg -o '^### DEC-[A-Z]+-\d+' docs/01-decision-log.md \| sort -u \| wc -l` → 142; con `rg -c DEC-METH` sobre esa lista → 17 |
| piezas `S-NN` citadas en `16` | 3 | 53 | `rg -o 'S-\d\d' 16-fase-7-del-paraguas.md \| sort -u` |
| piezas con `16` en su lugar, RETIRAR o SIMPLIFICAR, sin aplicar | — | 0 | script sobre las filas de `20-` §1-§9 cruzado con la lista anterior |
| marcas `~~` en `16` | 290 | 614 | `python3`, `s.count('~~')` sobre la copia previa y el archivo |
| celdas o párrafos de `16` con `~~` impar | — | 0 | `python3`, por celda de tabla y por ítem de lista |
| markdownlint (`16`, `11-`, `spec.md`) | 0 | 0 | `npx markdownlint-cli2 <archivo>` |
