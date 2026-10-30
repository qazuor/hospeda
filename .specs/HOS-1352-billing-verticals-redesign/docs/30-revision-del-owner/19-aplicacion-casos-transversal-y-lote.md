---
title: "Revisión del owner · casos vecinos 41 a 50 y lote F: lo transversal, y el lote del log y la matriz"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · casos vecinos 41 a 50 y lote F: lo transversal, y el lote del log y la matriz

El lote E (casos 41 a 50) y el lote F (casos A a D, nuevos de `17-`) de
[`16-casos-vecinos-decididos.md`](./16-casos-vecinos-decididos.md), con el detalle original de
[`14-aplicacion-transversal-y-lote.md`](./14-aplicacion-transversal-y-lote.md) §3 y de
[`17-aplicacion-casos-corte-y-verticales.md`](./17-aplicacion-casos-corte-y-verticales.md) §3.
Medido y editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD
`e1004e7922`, sin commits. Leídos antes, enteros, los registros de las dos tandas de casos
anteriores ([`17-`](./17-aplicacion-casos-corte-y-verticales.md) y
[`18-`](./18-aplicacion-casos-cobro.md)): no pisé nada suyo, y su § del log y la matriz está
consolidado en el §4 de éste. Abreviaturas: `B/` es `HOS-1354…/docs`, `V/` es `HOS-1353…/docs`,
`D/12` el contrato, `D/16` la FASE 7 del paraguas, `nucleo/` el núcleo, `$V/` y `$B/` la raíz de
cada sub-spec.

**Forma**: tachado y fechado `(revisión del owner, casos vecinos, 2026-09-29, caso N)`; los del
lote F, `caso F-A` a `caso F-D`. **Los números nuevos no reusan ninguno retirado**: las dos
acciones nuevas son la **vigesimotercera** y la **vigesimocuarta** (la última viva era la 22, y la
16 sigue retirada). En el texto nuevo no escribí la palabra: se dice *«el agrupamiento viejo de
Gastronomía y Experiencia»*, y las mediciones la buscaron con el patrón armado en partes.

## 1. Qué se aplicó

### Caso 41 · el corpus sale del repo al cerrar HOS-1352 (tarea del cierre, no ejecutada)

Escrito como tarea del cierre en la spec del paraguas, en un § propio; no ejecuté nada. El
`CLAUDE.md` raíz y los archivos de i18n entran en la limpieza de `V1`:

- `.specs/HOS-1352-billing-verticals-redesign/spec.md:177` «Es una tarea del cierre del programa, no de ahora»
- `.specs/HOS-1352-billing-verticals-redesign/spec.md:181` «Quedan en el historial de git, y lo que importe se resume en Linear»
- `.specs/HOS-1352-billing-verticals-redesign/spec.md:183` «El diseño vigente se reescribe una vez, sin tachados y sin el nombre del agrupamiento viejo»
- `.specs/HOS-1352-billing-verticals-redesign/spec.md:188` «no esperan al cierre»
- `V/21:535` «Y entran en esta limpieza el `CLAUDE.md` raíz y los archivos de i18n que lo nombran»
- La unidad: `$V/descomposicion.md:484` «y el `CLAUDE.md` raíz y los archivos de i18n que lo nombran»

**La cifra de i18n, remedida**: `14-` §3 decía 21 archivos. En el worktree, sobre `e1004e7922`,
`packages/i18n` la nombra en **30 archivos, 24 en `src/locales`** (8 por idioma), y el `CLAUDE.md`
raíz **23 veces**; el clone principal (`cd4e59164b`, del 2026-09-04) da 21 en `src/locales`, que
es de donde salía la cifra. Escribí las dos, con la fuente.

### Caso 42 · los datos de planes de desarrollo y de las pruebas, fuera del dual-write

El script y el `CLAUDE.md` no se tocan acá: el diseño dice cuándo y en qué cambio. Medido en el
worktree: `scripts/check-seed-dual-write.sh` guarda por nombre los archivos de
`packages/billing/src/config/` (`BILLING_CONFIG_FILES`, l. 271), y la regla del `CLAUDE.md` raíz
nombra *«a billing plan/limit/entitlement»* (l. 945).

- `nucleo/02:121` «Los datos de planes que usan desarrollo y las pruebas son datos de demostración, fuera del dual-write del seed»
- `nucleo/02:125` «en el mismo cambio que borra el archivo (`B/21` §4), que es cuando esa rama se queda sin sujeto»
- `B/21:450` «salen la rama que lo vigila en `scripts/check-seed-dual-write.sh`»
- `$B/descomposicion.md:637` «los datos de planes de desarrollo y de las pruebas son de demostración (caso 42)»

### Caso 43 · los cinco plazos sin valor, antes del ensayo; la migración falla si falta uno

Los cinco son los plazos 3, 4, 7, 8 y 9 de `nucleo/02` §1.5 (recontados sobre la tabla: los cinco
con *«sin valor escrito»*).

- `nucleo/02:162` «Los cinco sin valor escrito, el 3, el 4, el 7, el 8 y el 9, los fija el owner antes del ensayo del corte en `staging`»
- `nucleo/02:163` «la migración única del catálogo falla si alguno está vacío»
- El paso 3a: `D/16:138` «que falla si alguno de los cinco plazos sin valor escrito está vacío»
- El criterio de `V2`: `$V/descomposicion.md:486` «y con uno de los cinco plazos sin valor escrito vacío, falla»

### Caso 44 · el piso de 60 días se queda

- `nucleo/02:194` «queda en 60 días: se puede alargar, no acortar»

### Caso 45 · alargar tampoco alcanza a los relojes arrancados

El diseño ya lo decía (*«un cambio vale para los relojes que arrancan después»*); lo dejé explícito
para el caso de alargar:

- `nucleo/02:181` «Y alargar un plazo tampoco alcanza a los relojes ya arrancados»

### Caso 46 · el décimo apartamiento del PDR

El PDR no se edita. Los otros nueve viven en el decision log (cada uno en su decisión y en la fila
*«Apartamientos declarados del PDR»* del `## Resumen`), así que el décimo va a `DEC-DATA-008`,
propuesto en el §4; en el diseño quedó dicho donde viven los plazos:

- `nucleo/02:136` «Configurar el 90 y el 180 es un apartamiento declarado del PDR, el décimo»
- `nucleo/02:138` «el apartamiento se registra en el decision log, en `DEC-DATA-008`, donde viven los otros nueve»

### Caso 47 · una sola pantalla de plazos

- `nucleo/02:204` «una sola pantalla de plazos, compuesta en la app del panel»
- `V/19:88` «Los plazos de las dos mitades van en una sola pantalla, compuesta en la app del panel»
- `B/19:218` «Los plazos de las dos mitades van en una sola pantalla, compuesta en la app del panel»
- `$V/descomposicion.md:487` «su parte de la pantalla de plazos, que es una sola con la de billing»
- `$B/descomposicion.md:636` «su parte de la pantalla de plazos, que es una sola con la de verticales»

No escribí que la app del panel sea *«la raíz de composición que `G14` ya exceptúa»*, como decía
`14-` §3: `G14` exceptúa por nombre la raíz de composición de `apps/api`, no el panel (§3, punto
6).

### Caso 48 · `plazos_version` entra en la mitad *(a)* de `G-R6-B`

No cambian las mitades (tres) ni los predicados (cuatro): el *(a)* mira una columna más.

- `V/20:70` «o de `listing.plazos_version`»
- `B/20:63` «de la columna o de `listing.plazos_version` (caso 48)»
- `V/02:413` «lo vigila la mitad (a) de `G-R6-B`»

### Caso 49 · las claves en el código, los valores en la base

- `nucleo/02:99` «Las claves siguen en el código, las de los entitlements y las de los límites; los valores viven en la base»

### Caso 50 · la cota de `G-R5-B`, atada al plazo de borrado

Ya estaba aplicada por la tanda 4; lo marqué confirmado:

- `nucleo/02:189` «con la cota atada al plazo de borrado y no a 6 meses literales (confirmado»

### F-A · `retenciónDetenida` devuelve cuándo terminó la última pausa

**No es un motivo nuevo de marca**: la pausa vencida cuya reanudación no se aplicó ya la marca el
barrido diario, con la quinta comprobación de `B/09` §3 y el motivo 8, `REANUDACIÓN_NO_APLICADA`
(`B/02` §2.5). Los motivos siguen en **24**. Lo que faltaba era atarla al reloj de retención.

- La firma: `D/12:1073` «retenciónDetenida(user, vertical) → { detenida: sí | no, pausaTerminadaEn: instante | NINGUNO }»
- La regla: `D/12:1102` «Ese reinicio no se escribe»
- `D/12:1105` «y sus lectores cuentan desde el más tardío de dos instantes»
- `D/12:1111` «ya existía y no es un motivo nuevo»
- El rastro de la firma vieja: `D/12:1083` «Y `retenciónDetenida` ya no contesta un sí o no»
- Los campos: `D/12:1213` «trece campos en»
- La de arranque: `D/12:1335` «`detenida: no` y `pausaTerminadaEn: NINGUNO`»
- `nucleo/01:212` «La lista de hechos no cambia»
- `V/02:867` «sin escribir nada: `retenciónDetenida` devuelve también cuándo terminó la última pausa»
- `PB4`: `V/03:485` «o sobre el fin de la última pausa que devuelve `retenciónDetenida`, el más tardío»
- `V/03:1045` «del owner, casos vecinos, 2026-09-29, caso 12; `12-contrato…` §4.1), sin escribir nada»
- `B/03:819` «Y no queda detenido sin que nadie lo vea»
- `B/09:616` «la que impide que quede detenido sin fin sin que nadie lo vea»
- `$V/descomposicion.md:474` «la ficha no se archiva hasta que se cumple el plazo contado desde el fin de la pausa»

`PB5` y `PB9` llevan la misma frase que `PB4`, en su celda de evento.

### F-B · `G8` enciende la regla de la lista vacía con el commit del paso 6

- `V/20:56` «Esa regla la enciende el mismo commit del paso 6»
- `D/16:145` «y esa regla la enciende este mismo commit»
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:403` «regla que enciende el mismo commit del paso 6»
- `$V/descomposicion.md:560` «regla que enciende el commit del paso 6, así que el build del paso 3 con la lista llena pasa»
- `nucleo/04:78` «el paso 6 la vacía y en el mismo commit enciende la regla»

### F-C · soporte hace los tres pasos de la baja de cuenta manual (contra la recomendación)

La nota de `16-` vale: *«cancelar una suscripción»* ya existía, así que el paso 1 no suma fila.
Suman dos, **la vigesimotercera** (borrar una ficha ajena a pedido de su dueño, que corre `PB12`) y
**la vigesimocuarta** (borrar una cuenta a pedido de su dueño), cada una con permiso propio,
auditoría, motivo y confirmación por destructiva.

- El reparto de los tres pasos: `nucleo/08:110` «Los tres pasos los hace soporte, a pedido del dueño y con motivo»
- `nucleo/08:91` «soporte ~~a mano~~ desde el panel»
- La 23: `nucleo/08:202` «Es la vigesimotercera»
- La 24: `nucleo/08:203` «Es la vigesimocuarta»
- El precondicional de la 24: `nucleo/08:203` «Se rechaza mientras a la cuenta le cuelgue una suscripción viva»
- El conteo: `nucleo/08:207` «La tabla tiene VEINTITRÉS filas vivas»
- `nucleo/08:217` «dicen veintitrés desde los casos vecinos, caso F-C»
- La clase: `nucleo/08:220` «y la vigesimotercera, que se evalúan»
- Ningún borrado fuera de `PB9`/`PB12`: `nucleo/08:230` «La vigesimotercera no es la excepción: borra corriendo `PB12`»
- El sin borrar de `G5-2`: `nucleo/08:194` «vale para la edición de contenido: borrar la ficha a pedido de su dueño es otra fila»
- `$V/descomposicion.md:61` «vale para la edición de contenido: borrar a pedido del dueño son las acciones 23 y 24»
- Quién ejecuta `PB12`: `V/03:493` «o soporte a su pedido y con motivo»
- `V/03:493` «moderar no borra; soporte la borra sólo a pedido del dueño»
- `V/03:804` «así que ya no borra ninguna ficha sin `PB12`»
- Actor y sujeto: `V/17:384` «La vigesimotercera, borrar una ficha ajena a pedido de su dueño, tampoco está en la»
- `V/17:431` «En la vigesimotercera y la vigesimocuarta el sujeto es el dueño que pidió la baja»
- `V/17:371` «veintiuna acciones del capítulo 08 §3, las catorce primeras, de la decimoséptima a la vigesimosegunda y la vigesimocuarta»
- El actor de sistema: `V/17:471` «no tocan plata: borran»
- `V/19:44` «borrar una ficha suya por `PB12` o su cuenta»
- `.specs/HOS-1353-verticales-capacidades-y-autorizacion/spec.md:215` «y la vigesimotercera, borrar una ficha ajena a pedido de su dueño, también»
- La unidad: `$V/descomposicion.md:482` «los tres pasos de la baja de cuenta manual, desde el panel»
- `$V/descomposicion.md:61` «y las acciones administrativas 23 y 24»
- `B/19:206` «la vigesimotercera y la vigesimocuarta, borrar una ficha ajena y borrar una cuenta a pedido de su dueño»
- `B/03`, siete espejos; el de la tabla de lo que se toca: `B/03:2094` «y veintitrés con los casos vecinos, 2026-09-29, F-C»

**Las reglas de actor y sujeto de `V/17` §3.2 cuadran** sin regla nueva: la 1 (permiso propio de
cada una), la 2 (auditables con actor y sujeto), la 3 (la 23 sobre el sujeto por el criterio de la
15; la 24 sobre el actor), la 4 (no es impersonación: el registro dice soporte) y la 5 (actor igual
a sujeto la rechaza el paso 3). La clase de cada una la declaré por el criterio escrito de la 15, y
la unidad por analogía con la 15 (§3, punto 4).

### F-D · el script del corte arma el valor viejo sin escribir la palabra

- `D/16:306` «arma ese valor sin escribir la palabra de corrido, como el propio `G8`»
- `V/20:56` «y el script del corte arma igual el valor viejo que tenga que nombrar al leer la base vieja»

## 2. Conteos que cambiaron

| qué | antes | ahora | cómo se contó | espejos corregidos |
|---|---|---|---|---|
| acciones administrativas vivas | 21 (22 filas, la 16 tachada) | **23** (24 filas, la 16 tachada) | script sobre las filas de la tabla de `nucleo/08` §3 (filas que no empiezan tachadas) | `nucleo/08` (la cifra y *«dicen»*), `V/17` (reglas 1 dos veces, 5, §3.3, ⚠️ del §3.4, §3.5), `B/03` (siete), `B/19` §6 |
| acciones que son capacidad del actor | 20 | **21** (entra la 24) | leídas sobre la tabla | `nucleo/08`, `V/17` (regla 3, §3.4 dos veces), `$V/spec.md` §3.7 |
| acciones que se evalúan sobre el sujeto | 1 (la 15) | **2** (la 15 y la 23) | ídem | `nucleo/08`, `V/17` (regla 3, §3.4), `$V/spec.md` §3.7 |
| campos del contrato en consultas | 11 en 3 consultas | **13 en 4** (`retenciónDetenida` pasa de un sí o no a dos campos) | script sobre el bloque de firmas de `D/12` §4.1: `políticaDePlan` 4, `ficha` 3, `políticaDeAddon` 4, `retenciónDetenida` 2 | `D/12` §4.1 (sin otro espejo: las *«tres consultas»* de `$V/descomposicion.md` §2.9 y `D/12` §4.1 *«quién construye»* son las de la dirección inversa, que siguen siendo tres) |
| decisiones precisadas sin `SUPERSEDED`, si el owner aprueba el §4 entero | 58 | **66** | `contar-precisadas.py` sobre una copia del log con las dieciséis líneas de *Estado* simuladas | sólo el log |
| apartamientos declarados del PDR, si el owner aprueba el §4 | 9 | **10** (`DEC-DATA-008`, del §25) | leída la fila del `## Resumen` del log | sólo el log |
| filas de la matriz, si el owner aprueba el §4 | 111 = 55 · 17 · 23 · 16 | **112 = 55 · 17 · 23 · 17** | `contar-filas-de-la-matriz.py` sobre una copia con `EX-54` insertada | los que lista `18-` §4 punto 5 |

**Lo que no se movió**: los 33 guards (18 · 15; `G-R6-B` sigue con tres mitades y cuatro
predicados: la *(a)* mira una columna más); los **24 motivos** (F-A reusa el 8,
`REANUDACIÓN_NO_APLICADA`); las siete entradas del contrato; los cinco hechos del reloj (F-A no
escribe nada); los 15 plazos; las 34 transiciones vivas de la Suscripción (con `S38`, de `18-`); las
once dependencias entre épicas (las acciones 23 y 24 son de `V8`, sobre `PB12` de `V6`, las dos de
verticales); los 17 pasos del corte; la lista de pendientes de `G8`, en dos (F-D la mantiene así);
el catálogo de correos de `NUCLEO/07` §6 (la 23 manda el correo que `PB12` ya mandaba; la 24 no
tiene correo diseñado, §3); el total del log, 134 decisiones (ninguna nueva).

## 3. Casos vecinos (piden decisión, no los decidí)

1. **`G8` y el corpus del programa hasta el cierre de HOS-1352** (caso 41). `G8` lo construye `V1`,
   al principio, y falla en cualquier archivo versionado salvo el PDR y la lista de pendientes, que
   el caso 8 cerró en dos entradas. Pero el corpus del programa (los informes históricos, el log, la
   matriz y los tachados del propio diseño) nombra la palabra y, por el caso 41, se queda en el
   repositorio hasta el cierre, que llega después del corte. Entre `V1` y el cierre, `G8` nace rojo
   sobre `.specs/`. Tres formas: **(a)** una tercera entrada en la lista, las carpetas del programa,
   que el cierre vacía; **(b)** una exención por nombre de esas carpetas hasta el cierre; **(c)** que
   `G8` no mire `.specs/` hasta el cierre. Recomiendo **(a)**: es el mismo mecanismo, tiene fecha de
   fin y la regla de F-B se puede extender al commit del cierre; pero reabre el *«ninguna más»* del
   caso 8, así que es del owner.
2. **Si el log y la matriz son informes históricos o diseño vigente** (caso 41). Los dos nombran la
   palabra, y ninguno se edita sin el OK del owner. Si salen del repositorio con los informes, el
   programa pierde en el repo su registro de decisiones; si se quedan y se reescriben, se edita el
   log. Recomiendo que se queden y se reescriban una vez al cierre, con el OK del owner a esa
   reescritura, porque `spec.md` los manda leer segundo y séptimo.
3. **Qué escribe la acción 24, borrar una cuenta** (F-C). La tabla ahora la tiene, con permiso y
   confirmación, pero el ⚠️ de `nucleo/08` §1.3 sigue: qué se borra, qué se anonimiza y si alcanza
   al registro de auditoría no lo dice ningún capítulo, y `DEC-DATA-005` dice que los datos
   personales no se tocan. Antes de F-C era un paso a mano; ahora es una fila que `V8` tiene que
   construir. Recomiendo que borre la fila de usuario y sus sesiones, reemplace en los registros del
   usuario lo personal por un seudónimo y **no toque el registro de auditoría**, que conserva el
   actor y el sujeto por id; y que el caso completo siga siendo HOS-1393.
4. **La clase y la unidad de las acciones 23 y 24** (F-C). Las declaré por criterios escritos, no
   por decisión: la 23 sobre el sujeto por el criterio de la 15 (*«hacer por él lo que él mismo
   podría»*; y `PB12` está en el piso, así que el cupo nunca la rechaza), la 24 sobre el actor
   porque el dueño no puede borrar su cuenta en esta versión; y las dos en `V8`, como la 15.
   Recomiendo confirmarlas como están.
5. **Con qué versión de plazos cuenta un reloj después de una pausa** (F-A). El reinicio no se
   escribe, así que `plazos_version` sigue siendo la del último hecho, y `nucleo/02` §1.5 dice que
   un reloj que se reinicia guarda la versión vigente. Contado desde el fin de la pausa, el reloj
   usa la versión vieja. Recomiendo declararlo así (cuenta con la versión que guarda la ficha): no
   escribe nada, y un plazo que se acortó durante la pausa no le adelanta la fecha a nadie.
6. **La app del panel y `G14`** (caso 47). `14-` §3 decía que la app del panel es la raíz de
   composición que `G14` exceptúa; `G14` exceptúa sólo la de `apps/api` (`V/20` §2, `D/12` §7.1). Si
   la pantalla única importa código de las dos mitades, `G14` la marca. Recomiendo que la app del
   panel lea las dos mitades por la API y no importe ninguna, y dejarlo escrito en `V/19` §6.
7. **El correo de `PB12` cuando lo corre soporte** (F-C). El catálogo lo llama *«ficha borrada por
   su dueño»*; con la 23 la borra soporte a su pedido. Recomiendo el mismo correo, con una línea que
   diga que se borró a su pedido, sin fila nueva en el catálogo.

**Fuera de lo que este registro puede editar**: el caso 29 de `18-` (la presentación) sigue en el
paso 4 de `03-handoff.md`, como dejó dicho `18-`.

## 4. Para el log y la matriz (pide OK del owner)

Consolida, **sin duplicar**, `17-` §4 (nueve propuestas), `18-` §4 (seis) y las de este tramo.
Donde una decisión recibía propuestas de dos tandas, va un solo 📌 con el texto junto. **Cada ID
grepeado en `01-decision-log.md` y en la matriz el 2026-09-29**: existen todos los `DEC` de abajo y
`WH-6`; **`EX-54` no existe** (la última `EX` es `EX-53`); **ninguno tiene todavía un 📌 de los
casos vecinos** (`casos vecinos` no aparece en el log). Cada 📌 suma a su *Estado*: *«precisada el
2026-09-29, con OK del owner (revisión del owner, casos vecinos, <casos>; ver su 📌)»* donde hoy
dice `ACCEPTED` a secas, o *«y precisada…»* donde ya había precisiones.

**Hoy en `ACCEPTED` a secas, y por eso suman a la cifra**: `DEC-MIG-006`, `DEC-DATA-006`,
`DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013` (de `17-`), `DEC-SUB-023`, `DEC-TEST-003` (de `18-`)
y `DEC-DATA-008` (de éste). Las otras ocho ya están contadas.

### 4.1 Los 📌

1. **`DEC-MIG-006`** (casos 5 y 6; de `17-`): *«En el paso 0 se toman dos recuentos sobre la
   cartera vieja: si el sistema viejo servía alguna ficha que el corte hace nacer `PURGED` o en
   `DRAFT`, y si da cero el paso 4c se saltea; y cuántos dueños tienen más de una ficha a la vista
   en la misma vertical, que no es gate y vuelve al owner si da más de cero.»*
2. **`DEC-DATA-006`** (caso 12, de `17-`; y F-A, de éste): *«Todo fin de la pausa, por cualquier
   camino, reinicia el reloj, también una baja desde la pausa. Ese reinicio no se escribe:
   `retenciónDetenida` devuelve también cuándo terminó la última pausa por `CUSTOMER_REQUEST` de la
   persona en esa vertical, y sus lectores cuentan desde el más tardío de dos instantes,
   `listing.inactiva_desde` y ése. La lista de hechos del reloj y `G-R6-B` no cambian. Una pausa
   vencida cuya reanudación no se aplicó la pone delante de una persona el barrido diario, con el
   motivo `REANUDACIÓN_NO_APLICADA`, que ya existía.»* **Razón**: la decisión dice *«al volver»*, y
   la baja desde la pausa dejaba correr `PB4` y `PB9` al día siguiente; el texto de `17-` dejaba
   pendiente cómo se escribe, y F-A lo cerró. **Reemplaza** la propuesta 2 de `17-` §4.
3. **`DEC-DATA-007`** (casos 13, 14 y 15; de `17-`): *«Una ficha moderada desde `ARCHIVED` vuelve
   por el origen de su archivado. Los dos niveles valen sólo para fichas: la presencia de Partner
   conserva su bit sin niveles. Y el correo de confirmación del borrado sale en todo `PB12`, no sólo
   sobre una moderada.»*
4. **`DEC-ARCH-012`** (casos 8, 9 y 19, de `17-`; casos 41, F-B y F-D, de éste): *«El tipo de
   partner se renombra a `business`, con la etiqueta "Comercio" en español sin cambios, y la
   migración de datos de V1 reescribe los que tienen el valor viejo. Hasta el paso 6 del corte `G8`
   lleva una lista de pendientes cerrada, las dos historias; el paso 6 la vacía y en el mismo commit
   enciende la regla que hace fallar un build destinado a producción con la lista no vacía, así que
   el despliegue del paso 3 no falla por ella. Las 11 migraciones de datos del seed que importaban
   el archivo de configuración de planes se congelan con sus valores adentro hasta que el paso 6
   las saca. El script del corte arma el valor viejo sin escribir la palabra de corrido, como el
   propio `G8`, y no entra a la lista. El `CLAUDE.md` raíz y los archivos de i18n que la nombran
   entran en la limpieza de V1. Y al cerrar HOS-1352 los informes históricos del programa salen del
   repositorio (quedan en el historial de git; lo que importe se resume en Linear) y el diseño
   vigente se reescribe una vez, sin tachados ni la palabra.»* **Razón**: reemplaza *«con un nombre
   a definir con el owner»*, y la decisión decía que el corpus se reescribe o se borra sin decir
   cuándo. **Reemplaza** la propuesta 4 de `17-` §4.
5. **`DEC-ARCH-013`** (caso 9, de `17-`; casos 42, 43 y 49, de éste): *«Las 11 migraciones de
   datos del seed que importaban el archivo borrado se congelan con sus valores adentro, en el
   mismo cambio que lo borra, y salen en el paso 6 del corte. Los datos de planes que usan
   desarrollo y las pruebas son datos de demostración, fuera del dual-write: en el mismo cambio
   salen la rama del archivo en `scripts/check-seed-dual-write.sh` y la mención a los planes de
   billing en la regla del `CLAUDE.md` raíz. La migración única del catálogo falla si alguno de los
   cinco plazos sin valor escrito está vacío, y el owner los fija antes del ensayo del corte en
   staging. Y las claves, de los entitlements y de los límites, siguen en el código; los valores
   viven en la base.»* **Razón**: la decisión dice *«El catálogo de claves sigue en código»* y su
   *Origen* anota que el owner no lo decidió explícitamente; ahora lo decidió, con el agregado de
   los límites (caso 49). **Reemplaza** la propuesta 5 de `17-` §4.
6. **`DEC-DATA-005`** (caso 7, de `17-`; F-C, de éste; contra la recomendación): *«La lista de
   pasos de la baja de cuenta manual se escribe antes del corte, en este orden: la baja del cobro,
   `PB12` por cada ficha y la cuenta (`NUCLEO/08` §1.3). Los tres los hace soporte desde el panel, a
   pedido del dueño y con motivo: el primero con "cancelar una suscripción", que ya existía, el
   segundo con la acción 23, "borrar una ficha ajena a pedido de su dueño", que corre `PB12`, y el
   tercero con la 24, "borrar una cuenta a pedido de su dueño", que se rechaza mientras le cuelgue
   una suscripción viva o una ficha fuera de `PURGED`. La baja desde Mi Cuenta sigue fuera de la
   épica (HOS-1393).»* **Razón**: la decisión decía *«soporte a mano»*. **Reemplaza** la propuesta
   6 de `17-` §4.
7. **`DEC-ENT-002`** (casos 10 y 11; de `17-`): *«Con más de un título vivo ancla el que da la
   cuota; con dos, el que arrancó primero. El `BASE` ancla en el alta de la cuenta, y se confirma el
   día que la versión de piso otorgue un entitlement medido.»*
8. **`DEC-TEST-001`** (caso 16, de `17-`; caso 48, de éste): *«`G-R6-B` suma una tercera mitad: un
   lector de `listing.inactiva_desde` que decide archivar, borrar o avisar y no consulta
   `retenciónDetenida`. Y su mitad de escritores vigila también `listing.plazos_version`, que se
   escribe sólo junto con `inactiva_desde`. El catálogo sigue en 33 guards.»* **Reemplaza** la
   propuesta 8 de `17-` §4.
9. **`DEC-ARCH-007`** (casos 3 y 4; de `17-`): *«`rollout` queda cerrado: las ramas son el §4.4 de
   la FASE 7 del paraguas y el orden de despliegue el §4.2. El script del corte vive versionado en
   `scripts/cutover/` y se borra en un commit posterior al corte.»*
10. **`DEC-SUB-023`** (casos 20 a 27; de `18-`): el texto exacto de `18-` §4 punto 1, sin cambios.
11. **`DEC-SUB-008`** (caso 37; de `18-`): el texto exacto de `18-` §4 punto 2, con su razón.
12. **`DEC-ARCH-004`** (caso 30, contra la recomendación; de `18-`): el texto exacto de `18-` §4
    punto 3, con su razón.
13. **`DEC-TEST-003`** (casos 28, 31, 32, 33 y 35; de `18-`): el texto exacto de `18-` §4 punto 4,
    con su razón.
14. **`DEC-DATA-008`** (casos 43, 44, 45, 46, 47 y 50; de éste): *«Configurar el 90 y el 180, que
    el §25 del PDR fija, es un apartamiento declarado del PDR, el décimo; el PDR no se edita. Los
    cinco plazos sin valor escrito (el `N` de `PB5`, los avisos previos de retención, el techo de
    días de prueba, la postulación de Partner atrasada y la espera tras un rechazo) los fija el
    owner antes del ensayo del corte en staging, y la migración única del catálogo falla si alguno
    está vacío. El mínimo de `DEC-MP-002` queda en 60 días: se puede alargar, no acortar. Alargar
    un plazo tampoco alcanza a los relojes ya arrancados: cada uno cuenta con su versión. Los plazos
    de las dos mitades van en una sola pantalla, compuesta en la app del panel. Y la cota de
    `G-R5-B` queda atada al plazo de borrado, no a 6 meses literales.»* **Razón**: su campo *Sin
    decidir* dice que el apartamiento del §25 lo decide el owner y que *«hasta entonces no se suma
    al `## Resumen`»*: ya lo decidió (caso 46).
15. **`DEC-RF-008`** (F-C, de éste): *«Las acciones administrativas pasan de veintiuna a veintitrés
    vivas: entran la 23, borrar una ficha ajena a pedido de su dueño, que corre `PB12` y se evalúa
    sobre el sujeto como la 15, y la 24, borrar una cuenta a pedido de su dueño, que es capacidad
    del actor; las dos con permiso propio, auditoría, motivo y confirmación por destructivas.»*
    **Razón**: su último 📌 dice *«de dieciséis a veintiuna vivas»*.
16. **`DEC-AUTH-003`** (F-C, de éste): *«El "sin borrar" de la acción 15 vale para la edición de
    contenido: borrar una ficha ajena a pedido de su dueño es la acción 23, otra fila con su
    permiso.»* **Razón**: la decisión dice *«sin publicar, destacar ni borrar»*, y desde F-C soporte
    borra.

### 4.2 El `## Resumen` del log

17. **Fila *«Apartamientos declarados del PDR»***: de 9 a **10**, *«2026-09-29: suma
    `DEC-DATA-008`, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos
    vecinos, caso 46)»*; y sale el *«serían 10 si el owner declara…»*.
18. **Fila *«Precisadas sin `SUPERSEDED`»***: de 58 a **66**, sumando `DEC-MIG-006`,
    `DEC-DATA-006`, `DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y
    `DEC-DATA-008`, recontado con `contar-precisadas.py`.
19. **Una fila *«Casos vecinos de la revisión del owner»***: *«0 nuevas, 16 📌, 0 `SUPERSEDED`, del
    2026-09-29, sobre los 54 casos vecinos decididos (`30-revision-del-owner/16-`); registros
    `17-`, `18-` y `19-`.»*

### 4.3 La matriz

20. **Fila nueva `EX-54`** (`UNKNOWN`, caso 34; de `18-`): el texto exacto de `18-` §4 punto 5, con
    su razón y sus espejos.
21. **Un 📌 en `WH-6`** (caso 39; de `18-`): el texto exacto de `18-` §4 punto 6. No cambia su
    estado.

### 4.4 Las cifras que resultarían, contadas con script

Simulado sobre copias del log y de la matriz en el scratchpad de la sesión, con las dieciséis
líneas de *Estado* y `EX-54` insertadas:

| | hoy | con `17-` | con `17-` y `18-` | con las tres |
|---|---|---|---|---|
| decisiones | 134 | 134 | 134 | **134** (ninguna nueva) |
| precisadas sin `SUPERSEDED` | 58 | 63 | 65 | **66** |
| con `SUPERSEDED` en su *Estado* | 11 | 11 | 11 | **11** |
| apartamientos declarados del PDR | 9 | 9 | 9 | **10** |
| filas de la matriz | 111 | 111 | 112 | **112** |
| `VERIFIED` · `PARTIALLY_SUPPORTED` · `NOT_SUPPORTED` · `UNKNOWN` | 55 · 17 · 23 · 16 | igual | 55 · 17 · 23 · 17 | **55 · 17 · 23 · 17** |

Las `UNKNOWN` quedarían en `PA-6`, `GR-2`, `WH-6`, `RC-8`, `RF-3`, `EX-42` a `EX-50`, `EX-52`,
`EX-53` y `EX-54`.

**Sin propuesta**: el caso 1, 2 y 17 (de `17-`), los 29, 36, 38 y 40 (de `18-`); de este tramo, el
caso 44 y el 45 van dentro del 📌 de `DEC-DATA-008` y no tocan `DEC-MP-002`, cuyo 📌 del 2026-09-28
ya dice que el plazo se cambia sin bajar de ese mínimo.

## Key Learnings

1. Una elección de mecanismo que *«no escribe nada»* se paga en la forma de la respuesta: el sí o
   no del contrato pasó a dos campos, y eso mueve el recuento de campos aunque no mueva el de
   entradas.
2. Antes de sumar un motivo de marca, conviene leer qué comprobaciones ya tiene el barrido: la pausa
   vencida sin reanudar ya tenía motivo y comprobación, sólo faltaba atarla al reloj de retención.
3. Pasar un paso manual a una acción del panel hereda sus huecos: el ⚠️ de qué escribe borrar la
   cuenta era tolerable a mano y es un bloqueante para construir la fila.
4. Una regla que vale *«en todo el repositorio»* choca con todo lo que el programa decide dejar en
   el repositorio por un tiempo: el corpus hasta el cierre es la tercera cosa que `G8` no puede
   perdonar con dos entradas.
