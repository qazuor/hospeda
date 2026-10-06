---
title: "FASE 5 · aplicación — verticales: migración, descomposición y spec"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · aplicación: la migración, la descomposición y la spec de verticales

Aplicación de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) y de
[`20-simplificacion-del-corte.md`](./20-simplificacion-del-corte.md) sobre los tres archivos de
la épica de verticales que tiene este dueño. Todo lo que cambia está tachado al lado de lo nuevo,
con su origen entre paréntesis. `V/21` = `HOS-1353/docs/21-migracion.md`, `V/desc` =
`HOS-1353/descomposicion.md`, `V/spec` = `HOS-1353/spec.md`. Las citas son de líneas del worktree
del programa al terminar esta aplicación.

## 1. Archivos tocados

- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md`
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md`
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md`

## 2. Qué se aplicó

### Simplificación del corte (lote A, J del lote 1, lote 2 D)

- S-01, S-02, lote A y J: la migración carga la lista cerrada de cinco fichas y borra las demás.
  `V/21:89` «carga una lista cerrada de cinco fichas, que fija el owner»
- Ídem, en el párrafo del estado de nacimiento.
  `V/21:195` «escribe a cada una de las cinco fichas de la lista el estado con que la lista la carga»
- S-01: sale la tabla `L1`–`L8` (sus celdas quedan tachadas).
  `V/21:230` «Sale la tabla entera, con sus ocho clases: ninguna ficha se clasifica»
- Ídem, la nota sobre la tabla tachada.
  `V/21:276` «Sale entera, con sus ocho clases: FASE 5, simplificación del corte, S-01»
- Ídem, el párrafo de `L5` y `L7`.
  `V/21:295` «sin tabla no hay `L5` ni `L7`»
- S-01 en `PRE_TRIAL`: las cinco amanecen en `TRIAL_ACTIVE`.
  `V/21:121` «las cinco cuentas de la lista»
- S-01 y S-02 en la spec §6.
  `V/spec:428` «owner cuando esté listo para el corte, una por cada cuenta de `DEC-MIG-007`»
- S-03 (contradicción con `DEC-MIG-002`), resuelta por el lote A: quien entre, el owner lo suma.
  `V/21:92` «si entra alguien que el owner quiere conservar, lo suma a la»
- S-04: el 5b borra fotos y tokens de las fichas borradas; la base la borró la migración.
  `V/21:327` «Qué borra el paso 5b»
- Ídem, lo que S-04 reabre (vuelve al owner, §5).
  `V/21:332` «Lo que esto reabre, y no está decidido»
- S-05: sale el «NO cierra» de la ficha borrada por un admin.
  `V/21:749` «sin distinguir quién»
- S-06: `REJECTED` ya no se lista para moderar.
  `V/21:307` «del corte, S-06.) **La columna se borra en el paso 3»
- S-07: sale el recuento de Gastronomía y Experiencia, las tres veces.
  `V/21:245` «Sale el recuento de Gastronomía y Experiencia, las tres veces»
- Ídem en §4.
  `V/21:623` «con la consulta de `B/21` §1.3 (FASE 9 vuelta 1, R7)~~ no se re-cuentan»
- Ídem en `V/desc` §2.10 (dos filas).
  `V/desc:409` «*(el recuento sale: FASE 5, simplificación del corte, S-07)*»
  `V/desc:418` «| **sale** (FASE 5, simplificación del corte, S-07) | — |»
- S-08: una ficha por cuenta es premisa; salen el recuento del paso 0 y su «no se diseña».
  `V/21:222` «Una ficha por cuenta es premisa»
- Ídem, en la prueba del corte y en el «NO cierra».
  `V/21:223` «si una»
  `V/21:733` «cuenta es premisa (`DEC-MIG-007`, punto 3), y sale el recuento del paso 0»
- S-09 y lote 3 B: las tres columnas siguen hasta `V6` por sus lectores; sale la razón `L5`/`L7`;
  se corrige *«sólo las usa el cobro viejo»*.
  `V/21:255` «que no sólo usa el cobro viejo: las leen también la»
  `V/21:259` «Siguen vivas hasta `V6` por esos lectores, no por»
  `V/21:268` «las borra la migración de `V6` que se aplica en el paso 3, en el mismo cambio que retira sus»
- S-10: sale la historia de R1 sobre cómo vuelve la cartera y la llamada que tarda.
  `V/21:359` «Retirado entero, con lo que sigue hasta»
- S-11: sale el «NO cierra» de la vertical sin trial.
  `V/21:742` «Alojamiento (`DEC-MIG-001`, `G1-3`; FASE 5, simplificación del corte, S-11)»
- S-12 y lote 2 D: la prueba de las cinco la escribe el script del corte, con la función de la
  aplicación, después de la migración.
  `V/21:474` «El script del corte, después de la migración estructural del paso 3, le escribe a cada una de»
  `V/21:497` «Correr el script dos veces no escribe dos»
  `V/21:500` «desde el lote 2 D, el script del corte»
  `V/21:177` «corte, después de la migración del paso 3, les escribe la prueba activa»
  `V/spec:437` «migración, le escribe a cada dueño una prueba gratis activa que arranca ese día, con la función de»
- S-13 (MANTENER), citada donde las dos cortesías reciben la prueba.
  `V/21:179` «S-13, que lo mantiene»
- S-14 (MANTENER): la escritura `C` pasa a cinco filas.
  `V/21:381` «cinco fichas de la lista nacen con `inactiva_desde` = el instante del corte»
- S-28: el 4c corre siempre, sobre las fichas borradas, las colecciones y los 22 destinos.
  `V/21:212` «El 4c corre siempre»
  `V/desc:410` «desde la FASE 5, las fichas borradas que el viejo servía, y el 4c corre siempre»
- S-35 (MANTENER): la lista de proveedores del seudónimo.
  `V/21:515` «S-35, que la mantiene»
- S-36: sale el recuento de seudónimos compartidos.
  `V/21:519` «son cinco filas, que el script»
  `V/21:509` «Una condición nueva del corte»
- S-40 (consecuencia en este capítulo): la lápida del corte deja de figurar entre las filas nuevas.
  `V/21:465` «cortesías del owner escritas como el caso normal del diseño nuevo (la»
- S-51 y S-53: el aviso es del owner, a las cinco, por privado.
  `V/21:698` «a las cinco cuentas de la lista** lo decide el owner»
- S-52: *«el owner elige cuándo avisa»*.
  `V/21:524` «El owner elige cuándo avisa»
- S-55 (MANTENER), citada: la campaña previa sigue.
  `V/21:526` «de toda prueba, no uno del corte (S-55)»
- S-56: sale la condición de caducidad.
  `V/21:602` «Sin condición de caducidad»
- S-67: `V6` carga cinco fichas, borra el resto, corre el 4c siempre y el 5b sobre lo borrado.
  `V/desc:59` «la carga de la lista cerrada de cinco fichas que fija el owner»
  `V/desc:625` «sobre una base con fichas de varias cuentas y una lista de cinco, la migración del paso 3 deja»
  `V/desc:625` «y la herramienta del paso 5b borra las fotos del almacenamiento externo»
  `V/desc:625` «y la herramienta del paso 4c, que corre siempre»
  `V/desc:538` «| **el corte simplificado**: la lista cerrada de cinco fichas»
- S-77: sale el límite del día 180 de la agenda de llamados.
  `V/21:416` «no hay agenda de llamados, y las fichas»
  `V/21:710` «agenda de llamados (FASE 5, simplificación del corte, S-77)»

### Lote 1

- A: `V5` agrega el paso de cobertura y su criterio de salida.
  `V/desc:58` «y el paso de cobertura en toda ruta de escritura de vertical»
  `V/desc:624` «y ninguna ruta de escritura de vertical queda sin el paso de cobertura»
  `V/desc:531` «**criterio de salida: ninguna ruta de escritura de vertical sin el paso de cobertura**»
- A a I y lote 2 E: lo que `U1` suma a la limpieza, en su fila del §2.11.
  `V/desc:485` «lo que `U1` suma a esa limpieza, todavía sin código nuevo del diseño»
- F: `is_featured` lo borra `U1` en las tres tablas.
  `V/21:311` «lo borra `U1` en las tres tablas, con»
- H: `U1` reescribe `032` y `033`, y la lista de pendientes de `G8` deja de cubrir `extras/`.
  `V/desc:485` «reescribe los extras `032` (nombre y comentarios) y `033` (comentario)»
  `V/desc:620` «la de migraciones sin `extras/`»
  `V/desc:485` «y un extra nuevo que la nombra pone `G8` en rojo desde el primer día»
- J: ver la simplificación del corte, arriba; y en §2.4, lo que el corte borra.
  `V/21:450` «borra**: las filas de toda ficha que no es de las cinco»

### Lote 2

- A: `U2`, el outbox común; `V6` y `V9` pasan a depender de ella.
  `V/desc:522` «### 2.13 Lo que la FASE 5 agregó, y qué unidad lo construye»
  `V/desc:530` «| **`U2`, el outbox común**»
  `V/desc:549` «U2 (del paraguas: el outbox común, FASE 5, lote 2 A) ──► V6, V9»
  `V/desc:560` «| **`U2` antes de las que encolan**»
  `V/desc:59` «y `V6` depende de `U2`, el outbox común»
  `V/desc:62` «y `V9` depende de `U2`, el outbox común»
- A (conteo): unidades 24.
  `V/desc:583` «~~**23**~~ **24** unidades»
- D: catálogo como SQL generado y guard que lo regenera; pruebas del corte por el script.
  `V/desc:487` «el catálogo va en la migración como SQL generado por un script TypeScript»
  `V/desc:514` «el script del corte escribe después cada prueba del corte»

### Lote 3

- A: el estado nuevo reemplaza a las tres columnas viejas; `V6` migra lectores y revalidación.
  `V/21:270` «Y la misma migración borra»
  `V/desc:59` «y el estado nuevo de la ficha reemplaza a `lifecycle_state`, `visibility` y `moderation_state`»
  `V/desc:625` «ningún archivo lee `lifecycle_state`, `visibility`, `moderation_state`, `owner_suspended`»
- B: `V6` retira los lectores de las tres sobrevivientes en el mismo cambio que la migración.
  `V/desc:59` «y retira los lectores de `owner_suspended`, `plan_restricted` y `billing_unpublished_at`»
  `V/desc:513` «en el mismo cambio que retira sus lectores**»
- C: salen las puertas de borrado y restauración fuera del diseño; el borrado del dueño es
  `PB12` (ver §4, punto 1).
  `V/desc:59` «el borrado del dueño es el del diseño (`PB12`)»
  `V/desc:536` «| **las puertas de borrado y restauración fuera del diseño**»
  `V/desc:625` «y no queda ruta que borre una ficha fuera de `PB12` y la acción 23»
- D: los plazos sin valor, antes del merge de `V6`.
  `V/desc:59` «y los plazos sin valor los fija el owner antes del merge de `V6`»
  `V/desc:488` «los valores los fija el owner antes del merge de `V6`, no antes del ensayo del corte»

### Lote 4

- A: la postulación propia de Partner en `V7`; `alliance_leads` queda para los otros tipos.
  `V/desc:60` «y la postulación propia de Partner, la de `02` §2.7, que no adopta `alliance_leads`»
  `V/desc:626` «y postularse como Partner no escribe ninguna fila en `alliance_leads`»
- B: el rol de socio en `V7`, asignado al aprobar y nunca quitado; el paso 3 de `V5` pregunta por
  su familia.
  `V/desc:60` «y el rol de socio, con su familia de operaciones, sus permisos y su migración de datos»
  `V/desc:626` «y aprobar una postulación le asigna el rol de socio»
- C: salen `impersonate`, `set-role`, el botón y `USER_IMPERSONATE`. Va en `V5`, la unidad que el
  consolidado le asigna a `R5-25`; no toca a `V1` ni a `V2`.
  `V/desc:58` «y salen `impersonate` y `set-role` del plugin `admin` de Better Auth»
  `V/desc:624` «y ningún rol del plugin `admin` lleva `impersonate` ni `set-role`»
  `V/spec:459` «prepara sale**: `impersonate` y `set-role` del plugin `admin` de Better Auth»
- D: la ficha ajena `RESTRICTED` contesta `404` en `V5`, con su test.
  `V/desc:58` «la ficha ajena `RESTRICTED` contesta `404` y no `403`»
  `V/desc:624` «una ficha ajena `RESTRICTED` contesta `404`, lo mismo que una inexistente»

### Lote 6 G (las frases de razón caduca que caen en estos archivos)

- `SUP-013`: `moderation_state` nunca gobernó la visibilidad en Alojamiento, no en las tres.
  `V/21:301` «visibilidad **en Alojamiento** (FASE 5, owner 2026-09-30, lote 6 G, `SUP-013`»
- `BD-011`: el recorrido de `G-R9` da 29 con FK y 9 con `entity_type` (como ya dice `V/02`).
  `V/desc:625` «29 tablas con FK y 9 con `entity_type` sobre la rama»

### Fechas

- `updated` pasa a 2026-09-30 en los tres archivos.

## 3. Lo que no se aplicó y por qué

- **Piezas que no aparecen en estos archivos**: S-15 a S-27, S-29 a S-34, S-37 a S-50, S-54, S-57
  a S-66 y S-68 a S-76, S-78 son de `16-`, `B/21`, `B/desc`, la matriz o el log. Las MANTENER de
  este corte que sí aparecen (S-13, S-14, S-35, S-55) quedan citadas, sin cambio de fondo.
- **Lote 3 E y F** (crons apagados en el paso 3; el paso 3 en tres actos): viven en `16-` §4.2;
  ninguno de mis archivos describe el despliegue.
- **Lote 4 E** (`trial` y las tablas de sólo agregar sin `deleted_at`): es de `V/02` y de `V4`; la
  fila de `V4` no nombra la columna, así que no hay nada que tachar acá.
- **Lote 5 y lote 4 F/G salvo lo de arriba**: son de billing o de otros capítulos.
- **El grupo B del consolidado** (`R5-30` a `R5-44`, *«lo corrige el código dentro de su unidad»*):
  no es una decisión del owner en `10-`, y la asignación no lo pedía; queda para quien reparta.
- **El cuarto guard nuevo que pediría el lote 2 D** (el que regenera y compara el SQL del
  catálogo): lo nombré en la fila de `V2`/`V6` del §2.11, **sin sumarlo a los 33** ni asignarle
  columna de guards; ver §4.
- **`V/20` no se tocó** (no es mío): la línea del lote 1 H ya la había escrito su dueño
  (`V/20:56`, *«sin el carril de extras»*).

## 4. Para otro dueño

1. **Coordinador**: en el lote 3 C, `10-` dice *«el borrado del dueño pasa a `PB9`»*; es un error
   de transcripción (corrección del coordinador): la opción elegida de `R5-17` dice *«el del
   diseño»*, que es `PB12`. En mis archivos está escrito `PB12` desde el principio; no hubo nada
   que corregir. `10-` es histórico y no se edita.
2. **`16-fase-7…` §4.2 (paso 3 y el script del corte, `scripts/cutover/`)**: que el script escribe
   las cinco pruebas después de la migración (lote 2 D) y **qué unidad construye ese paso**. En
   `V/desc` §2.11 lo dejé en `V6`, por continuidad (era la dueña de la migración que las escribía,
   y de las herramientas del 4c y el 5b); si `16-` lo asigna distinto, se corrige esa celda.
3. **`V/20` §2 o el coordinador**: el guard del lote 2 D que regenera el SQL del catálogo y lo
   compara no figura en el catálogo ni en los 33. Texto propuesto para la fila de `V2` en `V/20`
   §2, si entra: *«el SQL del catálogo de la migración no es el que genera su script
   (FASE 5, owner 2026-09-30, lote 2 D)»*. Si es un chequeo de CI y no un guard, alcanza con
   decirlo en `16-` §4.2.
4. **`V/03` §9** (dueño de las máquinas): lote 3 A pide que cada fila diga si revalida.
5. **`V/17` y `apps/api/docs/error-contract.md`** (lote 4 D) y **`V/17` §1.2 paso 3** (la familia
   del socio, lote 4 B): texto de capítulo que yo sólo reflejé en la descomposición.
6. **`V/02` §2.7 y `V/18` §2** (lote 4 A): que la postulación de Partner no adopta `alliance_leads`.
7. **`16-fase-7…` §4.6**: la fila de `U2` (id, dependencias, criterio), que `V/desc` §2.13 remite
   allá.
8. **Lote 3 C, la baja física de cuentas** (`user/admin/hardDelete.ts`): en `V/desc` §2.13 la puse
   en `V8`, que construye la acción 24 que la reemplaza; el consolidado da `V6`, `V5`, `V8` y `V4`
   como *«quién corrige»* sin repartir. Confirmar al escribir `V8`.

## 5. Vuelve al owner

### De dónde saca el paso 5b qué fotos y qué tokens borrar

S-04 parte el borrado en dos: la migración del paso 3 borra las filas de las fichas que no son de
las cinco, y el 5b, después de abrir el sistema, borra sus fotos y revoca sus tokens de
calendario. El diseño viejo no lo partía justo por esto: *«las fotos quedarían sin fila que las
nombre»* (`V/21` §2.4, tachado). **Ejemplo**: Juan tenía una ficha con doce fotos y el calendario
conectado, y no está en la lista. En el paso 3 su fila desaparece; en el 5b alguien tiene que saber
dónde están sus doce fotos y cuál es su token para revocarlo.

1. **La migración, antes de borrar, copia a una tabla de paso** el id de cada ficha borrada, las
   rutas de sus fotos y su token de calendario; el 5b la recorre y la borra al terminar. Costo:
   una tabla temporal y su borrado. Riesgo bajo: el backup del 2b la incluye, así que un aborto la
   restaura junto con las fichas, y el token no sale de la base. **Recomendada**.
2. **El script del corte, antes del paso 3 y con todo bloqueado, guarda esa lista en un archivo
   fuera de la base**, y el 5b la lee de ahí. Costo: bajo. Riesgo: tokens de calendario de
   terceros en un archivo fuera de la base, que hay que guardar y borrar a mano.
3. **Barrido de huérfanos**: el 5b borra del almacenamiento toda foto que ninguna fila nombra.
   Costo: listar el almacenamiento entero. Riesgo: no resuelve los tokens (sin fila no hay token
   que revocar: el de Juan queda vivo en el proveedor), y puede borrar algo que otra tabla nombra
   sin FK.

## 6. Conteos

```text
# citas: el script de llenado busca cada cita en su archivo y escribe la primera línea que la contiene;
#        una cita que no aparece aborta el llenado (missing [] al correrlo)
rg -c 'FASE 5' .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md
rg -c 'FASE 5' .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md
rg -c 'FASE 5' .specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md
rg -o 'S-[0-9]{2}' .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/21-migracion.md | sort -u
rg -n -F '**24** unidades' .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md
npx markdownlint-cli2 <cada archivo>
```

Resultados (script de llenado de este registro, en el scratchpad de la sesión, y `rg`):

| qué | cuánto |
|---|---|
| citas `archivo:línea «…»` de este registro, todas verificadas contra el archivo | 87 |
| líneas con «FASE 5» en `V/21` · `V/desc` · `V/spec` (`rg -c`) | 48 · 25 · 4 |
| piezas `S-NN` distintas nombradas en `V/21` | 23: S-01, S-02, S-04, S-05, S-06, S-07, S-08, S-09, S-10, S-11, S-12, S-13, S-14, S-28, S-35, S-36, S-40, S-51, S-52, S-53, S-55, S-56, S-77 |
| unidades del programa, como las cita `V/desc` §4 | 24 |
| guards del programa, como los cita `V/desc` §4 | 33 (sin cambio) |

`markdownlint-cli2` sobre los tres archivos: 0 errores antes y 0 después.
