---
title: Descomposición de la épica de verticales
linear: HOS-1353
statusSource: linear
created: 2026-09-18
updated: 2026-09-27
status: CURRENT
---

# Descomposición de HOS-1353

> **Esto no es un plan de fechas ni el atomizado en tareas.** Es el corte en unidades de trabajo y
> el orden que sale de las dependencias del propio diseño. El atomizado de cada unidad se hace
> cuando esa unidad arranca, no ahora.

## 1. El criterio de corte

**Se corta siguiendo la cadena de preguntas del diseño**, no por capa técnica ni por capítulo.

Cortar **por capa** —toda la base, después todos los servicios, después la API— tiene el problema
conocido: nada funciona hasta el final, y el primer error de modelado se descubre cuando ya hay
tres capas encima. Cortar **por capítulo** es peor: los capítulos son ejes de diseño y se cruzan —
el `02` toca todo, el `15` y el `17` se necesitan mutuamente.

La cadena que sí ordena es la del propio sistema, y cada eslabón deja **una pregunta contestada**:

```text
¿qué verticales y qué claves existen?      → V1
¿qué otorga un plan?                        → V2
¿qué puede hacer esta cuenta?               → V3
¿tiene título vivo?                         → V4
¿puede hacer ESTO, acá y ahora?             → V5
¿qué pasa cuando algo baja?                 → V6
```

Las tres últimas —Partner, superficies, retención— no están en la cadena porque **no la
condicionan**: se apoyan en ella.

### 1.1 Dos reglas que valen para las nueve

1. **Cada guard va con la pieza que protege, nunca al final.** Un guard que llega después es un
   guard que se escribe contra código ya escrito, y para entonces ya hay call sites que lo
   violan. Y cada uno **lleva su caso que lo hace fallar a propósito** — un guard que no puede
   fallar es un comentario con exit code 0.
2. **Ninguna unidad pregunta por dinero.** Si una lo necesita, es señal de que el corte de
   `DEC-ARCH-005` se está filtrando: se mira, no se resuelve en el lugar.

---

## 2. Las nueve unidades

| # | unidad | qué deja funcionando | capítulos | guards |
|---|---|---|---|---|
| **V1** | **El catálogo y su doble guard** | el enum de verticales, su espejo en base, y el catálogo de claves de entitlement y limit en código | `02` §1 (núcleo) · `10` §1 | `G1` `G3` `G8` |
| **V2** | **El catálogo de planes, y la dirección inversa del contrato** | `plan`, `plan_version` y sus entitlements y limits, con `rank`, vigente y vendible — **y las tres consultas con que billing lee este catálogo**: `políticaDePlan`, `situaciónDeVertical` y `direcciónDeCambio`, que devuelve **un veredicto** y nunca los valores — `situaciónDeVertical.admiteAltas` la lee además `S1`, que rechaza el alta nueva y la sucesión en una vertical que ya no admite altas (owner 2026-09-25; FASE 9 completa, 6a) — **y `políticaDeAddon`**, con que billing lee de una `addon_version` su `addon`, su vigencia y su tipo de scope, nunca lo que otorga (owner 2026-09-26, `G4-2`; su consumidor es `A1`, de `B10`) | `02` §2.1 · `10` §2 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §4.1 | **`G-R3`** |
| **V3** | **La resolución de capacidades** | *«¿qué puede hacer esta cuenta en esta vertical?»* tiene respuesta: agregación, scopes, caché e invalidación — **la invalidación por `user`, en todas sus verticales, y no por `user + vertical`** (`02` §3.2 regla 3; owner 2026-09-25, FASE 9 completa, 8a), **y la de una vertical entera, que el barrido del día del fin de servicio invoca** (`02` §3.2; 6b — el barrido es de `B12`); **el trinquete del `GRANT` leído del campo `piso` de la fuente** y nunca de una tabla de billing (`15` §2.5; 9h) | `15` §1–3 · `02` §3 | **`G-R2`** **`G-R2-B`** |
| **V4** | **El contrato de cobertura y el trial** | hay títulos vivos de verdad, y `cobertura()` responde **con la firma entera del contrato §2** —hoy siete campos, con `piso` (9h)—; **la máquina de trial con sus ocho transiciones**: el trial se convierte con el primer pago acreditado (`DEC-TRIAL-010`), **`T6` exige un título que convierte y `T8` consume la fila al primer pago de quien ya ejerció el evento** (owner 2026-09-25; FASE 9 completa, 6c); **y la operación `extenderTrial`** del contrato §4.1 —la única escritura de billing en verticales—: corre `T4` dentro del lock de la máquina de trial, con el techo de `11` §3, y contesta `ACEPTADA` o `RECHAZADA`; la clave de canje la vuelve idempotente (owner 2026-09-26, `G4-2`; la consume `B9`); **y la acción administrativa *«extender un trial»*** de `NUCLEO/08` §3 —la cortesía durante el trial—, **fuera del contrato**: `T4` con origen `SUPER_ADMIN` y motivo obligatorio, pasa el techo de `11` §3.4 y suma al total visible con su origen (`11` §3.5), con permiso propio y auditoría (owner 2026-09-26, P2; FASE 9 vuelta 1) | `11` entero · `03` §2 · `02` §2.2 · [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) | **`G-R4`** **`G-R4-B`** **`G-R6`** **`G13`** *(owner 2026-09-26, `G5-5`; §2.3)* |
| **V5** | **La autorización** | ninguna operación se ejecuta sin pasar por los ~~nueve~~ siete pasos — **con la vertical leída del recurso e inmutable** (precisión 6; 7a), **lo ajeno existente sólo en estado público** (precisión 7; 8c), **el paso 2 sin «inhabilitado por abuso»** (8b) y **las lecturas de lo propio sin el paso 6** (§3.5; 8d); todas owner 2026-09-25, FASE 9 completa; **el guest rechazado en el paso 1 salvo en la lectura pública, la lista cerrada del paso 2 con el correo sin verificar, ningún rol como fuente del conjunto efectivo** (FASE 9 vuelta 1, `F-8V1A1-006`, `-007`, `-002`) **y ninguna acción administrativa con `actor = sujeto`** (owner 2026-09-26, `G5-1`) | `17` entero | `G2` `G4` `G6` **`G-R3-B`** **`G-R3-C`** |
| **V6** | **Publicación y excedente** | una ficha se publica, cae al perder cobertura, vuelve al recuperarla **—también desde `ARCHIVED`: sola por `PB7`, o a pedido del dueño por `PB8`, que la versión de piso le autoriza—**, y el excedente se resuelve solo **en las dos direcciones**: cae lo más reciente primero y **vuelve primero lo que cayó al final**, con el criterio escrito en los dos avisos — **y el reconciliador diario de cobertura**, que una vez por día corre `PB2`/`PB3`/`PB7` donde el aviso no llegó, escribe los hechos 2 y 5, invalida el caché y le hace ping al monitor de cron externo (`03` §9; `DEC-ARCH-009`, owner 2026-09-25) —**y cuya población incluye a todo `user + Partner` con una clave de presencia, la página o el carrusel, sobre el que no corre transiciones: compara las claves y, si difieren, invalida** (`03` §9, `18` §1.6; FASE 8 completa, `R13`, y FASE 9 completa, 7b)—. **Y la máquina entera, de seis estados y doce transiciones** (salida 3 de la FASE 9 completa; decía sólo lo de arriba): **el lock por `user + vertical`** que toman `PB1`, `PB3`, `PB7` y `PB2` (`03` §9; FASE 8 completa, `R14`); **`MODERATED`, con `PB10` y `PB11`** —la acción administrativa de moderar, `NUCLEO/08` §3—, **y `PB11` como sexto hecho de reinicio** (owner 2026-09-25; FASE 9 completa, 5b); **`PB12`, el borrado del dueño a `PURGED`** (FASE 8 completa, `F-8CA2-004`), **con la desconexión del calendario de esa ficha en el mismo acto: su token se revoca en el proveedor y se borra** (`03` §9 `PB12`, `02` §4.1; owner 2026-09-26, `G1-5`; la unidad, con OK del owner, FASE 9 vuelta 1, J); **la vertical de la ficha inmutable desde el alta** (`02` §2.5; 7a); **y la escritura `C` del corte**, que pone `inactiva_desde` en el instante del corte a toda ficha preexistente en la misma migración estructural que crea la columna (`21` §2.4; asignada en la salida 3 de la FASE 9 completa, §2.10); **el estado de nacimiento de la ficha preexistente** (`21` §2.4, la tabla `L1`–`L8`), en la misma migración que la escritura `C`, ~~**incluido el borrado del contenido de las `L1`**~~ **y, en el paso 5b del corte y no en la migración, el borrado del contenido de las `L1` —en la base, sus fotos en el almacenamiento externo y su token de calendario—, con una herramienta del corte que se puede correr dos veces** (`16-fase-7…` §4.2; FASE 9 vuelta 2, `F-8V2A3-002`); **y `PB1` desde `UNPUBLISHED_BY_BILLING` por su rama de trial** (FASE 9 vuelta 1, R1; owner 2026-09-26, `G1-1`, `G1-2`); **y la consulta ~~`ficha(idDeFicha) → { vertical, dueño }`~~ `ficha(idDeFicha) → { vertical, dueño, admiteDestaque }`** del contrato §4.1, con que `A1` valida el objetivo de un addon `LISTING` (owner 2026-09-26, `G4-2`; **`admiteDestaque`**, FASE 9 vuelta 1, `N-G4V-06`) **—y la consulta `fichaPurgada` del contrato §4.1 con el empuje *«la ficha llegó a `PURGED`»* de `PB12`, que sale después del commit (`12-contrato…` §3.1; owner 2026-09-26, `G2-1`; la fila no la nombraba, FASE 9 vuelta 1, §4 punto 4 de `24-verificado-G4`)—** | `03` §9 · `02` §2.5 · `15` §4 · `21` §2.4 *(la escritura `C`)* | `G5` **`G-R6-B`** **`G-R5-B`** *(el `N` de `PB5`, que V6 construye; FASE 8 completa, `F-8CA2-014`, owner 2026-09-25)* |
| **V7** | **Partner** | la postulación con su máquina, la presencia como entitlement booleano, y el reclamo por correo — **la presencia sin máquina: la página y el carrusel se ven si el partner tiene hoy su clave —cada uno la suya— y la presencia no está moderada**; **el bit de moderación y su escritura** por la acción administrativa de moderar, la misma de `PB10`/`PB11` (§2.10); **y la respuesta 404, no 410, al partner sin presencia** (`21` §4); FASE 8 completa, `R13`; owner 2026-09-25, FASE 9 completa, 7b y 7c | `18` entero · `03` §11 · `21` §4 *(el 410 que pasa a 404)* | — |
| **V8** | **Superficies** | Mi Cuenta, los mensajes que hay que decir, el panel de postulaciones — **incluido el botón de suscribirse que, a quien todavía no publicó en esa vertical, lo manda a publicar en vez de al checkout** **si publicar le arrancaría el trial** (FASE 9 vuelta 1, `F-8V1D1-004`) (`19` §4 fila 23, donde está la regla entera; owner 2026-09-25, FASE 9 completa, 6c; el espejo de billing es `B/19` §4, de `B13`), y las filas 20 a 22 (la ficha `PURGED`, *«suscribite para publicar»*, la presencia que dejó de verse o está moderada); **y la acción administrativa 15, *«editar el contenido de una ficha ajena»*** —crearla en borrador a nombre de su dueño, corregirla, restaurar contenido, **sin publicar, sin destacar y sin borrar**—, **con permiso propio**, auditada con el actor, el sujeto y el *«por qué»* del `NUCLEO/08` §1.2, y con el aviso al dueño de la fila 1 del `19` (`NUCLEO/08` §3; `DEC-AUTH-003`; owner 2026-09-26, `G5-2`; la unidad, con OK del owner, FASE 9 vuelta 1, L) | `19` · `08` §1.2 y §3 (núcleo) | — |
| **V9** | **Retención** | el reloj de 90 y 180 días **con sus ~~cuatro~~ ~~cinco~~ seis hechos de reinicio** (el sexto, *«se levanta la moderación»*, lo escribe `PB11`, de V6 —owner 2026-09-25; FASE 9 completa, 5b—; el quinto lo escribe ~~`PB2`, de V6~~ `PB2`, de V6, sobre la ficha publicada, y el recálculo que el aviso despierta sobre las demás fichas del dueño en la vertical —o, si el aviso se perdió, el reconciliador diario de cobertura, de V6 (`DEC-ARCH-009`)—; FASE 8 completa, `F-8CA2-001`, owner 2026-09-25), ~~la anonimización,~~ **el día 180 como la fila `PB9` hacia `PURGED`, que sólo borra el contenido de la ficha (`DEC-DATA-005`; FASE 8 completa, `F-8CA2-008`)**, **y en el mismo acto desconecta el calendario de esa ficha: su token se revoca en el proveedor y se borra** (`03` §9 `PB9`, `02` §4.1; owner 2026-09-26, `G1-5`; la unidad, con OK del owner, FASE 9 vuelta 1, J), el ~~hash~~ **seudónimo determinístico** del correo (FASE 9 completa, `C-1`), los **tres** avisos, **y el registro de los actos del dueño sobre la ficha que no son transiciones —crearla, editarla, exportarla—, que es la fuente del hecho 1, guardando sólo el nombre de los campos de contenido, nunca su texto**, para que el día 180 no deje el contenido vivo en los eventos (`NUCLEO/08` §1.1–§1.2; owner 2026-09-25, FASE 9 completa, 8e); **y el empuje *«la ficha llegó a `PURGED`»* que `PB9` le manda a billing después de su commit** (contrato §3.1; FASE 9 vuelta 1, `G2-1`) | `02` §4 · `22` §3 · `01` §1.2 (núcleo) · `03` §9 (`PB9`) · `08` §1.1–§1.2 (núcleo) | — *(decía «el de `D16`», que era `G-R5`; se va a `B8` — §2.7)* |

### 2.1 Por qué V1 va primero aunque parezca infraestructura

Porque **dos de sus tres guards** son **los únicos que no se pueden agregar después sin reescribir lo
anterior**. `G1` prohíbe nombrar una vertical fuera de los ocho ítems del Eje 2 y `G3` verifica el
catálogo de claves **en las dos direcciones**. Si llegan en V5, para entonces hay cinco unidades
de código que los violan y el guard nace con una lista de excepciones — que es exactamente cómo
un guard deja de servir.

### 2.2 Por qué el trial y el contrato son la misma unidad

Porque **el trial es la implementación de arranque del contrato** (`DEC-ARCH-006`). Separarlos
dejaría el puerto sin ninguna fuente que lo responda de verdad, y ahí la única opción sería un
simulacro que contesta siempre lo mismo — que es justo lo que la decisión descartó, porque **deja
sin ejercer la mitad interesante: perder la cobertura**.

### 2.3 ~~Hay un guard de V4 que NO nace en V4, y nace del otro lado~~ `G13` nace en V4, como dice el contrato

> **Reescrito el 2026-09-26 (owner, `G5-5`; FASE 9 vuelta 1, contradicción (a)).** **`G13` lo
> construye `V4`**, con la implementación de arranque, y su fila vive en `V/20` §2. El argumento de
> abajo —*«falla desde el primer día»*— lo contesta el propio contrato §6.3: el guard **falla sobre
> un build destinado a producción, no sobre la rama**, así que calla mientras ningún build apunte a
> producción y no nace con lista de excepciones. Y la razón que lo mandaba a billing (*«el consumidor
> del contrato es billing»*, `B/20` §2) era falsa: el consumidor de `cobertura()` es verticales. Las
> dos ubicaciones protegían el merge, porque las épicas llegan juntas (`DEC-ARCH-007`); ésta además
> tiene la defensa desde el primer día. Lo que sigue queda como historia.

*(Este § decía *«esta tabla dejó a V4 sin guards»*, y desde el reparto del §2.6 V4 tiene tres:
`G-R4`, `G-R4-B` y `G-R6`. ~~Lo que sigue valiendo entero es el caso de `G13`, que es de otra
naturaleza: es un guard **sobre** lo que V4 construye y que **no puede nacer acá**.~~ **Desde `G5-5` son cuatro: `G13` nace en V4 (el recuadro de arriba), así que *«no puede nacer acá»* ya no vale; FASE 9 vuelta 1, §4 punto 2 de `24-verificado-G4`.**)*

El que le correspondía a V4 y no podía nacer en V4 lo encontró la descomposición de billing:
**`G13`**, la tercera defensa del
[contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md) §6.3 — *«un
guard impide que la implementación de arranque llegue a producción»*.

~~**No puede nacer acá.** Mientras la de arranque es la única implementación que existe, un guard que
prohíba su llegada a producción **falla desde el primer día**, y un guard que falla desde el primer
día nace con una lista de excepciones — que es exactamente el argumento del §2.1, leído al revés.~~

~~Nace en **B4** de la otra épica, que es donde aparece la segunda implementación. Queda anotado acá
para que nadie lo lea como un olvido.~~ (tachado 2026-09-26: nace en **V4**, ver el recuadro de
arriba)

### 2.4 Por qué el excedente va con publicación y no con entitlements

El reconciliador se define en el `15` §4, pero **lo que hace es despublicar**, y su criterio —cae
lo más reciente primero— sólo se puede verificar con fichas de verdad. Construirlo en V3 sería
escribirlo sin poder probarlo.

### 2.5 `G-R6-B` va con V6 y no con V9, y las dos candidatas eran razonables

`G-R6-B` (`20` §2) falla si **algo toca `listing.inactiva_desde` desde un lugar que las listas
cerradas no nombran, o si un lugar que ellas nombran dejó de tocarla**: una **escritura** que no sea
uno de los ~~cuatro~~ ~~cinco~~ seis hechos del `01` §1.2 (núcleo) ni la escritura `C` del corte, una
**lectura** que no figure entre los ~~cinco~~ seis consumidores del `02` §2.5 (cuarta enmienda de
`DEC-TEST-001`; recontados en la FASE 8 completa, `F-8CD1-009`), o **uno de esos ~~cinco~~ seis que
ya no lee**. Las dos unidades que lo podían reclamar son **V6**, que crea la columna
(`02` §2.5) y **escribe** en ella —`PB1`, `PB3` y `PB7` son el tercer hecho, **la primera rama de
`PB2` es ~~el quinto~~ uno de los ~~dos~~ tres ejecutores del quinto** —~~el otro es~~ los otros son el recálculo que el aviso
despierta, sobre las fichas del dueño que no estaban publicadas, **y el reconciliador diario de
cobertura, cuando el aviso se perdió** (`DEC-ARCH-009`)— (FASE 8 completa, `F-8CA2-001`,
owner 2026-09-25), la relectura de
`PB4`/`PB5` es uno de los ~~tres~~ cuatro momentos del segundo (`02` §4.2 regla 4), **`PB11` es el
ejecutor único del sexto** (owner 2026-09-25; FASE 9 completa, 5b) **y la escritura `C` del corte
nace con la columna** (§2.10)—, y **V9**, que es la dueña
del `01` §1.2 y del reloj que la **lee**.

**Va con V6 por la regla 1 leída entera**: el guard protege **las piezas que tocan la columna**, no
las listas como texto, y **V6 es la unidad donde nacen las primeras** — la columna, sus escrituras
y los dos lectores que archivan. Y por el argumento del §2.1 leído sobre el orden real: **V9
depende de V4 y V6** (§3), así que un guard que llegue con V9 llega **después de todos los
escritores que existen**, que es la definición de *«un guard que se escribe contra código ya
escrito»*. Puesto en V6, lo que puede aparecer después es **una pieza nueva** — que es exactamente
lo que viene a rechazar.

**Y la mitad de lectores refuerza la elección en vez de moverla, aunque sus consumidores nazcan
tarde.** De los ~~cinco~~ seis, `PB4` y `PB5` son de V6; el día 180 y los dos avisos previos son de **V9**;
la fecha que se le imprime al cliente es de **V8**. Un guard que naciera con el último de ellos
llegaría cuando los ~~cinco~~ seis ya existen y **nacería con lista de excepciones**; naciendo en V6 ve
llegar a los ~~tres~~ cuatro de afuera **uno por uno**, y cada uno tiene que traer su fila al `02` §2.5 para
pasar. Es el caso de libro del §2.1, con lectores en vez de escritores.

**Lo que V9 conserva es su parte**: la lista del `01` §1.2 es su capítulo y el guard la cita; si
alguien agrega un ~~quinto~~ séptimo hecho, **el cambio es de V9 y el rojo lo da el guard de V6**. *(El
sexto, «se levanta la moderación», ya lo probó: lo agregó la FASE 9 completa a la lista de V9 y
lo ejecuta `PB11`, de V6 — 5b.)* ~~Es la misma
forma de `G13`, que vigila el contrato de V4 y nace en `B4` (§2.3):~~ *(`G13` ya no sirve de
ejemplo: nace en `V4` desde el 2026-09-26, `G5-5`, §2.3.)* **Dónde se construye un guard y
qué documento define su lista son dos preguntas distintas.**

### 2.6 Los ocho guards de esta épica que no tenían unidad, y por qué cada uno cae donde cae

La columna de arriba dejaba **ocho** guards de `V/20` §2 sin ninguna unidad que los construya, y
`C2` lo venía reportando **tres vueltas seguidas** (`F-8dC2-003` → `F-8eC2-004`). La **quinta
enmienda de `DEC-TEST-001`** decide repartirlos ahora, con tres condiciones que gobiernan lo que
sigue: **la razón va medida y con cita**, **la unidad nace ANTES o CON lo que el guard vigila** —el
criterio del §2.5, que es el que `G-R5` violó— y **lo que no tiene unidad clara se declara sin
dueño**. Los ocho tienen unidad medida; lo que el §2.8 trataba aparte **no era una asignación
faltante y tampoco era una pregunta**: era un defecto del enunciado de `G-R6`, y quedó resuelto en
`B/20` §2.

| guard | unidad | qué construye esa unidad que hace que el guard pueda existir ahí |
|---|---|---|
| **`G-R3`** | **V2** | las **dos versiones no vendibles** que el guard vigila — son `plan_version`, y `02` §2.1 es capítulo de V2 |
| **`G-R2`** | **V3** | **la resolución**, que el propio `15` §2.6 declara *«el sujeto del guard»* |
| **`G-R2-B`** | **V3** | **el trinquete por vertical** del `GRANT`, que se compara adentro de esa misma resolución (`15` §2.5) |
| **`G-R4`** | **V4** | **la primera tabla de transiciones del programa**: la de trial, `03` §2 |
| **`G-R4-B`** | **V4** | esa misma tabla **y el contrato** cuyo §4 el guard hace cumplir |
| **`G-R6`** | **V4** | la misma primera tabla — mismo dominio que `G-R4` |
| **`G-R3-B`** | **V5** | **la clase** *«transición disparada por el reloj»*, que `17` §3.4 declara |
| **`G-R3-C`** | **V5** | **el paso 5** y la declaración que el guard lee, que `17` §3.5 pide con todas las letras |

**`G-R3` va con V2 porque su sujeto nace ahí y no antes.** El guard sale de `02` §2.1, que es
capítulo de V2, y lo que vigila son **las dos versiones no vendibles** —la de pre-trial y la de
piso—, que son `plan_version`: exactamente lo que V2 deja funcionando (*«`plan`, `plan_version` y
sus entitlements y limits, con `rank`, vigente y vendible»*). Antes de V2 no hay ninguna versión
que se pueda sembrar mal, así que el guard **nace con su sujeto y no contra él**. Y V2 es la
**segunda** unidad del §3, con lo cual todo lo que después lee esas versiones —la resolución de
V3, el paso 5 de V5, y la reactivación desde `ARCHIVED` *«que la versión de piso le autoriza»*
(§4, fila V5)— llega **uno por uno**. Importa que sea temprano por lo que el catálogo dice de este
guard: *«es el que más carga lleva … si alguien siembra una de esas dos versiones con una clave
comercial, toda la plataforma la recibe gratis, para siempre»* (`V/20` §2).

**`G-R2` va con V3 porque el capítulo que lo crea nombra su sujeto.** `15` §2.6 cierra diciendo
*«Se comprueba sobre la resolución y no sobre cada call site, porque `V/17` §1.3 ya obliga a que
los pasos se resuelvan en un solo lugar; **ese lugar es el sujeto del guard**»*. Ese lugar —el
pliegue del conjunto efectivo y sus cuatro estrategias— **lo construye V3** (`15` §1–3). Fuera de
V3 el guard no tiene dónde pararse: no es una propiedad de los call sites.

**`G-R2-B` va con V3 por el mismo capítulo, y su consumidor llega de la otra épica.** `15` §2.5
termina con *«Lo vigila `G-R2-B` (`V/20` §2)»*, y lo que vigila es el **trinquete por vertical** de
la fuente `GRANT` —*«toma la fuente `GRANT` de esa vertical … y ninguna otra»*—, que se compara
*«al final»* dentro de la resolución. La fuente `GRANT` la enchufa **B9** de la otra épica, que en
`B/descomposicion.md` §3 está después de `B7 → B8`: naciendo en V3 el guard **ve llegar al grant**
en vez de heredarlo escrito.

**`G-R4` va con V4 porque V4 construye la primera de las ~~nueve~~ diez máquinas.** El guard vigila *«las
~~nueve~~ diez máquinas, en las dos épicas»* (la décima, el reembolso de `B/03` §6.1: owner 2026-09-25,
FASE 9 completa, 5a), y esta épica tiene tres: trial (`03` §2, **V4**), publicación
(`03` §9, V6) y postulación de Partner (`03` §11, V7). La más temprana del §3 es la de V4, y las
~~**seis de billing**~~ **siete de billing** no compiten por ser primeras: `DEC-ARCH-005` parte el programa en dos épicas
donde verticales *«arranca»* y billing *«espera»*, ~~y `B/descomposicion.md` §2.3 mide que hoy «lo
único que arranca es B2 y la interfaz de B1»~~ **y en `B/descomposicion.md` §3 las primeras
unidades de billing son B1 y B2** (esa medición del §2.3 quedó tachada el 2026-09-25: la pasarela
está decidida y nada espera ya), ninguna de las dos con tabla de transiciones. Y el
par que el guard cuenta nace ahí mismo: de los **cuatro** pares con dos destinos que el diseño
declara hoy, `T1`/`T6` es de esta máquina y los otros tres —`S5`/`S19`, `S7`/`S19`, `S10`/`S25`—
son de la tabla de suscripción, que construyen B7 y B8 (`B/20` §2). Naciendo en V4 el guard ve
llegar ~~**ocho tablas una por una**~~ **las otras nueve máquinas una por una** —en siete tablas más, porque
billing declara sus siete máquinas en cinco tablas (`B/20` §2); el «ocho» contaba máquinas y no
tablas, salida 3 de la FASE 9 completa—; naciendo en cualquier otro lado nace contra tablas ya escritas.

**`G-R4-B` va con V4 porque el defecto que lo motivó es de la propia máquina de V4.** El guard
falla si una máquina **de esta épica** nombra un estado de la suscripción, y sale del §4 del
contrato — que **lo trae V4** (su fila del §2 lo lista entre sus capítulos). El caso es `T6`:
estaba escrita sobre *«una suscripción viva»*, *«un predicado que el §4 del contrato le prohíbe
evaluar al lado que tiene que evaluarlo»* (`V/20` §2). Las otras dos máquinas de la épica son de V6
y V7, las dos posteriores a V4 en el §3.

**`G-R6` va con V4 por el mismo orden, y hay una razón propia por la que ahí es seguro.** Su
dominio es el mismo de `G-R4` —*«las ~~nueve~~ diez máquinas, en las dos épicas»*— así que la primera tabla
del programa es el lugar que la regla 1 pide. Lo propio es esto: su predicado es **global**
(*«exige que al menos una transición **del corpus** las escriba»*), y un predicado global evaluado
sobre un corpus a medio construir puede dar **rojos falsos**. Con las máquinas de esta épica no
puede: el §4 del contrato le prohíbe a una máquina de verticales leer del otro lado —que es
justamente lo que `G-R4-B` hace cumplir—, así que **ninguna condición de V4, V6 o V7 lee una
columna que sólo escriba billing**. Eso vuelve a la primera tabla un lugar seguro para nacer, y no
sólo el más temprano. Lo que el predicado global abría del lado de billing está en el §2.8, y
**quedó cerrado**: el corpus que el guard recorre son las tablas declaradas, no las construidas
(`B/20` §2).

**`G-R3-B` va con V5 porque antes de V5 no hay nada que leer.** La **clase** que vigila —*«las
transiciones disparadas por el reloj»*, y que *«nunca otorga»*— la declara `17` §3.4, y `17 entero`
es de V5. El capítulo además insiste en que *«la clase se declara transición por transición, nunca
se infiere»*: **la declaración es el mecanismo, y el mecanismo lo construye V5**. El caso que el
capítulo usa, `T3`, es de la máquina de V4 y ya existe cuando V5 llega — y **no es una excepción
heredada**, porque lo que V5 construye es el acto de clasificar, y `T3` se clasifica al
construirlo. Los relojes que vienen después —`PB4` y `PB5` de V6, el de retención de V9, y los de
billing— llegan uno por uno.

**`G-R3-C` va con V5 porque el capítulo de V5 lo pide con todas las letras.** `17` §3.5 lo enumera
como su tercera parte —*«Un guard que lo hace cumplir: toda operación de dominio **declara** si
pasa por el paso 5, y el build falla si alguna no lo declara»*— y explica por qué no puede llegar
después: *«sin él, alguien agrega una operación dentro de ocho meses, no se pregunta nada, y nadie
se entera — la fábrica de exenciones por ruta»*. El paso 5 y los otros ~~ocho~~ seis son de V5, y la
enumeración que el guard vuelve completa *«se arma sola a medida que se construyen las
superficies»*, que son V8 y B13: las dos posteriores.

### 2.7 `G-R5` se va a `B8`, porque la celda de `V9` estaba en la épica equivocada

`F-8eC2-004` lo reportó y **se confirma recorriendo los dos grafos del §3**. La celda de `V9` decía
*«el de `D16`»* —o sea `G-R5`, nombrado por su invariante y no por su id— y el guard compara **dos
cifras de configuración**: el **tope de una pausa**, que declara `B/03` §5 (*«**4 pausas-mes** por
pausa»*), y el **día del hard delete**, que declara `V/02` §4.1. De las dos, la que `V9` construye
es la segunda: sus capítulos son `02` §4, `22` §3 y `01` §1.2 (núcleo), y **`B/03` §5 no está entre
ellos**. El catálogo de billing ya lo había advertido por escrito, doce líneas antes de que la
celda se escribiera: *«Figura acá porque **el número que puede romperlo es de esta épica**: si
alguien sube el tope de pausa y el guard sólo vive en el catálogo de la otra, el cambio se hace sin
verlo»* (`B/20` §2).

**Y el orden no lo deja mal ubicado: lo deja inejecutable.** `V9` corre *«una vez que estén V4 y
V6»* (§3), temprano y sin esperar a billing; el tope lo construye **B8**, que en
`B/descomposicion.md` §3 está después de la bisagra —`B1 → B3 → B5 → B7 → B8`— y después de todo
lo que espera a la pasarela. El guard se construiría **antes que el número que compara**, y ahí no
llega tarde: llega tan temprano que **no tiene contra qué fallar**, que es *«un comentario con exit
code 0»* — la regla 1 de esta descomposición leída al revés.

**Va a `B8`, que es la unidad que construye el tope**, y la razón entera, del lado que lo
construye, está en `B/descomposicion.md` §2.8. Es la misma forma ~~de `G13` (§2.3) y~~ de `G-R6-B`
(§2.5) con el eje cambiado (`G13` dejó de serlo: nace en `V4`, owner 2026-09-26, `G5-5`): **dónde se construye un guard y qué documento declara sus números son
dos preguntas distintas.** `V9` conserva lo suyo — el día 180 es de su capítulo y el guard lo cita;
si alguien mueve ese número, **el cambio es de `V9` y el rojo lo da el guard de `B8`**.

### 2.8 El predicado global de `G-R6`, y por qué el reparto no lo tocaba

**`G-R6` tiene un predicado global y el corpus se construye por partes.** El guard exige que *«al
menos una transición **del corpus** escriba»* cada columna que una condición lee, y el corpus son
~~nueve~~ diez máquinas repartidas en dos épicas que se construyen a lo largo de todo el programa. Del lado
de verticales eso es inofensivo (§2.6), pero del lado de billing **una condición puede leer una
columna cuyo escritor llega en una unidad posterior** — el caso medido está en el propio catálogo:
la fecha del próximo cobro tiene **tres** escrituras (`B/03` §7.2) y una de ellas es `S10`, que es
de B8, mientras la condición que la lee es de B5. Entre B5 y B8 el guard daría **rojo sobre el
camino normal**, que es lo que la fila de `G-R1-A` describe como *«un guard que alguien va a
relajar»*.

**Esto quedó escrito como pregunta para el owner y no lo era: era un defecto del ENUNCIADO**, y la
diferencia importa porque una pregunta espera y un enunciado ambiguo se resuelve solo, en el peor
sentido — el primero que se choque con ese rojo lo relaja, y lo que se pierde es la vigilancia de la
clase que costó `F-8eB1-002`, **un crítico de dinero**. **Resuelto en `B/20` §2, donde el guard se
define**: *«el corpus»* son **las tablas que los capítulos declaran**, no el subconjunto ya
construido. `S10` tiene fila en `B/03` §7.2 desde antes de que nadie escriba una línea de `B8`, así
que entre `B5` y `B8` el guard está **verde**, y el defecto que lo motivó —una columna que **ningún
lugar del diseño** escribe— lo sigue atrapando entero. Lo que a cambio **no** verifica, y está dicho
allá, es que el escritor declarado esté implementado — **que desde `DEC-TEST-002` lo exige el
criterio de terminación de su unidad y no un guard** (§4, y el desarrollo en `B/descomposicion` §4).

**Y ninguna de las dos salidas que este § proponía se toma.** *«Que el guard evalúe sobre las
máquinas existentes en cada momento»* es exactamente la lectura que produce el rojo, y *«que su rojo
sea informativo hasta que las nueve estén»* compra meses en los que nadie lo mira. **La asignación a
V4 no se mueve**: era independiente de la salida elegida, y lo sigue siendo.

### 2.9 La dirección inversa del contrato la construye V2, y hasta esta pasada no la construía nadie

**El contrato tiene dos direcciones y sólo una tenía constructor.** Lo que billing **empuja** a
verticales lo construye `B4` del otro lado y lo recibe `V4`; lo que billing **LEE** de verticales
—las tres consultas del [contrato](../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§4.1— **no figuraba en la columna de capítulos de ninguna de las 22 unidades del programa**, medido
con `rg -c "direcciónDeCambio|situaciónDeVertical|políticaDePlan"` sobre el corpus: **cero en los
dos `spec.md`, cero en las dos `descomposicion.md`, cero en los 24 capítulos y cero en el núcleo**.
Y la pieza sin constructor no era una menor: el propio contrato la llama *«la única regla que decide
**qué se le cobra a alguien y qué día**»*.

**Va con V2 porque las tres consultas leen las tablas que V2 construye, y ninguna otra.** Recorrido
campo por campo:

| consulta | qué lee | de qué unidad es esa tabla |
|---|---|---|
| `políticaDePlan` → `díasDeGrace`, ~~`díasDeTrial`,~~ `permitePausa`, `vigente`, `vendible` | columnas de `plan_version` | `02` §2.1 — **V2** |
| `situaciónDeVertical` → `admiteAltas`, `finDeServicio` | las **dos columnas de `vertical`** que el contrato obligó a crear | `02` §2.1 — **V2** |
| `direcciónDeCambio(origen, destino)` → `SUBE \| BAJA` | `plan_version_entitlement` y `plan_version_limit` de **las dos** versiones | `02` §2.1 — **V2** |
| ✚ `políticaDeAddon(versiónDeAddon)` → `addon`, `vigencia`, `díasDeVigencia`, `tipoDeScope` | columnas de `addon_version` | `02` §2.1 — **V2** (owner 2026-09-26, `G4-2`) |

*(`díasDeTrial` salió de la firma el 2026-09-26: ningún capítulo de billing lo leía, y la máquina
de trial lo lee de su propia tabla —FASE 9 vuelta 1, `F-8V1C1-015`—. Las otras entradas del
contrato §4.1 no son de V2: `fichaPurgada` y `ficha` las construye V6, porque leen la ficha, y
`extenderTrial` V4, dueña de la máquina de trial —`G2-1`, `G4-2`—.)*

~~**Los siete campos son de `02` §2.1, que es capítulo de V2**~~ **Los campos de estas cuatro
consultas son de `02` §2.1, que es capítulo de V2** (FASE 9 vuelta 1: sin cifra, como la regla
del contrato §4.2), así que ésta es la unidad más
temprana en la que ~~las tres consultas~~ **las cuatro** se pueden escribir — y la regla 1 del §1.1, leída sobre una
pieza en vez de sobre un guard, pide exactamente eso: **nace con su sujeto y no contra él**.

**Y la tercera no es una excepción aunque su REGLA esté escrita del otro lado.** ~~*«La dirección se
deriva del delta entre las dos versiones, no del `rank` … cualquier baja manda»* vive hoy en
`B/10` §3.5,~~ **El criterio vive hoy en `B/10` §3.5 —*«Verticales lo computa por el delta entre las
dos versiones —no por el `rank`—»* y *«Cualquier baja manda»*—**, que desde la FASE 8 completa
abre diciendo que **la dirección no la deriva billing: la decide el veredicto de verticales**
(`F-8CD1-003`, `F-8CC1-013`). *(Esta cita reproducía como vigente la frase que `B/10` §3.5 ya
tachaba, «La dirección se deriva del delta…»; la corrige la salida 3 de la FASE 9 completa, `C10`
del informe `01`. El criterio y la conclusión no cambian.)* Ese §, que es capítulo de **B12, la última unidad del camino crítico de billing**, mientras
**su consumidor es `B8`, cinco unidades antes**. Eso no la vuelve de B12: el contrato ya decidió de
quién es el acto —*«La comparación la hace verticales, que es dueño de las tablas, y billing recibe
un **VEREDICTO**»*—, y **quién ejecuta una comparación y dónde está escrito su criterio son dos
preguntas distintas**, que es la misma forma que el §2.5 usa para `G-R6-B` y el §2.7 para `G-R5`.
Lo que V2 construye es **la consulta y su respuesta**; `B/10` §3.5 queda como el § que declara el
criterio y `B12` como su lector tardío.

**Lo que esto evita, y está escrito en el propio contrato:** sin la consulta, lo único que `B8`
tiene a mano al cambiar de plan es el `rank`, y el diseño ya midió el desenlace de derivar la
dirección de ahí — *«un plan más caro puede bajar un límite al rediseñarse, y entonces al cliente
**se le recorta algo en silencio mientras se le cobra como mejora**»*. Con el camino de upgrade
tomado por error, además, **el excedente cae sin el aviso previo** que el de downgrade obliga.

**Y no mueve ninguna asignación de guard.** Ninguno de los 29 *(hoy ~~30, con `G-R5-B`; FASE 8 completa~~ 31: `G-R5-B`, FASE 8 completa, y `G-R2-C`, FASE 9 completa)* tiene por sujeto el contrato de
frontera (§4.2 del contrato, dicho allá), así que esta fila agrega **capítulos a una unidad**, no un
dueño de guard. Es un reparto de trabajo, que es lo que este documento hace.

### 2.10 Lo que la FASE 9 completa agregó al diseño, y qué unidad lo construye

Salida 3 de `DEC-METH-004` (2026-09-25). Las decisiones del owner del día
(`HOS-1352/docs/26-fase-9-completa/10`) y las reglas del 25/09 que resolvió el consolidado de la
FASE 8 completa (`25-fase-8-completa/00` §5) se recorrieron contra la tabla del §2, **una por una**,
preguntando *«¿qué unidad la construye?»*. Todas las de esta épica tienen unidad, y la tabla del §2
las nombra en su fila; lo que sigue es el censo, para que la próxima pasada lo pueda recontar sin
releer las filas.

| regla nueva | de dónde | unidad | por qué ahí |
|---|---|---|---|
| `T6` exige un título que convierte; `T8` consume la fila al primer pago | 6c | **V4** | es la tabla del `03` §2 |
| el botón de suscribirse manda a publicar a quien no publicó **—con `cubierto` falso, si la vertical admite altas y si publicar le arrancaría el trial; si no, al checkout o al aviso de que no admite altas (la regla única de `19` §4 fila 23; el último espejo sin la condición, FASE 9 vuelta 1, §4 punto 1 de `24-verificado-G4`)—** | 6c | **V8** | fila 23 del `19` §4; su espejo es `B13` |
| la invalidación del caché es por `user` | 8a | **V3** | `02` §3.2, regla 3 |
| el fin de servicio invalida la vertical entera | 6b | **V3** *(la invalidación)* · `B12` *(el barrido que la invoca)* | la fila es de `02` §3.2; el barrido del día es `B/10` §4.3 |
| la firma gana `piso` y el trinquete del grant lo lee de ahí | 9h | **V4** *(la firma)* · **V3** *(el trinquete)* | contrato §2; `15` §2.5 |
| la vertical se lee del recurso y es inmutable; la mitad *(c)* de `G2` | 7a | **V5** *(el paso y el guard)* · **V6** *(la columna, `02` §2.5)* | `17` §1.2 precisión 6 |
| el paso 2 sin «inhabilitado por abuso» | 8b | **V5** | `17` §1.1 |
| lo ajeno existe sólo en estado público | 8c | **V5** | `17` §1.2 precisión 7 |
| las lecturas de lo propio no consultan el paso 6 | 8d | **V5** | `17` §3.5 |
| `MODERATED` y el borrado del dueño: `PB10`, `PB11`, `PB12` | `F-8CA2-004` | **V6** | `03` §9; `PB9` sigue en **V9** |
| el empuje *«la ficha llegó a `PURGED`»* y la consulta `fichaPurgada` | `G2-1` (owner 2026-09-26) | **V6** *(la consulta, y el empuje de `PB12`)* · **V9** *(el empuje de `PB9`)* | `12-contrato…` §3.1 y §4.1; `03` §9 |
| en `PURGED` el calendario se desconecta: su token se revoca en el proveedor y se borra | `G1-5` (owner 2026-09-26; la unidad, OK del owner, J) | **V9** *(en `PB9`)* · **V6** *(en `PB12`)* | cada una es dueña de su transición (`03` §9) |
| la acción administrativa 15, *«editar el contenido de una ficha ajena»* | `G5-2`, `DEC-AUTH-003` (owner 2026-09-26; la unidad, OK del owner, L) | **V8** | `NUCLEO/08` §3; su aviso es la fila 1 del `19`, y V8 corre después de V6, dueña de la ficha |
| levantar la moderación reinicia el reloj: el sexto hecho | 5b | **V6** *(ejecuta `PB11`)* · **V9** *(la lista del `01` §1.2)* | la forma del quinto (§2.5) |
| el lock por `user + vertical` en toda transición que ocupa cupo | `R14` | **V6** | `03` §9 |
| el reconciliador diario de cobertura, con la población de Partner | `DEC-ARCH-009`, `R13`, 7b | **V6** | `03` §9; comparar claves no necesita a V7 |
| la clave *«presencia en el carrusel»* | 7b | **V7** *(la lectura)* · V1 *(la clave, que es catálogo)* | `18` §1.6 |
| el bit de moderación de la presencia | 7c | **V7** | `18` §1.6; la acción que lo escribe, abajo |
| el registro de los actos del dueño sin el texto de los campos de contenido | 8e | **V9** | es la defensa del día 180 |
| la escritura `C` del corte | `F-8CA3-002` | **V6** | abajo |
| el partner sin presencia responde 404, no 410 | `F-8CA1-014` | **V7** | `21` §4 |
| el corte no siembra trials consumidos | 2g | **ninguna** | no hay nada que construir: es una escritura que dejó de existir (`21` §2.4) |
| `G-R2-C` | 4e | **ninguna de esta épica: `B10`** | abajo |

**Lo que no está en la tabla, porque no es de esta épica**: `S32`–`S35`, `RF1`–`RF5` y la acción
administrativa 14 (5a), la sucesora en grace (3c), los addons que siguen a su título (4a, 4c, 4d),
el canje bajo el piso (4b) y la rama del barrido de 9a. Ninguna pregunta qué puede hacer una
cuenta; todas mueven o miran plata, y su unidad la pone `B/descomposicion.md`. **Y 6a —`S1`
leyendo `admiteAltas`— no agrega nada acá**: la columna y la consulta ya las construye V2.

**La escritura `C` va con V6, y hasta esta pasada no tenía unidad.** `V/21` no figuraba en la
columna de capítulos de ninguna fila. La escritura pone `listing.inactiva_desde` en el instante del
corte a toda ficha que existe ese día, **en la migración estructural del corte y en ningún otro
lugar** (`21` §2.4, `NUCLEO/01` §1.2), y esa migración es la que crea la columna, que **es de V6**
(`02` §2.5). En otra unidad, la columna nacería no anulable sin el único valor que la regla le
permite a una ficha preexistente. Y `G-R6-B`, también de V6, ya la nombra en su mitad *(a)*: nace
con su sujeto.

**La acción de moderar tiene dos sujetos y no agrega una arista al §3.** `PB10`/`PB11` (la ficha,
**V6**) y el bit de la presencia (**V7**) los escribe **la misma** acción administrativa del
`NUCLEO/08` §3, y V6 y V7 corren en paralelo después de V5. **La construye la primera de las dos
que llegue, con su sujeto; la segunda le agrega el suyo.** Hacer esperar a V7 por V6 compraría una
dependencia por una fila de catálogo, y el orden del §3 sale de preguntas que se contestan, no de
quién escribe primero una acción. *(Reparto de esta pasada; se señala al orquestador.)*

**`G-R2-C` no va a V3 aunque su gemelo esté ahí, y la razón es la regla 2 del §1.1.** `B/20` §6 y
los registros de aplicación de la FASE 9 completa lo sugerían para V3 *«por capítulo, con
`G-R2-B`»*. Medido contra lo que cada uno necesita leer, **no son gemelos en eso**: `G-R2-B` compara
datos que **viajan en la fuente** —el plan de su `referencia` y su `piso`—, y por eso se evalúa
dentro de la resolución de V3 sin preguntar nada del otro lado. **`G-R2-C` compara la vertical de
la respuesta contra las verticales compatibles del producto, y ésas viven en `addon_product`**
(`B/02` §2.4), **una tabla de billing que ninguna fuente transporta**: en V3 el guard tendría que
leer billing —la filtración que la regla 2 manda mirar— o no tendría contra qué fallar, porque la
implementación de arranque no emite addons (contrato §5.1). Es el caso del §2.7 con otro guard:
**nacería antes que el dato que compara**. **Va a `B10`**, que construye `addon_product` y la
fuente `ADDON` (`B/descomposicion.md` §2, fila `B10`: `16` entero y `02` §2.4). `V/20` §2 conserva
la fila, igual que conserva la de `G-R5`. ~~**La asignación la escribe `B/descomposicion.md`, fuera
de este documento; hasta entonces `G-R2-C` sigue sin unidad** y `B/20` §6 sigue diciendo 1.
*(Propuesta de esta pasada, contra la sugerencia de los registros `15` y `17`; se señala al
orquestador.)*~~ **El owner decidió `B10` y no `V3`** (2026-09-25, FASE 9 completa, decisión 10c,
contra la sugerencia de los registros `15` y `17`): `B/descomposicion.md` §2, fila `B10`, ya
escribe la asignación, y `B/20` §6 pasa de decir 1 a decir 0.

---

## 3. El orden, y qué se puede hacer en paralelo

```text
V1 ──► V2 ──► V3 ──► V4 ──► V5 ──► V6 ──► V8
                                └──► V7 ──┘
                      └──────────────► V9
```

| | |
|---|---|
| **camino crítico** | `V1 → V2 → V3 → V4 → V5 → V6 → V8` |
| **en paralelo** | **V7** una vez que esté V5 · **V9** una vez que estén V4 y V6 |
| **nada arranca antes que V1** | y V1 no depende de nada |

**V5 es la bisagra**: hasta ahí se construyen capacidades, y de ahí en adelante se consumen. Es
también el punto donde el contrato deja de ser una definición y pasa a tener un consumidor real —
el paso 5.

---

## 4. Lo que cada unidad tiene que dejar demostrado

No es una lista de tests: es **qué pregunta tiene que poder contestar alguien de afuera** cuando
la unidad se declara terminada.

> **Y hay una condición que vale para las nueve y no está en la tabla, porque no depende de qué
> construye cada una**: **una unidad no está terminada mientras algún guard de su columna `guards`
> del §2 no esté escrito y no tenga su caso que lo hace fallar a propósito.** La regla 1 del §1.1
> dice **cuándo** va cada guard —*«con la pieza que protege, nunca al final»*— y hasta esta pasada
> **no había ningún lugar donde se comprobara que había ido**: la asignación vivía sólo en una
> columna que nadie consulta al declarar una unidad lista, así que las nueve se podían declarar
> terminadas, una por una, con **cero** guards escritos, y el tablero del §5 las marcaba verdes.
> **Los ~~29~~ ~~30~~ 31 guards del programa están repartidos entre las 22 unidades —~~16~~ ~~17~~ **18** en esta épica y ~~13~~ ~~**14**~~ **13** en la
> otra, contados sobre las dos columnas; `G13` pasó de `B4` a `V4`, owner 2026-09-26, `G5-5`— y ninguno aparecía en ninguno de los 22 criterios.** *(El
> trigésimo es `G-R5-B`, de V6: FASE 8 completa, `F-8CA2-014`, owner 2026-09-25. **El trigésimo
> primero, `G-R2-C`** —owner 2026-09-25, FASE 9 completa, 4e—, ~~todavía no está en ninguna de las
> dos columnas: esta pasada lo propone para `B10` (§2.10), y el 17 + 13 pasa a 17 + 14 cuando
> `B/descomposicion.md` lo escriba~~ **ya está en la columna de `B10`**, owner 2026-09-25,
> decisión 10c (`B/descomposicion.md` §2, fila `B10`).)*
>
> **No se enumeran acá uno por uno a propósito**: duplicar la columna sería un segundo censo del
> mismo conjunto, que es la clase de defecto que el contrato §2.1 acaba de cerrar. **La columna es
> la lista; esto es lo que la vuelve una condición.**
>
> **Lo que esta condición NO exige, dicho para no afirmar de más**: que el guard esté
> *implementado* del lado del código que todavía no existe. Un guard cuyo caso de rojo se ejerce
> sobre **texto declarado** —`G-R4`, `G-R6` y `G-R6-B` recorren tablas de transiciones y listas
> cerradas de los capítulos, no el subconjunto ya construido (`B/20` §2)— se puede romper a
> propósito el día que nace, incluso cuando la fila que se le saca es de una unidad de la otra
> épica. Eso es lo que vuelve exigible esta condición en `V4`, que lleva tres guards cuyo dominio
> son **las ~~nueve~~ diez** máquinas (la décima, el reembolso: FASE 9 completa, 5a). **Y `G13`**, el
> cuarto de `V4` (owner 2026-09-26, `G5-5`), se rompe a propósito igual el día que nace: su caso de
> rojo es un build destinado a producción que enlaza la implementación de arranque.
>
> **Y hay una segunda condición de la misma forma, sobre los ESCRITORES** (`DEC-TEST-002`):
> **una unidad no está terminada mientras alguna escritura que sus capítulos le declaran a una de
> sus transiciones no esté implementada.** Vale para las nueve, es independiente de qué construye
> cada una, y sale de la columna de **capítulos** del §2 igual que ésta sale de la de `guards`. Es
> la contrapartida exacta de lo que el §2.8 acaba de resolver: `G-R6` lee *«el corpus»* como **las
> tablas que los capítulos declaran** —sin eso nace en rojo sobre el camino normal—, y el precio
> es que **un escritor declarado que nadie implementa pasa en verde**. **El desarrollo, con por qué
> es un criterio y no un guard, está en**
> [`B/descomposicion.md`](../HOS-1354-billing-cobro-y-proveedor/descomposicion.md) §4, que es donde
> vive el caso medido: la fecha del próximo cobro y `MP5`.

| # | la unidad está lista cuando… |
|---|---|
| **V1** | agregar una clave al código sin agregarla a la base **falla**, y al revés también; y nombrar una vertical sin implementar su ítem del Eje 2 **falla** |
| **V2** | dos versiones vendibles y vigentes con el mismo `rank` en la misma vertical **son imposibles**, no un empate a desempatar; y **`direcciónDeCambio` contesta `BAJA` sobre un par de versiones donde el destino tiene `rank` MAYOR y un solo limit menor** **de estrategia `SUMA` o `MÁXIMO` —más es mejor— (con una clave `MÍNIMO`, menor es mejor y el caso es el de abajo: `SUBE`; FASE 9 vuelta 1, §4 punto 3 de `24-verificado-G4`)** —si contesta `SUBE`, está leyendo el `rank` y no el delta (§2.9)—, con `políticaDePlan` y `situaciónDeVertical` contestando ~~los otros cinco campos~~ **sus campos —cuatro de `políticaDePlan`, sin `díasDeTrial` (FASE 9 vuelta 1, `F-8V1C1-015`), y dos de `situaciónDeVertical`—, y `políticaDeAddon` los suyos (`G4-2`),** sin que ninguna devuelva un entitlement ni un limit; **y contesta `SUBE` sobre un par donde lo único que cambia es una clave `MÍNIMO` que pasa de 24 a 4** —*bajar* es empeorar según la estrategia de la clave (`15` §2.2, `B/10` §3.5; FASE 9 vuelta 1, `F-8V1C1-002`)— |
| **V3** | una clave que suma y una que no acumulan **distinto**, y la que no acumula **favorece al cliente**; y revocar una fuente invalida el caché de ~~ese `user + vertical`~~ **ese `user` en todas sus verticales** —un suspendido pierde la herencia de Turista VIP y las claves globales del plan que ya no paga en la próxima lectura (owner 2026-09-25; FASE 9 completa, 8a)—, **e invalidar una vertical entera borra las entradas de todos los users en ella** (6b); y **un grant nunca otorga menos que su `piso`**, leído de la fuente (9h) |
| **V4** | un trial vence de verdad, `cobertura()` pasa de sí a no por sí sola, y un segundo trial para el mismo `user + vertical` **es imposible**; y, sobre la tabla del `03` §2, **publicar con una `SUSCRIPCIÓN` presente y `cobrada: no` ~~arranca el trial (`T1`) y no lo consume (`T6` no dispara)~~ no arranca el trial ni lo consume** —ni `T1` ni `T6` disparan, la persona sigue en `PRE_TRIAL` y la ficha se publica porque está cubierta (`03` §2, fila de `cobrada: no`; FASE 9 vuelta 1, contradicción (d))—**, y el primer pago de quien ya ejerció el evento lo consume (`T8`)** — con billing todavía ausente se ejerce contra la respuesta del contrato que recibe la máquina, no contra la implementación de arranque, que no emite suscripciones (spec §4.2; owner 2026-09-25, FASE 9 completa, 6c); **y `extenderTrial` contesta `RECHAZADA` con el techo lleno y no mueve la fecha de fin, y el reintento con la misma `claveDeCanje` después de un `ACEPTADA` contesta lo mismo sin extender dos veces** (contrato §4.1, `11` §3; FASE 9 vuelta 1, `N-G4V-08`: la única escritura de billing en verticales estaba en *qué deja funcionando* y ningún criterio la probaba; la mitad del canje es de `B9`); **y la de arranque no puede llegar a producción (`G13`)** —falla sobre un build destinado a producción, no sobre la rama (contrato §6.3; owner 2026-09-26, `G5-5`; FASE 9 vuelta 1, `F-8V1C1-011`)— |
| **V5** | un recurso ajeno, uno archivado y uno inexistente **contestan lo mismo al que no es su dueño** —y una ficha `ARCHIVED` le acepta a **su** dueño verla, exportarla y reactivarla **aunque no tenga ninguna fuente de clase `TÍTULO`**, porque la versión de piso lo otorga (`02` §2.1)—; y una cuenta ~~inhabilitada~~ **con el correo sin verificar** no puede averiguar qué permisos tiene probando operaciones (8b); **una operación que declara otra vertical que la del recurso contesta *«no existe»*, y una que escribe la vertical de una ficha existente no pasa el build** (la mitad *(c)* de `G2`; 7a); **una ficha ajena en `DRAFT`, `ARCHIVED` o `MODERATED` contesta lo mismo que una inexistente** (precisión 7; 8c); **y un `SUSPENDED` lee su Mi Cuenta, su billing y sus fichas** (8d) — owner 2026-09-25, FASE 9 completa; **y una acción administrativa con `actor = sujeto` contesta *«sin permiso»* en el paso 3** —un `ADMIN` que es además Partner con pago manual no puede registrarse su propia cuota— (`17` §3.2 regla 5; owner 2026-09-26, `G5-1`) |
| **V6** | un trial que vence baja la ficha a `UNPUBLISHED_BY_BILLING` y no a `DRAFT`, y al recuperar cobertura vuelve **sólo** la que bajó el sistema; **dos `PB1` simultáneos del mismo dueño con un solo lugar de cupo dejan una sola ficha publicada** (el lock; `R14`); **un aviso de cobertura perdido lo corrige la corrida siguiente del reconciliador diario**, sin que nadie publique a mano (`DEC-ARCH-009`); y **una ficha `MODERATED` no la saca ninguna transición del sistema, y levantar la moderación la deja en `DRAFT` con el reloj reiniciado** (`PB11`, hecho 6; 5b) — *(criterios agregados en la salida 3 de la FASE 9 completa)*; **una ficha del corte en `UNPUBLISHED_BY_BILLING` de un dueño en `PRE_TRIAL` se publica y arranca el trial; la de un dueño cubierto no se publica a mano y vuelve por `PB3`; una ficha `INACTIVE` sin `billing_unpublished_at` nace `DRAFT` y ningún cambio de cobertura la publica** (FASE 9 vuelta 1, R1); **después de `PB12` la ficha no conserva conexión de calendario: el token quedó revocado en el proveedor y no existe en la base** (`G1-5`; FASE 9 vuelta 1, J); **el empuje de `PB12` sale después del commit: el consumidor que lo recibe y relee `fichaPurgada` lee `sí`** (contrato §3.1; FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`); **y tres fichas del corte de un mismo dueño, sin evento de publicación, suben por `PB3` con cupo 1 siempre en el mismo orden —la de `created_at` más viejo—, y una publicada después del corte queda detrás de las tres** (`03` §9, *«cuáles vuelven»*; FASE 9 vuelta 1, `N-G1-01`); **y la migración del corte deja una `L1` en `PURGED` con su contenido y sus fotos en el almacenamiento externo, y la herramienta del paso 5b la deja sin contenido, sin fotos y sin token de calendario; correrla otra vez no llama al almacenamiento ni al proveedor** (FASE 9 vuelta 2, `F-8V2A3-002`) |
| **V7** | aprobar una postulación con el correo de un tercero **no vincula nada** hasta que alguien con acceso a esa casilla lo reclame; y **un Silver que deja de pagar sale del carrusel, y una presencia moderada responde 404 con el cobro intacto** (owner 2026-09-25; FASE 9 completa, 7b y 7c) |
| **V8** | ninguna superficie decide por sí misma: lo que se oculta ya está rechazado por V5; y **el botón de suscribirse de quien todavía no publicó en esa vertical lo manda a publicar, no al checkout** (owner 2026-09-25; FASE 9 completa, 6c) **si publicar le arrancaría el trial; en una vertical con los días de trial en cero, sin evento declarado o con el hash con fila lo manda al checkout, y en una vertical sin altas no ofrece nada** (la regla de `19` §4 fila 23; FASE 9 vuelta 1, `F-8V1D1-004`, `F-8V1A1-008`); **la acción 15 edita el contenido de una ficha ajena y no la publica, no la destaca ni la borra —un acto ajeno no dispara `T1`—; un admin sin su permiso no la ejecuta, aunque tenga otros, y cada ejecución deja su registro de auditoría con actor distinto del sujeto y el aviso al dueño** (`DEC-AUTH-002`, `DEC-AUTH-003`; `G5-2`; FASE 9 vuelta 1, L) |
| **V9** | la fila de `trial` sobrevive al borrado de la cuenta, y su ~~hash~~ **seudónimo** **no** se anonimiza (`C-1`); **el día 180 (`PB9`) borra el contenido de la ficha y nada de la persona** (`DEC-DATA-005`), **y después del borrado ningún evento de dominio conserva el texto borrado** (8e); **y después de `PB9` la ficha no conserva conexión de calendario: el token quedó revocado en el proveedor y no existe en la base** (`G1-5`; FASE 9 vuelta 1, J) |

---

## 5. Dónde vive cada unidad

Las nueve están en Linear como sub-issues de `HOS-1353`, y cada una tiene su ficha publicada.
El estado en vivo —qué está bloqueado, qué se puede empezar, qué está en curso— se lleva en el
**[tablero](https://claude.ai/artifact/VvQ3hGSGZC5nr4ZHc5VqPB)**, que calcula solo cuáles están listas: una unidad lo está
cuando todas sus dependencias están hechas.

| unidad | issue | ficha |
|---|---|---|
| **V1** | [HOS-1355](https://linear.app/hospeda-beta/issue/HOS-1355) | [ficha](https://claude.ai/artifact/Xy46L4orTxa3MwSaNGgK6o) |
| **V2** | [HOS-1356](https://linear.app/hospeda-beta/issue/HOS-1356) | [ficha](https://claude.ai/artifact/DhWZPJ72BxssRMYp2WTQ6R) |
| **V3** | [HOS-1357](https://linear.app/hospeda-beta/issue/HOS-1357) | [ficha](https://claude.ai/artifact/N4tGbpDdCGUZB6zJUSH3t6) |
| **V4** | [HOS-1358](https://linear.app/hospeda-beta/issue/HOS-1358) | [ficha](https://claude.ai/artifact/AfAufifn4m4qurfC4fKgYa) |
| **V5** | [HOS-1359](https://linear.app/hospeda-beta/issue/HOS-1359) | [ficha](https://claude.ai/artifact/KsjdENgkcaJaz49Qk9h1dX) |
| **V6** | [HOS-1360](https://linear.app/hospeda-beta/issue/HOS-1360) | [ficha](https://claude.ai/artifact/Lqmv2r3Vt53ugG2iBKnJEY) |
| **V7** | [HOS-1361](https://linear.app/hospeda-beta/issue/HOS-1361) | [ficha](https://claude.ai/artifact/G9qtHb2DN8upN9QzaE7ueb) |
| **V8** | [HOS-1362](https://linear.app/hospeda-beta/issue/HOS-1362) | [ficha](https://claude.ai/artifact/SqXumRq9YrBQpqiyoNTYGq) |
| **V9** | [HOS-1363](https://linear.app/hospeda-beta/issue/HOS-1363) | [ficha](https://claude.ai/artifact/5Nc7PT6fyh67GoL7Lfmwcd) |

**Las otras cuatro fichas del programa**: [el paraguas](https://claude.ai/artifact/WiHhGp54XspK1mwFpHWjRA) ·
[la épica de verticales](https://claude.ai/artifact/UZzqK6P7ZyfAFuWrw5n4BP) ·
[el contrato de cobertura](https://claude.ai/artifact/KgHuCs8uTVEtNeuYfuLLJQ) ·
[la épica de billing](https://claude.ai/artifact/Bp6dJstfwqoMzFTLP11BPZ).

---

## 6. Lo que esta descomposición NO decide

- **Las tareas atómicas de cada unidad.** Se atomiza cuando la unidad arranca, con el estado del
  código de ese momento a la vista.
- **Qué se reescribe y qué se reutiliza.** Es FASE 5 y tiene su gate propio (`DEC-METH-003`).
  Esta descomposición dice **qué hay que tener funcionando**, no de dónde sale.
- **Fechas y esfuerzo.** No hay estimaciones acá a propósito: salen del atomizado.
- **Si cada unidad es un issue de Linear.** Depende de si conviene verlas en el roadmap o
  alcanza con el tracking interno de la épica.
