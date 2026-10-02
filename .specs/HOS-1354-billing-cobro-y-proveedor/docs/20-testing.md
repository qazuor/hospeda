---
title: Master Spec 20 — Estrategia de testing
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-30
status: CURRENT
fase: 2
capitulo: 20
---

# 20 · Estrategia de testing

Mitad **BILLING** del capítulo 20 del programa. La otra mitad vive en la otra épica.

El §62 abre diciendo que *«testing forma parte del diseño desde el comienzo»* y reparte el trabajo
en cuatro capas. Este capítulo dice **qué va en cada una** y, sobre todo, resuelve las dos cosas
que el §62 deja sin decir y que deciden si la suite sirve:

- **qué tiene que mentir el proveedor falso** (§3), porque uno que se porte bien no prueba nada
  sobre el código que tiene que sobrevivir al real;
- **qué son exactamente los guards** que los capítulos anteriores fueron dejando (§2), que hoy
  están repartidos en siete lugares.

---

## 1. Las cuatro capas

| capa | qué cubre | contra qué corre |
|---|---|---|
| **dominio e integración** (§62.1) | los escenarios funcionales: estados, transiciones, trial, billing, grace, pausa, cancelación, upgrade, downgrade, promo, cortesía, grant, addons, entitlements, limits, autorización, conciliación, **carreras** e **idempotencia** | base real, proveedor falso |
| **guards** | propiedades del **código**, no de una ejecución | el árbol de fuentes, en CI |
| **sandbox del proveedor** (§62.3) | *«suite real más pequeña pero obligatoria»* | Mercado Pago sandbox |
| **E2E** (§62.4) | *«los flujos críticos que hoy requieren smoke manual»* | el sistema entero |

**El §62.1 dice algo que conviene no suavizar: *«cubrir 100 % de escenarios funcionales
relevantes. No obsesionarse con 100 % lines»*.** Un porcentaje de líneas se sube ejecutando
código sin afirmar nada sobre él; un escenario faltante es un caso que nadie pensó. Las dos
métricas no miden lo mismo y sólo una importa.

---

## 2. Los guards, en un solo lugar

Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| G7 | un valor comercial vive **en código** | invariantes §64.15 y §64.16 |
| G9 | el `reason` que se manda al proveedor es **un identificador interno** y no copy para el cliente | `D9`, `EX-19` |
| G10 | un `init_point` del proveedor se muestra **sin sanear** | `D10`, `EX-37` |
| G11 | se le pide un **trial al proveedor** | `D12` |
| G12 | se importa el **SDK de la pasarela fuera del adaptador** | `DEC-ARCH-004`, condición A. Lo construye `B1` (`B/descomposicion.md` §2) |
| ~~G13~~ | ~~la implementación **de arranque** de `cobertura()` llega a producción~~ | ~~[contrato](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3. Lo construye `B4` (`B/descomposicion.md` §2), que es donde aparece la segunda implementación — **no puede nacer en `V4`**, porque mientras la de arranque es la única, un guard que prohíba su llegada a producción falla desde el primer día~~ **La fila pasó a `V/20` §2 y lo construye `V4`, como dice el contrato §6.3** (owner 2026-09-26, `G5-5`): el guard falla sobre un build destinado a producción, no sobre la rama, así que no falla desde el primer día. Esta fila ya no cuenta en este catálogo |
| G-R1-A | **el camino que declara una sucesión** escribe `sucede_a` apuntando a una predecesora que **en ese acto** está fuera de ~~`{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`~~ **`{ACTIVE, CANCEL_SCHEDULED}`** —`GRACE_PERIOD` salió del conjunto: desde el grace no se declara una sucesión (`DEC-SUB-021`, owner 2026-09-25)— **y no es una `SUSPENDED` de pagador con tarjeta cuyo preapproval se releyó por id como `cancelled`** —la única `SUSPENDED` admitida; la de pagador manual y toda `PAUSED` siguen afuera (FASE 8 completa, `F-8CB1-002`, owner 2026-09-25)—, **o a una `ACTIVE` de pagador con tarjeta cuyo preapproval no se releyó por id como `authorized` en ese acto** (FASE 8 completa, owner 2026-09-25: la `ACTIVE` que el proveedor ya pausó por mora sin que nos llegara el webhook), o a una que a su vez tenga `sucede_a` no nulo | cap. 02 §2.2, cap. 03 §3.2 (`S1`, **`S6`**, **`S7`**) y §3.3.1, `DEC-SUB-019`, **`DEC-SUB-021`** |
| G-R1-B | una fila con `sucede_a` no nulo **no** nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización, **o esa fecha no es la que el proveedor confirmó** — **salvo** que su predecesora sea una `SUSPENDED` de pagador con tarjeta cuyo preapproval se releyó `cancelled`, la misma condición que lee `G-R1-A`: esa sucesora cobra al autorizar (`D8`, excepción del owner 2026-09-25) | `D8`, cap. 12 §5.2, cap. 02 §2.2 |
| G-R1-C | un camino escribe **`sucedida_por` sin limpiar `sucede_a`**, o limpia **`sucede_a` sin escribir `sucedida_por`**, o **cierra una sucesión dejando algo colgando de la predecesora**: un complemento ~~o la **redención de promo**~~ sin re-apuntar —la redención **no** se re-apunta desde la pendiente 7 de la FASE 8 completa (owner 2026-09-25): la promo se pierde con el cambio de plan, `B/14` §2.2—, **o una cortesía vigente sin cerrar y sin `saldo_meses`** —ésa **no** se re-apunta, `DEC-GRANT-007`—, o un **pago pendiente por `S19` sin una marca `requiere_conciliación` abierta con motivo `REEMBOLSO_POR_CONFIRMAR`** —la marca sin el motivo **pasaba el guard y no ordenaba nada**—; ~~**o `S25` mata una `PAUSED · COURTESY` con cortesía sin entregar y no le escribe el `saldo_meses`** (`DEC-GRANT-010`)~~ (sale con `S25`: revisión del owner, 2026-09-28, C8) | `D15`, cap. 03 §3.2 (`S18` ~~y `S25`~~), cap. 02 §2.2, §2.5 y §2.6, `DEC-RF-002` |
| G-R1-D | un camino **reactiva** una fila —`S5`, `S7`, el efecto de `MP1` o **el de `MP4`**— que en ese instante es la **predecesora de una sucesión en curso** (tiene una sucesora **viva** con `sucede_a` apuntándola), o **reembolsa** el pago que quedó pendiente por `S19` **antes** de que la sucesión se resuelva | cap. 12 §5.3, cap. 03 §3.2 (`S5`, `S7`, `S19`) y §7.1 (`MP4`), cap. 05 §3 condición 3 |
| G-R1-E | un **predicado sobre `sucede_a`** —en la columna *condición* de una transición, en el enunciado de un invariante o en otro guard— pregunta si **hay una fila apuntando** sin exigir que esa fila **esté viva**; o un consumidor nuevo de *«fila viva»*, *«grant vivo»* o *«ancla viva»* **no figura** en el inventario que le corresponde en `NUCLEO/01` §2.4 —son **dos** inventarios y cada término va al suyo—; **o enumera el conjunto del sujeto equivocado** —los seis de la suscripción sobre una instancia de addon, o los dos de la instancia sobre una suscripción— | `NUCLEO/01` §2.4 reglas 2 y 3, cap. 02 §2.2, cap. 03 §3.2 (`S17`, `S19`, **`S20`** — el único que nombra **los dos** sujetos en un mismo predicado — y **`S21`**, que nombra la suscripción por su conjunto **vivo** y la instancia por un estado **terminal**, que es el caso en que el guard tiene que no pedir la enumeración de los dos) y §8 (`A5`) |
| G-R1-F | un camino **abre la marca `requiere_conciliación` sin nombrar un motivo** de la enumeración cerrada del cap. 02 §2.5, o nombra **uno que no está en esa tabla**; o un camino **levanta** la marca sin decir **cuál** de las abiertas; o el **listado accionable** (cap. 19 §6) la muestra **sin motivo, sin `puesta_en`, sin TODOS los pagos que lleva colgados, sin su monto total o sin el default de `DEC-RF-003`** cuando el motivo es uno de los ~~**seis**~~ ~~**siete**~~ ~~**ocho**~~ **nueve** que devuelven plata (el séptimo, `COBRO_DUPLICADO`, desde la pendiente 6 de la FASE 8 completa, owner 2026-09-25; el octavo, `ORDEN_PAGADA_SIN_INSTANCIA`, desde la FASE 9 vuelta 2, `R4`; el noveno, `IMPORTE_COBRADO_DE_MÁS`, desde la misma vuelta, `R20`) — **y desde `DEC-RF-006` esa cláusula los alcanza a todos sin excepción**, porque el caso que `DEC-RF-004` había dejado afuera de la columna es hoy el motivo **15** y lleva su `SÍ` propio (cap. 02 §2.5); **o `S21` abre los DOS motivos que le tocan —el 14 y el 15— sobre la misma suscripción**: son motivos distintos, así que el `UNIQUE(subscription_id, motivo)` **no los excluye** y la base los aceptaría, dejando dos propuestas contradictorias sobre el mismo pago — lo que los mantiene separados es que el disparador es **uno solo**, y el argumento está en cap. 02 §2.2; **o un camino que escribe un hecho con plata sobre una fila que ya tiene una marca abierta de ese mismo motivo no lo CUELGA de ella** —abrir una segunda, descartar el hecho o dejar que el `UNIQUE` lo rechace son las tres formas de perderlo (cap. 02 §2.2)—; **o un camino levanta una marca con algún pago colgado sin resolver** (cap. 03 §3.2, `S15`); **o un consumidor nuevo de *«marca abierta»* (`NUCLEO/01` §2.5) o de *«cortesía diferida»* (§2.6) no figura** en su inventario —son el **tercer** y el **cuarto** inventario del glosario y **ninguno** es de `G-R1-E`—; **o un camino CIERRA el saldo de una cortesía diferida sin escribir las DOS columnas del cierre** —`saldo_cerrado_en` y un `motivo_cierre` de la enumeración cerrada del cap. 02 §2.4—, **o lo cierra desde un acto que esa enumeración no nombra**: es la mitad que hace cumplir que otorgar un grant **no** cierre un saldo diferido (cap. 14 §4.3, `DEC-GRANT-011`) | cap. 02 §2.2, §2.4 y §2.5, cap. 03 §3.2 (**`S3`**, `S14`, `S15`, `S18`, **`S21`** ~~, **`S25`**, **`S27`**, **`S28`**~~; revisión del owner, 2026-09-28, C8), cap. 09 §3, cap. 14 §4.3, **cap. 16 §4.3**, cap. 19 §6, `NUCLEO/01` §2.5 y §2.6, `DEC-RF-002`, `DEC-RF-003`, **`DEC-RF-006`**, `DEC-GRANT-011` |
| **G-R6** | una **condición de transición lee una columna que NINGUNA transición escribe**. El guard recorre cada condición de las tablas de transiciones de **las ~~nueve~~ diez máquinas, en las dos épicas** (la décima, el reembolso de `B/03` §6.1: owner 2026-09-25, FASE 9 completa, 5a), extrae las columnas que lee y exige que **al menos una transición del corpus las escriba** — donde *«el corpus»* son **las tablas que los capítulos declaran**, nunca el subconjunto ya construido, o el guard nace en rojo sobre el camino normal entre `B5` y `B8` | `DEC-TEST-001` y su ampliación del mismo día, cap. 03 §7.2 (`MP5`), `F-8eB1-002`. **Referencia cruzada**: figura también en `V/20` §2, que escribe la razón de la ampliación — ahí vive `listing.inactiva_desde`, la columna sobre la que se decide el borrado irreversible |
| **G-R6-B** | **las ~~dos~~ tres mitades de la lista cerrada de `listing.inactiva_desde`, con ~~tres~~ cuatro predicados**: una **escritura**, de la columna **o de `listing.plazos_version`** (caso 48), que no sea uno de los **~~cuatro~~ ~~cinco~~ ~~seis~~ cinco hechos** del `NUCLEO/01` §1.2 (el 4 salió con la revisión del owner, 2026-09-28, C8; el sexto, `PB11`, owner 2026-09-25; FASE 9 completa, 5b) **ni la escritura `C` del corte**; una **lectura** que no figure entre los **~~cinco~~ seis consumidores** del `V/02` §2.5; o **uno de esos ~~cinco~~ seis que ya no lee** la columna (FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, `F-8CD1-009`, owner 2026-09-25); **y, con un cuarto predicado, un lector que decide archivar, borrar o avisar y no consulta `retenciónDetenida`** **o no cuenta desde el más tardío de los dos instantes** (verificación corta, 2026-09-29, VC-VT-05) (revisión del owner, casos vecinos, 2026-09-29, caso 16). **El mensaje nombra el predicado que falló** | `DEC-TEST-001`, **tercera y cuarta enmiendas** del mismo día; `V/02` §2.5. **Referencia cruzada**: lo define `V/20` §2, donde vive la columna. Figura acá porque **lo que puede romper la lista se escribe en esta épica**: el §4.3 del cap. 10 es donde está escrito que el reloj *«arranca acá, no antes»* —el cuarto hecho— **y, desde esta pasada, quién lo escribe: el barrido del día del fin de servicio, que es la única escritura de `listing.inactiva_desde` que sale de esta épica**; y el §7.1 del cap. 03 apoya el tope de la reapertura en que la lista **sea** cerrada |
| G-R4 | una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** | cap. 03 §1 regla 7 (núcleo). **Referencia cruzada**: lo define `V/20` §2 y cubre las **cuatro** tablas de transiciones de esta épica —`S`, `P`, `MP` y `A` del cap. 03; grace y pausa son sub-estados de suscripción sin tabla propia— (decía «seis»; recontado el 2026-09-25, FASE 8 completa, `F-8CD1-016`). El catálogo de guards es una sola numeración partida en dos capítulos, así que un guard del núcleo tiene que figurar en los dos o la mitad de su dominio queda sin vigilar en el papel |
| ~~G-R5~~ | ~~el **tope de una pausa** que declara el catálogo, pasado a días, **alcanza el día del hard delete** de la retención~~ | **retirado** (revisión del owner, 2026-09-28, C14, `L1-c`): la pausa pedida por el dueño detiene el reloj de retención, así que el tope de pausa ya no tiene que quedar por debajo del día del borrado y el guard se queda sin sujeto; sale con `D16`. El número no se reusa |
| **G15** ✚ | **las dos listas del proveedor falso, con dos predicados**: (a) el falso **miente en un lugar que no está en la lista cerrada de mentiras del §3.2**, o una fila de esa lista **no tiene los tres datos**: su nombre, la fila de la matriz de la que sale (con fecha y cuenta) y la prueba que demuestra que el código la resiste; (b) una prueba **apaga una mentira sin nombrarla o sin decir por qué**. **El mensaje nombra el predicado que falló** | revisión del owner, 2026-09-28, C13 y `L3-c` (§3.2). Lo construye `B1` |
| **G16** ✚ | **el cobro vuelve a depender de lo que dejó**, con dos predicados: (a) aparece **`@qazuor/qzpay`**, cualquiera de sus paquetes, en un `package.json` o en un import ~~del repo~~ ~~**del package del cobro** (su `package.json` y sus imports: verificación corta, 2026-09-29, lote M-D)~~ **del repo** (verificación corta, 2026-09-29, lote N-A); (b) el package del cobro **importa de `apps/`**. **El mensaje nombra el predicado que falló** | revisión del owner, 2026-09-28, N2 (`B/spec.md` §3.1). Lo construye `B1`. **Que el package del cobro no importe de la mitad de verticales ya lo vigila `G14`** (`V/20` §2), y no se duplica acá. **No mira sus dependencias hacia packages internos de Hospeda** (`@repo/*`): el package del cobro puede tenerlas, con la regla del owner de evitarlas cuando sea simple; la prohibición de `qzpay` sigue (revisión del owner, casos vecinos, 2026-09-29, caso 30). ~~**Mira el package del cobro y no el repo**: el sistema viejo corre con `qzpay` hasta el corte, y medido el 2026-09-29 lo declaran cinco `package.json` del repo (`apps/api`, `apps/admin`, `packages/billing`, `packages/db` y `packages/service-core`), así que sobre el repo el guard nacía rojo; salen cuando el cobro viejo sale del repositorio, después del corte (`16-fase-7…` §4.5, punto 3; verificación corta, 2026-09-29, lote M-D)~~ **Mira todo el repo desde que nace** (verificación corta, 2026-09-29, lote N-A): el cobro viejo, con los cinco `package.json` que declaraban `qzpay` el 2026-09-29 (`apps/api`, `apps/admin`, `packages/billing`, `packages/db` y `packages/service-core`), sale de la rama en la limpieza del principio, antes de `B1` (`16-fase-7…` §4.6), así que el guard nace verde y sin lista de pendientes. El sistema viejo sigue cobrando en producción desde `main` hasta el paso 3 del corte, y `main` no pasa por este guard hasta que el corte la reemplaza |
| **G17** ✚ | **una decisión sale de lo que dice un aviso del proveedor sin releerlo por id**, con ~~dos~~ tres predicados: (a) el código que recibe un aviso, por cualquiera de los dos canales, **lee del cuerpo otra cosa que el tipo de recurso, su id y su `version`** (la `version` es la que descarta un aviso viejo, `B/03` §10.1, y no es estado); (b) una transición de las tablas de `B/03` o una acción administrativa de `NUCLEO/08` §3 cuya condición depende del estado del proveedor **recibe ese estado por otro camino que una lectura por id del adaptador**, el tipo que sólo el adaptador construye; **(c) algo lee ~~`ipn_delivery`~~ `provider_notification`**, la tabla donde el receptor guarda las entregas ~~del canal IPN~~ de los dos canales, IPN y Webhooks, cada una con su canal (`B/02` §2.7): la escriben sólo el receptor y el borrado de sus 180 días, y ninguna transición, acción administrativa, barrido ni otro código la lee, **tampoco el receptor, ni para la entrega de Webhooks que procesa** (mediciones del 2026-09-29, M-2; los dos canales y el nombre, lote L-B). **El mensaje nombra el predicado que falló**. **El *cuándo* no es ~~un tercer~~ otro predicado: va dentro del tipo** (revisión del owner, casos vecinos, 2026-09-29, caso 35). Cada lectura por id lleva el instante en que se leyó, y el tipo sólo entrega el estado contra el comienzo del acto que decide: una lectura anterior a ese comienzo se rechaza y hay que releer. Con eso (b) alcanza, porque el único camino al estado ya exige el instante; el rechazo lo prueba un caso de `B1`, no el guard | `D17` y su quinta entrada (`NUCLEO/04` §3; revisión del owner, 2026-09-28, N4 y `L3-f`). Lo construye `B1` |

**`G15`, `G16` y `G17` llegaron con la revisión del owner (2026-09-28), y los tres son de `B1`**,
porque vigilan lo que `B1` construye primero: el falso y sus dos listas (§3.2), el package del
cobro ~~que se puede publicar solo~~ sin `qzpay` (`B/spec.md` §3.1; caso 30), y la frontera por la que entra todo lo que el
proveedor dice (el adaptador). **Lo que cada uno NO verifica, dicho para que nadie lo lea de más**
(§2.1): `G15` comprueba que cada mentira **tenga** su medición y su prueba, no que la medición siga
siendo cierta (eso lo vigila la batería del §4.1); `G16` no mira las dependencias del package del
cobro hacia otros packages compartidos del monorepo, **y es a propósito: puede tenerlas** (caso
30); y `G17` comprueba **de dónde sale** el estado con que se decide, no **cuándo** se leyó: ~~una
lectura por id vieja pasa en verde, y que se relea en el mismo acto sigue siendo la regla de
`D17`, sin guard~~ **el cuándo lo impone el tipo, que rechaza una lectura anterior al comienzo del
acto** (caso 35; `D17`). **El comienzo del acto es el de la decisión sobre ese sujeto, no el de la
corrida**: un proceso nocturno que leyó 500 suscripciones a las 3:00 y llega a la de Juan a las
3:40 la tiene que releer. **Y queda un límite, declarado**: entre releer y actuar hay una ventana
de milisegundos que el tipo no cierra, porque Mercado Pago no ofrece compare-and-swap; la cubre
el barrido diario (`B/09`). **Tampoco mira las pantallas**: mostrar el
estado local no es decidir, y ninguna pantalla decide.

**Los SEIS de `R1` son la contracara de las dos claves y de la marca, y conviene decir qué impide
cada uno.** *(Eran cinco hasta la FASE 9-bis-4. `G-R1-F` llegó con el motivo de la marca y es el
único de los seis cuyo sujeto no es `sucede_a` sino `reconciliation_mark`; está acá y no en otro
racimo porque la marca que más caro sale sin motivo es **la que `S18` abre al cerrar una
sucesión**.)*
~~`G-R1-A` impide **declarar** una sucesión desde una `SUSPENDED` —autorización de estado
indeterminado— o desde una `PAUSED`, donde `EX-11` mide que **el proveedor rechaza toda
modificación**; y de paso impide la cadena, que la clave `B` ya rechaza, en el momento de
escribirla en vez de al insertar.~~
`G-R1-A` impide **declarar** una sucesión desde una `PAUSED`, donde `EX-11` mide que **el
proveedor rechaza toda modificación**, y desde una `SUSPENDED` de **pagador manual**, que vuelve
por `MP4` y `S7` y no por sucesión (cap. 03 §3.2); y de paso impide la cadena, que la clave `B` ya
rechaza, en el momento de escribirla en vez de al insertar. **Desde una `SUSPENDED` de pagador con
tarjeta sí deja declararla, con una condición: que su preapproval se relea por id como
`cancelled` en ese acto.** La razón vieja —*«autorización de estado indeterminado»*— no vale para
esa población desde `DEC-SUB-019`: `S6` le cancela el preapproval en el mismo acto de suspender y
lo verifica releyendo, así que el estado ya no es indeterminado — y sin esta puerta la persona no
tenía por dónde volver, porque `S7` sólo la alcanza en los bordes (FASE 8 completa, `F-8CB1-002`,
owner 2026-09-25).

**Y desde `DEC-SUB-021` impide también declararla desde `GRACE_PERIOD`** (owner 2026-09-25): en
el grace no se cambia de plan, primero se regulariza —el pagador con tarjeta cambia la tarjeta
(`EX-36`) y los reintentos del proveedor cobran con ella, ~~**condicionado a `GR-1`** (owner
2026-09-25, FASE 9 completa, 3a: no está medido que el reintento de un registro ya abierto use la
tarjeta nueva, y la superficie no lo promete)~~ (tachado 2026-09-26) **medido: `GR-1` `VERIFIED` el
2026-09-26** —el cambio dispara un reintento en el momento sobre el mismo registro, y la superficie
puede decirlo—; el pagador manual paga su cuota—, y
recién en `ACTIVE` puede cambiar. La razón es la de la decisión: `S17` cancela la predecesora al
**autorizar** la sucesora y `D8` difiere el primer cobro de ésta, así que si ese cobro falla —con
la misma tarjeta que venía fallando— la persona se queda sin nada (FASE 8 completa, `F-8CD1-002`,
`F-8CB1-009`). *(Desde la decisión 3c —owner 2026-09-25, FASE 9 completa— la sucesora declarada
en `ACTIVE` o `CANCEL_SCHEDULED` cuya predecesora venía pagando ya no se queda sin nada si su
primer cobro falla: va a `S4` y al grace, con el barrido releyendo su preapproval cada día (cap. 03
§3.2). La razón de este párrafo sigue valiendo para el grace: desde ahí la tarjeta es la misma que
viene fallando.)* **El conjunto de declaración queda en tres**: `ACTIVE`, `CANCEL_SCHEDULED` y la
`SUSPENDED` de tarjeta con el preapproval releído `cancelled`, que **sí** sigue: ahí no hay
preapproval que arreglar.

**Y la `ACTIVE` de pagador con tarjeta entra sólo con su preapproval releído por id como
`authorized` en ese acto** (FASE 8 completa, owner 2026-09-25). Una `ACTIVE` cuyo preapproval el
proveedor ya pausó por mora —el webhook del cobro fallido que no llegó— es una mora que nuestra
fila todavía no ve (`DEC-MP-008`), así que el cambio no se ofrece: *«tu último cobro no entró, actualizá tu
tarjeta»*, el camino de `DEC-SUB-021`, y la relectura corre la transición que corresponda por el
cap. 03 §10.1 —sobre `paused`, `S6` por su segundo evento— (cap. 03 §3.2, `S1`).

**`G-R1-A` vigila el ACTO de declarar, no una propiedad permanente de la fila**, y la diferencia
no es de matiz: la sucesión dura **hasta que vence la ventana de autorización** —**72 h o 7 días
corridos**, según el método de pago (cap. 03 §3.4 punto 1)—, y en esa ventana ~~**ocho transiciones normales
sacan a una predecesora perfectamente legal del conjunto de tres**~~ ~~**diez transiciones normales
mueven a una predecesora perfectamente legal del conjunto de declaración**~~ ~~**nueve transiciones
normales mueven a una predecesora perfectamente legal del conjunto de declaración**~~ ~~**diez transiciones
normales mueven a una predecesora perfectamente legal del conjunto de declaración**~~ **nueve transiciones
normales mueven a una predecesora perfectamente legal del conjunto de declaración** (recontadas
con `DEC-SUB-021`, owner 2026-09-25; **y con `S36`**, FASE 9 vuelta 1, M; **y sin `S27`**, revisión del owner, 2026-09-28, C8) —`S8` y `S9` la pausan, **`S4` la pasa a `GRACE_PERIOD`**,
que desde `DEC-SUB-021` ya no es estado de declaración pero **sí es alcanzable** durante la
ventana, ~~`S6` la suspende —y eso la saca del conjunto **sólo si es de pagador manual**: la
`SUSPENDED` de tarjeta con el preapproval cancelado está adentro—,~~ y `S12`, `S13`, `S16`, el
espejo de la baja decidida por el proveedor (cap. 03 §10.1) ~~, **`S24`** —la baja que la propia
persona pide en medio del grace—~~ y, desde una `SUSPENDED` de
tarjeta, **`S23`** —la baja pedida estando suspendida— ~~y **`S27`** —la discontinuación de la
vertical—~~ la mata (FASE 8 completa, `F-8CB1-002`; `S27` salió con la revisión del owner, 2026-09-28, C8), **y desde `ACTIVE` o
`CANCEL_SCHEDULED` también `S36`** —la revocación del derecho de arrepentimiento que registra una
persona (FASE 9 vuelta 1, M); **desde `PAUSED` también ocurre** (owner 2026-09-26, `X-2`), pero
sale de un estado alcanzable, como `S22`, y no se cuenta—; el dominio está recorrido en el cap. 03 §3.2, y **no coincide con sus filas
numeradas**—. **`S6` y `S24` salieron de la cuenta sin dejar de ocurrir**: las dos salen de
`GRACE_PERIOD`, que ahora es un estado **alcanzable** y no de declaración —como `S22` sale de
`PAUSED`—; y `S6` desde `ACTIVE` sólo corre sobre un pagador con tarjeta, al que deja en una
`SUSPENDED` con el preapproval cancelado, que está adentro del conjunto. Leído como
propiedad permanente, el guard se ponía en rojo sobre el camino normal, **exactamente durante la
ventana en que nadie lo puede distinguir de un rojo real**, y un guard que falla sobre el camino
normal es un guard que alguien va a relajar. Leído sobre el acto, el conjunto de declaración es el
dominio correcto y coincide con el que `S1` exige.

`G-R1-B` es **`D8` hecho verificable en vez de recordable**, y
por eso **depende de la columna** que guarda la fecha con la que nació la fila (cap. 02 §2.2): sin
ella el guard no se puede escribir, y el invariante vuelve a ser algo que alguien tiene que
acordarse de cumplir.

**`G-R1-C` es el guard del CIERRE**, que es la mitad que faltaba: `A` y `B` vigilan cómo nace una
sucesión y ninguno vigilaba cómo termina. `S18` escribe `sucedida_por` en la predecesora y limpia
`sucede_a` en la sucesora, y las dos mitades son inseparables **en direcciones opuestas**: la
primera sin la segunda deja la sucesora ocupando el candado `B` con el `A` **vacío** —y un alta
nueva entra sin que nada la rechace—; la segunda sin la primera borra la única evidencia de que
hubo sucesión, y los complementos del que hizo un upgrade se cancelan de forma irreversible
(`B/16` §4.2). Es una propiedad del árbol de fuentes y se rompe a propósito comentando una de las
dos escrituras, que es lo que pide el §2.1.

**Y vigila las otras TRES escrituras del cierre, que es lo que cambió**: `S18` no tiene dos
efectos sino cinco, y los tres que se agregaron son los que **fallan en silencio**. ~~Un cierre que
re-apunta los complementos y se olvida de la **redención de promo** deja al cliente pagando precio
de lista para siempre, y el barrido no lo ve porque compara contra el monto vigente de la
sucesora, que **es** el de lista (`B/14` §2.2).~~ **La redención de promo ya no es parte de ellas**
(FASE 8 completa, pendiente 7, owner 2026-09-25): la promo se pierde con el cambio de plan y
`S18` no la re-apunta (`B/14` §2.2), así que la escritura del re-apunte alcanza **sólo a los
complementos** y el guard deja de vigilar la redención. Uno que se olvida de la **cortesía** —que desde `DEC-GRANT-007` no se re-apunta sino que se
**cierra con su saldo de ~~días~~ meses** (FASE 8 completa, `F-8CB1-001`)— deja una
columna no anulable apuntando a una `CANCELLED`, que no emite fuente, y **nada que `S9` pueda
re-emitir**. Y uno que cierra sobre una
predecesora con un pago pendiente por `S19` **sin poner la marca** deja plata del cliente en
nuestra cuenta sin nadie que la mire — es el único de los cinco que no tiene ningún otro
detector, porque la fila queda terminal (`DEC-RF-002`, `B/12` §5.3 ramas 1, 5 y 6). **Se rompe a
propósito comentando cada una de las cinco escrituras por separado**, y el inventario contra el
que se verifica es `B/02` §2.6.

~~**Y desde `DEC-GRANT-010` vigila un SEXTO camino que no es un cierre**: `S25` difería la
cortesía con la misma columna que `S18`, sin sucesión de por medio, y el guard ganaba el segundo
escritor de la columna.~~ **Ya no** (revisión del owner, 2026-09-28, C8): `S25` salió, y `G-R1-C`
vuelve a vigilar sólo el cierre.

**`G-R1-E` es el guard del TÉRMINO, y existe porque el defecto que cierra no es una omisión sino
una paráfrasis.** `NUCLEO/01` §2.4 regla 2 ya prohíbe *«vivo»* sin calificar en un predicado, y
`S19` **no la violaba**: no usaba la palabra suelta, usaba **otra frase** —*«tiene una sucesora
con `sucede_a` apuntándola»*— que dice lo mismo **sin el adjetivo**, que es el caso que la regla
no contemplaba. Por eso este guard se ancla en la **columna**, no en la palabra: todo predicado
que mencione `sucede_a` tiene que decir además en qué estado está quien lo escribió. Su segunda
mitad vigila el inventario de `NUCLEO/01` §2.4, y es la parte que ningún grep sustituye: un
predicado nuevo **no aparece** buscando el término viejo, así que lo único que lo detecta es que
la lista de consumidores tenga una fila menos que los consumidores. Se rompe a propósito sacándole
*«viva»* a la condición de `S19`.

**Y esa segunda mitad vigila ahora DOS inventarios, porque el caso que la obligó a crecer fue el
peor de los dos.** *«Grant vivo»* y *«ancla viva»* llegaron al corpus **sin definición y sin
columna**: tres predicados los usaban —la tercera y la cuarta comprobación del barrido y la
tercera mitad de la orfandad del `B/16` §4.2— y ninguna búsqueda devolvía el hueco, porque **el
lugar donde faltaba la columna no nombraba el término**. Con el inventario, un cuarto consumidor
que llegue sin fila se cuenta igual que uno de *«fila viva»*. **El guard sigue siendo uno y los
de `R1` son SEIS**: lo que cambia es contra cuántas listas cuenta su segunda mitad. *(Este
renglón decía «cinco»; quedó caduco cuando `G-R1-F` entró en la misma tanda, y el conteo se
recalculó sobre la tabla de arriba.)*

**`G-R1-D` es el guard de la VENTANA**, que es el tercer momento: `A` vigila cómo nace la sucesión,
`C` cómo termina, y `D` lo que puede pasar **mientras dura**. Vigila dos escrituras opuestas y las
dos son de plata: reactivar a la predecesora con el cobro reciclado —que deja dos filas vivas con
el crédito de la sucesora ya computado en cero, y un período cobrado que `S17` se lleva puesto— y
reembolsar ese mismo pago **antes** de saber si la sucesión se consuma, que en la rama del
abandono le devuelve al cliente el pago que lo salvaba y lo manda a `SUSPENDED`. **El guard existe
porque la regla se ejecuta en cuatro lugares y no en uno**: `S5`, `S7`, el efecto de `MP1` y el de
`MP4`, y el camino que la olvide en cualquiera de los cuatro produce el daño entero. **`S7` sigue en
la lista aunque el reciclado ya no llegue a una `SUSPENDED` de tarjeta** (`DEC-SUB-019`: `S6` cancela
el preapproval al suspender): la alcanzan un cobro en vuelo en el instante de `S6` y un preapproval
reactivado a mano, y sacarla del guard dejaría esos bordes sin vigilancia. Se rompe a
propósito sacándole la condición a una sola de las cuatro.

**Y el tercer lugar sólo es real porque `S19` admite las dos puertas del pago.** Este guard
asume que el efecto de `MP1` **llega** a `S19`; mientras el evento de `S19` nombró sólo *«la
cuota que sigue en `recycling`»*, el pago manual no matcheaba ninguna fila, el intento caía en la
regla 1 y el guard vigilaba un camino que la tabla no dejaba recorrer — con el reloj del grace
corriendo igual sobre alguien que había pagado (cap. 03 §3.2). Un guard cuyo dominio la tabla no
puede satisfacer no está en rojo: está mirando a otro lado.

**El cuarto llegó con `MP4`, y es el que más fácil se olvida porque su origen no parece un pago
que reactive.** La reapertura de un `DECLARED_UNPAID` (cap. 03 §7.1) es un pago manual que entra
sobre una fila `SUSPENDED`, y si esa fila es la predecesora de una sucesión en curso, reactivarla
produce **el daño entero** de este guard: dos filas vivas con el crédito de la sucesora ya
computado en cero. Es la misma puerta de `MP1` con otro estado de origen, así que se vigila igual
y no necesita una regla propia — lo que necesita es **figurar**, porque un guard escrito sobre
tres caminos no mira el cuarto.

**`G-R6` es el guard de la COLUMNA MUERTA, y vigila una clase que ya costó un crítico de dinero.**
`MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura del corpus avanzaba esa
columna**, así que el pagador manual pagaba **una vez en la vida** y seguía cubierto para siempre
(`F-8eB1-002`). El defecto no es que la condición esté mal escrita: está perfectamente escrita y
**lee algo que nadie mueve**, que es un estado que ninguna lectura de la fila revela y ninguna
comparación del barrido detecta — los dos lados dicen lo mismo, porque el dato no cambió de
ninguno de los dos.

**Se verifica mecánicamente, y eso es lo que lo hace admisible.** Cruzar las columnas que una
condición **lee** contra las que alguna transición **escribe** es una comprobación **estructural**,
no un juicio: no hace falta entender qué significa la columna para saber si alguien la mueve. Es
la diferencia con el guard que `DEC-TEST-001` **rechazó**, abajo.

**Se rompe a propósito** sacándole a `S10` la escritura que avanza la fecha del próximo cobro
(cap. 03 §7.2, *«qué mueve la fecha del próximo cobro»*): esa columna queda con **dos** escritores
en vez de tres y el guard **sigue verde**, así que para ponerlo en rojo hay que sacarle **los
tres** — que es exactamente el estado en que `MP5` nació, y la prueba de que el predicado es
*«al menos una»* y no *«alguna que alguien recuerde»*.

**Y el corpus que recorre son las TABLAS DECLARADAS, no el subconjunto ya construido — sin esto el
guard nace en rojo sobre el camino normal.** *«Al menos una transición **del corpus**»* se puede
leer de dos maneras, y una de ellas lo vuelve inservible: el corpus son **~~nueve~~ diez máquinas repartidas
en dos épicas que se construyen a lo largo de todo el programa**, así que una condición puede leer
una columna cuyo escritor llega en una unidad posterior. El caso está medido en este mismo catálogo:
**la fecha del próximo cobro tiene tres escrituras (cap. 03 §7.2) y una de ellas es `S10`, que
construye `B8`, mientras la condición que la lee es de `B5`** — con el dominio leído como *«lo ya
construido»*, el guard da **rojo durante `B5` → `B7` → `B8`**, tres unidades consecutivas del camino
crítico (`descomposicion.md` §3), **sobre código correcto**.

**Queda leído sobre las tablas que los capítulos declaran**, que existen completas desde antes de la
FASE 10, y por tres razones:

1. **Es el defecto que lo motivó, sin pérdida.** `F-8eB1-002` no fue una escritura que llegaba
   tarde: fue que **ningún lugar del diseño** avanzaba la columna que `MP5` leía. Ese defecto es
   visible sobre las tablas declaradas y el guard lo sigue atrapando entero.
2. **La otra lectura es la que alguien relaja.** Un guard que falla sobre el camino normal
   **exactamente durante la ventana en que nadie lo puede distinguir de un rojo real** es el mismo
   error que `G-R1-A` tenía leído como propiedad permanente, y está resuelto arriba de la misma
   manera: eligiendo el dominio sobre el que el predicado es verdadero cuando el sistema está bien.
3. **Y no le baja la fuerza**: sigue siendo una propiedad **del diseño** y no del avance, que es lo
   que la alternativa —acotarlo a las máquinas existentes en cada momento— le habría quitado.

**Lo que con esto NO verifica, dicho para que nadie lo lea de más**: que el escritor declarado esté
**implementado**. Una condición cuya escritura vive en una tabla que todavía es sólo un capítulo
**pasa en verde**, y eso es deliberado — la clase *«lo declarado no está construido»* es otra y **no
la vigila ningún guard de este catálogo**. Es el §2.1 sobre este mismo guard: el texto con que
falla no puede afirmar más de lo que el predicado verifica.

**Y esa clase dejó de estar sin vigilancia, aunque siga sin guard** (`DEC-TEST-002`). No se resolvió
con un guard nuevo porque uno que compare escritores **declarados** contra **implementados** sólo
puede correr cuando exista el código, o sea FASE 10 en adelante: hasta entonces no vigila nada. Se
resolvió con un **criterio de terminación** —*«una unidad no está terminada mientras alguna
escritura que sus capítulos le declaran a una de sus transiciones no esté implementada»*,
`descomposicion.md` §4—, que actúa **cuando la unidad se declara lista** y no cuando alguien lee un
dato vacío en producción. **Lo que este guard verifica no cambia**, y el párrafo de arriba sigue
diciendo exactamente lo que su predicado hace.

**Y su dominio son las ~~NUEVE~~ DIEZ máquinas de las dos épicas, no las ~~cuatro~~ cinco tablas de
ésta** (la décima máquina y quinta tabla, el reembolso —`RF1`–`RF5`, `B/03` §6.1—, owner
2026-09-25; FASE 9 completa, 5a). Nació
acotado a billing porque el crítico que lo motivó era de billing y nadie planteó la extensión; la
ampliación del mismo día de `DEC-TEST-001` la tomó, y **no por simetría con `G-R4` y `G-R5`** sino
porque en verticales vive el candidato más fresco del corpus para exactamente este defecto:
**`listing.inactiva_desde`**, la columna que `DEC-DATA-002` creó ese mismo día y **lo que decide es
el borrado irreversible del contenido de una ficha**. La razón entera está escrita en `V/20` §2,
que es donde vive la columna; acá alcanza con decir que **el dominio del guard ya no es este
catálogo**. Termina, sí, siendo la tercera referencia cruzada del catálogo —`G-R4` y `G-R5` son
las dos anteriores, y `G-R6-B` la cuarta—, pero eso es la consecuencia y no el argumento.

**Y `G-R6-B` es el guard de LA LISTA de esa misma columna —sus ~~dos~~ tres mitades, con ~~tres~~ cuatro predicados (la tercera mitad y el cuarto predicado, revisión del owner, casos vecinos, 2026-09-29, caso 16)—, que existe porque el
párrafo de arriba dejó dicho que `G-R6` no la cubre.** De los ~~cuatro~~ ~~cinco~~ ~~**seis**~~ **cinco** hechos
que escriben `listing.inactiva_desde` (el sexto, levantar una moderación —`PB11`—, owner
2026-09-25; FASE 9 completa, 5b) **~~sólo uno es una transición~~ ~~dos son transiciones~~ ~~uno es
una transición y otro lo es a medias~~ dos son transiciones enteras y otro lo es a medias** —el 3
y el 6, y desde la FASE 8 completa el 5, que sobre la ficha
publicada lo ejecuta la primera rama de `PB2` (`F-8CA2-001`) y sobre las demás fichas del dueño el
recálculo que el aviso despierta, que no es transición (owner 2026-09-25)—, así que el
predicado *«al menos una transición la escribe»* queda verde por `PB1`/`PB3`/`PB7`, por `PB2` **o
por `PB11`**, no mira al recálculo, y los otros
~~tres~~ dos —el registro de eventos y la respuesta del contrato~~, y la pregunta
`finDeServicio` (`12-contrato…` §4.1; FASE 9 vuelta 2, `R5`)~~ (el hecho 4 salió con la revisión del owner, 2026-09-28, C8)— **no los mira
nadie**. Lo único que los
sostenía era la enumeración de `V/02` §2.5, y una lista cerrada sin guard es una promesa que este
programa ya rompió una vez. **Desde la cuarta enmienda vigila también la otra mitad de ese §, la de
los ~~cinco~~ seis consumidores**, porque **las dos fallan distinto y la segunda falla peor**: un lector no
inventariado **decide** con el reloj, y el lector más caro de esa columna es el hard delete del día
180. La enmienda lo aceptó con una condición que su fila repite: **el mensaje dice qué mitad
falló**, porque un guard con varios predicados y un solo texto afirma más de lo que verificó — la
misma regla con la que esta decisión rechazó el segundo guard, abajo. **Y sobre esa mitad vigila
las dos direcciones, que es lo que esta pasada le agregó**: la *(b)* rechaza un lector que el
inventario no nombra, y la *(c)* rechaza que uno de los **~~cinco~~ seis declarados** haya dejado de leer —
el día que el hard delete del día 180 deje de leer la columna, el guard seguía verde y la lista
seguía diciendo que ese lector está ahí—. Para **escritores** la dirección simétrica sigue
rechazada **como guard**, y con la razón de siempre: comprobar que un hecho tenga quien lo ejecute
pide una declaración, y un guard estático sólo puede comprobar que esté. **Lo que la vigila desde
`DEC-TEST-002` no es un guard sino un criterio de terminación** (`descomposicion.md` §4), y por eso
la objeción no lo alcanza: lo contesta una persona al declarar lista la unidad, con el código
delante. **La razón entera, con sus
tres casos que lo hacen fallar a propósito —uno por predicado— y lo que sigue sin verificar, está escrita
en `V/20` §2**, que es donde vive la columna; acá alcanza con decir por qué figura en este catálogo:
**lo que puede romper la lista se escribe de este lado** —~~el cap. 10 §4.3 y~~ el cap. 03 §7.1 (el cap. 10 §4.3 salió con la revisión del owner, 2026-09-28, C8)—, y un
~~quinto~~ escritor **nuevo** agregado desde acá no obliga a abrir el capítulo de la otra épica. Es el mismo
argumento de `G-R5`, en la misma dirección.

**Y el SEGUNDO guard que esta tanda evaluó NO se agrega, con su razón escrita** (`DEC-TEST-001`).
Era *«toda fila con `desde` de conjunto declara cuántas escrituras tiene y en qué orden»*, y su
caso real es `F-8eB2-002`: `S20` copió de `S13` el *«idempotente y reanudable fila por fila»*
teniendo **dos** escrituras, sobre un argumento que supone una.

- **Vigila una convención de redacción** —*«declará tus escrituras»*— que un guard estático
  **sólo puede comprobar en su forma, no en su verdad**. Puede exigir que la fila **diga** cuántas
  escrituras tiene; **no puede verificar que sean ésas**.
- Sería **un guard que afirma más de lo que prueba**, y este capítulo ya tiene la regla escrita
  (§2.1): *«el texto con que falla no puede afirmar más de lo que el predicado verifica»*. Un
  guard así es **peor que no tenerlo**, porque declara cubierta una clase que no cubre.
- **Lo que queda sin vigilancia va declarado**: `S20` demostró que el error se comete **copiando
  de una fila que parece análoga**, y contra eso no hay comprobación estructural. Lo único que lo
  detecta es que alguien lea las dos filas juntas.

**Y `G12` y `G13` estaban definidos y fuera de este catálogo, que es el defecto que su llegada
cierra.** Vivían sólo en `B/descomposicion.md` §2, donde se numeraron *«para poder asignarlos a una
unidad»* con la nota *«si el `20` se reescribe, los absorbe»*. Un § que se presenta como *«la lista,
que es lo que permite preguntar «¿están todos?» una vez en vez de siete»* y deja dos afuera es un
**inventario que afirma completitud sin tenerla**, que es el patrón que la FASE 8-bis-4 encontró
cinco veces. ~~Los dos entran **acá y no en `V/20` §2**, incluido `G13`: vigila el contrato, y el
consumidor del contrato es billing.~~ (tachado 2026-09-26) **`G12` entra acá y `G13` vive en `V/20`
§2**: la razón que lo traía era falsa —el consumidor de `cobertura()` es verticales, no billing— y
el contrato §6.3 le da a `V4` como dueño (owner 2026-09-26, `G5-5`).

***El salto `G7` → `G9` no es un agujero, y conviene decirlo para que nadie lo busque.*** La
numeración `G1`-`G13` es **una sola, repartida entre las dos épicas**: `G1`-`G6`, `G8` **y `G13`**
están en `V/20` §2, y `G7` más ~~`G9`-`G13`~~ **`G9`-`G12`** están acá (`G13` pasó de acá a allá:
owner 2026-09-26, `G5-5`). Medido recorriendo las dos tablas, no deducido del
salto. **Desde la revisión del owner (2026-09-28) la numeración llega a `G17`**: `G14` está en
`V/20` §2 y `G15`, `G16` y `G17` están acá.

**Y el costo va con su cifra, recontada acá y no copiada.** Los guards de este programa **no corren
todavía** —son declaraciones en `B/20` §2 y `V/20` §2 hasta la FASE 10—, así que lo que decide si
alguno llega es que una unidad lo construya. Recontado sobre las dos tablas de catálogo y las dos
`descomposicion.md` el **2026-09-21**, sobre el árbol que deja el reparto de la **quinta enmienda**
de `DEC-TEST-001` —la que reparte los catorce sin unidad—, que es el último cambio de la serie:

| | cuántos | quiénes |
|---|---|---|
| filas de `B/20` §2 | ~~**16**~~ ~~**15**~~ ~~**14**~~ **17** | `G7` `G9` `G10` `G11` `G12` ~~`G13`~~ **`G15` `G16` `G17`** · los **seis** de `R1` · `G-R4` ~~`G-R5`~~ `G-R6` `G-R6-B` — `G13` pasó a `V/20` §2 (owner 2026-09-26, `G5-5`); `G-R5` salió (revisión del owner, 2026-09-28, C14; su fila queda tachada y no se cuenta); **`G15`, `G16` y `G17` entraron con la revisión del owner, 2026-09-28** (C13 y `L3-c`, N2, N4 y `L3-f`), recontadas sobre la tabla |
| filas de `V/20` §2 | ~~**17**~~ ~~**18**~~ ~~**19**~~ ~~**20**~~ ~~**21**~~ ~~**19**~~ ~~**20**~~ **21** | `G1`-`G6` `G8` **`G13`** **`G14`** **`G18`** **`G19`** *(el actor de sistema armado fuera de la fábrica, de `V5`: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H)* · `G-R2` `G-R2-B` **`G-R2-C`** · ~~`G-R3`~~ `G-R3-B` `G-R3-C` · `G-R4` `G-R4-B` ~~`G-R5`~~ ~~**`G-R5-B`**~~ `G-R6` `G-R6-B` · **`G-R9`** — **`G18`**, el control que regenera y compara el SQL generado del catálogo y de la tabla de claves, entra con su fila en `V/20` §2 y lo construye `V1` (FASE 5, lote de la aplicación, owner 2026-09-30, E; recontado sobre `V/20` §2 en la segunda tanda) — **`G-R3` y `G-R5-B` pasan a ser validaciones del panel** (revisión del owner, 2026-09-28, N1 y C9: el catálogo y los plazos viven en la base y se editan desde el panel, así que CI no ve los de producción); conservan su fila y su nombre, y no se cuentan. Antes, en la misma revisión, **la cifra no se movió y la composición sí**: sale `G-R5` y entra `G14`, el de la frontera del package del contrato (revisión del owner, 2026-09-28, C14 y N6); **`G-R9`**, **`G-R9`**, el de la lista cerrada de `PURGED`, desde la FASE 9 vuelta 2, verificación (owner 2026-09-27, `V2-k`);  `G-R5-B` desde la FASE 8 completa (`F-8CA2-014`, owner 2026-09-25); **`G-R2-C`**, el gemelo de `G-R2-B` para la emisión de un addon `USER`/`GLOBAL` sólo en sus verticales compatibles, desde la FASE 9 completa (owner 2026-09-25, 4e, `F-8CA1-008`; recontado sobre `V/20` §2) |
| **guards distintos** | ~~**29**~~ ~~**30**~~ ~~**31**~~ ~~**32**~~ ~~**35**~~ ~~**33**~~ ~~**34**~~ **35** (el 35 es **`G19`, de `V5`**, con su fila en `V/20` §2: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H) (el 34 es **`G18`, de `V1`: el control que regenera y compara el SQL generado del catálogo y de la tabla de claves**: FASE 5, lote de la aplicación, owner 2026-09-30, E; no es de este catálogo, su fila vive en `V/20` §2) | ~~16~~ ~~15~~ ~~14~~ 17 + ~~17~~ ~~18~~ ~~19~~ ~~20~~ ~~21~~ ~~19~~ ~~20~~ 21 (sin `G-R3` ni `G-R5-B`, que pasan al panel: revisión del owner, 2026-09-28, N1 y C9) menos las ~~**cuatro**~~ **tres** referencias cruzadas (mover `G13` de un catálogo al otro no cambia el total): `G-R4`, ~~`G-R5`,~~ `G-R6` y `G-R6-B` (revisión del owner, 2026-09-28: sale `G-R5` por C14 y entra `G14` por N6, así que el total queda en 32; **y entran `G15`, `G16` y `G17`**, los tres de este catálogo y ninguno referencia cruzada, así que queda en **35**). `G-R5-B` **no** es referencia cruzada: sus dos cifras son de la épica de verticales. **`G-R2-C` tampoco**: vive en `V/20` §2 y su dato de billing es el catálogo de `addon_product` (`B/02` §2.4) |
| **con unidad que los construya** | ~~**29**~~ ~~**30**~~ ~~**31**~~ ~~**32**~~ ~~**35**~~ ~~**33**~~ ~~**34**~~ **35** de los que cuenta esta tabla; **el 35 es `G19`, con su unidad, `V5`** (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H); ~~**el 34, el control del SQL generado, no entra en este recuento: su fila y su unidad las escribe la épica de verticales**~~ **el 34 es `G18`, con su fila en `V/20` §2 y su unidad, `V1`** (FASE 5, lote de la aplicación, owner 2026-09-30, E; recontado en la segunda tanda) (salen `G-R3`, de `V2`, y `G-R5-B`, de `V6`, que pasan a ser validaciones del panel y las construyen las mismas unidades: revisión del owner, 2026-09-28, N1 y C9) | **`G15` `G16` `G17` (`B1`)**, que nacen con unidad (revisión del owner, 2026-09-28), más los ~~**15**~~ ~~**16**~~ **17** (FASE 5, lote de la aplicación, owner 2026-09-30, E; verificación, `VF5-05`; con `G19`, FASES 6 y 7, verificación, 2026-09-30, F8) que ya la tenían — `G1` `G3` ~~`G8`~~ (`V1`), **`G8` (`U1`**, la unidad del paraguas que hace la limpieza del principio: verificación corta, 2026-09-29, lote O-A), `G2` `G4` `G6` (`V5`), `G5` y `G-R6-B` (`V6`), `G9` `G10` `G11` `G12` (`B1`), `G7` (`B2`), `G13` (~~`B4`~~ **`V4`**: owner 2026-09-26, `G5-5`), ~~`G-R5` (ver abajo)~~ **`G14` (`V1`**, revisión del owner, 2026-09-28, N6; `G-R5` salió por C14) **y `G18` (`V1`**, FASE 5, lote de la aplicación, owner 2026-09-30, E) **y `G19` (`V5`**, FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H) — más los **14** que reparte la quinta enmienda: `G-R3` (`V2`), `G-R2` `G-R2-B` (`V3`), `G-R4` `G-R4-B` `G-R6` (`V4`), `G-R3-B` `G-R3-C` (`V5`), `G-R1-A` `G-R1-B` `G-R1-E` `G-R1-F` (`B3`), `G-R1-D` (`B7`), `G-R1-C` (`B8`) — y **`G-R5-B` (`V6`)**, que nace con unidad (FASE 8 completa, owner 2026-09-25) — **y `G-R2-C` (~~`B10`~~ `B4`)**, asignado en la FASE 9 completa (owner 2026-09-25, decisión 10c; `B/descomposicion.md` §2, fila ~~`B10`~~ `B4`) *(pasa a `B4`, al corte: corte del MVP, owner 2026-10-01, AA y AV; residuo corregido el 2026-10-02)* **y `G-R9` (`V6`)**, que nace con unidad (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`) |
| **sin unidad** | ~~**0**~~ ~~**1**~~ **0** | **ninguno**: `G-R2-C` (FASE 9 completa, 4e) ~~tenía por su capítulo la de `G-R2-B`, `V3`~~ ~~ya tiene unidad, **`B10`** (owner 2026-09-25, decisión 10c; la asignación la escribe `B/descomposicion.md`, no `V/descomposicion.md`)~~ **lo construye `B4`, al corte** (corte del MVP, owner 2026-10-01, AA y AV; la asignación la escribe `B/descomposicion.md`, no `V/descomposicion.md`; residuo corregido el 2026-10-02). Entre la FASE 9 completa y esta decisión fue **uno**, la primera vez en la serie; el reparto, unidad por unidad y con su razón medida, está en `V/descomposicion.md` §2.10 y en `B/descomposicion.md` §2 |

*(`G-R5` salió con la revisión del owner, 2026-09-28, C14: el párrafo queda como historia de su reparto.)*
**`G-R5` cambió de unidad y no de estado: era el único contado *«con unidad»* sin nombrarse.** La
celda de `V9` decía *«el de `D16`»* —por su invariante y no por su id— y `F-8eC2-004` midió que
estaba **en la épica equivocada**: el número que puede romperlo es el tope de pausa del cap. 03 §5
de esta épica, que construye **`B8`**, y `V9` corre antes de que ese número exista. Desde el reparto
de la quinta enmienda **lo construye `B8`, nombrado por su id** (`B/descomposicion.md` §2.8, y el
retiro de la celda en `V/descomposicion.md` §2.7). El conteo no se mueve por esto; lo que se mueve
es que el guard ahora puede fallar.

**Dónde vive el reparto, y por qué no se copia a cada fila de esta tabla.** La asignación de unidad
la hacen **las dos `descomposicion.md`**, que son los documentos que reparten trabajo; este § es el
catálogo, y *«el catálogo cataloga, no reparte trabajo»* (`B/descomposicion.md` §2.1). Las ~~cuatro~~ **tres**
filas que igual nombran su unidad —`G12`, ~~`G13`,~~ `G-R6-B` y `G-R5` (retirada: C14)— lo hacen como **referencia
cruzada** y no como fuente (`G13` se fue a `V/20` §2, donde su unidad `V4` es de la misma épica:
owner 2026-09-26, `G5-5`): las ~~tres~~ dos primeras porque su unidad está del otro lado de donde uno la
buscaría, y `G-R5` porque **su asignación ya estuvo mal una vez** y el catálogo es donde se lee
primero.

**Lo que movió la tanda del cierre de guards, y movió a mejor**: los **sin unidad siguieron siendo
catorce** —agregar `G12` y `G13` no suma ninguno, porque los dos **sí** tienen unidad, y la fila de
`G-R6` en `V/20` §2 es una referencia cruzada y no un guard más—, y el denominador pasó de **26** a
**28**: de **14 de 26** a **14 de 28**. Es lo contrario de lo que se temía al escribirlo.

**Y lo que movió `G-R6-B`, medido igual y no deducido**: el denominador pasa de **28** a **29** y
los sin unidad **quedaron en catorce**, porque este guard **nace con unidad** —`V6`, la que
construye la columna y las escrituras de `V/02` §2.5 y `V/03` §9— en vez de sumarse a los `G-R*`
huérfanos. **14 de 28 → 14 de 29.** Los **dos** guards que la FASE 9-bis-4 había agregado antes
—`G-R1-F` y el propio `G-R6`— **nacieron los dos sin unidad** (medido en `DEC-TEST-001`, no acá), y
éste no; no es mérito de nadie, es la regla 1 de las descomposiciones —*«cada guard va con la pieza
que protege, nunca al final»*— aplicada **en el acto de escribirlo**, que es el único momento en que
sale gratis. **Cuál es la pieza está discutido en `V/descomposicion.md` §2.5**, porque había dos
candidatas.

> **Los dos párrafos de arriba miden las tandas ANTERIORES al reparto y se dejan como están.** Su
> *«catorce»* es correcto para su momento y **es el número que la quinta enmienda vino a mover**:
> la cuenta viva es la de la tabla, **14 de 29 → 0 de 29**. Se anclan en vez de reescribirse por la
> misma razón por la que `DEC-TEST-001` ancló su cifra: son mediciones de un momento, y reescribir
> una medición vieja para que describa el presente es lo que hizo falsa la cifra que esa entrada
> traía.

**Y la cifra que este § traía —*«12 de 26»*, *«13 de 27»*— estaba caduca por dos razones
independientes, las dos medidas acá.** La primera: el **26** de `C2` (FASE 8-bis-4, `F-8eC2-004`,
sobre `635a2699f`) era la **unión** de los catálogos **más** `G12` y `G13` leídos de la
descomposición —`B/20` §2 listaba once ese día—, así que no era comparable con un conteo de
catálogo. La segunda, y es la que la vuelve falsa: desde esa medición entraron al catálogo **dos
guards más y los dos sin unidad** —`G-R1-F` y el propio `G-R6`—, así que **sin unidad son catorce y
no doce** desde antes de que esta tanda tocara nada. El *«13 de 27»* no describió ningún estado del
corpus en ningún momento.

`DEC-TEST-001` acepta el costo porque la alternativa —no escribir el guard— garantiza que no llegue
a la FASE 10.

### 2.1 Un guard se prueba rompiéndolo

**Todo guard de esta lista lleva un caso que lo hace fallar a propósito.** No es rigor de más: un
guard que no puede fallar es un comentario con exit code 0, y no hay forma de distinguirlo de uno
que funciona salvo rompiéndolo.

Vale igual para el mensaje: **el texto con que falla no puede afirmar más de lo que el predicado
verifica.** Un guard que dice *«ninguna operación cruza verticales»* y sólo mira una forma
sintáctica está mintiendo con precisión, que es peor que no estar.

**Y romperlo una vez no alcanza: se rompe contra el job.** Para que la unidad que lo trae se dé por
terminada, el guard está enchufado en `pnpm check:guards` y en el job `guards` de `ci.yml`, y su
caso de rojo pone rojo al job, no sólo al script corrido a mano (FASES 6 y 7, owner 2026-09-30;
lo derivado, D-2; `DEC-ARCH-016`; el gate por unidad entero está en
[`16-fase-7…` §4.7](../../HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md),
momento 1).

---

## 3. El proveedor falso tiene que mentir

### 3.1 La tesis

El §62.2 dice que *«la gran mayoría de escenarios se prueba contra provider falso/controlado»* y
no dice **cómo se comporta** ese falso. Si se lo escribe con el comportamiento razonable —acepta y
aplica, rechaza y explica, avisa cuando algo cambia— **se está probando el código contra un
proveedor que no tenemos.**

El capítulo 06 (épica de billing) y la matriz midieron lo contrario, repetidamente: **este
proveedor acepta y no aplica, responde `2xx` sobre operaciones que descarta, y avisa de cosas que
sus propios datos desmienten.**

> **El stub no simula al proveedor: reproduce sus mentiras medidas.** Cada una está fechada y con
> su fila; ninguna es una hipótesis sobre cómo podría fallar.

### 3.2 Las mentiras que el stub tiene que poder hacer

**Desde la revisión del owner (2026-09-28, C13 y `L3-c`) son dos listas cerradas, y no una
tabla**: la de las **mentiras medidas** de Mercado Pago, y la de sus **reglas propias**, que el
falso cumple igual pero que no son mentiras, **con su comportamiento medido** (casos vecinos,
2026-09-29, caso 28). La tabla de quince filas que vivía acá mezclaba las
dos; queda tachada abajo, con dónde fue a parar cada fila.

**Tres reglas gobiernan la primera lista, y `G15` (§2) las vuelve verificables:**

1. **Una mentira que no está en la lista no puede estar en el falso.** Cada una vive en **un solo
   lugar del código**, con su nombre, la fila de la matriz de la que sale (fecha y cuenta donde se
   midió) y la prueba que demuestra que el código la resiste.
2. **Por defecto el falso miente siempre**, como el real.
3. **Una prueba puede apagar una mentira puntual**, sólo para probar el camino honesto, **y tiene
   que decir cuál apaga y por qué**.

#### Las mentiras medidas: la lista cerrada

| # | qué hace el falso a propósito | de dónde sale (fila, fecha, cuenta) | qué defensa obliga a probar |
|---|---|---|---|
| **M1** | dice «ok» a un cambio y **no lo aplica**: el ciclo, el plan, la fecha de cobro, la prueba gratis y la baja programada de una suscripción viva; y al crear, el campo `items` devuelve `201` y se descarta | `EX-4` (2026-09-15, sandbox, re-verificada en producción) · `EX-21` (2026-09-15, sandbox) · `EX-34` (2026-09-16, sandbox) · `EX-35` (2026-09-16, sandbox) · `CN-1` (2026-09-15, sandbox y producción) · `EX-5` (2026-09-15, sandbox) | que toda mutación se verifica releyendo (`D5`, §6) |
| **M2** | con **dos cambios en un pedido**, aplica uno y descarta el otro con un solo `200` | `EX-20` (2026-09-15, producción) | que la relectura compara **campo por campo** cada campo que se mandó |
| **M3** | crea **un duplicado por cada pedido igual** | `EX-17` (2026-09-15, sandbox y producción, sonda 14: diez pedidos, diez ids) | el candado propio contra duplicados, persistido antes de llamar (`D4`, `DEC-CONC-001`) |
| **M4** | el buscador **devuelve una parte sin error** (15 de 69 con `status=cancelled`) e **ignora nuestra referencia**; y trae menos campos que la lectura por id | `RC-1` (2026-09-15, sandbox y producción) · `RC-4` (2026-09-15, producción) | que el buscador nunca se usa como lista (`D6`) |
| **M5** | un **cambio de monto no emite ningún aviso** | `EX-15` (2026-09-15, sandbox, **por el canal Webhooks**; ~~su mitad IPN está pendiente de medición: ver el «NO cierra» de `B/06`~~ y 2026-09-29, sandbox, **con los dos canales escuchando**: tampoco por IPN; mediciones del 2026-09-29, punto 2) | que la conciliación compara el monto releído (`B/09` §3) |
| **M6** | **avisa tarde, repetido o nunca**; una devolución genera **tres entregas en dos formatos** | `WH-1`, `WH-2`, `WH-4` (2026-09-15, sandbox) · `WH-5` (2026-09-23, sandbox y producción; cerrada el 2026-09-29 con los dos canales) · `RF-7` (2026-09-15, producción) · **`WH-6` (2026-09-29, sandbox y producción): un mismo `payment` llega una vez por cada canal, y el de IPN lo guarda el receptor sin procesarlo** (`B/06`, «NO cierra»; mediciones del 2026-09-29, punto 3) | que un aviso nunca cambia un estado por sí solo (`D17`, `G17`) |
| **M7** | **cuenta un cobro rechazado como cobro**, y el estado del intento no dice si cobró | `RC-5` y `RC-6` (2026-09-22, producción) | que «¿cobró?» se contesta mirando cada intento (`B/09` §4) |
| **M8** | **cobra tarde y en tandas**: en el primer lote posterior a la hora de la fecha, al minuto `:02` | `PA-3` (2026-09-15; ~26 min en producción, 33 en sandbox) · ~~la medición de lotes del 2026-09-24 en producción, **sin fila propia en la matriz** (`B/09` §6 punto 2; se propone una)~~ **`EX-51` (2026-09-24, producción; fila abierta el 2026-09-28 con OK del owner, revisión del owner, C13)** *(residuo corregido el 2026-10-02 con el triage de los abiertos de la spec consolidada: la fila existe, `06-mp-validation-matrix.md`, `EX-51`)* | que nada supone que el cobro entra a la hora exacta (abajo) |
| **M9** | **agrega sola una prueba gratis** cuando el primer cobro es a futuro | `EX-8` (2026-09-15, sandbox) · `EX-26` (2026-09-15, sandbox) · `EX-33` (2026-09-16, producción) | que no se confía en su estado de prueba (`D12`, `G11`) |
| **M10** | devuelve el **enlace de pago roto** | `EX-37` (2026-09-16, producción; error abierto de su lado) | que el enlace se sanea siempre antes de mostrarlo (`D10`, `G10`) |
| **M11** | un **enlace de pago abierto no vence** | `EX-1` (2026-09-23, staging) | que los enlaces los vencemos nosotros (`S3`) |
| **M12** | una **pausa no se reanuda sola** | `PS-4` (2026-09-16, sandbox) | el reloj propio de fin de pausa (`S10`, `DEC-SUB-010`) |
| **M13** | contesta **«no se puede devolver»** (`2084`) cuando sí se puede | `RF-8` (2026-09-15, producción: ARS 5 rechazado, ARS 14 aceptado sobre el mismo pago) | el reintento partiendo el monto, que nunca pasa del confirmado (`B/06` §4.6 punto 5) |

**Son trece, recontadas sobre la tabla.** ~~**M8 no pasa `G15` hasta que su medición tenga fila en la
matriz**: la de los lotes está escrita en `B/09` y en el handoff, no en la matriz, y la regla 1
pide la fila.~~ **M8 cumple `G15` con `EX-51`** (revisión del owner, 2026-09-28, C13; residuo
corregido el 2026-10-02 con el triage de los abiertos de la spec consolidada).

#### Las reglas propias de Mercado Pago: otra lista

No son mentiras: el proveedor **exige** algo y lo dice. El falso las cumple igual, y la batería del
§4 las vigila igual, porque si una deja de ser cierta el código queda defendiéndose de una regla
que ya no existe. **Y desde los casos vecinos (2026-09-29, caso 28) la lista lleva también el
comportamiento medido** que no es mentira ni regla que el proveedor exija, pero que el barrido de
`B/09` y `S6` por su segundo evento necesitan que el falso reproduzca: `RP7` a `RP11`, marcadas
como comportamiento medido en la columna; **y `RP12`**, que necesita el receptor (mediciones del
2026-09-29, punto 4).

| # | qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido) | fila |
|---|---|---|
| **RP1** | el token de tarjeta es de **un solo uso** | `EX-12` |
| **RP2** | `X-Idempotency-Key` es **obligatoria** en el reembolso y falla **antes** de toda validación de negocio | `RF-4` |
| **RP3** | piso **ARS 15**, techo **ARS 2.000.000**, con los mensajes exactos | `PC-2` |
| **RP4** | **otra moneda** da `400` | `EX-18` |
| **RP5** | el reembolso idempotente devuelve **`200` y no `201`**, con **cuerpo vacío** | `RF-6` |
| **RP6** | **estando pausada rechaza toda modificación** con `400`, pero sí deja cancelar | `EX-11` |
| **RP7** ✚ | *comportamiento medido*: cada cobro tiene **una ventana de vida**, `expire_date`, y la trae cada renovación | `RC-7` (2026-09-22, producción) |
| **RP8** ✚ | *comportamiento medido*: un ciclo fallido lleva **cuatro intentos dentro del mismo registro de cobro**, y al vencer la ventana **el proveedor pausa** | `GR-3` (2026-09-22, producción) |
| **RP9** ✚ | *comportamiento medido*: **una pausada no cobra** | `PS-2` (2026-09-15, producción) |
| **RP10** ✚ | *comportamiento medido*: al reanudar, **la fecha de cobro avanzó sin cobrar** | `PS-6` (2026-09-16, sandbox y producción) |
| **RP11** ✚ | *comportamiento medido*: **`last_charged_date` es la del último intento, no la del último cobro**, y `last_charged_amount` no coincide con `charged_amount` | `RC-5` (2026-09-22, producción; precisada el 2026-09-24) |
| **RP12** ✚ | *comportamiento medido*: **cambiar la tarjeta emite un `payment` de ARS 0 con `operation_type: card_validation`**, por los dos canales, sin `external_reference` y sin nombrar al preapproval, `rejected` si la tarjeta nueva no pasa; y autorizar deja otro igual en producción | `EX-36` (2026-09-29, sandbox) · `PA-3` (2026-09-15, producción) |

~~**Son seis, recontadas sobre la tabla**, y son las seis filas de la tabla vieja que no eran
mentiras.~~ ~~**Son once, recontadas sobre la tabla**:~~ **Son doce, recontadas sobre la tabla**: las seis filas de la tabla vieja que no eran
mentiras, y las cinco de comportamiento medido que quedaban afuera de las dos listas (revisión del
owner, casos vecinos, 2026-09-29, caso 28), y `RP12`, el `payment` de validación de ARS 0 que el
receptor tiene que ignorar (`B/03` §10.2), que entra por la misma regla del caso 28 (mediciones del
2026-09-29, punto 4).

#### Lo que el falso simula sin haberlo medido, aparte

**No es una mentira medida y se marca como simulación en el código**: existe para probar un caso
de red, no porque el real lo haga a propósito. Hoy son tres: **el proveedor crea y cobra pero la
respuesta se pierde en el camino**; **la red cortada**; y **los avisos fuera de orden**, que
`WH-3` **no observó** (`PARTIALLY_SUPPORTED`: las entregas llegaron en orden causal en tres
corridas), así que no pueden ser una mentira de la lista aunque el código tenga que resistirlos
(la presentación los ponía entre las mentiras, y se corrige al publicarla: revisión del owner,
casos vecinos, 2026-09-29, caso 29).
`G15` no cuenta las simulaciones como mentiras, y una simulación tampoco puede estar prendida por
defecto sin decirlo.

#### Lo que no se simula

**Los correos que Mercado Pago le manda al cliente** (`EX-3`): no pasan por nuestro código, así que
no hay nada del lado nuestro que un falso pueda ejercitar. Se cubren con nuestros propios correos,
que salen antes (`DEC-MAIL-001`, `B/19` §4).

#### Dónde quedó cada fila de la tabla vieja

| ~~lo que hace el proveedor real~~ | ~~fila~~ | dónde quedó (revisión del owner, 2026-09-28, C13) |
|---|---|---|
| ~~mutar el monto **no emite ningún webhook**~~ | ~~`EX-15`~~ | M5 |
| ~~un `PUT` mixto **se aplica a medias**, con `200`~~ | ~~`EX-20`~~ | M2 |
| ~~la **fecha** de una suscripción viva es inmutable~~ | ~~`EX-34`~~ | M1 |
| ~~**estando pausada rechaza toda modificación** con `400`, pero sí deja cancelar~~ | ~~`EX-11`~~ | RP6 |
| ~~el campo `items` devuelve `201` y **se descarta en silencio**~~ | ~~`EX-5`~~ | M1 |
| ~~el `search` **ignora** nuestra referencia y devuelve un subconjunto plausible~~ | ~~`RC-1`, `RC-4`~~ | M4 |
| ~~el `init_point` **viene roto**~~ | ~~`EX-37`~~ | M10 |
| ~~el token de tarjeta es de **un solo uso**~~ | ~~`EX-12`~~ | RP1 |
| ~~el cobro llega **tarde y con retraso variable**~~ | ~~`PA-3`~~ | M8 |
| ~~le **escribe al cliente por su cuenta y primero**~~ | ~~`EX-3`~~ | no se simula (arriba) |
| ~~el reembolso idempotente devuelve **`200` y no `201`**, con **cuerpo vacío**~~ | ~~`RF-6`~~ | RP5 |
| ~~`X-Idempotency-Key` es obligatoria~~ | ~~`RF-4`~~ | RP2 |
| ~~hay un **rechazo sin explicar**~~ | ~~`RF-8`~~ | M13 |
| ~~piso **ARS 15**, techo **ARS 2.000.000**~~ | ~~`PC-2`~~ | RP3 |
| ~~otra moneda da `400`~~ | ~~`EX-18`~~ | RP4 |

**Y entraron a la lista de mentiras seis que la tabla no tenía**: el duplicado por pedido igual
(M3), los avisos perdidos y repetidos (M6), el rechazo contado como cobro (M7), la prueba gratis que
se agrega sola (M9), el enlace que no vence (M11) y la pausa que no se reanuda (M12).

~~⚠️ **Las mentiras de la conciliación no están en esta tabla** (FASE 8 completa, `F-8CB3-015`;
declarado por `DEC-METH-015`, FASE 9 completa, `DB-3`): el *«todavía no se sabe»* y el inventario de
intentos (`RC-5`, `RC-6`, `RC-7`), la ventana de reintentos (`GR-3`), las entregas perdidas y
reemplazadas (`WH-1`, `WH-2`, `WH-5`), la pausa y la fecha que avanza sin cobrar (`PS-2`, `PS-6`), y
los campos `charged_quantity` y `last_charged`. El stub no las reproduce, así que el barrido de
`B/09` se verifica contra un proveedor que no existe. **Causa**: la tabla se escribió antes de que la
conciliación tuviera sus filas medidas.~~ **Cerrado en su mayor parte** (revisión del owner,
2026-09-28, C13): `RC-5`, `RC-6` (M7) y `WH-1`, `WH-2`, `WH-5` (M6) están en la lista.
~~⚠️ **Lo que queda afuera de las dos listas**, declarado: `RC-7` (la ventana de vida de un cobro),
`GR-3` (cuatro intentos dentro de un ciclo y la pausa al vencerlo), `PS-2` (pausada no cobra),
`PS-6` (la fecha avanza sin cobrar) y el campo `last_charged`. Son **comportamiento medido que no
es mentira ni regla que el proveedor exija**, y el barrido de `B/09` y `S6` por su segundo evento
necesitan que el falso lo reproduzca. **Causa**: la decisión nombró dos listas y estas filas no
son de ninguna; en cuál van (o si hace falta una tercera) es del owner.~~ **Cerrado entero**
(revisión del owner, casos vecinos, 2026-09-29, caso 28): esas cinco van a la segunda lista como
comportamiento medido, `RP7` a `RP11`.

**El retraso variable del cobro merece su propia línea** porque es el que más código rompe: un
test cuyo cobro llega en el mismo instante en que vence el período **nunca ejecuta** el camino que
en producción se recorre siempre. El stub tiene que poder llegar tarde, y la suite tiene que
tener casos donde llega tarde.

### 3.3 Y de ahí sale qué es un escenario de carrera

El §62.1 pide cubrir *«races»* sin decir cuáles. Los seis cruces de concurrencia ya están
enumerados en el capítulo 05 (épica de billing), y la lista de arriba agrega los que sólo existen
porque el proveedor se comporta así: el cobro que llega después de suspender, la mutación que se
acepta y no se aplica, el webhook que no llega nunca, y el cliente que recibe el correo del
proveedor **antes** que el nuestro.

---

## 4. La suite de sandbox es chica, y prueba otra cosa

El §62.3 la pide *«más pequeña pero obligatoria»* y dice que *«verifica assumptions e integración
real»*. Conviene ser exacto sobre qué significa eso acá, porque no es lo mismo que probar nuestro
código:

**la suite de sandbox es una suite de regresión sobre la matriz de validación, no sobre el
sistema.**

`S-METH-01` fijó que **toda medición caduca cuando cambia el hecho que mide**, y no hay forma de
enterarse de que el proveedor cambió salvo volviendo a medir. Las mentiras del §3.2 son el
contrato con el que está escrito todo el código de proveedor: **si una deja de ser cierta, el
stub queda mintiendo de una forma que el real ya no tiene, y toda la capa de dominio pasa a estar
verificada contra una ficción.**

Entonces la suite de sandbox corre **las filas de la matriz**, no los casos de uso. Es chica
porque son pocas filas las que sostienen decisiones, y es obligatoria porque es lo único que
convierte a `S-METH-01` de una advertencia en un control.

**Con dos límites que el capítulo 06 (épica de billing) ya fijó y que valen igual acá**: guard de
entorno y guard de presupuesto — una sonda que pueda correr contra producción por error, o gastar
más de lo autorizado, no se ejecuta.

### 4.1 La batería que vigila a Mercado Pago

(Revisión del owner, 2026-09-28, C13 y `L3-d`.) La suite de arriba **no tenía cadencia, ni
producción, ni comparación de forma, ni quién avisara si no corría**. Desde esta revisión es una
batería con esas cuatro cosas, y **la construye `B1`**, con el falso y sus dos listas:

1. **Qué corre**: **cada medición de las dos listas del §3.2**, las trece mentiras y ~~las seis
   reglas propias~~ las ~~once~~ doce reglas propias y comportamientos medidos (caso 28; `RP12`, mediciones del 2026-09-29, punto 4): hace el pedido, **relee por id** y compara el resultado con lo que la fila dice
   que pasa. **Y compara también la forma de cada respuesta** (qué campos vienen y de qué tipo)
   contra la última corrida, porque un campo que desaparece o cambia de tipo rompe el código sin
   cambiar ninguna mentira. **Las cinco de comportamiento medido, `RP7` a `RP11`, no se reproducen
   en una pasada**: se midieron en producción sobre ciclos reales de cobro rechazado, a lo largo de
   días. **La batería las relee sobre sujetos que ya existen, sin mutar**, y compara lo que lee con
   la fila; **las que no se puedan releer así se declaran *«vigiladas a mano»***, como `R-MP-01`,
   abajo (revisión del owner, casos vecinos, 2026-09-29, caso G-C).
2. **Cuándo, en la cuenta de pruebas**: **sola, una vez por semana**.
3. **Cuándo, en producción**: **sola, una vez por mes**, sólo lo que se mide ahí (el buscador,
   `RC-1`; los lotes de cobro, M8; y las devoluciones, que en sandbox dan `401`), **con
   autorizaciones propias del owner, al monto mínimo (`PC-2`), y cancelando y devolviendo en la
   misma corrida**. **La autorización la custodia el owner y la renueva cada mes**: sin la del mes
   en curso, la corrida de producción no arranca (revisión del owner, casos vecinos, 2026-09-29,
   caso 33). Los dos guards del cap. 06 §9, entorno y presupuesto, rigen igual.
4. **Y a mano cuando se quiera**: la misma batería, en cualquiera de los dos entornos, la corre
   quien opera, sin esperar su fecha. En producción, con la misma autorización del owner.
5. **Qué hace si algo cambió: avisa y no toca nada.** Manda **un correo al administrador** con qué
   medición cambió, qué esperaba y qué obtuvo. **Nada se ajusta solo**: una persona decide si hay
   que actualizar la lista, el falso y el diseño, y la fila de la matriz se re-mide por el cap. 06
   §8 regla 2 (*«un comportamiento que contradice una fila no se explica: se re-mide»*).
6. **Si no corre, avisa el vigía externo** que vigila el barrido diario (`B/09` §7.1), con la misma
   regla: ping al terminar una corrida completa y alerta si pasa su cadencia sin ping.
7. **Qué avisos registra**: cada aviso que la corrida provoca, **con el canal por el que llegó**.
   Es registro, no decisión: cómo se tratan los dos canales de avisos ~~está pendiente de medición~~
   está decidido desde el 2026-09-29: IPN se guarda sin actuar (`B/06`, *«lo que este capítulo NO
   cierra»*; mediciones del 2026-09-29, M-2). **Si IPN empieza a traer algo que Webhooks no trae**,
   es un cambio de `WH-6` y avisa como cualquier otro.

**Ninguna credencial de producción la tiene un agente**: la corrida mensual y la manual en
producción las dispara una persona o el programador de la batería, nunca quien implementa.

**Lo que la batería no vigila, declarado**: el anuncio de discontinuación de la API de
devoluciones (`R-MP-01`, cap. 06 §10), que no es una medición sino un texto del proveedor, **se
sigue a mano**; y los correos que el proveedor le manda al cliente (`EX-3`), que no pasan por
nuestro código. **Y de `RP7` a `RP11`, las que no se puedan releer sobre un sujeto existente**:
se declaran *«vigiladas a mano»* al construir la batería, cada una por nombre (punto 1; revisión
del owner, casos vecinos, 2026-09-29, caso G-C).

**Y la batería es la que cierra las filas `UNKNOWN` en que se apoya una unidad ya terminada**
(FASES 6 y 7, owner 2026-09-30, D; `DEC-ARCH-016`): una unidad se da por terminada si cada fila
`UNKNOWN` en que se apoya tiene sus dos ramas escritas y una prueba por rama contra el proveedor
falso; la batería semanal la sigue midiendo, y **cuando la fila cierra, la rama que no vale se
borra**. Es el caso de las que el proveedor no deja fabricar a voluntad: `GR-2`, `PA-6` y `RC-8`
(`descomposicion.md` §2.7).

---

## 5. E2E: lo que hoy se hace a mano

El §62.4 lo dice sin ambigüedad: *«el objetivo es que cambios futuros no obliguen a repetir
manualmente todo billing»*. Los flujos críticos son los que mueven plata o cortan servicio:

1. alta y autorización de una suscripción, incluido **el checkout abandonado** que muere al vencer
   su ventana — **y son DOS plazos, así que son dos casos y no uno**: 72 h con tarjeta y 7 días
   corridos con pago manual (cap. 03, S3 y §3.4 punto 1, `DEC-SUB-016`);
2. el ciclo completo de **impago**, y **son dos caminos de vuelta, uno por método de pago**: con
   tarjeta, cobro fallido → grace → suspensión **con el preapproval cancelado** → vuelta por el
   checkout como sucesora (`DEC-SUB-019`); con pago manual, cuota impaga → grace → suspensión →
   regularización por `MP4`. **Y el caso de la pausa del proveedor por mora con la fila todavía en
   `ACTIVE`** (`S6` por su segundo evento, `DEC-MP-008`), incluida la sucesión en curso que la
   frena;
3. **cambio de plan** y **cambio de ciclo**, que no son el mismo mecanismo (`DEC-SUB-006`,
   `DEC-SUB-007`, `DEC-SUB-008`);
4. **pausa** y reanudación, las dos formas: al vencer y anticipada;
5. **cancelación** con servicio sostenido hasta el fin del período (`DEC-SUB-009`);
6. **revocación**: reembolso total más cancelación en un solo acto (`DEC-RF-001`) — **y un caso
   desde `PAUSED`** (owner 2026-09-26, `X-2`): el preapproval pausado se cancela (`EX-11`), la
   `subscription_pause` queda con `fin_real`, el servicio se corta como en `S22` y `RF1` nace por el
   total en el mismo acto; si la fila era predecesora, corre `S18`;
7. **contratación y vencimiento de un addon**, con el excedente que dispara (~~8~~ renumerado: la
   lista saltaba del 6 al 8; FASE 9 completa, `DB-3`);
8. ✚ **la migración de un plan retirado** (revisión del owner, 2026-09-28, C15; `B/10` §3.7): el
   anuncio con sus tres correos, `S37` mutando el monto sobre la misma autorización siete días antes
   de la renovación, el cambio de versión en la renovación, y los que salen (el que cambió de plan,
   el que se dio de baja **y el que termina por otro camino, como la baja desde Mercado Pago o la sucesión de un suspendido**: verificación corta, 2026-09-29, lote M-A) y los que esperan (el pausado, el que está en grace); **el pagador manual, que cambia de versión sin mutar nada (lote M-B), y el barrido entre `S37` y `S38`, que no marca divergencia (lote M-C)** (verificación corta, 2026-09-29).

**Lo que E2E no reemplaza** es el smoke contra el proveedor real: el §62.3 existe porque el stub y
el real pueden divergir, y un E2E que corre contra el stub hereda esa divergencia entera.

### 5.1 Lo que hace falta para que el E2E reemplace el smoke manual

(Revisión del owner, 2026-09-28, N3 y `L3-e`.) Cuatro piezas, cada una con su unidad:

1. **El Mercado Pago falso corre también como servidor HTTP**, no sólo en memoria: así la API, la
   web y el admin construidos le hablan igual que al real, y el E2E ejercita las mentiras del §3.2
   (el enlace roto, el aviso tarde o repetido, el «ok» que no aplica) con las mismas tres reglas
   (miente por defecto, se apaga nombrándola). **Lo construye `B1`**, porque es el mismo falso.
2. **Un reloj que se puede adelantar en las pruebas**, para el sistema entero: la ventana de
   autorización, el grace, la pausa en meses, la prueba gratis, los avisos a 30 y a 7 días, la
   retención de 90 y 180 días. Sin él, lo que el smoke hoy «espera» no se puede automatizar. **Lo
   construye `B1`**, y como lo usan las dos mitades **no puede vivir en ninguna de las dos**: `G14`
   prohíbe que una importe a la otra (`V/20` §2). ~~Dónde vive es de la FASE 5.~~ **Vive en un
   package de pruebas compartido que importan las dos mitades** (revisión del owner, casos
   vecinos, 2026-09-29, caso 31): no es de ninguna, así que importarlo no cruza la frontera de
   `G14`, y ningún build de producción lo importa (la técnica de `G13`). **La interfaz del reloj que
   lee el código de producción vive en el package del contrato** (`12-contrato…` §7.1, la quinta
   cosa): el adelantable la implementa, y `G14` no cambia (revisión del owner, casos vecinos,
   2026-09-29, caso G-B). **La construye `B1`, con el adelantable** (revisión del owner, casos
   vecinos, 2026-09-29, caso I-E). **La implementación real, la hora del sistema, la inyecta la raíz
   de composición de `apps/api`, el único lugar que junta las dos mitades; en las pruebas se inyecta
   el adelantable** (revisión del owner, casos vecinos, 2026-09-29, caso J-A). **La línea de esa
   raíz que inyecta el reloj real la escribe `B1`** (revisión del owner, casos vecinos, 2026-09-29,
   caso K-C).
3. **Cada flujo del §5, y el trial completo de `V/20` §5, como prueba de punta a punta** contra los
   builds, con el falso como servidor, el reloj adelantable y el correo capturado, con aserciones
   sobre el contenido de `B/19` §4 y sobre el orden *«nuestro correo antes que el del proveedor»*.
   **Cada unidad escribe la de su flujo**: el alta `B3`, la mora `B7`, los cambios, la pausa y la
   cancelación `B8`, la revocación `B5`, el addon `B10` y la migración `B12`.
4. ~~**El recorte del checklist de smoke manual, sección por sección**: cada sección del checklist
   de staging que tenga su prueba de punta a punta **sale del manual**, con el nombre de la prueba
   que la reemplaza al lado. El ahorro llega de a poco y cada recorte tiene evidencia. **Lo lleva
   `B13`**, **y en el mismo cambio en que una sección sale del manual actualiza la regla de smoke
   del `CLAUDE.md` raíz** (hoy exige el smoke manual de staging a todo PR de billing), a medida que
   exista el E2E de cada sección y no antes (revisión del owner, casos vecinos, 2026-09-29, caso
   32).~~ **El recorte del checklist viejo se retira por quedar sin sujeto: el checklist viejo vive en `staging` y gobierna al sistema viejo hasta el corte, y el nuevo de `B13` lo reemplaza con el corte** (FASES 6 y 7, lote de la aplicación, owner 2026-09-30, L). **Y `B13` escribe~~, junto con ese recorte,~~ el checklist del sistema nuevo, en
   `docs/billing/` y en dos partes** (FASES 6 y 7, owner 2026-09-30, B; `F-8cC2-005`): **la de
   `staging`**, que se ejecuta dentro del ensayo del corte, y **la de producción**, que corre el
   owner en el paso 5c, después del paso 5, con su tarjeta y un monto aprobado de antemano: un
   checkout real por la página de la aplicación, su devolución, el correo que manda Mercado Pago,
   la caché del borde y los horarios de los crons el primer día (`16-fase-7…` §4.2 y §4.7). Vive en
   `docs/billing/` y no en `.specs/`, que sale del repositorio al cerrar HOS-1352. **La regla del
   `CLAUDE.md` raíz ya apunta ahí desde `U1`**, que la reapunta en la rama al borrar `.qtm/`
   (`16-fase-7…` §4.6); **los tres checklists viejos siguen en `staging`**, restaurados en la rama
   de spec, y gobiernan al sistema viejo hasta el corte.

**Lo que queda manual, porque no se puede simular**:

- **el checkout real de Mercado Pago**: la página, la carga de tarjeta, la validación y el enlace
  que devuelve;
- **los correos que Mercado Pago le manda al cliente** (`EX-3`);
- **Cloudflare**: la caché del borde y la revalidación;
- **los horarios reales**: la hora de los crons y la de los lotes de cobro (M8).

Y la parte del smoke que en realidad verificaba *«Mercado Pago sigue portándose así»* la
reemplaza la batería del §4.1, no el E2E.

---

## 6. Una regla que atraviesa las cuatro capas

**Ninguna aserción se escribe sobre un código de estado.** Está medido nueve veces que este
proveedor devuelve `2xx` sobre operaciones que no aplicó (`D5`, cap. 04, núcleo). Un test que
afirma *«devolvió 200»* pasa exactamente igual con la operación aplicada y sin aplicar, que es la
definición de un test que no prueba nada.

**Se afirma sobre el estado releído**, campo por campo — que es la misma regla que el invariante
`D5` le impone al código de producción. El test y el sistema comprueban lo mismo de la misma
forma, y no por elegancia: si el test pudiera conformarse con menos, sería el test el que deja
pasar lo que el sistema no.
