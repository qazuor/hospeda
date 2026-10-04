---
title: "FASE 8-bis-3 · B3 — conciliación, datos y migración"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# B3 · conciliación, datos y migración — tercera vuelta

**Vector**: lo que el barrido ve y lo que no, lo que la base guarda y lo que no, y el corte.
**Material**: `B/02`, `B/03`, `B/05`, `B/06`, `B/09`, `B/12`, `B/16`, `B/20`, `B/21`, el contrato
de cobertura, `NUCLEO/01` §2.4, y el diff completo de los siete commits `1ca12d709` → `1c972a07b`.

**Cómo se recorrió.** El cap. 09 §3 es el § que esta tanda tocó cuatro veces —lo conté sobre
`git log --name-only`: `3692d5deb`, `99e9d4e24`, `f5731fd65` y `1c972a07b`—, así que la unidad de
trabajo fue **el §3 entero como una sola máquina**: qué filas entran al barrido, qué filas salen, y
las dos comprobaciones nuevas que no llaman al proveedor. Después, los dos ejes que el resto del
vector aporta: las columnas nuevas (`sucedida_por`, `permanent_grant_vertical`) y el corte.

| eje | tamaño del dominio | recorrido | resultado |
|---|---|---|---|
| las **puertas a un estado terminal** de una fila principal | **6** — `S3`, `S12`, `S13`, `S16`, `S17` y el espejo de `B/03` §10.1, contadas sobre la tabla del §3.2 | 6 de 6 | **4 enumeradas en la exención, 1 de esas 4 con garantía falsa, 2 sin nombrar** — `F-8dB3-001` |
| la **primera comprobación** × los tres estados de la relación (`B/03` §3.2) × {excepción aplica / no aplica} | 3 × 2 = 6 | 6 de 6 | **la excepción es exactamente la ventana en que el candado `A` está vacío** — `F-8dB3-002` |
| la **segunda comprobación** × las cuatro ramas de `B/12` §5.3 | 4 | 4 de 4 | **la rama 1 deja la fila en `CANCELLED`, que el barrido no alcanza** — `F-8dB3-003` |
| los **pares del espejo** `B/03` §10.1 | **4 × 9 = 36** (4 del proveedor, `RC-1`; 9 nuestros, `B/03` §3.1) | 36 de 36, recontados sobre el texto de hoy | **20 cubiertos, 16 sin declarar** (idéntico a la vuelta anterior) **más un par declarado cuyo remedio no existe** — `F-8dB3-010` |

**Conteo de este informe** (contado sobre los `###` de la sección 1, no estimado):

| | |
|---|---|
| hallazgos nuevos | **11** |
| `CRITICA` | **5** |
| `ALTA` | **3** |
| `MEDIA` | **2** |
| `BAJA` | **1** |
| **atribuidos a un arreglo de la 9-bis-2** | **9 de 11** · **5 de 5** entre los `CRITICA` |
| **de esos, que el grep de `DEC-METH-009` habría encontrado** | **2 de 9** · **1 de 5** entre los `CRITICA` |

Los dos que **no** atribuyo a esta tanda son `F-8dB3-010` (lo introdujo el arreglo 18 de la tanda
**anterior** y sigue en pie) y `F-8dB3-009` (`NUCLEO`, del glosario, mismo caso).

**Números que cito y no medí yo**: los cuatro estados de preapproval salen de `RC-1` (*«los 4
estados suman exactamente 153»*, sandbox, 2026-09-15). Los 26-44 minutos del primer cobro salen de
`PA-3`, re-medido el 2026-09-17 (`B/12` §4.3). La cancelación terminal del milisegundo sale de
`B/12` §4.4, producción, 2026-09-17. `EX-1` en `UNKNOWN` sale de `B/06` §6. **No uso ningún número
de la población de producción**: `DEC-MIG-004` cerró ese tema y este informe no lo toca por ningún
ángulo, tampoco por el de la conciliación.

---

## 1. Hallazgos

### F-8dB3-001 — La exención de terminales se justifica con una asimetría que es falsa en dos de sus seis puertas, y a `S13` ni la nombra: un preapproval que nuestra llamada no canceló sale del barrido

**Qué se rompe.** El beneficiario de un *Free Forever* cuya cancelación en el proveedor falló
**sigue pagando su suscripción todos los meses**. La fila está `CANCELLED`, el preapproval está
`authorized`, cancelar **no emite webhook** (`EX-15`), y el barrido —el único mecanismo declarado
para lo que diverge en silencio— tiene escrito que a esa fila no la mira.

**El camino.**

1. El `SUPER_ADMIN` otorga *Free Forever*. `S13` alcanza *«**toda fila viva** del beneficiario en
   **cada vertical que el grant ancla**»* y su efecto es *«**se cancela el preapproval de cada
   una** en el proveedor —autorizado o esperando autorización— con la misma regla de `S17`»*
   (`B/03` §3.2).
2. **`S13` no tiene rama de fallo declarada, y `S17` sí.** `S17` lleva la condición adentro —*«se
   cancela en el proveedor **si su preapproval sigue vivo**»*— y `B/03` §3.2 escribe el desenlace:
   *«La única rama en la que la sucesión NO se cierra es que la cancelación en el proveedor falle
   sobre un preapproval que la relectura vio vivo. Ahí **`S17` no ocurre**»*. `S13` no dice nada:
   su condición es *«—»* y su destino es `CANCELLED` pase lo que pase con la llamada.
3. La fila queda `CANCELLED` con el preapproval vivo. El cap. 09 §3: *«**Los estados terminales de
   una SUSCRIPCIÓN no se barren**: `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED`»*.
4. Y la razón que la exención da **no incluye a `S13`**: *«En los tres, la autorización quedó
   imposibilitada de cobrar por algo que ya ocurrió y que no depende de que una llamada nuestra
   haya salido bien: `S3` canceló el preapproval al vencer la ventana, **`S12` y `S17`** lo
   cancelan sobre una fila cuyo preapproval `S11` ya canceló *«de inmediato»* o cuya relectura lo
   confirma, y en `CHARGE_DECLINED` **lo canceló el proveedor**»* (`B/09` §3). **Conté las puertas
   a un estado terminal sobre la tabla de `B/03` §3.2 y son seis**: `S3`, `S12`, `S13`, `S16`,
   `S17` y el espejo de `B/03` §10.1 (*«espejar la baja decidida por el proveedor»*). **La
   enumeración nombra cuatro.** Y `S13` no aparece ni una vez en todo el capítulo 09 salvo en la
   excepción de la primera comprobación —lo verifiqué con `grep -rn "S13"`: un solo hit, la
   línea 126, que habla de otra cosa.
5. **La segunda puerta con garantía falsa es `S3`, que sí está enumerada.** *«`S3` canceló el
   preapproval al vencer la ventana»* es **una llamada nuestra**: `B/03` §3.4 punto 2 —*«un job
   recorre las vencidas, las lleva a `ABANDONED` y **cancela el preapproval en el proveedor**. Sin
   ese segundo paso queda una autorización viva que puede cobrar»*— y `B/06` §6 lo subraya sobre
   una medición abierta: *«**`EX-1` sigue `UNKNOWN`** … nuestro job de limpieza cancela
   explícitamente el preapproval al vencer la ventana. … si no lo vence, **es lo único que impide
   una autorización viva que puede cobrar**»*. O sea: la exención afirma exactamente lo contrario
   de lo que el capítulo del proveedor mide.
6. Y no hay otro detector para el caso de `S13`: **mutar o cancelar no emite webhook** (`EX-15`,
   citado en el propio `B/09` §2.3). El primer aviso es **el cobro equivocado**, que llega por el
   camino del pago tardío y falla la condición 1 de `B/05` §3 —*«si está `CANCELLED` … el pago no
   la reactiva»*— y pone la marca. O sea: se detecta **después** de sacarle la plata.

**Dónde lo permite el diseño.** `B/09` §3 (el párrafo de la exención) contra `B/03` §3.2 (`S13`,
`S17`, `S3`), `B/03` §3.4 punto 2, `B/06` §6 y `EX-15`.

**Severidad.** `CRITICA`. Alguien a quien el §35.3 le ordena *«cancelar toda obligación de pago»*
paga igual, y el mecanismo que el diseño declara para verlo tiene escrito que no lo mira.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — el de la familia de `CHARGE_DECLINED`
(`f5731fd65`), que escribió el párrafo *«la exención vale por la razón que hace terminal a cada
uno»*, cruzado con el **arreglo 9** (`S13` alcanza toda fila viva en cada vertical). Antes del
párrafo la exención era una regla sin justificación —igual de floja pero sin afirmar nada falso—;
el arreglo la convirtió en una garantía enumerada, y enumeró cuatro de seis con una de las cuatro
al revés.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No con el término que la regla elige, sí con
otro, y la diferencia es el hallazgo.** El término que el arreglo 9 redefine es **`S13`**, y
`grep -n "S13" 09-conciliacion.md` sobre el capítulo que ese commit **no** toca devolvía, en ese
momento, **cero hits** — no hay aparición que resolver, porque el defecto es una **ausencia**.
Grepeando **`CANCELLED`** o **`estado terminal`** —términos cuya población el arreglo 9 multiplica
por N verticales y por cinco estados— el párrafo de la exención aparece de una. La regla, tal como
está escrita, manda buscar *«el término que redefine»*, y un arreglo nombra su término con el
símbolo de la transición, no con el del estado al que lleva.

---

### F-8dB3-002 — La excepción de la primera comprobación apaga el detector durante las 72 h en que el candado `A` está vacío, que es cuando entra el alta que produce los dos cobros

**Qué se rompe.** Un cliente al que le rechazaron el primer cobro después de pedir un cambio de
plan puede quedar con **dos preapprovals autorizados cobrándole**, y la comprobación que el mismo §
declara *«vigila el único estado que deja el candado `A` vacío, que es el que permite que un alta
nueva entre sin que nada la rechace y queden dos preapprovals cobrando»* está apagada exactamente
durante esa ventana.

**El camino.**

1. La persona autoriza su suscripción y, dentro de la hora, cambia de plan. Es legal y el diseño lo
   dice: *«la 6 llega con el cobro real, que `PA-3` mide **entre 26 y 44 minutos** después de
   autorizar: en esa media hora un cambio de plan es legal y la predecesora todavía está
   `ACTIVE`»* (`B/03` §3.2). Nace la sucesora en `PENDING_AUTHORIZATION`, con `sucede_a` apuntando
   a la predecesora.
2. Llega el cobro y se rechaza. `S16`: *«`ACTIVE` | el **primer** cobro se rechaza |
   `CHARGE_DECLINED`»*, y es la fila 6 de las seis: *«¿sigue siendo fila viva? **no**»* (`B/03`
   §3.2).
3. **El candado `A` queda vacío.** La sucesora tiene `sucede_a` **no nulo**, así que ocupa `B` y no
   `A`: *«`UNIQUE (user_id, vertical) WHERE clase = principal AND sucede_a IS NULL AND estado ∈
   {vivos}`»* (`B/02` §2.2). Ninguna fila viva tiene `sucede_a` nulo.
4. **Y la superficie le pide al cliente que haga exactamente lo que abre el agujero.** `B/12` §4.4:
   *«**El reintento del cliente es una suscripción NUEVA, con id nuevo.** … así que la superficie
   tiene que ofrecer **empezar de nuevo**, no «reintentar el pago»»*. El alta nueva entra: `S1`
   sólo exige *«no hay otro **origen** vivo para ese `user + vertical`»* (`B/03` §3.2) y no lo hay.
5. Al mismo tiempo, el checkout de la sucesora **sigue abierto hasta 72 h**, con su enlace para
   retomar: *«su vertical en estado «esperando que completes el pago», **con el enlace para
   retomar** y la fecha en que vence»* (`B/03` §3.4 punto 3). La persona puede autorizar **las
   dos**, y `EX-6` mide que el proveedor no frena la segunda (`B/02` §2.2).
6. **La comprobación que vería esto está desactivada para esta población, por escrito**: *«**La
   comprobación no alcanza a la sucesora que sigue siendo fila viva en `PENDING_AUTHORIZATION` con
   su ventana abierta**»*, y la excepción nombra `S16` entre sus tres disparadores (`B/09` §3).
7. **Y la razón que da la excepción mira el lado equivocado del candado**: *«Esto **no** abre el
   agujero que la comprobación vigila: mientras la sucesora no autorizó no hay dos autorizaciones
   que puedan cobrar, que es la condición del candado `A`»*. La condición del candado `A` **no es**
   que haya dos autorizaciones cobrando: es que haya **una fila viva con `sucede_a` nulo** que lo
   ocupe. Mientras no la hay, **el `INSERT` de un tercero no se rechaza**, y eso es lo que `B/02`
   §2.2 mide en su propia tabla: *«el candado `A` **vacío** … un alta nueva entraba sin que nada la
   rechazara»*.
8. **Y el daño se vuelve irreversible dentro de la misma ventana.** Si después la sucesora
   autoriza, `S18` tiene que *«limpiar `sucede_a`»* — y esa escritura **la rechaza la base**,
   porque el alta nueva ya ocupa `A`. La sucesión no se puede cerrar nunca, que es el pozo que
   `F-8cB3-001` describió en la vuelta anterior, alcanzado por una puerta nueva.

**Dónde lo permite el diseño.** `B/09` §3 (la excepción y su razón) contra `B/02` §2.2 (los dos
candados y la tabla del candado vacío), `B/03` §3.2 (`S1`, `S16`, `S18`), `B/03` §3.4 punto 3 y
`B/12` §4.4.

**Severidad.** `CRITICA`. Dos autorizaciones vivas del mismo `user + vertical` cobrando: alguien
paga de más, y es el daño exacto que el §11 existe para impedir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — el del cierre (`1c972a07b`), *«la comprobación
de cero llamadas del cap. 09 se acota»*. La comprobación, sin excepción, marcaba esta fila al día
siguiente. La excepción es correcta en lo que vino a arreglar —el falso positivo sobre el cliente
que está por terminar su checkout— y **eligió el borde sobre la sucesora sin recorrer el otro
sujeto del candado**, que es quien puede entrar mientras tanto.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término que la excepción redefine
es **`candado A`** —le cambia la condición: de *«ninguna fila viva con `sucede_a IS NULL`»* a
*«dos autorizaciones que puedan cobrar»*—. `grep -n "candado" 02-modelo-de-datos.md
03-maquinas-de-estado.md`, dos capítulos que `1c972a07b` **no** toca, devuelve la tabla de `B/02`
§2.2 y el §3.2 de `B/03`, y las dos dicen, con esas palabras, que el candado vacío es lo que deja
entrar un alta nueva. La regla existía y no se ejecutó sobre este término.

---

### F-8dB3-003 — El reembolso de la rama 1 no tiene quién lo dispare: `S18` no lo declara y la segunda comprobación no alcanza a la predecesora, que para entonces está `CANCELLED`

**Qué se rompe.** El cliente que cambió de plan desde grace y cuya cuota reciclada entró **pagó un
período que `S17` se llevó puesto**, y el diseño decidió devolvérselo. No hay ningún acto declarado
que lo devuelva: la transición que cierra la sucesión no lo nombra, y el barrido que vino a ser el
backstop no llega a la fila. El pago queda retenido para siempre, que es literalmente el estado que
la comprobación dice cubrir.

**El camino.**

1. La predecesora está en `GRACE_PERIOD`, se declara la sucesión, y entra el cobro reciclado. `S19`:
   *«el pago **se registra y queda pendiente de resolución**: no reactiva, no se reembolsa todavía
   … Su destino lo decide **cómo termina la sucesión**, con las cuatro ramas de `B/12` §5.3»*
   (`B/03` §3.2).
2. La sucesora autoriza. Es la rama 1: *«la sucesora autoriza (`S2`) → `S17` mata a la predecesora y
   `S18` cierra | **se reembolsa, y lo confirma una persona** (`DEC-RF-002`): **al cerrar la
   sucesión se pone la marca** y el caso entra al canal de conciliación»* (`B/12` §5.3).
3. **`S18` no pone ninguna marca ni toca el pago.** Sus efectos, completos: *«se escribe
   **`sucedida_por`** en la predecesora, se **limpia `sucede_a`** en la sucesora, y los
   complementos de la predecesora se **re-apuntan** a ella. La sucesora pasa a ser el origen»*
   (`B/03` §3.2). Ni el pago pendiente ni la marca figuran.
4. **Y la regla que decide qué pasa con eso la escribió el mismo arreglo, dos párrafos más
   abajo**: *«**La regla que lo impide tiene que estar en esta tabla, no sólo en la prosa de otro
   capítulo**, y ésa es la regla 1 del núcleo: **lo que la tabla no declara, no pasa**»* (`B/03`
   §3.2, el § de `S19`). Aplicada a sí misma, la marca de la rama 1 **no pasa**.
5. **El backstop no alcanza.** La segunda comprobación dice cubrir los dos casos —*«la sucesora
   murió, **o la sucesión se cerró**»*— pero corre *«por cada fila de nuestro inventario … **que no
   esté en un estado terminal**»* (`B/09` §3), y una sucesión cerrada deja a la predecesora en
   `CANCELLED` por `S17`, que es el primero de los tres estados terminales exentos. **De los dos
   casos que la comprobación enumera, el segundo es inalcanzable por construcción**; el primero —la
   sucesora murió y la predecesora sigue en `GRACE_PERIOD` o `SUSPENDED`— sí funciona.
6. Lo que queda es lo que el propio § describe como el daño: *«**un pago retenido para siempre**,
   que del lado del cliente se lee como un cobro sin servicio y sin devolución»* (`B/09` §3).

**Dónde lo permite el diseño.** `B/12` §5.3 (la rama 1) contra `B/03` §3.2 (`S18`, y la regla 1
invocada en el § de `S19`) y `B/09` §3 (la segunda comprobación contra la exención de terminales
del mismo §).

**Severidad.** `CRITICA`. El cliente pagó un período que el diseño declaró perdonado y que `S17` le
cortó, y el acto que se lo devuelve no existe en ninguna tabla. Paga de más, y el dinero se queda.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — el **13** (*«el disparador del reembolso es el
CIERRE de la sucesión, no la llegada del pago»*, `99e9d4e24`) más la segunda comprobación
(`1c972a07b`), que se escribió para cubrir justamente este hueco y se lo perdió por la mitad. El 13
movió el disparador de un hecho que sí tiene transición —la llegada del pago— a uno cuya transición
no lo incluye en sus efectos.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es **`S18`** —el
13 le agrega un efecto que su fila no tiene—, y las dos mitades de la contradicción viven en
**`B/03` y `B/12`, los dos capítulos que el mismo commit `99e9d4e24` toca**. La regla manda grepear
*«sobre los capítulos que el commit NO toca»*, así que es ciega por definición a una contradicción
**interna al commit**. Es el segundo modo de falla de la regla, distinto del de `F-8dB3-001`: allá
el defecto era una ausencia; acá es una presencia, pero dentro del radio que la regla excluye.

---

### F-8dB3-004 — `S13` no declara idempotencia ni deja detector, y con un ancla por vertical su ejecución parcial deja al beneficiario de *Free Forever* pagando en una vertical, con el barrido viendo coincidencia

**Qué se rompe.** Un *Free Forever* de scope 3 verticales dispara `S13` sobre todas las filas vivas
de las tres. Si la ejecución muere en la segunda, la tercera queda `ACTIVE` con su preapproval
`authorized` y **el beneficiario sigue pagando todos los meses una vertical que el grant le
regaló**. Ningún mecanismo lo ve, y el diseño lo dice con esas palabras en otro contexto.

**El camino.**

1. El alcance de `S13` se multiplicó: *«**toda fila viva** del beneficiario en **cada vertical que
   el grant ancla** (`B/02` §2.4, `permanent_grant_vertical`) — los seis estados,
   `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos»* (`B/03` §3.2). Son N verticales × hasta
   seis estados, con **una llamada al proveedor por fila**.
2. **`S13` no dice que sea idempotente y su vecina sí.** `S12` cierra su efecto con *«proceso
   **idempotente**»* (`B/03` §3.2); `S13` no lleva esa palabra, ni ninguna regla de reanudación.
   Nada declara qué pasa si la ejecución se corta entre la vertical 2 y la 3.
3. **El estado resultante es indetectable, y lo dice el propio §** al argumentar por qué había que
   meter `PENDING_AUTHORIZATION` en el alcance: *«El beneficiario de *Free Forever* terminaba
   pagando todos los meses una suscripción que el grant le regaló, y **nada lo detectaba: la fila
   está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso coincide**»* (`B/03` §3.2).
   Ese párrafo arregla **el alcance** de `S13` y deja intacta la frase sobre el detector.
4. El barrido compara *«estado | el del proveedor, leído por id»* y *«monto vigente |
   `transaction_amount`»* (`B/09` §3): los dos coinciden. Y las dos comprobaciones nuevas que no
   llaman al proveedor miran `sucede_a` y el pago pendiente, no los grants.
5. **La comprobación que faltaba es de la misma familia y cuesta lo mismo**: un beneficiario con un
   ancla en la vertical V no debería tener una fila viva en V. Las dos filas están en nuestra base,
   igual que las de las otras dos comprobaciones.

**Dónde lo permite el diseño.** `B/03` §3.2 (`S13` y su § propio, contra `S12`), `B/09` §3 (las
comparaciones y las dos comprobaciones de cero llamadas), `B/02` §2.4
(`permanent_grant_vertical`).

**Severidad.** `CRITICA`. El beneficiario de un grant paga una suscripción que el §35.3 ordena
cancelar, indefinidamente y sin que nada lo mire. Es el mismo desenlace que el propio capítulo cita
como razón para ampliar `S13`, por la puerta que ampliarlo abrió.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 9** (*«`S13` alcanza TODA fila viva del beneficiario
en cada vertical que el grant ancla, y cancela el preapproval esté autorizado o esperando»*,
`3692d5deb`). Antes `S13` era una fila y cuatro estados: la ejecución parcial casi no tenía dominio.
Ahora es un fan-out de N×6 llamadas al proveedor, y el arreglo recorrió **qué filas alcanza** sin
recorrer **qué pasa si alcanza algunas**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término es **`S13`**, y grepearlo
sobre los capítulos que `3692d5deb` no toca —`B/09` entre ellos— daba **cero hits**: el detector que
falta no nombra a `S13` en ningún lado porque **no existe**. La regla resuelve apariciones; una
comprobación que nadie escribió no aparece en ninguna búsqueda.

---

### F-8dB3-005 — La re-evaluación del huérfano que `B/16` §4.3 promete corre sobre la fila equivocada: cuando la sucesora abandona, los complementos que cuelgan de la predecesora muerta no los mira nadie

**Qué se rompe.** El cliente hizo un upgrade, murió su predecesora, abandonó el checkout de la
sucesora y se fue. Sus addons recurrentes **siguen cobrando todos los meses**, y el detector que el
capítulo llama *«el que no puede fallar»* nunca se dispara sobre ellos.

**El camino.**

1. Los addons cuelgan de la **predecesora**: el re-apunte a la sucesora es *«un efecto declarado de
   `S18`»* (`B/16` §4.2), y `S18` sólo corre cuando la sucesora llega a `ACTIVE`.
2. La predecesora muere antes por `S12` o `S16` —dos de las tres que `B/16` §4.2 enumera— con la
   sucesora todavía en `PENDING_AUTHORIZATION`. En ese instante el addon **no** es huérfano, y está
   bien: *«no hay una fila viva con `sucede_a` apuntándola»* es falso, porque la sucesora vive.
3. La sucesora abandona: `S3` → `ABANDONED`. Ahora sí se cumple la condición del §4.2 entera, y el
   capítulo lo dice: *«si la sucesora abandona el checkout (`S3` → `ABANDONED`), deja de ser fila
   viva y **el addon pasa a huérfano sin que nadie declare nada**: la condición es sobre un estado,
   así que **se vuelve a evaluar**»* (`B/16` §4.2).
4. **«Se vuelve a evaluar» no nombra ningún disparador, y el único declarado corre sobre la fila que
   se murió**: *«Las transiciones que la cumplen son **las cinco** que en `B/03` §3.2 sacan a una
   fila principal de las filas vivas: `S3`, `S12`, `S13`, `S16` y `S17`, y lo que se evalúa en cada
   una es **la condición del §4.2**»* (`B/16` §4.3). La transición que ocurre acá es el `S3` de la
   **sucesora**, y la sucesora **no tiene complementos**: nunca se le re-apuntaron. Evaluar sus
   huérfanos no devuelve nada.
5. Los complementos de la predecesora quedan sin evaluar y **sin nadie que los evalúe**: no hay
   reconciliador de huérfanos declarado en ningún capítulo, y el barrido del cap. 09 §3 compara
   estado, monto, fecha, cobros y `version` — ninguna de las cinco es la orfandad.
6. El desenlace lo escribe el mismo §: *«un preapproval huérfano sin cancelar es **un débito
   mensual a alguien que ya no es cliente** — y como mutar o cancelar no emite webhook, nadie se
   entera desde adentro»* (`B/16` §4.3). Y la suscripción de complemento sigue `ACTIVE` contra un
   proveedor que dice `authorized`: para el barrido, **coinciden**.

**Dónde lo permite el diseño.** `B/16` §4.2 (*«se vuelve a evaluar»*) contra `B/16` §4.3 (las cinco
transiciones como único disparador) y `B/09` §3 (lo que el barrido compara).

**Severidad.** `CRITICA`. Débito mensual indefinido a alguien que ya no es cliente, que es la
dirección que el propio capítulo declara la que no puede fallar.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — el **10** (`sucedida_por`, leída con `sucede_a`
en `B/16` §4.2) y el **14** (*«el disparador de `B/16` §4.3 es «deja de ser fila viva»*, con las
cinco transiciones»). El defecto anterior era el opuesto y más chico —la condición se evaluaba una
sola vez, en el acto del upgrade—; al volverla *«una condición sobre estados»* el arreglo la hizo
correcta y **dejó su re-evaluación sin sujeto**, en el único caso donde el sujeto cambia de fila.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es *«deja de ser
fila viva»* / *«huérfano»*, y grepearlo sobre los capítulos que `f5731fd65` no toca no muestra nada
malo: los que lo nombran —`B/03` §8, `B/09` §3, `B/16`— son los tres que el commit **sí** toca, y lo
que falta es un mecanismo periódico que **ningún capítulo nombra**. Tercera instancia del mismo
límite: la regla no puede encontrar lo que no está escrito en ninguna parte.

---

### F-8dB3-006 — «Su fila terminal» del complemento no tiene sujeto: el estado terminal es de la instancia y el preapproval es de la suscripción de complemento, que no tiene ninguna transición declarada que la lleve a un estado terminal

**Qué se rompe.** La salvedad que devuelve los complementos al barrido nombra una fila que no se
puede identificar. Según cuál de las dos se lea, el detector funciona por un mecanismo distinto del
que la salvedad describe, o no funciona: la suscripción de complemento se queda `ACTIVE`, el
proveedor dice `authorized`, y el barrido ve coincidencia sobre un preapproval que nuestra
cancelación no aplicó.

**El camino.**

1. El barrido corre sobre suscripciones: *«Por cada fila de nuestro inventario —suscripción
   principal o **suscripción de complemento** (`DEC-ADDON-002`)— que no esté en un estado
   terminal»* (`B/09` §3).
2. La salvedad cambia de sujeto en la oración siguiente: *«**Una instancia de addon** en estado
   terminal SÍ se barre … cuando `A3`, `A4`, `A5` … o `A6` **la llevan a un estado terminal**
   (`B/03` §8)»* (`B/09` §3). `A3`…`A6` son transiciones de la **instancia** (`B/03` §8), cuyos
   estados terminales son `ABANDONED`, `EXPIRED` y `CANCELLED`.
3. **Las dos filas son dos entidades con dos columnas de estado**: `addon_instance` guarda *«estado,
   inicio, fin, **su suscripción de complemento si es recurrente**»* (`B/02` §2.4), y el preapproval
   cuelga de la suscripción de complemento (`DEC-ADDON-002`).
4. **Ninguna transición de la tabla de suscripción lleva a una suscripción de complemento a un
   estado terminal por orfandad.** Las de `B/03` §3.2 son `S1`…`S19`, y la que se le parece —`S11`,
   *«pide la baja»*— aterriza en `CANCEL_SCHEDULED`, que **es un estado vivo** y sostiene servicio
   hasta una fecha de fin: lo contrario de *«se cancelan en el proveedor, **de inmediato**»*
   (`B/16` §4.3). `EXPIRED`, además, **no es uno de los nueve estados** de esa máquina (`B/03`
   §3.1).
5. Entonces, según cómo se lea, el detector sale de dos maneras y ninguna es la que la salvedad
   describe: si el complemento no transiciona, es **no terminal** y el barrido lo compara como a
   cualquier otro —y con nuestra cancelación fallida los dos lados dicen lo mismo, así que **no
   detecta nada**—; si transiciona por una transición no declarada, la regla 1 del núcleo la manda a
   la marca.

**Dónde lo permite el diseño.** `B/09` §3 (la salvedad) contra `B/03` §8, `B/03` §3.1 y §3.2, y
`B/02` §2.4.

**Severidad.** `ALTA`. Una de las dos lecturas produce el débito mensual del `F-8dB3-005`, pero la
otra —`S11` + `S12`— es una implementación razonable que sí lo detecta, por el comodín del espejo.
No la subo a `CRITICA` porque el daño depende de cuál de las dos elija quien lo escriba; lo que está
roto es que el diseño no lo dice.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — la acotación de la exención de terminales
(`f5731fd65`), que es la que introdujo la frase *«una instancia de addon en estado terminal **sí se
barre**»* dentro de un § cuyo sujeto son las suscripciones.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es *«estado
terminal»*, y su otra mitad vive en **`B/03` §8**, que es un capítulo que el **mismo commit**
`f5731fd65` toca (le reescribió la fila `A5`). Segunda instancia del punto ciego de
`F-8dB3-003`: la regla excluye el radio del propio commit, y este defecto está adentro.

---

### F-8dB3-007 — Ninguna columna dice que un pago está «pendiente de resolución»: el predicado de la segunda comprobación no se puede evaluar, y la segunda corrida del barrido marca la fila que la primera resolvió bien

**Qué se rompe.** Tres reglas nuevas se condicionan sobre un atributo del pago que la base no
guarda. Una de ellas —la segunda comprobación— corre todos los días, y sin ese atributo no puede
saber si ya se resolvió: la corrida siguiente vuelve a intentar la misma resolución, falla la
condición 1 de `B/05` §3 y **pone la marca sobre una fila correcta**, que es la que además le
bloquea al cliente ser sucedido.

**El camino.**

1. Las tres reglas: `S6` no corre *«**si hay un pago acreditado del período pendiente de
   resolución** por `S19`»*; la segunda comprobación arranca en *«**si una fila tiene un pago
   acreditado pendiente de resolución**»* (`B/09` §3); y `G-R1-D` vigila que nadie *«**reembolse**
   el pago que quedó pendiente por `S19`»* (`B/20` §2).
2. **`payment` no tiene dónde escribirlo**: *«`payment` | suscripción, monto, moneda, **estado del
   cap. 03 §6**, id del hecho en el proveedor, fecha del hecho, monto reembolsado acumulado»*
   (`B/02` §2.3), y los cinco estados del cap. 03 §6 son `PENDING`, `SUCCEEDED`, `FAILED`,
   `REFUNDED` y `PARTIALLY_REFUNDED`. Un pago acreditado y pendiente de resolución es `SUCCEEDED`,
   indistinguible de cualquier otro.
3. **Mientras la sucesión está en curso se puede derivar** —hay una fila viva con `sucede_a`
   apuntando a ésta— y por eso `S6` y `G-R1-D` se salvan. **La segunda comprobación no**, porque su
   predicado empieza justo donde esa derivación deja de existir: *«y ya **no** es la predecesora de
   una sucesión en curso»*.
4. Y sin el atributo tampoco hay dónde anotar que ya se resolvió. En la rama que sí alcanza —la
   sucesora murió y la fila volvió a `ACTIVE` por `S5`—, la corrida del día siguiente vuelve a ver
   un pago acreditado sobre una fila sin sucesión, resuelve por la misma rama, y `B/05` §3 falla la
   condición 1 (*«si está … ya `ACTIVE`, el pago no la reactiva»*): *«**Si falla cualquiera**, se
   pone la marca `requiere_conciliación`»*.
5. **Y eso contradice lo que el mismo capítulo declara del barrido**: *«**Los dos barridos son
   idempotentes**: correrlos dos veces no produce nada distinto, porque **ninguno escribe salvo la
   reparación de vínculo del §2.4**»* (`B/09` §7). Las dos comprobaciones nuevas escriben la marca,
   y la segunda además ejecuta ramas que reactivan.

**Dónde lo permite el diseño.** `B/09` §3 y §7, contra `B/02` §2.3, `B/03` §3.2 (`S6`, `S19`) y
`B/05` §3 condición 1.

**Severidad.** `ALTA`. La marca sobre una fila sana le bloquea al cliente ser sucedido (`B/02`
§2.2), arranca el reloj que escala (`B/09` §3) y ahoga el listado accionable. No es `CRITICA` porque
nadie paga de más por este camino solo — lo que se rompe es el detector, y su mitad cara ya está en
`F-8dB3-003`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo 12** (`S19`, `99e9d4e24`) más la segunda
comprobación (`1c972a07b`). Es la misma forma que `F-8cB3-005` de la vuelta anterior —un mecanismo
nuevo que se apoya en un atributo que el modelo no tiene— y esa sigue abierta, así que van dos.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término nuevo es *«pendiente de
resolución»*, y grepearlo sobre `B/02` —capítulo que `99e9d4e24` **sí** toca, y `1c972a07b` no—
devuelve **cero hits**. Otra vez una ausencia: el modelo no menciona el término que habría que
resolver. La regla habría funcionado si se grepeara el **sujeto** (`payment`) en vez del término.

---

### F-8dB3-008 — La razón por la que la primera comprobación «no duplica» la marca describe una rama que su propio predicado no alcanza

**Qué se rompe.** El párrafo declara resuelto un solapamiento que no existe, y al hacerlo afirma
que en la rama de la cancelación fallida la predecesora deja de ser fila viva — que es lo contrario
de lo que `B/03` §3.2 decide. Quien lo lea al pie de la letra va a escribir la comprobación
suponiendo que esa rama entra en su dominio, y va a excluirla explícitamente.

**El camino.**

1. `B/09` §3: *«La rama legítima de ese estado —**la cancelación de `S17` que falló sobre un
   preapproval vivo**— **ya trae la marca puesta**, así que esto no la duplica»*.
2. El predicado de la comprobación exige que *«la predecesora a la que apunta **ya no es fila
   viva**»*.
3. En esa rama la predecesora **sigue siendo fila viva**: *«Ahí **`S17` no ocurre**, `S18` tampoco
   —su condición no se cumple—, la marca se pone y una persona lo mira»* (`B/03` §3.2). Si `S17` no
   ocurre, la fila no llega a `CANCELLED` y se queda en el estado vivo que tenía — uno de los cinco
   que `S17` enumera como `desde`.
4. O sea: la rama está fuera del predicado **por el predicado**, no por la marca. La razón escrita
   es correcta en su conclusión y falsa en su mecanismo.

**Dónde lo permite el diseño.** `B/09` §3 contra `B/03` §3.2.

**Severidad.** `MEDIA`. No produce daño solo: la conclusión —no hay duplicación— es cierta. Lo que
cuesta es que la única frase que explica el dominio de la comprobación lo describe mal, y ese
dominio es el que `F-8dB3-002` discute.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — la primera comprobación de cero llamadas
(`3692d5deb`, reforzada por `1c972a07b`).

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término es **`S17`**, y
`grep -n "S17" 03-maquinas-de-estado.md` —capítulo que `1c972a07b` no toca— devuelve el párrafo
*«La única rama en la que la sucesión NO se cierra…»*, que dice exactamente lo contrario. Una
aparición, en un capítulo fuera del commit, que contradice la frase nueva: es el caso ideal para la
regla, y no se ejecutó.

---

### F-8dB3-009 — `NUCLEO` · «Fila viva» se define para instancias de addon y sólo enumera los seis estados de la suscripción, así que «una instancia de addon en estado terminal» no se puede resolver contra el glosario

**Qué se rompe.** El término que el programa creó para que *«vivo»* dejara de tener dos lecturas se
declara sobre dos clases de fila y enumera una sola. La salvedad del cap. 09 §3 y la condición de
`B/16` §4.2 leen la clase que no está enumerada.

**El camino.**

1. `NUCLEO/01` §2.4: *«**fila viva** | una fila —**de suscripción o de instancia de addon**— que
   todavía tiene una autorización de cobro que puede cobrar | **los seis de la suscripción**:
   `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED`, `CANCEL_SCHEDULED`»*.
   La columna *«dónde se enumera»* nombra una sola de las dos clases.
2. La instancia tiene otra máquina y otros estados: `PENDING_AUTHORIZATION`, `ACTIVE`, `ABANDONED`,
   `EXPIRED`, `CANCELLED` (`B/03` §8). **`EXPIRED` no está en los nueve de la suscripción**, así que
   no puede caer ni dentro ni fuera de una enumeración que no lo contempla.
3. Y hay consumidores: *«**Una instancia de addon en estado terminal** SÍ se barre»* (`B/09` §3) y
   la regla 2 del propio § —*««Vivo» sin calificar no se usa en un predicado … va **«fila viva»**»*—
   que obliga a usar el término justamente ahí.

**Dónde lo permite el diseño.** `NUCLEO/01` §2.4 contra `B/03` §8 y `B/09` §3. **Marcado `NUCLEO`**:
lo adopta la pasada C.

**Severidad.** `MEDIA`. Es la definición que sostiene cinco predicados de billing; el que la use
sobre un addon tiene que inventar la enumeración, y el capítulo que la inventa no es el dueño del
término.

**¿Es nuevo, o es el arreglo?** **Es el arreglo de la familia del trial** (`49eb99f34`), que escribió
`NUCLEO/01` §2.4 entero. Al partir *«vivo»* en dos conjuntos declaró el sujeto en plural y enumeró
en singular.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término creado es **«fila viva»**, y
grepearlo sobre `B/16` —capítulo que `49eb99f34` no toca— devuelve la condición de orfandad del
§4.2, que lo aplica a la suscripción objetivo, y el §4.3 que lo aplica al complemento. Dos
apariciones sobre addons, en un capítulo fuera del commit, que la enumeración no contesta.

---

### F-8dB3-010 — El espejo declara que «espejar es una transición declarada de esta tabla» y su octava fila manda ejecutar una que la tabla no tiene: una baja decidida por el proveedor sobre una `ACTIVE` no se puede escribir

**Qué se rompe.** El proveedor da de baja por mora —que `B/12` §1.4 declara un hecho suyo y manda
espejar—, la relectura devuelve `cancelled` sobre una fila `ACTIVE`, y no hay transición que la
ejecute. Por la regla 1 se pone la marca, la fila **conserva el estado que tenía y sigue cubriendo a
quien estaba cubierto** (`B/03` §3.1): servicio completo, indefinido, sobre alguien a quien el
proveedor ya le cortó el cobro. Y `S15` tampoco puede cerrarlo, porque promete *«se ejecuta **la
transición de esta misma tabla** que lo permita»* y no hay ninguna.

**El camino.**

1. `B/03` §10.1, octava fila: *«`cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` |
   **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor**
   (`B/12` §1.4)»*.
2. El § se declara cerrado sobre la regla 1: *«**Espejar un estado leído por id es una transición
   declarada de esta tabla, no un acto aparte**»*, y explica por qué no se resolvió con una
   excepción: *«La excepción … abría un camino que **escribe estado sin transición declarada**, que
   es exactamente lo que la regla 1 existe para impedir»*.
3. **Recorrí las diecinueve filas de `B/03` §3.2 buscando la transición**: las únicas que llegan a
   `CANCELLED` son `S12` (desde `CANCEL_SCHEDULED`), `S13` (por un grant) y `S17` (por una
   sucesión). **Ninguna espeja una baja del proveedor desde `ACTIVE`, `GRACE_PERIOD`, `PAUSED`,
   `SUSPENDED` o `PENDING_AUTHORIZATION`.** La fila nombra su remedio con una frase, no con un `S`.
4. Y el caso no es hipotético: es el camino de mora entero. *«en el camino de mora, **cuándo se
   termina el vínculo no lo decidimos nosotros**. Nuestro grace puede ser más largo que la paciencia
   del proveedor, y si lo es, **la baja llega antes que nuestra suspensión**»* (`B/12` §1.4).

**Dónde lo permite el diseño.** `B/03` §10.1 (octava fila y su nota) contra `B/03` §3.2 y `B/12`
§1.4.

**Severidad.** `ALTA`. Servicio completo sin cota a quien el proveedor dio de baja, y una marca que
ninguna transición puede levantar. No es `CRITICA` porque nadie paga de más: lo que se regala es
servicio, y hay una persona mirando la marca desde el primer día.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, pero de la tanda ANTERIOR** — el 18 de los 23
(*«los ocho pares, enumerados con su veredicto»*). Esta tanda tocó esa tabla una sola vez, para
agregarle la salvedad de `S19` a la fila de `authorized`, y no volvió sobre la octava. Lo reporto
porque es un defecto distinto del que reporté sobre esa tabla en la 8-bis-2 (`F-8cB3-004`, los 16
pares sin declarar) y porque sigue vivo en el texto de hoy.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** No aplica —la regla no existía cuando se
escribió—, y si se aplicara hoy tampoco: las dos mitades están en **el mismo capítulo**, `B/03`, y
la regla mira hacia afuera.

---

### F-8dB3-011 — La salvedad del complemento cita `A4` como una puerta donde cancelamos un preapproval, y por la taxonomía del §1.3 `A4` nunca alcanza a un addon con preapproval

**Qué se rompe.** Nada, hoy. Es una enumeración de cuatro donde una no puede ocurrir, en el párrafo
que justifica meter filas terminales de vuelta al barrido: quien mida el costo de la salvedad cuenta
una población que no existe, y quien la implemente escribe una rama muerta.

**El camino.**

1. `B/09` §3: *«lo cancelamos nosotros cuando `A3`, **`A4`**, `A5` … o `A6` la llevan a un estado
   terminal»*.
2. `A4` es *«`ACTIVE` | **llega su fecha de fin** | `EXPIRED`»* (`B/03` §8), o sea la vigencia
   `DÍAS_FIJOS`.
3. Y el preapproval propio existe sólo si el cobro es `PERIÓDICO` (`B/16` §1.2), combinación que la
   taxonomía declara inexistente: *«**`PERIÓDICO` + `DÍAS_FIJOS` no existe**»* (`B/16` §1.3, tabla
   de tres combinaciones).

**Dónde lo permite el diseño.** `B/09` §3 contra `B/03` §8 y `B/16` §1.2 y §1.3.

**Severidad.** `BAJA`. No hay daño: la enumeración sobra por un elemento.

**¿Es nuevo, o es el arreglo?** **Es el arreglo** — la acotación de la exención (`f5731fd65`), que
escribió la enumeración.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí.** El término es **`A4`**, y grepearlo
sobre `B/16` —capítulo que sí toca el mismo commit, pero también sobre `B/16` §1.3, que no cambió—
devuelve la tabla de las tres combinaciones. Es el tipo de aparición que la regla resuelve bien.

---

## 2. Hallazgos de la 8-bis-2 que siguen llegando sobre el texto de hoy

Los verifiqué uno por uno contra el texto nuevo, no contra mi informe anterior. Van con su ID viejo
y el paso en que llegan hoy; **no los cuento** en el conteo de arriba.

| ID viejo | qué era | por qué sigue llegando, sobre el texto de hoy |
|---|---|---|
| `F-8cB3-004` | el espejo cubre 20 de 36 pares | **recontado sobre la tabla de hoy**: sigue teniendo ocho filas, y `authorized × ACTIVE` —la renovación normal— sigue sin figurar. El único cambio de esta tanda en esa tabla es la salvedad de `S19` en la fila de `GRACE_PERIOD · SUSPENDED` |
| `F-8cB3-005` | la marca lleva reloj y la columna es booleana | `B/09` §3 sigue diciendo *«La marca lleva reloj … **escala**»* y `B/02` §2.2 sigue declarando *«**`requiere_conciliación`** (booleano)»*. Ninguno de los siete commits tocó esa columna |
| `F-8cB3-006` | el barrido excusa `next_payment_date`, así que la columna de `D8` sólo se verifica contra nuestra copia | la fila del barrido está intacta: *«se registra; **no es por sí sola una divergencia**»* (`B/09` §3) |
| `F-8cB3-007` | los guards de `R1` son propiedades de filas en la capa que corre contra el árbol de fuentes | **se arregló la mitad**: `G-R1-A` pasó a *«**el camino** que declara una sucesión»*, y `G-R1-C`/`G-R1-D` nacieron sobre *«un camino»*. **`G-R1-B` no se tocó** y sigue siendo *«una fila … **o esa fecha no es la que el proveedor confirmó**»*, que exige una llamada al proveedor desde CI |
| `F-8cB3-012` | la re-vinculación automática se declara *«no cambia plata»* | `B/09` §2.4 intacto |
| `F-8cB3-019` | `B/05` §C5 afirma una red en la base que no existe | `B/05` §2 `C5` sigue diciendo *«**la base lo impide**»* y `B/02` §2.3 sigue sin columna de período en `payment` |
| `F-8cB3-020` | `B/02` §4 cierra `M-DATA-01` con una tabla de una fila | intacto: sigue teniendo **una** fila, contada |

---

## 3. Lo que esta pasada dice sobre si `DEC-METH-009` funcionó

**Mi vector, medido**: de 11 hallazgos nuevos, **9 los introdujo un arreglo de la 9-bis-2** y los
**5 `CRITICA` son 5 de 5**. La proporción de atribuidos **no bajó**, por tercera vez.

**Pero lo que esta vuelta mide es otra cosa, y da un número accionable: de los 9 atribuidos, el
grep habría encontrado 2** (`F-8dB3-002` y `F-8dB3-008`, más `F-8dB3-009` y `F-8dB3-011` que son
`MEDIA` y `BAJA`), y **de los 5 críticos, 1**. Los siete restantes fallan por **tres modos
distintos**, y conviene separarlos porque piden remedios opuestos:

| modo | qué pasa | cuáles | qué haría falta |
|---|---|---|---|
| **el defecto es una AUSENCIA** | el término redefinido no aparece en el capítulo donde el defecto vive, porque el defecto es que **no** aparece: `S13` no está en la exención, el detector de `S13` no existe, la re-evaluación no tiene disparador, *«pendiente de resolución»* no está en el modelo | `F-8dB3-001`, `004`, `005`, `007` | la pregunta inversa: *«¿en qué capítulos **debería** aparecer este término y no aparece?»*, que es una lista de consumidores, no un `rg` |
| **el defecto es INTERNO al commit** | las dos mitades de la contradicción están en dos capítulos que el mismo commit toca, y la regla manda grepear *«los capítulos que el commit NO toca»* | `F-8dB3-003`, `006` | grepear **también** adentro, que es gratis y es donde el arreglo está más suelto |
| **el defecto es de la tanda anterior** | la regla no existía | `F-8dB3-010` | — |

**La regla sirve, y hay prueba en el propio corpus**: el mensaje de `f5731fd65` registra que
*«`DEC-METH-009` encontró una contradicción viva: `B/12` seguía con la condición histórica de `S16`
que `B/03` ya había reemplazado»*. Ése es el caso para el que está diseñada —un término redefinido
que **aparece**, escrito viejo, en otro capítulo— y lo resolvió. **Lo que no puede hacer es
encontrar una ausencia**, y cuatro de mis cinco críticos son ausencias.

**Lo que yo mediría antes de la próxima vuelta**: no la proporción de atribuidos, sino **cuántos de
los críticos son ausencias**. Este vector da **4 de 5**. Si el número se repite en A y en B, la
tercera obligación del protocolo no se arregla afinando el grep: hace falta que cada arreglo declare
**la lista de consumidores del término que redefine** —quién lo enumera, quién lo detecta, quién lo
guarda— y que esa lista se recorra, porque es lo único que se puede comprobar contra un capítulo que
no dice nada.

---

## 4. Un patrón que este vector ve y que conviene nombrar: las comprobaciones de cero llamadas son cuatro, y están escritas dos

Las dos que la tanda agregó se justifican con el mismo argumento —*«cuesta cero llamadas, las dos
filas están en nuestra base»*— y las dos son correctas. **El argumento alcanza a otras dos que no se
escribieron**, y las dos son las de los críticos más caros de este informe:

| comprobación | estado | qué ve |
|---|---|---|
| sucesión abierta sobre una fila muerta | escrita, con la excepción de `F-8dB3-002` | el candado `A` vacío |
| pago pendiente con la sucesión terminada | escrita, ciega a la mitad `CANCELLED` (`F-8dB3-003`) | el pago retenido |
| **fila viva en una vertical donde el beneficiario tiene un ancla de grant** | **no existe** | `S13` a medias (`F-8dB3-004`) |
| **complemento vivo cuyo objetivo dejó de ser fila viva** | **no existe** | el huérfano que nadie re-evalúa (`F-8dB3-005`) |

Las cuatro se contestan con un `JOIN` sobre nuestra propia base y ninguna le pregunta nada al
proveedor. Lo anoto acá y no como hallazgo aparte porque **no es un defecto adicional**: es la forma
que tienen los dos que ya reporté.

---

## 5. Ataques que intenté y el diseño resistió

**1. Hacer que la primera comprobación marque el camino normal del cambio de plan.** Es el falso
positivo que la excepción vino a cerrar, y la excepción lo cierra bien: mientras la sucesora está en
`PENDING_AUTHORIZATION` con su ventana abierta, el cliente que está terminando su checkout no recibe
un incidente. **El problema es el otro sujeto, no éste** (`F-8dB3-002`): contra el falso positivo, la
excepción acierta.

**2. Dejar un addon huérfano en pleno upgrade y cancelarle el preapproval, que es irreversible.**
Recorrí los tres estados de la relación contra la condición de `B/16` §4.2 —sucesión en curso, sucesión
terminada, no hay sucesión— y **la lectura de dos columnas los cubre los tres**: con la sucesora viva
esperando autorizar no hay orfandad, y después del cierre la contesta `sucedida_por`. `S12`, `S13` y
`S16` sobre la predecesora no alcanzan a romperlo. **Lo que falla no es el predicado: es quién lo
vuelve a evaluar** (`F-8dB3-005`).

**3. Reactivar a la predecesora con el cobro reciclado, que era el crítico de mi vuelta anterior
(`F-8cB3-002`).** Cerrado en los tres lugares a la vez: la condición 3 de `B/05` §3 ahora enumera
*«las **seis** de `B/02` §2.2, `PENDING_AUTHORIZATION` **incluido**»*, la nota que eximía a la
sucesora pendiente se dio vuelta con sus tres razones refutadas una por una, y `S5`, `S7` y el efecto
de `MP1` llevan la condición escrita. **Tres escrituras y un guard (`G-R1-D`) para una regla: es el
arreglo mejor cerrado de la tanda.**

**4. Volver a entrar al pozo de `F-8cB3-001` por la puerta vieja** —la predecesora que muere antes de
que la sucesora autorice y deja `S17` sin sujeto—. No se puede: partir `S17` de `S18` lo cierra, y la
condición de `S18` es *«la predecesora ya no es fila viva»*, que las seis transiciones cumplen.
**Entré por otra puerta (`F-8dB3-002`), que es una fila nueva en el candado, no la vieja.**

**5. Encadenar sucesiones, o meter un complemento en el candado del §11.** Los dos siguen rechazados
por la base: el índice `B` sobre `(user_id, vertical)` y el `WHERE clase = principal` de los dos
índices (`B/02` §2.2). **Lo reintenté con `sucedida_por` puesto —la columna nueva— y no cambia nada:
ninguna de las dos claves la mira, y eso está declarado a propósito.**

**6. Concluir «no cobró» desde el endpoint de cobros, y listar la cartera desde el buscador del
proveedor.** Las dos trampas mejor documentadas del carril siguen cerradas en cuatro capítulos con la
misma regla y sin variantes (`B/09` §2.1 y §4, `B/02` §2.2, `B/03` §10.1, `B/05` §1.2). **Ninguno de
los siete commits abrió una puerta ahí.**

**7. Escribir una lápida sobre un preapproval vivo, o que la lápida compita por el candado.** El
orden —cancelar, verificar, después escribir— y la exclusión de `CANCELLED` de los estados vivos lo
siguen impidiendo (`B/21` §2.5, `B/02` §2.2). **Y todo lo que roza la población de producción lo
retiró `DEC-MIG-004`: no volví sobre eso por ningún ángulo, tampoco por el de la conciliación.**

**8. Que el grant emita en una vertical donde no ancló.** `permanent_grant_vertical` con
`UNIQUE(permanent_grant_id, vertical)` más *«el plan pertenece a esa vertical»* lo hace imposible de
escribir, y `12-contrato…` §2.3 —*«una fuente sin referencia resoluble no se puede expresar»*— cierra
la otra dirección. `B/16` §2.4 lo aplicó al addon a costo cero en la misma tanda: *«vale en la
vertical donde el grant **ANCLÓ**, no en todas»*. **Tres capítulos, la misma regla, y la base la hace
cumplir: es el arreglo del contrato que mejor se propagó.**

**9. Romper el piso del trinquete comparando la vertical equivocada.** *«Hay un piso por **ancla** y se
compara contra el plan de **su propia vertical**»* (`B/02` §2.4), con la razón escrita —*«uno solo
para N verticales compararía las claves de una contra lo que otorgaba el plan de otra»*—. **El cruce
que buscaba está nombrado y cerrado en la misma fila de la tabla.**

**10. Hacer que `sucedida_por` se borre o quede inconsistente con `sucede_a`.** *«no se borra
nunca»*, *«nunca las dos puestas en la misma fila»*, y `G-R1-C` vigila las dos mitades de la
escritura en direcciones opuestas (`B/02` §2.2, `B/20` §2). **El único agujero que encontré no es de
la columna sino de quién la escribe** (`F-8dB3-003`): la columna en sí está bien cerrada.

**11. Que el barrido gaste la cartera terminal entera con la salvedad del complemento.** El costo
está acotado por su propia condición de corte —*«deja de barrerse apenas la relectura confirma la
cancelación»*— y eso es correcto: **la cola es la de las que no confirmaron, no la cartera**. El
defecto de esa salvedad es de sujeto (`F-8dB3-006`), no de costo.
