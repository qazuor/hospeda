---
title: FASE 9-bis-4 — Rastro por aparición de la familia de la sucesión
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 9-bis-4
---

# Rastro por aparición · `3310c9376` · `70d83299d` · `f21d5d828`

Cumple la parte 2 de `DEC-METH-011`: **por cada aparición que NO se corrigió y que vive en un
párrafo que ninguno de los tres commits tocó**, van el archivo, las líneas, el §, la cita y **por
qué sigue siendo correcta**. No hay agregados: cada línea de abajo se puede tomar sola y mostrarse
falsa.

## Los commits

| sha | qué cierra |
|---|---|
| `3310c9376` | `F-8eB3-003` — `requiere_conciliación` deja de ser un booleano: la marca gana **motivo**, **reloj** y **referencia al pago**, y pasa a ser una fila (`reconciliation_mark`) |
| `70d83299d` | `F-8eB2-001` / `F-8eB3-001` / `F-8eB1-003` —un solo defecto— implementando `DEC-GRANT-007`: la cortesía **no se re-apunta**, se **difiere** con su saldo de días y `S9` la **re-emite** cuando la sucesora autoriza |
| `f21d5d828` | la premisa que el segundo volvió inconsistente: la prosa de `B/03` §3.2 enumeraba **tres** caminos por los que la predecesora se muere sola y `B/14` ya decía **cinco** |

## 1. Qué se arregló, en una frase cada uno

**`F-8eB3-003`.** `requiere_conciliación` estaba declarado *«(booleano)»* (`B/02` §2.2) y
*«una marca booleana sobre la fila»* (`B/03` §3.1), y **`S18` le escribía un MOTIVO** —*«reembolso
por confirmar»*— del que se apoyan las **tres** ramas de `B/12` §5.3 que mueven dinero. Un booleano
no lo transporta: al humano le llegaba una fila `CANCELLED` marcada, indistinguible de las demás,
sin nada que dijera que hay plata del cliente en nuestra cuenta.

**Contado sobre el texto antes de elegir la forma**: el corpus escribe **once** marcas distintas
sobre la misma casilla —`S14` es el ACTO y cubre siete de ellas; las otras las abren `S18` y las
comprobaciones de cero llamadas— y **tres** significan *«hay plata que devolver»*. Con
`DEC-GRANT-007` encima pasaron a **trece** y **cuatro**.

| pieza | dónde |
|---|---|
| `reconciliation_mark` con `motivo`, `puesta_en`, `levantada_en`, quién la levantó y **el pago** | `B/02` §2.2 |
| el catálogo cerrado de motivos, con la columna *«¿hay plata que devolver?»* | `B/02` §2.5 |
| **`requiere_conciliación` pasa a ser un PREDICADO**, no una columna | `B/02` §2.2, `NUCLEO/01` §2.5 |
| **«marca abierta»** definido, con su inventario de nueve consumidores | `NUCLEO/01` §2.5 |
| **`S15` levanta UNA marca, no la fila** | `B/03` §3.2 |
| el listado accionable muestra motivo, antigüedad y pago, y ordena las de dinero adelante | `B/19` §4 |
| `G-R1-F`: los guards de `R1` pasan de cinco a **seis** | `B/20` §2 |

**La forma no se inventó: el precedente es del owner y está una tabla más arriba.**
`DEC-GRANT-004` implicación 1 dice *«el estado «pausada» de nuestra base **necesita un motivo, no
sólo un booleano**»*, porque en el proveedor una cortesía se ve idéntica a una pausa.
`subscription_pause` lleva su `motivo` por esa razón exacta. La marca tiene la misma forma y le
faltaba la misma columna.

**`F-8eB2-001` / `F-8eB3-001` / `F-8eB1-003`.** `S18` re-apuntaba la cortesía a la sucesora y
`B/02` §2.6 y `B/14` §4.4 exigían además que la sucesora *«quedara pausada con motivo `COURTESY`»*.
Los dos desenlaces le cobran: el `hacia` de `S18` es *«el mismo estado»* y la única fila que
aterriza en `PAUSED · COURTESY` es `S9`, cuyo `desde` es `ACTIVE`. `DEC-GRANT-007` lo resuelve
difiriendo:

| orden | qué pasa | ¿ejecutable? |
|---|---|---|
| re-apuntar y pausar en el cierre ❌ | pide una transición que la tabla no declara; la regla 1 manda el camino normal a la marca | no |
| re-apuntar y **no** pausar ❌ | la sucesora autoriza y cobra con *«una fila de base que no hace nada»* encima | sí, y le cobra |
| **diferir el saldo y re-emitir al autorizar** ✅ | `S18` escribe `saldo_días`; `S9` corre **tal como está**, sobre una fila `ACTIVE` que el proveedor sí deja pausar | sí |

## 2. Cómo se tocan los dos

Van en commits separados y son el mismo mecanismo visto dos veces:

- El riesgo que `DEC-GRANT-007` acepta —*«entre que la sucesora autoriza y la cortesía se re-emite,
  el proveedor puede cobrar»*— **se devuelve por `DEC-RF-002`**, o sea **por la marca**. Sin el
  motivo del primer arreglo, ese cobro llegaba al listado como una fila más y el riesgo aceptado
  se volvía un riesgo invisible.
- Y al revés: el detector de la re-emisión que no corre —la **sexta** comprobación de cero
  llamadas— **pone la marca**, así que necesita un motivo propio (`CORTESÍA_SIN_RE_EMITIR`) que sólo
  existe porque el catálogo del primero existe.
- El punto donde se cruzan tiene nombre: **una sucesora que autoriza, cobra, y cuya cortesía
  diferida nadie re-emitió**. Con las dos mitades puestas la persona ve *«hay plata que devolver»*
  y *«hay una cortesía sin re-emitir»* como **dos marcas abiertas** sobre la misma fila, y las
  levanta de a una. Con cualquiera de las dos faltando, ese camino termina en el desenlace que
  `B/14` §4.4 describía entero: *«el cliente se entera cuando le cobran»*.

## 3. Qué se grepeó

**Términos NUEVOS** (los que los arreglos definen): `reconciliation_mark` · *«marca abierta»* ·
el `motivo` de la marca y sus **trece** valores · `puesta_en` / `levantada_en` ·
*«hay plata del cliente que devolver»* · `courtesy_grant.saldo_días` · *«cortesía diferida»* ·
*«el segundo disparador de `S9`»* · `G-R1-F`.

**Términos VIEJOS que se retiran**, grepeados aparte porque el consumidor no actualizado no aparece
buscando el nuevo: *«`requiere_conciliación` (booleano)»* · *«una marca booleana sobre la fila»* ·
*«se pone la marca»* leído como **una sola casilla** · *«con la marca puesta»* · *«se levanta la
marca»* leído como **la fila** · *«la cortesía vigente se re-apunta a la sucesora»* · *«la sucesora
queda pausada con motivo `COURTESY`»* · *«`S18` … cuatro escrituras … tres entidades»* ·
*«efecto 4»* / *«cuarto efecto»* · *«las ramas 1 y 5»* / *«las cinco ramas»* · *«cinco
comprobaciones»* / *«cuatro comprobaciones»* · *«los cinco de `R1`»* · *«`S18` siempre corre sobre
una sucesora ya `ACTIVE`»* · *«no hay caso en que haya que pausar un preapproval que todavía no
autorizó»* · *«se murió sola por `S12`, por `S16` o por el espejo»*.

**Una clase excluida a propósito, y va nombrada**: *«booleano»* aplicado a un **entitlement**
(`NUCLEO/01` §1.6, `V/15` §5.2, `V/18` §1.2, `V/spec` §3.11, `DEC-ENT-001`) y a `cubierto`
(`NUCLEO/03` §1 regla 7, `V/03`) es **otro término con otro sujeto** — la forma de una capacidad,
no la forma de la marca. Entra al grep del término viejo y **no es una aparición de él**; las filas
de abajo lo dicen una por una.

**Alcance**: los **51 archivos** del corpus —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato, el corte, la partición, el decision log y los
documentos de medición—, con y sin backticks, **incluidos los 15 archivos que los commits tocan**.
La lista se construyó con `fd -e md` sobre los tres directorios, quitando los informes de fase
(`14-…` a `21-…` del `HOS-1352`) y el PDR.

**Medido sobre el árbol en `f21d5d828`**: **360** párrafos con al menos una aparición; **92** los
tocó alguno de los tres commits; **268** no, y son los que van abajo, uno por uno. La partición se
calculó proyectando las líneas `+` de `git diff --unified=0` de los tres commits sobre los bloques
separados por línea en blanco —la unidad que `DEC-METH-010` obligación 1 fija es el **párrafo**—,
no a ojo.

## 4. Las 268 apariciones no corregidas, una por una

### `01-decision-log.md` (27)

**El log no se edita** (regla dura de la fase), así que estas 27 van con su razón y ninguna con un
cambio. Ninguna se volvió falsa: las decisiones describen **qué se decidió**, y estos commits
implementan dos de ellas —`DEC-RF-002` y `DEC-GRANT-007`— sin cambiar ninguna.

- **L395-427 · `DEC-MIG-001`** — las cinco relaciones vivas, *«dos cortesías»* → sigue correcta: es
  el corte, y una cortesía de la cartera vieja no pasa por `S18`; nace como `permanent_grant`.
- **L549-575 · `DEC-ENT-001`** — *«entitlements booleanos … y medidos»* → sigue correcta: el
  booleano de acá es la **forma de una capacidad**, no la de la marca. Es la clase excluida del §3.
- **L810-838 · `DEC-GRANT-001`** — *«se corta el cobro en el acto y no se devuelve lo pagado»* →
  sigue correcta, **y es la que separa el grant de la cortesía**: el grant no devuelve y la
  cortesía diferida no devuelve nada tampoco — conserva días, que no es plata.
- **L840 · `DEC-GRANT-002`, título** → sigue correcta: quién firma no cambia.
- **L842-865 · `DEC-GRANT-002`, cuerpo** — *«la cortesía temporal también es exclusiva de
  `SUPER_ADMIN`»* → **sigue correcta y el arreglo la respeta al pie**: la re-emisión de `S9`
  **no es una concesión nueva**, es la misma fila con la firma original (`B/03` §3.2).
- **L1295-1348 · `DEC-MP-002`** — el aumento y la pausa → sigue correcta: habla de la fecha
  efectiva de un aumento, no del cierre de una sucesión.
- **L1470-1524 · `DEC-MAIL-001`** — los correos del proveedor se anticipan → sigue correcta, y su
  pendiente (*«si el proveedor manda correo al pausar»*) **no se agrava**: el arreglo pausa una vez
  y no dos.
- **L1661 · `DEC-GRANT-003`, título** → sigue correcta: la cortesía se sigue implementando pausando.
- **L1663-1725 · `DEC-GRANT-003`, cuerpo** — `PC-2`, `EX-35`, `EX-34`, `PS-2`, `PS-5`, `EX-11` →
  **sigue entera, y `DEC-GRANT-007` lo dice**: lo que cambia es **cuándo** se pausa, no con qué.
- **L1727 · `DEC-GRANT-004`, título** → sigue correcta.
- **L1729-1774 · `DEC-GRANT-004`, cuerpo** — *«el estado «pausada» necesita un motivo, no sólo un
  booleano»* → **sigue correcta y es el PRECEDENTE del primer arreglo**, citada textualmente en
  `B/02` §2.5. Y su caso (1) —*«en cortesía, pide pausar → pierde la cortesía»*— es lo que `S22`
  ejecuta y lo que explica por qué `S22` **no** difiere.
- **L1942-2007 · `DEC-ARCH-004`** — el billing de nuestro lado → sigue correcta: no nombra ni la
  marca ni el cierre; entró al grep por *«cortesía»* en su inventario de dominio.
- **L2082-2135 · `DEC-ARCH-006`** — el contrato entre las dos épicas → sigue correcta: la marca y
  la cortesía diferida son **internas a billing** y no cruzan la frontera.
- **L2410-2437 · `DEC-CONC-003`** — *«alternativas: (1) **marca booleana** sobre la fila … (2)
  dejarlo como estado»*, decisión **(1)** → **sigue correcta, y ésta es la que hay que leer con
  cuidado**. Lo que la decisión eligió es *«marca, NO estado»*: su razón entera —*«escribir
  `RECONCILIATION_REQUIRED` en la columna de estado borra el estado real»*, *«`S15` tendría que
  adivinar a dónde volver»*, *«la fila **ocupa** el candado»*— **no se apoya en que sea un
  booleano**, y las tres siguen cumpliéndose palabra por palabra. El adjetivo describía la
  alternativa, no el invariante; dar motivo y reloj a la marca **no la convierte en un estado** y
  es lo que la decisión ya necesitaba para que `S18` pudiera escribir *«con motivo»*.
- **L2475-2524 · `DEC-MIG-003`** — las ocho filas se cancelan, las dos cortesías se escriben como
  `permanent_grant` → sigue correcta: nacen sin sucesión y sin marca.
- **L2567-2603 · `DEC-METH-007`** — el gate de FASE 5 → sigue correcta: es método. Entró al grep
  por *«las cinco del PDR»*, que es otro conteo.
- **L2780-2814 · `DEC-RF-002`** — *«al cerrar la sucesión el sistema **pone la marca** y el caso
  entra al canal de conciliación»* → **sigue correcta, y el primer arreglo es lo que la vuelve
  ejecutable**. Su *«alcance: la primera de las **cuatro** ramas»* es un conteo de su fecha, ya
  superado por la sexta rama de la familia de la baja; **el log no se edita** y la decisión no
  afirma que las ramas sean cuatro para siempre — enumera cuál es la suya.
- **L2818 · `DEC-GRANT-006`, título** → sigue correcta.
- **L2820-2863 · `DEC-GRANT-006`, cuerpo** — *«`courtesy_grant.scope` se retira … la cortesía
  transporta la versión anclada de la suscripción que pausa»* → **sigue correcta y es la premisa
  que el arreglo usa**: sin `scope`, `subscription_id` es la única referencia, y por eso **no se
  anula**: el saldo va en una columna aparte.
- **L2975-2996 · `DEC-TRIAL-009`** — revocar un grant no devuelve el trial → sigue correcta: otro
  instrumento, otro sujeto.
- **L3003-3014 · `DEC-TRIAL-009`, cola** — *«el trial se gastó recibiendo algo mejor»* → ídem.
- **L3083-3132 · `DEC-ADDON-003`** — el addon a $0 → sigue correcta: entró por *«comprobaciones de
  cero llamadas»*, y las suyas —la tercera y la cuarta— **no cambian**; lo único que ganan es un
  motivo con nombre.
- **L3302-3356 · `DEC-SUB-013`** — la cuota del pagador manual la abre un reloj → sigue correcta:
  su sujeto es `MP5` y la fecha del próximo cobro. Entró por *«cortesía»* en la prosa de `S10`.
- **L3474 · `DEC-GRANT-007`, título** → **es la decisión que el segundo commit implementa**: sigue
  correcta por construcción.
- **L3476-3517 · `DEC-GRANT-007`, cuerpo** → ídem. Se cumplió al pie: no se re-apunta, `S18` guarda
  el saldo, el disparador es la autorización, `S9` se reusa *«tal como está»*, y el cobro del hueco
  se devuelve por `DEC-RF-002`. Las dos alternativas descartadas **no se reabrieron**.
- **L3523-3555 · `DEC-SUB-014`** — la baja desde `GRACE_PERIOD` → sigue correcta: es una fila que
  todavía no existe y no toca ni la marca ni la cortesía.
- **L3561-3575 · Resumen** — la tabla de conteos → sigue correcta: ninguno de los tres commits
  agrega, deroga ni cambia el estado de una decisión, así que los **80** y los **11 / 69** no se
  mueven.

### `02-worklog.md` (8)

Es el **registro fechado de lo que pasó cada día**. Ninguna de las ocho afirma nada sobre la forma
de la marca ni sobre el cierre de la sucesión: describen mediciones y cierres de preguntas.

- **L191-193** — *«tres relaciones con compromiso vivo y dos cortesías»* → sigue correcta: es el
  inventario del 2026-09-15.
- **L215-234** — la tabla de las 16 preguntas cerradas → sigue correcta: ninguna de las 16 es sobre
  la marca.
- **L241-247** — los tres apartamientos del PDR → sigue correcta: `DEC-GRANT-002` sigue siendo el
  apartamiento del §34 y el arreglo no lo mueve.
- **L318-321** — los dos defectos del proveedor (`external_reference`) → sigue correcta: es el
  vínculo, no la marca.
- **L616-624** — *«`BD-MP-01` y `BD-MP-02` siguen bloqueando FASE 2»* → sigue correcta **como
  registro de ese día**; el propio log dice más abajo que las cerró `DEC-GRANT-003`.
- **L757-761** — cómo se verificó el desarme de los capítulos → sigue correcta: método, no marca.
- **L991-1001** — *«el contrato tiene tres clases de fuente y seis tipos»* → sigue correcta: el
  arreglo **no agrega ni saca fuentes**; una cortesía diferida no emite ninguna.
- **L1077-1081** — *«una fila marcada saliendo del barrido»* como error registrado → **sigue
  correcta y el primer arreglo la refuerza**: la salvedad 2 sigue devolviéndola, ahora con reloj.

### `03-handoff.md` (13)

Igual que el worklog: es el **estado de la sesión al día que se escribió**, y ninguna de las trece
enuncia una regla del diseño.

- **L97-111** — lo que la 9-bis dejó escrito → sigue correcta: enumera arreglos anteriores.
- **L159-160** — *«una fila por vertical de su scope para las cortesías heredadas»* → sigue
  correcta: es el corte (`B/21`), y ahí la cortesía nace como grant, sin sucesión.
- **L173-178** y **L180-181** — qué se hizo en esa tanda → sigue correcta: registro fechado.
- **L244-248** — el defecto 11, el candado y las de complemento → sigue correcta: el candado no
  cambia.
- **L341-344** — *«`DEC-CONC-003` (la marca — revisa una razón escrita del owner)»* → sigue
  correcta: sigue siendo la decisión que convirtió el estado en marca.
- **L552-555**, **L771-774**, **L916-930**, **L1033-1043**, **L1092-1099** — próximos pasos, el
  mapa de los 22 capítulos y el estado por fase → siguen correctas: son navegación y cronología.
- **L783-792** — las reglas de trabajo de FASE 2 → sigue correcta: método.
- **L1264-1276** — las seis consecuencias de `EX-3` → sigue correcta: son sobre el `reason` y los
  correos del proveedor.

### `04-open-decisions.md` (8)

- **L24-108** — el estado de las decisiones abiertas al 2026-09-15 → sigue correcta: registro.
- **L126-129** — *«ya no queda ningún bloqueante que dependa de una medición»* → sigue correcta:
  ni `DEC-RF-002` ni `DEC-GRANT-007` esperan una medición; la segunda **eligió** el camino que no
  la necesita.
- **L223-243** — la tabla de no bloqueantes → sigue correcta: ninguna fila es sobre la marca.
- **L278-292** — los siete huecos de trial → sigue correcta: otro dominio.
- **L351-365** — *«promos y grants: la promo el monto, la cortesía el cobro, el grant la
  obligación»* → **sigue correcta y es la frase que justifica el arreglo**: la cortesía toca el
  **cobro**, o sea la pausa, que es exactamente lo que re-apuntar sin pausar no hacía.
- **L402-412** — Partner y *«cuántas presencias no es un limit: es un entitlement booleano»* →
  sigue correcta: clase excluida del §3.
- **L470-472** — `OD-MIG-01` cerrada por `DEC-MIG-002` → sigue correcta: entró por *«las cinco de
  `DEC-MIG-001`»*, que es otro conteo.
- **L521-530** — qué revisar más adelante → sigue correcta: `DEC-GRANT-001` se revisa el día que
  haya ciclo anual, y eso no cambia.

### `05-phase-1a-domain-analysis.md` (16)

Es el **análisis del PDR** anterior a todo el diseño: enuncia huecos, no reglas. Ninguno de los 16
afirma cómo se implementa la marca ni el cierre.

- **L150-153 · `M-ARCH-02`** — la caché y su invalidación → sigue correcta: el arreglo no agrega
  una fuente ni un evento de invalidación.
- **L323-324 · `R-TRIAL-01`** y **L697 · `OD-ENT-01`** — *«entitlements booleanos»* → clase
  excluida del §3.
- **L333-335 · `OD-TRIAL-01`** — trial, pausa y extensiones → sigue correcta: §34.1, la cortesía
  **durante el trial**, que `DEC-GRANT-003` implicación 4 declara que no toca al proveedor.
- **L409-411 · `A-SUB-02`** — dónde se habilita la pausa → sigue correcta: lo cerró `NUCLEO/01` §3.
- **L664-666 · `M-ENT-02`** — el enforcement de excedentes → sigue correcta: *«termina una
  cortesía»* sigue siendo un disparador, y diferir no lo cambia.
- **L807**, **L844**, **L849-851**, **L855**, **L864**, **L866-867**, **L869-871** — los huecos de
  promos, cortesías y grants → siguen correctas: son las preguntas que `DEC-GRANT-002/003/004/006`
  cerraron, y ninguna se reabre.
- **L904-906 · `M-AUTH-02`** y **L1127-1131 · `M-ADMIN-01`** — el actor administrativo y el
  catálogo de acciones → siguen correctas: el catálogo sigue teniendo **doce** filas, y la
  re-emisión de `S9` **no agrega una**, por la misma regla con que la marca de `S18` tampoco la
  agregaba (`NUCLEO/08` §3).
- **L1270-1273 · `O-METH-01`** — las cuatro decisiones que dependían de MP → sigue correcta:
  registro de su fecha.

### `06-mp-validation-matrix.md` (6)

Es **la matriz de mediciones**. Una fila de la matriz dice qué hace el proveedor; ninguno de los
arreglos le pide nada nuevo.

- **L244-248 · cortesía `BD-MP-02`** — `CT-1`, `CT-3` → siguen correctas: el mecanismo sigue siendo
  pausar.
- **L258-264 · webhooks** — `WH-1` duplicados → sigue correcta.
- **L300-307 · huecos estructurales** — `RF-6`, la idempotencia del reembolso → **sigue correcta y
  sigue pendiente**: el primer arreglo **no la cierra**, y el motivo técnico que `DEC-RF-002` da
  —*«`B/02` §2.3 no guarda el id del refund»*— sigue en pie. Lo que la marca agrega es a **qué
  pago** apunta, que es otra cosa.
- **L375-385 · Orders API** → sigue correcta: alternativa no elegida.
- **L498-512** y **L514-517 · qué espera cada decisión** → siguen correctas: las cuatro
  bloqueantes están cerradas y ninguno de los arreglos las reabre.

### `07-facts-inventory.md` (1)

- **L35-36** — *«tres relaciones con compromiso vivo y dos cortesías»* → sigue correcta: es la
  medición de la cartera, y `DEC-MIG-003` ya decidió qué se hace con ella.

### `08-phase-1b-code-discovery.md` (15)

Es el **descubrimiento del código que HOY corre**, que el rediseño reemplaza. Ninguna de las quince
describe el diseño nuevo.

- **L1915-1917 · `F-1B-049`** y **L4849-4854 · `F-1B-104`** — *«flags booleanos»*, `combinable` →
  clase excluida del §3: son campos del código actual.
- **L2259-2266**, **L2268-2271**, **L2273-2278 · `F-1B-056`** — la cortesía del código actual, su
  transacción por fila y su reconciliación sin `try/catch` → siguen correctas: miden
  `grantCompSubscription`, que no es ninguna de las filas de `B/03` §3.2.
- **L2442-2444 · `F-1B-059`** — las 21 afirmaciones sobre qzpay → sigue correcta: entró por *«las
  cinco de `mercadopago`»*, otro conteo.
- **L3450**, **L3459-3463**, **L3469-3472 · `F-1B-079`** — *«una cortesía se puede cancelar y no
  des-cancelar»* → **siguen correctas y describen el código viejo**; el texto ya declara que el
  cruce con `DEC-GRANT-003` está abierto, y el arreglo no lo cierra ni lo agrava.
- **L4042-4045 · `F-1B-092`** — `status: COURTESY` escrito sin máquina → sigue correcta: es el
  código actual.
- **L5429-5434 · `F-1B-115`** — *«las cuatro escrituras que existen»* → sigue correcta: son las de
  `services/billing/` del código actual, **no las de `S18`**.
- **L5674-5683**, **L5685-5689**, **L5691-5696 · `F-1B-121`** — las trece columnas que hospeda
  agregó → siguen correctas: modelo actual.
- **L6461-6466 · el enunciado** — *«qzpay tiene el modelo y la superficie»* → sigue correcta.

### `10-evaluacion-de-proveedor.md` (3)

- **L69-79 · capacidades que faltan** — *«auto-reanudar una pausa (`PS-4`)»*, *«correr la fecha de
  cobro (`EX-34`)»* → **siguen correctas y son la razón por la que `S9` se reusa**: el reloj de fin
  de pausa es nuestro, y por eso la re-emisión es un acto nuestro y no una espera al proveedor.
- **L413-544 · el ticket de soporte** → sigue correcta: es un texto para MercadoPago.
- **L708-710 · Mobbex** — *«el ciclo de vida puede ser nuestro … cortesías»* → sigue correcta: es
  la evaluación del proveedor alternativo, no el diseño.

### `11-particion-del-programa.md` (4)

- **L91-96** y **L121-123** y **L139-147** y **L156-180** — el mismo hecho en cuatro lugares, el
  valor por defecto de `cobertura()`, lo que queda inactivo y el reparto capítulo por capítulo →
  **las cuatro siguen correctas**: la cortesía sigue siendo una de las cuatro fuentes que implementa
  billing, y **una cortesía diferida no emite**, así que el conteo de fuentes de la partición no se
  mueve.

### `12-contrato-de-cobertura.md` (12)

**Es el capítulo que más cerca estuvo de volverse falso, y la razón por la que no lo es hay que
decirla**: lo que emite `tipo: CORTESÍA` **es el estado de la suscripción** —`PAUSED` por
`COURTESY`, §2.6—, no la fila de `courtesy_grant`. Una cortesía diferida apunta a una `CANCELLED`,
que no emite nada, **así que el contrato ya la contesta sin cambiar una palabra**. Es la diferencia
con el grant, que sí necesitó su §2.8.

- **L32-35 · §1** y **L45-50 · §1.1** — el paso 5 y el mismo hecho en cuatro lugares → siguen
  correctas: la pregunta no cambia.
- **L285-290 · §2.6** — la tabla de los cuatro valores de `hasta`, con *«fin de cortesía»* en
  `fecha` → sigue correcta: una cortesía **corriendo** sigue teniendo fecha de fin; una diferida no
  emite, así que no tiene `hasta` que declarar.
- **L292-293 · §2.6** — *«`V/15` §4.4 reparte las ventanas: fin de una cortesía tiene ventana»* →
  sigue correcta, por lo mismo.
- **L312-323 · §2.6, los nueve estados** — *«`PAUSED` por `COURTESY` | **sí**, como `tipo:
  CORTESÍA`»* y *«`CANCELLED` | **no**»* → **sigue correcta, y es la fila que vuelve innecesario
  tocar este capítulo**: las dos filas juntas contestan qué emite una cortesía diferida.
- **L349-354** y **L360-365 · §2.6** — la garantía que termina con la sucesión y por qué no se
  desempata → siguen correctas: hablan de la ventana entre predecesora y sucesora, y el arreglo no
  agrega ninguna fuente en esa ventana.
- **L414-418 · §2.7** — *«suscripción, cortesía, trial, `BASE` → alcance `VERTICAL`»* → sigue
  correcta: el alcance no cambia.
- **L536-539 · §2.8** — *«un grant emite mientras está vivo»* → sigue correcta: otro instrumento.
- **L713-715 · §5.1**, **L749-750 · §5.2**, **L814-821 · §7** — las dos fuentes de arranque, las
  cuatro que agrega billing, y lo que el contrato no decide → siguen correctas: **cuatro sigue
  siendo cuatro**, porque diferir no agrega ni saca una fuente.

### `13-pliego-consulta-legal.md` (1)

- **L140-143 · pregunta 5** — *«la marca de «ya usó su prueba»»* → sigue correcta: es **otra
  marca**, la del trial sobre un correo anonimizado. Entró al grep por la palabra y no es una
  aparición del término.

### `mobbex-probes/PLAN-DE-BATERIA.md` (1)

- **L120 · §4** — *«las cinco preguntas que deciden si Mobbex sirve»* → sigue correcta: entró por
  *«las dos primeras»*, que no es el conteo de las escrituras de `S18`.

### `mobbex-probes/RESULTADOS-2026-09-18.md` (1)

- **L134-137 · §2.5** — el control de la tarjeta → sigue correcta: medición de Mobbex.

### `mp-probes/RESULTS-2026-09-15.md` (10)

Son **mediciones fechadas** contra el proveedor. Ninguna de las diez afirma nada sobre nuestra base.

- **L131-136 · `EX-5`** — `auto_recurring` como array → sigue correcta.
- **L261-262 · `WH-1`** — el duplicado a 1,5 segundos → sigue correcta.
- **L334**, **L336-339 · `BD-MP-02`** — *«el piso es ARS 15: una cortesía sin cobrar por reducción
  de monto no existe»* → **sigue correcta y es la base de `DEC-GRANT-003`**, que `DEC-GRANT-007`
  declara intacta.
- **L2040-2044 · `PA-3`** — cómo se distinguen los dos cobros → sigue correcta.
- **L2108-2112** — *«`paused` y `cancelled` le llegan al cliente AMBIGUOS»* → **sigue correcta, y
  es un costo que el arreglo NO agrava**: la cortesía diferida pausa **una vez**, sobre la
  sucesora, donde antes el diseño pedía pausar sobre una `pending` que el proveedor quizá rechaza.
- **L2216-2218 · `CT-1`/`CT-3`** — *«la cortesía más barata cuesta 15 por ciclo, no cero»* → sigue
  correcta.
- **L2451**, **L2461-2463 · `BD-MP-02`** — *«la cortesía real se hace pausando»* → sigue correcta.
- **L2512-2515** — *«un reembolso de cortesía no se convierte sin querer en una baja»* → sigue
  correcta, y es una medición que el camino de `DEC-RF-002` sigue usando.

### `nucleo/00-indice.md` (1)

- **L108-111** — el índice de los trece capítulos de billing → sigue correcta: no se agrega ni se
  saca un capítulo.

### `nucleo/01-glosario.md` (9)

- **L132-134 · §1.5** — *«la cortesía la firma `SUPER_ADMIN` y vence»* → **sigue correcta**: una
  cortesía diferida no deja de vencer; lo que se congela es **el saldo**, y el `fin` se recalcula al
  re-emitir.
- **L136-141 · §1.5** — *«la cortesía trae su fin escrito en la fila»* → sigue correcta: sigue
  trayéndolo, y `saldo_días` es lo que lo hace reconstruible cuando la suscripción que pausaba
  murió.
- **L145-151 · §1.6** — *«Entitlement: una capability, booleana o medida … puede venir de … cortesía
  o grant»* → sigue correcta: el booleano de acá es la clase excluida del §3, y la cortesía sigue
  siendo una fuente.
- **L238-241 · §2.2** — *«`PAUSED` lleva motivo … en el proveedor una cortesía y una pausa se ven
  idénticas»* → **sigue correcta y es el precedente de la forma de la marca**, citado en `B/02` §2.5.
- **L366-371 · §2.4** — *«de las seis filas vivas, tres no emiten ninguna fuente … `PAUSED` por
  `COURTESY` sí emite»* → sigue correcta: el reparto de los seis estados no cambia.
- **L536-540 · §3** — las tres condiciones para pausar → sigue correcta: `S9` no las evalúa
  (`puedePausar()` es de `S8`), y eso ya era así.
- **L563-575 · §3** — el tope de una pausa contra el día 180 → sigue correcta: la cortesía diferida
  **no abre una pausa**, así que no suma días al tope.
- **L624-627 · §4.3** — la lista del Eje 1 → sigue correcta: el cierre de la sucesión ya estaba ahí.
- **L671-674 · §5** — el mapa conceptual → sigue correcta: las fuentes no cambian.

### `nucleo/03-maquinas-de-estado.md` (3)

- **L71-73 · §1 regla 7** — *«el intento cae en la regla 1 … pone la marca»* → **sigue correcta**:
  la regla 1 ya nombra su motivo (`TRANSICIÓN_NO_DECLARADA`) dos párrafos más arriba, que es el
  párrafo que el commit sí tocó.
- **L79-83** y **L85-89 · §1 regla 7** — *«el booleano `cubierto`»* → clase excluida del §3: es el
  campo del contrato, no la marca. Y los **tres** pares con dos filas siguen siendo tres: `S9` gana
  un **evento**, no una fila.
- *(Recontado, no heredado: recorrí la tabla de `B/03` §3.2 y sigue teniendo 23 filas numeradas.)*

### `nucleo/04-invariantes.md` (2)

- **L161-184 · §3, `D15`** — *«`S18` corre además cuando la predecesora se muere sola por `S12` o
  por `S16` … y `S22` tampoco está entre las seis»* → **sigue correcta**: su sujeto es **el destino
  de un pago pendiente por `S19`**, que sólo existe sobre `GRACE_PERIOD` o `SUSPENDED`; el
  diferimiento de la cortesía no escribe ninguna de las dos columnas que `D15` nombra.
- **L247-283 · §5** — el resumen del reparto, *«las cuatro de base, las cinco de guard y las diez
  de servicio»* → **sigue correcta y lo verifiqué**: `G-R1-F` es un guard del **catálogo de
  `B/20` §2**, no de los cinco que este § reparte —esos son los invariantes del §64 que un guard
  sostiene—, así que el conteo de este capítulo no se mueve.

### `nucleo/07-outbox-y-notificaciones.md` (3)

- **L178-181 · §5.2** — *«`paused` y `cancelled` llegan idénticos: una cortesía y una mora son
  indistinguibles para el cliente»* → sigue correcta, y el arreglo no cambia cuántos correos manda
  el proveedor.
- **L185-194 · §5.3** — las tres reglas ya decididas → siguen correctas.
- **L210-225 · §6** — el catálogo de correos → **sigue correcto y hay que decirlo**: la re-emisión
  de la cortesía **no agrega un correo** porque el catálogo ya tiene el de *«tu cortesía empieza»*
  ligado al acto de `S9`, que es el que corre; y el cobro del hueco entra por el correo de
  reembolso que `DEC-RF-002` ya obliga a escribir.

### `nucleo/08-auditoria-y-observabilidad.md` (4)

- **L38-43 · §1.1** — el criterio de qué se audita, *«una concesión que evita un cobro»* → sigue
  correcta: diferir y re-emitir son las dos mitades de la misma concesión y las dos quedan
  auditadas.
- **L50-58 · §1.2** — los campos mínimos → siguen correctos: la marca no agrega un campo de
  auditoría, agrega columnas a su propia fila.
- **L185-191 · §3.1** — *«las tres escrituras sobre un grant tienen cada una su frase»* → sigue
  correcta: es el grant permanente, no la cortesía.
- **L241-247 · §4.1** — *«canal primario: el listado accionable en Admin … cada entrada trae lo
  necesario para decidir sin reconstruir el diagnóstico»* → **sigue correcta, y el primer arreglo
  es lo que la vuelve verdadera**: hasta ahora esa promesa la cumplía el evento y no el listado.

### `HOS-1353/descomposicion.md` (1)

- **L52-62 · §2** — la unidad `V1` y el catálogo de claves → sigue correcta: *«booleano»* acá es
  una clave de entitlement (clase excluida del §3).

### `HOS-1353/docs/02-modelo-de-datos.md` (2)

- **L281-283 · §3.1** — qué se cachea, *«cortesía y grant»* como fuentes → sigue correcta: una
  cortesía diferida no otorga nada, así que no hay nada que cachear de ella.
- **L293-304 · §3.2** — la invalidación por evento, *«toda transición de la máquina de
  suscripción»* → **sigue correcta y cubre el caso nuevo sin cambiarse**: `S9` es una transición de
  esa máquina, así que la re-emisión invalida la caché por la fila que ya existe.

### `HOS-1353/docs/03-maquinas-de-estado.md` (5)

- **L42-50 · §2** — la tabla del trial → sigue correcta: el trial no participa de la sucesión.
- **L56-61 · §2** — qué fuente emite cada estado del trial → ídem.
- **L100-105** — la máquina de trial hablando el vocabulario del contrato → ídem.
- **L109-117** — *«`T1` y `T6` … el booleano `cubierto`»* → clase excluida del §3, y **los tres
  pares siguen siendo tres**.
- **L187-191** — *«`cubierto` no se puede referir a sí mismo»* → sigue correcta.

### `HOS-1353/docs/11-trial.md` (5)

- **L95-98 · §2.3**, **L136-140 · §3.1**, **L144-146**, **L297-302**, **L336-340** — el techo
  compartido entre extensión de trial y cortesía **durante el trial** → **las cinco siguen
  correctas**, y por una razón que conviene decir: la cortesía del §34.1 **extiende el trial** y
  `DEC-GRANT-003` implicación 4 declara que **no toca al proveedor**. No hay suscripción que pausar,
  así que no hay nada que diferir: el arreglo no alcanza a esta población.

### `HOS-1353/docs/15-entitlements-y-limits.md` (4)

- **L223-227**, **L291-294 · §4.4**, **L384-391** — la agregación de fuentes y la ventana para
  elegir → siguen correctas: *«termina una cortesía»* sigue siendo un disparador de descenso, y
  diferir no lo adelanta ni lo atrasa.
- **L323-324 · §5.2** — *«el visitante sin cuenta no recibe ningún entitlement medido … de los
  booleanos»* → clase excluida del §3.

### `HOS-1353/docs/17-autorizacion.md` (4)

- **L40-41 · §1.1** — *«trial/suscripción/cortesía»* entre las ocho condiciones del §13 → sigue
  correcta: la pregunta la contesta el contrato.
- **L202-204 · §3.1** y **L220-233 · §3.2** — el actor administrativo y `actor ≠ sujeto` → siguen
  correctas.
- **L244-247 · §3.3** — *«un actor de sistema no puede ejecutar ninguna de las doce acciones»* →
  **sigue correcta, y es la regla que obligó a declarar la re-emisión como efecto de `S9` y no como
  acción nueva** (`NUCLEO/08` §3): lo hace el sistema, con la firma de la persona que otorgó.

### `HOS-1353/docs/18-partner.md` (4)

- **L39**, **L48-50 · §1.2** — *«un entitlement booleano»* → clase excluida del §3.
- **L127-128 · §2.3** — *«pasados N días sin resolverse aparece **marcada** como atrasada»* → es
  **otra marca**, la de una postulación de Partner. Entró al grep por la palabra y no es una
  aparición del término.
- **L172-176 · §3** — lo que no es de Partner → sigue correcta.

### `HOS-1353/docs/20-testing.md` (1)

- **L29-34 · §1** — las cuatro capas, con *«cortesía»* entre los escenarios funcionales → sigue
  correcta: sigue habiendo que testear la cortesía, ahora con un escenario más.

### `HOS-1353/docs/21-migracion.md` (2)

- **L93-106 · §2.4** — cómo amanece la población existente → sigue correcta: las ocho se cancelan
  sin sucesión.
- **L164-168 · §4** — lo que no se migra → sigue correcta.

### `HOS-1353/spec.md` (4)

- **L40-42 · §1**, **L252-255 · §4.1**, **L279-284 · §4.2** — el criterio del owner, el trial como
  título vivo y lo que queda inactivo → siguen correctas: verticales no ve la marca ni la cortesía
  diferida (regla 1 de `NUCLEO/01` §2.4).
- **L217-219 · §3.11** — *«de los booleanos sólo …»* → clase excluida del §3.

### `HOS-1354/descomposicion.md` (3)

- **L192-200 · política y forma** — la fila de `B3` → sigue correcta: la política de la ventana de
  72 h no cambia.
- **L244-245 · §2.5** — *«le alcanza con B3: una suscripción viva ya es una fuente»* → sigue
  correcta.
- **L331-337 · §3.1** — *«la rama 1 del cierre … y el criterio de terminación de B7»* → **sigue
  correcta y el primer arreglo la vuelve ejecutable**: el criterio nombra la marca y ahora la marca
  nombra su motivo.

### `B/02-modelo-de-datos.md` (14)

- **L83-91 · §2.2** — *«el candado `A` no puede quedar vacío … si la predecesora se muere sola
  —`S12`, `S16` o el espejo del §10.1, **tres de las siete transiciones que `B/03` §3.2
  recorre**—»* → **sigue correcta, y la cláusula que la salva es la que ella misma escribe**: está
  acotada **a la tabla de recorrido de las siete**, cuyo dominio declarado son los tres estados
  desde los que una fila puede ser sucedida. `S22` y `S23` **no salen de ninguno de los tres** —se
  llega a `PAUSED` y a `SUSPENDED` **por** esas filas— y el propio `B/03` §3.2 lo dice con todas
  las letras desde la familia de la baja. Es la misma razón por la que no toqué las enumeraciones
  de `B/05` §3, `B/09` §3, `B/16` §4.2 y §4.3, `12-contrato…` §2.6 y `B/20` §2.
- **L127-134 · §2.2** — *«el verbo ya se usa con los dos sujetos y eso costó un doble cobro»* →
  sigue correcta: es la regla de vocabulario sobre *«declarar»*.
- **L174-180 · §2.2** — *«`RECONCILIATION_REQUIRED` ya no figura acá porque dejó de ser un estado:
  es la marca `requiere_conciliación` sobre la fila, que conserva el estado que tenía»* → **sigue
  correcta palabra por palabra**: sigue sin ser un estado y sigue sin pisar la columna. Lo único
  que cambió es **dónde vive** la marca, y el párrafo no afirma que viva en una columna de
  `subscription`.
- **L182-186 · §2.2** — *«la marca no contradice esa razón: la cumple mejor … la fila **ocupa** el
  candado»* → sigue correcta: una fila con marcas abiertas sigue ocupando el candado.
- **L188-190 · §2.2** — *«mientras esté puesta sobre una fila, ningún `sucede_a` puede apuntarla»*
  → **sigue correcta bajo el predicado nuevo**: *«puesta»* se lee como *«hay al menos una marca
  abierta»*, que es exactamente lo que `NUCLEO/01` §2.5 define, y el `B/03` §3.3 —que el commit sí
  tocó— ya lo dice con el término nuevo.
- **L192-194 · §2.2** — la excepción desde `CANCEL_SCHEDULED` con relectura → sigue correcta: no
  depende del motivo.
- **L196-201 · §2.2** — *«la divergencia más probable sobre una `CANCEL_SCHEDULED` es que esa
  cancelación no se aplicó, y es lo que pone la marca»* → **sigue correcta y no necesita nombrar un
  motivo**: es prosa que explica por qué la excepción sin relectura era insegura, no un escritor de
  la marca. El escritor es el barrido, y su motivo está en `B/09` §3.
- **L203-206 · §2.2** — *«releer no agrega un mecanismo: `D5` ya manda verificar»* → sigue correcta.
- **L323-326** y **L331-337 · §2.4** — *«`addon_product.version_id` se re-apunta»* → **es OTRO
  re-apunte, con otro sujeto**: el puntero de qué versión se vende hoy. Entró al grep del término
  viejo y no es una aparición de él.
- **L347-377 · §2.4** — el ancla del addon, *«apunta al ANCLA, no al grant»* → sigue correcta.
- **L388-391 · §2.4** — *«las concesiones no modifican el plan ni la suscripción: son fuentes
  independientes»* → **sigue correcta, y es lo que hace posible diferir**: la cortesía no vive
  adentro de la suscripción, así que su suscripción puede morir sin que el instrumento muera.
- **L504-511 · §2.4** — *«el instrumento no vence»*, sobre el grant → sigue correcta: otro
  instrumento.
- **L643-658 · §2.6, el recuadro del grant** — *«un grant NO es una sucesión: no re-apunta nada …
  de las cinco filas de arriba la única que un grant mueve por ser grant es **la cuarta** —el pago
  pendiente por `S19`—»* → **sigue correcta y la reconté sobre la tabla de hoy**: la tabla sigue
  teniendo **cinco** filas y el pago pendiente sigue siendo la cuarta. Lo que cambió es qué dice la
  tercera, no dónde está.

### `B/03-maquinas-de-estado.md` (20)

- **L174-182 · §3.2, la tabla de recorrido** — las siete filas, con *«2 | `ACTIVE` | `S9` —
  `SUPER_ADMIN` otorga cortesía | `PAUSED` | **sí**»* → **sigue correcta, y es la fila que prueba
  que la población de `B/14` §4.4 no es vacía**. `S9` gana un segundo disparador y **no gana una
  fila**, así que la tabla sigue teniendo siete. *(Recontada sobre el texto, no heredada.)*
- **L191-197 · §3.2** — *«la 3 y la 4 no necesitan que nadie toque un botón»* → sigue correcta: no
  toca las escrituras de `S18`.
- **L199-209 · §3.2** — *«las tres primeras tienen desde la FASE 9-bis-4 una SEGUNDA salida que no
  es `S17`»* → **sigue correcta y es la que hace verdadera mi corrección**: es el párrafo que
  declara que `S22` y `S23` no entran como filas 8 y 9 de la tabla de recorrido, que es lo que deja
  intactas todas las enumeraciones acotadas a ella.
- **L211-217 · §3.2** — *«`S18` corre en SEIS de las siete, y la que falta es `S13`»* → sigue
  correcta: el reparto sobre esa tabla no cambia.
- **L320-326 · §3.2** — *«la única rama en la que la sucesión NO se cierra es que la cancelación
  falle sobre un preapproval vivo»* → sigue correcta: es la rama 3, y su marca la pone `S14`.
- **L342-346 · §3.2** — *«la regla que lo impide tiene que estar en esta tabla»* → sigue correcta.
- **L348-362 · §3.2** — *«el evento son DOS puertas y no una»*, sobre `S19` → sigue correcta: las
  dos puertas del pago no cambian.
- **L399-402 · §3.2** — *«`S6` lleva su condición por el mismo motivo»* → sigue correcta.
- **L572-574 · §3.2** — *«esto vuelve verdadera una afirmación de `B/14` §4.3: sobre un grant no se
  otorga cortesía»* → **sigue correcta**: §4.3 no se tocó, y diferir no otorga nada sobre un grant.
- **L681-685 · §3.2** — *«la frase de `S13` no se podía copiar, y se había copiado»* → sigue
  correcta: es sobre `S20`.
- **L912-915 · §3.4** — *«la afirmación exige que la fila pendiente ocupe `A`, y una sucesora ocupa
  `B`»* → sigue correcta: aritmética de los candados, que no cambia.
- **L953-960 · §5** — la ficha de la pausa, *«motivos: `CUSTOMER_REQUEST` · `COURTESY`. Valor
  cerrado»* → **sigue correcta y el arreglo no agrega un tercer motivo**: la re-emisión abre una
  pausa con motivo `COURTESY`, que ya existe.
- **L985-988 · §5** — *«el motivo no es un adorno … en el proveedor una cortesía y una pausa se ven
  idénticas»* → **sigue correcta y es el precedente citado por `B/02` §2.5**.
- **L990-993 · §5** — los tres cruces de `DEC-GRANT-004` → **siguen correctos y uno de ellos es el
  que explica `S22`**: *«en cortesía pide pausar → se permite, avisando que pierde la cortesía»*.
- **L1066-1072 · §7.1** — el acto de *«confirmar que no se pagó»* y `MP4` → sigue correcta.
- **L1174-1178 · §7** — *«lo que sí se hereda entero de `B/12` §5.3 es su otra mitad»* → sigue
  correcta: nombra la regla, no el conteo de ramas.
- **L1331-1348 · §7.2** — las tres escrituras de la fecha del próximo cobro → **siguen correctas y
  las verifiqué contra la cortesía**: `S10` avanza la fecha *«tantos ciclos como hayan vencido
  durante la pausa»*, y una re-emisión abre una pausa nueva, que ese mismo mecanismo cubre.
- **L1409-1414 · §7.2** — el tope de `MP4` → sigue correcta.
- **L1422-1437 · §7.2** — *«para `CUSTOMER_REQUEST` la población es vacía … la pausa de cortesía
  sobre un pagador manual»* → **sigue correcta y hay que decir por qué**: el pagador manual no tiene
  preapproval, así que `S9` sobre él no llama al proveedor — y la re-emisión tampoco. El riesgo
  aceptado de `DEC-GRANT-007` (*«el proveedor puede cobrar»*) **no tiene población ahí**, lo cual es
  estrictamente mejor y no cambia nada de lo escrito.
- **L1573-1580 · §8** — *«desde `S21` esa salvedad puede nombrar su sujeto de las DOS maneras»* →
  sigue correcta: es la salvedad 1 y el addon.

### `B/05-idempotencia-y-concurrencia.md` (4)

- **L175-180 · §3** — la tabla de las cuatro condiciones del pago tardío → sigue correcta: las
  cuatro no cambian; lo que cambió es el motivo con que se marca si alguna falla.
- **L200-207 · §3** — *«la única excepción: la condición 3 falla porque la otra fila viva es su
  propia sucesora»* → sigue correcta: es `S19`, y `S19` no pone marca.
- **L222-226 · §3** — *«su redacción cambió, y es más precisa, no más laxa»* → sigue correcta.
- **L244-251 · §3** — *«la segunda mitad de la 3 se lee sobre DOS columnas, porque la que la
  respondía se borra»* → sigue correcta: `sucede_a` y `sucedida_por`, que el arreglo no toca.

### `B/06-proveedor.md` (1)

- **L81-90 · §3** — lo que no se le puede pedir al proveedor → **sigue correcta y es la tabla que
  `DEC-GRANT-007` usa para descartar su alternativa 1**: no hay fila para *«pausar un preapproval
  `pending`»*, y por eso el diseño no lo pide.

### `B/09-conciliacion.md` (4)

- **L71-73 · §2.4** — *«toda divergencia de monto, estado o cobro pone la marca y la mira una
  persona»* → **sigue correcta**: el criterio no cambia, y el recuadro que el commit agregó
  inmediatamente debajo es el que dice que ahora además se distingue cuál es.
- **L166-168 · §3** — *«esto es lo que vuelve consistente la frase de más abajo»* → sigue correcta.
- **L471-472** y **L474-479 · §3** — *«una fila con la marca SÍ se barre»* y por qué → **siguen
  correctas bajo el predicado nuevo**: *«una fila con la marca»* es *«con al menos una marca
  abierta»*, que es como la salvedad 2 quedó escrita.

### `B/10-verticales-planes-billing-options.md` (2)

- **L56-58 · §3.3** — *«retirar es publicar una versión nueva **marcada** no vendible»* → es **otra
  marca**, la del flag de vendible. Entró al grep por la palabra.
- **L189-202 · §4.5** — los cuatro bordes de la discontinuación → sigue correcta.

### `B/12-suscripcion.md` (8)

- **L86-93 · §1.4** — *«el que llega a esta baja llega desde `GRACE_PERIOD` … es la séptima del
  dominio … y la rama 5»* → sigue correcta: describe el espejo, que no cambia.
- **L479-483 · §5.3** — *«las seis ramas tienen ahora un ACTO que las dispara»* → **sigue correcta
  y la verifiqué contra la tabla de abajo**, que el commit sí tocó para nombrar el motivo.
- **L494-508 · §5.3** — *«la 5 y la 1 comparten acto y no son la misma rama»* → **sigue correcta**:
  difieren en qué mata a la predecesora, y el motivo compartido no las fusiona — es exactamente lo
  que el recuadro ya dice.
- **L510-516 · §5.3** — *«la marca va sobre la PREDECESORA y no sobre la sucesora»* → **sigue
  correcta y el arreglo la refuerza**: la marca lleva ahora la referencia al pago, que es de la
  predecesora.
- **L518-522 · §5.3** — *«la predecesora es terminal, así que el reloj de la marca la tiene que
  alcanzar»* → **sigue correcta, y hasta este commit nombraba un reloj que la base no tenía**. Lo
  que cambió no es el enunciado sino contra qué se lee: `puesta_en`.
- **L524-527 · §5.3** — *«las dos primeras son la razón de la regla y son opuestas»* → sigue
  correcta.
- **L633-641 · §7.2** — *«el argumento va por el período pagado y no por «durante la pausa no hay
  servicio»»* → **sigue correcta, y es el argumento que hace que `S22` termine la cortesía en vez
  de diferirla**: no queda período que sostener.
- **L643-646 · §7.2** — *«quién lo ejecuta: `S22`»* → sigue correcta.

### `B/14-promos-cortesias-y-grants.md` (15)

- **L1-15 · frontmatter** y **L17 · título** → siguen correctos.
- **L22-26 · §0** — *«la promo el monto, la cortesía el cobro, el grant la obligación»* → **sigue
  correcta y es la frase que gobierna el arreglo**: la cortesía toca el cobro, o sea la pausa.
- **L64-72 · §1.3** — el piso del proveedor → sigue correcta: es de la promo.
- **L118-132 · §2.2** — *«`S18` re-apunta `promo_redemption.subscription_id` a la sucesora»* →
  **sigue correcta y es la que ahora hace contraste**: la promo **sí** se re-apunta, la cortesía no,
  y la diferencia es que la promo vive en el monto y la cortesía en el estado.
- **L209 · §4.2, título**, **L211**, **L213-215**, **L217-218**, **L220-221 · §4.2** — promo de
  descuento + cortesía temporal → **las cinco siguen correctas**: *«durante la cortesía el descuento
  no se aplica … el descuento se suspende con la cortesía y se reanuda al volver, con su contador
  intacto»*. Diferir **alarga** el intervalo en que no se aplica y no cambia la regla; el contador
  sigue intacto porque no hubo cobros en el medio.
- **L225-227 · §4.3** — *«sobre un grant no se otorga cortesía»* → sigue correcta.
- **L243-246 · §4.3** — *«otorgar un grant termina cualquier cortesía vigente»* → **sigue correcta,
  y verifiqué el borde**: sobre una cortesía **diferida** no hay suscripción que el grant cancele,
  así que la frase no la alcanza y no hay contradicción. *(Ver la pregunta 2 al owner.)*
- **L248-254 · §4.3** — *«lo mismo vale para anclarle una vertical nueva»* → sigue correcta, por lo
  mismo.
- **L342-344 · §4.4, cola** — *«no contradice `§4.3`»* → sigue correcta: el párrafo se conservó
  entero y su argumento —*«acá sí queda: la sucesora cobra»*— es más cierto que antes.
- **L352 · §4.5, título** → sigue correcto.

### `B/16-addons.md` (5)

- **L129-133 · §3** — *«de ahí salen cuatro preguntas»* → sigue correcta: entró por *«las tres
  primeras»*, que son las preguntas del addon y no las escrituras de `S18`.
- **L168-172 · §3.3** — qué pasa al revocar el grant → sigue correcta: el grant, no la cortesía.
- **L478-482 · §4.2** — *«el re-apunte es un efecto declarado de `S18`, y por eso el orden dejó de
  importar»* → **sigue correcta**: su sujeto es **el complemento**, que se sigue re-apuntando.
- **L530-534 · §4.3** — la tabla de efectos del huérfano recurrente → sigue correcta.
- **L677-682 · §4.4** — *«el preapproval es UNO»* → sigue correcta.

### `B/19-superficies.md` (3)

- **L47-49 · §2** — qué lee cada superficie → sigue correcta.
- **L55-57 · §3** — *«Mi Suscripción … el §46 pide claridad total de scope»* → **sigue correcta, y
  la cortesía diferida entra por donde ya estaba**: el §46 pide mostrar cortesías, y una diferida se
  muestra con su saldo. *(Ver la pregunta 3 al owner.)*
- **L79-97 · §4** — la tabla numerada de lo que hay que decir —**trece filas**, numeradas hasta la
  17 con huecos; las conté sobre el texto— → **sigue correcta y la verifiqué fila por fila**: la
  **5** dice que pausar estando en cortesía *«la pierde»*, la **8** que pedir la baja estando
  pausado *«pierde los días que le quedaban»* (`S22`), la **15** el reembolso y la **17** que el
  cambio de plan **no se ofrece desde `PAUSED`** —que es la que confirma cómo se llega a la
  población de `B/14` §4.4: la sucesión se declara `ACTIVE` y `S9` pausa después—. **Ninguna
  promete que la cortesía se re-apunte**, así que ninguna se volvió falsa.

### `B/20-testing.md` (1)

- **L29-34 · §1** — las cuatro capas → sigue correcta.

### `B/21-migracion.md` (3)

- **L45-51 · §1.2** — la medición de la población → sigue correcta.
- **L129-133 · §2.4** — *«las dos cortesías se escriben como `permanent_grant`»* → **sigue correcta
  y es importante decirlo**: la cartera vieja **no** entra por `courtesy_grant`, así que el corte no
  produce ninguna cortesía diferida.
- **L211-216 · §4** — lo que no se migra → sigue correcta.

### `HOS-1354/spec.md` (5)

- **L35-37 · §1**, **L44-58 · §2**, **L76-78 · §3.1**, **L109-114 · §3.4**, **L155-157 · §4** — lo
  que bloquea la épica, el mapa de los trece capítulos, las cuatro cosas que se le piden al
  proveedor, las cuatro decisiones de mecanismo y las **cuatro** fuentes que implementa → **las
  cinco siguen correctas**: ninguno de los tres commits agrega un capítulo, una llamada al proveedor
  ni una fuente.

## 5. Premisas ajenas que los arreglos volvieron falsas y se corrigieron en el mismo acto (13)

| dónde | qué decía | por qué dejó de ser cierta |
|---|---|---|
| `B/02` §2.2 | *«`requiere_conciliación` (booleano)»* | la marca lleva motivo, reloj y pago |
| `B/03` §3.1 | *«una marca **booleana** sobre la fila»* | ídem |
| `NUCLEO/01` §2.2 | *«es la marca `requiere_conciliación` sobre la fila»*, sin más | el predicado necesita definición propia |
| `B/03` §3.2, `S15` | *«se levanta la marca»* | se levanta **una**, no la fila |
| `B/03` §3.2, `S19` | *«sólo en las ramas 1 y 5»* y *«las **cinco** ramas de `B/12` §5.3»* | son seis desde la familia de la baja, y el motivo lo abre en tres |
| `B/03` §7, tabla *«quién apaga el pago pendiente»* | **cuatro** filas y una quinta en prosa | son **seis** ramas; faltaba la de `S23` |
| `B/03` §7.2 | *«las ramas 1 y 5 mandan devolver»* | 1, 5 y 6 |
| `B/02` §2.3 | *«las ramas 1 y 5 de `B/12` §5.3 mandan devolverlo»* | ídem |
| `NUCLEO/08` §3 y §4.3 | *«ramas 1 y 5»*, *«**cuarto** efecto»* | 1, 5 y 6; quinto efecto |
| `B/09` §3, backstop | *«`S18` pone la marca —por la rama 1 y por la rama 5—»* | falta la 6 |
| `B/02` §2.6 | *«**las tres primeras** son el acto»* (los tres re-apuntes) | son **dos** re-apuntes y un diferimiento |
| `B/16` §4.2 | *«el complemento es UNA de las **tres** cosas que `S18` re-apunta»* | son dos |
| `B/03` §3.2, prosa del candado `A` | *«se muere sola —por `S12`, por `S16` o por el espejo—»* | son **cinco** desde `S22` y `S23` (commit `f21d5d828`) |

**Y dos premisas de los rastros anteriores dejaron de ser ciertas o estaban incompletas:**

- **`rastro-032f761e0.md` L236-246** (familia de la baja) — justificaba `B/14` §4.4 con *«sigue
  correcta y es la más cerca de haberse vuelto falsa de todo el rastro»*, y el argumento era: *«una
  cortesía temporal vive sobre una fila en `PAUSED` por `COURTESY`, que no puede declarar una
  sucesión (`G-R1-A`) … si pausa después, `S22` la alcanza y el segundo camino de `S18` la cubre»*.
  **La conclusión es falsa y el propio argumento la contradice.** La primera mitad es cierta —la
  predecesora no está `PAUSED` **cuando se declara** la sucesión— pero lo que `B/14` §4.4 afirmaba
  no es eso: afirmaba *«`S18` **siempre** corre sobre una sucesora ya `ACTIVE`»* y *«**no hay caso**
  en que haya que pausar un preapproval que todavía no autorizó»*. La segunda mitad del propio
  rastro —*«si pausa después, `S22` la alcanza»*— **es exactamente el caso que §4.4 declara
  inexistente**, y el commit de esa familia **creó una puerta más** hacia él. El defecto no era
  *«estar cerca»*: ya estaba abierto y reportado por tres IDs. Corregido en `70d83299d`.
- **`rastro-032f761e0.md` §4, fila *«`B/03` §3.2, evento de `S18`»*** — declaró corregida la
  premisa *«sin `S17` — por `S12`, por `S16` o por el espejo»* porque **son cinco causas**, y la
  corrección se aplicó **sólo a la celda de `S18`**. La misma frase seguía viva en **tres párrafos
  de prosa del mismo §** —la justificación del candado `A` vacío, dos veces, y el recuadro *«`S18`
  sin `S17` es lo CORRECTO en…»*—, que el rastro justifica con *«sigue correcta **como enumeración
  de los casos que ese párrafo trata**»*. Es una corrección **incompleta**: los tres párrafos no
  acotan su dominio a nada, y el tercero dice literalmente *«es lo CORRECTO en `S12`, en `S16` y en
  el espejo»*, que se lee como una lista cerrada. Corregidos en `f21d5d828`.
- De **`rastro-5836ec219.md`** (retención), **`rastro-8f9f31ac0.md`** (pagador manual) y
  **`rastro-ce52dce5f.md`** (grant y addon) **no dejó de ser cierta ninguna**. Lo verifiqué sobre
  los términos de cada uno: el piso de tres capacidades y `listing.inactiva_desde` no tocan la marca
  ni la cortesía; la fecha del próximo cobro la mueve `S10`, que sigue igual; y *«grant vivo»* /
  *«ancla viva»* siguen siendo dos conjuntos con sus nueve consumidores — el inventario de
  `NUCLEO/01` §2.4 **no gana ni pierde una fila**, porque los términos nuevos se fueron a §2.5 y
  §2.6 con inventarios propios, que es lo que `G-R1-F` vigila.

## 6. Preguntas para el owner

1. **Qué se hace con un saldo de cortesía cuya sucesora ABANDONA el checkout.** `S18` corre con la
   sucesora en `PENDING_AUTHORIZATION` cuando la predecesora se muere sola, y desde ahí la sucesora
   puede autorizar (`S2` → `S9` re-emite) **o vencer su ventana** (`S3` → `ABANDONED`). En esa
   segunda rama el beneficiario **no tiene ninguna fila viva en esa vertical**, así que no hay
   obligación de pago que no cobrar — que es la razón exacta con que `DEC-GRANT-004` (2) bloquea
   otorgar sobre una pausa. Las dos respuestas posibles son **cerrar el saldo** (y declararlo) o
   **dejarlo esperando** a que la persona se suscriba de nuevo, que es un instrumento abierto sin
   fecha de cierre — la forma que `B/16` §1.3 rechaza para la vigencia `PERMANENTE`. **No la tomé**:
   queda declarada en `B/09` §3, sexta comprobación.
2. **Un grant que cae sobre una cortesía DIFERIDA.** `B/14` §4.3 dice que *«otorgar un grant termina
   cualquier cortesía vigente»*, y la termina **cancelando la suscripción que pausaba**. Sobre una
   diferida no hay suscripción que cancelar, así que la frase no la alcanza y el saldo sobrevive al
   grant. Puede ser lo correcto —el grant es estrictamente mejor y el saldo no le quita nada— o
   puede ser un instrumento que queda vivo sin que nadie lo mire. **No lo decidí.**
3. **Qué se le muestra al cliente mientras su cortesía está diferida.** `B/19` §3 obliga a mostrar
   las cortesías en *«Mi Suscripción»*, y entre el cierre de la sucesión y la autorización de la
   sucesora la persona **tiene días firmados y no tiene cortesía corriendo**. Decir *«te quedan N
   días»* sin decir desde cuándo corren es la clase de promesa que `NUCLEO/07` §5.3 manda anticipar.
   **No escribí la copy**: es una decisión de producto.
