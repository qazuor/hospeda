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
       T7 · la vertical enciende sus días de trial,
            y el evento de activación ya se ejerció
```

| # | desde | evento | hacia | condición | efectos |
|---|---|---|---|---|---|
| T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso** | **crea la fila de `trial`**; se asigna el plan de trial; arranca el reloj; se agenda la campaña previa del §10.7 |
| T2 | `TRIAL_ACTIVE` | **aparece una fuente viva de clase `TÍTULO` que no es la del trial** | `TRIAL_CONVERTED` | — | se cancela la campaña previa; el acceso pasa a depender de esa fuente |
| T3 | `TRIAL_ACTIVE` | llega la fecha de fin | `TRIAL_EXPIRED` | **—** | arranca la campaña de recuperación y el reloj de retención; **la publicación la mueve `PB2`**, por el cambio de `cubierto` (§9) |
| T4 | `TRIAL_ACTIVE` | promo de extensión o cortesía | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de fin; **re-agenda** la campaña previa |
| T5 | `TRIAL_EXPIRED` | **aparece una fuente viva de clase `TÍTULO`** | `TRIAL_CONVERTED` | — | corta la campaña de recuperación; **la publicación la restituye `PB3`**, por el cambio de `cubierto` (§9) |
| T6 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_CONVERTED` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **verdadero** | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |
| T7 | `PRE_TRIAL` | **el encendido: la vertical pasa los días de trial de su plan de trial de 0 a > 0** | `TRIAL_CONVERTED` | la persona **ya ejerció el hecho que la vertical declara como evento de activación**, en cualquier momento anterior al encendido — **`cubierto` no participa** | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |

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
| no declara evento, **o** días = 0 | cualquiera | **ninguna de las dos dispara en ese momento**, y la persona se queda en `PRE_TRIAL` — **hasta el encendido, que es lo que resuelve `T7`** |

**La tercera fila es nueva y es deliberada.** `T6` no repetía la mitad de catálogo, así que en una
vertical que declarara evento con los días en cero le escribía a un cliente la fila consumida de
un trial **que la vertical todavía no ofrece** — y el día que lo encendiera, esa persona ya no lo
tenía. `DEC-TRIAL-003` contempla exactamente ese día para Partner. Consumir un beneficio que no
existe no es consumirlo: es destruirlo antes de que nazca.

#### La tercera fila no es un estado final: `T7` la cierra el día del encendido

**«Se queda en `PRE_TRIAL`» es verdadero mientras la configuración no cambie, y la configuración
va a cambiar**: `DEC-TRIAL-003` no dice *«Partner no tiene trial»*, dice *«hoy lo tiene en cero»*
y que **encenderlo es una decisión registrada**. El día del encendido, quien quedó en esa fila
**sale de `PRE_TRIAL` con las dos guardas del par cumplidas**: la vertical declara evento, los
días ya son `> 0`, y `cubierto` decide cuál de las dos dispara. Para el que **fue cliente y se
fue** —contrató, publicó, pagó meses y canceló— `cubierto` es **falso**, así que dispara **`T1`**
y le arranca un trial completo: las capacidades del plan vendible de `rank` más alto, gratis, a
alguien cuya relación comercial ya terminó. Y no le pasa a una persona: le pasa **a toda la
cohorte de ex-clientes de esa vertical, el mismo día**.

**Eso es exactamente lo que el §10.2 existe para cerrar** —*«un trial gratis para quien ya fue
cliente»*, la frase con la que este mismo § justifica a `T6`—, y en el tercer renglón no lo
cerraba nadie, porque `T6` tampoco dispara mientras los días estén en cero. `T7` es el renglón que
faltaba:

> **El encendido de una vertical resuelve, en el acto, a todo el que quedó en `PRE_TRIAL` habiendo
> ya ejercido el evento de activación: su fila de `trial` se escribe consumida.** No arranca ningún
> reloj y no manda ninguna campaña — es la misma escritura de `T6`, con otro disparador.

**Por qué la condición es «ya ejerció el evento» y no `cubierto`, que es la pregunta obvia.** Las
dos mitades importan y ninguna es intercambiable con la otra:

| quién | qué le pasa el día del encendido | por qué es lo correcto |
|---|---|---|
| **ya publicó en esa vertical** (con los días en cero sólo se puede publicar teniendo un título: la versión de pre-trial **no lleva la capacidad de activación** cuando los días son cero, cap. 02 §2.1) | **`T7`**: fila consumida | ya fue cliente y ya ejerció el evento que arranca el trial. Devolvérselo el día del encendido es el reseteo del §10.2 |
| **nunca publicó ahí**, tenga o no suscripción | **nada**: sigue en `PRE_TRIAL` | nunca ejerció el evento. Cuando lo ejerza, deciden `T1` y `T6` como en cualquier vertical — y es **literalmente** la población que `DEC-TRIAL-008` protege: *«alguien `SUSPENDED` por impago que **nunca publicó en esa vertical** recibe los días de trial que habría recibido igual si no hubiera contratado nunca»* |

**Y no pide ningún hecho nuevo en la frontera**, que es la restricción que `DEC-TRIAL-008` acaba
de poner y que un *«¿alguna vez tuvo un título acá?»* habría violado de frente. *«Ejerció el
evento de activación»* es **un hecho de verticales**: es el mismo hecho que esta máquina ya tiene
que detectar para disparar `T1`, leído sobre el pasado en vez de sobre el instante. Su registro
existe y es duradero sin agregar nada: publicar es una transición de la máquina del §9, o sea un
evento auditable por el criterio 2 del cap. 08 §1.1 (núcleo), y ese registro es **append-only**
(§1.3) — ni borrar la ficha ni darse de baja lo borran, que es la misma promesa que el §10.2 ya
hace sobre el trial.

**`T7` no es un cuarto par de `G-R4` y no toca los tres declarados.** Comparte el `desde` con
`T1`/`T6`, pero **no el evento**: el suyo es el encendido, un cambio de catálogo, y los de aquéllas
son el evento de activación de la persona. El par `(PRE_TRIAL, evento de activación)` sigue
teniendo **dos** filas y dos destinos, que es lo que el cap. 03 §1 regla 7 (núcleo) enumera y lo
que `G-R4` cuenta. Y el par `(PRE_TRIAL, encendido)` tiene **una sola** fila, así que no hay
guardas que dirimir.

**El encendido no es una acción del catálogo del cap. 08 §3 (núcleo) y no hay que agregarlo ahí.**
No es un acto de un administrador sobre la cuenta de otro: es **configuración de catálogo**
—publicar una versión del plan de trial con días `> 0`, cap. 10 §3—, igual que cualquier otro
cambio de versión. Es auditable por el criterio 2 del §1.1 —cambia el acceso de mucha gente a la
vez— y `DEC-TRIAL-003` ya exige que la decisión quede registrada. Lo que el capítulo 11 (épica de
verticales) §8 agrega es **qué hay que hacer el mismo día**, porque encender el número sin ejecutar
`T7` es lo que abre la puerta.

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

**Decidido: se deja así, y la frontera NO gana ese segundo hecho** (`DEC-TRIAL-008`, owner,
2026-09-21). Tres razones, y la tercera es la que sorprende:

1. **Un bit tipo *«hay un vínculo de suscripción no terminal»* es un estado de cobranza con otro
   nombre.** `DEC-ARCH-006` fija que el contrato es uno solo, y el día que ese bit exista alguien
   escribe la segunda regla de producto encima. Es una puerta, no una excepción.
2. **La alternativa empeora dos casos para arreglar uno**: alcanza a los tres estados, incluidos
   los dos que acá quedan bien resueltos.
3. **Quien está `SUSPENDED` ya no está pagando.** Darle su trial en una vertical nueva **no cuesta
   ingreso** —no hay ingreso que perder— y es la única vía por la que esa persona podría volver.
   Bloquearla protege un ingreso inexistente y cierra la puerta de vuelta.

Y queda rechazada con el resto la variante de distinguir **sólo** a `SUSPENDED`, que es la peor:
es literalmente una señal de deuda cruzando a verticales.

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
| PB3 | `UNPUBLISHED_BY_BILLING` | **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie** | `PUBLISHED` | y el cupo alcanza. **Es una disyunción de dos, simétrica a la de `PB2`** (`DEC-DATA-003`) |
| PB4 | `PUBLISHED` o `UNPUBLISHED_BY_BILLING` | día 90 de **inactividad**, contado sobre `listing.inactiva_desde` (cap. 01 §1.2, núcleo; cap. 02 §2.5) | `ARCHIVED` | **relee la cobertura antes de archivar** (ver abajo). Sale del sitio público, **el dueño la sigue viendo** y puede exportarla o reactivarla (`DEC-DATA-001`) — y las dos cosas son ejecutables desde que existen `PB7` y `PB8` |
| PB5 | `DRAFT` | N meses de **inactividad**, contado sobre `listing.inactiva_desde` (cap. 01 §1.2, núcleo; cap. 02 §2.5) | `ARCHIVED` | `DEC-TRIAL-007`; `N` es configuración. **Relee la cobertura antes de archivar**, igual que `PB4` |
| PB6 | `PUBLISHED` | el dueño despublica | `DRAFT` | y **no devuelve el trial** (§10.2) |
| **PB7** | `ARCHIVED` | **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie** | `PUBLISHED` | y el cupo alcanza, **y el evento que la archivó dice que venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`**. Es `PB3` un estado más atrás, **con la misma disyunción y por la misma razón** (ver abajo) |
| **PB8** | `ARCHIVED` | **el dueño la reactiva** | `DRAFT` | desde cualquier origen, incluido el de `PB5`. Es la mitad de `DEC-DATA-001` que se prometía en una nota y no ejecutaba ninguna tabla. **La autoriza la versión de piso**, que otorga *«recuperar lo suyo»* (cap. 02 §2.1): sin eso el paso 6 rechazaba a su única población, la que no paga |

**`PB2` y `PB3` se disparan por el CAMBIO de `cubierto` —o por el del cupo—, no por una lista de
transiciones**, y ése es el arreglo: las dos listas estaban **congeladas** y se quedaron cortas
apenas el diseño se movió. `PB2` enumeraba cuatro causas y **no conocía `S16`** —el alta cuyo primer cobro se
rechaza—; `PB3` enumeraba tres y **no conocía `S2`**, así que **el que recontrataba después de
cancelar pagaba y su ficha no volvía nunca** — y tampoco podía sacarla a mano, porque `PB1` sale
sólo de `DRAFT`.

**El contrato ya emite el hecho** —*«la cobertura de (user, vertical) cambió»* (`12-contrato…`
§3)— así que atarse a él **no agrega un mecanismo: usa el que estaba**. Una lista de transiciones
en una épica, mantenida a mano contra los cambios de la otra, es el punto de falla favorito de un
arreglo hecho por racimos.

**Pero el hecho dice CUÁNDO preguntar y no contesta la pregunta, y las dos filas del reloj releen
antes de actuar — y no son las únicas que releen, sólo las únicas que tienen fila acá.** El §3 del contrato prohíbe decidir con lo que trae el aviso —*«un consumidor que
decidiera con lo que trae el evento estaría creyéndole a un mensaje en vez de al estado»*—, y `PB4`
y `PB5` **deciden lo más caro que decide esta máquina**: el día 90 es el primer escalón del hard
delete del día 180 (cap. 02 §4.1). Así que las dos, en el momento de ejecutar, **vuelven a pedirle
la cobertura al contrato**: si el `user + vertical` está cubierto, no archivan y **reinician el
reloj** escribiendo `listing.inactiva_desde` (cap. 02 §2.5, hecho 2 del cap. 01 §1.2, núcleo). Un
aviso perdido pasa así a costar un retraso en el reinicio y nunca un archivado indebido — y que
estos avisos se pierden lo declara el propio diseño en el otro consumidor de la misma lista
(cap. 02 §3.2, regla 2).

**Y son dos filas porque esta máquina tiene dos, no porque los actores del reloj sean dos: el
tercero está afuera y es el que más caro sale.** *«Las dos»* de este párrafo cuantifica **las filas
de esta tabla**, y es verdadero de las filas. El **hard delete del día 180** no es una transición de
publicación —no mueve la ficha de estado: le borra el contenido (cap. 02 §4.1)— así que no puede
tener fila acá, y **relee exactamente igual, por la misma razón y con el mismo efecto**: si la
cobertura vuelve verdadera, no borra y escribe el hecho 2 (cap. 01 §1.2, núcleo; cap. 02 §4.2,
regla 4). Leer *«las dos»* como *«los dos únicos que releen»* deja al único acto irreversible del
programa decidiendo con un aviso que el propio diseño declara que se pierde.

**Y el excedente queda como la única causa enumerada**, porque es la que **no** cambia `cubierto`:
la persona sigue cubierta y lo que no le alcanza es el cupo.

**Y por eso `PB3` y `PB7` tienen la misma disyunción, que es lo que faltaba: sin la segunda rama,
el excedente entraba y no salía nunca.** El recorrido, porque es corto y termina en un borrado:
un anfitrión con cinco fichas baja de Premium a Básico, el reconciliador le despublica tres por la
segunda rama de `PB2`, y tres meses después **vuelve a Premium y paga el precio entero**. Su
`cubierto` fue verdadero de punta a punta —un upgrade es una sucesión, y la predecesora emite
hasta que `S17` la mata (`12-contrato…` §2.6)—, así que **no hay ningún cambio de `cubierto` que
disparar**. Con `PB3` pidiendo sólo ese cambio, las tres se quedaban en
`UNPUBLISHED_BY_BILLING`, desde donde no salía ninguna otra fila —`PB1` sale sólo de `DRAFT`—, y
ahí se quedaban **para siempre**. **Paga el plan más caro y recibe el más chico, indefinidamente y
sin que nada lo señale** (`DEC-DATA-003`). *(Este renglón decía además que el día 90 `PB4` las
archivaba y el día 180 el hard delete les borraba el contenido, y es falso para este sujeto por la
razón del recuadro de abajo: la relectura de `PB4` encuentra cubierto al dueño y no archiva. El
daño es el encierro, no el borrado, y alcanza solo.)*

**`PB7` la lleva también, y no es una extensión de la decisión sino su condición** (`DEC-DATA-004`,
punto `B2`). Si `PB7` se quedara con el evento único, **una ficha que ya está en `ARCHIVED` y cuyo
dueño ya recuperó la cobertura no tendría cómo volver el día que el cupo crezca**: `cubierto` ya
pasó a verdadero —no queda ningún cambio que disparar— y lo único que se mueve después es el cupo.
Se quedaría ahí para siempre, que es el mismo encierro de `PB3` **un estado más adentro**, y es lo
que `DEC-DATA-002` declaró cerrado con *«vuelve sola por `PB7` y nunca se borra»*.

> ⚠️ **La población de esa segunda rama hay que nombrarla bien, porque la primera versión de este
> párrafo la nombró mal y tres lugares del corpus se apoyaron en esa premisa.** Decía que *«la
> mitad `UNPUBLISHED_BY_BILLING` del `desde` de `PB4` es exactamente la población del excedente»*,
> y **no lo es: la ficha del excedente de un dueño CUBIERTO no llega nunca al día 90.** `PB4` relee
> la cobertura antes de archivar y la encuentra verdadera —el excedente es la única causa que
> **no** cambia `cubierto`—, así que no archiva y **reinicia el reloj**. Esa mitad del `desde` de
> `PB4` alcanza a la ficha que bajó por la **primera** rama de `PB2` —se perdió la cobertura— y
> siguió sin cobertura noventa días.
>
> **La población real de la segunda rama de `PB7` existe, y es la que la vuelve necesaria**: una
> ficha archivada **mientras su dueño no estaba cubierto** —el caso de la pausa larga que la
> sección de abajo desarrolla: **4 pausas-mes** son unos 120 días contra los 90 de `PB4`—, que **al
> volver la cobertura no entra en el cupo** y se queda en `ARCHIVED` con su reloj reiniciado, y a
> la que **después le crece el cupo**. Ahí `cubierto` no cambia y el cupo sí, que es exactamente el
> evento que la segunda rama declara.
>
> **Lo que se corrige es el sujeto de la razón, no la conclusión**, así que `DEC-DATA-004` `B2`
> queda en pie tal como se ratificó: la rama sigue siendo **la condición** de `DEC-DATA-003` y no
> una extensión. **Y la ficha del excedente de un dueño cubierto no se archiva ni se borra, a
> propósito**: vuelve por la segunda rama de **`PB3`**, un estado antes, y mientras tanto su reloj
> se reinicia —*«las que no entran no se borran»*, abajo, y cap. 02 §4.2 regla 4—. El hard delete
> del día 180 **no la alcanza nunca**, que es el lado conservador y el que el diseño eligió.

**Qué NO cambia, y conviene contarlo para que nadie lo recuente.** La rama nueva **no toca
`cubierto`** —lo lee, no lo mueve—, así que no consume ni devuelve ningún trial (`T2`, `T5` y `T6`
siguen colgando de las fuentes de clase `TÍTULO`, §2) y **no es el evento de activación**:
restituir no es publicar, igual que en la rama vieja. Tampoco agrega pares a `G-R4`: son **dos
eventos en la misma fila con el mismo destino**, no dos filas sobre un par — la misma forma que
`PB2` ya tenía (cap. 03 §1 regla 7, núcleo).

**`UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT` a propósito.** Si billing bajara la
ficha a `DRAFT`, al recuperar la cobertura no habría forma de saber cuáles republicar sin
publicar también las que el dueño había bajado él. La distinción es lo que hace posible PB3.

**El excedente tras un downgrade tiene criterio escrito y predecible**: se despublican **las
publicadas más recientemente**, hasta entrar en el límite, y **el criterio va escrito en el
aviso** — si el cliente no puede leerlo, deja de ser predecible y se pierde el motivo por el que
se eligió (`DEC-SUB-008`).

### Cuáles vuelven, cuando el cupo no alcanza para todas

**`PB3` y `PB7` compiten por el mismo cupo**, se disparan con el mismo hecho y en el mismo
instante, y con cinco fichas abajo y lugar para tres **cuáles tres suben es una decisión de
visibilidad pública**. Dejarla en el orden en que una implementación recorra dos tablas es, con las
palabras del núcleo, *«exactamente la diferencia entre una máquina de estados y una convención»*.

> **El criterio es el inverso exacto del de bajada: vuelve primero la que cayó al final.** Como
> *«cae lo más reciente primero»* (`DEC-SUB-008`), eso es **la publicada menos recientemente entre
> las que están abajo**, y se sigue subiendo hacia las más recientes hasta llenar el cupo.

**Se elige el inverso y no un criterio propio por una razón que se puede verificar**: con él, el
conjunto que queda publicado **depende sólo del cupo y no del camino**. Quien bajó de cinco a dos y
volvió a cuatro termina con **exactamente** las cuatro que tendría si hubiera contratado cuatro de
entrada. Cualquier otro orden hace que el resultado dependa de por cuántos planes pasó, que es lo
contrario de predecible — y `V/15` §4.3 ya declaró por qué no se inventa un segundo criterio:
*«dos criterios distintos para la misma clase de problema es cómo se vuelve impredecible»*.

**El origen NO desempata, y es deliberado.** Una candidata en `ARCHIVED` y una en
`UNPUBLISHED_BY_BILLING` entran en **la misma cola ordenada**, sin prioridad por el estado del que
vienen. Lo único que las separa es **cuánto tardó nuestro reloj en archivar una y no la otra**, que
es contabilidad nuestra y no algo que el dueño haya elegido; usarlo como criterio le haría depender
la visibilidad de un detalle que no puede ver ni predecir. `PB7` **sí** mira su origen, pero para
otra cosa: para no publicar el borrador de `PB5`, que nunca fue candidato.

**El dato con el que se ordena ya existe y no pide columna nueva**: cuándo se publicó cada ficha,
que es el mismo que la bajada necesita para decidir *«la más reciente»*. Sale del registro
append-only de eventos de dominio (cap. 08 §1.2 y §1.3, núcleo), igual que el origen que `PB7`
consulta.

**Y va escrito en el aviso, por la misma razón que el de bajada.** `DEC-SUB-008` lo dice y `V/19`
fila 8 lo obliga para el excedente: *«si el cliente no puede leerlo, deja de ser predecible y se
pierde el motivo por el que se eligió»*. El espejo es la **fila 19** de `V/19` §4 y su correo está
en el catálogo del cap. 07 §6 (núcleo). Las que no entran **no se borran** —su reloj se reinicia
igual, §4.2 regla 4 del cap. 02—, pero quedan abajo, y el dueño tiene que poder saber por qué.

### `ARCHIVED` tiene salida, y son dos porque hay dos maneras de volver

**El caso que las obliga es una pausa del catálogo.** Alguien toma la pausa más larga que le
vendemos —**4 pausas-mes**, unos 120 días (`B/03` §5)—. La pausa por `CUSTOMER_REQUEST` **no
emite fuente** (`12-contrato…` §2.6), así que `cubierto` pasa a falso, `PB2` baja la ficha, el
día 90 llega antes que el fin de la pausa y `PB4` la archiva. Antes de la 9-bis-3 **ninguna
fila de ninguna tabla del programa tenía `ARCHIVED` en su columna `desde`**, así que por la
regla 1 del cap. 03 §1 (núcleo) volver de ahí no era una operación: era un incidente. Y el reloj
seguía hasta el hard delete del día 180 (cap. 02 §4.1). El sujeto no era una ficha abandonada:
era la de un cliente que no canceló nada.

**Son dos filas y no una porque los dos caminos de vuelta no se pueden mezclar:**

| | `PB7` | `PB8` |
|---|---|---|
| quién la dispara | el hecho que el contrato empuja | el dueño |
| hacia dónde | `PUBLISHED` | `DRAFT` |
| desde qué origen | sólo si venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING` | cualquiera |
| para quién existe | el que pausó, el que recontrata, el que regularizó | el que quiere su ficha de vuelta sin pagar todavía, y el borrador que archivó `PB5` |
| con qué la autoriza | su fuente de clase `TÍTULO`, que es la que acaba de volver | **la versión de piso**, *«recuperar lo suyo»* (cap. 02 §2.1) — su población **no tiene ninguna otra** |

**`PB7` no puede ignorar el origen, y ésa es toda la razón por la que lo mira.** A `ARCHIVED` se
entra por dos puertas: `PB4`, desde una ficha que estaba a la vista, y `PB5`, desde un
**borrador** que su dueño nunca publicó. Una vuelta automática que no las distinguiera
**publicaría el borrador de alguien que nunca pidió publicarlo** el día que recupera cobertura.
Es exactamente la razón por la que `UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT`,
una puerta más adentro.

**Y el origen no necesita ninguna columna nueva: ya está escrito.** El evento de dominio de
`PB4` y el de `PB5` guardan *«los campos que cambiaron, con su valor anterior y el nuevo»*
(cap. 08 §1.2, núcleo) sobre un registro **append-only** (§1.3). Preguntarle al registro de
verticales por un hecho de verticales es el mismo mecanismo que `T7` usa para *«ya ejerció el
evento de activación»* (§2), y por el mismo motivo: el dato existe, es duradero y no hay que
pedírselo a nadie. Una columna denormalizada es libertad de implementación, nunca una segunda
fuente.

**Las dos reinician el reloj, y `PB7` ni siquiera hace falta que dispare para que se reinicie.**
El hecho que reinicia la inactividad es **la cobertura comprobada verdadera** (cap. 01 §1.2,
núcleo, hecho 2) —un estado leído, no un cambio detectado, que es por lo que cualquiera que actúe
sobre el reloj lo puede comprobar en el momento de actuar—, no la transición: si el cupo no alcanza
y la ficha se queda abajo, el reloj se reinicia igual. Atarlo a `PB7` habría dejado el borrado vivo justo para el que vuelve con un plan más
chico.

**Qué queda del caso de la pausa, medido y no estimado.** El reloj **no se detiene** durante la
pausa —verticales no sabe que hay una pausa, y el §4 del contrato con `DEC-TRIAL-008` deciden que
no lo sepa—, así que la ficha **sí** se archiva el día 90. Lo que ya no pasa es lo caro: al
reanudar, `cubierto` vuelve a verdadero, el reloj se reinicia y `PB7` la republica sola. Entre el
primer día de la pausa y ese reinicio hay **120 días** contra los **180** del borrado, y las
pausas encadenadas no acumulan porque cada reanudación reinicia. Que las dos cifras sigan en ese
orden es `D16` (cap. 04 §3, núcleo), no una cuenta que alguien tenga que rehacer.

**Tres cosas que estas dos filas NO son, y conviene decirlas porque cada una toca un arreglo de
esta misma tanda:**

1. **`PB7` no es el evento de activación, y no consume ningún trial.** El evento que `T1` y `T7`
   miran es *«el dueño publica»*, que es `PB1` — un acto suyo. `PB3` ya republicaba sin ser `PB1`
   y `PB7` hace lo mismo un estado más atrás: **restituir no es publicar**. Leerlo al revés le
   quemaría el trial a quien reanuda una pausa.
2. **Ninguna de las dos comparte par con otra fila.** Salen las dos de `ARCHIVED`, pero sus
   eventos son distintos —el cambio de `cubierto` y el acto del dueño—, así que cada par tiene
   **una sola** fila y **`PB7`/`PB8` no agregan ninguno** a los pares con dos destinos, que desde la
   FASE 9-bis-4 son **cuatro** —el cuarto es `S10`/`S25` (`NUCLEO/03` §1 regla 7)—. Es el mismo caso que
   `T7`, y está anotado en la regla 7 del cap. 03 §1 (núcleo).
3. **`PB7` no es una transición de la clase del reloj**, así que no la alcanza la propiedad
   *«nunca otorga»* del cap. 17 §3.4. Las de esa clase en esta máquina son `PB4` y `PB5`, y las
   dos **quitan**; a `PB7` la disparan **un cambio de cobertura o un cambio de cupo**, igual que a
   `PB3`. **Ninguno de los dos es el reloj**: los dos son el recálculo del conjunto efectivo de un
   `user + vertical` (cap. 15 §4.2), que lo dispara un acto —el de la persona o el de billing— y
   no el paso del tiempo.

**Y la mitad `PUBLISHED` del `desde` de `PB4` deja de ser letra muerta con el término definido.**
Una ficha publicada y cubierta no acumula inactividad, así que esa mitad sólo alcanza a una ficha
que quedó **publicada sin cobertura** — el caso que `DEC-MIG-004` mide como defecto 1, *«`PB2` no
dispara la mañana del corte y la cartera queda publicada sin cobertura»*. Es la red, y por eso se
queda.

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
