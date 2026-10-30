# 02 · Núcleo — el método del modelo de datos y las reglas de las máquinas

Parte del núcleo de la spec consolidada (ver [02-nucleo.md](02-nucleo.md), que tiene el mapa). Trae
la mitad de núcleo del capítulo 02 del programa —el método que rige para las dos épicas, qué sale de
la base y qué del código, cómo nacen los valores y el registro de eventos— y la mitad de núcleo del
capítulo 03 —las siete reglas de lectura que valen para todas las máquinas de estado—. Los plazos
configurables (§1.5 de la fuente) viven en [02-nucleo.md](02-nucleo.md), con sus ítems `PLAZO:n`.
Las mitades de verticales y de billing de cada capítulo, y las tablas de transiciones, viven en los
catálogos ([04-catalogos.md](04-catalogos.md)) y en el archivo de cada pieza.

Este archivo no define ítems de inventario: es prosa del núcleo, con su `Origen:` por sección.

---

## 1. El modelo de datos: qué es esta mitad

Las entidades, sus relaciones y **las restricciones que hacen cumplir los invariantes**. No es un
DDL: no hay tipos ni índices acá, porque eso es decisión de implementación. Lo que sí hay es qué
guarda cada cosa, cómo se relaciona y **qué la base tiene que impedir por sí sola**. Los nombres de
estado salen del glosario ([02-nucleo-glosario.md](02-nucleo-glosario.md)) y las transiciones de las
máquinas (§2 de este archivo y [04-catalogos.md](04-catalogos.md)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:19, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:21, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:25

### 1.1 Qué sale de la base y qué no: el §9 no se puede cumplir tal como está escrito

El §9 del PDR es terminante: toda configuración relevante sale *«SI O SI DE DATABASE»*, y prohíbe
*«archivos TS»*, *«constantes duplicadas»* y *«listas hardcodeadas»*. Entre lo que enumera están
**verticales**, **entitlements** y **limits**.

Y no se puede, por una razón que no es de comodidad: **no hay forma de evaluar una capacidad sin
nombrarla**. Cualquier control de acceso pregunta por *una* capacidad concreta, y ese nombre es un
literal en el código. Lo mismo con las verticales: el §13 exige que las operaciones lleven contexto
de vertical suficiente para impedir autorización cruzada, y eso sólo es verificable si el conjunto de
verticales se conoce al compilar.

El propio §9 lo admite a medias en su última línea —*«Código solamente debe contener
comportamiento/algoritmos que no representen configuración comercial»*— pero la frase anterior es
absoluta y se va a leer como absoluta. **Un principio que se va a violar en silencio es peor que uno
acotado**, y el silencio es exactamente lo que el §9 dice querer evitar. (Cierra `C-ARCH-01` y
`S-ARCH-01`.)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:29, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:31, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:33, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:37, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:43

### 1.2 La separación: catálogo de claves y configuración comercial

Son dos cosas distintas y el §9 las trata como una:

| | **Catálogo de claves** | **Configuración comercial** |
|---|---|---|
| **qué es** | qué capacidades, qué límites y qué verticales **existen** | qué plan otorga qué clave, con qué valor, en qué vertical, a qué precio, con qué schedule |
| **dónde vive** | **en el código** | **en la base, sin excepción** |
| **por qué ahí** | el código tiene que poder nombrarlas, y el §13 exige verificarlas al compilar | es lo que cambia sin deploy, y es lo que el §9 viene a proteger |
| **quién lo cambia** | un desarrollador, en un release | un administrador, en cualquier momento |

**El catálogo no es una lista suelta: está verificado contra la base.** Un control automático falla
si una clave usada en código no existe en la base, **y también al revés** —si una clave de la base no
existe en el catálogo—. Las dos direcciones, porque cada una es un defecto distinto: la primera es un
permiso que nunca se puede otorgar, la segunda es configuración que nadie va a leer. **Desde la
revisión del owner (2026-09-28, N1) las dos direcciones siguen, y se reparten distinto**: la primera
la mira [G3](04-catalogos.md#guard-g3) contra el catálogo, en CI; la segunda es una **restricción de
la base** (§1.4), porque la base de producción se edita desde el panel y CI no la ve.

**Esto reescribe el invariante §64.15** ([INV:15](02-nucleo.md#inv-15)). El PDR dice *«Toda
configuración comercial viene de DB»*; la forma aplicable es **«toda configuración comercial viene de
la base; el catálogo de claves es código verificado contra la base»**. Es un apartamiento acotado y
declarado, no una excepción abierta: **lo único que vive en código es el conjunto de nombres. Ningún
valor, ningún precio, ninguna asignación.**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:48, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:52, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:59, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:68

### 1.3 Lo que queda del lado de la base, completo

Todo lo que el §9 enumera menos los tres nombres de arriba: planes, planes de trial, billing options,
precios, duración de trial, schedules de correo, qué entitlement da cada plan, qué límite, herencia,
ajustes de pausa, métodos de pago admitidos, políticas de promo, addons, y cualquier regla comercial
configurable. **Y los plazos que deciden cuándo pasa algo** (los diecinueve `PLAZO:n` de
[02-nucleo.md](02-nucleo.md); revisión del owner, 2026-09-28, C9).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:74, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:76

### 1.4 Los valores nacen una vez y después sólo los cambia el panel

(Revisión del owner, 2026-09-28, N1, `L1-e` y `L1-f`;
[DEC-ARCH-013](01-decisiones-vigentes.md#dec-arch-013).) **La configuración de planes vive 100 % en
la base.** El §1.2 ya lo decía; lo que faltaba era cómo llegan los valores y quién los cambia.

1. **No existe archivo de valores, ni como punto de partida del seed.** El archivo de configuración
   de planes de hoy (`packages/billing/src/config/`, 11 archivos y 3378 líneas medidas en hospeda2 el
   2026-09-28) **se borra entero**, con lo que lo lee sólo para eso; la lista está en `B/21` §4.
2. **El catálogo de producción nace el día del corte con una migración de datos única** (`L1-e`):
   corre una vez, **dentro de la migración estructural del paso 3 del corte, antes que la escritura
   `C` y la prueba del corte, que la leen, como la versión 1 de los plazos; el paso 3a sólo la
   verifica** (FASE 9 vuelta 3, owner 2026-09-30, lote C; 📌 de `DEC-ARCH-013`: la prueba del corte
   deriva su plan de trial, sus versiones y su fin del catálogo) (`16-fase-7…` §4.2, pasos del corte
   en [30-el-corte.md](30-el-corte.md)), y **nunca más es fuente de nada**. **Si falla a la mitad,
   falla la migración del paso 3 y el corte entra en la rama de aborto**, que restaura el backup del
   2b: no queda un catálogo a medias. Es historia y no configuración: el paso 6 del mismo corte la
   reemplaza con la foto de la base.
   **La migración lleva el catálogo como SQL generado por un script TypeScript**, que se commitea, y
   **un guard lo regenera y lo compara**, porque una migración estructural es SQL y no puede llamar
   código TypeScript. **La tabla de claves viaja igual: SQL generado por script desde el catálogo de
   claves del código, vigilado por el mismo control, que cubre las dos cargas y cuenta como guard**
   (es [G18](04-catalogos.md#guard-g18), el que llega con [V1](10-corte/V1.md#pieza-v1), antes que el
   catálogo; FASE 5, lote de la aplicación, owner 2026-09-30, E).
   **La prueba del corte no la escribe la migración: la escribe después la herramienta del corte de
   [V6](10-corte/V6.md#pieza-v6), que es del sistema nuevo; el script suelto del corte sigue sin
   importar código de ningún sistema** (FASE 5, lote de la aplicación, owner 2026-09-30, B), con la
   función de la aplicación y el seudónimo del correo, sólo para las cinco cuentas de la lista, y se
   verifica a mano. Se resigna que catálogo y pruebas sean una sola operación atómica: con cinco filas
   no importa (FASE 5, owner 2026-09-30, lote 2 D; simplificación del corte, S-12).
3. **Después, los valores sólo cambian por cinco acciones administrativas** (`L1-f`): **publicar una
   versión de plan ([ACC:18](02-nucleo.md#acc-18)), fijar el precio de un ciclo
   ([ACC:19](02-nucleo.md#acc-19)), publicar una versión de complemento
   ([ACC:20](02-nucleo.md#acc-20)), crear o cerrar un código promocional
   ([ACC:21](02-nucleo.md#acc-21)) y cambiar un plazo ([ACC:22](02-nucleo.md#acc-22))**. Sólo
   `SUPER_ADMIN`, auditadas y con una confirmación que dice qué cambia. Sin ellas nadie tenía el
   permiso de publicar una versión de plan, aunque `B/10` §3 dice que retirar es publicar una.
4. **Las claves siguen en el código, las de los entitlements y las de los límites; los valores viven
   en la base** (§1.2; revisión del owner, casos vecinos, 2026-09-29, caso 49, con el agregado del
   owner: *«los límites podrían ir por db»*, aclarado como que sus valores ya viven en la base y sus
   claves no): una clave sin código que la respete no hace nada aunque se cargue en el panel.

**Lo que antes miraba un guard de CI y ahora lo rechaza el panel o la base.** Un guard de CI lee el
repositorio, y el catálogo de producción ya no está ahí: un error de carga en el panel le podía
regalar una capacidad paga a toda la plataforma sin que ningún guard lo viera.

| lo que se rechaza | antes | ahora |
|---|---|---|
| una clave de la base que no está en el catálogo | [G3](04-catalogos.md#guard-g3), segunda dirección | **restricción de la base**: la tabla de claves la escribe la migración desde el catálogo, **como SQL generado por script y vigilado por el control que lo regenera y compara, el mismo del catálogo de producción (punto 2)** (FASE 5, lote de la aplicación, owner 2026-09-30, E), y toda asignación apunta a ella por FK |
| lo que las dos versiones no vendibles otorgan, las dos claves del piso, la capacidad de activación y la herencia de VIP (`V/02` §2.1) | `G-R3`, sus cuatro mitades | **validación de *«publicar una versión de plan»*** ([VAL:G-R3](04-catalogos.md#val-g-r3)), con el mismo nombre y cada mitad con su mensaje (`V/20` §2) |
| dos versiones vendibles y vigentes con el mismo `rank` en una vertical | restricción de la base (`V/10` §2) | **la misma restricción**, y el panel la chequea antes para dar el mensaje |
| un plan sin exactamente una versión vigente | regla escrita (`V/10` §2) | **restricción de la base** (a lo sumo una) y **validación del panel** (al menos una) |
| los días de prueba de una vertical que pasan de cero a más o al revés | regla escrita (`V/11` §8) | **validación de *«publicar una versión de plan»*** |
| una gracia que no es menor que el ciclo más corto que ofrece la versión | ninguno | **validación de *«publicar una versión de plan»* y de *«fijar el precio de un ciclo»*** |
| un plazo que contradice a otro | `G-R5-B` | **validación de *«cambiar un plazo»*** ([VAL:G-R5-B](04-catalogos.md#val-g-r5-b); la lista de lo que se rechaza está en [02-nucleo.md](02-nucleo.md), §4) |

**Las mismas validaciones corren en el paso 3a del corte sobre la base de producción**, después de la
migración única del catálogo (que desde el lote C corre dentro de la migración estructural del paso 3:
FASE 9 vuelta 3, owner 2026-09-30), y si no dan, el corte no sigue (`16-fase-7…` §4.2).

**Los datos de planes que usan desarrollo y las pruebas son datos de demostración, fuera del
dual-write del seed** (revisión del owner, casos vecinos, 2026-09-29, caso 42): no representan ningún
entorno vivo. **Y el seed de demostración no carga catálogo en una base que ya tiene uno** (FASE 9
vuelta 3, owner 2026-09-30, lote AL): hasta el paso 6, la migración estructural del paso 3 carga el de
producción en toda base que aplique las migraciones —producción, `staging`, desarrollo y CI—
(`16-fase-7…` §4.2), y el seed deja el que encuentra. **Y para que eso sea cierto en desarrollo y en
CI, las bases de desarrollo, las de los tests de integración y la del e2e nocturno pasan a armarse con
`db:migrate`**, como ya hace la del e2e de cada PR: hoy se arman con `push`, que no corre migraciones,
y las filas de referencia que carga la migración no les llegaban. Una sola fuente para esas filas
(FASE 5, owner 2026-09-30, lote 2 C). **Sale de `scripts/check-seed-dual-write.sh` la rama que vigila
el archivo de configuración de planes, y de la regla de dual-write del `CLAUDE.md` raíz la mención a
los planes, límites y entitlements de billing**, en el mismo cambio que borra el archivo (`B/21` §4),
que es cuando esa rama se queda sin sujeto.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:82, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:84, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:87, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:90, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:105, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:112, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:117, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:122, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:126, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:136, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:141

### 1.5 El registro

| entidad | qué guarda | restricciones |
|---|---|---|
| **`domain_event`** | qué pasó, sobre qué entidad, quién lo causó, cuándo, **qué campos cambiaron** —no una copia del contenido; **de los campos de contenido de una ficha, sólo el nombre**— (auditoría §1.2, en [02-nucleo-auditoria.md](02-nucleo-auditoria.md); owner 2026-09-25, FASE 9 completa, decisión 8e) | append-only, **y sin `deleted_at`** (FASE 5, owner 2026-09-30, lote 4 E). **La crea [U2](10-corte/U2.md#pieza-u2)** (corte del MVP, owner 2026-10-02, BW) |
| **`outbox`** | destinatario, plantilla, estado (`pending`, `processing`, `sent`, `failed`, `retry`), id del proveedor, intentos (§44). **Lo construye [U2](10-corte/U2.md#pieza-u2), que absorbe la bitácora de correos renombrada desde `billing_notification_log`** (outbox §1.4, en [02-nucleo-outbox.md](02-nucleo-outbox.md); FASE 5, owner 2026-09-30, lotes 1 B y 2 A) | |

**`domain_event` guarda referencias y deltas, no copias del contenido**, y ésa es una decisión de
modelo con consecuencia directa en la retención: se explica en `V/02` §4, la retención.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:259, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:263, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:264, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:266

### 1.5.1 La retención de billing: qué se borra, qué se anonimiza, qué se conserva

Es la mitad de billing de la retención (`B/02` §4, que **cierra `M-DATA-01`**); la de verticales es
`V/02` §4.

| | qué | por qué |
|---|---|---|
| **Se conserva íntegro, siempre** | pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son obligación legal y contable |
| **Se borra a los 180 días** | las entregas guardadas de los dos canales, `provider_notification` (`B/02` §2.7; mediciones del 2026-09-29, lote L-B) | son un registro técnico para una revisión, sin valor contable; el plazo es técnico y no configurable (mediciones del 2026-09-29, M-2; por eso no está en la lista cerrada de plazos de [02-nucleo.md](02-nucleo.md) §4, punto (b)) |

**La primera fila habla del modelo nuevo** (la segunda entró con las mediciones del 2026-09-29,
M-2) —`payment`, `manual_payment`, `refund`, `provider_link` (`B/02` §2.3)—, **no de las tablas del
sistema viejo** (`billing_payments` y las demás). Del sistema viejo **no se conserva nada**, ni sus
tablas ni las columnas que las copian: el owner lo decidió el 2026-09-25 (FASE 9 completa, `2a`;
`B/21` §4) —*«recién arrancamos; a los clientes que hay los contactamos en persona, de a uno, y se
vuelven a suscribir»*—. Se aclara porque la fila se podía leer como una obligación sobre
`billing_payments`.

**Los comprobantes se conservan con el nombre y el correo de quien pagó**, copiados al emitirse
(`B/02` §2.3): la baja de una cuenta, que seudonimiza la fila de `user`, no los alcanza. Son los
datos de facturación que la baja conserva (revisión del owner, casos vecinos, 2026-09-29, casos J-C
y K-A).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1260, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1262, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1266, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1267, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1269, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1276

### 1.6 Lo que esta mitad NO cierra

- **Los tipos, los índices y el plan de migración** son de FASE 4 y FASE 7 (hoy: de cada pieza, en su
  sección «Modelo de datos y migraciones», y del corte, [30-el-corte.md](30-el-corte.md)).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:272, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/02-modelo-de-datos.md:274

---

## 2. Las máquinas de estado: cómo se leen

Las máquinas mismas viven en la épica de verticales (Trial, Publicación, Postulación de Partner) o en
la de billing (Suscripción, Grace, Pausa, Pago, Pago manual, Addon, **Reembolso**, la regla de
no-retroceso); sus transiciones son ítems `TRANS:` de [04-catalogos.md](04-catalogos.md).

El §63 pide ocho explícitamente: Trial, Subscription, Payment, Manual Payment, Addon, Publication,
Grace y Pause, *«aunque finalmente no utilicemos librería de state machines»*. Acá son **diez**: la
postulación de Partner (§11) se agregó al escribir el capítulo 18 (épica de verticales), con su razón
escrita, **y el reembolso —`REQUESTED → CONFIRMED → EXECUTED | FAILED`— en la FASE 9 completa** (owner
2026-09-25, decisión 5a; los estados, glosario §2.2).

Los nombres salen del glosario y **no se redefinen acá**. Lo que agregan las máquinas son las
**transiciones**: qué evento mueve de dónde a dónde, bajo qué condición, y con qué efecto.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:17, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:19, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:25

### 2.1 Las siete reglas de lectura

Siete reglas que valen para todas. Son la diferencia entre una máquina de estados y una convención.
(Cierra `M-SUB-01` y `M-CONC-02`.)

1. **La tabla de transiciones es exhaustiva.** Lo que no está, no pasa. Un intento de transición que
   la tabla no declara **no se ejecuta**: se registra como evento de dominio y, si tocaba plata o
   estado, **abre una marca `requiere_conciliación` con motivo `TRANSICIÓN_NO_DECLARADA`** (`B/02`
   §2.5; los motivos son ítems `MOT:n` de [04-catalogos.md](04-catalogos.md)) y emite el §22.1.
   **La marca no es un estado, y tampoco un booleano**: es una fila con motivo y reloj, y el predicado
   *«tiene una marca abierta»* está definido en el glosario §2.5. Nombrar el motivo es obligatorio
   —[G-R1-F](04-catalogos.md#guard-g-r1-f)—, porque sobre esa misma casilla el corpus escribe
   **veinticuatro** cosas distintas (`B/02` §2.5; FASE 8 completa: `F-8CB1-013`, `F-8CB3-009`,
   `F-8CB3-003`, [DEC-SUB-020](01-decisiones-vigentes.md#dec-sub-020), y la pendiente 6, owner
   2026-09-25; el 21 y el 22, FASE 9 completa; el 23 y el 24, FASE 9 vuelta 2, `R4` y `R20`) y
   **nueve** de ellas significan *«hay plata del cliente que devolver»*. Que no sea un estado es la
   otra diferencia que la hace correcta: la fila conserva el estado que tenía, así que quien resuelve
   el caso no tiene que adivinar a dónde volver, y escribirla no es en sí misma una decisión
   destructiva automática, que es lo que el §22.1 prohíbe.
2. **El estado vive en una columna con dominio restringido** —el §63 pide máquinas explícitas; una
   columna que acepta cualquier cadena no tiene máquina, tiene una costumbre, y el modelo de datos de
   cada épica fija la restricción— **y el estado inicial de una máquina cuya fila nace en su primera
   transición vive afuera de la columna.** Que viva afuera no lo vuelve la ausencia de un estado:
   **es un estado porque tiene reglas declaradas y una salida declarada, no porque tenga fila.** Es lo
   que la máquina de suscripción ya hace con su renglón `(sin fila)`, y lo que la de trial hace con
   `PRE_TRIAL`. **Y la máquina cuya fila nace ya en su estado inicial —la de publicación, cuya ficha
   nace en `DRAFT` al crearla— tampoco tiene fila de nacimiento**: crear la fila no es una transición
   sino el hecho 1 de la inactividad (glosario §1.2), y la regla 1 no la alcanza (FASE 9 completa,
   `B-9`).
3. **Una transición es atómica junto con sus efectos locales.** Los efectos remotos —el proveedor, el
   correo— nunca están dentro de esa transacción: el §43 lo ordena para el correo (*«Si falla mail:
   acción de dominio permanece»*) y el capítulo 05 de la épica de billing lo desarrolla para el
   proveedor.
4. **Toda transición deja un evento de dominio** (§49), con quién la causó y qué la disparó.
5. **Ninguna máquina consulta el estado del proveedor para decidir.** Consulta el suyo. Lo que el
   proveedor dice entra siempre por §10, la regla de no-retroceso. **Salvo una condición que depende
   del estado del proveedor**: la de un job que actúa por nuestro reloj
   ([S3](04-catalogos.md#trans-b-s3), [S6](04-catalogos.md#trans-b-s6),
   [A3](04-catalogos.md#trans-b-a3)) y la de un acto del cliente que no puede declararse sobre un
   preapproval que no cobra ([S1](04-catalogos.md#trans-b-s1), sobre su predecesora **y sobre la
   `CHARGE_DECLINED` de ese `user + vertical`, cuyo preapproval relee hasta verlo `cancelled`**
   —`B/03` §3.2, FASE 9 vuelta 1, `F-8V1B1-003`—). Ésas **le preguntan antes**, releyendo por id, y la
   relectura es parte de la condición (FASE 9 vuelta 1, `F-8V1D1-003`)
   ([INV:D17](02-nucleo.md#inv-d17), pedido del owner del 2026-09-24; FASE 8 completa, `F-8CD1-005`).
6. **Grace y Pause no son máquinas independientes**, y el §63 las nombra igual. Son sub-estados de
   Suscripción **con reloj propio y datos propios**, y se modelan aparte por eso: un estado sin reloj
   no puede vencer solo, y los dos vencen.
7. **Dos filas que comparten `(desde, evento)` tienen guardas disjuntas.** La regla 1 dice qué pasa
   con lo que **falta** en una tabla; ésta, con lo que **sobra**: dos filas que aplican a la vez sobre
   el mismo par dejan el desenlace en manos del **orden en que una implementación recorra la tabla**,
   que es exactamente la diferencia entre una máquina de estados y una convención. **No se dirime por
   precedencia**, porque una precedencia es una cosa más que hay que acordarse de leer: se exige que
   **las condiciones no se puedan satisfacer las dos a la vez**, y una tabla que no lo cumpla es un
   defecto de la tabla.

   **Qué pasa si igual se solapan**: el intento **cae en la regla 1** —no se ejecuta, se registra como
   evento de dominio y, si tocaba plata o estado, pone la marca—. Elegir una de las dos sería convertir
   un defecto de diseño en un comportamiento, y convertirlo **en silencio**.

   **Es una propiedad del texto, no de una ejecución, así que la vigila un guard**:
   [G-R4](04-catalogos.md#guard-g-r4), sobre las tablas de transiciones de las **diez** máquinas, en
   las dos épicas. Los pares con dos filas y dos destinos distintos que el diseño declara son
   **cuatro** (revisión del owner, 2026-09-28, C8: sale `S10`/`S25`; C10: entra `PB11`/`PB13`), en tres
   tablas:

   | par | las dos filas | qué las separa |
   |---|---|---|
   | `(PRE_TRIAL, evento de activación de la vertical)` | [T1](04-catalogos.md#trans-v-t1) / [T6](04-catalogos.md#trans-v-t6) (`V/03` §2) | el booleano `cubierto`: una exige que **no** haya fuente viva de clase `TÍTULO` y la otra que **sí** |
   | `(GRACE_PERIOD, entra el pago)` | [S5](04-catalogos.md#trans-b-s5) / [S19](04-catalogos.md#trans-b-s19) (`B/03` §3.2) | si la fila **es la predecesora de una sucesión en curso**: `S5` exige que no, `S19` que sí |
   | `(SUSPENDED, entra el pago)` | [S7](04-catalogos.md#trans-b-s7) / `S19` | el mismo booleano |
   | `(MODERATED, un admin levanta la baja)` | [PB11](04-catalogos.md#trans-v-pb11) / [PB13](04-catalogos.md#trans-v-pb13) (`V/03` §9) | **el estado de origen que guardó el evento de [PB10](04-catalogos.md#trans-v-pb10)**: `PB11` exige que la ficha viniera de `DRAFT` y `PB13` que viniera de `PUBLISHED` o `UNPUBLISHED_BY_BILLING` (un `ARCHIVED` cuenta por el origen de su archivado). Un valor, no un booleano, pero sus dos lados no se solapan (revisión del owner, 2026-09-28, C10, `L2-i`) |

   **Los cuatro son disjuntos por construcción y no por acuerdo**, que es la única forma en que la
   regla se cumple sin una precedencia: difieren en el valor de **un booleano** (el cuarto, en el de
   un estado de origen guardado), no en una combinación que alguien tenga que evaluar en orden. **Que
   sean cuatro no es una afirmación de este texto: es lo que `G-R4` cuenta en cada PR**, y por eso la
   regla no depende de que alguien vuelva a recorrer las diez tablas a mano.

   **Compartir el `desde` no es compartir el par, y hay nueve casos vivos que lo piden dicho**
   (numerados del segundo al décimo: el primero, el de `T7`, salió con la revisión del owner,
   2026-09-28, N7, y los demás conservan su ordinal). En ninguno hay guardas que dirimir, porque cada
   par tiene **una sola** fila:

   - **[S18](04-catalogos.md#trans-b-s18)** (`B/03` §3.2) sale desde la FASE 9-bis-3 también de
     `PENDING_AUTHORIZATION`, que comparte `desde` con [S2](04-catalogos.md#trans-b-s2) y con `S3`: su
     evento es **que la predecesora dejó de ser fila viva sin [S17](04-catalogos.md#trans-b-s17)**, y
     ninguna otra fila lo declara, así que sus dos pares tienen una sola fila cada uno.
   - **[A5](04-catalogos.md#trans-b-a5)** (`B/03` §8) sale desde la misma pasada también de
     `PENDING_AUTHORIZATION`, que en la máquina de addon comparte `desde` con
     [A2](04-catalogos.md#trans-b-a2) y con `A3`: sus eventos son **los tres** que declara desde
     [DEC-ADDON-003](01-decisiones-vigentes.md#dec-addon-003) —darse de baja, **quedar huérfano** y
     **que se revoque el grant del que cuelga el ancla que era su título**—, y ninguna otra fila de esa
     tabla declara ninguno de los tres, así que **cada uno de sus pares tiene una sola fila**. **Que el
     tercero y el segundo se cumplan a la vez —lo que pasa al revocar, en el scope
     `VERTICAL_SUBSCRIPTION`— no es lo que esta regla prohíbe**: son dos eventos de la misma fila y con
     el mismo destino, no dos filas sobre un par.
   - **[PB7](04-catalogos.md#trans-v-pb7) y [PB8](04-catalogos.md#trans-v-pb8)** (`V/03` §9) salen las
     dos de `ARCHIVED`, que desde la FASE 9-bis-3 dejó de ser un estado sin salida: los eventos de
     `PB7` son **dos** desde [DEC-DATA-003](01-decisiones-vigentes.md#dec-data-003) —**el cambio de
     `cubierto`** y **que el cupo vuelva a alcanzar sin que `cubierto` cambie**— y el de `PB8` es **el
     acto del dueño de reactivarla**; **y desde la FASE 8 completa sale de ahí también
     [PB9](04-catalogos.md#trans-v-pb9)**, el hard delete, cuyo evento es **el día 180 de
     inactividad** —el [PLAZO:2](02-nucleo.md#plazo-2), con ese valor al inicio— (`F-8CA2-008`, owner
     2026-09-25): los **cuatro** son distintos entre sí y de todo lo demás, así que cada uno de esos
     cuatro pares tiene una sola fila. **Las dos ramas de `PB7` tampoco compiten entre ellas**: son
     dos eventos de la misma fila con el mismo destino, igual que las dos de
     [PB2](04-catalogos.md#trans-v-pb2) y las dos de [PB3](04-catalogos.md#trans-v-pb3).
   - **[S20](04-catalogos.md#trans-b-s20) y [S21](04-catalogos.md#trans-b-s21)** (`B/03` §3.2) salen
     las dos de *«toda fila viva de complemento»*, que es el mismo `desde` escrito con las mismas
     palabras: sus eventos son **otorgar o anclar un grant** y **que su instancia llegue a
     `CANCELLED`**, distintos entre sí y de todo lo demás, y además **no se pueden satisfacer a la
     vez** —`S20` declara que la instancia **no** cambia de estado—, así que cada uno de esos dos pares
     tiene una sola fila.
   - **Los casos sexto, séptimo y octavo son las tres filas de la baja que la FASE 9-bis-4 agregó**
     (`B/03` §3.2): [S22](04-catalogos.md#trans-b-s22) sale de `PAUSED`, que comparte `desde` con
     [S10](04-catalogos.md#trans-b-s10) y con [S13](04-catalogos.md#trans-b-s13);
     [S23](04-catalogos.md#trans-b-s23) sale de `SUSPENDED`, que lo comparte con `S7`, con `S19` y con
     `S13`; y [S24](04-catalogos.md#trans-b-s24) sale de `GRACE_PERIOD`
     ([DEC-SUB-014](01-decisiones-vigentes.md#dec-sub-014)), que lo comparte con `S5`, con `S6`, con
     `S19` y con `S13`. **Su evento es el de la baja** —*«pide la baja»*, el mismo de
     [S11](04-catalogos.md#trans-b-s11)—, que ninguna de esas filas declara: el de `S10` es *«llega el
     fin, o la persona vuelve antes»*, el de `S5`, `S7` y `S19` es *«entra el pago»*, el de `S6` es
     *«se agota el reloj»* —o, desde [DEC-MP-008](01-decisiones-vigentes.md#dec-mp-008), *«se lee
     `paused` en el proveedor sin haberlo pedido»*, que tampoco es una baja— y el de `S13` es el
     otorgamiento de un grant. **Y el octavo es el que más cerca estuvo de agregar una entrada a la
     tabla de arriba**: `GRACE_PERIOD` ya figura ahí, con el par `(GRACE_PERIOD, entra el pago)`, pero
     el par de `S24` es **otro**, porque su evento es otro, y un `desde` que ya aparece en la tabla no
     arrastra a las filas nuevas que salen de él.
   - **El noveno son `PB10`, `PB11` y [PB12](04-catalogos.md#trans-v-pb12)** (`V/03` §9): `PB10` —un
     admin modera la ficha— y `PB12` —el dueño la borra— salen de `DRAFT`, `PUBLISHED`,
     `UNPUBLISHED_BY_BILLING` y `ARCHIVED`, que comparten `desde` con casi toda esa tabla, pero sus
     eventos no los declara ninguna otra fila. **`PB11` no es la única que sale de `MODERATED`**
     (revisión del owner, 2026-09-28, C10): la acompaña `PB13` en el mismo par, que es el cuarto de la
     tabla de arriba, y `PB12` con otro evento. Así que cada uno de los pares de `PB10` y `PB12` tiene
     una sola fila.
   - **El décimo es [T8](04-catalogos.md#trans-v-t8)** (`V/03` §2): sale de `PRE_TRIAL`, que comparte
     `desde` con `T1` y `T6`, pero su evento —*«aparece un título que convierte»*— no lo declara
     ninguna otra fila de ese `desde`; [T2](04-catalogos.md#trans-v-t2) declara el mismo evento, pero
     desde `TRIAL_ACTIVE`, que es otro par (owner 2026-09-25; FASE 9 completa, decisión 6c).

   Lo que este guard cuenta son **pares**, no estados de origen.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:30, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:35, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:49, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:58, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:62, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:63, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:67, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:72, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:75, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:83, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:87, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:91, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:99, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:109, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:117, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:125, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:135, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:140, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:153, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:159

### 2.2 Lo que esta mitad NO cierra

- **Las restricciones de base** que hacen cumplir estas máquinas son del modelo de datos de cada
  épica (en la spec consolidada, la sección «Modelo de datos y migraciones» de cada pieza).
- **Qué correo sale en cada transición** es del outbox ([02-nucleo-outbox.md](02-nucleo-outbox.md),
  el catálogo de correos).
- **Los relojes**, como jobs concretos con su horario y su idempotencia, son de cada subdominio (la
  sección «Cron y outbox» de cada pieza).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:172, .specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:174
