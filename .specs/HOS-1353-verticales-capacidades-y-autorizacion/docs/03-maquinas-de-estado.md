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
            evento de activación de la vertical
  PRE_TRIAL ─────────────────────────────────────► TRIAL_ACTIVE
                                                     │    │
                        se suscribe                  │    │   vence sin suscribirse
              ┌──────────────────────────────────────┘    └──────────────┐
              ▼                                                          ▼
      TRIAL_CONVERTED ◄───────── se suscribe después ──────────── TRIAL_EXPIRED
```

| # | desde | evento | hacia | condición | efectos |
|---|---|---|---|---|---|
| T1 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_ACTIVE` | la vertical declara evento **y** su plan de trial tiene días de trial > 0 | **crea la fila de `trial`**; se asigna el plan de trial; arranca el reloj; se agenda la campaña previa del §10.7 |
| T2 | `TRIAL_ACTIVE` | se autoriza una suscripción | `TRIAL_CONVERTED` | — | se cancela la campaña previa; el acceso pasa a depender de la suscripción |
| T3 | `TRIAL_ACTIVE` | llega la fecha de fin | `TRIAL_EXPIRED` | no hay suscripción autorizada | publicación → `UNPUBLISHED_BY_BILLING`; arranca la campaña de recuperación y el reloj de retención |
| T4 | `TRIAL_ACTIVE` | promo de extensión o cortesía | `TRIAL_ACTIVE` | sólo durante `TRIAL_ACTIVE` (§32) | corre la fecha de fin; **re-agenda** la campaña previa |
| T5 | `TRIAL_EXPIRED` | se autoriza una suscripción | `TRIAL_CONVERTED` | — | corta la campaña de recuperación; se restituye la publicación |
| T6 | `PRE_TRIAL` | el evento de activación declarado por la vertical | `TRIAL_CONVERTED` | **ya hay una suscripción viva** para ese `user + vertical` | **crea la fila de `trial`, consumida**, sin reloj y sin campaña |

**Qué contesta el contrato de cobertura en cada estado.** El trial es **fuente viva en
`PRE_TRIAL` y en `TRIAL_ACTIVE`, y en ningún otro estado**; lo que cambia entre los dos no es *si
hay título* sino **a qué versión de plan apunta**:

| estado | ¿fuente viva? | `referencia` | `hasta` |
|---|---|---|---|
| `PRE_TRIAL` | **sí** | la versión de **pre-trial** de la vertical | `SIN_EMPEZAR` |
| `TRIAL_ACTIVE` | **sí** | la versión del **plan de trial** | la fecha de fin |
| `TRIAL_CONVERTED` | no | — (el título pasó a ser la suscripción) | — |
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

**Cinco cosas que la tabla fija y conviene leer explícitas:**

- **`PRE_TRIAL` es el estado más poblado del sistema** y es un estado real, no la ausencia de
  uno: es donde vive quien entró a la vertical y todavía no publicó, con borradores ilimitados,
  sin capacidades comerciales y sin consumir trial (`DEC-TRIAL-007`).
- **No existe transición de vuelta a `PRE_TRIAL` ni a `TRIAL_ACTIVE` desde `TRIAL_EXPIRED`.**
  Es lo que hace cumplir al §10.2. Un trial consumido no se devuelve ni siquiera si la ficha que
  lo disparó se borra — con la consecuencia ya registrada de que alguien puede quedarse sin
  ficha y sin trial (`E-TRIAL-04`, capítulo 11 (épica de verticales)).
- **La extensión sólo entra por T4**, o sea sólo durante `TRIAL_ACTIVE`. El §32 es terminal:
  *«Solo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe rechazar.»*
- **`T6` es `T1` para quien ya paga, y sin él el trial queda colgado.** Alguien puede contratar
  **antes** de publicar: el día que publica, `T1` dispararía sobre alguien que ya tiene
  suscripción y lo dejaría en `TRIAL_ACTIVE` **sin salida alcanzable** — `T3` no puede vencerlo
  porque exige que no haya suscripción autorizada, y `T2` espera **un evento que ya ocurrió**.
  `T6` cierra el caso escribiendo la fila **ya consumida**: el título es la suscripción, que es
  exactamente lo que `TRIAL_CONVERTED` significa.

  **Y consumirlo es lo correcto, no un castigo**: la fila es única de por vida, así que sin
  escribirla esa persona **se guardaría un trial para el día que cancele** — un trial gratis para
  quien ya fue cliente, que es la puerta que el §10.2 existe para cerrar. Lo que no pierde es
  nada: no necesita probar lo que ya está pagando.

  **La otra mitad de este caso la cerró el contrato**: quien contrata y **no** publica conserva su
  fuente de `PRE_TRIAL` mientras paga, y antes eso lo seguía cubriendo el día que cancelaba. Desde
  que **un reloj que no arrancó no es un título** (`12-contrato…` §2.4), esa fuente ya no cubre.
- **`T1` crea la fila, y por eso `PRE_TRIAL` no la tiene.** La condición vieja —*«no hay trial
  previo para ese `user + vertical`»*— decía lo mismo que su estado de origen **y lo negaba**: con
  fila en `PRE_TRIAL`, *«no hay trial previo»* es falso siempre, y `T1` **no dispara nunca**. Se
  cae por **redundante**, no por permisiva. Lo que impide un segundo trial son dos cosas que
  siguen intactas: **ninguna transición vuelve a `PRE_TRIAL`** y la fila que `T1` crea es única de
  por vida (cap. 02 §2.2), ahora por `user` **y** por hash de correo.
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
