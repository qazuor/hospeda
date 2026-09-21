---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1353
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
status: CURRENT
fase: 2
capitulo: 3
cierra:
  - M-SUB-01
  - M-CONC-02
---

# 03 · Las máquinas de estado

La mitad de verticales del capítulo 03 del programa: Trial, Publicación y Postulación de Partner. Las reglas de lectura comunes viven en el núcleo; Suscripción, Grace, Pausa, Pago, Pago manual, Addon y la regla de no-retroceso viven en la épica de billing.

---

## 2. Trial

**Alcance**: uno por `user + vertical`, de por vida (§10.1). No se reinicia por borrar la
ficha, crear otra, cancelar, volver, cambiar de plan ni registrarse de nuevo sobre la misma
identidad detectable (§10.2, `DEC-TRIAL-004`).

```text
                  T1 · evento de activación, y NO hay título
  PRE_TRIAL ───────────────────────────────────────────────────► TRIAL_ACTIVE
      │                                                            │      │
      │                          T2 · aparece un título ajeno      │      │ T3 · llega
      │                    ┌───────────────────────────────────────┘      │ la fecha de fin
      │                    │                                              ▼
      │                    ▼                 T5 · aparece un título
      └──────────► TRIAL_CONVERTED ◄──────────────────────────────── TRIAL_EXPIRED
       T6 · evento de activación,
            y SÍ hay título
```

| # | desde | evento | hacia | condición | efectos |
|---|---|---|---|---|---|
| T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso** | **crea la fila de `trial`**; se asigna el plan de trial; arranca el reloj; se agenda la campaña previa del §10.7 |
| T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` | — | se cancela la campaña previa; el acceso pasa a depender de esa fuente |
| T3 | `TRIAL_ACTIVE` | llega la fecha de fin | `TRIAL_EXPIRED` | **—** | arranca la campaña de recuperación y el reloj de retención; **la publicación la mueve `PB2`**, por el cambio de `cubierto` (§9) |
| T4 | `TRIAL_ACTIVE` | promo de extensión o cortesía | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de fin; **re-agenda** la campaña previa |
| T5 | `TRIAL_EXPIRED` | **aparece una fuente viva de clase `TÍTULO`** | `TRIAL_CONVERTED` | — | corta la campaña de recuperación; **la publicación la restituye `PB3`**, por el cambio de `cubierto` (§9) |
| T6 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_CONVERTED` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **verdadero** | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |

**Qué contesta el contrato de cobertura en cada estado.** El trial es **fuente viva en
`PRE_TRIAL` y en `TRIAL_ACTIVE`, y en ningún otro estado**; lo que cambia entre los dos no es *si
hay título* sino **a qué versión de plan apunta**:

| estado | ¿fuente viva? | `referencia` | `hasta` |
|---|---|---|---|
| `PRE_TRIAL` | **sí** | la versión de **pre-trial** de la vertical | `SIN_EMPEZAR` |
| `TRIAL_ACTIVE` | **sí** | la versión del **plan de trial** | la fecha de fin |
| `TRIAL_CONVERTED` | no | — (el título pasó a ser la fuente que lo convirtió: una suscripción, una cortesía o un grant) | — |
| `TRIAL_EXPIRED` | no | — | — |

**Las dos filas de abajo son lo que sostiene `PB2`**: si `TRIAL_EXPIRED` siguiera cubriendo, `PB2`
no dispararía nunca y el criterio que `12-contrato-de-cobertura.md` §5.1 le pone a la
implementación de arranque —*«los dos caminos se ejercen completos, porque un trial vence de
verdad»*— quedaría sin objeto.

**Y la fila de arriba no abre la puerta inversa, porque no hay puerta**: nadie entra a
`PRE_TRIAL`, se empieza ahí, y ninguna transición vuelve. Una cobertura que sólo existe en el
estado inicial **no puede recuperarse** por esta vía, así que no desarma ningún disparador de
pérdida. Quien ya gastó su trial tiene su respuesta al paso 5 por otro lado —el título `BASE`
(`12-contrato…` §2.5)—, que no cubre y sólo le deja volver a contratar.

**Y `PRE_TRIAL` no es un `tipo` nuevo del contrato**: la fuente sigue siendo `tipo: TRIAL`.

### La máquina de trial habla el vocabulario del contrato, y no el de la suscripción

Es la regla que decide las cuatro filas de arriba que cambiaron, y conviene leerla antes que
ellas porque las explica a las cuatro de una vez.

> **Ninguna condición ni ningún evento de esta máquina nombra un estado de la suscripción.**
> Lo que nombran es lo que el contrato de cobertura entrega: **`cubierto`** y **las fuentes vivas
> con su clase** (`12-contrato…` §2.1 y §2.4).

**No es una preferencia de redacción: es lo único ejecutable.** El §4 del contrato declara que
*«el estado exacto de la suscripción no cruza»*, así que una condición escrita sobre estados de
suscripción **no la puede evaluar el lado que tiene que evaluarla**. `T2`, `T3` y `T6` estaban
escritas así —*«se autoriza una suscripción»*, *«no hay suscripción autorizada»*, *«ya hay una
suscripción viva»*— y las tres producían el mismo defecto por caminos distintos: el que las
implementara iba a leer `cubierto`, que es **otro conjunto**, sin que ninguna línea lo dijera.
Los dos sentidos de *«vivo»* y por qué no son intercambiables están en el cap. 01 (núcleo) §2.4.

**Y es el mismo mecanismo que el §9 ya eligió para `PB2` y `PB3`**: atarse al hecho que el
contrato emite —*«la cobertura de (`user`, vertical) cambió»* (`12-contrato…` §3)— en vez de a una
lista de transiciones de la otra épica, mantenida a mano. No agrega un mecanismo: usa el que
estaba, en la segunda máquina que lo necesitaba.

**Qué gana cada fila, en una línea:**

| fila | decía | dice | qué se cierra |
|---|---|---|---|
| `T1` | sin condición sobre el sujeto | `cubierto` **falso** | ya no dispara sobre quien tiene un título, que era la rama que dejaba una fuente `TÍTULO` perpetua |
| `T2` | *«se autoriza una suscripción»* | aparece un título que no es el trial | ahora alcanza también a quien **recupera** (`S7`), **reanuda** (`S10`) o recibe una cortesía o un grant durante el trial |
| `T3` | *«no hay suscripción autorizada»* | sin condición | `TRIAL_ACTIVE` **siempre** tiene salida: el reloj vence y punto |
| `T6` | *«ya hay una suscripción viva»* | `cubierto` **verdadero** | deja de quemar el trial de quien no está cubierto por nada |

### `T1` y `T6` comparten el par, y sus guardas son complementarias

`T1` y `T6` comparten `desde` y `evento`, y es **el único par `(desde, evento)` con dos destinos
distintos de esta épica**, y uno de los **tres** que el diseño declara hoy — los otros dos son
`S5`/`S19` y `S7`/`S19`, en la tabla de suscripción de la épica de billing, separados también por
un booleano (`B/03` §3.2; la lista está en el cap. 03 (núcleo) §1 regla 7). Lo cuenta `G-R4` sobre
las nueve tablas, no una lectura a mano. La regla 7 del cap. 03 (núcleo) exige que sus guardas sean
disjuntas, y acá lo son **por construcción y no por acuerdo**: las dos piden la misma mitad de
catálogo —la vertical declara evento y su plan de trial tiene días > 0— y difieren en el valor de
**un booleano**, `cubierto`. No hay una regla de precedencia que alguien pueda olvidar leer,
porque no hace falta ninguna.

**Las tres consecuencias del par, recorridas** — la mitad de catálogo × los dos valores de
`cubierto`:

| catálogo | `cubierto` | qué pasa |
|---|---|---|
| declara evento y días > 0 | **falso** | `T1`: arranca el trial |
| declara evento y días > 0 | **verdadero** | `T6`: la fila nace consumida, y el título es la fuente que ya tiene |
| no declara evento, **o** días = 0 | cualquiera | **ninguna de las dos dispara**, y la persona se queda en `PRE_TRIAL` |

**La tercera fila es nueva y es deliberada.** `T6` no repetía la mitad de catálogo, así que en una
vertical que declarara evento con los días en cero le escribía a un cliente la fila consumida de
un trial **que la vertical todavía no ofrece** — y el día que lo encendiera, esa persona ya no lo
tenía. `DEC-TRIAL-003` contempla exactamente ese día para Partner. Consumir un beneficio que no
existe no es consumirlo: es destruirlo antes de que nazca.

**Y `cubierto` no se puede referir a sí mismo por accidente**, que es la trampa obvia de
condicionar una máquina de trial sobre la cobertura: la fuente del trial en `PRE_TRIAL` tiene
`hasta: SIN_EMPEZAR` y por eso es de clase `BASE`, no de clase `TÍTULO` (`12-contrato…` §2.4). No
cuenta para `cubierto`, así que el valor que leen `T1` y `T6` **está decidido enteramente por
fuentes ajenas al trial** — la suscripción, la cortesía o el grant.

**Consecuencia declarada, porque no decirla sería esconderla.** De los diez estados de la
suscripción, los que **no emiten fuente** (`12-contrato…` §2.6) dan `cubierto` falso, así que para
todos ellos dispara **`T1`**. Para cuatro —`ABANDONED`, `CANCELLED`, `CHARGE_DECLINED` y no tener
fila ninguna— es trivialmente lo correcto: no hay relación comercial de ningún tipo. Los otros
tres son los que valen la pena mirar, y son `PENDING_AUTHORIZATION`, `PAUSED` por
`CUSTOMER_REQUEST` y `SUSPENDED`. En los tres la persona **recibe su trial de verdad**, con su
reloj, y no pierde nada.

Para dos de los tres es la respuesta correcta sin matices: quien abrió un checkout y todavía no lo
autorizó —el contrato acaba de declarar que esa fila *«no vale nada»* porque el checkout se puede
abandonar, y cobrarle por ella el activo más caro que una persona tiene una sola vez en la vida
sería la lectura contraria— y quien pidió pausar, a quien *«el servicio está detenido»* (`B/16`
§2.2).

**Para el tercero es una concesión, y va medida.** Alguien `SUSPENDED` por impago que **nunca
publicó en esa vertical** recibe los días de trial que habría recibido igual si no hubiera
contratado nunca. Recibe **su único trial de por vida**, no uno extra: el día que regulariza, `T2`
lo convierte; si no regulariza, `T3` lo vence, `PB2` lo despublica y no le queda nada. Lo que el
diseño **no puede** hacer hoy es distinguirlo de quien no tiene nada — los dos ven exactamente la
misma respuesta del contrato—, y darle a verticales el dato que los separa es **agregarle un
segundo hecho a la frontera**, que dispara la regla de vigilancia del `12-contrato…` §4.2.
**Queda declarado como abierto**, no resuelto en silencio: es una decisión de producto, no de
redacción.

**Seis cosas que la tabla fija y conviene leer explícitas:**

- **`PRE_TRIAL` es el estado más poblado del sistema** y es un estado real, no la ausencia de
  uno: es donde vive quien entró a la vertical y todavía no publicó, con borradores ilimitados,
  sin capacidades comerciales y sin consumir trial (`DEC-TRIAL-007`).
- **No existe transición de vuelta a `PRE_TRIAL` ni a `TRIAL_ACTIVE` desde `TRIAL_EXPIRED`.**
  Es lo que hace cumplir al §10.2. Un trial consumido no se devuelve ni siquiera si la ficha que
  lo disparó se borra — con la consecuencia ya registrada de que alguien puede quedarse sin
  ficha y sin trial (`E-TRIAL-04`, capítulo 11 (épica de verticales)).
- **La extensión sólo entra por T4**, o sea sólo durante `TRIAL_ACTIVE`. El §32 es terminal:
  *«Solo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe rechazar.»*
- **`T6` es `T1` para quien ya está cubierto, y sin él el trial queda colgado.** Alguien puede
  contratar **antes** de publicar: el día que publica, `T1` dispararía sobre alguien que ya tiene
  un título y lo dejaría en `TRIAL_ACTIVE` **con dos fuentes de clase `TÍTULO` a la vez** — la de
  su plan y la del plan de trial, que el pliegue del capítulo 15 (épica de verticales) suma y cuyos
  entitlements *«se derivan … del plan vendible de `rank` más alto»* (cap. 02 §2.1).
  **Paga el básico y opera con las capacidades del premium.** `T6` cierra el caso escribiendo
  la fila **ya consumida**: el título es la fuente que ya tiene, que es exactamente lo que
  `TRIAL_CONVERTED` significa.

  **Y consumirlo es lo correcto, no un castigo**: la fila es única de por vida, así que sin
  escribirla esa persona **se guardaría un trial para el día que cancele** — un trial gratis para
  quien ya fue cliente, que es la puerta que el §10.2 existe para cerrar. Lo que no pierde es
  nada: **la condición garantiza que hay un título vivo**, así que no necesita probar lo que ya
  tiene. La justificación dejó de apoyarse en una lectura de *«viva»* que verticales no puede
  hacer y pasó a apoyarse en el único dato que el contrato le entrega.

  **La rama vieja —`T1` ganando el par— ya no existe, y no por precedencia**: la condición de `T1`
  exige `cubierto` **falso**, así que sobre esta persona no dispara. Y aunque disparara, el estado
  ya no sería terminal: `T3` perdió la condición que lo bloqueaba.

  **La otra mitad de este caso la cerró el contrato**: quien contrata y **no** publica conserva su
  fuente de `PRE_TRIAL` mientras paga, y antes eso lo seguía cubriendo el día que cancelaba. Desde
  que **un reloj que no arrancó no es un título** (`12-contrato…` §2.4), esa fuente ya no cubre.
- **`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene.** La condición vieja —*«no hay trial
  previo para ese `user + vertical`»*— decía lo mismo que su estado de origen **y lo negaba**: con
  fila en `PRE_TRIAL`, *«no hay trial previo»* es falso siempre, y `T1` **no dispara nunca**. Se
  cae por **redundante**, no por permisiva. Lo que impide un segundo trial son dos cosas que
  siguen intactas: **ninguna transición vuelve a `PRE_TRIAL`** y la fila que `T1` crea es única de
  por vida (cap. 02 §2.2), ahora por `user` **y** por hash de correo.

  **Lo que sí hacía falta, y la condición vieja no era, es una condición sobre el sujeto.** Al
  caerse aquélla `T1` quedó sin ninguna que mirara el estado comercial de la persona, que es
  justo lo que `T6` vino a mirar: durante una vuelta entera del ciclo las dos filas del par
  pudieron disparar a la vez. `cubierto` **falso** es esa condición, y es del sujeto, no del
  catálogo — por eso las dos mitades de la guarda son necesarias y ninguna sobra.
- **T4 re-agenda la campaña previa**, no la deja como estaba. Si el trial se extiende 10 días y
  el aviso de «faltan 2 días» ya salió, el cliente tiene que recibirlo de nuevo contra la fecha
  nueva. El cruce inverso —la campaña de recuperación ya disparada y el trial extendido después—
  **no existe**: esa campaña arranca en T3 y T4 exige `TRIAL_ACTIVE`, así que entre las dos no hay
  camino (`E-TRIAL-03`, disuelto por el capítulo 11 (épica de verticales) §7).

---

## 9. Publicación

Es la máquina de la ficha, y el §63 la pide aparte porque no coincide con la de la suscripción:
una suscripción cubre **todas** las fichas de su vertical (§12), así que un solo evento de
billing mueve varias publicaciones a la vez.

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| PB1 | `DRAFT` | el dueño publica | `PUBLISHED` | **inmediato, sin revisión previa** (`DEC-TRIAL-005`): publicar es quedar visible, y es el evento que consume el trial en las verticales con ficha |
| PB2 | `PUBLISHED` | **`cubierto` pasa a falso** | `UNPUBLISHED_BY_BILLING` | o el excedente tras un downgrade, que no cambia `cubierto` y sí el cupo |
| PB3 | `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero** | `PUBLISHED` | y el cupo alcanza |
| PB4 | `PUBLISHED` o `UNPUBLISHED_BY_BILLING` | día 90 de inactividad | `ARCHIVED` | sale del sitio público, **el dueño la sigue viendo** y puede exportarla o reactivarla (`DEC-DATA-001`) |
| PB5 | `DRAFT` | N meses sin actividad | `ARCHIVED` | `DEC-TRIAL-007`; `N` es configuración |
| PB6 | `PUBLISHED` | el dueño despublica | `DRAFT` | y **no devuelve el trial** (§10.2) |

**`PB2` y `PB3` se disparan por el CAMBIO de `cubierto`, no por una lista de transiciones**, y ése
es el arreglo: las dos listas estaban **congeladas** y se quedaron cortas apenas el diseño se
movió. `PB2` enumeraba cuatro causas y **no conocía `S16`** —el alta cuyo primer cobro se
rechaza—; `PB3` enumeraba tres y **no conocía `S2`**, así que **el que recontrataba después de
cancelar pagaba y su ficha no volvía nunca** — y tampoco podía sacarla a mano, porque `PB1` sale
sólo de `DRAFT`.

**El contrato ya emite el hecho** —*«la cobertura de (user, vertical) cambió»* (`12-contrato…`
§3)— así que atarse a él **no agrega un mecanismo: usa el que estaba**. Una lista de transiciones
en una épica, mantenida a mano contra los cambios de la otra, es el punto de falla favorito de un
arreglo hecho por racimos.

**Y el excedente queda como la única causa enumerada**, porque es la que **no** cambia `cubierto`:
la persona sigue cubierta y lo que no le alcanza es el cupo. Por eso `PB3` pide las dos cosas.

**`UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT` a propósito.** Si billing bajara la
ficha a `DRAFT`, al recuperar la cobertura no habría forma de saber cuáles republicar sin
publicar también las que el dueño había bajado él. La distinción es lo que hace posible PB3.

**El excedente tras un downgrade tiene criterio escrito y predecible**: se despublican **las
publicadas más recientemente**, hasta entrar en el límite, y **el criterio va escrito en el
aviso** — si el cliente no puede leerlo, deja de ser predecible y se pierde el motivo por el que
se eligió (`DEC-SUB-008`).

---

## 11. Postulación de Partner

**Es la novena**, agregada al escribir el capítulo 18 (ver la nota del cap. 01 (núcleo) §2.2). Chica, sin
ciclos y sin vuelta atrás.

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| PP1 | — | alguien completa el formulario del §17.3 | `PENDIENTE` | sólo el camino A; el camino B no crea postulación |
| PP2 | `PENDIENTE` | el admin aprueba | `APROBADA` | **no vincula nada todavía**: si el correo ya es de un usuario, se le manda a **esa** dirección un aviso para reclamarlo (cap. 18 §2.4) |
| PP3 | `PENDIENTE` | el admin rechaza | `RECHAZADA` | **se comunica** (§17.3); habilita postular de nuevo pasada la espera configurable |

**Ninguna transición la dispara el tiempo.** Una `PENDIENTE` que nadie resuelve **no vence**: se
marca atrasada en el panel del §48, porque vencerla sería un rechazo silencioso y el §17.3 exige
que el rechazo se comunique. Una `APROBADA` que nadie reclama tampoco vence, y es inofensiva: la
suscripción es el último de los nueve pasos del §17.3, así que no publica nada y no se le cobra
nada.
