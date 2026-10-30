---
title: "FASE 8 vuelta 3 · el consolidado de los 65 hallazgos"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 — el consolidado

Nueve agentes adversariales atacaron el diseño vigente el 2026-09-30, sobre el HEAD `923b23586b`
del worktree `hospeda-spec-hos-1352-billing-redesign`. Es la **vuelta 3**, una excepción declarada
al tope de dos vueltas de `DEC-METH-013` (`DEC-METH-016`): después de la vuelta 2 el diseño recibió
la revisión del owner y los lotes M a P, que cambiaron el esqueleto (la limpieza total del sistema
viejo al principio con `U1`, el receptor nuevo en la misma ruta con un Worker que contesta `500`
durante el corte, la entrada `puedeCobrarle` del contrato, las acciones administrativas 23 a 25,
`S38` y `A7`). El alcance fue el de las vueltas anteriores: el núcleo, las dos épicas con sus
descomposiciones, el contrato de cobertura y el corte (`16-fase-7-del-paraguas.md`). Los agentes
trabajaron **ciegos entre sí y ciegos del historial**, y ninguno tocó otro archivo que su informe.

Este documento no repite los hallazgos: los **agrupa por causa**. La convergencia entre agentes
ciegos es la señal de severidad. Salió **sólo de los nueve informes**, del log de decisiones, de la
matriz y de los capítulos que los informes citan; de la vuelta 2 se leyó sólo su consolidado, para
la estructura y la comparación. No se leyeron `14-`…`28-`, `30-`, `mp-probes/`, el worklog, el
handoff ni engram.

> **Lo que este documento NO hace.** No propone soluciones y no decide nada. Donde cambia una
> severidad lo dice como **propuesta del consolidador**, con su razón. Qué racimo se arregla y cuál
> se declara con causa lo decide el owner. La atribución formal contra los diffs la hace otro
> después; acá sólo se marca qué racimos nombran piezas posteriores a la vuelta 2.

---

## 1. Los números, recontados

Contados con script sobre los nueve archivos: `rg -c "^### F-8V3"` por archivo, y cada `###`
asignado a la sección `## CRITICA/ALTA/MEDIA/BAJA` que lo contiene. **Dan 65: 1 CRITICA, 26 ALTA,
25 MEDIA y 13 BAJA**, que es lo que traía el pedido. Coincide también con el resumen que cada
informe escribe en su introducción.

| informe | vector | hallazgos | CRÍT | ALTA | MEDIA | BAJA |
|---|---|---|---|---|---|---|
| `A1` | acceso cruzado y autorización | 6 | 1 | 2 | 3 | 0 |
| `A2` | máquinas, carreras y huérfanos | 8 | 0 | 2 | 4 | 2 |
| `A3` | datos, migración y acoplamiento | 9 | 0 | 4 | 3 | 2 |
| `B1` | doble cobro y pérdida de pago | 7 | 0 | 4 | 2 | 1 |
| `B2` | máquinas, idempotencia y carreras | 4 | 0 | 3 | 1 | 0 |
| `B3` | conciliación, datos y migración | 7 | 0 | 3 | 3 | 1 |
| `C1` | la costura | 8 | 0 | 3 | 4 | 1 |
| `C2` | liberación, coexistencia y migración | 9 | 0 | 4 | 4 | 1 |
| `D1` | coherencia del conjunto | 7 | 0 | 1 | 1 | 5 |
| | **total** | **65** | **1** | **26** | **25** | **13** |

**Las citas de los informes se verificaron con script.** `27-fase-8-vuelta-1/verificar-citas.py`
sobre los nueve informes: **255 ok, 0 desplazadas, 0 fallas** (A1 23, A2 37, A3 37, B1 34, B2 23,
B3 26, C1 23, C2 29, D1 23). Las citas del código actual (`.ts`, `.sql`) el script no las mira; las
que sostienen la CRÍT se leyeron a mano (§3).

---

## 2. Los racimos

Un racimo es un conjunto de hallazgos con **una sola causa**. Como en la vuelta 2, **todo**
hallazgo tiene racimo, en dos clases: los **convergentes** (R1–R12), donde llegan agentes
distintos, y los **de un solo agente** (R13–R30), que no aportan convergencia pero sí una causa.
Dentro de cada clase van por lo que está en juego: acceso y plata primero, después la costura y el
corte, después registro.

La última columna dice si el texto que abre el racimo nombra una pieza posterior a la vuelta 2:
**lista** (una pieza de la lista del pedido: `U1`, receptor en la misma ruta, Worker `500`,
`puedeCobrarle`, acciones 23 a 25, `S38`, `A7`), **rev.** (otra pieza de la revisión del owner del
2026-09-28 o de los lotes N a P: `C3`, `C8`, `C10`, `C12`, `N-H`, `DEC-DATA-008`), **arr. V2** (un
arreglo de la FASE 9 vuelta 2, del 2026-09-27, también posterior al cierre de la vuelta 2) o **—**.

| racimo | causa | sev. | agentes | pieza posterior |
|---|---|---|---|---|
| **R1** | el reclamo de Partner no tiene precondiciones sobre la cuenta ni sobre el vínculo | ALTA (informe: CRÍT) | `A1`, `A2` | arr. V2 (`R7`) |
| **R2** | la prueba del corte se escribe en el paso 3, antes del catálogo que la define | ALTA | `A2`, `A3` | rev. (`C12`, `N-H`) |
| **R3** | las migraciones de `U1` nacen meses antes del paso 3 y nadie gobierna su orden de aplicación | ALTA | `A3`, `C2` | lista (`U1`) |
| **R4** | `puedeCobrarle` lee el estado de la fila como si fuera el del proveedor | ALTA | `C1`, `D1` | lista (`puedeCobrarle`) |
| **R5** | el objeto de `G13` es una lista, y la lista no tiene las dos preguntas de ida | ALTA | `C1`, `D1` | lista (`puedeCobrarle`) |
| **R6** | la compra de addon no tiene identidad propia: la clave nace por pantalla y `A3` reenvía tarde sobre `EX-43` | ALTA | `B1`, `B2` | arr. V2 (`R4`) |
| **R7** | la fila de `refund` sólo se ata a su devolución si la respuesta llega | ALTA | `B1`, `B2` | arr. V2 (`R19`) |
| **R8** | la pérdida declarada del corte (`G1-4`) se apoya en una población y un detector que no existen | ALTA | `B3`, `C2` | arr. V2 (`R21-b`), en parte |
| **R9** | lo que el código y el operativo necesitan después del corte vive en carpetas que no se despliegan o se archivan | MEDIA | `B3`, `C2` | arr. V2 (`R8`); lote P-B |
| **R10** | la baja de cuenta (acción 24) se define por las columnas que reemplaza, no por lo que tiene que quedar cerrado | MEDIA | `A1`, `A3` | lista (acción 24) |
| **R11** | `pedido_de_arreglo` cuelga de la ficha y no entró a la lista cerrada de `PURGED` | MEDIA | `A2`, `A3` | rev. (`C10`) |
| **R12** | texto vencido: una corrección que no llegó a la frase vecina | BAJA | `A2`, `A3`, `B1`, `B3`, `C2`, `D1` | rev. y lista, casi todo |
| **R13** | la cadena de autorización no tiene lugar para una escritura legítima de quien no es dueño | ALTA | `A1` | arr. V2 (`R14`) |
| **R14** | restaurar la base no deshace lo que el corte ya hizo fuera de ella | ALTA | `C2` | lista (Worker, reapertura de la ruta); rev. (`C3`) |
| **R15** | el diseño no inventaría el carril de extras | ALTA | `A3` | rev. (`C3`), en parte |
| **R16** | una devolución no lee el estado del pago, y el contracargo no lee las devoluciones | ALTA | `B2` | — |
| **R17** | el barrido toma por definitivo un `cancelled` que el proveedor puede deshacer, y no recoge dos bordes medidos | ALTA | `B3` | arr. V2 (`R2`) |
| **R18** | tres plazos que sostienen detectores de plata no están en la lista cerrada de plazos | ALTA | `B3` | rev. (`DEC-DATA-008`) |
| **R19** | la clave de canje de `extenderTrial` no la guarda quien ejecuta | ALTA | `C1` | — |
| **R20** | el package vacío de `U1` y `V1` en paralelo con `B1` dejaron sin dueño el orden de las interfaces | MEDIA | `C1` | lista (`U1`, lote P-C) |
| **R21** | «sólo `SUPER_ADMIN`» es un rol, y asignar un permiso no es ninguna fila | MEDIA | `A1` | — |
| **R22** | la moderación le cede el lugar de una ficha a otra y la vuelta no reordena | MEDIA | `A2` | rev. (`C10`, `PB13`) |
| **R23** | los borrados remotos de `PB9` y `PB12` no tienen orden ni reintento | MEDIA | `A2` | — |
| **R24** | el hecho 5 lo escribe un recálculo sin lock | MEDIA | `A2` | — |
| **R25** | una clave medida de scope global no sabe en qué ventana contar | MEDIA | `A3` | — |
| **R26** | la transferencia que no cae en una cuota abierta no tiene dónde asentarse | MEDIA | `B1` | — |
| **R27** | la revocación devuelve el plan y los recurrentes, y se queda con el addon de única vez | MEDIA | `B1` | probable arr. V2 (`R1`), sin etiqueta en la línea citada |
| **R28** | el espejo reconoce una cancelación propia por el correo y no por la llamada | MEDIA | `B2` | arr. V2 (`R18`), residuo |
| **R29** | publicar una versión de addon escribe en billing y ningún acto ni unidad lo tiene | MEDIA | `C1` | — |
| **R30** | entre el recuento del paso 2 y la migración del paso 3 el viejo sigue aceptando fichas | MEDIA | `C2` | — |

En los convergentes quedan **39** hallazgos y en los de un solo agente **26**: **65**, ninguno
huérfano (§8, verificado con script). Críticos: **1 declarado** (`F-8V3A1-001`, en R1), **que el
consolidador propone bajar a ALTA** (§3 y §4), y **ninguna ALTA propuesta para subir** (§4).

### Convergencias que traía el pedido, confirmadas o descartadas

| convergencia | veredicto | dónde quedó |
|---|---|---|
| la prueba gratis del corte antes del catálogo del 3a (`A2-001`, `A3-001`) | **confirmada, exacta**: las mismas líneas (`16-` paso 3 y 3a, `V/21` §2.4) y las mismas dos salidas | R2 |
| `G13` sin las respuestas de arranque de ida (`C1-002`, `D1-001`) | **confirmada, exacta**: citan las mismas líneas de `V/20` §2 y del contrato §5.1 y §6.3 | R5 |
| la fila 27 del glosario sin la marca (`C1-004`, `D1-002`) | **confirmada**: es el mismo hallazgo con la misma cita del glosario | R4 |
| `puedeCobrarle` sobre `CANCEL_SCHEDULED` en reintento (`C1-001`) | **se une a la fila 27 por la causa**: las dos leen el estado de la fila y no si la cancelación se confirmó; la marca que le falta a la fila 27 es la mitad que cubre desde el día 3, `C1-001` es la ventana de antes | R4 |
| orden de addon de única vez con respuesta perdida (`B2-001`, `B1-001`, `B1-002`) | **confirmada**: `B2-001` y `B1-002` son el mismo mecanismo (la pantalla recargada acuña otro pedido y `A3` activa o crea el viejo a las 72 h); `B1-001` es la rama del error del reenvío | R6 |
| addon recurrente sin candado (`B1-003`) | **se une por la causa**: el recurrente no tiene identidad de pedido ninguna | R6 |
| reembolso con respuesta perdida y motivo 18 (`B2-003`, `B1-004`) | **confirmada, exacta**: la misma celda de `RF2` y la misma frase de `B/09` que da el defecto por cerrado | R7 |
| contracargo y reembolso (`B2-002`) | **descartada como convergencia**: otra causa (la devolución no lee el estado del pago) | R16 |
| idempotencia sin clave del lado que ejecuta (`C1-003` con el patrón de `B2-001`) | **descartada**: en `B2-001` la clave sí se guarda (el pedido); el defecto es su origen, no su ausencia. Es la misma familia, no la misma causa | R19 y R6 |
| manifiesto de sondas leído desde `mp-probes/` (`C2-008`, `B3-006`) | **confirmada, exacta**, y **más ancha**: `C2-007` es la misma causa con el manifiesto del 1b | R9 |
| el Partner (`A1-001`, `A1-002`, `A2-002`) | **confirmada por la causa**: el acto de reclamar no condiciona nada; `A1-002` y `A2-002` citan la misma línea del modelo | R1 |
| la pérdida declarada de `G1-4` (`C2-004`, `B3-001`) | **confirmada**: la misma declaración atacada por su población (el anual) y por su detector (el `payer_email` vacío) | R8 |
| `U1`, el paso 6 y las restauraciones (`A3-002`, `A3-003`, `A3-004`, `C2-001`, `C2-002`, `C2-003`, `D1-003`) | **partida en cuatro causas**: el orden de las migraciones de `U1` (`A3-002`, con `C2-006`, R3); las restauraciones y el aborto (`C2-001`–`003`, R14); el carril de extras (`A3-003`, `A3-004`, R15); y `D1-003`, que es texto vencido (R12) | R3, R14, R15, R12 |
| `pedido_de_arreglo` fuera de `PURGED` (`A2-004`, `A3-007`) | **confirmada, exacta** | R11 |
| «seis hechos» (`D1-006`, `A2-007`); «no admite marca» (`B3-007`, `B1-007`) | **confirmadas**: cuatro lugares distintos con el mismo seis; la misma línea de `B/02` §2.3 | R12 |

Cuatro convergencias que el pedido no traía, encontradas al leer: la baja de cuenta (`A1-004` con
`A3-006`, R10, las dos sobre la fila de la acción 24); «el corte no escribe filas de `trial`»
(`A3-008` en `V/02` con `C2-009` en `B/21`, R12); el orden de las migraciones de `U1` (`A3-002` con
`C2-006`, R3); y el manifiesto del 1b (`C2-007`) con el de sondas (R9).

### R1 · El reclamo de Partner no tiene precondiciones sobre la cuenta ni sobre el vínculo — ALTA (el informe trae CRÍT), 2 agentes

`owner_user_id` lo escribe *«sólo el acto de reclamar»*, y ese acto no condiciona nada: ni que en
la cuenta que reclama no haya otra persona adentro, ni que el vínculo siga nulo, ni que la cuenta
no sea dueña de otro Partner. Tres caminos ciegos:

- la regla 2 del cap. 18 §2.4 verifica el correo de la cuenta del ocupante dando por hecho que la
  sesión es de quien leyó la casilla; nada cierra las sesiones ni las credenciales previas, y una
  vez verificado la regla 3 deja de frenar el cambio de correo (`F-8V3A1-001`);
- el link no vence ni se consume, y nada rechaza reclamar un Partner ya reclamado: quien lea el
  aviso después mueve el Partner a su cuenta y la dueña sigue pagando (`F-8V3A1-002`);
- nada impide que una cuenta reclame dos Partner, y como la suscripción es por `user + vertical`,
  un Gold enciende todas las presencias (`F-8V3A2-002`).

- `F-8V3A1-001` CRÍT → **ALTA** (propuesta, §3 y §4) · `F-8V3A1-002` ALTA · `F-8V3A2-002` ALTA
- Convergencia: `A1-002` y `A2-002` citan la misma definición de la columna y la misma regla 1:
  - `V/02:582` — «`owner_user_id` es nulo hasta el reclamo y lo escribe sólo el acto de reclamar»
- Y la frase que los tres contradicen:
  - `V/18:259` — «Tres reglas lo cierran»

**Severidad.** ALTA. Es acceso indebido (`A1-001`, `A1-002`) y cobro de menos sin detector
(`A2-002`), la clase de CRÍT, pero en caminos plausibles que **no son el principal** del reclamo:
un ocupante que pre-registra el correo de un negocio ajeno, una casilla compartida con un ex
empleado, un dueño de dos negocios. El §3 dice por qué la CRÍT no se sostiene como tal.

**Juan.**

1. Pedro se registra con `reservas@hotel-de-juan.com`, que no puede verificar; su sesión queda
   viva, porque el paso 2 deja operar a una cuenta con el correo sin verificar.
2. Juan postula su hotel con ese correo; el admin aprueba y el aviso para reclamar va a la casilla.
3. Juan abre el link, que pide sesión; el correo ya está tomado, recupera la contraseña y entra a
   la cuenta de Pedro. Reclama: la regla 2 verifica el correo.
4. Juan configura Gold con su tarjeta. Pedro, que nunca perdió la sesión, se cambia el correo (la
   regla 3 ya no aplica), edita la página del hotel y ve el billing; Mercado Pago le sigue cobrando
   a Juan.

**Qué hace falta decidir.** Decisión del owner, porque es a qué cuenta pertenece un Partner:
*¿un reclamo sobre una cuenta cuyo correo nunca se verificó va a soporte, como el cambio de correo
de la regla 3, o verifica y cierra toda sesión y credencial previa de esa cuenta?* y *¿una cuenta
puede ser dueña de más de un Partner?* (si no, qué lo impide y qué contesta el reclamo; si sí, cómo
se cobra cada presencia y a cuál apunta un addon `VERTICAL_SUBSCRIPTION`). Después es aplicación:
el reclamo escribe sólo sobre `owner_user_id` nulo, y el link vence o se consume.

**Pieza posterior.** Las tres reglas nacen del arreglo de `R7` de la FASE 9 vuelta 2
(2026-09-27), posterior al cierre de la vuelta 2: entran en la ventana de atribución de
`DEC-METH-016`. No nombran piezas de la lista.

### R2 · La prueba del corte se escribe en el paso 3, antes del catálogo que la define — ALTA, 2 agentes

La migración estructural del paso 3 escribe la fila de `trial` en `TRIAL_ACTIVE` de cada dueño con
una ficha `L8`, con el plan de trial derivado de la versión vigente y vendible, las versiones
vigentes (el piso del trinquete) y un fin a los días de prueba. Todo eso cuelga del catálogo de
producción, que carga el 3a, **después** de la migración estructural. Los días de prueba cuelgan de
la versión de plan, no de la versión 1 de los plazos, que sí se mudó a la estructural por esta
misma razón.

- `F-8V3A2-001` ALTA · `F-8V3A3-001` ALTA
- Convergencia exacta: los dos citan las mismas líneas del paso 3 y del 3a y de `V/21` §2.4, y
  proponen las mismas dos salidas. `A3` agrega el precedente de los plazos:
  - `nucleo/02:164` — «antes que la escritura `C` y la prueba del corte, que la guardan, y el paso 3a sólo la verifica»
- El orden, a la letra:
  - `D/16:138` — «corren en el carril de datos del despliegue, después de la migración estructural y antes de que arranque el proceso nuevo»
  - `V/21:389` — «en la migración estructural del paso 3, una sola vez, como la»

**Severidad.** ALTA, y se consideró CRÍT (§4). Dos implementadores lo resuelven distinto: con la
referencia estricta la migración falla y el corte aborta (ruidoso, y lo ve antes el ensayo del corte
en `staging`, que corre la misma secuencia); con referencias anulables la fila nace sin plan y sin
fin, `T3` no la vence nunca y **toda la cartera `L8` queda con cobertura gratis y perpetua**. La
segunda rama es plata perdida en el camino principal del corte, pero exige relajar la referencia
al plan de trial que la fila declara en `V/02` §2.2. Contradicción con daño: ALTA.

**Juan.**

1. Juan tiene un alojamiento `ACTIVE` + `PUBLIC` el día del corte.
2. Paso 3: la migración tiene que escribirle su prueba, y no hay `plan` ni `plan_version` de
   Alojamiento todavía.
3. El implementador dejó las referencias y el fin nulos para que pase. `T3` espera una fecha que
   no existe.
4. Juan queda en `TRIAL_ACTIVE`, cubierto y publicado, sin pagar nunca; lo mismo toda la cartera.

**Qué hace falta decidir.** Aplicación, con una elección de orden que conviene mostrarle al owner:
la prueba sale de la estructural a un paso posterior al 3a y anterior al 3b (el grant del 3b
convierte las pruebas de las dos cuentas del owner), con su control de *«una sola vez»* y su lugar
admitido por los guards de escritores de `trial`; o el catálogo sube a la estructural, como
subieron los plazos. Y qué pasa si el paso que la escribe falla a mitad.

**Pieza posterior.** Sí: la prueba del corte es de la revisión del owner (`C12`) y el traslado de
los plazos es del lote `N-H`. **Candidato a generado por la revisión del owner.**

### R3 · Las migraciones de `U1` nacen meses antes del paso 3 y nadie gobierna su orden de aplicación — ALTA, 2 agentes

`U1` borra de la rama, al principio del programa, todo lo que sólo usa el sistema viejo, y el
guard de drift le exige commitear en ese mismo cambio la migración que lo saca de la base; esa
migración se aplica recién en el paso 3. Dos caminos:

- entre lo que borra están `owner_suspended`, `plan_restricted` y `billing_unpublished_at`, que la
  tabla de traducción de `V/21` §2.4 lee para `L5` y `L7`. La migración de `U1` corre antes que la
  de clasificación de `V6`: o la clasificación falla, o `L7` es indistinguible de `L8` y una ficha
  suspendida o fuera de cupo nace `PUBLISHED` con prueba (`F-8V3A3-002`);
- un hotfix con migración durante el congelamiento se aplica en producción antes del paso 3, y las
  del paraguas fechadas antes quedan detrás de la última aplicada: el ensayo en `staging` las aplica
  en el orden inverso y sale verde (`F-8V3C2-006`; el comportamiento del migrador lo deriva `C2` y
  lo marca como no leído).

La salvaguarda que `B/21` §4 escribe no se puede cumplir por orden:

- `B/21:425` — «Si algún día algo del corte volviera a leerlas, corre antes de retirarlas.»

- `F-8V3A3-002` ALTA · `F-8V3C2-006` MEDIA
- Convergencia por la causa: los dos nombran la migración de `U1` como la más vieja del paraguas y
  llegan a una migración que producción aplica en otro orden que el previsto.

**Severidad.** ALTA por `A3-002`: contradicción entre la tabla de traducción y la limpieza, con
daño (cobertura y visibilidad regaladas a quien el viejo tenía fuera del sitio) o con un aborto
ruidoso. No se propone CRÍT: el daño es un regalo, no un cobro ni un acceso a lo ajeno, y la rama
ruidosa la ve el ensayo.

**Juan.**

1. Juan pausó su suscripción con suspensión en el viejo: sus dos alojamientos son `ACTIVE` +
   `PUBLIC` con `owner_suspended`.
2. `U1` sacó la columna del esquema; en el paso 3 la migración de `U1` corre primero.
3. `V6` clasifica con `lifecycle_state` y `visibility`: las dos fichas caen en `L8`.
4. Juan amanece con dos fichas publicadas y prueba gratis. El recuento de dueños con más de una
   `L8` del paso 0 no es gate.

**Qué hace falta decidir.** Aplicación: qué columnas de `accommodations` sobreviven a `U1` hasta el
corte, quién las borra después del paso 3 y en qué orden va esa migración respecto de la de
clasificación; corregir la frase de `B/21` §4; si los hotfixes del congelamiento pueden traer
migraciones y qué verifica el paso 3 sobre la tabla de migraciones aplicadas.

**Pieza posterior.** Sí, de la lista: `U1`. **Candidato a generado por la revisión del owner.**

### R4 · `puedeCobrarle` lee el estado de la fila como si fuera el del proveedor — ALTA, 2 agentes

El contrato excluye `CANCEL_SCHEDULED` de `puedeCobrarle` con una razón de hecho, *«ya está dada de
baja en el proveedor»*, y le suma la marca `CANCELACIÓN_SIN_CONFIRMAR` para el preapproval que
sigue vivo. Pero billing reintenta la cancelación durante hasta 3 días antes de abrir esa marca, con
el preapproval `authorized` (`F-8V3C1-001`); y la fila 27 del glosario, que define el término y
vigila `G-R1-E`, no tiene ni siquiera la marca (`F-8V3C1-004`, `F-8V3D1-002`).

- `F-8V3C1-001` ALTA · `F-8V3C1-004` MEDIA · `F-8V3D1-002` MEDIA
- `C1-004` y `D1-002` son el mismo hallazgo, con la misma cita:
  - `nucleo/01:569` — «Son cinco de los seis a propósito»
- La razón que la ventana de reintento contradice:
  - `D/12:1118` — «porque ésa ya está dada de baja en el proveedor y termina sola por»
  - `B/03:298` — «hasta 3 días después de la transición que decidió la cancelación»

**Severidad.** ALTA por `C1-001`: plata cobrada sobre una cuenta ya dada de baja, sin comprobante
ni correo, en un camino plausible que no es el principal (una baja de cuenta pedida cerca de la
renovación, con una falla transitoria en la cancelación). La fila 27 agranda la ventana: sin la
marca, contesta `no` también después del día 3, que es cuando el barrido deja de reintentar.

**Juan.**

1. Juan pide a soporte la baja de su cuenta. El paso 1 corre `S11`; el correo previo falla de forma
   transitoria y la cancelación queda para el barrido.
2. En el mismo rato, la acción 24 pregunta `puedeCobrarle`: la fila está en `CANCEL_SCHEDULED` y no
   hay marca. Contesta `no`, y la cuenta queda sin nombre, sin correo y sin acceso.
3. La renovación cae al día siguiente: Mercado Pago le cobra el mes. El comprobante sale sin nombre
   ni correo, y Juan no tiene cuenta para verlo ni para pedir la devolución.

**Qué hace falta decidir.** Decisión del owner, porque es qué se le hace a quien paga sin cuenta:
*¿`puedeCobrarle` contesta sobre la cancelación confirmada en el proveedor (releída `cancelled`) en
vez de sobre el estado de la fila, o el cobro que entra en la ventana sobre una cuenta ya dada de
baja tiene su propio camino (a quién se le devuelve y cómo se lo contacta)?* El diseño sugiere lo
primero: la marca existe porque el estado de la fila no alcanza. Después es aplicación: la fila 27
con la respuesta entera (o diciendo dónde está la otra mitad) y `G-R1-E` contando el predicado.

**Pieza posterior.** Sí, de la lista: `puedeCobrarle` (lotes M-F y M-G) y la acción 24.
**Candidato a generado por la revisión del owner.**

### R5 · El objeto de `G13` es una lista, y la lista no tiene las dos preguntas de ida — ALTA, 2 agentes

La implementación de arranque contesta por billing en seis lugares: las cuatro fuentes,
`retenciónDetenida` y `puedeCobrarle`. `G13` existe para que ese cableado no llegue a producción,
pero su objeto está enumerado: el contrato §6.3 nombra las fuentes y `retenciónDetenida`; la fila
de `V/20` §2, que es la que construye `V4`, sólo las fuentes; ninguna nombra `puedeCobrarle`.

- `F-8V3C1-002` ALTA · `F-8V3D1-001` ALTA
- Convergencia exacta: las mismas líneas.
  - `V/20:57` — «un build destinado a producción importa el módulo de la implementación de arranque que contesta por billing»
  - `D/12:1463` — «el `no` a las cuatro fuentes de billing»

**Severidad.** ALTA. El daño es de clase CRÍT (`retenciónDetenida` contestando `no` borra al día
180 las fichas de un cliente en pausa, sin detector; `puedeCobrarle` contestando `no` da de baja
una cuenta que sigue cobrando), pero exige un segundo error: que el merge deje cableada una
respuesta de arranque. Es justo el error que `G13` existe para atrapar y que el §6.3 dice que el
PR del merge no puede revisar de verdad, y por eso no baja de ALTA; no sube porque no es el camino
de la implementación correcta.

**Juan.**

1. `V4` arma el módulo vigilado con lo que dice la fila de `G13`: las cuatro fuentes.
2. En el PR final, `retenciónDetenida` queda cableada a la de arranque. `G13` sigue verde.
3. Juan pausa su suscripción por pedido propio: `detenida: no`. `PB4` archiva sus fichas y `PB9`
   las borra al día 180, lo que `DEC-DATA-006` decidió impedir.

**Qué hace falta decidir.** Aplicación: el objeto de `G13` dicho por regla (*«toda respuesta de
arranque que contesta por billing»*) o por una lista escrita una sola vez y citada desde el §6.3 y
desde `V/20`; y un caso de `G13` por cada respuesta de arranque de la dirección de ida.

**Pieza posterior.** Sí, de la lista: `puedeCobrarle`; y `retenciónDetenida` en el §6.3 es de la
revisión del owner (`C14`). **Candidato a generado por la revisión del owner.**

### R6 · La compra de addon no tiene identidad propia: la clave nace por pantalla y `A3` reenvía tarde sobre `EX-43` — ALTA, 2 agentes

La idempotencia del addon `UNA_VEZ` vive en el identificador de pedido que la pantalla acuña **al
abrirse**. Cubre el doble clic de la misma pantalla y no la pantalla recargada después del error,
que es el caso de la respuesta perdida. Y la recuperación de la instancia sin id de orden es el
reenvío de `A3` a las 72 horas, que el diseño trata como `EX-41` (medido en el acto) cuando es
`EX-43` (`UNKNOWN`). De ahí cuatro caminos:

- la pantalla recargada acuña otro pedido y cobra otra orden; a las 72 h `A3` encuentra la primera
  pagada y la activa: dos `ACTIVE`, dos cobros, ninguna comprobación que lo vea (`F-8V3B2-001`);
- si el primer pedido nunca llegó al proveedor, el reenvío de `A3` **crea** la orden y la cobra
  tres días después, sobre una compra que Juan ya rehízo (`F-8V3B1-002`);
- si el reenvío vuelve con un error, `A3` abandona sin id de orden, y la comprobación de órdenes
  pagadas sólo mira instancias con id: la plata entró y nadie la ve (`F-8V3B1-001`);
- el addon recurrente no tiene identidad de pedido ninguna, y los candados `A` y `B` son de la
  principal: el doble clic crea dos preapprovals y los dos quedan a la vista (`F-8V3B1-003`).

- `F-8V3B2-001` ALTA · `F-8V3B1-001` ALTA · `F-8V3B1-002` ALTA · `F-8V3B1-003` ALTA
- Convergencia: `B2-001` y `B1-002` llegan al mismo par (pantalla recargada y `A3` tardío) por dos
  lados, citando la misma línea:
  - `B/16:101` — «La pantalla de compra acuña un identificador de pedido al abrirse»
- El propio barrido nombra el riesgo que `A3` corre:
  - `B/09:787` — «reenviar con la clave puede crear la orden si nunca»
- Y la declaración que `B1-001` rompe, porque en su camino la comprobación no tiene id:
  - `B/06:444` — «Si devuelve error con la orden existente, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas»

**Severidad.** ALTA. Doble cobro o pago sin servicio, sin detector, en caminos plausibles que no
son el principal (un timeout, un contenedor reciclado en un despliegue, un doble clic). Es la
familia de R4 de la vuelta 2, que el arreglo cerró para la misma pantalla y dejó abierta para la
siguiente.

**Juan.**

1. Juan compra un destaque de 7 días. La pantalla acuña `P1`; Mercado Pago cobra y la respuesta se
   pierde.
2. Juan ve un error, recarga y compra otra vez: `P2`, otra instancia, otro cobro.
3. A las 72 h `A3` reenvía la de `P1`, vuelve aprobada y corre `A2`. Juan tiene dos destaques
   pagados por la misma ficha y el mismo lapso, y ninguna marca se abre.

**Qué hace falta decidir.** Aplicación, con una pregunta que el owner tiene que ver porque depende
de una medición: *¿`A3` puede crear una orden que nunca existió, o sólo confirmar una que existía,
mientras `EX-43` siga `UNKNOWN`?* Después: qué identifica la compra (dueño, producto, objetivo) sin
impedir una recompra legítima, qué hace una pantalla nueva con una instancia viva sin orden, cómo
lee `A3` un error del reenvío, qué comprobación ve dos `ACTIVE` del mismo producto sobre el mismo
objetivo, y qué candado tiene el recurrente.

**Pieza posterior.** Arreglo de `R4` de la vuelta 2 (el identificador de pedido, el reenvío de
`A3`, la comprobación de órdenes y el motivo 23). No nombra piezas de la lista.

### R7 · La fila de `refund` sólo se ata a su devolución si la respuesta llega — ALTA, 2 agentes

`RF2` persiste la clave y guarda el id de la devolución **con la respuesta**. Si la respuesta se
pierde, la fila queda `CONFIRMED` sin id; el texto dice que se reenvía, sin actor (`B2-003`), y que
el reenvío trae el id, cuando `RF-6` midió lo contrario (`B1-004`). El barrido ve una devolución
sin fila y abre el motivo 18; una persona asienta un `RF4`; la fila sigue esperando, y quien la
reintenta con una clave nueva sobre un parcial devuelve dos veces.

- `F-8V3B1-004` ALTA · `F-8V3B2-003` ALTA
- Convergencia exacta, sobre la misma celda:
  - `B/03:1844` — «Una llamada sin respuesta se reenvía con la misma clave y el mismo cuerpo, y vuelve la misma devolución con su id»
- Y la medición que la contradice:
  - `D/06:313` — «y no devuelve el refund original en el cuerpo, así que hay que tenerlo guardado»

**Severidad.** ALTA: doble devolución o doble asiento, sin detector, en un camino plausible que no
es el principal. Reabre el defecto que `B/09` da por cerrado (el arreglo de `R19` de la vuelta 2),
en el caso que lo motivó.

**Juan.**

1. Soporte confirma la devolución de un `COBRO_DUPLICADO` de Juan; Mercado Pago devuelve y la
   respuesta se pierde.
2. Nadie reenvía. El barrido ve la devolución sin fila: motivo 18. Otra persona asienta un `RF4`.
3. La fila `CONFIRMED` sigue en la bandeja; alguien la reintenta con otra clave y Mercado Pago
   devuelve otra vez si queda saldo.

**Qué hace falta decidir.** Aplicación: de dónde saca la fila el id si el reenvío no lo trae,
quién hace el reenvío y antes de qué, cómo clasifica el barrido una devolución sin fila cuando hay
una `CONFIRMED` sin id del mismo pago, y la cita a `RF-6` corregida.

**Pieza posterior.** Arreglo de `R19` de la vuelta 2. No nombra piezas de la lista.

### R8 · La pérdida declarada del corte (`G1-4`) se apoya en una población y un detector que no existen — ALTA, 2 agentes

El owner aceptó (`G1-4`) que lo pagado en el viejo por un período que el corte corta se pierde. La
declaración trae una población y un detector, y los dos fallan:

- la población se acotó con una medición del 2026-09-17 (*«todas mensuales»*) y con la frase de que
  el trial *«suele cubrir»* los días perdidos; pero el viejo vende anuales, `DEC-MIG-002` las sigue
  tomando y el paso 0 las cuenta sólo para fechar la segunda corrida del detector, sin que vuelvan
  al owner: un anual pagado días antes del corte pierde casi doce meses (`F-8V3C2-004`);
- para el titular que sólo conoce el proveedor, el detector es la pasada y el manifiesto *«con su
  `payer_email`»*, y la matriz mide ese campo vacío en el `GET` (`F-8V3B3-001`).

- `F-8V3C2-004` ALTA · `F-8V3B3-001` ALTA
- La frase que el anual contradice, y el campo medido vacío:
  - `D/16:257` — «el trial que estrena lo compensa de hecho»
  - `D/06:334` — «el `GET` lo devuelve vacío, nunca el mail real»

**Severidad.** ALTA. Plata perdida sobre poblaciones que el owner no vio al aceptar, con una
declaración que no está *«con verdad»*: por la cláusula 4 de `DEC-METH-013` no se sostiene sin que
el owner la lea. No se propone CRÍT: las dos poblaciones pueden ser vacías (el 2026-09-24 había un
solo titular desconocido, del propio owner) y el recuento de anuales existe, aunque no vuelva.

**Juan.**

1. En octubre Juan contrata el anual del viejo y paga un año.
2. En noviembre el paso 0 cuenta una anual viva; el número sólo fecha la segunda corrida.
3. El 1b cancela su preapproval. El guion le dice que el trial lo compensa: recibe días de prueba a
   cambio de once meses pagados.

**Qué hace falta decidir.** Decisión del owner, porque es `G1-4` con otra población: *¿una anual
viva el día del corte vuelve al owner antes del 1b, con el monto a la vista, y se sostiene «no se
devuelve» para ella?* Y para el titular desconocido: medir si alguna lectura trae el pagador (el
buscador sin filtro, el pago embebido del registro) y como condición de qué paso; si no hay fuente,
la declaración dice que no tiene detector. Después, reescribir el guion sin *«lo compensa»*.

**Pieza posterior.** `B3-001` nace del arreglo `R21-b` de la vuelta 2 (el aviso previo con la
pasada de sólo lectura). `C2-004` no trae etiqueta en las líneas citadas.

### R9 · Lo que el código y el operativo necesitan después del corte vive en carpetas que no se despliegan o se archivan — MEDIA, 2 agentes

El handler de producción consulta, antes de cancelar un preapproval desconocido, el manifiesto de
sondas de `docs/mp-probes/`, que es de la spec, está marcado no productivo y sale del repositorio
al cerrar HOS-1352; el diseño no dice cómo llega al proceso ni qué hace el handler si falta
(`B3-006`, `C2-008`). El manifiesto del 1b, del que dependen las lápidas y la segunda corrida del
detector (en un anual, hasta un año después), no tiene dónde vivir, y el script que lo produce se
archiva terminado el corte (`C2-007`).

- `F-8V3B3-006` MEDIA · `F-8V3C2-008` MEDIA · `F-8V3C2-007` MEDIA
- Convergencia exacta entre `B3` y `C2` sobre la misma línea:
  - `B/09:112` — «enumerados en el manifiesto versionado de `mp-probes/`, que el»

**Severidad.** MEDIA: huecos que obligan a adivinar (empaquetar, leer de la base, tratar como
vacío). El daño es a una medición del owner o a una corrida que nadie agenda; ninguno toca plata de
un cliente sin pasar antes por una marca. Es la familia de `R8` de la vuelta 2, que el arreglo
resolvió en el qué y no en el dónde.

**Juan.** El 1b cancela el anual de Juan, cuyo registro abierto vence en once meses. Una semana
después `scripts/cutover/` se borra en un commit. Once meses después nadie corre la segunda
corrida: un cobro posterior de Juan que no abrió su marca queda sin confirmar.

**Qué hace falta decidir.** Aplicación: dónde viven en producción los dos manifiestos (tabla o
archivo empaquetado), quién los escribe y los borra, si se versiona uno con `payer_email` adentro,
qué hace el handler si no tiene el suyo, y quién agenda la segunda corrida.

**Pieza posterior.** El manifiesto de sondas es el arreglo de `R8` de la vuelta 2; la segunda
corrida del detector, del lote P-B. Ninguno de la lista.

### R10 · La baja de cuenta (acción 24) se define por las columnas que reemplaza, no por lo que tiene que quedar cerrado — MEDIA, 2 agentes

La acción 24 reemplaza nombre, correo y teléfono, cierra las sesiones y deja la cuenta *«sin
acceso»*. Pero *«sin acceso»* no tiene dato ni paso de la cadena que lo lea, y la vinculación con
Google del código actual sobrevive al reemplazo del correo (`A1-004`); y la baja no alcanza el
correo en claro de la postulación, mientras conserva el seudónimo del trial antes de que el abogado
conteste la pregunta 5 (`A3-006`).

- `F-8V3A1-004` MEDIA · `F-8V3A3-006` MEDIA
- Convergencia por la causa: los dos atacan la misma fila de `NUCLEO/08` §3 y la misma línea del
  modelo de verticales.

**Severidad.** MEDIA: huecos que obligan a adivinar. La vuelta de Juan a una cuenta dada de baja
necesita, además, la vinculación con Google del código actual, que el diseño no nombra.

**Juan.** Juan, que entraba con Google, pide la baja; la acción 24 reemplaza su correo. Días después
toca *«Entrar con Google»*, la cuenta sigue vinculada y obtiene sesión; el paso 2 sólo pregunta por
el correo sin verificar. Contrata, y el aviso previo al cobro sale al correo seudonimizado.

**Qué hace falta decidir.** Aplicación, salvo una pregunta del owner con el abogado: *¿la acción 24
conserva el seudónimo mientras la pregunta 5 está abierta, y quién lo borra si la respuesta llega
en contra?* Después: qué dato marca una cuenta dada de baja y qué paso lo lee, si la baja borra las
credenciales vinculadas, y qué hace con `postulacion.correo`.

**Pieza posterior.** Sí, de la lista: la acción 24 (casos vecinos del 2026-09-29).
**Candidato a generado por la revisión del owner.**

### R11 · `pedido_de_arreglo` cuelga de la ficha y no entró a la lista cerrada de `PURGED` — MEDIA, 2 agentes

La lista de lo que cuelga de `listing` es cerrada y exige que toda tabla nueva entre en el mismo
acto. `pedido_de_arreglo` no entró: tras un `PB12` o un `PB9` queda abierto sobre una ficha que no
existe, y si el admin lo cierra sale el correo de *«moderación levantada»* sobre una ficha borrada
(`A2-004`). La última fila, además, nombra dos tablas que el corte borra y omite `addon_instance`
(`A3-007`).

- `F-8V3A2-004` MEDIA · `F-8V3A3-007` MEDIA
- Convergencia exacta:
  - `V/02:739` — «la columna de tablas nombra hoy las 40, una por una»

**Severidad.** MEDIA: `G-R9` lo detecta el día que se cree la tabla, y el implementador elige sin
criterio. Es la familia de `R9` de la vuelta 2 (lo que cuelga de `PURGED`).

**Juan.** Un admin le abre a Juan un pedido sobre la ficha A y la modera; Juan la borra (`PB12`). El
listado muestra un arreglo vencido sobre A; el admin lo cierra y a Juan le llega un correo que le
dice a dónde volvió una ficha que borró.

**Qué hace falta decidir.** Aplicación: la fila del pedido (se cierra en `PURGED` y sin qué correo,
o se conserva como registro) y las tablas del modelo nuevo en lugar de las dos que el corte borra.

**Pieza posterior.** Sí: la moderación en dos niveles es de la revisión del owner (`C10`,
`DEC-DATA-007`). **Candidato a generado por la revisión del owner.**

### R12 · Texto vencido: una corrección que no llegó a la frase vecina — BAJA, 6 agentes

Doce renglones que dicen lo que el diseño decía antes de una corrección, sin tachar:

- *«seis hechos»* de reinicio, cuando son cinco desde `C8`, en cuatro lugares (`A2-007` en
  `NUCLEO/07` y `V/02`; `D1-006` en `B/03` §7.1 y `B/descomposicion.md`);
- *«el corte no escribe filas de `trial`»*, cuando desde `C12` sí (`A3-008` en `V/02` §2.2, que
  además nombra a `T7`, que salió; `C2-009` en `B/21` §2.5 y §4);
- *«el pago de única vez no admite marca»*, cuando el motivo 23 cuelga de su instancia (`B3-007`, y
  `B1-007` como segunda mitad), sobre la misma línea:
  - `B/02:442` — «no admite una marca de conciliación, porque `reconciliation_mark` cuelga de una suscripción»
- `S11` y `S12` todavía mandan al motivo 15 por una discontinuación que salió con `C8` (`B1-007`);
- cuatro salidas de máquina que la revisión cambió: `MODERATED` sale sólo por `PB11`, `T1` exige
  que la vertical admita altas, el 3b dice que las fichas del owner nacen
  `UNPUBLISHED_BY_BILLING` (`A2-008`); la fila de `V6` con doce transiciones sin `PB13`
  (`D1-005`);
- conteos: `U1` dice que corren dos guards y construye uno (`D1-003`); `V/17` §3.4 y §3.5 cuentan
  21 y 23 acciones donde hay 22 y 24, sin la 25 (`D1-004`); `V/22` promete seis preguntas legales y
  tiene una (`A3-009`); dos capítulos citan un `V/02` §2.4 que no existe (`D1-007`).

- `F-8V3A2-007` · `F-8V3A2-008` · `F-8V3A3-008` · `F-8V3A3-009` · `F-8V3B1-007` · `F-8V3B3-007` ·
  `F-8V3C2-009` · `F-8V3D1-003` · `F-8V3D1-004` · `F-8V3D1-005` · `F-8V3D1-006` · `F-8V3D1-007`,
  todos BAJA.

**Severidad.** BAJA. Dos tocan algo más que la navegación y conviene arreglarlos primero: `B1-007`
(el implementador de `S12` leería una tabla retirada para elegir entre la propuesta de devolver y
la de no devolver) y `A3-008` con `C2-009` (la lista de escritores de `trial` de un guard). No se
propone subir: en los dos la regla vigente está en la tabla del mismo capítulo.

**Juan.** Juan se da de baja por `S11`; su complemento llega a `S12`. El implementador siguió la
frase de `S12` y consulta `vertical_discontinuation`, que quedó con una fila de prueba: la persona
que mira la marca de Juan ve la propuesta de devolver en vez de la de no devolver.

**Qué hace falta decidir.** Aplicación: tachar y reescribir los doce renglones con la regla
vigente.

**Pieza posterior.** Casi todo el racimo es la revisión del owner (`C8`, `C10`, `C12`) y los lotes
(`D1-003` es `U1`; `D1-004`, la acción 25): **candidato a generado por la revisión del owner**, por
construcción.

### R13 · La cadena de autorización no tiene lugar para una escritura legítima de quien no es dueño — ALTA, 1 agente

La precisión 7 cierra lo ajeno a lecturas (*«una escritura exige `sujeto = dueño`»*) y cuenta como
escritura *«algo que cuelga de él»*; de la ficha cuelgan las conversaciones y las reseñas, así que
a la letra un turista no puede escribirle a una ficha ajena publicada (`A1-003`). Y el paso 1
rechaza al guest salvo en una lectura, mientras `PP1` es una escritura desde un formulario público
(`A1-005`). En los dos, la salida que no rompe el producto es una exención por superficie, que el
§3.5 prohíbe y que nadie vigila.

- `F-8V3A1-003` ALTA · `F-8V3A1-005` MEDIA

**Severidad.** ALTA por `A1-003`: contradicción con daño en los dos sentidos (una lectura rompe la
consulta y las reseñas, que son del camino principal del turista; la otra, exenta sin mirar el
estado, confirma la existencia de borradores ajenos y deja escribirle a su dueño).

**Juan.** Juan, turista, prueba identificadores de fichas en borrador; la exención que un
implementador agregó para que las consultas funcionen le acepta el mensaje, y así sabe cuáles
existen y le escribe al dueño de una ficha que nadie publicó.

**Qué hace falta decidir.** Decisión del owner en una mitad: *¿postular un Partner exige cuenta, o
`PP1` es la segunda excepción del guest en el paso 1, con qué límites?* La otra es aplicación: si
conversaciones y reseñas son un recurso con dueño propio (el turista) fuera de la precisión 7, con
su regla de estado y la respuesta sobre una ficha no pública.

**Pieza posterior.** Arreglo de `R14` de la vuelta 2 (`F-8V2A1-001`, *«una escritura exige
`sujeto = dueño`»*).

### R14 · Restaurar la base no deshace lo que el corte ya hizo fuera de ella — ALTA, 1 agente

Las dos restauraciones del corte y la rama de aborto inventarían la base y dejan afuera tres cosas:

- el backup del paso 6 se restaura con las altas del sistema nuevo abiertas desde el paso 5: se
  pierden suscripciones cuyos preapprovals siguen vivos (`F-8V3C2-001`);
- la rama de aborto cubre hasta el 4b, y para entonces el paso 4 ya abrió la ruta y el receptor
  nuevo confirmó los reintentos que el Worker rechazó con `500`: restaurar el 2b los borra, y
  Mercado Pago no los vuelve a mandar (`F-8V3C2-002`);
- la promoción `staging → main` es el paso 3, y la rama de aborto no la revierte: el primer
  despliegue de `main` después de un aborto sube el sistema nuevo y borra las tablas del viejo que
  está cobrando (`F-8V3C2-003`).

- `F-8V3C2-001` ALTA · `F-8V3C2-002` ALTA · `F-8V3C2-003` ALTA
- La garantía que `C2-001` rompe, y la restauración que lo hace:
  - `D/16:143` — «así que la rama de aborto nunca restaura un backup encima de un preapproval vivo»
  - `D/16:145` — «Si algo falla, se restaura el backup de este paso, que deja la base igual a como terminó el 5b»

**Severidad.** ALTA. Los tres dan daño de clase CRÍT (preapprovals vivos sin fila, cobros
confirmados que desaparecen, tablas de un sistema vivo borradas sin detector), pero los tres
necesitan una falla previa (el paso 6, el 4b, un aborto seguido de un despliegue). Caminos
plausibles, no el principal.

**Juan.**

1. El 1b cancela el preapproval de Juan con su primer cobro en vuelo; Mercado Pago lo aprueba con
   la ruta cerrada por el Worker.
2. El paso 4 abre la ruta; el receptor nuevo asienta el pago sobre la lápida y contesta `200`.
3. El 4b no ve la entrega IPN del pago chico; se aborta y se restaura el 2b.
4. El guion le pide a Juan re-suscribirse por el link reactivado: paga otra vez, en el acto, y del
   primer cobro no queda registro.

**Qué hace falta decidir.** Aplicación, con elecciones para el owner: si el paso 6 corre con las
altas y la ruta cerradas en el borde; si la rama de aborto lista antes de restaurar los `payment`
que el receptor nuevo asentó (o si el 4b se reordena para no fallar con la ruta abierta); y si el
aborto revierte en git la promoción a `main`, desde qué se redespliega la imagen vieja.

**Pieza posterior.** Sí: el Worker que cierra la ruta y su reapertura en el paso 4 son de los lotes
P-A y O-B (de la lista: el receptor en la misma ruta y el Worker `500`); el paso 6 es de la
revisión del owner (`C3`). **Candidato a generado por la revisión del owner.**

### R15 · El diseño no inventaría el carril de extras — ALTA, 1 agente

`packages/db/src/migrations/extras/` guarda lo que Drizzle no expresa, y el diseño lo trata en dos
lugares como si no existiera:

- el paso 6 reemplaza `packages/db/src/migrations/**` por una migración de partida generada de la
  base, y el carril de extras vive adentro: si la partida sale de `drizzle-kit`, toda base armada
  desde el repositorio nace sin el trigger que rechaza el `DELETE` sobre `trial` (invariante 2) ni
  el de la postulación, y el test del invariante da verde contra una base que nunca lo tuvo
  (`F-8V3A3-003`; el procedimiento del corte no nombra el carril, verificado: cero coincidencias);
- un trigger del código actual borra de `user_bookmarks` los favoritos de una ficha cuando su
  `deleted_at` pasa de nulo a no nulo, y el diseño promete conservarlos en `PURGED` sin decir si
  `PURGED` escribe `deleted_at` (`F-8V3A3-004`).

- `F-8V3A3-003` ALTA · `F-8V3A3-004` ALTA

**Severidad.** ALTA. En `A3-003` producción conserva los objetos (el paso 6 no corre nada); el daño
es en las bases que se arman después (`staging`, CI, la plantilla de worktrees, una recuperación
sin backup). En `A3-004` son datos de terceros borrados sin detector, en un camino plausible: la
tabla de traducción equipara `deleted_at` con `PURGED`.

**Juan.** Ana tiene como favorito el alojamiento de Juan. Juan lo borra; el implementador de `PB12`
escribe también `deleted_at`, siguiendo la equivalencia de la traducción. El trigger borra el
favorito de Ana, y ni `G-R9` ni ningún test de la lista cerrada mira triggers.

**Qué hace falta decidir.** Aplicación: si el paso 6 deja afuera el carril o lo consolida, cómo se
genera la partida (volcado o Drizzle) y qué filas de referencia lleva; si `PURGED` escribe
`deleted_at`, y qué se hace con el trigger de favoritos.

**Pieza posterior.** `A3-003`: el paso 6 es de la revisión del owner (`C3`), **candidato**.
`A3-004`: no, es el código actual contra una regla anterior.

### R16 · Una devolución no lee el estado del pago, y el contracargo no lee las devoluciones — ALTA, 1 agente

Los motivos que proponen devolver son cobros que el cliente no esperaba, que son los que se
desconocen ante el banco. `P6` abre `CONTRACARGO` sobre el pago, pero el pago sigue colgado de la
marca que propone devolverlo, y ni `RF1` ni `RF2` leen el estado del pago; al revés, la comprobación
no relee pagos `REFUNDED`, así que un contracargo sobre algo ya devuelto no lo ve nadie.

- `F-8V3B2-002` ALTA

**Severidad.** ALTA: la plata sale dos veces, sin detector, en un camino plausible que no es el
principal.

**Juan.** Juan se da de baja; un cobro en vuelo entra y abre `COBRO_POSTERIOR_A_LA_BAJA`. Juan lo
desconoce ante el banco el mismo día y corre `P6`. Al día siguiente soporte sigue el default
«devolver» de la otra marca: Juan recibe la plata por el banco y otra vez por Hospeda.

**Qué hace falta decidir.** Aplicación: si `P6` cancela los `refund` pendientes del pago y resuelve
sin devolver su lugar en las otras marcas, o si `RF2` relee y se niega sobre `CHARGED_BACK`; y si
la comprobación relee también los `REFUNDED` de la ventana.

**Pieza posterior.** No nombra piezas posteriores.

### R17 · El barrido toma por definitivo un `cancelled` que el proveedor puede deshacer, y no recoge dos bordes medidos — ALTA, 1 agente

El criterio de exención del barrido y la salida de `S16` asumen que un `cancelled` leído es
definitivo. El código actual documenta seis preapprovals cancelados por Mercado Pago ante un
rechazo que horas después decían `authorized`: el diseño trae esa observación como `EX-45` y la
acota al corte, cuando cae sobre la población que el barrido exime (`B3-002`). En el mismo
criterio faltan dos bordes medidos: el registro del alta no trae `expire_date` (`RC-7`), que es la
mitad de la condición de exención (`B3-004`), y el registro que el listado devuelve da `404` por id
(`EX-55`), sin rama en *«¿cobró?»* (`B3-005`).

- `F-8V3B3-002` ALTA · `F-8V3B3-004` MEDIA · `F-8V3B3-005` MEDIA

**Severidad.** ALTA por `B3-002`: cobros mensuales sin servicio si el aviso del cobro revivido se
pierde (`WH-5`). Es la premisa *«cancelado no cobra»* de `R2` de la vuelta 2, que el arreglo llevó a
la matriz y acotó al corte.

**Juan.** El primer cobro de Juan se rechaza y Mercado Pago cancela el preapproval; `S16` lo relee
`cancelled` y la fila sale del barrido. Horas después vuelve `authorized`: Juan cargó otra tarjeta y
cobra. El aviso se pierde, y Juan paga todos los meses con la fila en `CHARGE_DECLINED`.

**Qué hace falta decidir.** Decisión del owner sobre alcance: *¿`EX-45` condiciona el criterio de
exención de `B11` (y bloquea o no esa unidad), o se acepta y se declara el residuo con su
población?* Después: qué cierra el registro de un alta sin `expire_date`, y qué lee *«¿cobró?»*
cuando el registro da `404`.

**Pieza posterior.** El criterio de exención es del arreglo de `R2` de la vuelta 2 (owner
2026-09-27).

### R18 · Tres plazos que sostienen detectores de plata no están en la lista cerrada de plazos — ALTA, 1 agente

El plazo tras el cual una marca abierta escala, la ventana de la comprobación de pagos acreditados
y, por remisión, la de órdenes pagadas (el único productor del motivo 23) se llaman
*«configuración»* y no están en la lista cerrada de `NUCLEO/02` §1.5 ni en la de plazos técnicos:
no tienen valor inicial, pantalla ni unidad.

- `F-8V3B3-003` ALTA

**Severidad.** ALTA: contradice la regla de que todo plazo que decide cuándo pasa algo sale de esa
lista cerrada, y un implementador que deja la ventana en cero apaga el motivo 23 sin que nada lo
avise.

**Juan.** `A3` abandona la instancia del addon de Juan, pero la orden se pagó. La ventana de la
comprobación quedó en cero: el motivo 23 no se abre y nadie le devuelve a Juan lo que pagó.

**Qué hace falta decidir.** Aplicación: a qué lista entran los tres, con qué valor, qué mitad es
dueña, y qué hace concretamente *«escalar»*.

**Pieza posterior.** La lista cerrada es de la revisión del owner (`DEC-DATA-008`) y el motivo 23 del
arreglo de `R4` de la vuelta 2. **Candidato a generado por la revisión del owner.**

### R19 · La clave de canje de `extenderTrial` no la guarda quien ejecuta — ALTA, 1 agente

El contrato, `B/14` §3.2 y la fila de `V4` dicen que la clave de canje vuelve idempotente el
reintento, pero verticales no tiene columna ni tabla que la guarde: un reintento tras una respuesta
perdida corre `T4` otra vez.

- `F-8V3C1-003` ALTA

**Severidad.** ALTA: días de prueba regalados, o un código aplicado y no gastado, en un camino
plausible que no es el principal. Misma familia que R6 (idempotencia por clave), otra causa.

**Juan.** Juan canjea diez días; verticales corre `T4` y la respuesta se pierde. Billing reintenta
con la misma clave y verticales corre `T4` otra vez: veinte días por un código de diez.

**Qué hace falta decidir.** Aplicación: dónde guarda verticales la clave, qué contesta a una clave
ya aplicada, y un caso del juego de la dirección inversa que la reintente.

**Pieza posterior.** No nombra piezas posteriores.

### R20 · El package vacío de `U1` y `V1` en paralelo con `B1` dejaron sin dueño el orden de las interfaces — MEDIA, 1 agente

Con `U1` creando el package vacío, `V1` y `B1` arrancan en paralelo. El §7.1 dice a la vez que `V1`
llena interfaces y simuladores y que cada entrada entra con la unidad que la implementa (`C1-005`);
la interfaz del reloj la construye `B1` y la necesitan `V4` y `V9` sin dependencia declarada
(`C1-006`); y la frase de que billing consume el simulador inverso *«desde `B1`»* quedó de cuando
`V1` iba antes (`C1-008`).

- `F-8V3C1-005` MEDIA · `F-8V3C1-006` MEDIA · `F-8V3C1-008` BAJA

**Severidad.** MEDIA: obliga a adivinar el orden; el daño llega por un falso propio (`B10` leyendo
fichas por `@repo/db`, fuera de `G14`) o por un reloj que las pruebas no mueven.

**Juan.** `V4` se mergea antes que `B1` y lee la hora del sistema; el caso *«un trial vence de
verdad»* no puede fallar, y una regresión deja a Juan con el trial para siempre sin que nadie lo
vea.

**Qué hace falta decidir.** Aplicación: si `V1` escribe las ocho interfaces y sus simuladores, o
cada interfaz entra con su unidad; dónde vive la interfaz del reloj (o la duodécima dependencia
entre épicas); y la frase del §7.1.

**Pieza posterior.** Sí, de la lista: `U1` (lote P-C). **Candidato a generado por la revisión del
owner.**

### R21 · «Sólo `SUPER_ADMIN`» es un rol, y asignar un permiso no es ninguna fila — MEDIA, 1 agente

Seis acciones dicen *«sólo `SUPER_ADMIN`»* contra la regla de que ninguna autorización decide sólo
por rol; asignar un permiso o un rol no es fila de la tabla, y el código actual ya tiene overrides
por usuario.

- `F-8V3A1-006` MEDIA

**Severidad.** MEDIA: hueco que obliga a adivinar. **Juan**, `CLIENT_MANAGER`, recibe por override el
permiso de fijar precios y fija precios sin que ninguna fila registre quién le dio el poder.

**Qué hace falta decidir.** Aplicación: si *«sólo `SUPER_ADMIN`»* es un permiso no asignable por
override, y si asignar un permiso de la tabla es una fila con su auditoría.

**Pieza posterior.** No: las filas que cita son del catálogo de precios; el total de 24 incluye las
nuevas, pero la causa no depende de ellas.

### R22 · La moderación le cede el lugar de una ficha a otra, y la vuelta no reordena — MEDIA, 1 agente

`MODERATED` no ocupa cupo; el reconciliador llena el lugar con la candidata de abajo y `PB13`, al
levantar la baja, encuentra el cupo lleno. El conjunto publicado depende de la historia de
moderación, contra *«depende sólo del cupo»*.

- `F-8V3A2-003` MEDIA

**Severidad.** MEDIA. **Juan** tiene cupo 2 con A y B; un admin modera A, el reconciliador sube C, y
al levantar la baja A queda abajo mientras dure el cupo.

**Qué hace falta decidir.** Aplicación, o una declaración: si la moderada reserva su lugar, si `PB13`
entra a la cola ordenada de `PB3` y `PB7`, o si se declara que la moderación reordena.

**Pieza posterior.** Sí: `PB13` es de la revisión del owner (`C10`). **Candidato a generado por la
revisión del owner.**

### R23 · Los borrados remotos de `PB9` y `PB12` no tienen orden ni reintento — MEDIA, 1 agente

Las fotos en el almacenamiento externo y el token de calendario se borran fuera de la transacción,
sin orden respecto del commit, sin reintento y sin fila que los nombre si fallan.

- `F-8V3A2-005` MEDIA

**Severidad.** MEDIA. **Juan** borra su ficha, la transacción confirma, el almacenamiento falla: las
fotos de su casa siguen servidas por su URL y ya no hay fila para volver a borrarlas.

**Qué hace falta decidir.** Aplicación: el orden, qué se guarda para reintentar y quién detecta lo
colgado.

**Pieza posterior.** No nombra piezas posteriores.

### R24 · El hecho 5 lo escribe un recálculo sin lock — MEDIA, 1 agente

Sobre una ficha no publicada el hecho 5 lo escribe el recálculo que despierta el aviso, sin el lock
por `user + vertical`; `PB9` puede releer entre el commit de billing y el recálculo y borrar con el
reloj viejo, sin que se pierda ningún aviso. Borde de ventana, declarado así por el agente.

- `F-8V3A2-006` MEDIA

**Severidad.** MEDIA (residuo de borde). **Juan** pasa a `SUSPENDED`; antes del recálculo corre
`PB9`, lee `cubierto` falso con el reloj en 180 días y borra una ficha que nunca recibió el aviso
previo.

**Qué hace falta decidir.** Aplicación: el mismo lock para el recálculo, o que `PB9` exija un reloj
posterior a la última pérdida de cobertura; y corregir el ⚠️ que dice que adelantar un borrado
necesita un aviso perdido.

**Pieza posterior.** No nombra piezas posteriores. Es la familia de `R22` de la vuelta 2 (la regla
del lock aplicada a una parte de las escrituras).

### R25 · Una clave medida de scope global no sabe en qué ventana contar — MEDIA, 1 agente

Una clave de limit puede declarar scope global, y `cuota_ventana` está atada a una vertical: para
una clave medida global que otorgan dos verticales, el diseño no dice qué fila lleva la ventana.

- `F-8V3A3-005` MEDIA

**Severidad.** MEDIA. **Juan** consume la misma clave desde Alojamiento y desde Gastronomía y abre
dos ventanas contra el mismo cupo global: gasta el doble.

**Qué hace falta decidir.** Aplicación: si una clave medida puede ser global y, si puede, cómo se
guarda su ventana.

**Pieza posterior.** No nombra piezas posteriores.

### R26 · La transferencia que no cae en una cuota abierta no tiene dónde asentarse — MEDIA, 1 agente

El pagador manual tiene una cuota por período, sin monto; la segunda transferencia, la de más o la
que llega sobre una `CANCELLED` no tiene fila, marca ni `refund` posible.

- `F-8V3B1-005` MEDIA

**Severidad.** MEDIA: el admin ve la plata y puede devolverla por fuera; falta el rastro. **Juan**
transfiere dos veces la cuota de octubre y la segunda queda en la cuenta de Hospeda sin fila que la
nombre.

**Qué hace falta decidir.** Aplicación: dónde se asienta, qué marca la pone delante de una persona y
de qué cuelga su devolución.

**Pieza posterior.** No nombra piezas posteriores.

### R27 · La revocación devuelve el plan y los recurrentes, y se queda con el addon de única vez — MEDIA, 1 agente

`B/22` §2.2 extendió la revocación a los addons recurrentes; el de única vez comprado en la misma
ventana no tiene fila de complemento y `S21` no lo toma.

- `F-8V3B1-006` MEDIA

**Severidad.** MEDIA. **Juan** revoca al quinto día y recibe todo menos lo que pagó por *«+5
fichas»* tres días antes.

**Qué hace falta decidir.** Decisión del owner con el pliego legal: *¿la revocación alcanza al
addon de única vez comprado en la ventana?* Si sí, qué acto crea su `RF1` y por qué endpoint se
devuelve una orden de `/v1/orders`.

**Pieza posterior.** Probable arreglo de `R1` de la vuelta 2 (la revocación con addons); la línea
citada no trae etiqueta.

### R28 · El espejo reconoce una cancelación propia por el correo y no por la llamada — MEDIA, 1 agente

Para distinguir la baja del proveedor de una cancelación nuestra que perdió su escritura, el espejo
busca el correo *«antes de cancelar»*, que se encola antes de la relectura y puede no existir si
el destinatario está suprimido: falla en las dos direcciones.

- `F-8V3B2-004` MEDIA

**Severidad.** MEDIA, residuo de borde del arreglo `R18` de la vuelta 2, dicho así por el agente.
**Juan** cancela desde su cuenta de Mercado Pago meses después de un `S6` que no llamó; el espejo
encuentra aquel correo y le da `CANCEL_SCHEDULED` en vez de cortar.

**Qué hace falta decidir.** Aplicación: que la prueba sea la llamada, persistida antes de mandarla,
y si el no-entregable suprimido deja una fila legible.

**Pieza posterior.** Arreglo de `R18` de la vuelta 2 (su residuo).

### R29 · Publicar una versión de addon escribe en billing y ningún acto ni unidad lo tiene — MEDIA, 1 agente

Publicar una versión de addon es re-apuntar `addon_product.version_id`, que es de billing: una
acción que escribe en las dos épicas, sin entrada en el §4.1, sin fila en `NUCLEO/08` §3 y sin
unidad.

- `F-8V3C1-007` MEDIA

**Severidad.** MEDIA. **Juan** compró *«+30 fotos»*; el admin no encuentra cómo publicar la versión
nueva, edita la 1 en su lugar y la instancia de Juan pasa a otorgar otra cosa.

**Qué hace falta decidir.** Aplicación: qué acto publica una versión de addon, de qué épica es, cómo
cruza la frontera y qué unidad lo construye.

**Pieza posterior.** No nombra piezas posteriores.

### R30 · Entre el recuento del paso 2 y la migración del paso 3 el viejo sigue aceptando fichas — MEDIA, 1 agente

El 0b cierra sólo los canales que crean cobros; los tres recuentos que protegen la migración se
toman en el 0 y el 2, y la ficha que nace después del segundo llega a la migración sin control.

- `F-8V3C2-005` MEDIA

**Severidad.** MEDIA. **Juan** crea una segunda cuenta con su Gmail con puntos y publica durante el
backup del 2b; en el paso 3 su seudónimo choca con el `UNIQUE`, la migración cae y el aborto deja a
los tres clientes cancelados pagando sin trial.

**Qué hace falta decidir.** Aplicación: si el 0b cierra también cuentas y fichas, o si los
recuentos se repiten con el contenedor viejo apagado.

**Pieza posterior.** No nombra piezas posteriores.

---

## 3. La crítica, verificada

**`F-8V3A1-001` se sostiene como hueco del diseño y no como CRÍT.** Reproduje el camino leyendo
los capítulos citados y separé qué sale del diseño y qué del código actual.

**Lo que sale del diseño, y se sostiene:**

1. **El diseño admite al ocupante**: una cuenta que otro creó con el correo de la dueña, sin poder
   verificarlo. Es el propio caso que el § dice cerrar.
   - `V/18:258` — «el ocupante se cambiaba el correo y se lo llevaba»
2. **El diseño deja operar a una cuenta con el correo sin verificar**, con sesión, sobre una lista
   cerrada: así que el ocupante puede tener sesión viva.
   - `V/17:122` — «Lo que el paso 2 deja pasar con el correo sin verificar es una lista cerrada»
3. **La regla 2 verifica ese correo al reclamar, con una premisa que el diseño no garantiza**:
   - `V/18:264` — «Si la cuenta que reclama es la de ese correo y no lo tiene verificado, el reclamo lo»
   - `V/18:265` — «el link llega sólo a quien lee la casilla, y esa persona es la de la sesión»
4. **Ningún capítulo cierra sesiones ni credenciales previas al verificar ni al reclamar**, y la
   regla 3 vale sólo para *«un correo nunca verificado»*: después del reclamo ya no frena el cambio.
   El silencio lo midió `A1` y lo confirmé: `rg -i "ocupante|recuperar el acceso|sesiones"` sobre
   `V`, el núcleo y el contrato sólo trae la definición del ocupante y las sesiones que cierra la
   acción 24.

**Lo que no sale del diseño:** el paso 3 del camino, **cómo entra la dueña a la cuenta del
ocupante**. El diseño no tiene ninguna regla de recuperación de cuenta; la recuperación por
contraseña y la vinculación por correo con Google y Facebook son del código actual.

- `apps/api/src/lib/auth.ts:498` (código actual) — la vinculación de cuentas por correo, activa para
  Google y Facebook.

**Y el código actual cierra el paso 1**: con `requireEmailVerification: true`, el ocupante que se
registra con contraseña no puede iniciar sesión mientras el correo no esté verificado, así que no
tiene la sesión viva que el camino necesita.

- `apps/api/src/lib/auth.ts:301` (código actual) — `requireEmailVerification: true`, con el
  comentario de que Better Auth bloquea el inicio de sesión de una cuenta sin verificar.

O sea: **el diseño solo no sostiene el camino completo** (le falta cómo entra la dueña), y **el
código actual solo tampoco** (no le da sesión al ocupante). El camino aparece cuando se implementa
el paso 2 del diseño a la letra (una cuenta sin verificar con sesión, que el código de hoy no
permite) sobre la recuperación del código actual, si ésta no revoca las sesiones previas. Hay una
segunda vía que depende sólo del código: la dueña entra con Google a la cuenta del ocupante por la
vinculación, y el ocupante conserva su contraseña; que esa vinculación marque el correo como
verificado (y le abra al ocupante el inicio de sesión) **no lo pude verificar**, porque la lectura
de `node_modules` está bloqueada en este entorno. Queda como pregunta para quien lo implemente.

**Busqué el «NO cierra» que lo cubriera, y no está.** El «NO cierra» de `V/18` declara la presencia
servida desde el caché, el pago manual, el trial de Partner y las aprobadas sin reclamar; nada del
ocupante. Al contrario, el § dice que tres reglas lo cierran.

**Por qué ALTA y no CRÍT.** Es acceso indebido, que es clase de CRÍT, pero no en el camino
principal del reclamo: exige un ocupante que pre-registra a propósito el correo de un negocio
ajeno, y que la dueña elija recuperar esa cuenta en vez de reclamar desde otra, que la regla 2 deja
como camino seguro:

- `V/18:266` — «Si reclama desde otra cuenta, la cuenta con esa dirección no se toca»

Y la mitad del camino depende de código que el diseño no describe. Con el criterio de la corrida
(acceso indebido en un camino plausible que no es el principal) es ALTA, y es la ALTA más alta del
consolidado.

**Para la atribución, sin dictaminarla**: las tres reglas del §2.4 son del arreglo de `R7` de la
FASE 9 vuelta 2 (2026-09-27), posterior al cierre de la vuelta 2 y dentro de la ventana de diffs de
`DEC-METH-016`. Si el owner mantiene la CRÍT, la atribución la imputa a ese arreglo, no a la
revisión del owner ni a los lotes M a P.

---

## 4. Propuestas de cambio de severidad

### Subir a CRITICA

**Ninguna.** Se consideraron cuatro candidatas, verificadas leyendo los capítulos citados; van con
su razón para que el owner pueda discrepar:

| candidato | por qué se consideró | por qué no se propone |
|---|---|---|
| **R2** (`A2-001`, `A3-001`) | dos agentes ciegos; una prueba sin fin sobre toda la cartera `L8` es plata perdida en el camino principal del corte | la rama dañina exige que el implementador relaje la referencia al plan de trial que la fila declara; la rama estricta aborta de forma ruidosa, y el ensayo del corte en `staging` corre la misma secuencia y la ve antes. Contradicción con daño: ALTA |
| **R3** (`A3-002`) | fichas suspendidas o fuera de cupo que nacen publicadas con prueba | el daño es un regalo de cobertura y visibilidad, no un cobro ni un acceso a lo ajeno; y la rama en que la migración choca con la columna borrada también la ve el ensayo |
| **R14** (`C2-002`) | pagos confirmados que el aborto pierde, y un cliente que paga dos veces | exige un aborto con la ruta ya abierta (el 4b que no termina); la población son los cobros en vuelo del 1b. No es el camino principal |
| **R15** (`A3-003`) | una base sin el trigger del invariante 2 | producción conserva los objetos: el daño es en las bases que se arman después desde el repositorio |

### Bajar

| hallazgo | de | a | razón |
|---|---|---|---|
| `F-8V3A1-001` | CRITICA | **ALTA** | el diseño solo no sostiene el camino (no tiene regla de recuperación de cuenta) y el código actual cierra su primer paso; es acceso indebido en un camino plausible que no es el principal (§3). **La atribución puede correr igual sobre él** si el owner prefiere sostener la CRÍT |

**Severidad final**, con esa propuesta: **0 CRITICA, 27 ALTA, 25 MEDIA y 13 BAJA** (65).

---

## 5. Contra las vueltas anteriores

| | FASE 8 completa (24/09) | vuelta 1 (26/09) | vuelta 2 (26/09) | vuelta 3 (30/09) |
|---|---|---|---|---|
| hallazgos | 133 | 100 | 56 | **65** |
| CRÍT declarados | 15 | 1 (+2 racimos propuestos) | 1 (+0 propuestos) | **1** (propuesto bajar; +0) |
| ALTA | 45 | 28 | 21 (22) | 26 (27 con la propuesta) |
| MEDIA | 53 | 47 | 26 (25) | 25 |
| BAJA | 20 | 24 | 8 | 13 |
| racimos | — | 12 convergentes | 13 + 15 de un agente | 12 + 18 de un agente |
| citas verificadas | — | 435 ok | 225 ok | 255 ok |

**La tendencia es 133/15 → 100/1 → 56/1 → 65/1.** Por primera vez el volumen **sube** (56 → 65) y
la BAJA vuelve a crecer (8 → 13): es lo que `DEC-METH-016` anticipó al abrir la vuelta, porque la
revisión del owner y los lotes M a P cambiaron el esqueleto sin lectura adversarial ajena. El
número de críticos declarados sigue en uno; si prospera la propuesta del §4, es la primera ronda
sin crítico sostenido.

**De dónde salen los 30 racimos**, según lo que dice el texto que los abre:

- **12 nombran piezas de la revisión del owner o de los lotes M a P**: 6 de la lista del pedido
  (R3, R4, R5, R10, R14, R20: `U1`, `puedeCobrarle`, la acción 24, el Worker y la reapertura de la
  ruta) y 6 de otras piezas de la revisión (R2, R11, R12, R15, R18, R22: `C3`, `C8`, `C10`, `C12`,
  `N-H`, `DEC-DATA-008`). Ninguno nace de `S38` ni de `A7`: `C1` revisó `S38` en el censo de
  emisores y `B1` la orden rechazada de `A7`, y los dos resistieron.
- **8 nacen de arreglos de la FASE 9 vuelta 2** (R1, R6, R7, R8, R9, R13, R17, R28), también
  posteriores al cierre de la vuelta 2; R27 probablemente también, sin etiqueta que lo confirme.
- **9 no nombran ninguna pieza posterior** (R16, R19, R21, R23, R24, R25, R26, R29, R30).

**Familias que repiten de la vuelta 2, con otra forma.**

- **La identidad de Partner** (`R7` de la vuelta 2): el arreglo ancló el vínculo en la cuenta de la
  sesión y ahora se ataca la sesión, el link y la unicidad (R1). Es la única CRÍT declarada de esta
  vuelta.
- **El cobro de única vez** (`R4`): el identificador de pedido cubre la pantalla y no la compra, y
  el reenvío de `A3` descansa en `EX-43` (R6). Tercera ronda seguida con esta familia en ALTA.
- **La fila de `refund` sin su devolución** (`R19`): el arreglo guarda el id y el id no llega en el
  caso que lo motivó (R7).
- **La rama de aborto** (`R6`): ahora con la restauración del paso 6, los avisos confirmados y la
  rama `main` (R14).
- **El manifiesto de sondas** (`R8`): del qué al dónde (R9).
- **«Cancelado no cobra»** (`R2`): `EX-45` entró a la matriz y se acotó al corte, y cae en la
  exención del barrido (R17).
- **La población a avisar del titular desconocido** (`R21`): su detector lee un campo vacío (R8).
- **Lo que cuelga de `PURGED`** (`R9`): el pedido de arreglo y el trigger de favoritos (R11, R15).
- **La precisión 7** (`R14`): el arreglo que cerró las escrituras ajenas cerró también las
  legítimas (R13).
- **La implementación de arranque** (`R26`): ahora por el objeto de `G13` (R5).
- **El lock** (`R22`) y **la transición que cancela** (`R18`): residuos de sus arreglos (R24, R28).
- **La regla vieja en el lugar viejo** (`R13`, `R28`): R12, ahora con doce renglones.

**Familias nuevas.**

- **El orden del corte contra lo que escribe**: la prueba del corte antes de su catálogo (R2) y las
  migraciones de `U1` aplicadas en otro orden (R3). Las dos nacen de mover escrituras a la
  migración estructural o al principio del programa sin recorrer lo que las lee.
- **`puedeCobrarle`**: su predicado (R4) y su guard (R5).
- **La baja de cuenta** (R10) y **el package vacío de `U1`** (R20).
- **El carril de extras** (R15), invisible al diseño.
- **Montos y marcas cruzadas**: el contracargo contra la devolución (R16) y los plazos sin dueño
  (R18).
- **Idempotencia del lado que ejecuta** (R19).
- Y ocho racimos de un solo hallazgo sin familia previa (R21–R23, R25, R26, R29, R30, y R27).

**Clases que no reaparecen.** Ningún agente reabre el aviso emitido dentro de la transacción (`R16`
de la vuelta 2: `C1` lo atacó y resistió), el censo de emisores (`R12`: `C1` revisó `S20`,
`S32`/`S33`, `S37` y `S38`), la ventana entre los pasos 3 y 4 (`R3`: el Worker la cierra, y `B3` y
`C2` lo dan por resistido), el hecho 4 (`R5`: salió con `C8`), la sucesora del crédito (`R17`), los
montos redondeados (`R20`) ni el caché del corte (`R27`).

### Lo que esto le dice al criterio de `DEC-METH-013` y `DEC-METH-016`

`DEC-METH-016` abrió esta vuelta como excepción y deja el tope vigente para lo que venga después:
con críticos, se declaran con el owner. **Hay un crítico declarado** (`F-8V3A1-001`) **que este
consolidado propone bajar a ALTA** (§3). Si el owner acepta la baja, esta vuelta no deja críticos
sostenidos, y la atribución no tiene sobre qué correr. Si la sostiene, la atribución corre sobre
ella y, por lo que dice el texto, la imputa al arreglo de `R7` de la FASE 9 vuelta 2. En los dos
casos, por `DEC-METH-016` no se abre una vuelta 4. Este consolidado no dictamina la atribución.

---

## 6. Lo que le toca al owner

Cada pregunta sale de un racimo. Entre paréntesis, la opción que el diseño vigente sugiere cuando
sugiere una.

1. **§3**: ¿acepta bajar `F-8V3A1-001` a ALTA, o la sostiene CRÍT y corre la atribución? (el
   consolidador propone bajarla).
2. **R1**: ¿un reclamo sobre una cuenta cuyo correo nunca se verificó va a soporte, o verifica y
   cierra toda sesión y credencial previa? ¿Una cuenta puede ser dueña de más de un Partner? (la
   regla 3 ya deriva a soporte el caso vecino).
3. **R2**: ¿la prueba del corte pasa a un paso entre el 3a y el 3b, o el catálogo sube a la
   migración estructural? (el precedente de los plazos sugiere lo segundo).
4. **R4**: ¿`puedeCobrarle` contesta sobre la cancelación confirmada en el proveedor, o el cobro
   sobre una cuenta ya dada de baja tiene su propio camino? (la marca sugiere lo primero).
5. **R6**: ¿`A3` puede crear una orden que nunca existió mientras `EX-43` siga `UNKNOWN`? (sin
   sugerencia; el barrido tiene prohibido reenviar por esa misma razón).
6. **R8**: ¿una anual viva el día del corte vuelve al owner antes del 1b con el monto a la vista, y
   se sostiene «no se devuelve» para ella? ¿Y la población del titular desconocido se declara sin
   detector si no hay fuente del pagador? (`G1-4` se decidió sobre «todas mensuales»).
7. **R10**: ¿la acción 24 conserva el seudónimo mientras la pregunta 5 está abierta? (con el
   abogado; hoy la baja ya contesta que sí).
8. **R13**: ¿postular un Partner exige cuenta, o el guest tiene una segunda excepción en el paso 1?
   (sin sugerencia).
9. **R14**: ¿el paso 6 corre con las altas y la ruta cerradas, y el aborto revierte la promoción a
   `main`? (el paso 5 sugiere lo primero: su garantía es no restaurar encima de lo vivo).
10. **R17**: ¿`EX-45` condiciona el criterio de exención de `B11`, o se declara el residuo con su
    población? (el diseño hoy lo acota al corte).
11. **R27**: ¿la revocación alcanza al addon de única vez comprado en la ventana? (del pliego legal
    de `B/22`).

El resto de los racimos (R3, R5, R7, R9, R11, R12, R15, R16, R18–R26, R28–R30) es trabajo de
escritura sin decisión de producto, salvo las elecciones de orden que R3 y R22 conviene mostrarle.

---

## 7. Notas del consolidador

Marcadas como tales: no son hallazgos de ningún agente.

- **La CRÍT depende en parte del código actual.** `A1` lo dice al citarlo; el §3 separa las dos
  mitades. La vía de la vinculación con Google no la pude verificar (lectura de `node_modules`
  bloqueada en este entorno).
- **Tres hallazgos descansan en algo no medido o no leído**: `B1-001` y `B1-002` en `EX-43`
  (`UNKNOWN`), y `C2-006` en el comportamiento del migrador de Drizzle, que `C2` deriva y marca como
  no leído. Ninguno cambia de severidad por eso, pero su confirmación es barata y va antes del
  arreglo.
- **Convergencias sobre una misma línea**: `V/02:739` (R11), `nucleo/01:569` (R4), `V/20:57` (R5),
  `B/16:101` (R6), `B/03:1844` (R7), `B/09:112` (R9) y el paso 3 y 3a de `16-` (R2). El corte vuelve a
  concentrar racimos: R2, R3, R8, R9, R14 y R30.
- **Ataques resistidos que no chocan con hallazgos.** A diferencia de la vuelta 2, ningún
  «resistido» de un agente contradice el hallazgo de otro. Dos lo confirman desde el costado: `B2`
  da por resistido el pago que entra mientras `S6` suspende *«salvo el borde del `F-8V3B2-004`»*, y
  `A1` da por resistido el cambio de correo nunca verificado *«lo que no cubre es el caso ya
  verificado por reclamo»*.
- **D1 encontró los conteos congelados sanos** (33 guards, 52 invariantes, 24 acciones, 24
  motivos con 9 que devuelven, 8 entradas del §4.1). Los errores de coherencia están en las
  enumeraciones repetidas a mano: el objeto de `G13` (R5) y la lista del §3.4 de `V/17` (R12).
- **R4 y R5 se refuerzan**: arreglar el predicado de `puedeCobrarle` sin meterlo en el objeto de
  `G13` deja la respuesta de arranque (`no`) como el modo de falla más probable en producción.
- **No se corrió el dictamen de atribución** de `DEC-METH-016` (pregunta 1).

---

## 8. Trazabilidad

Los 65 IDs, cada uno con su racimo. Verificado con script: los IDs de esta tabla son exactamente
los 65 encabezados `### F-8V3` de los nueve informes, sin repetidos ni huérfanos.

| ID | informe | sev. informe | sev. propuesta | racimo |
|---|---|---|---|---|
| `F-8V3A1-001` | A1 | CRITICA | **ALTA** | R1 |
| `F-8V3A1-002` | A1 | ALTA | ALTA | R1 |
| `F-8V3A1-003` | A1 | ALTA | ALTA | R13 |
| `F-8V3A1-004` | A1 | MEDIA | MEDIA | R10 |
| `F-8V3A1-005` | A1 | MEDIA | MEDIA | R13 |
| `F-8V3A1-006` | A1 | MEDIA | MEDIA | R21 |
| `F-8V3A2-001` | A2 | ALTA | ALTA | R2 |
| `F-8V3A2-002` | A2 | ALTA | ALTA | R1 |
| `F-8V3A2-003` | A2 | MEDIA | MEDIA | R22 |
| `F-8V3A2-004` | A2 | MEDIA | MEDIA | R11 |
| `F-8V3A2-005` | A2 | MEDIA | MEDIA | R23 |
| `F-8V3A2-006` | A2 | MEDIA | MEDIA | R24 |
| `F-8V3A2-007` | A2 | BAJA | BAJA | R12 |
| `F-8V3A2-008` | A2 | BAJA | BAJA | R12 |
| `F-8V3A3-001` | A3 | ALTA | ALTA | R2 |
| `F-8V3A3-002` | A3 | ALTA | ALTA | R3 |
| `F-8V3A3-003` | A3 | ALTA | ALTA | R15 |
| `F-8V3A3-004` | A3 | ALTA | ALTA | R15 |
| `F-8V3A3-005` | A3 | MEDIA | MEDIA | R25 |
| `F-8V3A3-006` | A3 | MEDIA | MEDIA | R10 |
| `F-8V3A3-007` | A3 | MEDIA | MEDIA | R11 |
| `F-8V3A3-008` | A3 | BAJA | BAJA | R12 |
| `F-8V3A3-009` | A3 | BAJA | BAJA | R12 |
| `F-8V3B1-001` | B1 | ALTA | ALTA | R6 |
| `F-8V3B1-002` | B1 | ALTA | ALTA | R6 |
| `F-8V3B1-003` | B1 | ALTA | ALTA | R6 |
| `F-8V3B1-004` | B1 | ALTA | ALTA | R7 |
| `F-8V3B1-005` | B1 | MEDIA | MEDIA | R26 |
| `F-8V3B1-006` | B1 | MEDIA | MEDIA | R27 |
| `F-8V3B1-007` | B1 | BAJA | BAJA | R12 |
| `F-8V3B2-001` | B2 | ALTA | ALTA | R6 |
| `F-8V3B2-002` | B2 | ALTA | ALTA | R16 |
| `F-8V3B2-003` | B2 | ALTA | ALTA | R7 |
| `F-8V3B2-004` | B2 | MEDIA | MEDIA | R28 |
| `F-8V3B3-001` | B3 | ALTA | ALTA | R8 |
| `F-8V3B3-002` | B3 | ALTA | ALTA | R17 |
| `F-8V3B3-003` | B3 | ALTA | ALTA | R18 |
| `F-8V3B3-004` | B3 | MEDIA | MEDIA | R17 |
| `F-8V3B3-005` | B3 | MEDIA | MEDIA | R17 |
| `F-8V3B3-006` | B3 | MEDIA | MEDIA | R9 |
| `F-8V3B3-007` | B3 | BAJA | BAJA | R12 |
| `F-8V3C1-001` | C1 | ALTA | ALTA | R4 |
| `F-8V3C1-002` | C1 | ALTA | ALTA | R5 |
| `F-8V3C1-003` | C1 | ALTA | ALTA | R19 |
| `F-8V3C1-004` | C1 | MEDIA | MEDIA | R4 |
| `F-8V3C1-005` | C1 | MEDIA | MEDIA | R20 |
| `F-8V3C1-006` | C1 | MEDIA | MEDIA | R20 |
| `F-8V3C1-007` | C1 | MEDIA | MEDIA | R29 |
| `F-8V3C1-008` | C1 | BAJA | BAJA | R20 |
| `F-8V3C2-001` | C2 | ALTA | ALTA | R14 |
| `F-8V3C2-002` | C2 | ALTA | ALTA | R14 |
| `F-8V3C2-003` | C2 | ALTA | ALTA | R14 |
| `F-8V3C2-004` | C2 | ALTA | ALTA | R8 |
| `F-8V3C2-005` | C2 | MEDIA | MEDIA | R30 |
| `F-8V3C2-006` | C2 | MEDIA | MEDIA | R3 |
| `F-8V3C2-007` | C2 | MEDIA | MEDIA | R9 |
| `F-8V3C2-008` | C2 | MEDIA | MEDIA | R9 |
| `F-8V3C2-009` | C2 | BAJA | BAJA | R12 |
| `F-8V3D1-001` | D1 | ALTA | ALTA | R5 |
| `F-8V3D1-002` | D1 | MEDIA | MEDIA | R4 |
| `F-8V3D1-003` | D1 | BAJA | BAJA | R12 |
| `F-8V3D1-004` | D1 | BAJA | BAJA | R12 |
| `F-8V3D1-005` | D1 | BAJA | BAJA | R12 |
| `F-8V3D1-006` | D1 | BAJA | BAJA | R12 |
| `F-8V3D1-007` | D1 | BAJA | BAJA | R12 |

Conteo por racimo: R1 3 · R2 2 · R3 2 · R4 3 · R5 2 · R6 4 · R7 2 · R8 2 · R9 3 · R10 2 · R11 2 ·
R12 12 (convergentes: 39) · R13 2 · R14 3 · R15 2 · R16 1 · R17 3 · R18 1 · R19 1 · R20 3 · R21 1 ·
R22 1 · R23 1 · R24 1 · R25 1 · R26 1 · R27 1 · R28 1 · R29 1 · R30 1 (de un agente: 26). Total
**65**.

---

## Key Learnings

1. La única CRÍT de esta vuelta nace de un arreglo de la vuelta 2 (`R7`) y no de la revisión del
   owner: una regla que dice *«la persona de la sesión es la que leyó la casilla»* sólo vale si la
   cuenta no tenía sesiones ni credenciales de otro, y el paso 2 del mismo diseño habilita justo
   eso. Verificar una CRÍT que cruza diseño y código exige separar las dos mitades: acá ninguna
   sostiene sola el camino.
2. Mover una escritura a la migración estructural o al principio del programa (la prueba del corte,
   el borrado de `U1`) sin recorrer lo que la lee o lo que la define rompe el orden en silencio. La
   pregunta útil es *«¿qué existe en la base en el instante en que esto se escribe o se lee?»*, paso
   por paso.
3. Una defensa o una definición escrita como lista (el objeto de `G13`, la fila 27 del glosario)
   caduca cada vez que el contrato gana una pregunta; `puedeCobrarle` entró al §4.1 y al §5.1 y no a
   las dos listas que lo rodean.
4. Tres idempotencias se apoyan en un dato que se pierde justo en el caso que vienen a cubrir: el
   pedido que nace por pantalla, el id de devolución que llega con la respuesta y la clave de canje
   que nadie guarda. Hay que buscar dónde vive la clave del lado que ejecuta, no la frase que la
   promete.
5. Toda restauración del corte hay que chequearla contra lo que ya salió de la base: un aviso
   confirmado, un preapproval creado con las altas abiertas y una rama de git promovida son efectos
   sin inverso que un backup no deshace.
6. Una declaración aceptada caduca cuando su población o su detector se apoyan en una medición
   vencida (*«todas mensuales»*) o en un campo que la matriz mide vacío (`payer_email`); por eso
   vuelve al owner aunque ya estuviera decidida.
7. El volumen subió por primera vez (56 → 65) y 12 de los 30 racimos nombran piezas de la revisión
   del owner o de los lotes M a P: confirma la razón de `DEC-METH-016`. Pero la gravedad bajó: ninguna
   de esas piezas generó un crítico sostenido.
