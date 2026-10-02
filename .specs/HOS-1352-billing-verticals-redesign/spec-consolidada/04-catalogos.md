# Catálogos

Catálogo único de transiciones, transiciones prohibidas, motivos de la marca de conciliación, candados, reglas y mentiras del proveedor falso, guards, validaciones del panel y filas de la matriz de Mercado Pago (organización por pieza con catálogos únicos: [DEC-METH-019](01-decisiones-vigentes.md#dec-meth-019), punto 2, letra [AH](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-ah)).

**Cómo se lee.** Cada ítem lleva su ancla, su texto **copiado de la fuente congelada** (`e291df0b5b`) con lo tachado omitido y nada parafraseado, y su línea `Origen:`. Las celdas van con el nombre de la columna de la fuente; entre paréntesis, a qué parte de la transición corresponde (estado origen, disparador, estado destino, guardas, efectos). La **pieza dueña** y las que también lo ejercen salen de `_trabajo/cobertura.json`, con la cita que las justifica; el AC y los tests de cada ítem viven en el archivo de su pieza, no acá ([AM](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-am), [AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)). Los links a otros archivos de la fuente se dejaron como texto.

Las secciones *«texto de la fuente»* traen, sin lo tachado, la prosa de la misma sección de la fuente que rodea cada tabla: son reglas de la tabla entera y se leen junto con sus filas.

## Trial (`V/03` §2)

### Trial (`V/03` §2) — «2. Trial»

Texto de `V/03-maquinas-de-estado.md:21–90`, sin lo tachado:

**Alcance**: uno por `user + vertical`, de por vida (§10.1). No se reinicia por borrar la
ficha, crear otra, cancelar, volver, cambiar de plan ni registrarse de nuevo sobre la misma
identidad detectable (§10.2, `DEC-TRIAL-004`).

```text
                  T1 · evento de activación, y NO hay título
  PRE_TRIAL ───────────────────────────────────────────────────► TRIAL_ACTIVE
      │                                                            │      │
      │             T2 · aparece un título que convierte           │      │ T3 · llega
      │                    ┌───────────────────────────────────────┘      │ la fecha de fin
      │                    │                                              ▼
      │                    ▼        T5 · aparece un título que convierte
      └──────────► TRIAL_CONVERTED ◄──────────────────────────────── TRIAL_EXPIRED
       T6 · evento de activación,
            y SÍ hay un título que convierte
       T7 · la vertical enciende sus días de trial,
            y el evento de activación ya se ejerció
            (T7 salió: revisión del owner, 2026-09-28, N7)
       T8 · aparece un título que convierte,
            y el evento de activación ya se ejerció
```

*(El diagrama decía y después de
que la tabla pasara a *«aparece un título que convierte»*, y antes
de que `T6` exigiera uno que convierte; corregido con la tabla, y `T8` agregada — owner
2026-09-25; FASE 9 completa, `C-R12-5` y decisión 6c.)*

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

(Sale con la
revisión del owner, 2026-09-28, C8: las verticales no se discontinúan, y `TRIAL_ACTIVE` es fuente
viva hasta `T3`.)

**Y la fila de arriba no abre la puerta inversa, porque no hay puerta**: nadie entra a
`PRE_TRIAL`, se empieza ahí, y ninguna transición vuelve. Una cobertura que sólo existe en el
estado inicial **no puede recuperarse** por esta vía, así que no desarma ningún disparador de
pérdida. Quien ya gastó su trial tiene su respuesta al paso 5 por otro lado —el título `BASE`
(`12-contrato…` §2.5)—, que no cubre y sólo le deja volver a contratar.

**Y `PRE_TRIAL` no es un `tipo` nuevo del contrato**: la fuente sigue siendo `tipo: TRIAL`.

## Trial (`V/03` §2) — las transiciones

<a id="trans-v-t1"></a>

### `TRANS:V:T1` · `T1` — `PRE_TRIAL` → `TRIAL_ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PRE_TRIAL`
- **evento** (disparador): el evento de activación declarado por la vertical
- **hacia** (estado destino): `TRIAL_ACTIVE`
- **condición** (guardas): la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **falso** (revisión del owner, 2026-09-28, C8: `admite_altas` salió) **y la vertical tiene al menos una versión de plan vigente y vendible** —de ahí se deriva el plan de trial (cap. 10 §2)—: retirados todos los vendibles, no arranca ningún trial (owner 2026-09-27, FASE 9 vuelta 2, `R24`, `F-8V2A3-005`) **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** (cap. 02 §2.2; FASE 8 completa, `F-8CA3-003`)
- **efectos** (efectos): **crea la fila de `trial`**; se asigna el plan de trial; arranca el reloj; se agenda la campaña previa del §10.7

**Texto de la fuente — «La máquina de trial habla el vocabulario del contrato, y no el de la suscripción»** (`V/03-maquinas-de-estado.md:91–122`, sin lo tachado):

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
**Dos de los cuatro sentidos de *«vivo»* —fila viva y fuente
viva—** y por qué no son intercambiables están en el cap. 01 (núcleo) §2.4 (FASE 9 completa, `C-14`).

**Y es el mismo mecanismo que el §9 ya eligió para `PB2` y `PB3`**: atarse al hecho que el
contrato emite —*«la cobertura de (`user`, vertical) cambió»* (`12-contrato…` §3)— en vez de a una
lista de transiciones de la otra épica, mantenida a mano. No agrega un mecanismo: usa el que
estaba, en la segunda máquina que lo necesitaba.

**Qué gana cada fila, en una línea:**

| fila | decía | dice | qué se cierra |
|---|---|---|---|
| `T1` | sin condición sobre el sujeto | `cubierto` **falso** | ya no dispara sobre quien tiene un título, que era la rama que dejaba una fuente `TÍTULO` perpetua |
| `T2` | *«se autoriza una suscripción»* | aparece un título que no es el trial **y, si es suscripción, ya cobró** (`DEC-TRIAL-010`; FASE 9 completa, `C-R12-5`) | ahora alcanza también a quien **recupera** (`S7`), **reanuda** (`S10`) o recibe una cortesía o un grant durante el trial |
| `T3` | *«no hay suscripción autorizada»* | sin condición | `TRIAL_ACTIVE` **siempre** tiene salida: el reloj vence y punto |
| `T6` | *«ya hay una suscripción viva»* | `cubierto` **verdadero** **por un título que convierte** (FASE 9 completa, 6c) | deja de quemar el trial de quien no está cubierto por nada — **y, desde 6c, el de quien está cubierto sólo por una suscripción que todavía no cobró**: lo consume `T8` al primer pago |

**Texto de la fuente — «El trial se convierte con el primer pago acreditado, no con la autorización»** (`V/03-maquinas-de-estado.md:123–150`, sin lo tachado):

(`DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, racimo `R12`: `F-8CA2-006`, `F-8CC1-002`.)

**El defecto.** `T2` convertía en cuanto aparecía un título, y una suscripción emite desde `ACTIVE`
(`12-contrato…` §2.6), **antes de cualquier cobro**. El primero llega entre 26 y 44 minutos después
de autorizar (`PA-3`, `B/12` §4.3); si se rechazaba, `S16` llevaba la fila a `CHARGE_DECLINED` y la
persona quedaba **sin suscripción y sin trial**, que ya no se devuelve (§10.2). Una tarjeta
rechazada le costaba el trial entero.

> **Una fuente `SUSCRIPCIÓN` convierte el trial sólo si trae `cobrada: sí`** (`12-contrato…` §2.1).
> Mientras tanto el trial **sigue corriendo**; si el primer cobro se rechaza, la persona **sigue en
> `TRIAL_ACTIVE` con los días que le quedaban**.

Es la regla de `B/12` §4.4 llevada al trial: *«un primer cobro rechazado no es una suscripción con
un problema, es un alta que no ocurrió»*, y un alta que no ocurrió no consume el trial. **Las otras
tres fuentes de clase `TÍTULO` —cortesía, grant y la suscripción que ya cobró— convierten como
antes**: no tienen un primer cobro que esperar. **Quien recupera
(`S7`) ya pagó sobre esa fila; quien reanuda (`S10`) casi siempre también, y si pausó antes del
primer cobro —`puedePausar()` no mira pagos (`NUCLEO/01` §3)— su fuente vuelve con `cobrada: no` y
convierte al primer pago, como un alta** (FASE 9 completa, `C-R12-3`).

**No rompe `G-R4-B`**: `cobrada` es un campo del contrato, no un estado de la suscripción, y la
máquina sigue hablando sólo el vocabulario del contrato (arriba). **Y el cobro no se difiere al fin
del trial** para no tener que esperar: una fecha futura se convierte sola en un *free trial* del
proveedor (`EX-38`), que es lo que `HOS-1012` eliminó (`DEC-TRIAL-010`).

**Texto de la fuente — «Los 26–44 minutos: dos títulos a la vez, y el pliegue los suma»** (`V/03-maquinas-de-estado.md:164–204`, sin lo tachado):

Mientras el primer cobro no llega, la persona tiene **dos fuentes de clase `TÍTULO`**: la del
trial, que apunta al plan de trial —derivado del plan vendible de `rank` más alto (cap. 02 §2.1)—,
y la de su suscripción `ACTIVE`. **`cubierto` es verdadero por las dos y ninguna se descarta**: el
pliegue del cap. 15 §2.6 no distingue un título de otro, así que las claves `SUMA` suman los dos
cupos y las de «no acumula» toman el más favorable. Es exactamente el caso que la viñeta de `T6`
(abajo) describe como defecto —*«paga el básico y opera con las capacidades del premium»*—,
abierto ahora por la ventana del primer cobro. El pliegue **no duplica** nada que no sumara ya con
dos títulos cualesquiera; lo que cambia es que ahora la ventana existe.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`** (cap. 15 §2.6 lo repite donde se
> pliega):
>
> 1. **Durante la ventana la persona tiene el cupo de los dos títulos sumado.** Si publica por
>    encima del cupo que le va a quedar, al convertir (`T2`) o al rechazarse el cobro (`S16`) el
>    conjunto efectivo baja y **el reconciliador de excedentes** despublica lo que sobra (cap. 15
>    §4.3). Dura lo que tarde el primer cobro: los minutos de `PA-3` en un alta.
> 2. **La ventana es más larga sobre una sucesora con tarjeta**: su primer cobro nace después del
>    vencimiento de su ventana de autorización (`D8`, `B/12` §4.3), hasta 72 h, y mientras tanto
>    trae `cobrada: no`. Alcanza a quien, estando en `TRIAL_ACTIVE`, cambia de plan antes de que un
>    pago acreditado lo convierta.
> 3. **Una `CANCEL_SCHEDULED` que se dio de baja antes del primer cobro no convierte nunca**: **su fin de servicio
>    es el instante de la baja** (`B/03` §3.2, `S11`: una fila sin `covered_period` termina en el
>    acto), así que no cubre y el trial sigue su reloj. Si un primer cobro en vuelo se acredita
>    después (`B/05` §3, `C2`), la fila pasa a `cobrada: sí` y `T2` convierte (FASE 9 completa,
>    `C-R12-4`).
> 4. **Si se pierde el aviso del primer pago** (`12-contrato…` §3), `T2` no dispara, el trial sigue
>    hasta `T3` y la persona termina en `TRIAL_EXPIRED` con su suscripción; la red diaria no corre
>    esta máquina (§9, ⚠️ punto 3); si la persona estaba en `PRE_TRIAL`, `T8` tampoco dispara (§9,
>    ⚠️ punto 3; FASE 9 vuelta 1, `F-8V1C1-010`).
> 5. **Una cortesía sobre una fila que todavía no cobró convierte igual** (FASE 9 completa,
>    `R12-BORDE-2`; declarado por `DEC-METH-015`, FASE 9 completa). El tercer disparador de `S9`
>    (`B/03` §3.2) pausa por cortesía una fila recién autorizada. La `PAUSED · COURTESY` emite
>    `CORTESÍA`, que convierte sin esperar cobro, así que `T2` dispara. Si al volver (`S10`) el
>    primer cobro se rechaza, `S16` deja a la persona sin suscripción y con el trial consumido por
>    esa cortesía. **Causa**: `DEC-TRIAL-010` condiciona sólo la fuente `SUSCRIPCIÓN`. Recibió los
>    meses de cortesía, así que no perdió servicio.

**Texto de la fuente — «el lock de la máquina de trial»** (`V/03-maquinas-de-estado.md:243–280`, sin lo tachado):

(Owner 2026-09-27, FASE 9 vuelta 2, `R15`; `F-8V2A2-001`, `F-8V2A2-002`. **La mitad de `R15` salió
entera** (revisión del owner, 2026-09-28, C12, `L1-b`): su único sujeto era el dueño del corte que contrata sin publicar, y desde
C12 ese dueño amanece en `TRIAL_ACTIVE` con su ficha publicada y convierte por `T2`; **las fichas que no son de las cinco cuentas de la lista
cerrada del owner se borran en el corte** (FASE 5, lote 1 J; simplificación del corte, S-01 y S-02;
`DEC-MIG-007`). **Ninguna ficha del corte nace `UNPUBLISHED_BY_BILLING`
bajo un dueño en `PRE_TRIAL`**, y fuera del corte a `UNPUBLISHED_BY_BILLING` sólo se llega desde
`PUBLISHED`, que viene de un `PB1` que ya ejerció el evento: `T8` siempre lo encuentra y no necesita
la vuelta. Lo que sigue en pie es el lock.)

**Salen** (revisión del owner, 2026-09-28, C12, `L1-b`; arriba).

> **El lock de la máquina de trial es el mismo lock por `user + vertical` que toma la publicación**
> (§9, *«publicar ocupa cupo bajo un lock»*), **y lo toman todas las transiciones de esta tabla.**
> `T1` y `T6` ya lo tienen, porque se evalúan dentro de `PB1`. `T2`, `T5` y `T8` lo toman al
> despertar con el aviso. `T3` lo toma el job del vencimiento. `T4` lo toman `extenderTrial` y la
> acción administrativa. Adentro, cada una
> relee lo que su guarda lee: `cobrada`, el registro del evento y la fecha de fin.

**Coincide con el de publicación porque sus guardas leen lo que escribe la otra.** `T6` lee
`cobrada` dentro de `PB1`, y `T8` lee el registro que `PB1` escribe. Con dos locks, si el primer
cobro se acreditaba mientras `PB1` estaba en vuelo, cada una veía el estado viejo de la otra y
ninguna escribía la fila. Como el evento de `T8` ocurre una sola vez, nadie la escribía después.
Con uno solo pasan en orden. Si entra primero `PB1`, `T8` relee y ve el evento. Si entra primero
`T8`, no lo ve y no dispara, y `PB1` lee después `cobrada: sí`, porque el aviso sale después del
commit de billing (`12-contrato…` §3), así que dispara `T6`. **Siempre escribe una de las dos.**
(Sale
con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`.) Y
es el lock que el contrato nombra cuando dice que `T3` y el canje no se pisan (`12-contrato…`
§4.1). La carrera entre dos personas con el mismo correo no la ordena este lock, sino el `UNIQUE`
del hash (abajo).

**Texto de la fuente — «`T1` y `T6` comparten el par, y sus guardas son complementarias»** (`V/03-maquinas-de-estado.md:281–327`, sin lo tachado):

`T1` y `T6` comparten `desde` y `evento`, y es **uno de los dos pares `(desde, evento)` con dos destinos distintos de
esta épica** (el otro es `PB11`/`PB13`, §9; revisión del owner, 2026-09-28, C10), y uno de los **cuatro** que el diseño declara hoy — los otros dos de billing son `S5`/`S19` y
`S7`/`S19` (FASE 9 completa, `C-12`; `S10`/`S25` salió con la revisión del owner, 2026-09-28, C8), en la tabla de suscripción de la épica de billing, separados también por
un booleano (`B/03` §3.2; la lista está en el cap. 03 (núcleo) §1 regla 7). Lo cuenta `G-R4` sobre
las **diez** tablas (la décima, la del reembolso: FASE 9 completa, 5a), no una lectura a mano. La regla 7 del cap. 03 (núcleo) exige que sus guardas sean
disjuntas, y acá lo son **por construcción y no por acuerdo**: las dos piden la mitad de catálogo —la vertical declara evento y su
plan de trial tiene días > 0—, (la condición de que la vertical admita altas salió con la
revisión del owner, 2026-09-28, C8: FASE 9 vuelta 3, `F-8V3A2-008`), y **lo que las separa es un booleano**, `cubierto`. No hay una regla de precedencia que alguien pueda olvidar leer,
porque no hace falta ninguna.

**Las consecuencias del par, recorridas** (FASE 9 vuelta 1, `F-8V1A2-010`: las filas se nombran por su contenido, no por su ordinal) — la mitad de catálogo × los dos valores de
`cubierto`:

| catálogo | `cubierto` | qué pasa |
|---|---|---|
| declara evento y días > 0 | **falso** | `T1`: arranca el trial |
| declara evento y días > 0 | **verdadero** | `T6`: la fila nace consumida, y el título es la fuente que ya tiene |
| declara evento y días > 0 | **verdadero, pero sólo por una `SUSCRIPCIÓN` con `cobrada: no`** | **ninguna de las dos**: `T6` exige un título que convierte. `PB1` publica igual —el dueño está cubierto— y la fila la escribe **`T8`** al primer pago acreditado; si ese cobro se rechaza, la persona sigue en `PRE_TRIAL` (FASE 9 completa, decisión 6c) |
| no declara evento, **o** días = 0 | cualquiera | **ninguna de las dos dispara en ese momento**, y la persona se queda en `PRE_TRIAL` — **y es final**: el panel no deja encender la prueba de una vertical (revisión del owner, 2026-09-28, N7; `11` §8) |
| | — | **sale** (revisión del owner, 2026-09-28, C8): `admite_altas` ya no existe. El caso que queda es el de la fila de abajo |
| declara evento y días > 0, **pero la vertical no tiene ninguna versión de plan vigente y vendible** ✚ | **falso** | **ninguna de las dos**: `T1` exige una versión vigente y vendible y `T6` exige `cubierto`. La persona se queda en `PRE_TRIAL` **y no publica**, y la pantalla le dice que **la vertical no tiene planes disponibles**, sin ofrecerle suscribirse (cap. 19 §4 fila 29). La vertical **no** queda cerrada a altas: sigue en operación (`B/10` §3.6; owner 2026-09-27, FASE 9 vuelta 2, `R24`) |
| declara evento y días > 0, **pero ya hay una fila de `trial` con el hash de su correo en esa vertical** | cualquiera | **ninguna de las dos**, y tampoco `T8`: las tres exigen que el hash no tenga fila. La persona se queda en `PRE_TRIAL` y **la publicación sigue** **sólo si está cubierta**: sin cobertura `PB1` no publica, porque no arranca ningún trial (FASE 8 completa, `F-8CA3-003`; condición de `PB1`, owner 2026-09-25; abajo) |

**La fila de *«no declara evento, o días = 0»* es nueva y es deliberada.** `T6` no repetía la mitad de catálogo, así que en una
vertical que declarara evento con los días en cero le escribía a un cliente la fila consumida de
un trial **que la vertical todavía no ofrece** — y el día que lo encendiera, esa persona ya no lo
tenía. `DEC-TRIAL-003` contempla exactamente ese día para Partner. Consumir un beneficio que no
existe no es consumirlo: es destruirlo antes de que nazca.

**Sale**
(revisión del owner, 2026-09-28, C8): `admite_altas` ya no existe. **El par sigue disjunto por
construcción**, por el mismo booleano: `T1` pide `cubierto` falso y `T6` verdadero. Con todos los
planes de la vertical retirados y `cubierto` falso tampoco dispara ninguna, y lo dice la fila de
*«la vertical no tiene ninguna versión de plan vigente y vendible»* de la tabla de arriba. **Y
`PB1` publica sólo si el dueño está cubierto o si esa publicación dispara `T1`** (§9; owner
2026-09-25), así que ahí quien no está cubierto no publica.

**Texto de la fuente — «El hash que ya consumió: la rama que la base rechazaba sin que ninguna fila la declarara»** (`V/03-maquinas-de-estado.md:328–364`, sin lo tachado):

(FASE 8 completa, `F-8CA3-003`.) El `UNIQUE(hash_del_correo_normalizado, vertical)` del cap. 02
§2.2 se escribió para **negar** un trial, y alcanzaba también a la escritura que **registra** uno
consumido. Quien borró su cuenta y vuelve con el mismo correo tiene `user_id` nuevo y ninguna fila
propia, pero su hash ya tiene la suya (cap. 02 §4.2 regla 2): si contrataba antes de publicar,
`T6` intentaba escribir la fila consumida, **chocaba con el `UNIQUE`**, y ninguna máquina declaraba
qué pasaba después — con `PB1` y `T6` en la misma transacción, **la persona pagaba y no podía
publicar**.

> **`T1`, `T6`, y `T8` (desde la FASE 9 completa, 6c; `T7` salió: revisión del owner, 2026-09-28, N7) exigen que el hash del correo no tenga fila en esa vertical.** Si la tiene,
> ninguna dispara: el trial ya está consumido por esa fila, **la publicación sigue** **si la persona está cubierta** —sin cobertura `PB1` no publica, porque
> no arranca ningún trial (§9; owner 2026-09-25)— y la persona se queda en `PRE_TRIAL`.
>
> **El mismo `UNIQUE` resuelve la carrera entre dos escrituras de la fila** —`T8` al acreditarse
> el pago y `T6` en un `PB1` simultáneo, o `T1` contra `T8`—: la que choca **no es un error**, es
> la guarda de hash leída tarde. No dispara, y la transacción que la contenía sigue con esa
> lectura: en `PB1`, publica sólo si la persona está cubierta (FASE 9 vuelta 1, `F-8V1A2-009`).

Es la lectura literal de `DEC-TRIAL-004` —*«el email normalizado niega el trial»*— escrita como
guarda en vez de como error de la base. **El par `T1`/`T6` sigue disjunto por `cubierto`**: la
guarda nueva es la misma en las dos, así que no las separa ni las solapa.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**: **esa persona se queda en
> `PRE_TRIAL` para siempre**, porque su `user_id` no tiene fila y ninguna transición la va a
> escribir. Mientras esté cubierta no cambia nada. **Sin cobertura no publica** —`PB1` exige
> cobertura o un `T1` que dispare, y acá `T1` no dispara— y la pantalla le dice *«suscribite para
> publicar»* (§9, cap. 19 §4 fila 21; FASE 8 completa, owner 2026-09-25): la ficha publicada sin
> título y el borrador repetible dejan de existir. Que su fila de `trial` quede asociada a la
> cuenta nueva no está escrito; **ya no tiene consecuencia sobre la publicación**.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:52, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:91, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:123, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:164, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:243, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:281, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:328

<a id="trans-v-t2"></a>

### `TRANS:V:T2` · `T2` — `TRIAL_ACTIVE` → `TRIAL_CONVERTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `TRIAL_ACTIVE`
- **evento** (disparador): **aparece un título que convierte**: una fuente viva de clase `TÍTULO` que no es la del trial **y que, si es de `tipo: SUSCRIPCIÓN`, trae `cobrada: sí`** —sea porque aparece así o porque una ya presente pasa a `sí` con su primer pago acreditado— (`12-contrato…` §2.1; `DEC-TRIAL-010`, owner 2026-09-25; FASE 8 completa, `F-8CA2-006`, `F-8CC1-002`)
- **hacia** (estado destino): `TRIAL_CONVERTED`
- **condición** (guardas): —
- **efectos** (efectos): se cancela la campaña previa; el acceso pasa a depender de esa fuente

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:53, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="trans-v-t3"></a>

### `TRANS:V:T3` · `T3` — `TRIAL_ACTIVE` → `TRIAL_EXPIRED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4) · **también**: [V6](10-corte/V6.md#pieza-v6) (usa)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `TRIAL_ACTIVE`
- **evento** (disparador): llega la fecha de fin
- **hacia** (estado destino): `TRIAL_EXPIRED`
- **condición** (guardas): **—**
- **efectos** (efectos): arranca la campaña de recuperación (la condición salió con la revisión del owner, 2026-09-28, C8); **la publicación la mueve `PB2`**, por el cambio de `cubierto` (§9), **y el reloj de retención tampoco es suyo: lo arranca el hecho 5 por el mismo cambio de `cubierto`**, que escriben `PB2` y el recálculo (cap. 02 §2.5). `T3` no escribe `listing.inactiva_desde` (FASE 9 vuelta 2, `F-8V2A2-007`)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:54, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="trans-v-t4"></a>

### `TRANS:V:T4` · `T4` — `TRIAL_ACTIVE` → `TRIAL_ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4) · **también**: [B9b](20-fase-2/B9b.md#pieza-b9b) (usa)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `TRIAL_ACTIVE`
- **evento** (disparador): promo de extensión o cortesía
- **hacia** (estado destino): `TRIAL_ACTIVE`
- **condición** (guardas): sólo durante `TRIAL_ACTIVE` (§32) **y con la fecha de fin sin pasar**: si ya pasó y `T3` todavía no corrió, el canje contesta `RECHAZADA` y la cortesía no corre. El §32 dice *«nunca después»*, y el estado solo no lo sabe: con el job de `T3` atrasado, un canje revivía un trial cuya fuente el contrato ya había dejado de emitir (FASE 9 vuelta 2, `F-8V2A2-003`)
- **efectos** (efectos): corre la fecha de fin; **re-agenda** la campaña previa. **La promo llega por `extenderTrial`** (`12-contrato…` §4.1), la única escritura de billing en verticales: corre dentro del lock de esta máquina, con el techo de `11` §3, **y guarda la clave de canje en `canje_de_trial` cuando aplica la extensión: un reintento con la misma clave no corre `T4` otra vez y contesta `ACEPTADA`** (cap. 02 §2.2; FASE 9 vuelta 3, `F-8V3C1-003`), y contesta `ACEPTADA` o `RECHAZADA` (owner 2026-09-26, `G4-2`). **La cortesía NO llega por `extenderTrial`**: es la acción administrativa *«extender un trial»* de `NUCLEO/08` §3, de esta épica y fuera del contrato —**origen `SUPER_ADMIN` y motivo obligatorio**, **pasa el techo** de `11` §3.4 y suma al total acumulado con su origen (`11` §3.5), en el mismo lock—; billing no interviene (owner 2026-09-26, P2; FASE 9 vuelta 1)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:55, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="trans-v-t5"></a>

### `TRANS:V:T5` · `T5` — `TRIAL_EXPIRED` → `TRIAL_CONVERTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Adjudicación** (`adjudicacion.json`): VIVO — reemplazo explícito (DEC-TRIAL-010); lo tachado de la fila se omite y lo vigente va entero.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `TRIAL_EXPIRED`
- **evento** (disparador): **aparece un título que convierte**, en el mismo sentido que `T2` (`DEC-TRIAL-010`; abajo, *«`T5` espera el cobro igual que `T2`»*)
- **hacia** (estado destino): `TRIAL_CONVERTED`
- **condición** (guardas): —
- **efectos** (efectos): corta la campaña de recuperación; **la publicación la restituye `PB3`**, por el cambio de `cubierto` (§9)

**Texto de la fuente — «`T5` espera el cobro igual que `T2`, aunque ahí no haya días que proteger»** (`V/03-maquinas-de-estado.md:151–163`, sin lo tachado):

La razón de `DEC-TRIAL-010` —no quemar los días que quedaban— no alcanza a `T5`: en
`TRIAL_EXPIRED` no queda ningún día. **La cambia igual, por dos razones que salen de la fila:**

1. **Sin el cambio, `T5` no dispararía nunca sobre quien se suscribió al final del trial.** Si la
   suscripción aparece en `TRIAL_ACTIVE` con `cobrada: no`, `T2` no convierte; si `T3` vence el
   trial antes del primer cobro, el título **ya había aparecido**, y un `T5` que espera *«aparece
   un título»* no ve ningún evento: la persona quedaba en `TRIAL_EXPIRED` pagando, con la campaña
   de recuperación de `T3` corriendo. Con `cobrada` en el evento, el primer pago la convierte.
2. **Sobre un alta que no ocurrió, `T5` cortaba la campaña de recuperación** —su efecto— y dejaba
   a la persona en `TRIAL_CONVERTED` sin título: justamente a quien intentó volver y no pudo.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:56, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:151

<a id="trans-v-t6"></a>

### `TRANS:V:T6` · `T6` — `PRE_TRIAL` → `TRIAL_CONVERTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PRE_TRIAL`
- **evento** (disparador): el evento de activación declarado por la vertical
- **hacia** (estado destino): `TRIAL_CONVERTED`
- **condición** (guardas): la vertical declara evento **y** su plan de trial tiene días de trial > 0 **y** `cubierto` es **verdadero** **por un título que convierte** —en el mismo sentido que `T2`: si el único título es una `SUSCRIPCIÓN` con `cobrada: no`, `T6` no dispara (owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`)— **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** (cap. 02 §2.2; FASE 8 completa, `F-8CA3-003`)
- **efectos** (efectos): **crea la fila de `trial`, consumida**, sin reloj y sin campaña

**Texto de la fuente — «`T6` espera el cobro, y `T8` lo consume»** (`V/03-maquinas-de-estado.md:205–242`, sin lo tachado):

(Owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`.)

**El defecto.** `T6` pedía `cubierto` verdadero, y una `SUSCRIPCIÓN` con `cobrada: no` **es** de
clase `TÍTULO` y cuenta para `cubierto` (`12-contrato…` §2.1). Quien se suscribía **antes de
publicar** —el orden normal de quien entra pagando— y publicaba en la ventana de su primer cobro
disparaba `T6`: la fila de `trial` nacía consumida, el cobro se rechazaba (`S16`) y la persona
quedaba sin suscripción **y sin trial**, que es lo que `DEC-TRIAL-010` vino a impedir por la otra
puerta de la máquina.

> **`T6` exige un título que convierte, igual que `T2`. Si el único título es una suscripción que
> todavía no cobró, no dispara ninguna del par: `PB1` publica igual, porque el dueño está
> cubierto, y la persona sigue en `PRE_TRIAL`. `T8` consume la fila cuando ese título pasa a
> convertir —el primer pago acreditado— si la persona ya ejerció el evento de activación.**

- **Si el cobro sale bien**, `T8` escribe la fila consumida: el mismo desenlace que `T6` le daba,
  un pago después. El registro del evento de activación es el que `T7` leía (`T7` salió: revisión del owner, 2026-09-28, N7), así que
  no pide ningún hecho nuevo.
- **Si el cobro se rechaza**, `S16` lleva la fila a `CHARGE_DECLINED`, `PB2` baja la ficha y la
  persona queda en `PRE_TRIAL`: su próximo `PB1`, sin cobertura, arranca el trial por `T1`
  —también sobre la ficha que `PB2` bajó, porque `PB1` sale de `UNPUBLISHED_BY_BILLING` cuando
  arranca un trial (§9; FASE 9 vuelta 1, R1)—.
- **La superficie empuja al orden que no necesita `T8`** (decisión del owner, 6c): el botón de
  suscribirse de una vertical **en la que la persona todavía no publicó la manda a publicar**
  **si publicar le arrancaría el trial** (la regla, escrita sólo en `V/19` §4 fila 23; FASE 9
  vuelta 1, `F-8V1D1-004`) —y
  eso arranca el trial— en vez de al checkout (`V/19` §4, fila 23; `B/19`). **`T8` queda como red**
  para quien llega al checkout por otro camino.

**No agrega ningún par a `G-R4`.** `T8` sale de `PRE_TRIAL`, que comparte con `T1` y `T6` (`T7` salió, N7),
pero su evento —*«aparece un título que convierte»*— no lo declara ninguna otra fila de ese
`desde`; `T2` declara el mismo evento desde `TRIAL_ACTIVE`, que es otro par. **Y el par
`T1`/`T6` sigue disjunto por `cubierto`**, pero deja de cubrir toda la mitad de catálogo: con
`cubierto` verdadero sólo por una suscripción que no cobró, **no dispara ninguna de las dos**, que
es el efecto buscado. **No rompe `G-R4-B`**: *«un título que convierte»* es vocabulario del
contrato (`cubierto`, `fuentes` y `cobrada`), no un estado de la suscripción.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:57, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:205

<a id="trans-v-t8"></a>

### `TRANS:V:T8` · `T8` — `PRE_TRIAL` → `TRIAL_CONVERTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PRE_TRIAL`
- **evento** (disparador): **aparece un título que convierte**, en el mismo sentido que `T2` —y en particular, **una `SUSCRIPCIÓN` presente pasa a `cobrada: sí` con su primer pago acreditado**—
- **hacia** (estado destino): `TRIAL_CONVERTED`
- **condición** (guardas): la persona **ya ejerció el evento de activación** en esa vertical —el mismo hecho y el mismo registro que leía `T7`, revisión del owner, 2026-09-28, N7— (la extensión `R15` salió: revisión del owner, 2026-09-28, C12, `L1-b`; abajo) **y** la vertical declara evento y su plan de trial tiene días de trial > 0 **y no hay fila de `trial` con el mismo hash del correo normalizado en esa vertical** —las guardas de catálogo y de hash de `T6`—
- **efectos** (efectos): **crea la fila de `trial`, consumida**, sin reloj y sin campaña — igual que `T6`, con otro disparador (owner 2026-09-25; FASE 9 completa, decisión 6c, `R12-OWNER-1`)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:59, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

## Publicación de la ficha (`V/03` §9)

### Publicación de la ficha (`V/03` §9) — «9. Publicación»

Texto de `V/03-maquinas-de-estado.md:480–654`, sin lo tachado:

Es la máquina de la ficha, y el §63 la pide aparte porque no coincide con la de la suscripción:
una suscripción cubre **todas** las fichas de su vertical (§12), así que un solo evento de
billing mueve varias publicaciones a la vez.

**La máquina tiene
seis estados y trece transiciones** (revisión del owner, 2026-09-28, C10: entra `PB13`, recontadas sobre la tabla): `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED`,
**`PURGED`** y **`MODERATED`**, y de `PB1` a **`PB13`** (recontadas sobre la tabla; FASE 8
completa, `F-8CA2-004`, owner 2026-09-25). Hasta la FASE 8
completa eran cuatro y ocho: el hard delete del día 180 no tenía fila y dejaba la ficha vaciada en
`ARCHIVED`, desde donde `PB7` la republicaba (`F-8CA2-008`, owner 2026-09-25); eso sumó `PURGED` y
`PB9`. **Y la baja por moderación y el borrado del dueño tampoco tenían fila** (`F-8CA2-004`): eso
suma `MODERATED`, `PB10`, `PB11` y `PB12` (abajo, *«la moderación y el borrado del dueño»*).

**La ficha nace en `DRAFT`, y nacer no es una fila de esta tabla** (FASE 9 completa, `B-9`;
declarado por `DEC-METH-015`, FASE 9 completa). Es el hecho 1 —crearla— y la forma de la regla 2
del cap. 03 §1 (núcleo): el estado inicial vive en la creación de la fila. Sin esta línea, la
regla 1 leída al pie de la letra no deja crear una ficha.

**La ficha que ya existía el día del corte y es la única de una de las cinco
cuentas de la lista cerrada del owner nace en el estado que le da esa lista —`PUBLISHED`, salvo que
la lista diga otro—, y toda otra ficha que ya existía la borra la misma migración** (FASE 5,
simplificación del corte, S-01 y S-02; lote 1 J; `DEC-MIG-007`: la tabla de traducción salió),
escrito una sola vez por la migración estructural del corte, junto con la
escritura `C` de `inactiva_desde`. Tampoco es una fila de esta tabla: es la forma de la regla 2
del cap. 03 §1 (núcleo) para una fila que no nació en el sistema nuevo (FASE 9 vuelta 1, R1).
**Y ese borrado no es `PB12` ni `PB9`**: es un acto único de la migración, fuera de esta máquina.

**Qué filas revalidan** (FASE 5, owner 2026-09-30, lote 3 A, `F5-SUP-020`, `F5-SUP-010`). La
tabla no le pedía a ninguna fila que refrescara las páginas públicas, y hoy lo hacen disparadores
que miran `lifecycle_state` y `visibility`. **Revalida la fila que cambia si la ficha es pública:
la que llega a `PUBLISHED` o sale de ahí**, porque `PUBLISHED` es el único estado que lo ajeno ve
(cap. 17 §1.2, precisión 7); cada fila lo dice en su nota. Revalidar es refrescar las páginas que
la muestran —la de la ficha y las que la listan— y va después del commit, como todo efecto fuera
de la base (cap. 03 del núcleo, regla 3). **`V6` migra los lectores y los disparadores de
revalidación a este estado**, que reemplaza a `lifecycle_state`, `visibility` y
`moderation_state`, y las tres viejas se borran en el paso 3 del corte (cap. 02 §2.5). Sin esto,
`PB2`, `PB4` y sobre todo `PB10` dejaban la página servida desde el borde hasta que venciera su
caché. **`PB9` no revalida**, aunque `F5-SUP-020` la listaba: sale de `ARCHIVED`, que ya no se
veía. **El criterio lo confirmó el owner: refrescan la página pública sólo los pasos que entran o
salen de `PUBLISHED`, lo ya aplicado** (FASE 5, lote de la aplicación, owner 2026-09-30, G).

**Ninguna otra puerta borra ni restaura una ficha** (FASE 5, owner 2026-09-30, lote 3 C,
`F5-BD-012`, `F5-SUP-017`). Las de hoy —el borrado del dueño que escribe `deleted_at`, y el
borrado, el borrado físico y la restauración del panel en las tres verticales— se retiran: el
borrado del dueño es `PB12`, el del equipo es la acción 23, a pedido del dueño y con motivo, que
también corre `PB12`, y el borrado físico desaparece (cap. 02 §4.1).

**`PB2` y `PB3` se disparan por el CAMBIO de `cubierto` —o por el del cupo—, no por una lista de
transiciones**, y ése es el arreglo: las dos listas estaban **congeladas** y se quedaron cortas
apenas el diseño se movió. `PB2` enumeraba cuatro causas y **no conocía `S16`** —el alta cuyo primer cobro se
rechaza—; `PB3` enumeraba tres y **no conocía `S2`**, así que **el que recontrataba después de
cancelar pagaba y su ficha no volvía nunca** — y tampoco podía sacarla a mano, porque `PB1` sale de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial
(FASE 9 vuelta 1, R1) —y quien recontrata está cubierto—.

**El contrato ya emite el hecho** —*«la cobertura de (user, vertical) cambió»* (`12-contrato…`
§3)— así que atarse a él **no agrega un mecanismo: usa el que estaba**. Una lista de transiciones
en una épica, mantenida a mano contra los cambios de la otra, es el punto de falla favorito de un
arreglo hecho por racimos.

**Pero el hecho dice CUÁNDO preguntar y no contesta la pregunta, y las tres
filas del reloj —`PB4`, `PB5` y `PB9`— releen antes de actuar.** El §3 del contrato prohíbe decidir con lo que trae el aviso —*«un consumidor que
decidiera con lo que trae el evento estaría creyéndole a un mensaje en vez de al estado»*—, y `PB4`
y `PB5` **deciden lo más caro que decide esta máquina** **después de `PB9`**: el día 90 es el primer escalón del hard
delete del día 180 (cap. 02 §4.1). Así que las tres, en el momento de ejecutar, **vuelven a pedirle
la cobertura al contrato**: si el `user + vertical` está cubierto, no archivan y **reinician el
reloj** escribiendo `listing.inactiva_desde` (cap. 02 §2.5, hecho 2 del cap. 01 §1.2, núcleo). Un
aviso perdido pasa así a costar un retraso en el reinicio y nunca un archivado indebido — y que
estos avisos se pierden lo declara el propio diseño en el otro consumidor de la misma lista
(cap. 02 §3.2, regla 2). **La relectura no restituye**: si el aviso perdido era el de la vuelta, la
ficha que está abajo la republica **el reconciliador diario de cobertura** (final de este §;
`DEC-ARCH-009`), no `PB4`.

**Y desde la FASE 8
completa el tercero tiene fila: es `PB9`** (`F-8CA2-008`, owner 2026-09-25). El hard delete del día
180 **mueve la ficha a `PURGED`** en vez de dejarla vaciada en `ARCHIVED`, y **relee exactamente
igual que `PB4` y `PB5`, por la misma razón y con el mismo efecto**: si la cobertura vuelve
verdadera, no borra y escribe el hecho 2 (cap. 01 §1.2, núcleo; cap. 02 §4.2, regla 4). Es el
único acto irreversible del programa, y ahora la tabla lo dice en vez de dejarlo afuera.

**Y el excedente queda como la única causa enumerada**, porque es la que **no** cambia `cubierto`:
la persona sigue cubierta y lo que no le alcanza es el cupo.

**Y por eso `PB3` y `PB7` tienen la misma disyunción, que es lo que faltaba: sin la segunda rama,
el excedente entraba y no salía nunca.** El recorrido, porque es corto y termina en un borrado:
un anfitrión con cinco fichas baja de Premium a Básico, el reconciliador le despublica tres por la
segunda rama de `PB2`, y tres meses después **vuelve a Premium y paga el precio entero**. Su
`cubierto` fue verdadero de punta a punta —un upgrade es una sucesión, y la predecesora emite
hasta que `S17` la mata (`12-contrato…` §2.6)—, así que **no hay ningún cambio de `cubierto` que
disparar**. Con `PB3` pidiendo sólo ese cambio, las tres se quedaban en
`UNPUBLISHED_BY_BILLING`, desde donde no salía ninguna otra fila — `PB1` sale de `DRAFT`, y de
`UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)—, y
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
> ficha archivada **mientras su dueño no estaba cubierto** — una
> pérdida de cobertura que no es una pausa del dueño, porque la pausa ya no archiva: revisión del owner, 2026-09-28, C14—, que **al
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
restituir no es publicar, igual que en la rama vieja (la salvedad salió con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`). Tampoco agrega pares a `G-R4`: son **dos
eventos en la misma fila con el mismo destino**, no dos filas sobre un par — la misma forma que
`PB2` ya tenía (cap. 03 §1 regla 7, núcleo).

**`UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT` a propósito.** Si billing bajara la
ficha a `DRAFT`, al recuperar la cobertura no habría forma de saber cuáles republicar sin
publicar también las que el dueño había bajado él. La distinción es lo que hace posible PB3.

**El excedente tras un downgrade tiene criterio escrito y predecible**: se despublican **las
publicadas más recientemente**, hasta entrar en el límite, y **el criterio va escrito en el
aviso** — si el cliente no puede leerlo, deja de ser predecible y se pierde el motivo por el que
se eligió (`DEC-SUB-008`).

## Publicación de la ficha (`V/03` §9) — las transiciones

<a id="trans-v-pb1"></a>

### `TRANS:V:PB1` · `PB1` — `DRAFT` **o `UNPUBLISHED_BY_BILLING`** (FASE 9 vuelta 1, R1) → `PUBLISHED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6) · **también**: [V4](10-corte/V4.md#pieza-v4) (provee)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Adjudicación** (`adjudicacion.json`): VIVO — reemplazos explícitos; lo tachado de la fila se omite y lo vigente va entero.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `DRAFT` **o `UNPUBLISHED_BY_BILLING`** (FASE 9 vuelta 1, R1)
- **evento** (disparador): el dueño publica
- **hacia** (estado destino): `PUBLISHED`
- **nota** (guardas y efectos): **sólo si el dueño está cubierto** —`cubierto` verdadero en esa vertical— **o si esta publicación dispara `T1`**, o sea si arranca un trial: la persona está en `PRE_TRIAL` y se cumplen las condiciones de `T1` (§2). **Si no, no publica**, y la pantalla le dice *«suscribite para publicar»* (cap. 19 §4 fila 21) (FASE 8 completa, owner 2026-09-25). Es **inmediato, sin revisión previa** (`DEC-TRIAL-005`): publicar es quedar visible, y es el evento que consume el trial en las verticales con ficha. **Toma el lock del `user + vertical` y cuenta el cupo adentro** (abajo, *«publicar ocupa cupo bajo un lock»*; FASE 8 completa, `F-8CA1-006`, `F-8CA2-010`, owner 2026-09-25). **Desde `UNPUBLISHED_BY_BILLING` sale sólo por la segunda rama**: si esta publicación dispara `T1`. Es el camino del dueño que perdió la ficha por billing y todavía no estrenó su trial — quien quedó en `PRE_TRIAL` por un primer cobro rechazado (§2, `T8`)— (la cartera del corte ya no: nace con su ficha publicada y su prueba activa; revisión del owner, 2026-09-28, C12, `L1-b`; *«o en `DRAFT`»* salió con la simplificación del corte, S-02: las fichas que no son de las cinco se borran). **Con cobertura no sale por acá**: la ficha vuelve por `PB3`, con el criterio de *«cuáles vuelven»*, y no a mano (FASE 9 vuelta 1, R1; owner 2026-09-26, `G1-1`). **Revalida: sí**, llega a `PUBLISHED` (FASE 5, lote 3 A)

**Texto de la fuente — «La moderación y el borrado del dueño»** (`V/03-maquinas-de-estado.md:655–679`, sin lo tachado):

FASE 8 completa, `F-8CA2-004`, owner 2026-09-25.

**Desde `DEC-TRIAL-005` toda moderación es reactiva, y hasta acá ninguna fila bajaba una ficha por
decisión nuestra ni la borraba.** Por la regla 1 del cap. 03 §1 (núcleo) esos actos no se
ejecutaban, y llevarlos a un estado existente los deshacía la propia máquina: desde `DRAFT` el
dueño la republica con `PB1`, y desde `UNPUBLISHED_BY_BILLING` la republica `PB3` en el próximo
cambio de cobertura o de cupo. **`MODERATED` es un estado propio por la misma razón que
`UNPUBLISHED_BY_BILLING` es distinto de `DRAFT`**: el estado es lo que dice quién puede sacarla de
ahí.

- **Entra desde cualquier estado no final** (`PB10`): `DRAFT`, `PUBLISHED`,
  `UNPUBLISHED_BY_BILLING` o `ARCHIVED`. `PURGED` es final.
- **No la republica nadie más que un admin**: ni el dueño con `PB1`, ni el sistema con `PB3` o
  `PB7`. **Sólo un admin la saca, y la devuelve a donde estaba** (revisión del owner, 2026-09-28, C10, `L2-i`): a
  `DRAFT` si era borrador (`PB11`), y si estaba publicada o bajada por billing, a
  `UNPUBLISHED_BY_BILLING`, donde `PB3` la sube en el mismo acto si hay cobertura y cupo (`PB13`).
  El dueño **sí** la puede borrar (`PB12`, `g3`).
- **No cuenta para el cupo** ni compite por él (abajo, *«qué cuenta para el cupo»*).
- **No devuelve el trial** (§10.2). `V/11` §2.2 ya separa la baja justificada, que no repara nada,
  del error de moderación, que se repara con los instrumentos de `V/11` §2.3 y no con una
  transición de vuelta.

**Texto de la fuente — «La moderación en dos niveles»** (`V/03-maquinas-de-estado.md:680–841`, sin lo tachado):

(revisión del owner, 2026-09-28, C10, `L2-i`, `g3`.)

**Vale sólo para fichas**: el bit de moderación de la presencia de Partner no tiene niveles
(`V/18` §1.6; revisión del owner, casos vecinos, 2026-09-29, caso 14).

**El admin elige entre dos niveles, y puede cambiar su elección en las dos direcciones:**

1. **Pedir un arreglo sin bajar la ficha.** Es una **marca al costado, no un estado**: el
   *«pedido de arreglo»* (`V/02` §2.5), con su motivo, una fecha sugerida si la hay, quién y
   cuándo, y si el dueño avisó que ya lo corrigió. La ficha sigue donde está (publicada, si lo
   estaba), sigue cubierta y sigue ocupando cupo; **no toca el reloj de retención** y **no cambia
   `admiteDestaque`** (`12-contrato…` §4.1: lo que lo apaga es `MODERATED`, no la marca). Es la
   misma forma que la marca de conciliación de billing (`DEC-CONC-003`): se abre y se cierra sin
   mover el estado.
2. **Bajarla hasta que se arregle.** Es `MODERATED`, por `PB10`, como hasta ahora.

**Cambiar de nivel**: de pedido a baja es `PB10` con el pedido abierto; de baja a sólo pedido es
`PB11` o `PB13` con el pedido abierto, **y sigue la misma regla que levantar**: la ficha vuelve a
donde estaba. **Levantar del todo** es `PB11` o `PB13` con el pedido cerrado, o, si la ficha no
estaba bajada, cerrar el pedido. Todo es la misma acción administrativa (`NUCLEO/08` §3), con su
motivo y su aviso (`NUCLEO/07` §6: pedido de arreglo, cambio de nivel, moderación levantada).

**El dueño avisa que corrigió** con una operación propia sobre su ficha, que pasa por los siete
pasos como cualquier escritura sobre lo propio y **no** cierra el pedido: lo cierra el admin.
**Y el panel tiene un listado de arreglos pendientes** (`V/19`): los pedidos abiertos, con su
antigüedad, la fecha sugerida vencida y los que el dueño ya avisó.

**Qué puede hacer el dueño sobre una ficha `MODERATED`** (`g3`): **verla, exportarla, editarla y
borrarla; no publicarla**, porque la levanta el admin. Editar es el hecho 1 y reinicia el reloj;
borrar es `PB12`, con correo de confirmación. **Ningún proceso automático baja ni sube una ficha por
moderación**: lo cubre la regla de que los procesos automáticos no ejecutan acciones administrativas.

**El reloj de inactividad corre en `MODERATED`, por la regla general del cap. 01 §1.2 (núcleo)**:
la inactividad es *«el tiempo que lleva sin estar a la vez publicada y cubierta»*, y una ficha
moderada no está publicada. **`PB10` no escribe `listing.inactiva_desde`**: la
ejecuta un admin, y el hecho 1 es *«un acto del dueño»*. Lo que no pasa mientras dura es que alguien actúe
sobre ese reloj: `PB4`, `PB5` y `PB9` no tienen `MODERATED` en su `desde`, así que **una ficha
moderada no se archiva ni se borra por inactividad**. **`PB11` sí lo escribe: levantar la moderación es el hecho 6** (owner 2026-09-25; FASE 9
completa, decisión 5b, `OW-1`). Leída la versión anterior —*«al volver a `DRAFT` la ficha trae la
inactividad acumulada»*—, una moderación larga sobre un dueño sin cobertura terminaba en
`PB11` → `PB5` → `PB9`: el archivado con un aviso que imprimía una fecha de borrado ya pasada y el
borrado en la corrida siguiente, días después de que un admin decidiera que la ficha estaba bien.
Con el hecho 6 la ficha vuelve a `DRAFT` con el reloj en cero, y lo que le toca es lo de
cualquier borrador recién tocado. Y el hecho 5 —*«el dueño pierde la cobertura en la vertical»*— se escribe también sobre
ella, porque alcanza a toda ficha del dueño en la vertical, publicada o no.

**`PB12` lleva al mismo estado final que `PB9`, y por eso no hace falta uno nuevo.** `PURGED` ya
dice *«la fila queda, el contenido no, y no vuelve»*; lo que cambia es quién lo pide y cuándo:
**el dueño, y el borrado es en el acto**. No relee la cobertura, porque la relectura de `PB4`,
`PB5` y `PB9` existe para no borrarle nada a alguien que volvió, y acá el que borra es el dueño.
Es el evento que `A6` (`B/03` §8) llama *«se borra la ficha destino»*, y desde
`K-9` es la única fila que lo ejecuta: la orfandad de `A5` (`B/16` §4.2) ya no mira el borrado.
**No es el único**: `PB9` llega al mismo `PURGED`, así que también dispara `A6` (FASE 9 vuelta 1,
`F-8V1A2-002`, `F-8V1C1-013`) (orquestador, FASE 8 completa, 2026-09-25). **Billing se entera por
dos caminos** (owner 2026-09-26, `G2-1`, contra la recomendación: no se acepta ni un cobro de más):
`PB9` y `PB12` le **empujan en el mismo acto, después de su commit** (FASE 9
vuelta 1, `N-G2V-01`/`N-G4V-05`) el hecho *«la ficha llegó a `PURGED`»*
(`12-contrato…` §3.1), y como ese empuje no tiene transporte durable, **la red es la consulta
`fichaPurgada` del contrato §4.1, que billing lee en su barrido diario** (`B/09` §3). Las construye
V6, dueña de `PB12`: la consulta y el empuje de `PB12`; el de `PB9` va con V9, que tiene esa fila
(`descomposicion.md` §2).

**`PB10` y `PB12` no agregan pares a `G-R4`;
`PB11` y `PB13` sí agregan uno** (revisión del owner, 2026-09-28, C10). `PB10` y `PB12` comparten `desde` con casi toda la
tabla, pero sus eventos —el acto del admin y el del dueño— no los declara ninguna otra fila, así
que cada par tiene **una sola** fila; **`PB11` y `PB13` comparten el par `(MODERATED, un admin levanta la baja)` con
dos destinos, `DRAFT` y `UNPUBLISHED_BY_BILLING`**, y sus guardas son disjuntas por construcción:
las separa el estado de origen que el evento de `PB10` guardó, un valor y no una combinación (cap.
03 §1 regla 7, núcleo; lo cuenta `G-R4`). `PB12` sale también de `MODERATED`, con otro evento. **Ninguna es de la clase del reloj** (cap. 17 §3.4), así que `G-R3-B` no ve
nada nuevo; **ninguna condición lee una columna**, así que `G-R6` tampoco; **`PB11` escribe
`listing.inactiva_desde` desde la FASE 9 completa** —el hecho 6, decisión 5b—, y `G-R6-B` mitad
*(a)* la admite **por la lista**, como a los otros cuatro hechos (cap. 20 §2; el 4 salió con la revisión del owner, 2026-09-28, C8).

> ⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`** (ninguno mueve plata en
> el camino principal, da acceso indebido ni borra datos):
>
> 1. **Cerrado** (revisión del owner, 2026-09-28, `g3`): `PB12` sale de `MODERATED`, con
>    correo de confirmación.
> 2. **Cerrado** (`g3`): verla,
>    exportarla, editarla y borrarla, no publicarla (arriba, *«la moderación en dos niveles»*;
>    `V/17` §1.2 paso 4). Editar es el hecho 1 y reinicia el reloj.
> 3. **Los avisos al dueño** al moderar, al levantar la moderación y al borrar no tienen fila en
>    `V/19` §4, y la fila 20 de ahí dice *«se borró por inactividad»*, que no es la causa de una
>    ficha que llegó a `PURGED` por `PB12`. **Cerrado en parte** (FASE 9 vuelta 1; owner
>    2026-09-26, `G2-3`; precisado 2026-09-26), y por partes:
>    - **Al moderar (`PB10`): cerrado.** Tiene la fila 24 de `V/19` §4 y su correo en
>      `NUCLEO/07` §6, porque el dueño no está presente cuando un admin modera y la fila sola no
>      le llegaba. La fila nombra el motivo y los destaques recurrentes sobre esa ficha, que se
>      siguen cobrando hasta que el dueño los dé de baja.
>    - **Al levantar
>      (`PB11`, `PB13`) y al cambiar de nivel: cerrado** (revisión del owner, 2026-09-28, C10): los
>      correos *«cambio de nivel»* y *«moderación levantada»* de `NUCLEO/07` §6.
>    - **Al borrar (`PB12`): abierto, y con dos huecos**; **cerrado sobre una ficha `MODERATED`**,
>      con el correo de confirmación (`g3`), y sobre las demás sigue abierto. **El correo, cerrado
>      en todo `PB12`** (revisión del owner, casos vecinos, 2026-09-29, caso 15): sale sobre cualquier
>      ficha que su dueño borra. Lo que sigue abierto es la fila de Mi Cuenta: no tiene fila, y la fila 20 sigue
>      nombrando sólo `PB9` y la causa *«por inactividad»*, así que una ficha borrada por su dueño
>      no tiene texto propio en Mi Cuenta.
> 4. **El contenido de una ficha moderada no tiene fin**: ningún reloj actúa en `MODERATED`, así
>    que se conserva mientras dure la moderación.
> 5. **CERRADO por el owner el 2026-09-25** (FASE 8
>    completa): **borrar lo propio es parte del piso**. La fila 3 de la lista cerrada de la versión de
>    piso (cap. 02 §2.1) otorga ahora verla, exportarla, reactivarla **y borrarla**, así que el paso 6
>    autoriza `PB12` siempre, con o sin plan (cap. 17 §1.2 precisión 1). La lista sigue teniendo tres
>    filas y `G-R3` no cambia: es la misma clave, *«recuperar lo suyo»*, de clase `DE_ACCESO`.
> 6. **Cerrado**
>    (revisión del owner, 2026-09-28, N7): releen el estado de la ficha y la pausa, y no salen sobre
>    una `MODERATED`, una `PURGED` ni con el reloj detenido (`NUCLEO/07` §6). Lo que decía: (FASE 9 completa,
>    `B-4`; declarado por `DEC-METH-015`, FASE 9 completa). El reloj se escribe en `MODERATED` —el
>    hecho 5 alcanza a toda ficha del dueño— y, por la letra de los hechos 2 y 5 (el 4 salió con la revisión del owner, 2026-09-28, C8) (*«toda
>    ficha»*), también en `PURGED`. Sobre una ficha moderada, el aviso anuncia un archivado o un
>    borrado que `PB4`, `PB5` y `PB9` no van a ejecutar; sobre una purgada, algo que ya pasó.
>    **Causa**: los avisos leen la columna (`V/02` §2.5, lectores 4 y 5) y no el estado.
> 7. **Cerrado** (revisión
>    del owner, 2026-09-28, C9 y N7): el archivado (`PB4` o `PB5`) escribe la fecha de borrado que
>    anuncia (el instante del archivado más la distancia, sobre el reloj de la ficha, entre su fecha
>    de archivado y la de borrado, con la versión de plazos que la ficha guarda) y **`PB9` no borra
>    antes de esa fecha**. Un archivado que corrió tarde anuncia una fecha más tarde, y un `N` de
>    `PB5` que no queda por debajo del plazo de borrado lo rechaza el panel (`NUCLEO/02` §1.5). Lo
>    que decía: (FASE 9 completa, `K-5`,
>    `B-2`, `B-3`; declarado por `DEC-METH-015`, FASE 9 completa). `PB9` exige `ARCHIVED`, así que
>    el **orden** se cumple siempre; el **espacio** no: `PB9` cuenta sobre `inactiva_desde` y no
>    sobre el instante del archivado, así que un `N` de `PB5` entre 180 días y 6 meses (`V/20` §2,
>    `G-R5-B`) o un job de `PB4`/`PB5` caído más que su plazo (`V/02` §4.1) dejan al borrado en la
>    corrida siguiente al archivado, sin el tiempo para exportar que el aviso supone. **Causa**: el
>    borrado se ató al reloj de la ficha y no al del archivado. Levantar una moderación larga ya no
>    es uno de estos casos: `PB11` reinicia el reloj (hecho 6).
> 8. **El empuje de *«la ficha llegó a `PURGED`»* no tiene transporte durable** (FASE 9 vuelta 1;
>    owner 2026-09-26, `G2-1`). Éste **sí puede mover plata**, y por eso se nombra aunque el
>    encabezado diga lo contrario: si el empuje de `PB9` o de `PB12` se pierde, `A6` corre recién
>    cuando el barrido diario de billing lee `fichaPurgada: sí` (contrato §4.1), y si el cobro
>    mensual de un destaque `LISTING` cae en ese día, entra. `S21` lo pone delante de una persona
>    con la marca del motivo 14. **La red es la consulta, no el empuje**, y un borrado que no pasa
>    por `PB9` ni por `PB12` **—desde `G5-2` el admin
>    no tiene ninguno (`NUCLEO/08` §3); el que queda es el borrado de la cuenta pedido por el propio
>    usuario, pendiente en `NUCLEO/08` §1 (fuera de esta épica, **por soporte desde el panel con una lista de pasos que corre `PB12` en cada ficha antes de dar de baja la cuenta (caso I-C), así que ya no borra ninguna ficha sin `PB12`** (revisión del owner, casos vecinos, 2026-09-29, caso F-C), HOS-1393 (`https://linear.app/hospeda-beta/issue/HOS-1393`): revisión del owner, 2026-09-28, N7, `g1`), y `fichaPurgada` contesta `sí` sobre la fila que ya no
>    existe (FASE 9 vuelta 1, §4 punto 1 de `22-verificado-G2`)—** no empuja nada y depende
>    sólo de ella. **Un empuje emitido antes del commit no sería un empuje perdido de vez en
>    cuando: sería un empuje perdido siempre**, porque `A6` relee `fichaPurgada` y lee `no`; por eso
>    sale después del commit (contrato §3.1; FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`). **Causa**: el outbox del núcleo es de correos, y ningún hecho de verticales
>    tiene transporte durable (`12-contrato…` §3).

**Texto de la fuente — «Publicar ocupa cupo bajo un lock por `user + vertical`»** (`V/03-maquinas-de-estado.md:842–930`, sin lo tachado):

FASE 8 completa, racimo `R14`: `F-8CA1-006`, `F-8CA2-010`, `F-8CA2-009`; owner 2026-09-25.

**El paso 7 del cap. 17 §1.2 contaba y la transición escribía después, sin nada en el medio.** Dos
`PB1` simultáneos leían el mismo conteo y publicaban los dos: con un plan de 3 quedaban 4, y en
`PRE_TRIAL` quedaban dos fichas en trial, contra el invariante 6 del cap. 04 (núcleo), *«máximo una
ficha en trial»*. El reconciliador de excedentes no se enteraba, porque se dispara cuando el
conjunto efectivo se recalcula (cap. 15 §4.2) y una carrera no recalcula nada. Y `PB1` contra
`PB2`: autorizado en t0, `PB2` baja las publicadas en t1, `PB1` escribe en t2 y la ficha queda
publicada sin cobertura, con el reloj reiniciado por el hecho 3.

> **Toda transición que ocupa cupo —`PB1`, `PB3` y `PB7`— toma un lock por `user + vertical` y
> cuenta dentro de él. `PB2` toma el mismo, en sus dos ramas.** Dos publicaciones simultáneas del
> mismo dueño en la misma vertical pasan una detrás de la otra, y la segunda cuenta lo que la
> primera escribió.

**Es la forma de la regla de concurrencia de `B/05` §2, `C1`, llevada a esta máquina**: *«el proceso
que suspende relee y reevalúa dentro de la misma transacción que escribe»*. Acá lo que se evalúa
dentro del lock son **los pasos 5 a 7** del cap. 17 §1.2 —fuente viva, conjunto efectivo y cupo—,
no sólo el 7, y eso es lo que hace que el mismo lock resuelva también la carrera contra `PB2`: si
`PB2` corre primero, `PB1` entra después, relee y ya no hay cobertura; si `PB1` corre primero,
`PB2` entra después y encuentra la ficha recién publicada entre las que baja.

- **Por qué `user + vertical`**: es el alcance del cupo —la resolución de entitlements y limits es
  por `user + vertical` (cap. 02 §3.1)— y el de `PB2`, que baja todas las fichas del dueño en la
  vertical. El cupo del trial es uno más de esos cupos, así que el invariante 6 queda cubierto sin
  regla aparte.
- **Los dos reconciliadores lo toman sin regla propia**: el de excedentes (cap. 15 §4.2) y el
  diario de cobertura (abajo) corren `PB2`, `PB3` y `PB7`, y el lock es de la transición, no de
  quien la dispare.
- **Las que liberan cupo también lo toman**: `PB4`, `PB6` y `PB12`, como
  `PB10` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-u`). **Para el conteo no lo necesitan**: una carrera con ellas
  sólo puede hacer que un conteo vea una publicada de más, y eso rechaza de más, nunca publica de
  más —**para `PB1`, `PB3` y `PB7`; para la rama del excedente de `PB2`, ver una de más baja una
  de más, y la devuelve el reconciliador diario** (⚠️ de abajo, punto 3; FASE 9 completa,
  `C-R14-1`)—. **Lo toman por su `desde`**, que comparten con una que lo toma: `PB4` con `PB2` y
  `PB3`, `PB6` con `PB2`, y `PB12` con `PB1`, `PB3`, `PB7`, `PB8` y `PB9`. Es la carrera de `PB10`
  (abajo), que no es de conteo. **Con esto la excepción de las que sólo liberan cupo queda vacía.**
- **Las que no ocupan ni liberan cupo lo toman si comparten `desde` con una que lo toma** (FASE 9
  vuelta 2, `F-8V2A2-004`). **`PB8` y `PB9`** salen de `ARCHIVED`, como `PB7`, así que lo toman y
  releen su `desde` adentro. `PB9` relee además el reloj y la cobertura, porque es la única
  irreversible y corre el mismo día que el aviso le imprime al dueño como fecha de borrado. Sin
  lock, `PB9` borraba sobre una lectura vieja el contenido que `PB8` o `PB7` acababan de
  devolver, y `PURGED` no tiene red. **Y `PB5`**, que sale de `DRAFT` como `PB1`, `PB10` y `PB12`, lo
  toma y relee su `desde` adentro: sin lock archivaba un borrador que `PB1` acababa de publicar
  (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-z2`). **`PB11` y `PB13` lo toman** (revisión del owner, 2026-09-28, C10): comparten
  `MODERATED` con `PB12`, y `PB13` evalúa `PB3` adentro, que ocupa cupo.
- **`PB10` libera cupo y también lo toma, porque comparte `desde` con `PB3` y con `PB9`** (FASE 9
  vuelta 2, verificación, caso vecino de `14-`, arreglo de texto): sale de `UNPUBLISHED_BY_BILLING`,
  como `PB3`, y de `ARCHIVED`, como `PB7`, `PB8` y `PB9`. Toma el lock y relee su `desde` adentro.
  La viñeta de las que liberan cupo sólo miraba el conteo, y la carrera de `PB10` no es de conteo:
  sin lock, un admin modera una ficha mientras `PB3` la restituye, y `PB3` escribe `PUBLISHED`
  sobre lo que leyó antes, o `PB9` borra la ficha que el admin acababa de moderar para revisarla.
- **No es el lock distribuido que `B/05` §1 descarta.** Ese § lo descarta por *«el que lo toma y
  muere»*; éste vive dentro de la transacción que escribe y se suelta con ella. Con qué primitiva
  de la base se implementa es libertad de implementación.

**El reconciliador diario de cobertura queda como red** (`DEC-ARCH-009`): si igual quedan más
fichas en `PUBLISHED` que el cupo, su tercera fila corre la segunda rama de `PB2`, con hasta un día
de atraso.

> ⚠️ **Lo que esto NO cierra, declarado con su causa por `DEC-METH-015`**:
>
> 1. **Ningún guard verifica que las transiciones que ocupan cupo tomen el lock.** Un camino que lo
>    omita reabre la carrera, y la red es la del párrafo de arriba, con su día de atraso.
> 2. **El lock es de las transiciones de publicación, no de todo limit** (FASE 9 completa,
>    `R14-BORDE-1`; declarado por `DEC-METH-015`, FASE 9 completa). Las fotos, los destaques y la
>    cuota de un entitlement medido pasan el paso 7 del cap. 17 §1.2 sin lock, así que dos
>    escrituras simultáneas del mismo dueño pueden pasar el cupo en una unidad cada una. Y no hay
>    red, porque el reconciliador de excedentes se dispara por el recálculo del conjunto y no por el
>    conteo (cap. 15 §4.2). **Causa**: la decisión se tomó sobre los tres hallazgos del racimo, y los
>    tres son de fichas. Lo que se regala es cupo de una clave que el cliente ya paga.
> 3. **«Las que liberan no lo necesitan» vale para `PB1`, no para `PB2`** (FASE 9 completa,
>    `R14-BORDE-2`; declarado por `DEC-METH-015`, FASE 9 completa). Una carrera entre la rama del
>    excedente de `PB2` y un `PB6` o un `PB12` del dueño deja **una ficha abajo de más**. Y `PB4`
>    sin lock puede archivar una ficha que `PB3` acaba de republicar. Las dos las devuelve el
>    reconciliador diario de cobertura al día siguiente (su fila 2). **Causa**: el argumento se
>    escribió pensando en el conteo de `PB1`, que con una de más rechaza. Para `PB2`, con una de más
>    despublica. Ninguno de los dos casos publica de más ni borra.
> 4. **Dentro del lock, los pasos 5 y 6 pueden responder con el caché** (FASE 9 completa,
>    `R14-BORDE-3`; declarado por `DEC-METH-015`, FASE 9 completa) (cap. 02 §3.1), y ningún texto
>    ordena su invalidación respecto de `PB2`. Si `PB2` suelta el lock antes de que se invalide la
>    entrada, un `PB1` puede publicar sin cobertura. Lo baja la fila 1 del reconciliador diario al
>    día siguiente: el atraso es de un día, no los 90 de `F-8CA2-009`. **Causa**: el lock serializa
>    las escrituras, no las lecturas del caché.

**Texto de la fuente — «Cuáles vuelven, cuando el cupo no alcanza para todas»** (`V/03-maquinas-de-estado.md:931–1009`, sin lo tachado):

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

**Una ficha `PURGED` no es candidata**: no está en el `desde` de `PB3` ni en el de `PB7`, y no
cuenta para el cupo, así que ni ocupa lugar ni compite por él (`PB9`; FASE 8 completa,
`F-8CA2-008`, owner 2026-09-25).

**Qué cuenta para el cupo: las fichas en `PUBLISHED`, y ninguna otra** (FASE 8 completa, owner
2026-09-25; lo que el corpus ya asumía, dicho en un solo lugar). Es la lectura que sostienen todas
las filas que lo nombran: `PB2` **despublica** el excedente hasta entrar en el límite, `PB3` y `PB7`
**publican** hasta llenarlo, `DEC-SUB-008` plantea el caso como *«5 fichas publicadas que baja a un
plan de 3»*, publicar (`PB1`) es lo que **consume** un limit (`V/15` §3.4) y volver a `DRAFT` por
`PB8` **no cuenta contra ningún limit** (`V/02` §2.1). Así que `DRAFT`, `UNPUBLISHED_BY_BILLING` y
`ARCHIVED` **no ocupan lugar** —las dos últimas son candidatas que compiten por él— y `PURGED`, que
es final, **ni ocupa lugar ni compite**. **`MODERATED` tampoco**: no está en el `desde` de `PB3` ni
en el de `PB7`, así que ni ocupa lugar ni compite por él (`PB10`; FASE 8 completa, `F-8CA2-004`,
owner 2026-09-25), **mientras está moderada**.

**La ficha que vuelve de la moderación por `PB13` entra a esta misma cola, y recupera su lugar si
le toca** (FASE 9 vuelta 3, owner 2026-09-30, lote O, `F-8V3A2-003`). Mientras estuvo moderada el
reconciliador llenó su lugar con la candidata de abajo, y `PB13` encontraba el cupo lleno: la más
vieja quedaba abajo y el conjunto publicado dependía de la historia de moderación, contra la
propiedad de arriba. Ahora `PB13` la ordena junto con las publicadas, por el mismo criterio y con
su instante de publicación, que es el de su último evento de publicación, anterior a la
moderación. Si le toca, sube, y la publicada que queda fuera baja por la rama del excedente de
`PB2`, que es *«cae lo más reciente primero»* (`DEC-SUB-008`). Con esto el conjunto publicado
**sigue dependiendo sólo del cupo**, también después de una moderación.

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

**Y la ficha del corte, que no tiene ninguna publicación en ese registro, cuenta como publicada en
el instante del corte** (FASE 9 vuelta 1, `N-G1-01`). R1 le dio estado y reloj a toda ficha
preexistente, pero no el tercer dato que `UNPUBLISHED_BY_BILLING` consume: nació por la escritura
`C` de la migración (`V/21` §2.4), no por `PB1`, así que el criterio no la ordenaba y la ficha que
quedaba visible era la que la implementación recorriera primero. **La lectura es ésta, sin columna
nueva y sin escribir en el registro un evento que no ocurrió**: el instante de publicación de una
candidata es el de su último evento de publicación en el registro y, si no tiene ninguno, el de su
escritura `C` —el mismo instante que el corte le pone en `inactiva_desde`—. Así una ficha del corte
es siempre menos reciente que cualquiera publicada después del corte, que es lo que fue. **A igual
instante —todas las del corte de un mismo dueño lo comparten— desempata la fila más vieja**, por
`listing.created_at`, que el corte conserva del sistema viejo (`V/02` §2.5), **y después el id**: un
orden total, que el aviso de la fila 19 puede escribir como *«vuelven primero las que cargaste hace
más tiempo»*. **Una ficha del corte que el dueño publica por `PB1` pasa a tener su evento** y se
ordena por él, como cualquier otra. *(Con una sola ficha del corte por cuenta, `DEC-MIG-007`, el
desempate entre fichas del corte de un mismo dueño no tiene población; la regla queda, porque no
cuesta nada y el orden sigue siendo total. FASE 5,
simplificación del corte, S-08.)*

**Y va escrito en el aviso, por la misma razón que el de bajada.** `DEC-SUB-008` lo dice y `V/19`
fila 8 lo obliga para el excedente: *«si el cliente no puede leerlo, deja de ser predecible y se
pierde el motivo por el que se eligió»*. El espejo es la **fila 19** de `V/19` §4 y su correo está
en el catálogo del cap. 07 §6 (núcleo). Las que no entran **no se borran** —su reloj se reinicia
igual, §4.2 regla 4 del cap. 02—, pero quedan abajo, y el dueño tiene que poder saber por qué.

**Texto de la fuente — «`ARCHIVED` tiene salida, y son dos porque hay dos maneras de volver»** (`V/03-maquinas-de-estado.md:1010–1145`, sin lo tachado):

*(Revisión del owner, 2026-09-28, C14: la pausa pedida por el dueño ya no archiva, porque
detiene el reloj; `PB4` relee `retenciónDetenida` antes de archivar. El caso de abajo queda como
historia de por qué nacieron las dos salidas, que siguen haciendo falta para toda ficha archivada
por inactividad fuera de una pausa.)*

**El caso que las obliga es una pausa del catálogo.** Alguien toma la pausa más larga que le
vendemos —**4 pausas-mes**, unos 120 días (`B/03` §5)—. La pausa por `CUSTOMER_REQUEST` **no
emite fuente** (`12-contrato…` §2.6), así que `cubierto` pasa a falso, `PB2` baja la ficha, el
día 90 llega antes que el fin de la pausa y `PB4` la archiva. Antes de la 9-bis-3 **ninguna
fila de ninguna tabla del programa tenía `ARCHIVED` en su columna `desde`**, así que por la
regla 1 del cap. 03 §1 (núcleo) volver de ahí no era una operación: era un incidente. Y el reloj
seguía hasta el hard delete del día 180 (cap. 02 §4.1). El sujeto no era una ficha abandonada:
era la de un cliente que no canceló nada.

**`ARCHIVED` tiene además una tercera salida, que no es volver: `PB9`**, el hard delete del día
180, hacia `PURGED`, que es final (FASE 8 completa, `F-8CA2-008`, owner 2026-09-25). Las dos de
vuelta siguen siendo dos. **Y desde la misma pasada tiene dos más, que tampoco son volver**: `PB10`, a `MODERATED` por
un admin, y `PB12`, a `PURGED` por el dueño (FASE 8 completa, `F-8CA2-004`, owner 2026-09-25), o por soporte a su pedido (revisión del owner, casos vecinos, 2026-09-29, caso F-C).

**Son dos filas y no una porque los dos caminos de vuelta no se pueden mezclar:**

| | `PB7` | `PB8` |
|---|---|---|
| quién la dispara | el hecho que el contrato empuja | el dueño |
| hacia dónde | `PUBLISHED` | `DRAFT` |
| desde qué origen | sólo si venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING` | cualquiera |
| para quién existe | el que pausó, el que recontrata, el que regularizó | el que quiere su ficha de vuelta sin pagar todavía, y el borrador que archivó `PB5` |
| con qué la autoriza | su fuente de clase `TÍTULO`, que es la que acaba de volver | **la versión de piso**, *«recuperar lo suyo»* (cap. 02 §2.1) — su población **no tiene ninguna otra** |

> 📌 **Cerrado el 2026-09-25** (FASE 8 completa, `F-8CA2-008`, owner 2026-09-25): el hard delete
> es la fila **`PB9`** y lleva la ficha a **`PURGED`**, un estado final. `PB7` sale de `ARCHIVED` y
> `PB3` de `UNPUBLISHED_BY_BILLING`, así que **ninguna de las dos la toma**; no entra en la cola
> de cuáles vuelven ni **cuenta para el cupo**, y el dato que la guarda pedía es el estado mismo,
> que escribe una transición —`G-R6` no tiene nada que objetar—. **Adónde va** la ficha es a
> `PURGED`, y el dueño ve que existió y que se borró por inactividad (cap. 19 §4 fila 20). Y como
> `PB9` exige `ARCHIVED`, una ficha en `UNPUBLISHED_BY_BILLING` no llega nunca vaciada a `PB3`.
>
> El texto original, como registro: el hard delete del día 180 **no mueve el estado** —le
> borra el contenido y la deja en `ARCHIVED`—, y `PB7` sólo mira el origen. Si el dueño recupera
> la cobertura después del día 180, `PB7` publica una página vacía, y por el criterio de vuelta
> —*«la publicada menos recientemente»*, abajo— la vacía, que suele ser la más vieja, **ocupa el
> cupo antes que las intactas**. El hallazgo propone que la guarda de `PB3`/`PB7` excluya lo
> vaciado, y **no es mecánico**: pide un dato que diga *«el hard delete ya corrió sobre esta
> ficha»* —el hard delete no es una transición, así que una guarda que lo leyera cae bajo `G-R6`
> (`V/20` §2)—, y pide decidir adónde va esa ficha si no vuelve. El núcleo ya lo dice de un solo
> lado: el correo de la reapertura avisa *«que el contenido no vuelve»* (`NUCLEO/07` §6), sin
> decir si la ficha sí.

**`PB7` no puede ignorar el origen, y ésa es toda la razón por la que lo mira.** A `ARCHIVED` se
entra por dos puertas: `PB4`, desde una ficha que estaba a la vista, y `PB5`, desde un
**borrador** que su dueño nunca publicó. Una vuelta automática que no las distinguiera
**publicaría el borrador de alguien que nunca pidió publicarlo** el día que recupera cobertura.
Es exactamente la razón por la que `UNPUBLISHED_BY_BILLING` es un estado distinto de `DRAFT`,
una puerta más adentro.

**Y el origen no necesita ninguna columna nueva: ya está escrito.** El evento de dominio de
`PB4` y el de `PB5` guardan *«los campos que cambiaron, con su valor anterior y el nuevo»*
(cap. 08 §1.2, núcleo) sobre un registro **append-only** (§1.3). Preguntarle al registro de
verticales por un hecho de verticales es el mismo mecanismo que `T7` usaba (salió: N7) y `T8` usa para *«ya ejerció el
evento de activación»* (§2), y por el mismo motivo: el dato existe, es duradero y no hay que
pedírselo a nadie. Una columna denormalizada es libertad de implementación, nunca una segunda
fuente.

**Las dos reinician el reloj, y `PB7` ni siquiera hace falta que dispare para que se reinicie.**
El hecho que reinicia la inactividad es **la cobertura comprobada verdadera** (cap. 01 §1.2,
núcleo, hecho 2) —un estado leído, no un cambio detectado, que es por lo que cualquiera que actúe
sobre el reloj lo puede comprobar en el momento de actuar—, no la transición: si el cupo no alcanza
y la ficha se queda abajo, el reloj se reinicia igual. Atarlo a `PB7` habría dejado el borrado vivo justo para el que vuelve con un plan más
chico.

**Qué queda del caso de la pausa, medido y no estimado.** **El reloj se detiene durante la
pausa pedida por el dueño y la ficha no se archiva** (revisión del owner, 2026-09-28, C14): lo que
sigue de este párrafo sobre el día 90 y `D16` queda como historia. Lo que ya no pasa es lo caro: al
reanudar, `cubierto` vuelve a verdadero, el reloj se reinicia y `PB7` la republica sola; **y si la
pausa termina por otro camino, en una baja, el reloj se reinicia igual** (revisión del owner, casos
vecinos, 2026-09-29, caso 12; `12-contrato…` §4.1), **sin escribir nada: `retenciónDetenida` devuelve también cuándo terminó la última pausa, y los lectores cuentan desde el más tardío entre `listing.inactiva_desde` y ese instante** (revisión del owner, casos vecinos, 2026-09-29, caso F-A; `12-contrato…` §4.1) (**y `PB9`, además, desde `coberturaPerdidaEn`, el más tardío de los tres**: FASE 9 vuelta 3, owner 2026-09-30, lote Q). Entre el
primer día de la pausa y ese reinicio hay **120 días** contra los **180** del borrado, y las
pausas encadenadas no acumulan porque cada reanudación reinicia. Que las dos cifras sigan en ese
orden es `D16` (cap. 04 §3, núcleo), no una cuenta que alguien tenga que rehacer.

**Y la cuenta mide desde el primer día de la pausa porque `PB2` escribe el reloj ese día** (hecho 5
del cap. 01 §1.2, núcleo; FASE 8 completa, `F-8CA2-001`, `F-8CA3-001`, owner 2026-09-25). Hasta
entonces no lo escribía nadie: el reloj guardaba el último reinicio, que la relectura de `PB4` pone
cada 90 días sobre una ficha publicada y cubierta, y con 85 días de antigüedad al pausar la ficha se
archivaba el día 5 de la pausa y se borraba el día 95. **Vale para toda ficha del dueño en esa vertical** (FASE 8 completa, owner
2026-09-25): la que ya estaba abajo —el borrador, la excedente— no pasa por `PB2`, y el mismo
instante se lo escribe el recálculo que el aviso despierta (cap. 01 §1.2, núcleo, hecho 5). **El
aviso perdido tiene red desde `DEC-ARCH-009`**: el reconciliador diario de cobertura (abajo) corre
`PB2` y escribe el hecho 5 hasta un día después, salvo para el dueño
**sin ninguna ficha publicada** (⚠️ del reconciliador, punto 1; FASE 9 completa, `B-1`). Lo
que queda allá es el aviso repetido, que el owner aceptó, no el alcance.

**Tres cosas que estas dos filas NO son, y conviene decirlas porque cada una toca un arreglo de
esta misma tanda:**

1. **`PB7` no es el evento de activación, y no consume ningún trial.** El evento que `T1`
   miran es *«el dueño publica»*, que es `PB1` — un acto suyo. `PB3` ya republicaba sin ser `PB1`
   y `PB7` hace lo mismo un estado más atrás: **restituir no es publicar**. Leerlo al revés le
   quemaría el trial a quien reanuda una pausa. **`PB1` desde `UNPUBLISHED_BY_BILLING` sí es
   publicar**: es un acto del dueño, y por eso es el evento que `T1` mira. Lo que no es publicar
   es que la ficha vuelva sola (FASE 9 vuelta 1, R1). (Sale con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`.)
2. **Ninguna de las dos comparte par con otra fila.** Salen las dos de `ARCHIVED`, pero sus
   eventos son distintos —el cambio de `cubierto` y el acto del dueño—, así que cada par tiene
   **una sola** fila y **`PB7`/`PB8` no agregan ninguno** a los pares con dos destinos, que desde la
   FASE 9-bis-4 fueron cuatro y
   desde la revisión del owner, 2026-09-28, C8, son **tres** (`NUCLEO/03` §1 regla 7: sale `S10`/`S25`), y
    con C10 vuelven a ser **cuatro** (entra `PB11`/`PB13`). Es el mismo caso que
   `T7` (que salió: revisión del owner, 2026-09-28, N7), y está anotado en la regla 7 del cap. 03 §1 (núcleo). **`PB9` tampoco agrega ninguno**:
   sale también de `ARCHIVED`, pero su evento —el día 180 de inactividad— no lo declara ninguna
   otra fila (FASE 8 completa, `F-8CA2-008`).
3. **`PB7` no es una transición de la clase del reloj**, así que no la alcanza la propiedad
   *«nunca otorga»* del cap. 17 §3.4. Las de esa clase en esta máquina son `PB4` , `PB5` y **`PB9`** (FASE 8 completa, `F-8CA2-008`), y las tres **quitan**; a `PB7` la disparan **un cambio de cobertura o un cambio de cupo**, igual que a
   `PB3`. **Ninguno de los dos es el reloj**: los dos son el recálculo del conjunto efectivo de un
   `user + vertical` (cap. 15 §4.2), que lo dispara un acto —el de la persona o el de billing— y
   no el paso del tiempo.

**Y la mitad `PUBLISHED` del `desde` de `PB4` deja de ser letra muerta con el término definido.**
Una ficha publicada y cubierta no acumula inactividad, así que esa mitad sólo alcanza a una ficha
que quedó **publicada sin cobertura** — **una ficha publicada sin
cobertura que el reconciliador diario todavía no bajó** (FASE 9 completa, `C-7`: desde
`DEC-ARCH-009` la cartera del corte la baja la primera corrida del reconciliador, dentro del primer
día, y no `PB4`; desde la revisión del owner, 2026-09-28, C12, la cartera del corte nace publicada
**y cubierta** por su prueba, así que no es de esta mitad). Es la red, y por eso se queda.

**Texto de la fuente — «El reconciliador diario de cobertura: el aviso es rápido, el reconciliador es la red»** (`V/03-maquinas-de-estado.md:1146–1338`, sin lo tachado):

`DEC-ARCH-009` (owner 2026-09-25; FASE 8 completa, racimo `R10`: `F-8CA2-002`, `F-8CC1-005`,
`F-8CA1-007`, `F-8CC1-009`).

**Vive acá y no en el cap. 15 §4, y la razón es qué ejecuta.** Lo que hace es correr `PB2`, `PB3` y
`PB7`, que son filas de esta tabla, y escribir `listing.inactiva_desde` e invalidar el caché, que
son del cap. 02 §2.5 y §3.2. El cap. 15 §4.2 define **el reconciliador de excedentes**, que se
dispara por el recálculo del conjunto efectivo y **sólo** por él; ponerle al lado una pieza que se
dispara por calendario y que hace además la primera rama de las tres transiciones confundiría dos
piezas que el corpus ya nombra *«el reconciliador»* con un solo sentido. Por eso éste lleva nombre
propio —**el reconciliador diario de cobertura**— y lo construye **V6**, la unidad de esta tabla
(`descomposicion.md` §2).

**Qué agujero tapa.** El aviso *«la cobertura de (user, vertical) cambió»* (`12-contrato…` §3) es
lo único que billing le empuja a verticales y no tiene transporte durable. Tres cosas quedaban sin
red: **(1)** si se perdía el aviso de que la cobertura **volvió**, `PB3`/`PB7` no disparaban, `PB4`
releía, encontraba al dueño cubierto y **reiniciaba el reloj sin republicar**, y el dueño no tiene
transición propia para salir de `UNPUBLISHED_BY_BILLING` — `PB1` sale
de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)—: pagaba y
sus fichas no se veían, sin límite (`F-8CA2-002`, `F-8CC1-005`); **(2)** una fuente con `hasta:
fecha` que deja de emitirse porque la fecha pasó **no es una transición**, así que no produce aviso
ni invalida el caché (`F-8CA1-007`, `F-8CC1-009`); **(3)** si se perdía el aviso de la caída, nadie
escribía el hecho 5 del cap. 01 §1.2 (núcleo).

> **Una vez por día, el reconciliador le pregunta al contrato por cada dueño de la población, lo
> compara con el estado de sus fichas y, si no coinciden, corre la transición que el aviso habría
> disparado** —que relee su condición dentro del lock (FASE 9 vuelta 1, `F-8V1A2-008`)—. Tapa los tres agujeros sin importar por qué hay diferencia —aviso perdido, fecha
> vencida o un camino que nadie previó—, porque se apoya en la pregunta y no en un mensaje.

**La población**: todo `user + vertical` con al menos una ficha que **no** esté en `DRAFT` ni en
`PURGED` **ni en `MODERATED`** —o sea, en `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED`—. `DRAFT` queda afuera
porque ninguna transición del sistema lo publica (`PB1` es un acto del dueño); `PURGED`, porque es
final; **`MODERATED`, porque ninguna transición del sistema la saca de ahí —sólo un admin, con
`PB11` o `PB13` (FASE 9 vuelta 3, `F-8V3A2-008`)— y no cuenta para el cupo** (FASE 8 completa, `F-8CA2-004`, owner 2026-09-25).

**Y todo `user + Partner` con una clave de presencia, que no tiene
fichas** (FASE 8 completa, `R13`: `F-8CA1-005`, `F-8CA2-005`, `F-8CA3-006`; owner 2026-09-25).
**Desde la FASE 9 completa las claves de presencia son dos** —la página propia, que otorga Gold, y
el carrusel, que otorgan Gold y Silver (`V/18` §1.6; owner 2026-09-25, decisión 7b)—, y la
población se lee sin la entidad del contenido, que no está declarada (`V/18` §1.6, ⚠️ punto 2):
**todo `user + Partner` cuya entrada del caché otorga alguna de las dos claves, o que tiene en
Partner una fuente de clase `TÍTULO`** (FASE 9 completa, contradicción 3 del informe `08`). La presencia de Partner no tiene
máquina: su lectura pública pregunta por el entitlement **de su superficie** (FASE 9 vuelta 1, `F-8V1A1-004`) desde el caché (`V/18` §1.6),
y la invalidación de esa entrada la llevan el aviso y este reconciliador. Para ese `user + vertical`
**no corre ninguna transición**: resuelve en vivo si el conjunto efectivo otorga
cada una de las dos claves, lo compara con la entrada del caché y, si no coinciden, **la invalida**.
**El bit de moderación de la presencia no es de este reconciliador** (`V/18` §1.6, decisión 7c): lo
escribe un admin y la lectura lo lee en vivo, no desde el caché. Es lo que cubre la fecha que
vence sin transición para quien no tiene fichas, que el punto 2 del ⚠️ de abajo deja afuera para
el resto.

**La pregunta** es la del `12-contrato…` §2.1: `cubierto`, y el cupo que el cap. 15 resuelve sobre
`fuentes`. **Se hace en vivo y nunca contra el caché**: el caché es justamente lo que puede estar
viejo (`F-8CA1-007`).

**Qué compara, y qué corre en cada diferencia:**

| lo que encuentra | qué corre | qué escribe en `listing.inactiva_desde` |
|---|---|---|
| `cubierto` **falso** y al menos una ficha en `PUBLISHED` | **`PB2`, primera rama**, sobre cada ficha publicada | el **hecho 5**: `PB2` sobre la publicada, y el reconciliador sobre las demás fichas del dueño en la vertical, **en el mismo acto** |
| `cubierto` **verdadero**, menos fichas en `PUBLISHED` que el cupo, y candidatas en `UNPUBLISHED_BY_BILLING` o en `ARCHIVED` con el origen que `PB7` exige | **`PB3`** / **`PB7`**, por la rama que corresponda, con el criterio de *«cuáles vuelven»* de arriba | el **hecho 2**, en todas las fichas del dueño en la vertical; la que vuelve a `PUBLISHED` recibe además el **hecho 3**, que es de la propia transición |
| `cubierto` **verdadero** y más fichas en `PUBLISHED` que el cupo | **`PB2`, segunda rama** (el excedente) | **nada**: la cobertura sigue verdadera y esa rama no es ningún hecho (cap. 01 §1.2, núcleo) |
| ninguna de las tres | nada | nada |

Y cuando corre algo, **invalida las entradas del
caché de ese `user`, en todas sus verticales** (cap. 02 §3.2, regla 3: la invalidación es por
`user`; owner 2026-09-25, FASE 9 completa, decisión 8a).

**Es un ejecutor adicional, y la distinción entre hecho y ejecutor es lo que hace que no mueva
nada más.**

- **De las transiciones.** `PB2`, `PB3` y `PB7` no ganan filas ni cambian su evento: el de la
  primera rama de cada una sigue siendo **el cambio** de `cubierto` (el ⚠️ del cap. 01 §1.2,
  núcleo), y la diferencia que el reconciliador encuentra —una ficha publicada sin cobertura, o
  abajo con cobertura y cupo— es **la huella de un cambio que no se entregó**. Así que `G-R4` no
  gana ningún par. **Y no son de la clase del reloj** (cap. 17 §3.4), aunque el reconciliador corra
  por calendario: el calendario decide **cuándo mira**, no cuál es el evento. Las de esa clase son
  las que tienen **al tiempo como evento** —`T3`, `PB4`, `PB5` y `PB9`—, así que `G-R3-B`, que
  lee las tablas, no ve ninguna transición nueva que otorgue. Sobre quién se evalúan los pasos 5–7
  cuando las corre él lo declara el cap. 17 §3.4.
- **De los hechos del reloj.** Escribe el **2** y el **5** del cap. 01 §1.2 (núcleo) y **ningún hecho nuevo**: la lista sigue en **cinco** —el sexto, `PB11`, lo agregó la FASE 9
  completa (decisión 5b), no este reconciliador; el 4 salió con la revisión del owner, 2026-09-28, C8—, más la escritura `C` del corte, y `G-R6-B` mitad *(a)* lo
  admite por la lista. Lo que crece es la cuenta de ejecutores: el **2** pasa a tener **cuatro** y
  el **5**, **tres** (cap. 02 §2.5). **No lee `listing.inactiva_desde`** —compara estados de ficha,
  no el reloj—, así que los **seis** lectores del cap. 02 §2.5 no se mueven, y la mitad *(b)* no
  tiene nada que objetar. `G-R6` tampoco: el reconciliador no es una transición y no agrega ninguna
  condición que lea una columna.
- **De «fila viva»** (`NUCLEO/01` §2.4). No es consumidor: le pregunta al contrato y **nunca lee una
  fila de billing**, que es donde viven todos los consumidores de ese inventario.

**Por qué el hecho 5 se escribe sólo junto con `PB2`, y no cada vez que lee `cubierto` falso.** La
ficha publicada **es** la memoria de que antes había cobertura: `PB2` la encuentra una sola vez, la
baja, y al día siguiente ya no hay diferencia. Sobre una ficha que ya estaba abajo no hay estado
que lo recuerde, y escribir el hecho 5 cada vez que la relectura trae falso **correría el reloj
todos los días**: ninguna ficha de un dueño sin cobertura llegaría nunca al archivado ni al día
180. Es el goteo que el ⚠️ punto 3 del cap. 01 §1.2 (núcleo) acepta que no ocurre porque los
avisos son los de un cambio; con un disparo diario ocurriría, así que la regla de la tabla es la
que lo impide.

**El vigía es el del barrido de billing** (`B/09` §7.1): el mismo monitor de cron externo, con la
misma regla —el reconciliador le hace ping al terminar una corrida completa y el monitor alerta si
pasan 26 h sin ping—. Si el reconciliador no corre, las tres redes se apagan a la vez y en
silencio, que es el mismo modo de falla que ese § le reprocha al barrido. Lo que ese § deja abierto
del vigía —la elección concreta, si el plan contratado lo incluye y por qué canal llega la alerta—
vale igual acá.

**El costo aceptado es de `DEC-ARCH-009`: hasta un día de atraso** en todo lo que el aviso no
cubrió. El instante que escribe es el de la corrida y no el del cambio, así que en el reloj el
atraso cae del lado que **atrasa** el borrado, nunca del que lo adelanta.

> ⚠️ **Lo que el reconciliador NO cierra** (declarado con su causa por `DEC-METH-015`; **ninguno mueve
> plata ni da acceso indebido en el camino principal, y **el único que puede adelantar un borrado es el punto 1, con un aviso
> perdido, y desde el lote Q ni ése alcanza a `PB9`, que cuenta desde `coberturaPerdidaEn`
> (punto 5)** (FASE 9 vuelta 3, owner 2026-09-30, lote Q)**; FASE 9 completa, residuo `α` del informe `06`):
>
> 1. **El dueño sin ninguna ficha en `PUBLISHED` en el momento de la
>    caída no tiene red para el hecho 5** (FASE 9 completa, `B-1` y `α`; declarado por
>    `DEC-METH-015`, FASE 9 completa). Si se pierde el aviso, el reconciliador no encuentra una
>    ficha publicada que delate la diferencia y no escribe el hecho 5 —sólo lo escribe junto con
>    `PB2`, por la razón de arriba—. Alcanza al que sólo tiene borradores, que además está fuera de
>    la población, **y al que tiene todas sus fichas en `UNPUBLISHED_BY_BILLING`, `ARCHIVED` o
>    `MODERATED`**, que está adentro. Su red sigue siendo la relectura de `PB4`, `PB5` y `PB9`
>    sobre el reloj viejo, **y eso puede adelantar el archivado (`PB4` y `PB5`), que no es irreversible; el
>    borrado del día 180 no, porque `PB9` cuenta además desde `coberturaPerdidaEn`, que se guarda
>    con el encolado del aviso y no depende de que llegue** (punto 5; FASE 9 vuelta 3, owner
>    2026-09-30, lote Q; el cuerpo, verificación, VC3-VT-05). **Causa**: la fila compara estados de
>    ficha, y la ficha publicada es la única que
>    guarda la memoria de que hubo cobertura (cap. 01 §1.2, núcleo, ⚠️ punto 3).
> 2.
>    **Una diferencia que no mueve fichas no invalida el caché**, venga de una fecha que vence sin
>    transición o de una transición cuyo aviso se perdió (FASE 9 completa, `β`; declarado por
>    `DEC-METH-015`, FASE 9 completa). Si el dueño no tiene ninguna ficha publicada, o no está en
>    la población, o la persona no tiene fichas, **o el cambio sólo toca capacidades que no son
>    cupo**, el reconciliador no encuentra nada y **no invalida**: la entrada del caché sigue
>    otorgando hasta el próximo evento de la lista del cap. 02 §3.2, hasta que corra el job
>    atascado (`S12`, `S10`, `T3` o el de un addon `DÍAS_FIJOS`) o hasta que venza la red de
>    tiempo. **Causa**: el reconciliador compara estados de ficha, no conjuntos efectivos. Pasa
>    sólo cuando esa primera línea falla (el fin de servicio de una vertical salió con
>    la revisión del owner, 2026-09-28, C8).
>    **La excepción es la presencia de Partner**, que no tiene fichas y sí está en la población desde
>    `R13` (arriba): ahí el reconciliador compara el entitlement y no el estado de fichas.
> 3. **La máquina de trial no la corre.** `DEC-ARCH-009` nombra `PB2`, `PB3` y `PB7`. Si se pierde
>    el aviso de un título que aparece durante el trial **—o, desde `DEC-TRIAL-010`, el del primer
>    pago acreditado de su suscripción, que es el que ahora convierte (`12-contrato…` §3)—**, `T2`
>    no dispara y la persona tiene dos títulos —su plan y el del trial— hasta que `T3` vence el
>    trial; si se pierde durante `TRIAL_EXPIRED`, `T5` no corta la campaña de recuperación. **El
>    reconciliador no se desalinea por `cobrada`**: compara `cubierto` y el cupo contra las fichas,
>    y `cobrada` no mueve ninguno de los dos (`12-contrato…` §2.1). **Y, desde 6c, si se pierde el
>    del primer pago de quien publicó en `PRE_TRIAL` con una suscripción sin cobrar, `T8` no
>    escribe la fila consumida y nadie la escribe después**: si alguna vez publica sin cobertura,
>    `T1` le arranca un trial siendo alguien que ya fue cliente. Necesita un aviso perdido y una
>    segunda publicación sin cobertura, y regala un trial, no cobra (FASE 9 vuelta 1,
>    `F-8V1C1-010`; declarado por `DEC-METH-015`). (Sale con
>    `R15`: revisión del owner, 2026-09-28, C12, `L1-b`.) **Causa**: la misma, que el reconciliador no corre la máquina de trial.
> 4. **No sabe por qué el cupo alcanza.** Si el dueño libera un lugar con `PB6`, al día siguiente
>    encuentra candidatas y cupo y corre `PB3`/`PB7`. Es la letra de la segunda rama de las dos
>    —*«el cupo vuelve a alcanzar sin que `cubierto` cambie»*— y el riesgo de republicar lo que el
>    dueño no quería está aceptado por `DEC-DATA-003` (cap. 15 §4.4).
> 5. **Cerrado por el owner** (FASE 9 vuelta 3, owner
>    2026-09-30, lote Q): `PB9` cuenta el plazo de borrado también desde `coberturaPerdidaEn`, el
>    instante de la última pérdida de cobertura que devuelve `retenciónDetenida` (`12-contrato…`
>    §4.1), que billing guarda en la misma transacción que encola el aviso, así que el aviso
>    atrasado no le adelanta nada; y mientras el dato valga `NINGUNO`, `PB9` no borra en la misma
>    pasada en que ve la ficha vencida y sin cobertura por primera vez (la fila de `PB9`, arriba).
>    El caso que lo pedía: sobre la ficha que no estaba publicada el hecho 5 lo escribe
>    el recálculo que el aviso despierta, que no es una transición. Si `PB9` corre entre el commit
>    de billing y ese recálculo, relee `cubierto` falso con el reloj viejo y borra: una ficha
>    `ARCHIVED` de un dueño cubierto tiene el reloj hasta en 180 días, porque `PB9` lo reinicia al
>    releer, y sus avisos previos no salieron porque estaba cubierto. No hace falta que el aviso
>    se pierda, sólo que se atrase.

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:488, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:655, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:680, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:842, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:931, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1010, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1146

<a id="trans-v-pb2"></a>

### `TRANS:V:PB2` · `PB2` — `PUBLISHED` → `UNPUBLISHED_BY_BILLING`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PUBLISHED`
- **evento** (disparador): **`cubierto` pasa a falso**
- **hacia** (estado destino): `UNPUBLISHED_BY_BILLING`
- **nota** (guardas y efectos): o el excedente tras un downgrade, que no cambia `cubierto` y sí el cupo. **En la primera rama escribe `listing.inactiva_desde` con el instante de la caída** —es el hecho 5 del cap. 01 §1.2 (núcleo), *«la ficha deja de estar publicada porque perdió la cobertura»*—; **en la del excedente no la escribe**, porque la cobertura sigue verdadera (FASE 8 completa, `F-8CA2-001`, `F-8CA3-001`, owner 2026-09-25). **`PB2` es uno de los dos ejecutores del hecho 5, no el único**: el hecho es *«el dueño pierde la cobertura en la vertical»* y alcanza a **todas** sus fichas en ella; a las que no están en `PUBLISHED` —y por eso `PB2` no toca— se lo escribe el recálculo que el mismo aviso despierta, sin transición de esta máquina (owner 2026-09-25). **Toma el mismo lock que `PB1`, en las dos ramas**, **y dentro del lock relee `cubierto` —primera rama— y el cupo —segunda— antes de escribir**: si la relectura ya no da la condición, `PB2` no ocurre (la regla de `B/05` §2, `C1`, igual que `PB1`; FASE 9 vuelta 1, `F-8V1A2-008`), y así la carrera contra `PB1` no deja una ficha publicada sin cobertura (abajo; FASE 8 completa, `F-8CA2-009`, owner 2026-09-25) **Revalida: sí**, sale de `PUBLISHED` (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:489, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="trans-v-pb3"></a>

### `TRANS:V:PB3` · `PB3` — `UNPUBLISHED_BY_BILLING` → `PUBLISHED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `UNPUBLISHED_BY_BILLING`
- **evento** (disparador): **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie**
- **hacia** (estado destino): `PUBLISHED`
- **nota** (guardas y efectos): y el cupo alcanza. **Es una disyunción de dos, simétrica a la de `PB2`** (`DEC-DATA-003`). Ocupa cupo, así que **toma el lock y cuenta adentro**, como `PB1` (abajo). (sale con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`) **Revalida: sí**, llega a `PUBLISHED` (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:490, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="trans-v-pb4"></a>

### `TRANS:V:PB4` · `PB4` — `PUBLISHED` o `UNPUBLISHED_BY_BILLING` → `ARCHIVED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`; `V/descomposicion.md:152`; `V/descomposicion.md:485`
- **Adjudicación** (`adjudicacion.json`): VIVO — reemplazo explícito (C9, C11); lo tachado de la fila se omite y lo vigente va entero.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PUBLISHED` o `UNPUBLISHED_BY_BILLING`
- **evento** (disparador): **el día del plazo de archivado de inactividad (90 al inicio), con la versión de plazos que guarda la ficha** (revisión del owner, 2026-09-28, C9, C11; `NUCLEO/02` §1.5), contado sobre `listing.inactiva_desde` **o sobre el fin de la última pausa que devuelve `retenciónDetenida`, el más tardío** (revisión del owner, casos vecinos, 2026-09-29, caso F-A) (cap. 01 §1.2, núcleo; cap. 02 §2.5)
- **hacia** (estado destino): `ARCHIVED`
- **nota** (guardas y efectos): **relee la cobertura antes de archivar** (ver abajo). **Y relee `retenciónDetenida`** (`12-contrato…` §4.1): con `sí`, que es una pausa pedida por el dueño en esa vertical, no archiva y no escribe nada; el reloj queda detenido (revisión del owner, 2026-09-28, C14, `L1-c`). Sale del sitio público, **el dueño la sigue viendo** y puede exportarla o reactivarla (`DEC-DATA-001`) — y las dos cosas son ejecutables desde que existen `PB7` y `PB8`. **Toma el lock del `user + vertical` y relee adentro su `desde`**, como `PB10`, porque lo comparte con `PB2` y `PB3` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-u`). **Y escribe la fecha de borrado que anuncia**, `listing.borrado_anunciado`: el instante del archivado más la distancia, sobre el reloj de la ficha, entre su fecha de archivado y la de borrado, con la versión de plazos que la ficha guarda (cap. 02 §2.5; revisión del owner, 2026-09-28, C9 y N7) **Revalida: sí cuando sale de `PUBLISHED`**; desde `UNPUBLISHED_BY_BILLING`, no (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:491, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:152, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:485

<a id="trans-v-pb5"></a>

### `TRANS:V:PB5` · `PB5` — `DRAFT` → `ARCHIVED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`; `V/descomposicion.md:152`; `V/descomposicion.md:485`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `DRAFT`
- **evento** (disparador): N meses de **inactividad**, contado sobre `listing.inactiva_desde` **o sobre el fin de la última pausa, el más tardío** (caso F-A) (cap. 01 §1.2, núcleo; cap. 02 §2.5), **con la versión de plazos que guarda la ficha** (el plazo 3 de `NUCLEO/02` §1.5; revisión del owner, 2026-09-28, C9)
- **hacia** (estado destino): `ARCHIVED`
- **nota** (guardas y efectos): `DEC-TRIAL-007`; `N` es configuración, **validada por el panel contra el plazo de borrado de la misma versión, en su peor caso en días** (`NUCLEO/02` §1.5, regla 2; revisión del owner, 2026-09-28, C9; lo que sigue es la historia de la cota de 6 meses) —el día 180 cae así después del archivado; **el espacio entre los dos no está garantizado** (⚠️ de *«la moderación y el borrado del dueño»*, punto 6, y `V/20` §2, `G-R5-B`; FASE 9 completa, `K-5`)—, y lo vigila `G-R5-B` (cap. 20 §2; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25). **Relee la cobertura antes de archivar**, igual que `PB4`. **Y relee `retenciónDetenida`** (`12-contrato…` §4.1): con `sí`, que es una pausa pedida por el dueño en esa vertical, no archiva y no escribe nada; el reloj queda detenido (revisión del owner, 2026-09-28, C14, `L1-c`). **Toma el lock del `user + vertical` y relee adentro su `desde`**, como `PB4`, `PB6`, `PB10` y `PB12`, porque lo comparte con `PB1`, `PB10` y `PB12`: sin lock, `PB5` archiva un borrador que `PB1` acaba de publicar (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-z2`). **Y escribe la fecha de borrado que anuncia, como `PB4`** (revisión del owner, 2026-09-28, C9 y N7) **El proceso de hoy que archiva a los 30 días, sobre `updated_at`, el borrador de alojamiento sin tocar y le revoca a su dueño el rol `HOST`, `archive-abandoned-drafts`, no es esta fila: lo borra `U1`** (FASE 5, owner 2026-09-30, lote 1 G, `F5-SUP-018`; cap. 17 §4.1). **Revalida: no**, `DRAFT` no es público (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:492, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:152, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:485

<a id="trans-v-pb6"></a>

### `TRANS:V:PB6` · `PB6` — `PUBLISHED` → `DRAFT`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PUBLISHED`
- **evento** (disparador): el dueño despublica
- **hacia** (estado destino): `DRAFT`
- **nota** (guardas y efectos): y **no devuelve el trial** (§10.2). **Toma el lock del `user + vertical` y relee adentro su `desde`**, como `PB10`, porque lo comparte con `PB2` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-u`) **Revalida: sí**, sale de `PUBLISHED` (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:493, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="trans-v-pb7"></a>

### `TRANS:V:PB7` · `PB7` — `ARCHIVED` → `PUBLISHED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ARCHIVED`
- **evento** (disparador): **`cubierto` pasa a verdadero**, **o el cupo vuelve a alcanzar sin que `cubierto` cambie**
- **hacia** (estado destino): `PUBLISHED`
- **nota** (guardas y efectos): y el cupo alcanza, **y el evento que la archivó dice que venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`**. Es `PB3` un estado más atrás, **con la misma disyunción y por la misma razón** (ver abajo). Ocupa cupo, así que **toma el lock y cuenta adentro**, como `PB1`, (sale con `R15`: revisión del owner, 2026-09-28, C12, `L1-b`) **Revalida: sí**, llega a `PUBLISHED` (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:494, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="trans-v-pb8"></a>

### `TRANS:V:PB8` · `PB8` — `ARCHIVED` → `DRAFT`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ARCHIVED`
- **evento** (disparador): **el dueño la reactiva**
- **hacia** (estado destino): `DRAFT`
- **nota** (guardas y efectos): desde cualquier origen, incluido el de `PB5`. Es la mitad de `DEC-DATA-001` que se prometía en una nota y no ejecutaba ninguna tabla. **La autoriza la versión de piso**, que otorga *«recuperar lo suyo»* (cap. 02 §2.1): sin eso el paso 6 rechazaba a su única población, la que no paga. **Toma el lock del `user + vertical` y relee adentro que la ficha siga en `ARCHIVED`**, porque comparte `desde` con `PB7` y `PB9` (abajo, *«publicar ocupa cupo bajo un lock»*; FASE 9 vuelta 2, `F-8V2A2-004`) **Revalida: no**, ni `ARCHIVED` ni `DRAFT` son públicos (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:495, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="trans-v-pb9"></a>

### `TRANS:V:PB9` · `PB9` — `ARCHIVED` → **`PURGED`**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V9b](20-fase-1/V9b.md#pieza-v9b) · **también**: [V6](10-corte/V6.md#pieza-v6) (provee), [V4](10-corte/V4.md#pieza-v4) (provee)
- **Fuente de la asignación**: `V/descomposicion.md:73`; `V/descomposicion.md:566`
- **Adjudicación** (`adjudicacion.json`): VIVO — lo tachado (hecho 4, orfandad por borrado) salió con C8 y K-9, anotado en la fila; lo tachado de la fila se omite y lo vigente va entero.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ARCHIVED`
- **evento** (disparador): **el más tardío de dos días: el del plazo de borrado de inactividad (180 al inicio), contado sobre `listing.inactiva_desde` **o sobre el fin de la última pausa, el más tardío** (caso F-A) **o sobre la última pérdida de cobertura, `coberturaPerdidaEn`, el más tardío de los tres** (FASE 9 vuelta 3, owner 2026-09-30, lote Q; `12-contrato…` §4.1), con la versión de plazos que guarda la ficha, y la fecha de borrado que anunció el archivado, `listing.borrado_anunciado`; nunca antes de ésa** (revisión del owner, 2026-09-28, C9, C11 y N7; `NUCLEO/02` §1.5) (cap. 01 §1.2, núcleo; cap. 02 §2.5)
- **hacia** (estado destino): **`PURGED`**
- **nota** (guardas y efectos): **es el hard delete** (cap. 02 §4.1): borra el contenido de esa ficha —textos, fotos, FAQ, horarios— y sus borradores, **y nada más**; nada de la persona (`DEC-DATA-005`). **Las reseñas de terceros se conservan sin mostrarse, y la conexión de calendario se desconecta: su token se revoca en el proveedor y se borra** (cap. 02 §4.1; FASE 9 vuelta 1, owner 2026-09-26, `G1-5`). **Los dos borrados remotos, el de las fotos en el almacenamiento externo y el del token, van después del commit, con las filas marcadas pendientes hasta que se confirman y una corrida diaria que reintenta** (cap. 02 §4.1; FASE 9 vuelta 3, `F-8V3A2-005`). **Exige `ARCHIVED`**: sale sólo de ahí, así que el aviso del archivado salió siempre antes (`F-8CA2-014`). **Relee la cobertura antes de borrar**, igual que `PB4` y `PB5`: si está cubierta, no borra y reinicia el reloj. **Y relee `retenciónDetenida`** (`12-contrato…` §4.1): con `sí`, que es una pausa pedida por el dueño en esa vertical, no borra y no escribe nada; el reloj queda detenido (revisión del owner, 2026-09-28, C14, `L1-c`). **Y con `coberturaPerdidaEn` en `NINGUNO` no borra en la misma pasada en que ve por primera vez la ficha vencida y sin cobertura**: la borra en una pasada siguiente, si sigue vencida, sin cobertura y sin pausa. Que la pasada sea la primera se deriva sin guardar nada: lo es si la fecha de borrado es posterior al arranque de la pasada anterior. Es la regla mientras el dato no exista, y la de la implementación de arranque, que contesta `NINGUNO` (FASE 9 vuelta 3, owner 2026-09-30, lote Q). **Y lo relee todo dentro del lock del `user + vertical`**: el estado, el reloj y la cobertura, porque comparte `desde` con `PB7` y `PB8` y es irreversible (abajo; FASE 9 vuelta 2, `F-8V2A2-004`). (sale con el hecho 4: revisión del owner, 2026-09-28, C8) **Y lo que cuelga de la ficha lo trata la lista cerrada del cap. 02 §4.1**: las alertas de precio se cierran con un aviso al turista, las conversaciones quedan en sólo lectura y lo del dueño que sólo sirve a la ficha se borra (owner 2026-09-27, FASE 9 vuelta 2, `R9`). **`PURGED` es final**: ninguna fila sale de ahí —`PB3` y `PB7` no la toman— y **no cuenta para el cupo**; el dueño ve que la ficha existió y que se borró por inactividad (cap. 19 §4 fila 20). **Es también *«se borra la ficha destino»* de `A6`** (`B/03` §8), igual que `PB12`: desde `K-9` `A6` es la única fila que cancela el addon `LISTING` que apuntaba a ella; la orfandad de `A5` ya no mira el borrado (FASE 9 vuelta 1, `F-8V1A2-002`). **Y el mismo acto, después de su commit y nunca dentro de su transacción, empuja a billing el hecho *«la ficha llegó a `PURGED`»*** (`12-contrato…` §3.1; owner 2026-09-26, `G2-1`; el orden, FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`: `A6` relee `fichaPurgada`, y un empuje anterior al commit la lee `no`) (orquestador, FASE 8 completa, 2026-09-25). FASE 8 completa, `F-8CA2-008`, `F-8CA2-014`, owner 2026-09-25. **Revalida: no**, sale de `ARCHIVED`, que ya no se veía (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:496, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:73, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:566

<a id="trans-v-pb10"></a>

### `TRANS:V:PB10` · `PB10` — `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED` → **`MODERATED`**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`; `V/descomposicion.md:402`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING` o `ARCHIVED`
- **evento** (disparador): **un admin la modera, con motivo**
- **hacia** (estado destino): **`MODERATED`**
- **nota** (guardas y efectos): es una acción administrativa del cap. 08 §3 (núcleo): permiso propio y auditada **con su motivo** (el campo *«por qué»* del cap. 08 §1.2). **Toma el lock del `user + vertical` y relee adentro su `desde`**, porque lo comparte con `PB3` y `PB9` (abajo, *«publicar ocupa cupo bajo un lock»*; FASE 9 vuelta 2, verificación). Sale del sitio público, **no cuenta para el cupo** y **no devuelve el trial** (§10.2; `V/11` §2). FASE 8 completa, `F-8CA2-004`, owner 2026-09-25 **Y guarda de dónde venía** (revisión del owner, 2026-09-28, C10, `L2-i`): su evento registra el estado de origen (y si es `ARCHIVED`, de dónde venía el archivado, que ya guarda el evento de `PB4` o `PB5`), que es lo que `PB11` y `PB13` leen para devolverla. **Si había un pedido de arreglo abierto, sigue abierto**: bajar es subir de nivel, no cambiar de pedido (*«la moderación en dos niveles»*, abajo) **Revalida: sí cuando sale de `PUBLISHED`**; desde los otros tres, no (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:497, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:402

<a id="trans-v-pb11"></a>

### `TRANS:V:PB11` · `PB11` — `MODERATED` → `DRAFT`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`; `V/descomposicion.md:402`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `MODERATED`
- **evento** (disparador): **un admin levanta la baja**: la levanta del todo, o la pasa a sólo pedido de arreglo (revisión del owner, 2026-09-28, C10)
- **hacia** (estado destino): `DRAFT`
- **nota** (guardas y efectos): **la ficha venía de `DRAFT`**, o de un `ARCHIVED` que venía de `DRAFT`, según el evento de `PB10` (revisión del owner, 2026-09-28, C10, `L2-i`: vuelve a donde estaba; **una moderada desde `ARCHIVED` vuelve por el origen de su archivado, no a `ARCHIVED`**, confirmado en la revisión del owner, casos vecinos, 2026-09-29, caso 13). **Si el admin la pasa a sólo pedido de arreglo, el pedido queda abierto; si la levanta del todo, se cierra.** **Ya no es la única salida de `MODERATED`**: la comparte con `PB13`, por la guarda de origen, y con `PB12` (`g3`). Lo que sigue vale para las dos: el dueño no la republica — `PB1` sale de `DRAFT`, y de `UNPUBLISHED_BY_BILLING` sólo si arranca un trial (FASE 9 vuelta 1, R1)— y el sistema tampoco —`PB3` y `PB7` no la tienen en su `desde`—. Es la misma acción administrativa que `PB10`. FASE 8 completa, `F-8CA2-004`, owner 2026-09-25. **Escribe `listing.inactiva_desde` con el instante en que se levanta**: es el **hecho 6** del cap. 01 §1.2 (núcleo), *«se levanta la moderación»* —mientras la ficha estuvo moderada el dueño no podía actuar, y contar esa ausencia lo castigaría por una decisión nuestra (el hecho 4 salió con la revisión del owner, 2026-09-28, C8)— (owner 2026-09-25; FASE 9 completa, decisión 5b, `OW-1`) **Revalida: no**, ni `MODERATED` ni `DRAFT` son públicos (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:498, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:402

<a id="trans-v-pb12"></a>

### `TRANS:V:PB12` · `PB12`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`; `V/descomposicion.md:402`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `DRAFT`, `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED` **o `MODERATED`** (revisión del owner, 2026-09-28, `g3`)
- **evento** (disparador): **el dueño la borra**, **o soporte a su pedido y con motivo**, con la acción administrativa 23 (`NUCLEO/08` §3; revisión del owner, casos vecinos, 2026-09-29, caso F-C)
- **hacia** (estado destino): **`PURGED`**
- **nota** (guardas y efectos): **Sobre una `MODERATED` la borra el dueño y no el admin** (moderar no borra; soporte la borra sólo a pedido del dueño, con la misma fila, caso F-C), y sale un **correo de confirmación** (`NUCLEO/07` §6, *«ficha borrada por su dueño»*) (`g3`), **que sale en todo `PB12`, desde cualquiera de sus estados de salida** (revisión del owner, casos vecinos, 2026-09-29, caso 15), **y cuando la borra soporte lleva una línea más, que dice que fue a pedido del dueño**, sin ser otro correo (revisión del owner, casos vecinos, 2026-09-29, caso H-G). **Toma el lock del `user + vertical` y relee adentro su `desde`**, como `PB10`, porque lo comparte con `PB1`, `PB3`, `PB7`, `PB8` y `PB9`: sin lock, el dueño la borra mientras `PB3` la restituye, y `PB3` escribe `PUBLISHED` sobre una ficha que acaba de pasar a `PURGED` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-u`). **Borra el contenido en el acto** —el mismo que `PB9`: textos, fotos, FAQ, horarios y sus borradores, nada de la persona (`DEC-DATA-005`), con las reseñas de terceros conservadas sin mostrarse y el calendario desconectado y su token revocado y borrado (FASE 9 vuelta 1, owner 2026-09-26, `G1-5`), **los dos borrados remotos después del commit y con reintento, como en `PB9`** (cap. 02 §4.1; FASE 9 vuelta 3, `F-8V3A2-005`), **y el resto de lo que cuelga de la ficha según la lista cerrada del cap. 02 §4.1** (owner 2026-09-27, FASE 9 vuelta 2, `R9`)—; **la fila queda y no vuelve**, porque `PURGED` es final. **No devuelve el trial** (§10.2; invariante 2 del cap. 04, núcleo). Es *«se borra la ficha destino»* de `A6` (`B/03` §8), la única fila que cancela el addon `LISTING` que apuntaba a ella (`K-9`; FASE 9 vuelta 1, `F-8V1C1-013`), **y el mismo acto, después de su commit y nunca dentro de su transacción, empuja a billing el hecho *«la ficha llegó a `PURGED`»*** (`12-contrato…` §3.1; owner 2026-09-26, `G2-1`; el orden, FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`: `A6` relee `fichaPurgada`, y un empuje anterior al commit la lee `no`). FASE 8 completa, `F-8CA2-004`, owner 2026-09-25. **Revalida: sí cuando sale de `PUBLISHED`**; desde los otros cuatro, no (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:499, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:402

<a id="trans-v-pb13"></a>

### `TRANS:V:PB13` · `PB13` — `MODERATED` → `UNPUBLISHED_BY_BILLING`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`; `V/descomposicion.md:487`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `MODERATED`
- **evento** (disparador): **un admin levanta la baja**: la levanta del todo, o la pasa a sólo pedido de arreglo
- **hacia** (estado destino): `UNPUBLISHED_BY_BILLING`
- **nota** (guardas y efectos): **la ficha venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`**, o de un `ARCHIVED` que venía de alguno de los dos, según el evento de `PB10` (revisión del owner, 2026-09-28, C10, `L2-i`, owner: *«vuelve a donde estaba: publicada si hay cobertura y cupo»*). **Toma el lock del `user + vertical` y, adentro, evalúa `PB3`**: **la ficha entra a la misma cola ordenada que `PB3` y `PB7`, junto con las publicadas del dueño en la vertical** (abajo, *«cuáles vuelven»*; FASE 9 vuelta 3, owner 2026-09-30, lote O, `F-8V3A2-003`). Si el dueño está cubierto y en esa cola le toca un lugar dentro del cupo, termina `PUBLISHED` por `PB3` en el mismo acto, **y si el cupo ya estaba lleno, la publicada que queda fuera vuelve a esperar por la rama del excedente de `PB2`**, en el mismo acto y bajo el mismo lock, sin escribir el reloj; si no le toca, queda `UNPUBLISHED_BY_BILLING` y vuelve sola por `PB3` cuando la cobertura o el cupo vuelvan. **No inventa un camino de publicación**: reusa `PB3` y `PB2`. Escribe el **hecho 6**, igual que `PB11`. El pedido de arreglo, como en `PB11`. **No es el evento de activación** (restituir no es publicar) y no devuelve el trial. **Revalida: no por sí misma**; si en el mismo acto la ficha termina `PUBLISHED` por `PB3`, o una publicada sale por el excedente de `PB2`, revalidan esas filas (FASE 5, lote 3 A)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:500, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:487

## Postulación de Partner (`V/03` §11)

### Postulación de Partner (`V/03` §11) — «11. Postulación de Partner»

Texto de `V/03-maquinas-de-estado.md:1352–1377`, sin lo tachado:

**Es la novena**, agregada al escribir el capítulo 18 (ver la nota del cap. 01 (núcleo) §2.2). Chica, sin
ciclos y sin vuelta atrás.

**Ninguna transición la dispara el tiempo.** Una `PENDIENTE` que nadie resuelve **no vence**: se
marca atrasada en el panel del §48, porque vencerla sería un rechazo silencioso y el §17.3 exige
que el rechazo se comunique. Una `APROBADA` que nadie reclama tampoco vence, y es inofensiva: la
suscripción es el último de los nueve pasos del §17.3, así que no publica nada y no se le cobra
nada.

**Reclamar no es una transición de esta máquina**: es el acto que vincula el Partner a un usuario
(cap. 18 §2.4) **—el de la sesión que reclama (owner 2026-09-27, FASE 9 vuelta 2, `R7`)—**, y la
postulación sigue `APROBADA`. **Anular la espera tampoco es una transición**: la `RECHAZADA` sigue
`RECHAZADA`, y lo que cambia es la guarda que `PP1` lee (cap. 02 §2.7). El panel lee *«aprobada sin reclamar»* como
`APROBADA` sin ese vínculo: un dato, no un estado. Dónde vive el vínculo lo declara `V/02` **§2.7: es `partner.owner_user_id`, nulo hasta el reclamo, y
la postulación `APROBADA` apunta a su Partner por `partner_id`** (FASE 9 vuelta 1, `F-8V1A2-005`;
la sección se escribió en la misma vuelta, porque la delegación no tenía texto del otro lado).

## Postulación de Partner (`V/03` §11) — las transiciones

<a id="trans-v-pp1"></a>

### `TRANS:V:PP1` · `PP1` — — → `PENDIENTE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V7](20-fase-4/V7.md#pieza-v7) · **también**: [V6](10-corte/V6.md#pieza-v6) (provee), [V5](10-corte/V5.md#pieza-v5) (provee)
- **Fuente de la asignación**: `V/descomposicion.md:67`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): —
- **evento** (disparador): alguien completa el formulario del §17.3
- **hacia** (estado destino): `PENDIENTE`
- **nota** (guardas y efectos): sólo el camino A; el camino B no crea postulación. **«Alguien» puede no tener cuenta**: `PP1` es la segunda excepción del guest en el paso 1 de la cadena, acotada a esta escritura y con captcha (cap. 17 §1.2; FASE 9 vuelta 3, owner 2026-09-30, lotes I y M, `F-8V3A1-005`). **Y sólo si no hay otra postulación `PENDIENTE` del mismo correo, ni una `RECHAZADA` del mismo correo dentro de la espera configurable** (FASE 9 vuelta 1, `F-8V1A2-005`) **que el admin no haya anulado. La guarda es una restricción de la base, no un chequeo**: dos envíos simultáneos no pasan los dos (cap. 02 §2.7, cap. 18 §2.2; owner 2026-09-27, FASE 9 vuelta 2, `R7`)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1359, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:67

<a id="trans-v-pp2"></a>

### `TRANS:V:PP2` · `PP2` — `PENDIENTE` → `APROBADA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V7](20-fase-4/V7.md#pieza-v7)
- **Fuente de la asignación**: `V/descomposicion.md:67`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDIENTE`
- **evento** (disparador): el admin aprueba
- **hacia** (estado destino): `APROBADA`
- **nota** (guardas y efectos): **no vincula nada todavía**: si el correo ya es de un usuario, se le manda a **esa** dirección un aviso para reclamarlo (cap. 18 §2.4)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1360, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:67

<a id="trans-v-pp3"></a>

### `TRANS:V:PP3` · `PP3` — `PENDIENTE` → `RECHAZADA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V7](20-fase-4/V7.md#pieza-v7)
- **Fuente de la asignación**: `V/descomposicion.md:67`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDIENTE`
- **evento** (disparador): el admin rechaza
- **hacia** (estado destino): `RECHAZADA`
- **nota** (guardas y efectos): **se comunica** (§17.3); la espera la mira `PP1` (FASE 9 vuelta 1, `F-8V1A2-005`)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/03-maquinas-de-estado.md:1361, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:67

## Suscripción (`B/03` §3.2)

### Suscripción (`B/03` §3.2) — «3.2 Las transiciones»

Texto de `B/03-maquinas-de-estado.md:141–213`, sin lo tachado:

Las filas de esta tabla que cambian lo que la fila emite (`12-contrato…` §2.6) emiten el aviso del
§3 del contrato **después del commit de su escritura, y nunca dentro de su
transacción** (FASE 9 vuelta 2, `F-8V2C1-002`: emitido adentro, el consumidor relee el estado
viejo y el aviso se consume sin efecto); el censo de emisores está allá (*«quién emite»*) y no se
copia acá (FASE 9 vuelta 1, `F-8V1C1-006`).

**Toda llegada a un estado terminal cierra la fila de alcance de una migración** (verificación corta, 2026-09-29, lote M-A). Cuando una suscripción con su fila de alcance en `PENDIENTE` **o en `PARA_RESOLVER`** (`B/02` §2.2; la segunda, verificación corta, 2026-09-29, lote N-E) llega a `CANCELLED`, `ABANDONED` o `CHARGE_DECLINED`, por cualquier camino (una transición de esta tabla, el espejo de una baja del proveedor o de la que da el pagador desde Mercado Pago, §10.1, o `S17` cuando muere la predecesora de una sucesión), **la misma transacción pasa esa fila a `FUERA`, con el motivo *«terminó»***. Es una regla y un lugar, no una línea en cada fila. `FUERA` tenía dos motivos, los que elige el cliente (*«cambió de plan»* y *«se dio de baja»*, `B/10` §3.7 punto 8), y ninguna transición lo escribía: una fila que terminaba por la baja del proveedor, por `S13`, por `S12` después de un `CANCEL_SCHEDULED` de `S7`, por un alta que no autorizó o por la sucesión de un pagador con tarjeta suspendido seguía `PENDIENTE`, y le seguían llegando los correos de la migración, que leen `PENDIENTE` (`NUCLEO/07` §6). **Alcanza a `PENDIENTE` y a `PARA_RESOLVER`**: una `APLICADA` queda como está (la sucesión del `B/10` §3.7 punto 7). **Una `PARA_RESOLVER` cuya suscripción termina sale igual a `FUERA` con *«terminó»*** (`B/10` §3.7 punto 5; verificación corta, 2026-09-29, lote N-E).

**La muerte de la predecesora y el cierre de la sucesión son DOS actos, y por eso son dos
filas.** `S17` mata a la predecesora; `S18` cierra la sucesión. Escribirlos como uno solo es lo
que rompía el candado, porque ataba el cierre —que siempre tiene que ocurrir— a una precondición
que la predecesora puede dejar de cumplir **sola**, y a una llamada al proveedor que puede
fallar.

`D7` declara obligatorio cancelar la vieja al recibir el webhook de que la nueva quedó
autorizada, y **ninguna fila de esta tabla lo ejecutaba** — así que, por la regla 1 del núcleo, el
acto normal del mecanismo más caro del sistema terminaba **en un incidente y una fila sin
cancelar**, con dos preapprovals vivos cobrando. Eso lo cierra `S17`.

**Y `sucede_a` no se limpiaba nunca**, que es la otra mitad y produce dos daños opuestos:

| qué quedaba | qué pasaba |
|---|---|
| el candado `A` **vacío** —ninguna fila viva con `sucede_a IS NULL`— | todo cliente que alguna vez cambió de plan quedaba **permanentemente fuera del §11**: un alta nueva entraba sin que nada la rechazara, y `EX-6` mide que el proveedor no frena la segunda |
| el candado `B` **consumido** —la sucesora viva lo ocupa para siempre— | **nadie podía cambiar de plan dos veces** en la vida de la relación |

Los dos los cierra `S18`: **terminada la sucesión, la sucesora vuelve a ser un origen**. `A` vuelve
a estar ocupado y `B` vuelve a estar libre, que es el estado en el que la persona estaba antes de
empezar.

## Suscripción (`B/03` §3.2) — las transiciones

<a id="trans-b-s1"></a>

### `TRANS:B:S1` · `S1` — *(sin fila)* → `PENDING_AUTHORIZATION`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:837`
- **Adjudicación** (`adjudicacion.json`): VIVO — la guarda `admiteAltas` está tachada y anotada; lo tachado de la fila se omite y lo vigente va entero.
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S1](10-corte/B3.md#tpz-s1) → [B3](10-corte/B3.md#pieza-b3) — nota de la fuente: «la rama de sucesión, sin ruta hasta `B8b` (Z): `B3` la escribe entera y `B8b` agrega la ruta (BL)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): la persona elige un plan
- **hacia** (estado destino): `PENDING_AUTHORIZATION`
- **condición** (guardas): (La guarda `admiteAltas` salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan.) **La versión elegida es vigente y vendible** —`políticaDePlan(versión).vigente` y `.vendible`, contrato §4.1—, para el alta nueva Y para la sucesión: la pricing sólo muestra lo vendible (`B/19` §2), pero un link guardado al checkout de un plan retirado llegaba igual, y la persona ve *«este plan ya no está a la venta»* con los vigentes al lado (FASE 9 vuelta 1, `N-G4V-07`: la gemela de `admiteAltas`, que tenía superficie y guarda; ésta tenía sólo superficie; `admiteAltas` salió, ésta queda). **Y** no hay otro **origen** vivo para ese `user + vertical`, **o la fila declara una sucesión** (`sucede_a`). **Y si declara una sucesión sobre una predecesora `ACTIVE` de pagador con tarjeta, el preapproval de la predecesora se relee por id antes de aceptar el cambio y tiene que estar `authorized`**: si no lo está —p. ej. `paused` por una mora cuyo webhook no nos llegó—, **el cambio no se ofrece** (*«tu último cobro no entró, actualizá tu tarjeta»*, el camino de `DEC-SUB-021`; `B/19` §4 fila 17-ter) **y la relectura corre la transición que corresponda por la tabla del §10.1** —sobre `paused`, `S6` por su segundo evento— (FASE 8 completa, owner 2026-09-25). **Las otras dos predecesoras admitidas no pasan por esta relectura**: la `CANCEL_SCHEDULED` tiene el preapproval ya cancelado por `S11`, y la `SUSPENDED` de tarjeta tiene su propia relectura, que exige `cancelled` (`G-R1-A`, `B/20` §2). **Y no hay, para ese `user + vertical`, una fila `CHARGE_DECLINED` cuyo preapproval no se haya releído `cancelled`.** Si la hay, `S1` lo relee por id en el acto: si lo ve `cancelled`, sigue; si no, corre la cancelación con la regla de relectura de `S17` y el correo antes, y **el alta no se admite en esta llamada** (*«estamos cerrando tu intento anterior; probá de nuevo en unos minutos»*). Sin esto el alta nueva convivía con un preapproval que el proveedor podía seguir reciclando, y `GR-1` midió que actualizar el medio de pago lo cobra en minutos (FASE 9 vuelta 1, `F-8V1B1-003`). **Y, si compra Turista VIP, el `user` no tiene un plan vigente que lo herede** (`DEC-ENT-003`; corte del MVP, owner 2026-10-01, BJ: el código de error del rechazo queda abierto; residuo corregido el 2026-10-02)
- **efectos** (efectos): se acuña y **persiste** la clave de idempotencia **antes** de llamar al proveedor (`DEC-CONC-001`); si declara sucesión, **nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización** (`B/12` §5.2). **Y si es de pagador manual, acá se abre su PRIMERA cuota** —la cláusula *(b)* de `MP5` (§7)—, que es el espejo del primer cobro que en un pagador con tarjeta ocurre antes de `S2`: tiene que estar registrada para que la fila llegue a `ACTIVE`, así que abrirla es parte del alta y no del reloj

**Texto de la fuente — «3. Suscripción»** (`B/03-maquinas-de-estado.md:21–45`, sin lo tachado):

**Alcance**: la principal es **un compromiso** por `user + vertical` (§11) — hasta **dos filas**
durante la ventana de una sucesión, un origen y su única sucesora (cap. 02 §2.2). Las de
complemento —una por addon recurrente, `DEC-ADDON-002`— usan **esta misma máquina**, sin tope
propio.

> **Usar la misma máquina no es entrar en el mismo dominio.** Una transición cuyo `desde` se
> escribe como un **conjunto de filas** —y en esta tabla hay **cinco**: `S13`, `S20`, **`S21`**,
> (decía «cinco» y omitía `S21`;
> recontado el 2026-09-25, FASE 8 completa, `F-8CD1-016`), **y `S32` y `S33`, la pausa y la
> reanudación de los complementos junto con su principal** (owner 2026-09-25; FASE 9 completa, 4a;
> recontado sobre la tabla; las tres de la discontinuación salieron con la revisión del owner,
> 2026-09-28, C8)— tiene que decir si alcanza también a las de
> complemento, porque son filas de `subscription` como cualquier otra y **entran por pertenencia
> sin que nadie lo decida**. **Las cinco lo contestan, y no las cinco igual**: `S13` dice
> **«principal»** y no las alcanza; `S20`, `S21`, **`S32` y `S33`** dicen **«de complemento»** y **sólo** las alcanzan. Que `S13` y `S20` sean dos filas y
> no un `desde` ampliado es deliberado: `S13` cancela **sin evaluar condición**, y `S20` **evalúa
> una** —compatibilidad y el flag— que es lo que el §41 exige para no cancelar a ciegas. Toda transición futura que se escriba sobre un conjunto tiene que contestar lo
> mismo.

**Texto de la fuente — «3.1 Los nueve estados»** (`B/03-maquinas-de-estado.md:46–140`, sin lo tachado):

| estado | qué significa |
|---|---|
| *(sin fila)* | **el estado inicial es la ausencia de fila.** El §14 dice que el estado base no requiere suscripción real, así que no se crea una fila para representar «no tiene» |
| `PENDING_AUTHORIZATION` | creada de nuestro lado, esperando que la persona autorice en el checkout del proveedor |
| `ABANDONED` | nunca se autorizó y se agotó su ventana |
| `ACTIVE` | vigente y al día |
| `GRACE_PERIOD` | un cobro falló y corre el reloj del §20 |
| `PAUSED` | detenida, **con motivo obligatorio** |
| `SUSPENDED` | el grace se agotó sin pago (§20, §21) |
| `CANCEL_SCHEDULED` | **con la baja pedida y mandada al proveedor, que la confirma recién cuando la relectura lo ve `cancelled`** (hasta 3 días de reintento, §3.2, *«el correo antes de cancelar»*; por eso `puedeCobrarle` no la excluye por el estado sino por esa confirmación: FASE 9 vuelta 3, owner 2026-09-30, lote D), con servicio sostenido hasta el fin del período pagado |
| `CANCELLED` | terminada |
| `CHARGE_DECLINED` | autorizó y **el primer cobro de esa autorización** se rechazó. **Terminal**: **`S16` la canceló al leer el primer cobro rechazado —de nuestro lado, o ya lo había hecho el proveedor—** (FASE 9 completa, C-R12-2) |

**`CHARGE_DECLINED` entra y `RECONCILIATION_REQUIRED` sale, así que siguen siendo nueve.**

**Y su condición es POR AUTORIZACIÓN, no por la historia de la persona.** Decía *«ningún pago
acreditado antes para ese `user + vertical`»*, mirando toda la vida del cliente — pero **el
proveedor cancela por el primer cobro DE ESE preapproval**, no por la historia. Con la condición
histórica, al cliente que ya pagó alguna vez, vuelve y le rebota la tarjeta se le daba
`GRACE_PERIOD` con **diez días de servicio completo sobre una autorización que el proveedor ya
canceló de forma terminal**: un plazo que **no puede terminar en pago**, y un aviso que le pide
regularizar algo que no tiene con qué. Leída por autorización, cae donde corresponde y su reintento
es un alta nueva — **con la salvedad del §3.3.1**: si esa fila era la predecesora de una sucesión,
el reintento no es un alta nueva sino el checkout que ya tiene abierto, porque la sucesora pasa a
ocupar el candado `A` y la base rechaza la segunda.

> *Nota (FASE 9 completa, C-R12-2)*: la premisa *«el proveedor ya canceló de forma terminal»* de este
> párrafo está medida sólo ante el antifraude (`PA-6`, `UNKNOWN`). La conclusión sigue en pie por
> otro camino: `S16` cancela el preapproval **de nuestro lado** (§3.2), así que la autorización
> queda terminal pase lo que pase con el proveedor. **Y desde la decisión 3c (owner 2026-09-25) hay
> una excepción a la lectura «por autorización»**: la sucesora cuya predecesora venía pagando va a
> `S4` y no a `S16` (fila `S4` del §3.2).

**Por qué entra.** `B/12` §4.4, medido en producción el 2026-09-17, encontró que ante un primer
cobro rechazado el proveedor **cancela la suscripción en el mismo instante** en que manda la cuota
a `recycling` —los dos hechos comparten el milisegundo— y que esa cancelación es **terminal**:
`PUT {status:"authorized"}` devuelve `400 "Invalid transition from cancelled to authorized"`. Ese
mismo § declaró el residuo y no lo resolvió: *«`ABANDONED` dice "nadie autorizó dentro de su ventana"; esto es
"intentó y lo rechazaron". Le decimos cosas distintas al cliente en cada caso, así que no pueden
compartir nombre»*. **Acá se cierra**, y no por prolijidad: es ese residuo el que rompía el
candado. Mandar el alta que nunca cobró a `SUSPENDED` hacía que `SUSPENDED` significara **dos
muertes distintas**, y bloqueaba el reintento que `B/12` §4.4 exige.

Con `CHARGE_DECLINED` afuera, **`SUSPENDED` vuelve a significar una sola cosa** —alguien que pagó
alguna vez y dejó de pagar, que es la política de retención del §20— y ahí bloquear **es lo
correcto**:
**sobre un pagador manual una segunda suscripción serían dos cobros; sobre uno con tarjeta el
preapproval ya está cancelado y verificado (`DEC-SUB-019`, fila `S6`)** (FASE 9 completa, C6). Sus
salidas no son el candado: son pagar (`S7`), que el proveedor la dé de baja y la espejemos (`B/12`
§1.4), **o que la cancele una persona (`S23`, §3.2)** — **y, sobre un pagador con tarjeta, la sucesión desde
`SUSPENDED` (`G-R1-A`, `B/20` §2), que es su vuelta normal: cuatro**. (La
discontinuación, `S27`, salió con la revisión del owner, 2026-09-28, C8.)

> **Las tres primeras son ejecutables, y la tercera recién desde que tiene fila.** Hasta `S23` la baja de
> la tabla salía sólo de `ACTIVE`, así que esta enumeración prometía una salida que la máquina no
> declaraba — y sobre un **pagador manual** era la única de las tres que podía existir, porque no
> hay preapproval que el proveedor dé de baja por mora (`B/06` §7) y el espejo del §10.1 no lo
> alcanza. El resultado era una fila encerrada para siempre, con el candado `A` ocupado.

**Por qué sale `RECONCILIATION_REQUIRED`.** Lo que describe no es una situación de la suscripción:
es una situación **nuestra** —*«el sistema no puede decidir solo (§22.1)»*—, y escribirla en la
columna de estado **pisa el estado real de la fila**. Eso producía tres cosas, y las tres eran
defectos vivos: el estado anterior se perdía y `S15` tenía que adivinarlo; convertir una `ACTIVE`
en `RECONCILIATION_REQUIRED` es **textualmente una decisión destructiva automática**, que el mismo
§22.1 prohíbe; y el candado dejaba de ver una autorización que seguía viva.

> **`requiere_conciliación` es una marca sobre la fila, no un estado.** La fila conserva
> el estado que tenía, y sigue cubriendo a quien estaba cubierto (`B/02` §2.2) — **salvo la
> predecesora de una sucesión cuya sucesora ya está `ACTIVE`**: ésa deja de emitir fuente aunque
> su cancelación haya fallado y siga marcada (`12-contrato…` §2.6, rama posterior a la autorización;
> owner 2026-09-25).
>
> **Y la marca no es un booleano: es una fila con MOTIVO y con RELOJ** (`reconciliation_mark`,
> `B/02` §2.2 y §2.5). Este corpus escribe **veinticuatro** marcas distintas sobre la misma casilla (el 23, `ORDEN_PAGADA_SIN_INSTANCIA`, desde la FASE 9 vuelta 2, `R4`; el 24, `IMPORTE_COBRADO_DE_MÁS`, desde la misma vuelta, `R20`)
> (el 16 desde `F-8CB1-013`; el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`,
> FASE 8 completa, owner 2026-09-25; el 20, `COBRO_DUPLICADO`, desde la pendiente 6; el 21,
> `COBRO_DEL_PERÍODO_SIN_RESOLVER`, y el 22, `PAUSA_NO_APLICADA`, desde la FASE 9 completa —3d,
> owner 2026-09-25, y `F-8CB2-003`—) y
> **nueve de ellas significan *«hay plata del cliente que devolver»***; sin el motivo llegaban
> todas iguales al listado accionable de `B/19` §6. `requiere_conciliación` pasa a nombrar el
> **predicado** —*«la fila tiene al menos una marca abierta»*, `NUCLEO/01` §2.5—, así que cada
> frase de este capítulo que dice *«se pone la marca `requiere_conciliación`»* sigue diciendo lo
> mismo y ahora dice además **con qué motivo**.

Y una nota de registro que sigue valiendo:

> `ABANDONED` no estaba en el capítulo 01 (núcleo) y se agrega acá: `M-SUB-01` exige nombrar la ventana
> del preapproval sin autorizar **con su duración máxima y su limpieza**, y sin un estado de
> salida esa ventana no vence nunca. El capítulo 01 (núcleo) queda corregido en el mismo commit.

**Texto de la fuente — «El correo antes de cancelar: una condición de toda fila que cancela en el proveedor»** (`B/03-maquinas-de-estado.md:285–376`, sin lo tachado):

**Antes de toda cancelación que ejecutamos en el proveedor, nuestro correo tiene que salir**
(`DEC-MAIL-001` punto 1, precisado el 2026-09-25; FASE 8 completa, `F-8CB2-001`, `F-8CD1-006`).
Es el correo *«antes de cancelar»* del catálogo de `NUCLEO/07` §6, y tiene tres ramas (la tercera, owner 2026-09-25; FASE 9 completa, decisión 1):

- **si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta**
  — **y quién reintenta depende de la fila** (FASE 8 completa, `F-8CB1-013`, owner 2026-09-25):
  en las filas que llegan a su estado terminal *«pase lo que pase con la llamada»* —las
  **once** de la salvedad 4 de `B/09` §3 (`S12`, `S3`, `S13`, **`S16`**, `S20`, `S22`, `S23`, `S24`, **`S31`**, **`S36`** y **la lápida de recepción** (la del corte salió: FASE 5, simplificación del corte, S-40 y S-70) —la de recepción la cancela el handler que la escribe, owner 2026-09-26, `X-1`—; **`S36`** desde la FASE 9 vuelta 1, residuo 2 de `17-`; `S31` desde la FASE 8 completa, owner 2026-09-25; **`S16`** desde la
  FASE 8 completa, owner 2026-09-25, residuo A de `R12`; `S25`, `S27` y `S28` salieron con la revisión del owner, 2026-09-28, C8) y, por la salvedad 1, la cancelación de `A3`/`A5`/`A6` (**`A3`** desde la FASE 9 completa, C-R5-2) sobre la suscripción de
  complemento de `S21`— **reintenta el barrido** (`B/09` §3), con este mismo correo antes —**el
  que ya salió no se repite**: precisión 3, abajo— y la relectura después, **hasta 3 días después de la transición que decidió la cancelación**
  (tiempo, no corridas: owner 2026-09-25); recién ahí abre la marca con motivo `CANCELACIÓN_SIN_CONFIRMAR` (`B/02`
  §2.5) y avisa por `DEC-OBS-001`. **Abierta la marca, el barrido deja de reintentar**: el caso
  pasa a ser de una persona (owner 2026-09-25; FASE 8 completa, `F-8CB1-013`). En `S6` y `S17` la
  fila no llega a terminal y reintenta la propia transición (precisión 2, abajo). **En `S11` la fila queda en `CANCEL_SCHEDULED`, viva**, **y entra en
  la misma regla de reintento, sin esperar a `S12`**: el barrido la reintenta ya en
  `CANCEL_SCHEDULED`, por el par `authorized`/`paused`/`pending` × `CANCEL_SCHEDULED` del §10.1
  (owner 2026-09-25; FASE 8 completa, `F-8CB1-013`);
- **si no hay destinatario** —rebote duro o cuenta borrada, que `NUCLEO/07` §4.2 suprime para
  siempre, incluso lo transaccional—, **el correo no bloquea**: se cancela igual, y el
  no-entregable se registra y se escala a una persona, como ya manda ese §. Sin esta rama, la
  predecesora de un cambio de plan de alguien con un rebote duro no se cancelaba nunca y
  **cobraban las dos**. **Es también el caso de la lápida de recepción**, cuyo preapproval cancela
  el handler al escribirla (`B/09` §2.4; owner 2026-09-26, `X-1`): no nombra ninguna fila, así que
  por lo general no hay destinatario conocido, y el correo no la frena;
- **si agota sus reintentos** —el `failed` definitivo de `NUCLEO/07` §1, sin ser una supresión—,
  **tampoco bloquea: se cancela igual y se escala como no-entregable, igual que sin
  destinatario** (owner 2026-09-25; FASE 9 completa, decisión 1, §R5.5.1 de `04`; precisa
  `DEC-MAIL-001`). Un `failed` es, por definición del outbox, una falla que no pasó, y la razón de
  la rama transitoria —*«el reintento supone una falla que pasa»*— no le alcanza. Sin esta rama,
  `S17` no ocurría nunca y **cobraban las dos**, y `S6` dejaba al moroso en `GRACE_PERIOD` con
  servicio entero sin límite; en las filas que reintenta el barrido el caso se acotaba a 3 días
  por la marca 16, y ahora sale antes.

La regla vivía sólo en la decisión y ninguna transición la nombraba. Por eso la llevan escrita,
remitiendo acá, **las filas que cancelan en el proveedor**: **`S1`**, `S3`, `S6`, `S11`, `S13`, **`S16`**, `S17`,
`S20`, `S22`, `S23`, `S24`, **`S31`** **y `S36`** (FASE 8 completa, pendiente 8,
owner 2026-09-25; **`S16`**, FASE 8 completa, owner 2026-09-25; **`S1`** —la cancelación de la
`CHARGE_DECLINED` sin confirmar, `F-8V1B1-003`— y **`S36`**, FASE 9 vuelta 1, §4 punto 5 de
`25-verificado-G5`) — **trece**, recontadas con script sobre las filas de la
tabla que remiten a esta regla (revisión del owner, 2026-09-28, C8: salen `S25`–`S28`)—, y **`A3`, `A5` y `A6`** del §8 (**`A3`** desde la FASE 9 completa, C-R5-2: `B/09` §3 ya lo contaba entre los que cancelan y ninguna fila lo escribía). **`S31` está en el primero de los
dos grupos de la rama transitoria de arriba**: es una de las **doce** que reintenta el barrido (FASE 8
completa, owner 2026-09-25; **`S16`** es la decimotercera, owner 2026-09-25). **No la llevan las
que sólo espejan una cancelación que hizo el proveedor** — el espejo del §10.1; **`S16`
dejó de ser una de ellas**: cancela de nuestro lado (FASE 8 completa, owner 2026-09-25)—, **ni
`S12`**, que no manda nada porque la llamada fue la de `S11`, **ni `S21`**, cuya llamada es la de
`A5` o `A6`.

**Tres precisiones**: las dos
primeras salen de la tabla y no agregan política; la tercera la decidió el owner el 2026-09-25
(FASE 8 completa, `F-8CB1-013`):

1. **Bloquea la LLAMADA, no la relectura.** Las filas cancelan con la regla de relectura de
   `S17`: si la relectura ya ve el preapproval `cancelled` no se manda nada, y entonces no hay
   cancelación nuestra que el correo tenga que preceder. **Sobre un pagador manual tampoco**: no
   hay preapproval ni débito que detener (`B/06` §7), así que **en toda fila** la condición corre sólo sobre el pagador
   con tarjeta (FASE 9 completa, C-R5-4: la lista nombraba siete y un pagador manual también puede
   estar en `S11`, `S13`, `S17` o `S22`; las dos últimas salieron con la revisión del owner, 2026-09-28, C8).
2. **Donde la fila ya declara qué pasa si la cancelación no se ejecuta, el correo fallido entra
   por esa misma puerta**: en `S6` la fila no pasa a `SUSPENDED` en esta corrida y sigue donde
   estaba; en `S17` la predecesora no llega a `CANCELLED` en esta corrida (`B/09` §3: *«si falla,
   `S17` no ocurre»*) y su condición, que es sobre un estado, se vuelve a evaluar.
3. **El correo sale UNA vez por cancelación, antes del primer intento**, y los reintentos no lo
   repiten si ya se entregó. La ocurrencia de la clave de `NUCLEO/07` §2 es la de un correo de
   evento —*«el id del evento de dominio que lo causó»*—, y ese evento es **la transición que
   decidió la cancelación**, no la corrida que la reintenta: por eso un reintento no encola una
   fila nueva sino que **mira la que ya existe**. Si está `sent`, la llamada sale sin otro correo;
   si todavía no salió, es la rama transitoria de arriba y la llamada espera a esa misma fila
   —**y si esa fila quedó `failed`, es la tercera rama: la llamada sale igual y se escala** (owner
   2026-09-25; FASE 9 completa, decisión 1)—. Sin
   esto la persona recibía hasta tres *«antes de cancelar»* por la misma baja.
   **En `S6` y `S17` esa transición todavía no ocurrió cuando el correo tiene que salir** (FASE 9
   completa, C-R5-1): la transición se escribe después de la llamada (precisión 2), así que el
   correo **se encola en una transacción propia, anterior**, y su ocurrencia es **el hecho que la
   dispara**: la autorización de la sucesora confirmada por relectura (`S17`), o el evento de `S6`
   que corresponda —el vencimiento del reloj, el `paused` o el `cancelled` leídos, el id del pago en
   `charged_back`, o el acto de `MP2`—. La transición se escribe después de la llamada, como ya dice
   su fila.
   **Y en la cancelación que el barrido manda sobre una terminal que el proveedor canceló tras un
   cobro rechazado y que revivió dentro de la ventana** (§10.1, el par que sigue al de la
   salvedad 4) no hay transición ni antes ni después: la ocurrencia es **la relectura que la vio
   viva**, y el instante de ese correo es el que cuenta sus 3 días (FASE 9 vuelta 3, verificación,
   VC3-cobro-01).

**Texto de la fuente — «El dominio, recorrido por el lado de la PREDECESORA»** (`B/03-maquinas-de-estado.md:377–533`, sin lo tachado):

La versión anterior de este § recorrió el dominio sobre la sucesora —*«`sucede_a` nulo o no nulo,
no hay un tercer estado»*— y **puso la precondición sobre la predecesora**, que es el eje que no
recorrió. El tercer estado existía y era caro: `sucede_a` no nulo con la sucesión terminada y
nada que pudiera limpiarlo.

**Mientras la sucesora espera autorización —hasta que vence su ventana, §3.4 punto 1— la predecesora se sigue moviendo, y se
mueve sola.** Recorrí las salidas de los **tres** estados desde los que una fila **puede ser sucedida**
—`ACTIVE`, `CANCEL_SCHEDULED` y **`SUSPENDED` de pagador con tarjeta con el
preapproval releído `cancelled`**, el conjunto que `G-R1-A` vigila (`B/20` §2; la `SUSPENDED`,
FASE 8 completa, `F-8CB1-002`, owner 2026-09-25; **`GRACE_PERIOD` salió del conjunto por
`DEC-SUB-021`**, owner 2026-09-25: desde el grace no se declara una sucesión, §3.3.1)— y son
**nueve** las transiciones de esta tabla que la sacan de ahí sin que nadie declare una sucesión
(recontadas con `DEC-SUB-021`: sale la 3 y la 8, entra la 11 — ver abajo, *«qué movió
`DEC-SUB-021`»*; **y entra la 12, `S36`**, FASE 9 vuelta 1, M; **y sale la 10, `S27`**, revisión
del owner, 2026-09-28, C8):

| # | desde | transición | hacia | ¿sigue siendo fila viva? |
|---|---|---|---|---|
| 1 | `ACTIVE` | `S8` — la persona pide pausar | `PAUSED` | **sí** |
| 2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | **sí** |
| | | **Ya no es una salida del conjunto** (`DEC-SUB-021`): desde `GRACE_PERIOD` sale de un estado alcanzable, no de uno de declaración; y desde `ACTIVE` —sus eventos segundo y tercero— sólo corre sobre un pagador con tarjeta y lo deja en una `SUSPENDED` con el preapproval cancelado, que está **adentro** | | |
| 4 | `CANCEL_SCHEDULED` | `S12` — llega la fecha de fin de servicio | `CANCELLED` | **no** |
| 5 | cualquiera de los cinco | `S13` — *Free Forever* | `CANCELLED` | **no** |
| 6 | `ACTIVE` | `S16` — el primer cobro de esa autorización se rechaza | `CHARGE_DECLINED` | **no** |
| 7 | `ACTIVE` | **el espejo de la baja decidida por el proveedor** (§10.1) — **ya no es la salida esperada del camino de mora**: desde `DEC-SUB-019` la corta `S6` antes; queda para la baja que igual llegue del proveedor (`B/12` §1.4). **Desde `GRACE_PERIOD` sigue ocurriendo**, pero ya como salida de un estado alcanzable y no de declaración (`DEC-SUB-021`) | `CANCELLED` | **no** |
| | | **Ya no es una salida del conjunto** (`DEC-SUB-021`): sale de `GRACE_PERIOD`, que es alcanzable y no de declaración — el mismo lugar que `S22` desde `PAUSED`. Sigue ocurriendo, y sigue disparando `S18` | | |
| 9 | `SUSPENDED` *(tarjeta)* | `S23` — **pide la baja estando suspendida**, o la ejecuta un admin (FASE 8 completa, `F-8CB1-002`) | `CANCELLED` | **no** |
| | | **Sale** (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan | | |
| **11** ✚ | `ACTIVE` | `S4` — **un cobro falla** (§4): la predecesora entra en el grace **durante** la ventana. Con `GRACE_PERIOD` fuera del conjunto (`DEC-SUB-021`), es una salida | `GRACE_PERIOD` | **sí** |
| **12** ✚ | `ACTIVE` · `CANCEL_SCHEDULED` | `S36` — **una persona registra la revocación del derecho de arrepentimiento** que pidió el cliente (`DEC-RF-001`): cancela el preapproval, corta el servicio en el acto y crea `RF1`. **Desde `GRACE_PERIOD` también ocurre**, pero ahí sale de un estado alcanzable y no de declaración, como `S24` (`DEC-SUB-021`), y no se cuenta (FASE 9 vuelta 1, M). **Y desde `PAUSED`** —alcanzable en la ventana por las filas 1 y 2— **también ocurre desde el owner 2026-09-26 (`X-2`)**: como `S22`, sale de un estado alcanzable y no se cuenta; cancela el preapproval pausado (`EX-11`), cierra la pausa con `fin_real`, crea `RF1` por el total y dispara `S18` | `CANCELLED` | **no** |

**La séptima no tiene fila numerada en esta tabla, y no por eso deja de ser una transición de
ella**: el §10.1 declara que *«espejar un estado leído por id es una transición declarada de esta
tabla»*, y el par `cancelled` × *(cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni
`SUSPENDED`)* manda espejar cuando no hay baja programada. Enumerar el dominio **sobre las filas numeradas** la deja
afuera, y es el error de método que costó una rama entera en `B/12` §5.3: la tabla numerada **no
es** la enumeración completa de esta tabla.

**La 4 no necesita
que nadie toque un botón —es un reloj—, y la 11 tampoco**: llega con el cobro fallido de la
renovación o, en un pagador manual, con la cuota que `MP5` abre sin pago acreditado (`S4`, §7.2)
—la 3, el otro reloj, salió de la cuenta con `DEC-SUB-021`—, y la 6 llega con el
cobro real, que `PA-3` mide **entre 26 y 44 minutos** después de autorizar: en esa media hora un
cambio de plan es legal y la predecesora todavía está `ACTIVE`. **La 7 no la decide nadie de este
lado**: es una baja del proveedor. —`GR-3` está `VERIFIED` desde el
2026-09-22 y la ventana de reintentos dura un ciclo (`B/12` §1.5)—, pero por mora el proveedor
**pausa**, no da de baja, así que esta fila sólo llega por una cancelación desde su panel o un
preapproval tocado a mano, y **cuándo llega no se puede acotar**. **Entre las terminales, la 9 y la 12 son las únicas que puede decidir el propio
cliente sobre su propia fila** —pide la baja estando suspendida (`S23`, que también puede ejecutar
un admin), **o revoca dentro de los 10 días y una persona lo registra (`S36`; FASE 9 vuelta 1, M)**; la 8 (`S24`, la baja en medio del grace) lo era también y salió de la cuenta con
`DEC-SUB-021` sin dejar de ocurrir—, y por eso **no caben** en
*«se mueve sola»*: lo que comparten con las otras terminales no es la causa sino el efecto.

**Las tres filas vivas —la 1, la 2 y la 11— son el dominio de `S17`** junto con el conjunto de
declaración, y por eso su `desde` son **cinco** estados y no tres: los tres de declaración más
`PAUSED` (filas 1 y 2) y `GRACE_PERIOD` (fila 11); **las seis terminales —4, 5, 6, 7, 9, y 12— ya no
lo son, y ahí `S17` simplemente no aplica: no hay nada que cancelar y no hay nada que matar.**
(Recontado con `DEC-SUB-021`: eran tres vivas y siete terminales sobre diez. **Y con `S36`: tres
vivas y siete terminales sobre diez otra vez**, pero ahora con la 11 y la 12 en lugar de la 3 y la 8; FASE 9
vuelta 1, M. **Y sin la 10: tres vivas y seis terminales sobre nueve**, revisión del owner,
2026-09-28, C8.)

**Las salidas de `SUSPENDED`, recorridas contra la tabla** (FASE 8 completa, `F-8CB1-002`, owner
2026-09-25). Con la `SUSPENDED` de tarjeta como **tercer** estado de declaración
(tercero desde que `DEC-SUB-021` sacó a `GRACE_PERIOD`), sus salidas son
éstas, y sólo **una** agrega una fila (revisión del owner, 2026-09-28, C8: `S27` salió):

| transición | ¿agrega una fila? | por qué, según la tabla |
|---|---|---|
| `S7` | **no** | su condición exige que la fila **no** sea la predecesora de una sucesión en curso; mientras lo sea, el pago que entre queda retenido por `S19` y no la saca de ningún lado |
| `S13` | **no** | ya es la fila 5: su `desde` es *«toda fila viva PRINCIPAL»*, `SUSPENDED` incluida |
| `S14` · `S15` · `S19` | **no** | van a **el mismo estado** |
| `S17` | **no** | es la sucesión consumándose, no una salida sin ella |
| `S23` | **sí — fila 9** | `SUSPENDED` → `CANCELLED`, pedida por el cliente o ejecutada por un admin |
| | | **sale** (revisión del owner, 2026-09-28, C8) |
| el espejo (§10.1) | **no** | `cancelled` × `SUSPENDED` es *«nada: es lo esperado»*; `authorized` × `SUSPENDED` es una marca —o el estado de `S19`— sin cambio de estado; `pending` × `SUSPENDED` es divergencia y marca; y `paused` × `SUSPENDED` no figura, así que también es marca. Ningún par la mueve |

**Y las filas vivas tienen desde la FASE 9-bis-4 una SEGUNDA salida que no es `S17`, porque la
persona puede irse.** Una predecesora que quedó en `PAUSED` (filas 1 y 2) o en `SUSPENDED`
(fila 3, hasta que `DEC-SUB-021` la sacó de la cuenta) puede pedir la baja: `S22` y `S23` la mandan a `CANCELLED` **sin que la sucesora haya
autorizado**, o sea por el mismo camino de `S12`, `S16` y el espejo — se muere sola. Por eso las
dos están nombradas en el segundo evento de `S18`, que es lo que cierra la sucesión y evita que el
candado `A` quede vacío; y por eso `B/12` §5.3 tiene desde entonces una **sexta** rama, la de una
predecesora que pide la baja ella misma y además retenía un pago por `S19`. **`S22` no entra en la tabla de arriba**: esa tabla recorre las salidas de
los estados desde los que una fila puede ser sucedida, y `PAUSED` no es ninguno — se llega a él
**por** esas filas. **`S23` sí entra desde la FASE 8 completa, como fila 9, pero sólo desde una
`SUSPENDED` de tarjeta**, que pasó a ser estado de declaración (`F-8CB1-002`); la `SUSPENDED` de
pagador manual a la que se llegaba por la fila 3 sigue sin serlo. Lo que cambia no es el dominio de la tabla sino que su columna de la
derecha —*«¿sigue siendo fila viva?»*— dejó de significar *«y de ahí sólo sale por `S17`»*.
**Y desde `DEC-SUB-021` la predecesora puede quedar también en `GRACE_PERIOD` (fila 11)**, y desde
ahí la baja es **`S24`**, que tampoco entra en la tabla, por la misma razón que `S22` (ver abajo).

**Qué movió `DEC-SUB-021`** (owner 2026-09-25). **`S24` entraba** porque `GRACE_PERIOD` **era** uno
de los estados desde los que una fila puede ser sucedida, **y ya no entra por la misma razón de
dominio**: desde el grace no se declara una sucesión (§3.3.1), así que `GRACE_PERIOD` pasó a ser lo
que `PAUSED` ya era —un estado al que la predecesora **llega** durante la ventana, por la fila 11—, y
su baja queda donde está `S22`. **La 3 sale por lo mismo** desde `GRACE_PERIOD`, y desde `ACTIVE`
no sacaba a nadie del conjunto: sus eventos segundo y tercero son de pagador con tarjeta y la dejan
en una `SUSPENDED` con el preapproval cancelado. **Y entra la 11**, `S4`, que antes movía a la
predecesora **dentro** del conjunto. Diez menos dos más una: **nueve** —**y diez con la 12, `S36`**, que
entró después y por otra causa (FASE 9 vuelta 1, M); **y nueve otra vez sin la 10, `S27`** (revisión
del owner, 2026-09-28, C8)—. **Ninguna transición dejó de
ocurrir**: cambió qué cuenta como salida del conjunto de declaración, no qué le puede pasar a la
predecesora durante la ventana — `S17` sigue saliendo de los mismos cinco estados, y `S18` sigue
nombrando a `S24` en su segundo evento.

**`S18` corre en OCHO de las nueve** —las tres vivas y
`S12`, `S16`, el espejo, `S23` **y `S36`** (fila 12; FASE 9 vuelta 1, M)—; **la que falta es `S13`** (`S27` salió con la revisión del owner, 2026-09-28, C8) (FASE 8 completa,
`F-8CB1-002`; recontado con `DEC-SUB-021`: sale `S24` de la cuenta, no del segundo evento de
`S18`). **`S36` ya está en la cuenta**: es la
fila 12 de la tabla, y sus espejos en `B/02`, `B/12`, `B/20` y el contrato están recontados (FASE 9
vuelta 1, M) —**y en `B/16` §4.3**, la lista de orfandad, y en las filas 6 de las dos tablas de
`B/12` §5.3, que no estaban (FASE 9 vuelta 2, `F-8V2D1-001`, `F-8V2D1-004`)—. En las tres filas
vivas corre después
de `S17`, que es el que hace verdadera su condición. En `S12`, en `S16`, en **el espejo**, en
**`S24`** —fuera de la cuenta, no de este efecto—, en **`S23`** **y en `S36`** —la revocación del
derecho de arrepentimiento (owner 2026-09-26, FASE 9 vuelta 1, M)— corre
**sin `S17` y sin esperar a que la sucesora autorice**, que es el segundo evento de su fila y el §
siguiente explica por qué tiene que ser así. (Sale con `S26`–`S28`:
revisión del owner, 2026-09-28, C8.) En `S13` **no corre**, y no es una excepción olvidada:
`S13` alcanza a **toda fila viva principal** del beneficiario, o sea también a la sucesora, así que
no queda ninguna sucesora viva a la que pasarle el origen (ver más abajo, *«`S13` alcanza a toda
fila viva PRINCIPAL»*).

**Texto de la fuente — «La baja tiene CUATRO filas y no una: qué significa cancelar desde cada estado»** (`B/03-maquinas-de-estado.md:886–941`, sin lo tachado):

**El acto es UNO** —*«cancelar una suscripción»*, una de las **veinticinco** *(con la vigesimoquinta: verificación corta, 2026-09-29, lote N-G; con la vigesimosexta, asignar o quitar el rol `SUPER_ADMIN`: FASE 9 vuelta 3, owner 2026-09-30, lote P; el nombre, lote AC)* del `NUCLEO/08` §3 (la vigesimotercera y la vigesimocuarta, borrar una ficha ajena y **dar de baja una cuenta** (caso I-C) a pedido de su dueño: casos vecinos, 2026-09-29, F-C; revisión del owner, 2026-09-28, N1 y C9: de la decimoctava a la vigesimosegunda, las cinco del catálogo; la decimosexta salió con la revisión del owner, 2026-09-28, C8, y su número no se reusa; la decimoséptima, *«migrar a los clientes de un plan retirado»*: la misma revisión, C15; la decimoquinta, *«editar el contenido de una ficha ajena»*: owner 2026-09-26, `G5-2`; la decimotercera es moderar una ficha: FASE 8 completa, `F-8CA2-004`, owner 2026-09-25; la decimocuarta, *«asentar un cobro o una devolución que ya ocurrió por fuera»*: owner 2026-09-25, FASE 9 completa, 5a), con un
permiso y una confirmación—, y `B/19` §5 lo deja self-service. **Lo que cambia por estado de
origen es qué queda por terminar**, y eso son cuatro desenlaces distintos que antes estaban
escritos en un solo renglón:

| desde | fila | a dónde va | qué queda por terminar |
|---|---|---|---|
| `ACTIVE` | `S11` | `CANCEL_SCHEDULED` | **el período que ya pagó**: se cancela allá de inmediato y lo sostenemos nosotros hasta esa fecha (`DEC-SUB-009`), que después ejecuta `S12` |
| `PAUSED` | **`S22`** | `CANCELLED`, **o `CANCEL_SCHEDULED`, sobre una fila que vive del crédito sin consumir** (`V2-b`) | **nada**: `DEC-SUB-010` ya se llevó los días no usados del ciclo al pausar. La fecha de fin de servicio es hoy (`B/12` §7.2). **Salvo el crédito de `DEC-SUB-006` sin consumir, que es período pagado (`R17`): ahí queda hasta el fin del crédito** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`) |
| `SUSPENDED` | **`S23`** | `CANCELLED` | **nada**: el §21 ya cortó el servicio y el estado no emite fuente. La fecha de fin de servicio es hoy |
| `GRACE_PERIOD` | **`S24`** | `CANCELLED` | **nada que esté pagado, y sí servicio que cortar**: el cobro del período en curso falló —por eso la fila está en el grace— y el último período pagado ya se consumió, así que la fecha de fin de servicio es hoy (`DEC-SUB-014`). Es la única de las cuatro en que la baja **retira cobertura que estaba corriendo** (§20) |

**Los cuatro estados vivos desde los que alguien puede pedir irse están cubiertos, y son cuatro y
no seis.** Los otros dos vivos no admiten el acto por razones que no son de esta tabla:
`PENDING_AUTHORIZATION` no tiene suscripción que dar de baja sino un checkout que terminar o
abandonar (§3.3.1), y `CANCEL_SCHEDULED` **ya tiene la baja pedida y mandada** (FASE 9 vuelta 3, lote D)
— pedirla otra vez no es una
transición, es un acto idempotente sobre el que `S12` ya está ejecutando.

**Por qué las tres nuevas no pasan por `CANCEL_SCHEDULED`, y no es una elección de estilo.** Ese
estado significa, textual, *«con la baja pedida y mandada al
proveedor […], con servicio sostenido hasta el fin del período pagado»* (§3.1; FASE 9 vuelta 3, lote D).
En las tres no hay período pagado que sostener, así que entrar ahí sería
**prometer un servicio que ninguna de las tres tiene**: desde `PAUSED` porque los días ya se
perdieron, desde `SUSPENDED` porque el §21 los cortó hace rato —y ahí además lo
**resucitaría**, que es peor— y desde `GRACE_PERIOD` porque **el período en curso no está
pagado**: su cobro es justamente el que falló. El §3.3 ya lo impedía para `PAUSED` (*«cualquier
cosa que no sea `ACTIVE` o `CANCELLED`»*) y acá se escribe la razón para las tres. **Salvo `S22`
sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir** (FASE 9 vuelta 2,
verificación, owner 2026-09-27, `V2-b`): el crédito es período pagado (`R17`), así que ahí sí hay
qué sostener y la fila pasa por `CANCEL_SCHEDULED` hasta el fin del crédito. **`S13` es el
precedente exacto**: alcanza a las filas en `PAUSED`, en `SUSPENDED` y en `GRACE_PERIOD`, cancela
el preapproval y las manda directo a `CANCELLED`, sin escala y sin fecha de fin de servicio.

**Y el servicio que `S24` corta no se le regala hasta el fin del grace**, que era la otra
respuesta posible. El reloj del §4 existe para acotar el servicio que se le presta a quien no
pagó (`B/12` §4.3, *«el grace no es un beneficio de entrada»*); dejarlo correr sobre alguien que
**ya decidió irse** alarga ese regalo sin que nadie lo haya elegido, y **deja el candado `A`
ocupado** mientras tanto — el mismo encierro que `S23` vino a romper (`DEC-SUB-014`).

**No compiten con ninguna fila, y se verifica por pares** (`NUCLEO/03` §1, regla 7). `S22`
comparte `desde` con `S10`, cuyo evento es *«llega el fin, o la persona vuelve antes»*; `S23` lo
comparte con `S7` y con `S19`, cuyo evento es *«entra el pago»*; `S24` lo comparte con `S5` y con
`S19` —*«entra el pago»*— y con `S6`, cuyo evento es *«se agota el reloj»*. **Ninguna otra fila de
esta tabla declara el evento de la baja**, así que los tres pares nuevos tienen una sola fila cada
uno. **La tabla de pares con dos filas no crece por la baja** (`S25` salió con la revisión
del owner, 2026-09-28, C8).

**Y ninguna de las tres es consumidora de *«fila viva»***, así que el inventario de `NUCLEO/01`
§2.4 no gana filas: su `desde` es **un estado concreto** y no el conjunto. Lo contrario habría
sido escribirlas como `S13` —*«toda fila viva…»*—, y sobre este acto eso sería falso: la baja la
pide una persona sobre **su** fila, no un barrido sobre un conjunto.

**Texto de la fuente — «Y no alcanza a los complementos: el `desde` dice «principal» y eso es una acotación, no un matiz»** (`B/03-maquinas-de-estado.md:1016–1081`, sin lo tachado):

**Una suscripción de complemento es una fila de `subscription` como cualquier otra** —con su
`clase`, su `vertical` y su propio preapproval (`B/02` §2.2, `DEC-ADDON-002`)—, y el §3 declara
que *«usan esta misma máquina»*. Con el `desde` escrito como *«toda fila viva del beneficiario en
cada vertical que el acto ancla»*, **entraban por pertenencia al conjunto**, y el resultado era
malo en las dos direcciones:

- **hacia perder lo pagado**: el *«Boost 30 días»* que el beneficiario compró ayer quedaba con su
  preapproval cancelado de forma irreversible (`PA-5`) y **sin reembolso** (`DEC-GRANT-001`), en el
  mismo acto en que se le regala el plan;
- **hacia regalar lo que nadie paga**: para un addon de scope `USER` o `GLOBAL` el objetivo es la
  cuenta, que no se borró, así que **no queda huérfano** (`B/16` §4.2) — pero su cobro ya estaba
  cancelado, y **ninguna transición de la máquina de addon tiene por evento *«mi suscripción de
  complemento fue cancelada»*** (`A4` es su fecha de fin, `A5` la baja, la orfandad o la
  revocación de su grant-título, y `A6` el borrado de la ficha, §8). La instancia se quedaba `ACTIVE` y gratis para
  siempre.

  > **`S20` deja a esa instancia exactamente así —`ACTIVE` y gratis— y no es el mismo desenlace**,
  > aunque la foto coincida. Acá el addon quedaba gratis **porque nadie decidió nada** y sin
  > ninguna forma de apagarse: el grant se revocaba y seguía encendido para siempre. Con `S20` es
  > gratis **porque el §35.2 lo declara gratis** mientras el grant dure, la instancia **cuelga del
  > ancla** y **tiene apagado declarado**: la tercera cláusula del evento de `A5` la corta cuando
  > se revoca el grant (§8, `B/16` §3.3). Lo que hacía inadmisible este camino no era que el addon
  > quedara gratis: era que **nada lo volvía a apagar**.

**Las tres reglas que lo prohíben ya estaban escritas, y ninguna es de acá**: el §41 ordena *«no
cancelar ciegamente»* y cancelar *«sólo cuando queda efectivamente huérfano»*; `DEC-ADDON-002`
implicación 6 dice que **cancelar el plan NO cancela los addons**; y
`12-contrato-de-cobertura.md` (`../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md`)
§2.4 lo dice del caso exacto —*«quien tiene *Free Forever* y un addon **conserva los dos**»*—.
`S13` cancelaba **por pertenecer al conjunto**, sin evaluar ninguna condición, que es literalmente
lo que el §41 prohíbe.

**Qué le pasa entonces a la instancia del addon, dicho para que no quede en la inferencia:**

| scope del addon (§40) | qué pasa cuando `S13` mata la principal de esa vertical |
|---|---|
| `VERTICAL_SUBSCRIPTION` | **no queda huérfano**: el grant que acaba de caer **vale como título en esa vertical** (`B/16` §2.4), y ésa es la tercera salvedad de la condición de `B/16` §4.2. Sin ella, `A5` lo cancelaría de inmediato por la otra puerta y *«conserva los dos»* sería falso igual |
| `USER` · `GLOBAL` | **no queda huérfano**: el objetivo es la cuenta y la cuenta no se borró. Ya era así; lo que cambia es que ahora `S13` tampoco le cancela el cobro |
| `LISTING` | **no lo toca nadie**: su objetivo es la ficha (`B/16` §4.2) |

**Y `S13` no le apaga el cobro a ninguno de los tres, que es lo que esta acotación garantiza.** Es
la regla 1 del núcleo leída en la dirección que menos se lee: lo que la tabla no declara **no
pasa**, así que un grant que no alcanza al complemento tampoco lo deja gratis por accidente.

**Lo que SÍ se lo apaga es `S20`, y es otra fila con otra condición.** Que la instancia sobreviva
al grant no decidía de dónde sale la plata, y **durante toda una tanda nadie lo escribió**: el
beneficiario de un *Free Forever* con `includesAddons: true` seguía pagando todos los meses un
addon que su propio flag le declaraba gratis. Eso lo cierra `S20` (arriba, y el caso entero en
`B/16` §3.4), que **evalúa una condición** —el flag, la compatibilidad del producto con la
vertical anclada y, en los scopes con vertical propia, el objetivo— en vez de alcanzar por
pertenencia. Las dos afirmaciones conviven sin contradecirse porque **hablan de conjuntos
distintos**: `S13` de las principales, `S20` de las de complemento que cumplen su condición. Un
complemento **no compatible**, o cualquiera si el flag es `false`, **sigue cobrando** — y sigue
siendo lo correcto, por la misma razón por la que `S13` no lo alcanza.

**`S13` y `S20` comparten el evento y NO comparten el par, así que `G-R4` no tiene nada que
mirar.** El evento es el mismo —otorgar, o anclar una vertical nueva—, pero el `desde` de una es
*«toda fila viva **principal**»* y el de la otra *«toda fila viva **de complemento**»*, y la
partición por `clase` (`B/02` §2.2) hace que los dos conjuntos sean **disjuntos por
construcción**: ninguna fila puede satisfacer los dos. La regla 7 del núcleo pide guardas
disjuntas cuando el par coincide; acá **el par no coincide**, y **los pares con dos filas de
esta tabla no crecen por `S20`/`S21`** — hoy son **tres**:
el cuarto, `S10`/`S25`, salió con la revisión del owner, 2026-09-28, C8 (`NUCLEO/03` §1 regla 7).

**Texto de la fuente — «3.4 Las cuatro precisiones que `M-SUB-01` pedía sobre `PENDING_AUTHORIZATION`»** (`B/03-maquinas-de-estado.md:1520–1588`, sin lo tachado):

El §5.6 define el modelo actual —Hospeda crea el preapproval y después manda a autorizar—, así
que **esta ventana existe siempre, por diseño**, y es donde se pierde gente. `M-SUB-01` pedía
cuatro cosas y acá están las cuatro:

1. **Duración máxima: son DOS y no una, según el método de pago** (`DEC-SUB-016`). **72 horas para
   el pagador con tarjeta** y **7 días corridos para el pagador manual**. Las dos son
   configuración, no constante (§9), y viven en las opciones globales de billing. Las dos
   respetan las mismas dos restricciones: más largas que cualquier demora del proveedor —medida
   hasta ~33 min— y más cortas que el ciclo más corto que vendemos, para que una ventana abierta
   nunca se superponga con un cobro.

   **Y la de una sucesora con tarjeta puede ser más corta**: vence a lo que llegue primero entre sus
   72 h y el inicio del día del próximo cobro de su predecesora, y si queda menos que un mínimo el
   cambio de plan no se ofrece hasta después de ese cobro (`B/12` §5.4). Sobre el pagador manual no
   se acorta: su crédito corto se corrige (`DEC-SUB-017`).

   **Por qué el pagador manual no puede compartir las 72 h.** Esa cifra se eligió para el tiempo
   que tarda alguien en **completar un checkout**; lo que la ventana del pagador manual espera es
   otro hecho físico: **que se acredite una transferencia bancaria**, que en Argentina no ocurre
   en 72 h si el envío cae antes de un fin de semana largo. El costo de equivocarse es asimétrico
   —se pierde a alguien que **ya decidió pagar**, contra tener una fila pendiente unos días más—,
   y la fila pendiente no cuesta servicio: durante la ventana **no emite fuente**
   (`12-contrato…` (`../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md`)
   §2.6), que es lo que el §7.2 exige para que la regla se sostenga con cualquiera de las dos.

   **Y son días CORRIDOS, no hábiles.** Un plazo en días hábiles obliga a un calendario de
   feriados que el programa no tiene y que nadie va a mantener — el mismo criterio con que este
   diseño viene descartando mecanismo.

   **Consecuencia que hay que leer junto con el punto 3**: el vencimiento es **de esa fila**, así
   que ninguna superficie puede escribir el plazo a mano. Lo que se muestra y lo que se avisa es
   **la fecha** — el §3.4 punto 3 acá, `B/19` §4 fila 18 y `NUCLEO/07` §6.
2. **Limpieza**: un job recorre las vencidas, las lleva a `ABANDONED` y **cancela el preapproval
   en el proveedor**. Sin ese segundo paso queda una autorización viva que puede cobrar.

   **Y antes de cancelar, relee el preapproval por id** (`S3`, fila de la tabla del §3.2). El
   vencimiento lo decide nuestro reloj, pero si la persona autorizó lo decide el proveedor, y las
   dos cosas pueden pasar en el mismo minuto: autorizar en el último momento y que el webhook
   llegue tarde es una carrera real, no un caso teórico. Sin la relectura, el job le cancela la
   suscripción a alguien que acaba de autorizarla. Es la misma regla que ya llevaban las otras
   transiciones que cancelan en el proveedor (*«con la regla de relectura de `S17`»*); en `S3`
   faltaba, y no por decisión.

   **Y sobre una sucesora con tarjeta de ventana reducida, la relectura corre EN EL CORTE** —las
   00:00 `-04` del día del cobro de la predecesora— **y antes del primer lote en que ese cobro
   puede caer** (`B/12` §5.4; FASE 8 completa, `F-8CB1-004`): con el webhook de autorizada demorado,
   es lo único que hace correr `S2` y `S17` antes de que la predecesora cobre. Lo que eso no cierra
   está anotado en `B/12` §5.4.
3. **Qué ve la persona mientras tanto**: su vertical en estado «esperando que completes el
   pago», con el enlace para retomar y la fecha en que vence. El enlace **nunca es el que
   devuelve la API crudo**: está medido que viene roto (`EX-37`), y el capítulo 06 fija que se
   sanea con un guard estático.
4. **Qué pasa si vuelve a intentar**: **no** se crea otra. Se reusa la vigente si le queda
   ventana. Está medido que el proveedor **no deduplica por ningún mecanismo** (`EX-17`: diez
   intentos, diez ids) y que su buscador **ignora nuestra referencia** (`RC-1`), así que el
   candado es nuestro o no existe (`DEC-CONC-001`). **Y ya no depende de que el camino se acuerde
   de reusarla**: el candado `A` de `B/02` §2.2 incluye `PENDING_AUTHORIZATION` entre los vivos, así
   que el segundo `INSERT` lo rechaza la base. El reuso pasó de ser una regla del servicio a ser
   una consecuencia de la restricción.

   **La afirmación exige que la fila pendiente ocupe `A`, y una sucesora ocupa `B`** — por eso el
   cierre no espera la autorización cuando la predecesora se murió sola (§3.2). Sin ese segundo
   evento de `S18` esta frase era falsa exactamente para la población que más la necesita: el
   cliente al que le rechazaron el primer cobro (`S16`) con un cambio de plan en curso.

**Texto de la fuente — «4. Grace»** (`B/03-maquinas-de-estado.md:1589–1655`, sin lo tachado):

Sub-estado de Suscripción con reloj propio. Entra por `S4` y sale por `S5`, por `S6` o por
**`S24`**, la baja que la persona pide en el medio (`DEC-SUB-014`), **o por `S36`**, la revocación
dentro de los 10 días, que apaga el reloj (FASE 9 vuelta 1, `N-G3V-04`) — y por `S17` o
`S13`, si la fila es la predecesora de una sucesión que se consuma o le cae un grant, (`S26` salió con la revisión del owner, 2026-09-28, C8) **o por el espejo de la baja decidida por el
proveedor** (§10.1), con las salvedades de ese par que alcanzan al grace —las dos de `S6`: la sucesora de la
rama de `S4` y el reloj ya agotado— (FASE 9 vuelta 1,
`F-8V1B2-011`); en una fila de complemento, además, por `S20` o `S21` (§3.2; FASE 8 completa, `F-8CD1-011`). **Mientras
esa sucesión esté en curso, ni `S5` ni `S6` por sus eventos primero, segundo, cuarto y quinto se ejecutan** —**por el tercero, un contracargo, `S6` corre igual y `S31` corta a la sucesora** (`DEC-SUB-020`, su 📌; FASE 9 completa, C4)—: el pago que entre queda pendiente por
`S19` y el reloj no vence sobre él (§3.2). **Y vale también para el segundo evento de `S6`** —la
pausa del proveedor por mora, que puede llegar con la fila todavía en `ACTIVE` (`DEC-MP-008`)—: a
quien está en medio de un cambio de plan no se lo suspende por eso (owner, 2026-09-24).

**Desde `DEC-SUB-021` la redeclaración que ese límite frenaba no puede ocurrir** (owner
2026-09-25): el abuso —redeclarar una sucesión cada 72 h, o cada 7 días si paga a mano, para tener
servicio completo sin pagar nunca (FASE 8 completa, `F-8CB1-005`, `F-8CB2-008`)— necesitaba
**declarar desde `GRACE_PERIOD`**, y desde el grace ya no se declara (`G-R1-A`, `B/20` §2). **Lo que
sigue vigente es la protección**, y vale para la única sucesión que todavía puede tener a la fila
en el grace: **una declarada en `ACTIVE` cuya predecesora entra en el grace durante la ventana**
(`S4`). Esa sucesión sigue su curso, `S6` no la suspende mientras esté en curso, y si la sucesora
muere `S6` corre en la corrida siguiente — sin una segunda sucesión posible que lo vuelva a frenar,
porque la fila ya está en `GRACE_PERIOD`. La fila `S6` de la tabla dice lo mismo (la salvedad del segundo evento se cerró el 2026-09-25; FASE 9
completa, C4).

**Y ahora entra también una sucesora que nunca cobró** (owner 2026-09-25; FASE 9 completa, 3c,
contra la recomendación): si su predecesora venía pagando y el primer cobro de la sucesora se
rechaza, va a `S4` y no a `S16` (§3.2). Es un grace sobre una autorización que el proveedor pudo
haber cancelado ya (`PA-6`, `UNKNOWN`), y por eso tiene un control propio: **el barrido diario
relee su preapproval por id; si lo ve `cancelled` o `paused`, `S6` corre en el acto** —cancelación
de nuestro lado de lo que quede vivo y aviso de suspensión con *«volvé a suscribirte»*—, con la
misma forma que `DEC-MP-008`. El riesgo de `PA-6` queda acotado a un día.

| | |
|---|---|
| **cuándo entra** | falla un cobro de una suscripción `ACTIVE` (§20). **En un pagador con tarjeta, es el primer rechazo de un cobro de renovación, leído por id** (`B/12` §1.2, `D17`), no el fin de los reintentos del proveedor, que no emite evento (`GR-3`) — **o el primer cobro rechazado de una sucesora cuya predecesora venía pagando** (owner 2026-09-25; FASE 9 completa, 3c) |
| **cuánto dura** | los días que declara **la versión de plan**, default **10** (`DEC-SUB-002`) — y **siempre menos que el ciclo de esa versión** (`DEC-SUB-019`): el proveedor reintenta durante **un ciclo** (sonda 49) y después pausa, así que un grace más largo dejaría la fila con servicio completo y sin nadie que vaya a cobrar. Es validación de la configuración |
| **qué pasa durante** | §20: servicio activo, fichas publicadas, edición activa, entitlements activos, advertencias y correos. **Y un cambio programado cuya fecha llega se aplica igual, por `S38`** (revisión del owner, casos vecinos, 2026-09-29, caso G-A) |
| **cómo sale bien** | entra el pago → `ACTIVE` |
| **cómo sale mal** | se agota el reloj → `SUSPENDED`, **y en un pagador con tarjeta se cancela el preapproval** (`S6`, `DEC-SUB-019`) — **o antes del reloj**: el proveedor pausa (`DEC-MP-008`), un contracargo, el admin confirma la cuota impaga (`MP2`), o, sobre la sucesora de 3c, el barrido lee su preapproval `cancelled` (FASE 9 completa, C8 y 3c) |
| **qué se puede hacer adentro** | **regularizar, y recién después cambiar de plan** (`DEC-SUB-021`, owner 2026-09-25, que supera a `DEC-SUB-003`). **Con tarjeta, cambiar la tarjeta** del preapproval, que se puede sin recrearlo (`EX-36`): los reintentos del proveedor, que siguen durante un ciclo (`GR-3`), cobran con ella, y la fila vuelve a `ACTIVE` por `S5` (tachado 2026-09-26) — **medido: `GR-1` `VERIFIED` el 2026-09-26** —cambiar el medio de pago dispara un reintento que cobra con el nuevo, sobre el mismo registro (sonda 49)—, **así que la pantalla y los correos del grace pueden decir que al cambiar la tarjeta se reintenta el cobro** (`B/12` §1.5; `B/19` §4 filas 9 y 17-bis). Sigue sin medir cuántos reintentos de un plan mensual o anual caen dentro del grace (`B/12`, *«lo que este capítulo NO cierra»*) (FASE 9 vuelta 1, `F-8V1B1-008`). **Con pago manual, pagar la cuota**. **Recién en `ACTIVE` se cambia de plan**: desde `GRACE_PERIOD` no se declara una sucesión (`G-R1-A`), y la pantalla lo dice (§3.3.1, `B/19` §4 fila 17-bis). El motivo: `S17` cancela la predecesora al **autorizar** la sucesora y `D8` le difiere el primer cobro, así que si ese cobro falla —con la misma tarjeta que venía fallando— la persona se queda sin nada (FASE 8 completa, `F-8CD1-002`, `F-8CB1-009`) |

**Tres cosas que el reloj tiene que respetar:**

- **El reloj decide cuándo se pregunta, no qué pasó.** Si cobró o no lo sabe el proveedor, así
  que antes de suspender **se le pregunta** (`S6`). Sin eso, un webhook perdido suspende a alguien
  que pagó, y el barrido diario lo repara con hasta un día de atraso. La pregunta se hace **con la
  lectura del `B/09` §4**, que es el único lugar del diseño que decide *«cobró o no»*: `S6` no
  elige campo, así que cuando esa lectura se corrija, `S6` queda corregido sin tocarlo. Y si el
  proveedor no contesta, **no se suspende**: el costo de esperar una corrida es que un moroso
  conserve el servicio un poco más, y el de no esperar es suspender a un cliente al día.

- **Los correos del §42.3 son relativos al vencimiento, no absolutos.** Si la ventana es
  configurable, un schedule con días fijos se cae fuera de la ventana en los planes con grace
  más corto (`DEC-SUB-002`).
- **El reloj no puede preguntar «¿ya cobró?» a una hora exacta.** Está medido que el cobro del
  proveedor llega tarde y que el retraso es variable —33 minutos en una renovación de sandbox,
  ~26 en producción, ~100 segundos en un alta—. Toda comparación contra el reloj lleva margen.

**Texto de la fuente — «5. Pausa»** (`B/03-maquinas-de-estado.md:1656–1739`, sin lo tachado):

Sub-estado de Suscripción con reloj propio **y motivo obligatorio**. Entra por S8 o S9 —**y una
fila de complemento, por `S32`**, junto con su principal pausada por el cliente o suspendida (owner 2026-09-25, FASE 9 completa, 4a; la suspensión, owner 2026-09-26, `G2-2`)—, sale
por S10 (**la de complemento, por `S33`**) — **o termina, sin reanudar, por `S22` (la persona pide la baja), por `S13` (le cae un grant), por
`S17` (la sucede otra fila que se autorizó) o por el espejo de la baja decidida por el proveedor
(§10.1)** —**o por `S36`**, la revocación del derecho de arrepentimiento (owner 2026-09-26, `X-2`;
FASE 9 vuelta 2, `F-8V2D1-003`)—; en una fila de complemento, además, por `S20` o
`S21` (§3.2; FASE 8 completa, `F-8CD1-011`: este párrafo nombraba dos terminales y omitía `S25` y
`S17`; el espejo, FASE 9 completa, contradicción 2 de `03` §R4.5). **Y dentro de `PAUSED · COURTESY`
hay dos filas que no salen del estado**: `S34` suma meses a la cortesía y `S35` la cambia por una
pausa pedida por la persona (FASE 9 completa, contradicciones 4 y 5). **Las cinco terminales** (revisión del owner, 2026-09-28, C8: sale `S25`) mandan la fila a `CANCELLED` y **cierran
la pausa** —el `fin_real` lo escriben `S22`, **y desde el 2026-09-25 también `S13` y
`S17`** cuando la fila que cancelan estaba `PAUSED` (FASE 8 completa, `F-8CD1-007`), **y el espejo
con el día de la relectura** (FASE 9 completa), **y `S36` con el día del registro** (FASE 9 vuelta
2, `F-8V2D1-003`)—, así que la que sostiene lo que sigue es S10, **que
también escribe `fin_real`** (FASE 9 completa, contradicción 3). **Y una pausa por cortesía se corta además por `S6`**, si un
contracargo cae sobre ella: la fila va a `SUSPENDED` y la pausa se cierra con su `fin_real` (§3.2;
FASE 8 completa, pendiente 8, owner 2026-09-25).

| | |
|---|---|
| **motivos** | `CUSTOMER_REQUEST` · `COURTESY`. Valor cerrado |
| **unidad** | **meses enteros** (`DEC-SUB-010`). No existe la pausa intra-ciclo |
| **cuándo empieza** | en el momento en que se pide, no al fin del ciclo |
| **quién la termina** | **la termina nuestro reloj, y del lado del proveedor no hay segunda vía**: está medido que **no tiene auto-reanudación** (`PS-4`). Por eso `S10` lleva **rama de fallo y detector** (§3.2, *«`S10` es la única salida de `PAUSED` que devuelve el servicio»*). **Que el reloj la termine es siempre reanudarla** (revisión del owner, 2026-09-28, C8: `S25` salió). **Y la persona tiene su propia vía, que tampoco reanuda: es irse** (`S22`) |
| **qué pasa al volver** | se cobra normal en el ciclo siguiente; reanudar cambia **sólo el estado** y no dispara cobro de recuperación ni deja deuda (`PS-5`) |
| **límites** | los del §26.3, reexpresados en meses: **4 pausas-mes** por pausa y **8** acumulados en 12 meses; máximo 3 pausas por ventana. Se cuentan por `user + vertical` y **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`). **Se cuentan sólo sobre filas principales**: la pausa que `S32` le abre a un complemento acompaña a la de su principal y no gasta cupo (FASE 9 completa, 4a) |

**Qué le pasa a la ficha mientras dura la pausa, porque esto no se puede escribir de un solo
lado.** Una `PAUSED` por `CUSTOMER_REQUEST` **no emite fuente** (`12-contrato…` §2.6), así que
`cubierto` pasa a falso y `PB2` baja la ficha el primer día (`V/03` §9) **y en ese acto arranca el
reloj de inactividad** —el hecho 5 del `NUCLEO/01` §1.2, FASE 8 completa, `F-8CA2-001`, owner
2026-09-25—, **en ella y en todas las demás fichas del dueño en la vertical**, que el recálculo del
aviso escribe sin pasar por `PB2` (owner 2026-09-25). **Y el reloj de inactividad de verticales se detiene mientras dure la pausa** (revisión del owner, 2026-09-28, C14): el hecho 5 lo escribe igual, pero `PB4`, `PB5` y `PB9` no actúan mientras `retenciónDetenida` conteste `sí`.

**Desde la revisión del owner la pausa pedida por el cliente detiene el reloj de retención**
(revisión del owner, 2026-09-28, C14, `L1-c`): verticales pregunta `retenciónDetenida` (`12-contrato…` §4.1) antes de
archivar, borrar o avisar, y con esta fila en `PAUSED` la respuesta es `sí`. **La ficha ya no se
archiva durante la pausa**, y lo que sigue sobre el tope y el día 180 queda como historia. Lo que
antes protegía al cliente eran **tres** cosas:
**`PB7` republica la ficha sola** cuando la cobertura vuelve al reanudar; **el tope de una
pausa es menor que el día del hard delete** —4 pausas-mes, unos 120 días, contra 180 (`V/02`
§4.1)—; y **que la reanudación efectivamente ocurra**, que es la premisa de las otras dos.

(Salen `D16` y `G-R5`, revisión del owner, 2026-09-28, C14: el
tope de pausa ya no está atado al día 180.) El aviso que se lo dice antes de confirmar es `B/19` §4, fila 5-bis.

**La tercera es la única que depende de que un job corra, y por eso es la que lleva las dos
escrituras nuevas.** Sigue en pie con C14: una reanudación que no ocurre deja el reloj detenido y
al cliente sin servicio. Lo que la vigila es la **rama de fallo de `S10`**
—la relectura que, si el proveedor sigue diciendo `paused`, deja la fila donde está y pone la
marca— y la **quinta comprobación de cero llamadas** de `B/09` §3, que encuentra la pausa cuyo
`fin_previsto` pasó y sigue sin `fin_real`. Sin las dos, la premisa con la que `DEC-DATA-002`
declaró *«el daño residual es cero»* no la sostenía nada.

**El motivo no es un adorno, y ésta es la razón exacta**: en el proveedor una cortesía y una
pausa pedida por el cliente **se ven idénticas** —el mismo `paused`, sin ningún campo que las
distinga—, así que un reloj que leyera el estado del proveedor reanudaría la cortesía de quien
había pedido pausa, o al revés (`DEC-GRANT-004`). **El reloj lee el motivo, nunca al proveedor.**

**Los tres cruces entre pausa y cortesía** ya están decididos (`DEC-GRANT-004`) y la máquina los
ejecuta así: en cortesía pide pausar → **se permite**, avisando que pierde la cortesía que le
quedaba —**lo ejecuta `S35`**—; en pausa se intenta otorgar cortesía → **se bloquea**; cortesía sobre cortesía → **se
suman los meses** y el aviso dice la fecha de fin nueva —**lo ejecuta `S34`**— (FASE 8 completa,
`F-8CB1-001`, owner 2026-09-25: la cortesía temporal es en meses enteros y sólo sobre planes
mensuales, `DEC-GRANT-003` impl. 6 y `DEC-GRANT-004` punto 3). **Hasta la FASE 9 completa dos de
los tres cruces no tenían fila**: `S8` y `S9` salen sólo de `ACTIVE`, así que el primero y el
tercero no los ejecutaba nadie (contradicciones 4 y 5 de `03` §R4.5; `S34` y `S35`, §3.2).

**Y una pausa pedida por el cliente pausa también sus complementos recurrentes** (owner
2026-09-25; FASE 9 completa, 4a, `F-8CC1-004`): los de esa vertical, y los `USER`/`GLOBAL` sólo si
no les queda título sin pausar en otra vertical compatible, por los mismos meses (`S32`), y se
reanudan con ella (`S33`). Una pausa por cortesía no los toca, porque la cortesía emite título.

**Texto de la fuente — «10. La regla de no-retroceso · cierra `M-CONC-02`»** (`B/03-maquinas-de-estado.md:2689–2713`, sin lo tachado):

El §51 nombra *«out-of-order»* entre los escenarios a cubrir y el §64.18 dice que *«MP gobierna
hechos ocurridos en MP»*.

**El orden existe y está medido**: el cuerpo de cada evento trae un campo **`version`, un
contador monótono por recurso** — el mismo preapproval llegó con `version` 4, 6, 7 y 8 en el
orden causal de las acciones (`EX-2`, `VERIFIED`). Es más fuerte que el id del evento, que
cambia en cada reentrega.

**Y aun así la regla no se apoya en ordenarlos, sino en no necesitar el orden.** El motivo no es
que falte el contador: es que un evento ordenado sigue sin decir el estado actual. Entre que el
proveedor emite y nosotros procesamos pueden haber pasado más cosas, y el `version` permite
saber que un evento es viejo pero no qué hay ahora. La relectura sí.

El `version` **se usa**, y **para una**: descartar un evento más viejo que el último
aplicado **sin gastar una relectura**,. **La segunda ya no la hace el `version`**: detectar *«cambió sin avisarnos»* es del
barrido, que relee por id, y **la lectura por id no trae `version`** —viene en el cuerpo del
webhook (`EX-2`), no en el `GET` (`RC-9`, `NOT_SUPPORTED`, producción 2026-09-25)—. Lo que la
relectura trae es **`last_modified`**, y eso es lo que el barrido compara (`B/09` §3; FASE 8
completa, `F-8CB3-010`). Que mutar el monto salte el contador sigue medido (`EX-15`), pero **ese
salto sólo se ve en un webhook, y la mutación no emite ninguno**.

**Texto de la fuente — «10.1 Un webhook no es un estado: es un aviso»** (`B/03-maquinas-de-estado.md:2714–2747`, sin lo tachado):

**Nunca se escribe el estado que trae el evento.** Al recibirlo, si su `version` no es mayor que
la última aplicada para ese recurso se descarta ahí mismo; si lo es, se **relee el recurso por su
id** en el proveedor y se escribe lo leído, junto con la `version` **del evento
que la disparó** —la lectura por id no la trae (`RC-9`)— **y el `last_modified` de esa lectura**
(`B/02` §2.2; FASE 8 completa, `F-8CB3-010`). **Desde la revisión del owner (2026-09-28, N4 y
`L3-f`) esta regla tiene control automático, `G17`** (`B/20` §2): falla si el receptor lee del cuerpo
otra cosa que el recurso, su id y su `version`, o si una transición de esta tabla o una acción administrativa
decide con un estado del proveedor que no salió de una lectura por id. **Y la lectura lleva su
instante**: una anterior al comienzo del acto la rechaza el tipo, y hay que releer (revisión del
owner, casos vecinos, 2026-09-29, caso 35; `D17`).

**Todo esto es del canal Webhooks. Una entrega que llega por IPN no entra acá** (mediciones del
2026-09-29, M-2): se guarda entera en `provider_notification` (`B/02` §2.7), que ninguna decisión lee, y no
se relee nada. **Una entrega de Webhooks también se guarda ahí, con su canal**, y se procesa como
dice este §: lo que decide sale de la entrega recibida y de la relectura, nunca de la tabla
(mediciones del 2026-09-29, lote L-B). El `payment` que llega por IPN es el mismo que llega por Webhooks (`WH-6`), así que
no se pierde ningún hecho. **Y el receptor contesta `200` a una entrega que ya procesó, aunque su
recurso sea desconocido o terminal**: la huérfana se resuelve con su lápida y su marca (`B/09`
§2.4) y el terminal con la tabla de abajo; forzar un reintento no le agrega nada a una relectura que
ya se hizo, y cada entrega fallida alimenta los reintentos y la supersesión del proveedor (`WH-4`,
`WH-5`). **Contesta error si no pudo guardar la entrega o, si es de Webhooks, no pudo procesarla** (verificación corta, 2026-09-29, VC-cobro-07: leída a la letra, la frase anterior contestaba `200` a una entrega guardada cuyo procesamiento falló, y el proveedor no la reintentaba; un reintento es otra fila, porque la tabla no tiene `UNIQUE`), y ahí el reintento sirve
(mediciones del 2026-09-29, puntos 2 y 9).

Está medido que ese camino es el confiable: leer por id es confiable
(`RC-1`; FASE 9 vuelta 2, `F-8V2C2-007`), mientras que
**buscar no lo es** y falla en tres direcciones sin avisar en ninguna (`RC-1`) — ignora nuestra
referencia y devuelve todo, con un estado inválido devuelve cero con `200`, y con uno válido
devuelve un subconjunto plausible.

Con esto, dos webhooks que lleguen al revés producen **el mismo resultado**: los dos releen y los
dos escriben el estado actual. No hay retroceso posible porque el evento nunca es la fuente.

**Texto de la fuente — «Qué se escribe, par por par — espejar es una transición declarada»** (`B/03-maquinas-de-estado.md:2748–2800`, sin lo tachado):

*«Se escribe lo leído»* y *«lo que la tabla no declara no se escribe, se marca»* (`NUCLEO/03` §1,
regla 1) **gobiernan el mismo acto y daban resultados opuestos**. Como la tabla del §3.2 sólo
cubría dos de los mapeos que el proveedor puede devolver, **la defensa central contra el desorden
de webhooks terminaba emitiendo un incidente en vez de espejar un hecho**, y la fila se quedaba en
un estado que el proveedor ya había abandonado — **con servicio completo**.

Se resuelve enumerando. El proveedor devuelve **cuatro** estados de preapproval; cruzados con lo
que tengamos nosotros, éstos son los pares y su veredicto:

| leído en el proveedor | lo nuestro | qué se hace |
|---|---|---|
| `pending` | `PENDING_AUTHORIZATION` | nada: coinciden |
| `pending` | cualquier otro — **salvo la fila terminal de una cancelación nuestra, la terminal que el proveedor canceló tras un cobro rechazado y todavía no está exenta (FASE 9 vuelta 3, owner 2026-09-30, lote U) y la `CANCEL_SCHEDULED` de `S11`, que tienen sus pares al final de esta tabla** (`S26` salió con la revisión del owner, 2026-09-28, C8) | **divergencia real** — el proveedor no puede retroceder a pendiente. Marca |
| `authorized` | `PENDING_AUTHORIZATION` | **`S2`**: espejar es la transición que ya existe |
| `authorized` | `ACTIVE` ✚ | nada: coinciden — es cada renovación normal (FASE 9 completa, C-4, `F-8CB2-010`: la regla de abajo lo marcaba como divergencia) |
| `authorized` | `PAUSED` | **`S10`** —**`S33`** si la fila es de complemento (FASE 9 completa, 4a)— **sólo si la fila tiene una `subscription_pause` cuyo `PUT` se confirmó**: el proveedor reanudó; **si no, es `PAUSA_NO_APLICADA`** (`B/02` §2.5, motivo 22; FASE 9 completa, `F-8CB2-003`) — una pausa que nunca se aplicó no se espeja como reanudación. Espejar — y acá la condición de `S10` ya está cumplida, porque **esta lectura ES la relectura** que la fila pide. **El caso ciego es el contrario**, `paused` contra `PAUSED`: ahí los dos lados coinciden, esta tabla no ve nada y lo levanta la **quinta comprobación de cero llamadas** de `B/09` §3 |
| `authorized` | `GRACE_PERIOD` · `SUSPENDED` | **divergencia real** — el preapproval está vivo y nuestro reloj dice que no cobró. Marca: es el caso que `B/12` §1.4 manda mirar. **Salvo que la fila sea la predecesora de una sucesión en curso —o sea con una sucesora VIVA apuntándola— y tenga un pago pendiente por `S19`**: ahí el cobro **sí** entró y está registrado, y el estado es el que `S19` declara — la premisa de esta fila (*«nuestro reloj dice que no cobró»*) es falsa para esa población, y marcarla sería un incidente sobre el camino normal. La salvedad **está acotada por la ventana**: muerta la sucesora, la fila deja de ser predecesora de una sucesión en curso y vuelve a esta fila con su premisa verdadera |
| `paused` | `PAUSED` ✚ | nada: coinciden — el caso ciego de arriba lo mira la quinta comprobación del `B/09` §3 (FASE 9 completa, C-4) |
| `paused` | `ACTIVE` · `GRACE_PERIOD` | **`S6`**, por su segundo evento: el proveedor pausó por mora y nosotros no lo sabíamos (`DEC-MP-008`). **No es `S8`**: `S8` es la pausa que pide la persona, y leer esta como `CUSTOMER_REQUEST` sacaba al moroso del dunning, le gastaba una pausa que no pidió y lo devolvía a `ACTIVE` sin cobrar (`DEC-MP-003`). |
| `cancelled` | `CANCELLED` · `ABANDONED` · `CHARGE_DECLINED` ✚ | nada: coinciden — la cancelación ya estaba asentada (FASE 9 completa, C-4) |
| `cancelled` | `CANCEL_SCHEDULED` | nada: es lo esperado, `S11` ya lo canceló. El servicio sigue hasta la fecha nuestra (`DEC-SUB-009`) |
| `cancelled` | `SUSPENDED` | nada: es lo esperado, **`S6` ya lo canceló** al suspender (`DEC-SUB-019`). La fila sigue suspendida; volver es una sucesión |
| `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni `SUSPENDED` | **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4); **y la que la persona da desde su cuenta de Mercado Pago cae acá**: no se distingue de la del proveedor (`EX-52`) y corta igual, por decisión del owner, con la pérdida de los días pagados aceptada (mediciones del 2026-09-29, lote L-A) — **y si la fila estaba `PAUSED`, se escribe `fin_real` en su `subscription_pause` con el día de la relectura**, la misma escritura que hacen las otras salidas de `PAUSED` (FASE 9 completa, borde C·espejo de `03` §R4.5, corregido en vez de declarado: sin ella la pausa quedaba abierta y consumía cupo de `DEC-SUB-004`) — **salvo sobre una fila `ACTIVE` sin ningún pago acreditado cuyo primer cobro figura rechazado en la lectura de `B/09` §4: eso es `S16`**, llegue antes el aviso que llegue; con *«todavía no se sabe»* no se actúa en esa corrida (§3.2, *«el primer rechazo lo reclamaban tres filas»*; FASE 8 completa, `F-8CB2-006`) — **y salvo sobre una sucesora en `GRACE_PERIOD` que entró por la rama de la sucesora de `S4`: eso es `S6` por su quinto evento**, no el espejo —suspensión, cancelación de nuestro lado de lo que quede vivo y aviso con *«volvé a suscribirte»*— (owner 2026-09-25; FASE 9 completa, 3c; misma forma que `DEC-MP-008`) — **y salvo sobre una fila en `GRACE_PERIOD` cuyo reloj del §4 ya se agotó: eso es `S6` por su primer evento**, que ya mandó esa cancelación y todavía no escribió. Corre `S6`, llegue antes el aviso que llegue; su correo ya salió una vez (§3.2, precisión 3) y no se repite (FASE 9 vuelta 1, `F-8V1B2-004`) — **y salvo sobre una fila `ACTIVE` cuyo preapproval canceló una transición nuestra que después perdió su escritura**: `S6` (por cualquiera de sus eventos que manda cancelar antes de escribir, también el `paused` leído; FASE 9 vuelta 2, verificación, `N-C-01`, arreglo de texto: `R18` dice *«`S6`/`S3` ya mandaban cancelar»*, sin evento), o `S3`, mandaron la cancelación y, antes de que escribieran, el pago (`S5`) o la autorización (`S2`) llevaron la fila a `ACTIVE`; el §10.3 les hizo releer y no escribieron, pero la llamada ya había salido. **Se reconoce por el correo *«antes de cancelar»* de ese `S6` o ese `S3`** sobre la fila (§3.2, precisión 3), que se encola antes de la llamada. **Eso no es la baja del proveedor: la fila va a `CANCEL_SCHEDULED`**, con `fin_de_servicio` por la fórmula de `S11` —el período que el último cobro acreditado pagó, o el fin del crédito de `DEC-SUB-006`—, **recibe el período que pagó y `S12` la termina**; para seguir, vuelve a suscribirse por el checkout (`B/19` §4 fila 22). Es la respuesta que el owner dio a `S7`, el orden inverso de la misma carrera (`B/05` C1), y a partir de acá el par `cancelled` × `CANCEL_SCHEDULED` es el esperado. Sin cobro acreditado ni crédito, la fórmula da el instante de la relectura y `S12` la encuentra cumplida. **No abre marca**: no hay plata cobrada sin servicio (owner 2026-09-27, FASE 9 vuelta 2, `R18`, `F-8V2B2-001`: el espejo cortaba en el acto a quien acababa de pagar el período). **Y sus complementos los cancela como `S11`**: en el mismo acto corre sobre ellos la regla que `S11` aplica a las filas de complemento (`R1-a`), sin otra selección ni otro fin de servicio que los de esa fila, y esas filas de complemento son una `CANCEL_SCHEDULED` de `S11` en todo lo que el diseño dice de ella —los pares de esta tabla, el reintento de `B/09` §3 y el orden de `S12`— (owner 2026-09-27, FASE 9 vuelta 2, `R18-b`) |
| `authorized` · `paused` · `pending` | una fila **terminal** —`CANCELLED`, `ABANDONED` **o `CHARGE_DECLINED`**— a la que llevó **una transición nuestra que manda cancelar el preapproval**: las **once** de la salvedad 4 de `B/09` §3 (`S12`, `S3`, `S13`, **`S16`**, `S20`, `S22`, `S23`, `S24`, **`S31`**, **`S36`** y **la lápida de recepción** (la del corte salió: FASE 5, simplificación del corte, S-40 y S-70) —la de recepción desde el owner 2026-09-26, `X-1`—; **`S36`** desde la FASE 9 vuelta 1; `S31` desde la FASE 8 completa, owner 2026-09-25; **`S16`**, que llega a `CHARGE_DECLINED`, también, owner 2026-09-25; `S25`, `S27` y `S28` salieron con la revisión del owner, 2026-09-28, C8) y, por la salvedad 1, la suscripción de complemento que `S21` llevó a `CANCELLED` tras la cancelación de `A5`/`A6` | **reintentar la cancelación** —la del barrido, `B/09` §3, con el correo antes y la relectura después—; **la marca, con motivo `CANCELACIÓN_SIN_CONFIRMAR` (`B/02` §2.5), recién a los 3 días de la transición que decidió la cancelación**, y se avisa por `DEC-OBS-001`. **Abierta la marca, el barrido deja de reintentar**, y el correo de antes sale una sola vez por cancelación (§3.2, precisión 3; owner 2026-09-25). **No es divergencia**: la cancelación ya la decidió una transición declarada y sólo falta que la llamada llegue (`DEC-CONC-002` punto 4, su 📌; FASE 8 completa, `F-8CB1-013`, owner 2026-09-25). **Una fila terminal que no está en esa lista no entra en este par** — el espejo de la fila anterior, que no mandó ninguna cancelación, y `S17`, que llega a terminal sólo con la suya ya confirmada por relectura—: un preapproval vivo sobre ella sigue siendo divergencia real, y marca. **Salvo el espejo que siguió a un cobro rechazado, y la de `S16` que llegó sin mandar ninguna llamada: las dos van por el par siguiente**, que cuenta los 3 días desde la relectura y no desde la transición (FASE 9 vuelta 3, owner 2026-09-30, lote U; verificación, VC3-cobro-01) |
| `authorized` · `paused` · `pending` | una fila **terminal cuyo preapproval canceló el proveedor tras un cobro rechazado**, mientras no esté exenta (`B/09` §3: no pasó la ventana de relectura de la cancelación por rechazo, el plazo 16 de `NUCLEO/02` §1.5, con el preapproval releído todavía `cancelled`). Son dos: la `CHARGE_DECLINED` de `S16` que no mandó ninguna llamada porque la relectura ya lo veía `cancelled`, y la `CANCELLED` del espejo cuando la cancelación siguió a un cobro rechazado. La primera vez se la reconoce por `provider_link.cancelado_visto_en` escrito y el plazo 16 sin cumplir (`B/02` §2.2) | **mandar la cancelación que `S16` habría mandado**, sobre las dos: la misma llamada, con el correo antes y la relectura después (la regla de `S17`, §3.2). **Los 3 días se cuentan desde la relectura que la vio viva**, no desde la transición que la llevó a terminal, que acá no decidió ninguna cancelación; si en ese plazo la relectura no la ve `cancelled`, abre la marca `CANCELACIÓN_SIN_CONFIRMAR` (`B/02` §2.5, motivo 16) y avisa por `DEC-OBS-001`, y abierta la marca **el barrido deja de reintentar**. **Desde esa relectura la fila es, en este par, una cancelación nuestra sin confirmar de la salvedad 4** (`B/09` §3): esa relectura vacía `cancelado_visto_en`, así que la fila no queda exenta y el barrido la sigue leyendo, y cada corrida que la ve viva reintenta hasta que la vea `cancelled` o se abra la marca. **`paused` entra igual que `authorized` y `pending`**: los tres vacían la columna y ninguno es un preapproval cancelado. **El correo de antes tiene por ocurrencia la relectura que la vio viva** (§3.2, precisión 3), porque no hay transición que la decida; un reintento mira el que ya existe y no encola otro, y su instante es el que cuenta los 3 días *(lo derivé y lo marco: sin él la cuenta no tenía de dónde salir y no hace falta otra columna)*. **Los cobros que entraron mientras tanto** los cuelga la comparación de cobros con el motivo que la tabla de desempate del `B/05` §3 le da a una terminal, `COBRO_POSTERIOR_A_LA_BAJA` (motivo 2), que ya propone devolver. **No es divergencia**: qué hacer con esta población ya lo decidió el owner (FASE 9 vuelta 3, owner 2026-09-30, lote U; verificación, VC3-cobro-01) |
| `authorized` · `paused` · `pending` ✚ | `CANCEL_SCHEDULED` a la que llevó **`S11`**: manda la cancelación en el acto y deja la fila **viva** hasta `S12` (`S26` salió con la revisión del owner, 2026-09-28, C8) | **el mismo veredicto que el par de arriba**: **reintentar la cancelación** desde el barrido, con el correo antes —el que ya salió no se repite, §3.2 precisión 3— y la relectura después; **la marca `CANCELACIÓN_SIN_CONFIRMAR`, recién a los 3 días de la transición que decidió la cancelación**, y abierta la marca **el barrido deja de reintentar** (owner 2026-09-25; FASE 8 completa, `F-8CB1-013`). **No rompe el par `cancelled` × `CANCEL_SCHEDULED`**, que sigue siendo *«nada: es lo esperado»*: éste es el de la llamada que no llegó. **Y no alcanza a la `CANCEL_SCHEDULED` de `S7`**, que llega ahí justamente porque la relectura ya vio el preapproval `cancelled` (§3.2) — **sí a las filas de complemento que `S7` o el espejo de `R18` llevan a `CANCEL_SCHEDULED` por la regla de `S11`**, que cuentan como de `S11` (owner 2026-09-27, FASE 9 vuelta 2, `R18-b`) |

> **Espejar un estado leído por id es una transición declarada de esta tabla, no un acto aparte.**
> Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta correcta — deja de
> ser un falso positivo y pasa a señalar lo que su nombre dice.
>
> **Y «de esta tabla» incluye el §3.2, con todo lo que eso arrastra.** La fila
> `cancelled` × *«cualquier estado vivo…»* —espejar la baja que decidió el proveedor; era la última
> hasta que `F-8CB1-013` agregó debajo el par de la cancelación nuestra sin confirmar— **saca a una fila principal de las filas vivas**, así que es la
> séptima del dominio que el §3.2 recorre por el lado de la predecesora, la **sexta** de las que
> disparan la re-evaluación del addon huérfano (`B/16` §4.3), un tercer camino por el que la
> predecesora **se muere sola** y `S18` cierra la sucesión sin `S17`, y la **rama 5** de
> `B/12` §5.3. Que no tenga fila numerada en el §3.2 no la saca de ninguno de los cuatro
> lugares: **enumerar el dominio sobre las filas numeradas es el error, no la ausencia de número.**

**Por qué enumerar y no declarar que espejar es una excepción a la regla 1.** La excepción
resolvía el choque en una línea y abría un camino que **escribe estado sin transición declarada**,
que es exactamente lo que la regla 1 existe para impedir. Enumerar cuesta **quince** filas —recontadas sobre la tabla en la FASE 8 completa
(`F-8CB1-013`, owner 2026-09-25): ya eran nueve antes de sumar la de la cancelación nuestra sin
confirmar, diez con ella, y once con la de la misma cancelación sobre una `CANCEL_SCHEDULED`; y
catorce con los tres pares que coinciden, `authorized` × `ACTIVE`, `paused` × `PAUSED` y `cancelled` ×
terminal (FASE 9 completa, C-4, recontadas sobre la tabla); y quince con el de la terminal que el
proveedor canceló tras un rechazo y revivió dentro de la ventana (FASE 9 vuelta 3, owner
2026-09-30, lote U, recontadas sobre la tabla)— y deja
escrito **por qué cada caso cayó donde cayó**.

**Texto de la fuente — «10.2 Los hechos puntuales sí necesitan orden, y lo toman del hecho»** (`B/03-maquinas-de-estado.md:2801–2832`, sin lo tachado):

Un cobro no es un estado: es algo que pasó en un instante, y la relectura del preapproval no lo
refleja campo a campo. Para esos:

- **el orden lo da la fecha del hecho**, nunca la de llegada;
- **se deduplica por el id del hecho**, no por el tipo de evento — está medido que un mismo
  reembolso emite tres notificaciones en dos formatos (`RF-7`);
- **pero el mismo id con OTRO estado no es un duplicado: es el mismo hecho que avanzó.** Los
  reintentos de un ciclo quedan **dentro del mismo registro de cobro** (`B/09` §4, `RC-5`), así que
  el reintento que se aprueba llega con el id que ya tenemos en `PENDING`. El choque con el
  `UNIQUE` no termina ahí: se relee la fila existente y, si la lectura por id dice `approved`,
  corre `P1` sobre ella (§6, `B/05` C6; FASE 8 completa, `F-8CB3-003`);
- **un hecho más viejo que el último aplicado sobre el mismo recurso —el mismo pago, el mismo reembolso— se registra y no se aplica.** Dos recursos distintos de una misma suscripción no se ordenan entre sí (FASE 9 completa, `DB-2`, `F-8CB2-012`: la regla no decía de qué era *«el último»*);
- **un `payment` que la relectura muestra con `operation_type: card_validation` no es un cobro**
  (mediciones del 2026-09-29, punto 4): es la validación de ARS 0 que el proveedor hace al autorizar
  (`PA-3`) y al cambiar la tarjeta (`EX-36`), llega por los dos canales, no trae `external_reference`
  ni nombra al preapproval (su único vínculo es `payer.id`, que no es identidad: `B/02` §2.2), y si
  la tarjeta nueva se rechaza llega `rejected`. **No escribe ningún `payment`, no corre ninguna
  transición y no cuenta como rechazo**: ni el primero de `S16` ni el que arranca el grace por `S4`.
  El cambio de tarjeta que sí importa llega aparte, como aviso del preapproval.

**El aviso de contracargo entra por acá** (FASE 8 completa, `F-8CB3-009`, `DEC-SUB-020`). Según la
documentación del proveedor tiene un aviso propio, **`topic_chargebacks_wh`**, que trae el
`payment_id` (`RC-8`, `UNKNOWN`: documental, no medido). **Es un aviso como cualquier otro**
(§10.1): no se escribe lo que trae, se **relee el pago por id** y, si la lectura dice
`charged_back`, corre `P6`; si dice `reimbursed` sobre un pago en `CHARGED_BACK`, corre `P7` (§6).
**Y no es la única vía**: si el aviso no llega —o no existe como dice la documentación—, lo ve la
comprobación de pagos acreditados del barrido (`B/09` §3), **que relee también los pagos en
`CHARGED_BACK` hasta que su `status_detail` se resuelva** —`settled` o `reimbursed`— (FASE 8
completa, owner 2026-09-25).

**Texto de la fuente — «10.3 La escritura local usa concurrencia optimista»** (`B/03-maquinas-de-estado.md:2833–2838`, sin lo tachado):

Entre la relectura y la escritura puede entrar otra. Cada fila con estado lleva una **versión**,
y una escritura que no coincide **no reintenta a ciegas**: vuelve a leer y reevalúa la
transición contra la tabla. Si la transición ya no corresponde, no se ejecuta.

**Texto de la fuente — «10.4 Lo que esta regla NO cubre»** (`B/03-maquinas-de-estado.md:2839–2848`, sin lo tachado):

**Un cambio que el proveedor acepta y no aplica.** Está medido nueve veces, y el caso más caro es
la mutación de monto: **no emite webhook** (`EX-15`), así que no hay nada que releer porque nada
avisa. La defensa no es esta regla sino la del capítulo 06: **toda mutación se verifica
releyendo y comparando campo por campo cada campo que se mandó**, porque está medido que un
`PUT` con varios campos **se aplica a medias con un solo `200`** (`EX-20`).

**Texto de la fuente — «Lo que esta mitad NO cierra»** (`B/03-maquinas-de-estado.md:2849–3063`, sin lo tachado):

- **`S10` deja volver antes cuando la persona quiera, y eso regala hasta un ciclo: se acepta y se
  declara** (owner 2026-09-26, `G5-3`, contra la recomendación de volver en el aniversario mensual;
  FASE 9 vuelta 1, `F-8V1B1-001`). La premisa de `DEC-SUB-010` —la pausa dura ciclos enteros porque
  se vuelve *«el mismo día del mes en que pausó»*— no vale con la vuelta libre, y con `PS-2`,
  `PS-5` y `PS-6` medidos **toda
  pausa que cruza una fecha de cobro y termina fuera del aniversario, dure lo que dure** (FASE 9
  vuelta 1, `N-2`: con tres meses de pausa y vuelta al segundo día del ciclo son 29 días de regalo)
  **no la cobra**: el proveedor la salteó mientras la fila estaba `paused`, y al volver se cobra en el ciclo
  siguiente. El sobrecobro inverso —pausar el 5 y volver el 25— también queda. **Causa**: el owner
  mantiene *«volver cuando quiera»* del §26.2 a la letra (invariante 24, `NUCLEO/04`). **Ninguna
  transición lo detecta** —nuestro estado y el del proveedor coinciden en cada paso—, así que el
  detector es del barrido: lista esas pausas en el resumen de `DEC-OBS-001` (`NUCLEO/08` §4.1,
  `B/09` §2.3). El costo para el cliente está en `B/12`, *«lo que este capítulo NO cierra»*.
- **CERRADA** por el owner el 2026-09-25 (FASE 8 completa,
  `F-8CB1-013`): **entra en la misma regla de reintento**, con su par propio en el §10.1
  —`authorized`/`paused`/`pending` × `CANCEL_SCHEDULED`— y sin tocar el par `cancelled` ×
  `CANCEL_SCHEDULED`.
- **Cerrado el 2026-09-25**: se mide tiempo
  —3 días desde la transición que decidió la cancelación, 1 día desde el registro de cobro para el
  `B/09` §6, punto 2— (`B/09` §3 punto 2).
-
  **Cerrado el 2026-09-25 (owner)**: la sucesión no lo frena; `S6` corre igual y la sucesora
  también se corta (§3.2, `S6`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- **Cerrado el 2026-09-25
  (owner)**: si la fila da servicio se corta en el acto, si no sólo la marca; la `CANCEL_SCHEDULED`
  pasa a `CANCELLED` ya, por `S12` (§3.2, §6 `P6`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- **Cerrado el
  2026-09-25 (owner)**: mismo tratamiento que sobre `SUCCEEDED` (§6).
- **Cerrado el 2026-09-25 (owner)**: fin de servicio en el acto y
  cancelación del preapproval, como `S24` (§3.2, `S11`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- **Cerrado el 2026-09-25 (owner)**: es **`S31`** (§3.2),
  `ABANDONED` desde `PENDING_AUTHORIZATION` y **`CANCELLED`** desde `ACTIVE`
  (FASE 8 completa, owner 2026-09-25); el saldo diferido se
  cierra con `CONTRACARGO_DE_LA_PREDECESORA` (`B/02` §2.4) y el pago retenido por `S19` se reevalúa
  por la rama 2 de `B/12` §5.3 (FASE 8 completa, pendiente 8, owner 2026-09-25).
- **Cerrado el 2026-09-25 (owner)**: corre
  `S31` sobre su sucesora (§3.2, `S12`; pendiente 8).
- **Cerrado el
  2026-09-25 (owner)**: se corta; `S6` la toma por su tercer evento, la cortesía se cierra y la
  fila pasa a `SUSPENDED` (§3.2, §3.3; pendiente 8). La pausada por `CUSTOMER_REQUEST` sigue con
  sólo la marca.
- **Cerrado el
  2026-09-25 (orquestador, derivado de `DEC-SUB-020`)**: el mismo correo de contracargo (`NUCLEO/07`
  §6; pendiente 8).
- ⚠️ **Lo que `S31` deja abierto** (FASE 8 completa, pendiente 8):
  1. **Cerrado el 2026-09-25 (owner,
     FASE 8 completa)**: desde `ACTIVE`, `S31` lleva a la sucesora a **`CANCELLED`**, no a
     `SUSPENDED`. Deja de ser fila viva, la sucesión se cae como en `S3` —sin `S18`—, la
     reevaluación de la rama 2 encuentra cumplida la condición 3, y la persona vuelve por la
     predecesora `SUSPENDED` con una sucesión desde `SUSPENDED` de tarjeta (`G-R1-A`).
  2. **Cerrado el
     2026-09-25 (owner, FASE 8 completa)**: el barrido; `S31` entra en la salvedad 4 de `B/09` §3,
     que pasa de once a doce filas (y a **trece** con `S16`, FASE 8 completa, owner 2026-09-25).
  3. **Qué aviso recibe la persona por la sucesora cortada.** El de `S3` —*«venció tu plazo»*— no
     aplica; si el correo de contracargo de la predecesora lo cubre no está dicho.
-
  **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: el barrido relee también los pagos en
  `CHARGED_BACK` hasta que su `status_detail` se resuelva —`settled` o `reimbursed`—, y esa
  lectura dispara el correo que corresponde de `NUCLEO/07` §6 (`B/09` §3).
- **Cerrado el 2026-09-25 (FASE 9 completa,
  contradicción 2 de `03` §R6.5)**: `S31` entra en las dos enumeraciones de `B/16` §4.3 —la
  lista pasa de doce a trece— y `A5` remite a esa lista en vez de copiarla (§8).
- **Los seis cruces del §52** son `E-CONC-01`, del capítulo 05. Acá quedan nombrados **uno** —el
  pago manual simultáneo al del proveedor — sin resolverlos. **El
  cambio de plan en grace ya no es un cruce: no existe** desde `DEC-SUB-021` (owner 2026-09-25).
- **Cerrado el 2026-09-25 (owner,
  FASE 8 completa)**: antes de aceptar el cambio de plan de un pagador con tarjeta, `S1` relee por
  id el preapproval de la predecesora `ACTIVE` y exige `authorized`; si no lo está, el cambio no se
  ofrece —*«tu último cobro no entró, actualizá tu tarjeta»*, el camino de `DEC-SUB-021`— y la
  relectura corre la transición que corresponda por el §10.1, que sobre `paused` es `S6` por su
  segundo evento (§3.2, `S1` y `S6`; `B/20` §2, `G-R1-A`; `B/19` §4 fila 17-ter).
- **CERRADA** por `DEC-SUB-014` (owner,
  2026-09-21): corta en el acto, con la fecha de fin de servicio en el día de la cancelación, y
  la ejecuta **`S24`** (§3.2). De las dos respuestas posibles que este § declaraba abiertas
  —cortar hoy o dejar correr el reloj del grace— el owner eligió la primera, por el criterio que
  ya gobierna `S22` y `S23`: *«no queda período pagado que sostener»*.
-
  **CERRADA LA MITAD DEL CHOQUE**, por `DEC-SUB-015` (owner, 2026-09-21), y **no dándole a la
  pausada la fila que le faltaba sino sacándola del acto**: la pausada **no entra al piso**, se
  queda `PAUSED` sobre una vertical que ya tiene fecha de cierre —eso es legal y está escrito en
  `B/10` §4.3—, se le avisa **el día del anuncio** (`NUCLEO/07` §6, `B/19` §4 fila 14-bis) y su
  fila termina cuando la pausa termina, por **`S25`** (§3.2). **El §3.3 no cede**: sigue sin
  existir `PAUSED → CANCEL_SCHEDULED`, y la contradicción se resolvió corrigiendo la instrucción
  que lo pedía, no la prohibición.
- **CERRADA** por la FASE 9-bis-5 (defecto `F3` del
  censo), y **no era una pregunta al owner**: `B/10` §4.3 ordena el movimiento, `S11` no lo ejecuta
  —su evento es *«pide la baja»*, un acto del cliente sobre su propia fila, y esto lo decide
  `SUPER_ADMIN` sobre la cartera entera de una vertical— y lo único que faltaba eran las filas.
  **Son tres y no una** —`S26`, `S27` y `S28` (§3.2)—, porque el destino cambia con lo que cada
  estado emite: `ACTIVE` y `GRACE_PERIOD` al piso de `CANCEL_SCHEDULED`, `SUSPENDED` a `CANCELLED`
  y `PENDING_AUTHORIZATION` a `ABANDONED`. **`DEC-SUB-015` no resolvió esto y no pretendía
  hacerlo**: resolvió a quién alcanza el piso, no qué transición lo ejecuta.
- **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): las dos entradas de arriba
  quedan como historia, porque **el acto ya no existe**. `S25`–`S28` están retiradas en la tabla del
  §3.2 con su número, y discontinuar una vertical queda **fuera de esta versión; si algún día hace
  falta, se diseña entonces** (`B/10` §4). Retirar todos los planes de una vertical sigue siendo
  posible y no mueve ninguna fila de esta máquina (`B/10` §3.6).
- **Un cobro en vuelo que se acredita después de un `S6` por contracargo** entra por `S7` a
  `CANCEL_SCHEDULED` y devuelve servicio hasta el fin de ese período (FASE 9 completa, borde R3-c;
  declarado por `DEC-METH-015`). **Causa**: `S7` se escribió para el borde del impago, y sus
  condiciones no miran por qué evento corrió `S6`. Tiene que coincidir un reintento en vuelo con
  un contracargo sobre la misma fila, y la marca `CONTRACARGO` ya abierta pone a una persona
  delante.
- **`S6` y `S17` no tienen plazo en la rama transitoria del correo** (FASE 9 completa, borde 1 de
  §R5.5.2 de `04`; declarado por `DEC-METH-015`). Reintentan su propia transición en cada corrida
  y, mientras el correo no sale, el moroso conserva el servicio (`S6`) o la predecesora sigue
  cobrando (`S17`, ya dicho en `B/12` §5.4). **Causa**: el plazo de 3 días se escribió para las
  filas que el barrido reintenta (`B/09` §3), y estas dos no son de ese grupo. Es de borde mientras
  la falla sea transitoria de verdad: la que no pasa —el correo que agota sus reintentos— ya no
  bloquea desde la decisión 1 del owner (2026-09-25; §3.2, *«el correo antes de cancelar»*,
  tercera rama), así que la cota es la de los reintentos del outbox.
- **Un contracargo sobre una predecesora `SUSPENDED` no corta a su sucesora** (FASE 9 completa,
  borde 3 de §R7.5.2 de `04`; declarado por `DEC-METH-015`). `S31` corre sólo detrás de `S6` o
  `S12`, y desde `SUSPENDED` ninguno de los dos corre: la regla del 📌 de `DEC-SUB-020` —*«si la
  fila da servicio, se corta; si no, sólo la marca»*— se aplicó a la fila y no a su sucesión.
  **Causa**: la sucesión desde `SUSPENDED` (`G-R1-A`) y el corte de la sucesora (`S31`) se
  escribieron en pasadas distintas. La marca `CONTRACARGO` queda abierta y la persona que la sigue
  ve la sucesora.
- **El grace de una sucesora que nunca cobró puede correr hasta un día sobre un preapproval que el
  proveedor ya canceló** (FASE 9 completa, 3c; declarado por `DEC-METH-015`). Desde la decisión 3c
  del owner, la sucesora cuya predecesora venía pagando va a `S4` y no a `S16` (§3.2), y si el
  proveedor canceló el preapproval al rechazar el primer cobro (`PA-6`, `UNKNOWN`: medido sólo ante
  el antifraude), ese grace no puede terminar en pago. **El control es el barrido diario**, que
  relee el preapproval por id y corre `S6` en el acto sobre `cancelled` o `paused`; entre el
  rechazo y esa corrida la persona tiene servicio sin cobrar. **Causa**: el owner eligió no dejar
  sin nada a quien venía pagando, contra la recomendación, sobre una fila `UNKNOWN`. Cuando `PA-6`
  se mida, se revisa.
- **`S6` por su segundo o su tercer evento que muere entre la llamada y la escritura** (FASE 9
  vuelta 1, `F-8V1B2-004`; declarado por `DEC-METH-015`). El espejo del §10.1 lleva la fila a
  `CANCELLED` en vez de `SUSPENDED`, sin el aviso de suspensión. **Causa**: esos dos eventos —la
  pausa del proveedor y el contracargo— no dejan en nuestra base un dato que el par pueda leer
  antes de que `S6` escriba; el primero sí —el reloj agotado—, y por eso tiene su salvedad en el
  par. No mueve plata: el preapproval ya está cancelado. En el caso del contracargo sobre una
  predecesora, la sucesora sobrevive con la marca `CONTRACARGO` abierta, que es su detector.
- **El espejo reconoce una cancelación nuestra por el correo «antes de cancelar», no por la
  llamada** (FASE 9 vuelta 3, `F-8V3B2-004`; declarado por `DEC-METH-015`, residuo del arreglo
  `R18` de la vuelta 2). Falla en las dos direcciones: el correo de un `S6` que releyó el pago y
  no llamó sigue ahí meses después, y una baja que la persona da desde su cuenta de Mercado Pago
  recibe `CANCEL_SCHEDULED` en vez del corte (regala el período ya pagado); y sobre un
  destinatario suprimido (`NUCLEO/07` §4.2, rebote duro) `S6` cancela sin correo, así que si además
  perdió su escritura frente a `S5`, el espejo corta en el acto a quien acababa de pagar.
  **Causa**: la llamada de cancelación no deja en nuestra base un registro persistido antes de
  salir, y agregarlo es un mecanismo que ninguna decisión pidió. Las dos ramas exigen una carrera
  y otra condición (una baja desde la cuenta meses después, o un rebote duro con la escritura
  perdida); la primera no mueve plata y la segunda la ve la persona que reclama con su cobro.
- **La segunda transferencia del mismo período, y la
  que llega sobre una fila `CANCELLED`, se asientan por `MP6`** (FASE 9 vuelta 3, owner 2026-09-30, lote W): un segundo pago del
  período que abre `COBRO_DUPLICADO` con propuesta de devolver (§7), **o, sobre una `CANCELLED`
  cuya última cuota quedó `DECLARED_UNPAID`, un cobro posterior a la baja que abre
  `COBRO_POSTERIOR_A_LA_BAJA`, también con propuesta de devolver** (FASE 9 vuelta 3, owner
  2026-09-30, lote AF), **y lo mismo sobre una `ABANDONED` de pagador manual con la primera cuota
  `DECLARED_UNPAID`** (FASE 9 vuelta 3, owner 2026-09-30, lote AM). **Lo que queda, declarado por
  `DEC-METH-015`**: la transferencia que llega **de más** dentro de una cuota abierta no se ve,
  porque la fila de `manual_payment` no guarda monto y el admin registra la cuota con `MP1`; la
  diferencia la devuelve por fuera, sin rastro. **Causa**: el monto no se guarda a propósito
  (`B/02` §2.3). No da acceso ni borra, y la plata la ve la persona que reclama con su comprobante.
  **Lo mismo con la transferencia sobre una suscripción que nunca tuvo un cobro acreditado ni una
  cuota**: `MP6` no tiene período con qué chocar y no corre, así que también se devuelve por fuera.
  Exige una transferencia a una suscripción que nunca llegó a cobrar.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:151, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:837, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:21, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:46, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:285, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:377, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:886, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1016, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1520, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1589, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1656, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2689, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2714, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2748, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2801, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2833, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2839, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2849

<a id="trans-b-s2"></a>

### `TRANS:B:S2` · `S2` — `PENDING_AUTHORIZATION` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:838`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S2](10-corte/B3.md#tpz-s2) → [B3](10-corte/B3.md#pieza-b3) — nota de la fuente: «con la cláusula que cancela el Turista VIP heredado (BP)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING_AUTHORIZATION`
- **evento** (disparador): webhook de autorizada, confirmado por relectura
- **hacia** (estado destino): `ACTIVE`
- **condición** (guardas): —
- **efectos** (efectos): arranca el período; la fila **pasa a emitir fuente** (`12-contrato…` §2.6) **con `cobrada: no`, así que todavía no mueve el trial: lo mueve el primer pago acreditado de la fila, que pasa `cobrada` a `sí` y lleva su propio aviso** (`12-contrato…` §2.1 y §3; `V/03` §2, `T2`; `DEC-TRIAL-010`, owner 2026-09-25) — esta tabla **no dispara** una transición de la otra épica (sale con `S25`: revisión del owner, 2026-09-28, C8): sobre un plan que no es mensual no hay cortesía temporal (la regla es *«sólo mensual»*, `B/14` §4.7; FASE 9 completa, contradicción 1 de `03` §R4.5: el cierre decía *«anual»* y dejaba pasar el trimestral y el semestral), y la persona lo supo en el checkout (`B/19` §4 fila 13-quater) (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25); **y si el `user` paga una suscripción de Turista VIP y el plan que pasa a `ACTIVE` lo hereda, la cancela en el mismo acto, sin reembolso, con el correo antes**: es acá y no en `S1`, porque recién ahora el plan da el beneficio y el servicio no se interrumpe; si la ventana vence (`S3`), el VIP sigue (`DEC-ENT-004`; corte del MVP, owner 2026-10-02, BP; construye `B3`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:152, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:838

<a id="trans-b-s3"></a>

### `TRANS:B:S3` · `S3` — `PENDING_AUTHORIZATION` → `ABANDONED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:839`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S3](10-corte/B3.md#tpz-s3) → [B3](10-corte/B3.md#pieza-b3)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING_AUTHORIZATION`
- **evento** (disparador): vence la ventana
- **hacia** (estado destino): `ABANDONED`
- **condición** (guardas): **venció la ventana de autorización de esa fila, y no es una sola: son DOS plazos según el método de pago** — **72 h** para el pagador con tarjeta y **7 días corridos** para el pagador manual (`DEC-SUB-016`, §3.4 punto 1). La condición se lee **sobre el método de la fila**, nunca contra una cifra global. **Y, en un pagador con tarjeta, que la relectura del preapproval por id no lo vea `authorized`**: si lo ve, la persona autorizó mientras vencía el plazo y el webhook todavía no llegó, así que **`S3` no ocurre** y lo que corre es `S2`, por la tabla del §10.1. Nuestro reloj no decide solo sobre un estado que es del proveedor
- **efectos** (efectos): se cancela el preapproval en el proveedor **con la regla de relectura de `S17`** —si la relectura ya lo ve `cancelled`, no se manda nada—, **y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala; un pagador manual no tiene preapproval, y esta parte no le corre (`B/06` §7); la fila se conserva —**con su `sucede_a` puesto, si era una sucesora**, porque es el registro fiel y porque ningún predicado lo lee sin exigir que la fila esté viva—. **Y si la predecesora retenía un pago pendiente por `S19`, se reevalúa en el acto**: es la rama 2 de `B/12` §5.3 y el que hace que *«el tope es la ventana»* sea una condición y no una intención. **Y si la fila era de un pagador manual, su primera cuota —abierta acá y nunca registrada— se cierra en el mismo acto**, por la segunda cláusula de `MP3` (§7): sin eso quedaría un `AWAITING` colgando de una suscripción muerta. **Y si esta fila era la SUCESORA de una sucesión y la predecesora tenía una cortesía que `S18` DIFIRIÓ, el saldo se cierra acá**: se le escriben `saldo_cerrado_en` y `motivo_cierre = VENTANA_DE_AUTORIZACIÓN_VENCIDA` (`B/02` §2.4), con lo que la cortesía deja de ser *«diferida»* (`NUCLEO/01` §2.6) y **`S9` no la puede re-emitir nunca más** — quien vuelva a suscribirse **no recupera esos meses** (`DEC-GRANT-011`; el saldo es en meses desde la FASE 8 completa, `F-8CB1-001`). **Se le avisa en el mismo correo que le dice que la ventana venció** (`B/19` §4 fila 18, `NUCLEO/07` §6)

**Texto de la fuente — «El saldo de una cortesía que nadie completó se CIERRA en `S3`»** (`B/03-maquinas-de-estado.md:568–693`, sin lo tachado):

**`S18` deja la cortesía esperando y `S9` la re-emite cuando la sucesora llega a `ACTIVE`
(`DEC-GRANT-007`) — pero desde `PENDING_AUTHORIZATION` hay DOS salidas y la segunda no lleva a
`ACTIVE`.** `S3` manda la sucesora a `ABANDONED`, que es terminal, y ahí queda un `courtesy_grant`
con `saldo_meses` y **ninguna fila viva en esa vertical a la que volver**. `DEC-GRANT-011` decidió
el desenlace: **el saldo se cierra en el mismo acto**, con `saldo_cerrado_en` y su `motivo_cierre`
(`B/02` §2.4), y **quien vuelva a suscribirse no recupera esos meses** (el saldo es
en meses: FASE 8 completa, `F-8CB1-001`, owner 2026-09-25). **Y desde la pendiente 8 hay otra
salida que tampoco lleva a `ACTIVE` y cierra el saldo**: **`S31`**, cuando un contracargo corta a la
predecesora, con `motivo_cierre = CONTRACARGO_DE_LA_PREDECESORA` (FASE 8 completa, pendiente 8,
owner 2026-09-25).

**Es el criterio que el programa viene aplicando, leído sobre este caso**: la persona **no puso
plata** y el acto que corta es **suyo** —abandonar el checkout—, así que se declara y no se repara.
Es el mismo desenlace que `DEC-TRIAL-009` (*«revocar un grant no devuelve el trial»*) y por las
mismas razones. **Lo que cuesta va dicho**: el abandono puede ser un error —una pestaña que se
cierra— y no una decisión, y quien firmó la cortesía **puede volver a otorgarla**, que es un acto
que ya existe —el **primer** disparador de `S9`— y no necesita mecanismo nuevo.

(El saldo
que difería `S25` salió con la revisión del owner, 2026-09-28, C8: ya no hay un segundo saldo.)

**Las cinco escrituras de `S18` no corren todas por todos los caminos, y las dos últimas son las
que se reparten.** Las tres primeras —`sucedida_por`, limpiar `sucede_a` y el re-apunte de las
**dos** entidades re-apuntables— corren **siempre**. Las otras dos tienen dominio propio:

| escritura | por qué caminos corre | por qué |
|---|---|---|
| **4 · la cortesía se DIFIERE** (`saldo_meses`, `DEC-GRANT-007`) | el cierre normal con `S17`, y **el espejo** del §10.1 | una cortesía vigente deja la fila en `PAUSED` (`S9`), y `PAUSED` está entre los cinco `desde` de `S17` y entre los vivos del espejo. **No corre por `S12`** (`desde: CANCEL_SCHEDULED`) **ni por `S16`** (`desde: ACTIVE`), que son otros conjuntos; **ni por `S22`**, que sale de `PAUSED` pero **termina** la cortesía en vez de diferirla —la persona pidió irse, que es la elección de `DEC-GRANT-004` (1)—; **ni por `S36` desde `PAUSED`**, que la termina igual que `S22`: la persona revocó (owner 2026-09-26, `X-2`); **ni por `S23`, ni por `S24`**, porque ni una `SUSPENDED` ni una `GRACE_PERIOD` tienen cortesía vigente —una cortesía deja la fila en `PAUSED`— |
| **5 · la marca `REEMBOLSO_POR_CONFIRMAR`** sobre un pago pendiente por `S19` | **el espejo** (rama 5), **`S23` y `S24`** (las dos filas de la rama 6) —; **`S36` desde `GRACE_PERIOD` está en la rama 6 y no corre esta escritura**: el pago retenido lo devuelve su `RF1` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-o`)— y el cierre normal con `S17` (rama 1) | `S19` sólo existe sobre una predecesora en `GRACE_PERIOD` o `SUSPENDED`. **No puede aplicar por `S12` ni por `S16`**, y es aritmética de los `desde`: **ninguna fila puede estar en los dos conjuntos** |

> **Por el espejo del §10.1 corren las cinco, y hay que decirlo porque la versión
> anterior de este párrafo afirmaba lo contrario sobre un dominio de dos.** El `desde` del espejo
> es *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»*, o sea que **incluye `GRACE_PERIOD`,
> `SUSPENDED` y `PAUSED`**: los dos primeros son exactamente la población de `S19` —y no por
> casualidad: la baja que decide
> el proveedor llega **por mora acumulada** (`B/12` §1.4), así que la predecesora que la recibe es
> justamente la que venía en grace— y el tercero es el de la cortesía. El pago pendiente se
> resuelve por la **rama 5** de `B/12` §5.3 — la misma marca y el
> mismo motivo de la rama 1, con otro acto adelante. El enunciado *«la cuarta
> no puede aplicar cuando la predecesora se murió sola»* era verdadero sobre los dos caminos que
> entonces existían y es **falso sobre el tercero**.
>
> **Y la frase que decía que la cortesía *«tampoco puede coexistir con estos dos caminos»* era
> falsa por el mismo lado.** Se apoyaba en `B/14` §4.4, que enumeraba **dos** caminos de `S18` sin
> `S17` cuando ya eran tres, y de ahí concluía que *«no hay caso en que haya que pausar un
> preapproval que todavía no autorizó»*. El espejo sale de `PAUSED` y `S17` también, así que el
> caso existe por **dos** puertas, no por una. Es el defecto que `DEC-GRANT-007` cierra, y la
> corrección entera está en `B/14` §4.4.

Con eso, el dominio queda recorrido en los dos ejes y la relación tiene **cuatro** estados, no
dos ni tres. El tercero es el que la versión anterior de este § agregó; **el cuarto es el que ella
misma dejaba afuera**, y es el único en que la columna `sucede_a` sobrevive a la sucesión:

| estado de la relación | cómo se lee | qué candado ocupa |
|---|---|---|
| **no hay sucesión** | `sucede_a` nulo y `sucedida_por` nulo | `A` la fila, `B` libre |
| **sucesión en curso** | una **fila viva** con `sucede_a` no nulo — la sucesora | `A` la predecesora, `B` la sucesora |
| **sucesión terminada** | la predecesora con `sucedida_por` no nulo, la sucesora con `sucede_a` nulo | `A` la sucesora, `B` libre |
| **sucesión muerta sin cerrarse** | una fila **no viva** con `sucede_a` no nulo, y la predecesora sin `sucedida_por` — la sucesora venció su ventana (`S3`) o la mató `S13` (revisión del owner, 2026-09-28, C8) | **ninguno de los dos**: los dos índices son parciales sobre los vivos, así que `B` queda libre y la persona puede volver a intentar el cambio de plan |

**El cuarto es por qué los predicados dicen «sucesora VIVA» y no «sucesora».** El puntero se
conserva a propósito —`S13` lo declara: *«la sucesora queda `CANCELLED` con su `sucede_a` escrito,
que es el registro fiel de lo que pasó»*— y nadie lo limpia, así que un predicado que sólo
pregunte *«¿hay una fila con `sucede_a` apuntándome?»* contesta **que sí para siempre**. Sobre
`S19`, `S5`, `S6` y `S7` eso congelaba la fila en `GRACE_PERIOD` con el reloj apagado y el pago
retenido de por vida. **La condición es sobre un estado, así que se vuelve a evaluar** — es la
misma lectura, y por la misma razón, que `B/16` §4.2 ya hacía para el addon huérfano. El
inventario completo de los predicados que leen el término está en `NUCLEO/01` §2.4.

**Son dos filas y un solo acto, y el acto que no puede faltar es `S18`.** Partirlas es lo que hace
que el cierre sea alcanzable —`S18` no depende de que `S17` tenga sujeto—, y la asimetría entre
las dos mitades es real, no retórica:

- **`S17` sin `S18` es siempre un defecto**: deja el candado `A` **vacío** y un alta nueva entra
  sin que nada la rechace. Lo vigila `G-R1-C` (`B/20` §2).
- **`S18` sin `S17` es lo CORRECTO en los SIETE caminos por
  los que la predecesora se muere sola —`S12`, `S16`, el espejo del §10.1, `S22`, `S23`, `S24` y
  `S36`—**, y en ninguno de los siete deja viva una autorización (FASE 9 vuelta 1, M: el párrafo
  contaba cinco y omitía a `S24`, que su fila ya nombraba, y a `S36`, que entró hoy): en `S22`,
  `S23`, `S24` y `S36` el preapproval **lo cancela el propio acto**, con la regla de relectura de
  `S17` (sus filas; desde `CANCEL_SCHEDULED`, `S36` lo relee ya cancelado por `S11`); en `S12` el preapproval de la predecesora lo canceló `S11`
  *«de inmediato»* (`DEC-SUB-009`), en `S16` **lo cancela el propio `S16`**, con relectura y
  con el reintento del barrido si la llamada falla —ante el antifraude ya lo había cancelado el
  proveedor en el mismo milisegundo del rechazo (`B/12` §4.4) y no se manda nada— (FASE 8 completa,
  owner 2026-09-25), y en el espejo **lo canceló el proveedor por su
  cuenta**, que es el hecho que el espejo copia.
  (`S27` salió con la revisión del owner, 2026-09-28, C8.)
  En `S13` no corre ninguna de las dos y tampoco queda autorización viva, porque el efecto del
  propio `S13` cancela el preapproval de **cada** fila que alcanza. Prohibir la combinación —*«o
  corren las dos o no corre ninguna»*, que es lo que este § decía— bloqueaba `S18` justo en los
  dos casos que dejan el candado `A` vacío, y su advertencia (*«`S18` sin `S17` deja viva una
  autorización que el `D7` manda cancelar»*) es falsa en los siete (FASE 9 vuelta 1, M).

**Y el disparador de las dos es un ESTADO, no una entrega.** *«Su sucesora quedó autorizada,
confirmado por relectura»* se puede volver a evaluar mañana; *«llegó el webhook»* no, porque un
webhook no se vuelve a emitir. Es lo que hace que la salida que `S15` promete —*«se ejecuta la
transición de esta misma tabla que lo permita»*— exista de verdad para una sucesión trabada.

**La única rama en la que la sucesión NO se cierra es que la cancelación en el proveedor falle
sobre un preapproval que la relectura vio vivo.** Ahí `S17` no ocurre, `S18` tampoco —su condición
no se cumple—, la marca se pone y una persona lo mira. **Y es lo correcto, no un hueco**: en esa
rama hay de verdad dos autorizaciones que pueden cobrar, y limpiar `sucede_a` ahí sería, además de
mentira, **imposible** — la sucesora pasaría a competir por el candado `A` con una predecesora que
lo sigue ocupando, y la base rechaza la escritura. Lo que la rama le cuesta a la cobertura está
escrito en `12-contrato-de-cobertura.md` §2.6.

**Lo que ya NO es esa rama, y antes lo era**: un preapproval que la relectura encuentra ya
`cancelled` —el arrepentimiento del §3.3, donde `S11` lo canceló *«de inmediato»*— no es una
cancelación fallida. `PA-5` mide que re-cancelar da `400`, así que mandarlo otra vez convertía el
camino normal en un incidente garantizado. `D7` pide que la vieja **no se cancele antes**; sobre
una ya cancelada por decisión de la persona, `D7` está cumplido y no hay nada que mandar.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:153, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:839, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:568

<a id="trans-b-s4"></a>

### `TRANS:B:S4` · `S4` — `ACTIVE` → `GRACE_PERIOD`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:840`
- **Adjudicación** (`adjudicacion.json`): VIVO — reemplazo explícito; lo tachado de la fila se omite y lo vigente va entero.
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S4](10-corte/B7.md#tpz-s4) → [B7](10-corte/B7.md#pieza-b7)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`
- **evento** (disparador): un cobro falla — **y en un pagador manual eso es que `MP5` abrió la cuota del período y no hay pago acreditado contra ella** (§7.2): no hay débito que rebote, así que el evento se lee sobre la cuota y no sobre el proveedor. **Sobre la PRIMERA cuota de un pagador manual no corre**, y no hace falta una condición nueva para eso: esa cuota se abre en `PENDING_AUTHORIZATION` y el `desde` de esta fila es `ACTIVE` (§7.2, *«cómo entra el grace»*). **En un pagador con tarjeta, el evento lo trae el aviso del rechazo releído por id, o el barrido: si su lectura (`B/09` §4) da *«intentó y se rechazó»* sobre el período en curso de una fila `ACTIVE` con al menos un pago acreditado, corre esta fila** —es el aviso del primer rechazo que se perdió entero (`WH-5`)— (`B/09` §3, fila *«cobros del período»*; `B/12` §1.2; owner 2026-09-25, FASE 9 completa, 9a)
- **hacia** (estado destino): `GRACE_PERIOD`
- **condición** (guardas): **la fila tiene al menos un pago acreditado** (`B/09` §4; en un pagador manual lo cumple toda fila `ACTIVE`, porque `S29` sólo llega ahí con la primera cuota registrada) — **o es la sucesora de una predecesora que venía pagando** —la sucesión se declaró desde `ACTIVE` o `CANCEL_SCHEDULED`, no desde `SUSPENDED`, y la predecesora tiene al menos un pago acreditado; se lee por el `sucede_a` de esta fila o, cerrada ya la sucesión por `S18`, por el `sucedida_por` de la predecesora—, **y éste es su primer cobro** (owner 2026-09-25; FASE 9 completa, 3c, **contra la recomendación**: que quien venía pagando no quede sin nada por el primer cobro fallido del plan nuevo). **Sobre una autorización sin ningún pago acreditado y sin esa predecesora manda `S16`**, no esta fila (abajo, *«el primer rechazo lo reclamaban tres filas»*; FASE 8 completa, `F-8CB2-006`, `F-8CB1-010`)
- **efectos** (efectos): arranca el reloj del §4; el servicio **sigue entero** (§20). **Y si entró por la rama de la sucesora**, el barrido relee su preapproval por id en cada corrida diaria (`D17`, `B/09` §3): si el proveedor lo **canceló** o lo **pausó**, el grace termina en el acto por `S6` (su segundo evento sobre `paused`, o el quinto sobre `cancelled`) —un grace sobre una autorización que ya no puede cobrar es el que `PA-6` teme—, **con la misma forma que `DEC-MP-008`**. Así el riesgo de `PA-6` queda acotado a un día

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:154, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:840

<a id="trans-b-s5"></a>

### `TRANS:B:S5` · `S5` — `GRACE_PERIOD` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:841`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S5](10-corte/B7.md#tpz-s5) → [B7](10-corte/B7.md#pieza-b7)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `GRACE_PERIOD`
- **evento** (disparador): entra el pago, **o se reevalúa uno que quedó pendiente** por `S19`
- **hacia** (estado destino): `ACTIVE`
- **condición** (guardas): las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso**
- **efectos** (efectos): se apaga el reloj. **Y cuando corre porque la relectura de `S6` mostró que el período cobró, asienta ese cobro en el mismo acto**: lo lee por id (`D17`) y corre `P1` sobre él (§6), **creando la fila de `payment` si no existe**; **si no puede asentarlo, `S5` no ocurre en esa corrida**. El aviso del cobro que llegue después lo descarta la deduplicación de `C6` (`B/05` §2), porque encuentra la fila ya `SUCCEEDED` (FASE 8 completa, pendiente 6, owner 2026-09-25)

**Texto de la fuente — «3. Qué hace seguro a un pago tardío · cierra `M-CONC-03`»** (`B/05-idempotencia-y-concurrencia.md:306–543`, sin lo tachado):

El §22 pide evaluar *«timestamp real, payment status, subscription, posible nueva subscription,
posibles dobles cobros»* y dice *«Si es seguro: reactivar. Si existe ambigüedad:
`RECONCILIATION_REQUIRED`»*. Nunca define qué es seguro — y si el criterio queda implícito, cada
implementación traza la línea en otro lado.

**Un pago tardío es seguro de reactivar si y sólo si se cumplen las cuatro:**

| # | condición | qué pasa si no se cumple |
|---|---|---|
| 1 | la suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED` | en **cualquier otro estado** el pago no la reactiva. Adónde va lo dice la tabla de desempate de abajo, que clasifica los nueve estados y la lápida de recepción. **Este § no corre sobre una fila que puede recibir el cobro** (lista de abajo) (FASE 9 vuelta 1, R4; la lápida del corte y su ventana salieron: FASE 5, simplificación del corte, S-40, S-41 y S-70) |
| 2 | el monto coincide con el esperado para el período que cubre | un monto distinto puede ser otro cobro, un cambio de precio no propagado, o un error |
| 3 | **no hay otra fila viva principal del mismo `user + vertical`** —las **seis** de `B/02` §2.2, `PENDING_AUTHORIZATION` **incluido**—, **ni esta fila fue superada por una sucesora que ya autorizó** — o sea `sucedida_por` **no** nulo (la sucesión se cerró), o una **sucesora viva** con `sucede_a` apuntándola que **ya autorizó** por `S2` (la sucesión quedó trabada con la marca puesta) | si la hay, el pago es de una suscripción superada —o de una que está por superarla— y reactivar le daría **dos** |
| 4 | no hay otro pago acreditado para el mismo período | si lo hay, es un doble cobro |

**Y desde `DEC-SUB-019`, la mitad `SUSPENDED` de la condición 1 ya no la alcanza un webhook
ordinario del proveedor en un pagador con tarjeta**: `S6` canceló el preapproval al suspender, así
que lo que puede llegar ahí es sólo un borde —un cobro que ya estaba en vuelo en el instante de
`S6`, o un preapproval reactivado a mano—. El pago manual (`MP4`) sigue alcanzando esa mitad, pero
es la puerta del **pagador manual**, que no tiene preapproval. Las condiciones no
cambian; cambia por dónde puede seguir llegando el pago que las tiene que cumplir.

**Si las cuatro se cumplen**, entra `GRACE_PERIOD → ACTIVE` (`S5`) o `SUSPENDED → ACTIVE` (`S7`)
—**o `SUSPENDED → CANCEL_SCHEDULED` por `S7` si el preapproval ya está cancelado** (`C1`, `B/03`
§3.2; FASE 9 completa, C7)—, según en cuál de los dos estados de la condición 1 esté la fila, y
**por `S7`** la fila vuelve a emitir fuente —`GRACE_PERIOD` no había dejado de emitir (`12-contrato…`
§2.6)—, y la publicación la restituyen `PB3`/`PB7` si el cupo alcanza (`V/03`
§9; FASE 8 completa, `F-8CA2-016`, owner 2026-09-25).
**Si falla cualquiera**, se pone la marca `requiere_conciliación` con motivo `PAGO_TARDÍO_RECHAZADO`
(cap. 03 §3.2, `S14`; `B/02` §2.5) —**salvo el caso que el §2 ya nombra con otro motivo, y la regla
de desempate está abajo**— y el evento
crítico dice **cuál** falló — sin eso, la persona que lo mire tiene que rehacer el diagnóstico
entero. **Cuál de las cuatro condiciones falló va en el evento y no en el motivo**: el motivo es lo
que separa este caso de los otros veintitrés motivos en el listado (recontado sobre `B/02` §2.5 en la FASE 9 completa, y otra vez en la FASE 9 vuelta 2, con el 23 y el 24), y el diagnóstico fino ya tiene su lugar
declarado en `NUCLEO/08` §4.3.

**Y un mismo pago tardío cae bajo ESTE § y bajo el §2, así que hace falta decir cuál motivo gana.**
No es una hipótesis: los tres bullets de `C2` describen un cobro que entra sobre una fila que `S22`,
`S23` o `S24` llevaron a `CANCELLED`, razonan *«la condición 1 del §3 rechaza `CANCELLED`»* y
concluyen **`COBRO_POSTERIOR_A_LA_BAJA`**; este § dice *«si falla cualquiera»* →
**`PAGO_TARDÍO_RECHAZADO`**. Son **dos motivos distintos para el mismo hecho, escritos en el mismo
capítulo**, y hasta acá nada elegía entre ellos: `G-R1-F` sólo exige que el motivo esté en la tabla
(`B/20` §2), y los dos están.

**La regla: gana el motivo que nombra POR QUÉ la fila no puede recibir el pago, no el que nombra
que el pago llegó tarde.**

| qué pasó | motivo |
|---|---|
| **una terminal cuyo preapproval canceló un acto nuestro o del cliente, o el proveedor**, salvo un *Free Forever*: `CANCELLED` por `S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S31`, **`S36`** o el espejo del `B/03` §10.1 (**`S36`**, FASE 9 vuelta 1, `N-G3V-04`: el criterio ya la cubría y la enumeración no); `ABANDONED` por `S3` o `S31`; `CHARGE_DECLINED` por `S16`. **Y una `CANCEL_SCHEDULED` —de `S7` o `S11` — con el cobro posterior a la cancelación** (FASE 9 vuelta 1, R4: la lista enumeraba transiciones a `CANCELLED` y dejaba en el comodín a `ABANDONED`; `S25`, `S27`, `S28` y `S26` salieron con la revisión del owner, 2026-09-28, C8, a `CHARGE_DECLINED` y a toda fila que no nace de una transición) | **`COBRO_POSTERIOR_A_LA_BAJA`** (§2 `C2`) |
| la condición **1** falla porque la fila está `CANCELLED` **y la cerró un *Free Forever*** — `S13` o `S20` | **`COBRO_POSTERIOR_AL_GRANT`** (§2 `C3`) |
| **cualquier otra forma de fallar**: la **1** sobre una `ACTIVE`, o sobre una `PAUSED` con el cobro posterior a la pausa; las condiciones **2**, **3** y **4** enteras; **el cobro de un preapproval que no es el vínculo de la fila** (`B/09` §2.4); y **todo cobro sobre una lápida de recepción** — `clase = LÁPIDA` (FASE 5, lote de la aplicación, owner 2026-09-30, I: sale la columna de origen), `B/02` §2.2— (`B/09` §2.4, owner 2026-09-26, `G3-2`) (FASE 9 vuelta 1, R4) (la lápida del corte salió: un cobro tardío de un débito viejo entra por la de recepción, como cualquier desconocido; FASE 5, simplificación del corte, S-40 y S-70) | **`PAGO_TARDÍO_RECHAZADO`** |

> **Lo que este § no desempata, porque la fila puede recibir el cobro** (FASE 9 vuelta 1, R4): una
> `PENDING_AUTHORIZATION` —se relee el preapproval por id, corre `S2` y el cobro se asienta sobre
> la fila ya `ACTIVE`—; una `ACTIVE` sobre el período en curso (`P1`); una `PAUSED` con el cobro
> anterior a la pausa (`P1`; `DEC-SUB-010` ya se llevó los días al pausar); una `CANCEL_SCHEDULED`
> con el cobro anterior a la cancelación (§2 `C2`, primera fila); y la predecesora de una sucesión
> en curso (`S19`).
>
> **Cada una recibe el cobro por su propio camino, y ese camino es también el del asiento** (FASE
> 9 vuelta 1, `N-G3V-02`): cuando el cobro lo vio el barrido y lo asienta una persona por el
> motivo 19 (`B/02` §2.5), el asiento crea la fila de `payment` y corre **la regla que nombra esta
> lista para el estado de la fila**, no `P1` a secas —`S2` tras releer el preapproval; `P1`; `P1`
> más la extensión con `max` de `C2`, primera fila; la retención de `S19`— **o, sobre una
> `GRACE_PERIOD` o `SUSPENDED` cuyas cuatro condiciones se cumplen, `S5` o `S7`**, el desenlace
> que el evento habría corrido (abajo, *«la tabla la aplican los dos productores»*). Con `P1` a secas se perdía la extensión de la
> `CANCEL_SCHEDULED` —Juan pagaba el período y no lo recibía— y la retención de la predecesora
> —`S18` no encontraba el pago y nadie proponía devolverle el período doble—.
>
>
> **Y un cobro de un preapproval del sistema viejo ya no tiene regla propia**: la lápida del corte
> y la ventana del día del corte salieron, así que entra por la lápida de recepción, como cualquier
> desconocido, y cae en la tercera fila de la tabla, `PAGO_TARDÍO_RECHAZADO`, con la propuesta de
> devolverlo; la persona decide (FASE 5, simplificación del corte, S-40, S-41, S-46 y S-70). Si la
> cancelación del 1b no se aplicó, lo que avisa no es el cobro sino la salvedad 4 del `B/09` §3,
> que la sigue releyendo y marca a los 3 días.
>
> **La tabla la aplican los dos productores**: el evento del cobro y la comparación de cobros del
> barrido (`B/09` §3). El barrido abre `COBRO_SIN_REGISTRAR` **sólo** sobre una fila que puede
> recibir el cobro **o sobre una `GRACE_PERIOD` o `SUSPENDED` cuyas cuatro condiciones se
> cumplen**, donde esta tabla no asigna nada porque no falla ninguna: el evento habría corrido `S5`
> o `S7`, y el asiento del motivo 19 corre eso mismo (arriba, *«cada una recibe el cobro por su
> propio camino»*). Sin esto el cobro en
> vuelo en el instante de `S6` con su aviso perdido (`WH-5`) no abría nada y Juan quedaba
> suspendido con el período pagado (FASE 9 vuelta 1, `N-G3V-01`; la `GRACE_PERIOD` que alcanza la
> relectura de `S6` sigue asentándose por `S5` en el acto, `B/09` §3). Sobre cualquier otra abre
> el motivo que esta tabla asigna, con el cobro colgado
> (la lápida del
> corte salió: FASE 5, simplificación del corte, S-40 y S-70).
> Escrita por criterio y no por productor, una fila
> nueva —o una escrita a mano— cae en la fila del acto que la dejó sin poder cobrar y no en el
> comodín.

**El criterio no es de precedencia formal sino de qué necesita la persona que abre el caso**, y por
eso ordena así: los dos primeros le dicen **qué acto nuestro dejó cobrando un preapproval que
debería estar cancelado**, que es lo único que le permite cortar la sangría además de devolver
—`C2` y `C3` la mandan a mirar la llamada de cancelación—; `PAGO_TARDÍO_RECHAZADO` le dice que
**la plata entró y la fila no la pudo tomar**, que es otro trabajo. **Los tres devuelven plata**
(`B/02` §2.5), así que el desempate **no decide si el cliente cobra de vuelta**: decide qué le
ponen delante a quien lo resuelve. Es exactamente la diferencia que antes quedaba librada a cuál de
los dos §§ leyera quien implementara.

> **La condición 1 tiene desde `MP4` un segundo consumidor, y conviene decirlo porque nadie lo
> vería.** Además de decidir si un pago tardío reactiva, **es el tope de la reapertura de un pago
> manual declarado impago** (cap. 03 §7.1): se puede reabrir mientras la suscripción siga en
> `GRACE_PERIOD` o `SUSPENDED`, y deja de poder reabrirse cuando llega a `CANCELLED`, que es lo
> que esta condición ya rechaza. Se eligió así —en vez de un plazo nuevo— justamente para no
> agregar una cifra de configuración sin guard; el precio es que **relajar esta condición alarga
> esa ventana sin que ningún texto de allá lo diga**, y por eso queda anotado acá, que es donde
> alguien la relajaría.

**Con una excepción, y es la única: la fila es la predecesora de una sucesión en curso, falle la
condición que falle: el pago de su período impago lo retiene `S19` y lo reevalúa el cierre** (FASE
9 vuelta 1, `F-8V1B2-005`). El doble cobro de un período ya pagado no es de este §: lo abre `P1`
como `COBRO_DUPLICADO`. Ése no es un caso ambiguo sino uno **diseñado**, el del `B/12`
§5.3, y su desenlace está declarado: el pago **se registra y queda pendiente de resolución**
(cap. 03 §3.2, `S19`), **sin marca y sin evento crítico**. Poner la marca ahí sería tratar el camino
normal de una sucesión cuya predecesora entra en el grace durante
la ventana —desde el grace ya no se declara, `DEC-SUB-021`— como un incidente. **La marca no deshace una sucesión en curso**: bloquea
*escribir* un `sucede_a` apuntando a la fila, no el que ya existe (`B/02` §2.2, `B/03` §3.3), así
que la excepción no se apoya en eso sino en que el pago ya tiene dueño —`S19` y el cierre de
`B/12` §5.3—. **Y vale falle la condición que falle, la 3 entera incluida**: no queda ninguna forma
de fallar la 3 sobre la predecesora en curso que vaya a `PAGO_TARDÍO_RECHAZADO`. Si además hay otra
divergencia —el `COBRO_DUPLICADO` que abre `P1`—, esa marca se abre sobre la predecesora sin
deshacer la sucesión (FASE 9 vuelta 1, `F-8V1B2-005`: el par se contradecía dos líneas más abajo
con la frase nueva)

**Este § nombra ahora las dos transiciones y antes nombraba una.** Su condición 1 admite
`GRACE_PERIOD` **o** `SUSPENDED` desde siempre, y su desenlace decía sólo `SUSPENDED → ACTIVE`:
**`S5` no aparecía ni una vez en el capítulo**. La incompletitud no era cosmética — era lo que
tapaba la colisión con `B/12` §5.3, que prohíbe exactamente `S5`. Leídos al pie de la letra los dos
textos no se contradecían, y quien implementara éste iba a escribir la reactivación para los dos
estados porque la condición 1 los admite a los dos.

**La condición 3 es la que más se olvida y la más cara.** Alguien que se cansó de esperar y se
volvió a suscribir tiene dos filas; si el pago viejo reactiva la vieja, queda pagando dos veces
por la misma vertical, y encima el §11 quedó violado sin que nadie lo pida. Es exactamente lo
que la restricción de unicidad del capítulo 02 impide **al crear** — acá hay que chequearlo
porque la reactivación no crea nada.

**Su redacción cambió, y es más precisa, no más laxa.** Decía *«no hay otra suscripción viva»*, y
*«viva»* leía contra un conjunto que **excluía `RECONCILIATION_REQUIRED`**: un pago tardío se
consideraba seguro de reactivar aunque hubiera otra `ACTIVE` marcada, que es textualmente el caso
que la condición existe para detener. Con la marca de `B/02` §2.2 ese agujero desaparece **sin
tocar la condición**, porque la fila marcada conserva su estado real y entra en la cuenta.

**Y es la segunda vez que la palabra *«viva»* rompe algo leyendo el conjunto equivocado**, así que
conviene decir cuál lee ésta: la **fila viva** de `NUCLEO/01` §2.4 **con sujeto suscripción**
—los seis de `B/02` §2.2, no los dos de la instancia de addon (`B/03` §8)—, que
es la lectura correcta acá porque lo que se está evitando es **un segundo cobro**, no una decisión
de cobertura. Esta condición es de billing y sobre filas de billing; no cruza la frontera.

**Y la enumeración de la condición 3 decía otro conjunto que el que este párrafo declara.** El
párrafo dice *«los seis de `B/02` §2.2»* y la tabla enumeraba **cuatro** —*«un estado que dé
título: `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCEL_SCHEDULED`»*—, que es el conjunto de
`12-contrato…` §2.6, no el de `B/02` §2.2. Los dos coincidían hasta que **`PENDING_AUTHORIZATION`
dejó de emitir fuente** (`12-contrato…` §2.6): desde ese día hay un estado que **no da título y sí
tiene una autorización viva**, y era justo el único que la enumeración dejaba pasar. **El peligro
que la condición vigila es una autorización que puede cobrar, no un título**, que es literalmente
la definición de *«fila viva»* — así que la enumeración pasa a ser la de `B/02` §2.2 y el conjunto
deja de estar escrito dos veces con dos contenidos.

**Y la segunda mitad de la 3 se lee sobre DOS columnas, porque la que la respondía se borra.**
`sucede_a` sólo existe mientras la sucesión está en curso: cuando la sucesora autoriza —o antes,
si la predecesora se murió sola por `S12`, por `S16` o por el espejo del `B/03` §10.1—, `S18` la
limpia (`B/03` §3.2) y el vínculo
pasa a vivir en `sucedida_por`, del lado de la predecesora.
Preguntar sólo por `sucede_a` daba *«no fue superada»* justo en el caso en que sí lo fue, que es
el más caro de los dos. Con `sucedida_por` la condición se puede evaluar **después** del cierre,
que es cuando llega un pago tardío.

> **La mitad `sucedida_por` es redundante con la condición 1, y se declara así en vez de
> presentarse como el caso que salva.** Una fila con `sucedida_por` puesta es una predecesora que
> `S17` llevó a `CANCELLED`, y la condición 1 ya rechaza `CANCELLED` sin leer la 3: **ninguna fila
> puede cumplir la 1 y tener `sucedida_por` a la vez**, porque de los tres estados no vivos no se
> vuelve (`B/03` §3.3). Se conserva igual, y por dos razones que no son la del párrafo de arriba:
> las dos condiciones **fallan en la misma dirección**, así que la redundancia es gratis; y el
> evento crítico dice **cuál** falló, así que tener la 3 escrita distingue *«llegó un pago sobre
> una fila que se dio de baja»* de *«llegó un pago sobre una fila a la que otra la sucedió»*, que
> es lo primero que necesita quien lo mire. **Lo que no hay que hacer es contar este § entre los
> consumidores que `sucedida_por` necesita para existir**: el que la necesita de verdad es el
> addon de `B/16` §4.2, que sí evalúa después del cierre.

**Y una sucesora en `PENDING_AUTHORIZATION` BLOQUEA, que es lo contrario de lo que este § decía.**
La versión anterior la eximía *«a propósito»*, con dos razones, y las dos se cayeron:

1. **Contradecía su propia justificación.** La condición 3 existe, textual, porque *«si la hay, el
   pago es de una suscripción superada y reactivar le daría dos»*. Una sucesora esperando
   autorización es exactamente una suscripción que va a superar a ésta: reactivar le da dos. La
   nota eximía el caso que la condición describe.
2. **Su argumento era de tiempo, no de seguridad.** *«Todavía no puede cobrar»* es cierto —`D8` le
   exige fecha de primer cobro futura—, pero el daño no es que la sucesora cobre **ahora**: es que
   la predecesora vuelva a `ACTIVE` con el crédito de la sucesora **ya computado sin ese
   pago** (en cero cuando se declaraba desde el grace, que `DEC-SUB-021` cerró), que es
   lo que `B/12` §5.3 mide y no se puede corregir después (`B/12` §5.4: las fechas del proveedor
   son inmutables, `EX-39`).

**Y su premisa empírica era falsa.** *«El pago tardío que reactiva a la predecesora es la evidencia
de que la sucesión ya no hace falta»*: ese pago **no es un acto del cliente**, es una cuota en
`recycling` que el proveedor reintenta solo (`B/12` §1.3, medido) — y desde `DEC-SUB-019`, sobre un
pagador con tarjeta, sólo mientras la predecesora sigue en `GRACE_PERIOD`. El cliente que abrió el checkout
sigue pudiendo autorizarlo, y si lo hace, `S17` cancela la fila que el pago acaba de reactivar.

**Y por la otra puerta, donde sí es un acto del cliente, la conclusión no cambia.** El pago del
período impago tiene dos puertas y la segunda es el **pago manual** del `B/03` §7, que la persona
hace a propósito: ahí el argumento de arriba no aplica. Y aun así **tampoco es evidencia de que
la sucesión no haga falta** —quien transfiere la cuota vieja no está cancelando su checkout, y
las dos ramas del `B/12` §5.3 siguen siendo posibles en ese instante—, así que el destino del
pago lo decide **el cierre** de la sucesión y no su llegada. La razón escrita arriba vale para
una puerta; la regla que sostiene vale para las dos, y por eso `S19` retiene el pago entre por la
que entre.

**Lo que la nota temía —*«dejar a la persona con la vieja sin reactivar y la nueva sin
autorizar»*— no ocurre, y hay que decir por qué.** Mientras la sucesión está en curso la
predecesora sigue en `GRACE_PERIOD`, que **emite fuente** con `hasta: SIN_FECHA_CONOCIDA`
(`12-contrato…` §2.6): la cobertura no se interrumpe por no reactivar. Y si la sucesión muere sin
consumarse, el pago pendiente se reevalúa y **entonces sí** reactiva, por `S5` o `S7`, con la
condición 3 ya cumplida — el camino entero está en `B/12` §5.3.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:155, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:841, .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:306

<a id="trans-b-s6"></a>

### `TRANS:B:S6` · `S6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:842`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S6](10-corte/B7.md#tpz-s6) → [B7](10-corte/B7.md#pieza-b7)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `GRACE_PERIOD` — **o `ACTIVE`, sólo por el segundo o el tercer evento** — **o `PAUSED` con motivo `COURTESY`, sólo por el tercer evento**: la cortesía da servicio, así que un contracargo la corta (FASE 8 completa, pendiente 8, owner 2026-09-25). **La `PAUSED` con motivo `CUSTOMER_REQUEST` no entra**: sigue con sólo la marca (§6, `P6`)
- **evento** (disparador): se agota el reloj — **o se lee `paused` en el proveedor sin haberlo pedido nosotros**: el proveedor se rindió por mora, y nuestro grace también terminó (`DEC-MP-008`). El cliente no puede pausar desde el proveedor (`DEC-MAIL-001`), así que ese `paused` **es** mora; la fila puede estar todavía en `ACTIVE` si el webhook del cobro fallido se perdió — **o se lee `charged_back` en un pago acreditado de la fila, releído por id** (`D17`): **un contracargo**, que es el tercer evento y no pasa por el grace (`DEC-SUB-020`; FASE 8 completa, `F-8CB3-009`, owner 2026-09-25). Llega por el aviso de contracargo del proveedor o por la comprobación de pagos acreditados del barrido (`B/09` §3), y el pago pasa por `P6` (§6). **Sólo en un pagador con tarjeta**: un pagador manual no tiene un pago en el proveedor que el banco pueda revertir. Lo que el proveedor hace en un contracargo es **documental y no medido** (`RC-8`, `UNKNOWN`): esta fila fija qué hacemos al leer ese estado, no cómo se comporta él — **o el admin confirma que la cuota no se pagó (`MP2`, §7)**: sólo en un pagador manual, desde `GRACE_PERIOD`; **es el cuarto evento**, y no pasa por la lectura del `B/09` §4, porque un pagador manual no tiene preapproval (FASE 9 completa, C8, `F-8CB2-009`: `MP2` mandaba `S6` con un evento que esta fila no declaraba) — **o, sobre una sucesora que entró al grace por la rama de la sucesora de `S4`, el barrido relee su preapproval por id y lo ve `cancelled`**: **es el quinto evento**, y cierra un grace que ya no puede terminar en pago (`PA-6`); sobre `paused` es el segundo evento de siempre (owner 2026-09-25; FASE 9 completa, 3c; misma forma que `DEC-MP-008`). **Son cinco eventos** (antes tres)
- **hacia** (estado destino): `SUSPENDED`
- **condición** (guardas): **no hay un pago acreditado del período pendiente de resolución** por `S19` — **y, en un pagador con tarjeta, la relectura en el proveedor no muestra un cobro acreditado del período** (un pagador manual no tiene preapproval: su cobro es la cuota, y `MP2` ya lo resuelve un admin), hecha **con la lectura del `B/09` §4 y ninguna otra**. Si lo muestra, el webhook se perdió o llegó tarde: **`S6` no ocurre** y lo que corre es `S5`, con sus condiciones **—sobre una fila `ACTIVE`, que no tiene grace que apagar, lo que corre es `P1` sobre ese cobro, creando la fila de `payment` si no existe, con la misma regla de asiento de `S5`** (FASE 9 vuelta 1, `F-8V1B2-009`)—, **y `S5` asienta ese cobro en el mismo acto** (ver `S5`; FASE 8 completa, pendiente 6, owner 2026-09-25). **Si la lectura falla —o contesta *«todavía no se sabe»*, que es lo que el §4 del `B/09` devuelve cuando el inventario de intentos no está completo—, `S6` no ocurre en esta corrida** y se reintenta en la siguiente, como `S17` (`B/09` §3); **si en la corrida siguiente sigue sin saberse, se avisa** por el canal de `DEC-OBS-001`, (`B/09` §6, punto 2, owner 2026-09-24), **y a los 3 días del `date_created` del registro de cobro el barrido abre la marca con motivo `COBRO_DEL_PERÍODO_SIN_RESOLVER`** (`B/02` §2.5, motivo 21), que entra al listado accionable y escala por `puesta_en`; `S6` sigue sin correr hasta que una persona resuelva por `S15` (owner 2026-09-25; FASE 9 completa, 3d, `F-8CB3-004`). **El cuarto evento no pasa por esta lectura** (un pagador manual no tiene preapproval). **Y por cualquiera de los dos primeros eventos —y por el cuarto y el quinto; no por el tercero, abajo—, `S6` no ocurre mientras la fila sea la predecesora de una sucesión en curso** —una sucesora viva apuntándola— (owner, 2026-09-24): si la sucesión se consuma, `S17` la cancela como siempre, y si la sucesora muere, `S6` corre en la corrida siguiente; por el segundo evento, además, el preapproval pausado ya no cobra. **La protección dura una sola ventana por construcción, y ya no hace falta un límite que lo diga**: la redeclaración que ese límite frenaba salía de una fila en `GRACE_PERIOD`, y desde `GRACE_PERIOD` ya no se declara una sucesión (`DEC-SUB-021`, owner 2026-09-25; `G-R1-A`). **Lo que sigue vigente** es la protección misma, para la sucesión declarada en `ACTIVE` cuya predecesora entra en el grace **durante** la ventana (`S4`, fila 11 del recorrido de abajo): `S6` no la suspende mientras la sucesión siga en curso, y si la sucesora muere, corre en la corrida siguiente — y como la fila ya está en `GRACE_PERIOD`, no hay una segunda sucesión que la vuelva a frenar (§4). **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: **por el segundo evento sobre una fila todavía `ACTIVE` la declaración nueva ya no se acepta**: `S1` relee por id el preapproval de una predecesora `ACTIVE` de tarjeta y exige `authorized`; sobre `paused` el cambio no se ofrece y la relectura corre este `S6` por su segundo evento (§3.2, `S1`). **Por el tercer evento no corren las guardas del impago** —*«¿cobró el período?»* y el pago retenido por `S19`—: el cobro existió y lo que se lee es que el banco lo revirtió, y `DEC-SUB-020` lo decidió *«en el acto, sin grace»*. **Cerrado el 2026-09-25 (owner)**: **por el tercer evento tampoco corre la guarda de la sucesión en curso**: si la fila es la predecesora de una sucesión en curso, **`S6` ocurre igual** —un contracargo es una disputa, no una mora que el cambio de plan resuelva— **y la sucesora también se corta** (`DEC-SUB-020`, su 📌; FASE 8 completa, pendiente 6, owner 2026-09-25). **Cerrado el 2026-09-25 (owner)**: **la sucesora la corta `S31`** (§3.2), una transición propia (FASE 8 completa, pendiente 8, owner 2026-09-25)
- **efectos** (efectos): §21: sin listado público, sin edición, sin creación, sin entitlements comerciales; datos conservados y billing accesible. **Y en un pagador con tarjeta, se cancela el preapproval en el proveedor en el mismo acto**, con la regla de relectura de `S17` (`DEC-SUB-019`): la suspensión corta **el cobro**, no sólo el servicio, así que ningún reintento del proveedor cobra después un mes entero sobre una fila suspendida. **Si la cancelación falla, `S6` no ocurre en esta corrida** y la fila sigue donde estaba — `GRACE_PERIOD`, o `ACTIVE` por el segundo evento, **o `PAUSED` por el tercero sobre una cortesía** (pendiente 8). **Desde `PAUSED` con motivo `COURTESY` la cancelación sí se puede**: el proveedor rechaza toda modificación sobre una pausada **y sí deja cancelar** (`EX-11`). **Y ahí la cortesía se cierra con la fila**: termina hoy, como en `S22`, y se escribe `fin_real` en la `subscription_pause` con ese día (`B/02` §2.2), por la misma razón que en `S22` (FASE 8 completa, pendiente 8, owner 2026-09-25). **Y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, **entra por esta misma puerta** —la cancelación no se ejecuta, `S6` no ocurre en esta corrida y se reintenta en la siguiente—; si no hay destinatario, se cancela igual y el no-entregable se escala; **y si el correo agota sus reintentos (`failed` definitivo del outbox), tampoco bloquea: se cancela igual y se escala como no-entregable, igual que sin destinatario** (owner 2026-09-25; FASE 9 completa, decisión 1; precisa `DEC-MAIL-001`) — sin eso, un moroso cuyo correo quedaba `failed` se quedaba en `GRACE_PERIOD` con servicio entero sin límite. **Por el quinto evento —y por el segundo sobre una sucesora de la rama de `S4`— se cancela de nuestro lado lo que quede vivo** (si la relectura ya ve `cancelled`, no se manda nada) **y el aviso es el de suspensión con *«volvé a suscribirte»*** (`B/19` §4 fila 10; owner 2026-09-25, FASE 9 completa, 3c). Volver es re-autorizar por el checkout: una sucesión, y `S17` encuentra el preapproval ya `cancelled` (`D7`). **Y por el tercer evento, además, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) **con el pago colgado**, para que una persona siga la disputa (`DEC-SUB-020`); el aviso a la persona es el de `B/19` §4 fila 10-ter, no el de la 10, que habla de mora (FASE 8 completa, `F-8CB3-009`, owner 2026-09-25), **y su correo es el de *«suspendido por contracargo»*** del catálogo de `NUCLEO/07` §6 (FASE 8 completa, pendiente 6, owner 2026-09-25)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:156, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:842

<a id="trans-b-s7"></a>

### `TRANS:B:S7` · `S7`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:843`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S7](10-corte/B7.md#tpz-s7) → [B7](10-corte/B7.md#pieza-b7) — nota de la fuente: «con la cláusula del Turista VIP al regularizar (CA)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `SUSPENDED`
- **evento** (disparador): regulariza, **o se reevalúa un pago que quedó pendiente** por `S19` — **«regulariza» es la cuota del pagador manual (`MP4`)**; un pagador con tarjeta **no vuelve por acá**: `S6` le canceló el preapproval (`DEC-SUB-019`), así que vuelve por el checkout como **sucesora** (`S1` → `S2` → `S17`) —la sucesión que `G-R1-A` le admite a una `SUSPENDED` sólo si es de pagador con tarjeta y su preapproval se relee por id como `cancelled` (`B/20` §2; FASE 8 completa, `F-8CB1-002`, owner 2026-09-25)—, y `S7` sólo lo alcanzan los bordes —un cobro en vuelo en el instante de `S6`, un preapproval reactivado a mano—
- **hacia** (estado destino): `ACTIVE` — **o `CANCEL_SCHEDULED`** si el cobro entró sobre un preapproval que `S6` ya canceló (la relectura lo da `cancelled`): la persona **recibe el período que pagó**, con fin de servicio en el fin de ese período, y `S12` la termina; para seguir, vuelve por el checkout. Así el espejo no la cancela antes de tiempo, porque `cancelled` × `CANCEL_SCHEDULED` es el par esperado (§10.1) (owner, 2026-09-25; FASE 8 completa, `F-8CB1-003`, `F-8CB2-004`, `F-8CD1-004`). **Y sus complementos los cancela como `S11`**, por la regla que `S11` aplica a las filas de complemento (`R1-a`), como el espejo de `R18` en el §10.1 (owner 2026-09-27, FASE 9 vuelta 2, `R18-b`). Esa regla toma sólo las que siguen en `ACTIVE`, y aquí son las que `S32` no alcanzó a pausar al suspender; las que sí pausó no entran y las alcanza la orfandad (`B/16`, *«lo que este capítulo NO cierra»*). **La que `S32` no alcanzó tiene abierta la marca `PAUSA_NO_APLICADA`** (motivo 22), y esta cancelación no la resuelve: **la levanta una persona después de ver que el complemento ya no cobra** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-q`)
- **condición** (guardas): el cobro entró de verdad **y** las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso**
- **efectos** (efectos): la fila **vuelve a emitir fuente** (`12-contrato…` §2.6), y ese cambio de cobertura es lo que restituye la publicación **por `PB3`/`PB7`, si el cupo alcanza** —el cupo cuenta sólo las fichas en `PUBLISHED`— (`V/03` §9); esta tabla **no dispara** una transición de la otra épica, igual que `S2` y `S29` (FASE 8 completa, `F-8CA2-016`, owner 2026-09-25). **Y si la fila tiene en la cola un cambio programado cuya fecha pasó mientras estaba suspendida, al volver lo aplica `S38`** (revisión del owner, casos vecinos, 2026-09-29, caso G-A)**, vuelva a `ACTIVE` o a `CANCEL_SCHEDULED`** (revisión del owner, casos vecinos, 2026-09-29, caso I-A); **y si al volver el plan comercial vuelve a heredar Turista VIP y el `user` paga una suscripción de Turista VIP, la cancela en el mismo acto, sin reembolso, con el correo antes** —el espejo de la cláusula de `S2`— (corte del MVP, owner 2026-10-02, CA; `DEC-ENT-004`, `V/15` §6.3; construye `B7`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:157, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:843

<a id="trans-b-s8"></a>

### `TRANS:B:S8` · `S8` — `ACTIVE` → `PAUSED` *(motivo `CUSTOMER_REQUEST`)*

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:844`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S8](20-fase-2/B8b.md#tpz-s8) → [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`
- **evento** (disparador): la persona pide pausar
- **hacia** (estado destino): `PAUSED` *(motivo `CUSTOMER_REQUEST`)*
- **condición** (guardas): `puedePausar()` (capítulo 01 (núcleo) §3) — **y el `PUT paused` se aplicó, confirmado por relectura**, la misma regla que `S10` y `S17` (FASE 9 completa, `F-8CB2-003`)
- **efectos** (efectos): se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`). **Si la relectura sigue viendo `authorized`, `S8` NO ocurre**: la fila se queda en `ACTIVE`, no se abre la `subscription_pause`, y **`S14` pone la marca con motivo `PAUSA_NO_APLICADA`** (`B/02` §2.5, motivo 22) — sin esto la fila quedaba `PAUSED` de nuestro lado con el proveedor cobrando, y el espejo leía ese `authorized` como una reanudación (§10.1). En un pagador manual no hay `PUT` y esta parte no corre. **Y si `S8` ocurre, sus complementos recurrentes de esa vertical se pausan con ella, por `S32`** (owner 2026-09-25; FASE 9 completa, 4a, `F-8CC1-004`): sin eso el addon cobraba todos los meses de la pausa sin dar nada, porque sin título el pliegue lo descarta

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:158, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:844

<a id="trans-b-s9"></a>

### `TRANS:B:S9` · `S9` — `ACTIVE` → `PAUSED` *(motivo `COURTESY`)*

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b) · **también**: [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:845`
- **Adjudicación** (`adjudicacion.json`): VIVO — el tercer disparador salió con C8; lo tachado de la fila se omite y lo vigente va entero.
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S9](20-fase-2/B8b.md#tpz-s9) → [B8b](20-fase-2/B8b.md#pieza-b8b), [B9b](20-fase-2/B9b.md#pieza-b9b) — nota de la fuente: «compartida»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`
- **evento** (disparador): **dos disparadores, un mismo acto** (revisión del owner, 2026-09-28, C8: el tercero era de la discontinuación): `SUPER_ADMIN` otorga cortesía; **o una sucesora recién autorizada tiene una cortesía DIFERIDA esperándola** — una `courtesy_grant` con `saldo_meses` no nulo cuyo `subscription_id` apunta a una fila cuyo `sucedida_por` es esta (`B/02` §2.4 y §2.6, `DEC-GRANT-007`)—
- **hacia** (estado destino): `PAUSED` *(motivo `COURTESY`)*
- **condición** (guardas): no hay pausa vigente (`DEC-GRANT-004`) — **y una sucesora recién autorizada no tiene ninguna**, así que el segundo disparador corre sin tocar la condición. **Y, por el primer disparador, la fila es de un plan MENSUAL y la cortesía se firma en MESES ENTEROS** (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25; `DEC-GRANT-003` impl. 6): es la validación de la pausa de `DEC-SUB-010` —el término `billingOption.ciclo == mensual` de `puedePausar()`, `NUCLEO/01` §3—, porque en pausa el proveedor se saltea las fechas de cobro enteras que caen adentro (`PS-6`) y al reanudar no corre la fecha (`PS-5`): una cortesía vale los cobros que cruza, no los días, y N meses saltean exactamente N cobros. **Sobre una fila de plan no mensual `S9` no ocurre**, y el admin recibe el motivo: la cortesía temporal no está disponible ahí, y le quedan la cortesía permanente o una promo sobre la renovación. **En el segundo disparador este término no se evalúa porque no hace falta**: un saldo que iba a caer sobre una fila de plan **no mensual —trimestral, semestral o anual—** ya se cerró antes —en `S18` — con `motivo_cierre = DESTINO_DE_PLAN_NO_MENSUAL` (`B/02` §2.4, `B/14` §4.7; owner 2026-09-25; FASE 9 completa, contradicción 1 de `03` §R4.5: con *«anual»* el trimestral y el semestral recibían el saldo y `PS-6` lo convertía en cero o en un ciclo entero)
- **efectos** (efectos): se pausa en el proveedor y **el servicio se sostiene de nuestro lado** (`DEC-GRANT-003`). **Y el `PUT paused` se confirma por relectura**, como en `S8` (FASE 9 completa, `F-8CB2-003`): **si la relectura sigue viendo `authorized`, `S9` NO ocurre** —la fila se queda en `ACTIVE`, no se abre la `subscription_pause` ni se re-emite nada—, **`S14` pone la marca con motivo `PAUSA_NO_APLICADA`** (`B/02` §2.5, motivo 22), y **el aviso a `SUPER_ADMIN` dice que la cortesía no se aplicó**. En un pagador manual no hay `PUT` y esta parte no corre. **Por el segundo disparador se re-emite la cortesía diferida**: `subscription_id` pasa a esta fila, `inicio` es hoy **—o, sobre una sucesora que vive del crédito de `DEC-SUB-006`, el fin de ese crédito: la cortesía arranca cuando se agota lo que la persona ya pagó, no encima de eso** (owner 2026-09-27, FASE 9 vuelta 2, `R17`, `F-8V2B1-004`)—, `fin` es `inicio` + `saldo_meses`, y **`saldo_meses` vuelve a nulo**. **La pausa se abre igual en el acto de autorizar**, con `fin_previsto` en ese `fin`: así cruza exactamente los `saldo_meses` cobros que caen desde el fin del crédito, y el primer cobro corrido por el crédito queda adentro sin que haga falta otro momento para pausar (el saldo pasó a meses: FASE 8 completa, `F-8CB1-001`, owner 2026-09-25, `B/02` §2.4). Es la misma fila de `courtesy_grant`, entera, con la firma de `SUPER_ADMIN` original — no una cortesía nueva, así que el §35.4 sigue auditando **por grant**. **Riesgo aceptado y declarado por `DEC-GRANT-007`**: entre `S2` y este acto el proveedor **puede cobrar** el primer pago, y ese cobro se devuelve **por el camino que ya existe** —la marca con motivo `COBRO_DURANTE_CORTESÍA` y la confirmación de una persona, `B/02` §2.5 y `DEC-RF-002`—, sin inventar un mecanismo para evitarlo

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:159, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:845

<a id="trans-b-s10"></a>

### `TRANS:B:S10` · `S10` — `PAUSED` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b) · **también**: [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:846`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S10](20-fase-2/B8b.md#tpz-s10) → [B8b](20-fase-2/B8b.md#pieza-b8b) — nota de la fuente: «el tercer evento, revocar una cortesía temporal, lo agrega `B9b` (BO)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PAUSED`
- **evento** (disparador): llega el fin, o la persona vuelve antes, **o el `SUPER_ADMIN` revoca una cortesía temporal** (acción 1; corte del MVP, owner 2026-10-02, BO)
- **hacia** (estado destino): `ACTIVE`
- **condición** (guardas): **la fila es principal** —una de complemento pausada por `S32` no tiene reloj propio y la reanuda `S33`— (FASE 9 completa, 4a) (salió con `S25`: revisión del owner, 2026-09-28, C8) **y el `PUT` se aplicó, confirmado por relectura** — la misma regla que `S17`
- **efectos** (efectos): `PUT status=authorized`; **se escribe `fin_real` en la `subscription_pause`** con el día de la reanudación confirmada: si la persona vuelve antes, los meses no usados no cuentan contra `DEC-SUB-004`, y la restricción de *«a lo sumo una sin `fin_real` por suscripción»* (`B/02` §2.2) no bloquea la pausa siguiente (FASE 9 completa, contradicción 3 de `03` §R4.5: `S10` era la única salida de `PAUSED` que no lo escribía, y es por donde termina toda pausa); **sus complementos pausados por `S32` se reanudan con ella, por `S33`** (4a); al reanudar se le muestra **una sola cosa: qué día se le cobra** (`DEC-SUB-010`; **la vuelta anticipada es libre y el ciclo que eso puede regalar va declarado** en *«lo que esta mitad NO cierra»*, owner 2026-09-26, `G5-3`) — **y en un pagador manual ese día lo fija esta misma transición**, porque no hay proveedor que lo corra: la fecha del próximo cobro (`B/02` §2.2) avanza **tantos ciclos como hayan vencido durante la pausa, sin abrir cuota**, que es el espejo local de `PS-6` y lo que esa misma decisión ya eligió para el pagador con tarjeta —*«se le cobra normal en el ciclo siguiente»*—. Sin eso el reloj le abriría al volver la cuota de un período que transcurrió adentro de la cortesía (§7.2, *«qué mueve la fecha del próximo cobro»*). **Si la relectura sigue viendo `paused`, `S10` NO ocurre**: la fila se queda en `PAUSED` y **se pone la marca `requiere_conciliación` con motivo `REANUDACIÓN_NO_APLICADA`** (`S14`, `B/02` §2.5), porque una reanudación que no se aplicó le corta el servicio y el cobro a la vez — ver abajo; **y por el tercer evento, la revocación de una cortesía temporal por el `SUPER_ADMIN` (acción 1, `NUCLEO/08` §3): es reanudar antes del fin por un acto suyo, con `fin_real` escrito en el acto y la misma relectura, sin reembolso, y con el aviso a la persona que dice qué día se le cobra (`B/19` §4, fila 13-quinquies); lo agrega `B9b`** (corte del MVP, owner 2026-10-02, BO)

**Texto de la fuente — «`S10` es la única salida de `PAUSED` que devuelve el servicio, y su rama de fallo es lo que sostiene la garantía de retención»** (`B/03-maquinas-de-estado.md:799–885`, sin lo tachado):

**`S10` tenía la columna de condición vacía y ningún desenlace escrito para la llamada que
falla**, y eso valía mientras la ausencia no sostuviera nada. Desde `DEC-DATA-002` sostiene la
mitad más cara de una garantía: el contenido publicable de la ficha de quien pausó.

**El desenlace que la ausencia dejaba, recorrido:** el día 120 nuestro reloj manda el `PUT` y no
se aplica. La fila se queda `PAUSED`, `cubierto` sigue falso, el reloj de inactividad de
verticales **no se reinicia** —su único hecho aplicable acá es la cobertura comprobada verdadera
(`NUCLEO/01` §1.2, hecho 2), y acá se comprueba falsa— y sigue corriendo hacia el día 180, que borra el contenido
(`V/02` §4.1). **El cliente queda sin servicio y sin cobro desde el día 120**, y a nadie le llega
nada que lo nombre.

**Y era invisible por construcción, con las tres redes apagadas a la vez:**

1. **El barrido compara y los dos lados coinciden**: nuestro estado dice `PAUSED` y el del
   proveedor dice `paused` —`PS-4` mide que **no** se reanuda solo—, así que ninguna de las cinco
   comparaciones de `B/09` §3 lo ve. Es la forma que ese § ya describe dos veces con otras
   palabras: *«la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
   coincide»*.
2. (`D16` y `G-R5` salieron (revisión del owner, 2026-09-28, C14.)
   **El tiempo que una fila concreta lleva en `PAUSED` no lo compara nada.**
3. **Verticales se entera sólo para no avanzar el
   reloj** (revisión del owner, 2026-09-28, C14): pregunta `retenciónDetenida` (`12-contrato…` §4.1), que con esta fila
   `PAUSED` contesta `sí`, así que el reloj queda **detenido mientras la reanudación no ocurra**:
   el cliente no pierde el contenido, y tampoco vuelve el servicio. **Y no queda detenido sin que
   nadie lo vea**: la quinta comprobación del barrido diario abre `REANUDACIÓN_NO_APLICADA` sobre
   la pausa vencida (`B/09` §3), y eso la pone delante de una persona (revisión del owner, casos vecinos, 2026-09-29, caso F-A).

**Por eso son dos escrituras y no una, y cada una tapa un agujero distinto:**

- **La rama de fallo**, en la fila: la reanudación se confirma **por relectura**, igual que la
  cancelación de `S17`, y si el proveedor sigue diciendo `paused` **`S10` no ocurre** y se pone la
  marca. Es lo que convierte una llamada perdida en un caso que una persona mira.
- **El detector**, en el barrido: la **quinta** comprobación de cero llamadas de `B/09` §3 —una
  pausa cuyo `fin_previsto` ya pasó y que sigue sin `fin_real`, con su suscripción en `PAUSED`—.
  Hace falta **además** de la rama porque la rama sólo corre **si el job corrió**: el modo que
  deja la fila colgada para siempre es el del job que no se ejecutó nunca, y ése no produce
  ninguna relectura que falle.

> **Recontado el 2026-09-25 (FASE 9 completa, contradicción 2 de `03` §R4.5)**: además de `S10`,
> `PAUSED` tiene **cinco salidas terminales** —`S22`, `S13`, `S17`,
> el espejo del §10.1 **y `S36`**, que sale de `PAUSED` desde el owner 2026-09-26 (`X-2`) y escribe
> `fin_real` (FASE 9 vuelta 2, `F-8V2D1-003`); `S25` salió con la revisión del owner, 2026-09-28, C8— **y
> `S6`**, y **todas escriben `fin_real`** (el espejo desde esta misma pasada, §10.1); en una fila de
> complemento pausada por `S32`, además, `S20` y `S21` terminan y `S33` reanuda, y las tres lo
> escriben. **Y `S10` también lo escribe** desde la misma pasada (contradicción 3). El párrafo de
> abajo contaba *«cuatro»* y omitía `S17` y el espejo; queda como estaba, por rastro.

**El calificativo del título no es un matiz: `PAUSED` tiene otras **seis** salidas —la
cuarta, `S6`, desde la pendiente 8, abajo; `S17` y el espejo, recontados arriba; **`S36`, recontada
arriba en la FASE 9 vuelta 2**; `S25` salió con la revisión del owner, 2026-09-28, C8— y ninguna sostiene nada.** `S22` —la baja— y `S13` —el grant— **terminan la relación**, así que después de las dos no
queda ficha que republicar ni reanudación que esperar, y por eso el argumento de acá abajo es
sobre `S10` y no sobre *«salir de `PAUSED`»*: lo que la garantía de retención necesita es que la
persona que **pidió volver** vuelva. Las dos salidas terminales tampoco dejan colgada la quinta
comprobación de `B/09` §3 —que exige *«su suscripción sigue en `PAUSED`»*—, y `S22`
además cierra la pausa escribiéndole `fin_real`. **Y desde la pendiente 8 hay una cuarta que no
es terminal y tampoco sostiene nada**: **`S6`**, por un contracargo sobre una cortesía, lleva la
fila a `SUSPENDED`, que no emite fuente; sale de `PAUSED`, así que tampoco deja colgada la quinta
comprobación, y cierra la pausa con su `fin_real` como `S22` (§3.2; FASE 8 completa, pendiente 8,
owner 2026-09-25).

(Sale con `S25`: revisión del owner, 2026-09-28, C8. Quien pide volver de una
pausa vuelve siempre por `S10`, también sobre un plan retirado, que se sigue prestando.)

**La asimetría con sus dos gemelas es lo que lo volvía un defecto y no una omisión pareja.**
`S17` **sí** tenía rama escrita —*«la única rama en la que la sucesión NO se cierra…»*, arriba— y
`S13` tiene su propio párrafo explicando por qué **no** la necesita (*«tiene que ocurrir igual»*,
con la salvedad 4 del barrido detrás). `S10` no tenía ni lo uno ni lo otro, y **es la única de las
tres cuyo desenlace silencioso termina en un borrado irreversible**.

**Y no se elige *«tiene que ocurrir igual»*, que es el patrón de `S13`.** Escribir la fila como
`ACTIVE` con el proveedor todavía en `paused` deja una suscripción que **cubre y no cobra** por
tiempo indefinido: le devuelve la ficha al cliente y nos come el ingreso, con `EX-15` midiendo que
**reanudar avisa sólo si se aplicó** —lo que no emite
nunca es mutar el monto—, así que si el `PUT` no se aplicó el primer aviso sería que el cobro no
llega (FASE 9 vuelta 1, `N-G3V-05`: la gemela de `F-8V1B3-007`). En
`S13` cortar la obligación de pago *«pase lo que pase»* es lo que el §35.3 ordena y el acceso ya
lo da el grant; acá no hay ninguna otra fuente que sostenga nada.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:160, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:846, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:799

<a id="trans-b-s11"></a>

### `TRANS:B:S11` · `S11`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a)
- **Fuente de la asignación**: `B/descomposicion.md:847`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S11](10-corte/B8a.md#tpz-s11) → [B8a](10-corte/B8a.md#pieza-b8a)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE` — **y, en el mismo acto, las filas DE COMPLEMENTO en `ACTIVE` que dependen de ella** (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`)
- **evento** (disparador): pide la baja
- **hacia** (estado destino): `CANCEL_SCHEDULED`
- **condición** (guardas): —
- **efectos** (efectos): **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`). **La fecha sale de los cobros acreditados, nunca de la fecha del próximo cobro** (FASE 8 completa, `F-8CB1-012`): **`fin_de_servicio = inicio(P) + un ciclo de la billing option anclada`**, donde **`P` es el `covered_period` más reciente de la fila con `liberado_en` nulo** (`B/02` §2.3) — el período que el último cobro acreditado pagó, **sea `payment` o `manual_payment`**. La copia de la fecha del próximo cobro **no entra**: sobre una fila con un cobro en reintento esa fecha ya corrió un ciclo sin pago (**observado el 2026-09-24, no registrado en la matriz**; FASE 9 completa, C2), y usarla regalaba ese ciclo. **Si un cobro anterior a la baja se acredita después** (`B/05` C2, primera fila), escribe su `covered_period` y la extensión que ese § manda es **`max(fin_de_servicio vigente, la fórmula recalculada)`**: una extensión nunca acorta (FASE 9 vuelta 1, R4, `F-8V1B2-002`). **Precisado el 2026-09-27 (owner, FASE 9 vuelta 2, `R17`, `F-8V2B1-002`): el crédito de `DEC-SUB-006` cuenta como período pagado.** Sobre una sucesora que vive de ese crédito —lo pagado sin usar de la predecesora, convertido en días que corren su primer cobro (`B/12` §5.2)—, **`fin_de_servicio = max(fórmula, fin del crédito)`**, donde **el fin del crédito es la fecha de primer cobro que `DEC-SUB-006` le corrió al crearla**, con la corrección de `B/12` §5.4 si la hubo. **Una fila sin ningún `covered_period`** no tiene entrada para la fórmula, y su fin de servicio es el fin del crédito; **sólo si tampoco tiene crédito** el fin de servicio es el instante de la baja, como en `S24`: como `CANCEL_SCHEDULED` emite fuente sólo hasta esa fecha (`12-contrato…` §2.6), el servicio se corta ahí mismo y `S12` encuentra su fecha ya cumplida. Lo cerrado el 2026-09-25 pensaba sólo en la ventana de 72 h de `B/12` §5.2, y el crédito dura semanas —un cambio de anual a mensual, un arrepentimiento—: la baja cortaba en el acto lo que la persona ya había pagado. **Antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala. **Y en el mismo acto cancela en el proveedor los complementos recurrentes que dependen de ella** (FASE 9 vuelta 2, owner 2026-09-27, `R1-a`, `F-8V2B1-001`). **La selección es la de `S32`**: las filas DE COMPLEMENTO en `ACTIVE`, con su instancia viva, que complementan a esta principal —la `VERTICAL_SUBSCRIPTION` que cuelga de ella, el `LISTING` sobre una ficha de su vertical, y el `USER`/`GLOBAL` cuyo producto declara compatible esa vertical sólo si en ninguna otra vertical compatible queda una principal viva que no esté `PAUSED`, `SUSPENDED` **ni `CANCEL_SCHEDULED`**, ni un ancla viva— (**`CANCEL_SCHEDULED` en la exclusión es la lectura del grupo A de la FASE 9 vuelta 2, confirmada por el owner**: FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-c`; sin ella, un `USER` compatible con dos verticales que se da de baja en las dos cobra un ciclo después de la segunda baja). **La regla es la de la principal**: el correo antes de cada llamada, la relectura de `S17`, y la fila de complemento a `CANCEL_SCHEDULED` **con el mismo `fin_de_servicio` de la principal** —para un `USER`/`GLOBAL`, el más tardío entre las principales compatibles en `CANCEL_SCHEDULED`—. **El complemento sigue dando servicio hasta esa fecha**, la instancia no cambia de estado, y **en esa fecha los cierra `S21`, antes que su propio `S12`**: el `S12` de la principal dispara la orfandad (`A5`), y `S21` toma la fila de complemento y abre el motivo 14 si su último cobro pagó días posteriores (owner 2026-09-27, FASE 9 vuelta 2, `R1-c`; el orden, en la fila de `S12`). (Sale: `S26` y `vertical_discontinuation` se retiraron con la revisión del owner, 2026-09-28, C8, y el motivo que abre `S21` es el de su tabla de disparadores; FASE 9 vuelta 3, `F-8V3B1-007`.) Es lo que `DEC-SUB-009` hace con la principal y lo que `S32` hizo con la pausa y la suspensión (`G2-2`): sin esto el preapproval del complemento, con su propio aniversario, cobraba un ciclo entero después de la baja, y `S21` lo ponía en el motivo 14 con propuesta *no devolver*. **Una fila de complemento que no está en `ACTIVE` no entra**, igual que en `S32`: la alcanza la orfandad cuando `S12` saca a la principal de las filas vivas (`B/16` §4.3)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:161, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:847

<a id="trans-b-s12"></a>

### `TRANS:B:S12` · `S12` — `CANCEL_SCHEDULED` → `CANCELLED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a)
- **Fuente de la asignación**: `B/descomposicion.md:848`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S12](10-corte/B8a.md#tpz-s12) → [B8a](10-corte/B8a.md#pieza-b8a)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `CANCEL_SCHEDULED`
- **evento** (disparador): llega la fecha de fin de servicio — **o se lee `charged_back` en un pago acreditado de la fila, releído por id** (`D17`, `P6`): un contracargo sobre una `CANCEL_SCHEDULED` la pasa a `CANCELLED` **ya, sin esperar su fecha de fin** (`DEC-SUB-020`, su 📌; FASE 8 completa, pendiente 6, owner 2026-09-25)
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): —
- **efectos** (efectos): se corta el servicio; proceso **idempotente**. **Sobre una fila DE COMPLEMENTO, por el primer evento, corre después de su principal y de la orfandad que ella dispara** (owner 2026-09-27, FASE 9 vuelta 2, `R1-c`): en la fecha de fin corre primero el `S12` de las principales, la orfandad corre `A5` → `S21` sobre sus complementos —que los lleva a `CANCELLED` y abre el motivo 14 cuando el último cobro pagó días posteriores a esa fecha (`B/02` §2.5) (sale con C8: la tabla ya no existe; FASE 9 vuelta 3, `F-8V3B1-007`)—, y recién después este `S12` sobre las filas de complemento que sigan en `CANCEL_SCHEDULED`, que son las que la orfandad no alcanzó —un `USER`/`GLOBAL` con otra principal compatible viva—. **Y sobre ese `USER`/`GLOBAL` este `S12` apaga también su instancia** por `A5` (primera cláusula: la baja que la persona pidió la alcanzó por la regla de `S11`), porque su preapproval ya está cancelado y no hay cobro que reanudar (`PA-5`): sin eso la instancia quedaba `ACTIVE` sin ninguna fila que la cobre ni la emita, y la persona la veía viva al volver de la pausa de la otra principal (FASE 9 vuelta 2, verificación, `N-A-02`, arreglo de texto). Vale para la `CANCEL_SCHEDULED` que puso `S11` (`S26` salió con la revisión del owner, 2026-09-28, C8) —y para la que puso la regla de `S11` desde el espejo de `R18` o desde `S7` (owner 2026-09-27, FASE 9 vuelta 2, `R18-b`), **o desde `S22` sobre una fila que vive del crédito** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`)—. Sin ese orden, el `S12` del complemento llegaba primero, `S21` lo encontraba `CANCELLED` y no escribía nada, y el residuo quedaba sin que ninguna persona lo viera. **Por el segundo evento, además, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) con el pago colgado, y **al proveedor no se manda nada nuevo**: el preapproval ya lo canceló `S11`, y si esa cancelación no se confirmó la sigue el reintento del `B/09` §3. **Cerrado el 2026-09-25 (owner)**: **si la fila es la predecesora de una sucesión en curso, por el segundo evento corre `S31` sobre su sucesora**, igual que tras `S6` por el tercero (FASE 8 completa, pendiente 8, owner 2026-09-25). `S31` encuentra a la sucesora por su `sucede_a`, que `S18` limpia, así que corre antes de que `S18` evalúe; si la deja `ABANDONED`, `S18` no corre —su `desde` es una sucesora viva— y la sucesión se cae, como en `S3`. **Y el aviso a la persona es el mismo correo de contracargo** (`NUCLEO/07` §6, `B/19` §4 fila 10-ter; orquestador, FASE 8 completa, pendiente 8)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:162, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:848

<a id="trans-b-s13"></a>

### `TRANS:B:S13` · `S13`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9a](10-corte/B9a.md#pieza-b9a)
- **Fuente de la asignación**: `B/descomposicion.md:849`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S13](10-corte/B9a.md#tpz-s13) → [B9a](10-corte/B9a.md#pieza-b9a)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): **toda fila viva PRINCIPAL** del beneficiario en **cada vertical que el acto ancla** (`B/02` §2.4, `permanent_grant_vertical`) — los seis estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos. **Las de complemento no entran** (ver abajo, *«y no alcanza a los complementos»*)
- **evento** (disparador): `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a un grant vivo** (`12-contrato…` §2.8, `NUCLEO/01` §2.4)
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): —
- **efectos** (efectos): §35.3: se cancela toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); **se cancela el preapproval de cada una** en el proveedor —autorizado o esperando autorización— con la misma regla de `S17`: si la relectura dice que ya está `cancelled`, no se manda nada; **y antes de cada llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, esa cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala; el acceso pasa a darlo el grant. **Y si alguna de las filas alcanzadas retenía un pago pendiente por `S19`, la bandera se apaga en el mismo acto, sin reembolso** — es la rama 4 de `B/12` §5.3, y apagarla es parte de la decisión: dejarla puesta sobre una `CANCELLED` deja un *«pendiente»* que ningún barrido alcanza y que todo conteo de pagos pendientes cuenta de más. **Y si el beneficiario tiene una cortesía DIFERIDA en alguna de las verticales que el acto ancla, su saldo se CIERRA acá**: `saldo_cerrado_en` y `motivo_cierre = GRANT_PERMANENTE_OTORGADO` (`B/02` §2.4). No es una cortesía **vigente** —ésa termina porque esta misma transición cancela la suscripción que la pausaba (`B/14` §4.3)—: es un saldo esperando una fila que después de este acto **ninguna de las dos rutas de re-emisión de `S9` vuelve a alcanzar**, así que dejarlo abierto lo dejaría sin dueño y sin vencimiento. **Escribir un cierre ya escrito no escribe nada**, como el resto de la fila. **Proceso idempotente y reanudable fila por fila**, con su detector en `B/09` §3 (ver abajo, *«la ejecución parcial»*) **Y si la fila estaba `PAUSED`, cierra la pausa escribiéndole `fin_real`**, como `S22` (FASE 8 completa, `F-8CD1-007`; `S25` salió con la revisión del owner, 2026-09-28, C8)

**Texto de la fuente — «`S13` alcanza a toda fila viva PRINCIPAL, no a una — y no alcanza a los complementos»** (`B/03-maquinas-de-estado.md:957–1015`, sin lo tachado):

El §35.3 ordena *«cancelar toda obligación de pago cubierta»*, en plural, y el origen de `S13`
enumeraba **cuatro** estados y una sola fila. *«Cubierta»* se lee contra el scope del grant, que
desde `B/02` §2.4 **no es una columna sino sus anclas**: una por vertical. Los dos estados que
faltaban no son bordes:

- **`PENDING_AUTHORIZATION` es el caro.** Una sucesora esperando autorización **es una obligación
  de pago**: su preapproval está creado y la persona puede completar el checkout en cualquier
  momento —no tiene por qué saber que el grant llegó—, y entonces `S2` la lleva a `ACTIVE` con una
  fecha de primer cobro que `B/12` §5.2 puso **días después** del grant. El beneficiario de *Free
  Forever* terminaba pagando todos los meses una suscripción que el grant le regaló, y nada lo
  detectaba: la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
  **coincide**. Por eso el efecto de `S13` cancela el preapproval **esté autorizado o esperando
  autorización**, y por eso la pantalla de *«esperando que completes el pago»* del §3.4 punto 3
  —con su enlace para retomar— tiene que dejar de ofrecer ese enlace en el mismo acto.
- **`CANCEL_SCHEDULED` entra por completitud**: no tiene obligación de pago viva —`S11` ya canceló
  su preapproval— pero dejarla afuera obligaba a leer la ausencia como una excepción. Entra, y la
  regla de *«ya está `cancelled`, no se manda nada»* hace que no cueste una llamada.

**Y son DOS los eventos que disparan `S13`, no uno, porque son dos las escrituras que hacen que un
grant cubra.** El origen escribía sólo *«`SUPER_ADMIN` otorga *Free Forever*»*, que era exacto
mientras el scope era **una columna del instrumento**: cambiarlo era editar el grant. Desde que el
scope **es el conjunto de anclas** (`B/02` §2.4), **anclarle una vertical nueva a un grant vivo es
un acto propio** —así lo declaran `12-contrato…` §2.8 y `B/02` §2.4— y **hace cubrir exactamente
igual que el otorgamiento**: emite en esa vertical una fuente `GRANT` de clase `TÍTULO` con
`hasta: NO_VENCE` (`12-contrato…` §2.7 y §2.4). Sin el segundo evento, el beneficiario de un grant
extendido a Gastronomía **sigue pagando todos los meses la suscripción de Gastronomía que el grant
le acaba de regalar**, y —otra vez— nada lo detecta: la fila está `ACTIVE`, el proveedor dice
`authorized`, y para el barrido eso **coincide**. Es el mismo daño que este § vino a cerrar,
entrando por la puerta que el acto nuevo abrió.

**El alcance se lee contra el acto, no contra el grant entero:**

| el evento es | `S13` alcanza |
|---|---|
| **otorgar** un *Free Forever* | toda fila viva **principal** del beneficiario en **cada** vertical que el grant ancla ese día |
| **anclarle una vertical nueva** a un grant vivo | toda fila viva **principal** del beneficiario **en esa vertical**, y en ninguna otra |

Las verticales que el grant ya anclaba **no se vuelven a recorrer**: sus filas vivas ya las cerró
el otorgamiento, y volver a pasar por ellas no haría daño —`S13` es idempotente, ver más abajo—
pero gastaría una llamada al proveedor por fila para no cambiar nada. La consecuencia queda dicha
en voz alta: **el acto nuevo le agrega a `S13` un segundo disparador, así que la ejecución parcial
de `S13` tiene dos orígenes y no uno**, y el detector del final de este § tiene que cubrir los dos.

**Si el grant cae en medio de una sucesión, `S13` alcanza a las dos filas y la sucesión no se
cierra: se cancela.** No corre `S18` —no queda ninguna sucesora viva a la que pasarle el origen, y
su `desde` pide una— y la sucesora queda `CANCELLED` con su `sucede_a` escrito, que es el registro
fiel de lo que pasó: es el **cuarto** estado de la relación de la tabla de arriba, *«sucesión
muerta sin cerrarse»*, y es la razón por la que los predicados que leen ese puntero exigen que
quien lo escribió **siga vivo**.
No ocupa ningún candado, porque los dos índices son parciales sobre las filas vivas, y no dispara
`G-R1-A`, que desde `B/20` §2 mira **el acto de declarar** y no una propiedad permanente de la
fila.

**Esto vuelve verdadera una afirmación de `B/14` §4.3** —*«sobre un grant no se otorga cortesía
… porque no queda nada que no cobrar»*—, que con `S13` alcanzando una sola fila era falsa
exactamente en este camino.

**Texto de la fuente — «La ejecución parcial: `S13` es idempotente, y su detector cuesta cero llamadas»** (`B/03-maquinas-de-estado.md:1082–1119`, sin lo tachado):

**`S13` es un fan-out**, y desde que el scope son anclas es un fan-out de N verticales × hasta seis
estados, **con una llamada al proveedor por fila** y con **dos disparadores** que lo pueden lanzar.
Su vecina `S12` cierra su efecto con *«proceso idempotente»* y `S13` no decía nada, así que nada
declaraba qué pasa si la corrida muere entre la vertical 2 y la 3.

> **`S13` es idempotente y reanudable fila por fila.** Volver a correrlo sobre una fila que ya
> cerró no escribe nada y no manda nada —la regla de `S17` ya dice que si la relectura ve el
> preapproval `cancelled` no se manda nada—, así que **reanudar es volver a correr el acto
> entero**, no llevar un cursor.

**Y la idempotencia sola no alcanza, porque el estado que deja una corrida cortada es
indetectable.** Lo dice este mismo § al justificar por qué `PENDING_AUTHORIZATION` entró en el
alcance: *«la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
**coincide**»*. Esa frase describe el defecto que el alcance vino a cerrar **y sigue siendo
verdadera** para la vertical que la corrida no alcanzó. Por eso el detector va aparte y es la
**tercera comprobación de cero llamadas** de `B/09` §3: *«un beneficiario con un ancla viva en la
vertical V no debería tener una fila viva principal en V»*. Las dos filas están en nuestra base,
igual que las de las otras cinco comprobaciones.

**Y `S20` corre en el mismo acto, con el mismo fan-out y el mismo modo de falla, así que la
tercera comprobación lo cubre a él también.** No es una comprobación nueva: es la misma
pregunta sobre el otro conjunto —*«…ni una fila viva de complemento de un addon compatible en
V»*—, y hace falta por la razón de siempre, escrita con las mismas palabras: la fila de
complemento dice `ACTIVE`, el proveedor dice `authorized`, **y para el barrido eso coincide**.
Una corrida que muere después de cerrar las principales y antes de llegar a los complementos deja
al beneficiario **pagando un addon que el flag le declaró gratis**, que es exactamente el defecto
que `S20` vino a cerrar, entrando por la puerta de la ejecución parcial.

**`S14` y `S15` quedan en la tabla y ya no son transiciones de estado.** Se listan acá porque son
los dos eventos que el §22.1 gobierna y nadie los debe buscar en otro lado, pero **ninguna de las
dos mueve la columna de estado**: la primera **abre** una marca con su motivo, la segunda levanta
**una** de las abiertas (`B/02` §2.5). Si al resolver
corresponde además un cambio de estado, ése se ejecuta **con la transición de esta misma tabla que
lo permita** — y eso es justamente lo que se ganó, porque antes `S15` tenía que adivinar a dónde
volver.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:163, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:849, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:957, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1082

<a id="trans-b-s14"></a>

### `TRANS:B:S14` · `S14` — cualquiera → **el mismo estado**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:850`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S14](10-corte/B3.md#tpz-s14) → [B3](10-corte/B3.md#pieza-b3)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): cualquiera
- **evento** (disparador): divergencia que toca plata o estado
- **hacia** (estado destino): **el mismo estado**
- **condición** (guardas): —
- **efectos** (efectos): **se abre una marca `requiere_conciliación`** y se emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas automáticas**. **`S14` es el ACTO y no el motivo**: el motivo lo trae el caso que lo disparó —son **trece** de los **veinticuatro** de `B/02` §2.5 —el 23 lo abre el barrido, no `S14` (FASE 9 vuelta 2, `R4`); el 24 sí, desde la comparación de cobros del `B/09` §3 (FASE 9 vuelta 2, `R20`)— (FASE 8 completa, `F-8CB1-013`; y el 17, el 18 y el 19 con `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`; y el 20 con la pendiente 6, owner 2026-09-25; y el 22 con `F-8CB2-003`, FASE 9 completa —el 21 lo abre el barrido, no `S14`—; recontados sobre esa tabla)— exactamente como el motivo de una pausa lo traen `S8` o `S9`. Una marca sin motivo declarado no es escribible: `G-R1-F` (`B/20` §2) la rechaza. **Y abrir es ACUMULATIVO**: si la fila ya tiene una marca abierta con ese motivo, `S14` **no abre una segunda y tampoco descarta el hecho** — le cuelga a la abierta el pago que el caso trae (`reconciliation_mark_payment`, `B/02` §2.2) y vuelve a emitir el §22.1. Sin eso el `UNIQUE` rechazaba el `INSERT` y **la plata del segundo cobro en adelante quedaba sin ninguna fila que la nombrara**. **Colgar un pago escribe la marca** (FASE 9 vuelta 1, `F-8V1B2-001`): en la misma transacción que inserta en `reconciliation_mark_payment`, `S14` le sube la versión a la `reconciliation_mark` con la condición `levantada_en IS NULL` (§10.3). Si esa escritura no encuentra la marca abierta porque `S15` la levantó en el medio, `S14` abre una nueva: el `UNIQUE` parcial la admite

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:164, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:850

<a id="trans-b-s15"></a>

### `TRANS:B:S15` · `S15` — cualquiera **con una marca abierta** → **el mismo estado**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:851`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S15](10-corte/B3.md#tpz-s15) → [B3](10-corte/B3.md#pieza-b3) — nota de la fuente: «la guarda contra una interfaz que implementa `B5` (BY)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): cualquiera **con una marca abierta**
- **evento** (disparador): una persona resuelve
- **hacia** (estado destino): **el mismo estado**
- **condición** (guardas): intervención humana registrada, **y ningún pago colgado de esa marca sin resolver**
- **efectos** (efectos): **se levanta UNA marca —la del motivo que esa persona resolvió—, no la fila**: se le escriben `levantada_en` y quién la levantó (`B/02` §2.2), y **las demás marcas abiertas siguen abiertas**. Con un booleano, resolver una divergencia de monto apagaba en el mismo gesto un `REEMBOLSO_POR_CONFIRMAR` que nadie había mirado. **Y la guarda es la mitad que faltaba**: una marca puede llevar **N** pagos colgados (`B/02` §2.2) y levantarla con alguno sin `resuelto_en` cierra el caso **con esa plata adentro**, que es exactamente lo que hacía la persona que resolvía bien el único pago que el listado le nombraba. Si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo permita**. **Y escribe `levantada_en` contra la versión de la marca que leyó** (§10.3; FASE 9 vuelta 1, `F-8V1B2-001`): si un `S14` le colgó un pago en el medio, la escritura falla, se relee y la guarda ya no se cumple. No agrega mecanismo: es la concurrencia optimista del §10.3 aplicada a la marca, que es una fila con estado —abierta o levantada—; **la guarda *«ningún pago colgado de esa marca sin resolver»* lee `reconciliation_mark_payment`, que nace en `B5` (BN): `B3` la escribe contra una interfaz interna, y `B5` trae su implementación y prueba el rechazo con filas sembradas** (corte del MVP, owner 2026-10-02, BY)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:165, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:851

<a id="trans-b-s16"></a>

### `TRANS:B:S16` · `S16` — `ACTIVE` → `CHARGE_DECLINED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:852`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S16](10-corte/B3.md#tpz-s16) → [B3](10-corte/B3.md#pieza-b3)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`
- **evento** (disparador): el **primer** cobro se rechaza — **el primer rechazo leído por id** en la lectura de `B/09` §4 (FASE 8 completa, owner 2026-09-25)
- **hacia** (estado destino): `CHARGE_DECLINED`
- **condición** (guardas): **es el primer cobro DE ESA autorización** —**la fila no tiene ningún pago acreditado** (`B/09` §4), que es la guarda complementaria de la de `S4` (FASE 8 completa, `F-8CB2-006`)—. **Y la fila no es la sucesora de una predecesora que venía pagando**: ésa va a `S4` (owner 2026-09-25; FASE 9 completa, 3c). Sigue siendo complementaria de la de `S4`, ahora sobre dos datos —*«tiene pago acreditado»* y *«su predecesora tenía»*—, y queda para `S16` el alta, la sucesora de una predecesora que nunca cobró y la sucesora de una `SUSPENDED` de tarjeta (que cobra al autorizar, `B/12` §4.3). **Ya no exige que el proveedor la haya cancelado**: sólo está medido que cancela ante el antifraude (`PA-6`, `UNKNOWN`), y con otro motivo el rechazo quedaba sin fila (FASE 8 completa, owner 2026-09-25)
- **efectos** (efectos): **se cancela el preapproval DE NUESTRO LADO, con la regla de relectura de `S17`** —si la relectura ya lo ve `cancelled`, que es lo medido ante el antifraude (`B/12` §4.4), no se manda nada, **y la fila no se da por terminada en esa relectura: el barrido la sigue releyendo durante la ventana de relectura de la cancelación por rechazo** (`NUCLEO/02` §1.5; `B/09` §3, criterio de exención), porque un preapproval que el proveedor canceló ante un rechazo puede volver a leerse `authorized` horas después (`EX-45`; FASE 9 vuelta 3, owner 2026-09-30, lote K)—, **y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y **la reintenta el barrido** (salvedad 4 de `B/09` §3); si no hay destinatario, se cancela igual y el no-entregable se escala. **La fila llega a `CHARGE_DECLINED` pase lo que pase con la llamada** (FASE 8 completa, owner 2026-09-25). No hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva**. **Lo que se le dice a la persona sale de POR QUÉ la rechazaron** —el `status_detail` de ese único intento, con un mapa y un genérico obligatorio (`DEC-MP-004`, `B/19` §4 fila 19)—: al rechazado por el antifraude del proveedor no se le pide que revise una tarjeta que funciona — **salvo que la fila fuera la predecesora de una sucesión**, y ahí el reintento es **terminar el checkout que ya está abierto**: `S18` cierra la sucesión en el acto y la sucesora ocupa el candado `A` (§3.3.1)

**Texto de la fuente — «El primer rechazo lo reclamaban tres filas: manda `S16`, y el orden de llegada ya no decide»** (`B/03-maquinas-de-estado.md:214–284`, sin lo tachado):

(FASE 8 completa, `F-8CB2-006`, `F-8CB1-010`.) Sobre un primer cobro rechazado **aplicaban tres
cosas a la vez**: `S4` —*«un cobro falla»*, sin condición—, `S16` —*«el primer cobro se rechaza»*— y
el espejo de la baja del proveedor (§10.1), si el aviso de la cancelación se procesaba antes que el
del pago. Según cuál llegara primero, la fila terminaba en `GRACE_PERIOD` —**los diez días gratis por
intento** que `B/12` §4.3 cerró—, en `CHARGE_DECLINED` o en `CANCELLED`, y en este último caso el
correo de `DEC-MP-004`, que distingue el antifraude de la tarjeta, no salía.

> **Sobre una autorización sin ningún pago acreditado manda `S16`** (`B/12` §4.4: *«es un alta que
> no ocurrió»*). **`S4` exige que la fila tenga al menos un pago acreditado**, y **el espejo de un
> `cancelled` sobre una fila `ACTIVE` sin ningún pago acreditado le cede el paso a `S16`** (§10.1).
>
> **Salvo la sucesora de una predecesora que venía pagando** (owner 2026-09-25; FASE 9 completa,
> 3c, contra la recomendación): su primer cobro fallido la lleva a `S4` y al grace, no a `S16`, y
> el barrido relee su preapproval cada día —si el proveedor lo canceló o lo pausó, `S6` corre en el
> acto—. Sobre ella, el espejo de un `cancelled` tampoco le cede el paso a `S16`: es el quinto
> evento de `S6` (§10.1).

**Las guardas de `S4` y `S16` son complementarias por dos datos** —*«la fila tiene al menos un
pago acreditado»*, y su predecesora tenía—, que es la forma que la regla 7 del núcleo exige (`NUCLEO/03` §1); **el primero es el que el contrato transporta como
`cobrada`** (`12-contrato…` §2.1), y los dos juntos son **«pagando»** (`NUCLEO/01` §2; FASE 9 vuelta 1,
`F-8V1D1-002`: desde la decisión 3c son dos datos, como ya dice la fila `S16`). **Y el trial no se entera del rechazo**: la fila nunca llegó a `cobrada: sí`, así que
tampoco lo había convertido (`12-contrato…` §2.1; `DEC-TRIAL-010`), y quien estaba en su trial
sigue ahí.

**Lo que esto no toca**: la fila 11 de la tabla de la predecesora (abajo), `S4` durante una
sucesión en curso, sigue valiendo para una predecesora que ya cobró; una que no cobró nunca —el alta
que cambió de plan el mismo día, `B/12` §4.4 punto 1— cae ahora en la fila 6, `S16`.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**:
>
> 1. **`G-R4` no cuenta a `S4`/`S16` como un par**, porque sus eventos están escritos distinto
>    —*«un cobro falla»* y *«el primer cobro se rechaza»*—, aunque el segundo sea un caso del
>    primero. La disyunción la sostienen las guardas escritas, no el guard; los tres pares que
>    `NUCLEO/03` §1 enumera (revisión del owner, 2026-09-28, C8: sale `S10`/`S25`) no se mueven por esto.
> 2.
>    **CERRADO por el owner el 2026-09-25** (FASE 8 completa, residuo A de `R12`; `F-8CB1-010`):
>    **`S16` corre sobre el primer rechazo leído por id y cancela el preapproval de nuestro lado**,
>    con el correo antes y la relectura de `S17` (fila `S16` del §3.2), **sin depender de que el
>    proveedor lo haga**. La pregunta quedó escrita como `PA-6` y **no bloquea**: si el proveedor
>    ya canceló, la relectura lo ve y no se manda nada; si reintenta, lo cortamos nosotros. **Si
>    nuestra cancelación falla, la reintenta el barrido**: `S16` entra en la salvedad 4 de `B/09`
>    §3. La fila ya no queda `ACTIVE` sin cobrar durante la ventana de reintentos del proveedor.
> 3. **Qué correo recibe la persona en `S16` cuando la llamada sí sale** (FASE 8 completa, residuo
>    de la decisión anterior, declarado por `DEC-METH-015`). `S16` ya tenía el suyo —*«el alta
>    rechazada»*, `NUCLEO/07` §6— y ahora lleva además la condición del correo *«antes de
>    cancelar»* del mismo catálogo; si el primero cumple la condición del segundo o salen los dos no
>    está escrito. **Causa**: la cancelación de nuestro lado se agregó sobre una fila que ya tenía su
>    aviso. Es de borde —un correo de más o de menos, ninguno mueve plata— y no se abre como
>    pendiente. Cuando la relectura ya ve `cancelled` no hay llamada y la pregunta no aparece.
> 4. **Una cuarta fila todavía lo puede reclamar: el `paused` del proveedor** (§10.1, `S6` por su
>    segundo evento), que no le cede el paso a `S16` como el `cancelled` (FASE 9 completa,
>    `R12-BORDE-1`, declarado por `DEC-METH-015`). Pasa sólo si el primer rechazo no se leyó por id
>    en toda la ventana de reintentos del proveedor. En ese caso el alta que no ocurrió termina en
>    `SUSPENDED` en vez de `CHARGE_DECLINED`: vuelve por sucesión, no por alta nueva, y recibe el
>    correo de suspensión en vez del de `DEC-MP-004`. **Causa**: la cesión a `S16` se escribió sobre
>    la fila `cancelled` del espejo, que era la que el hallazgo nombraba. No mueve plata, porque
>    `S6` cancela el preapproval, y no toca el trial, porque `SUSPENDED` no emite.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:166, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:852, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:214

<a id="trans-b-s17"></a>

### `TRANS:B:S17` · `S17`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:853`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S17](20-fase-2/B8b.md#tpz-s17) → [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): la **predecesora**, si **sigue siendo fila viva** — las cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`
- **evento** (disparador): su sucesora quedó **autorizada**, confirmado por relectura
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): la fila tiene una **sucesora viva** con `sucede_a` apuntándola
- **efectos** (efectos): **se cancela en el proveedor si su preapproval sigue vivo** (es `D7`); si la relectura dice que ya está `cancelled`, `D7` **ya está cumplido y no se manda nada**. **Y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta y **`S17` no ocurre en esta corrida** —la misma puerta que la llamada fallida (`B/09` §3)— y su condición, que es sobre un estado, se vuelve a evaluar; si no hay destinatario, se cancela igual y el no-entregable se escala: es el caso por el que se precisó la regla, porque sin eso la predecesora no se cancelaba nunca y **cobraban las dos**; **y si el correo agota sus reintentos (`failed` definitivo del outbox), tampoco bloquea: se cancela igual y se escala como no-entregable**, por la misma razón —un `failed` es una falla que no pasó, y esperarlo dejaba a `S17` sin ocurrir nunca y a las dos cobrando— (owner 2026-09-25; FASE 9 completa, decisión 1; precisa `DEC-MAIL-001`). **Y si la fila estaba `PAUSED`, cierra la pausa escribiéndole `fin_real`**, como `S22` (FASE 8 completa, `F-8CD1-007`; `S25` salió con la revisión del owner, 2026-09-28, C8)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:167, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:853

<a id="trans-b-s18"></a>

### `TRANS:B:S18` · `S18`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:854`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S18](20-fase-2/B8b.md#tpz-s18) → [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): la **sucesora viva**: en `ACTIVE`, **o en `PENDING_AUTHORIZATION` cuando la predecesora se murió sola** (revisión del owner, 2026-09-28, C8)
- **evento** (disparador): la misma autorización que disparó `S2`; **o la predecesora dejó de ser fila viva sin `S17` — por `S12`, por `S16`, por el espejo de la baja decidida por el proveedor (§10.1), o porque pidió la baja ella misma estando pausada (`S22`), suspendida (`S23`) o en el grace (`S24`)**, **o porque se registró su revocación del derecho de arrepentimiento (`S36`; owner 2026-09-26, FASE 9 vuelta 1, M)**; o una resolución de `S15` sobre la sucesión trabada
- **hacia** (estado destino): **el mismo estado**
- **condición** (guardas): la predecesora **ya no es fila viva**
- **efectos** (efectos): **cierra la sucesión, y es el único acto que lo hace.** Son **cinco** escrituras: se escribe **`sucedida_por`** en la predecesora; se **limpia `sucede_a`** en la sucesora; **lo que colgaba de la predecesora y se puede re-apuntar se re-apunta a la SUCESORA** —los **complementos** (`B/16` §4.2), con el inventario completo en `B/02` §2.6—; **la redención de promo NO se re-apunta: la promo se pierde con el cambio de plan** y se queda colgando de la predecesora, sin que se escriba nada (`B/14` §2.2; FASE 8 completa, pendiente 7, owner 2026-09-25); **si la predecesora tiene una cortesía vigente, NO se re-apunta: se CIERRA sobre ella y se le escribe el `saldo_meses`** que le quedaba (la fracción de mes se redondea **para arriba**, `B/02` §2.4; **y si la sucesora es de plan no mensual —trimestral, semestral o anual—, el saldo no se escribe: se CIERRA con `motivo_cierre = DESTINO_DE_PLAN_NO_MENSUAL`**, porque ahí no hay cortesía temporal (FASE 9 completa, contradicción 1 de `03` §R4.5), y la persona lo supo antes de elegir el plan, `B/19` §4 fila 13-quater (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25)), para que `S9` la re-emita sobre la sucesora cuando ésta llegue a `ACTIVE` (`DEC-GRANT-007`, `B/14` §4.4); y **si la predecesora retiene un pago pendiente por `S19`, se le abre a ELLA una marca `requiere_conciliación` con motivo `REEMBOLSO_POR_CONFIRMAR`**, con **el pago colgado de ella** (`B/02` §2.2 y §2.5; ramas 1, 5 y 6 de `B/12` §5.3, `DEC-RF-002`). **Salvo cuando la predecesora murió por `S36`**: ese pago lo devuelve el `RF1` de `S36` y `S18` no abre marca sobre él (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-o`). La sucesora pasa a ser el origen

**Texto de la fuente — «Por qué `S18` también sale de `PENDING_AUTHORIZATION`: el candado `A` no se puede quedar vacío»** (`B/03-maquinas-de-estado.md:534–567`, sin lo tachado):

**Cuando la predecesora se muere sola —por `S12`, por `S16`, por el espejo del §10.1, o porque ella
misma pidió la baja estando pausada (`S22`), suspendida (`S23`) o en el grace (`S24`), o revocó
dentro de los 10 días (`S36`; FASE 9 vuelta 1, M)—, el candado
`A` queda VACÍO y la sucesora no lo ocupa.** Es aritmética de los índices parciales de `B/02` §2.2: `A` es
`UNIQUE (user_id, vertical) WHERE clase = principal AND sucede_a IS NULL AND estado ∈ {vivos}`, la
predecesora ya no está entre los vivos, y la sucesora tiene `sucede_a` **no nulo**, así que cae en
`B`. **Ninguna fila ocupa `A`, y la base deja entrar un alta nueva** — que es exactamente lo que
`B/12` §4.4 le pedía al cliente hacer después de un primer cobro rechazado. Ahí hay **dos
preapprovals que pueden autorizar y cobrar**, y `EX-6` mide que el proveedor no frena la segunda.
Y el daño se vuelve permanente dentro de la misma ventana: cuando la sucesora autoriza, `S18`
tiene que limpiar `sucede_a`, y esa escritura **la rechaza la base** porque la sucesora pasaría a
competir por `A` con el alta nueva. La sucesión no se cerraría nunca.

**Por eso el cierre no espera a la autorización cuando no hay nada que esperar.** Muerta la
predecesora por cualquiera de esos **siete** caminos (FASE 9 vuelta 1, M: eran seis ya antes de `S36`), la sucesora **ya es el único compromiso** de ese
`user + vertical`: el cierre la vuelve origen en el acto, ocupa `A` con ella —`PENDING_AUTHORIZATION`
está entre los vivos— y el segundo `INSERT` lo rechaza la base, que es la premisa que el §3.4
punto 4 necesita para ser verdadera. Lo que el cliente ve entonces **no es *«empezar de nuevo»***:
es el aviso del §3.3.1, *«terminá o cancelá el checkout que tenés abierto»*, con su enlace para
retomar y su fecha de vencimiento. No queda bloqueado —abandonar lo deja en `ABANDONED`, que no es
vivo, y desde ahí el alta nueva entra sin pelear con nada— y el tope es la ventana de esa fila (§3.4 punto 1).

**Y no se cierra una sucesión que todavía podría no ocurrir: se cierra una que ya no tiene otro
final.** La predecesora está muerta por su propia cuenta, sin reversa (`CANCELLED` no revive,
`CHARGE_DECLINED` **lo canceló `S16` al leer el primer cobro rechazado —de nuestro lado, o ya lo había hecho el proveedor—, y llega ahí pase lo que pase con la llamada** (FASE 9 completa, C-R12-2), y la baja que el espejo escribe **la
decidió el proveedor**), así que *«fue sucedida»* es el
registro fiel. Si después la sucesora abandona, la persona queda sin fila viva y puede dar de alta
de nuevo — **el mismo desenlace que tendría si nunca hubiera declarado la sucesión, con una sola
excepción y es la de abajo**: si la predecesora tenía una cortesía, declarar la sucesión la dejó
**diferida**, y el abandono la **cierra** (`DEC-GRANT-011`). Para todo lo demás —el candado, el
alta nueva, lo que puede comprar— la sucesión abandonada no deja rastro.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:168, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:854, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:534

<a id="trans-b-s19"></a>

### `TRANS:B:S19` · `S19`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:855`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S19](10-corte/B7.md#tpz-s19) → [B7](10-corte/B7.md#pieza-b7)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): la **predecesora** de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED`
- **evento** (disparador): **entra el pago del período impago, por cualquiera de sus DOS puertas**: la cuota que el proveedor sigue reciclando —**en un pagador con tarjeta, sólo mientras la fila sigue en `GRACE_PERIOD`: `S6` cierra esa puerta al cancelar el preapproval al pasar a `SUSPENDED`**, `DEC-SUB-019`—, **o** el pago que el admin registra a mano (`MP1` **o `MP4`**, §7), **que es la puerta del pagador manual**: un pagador con tarjeta no tiene cuotas. **Una `SUSPENDED` de tarjeta no tiene, entonces, ninguna puerta ordinaria**: sólo los bordes de un cobro en vuelo en el instante de `S6` o de un preapproval reactivado a mano
- **hacia** (estado destino): **el mismo estado**
- **condición** (guardas): la fila tiene una **sucesora viva** con `sucede_a` apuntándola
- **efectos** (efectos): **el pago se registra y queda pendiente de resolución** —sea un `payment` o un `manual_payment` (`B/02` §2.3)—: no reactiva, no se reembolsa todavía y **no pone la marca todavía** — es un caso diseñado y no una divergencia, así que `S14` no aplica; **la marca la abre `S18` al cerrar, con motivo `REEMBOLSO_POR_CONFIRMAR`, y sólo en las ramas 1, 5 y 6**, y en la 6 no cuando la baja es `S36`, que lo devuelve por su `RF1` (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-o`). Su destino lo decide **cómo termina la sucesión**, con las **seis** ramas de `B/12` §5.3. Mientras esté pendiente, `S6` no corre

**Texto de la fuente — «`S19`: el pago que entra en plena sucesión no reactiva, y tampoco se pierde»** (`B/03-maquinas-de-estado.md:694–798`, sin lo tachado):

**La predecesora ya no llega a la sucesión desde `GRACE_PERIOD`
—desde ahí no se declara, `DEC-SUB-021` (owner 2026-09-25)—: llega al grace DURANTE la ventana,
por `S4`, sobre una sucesión declarada en `ACTIVE`, y su cuota impaga sigue en `recycling` del lado
del proveedor**, que la reintenta solo (`B/12` §1.3, medido). **En un pagador con tarjeta
eso dura sólo hasta que `S6` la pasa a `SUSPENDED`: ese acto cancela el preapproval y cierra la
puerta del reciclado** (`DEC-SUB-019`), y como la puerta manual es del pagador manual, lo único que
puede seguir llegando ahí es un borde: un cobro en vuelo en el instante de `S6`, o una reactivación
a mano. Si entra durante la ventana
de autorización, `S5` la devolvía a `ACTIVE` —y `S7`, si `S6` ya la había pasado a `SUSPENDED`—: dos filas
vivas, el crédito de la sucesora ya computado **sin ese pago** —en cero cuando se
declaraba desde el grace; declarada en `ACTIVE`, se computó antes de que ese período existiera—, y
un período pagado que `S17` se lleva puesto. Es el daño que `B/12` §5.3 describe entero.

**La regla que lo impide tiene que estar en esta tabla, no sólo en la prosa de otro capítulo**, y
ésa es la regla 1 del núcleo: lo que la tabla no declara, no pasa. Por eso son tres escrituras y no
una: la condición en `S5` y en `S7` —que es la que **no reactiva**— y `S19`, que es la que declara
**qué sí pasa**. Sin `S19`, el pago entrante sería una transición no declarada y la regla 1 lo
mandaría a la marca, convirtiendo el camino
normal de una sucesión cuya predecesora entra en el grace durante la ventana (`DEC-SUB-021`) en un
incidente.

**El evento son DOS puertas y no una, y escribirlo con una sola suspendía a quien había
pagado.** La versión anterior decía *«entra el pago de la cuota que sigue en `recycling`»*, y
`recycling` es un estado **del proveedor** (`B/12` §1.3, medido). Pero el pago del período impago
tiene una segunda puerta declarada en este mismo capítulo: **el pago manual (§7)**, cuya primera
fila es `MP1` —la segunda, `MP4`, entra por lo mismo y está abajo— y que
*«queda pendiente por `S19`, si es la predecesora de una sucesión en curso»* y cuyo principio
escrito es que **el daño no depende de por qué puerta entró el pago**. Con el evento atado al
reciclado, el pago manual **no matcheaba ninguna fila**: por la regla 1 del núcleo el intento no
se ejecutaba y se iba a la marca —el desenlace que este § existe para impedir—, y peor,
**`S6` seguía corriendo**. Su condición no pregunta si entró plata: pregunta si hay *«un pago
acreditado del período pendiente de resolución **por `S19`**»*, y si `S19` no corrió no hay nada
pendiente por `S19`, así que el reloj vencía y mandaba a `SUSPENDED` —que no emite fuente
(`12-contrato…` §2.6)— a alguien que había transferido la plata y tenía comprobante. **El evento
se enuncia sobre el hecho —entró el pago del período impago— y no sobre el mecanismo que lo
trajo.**

**Y no hay una tercera puerta que el evento deje afuera.** Las formas de que entre plata del
período impago son exactamente dos, y las dos están declaradas: el reciclado del proveedor
(`B/12` §1.3) y el pago manual (§7). **Son una por método de pago, no dos para la misma persona**:
el reciclado es del pagador con tarjeta —y desde `DEC-SUB-019` dura sólo mientras la fila sigue en
`GRACE_PERIOD`, porque `S6` cancela el preapproval al suspender—, y el pago manual es del pagador
manual, que no tiene preapproval. **La puerta manual tiene DOS filas y sigue siendo una sola
puerta**: `MP1`, desde `AWAITING`, y `MP4`, desde `DECLARED_UNPAID`. El evento de `S19` las cubre
a las dos sin nombrarlas porque **se enuncia sobre el hecho —entró el pago del período impago— y
no sobre el mecanismo que lo trajo**, que es la misma razón por la que dejó de estar atado al
reciclado.

**Y por esa segunda fila `S7` SÍ es alcanzable desde la puerta manual, que es lo contrario de lo
que este párrafo decía.** Decía que un pago manual sobre una `SUSPENDED` no era una tercera puerta
porque *«`MP1` sale de `AWAITING`, y la única forma de que la suscripción de un pagador manual
llegue a `SUSPENDED` es `MP2` o `MP3`, que sacan al `manual_payment` de `AWAITING` en el mismo
acto — así que por esta puerta `S7` es inalcanzable»*. La aritmética era correcta y la premisa
caducó: desde `MP4` hay una transición que **sale** de `DECLARED_UNPAID`, así que el pago que el
admin registra tarde llega sobre una fila `SUSPENDED` y `S7` es exactamente su destino. La
conclusión que **no** cambia es la de este §: si esa fila es la predecesora de una sucesión en
curso, `S7` **no** corre y el pago queda pendiente por `S19`, con su condición 3 del `B/05` §3 sin
cumplir. `MP4` hereda esa condición igual que `MP1`, y por el mismo motivo escrito — *«el daño no
depende de por qué puerta entró el pago»*.

**Lo que este § dejaba declarado abierto ya está resuelto, y no acá.** Decía que qué pasa con un
pago manual que llega **después** de `DECLARED_UNPAID` *«es una decisión de producto que no es de
`S19`»*, y tenía razón en las dos mitades: la decisión la tomó el owner el 2026-09-21 —**se puede
reabrir**— y la ejecuta `MP4`, en el §7.1, que es donde vive la máquina del pago manual. Lo que
`S19` aporta es lo de siempre: que esa reapertura **no ocurra** mientras haya una sucesión en
curso.

**`S19` y `S5` comparten `(GRACE_PERIOD, entra el pago)`, y `S19` y `S7` comparten el par sobre
`SUSPENDED`: las guardas son disjuntas por construcción**, porque una pregunta si la fila es la
predecesora de una sucesión en curso y la otra si no lo es. Es la regla 7 del núcleo, y lo vigila
`G-R4`. **Abrir la segunda puerta no agrega un par, y su segunda fila tampoco**: ni `MP1` ni
`MP4` son eventos de esta tabla, sino efectos que entran por el evento *«entra el pago»* que
`S5`/`S19` y `S7`/`S19` ya compartían, así que los pares con dos filas **no crecen por acá** — hoy
son **cuatro**: el cuarto de antes, `S10`/`S25`,
salió con la revisión del owner, 2026-09-28, C8, y entró otro en la otra épica, `PB11`/`PB13` (revisión del owner, 2026-09-28, C10; `NUCLEO/03` §1 regla 7).

**Y `S6` lleva su condición por el mismo motivo**: con el pago acreditado y pendiente, el reloj del
grace mandaría a `SUSPENDED` —que no emite fuente (`12-contrato…` §2.6)— a alguien que pagó el
período. El tope es la ventana de esa fila (§3.4 punto 1), y después el pago se resuelve por una de las seis ramas de
`B/12` §5.3.

**Y el tope está escrito como condición, no sólo como intención, porque hay QUIÉN lo hace
vencer.** *«Después de que venza la ventana»* no era ninguna condición de `S19`, `S5`, `S6` ni `S7`: las cuatro
cuelgan de dos booleanos —*«¿hay una sucesora viva apuntándome?»* y *«¿hay un pago pendiente por
`S19`?»*— y ninguno se apaga por el paso del tiempo. Los apagan **cuatro** actos declarados, uno
por rama. **Las ramas son SEIS desde la FASE 9-bis-4 y los actos distintos siguen siendo cuatro**,
porque `S18` cubre tres de ellas:

| cómo termina la sucesión | quién apaga el pago pendiente | cómo queda la fila |
|---|---|---|
| la sucesora autoriza | **`S18`**, que le abre a la predecesora la marca con motivo `REEMBOLSO_POR_CONFIRMAR` (`B/02` §2.5) | `CANCELLED` con esa marca abierta, en el canal de conciliación |
| la sucesora vence su ventana | **`S3`**, que lo reevalúa en el acto | reactivada por `S5` o `S7` |
| **la sucesión trabada** | **una persona**, sobre la marca que `S14` ya abrió — es la única cuyo reloj es humano | viva, con dos marcas abiertas cuando `S15` resuelve y `S18` cierra |
| cae un grant *Free Forever* | **`S13`**, que apaga la bandera sin reembolso | `CANCELLED`, sin nada pendiente |
| **el proveedor da de baja a la predecesora** (el espejo del §10.1, por mora acumulada) | **`S18`**, que corre sin `S17` y le abre la misma marca | `CANCELLED` con esa marca abierta, en el canal de conciliación |
| **la predecesora pide la baja ella misma** — estando `SUSPENDED` (`S23`) o **en el grace (`S24`)**, **o revoca en el grace (`S36`)** (owner 2026-09-26, FASE 9 vuelta 1, M), que son los dos únicos estados desde los que `S19` retiene un pago | **`S18`**, que corre sin `S17` y le abre la misma marca, **salvo tras `S36`, cuyo `RF1` ya devuelve ese pago, y no hay marca** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-o`) | ídem, o `CANCELLED` con el `RF1` esperando su confirmación |

**La tabla enumeraba cuatro filas y dejaba la quinta en prosa; hoy son las seis, y la de `S23`
—la sexta rama que la FASE 9-bis-4 agregó— no estaba en ninguna de las dos formas.** **Y el
backstop de `B/09` §3 sigue haciendo falta igual**, porque cubre el
caso en que alguno de los cuatro actos no se ejecutó.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:169, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:855, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:694

<a id="trans-b-s20"></a>

### `TRANS:B:S20` · `S20`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9a](10-corte/B9a.md#pieza-b9a)
- **Fuente de la asignación**: `B/descomposicion.md:856`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S20](10-corte/B9a.md#tpz-s20) → [B9a](10-corte/B9a.md#pieza-b9a) — nota de la fuente: «AS»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): **toda fila viva DE COMPLEMENTO** del beneficiario —los **seis** estados de la suscripción, no los dos de la instancia— cuya instancia esté en uno de sus **dos** estados vivos y cuyo `addon_product` declare compatible **la vertical que el acto ancla**; para los scopes con vertical propia —`VERTICAL_SUBSCRIPTION` y `LISTING`— **además su objetivo tiene que ser de esa vertical** (`B/16` §3.4). **Las principales no entran**: ésas son de `S13`
- **evento** (disparador): el mismo acto que dispara `S13`: `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a un grant vivo** (`12-contrato…` §2.8, `NUCLEO/01` §2.4)
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): **el grant lleva `includesAddons: true`** — con `false` no corre y el complemento sigue cobrando
- **efectos** (efectos): §35.2: el addon pasa a **costo $0**, y son **dos escrituras sobre dos entidades, EN ESTE ORDEN** (ver abajo, *«el orden de las dos escrituras de `S20`»*). **Primero la instancia**: no cambia de estado —si estaba `ACTIVE` sigue `ACTIVE`— y pasa a colgar del **ancla** como su título (`B/02` §2.4); si estaba `PENDING_AUTHORIZATION` no se convierte —no hay nada comprado— y muere por `A3` al vencer su ventana, con la pantalla de *«esperando que completes el pago»* dejando de ofrecer el enlace en el acto. **Después el cobro**: se cancela el preapproval en el proveedor —autorizado o esperando autorización— con la misma regla de `S17` (si la relectura dice que ya está `cancelled`, no se manda nada), **antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala), y la fila de complemento llega a `CANCELLED`. **Sin reembolso del período ya cobrado** (`DEC-GRANT-001`, igual que `S13`). **No lleva la mitad de `S19` que `S13` sí lleva**, y no por olvido: `S19` sale de *«la predecesora de una sucesión en curso»* y una fila de complemento **nunca es una**, así que esa bandera sobre un complemento es población vacía. **Reanudable fila por fila BAJO ese orden**, con su detector en `B/09` §3 — y **no por la razón de `S13`**, que supone una escritura por fila. **Y si la fila de complemento estaba `PAUSED` por `S32`, cierra la pausa escribiéndole `fin_real`**, como `S13` sobre la principal (FASE 9 completa, 4a: la población de complementos pausados existe desde `S32`)

**Texto de la fuente — «El orden de las dos escrituras de `S20`, que es lo que lo vuelve reanudable»** (`B/03-maquinas-de-estado.md:1120–1187`, sin lo tachado):

**La frase de `S13` no se podía copiar, y se había copiado.** `S13` es reanudable *«porque volver
a correrlo sobre una fila que ya cerró no escribe nada»*, y ese argumento **supone un efecto por
fila**: el estado, más una llamada idempotente por la regla de relectura. **`S20` tiene dos
escrituras sobre dos entidades distintas**, y la segunda no tiene guarda propia: se ejecuta
porque la corrida llegó hasta ahí, no porque un predicado la pida.

**Y una de las dos saca la fila de su propio `desde`.** El `desde` de `S20` es *«toda fila viva de
complemento … cuya instancia esté en uno de sus dos estados vivos»*, así que **en cuanto la
suscripción de complemento llega a `CANCELLED` la fila deja de estar alcanzada**: volver a correr
el acto entero ya no la encuentra. Cuál de las dos escrituras es ésa **lo decide el orden**, y de
ahí que el orden sea normativo y no una nota de implementación:

| orden | qué deja una corrida cortada entre las dos | ¿se puede reanudar? | ¿lo ve alguna comprobación? |
|---|---|---|---|
| **cancelar el cobro y después anclar** ❌ | instancia `ACTIVE`, **sin cobro**, y con el ancla-título **en nulo** | **no**: la fila salió del `desde` | **no, en 3 de los 4 scopes** |
| **anclar y después cancelar el cobro** ✅ | instancia `ACTIVE` **ya colgando del ancla**, con su complemento **todavía vivo** | **sí**: la fila sigue en el `desde` | **sí**: es la segunda fila de la tercera comprobación |

**Lo que hace inadmisible el primero es lo mismo que hacía inadmisible el camino viejo.** El
ancla-título es *«el consumidor de la tercera cláusula del evento de `A5`»* (`B/02` §2.4): con la
columna en nulo, **el día que se revoque el grant nada apaga ese addon** —y en `LISTING`, `USER` y
`GLOBAL` el objetivo nunca muere, así que la orfandad tampoco lo alcanza jamás (§8, `B/16` §4.2)—.
Es, con las palabras del recuadro de más arriba, *«el addon funcionando gratis para siempre y sin
suscripción»*: el desenlace que este § ya declaró inadmisible, reintroducido por la puerta de una
corrida cortada.

**Y en ese estado el barrido está ciego por construcción.** La tercera comprobación busca **una
fila viva de complemento** y ahí ya no hay ninguna; la cuarta pregunta por *«el ancla que era su
título»* y la columna quedó nula, así que no hay ancla que comparar. Las dos que podrían verlo
**miran cosas que en ese estado están sanas** (`B/09` §3).

**El orden correcto falla hacia el lado recuperable, y conviene decir hacia dónde.** Entre las dos
escrituras el beneficiario **sigue pagando un addon ya declarado gratis** — que es el estado
anterior a `S20`, dura lo que tarde la reanudación, y es exactamente la población que la tercera
comprobación levanta al día siguiente. El costo del orden inverso no se paga en días: se paga en
una capacidad que sigue encendida gratis para siempre después de revocado el único instrumento
que la sostenía.

**La llamada al proveedor queda ENTRE las dos escrituras, y eso no abre un tercer estado.** Si la
corrida muere después de cancelar el preapproval y antes de escribir `CANCELLED`, la fila local
dice viva y el proveedor dice `cancelled`: **es una divergencia de estado que las cinco
comparaciones del `B/09` §3 sí ven**, y reanudar el acto entero la cierra sin mandar nada, por la
regla de relectura de `S17`. Es el único de los tres cortes que no necesita una comprobación de
cero llamadas, porque los dos lados **dejan de decir lo mismo**.

**Y hay un segundo efecto del orden que conviene decir, porque es el que cierra el caso peor.**
Si el grant se revoca **mientras la corrida está cortada**, la instancia ya tiene su ancla-título
escrita, así que **la tercera cláusula del evento de `A5` la encuentra y la apaga** (§8); y como
su suscripción de complemento todavía está viva, `S21` la lleva a `CANCELLED` detrás. Con el orden
inverso, ese mismo escenario dejaba la instancia sin ancla, `A5` sin sujeto y el addon **encendido
gratis después de revocado el único instrumento que lo sostenía**. El orden no sólo hace reanudable
la corrida: hace que **el camino del final también funcione sobre una corrida que nunca se
reanudó**.

**Nada de esto alcanza a `S21`, y por eso `S21` sí puede decir *«idempotente»* a secas.** Su
condición es sobre el estado de la instancia, que `S21` no toca, así que no hay dos mitades que
puedan quedar separadas. **Y sus escrituras son dos desde que abre su marca** —la
columna de estado de la suscripción de complemento, y la marca con su pago colgado—, **y las dos
son idempotentes por separado**: sobre una fila que ya está `CANCELLED` la primera no escribe nada,
y la segunda la sostiene la base —`UNIQUE(subscription_id, motivo)` sobre las marcas abiertas y
`UNIQUE(marca, pago)` sobre lo que cuelga (`B/02` §2.2)—, así que una corrida repetida no abre una
segunda marca ni cuelga dos veces el mismo pago. **Y que los motivos de `S21` sean dos desde
`DEC-RF-006` no le agrega una tercera escritura ni le quita la idempotencia**: la corrida repetida
vuelve a resolver **el mismo** disparador, así que vuelve a escribir **el mismo** motivo y el
`UNIQUE` la rechaza igual que antes (`B/02` §2.2, donde está el argumento de por qué los dos no
pueden convivir).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:170, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:856, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1120

<a id="trans-b-s21"></a>

### `TRANS:B:S21` · `S21`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:857`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S21](10-corte/B5.md#tpz-s21) → [B5](10-corte/B5.md#pieza-b5) — nota de la fuente: «AS»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): **toda fila viva DE COMPLEMENTO** —los **seis** estados de la suscripción— **de la que cuelga una instancia de addon**. **Las principales no entran, y acá no hace falta acotarlo**: de una principal no cuelga ninguna instancia, así que el conjunto ya es disjunto por el sujeto y no por un adjetivo
- **evento** (disparador): **su instancia llega a `CANCELLED`**: por cualquiera de las **tres** cláusulas del evento de `A5` —se da de baja, **queda huérfana** (la condición de `B/16` §4.2, con sus **tres** mitades) o **se revoca el grant del que cuelga el ancla que era su título**— **y también por `A6`**, el borrado de la ficha (§8)
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): **la instancia está en `CANCELLED`**. Es una condición **sobre un estado y no sobre una entrega**, así que **se vuelve a evaluar** —igual que el disparador de `S17` y `S18`—, y por eso una corrida que muere entre `A5` y esta fila no deja el caso perdido
- **efectos** (efectos): **no se manda nada al proveedor, y ésa es la mitad que no hay que duplicar**: un addon recurrente tiene **un** preapproval y es el de esta fila (`DEC-ADDON-002`, `B/02` §2.4), así que la cancelación que `A5` y `A6` ya declaran —con la regla de relectura de `S17`— **es ésta misma**. Volver a escribirla acá serían dos llamadas por el mismo recurso. **Sin período de gracia y sin fecha de fin de servicio**: no se pasa por `CANCEL_SCHEDULED` (ver abajo, *«el complemento que sobrevive a su instancia»*). **Sin reembolso automático del período ya cobrado**; si corresponde devolver, entra por la vía del reembolso, que **confirma una persona** (`DEC-RF-002`) — **y quien trae el caso es esta misma fila**: cuando el último cobro de la suscripción de complemento paga un período que **todavía no terminó**, `S21` abre la marca `requiere_conciliación` con ese pago colgado. **Y el motivo que escribe es UNO DE DOS, porque desde `DEC-RF-006` la propuesta va en el motivo y no en una rama**: **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`** (`B/02` §2.5, motivo **15**, propuesta **`DEVOLVER`**) cuando la instancia llegó a `CANCELLED` por la **tercera** cláusula de `A5` —la revocación del grant que era su título— (la rama de la discontinuación y la palabra del nombre salieron con la revisión del owner, 2026-09-28, C8); y **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`** (motivo **14**, propuesta **`NO DEVOLVER`**) en el resto. **Y cuando a su objetivo lo mató `S36` en ese mismo acto** (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`): si el último cobro del complemento cae dentro de **sus propios** 10 días corridos, `S21` **no abre marca y crea `RF1`** por el total de ese cobro, que espera la confirmación de `RF2` (§6.1); si no, abre el 14. **Los dos no conviven** y por qué está en `B/02` §2.2 (ver abajo, *«cuál de los dos motivos abre `S21`»*). **Idempotente**: sobre una fila que ya está `CANCELLED` no escribe nada y no manda nada. **Y si la fila estaba `PAUSED` por `S32`, cierra la pausa escribiéndole `fin_real`** con el día del acto (FASE 9 completa, 4a)

**Texto de la fuente — «El complemento que sobrevive a su instancia: por qué `S21` es una fila de ESTA tabla»** (`B/03-maquinas-de-estado.md:1188–1276`, sin lo tachado):

**`A5` apaga la instancia y nadie apagaba su cobro.** `B/09` §3 lo tenía declarado abierto con
todas sus letras —*«lo que sigue sin estar declarado es en qué estado queda esa suscripción de
complemento cuando su instancia muere por orfandad»*—, y el agravante estaba medido: **el barrido
selecciona esa fila por el estado terminal de su INSTANCIA** (salvedad 1), así que el único
proceso que la vigila la encontraba por un lado mientras ella misma no tenía estado declarado por
el otro. La decisión del owner del 2026-09-21 (`DEC-ADDON-004`) es **`CANCELLED` en el acto, junto con la
instancia**, y esta fila es la que lo ejecuta.

**Por qué es una fila de esta tabla y no un efecto declarado de `A5`.** La escritura es sobre la
columna de estado de una **suscripción**, y una suscripción de complemento *«usa esta misma
máquina»* (§3): un efecto de la tabla de addon que moviera esa columna es exactamente lo que la
regla 1 del núcleo no admite —*«lo que la tabla no declara, no pasa»*, leída sobre la tabla del
sujeto que se escribe—. Y el precedente es del mismo día: `S20` también lo dispara un acto de otra
entidad —el grant— y también es una fila propia acá, por la razón que `DEC-ADDON-003` deja escrita.
**`A5` conserva su efecto sobre el proveedor y no gana uno sobre esta columna.**

**Cubre las DOS puertas y las cuatro cláusulas, no una.** La orfandad mira el **objetivo** —la
condición de `B/16` §4.2, con sus **tres** mitades: el objetivo dejó de ser fila viva, ninguna
sucesión lo releva y ningún grant permanente lo releva— y el corte del `B/16` §3.3 mira el
**título** —la tercera cláusula del evento de `A5`, *«se revoca el grant del que cuelga el ancla
que era su título»*, que es la única que alcanza a los scopes `LISTING`, `USER` y `GLOBAL`—. Escribir el evento de `S21` contra una sola de
las dos habría dejado vivo el cobro de tres de los cuatro scopes, que es el mismo agujero que la
tercera cláusula vino a cerrar en la otra máquina. Por eso el evento **no reescribe ningún
predicado: se ata al estado de llegada de la instancia**, que es donde las tres cláusulas de `A5`
—más `A6`— ya confluyen.

**`A3` no entra, y no por olvido.** Lleva la instancia a `ABANDONED`, y ahí la fila de complemento
ya tiene transición propia: es `S3`, la misma ventana —con sus **dos** plazos, §3.4 punto 1—, con su misma cancelación en el
proveedor. **`A4` tampoco**, y su población es vacía: un preapproval propio existe sólo si el cobro
es `PERIÓDICO`, y `PERIÓDICO` + `DÍAS_FIJOS` **no existe** (`B/16` §1.2 y §1.3).

**Por qué no se aplica el patrón de `DEC-SUB-009`, que es la alternativa que había que descartar.**
Esa decisión cancela en el proveedor de inmediato y **sostiene el servicio de nuestro lado** hasta
el fin del período pagado, y su motivo es la dirección en la que falla: *«el fallo regala unos días
de servicio, y se corrige sin mover un peso»*. Acá ese motivo **no tiene de qué agarrarse**, y son
tres razones que no se pisan:

1. **No hay servicio que sostener.** La capacidad ya la apagó `A5` sobre la instancia, en el mismo
   acto. Lo que un `CANCEL_SCHEDULED` sostendría no es un destaque: es **la fila de un cobro**
   —sostener un destaque sobre una ficha despublicada, o sobre una vertical que el cliente ya no
   tiene, **no le da nada a nadie**—.
2. **El addon COMPLEMENTA algo que ya no está**, y ésa es la diferencia con la baja del §24: ahí
   el cliente pide irse de algo que sigue funcionando y quiere usar hasta el día que pagó; acá el
   objetivo o el título desaparecieron **sin que el cliente lo pidiera necesariamente**, y el
   contrato ya descarta las fuentes de clase `COMPLEMENTO` cuando no queda ninguna de clase
   `TÍTULO` viva (`12-contrato…` §2.4).
3. **El costo de la alternativa es una fila viva que el barrido tiene que seguir mirando**, con su
   reloj, su fecha de fin de servicio como dato nuestro (`DEC-SUB-009` implicación 3) y una entrada
   más en cada predicado que enumera los seis estados — todo para sostener un estado vacío. Y si de
   verdad hubiera que devolver plata, eso **se resuelve por la vía del reembolso**, que ya tiene su
   regla y su confirmación humana (`DEC-RF-002`): no se fuerza a la máquina a sostener un estado
   vacío para emular una devolución.

**El período ya pagado no se reembolsa SOLO, y eso vale en los cuatro disparadores.** Lo que
`DEC-RF-004` partió y `DEC-RF-006` volvió a poner en el motivo es **lo que el listado propone**, no
quién decide: en los cuatro la decisión la toma una persona (`DEC-RF-002`), y lo que cambia es con
qué propuesta delante (ver abajo, *«cuál de los dos motivos abre `S21`»*). **Y que el período no se devuelva de oficio
va escrito y no implícito.** Es el mismo criterio con el
que `DEC-GRANT-001` lo dice para `S13` y `B/16` §3.4 para `S20`, apoyado acá en las tres reglas que
`DEC-RF-002` enumera: *«reembolsar»* es una acción que mueve dinero, con permiso propio y
confirmación explícita (`NUCLEO/08` §3); la línea del owner es *«toca plata o no toca plata»*
(`B/09` §2.4); y `S14` prohíbe **toda decisión destructiva automática**. Un reembolso automático acá
sería la primera operación automática sobre dinero del diseño, en un dominio que está vacío a
propósito.

**Pero *«no se reembolsa solo»* no es *«nadie lo mira»*, y ésa era la mitad que faltaba.** Este §
decía —y `B/16` §4.4 repite— que *«si en un caso concreto corresponde devolver, entra por esa
vía»*, y **ninguna transición ni comprobación del corpus abría ese caso**: la acción de reembolsar
está en el catálogo de `NUCLEO/08` §3 con permiso, auditoría y confirmación, y ese mismo § advierte
que *«una acción con permiso, auditoría y confirmación declarados no sirve de nada si nadie enruta
el caso»*. Desde que la enumeración de motivos es **cerrada** (`B/02` §2.5) eso dejó de ser una
omisión discutible: **bajo `G-R1-F` la vía no se podía escribir sin un motivo en esa tabla, y
ninguno de los trece era éste.**

**Así que `S21` abre la marca, y con una condición que acota la población a la que tiene plata
adentro.** El motivo es **uno de los dos que `DEC-RF-006` le dio** —el **14**,
`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`, o el **15**,
`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN` (`B/02` §2.5; el nombre, revisión del owner, 2026-09-28, C8)— y la condición,
que es **la misma para los dos**, es que
**el último cobro de esa suscripción de complemento pague un período que todavía no terminó**. Eso
deja afuera, sin nombrarlas una por una, las tres poblaciones donde no hay nada que decidir: el
addon convertido a $0 —no hay cobro—, el que muere justo al final de su ciclo, y el `A3` que nunca
llegó a cobrar. **Lo que la marca NO hace es decidir**: la decide una persona (`DEC-RF-002`), y lo
que el listado le pone delante es una propuesta (`B/19` §6). La marca es lo que pone el caso
delante de esa persona con el pago y el monto al lado, en vez de dejarlo esperando a que el cliente
reclame.

**Texto de la fuente — «Cuál de los DOS motivos abre `S21` lo decide el disparador, y los disparadores son CUATRO»** (`B/03-maquinas-de-estado.md:1277–1446`, sin lo tachado):

**`DEC-RF-006` partió el motivo en dos, y con eso la propuesta volvió a leerse por motivo.**
`DEC-RF-004` le había quitado el default único y lo había reemplazado por **dos ramas de un mismo
motivo**; lo que cambia acá es **dónde vive esa distinción**: pasa a ser **el `motivo` de la
marca**, que es una enumeración cerrada y **se escribe al abrir la marca, en el acto, cuando la
causa todavía existe** (`B/02` §2.2 y §2.5). El criterio de reparto **no se movió**: la regla de
`B/16` §4.4 —*«el período ya
pagado no se reembolsa»*— sigue valiendo donde el complemento se pierde **por un acto del propio
cliente**; **no** vale donde la pérdida la causa **un acto deliberado nuestro sobre alguien que
puso plata y ese acto puede decirlo sin mecanismo nuevo** — la segunda mitad de esa condición es lo
que deja **un** camino nuestro del lado de la regla,
`S17`, y abajo va nombrado (residuo visto al publicar, 2026-09-30; vale §3.2: `S26` se retiró con la revisión del owner, 2026-09-28, C8, y `S12` viene siempre de `S11`). El evento de `S21` se
ata al estado de llegada de la instancia, y a `CANCELLED`
llegan **cuatro** disparadores y no tres — las **tres** cláusulas del evento de `A5` más `A6`
(§8, `B/16` §4.4). **Ninguno queda implícito**:

| # | disparador | qué pasó | motivo que escribe `S21` | propuesta |
|---|---|---|---|---|
| 1 | **`A5`, primera cláusula** — *«se da de baja»* | el cliente dio de baja el complemento | **14** · `…_POR_OTRA_CAUSA` | **NO DEVOLVER** |
| 2 | **`A5`, segunda cláusula** — *«queda huérfana»* (la condición de `B/16` §4.2, con sus **tres** mitades) | murió el **objetivo** del addon, y ni una sucesión ni un grant vivo lo relevan | **14** · `…_POR_OTRA_CAUSA`: ya no se parte (revisión del owner, 2026-09-28, C8) — **salvo `S36`, que no abre marca y crea `RF1`** si el último cobro del complemento cae dentro de sus propios 10 días corridos, y si no va al 14 (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`) | **NO DEVOLVER**, o **DEVOLVER** por `RF1` en `S36` |
| 3 | **`A5`, tercera cláusula** — *«se revoca el grant del que cuelga el ancla que era su título»* | **el cliente no hizo nada** y pierde los días que pagó | **15** · `…_POR_REVOCACIÓN` | **DEVOLVER** |
| 4 | **`A6`** — se borra la ficha destino | el cliente borró su propia ficha, y `DEC-ADDON-001` ya declara que el complemento *«se consume»* | **14** · `…_POR_OTRA_CAUSA` | **NO DEVOLVER** |

**El
motivo 15 es un solo camino y su nombre lo dice, que es lo que lo vuelve clasificable sin leer
este §: la revocación del grant** (la discontinuación salió con la revisión del owner, 2026-09-28,
C8). Un camino que no sea ése no entra, aunque también sea nuestro — y **uno lo es**, `S17`, nombrado más abajo (`V2-n`).

**El 3 cae ENTERO del otro lado —es el único que no se pregunta nada más—, y la razón ya estaba
escrita en el programa**: *si la pérdida la causa un acto deliberado NUESTRO y la persona no puso
plata nueva → se declara y no se repara; **si la persona PUSO PLATA → se le da salida***. En la
tercera cláusula **las dos mitades apuntan al mismo lado** —revocar es un acto nuestro, declarado,
del catálogo del `NUCLEO/08` §3, y el cliente pagó el período—, que es el mismo criterio con que se
resolvieron `DEC-TRIAL-009`, `DEC-ADDON-005` y `DEC-GRANT-011`. (El 2 ya no se parte: la parte de su
población que apuntaba a ese lado era la discontinuación, que salió con la revisión del owner,
2026-09-28, C8.)

**Y el 2 no es homogéneo, porque medido contra `B/16` §4.2 decir *«acá actuó el cliente»* sería
falso.** La orfandad se resuelve contra la muerte del objetivo, y las transiciones que sacan a la
principal de las filas vivas son **once**, recontadas sobre la
enumeración de `B/16` §4.3: `S3`, `S12`, `S13`, `S16`, `S17`, el espejo del §10.1, `S22`, `S23`,
`S24`, **, `S31` y `S36`** (`S25`, `S27` y `S28` salieron con la revisión del owner, 2026-09-28, C8; `S36`: FASE 9 vuelta 2,
owner 2026-09-27, `R1-b`, `F-8V2D1-001`; saca a la principal de las filas vivas desde la FASE 9
vuelta 1 y la lista no se había recontado)
(FASE 9 completa, contradicción 2 de `03` §R6.5: `S31` saca a una sucesora principal de las filas
vivas y faltaba; la corta un contracargo, que es un acto del titular, así que cae en el motivo 14).
**Un camino no es
un acto del cliente, y va nombrado porque `DEC-RF-004` lo exige: `S17`, que es nuestra.** Es **uno
de once** (revisión del owner, 2026-09-28, C8: los otros cuatro eran de la discontinuación).
**`S36` es
del cliente y va aparte**: es la revocación del derecho de arrepentimiento, y lo que decide no es un
motivo sino un `RF1` (abajo; FASE 9 vuelta 2, owner 2026-09-27, `R1-b`).

**El reparto** (sin partición desde la revisión del owner, 2026-09-28, C8) **va en
una tabla para que no haya que deducirlo:**

| camino dentro del disparador 2 | quién lo causa | motivo | propuesta |
|---|---|---|---|
| | — | — | **sale** (revisión del owner, 2026-09-28, C8) |
| **`S17`** (residuo visto al publicar, 2026-09-30; vale §3.2: `S26` se retiró con la revisión del owner, 2026-09-28, C8) | nuestra, **y la causa NO es legible en la transición que mata al título** | **14** | **NO DEVOLVER**, por mecanismo y dicho en voz alta (`B/19` §6) |
| (`V2-d`, `V2-n`) | — | — | **sale** (revisión del owner, 2026-09-28, C8) |
| las otras **nueve** transiciones (con `S31`, FASE 9 completa; recontadas con la revisión del owner, 2026-09-28, C8: once menos `S17` y `S36`), **con `S12` entero** —**desde `R1-a` sin el ciclo que el complemento cobraba después de la baja**: `S11` ya le canceló el preapproval (FASE 9 vuelta 2, owner 2026-09-27)—; **lo que queda es el residuo de los días que el último cobro del complemento pagó después del fin de servicio, y lo toma `S21` antes que el `S12` del complemento** (owner 2026-09-27, FASE 9 vuelta 2, `R1-c`) | el cliente actuó | **14** | **NO DEVOLVER** — y una persona ve el caso y puede apartarse |
| **`S36`** ✚ — la revocación del derecho de arrepentimiento (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`) | el cliente, **y la causa es legible en el acto mismo** | **ninguno: `RF1`** por el total del último cobro del complemento, si cae dentro de **sus propios** 10 días corridos; si no, **14** | **DEVOLVER** por `RF1`, o **NO DEVOLVER** |

**Por qué el 2 va entero al 14** (revisión del owner, 2026-09-28, C8: la parte que se
partía era la discontinuación). Lo que sostiene el `NO DEVOLVER` de todo el 2 es de mecanismo: **`S21` conoce la cláusula
de `A5` que disparó, no cuál de las once transiciones (residuo visto al publicar, 2026-09-30; vale el recuento de arriba) mató al título tres saltos antes**, y hacerle
llegar esa causa exigiría que la marca transportara algo que la transición no tiene — mecanismo
nuevo en producción, que es exactamente lo que `DEC-RF-004` dijo que **no** estaba comprando. (Salen con la revisión del owner, 2026-09-28, C8.) **Queda una
sola excepción a esa razón, y no es un motivo sino un `RF1`**:

- **`S36` ES el acto** (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`):
  la revocación la registra una persona sobre una fila, y la orfandad de sus complementos corre en
  ese mismo acto (`B/16` §4.3), así que `S21` la ve con la causa todavía viva. Lo que decide con
  ella no es un motivo sino un `RF1`, porque la revocación de `DEC-RF-001` es *«reembolso total +
  cancelación»* y el complemento es parte del mismo contrato, **acotado a sus propios 10 días
  corridos**, que es el plazo del cobro que se devuelve; pasado ese plazo va al 14. **Si la
  orfandad no corrió en el acto** y la levanta la cuarta comprobación del barrido, la causa ya no
  está, y va al 14.
- (Sale con la revisión del owner, 2026-09-28, C8.)

**Y lo que NO se parte queda declarado con su razón, porque ahí el argumento del mecanismo sí
vale.**
(`S26` salió con la
revisión del owner, 2026-09-28, C8: `S12` viene siempre de `S11`.)
En `S17` el evento es *«su sucesora quedó autorizada»*, que **no nombra ninguna discontinuación** y
no es un acto que recorra filas. **Sigue** en **NO DEVOLVER** y **depende** **de que quien
resuelve se aparte del default**, que es para lo que la fila de `B/19` §6 dice en voz alta que ese camino existe. **Y la propuesta no ejecuta nada** (`DEC-RF-002`): la persona la confirma o se
aparta de ella.

(Sale con la partición: revisión del owner, 2026-09-28, C8. La baja que `S17` ejecuta sigue
abriendo el motivo **1** con las **seis** ramas de `B/12` §5.3.)

**Y dónde vive la distinción ya NO queda abierto: es el `motivo`.** Hasta `DEC-RF-006` la propuesta
viajaba como una **rama** de un mismo motivo, y el corpus declaraba que la marca *«lleva de qué
disparador vino»* (`NUCLEO/08` §4.3) **sin que ninguna de las columnas de `reconciliation_mark`
fuera ésa** (`B/02` §2.2) — un hueco **anterior** a la partición del disparador 2, porque `S21` ya
tenía que distinguir cuatro disparadores desde que `DEC-RF-004` le quitó el default único. **La
partición en dos motivos lo cierra sin columna nueva**: `motivo` es una enumeración cerrada que
**ya existe** y que `S21` **ya escribe al abrir la marca**, en el acto y **con la causa todavía
viva** — que es exactamente lo que después no se puede, porque en la orfandad
la causa **no sobrevive en ningún lado** una vez que la fila llegó a `CANCELLED` (revisión del owner,
2026-09-28, C8). **Ninguna
transición nueva, ninguna llamada nueva, ninguna columna nueva y ningún dato que haya que trazar
hacia atrás.**

**Y lo único que la partición agrega va RESUELTO y no anotado.** El
`UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL` deja de excluir entre sí a las dos
marcas, porque **son dos motivos distintos**. **Igual no pueden convivir, y por construcción**: el
escritor de los dos es `S21`, su evento es la llegada de **su** instancia a `CANCELLED`, y ahí se
llega por **uno solo** de los cuatro disparadores de la tabla de arriba. El argumento entero, con
lo que el `UNIQUE` sí sigue haciendo y con lo que deja de hacer, está escrito **al lado de la
restricción** (`B/02` §2.2), y `G-R1-F` vigila lo que la base ya no vigila (`B/20` §2).

> **El lado del motivo 15 que llega POR REVOCACIÓN DEL GRANT no tiene población vacía, y conviene
> decir dónde vive**, porque el §
> siguiente demuestra que sobre un addon **convertido a $0** `S21` no encuentra fila viva. Son dos
> poblaciones y ésta es la otra: el addon que **nunca** fue gratis y sigue pagándose mientras un
> grant es el título — el §3.4 de `B/16` convierte a $0 **sólo los compatibles**, así que un addon
> incompatible sigue cobrando—. A ésa se le suma el caso con nombre del recuadro de abajo, la
> corrida de `S20` cortada entre sus dos escrituras.

**Y para el addon convertido a $0 la población de `S21` es vacía, que es la comprobación de que las
dos filas no se pisan.** Ahí la suscripción de complemento ya la mató `S20` en el acto del
otorgamiento, así que cuando se revoca el grant y `A5` corta la instancia por su tercera cláusula,
`S21` no encuentra ninguna **fila viva** de complemento — es, con otras palabras, el *«normalmente
no queda ninguno vivo»* del §8. `S21` es lo que cierra el cobro del addon que **nunca** fue
gratis y llegó a `A5` por cualquiera de las otras puertas.

> **El *«normalmente»* tiene un caso con nombre, y no es un borde sin dueño: una corrida de `S20`
> cortada entre sus dos escrituras.** Ahí la instancia ya cuelga del ancla y **su complemento
> sigue vivo**, así que si el grant se revoca antes de que la corrida se reanude, `A5` la apaga
> —tiene sujeto, que es todo el punto del orden— y **`S21` sí encuentra una fila viva de
> complemento y la lleva a `CANCELLED`**. Las dos filas siguen sin pisarse: `S20` no llegó a
> cancelarla y `S21` sí, cada una por su evento. Es el único camino por el que la población de
> `S21` sobre un addon convertido no es vacía, y es exactamente el que no puede quedar sin
> cerrar.

**`S21` no agrega ningún par con dos filas, así que el conteo de `G-R4` no se mueve — y son cuatro: `S10`/`S25` salió con la revisión del owner, 2026-09-28, C8, y `PB11`/`PB13` entró por C10** (`NUCLEO/03` §1 regla 7). Comparte el
`desde` con `S20` —las dos salen de *«toda fila viva de complemento»*— y **compartir el `desde` no
es compartir el par** (`NUCLEO/03` §1 regla 7): el evento de `S20` es otorgar o anclar un grant y
el de `S21` es que su instancia llegó a `CANCELLED`, y ninguna otra fila de esta tabla declara
ninguno de los dos. **Y tampoco se pueden satisfacer a la vez**: `S20` declara explícitamente que
**la instancia no cambia de estado**, así que en ese acto no hay ninguna instancia llegando a
`CANCELLED`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:171, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:857, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1188, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1277

<a id="trans-b-s22"></a>

### `TRANS:B:S22` · `S22`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:858`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S22](20-fase-2/B8b.md#tpz-s22) → [B8b](20-fase-2/B8b.md#pieza-b8b) — nota de la fuente: «queda en `B8b`, por AR»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PAUSED` — **con cualquiera de los dos motivos**
- **evento** (disparador): pide la baja
- **hacia** (estado destino): `CANCELLED`, **o `CANCEL_SCHEDULED`** si la fila vive del crédito de `DEC-SUB-006` y el crédito no se consumió (abajo; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`)
- **condición** (guardas): —
- **efectos** (efectos): **es el mismo acto de `S11`, no uno nuevo**: el catálogo de `NUCLEO/08` §3 lo nombra una sola vez y `B/19` §5 lo deja self-service. Lo que cambia es el desenlace: **no pasa por `CANCEL_SCHEDULED` y termina el servicio en el acto** (`B/12` §7.2). `DEC-SUB-010` ya se llevó los días no usados del ciclo **al pausar**, así que **no queda período pagado que sostener**, y la fecha de fin de servicio —*«un dato nuestro»*, `DEC-SUB-009`— **es el día de la cancelación**. El §3.3 ya lo imponía: de `PAUSED` no sale nada que no sea `ACTIVE` o `CANCELLED` (salvo `S6` por un contracargo sobre una cortesía, que va a `SUSPENDED`: pendiente 8, owner 2026-09-25). **Se cancela en el proveedor de inmediato**, con la regla de relectura de `S17` — está medido que sobre una pausada el proveedor **rechaza toda modificación y sí deja cancelar** (`EX-11`). **Antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala. **Se escribe `fin_real` en la `subscription_pause`** (`B/02` §2.2) con ese mismo día: los topes del §26.3 **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`), así que una pausa que se corta sin registrar su fin real le come al cliente meses que no usó. **Y si el motivo era `COURTESY` la cortesía termina con ella**: esa fila **sí emite fuente** (`12-contrato…` §2.6) y deja de emitirla hoy, así que la confirmación lo dice antes (`B/19` §4, fila 8). **Idempotente**, como `S12`. **Salvo sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`; caso 1 de `11-` §5): es la sucesora con una cortesía re-emitida por `S9`, pausada desde que autoriza y con la cortesía arrancando al fin del crédito (`R17`). **El crédito cuenta como período pagado** (`R17`), así que *«no queda período pagado que sostener»* es falso ahí, y la fila va a **`CANCEL_SCHEDULED` con `fin_de_servicio` en el fin del crédito**, como `S11` desde `R17`; `S12` la termina en esa fecha. **Es la regla de `S11` entera y no sólo su fecha**: cancela el preapproval con el correo antes y la relectura, **y en el mismo acto cancela sus complementos recurrentes con la selección de `S11`** (`R1-a`, con `CANCEL_SCHEDULED` en la exclusión, `V2-c`), porque la fila sigue viva y la orfandad no llega hasta `S12`; esos complementos son una `CANCEL_SCHEDULED` de `S11` en todo lo que el diseño dice de ella. Escribe `fin_real` en la `subscription_pause` con el día de la baja, porque la fila sale de `PAUSED`, y los meses de cortesía se pierden como en el resto de esta fila. Sin crédito, o con el crédito ya consumido, sigue siendo lo de arriba

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:172, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:858

<a id="trans-b-s23"></a>

### `TRANS:B:S23` · `S23` — `SUSPENDED` → `CANCELLED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a)
- **Fuente de la asignación**: `B/descomposicion.md:859`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S23](10-corte/B8a.md#tpz-s23) → [B8a](10-corte/B8a.md#pieza-b8a) — nota de la fuente: «AR»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `SUSPENDED`
- **evento** (disparador): pide la baja — **la pide el cliente o la ejecuta un admin**: es la tercera salida que el §3.1 enumera
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): —
- **efectos** (efectos): el mismo acto otra vez, y acá **no hay servicio ni cobertura que retirar**: el §21 ya cortó el servicio y `SUSPENDED` **no emite ninguna fuente** (`12-contrato…` §2.6), así que tampoco hay período pagado que sostener y la fecha de fin de servicio **es el día de la cancelación**. **En el proveedor: si el preapproval sigue vivo se cancela**, con la regla de relectura de `S17` y **con nuestro correo antes de la llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala); **sobre un pagador manual no hay nada que mandar**, porque no hay débito que detener (`B/06` §7). **Libera el candado `A`** (`B/02` §2.2), y ésa es la mitad que el §7.1 necesitaba: desde `CANCELLED` la condición 1 del `B/05` §3 rechaza la reapertura, así que este acto **cierra la ventana de `MP4`** y de paso le devuelve a la persona el alta nueva que el candado le bloqueaba. **Idempotente**, como `S12`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:173, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:859

<a id="trans-b-s24"></a>

### `TRANS:B:S24` · `S24` — `GRACE_PERIOD` → `CANCELLED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a)
- **Fuente de la asignación**: `B/descomposicion.md:860`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S24](10-corte/B8a.md#tpz-s24) → [B8a](10-corte/B8a.md#pieza-b8a) — nota de la fuente: «AR»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `GRACE_PERIOD`
- **evento** (disparador): pide la baja
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): —
- **efectos** (efectos): **el mismo acto de nuevo**, y su desenlace lo fija `DEC-SUB-014`: **corta en el acto**, con la fecha de fin de servicio en **el día de la cancelación** y **sin pasar por `CANCEL_SCHEDULED`**, por la misma razón que `S22` y `S23`. Acá esa razón es la más literal de las cuatro: **el grace existe porque el cobro del período en curso falló**, así que no hay período pagado que sostener — el último que se pagó ya se consumió, que es precisamente por lo que la fila está en este estado. **Y es la única de las tres bajas directas que corta servicio de verdad siempre** —`S22` lo corta sólo si la pausa era por `COURTESY`, que emite fuente (FASE 8 completa, `F-8CD1-016`), y no en el acto si la fila vive del crédito (`V2-b`)—: `GRACE_PERIOD` **sí emite fuente** (`12-contrato…` §2.6, *«el §20 da servicio entero»*), a diferencia de `PAUSED` por `CUSTOMER_REQUEST` y de `SUSPENDED`, así que la pantalla lo dice antes de confirmar (`B/19` §4, fila 8). **Se cancela en el proveedor de inmediato**, con la regla de relectura de `S17` y **con nuestro correo antes de la llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala); **sobre un pagador manual no se manda nada**, como en `S23`, porque no hay débito que detener (`B/06` §7). **Apaga el reloj del §4**: sin esta fila el intento caía en la regla 1 del núcleo —marca con motivo `TRANSICIÓN_NO_DECLARADA`— mientras el reloj del grace seguía corriendo hacia `SUSPENDED` con una persona mirando el caso. **Y si la fila es la predecesora de una sucesión en curso, dispara `S18`**, igual que `S23`: `S19` retiene pagos desde `GRACE_PERIOD` y desde `SUSPENDED`, así que es la **misma** rama 6 de `B/12` §5.3 y no una séptima. **Idempotente**, como `S12`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:174, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:860

<a id="trans-b-s29"></a>

### `TRANS:B:S29` · `S29` — `PENDING_AUTHORIZATION` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:861`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S29](10-corte/B5.md#tpz-s29) → [B5](10-corte/B5.md#pieza-b5)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING_AUTHORIZATION`
- **evento** (disparador): **se registra la PRIMERA cuota de un pagador manual** — el acto es `MP1` (§7)
- **hacia** (estado destino): `ACTIVE`
- **condición** (guardas): la cuota que se registra es la **primera** de esta fila. Si no lo es, `MP1` sigue su camino normal y esta transición **no corre**
- **efectos** (efectos): **Es la puerta a `ACTIVE` de un pagador manual, y existe porque `S2` no le sirve**: el evento de `S2` es *«webhook de autorizada, **confirmado por relectura**»* y acá **no hay preapproval que releer** — el pagador manual nunca pasó por el proveedor. **Cumple por construcción la condición que el §7.2 ató por adelantado** —*«esa fila no puede llegar a `ACTIVE` sin la primera cuota registrada»*— porque su evento **es** ese registro. **Hereda de `S2` los tres efectos del alta**: arranca el período, la fila **pasa a emitir fuente** (`12-contrato…` §2.6) —**ya con `cobrada: sí`**, porque su evento es el registro de la primera cuota (`DEC-TRIAL-010`); a diferencia de `S2`, acá no hay cobro que esperar—, y ese cambio de cobertura es lo que mueve el trial si había uno (`V/03` §2, `T2`) — esta tabla **no dispara** la transición de la otra épica. ⚠️ **Lo que NO hace, y hay que decirlo porque es un doble avance**: **no mueve la fecha del próximo cobro.** Eso ya lo hace `MP1` —*«avanza un ciclo la fecha del próximo cobro»*— y el acto es **uno solo**: si esta fila lo repitiera, el pagador manual arrancaría con **dos ciclos** de crédito. **Tampoco cierra ningún grace, porque no lo hubo**: `MP5`(b) abre la primera cuota en `PENDING_AUTHORIZATION` y **no dispara `S4`** (§7.2, *«cómo entra el grace»*), así que no hay reloj que apagar. **Y `G-R4` no gana ningún par duplicado**: comparte el `desde` con `S2` y con `S3`, pero *«compartir el `desde` no es compartir el par»* (`NUCLEO/03` §1 regla 7) — **ninguna otra fila de esta tabla declara este evento**, y no puede satisfacerse a la vez que `S2`, porque una fila de pagador manual **no tiene preapproval que emita ese webhook**. **El que cuenta es el pago acreditado y nunca la fecha** (§4.5 punto 2)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:179, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:861

<a id="trans-b-s30"></a>

### `TRANS:B:S30` · `S30` — `ACTIVE` **o `GRACE_PERIOD`** (FASE 9 vuelta 1, `F-8V1B1-006`) → el mismo estado

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9b](20-fase-2/B9b.md#pieza-b9b)
- **Fuente de la asignación**: `B/descomposicion.md:862`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S30](20-fase-2/B9b.md#tpz-s30) → [B9b](20-fase-2/B9b.md#pieza-b9b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE` **o `GRACE_PERIOD`** (FASE 9 vuelta 1, `F-8V1B1-006`)
- **evento** (disparador): `P1` deja en 0 el `cobros_restantes` de la redención de promo que cuelga de la fila
- **hacia** (estado destino): el mismo estado
- **condición** (guardas): —
- **efectos** (efectos): **se muta `transaction_amount` al monto sin esa promo, recalculado con las que siguen vivas** —el monto esperado de `B/14` §2.4: precio de la versión de plan —**el vigente de la versión, con los aumentos de `DEC-MP-002` ya aplicados** (orquestador, FASE 8 completa, pendiente 8)— menos las promos vivas según su contador, con la regla de orden del §1.2— (`PC-1`) y se verifica releyendo (`D5`), porque la mutación no emite webhook (`EX-15`). **Si la mutación no se aplica, la retoma el barrido**: reintenta 3 días, contados desde esta transición, y después abre la marca con motivo `DIVERGENCIA_DE_MONTO` (`B/09` §3). **Y si el contador llega a 0 con la fila ya `PAUSED`**, esta fila no ocurre —su `desde` es `ACTIVE` **o `GRACE_PERIOD`**, nunca `PAUSED`— y la mutación tampoco se podría aplicar: sobre una pausada el proveedor rechaza toda modificación (`EX-11`). **Se acepta que ese mes salga con descuento: se declara, no se encola nada** (FASE 8 completa, pendiente 7, owner 2026-09-25). **Y si llega a 0 con la fila en `GRACE_PERIOD`** —el último cobro con descuento entró como reintento del proveedor—, `S5` y esta fila corren en el mismo acto y la mutación se aplica igual: el preapproval está `authorized` y no hay `EX-11` que la rechace (FASE 9 vuelta 1, `F-8V1B1-006`). **Y el barrido no compara el monto de una fila `PAUSED`**; al reanudar, **`S10` es la transición desde la que corren los 3 días** del reintento (`B/09` §3; orquestador, FASE 8 completa, pendiente 8). Nuestro correo no bloquea: no es una cancelación (`DEC-MAIL-001` punto 1); el del proveedor (`CT-3`) ya se anticipó al canjear (punto 2, `B/19` §4 fila 7-bis) **y otra vez antes del último cobro con descuento, con *«tu promo termina»***, **7 días antes por default y configurable** (`NUCLEO/07` §6; pendiente 7; el plazo, pendiente 8, owner 2026-09-25). Lo que queda abierto está en `B/14` §2.4 y en *«lo que este capítulo NO cierra»* de `B/14` (corrección de diseño, FASE 8 completa, `F-8CB1-007`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:180, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:862

<a id="trans-b-s31"></a>

### `TRANS:B:S31` · `S31`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:863`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S31](20-fase-2/B8b.md#tpz-s31) → [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): la **sucesora viva** de una sucesión en curso —con `sucede_a` apuntando a la predecesora que un contracargo acaba de cortar—: en `PENDING_AUTHORIZATION`, **o en `ACTIVE`** si ya autorizó y `S17` todavía no se confirmó
- **evento** (disparador): **su predecesora se corta por un contracargo**: `S6` por su tercer evento, **o `S12` por su segundo** —la predecesora estaba en `CANCEL_SCHEDULED`—
- **hacia** (estado destino): **`ABANDONED`** desde `PENDING_AUTHORIZATION`; **`CANCELLED`** desde `ACTIVE` (FASE 8 completa, owner 2026-09-25)
- **condición** (guardas): —
- **efectos** (efectos): **Es la transición que el 📌 de `DEC-SUB-020` pedía y ninguna fila hacía** (FASE 8 completa, pendiente 8, owner 2026-09-25): un contracargo es una disputa, no una mora que el cambio de plan resuelva, así que **la sucesora también se corta**. **Por los dos destinos la sucesora deja de ser fila viva y la sucesión se cae como en `S3`, sin `S18`** (FASE 8 completa, owner 2026-09-25) —desde `ACTIVE` iba a `SUSPENDED`, que es fila viva, y la sucesión quedaba en curso sin nadie que la cerrara—. **La persona vuelve por la predecesora**: si quedó `SUSPENDED` por `S6`, por una sucesión desde `SUSPENDED` de tarjeta (`G-R1-A`, `B/20` §2). **Se cancela su preapproval en el proveedor con la regla de relectura de `S17`** —si la relectura ya lo ve `cancelled`, no se manda nada—, **y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): **si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y la reintenta el barrido** —`S31` llega a su destino pase lo que pase con la llamada, y es una de las filas de la salvedad 4 de `B/09` §3 (FASE 8 completa, owner 2026-09-25)—; si no hay destinatario, se cancela igual y el no-entregable se escala; un pagador manual no tiene preapproval, y esta parte no le corre (`B/06` §7). **Y si la sucesora era de un pagador manual en `PENDING_AUTHORIZATION`, su primera cuota —abierta en `S1` y nunca registrada— se cierra en el mismo acto** por la segunda cláusula de `MP3` (§7), como en `S3`. **Y si hay un saldo de cortesía diferido esperando a esta sucesora** (`NUCLEO/01` §2.6), **se cierra acá**: `saldo_cerrado_en` y `motivo_cierre = CONTRACARGO_DE_LA_PREDECESORA` (`B/02` §2.4) — ninguno de los tres valores que ya había describe este desenlace. **Y si la predecesora retenía un pago pendiente por `S19`, se reevalúa en el acto por la rama 2 de `B/12` §5.3**, como en `S3`. **No es `S3`**, aunque comparta con ella el destino desde `PENDING_AUTHORIZATION`: `S3` avisa *«venció tu plazo»* y cierra el saldo con `VENTANA_DE_AUTORIZACIÓN_VENCIDA`; acá no venció nada (`S28` salió con la revisión del owner, 2026-09-28, C8). **`S31` se escribe en la misma transacción que la escritura de `S6` —o de `S12`— que la dispara** (FASE 9 vuelta 1, `F-8V1B2-006`). Su llamada de cancelación sale después y, como en `S3`, la fila llega a su destino pase lo que pase con ella: la reintenta la salvedad 4. Entre las dos escrituras no hay ventana donde `S17` pueda cancelar a la predecesora y `S18` limpiar el puntero. ⚠️ **Lo que esta fila deja abierto** está en *«lo que esta mitad NO cierra»*: qué aviso recibe la persona por la sucesora (los otros dos, cerrados: FASE 8 completa, owner 2026-09-25)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:181, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:863

<a id="trans-b-s32"></a>

### `TRANS:B:S32` · `S32`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:864`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S32](10-corte/B7.md#tpz-s32) → [B7](10-corte/B7.md#pieza-b7) — nota de la fuente: «AS»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): **toda fila viva DE COMPLEMENTO en `ACTIVE`** del mismo `user`, con su instancia viva, que complementa a **la principal que se acaba de pausar**: `VERTICAL_SUBSCRIPTION` que cuelga de ella; `LISTING` sobre una ficha de su vertical; y `USER`/`GLOBAL` cuyo producto declara compatible esa vertical **sólo si en ninguna otra vertical compatible queda una principal viva que no esté `PAUSED` ni `SUSPENDED` (FASE 9 vuelta 1, `G2-2`) ni un ancla viva**. **Las principales no entran**; **y, por el tercer evento, sólo el `USER`/`GLOBAL`** en `ACTIVE` que complementaba a la principal que acaba de salir de las filas vivas (`V2-e`, abajo)
- **evento** (disparador): **una principal del mismo `user` pasa a `PAUSED` con motivo `CUSTOMER_REQUEST`**: `S8`, o `S35` — **o pasa a `SUSPENDED` por `S6`**, por cualquiera de sus cinco eventos (owner 2026-09-26, `G2-2`: 4a extendida a la suspensión), **o una de las once transiciones de `B/16` §4.3** (residuo visto al publicar, 2026-09-30; vale §3.2 y `B/16` §4.3: las otras eran de la discontinuación, que salió con la revisión del owner, 2026-09-28, C8) **saca de las filas vivas a una principal compatible con un `USER`/`GLOBAL`, y su orfandad no se cumple sólo porque las otras principales compatibles están `PAUSED` o `SUSPENDED`** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-e`, `N-A-03`)
- **hacia** (estado destino): `PAUSED` *(motivo `CUSTOMER_REQUEST`)*
- **condición** (guardas): **el `PUT paused` se aplicó, confirmado por relectura**, la misma regla que `S8`
- **efectos** (efectos): **Es la decisión del owner del 2026-09-25 (FASE 9 completa, 4a, `F-8CC1-004`)**: durante una pausa pedida por el cliente la principal no emite fuente (`12-contrato…` §2.6) y el pliegue descarta todo `COMPLEMENTO` sin título, así que el addon cobraba cada mes sin dar nada. **Se pausa en el proveedor por los mismos meses**: se abre la `subscription_pause` de la fila de complemento con el mismo `fin_previsto` que la de la principal. **No consume cupo de `DEC-SUB-004`**: la pausa que la persona pidió es una sola y se contó en la principal. **Si la relectura sigue viendo `authorized`, `S32` no ocurre sobre esa fila**: se queda `ACTIVE`, no se abre su `subscription_pause` y `S14` pone la marca con motivo `PAUSA_NO_APLICADA` (`B/02` §2.5, motivo 22); la principal queda pausada igual. **El complemento pausado no tiene reloj propio**: no lo alcanza `S10` (su condición exige principal); sale de `PAUSED` por `S33`, o termina por `S20` o `S21` —que le escriben `fin_real`—, y si su pausa queda colgada la ve la quinta comprobación de `B/09` §3 como la de cualquier fila. La instancia no cambia de estado. **Las pausas por `COURTESY` no pausan complementos**: la cortesía emite título (`12-contrato…` §2.6), así que el complemento se cobra y se recibe. El aviso de la pausa lo dice antes de confirmar (`B/19` §4, fila 5-bis). **Por `S6` la pausa no tiene `fin_previsto`** (owner 2026-09-26, `G2-2`): la suspensión no tiene fin, así que la quinta comprobación de `B/09` §3 no la selecciona; y el aviso es el de la suspensión (`B/19` §4, fila 10). **El motivo queda `CUSTOMER_REQUEST` aunque la causa sea la mora**, porque ninguna fila lo lee en una fila de complemento: `S10` exige principal, y `S6` no toma una `PAUSED · CUSTOMER_REQUEST`. **Por el tercer evento** (`V2-e`) corre en el mismo acto de la transición que sacó a la principal de las filas vivas: sin él, el `USER`/`GLOBAL` cuyo último título sin pausar moría por otra vía (una baja, una revocación, un grant) seguía cobrando sin título hasta que la otra principal volviera, y sin tope si estaba `SUSPENDED`, porque `S32` ya había pasado y la orfandad no se cumplía. **La pausa toma el `fin_previsto` más tardío entre las pausas de esas principales compatibles, y ninguno si alguna está `SUSPENDED`**, como por `S6`; y vuelve por `S33` cuando una de ellas pasa a `ACTIVE`, que es su evento para `USER`/`GLOBAL`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:182, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:864

<a id="trans-b-s33"></a>

### `TRANS:B:S33` · `S33` — **toda fila DE COMPLEMENTO en `PAUSED` que pausó `S32`** → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:865`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S33](10-corte/B7.md#tpz-s33) → [B7](10-corte/B7.md#pieza-b7) — nota de la fuente: «AS»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): **toda fila DE COMPLEMENTO en `PAUSED` que pausó `S32`**
- **evento** (disparador): **vuelve a haber un título sin pausar al que complementar**: la principal de la que cuelga —la suya, o la sucesora a la que `S18` lo re-apuntó— **está `ACTIVE`**: se reanuda (`S10`), `S18` lo re-apunta a una sucesora ya `ACTIVE`, o esa sucesora autoriza después (`S2`), **o la principal vuelve de `SUSPENDED` por `S7`** (owner 2026-09-26, `G2-2`) **hacia `ACTIVE`**: si `S7` la lleva a `CANCEL_SCHEDULED`, esta fila no corre y el complemento muere con `S12` por la orfandad (residuo declarado en `B/16`, *«lo que este capítulo NO cierra»*; FASE 9 vuelta 1, §4 punto 3 de `22-verificado-G2`); **o** —sólo `USER`/`GLOBAL`— otra vertical compatible pasa a tener una principal `ACTIVE`, o un ancla viva
- **hacia** (estado destino): `ACTIVE`
- **condición** (guardas): **el `PUT status=authorized` se aplicó, confirmado por relectura**, la misma regla que `S10`
- **efectos** (efectos): se escribe `fin_real` en su `subscription_pause` con el día de la reanudación confirmada (FASE 9 completa, 4a). **Si la relectura sigue viendo `paused`, `S33` no ocurre**: la fila se queda `PAUSED` y `S14` pone la marca con motivo `REANUDACIÓN_NO_APLICADA` (`B/02` §2.5), como en `S10`. **Si la principal no se reanuda sino que termina** —`S22`, **`S36` desde `PAUSED`** (owner 2026-09-26, `X-2`), `S13`, el espejo del §10.1, o `S17` sin sucesora que la releve, **y, desde una `SUSPENDED`, `S23`** (`S25` y `S27` salieron con la revisión del owner, 2026-09-28, C8)— (FASE 9 vuelta 1, `G2-2`: `S6` salió de esta lista porque `SUSPENDED` es fila viva y no termina nada; desde el 2026-09-26 pausa los complementos por `S32`), **esta fila no corre**: la condición de `B/16` §4.2 se cumple, `A5` apaga la instancia y `S21` lleva la fila de complemento a `CANCELLED` desde `PAUSED`, escribiéndole `fin_real`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:183, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:865

<a id="trans-b-s34"></a>

### `TRANS:B:S34` · `S34` — `PAUSED` *(motivo `COURTESY`)* → **el mismo estado**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9b](20-fase-2/B9b.md#pieza-b9b)
- **Fuente de la asignación**: `B/descomposicion.md:866`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S34](20-fase-2/B9b.md#tpz-s34) → [B9b](20-fase-2/B9b.md#pieza-b9b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PAUSED` *(motivo `COURTESY`)*
- **evento** (disparador): `SUPER_ADMIN` otorga cortesía
- **hacia** (estado destino): **el mismo estado**
- **condición** (guardas): **los términos del primer disparador de `S9`**: la fila es de un plan mensual y la cortesía se firma en meses enteros (`B/14` §4.7)
- **efectos** (efectos): **Cortesía sobre cortesía: se suman meses, no se reemplazan** (`DEC-GRANT-004` punto 3, `B/14` §4.7): se suman los meses a `courtesy_grant.fin` y a `subscription_pause.fin_previsto`; **al proveedor no se manda nada**, porque sigue `paused`; el aviso dice la fecha de fin nueva (`B/19` §4, fila 13-ter). **Existe porque la regla no tenía transición** (FASE 9 completa, contradicción 4 de `03` §R4.5): `S9` sale sólo de `ACTIVE` y exige *«no hay pausa vigente»*, así que la única fila que otorga cortesía bloqueaba la segunda

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:184, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:866

<a id="trans-b-s35"></a>

### `TRANS:B:S35` · `S35` — `PAUSED` *(motivo `COURTESY`)* → `PAUSED` *(motivo `CUSTOMER_REQUEST`)*

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9b](20-fase-2/B9b.md#pieza-b9b)
- **Fuente de la asignación**: `B/descomposicion.md:867`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S35](20-fase-2/B9b.md#tpz-s35) → [B9b](20-fase-2/B9b.md#pieza-b9b)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PAUSED` *(motivo `COURTESY`)*
- **evento** (disparador): la persona pide pausar
- **hacia** (estado destino): `PAUSED` *(motivo `CUSTOMER_REQUEST`)*
- **condición** (guardas): **confirmó el aviso de que pierde la cortesía que le quedaba** (`DEC-GRANT-004`), **y los términos de `puedePausar()` salvo el de estado** —cupo y ciclo mensual—: esta fila decide lo que `puedePausar()` no puede, porque su término `estado == ACTIVE` (`NUCLEO/01` §3) la excluye
- **efectos** (efectos): **cierra la `subscription_pause` de la cortesía con `fin_real` hoy** —la cortesía termina—, **abre una nueva de la persona** por los meses que pidió, que sí cuenta contra `DEC-SUB-004`, y **al proveedor no se manda nada**: sigue `paused`. **Y desde acá sus complementos se pausan por `S32`**: durante la cortesía se cobraban y se recibían. **Existe porque el cruce estaba decidido y no ejecutado** (FASE 9 completa, contradicción 5 de `03` §R4.5): §5 dice *«en cortesía pide pausar → se permite»*, pero `S8` sale sólo de `ACTIVE`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:185, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:867

<a id="trans-b-s36"></a>

### `TRANS:B:S36` · `S36`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:868`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S36](10-corte/B5.md#tpz-s36) → [B5](10-corte/B5.md#pieza-b5)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED` **o `PAUSED`, con cualquiera de los dos motivos** (owner 2026-09-26, `X-2`; FASE 9 vuelta 1, `N-3` de `25-verificado-G5`: la condición legal es el plazo, no el estado)
- **evento** (disparador): **una persona registra la revocación del derecho de arrepentimiento** que el cliente pidió por el canal que sea —correo, soporte—: la acción *«cancelar una suscripción»* de `NUCLEO/08` §3 **con motivo revocación**, que **no suma fila al catálogo**
- **hacia** (estado destino): `CANCELLED`
- **condición** (guardas): **dentro de los 10 días corridos del cobro que se revoca** (Resolución 424/2020, `DEC-RF-001`)
- **efectos** (efectos): **en un solo acto, que es la parte 1 de `DEC-RF-001`** —*«no dos cosas que alguien tenga que acordarse de hacer juntas»*—: **cancela el preapproval** con la regla de relectura de `S17` y **nuestro correo antes de la llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*) —sobre un pagador manual no se manda nada, como en `S23`, y desde `CANCEL_SCHEDULED` la relectura ya lo ve `cancelled` por `S11` y `D7` está cumplido; **desde `PAUSED` cancela el preapproval pausado, que el proveedor deja cancelar aunque rechace toda otra modificación (`EX-11`), como `S22`**—. **De la regla de `S17` toma la relectura y no el *«si falla, no ocurre»***: como `S22`–`S24`, la fila llega a `CANCELLED` pase lo que pase con la llamada, y si la llamada no se aplicó la reintenta el barrido por la salvedad 4 de `B/09` §3, que ya la cuenta; leída con la rama de fallo de `S17`, una llamada fallida dejaba la revocación sin ocurrir y, con un evento humano que nadie reevalúa, perdida sin marca (FASE 9 vuelta 1, `N-4` de `25-verificado-G5`); **corta el servicio en el acto**: `fin_de_servicio` es el instante del registro y no pasa por `CANCEL_SCHEDULED`, como `S24`, y desde `GRACE_PERIOD` **apaga el reloj del §4**; **desde `PAUSED` corta el servicio como `S22` y escribe `fin_real` en su `subscription_pause`** con el día del registro (owner 2026-09-26, `X-2`); y **crea `RF1` por el total del último pago acreditado**, que espera la confirmación humana de `RF2` (`DEC-RF-002`; §6.1) — **sobre una sucesora que todavía no tiene ningún pago acreditado** porque vive del crédito de `DEC-SUB-006`, **el último pago acreditado es el de su predecesora**, que encuentra por `sucedida_por` —la fila cuya `sucedida_por` es ésta, y así hacia atrás hasta la primera con un pago—, y los 10 días corridos se cuentan desde ese cobro (FASE 9 vuelta 2, owner 2026-09-27, `R17`, `F-8V2B1-005`): el crédito salió de ese pago, así que devolverlo entero devuelve también el crédito que se corta. **El botón de arrepentimiento sigue fuera de alcance** (`DEC-RF-001` parte 4): esta fila es lo que el botón va a llamar cuando entre. Sin ella la revocación era la baja de siempre más un reembolso, dos acciones en el orden que alguien recordara, y desde `ACTIVE` ninguna fila cortaba el servicio en el acto —`S11` deja el período entero— (owner 2026-09-26, `G5-4`; FASE 9 vuelta 1, `F-8V1B1-004`). **Y si la fila es la predecesora de una sucesión en curso, dispara `S18`**, igual que `S23` y `S24`: la predecesora se muere sola, sin `S17`, y sin `S18` el candado `A` quedaría vacío; si además retenía un pago por `S19` —desde `GRACE_PERIOD`—, es la **misma** rama 6 de `B/12` §5.3 y no una séptima (owner 2026-09-26, FASE 9 vuelta 1, M), **y ese pago retenido es el último pago acreditado que devuelve el `RF1` de esta fila**: los 10 días corridos se cuentan desde él, y la rama 6 no abre marca sobre ese pago, porque dos caminos de reembolso sobre el mismo pago proponían devolverlo dos veces (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-o`). **Y saca a la principal de las filas vivas, así que dispara la orfandad de sus complementos**: es una de las once transiciones de `B/16` §4.3 *(revisión del owner, 2026-09-28, C8: salen `S25`, `S27` y `S28`; sin ordinales; residuo corregido el 2026-10-02)* (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`, `F-8V2D1-001`). `A5` y `S21` corren en este mismo acto, y el último cobro de cada complemento **se devuelve por `RF1` si cae dentro de sus propios 10 días corridos**; si no, `S21` abre el motivo 14 (ver abajo, *«cuál de los dos motivos abre `S21`»*). **Y la misma orfandad alcanza al addon de única vez, que no tiene fila de complemento y `S21` no toma** (FASE 9 vuelta 3, owner 2026-09-30, lote L, `F-8V3B1-006`): por cada instancia `UNA_VEZ` que `A5` apaga en este mismo acto y cuyo pago se acreditó dentro de los mismos 10 días corridos, **esta fila crea `RF1` por el total de ese pago**, colgado del `payment` de la instancia (`B/02` §2.3); se devuelve por el camino de las órdenes de `RF2` (§6.1). Fuera de ese plazo no se abre nada, porque la regla de `DEC-ADDON-001` ya dice que un `UNA_VEZ` se consume

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:186, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:868

<a id="trans-b-s37"></a>

### `TRANS:B:S37` · `S37` — `ACTIVE` → el mismo estado

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B12](20-fase-3/B12.md#pieza-b12)
- **Fuente de la asignación**: `B/descomposicion.md:869`
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S37](20-fase-3/B12.md#tpz-s37) → [B12](20-fase-3/B12.md#pieza-b12) — nota de la fuente: «también con el motivo *«aumento»* (BZ)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`
- **evento** (disparador): **llega el día de la migración de esa fila**: siete días antes de su **fecha de aplicación**, que es su primera fecha del próximo cobro **estrictamente posterior** a cumplirse el aviso de la migración (el empate lo gana el cliente, como en `DEC-MP-002`) (revisión del owner, 2026-09-28, C15, `L1-g`; `B/10` §3.7)
- **hacia** (estado destino): el mismo estado
- **condición** (guardas): **la fila es principal y tiene su fila de alcance de la migración en `PENDIENTE`** (`B/02` §2.2); **la versión destino ofrece su ciclo**; **no es predecesora ni sucesora de una sucesión en curso** y **no tiene un cambio programado en la cola** de `B/12` §2. **Sobre un pagador con tarjeta, relee el preapproval por id antes de actuar** (`D17`): si no lo lee `authorized`, `S37` no ocurre y la fila espera como una pausada o una en grace. **Sobre un pagador manual no relee ni muta** (verificación corta, 2026-09-29, lote M-B): no tiene preapproval, y su cuota no guarda monto, sale de la versión anclada (`B/02` §2.3), así que para él la migración entera es el cambio de versión
- **efectos** (efectos): **se muta `transaction_amount` al precio de lista de la versión destino para su ciclo, sin promos** (la promo se pierde en todo cambio de plan, `B/14` §2.2, y el pedido escribe `cobros_restantes = 0` como el de un downgrade, `B/12` §2.3) **sobre la misma autorización, sin re-autorizar**, como un aumento (`DEC-MP-001`, `DW-1`), **y se verifica releyendo** (`D5`), porque la mutación no emite aviso (`EX-15`). **Encola el cambio de versión para la fecha de aplicación** en la cola de `B/12` §2, que es la que aplica el descenso de un downgrade, y es ahí, y no acá, donde la fila cambia de versión y emite el aviso de cobertura, **por `S38`** (revisión del owner, casos vecinos, 2026-09-29, caso 37); si la migración baja algo, **el excedente es de esa misma fecha**, avisado antes (`V/15` §4.2). **Con la mutación confirmada, la fila de alcance pasa a `APLICADA`.** **Sobre un pagador manual, `S37` sólo encola el cambio de versión para la fecha de aplicación, manda el tercer correo y pasa la fila de alcance a `APLICADA`, en el mismo acto**; `S38` le cambia la versión antes de que `MP5` abra la cuota de ese período, así que la cuota ya sale con el precio destino (verificación corta, 2026-09-29, lote M-B). **Si la mutación no se aplica, la retoma el barrido**, que en esa ventana espera el precio de la versión destino (`B/14` §2.4; verificación corta, 2026-09-29, lote M-C): reintenta 3 días contados desde esta transición (caben antes del cobro: para eso `S37` corre siete días antes) y después abre `DIVERGENCIA_DE_MONTO` (`B/09` §3) sin encolar el cambio de versión. **Nuestro correo sale antes que el del proveedor**: el tercero de la migración, a 7 días, se manda en el mismo acto y antes de mutar (`DEC-MAIL-001`; `B/19` §4). **Pausadas y en grace no corren acá**: su `desde` no es `ACTIVE`, y la fecha de aplicación se recalcula a la primera renovación después de volver o de ponerse al día (`B/10` §3.7). Construye **B12**; **y la usa también un aumento de precio a un cliente anclado, con el motivo *«aumento»*: es una migración a la versión nueva, con la fecha y los contactos del plazo 11 (no el 12), sin la cohorte `PARA_RESOLVER` —el ciclo es el mismo— y conservando la promo viva, porque el monto esperado ya la descuenta (`B/09` §3)** (corte del MVP, owner 2026-10-02, BZ; `DEC-MP-002`, parte 2)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:187, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:869

<a id="trans-b-s38"></a>

### `TRANS:B:S38` · `S38`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:870`
- **Adjudicación** (`adjudicacion.json`): VIVO — los ⚠️ tachados quedaron decididos en la misma fila (G-A, I-A, I-B); «Construye **B8**» se lee `B8b` (B §2.12); lo tachado de la fila se omite y lo vigente va entero.
- **Traslado a pieza** (`B/descomposicion.md` §2.12): [TPZ:S38](20-fase-2/B8b.md#tpz-s38) → [B8b](20-fase-2/B8b.md#pieza-b8b) — nota de la fuente: «también con el motivo *«aumento»*, que usa `B12` (BZ)»
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE` **o `GRACE_PERIOD`** (revisión del owner, casos vecinos, 2026-09-29, caso G-A)**, y `CANCEL_SCHEDULED` cuando la dejó ahí `S7`** (revisión del owner, casos vecinos, 2026-09-29, caso I-A)
- **evento** (disparador): **llega la fecha del cambio programado de la fila** en la cola de `B/12` §2: el fin del ciclo en que se pidió un downgrade, o la fecha de aplicación de una migración que `S37` encoló (revisión del owner, casos vecinos, 2026-09-29, caso 37); **o la fila vuelve a `ACTIVE` con esa fecha ya pasada: por `S10` si la fecha la encontró pausada, que es la espera que esta fila ya declaraba, o por `S7` si la encontró suspendida** (revisión del owner, casos vecinos, 2026-09-29, caso G-A)**; y `S7` también puede devolverla a `CANCEL_SCHEDULED`, cuando el cobro entró sobre un preapproval que `S6` ya canceló: el evento es el mismo** (revisión del owner, casos vecinos, 2026-09-29, caso I-A)
- **hacia** (estado destino): el mismo estado
- **condición** (guardas): **la fila tiene un cambio programado en la cola** (a lo sumo uno, `B/12` §2.2) **y no está pausada** **ni suspendida**: una pausada espera a la reanudación (colisión 4 del `B/12` §2.2, `EX-11`); **una suspendida espera a volver por `S7`, porque no tiene servicio que bajar; y en `GRACE_PERIOD` se aplica igual, porque el servicio sigue y el monto ya se mutó, así que esperar la dejaba con capacidades que ya no paga** (revisión del owner, casos vecinos, 2026-09-29, caso G-A). **Si `S7` la devuelve a `CANCEL_SCHEDULED`, se aplica igual: el período que se sostiene hasta `S12` se pagó con el monto ya mutado, y descartarlo le dejaba hasta el final las capacidades que ya no paga** (revisión del owner, casos vecinos, 2026-09-29, caso I-A). **Un pagador con tarjeta suspendido no vuelve por `S7` sino como sucesora (`DEC-SUB-019`), y el cambio muere con la fila vieja, como en la colisión 2 del `B/12` §2.2: la sucesora eligió su plan en el checkout y nace sin cola** (revisión del owner, casos vecinos, 2026-09-29, caso I-B). **No depende del estado del proveedor ni lo toca**: el monto ya se mutó al pedir el downgrade (`DEC-SUB-008`) o en `S37`
- **efectos** (efectos): **la fila pasa a la versión y a la billing option destino** del cambio encolado, **aplica la elección de qué conservar** del excedente (`V/15` §4.2) y **vacía la cola**. **Cuando la fecha coincide con la apertura de la cuota de un pagador manual (`MP5`, §7), `S38` corre antes**: la cuota de ese período se abre con la versión destino (verificación corta, 2026-09-29, lote M-B). Como le cambia la `referencia` a la fuente `SUSCRIPCIÓN` sin cambiar el estado, **emite el aviso de cobertura** después del commit (`12-contrato…` §3, *«quién emite»*). **Es el nombre del acto que la cola ya describía y no tenía fila**: el descenso de un downgrade, y desde C15 el cambio de versión de una migración. **Decidido: en `GRACE_PERIOD` se aplica igual, y en `SUSPENDED` espera y se aplica al volver por `S7`** (revisión del owner, casos vecinos, 2026-09-29, caso G-A). **Decididos los dos bordes: con `CANCEL_SCHEDULED` por `S7` se aplica, y con el pagador con tarjeta que vuelve como sucesora el cambio muere con la fila vieja** (revisión del owner, casos vecinos, 2026-09-29, casos I-A e I-B). Construye **B8**; **B12** la usa para la migración; **y con el motivo *«aumento»* cambia la versión en la fecha de aplicación del plazo 11, sin la cohorte `PARA_RESOLVER` y con la promo viva conservada; la usa `B12` para el aumento como para la migración** (corte del MVP, owner 2026-10-02, BZ)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:188, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:870

## Transiciones que no existen (`B/03` §3.3)

### Transiciones que no existen (`B/03` §3.3) — «3.3 Las transiciones que NO existen, y por qué»

Texto de `B/03-maquinas-de-estado.md:1447–1483`, sin lo tachado:

Tan importantes como las que existen, porque cada una es un error que alguien va a intentar
escribir:

**El arrepentimiento no le quema al cliente el período que ya pagó, y hay que decirlo porque
`S17` lo pasa a `CANCELLED` antes de su fecha de fin de servicio.** Lo que esa fecha sostenía era
**la emisión de cobertura** de la predecesora (`12-contrato…` §2.6), y a partir de `S18` la
cobertura la da la sucesora, que está `ACTIVE`. Y lo pagado sin usar **no se pierde**: la
sucesión del arrepentimiento computa el crédito de `DEC-SUB-006` como cualquier otra, *«al crear
la sucesora»* (`B/12` §5.4), corriendo la fecha de su primer cobro. Es la misma uniformidad que
`B/12` §5.2 defiende para la precondición de `D8` —*«vale para toda sucesión, venga de donde
venga»*—: una sucesión con una regla de compensación propia según de dónde viene es una regla que
alguien va a leer mal.

**Dos cosas que el §11 sigue prohibiendo y conviene no confundir con la excepción**: una sucesora
**no puede ser sucedida mientras viva** (el candado `B` la rechaza sin ninguna regla extra), y una
fila **con una marca `requiere_conciliación` abierta no puede ser sucedida** —cualquiera sea su motivo, y **ningún `sucede_a` puede escribirse apuntándola**, que se chequea al declarar
la sucesión; **una marca que se abre sobre una predecesora con la sucesión ya en curso no la
deshace** (`B/02` §2.2, `B/05` §3; FASE 9 vuelta 1, `F-8V1B2-005`: era la gemela de la frase
corregida en `B/02`)—, salvo desde `CANCEL_SCHEDULED` **o desde una `SUSPENDED` de pagador con tarjeta**
(FASE 8 completa, `F-8CB1-002`, owner 2026-09-25), y en los dos casos con la relectura que `B/02`
§2.2 exige. **Las
dos se enuncian sobre la columna y no sobre el verbo *«declarar»***, que en este corpus nombra a
la sucesora en `S1` y a la predecesora acá: la regla de vocabulario está en `B/02` §2.2 y la
escribió un doble cobro.

## Transiciones que no existen (`B/03` §3.3) — las filas

<a id="proh-b-1"></a>

### `PROH:B:1` · `CANCEL_SCHEDULED` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a) *(asignación inferida en `cobertura.json`)*
- **Fuente de la asignación**: `B/descomposicion.md:847`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an), [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)): integración con DB que intenta la transición y comprueba que no ocurre, en la pieza dueña.
- **lo que no existe**: `CANCEL_SCHEDULED` → `ACTIVE`
- **por qué**: arrepentirse **no es una transición: es una sucesión**. `DEC-SUB-009` cancela en el proveedor de inmediato y cancelar allá es irreversible (`PA-5`), así que volver exige recrear y volver a autorizar — y eso entra por el candado `B` igual que un upgrade, **no** por un `INSERT` que el §11 rechace. No hay riesgo de doble cobro: `S11` ya canceló el preapproval de la predecesora *«de inmediato»*, así que la única autorización que puede cobrar es la de la sucesora. **Y por eso mismo `S17` no manda nada acá**: su relectura encuentra el preapproval ya `cancelled`, `D7` está cumplido, y la sucesión la cierra `S18` (§3.2)

**Texto de la fuente — «3.3.1 Tres estados desde los que el cambio de plan NO se ofrece»** (`B/03-maquinas-de-estado.md:1484–1519`, sin lo tachado):

Los dos primeros salieron de recorrer el dominio completo del candado y **ningún informe de FASE 8
los tenía**; el tercero, `GRACE_PERIOD`, lo agregó `DEC-SUB-021` (owner 2026-09-25; FASE 8
completa, `F-8CD1-002`, `F-8CB1-009`). En los tres, **la operación no se ofrece, con el motivo
explícito en pantalla**:

| estado | qué había escrito | qué se le dice |
|---|---|---|
| `PENDING_AUTHORIZATION` | **nada**. Ningún capítulo lo nombra: el §3.4 punto 4 dice qué pasa si reintenta **el mismo** plan —*«no se crea otra, se reusa la vigente»*— y nada de cambiar a otro | *«terminá o cancelá el checkout que tenés abierto»* |
| `PAUSED` | una regla **cuyo destino no existe**: este mismo § prometía que el cambio *«se encola y se aplica al reanudar»*, y la cola de `B/12` §2.1 **es de entitlements, no de checkouts** | *«reanudá tu suscripción para cambiar de plan»* |
| `GRACE_PERIOD` ✚ | que se podía, con cobro inmediato del plan nuevo (`DEC-SUB-003`, superada por `DEC-SUB-021`) | **qué hacer para regularizar, según el método de pago**: con tarjeta, *«cambiá tu tarjeta»* — (tachado 2026-09-26) **al cambiarla se reintenta el cobro en el momento y cobra con ella** (`GR-1` `VERIFIED` el 2026-09-26, sonda 49: el mismo registro, ≈1-2 min después del cambio; una muestra, y la hora del cambio la informó el owner), **y la pantalla lo dice**; si ese cobro no entra antes del fin del grace, va a tener que volver a suscribirse—; con pago manual, *«pagá tu cuota»*. Y que **recién con la suscripción al día** puede cambiar de plan (`B/19` §4 fila 17-bis) |

**Y el primero alcanza también al alta NUEVA, no sólo al cambio de plan.** El caso es el del
cliente cuya suscripción murió sola —`S12`, `S16` o el espejo del §10.1— teniendo una sucesora
esperando autorización:
`S18` cierra la sucesión en el acto y esa sucesora pasa a ocupar el candado `A` (§3.2), así que el
alta nueva que `B/12` §4.4 le ofrecería **la rechaza la base**. Lo que la superficie tiene que
ofrecer ahí es lo mismo de la primera fila: terminar o abandonar el checkout abierto, con su
enlace y su fecha de vencimiento. **Es la única forma de que no queden dos preapprovals
cobrando**, y no lo deja bloqueado: abandonar lo lleva a `ABANDONED`, que no es vivo, y desde ahí
el alta nueva entra sin pelear con nada.

**Por qué no se construye el mecanismo, y no es por costo**: los dos son de **superficie, no de
modelo**, y en ninguno el cliente queda bloqueado. En el primero tiene un checkout abierto que
puede terminar o abandonar —y abandonarlo lo deja en `ABANDONED`, desde donde sí puede elegir
otro—; en el segundo puede reanudar y cambiar. Construir la cola del segundo además exige pelear
contra `EX-11`, que mide que **el proveedor rechaza toda modificación sobre una pausada**.
**El tercero no es de superficie sino de decisión** (`DEC-SUB-021`), y tampoco bloquea: la persona
regulariza —cambia la tarjeta o paga la cuota—, vuelve a `ACTIVE` por `S5`, y ahí cambia de plan. *(Tachado 2026-09-26: `GR-1` quedó `VERIFIED` — cambiar la tarjeta dispara un reintento en el momento que cobra con ella, y la pantalla lo puede decir.)*

**Lo único que faltaba era decir el no en voz alta**, en vez de que alguien lo descubra
implementando.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1454, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:847, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1484

<a id="proh-b-2"></a>

### `PROH:B:2` · `CANCELLED` → cualquier cosa

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a) *(asignación inferida en `cobertura.json`)*
- **Fuente de la asignación**: `B/descomposicion.md:848`; `B/descomposicion.md:859`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an), [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)): integración con DB que intenta la transición y comprueba que no ocurre, en la pieza dueña.
- **lo que no existe**: `CANCELLED` → cualquier cosa
- **por qué**: ídem. Una suscripción terminada no revive

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1455, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:848, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:859

<a id="proh-b-3"></a>

### `PROH:B:3` · `TRIAL_*` → `SUSPENDED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an), [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)): integración con DB que intenta la transición y comprueba que no ocurre, en la pieza dueña.
- **lo que no existe**: `TRIAL_*` → `SUSPENDED`
- **por qué**: el trial vencido es `TRIAL_EXPIRED`, que es otra máquina y otro estado (`DEC-ARCH-003`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1456, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="proh-b-4"></a>

### `PROH:B:4` · `PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED` **—salvo `SUSPENDED` por `S6` desde una cortesía (abajo)—** **y salvo `CANCEL_SCHEDULED` por `S22` sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`: tampoco choca con la razón de esta fila, porque `S22` cancela el preapproval pausado, que `EX-11` mide que se puede)

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:846`; `B/descomposicion.md:858`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an), [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)): integración con DB que intenta la transición y comprueba que no ocurre, en la pieza dueña.
- **lo que no existe**: `PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED` **—salvo `SUSPENDED` por `S6` desde una cortesía (abajo)—** **y salvo `CANCEL_SCHEDULED` por `S22` sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`: tampoco choca con la razón de esta fila, porque `S22` cancela el preapproval pausado, que `EX-11` mide que se puede)
- **por qué**: **La excepción, del owner** (FASE 8 completa, pendiente 8, owner 2026-09-25): **`PAUSED` con motivo `COURTESY` → `SUSPENDED` por `S6`, sólo por su tercer evento —el contracargo—**, porque la cortesía da servicio y un contracargo corta a toda fila que da servicio (`DEC-SUB-020`, su 📌). **No choca con la razón de esta fila**: `S6` no modifica el preapproval pausado, **lo cancela**, que es justo lo que `EX-11` mide que sí se puede. Lo demás de la celda sigue igual: está medido que **estando pausada el proveedor rechaza toda modificación** (`EX-11`), y que **sí deja cancelar**. **Las dos que quedan afuera de la prohibición tienen fila**: `ACTIVE` es `S10`, y `CANCELLED` es **`S22`** —la baja— y `S13` —el grant—. Esta celda decía qué no pasa y, hasta `S22`, una de las dos que sí pasan no estaba escrita. (`S25` salió con la revisión del owner, 2026-09-28, C8)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1457, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:846, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:858

<a id="proh-b-5"></a>

### `PROH:B:5` · `ABANDONED` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:839`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an), [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)): integración con DB que intenta la transición y comprueba que no ocurre, en la pieza dueña.
- **lo que no existe**: `ABANDONED` → `ACTIVE`
- **por qué**: la ventana venció y el preapproval se canceló. Volver a intentar crea una fila nueva, con clave de idempotencia nueva

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1458, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:839

<a id="proh-b-6"></a>

### `PROH:B:6` · dos vivas para el mismo `user + vertical`, **salvo una sucesión declarada**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:837`; `B/descomposicion.md:137`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an), [AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)): integración con DB que intenta la transición y comprueba que no ocurre, en la pieza dueña.
- **lo que no existe**: dos vivas para el mismo `user + vertical`, **salvo una sucesión declarada**
- **por qué**: es el §11, y su excepción está acotada por la base, no por una convención: **un origen y su única sucesora**, impuesto por los dos índices parciales de `B/02` §2.2. La condición está en `S1` y el capítulo 05 la hace cumplir con restricciones de unicidad, no con un chequeo. El invariante cuenta **compromisos, no filas**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1459, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:837, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:137

## Pago (`B/03` §6)

### Pago (`B/03` §6) — «6. Pago»

Texto de `B/03-maquinas-de-estado.md:1740–1832`, sin lo tachado:

La máquina tenía **cinco** estados y gana **un sexto**, `CHARGED_BACK`, con dos filas —`P6` y
`P7`— (FASE 8 completa, `F-8CB3-009`, `DEC-SUB-020`, owner 2026-09-25). El diagrama anterior, sin
él:

```text
  PENDING ──► SUCCEEDED ──► PARTIALLY_REFUNDED ──► REFUNDED
     │             │                                   ▲
     └──► FAILED   └───────────────────────────────────┘
```

El vigente:

```text
  PENDING ──► SUCCEEDED ──► PARTIALLY_REFUNDED ──► REFUNDED
     │          │   ▲ │                                 ▲
     └──► FAILED│   │ └─────────────────────────────────┘
                ▼   │
            CHARGED_BACK      P6 va, P7 vuelve si la disputa se gana
```

El diagrama no dibuja la segunda entrada: **`P6` sale también de `PARTIALLY_REFUNDED`**, y `P7`
vuelve a ese estado cuando el pago ya tenía reembolsos (FASE 8 completa, pendiente 6, owner 2026-09-25).

**`settled` no es una fila, porque no mueve el estado**: la disputa se perdió, **el pago se queda en
`CHARGED_BACK`**, que pasa a ser su estado final, y la marca `CONTRACARGO` sigue abierta hasta que
la persona la levante por `S15` (`DEC-SUB-020`; `RC-8`, documental).

**Las dos resoluciones le avisan a la persona, con un correo transaccional cada una** (`NUCLEO/07`
§6, `B/19` §4 fila 10-ter; FASE 8 completa, pendiente 8, owner 2026-09-25): al leer `settled`,
*«la disputa se resolvió a tu favor; tu suscripción sigue **suspendida**; podés
volver cuando quieras»* cuando la fila está `SUSPENDED`, y *«sigue cancelada»* cuando está
`CANCELLED` (FASE 8 completa, owner 2026-09-25); al correr `P7` por `reimbursed`, *«la disputa se
resolvió; el cargo era correcto; podés volver a suscribirte desde acá»*. **Cerrado el 2026-09-25 (owner,
FASE 8 completa)**: **el barrido relee también los pagos en `CHARGED_BACK` hasta que su
`status_detail` se resuelva** —`settled` o `reimbursed`—, así que alguien lee el resultado de la
disputa aunque no llegue el aviso del proveedor, y esa lectura dispara el correo que corresponde
(`B/09` §3).

**Por qué hace falta un estado nuevo y ninguno de los cinco alcanza.** Se probó expresarlo con uno
existente y no cierra por ninguno de los dos lados:

- **Dejarlo en `SUCCEEDED` es el defecto**: la fila dice cobrado sobre una plata que el banco se
  llevó, y es exactamente lo que `F-8CB3-009` encontró — *«nadie lo compara»*.
- **`REFUNDED` y `PARTIALLY_REFUNDED` dicen otra cosa y no vuelven**: son el resultado de un
  **reembolso nuestro**, con su fila de `refund` y **quién lo confirmó** (`B/02` §2.3,
  `DEC-RF-002`); `P3` además **libera** el período (`B/02` §2.3). Un contracargo no tiene `refund`
  ni confirmación nuestra, y **se puede deshacer** —`reimbursed`—, mientras que ninguna fila sale de
  un estado de reembolso hacia `SUCCEEDED`. Meterlo ahí obligaba a una vuelta atrás que la máquina
  de reembolsos no tiene, o a inventar un `refund` que nadie confirmó.

**Cerrado el
2026-09-25 (owner)**: un contracargo sobre un pago **ya `PARTIALLY_REFUNDED`** tiene el mismo
tratamiento que sobre `SUCCEEDED` (FASE 8 completa, pendiente 6, owner 2026-09-25). `P6` sale de los dos, y `P7` no necesita guardar
de cuál salió: lo lee en el monto reembolsado acumulado del pago.

**Un reembolso hecho desde el panel del proveedor, sin nuestro flujo, NO corre `P3` ni `P4` solo.**
La comprobación de pagos acreditados del barrido (`B/09` §3) lo ve —un pago nuestro `SUCCEEDED`
que el proveedor da reembolsado, o con más reembolsado que nuestros `refund`— y **`S14` abre la
marca con motivo `REEMBOLSO_FUERA_DEL_FLUJO`** (`B/02` §2.5) con el pago colgado, **sin suspender**:
fue un acto nuestro y no del cliente (`DEC-SUB-020`, *«lo que NO decide»*; `DEC-RF-007`, la
reparación es manual y con rastro). **El `refund` que falta lo asienta la persona al resolverla**,
con quién lo confirmó, y recién ahí corre `P3` o `P4`: escribirlo solo sería un `refund` sin nadie
que lo confirmara, que es lo que `DEC-RF-002` prohíbe.

**Tres reglas que salen de la medición y no de la forma de la máquina:**

- **Reembolsar no da de baja nada.** Está medido sobre una suscripción viva. Por eso la
  revocación del derecho de arrepentimiento es **una sola operación: reembolso + cancelación**,
  y un reembolso por otra causa —un duplicado, un error nuestro— **no cancela** (`DEC-RF-001`).
- **Ante el rechazo `2084`, el sistema nunca concluye que el pago no se puede reembolsar.**
  Está medido que ese mensaje miente: sobre el mismo pago, ARS 5 se rechazó y ARS 14 entró
  (`RF-8`). Reintenta **sin pasar nunca del monto
  confirmado**: partido en parciales que suman lo confirmado —`RF-2` midió que se acumulan—, cada
  uno con su propia clave persistida antes; **cae al total sólo si lo confirmado es el total del
  saldo**, que es el caso de la revocación (`D11`; FASE 9 vuelta 1, `F-8V1B1-005`; `RF2` del §6.1).
- **Un reembolso emite tres notificaciones en dos formatos para el mismo hecho** (`RF-7`), así
  que deduplicar por tipo de evento no alcanza.

## Pago (`B/03` §6) — las transiciones

<a id="trans-b-p1"></a>

### `TRANS:B:P1` · `P1` — `PENDING` → `SUCCEEDED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B9b](20-fase-2/B9b.md#pieza-b9b) (provee), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:139`; `B/descomposicion.md:896`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING`
- **evento** (disparador): el proveedor acredita
- **hacia** (estado destino): `SUCCEEDED`
- **nota** (guardas y efectos): si el pago es de una suscripción con una redención de promo cuyo `cobros_restantes` es mayor que 0, **lo decrementa en uno en el mismo acto** (`B/02` §2.4) —**sólo si el cobro salió con el descuento**: su importe no pasa del monto esperado con esa promo aplicada (`B/14` §2.4); si salió sin él, el contador no se mueve y lo cobrado de más lo marca el barrido con el motivo 24 (owner 2026-09-27, FASE 9 vuelta 2, `R20`, `F-8V2B3-001`)—, y si llega a 0 corre `S30`; si cuelga de una instancia de addon, no escribe `covered_period` (`B/02` §2.3) (corrección de diseño, FASE 8 completa, `F-8CB1-007`, `F-8CB1-008`). **Corre también sobre una fila de `payment` que ya existe**: un reintento que se aprueba **dentro del mismo registro de cobro** llega con el mismo id del hecho, y `C6` ya no lo descarta — relee la fila existente y, si está `PENDING` y la lectura por id dice `approved`, corre este `P1` sobre ella (`B/05` C6, §10.2; FASE 8 completa, `F-8CB3-003`). **El período que escribe en `covered_period` sale de la fecha del propio registro de cobro**, no de la fecha del próximo cobro (`B/02` §2.3; FASE 8 completa, `F-8CB3-005`, `F-8CB1-011`). **Si esa escritura choca con el `UNIQUE`** —el período ya tiene un cobro acreditado—, **el pago pasa igual a `SUCCEEDED`**: la plata entró y el hecho se registra, porque rechazarlo dejaba plata sin fila; **no se escribe la cobertura**, y `S14` abre la marca con motivo **`COBRO_DUPLICADO`** (`B/02` §2.5, motivo 20; FASE 8 completa, pendiente 6, owner 2026-09-25) **con el pago colgado**: un período con dos cobros lo mira una persona, con el default de devolver (`B/19` §6) (`DEC-CONC-002` punto 4). **Y emite el comprobante** —el `receipt` de este cobro, `B/02` §2.3, `DEC-LEGAL-001`—, también sobre el pago de un addon de única vez (FASE 8 completa, `F-8CB3-006`), **con la copia del nombre y el correo de quien paga, leídos de la fila de `user` dueña del cobro en esta misma transacción** (revisión del owner, casos vecinos, 2026-09-29, caso K-A; `B/02` §2.3). **Salvo sobre una cuenta que la acción 24 ya dio de baja** (`NUCLEO/08` §3; verificación corta, 2026-09-29, lote N-C), que la misma fila de `user` dice: su nombre y su correo ya son el seudónimo, así que `P1` **deja las dos columnas nulas y el comprobante sin enviar**, como sobre una lápida; el resto de lo que hace no cambia. Es la red de la precondición de la 24, que no alcanza a un cobro en vuelo. **Y si es el primer pago acreditado de una suscripción, emite el aviso de cobertura** (`12-contrato…` §3) **después de su commit, nunca dentro de su transacción** —adentro, la máquina de trial relee `cobrada: no` y `T2` no dispara— (FASE 9 vuelta 2, `F-8V2C1-002`): su `cobrada` pasa de `no` a `sí`, que es lo que convierte el trial (`V/03` §2, `T2`; `DEC-TRIAL-010`, owner 2026-09-25). **Sobre una lápida —la de recepción, la única que queda (FASE 5, simplificación del corte, S-40 y S-70)— el asiento es este `P1`, con menos efectos** (FASE 9 vuelta 2, `F-8V2B3-005`): el `payment` nace `PENDING` colgado de la lápida y pasa a `SUCCEEDED` en la misma transacción que lo escribe, porque la plata entró y la devolución que proponga su marca (`B/09` §2.4) sale de un pago acreditado. **No escribe `covered_period`** (la lápida no da servicio y no se extiende nada), **no toca ninguna promo** (no tiene redención) **y no emite el aviso de cobertura**: la lápida no tiene usuario ni vertical y no es una fila que emita fuente, así que no hay `cobrada` que pase a `sí`. **Sí emite el comprobante**, que `DEC-LEGAL-001` pone por cada cobro; no tiene destinatario, así que queda en su fila sin enviarse, **y sin nombre ni correo del pagador, porque no hay `user` del que copiarlos** (revisión del owner, casos vecinos, 2026-09-29, caso K-A; `B/02` §2.3). La marca, cuando la hay, se escribe en la misma transacción que el `payment`, y nada de lo que corre después del commit la revierte

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1767, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:896

<a id="trans-b-p2"></a>

### `TRANS:B:P2` · `P2` — `PENDING` → `FAILED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Adjudicación** (`adjudicacion.json`): VIVO — reemplazo explícito (R1); lo tachado de la fila se omite y lo vigente va entero.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING`
- **evento** (disparador): **vence la ventana del proveedor sin cobro**
- **hacia** (estado destino): `FAILED`
- **nota** (guardas y efectos): **ya no dispara `S4`**: desde la FASE 8 completa (`R1`) lo dispara el **primer rechazo**, leído por id, con el pago todavía `PENDING` mientras el proveedor reintenta (`B/12` §1.2-§1.3)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1768, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-p3"></a>

### `TRANS:B:P3` · `P3` — `SUCCEEDED` → `REFUNDED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `SUCCEEDED`
- **evento** (disparador): reembolso total
- **hacia** (estado destino): `REFUNDED`
- **nota** (guardas y efectos): —

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1769, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-p4"></a>

### `TRANS:B:P4` · `P4` — `SUCCEEDED` → `PARTIALLY_REFUNDED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `SUCCEEDED`
- **evento** (disparador): reembolso parcial
- **hacia** (estado destino): `PARTIALLY_REFUNDED`
- **nota** (guardas y efectos): —

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1770, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-p5"></a>

### `TRANS:B:P5` · `P5` — `PARTIALLY_REFUNDED` → `PARTIALLY_REFUNDED` o `REFUNDED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PARTIALLY_REFUNDED`
- **evento** (disparador): otro parcial
- **hacia** (estado destino): `PARTIALLY_REFUNDED` o `REFUNDED`
- **nota** (guardas y efectos): **los parciales se acumulan y validan contra el saldo, no contra el monto original**; al completarse, el pago pasa a reembolsado solo (`RF-1`, `RF-2`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1771, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-p6"></a>

### `TRANS:B:P6` · `P6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B7](10-corte/B7.md#pieza-b7) (implementa), [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:139`; `B/descomposicion.md:459`; `B/descomposicion.md:562`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `SUCCEEDED` — **o `PARTIALLY_REFUNDED`**, con el mismo tratamiento (FASE 8 completa, pendiente 6, owner 2026-09-25)
- **evento** (disparador): **se lee `charged_back` en el pago, releído por id** (`D17`) — por el aviso de contracargo del proveedor o por la comprobación de pagos acreditados del barrido (`B/09` §3)
- **hacia** (estado destino): `CHARGED_BACK`
- **nota** (guardas y efectos): **un contracargo**: el cliente desconoció el cargo ante su banco (`DEC-SUB-020`; FASE 8 completa, `F-8CB3-009`, owner 2026-09-25). **Si la suscripción del pago está en `ACTIVE` o `GRACE_PERIOD` —o en `PAUSED` con motivo `COURTESY` (pendiente 8, owner 2026-09-25)—, corre `S6` por su tercer evento** (§3.2): suspende sin grace y cancela el preapproval. **Esté en el estado que esté la fila, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) con este pago colgado, para que una persona siga la disputa; **Cerrado el 2026-09-25 (owner)**: **la regla es una: si la fila da servicio, se corta en el acto; si no, sólo la marca** (`DEC-SUB-020`, su 📌; FASE 8 completa, pendiente 6, owner 2026-09-25). **Una `CANCEL_SCHEDULED` pasa a `CANCELLED` ya**, sin esperar su fecha de fin: es `S12` por su segundo evento (§3.2). **Una `PAUSED` con motivo `CUSTOMER_REQUEST`, una `SUSPENDED` o una fila terminal sólo abren la marca.** **Y si la fila es la predecesora de una sucesión en curso, `S6` corre igual y la sucesora también se corta** (§3.2, `S6`) **—por `S31`, y también cuando la predecesora es la `CANCEL_SCHEDULED` que `S12` corta** (pendiente 8, owner 2026-09-25). **Cerrado el 2026-09-25 (owner)**: **una `PAUSED` con motivo `COURTESY` da servicio, así que se corta**: `S6` la toma por su tercer evento, la cortesía se cierra y la fila pasa a `SUSPENDED` (FASE 8 completa, pendiente 8, owner 2026-09-25). **No toca `covered_period`**: la fila queda cortada o marcada, la vuelta es por una sucesora con su propia cobertura, y si la disputa se gana el pago vuelve por `P7` con su período bien escrito. ⚠️ **Documental, no medido** (`RC-8`, `UNKNOWN`): qué campo muestra `charged_back` al releer —el pago embebido del registro de cobro o `/v1/payments/{id}`— no está medido

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1772, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:459, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:562

<a id="trans-b-p7"></a>

### `TRANS:B:P7` · `P7` — `CHARGED_BACK` → `SUCCEEDED` — **o `PARTIALLY_REFUNDED`**

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B7](10-corte/B7.md#pieza-b7) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:139`; `B/descomposicion.md:459`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `CHARGED_BACK`
- **evento** (disparador): **se lee `reimbursed`**, releído por id: la disputa se resolvió a nuestro favor
- **hacia** (estado destino): `SUCCEEDED` — **o `PARTIALLY_REFUNDED`**
- **nota** (guardas y efectos): **la plata volvió y el cobro vuelve a valer**. **A cuál de los dos vuelve lo dice el pago mismo**: `PARTIALLY_REFUNDED` si su monto reembolsado acumulado es mayor que cero, `SUCCEEDED` si no —la columna ya está en `payment` (`B/02` §2.3), así que no hace falta guardar de qué estado salió `P6`— (FASE 8 completa, pendiente 6, owner 2026-09-25). **No reactiva la suscripción**: la fila sigue donde la dejó `P6` —`SUSPENDED`, `CANCELLED` o el estado que tenía— y, si la persona quiere, vuelve por el checkout como cualquier suspendido con tarjeta —la sucesión desde `SUSPENDED` que `G-R1-A` admite (`B/20` §2)— (`DEC-SUB-020`). **La marca `CONTRACARGO` se cierra por `S15`**, levantada por la persona que sigue el caso: no se levanta sola, porque `S15` exige una intervención humana registrada. **No emite un comprobante nuevo**: el del cobro ya existe

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1773, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:459

## Reembolso (`B/03` §6.1)

### Reembolso (`B/03` §6.1) — «6.1 Reembolso: la máquina mínima de `refund` ✚»

Texto de `B/03-maquinas-de-estado.md:1833–1862`, sin lo tachado:

(owner 2026-09-25; FASE 9 completa, decisión 5a, `F-8CB1-015`.) `refund` tenía una columna
*«estado»* sin valores ni transiciones (`B/02` §2.3), y la devolución que ocurre **por fuera del
proveedor** —la de un `manual_payment` por transferencia, la de un cobro más viejo que el plazo del
proveedor que *«cae al camino manual»* (`B/06` §4.6, `DEC-RF-007`), la hecha desde el panel (motivo
18)— no tenía ningún acto que escribiera su fila. **Cuatro estados y cinco filas**:

```text
  (sin fila) ──RF1──► REQUESTED ──RF2──► CONFIRMED ──RF3──► EXECUTED
                          │                  │
                          └──RF5──► FAILED ◄─┘
  (sin fila) ──RF4──────────────────────────────────────► EXECUTED
```

**Sólo un `refund` en `EXECUTED` suma al monto reembolsado acumulado del pago** (`B/02` §2.3), así
que ni un pedido sin confirmar ni uno fallido mueven `P3`/`P4`. **Y el párrafo de arriba sobre el
reembolso hecho desde el panel queda con su acto**: *«el `refund` que falta lo asienta la persona»*
es `RF4`.

## Reembolso (`B/03` §6.1) — las transiciones

<a id="trans-b-rf1"></a>

### `TRANS:B:RF1` · `RF1` — *(sin fila)* → `REQUESTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): **se pide una devolución**: la persona revoca dentro de los 10 días (`DEC-RF-001`) —**lo crea `S36`** (§3.2), en el mismo acto que cancela y corta el servicio, por el total del último pago acreditado (owner 2026-09-26, `G5-4`)— **o `S21`**, sobre el último cobro de un complemento cuya principal sacó de las filas vivas `S36`, si cae dentro de sus propios 10 días corridos (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`)—, **o `S36` también sobre el pago de cada instancia `UNA_VEZ` que su orfandad apaga, si se acreditó dentro de los mismos 10 días** (FASE 9 vuelta 3, owner 2026-09-30, lote L)—, o una persona propone devolver desde una marca cuyo motivo lo pide (`B/02` §2.5, `B/19` §6)
- **hacia** (estado destino): `REQUESTED`
- **efectos** (efectos): nace con el pago que se devuelve —un `payment` o un `manual_payment`—, monto y motivo (`B/02` §2.3). **No mueve el pago ni la suscripción**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1850, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-rf2"></a>

### `TRANS:B:RF2` · `RF2` — `REQUESTED` → `CONFIRMED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B6](10-corte/B6.md#pieza-b6) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:140`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `REQUESTED`
- **evento** (disparador): **una persona con el permiso lo confirma** —la acción *«reembolsar»* de `NUCLEO/08` §3—
- **hacia** (estado destino): `CONFIRMED`
- **efectos** (efectos): se escribe quién lo confirmó (`DEC-RF-002`). Sobre un `payment` de pagador con tarjeta, se manda la devolución al proveedor (`POST /v1/payments/{id}/refunds`, `B/06` §4.6) con la clave de idempotencia persistida antes (`DEC-CONC-001`); **sobre el `payment` de una instancia `UNA_VEZ`, por su orden: `POST /v1/orders/{id}/refund`**, con el id de la orden guardado en la instancia (`B/02` §2.4): el total sin cuerpo y el parcial con su monto, los dos medidos en sandbox el 2026-09-29 (sonda 56, `201`); (FASE 9 vuelta 3, owner 2026-09-30, lote L, `F-8V3B1-006`). **Medido** (`EX-58`, `VERIFIED`, sandbox, 2026-09-30): la clave es obligatoria —sin ella, `400`—; el mismo cuerpo con la misma clave devuelve la misma devolución con su id; otro monto con la misma clave da `409`; y **el `POST` devuelve todas las devoluciones de la orden**, así que **el id de la nueva sale por resta contra las ya registradas** en las filas de `refund` de esa orden. **Por eso las devoluciones de una misma orden se serializan**: salen de a una, porque dos simultáneas vuelven ambigua la resta. **Un `409` es un error de programación** —la clave está mal derivada—, **no *«ya estaba hecha»*** (FASE 5, owner 2026-09-30, lote 5 F). **La serialización la impone una restricción de la base, un índice parcial**: **a lo sumo una devolución de la misma orden esperando su id** —una llamada con su clave persistida y sin el id de la devolución todavía escrito— (`B/02` §2.3, `B/05` §1). La segunda no puede persistir su llamada mientras la primera espere, así que no sale hasta que la primera tenga su id; una llamada que nunca responde deja la orden esperando hasta que el barrido la reenvía, que ya está diseñado (abajo) (FASE 5, lote de la aplicación, owner 2026-09-30, J). **Y la devolución que la base frenó —la segunda, que queda en `CONFIRMED` sin llamada persistida— la manda el barrido en su corrida siguiente, cuando ya no queda ninguna de esa orden esperando su id**, con su clave persistida antes como cualquier llamada de esta fila (`B/09` §3) (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, M). **Y antes de mandar cualquier devolución, se relee el pago por id** (`D17`): **si lo lee `charged_back`, no manda nada**, porque el banco ya le devolvió la plata a la persona, y la fila sale por `RF5` (FASE 9 vuelta 3, `F-8V3B2-002`); **ante un `2084` la fila se queda en `CONFIRMED`** **y se reintenta sin pasar nunca del monto confirmado**: partido en parciales que suman lo confirmado —`RF-2` midió que se acumulan—, cada uno con su propia clave persistida antes (`RF-6` mide la misma clave con el mismo cuerpo, no con otro). **Cae al total sólo si lo confirmado es el total del saldo**, que es el caso de la revocación de `DEC-RF-001`. Si ningún reintento entra, la fila sigue en `CONFIRMED` y la mira una persona (`RF-8`, regla del §6; FASE 9 vuelta 1, `F-8V1B1-005`). **Cada llamada —el total, o cada parcial— guarda en la fila, junto a su clave, el id de la devolución que devuelve el proveedor y su monto** (FASE 9 vuelta 2, `F-8V2B2-002`, `B/02` §2.3): es lo que ata la fila a **sus** devoluciones y no a *«una devolución»* del pago, que puede traer otras. **Una llamada sin respuesta la reenvía el barrido, con la misma clave y el mismo cuerpo, en la corrida que relee el pago y antes de clasificar sus devoluciones** (`B/09` §3), **y nunca con una clave nueva**: si la devolución no se había hecho, el reenvío la hace, que es lo que la persona confirmó; si ya se había hecho, `RF-6` mide que el reenvío contesta `200` con el cuerpo vacío y **sin el id** —la cita decía lo contrario—, **así que el id sale de la relectura del pago**: la fila toma la devolución que ninguna fila nombra y cuyo monto es el de esa llamada (FASE 9 vuelta 3, `F-8V3B1-004`, `F-8V3B2-003`). **Esa nota de `RF-6` es del pago**: sobre una orden, el reenvío devuelve la misma devolución con su id (`EX-58`), y la fila no necesita la relectura para atarla (FASE 5, owner 2026-09-30, lote 5 F)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1851, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:140

<a id="trans-b-rf3"></a>

### `TRANS:B:RF3` · `RF3` — `CONFIRMED` → `EXECUTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B6](10-corte/B6.md#pieza-b6) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:140`
- **Adjudicación** (`adjudicacion.json`): VIVO — las ramas tachadas salieron con el lote 5 F; la fila lo dice; lo tachado de la fila se omite y lo vigente va entero.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `CONFIRMED`
- **evento** (disparador): **la relectura por id del pago muestra acreditadas las devoluciones de ESTA fila —las que nombran sus ids— y suman el monto confirmado** (`D17`; FASE 9 vuelta 2, `F-8V2B2-002`). **Sobre el pago de una instancia `UNA_VEZ`, la relectura es la de su orden por id** (FASE 9 vuelta 3, lote L). **En una orden el id de cada devolución siempre viene**: en la respuesta del `POST`, por resta contra las ya registradas (`RF2`), y en la relectura, que trae id y monto de cada una (`EX-58`, `VERIFIED`, 2026-09-30). **Así que para órdenes salió la rama *«de su mismo monto»***, y con ella la de dos del mismo monto (FASE 5, owner 2026-09-30, lote 5 F). **El disparador es el aviso del reembolso o el barrido**, que relee cada `refund` en `CONFIRMED` cuando el aviso se perdió (`B/09` §3; `WH-5`; FASE 9 vuelta 2, `F-8V2B2-005`)
- **hacia** (estado destino): `EXECUTED`
- **efectos** (efectos): corre **`P3` o `P4`** sobre el pago, según el acumulado (§6); se escribe *«por el proveedor»*. **Lo que suma al acumulado es la suma de esas devoluciones**, que es el monto confirmado, y nunca lo que el pago muestra reembolsado en total. **Con una parte acreditada y otra no, `RF3` no ocurre**: la fila sigue `CONFIRMED` —no hay un estado a medias— y sigue la regla de `RF2` (FASE 9 vuelta 2, `F-8V2B2-002`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1852, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:140

<a id="trans-b-rf4"></a>

### `TRANS:B:RF4` · `RF4` — *(sin fila)* → `EXECUTED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): **una persona asienta una devolución que ya ocurrió por fuera** —la acción administrativa *«asentar un cobro o una devolución que ya ocurrió por fuera»*, la decimocuarta de `NUCLEO/08` §3—, con el comprobante de la transferencia o la referencia del panel
- **hacia** (estado destino): `EXECUTED`
- **efectos** (efectos): nace ya ejecutada, con quién la asentó y por dónde. Sobre un `payment`, corre **`P3` o `P4`**; sobre un `manual_payment`, que no tiene máquina de devolución (§7), **la fila de `refund` es el asiento**, y si la devolución es total **libera el `covered_period`** como `P3`. Es el cierre que piden los motivos 18 y 19 (`B/02` §2.5; el 19 asienta un cobro, no una devolución, y lo hace con la misma acción creando el `payment` y corriendo `P1`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1853, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-rf5"></a>

### `TRANS:B:RF5` · `RF5` — `REQUESTED` o `CONFIRMED` → `FAILED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B6](10-corte/B6.md#pieza-b6)
- **Fuente de la asignación**: `B/descomposicion.md:140`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `REQUESTED` o `CONFIRMED`
- **evento** (disparador): la persona **no la confirma** (`DEC-RF-003`), o el proveedor la rechaza **sin monto que reintentar** —p. ej. un cobro más viejo que su plazo (`DEC-RF-007`)—, **o la relectura previa de `RF2` ve el pago contracargado** (FASE 9 vuelta 3, `F-8V3B2-002`)
- **hacia** (estado destino): `FAILED`
- **efectos** (efectos): no mueve el pago. **Por el contracargo, el pago colgado de la marca que proponía devolverlo queda resuelto sin devolver**, con el contracargo anotado, y la persona lo ve en el listado junto a la marca `CONTRACARGO` (`B/19` §6). **Si la devolución se hace después por transferencia, es una fila nueva por `RF4`**, no la reapertura de ésta. **Y un `FAILED` sobre una revocación es el caso que `NUCLEO/08` §4.1 nombra como *«un reembolso que falló sobre una revocación»***: es su productor

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1854, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:140

## Pago manual (`B/03` §7)

### Pago manual (`B/03` §7) — «7. Pago manual»

Texto de `B/03-maquinas-de-estado.md:1863–1905`, sin lo tachado:

El §30 lo dice en una línea —*«Mismo motor de Subscription. Payment method distinto.»*—, y eso
es exactamente lo que la máquina refleja: **no hay una máquina de suscripción para pagos
manuales**. Lo único propio es cómo se constata el pago.

**Lo que el §30 agrega y la máquina tiene que cumplir**: si falta el pago, va a `GRACE_PERIOD`
**los mismos días configurables** que el resto (`DEC-SUB-002` vale igual acá) — **con una
excepción, y es la primera cuota**: ahí no hay grace, porque el grace no es un beneficio de entrada
(`B/12` §4.3) y la fila todavía no dio servicio; lo que corre ahí es la ventana de autorización
—que **sobre un pagador manual dura 7 días corridos y no 72 h** (`DEC-SUB-016`, §3.4 punto 1),
porque lo que espera es que se acredite una transferencia y no que alguien termine un checkout—
(§7.2, *«cómo entra el grace»*). **Y además se notifica al admin** — que es el único caso donde una
notificación es parte del flujo y no un efecto colateral, porque sin ella nadie va a registrar
nada. **Desde `MP5` eso tiene sujeto y momento**: el reloj crea la cuota y el aviso sale sobre
ella; hasta acá era una obligación sin fila de la que colgar.

**Y el cruce peligroso queda nombrado**: un admin registrando un pago manual mientras la persona
paga por el proveedor es **doble cobro con dinero real** (`E-CONC-01`). Lo resuelve el capítulo
05; acá queda dicho que las transiciones MP1 y MP4 **no** son incondicionales.

**Devolver un pago registrado no es una transición de esta máquina, y `MP4` no lo cambia: la
devolución se asienta en un `refund` sobre el pago manual.** `MP4` revierte **la declaración de
impago**, que es otra cosa —mueve la columna de estado de `DECLARED_UNPAID` a `REGISTERED`—; lo
que sigue sin mover esa columna es devolver la plata. El §6 da `P3` y `P4` sobre la máquina de
`payment`, y de acá salía la lectura de que un pago manual **no se puede devolver** — que es falso
y era caro, porque las ramas 1, 5 y 6 de `B/12` §5.3 mandan devolver el pago que `S19` retuvo **sin
distinguir por qué puerta entró**. Lo que se devuelve es *«el pago»*, y desde `B/02` §2.3 un
`refund` cuelga del pago que se devuelve, sea `payment` o `manual_payment`. El estado del
`manual_payment` **no se mueve**: quedó `REGISTERED` porque el pago existió, y la devolución es un
hecho posterior con su propia fila — exactamente la relación que `payment` y `refund` ya tienen. Y
la devolución no es automática en ninguno de los dos casos: la confirma una persona
(`DEC-RF-002`), sobre la marca que `S18` puso.

## Pago manual (`B/03` §7) — las transiciones

<a id="trans-b-mp1"></a>

### `TRANS:B:MP1` · `MP1` — `AWAITING` → `REGISTERED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`; `B/descomposicion.md:592`; `B/descomposicion.md:299`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `AWAITING`
- **evento** (disparador): el admin registra el pago
- **hacia** (estado destino): `REGISTERED`
- **efectos** (efectos): la suscripción sale de `GRACE_PERIOD` por `S5` — **o, si la cuota es la PRIMERA y la fila está todavía en `PENDING_AUTHORIZATION`, es este registro el que la habilita a llegar a `ACTIVE`**, por **`S29`** (§3.2, escrita el 2026-09-24; antes decía *«la fila que el capítulo 13 todavía debe»*): ahí no hay grace del que salir, porque no lo hubo — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el daño no depende de por qué puerta entró el pago. **`S19` lo admite por su propio evento**, que nombra las dos puertas (§3.2): sin eso la derivación apuntaba a una fila que no podía recibirlo. **Y avanza un ciclo la fecha del próximo cobro** (`B/02` §2.2): registrada la cuota de este período, lo que queda por cobrar es el siguiente. Es **acá** y no en `S5`, cuya celda de efectos es *«se apaga el reloj»* y nada más (§7.2, *«qué mueve la fecha»*). **Y emite el comprobante** —el `receipt` de esta cuota, colgando del `manual_payment` (`B/02` §2.3, `DEC-LEGAL-001`; FASE 8 completa, `F-8CB3-006`)—, **con la copia del nombre y el correo del `user` de la suscripción, leídos en esta misma transacción** (revisión del owner, casos vecinos, 2026-09-29, caso K-A)

**Texto de la fuente — «7.1 `DECLARED_UNPAID` deja de ser el final: el pago que llega tarde reabre»** (`B/03-maquinas-de-estado.md:1906–1930`, sin lo tachado):

**El §30 le da al admin el acto de *«confirmar que no se pagó»* y esta máquina no tenía cómo
deshacerlo.** `MP2` y `MP3` dejaban el pago manual en `DECLARED_UNPAID` y la suscripción en
`SUSPENDED`, y ninguna fila salía de ahí: el cliente que transfería **después** ponía plata en
nuestra cuenta y el sistema no tenía qué hacer con ella — por la regla 1 del núcleo el intento no
se ejecutaba, se iba a la marca, y lo que el cliente veía era que pagar no servía de nada. **No es
un borde de sucesión**: es el camino normal del que se atrasa y después paga, y el §3.2 lo dejaba
nombrado abierto con esas palabras.

> **La decisión del owner del 2026-09-21 es que se puede reabrir: el pago manual lo saca de
> `DECLARED_UNPAID` y reactiva la suscripción.** Lo ejecuta `MP4`.

**Y conviene decir por qué acá se reabre y en los dos casos vecinos de la misma semana no.** Al
revocar un grant el trial **no vuelve** (`DEC-TRIAL-009`) y el addon que el grant había pasado a
$0 **se apaga y no vuelve solo** (`DEC-ADDON-003`, `B/16` §3.3): en los dos **nosotros** terminamos
algo deliberadamente y la persona **no puso plata nueva**, así que reparar sería devolverle gratis
lo que se le retiró. Acá la persona **puso plata**, y hacerle repetir el trámite es fricción sobre
alguien que está tratando de volver. **El precedente que se citaba acá —`DEC-SUB-003`, el cambio de plan en grace como salida
del problema— se cayó**: lo superó `DEC-SUB-021` (owner 2026-09-25), que en el grace no deja cambiar
de plan y pide regularizar primero. **La razón de este § no dependía de él**: la persona puso plata,
y eso alcanza.

**Texto de la fuente — «El tope no es un día: es que la fila siga viva, y la condición ya está escrita»** (`B/03-maquinas-de-estado.md:1931–1989`, sin lo tachado):

**El tope evidente —*«mientras la ficha no se haya borrado»*, o sea el día 180 de la retención
(`V/02` §4.1)— no cierra, y hay que decir por qué antes de que alguien lo vuelva a proponer.** Son
tres razones y ninguna es de matiz:

1. **Ese reloj es de la ficha y el sujeto acá es la suscripción, y no hay una correspondencia.**
   Una suscripción principal cubre **todas las fichas de esa vertical** (`NUCLEO/01` §5), así que
   un anfitrión con cartera tiene tantos relojes como fichas y ninguno es *«el»* de su
   suscripción; y el pagador manual es el que menos lo tiene — el §17.2 lo admite en **Partner**,
   cuya presencia *«no es una ficha»* por orden del §17.1. Sobre esa población el tope propuesto
   **no existe**, que es peor que ser largo.
2. **Ya no es monótono, y un tope que se reinicia solo no es un tope.** `DEC-DATA-002` le puso a
   la inactividad **cuatro hechos de reinicio** con lista cerrada (`NUCLEO/01` §1.2) —**hoy cinco**
   (el sexto, levantar una moderación —`PB11`—, owner 2026-09-25; FASE 9 completa, 5b; y el cuarto
   salió con la revisión del owner, 2026-09-28, C8: quedan el 1, el 2, el 3, el 5 y el 6, FASE 9
   vuelta 3, `F-8V3D1-006`):
   el quinto, *«el dueño pierde la cobertura en la vertical»*, escrito en todas sus fichas en ella (FASE 8 completa, owner 2026-09-25), FASE 8 completa,
   `F-8CA2-001`, owner 2026-09-25—, y el primero
   es *«un acto del dueño sobre la ficha»*: el suspendido que entra a editar su borrador corre su
   propio vencimiento hacia adelante, indefinidamente. Lo que se retiró en esa decisión fue,
   textual, *«que el reloj fuera monótono»*.
3. **Crearía una segunda dependencia sobre una cifra que el guard no vigila con ese sentido.**
   *(`D16` y `G-R5` salieron (revisión del owner, 2026-09-28, C14); el argumento queda como historia y la
   conclusión, no atar la reapertura a esa cifra, sigue.)*
   `D16` dice *«el tope de una pausa, en días, es menor que el día del hard delete»* y `G-R5`
   compara **esas dos** cifras y nada más (`B/20` §2). Atarle la reapertura al mismo número le
   agrega un consumidor que el guard no mira: bajar el día del hard delete acortaría la ventana de
   reapertura sin que nada se ponga en rojo, que es exactamente el modo de falla que `DEC-DATA-002`
   escribió `D16` para cerrar.

**Y no hace falta inventar otro número, porque el tope ya está escrito y es una condición y no un
reloj:**

> **Se puede reabrir mientras la suscripción siga siendo la fila que el pago puede reactivar.** Es
> la **condición 1 del `B/05` §3** —*«la suscripción existe y está en `GRACE_PERIOD` o
> `SUSPENDED`»*—, que `S7` ya exige y que rechaza `CANCELLED`, `ABANDONED` y `ACTIVE`.

Eso cierra la ventana **con actos que ya existen**, no con un plazo: cuando una persona cancela la
suscripción (**`S23`**, §3.2 — §3.1 enumera esa salida, y es una de las veinticinco (`G5-2`; la vigesimoquinta con la verificación corta, 2026-09-29, lote N-G; la vigesimosexta con la FASE 9 vuelta 3, owner 2026-09-30, lote P; la decimosexta salió con la revisión del owner, 2026-09-28, C8, la decimoséptima entró con C15, las cinco del catálogo con N1 y C9, y la vigesimotercera y la vigesimocuarta con los casos vecinos, 2026-09-29, F-C) acciones del
`NUCLEO/08` §3) o cuando le cae un grant (`S13`), la fila pasa a `CANCELLED`, de donde el §3.3 ya
declara que **no se vuelve**. A partir de ahí el pago que llegue no reabre nada y lo que corresponde es un alta nueva.
**Y las otras tres condiciones acotan el resto**: la **3** rechaza la reapertura si la persona ya
volvió por otra puerta —tendría dos filas vivas y dos cobros—, y la **4**, con la restricción
`UNIQUE(subscription_id, período)` de `B/05` §C5 detrás, rechaza que el mismo período quede
pagado dos veces. Ninguna de las cuatro es nueva: `MP4` no las agrega, las alcanza.

**Lo que este tope NO acota, dicho en voz alta**: una `SUSPENDED` de pagador manual que nadie
cancela se puede reabrir indefinidamente, porque **no hay preapproval que el proveedor dé de baja
por mora** (`B/06` §7: un pago manual *«no tiene nada que pausar porque no hay débito que
detener»*) y el espejo del §10.1 nunca la alcanza. **Y *«que nadie cancela»* nombra un subconjunto
recién desde `S23`**: hasta esa fila las otras dos salidas estaban descartadas por lo que dice
este mismo párrafo y la tercera no tenía transición, así que **la población entera era la que
nadie podía cancelar** y el tope se cerraba por un solo camino —el grant— en vez de por dos. Se
acepta: el acto lo ejecuta un admin con la
plata a la vista, las condiciones 3 y 4 impiden los dos daños de plata, y **nada es retroactivo**
—lo que la reapertura devuelve es servicio de acá en adelante, no el contenido que el día 180 ya
borró—, que es justamente lo que el aviso del `B/19` §4 fila 10-bis está obligado a decir.

**Texto de la fuente — «A qué estado va: `ACTIVE` directo, y por qué no deja una fila que no puede cobrar»** (`B/03-maquinas-de-estado.md:1990–2011`, sin lo tachado):

**La objeción correcta es que reactivar el estado local sobre una autorización cancelada deja una
fila que el mes que viene no cobra** —`PA-5` mide que cancelar en el proveedor es irreversible, y
`B/12` §1.4 manda espejar la baja que el proveedor decide—. **Sobre esta población esa fila no
puede existir, y no por una regla nueva:**

- **En el caso central no hay autorización que contradecir.** El pagador manual no tiene débito en
  el proveedor (`B/06` §7), así que `PA-5` no tiene sujeto: no hay preapproval cancelado que
  reactivar.
- **Y si lo hubiera, la fila ya no estaría en `SUSPENDED`.** `SUSPENDED` **no es terminal**, así
  que el barrido diario la recorre entera (`B/09` §3); leído el preapproval `cancelled` contra un
  estado vivo que no es `CANCEL_SCHEDULED`, el §10.1 manda **espejar la baja** y la fila termina en
  `CANCELLED`. Ahí la condición 1 del `B/05` §3 rechaza la reapertura por su cuenta.

**Entonces `S7` sin escala**, con su efecto ya escrito — *«la fila vuelve a emitir fuente»*, y la publicación la restituyen `PB3`/`PB7` si el cupo alcanza (`F-8CA2-016`)—: la fila
vuelve a emitir fuente con `hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6), `cubierto` vuelve a
verdadero y la ficha que `PB4` hubiera archivado **vuelve sola por `PB7` si el cupo del plan le
alcanza** (`V/03` §9). No hace
falta un estado intermedio: el que lo necesitaría es el que tiene una autorización que confirmar,
y acá o no hay ninguna o la fila ya se murió.

**Texto de la fuente — «Lo adeudado: no hay deuda vieja que perseguir, porque el pago que reabre ES la cuota»** (`B/03-maquinas-de-estado.md:2012–2046`, sin lo tachado):

**`B/12` §5.3 decidió que *«la deuda vieja no se persigue por separado»*, y acá esa regla no se
aplica — no porque se la contradiga, sino porque su población no existe.** Allá el cliente cambia
de plan y **deja atrás** la cuota impaga, así que hay algo que decidir no perseguir. Acá el cliente
**la paga**: `MP4` actúa sobre **la misma fila de `manual_payment`** que `MP2` o `MP3` cerraron
—nunca crea una— y registrarla liquida lo que se debía.

**Qué período liquida depende de si el de esa cuota todavía corre, y son dos ramas.** Si **todavía
corre** —la reapertura cae adentro del período que se está pagando—, es ése: no queda remanente que
compensar ni que cobrar aparte. Si **ya terminó** —la suspensión duró más que un período—, la cuota
se **reimputa** al período que arranca en la reactivación y lo que el pago liquida es **ése**
(§7.2, *«al reabrir por `MP4`»*). **En ninguna de las dos ramas queda remanente**: los períodos que
transcurrieron enteros bajo la suspensión no se cobran ni quedan como deuda, que es la mitad (b) de
la decisión del owner del §7.2.

**Y tampoco se cobra nada por encima.** Ningún capítulo del programa tiene recargo, interés ni
punitorio, y crear uno acá sería una decisión de producto que esta fila no toma. Lo que la
reapertura mueve es un estado, no un monto: el importe que se registra es el esperado para ese
período, que es la **condición 2** del `B/05` §3.

**Lo que sí se hereda entero de `B/12` §5.3 es su otra mitad**: si la fila es la predecesora de una
sucesión en curso, el pago **no reactiva** — queda pendiente por `S19` y su destino lo decide el
cierre de la sucesión, con las seis ramas de ese §. Es la misma condición que `MP1` hereda, por la
misma razón, y es la que impide que la reapertura le devuelva dos filas vivas a alguien que está
cambiando de plan.

> **Lo que esta fila dejó abierto ya está cerrado, y no acá**: **quién crea las cuotas de un
> pagador manual y cuándo** —o sea qué pasa con los períodos que transcurren mientras la
> suscripción está `SUSPENDED`— era una pregunta **anterior** a `MP4`, porque la máquina tampoco
> declaraba la entrada a `AWAITING`. La contesta el **§7.2** con `MP5`: **las crea el sistema —un
> reloj de la segunda en adelante, el alta la primera— y no las crea durante la suspensión**. `MP4`
> sigue sin crear filas de `manual_payment`: sólo mueve la que `MP2` o `MP3` cerraron, y **desde
> esta pasada también la reimputa** cuando el período que cubría ya terminó (§7.2).

**Texto de la fuente — «Es una fila nueva y no el `desde` de `MP1` ampliado»** (`B/03-maquinas-de-estado.md:2047–2067`, sin lo tachado):

**Ampliar `MP1` a `{AWAITING, DECLARED_UNPAID}` habría sido una fila con dos efectos según de
dónde viene**, y este capítulo ya tiene escrito por qué eso no se hace: *«una transición cuyo
`desde` se escribe como un conjunto de filas tiene que decir si alcanza también a…»* (§3). Los dos
efectos difieren de verdad y no en el matiz: `MP1` saca de `GRACE_PERIOD` por **`S5`** y `MP4` saca
de `SUSPENDED` por **`S7`**, que son dos transiciones distintas de la tabla del §3.2 con dos
condiciones que se evalúan sobre estados distintos. Con una sola fila, la derivación habría
quedado escrita como *«`S5`, o `S7` si venía de `DECLARED_UNPAID`»*, que es la forma que la regla 1
del núcleo no puede verificar.

**Y `MP4` no agrega ningún par con dos filas, así que el conteo de `G-R4` no se mueve — y son cuatro, con `PB11`/`PB13` (revisión del owner, 2026-09-28, C10)** (`NUCLEO/03` §1 regla 7; esta frase decía *«sigue contando tres»* y
caducó con `DEC-SUB-015`, que creó el cuarto par sin tocar este §; vuelve a ser verdadera desde la
revisión del owner, 2026-09-28, C8, que sacó `S25`). Comparte el
evento con `MP1` —*«el admin registra el pago»*— y **compartir el evento no es compartir el par**
(`NUCLEO/03` §1 regla 7): el `desde` de una es `AWAITING` y el de la otra `DECLARED_UNPAID`, y
ninguna otra fila de esta tabla sale de ninguno de los dos con ese evento. Del lado de la tabla del
§3.2 **tampoco agrega uno**, por el argumento que el §3.2 ya escribió para `MP1`: `MP4` no es un
evento de esa tabla sino un efecto que entra por *«entra el pago»*, que `S7` y `S19` ya compartían.

**Texto de la fuente — «Lo que NO cambia, y hay que contarlo para que nadie lo recuente»** (`B/03-maquinas-de-estado.md:2068–2094`, sin lo tachado):

- **El barrido de `B/09` §3 no gana ninguna puerta por `MP4`, y sigue con cuatro salvedades.** Sus
  puertas son **quince**, recontadas sobre la tabla de `B/09` §3 (revisión del owner, 2026-09-28, C8: salen `S25`, `S27` y `S28`) —las agregaron `S22`, `S23`, `S24`, **`S31`** (FASE 8 completa, owner 2026-09-25), **`S36`** (FASE 9 vuelta 1) **y la lápida de recepción** (owner 2026-09-26, `X-1`), no `MP4`—, y todas son
  puertas a
  un estado terminal **de una suscripción**, y ese § enumera los tres que tiene: `CANCELLED`,
  `ABANDONED` y `CHARGE_DECLINED`. **`DECLARED_UNPAID` es un estado del `manual_payment`**, nunca
  estuvo en esa tabla y retirarle la condición de final no le agrega ni le saca una fila. Lo que sí
  conviene saber es que la fila que `MP4` reabre **estaba siendo barrida** todo el tiempo, porque
  `SUSPENDED` no es terminal — y es esa lectura diaria la que hace segura la reactivación directa
  (arriba).
- **El catálogo de acciones administrativas no suma filas por `MP4`** —tiene
  **veinticinco** desde la FASE 9 vuelta 3, owner 2026-09-30, lote P (la vigesimosexta, asignar o quitar el rol `SUPER_ADMIN`; el nombre, lote AC), veinticuatro desde la verificación corta, 2026-09-29, lote N-G (la vigesimoquinta, vaciar la presencia de un Partner), y veintitrés desde los casos vecinos, 2026-09-29, F-C (de la decimoctava a la vigesimosegunda, las cinco del catálogo, N1 y C9; la vigesimotercera y la vigesimocuarta, borrar una ficha ajena y **dar de baja una cuenta** (caso I-C) a pedido de su dueño, F-C): la decimotercera es moderar una ficha (`F-8CA2-004`, owner
  2026-09-25), la decimocuarta, *«asentar un cobro o una devolución que ya ocurrió por fuera»*: owner 2026-09-25, FASE 9 completa, 5a, **y la decimoquinta, *«editar el contenido de una ficha ajena»*: owner 2026-09-26, `G5-2`**, **y la decimoséptima, *«migrar a los clientes de un plan retirado»*: revisión del owner, 2026-09-28, C15**—. `MP4` es *«registrar un
  pago manual»* (§30), la fila que ya está, ejecutada desde otro estado de origen: mismo permiso,
  misma auditoría, misma confirmación de que mueve dinero. Las cinco líneas que cuantifican sobre
  esa tabla —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y `B/19` §6— dicen veinticinco *(con la vigesimoquinta: verificación corta, 2026-09-29, lote N-G; con la vigesimosexta, asignar o quitar el rol `SUPER_ADMIN`: FASE 9 vuelta 3, owner 2026-09-30, lote P; el nombre, lote AC)*, y por `F-8CA2-004`, la decisión 5a y `G5-2` (y la revisión del owner, 2026-09-28, C8, que sacó la decimosexta, C15, que agregó la decimoséptima, y N1 con C9, que agregaron las cinco del catálogo; y los casos vecinos, 2026-09-29, F-C, que agregaron la vigesimotercera y la vigesimocuarta), no por `MP4`.
- **La máquina sigue teniendo tres estados.** `AWAITING`, `REGISTERED` y `DECLARED_UNPAID`
  (`NUCLEO/01` §2.2): `MP4` agrega una arista, no un nodo, y por eso `B/02` §2.3 sigue sin
  necesitar *«un estado nuevo en la máquina del pago manual»*.
- **No agrega una columna.** `manual_payment` guarda ya *«quién lo registró, cuándo,
  comprobante»* (`B/02` §2.3), que es lo que `MP4` escribe — **y el `período`, que también ya
  existe, cuando la reimputación del §7.2 corre**; los dos actos —declarar el impago y reabrirlo—
  quedan distinguibles en el registro de eventos de dominio, que la regla 4 del `NUCLEO/03` §1
  exige por cada transición, y ahí va también el período que la cuota tenía antes de reimputarse.

**Texto de la fuente — «Qué premisa de otro arreglo vuelve falsa este, y dónde quedó resuelta»** (`B/03-maquinas-de-estado.md:2095–2110`, sin lo tachado):

La obligación 2 de `DEC-METH-008`, contestada por escrito. **Es una y está corregida en su
lugar**, más cuatro apariciones que quedan como estaban con su razón:

| premisa | de quién era | qué pasa | dónde |
|---|---|---|---|
| *«por esta puerta `S7` es inalcanzable, y no es un hueco sino aritmética de los dos estados»* | el arreglo que le abrió a `S19` la segunda puerta (§3.2, familia del pago manual de la 9-bis-3) | **queda FALSA**: con `MP4` hay una transición que sale de `DECLARED_UNPAID`, así que el pago manual llega sobre una `SUSPENDED` y `S7` es su destino | corregida en §3.2, con la premisa vieja citada |
| *«`S19` admite las dos puertas»* | el mismo arreglo | **sigue verdadera**, y por eso `MP4` no necesita ampliarla: el evento se enuncia sobre el hecho y no sobre el mecanismo, que es lo que esa corrección dejó escrito | §3.2, con `MP4` nombrado en la celda de `S19` |
| *«la regla se ejecuta en tres lugares»* (`G-R1-D`) | el mismo arreglo, en `B/20` §2 | **queda incompleta**: son cuatro | corregida en `B/20` §2 |
| *«los estados terminales de una suscripción no se barren»* y sus puertas —**nueve** cuando se escribió esta fila, **quince** hoy, con `S31` (FASE 8 completa, owner 2026-09-25), `S36` (FASE 9 vuelta 1) y la lápida de recepción (owner 2026-09-26, `X-1`), y sin `S25`, `S27` ni `S28` (revisión del owner, 2026-09-28, C8)— | `B/09` §3, y `B/16` §4.4 que las contó | **sigue verdadera**: `DECLARED_UNPAID` es del `manual_payment` y nunca estuvo en esa tabla, cuyos sujetos son `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED` | sin tocar |
| *«la tabla tiene DOCE filas»* (`NUCLEO/08` §3) y las cinco líneas que la cuantifican | el arreglo del anclaje de verticales | **sigue verdadera para `MP4`** (desde la FASE 8 completa son por moderar una ficha, `F-8CA2-004`, owner 2026-09-25, **catorce** desde la FASE 9 completa por asentar lo ocurrido por fuera, decisión 5a, **y quince desde la FASE 9 vuelta 1 por editar el contenido de una ficha ajena, `G5-2`**, (dieciséis en la FASE 9 vuelta 2, quince con la revisión del owner, 2026-09-28, C8, y dieciséis otra vez con C15, que agrega la decimoséptima, y veintiuna con N1 y C9, que agregan las cinco del catálogo, y veintitrés con los casos vecinos, 2026-09-29, F-C, que agregan borrar una ficha ajena y **dar de baja una cuenta** (caso I-C) a pedido de su dueño): otras acciones): `MP4` es la fila *«registrar un pago manual»* ejecutada desde otro origen, no una acción nueva | sin tocar |
| *«el crédito de `DEC-SUB-006` se computa en cero en grace»* y las ramas de `B/12` §5.3 | el arreglo del pago tardío | **siguen verdaderas**: `MP4` hereda la condición de `S19`, así que no reactiva durante una sucesión y el pago se resuelve por las mismas ramas — que desde `S23` son **seis** y no cinco, y no las recontó este arreglo | `B/12` §5.3, con `MP4` nombrado en la puerta manual |

**Texto de la fuente — «7.2 La cuota la crea el sistema —un reloj, salvo la primera— y no se crea durante la suspensión»** (`B/03-maquinas-de-estado.md:2111–2141`, sin lo tachado):

**La máquina tenía cuatro salidas y ninguna entrada.** `MP1`, `MP2` y `MP3` salen de `AWAITING`,
`MP4` de `DECLARED_UNPAID`, y **nadie declaraba quién crea la fila `AWAITING` ni cuándo**: es
`F-8B2-018`, anterior a `MP4`. Por la regla 1 del `NUCLEO/03` una máquina sin transición de
entrada no se alcanza nunca, así que las cuatro salidas describían un trámite que no empezaba en
ningún lado — y con ellas se caían el grace del §30 y su aviso al admin, que cuelgan de una cuota
que nadie creaba.

> **Decisión del owner, 2026-09-21, y son dos mitades.**
> **(a)** La cuota **la crea el sistema**, al inicio de cada período, para toda suscripción de
> pagador manual — **el mismo instante en que el proveedor habría cobrado**. No la crea un admin
> a mano: una cuota que nadie crea es **servicio gratis en silencio**, y el §30 le pide al admin
> *«registrar»* un pago, no inventarle la obligación. **De la segunda en adelante la abre un
> reloj; la primera la abre el alta**, porque tiene que estar registrada antes de que la fila dé
> servicio (abajo, *«cómo entra el grace»*) — son las dos cláusulas de `MP5` y el mismo acto.
> **(b)** **No se crean mientras la suscripción está `SUSPENDED`.** El que vuelve paga el período
> que arranca, no los que pasó suspendido.
>
> Lo ejecuta **`MP5`** (§7).

**La razón de (b) ya estaba decidida dos veces, y esto no agrega criterio.** `B/12` §5.3 dice que
*«la deuda vieja no se persigue por separado»* y `DEC-SUB-012` dice que el que paga tarde **paga
esa cuota** y no un remanente (§7.1, *«lo adeudado»*). Acumular cuotas durante la suspensión
construiría exactamente el remanente que las dos descartaron, y sobre alguien que **no tuvo
servicio**: `S6` deja la fila *«sin listado público, sin edición, sin creación, sin entitlements
comerciales»* (§3.2). Cobrar meses de eso es cobrar nada. (La tercera razón que se citaba acá era `DEC-SUB-003`, superada por
`DEC-SUB-021`, owner 2026-09-25; las dos de arriba alcanzan solas.)

**Texto de la fuente — «Desde qué estados de la suscripción se crea: el reloj sólo en `ACTIVE`, y los otros cinco uno por uno»** (`B/03-maquinas-de-estado.md:2142–2178`, sin lo tachado):

Los estados vivos son **seis** (`B/02` §2.2). **El reloj —la cláusula *(a)* de `MP5`— corre sobre
uno**, y los otros cinco no quedan afuera por decisión sino porque en cada uno falta el sujeto o el
período no arranca. **La cláusula *(b)*, que abre la primera cuota, corre sobre otro**, y es la
única excepción de la tabla:

| estado | ¿se crea la cuota? | por qué |
|---|---|---|
| `ACTIVE` | **sí** | es el caso: el período arranca y hay una obligación de pago que constatar |
| `SUSPENDED` | **no** | es la mitad (b) de la decisión del owner |
| `PENDING_AUTHORIZATION` | **el reloj no**, `S1` **sí** | **el reloj no tiene qué leer**: todavía no hay fecha del próximo cobro —la estrena `S2` al arrancar el período (§3.2)—, así que la cláusula *(a)* de `MP5` no corre acá. La que corre es la **cláusula *(b)***, en el acto del alta: la **primera** cuota se abre en este estado, y no en `ACTIVE`, porque tiene que estar **registrada antes** de que la fila dé servicio — si se abriera desde `ACTIVE`, `S4` la mandaría a `GRACE_PERIOD` con servicio entero sin que nadie haya pagado, que es lo que `B/12` §4.3 prohíbe. **Su período es el instante del alta**, porque acá no hay fecha que copiar, y la fecha la estrena `MP1` al registrarla (abajo, *«cómo entra el grace»*) |
| `GRACE_PERIOD` | **no** | un pagador manual llega a grace **porque su cuota de este período no se pagó**, así que esa cuota **ya existe** —es la que `MP1` registra— y el grace es su reloj: su desenlace son `S5` o `S6`, no una segunda cuota. **Lo que NO se puede decir es que el período no avance**: si el grace configurado es más largo que un ciclo, la fecha del próximo cobro llega estando la fila acá, y lo que impide abrir la cuota es que el `desde` de `MP5` es `ACTIVE`, no que no haya qué abrir. Esa cuota se abre **cuando y si** `S5` la devuelve a `ACTIVE`, y ahí el cliente paga dos períodos con días de diferencia — que es lo que corresponde, porque en grace *«el servicio sigue entero»* (`S4`, §3.2) |
| `CANCEL_SCHEDULED` | **no** | el servicio está sostenido *«hasta el fin del período pagado»* (§3.1) y `S12` llega ese día, que en un pagador manual **es** la fecha del próximo cobro que `MP1` dejó al registrar la última cuota: la fila llega a `CANCELLED` el mismo día en que el reloj habría mirado, y además el `desde` de `MP5` es `ACTIVE`. **Ningún período nuevo empieza** antes de `CANCELLED`, y crear una cuota acá sería cobrarle un período a quien ya se dio de baja |
| `PAUSED` | **no** | ver abajo, *«la pausa»* |

**El horario del reloj y su idempotencia, que es lo que el `NUCLEO/03` le pide a cada
subdominio.** La cadencia **sale de la base como todos los schedules** (§42) y no se fija acá; lo
que sí se fija es que **correr tarde no pierde un período**, porque la condición no es *«es hoy»*
sino *«la fecha del próximo cobro ya llegó y ese período no tiene cuota»* — una corrida que se
saltea un día crea la cuota al día siguiente, con su período correcto, y el atraso lo absorbe la
ventana del grace, que es configurable por plan (`DEC-SUB-002`). Y **correr dos veces no crea dos
cuotas**, por la misma condición.

**Esa condición lee una columna, así que hay que decir quién la mueve — y es el punto siguiente.**
Enunciada sobre *«el período actual»*, la condición pedía que alguien avanzara un período y
**ninguna transición lo declaraba**: pagada la primera cuota el reloj no volvía a encontrar nada,
no se abría ninguna otra, nadie le pedía nada al cliente y —porque `ACTIVE` emite fuente con
`hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6)— **seguía cubierto para siempre**. O sea el
*«servicio gratis en silencio»* que la mitad (a) de la decisión declaró inadmisible, entrando por
la puerta del mecanismo que iba a cerrarlo.

**Y el reloj es un acto de sistema, así que no toca el catálogo de `NUCLEO/08` §3.** Ahí van las
acciones **del admin**, y crear la cuota no es ninguna: la tabla **no suma filas por el reloj** —tiene veinticinco *(con la vigesimoquinta: verificación corta, 2026-09-29, lote N-G; con la vigesimosexta, asignar o quitar el rol `SUPER_ADMIN`: FASE 9 vuelta 3, owner 2026-09-30, lote P; el nombre, lote AC)* (la vigesimotercera y la vigesimocuarta, borrar una ficha ajena y **dar de baja una cuenta** (caso I-C) a pedido de su dueño: casos vecinos, 2026-09-29, F-C; revisión del owner, 2026-09-28, N1 y C9: de la decimoctava a la vigesimosegunda, las cinco del catálogo; la decimosexta salió con la revisión del owner, 2026-09-28, C8, y su número no se reusa; la decimoséptima, *«migrar a los clientes de un plan retirado»*: la misma revisión, C15; la decimoquinta, editar el contenido de una ficha ajena: owner 2026-09-26, `G5-2`; la decimotercera es moderar una ficha: FASE 8 completa, `F-8CA2-004`, owner 2026-09-25; la decimocuarta, *«asentar un cobro o una devolución que ya ocurrió por fuera»*: owner 2026-09-25, FASE 9 completa, 5a)— y
las cinco líneas que cuantifican sobre ella —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y `B/19` §6—
siguen siendo exactas. Es el mismo argumento con el que el barrido y `S18` no suman filas ahí.

**Texto de la fuente — «Cómo entra el grace, que era la otra mitad de `F-8B2-018`»** (`B/03-maquinas-de-estado.md:2179–2256`, sin lo tachado):

La primera cláusula de `MP3` sale de *«se agota el grace»* y el grace tenía el mismo problema que
`AWAITING`: **`S4`
describe *«un cobro falla»* y en el pago manual nadie cobra**. Con `MP5` el hecho queda nombrado
y **no hace falta una fila nueva**: para una suscripción sin débito, *«el cobro de este período
falló»* **es** que su cuota se abrió y no hay pago acreditado contra ella. Es lo que este § ya
ordenaba abajo de la tabla —*«si falta el pago, va a `GRACE_PERIOD` los mismos días
configurables»*— y lo que `MP1` y `MP2` ya presuponían: los dos declaran que la suscripción está
en `GRACE_PERIOD` cuando el admin actúa. Así que `S4` es la fila, con su `desde` en `ACTIVE`, que
es el único estado desde el que **el reloj** —la cláusula *(a)* de `MP5`— crea.

**Pero eso vale de la SEGUNDA cuota en adelante, y hay que decir por qué la primera es otra cosa.**
`B/12` §4.3 ordena que **el grace no sea un beneficio de entrada**, y esa regla **sí alcanza a un
pagador manual**: su sujeto es el grace, no la autorización. Lo que se lee *«por autorización»* es
el **predicado de `S16`**, que es el **remedio** —mandar a `CHARGE_DECLINED` al que autorizó y no
cobró—, y ese remedio acá no tiene sujeto: `S16` exige que sea el primer cobro de esa autorización
—desde la FASE 8 completa ya no exige que el
proveedor la haya cancelado: la cancela él (owner 2026-09-25)—, y un pagador manual **no tiene
autorización en el proveedor** (`B/06` §7), así que esa condición es
falsa y `CHARGE_DECLINED` tiene acá
población vacía. **Que el remedio no tenga sujeto no vuelve inaplicable la regla: la deja sin
ejecutor**, y sin uno el §4.3 se viola en su forma más literal — quien contrata con pago manual
recibiría los días de `DEC-SUB-002` **con servicio entero sin haber transferido un peso**, y desde
que `S23` libera el candado `A` (§3.2) podría repetirlo **por intento**, que es la palabra con que
el §4.3 describe el daño que rechazó.

> **La regla, con su ejecutor sobre esta población.** **La primera cuota de un pagador manual no
> abre grace.** La abre la cláusula *(b)* de `MP5` **en el alta —`S1`, §3.2—**, o sea con la fila
> en `PENDING_AUTHORIZATION` y no en `ACTIVE`,
> así que `S4` —cuyo `desde` es `ACTIVE`— no corre sobre ella; mientras esa cuota no esté
> registrada la fila **no emite fuente** (`12-contrato…` §2.6) y no hay servicio que cosechar. Su
> ventana es la de la autorización, y su final ya está escrito: **`S3` la lleva a `ABANDONED`**,
> que **no es vivo**, con lo que el candado `A` queda libre y el reintento es un alta nueva —
> exactamente el desenlace que `CHARGE_DECLINED` le da al pagador con tarjeta.

**Qué período cubre esa primera cuota, que hay que decirlo porque al abrirse no hay fecha que
copiar.** El resto de las cuotas copian *«la fecha del próximo cobro»* vigente (`B/02` §2.3), y en
`PENDING_AUTHORIZATION` esa columna todavía no existe. **El período de la primera es el instante
del alta** —el de `S1`—, que es un valor que existe cuando la cuota se abre y deja el `período`
escrito de entrada, como esa entidad exige. **Y la fecha del próximo cobro la estrena `MP1` al
registrarla**, un ciclo más adelante, por la escritura 2 de arriba: sobre un pagador manual la
escritura 1 —*«la estrena `S2`»*— tiene **población vacía**, porque el evento de `S2` es un webhook
de autorizada y acá no hay preapproval que autorice. **Los días que van del alta al registro corren
adentro de ese período y no se reponen**, que es la misma regla de *«nada es retroactivo»* del §7.1
y lo que impide que abrir el alta y transferir al filo de la ventana corra el ciclo gratis.

**Y con eso la garantía de no-repetición del §4.5 punto 1 gana sujeto acá.** Esa garantía dice que
*«no hay diez días que cosechar por más veces que se repita»* porque **cada reintento muere sin
pasar por `GRACE_PERIOD`**; el pagador con tarjeta muere en `CHARGE_DECLINED` y el pagador manual
que nunca transfiere muere en `ABANDONED`, y en los dos casos lo que no hubo es grace. La cuota
queda cerrada por la segunda cláusula de `MP3`, para que no sobreviva un `AWAITING` colgando de una
suscripción muerta.

**Lo que falta y lo que no.** Abrir la primera cuota **no** falta: lo hace `S1`, que ya está
escrita, y por eso esta regla tiene ejecutor hoy y no el día que alguien escriba el capítulo 13.
Lo que falta es **la transición que lleva un pagador manual a `ACTIVE`** —el evento de `S2` es
*«webhook de autorizada»* y acá no hay preapproval que autorice, que es el hueco que el capítulo 13
tiene abierto—, y esta regla **la ata por adelantado**: **esa fila no puede llevar a `ACTIVE` sin
la primera cuota registrada**. Va escrito acá porque es acá donde alguien la escribiría sin verla.

> ✅ **Cerrado el 2026-09-24: la fila existe y es `S29`** (§3.2). La condición que este párrafo ató
> por adelantado **se cumple por construcción**, porque el evento de `S29` **es** el registro de la
> primera cuota. Y la jurisdicción quedó donde este párrafo la reclamaba: **la fila vive en esta
> tabla, no en el capítulo 13**, que desarrolla el flujo del pagador manual y la referencia. Lo
> único que hubo que agregarle y este párrafo no anticipaba: **`S29` NO mueve la fecha del próximo
> cobro**, porque ya la mueve `MP1` y repetirlo daría **dos ciclos** de crédito.
**El que cuenta es el pago acreditado y nunca la fecha**, que es el punto 2 del mismo §4.5.

**Y la duración de esa ventana ya está elegida, y no es la de `S3` para el pagador con tarjeta.**
Era la única declarada —**72 h**, escrita para el tiempo que tarda alguien en completar un
checkout, no para el que tarda una transferencia en acreditarse—, y `DEC-SUB-016` la partió: sobre
un pagador manual la ventana de `S3` dura **7 días corridos** (§3.4 punto 1). **La regla de este §
no cambia ni depende de la cifra**: lo que la sostiene es que la fila **no dé servicio** durante la
ventana, y eso vale igual con 72 h que con 7 días. Lo que la cifra cambia es a quién se pierde: con
las 72 h, el pagador manual que transfiere un viernes muere en `ABANDONED` y tiene que rehacer el
alta entera.

**Texto de la fuente — «Qué mueve la fecha del próximo cobro: tres escrituras, y ninguna cuarta»** (`B/03-maquinas-de-estado.md:2257–2322`, sin lo tachado):

La columna es la de `B/02` §2.2, y sobre un pagador manual **es la única copia que existe** —no
hay proveedor que la tenga—. **Son tres escrituras y no hay una cuarta. Lo que la reapertura larga
necesita no es otra escritura de esta columna: es una reimputación de la cuota, que se escribe
sobre el `período` del `manual_payment` y no sobre esta fecha** (abajo, *«al reabrir por `MP4`»*).

> **Y que sean TRES y no cero es lo que `G-R6` vigila desde la FASE 9-bis-4** (`B/20` §2,
> `DEC-TEST-001`). El defecto que este § arregló —`MP5` disparando sobre una columna que **ninguna
> transición avanzaba**, o sea el pagador manual que paga *una vez en la vida* y sigue cubierto
> para siempre— no lo detecta ninguna lectura de la fila ni ninguna comparación del barrido: los
> dos lados coinciden **porque el dato no se movió de ninguno de los dos**. Lo único que lo ve es
> **cruzar las columnas que las condiciones leen contra las que las transiciones escriben**, y eso
> es una propiedad del texto, no de una ejecución.

1. **La estrena `S2`**, con su efecto ya escrito: *«arranca el período»* (§3.2). La fila llega a
   `ACTIVE` y la fecha es ese instante. **Sobre un pagador manual esta escritura tiene población
   vacía** —el evento de `S2` es un webhook de autorizada y acá no hay preapproval que autorice—, y
   ahí la estrena **`MP1` al registrar la primera cuota**, que `S1` abrió con el instante del alta
   como período (abajo, *«cómo entra el grace»*). **No es una cuarta escritura**: es la 2, con su
   primera ocurrencia.
2. **La avanzan `MP1` y `MP4`, un ciclo del `billing_option` anclado** (`B/02` §2.1), **al quedar
   registrada la cuota de ese período**. Es la transición que constata que el período quedó
   pagado la que declara que lo que sigue por cobrar es el siguiente. **No lo hace `S5`**: su
   celda de efectos, entera, es *«se apaga el reloj»* (§3.2), y atribuirle el avance era pedirle
   a la tabla algo que la tabla no dice — la regla 1 del `NUCLEO/03` aplicada al § que la invoca
   cinco veces.
3. **La avanza `S10` al volver de una pausa, tantos ciclos como hayan vencido durante ella y sin
   abrir ninguna cuota.** No es criterio nuevo: es **el espejo local de `PS-6`** —medido: *«el
   ciclo que vence estando pausada avanza la fecha +1 ciclo **sin cobrar**»*— y de lo que
   `DEC-SUB-010` ya eligió para el pagador con tarjeta, *«al volver se le cobra normal en el
   ciclo siguiente: el `next_payment_date` que el proveedor ya tiene corrido»*. Sobre un pagador
   manual **no hay proveedor que lo corra**, así que lo corre esta transición o no lo corre nadie
   — y sin eso el reloj le abre al volver la cuota de un período que transcurrió adentro de la
   cortesía. **Se computa al volver y no pide un reloj propio**: son los ciclos que caben entre la
   fecha vigente y el instante de la vuelta.

   > **Y esta mitad cuelga de una medición que sigue abierta, así que va dicho.** `DEC-SUB-010`
   > quedó *«condicionada a FASE 1C, a la segunda lectura del reloj: ¿la fecha corre +1 ciclo por
   > vencimiento **indefinidamente**, o sólo la primera vez?»*. Lo de arriba es la primera
   > lectura: **tantos ciclos como hayan vencido**. Si la segunda lectura dice que el proveedor
   > corre la fecha **una sola vez**, el pagador con tarjeta vuelve con la fecha en el pasado y el
   > cobro en el acto, y entonces esta regla deja de ser el espejo de nada y hay que volver a
   > elegir para el pagador manual. **No se elige a ciegas y no se deja sin escribir**: sin una
   > regla acá, `MP5` vuelve a leer una fecha que nadie movió, que es el defecto que este § existe
   > para cerrar.

**Y una reimputación, que corre SÓLO en `MP4`**: si el período que la cuota cubre **ya terminó**
en el instante de la reactivación, esa cuota se reimputa al período que arranca ahí, y el avance
del punto 2 sale del período nuevo. Las otras dos vueltas a `ACTIVE` no la necesitan y no la
llevan, y conviene decir por qué cada una:

| vuelta a `ACTIVE` | qué hace con la fecha | por qué |
|---|---|---|
| `S7` por `MP4`, desde `SUSPENDED` | **avanza un ciclo desde el período que la cuota cubre, que la reimputación puede haber movido** | ahí no hubo servicio —`S6` deja la fila *«sin listado público, sin edición, sin creación, sin entitlements comerciales»* (§3.2)— y es la mitad (b): el que vuelve paga **el período que arranca**, no los que pasó suspendido. Es la reimputación la que lo cumple: sin ella el pago liquida un período que transcurrió entero suspendido y el reloj le abre el que arranca en la misma corrida |
| `S10`, desde `PAUSED` por cortesía | **avanza los ciclos vencidos, sin reimputar y sin cuota** | es el punto 3. Ahí no hay nada que reimputar: durante la cortesía **no se abrió ninguna cuota**, así que no existe una fila cuyo período haya quedado atrás, y el avance llega al primer vencimiento posterior a la vuelta sin dejar nunca una fecha pasada |
| `S5`, desde `GRACE_PERIOD` | **no escribe nada** | el avance ya lo escribió `MP1`, que es el pago que produjo esta vuelta. Y no hay nada que reimputar: en grace *«el servicio sigue entero»* (`S4`, §3.2), así que el período de esa cuota **sigue corriendo** y es exactamente el que el pago cubre |

**Ninguna de las tres puede colisionar, y conviene decirlo porque parece que sí**: las tres dejan
una fecha **estrictamente posterior** a la que había, y las cuotas que existen son las de períodos
que arrancaron antes. El `UNIQUE(subscription_id, período)` de `B/05` §C5 y la condición de
idempotencia de `MP5` siguen sin tener contra qué chocar (`B/02` §2.3). **Y la reimputación tampoco
colisiona**: el período al que mueve la cuota arranca en la reactivación, y bajo la mitad (b)
**durante la suspensión no se creó ninguna cuota**, así que no hay otra fila con ese período contra
la que chocar.

**Texto de la fuente — «La pausa: no contradice el `B/06` §7, y por dos razones distintas»** (`B/03-maquinas-de-estado.md:2410–2438`, sin lo tachado):

`B/06` §7 dice que un pago manual mensual **no tiene nada que pausar porque no hay débito que
detener**, y de ahí que `puedePausar()` dé `false` sin excepción escrita. La regla de arriba **no
lo contradice**:

1. **Para `CUSTOMER_REQUEST` la población es vacía.** `S8` exige `puedePausar()` (§3.2) y sobre un
   pagador manual mensual eso es `false`, así que **no hay pausa pedida que pueda existir**. Decir
   que el reloj no crea ahí no le devuelve al método una capacidad que el §7 le negó: no hay a
   quién aplicárselo.
2. **Para `COURTESY` sí hay población, y no crear es lo que la cortesía significa.** `S9` no pasa
   por `puedePausar()`: su condición es *«no hay pausa vigente»* (`DEC-GRANT-004`) — **más, desde
   la FASE 8 completa (`F-8CB1-001`, owner 2026-09-25), el término del ciclo mensual y los meses
   enteros** (§3.2, `S9`), que un pagador manual mensual cumple. **`S9` toma SÓLO ese término** de `puedePausar()`: ni
   `permitePausa`, ni la cuota de pausa, ni la composición del `B/06` §7 (**decidido por el owner el 2026-09-25**: la cortesía es un regalo nuestro, no un pedido del cliente, así que no gasta su cuota de pausas, no depende de que el plan permita pausar, y alcanza al pagador manual, cuya fecha de cobro es nuestra). Ahí el
   mecanismo de la cortesía es *«pausar en el proveedor y sostener el servicio de nuestro lado»*
   (`DEC-GRANT-003`), y sobre un pagador manual **la primera mitad no tiene sujeto** —es
   exactamente lo que el `B/06` §7 constata— **así que lo único que queda de la cortesía es la
   segunda: no pedirle la plata**. Abrir una cuota durante una cortesía sería cobrarle la cortesía,
   que la vacía de contenido. **Y no alcanza con no abrirla durante**: si al volver por `S10` la
   fecha del próximo cobro quedó adentro de la cortesía, el reloj le abre en el acto la cuota de un
   período que transcurrió regalado — la misma cuenta, cobrada más tarde. Por eso `S10` avanza esa
   fecha los ciclos que vencieron, que es lo que el proveedor hace solo sobre un pagador con
   tarjeta (`PS-6`, `DEC-SUB-010`) y acá no hace nadie (arriba, *«qué mueve la fecha del próximo
   cobro»*).

**Y el §7 de `B/06` gana un consumidor, no una excepción**: la respuesta sigue saliendo de componer
capacidades y no de un `if` por vertical ni por método, que es lo que ese § existe para impedir.

**Texto de la fuente — «El aviso: no hace falta uno nuevo, y el que el §30 pide recién ahora tiene de qué colgar»** (`B/03-maquinas-de-estado.md:2439–2461`, sin lo tachado):

El §30 exige notificar al admin cuando falta el pago —*«el único caso donde una notificación es
parte del flujo»*—. **Crear la cuota no pide un aviso propio**, y son dos destinatarios con dos
respuestas:

- **Al admin**: el aviso que el §30 ordena es el de la falta del pago, y ése **no cambia de
  momento** — sale cuando la cuota se abre sin pago contra ella, que **de la segunda cuota en
  adelante** es el mismo instante en que `S4` entra al grace. **Sobre la primera no hay `S4` que
  coincida** —se abre en el alta y no hay grace (abajo, *«cómo entra el grace»*)—, y el aviso sale
  igual, en el instante en que la cuota se abre: lo que lo dispara es la cuota sin pago, no el
  cambio de estado. Lo que `MP5` aporta no es un aviso más: es **el sujeto** que ese aviso no
  tenía. El catálogo del `NUCLEO/07` §6 ya lo lleva en la fila *«cobro fallido / grace»*, con su
  schedule *«relativo al vencimiento»* (`DEC-SUB-002`) — que acá es el instante en que `MP5`
  creó la cuota.
- **Al cliente**: ya está cubierto por *«renovación por venir»* (transaccional, 5 y 1 día antes,
  §42.2), que es literalmente el aviso de que se acerca el momento de pagar. Para el pagador
  manual es el que le dice cuándo transferir, y no necesita otra redacción.

**Así que el catálogo del `NUCLEO/07` §6 no gana una fila.** Agregar un correo *«se abrió tu
cuota»* dos días después de *«renovación por venir»* sería el segundo contacto por el mismo hecho,
que es lo que la jerarquía de supresión de ese capítulo (§4.2) existe para evitar.

**Texto de la fuente — «Lo que NO cambia, y hay que contarlo para que nadie lo recuente»** (`B/03-maquinas-de-estado.md:2462–2504`, sin lo tachado):

- **La máquina sigue teniendo TRES estados** — `AWAITING`, `REGISTERED` y `DECLARED_UNPAID`
  (`NUCLEO/01` §2.2). `MP5` sale de *(sin fila)*, que por la **regla 2** del `NUCLEO/03` §1 es un
  estado que **vive afuera de la columna**: la máquina de suscripción cuenta **nueve** con el
  mismo criterio, dejando su *(sin fila)* fuera de la cuenta. `MP5` agrega una arista, no un nodo.
- **`G-R4` no gana ningún par por `MP5`** —los pares con dos filas son
  **cuatro** (revisión del owner, 2026-09-28, C8: `S10`/`S25` salió; C10: entró `PB11`/`PB13`), y `MP5` no es ninguno de ellos—. El par de `MP5` es
  `(sin fila, se abre la cuota de un período)` y **ninguna otra fila de esta tabla sale de
  *(sin fila)***, así que tiene una sola. **Sus dos cláusulas no son dos pares**: son dos
  disparadores del mismo evento sobre el mismo `desde`, exactamente como los **dos** de `S9` y las
  **tres** de `A5`, que tampoco los suman. Del lado de la tabla del §3.2 tampoco agrega uno: el
  efecto de la cláusula *(a)* entra por `S4`, que ya existe y cuyo par `(ACTIVE, un cobro falla)`
  sigue teniendo una sola fila, y la *(b)* **no tiene efecto sobre esa tabla** — es precisamente lo
  que la hace no ser un beneficio de entrada.
- **El barrido de `B/09` §3 no gana nada por `MP5`: sigue con cuatro salvedades y las
  comprobaciones de cero llamadas que tenga —**seis** desde `DEC-GRANT-007`—, y sus puertas son
  **quince**, recontadas sobre la tabla de `B/09` §3** (con `S31`, FASE 8 completa, owner 2026-09-25; `S36`, FASE 9 vuelta 1; y la lápida de recepción, owner 2026-09-26, `X-1`; sin `S25`, `S27` ni `S28` desde la revisión del owner, 2026-09-28, C8). `MP5` no lleva
  ninguna suscripción a un estado terminal y no toca ningún preapproval — no hay ninguno.
- **El catálogo de acciones administrativas no suma filas por `MP5`** (arriba; tiene
  veinticinco *(con la vigesimoquinta: verificación corta, 2026-09-29, lote N-G; con la vigesimosexta, asignar o quitar el rol `SUPER_ADMIN`: FASE 9 vuelta 3, owner 2026-09-30, lote P; el nombre, lote AC)* (la vigesimotercera y la vigesimocuarta, borrar una ficha ajena y **dar de baja una cuenta** (caso I-C) a pedido de su dueño: casos vecinos, 2026-09-29, F-C; revisión del owner, 2026-09-28, N1 y C9: de la decimoctava a la vigesimosegunda, las cinco del catálogo; la decimosexta salió con la revisión del owner, 2026-09-28, C8, y su número no se reusa; la decimoséptima, *«migrar a los clientes de un plan retirado»*: la misma revisión, C15; la decimoquinta, editar el contenido de una ficha ajena: owner 2026-09-26, `G5-2`; la decimotercera es moderar una ficha: FASE 8 completa, `F-8CA2-004`, owner 2026-09-25; la decimocuarta, *«asentar un cobro o una devolución que ya ocurrió por fuera»*: owner 2026-09-25, FASE 9 completa, 5a)).
- **`C5` no se toca.** Su `UNIQUE(subscription_id, período) WHERE el pago está acreditado`
  (`B/05` §C5) impide **dos pagos acreditados** del mismo período, y una cuota en `AWAITING` no
  está acreditada: la idempotencia de `MP5` es **la condición de su propia fila** —que no exista
  ya un `manual_payment` de ese período—, no esa restricción. Las dos conviven sin superponerse.
- **Las cuatro condiciones del `B/05` §3 valen igual.** `MP5` no registra un pago: abre la cuota
  contra la que después se lo registra. **Y la reimputación de `MP4` tampoco las mueve**, con el
  detalle condición por condición arriba, en *«al reabrir por `MP4`»*.
- **El avance y la reimputación no agregan ninguna fila, así que nada de lo de arriba se
  recuenta.** Son **efectos**, declarados en las celdas de `MP1`, `MP4` y `S10`, no transiciones
  nuevas: no hay un `MP6` por esto, `G-R4` no gana ningún par por acá y la máquina sigue teniendo tres
  estados. *(El `MP6` que existe desde la FASE 9 vuelta 3 es otro acto, la transferencia que no cae en ninguna cuota abierta, FASE 9 vuelta 3, owner 2026-09-30, lote W: suma un par a `G-R4` y ningún estado.)*
- **Y el barrido NO gana una sexta comprobación de cero llamadas.** La pregunta que faltaba
  —*«¿hay una suscripción de pagador manual a la que nadie le abre cuota?»*— dejó de tener
  población: no es un caso a detectar, es un estado que ya no se alcanza, porque la fecha que
  `MP5` lee tiene **tres** escrituras declaradas y ninguna la deja quieta. Las
  **seis** de `B/09` §3 —seis desde `DEC-GRANT-007`— quedan como estaban, contadas sobre su
  texto vigente.
- **Y `PS-6` no gana una excepción, gana un consumidor.** Lo que `S10` hace sobre un pagador
  manual es lo que el proveedor ya hace sobre un pagador con tarjeta, medido y adoptado por
  `DEC-SUB-010`; lo único propio es **quién** lo escribe, porque de un lado hay proveedor y del
  otro no.

**Texto de la fuente — «Qué premisa de otro arreglo vuelve falsa este, y dónde quedó resuelta»** (`B/03-maquinas-de-estado.md:2505–2529`, sin lo tachado):

La obligación 2 de `DEC-METH-008`, contestada por escrito:

| premisa | de quién era | qué pasa | dónde |
|---|---|---|---|
| *«quién crea las cuotas de un pagador manual y cuándo queda abierto»* | el arreglo de `MP4` (`DEC-SUB-012`, §7.1) | **queda FALSA**: lo cierra `MP5`, y su respuesta —no crear durante la suspensión— es además la que ese § dejaba pedida en su misma frase | corregida en §7.1, en el recuadro que la declaraba abierta |
| *«la máquina de pago manual no tiene entrada, y su grace no tiene quién lo abra»* (`F-8B2-018`) | la FASE 8 adversarial | **queda FALSA en sus dos mitades**: la entrada es `MP5` y el grace entra por `S4`, con el hecho nombrado acá arriba | este § |
| *«`MP4` no agrega ningún par, así que `G-R4` sigue contando tres»* | el arreglo de `MP4` (§7.1) | **verdadera en su primera mitad y CADUCA en la segunda**: `MP4` no agrega ningún par y `MP5` tampoco —sale de un `desde` que ninguna otra fila usa—, pero los pares dejaron de ser tres el día que `DEC-SUB-015` creó `S25`, que es de otro §. **Fueron cuatro, y son tres otra vez desde la revisión del owner, 2026-09-28, C8, que sacó `S25`**, recontados sobre la tabla de `NUCLEO/03` §1 regla 7 y no sumándole uno | corregida en §7.1, y en las otras tres apariciones del corpus |
| *«la máquina sigue teniendo tres estados»* y *«`B/02` §2.3 no necesita un estado nuevo»* | el arreglo de `MP4` (§7.1) y `B/02` §2.3 | **siguen verdaderas**: `MP5` agrega una arista desde *(sin fila)*, que no es un nodo de la columna | sin tocar |
| *«`manual_payment` guarda quién lo registró, cuándo, comprobante»* | `B/02` §2.3 | **queda INCOMPLETA**: una cuota en `AWAITING` existe **antes** de que nadie registre nada, así que esos tres no se pueden escribir todavía y falta **el período** que el `UNIQUE` de `B/05` §C5 ya presuponía | corregida en `B/02` §2.3 |
| *«un pago manual mensual no tiene nada que pausar»* | `B/06` §7 | **sigue verdadera**, y esta regla la usa en vez de contradecirla | arriba, *«la pausa»* |
| *«el grace no es un beneficio de entrada»* | `B/12` §4.3 | **sigue verdadera, y es la LECTURA que este § le daba la que queda FALSA**: lo que se lee por autorización es el predicado de `S16` —el **remedio**—, no la regla, así que sobre un pagador manual la regla se aplica entera y lo que faltaba era su ejecutor. Lo ejecuta la cláusula *(b)* de `MP5` abriendo la primera cuota en `PENDING_AUTHORIZATION`, donde `S4` no alcanza | corregida arriba, en *«cómo entra el grace»*, y en `B/12` §4.3 y §4.5 punto 1 |
| *«la deuda vieja no se persigue por separado»* y *«el que paga tarde paga esa cuota»* | `B/12` §5.3 y `DEC-SUB-012` | **siguen verdaderas**, y son la razón escrita de (b) | arriba |
| *«el período actual»* como columna de `subscription` | `B/02` §2.2 | **queda RENOMBRADA**: lo que la fila guarda es **una fecha** y no un período, y leerla como período es lo que dejó a `MP5` esperando que alguien *«avanzara»* algo. Pasa a ser *«la fecha del próximo cobro»*, la misma cifra que el barrido compara contra `next_payment_date` | corregida en `B/02` §2.2 |
| *«el período no avanza mientras el pago no entra: `S5` es lo que lo cierra»* | el arreglo de `MP5`, en la fila `GRACE_PERIOD` de la tabla de arriba | **queda FALSA en sus dos mitades**: `S5` no declara ese efecto —su celda es *«se apaga el reloj»*— y el período **sí** puede avanzar en grace si el grace configurado es más largo que un ciclo. Lo que impide abrir la cuota ahí es el `desde` de `MP5` | corregida arriba, en esa misma fila |
| *«el período nuevo arranca EN LA REACTIVACIÓN»*, sin condición | el arreglo de `MP5`, en *«al reabrir por `MP4`»* | **queda FALSA como regla general**: sobre una reapertura que cae **dentro** del período pagado, re-anclar le cobra dos veces los días que le quedaban | corregida arriba, en esa misma sección |
| *«la fecha pasa a ser el instante de la reactivación»* como remedio del caso largo (el **tope** de la FASE 9-bis-4) | el arreglo del tope de `MP4` (`rastro-8f9f31ac0.md`, §7.2 y `B/02` §2.2) | **queda FALSA**: esa fecha es exactamente la que hace disparar a `MP5` en el acto —su condición es *«ya llegó»*—, así que el que vuelve pagaba el período que pasó suspendido **y** el que arranca, y `S4` lo devolvía al grace el mismo día. El remedio no es una fecha: es **reimputar la cuota** al período que arranca | corregida arriba, en *«al reabrir por `MP4`»*, y en `B/02` §2.2 |
| *«el reloj crearía de golpe todas las cuotas»* | el arreglo de `MP5`, misma sección | **queda FALSA en el mecanismo y verdadera en el desenlace**: la condición de `MP5` nombra un período y es idempotente, así que crea **una** cuota por corrida; la deuda igual se acumula cuota a cuota. Era la parte falsa la que le agrandaba el alcance al remedio | corregida arriba, con el motivo reescrito |
| *«al reanudar se le muestra una sola cosa: qué día se le cobra»* y *«se le cobra normal en el ciclo siguiente: el `next_payment_date` que el proveedor ya tiene corrido»* | `DEC-SUB-010`, en la celda de `S10` | **siguen verdaderas, y recién ahora tienen respuesta sobre un pagador manual**: ahí no hay proveedor que corra nada, así que lo corre `S10` con los ciclos que vencieron durante la pausa. Lo que era una frase con sujeto sólo del lado de la tarjeta pasa a valer para los dos | `S10`, §3.2 |
| *«el ciclo que vence estando pausada avanza la fecha +1 ciclo sin cobrar»* (`PS-6`) | la matriz, citada por `DEC-SUB-010` y `B/12` §7.1 | **sigue verdadera y gana un consumidor**: es la medición que fija qué hace `S10` sobre un pagador manual, donde nadie la ejecuta por nosotros | arriba, punto 3 |
| *«la fecha del próximo cobro se registra»* del barrido | `B/09` §3 | **sigue verdadera y sin tocar**: es la escritura del régimen **con** proveedor, y sobre un pagador manual el barrido no tiene preapproval que leer | sin tocar |

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1871, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:592, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:299, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1906, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1931, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1990, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2012, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2047, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2068, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2095, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2111, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2142, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2179, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2257, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2410, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2439, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2462, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2505

<a id="trans-b-mp2"></a>

### `TRANS:B:MP2` · `MP2` — `AWAITING` → `DECLARED_UNPAID`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B7](10-corte/B7.md#pieza-b7) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `AWAITING`
- **evento** (disparador): el admin confirma que no se pagó
- **hacia** (estado destino): `DECLARED_UNPAID`
- **efectos** (efectos): la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj — **es el cuarto evento de `S6`**, declarado en su fila desde la FASE 9 completa (C8, `F-8CB2-009`): antes `S6` no lo nombraba y por la regla 1 del núcleo `MP2` no suspendía. **Sólo si la suscripción está en `GRACE_PERIOD`**: sobre una fila que ya salió del grace la cuota no queda `AWAITING` —la cierra la tercera cláusula de `MP3`—

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1872, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-mp3"></a>

### `TRANS:B:MP3` · `MP3` — `AWAITING` → `DECLARED_UNPAID`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `AWAITING`
- **evento** (disparador): se agota el grace sin que el admin haga nada — **o, sobre la PRIMERA cuota, se agota la ventana de autorización y `S3` se lleva la fila a `ABANDONED`** (§7.2, *«cómo entra el grace»*) — **o, tercera cláusula, la suscripción sale de `GRACE_PERIOD` o de `PENDING_AUTHORIZATION` por cualquier transición que no sea `S5`, `S6`, `S2`/`S29` ni `S3`** —del grace, `S13`, `S17`, `S20`, `S21` y `S24`; de `PENDING_AUTHORIZATION` con la primera cuota abierta, `S13`, `S20` y `S21`: **las ocho salidas del dominio**, recontadas sobre la tabla del §3.2 (revisión del owner, 2026-09-28, C8: salen `S26` y `S28`); `S31` ya la cierra por la segunda cláusula— (owner 2026-09-25; FASE 9 completa, 8f, `F-8CB2-005`): la cuota impaga de quien se va no queda viva, y registrarla después con `MP1` ya no avanza la fecha del próximo cobro de una fila muerta
- **hacia** (estado destino): `DECLARED_UNPAID`
- **efectos** (efectos): `S6` por la primera cláusula. **Por la segunda, ninguno**: la fila de suscripción ya la mató `S3`, y lo que esta transición hace es cerrar la cuota para que no quede un `AWAITING` colgando de una suscripción muerta. **Por la tercera, ninguno tampoco**, con la misma razón

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1873, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-mp4"></a>

### `TRANS:B:MP4` · `MP4` — `DECLARED_UNPAID` → `REGISTERED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`; `B/descomposicion.md:592`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `DECLARED_UNPAID`
- **evento** (disparador): el admin registra el pago, que llegó **después**
- **hacia** (estado destino): `REGISTERED`
- **efectos** (efectos): la suscripción sale de `SUSPENDED` por `S7` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: misma herencia y misma razón que `MP1`, porque **el daño no depende de por qué puerta entró el pago** ni de desde qué estado del pago manual se lo registre. **`S19` lo admite por su propio evento**, que nombra el hecho —entró el pago del período impago— y no el mecanismo (§3.2). **Y no es incondicional**, por partida doble: el cruce de `C5` vale igual que en `MP1`, y `S7` exige **las cuatro condiciones del `B/05` §3** — la **1** es el tope de la reapertura (ver abajo, *«el tope no es un día»*). **Y avanza un ciclo la fecha del próximo cobro, igual que `MP1`** — **y si el período que esa cuota cubre YA TERMINÓ**, o sea si la suspensión duró más que un período, **antes de registrarla la reimputa al período que arranca en la reactivación** (§7.2, *«al reabrir por `MP4`»*): el avance sale entonces de ese período nuevo y la fecha queda en **la reactivación más un ciclo**. Dejar la fecha **en** la reactivación era abrirle la cuota del período que arranca en la misma corrida del reloj, con `S4` devolviéndolo a `GRACE_PERIOD` el mismo día — dos períodos cobrados y ningún día comprado. Y avanzar siempre al día de la reactivación, sin mirar si el período terminó, le cobraba dos veces los días que le quedaban del período que acababa de pagar. **Y emite el comprobante**, igual que `MP1` (`B/02` §2.3, `DEC-LEGAL-001`; FASE 8 completa, `F-8CB3-006`)

**Texto de la fuente — «Al reabrir por `MP4`: el reloj vuelve a crear, y si el período viejo ya terminó la cuota se REIMPUTA»** (`B/03-maquinas-de-estado.md:2323–2409`, sin lo tachado):

Si estuvo `SUSPENDED` no se crearon cuotas, así que hay que decir qué pasa cuando vuelve.

> **`MP4` lleva la fila a `ACTIVE` por `S7`, y desde ese instante el reloj vuelve a crear.** Lo
> que la persona paga es **un** período, y cuál es depende de si el de la cuota todavía corre:
>
> - **Todavía corre** —la reapertura cae adentro de él—: la cuota queda donde está y la fecha del
>   próximo cobro **avanza un ciclo** desde el inicio de ese período, igual que en `MP1`.
> - **Ya terminó** —la suspensión duró más que un período—: **antes de registrarla, `MP4`
>   reimputa la cuota al período que arranca en la reactivación** —le reescribe el `período`
>   (`B/02` §2.3), sobre la misma fila que `MP2` o `MP3` cerraron— y el avance de un ciclo sale de
>   ahí, así que la fecha queda en **la reactivación más un ciclo**.

**Dejar la fecha EN la reactivación era cobrarle dos períodos y no venderle ninguno.** El que se
atrasa, pasa tres meses `SUSPENDED` y transfiere el día 100 liquida con ese pago el período que
arrancó el día 0 —el que pasó **casi entero suspendido**—, y como la fecha del próximo cobro queda
en el día 100, **la primera corrida del reloj encuentra que la fecha ya llegó y que ese período no
tiene cuota**: `MP5` abre la del período que empieza hoy y `S4` lo devuelve a `GRACE_PERIOD` **en
el mismo acto**. El día que volvió debe dos períodos completos y lo que su plata compró son **cero
días**. La reimputación es lo que lo cierra: el pago compra el período que arranca, la fecha queda
un ciclo por delante y el reloj no encuentra nada que abrir hasta entonces.

**Y es literalmente la mitad (b), que hasta acá se cumplía a medias.** *«El que vuelve paga el
período que arranca, no los que pasó suspendido»*: sin reimputar, pagaba el que pasó suspendido
—`MP4`— **y** el que arranca —`MP5`, el mismo día—; con la reimputación paga **el que arranca y
nada más**, y los períodos que transcurrieron bajo la suspensión no se cobran ni quedan como deuda
(§7.1, *«lo adeudado»*).

**Re-anclar siempre a la reactivación era el otro doble cobro, y hay que decir sobre quién.** El
que se atrasa, transfiere **el día 20 de un período que arrancó el día 0** y paga el importe del
período entero (`B/05` §3, condición 2) tiene diez días por delante que ya pagó. Con el re-anclaje
incondicional esos diez días pasaban a ser el arranque del período **siguiente**: el reloj le abría
la cuota en el acto y `S4` lo devolvía a `GRACE_PERIOD` el mismo día. **Pagaba dos veces los días
20 a 30**, y ni el correo ni la pantalla lo decían. Como la reimputación **sólo corre cuando el
período ya terminó**, ese caso no la toca: la fecha queda en el día 30, el reloj no encuentra nada
que abrir hasta ese día, y los diez días son los que compró.

**Las cuatro condiciones del `B/05` §3 se evalúan igual, y hay que decir por qué la reimputación no
las mueve.** La **2** —*«el monto coincide con el esperado para el período que cubre»*— no depende
de cuál sea el período: el monto **no se guarda**, se resuelve de la versión de plan anclada
(`B/02` §2.3), que la reimputación no toca, así que evaluarla antes o después del cambio da la
misma respuesta. La **4** —*«no hay otro pago acreditado para el mismo período»*— se evalúa sobre
el período reimputado y no encuentra ninguno, porque durante la suspensión no se creó ninguna cuota
(la mitad (b)). Las condiciones **1** y **3** no nombran ningún período.

**Y la reimputación se asienta, porque una columna que se reescribe sin rastro no es auditable.**
Va en el evento de dominio de `MP4`, que la **regla 4** del `NUCLEO/03` §1 ya exige por cada
transición: ahí quedan el período que la cuota tenía y el que pasó a cubrir, que es lo que permite
contestar *«¿qué compró esta transferencia?»* sin reconstruirlo. **Es la única escritura del
`período` que no es la de su creación**, y `B/02` §2.3 la declara como tal.

**Lo que la reimputación NO le devuelve son los días que consumió en grace adentro del período que
ya no se le cobra.** Ese período se abrió, la persona tuvo servicio entero mientras corrió el grace
(`S4`, §3.2) y después `S6` se lo cortó; al reimputar la cuota, ese tramo queda **sin cobrar**. Es
el precio de la política de retención del §20, que el §21 acota cortando el servicio en cuanto el
grace se agota — y **no es un beneficio de entrada**, porque sobre un pagador manual el grace sólo
alcanza a una suscripción que **ya tiene al menos un pago acreditado** (abajo, *«cómo entra el
grace»*): nadie llega a ese tramo sin haber pagado antes.

**Y el argumento que justificaba el re-anclaje era verdadero en su conclusión y falso en su
mecanismo, que es lo que le agrandó el alcance.** Decía que con el ancla vieja *«el reloj, en su
primera corrida, crearía **de golpe** todas las cuotas que (b) mandó no crear»*. **De golpe no**:
la condición de `MP5` nombra **un** período —el de la fecha vigente— y es idempotente, así que
crea **una** cuota por corrida. El daño verdadero es otro y sigue siendo real: esa única cuota
sería la de un período que **transcurrió entero durante la suspensión**, o sea días sin servicio,
que es exactamente lo que la mitad (b) mandó no cobrar; y al registrarse, la fecha avanzaría a otro
pasado, y así hasta ponerse al día. No una avalancha sino una cola, con la misma deuda al final.
**El remedio era correcto y su alcance estaba mal escrito**: se aplicaba también a la población
donde el avance cae en el futuro, y ahí su propio motivo no existe.

**Y no le regala nada a nadie, en ninguna de las dos ramas.** Con el período todavía corriendo, lo
que `MP4` registra **es la cuota del período impago** —la misma fila que `MP2` o `MP3` cerraron,
por el importe esperado (§7.1, *«lo adeudado»*)—, y lo que **no** le devuelve son los días que pasó
en grace y suspendido adentro de ese período: *«nada es retroactivo»* (§7.1), y ésa es la
consecuencia de no haber pagado a término, no un cobro nuevo. Con el período ya terminado, lo que
registra es **un** período —el que arranca— por el mismo importe, y lo que no le devuelve son los
meses que pasó suspendido, que no se cobran y tampoco se prestaron.

**La reimputación es de esta puerta, y el avance no.** Sobre un pagador con tarjeta **no hay nada
que reimputar**: las fechas las tiene el proveedor y son inmutables (`EX-39`, `B/12` §5.4), y sobre
esa población la columna es una copia que ninguna regla lee para decidir (`B/02` §2.2) — además de
que ahí no hay cuota de `manual_payment` que mover. Sobre un pagador manual la reimputación corre
**sólo acá**, porque es la única vuelta a `ACTIVE` que puede encontrar una cuota cuyo período ya
terminó. El **avance**, en cambio, no es sólo de `MP4` —la vuelta de una cortesía lo necesita
igual—, y por eso está escrito arriba como la tercera escritura y no adentro de esta puerta.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1874, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:592, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2323

<a id="trans-b-mp5"></a>

### `TRANS:B:MP5` · `MP5` — *(sin fila)* → `AWAITING`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): **dos cláusulas, un mismo acto — abrir la cuota de un período**: *(a)* **un reloj abre el período** de una suscripción de pagador manual, porque **llegó la fecha del próximo cobro** (`B/02` §2.2), que es el instante en que el proveedor habría cobrado (§7.2); *(b)* **el alta de un pagador manual abre su PRIMERA cuota** — y el alta es **`S1`**, que ya existe (§3.2) —, que es el espejo del primer cobro que en un pagador con tarjeta ocurre antes de `S2`
- **hacia** (estado destino): `AWAITING`
- **efectos** (efectos): **es la entrada de esta máquina, y la crea el sistema, no un admin.** La cláusula *(a)* **sólo corre con la suscripción en `ACTIVE`** —los otros cinco estados vivos están descartados uno por uno en el §7.2— y **en el mismo acto la suscripción entra en `GRACE_PERIOD` por `S4`**, que es lo que el §30 ya ordenaba abajo y lo que `MP1` y `MP2` ya presuponían en sus efectos. La cláusula *(b)* corre en **`PENDING_AUTHORIZATION`** y **no dispara `S4`**: el `desde` de `S4` es `ACTIVE`, así que la primera cuota **no abre grace** y la fila no da servicio hasta que se registre (§7.2, *«cómo entra el grace»*). **El par `(desde, evento)` sigue siendo uno solo** —*(sin fila)*, abrir una cuota— con sus dos cláusulas, igual que `S9` tiene tres y `A5` tres: `G-R4` no gana ningún par. **Idempotente por condición**: no crea si ya existe una fila de `manual_payment` para ese período, igual que `S13` y `S20` son *«idempotentes y reanudables fila por fila»*. **Y si ese día llega también un cambio programado de la fila, lo aplica `S38` primero** (§3.2): la cuota se abre ya con la versión destino (verificación corta, 2026-09-29, lote M-B)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1875, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="trans-b-mp6"></a>

### `TRANS:B:MP6` · `MP6` — *(sin fila)* → `REGISTERED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`; `B/descomposicion.md:726`
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): **el admin registra una transferencia que no cae en ninguna cuota abierta**: una segunda del mismo período, o una sobre una fila que ya no abre cuotas, como una `CANCELLED` (FASE 9 vuelta 3, owner 2026-09-30, lote W; `F-8V3B1-005`; la plantilla sin llenar, verificación, VC3-cobro-06)
- **hacia** (estado destino): `REGISTERED`
- **efectos** (efectos): **es la misma acción, *«registrar un pago manual»* (§30), ejecutada sin cuota abierta**, como `MP4` lo es desde otro estado de origen: mismo permiso, misma auditoría y misma confirmación, que acá dice además que el pago es un segundo pago del período y que se propone devolverlo. **Crea la fila de `manual_payment` ya `REGISTERED`**, con el período de la última cuota de la suscripción, quién, cuándo y el comprobante de la transferencia (`B/02` §2.3). **Intenta escribir la cobertura y choca con el `UNIQUE` de `covered_period`**, porque ese período ya tenía un cobro acreditado: la cobertura no se escribe y **`S14` abre la marca `COBRO_DUPLICADO`** (`B/02` §2.5, motivo 20) con este `manual_payment` colgado, igual que `P1` sobre un cobro de tarjeta. Es la simetría con la tarjeta, y el default es devolver (`B/19` §6): la devolución se asienta por **`RF4`**, con el comprobante de la transferencia de vuelta (§6.1). **No mueve la suscripción, no avanza la fecha del próximo cobro y no emite comprobante**: no cubre ningún período nuevo. Si la fila no tiene ninguna cuota, porque nunca fue de pagador manual, el período es el del último cobro acreditado. Si no tiene ninguno, no hay período con qué chocar y `MP6` no corre: queda declarado en *«lo que este capítulo NO cierra»*. **Sobre una `CANCELLED` cuya última cuota quedó `DECLARED_UNPAID`** (la baja desde `GRACE_PERIOD` o desde `SUSPENDED`, que `MP3` o `MP2` cierran sin pago), **ese período no tiene cobertura y no hay nada con qué chocar: `MP6` no escribe cobertura y `S14` abre la marca `COBRO_POSTERIOR_A_LA_BAJA`** (`B/02` §2.5, motivo 2) con este `manual_payment` colgado, que ya propone devolver, lo mismo que la tabla de desempate del `B/05` §3 le da a un cobro sobre una terminal. La confirmación dice que es un pago posterior a la baja, no un segundo pago del período. La devolución se asienta igual por `RF4` (FASE 9 vuelta 3, owner 2026-09-30, lote AF; verificación, VC3-cobro-03). **Lo mismo sobre una `ABANDONED` de pagador manual cuya primera cuota quedó `DECLARED_UNPAID`** (la ventana de autorización vencida, que `S3` y `MP3` cierran sin pago): el período de esa cuota no tiene cobertura, `MP6` no la escribe y `S14` abre el motivo 2 con el `manual_payment` colgado y la propuesta de devolver (FASE 9 vuelta 3, owner 2026-09-30, lote AM)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1876, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:726

## Instancia de addon, A1–A7 (`B/03` §8)

### Instancia de addon, A1–A7 (`B/03` §8) — «8. Addon (instancia)»

Texto de `B/03-maquinas-de-estado.md:2530–2549`, sin lo tachado:

**Cancelar el plan no cancela los addons**: como cada addon recurrente es una suscripción aparte,
esa orquestación es nuestra (`DEC-ADDON-002`), y es justamente lo que el §41 pide poder hacer al
revés. **La baja desde `ACTIVE` cancela su COBRO y no la instancia** (FASE 9 vuelta 2, owner 2026-09-27,
`R1-a`): `S11` cancela en el acto el preapproval de cada complemento recurrente que depende de la
principal y lo deja en `CANCEL_SCHEDULED` hasta el fin de servicio (§3.2); la instancia la apaga
la orfandad cuando `S12` saca a la principal de las filas vivas.

## Instancia de addon, A1–A7 (`B/03` §8) — las transiciones

<a id="trans-b-a1"></a>

### `TRANS:B:A1` · `A1` — *(sin fila)* → `PENDING_AUTHORIZATION`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10)
- **Fuente de la asignación**: `B/descomposicion.md:148`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A1](20-fase-3/B10.md#apz-a1) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): se contrata
- **hacia** (estado destino): `PENDING_AUTHORIZATION`
- **nota** (guardas y efectos): exige una suscripción principal válida y compatible (§38) **—o, en su lugar, un ancla viva de un grant permanente en esa vertical, que vale como título (`B/16` §2.4, la excepción del §35.3; residuo corregido el 2026-10-02)—** —**válida es `ACTIVE` y pagando** (`NUCLEO/01` §2; FASE 9 vuelta 1, `F-8V1D1-002`)**: con al menos un pago acreditado, o sucesora de una predecesora que venía pagando** (la lectura de `S4`, §3.2; `B/16` §2.2; owner 2026-09-25, FASE 9 completa, 4d, que absorbe `R12-OWNER-2`): un addon comprado en los minutos que siguen a un alta cuyo primer cobro después se rechaza quedaba cobrando sin título—. **Nunca durante un trial** (§10.5) — **leído como `V/11` §5.1–§5.2**: se prohíbe comprar teniendo **sólo** trials; y **con scope `LISTING`, el objetivo no puede ser una ficha de una vertical cuyo único título es un trial** —en `cobertura(user, vertical del objetivo)`, ninguna fuente de clase `TÍTULO` que no sea de `tipo: TRIAL`—, porque la ficha en trial **no es objetivo elegible** (FASE 8 completa, `F-8CA1-004`). **Un addon `USER` o `GLOBAL` se puede comprar igual**: lo que no hace es aportar en la vertical en trial, y eso lo corta el pliegue (`V/15` §2.6, `G-R2`), no esta fila. **Y con scope `LISTING`, la ficha objetivo es el recurso del paso 4 del cap. 17** (épica de verticales): propia del comprador, de la vertical del producto, y en un estado que acepte destacarla —ni `PURGED` ni `MODERATED`— **—leído por `ficha(idDeFicha).admiteDestaque` del contrato §4.1, que contesta sí o no y define verticales; billing no lee el estado de la ficha** (FASE 9 vuelta 1, `N-G4V-06`)—. Si no, *«no existe»* (FASE 9 vuelta 1, `F-8V1A1-009`). **Y el addon `UNA_VEZ` nace con el identificador del pedido del cliente** (FASE 9 vuelta 2, owner 2026-09-27, `R4`, `F-8V2B2-003`): la pantalla de compra lo acuña al abrirse y viaja con el pedido; `A1` lo persiste en la instancia (`B/02` §2.4), **y la clave de `/v1/orders` sale de él y no de la llamada** (`B/16` §1.4). Un segundo pedido con el mismo identificador —el doble clic, el reintento del navegador— **no crea otra instancia**: devuelve la que ya existe, y su orden es la misma. Una recompra es otro pedido, con otro identificador. **Y una compra sin resolver del mismo producto sobre el mismo objetivo no deja abrir otra** (FASE 9 vuelta 3, owner 2026-09-30, lote E, `F-8V3B2-001`, `F-8V3B1-003`): **la identidad de la compra es `(dueño, producto, objetivo)`**, y mientras haya una instancia con esa identidad en `PENDING_AUTHORIZATION`, un pedido con otro identificador no crea otra (el `UNIQUE` parcial de `B/02` §2.4): la pantalla muestra la compra pendiente y dice que se está procesando. **Vale para las dos clases**: en el `UNA_VEZ` es la pantalla recargada después de una respuesta perdida, que acuñaba otro pedido y cobraba otra orden; **en el recurrente es el candado contra el doble clic**, que no tenía ninguno, porque los candados `A` y `B` son de la principal (`B/02` §2.2) y el proveedor no deduplica la creación (`EX-17`). **No impide una recompra legítima**: resuelta la instancia, en el estado que sea, la identidad queda libre, **salvo en el recurrente mientras la instancia siga `ACTIVE`: un addon recurrente igual sobre el mismo objetivo, con uno vivo, no es recompra y el mismo `UNIQUE` lo frena** (FASE 9 vuelta 3, owner 2026-09-30, lote Y; `B/02` §2.4). El costo, dicho: quien perdió la respuesta de una compra no puede volver a comprar ese producto para ese objetivo hasta que la instancia se resuelva, como mucho la ventana de `A3`; en el recurrente, mientras tanto, tiene el enlace para retomar el checkout (§3.4)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2534, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148

<a id="trans-b-a1-bis"></a>

### `TRANS:B:A1-bis` · `A1-bis` — *(sin fila)* → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10)
- **Fuente de la asignación**: `B/descomposicion.md:148`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A1-bis](20-fase-3/B10.md#apz-a1-bis) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): *(sin fila)*
- **evento** (disparador): **la persona elige un addon compatible teniendo un ancla viva de un grant con `includesAddons: true`** —lo elige uno por uno, y esa elección es un acto suyo con su registro (`B/16` §3.2)—
- **hacia** (estado destino): `ACTIVE`
- **nota** (guardas y efectos): (corte del MVP, owner 2026-10-02, CD.) **Sin preapproval ni orden, sin `payment` y sin comprobante**: no hay pago de cero ni comprobante de cero (`B/16` §3.1). **La instancia registra como su título el ancla**, no *«el grant»*, como en `S20` (`B/16` §3.1; `DEC-ADDON-003`, mecánica 3). **Compatible** es lo que el producto declara para la vertical donde el grant ancló: el grant es título sólo ahí (`B/16` §2.4). No pasa por `PENDING_AUTHORIZATION` porque no hay nada que autorizar, así que `A2`, `A3` y `A7` no tienen sujeto; **la apaga `A5`** por su tercer evento cuando se revoca el grant del que cuelga el ancla. **La construye `B10`**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2535, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148

<a id="trans-b-a2"></a>

### `TRANS:B:A2` · `A2` — `PENDING_AUTHORIZATION` → `ACTIVE`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10) · **también**: [B6](10-corte/B6.md#pieza-b6) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:148`; `D/16-fase-7-del-paraguas.md:966`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A2](20-fase-3/B10.md#apz-a2) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING_AUTHORIZATION`
- **evento** (disparador): se autoriza
- **hacia** (estado destino): `ACTIVE`
- **nota** (guardas y efectos): recurrente: su propio preapproval (`DEC-ADDON-002`). De única vez: su propio cobro **por `/v1/orders`, sin preapproval** (`EX-30`, medido sólo en sandbox; `B/16` §1.4, `B/06` §3.2); su `payment` cuelga de la instancia (`B/02` §2.3). **`/v1/orders` es idempotente por la clave (`EX-41`, sonda 51): un reintento con la misma clave no cobra dos veces** (corrección de diseño, FASE 8 completa, `F-8CB1-008`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2536, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:966

<a id="trans-b-a3"></a>

### `TRANS:B:A3` · `A3` — `PENDING_AUTHORIZATION` → `ABANDONED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10)
- **Fuente de la asignación**: `B/descomposicion.md:148`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A3](20-fase-3/B10.md#apz-a3) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING_AUTHORIZATION`
- **evento** (disparador): vence la ventana
- **hacia** (estado destino): `ABANDONED`
- **nota** (guardas y efectos): **la misma ventana que `S3`**, con sus **dos** plazos según el método de pago (§3.4 punto 1). **Y el efecto de `S3`** (FASE 9 completa, C-R5-2): si es recurrente, **relee su preapproval por id** —si lo ve `authorized`, `A3` no ocurre y corre `A2`: nuestro reloj no decide solo sobre un estado del proveedor— y **lo cancela en el proveedor, con la regla de relectura de `S17` y con nuestro correo antes** (§3.2, *«el correo antes de cancelar»*); si la cancelación falla, la reintenta el barrido por la salvedad 1 de `B/09` §3. Un preapproval `pending` no vence (`EX-1`), así que sin esto el enlace viejo se podía autorizar más tarde. **De única vez no hay preapproval, y lo que corre es su gemelo sobre la orden** (FASE 9 vuelta 2, owner 2026-09-27, `R4`, `F-8V2B1-003`, `F-8V2B2-004`): **`A3` sólo confirma, nunca crea** (FASE 9 vuelta 3, owner 2026-09-30, lote E, `F-8V3B1-001`, `F-8V3B1-002`, `F-8V3B2-001`). El reenvío de la ventana se apoyaba en `EX-41`, que midió el reenvío inmediato; el de horas después, con el token de la tarjeta vencido, es `EX-43`, `UNKNOWN`, y si la orden nunca había existido el reenvío la creaba y la cobraba tres días después, sobre una compra que la persona ya había rehecho. **Con el id de la orden guardado**, `A3` la relee por id: con un pago aprobado no ocurre y corre `A2`; sin él, ocurre; si la relectura no responde, no ocurre en esa corrida y la condición se vuelve a evaluar en la siguiente. **Sin id de orden, `A3` ocurre sin reenviar nada**: la instancia pasa a `ABANDONED` sin id, y si la orden llegó a existir y se pagó, la busca la comprobación de órdenes pagadas del barrido por el identificador del pedido (`B/09` §3), **condicionado a que el proveedor permita encontrar una orden por esa referencia** (`EX-57`, `UNKNOWN`); si no lo permite, ese caso queda sin detector, declarado en *«lo que este capítulo NO cierra»* de `B/09`. La orden que se aprueba después de que `A3` abandonó la ve el barrido (`B/09` §3, la comprobación de órdenes pagadas)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2537, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148

<a id="trans-b-a4"></a>

### `TRANS:B:A4` · `A4` — `ACTIVE` → `EXPIRED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10)
- **Fuente de la asignación**: `B/descomposicion.md:148`; `D/16-fase-7-del-paraguas.md:966`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A4](20-fase-3/B10.md#apz-a4) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE`
- **evento** (disparador): llega su fecha de fin
- **hacia** (estado destino): `EXPIRED`
- **nota** (guardas y efectos): **el reloj no se congela** aunque la ficha esté despublicada (`DEC-ADDON-001`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2538, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:966

<a id="trans-b-a5"></a>

### `TRANS:B:A5` · `A5`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `D/16-fase-7-del-paraguas.md:959`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A5](10-corte/B5.md#apz-a5) → [B5](10-corte/B5.md#pieza-b5)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): **toda instancia con una autorización que puede cobrar: `PENDING_AUTHORIZATION` y `ACTIVE`** (ver abajo, *«la instancia que autoriza después»*)
- **evento** (disparador): se da de baja, queda huérfano, **o se revoca el grant del que cuelga el ancla que era su título**
- **hacia** (estado destino): `CANCELLED`
- **nota** (guardas y efectos): **Son tres eventos y el tercero es nuevo** (ver abajo, *«el addon cuyo título era el ancla»*). **El tercero nombra la REVOCACIÓN y no *«el retiro del ancla»***, porque *«desanclar no está declarado»* (`12-contrato…` §2.8, `B/02` §2.4) y una transición no puede esperar un acto que ningún catálogo produce: revocar es el acto declarado —fila del grant permanente del `NUCLEO/08` §3— y **retira todas las anclas del instrumento de una vez**, que es lo que el ancla-título de esta instancia necesita. §41: **sólo** cuando queda efectivamente huérfano, no por cancelar la vertical. *«Huérfano»* es la condición de `B/16` §4.2 —el objetivo dejó de ser fila viva, **ninguna sucesión lo releva** y **ningún grant permanente lo releva**; **y para `LISTING`, esa misma condición leída sobre **el conjunto de las principales** de la vertical de la ficha** —ninguna viva y ningún ancla viva— (`B/16` §4.2; FASE 8 completa, `F-8CA2-003`, owner 2026-09-25; **el conjunto**, owner 2026-09-25, FASE 9 completa, 4c); **y para `USER`/`GLOBAL`, que en ninguna vertical compatible de su producto haya una principal viva y pagando ni un ancla viva** (4d; *«pagando»*, `NUCLEO/01` §2, FASE 9 vuelta 1, `F-8V1D1-002`)—. **El borrado de la ficha ya no es orfandad: es sólo el evento de `A6`** (FASE 9 completa, `K-9` de `05`: las dos filas compartían el par `(ACTIVE, llegada a PURGED)` sin guardas disjuntas, y por la regla 7 del `NUCLEO/03` §1 ninguna corría; las dos iban al mismo `CANCELLED` con el mismo motivo 14, así que la plata no cambia). **Nunca un estado de llegada concreto**: la pueden cumplir **las transiciones que sacan a una principal de las filas vivas, enumeradas en `B/16` §4.3 y no copiadas acá** —eran *«seis»* acá y *«doce»* allá, y las dos omitían `S31`; eran **trece** desde la FASE 9 completa (contradicción 2 de `03` §R6.5), y fueron **catorce**, con `S36` (FASE 9 vuelta 2, `R1-b`, `F-8V2D1-001`), y hoy son **once**, sin `S25`, `S27` y `S28` (residuo visto al publicar, 2026-09-30; vale `B/16` §4.3; salieron con la revisión del owner, 2026-09-28, C8)—, y `S16` (`CHARGE_DECLINED`) es una de ellas. **Y se evalúa sobre los complementos de la fila que la transición sacó de las filas vivas y, si esa fila era una sucesora, también sobre los de su predecesora** (`B/16` §4.3); **y, si esa fila es principal, sobre las instancias `LISTING` cuyas fichas son del mismo `user + vertical`** (`B/16` §4.3 punto 3; `F-8CA2-003`) **y sobre las `USER`/`GLOBAL` del mismo `user` cuyo producto declara compatible esa vertical** (`B/16` §4.3 punto 4; FASE 9 completa, 4d). **Y la suscripción de complemento de la instancia que se apaga queda `CANCELLED` en el mismo acto, por `S21`** (§3.2): **el preapproval que este efecto cancela es el de esa fila**, así que la llamada es **una sola** y no se manda dos veces. **Y antes de esa llamada sale nuestro correo** (`DEC-MAIL-001`; §3.2, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala

**Texto de la fuente — «La instancia que autoriza después de que su título murió: por qué `A5` no sale sólo de `ACTIVE`»** (`B/03-maquinas-de-estado.md:2550–2604`, sin lo tachado):

**El `desde` de `A5` decía `ACTIVE` y nada más, y eso dejaba entera la ventana de autorización del
checkout del addon.** El camino, con todos sus pasos declarados: alguien `ACTIVE` —el único
estado desde el que se puede comprar (`B/16` §2.2)— contrata un addon recurrente, `A1` lo lleva a
`PENDING_AUTHORIZATION` con la misma ventana que `S3` —y sus **dos** plazos, §3.4 punto 1—, y **dentro de esa ventana su suscripción
principal deja de ser fila viva**. Cualquiera de las **once** transiciones del `B/16` §4.3 (residuo visto al publicar, 2026-09-30; vale `B/16` §4.3) sirve
—recontadas sobre la enumeración de ese §—, y
dos no necesitan que nadie toque un botón: `S12` es un reloj y `S16` llega con el cobro real, que
`PA-3` mide **entre 26 y 44 minutos** después de autorizar. El disparador de la orfandad se
disparaba ahí y **no encontraba a quién aplicarle**: la instancia estaba en
`PENDING_AUTHORIZATION` y `A5` no salía de ahí. Después la persona completaba el checkout, `A2` la
llevaba a `ACTIVE` **con su propio preapproval** (`DEC-ADDON-002`) y ninguna condición de `A2`
mira el título — la validez se evalúa al comprar (`B/16` §2.2). Quedaba **cobrando todos los
meses sin otorgar nada**, porque sin ninguna fuente de clase `TÍTULO` el pliegue **descarta** las
de clase `COMPLEMENTO` (`12-contrato…` §2.4). Es, con esas palabras, *«el que no puede fallar»*
del `B/16` §4.3: **un preapproval huérfano sin cancelar es un débito mensual a alguien que ya no
es cliente**.

**Es el mismo argumento que metió `PENDING_AUTHORIZATION` en el alcance de `S13`, aplicado a la
otra máquina.** Una instancia esperando autorización **es una obligación de pago**: su preapproval
está creado y la persona puede completar el checkout en cualquier momento, sin tener por qué
saber que su título murió. Por eso el `desde` de `A5` son **los dos estados de la instancia en
los que existe una autorización que puede cobrar** —`PENDING_AUTHORIZATION` y `ACTIVE`—, su
efecto cancela el preapproval **esté autorizado o esperando autorización**, con la misma regla de
relectura de `S17` (si ya está `cancelled`, no se manda nada), y la pantalla de *«esperando que
completes el pago»* **deja de ofrecer el enlace en el mismo acto**, igual que en `S13` (§3.4
punto 3).

**`A5` desde `PENDING_AUTHORIZATION` no colisiona con `A3`**: el par es
`(PENDING_AUTHORIZATION, queda huérfano)` y `A3` es `(PENDING_AUTHORIZATION, vence la ventana)`.
Son dos eventos distintos, así que **`A5` no agrega ninguna entrada** y la tabla de la regla 7
del núcleo sigue teniendo **tres** (la cuarta, `S10`/`S25`, salió con la revisión del owner, 2026-09-28, C8). **El tercer evento de `A5` tampoco agrega un par**:
*«se revoca el grant»* no lo comparte ninguna otra fila de esta tabla, ni desde `ACTIVE` —donde
están `A4` y `A6`, con sus propios eventos— ni desde `PENDING_AUTHORIZATION`. Los estados de llegada difieren —`CANCELLED` y
`ABANDONED`— y los dos son terminales de la instancia, así que **los dos caen bajo la salvedad 1
de `B/09` §3**, que devuelve al barrido la suscripción de complemento hasta que la relectura vea
el preapproval `cancelled`.

> **Y desde `S21` esa salvedad puede nombrar su sujeto de las DOS maneras, no de una.** Cuando la
> instancia llega a `CANCELLED` la fila de complemento llega **ella misma** a terminal en el mismo
> acto, así que el barrido la puede seleccionar **por su propio estado** — y con eso la
> discrepancia pasa a ser una de las cinco comparaciones de campo (`CANCELLED` nuestro contra
> `authorized` del proveedor) en vez de una lectura cruzada entre dos entidades. **La selección
> por el estado terminal de la instancia no sobra por eso, y hay que decirlo**: es la única que ve
> la corrida en que `A5` corrió y `S21` todavía no, donde la fila de complemento sigue diciendo
> `ACTIVE` y para las cinco comparaciones eso **coincide**.

**Y el orden inverso también tiene evento declarado, que era la otra mitad del hueco.** Si por lo
que sea `A5` no corrió cuando el título murió —la condición del `B/16` §4.2 no se cumplía en ese
instante porque una sucesión lo relevaba, y se cumplió después—, la condición **se vuelve a
evaluar cuando la instancia llega a `ACTIVE` por `A2`**: es uno de los momentos que `B/16` §4.3
enumera, y sin esa enumeración *«se re-evalúa»* era una promesa sin transición, que es lo que la
regla 1 de este capítulo no admite.

**Texto de la fuente — «El addon cuyo título era el ancla: por qué `A5` gana un tercer evento»** (`B/03-maquinas-de-estado.md:2605–2688`, sin lo tachado):

`B/16` §3.3 decide desde hace tiempo que **al revocar un grant el addon se corta** —*«la fuente
era el grant y el grant se fue»*—, y **ninguna fila de esta tabla lo ejecutaba**. La orfandad no
sirve para eso y la razón es exacta: **el predicado de `B/16` §4.2 pregunta por el OBJETIVO**, y
el objetivo de un addon de scope `LISTING`, `USER` o `GLOBAL` es una ficha o una cuenta que
siguen existiendo. Sólo el scope `VERTICAL_SUBSCRIPTION` volvía a *«huérfano»* al caerse el
grant, porque ahí el objetivo **sí** estaba muerto y era el grant lo único que lo relevaba
(tercera mitad del §4.2). Para los otros tres, *«se corta»* era una frase sin transición — y por
la regla 1 de este capítulo, una frase sin transición **no pasa**.

**El evento se enuncia sobre la REVOCACIÓN del grant, y esa redacción es la decisión del owner
del 2026-09-21 — no un matiz.** La primera versión decía *«se retira el ancla que era su
título»*, y **retirar un ancla no existe**: el `NUCLEO/08` §3 declara para el grant exactamente
**tres** escrituras —otorgar, anclarle una vertical nueva, revocar—, el `12-contrato…` §2.8 y el
`B/02` §2.4 dicen los dos, con esas palabras, que *«desanclar no está declarado»*, y la palabra
**no aparece en ninguna otra parte del corpus**. Una transición cuyo evento espera un acto que
ningún catálogo puede producir es una transición inalcanzable, que es la misma regla 1 por la
otra punta. Se eligió **reescribir la cláusula, no declarar un acto nuevo**: declararlo habría
abierto *«reducir el scope de un grant»*, que el `12-contrato…` §2.8 manda entrar por el catálogo
con su propia fila, su confirmación y su transición.

**La cláusula NO se borra, y ésa es la razón por la que esto no fue una supresión.** Es lo único
que apaga el addon cuando se revoca el grant en **tres de los cuatro** scopes: en `LISTING`,
`USER` y `GLOBAL` el objetivo **nunca muere** —la ficha sigue ahí, la cuenta sigue ahí—, así que
la condición de huérfano **no se cumple jamás** y sin esta cláusula la revocación dejaría al
addon convertido **funcionando gratis para siempre y sin suscripción**, porque `S20` se la
canceló (`B/16` §3.3).

**Con el enunciado nuevo los tres scopes siguen cubiertos, y no queda camino sin transición.**
Revocar es el único acto declarado que retira un ancla, y **retira todas las del instrumento a la
vez** —*«un grant es UN instrumento con UN ANCLA POR CADA VERTICAL … una revocación»*
(`12-contrato…` §2.8)—, así que alcanza a la instancia sea cual sea el ancla de la que cuelgue y
sin importar su scope.

> **«Retira todas las anclas» es retirarlas como TÍTULO, no como FILAS, y la diferencia decide si
> la cuarta comprobación del barrido tiene sujeto.** Revocar escribe `revocado_en` en el
> **instrumento** (`B/02` §2.4) y con eso las N anclas dejan de ser **anclas vivas** en el mismo
> instante; **las filas de `permanent_grant_vertical` no se borran**. Tienen que quedarse porque
> `addon_instance` apunta ahí y la segunda mitad de la cuarta comprobación —*«el ancla que era su
> título ya no es la de un grant vivo»*, `B/09` §3— **se lee DESPUÉS de la revocación**: con la
> fila borrada, el predicado se queda sin el dato en el único momento en que lo necesita. Y
> borrarlas sería además *«un efecto lateral de borrar una fila»*, que es el mecanismo que el
> `12-contrato…` §2.8 rechaza con esas palabras. Las otras dos escrituras del catálogo **no retiran nada**: otorgar crea el
instrumento y anclar **agrega** una vertical. **Y para `VERTICAL_SUBSCRIPTION` las dos cláusulas
—la orfandad y ésta— se cumplen en el mismo acto**, lo cual no es un solapamiento de la regla 7
del `NUCLEO/03` —son dos eventos, no un par con dos filas, y llegan al mismo `CANCELLED`— y no
duplica nada: la segunda encuentra la instancia ya fuera del `desde`, que son los dos estados con
autorización que puede cobrar.

**Y sigue siendo la revocación de SU grant, no la ausencia de título**, que es la distinción que
la redacción vieja acertaba y ésta conserva. Si el predicado fuera *«no le queda ninguna fuente
de clase `TÍTULO`»*, alguien que vuelve a suscribirse el mismo día que le revocan el grant
conservaría el addon gratis: tendría título de nuevo y nadie pagaría el complemento. Lo que se
cayó es **el título concreto del que ese addon colgaba**, y la instancia lo dice porque lo
guarda: `addon_instance` apunta al ancla (`B/02` §2.4), y el ancla dice de qué grant es. Si
después quiere el addon, lo contrata — que es la mitad de la decisión del owner que dice que
**revocar no repara** (`B/16` §3.3, `DEC-GRANT-001`, `DEC-TRIAL-009`).

> **La columna sigue apuntando al ANCLA y no al grant, y eso no cambia con este enunciado.** El
> evento es del grant; **el sujeto es el ancla**, porque el título es por vertical (`B/16` §2.4)
> y es el ancla la que dice en cuál. Lo que el `B/02` §2.4 pierde con *«desanclar no está
> declarado»* es sólo **una** de las dos razones que dio para preferir el ancla —la de que
> *«retirar una vertical cortaría los addons de las otras»*, que describe un acto inexistente—;
> la otra sigue entera y alcanza sola: sin el ancla no se sabe **en qué vertical** ese addon es
> gratis, y ésa es la pregunta que el pliegue hace.

**Cubre los dos orígenes del addon gratuito con una sola regla**: el que el beneficiario eligió
gratis (`B/16` §3.2) y el que `S20` convirtió desde uno que venía pagando (`B/16` §3.4). El
primero ya tenía este agujero y nadie lo había nombrado; el segundo lo habría heredado.

**Y el efecto es el mismo que el de los otros dos eventos**: `CANCELLED`, con la cancelación del
preapproval si quedaba alguno vivo y con la regla de relectura de `S17`. En el addon convertido
por `S20` **normalmente no queda ninguno** —su suscripción de complemento ya se canceló al
otorgar—, así que ahí el acto es sólo local; la llamada existe para el addon que nunca fue
gratis y llegó acá por otro camino. **Y el *«normalmente»* tiene un caso con nombre**: una corrida
de `S20` cortada entre sus dos escrituras deja el ancla escrita y el complemento vivo (§3.2), así
que ahí `A5` **sí** manda la cancelación y `S21` cierra la fila detrás. Es el escenario para el
que el orden de `S20` está declarado. **Y en ese addon la fila de complemento la cierra `S21`**
(§3.2), que es la que le pone estado terminal al cobro: en el convertido su población es vacía,
porque `S20` ya la sacó de las filas vivas.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2539, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:959, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2550, .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2605

<a id="trans-b-a6"></a>

### `TRANS:B:A6` · `A6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10)
- **Fuente de la asignación**: `B/descomposicion.md:148`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A6](20-fase-3/B10.md#apz-a6) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `ACTIVE` —**o `PENDING_AUTHORIZATION`**: la ficha de un `LISTING` que espera autorización también se puede borrar, y hasta la FASE 9 completa ese caso lo cubría la mitad *«la ficha se borró»* de `A5`, que salió de ahí (`K-9`)—
- **evento** (disparador): se borra la ficha destino —**cualquier llegada a `PURGED`**: `PB9`, el día 180, o `PB12`, el dueño (`V/03` §9)—, **que billing recibe por dos caminos** (owner 2026-09-26, `G2-1`): **el empuje *«la ficha llegó a `PURGED`»*** que verticales emite **por el mismo acto de `PB9`/`PB12`, después de su commit** (`12-contrato…` §3.1; FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`: un empuje anterior al commit llegaba con la ficha todavía sin `PURGED` y la relectura de `fichaPurgada` lo descartaba siempre) —al recibirlo, `A6` corre en ese momento sobre toda instancia viva de scope `LISTING` con ese `objetivo`—, **y, como red, la consulta `fichaPurgada` del contrato §4.1, leída por el barrido diario** (`B/09` §3): si una instancia viva de scope `LISTING` da `sí`, corre `A6`. **En los dos caminos `A6` relee `fichaPurgada` antes de cancelar**: el empuje no se cree solo. Si la cancelación falla, la instancia sigue viva y la corrida siguiente vuelve a leer lo mismo. El empuje no tiene transporte durable: si se pierde, `A6` corre con hasta un día de atraso (declarado en `B/16`, NO cierra)
- **hacia** (estado destino): `CANCELLED`
- **nota** (guardas y efectos): **es la ÚNICA fila que ejecuta el borrado de la ficha** (FASE 9 completa, `K-9` de `05`): compartía el par con la segunda cláusula de `A5` y, sin guardas disjuntas, la regla 7 del `NUCLEO/03` §1 dejaba sin correr a las dos. **Se consume**: no se libera ni se reasigna (`DEC-ADDON-001`), y el borrado **tiene que advertir qué addons se pierden y por cuánto**. **Su suscripción de complemento también queda `CANCELLED` en el acto, por `S21`** (§3.2) — misma regla y misma razón que en `A5`: el addon complementa algo que ya no está. **La cancelación de ese preapproval la manda este acto** (`S21` no manda nada), así que lleva la misma condición que `A5`: **antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; §3.2, *«el correo antes de cancelar»*)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2540, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148

<a id="trans-b-a7"></a>

### `TRANS:B:A7` · `A7` — `PENDING_AUTHORIZATION`, **sólo `UNA_VEZ`** → `ABANDONED`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B10](20-fase-3/B10.md#pieza-b10)
- **Fuente de la asignación**: `B/descomposicion.md:148`
- **Traslado a pieza** (instancia de addon → pieza, `D/16` §4.6, [AV](01-decisiones-vigentes.md#own-41-corte-del-mvp-t4-av)): [APZ:A7](20-fase-3/B10.md#apz-a7) → [B10](20-fase-3/B10.md#pieza-b10)
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): integración con DB, en la pieza dueña.
- **desde** (estado origen): `PENDING_AUTHORIZATION`, **sólo `UNA_VEZ`**
- **evento** (disparador): **la orden vuelve rechazada**: `402` con la orden `failed` y su id en el cuerpo del error, **leído releyendo por id la orden cuyo id vino en el cuerpo del error** (`EX-30`; verificación corta, 2026-09-29, VC-cobro-05: la respuesta de una creación no es una lectura por id, y `D17` no la admite; si la relectura no responde, `A7` no ocurre en esa corrida)
- **hacia** (estado destino): `ABANDONED`
- **nota** (guardas y efectos): (mediciones del 2026-09-29, lote L-C.) **Un rechazo cierra la compra en el acto**, sin esperar la ventana de `A3`: el id de la orden `failed` queda guardado en la instancia (`B/16` §1.4). **El segundo intento es otro pedido**: la pantalla de compra acuña un identificador nuevo y `A1` crea otra instancia, con otra clave, porque reusar la del pedido rechazado devuelve la orden `failed` y otra tarjeta con la misma clave es otro cuerpo, que el proveedor contesta `409` (`EX-41`). **Y si el `402` no llegó**, el segundo pedido reenvía la misma orden y el rechazo llega por ahí (`B/16` §1.4; verificación corta, 2026-09-29, lote N-B). **No manda nada al proveedor**: no hay preapproval que cancelar ni orden que reenviar. **Sólo `UNA_VEZ`**: el complemento recurrente se autoriza en el checkout del proveedor, donde el rechazo no llega como una orden, y sigue con `A2` o `A3`. **Su par, `(PENDING_AUTHORIZATION, la orden vuelve rechazada)`, tiene una sola fila**: comparte el `desde` con `A2`, `A3`, `A5` y `A6`, no el evento, así que no suma a la tabla de la regla 7 del `NUCLEO/03` §1

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2541, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:148

## Motivos de la marca de conciliación (`B/02` §2.5)

Cada motivo es un valor de la columna **`motivo`** de **`reconciliation_mark`**, *«enumeración cerrada, §2.5»* (`B/02` §2.2, línea 57). El nombre del valor va en el título de cada ítem.

### Motivos de la marca de conciliación (`B/02` §2.5) — «El catálogo, contado sobre los escritores que hay hoy»

Texto de `B/02-modelo-de-datos.md:1008–1124`, sin lo tachado:

**`S14` es el ACTO, no el motivo.** Su evento es *«divergencia que toca plata o estado»* y cubre
**trece** de los **veinticuatro** casos de abajo —los tres nuevos, el 17, el 18 y el 19, los abre `S14` (FASE 8 completa,
`F-8CB3-009`, `F-8CB3-003`, `DEC-SUB-020`), **y el 20 también, desde `P1`** (FASE 8 completa, pendiente 6, owner 2026-09-25), **y el 22, desde la rama de fallo de `S8`, de `S9` y de `S32`** (FASE 9 completa, `F-8CB2-003`;
`S32` agregado owner 2026-09-25, 4a), **y el 24, desde la comparación de cobros del `B/09` §3** (FASE 9 vuelta 2, `R20`)—; el motivo lo trae **el caso que lo disparó**, igual que el
de la pausa lo trae `S8` o `S9`. Los otros **once** —de los veinticuatro— los abren actos que **no son `S14`** — `S18`,
las **seis** comprobaciones de cero llamadas del `B/09` §3, **`S21`, que desde `DEC-RF-006` abre
dos**, **el reintento del barrido sobre las salvedades 1 y 4 del `B/09` §3, que abre el 16**
(FASE 8 completa, `F-8CB1-013`), **y la lectura del `B/09` §4 que sigue en *«todavía no se sabe»*
a los 3 días, que abre el 21** (`B/09` **§6, punto 2**; owner 2026-09-25, FASE 9 completa, 3d), **y la comprobación de órdenes pagadas del `B/09` §3, que abre el 23** (FASE 9 vuelta 2, `R4`) —, y el propio `S19` declara por escrito que su caso **no es una divergencia**.

**La enumeración es cerrada y el conteo se recalcula, no se incrementa**: un escritor nuevo agrega
su fila acá **en el mismo acto** en que se escribe, y `G-R1-F` (`B/20` §2) falla si alguna
transición o comprobación del corpus pone la marca sin nombrar un motivo de esta tabla. **El 12 y
el 13 llegaron con `DEC-GRANT-007` y son el ejemplo de por qué la regla dice *«se recalcula»***:
el 12 es el riesgo que esa decisión aceptó y el 13 su detector, y las dos cifras de este § se
volvieron a contar sobre la tabla en vez de sumarles dos.

**Y las dos cifras SE MOVIERON con `DEC-RF-006`, recontadas enteras sobre la tabla de arriba.** El
motivo único que `S21` abría se partió en **dos** —el 14 y el 15—, así que la enumeración
tuvo **quince** filas; y los que llevan **SÍ** en la última columna son **seis** —el 1, el 2, el 3, el
7, el 12 y el **15**—, mientras el 14 se queda con **puede**, que es la casilla que el motivo único
ya tenía. **Lo que la partición compra es que el default vuelva a leerse POR MOTIVO**: `DEC-RF-004`
había dejado un motivo cuya propuesta no se podía resolver sin saber además de qué disparador vino
la marca, y desde `DEC-RF-006` eso lo resuelve **quien escribe el motivo**, en el acto y con lo que
ya sabe. La tabla de defaults del `B/19` §6 vuelve a ser una columna plana, y **las ocho
filas con `SÍ` son exactamente las nueve que ese § propone devolver** (el 20 entra en las
dos desde la pendiente 6, owner 2026-09-25, y el 23 y el 24 desde la FASE 9 vuelta 2, `R4` y `R20`).

**Y se movió una sola cifra con `F-8CB1-013`, recontadas otra vez las dos sobre la tabla** (FASE 8
completa, owner 2026-09-25). La enumeración tuvo **dieciséis** filas; los **SÍ** siguen siendo
**seis** —el 1, el 2, el 3, el 7, el 12 y el 15—, porque el 16 lleva **no**: cancelar no devuelve
ni cobra nada. **Su urgencia no es plata parada sino un cobro que todavía puede salir**, y por eso
la última columna lo dice con la misma forma que el 10 y el 11.

**Y se movió otra vez una sola cifra con el 17, el 18 y el 19, recontadas las dos sobre la tabla**
(FASE 8 completa, `F-8CB3-009`, `F-8CB3-003`, `DEC-SUB-020`, owner 2026-09-25). La enumeración
tuvo **diecinueve** filas; los **SÍ** siguen siendo **seis** —el 1, el 2, el 3, el 7, el 12 y el
15—, porque el 17 y el 18 llevan **no** —en los dos la plata ya salió de nuestra cuenta, por el
banco o por el panel— y el 19 lleva **puede**, como el 4, el 13 y el 14. **`S14` pasa de siete a
diez** —abre los tres— y **los que abren otros actos siguen siendo nueve**.

**Y se movieron las tres cifras con el 20, recontadas enteras sobre la tabla** (FASE 8 completa, pendiente 6, owner 2026-09-25).
El 19 se partió: el cobro aprobado que nunca asentamos sigue siendo `COBRO_SIN_REGISTRAR`, y **el
que choca con un período ya pagado pasa a `COBRO_DUPLICADO`**, con **SÍ** en la última columna y
default de devolución en `B/19` §6. La enumeración tuvo **veinte** filas; los **SÍ** son **siete**
—el 1, el 2, el 3, el 7, el 12, el 15 y el **20**—; (el 19 pasó a **no** en la pendiente 8: párrafo siguiente). **`S14` pasa de diez a once** —el 20 lo abre desde `P1`— y **los que abren otros actos
siguen siendo nueve**.

**Y se movió una casilla sin mover ninguna de las tres cifras, recontadas enteras sobre la
tabla** (orquestador, FASE 8 completa, pendiente 8). El 19, `COBRO_SIN_REGISTRAR`, pasa de
**puede** a **no**: la plata entró bien y lo que falta es asentarla. Con eso la última columna
queda en **siete SÍ** —el 1, el 2, el 3, el 7, el 12, el 15 y el 20—, **tres puede** —el 4, el 13
y el 14— y **diez no** —el 5, el 6, el 8, el 9, el 10, el 11, el 16, el 17, el 18 y el 19—: veinte
en total. **`S14` sigue abriendo once y los otros actos nueve**.

**Y se movieron tres de las cifras con el 21 y el 22, recontadas enteras sobre la tabla** (FASE 9
completa, 3d y `F-8CB2-003`, owner 2026-09-25). La enumeración tuvo **veintidós** filas; los **SÍ**
siguen siendo **siete** —el 1, el 2, el 3, el 7, el 12, el 15 y el 20—, los **puede** siguen siendo
**tres** —el 4, el 13 y el 14—, y los **no** pasan a **doce** —el 5, el 6, el 8, el 9, el 10, el 11,
el 16, el 17, el 18, el 19, el 21 y el 22—. **`S14` pasa de once a doce** —el 22 lo abre desde
`S8`/`S9`— y **los otros actos, de nueve a diez** —el 21 lo abre el barrido, como el 16—. El 21 y el
22 llevan **no** con la misma forma que el 16: no hay plata parada, pero hay un cobro o un servicio
que no coincide con lo que la fila dice.

**Y se movieron tres de las cifras con el 23, recontadas enteras sobre la tabla** (FASE 9 vuelta 2,
owner 2026-09-27, `R4`). La enumeración tuvo **veintitrés** filas; los **SÍ** pasan a **ocho** —el
1, el 2, el 3, el 7, el 12, el 15, el 20 y el 23—, los **puede** siguen siendo **tres** y los **no**
siguen siendo **doce**. **`S14` sigue abriendo doce** y **los otros actos pasan de diez a once** —el
23 lo abre el barrido—. El 23 lleva **SÍ** porque la persona pagó y no tiene el addon, y la
instancia `ABANDONED` no vuelve.

**Y se movieron tres de las cifras con el 24, recontadas enteras sobre la tabla** (FASE 9 vuelta 2,
owner 2026-09-27, `R20`). La enumeración tiene **veinticuatro** filas; los **SÍ** pasan a **nueve**
—el 1, el 2, el 3, el 7, el 12, el 15, el 20, el 23 y el 24—, los **puede** siguen siendo **tres**
y los **no** siguen siendo **doce**. **`S14` pasa de doce a trece** —el 24 lo abre la comparación de
cobros, como el 19— y **los otros actos siguen siendo once**. El 24 lleva **SÍ** porque la persona
pagó de más, y lo que propone devolver es **la diferencia**, no el cobro: el período lo recibió.

**El 14 y el 15 llegaron por lo mismo y conviene decir de dónde.** `S21` declaraba una vía —*«sin reembolso
del período ya cobrado; si corresponde devolver, entra por la vía del reembolso, que confirma una
persona (`DEC-RF-002`)»* (`B/03` §3.2)— **que nadie disparaba**, y desde que esta enumeración es
cerrada la ausencia dejó de ser una omisión y pasó a ser una imposibilidad: bajo `G-R1-F` esa vía
**no se podía escribir sin agregar una fila acá**. La acción existe en el catálogo de `NUCLEO/08`
§3 con su permiso, su auditoría y su confirmación, y ese mismo § dice que *«no sirve de nada si
nadie enruta el caso»*. **Los dos son quienes lo enrutan**, cada uno con su propuesta.

## Motivos de la marca de conciliación (`B/02` §2.5) — los veinticuatro

<a id="mot-1"></a>

### `MOT:1` · `REEMBOLSO_POR_CONFIRMAR`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:854`
- **Valor del enum**: `reconciliation_mark.motivo` = `REEMBOLSO_POR_CONFIRMAR`
- **`motivo`**: `REEMBOLSO_POR_CONFIRMAR`
- **quién abre la marca**: **`S18`** al cerrar la sucesión, ramas 1, 5 y 6 de `B/12` §5.3; en la 6, no tras `S36`, cuyo `RF1` devuelve el pago retenido (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-o`)
- **qué tiene que hacer la persona**: confirmar el reembolso del pago que `S19` retuvo, por la puerta por la que entró (§2.3)
- **¿hay plata del cliente que devolver?**: **SÍ**, y el monto está determinado — **es la suma de los pagos colgados de la marca** (§2.2), que acá es **uno**: `S19` retiene el del período impago

**Texto de la fuente — «2.5 La marca de conciliación: veinticuatro motivos sobre la misma casilla, y nueve de ellos devuelven plata»** (`B/02-modelo-de-datos.md:972–1007`, sin lo tachado):

> Eran **quince** hasta la FASE 8 completa: el 16, `CANCELACIÓN_SIN_CONFIRMAR`, llegó con
> `F-8CB1-013` (owner 2026-09-25), y el catálogo se recontó entero sobre la tabla de abajo.
> **Y eran dieciséis hasta la misma FASE 8 completa**: el 17, `CONTRACARGO`, llegó con
> `DEC-SUB-020` y `F-8CB3-009`; el 18, `REEMBOLSO_FUERA_DEL_FLUJO`, con *«lo que NO decide»* de esa
> misma decisión; y el 19, `COBRO_SIN_REGISTRAR`, con `F-8CB3-003` y `F-8CB1-011` (owner
> 2026-09-25). Recontado otra vez entero sobre la tabla: **diecinueve**, y los **SÍ** siguen siendo
> **seis**.
> **Y eran diecinueve hasta la pendiente 6 de la misma FASE 8 completa**: el 20,
> `COBRO_DUPLICADO`, salió de partir el 19 (owner 2026-09-25). Recontado entero sobre la tabla:
> **veinte**, y los **SÍ** pasan a **siete**.
> **Y eran veinte hasta la FASE 9 completa**: el 21, `COBRO_DEL_PERÍODO_SIN_RESOLVER`, llegó con
> la decisión 3d (`F-8CB3-004`, owner 2026-09-25), y el 22, `PAUSA_NO_APLICADA`, con `F-8CB2-003`
> (corrección sin decisión nueva, FASE 9 completa). Recontado entero sobre la tabla: **veintidós**,
> y los **SÍ** siguen siendo **siete**.
> **Y eran veintidós hasta la FASE 9 vuelta 2**: el 23, `ORDEN_PAGADA_SIN_INSTANCIA`, llegó con la
> decisión `R4` (owner 2026-09-27). Recontado entero sobre la tabla: **veintitrés**, y los **SÍ**
> pasan a **ocho**.
> **Y eran veintitrés hasta la misma FASE 9 vuelta 2**: el 24, `IMPORTE_COBRADO_DE_MÁS`, llegó con
> la decisión `R20` (owner 2026-09-27). Recontado entero sobre la tabla: **veinticuatro**, y los
> **SÍ** pasan a **nueve**.

**`requiere_conciliación` era un booleano y el diseño ya le escribía un MOTIVO.** `S18` pone la
marca *«con motivo **«reembolso por confirmar»**»* (cap. 03 §3.2) y las ramas 1, 5 y 6 de `B/12`
§5.3 —las que mandan devolver el pago que `S19` retuvo— **se apoyan en ese motivo y no en la
marca**. Un booleano no lo transporta: lo que le llegaba a la persona era una fila `CANCELLED`
marcada, **indistinguible de las otras veintitrés marcas**, sin nada que dijera que hay plata del
cliente en nuestra cuenta. El pago se quedaba.

**Y el precedente de la forma está una tabla más arriba, decidido por el owner.** `DEC-GRANT-004`
implicación 1: *«el estado «pausada» de nuestra base **necesita un motivo, no sólo un booleano**»*,
porque en el proveedor una cortesía se ve idéntica a una pausa pedida por el cliente. `subscription_pause`
lleva su `motivo` por esa razón exacta y `S8` y `S9` lo escriben distinto. **La marca tiene la
misma forma y le faltaba la misma columna.**

**Texto de la fuente — «Qué cambia con el motivo, además de que se pueda leer»** (`B/02-modelo-de-datos.md:1155–1178`, sin lo tachado):

1. **El listado accionable deja de ser homogéneo.** `B/19` §6 muestra el motivo, **el default de
   lo que el sistema propone** (`DEC-RF-003`) y ordena primero
   los **nueve** motivos con `SÍ` en la última columna —1, 2, 3, **7**, 12, **15**,
   **20**, **23** y **24** (el 23 y el 24 desde la FASE 9 vuelta 2, `R4` y `R20`)—, donde
   **esperar le cuesta plata al cliente**. **Y desde `DEC-RF-006` ese orden se lee entero sobre la
   tabla de arriba**: el caso que `DEC-RF-004` había dejado afuera de la columna —la propuesta de
   `S21`, que dependía del disparador— es hoy el motivo 15, con su `SÍ` propio.
2. **`S15` levanta UNA marca, no la fila.** Con un booleano, resolver una divergencia de monto
   apagaba en el mismo gesto un *«reembolso por confirmar»* que nadie había mirado. El `UNIQUE`
   parcial del §2.2 es lo que deja convivir las dos, y es el caso que la rama 3 de `B/12` §5.3
   —la sucesión trabada— ya declaraba: *«lo resuelve la misma persona, junto con la marca»*, que
   **sólo es verdad si las dos se ven**.
3. **La marca tiene reloj.** `puesta_en` es lo que vuelve evaluable la salvedad 2 del `B/09` §3
   —*«lo que el barrido le aporta no es la comparación con el proveedor sino **el reloj de la
   marca**»*— y su escalamiento *«si sigue puesta pasado su plazo»*. Con un booleano no había
   *«desde cuándo»* y esa salvedad nombraba como su razón de existir un dato que no existía. Es
   `F-8cB3-005`, abierta desde la FASE 8-bis-2, cerrada acá.
4. **`requiere_conciliación` sigue siendo el nombre del predicado**, así que cada frase del corpus
   que dice *«se pone la marca `requiere_conciliación`»* sigue diciendo lo mismo; lo que gana es
   **con qué motivo**. El predicado se define en `NUCLEO/01` §2.5 y su inventario de consumidores
   está ahí.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1023, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:854, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:972, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1155

<a id="mot-2"></a>

### `MOT:2` · `COBRO_POSTERIOR_A_LA_BAJA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa), [B8a](10-corte/B8a.md#pieza-b8a) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:726`; `B/descomposicion.md:139`
- **Valor del enum**: `reconciliation_mark.motivo` = `COBRO_POSTERIOR_A_LA_BAJA`
- **`motivo`**: `COBRO_POSTERIOR_A_LA_BAJA`
- **quién abre la marca**: `S14`, desde `C2` del `B/05` §2 **y desde la comparación de cobros del `B/09` §3, sobre las filas de la primera fila del desempate del `B/05` §3** (FASE 9 vuelta 1, R4) **y desde `MP6`, cuando la transferencia llega sobre una `CANCELLED` cuya última cuota quedó `DECLARED_UNPAID`** **o sobre una `ABANDONED` de pagador manual con la primera cuota `DECLARED_UNPAID`** (lote AM): no hay cobertura con qué chocar y el `manual_payment` se cuelga acá (`B/03` §7; FASE 9 vuelta 3, owner 2026-09-30, lote AF)
- **qué tiene que hacer la persona**: confirmar el reembolso de un cobro que llegó después de cancelar
- **¿hay plata del cliente que devolver?**: **SÍ**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1024, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:726, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="mot-3"></a>

### `MOT:3` · `COBRO_POSTERIOR_AL_GRANT`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) *(asignación inferida en `cobertura.json`)* · **también**: [B9a](10-corte/B9a.md#pieza-b9a) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:149`; `B/descomposicion.md:581`
- **Valor del enum**: `reconciliation_mark.motivo` = `COBRO_POSTERIOR_AL_GRANT`
- **`motivo`**: `COBRO_POSTERIOR_AL_GRANT`
- **quién abre la marca**: `S14`, desde `C3` del `B/05` §2 **y desde la comparación de cobros del `B/09` §3, sobre las filas de la segunda fila del desempate del `B/05` §3** (FASE 9 vuelta 1, R4)
- **qué tiene que hacer la persona**: ídem, sobre un cobro posterior a un *Free Forever*
- **¿hay plata del cliente que devolver?**: **SÍ**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1025, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:149, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:581

<a id="mot-4"></a>

### `MOT:4` · `PAGO_PENDIENTE_SIN_RAMA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:581`
- **Valor del enum**: `reconciliation_mark.motivo` = `PAGO_PENDIENTE_SIN_RAMA`
- **`motivo`**: `PAGO_PENDIENTE_SIN_RAMA`
- **quién abre la marca**: la **segunda** comprobación del `B/09` §3, cuando la rama no es determinable
- **qué tiene que hacer la persona**: decidir el destino de un pago retenido por `S19` que ninguna de las seis ramas alcanzó
- **¿hay plata del cliente que devolver?**: **puede**, y es la persona quien lo decide

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1026, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:581

<a id="mot-5"></a>

### `MOT:5` · `DIVERGENCIA_DE_MONTO`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:1062`
- **Valor del enum**: `reconciliation_mark.motivo` = `DIVERGENCIA_DE_MONTO`
- **`motivo`**: `DIVERGENCIA_DE_MONTO`
- **quién abre la marca**: `S14`, desde la comparación de monto del `B/09` §3 —el monto esperado, derivado, contra `transaction_amount`, **después de 3 días de reintentar la mutación si la abrió una mutación nuestra** (`S30`, un aumento de `DEC-MP-002` o `S37`; FASE 8 completa, pendiente 7, owner 2026-09-25), **o en el acto si no** (pendiente 8, `B/09` §3 y `B/14` §2.4; residuo corregido el 2026-10-02)—
- **qué tiene que hacer la persona**: decidir qué monto vale y mutarlo o aceptarlo
- **¿hay plata del cliente que devolver?**: no, **y el cobro equivocado sigue saliendo todos los meses**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1027, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1062

<a id="mot-6"></a>

### `MOT:6` · `TRANSICIÓN_NO_DECLARADA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) *(asignación inferida en `cobertura.json`)* · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:149`
- **Valor del enum**: `reconciliation_mark.motivo` = `TRANSICIÓN_NO_DECLARADA`
- **`motivo`**: `TRANSICIÓN_NO_DECLARADA`
- **quién abre la marca**: `S14`, desde la comparación de estado del `B/09` §3 **y desde la regla 1 del `NUCLEO/03` §1** **y desde la re-vinculación rechazada del `B/09` §2.4, cuando lo que llega no es un cobro** —la mitad con cobro es el 7— (FASE 9 vuelta 1, `F-8V1B2-010`)
- **qué tiene que hacer la persona**: decidir qué estado vale y ejecutar la transición de la tabla que lo permita (`S15`)
- **¿hay plata del cliente que devolver?**: no

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1028, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:149

<a id="mot-7"></a>

### `MOT:7` · `PAGO_TARDÍO_RECHAZADO`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B7](10-corte/B7.md#pieza-b7) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:149`
- **Valor del enum**: `reconciliation_mark.motivo` = `PAGO_TARDÍO_RECHAZADO`
- **`motivo`**: `PAGO_TARDÍO_RECHAZADO`
- **quién abre la marca**: `S14`, desde el `B/05` §3 — **menos las filas de las dos primeras filas del desempate —terminales y `CANCEL_SCHEDULED` con el cobro posterior—** (FASE 9 vuelta 1, R4), que es del 2 o del 3 por la regla de desempate de ese mismo § — **y desde la comparación de cobros del `B/09` §3, sobre las filas de la tercera fila del desempate** —la lápida de recepción incluida (`B/09` §2.4, owner 2026-09-26, `G3-2`)— (FASE 9 vuelta 1, R4) (la lápida del corte y su ventana salieron: FASE 5, simplificación del corte, S-40, S-41 y S-70)
- **qué tiene que hacer la persona**: leer **cuál de las cuatro condiciones falló** y resolver
- **¿hay plata del cliente que devolver?**: **SÍ** — ver abajo, *«por qué el 7 no puede llevar «no»»*

**Texto de la fuente — «Por qué el 7 no puede llevar «no»»** (`B/02-modelo-de-datos.md:1125–1154`, sin lo tachado):

**Las cuatro condiciones del `B/05` §3 sólo fallan con el pago ya acreditado**, y eso no es una
lectura: el § se titula *«Qué hace seguro a un **pago tardío**»* y arranca *«Un pago tardío es
seguro de reactivar si y sólo si se cumplen las cuatro»*. Recorridas una por una: la **1** falla
sobre una fila `CANCELLED`, `ABANDONED` o ya `ACTIVE` —el pago existe y la fila no lo puede
recibir—; la **2** falla porque el monto **no** coincide —hay un monto, distinto—; la **3** falla
porque hay otra fila viva y el cliente *«queda pagando dos veces por la misma vertical»*; la **4**
falla porque *«hay otro pago acreditado para el mismo período: **es un doble cobro**»*. **No hay
forma de llegar a este motivo sin plata del cliente en nuestra cuenta sobre un período que no
compró.**

**Llevaba `no` y eso lo mandaba al peor de los dos desenlaces.** El listado ordena adelante los
motivos con `SÍ` porque en ellos esperar le cuesta al cliente (`B/19` §6), y
el default que `G-R1-F` exige es el de ésos: con `no`, el 7 llegaba **último y sin ninguna
propuesta**, que es el
estado que ese mismo § declara **ya fallido** —*«la persona que no sabe qué se espera de ella no
hace nada»*—. Y es literalmente el desenlace que la columna `motivo` vino a cerrar: el párrafo de
arriba dice que con un booleano *«el pago se quedaba»* porque la marca era indistinguible; sobre el
7 la marca **era distinguible y decía que no había plata**, que es peor.

**Su default es DEVOLVER, con la excepción nombrada y no tapada.** De las cuatro formas de fallar,
tres no admiten otra salida —el pago no compra nada sobre una fila terminal o ya activa, no compra
nada cuando hay otra fila viva cobrando, y no compra nada cuando el período ya estaba pago—. La
cuarta, la condición **2**, sí: si el monto de más es *«un cambio de precio no propagado»* (`B/05`
§3), lo que corresponde es **aceptarlo y reactivar**, no devolver. Eso no pide un motivo aparte,
porque **cuál de las cuatro falló va en el evento crítico** y no en el motivo (`B/05` §3,
`NUCLEO/08` §4.3), y porque el default **no ejecuta nada**: la persona confirma o se niega
(`DEC-RF-002`, `DEC-RF-003`). Lo que se elige acá es contra qué se niega.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1029, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:149, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1125

<a id="mot-8"></a>

### `MOT:8` · `REANUDACIÓN_NO_APLICADA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7) *(asignación inferida en `cobertura.json`)* · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa), [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:865`
- **Valor del enum**: `reconciliation_mark.motivo` = `REANUDACIÓN_NO_APLICADA`
- **`motivo`**: `REANUDACIÓN_NO_APLICADA`
- **quién abre la marca**: `S14`, desde la rama de fallo de `S10` **o de `S33`** (FASE 9 vuelta 1, `F-8V1B2-010`); **y la quinta comprobación** del `B/09` §3
- **qué tiene que hacer la persona**: reanudar a mano o reclamarle al proveedor — el cliente está **sin servicio y sin cobro**
- **¿hay plata del cliente que devolver?**: no

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1030, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:865

<a id="mot-9"></a>

### `MOT:9` · `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:581`
- **Valor del enum**: `reconciliation_mark.motivo` = `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`
- **`motivo`**: `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA`
- **quién abre la marca**: la **primera** comprobación del `B/09` §3
- **qué tiene que hacer la persona**: cerrar la sucesión que `S18` no cerró, antes de que el candado `A` vacío deje entrar un alta nueva
- **¿hay plata del cliente que devolver?**: no

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1031, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:581

<a id="mot-10"></a>

### `MOT:10` · `FAN_OUT_DE_GRANT_INCOMPLETO`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9a](10-corte/B9a.md#pieza-b9a) *(asignación inferida en `cobertura.json`)* · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:146`
- **Valor del enum**: `reconciliation_mark.motivo` = `FAN_OUT_DE_GRANT_INCOMPLETO`
- **`motivo`**: `FAN_OUT_DE_GRANT_INCOMPLETO`
- **quién abre la marca**: la **tercera** comprobación del `B/09` §3
- **qué tiene que hacer la persona**: reanudar `S13` / `S20` — el beneficiario **paga todos los meses algo declarado gratis**
- **¿hay plata del cliente que devolver?**: no, pero **hay un cobro que cortar**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1032, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:146

<a id="mot-11"></a>

### `MOT:11` · `ADDON_SIN_APAGAR`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) *(asignación inferida en `cobertura.json`)* · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:139`
- **Valor del enum**: `reconciliation_mark.motivo` = `ADDON_SIN_APAGAR`
- **`motivo`**: `ADDON_SIN_APAGAR`
- **quién abre la marca**: la **cuarta** comprobación del `B/09` §3
- **qué tiene que hacer la persona**: correr `A5` sobre una instancia viva cuyo título ya murió
- **¿hay plata del cliente que devolver?**: no, pero **hay un cobro que cortar**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1033, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="mot-12"></a>

### `MOT:12` · `COBRO_DURANTE_CORTESÍA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b) *(asignación inferida en `cobertura.json`)* · **también**: [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:845`
- **Valor del enum**: `reconciliation_mark.motivo` = `COBRO_DURANTE_CORTESÍA`
- **`motivo`**: `COBRO_DURANTE_CORTESÍA`
- **quién abre la marca**: `S14`, cuando el proveedor cobra **entre `S2` y la re-emisión de una cortesía diferida** (`S9`, `DEC-GRANT-007`)
- **qué tiene que hacer la persona**: confirmar el reembolso de un cobro sobre meses que `SUPER_ADMIN` había regalado (en meses desde la FASE 8 completa, `F-8CB1-001`)
- **¿hay plata del cliente que devolver?**: **SÍ** — es el riesgo que `DEC-GRANT-007` aceptó por escrito, y devolverlo es el camino que esa decisión eligió

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1034, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:845

<a id="mot-13"></a>

### `MOT:13` · `CORTESÍA_SIN_RE_EMITIR`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:581`
- **Valor del enum**: `reconciliation_mark.motivo` = `CORTESÍA_SIN_RE_EMITIR`
- **`motivo`**: `CORTESÍA_SIN_RE_EMITIR`
- **quién abre la marca**: la **sexta** comprobación del `B/09` §3
- **qué tiene que hacer la persona**: pausar la sucesora y re-emitir la cortesía diferida que `S9` no re-emitió
- **¿hay plata del cliente que devolver?**: **puede**: si ya cobró, sí; si todavía no, alcanza con re-emitirla

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1035, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:581

<a id="mot-14"></a>

### `MOT:14` · `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B10](20-fase-3/B10.md#pieza-b10) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:857`
- **Valor del enum**: `reconciliation_mark.motivo` = `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`
- **`motivo`**: `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`
- **quién abre la marca**: **`S21`**, cuando mata una suscripción de complemento **cuyo último cobro paga un período que todavía no terminó** y la instancia **no** llegó a `CANCELLED` por la causa del **15** (revisión del owner, 2026-09-28, C8) —**ni la orfandad la causó `S36` con ese cobro dentro de sus propios 10 días corridos**, que no abre marca y crea `RF1` (FASE 9 vuelta 2, owner 2026-09-27, `R1-b`)— (`B/03` §3.2, `B/16` §4.4)
- **qué tiene que hacer la persona**: decidir si se devuelve lo que queda del período — el addon se apagó el mismo día y esos días **no los va a usar nadie**
- **¿hay plata del cliente que devolver?**: **puede**: `B/16` §4.4 decidió que *«el período ya pagado no se reembolsa»* y dejó por escrito *«si en un caso concreto corresponde devolver, entra por esa vía y la confirma una persona»* — **es esa persona, y este motivo es lo que la trae**. **Y uno de los caminos que caen acá es NUESTRO, y está acá por MECANISMO y no por criterio** —`S17` (residuo visto al publicar, 2026-09-30; vale `B/03` §3.2: `S26` se retiró con la revisión del owner, 2026-09-28, C8, y el 15 es sólo la revocación)—: la transición que mata al título **no nombra su causa**, así que `S21` no tiene qué escribir (`DEC-RF-004`, la condición obligatoria; `B/03` §3.2, `B/19` §6)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1036, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:857

<a id="mot-15"></a>

### `MOT:15` · `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:857`; `B/descomposicion.md:139`
- **Adjudicación** (`adjudicacion.json`): VIVO — C8, explícito; lo tachado de la fila se omite y lo vigente va entero.
- **Valor del enum**: `reconciliation_mark.motivo` = `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`
- **`motivo`**: `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN` (el nombre, revisión del owner, 2026-09-28, C8)
- **quién abre la marca**: **`S21`**, sobre la misma población, cuando la instancia llegó a `CANCELLED` **porque se revocó el grant que era su título** —tercera cláusula de `A5`— (`B/03` §3.2) (las causas de la discontinuación salieron con la revisión del owner, 2026-09-28, C8)
- **qué tiene que hacer la persona**: confirmar el reembolso de lo que queda del período
- **¿hay plata del cliente que devolver?**: **SÍ**: **el cliente no hizo nada** y pierde días que pagó, y **la causa la conoce el acto mismo** —`S21` conoce la cláusula de `A5` que disparó—, así que `S21` escribe este motivo **sin trazar nada hacia atrás** (`DEC-RF-006`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1037, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:857, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="mot-16"></a>

### `MOT:16` · `CANCELACIÓN_SIN_CONFIRMAR`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B4](10-corte/B4.md#pieza-b4) (lee), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:724`; `B/descomposicion.md:149`; `B/descomposicion.md:583`
- **Valor del enum**: `reconciliation_mark.motivo` = `CANCELACIÓN_SIN_CONFIRMAR`
- **`motivo`**: `CANCELACIÓN_SIN_CONFIRMAR`
- **quién abre la marca**: el **barrido** (`B/09` §3, salvedades 1 y 4), **cuando pasaron 3 días desde la transición que decidió la cancelación** sin lograr confirmar la cancelación que una transición nuestra ya mandó —la fila está terminal, **o en `CANCEL_SCHEDULED` por `S11`** (owner 2026-09-25; `S26` salió con la revisión del owner, 2026-09-28, C8), y la relectura sigue viendo el preapproval `authorized`, `paused` o `pending` (`B/03` §10.1)—. **Antes de los 3 días no abre nada** (FASE 9 completa, C-R5-5: la regla es de tiempo, no de corridas): reintenta; **abierta la marca, deja de reintentar** (owner 2026-09-25) (FASE 8 completa, `F-8CB1-013`, owner 2026-09-25; `DEC-CONC-002` punto 4, su 📌)
- **qué tiene que hacer la persona**: cancelar a mano en el proveedor y **verificar releyendo por id** que quedó `cancelled`
- **¿hay plata del cliente que devolver?**: no, **pero el preapproval vivo puede cobrar**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1038, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:724, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:149, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:583

<a id="mot-17"></a>

### `MOT:17` · `CONTRACARGO`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B7](10-corte/B7.md#pieza-b7) (implementa), [B11](10-corte/B11.md#pieza-b11) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:562`
- **Valor del enum**: `reconciliation_mark.motivo` = `CONTRACARGO`
- **`motivo`**: `CONTRACARGO`
- **quién abre la marca**: **`S14`**, en el mismo acto que `P6` —y que `S6` por su tercer evento si la fila está en `ACTIVE` o `GRACE_PERIOD` **o en `PAUSED` con motivo `COURTESY`** (pendiente 8, owner 2026-09-25), **o que `S12` por su segundo evento si está en `CANCEL_SCHEDULED`** (FASE 8 completa, pendiente 6, owner 2026-09-25)—: se leyó `charged_back` en un pago acreditado, releído por id, por el aviso de contracargo o por la comprobación de pagos acreditados del `B/09` §3 (`B/03` §3.2 y §6; `DEC-SUB-020`; FASE 8 completa, `F-8CB3-009`, owner 2026-09-25)
- **qué tiene que hacer la persona**: **seguir la disputa**: si se gana (`reimbursed`, `P7`) o se pierde (`settled`), levantar la marca por `S15`; la vuelta de la persona, si la quiere, es por el checkout
- **¿hay plata del cliente que devolver?**: **no**: la plata ya volvió al cliente por su banco. **Y por eso una devolución nuestra sobre ese mismo pago no sale**: `RF2` relee el pago antes de mandarla y, contracargado, la fila va a `FAILED` (`B/03` §6.1; FASE 9 vuelta 3, `F-8V3B2-002`). ⚠️ **Documental, no medido** (`RC-8`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1039, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:562

<a id="mot-18"></a>

### `MOT:18` · `REEMBOLSO_FUERA_DEL_FLUJO`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B5](10-corte/B5.md#pieza-b5) (provee), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:1062`; `B/descomposicion.md:563`
- **Valor del enum**: `reconciliation_mark.motivo` = `REEMBOLSO_FUERA_DEL_FLUJO`
- **`motivo`**: `REEMBOLSO_FUERA_DEL_FLUJO`
- **quién abre la marca**: **`S14`**, desde la comprobación de pagos acreditados del `B/09` §3: un pago nuestro `SUCCEEDED` que el proveedor da reembolsado —o con más reembolsado que nuestros `refund`— sin que haya pasado por nuestro flujo. **No suspende**: fue un acto nuestro, no del cliente (`DEC-SUB-020`, *«lo que NO decide»*; `DEC-RF-007`)
- **qué tiene que hacer la persona**: **asentar el `refund` que falta**, con quién lo confirmó, y recién ahí corre `P3` o `P4` (`B/03` §6) — **con la acción administrativa *«asentar un cobro o una devolución que ya ocurrió por fuera»*** (`NUCLEO/08` §3, la decimocuarta), que crea la fila de `refund` directamente en `EXECUTED` por `RF4` (`B/03` §6.1) (owner 2026-09-25; FASE 9 completa, 5a y C-R7-1)
- **¿hay plata del cliente que devolver?**: **no**: la plata ya se devolvió; lo que falta es el asiento

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1040, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1062, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:563

<a id="mot-19"></a>

### `MOT:19` · `COBRO_SIN_REGISTRAR`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B5](10-corte/B5.md#pieza-b5) (provee), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:563`; `B/descomposicion.md:149`
- **Adjudicación** (`adjudicacion.json`): VIVO — reemplazos explícitos; lo tachado de la fila se omite y lo vigente va entero.
- **Valor del enum**: `reconciliation_mark.motivo` = `COBRO_SIN_REGISTRAR`
- **`motivo`**: `COBRO_SIN_REGISTRAR`
- **quién abre la marca**: **`S14`**, desde **la comparación de cobros del período del `B/09` §3**, cuando la lectura del §4 de ese capítulo ve un registro con `payment.status` = `approved` que no tenemos acreditado —sin fila de `payment`, o con la fila en `PENDING`—: **el cobro aprobado que nunca asentamos**, **sólo sobre una fila que puede recibir el cobro** (`B/05` §3, lista de lo que no se desempata) **o sobre una `GRACE_PERIOD` o `SUSPENDED` cuyas cuatro condiciones del `B/05` §3 se cumplen** (FASE 9 vuelta 1, `N-G3V-01`); sobre cualquier otra la misma comparación abre el 2, el 3 o el 7 (FASE 9 vuelta 1, R4; la lápida del corte salió: FASE 5, simplificación del corte, S-40 y S-70). **El camino de `P1` pasó al 20** (FASE 8 completa, `F-8CB3-003`, `F-8CB1-011`; `DEC-CONC-002` punto 4; partido en la pendiente 6, owner 2026-09-25). **Y cuando esa lectura es el *«cobró»* de `S6` sobre una fila en `GRACE_PERIOD` y `S5` corre, no llega acá**: `S5` asienta el cobro en el mismo acto (`B/03` §3.2; FASE 8 completa, pendiente 6, owner 2026-09-25)
- **qué tiene que hacer la persona**: **asentar el cobro**: registrarlo y decidir a qué período corresponde. **Precisado: asentarlo es crear la fila de `payment` en `PENDING` con el id del registro y correr la regla con la que esa fila recibe el cobro** —la que nombra la lista del `B/05` §3 para su estado: `S2` tras releer el preapproval (`PENDING_AUTHORIZATION`), `P1` (`ACTIVE`, `PAUSED` con el cobro anterior), `P1` con la extensión con `max` de `C2` primera fila (`CANCEL_SCHEDULED` con el cobro anterior), la retención de `S19` (predecesora en curso), o `S5`/`S7` (`GRACE_PERIOD`/`SUSPENDED` con las cuatro condiciones); `P1` a secas perdía la extensión y la retención (FASE 9 vuelta 1, `N-G3V-02`)—, y el registro del pago es el de `P1`, que emite el comprobante, escribe `covered_period` con la fecha del registro (§2.3) y avisa la cobertura (`B/03` §6), **con la acción administrativa *«asentar un cobro o una devolución que ya ocurrió por fuera»*** (`NUCLEO/08` §3, la decimocuarta; owner 2026-09-25; FASE 9 completa, 5a y C-R7-1)
- **¿hay plata del cliente que devolver?**: **no**. **Cerrado el 2026-09-25 (owner)**: el motivo se partió y el segundo camino es el 20. **Re-decidida el 2026-09-25 (orquestador, FASE 8 completa, pendiente 8)**: **la plata entró bien; lo que falta es asentarla**, así que no hay nada que devolver

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1041, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:563, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:149

<a id="mot-20"></a>

### `MOT:20` · `COBRO_DUPLICADO`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:564`; `B/descomposicion.md:726`
- **Valor del enum**: `reconciliation_mark.motivo` = `COBRO_DUPLICADO`
- **`motivo`**: `COBRO_DUPLICADO`
- **quién abre la marca**: **`S14`**, desde **`P1`** **o desde `MP6`** (la transferencia que no cae en ninguna cuota abierta, `B/03` §7; FASE 9 vuelta 3, owner 2026-09-30, lote W), cuando la cobertura del cobro choca con el `UNIQUE` de `covered_period` (§2.3): **el período ya tenía un cobro acreditado** (FASE 8 completa, `F-8CB1-011`; partido del 19 en la pendiente 6, owner 2026-09-25)
- **qué tiene que hacer la persona**: confirmar el reembolso del cobro que llegó sobre un período ya pagado
- **¿hay plata del cliente que devolver?**: **SÍ**: es un período con dos cobros acreditados, y uno de ellos no compró nada; el default es **devolver** (`B/19` §6)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1042, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:564, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:726

<a id="mot-21"></a>

### `MOT:21` · `COBRO_DEL_PERÍODO_SIN_RESOLVER`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:579`; `B/descomposicion.md:141`
- **Valor del enum**: `reconciliation_mark.motivo` = `COBRO_DEL_PERÍODO_SIN_RESOLVER`
- **`motivo`**: `COBRO_DEL_PERÍODO_SIN_RESOLVER`
- **quién abre la marca**: el **barrido** (`B/09` **§6, punto 2** — referencia corregida en FASE 9 vuelta 1, `F-8V1D1-007`), **cuando pasaron 3 días** desde el `date_created` del registro de cobro y la lectura del `B/09` §4 sigue contestando *«todavía no se sabe»* —el contador de intentos del proveedor va adelante de su listado— sobre una fila cuyo `S6` está esperando esa respuesta (`B/03` §3.2). El mismo plazo que el 16, y por la misma forma: reintentar y, a los 3 días, marcar (owner 2026-09-25; FASE 9 completa, 3d, `F-8CB3-004`)
- **qué tiene que hacer la persona**: leer el registro de cobro a mano en el proveedor y decidir si el período cobró —`S5`, asentando el cobro— o no —`S6`— por `S15`
- **¿hay plata del cliente que devolver?**: no, **pero la fila da servicio sin haber cobrado** mientras dure

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1043, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:579, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:141

<a id="mot-22"></a>

### `MOT:22` · `PAUSA_NO_APLICADA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7) · **también**: [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa), [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:864`
- **Valor del enum**: `reconciliation_mark.motivo` = `PAUSA_NO_APLICADA`
- **`motivo`**: `PAUSA_NO_APLICADA`
- **quién abre la marca**: **`S14`**, desde la rama de fallo de **`S8`, `S9` y `S32`** (owner 2026-09-25, 4a): el `PUT paused` se aceptó y la relectura sigue viendo `authorized`, así que la transición no ocurre y la fila se queda en `ACTIVE` (`B/03` §3.2; y el par `authorized` × `PAUSED` del §10.1 sin pausa confirmada) (FASE 9 completa, `F-8CB2-003`)
- **qué tiene que hacer la persona**: pausar a mano o reclamarle al proveedor; **en `S9`, avisarle a `SUPER_ADMIN` que la cortesía no se aplicó**; **y si después `S7` canceló el complemento por la regla de `S11`, la cancelación no la resuelve: la levanta una persona después de ver que el complemento ya no cobra** (FASE 9 vuelta 2, verificación, owner 2026-09-28, `V2-q`)
- **¿hay plata del cliente que devolver?**: no, **pero el proveedor sigue cobrando** a quien pidió pausar o recibió una cortesía

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1044, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:864

<a id="mot-23"></a>

### `MOT:23` · `ORDEN_PAGADA_SIN_INSTANCIA`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:712`
- **Valor del enum**: `reconciliation_mark.motivo` = `ORDEN_PAGADA_SIN_INSTANCIA`
- **`motivo`**: `ORDEN_PAGADA_SIN_INSTANCIA`
- **quién abre la marca**: **la comprobación de órdenes pagadas del `B/09` §3** (FASE 9 vuelta 2, owner 2026-09-27, `R4`): una instancia de addon `UNA_VEZ` en `ABANDONED` cuya orden, releída por id, tiene un pago aprobado —la orden se pagó y la instancia nunca llegó a `ACTIVE`—, **o, sin id de orden guardado, la que la búsqueda por el identificador del pedido encuentra pagada, si el proveedor la permite** (FASE 9 vuelta 3, owner 2026-09-30, lote E). **Es la única marca que cuelga de una instancia y no de una suscripción** (`reconciliation_mark`, §2.2): el addon de única vez no tiene suscripción (§2.3)
- **qué tiene que hacer la persona**: **asentar el cobro y devolverlo**: devolver desde el panel del proveedor y asentar las dos cosas con la acción administrativa *«asentar un cobro o una devolución que ya ocurrió por fuera»* (`NUCLEO/08` §3, la decimocuarta), que crea el `payment` colgado de la instancia y la fila de `refund` en `EXECUTED` por `RF4` (`B/03` §6.1)
- **¿hay plata del cliente que devolver?**: **SÍ**: la persona pagó y no recibió el addon, y la instancia `ABANDONED` no vuelve —ninguna transición sale de ahí—; el default es **devolver** (`B/19` §6)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1045, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:712

<a id="mot-24"></a>

### `MOT:24` · `IMPORTE_COBRADO_DE_MÁS`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B11](10-corte/B11.md#pieza-b11) · **también**: [B3](10-corte/B3.md#pieza-b3) (provee)
- **Fuente de la asignación**: `B/descomposicion.md:149`
- **Valor del enum**: `reconciliation_mark.motivo` = `IMPORTE_COBRADO_DE_MÁS`
- **`motivo`**: `IMPORTE_COBRADO_DE_MÁS`
- **quién abre la marca**: **`S14`**, desde **la comparación de cobros del período del `B/09` §3** (FASE 9 vuelta 2, owner 2026-09-27, `R20`, `F-8V2B3-001`): un registro aprobado del proveedor que tenemos acreditado y **cuyo importe cobrado es mayor que el monto esperado del período que cubre** —el de `B/14` §2.4, derivado con el precio de la versión **que rige el período que cubre el cobro (la destino, si una migración encoló su cambio para ese período; verificación corta, 2026-09-29, lote M-C)** y los aumentos vigentes a la fecha del cobro y con las promos vivas según su contador **antes** de ese cobro, redondeado con la regla única del `B/14` §1.2—. El `transaction_amount` del preapproval ya corregido no lo ve: por eso se compara el cobro y no el preapproval. **No se abre sobre un pago colgado de otra marca abierta**, que ya propone qué hacer con él entero, **ni sobre un pago que ya tuvo un 24 levantado**, y **el exceso se calcula neto de las devoluciones ejecutadas de ese pago**: el importe cobrado de un registro no cambia al resolverlo, y sin esto la comparación del día siguiente volvía a abrir el 24 con la propuesta de devolver la misma diferencia otra vez (FASE 9 vuelta 2, verificación, `N-C-02`, arreglo de texto)
- **qué tiene que hacer la persona**: confirmar la devolución **de la diferencia**: `RF1` sobre ese pago por el monto que pasa del esperado, que al ejecutarse corre **`P3` o `P4` según el acumulado, como toda devolución** (`B/03` §6.1, `RF3`; FASE 9 vuelta 2, verificación, `N-C-03`: `P3` es el reembolso total)
- **¿hay plata del cliente que devolver?**: **SÍ**: la persona pagó más de lo que costaba su período, y el período sí lo recibió; lo que sobra es sólo la diferencia. El default es **devolver la diferencia** (`B/19` §6)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1046, .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:149

## Candados: los seis cruces (`B/05` §2)

Cada candado es la sección entera de la fuente, sin lo tachado.

<a id="lock-c1"></a>

### `LOCK:C1` · C1 · Entra el pago mientras corre el proceso que suspende

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7) *(asignación inferida en `cobertura.json`)*
- **Fuente de la asignación**: `B/descomposicion.md:141`; `B/descomposicion.md:842`

**Los dos
órdenes ya no terminan en el mismo estado, y está decidido qué pasa en cada uno** (FASE 8 completa,
`F-8CD1-004`):

- Si el pago se acredita primero, la transición `GRACE_PERIOD → SUSPENDED` **ya no corresponde**
  y no se ejecuta: la tabla del capítulo 03 se reevalúa contra el estado actual, no contra el
  que el proceso leyó al empezar. **Pero si `S6` ya había mandado la cancelación** —la llamada
  sale antes de la escritura—, la fila queda `ACTIVE` con el preapproval `cancelled`, y el espejo
  del `B/03` §10.1 **la lleva a `CANCEL_SCHEDULED`** y no la corta: recibe el período que pagó y
  `S12` la termina, igual que en el otro orden. Vale lo mismo para `S3` contra `S2` (owner
  2026-09-27, FASE 9 vuelta 2, `R18`, `F-8V2B2-001`). **Con eso, una vez que la llamada de `S6`
  salió, los dos órdenes terminan en el mismo estado.**
- Si la suspensión ocurre primero, `S6` ya canceló el preapproval (`DEC-SUB-019`), así que un cobro que igual
  entra —estaba en vuelo— lleva la fila a **`CANCEL_SCHEDULED`**, no a `ACTIVE`: la persona recibe
  el período que pagó y `S12` la termina (`S7`, owner 2026-09-25). El pagador manual, que no tiene
  preapproval, sigue entrando por `S7` a `ACTIVE`.

Lo único que hay que impedir es el intermedio: el proceso que suspende **relee y reevalúa dentro
de la misma transacción que escribe**, con la versión de la fila. Si cambió, vuelve a leer.

**Texto de la fuente — «1. Los tres mecanismos, y cuándo va cada uno»** (`B/05-idempotencia-y-concurrencia.md:27–38`, sin lo tachado):

| mecanismo | para qué | cuándo NO |
|---|---|---|
| **Candado de idempotencia** | que una operación que sale hacia afuera no salga dos veces | no sirve para el caso en que la llamada salió y la respuesta se perdió — para eso está §1.2 |
| **Concurrencia optimista** | que dos escrituras locales simultáneas no se pisen | no sirve contra dos procesos que decidieron sobre datos viejos: eso lo resuelve reevaluar la transición |
| **Deduplicación por id del hecho** | que el mismo hecho del proveedor no se aplique dos veces | no sirve para hechos sin id propio |

**No hay locks distribuidos en este diseño.** Cada caso de abajo se resuelve con una restricción
de la base o con una relectura; un lock agrega un modo de falla —el que lo toma y muere— sin
resolver ninguno de los seis cruces.

**Texto de la fuente — «1.1 El candado es nuestro, va antes, y es durable»** (`B/05-idempotencia-y-concurrencia.md:39–49`, sin lo tachado):

Está medido que el proveedor **no deduplica por ningún mecanismo**: diez intentos, diez ids, y
`X-Idempotency-Key` **se acepta y no hace nada** en el alta de una suscripción (`EX-17`). El
mismo header es **obligatorio** en el reembolso (`RF-4`): **la idempotencia de este proveedor es
por endpoint y no se puede razonar de uno al otro.**

Entonces: la clave se acuña y **se persiste antes de la primera llamada**, nunca al reintentar
—si se genera en el reintento no hay nada que comparar—, y vive en la base, no en memoria del
proceso: en un despliegue conviven dos contenedores sirviendo tráfico (`DEC-CONC-001`).

**Texto de la fuente — «1.2 El caso que ningún candado cubre»** (`B/05-idempotencia-y-concurrencia.md:50–103`, sin lo tachado):

Mandamos crear, el proveedor crea **y cobra**, y la respuesta se pierde. De nuestro lado sólo
hay un timeout. Reintentar son dos cobros; no reintentar deja a alguien que pagó sin servicio.

**Sólo se resuelve preguntándole al proveedor, y no por nuestra referencia.** Su buscador
**ignora `external_reference`** (`RC-1`), así que la pregunta *«¿ya creé ésta?»* no tiene
respuesta. La que sí la tiene es **«¿este pagador tiene alguna suscripción autorizada que yo no
tenga registrada?»**, **filtrando
en el proveedor SÓLO por correo del pagador y el estado de NUESTRO lado** (FASE 8 completa,
`F-8CB3-011`, `F-8CB2-014`, `F-8CB1-014`). `RC-1` midió que `payer_email` filtra —basura → 0—,
pero que el filtro por `status` **devuelve un subconjunto en producción**: `cancelled` trajo **15
de 69** sin ninguna señal. Así que se trae lo del pagador sin filtro de estado, se descarta lo que
ya tenemos registrado por id, y el estado se filtra sobre lo que queda. ⚠️ **Lo que no está
medido**: que el filtro por `payer_email` sea **completo** en producción —el subconjunto de `RC-1`
se midió sobre el de estado—, así que **una búsqueda vacía no prueba que la suscripción no
exista**. Y la otra mitad de `F-8CB1-014` —en el modelo del checkout una creación deja un
`pending`, no un `authorized` (`PA-1`, `EX-1`)—
**Cerrado el 2026-09-25 (owner)**: la búsqueda va por `payer_email` **sin filtro de estado** y lo que vuelve
se clasifica de nuestro lado; **si aparece uno `pending`, se reusa en vez de crear otro**, que es la
regla de `B/03` §3.4 punto 4 —*«se reusa la vigente»*— (`B/09` §7; FASE 8 completa, pendiente 6, owner 2026-09-25). **Sólo si su `external_reference` nombra esta fila**, y **tras una búsqueda vacía la corrida siguiente vuelve a crear con una clave nueva**, persistida antes de llamar (§1.1): las dos reglas y los duplicados viven en `B/09` §7 (FASE 9 vuelta 1, R12, `F-8V1B2-008`).

**Todo lo de arriba vale para `/preapproval`, que ignora el header de idempotencia (`EX-17`). El
cobro de única vez por `/v1/orders` sí lo cubre un candado**: se reenvía con la misma
`X-Idempotency-Key`, acuñada y persistida antes de la primera llamada, y si la orden ya existía
vuelve la misma y hay **un solo pago** (`EX-41`, sonda 51, sandbox; `B/16` §1.4) (FASE 9
completa, contradicción 3 de `03` §R6.5: el *«sólo se resuelve preguntándole al proveedor»* de
este § era falso para las órdenes desde `EX-41`). **La clave sale del pedido del cliente y no de la
llamada, y el reenvío tiene quién lo haga** (FASE 9 vuelta 2, owner 2026-09-27, `R4`): el
identificador del pedido lo acuña la pantalla de compra y `A1` lo persiste en la instancia, único,
así que el doble clic —que el §51 pide en la primera línea de este capítulo— encuentra la instancia
que ya existe y reusa su orden en vez de mandar otra (`F-8V2B2-003`);
**`A3` sólo confirma, nunca reenvía**: el reenvío de horas después es `EX-43`, `UNKNOWN`, y no
`EX-41`, que midió el inmediato (`B/03` §8; FASE 9 vuelta 3, owner 2026-09-30, lote E). **Y la
compra tiene un candado propio más allá de la pantalla**: mientras haya una instancia del mismo
`(dueño, producto, objetivo)` en `PENDING_AUTHORIZATION`, un pedido nuevo no crea otra (`B/02`
§2.4), que es también el candado del addon recurrente contra el doble clic, que no tenía ninguno
(`EX-17`: el proveedor no deduplica). **Y en el recurrente frena también si ya hay una instancia
viva del mismo `(dueño, producto, objetivo)`**: el mismo `UNIQUE` parcial la incluye (FASE 9 vuelta 3, owner 2026-09-30, lote Y).

**Y la devolución de una orden también se serializa con la base, no con un lock**: el `POST` de
la devolución devuelve todas las de la orden y el id de la nueva sale por resta (`EX-58`), así que
dos simultáneas vuelven ambigua la resta. **Un índice parcial impone a lo sumo una devolución de la
misma orden esperando su id** —con su clave persistida y sin el id todavía escrito— (`B/02` §2.3):
la segunda no puede persistir su llamada hasta que la primera tenga su id. Una llamada que nunca
responde deja la orden esperando hasta que el barrido la reenvía con la misma clave (`B/03` §6.1
`RF2`, `B/09` §3) (FASE 5, lote de la aplicación, owner 2026-09-30, J). **La segunda, la que la
base frenó, la manda el barrido en su corrida siguiente**, cuando ya no queda ninguna de esa orden
esperando su id (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, M).

**Texto de la fuente — «4. Lo que este capítulo NO cierra»** (`B/05-idempotencia-y-concurrencia.md:544–557`, sin lo tachado):

- **El reembolso de un duplicado** lo confirma una persona (`DEC-CONC-001`) y su
  asiento es el de `B/02` §2.3, con la máquina de `B/03` §6.1 (FASE 9 completa, C-R7-5: el
  capítulo 13 no existe, se repartió).
- **La conciliación periódica** —lo que encuentra lo que estos cruces dejaron pasar— es del
  capítulo 09.
- **El de un cobro más viejo que el plazo
  del proveedor no se implementa** (`DEC-RF-007`; `RF-3` sigue `UNKNOWN`): si hay que devolverlo,
  se hace por fuera y se asienta por `RF4` (`B/03` §6.1) (FASE 9 completa, C-R7-5).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:106, .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:104, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:141, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:842, .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:27, .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:39, .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:50, .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:544

<a id="lock-c2"></a>

### `LOCK:C2` · C2 · Se pide la cancelación mientras entra un cobro

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8a](10-corte/B8a.md#pieza-b8a) · **también**: [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:143`

Está medido que **cancelar frena el cobro** (`GT-1`, verificado en producción: el sujeto
cancelado tenía su cobro agendado para el mismo instante que los otros y no cobró). Pero el
cobro puede estar ya en vuelo: el retraso del proveedor es **variable y no predecible** —33
minutos en una renovación de sandbox, ~26 en producción, ~100 segundos en un alta—.

**Decide la fecha del hecho, no la de llegada:**

| | qué se hace |
|---|---|
| el cobro es **anterior** a la cancelación | es legítimo: el cobro es **por adelantado**, así que pagó el período que va a usar. **Se extiende la fecha de fin de servicio** hasta cubrirlo —con `max` sobre la fecha vigente: una extensión **nunca acorta** (`B/03` `S11`) (`S26` salió con la revisión del owner, 2026-09-28, C8)— — `DEC-SUB-009` sostiene el servicio de nuestro lado hasta el fin del período pagado, y esto es exactamente eso |
| el cobro es **posterior** a la cancelación | no debería existir. **Se pone la marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_A_LA_BAJA`** (cap. 03 §3.2, `S14`; `B/02` §2.5) **y el cobro se cuelga de ella** (`reconciliation_mark_payment`, `B/02` §2.2); **si ya hay una abierta con ese motivo sobre la fila, el cobro se cuelga de ÉSA y no se abre una segunda** — el `UNIQUE` no rechaza el hecho, lo enruta. El reembolso lo confirma una persona (`DEC-RF-001`, `DEC-CONC-001`). Es uno de los **nueve** motivos que significan *«hay plata del cliente que devolver»* —recontados sobre la última columna del `B/02` §2.5, donde son el 1, el 2, el 3, el 7, el 12, el 15, el 20, el 23 y el 24 (el 20 desde la pendiente 6, owner 2026-09-25; el 23 y el 24 desde la FASE 9 vuelta 2, `R4` y `R20`)—, así que el listado accionable lo muestra adelante (`B/19` §6) |

> **Este motivo le gana al del §3 sobre el mismo hecho, y está escrito allá.** Un cobro que entra
> sobre una fila `CANCELLED` falla también la condición 1 del pago tardío, que mandaría a
> `PAGO_TARDÍO_RECHAZADO`; la regla de desempate —y por qué gana éste— vive en el §3, que es el §
> que cuantifica sobre *«si falla cualquiera»*.

**Las dos filas valen igual sobre una fila DE COMPLEMENTO en `CANCEL_SCHEDULED`**, la que `S11`
deja con el mismo `fin_de_servicio` de su principal (`B/03` §3.2, `R1-a`): un cobro del
complemento anterior a la baja que se acredita tarde extiende su fecha con `max`, como en la
principal. **Esa extensión no le da servicio más allá del fin de la principal**, porque sin título
el complemento no emite nada (`B/16` §4.2); lo que su cobro pagó después de esa fecha es el residuo
que `S21` toma en el motivo 14 (`B/03` §3.2, `R1-c`) (FASE 9 vuelta 2, verificación, caso 5 de
`11-` §5, arreglo de texto).

**Las dos filas presuponen que la baja dejó una fecha de fin de servicio que se pueda extender, y
eso vale para `S11` y no para las otras tres**, **ni para `S22` sobre una fila que vive del
crédito sin consumir, que va a `CANCEL_SCHEDULED` hasta el fin del crédito y cae en las dos filas
como una de `S11`** (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`). Desde `PAUSED`
(`S22`), desde `SUSPENDED` (`S23`)
y desde `GRACE_PERIOD` (`S24`)
la fila va **directo a `CANCELLED`** y su fecha de fin de servicio es el día de la cancelación
(cap. 03 §3.2), así que **no hay nada que extender** y la primera fila no tiene dónde aplicarse:

- **Desde `PAUSED` la población es casi vacía y lo que quede ya está resuelto**: mientras está
  pausada el proveedor **no cobra** —`PS-6` mide que el ciclo que vence estando pausada avanza la
  fecha sin cobrar—, y un cobro anterior a la pausa pagó el ciclo cuyos días no usados
  `DEC-SUB-010` ya se llevó **al pausar**, no al cancelar. No hay período que devolver ni que
  sostener.
- **Desde `SUSPENDED` el cobro que entra es el que `S7` o `S19` esperaban, y llega tarde.** **Y en
  un pagador con tarjeta, desde `DEC-SUB-019` eso ya no es el reciclado**: `S6` canceló el
  preapproval en el mismo acto de suspender, así que lo que puede llegar después es sólo un cobro
  que ya estaba en vuelo en el instante de `S6` — el pago manual (`MP4`) es la puerta del pagador
  manual, no la suya. La
  condición 1 del §3 rechaza `CANCELLED`, que es exactamente el tope que el cap. 03 §7.1 eligió:
  *«a partir de ahí el pago que llegue no reabre nada»*. Así que la plata está en nuestra cuenta
  sin período que darle: **se pone la marca con motivo `COBRO_POSTERIOR_A_LA_BAJA`** (`B/02` §2.5)
  —o el cobro se cuelga de la que ya esté abierta con ese motivo—
  y la devolución **la confirma una persona**
  (`DEC-RF-002`) — la segunda fila de arriba, por la misma razón y no por analogía, **y por eso el
  motivo es el mismo**.
- **Desde `GRACE_PERIOD` el cobro que entra es el reciclado del proveedor, y llega tarde.** `S24`
  canceló el preapproval *«de inmediato»* (cap. 03 §3.2), así que lo que puede entrar después es
  un cobro que ya estaba en vuelo; la condición 1 del §3 rechaza `CANCELLED` igual que arriba, así
  que **se pone la marca con motivo `COBRO_POSTERIOR_A_LA_BAJA`** —o el cobro se cuelga de la que
  ya esté abierta— y la devolución **la confirma
  una persona**. **Y acá esa persona tiene un dato que en `SUSPENDED` no tiene, que hay que
  ponerle delante y no decidir por ella**: durante el grace el cliente **sí recibió servicio**
  —el §20 lo da entero (`12-contrato…` §2.6)—, así que el período que ese cobro paga no fue
  enteramente en vano. Cuánto de él corresponde devolver **no lo fija esta tabla**: es
  exactamente la clase de juicio que `DEC-RF-002` puso en manos de una persona, y lo que el
  listado accionable tiene que mostrarle es el pago, el monto y **desde cuándo la fila estaba en
  grace**.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:129, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:143

<a id="lock-c3"></a>

### `LOCK:C3` · C3 · Se otorga *Free Forever* mientras se ejecuta un cobro

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B9a](10-corte/B9a.md#pieza-b9a)
- **Fuente de la asignación**: `B/descomposicion.md:146`

**El grant no espera.** `DEC-GRANT-001` ya decidió el caso de fondo: se corta el cobro en el
acto y **no se devuelve lo pagado**, con su riesgo declarado.

Lo que este cruce agrega es sólo el borde: si un cobro se acredita **después** de que el grant
canceló la suscripción, no debería poder ocurrir por `GT-1` — y si ocurre igual, **se pone la
marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_AL_GRANT`** (`B/02` §2.5), **con el cobro
colgado de ella** y, si ya hay una abierta con ese motivo, **colgado de ÉSA**. La diferencia con C2
es que acá **el cliente no pidió nada**, así que
un cobro posterior a un regalo es material de reembolso, no de retención.

**Y acá la repetición no es un borde: es la forma normal del caso.** `S13` *«no tiene rama de fallo
declarada: su destino es `CANCELLED` pase lo que pase con la llamada»* (`B/09` §3), así que un
*Free Forever* cuya cancelación en el proveedor no se aplicó deja al beneficiario *«pagando todos
los meses algo declarado gratis»* — **un hecho por ciclo si la cancelación sigue sin confirmarse**: el barrido la
reintenta 3 días y después abre `CANCELACIÓN_SIN_CONFIRMAR` (`B/09` §3); los cobros que entren
igual van a la misma marca (FASE 9 completa, C-R5-6: desde `F-8CB1-013` la reintenta el barrido).
Los N cobros van todos a la **misma** marca, que es lo único que hace que la persona
que la resuelve vea la deuda entera y no el primer mes.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:195, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:146

<a id="lock-c4"></a>

### `LOCK:C4` · C4 · Se compra un addon mientras se aplica un downgrade que baja su base

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b) · **también**: [B10](20-fase-3/B10.md#pieza-b10) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:142`

`DEC-SUB-008` fijó que el downgrade **muta el monto ya** y **baja los entitlements al fin del
ciclo**. Durante esa ventana el cliente conserva los beneficios viejos, así que la compra del
addon es técnicamente posible y va a quedar excedida cuando el descenso se aplique.

**Se permite, con aviso explícito.** No se bloquea, por consistencia con la decisión que ya se
tomó para el excedente: *«se avisa, no se ejecuta por sorpresa»*. El aviso dice que hay un
descenso programado para tal fecha y qué parte de lo que está comprando va a quedar fuera del
límite a partir de ahí.

Bloquear sería defendible, y se descartó por una razón concreta: el cliente que baja de plan y
compra un addon está eligiendo **exactamente** la combinación que el §10.5 propone —*«suscribirse
a un plan como Basic y posteriormente adquirir un addon compatible»*—, y bloquearlo le cierra la
puerta al camino que el propio PDR recomienda.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:217, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:142

<a id="lock-c5"></a>

### `LOCK:C5` · C5 · Un admin registra un pago manual mientras la persona paga por el proveedor

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B5](10-corte/B5.md#pieza-b5)
- **Fuente de la asignación**: `B/descomposicion.md:139`

**Es el único de los seis que produce un doble cobro con dinero real**, y por eso es el único
que se lleva a la base:

**`UNIQUE(subscription_id, período) WHERE liberado_en IS NULL` sobre `covered_period`.**

Un período de una suscripción admite **un solo pago acreditado**, y la base lo impide. El
registro manual que llega segundo **no escribe cobertura**, no compite: lo asienta `MP6` y abre `COBRO_DUPLICADO` (`03` §7; FASE 9 vuelta 3, owner 2026-09-30, lote W; residuo corregido el 2026-10-02).

> ❌ **Reformulado el 2026-09-24, porque como estaba escrito NO era implementable.** Este § decía
> *«`UNIQUE(subscription_id, período) WHERE el pago está acreditado`»* **sin decir sobre qué tabla**,
> y no hay ninguna que sirva: el escenario que el título describe enfrenta **una fila de `payment`
> contra una de `manual_payment`**, y un `UNIQUE` de Postgres **no abarca dos tablas**. El defecto
> era **independiente de la columna** `período` —que `B/02` §2.3 le agregó a `manual_payment` y que
> `payment` sigue sin tener—: **aunque las dos la hubieran tenido, dos `UNIQUE` separados no se
> excluyen entre sí**, que es justamente lo que este caso necesita.
> **La red ahora es una tercera entidad, `covered_period`** (`B/02` §2.3): el cobro sigue viviendo en
> su tabla y **lo único que se vuelve único es la COBERTURA del período**. Las dos clases de cobro
> escriben ahí al acreditarse, contra el mismo `UNIQUE`, así que la exclusión mutua **la hace la
> base** y no un chequeo — que es lo que este capítulo exige en todos lados y lo que `DEC-CONC-001`
> decidió. Es también la razón por la que **no** se unificaron las dos tablas de cobro: sus máquinas
> —`P1`-`P5` y `MP1`-`MP5`— son distintas y ninguna tenía que cambiar para cerrar esto.
> **El `WHERE liberado_en IS NULL` no es un detalle**: un reembolso **total** libera el período
> (`B/02` §2.3), y sin esa cláusula el candado le impediría a la persona volver a pagar un mes que
> se le devolvió. El parcial **no** libera. Es el mismo parcial de `reconciliation_mark`, por la
> misma razón: **liberar marca, no borra**, así que el rastro queda para la conciliación.

Además, la transición `AWAITING → REGISTERED` del capítulo 03 **no es incondicional**: antes de
registrar se relee si hay un pago del proveedor acreditado o en vuelo para ese período, y si lo
hay, no se registra y se le dice al admin por qué. La restricción es la red; la relectura es
para que el admin entienda lo que pasó en vez de ver un error.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:233, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:139

<a id="lock-c6"></a>

### `LOCK:C6` · C6 · Dos instancias procesan el mismo evento en paralelo

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3) · **también**: [B5](10-corte/B5.md#pieza-b5) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:137`

Lo resuelve `UNIQUE(proveedor, id_del_hecho)`: la segunda instancia falla al insertar. **Sin lock y sin coordinación.**

**Pero fallar al insertar no es «no hacer nada»: el mismo id puede traer OTRO estado** (FASE 8
completa, `F-8CB3-003`). Un cobro rechazado queda `PENDING` (`B/12` §1.3) y su reintento se aprueba
**dentro del mismo registro, con el mismo id** (`B/09` §4). Si el choque se leyera como duplicado,
`P1` no corría nunca y la plata quedaba sin asiento, sin `covered_period` y sin comprobante. Así
que **ante el choque se relee la fila existente**: si está `PENDING` y la lectura por id dice
`approved`, **corre `P1` sobre ESA fila** (`B/03` §6); si ya estaba `SUCCEEDED`, era un duplicado
de verdad y no se hace nada. Las dos instancias paralelas siguen sin coordinarse: la escritura de
`P1` sobre la fila usa la concurrencia optimista del cap. 03 §10.3, y la segunda que llegue
encuentra el `SUCCEEDED`. **Y si el cobro aprobado lo ve primero el barrido y no un evento**, no lo
escribe él: abre la marca `COBRO_SIN_REGISTRAR` (`B/02` §2.5, `B/09` §3) **sobre una fila que la
lista del §3 da por receptora; sobre otra, el motivo que asigna la tabla de desempate del §3** (la lápida del corte y su ventana
salieron: FASE 5, simplificación del corte, S-40, S-41 y S-70) — **salvo cuando lo ve la
relectura de `S6` y corre `S5`, que lo asienta en el mismo acto**: lo lee por id y corre `P1`,
creando la fila si no existe, y **el aviso que llegue después es justamente el duplicado que este
cruce descarta**, porque encuentra la fila ya `SUCCEEDED` (`B/03` §3.2; FASE 8 completa, pendiente 6, owner 2026-09-25).

Con tres advertencias medidas:

- **No alcanza con deduplicar por tipo de evento**: un reembolso emite **tres notificaciones en
  dos formatos distintos para el mismo hecho** (`RF-7`).
- **Un evento sin id propio no se puede deduplicar así.** Para esos vale la regla del capítulo
  03 §10.1: el evento es un aviso, se relee el recurso, y procesarlo dos veces da el mismo
  resultado.
- **Las dos instancias pueden correr en el mismo medio segundo**, y por eso lo que las separa es la
  base y no una consulta previa del tipo *«¿ya lo tengo?»*: el proveedor manda el duplicado de un
  aviso a ~0,5 s (`WH-1`), y un `payment` llega además por IPN a milisegundos del de Webhooks
  (`WH-6`). **El de IPN no entra a este cruce**: se guarda sin procesar (`B/06`, *«lo que este
  capítulo NO cierra»*), así que el único duplicado que se procesa es el de Webhooks (mediciones del
  2026-09-29, punto 3).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:266, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:137

## El proveedor falso: mentiras medidas y reglas propias (`B/20` §3.2)

### El proveedor falso: mentiras medidas y reglas propias (`B/20` §3.2) — «Las mentiras medidas: la lista cerrada»

Texto de `B/20-testing.md:499–521`, sin lo tachado:

**Son trece, recontadas sobre la tabla.** **M8 cumple `G15` con `EX-51`** (revisión del owner, 2026-09-28, C13; residuo
corregido el 2026-10-02 con el triage de los abiertos de la spec consolidada).

### El proveedor falso: mentiras medidas y reglas propias (`B/20` §3.2) — «Las reglas propias de Mercado Pago: otra lista»

Texto de `B/20-testing.md:522–553`, sin lo tachado:

No son mentiras: el proveedor **exige** algo y lo dice. El falso las cumple igual, y la batería del
§4 las vigila igual, porque si una deja de ser cierta el código queda defendiéndose de una regla
que ya no existe. **Y desde los casos vecinos (2026-09-29, caso 28) la lista lleva también el
comportamiento medido** que no es mentira ni regla que el proveedor exija, pero que el barrido de
`B/09` y `S6` por su segundo evento necesitan que el falso reproduzca: `RP7` a `RP11`, marcadas
como comportamiento medido en la columna; **y `RP12`**, que necesita el receptor (mediciones del
2026-09-29, punto 4).

**Son doce, recontadas sobre la tabla**: las seis filas de la tabla vieja que no eran
mentiras, y las cinco de comportamiento medido que quedaban afuera de las dos listas (revisión del
owner, casos vecinos, 2026-09-29, caso 28), y `RP12`, el `payment` de validación de ARS 0 que el
receptor tiene que ignorar (`B/03` §10.2), que entra por la misma regla del caso 28 (mediciones del
2026-09-29, punto 4).

## Mentiras medidas, M1–M13 (`B/20` §3.2)

<a id="m-m1"></a>

### `M:M1` · `M1`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: dice «ok» a un cambio y **no lo aplica**: el ciclo, el plan, la fecha de cobro, la prueba gratis y la baja programada de una suscripción viva; y al crear, el campo `items` devuelve `201` y se descarta
- **de dónde sale (fila, fecha, cuenta)**: `EX-4` (2026-09-15, sandbox, re-verificada en producción) · `EX-21` (2026-09-15, sandbox) · `EX-34` (2026-09-16, sandbox) · `EX-35` (2026-09-16, sandbox) · `CN-1` (2026-09-15, sandbox y producción) · `EX-5` (2026-09-15, sandbox)
- **qué defensa obliga a probar**: que toda mutación se verifica releyendo (`D5`, §6)

**Texto de la fuente — «3. El proveedor falso tiene que mentir»** (`B/20-testing.md:466–467`, sin lo tachado):

La sección no tiene texto vigente fuera de su título.

**Texto de la fuente — «3.1 La tesis»** (`B/20-testing.md:468–481`, sin lo tachado):

El §62.2 dice que *«la gran mayoría de escenarios se prueba contra provider falso/controlado»* y
no dice **cómo se comporta** ese falso. Si se lo escribe con el comportamiento razonable —acepta y
aplica, rechaza y explica, avisa cuando algo cambia— **se está probando el código contra un
proveedor que no tenemos.**

El capítulo 06 (épica de billing) y la matriz midieron lo contrario, repetidamente: **este
proveedor acepta y no aplica, responde `2xx` sobre operaciones que descarta, y avisa de cosas que
sus propios datos desmienten.**

> **El stub no simula al proveedor: reproduce sus mentiras medidas.** Cada una está fechada y con
> su fila; ninguna es una hipótesis sobre cómo podría fallar.

**Texto de la fuente — «3.2 Las mentiras que el stub tiene que poder hacer»** (`B/20-testing.md:482–498`, sin lo tachado):

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

**Texto de la fuente — «Lo que el falso simula sin haberlo medido, aparte»** (`B/20-testing.md:554–565`, sin lo tachado):

**No es una mentira medida y se marca como simulación en el código**: existe para probar un caso
de red, no porque el real lo haga a propósito. Hoy son tres: **el proveedor crea y cobra pero la
respuesta se pierde en el camino**; **la red cortada**; y **los avisos fuera de orden**, que
`WH-3` **no observó** (`PARTIALLY_SUPPORTED`: las entregas llegaron en orden causal en tres
corridas), así que no pueden ser una mentira de la lista aunque el código tenga que resistirlos
(la presentación los ponía entre las mentiras, y se corrige al publicarla: revisión del owner,
casos vecinos, 2026-09-29, caso 29).
`G15` no cuenta las simulaciones como mentiras, y una simulación tampoco puede estar prendida por
defecto sin decirlo.

**Texto de la fuente — «Lo que no se simula»** (`B/20-testing.md:566–571`, sin lo tachado):

**Los correos que Mercado Pago le manda al cliente** (`EX-3`): no pasan por nuestro código, así que
no hay nada del lado nuestro que un falso pueda ejercitar. Se cubren con nuestros propios correos,
que salen antes (`DEC-MAIL-001`, `B/19` §4).

**Texto de la fuente — «Dónde quedó cada fila de la tabla vieja»** (`B/20-testing.md:572–617`, sin lo tachado):

| | | dónde quedó (revisión del owner, 2026-09-28, C13) |
|---|---|---|
| | | M5 |
| | | M2 |
| | | M1 |
| | | RP6 |
| | | M1 |
| | | M4 |
| | | M10 |
| | | RP1 |
| | | M8 |
| | | no se simula (arriba) |
| | | RP5 |
| | | RP2 |
| | | M13 |
| | | RP3 |
| | | RP4 |

**Y entraron a la lista de mentiras seis que la tabla no tenía**: el duplicado por pedido igual
(M3), los avisos perdidos y repetidos (M6), el rechazo contado como cobro (M7), la prueba gratis que
se agrega sola (M9), el enlace que no vence (M11) y la pausa que no se reanuda (M12).

**Cerrado en su mayor parte** (revisión del owner,
2026-09-28, C13): `RC-5`, `RC-6` (M7) y `WH-1`, `WH-2`, `WH-5` (M6) están en la lista.
**Cerrado entero**
(revisión del owner, casos vecinos, 2026-09-29, caso 28): esas cinco van a la segunda lista como
comportamiento medido, `RP7` a `RP11`.

**El retraso variable del cobro merece su propia línea** porque es el que más código rompe: un
test cuyo cobro llega en el mismo instante en que vence el período **nunca ejecuta** el camino que
en producción se recorre siempre. El stub tiene que poder llegar tarde, y la suite tiene que
tener casos donde llega tarde.

**Texto de la fuente — «3.3 Y de ahí sale qué es un escenario de carrera»** (`B/20-testing.md:618–627`, sin lo tachado):

El §62.1 pide cubrir *«races»* sin decir cuáles. Los seis cruces de concurrencia ya están
enumerados en el capítulo 05 (épica de billing), y la lista de arriba agrega los que sólo existen
porque el proveedor se comporta así: el cobro que llega después de suspender, la mutación que se
acepta y no se aplica, el webhook que no llega nunca, y el cliente que recibe el correo del
proveedor **antes** que el nuestro.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:503, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:466, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:468, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:482, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:554, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:566, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:572, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:618

<a id="m-m2"></a>

### `M:M2` · `M2`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: con **dos cambios en un pedido**, aplica uno y descarta el otro con un solo `200`
- **de dónde sale (fila, fecha, cuenta)**: `EX-20` (2026-09-15, producción)
- **qué defensa obliga a probar**: que la relectura compara **campo por campo** cada campo que se mandó

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:504, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m3"></a>

### `M:M3` · `M3`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B3](10-corte/B3.md#pieza-b3) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: crea **un duplicado por cada pedido igual**
- **de dónde sale (fila, fecha, cuenta)**: `EX-17` (2026-09-15, sandbox y producción, sonda 14: diez pedidos, diez ids)
- **qué defensa obliga a probar**: el candado propio contra duplicados, persistido antes de llamar (`D4`, `DEC-CONC-001`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:505, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m4"></a>

### `M:M4` · `M4`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: el buscador **devuelve una parte sin error** (15 de 69 con `status=cancelled`) e **ignora nuestra referencia**; y trae menos campos que la lectura por id
- **de dónde sale (fila, fecha, cuenta)**: `RC-1` (2026-09-15, sandbox y producción) · `RC-4` (2026-09-15, producción)
- **qué defensa obliga a probar**: que el buscador nunca se usa como lista (`D6`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:506, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m5"></a>

### `M:M5` · `M5`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: un **cambio de monto no emite ningún aviso**
- **de dónde sale (fila, fecha, cuenta)**: `EX-15` (2026-09-15, sandbox, **por el canal Webhooks**; y 2026-09-29, sandbox, **con los dos canales escuchando**: tampoco por IPN; mediciones del 2026-09-29, punto 2)
- **qué defensa obliga a probar**: que la conciliación compara el monto releído (`B/09` §3)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:507, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m6"></a>

### `M:M6` · `M6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B5](10-corte/B5.md#pieza-b5) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: **avisa tarde, repetido o nunca**; una devolución genera **tres entregas en dos formatos**
- **de dónde sale (fila, fecha, cuenta)**: `WH-1`, `WH-2`, `WH-4` (2026-09-15, sandbox) · `WH-5` (2026-09-23, sandbox y producción; cerrada el 2026-09-29 con los dos canales) · `RF-7` (2026-09-15, producción) · **`WH-6` (2026-09-29, sandbox y producción): un mismo `payment` llega una vez por cada canal, y el de IPN lo guarda el receptor sin procesarlo** (`B/06`, «NO cierra»; mediciones del 2026-09-29, punto 3)
- **qué defensa obliga a probar**: que un aviso nunca cambia un estado por sí solo (`D17`, `G17`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:508, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m7"></a>

### `M:M7` · `M7`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) *(asignación inferida en `cobertura.json`)* · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: **cuenta un cobro rechazado como cobro**, y el estado del intento no dice si cobró
- **de dónde sale (fila, fecha, cuenta)**: `RC-5` y `RC-6` (2026-09-22, producción)
- **qué defensa obliga a probar**: que «¿cobró?» se contesta mirando cada intento (`B/09` §4)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:509, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m8"></a>

### `M:M8` · `M8`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: **cobra tarde y en tandas**: en el primer lote posterior a la hora de la fecha, al minuto `:02`
- **de dónde sale (fila, fecha, cuenta)**: `PA-3` (2026-09-15; ~26 min en producción, 33 en sandbox) · **`EX-51` (2026-09-24, producción; fila abierta el 2026-09-28 con OK del owner, revisión del owner, C13)** *(residuo corregido el 2026-10-02 con el triage de los abiertos de la spec consolidada: la fila existe, `06-mp-validation-matrix.md`, `EX-51`)*
- **qué defensa obliga a probar**: que nada supone que el cobro entra a la hora exacta (abajo)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:510, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m9"></a>

### `M:M9` · `M9`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: **agrega sola una prueba gratis** cuando el primer cobro es a futuro
- **de dónde sale (fila, fecha, cuenta)**: `EX-8` (2026-09-15, sandbox) · `EX-26` (2026-09-15, sandbox) · `EX-33` (2026-09-16, producción)
- **qué defensa obliga a probar**: que no se confía en su estado de prueba (`D12`, `G11`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:511, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m10"></a>

### `M:M10` · `M10`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: devuelve el **enlace de pago roto**
- **de dónde sale (fila, fecha, cuenta)**: `EX-37` (2026-09-16, producción; error abierto de su lado)
- **qué defensa obliga a probar**: que el enlace se sanea siempre antes de mostrarlo (`D10`, `G10`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:512, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m11"></a>

### `M:M11` · `M11`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B3](10-corte/B3.md#pieza-b3) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: un **enlace de pago abierto no vence**
- **de dónde sale (fila, fecha, cuenta)**: `EX-1` (2026-09-23, staging)
- **qué defensa obliga a probar**: que los enlaces los vencemos nosotros (`S3`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:513, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m12"></a>

### `M:M12` · `M12`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B8b](20-fase-2/B8b.md#pieza-b8b) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: una **pausa no se reanuda sola**
- **de dónde sale (fila, fecha, cuenta)**: `PS-4` (2026-09-16, sandbox)
- **qué defensa obliga a probar**: el reloj propio de fin de pausa (`S10`, `DEC-SUB-010`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:514, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="m-m13"></a>

### `M:M13` · `M13`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B6](10-corte/B6.md#pieza-b6) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué hace el falso a propósito**: contesta **«no se puede devolver»** (`2084`) cuando sí se puede
- **de dónde sale (fila, fecha, cuenta)**: `RF-8` (2026-09-15, producción: ARS 5 rechazado, ARS 14 aceptado sobre el mismo pago)
- **qué defensa obliga a probar**: el reintento partiendo el monto, que nunca pasa del confirmado (`B/06` §4.6 punto 5)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:515, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

## Reglas propias y comportamiento medido, RP1–RP12 (`B/20` §3.2)

<a id="rp-rp1"></a>

### `RP:RP1` · `RP1`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: el token de tarjeta es de **un solo uso**
- **fila**: `EX-12`

**Texto de la fuente — «4. La suite de sandbox es chica, y prueba otra cosa»** (`B/20-testing.md:628–650`, sin lo tachado):

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

**Texto de la fuente — «4.1 La batería que vigila a Mercado Pago»** (`B/20-testing.md:651–705`, sin lo tachado):

(Revisión del owner, 2026-09-28, C13 y `L3-d`.) La suite de arriba **no tenía cadencia, ni
producción, ni comparación de forma, ni quién avisara si no corría**. Desde esta revisión es una
batería con esas cuatro cosas, y **la construye `B1`**, con el falso y sus dos listas:

1. **Qué corre**: **cada medición de las dos listas del §3.2**, las trece mentiras y las doce reglas propias y comportamientos medidos (caso 28; `RP12`, mediciones del 2026-09-29, punto 4): hace el pedido, **relee por id** y compara el resultado con lo que la fila dice
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
   Es registro, no decisión: cómo se tratan los dos canales de avisos
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

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:534, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:628, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:651

<a id="rp-rp2"></a>

### `RP:RP2` · `RP2`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B6](10-corte/B6.md#pieza-b6) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: `X-Idempotency-Key` es **obligatoria** en el reembolso y falla **antes** de toda validación de negocio
- **fila**: `RF-4`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:535, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp3"></a>

### `RP:RP3` · `RP3`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B2](10-corte/B2.md#pieza-b2) (implementa), [B9b](20-fase-2/B9b.md#pieza-b9b) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: piso **ARS 15**, techo **ARS 2.000.000**, con los mensajes exactos
- **fila**: `PC-2`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:536, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp4"></a>

### `RP:RP4` · `RP4`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B2](10-corte/B2.md#pieza-b2) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: **otra moneda** da `400`
- **fila**: `EX-18`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:537, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp5"></a>

### `RP:RP5` · `RP5`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: el reembolso idempotente devuelve **`200` y no `201`**, con **cuerpo vacío**
- **fila**: `RF-6`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:538, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp6"></a>

### `RP:RP6` · `RP6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: **estando pausada rechaza toda modificación** con `400`, pero sí deja cancelar
- **fila**: `EX-11`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:539, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp7"></a>

### `RP:RP7` · `RP7`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: *comportamiento medido*: cada cobro tiene **una ventana de vida**, `expire_date`, y la trae cada renovación
- **fila**: `RC-7` (2026-09-22, producción)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:540, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp8"></a>

### `RP:RP8` · `RP8`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) · **también**: [B7](10-corte/B7.md#pieza-b7) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: *comportamiento medido*: un ciclo fallido lleva **cuatro intentos dentro del mismo registro de cobro**, y al vencer la ventana **el proveedor pausa**
- **fila**: `GR-3` (2026-09-22, producción)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:541, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp9"></a>

### `RP:RP9` · `RP9`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: *comportamiento medido*: **una pausada no cobra**
- **fila**: `PS-2` (2026-09-15, producción)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:542, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp10"></a>

### `RP:RP10` · `RP10`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: *comportamiento medido*: al reanudar, **la fecha de cobro avanzó sin cobrar**
- **fila**: `PS-6` (2026-09-16, sandbox y producción)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:543, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp11"></a>

### `RP:RP11` · `RP11`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) *(asignación inferida en `cobertura.json`)* · **también**: [B11](10-corte/B11.md#pieza-b11) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: *comportamiento medido*: **`last_charged_date` es la del último intento, no la del último cobro**, y `last_charged_amount` no coincide con `charged_amount`
- **fila**: `RC-5` (2026-09-22, producción; precisada el 2026-09-24)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:544, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="rp-rp12"></a>

### `RP:RP12` · `RP12`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1) *(asignación inferida en `cobertura.json`)* · **también**: [B5](10-corte/B5.md#pieza-b5) (implementa)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **qué exige el proveedor (o, desde el caso 28, cómo se comporta, medido)**: *comportamiento medido*: **cambiar la tarjeta emite un `payment` de ARS 0 con `operation_type: card_validation`**, por los dos canales, sin `external_reference` y sin nombrar al preapproval, `rejected` si la tarjeta nueva no pasa; y autorizar deja otro igual en producción
- **fila**: `EX-36` (2026-09-29, sandbox) · `PA-3` (2026-09-15, producción)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:545, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

## Guards (`V/20` §2 y `B/20` §2)

### Dónde corren los guards (`V/20` §1) — «1. Las cuatro capas»

Texto de `V/20-testing.md:27–42`, sin lo tachado:

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

### Guards de `V/20` §2 — «2. Los guards, en un solo lugar»

Texto de `V/20-testing.md:43–351`, sin lo tachado:

Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

**`G-R6` llega a este catálogo por una columna concreta y no por simetría, y conviene decir cuál.**
Nació en `B/20` §2 acotado a las seis tablas de billing, porque el crítico que lo motivó era de
billing: `MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura del corpus
avanzaba esa columna**, así que el pagador manual pagaba una vez en la vida y seguía cubierto para
siempre (`F-8eB1-002`). La ampliación no se pide porque *«también podría pasar acá»* —eso vale para
cualquier guard— sino porque **acá vive el candidato más fresco del corpus**: `listing.inactiva_desde`,
la columna que `DEC-DATA-002` creó **el mismo día** que esta decisión, con **cuatro escritores** y
**cinco consumidores** —hoy **cinco hechos más la escritura del corte** (revisión del owner, 2026-09-28, C8: sale el 4) y **seis consumidores**
(FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, `F-8CD1-009`, owner 2026-09-25; el sexto hecho, FASE
9 completa, 5b)— (cap. 02 §2.5, que
enumera las dos listas y las cierra). Y sobre todo: **lo
que esa columna decide es el borrado irreversible del contenido de una ficha** — `PB4` archiva en
`inactiva_desde + 90` y el hard delete borra en `inactiva_desde + 180` (cap. 02 §4.1). En billing la
clase costó dinero; **acá cuesta datos sin vuelta**, y ésa es la diferencia que justifica la fila.

**Y hay que decir qué NO afirma el guard sobre esta columna, porque los cinco escritores
no son cinco transiciones.** El predicado es *«al menos una transición la escribe»*, y
de los cinco hechos de reinicio del cap. 01 §1.2 (núcleo) **sólo el tercero** —la ficha
vuelve a `PUBLISHED` por `PB1`, `PB3` o `PB7`— es una transición entera, **y el
quinto lo es a medias**: sobre la ficha publicada lo ejecuta la primera rama de `PB2`
(`F-8CA2-001`), y sobre las demás fichas del dueño en la vertical el recálculo que el aviso
despierta **o el reconciliador diario de cobertura** (`DEC-ARCH-009`), que no son transiciones (FASE 8 completa, owner 2026-09-25); **y el sexto** —se levanta la moderación— **es una transición entera, `PB11`** (FASE 9 completa, 5b). El primero se lee del registro de
eventos de dominio y el segundo de la respuesta del contrato (el cuarto salió con la revisión del owner, 2026-09-28, C8); la escritura del corte es de la migración. Así que sobre
`inactiva_desde` el guard queda **verde por cualquiera de los tres** —`PB1`/`PB3`/`PB7`,
`PB2` **o `PB11`**—, sin mirar **a los dos ejecutores —el recálculo y el reconciliador diario— de** la otra mitad del quinto, y lo que
certifica es *«alguien la mueve»*, nunca *«los cinco hechos la escriben»*. Es el §2.1
aplicado a su propio mensaje: el texto con que falla no puede afirmar más de lo que el predicado
verifica. **Que los otros dos escritores estén es lo que vigila el cap. 02 §2.5**, que los enumera
y declara la lista cerrada, y no este guard.

**Y esa lista cerrada dejó de ser la única vigilancia: desde la tercera enmienda de `DEC-TEST-001`
lleva guard propio, `G-R6-B`.** El párrafo de arriba es su motivo entero — si `G-R6` queda verde
por un escritor de seis, **a los otros cinco no los mira nadie** y lo único que los sostiene es la
enumeración del cap. 02 §2.5. **Una lista cerrada sin guard es una promesa que en este programa ya
se rompió una vez**: `DEC-TEST-001` lo dice con el caso —*«la única lista que existía quedó corta
en el mismo commit que creó su sexto miembro»*— y acá lo que la lista sostiene no es un conteo,
es **el borrado irreversible del contenido de una ficha**.

**Su papel es el de `G-R1-E` y su forma también, que es por qué es una letra de `R6` y no un
racimo nuevo.** `G-R1-E` ancla su segunda mitad en un inventario —*«un consumidor nuevo no figura
en la lista»*— porque ahí **ningún grep sustituye la cuenta**: una pieza nueva **no aparece
buscando el término viejo**, así que lo único que lo detecta es que la lista tenga una fila menos
que las piezas. Desde la cuarta enmienda la coincidencia es literal: **la mitad (b) de este guard
es la mitad de `G-R1-E`**, sobre otro inventario. El precedente de la letra es `G-R1-F`, que entró
como sexto de `R1` **con un sujeto distinto del racimo** —la marca y no `sucede_a`— porque el daño
estaba pegado al de sus hermanos. Acá es lo mismo: el sujeto de `R6` son *«las columnas que una
condición lee»* y el de éste es **quién toca una columna, escribiéndola o leyéndola**, pero la
columna es la misma, el día es el mismo, y `G-R6` **ya declaró por escrito que no lo cubre**.

**Vigila las DOS mitades de esa lista y, sobre la de lectores, las DOS DIRECCIONES: son tres
predicados.** La cuarta enmienda de `DEC-TEST-001` le sumó los **consumidores** al mismo guard, y el
argumento no es la simetría: **las dos mitades fallan distinto y la segunda falla peor**. Un
escritor fuera de la lista **mueve el reloj** cuando no corresponde — grave, y todavía reparable
mientras la ficha exista. Un consumidor que nadie registró **lee el reloj y decide con él**, y el
consumidor más caro de esta columna **es el hard delete del día 180** (cap. 02 §4.1): un lector no
inventariado es **un lugar que borra contenido sin que la lista sepa que existe**. Es además la
mitad que el precedente ya cubre — `G-R1-E` vigila exactamente eso para los inventarios del núcleo.
La tercera, *(c)*, es esa misma mitad leída al revés y entró en esta pasada; su razón está cuatro
párrafos más abajo.

**El mensaje dice QUÉ MITAD falló, y la condición no es cosmética: es el §2.1 sobre este mismo
guard.** Un guard que vigila varias cosas y falla con un solo texto **afirma más de lo que su
predicado verificó en esa corrida** —el que lo lee no sabe si le sobra un escritor, si le falta una
fila de lectores o si se le fue un lector declarado, que son tres arreglos distintos en dos
capítulos distintos—, y es **la misma regla con la que `DEC-TEST-001` rechazó el segundo guard** que
evaluó. Sin mensaje diferenciado, la enmienda que agrega la mitad se contradice con la entrada que
la contiene. Así que son **tres predicados con tres textos**, en un guard con un id.

**Se rompe a propósito tres veces, una por predicado, y cada una tiene que dar SU mensaje.** *(a)*
**Ese caso dejó de ser un rojo**: desde la FASE 8 completa
la escritura de `PB2` en su primera rama **es** el hecho 5 del cap. 01 §1.2 (núcleo) (`F-8CA2-001`,
`F-8CA3-001`, owner 2026-09-25), y la razón que la prohibía —*«corre el día 90 y el día 180 hacia
adelante en cada caída»*— era la dirección correcta: sin ella el borrado caía hasta 90 días antes.
**El rojo de *(a)* se prueba ahora con la otra rama de la misma transición**: se le agrega la
escritura a **la rama del excedente de `PB2`**, que baja la ficha **con la cobertura verdadera**
y por eso no es ningún hecho — y el rojo tiene que decir *«escritor fuera de la lista»* aunque la
misma transición escriba legítimamente en su otra rama, que es lo que prueba que el guard cuenta
hechos y no ejecutores. **Y la prueba sigue valiendo después de que el hecho 5 pasara a alcanzar
todas las fichas del dueño** (FASE 8 completa, owner 2026-09-25), revisada y no supuesta: la
ficha excedente **sí** recibe ahora el hecho 5, pero **cuando el dueño pierde la cobertura**, y se
lo escribe el recálculo que el aviso despierta; la rama del excedente de `PB2` corre con `cubierto`
verdadero, así que en **su** instante no ocurrió ningún hecho y su escritura sigue fuera de la
lista. Queda, además, más filosa: la misma ficha puede recibir una escritura legítima de un
ejecutor y una ilegítima de otro, y el guard tiene que distinguirlas **por el hecho**, no por la
ficha ni por la columna. *(b)* Se le agrega un **lector** que la lista no nombra —el
caso barato es una superficie que quiera mostrar *«hace cuánto está inactiva»*— **sin** su fila en
el cap. 02 §2.5. *(c)* Se le **saca la lectura al día 180** dejando su fila intacta en el cap. 02
§2.5. Las tres tienen que poner el guard en rojo, y **un rojo de una con el texto de otra es el
guard fallando su propia condición**: se prueba mirando el texto, no el exit code.

**Y hay que decir lo que sigue SIN verificar, porque se lee de más.** **No verifica que los
cinco hechos tengan quien los ejecute**, que es justo la mitad que `G-R6` deja abierta.
Comprobarlo pide que cada escritura **declare cuál de los cinco ejecuta**, y un guard estático sólo puede comprobar
que la declaración **esté**, nunca que sea cierta — que es **exactamente la forma que
`DEC-TEST-001` rechazó** para el segundo guard de esa decisión. Así que `G-R6` y `G-R6-B` juntos
certifican *«alguien la mueve»*, *«nadie de más la mueve»* y *«nadie de más la lee»*, **nunca *«los
cinco la mueven»***: quitarle la escritura a uno de los cinco —al recálculo del hecho 2, por
ejemplo, que el cap. 02 §4.2 regla 4 declara **en cuatro momentos y no en uno**— deja a los dos en
verde.

**Y la mitad que falta NO es la misma en las dos listas, que es lo que esta pasada separa.** El
renglón de acá decía que ninguna de las dos comprueba que sus miembros declarados **existan**, y la
simetría no se sostiene:

- **Para escritores es la forma rechazada y sigue rechazada.** Comprobar que un hecho tenga quien lo
  ejecute pide que cada escritura **declare cuál de los seis ejecuta**, y un guard estático sólo
  puede comprobar que la declaración **esté** — exactamente el segundo guard que `DEC-TEST-001`
  rechazó. Queda afuera **del catálogo de guards**, con su razón — **y desde `DEC-TEST-002` la
  cubre un criterio de terminación**, que no es un guard y por eso la objeción no lo alcanza: lo
  contesta una persona al declarar lista la unidad (`descomposicion.md` §4, con el desarrollo en
  `B/descomposicion` §4).
- **Para lectores es un HECHO comprobable y entra: es la mitad *(c)*.** *«El día 180 no lee
  `listing.inactiva_desde`»* es un rojo verificable **sin pedirle a nadie que declare nada** —se
  mira si la lectura está, igual que la mitad *(b)* mira si sobra una—, que es el mismo criterio con
  el que esa decisión aceptó este guard y rechazó el otro. La mitad quedó afuera por analogía con un
  caso que no es el mismo.

**Y la dirección importa, porque es la que se paga con contenido.** La *(b)* atrapa a un lector que
nadie inventarió; la *(c)* atrapa a un lector inventariado que **desapareció** — y el día que el hard
delete del día 180 deje de leer la columna, por un refactor, un rename o una reescritura del
cálculo, **el guard seguía verde y la lista seguía diciendo que ese lector está ahí**. Es el patrón
*«un inventario que afirma completitud sin tenerla»* aplicado a la defensa del único acto
irreversible del programa. **Se rompe a propósito sacándole al día 180 su lectura de la columna sin
tocar el cap. 02 §2.5**, y el rojo tiene que decir *«lector declarado que ya no lee»* y nombrarlo.

**Y `G-R6-B` sigue sin afirmar nada sobre ejecutores, con tres mitades igual que con dos.** La
*(c)* cuenta **lecturas**, no actos: que el hecho 2 tenga sus cuatro ejecutores (`V/02` §4.2, regla 4)
no lo verifica este guard ni ningún otro, y decirlo acá es lo que impide que las tres mitades se
lean como *«la lista entera está vigilada»*.

**Y `B/20` §2 lo repite como referencia cruzada por la razón de `G-R5` y no por simetría**: lo que
puede romperlo se escribe **en la otra épica**. Un lugar medido (el otro, `B/10` §4.3 con el cuarto hecho, salió con la revisión del owner, 2026-09-28, C8): `B/03` §7.1 apoya el
tope de la reapertura en que la lista **sea** cerrada —*«`DEC-DATA-002` le puso a la inactividad
cuatro hechos de reinicio con lista cerrada»* —hoy **cinco** (el sexto, FASE 9 completa, 5b; el 4 salió con la revisión del owner, 2026-09-28, C8)—, y de ahí sale que el tope *«ya no es monótono»*—.
Un escritor **nuevo** agregado desde billing rompe esa cosa **sin que nadie abra
este capítulo**. *(El quinto hecho, el de la FASE 8 completa, no salió de billing: sus tres ejecutores —`PB2`, el recálculo que el aviso despierta y el reconciliador diario de cobertura (`DEC-ARCH-009`)— son de esta épica —
`F-8CA2-001`, owner 2026-09-25. **Y el sexto tampoco**: lo ejecuta `PB11`, de esta épica — FASE 9
completa, decisión 5b.)*

**Salen con `G-R5`** (revisión del owner, 2026-09-28, C14): la
pausa pedida por el dueño detiene el reloj y no hay desigualdad que vigilar. **La mitad que `G-R5`
no vigilaba sigue igual y sigue sin guard**: una pausa que vence y no reanuda deja ahora el reloj
detenido, y la cubren la rama de fallo de `S10` (`B/03` §3.2) y la quinta comprobación de cero
llamadas del barrido (`B/09` §3).

*(Desde la revisión del owner, 2026-09-28, C9, `G-R5-B` es una validación del panel y no un guard:
el párrafo que sigue queda como la historia de su cota. **La cota es hoy el plazo de borrado de la
misma versión de plazos, en el peor caso de `N` en días**, así que el ⚠️ de *«6 meses no son 180
días»* no tiene sujeto, y el espacio entre archivado y borrado lo da la fecha que anuncia el
archivado: `V/03` §9, ⚠️ punto 7, cerrado.)*
**`G-R5-B` es la misma clase sobre el otro reloj de la ficha** (FASE 8 completa, `F-8CA2-014`,
owner 2026-09-25). `PB5` archiva un borrador a los `N` meses y el hard delete borra a los 180
días, **sobre la misma columna**; con `N ≥ 6` meses el borrado alcanzaba a un borrador sin que
hubiera pasado por el archivado ni por su aviso. Lo cierran dos reglas juntas: **`PB9` exige
`ARCHIVED`** —eso lo dice la tabla del cap. 03 §9 y no necesita guard: es su `desde`— y **`N` se
valida menor que 6 meses**, que es configuración y por eso lleva guard, igual que `D16`. **Se rompe
a propósito** poniendo `N` en 6 meses, y el rojo tiene que nombrar a `PB5` y la cifra.
**Cerrado
el 2026-09-25 (owner, FASE 8 completa)**: **la cota es 6 meses literal**, como dice el predicado de
arriba; **la unidad que lo construye sigue siendo `V6`**, y **no se agrega un invariante `D18`**.
⚠️ **6 meses no son 180 días**: son 181 a 184 (FASE 9 completa, `B-2`; declarado por
`DEC-METH-015`, FASE 9 completa). Un `N` entre 180 días y 6 meses pasa el guard, y `PB5` archiva
el día 180 o después; `PB9` borra en la corrida siguiente, con el aviso del archivado sin espacio
para exportar. **Causa**: la cota se eligió literal y el borrado cuenta días. Con `N` en meses
enteros el hueco no existe. *(El texto tachado de arriba decía «Hoy son lo mismo», y no lo son.)*

**`PB9` no mueve ni a `G-R6` ni a `G-R6-B`, revisado y no supuesto.** El hard delete pasó a ser
una transición (`PB9`, cap. 03 §9; `F-8CA2-008`), pero **lee la columna igual que antes** —es el
lector *(3)* del cap. 02 §2.5, con otro nombre— y **no la escribe** salvo por la relectura que trae
la cobertura verdadera, que es el hecho 2 y ya estaba en la lista. Así que los seis lectores y los
hechos quedan como estaban (**seis** desde la FASE 9 completa, por `PB11` y no por `PB9`: 5b), y la mitad *(c)* se sigue rompiendo igual: sacándole a `PB9` su
lectura de la columna. `G-R6` gana una condición más que lee `inactiva_desde`, escrita por las
mismas transiciones que ya la escribían.

**`G-R4` y `G-R4-B` son el mismo defecto visto en dos planos, y hacen falta los dos.** El primero
mira **la forma** de una tabla: dos guardas que se pueden satisfacer a la vez dejan el desenlace
en el orden de recorrido, y los pares con dos destinos que el diseño declara hoy son **cuatro**:
`T1`/`T6` y **`PB11`/`PB13`** (revisión del owner, 2026-09-28, C10) acá, y `S5`/`S19` y `S7`/`S19` en la tabla de suscripción (`B/03` §3.2).
**Cuántos son es lo que este guard cuenta**, no una lectura a mano — y el cuarto, `S10`/`S25`, que había entrado en la FASE 9-bis-4 por
`DEC-SUB-015`, salió con la revisión del owner, 2026-09-28, C8. *(Este párrafo decía que `T1`/`T6` era el único; ya no lo era desde que `S19`
compartió par con `S5` y con `S7`.)* El segundo
mira **de qué habla** una guarda: `T6` estaba escrita sobre *«una suscripción viva»*, un predicado
que el §4 del contrato **le prohíbe evaluar** al lado que tiene que evaluarlo, así que su
implementación iba a leer otra cosa sin decirlo. Disjuntas y **evaluables** son dos propiedades
distintas; `T6` fallaba las dos, y cada guard atrapa una.

**`G-R4` es del núcleo y el catálogo de guards está partido en dos épicas** —la numeración es una
sola—. Esta fila es la definición; `B/20` §2 la repite como referencia cruzada, para que las seis
tablas de billing no queden vigiladas por un guard que su propio catálogo no nombra. **Es un
guard, no dos.**

*(Desde la revisión del owner, 2026-09-28, N1, `G-R3` es una validación del panel y no un guard:
lo que sigue vale para ella. **El punto único de falla sigue siendo uno, y ahora lo cuida el panel
al publicar una versión de plan**, y el paso 3a del corte sobre la base de producción. «Se rompe a
propósito» se lee como la prueba de la validación: publicar la versión que la rompe y ver el
rechazo con su mensaje.)*
**`G-R3` es el que más carga lleva, y conviene decir por qué.** El arreglo del trial concentra todo
en un solo dato: **si alguien siembra una de esas dos versiones con una clave comercial, toda la
plataforma la recibe gratis, para siempre, sin consumir ningún trial**. Es un punto único de falla
que antes no existía, y la comparación honesta no es *«¿esto abre algo?»* sino *«¿abre más o menos
que la alternativa?»*: la exención por ruta abre un agujero **por cada ruta que alguien marque**, y
ninguna herramienta lo cuenta; ésta abre uno solo, en una tabla, que un guard puede contar en cada
PR.

**Y hasta esta pasada sólo sabía prohibir, que es la mitad barata del punto único de falla.** Su
enunciado era **negativo entero** —*«ninguna … otorga»*— más un bicondicional cuyo dominio es **una
sola** clave, la de activación. La lista de lo que el piso otorga es de **tres** filas y es cerrada
(cap. 02 §2.1), y **sólo la primera nombraba un guard**: la 1 *es* la mitad en negativo. Así que un
catálogo al que le faltara la fila 2 o la 3 **pasaba en verde**, y el desenlace de cada ausencia lo
escribe el propio capítulo: sin la 3, *«esa persona no puede ejecutar ninguno de los cinco
reinicios y el día 180 le borra el contenido»* (cap. 02 §2.1); sin la 2, un `TRIAL_EXPIRED`, un
`Turista Free` **no pueden suscribirse** (el guest se registra antes de suscribirse, y entonces es `Turista Free`: FASE 9 vuelta 1, `F-8V1A1-006`) —*«queda afuera para siempre»*
(`12-contrato…` §2.5)—. **La mitad `(b)` es esa dirección.** Es la misma corrección que la cuarta
enmienda de `DEC-TEST-001` le hizo a `G-R6-B` sobre otra lista cerrada, y por la misma razón: **una
lista cerrada vigilada en una sola dirección declara una cobertura que no tiene.**

**La `(b)` se puede formar sin juicio, y ésa es la condición con que entra.** Pregunta si **dos
claves nombradas** están entre las que la versión de piso de cada vertical otorga en el catálogo:
no hay que entender qué significan, igual que `G-R6` no necesita entender qué significa una columna
(`B/20` §2). Y **no** verifica que otorgar esas dos claves alcance para ejecutar `PB8` ni el alta —
eso son los siete pasos del cap. 17 §3.5 y este guard no los recorre—; verifica que **estén**.

**Y la `(a)` recién ahora se puede formar, que es la otra mitad del arreglo.** *«Clave de la clase
comercial»* era un término **sin definición en ningún capítulo y sin atributo en el catálogo**:
quien construyera el guard tenía que inventar la clasificación clave por clave, y la primera que le
tocaba era la que la lista del piso acababa de agregar. Si la clasificaba comercial, el guard se
ponía en rojo sobre el catálogo **correcto** y la salida obvia era sacar la clave — que es el
crítico que el cap. 02 §2.1 cerró. **La clase es hoy el cuarto atributo declarado de una clave**
(cap. 15 §3.4), con dos valores y lista cerrada, y su definición está en el glosario al lado de la
de *«entitlement medido»*, que es la otra mitad del mismo predicado (`NUCLEO/01` §1.6). El guard lee
un atributo; no juzga.

**Se rompe a propósito tres veces, una por mitad, y cada una tiene que dar SU mensaje.** *(a)* se le
siembra a la versión de piso de una vertical una clave comercial cualquiera. *(b)* se le **saca** a
esa misma versión la clave *«recuperar lo suyo»*, que es exactamente el catálogo con el que el hard
delete del día 180 se vuelve indefendible. *(c)* se le pone la capacidad de activación a la versión
de pre-trial de una vertical que no declara evento. **Un rojo de una mitad con el texto de otra es
el guard fallando su propia condición** (§2.1): son tres arreglos distintos, en dos tablas
distintas, y el que lo lea tiene que saber cuál le tocó.

**G1 y G2 son la pinza** y ya se explicó en el capítulo 17 §2.3 (épica de verticales): uno acota
**quién puede** nombrar una vertical, el otro obliga a que las operaciones **lo hagan**. Por
separado cada uno deja pasar lo que el otro atrapa.

**La tercera mitad de `G2` cierra la puerta que la segunda dejaba** (owner 2026-09-25; FASE 9
completa, decisión 7a). Leer la vertical del recurso no alcanza si el recurso la puede cambiar: una
ficha creada y publicada en Alojamiento, editada después a Gastronomía, pasaba la edición contra
la vertical **anterior** y quedaba publicada sin cobertura en la nueva hasta que el reconciliador la
bajaba. **Se rompe a propósito** con una operación que actualice `listing.vertical` de una ficha
existente, y el rojo tiene que decir *«escribe la vertical de un recurso que ya existe»*, no el
texto de la *(b)*.

**`G-R2-C` es el gemelo de `G-R2-B` del lado de los addons** (owner 2026-09-25; FASE 9 completa,
decisión 4e). `G-R2-B` impide que una fuente `GRANT` transporte el plan de otra vertical; `G-R2-C`
impide que una fuente `ADDON` de alcance `USER` o `GLOBAL` aparezca en `cobertura(user, vertical)`
de una vertical que su producto no declara compatible (`12-contrato…` §2.7). **Se rompe a
propósito** emitiendo un addon `USER` compatible sólo con Alojamiento en la respuesta de
Gastronomía. **La descomposición
lo propone para `B10` (`descomposicion.md` §2.10): su dato, las verticales compatibles, es de
`addon_product` y ninguna fuente lo transporta; `V/20` conserva la fila, como la de `G-R5`** (owner
2026-09-25; FASE 9 completa, decisión 10c).

### Guards de `B/20` §2 — «2. Los guards, en un solo lugar»

Texto de `B/20-testing.md:43–446`, sin lo tachado:

Los capítulos anteriores fueron dejando guards y cada uno explicó el suyo. Acá está la lista, que
es lo que permite preguntar *«¿están todos?»* una vez en vez de siete.

**`G15`, `G16` y `G17` llegaron con la revisión del owner (2026-09-28), y los tres son de `B1`**,
porque vigilan lo que `B1` construye primero: el falso y sus dos listas (§3.2), el package del
cobro sin `qzpay` (`B/spec.md` §3.1; caso 30), y la frontera por la que entra todo lo que el
proveedor dice (el adaptador). **Lo que cada uno NO verifica, dicho para que nadie lo lea de más**
(§2.1): `G15` comprueba que cada mentira **tenga** su medición y su prueba, no que la medición siga
siendo cierta (eso lo vigila la batería del §4.1); `G16` no mira las dependencias del package del
cobro hacia otros packages compartidos del monorepo, **y es a propósito: puede tenerlas** (caso
30); y `G17` comprueba **de dónde sale** el estado con que se decide, no **cuándo** se leyó: **el cuándo lo impone el tipo, que rechaza una lectura anterior al comienzo del
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
(`EX-36`) y los reintentos del proveedor cobran con ella, (tachado 2026-09-26) **medido: `GR-1` `VERIFIED` el
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
corridos**, según el método de pago (cap. 03 §3.4 punto 1)—, y en esa ventana **nueve transiciones
normales mueven a una predecesora perfectamente legal del conjunto de declaración** (recontadas
con `DEC-SUB-021`, owner 2026-09-25; **y con `S36`**, FASE 9 vuelta 1, M; **y sin `S27`**, revisión del owner, 2026-09-28, C8) —`S8` y `S9` la pausan, **`S4` la pasa a `GRACE_PERIOD`**,
que desde `DEC-SUB-021` ya no es estado de declaración pero **sí es alcanzable** durante la
ventana, y `S12`, `S13`, `S16`, el
espejo de la baja decidida por el proveedor (cap. 03 §10.1) y, desde una `SUSPENDED` de
tarjeta, **`S23`** —la baja pedida estando suspendida— la mata (FASE 8 completa, `F-8CB1-002`; `S27` salió con la revisión del owner, 2026-09-28, C8), **y desde `ACTIVE` o
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
efectos sino cinco, y los tres que se agregaron son los que **fallan en silencio**. **La redención de promo ya no es parte de ellas**
(FASE 8 completa, pendiente 7, owner 2026-09-25): la promo se pierde con el cambio de plan y
`S18` no la re-apunta (`B/14` §2.2), así que la escritura del re-apunte alcanza **sólo a los
complementos** y el guard deja de vigilar la redención. Uno que se olvida de la **cortesía** —que desde `DEC-GRANT-007` no se re-apunta sino que se
**cierra con su saldo de meses** (FASE 8 completa, `F-8CB1-001`)— deja una
columna no anulable apuntando a una `CANCELLED`, que no emite fuente, y **nada que `S9` pueda
re-emitir**. Y uno que cierra sobre una
predecesora con un pago pendiente por `S19` **sin poner la marca** deja plata del cliente en
nuestra cuenta sin nadie que la mire — es el único de los cinco que no tiene ningún otro
detector, porque la fila queda terminal (`DEC-RF-002`, `B/12` §5.3 ramas 1, 5 y 6). **Se rompe a
propósito comentando cada una de las cinco escrituras por separado**, y el inventario contra el
que se verifica es `B/02` §2.6.

**Ya no** (revisión del owner, 2026-09-28, C8): `S25` salió, y `G-R1-C`
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
leer de dos maneras, y una de ellas lo vuelve inservible: el corpus son **diez máquinas repartidas
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

**Y su dominio son las DIEZ máquinas de las dos épicas, no las cinco tablas de
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

**Y `G-R6-B` es el guard de LA LISTA de esa misma columna —sus tres mitades, con cuatro predicados (la tercera mitad y el cuarto predicado, revisión del owner, casos vecinos, 2026-09-29, caso 16)—, que existe porque el
párrafo de arriba dejó dicho que `G-R6` no la cubre.** De los **cinco** hechos
que escriben `listing.inactiva_desde` (el sexto, levantar una moderación —`PB11`—, owner
2026-09-25; FASE 9 completa, 5b) **dos son transiciones enteras y otro lo es a medias** —el 3
y el 6, y desde la FASE 8 completa el 5, que sobre la ficha
publicada lo ejecuta la primera rama de `PB2` (`F-8CA2-001`) y sobre las demás fichas del dueño el
recálculo que el aviso despierta, que no es transición (owner 2026-09-25)—, así que el
predicado *«al menos una transición la escribe»* queda verde por `PB1`/`PB3`/`PB7`, por `PB2` **o
por `PB11`**, no mira al recálculo, y los otros
dos —el registro de eventos y la respuesta del contrato (el hecho 4 salió con la revisión del owner, 2026-09-28, C8)— **no los mira
nadie**. Lo único que los
sostenía era la enumeración de `V/02` §2.5, y una lista cerrada sin guard es una promesa que este
programa ya rompió una vez. **Desde la cuarta enmienda vigila también la otra mitad de ese §, la de
los seis consumidores**, porque **las dos fallan distinto y la segunda falla peor**: un lector no
inventariado **decide** con el reloj, y el lector más caro de esa columna es el hard delete del día
180. La enmienda lo aceptó con una condición que su fila repite: **el mensaje dice qué mitad
falló**, porque un guard con varios predicados y un solo texto afirma más de lo que verificó — la
misma regla con la que esta decisión rechazó el segundo guard, abajo. **Y sobre esa mitad vigila
las dos direcciones, que es lo que esta pasada le agregó**: la *(b)* rechaza un lector que el
inventario no nombra, y la *(c)* rechaza que uno de los **seis declarados** haya dejado de leer —
el día que el hard delete del día 180 deje de leer la columna, el guard seguía verde y la lista
seguía diciendo que ese lector está ahí—. Para **escritores** la dirección simétrica sigue
rechazada **como guard**, y con la razón de siempre: comprobar que un hecho tenga quien lo ejecute
pide una declaración, y un guard estático sólo puede comprobar que esté. **Lo que la vigila desde
`DEC-TEST-002` no es un guard sino un criterio de terminación** (`descomposicion.md` §4), y por eso
la objeción no lo alcanza: lo contesta una persona al declarar lista la unidad, con el código
delante. **La razón entera, con sus
tres casos que lo hacen fallar a propósito —uno por predicado— y lo que sigue sin verificar, está escrita
en `V/20` §2**, que es donde vive la columna; acá alcanza con decir por qué figura en este catálogo:
**lo que puede romper la lista se escribe de este lado** — el cap. 03 §7.1 (el cap. 10 §4.3 salió con la revisión del owner, 2026-09-28, C8)—, y un
escritor **nuevo** agregado desde acá no obliga a abrir el capítulo de la otra épica. Es el mismo
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
cinco veces. (tachado 2026-09-26) **`G12` entra acá y `G13` vive en `V/20`
§2**: la razón que lo traía era falsa —el consumidor de `cobertura()` es verticales, no billing— y
el contrato §6.3 le da a `V4` como dueño (owner 2026-09-26, `G5-5`).

***El salto `G7` → `G9` no es un agujero, y conviene decirlo para que nadie lo busque.*** La
numeración `G1`-`G13` es **una sola, repartida entre las dos épicas**: `G1`-`G6`, `G8` **y `G13`**
están en `V/20` §2, y `G7` más **`G9`-`G12`** están acá (`G13` pasó de acá a allá:
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
| filas de `B/20` §2 | **17** | `G7` `G9` `G10` `G11` `G12` **`G15` `G16` `G17`** · los **seis** de `R1` · `G-R4` `G-R6` `G-R6-B` — `G13` pasó a `V/20` §2 (owner 2026-09-26, `G5-5`); `G-R5` salió (revisión del owner, 2026-09-28, C14; su fila queda tachada y no se cuenta); **`G15`, `G16` y `G17` entraron con la revisión del owner, 2026-09-28** (C13 y `L3-c`, N2, N4 y `L3-f`), recontadas sobre la tabla |
| filas de `V/20` §2 | **21** | `G1`-`G6` `G8` **`G13`** **`G14`** **`G18`** **`G19`** *(el actor de sistema armado fuera de la fábrica, de `V5`: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H)* · `G-R2` `G-R2-B` **`G-R2-C`** · `G-R3-B` `G-R3-C` · `G-R4` `G-R4-B` `G-R6` `G-R6-B` · **`G-R9`** — **`G18`**, el control que regenera y compara el SQL generado del catálogo y de la tabla de claves, entra con su fila en `V/20` §2 y lo construye `V1` (FASE 5, lote de la aplicación, owner 2026-09-30, E; recontado sobre `V/20` §2 en la segunda tanda) — **`G-R3` y `G-R5-B` pasan a ser validaciones del panel** (revisión del owner, 2026-09-28, N1 y C9: el catálogo y los plazos viven en la base y se editan desde el panel, así que CI no ve los de producción); conservan su fila y su nombre, y no se cuentan. Antes, en la misma revisión, **la cifra no se movió y la composición sí**: sale `G-R5` y entra `G14`, el de la frontera del package del contrato (revisión del owner, 2026-09-28, C14 y N6); **`G-R9`**, **`G-R9`**, el de la lista cerrada de `PURGED`, desde la FASE 9 vuelta 2, verificación (owner 2026-09-27, `V2-k`);  `G-R5-B` desde la FASE 8 completa (`F-8CA2-014`, owner 2026-09-25); **`G-R2-C`**, el gemelo de `G-R2-B` para la emisión de un addon `USER`/`GLOBAL` sólo en sus verticales compatibles, desde la FASE 9 completa (owner 2026-09-25, 4e, `F-8CA1-008`; recontado sobre `V/20` §2) |
| **guards distintos** | **35** (el 35 es **`G19`, de `V5`**, con su fila en `V/20` §2: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H) (el 34 es **`G18`, de `V1`: el control que regenera y compara el SQL generado del catálogo y de la tabla de claves**: FASE 5, lote de la aplicación, owner 2026-09-30, E; no es de este catálogo, su fila vive en `V/20` §2) | 17 + 21 (sin `G-R3` ni `G-R5-B`, que pasan al panel: revisión del owner, 2026-09-28, N1 y C9) menos las **tres** referencias cruzadas (mover `G13` de un catálogo al otro no cambia el total): `G-R4`, `G-R6` y `G-R6-B` (revisión del owner, 2026-09-28: sale `G-R5` por C14 y entra `G14` por N6, así que el total queda en 32; **y entran `G15`, `G16` y `G17`**, los tres de este catálogo y ninguno referencia cruzada, así que queda en **35**). `G-R5-B` **no** es referencia cruzada: sus dos cifras son de la épica de verticales. **`G-R2-C` tampoco**: vive en `V/20` §2 y su dato de billing es el catálogo de `addon_product` (`B/02` §2.4) |
| **con unidad que los construya** | **35** de los que cuenta esta tabla; **el 35 es `G19`, con su unidad, `V5`** (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H); **el 34 es `G18`, con su fila en `V/20` §2 y su unidad, `V1`** (FASE 5, lote de la aplicación, owner 2026-09-30, E; recontado en la segunda tanda) (salen `G-R3`, de `V2`, y `G-R5-B`, de `V6`, que pasan a ser validaciones del panel y las construyen las mismas unidades: revisión del owner, 2026-09-28, N1 y C9) | **`G15` `G16` `G17` (`B1`)**, que nacen con unidad (revisión del owner, 2026-09-28), más los **17** (FASE 5, lote de la aplicación, owner 2026-09-30, E; verificación, `VF5-05`; con `G19`, FASES 6 y 7, verificación, 2026-09-30, F8) que ya la tenían — `G1` `G3` (`V1`), **`G8` (`U1`**, la unidad del paraguas que hace la limpieza del principio: verificación corta, 2026-09-29, lote O-A), `G2` `G4` `G6` (`V5`), `G5` y `G-R6-B` (`V6`), `G9` `G10` `G11` `G12` (`B1`), `G7` (`B2`), `G13` (**`V4`**: owner 2026-09-26, `G5-5`), **`G14` (`V1`**, revisión del owner, 2026-09-28, N6; `G-R5` salió por C14) **y `G18` (`V1`**, FASE 5, lote de la aplicación, owner 2026-09-30, E) **y `G19` (`V5`**, FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H) — más los **14** que reparte la quinta enmienda: `G-R3` (`V2`), `G-R2` `G-R2-B` (`V3`), `G-R4` `G-R4-B` `G-R6` (`V4`), `G-R3-B` `G-R3-C` (`V5`), `G-R1-A` `G-R1-B` `G-R1-E` `G-R1-F` (`B3`), `G-R1-D` (`B7`), `G-R1-C` (`B8`) — y **`G-R5-B` (`V6`)**, que nace con unidad (FASE 8 completa, owner 2026-09-25) — **y `G-R2-C` (`B4`)**, asignado en la FASE 9 completa (owner 2026-09-25, decisión 10c; `B/descomposicion.md` §2, fila `B4`) *(pasa a `B4`, al corte: corte del MVP, owner 2026-10-01, AA y AV; residuo corregido el 2026-10-02)* **y `G-R9` (`V6`)**, que nace con unidad (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`) |
| **sin unidad** | **0** | **ninguno**: `G-R2-C` (FASE 9 completa, 4e) **lo construye `B4`, al corte** (corte del MVP, owner 2026-10-01, AA y AV; la asignación la escribe `B/descomposicion.md`, no `V/descomposicion.md`; residuo corregido el 2026-10-02). Entre la FASE 9 completa y esta decisión fue **uno**, la primera vez en la serie; el reparto, unidad por unidad y con su razón medida, está en `V/descomposicion.md` §2.10 y en `B/descomposicion.md` §2 |

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
catálogo, y *«el catálogo cataloga, no reparte trabajo»* (`B/descomposicion.md` §2.1). Las **tres**
filas que igual nombran su unidad —`G12`, `G-R6-B` y `G-R5` (retirada: C14)— lo hacen como **referencia
cruzada** y no como fuente (`G13` se fue a `V/20` §2, donde su unidad `V4` es de la misma épica:
owner 2026-09-26, `G5-5`): las dos primeras porque su unidad está del otro lado de donde uno la
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

## Guards — los treinta y cinco, y las dos validaciones del panel

<a id="guard-g1"></a>

### `GUARD:G1` · `G1`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V1](10-corte/V1.md#pieza-v1)
- **Fuente de la asignación**: `V/descomposicion.md:61`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una pieza **nombra una vertical** sin implementar uno de los ocho ítems del Eje 2. **Entre los casos que lo hacen fallar a propósito está el de `HOS-1079`**, un despacho binario por vertical en código compartido (`x === 'gastronomy' ? A : B`), **y con `G1` sale del repositorio `check-no-binary-vertical-ternary.sh`**, que lo vigilaba hasta entonces: `U1` le reescribe el texto y `V1` lo retira en el mismo PR (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, I)
- **de dónde sale**: cap. 01 §4.4 (núcleo)

**Texto de la fuente — «2.1 Un guard se prueba rompiéndolo»** (`V/20-testing.md:352–370`, sin lo tachado):

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
`16-fase-7…` §4.7 (`../../HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`),
momento 1).

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:50, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:61, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:352

<a id="guard-g2"></a>

### `GUARD:G2` · `G2`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V5](10-corte/V5.md#pieza-v5)
- **Fuente de la asignación**: `V/descomposicion.md:65`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **tres mitades, con tres mensajes**. **(a)** una operación de dominio **no declara** su contexto de vertical; **(b)** una operación **sobre un recurso que guarda su vertical** —la ficha y su contenido, la presencia de Partner, la instancia de addon— toma su contexto de vertical **del pedido y no del recurso** (FASE 8 completa, `F-8CA1-001`, owner 2026-09-25; generalizada por la FASE 9 completa, decisión 7a); **(c)** una operación **escribe la vertical de un recurso que ya existe** —la vertical de una ficha es inmutable desde el alta, `V/02` §2.5— (owner 2026-09-25; FASE 9 completa, decisión 7a)
- **de dónde sale**: cap. 17 §2.3 y §1.2 precisión 6 (épica de verticales); cap. 02 §2.5

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:51, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:65

<a id="guard-g3"></a>

### `GUARD:G3` · `G3`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V1](10-corte/V1.md#pieza-v1)
- **Fuente de la asignación**: `V/descomposicion.md:61`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una clave usada en código **no existe en el catálogo**. **La otra dirección, una clave de la base que no está en el catálogo, deja de ser del guard y pasa a ser una restricción de la base** (revisión del owner, 2026-09-28, N1): la tabla de claves la escribe la migración desde el catálogo **—como SQL generado por el script TypeScript, que vigila `G18`: FASE 5, lote de la aplicación, owner 2026-09-30, E—**, y toda asignación de un plan apunta a ella por FK, así que el panel no puede cargar una clave que el código no conoce. CI no ve la base de producción, que desde N1 se edita desde el panel
- **de dónde sale**: cap. 02 §1.2; `NUCLEO/02` §1.2 y §1.4

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:52, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:61

<a id="guard-g4"></a>

### `GUARD:G4` · `G4`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V5](10-corte/V5.md#pieza-v5)
- **Fuente de la asignación**: `V/descomposicion.md:65`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una transición de suscripción o de trial **escribe roles**
- **de dónde sale**: cap. 17 §4.4 (épica de verticales)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:53, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:65

<a id="guard-g5"></a>

### `GUARD:G5` · `G5`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una fuente de entitlements **se apaga sin pasar** por el reconciliador de excedentes
- **de dónde sale**: cap. 15 §4.2 (épica de verticales)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:54, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="guard-g6"></a>

### `GUARD:G6` · `G6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V5](10-corte/V5.md#pieza-v5)
- **Fuente de la asignación**: `V/descomposicion.md:65`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **dos mitades, con dos mensajes**. **(a)** una autorización **decide sólo por rol**; **(b)** *«un rol entró al conjunto efectivo»*: una construcción del conjunto efectivo lee un rol —el cargador que le da el conjunto entero a `SUPER_ADMIN`, `ADMIN`, `EDITOR` o `CLIENT_MANAGER`— (FASE 9 vuelta 1, `F-8V1A1-002`)
- **de dónde sale**: invariantes §64.12 y §64.13; cap. 17 §4.3

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:55, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:65

<a id="guard-g8"></a>

### `GUARD:G8` · `G8`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [U1](10-corte/U1.md#pieza-u1)
- **Fuente de la asignación**: `D/16-fase-7-del-paraguas.md:850`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **aparece, sin distinguir mayúsculas, el nombre del agrupamiento viejo de Gastronomía y Experiencia en cualquier archivo versionado del repositorio**: código, esquema, tipos, tests, docs, specs, comentarios, nombres de archivo, la historia de migraciones y el ledger del seed. **Una sola exención, por nombre: el PDR de HOS-1352 (`00-PDR.md`)**, que no se edita y lo nombra en su §55.1; la causa va escrita en el guard (revisión del owner, 2026-09-28, C3, `L2-a` y `L2-b`). **Ya no hay excepción histórica**: lo que la nombre se reescribe o se borra. El guard arma el patrón sin escribir la palabra, para no fallar sobre su propio texto, **y el script del corte arma igual el valor viejo que tenga que nombrar al leer la base vieja: sin escribir la palabra de corrido, así que pasa `G8` sin entrar a la lista de pendientes** (`16-fase-7…` §4.2; revisión del owner, casos vecinos, 2026-09-29, caso F-D). **Hasta el corte la historia de migraciones y el ledger del seed la nombran y sólo el paso 6 del corte los reemplaza** (`16-fase-7…` §4.2): **mientras tanto el guard lleva una lista de pendientes cerrada, con **tres entradas por carpeta, y ninguna más** (verificación corta, 2026-09-29, lote N-A: el trinquete salió): la historia de migraciones (`packages/db/src/migrations/**`) **sin el carril de extras (`packages/db/src/migrations/extras/**`), que no entra a la lista: los extras no tienen registro y se reaplican, así que un extra nuevo con la palabra falla desde el primer día y no el del corte, y `U1` reescribe los dos que la nombran hoy, `032` (nombre y comentarios) y `033` (comentario)** (FASE 5, owner 2026-09-30, lote 1 H, `F5-BD-019`, `F5-U1-055`), las migraciones de datos del seed que el ledger anota (`packages/seed/src/data-migrations/**`)** **y las carpetas del programa en `.specs/` (`HOS-1352-…`, `HOS-1353-…` y `HOS-1354-…`), que por el caso 41 se quedan en el repositorio hasta el cierre de HOS-1352** (revisión del owner, casos vecinos, 2026-09-29, caso H-A). **La tercera entrada son sólo esas tres carpetas: las specs de otros issues y `.qtm/` que la nombran no entran a la lista, y las limpia la limpieza del principio en el mismo cambio que construye el guard** (verificación corta, 2026-09-29, lote N-A; `16-fase-7…` §4.6) (`21` §4; revisión del owner, casos vecinos, 2026-09-29, caso I-D). **Lo que está en la lista no falla, y la lista no admite **una cuarta carpeta** (lote N-A). El paso 6 del corte le saca las dos historias, en el mismo commit que las reemplaza, y un build destinado a producción después del corte falla si le queda una de las dos** (revisión del owner, casos vecinos, 2026-09-29, caso 8). **Esa regla la enciende el mismo commit del paso 6**: desde ahí, que la lista vuelva a tener una de las dos historias falla; antes, el despliegue del paso 3, que es un build destinado a producción con la lista llena, no falla por ella (revisión del owner, casos vecinos, 2026-09-29, caso F-B). **La tercera entrada la saca el commit del cierre de HOS-1352**, que reescribe el diseño vigente sin la palabra y saca los informes históricos (`HOS-1352/spec.md`, *«Al cerrar HOS-1352»*), **y ese mismo commit extiende la regla: desde ahí, la lista no vacía falla** (revisión del owner, casos vecinos, 2026-09-29, caso H-A). **Sin trinquete y sin lista de pendientes de código** (verificación corta, 2026-09-29, lote N-A): el trinquete que el lote M-E le sumaba el mismo día sale antes de llegar al código, porque **el código del sistema viejo sale entero de la rama al principio de la épica**, en la limpieza del principio (`16-fase-7…` §4.6), que borra el cobro viejo y renombra o borra todo lo que nombra la palabra. **`G8` corre sobre todo el repositorio desde que nace**, con el PDR como única exención y las tres carpetas como única lista, y nace verde porque la limpieza va antes que él o con él. **Las tres carpetas siguen haciendo falta**, revisadas una por una: la historia de migraciones, porque una migración aplicada no se reescribe y la que la rama genera para borrar lo viejo lo nombra (hasta el paso 6); las migraciones de datos del seed, que el ledger anota como aplicadas, **menos las que usan el cobro viejo, que `U1` saca de la rama** (FASE 5, owner 2026-09-30, lote 1 C, `F5-U1-048`: ya no se congelan) (hasta el paso 6); y las carpetas del programa, cuyos informes históricos la citan (hasta el cierre de HOS-1352). Lo construye la unidad que hace la limpieza del principio, en el mismo cambio: **`U1`, la unidad del paraguas que va antes de `V1` y de `B1`** (verificación corta, 2026-09-29, lote O-A; `16-fase-7…` §4.6)
- **de dónde sale**: invariante §64.32, §55; revisión del owner, 2026-09-28, C3

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:56, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:850

<a id="guard-g13"></a>

### `GUARD:G13` · `G13`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **un build destinado a producción importa el módulo de la implementación de arranque que contesta por billing** (; la pregunta salió con la revisión del owner, 2026-09-28, C8). **Son las seis respuestas de arranque que contestan por billing: el `no` a las cuatro fuentes de billing, el `detenida: no` de `retenciónDetenida` y el `no` de `puedeCobrarle` (contrato §5.1 y §6.3), las seis en el módulo vigilado, y un caso de `G13` por cada una que lo pone en rojo si el build de producción la enlaza** (FASE 9 vuelta 3, `F-8V3C1-002`, `F-8V3D1-001`), **no** la resolución del trial ni la del título `BASE`, que son de verticales en las dos implementaciones (contrato §6.3; FASE 9 vuelta 2, `F-8V2C1-005`; la fila, corregida en la verificación, `22-` §5)
- **de dónde sale**: contrato (`../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md`) §6.3. **Lo construye `V4`**, con la implementación de arranque: falla sobre un build destinado a producción, no sobre la rama, así que calla hasta que un build apunte a producción y la defensa existe desde el primer día. **Vino de `B/20` §2** (owner 2026-09-26, `G5-5`): allá lo construía `B4` con la razón *«el consumidor del contrato es billing»*, que era falsa —el consumidor de `cobertura()` es verticales—

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:57, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="guard-g14"></a>

### `GUARD:G14` · `G14`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V1](10-corte/V1.md#pieza-v1)
- **Fuente de la asignación**: `V/descomposicion.md:61`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **una mitad importa a la otra**: el código de la épica de verticales importa algo de la de billing, o al revés, fuera del package del contrato (`12-contrato…` §7.1). Las dos importan sólo ese package, y el único lugar que junta las dos es la raíz de composición de `apps/api`, que el guard nombra como única excepción. **Importar el package de pruebas compartido del reloj adelantable no es cruzar**: no es de ninguna de las dos mitades (`B/20` §5.1; revisión del owner, casos vecinos, 2026-09-29, caso 31). **La app del panel no junta las dos**: la pantalla única de plazos las lee por la API, sin importar ninguna (revisión del owner, casos vecinos, 2026-09-29, caso H-F). **Se rompe a propósito** agregando en verticales un import de billing, y el rojo tiene que nombrar el archivo y la mitad importada
- **de dónde sale**: revisión del owner, 2026-09-28, N6, `L1-d`; `12-contrato…` §4.2 y §7.1. **Lo construye `V1`**, que crea el package. **No ve** una lectura de tablas de la otra mitad por `@repo/db` (`12-contrato…` §4.2)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:58, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:61

<a id="guard-g18"></a>

### `GUARD:G18` · `G18`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V1](10-corte/V1.md#pieza-v1)
- **Fuente de la asignación**: `V/descomposicion.md:61`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **el SQL generado que viaja en la migración no es el que el script TypeScript regenera desde el código**, en cualquiera de las dos cargas: **el catálogo de producción** (FASE 5, owner 2026-09-30, lote 2 D) **y la tabla de claves de entitlement y limit** (FASE 5, lote de la aplicación, owner 2026-09-30, E). Una migración no puede llamar código, así que las dos viajan como SQL generado por el mismo script y vigiladas por este mismo control, que lo regenera y lo compara. **Se rompe a propósito** agregando una clave al catálogo de claves en código sin regenerar el SQL, y el rojo tiene que nombrar la carga y la clave que difieren
- **de dónde sale**: FASE 5, owner 2026-09-30, lote 2 D, y lote de la aplicación, E: el control ya estaba pedido para el catálogo y no figuraba entre los guards; contarlo lleva el total del programa de 33 a 34. **Lo construye `V1`**, con la tabla de claves, que es la primera de las dos cargas en llegar; `V2` suma la del catálogo, con la pieza que lo carga (`descomposicion.md` §2). *(El id es el siguiente libre de la numeración `G`: `G15` a `G17` son de `B1`.)*

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:59, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:61

<a id="guard-g19"></a>

### `GUARD:G19` · `G19`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V5](10-corte/V5.md#pieza-v5)
- **Fuente de la asignación**: `V/descomposicion.md:65`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **aparece un actor de sistema armado fuera de la fábrica**: un objeto de actor con `_isSystemActor`, o con todos los permisos (`Object.values(PermissionEnum)`), en cualquier archivo de producción que no sea la fábrica. **Se rompe a propósito** armando un actor así en un servicio, y el rojo nombra el archivo
- **de dónde sale**: cap. 17 §3.3 (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H): el actor de sistema se reescribe en `V5` con una fábrica única; hoy son una fábrica y unos treinta literales, nueve con todos los permisos y sin la marca que mira la barrera HTTP (`39-fases-6-y-7/20-pase-fase-6.md` §2.1). **Lo construye `V5`**. *(El id es el siguiente libre de la numeración `G`, como `G18`.)*

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:60, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:65

<a id="guard-g-r2"></a>

### `GUARD:G-R2` · `G-R2`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V3](10-corte/V3.md#pieza-v3)
- **Fuente de la asignación**: `V/descomposicion.md:63`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: el pliegue del conjunto efectivo **recibe una fuente de clase `COMPLEMENTO`** cuando el conjunto no tiene ninguna de clase `TÍTULO` viva **que no sea de `tipo: TRIAL`** — en cualquiera de sus dos tramos. **El caso que lo distingue de la versión anterior**: un addon `USER` o `GLOBAL` comprado con la suscripción de otra vertical, contra una vertical cuyo único título es un trial, **no entra** (`V/11` §5.3; FASE 8 completa, `F-8CA1-004`, `F-8CA2-011`, `F-8CC1-006`)
- **de dónde sale**: cap. 15 §2.6, `V/11` §5.2–§5.3

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:61, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:63

<a id="guard-g-r2-b"></a>

### `GUARD:G-R2-B` · `G-R2-B`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V3](10-corte/V3.md#pieza-v3)
- **Fuente de la asignación**: `V/descomposicion.md:63`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una fuente `GRANT` transporta **un plan de otra vertical** que la de la fuente
- **de dónde sale**: cap. 15 §2.5, `12-contrato…` §2.8

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:62, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:63

<a id="guard-g-r2-c"></a>

### `GUARD:G-R2-C` · `G-R2-C`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B4](10-corte/B4.md#pieza-b4)
- **Fuente de la asignación**: `B/descomposicion.md:138`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una fuente `ADDON` de alcance `USER` o `GLOBAL` **se emite en una vertical que no está entre las compatibles de su producto** (`addon_product`, `B/02` §2.4). **Gemelo de `G-R2-B`**: aquél vigila que un grant no transporte el ancla de otra vertical, éste que un addon global no aparezca donde su producto no llega
- **de dónde sale**: `12-contrato…` §2.7; owner 2026-09-25, FASE 9 completa, decisión 4e, `F-8CA1-008`. **Lo construye `B4`**, de la otra épica, al corte (corte del MVP, owner 2026-10-01, AA y AV; `16-fase-7-del-paraguas.md` §4.6; residuo corregido el 2026-10-02)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:63, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:138

<a id="val-g-r3"></a>

### `VAL:G-R3` · `G-R3`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V2](10-corte/V2.md#pieza-v2)
- **Fuente de la asignación**: `V/descomposicion.md:62`
- **Qué es**: una validación del panel que conserva nombre de guard; no corre en CI ni se cuenta entre los guards ([AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)). **Test mínimo**: ≥1 de cualquier tipo de la lista cerrada, en la pieza dueña.
- **qué falla si se rompe**: **Deja de ser un guard de CI y pasa a ser una validación del panel, con el mismo nombre** (revisión del owner, 2026-09-28, N1, `L1-f`): el catálogo vive 100 % en la base y se edita desde el panel, así que CI no ve el de producción. **Lo que sigue es lo que la acción administrativa *«publicar una versión de plan»* rechaza** (`NUCLEO/02` §1.4, `NUCLEO/08` §3) y lo que el paso 3a del corte corre sobre la base de producción después de la migración única del catálogo. **Conserva su nombre para que las citas sigan apuntando a lo mismo, y no se cuenta entre los guards.** **cuatro mitades, con cuatro mensajes** (la cuarta, FASE 9 vuelta 1, `F-8V1A1-005`). **(a)** una de las **dos versiones no vendibles** de una vertical —la de pre-trial o la de piso— otorga una clave de la clase comercial o un entitlement medido; **(b)** la versión de piso de una vertical **no otorga** alguna de las **dos claves** que las filas 2 y 3 de su lista cerrada declaran —*«contratar una suscripción»* y *«recuperar lo suyo»*—; **(c)** la capacidad de activación no cumple el «si y sólo si»; **(d)** **la versión de trial o una de las dos no vendibles declara `hereda Turista VIP`** (escrita como la falla, igual que las otras tres; decía el invariante y, leída a la letra en la columna *«qué falla si se rompe»*, fallaba cuando ninguna la declaraba; FASE 9 vuelta 1, §4 punto 7 de `25-verificado-G5-y-registro`): es una columna y no una clave, así que (a) no la ve. Mensaje propio: *«herencia de VIP fuera de una versión vendible»*
- **de dónde sale**: cap. 02 §2.1

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:62

<a id="guard-g-r3-b"></a>

### `GUARD:G-R3-B` · `G-R3-B`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V5](10-corte/V5.md#pieza-v5)
- **Fuente de la asignación**: `V/descomposicion.md:65`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una transición **disparada por el reloj** otorga algo, en vez de quitar
- **de dónde sale**: cap. 17 §3.4

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:65, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:65

<a id="guard-g-r3-c"></a>

### `GUARD:G-R3-C` · `G-R3-C`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V5](10-corte/V5.md#pieza-v5)
- **Fuente de la asignación**: `V/descomposicion.md:65`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una **operación de dominio no declara** si pasa por el paso 5
- **de dónde sale**: cap. 17 §3.5

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:66, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:65

<a id="guard-g-r4"></a>

### `GUARD:G-R4` · `G-R4`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas** — sobre las **diez** máquinas (la décima, el reembolso: owner 2026-09-25, FASE 9 completa, decisión 5a), en las dos épicas
- **de dónde sale**: cap. 03 §1 regla 7 (núcleo)
- **También en `B/20-testing.md` §2** (línea 64), con este texto:
  - **qué falla si se rompe**: una tabla de transiciones tiene **dos filas con el mismo `(desde, evento)`** cuyas guardas **no son disjuntas**
  - **de dónde sale**: cap. 03 §1 regla 7 (núcleo). **Referencia cruzada**: lo define `V/20` §2 y cubre las **cuatro** tablas de transiciones de esta épica —`S`, `P`, `MP` y `A` del cap. 03; grace y pausa son sub-estados de suscripción sin tabla propia— (decía «seis»; recontado el 2026-09-25, FASE 8 completa, `F-8CD1-016`). El catálogo de guards es una sola numeración partida en dos capítulos, así que un guard del núcleo tiene que figurar en los dos o la mitad de su dominio queda sin vigilar en el papel

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:67, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:64, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="guard-g-r4-b"></a>

### `GUARD:G-R4-B` · `G-R4-B`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una condición o un evento de una máquina de **la épica de verticales** nombra un **estado de la suscripción** o de la instancia de addon
- **de dónde sale**: `12-contrato…` §4

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:68, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="val-g-r5-b"></a>

### `VAL:G-R5-B` · `G-R5-B`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Qué es**: una validación del panel que conserva nombre de guard; no corre en CI ni se cuenta entre los guards ([AZ](01-decisiones-vigentes.md#own-41-corte-del-mvp-t6-az)). **Test mínimo**: ≥1 de cualquier tipo de la lista cerrada, en la pieza dueña.
- **qué falla si se rompe**: **Deja de ser un guard de CI y pasa a ser una validación de la acción *«cambiar un plazo»*, con el mismo nombre, y no se cuenta entre los guards** (revisión del owner, 2026-09-28, C9, C11): el plazo vive en la base y lo cambia el súper admin (`NUCLEO/02` §1.5). **Rechaza un `N` de `PB5` que, en su peor caso en días (meses de 31), no quede por debajo del plazo de borrado de la misma versión de plazos**: la cota deja de ser 6 meses literal, porque el 180 dejó de ser fijo
- **de dónde sale**: cap. 03 §9 (`PB5`), cap. 02 §4.1; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25. **Misma forma que `G-R5`**: compara una cifra de configuración contra una cota, y ninguna búsqueda de texto lo vería cambiar. **Lo construye `V6`**, la unidad que construye `PB5` y su `N` (`descomposicion.md` §2)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:70, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="guard-g-r6"></a>

### `GUARD:G-R6` · `G-R6`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V4](10-corte/V4.md#pieza-v4)
- **Fuente de la asignación**: `V/descomposicion.md:64`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una **condición de transición lee una columna que NINGUNA transición escribe** — sobre las **diez** máquinas (la décima, el reembolso, FASE 9 completa, 5a), en las dos épicas, y contra **las tablas que los capítulos declaran** y no contra el subconjunto ya construido (`B/20` §2)
- **de dónde sale**: `DEC-TEST-001` y su ampliación del mismo día, `B/03` §7.2 (`MP5`), `F-8eB1-002`. **Referencia cruzada**: lo define `B/20` §2, donde nació. Figura acá porque **la columna que más caro sale muerta es de esta épica**: `listing.inactiva_desde` (cap. 02 §2.5)
- **También en `B/20-testing.md` §2** (línea 62), con este texto:
  - **qué falla si se rompe**: una **condición de transición lee una columna que NINGUNA transición escribe**. El guard recorre cada condición de las tablas de transiciones de **las diez máquinas, en las dos épicas** (la décima, el reembolso de `B/03` §6.1: owner 2026-09-25, FASE 9 completa, 5a), extrae las columnas que lee y exige que **al menos una transición del corpus las escriba** — donde *«el corpus»* son **las tablas que los capítulos declaran**, nunca el subconjunto ya construido, o el guard nace en rojo sobre el camino normal entre `B5` y `B8`
  - **de dónde sale**: `DEC-TEST-001` y su ampliación del mismo día, cap. 03 §7.2 (`MP5`), `F-8eB1-002`. **Referencia cruzada**: figura también en `V/20` §2, que escribe la razón de la ampliación — ahí vive `listing.inactiva_desde`, la columna sobre la que se decide el borrado irreversible

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:71, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:62, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:64

<a id="guard-g-r6-b"></a>

### `GUARD:G-R6-B` · `G-R6-B`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **las TRES mitades de la lista cerrada de `listing.inactiva_desde`** (cap. 02 §2.5; la tercera, la *(d)*, revisión del owner, casos vecinos, 2026-09-29, caso 16). **(a) Escritores**: una escritura de la columna —el efecto de una transición, un camino de servicio o un barrido— **o de `listing.plazos_version`** (que se escribe sólo junto con `inactiva_desde`; revisión del owner, casos vecinos, 2026-09-29, caso 48) que **no sea uno de los cinco hechos** del cap. 01 §1.2 (núcleo; el 4 salió con la revisión del owner, 2026-09-28, C8) **ni la escritura `C` del corte en la migración estructural del corte** —**el sexto, *«se levanta la moderación»*, entra con un solo ejecutor, `PB11`** (owner 2026-09-25; FASE 9 completa, decisión 5b)—; el quinto, **la pérdida de cobertura del dueño en la vertical**, entra a la lista **con sus tres ejecutores** —la primera rama de `PB2` sobre la ficha publicada y el recálculo que el aviso despierta sobre las demás del dueño, **y el reconciliador diario de cobertura sobre las demás cuando el aviso se perdió** (cap. 03 §9, `DEC-ARCH-009`)— y la segunda rama de `PB2` sigue afuera (FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, owner 2026-09-25)—. **El reconciliador no agrega ningún hecho**: escribe el 2 y el 5, y la mitad *(a)* lo admite por la lista. **(b) Consumidores**: una lectura de la columna que **no figure entre los seis consumidores** que el cap. 02 §2.5 enumera y cierra (recontados, `F-8CD1-009`). **(c) Consumidores que dejaron de serlo**: uno de esos **seis** que **ya no lee** la columna. **(d) Lectores de retención sin la pausa** ✚ (revisión del owner, casos vecinos, 2026-09-29, caso 16): un consumidor de la columna que decide archivar, borrar o avisar (`PB4`, `PB5`, `PB9` y los avisos de retención) y **no consulta `retenciónDetenida`** (`12-contrato…` §4.1) al ejecutar **o no cuenta desde el más tardío de los dos instantes, `listing.inactiva_desde` y el `pausaTerminadaEn` que devuelve** (verificación corta, 2026-09-29, VC-VT-05: la regla de F-A tiene dos mitades, y la *(d)* vigilaba sólo la primera); es la misma lista de lectores que la mitad *(b)* y el mismo recorrido. **El mensaje nombra la mitad que falló** — *«escritor fuera de la lista»*, *«lector fuera del inventario»*, *«lector declarado que ya no lee»* **o *«lector de retención que no pregunta por la pausa»***, nunca uno solo para las cuatro
- **de dónde sale**: `DEC-TEST-001`, **tercera y cuarta enmiendas** del mismo día; cap. 02 §2.5 —*«se escribe en los seis hechos —y en la escritura única del corte— y en ninguna otra parte»*, *«y la leen seis consumidores»*—; `DEC-DATA-002`. Lo construye **V6** (`descomposicion.md` §2). `B/20` §2 lo repite como referencia cruzada
- **También en `B/20-testing.md` §2** (línea 63), con este texto:
  - **qué falla si se rompe**: **las tres mitades de la lista cerrada de `listing.inactiva_desde`, con cuatro predicados**: una **escritura**, de la columna **o de `listing.plazos_version`** (caso 48), que no sea uno de los **cinco hechos** del `NUCLEO/01` §1.2 (el 4 salió con la revisión del owner, 2026-09-28, C8; el sexto, `PB11`, owner 2026-09-25; FASE 9 completa, 5b) **ni la escritura `C` del corte**; una **lectura** que no figure entre los **seis consumidores** del `V/02` §2.5; o **uno de esos seis que ya no lee** la columna (FASE 8 completa, `F-8CA2-001`, `F-8CA3-002`, `F-8CD1-009`, owner 2026-09-25); **y, con un cuarto predicado, un lector que decide archivar, borrar o avisar y no consulta `retenciónDetenida`** **o no cuenta desde el más tardío de los dos instantes** (verificación corta, 2026-09-29, VC-VT-05) (revisión del owner, casos vecinos, 2026-09-29, caso 16). **El mensaje nombra el predicado que falló**
  - **de dónde sale**: `DEC-TEST-001`, **tercera y cuarta enmiendas** del mismo día; `V/02` §2.5. **Referencia cruzada**: lo define `V/20` §2, donde vive la columna. Figura acá porque **lo que puede romper la lista se escribe en esta épica**: el §4.3 del cap. 10 es donde está escrito que el reloj *«arranca acá, no antes»* —el cuarto hecho— **y, desde esta pasada, quién lo escribe: el barrido del día del fin de servicio, que es la única escritura de `listing.inactiva_desde` que sale de esta épica**; y el §7.1 del cap. 03 apoya el tope de la reapertura en que la lista **sea** cerrada

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:72, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:63, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="guard-g-r9"></a>

### `GUARD:G-R9` · `G-R9`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [V6](10-corte/V6.md#pieza-v6)
- **Fuente de la asignación**: `V/descomposicion.md:66`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `V/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `V/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **una tabla del esquema cuelga de `listing` y no tiene fila en la lista cerrada de `PURGED`** (cap. 02 §4.1). Recorre `packages/db/src/schemas/` y toma **toda tabla con FK a `accommodations`, `gastronomies` o `experiences`** (leyendo el `references(` aunque el formateador lo parta en varias líneas, que es como la primera medición perdió `posts`) **y toda tabla con una columna `entity_type`**, y falla si una no aparece en la columna de tablas de la lista. **Sobre la rama después de la limpieza del principio da 29 con FK y 9 con `entity_type` (FASE 5, owner 2026-09-30, lote 6 G, `F5-BD-011`: las dos del cobro viejo estaban entre las de `entity_type`), y la lista nombra 40: esas 38 y las dos del modelo nuevo, `pedido_de_arreglo` y `addon_instance`, que el recorrido encuentra si cuelgan de la ficha por FK o por `entity_type`** (FASE 9 vuelta 3, `F-8V3A3-007`: salen las dos del cobro viejo)
- **de dónde sale**: cap. 02 §4.1; FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-k`, `N-B-02`. **Misma forma que `G-R6-B`**: una lista cerrada sin guard ya perdió un miembro, `posts`, y lo que la lista sostiene es qué le pasa a lo que cuelga de una ficha cuyo contenido se borró. **Lo construye `V6`**, con `PB12`, que es la primera de las dos transiciones hacia `PURGED` en el orden de la épica (`PB9` es de `V9`, que llega después): es el argumento de `G-R6-B` (`descomposicion.md` §2.5 y §2.10), y la lista sigue siendo del cap. 02. **No afirma que el tratamiento de cada fila sea el correcto**: afirma que ninguna tabla que cuelga de `listing` quedó sin fila (§2.1). **La tabla de paso del corte no entra en su recorrido**: vive sólo en el SQL de la migración del paso 3, fuera del esquema de Drizzle, y la borra el 5b (cap. 21 §2.4) (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, P)

Origen: .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:73, .specs/HOS-1353-verticales-capacidades-y-autorizacion/docs/20-testing.md:32, .specs/HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md:66

<a id="guard-g7"></a>

### `GUARD:G7` · `G7`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B2](10-corte/B2.md#pieza-b2)
- **Fuente de la asignación**: `B/descomposicion.md:136`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: un valor comercial vive **en código**
- **de dónde sale**: invariantes §64.15 y §64.16

**Texto de la fuente — «2.1 Un guard se prueba rompiéndolo»** (`B/20-testing.md:447–465`, sin lo tachado):

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
`16-fase-7…` §4.7 (`../../HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md`),
momento 1).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:50, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:136, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:447

<a id="guard-g9"></a>

### `GUARD:G9` · `G9`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: el `reason` que se manda al proveedor es **un identificador interno** y no copy para el cliente
- **de dónde sale**: `D9`, `EX-19`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:51, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="guard-g10"></a>

### `GUARD:G10` · `G10`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: un `init_point` del proveedor se muestra **sin sanear**
- **de dónde sale**: `D10`, `EX-37`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:52, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="guard-g11"></a>

### `GUARD:G11` · `G11`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: se le pide un **trial al proveedor**
- **de dónde sale**: `D12`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:53, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="guard-g12"></a>

### `GUARD:G12` · `G12`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: se importa el **SDK de la pasarela fuera del adaptador**
- **de dónde sale**: `DEC-ARCH-004`, condición A. Lo construye `B1` (`B/descomposicion.md` §2)

**Texto de la fuente — «2.1 Los dos guards que nacieron acá y ya están en el catálogo»** (`B/descomposicion.md:176–190`, sin lo tachado):

Se numeraron en esta descomposición **porque el `20` §2 no los nombraba**, y ahí quedó escrito
*«si el `20` se reescribe, los absorbe»*. **Los absorbió**: desde la FASE 9-bis-4 las dos filas
están en `20` §2 (`DEC-TEST-001`, *«y el catálogo estaba incompleto»*), así que **ya no viven
fuera del catálogo que CI leería**. La tabla queda acá porque **es esta tabla la que les asigna
unidad** —`G12` a `B1`— y el catálogo cataloga, no reparte trabajo. **`G13` ya no es
de esta épica**: lo construye `V4`, como dice el contrato §6.3, y su fila está en `V/20` §2 (owner
2026-09-26, `G5-5`; la asignación la escribe `V/descomposicion.md` §2.3):

| # | qué falla si se rompe | de dónde sale |
|---|---|---|
| **`G12`** | se importa el SDK de la pasarela **fuera del adaptador** | `DEC-ARCH-004`, condición A |
| | | → `V4` (`G5-5`) |

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:54, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:176, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:178, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:179, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:180, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:181, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:182, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:183, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:184, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:186, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:187, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:188, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:189

<a id="guard-g-r1-a"></a>

### `GUARD:G-R1-A` · `G-R1-A`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:137`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **el camino que declara una sucesión** escribe `sucede_a` apuntando a una predecesora que **en ese acto** está fuera de **`{ACTIVE, CANCEL_SCHEDULED}`** —`GRACE_PERIOD` salió del conjunto: desde el grace no se declara una sucesión (`DEC-SUB-021`, owner 2026-09-25)— **y no es una `SUSPENDED` de pagador con tarjeta cuyo preapproval se releyó por id como `cancelled`** —la única `SUSPENDED` admitida; la de pagador manual y toda `PAUSED` siguen afuera (FASE 8 completa, `F-8CB1-002`, owner 2026-09-25)—, **o a una `ACTIVE` de pagador con tarjeta cuyo preapproval no se releyó por id como `authorized` en ese acto** (FASE 8 completa, owner 2026-09-25: la `ACTIVE` que el proveedor ya pausó por mora sin que nos llegara el webhook), o a una que a su vez tenga `sucede_a` no nulo
- **de dónde sale**: cap. 02 §2.2, cap. 03 §3.2 (`S1`, **`S6`**, **`S7`**) y §3.3.1, `DEC-SUB-019`, **`DEC-SUB-021`**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:56, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:137

<a id="guard-g-r1-b"></a>

### `GUARD:G-R1-B` · `G-R1-B`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:137`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: una fila con `sucede_a` no nulo **no** nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización, **o esa fecha no es la que el proveedor confirmó** — **salvo** que su predecesora sea una `SUSPENDED` de pagador con tarjeta cuyo preapproval se releyó `cancelled`, la misma condición que lee `G-R1-A`: esa sucesora cobra al autorizar (`D8`, excepción del owner 2026-09-25)
- **de dónde sale**: `D8`, cap. 12 §5.2, cap. 02 §2.2

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:57, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:137

<a id="guard-g-r1-c"></a>

### `GUARD:G-R1-C` · `G-R1-C`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B8b](20-fase-2/B8b.md#pieza-b8b)
- **Fuente de la asignación**: `B/descomposicion.md:144`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: un camino escribe **`sucedida_por` sin limpiar `sucede_a`**, o limpia **`sucede_a` sin escribir `sucedida_por`**, o **cierra una sucesión dejando algo colgando de la predecesora**: un complemento sin re-apuntar —la redención **no** se re-apunta desde la pendiente 7 de la FASE 8 completa (owner 2026-09-25): la promo se pierde con el cambio de plan, `B/14` §2.2—, **o una cortesía vigente sin cerrar y sin `saldo_meses`** —ésa **no** se re-apunta, `DEC-GRANT-007`—, o un **pago pendiente por `S19` sin una marca `requiere_conciliación` abierta con motivo `REEMBOLSO_POR_CONFIRMAR`** —la marca sin el motivo **pasaba el guard y no ordenaba nada**—; (sale con `S25`: revisión del owner, 2026-09-28, C8)
- **de dónde sale**: `D15`, cap. 03 §3.2 (`S18`), cap. 02 §2.2, §2.5 y §2.6, `DEC-RF-002`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:58, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:144

<a id="guard-g-r1-d"></a>

### `GUARD:G-R1-D` · `G-R1-D`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B7](10-corte/B7.md#pieza-b7)
- **Fuente de la asignación**: `B/descomposicion.md:141`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: un camino **reactiva** una fila —`S5`, `S7`, el efecto de `MP1` o **el de `MP4`**— que en ese instante es la **predecesora de una sucesión en curso** (tiene una sucesora **viva** con `sucede_a` apuntándola), o **reembolsa** el pago que quedó pendiente por `S19` **antes** de que la sucesión se resuelva
- **de dónde sale**: cap. 12 §5.3, cap. 03 §3.2 (`S5`, `S7`, `S19`) y §7.1 (`MP4`), cap. 05 §3 condición 3

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:59, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:141

<a id="guard-g-r1-e"></a>

### `GUARD:G-R1-E` · `G-R1-E`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:137`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: un **predicado sobre `sucede_a`** —en la columna *condición* de una transición, en el enunciado de un invariante o en otro guard— pregunta si **hay una fila apuntando** sin exigir que esa fila **esté viva**; o un consumidor nuevo de *«fila viva»*, *«grant vivo»* o *«ancla viva»* **no figura** en el inventario que le corresponde en `NUCLEO/01` §2.4 —son **dos** inventarios y cada término va al suyo—; **o enumera el conjunto del sujeto equivocado** —los seis de la suscripción sobre una instancia de addon, o los dos de la instancia sobre una suscripción—
- **de dónde sale**: `NUCLEO/01` §2.4 reglas 2 y 3, cap. 02 §2.2, cap. 03 §3.2 (`S17`, `S19`, **`S20`** — el único que nombra **los dos** sujetos en un mismo predicado — y **`S21`**, que nombra la suscripción por su conjunto **vivo** y la instancia por un estado **terminal**, que es el caso en que el guard tiene que no pedir la enumeración de los dos) y §8 (`A5`)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:60, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:137

<a id="guard-g-r1-f"></a>

### `GUARD:G-R1-F` · `G-R1-F`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B3](10-corte/B3.md#pieza-b3)
- **Fuente de la asignación**: `B/descomposicion.md:137`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: un camino **abre la marca `requiere_conciliación` sin nombrar un motivo** de la enumeración cerrada del cap. 02 §2.5, o nombra **uno que no está en esa tabla**; o un camino **levanta** la marca sin decir **cuál** de las abiertas; o el **listado accionable** (cap. 19 §6) la muestra **sin motivo, sin `puesta_en`, sin TODOS los pagos que lleva colgados, sin su monto total o sin el default de `DEC-RF-003`** cuando el motivo es uno de los **nueve** que devuelven plata (el séptimo, `COBRO_DUPLICADO`, desde la pendiente 6 de la FASE 8 completa, owner 2026-09-25; el octavo, `ORDEN_PAGADA_SIN_INSTANCIA`, desde la FASE 9 vuelta 2, `R4`; el noveno, `IMPORTE_COBRADO_DE_MÁS`, desde la misma vuelta, `R20`) — **y desde `DEC-RF-006` esa cláusula los alcanza a todos sin excepción**, porque el caso que `DEC-RF-004` había dejado afuera de la columna es hoy el motivo **15** y lleva su `SÍ` propio (cap. 02 §2.5); **o `S21` abre los DOS motivos que le tocan —el 14 y el 15— sobre la misma suscripción**: son motivos distintos, así que el `UNIQUE(subscription_id, motivo)` **no los excluye** y la base los aceptaría, dejando dos propuestas contradictorias sobre el mismo pago — lo que los mantiene separados es que el disparador es **uno solo**, y el argumento está en cap. 02 §2.2; **o un camino que escribe un hecho con plata sobre una fila que ya tiene una marca abierta de ese mismo motivo no lo CUELGA de ella** —abrir una segunda, descartar el hecho o dejar que el `UNIQUE` lo rechace son las tres formas de perderlo (cap. 02 §2.2)—; **o un camino levanta una marca con algún pago colgado sin resolver** (cap. 03 §3.2, `S15`); **o un consumidor nuevo de *«marca abierta»* (`NUCLEO/01` §2.5) o de *«cortesía diferida»* (§2.6) no figura** en su inventario —son el **tercer** y el **cuarto** inventario del glosario y **ninguno** es de `G-R1-E`—; **o un camino CIERRA el saldo de una cortesía diferida sin escribir las DOS columnas del cierre** —`saldo_cerrado_en` y un `motivo_cierre` de la enumeración cerrada del cap. 02 §2.4—, **o lo cierra desde un acto que esa enumeración no nombra**: es la mitad que hace cumplir que otorgar un grant **no** cierre un saldo diferido (cap. 14 §4.3, `DEC-GRANT-011`)
- **de dónde sale**: cap. 02 §2.2, §2.4 y §2.5, cap. 03 §3.2 (**`S3`**, `S14`, `S15`, `S18`, **`S21`**; revisión del owner, 2026-09-28, C8), cap. 09 §3, cap. 14 §4.3, **cap. 16 §4.3**, cap. 19 §6, `NUCLEO/01` §2.5 y §2.6, `DEC-RF-002`, `DEC-RF-003`, **`DEC-RF-006`**, `DEC-GRANT-011`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:61, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:137

<a id="guard-g15"></a>

### `GUARD:G15` · `G15`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **las dos listas del proveedor falso, con dos predicados**: (a) el falso **miente en un lugar que no está en la lista cerrada de mentiras del §3.2**, o una fila de esa lista **no tiene los tres datos**: su nombre, la fila de la matriz de la que sale (con fecha y cuenta) y la prueba que demuestra que el código la resiste; (b) una prueba **apaga una mentira sin nombrarla o sin decir por qué**. **El mensaje nombra el predicado que falló**
- **de dónde sale**: revisión del owner, 2026-09-28, C13 y `L3-c` (§3.2). Lo construye `B1`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:66, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="guard-g16"></a>

### `GUARD:G16` · `G16`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **el cobro vuelve a depender de lo que dejó**, con dos predicados: (a) aparece **`@qazuor/qzpay`**, cualquiera de sus paquetes, en un `package.json` o en un import **del repo** (verificación corta, 2026-09-29, lote N-A); (b) el package del cobro **importa de `apps/`**. **El mensaje nombra el predicado que falló**
- **de dónde sale**: revisión del owner, 2026-09-28, N2 (`B/spec.md` §3.1). Lo construye `B1`. **Que el package del cobro no importe de la mitad de verticales ya lo vigila `G14`** (`V/20` §2), y no se duplica acá. **No mira sus dependencias hacia packages internos de Hospeda** (`@repo/*`): el package del cobro puede tenerlas, con la regla del owner de evitarlas cuando sea simple; la prohibición de `qzpay` sigue (revisión del owner, casos vecinos, 2026-09-29, caso 30). **Mira todo el repo desde que nace** (verificación corta, 2026-09-29, lote N-A): el cobro viejo, con los cinco `package.json` que declaraban `qzpay` el 2026-09-29 (`apps/api`, `apps/admin`, `packages/billing`, `packages/db` y `packages/service-core`), sale de la rama en la limpieza del principio, antes de `B1` (`16-fase-7…` §4.6), así que el guard nace verde y sin lista de pendientes. El sistema viejo sigue cobrando en producción desde `main` hasta el paso 3 del corte, y `main` no pasa por este guard hasta que el corte la reemplaza

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:67, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

<a id="guard-g17"></a>

### `GUARD:G17` · `G17`

- **Pieza dueña** (su AC vive en el archivo de la pieza): [B1](10-corte/B1.md#pieza-b1)
- **Fuente de la asignación**: `B/descomposicion.md:135`
- **Dónde corre**: en CI, sobre el árbol de fuentes — la capa *guards* de `B/20-testing.md` §1: qué cubre: *«propiedades del **código**, no de una ejecución»*; contra qué corre: *«el árbol de fuentes, en CI»*.
- **Test mínimo** ([AN](01-decisiones-vigentes.md#own-41-corte-del-mvp-t2-an)): guard estático con su prueba de mutación (romperlo a propósito y ver que falla, `B/20-testing.md` §2.1), en la pieza dueña.
- **qué falla si se rompe**: **una decisión sale de lo que dice un aviso del proveedor sin releerlo por id**, con tres predicados: (a) el código que recibe un aviso, por cualquiera de los dos canales, **lee del cuerpo otra cosa que el tipo de recurso, su id y su `version`** (la `version` es la que descarta un aviso viejo, `B/03` §10.1, y no es estado); (b) una transición de las tablas de `B/03` o una acción administrativa de `NUCLEO/08` §3 cuya condición depende del estado del proveedor **recibe ese estado por otro camino que una lectura por id del adaptador**, el tipo que sólo el adaptador construye; **(c) algo lee `provider_notification`**, la tabla donde el receptor guarda las entregas de los dos canales, IPN y Webhooks, cada una con su canal (`B/02` §2.7): la escriben sólo el receptor y el borrado de sus 180 días, y ninguna transición, acción administrativa, barrido ni otro código la lee, **tampoco el receptor, ni para la entrega de Webhooks que procesa** (mediciones del 2026-09-29, M-2; los dos canales y el nombre, lote L-B). **El mensaje nombra el predicado que falló**. **El *cuándo* no es otro predicado: va dentro del tipo** (revisión del owner, casos vecinos, 2026-09-29, caso 35). Cada lectura por id lleva el instante en que se leyó, y el tipo sólo entrega el estado contra el comienzo del acto que decide: una lectura anterior a ese comienzo se rechaza y hay que releer. Con eso (b) alcanza, porque el único camino al estado ya exige el instante; el rechazo lo prueba un caso de `B1`, no el guard
- **de dónde sale**: `D17` y su quinta entrada (`NUCLEO/04` §3; revisión del owner, 2026-09-28, N4 y `L3-f`). Lo construye `B1`

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:68, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:32, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:135

## Matriz de validación de Mercado Pago (`D/06`)

Las filas de la matriz son **sólo citables** ([AX](01-decisiones-vigentes.md#own-41-corte-del-mvp-t5-ax)): no exigen AC propio; las citan los ítems y las piezas que se apoyan en ellas. Cada fila va con todas sus columnas.

## Matriz · Preapproval

## Matriz · Preapproval — las filas

<a id="mp-pa-1"></a>

### `MP:PA-1` · Creación por API

- **Comportamiento**: Creación por API
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `201`, `status: pending`, `init_point` presente, sin cobrar

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:172

<a id="mp-pa-2"></a>

### `MP:PA-2` · Linking con nuestro dominio desde el inicio

- **Comportamiento**: Linking con nuestro dominio desde el inicio
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `external_reference` se acepta y vuelve en la respuesta y en el `GET`. **Pero el `search` no filtra por él** — ver `RC-1`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:173

<a id="mp-pa-3"></a>

### `MP:PA-3` · Autorización por el usuario

- **Comportamiento**: Autorización por el usuario
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Se autoriza por API, sin navegador**: `card_token_id` + `status:"authorized"` → `201` autorizada. **Y cobra en el acto** si no se manda `start_date` — **pero eso es SANDBOX. En PRODUCCIÓN DIVERGE**: medido el 2026-09-15, autorizar deja un `card_validation` de ARS 0 y **el cobro llega ~26 minutos después** (creación 19:35, cobro 20:01, cuatro sujetos). Es la única divergencia de COMPORTAMIENTO —no de permisos— encontrada entre los dos entornos. **Consecuencia**: entre autorizar y cobrar hay una ventana de media hora con la suscripción `authorized` y sin pagar; cualquier lógica que pregunte "¿ya pagó?" justo después del alta lee que no

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:174

<a id="mp-pa-4"></a>

### `MP:PA-4` · Rechazo

- **Comportamiento**: Rechazo
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 05/07 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Una tarjeta que va a rechazar NO llega a crear la suscripción**: la validación ocurre antes. Titular `FUND` y titular `OTHE`, los dos → `400 CC_VAL_433 Credit card validation has failed`. El rechazo se manifiesta como creación fallida, no como suscripción autorizada que después no cobra — y por eso **no sirve para fabricar un cobro fallido** (ver `RN-2`) 🔒 **AMPLIADO Y CERRADO el 2026-09-17** (sonda 47 (`./mp-probes/probe-47-la-tarjeta-que-pasa-y-no-cobra.mjs`)): la medición original cubría **dos** titulares (`FUND`, `OTHE`) en el camino de **creación**. Ahora son **los siete** —`CALL`, `SECU`, `CONT`, `EXPI`, `FORM`, `FUND`, `OTHE`— y en el camino de **mutación** (`PUT {card_token_id}`, el de `EX-36`): **`402` los siete, y la relectura confirma que la tarjeta no cambió**. **Con control**: `APRO` sobre el mismo sujeto y el mismo endpoint dio `200` y **sí** cambió la tarjeta. O sea que el `402` es un rechazo real y no un camino roto. **Consecuencia: en sandbox NO se puede asociar una tarjeta que rechace, ni al crear ni al mutar.** Es lo que cierra el camino de sandbox para `RN-2` con evidencia en vez de con una suposición

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:175

<a id="mp-pa-5"></a>

### `MP:PA-5` · Cancelación

- **Comportamiento**: Cancelación
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `PUT {status:"cancelled"}`. **Irreversible**: reintentar da `400`; sobre una autorizada, `400 "Invalid transition from cancelled to authorized"`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:176

<a id="mp-pa-6"></a>

### `MP:PA-6` · ¿El proveedor cancela el preapproval ante **cualquier** primer cobro rechazado, o sólo ante el antifraude?

- **Comportamiento**: ¿El proveedor cancela el preapproval ante **cualquier** primer cobro rechazado, o sólo ante el antifraude?
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: lo medido: `B/12` §4.4, producción, 2026-09-17 — un primer cobro rechazado por **`cc_rejected_high_risk`** canceló el preapproval en el mismo instante
- **Conclusión**: **Sólo está medido el rechazo por antifraude.** Con otro motivo —fondos insuficientes, tarjeta vencida— no se sabe si el proveedor cancela o reintenta durante la ventana de un ciclo (`GR-3`). **No bloquea**: desde el 2026-09-25 el diseño no depende de la respuesta —`S16` corre sobre el primer rechazo leído por id y **cancela el preapproval de nuestro lado**, y si esa cancelación falla la reintenta el barrido (FASE 8 completa, residuo A de `R12`, owner)—. **No se puede fabricar a voluntad**: un rechazo por fondos exige una tarjeta real sin saldo. 📌 **2026-09-25 (FASE 9 completa, `DEC-SUB-022`)**: hay un segundo camino que toca esta fila, y tampoco la necesita para decidir: la sucesora de quien venía pagando entra en **grace** si falla su primer cobro, y el barrido diario relee su preapproval; si el proveedor lo canceló o lo pausó, corre `S6`. **La respuesta de esta fila decide cuánto dura ese grace, acotado a un día**; sigue sin bloquear 🔎 **Indicio de sandbox, no medición de producción** (2026-09-29, mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`) y batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 52 paso 10): tres primeros cobros rechazados por **`cc_rejected_other_reason`**, no por antifraude, y el proveedor canceló el preapproval las tres veces (a los 11 s, 1,95 s y 1 s). Es un rechazo simulado por la tarjeta de prueba al alta, no un ciclo, y el sandbox no responde por producción (`B/06`, regla 1)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:177

## Matriz · Frecuencias de facturación (§19)

## Matriz · Frecuencias de facturación (§19) — las filas

<a id="mp-fr-1"></a>

### `MP:FR-1` · Mensual

- **Comportamiento**: Mensual
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `frequency: 1, frequency_type: "months"`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:183

<a id="mp-fr-2"></a>

### `MP:FR-2` · Trimestral

- **Comportamiento**: Trimestral
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `frequency: 3, months`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:184

<a id="mp-fr-3"></a>

### `MP:FR-3` · Semestral

- **Comportamiento**: Semestral
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `frequency: 6, months`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:185

<a id="mp-fr-4"></a>

### `MP:FR-4` · Anual

- **Comportamiento**: Anual
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `frequency: 12, months`. **`"years"` NO existe**: `400`, válidos sólo `[days, months]`. Y `frequency: 5` se acepta: **los 4 ciclos del §19 son elección nuestra, no un límite del proveedor**. El rechazo de `"years"` **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 (sonda 26 (`./mp-probes/probe-26-re-medir-en-produccion.mjs`))

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:186

## Matriz · Renovaciones

## Matriz · Renovaciones — las filas

<a id="mp-rn-1"></a>

### `MP:RN-1` · Cobro exitoso

- **Comportamiento**: Cobro exitoso
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-16
- **Entorno**: **producción + sandbox**
- **Evidencia**: sonda 29 (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`) · segunda lectura del reloj de sandbox
- **Conclusión**: **El primer cobro funciona** (producción): `renov-ok` cobró ARS 15 (`178259523769`, `approved/accredited`, `recurring_payment`), comisión 1,20, neto 13,80. **Y la RENOVACIÓN también**, que era lo que faltaba: el 2026-09-16 a las 12:01:45 `-04` los cinco sujetos `authorized` del reloj de sandbox cobraron por **segunda** vez (`charged_quantity: 2`), un ciclo `days` después del primero. **Con 33 minutos de lag** sobre su `next_payment_date` — mismo orden que los ~26 min de `PA-3`, así que el retraso del cobro **no es una rareza del alta: es cómo cobra el proveedor**. Ninguna lógica puede preguntar "¿ya cobró?" a la hora exacta 📌 **2026-09-24, cadencia medida: el proveedor cobra en lotes al minuto `:02`, en el primero posterior a la hora de `next_payment_date`.** Trece renovaciones con fecha entre 13:13 y 13:28 `-04` entraron a las 14:01-14:02; la de la sonda 49, con fecha 17:43, entró a las 18:02. No está medido que haya lotes todas las horas

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:192

<a id="mp-rn-2"></a>

### `MP:RN-2` · Cobro fallido

- **Comportamiento**: Cobro fallido
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-22**
- **Entorno**: **producción, tarjeta real**
- **Evidencia**: lectura de `/authorized_payments/search` sobre los sujetos del reloj de producción · mails de `info@mercadopago.com`
- **Conclusión**: ✅ **CERRADA, y no por una sonda: la tarjeta del owner empezó a rechazar sola.** Lo que tres caminos deliberados no consiguieron —`PA-4` (la tarjeta mala muere antes, `400 CC_VAL_433`), `PC-2` (el monto impagable, por arriba y por abajo) y el home banking— lo produjo el uso normal: desde el **2026-09-19** los cobros de los sujetos del reloj empezaron a volver `rejected/payment_method_not_ready`. **Cinco ciclos fallidos sobre cuatro sujetos**, todos en producción con tarjeta real: `renov-ok`, `monto-sube` y `monto-baja` (ciclo del 09-20), `reembolso sobre viva` (ciclos del 09-19 **y** 09-20) y `prueba de cobro rechazado` (ciclo del 09-21, **todavía en curso al escribirse esta fila**). El sujeto existía desde el 19 y **nadie lo estaba mirando**: apareció al revisar los mails del proveedor el 09-21 por la noche. **La política completa que ese sujeto destrabó está en `GR-3`**, y con ella se desbloquean `RN-3`, `GR-1` y `GR-2`. ⚠️ **Lo que NO se puede afirmar de esta fila**: por qué la tarjeta empezó a rechazar. `payment_method_not_ready` es del emisor, no del monto ni del titular, así que **el sujeto no es reproducible a voluntad** — si la tarjeta se normaliza, se pierde. Las mediciones que dependan de él se toman **ahora**. 📌 Lo que esta fila decía antes, y quedó desmentido el 2026-09-17: ❌ **EL SUJETO NUNCA ESTUVO ARMADO, y esta fila lo afirmaba.** Corregido el **2026-09-17 13:19 `-03`**. Lo que decía: que `renov-falla3` (`0e678ead…`) había quedado en ARS 2.000.000 el 2026-09-16 12:42 `-04`. Lo que pasó: **la mutación se rechazó con `400` el 2026-09-15 12:29 `-03`** y quedó registrada en `/tmp/mp-probe-05/renov-falla3.mutacion.json` — `{"message":"Cannot pay an amount greater than $ 2000000.00","status":400}`. Se pidió **MÁS** que el techo, no el techo. La relectura post-mutación del mismo minuto lo confirma: `transaction_amount: 2000.0`, `last_modified` **sin tocar**. El sujeto cobró **2000 normal los días 15, 16 y 17** (sonda 06 del 2026-09-17: `cobros 2→3`, `cobrado_total 4000→6000`, pago `179498654880` `approved/accredited`). **La evidencia que desmentía esta fila estaba en el mismo directorio desde el 15/09 y nadie la leyó**: es exactamente el modo de falla que el invariante `D5` existe para impedir — la mutación se dio por hecha sin releer. **Sigue sin haber forma medida de fabricar un cobro fallido.** `PA-4` cerró la tarjeta mala (mueren antes con `400 CC_VAL_433`) y `PC-2` cierra el monto impagable por arriba y por abajo. ⚠️ **Y el camino de producción también se cayó**: el owner reportó el 2026-09-17 que su tarjeta está pausada en el home banking **pero el propio home banking avisa que los débitos automáticos se siguen cobrando**, así que `apagon` (14:19 `-03`) probablemente cobre igual. Se lee lo mismo, pero ya no es el camino. 🔎 **Camino nuevo sin probar**: `mpcli tester card create --user-id <id> --scenario insufficient_funds` — el CLI oficial provisiona tarjetas de prueba con **comportamiento atado a la tarjeta**, no al nombre del titular, que es lo que `PA-4` midió. Ver el bloque de abajo

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:193

<a id="mp-rn-3"></a>

### `MP:RN-3` · Recuperación tras el fallo

- **Comportamiento**: Recuperación tras el fallo
- **Estado**: `PARTIALLY_SUPPORTED`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: **`RN-2` cerró el 2026-09-22 y esta fila ya NO depende de ella: el sujeto existe.** Lo que falta es un acto que no se midió — poner al día una suscripción que el proveedor pausó por mora. Y hay un obstáculo nuevo, medido: el preapproval pausado **no acepta modificaciones** (`EX-11`), así que la recuperación pasa por reactivar (`PUT {status:"authorized"}`, `PS-5`) y esperar el ciclo siguiente, no por reintentar el cobro viejo. **El cobro fallido muere con su ventana** (`GR-3`) 📌 **2026-09-24**: reactivado el 23/09, el sujeto intentó cobrar **el ciclo siguiente** en el lote del 24/09 14:02 `-04`, rechazado (`payment_method_not_ready`). **Reactivar no reintenta lo adeudado**: los ciclos vencidos no reaparecen como registros. La fila sigue abierta hasta ver si el proveedor vuelve a pausar o cobra bien. 📌 **2026-09-25, registro (FASE 9 completa, `26-fase-9-completa/01-…` `C2`)**: esta fila **no** registra que `next_payment_date` avance sobre un cobro **rechazado**, aunque `DEC-SUB-019`, `B/03` §3.2 (`S11`) y `B/02` §2.3 se lo atribuyen. Lo registrado es que avanza **estando pausada** (`PS-2`, `PS-6`; `04adf298ae`, mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`) §8) y que no se corre por pedido (`EX-34`). Sobre una `authorized` con el ciclo rechazado no hay lectura fechada: hasta que la haya, esas citas se leen *«observado, no registrado»* 📌 **2026-09-25, cerrada (lectura del 26/09 00:34 UTC, sólo `GET`, `mp-probes/leer-rn-3.py`; owner 2026-09-25)**: el sujeto reactivado `04adf298…` quedó con 5 registros (3 aprobados del 19-21/09 y 2 rechazados, `payment_method_not_ready`, del 22 y el 24/09, este último ya posterior a la reactivación) y **el proveedor lo volvió a pausar** el 25/09 14:00 `-04` (`last_modified`). **Veredicto**: reactivar una suscripción pausada por mora **retoma el cobro en el ciclo siguiente y no recupera lo adeudado**; si el medio de pago sigue fallando, **vuelve a pausar** al vencer la ventana. Por eso `PARTIALLY_SUPPORTED`: la reanudación existe, la puesta al día no. Con `DEC-SUB-019` el diseño no depende de esta fila para tarjeta (el grace corta y cancela); queda como dato

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:194

## Matriz · Grace (§20)

## Matriz · Grace (§20) — las filas

<a id="mp-gr-1"></a>

### `MP:GR-1` · **Recuperación durante el grace**

- **Comportamiento**: **Recuperación durante el grace**
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-26**
- **Entorno**: **producción, tarjeta real**
- **Evidencia**: `probe-49-la-ventana-de-reintentos.mjs` (`./mp-probes/probe-49-la-ventana-de-reintentos.mjs`) `leer` (sólo `GET`, 2026-09-26 04:33 UTC; manifiesto `~/.hos1352-sonda-49-c.json`, fuera del repo) · hora del cambio de medio: informada por el owner
- **Conclusión**: 📌 **CERRADA 2026-09-26: un pago que entra DENTRO de la ventana de reintentos cierra el ciclo fallido, y cambiar el medio de pago durante la ventana hace que el reintento cobre con el nuevo.** Sonda 49, preapproval `f0be57a1…`, ciclo de 2 días, ARS 15. El registro de cobro del 2026-09-24 18:02 `-04` estaba `rejected` (`cc_rejected_high_risk` y después `payment_method_not_ready`, `retry=3`); el owner cambió el medio de pago desde su cuenta de MP la noche del 25→26/09 y **el mismo registro** —no uno nuevo— pasó a **`approved/accredited` con `retry=4`**, `last_charged_date` 2026-09-26T00:31:45 `-04`, `charged_amount` 15→30, `expire` 2026-09-26 18:02 `-04`. **El cambio de medio dispara un reintento inmediato**: el owner informa el cambio alrededor de las 01:30 `-03` (= 00:30 `-04`) y el cobro entró a las 00:31:45 `-04`, ≈1-2 min después. 🔎 *Observado, no medido*: esa hora del cambio la dio el owner, no la API, y es **una sola muestra**; el reintento cayó **fuera del patrón de lotes al minuto :02** (`RN-1`), consistente con un reintento disparado por el cambio y no por el lote. **Ya no depende: el sujeto existe.** Pero `GR-3` reformula la pregunta — **el «grace» del proveedor dura lo que dura la ventana de un cobro, no lo que dura nuestro `GRACE_PERIOD`**. Lo que hay que medir es si un pago que entra DENTRO de esa ventana cierra el ciclo fallido, y eso no se probó. 📌 **2026-09-25 (FASE 9 completa, decisión 3a del owner)**: **condiciona a `DEC-SUB-021`** —su salida *«cambiá la tarjeta; los reintentos del proveedor cobran con ella»*—. (tachado 2026-09-26: se midió antes, con la sonda 49 de ciclo de 2 días; ver el 📌 del principio de esta celda — **la condición de `DEC-SUB-021` queda levantada**)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:200

<a id="mp-gr-2"></a>

### `MP:GR-2` · Pago tardío, después de suspender (§22)

- **Comportamiento**: Pago tardío, después de suspender (§22)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: **Ya no depende.** Y `GR-3` la vuelve más urgente: pasada la ventana el proveedor **pausa**, y sobre una pausada no se puede modificar nada (`EX-11`). El pago tardío del §22 **no tiene dónde entrar del lado del proveedor** — o se reactiva y se cobra en el ciclo siguiente, o se cobra por fuera. 📌 **2026-09-24: sobre el pagador con tarjeta la contesta el DISEÑO, no una medición, y deja de bloquear.** `DEC-SUB-019` hace que `S6` cancele el preapproval en el mismo acto de suspender, así que después de suspender **no hay pago tardío del proveedor que pueda entrar**. La fila **sigue `UNKNOWN`** por el mismo criterio que `RF-3`: el §58 no cierra una fila sin medirla. Queda abierto lo que ese diseño no cubre —el pagador manual y los bordes: un cobro ya en vuelo en el instante de `S6`, un preapproval reactivado a mano—

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:201

<a id="mp-gr-3"></a>

### `MP:GR-3` · **Política de reintentos del proveedor**

- **Comportamiento**: **Política de reintentos del proveedor**
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-22**
- **Entorno**: **producción**
- **Evidencia**: lectura de `/authorized_payments/search` sobre 4 sujetos con ciclo fallido · mails de `info@mercadopago.com` al pagador y al vendedor
- **Conclusión**: **Medida entera, y son cuatro intentos dentro de una ventana de un ciclo** (24 h en los sujetos de `1 days`; ver el 📌 del 2026-09-24 al final de esta celda). El mail al vendedor la enuncia: *«se pausó… **no recibimos el pago en la fecha original del cobro y los 3 intentos siguientes fallaron**»*, y la API la confirma campo por campo sobre **4 sujetos y 5 ciclos fallidos**: `retry_attempt` **se detiene en 4** en todos; el último reintento cae **~18 h después** del primer intento (`renov-ok`: creado 09-20T20:01:41, `last_retry` 09-21T14:07:04); y el ciclo tiene **`expire_date` = `date_created` + 24 h exactas** (sobre `1 days`: es un ciclo), campo que **ningún capítulo del corpus nombra**. Hay **lag entre el reintento programado y el ejecutado**, del mismo orden que el de `RN-1`: `next_retry` 14:04:01 → `last_retry` 14:07:04. ⚠️ **Y lo que decide el desenlace NO es agotar los reintentos sino VENCER LA VENTANA**: `prueba de cobro rechazado` llegó a `retry_attempt: 4` a las 14:05 del 09-22 y **siguió `authorized` seis horas más**, hasta su `expire_date`. En los tres sujetos que el proveedor pausó, la pausa cayó **entre 80 y 105 segundos ANTES** del `expire_date` (`renov-ok` 20:00:20 contra 20:01:41; `reembolso sobre viva` 22:00:09 contra 22:01:54). **El `status` del authorized_payment acompaña**: `scheduled` mientras la ventana está abierta, `processed` después. 🚧 **LO QUE ESTA FILA NO MIDE, y hay que decirlo**: los cinco ciclos son de sujetos con **`frequency: 1 days`**, así que *«ventana de 24 h»* y *«ventana de un ciclo»* **son indistinguibles acá**. La sonda 49 (`./mp-probes/probe-49-la-ventana-de-reintentos.mjs`) existe para separarlas con un sujeto de `2 days` **y se destrabó el 2026-09-24, al tercer intento** (los dos primeros murieron por antifraude, `cc_rejected_high_risk`, en ~83 s): ver el 📌 del final. Tampoco está medido **cuántos ciclos fallidos** hacen falta para la pausa: `renov-ok` se pausó con **uno** y `reembolso sobre viva` con **dos**, los dos con el mismo `status_detail`. 📌 **Tres casos más el 2026-09-23, y la predicción de esta fila se cumplió** (mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`)): a las **14:00:26 `-04` exactas** el proveedor pausó **tres** suscripciones a la vez (`04adf298ae`, `6b93a2928a`, `5d9dfc9d3f`) y los tres correos *«fue pausada»* de la casilla del owner son **del mismo minuto**, mientras los tres rechazos de pago correspondientes habían llegado **~12 h antes** (03:14-03:15 hora AR). **Confirma que la pausa la dispara el vencimiento de la ventana, no el agotarse de los reintentos** — que era lo que la fila afirmaba con un solo caso. 📌 **Y la pausa SÍ avisa, 5 de 5**: las cinco pausas por mora de producción emitieron `subscription.updated` con latencias de **6,21 s, 6,78 s, 7,94 s, 12,30 s y 4,60 s** (la de `monto-baja`, dos veces — ver `WH-1`). ⚠️ **Lo que NO avisa es otra cosa, y también 5 de 5**: la transición final del ciclo fallido —`scheduled` → `processed`, el instante en que el proveedor se rinde— **no emite ningún evento**. El último `invoice.updated` de `7032113610` llegó **~5 h antes** de que el ciclo se cerrara. **Ese hecho se entera por la suscripción, no por la factura** 📌 **2026-09-24, la sonda 49 se destrabó y separó las dos hipótesis.** El tercer intento de alta (`f0be57a1…`, `2 days`) autorizó, y su primer cobro de renovación (`7032218832`, creado 24/09 18:02:20 `-04`, rechazado `cc_rejected_high_risk`) trae `expire_date` 26/09 18:02:20: **48,0 h sobre un ciclo de 2 días**. Junto con los ciclos de `1 days` (24,0 h) son dos puntos de la misma regla: **la ventana de reintentos dura un ciclo, no 24 h fijas.** Releído por id el 2026-09-24 22:20 `-03`. Sigue sin medirse: (1) si la pausa cae al vencer la ventana también sobre `2 days` (se lee después del 26/09 18:02 `-04`); (2) mensual y anual, que son extrapolación

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:202

## Matriz · Pausa — `BD-MP-01`

## Matriz · Pausa — `BD-MP-01` — las filas

<a id="mp-ps-1"></a>

### `MP:PS-1` · Pausar

- **Comportamiento**: Pausar
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: La **transición** funciona (`PUT {status:"paused"}` → `200`). Los efectos sobre el cobro no se midieron: ver `PS-2`. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:208

<a id="mp-ps-2"></a>

### `MP:PS-2` · Que no cobre mientras está pausada

- **Comportamiento**: Que no cobre mientras está pausada
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **Pausada NO cobra.** `pausa-real` tenía su `next_payment_date` en el mismo instante que las cuatro que cobraron, se pausó ~26 minutos antes de que el proveedor ejecutara el ciclo, y **no cobró**. Lo que queda probado es la pregunta operativa: **pausar ANTES de que el cobro se ejecute lo evita**. ⚠️ Y un detalle que sorprende: **la pausa NO congela el calendario** — su `next_payment_date` igual se corrió +24 h sin haber cobrado

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:209

<a id="mp-ps-3"></a>

### `MP:PS-3` · Reanudación anticipada por el usuario (§26.2)

- **Comportamiento**: Reanudación anticipada por el usuario (§26.2)
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: La **transición** funciona (`PUT {status:"authorized"}` → `200`). **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:210

<a id="mp-ps-4"></a>

### `MP:PS-4` · Reanudación automática al llegar la fecha (§26.2)

- **Comportamiento**: Reanudación automática al llegar la fecha (§26.2)
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: foto de línea de base (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-linea-de-base.json`) · sonda 06 (`./mp-probes/probe-06-leer-el-reloj.sh`)
- **Conclusión**: **No existe la auto-reanudación.** `pausa-real` se pausó el 2026-09-15 ~12:29 y a las **24,5 h** (2026-09-16T12:54:45-03) seguía `paused`, con `last_modified` todavía en el instante de la pausa: nadie la movió, y el proveedor tampoco. Concuerda con la doc oficial, que sólo ofrece reactivar con un `PUT {status:"authorized"}` — **MP no tiene un `pauseUntil`**: la fecha de fin de pausa es un concepto NUESTRO y el reloj que la dispara tiene que ser nuestro

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:211

<a id="mp-ps-5"></a>

### `MP:PS-5` · Qué pasa con las fechas al reanudar

- **Comportamiento**: Qué pasa con las fechas al reanudar
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: antes (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-antes-de-reanudar.json`) · después (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-despues-de-reanudar.json`)
- **Conclusión**: **Reanudar cambia SÓLO el `status`.** Sobre una pausa **real de 24,5 h**, el `PUT {status:"authorized"}` (2026-09-16T12:56:15-03, confirmado por `last_modified`, no por el 200) dejó `next_payment_date` **clavado en 2026-09-17T11:28:03-04**, el mismo valor que ya tenía pausada. Ni se adelanta ni se corre. Re-leído a los 3 min: idéntico

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:212

<a id="mp-ps-6"></a>

### `MP:PS-6` · Qué pasa con la fecha de cobro al reanudar (§26.4)

- **Comportamiento**: Qué pasa con la fecha de cobro al reanudar (§26.4)
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox + **producción**
- **Evidencia**: antes (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-antes-de-reanudar.json`) · después (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-despues-de-reanudar.json`) · `PS-2` (prod)
- **Conclusión**: **El período pagado durante la pausa se PIERDE, y el proveedor no ofrece nada para recuperarlo.** Tres hechos encadenados: (1) pausar **no** corre la fecha en el acto — cadena crear→pausar→reanudar de las sondas 07/07b (`./mp-probes/probe-07-que-se-puede-sobre-una-pausada.sh`), segundos, `next` idéntico en los tres pasos; (2) el ciclo que vence **estando pausada** igual avanza `next_payment_date` +1 ciclo sin cobrar — `pausa-real` nació con `next`=2026-09-16T11:28:03-04 (creacion.log (`./mp-probes/fotos-reloj-2026-09-16/creacion-del-reloj-2026-09-15.log`)) y al día siguiente leía **2026-09-17** (línea de base (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-linea-de-base.json`)), y lo mismo se había medido ya en **producción** (`PS-2`); (3) al reanudar no hay cobro de recuperación ni deuda acumulada (`cobros`=1, `charged_amount`=2000, sin `pending_charge_*`). **Conclusión: §26.4 NO es delegable a MP.** Si el usuario no debe perder días pagos, los sostenemos nosotros — mismo patrón que `DEC-SUB-009` ✅ **RE-CONFIRMADO EN EL VENCIMIENTO 2** el 2026-09-17 13:05 `-03` (sonda 06 (`./mp-probes/probe-06-leer-el-reloj.sh`)): `pausa-real` sigue `paused`, la fecha corrió **2026-09-17 → 2026-09-18** `11:28:03 -04` y **no cobró** — `cobros` se quedó en **1** y `cobrado_total` en **2000**. Era la condición que `DEC-SUB-010` declaraba pendiente: el corrimiento estaba medido **una sola vez, con un vencimiento**, y toda la aritmética de la pausa lo necesita en el 2 y el 3. **Con el 2 medido, la decisión NO se reabre.** Falta el 3, que se lee el 2026-09-18

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:213

## Matriz · Cancelación (§24)

## Matriz · Cancelación (§24) — las filas

<a id="mp-cn-1"></a>

### `MP:CN-1` · Cancelación programada a fin de período

- **Comportamiento**: Cancelación programada a fin de período
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 12 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Existe, pero sólo se puede fijar AL CREAR.** `auto_recurring.end_date` en la creación: `201` y **sobrevive a la relectura**. El mismo campo sobre una suscripción **ya autorizada**: `200` y **no aparece en la relectura** — sexto caso del §0. Consecuencia: una baja a fin de período **pedida después** hay que **emularla** con un cron, y un cron que se cae deja cobrando a quien pidió la baja. La mitad buena —`end_date` al crear— **RE-VERIFICADA EN PRODUCCIÓN** el 2026-09-15 (sonda 26 (`./mp-probes/probe-26-re-medir-en-produccion.mjs`)): se acepta y sobrevive a la relectura. Y la mala también: **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**, el `end_date` sobre una autorizada vuelve a dar `200` sin aparecer en la relectura, solo y acompañado de un cambio de monto

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:219

<a id="mp-cn-2"></a>

### `MP:CN-2` · Comportamiento inmediato del proveedor

- **Comportamiento**: Comportamiento inmediato del proveedor
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: Cancelación inmediata e **irreversible**, igual que `PA-5`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:220

## Matriz · Cambios de precio — `BD-MP-03` (§29)

### Matriz · Cambios de precio — `BD-MP-03` (§29) — texto de la fuente

Texto de `D/06-mp-validation-matrix.md:222–232`, sin lo tachado:

> `PC-3` decide si se pueden actualizar precios sin perder la base instalada. `PC-2` también
> alimenta el piso de `A-PROMO-01` y la estrategia de bajar el monto de `BD-MP-02`.

## Matriz · Cambios de precio — `BD-MP-03` (§29) — las filas

<a id="mp-pc-1"></a>

### `MP:PC-1` · Sobre una suscripción existente ya autorizada

- **Comportamiento**: Sobre una suscripción existente ya autorizada
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **El monto SÍ se muta sobre una autorizada**: 1500→2200→15→1500, todos `200`, verificado por relectura. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:226

<a id="mp-pc-2"></a>

### `MP:PC-2` · Limitaciones: pisos, topes, magnitud del cambio

- **Comportamiento**: Limitaciones: pisos, topes, magnitud del cambio
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02/05 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Rango ARS 15 a ARS 2.000.000.** Piso: `400 "Cannot pay an amount lower than $ 15.00"`; cero y negativo, `400 "must be a positive number"`. Techo: `400 "Cannot pay an amount greater than $ 2000000.00"`. **Ninguna magnitud de cambio fue rechazada dentro del rango** (2000→15 y 2000→4000 pasaron). **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 (sonda 26 (`./mp-probes/probe-26-re-medir-en-produccion.mjs`)): 14 y 2.000.001 dan los mismos dos rechazos, palabra por palabra

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:227

<a id="mp-pc-3"></a>

### `MP:PC-3` · ¿Requiere nuevo consentimiento del usuario?

- **Comportamiento**: ¿Requiere nuevo consentimiento del usuario?
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox **+ producción**
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Dos mitades, y el §60 pide las dos.** **Consentimiento**: NO requiere uno nuevo — la mutación se aplica sola y la suscripción sigue `authorized` con su medio de pago (re-verificado en producción con tarjeta real). **Notificación**: **el proveedor SÍ le avisa al cliente, por su cuenta y por correo**, diciendo *"El vendedor Hospeda cambió el monto"* (`EX-3`). Y como `EX-15` midió que mutar el monto **no emite webhook**, **el cliente se entera antes que nuestro propio sistema**. Un cambio de precio silencioso **no existe**, y nuestra comunicación sobre el tema llega segunda o es redundante

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:228

## Matriz · Upgrade (§27)

## Matriz · Upgrade (§27) — las filas

<a id="mp-up-1"></a>

### `MP:UP-1` · Aplicación inmediata

- **Comportamiento**: Aplicación inmediata
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox **+ producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **El monto nuevo queda aplicado en el acto** (verificado por relectura) y **se cobra en el cobro siguiente**: `monto-sube` nació en 15, se subió a 30, y **cobró 30** (`178259807447`). `next_payment_date` no se mueve por la mutación

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:237

<a id="mp-up-2"></a>

### `MP:UP-2` · Efecto económico: prorrateo, cobro inmediato, o nada

- **Comportamiento**: Efecto económico: prorrateo, cobro inmediato, o nada
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox **+ producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **NO hay prorrateo y NO hay cobro inmediato de la diferencia.** El efecto es simple: **se cobra el monto VIGENTE al momento del cobro**, no el del alta. Medido con dos sujetos en direcciones opuestas — `monto-sube` 15→30 cobró **30**, `monto-baja` 30→15 cobró **15**. ⚠️ Eso medía un cambio aplicado **antes del primer cobro**. **La lectura del 2026-09-16 cerró la advertencia: la regla se sostiene sobre una suscripción que YA COBRÓ.** Los tres sujetos de sandbox habían cobrado 2000 en su primer ciclo, se les mutó el monto después, y en la **segunda** renovación cobraron el monto nuevo — `monto-sube` **4000**, `monto-baja` **1000**, `cortesia-piso` **15** —, cada uno acumulando sobre los 2000 originales (`charged_amount` 6000 / 3000 / 2015). **No hay prorrateo ni ajuste retroactivo en ninguna de las dos direcciones**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:238

## Matriz · Downgrade (§28)

## Matriz · Downgrade (§28) — las filas

<a id="mp-dw-1"></a>

### `MP:DW-1` · Aplicación al ciclo siguiente

- **Comportamiento**: Aplicación al ciclo siguiente
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **Se aplica al cobro siguiente, sin emular nada**: `monto-baja` nació en 30, se bajó a 15 y **cobró 15** (`178259931089`). Misma regla que `UP-2`, en la otra dirección. **Confirmado el 2026-09-16 sobre una suscripción que YA HABÍA COBRADO**: el `monto-baja` de sandbox cobró 2000 en su primer ciclo, se lo bajó a 1000 después, y en la **segunda** renovación cobró **1000** (`charged_amount` 3000). Sin prorrateo ni ajuste retroactivo

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:244

<a id="mp-dw-2"></a>

### `MP:DW-2` · ¿Lo soporta el proveedor, o hay que emularlo?

- **Comportamiento**: ¿Lo soporta el proveedor, o hay que emularlo?
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **Lo soporta el proveedor: no hay que emularlo.** Mutar el monto hacia abajo alcanza, y el cobro siguiente sale por el monto nuevo

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:245

## Matriz · Cortesía temporal — `BD-MP-02` (§34.2)

## Matriz · Cortesía temporal — `BD-MP-02` (§34.2) — las filas

<a id="mp-ct-1"></a>

### `MP:CT-1` · N meses gratis sobre una suscripción viva

- **Comportamiento**: N meses gratis sobre una suscripción viva
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **Funciona, pero "gratis" no existe.** Bajar al piso sobre una suscripción viva se aplica y **el cobro siguiente sale por el monto nuevo** (`monto-baja` cobró 15). **La cortesía más barata que permite el proveedor es ARS 15 por ciclo**, no cero (`PC-2`). Para cortesía REAL de N meses hay que pausar —y entonces no se puede modificar nada (`EX-11`)— o cancelar y recrear. **Confirmado el 2026-09-16 sobre una suscripción que YA HABÍA COBRADO**: `cortesia-piso` cobró 2000 en su primer ciclo, se lo bajó al piso después, y en la **segunda** renovación cobró **ARS 15** (`charged_amount` 2015). El piso se cobra de verdad, ciclo tras ciclo. Y **`EX-35` cerró la otra puerta**: tampoco se le puede poner un `free_trial` a una suscripción viva

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:251

<a id="mp-ct-2"></a>

### `MP:CT-2` · Estrategias posibles: bajar monto / pausar / recrear / reembolsar

- **Comportamiento**: Estrategias posibles: bajar monto / pausar / recrear / reembolsar
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01-12 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Las cuatro medidas, y ninguna da "gratis" limpio.** (1) **Bajar el monto**: funciona sin re-consentimiento (`PC-1`/`PC-3`) pero el piso es **ARS 15** (`PC-2`), así que la cortesía máxima es ARS 15 por ciclo, no cero. (2) **Pausar**: la transición funciona (`PS-1`), pero estando pausada **no se puede modificar nada** (`EX-11`) — ni siquiera aplicar un cambio de precio — y si deja de cobrar lo dice el reloj (`PS-2`). (3) **Cancelar y recrear**: funciona (`EX-8`/`EX-10`) pero **le pide el código de seguridad al cliente** (`EX-9`). (4) **Cobrar y reembolsar**: **no se puede pedir** desde esta cuenta (`RF-1`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:252

<a id="mp-ct-3"></a>

### `MP:CT-3` · Efectos colaterales de cada estrategia

- **Comportamiento**: Efectos colaterales de cada estrategia
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **El efecto colateral es que el cliente se entera, y por el proveedor.** Todo cambio de monto dispara un correo de Mercado Pago al pagador que dice **"El vendedor Hospeda cambió el monto"** (`EX-3`). Y como `EX-15` midió que mutar el monto **no emite webhook**, el proveedor **le avisa al cliente y no nos avisa a nosotros**. Una cortesía aplicada bajando el monto **no es silenciosa**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:253

## Matriz · Grant permanente (§35.3)

## Matriz · Grant permanente (§35.3) — las filas

<a id="mp-gt-1"></a>

### `MP:GT-1` · Cancelación correcta de la suscripción del proveedor

- **Comportamiento**: Cancelación correcta de la suscripción del proveedor
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 29 · primer cobro del reloj de producción (`./mp-probes/probe-29-el-reloj-de-produccion.mjs`)
- **Conclusión**: **Cancelar frena el cobro.** `cancelada` tenía su cobro agendado para el mismo instante que las otras y **no cobró**. Y a diferencia de la pausa, **la cancelación SÍ deja el calendario quieto**: su `next_payment_date` quedó congelado en la fecha vieja mientras las activas se corrían +24 h. Sigue valiendo que `next_payment_date` **no se limpia**, así que ese campo no sirve para saber si va a cobrar

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:259

## Matriz · Webhooks (§51)

## Matriz · Webhooks (§51) — las filas

<a id="mp-wh-1"></a>

### `MP:WH-1` · Duplicados

- **Comportamiento**: Duplicados
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Ocurren, y no en el camino feliz.** Con entregas exitosas: cero duplicados en tres corridas. Con el receptor en `mode=fail`: el **mismo evento** —misma `version`— llegó **dos veces a ~0,5 s**, con **ids de notificación distintos**. Eso cierra el círculo con `EX-2`: el id del evento no sirve para deduplicar y **la `version` sí**, porque en el duplicado es la misma. 📌 **Ampliado el 2026-09-23** (mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`)): sobre 532 eventos son **12 las claves duplicadas**, y el duplicado a ~0,5 s aparece **tanto en las ladders abandonadas como en las completas** de `WH-5`. **Y ahora está confirmado en PRODUCCIÓN, con plata real**: la pausa por mora de `monto-baja` llegó **dos veces**, a +7,94 s y +8,49 s del hecho (`subscription.updated`, ids de notificación distintos). O sea que el duplicado **no es un artefacto del receptor de prueba** 📌 **2026-09-29, con los dos canales escuchando** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 57): con el receptor en `500` el duplicado a ~0,5 s aparece **también por IPN** (`payment 180446362745`, +0,554 s). Con el receptor en `200`, cero claves repetidas dentro de un canal en 3 corridas. Un pago llega **una vez por canal** (dos entregas por hecho, `WH-6`); un hecho del preapproval o del `authorized_payment`, una sola vez (sólo Webhooks). IPN no trae `version` (`EX-2`): por ese canal se deduplica por el id del recurso y releyendo

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:265

<a id="mp-wh-2"></a>

### `MP:WH-2` · Demorados

- **Comportamiento**: Demorados
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Sí, y la demora es muy variable**: medida entre **0,6 s y 32 s** sobre la misma secuencia de acciones, con receptor propio. Consecuencia de método: cualquier experimento que atribuya un evento a una acción necesita espaciarlas **más que la demora máxima** — con 20 s la atribución quedaba ambigua. ❌ **Y el techo de 32 s se queda corto por tres órdenes de magnitud.** Corregido el **2026-09-23** (mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`)) sobre **471 primeras entregas**: p50 **1,7 s**, p90 **20,4 s**, **28 pasan de 32 s**, 8 pasan de 300 s y **tres llegaron a los 10,3 y 14,3 días** (`7031483906`, emitido `2026-09-02T04:03:31Z`, llegado `2026-09-16T11:22:16Z`). La consecuencia de método **se endurece**: no hay espaciado que vuelva segura la atribución por cercanía temporal, **hay que atribuir por `version` y releer el recurso**. ⚠️ **Trampa de método al medir esto**: en un evento `payment` el campo del cuerpo es `date_created` **del pago**, no del evento — restarlo fabrica «demoras» de 19 días que no son demoras. **Sólo los eventos de suscripción traen `date`** 🚫 **No se mide, por decisión del owner** (2026-09-29, decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-1): la cola de demoras largas no se re-mide. El diseño ya asume demoras de días (`B/12` §1.2) y se defiende releyendo por id y con el barrido diario (`B/09` §3), así que la cifra exacta no cambia nada

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:266

<a id="mp-wh-3"></a>

### `MP:WH-3` · Fuera de orden

- **Comportamiento**: Fuera de orden
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **No se observó desorden** en tres corridas contra una secuencia de orden conocido: las entregas llegaron en el orden causal. No prueba que no pueda pasar — las demoras van de 0,6 s a 32 s (`WH-2`), así que dos acciones juntas podrían invertirse. **Pero ya no importa tanto**: `EX-2` da un `version` monótono que permite detectar y descartar el desorden. 📌 **Ampliado el 2026-09-23** (mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`)): la muestra pasa de **3 corridas a 530 eventos sobre 9 días** y sigue en **0 inversiones de `version`** en el orden de llegada. **Sigue sin probar que no pueda pasar** —el techo de demora de `WH-2` resultó ser de días, no de 32 s—, pero sube el piso de confianza del `PARTIALLY_SUPPORTED` 🚫 **No se mide, por decisión del owner** (2026-09-29, decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-1): el desorden a volumen no se mide. El diseño lo resiste sin haberlo observado: el falso lo simula aparte de las mentiras (`B/20` §3.2) y el estado se relee, no se reconstruye (`B/03` §10.1). La fila queda `PARTIALLY_SUPPORTED` con la restricción que ya nombra

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:267

<a id="mp-wh-4"></a>

### `MP:WH-4` · Reintentos

- **Comportamiento**: Reintentos
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Reintenta ante un `500`, con backoff creciente**, ahora medido con receptor propio y no a través de la tabla normalizada de staging: duplicado inmediato a **+0,5 s**, y reintentos a **+18,8 min** y **+35,1 min** (medidos desde la entrega anterior): el backoff aproximadamente **duplica** el intervalo, y **reproduce** una observación indirecta previa. **Cuántos reintentos hace en total NO se midió**: suponer que reintenta indefinidamente sería apostar. **Y en el reintento cambian el id de notificación Y el `ts` de la firma —el proveedor RE-FIRMA— mientras la `version` del recurso se mantiene.** O sea que ni el id ni la marca de tiempo sirven para detectar una reentrega: **la `version` es lo único estable**. ❌ **Dos correcciones del 2026-09-23** (mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`)), sobre 530 eventos: (1) **hay un CUARTO reintento, a +6,07 h** (21.869,8 s; `7031971262 v1`, llegado `2026-09-16T01:40:44Z`), así que la ladder completa es de **5 entregas** y no de 4 — no se había visto porque llegó **después de que se cerrara la lectura**; (2) **el backoff NO «duplica aproximadamente»**: 1127 s → 2107 s es **1,87×**, pero 2107 s → 21.870 s es **10,4×**. La frase vale para los dos primeros saltos y **se rompe en el tercero**. 📌 Y **0 ids de notificación repetidos en 530 eventos** confirma la re-identificación por reentrega a escala. 🚧 **Lo que sigue sin medirse es si la ladder termina en la 5ª**: `WH-5` midió que **sí termina, pero por otra razón** —la supersesión la aborta antes—, así que el tope del backoff en una ladder que nadie supersede sigue sin conocerse 📌 **2026-09-29, la escalera inicial en los dos canales** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 57): **IPN también reintenta** (`payment 180446362745`: duplicado a +0,554 s, reintento a +1030 s). Por Webhooks el primer reintento cayó a **994 s, 1004 s y 1224 s** del duplicado (contra los 1127 s del 2026-09-15): **no es un intervalo fijo**. Cada reentrega trae otro `x-request-id` y otro `ts` de firma en **los dos** canales, y en Webhooks también otro `id` de cuerpo; sólo la `version` se mantiene. La escalera completa no se re-midió (exige horas con el receptor compartido en `fail`) 🚫 **No se mide, por decisión del owner** (2026-09-29, decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-1): la escalera completa no se mide. El diseño no depende de cuántos reintentos hay ni de cuándo terminan: una entrega que no llega la ve el barrido diario (`B/09` §3)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:268

<a id="mp-wh-5"></a>

### `MP:WH-5` · Faltantes: un evento que nunca llega

- **Comportamiento**: Faltantes: un evento que nunca llega
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-29**
- **Entorno**: **sandbox (el mecanismo) + producción (el alcance y el canal)**
- **Evidencia**: mediciones del 23/09 (`./mp-probes/RESULTS-2026-09-23.md`) · 532 eventos del receptor propio + `billing_webhook_events` de producción · mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`) · batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sondas 52 y 57 · logs de la API de producción (`./mp-probes/RESULTS-2026-09-29.md#anexo-la-lectura-de-producción-para-wh-5-y-wh-6-2909-tarde`)
- **Conclusión**: ⚠️ **Reabierta el 2026-09-28 (revisión del owner, 2026-09-28, N9, `L3-g`): el mecanismo sigue `VERIFIED` en sandbox, y el alcance de producción se remide.** *«2 de 2 cancelaciones por antifraude no produjeron `subscription.updated`»* se leyó en `billing_webhook_events`, que está **después** del descarte del receptor de hospeda2: el filtro `source_news=webhooks` (HOS-159) contesta `200` y descarta en silencio toda entrega IPN, con log `debug`. Hay una tercera explicación, además de pérdida o no notificación: llegó por IPN y se descartó. Se repite a propósito con los dos canales escuchando (`WH-6`). **SÍ se pierden entregas, y el mecanismo tiene nombre: SUPERSESIÓN — el proveedor abandona el reintento de un estado intermedio en cuanto emite uno más nuevo del mismo recurso.** Distinto de `EX-15`, que es un evento que **nunca existe**; acá se mide una entrega que se pierde. Medido sobre las **12 claves `(recurso, version)`** cuya primera entrega cayó en la ventana de `500` del interruptor `mode=fail` (54,5 min del 2026-09-15, 18:42:19Z → 19:36:48Z): **6 recibieron la ladder completa —5 entregas: +0,6 s, +18,8 min, +35,1 min, +6,07 h— y 6 quedaron en 2 entregas y nunca volvieron.** **El corte es limpio, 6 de 6**: en cada recurso la `version` **más baja** es la abandonada y la **más alta** la que insiste (`6738c7fb` v2→x2 / v5→x5 · `f02ce43b` v2→x2 / v4→x5 · `2378cc30` v3→x2 / v4→x5 · `7031971262` v0→x2 / v1→x5 · `7031971273` v0→x2 / v1→x5 · `7031971271` v1→x2 / v2→x5). **La garantía de reintento es por recurso-último, no por evento.** ⚠️ **Consecuencia de diseño, y atraviesa el capítulo de webhooks entero**: **no se puede reconstruir estado desde la secuencia de eventos.** El evento sirve de **disparador** y **el estado se relee**. 🔎 **En producción el alcance de la pérdida es acotado**: sobre 8 días, los **32 ciclos de cobro**, los **26 pagos** y las **5 pausas por mora** recibieron su aviso (latencia p50 **1,11 s**; las pausas entre 4,60 y 12,30 s). Es consistente con el mecanismo, porque **el estado terminal siempre llega**. 🚧 **Lo que NO se pudo separar**: 2 de 2 cancelaciones por antifraude (`792eb006`, `80a633be`) no produjeron `subscription.updated` y **no están en el dead-letter**, mientras el `invoice.updated` del mismo sujeto emitido en la misma ventana de 5 s sí llegó. Puede ser pérdida o puede ser un `pending → cancelled` que no se notifica; **hace falta repetirlo a propósito.** 📌 **El `mode=fail` no se corrió para esta fila**: la evidencia estaba en la corrida del 2026-09-15 y nadie la había leído — la 5ª entrega llegó **a las 7 horas**, después de que se cerrara la lectura. ⚠️ **Y el receptor de la sonda 08 NO recibe eventos de producción**, contra lo que se venía suponiendo: sus 319 eventos de suscripción son de la aplicación `2671930029336144` y sus 211 eventos `payment` del usuario `3497260543` (el vendedor de prueba), mientras **las 108 preapprovals de producción son de `1890101689209057` y ninguna tiene `notification_url`**; la intersección de ids es **vacía** y tres pagos del sink leídos con el token de producción dan **404**. Sirve para medir **el mecanismo**, no qué pasó en producción — para eso está `billing_webhook_events` ✅ **Cerrada el 2026-09-29** (reabierta a `PARTIALLY_SUPPORTED` el 2026-09-28; mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`), batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), logs de producción (`./mp-probes/RESULTS-2026-09-29.md#anexo-la-lectura-de-producción-para-wh-5-y-wh-6-2909-tarde`)). **La tercera explicación, «llegó por IPN y se descartó», queda descartada por el canal, en los dos entornos**: IPN entrega sólo `payment` (sandbox 12 de 12; producción 8 de 8 entre el 2026-09-25 y el 2026-09-29), así que el filtro `source_news=webhooks` (HOS-159) sólo pudo haber descartado el `payment` gemelo, que también llega por Webhooks. **Y la no notificación se reprodujo a propósito 3 de 3 en sandbox**: un alta `authorized` con tarjeta rechazada (`400` sin id, `EX-55`) que el proveedor cancela a los 11 s, 1,95 s y 1 s, con el receptor contestando `200` a todo, trae su `payment` y su `authorized_payment` y **ningún `subscription_preapproval` por ningún canal**. Sin una entrega fallida no hay reintento que la supersesión pueda abandonar: **esa transición no se notifica**, no se pierde. **La supersesión, re-medida con los dos canales**: 2 de 2 versiones viejas abandonadas (`authorized_payment 7032364572` v0 y preapproval `08e69374…` v2) y sus sucesoras reintentadas a +1004 s y +1224 s; IPN no la compensa porque no entrega esos tópicos. 🚧 **Lo que no se recupera**: la entrega de `792eb006…` del 2026-09-21, porque los logs de producción empiezan el 2026-09-25 10:33; eso es «no recuperable», no «no llegó». 🔎 **Dato lateral de producción, sin interpretar**: el 2026-09-28 11:02:32 llegó por Webhooks un `subscription_authorized_payment` sobre `80a633be…` (la otra cancelación por antifraude, ya `cancelled` en la lectura del 2026-09-23), y el receptor de hospeda2 lo rechazó para forzar un reintento (`ERROR` *«no local subscription found for preapproval ID even after the HOS-276 linking fallback — payment NOT recorded, forcing a retry»*; `WARN` HOS-191 *«could not resolve preapproval_plan_id»*). El log no dice si es un reciclado del cobro rechazado o un registro de un ciclo nuevo (ver `EX-44`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:269

<a id="mp-wh-6"></a>

### `MP:WH-6`

- **Comportamiento**: ¿Qué entrega el proveedor por el canal IPN y qué por Webhooks, con las dos URL de la aplicación apuntadas al receptor, y cuántas entregas duplicadas produce un mismo hecho entre los dos?
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-29**
- **Entorno**: **sandbox (los dos canales) + producción (logs, sólo lectura)**
- **Evidencia**: mediciones del 29/09, anexo (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`) · batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`) · sondas 52 (corridas 2 y 3), 55, 56 y 57 · logs de la API de producción (`./mp-probes/RESULTS-2026-09-29.md#anexo-la-lectura-de-producción-para-wh-5-y-wh-6-2909-tarde`)
- **Conclusión**: Secuencia de la sonda 09 (crear, mutar monto, pausar, reanudar, cancelar) con 90 s entre acciones, más la cancelación del comprador de `EX-52` y un pago por `/v1/orders`. Abierta el 2026-09-28 (revisión del owner, 2026-09-28, N9, `L3-g`): el receptor de hospeda2 descarta en silencio toda entrega IPN (filtro `source_news=webhooks`, HOS-159), y las filas medidas con un solo canal escuchando se reabren hasta medir ésta (`WH-5`, `EX-15`) · 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 39 y G-D)**: 📌 **Precisada otra vez el 2026-09-29, con OK del owner (decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-2, que reemplaza a los casos 39 y G-D; y lote L-B)**: medida la fila, el receptor nuevo igual escucha IPN y guarda cada entrega sin actuar, en `provider_notification`, una tabla sólo de altas que ninguna decisión lee y que `G17` nombra, con 180 días de retención técnica (`B/02` §2.7). Procesa sólo la entrega `payment` de Webhooks, y guarda también cada entrega de Webhooks en la misma tabla, con su canal, sin que nadie la lea, para que la revisión tenga los dos lados (lote L-B). El panel de producción queda con IPN activo, y se revisa tres meses después del corte (HOS-1399 (`https://linear.app/hospeda-beta/issue/HOS-1399`)). ✅ **Medida el 2026-09-29 con los dos canales escuchando** (anexo del 29/09 (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`), sonda 52 corrida 2 y `EX-52`; batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sondas 52 corrida 3, 56 y 57; logs de producción (`./mp-probes/RESULTS-2026-09-29.md#anexo-la-lectura-de-producción-para-wh-5-y-wh-6-2909-tarde`)). **IPN entrega sólo `payment`**: 12 de 12 entregas del día en sandbox (cuerpo `{"resource","topic"}`, `user-agent: MercadoPago Feed v2.0`, sin `action`, `date` ni `version`), incluidos los `payment` de ARS 0 de validación de tarjeta; y **8 de 8 en producción** entre el 2026-09-25 y el 2026-09-29 (cruzadas por id: son los mismos 8 pagos que llegaron por Webhooks, uno a uno), contra 8 `payment`, 65 `subscription_authorized_payment` y 5 `subscription_preapproval` por Webhooks. **Webhooks entrega `payment`, `subscription_authorized_payment` y `subscription_preapproval`**. Un pago produce **exactamente dos entregas**, una por canal, a 2-334 ms entre sí y **sin canal que llegue primero** (IPN primero en 1 de 4 pares a la mañana y en 3 de 6 a la tarde); un hecho del preapproval o del `authorized_payment` produce **una**, sólo por Webhooks. **IPN no avisa** la subida de monto, la pausa, la cancelación del comprador ni la del proveedor tras un rechazo. **IPN también reintenta** (`WH-4`) y **no verifica la firma** con la clave de la aplicación (`EX-13`). Órdenes de `/v1/orders` y sus reembolsos: **cero entregas por ningún canal** en sandbox, con *Order* tildado (la API sigue leyendo `notifications_topics: []`, que no refleja el panel). ⚠️ **«Sólo `payment`» vale para lo medido: desde el 2026-09-25 en producción y el 2026-09-29 en sandbox (suscripciones, órdenes y cambios de tarjeta)**: `RF-7` midió en producción un `topic=merchant_order` por IPN tras un reembolso de `/v1/payments`. Consecuencia: **descartar IPN no pierde ningún hecho de suscripción**, y escuchar los dos obliga a deduplicar `payment` por el id del recurso entre canales

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:270

## Matriz · Reconciliación (§23)

## Matriz · Reconciliación (§23) — las filas

<a id="mp-rc-1"></a>

### `MP:RC-1` · Consultar el estado real de una suscripción

- **Comportamiento**: Consultar el estado real de una suscripción
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`) + sonda 16 (`./mp-probes/probe-16-search-filtros.sh`)
- **Conclusión**: **`GET /preapproval/{id}` es confiable.** Del `search`, medido con control de basura sobre **153** suscripciones: **`payer_email` filtra** (basura → 0), **`status` filtra** (los 4 estados suman exactamente 153) y **los dos se componen**; **`external_reference` SE IGNORA** (basura → las 153). `/v1/payments/search` sí filtra por `external_reference`. **En PRODUCCIÓN (2026-09-15, sonda 21) aparece un tercer defecto que el sandbox no tenía: el filtro devuelve un SUBCONJUNTO.** `status=cancelled` trae **15** filas —paginadas y contadas, no es un `total` aproximado— y recorriendo las 76 sin filtro hay **69** canceladas. Faltan 54 y no hay ninguna señal de que falten. Los tres modos fallan en tres direcciones distintas: `external_reference` devuelve **TODO**, un `status` inválido devuelve **NADA**, y `status=cancelled` devuelve **ALGO PLAUSIBLE**. **El `search` no sirve como fuente de verdad de un barrido**: el estado se lee con `GET /preapproval/{id}` contra ids propios. 📌 **2026-09-25 (FASE 9 completa, `02-…` `AO-6`, decisión 2f del owner)**: el **recorrido sin filtro** que esta fila usa como referencia (*«recorriendo las 76 sin filtro»*) **nunca se contrastó con nada**, y el corte se apoya en él (`16-fase-7…` §4.2, paso 1b). No se mide: **el gate del paso 2 lo verifica en el momento** —el conteo tiene que igualar el `total` del paginado y todo id conocido tiene que aparecer—, y si no, el corte no avanza (`DEC-MIG-003`, 📌 del 2026-09-25)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:276

<a id="mp-rc-2"></a>

### `MP:RC-2` · Historial de pagos

- **Comportamiento**: Historial de pagos
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: Dos caminos funcionan: `/authorized_payments/search?preapproval_id=` y `/v1/payments/search?external_reference=`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:277

<a id="mp-rc-3"></a>

### `MP:RC-3` · Reparar el estado local desde el del proveedor

- **Comportamiento**: Reparar el estado local desde el del proveedor
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 31 (`./mp-probes/probe-31-contrato-de-errores-de-lectura.mjs`) + sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)
- **Conclusión**: **Hay material para reparar, y tiene límites nombrados.** A favor: (1) **`external_reference` se puede REESCRIBIR** sobre una suscripción viva (`EX-19`), así que una suscripción huérfana se puede re-vincular sin tocar al cliente; (2) **el pago hereda la referencia de la suscripción** y **`/v1/payments/search` SÍ filtra por ella**, así que los cobros se encuentran por referencia propia; (3) **un id de otra cuenta se distingue**: `GET /preapproval/{id}` devuelve `400 "not valid for callerId"`, no un `404`. En contra: (a) el `search` de preapprovals **ignora** `external_reference`, así que la referencia sirve para **reconocer**, no para **encontrar**; (b) la vía por `/v1/payments` es justo la API que `R-MP-01` dice que se descontinúa; (c) **reparar no reescribe la historia** — medido: el cobro ya hecho conservó la referencia vieja. **Falta**: si un cobro FUTURO hereda la referencia reparada. Hay un sujeto puesto para eso (`monto-sube`, referencia reescrita el 2026-09-15 21:44), se lee el 2026-09-16

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:278

<a id="mp-rc-4"></a>

### `MP:RC-4` · ¿El `search` devuelve los mismos campos que el `GET`?

- **Comportamiento**: ¿El `search` devuelve los mismos campos que el `GET`?
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 21 (`./mp-probes/probe-21-produccion-el-filtro-miente.mjs`)
- **Conclusión**: **No.** Sobre la misma suscripción y en el mismo momento, el `search` devuelve **`next_payment_date: null`** y **`summarized: {}`**, mientras el `GET` trae `next_payment_date` real y el `summarized` completo. `status`, `auto_recurring`, `payer_id` y `external_reference` sí coinciden. Un barrido que lea del `search` puede concluir que no hay próximo cobro cuando lo hay 📌 **2026-09-29** (mediciones del 29/09, anexo (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`), sandbox): **el `search` tampoco devuelve el mismo ESTADO que el `GET`**. `7eb2a11b…` se leyó `pending` con `last_modified 10:48:13` en `/preapproval/search` a +2 y a +5 min, cuando el `GET` por id ya daba `cancelled` desde las 10:48:14.950. El `search` sirve para encontrar un id, no para leer su estado

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:279

<a id="mp-rc-5"></a>

### `MP:RC-5` · **¿`summarized.charged_quantity` cuenta COBROS?**

- **Comportamiento**: **¿`summarized.charged_quantity` cuenta COBROS?**
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: **2026-09-22**
- **Entorno**: **producción**
- **Evidencia**: lectura de `/preapproval/{id}` sobre `792eb0064a…` (alta rechazada) y `6b293a9499…` (`renov-ok`)
- **Conclusión**: **NO: cuenta INTENTOS, y el capítulo de conciliación decide con él.** Dos mediciones que no se explican de otra forma: (1) el preapproval `792eb0064a…`, cuyo **único** cobro fue rechazado por el proveedor, quedó con **`charged_quantity: 1` y `charged_amount: 0`** — y de yapa **`last_charged_amount: 15`**, o sea tres campos del mismo objeto contándose distinto; (2) `renov-ok` quedó con **`charged_quantity: 6` y `charged_amount: 75`** = **cinco** cobros de ARS 15 más el rechazado contado como sexto. **Y `last_charged_date` es la fecha del ÚLTIMO INTENTO, no del último cobro**: en `renov-ok` marca `2026-09-21T14:07:03`, que es el cuarto reintento fallido (`GR-3`), no un cobro. 🚨 **Esto contradice una regla escrita**: `B/09` §4 —*«Los tres modos de «cero cobros», y ninguno se distingue solo»*— resuelve *«no cobró nunca»* con *«el preapproval tiene `charged_quantity` en cero o nulo»* y concluye que **la conciliación «concluye desde el contador del preapproval»**. Aplicada a `792eb0064a…`, esa regla da **«sí cobró»** sobre una suscripción que no cobró un peso. **Hay un cuarto modo de cero que el § no enumera: cobró cero porque el cobro se rechazó, con el contador en uno.** Se deja como **hallazgo para la FASE 8-bis-5** en vez de corregirse acá: el capítulo se arregla por el ciclo, como todo lo demás. 📌 **Precisado el 2026-09-24 (producción, cuatro sujetos): cuenta REGISTROS de cobro, no intentos.** El proveedor lleva un `authorized_payment` por ciclo, y **los reintentos de ese ciclo quedan dentro del mismo registro** —el rechazo del 22/09 de los sujetos de `RN-3` es **uno** con `retry_attempt: 4`—; `charged_quantity` igualó la cantidad de registros en los cuatro: **5/5, 5/5, 7/7 y 2/2**. Con eso el contador sí sirve, para otra pregunta: **si el inventario de intentos está completo**. **Corregido en el capítulo el mismo día**: `B/09` §4 lee *«¿cobró?»* de `payment.status` registro por registro (familia 6 de la 9-bis-5)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:280

<a id="mp-rc-6"></a>

### `MP:RC-6` · **¿El `status` de un `authorized_payment` dice si se cobró?**

- **Comportamiento**: **¿El `status` de un `authorized_payment` dice si se cobró?**
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: **2026-09-22**
- **Entorno**: **producción**
- **Evidencia**: lectura de `/authorized_payments/search` sobre los 5 ciclos fallidos de `RN-2`
- **Conclusión**: **No, y hay TRES estados donde el corpus nombraba uno.** El campo `status` del authorized_payment describe **en qué punto del ciclo de cobro está el registro**, no su resultado: los seis registros de `renov-ok` dicen **`processed`**, incluido el que el proveedor rechazó. Lo que distingue es **`payment.status`** (`approved/accredited` contra `rejected`). Los tres estados medidos: **`scheduled`** —la ventana del ciclo sigue abierta y quedan reintentos—, **`recycling`** —medido sobre las altas que el proveedor canceló al rechazar el primer cobro— y **`processed`** —la ventana venció, con cualquier desenlace—. `EX-30` usa *«`processed/accredited`»* como señal de éxito, y eso es correcto **sólo porque nombra los dos campos**: `processed` a secas no afirma nada. ⚠️ **El `status_detail` tampoco es estable**: sobre el mismo cobro de `prueba de cobro rechazado` decía **`cc_rejected_high_risk`** el 09-22T00:55 y **`payment_method_not_ready`** a las 08:06 — **es el detalle del ÚLTIMO intento, no del primero**, así que leerlo temprano describe un estado transitorio

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:281

<a id="mp-rc-7"></a>

### `MP:RC-7` · **`expire_date`: la ventana de vida de un cobro**

- **Comportamiento**: **`expire_date`: la ventana de vida de un cobro**
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-22**
- **Entorno**: **producción**
- **Evidencia**: lectura de `/authorized_payments/search` sobre 5 ciclos de `RN-2` y los cobros exitosos previos
- **Conclusión**: **Existe, la trae cada renovación, y NINGÚN capítulo del corpus la nombra.** Cada `authorized_payment` de renovación viene con `expire_date` = `date_created` **+ un ciclo** (24 h exactas en los sujetos de `1 days`) (medido en los cinco ciclos fallidos y en los cobros aprobados del 09-15 al 09-20). Es **la ventana dentro de la cual el proveedor puede cobrar ese ciclo**: agotada, el cobro muere y —según `GR-3`— el preapproval se pausa segundos antes. **No aparece en el cobro del ALTA**, sólo en las renovaciones: medido en `prueba de cobro rechazado`, el cobro del 09-17 (alta) viene sin él y los del 18, 19, 20 y 21 lo traen. 📌 **2026-09-24: no son 24 h fijas, es el ciclo** —48,0 h sobre `2 days`, ver `GR-3`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:282

<a id="mp-rc-8"></a>

### `MP:RC-8` · **Contracargo: ¿qué estado lee el pago y qué aviso llega?**

- **Comportamiento**: **Contracargo: ¿qué estado lee el pago y qué aviso llega?**
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: documentación del proveedor (*chargebacks*, consultada el 2026-09-25) — **fuente documental, sin verificar** (§58)
- **Conclusión**: Según la documentación: al iniciarse la disputa el pago pasa a **`charged_back` con `status_detail = in_process`**; al resolverse, **`settled`** (decisión contra el vendedor) o **`reimbursed`** (a favor); hay un aviso propio, **`topic_chargebacks_wh`**, que trae `payment_id`. **No se puede fabricar a voluntad**: exige una disputa real con el emisor. La usa `DEC-SUB-020` con esa salvedad declarada: lo que se decidió es qué hacemos al leer el estado, no cómo se comporta el proveedor

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:283

<a id="mp-rc-9"></a>

### `MP:RC-9` · **¿`GET /preapproval/{id}` devuelve `version`?**

- **Comportamiento**: **¿`GET /preapproval/{id}` devuelve `version`?**
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: **2026-09-25**
- **Entorno**: **producción**
- **Evidencia**: `GET` sobre `04adf298…` y `f0be57a1…`, las dos `authorized`
- **Conclusión**: **No.** Las claves de la respuesta son `application_id`, `auto_recurring`, `back_url`, `card_id`, `collector_id`, `date_created`, `external_reference`, `first_invoice_offset`, `id`, `init_point`, **`last_modified`**, `next_payment_date`, `owner`, `payer_email`, `payer_id`, `payment_method_id`, `payment_method_id_secondary`, `reason`, `status`, `subscription_id` y `summarized` — **sin `version`**. `version` viene en el **cuerpo del webhook** (`EX-2`), no en la lectura por id. **Consecuencia**: una comparación de `version` hecha sobre la relectura no tiene con qué comparar; lo que la relectura trae es `last_modified` (FASE 8 completa, `F-8CB3-010`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:284

## Matriz · ✚ Reembolsos — `M-LEGAL-01`

### Matriz · ✚ Reembolsos — `M-LEGAL-01` — texto de la fuente

Texto de `D/06-mp-validation-matrix.md:294–308`, sin lo tachado:

> El derecho de revocación con devolución total necesita poder reembolsar. También es una de
> las cuatro estrategias posibles de `BD-MP-02`.

**Y ya no es hipótesis.** Se creó una **segunda app** con producto Checkout API / API de Payments, bajo el MISMO vendedor de prueba, cuyos scopes incluyen `urn:mp:online:payments:refunds/`**`read-write`**. Con ella: reembolsar → **`401`**, y **crear un pago** (`POST /v1/payments`) → **`401` también**. O sea que **el vendedor de prueba no puede escribir sobre la API de Payments en absoluto**, cualquiera sea la app o sus scopes. Las suscripciones funcionan porque **los pagos los crea el proveedor**, no nosotros. Para medir `RF-*` hace falta una cuenta que no sea de prueba, o que soporte de MP lo habilite |

## Matriz · ✚ Reembolsos — `M-LEGAL-01` — las filas

<a id="mp-rf-1"></a>

### `MP:RF-1` · Reembolso total de un cobro

- **Comportamiento**: Reembolso total de un cobro
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 11 + ejecución directa (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Funciona.** `POST /v1/payments/{id}/refunds` **sin body** sobre un pago propio de ARS 15: `201`, refund `3269585727`, y **verificado por relectura** — el pago quedó `status: refunded`, `transaction_amount_refunded: 15`. **La variable era la CUENTA, no el código ni la API**: la misma llamada, con la misma forma, da `401` con la cuenta de prueba y entra con la real (`HOSPEDA_COM_AR`, `3497516165`, sin tag `test_user`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:301

<a id="mp-rf-2"></a>

### `MP:RF-2` · Reembolso parcial

- **Comportamiento**: Reembolso parcial
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sondas 22/23/24 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Funciona en los DOS tipos de pago** y **NO hay monto mínimo**: la conclusión anterior (*"hay un mínimo entre 5 y 50"*) era un **diagnóstico equivocado** y lo mató el primer experimento — ARS **5** entró sobre un pago de 5.000, y también sobre uno de 7.500. Lo medido: (1) el parcial **valida contra el SALDO, no contra el monto original** — pedir 15 con 10 de saldo da `400 code 2017` aunque el pago valga 5.000; (2) los **parciales acumulativos completan el total** y el pago pasa a **`refunded/refunded` solo** (5 + 5 sobre un saldo de 10); (3) se reembolsó 4.875 dejando un resto de **10**, así que tampoco hay piso del resto. Ver **`RF-8`** para el rechazo que quedó sin explicar

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:304

<a id="mp-rf-3"></a>

### `MP:RF-3` · Plazo máximo para reembolsar un cobro

- **Comportamiento**: Plazo máximo para reembolsar un cobro
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: Se reembolsó un pago de **65 días** sin problema, así que el plazo es **mayor que eso**. La documentación dice 180 días desde la aprobación, pero el §58 no acepta documentación para cerrar una fila, y forzar el borde exigiría un pago de más de 180 días que no existe todavía. 📌 **El 2026-09-24 se midió CUÁNDO va a existir, y la fila deja de ser indefinida**: lectura de `GET /v1/payments/search` sobre producción en toda la ventana que el buscador alcanza (12 meses) — **el pago más viejo de la cuenta es `167913214814`**, creado y aprobado el **2026-07-08**, **ARS 15**, `approved`, con `transaction_amount_refunded: 0`. **Verificado con `GET /v1/payments/{id}` directo y no por el buscador**, porque el buscador miente (`RC-1`, `RC-4`). O sea que **el sujeto existe, tiene id, y cumple 180 días el 2027-01-04** — antes de esa fecha la fila no se puede cerrar por ningún camino. ✅ **Y el cero está controlado**: la ventana 365d→180d devolvió `total: 0`, pero la MISMA query sobre los últimos 30 días devolvió **78 pagos (42 `approved`)** y sobre los 12 meses **119**, así que el `200` con `total: 0` **no es la tercera mentira de `RC-1`** — es un cero real. ⚠️ **Lo que sigue sin medirse, y es la fila**: si a los 180 días el reembolso entra o no. Esto sólo fecha el experimento

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:305

<a id="mp-rf-4"></a>

### `MP:RF-4` · ¿El reembolso exige clave de idempotencia?

- **Comportamiento**: ¿El reembolso exige clave de idempotencia?
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 18 (`./mp-probes/probe-18-errores-de-reembolso.mjs`)
- **Conclusión**: **`X-Idempotency-Key` es OBLIGATORIO en `POST /v1/payments/{id}/refunds`**: sin él, `400 code 4292 "Header X-Idempotency-Key can't be null"`, **antes** de cualquier validación de negocio. Es la **contracara exacta** de `EX-17`: el mismo header, en `/preapproval`, se acepta y no hace nada. **La idempotencia de este proveedor es POR ENDPOINT** y no se puede razonar de uno al otro. Medido **dos veces**, en dos sondas distintas. **La contradicción que se había registrado con `RF-1` no existe**: la sonda 11 **sí manda el header** (dos veces en su propio código), y como el header es obligatorio, cualquier `201` necesariamente lo llevaba. Era una suposición, no una medición

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:306

<a id="mp-rf-5"></a>

### `MP:RF-5` · Forma del error cuando el reembolso NO corresponde

- **Comportamiento**: Forma del error cuando el reembolso NO corresponde
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 18 (`./mp-probes/probe-18-errores-de-reembolso.mjs`)
- **Conclusión**: Sobre un pago con saldo reembolsable **cero**, y verificado por relectura de que ningún intento entró: total sin body → `400` **`code 2063`** *"The action requested is not valid for the current payment state"*; `amount` mayor al saldo → `400` **`code 2017`** *"Invalid transaction_amount for update"*; `amount` igual al total ya devuelto → **el mismo `2017`**. **El `message` NO alcanza** (dos situaciones distintas comparten texto): el contrato se arma sobre **`cause[0].code`**. `2063` habla del ESTADO del pago y `2017` del MONTO — que es justo la distinción que un reintento necesita entre *"ya está hecho, seguí"* y *"el monto que tenía guardado está mal"*. **Hueco nombrado**: el rechazo por monto bajo el mínimo trae otro texto (*"This transaction does not support to be refunded"*) y **su código no quedó registrado**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:307

## Matriz · ✚ Huecos estructurales

### Matriz · ✚ Huecos estructurales — texto de la fuente

Texto de `D/06-mp-validation-matrix.md:309–343`, sin lo tachado:

> `EX-7` y `EX-8` van separadas a propósito: que el proveedor **acepte** una fecha futura al
> crear no prueba que la **respete** una vez autorizada, y ésa es la que decide. Una fila que
> sólo se probó antes de autorizar no responde por el comportamiento después.

## Matriz · ✚ Huecos estructurales — las filas

<a id="mp-rf-6"></a>

### `MP:RF-6` · ¿El reembolso es idempotente?

- **Comportamiento**: ¿El reembolso es idempotente?
- **Para qué**: **`DEC-CONC-001` p.3 y `DEC-RF-001`** — es lo que sostiene que un reintento no reembolse dos veces. FASE 8: destapó que `D4` («la clave se persiste ANTES de llamar») está escrito sólo para la creación, no para el reembolso (`F-8B1-008`), y que `refund` no guarda el id del proveedor, sin el cual la idempotencia no se puede aplicar (`F-8B3-011`)
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 22 (`./mp-probes/probe-22-tanda-de-reembolsos.mjs`)
- **Conclusión**: **SÍ.** La misma `X-Idempotency-Key` con el mismo cuerpo, sobre un pago con saldo: el primero `201` (refund `3328707782`), el segundo **`200` con cuerpo vacío y NINGÚN reembolso nuevo** — la cuenta lo confirma, se movieron ARS 10 y no 15. **Cierra el círculo con `EX-17`**: el mismo header que en `/preapproval` no hace nada, acá es obligatorio Y se respeta. Dos trampas para quien implemente: la repetición devuelve **`200`, no `201`** (un cliente que sólo acepte `201` trata una reentrega correcta como fallo), y **no devuelve el refund original** en el cuerpo, así que hay que tenerlo guardado

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:313

<a id="mp-rf-7"></a>

### `MP:RF-7` · ¿Un reembolso emite webhook?

- **Comportamiento**: ¿Un reembolso emite webhook?
- **Para qué**: **la deduplicación del cap. 03 §10.2 y el cruce `C6`** — de acá sale la cuenta de tres entregas por hecho. FASE 8: al decir **cuál** id llega —el del **pago**, nunca el del reembolso— invalida el mecanismo que la cita, porque `C6` descarta la actualización por repetida (`F-8B1-013`)
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: logs de la API de producción (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **SÍ, tres entregas por reembolso**: `?data.id=<pago>&source_news=webhooks&type=payment` (Webhooks), `?id=<pago>&topic=payment` e `?id=…&topic=merchant_order` (los dos, **IPN**). Los tres `200`. **Esta fila estaba registrada como bloqueada** —*"el receptor está atado a la app de prueba"*— y el razonamiento tenía un agujero: **la API de producción ES un receptor y sus logs se leen**. **Los dos formatos NO son un hallazgo**: el owner confirma que Mercado Pago tiene IPN y Webhooks andando a la vez, y que el `source_news=webhooks` se agregó para **filtrar y descartar las de IPN**. Los tiempos del log lo sostienen sin mirar código: el de Webhooks tarda **446 ms** y deja la línea `Payment updated`; los dos IPN vuelven en **5 ms** y no dejan ninguna. O sea que el descarte **se ve funcionando en la medición**. Lo que aporta la fila es **la cuenta**: tres entregas por hecho, una sola procesada 📌 **2026-09-29, la Orders API en sandbox** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 56): un reembolso **total** y uno **parcial** de órdenes (`POST /v1/orders/{id}/refund`, `201`, releídos `refunded` y `partially_refunded`) **no produjeron ninguna entrega por ningún canal** en 23-27 min, con todos los eventos tildados (ver `EX-15`). Lo medido acá (3 entregas por un reembolso de `/v1/payments`, 2 de ellas por IPN y una `topic=merchant_order`) no cambia: es otra API, y en sandbox la de Payments da `401`. **Si el addon de única vez va por `/v1/orders` (`EX-30`), su reembolso no tiene aviso**, y se confirma releyendo la orden

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:314

<a id="mp-rf-8"></a>

### `MP:RF-8` · El rechazo `code 2084`, sin explicación

- **Comportamiento**: El rechazo `code 2084`, sin explicación
- **Para qué**: **la regla del cap. 03 §6** que ante un `2084` manda *«reintenta con otro monto o cae al total»*. FASE 8: ese bucle automático corre sobre un código cuyo significado está **medido como desconocido**, y el contrato de errores que necesitaría está incompleto (`F-8B1-012`)
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 24 (`./mp-probes/probe-24-el-pago-de-quince-pesos.mjs`)
- **Conclusión**: **Lo que está probado es negativo y alcanza para el contrato: `2084` NO es una propiedad del pago.** Sobre UN MISMO pago de ARS 15, `amount: 5` dio `400 code 2084` y `amount: 14` dio `201` minutos después; con 1 de saldo, tanto `amount: 1` como el total sin body volvieron a dar `2084`. Y el mismo `amount: 5` entra en pagos de 5.000 y 7.500. **Cuatro hipótesis murieron** (piso del monto, piso del resto, tipo de transacción, "un pago al mínimo no admite parciales") y **la regla real no se pudo determinar**. El mensaje —*"This transaction does not support to be refunded"*— afirma lo contrario de lo medido. **Consecuencia**: ante un `2084` el reconciliador NO puede dar de baja el intento; reintenta con otro monto o cae al total

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:315

<a id="mp-ex-1"></a>

### `MP:EX-1` · Qué pasa con una autorización creada y **nunca completada**: ¿vence?, ¿cuándo?, ¿se puede reusar?

- **Comportamiento**: Qué pasa con una autorización creada y **nunca completada**: ¿vence?, ¿cuándo?, ¿se puede reusar?
- **Para qué**: `M-SUB-01`, `M-MP-02`
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: **2026-09-23**
- **Entorno**: **staging**
- **Evidencia**: lectura de `GET /preapproval/bf9b6feba3cc4a9d994754648b850a6a` con el token de staging, 2026-09-23 · manifiesto en `manifiesto-reloj-2026-09-15.json` (`./mp-probes/manifiesto-reloj-2026-09-15.json`)
- **Conclusión**: **NO VENCE. A los 8 días y 3 horas seguía `pending`, sin que el proveedor lo tocara.** El sujeto `sin-autorizar` (`bf9b6feb…`) se creó el **2026-09-15 11:26 `-04`** y su `last_modified` quedó congelado en **11:27 `-04` del mismo día** — un minuto después, cuando se lo amplió— y **nunca más se movió**. Su `next_payment_date` sigue siendo el original (11:26 del 15/09), o sea que **la fecha tampoco corre**: a diferencia de una pausada, donde `PS-6` midió que el ciclo avanza igual sin cobrar, acá no avanza nada. El `init_point` sigue devolviéndose entero. ⚠️ **Por qué `PARTIALLY` y no `VERIFIED`**: la pregunta tiene tres partes y **sólo se contestaron dos**. *«¿Vence?»* → no, al menos no en 8 días. *«¿Cuándo?»* → queda vacía por la anterior. ***«¿Se puede reusar?»* NO se midió** — exige completar el checkout desde ese `init_point`, que es un acto del pagador. 📌 **La consecuencia de diseño, y es la que importa**: `04-open-decisions.md` §«la ventana de autorización» declara que esa ventana es **NUESTRA** —72 h con tarjeta y **7 días corridos con pago manual**, `DEC-SUB-016`— *«y se cancela explícitamente al vencer **porque `EX-1` sigue `UNKNOWN`»*. **La razón escrita era la ignorancia; ahora hay una razón de hecho, y es más fuerte**: está medido que **si no la cerramos nosotros, no la cierra nadie**. La decisión no cambia; su fundamento sí. ⊕ Complementa a `EX-3`, que ya había medido que el proveedor **tampoco comunica nada** sobre un `pending` que nunca se autoriza: ni avisa ni vence

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:316

<a id="mp-ex-2"></a>

### `MP:EX-2` · ¿Los eventos del proveedor traen **orden confiable** (versión o timestamp)?

- **Comportamiento**: ¿Los eventos del proveedor traen **orden confiable** (versión o timestamp)?
- **Para qué**: `M-CONC-02`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **SÍ: el cuerpo trae `version`, un contador monótono POR RECURSO.** Medido con receptor propio: el mismo preapproval llegó con `version` 4, 6, 7, 8 en el orden causal de las acciones. Es lo que `M-CONC-02` necesita y **es más fuerte que el id del evento**, que cambia en cada reentrega. Corrige por ampliación la lectura anterior, que se había hecho sobre la tabla ya normalizada de staging y no veía este campo. 🚨 **Ampliado el 2026-09-23, y el hallazgo es contra nosotros**: la fila sigue en pie del lado del proveedor, pero **nuestra capa tira el campo**. El `payload` que guarda `billing_webhook_events` en producción es `{id, data:{id}, type, created:null}`: **no conserva `version` ni `date`**. O sea que el único campo que este corpus declaró confiable —y que `WH-1`, `WH-3`, `WH-4` y `WH-5` necesitan para deduplicar y ordenar— **no sobrevive a la normalización en producción, hoy**. Es **un defecto nuestro, no del proveedor**, y por eso no cambia el estado de esta fila: la registra el capítulo que decida la persistencia del webhook 📌 **2026-09-29** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`)): `version` existe **sólo en Webhooks**. El cuerpo IPN es `{"resource","topic"}`, sin `version`, sin `date` y sin `action`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:317

<a id="mp-ex-3"></a>

### `MP:EX-3` · ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar?

- **Comportamiento**: ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar?
- **Para qué**: `M-MAIL-04`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15 · **ampliada 2026-09-19**
- **Entorno**: **producción**
- **Evidencia**: casilla real del owner (`./mp-probes/RESULTS-2026-09-15.md`), 43 correos de `info@mercadopago.com` en el día · ampliación: re-lectura de la misma casilla el 2026-09-19
- **Conclusión**: **Le avisa TODO, y primero que a nosotros.** Cuatro correos al pagador: **alta** (monto, tarjeta terminada en, frecuencia, el vendedor con su mail, y *"Cobramos $15 solo para validar tu tarjeta y te lo devolvemos enseguida"*), **cambio de monto** (*"El vendedor Hospeda cambió el monto"* + *"Próximo cobro: no especificado"*), **pausa** y **cancelación**. Y uno al vendedor: *"¡Tenés un nuevo suscriptor!"*. **Seis consecuencias**: (1) el **`reason` ES la copy que ve el cliente** en asunto y encabezado —y `EX-19` lo hace reescribible, así que nunca va un slug interno ahí—; (2) **un cambio de precio no se puede hacer en silencio**, y como `EX-15` midió que no emite webhook, **el proveedor le avisa al cliente y NO nos avisa a nosotros**; (3) los cuatro correos mandan al cliente a **nuestra** puerta (*"contactá con el vendedor"`*): no hay autogestión, todo cae en soporte; (4) **`paused` y `cancelled` llegan AMBIGUOS** —los dos dicen *"por un pago no realizado o por opción del vendedor"*—, así que una pausa de cortesía y una por mora son idénticas para el cliente y **nuestra comunicación tiene que desambiguar**; (5) el proveedor afirma que una pausa **la levanta el vendedor**, contra el supuesto de reanudación automática del §26.2; (6) el asunto del alta dice **"Pagaste la suscripción"** y no se pagó nada. **Y no es prematuro: es FALSO.** Medido con reloj: el correo sale ~18 s después de autorizar, el cobro real llega ~26 min más tarde (`PA-3`) — y en `pausa-real` y `cancelada`, que recibieron el mismo correo, **el cobro no llegó NUNCA** (cero `authorized_payments` en las dos). Un cliente puede tener en su bandeja un correo del proveedor que dice que pagó una suscripción que jamás le cobró un peso. Tercer caso del patrón, con el `2084` de `RF-8` y el *"Cobramos $15"* de un cargo inexistente: **ninguna decisión de soporte puede apoyarse en la copy de Mercado Pago**. ⊕ **AMPLIACIÓN 2026-09-19 — séptima consecuencia, y es un silencio**: sobre un preapproval que queda **`pending` y nunca se autoriza, el proveedor NO comunica nada** — ni por su creación ni por su cancelación. Medido sobre el sujeto creado en producción el 2026-09-15 22:38 con la dirección del owner como pagador y cancelado 45 s después: búsqueda `in:anywhere` —**incluye Spam y Papelera**— acotada a ese día, **46 correos del proveedor**, y la franja entre las 22:04 y las 23:04 **está vacía**. El proveedor sólo le escribe al pagador sobre suscripciones **ya autorizadas** (alta, cobro, cambio de monto, pausa, cancelación). **La consecuencia de diseño**: durante `PENDING_AUTHORIZATION` —las 72 h del cap. 03 §3.4— **el proveedor calla**, así que todo lo que esa persona escuche en esa ventana **sale de nosotros o no existe**. Eso convierte el punto 3 de ese §3.4 —qué ve la persona mientras tanto— de «una pantalla más» en **el único canal que hay**. ⚠️ **Esto NO contesta `EX-1`**: dice que el proveedor no comunica el vencimiento, no que el `pending` venza o deje de vencer

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:318

<a id="mp-ex-4"></a>

### `MP:EX-4` · Cambio de **frecuencia** sobre una suscripción ya autorizada

- **Comportamiento**: Cambio de **frecuencia** sobre una suscripción ya autorizada
- **Para qué**: `BD-SUB-01`, `MP-01`
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **El ciclo NO se puede cambiar, y falla en silencio**: `200` en dos intentos aislados (12 y 3 meses) y `frequency` siguió en 1. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**: cuatro intentos (3 meses, 12 meses, `days`, y frecuencia+monto en el mismo `PUT`), los cuatro `200`, `frequency` siempre en 1

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:320

<a id="mp-ex-5"></a>

### `MP:EX-5` · ¿Una autorización puede cubrir **más de un monto**?

- **Comportamiento**: ¿Una autorización puede cubrir **más de un monto**?
- **Para qué**: `BD-MP-04`
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `auto_recurring` como array → `400`. Campo `items` → **`201` y se descarta en silencio**: no vuelve en la respuesta, queda un solo monto. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 (sonda 26 (`./mp-probes/probe-26-re-medir-en-produccion.mjs`)): el array da `400 "Parameters passed are invalid"` y `items` se vuelve a descartar en silencio

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:321

<a id="mp-ex-6"></a>

### `MP:EX-6` · N autorizaciones del mismo pagador conviviendo, ya autorizadas

- **Comportamiento**: N autorizaciones del mismo pagador conviviendo, ya autorizadas
- **Para qué**: `BD-MP-04`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox **+ producción**
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`) + sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)
- **Conclusión**: Dos autorizadas del mismo pagador conviven sin conflicto. En **producción con tarjeta real** se llegó a **SEIS** conviviendo, todas `authorized`, mismo `payer_email`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:322

<a id="mp-ex-7"></a>

### `MP:EX-7` · Compensar días ya pagados corriendo la **primera fecha de cobro**

- **Comportamiento**: Compensar días ya pagados corriendo la **primera fecha de cobro**
- **Para qué**: `BD-SUB-01`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `start_date` a +20 días → `next_payment_date` en esa fecha

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:323

<a id="mp-ex-9"></a>

### `MP:EX-9` · ¿Se puede tokenizar una tarjeta **ya guardada**, server-side?

- **Comportamiento**: ¿Se puede tokenizar una tarjeta **ya guardada**, server-side?
- **Para qué**: `DEC-SUB-005`
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02/03 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Sí, pero exige el código de seguridad.** Con `card_id` solo, el token se genera (`201`) y **no sirve**: `400 "Card token was generated without cvv validation"`. Con `card_id` + `security_code`, funciona

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:324

<a id="mp-ex-10"></a>

### `MP:EX-10` · ¿Ese token crea una suscripción autorizada real?

- **Comportamiento**: ¿Ese token crea una suscripción autorizada real?
- **Para qué**: `DEC-SUB-005`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02/03 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: `201` y **verificado por relectura independiente**: `authorized`, ciclo nuevo (3 meses), primer cobro corrido a +18 días, **cero cobro al crear**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:325

<a id="mp-ex-8"></a>

### `MP:EX-8` · ¿Se respeta esa primera fecha **después** de autorizar?

- **Comportamiento**: ¿Se respeta esa primera fecha **después** de autorizar?
- **Para qué**: `BD-SUB-01`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 01/02 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Sí se respeta tras autorizar.** Además **no cobra al crearse**. El proveedor lo modela como un `free_trial` de 20 días que nosotros no pedimos

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:326

<a id="mp-ex-11"></a>

### `MP:EX-11` · ¿Qué se puede hacer sobre una suscripción **pausada**?

- **Comportamiento**: ¿Qué se puede hacer sobre una suscripción **pausada**?
- **Para qué**: `BD-MP-01`, acota `DEC-MP-001`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 07 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Estando pausada NO se puede modificar nada**: cambiar el monto da `400 "You can not modify a paused preapproval."` y el monto no se mueve. **Con control**: el mismo payload, sobre la misma suscripción ya reanudada, entra (`200`, monto cambiado) — o sea que **bloquea el estado, no la operación**. **Cancelar SÍ funciona estando pausada** (`200` → `cancelled`): la pausa no atrapa al cliente. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**, y con más superficie: monto, frecuencia, `end_date` y hasta **volver a pausar** dan los cuatro `400 "You can not modify a paused preapproval."`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:327

<a id="mp-ex-12"></a>

### `MP:EX-12` · ¿Un `card_token` sirve para más de una suscripción?

- **Comportamiento**: ¿Un `card_token` sirve para más de una suscripción?
- **Para qué**: `DEC-SUB-005`, reintentos
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 05 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Un solo uso.** Del segundo en adelante: `400 "Card token was used, please generate new"`. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 (sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**. Todo reintento de creación tiene que **tokenizar de nuevo**, y el mensaje de error no se parece en nada a "reintentaste"

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:328

<a id="mp-ex-13"></a>

### `MP:EX-13` · ¿Los eventos vienen **firmados**, y se puede verificar la firma?

- **Comportamiento**: ¿Los eventos vienen **firmados**, y se puede verificar la firma?
- **Para qué**: §51, `M-CONC-01`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 10 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **La firma se verifica.** `x-signature: ts=<epoch>,v1=<hex64>` + `x-request-id`, y el `v1` es **HMAC-SHA256** con la clave de la aplicación sobre el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — **el punto y coma final incluido**: sin él no coincide. Reproducido sobre **tres** entregas reales de tipos distintos, con control de la propia herramienta (vector RFC 4231). La URL del receptor no es un agujero abierto 📌 **2026-09-29, con los dos canales** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 55): Webhooks verifica **29 de 29** con el manifiesto de esta fila. **IPN trae `x-signature` pero no verifica: 0 de 12** con la clave de la aplicación (el manifiesto documentado y 21 variantes, con control RFC 4231 en cada lectura). No prueba que IPN sea inverificable (puede tener otra clave): prueba que **con la clave que tenemos no se puede**. Consecuencia: por IPN no hay forma de rechazar un `POST` inventado, así que un receptor que lo acepte lo trata sólo como disparador de una relectura, nunca como dato. La fila sigue `VERIFIED` porque lo que el receptor necesita verificar llega por Webhooks; **si el diseño decide actuar sobre IPN, esta fila pasa a `PARTIALLY_SUPPORTED`** 🚫 **No se mide, por decisión del owner** (2026-09-29, decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-3): la firma de las entregas IPN no se mide. Con `M-2` el receptor guarda IPN sin actuar (`B/06`, «NO cierra»), así que la condición de la última oración del 📌 anterior no se cumple y la fila sigue `VERIFIED`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:329

<a id="mp-ex-14"></a>

### `MP:EX-14` · ¿Se puede distinguir **sandbox de producción** mirando el evento?

- **Comportamiento**: ¿Se puede distinguir **sandbox de producción** mirando el evento?
- **Para qué**: `M-MP-01`, riesgo operativo
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **No.** Un `payment.created` de la cuenta de prueba (`tags:["test_user"]`) llega con **`live_mode: true`**. Un handler que filtre por ese campo trata los eventos de sandbox como productivos 📌 **2026-09-29** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`)): por IPN tampoco: el cuerpo no trae `live_mode` ni ningún otro campo de entorno

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:330

<a id="mp-ex-16"></a>

### `MP:EX-16` · ¿Se puede conciliar una suscripción **SIN** la API de Payments?

- **Comportamiento**: ¿Se puede conciliar una suscripción **SIN** la API de Payments?
- **Para qué**: `R-MP-01`, §23, §57
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 13 (`./mp-probes/RESULTS-2026-09-15.md`)
- **Conclusión**: **Sí, entera.** `GET /authorized_payments/search?preapproval_id=` y `GET /authorized_payments/{id}` pertenecen a la familia de **suscripciones**, no a `/v1/payments`, y traen todo lo que la conciliación necesita: `status`, `transaction_amount`, `currency_id`, `debit_date`, `date_created`, `last_modified`, `payment_method_id`, **`retry_attempt`**, y el pago embebido (`payment.id`, `payment.status`, `payment.status_detail`). El `search` **exige** filtro y **filtra bien por `preapproval_id`** (1 con el real, 0 con basura); por `external_reference` **no filtra** — mismo defecto que `RC-1`, y da igual porque el id del proveedor ya se guarda. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 (sondas 20/21 (`./mp-probes/probe-21-produccion-el-filtro-miente.mjs`)), pero con una trampa que casi lo tumba: contra las 4 suscripciones `authorized` de producción devuelve **0**, y eso parecía refutar la fila. No la refuta — **ninguna de las cuatro cobró todavía** (las cuatro están en `free_trial` de 30 o 90 días). Contra la suscripción que **sí** cobró trae los dos cobros completos. **El primer resultado era un falso negativo perfecto**, y lo que lo destapó fue preguntar por el SUJETO, no por el endpoint. **Y hay un SEGUNDO modo de cero, medido el 2026-09-15 con el primer cobro del reloj de producción: LAG.** A las 21:33 el preapproval decía `charged_quantity: 1` y `/authorized_payments/search` devolvía **0**; minutos después devolvía **1**. **El contador del preapproval se actualiza ANTES que el endpoint de cobros**, así que un reconciliador que vea subir el contador y vaya a buscar el cobro no lo encuentra. **Dos causas distintas para el mismo cero** —no cobró nunca, y todavía no se indexó— **y ninguna se distingue mirando sólo ese endpoint**. ✚ **El 2026-09-22 se midieron los campos que esta fila sólo nombraba**, con el sujeto de `RN-2`: **`retry_attempt` llega hasta 4 y ahí se detiene**; **`expire_date`** existe y es la ventana del ciclo (`RC-7`); el **`status`** del registro tiene tres valores y **no dice si se cobró** (`RC-6`); y el **`status_detail` del pago embebido cambia entre intentos**, así que es el del último. ⚠️ **Y aparece un TERCER modo de cero para esta misma fila**: una suscripción cuyo único cobro el proveedor **rechazó y luego canceló** devuelve cero en el endpoint **con `charged_quantity: 1`** (`RC-5`), o sea que la regla de *«concluir desde el contador»* que esta fila sostiene **falla justo ahí** 📌 **2026-09-29** (mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`), sonda 52 paso 10): **un registro de cobro puede existir por búsqueda y no por id**. El `authorized_payment` `7032360740` del alta rechazada `715371d2…` aparece en `/authorized_payments/search?preapproval_id=` (`scheduled`, `rejection_code cc_rejected_other_reason`, `retry_attempt 1`) y `GET /authorized_payments/7032360740` da **`404`**. Medido sobre un preapproval que el proveedor creó tras un `400` y canceló (`EX-55`); sobre los registros de suscripciones vivas el `GET` por id sigue funcionando

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:331

<a id="mp-ex-17"></a>

### `MP:EX-17` · ¿La **creación** de una suscripción es idempotente?

- **Comportamiento**: ¿La **creación** de una suscripción es idempotente?
- **Para qué**: `M-CONC-01`
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox **+ producción**
- **Evidencia**: sonda 14 (`./mp-probes/probe-14-idempotencia-de-creacion.sh`)
- **Conclusión**: **No deduplica por ningún mecanismo.** Corrida dos veces, **diez sujetos, diez ids distintos**: (a) mismo `external_reference` sin header → dos `201` distintos; (b) misma `X-Idempotency-Key` con cuerpo idéntico → dos `201` distintos; (c) misma clave con **monto distinto** → un tercer `201` con el monto nuevo. El caso (c) es el que cierra la pregunta: el header **no tiene ningún efecto** sobre `/preapproval` — se acepta y no hace nada, otra forma del §0. **Consecuencia: el candado es nuestro o no existe**, y tiene que estar ANTES de llamar al proveedor. El daño no es simétrico: dos `pending` no cobran, pero una creación **con `card_token_id`** queda autorizada y **cobra en el acto** (`PA-3`), así que ahí un reintento son **dos cobros**. De yapa: **un `pending` SE PUEDE cancelar** (11 de 11, verificado por relectura). **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 (sonda 26 (`./mp-probes/probe-26-re-medir-en-produccion.mjs`)): los tres casos dan idéntico resultado que en sandbox.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:332

<a id="mp-ex-18"></a>

### `MP:EX-18` · ¿Se puede cobrar en una **moneda** que no sea ARS?

- **Comportamiento**: ¿Se puede cobrar en una **moneda** que no sea ARS?
- **Para qué**: `M-MP-01`
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox **+ producción**
- **Evidencia**: sonda 15 (`./mp-probes/probe-15-moneda.sh`)
- **Conclusión**: **Sólo ARS** en esta cuenta (`site_id: MLA`). `USD 100` y `BRL 50` → `400 "Invalid field -> auto_recurring.currency_id"`. **El modelo de datos no necesita moneda por plan, por suscripción ni por cobro.** Y deja una regla para el contrato de errores que casi produce un `PARTIALLY_SUPPORTED` inventado: **el proveedor valida el MONTO antes que la MONEDA, y el mensaje del piso es ciego a la moneda** — `USD 10` devuelve *"Cannot pay an amount lower than $ 15.00"*, y también lo devuelve `BRL 10`, con `BRL` ya sabida inválida. **Un `400` de monto no dice nada sobre si la moneda era válida**. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 (sonda 26 (`./mp-probes/probe-26-re-medir-en-produccion.mjs`)): `USD` y `BRL` dan el mismo `400`.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:333

<a id="mp-ex-19"></a>

### `MP:EX-19` · ¿Qué campos se pueden **reescribir** sobre una autorizada?

- **Comportamiento**: ¿Qué campos se pueden **reescribir** sobre una autorizada?
- **Para qué**: reparación de vínculo, §23
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)
- **Conclusión**: **`external_reference` SE PUEDE REESCRIBIR DESPUÉS** (`200` y aplica, verificado por relectura), igual que `reason` —lo que ve el cliente— y `back_url`. **`payer_email` NO**: `200` y no cambia, y el `GET` lo devuelve **vacío**, nunca el mail real. **Esto abre una vía de reparación** para el error vivo de producción (`SubscriptionNotResolvedError`, HOS-276): a una suscripción huérfana se le puede escribir nuestra referencia y re-vincularla sin tocar al cliente. Con la salvedad de `RC-1`: el `search` **ignora** `external_reference`, así que la referencia sirve para **reconocer** una suscripción que ya se tiene, no para **encontrarla**. Y ojo con los ids: el `payer_id` del preapproval (`1505978827`) **no es** el `payer.id` de los pagos de la misma tarjeta (`5860436`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:334

<a id="mp-ex-20"></a>

### `MP:EX-20` · ¿Un `PUT` con varios campos se aplica entero?

- **Comportamiento**: ¿Un `PUT` con varios campos se aplica entero?
- **Para qué**: §0, toda mutación
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: **producción**
- **Evidencia**: sonda 28 (`./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs`)
- **Conclusión**: **NO: se aplica A MEDIAS, con un solo `200`.** `frequency: 6` + `transaction_amount: 99` en el mismo `PUT` → la frecuencia **no** cambió y el monto **sí**. `end_date` + `transaction_amount: 77` → el `end_date` **no** apareció y el monto **sí**. Es el §0 en su forma más cara: **no alcanza con releer \"la\" mutación**, hay que comparar **campo por campo cada campo que se mandó**, porque el que falla no arrastra al que funciona. Y hay un caso más de aceptar-y-descartar: `currency_id: \"USD\"` sobre una autorizada da `200` y sigue en `ARS` — **asimétrico**, porque al CREAR la misma moneda da `400` (`EX-18`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:335

<a id="mp-ex-15"></a>

### `MP:EX-15` · ¿Qué operaciones **NO** emiten webhook?

- **Comportamiento**: ¿Qué operaciones **NO** emiten webhook?
- **Para qué**: `DEC-MP-001`, §23, §51
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-29**
- **Entorno**: sandbox (**los dos canales** desde el 2026-09-29)
- **Evidencia**: sondas 08/09 (`./mp-probes/RESULTS-2026-09-15.md`) · mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`) · batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sondas 52 (corridas 1 a 3) y 56
- **Conclusión**: ⚠️ **Reabierta el 2026-09-28 (revisión del owner, 2026-09-28, N9, `L3-g`): medida con el receptor escuchando sólo el canal Webhooks; el canal IPN queda sin medir hasta `WH-6`.** **Mutar el monto NO emite ninguna entrega.** Medido con 90 s entre acciones: ventana de 91 s sin eventos, con la mutación aplicada — y la `version` del recurso saltó de 5 a 9, o sea que **el recurso cambió y el proveedor no avisó**. Crear, pausar, reanudar y cancelar **sí** notifican. Consecuencia: un cambio de precio **no tiene vía de confirmación asincrónica** y sólo se puede comprobar releyendo ✅ **Cerrada el 2026-09-29 con los dos canales escuchando** (reabierta a `PARTIALLY_SUPPORTED` el 2026-09-28; mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`), sonda 52 corridas 1 y 2; batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sondas 52 corrida 3 y 56). **IPN no emite nada de preapproval ni de `authorized_payment`**, sólo `payment`, así que **no cubre ningún hueco** de Webhooks (`WH-6`). **Sin aviso por ningún canal**: mutar el monto en las dos direcciones (subir: `version` 2 → 7 y 4 → 6 sin entrega), **reescribir el `reason`** (`last_modified` movido, cero entregas), **la cancelación que hace el proveedor tras un alta con cobro rechazado** (3 de 3: `715371d2…`, `7eb2a11b…` y `1bd4f015…`, mientras su `payment` y su `authorized_payment` sí llegaron; ver `WH-5`), y **las órdenes de `/v1/orders` y sus reembolsos**, total y parcial (5 órdenes y 2 reembolsos, cero entregas en 23-43 min). **Sí avisan**: crear, pausar, reanudar y cancelar por `PUT` (una vez cada uno), la cancelación **del comprador**, sólo por Webhooks (`EX-52`), y **cambiar la tarjeta**: un `subscription_preapproval` por Webhooks (+28 s) y el `payment` de validación de ARS 0 por los dos canales (`EX-36`); un cambio de tarjeta rechazado (`402`) avisa sólo ese `payment`. El alta llega como `updated`, nunca como `created`. ⚠️ **La `version` salta sin aviso** (entre v5 y v8 del mismo preapproval hubo dos versiones sin aviso, y sólo una se pudo atribuir, al `reason`): **un hueco de `version` no prueba un aviso perdido**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:336

## Matriz · ✚ Planes — `/preapproval_plan`

### Matriz · ✚ Planes — `/preapproval_plan` — texto de la fuente

Texto de `D/06-mp-validation-matrix.md:344–369`, sin lo tachado:

Las 71 filas anteriores se midieron **todas** sobre `/preapproval`: suscripciones sueltas. El
proveedor tiene un **segundo modelo** que este programa no había tocado, y que expone campos que
la suscripción suelta no tiene (`repetitions`, `billing_day`, `billing_day_proportional`,
`free_trial`). Estas nueve filas lo miden, todas en sandbox el 2026-09-15, con las sondas
33 (`./mp-probes/probe-33-planes-vs-suscripciones-sueltas.mjs`),
34 (`./mp-probes/probe-34-controles-de-la-33.mjs`),
35 (`./mp-probes/probe-35-el-ciclo-de-un-plan-es-editable.mjs`),
36 (`./mp-probes/probe-36-el-plan-propaga-o-solo-lo-parece.mjs`) y
37 (`./mp-probes/probe-37-el-free-trial-del-plan-se-da-una-sola-vez.mjs`).

## Matriz · ✚ Planes — `/preapproval_plan` — las filas

<a id="mp-ex-21"></a>

### `MP:EX-21` · ¿Se puede **mover** una suscripción viva de un plan a otro?

- **Comportamiento**: ¿Se puede **mover** una suscripción viva de un plan a otro?
- **Para qué**: punto 1 / `DEC-SUB-005`, §27, §28
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 33 (`./mp-probes/probe-33-planes-vs-suscripciones-sueltas.mjs`)
- **Conclusión**: **NO, y en la peor de las formas: `200` con el campo descartado.** `PUT /preapproval/{id}` mandando `preapproval_plan_id` devuelve **`200`** y la relectura sigue mostrando el plan viejo. Medido en tres pasos, con **el control que distingue**: (a) el mismo `PUT` con sólo `back_url` → `200` **aplicado**, así que el `PUT` sobre ese sujeto funciona; (b) con sólo `preapproval_plan_id` → `200`, plan viejo; (c) **los dos juntos** → `200`, `back_url` aplicado y **plan ignorado**. Sin (a), un error en (b) no habría distinguido "prohibido" de "no llegó a evaluarse"; sin (c), el `200` de (b) no distinguía nada. Es **`EX-20` otra vez**, y esta vez el campo descartado es justo el que se preguntaba. **El modelo de planes NO resuelve el punto 1**: `DEC-SUB-005` —cancelar y recrear, con el código de seguridad al cliente— sigue siendo el único camino medido para un cambio de ciclo individual

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:358

<a id="mp-ex-22"></a>

### `MP:EX-22` · Con plan, ¿puede la suscripción traer su propio `auto_recurring`?

- **Comportamiento**: Con plan, ¿puede la suscripción traer su propio `auto_recurring`?
- **Para qué**: §19, §29, catálogo de planes
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 33 y 34 (`./mp-probes/probe-34-controles-de-la-33.mjs`)
- **Conclusión**: **Manda el plan, y lo que sobra se descarta sin avisar.** Monto distinto → **`400`** *"The transaction_amount must be the same as preapproval_plan"*. Monto **igual** y frecuencia distinta (`2 months` contra `1 months` del plan) → **`201`** y la relectura dice `1 months`: **el proveedor valida el monto y no valida la frecuencia**, así que el único campo que protesta es el único que no hacía falta proteger. La suscripción además **heredó** el `billing_day: 10` del plan, que nunca pidió. El `reason` propio también se descarta: queda el del plan. **Consecuencia sobre `EX-3`**: está medido que el `reason` **es la copy que ve el cliente** en asunto y encabezado de los correos del proveedor, así que con planes **esa copy la fija el plan** — un catálogo de planes es también un catálogo de textos al cliente, uno por combinación vertical × tier × ciclo

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:359

<a id="mp-ex-23"></a>

### `MP:EX-23` · Editar el **monto** de un plan, ¿alcanza a los ya suscriptos?

- **Comportamiento**: Editar el **monto** de un plan, ¿alcanza a los ya suscriptos?
- **Para qué**: `BD-MP-03`, `DEC-MP-001`, §29
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 33 a 36 (`./mp-probes/probe-36-el-plan-propaga-o-solo-lo-parece.mjs`)
- **Conclusión**: **La LECTURA de los suscriptos sigue al plan; falta saber si el COBRO también.** Un testigo que nadie tocó leyó 2000 al alta, **2500** tras subir el plan y **15** tras bajarlo: tres puntos, sobre dos suscriptos. Eso admite dos explicaciones que **ninguna lectura distingue**: que el proveedor **propague** —y entonces existe un cambio de precio **masivo** por plan, mucho más barato que mutar suscripción por suscripción, que es lo que decidió `DEC-MP-001`— o que la lectura sólo **refleje** el plan mientras el cobro sale de otro lado, **que sería peor que el hallazgo**, porque la relectura es la única herramienta con la que este programa verifica todo. Sólo un cobro ejecutado las separa: quedaron dos sujetos de ciclo diario puestos el 2026-09-15 23:32, uno con el plan subido a **ARS 3300** antes del primer cobro y otro **sin tocar** que lo hace legible (manifiesto (`./mp-probes/manifiesto-propaga-2026-09-15.json`)). **Se lee el 2026-09-16.** El piso de `PC-2` también rige acá: ARS 1 → `400` *"Cannot pay an amount lower than $ 15.00"*

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:360

<a id="mp-ex-24"></a>

### `MP:EX-24` · ¿El **ciclo** de un plan es editable?

- **Comportamiento**: ¿El **ciclo** de un plan es editable?
- **Para qué**: §19, §29
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 35 (`./mp-probes/probe-35-el-ciclo-de-un-plan-es-editable.mjs`)
- **Conclusión**: **SÍ**, verificado por relectura dos veces: `1 days → 2 days` sobre un plan sin free trial y `1 months → 2 months` sobre uno con free trial. **Y casi se registra un `NOT_SUPPORTED` inventado**: el primer intento devolvió `400`, pero el mensaje era *"The free trial property must be sent"* — si el plan tiene free trial, **todo `PUT` que toque `frequency` tiene que reenviarlo**, y el rechazo no tenía nada que ver con el ciclo. Tercer caso en este programa de un error que no prueba una prohibición sino que no se llegó a evaluar

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:361

<a id="mp-ex-25"></a>

### `MP:EX-25` · El cambio de **ciclo** del plan, ¿alcanza a los ya suscriptos?

- **Comportamiento**: El cambio de **ciclo** del plan, ¿alcanza a los ya suscriptos?
- **Para qué**: §19, §29
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 35 (`./mp-probes/probe-35-el-ciclo-de-un-plan-es-editable.mjs`)
- **Conclusión**: **NO.** Con el plan en `2 months`, sus dos suscriptos siguen leyéndose en `1 months`. **La asimetría con `EX-23` es el hallazgo**: sobre el mismo plan y los mismos suscriptos, el monto cambia y el ciclo no. Un plan puede quedar describiendo un ciclo que ninguno de sus suscriptos tiene, y nada avisa

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:362

<a id="mp-ex-26"></a>

### `MP:EX-26` · ¿`free_trial` funciona **sin** plan?

- **Comportamiento**: ¿`free_trial` funciona **sin** plan?
- **Para qué**: §10, trial
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 33 (`./mp-probes/probe-33-planes-vs-suscripciones-sueltas.mjs`)
- **Conclusión**: **SÍ, y difiere el primer cobro.** Medido con un par en la misma corrida, con segundos de diferencia: el sujeto **con** `free_trial` quedó en `summarized.charged_quantity: null` y su gemelo **sin** trial en `1`. El proveedor agrega por su cuenta `first_invoice_offset`. No hizo falta esperar nada

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:363

<a id="mp-ex-27"></a>

### `MP:EX-27` · ¿`repetitions` y `billing_day` funcionan **sin** plan?

- **Comportamiento**: ¿`repetitions` y `billing_day` funcionan **sin** plan?
- **Para qué**: §19, catálogo
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sondas 33 y 34 (`./mp-probes/probe-34-controles-de-la-33.mjs`)
- **Conclusión**: **No: los dos se descartan en silencio.** `repetitions: 3` → `201` y **ausente** en la relectura. `billing_day` con ciclo diario → `400` *"Only monthly frequencies are able to receive billing day or proportional"*, **que no contestaba la pregunta** porque el rechazo era del ciclo; el control con ciclo **mensual** sí la contesta, y da **`201` con el campo ausente**. **Son exclusivos de planes**, y es lo único que el modelo de planes aporta sobre el suelto

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:364

<a id="mp-ex-28"></a>

### `MP:EX-28` · ¿Los planes aceptan **ciclo diario**?

- **Comportamiento**: ¿Los planes aceptan **ciclo diario**?
- **Para qué**: costo de medir sobre planes
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 34 (`./mp-probes/probe-34-controles-de-la-33.mjs`)
- **Conclusión**: **SÍ.** El primer intento dio `400` *"the only valid frequency is months"*, pero ese plan mandaba además `billing_day`, que exige mensual. **Sin `billing_day`, un plan de `1 days` entra y se relee correcto.** Importa por el costo: una batería completa sobre planes **se lee en 24 h, no en un mes** — salvo la parte que use `billing_day`, que es mensual por definición

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:365

<a id="mp-ex-29"></a>

### `MP:EX-29` · El **free trial de un plan**, ¿lo decide el request?

- **Comportamiento**: El **free trial de un plan**, ¿lo decide el request?
- **Para qué**: §10, trial, UI de checkout
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: 2026-09-15
- **Entorno**: sandbox
- **Evidencia**: sonda 37 (`./mp-probes/probe-37-el-free-trial-del-plan-se-da-una-sola-vez.mjs`)
- **Conclusión**: **NO lo decide el request, el patrón es reproducible y el mecanismo NO está identificado.** Dos suscripciones del mismo pagador sobre el mismo plan, con requests **idénticos** y tres segundos de diferencia, salieron distintas: una con `free_trial` y la otra con `null`. Ninguna lo pidió — lo trae el plan. Reproducido **tres veces en frío**, sobre tres planes nuevos, siempre `✅ ✅ ❌`. **No es "una vez por plan"** (dos la reciben) **ni "una vez por pagador"** (la recibe en tres planes distintos), y el plan de la sonda 33 dio `✅ ❌ ❌`, que tampoco encaja con "dos por plan". **Se registra lo reproducible y no se elige la explicación más cómoda**: falta el experimento que las distinga, y el más barato es separar las altas en el tiempo. Lo que **sí** está cerrado y no depende del mecanismo: (1) dos altas idénticas dan resultados distintos; (2) **la relectura lo delata** —`free_trial: null` y `next_payment_date` en el instante del alta en vez de mañana—; (3) por lo tanto **no se le puede prometer al cliente la fecha del primer cobro desde lo que se mandó**: hay que releer antes de mostrarla, siempre

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:366

## Matriz · ✚ Cobrar SIN suscripción — Orders API y credencial guardada

### Matriz · ✚ Cobrar SIN suscripción — Orders API y credencial guardada — texto de la fuente

Texto de `D/06-mp-validation-matrix.md:370–441`, sin lo tachado:

El owner preguntó qué pasaría si dejáramos de usar el modelo de suscripciones y le pidiéramos al
proveedor **sólo que cobre**, manejando el ciclo de vida de nuestro lado. Estas tres filas lo
miden. Sondas 38 (`./mp-probes/probe-38-cobrar-sin-preapproval.mjs`),
39 (`./mp-probes/probe-39-descubrir-el-contrato-de-orders.mjs`),
40 (`./mp-probes/probe-40-que-dispara-el-403-de-pagos-automaticos.mjs`) y
41 (`./mp-probes/probe-41-wallet-connect.mjs`), todas en sandbox el 2026-09-16 y a costo cero.

> **Un `403` de habilitación NO es lo mismo que un `NOT_SUPPORTED` del proveedor**, y las dos
> filas de abajo que lo llevan lo dicen en su conclusión. El proveedor **sí** hace esto; lo que
> está medido es que **a esta cuenta no se lo da**. Se registran como `NOT_SUPPORTED` porque para
> el §61 lo que decide es si se puede implementar, y no se puede — pero la razón es de
> elegibilidad comercial, no técnica, y confundirlas llevaría a reintentarlo creyendo que es un
> problema de cómo armamos el pedido.

Nota del catálogo sobre la fila siguiente:

> ⚠️ **Fila huérfana — le faltan sus primeras siete celdas.** Estaba dentro de la
> tabla de arriba como una línea sin `#`, sin estado, sin fecha y sin entorno, así que
> **markdownlint la leía como una fila rota** y ninguna herramienta la contaba. Se la saca
> de la tabla para preservarla: **el texto va íntegro y no se le inventó ninguna celda.**
> Quien la escribió sabe a qué fila pertenece; hasta entonces queda acá.
>
>
>
> **SALDADA el 2026-09-19 (FASE 8, `F-8B1-004`). Esta pregunta YA ESTÁ MEDIDA: es `EX-33`.**
> `VERIFIED` el 2026-09-16, **en producción con tarjeta real**, tres de tres — preapprovals
> creados `pending` con `start_date` a +3, +2 y +5 días, autorizados a mano en el checkout, los
> tres `authorized` con `next_payment_date` en la fecha pedida y `charged_quantity` nulo. Es
> exactamente el camino que el texto tachado pedía medir, y la tabla de `DEC-SUB-006` de este
> mismo documento ya lo dice: *«Abierta por `DEC-SUB-006` | 1 — `EX-33`»*.
>
> **Por lo tanto esta nota no es una novena `UNKNOWN`: es un duplicado desactualizado**, escrito
> antes del 16/09 y nunca retirado. El conteo del script —89 filas, 49 `VERIFIED`, **8**
> `UNKNOWN`— **nunca estuvo mal**. Se conserva tachada, y no borrada, porque el registro de qué
> se creía en cada momento es parte de este programa.

## Matriz · ✚ Cobrar SIN suscripción — Orders API y credencial guardada — las filas

<a id="mp-ex-30"></a>

### `MP:EX-30` · ¿Existe `/v1/orders`, y cobra?

- **Comportamiento**: ¿Existe `/v1/orders`, y cobra?
- **Para qué**: alternativa a `preapproval`, `R-MP-01`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: sonda 39 (`./mp-probes/probe-39-descubrir-el-contrato-de-orders.mjs`)
- **Conclusión**: **SÍ, y cobra de verdad.** Una orden con una tarjeta tokenizada y **sin `customer`** devolvió `201` y la relectura dice `processed/accredited` con ARS 20 acreditados. El contrato se descubrió **preguntándole al validador**, que nombra los campos que faltan (`missing properties: '$.external_reference'`…): cuerpo mínimo → `transactions` → `payments[0]` exige `amount` y `payment_method`. **Consecuencia útil hoy**: un cobro de **única vez** —un addon, por ejemplo— no necesita ninguna habilitación especial ni pasa por `preapproval`. De paso quedó medido que **`POST /v1/customers` da `401 "access denied"`** con la credencial de prueba, igual que `/v1/payments` (`RF-1`/`RF-2`): eso habla de la credencial, no de la capacidad, y resultó **no estar en el camino crítico** 📌 **2026-09-29** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 56 paso 06): **una orden con tarjeta rechazada devuelve `402` y queda creada igual**: `ORDTST01M3PW176PM2VSH08ESW6WRZSS`, `failed`, pago `rejected_by_issuer`, devuelta en `data` del error (cuyo cuerpo dice además `total_paid_amount: "100.00"`, que no es lo cobrado). A diferencia de `EX-55` (preapproval), **el id viene en la respuesta**. Y **ni las órdenes ni sus reembolsos avisan por ningún canal** en sandbox (`EX-15`): el cobro de única vez se confirma releyendo la orden. No medido: qué devuelve un reintento con la misma clave sobre una orden `failed` (`EX-41` midió sólo la aprobada)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:388

<a id="mp-ex-31"></a>

### `MP:EX-31` · ¿Se puede cobrar de forma **recurrente** sin `preapproval`, con credencial guardada?

- **Comportamiento**: ¿Se puede cobrar de forma **recurrente** sin `preapproval`, con credencial guardada?
- **Para qué**: «el ciclo de vida es nuestro»
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: sondas 38 y 40 (`./mp-probes/probe-40-que-dispara-el-403-de-pagos-automaticos.mjs`)
- **Conclusión**: **No con esta aplicación, y el rechazo es del PERMISO, no del pedido.** El proveedor documenta el producto *«pagos automáticos»* en el dominio argentino —*"pagos recurrentes… **sin solicitar el CVV** para cada transacción"*, con MIT explícito y *"la lógica de recurrencia definida por el vendedor"*— y el contrato es `POST /v1/orders` con `automatic_payments.payment_profile_id` y `stored_credential`. **Medido con el control que distingue**: la misma orden **sin** esos nodos entra (`201`, ver `EX-30`); con **sólo `stored_credential`**, con **sólo `automatic_payments`**, con **los dos**, y con `payment_initiator: "merchant"` sin perfil → **los cuatro `403` con el mensaje idéntico** *"The application is not authorized to perform this type of payment"*. O sea que no hay forma de armar el pedido que lo evite. **Y la vía alternativa está cerrada por diseño del proveedor**: tokenizar una tarjeta guardada **exige volver a capturar el código de seguridad** (documentado), y un token de tarjeta es **de un solo uso** (`EX-12`), así que no sirve para cobrar el mes siguiente. Lo más plausible es que este `403` sea **el mismo portón comercial que `EX-32`** —el último paso de Wallet Connect es, campo por campo, este request— pero **eso no está medido**: son dos productos con nombres distintos

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:389

<a id="mp-ex-32"></a>

### `MP:EX-32` · ¿Está disponible **Wallet Connect**?

- **Comportamiento**: ¿Está disponible **Wallet Connect**?
- **Para qué**: «el ciclo de vida es nuestro», vía billetera
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox **+ requisito publicado**
- **Evidencia**: sonda 41 (`./mp-probes/probe-41-wallet-connect.mjs`)
- **Conclusión**: **El recurso existe, no lo tenemos, y no lo podemos pedir.** `POST /v2/wallet_connect/agreements` devuelve **`403 Forbidden`** con y sin el header `x-platform-id`; un `GET` sobre la misma ruta devuelve **`405 Not Allowed`**, o sea que **la ruta está viva en el gateway** y no es un `404`. El control (`/v1/orders` con cuerpo incompleto → `400`) confirma que la cuenta sigue respondiendo normal. **Lo que lo cierra no es el `403` sino el requisito publicado**: la integración está disponible **sólo** para vendedores con **más de 100.000 usuarios** (dos variantes: ticket promedio < 15 USD con ≥2 transacciones mensuales por usuario, o suscripción mensual con ticket < 40 USD). Hospeda tiene **3** relaciones de cobro vivas: son más de tres órdenes de magnitud, así que **no es una negociación que se pueda intentar**. El mecanismo, para el registro: acuerdo → el comprador aprueba **en su app de Mercado Pago** → `payer_token` **persistente** de servidor (a diferencia del de tarjeta, que es de un solo uso) → `POST /v1/orders` con `payment_method: {type:'wallet'}` y `stored_credential`. **Trampa de método**: la página de *prerrequisitos* del producto **no menciona el umbral** —lo encontró el owner en la página de disponibilidad—, y este documento llegó a afirmar que no había mínimo de volumen. **Que una fuente no mencione algo no prueba que no exista**

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:390

<a id="mp-ex-33"></a>

### `MP:EX-33`

- **Comportamiento**: Una suscripción creada **pendiente** con fecha de primer cobro futura y autorizada **por el cliente en el checkout**, ¿respeta esa fecha?
- **Para qué**: **`DEC-SUB-006`**
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-16
- **Entorno**: **producción, tarjeta real**
- **Evidencia**: sonda 43 (`./mp-probes/probe-43-la-tarjeta-que-se-apaga.mjs`) · sonda 44 (`./mp-probes/probe-44-el-segundo-trial-del-mismo-pagador.mjs`) · ids (`./mp-probes/manifiesto-tarjeta-apagada-2026-09-16.json`)
- **Conclusión**: **SÍ la respeta, y se midió TRES veces sobre el mismo pagador.** Preapprovals creados `pending` con `start_date` a +3, +2 y +5 días, autorizados a mano por el owner en el checkout con su tarjeta real: los tres quedaron `authorized` con `next_payment_date` en la fecha pedida y **`charged_quantity` nulo, cero pagos**. **La condición de `DEC-SUB-006` y `DEC-SUB-007` se levanta: el cliente que cambia de ciclo no paga dos veces.** Se midieron tres y no una porque `EX-29` había encontrado el patrón `✅ ✅ ❌` —el trial se agotaba a la tercera— y de replicarse acá, el mecanismo de compensación fallaría en el segundo o tercer cambio de plan de cada cliente, que es una situación normal. No se replica por este camino (preapproval **sin plan**). ⚠️ Lo que sí destapó es `EX-38`

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:391

<a id="mp-ex-35"></a>

### `MP:EX-35` · Poner un **`free_trial`** sobre una suscripción ya viva

- **Comportamiento**: Poner un **`free_trial`** sobre una suscripción ya viva
- **Para qué**: cortesía, `BD-MP-02`
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: sonda 42 (`./mp-probes/probe-42-cambiar-la-tarjeta-de-una-viva.sh`)
- **Conclusión**: **No se puede, y falla en silencio.** Dos formas sobre el mismo sujeto `authorized` —`auto_recurring.free_trial` suelto, y el `auto_recurring` completo con `free_trial` adentro—: **las dos `200`, `free_trial` siguió en `null` y `last_modified` congelado**. Con control: un `PUT` de `transaction_amount` sobre el mismo objeto, minutos después, entró y movió `last_modified`. **Consecuencia para la cortesía: "N meses gratis" no se puede regalar poniéndole un trial a una suscripción existente.** Lo que sí funciona para diferir un cobro es `start_date`, y sólo **al crear** (`EX-7`, `EX-33`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:392

<a id="mp-ex-36"></a>

### `MP:EX-36` · Cambiar el **medio de pago** de una suscripción viva, sin recrearla

- **Comportamiento**: Cambiar el **medio de pago** de una suscripción viva, sin recrearla
- **Para qué**: tarjeta vencida/robada, recuperación de `RN-3`
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: sonda 42 (`./mp-probes/probe-42-cambiar-la-tarjeta-de-una-viva.sh`)
- **Conclusión**: **SE PUEDE: `PUT {card_token_id}` cambia la tarjeta.** Verificado por relectura, no por el código: `card_id` **9813074735 → 9813071441 → 9845813907** y `payment_method_id` **`master` → `debmaster` → `amex`**. Cambia de marca y hasta de crédito a débito. **Un cliente con la tarjeta vencida NO tiene que rehacer la suscripción ni volver al checkout.** Tres cosas que vienen con esto: (1) **el cambio COBRA una validación de ARS 0** (`operation_type: card_validation`), así que **puede fallar** —`402`— y hay que manejarlo; (2) **el endpoint no dice por qué falló**: devuelve `402 {"message":"Unknown error","error":null,"cause":null}`, y el motivo real **sólo existe en el pago de validación**, que hay que ir a buscar aparte; (3) el token es de **un solo uso** (`EX-12`), así que cada reintento tokeniza de nuevo ✅ **RE-CONFIRMADO el 2026-09-17** (sonda 47 (`./mp-probes/probe-47-la-tarjeta-que-pasa-y-no-cobra.mjs`)) sobre `renov-falla3`: `card_id 9813074735 → 9834888704`, `payment_method_id master → visa`, verificado por relectura. ⚠️ **Y con una trampa nueva, medida**: el control se corrió PRIMERO con una **Mastercard** sobre una suscripción que ya tenía `master`, y dio **`200` con la tarjeta sin cambiar** — porque era **el mismo plástico**. «Aplicó y dio igual» y «lo descartó en silencio» se ven **idénticos** en la relectura. **Sólo una tarjeta de OTRA MARCA distingue los dos casos en este endpoint**, y sin esa distinción el `402` de `PA-4` no se podía interpretar 📌 **2026-09-29, qué avisa** (batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 56): el cambio llega como `subscription_preapproval` (Webhooks, +28 s) y como un `payment` de **ARS 0 con `operation_type: card_validation`** por **IPN y por Webhooks** (+2 s). El rechazado (`402`) llega sólo como ese `payment`, `rejected / cc_rejected_other_reason`, sin tocar la tarjeta ni `last_modified`. **Trampa para el receptor**: ese `payment` no trae `external_reference` ni nada que nombre al preapproval (`point_of_interaction UNSPECIFIED`; el único vínculo es `payer.id`), y por IPN es indistinguible de un cobro hasta releerlo: un handler de `payment` que no mire `operation_type` registra un «cobro» de cero pesos, o un «cobro rechazado» que no es de ningún ciclo

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:393

<a id="mp-ex-37"></a>

### `MP:EX-37` · El **`init_point`** que devuelve el proveedor, ¿sirve tal como viene?

- **Comportamiento**: El **`init_point`** que devuelve el proveedor, ¿sirve tal como viene?
- **Para qué**: alta de TODO cliente
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: **producción**
- **Evidencia**: sonda 43 (`./mp-probes/probe-43-la-tarjeta-que-se-apaga.mjs`) · mercadopago/sdk-nodejs#480 (`https://github.com/mercadopago/sdk-nodejs/issues/480`)
- **Conclusión**: **NO. La URL que entrega la API está ROTA, y es el caso más caro del §0.** El `init_point` de un `POST /preapproval` viene con `&activation=true` y esa URL abre **«Esta página no existe»** desde el 2026-09-04 — reproducido acá con la cuenta productiva, y es un **bug abierto del proveedor sin respuesta oficial**. La misma URL **sin** el parámetro abre el checkout normal. Es el peor caso posible porque **la API responde `201` y entrega un dato que parece válido**: no hay error de nuestro lado, y el cliente simplemente no se suscribe. **Mitigación obligatoria: nunca usar el `init_point` crudo — sanearlo antes de mostrarlo, y que un guard estático lo verifique.** Tiene que ser un guard y no un test: es un call site que cualquiera vuelve a escribir «bien» copiando lo que devuelve la API

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:394

<a id="mp-ex-38"></a>

### `MP:EX-38` · Una `start_date` futura, ¿qué le muestra el proveedor al cliente?

- **Comportamiento**: Una `start_date` futura, ¿qué le muestra el proveedor al cliente?
- **Para qué**: **`DEC-SUB-006`**, `DEC-SUB-007`, comunicación
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-16
- **Entorno**: **producción, tarjeta real**
- **Evidencia**: sonda 44 (`./mp-probes/probe-44-el-segundo-trial-del-mismo-pagador.mjs`)
- **Conclusión**: **El proveedor CONVIERTE la fecha en un free trial, solo, y se lo anuncia al cliente como una prueba gratis.** El request llevaba `start_date` y **nada más** —ni una mención de `free_trial`— y el objeto quedó con `auto_recurring.free_trial: {frequency: N, first_invoice_offset: N, frequency_type: "days"}` y `first_invoice_offset: N`, con N = los días pedidos. Reproducido **tres veces** (N = 3, 2 y 5). El comprobante que ve el comprador dice **«Tu prueba gratis comenzó»** y «Primer cobro después de la prueba gratis». **Consecuencia: compensar días ya pagados corriendo la fecha ES pedirle un trial al proveedor, aunque el payload no lo nombre.** Dos cosas se siguen de ahí: (1) un guard que busque `free_trial` **en el payload** no ve nada, porque el payload no lo tiene — lo agrega el proveedor; (2) al cliente que hace un upgrade a mitad de mes el proveedor le anuncia una **prueba gratis** justo cuando está usando días que **ya pagó**, y eso contradice lo que le diga nuestro correo (`DEC-MAIL-001`: los correos del proveedor **se anticipan**, no se desmienten)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:395

<a id="mp-ex-39"></a>

### `MP:EX-39` · Mover la **fecha de cobro** de un preapproval **`pending`** (no autorizado)

- **Comportamiento**: Mover la **fecha de cobro** de un preapproval **`pending`** (no autorizado)
- **Para qué**: **`D-16`** de la FASE 9: si la predecesora renueva dentro de la ventana de 72 h, el crédito queda corto un ciclo y corregirlo exige mover la fecha de la sucesora
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-19
- **Entorno**: sandbox
- **Evidencia**: sonda 48 (`./mp-probes/probe-48-mover-la-fecha-de-una-pending.mjs`)
- **Conclusión**: **No se puede, y falla en silencio — igual que sobre una viva.** Tres formas sobre un sujeto recién creado en `pending` con `start_date` a +10 días: `auto_recurring.start_date` suelto, `next_payment_date` suelto, y el `auto_recurring` completo con la fecha nueva adentro. **Las tres `200`, `start_date` y `next_payment_date` sin moverse, y `last_modified` CONGELADO en las tres.** **Con el control que lo vuelve concluyente**: un `PUT` de `transaction_amount` sobre el MISMO sujeto, a continuación, entró (2000 → 2500) **y movió `last_modified`**. O sea que lo bloqueado son **las fechas**, no el objeto. **Lo que agrega sobre `EX-34`**: aquella midió una suscripción **autorizada** y ésta una **`pending`**, con el mismo resultado — **la inmutabilidad de las fechas NO depende del estado**, así que `start_date` sirve **sólo al crear** también acá. Cuenta medida: `TESTUSER1461768820173121923` (MLA)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:396

<a id="mp-ex-40"></a>

### `MP:EX-40` · ¿Se puede **desactivar un plan** (`preapproval_plan`), y su link deja de vender?

- **Comportamiento**: ¿Se puede **desactivar un plan** (`preapproval_plan`), y su link deja de vender?
- **Para qué**: el corte (`16-fase-7-del-paraguas.md` §4.2, paso 1a): `DEC-MP-007` sacó los planes del diseño nuevo y los cinco planes viejos seguían `active` con su link vendiendo
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-24
- **Entorno**: **producción**
- **Evidencia**: sonda 50 (`./mp-probes/probe-50-desactivar-un-plan.mjs`) · resultados (`./mp-probes/RESULTS-2026-09-24-sonda-50.md`)
- **Conclusión**: **Sí, por API, y es REVERSIBLE.** Sobre un plan propio sin suscriptores (`d256f5eb…`): `PUT {status:"inactive"}` → `200`, y la relectura da **`cancelled`** (el proveedor traduce `inactive` a `cancelled`); `PUT {status:"active"}` sobre el cancelado → relectura **`active`**. **La documentación del proveedor dice que cancelar un plan es irreversible, y por API no lo es.** El `init_point` no cambia. **El link, abierto en el navegador**: el del plan cancelado muestra *«Este plan no está aceptando suscripciones»*; el control, un plan viejo activo, muestra el checkout con *«Elegir medio de pago»*. Desde un script el checkout responde `403` también con el plan activo, así que **el 403 no distingue nada**. 🚧 No mide: qué les pasa a los suscriptores existentes de un plan cancelado (la documentación dice que siguen cobrando) *(sale el 2026-09-30: nadie reactiva planes, porque abortar el corte es restaurar la base y volver a la imagen vieja sin reabrir la venta, y con eso sale la prueba en producción del paso 0; FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), lote D y S-63)*

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:397

<a id="mp-ex-41"></a>

### `MP:EX-41` · ¿`/v1/orders` es **idempotente** por `X-Idempotency-Key`?

- **Comportamiento**: ¿`/v1/orders` es **idempotente** por `X-Idempotency-Key`?
- **Para qué**: el addon de única vez (`B/16` §1.4): un timeout seguido de un reintento no puede cobrar dos veces (`F-8CB1-008`)
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-25
- **Entorno**: sandbox
- **Evidencia**: sonda 51 (`./mp-probes/probe-51-idempotencia-de-orders.mjs`) · resultados (`./mp-probes/RESULTS-2026-09-25-sonda-51.md`)
- **Conclusión**: **Sí, por la clave.** Dos `POST` con **la misma clave y el mismo cuerpo** devolvieron `201` las dos veces y **la misma orden** (`ORDTST01M3CKPXTXH709N0TVB7D88KQF`), con **un solo pago** —relectura: `processed/accredited`, 1 pago—. **Misma clave con otro cuerpo** (otro monto): `409 idempotency_key_already_used`, sin orden nueva. **Control**: dos claves distintas con el **mismo `external_reference`** crearon **dos órdenes y dos cobros** — el `external_reference` **no deduplica nada**, así que la clave se acuña y se persiste **antes** de la llamada (`D4`) y un reintento usa **la misma**. 🚧 Medido en sandbox; producción no

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:398

<a id="mp-ex-42"></a>

### `MP:EX-42`

- **Comportamiento**: ¿La llamada del script del corte, directa a la API (`expiration_date_to` = ahora), vence una `Preference` de Checkout Pro, y la relectura lo confirma? *(reformulada el 2026-09-28, revisión del owner, `L3-a`)*
- **Para qué**: el corte (`16-fase-7-del-paraguas.md` §4.2, paso 1a): la `Preference` del cambio de plan del sistema viejo **no vence** —`initiatePaidPlanUpgrade` no pasa `expiresInMinutes` y el adaptador sólo escribe `expiration_date_to` si se lo pasan—, y la herramienta del corte la vence por API (owner 2026-09-26, `Y-1`; FASE 9 vuelta 1, `N-G4V-01`)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: **Sin medir;**, sobre una preferencia propia sin pagar. Hay que ver tres cosas: que el update de `expiration_date_to` = ahora que manda el método `expire` entra, que **la relectura de la preferencia** lo devuelve, y que **el proveedor rechaza pagar la preferencia vencida**. Un `200` al update no prueba ninguna de las dos últimas (`EX-20`: un `2xx` no significa que el cambio se haya aplicado). Si no la vence, el 1a no tiene cómo acotar esas preferencias y `Y-1` vuelve al owner 🚫 **No se mide, por decisión del owner** (2026-09-30, FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), lote C y S-59): el corte ya no vence por API las `Preference` del cambio de plan del viejo (S-43): quien tenga una abierta es una de las cinco cuentas, a quien el owner le pide no pagar nada en el viejo, y un cobro tardío de un débito viejo se trata como cualquier débito desconocido. Queda `UNKNOWN`, sin bloquear nada

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:399

<a id="mp-ex-43"></a>

### `MP:EX-43`

- **Comportamiento**: ¿Reenviar una orden con la misma clave y el mismo cuerpo horas después —con el token de la tarjeta ya vencido— devuelve la misma orden si existía, y qué devuelve si nunca se creó?
- **Para qué**: `A3` sobre el addon de única vez (`B/03` §8; FASE 9 vuelta 2, `R4`)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: Pendiente de sonda. Si devuelve error cuando la orden existía, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas del barrido.

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:400

<a id="mp-ex-44"></a>

### `MP:EX-44`

- **Comportamiento**: ¿Cancelar un preapproval **corta el reciclado** de un registro de cobro abierto (`scheduled`/`recycling`), o un cambio de medio posterior todavía lo cobra?
- **Para qué**: la exención de las terminales (`B/09` §3; FASE 9 vuelta 2, `R2`) *(sin el sujeto del corte desde el 2026-09-30: FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-60)*
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: **Se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-60), sobre una sonda propia con un registro abierto. Queda por su uso de producto: la exención del barrido y `S16` (`B/09` §3) 🔎 **Indicio, no medición** (2026-09-29, logs de producción (`./mp-probes/RESULTS-2026-09-29.md#anexo-la-lectura-de-producción-para-wh-5-y-wh-6-2909-tarde`)): el 2026-09-28 11:02:32 llegó un `subscription_authorized_payment` sobre `80a633be…`, un preapproval que el proveedor había cancelado por antifraude (ya `cancelled` en la lectura del 2026-09-23). El log no dice si es el reciclado del cobro rechazado o un registro nuevo, y el preapproval no lo canceló Hospeda: no contesta esta fila, pero dice que un preapproval cancelado **sigue produciendo avisos de su registro de cobro** días después

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:401

<a id="mp-ex-45"></a>

### `MP:EX-45` · Una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato, ¿sigue `cancelled` releída **horas después**?

- **Comportamiento**: Una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato, ¿sigue `cancelled` releída **horas después**?
- **Para qué**: **el criterio de exención del barrido y `S16`, con la ventana del plazo 16, la ventana de relectura de la cancelación por rechazo** (`B/09` §3; FASE 9 vuelta 3, lote K; sumado con OK del owner, lote AN) *(sin el sujeto del corte desde el 2026-09-30: FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-60)*
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: El código actual registra seis que no (`preapproval-recovery.service.ts:22`, HOS-937); **se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-60). `PA-5` midió la irreversibilidad en sandbox

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:402

<a id="mp-ex-46"></a>

### `MP:EX-46`

- **Adjudicación** (`adjudicacion.json`, [BK](01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bk)): PARCIAL — lo muerto: «el borde la cierra desde que se apaga el contenedor viejo hasta que las lápidas están escritas» y los pasos 3 y 4 que nombra: el cierre del borde y las lápidas salieron (S-40, S-45); la pregunta sigue `UNKNOWN`, sin sujeto; lo muerto, aunque la fila no lo tache, se omite del texto de abajo y queda marcado «[…]»; lo tachado de la fila también se omite, y lo vigente va entero.
- **Comportamiento**: ¿A qué URL va el **reintento** de una notificación emitida antes de cambiar la URL de notificación de la aplicación: a la de entonces o a la vigente?
- **Para qué**: el paso 4b del corte (FASE 9 vuelta 2, `F-8V2C2-002`)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: `WH-4` midió los reintentos, no su destino. Si va a la vieja, el evento se pierde **y su cobro lo ve el barrido de B11 como el de cualquier desconocido** (la lápida del corte salió: FASE 5, simplificación del corte, S-40 y S-70; verificación, `VF5-06`) 🔎 **Indicio, no medición** (2026-09-29, anexo del 29/09 (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`)): mientras el owner cambiaba la URL de Webhooks de `/` a `/webhooks`, dos avisos fechados `14:34:27Z` en su propio cuerpo llegaron a la URL **nueva** a las 14:40:10Z, y no quedó ningún intento a la vieja (el receptor contestaba `200` a todo). Compatible con «sale a la URL vigente al momento de entregar», pero no es esta pregunta, que es sobre un **reintento** tras un `500`, y la ventana estaba contaminada (también cambió la selección de eventos) 🚫 **No se mide, por decisión del owner** (2026-09-29, decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-4): si el día del corte se pierde un reintento, el barrido diario lo relee (`B/21`, «NO cierra», punto (3)). Queda `UNKNOWN`, sin bloquear nada 📌 **Sin sujeto desde el 2026-09-29, con OK del owner** (decisiones sobre la verificación (`./30-revision-del-owner/32-decisiones-sobre-la-verificacion.md`), lote O-B): la URL de notificación ya no cambia en el corte. El receptor nuevo sirve la misma ruta que el viejo, `/api/v1/webhooks/mercadopago`, […], y el reintento vuelve a la misma URL (`16-fase-7-del-paraguas.md` §4.2, pasos […] y 4b). El estado no cambia: la pregunta sigue sin medir, y ya no condiciona ningún paso

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:403

<a id="mp-ex-47"></a>

### `MP:EX-47`

- **Comportamiento**: Si el monto de un preapproval se muta **después** de creado el registro de cobro del ciclo (antes del lote, o durante sus reintentos), ¿el registro cobra el monto viejo o el nuevo?
- **Para qué**: el importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; FASE 9 vuelta 2, `F-8V2B3-001`)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: **Se mide en sandbox antes de `B11`, fuera del paso 0** (FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-61: es de producto, `B/09` §3), sobre una sonda propia. `PC-1` midió el monto vigente con la mutación mucho antes del cobro. Si cobra el viejo, el motivo 24 (`B/02` §2.5, `R20`) es el que lo ve

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:404

<a id="mp-ex-48"></a>

### `MP:EX-48`

- **Comportamiento**: Leído por id el pago que aprobó un registro de cobro (`authorized_payment`) en un **reintento** posterior a la creación del registro, ¿qué campo trae el instante de esa aprobación, distinto del `date_created` del registro?
- **Para qué**: *(sin sujeto desde el 2026-09-30: la lápida del corte y su ventana salieron; FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-40, S-41 y S-57; recogido en los cruces de la aplicación)*
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: Se medía sobre una sonda propia con un registro que se rechaza y cobra en un reintento (`GR-1`, `RC-6`). Un campo que dé la fecha del registro, o que no venga en la lectura por id, no sirve. Si ningún campo es confiable, la ventana vuelve al owner, 🚫 **No se mide, por decisión del owner** (2026-09-30, FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), lote C y S-57): su único sujeto era la ventana del corte, que sale con la lápida del corte (S-40, S-41); el 1b ya no la espera. Queda `UNKNOWN`, sin bloquear nada

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:405

<a id="mp-ex-49"></a>

### `MP:EX-49`

- **Comportamiento**: ¿Qué variantes de un correo entregan en la misma casilla, por proveedor? Sin puntos, con `+t1`, en mayúsculas y en los dominios hermanos, sobre cuentas receptoras nuevas del owner en Outlook, Hotmail, Yahoo, Proton, iCloud y Gmail (unos 30 correos, `29-…/25-` §4); y la distribución de dominios de la tabla de usuarios, **contando sólo dominios, sin exportar ni guardar casillas** (`V2-w`)
- **Para qué**: la lista cerrada del seudónimo del correo (`V/02` §2.2; FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: Se mide en el paso 0 del corte (`16-fase-7…` §4.2), antes del despliegue que lleva la lista. Un rebote 550 prueba que la variante cuenta; que llegue, que se ignora; *nada a los 30 minutos* no prueba nada y se repite. Lo que la tabla da como *«si la medición lo confirma»* entra sólo si lo confirma; lo que la medición muestre fuera de la tabla vuelve al owner

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:406

<a id="mp-ex-50"></a>

### `MP:EX-50`

- **Comportamiento**: ¿Cuántas suscripciones del sistema viejo con ciclo anual (`frequency: 12`, `frequency_type: months`) siguen vivas el día del corte?
- **Para qué**: *(sin sujeto desde el 2026-09-30: el detector posterior al corte salió con la lápida del corte; FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-42 y S-58; recogido en los cruces de la aplicación)*
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: Si hay alguna, el `expire_date` del registro de cobro abierto de cada una se mide ahí: `RC-7` midió `expire_date` = un ciclo sobre ciclos de 1 y 2 días, y sobre un anual es una extrapolación. No es condición del corte: dice cuándo cae la segunda corrida 🚫 **No se mide, por decisión del owner** (2026-09-30, FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), lote C y S-58): la segunda corrida del detector sale (S-74), y el owner ya dio el hecho: no hay anuales vivas en el sistema viejo ni las va a haber antes del corte (`DEC-MIG-005`, lote F de la FASE 9 vuelta 3). Queda `UNKNOWN`, sin bloquear nada

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:407

<a id="mp-ex-51"></a>

### `MP:EX-51` · ¿A qué hora cobra el proveedor un registro de cobro con fecha dada?

- **Comportamiento**: ¿A qué hora cobra el proveedor un registro de cobro con fecha dada?
- **Para qué**: la M8 de la lista del proveedor falso, que no tenía fila y que `G15` pide (`DEC-TEST-003`; revisión del owner, 2026-09-28, C13)
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-24
- **Entorno**: producción
- **Evidencia**: lectura de las renovaciones de producción del 2026-09-24 (`B/09` §6 punto 2, `03-handoff.md`)
- **Conclusión**: **En lotes al minuto `:02`, en el primero posterior a la hora de la fecha**: trece renovaciones con fecha 13:13-13:28 `-04` entraron a las 14:01-14:02, y una con fecha 17:43 a las 18:02. No está medido que los lotes corran todas las horas. Fila abierta el 2026-09-28 sobre una medición ya hecha, con OK del owner

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:408

<a id="mp-ex-52"></a>

### `MP:EX-52`

- **Comportamiento**: Si el pagador cancela desde su cuenta de Mercado Pago, ¿qué aviso llega, por qué canal, y qué campo del preapproval la distingue de una cancelación nuestra o de una por antifraude?
- **Para qué**: N8, primer hueco: `DEC-MP-008` y `DEC-SUB-009` tratan hoy esa baja como del proveedor (revisión del owner, 2026-09-28, N8)
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-29**
- **Entorno**: **sandbox, cuenta real del comprador de prueba**
- **Evidencia**: mediciones del 29/09, anexo (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`) · `06fed561…` cancelado por el owner desde la cuenta del comprador (11:48 `-03`)
- **Conclusión**: Con un comprador de prueba en sandbox, los dos canales apuntados al receptor ✅ **2026-09-29, el owner desde la cuenta del comprador** (anexo del 29/09 (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`)): cancelar deja el preapproval `cancelled` y llega **un** `subscription_preapproval` `updated` **sólo por Webhooks**, a +2,6 s; **nada por IPN**, ningún pago ni `authorized_payment`. **Ningún campo de la relectura ni del aviso la distingue de una cancelación nuestra por `PUT`**: mismo cuerpo, mismo `status`, sin actor ni motivo. La del proveedor tras un rechazo sí se reconoce, pero sólo porque nunca cobró (`card_id` ausente, `summarized` en `null`, `next_payment_date` igual a `date_created`). Consecuencia para `DEC-MP-008`/`DEC-SUB-009`: **la autoría de una baja sólo se conoce por nuestro propio registro** (si no la pedimos, vino de afuera). Sólo se puede medir, y sólo existe, con un alta por checkout con el comprador logueado (`EX-56`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:409

<a id="mp-ex-53"></a>

### `MP:EX-53`

- **Comportamiento**: ¿Puede el pagador pausar desde su cuenta de Mercado Pago? Si puede, ¿cómo se ve en el preapproval y en `/authorized_payments/search`, y qué aviso llega por cada canal?
- **Para qué**: N8, segundo hueco: en la mora hay intentos rechazados en el ciclo (`GR-3`) y en una pausa voluntaria no (revisión del owner, 2026-09-28, N8)
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: **2026-09-29**
- **Entorno**: **sandbox, cuenta real del comprador de prueba**
- **Evidencia**: mediciones del 29/09, anexo (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`) · `a459aa50…`, relectura sin cambios
- **Conclusión**: ⛔ **2026-09-29, el owner desde la cuenta del comprador** (anexo del 29/09 (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`)): **el pagador no puede pausar**. La opción no aparece sobre una suscripción `authorized` (`a459aa50…`) que la misma cuenta sí puede cancelar (`EX-52`); la relectura no cambió (`last_modified` de la autorización) y no llegó ningún aviso. Mirado en **la web y en la app del celular**: no aparece en ninguna. Consecuencia: **toda pausa es nuestra** (`PUT`) **o de mora** (`GR-3`), así que una `paused` sin `PUT` nuestro y sin intentos rechazados en el ciclo sería una anomalía, no una pausa voluntaria

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:410

<a id="mp-ex-54"></a>

### `MP:EX-54`

- **Comportamiento**: ¿Qué correo le manda el proveedor al pagador cuando le SUBIMOS el monto de un preapproval, con qué texto y en qué momento respecto de la mutación?
- **Para qué**: el tercer correo de la migración de un plan retirado, que lo anticipa con el texto exacto (`B/10` §3.7 punto 4; `DEC-SUB-023`; revisión del owner, casos vecinos, 2026-09-29, caso 34)
- **Estado**: `UNKNOWN`
- **Fecha**: —
- **Entorno**: —
- **Evidencia**: —
- **Conclusión**: Sin medir. `EX-3` lo midió al bajar (*«El vendedor Hospeda cambió el monto»*). Se mide con una mutación hacia arriba sobre un preapproval de prueba, leyendo la casilla del pagador 🚧 **2026-09-29, no medido** (mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`)): la mutación hacia arriba se aplica sola y al instante en sandbox (`2500 → 3500`, `HTTP 200`, sin aviso al vendedor; `EX-15`), pero el correo sólo se ve en una casilla real (la del comprador de prueba es `@testuser.com` y nadie la lee). Exige subir el monto de un preapproval de producción del owner: sonda 54 (`./mp-probes/probe-54-subir-el-monto-en-produccion.mjs`) lista, con guardas, para que la corra él. Revertirlo dispara otro correo (`EX-3`) 🚫 **No se mide, por decisión del owner** (2026-09-29, decisiones sobre las mediciones (`./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md`), M-5): el tercer correo de la migración dice en general que Mercado Pago también va a mandar un aviso del cambio de monto, sin citar su texto (`B/10` §3.7 punto 4, `NUCLEO/07` §6). Queda `UNKNOWN`, sin bloquear nada; la sonda 54 no se corre

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:411

<a id="mp-ex-55"></a>

### `MP:EX-55` · ¿Un alta de preapproval que devuelve `400` deja un preapproval creado?

- **Comportamiento**: ¿Un alta de preapproval que devuelve `400` deja un preapproval creado?
- **Para qué**: el contrato de errores de todo alta con `card_token_id`: un `400` al crear no prueba que no se creó nada, y las entregas de lo que sí se creó llegan con ids que nuestra base no conoce (`EX-17`, `PA-4`; hallazgo lateral de la sonda 52, 2026-09-29)
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-29
- **Entorno**: sandbox
- **Evidencia**: mediciones del 29/09 (`./mp-probes/RESULTS-2026-09-29.md`) · batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 52 paso 10 en las corridas 1, 2 y 3
- **Conclusión**: **Sí, 3 de 3.** Un alta `authorized` con tarjeta rechazada (titular `OTHE`) devuelve `400 CC_VAL_433` **sin id** (`{"message":"CC_VAL_433 Credit card validation has failed","code":"rejected","status":400}`), pero el proveedor **crea** el preapproval con nuestro `external_reference` (`715371d2…`, `7eb2a11b…`, `1bd4f015…`), intenta el cobro (`cc_rejected_other_reason`), deja un `authorized_payment` `scheduled` con `rejection_code`, lo **cancela** a los 11 s, 1,95 s y 1 s, y **no avisa esa cancelación por ningún canal** (`WH-5`). Llegan su `payment` (por los dos canales) y su `authorized_payment` (por Webhooks). **Sólo se encuentra** ordenando `/preapproval/search` por fecha (el filtro `external_reference` se ignora, `RC-1`), y **el `search` muestra el estado atrasado minutos**: `pending` a +2 y +5 min cuando el `GET` por id ya daba `cancelled` (`RC-4`). Su `authorized_payment` aparece en `/authorized_payments/search` y da `404` por id (`EX-16`). Consecuencia: un `400` al crear **no prueba que no se creó nada**; la llave para asociar lo que llega es el `external_reference`, que viaja en el `payment`. Contraste: una **orden** con tarjeta rechazada también queda creada, pero ahí el id **sí** viene en el cuerpo del `402` (`EX-30`). Producción no medida

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:412

<a id="mp-ex-56"></a>

### `MP:EX-56`

- **Comportamiento**: Un preapproval creado por API con `card_token_id` + `status: authorized` + `payer_email` de un usuario con cuenta, ¿a nombre de quién queda, y lo ve el pagador en su cuenta?
- **Para qué**: todo lo que dependa del autoservicio del pagador en Mercado Pago (`EX-52`, `EX-53`, cambiar la tarjeta desde su cuenta) y la identidad del pagador (`EX-19`); hallazgo de la sonda 53 al medir `EX-52`/`EX-53` (2026-09-29)
- **Estado**: **`VERIFIED`**
- **Fecha**: 2026-09-29
- **Entorno**: sandbox
- **Evidencia**: mediciones del 29/09, anexo (`./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana`) · `GET /users/3694588836` y `GET /users/3499760966`
- **Conclusión**: **A nombre de un pagador INVITADO que el proveedor crea** (`3694588836`, `nickname "@3694588836"`, `site_status: guest`), no de la cuenta del mail (`3499760966`, `site_status: active`), aunque los pagos de los dos traen el mismo mail y la tarjeta tampoco es la guardada (`card_id 9884019412` contra `9813074735`). **El pagador no la ve ni la gestiona desde su cuenta.** Con checkout (`pending` + `init_point`) y el pagador logueado, queda a nombre de su cuenta y sí la gestiona (`EX-52`). Consecuencias: (1) todo autoservicio del pagador en Mercado Pago **exige el alta por checkout**, y con el alta por API no existe; (2) **`payer_id` no es una identidad estable por mail**: el mismo mail tiene dos `payer_id` (y `EX-19` ya había visto que el `payer_id` del preapproval no es el `payer.id` del pago). Producción no medida: puede que allá el mail se vincule a la cuenta existente

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:413

<a id="mp-ex-57"></a>

### `MP:EX-57`

- **Comportamiento**: ¿Se puede encontrar una orden de `/v1/orders` por su `external_reference` sin conocer su id (una búsqueda de órdenes, o `/v1/payments/search` por la referencia del pago de la orden)?
- **Para qué**: la búsqueda por el identificador del pedido de la comprobación de órdenes pagadas (`B/09` §3) y el motivo 23 sin id (`DEC-CONC-001`; FASE 9 vuelta 3, lote E)
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-30**
- **Entorno**: **sandbox**
- **Evidencia**: mediciones del 30/09 (`./mp-probes/RESULTS-2026-09-30.md`) · sonda 58 (`./mp-probes/probe-58-ex57-orden-por-referencia.sh`)
- **Conclusión**: Sin medir; se mide en sandbox y en producción. Si da que no, la compra que se quedó sin id de orden queda sin detector (`B/09`, «NO cierra»). Fila abierta el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote AB) ✅ **2026-09-30, sandbox** (mediciones del 30/09 (`./mp-probes/RESULTS-2026-09-30.md`)): **sí, con ventana.** `GET /v1/orders?begin_date=&end_date=&external_reference=` (doc «Buscar orders»; `/v1/orders/search` no existe: `400 invalid_path_param`) encuentra la orden por nuestra referencia, **exacta** (un prefijo da 0), la aprobada y la rechazada con `402` (`failed`), desde el instante de creación e igual a +2 y +10 min; una referencia inexistente da `200` con total 0. `begin_date`/`end_date` son **obligatorias**, filtran por creación, y el rango máximo es **30 días** (un minuto más da `400`). Respaldo: `/v1/payments/search?external_reference=` (sin fechas) trae el pago con la misma referencia y la orden en `point_of_interaction.references[ORDER_MP]`. `/merchant_orders/search` no ve órdenes de esta API. **La compra sin id de orden tiene detector** (`B/09` §3, motivo 23 de `DEC-CONC-001`), buscando con la ventana anclada a la creación local del pedido. **Falta**: producción (sólo lectura, con la referencia de la primera orden real) y pedidos de más de 30 días. Estado aplicado el 2026-09-30, con OK del owner (FASE 5, lote C1).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:414

<a id="mp-ex-58"></a>

### `MP:EX-58`

- **Comportamiento**: ¿`POST /v1/orders/{id}/refund` exige y respeta `X-Idempotency-Key`, qué devuelve un reenvío con la misma clave, y la relectura de la orden nombra el id de cada devolución? ¿Y trae el monto de cada una? *(sumado el 2026-09-30, con OK del owner, FASE 9 vuelta 3, lotes AK y AN)*
- **Para qué**: `RF2` y `RF3` sobre el pago de un `UNA_VEZ` (`B/03` §6.1) y la revocación del addon de única vez (`B/22` §2.2; `DEC-RF-001`; FASE 9 vuelta 3, lote L); (la rama salió: las devoluciones de una orden van de a una y el id sale por resta; FASE 5, owner 2026-09-30, lote 5 F)
- **Estado**: **`VERIFIED`**
- **Fecha**: **2026-09-30**
- **Entorno**: **sandbox**
- **Evidencia**: mediciones del 30/09 (`./mp-probes/RESULTS-2026-09-30.md`) · sonda 59 (`./mp-probes/probe-59-ex58-devolucion-idempotente.sh`), run `20260930T152653Z` · antes: batería IPN (`./mp-probes/RESULTS-2026-09-29-bateria-ipn.md`), sonda 56
- **Conclusión**: **Devolver una orden funciona**: un total y un parcial, `201`, releídos `refunded` y `partially_refunded`. **Falta la parte que nombra la pregunta**: si el `POST` exige y respeta la clave, qué devuelve un reenvío con la misma, y si la relectura nombra el id de cada devolución. La tabla de la batería anota un id `REF…` junto al estado releído, sin decir si vino en la respuesta del `POST` o en la relectura. Fila abierta el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote AB) ✅ **2026-09-30, sandbox** (mediciones del 30/09 (`./mp-probes/RESULTS-2026-09-30.md`)): **la clave es obligatoria**: sin `X-Idempotency-Key`, `400 empty_required_header` (parcial y total), sin efecto. **Y se respeta**: misma clave y mismo cuerpo → `201` con la misma devolución (respuesta idéntica byte a byte, foto de la primera llamada); misma clave y otro monto → `409 idempotency_key_already_used`, sin efecto. **Dos parciales del mismo monto se distinguen**: `GET /v1/orders/{id}` lista cada devolución con `id` (`REF…`), `reference_id`, `amount` y `status` propios, más `refunded_amount` acumulado, estable a +2 y +10 min. El `POST` ya trae el `REF…`, pero lista **todas** las devoluciones de la orden: la nueva sale por diferencia con las conocidas. Ninguna devolución trae fecha, `external_reference` ni la clave. **Consecuencias**: la clave se persiste antes del `POST`, derivada de nuestra fila, y nunca se regenera; un `409` es una clave mal derivada, no una devolución hecha; **las devoluciones de una misma orden van de a una**. **Falta**: producción (la Orders API nunca se midió allá; se re-mide con la primera devolución real). Estado aplicado el 2026-09-30, con OK del owner (FASE 5, lote C1).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:415

<a id="mp-ex-59"></a>

### `MP:EX-59`

- **Comportamiento**: Para un preapproval cuyo `GET` trae `payer_email` vacío, ¿alguna otra lectura trae el correo del pagador: el buscador sin filtro, o el pago asociado a un registro de cobro (`/authorized_payments/{id}` o `/v1/payments/{id}`)?
- **Para qué**: el detector del titular que sólo conoce el proveedor (`16-` §4.2 y §4.3, `B/21` §1.3; `DEC-MIG-005`; FASE 9 vuelta 3, lote G)
- **Estado**: **`PARTIALLY_SUPPORTED`**
- **Fecha**: **2026-09-30**
- **Entorno**: **sandbox y producción**
- **Evidencia**: mediciones del 30/09 (`./mp-probes/RESULTS-2026-09-30.md`) · sonda 60 (`./mp-probes/probe-60-ex59-correo-del-pagador.sh`) · anexo de producción (`./mp-probes/RESULTS-2026-09-30.md#ex-59-en-producción-corrida-del-owner`)
- **Conclusión**: Sin medir; se mide en sandbox. Si ninguna lectura trae el pagador, esa población queda declarada sin detector (`DEC-MIG-005`). Fila abierta el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote AB) 🟡 **2026-09-30, sandbox** (mediciones del 30/09 (`./mp-probes/RESULTS-2026-09-30.md`)): **sólo el pago de un cobro trae al pagador.** El sandbox reproduce el caso (`payer_email: ""` en el `GET` de `b12af185…`, `e6766650…`, `a459aa50…`). **Ninguna lectura de suscripciones trae el correo**: las filas del `search` sin filtro (183 = `total`) no tienen la clave `payer_email`; `authorized_payments` (search y por id) no trae pagador; `GET /users/{payer_id}` no trae `email`. **`GET /v1/payments/{id}` y `/v1/payments/search?external_reference=` sí traen `payer.email`**, igual al correo de creación incluso con pagador invitado (`EX-56`), y se llega desde el id del preapproval: `authorized_payments/search?preapproval_id=` → `payment.id` → `/v1/payments/{id}`. `?payer_email=` filtra (135 de 183; basura → 0): **verifica** un correo candidato, no lo **descubre**. Las lecturas de `/v1/payments` dan `200` en sandbox; sólo crear da `401`. **Límites**: (1) **sin cobro no hay pagador**: un `authorized` que no cobró no tiene detector salvo que su correo esté en nuestra base; (2) la vía es `/v1/payments` (`R-MP-01`); (3) **producción sin medir**: variante de sólo lectura en la sonda 60, que corre el owner (lote C2). Estado aplicado el 2026-09-30, con OK del owner (FASE 5, lote C1). ✅ **2026-09-30, producción, sólo lectura, corrida del owner** (anexo de producción (`./mp-probes/RESULTS-2026-09-30.md#ex-59-en-producción-corrida-del-owner`), run `20260930T161543Z`, sujeto `f0be57a1…`; FASE 5, lote C2): se reproduce. El `GET` trae `payer_email=""`, y ni el buscador (108 filas), ni `authorized_payments` (4 de 4), ni `/users` traen el correo. `/v1/payments/{id}` lo trae, **pero sólo en los pagos aprobados**: 4 de 4 aprobados sí, 2 de 2 rechazados (`cc_rejected_high_risk`, `cc_rejected_insufficient_amount`) traen `payer.email: null`. **El detector cubre sólo a quien tiene al menos un pago aprobado**; quien nunca cobró o sólo tiene cobros rechazados queda sin detector, salvo que su correo esté en nuestra base (`DEC-MIG-005`). El filtro `?payer_id=` también funciona en producción (47; basura → 0). Aplicado con OK del owner (FASE 5, lote C2). 📌 **Sujeto retirado el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte (`./38-fase-5/20-simplificacion-del-corte.md`), S-38 y S-62): el detector del titular que sólo conoce el proveedor, que usaba esta fila, salió del diseño. El estado no cambia: la medición sigue siendo cierta y ya no condiciona nada

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:416

<a id="mp-ex-34"></a>

### `MP:EX-34` · Correr la **fecha de cobro** de una suscripción **ya viva**

- **Comportamiento**: Correr la **fecha de cobro** de una suscripción **ya viva**
- **Para qué**: **`DEC-SUB-010`**, cierra `BD-MP-01`
- **Estado**: **`NOT_SUPPORTED`**
- **Fecha**: 2026-09-16
- **Entorno**: sandbox
- **Evidencia**: foto posterior (`./mp-probes/fotos-reloj-2026-09-16/pausa-real-despues-de-reanudar.json`) + los cuatro `PUT` de la corrida
- **Conclusión**: **La fecha de una suscripción viva es inmutable, y falla en silencio.** Cuatro formas de pedirlo sobre el mismo sujeto `authorized`, una por vez para no caer en `EX-20`: (1) `auto_recurring` completo con `start_date` a +3 días, (2) `next_payment_date` suelto, (3) `auto_recurring.start_date` suelto, (4) `auto_recurring.billing_day`. **Los cuatro `200`; `start_date`, `next_payment_date` y `has_billing_day` sin moverse, y `last_modified` CONGELADO en los cuatro** — o sea el proveedor no escribió nada, ni siquiera un no-op. **Con el control que lo separa de "esta suscripción está rara"**: un `PUT` de `transaction_amount` sobre la MISMA suscripción, minutos después, entró (2000 → 2500) y **movió `last_modified`**. Lo bloqueado son las **fechas**, no el objeto. Consecuencia: `start_date` a futuro sirve **sólo al crear** (`EX-7`), así que compensar días corriendo la fecha de una suscripción existente **no se puede** — hay que recrearla (`DEC-SUB-006`) o no compensar (`DEC-SUB-010`)

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:438
