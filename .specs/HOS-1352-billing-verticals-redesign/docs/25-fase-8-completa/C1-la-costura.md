---
title: "FASE 8 completa · C1 — La costura (el contrato entre las dos épicas)"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · C1 — La costura (el contrato entre las dos épicas)

Ataqué `12-contrato-de-cobertura.md` contra lo que cada épica produce y consume: la tabla de
emisión por estado (§2.6) contra la máquina de suscripción (`B/03` §3.2), las clases de fuente
(§2.4) contra el pliegue (`V/15` §2.6) y la máquina de trial (`V/03` §2), el aviso (§3) contra
sus consumidores reales (`V/03` §9, `V/02` §3), la dirección inversa (§4.1) contra `B/10`, y lo
que ve verticales durante una sucesión, una pausa, una cortesía, un grant y una discontinuación.

Son **13 hallazgos**: **1 CRITICA**, **5 ALTA**, **5 MEDIA**, **2 BAJA**. La idea más grave en
una línea: **la discontinuación de una vertical no llega a la cobertura** — el contrato no
consulta `situaciónDeVertical`, así que grants, cortesías en curso y trials nuevos siguen
cubriendo (y publicando) en una vertical cerrada, y el `PB2` del día del fin de servicio no
puede disparar porque su evento es un cambio de `cubierto` que para esa gente no ocurre.

El segundo patrón, repetido en cuatro hallazgos: **el contrato declara QUÉ es cubierto pero no
CUÁNDO se entera verticales** — nadie especifica qué transiciones de billing emiten el aviso, ni
su durabilidad, ni qué pasa cuando un `hasta` vence sin transición; las redes de relectura existen
sólo para los actos que QUITAN (archivar, borrar), nunca para los que DEVUELVEN.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8CC1-001 — Discontinuar una vertical no apaga la cobertura: grants, cortesías y trials nuevos siguen cubriendo y publicando después del fin de servicio

**Qué se rompe.** La operación «discontinuar una vertical» no se puede completar. Tres fuentes
siguen dando `cubierto: sí` en una vertical que dejó de prestarse, y el barrido del día del fin de
servicio no las puede despublicar: invoca `PB2`, cuyo evento es *«`cubierto` pasa a falso»*, que
para esa población no ocurre. Resultado: fichas públicas y capacidades comerciales vivas en una
vertical sin pricing ni Mi Cuenta, **para siempre** en el caso del grant.

**El camino.**

1. Juan tiene un *Free Forever* con ancla en Gastronomía (`permanent_grant_vertical`, plan de
   Gastronomía). Ana tiene su suscripción de Gastronomía en `PAUSED` por `COURTESY` con 100 días
   por delante. Pedro está en `PRE_TRIAL` de Gastronomía sin haber publicado.
2. `SUPER_ADMIN` discontinúa Gastronomía. Día 0: `S26/S27/S28` recorren las **suscripciones**;
   nada toca el grant (no es una suscripción) ni la pausa (`DEC-SUB-015` la deja afuera).
3. Pedro publica el día 5: `T1` mira *«la vertical declara evento y días > 0 y `cubierto` falso»*
   — **no mira `admite_altas`** — y le arranca un trial. `TRIAL_ACTIVE` es de clase `TÍTULO`.
4. Día 60, fin de servicio. El barrido aplica «`PB2`» a las fichas. Para Juan, `cobertura()`
   devuelve la fuente `GRANT` con `hasta: NO_VENCE` (el ancla sigue viva); para Ana, la fuente
   `CORTESÍA` con `hasta` a 40 días. `cubierto` no cambió: el evento de `PB2` no ocurre.
5. Si el barrido fuerza la transición igual, es una transición con su evento falso (regla 1 del
   núcleo); si no la fuerza, las fichas quedan `PUBLISHED`. En los dos casos `PB4` relee a los 90
   días, encuentra `cubierto` verdadero y **reinicia el reloj** en vez de archivar; y la segunda
   rama de `PB3` puede republicar la de Juan en cualquier recálculo porque su cupo alcanza.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:550` §2.8:

> **La fuente `GRANT` de una vertical existe mientras el ancla de esa vertical esté VIVA.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:683-684` §4.1 (la
situación de la vertical sólo viaja hacia billing):

> políticaDePlan(versiónDePlan)  → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }
> situaciónDeVertical(vertical)  → { admiteAltas, finDeServicio }

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:95-96`:

> **Las dos columnas de `vertical` no son de adorno: son la mitad declarada de la frontera.**
> `admite_altas` y `fin_de_servicio` las **lee billing** (`B/10` §4.6)

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:141`:

> **Día 0 — el anuncio.** La vertical deja de admitir altas y trials.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:44` (`T1`,
sin `admite_altas`):

> | T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso** |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:234`:

> **El día del fin de servicio.** Las fichas pasan a `UNPUBLISHED_BY_BILLING` por PB2 del capítulo
> 03 §9

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:294`:

> | PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:207-208`
(la cortesía que cruza el fin de servicio es el caso normal):

> El tope de **una** pausa son 120 días (`B/03` §5) y el piso
> del §4.4 son 60, así que **una pausa que sobrevive al piso es el caso normal**

Verificado por ausencia: `rg -i "discontinu|fin_de_servicio|admite"` sobre `V/03`, `V/11`, `V/15`
y `V/17` no devuelve ninguna regla que condicione cobertura, trial o autorización a la situación
de la vertical; `B/14` sólo la nombra para el saldo diferido de cortesía (§4.6), nunca para el grant.

**Severidad**: `CRITICA`. Una operación declarada y cerrada (`M-SUB-03`) no se puede ejecutar
hasta el final: deja servicio público y trials nuevos en una vertical que el anuncio dio por
cerrada, sin límite de tiempo para los grants.

**Necesita decisión del owner**: **sí**. Qué le pasa a un grant anclado a una vertical
discontinuada (¿se retira el ancla?, ¿con qué acto del catálogo `NUCLEO/08` §3?) y a la cortesía
que cruza el fin de servicio es política; que `T1` y el contrato tengan que leer la situación de la
vertical es corrección de diseño.

---

## ALTA

### F-8CC1-002 — Un alta cuyo primer cobro se rechaza le quema el trial para siempre: `ACTIVE` sin ningún pago ya es un `TÍTULO` y dispara `T2`

**Qué se rompe.** Quien está en `TRIAL_ACTIVE` y se suscribe pierde irreversiblemente el resto de
su trial aunque la suscripción **no llegue a existir** (el proveedor la cancela al rechazar el
primer cobro). El diseño llama a eso *«un alta que no ocurrió»*, pero la frontera la trata como un
título durante 26-44 minutos, y `T2` es de una sola vía.

**El camino.**

1. Juan está en `TRIAL_ACTIVE` de Alojamiento con 20 días por delante.
2. Se suscribe: `S1` → autoriza → `S2` → `ACTIVE`. La fila emite `SUSCRIPCIÓN` con
   `SIN_FECHA_CONOCIDA` (clase `TÍTULO`).
3. El aviso despierta a la máquina de trial: `T2` → `TRIAL_CONVERTED`. No hay vuelta.
4. A los 30 minutos el primer cobro es rechazado por el antifraude (`cc_rejected_high_risk`, el
   caso que `B/19` fila 19 dice que *«su tarjeta está bien»*): `S16` → `CHARGE_DECLINED`.
5. Juan queda con `cubierto: no`, `PB2` le baja la ficha, y **no tiene trial ni suscripción**. El
   trial es único de por vida y ninguna fila de `V/11` §2 lo repara (la reparación del §2.3 es
   sólo para la moderación equivocada).

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:123` (`S2`):

> la fila **pasa a emitir fuente** (`12-contrato…` §2.6) y ese cambio de cobertura es lo que mueve el trial, si había uno (`V/03` §2, `T2`)

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:45`:

> | T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` | — |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:268-270`:

> un primer cobro rechazado **no es una suscripción con un problema, es un alta
> que no ocurrió**.

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:344`:

> | `ACTIVE` | **sí** | `SIN_FECHA_CONOCIDA` | se renueva sola; el fin no está determinado |

`PA-3` (matriz) mide el primer cobro entre 26 y 44 minutos después de autorizar, citado en
`B/12` §4.3 (`12-suscripcion.md:251-253`). El contrato ya razonó el caso vecino al revés
(`PENDING_AUTHORIZATION` no emite porque *«no vale nada»*, §2.6 línea 355-361), pero no el de un
`ACTIVE` que todavía no cobró nada de esa autorización.

**Severidad**: `ALTA`. Pérdida real e irreversible del activo que la persona tiene una vez en la
vida, sobre un camino ordinario (tarjeta rechazada al suscribirse durante el trial). No es plata.

**Necesita decisión del owner**: **sí**. Hay dos correcciones distintas (que `T2` espere al
primer pago acreditado de la autorización, o una reparación declarada cuando la conversión la hizo
una fila que terminó en `CHARGE_DECLINED`) y elegir es política de trial.

---

### F-8CC1-003 — El trinquete del grant vive en una tabla de billing y el contrato no lo transporta: verticales no puede aplicarlo sin leer billing

**Qué se rompe.** El paso 6 tiene que aplicar *«un grant nunca otorga menos de lo que otorgaba el
día que se concedió»*, y el piso de ese trinquete es
`permanent_grant_vertical.piso_del_trinquete`, una columna **de billing**. La fuente `GRANT` del
contrato transporta una sola `referencia` (la versión vigente). O verticales lee la tabla de
billing —el acoplamiento no declarado que la regla de vigilancia del §4.2 manda detectar—, o no
aplica el trinquete y el *Free Forever* pierde capacidades en el primer recorte del plan.
Además, la implementación de arranque no puede probarlo nunca: no tiene grants.

**El camino.**

1. Juan recibe un *Free Forever* anclado a Premium de Alojamiento, versión v3 (20 fotos). Billing
   guarda `piso_del_trinquete = v3`.
2. Se publica v4 de Premium con 15 fotos.
3. `cobertura(Juan, ALOJAMIENTO)` devuelve `{tipo: GRANT, referencia: v4, …}`. No hay campo por
   donde viaje v3.
4. Implementador A pliega sólo v4: Juan pasa a 15 fotos y el reconciliador le despublica 5
   (incumple `V/15` §2.5). Implementador B hace que `V3` consulte `permanent_grant_vertical`:
   verticales lee una tabla de billing sin contrato.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:84-94` §2 (la
firma; la fuente tiene `tipo`, `referencia`, `alcance`, `objetivo`, `hasta` y nada más):

> referencia: versiónDePlan | versiónDeAddon        ← NO anulable

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:417`:

> | **`permanent_grant_vertical`** | **el ancla, una por vertical del scope**: el grant, la vertical, **el `plan` que otorga en esa vertical** y **el piso del trinquete de esa vertical** |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:115-117`:

> **Y se compara POR VERTICAL, que es la parte que la resolución no puede deducir sola.** La
> resolución de un `user + vertical` toma **la fuente `GRANT` de esa vertical** —con el plan de esa
> vertical y el piso de esa vertical— y **ninguna otra**.

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:743-745` §4.2:

> **Regla de vigilancia**: si aparece **un lugar que necesita algo de billing y no figura en la
> fila `cubierto` del §2.1** —y no es este hecho—, es señal de que el corte se está filtrando.

**Severidad**: `ALTA`. La lectura fiel del contrato rompe una garantía declarada a una población
concreta (los beneficiarios de *Free Forever*); la otra lectura viola el corte de `DEC-ARCH-005`.

**Necesita decisión del owner**: **no**. Es corrección de diseño: o la fuente gana un campo (la
referencia del piso), o se declara el trinquete como resuelto de otra forma. Ninguna cambia
política.

---

### F-8CC1-004 — La pausa pedida por el cliente sigue cobrando sus addons recurrentes, y el pliegue los descarta: paga meses de algo que no recibe, sin aviso

**Qué se rompe.** El contrato saca a `PAUSED` por `CUSTOMER_REQUEST` de la cobertura y descarta
los complementos cuando no hay título. Billing no deja huérfano al addon durante la pausa (la fila
sigue viva), así que su suscripción de complemento **sigue cobrando** hasta 4 meses. El cliente
paga el addon todos los meses y el paso 6 no le da nada. `DEC-ADDON-001` declaró esa pérdida para
la **suspensión**; para la pausa —un producto que vendemos y que *«parece que sólo suspende el
cobro»*— no está declarada y la superficie no la dice.

**El camino.**

1. Juan tiene Alojamiento `ACTIVE` y un addon recurrente de scope `VERTICAL_SUBSCRIPTION`
   (+30 fotos), con su propio preapproval (`DEC-ADDON-002`).
2. Pide pausar 4 meses (`S8`). Se pausa el preapproval **principal**; el del complemento no.
3. `cobertura()` ya no emite `SUSCRIPCIÓN`; emite la fuente `ADDON` (clase `COMPLEMENTO`). Sin
   título, `V/15` §2.6 la descarta.
4. El complemento cobra 4 veces. `B/19` fila 5-bis le habló sólo de la ficha.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:346`:

> | `PAUSED` por `CUSTOMER_REQUEST` | **no** | — | `B/16` §2.2: *«el servicio está detenido»* |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:130-132`:

> **El conjunto plegable de un `user + vertical` son sus fuentes de clase `TÍTULO` y `BASE`, más
> las de clase `COMPLEMENTO` SÓLO SI hay al menos una de clase `TÍTULO` viva.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:515-520`:

> **La suspensión y la pausa no dejan huérfano a nada** […] El addon sigue su curso y **su reloj no se congela** (`DEC-ADDON-001`), con la consecuencia ya
> registrada de que un suspendido dos meses pierde dos meses de algo que pagó, y con la obligación
> de que el aviso de suspensión lo diga.

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:260-262` (lo que el
contrato dejó abierto nombra sólo la suspensión):

> **Lo que esto NO decide**: si el cliente pierde días de addon que pagó mientras su suscripción está
> suspendida.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:109` (fila 5-bis, la pausa): sólo
*«qué le pasa a la ficha mientras dure la pausa»*; la de los días de addon es la fila 10, que es
la de **suspensión** (`19-superficies.md:113`).

**Severidad**: `ALTA`. Plata cobrada por servicio que el propio diseño decide no prestar, a toda
persona que pausa con un addon recurrente; recuperable sólo a mano. No es `CRITICA` porque la
instancia sigue viva y el cobro es el pactado: lo que falta es la decisión y el aviso.

**Necesita decisión del owner**: **sí**. Pausar el complemento junto con el principal, o aceptar
el cobro y avisarlo, es política comercial.

---

### F-8CC1-005 — Si se pierde el aviso de que la cobertura VOLVIÓ, las fichas del que paga quedan abajo sin límite: la relectura existe sólo para los actos que quitan

**Qué se rompe.** `PB3` y `PB7` (restituir) se disparan **sólo** por el evento; `PB4`, `PB5` y el
hard delete (quitar) releen. El contrato admite que el push se pierde y ninguna épica declara qué
transiciones lo emiten ni con qué durabilidad (no está en el outbox de `NUCLEO/07`). Con el aviso
de `cubierto → verdadero` perdido, la ficha queda en `UNPUBLISHED_BY_BILLING`, `PB4` la encuentra
cubierta a los 90 días y **reinicia el reloj sin republicarla**, y el dueño no tiene transición
propia para sacarla de ahí (`PB1` sale sólo de `DRAFT`).

**El camino.**

1. Juan pausa (`S8`): `PB2` baja sus 3 fichas.
2. Reanuda (`S10`) y paga. El aviso *«la cobertura cambió»* se pierde.
3. `PB3` no dispara (su evento no llegó). El caché, si no se invalidó, cae en la regla 2 de
   `V/02` §3.2 (entrada sospechosa), que arregla capacidades y no mueve publicaciones.
4. Día 90: `PB4` relee, `cubierto` verdadero, no archiva y escribe `inactiva_desde`. Se repite cada
   90 días. Juan paga el plan y sus fichas no se ven, indefinidamente.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:632-636` §3:

> Y como un push se puede perder,
> **los TRES actos que avanzan sobre ese reloj vuelven a preguntar en el momento de ejecutar** […] El aviso perdido cuesta un
> retraso en el reinicio, jamás un archivado —ni un borrado— sobre alguien que ya volvió.

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:295`:

> | PB3 | `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie** | `PUBLISHED` |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:319-320`:

> si el `user + vertical` está cubierto, no archivan y **reinician el
> reloj** escribiendo `listing.inactiva_desde`

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:616`:

> Es lo único que billing le **empuja** a verticales.

Verificado por ausencia: `rg -i "cobertura"` cruzado con `aviso|evento|emit|empuj` sobre toda
`HOS-1354-…/docs` sólo devuelve las celdas de `S2`, `S23`, `S27`, `S29`, una línea de `B/12` y la
fila 8 de `B/19`, que dicen que la fila *emite fuente* o que el servicio se corta, nunca que se
emita el aviso; `NUCLEO/07` no tiene el evento en
su catálogo.

**Severidad**: `ALTA`. Un cliente al día invisible sin fecha de fin, sin señal para él y sin
transición para salir solo. Acotado a los avisos perdidos, que el propio diseño declara posibles.

**Necesita decisión del owner**: **no**. Es simetría de una red que ya existe (releer al
restituir, o un emisor durable); no cambia política.

---

### F-8CC1-006 — El pliegue deja que un addon global aporte en una vertical cuyo único título es un trial, contra la regla de `V/11` §5.3 y el §64.7

**Qué se rompe.** El contrato clasifica `TRIAL` con fecha como `TÍTULO`, y `V/15` §2.6 admite los
complementos **si hay algún título**. `V/11` §5.3 dice lo contrario para los addons `USER`/`GLOBAL`
y el trial. La regla de `V/11` no tiene gate: el capítulo que pliega no la conoce y `G-R2` sólo
vigila «complemento sin ningún título». Es la misma forma que el contrato critica en su §2.4:
*«una frase no es un gate»*.

**El camino.**

1. Juan tiene Alojamiento `ACTIVE` y compró un addon `GLOBAL` (un destaque en todo el sitio).
2. Empieza un trial de Gastronomía (`T1`, `TRIAL_ACTIVE`, clase `TÍTULO`).
3. `cobertura(Juan, GASTRONOMÍA)` trae `TRIAL` (`TÍTULO`) + `ADDON GLOBAL` (`COMPLEMENTO`).
4. `V/15` §2.6: hay un título vivo, así que el complemento entra. El trial recibe el addon.

**Dónde lo permite el diseño.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/11-trial.md:249-250`:

> **Un addon de scope `USER` o `GLOBAL` no aporta nada a una vertical cuyo único título es un
> trial.**

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:130-132`
(cita en F-004): complementos admitidos *«SÓLO SI hay al menos una de clase `TÍTULO` viva»*.

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:179`:

> | **`TÍTULO`** | `tipo ∈ {TRIAL, SUSCRIPCIÓN, CORTESÍA, GRANT}` **y `hasta ≠ SIN_EMPEZAR`** | **sí** |

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/17-autorizacion.md:193-194` da la
regla de `V/11` por vigente: *«un addon global **no** aporta a una vertical cuyo único título es un
trial»*. El PDR: `00-PDR.md:2233`, *«No se pueden comprar addons durante trial.»*

**Severidad**: `ALTA`. Acceso indebido a una capacidad paga en el trial, por la lectura literal del
capítulo que ejecuta. Acotado a la población con addon global y un trial en otra vertical.

**Necesita decisión del owner**: **no**. `V/11` ya decidió; falta llevarlo al pliegue y al guard.

---

## MEDIA

### F-8CC1-007 — «Está pagando las dos» es falso: durante el incidente de la doble emisión el cliente suma dos planes con el crédito de uno solo

**Qué se rompe.** El contrato justifica no desempatar dos fuentes `SUSCRIPCIÓN` diciendo que el
cliente paga las dos. Pero la sucesora nació con el crédito de lo pagado y no usado de la
predecesora (`DEC-SUB-006`, computado al crearla). Lo que la predecesora sigue emitiendo es un
período que ya se transfirió como crédito. Con `SUMA`, Básico (5 fichas) + Premium (20) da 25, y
el cliente publica hasta 25 pagando uno solo; al resolverse, el reconciliador despublica 5.

**El camino.**

1. Juan en Básico `ACTIVE` pide Premium. La sucesora nace con la fecha de primer cobro corrida por
   su crédito.
2. Autoriza (`S2`); `S17` falla al cancelar la predecesora, que el proveedor sigue viendo viva:
   marca puesta, las dos filas emiten.
3. `fuentes` trae dos `SUSCRIPCIÓN`; el pliegue suma los limits. Juan publica 25 fichas.
4. Una persona resuelve días después; la predecesora deja de emitir y el excedente cae.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:390-395`:

> **Dos fuentes `SUSCRIPCIÓN` de clase `TÍTULO` para el mismo `user + vertical` son posibles, y
> sólo en ese caso.** El contrato no las desempata […] **No se desempata porque en esa rama el cliente está pagando las dos**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:630`:

> El crédito se computa **al crear** la sucesora (`DEC-SUB-006`)

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1162-1164`:

> Y lo pagado sin usar **no se pierde**: la
> sucesión del arrepentimiento computa el crédito de `DEC-SUB-006` como cualquier otra, *«al crear
> la sucesora»* (`B/12` §5.4), corriendo la fecha de su primer cobro.

**Severidad**: `MEDIA`. La premisa que sostiene la regla es falsa; el daño es capacidad de más
durante un incidente con una persona mirándolo, y se corrige solo al resolverlo.

**Necesita decisión del owner**: **no**. La razón tiene que reescribirse, y quizás la regla
(desempatar por la sucesora, que es la que tiene el crédito); es corrección de diseño.

---

### F-8CC1-008 — `hasta: fecha` no significa «fin de la cobertura»: el aviso con ventana miente sobre la cortesía, y el contrato y `V/15` §4.4 se contradicen sobre el trial

**Qué se rompe.** El §2.6 le dice al aviso que `fecha` es *«hay ventana, y es ésta»*. Dos casos no
lo cumplen:

- **Cortesía**: `PAUSED` por `COURTESY` emite `CORTESÍA` con la fecha de fin de la cortesía, pero
  lo normal ese día es `S10` → `ACTIVE`, que emite `SUSCRIPCIÓN` **con la misma versión anclada**.
  No se pierde nada, y `V/15` §4.4 igual le promete una ventana para elegir el excedente. Como el
  estado de la suscripción no cruza (§4), verticales no puede saber que detrás viene una
  suscripción.
- **Trial**: el contrato pone *«fin del trial»* entre los `fecha` con ventana y dice que `V/15`
  §4.4 reparte igual; `V/15` §4.4 pone *«fin del trial»* entre los que **no** tienen ventana.

**El camino.** Ana recibe 30 días de cortesía. El día 23, el aviso con ventana le dice que el día
30 pierde capacidades y la invita a elegir qué fichas conservar. El día 30 `S10` la reactiva con el
mismo plan: el aviso era falso. Para el trial, dos implementadores del aviso siguen documentos
distintos y el resultado difiere.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:315`:

> | **`fecha`** | el fin ya está determinado: `CANCEL_SCHEDULED` con la fecha de `DEC-SUB-009`, fin de cortesía, vencimiento de un addon `DÍAS_FIJOS`, fin del trial | hay ventana, y es ésta |

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:320-321`:

> `V/15` §4.4 reparte las ventanas exactamente por esa diferencia

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/15-entitlements-y-limits.md:347-348`:

> | downgrade programado (`DEC-SUB-008`) · vencimiento de un addon · fin de una cortesía | **sí** — la fecha se conoce de antemano y el aviso sale antes |
> | revocación de un grant · suspensión · fin del trial | **no** — se aplica en el acto |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:556-557` (la cortesía
transporta la misma referencia que la suscripción):

> la referencia que transporta el `tipo: CORTESÍA` es **la versión
> anclada de la suscripción que pausa** — la misma que llevaría `SUSCRIPCIÓN`.

**Severidad**: `MEDIA`. Dos implementadores resuelven distinto, y la lectura del contrato produce
un aviso de pérdida falso a toda persona con cortesía.

**Necesita decisión del owner**: **no**. Hay que decir que `hasta` es el fin de la **emisión**
(como ya dice la línea 323), no de la cobertura, y dar una regla del aviso que no dependa del
estado de la suscripción; y alinear el trial en uno de los dos documentos.

---

### F-8CC1-009 — Una fuente que vence por fecha no produce aviso ni invalida el caché: la «segunda línea» del §2.6 no llega a los consumidores que deciden

**Qué se rompe.** El §2.6 agrega que una fuente con `hasta: fecha` deja de emitirse al pasar la
fecha, **como red para un estado atascado**. Pero esa desaparición no es una transición: no hay
aviso (`PB2` no dispara), y el caché se invalida por evento y no por tiempo, así que el paso 6 sigue
otorgando desde la entrada cacheada. La red sólo la ven las consultas en vivo; los tres consumidores
que actúan (`PB2`, el caché y el reconciliador) no se enteran hasta que corra el job atascado, que es
justo lo que la red suponía que no pasa.

**El camino.**

1. Juan en `CANCEL_SCHEDULED` con fin de servicio el día 10. El job de `S12` no corre.
2. Día 10: `cobertura()` en vivo ya no trae la fuente. No hay transición, así que no hay aviso ni
   invalidación.
3. Las fichas siguen `PUBLISHED`, la entrada del caché sigue otorgando, y la única red es la mitad
   `PUBLISHED` de `PB4`, a 90 días de la última escritura de `inactiva_desde`.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:323-324` y `331-333`:

> **El `hasta` es el fin de la emisión, no una etiqueta: una fuente con `hasta: fecha` deja de
> aparecer en `fuentes` cuando esa fecha pasa.**

<!-- -->

> La máquina que
> emite la fuente es la responsable de tener salida; este renglón es la segunda línea, para que un
> estado atascado se note como fuente que se apaga

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/02-modelo-de-datos.md:369-371`:

> **La invalidación es explícita, y el vencimiento por tiempo es una red, nunca el mecanismo.**

La lista de invalidación (`V/02:375-386`) no tiene la fila *«vence el `hasta` de una fuente»*; el
TTL de la red no tiene valor declarado.

**Severidad**: `MEDIA`. Acotado por el TTL no declarado y por la red de `PB4`; la redacción promete
una defensa que para esos consumidores no existe.

**Necesita decisión del owner**: **no**. Hay que decir quién emite el aviso cuando una fecha vence,
o retirar la afirmación de que el renglón es una red.

---

### F-8CC1-010 — Una sucesora con tarjeta cubre hasta 72 horas antes de su primer cobro: el «se mide en minutos» de `B/12` §4.5 es falso para ella

**Qué se rompe.** `B/12` cierra el ciclo *«servicio sin pagar nunca»* argumentando que quien no
paga el primer cobro recibe *«minutos»* de servicio. Pero una sucesora nace con el primer cobro
**después** del vencimiento de su ventana (72 h con tarjeta), y el contrato hace emitir `ACTIVE`
desde `S2`. Desde `GRACE_PERIOD` el crédito es cero, así que el primer cobro es el primero que la
persona paga en todo el camino.

**El camino.**

1. Juan pagó el mes 1; el cobro del mes 2 falla → `GRACE_PERIOD` (servicio entero, §20).
2. Pide Premium (`DEC-SUB-003` lo permite en grace). La sucesora nace con el primer cobro a más de
   72 h.
3. Autoriza enseguida: `S2` → `ACTIVE` → emite `SUSCRIPCIÓN` Premium; `S17` mata la predecesora.
4. A las ~72 h el primer cobro se rechaza: `S16` → `CHARGE_DECLINED`. Juan tuvo 3 días de Premium
   sin pagar nada de esa autorización, además de su grace.

`B/12` §5.4 impide repetirlo desde un alta nueva sin pagar (la ventana reducida no se ofrece el
día del primer cobro), así que es una vez por ciclo pagado, no un bucle.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:339-340`:

> **Toda sucesora nace con fecha de primer cobro POSTERIOR AL VENCIMIENTO DE SU VENTANA DE
> AUTORIZACIÓN.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:302-304`:

> el que
> autorizó y no cobró muere en `CHARGE_DECLINED`, y el servicio que recibió se mide en los minutos
> de `PA-3`

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:330-331` (crédito cero en grace):

> **En grace, el período en curso no se pagó** — un cobro falló, que es la definición del estado.
> Entonces el crédito es **cero**

**Severidad**: `MEDIA`. Servicio de más, acotado (una vez por ciclo pagado, hasta 72 h) y en la
dirección que el grace ya eligió; pero la garantía escrita es falsa para una población concreta.

**Necesita decisión del owner**: **sí**, si se quiere cerrar (que una sucesora sin crédito no
emita hasta su primer pago es política); **no**, si sólo se corrige la afirmación.

---

### F-8CC1-011 — El censo de consumidores de `cubierto` y la lista de consumidores del aviso omiten la máquina de trial

**Qué se rompe.** El contrato declara que la fila `cubierto` del §2.1 es *«EL censo de sus
consumidores»* y que la regla de vigilancia pregunta *«¿está en esta fila?»*. `T1` y `T6` leen
`cubierto` y no figuran. El §3 dice que el aviso alimenta **tres** cosas y no nombra la máquina de
trial, que `V/03` §2 ata a ese mismo aviso (`T2`, `T5`). Quien implemente el emisor real contra el
§3 puede no despertar al trial: la persona se suscribe y queda con **dos títulos** (su plan y el
trial derivado del plan de `rank` más alto) hasta que el trial venza. Es el caso que `V/03` describe
como *«paga el básico y opera con las capacidades del premium»*.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:106` (la fila del
censo: `PB2`, `PB3`, `PB7`, `PB4`, `PB5`, el hard delete, el cap. 15 §6, el reconciliador y el
reloj; no `T1` ni `T6`).

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:616-617`:

> Es lo único que billing le **empuja** a verticales. Lleva qué fuente cambió y en qué dirección, y
> alimenta **tres** cosas que ya existen en el diseño

`.specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:93-95`:

> **Y es el mismo mecanismo que el §9 ya eligió para `PB2` y `PB3`**: atarse al hecho que el
> contrato emite —*«la cobertura de (`user`, vertical) cambió»* (`12-contrato…` §3)

**Severidad**: `MEDIA`. El único mecanismo que el contrato tiene para detectar filtraciones (la
regla de vigilancia, sin guard, §4.2 línea 766-771) cuenta contra un censo incompleto.

**Necesita decisión del owner**: **no**. Hay que agregar `T1`/`T6` al censo y la máquina de trial a
los consumidores del §3.

---

## BAJA

### F-8CC1-012 — El párrafo de «cae al piso» mete a `S13` entre los que dejan al cliente sin nada, y remite a filas de superficie que no lo dicen

`.specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md:369-381` enumera
`S12`, `S13`, `S16` y el espejo, y dice que en las cuatro *«el cliente cae al piso (§2.5) por lo
que le quede de ventana, hasta que autorice o abandone»*, exigiendo que lo diga `B/19` §4, filas
16 y 16-bis. Dos errores:

- **`S13` no deja a nadie en el piso ni con una sucesora esperando**: cancela *«toda fila viva
  PRINCIPAL»*, sucesora incluida, y el grant es de clase `TÍTULO`
  (`03-maquinas-de-estado.md:237-238`: *«`S13` alcanza a **toda fila viva principal** del
  beneficiario, o sea también a la sucesora»*).
- Las filas 16 y 16-bis (`19-superficies.md:122-123`) dicen que el cambio o el alta **no se
  ofrecen**. Ninguna le dice al cliente que perdió la cobertura y que sus fichas bajaron hasta que
  autorice.

**Severidad**: `BAJA`. Es redacción, pero quien construya la superficie desde el contrato va a
buscar un aviso que no existe.

**Necesita decisión del owner**: **no**.

### F-8CC1-013 — `B/10` §3.5, dueño declarado de la regla de dirección, sigue describiendo que billing deriva el delta y no nombra el veredicto

El contrato §4.1 (`12-contrato-de-cobertura.md:703`) decide *«La comparación la hace verticales,
que es dueño de las tablas, y billing recibe un VEREDICTO»*, y en la línea 733 dice que la regla
*«está escrita en `B/10` §3.5»*. Pero `B/10` §3.5
(`10-verticales-planes-billing-options.md:93-98`) sigue diciendo *«La dirección se deriva del
delta entre las dos versiones […] si algo baja —un limit, un entitlement, una cuota»*, sin nombrar
`direcciónDeCambio`. `rg "direcciónDeCambio"` sobre `HOS-1354-…/docs` no devuelve nada; sólo
aparece en `descomposicion.md`. Quien implemente `B8` leyendo su capítulo va a leer las tablas de
verticales.

**Severidad**: `BAJA`. **Necesita decisión del owner**: **no**.

---

## Ataques que intenté y el diseño resistió

- **Cobertura perpetua de `PRE_TRIAL`.** El `hasta: SIN_EMPEZAR` la saca de `TÍTULO`
  (`12-contrato…:179-180`), y `T1`/`T6` quedan decididos sólo por fuentes ajenas al trial
  (`V/03:188-192`).
- **El suspendido que conserva su addon.** Doble cierre: `cubierto` sólo cuenta `TÍTULO` y el
  pliegue descarta `COMPLEMENTO` sin título, con guard `G-R2` (`V/15:130-132`, `:170-174`).
- **Un grant que filtra capacidades entre verticales.** El ancla por vertical, con
  `UNIQUE(permanent_grant_id, vertical)` y «el plan pertenece a esa vertical», impide la fila mala
  (`B/02:417`, `:590-593`).
- **La fuente `ADDON` que se mueve al publicar una versión.** La referencia sale de la instancia,
  nunca del producto (`B/02:433-436`).
- **`PENDING_AUTHORIZATION` como cobertura gratis y repetible.** No emite (`12-contrato…:342`,
  `:353`).
- **Bucle alta → cambio de plan → sucesora de 72 h sin pagar nunca.** Lo corta la ventana
  reducida: con el próximo cobro de la predecesora hoy, lo que queda es menor que el mínimo y el
  cambio no se ofrece hasta después del cobro (`B/12:667-673`). Queda sólo el caso de F-010,
  acotado a un ciclo pagado.
- **Cortesía que falla al reanudar y sigue cubriendo.** La regla de `hasta` la apaga en la fecha, y
  `B/03` §3.2 (`S10`) quiere exactamente eso (*«cubre y no cobra»* es lo que rechaza,
  `B/03:539-544`).
- **El hard delete del día 180 sobre un suspendido que «conserva datos».** Es la política
  aceptada en `DEC-DATA-001` (`01-decision-log.md:877-884`), con avisos y `PB8` alcanzable.
- **`S6` por pausa del proveedor durante una sucesión.** La predecesora sigue emitiendo, pero el
  preapproval pausado no cobra y el caso está acotado por la ventana de la sucesora
  (`B/03:127`).
- **La pausa larga que llega al borrado.** `D16` más el hecho 2 del reloj más la rama de fallo y el
  detector de `S10` (`NUCLEO/01:156-161`, `B/03:507-516`).

## Fuera de mi vector

- `B/12` §5.4 calcula la ventana reducida con *«la próxima fecha de cobro de la predecesora»*;
  para una predecesora en `GRACE_PERIOD` con la cuota en reciclaje, no vi dicho qué fecha es (la
  fallida, ya pasada, bloquearía el cambio que `DEC-SUB-003` promete). `12-suscripcion.md:667-669`.
  Le toca a quien ataque la sucesión.
- `B/10` §4.3 no dice qué pasa con un addon `DÍAS_FIJOS` (no recurrente) ya comprado en una
  vertical discontinuada: el acto recorre las suscripciones de complemento, que un addon de pago
  único no tiene. `10-verticales-planes-billing-options.md:143-145`.

## Key Learnings

1. El contrato separa bien *qué es cubierto* (clases, `hasta`, referencia no anulable) y deja sin
   especificar *cuándo se entera verticales*: no hay mapa de transiciones que emiten el aviso, ni
   durabilidad, ni emisor para el vencimiento por fecha. Cuatro hallazgos (005, 008, 009, 011)
   salen de ahí.
2. Las redes de relectura se construyeron sólo para los actos que quitan (`PB4`, `PB5`, día 180).
   Los que devuelven (`PB3`, `PB7`) dependen de un push que el diseño declara perdible.
3. `situaciónDeVertical` viaja sólo hacia billing. Todo lo que en verticales depende de que una
   vertical esté cerrada (trial, cobertura por grant o cortesía, publicación) no la lee, y la
   discontinuación queda incompleta (001).
4. Tratar `ACTIVE` como título sin mirar si ya hubo un pago de esa autorización tiene dos costos
   que no estaban declarados: el trial quemado por un alta que no ocurrió (002) y la sucesora de
   72 h (010).
5. Todo dato que la resolución del paso 6 necesita y que vive en una tabla de billing tiene que
   viajar en la fuente: el piso del trinquete del grant no viaja (003).
6. Una regla escrita en un capítulo que no ejecuta (`V/11` §5.3) queda muerta frente al capítulo
   que pliega (`V/15` §2.6). Buscar reglas de pliegue fuera de `V/15` es un buen detector.
