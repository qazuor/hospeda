---
title: Master Spec 04 — Invariantes
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-20
status: CURRENT
fase: 2
capitulo: 4
---

# 04 · Invariantes

El §64 lista 37 *«invariantes fundamentales»*. Este capítulo hace tres cosas con esa lista:
**dice dónde se hace cumplir cada uno**, **separa los que no son invariantes del sistema**, y
**nombra los que ninguna decisión sostiene todavía**.

Lo que un invariante necesita para existir de verdad es un lugar donde no se pueda esquivar. Un
invariante enunciado y no impuesto es una intención.

---

## 1. Los cuatro lugares donde se hace cumplir algo

| nivel | qué significa | cuándo corresponde |
|---|---|---|
| **base** | una restricción de la base lo impide | cuando el invariante es una propiedad de los datos y **no admite ningún camino que lo esquive** |
| **servicio** | hay **un** lugar en el dominio que lo evalúa | cuando depende de estado resuelto en el momento |
| **guard** | una verificación automática falla en CI | cuando es una propiedad del código, no de los datos |
| **no verificable** | nadie lo comprueba | cuando es una regla de método o una intención; **se declara como tal** |

La regla de reparto: **base antes que servicio, servicio antes que guard, guard antes que
nada.** Bajar un nivel exige una razón escrita, porque cada escalón agrega un camino por donde
el invariante se puede perder.

---

## 2. Los 37 del §64, repartidos

### 2.1 Los que sostiene la base (6)

| # | invariante | restricción |
|---|---|---|
| 1 | trial máximo una vez por `user + vertical` | `UNIQUE(user_id, vertical)` en `trial`, **sin condición de estado** |
| 2 | borrar ficha no devuelve trial | la fila de `trial` no se borra nunca, ni siquiera en el hard delete del día 180 (cap. 02 §4) |
| 8 | máximo una suscripción principal por vertical | **dos** `UNIQUE` parciales sobre los estados vivos, partidos por `sucede_a` (cap. 02 (épica de billing) §2.2). El invariante cuenta **compromisos, no filas** — ver `D15` |
| 11 | una ficha tiene un único dueño | columna no anulable, no tabla de relación |
| 19 | los webhooks son idempotentes | `UNIQUE(proveedor, id_del_hecho)` |
| 26 | producto de addon ≠ instancia de addon | dos tablas, y la instancia no repite ningún campo del producto |

### 2.2 Los que sostiene un servicio (14)

| # | invariante | dónde vive |
|---|---|---|
| 3 | el trial comienza al publicar | la transición T1 del cap. 03, con el evento que declara cada vertical (`DEC-TRIAL-006`) |
| 4 | el trial usa el plan de trial de su vertical | la misma T1 |
| 5 | el plan de trial deriva dinámicamente | **la resolución de limits**, en un solo lugar: derivar → aplicar overrides → comparar contra el piso (`DEC-TRIAL-001`, `DEC-TRIAL-002`) |
| 6 | máximo una ficha en trial | el primer override de esa misma lista (`DEC-TRIAL-001`) |
| 7 | no se compran addons en trial | la condición de A1 (cap. 03 §8) |
| 9 | verticales simultáneas en estados distintos | es una consecuencia del modelo: todo cuelga de `user + vertical` |
| 10 | una acción en una vertical no afecta a otra | **el scope de vertical es estructural**, no un chequeo — capítulo 17. **Y una mitad la sostiene la base**: el ancla de un grant es **por vertical** y su plan pertenece a esa vertical (`B/02` §2.4 y §5). Ahí el cruce venía **adentro de la fuente**, así que la resolución —que sí pide la vertical— no lo podía ver |
| 14 | los servicios validan vertical, acceso, entitlement y limits | la resolución de autorización, capítulo 17 |
| 20 | existe conciliación | capítulo 09 |
| 21 | una divergencia que necesita intervención notifica a `SUPER_ADMIN` **diciendo QUÉ pasó** | `S14`, que **abre una marca `requiere_conciliación` con su motivo** (cap. 02 (billing) §2.5) sin mover el estado. **El motivo es parte del invariante y no un adorno**: notificar ~~quince~~ ~~dieciséis~~ ~~diecinueve~~ veinte casos distintos (el 16 desde `F-8CB1-013`, y el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`, FASE 8 completa, owner 2026-09-25; el 20 desde la pendiente 6) con la misma marca no es *«notificar»* — las que se pierden en el montón son las de los ~~**seis**~~ **siete** motivos que significan *«hay plata del cliente que devolver»* |
| 22 | la cancelación normal conserva el período pagado | S11 + S12, con **nuestra** fecha de fin de servicio (`DEC-SUB-009`). **El adjetivo *«normal»* nombra la baja desde `ACTIVE`, que es la única de las cuatro con un período pagado que conservar**: las otras tres —`S22` desde `PAUSED`, `S23` desde `SUSPENDED` y `S24` desde `GRACE_PERIOD`— van directo a `CANCELLED` con la fecha de fin en el día de la cancelación, porque al pausar los días se perdieron (`DEC-SUB-010`), estando suspendido el servicio ya estaba cortado (§21) y en el grace **el período en curso no está pagado**: su cobro es el que falló (`DEC-SUB-014`). El invariante **no las alcanza y no es una excepción**: no hay período que conservar |
| 23 | sólo los planes mensuales pueden pausarse | `puedePausar()`, un solo lugar (cap. 01 §3) |
| 24 | la pausa puede terminar anticipadamente | S10, el mismo reloj para el fin previsto y el anticipado (`DEC-SUB-010`) |
| 30 | sólo `SUPER_ADMIN` otorga *Free Forever* | la autorización de esa operación, y **también la cortesía temporal** (`DEC-GRANT-002`). **La misma autorización cubre las otras dos escrituras sobre el instrumento** —anclarle una vertical nueva y revocarlo—, que son la misma fila del cap. 08 §3: si «otorgar» fuera la única autorizada, extender un grant a una vertical más quedaría sin gate y `SUPER_ADMIN` dejaría de ser exclusivo por la puerta de al lado |

### 2.3 Los que sostiene un guard (5)

| # | invariante | qué verifica |
|---|---|---|
| 12 | rol ≠ acceso activo | que ninguna autorización decida sólo por rol |
| 13 | rol ≠ entitlement | ídem |
| 15 | toda configuración comercial viene de la base | **reescrito por el cap. 02**: el catálogo de claves es código verificado contra la base en las dos direcciones; ningún valor, precio ni asignación vive en código |
| 16 | los archivos de configuración no son fuente de negocio | el mismo guard que el 15 |
| 32 | Commerce no existe en la arquitectura nueva | el §55 pide eliminarlo de código, esquema, tipos, tests, docs, specs, comentarios y naming; es una búsqueda automática, no una revisión |

**El 15 y el 16 son el mismo invariante enunciado dos veces**, y el cap. 02 explicó por qué su
forma literal es inaplicable: no hay manera de evaluar una capacidad sin nombrarla.

### 2.4 Los que son del programa, no del sistema (7)

| # | invariante | qué es en realidad |
|---|---|---|
| 17 | Hospeda gobierna el dominio | un **principio de diseño**: orienta el reparto de responsabilidades, no se comprueba sobre una ejecución |
| 18 | MP gobierna los hechos ocurridos en MP | ídem; su forma operable es la regla de no-retroceso del cap. 03 §10 |
| 33 | no implementar supuestos sobre MP sin pruebas | **regla de método**: es el §58 y su gate es la matriz de validación |
| 34 | el código legacy dudoso se reescribe | **regla de FASE 5** (`DEC-METH-003`) |
| 35 | sólo se conserva legacy correcto | ídem |
| 36 | la documentación se mantiene desde el minuto cero | **regla del programa** (§3) |
| 37 | cada handoff reconstruye lo realizado | ídem (§3.3, §66) |

**Que el §64 mezcle las dos clases no es un defecto del PDR**: las siete son obligaciones
reales. Lo que sí sería un defecto es tratarlas como si fueran verificables sobre el sistema y
darlas por cumplidas porque nadie las contradijo. **Cinco de las 37 no se pueden comprobar
ejecutando nada.**

### 2.5 Los cinco de *Free Forever* (27, 28, 29) y los dos restantes (25, 31)

| # | invariante | dónde |
|---|---|---|
| 25 | el correo nunca controla una transacción de dominio | capítulo 07, con **una excepción decidida**: `DEC-MAIL-001` bloquea la acción **sólo antes de cancelar**, porque ahí el correo del proveedor hace daño. La excepción está declarada y acotada a un caso — **y no bloquea si no hay destinatario** (rebote duro o cuenta borrada, capítulo 07 §4.2): ahí se cancela y el no-entregable se escala (FASE 8 completa, `F-8CB2-001`, owner 2026-09-25) |
| 27 | *Free Forever* no activa addons automáticamente | capítulo 16 (billing) §3.2. **Intacto, y con una precisión que hace falta desde `S20`**: lo que el grant no hace solo es **encender** un addon que la persona no tiene. Convertir a costo $0 uno que **ya tenía comprado** (cap. 16 §3.4) no activa nada —la capacidad ya estaba andando y la persona ya la había elegido, con plata—: lo único automático ahí es **el fin de un cobro**, y eso el invariante nunca lo prohibió |
| 28 | *Free Forever* puede incluir addons gratis | ídem, por el flag `includesAddons` (§35.2), y **en sus dos direcciones**: habilita a elegir addons gratis (cap. 16 §3.2) y **lleva a $0 los compatibles que ya se estaban pagando** (§3.4). Con el flag en `false` no pasa ninguna de las dos |
| 29 | *Free Forever* puede tener scope parcial o global | ídem, y el scope *«todas las futuras»* se permite sin tope (`DEC-PROMO-002`) |
| 31 | Partner no es self-service | capítulo 18 |

> El 25 merece una nota, porque es el único invariante del §64 que una decisión de este programa
> contradice de frente. El §43 dice *«Si falla mail: acción de dominio permanece»*, y
> `DEC-MAIL-001` decidió que antes de cancelar **sí** bloquea. El motivo está medido: el correo
> del proveedor llega primero, con su marca, y dice *«por un pago no realizado o por opción del
> vendedor»* — o sea que a alguien que canceló por su voluntad le llega un aviso que insinúa
> mora. La excepción **no debilita el invariante en ningún otro punto**: en el resto del sistema
> el correo no bloquea nada.

---

## 3. Los invariantes que agregan las decisiones

El §64 se escribió antes de las 45 decisiones. Éstos no están en su lista y tienen el mismo
peso, porque romperlos rompe algo que ya se decidió:

| # | invariante | de dónde sale | dónde se hace cumplir |
|---|---|---|---|
| D1 | **Una suscripción se ancla a una versión de plan, y moverla es un acto explícito** | `DEC-ARCH-001` | servicio: ninguna lectura de configuración comercial toma valores del plan, siempre de la versión |
| D2 | **Dos versiones vendibles y vigentes no comparten `rank` dentro de una vertical** | `DEC-ARCH-002`, cap. 10 §2 | base |
| D3 | **Una pausa siempre tiene motivo, y el reloj lee el motivo y nunca al proveedor** | `DEC-GRANT-004` | base (dominio cerrado) + servicio |
| D4 | **El candado de idempotencia se persiste ANTES de la primera llamada al proveedor** | `DEC-CONC-001` | servicio; si se genera al reintentar, no hay nada que comparar |
| D5 | **Toda mutación en el proveedor se verifica releyendo y comparando campo por campo** | `EX-20`, `EX-15` | servicio: el código de estado **nunca** cierra una mutación |
| D6 | **El buscador del proveedor no es fuente de verdad de nada** | `RC-1`, `DEC-CONC-002` | servicio: el inventario a conciliar sale de nuestra base |
| D7 | **La suscripción vieja se cancela sólo al recibir el webhook de que la nueva quedó autorizada** — y si para entonces su preapproval **ya está cancelado**, `D7` está cumplido y no se lo vuelve a cancelar (`PA-5`: re-cancelar da `400`) | `DEC-SUB-006` | servicio; al revés, el cliente que abandona el checkout se queda sin nada |
| D8 | **Una fecha de primer cobro futura es la precondición de seguridad de todo cambio de plan o de ciclo.** Toda sucesora nace con fecha de primer cobro **posterior al vencimiento de su ventana de autorización** — **con una sola excepción**: la sucesora de una `SUSPENDED` de pagador con tarjeta cuyo preapproval se releyó `cancelled` cobra al autorizar, porque ahí no hay otro preapproval que pueda cobrar ni crédito que cubra la espera (owner 2026-09-25, `B/12` §5.2) | `DEC-SUB-006` | **base**: la fecha **que el proveedor confirmó** se guarda en `subscription` (cap. 02 §2.2, épica de billing), y un guard la compara contra esa ventana |
| D9 | **El `reason` que se manda al proveedor es copy para el cliente, nunca un identificador interno** | `EX-19`, `DEC-MAIL-001` | guard |
| D10 | **El `init_point` crudo del proveedor no se muestra nunca sin sanear** | `EX-37` | guard |
| D11 | **Lo que toca plata lo confirma una persona** | `DEC-CONC-001`, `DEC-CONC-002`, `DEC-RF-001` | servicio |
| D12 | **El trial no se le pide al proveedor: el reloj del trial es nuestro** | `DEC-TRIAL-002`, cap. 03 §2 | guard + servicio |
| D13 | **Retirar un plan del catálogo no mueve ninguna suscripción** | cap. 10 §3.2 | servicio: retirar publica una versión no vendible y ninguna lectura de suscripción pasa por la vigente |
| D14 | **Anunciada la discontinuación de una vertical, no se emite un cobro más en ella** | cap. 10 §4.2 | servicio: el anuncio cancela en el proveedor en el mismo acto, y el servicio se sostiene del lado nuestro |
| D15 | **Una sucesión es un compromiso, no dos: a lo sumo una sucesora viva por `user + vertical`, y una sucesora no puede ser sucedida.** Y **ninguna sucesión termina sin dejar rastro, con un rastro por forma de terminar**: la que se **cierra** deja `sucedida_por` puesta en la predecesora; la que **muere sin cerrarse** deja la sucesora no viva **con su `sucede_a` escrito**. **Nunca las dos columnas en la misma fila** | cap. 02 (épica de billing) §2.2 | **base**: los dos índices parciales, partidos por `sucede_a`, más las dos columnas anulables que no pueden estar puestas a la vez. **Guard**: `G-R1-C` (cap. 20 (épica de billing) §2) exige que las escrituras del cierre vayan juntas y completas |
| D16 | **El tope de una pausa, en días, es menor que el día del hard delete.** Hoy son **4 pausas-mes** —unos 120 días, cap. 03 §5 (épica de billing)— contra **180** (cap. 02 §4.1, épica de verticales). Es **una de las dos cosas** que impiden que una pausa del catálogo llegue a borrar contenido, porque el reloj de inactividad **no se detiene** durante la pausa: **arranca el primer día de la pausa, ~~cuando `PB2` baja la ficha publicada~~ en toda ficha del dueño en esa vertical, publicada o no (cap. 01 §1.2, hecho 5; FASE 8 completa, owner 2026-09-25)**, y se reinicia recién al reanudar (cap. 01 §1.2, hecho 2). **Las dos cifras son configuración**, así que el invariante es la relación entre ellas y nunca los números. **La otra cosa —que la reanudación ocurra— NO es de este invariante y no la vigila `G-R5`**: la vigilan la rama de fallo de `S10` y la quinta comprobación de cero llamadas de `B/09` §3 | `F-8cC1-001`, la decisión del owner del 2026-09-21 | **guard**: compara el tope de pausa del catálogo contra el día del hard delete y falla si el primero lo alcanza |
| D17 | **Lo que dice el proveedor no se escribe ni se actúa sin releerlo por id, y se lee el campo que dice la verdad.** Son tres entradas y ninguna se salva: **un webhook es un aviso** y se relee el recurso (cap. 03 §10.1, épica de billing); **una mutación nuestra** se confirma releyendo (`D5`); y **un job que actúa por nuestro reloj** sobre algo que depende del estado del proveedor **le pregunta antes de actuar** (`S3`, `S6`). *«¿Cobró o no?»* se contesta **sólo** con la lectura del cap. 09 §4 (épica de billing). **Una excepción declarada**: el barrido de creaciones sin respuesta busca ~~por correo del pagador y estado~~ **filtrando en el proveedor sólo por correo del pagador, y el estado de nuestro lado** —el filtro `status` devuelve un subconjunto en producción (`RC-1`; FASE 8 completa, `F-8CB3-011`, `F-8CB2-014`, `F-8CB1-014`)—, porque es la única forma de encontrar lo que nunca registramos (`DEC-CONC-001`, cap. 05 §1.2, épica de billing). **Y la comparación de cambios sin aviso del barrido lee `last_modified`, no `version`**: la lectura por id no trae `version` (`RC-9`; `F-8CB3-010`) | pedido del owner, 2026-09-24 · `RC-1`, `RC-2`, `RC-5`, `EX-20` | servicio |

**`D16` existe porque la alternativa era una premisa que envejece sola.** El arreglo de
`F-8cC1-001` se apoya en una desigualdad entre dos números —120 y 180— que hoy es verdadera y que
**nadie vuelve a mirar el día que alguien suba el tope de pausa a siete meses**. Es el quinto modo
que `DEC-METH-010` declara no cubierto por ninguna búsqueda de texto: el texto es correcto el día
que se escribe. La única forma de que no caduque en silencio es que la desigualdad la verifique
algo en cada PR, y por eso el apoyo es un guard y no una nota.

**Y hasta la FASE 8 completa `D16` era verdadero como comparación y falso como protección**
(`F-8CA2-001`, `F-8CA3-001`). Comparaba bien las dos cifras, pero sobre una premisa —*«el reloj
arranca el día que empieza la pausa»*— que ninguna escritura hacía verdadera: la columna guardaba
**el último reinicio**, que en una ficha publicada y cubierta escribe la relectura de `PB4` y puede
tener hasta 90 días en el instante de la caída. La cuenta real era `120 + 90 = 210 > 180`, y `G-R5`
daba verde por construcción. **Desde el hecho 5 del cap. 01 §1.2 (owner 2026-09-25) `PB2` escribe
`listing.inactiva_desde` en el instante en que baja la ficha por perder la cobertura**, así que el
reloj arranca el primer día de la pausa y la desigualdad que `D16` compara es la que de verdad
protege. ~~**Su alcance es la ficha que estaba publicada cuando la pausa empezó**: la que ya estaba
abajo —el excedente de un dueño cubierto, el borrador— no pasa por `PB2` y su reloj sigue
guardando el último reinicio; eso queda abierto en el cap. 01 §1.2 y `D16` no lo cubre.~~ **Y su
alcance es toda ficha del dueño en esa vertical** (FASE 8 completa, owner 2026-09-25): el hecho 5
pasó a ser *«el dueño pierde la cobertura en la vertical»* y se escribe en todas, y a la que ya
estaba abajo —el excedente de un dueño cubierto, el borrador— se lo escribe el recálculo que el
aviso despierta, sin pasar por `PB2`. **Por eso ahora alcanza**: la desigualdad que `D16` compara
parte del primer día de la pausa, y ese día es el valor de la columna en **todas** las fichas que
el borrado puede tocar, no sólo en la publicada. Lo que sigue sin cubrir no es de alcance sino de
disparo —si el aviso de la caída se pierde, nadie escribe el hecho 5— y está en el ⚠️ del cap. 01
§1.2, puntos 2 y 3.

**Y `D16` tiene un alcance exacto que conviene no estirar: compara dos cifras de CATÁLOGO, no el
tiempo que una fila lleva pausada.** El arreglo de `F-8cC1-001` descansa sobre **dos** premisas
—la desigualdad *«120 < 180»* y *«cada reanudación reinicia»*— y de las dos, **`D16` sólo cubre
la primera**. Una pausa que vence y **no reanuda** deja la fila en `PAUSED` con el reloj de
verticales corriendo hacia el día 180, y `G-R5` sigue en verde con toda razón: las dos cifras que
compara no cambiaron. La segunda premisa es la única que depende de que un job corra, así que se
vigila donde eso se puede ver —la **rama de fallo de `S10`** y la **quinta comprobación de cero
llamadas** del cap. 09 §3 (épica de billing)— y no acá. Leer `D16` como si cubriera las dos es
exactamente el modo que el invariante vino a cerrar, con el sujeto cambiado.

**`D15` afirmaba más de lo que el diseño cumple, y se corrigió hacia abajo.** Decía *«toda
sucesión que termina deja escrito que ocurrió: la predecesora queda con `sucedida_por` puesta»*, y
la única escritura de esa columna es `S18`. De las **seis** formas de terminar que `B/12` §5.3
enumera, `S18` corre en **cuatro** —la sucesora autoriza; la sucesión trabada que una persona
resuelve por `S15`; la baja que **decide el proveedor** sobre la predecesora, que desde la
FASE 9-bis-3 es la rama 5 y entra por el espejo de `B/03` §10.1; y la baja que **pide la propia
predecesora**, que desde la FASE 9-bis-4 es la rama 6 y entra por `S23` **o por `S24`**, según
esté suspendida o en el grace (`DEC-SUB-014`)—; en
las otras dos **no corre**:
si la sucesora vence su ventana (`S3`) o si le cae un grant (`S13`), no queda sucesora viva a la
que pasarle el origen y `sucedida_por` **no se escribe nunca**. Un invariante sobre-enunciado es
peor que uno ausente,
porque quien lo lee **deja de buscar el caso** — y el caso que dejaba de buscarse es *«la sucesora
se murió y el puntero quedó puesto»*, que costó dos `CRITICA` en la misma pasada. (`S18` corre
además cuando la predecesora se muere sola por `S12` o por `S16`, desde la FASE 9-bis-3, y esos
dos caminos **no están entre las seis** —y `S22` tampoco, que es el tercero de la misma clase—
porque las seis de `B/12` §5.3 enumeran el destino de un
**pago pendiente por `S19`**, que sólo existe sobre una predecesora en `GRACE_PERIOD` o
`SUSPENDED` — y `S12` sale de `CANCEL_SCHEDULED`, `S16` de `ACTIVE` y `S22` de `PAUSED`. Escriben
la columna igual.)
El enunciado de hoy cubre las seis ramas porque **nombra los dos rastros**, y los dos son
legibles después:
`sucedida_por` no se borra nunca, y el `sucede_a` de una fila no viva tampoco lo limpia nadie —es
el cuarto estado de la relación de `B/03` §3.2, y `S13` lo llama *«el registro fiel de lo que
pasó»*.

**Y el apoyo dice ahora lo que la base hace de verdad.** Los dos índices parciales hacen cumplir
*«a lo sumo una sucesora viva»* y la restricción de las dos columnas hace cumplir que no convivan;
**ninguna restricción puede obligar a que una columna se escriba**, así que la mitad del rastro es
del guard y no de la base. Decirlo importa porque `G-R1-C` **se cumple de forma vacua cuando no
ocurre ninguna de las dos escrituras**, y con el enunciado viejo eso era exactamente el estado que
`D15` declaraba imposible.

**`D8` subió de nivel, y el motivo es el que el §1 usa para todo lo demás.** Era un invariante *de
servicio*, o sea recordable: sin una columna que guardara la fecha con la que nació la fila no había
forma de comprobar que se cumplió **ni de escribir el guard**, y su incumplimiento **es
literalmente el doble cobro**. El §1 define el nivel «base» como el que **no admite ningún camino
que lo esquive**, y ése es el nivel que corresponde a la precondición del mecanismo más caro del
sistema. Releer la fecha del proveedor no era alternativa: lo prohíbe `D6` y además un guard tiene
que poder correr sin red.

**D5, D9 y D10 son las tres que más se parecen entre sí y no lo son.** D5 es sobre *verificar*
después de escribir; D9 y D10 son sobre *qué se manda* y *qué se muestra*. Las tres existen
porque este proveedor tiene el mismo modo de falla —acepta y no aplica, o devuelve algo que
parece válido y no lo es— en tres momentos distintos.

---

## 4. Lo que ningún invariante cubre todavía

Tres cosas que el §64 no nombra, que ninguna decisión resolvió, y que **no se completan acá**
(§67):

1. **Qué pasa cuando una suscripción principal muere y quedan complementos vivos.** El §41 dice
   que un addon se cancela *«solo cuando queda efectivamente huérfano»*, y con `DEC-ADDON-002`
   cada addon recurrente es una suscripción aparte que **no se cancela sola**. Es `E-ADDON-04`,
   capítulo 16.
2. ~~**Qué hace el sistema con una vertical discontinuada.**~~ **Cerrado por el capítulo 10 §4**,
   y dejó los invariantes `D14` y `D13` arriba.
3. **Si el silencio del cliente vale como aceptación de un aumento.** Es `M-LEGAL-03`, y
   **cambia el diseño, no la redacción**: si no alcanza, `DEC-MP-002` necesita aceptación activa
   y a quien no responda no se lo puede aumentar. Capítulo 22, y pide revisión profesional.

---

## 5. El resumen del reparto

| nivel | cuántos del §64 | cuántos de las decisiones |
|---|---|---|
| base | 6 | **4** |
| servicio | 14 | **11** |
| guard | 5 | **6** |
| principio o regla de método, **no verificable ejecutando** | 7 | 0 |
| en un capítulo de subdominio | 5 | 0 |
| **total** | **37** | **17** |

> Las celdas de la columna derecha suman **21 apoyos** sobre **17 invariantes**, y no es un error
> de conteo: **`D3`, `D8`, `D12` y `D15` se sostienen en dos niveles a la vez**. `D3` necesita que
> la base restrinja el dominio del motivo **y** que el servicio lo lea en vez de leer al
> proveedor; `D8` necesita la columna en base **y** el guard que la compara; `D12` necesita un
> guard que impida pedirle un trial al proveedor **y** un servicio que lleve el reloj; `D15`
> necesita los dos índices parciales **y** el guard que exige que las escrituras del cierre vayan
> juntas. Un invariante con dos apoyos no está contado de más: está apoyado dos veces.

**Cincuenta y cuatro invariantes, y diez los sostiene la base.** El resto depende de que exista un
único lugar donde se evalúen — que es, en una línea, de qué se trata el §7.

> **Corregido otra vez el 2026-09-19 — FASE 8-bis**, y la corrección anterior es el ejemplo de
> cómo NO hacerlo. La FASE 9 hizo **dos** cambios sobre el §3: agregó `D15` (14 → 15 filas) y
> **mudó `D8` de servicio a base, dándole además un guard**. Corregir sólo lo que un informe
> señala —base 2 → 4 y total 14 → 15— habría dejado la tabla sumando **18 apoyos sobre 15 con la
> columna de servicio en 11**, o sea mal de nuevo, porque `D8` **se mudó, no se agregó**.
>
> **Los conteos se recorren enteros con un script, o no se tocan.** Éstos salen de recorrer las 15
> filas del §3 clasificando su columna de apoyo: base `D2 D3 D8 D15`, guard `D8 D9 D10 D12 D15`, y
> las diez restantes servicio. La columna izquierda no se movió y cierra: 6+14+5+7+5 = 37.
>
> **Recorrido otra vez el 2026-09-21 — FASE 9-bis-2.** `D15` pasó de tener **un** apoyo a tener
> **dos**: sigue apoyado en la base —los dos índices parciales, más la columna `sucedida_por`— y
> gana un guard, `G-R1-C`, que exige que las dos escrituras del cierre de la sucesión vayan en el
> mismo acto. Recorrí las 15 filas otra vez y **lo único que se mueve es la lista de guards**, que
> pasa de cuatro a cinco: `D15` se agrega a `D8 D9 D10 D12`. **La base sigue en cuatro** —`D15` ya
> estaba—, y por eso *«diez los sostiene la base»* y *«cincuenta y dos invariantes»* **no cambian**.
> Los apoyos totales pasan de 18 a 19 sobre las mismas 15 filas, y la columna de servicio sigue en
> diez: `D1 D3 D4 D5 D6 D7 D11 D12 D13 D14`.
>
> **Recorrido otra vez el 2026-09-21 — FASE 9-bis-3, y NINGÚN conteo se mueve.** Lo que cambió en
> `D15` es **el enunciado**, no su apoyo: sigue en base + guard, así que las 15 filas, los 19
> apoyos, las cuatro de base, las cinco de guard y las diez de servicio quedan igual. Se recorrió
> igual, porque un enunciado que se corrige es exactamente el caso en que alguien asume que el
> conteo se movió y lo «arregla» sin recorrer.
>
> **Recorrido otra vez el 2026-09-21 — FASE 9-bis-3, al agregar `D16`**, y el recorrido encontró
> algo que las dos notas de arriba no vieron: **las dos correcciones anteriores se escribieron en
> la nota y no en la tabla.** Las dos declaran **19 apoyos** y **cinco guards** desde que `D15`
> ganó `G-R1-C`, y la fila de la tabla seguía en **cuatro** y el párrafo de abajo en *«18 apoyos
> sobre 15»* con **tres** invariantes de doble apoyo. Es el modo que este mismo capítulo
> documenta: corregir donde se mira y no donde se lee. Se arregla en el mismo acto. Recorridas
> las **16** filas del §3 clasificando su columna de apoyo: base `D2 D3 D8 D15` (4), guard
> `D8 D9 D10 D12 D15 D16` (6), y las **diez** restantes servicio
> `D1 D3 D4 D5 D6 D7 D11 D12 D13 D14`. Suman **20 apoyos** sobre 16, con **cuatro** filas de doble
> apoyo —`D3 D8 D12 D15`—. El total de la derecha pasa de 15 a 16 y *«cincuenta y dos»* a
> **cincuenta y tres**; *«diez los sostiene la base»* **no cambia**, porque `D16` es guard. La
> columna izquierda no se movió y cierra: 6+14+5+7+5 = 37.
>
> **Recorrido otra vez el 2026-09-24, al agregar `D17`.** `D17` tiene **un** apoyo, servicio: ningún
> guard puede ver si un job le pregunta al proveedor antes de actuar. Recorridas las **17** filas
> del §3: base `D2 D3 D8 D15` (4), guard `D8 D9 D10 D12 D15 D16` (6), servicio
> `D1 D3 D4 D5 D6 D7 D11 D12 D13 D14 D17` (11). Suman **21 apoyos** sobre 17, con las mismas
> **cuatro** filas de doble apoyo. El total de la derecha pasa de 16 a 17 y *«cincuenta y tres»* a
> **cincuenta y cuatro**; *«diez los sostiene la base»* **no cambia**. La columna izquierda cierra
> igual: 37.

Y la corrección anterior, que queda como registro:

> **Corregido el 2026-09-19 — FASE 8** (`F-8A1-016`, `F-8A3-016`, `F-8C1-012`). Estas dos frases
> decían **«suma 14 sobre 12»** y **«Cuarenta y nueve»**, y las dos son **anteriores a `D13` y
> `D14`**, que el §4 de este capítulo declara agregados al cerrar el capítulo 10 §4. Al agregarlos
> se actualizaron las celdas de la tabla y su total, y no estas dos líneas. La aritmética que
> dirime: la tabla del §3 tiene **14 filas** (`D1`…`D14`), 37 + 14 = **51**, y el «ocho los
> sostiene la base» lo corrobora (6 de la izquierda + 2 de la derecha). Cuatro de los ocho
> informes de FASE 8 dijeron 49 y dos dijeron 51: **dirimió la aritmética del documento, no la
> mayoría**.
