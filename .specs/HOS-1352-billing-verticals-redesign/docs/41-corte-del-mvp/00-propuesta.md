# Corte del MVP de HOS-1352 · propuesta para el owner

> Trabajo de diseño read-only, 2026-10-01. Fuente: el worktree
> `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign`
> (branch `spec/HOS-1352-billing-verticals-redesign`, HEAD `1b9b2468f0`).
> Abreviaturas de rutas: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`,
> `V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`,
> `B` = `.specs/HOS-1354-billing-cobro-y-proveedor`.
> No se editó ningún archivo trackeado, ni Linear.

## 0. El resultado en cinco líneas

1. **La lectura previa del handoff no se sostiene contra el grafo escrito.** Diferir «addons» y
   «cambios de plan» enteros rompe tres aristas: `B9` (concesiones, que hace falta el día del corte
   para los dos grants del paso 3b) depende de `B8`; `B13` (superficies y baja, que trae el
   checklist de smoke que piden los momentos 3 y 4) depende de `B10`; y `V8` (superficies de
   verticales) depende de `V7` (Partner). Medido con script en el §3.
2. **Sin partir unidades, lo único diferible de verdad es `B12` y, con condiciones, `V9`.** Eso no es
   un MVP.
3. **Partiendo cinco unidades en una mitad de corte y una posterior** (`V8`, `V9`, `B8`, `B9`,
   `B13`) el grafo cierra con **cero violaciones**: **22 piezas el día del corte y 8 después**
   (`V7`, `V8b`, `V9b`, `B8b`, `B9b`, `B10`, `B12`, `B13b`).
4. **La inferencia sobre `DEC-ARCH-007` es correcta en el fondo y falsa en la letra**: el MVP
   respeta su motivo (ninguna épica llega sola, ni tercera implementación, ni convivencia), pero
   choca con *«juntas y terminadas»*, con *«la FASE 10 despliega una sola vez»* y con el momento 2 de
   `DEC-ARCH-016` (*«las 25 unidades están en `Done`»*). Hace falta una precisión del owner. Con
   `DEC-MIG-007` no hay choque.
5. **«El modelo de datos nace completo» no alcanza como regla**: además de las tablas, tienen que
   nacer el día del corte **los escritores de datos que no se pueden reconstruir después** (el
   registro de actos del dueño que reinicia el reloj de retención y el seudónimo del trial), y
   **las respuestas reales de las seis preguntas que `G13` prohíbe dejar en arranque**, aunque
   lean tablas vacías.

---

## 1. Las 25 unidades

Notación: **CORTE** = tiene que estar mergeada en la rama del paraguas antes del ensayo del corte.
**POSTERIOR** = fase posterior, aditiva sobre el sistema nuevo. **PARTIDA** = la unidad se divide en
una mitad *a* (corte) y una *b* (posterior); su alcance exacto vuelve al owner en el lote (§6).

| unidad | qué hace (1 línea) | depende de | corte o posterior | justificación | riesgo si se difiere |
|---|---|---|---|---|---|
| **U1** · limpieza del principio | borra el sistema viejo de la rama y crea vacío el package del contrato | nada | **CORTE** | primer nodo de los dos grafos (`D/16-fase-7-del-paraguas.md:789-790`); sin ella `G8` no nace | no aplica: sin `U1` no arranca nada |
| **U2** · outbox común | correo encolado en la transacción, supresión, correlación, huso | U1 | **CORTE** | la esperan `V6`, `B4`, `V9` y `B12` (`D/16…:875-876`); `PB12` y el aviso de cobertura encolan desde el día uno | `V6` y `B4` no se pueden terminar |
| **U3** · script del corte | censo, cancelación, relectura y completitud contra el proveedor | U1 (orden, no código) | **CORTE** | ejecuta los pasos 1a, 1b y 2 (`D/16…:847`); el momento 3 exige que esté mergeada (`D/16…:974`) | no hay corte |
| **V1** · catálogo y su doble guard | enum de verticales, catálogo de claves, el contrato con interfaces y simuladores | U1 | **CORTE** | todo lo demás lee el catálogo; `G1`, `G3`, `G14`, `G18` no se pueden agregar después sin reescribir (`V/descomposicion.md:64-70`) | ninguno: está en el camino crítico |
| **V2** · catálogo de planes y dirección inversa | `plan`, `plan_version`, `rank`, `políticaDePlan`, `direcciónDeCambio`, `políticaDeAddon` | V1 | **CORTE** | la carga del catálogo de producción corre en la migración del paso 3 (`D/16…:153`); 8 de las 12 aristas entre épicas salen de acá | no hay precios ni trial |
| **V3** · resolución de capacidades | «¿qué puede hacer esta cuenta?», caché e invalidación por `user` | V2 | **CORTE** | la consume `V5` en cada operación | autorización sin capacidades |
| **V4** · contrato de cobertura y trial | la máquina de trial, `cobertura()`, `extenderTrial`, el lock; nace `G13` | V3, **B1** (reloj, fila 14) | **CORTE** | las cinco cuentas arrancan con la prueba recién iniciada (`D/01-decision-log.md:6959-6960`) | no hay trial: el corte no tiene qué escribirles |
| **V5** · autorización | los siete pasos, el paso de cobertura en toda escritura, el actor de sistema, `G19` | V4 | **CORTE** | `U1` saca los gates de entitlement de las rutas y deja escribir sin plan hasta `V5` (`D/16…:727-731`) | **fail-open**: un dueño escribe sin cobertura en producción |
| **V6** · publicación y excedente | máquina `PB1`–`PB13`, reconciliador diario, **la migración del corte**, herramientas 4c y 5b, las cinco pruebas | V5, U2 | **CORTE** | la migración del paso 3 y las herramientas del corte son suyas (`D/16…:152`, `:159`; `V/descomposicion.md:59`) | no hay corte |
| **V7** · Partner | postulación, presencia por clave, reclamo, rol de socio, borra `starts_at`/`ends_at`/`tier` | V5 | **POSTERIOR** (su migración estructural, al corte: ver AB) | cero partners con cobro (`D/01…:2660`); `U1` ya deja la presencia oscura «hasta `V7`» (`D/16…:742-743`) | la página y el carrusel de partners quedan oscuros; sin la migración al corte, su `DROP COLUMN` posterior no es aditivo |
| **V8** · superficies de verticales | Mi Cuenta, botón suscribirse→publicar, acciones 15, 23 y 24, filas 20-22 y 27-29 | V6, **V7** | **PARTIDA**: `V8a` CORTE, `V8b` POSTERIOR | `V8a`: el botón de la fila 23, la fila 29 y la acción 24 (que reemplaza el `hardDelete` de cuentas que sale, `V/descomposicion.md:536`) hacen falta desde el día uno. `V8b`: lo de Partner (fila 22, panel de postulaciones), que es lo único que la ata a `V7` | sin `V8a`, el dueño en trial no ve su estado y la baja de cuenta queda por la puerta vieja |
| **V9** · retención | reloj de 90/180 días, `PB9`, seudónimo, registro de actos del dueño, avisos | V4, V6, U2 | **PARTIDA**: `V9a` CORTE, `V9b` POSTERIOR | `V9a` (el registro de actos del dueño, fuente del hecho 1, y la función del seudónimo) escribe datos que no se reconstruyen después (`V/descomposicion.md:62`). `V9b` (jobs, avisos, `PB9`) no actúa antes del primer plazo | si `V9a` se difiere, cuando llegue el reloj contará desde `inactiva_desde` sin los reinicios del período, y **archiva antes de tiempo** la ficha de un dueño activo |
| **B1** · adaptador y proveedor falso | interfaz de las 8 capacidades, falso que miente, batería, reloj, `G9`–`G12`, `G15`–`G17` | U1 | **CORTE** | todo el cobro pasa por el adaptador; `V4` espera su reloj | no hay cobro |
| **B2** · el precio | `billing_option` en entero, colgando de `plan_version` | V2 | **CORTE** | los precios se cargan en el paso 3 (`D/16…:153`) | no se puede vender |
| **B3** · el alta y su ventana | compromiso de cobro vivo, ventana, receptor IPN/Webhooks | B1, B2, V2 | **CORTE** | las cinco cuentas *«al terminar la prueba se tienen que volver a suscribir»* (`D/01…:6959-6961`); el 4b verifica el receptor (`D/16…:156`) | nadie puede pagar; avisos del proveedor sin receptor |
| **B4** · contrato de cobertura, de verdad | la real: fuentes de billing, `retenciónDetenida`, `puedeCobrarle`, aviso | B3, B5, V4, U2 | **CORTE** | `G13` hace fallar todo build de producción que importe una de las seis respuestas de arranque (`D/12-contrato-de-cobertura.md:1493-1499`) | el build de producción no pasa, o pasa con `cubierto: no` para quien paga |
| **B5** · registro del dinero | pagos, reembolsos, acción 14, `S29`, `S36`, comprobantes | B3 | **CORTE** | bisagra del cobro (`B/descomposicion.md:736-740`); el comprobante guarda la copia del pagador desde el primer cobro | pagos sin registro: no se reconstruyen |
| **B6** · ejecutar el reembolso | `RF2`/`RF3`/`RF5` contra el proveedor, idempotencia, de a una por orden | B5, B1 | **CORTE** | el smoke 5c pide *«un checkout real… su devolución»* (`D/16…:160`); `PAGO_TARDÍO_RECHAZADO` propone devolver | devoluciones a mano por el panel del proveedor, asentadas por `RF4` (viable, pero el 5c queda a medias) |
| **B7** · la mora | grace, `S4`–`S7`, `S19`, la marca 21, `G-R1-D` | B5, V2 | **CORTE** | un `ACTIVE` sin pago cubre (`V/descomposicion.md:636`, fila de `cobrada: no`): sin `B7`, un cobro rechazado deja a la persona cubierta gratis | **regala** servicio desde el primer rechazo |
| **B8** · cambios del compromiso | baja, cambio de plan y de ciclo, pausa, cierre de la sucesión, `G-R1-C` | B7, V2 | **PARTIDA**: `B8a` (la baja: `S11`, `S12`) CORTE, `B8b` (cambio de plan, ciclo, pausa, sucesión, `S38`) POSTERIOR | la baja self-service es criterio de `B13` (*«cancelar cuesta los mismos pasos o menos que suscribirse»*, `B/descomposicion.md:875`) | sin `B8a` no hay baja; sin `B8b`, Juan no cambia de plan (ver Z) |
| **B9** · concesiones | promos, cortesías, grants, piso, la herramienta del 3b | B8, V2, V4 | **PARTIDA**: `B9a` (grants, su fuente, su piso, la herramienta del 3b) CORTE, `B9b` (promos, cortesías, `S9`, `S34`, `S35`, canje con `extenderTrial`) POSTERIOR | el paso 3b escribe los dos `permanent_grant` *«con la herramienta de B9»* (`D/16…:154`) | sin `B9a`, las dos cuentas de cortesía del owner quedan en trial y a los N días se les pide pagar |
| **B10** · addons | dos ejes, orfandad, `A1`–`A7`, destaque, `G-R2-C` | B9, V2, V6, V9 | **POSTERIOR** (modelo y fuente real al corte: ver AA) | `U1` retira el destaque y *«la home queda sin destacados hasta entonces»* (`D/16…:747-748`): el sistema ya está pensado para vivir sin addons un tiempo | sin la fuente real `ADDON` al corte, `G13` rompe el build de producción |
| **B11** · conciliación | barrido diario, re-vinculación, lápida de recepción, `PAGO_TARDÍO_RECHAZADO` | B5 | **CORTE** | el gate E acepta el programa con *«siete días seguidos sin una divergencia sin explicar»* (`D/16…:996-1001`); un cobro tardío de un preapproval viejo entra por la lápida de recepción (`B/descomposicion.md:137`) | sin barrido, el programa no se puede dar por aceptado y un cobro tardío del viejo no tiene dueño |
| **B12** · el catálogo que se retira | retirar un plan, migrar a sus clientes (`S37`, acción 17) | B13, U2, V2 | **POSTERIOR** | nadie retira un plan los primeros meses; no tiene escritor del día uno | si el owner necesita retirar un plan antes, no hay camino seguro |
| **B13** · superficies y la baja | pricing, Mi Suscripción, baja, avisos del grace, acción 14, **checklist de smoke** | B10 | **PARTIDA**: `B13a` CORTE, `B13b` (filas de addons, aviso de destaque que se sigue cobrando) POSTERIOR | el checklist de smoke va adentro del ensayo y es el 5c (`D/16…:974-983`, `:1003-1011`) | sin `B13a` no hay ensayo verde ni pantalla para pagar o darse de baja |

**Resumen**: 17 unidades enteras al corte (`U1`–`U3`, `V1`–`V6`, `B1`–`B7`, `B11`), 5 partidas
(`V8`, `V9`, `B8`, `B9`, `B13`) con su mitad *a* al corte, y 3 enteras posteriores (`V7`, `B10`,
`B12`). Contado como piezas: **22 al corte, 8 posteriores**.

---

## 2. El criterio de corte

Una pieza va el día del corte si cumple **al menos uno** de estos cinco. Si no cumple ninguno, va
a una fase posterior.

1. **Sin ella no se puede apagar el viejo ni ejecutar el corte**: está en un paso del orden del
   corte (`D/16…` §4.2, pasos 0 a 5c) o en un gate de los momentos 3 y 4 (`D/16…:971-991`).
2. **Sin ella el sistema nuevo cobra mal o regala**: cobertura, autorización, mora o
   conciliación, medido contra lo que pasa en los primeros 30 días (fin de la prueba de las
   cinco, primer cobro, primer rechazo). Incluye todo lo que hace que `G13` no rompa el build de
   producción.
3. **Escribe un dato que no se puede reconstruir después**: si la pieza llega más tarde, lo que
   pasó en el medio se perdió (registro de actos del dueño, seudónimo, comprobantes, entregas del
   proveedor). Diferirla obligaría a una migración de datos sobre filas escritas desde el corte,
   y eso **no es aditivo**.
4. **Cambia la forma de una tabla que ya tiene filas el día del corte**: un `DROP COLUMN`, un
   `UNIQUE` o un `CHECK` nuevo sobre una tabla poblada es una migración de datos disfrazada. Va
   al corte aunque su lógica se difiera.
5. **La exige el grafo**: es dependencia de algo que cumple 1 a 4. Si la dependencia es sólo de
   una parte, la unidad se parte (vuelve al owner, Z).

Y una regla que no es criterio sino consecuencia: **lo que se difiere tiene que poder llegar sin
tocar nada de lo construido** (la misma prueba que el contrato se pone a sí mismo:
*«se enchufa como fuente… y no toca nada de lo construido»*, `D/12-contrato…:1412-1413`).

---

## 3. Verificación contra el grafo

### 3.1 Los conteos, por script

Comandos (los dos scripts viven al lado de este archivo y resuelven las rutas solos):

```bash
python3 $D/41-corte-del-mvp/contar.py     # guards por unidad, leídos de la columna guards de las tres tablas
python3 $D/41-corte-del-mvp/aristas.py    # filas vivas de B/descomposicion.md §2.6 y chequeo de las dos asignaciones
```

`contar.py` lee la columna *guards* de `V/descomposicion.md` §2, `B/descomposicion.md` §2 y la
tabla de `U1`–`U3` de `D/16` §4.6, sacando lo tachado y los comentarios en itálica:

```text
B1 7 · B2 1 · B3 4 · B7 1 · B8 1 · B10 1 · V1 4 · V3 2 · V4 4 · V5 6 · V6 3 · U1 1 (G8)
(el resto, 0)
unidades: 25 · guards: 35 · distintos: 35 · V: 19 · B: 15 · U: 1
```

Coincide con el 19·15·1 del contexto.

`aristas.py` cuenta las filas de la tabla de dependencias entre épicas sin las tachadas:

```text
filas vivas §2.6: 12 ['1','2','3','4','5','6','7','9','10','11','12','14'] · tachadas: ['8','13']
```

Coincide con las 12. Dos filas (la 9 y la 11) tienen dos flechas cada una (`V6` y `V2`; `V6` y
`V9`), así que las 12 filas son 14 flechas.

### 3.2 Las aristas, chequeadas

El grafo transcripto: las flechas de `V/descomposicion.md:546-553`, de
`B/descomposicion.md:715-726`, las de `U1`–`U3` (`D/16…:860-897`) y las 14 flechas de las 12
filas. **46 aristas.**

**Asignación A, la lectura previa del handoff sin partir nada** (difiere `B8`, `B10`, `V7`, `V9`,
`B12`): **3 violaciones**.

```text
✗ V8 (corte) depende de V7 (diferida)
✗ B9 (corte) depende de B8 (diferida)
✗ B13 (corte) depende de B10 (diferida)
```

**Asignación B, la propuesta** (cinco unidades partidas): **59 aristas, 0 violaciones.** La lista
completa la imprime el script. Las que importan, una por una:

| arista original | qué pasa con ella | por qué es legítimo |
|---|---|---|
| `B8 → B9` | pasa a `B8b → B9b` (y `B8a → B9a`, que no viola) | la atadura real es la sucesión: `S9` es compartida con `B8` y la cortesía re-emitida sobre una sucesora (`B/descomposicion.md:135`). Los grants del corte no la tocan |
| `B10 → B13` | pasa a `B10 → B13b` | lo de addons de `B13` son las filas 13 y 13-bis y el aviso del destaque que se sigue cobrando (`B/descomposicion.md:139`); el resto no lee addons |
| `V7 → V8` | pasa a `V7 → V8b` | lo de Partner en `V8` es la fila 22 y el panel de postulaciones (`V/descomposicion.md:61`) |
| `B9 → B10`, `B13 → B12` | pasan a `B9b → B10`, `B13b → B12` | las dos de destino ya son posteriores |
| `V2 → B8` (filas 4 y 5) | pasa a `V2 → B8b` | `permitePausa` y `direcciónDeCambio` son de la pausa y del cambio de plan |
| `V4 → B9` (fila 10) | pasa a `V4 → B9b` | `extenderTrial` es el canje de un código, no el grant |
| `V2 → B9` (fila 12) | pasa a `V2 → B9a` | el piso del grant lee `políticaDePlan(v).vigente`: corte, desde corte |
| `V9 → B10` (fila 11) | pasa a `V9b → B10` | el empuje de `PB9` |
| nuevas | `B4 → B9a`, `B8a → B13a`, `B7 → B13a`, `B5 → B13a`, `V6 → V9a` | escritas explícitas para que la parte *a* no quede colgando de la *b* |

Las 12 filas entre épicas, una por una, con la asignación B:

| fila | flecha | desde | hacia | ¿viola? |
|---|---|---|---|---|
| 1 | `V2 → B2` | corte | corte | no |
| 2 | `V4 → B4` | corte | corte | no |
| 3 | `V2 → B7` | corte | corte | no |
| 4 | `V2 → B8b` | corte | posterior | no |
| 5 | `V2 → B8b` | corte | posterior | no |
| 6 | `V2 → B12` | corte | posterior | no |
| 7 | `V2 → B3` | corte | corte | no |
| 9 | `V6 → B10`, `V2 → B10` | corte | posterior | no |
| 10 | `V4 → B9b` | corte | posterior | no |
| 11 | `V6 → B10`, `V9b → B10` | corte / posterior | posterior | no |
| 12 | `V2 → B9a` | corte | corte | no |
| 14 | `B1 → V4` | corte | corte | no |

**Lo que este chequeo no prueba**: que las partidas no tengan dependencias internas que el
grafo no dibuja. Ejemplo encontrado: la rama de sucesión de `S1` vive en `B3` (`S1`–`S3` van a
`B3`, `B/descomposicion.md:147`), con sus guards `G-R1-A` y `G-R1-B`, pero su cierre (`S17`,
`S18`) es de `B8b`. Con `B8b` diferida, **ninguna ruta puede declarar una sucesión** hasta que
llegue, o se declaran sucesiones que nadie cierra. Es parte de la letra Z.

---

## 4. Modelo de datos y guards del día del corte

### 4.1 Qué tiene que nacer completo aunque su lógica se difiera

**Tablas, columnas, enums y restricciones** (criterio 4 y paso 6 del corte):

1. **El catálogo entero que carga la migración del paso 3**: planes y versiones (`V2`), precios
   (`B2`), **complementos** (las tablas de producto y versión de addon de `B10`) y **códigos
   promocionales** (las de `B9b`). El paso 3a los carga *«dentro de la migración estructural del
   paso 3»* (`D/16…:153`): si su tabla no existe ese día, no hay dónde cargarlos.
2. **Las tablas de las cuatro fuentes de billing**, también las vacías (cortesía, instancia de
   addon), porque la real tiene que contestarlas leyendo algo (§4.2).
3. **Los enums de estados completos**: los seis de la ficha, los de la suscripción (también
   `PAUSED`, sus motivos, `CANCEL_SCHEDULED`), los del reembolso y los de la compra de addon. Los
   guards `G-R4`, `G-R6` y `G-R6-B` recorren las tablas de transiciones **declaradas** y no lo
   construido (`V/descomposicion.md:598-606`), así que no se rompen con las transiciones
   ausentes.
4. **La forma de `partners`**: el `DROP` de `starts_at`, `ends_at` y `tier` con su índice, y el
   `UNIQUE` parcial sobre `owner_user_id` (`V/descomposicion.md:60`). Es la migración de `V7`, y
   sobre una tabla con filas un `UNIQUE` nuevo puede fallar (letra AB).
5. **Las columnas de la sucesión** (`sucede_a`, `sucedida_por`) y de la cola de cambios
   programados, aunque `B8b` no las escriba: hoy las leen predicados de `B3` y `B7` (`G-R1-A`,
   `G-R1-B`, `G-R1-D`).
6. **Las dos tablas de la migración de un plan retirado** (`B12`). Son las únicas que se podrían
   crear después con un `CREATE TABLE` sin riesgo; van al corte sólo si el owner elige la opción 1
   de AD.

**Escritores de datos que no se reconstruyen** (criterio 3), que por eso no son «modelo» sino
lógica que tiene que correr desde el día uno:

1. **El registro de los actos del dueño sobre la ficha** (crearla, editarla, exportarla), fuente
   del hecho 1 del reloj de retención (`V/descomposicion.md:62`). Hoy es de `V9`: va a `V9a`.
2. **El seudónimo del correo en la fila de `trial`**. La función está en la fila de `V9`
   (`V/descomposicion.md:62`), pero la usa `T1`, de `V4`, y la herramienta del corte de `V6`
   (`D/16…:152`; `V/descomposicion.md:478`: *«la función del seudónimo es la misma que `T1` usa,
   de la unidad que ya la tiene»*). Como `V4` llega antes que `V9`, **la construye `V4` en los
   hechos**, aunque el texto la ponga en `V9`. Lo propongo como arreglo de asignación (AC).
3. **El comprobante con la copia del pagador** (`B5`), **las entregas de los dos canales en
   `provider_notification`** (`B3`) y **los ids de cada devolución** (`B5`, `B6`). Ya están en
   unidades del corte.

### 4.2 Las seis respuestas que `G13` no deja en arranque

`G13` falla si un build de producción importa el módulo que contesta por billing: *«las cuatro
fuentes, `retenciónDetenida` y `puedeCobrarle»`* (`D/12-contrato…:1496-1499`). Con la propuesta:

| respuesta | quién la da real el día del corte | sobre qué datos |
|---|---|---|
| fuente `SUSCRIPCIÓN` | `B4` | suscripciones vivas |
| fuente `GRANT` | `B9a` | los dos grants del 3b |
| fuente `CORTESÍA` | `B9a` (o `B4`) | tabla vacía hasta `B9b` |
| fuente `ADDON` | `B4` (o una `B10a` mínima) | tabla vacía hasta `B10` (letra AA) |
| `retenciónDetenida` | `B4` | sin pausas hasta `B8b`: contesta `no` desde los datos, no desde el código |
| `puedeCobrarle` | `B4` | suscripciones vivas y marcas |

La diferencia con el arranque es la que el propio contrato exige: **un `no` porque la tabla está
vacía no es un `no` porque el código no pregunta**. Cuando `B9b` o `B10` lleguen, la fuente
empieza a devolver filas sin cambiar una línea del lector, que es lo que hace aditiva a la fase
posterior.

### 4.3 Los guards del día del corte

Con la propuesta: **34 de los 35**.

| unidad | guards | ¿al corte? |
|---|---|---|
| `U1` | `G8` | sí |
| `V1` | `G1` `G3` `G14` `G18` | sí |
| `V3` | `G-R2` `G-R2-B` | sí |
| `V4` | `G-R4` `G-R4-B` `G-R6` `G13` | sí |
| `V5` | `G2` `G4` `G6` `G-R3-B` `G-R3-C` `G19` | sí |
| `V6` | `G5` `G-R6-B` `G-R9` | sí |
| `B1` | `G9` `G10` `G11` `G12` `G15` `G16` `G17` | sí |
| `B2` | `G7` | sí |
| `B3` | `G-R1-A` `G-R1-B` `G-R1-E` `G-R1-F` | sí |
| `B7` | `G-R1-D` | sí |
| `B10` | `G-R2-C` | **sí, si AA es la 1**: vigila que un addon `USER`/`GLOBAL` se emita sólo en sus verticales compatibles, y la fuente `ADDON` real nace al corte. Su dominio es el catálogo de productos, que se carga en el 3a |
| `B8` | `G-R1-C` | **no**: es el guard del cierre de la sucesión (`B/docs/20-testing.md:58`), que es de `B8b` |

Conteo: 1 + 19 + 7 + 1 + 4 + 1 + 1 = 34. Si AA no es la 1, son 33.

**Una tensión que el owner tiene que ver**: la regla 1 de las dos descomposiciones dice que el
guard va *«con la pieza que protege, nunca al final»* (`V/descomposicion.md:41-44`). `G-R1-C`
llega con `B8b` y eso la cumple, pero **sólo si ninguna ruta declara una sucesión antes**. Por
eso Z exige que la rama de sucesión de `S1` no tenga camino hasta `B8b`.

---

## 5. Veredicto sobre la inferencia

> *El MVP no rompe `DEC-ARCH-007` ni `DEC-MIG-007` si las fases posteriores son aditivas, lo que
> exige que el modelo de datos nazca completo el día del corte.*

**Con `DEC-MIG-007`: CONFIRMADA.** Sus cuatro puntos (`D/01-decision-log.md:6950-6961`) hablan del
viejo y del corte: no convivencia, nadie durante el corte, cinco cuentas con una ficha, aviso por
privado sin nada programado. Una fase posterior corre sobre el sistema nuevo, con el viejo ya
apagado, así que no es convivencia. Lo que sí pide el punto 4 (*«al terminar la prueba se tienen
que volver a suscribir»*) es que el checkout, la mora y la baja estén el día del corte, y la
propuesta los pone.

**Con `DEC-ARCH-007`: CONFIRMADA EN EL FONDO, REFUTADA EN LA LETRA.**

Lo que el MVP respeta:

- **El motivo**: *«ninguna llega a producción sola»* (título, `D/01…:2580`) y *«la unidad que llega
  a `staging` es el paraguas»* (`D/01…:2608-2609`). En la propuesta las dos épicas llegan juntas
  al corte, cada una con su mitad.
- **Las dos implementaciones del contrato, sin tercera** (`D/01…:2613-2616`;
  `D/12-contrato…:1420-1428`): no hay adaptador sobre el viejo.
- **Sin interruptores ni convivencia** (`D/01…:2634-2636`; `D/16…:624-634`).

Lo que el MVP choca, textual:

1. **Decisión**: *«Las dos llegan a producción juntas y terminadas»* (`D/01…:2591-2592`). Con un
   MVP llegan juntas y **no** terminadas.
2. **Implicación 1**: *«"Terminada" para una épica no significa "en producción": significa lista
   y verificada contra el contrato»* (`D/01…:2623-2624`).
3. **Implicación 3**: *«La FASE 10 se desarrolla en paralelo y despliega una sola vez»*
   (`D/01…:2627`). Un MVP despliega al menos dos veces.
4. **Y el gate que la hace cumplir**: el momento 2 de `DEC-ARCH-016`, *«las 25 unidades están en
   `Done`»* antes del PR final a `staging` (`D/16…:961-963`).

Así que «no rompe si las fases son aditivas» es una **condición necesaria, no suficiente**: hace
falta además **una precisión del owner (📌) sobre `DEC-ARCH-007` y sobre el momento 2 de
`DEC-ARCH-016`**. No es relitigar: el MVP no existe como decisión registrada; sólo aparece en el
handoff y en el worklog (`D/03-handoff.md:59-66`; `D/02-worklog.md:1493`). Es la letra Y.

**Y «el modelo de datos nace completo» es necesario pero no alcanza** (§4.1): hace falta también
que nazcan los escritores de datos irrecuperables y las respuestas reales de `G13`. Con eso, la
fase posterior es aditiva en el único sentido que importa: **no reescribe filas ni código del
corte**. Y el paso 6 no lo complica: después del corte la historia de migraciones pasa a ser una
foto de producción (`D/16…:161`), y lo que venga después son migraciones nuevas encima de esa
foto. Si el modelo nació completo, una fase posterior no trae ninguna migración estructural.

---

## 6. Las decisiones del owner (lote Y a AE)

En todas, **Juan** es un anfitrión con una cabaña en Colón que se suscribe al plan Básico de
Alojamiento la semana siguiente al corte.

### Y · Precisar «juntas y terminadas»

Las dos épicas llegan juntas y terminadas (`DEC-ARCH-007`), con el gate de las 25 unidades en
`Done` (`DEC-ARCH-016`, momento 2). Un MVP necesita precisar las dos.

1. **📌 sobre las dos: «terminadas» quiere decir el alcance del corte; las fases posteriores son
   del sistema nuevo, aditivas, con su propio gate; el momento 2 cuenta las piezas del corte.**
   **Recomendada.**
   - Costo: dos 📌 en el log y reescribir el momento 2. Una `DEC-METH-019`/`DEC-ARCH-017` nueva
     que registre el MVP.
   - Riesgo: que «aditiva» se lea flojo y una fase posterior reescriba código del corte. Lo acota
     el criterio del §2 escrito en la precisión.
2. **Sin MVP: las 25 al corte, como está escrito.**
   - Costo: el corte espera a `B10`, `B12`, `V7`, `V9` y a las partes *b*, que son las más largas
     del camino crítico de billing (`B8 → B9 → B10 → B13 → B12`, `B/descomposicion.md:730`).
   - Riesgo: congelamiento de `staging` más largo (`D/16…:655-659`) y meses más de altas
     congeladas.

*Juan*: con la 1 se suscribe a la semana del corte; con la 2 espera a que estén los addons, el
retiro de planes y Partner, aunque no use ninguno.

### Z · Partir unidades para que el grafo cierre

El grafo actual ata `B9` a `B8`, `B13` a `B10` y `V8` a `V7` (§3.2).

1. **Partir `V8`, `V9`, `B8`, `B9` y `B13` en una mitad de corte y una posterior**, con los
   alcances del §1, y **dejar sin ruta la rama de sucesión de `S1` hasta `B8b`**. **Recomendada.**
   - Costo: cinco unidades pasan a diez en Linear; reescribir sus filas y criterios en la spec
     consolidada.
   - Riesgo: una dependencia interna que el grafo no dibuja (como la de `S1`). Se mitiga con una
     pasada por unidad partida antes de cerrar la spec consolidada.
2. **No partir: todo lo que el grafo fuerza va al corte.** Sólo se difieren `B12` y una parte de
   `V9`.
   - Costo: casi ninguno de diseño.
   - Riesgo: el MVP pierde casi todo su sentido (23 de 25 al corte).
3. **Reescribir aristas sin partir** (decir que `B9` no depende de `B8`, etc.).
   - Costo: bajo.
   - Riesgo: alto. Es mentirle al grafo: `S9` y la cortesía sobre una sucesora siguen
     dependiendo de `B8`.

*Juan*: con la 1, si en el mes dos quiere pasar al plan Premium, la pantalla le dice que todavía
no se puede cambiar de plan: se da de baja al fin del período y se vuelve a suscribir. Con la 2,
puede cambiar de plan desde el día uno.

### AA · Addons el día del corte

1. **Al corte, el modelo de addons entero (productos, versiones, instancias, compra) y la fuente
   `ADDON` real leyendo la tabla vacía, con `G-R2-C`. La venta, el destaque y la orfandad
   (`B10`), después.** **Recomendada.**
   - Costo: un poco de `B10` se adelanta a `B4`.
   - Riesgo: bajo; el catálogo de complementos se carga igual en el 3a y queda sin vender.
2. **`B10` entero al corte.**
   - Costo: la unidad más ancha de billing entra al camino del corte.
   - Riesgo: atrasa el corte.
3. **`B10` entero después, sin fuente real.**
   - Costo: ninguno ahora.
   - Riesgo: `G13` rompe el build de producción, o alguien le agrega una excepción, que es
     justo lo que el contrato dice que deja pasar el defecto (`D/12-contrato…:1502-1505`).
     **No viable.**

*Juan*: con la 1 no puede comprar el destaque de su cabaña hasta que llegue `B10`, y la home no
muestra destacados (como ya pasa desde `U1`).

### AB · Partner

1. **La migración estructural de `V7` al corte** (borra `starts_at`, `ends_at`, `tier` con su
   índice y agrega el `UNIQUE` parcial), con sus lectores de `tier` retirados; **la presencia, la
   postulación, el reclamo y el rol, después.** **Recomendada.**
   - Costo: partir `V7` en su migración y su lógica.
   - Riesgo: el carrusel y las páginas de partners quedan oscuros hasta `V7b` (ya lo están desde
     `U1`).
2. **`V7` entero al corte.**
   - Costo: alarga el camino de verticales (`V5 → V7 → V8`).
   - Riesgo: poco técnico, más tiempo.
3. **`V7` entero después.**
   - Costo: ninguno ahora.
   - Riesgo: su `DROP COLUMN` y su `UNIQUE` corren sobre una tabla con filas después del corte:
     una fase posterior **no aditiva**.

*Juan* no es partner y no lo nota. *La inmobiliaria que patrocina el carrusel* no aparece hasta
que llegue `V7`.

### AC · Retención y seudónimo

1. **`V9a` al corte (el registro de actos del dueño y el seudónimo, con la función del seudónimo
   reasignada a `V4`, que es quien la usa primero); `V9b` (jobs, `PB9`, avisos) mergeada antes de
   la primera fecha en que un aviso de retención podría salir**, según los plazos que el owner fija
   antes del merge de `V6`. **Recomendada.**
   - Costo: partir `V9` y corregir la asignación del seudónimo.
   - Riesgo: una fecha dura para `V9b`; si se pasa, una ficha no se archiva a tiempo (falla
     hacia el lado seguro).
2. **`V9` entero al corte.**
   - Costo: una unidad más, fuera del camino crítico (`V8` lo es).
   - Riesgo: bajo.
3. **`V9` entero después.**
   - Costo: ninguno ahora.
   - Riesgo: sin el registro, el reloj cuenta desde `inactiva_desde` sin los reinicios del
     período, y **archiva antes de tiempo**. Y las pruebas del corte nacen sin seudónimo.

*Juan* edita la descripción de su cabaña el día 80 sin publicarla. Con la 1, el reloj se
reinicia ese día. Con la 3, cuando llegue `V9` el reloj no sabe de esa edición y la archiva el
día 90.

### AD · Qué es «el modelo nace completo»

1. **Todo el esquema de las 25 unidades nace en las migraciones de la rama antes del corte**
   (tablas, columnas, enums, `FK`, `UNIQUE`, `CHECK`, los extras), aunque su lógica se difiera;
   una fase posterior no trae migración estructural. **Recomendada.**
   - Costo: diseñar ya las tablas de las partes *b* (`B12`, cola de cambios, promos, cortesías).
   - Riesgo: una tabla de una parte *b* que al construirse resulte mal modelada pide una
     migración igual.
2. **Nace completo sólo lo que se escribe o se lee desde el día uno; lo demás llega con
   `CREATE TABLE` posteriores, con la regla «sólo agrega, nunca cambia lo que tiene filas».**
   - Costo: menor ahora.
   - Riesgo: hay que vigilar la regla a mano en cada fase.

*Juan* nunca lo ve. Lo ve la persona que, en el mes cuatro, agrega el retiro de planes: con la 1
no toca la base; con la 2 agrega dos tablas.

### AE · Cómo viajan las fases posteriores

Puede esperar al día del corte, pero condiciona la spec consolidada.

1. **Una rama épica nueva por fase posterior** (`epic/**` ya es un tipo de rama del proyecto,
   `D/01…:2732`), con los mismos gates por unidad, que entra a `staging` entera.
   **Recomendada.**
   - Costo: repetir el congelamiento corto de `staging` en cada fase.
   - Riesgo: bajo; es el mecanismo ya probado.
2. **PRs de unidad directo a `staging`, con el flujo normal**, cada uno completo al mergear.
   - Costo: menor.
   - Riesgo: sin interruptores (`D/16…:624-626`), un PR a medias sale a producción en la próxima
     promoción.

*Juan*: con la 1, el cambio de plan le aparece de una vez, entero; con la 2 puede aparecer por
partes.

---

## 7. Lo que no pude verificar

1. **La duración de la prueba y los plazos de retención en producción.** La fecha límite de
   `V9b` y la urgencia de `B3` dependen de ellos, y los fija el owner antes del merge de `V6`
   (`V/descomposicion.md:537`).
2. **Si `partners` tiene filas en producción.** Los partners con cobro son cero
   (`D/01…:2660`), pero puede haber contenido curado. Decide si el `UNIQUE` de AB es seguro.
3. **Que las partes *a* no tengan dependencias internas ocultas** más allá de la de `S1` del
   §3.2. No recorrí transición por transición las tablas de `B/03` ni de `V/03`.
4. **El tamaño de cada pieza.** No hay estimaciones en el diseño (`V/descomposicion.md:681`;
   `B/descomposicion.md:932`), así que no sé cuánto acorta el corte esta propuesta.
5. **Si la baja self-service tiene una exigencia legal con fecha.** El criterio de `B13` la exige
   igual; no consulté el pliego legal (`D/13-pliego-consulta-legal.md`).
6. **Si `retenciónDetenida` real contestando sobre cero pausas cumple el juego de casos de la
   real** (`D/12-contrato…:1466-1472`), que pide al menos un caso que la de arranque no pase.
   Con pausas imposibles hasta `B8b`, ese caso puede quedar sin sujeto.
7. **Los conteos de guards y aristas salen de mi transcripción del grafo**, no de un archivo
   máquina-legible. La transcripción está en `aristas.py` para que otro la verifique.
8. **No usé `codegraph`**: todo lo de arriba es diseño, sin una lectura de código necesaria, y el
   índice refleja el clone principal, no el worktree.
