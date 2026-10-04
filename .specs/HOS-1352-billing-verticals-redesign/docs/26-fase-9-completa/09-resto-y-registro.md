---
title: "FASE 9 completa · el resto — acceso fino, billing suelto y registro"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · el resto: acceso fino, billing suelto y registro

El consolidado de la FASE 8 completa deja afuera de los catorce racimos **35 hallazgos**
(`25-fase-8-completa/00-hallazgos.md:261-277`): 9 de acceso fino, 9 de billing suelto y 17 de
registro. Acá no hay dominio de racimo, porque no hay causa común: **por cada hallazgo**, el camino
reejecutado contra el texto de hoy, el veredicto y la clasificación del residuo (`DEC-METH-015`).
Para el registro, además, los conteos que declaran el handoff y el log, recontados con script, y
la búsqueda de IDs de decisión citados que no existan.

**Este documento no edita nada.** Las correcciones se proponen con su texto; las aplica el
orquestador.

Abreviaturas: `D` es `HOS-1352-billing-verticals-redesign/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, `V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`,
`N` es `D/nucleo/`. Toda cita se verificó contra el archivo el 2026-09-25 (HEAD `a3f27925ae`).

**El resultado en una línea**: de los 35, **9 dejan de llegar, 22 siguen llegando y 4 llegan a otra
cosa**. Los nueve que dejan de llegar son **exactamente** los ocho de `D1` que el 25/09 tocó con su
ID más `F-8CD1-015`, que se arregló sin nombrarlo. **Ninguno de los otros 26 fue tratado el
25/09**: su ID no aparece en ningún capítulo, y los cuatro que cambiaron lo hicieron de rebote, por
arreglos de otros racimos.

---

## 0. Veredictos

| hallazgo | grupo | ¿tratado el 25/09? | veredicto | residuo |
|---|---|---|---|---|
| `F-8CA1-002` | acceso fino | no | **SIGUE LLEGANDO** | AL OWNER `AO-1` |
| `F-8CA1-003` | acceso fino | no | **SIGUE LLEGANDO** | AL OWNER `AO-1` |
| `F-8CA1-010` | acceso fino | no | **SIGUE LLEGANDO** | AL OWNER `AO-2` |
| `F-8CA1-011` | acceso fino | no | **SIGUE LLEGANDO** | AL OWNER `AO-3` |
| `F-8CA1-013` | acceso fino | no | **SIGUE LLEGANDO** | AL OWNER `AO-4` |
| `F-8CA3-004` | acceso fino | no | **SIGUE LLEGANDO** | AL OWNER `AO-5` |
| `F-8CA3-005` | acceso fino | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-1` |
| `F-8CA3-010` | acceso fino | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-3` |
| `F-8CC1-003` | acceso fino | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-2` |
| `F-8CB2-005` | billing | no | **SIGUE LLEGANDO** | AL OWNER `AO-6` |
| `F-8CB2-010` | billing | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-4` |
| `F-8CB2-011` | billing | de rebote (`R5`) | **SIGUE LLEGANDO** (la mitad del envío) | DE BORDE `DB-1` |
| `F-8CB2-012` | billing | no | **SIGUE LLEGANDO** | DE BORDE `DB-2` |
| `F-8CB1-017` | billing | no | **LLEGA A OTRA COSA** | CONTRADICCIÓN `C-5` |
| `F-8CB3-015` | billing | no | **SIGUE LLEGANDO** | DE BORDE `DB-3` |
| `F-8CB3-016` | billing | de rebote (pendiente 6) | **LLEGA A OTRA COSA** | DE BORDE `DB-4` |
| `F-8CB3-019` | billing | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-6` |
| `F-8CD1-005` | billing | **sí** | **DEJA DE LLEGAR** | — |
| `F-8CD1-008` | registro | **sí** | **DEJA DE LLEGAR** | `C-13` (vecino) |
| `F-8CD1-010` | registro | **sí** | **DEJA DE LLEGAR** | — |
| `F-8CD1-011` | registro | **sí** | **DEJA DE LLEGAR** | — |
| `F-8CD1-012` | registro | **sí** | **DEJA DE LLEGAR** | — |
| `F-8CD1-013` | registro | **sí** | **DEJA DE LLEGAR** | — |
| `F-8CD1-014` | registro | **sí** | **DEJA DE LLEGAR** | `C-14` (vecino) |
| `F-8CD1-015` | registro | **sí**, sin nombrarlo | **DEJA DE LLEGAR** | — |
| `F-8CD1-016` | registro | **sí** | **DEJA DE LLEGAR** | — |
| `F-8CB3-013` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-9` |
| `F-8CB3-017` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-11` |
| `F-8CB3-018` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-10` |
| `F-8CA3-012` | registro | de rebote (`R12`) | **LLEGA A OTRA COSA** | DE BORDE `DB-5` |
| `F-8CA3-013` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-9` |
| `F-8CC2-006` | registro | de rebote (`DEC-ARCH-009`) | **LLEGA A OTRA COSA** | CONTRADICCIÓN `C-7` |
| `F-8CC2-009` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-9`, `C-10` |
| `F-8CC1-012` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-8` |
| `F-8CA2-017` | registro | no | **SIGUE LLEGANDO** | CONTRADICCIÓN `C-12` |

**Recuento** (contado sobre la tabla): **DEJA 9 · SIGUE 22 · OTRA 4 = 35.** Por grupo: acceso fino
0 / 9 / 0; billing 1 / 6 / 2; registro 8 / 7 / 2.

---

## 1. ¿Se trató el 25/09? Cómo se averiguó

Se buscó cada uno de los 35 IDs en todo `.specs/` (los 177 archivos de `HOS-1352`, `HOS-1353` y
`HOS-1354`) excluyendo sólo los informes de origen `25-fase-8-completa/`, con `rg -F` (el patrón
literal encuentra la cita con y sin backticks), y además la forma corta sin el prefijo `F-`
(`8CA1-002`) con `rg -o "(8C)?[ABCD][123]-0[0-9][0-9]"`. En `D/03-handoff.md` sólo aparece
`F-8CD1-008` (`:157`, tachado). **Aparecen en capítulos**:

| ID | dónde aparece hoy |
|---|---|
| `F-8CD1-005` | `N/03-maquinas-de-estado.md:64` |
| `F-8CD1-008` | `D/01-decision-log.md:4333`, `:4653`; `D/03-handoff.md:157` |
| `F-8CD1-010` | `N/01-glosario.md:478`, `:503` |
| `F-8CD1-011` | `B/03-maquinas-de-estado.md:1497`, `:1552` |
| `F-8CD1-012` | `D/06-mp-validation-matrix.md:17`, `:439`, `:482`, `:539` |
| `F-8CD1-013` | `N/04-invariantes.md:99`, `:123` |
| `F-8CD1-014` | `N/00-indice.md:66` |
| `F-8CD1-016` | `B/03-maquinas-de-estado.md:31`, `:151`; `B/20-testing.md:64` |

**Los otros 27 no aparecen en ningún archivo fuera de su informe.** `F-8CD1-015` es el único de
ellos que igual se arregló: la única huella es `D/01-decision-log.md:2458`, *«referencia corregida
el 2026-09-25: `V/02` no tiene §1.2»*, sin el ID. Y la forma corta no agrega nada: todas sus
coincidencias son de otros hallazgos (`B/12-suscripcion.md:47` en adelante).

Es coherente con el consolidado: su §5 (`00-hallazgos.md:351`) resuelve del registro **sólo** los
IDs duplicados, y ninguna fila de esa tabla nombra el acceso fino ni el billing suelto.

---

## 2. Acceso fino — los caminos reejecutados

### `F-8CA1-002` — la herencia de Turista VIP no invalida la entrada de Turista · **SIGUE LLEGANDO**

1. *Juan tiene Alojamiento Premium con `hereda Turista VIP`; usa VIP y la entrada `Juan + Turista`
   queda cacheada con la herencia.* Igual: `V/02-modelo-de-datos.md:458-459` sigue cacheando
   *«versión de plan, herencia de Turista VIP, addons, cortesía y grant»*.
2. *`S6` lo suspende e invalida `Juan + Alojamiento`.* Igual: `V/02:468`, *«Invalidan la entrada de
   un `user + vertical`:»*, y `:473`, *«toda transición de la máquina de suscripción»*.
3. *La entrada `Juan + Turista` no está en ninguna lista.* **No corta.** La lista (`V/02:470-482`)
   no tiene ninguna fila que invalide **otra** vertical del mismo `user`. La fila nueva del
   reconciliador diario (`V/02:482`) *«Invalida **sólo** cuando encuentra la diferencia»*, y la
   diferencia que busca es de fichas (`V/03-maquinas-de-estado.md:881`, *«todo `user + vertical`
   con al menos una ficha»*): Turista no publica fichas, así que Juan + Turista no está en su
   población. El ⚠️ punto 2 (`V/03:960`) lo dice de sí mismo: *«La fecha que vence sin transición se
   corrige sólo si produce una diferencia de fichas»*.
4. *Juan sigue con VIP y la compra se le rechaza con el dato viejo.* **Llega.** `V/15-entitlements-y-limits.md:447`
   sigue prometiendo *«El bloqueo de compra se levanta en el mismo instante de la suspensión»*.

Y el contrato sigue sin transporte propio: `D/12-contrato-de-cobertura.md:88`,
`tipo: TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | BASE | ADDON`. La herencia se puede resolver
leyendo `cobertura(Juan, ALOJAMIENTO)` desde Turista —la referencia de esa fuente es una versión
que declara `hereda`—, así que **el transporte existe de hecho; lo que falta es la invalidación
cruzada**. Residuo: `AO-1`.

### `F-8CA1-003` — una clave global cacheada por vertical sobrevive en las otras · **SIGUE LLEGANDO**

1. *Premium de Alojamiento otorga la insignia global; Juan también tiene Gastronomía.* Igual:
   `V/15:235`, `| **global** | por \`user\` |`.
2. *Juan opera en Gastronomía y la entrada `Juan + Gastronomía` queda con la insignia.* Igual: la
   única unidad de caché es el `user + vertical` (`V/02:457`).
3. *Alojamiento pasa a `SUSPENDED`; se invalida `Juan + Alojamiento`.* Igual (`V/02:473`).
4. *En Gastronomía la insignia sigue.* **Llega.** `rg -i global` sobre `V/02` sigue sin
   resultados, y la regla del propio capítulo lo pide: `V/02:491`, *«si una fuente puede cambiar
   **lo que otorga** sin que cambie **ninguna fila del `user + vertical`**, necesita su propia
   entrada»*. `V/15:245` sigue prometiendo que la insignia *«se va, **en todas las verticales**»*.

Mismo arreglo que el anterior. Residuo: `AO-1`.

### `F-8CA1-010` — el paso 2 no tiene dato, transición ni acción · **SIGUE LLEGANDO**

El hallazgo no tiene camino numerado; se reejecuta su argumento.

1. *El paso 2 rechaza a un «inhabilitado por abuso».* Igual: `V/17-autorizacion.md:65`,
   `| 2 | **estado de la persona** | ¿esta cuenta puede operar hoy? | inhabilitada, o correo sin verificar |`.
2. *No hay dato que lo diga.* **Llega.** `rg -i "inhabilit|estado de la persona|correo sin
   verificar"` sobre `N`, `B`, `V`, el contrato y el log devuelve sólo `V/17:48`, `:65` y `:103`.
3. *No hay acción que lo escriba.* **Llega.** El catálogo cerrado tiene **13** filas (`N/08-auditoria-y-observabilidad.md:156`,
   recontadas con script) y ninguna es inhabilitar.
4. *Lo publicado no baja.* **Cambió en parte, no por este hallazgo**: desde el 25/09 existe
   `MODERATED` (`V/03:447`, `PB10`), así que un admin **puede** bajar ficha por ficha. Pero nada
   ata el estado de la persona a eso. Residuo: `AO-2`.

### `F-8CA1-011` — la lectura pública de una ficha ajena no tiene respuesta · **SIGUE LLEGANDO**

1. *Una lectura pasa por ocho pasos, incluido el 4.* Igual: `V/17:356-357`, *«Una lectura que no
   muta nada **no pasa por el 5** — y **sí por los otros ocho**»*.
2. *El paso 4 pregunta si el recurso es del sujeto.* Igual: `V/17:67`, *«¿existe, está en un estado
   que acepta esto, y es del sujeto?»*; y `V/17:366-369` lo refuerza: *«El 4 pregunta **si el
   recurso es del sujeto**, que es exactamente lo que una lectura tiene que responder»*.
3. *Un turista que lee la ficha de María no es su dueño: «no existe».* **Llega.** No hay en ningún
   capítulo una lista de estados públicos. `rg -i "lectura pública|estado público"` sobre `V`, `N` y
   el contrato sólo encuentra la de Partner (`V/18-partner.md:112`, `V/19-superficies.md:84`) y la
   frase de `V/15:414-415`, *«De los booleanos recibe únicamente los de lectura pública»*, que no
   define qué es público. Residuo: `AO-3`.

### `F-8CA1-013` — el piso no tiene clave para leer «Mi Cuenta» ni el billing · **SIGUE LLEGANDO**

1. *Las lecturas pasan por el paso 6.* Igual (`V/17:356-357`, citado arriba).
2. *Un `SUSPENDED` resuelve contra la versión de piso.* Igual.
3. *La lista del piso es cerrada en tres y ninguna es «leer lo mío».* **Llega.** `V/02:210`, *«Son
   **tres** cosas y la lista es cerrada»*, y las tres (`V/02:214-216`) son *«ninguna capacidad
   comercial»*, *«contratar una suscripción»* y *«recuperar lo suyo: sobre una ficha **propia**…»*.
   La 3 se amplió el 25/09 (borrar, `PB12`), pero sigue siendo **sobre una ficha**.
4. *`V/17` §4 promete «Mi Cuenta read-only» y «billing accesible».* Igual: `V/17:393`. Y desde
   `DEC-SUB-021` el camino de salida del grace es **cambiar la tarjeta**, que es exactamente leer y
   escribir en el billing propio. Residuo: `AO-4`.

### `F-8CA3-004` — o el hecho 1 no tiene fuente, o el registro guarda el texto que el día 180 borra · **SIGUE LLEGANDO**

1. *Laura edita la descripción; el evento guarda el valor viejo y el nuevo.* Igual:
   `N/01-glosario.md:54` sigue leyendo el hecho 1 *«del registro append-only de eventos de dominio
   … que ya los guarda todos por el criterio 2 del §1.1»*, y el campo obligatorio sigue siendo
   `N/08:57`, *«los campos que cambiaron, con su valor anterior y el nuevo — **no una copia del
   contenido**»*. Para un campo de texto, las dos mitades de esa celda no se pueden cumplir juntas.
   Y el criterio 2 (`N/08:40-41`) sigue siendo *«cualquier transición de las máquinas del capítulo
   03»*: editar y exportar no son transiciones.
2. *Al día 180 el hard delete borra el contenido.* Igual: `V/02:541`, *«el contenido de ESA ficha
   —textos, fotos, FAQ, horarios— y sus borradores»* (`PB9`).
3. *El registro conserva las dos versiones del texto, para siempre.* **Llega, y peor que antes.**
   `DEC-DATA-005` sacó la única escritura que tocaba ese registro: `N/08:73`, *«**La retención no
   escribe en este registro**»*, y `V/02:543` conserva *«sus datos personales, **también dentro de
   eventos de dominio**»*. Nadie redacta el texto que el evento copió. Residuo: `AO-5`.

### `F-8CA3-005` — al abogado se le pregunta por un hash «irreversible» · **SIGUE LLEGANDO**

1. *El pliego describe el hash como algo que no se lee de vuelta.* Igual:
   `D/13-pliego-consulta-legal.md:135`, *«¿Podemos conservar un **hash irreversible** del correo…»*,
   y `:145`; `V/22-lo-legal.md:79`, *«Se guarda un hash irreversible del correo normalizado»*, y
   `:84`, *«no hay nada que anonimizar: no se puede leer de vuelta»*.
2. *Cualquiera con un correo candidato calcula el hash y confirma si esa persona tuvo trial.*
   **Llega**: es la función declarada del hash (`V/22:83`, *«comparar un candidato contra lo
   consumido»*), y su `UNIQUE` lo exige determinístico.
3. *La respuesta legal se da sobre la premisa 1 y se aplica sobre el hecho 2.* **Llega.** Y la rama
   del «no» sigue diciendo que no cuesta nada: `V/22:103-104`, *«no cambiaría ningún mecanismo»*, y
   el pliego `:155`, *«**Ningún mecanismo.**»*. Borrar el hash de una fila que `V/02:543` declara
   *«Se conserva íntegro, siempre»* es un escritor nuevo. Residuo: `C-1`.

### `F-8CA3-010` — el piso del trinquete no está atado al plan de su ancla · **SIGUE LLEGANDO**

1. *Se siembra un ancla de Alojamiento con piso = una versión de Gastronomía.* **No corta.** La
   columna de restricciones (`B/02-modelo-de-datos.md:493`) sigue diciendo sólo *«el plan **no es
   anulable** y **pertenece a esa vertical**; el piso tampoco es anulable»*. La prosa (`B/02:732`)
   sí dice *«la referencia a la versión de ESE plan»*, pero no está en la restricción.
2. *«Pertenece a esa vertical» sólo es expresable con una FK compuesta sobre `plan(id, vertical)`.*
   **Llega**: `V/02:47` sigue con `UNIQUE(vertical, slug)` como única restricción de `plan`.

Residuo: `C-3`.

### `F-8CC1-003` — el contrato no transporta el piso del trinquete · **SIGUE LLEGANDO**

1. *Juan recibe un Free Forever con piso v3.* Igual.
2. *Se publica v4 con menos fotos.* Igual.
3. *`cobertura()` devuelve `{tipo: GRANT, referencia: v4}` y no hay campo para v3.* **Llega.** La
   firma (`D/12:84-94`) tiene seis campos —`tipo`, `referencia`, `alcance`, `objetivo`, `hasta`,
   `cobrada`— y ninguno es el piso; `D/12:22` dice que la firma *«se enuncia acá y en ningún otro
   documento»*.
4. *O se pliega sólo v4, o verticales lee una tabla de billing.* **Llega**, y ahora con una
   contradicción escrita: `V/15:116-117` dice que la resolución *«toma **la fuente `GRANT` de esa
   vertical** —con el plan de esa vertical y el piso de esa vertical—»*, y la fuente no trae piso.
   Residuo: `C-2`.

---

## 3. Resto de billing — los caminos reejecutados

### `F-8CB2-005` — la cuota `AWAITING` queda huérfana · **SIGUE LLEGANDO**

1. *Juan, pagador manual, en `GRACE_PERIOD` con su cuota en `AWAITING`.* Igual (`MP5` cláusula
   *(a)*, `B/03-maquinas-de-estado.md:1712`).
2. *Pide la baja (`S24`), le cae un grant (`S13`), se discontinúa la vertical (`S26`) o se consuma
   su sucesión (`S17`).* Igual. `S24` sigue diciendo *«Apaga el reloj del §4»* (`B/03:151`).
3. *Ninguna cierra la cuota.* **Llega.** `MP3` (`B/03:1710`) sigue teniendo dos cláusulas: el grace
   que se agota y la **primera** cuota por `S3`. `rg AWAITING` sobre `B` y `N`: ningún cierre en
   `S13`, `S17`, `S20`, `S21`, `S24`, `S26` ni `S28`.
4. *El admin actúa sobre la cuota.* **Llega.** `MP2` (`B/03:1709`) sigue mandando *«la suscripción
   va a `SUSPENDED` por `S6`»*, que desde `CANCELLED` es una transición no declarada; `MP1`
   (`B/03:1708`) sigue *«avanza un ciclo la fecha del próximo cobro»* sobre la fila muerta, y de esa
   fecha cuelga *«renovación por venir»* (`N/07-outbox-y-notificaciones.md:218`).
5. *La primera cuota bajo `S13`.* **Llega**, y el dominio creció: la primera cuota tampoco la
   cierran `S20`, `S21` ni `S28` (discontinuación sobre `PENDING_AUTHORIZATION`).

Residuo: `AO-6`.

### `F-8CB2-010` — la tabla del espejo convierte en divergencia los pares que coinciden · **SIGUE LLEGANDO**

**El camino.** Juan pide la baja pausado (`S22` → `CANCELLED`); llega el `subscription.updated` y
se relee `cancelled`. **Llega.** La regla sigue en `B/03:2581-2582`, *«Lo que **no** figura acá es
divergencia real, y ahí la marca es la respuesta correcta»*, y la tabla (`B/03:2566-2578`) sigue sin
el par `cancelled` × terminal.

**Recorrido del dominio**: 4 estados del proveedor × 9 nuestros (`N/01:410`) = **36 pares**.

| proveedor | cubiertos por una fila | **sin fila, y coinciden** (la regla los marca) |
|---|---|---|
| `pending` | los 9 (una fila de coincidencia y una de «cualquier otro» con salvedades) | — |
| `authorized` | `PENDING_AUTHORIZATION`, `PAUSED`, `GRACE_PERIOD`, `SUSPENDED`, `CANCEL_SCHEDULED` (✚), terminales (reintento) | **`ACTIVE`** — cada renovación normal |
| `paused` | `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED` (✚), terminales (reintento) | **`PAUSED`** — la prosa de `B/03:2571` lo admite (*«ahí los dos lados coinciden, esta tabla no ve nada»*), sin fila |
| `cancelled` | `CANCEL_SCHEDULED`, `SUSPENDED`, los vivos restantes (`S12`/espejo) | **`CANCELLED`, `ABANDONED`, `CHARGE_DECLINED`** — toda cancelación nuestra confirmada |

**Cinco pares que coinciden y la regla escrita marca.** `paused` × `PENDING_AUTHORIZATION` y
`paused` × `SUSPENDED` también faltan, pero ésos **sí** son divergencia (el proveedor no pausa un
pendiente; `S6` sólo llega a `SUSPENDED` con la cancelación confirmada, `B/03:133`). Residuo: `C-4`.

### `F-8CB2-011` — el outbox promete «una sola vez» y sólo deduplica el encolado · **SIGUE LLEGANDO** (la mitad del envío)

1. *La unicidad está en el encolado.* Igual: `N/07:56`, *«## 2. Que se mande una sola vez»*, con la
   clave `(destinatario, plantilla, ocurrencia)` calculada *«antes de encolar, no antes de
   enviar»*.
2. *Un worker manda, muere antes de marcar `sent`, el `processing` vence y la fila vuelve a
   `pending`.* **Llega**: `N/07:44-46` sigue igual y no hay clave de idempotencia hacia el proveedor
   de correo.
3. *Qué estado cuenta como «el correo salió» para cancelar.* **Corta**, de rebote por `R5`:
   `B/03:297-298`, *«Si está `sent`, la llamada sale sin otro correo; si todavía no salió, es la rama
   transitoria de arriba»*.

El daño que queda es un correo duplicado (incluido el *«antes de cancelar»*), no plata. Residuo:
`DB-1`.

### `F-8CB2-012` — «el último aplicado» no dice de qué · **SIGUE LLEGANDO**

**El camino.** El cobro de noviembre llega a los 14 días (`WH-2`); en el medio se aplicó un
reembolso de octubre con fecha de hecho posterior. **Llega**: `B/03:2613`, *«**un hecho más viejo que
el último aplicado se registra y no se aplica.**»*, sin alcance. El renglón anterior (`B/03:2608-2612`)
habla del **mismo id**, lo que sugiere que el alcance es el recurso, pero no lo dice.

**Hay red**: el cobro quedaría `PENDING` con `payment.status = approved` en el proveedor, que es
exactamente lo que abre el motivo 19, `COBRO_SIN_REGISTRAR` (`B/02:920`). Residuo:
`DB-2`.

### `F-8CB1-017` — el desempate del pago tardío no nombra `S21`, `S25` ni `S27` · **LLEGA A OTRA COSA**

**El camino.** Un cobro en vuelo entra sobre una fila que canceló `S25`. Hoy **sí cae en una
fila**, y ya caía cuando se escribió el hallazgo (el comodín entró el 23/09, commit `4f20c02ca8`):
`B/05-idempotencia-y-concurrencia.md:298`, *«**cualquier otra forma de fallar**»* →
`PAGO_TARDÍO_RECHAZADO`.

**Pero el motivo es el que el propio criterio descarta.** `B/05:296` dice que la primera fila es
*«la cancelamos nosotros o la pidió el cliente»* y enumera `S11`/`S12`, `S17`, `S22`, `S23`, `S24` o
el espejo; `B/05:301-303` explica por qué gana: *«le dicen **qué acto nuestro dejó cobrando un
preapproval que debería estar cancelado**»*.

**Dominio**: las transiciones que llevan a `CANCELLED` son **once** (`S12`, `S13`, `S17`, `S20`,
`S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31`, contadas con script sobre `B/03:128-158`) más el
espejo. La fila 1 nombra seis y el espejo; la 2, `S13` y `S20`. **Quedan cuatro actos nuestros en el
comodín: `S21`, `S25`, `S27` y `S31`** (ésta, desde `ACTIVE`). Los tres motivos devuelven plata
(`B/02` §2.5), así que no hay plata en juego. Residuo: `C-5`.

### `F-8CB3-015` — el stub no puede reproducir las mentiras de la conciliación · **SIGUE LLEGANDO**

Recontado con `rg -c -F` sobre `B/20-testing.md`: `RC-5` 0, `RC-6` 0, `RC-7` 0, `GR-3` 0, `WH-1` 0,
`WH-2` 0, `WH-5` 0, `PS-2` 0, `PS-6` 0, `charged_quantity` 0, `last_charged` 0. **Los once, cero,
igual que en el hallazgo.** La tabla de mentiras (`B/20:438-454`) tiene quince filas y ninguna es de
conciliación. La lista E2E sigue saltando del 6 al 8 (`B/20:514-515`) y no tiene webhook perdido,
huérfana ni barrido. Residuo: `DB-3`.

### `F-8CB3-016` — la excepción del correo inmediato nombra casos que ningún motivo produce · **LLEGA A OTRA COSA**

**El camino.** El implementador busca qué motivo es *«un doble cobro real detectado»*. Hoy
**existe un candidato**: el motivo 20, `COBRO_DUPLICADO` (`B/02` §2.5, pendiente 6). Pero
`N/08:273` y `:286` siguen diciendo *«un doble cobro real detectado, y un reembolso que falló sobre
una revocación»* sin nombrar motivo, y **el segundo sigue sin productor**: `rg -i "reembolso.{0,30}fall"`
sobre `B` y `N` no devuelve ningún detector ni motivo. Residuo: `DB-4`.

### `F-8CB3-019` — la lápida «sin nadie que verifique» contra el gate de relectura · **SIGUE LLEGANDO**

`B/09-conciliacion.md:147` sigue: *«**una persona a mano** contra la API del proveedor, *«sin
idempotencia, sin registro y sin nadie que verifique»*»*, atribuido a `16-fase-7-del-paraguas.md`
§4.2. **Esa cita está sacada de contexto**: en `D/16:130-132` describe la alternativa descartada
(*«Por qué no cancelar después de desplegar … sin nadie que verifique — y es el caso que este §
existe para evitar»*). El paso real está en `D/16:115`, *«**verificar releyendo cada uno por su id**»*,
y `D/16:119` lo hace gate. Residuo: `C-6`.

### `F-8CD1-005` — la regla 5 del núcleo contra `D17` · **DEJA DE LLEGAR**

**El camino.** Webhook perdido, vence el grace de Juan que sí pagó. **Corta**: `N/03-maquinas-de-estado.md:60-64`,
*«**Salvo un job que actúa por nuestro reloj** sobre algo que depende del estado del proveedor: ése
**le pregunta antes de actuar**, releyendo por id, y esa relectura es parte de la condición de
`S3` y `S6`»*.

**Recorrido de la excepción** (script sobre las cuatro tablas de `B/03`, transiciones cuyo evento
es un reloj): `S3`, `S6`, `S12` y `P2` releen; `MP3` y `MP5` no dependen del proveedor (pago
manual). **La excepción está escrita como regla y no como lista**, así que alcanza también a `S12`
y `P2` aunque nombre sólo dos. El único caso que no pude cerrar es `A3` (`B/03:2366`, *«la misma
ventana que `S3`»*): no dice si hereda la relectura; va en §8.

---

## 4. Registro — los caminos reejecutados

### `F-8CD1-008` — IDs duplicados · **DEJA DE LLEGAR**

**El camino.** Un implementador busca `DEC-ENT-002`: hoy `rg "^### DEC-ENT-002"` devuelve **uno**
(`D/01:577`, cuotas mensuales); la clase de una clave es `DEC-ENT-005` (`:4331`), y los
inventarios `DEC-ARCH-010` (`:4651`). **Contado con script**: 117 decisiones, 117 IDs únicos, cero
duplicados.

**Las referencias, por contexto** (fuera de informes históricos, worklog y handoff): las 6 de
`DEC-ENT-002` hablan de cuotas y las 4 de `DEC-ARCH-008` de la dirección de un cambio de plan; las
de `DEC-ENT-005` y `DEC-ARCH-010` viven sólo en el log. Ninguna quedó apuntando a la otra.

Vecino que no es de este hallazgo pero cae en su dominio (el conteo del log): `C-13`.

### `F-8CD1-010` — «fila viva» a medio propagar · **DEJA DE LLEGAR**

1. *El implementador del candado lee «para qué existe».* **Corta**: la columna (`N/01:478`) dice
   ahora *«impedir un segundo `INSERT` … **mientras una fila ocupa el lugar del usuario en esa
   vertical** —la que sigue pudiendo cobrar, o la suspendida a la que tiene que apuntar la
   vuelta—»*.
2. *El párrafo de exclusión.* **Corta**: `N/01:497-503`, *«No poder cobrar ya no alcanza para quedar
   afuera»*.
3. *`G-R1-E` no ve el consumidor de `S6`.* **Corta**: el inventario B tiene la fila `22 ✚`, *«la
   **guarda de sucesión de `S6`**»* (`N/01:557`).

### `F-8CD1-011` — las enumeraciones de salida del grace y de la pausa · **DEJA DE LLEGAR**

**Recorrido contra la tabla** (script sobre `B/03:128-158`): del grace salen `S5`, `S6`, `S13`,
`S17`, `S20`, `S21`, `S24` y `S26`; `B/03:1494-1497` nombra **las ocho**. De la pausa salen `S6`
(cortesía, tercer evento), `S10`, `S13`, `S17`, `S20`, `S21`, `S22` y `S25`; `B/03:1549-1556`
nombra **las ocho**. `S14`, `S15` y `S19` no son salidas (*«el mismo estado»*).

### `F-8CD1-012` — la matriz se contradice en cabecera y cierre · **DEJA DE LLEGAR**

Las cuatro partes, cortadas: la cabecera tacha la cifra vieja y da *«55 filas `VERIFIED`, 14
`PARTIALLY_SUPPORTED`, 23 `NOT_SUPPORTED`, 6 `UNKNOWN`, sobre 98»* (`D/06-mp-validation-matrix.md:14-16`),
igual que el script (§5); *«nunca estuvo mal»* quedó acotado en `D/06:436-439`; `BD-MP-01` y
`BD-MP-02` figuran cerradas en `D/06:537-539`; la nota de los 10 días está tachada (`D/06:479`) y
refutada en `D/06:482`.

### `F-8CD1-013` — conteos congelados en `N/04` · **DEJA DE LLEGAR**

*«Siete de las 37»* (`N/04-invariantes.md:97`), el encabezado §2.5 que dice *«Los cinco de
subdominio: los tres de Free Forever (27, 28, 29) y los dos restantes (25, 31)»* (`N/04:101`), las
*«117 decisiones»* (`N/04:123`) y `updated: 2026-09-25` (`N/04:6`). **Recontado con script**: §2.1
6, §2.2 14, §2.3 5, §2.4 7, §2.5 5, §3 17; total 54, que es lo que dice `N/00:93`.

### `F-8CD1-014` — `N/00` afirma dos cosas que el corpus desmiente · **DEJA DE LLEGAR**

Las dos cortadas: `N/00-indice.md:63-66` tacha *«no se referencian entre sí»* y da *«**74** líneas …
y **63**»*; la fila del glosario (`N/00:99`) dice *«los cuatro conjuntos que nombra «vivo»»*.
**Recontado hoy**: 76 líneas de `B` citan a verticales y 63 de `V` citan a billing. La afirmación
sigue siendo verdadera; la cifra, fechada, ya se movió dos líneas. Y la frase vieja sobrevive en
otro lugar: `C-14`.

### `F-8CD1-015` — seis referencias a un § inexistente · **DEJA DE LLEGAR**

Las seis, cortadas: `rg` de `` `V/02` §1.2 ``, *«capítulo 18 §5»*, *«cap. 10 §2»* en `B/19`, *«cap.
02 §3.2»* en `B/16` y *«cap. 03 §1.2»* en `B/02`/`V/02` ya no encuentra ninguna viva (la del log está
tachada, `D/01:2457`).

**Recorrido del dominio con script** (resolvedor de `` `B/NN` §x ``, `` `V/NN` §x `` y
`` `NUCLEO/NN` §x `` contra los encabezados reales, tachados excluidos, sobre los capítulos, el
contrato, `D/16`, el log y la matriz): **1624 referencias, 0 rotas.** El resolvedor no mira la
forma *«cap. NN §x»* sin épica, que es ambigua por construcción; ésa no se recorrió.

### `F-8CD1-016` — conteos que el texto afirma sobre sí mismo · **DEJA DE LLEGAR**

Las seis, cortadas: *«seis»* conjuntos con `S21` (`B/03:29-31`); *«Las cuatro precisiones»*
(`B/03:1422`); *«Las seis reglas duras»* con §4.1-§4.6 (`B/06-proveedor.md:136-196`); `S24` *«la única
… que corta servicio de verdad **siempre**»* con la salvedad de `S22` (`B/03:151`); `G-R4` *«cubre
las **cuatro** tablas»* (`B/20:64`), y el script cuenta 31 `S`, 7 `P`, 5 `MP` y 6 `A`; y el log
dice *«Apartamientos declarados del PDR | **8**»*, que son los ocho que enumera.

### `F-8CB3-013` y `F-8CA3-013` — `DEC-MIG-002` sigue transcribiendo · **SIGUEN LLEGANDO**

1. *Quien escribe el procedimiento del corte lee `DEC-MIG-002`.* **Llega**: `D/01:2281-2283` (la
   entrada empieza en `:2261`), *«Se siguen tomando altas en el sistema actual, y **se transcriben a
   mano cuando el rediseño esté listo**, con el mismo procedimiento del §2.3 que `DEC-MIG-001`
   fijó»*, con `**Estado**: ACCEPTED` y sin puntero. Contado con script sobre los campos *Estado*:
   los cinco `SUPERSEDED` son `DEC-SUB-001`, `-003`, `-005`, `DEC-MIG-001` y `DEC-MP-003`.
2. *Lee `B/21` §3.3.* **Llega**: `B/21-migracion.md:99`, *«### 3.3 Las altas nuevas son una decisión
   del owner, y se declara abierta»*, y `B/21:113-115`, *«Queda declarada como decisión del owner
   en `04-open-decisions.md`»*; su «NO cierra» (`B/21:230-231`) la sigue listando abierta.

Residuo: `C-9`.

### `F-8CB3-017` — `B/22` §4 cuenta seis y la tabla tiene cinco · **SIGUE LLEGANDO**

La tabla (`B/22-lo-legal.md:129-133`) tiene las filas 1, 2, 3, 4 y 6; `B/22:135-136` sigue diciendo
*«**Las seis piden revisión profesional** … las otras tres»* (son dos: la 3 y la 6), y el capítulo
va §1, §2, §4, sin §3. La 5 es la del hash, que vive en `V/22:112` y en el pliego (`D/13:135`).
Residuo: `C-11`.

### `F-8CB3-018` — `B/21` cita un §2 que no tiene la cifra · **SIGUE LLEGANDO**

`B/21:109` sigue con *«el umbral medido está en unas 20 (§2.4)»*; el `B/21` §2.4 (`:119`) no lo
contiene y la cifra está en `V/21-migracion.md:263` (§2.5). El orden de encabezados de `B/21` sigue
siendo §1, §3, §2.4, §2.5, §4 (`B/21:27`, `:68`, `:119`, `:153`, `:216`). Y `N/02-modelo-de-datos.md:88`
sigue remitiendo a *«§4»*, que `N/02` no tiene (sus secciones son 1, 1.1-1.3 y 2.6). Residuo: `C-10`.

### `F-8CA3-012` — «qué se pierde» se midió sobre un subconjunto · **LLEGA A OTRA COSA**

1. *Una suscripción con trial soft-deleted es un trial consumido que no está en la cuenta.*
   **Cambió de forma.** La cuenta de las seis personas está tachada (`V/21:64-69`): desde el 25/09
   el corte escribe *«una fila de `trial` ya consumida por cada dueño que tenía al menos una ficha
   —o una suscripción— en el sistema viejo»* (`V/21:208-210`). Si *«una suscripción»* incluye las
   soft-deleted **no está dicho**, y la consulta que queda escrita sigue filtrando
   `WHERE deleted_at IS NULL` (`D/07-facts-inventory.md:138`, `:144`).
2. *Compras de addon, canjes de promo, grants de destaque y `entity_subscriptions` no se contaron.*
   **Llega**: `rg -i "boost|destaque|featured|addon|compra"` sobre `B/21`, `V/21`, `D/16` y `D/07`
   no devuelve nada. Residuo: `DB-5`.

### `F-8CC2-006` — `PB2` «despublica la mañana del corte» contra «no dispara» · **LLEGA A OTRA COSA**

1. *Mañana del corte, Rosa en `PRE_TRIAL` con `cubierto` falso.* Igual.
2. *`PB2` se dispara por un cambio de `cubierto`, y no hay valor anterior.* Igual: nadie emite el
   aviso esa mañana.
3. *La ficha de Rosa sigue publicada.* **Ya no llega, pero por otro mecanismo**: desde
   `DEC-ARCH-009`, la primera corrida del reconciliador diario la encuentra (`V/03:881`, población
   con ficha en `PUBLISHED`) y corre `PB2` primera rama (`V/03:904`). La ficha baja **dentro del
   primer día**, no *«la mañana del corte»*.

**Lo que sigue llegando es el texto**, y ahora son tres versiones: `V/21:127-130` (*«`PB2` se
dispara **por el cambio de `cubierto`** … así que **las fichas publicadas de Alojamiento se
despublican la mañana del corte**»*, mecanismo falso), el log `D/01:2840` (`DEC-MIG-004` #1: *«`PB2`
no dispara la mañana del corte y la cartera queda publicada sin cobertura»*, desenlace ya falso) y
`V/03:847-850`, que cita ese #1 como el caso de *«la red»* de `PB4`, cuando la red es hoy el
reconciliador. Residuo: `C-7`.

### `F-8CC2-009` — `B/21` con dos copias caducas · **SIGUE LLEGANDO**

Las dos mitades siguen: la del umbral (`B/21:109` y el log `D/01:2850`, *«**unas 20** (`B/21` §2.4,
hoy 8)»*) y la de la decisión abierta (`B/21:99-115`, `:230-231`, y `DEC-MIG-002` sin puntero).
Residuos: `C-9`, `C-10`.

### `F-8CC1-012` — el párrafo de «cae al piso» mete a `S13` · **SIGUE LLEGANDO**

1. *`S13` deja al cliente en el piso.* **Llega**: `D/12:436-437`, *«cuatro la sacan de las filas
   vivas sin que nadie declare nada —`S12`, `S13`, `S16` y **el espejo**»*, y `D/12:448-449`, *«el
   cliente cae al piso (§2.5) por lo que le quede de ventana»*. Pero `B/03:427` dice lo contrario:
   *«`S13` alcanza a **toda fila viva principal** del beneficiario, o sea también a la sucesora»*, y
   el grant es `TÍTULO`.
2. *`B/19` filas 16 y 16-bis lo dicen.* **Llega**: `B/19-superficies.md:127-128` siguen siendo
   *«que **no se ofrece**»*; ninguna le dice al cliente que perdió la cobertura.

Residuo: `C-8`.

### `F-8CA2-017` — `V/03` §2 cuenta tres pares con dos destinos · **SIGUE LLEGANDO**

`V/03:183-184`, *«uno de los **tres** que el diseño declara hoy — los otros dos son `S5`/`S19` y
`S7`/`S19`»*, contra `N/03:82`, *«son **cuatro**»*, y `V/20-testing.md:270`, que nombra los cuatro
(con `S10`/`S25`). Residuo: `C-12`.

---

## 5. Los conteos del handoff y del log, recontados con script

`D/03-handoff.md:89-94` declara los conteos del 25/09 (tarde). Cada uno, contra su fuente:

| qué | declara el handoff | medido | cómo | ¿coincide? |
|---|---|---|---|---|
| encabezados `### DEC-` del log | 118 | **118** | regex `^### DEC-` sobre `D/01` | sí |
| plantilla | 1 | **1** (`D/01:26`, `### DEC-<AREA>-<NNN> — <título>`) | encabezados sin número | sí |
| decisiones | 117 | **117** | encabezados con número | sí |
| IDs únicos | 117 | **117**, cero duplicados | `Counter` sobre los IDs | sí |
| de metodología / funcionales | 15 / 102 | **15 / 102** por prefijo `DEC-METH-` | prefijo | sí — **pero ver `C-15`** |
| filas de la matriz | 98 | **98** | `python3 contar-filas-de-la-matriz.py` desde `D` | sí |
| `VERIFIED` · `PARTIALLY` · `NOT_SUPPORTED` · `UNKNOWN` | 55 · 14 · 23 · 6 | **55 · 14 · 23 · 6** | ídem | sí |
| los `UNKNOWN` | `PA-6`, `RN-3`, `GR-1`, `GR-2`, `RC-8`, `RF-3` | **los mismos seis** | ídem | sí |
| motivos de marca | 20 | **20** filas (`B/02:902-921`); **7** con `SÍ` (1, 2, 3, 7, 12, 15, 20); **11** abiertos por `S14` y 9 por otros | parser de la tabla de `B/02` §2.5 | sí, y también las cifras internas del § |
| acciones administrativas | 13 | **13** | filas de la tabla de `N/08` §3 | sí |
| máquina de publicación | 6 estados / 12 transiciones | **6 / 12** (`PB1`–`PB12` en `V/03:438-449`; estados de las columnas `desde`/`hacia`) | parser de la tabla | sí |

**Chequeos cruzados que salieron limpios**: el script de la matriz no descarta filas por prefijo
(los 16 prefijos que aparecen en primera celda son los 15 que reconoce más `MP-01`, que es de la
tabla *«Qué espera cada decisión»*, `D/06:525`, y no una fila); ninguna fila duplicada; la tabla de
defaults de `B/19` §6 tiene **7** `devolver` (`B/19:214-220`), igual que los `SÍ`; las nueve citas
de *«veinte motivos»* del corpus (`N/01:666`, `N/03:41`, `N/08:310`, `B/03:109`, `B/09:88`, `:92`,
`B/12:640-641`, `B/19:248`) tienen la cifra viva en veinte; las siete de *«trece acciones»*
de `V/17` y la de `B/19:196` dicen trece; `SUPERSEDED` **5** contado sobre los campos *Estado*,
igual que el resumen del log; apartamientos **8**, enumerados uno por uno.

**Lo único que no cierra** está fuera de los conteos del handoff: `N/00:42-45` (`C-13`) y la
ubicación de las decisiones de metodología en el log (`C-15`).

---

## 6. IDs de decisión citados que no existen en el log

Script sobre los 177 archivos de `HOS-1352`, `HOS-1353` y `HOS-1354` (`.md`, `.json`, `.csv`,
`.txt`), toda mención `DEC-<ÁREA>-<número>` contra los 117 encabezados del log. **Dos
coincidencias, las dos falsas alarmas**:

- `DEC-BILL-001` — `D/00-PDR.md:267`, el ejemplo de formato del PDR (*«Ejemplo: `DEC-BILL-001 -
  Trial scope = user + vertical`»*), y su cita en `D1-coherencia-del-conjunto.md:569`.
- `DEC-RF-00` — `D1-coherencia-del-conjunto.md:565`, que escribe `DEC-RF-00N` como patrón.

**Ningún capítulo, sub-spec, log ni documento de fase cita una decisión inexistente.**

---

## 7. Residuos

### 7.1 AL OWNER

#### `AO-1` · Un plan suspendido sigue dando beneficios en OTRA vertical (`F-8CA1-002`, `F-8CA1-003`)

**El caso.** Juan tiene Alojamiento Premium, que hereda Turista VIP y otorga la insignia global.
Usa VIP como turista y opera su restaurante en Gastronomía: las entradas `Juan + Turista` y
`Juan + Gastronomía` quedan cacheadas con VIP y con la insignia. Deja de pagar Alojamiento y `S6`
lo suspende: se invalida **sólo** `Juan + Alojamiento` (`V/02:473`). Juan sigue con VIP y con la
insignia hasta que venza la red de tiempo, y si intenta **comprar** VIP la API se lo rechaza con el
dato viejo —*«tu plan comercial ya te lo da»*—, lo contrario de `V/15:447`. Toca **acceso** (un
suspendido conserva capacidades) en el camino principal de toda suspensión de un plan con
herencia o con claves globales.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **toda fila de la lista de `V/02` §3.2 invalida TODAS las entradas `user + *` del user**, no sólo la de su vertical | una línea en la tabla; invalidar es borrar (`V/02` §3.2 regla 1), así que el costo es una relectura por vertical del user, y el user promedio tiene una o dos | ninguno de acceso: se paga rendimiento, que es la dirección que el propio § declara segura |
| 2 | **no cachear lo que cruza verticales**: la herencia y las claves globales se resuelven siempre en vivo | toca la resolución del paso 6 en dos lugares | la resolución de Turista pasa a leer `cobertura()` de las otras verticales en cada lectura |
| 3 | un `tipo: HERENCIA` en el contrato más una fila de invalidación por fuente de otra vertical | cambia la firma (`D/12:22`) y agrega una fila por cada clase de fuente cruzada | es la forma de *«lista de casos»* que `V/02:491` dice que ya falló dos veces |

**Recomendación: (1).** Es la regla de `V/02:491` aplicada a su propio límite —una fuente que
cambia lo que otorga en otra vertical sin tocar ninguna fila de esa vertical— y cierra los dos
hallazgos con el mismo renglón. Texto propuesto para `V/02` §3.2, debajo de *«Dos reglas sobre la
invalidación»*: *«3. **La invalidación es por `user`, no por `user + vertical`.** Una fuente puede
otorgar en una vertical distinta de la suya —la herencia de Turista VIP, las claves globales
(`V/15` §3)—, así que toda fila de esta tabla borra las entradas de **todas** las verticales del
user. Cuesta una relectura por vertical; ahorrarla es lo que dejaba a un suspendido con VIP
(FASE 8 completa, `F-8CA1-002`, `F-8CA1-003`).»*

#### `AO-2` · «Inhabilitado por abuso» no existe en ningún lado (`F-8CA1-010`)

**El caso.** Juan publica fichas con contenido abusivo. El paso 2 (`V/17:65`) diría que su cuenta
*«no puede operar hoy»*, pero no hay columna, transición ni acción para marcarlo. Cada
implementador inventa la suya, y ninguna baja lo que Juan ya publicó. Toca **acceso**: un control
declarado en el orden de autorización que no tiene de dónde leer.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **sacar «inhabilitada» del paso 2**; el paso 2 queda en *«correo sin verificar»*, y el abuso se trata ficha por ficha con `MODERATED` (`PB10`), que ya existe | editar `V/17:48`, `:65`, `:103` | un abusador puede crear fichas nuevas; cada una se modera a mano |
| 2 | **estado de la persona** como dato (`user.inhabilitada_desde`), una **acción administrativa 14** *«inhabilitar / rehabilitar»* con permiso y motivo, y efecto: el paso 2 rechaza toda operación y `PB10` corre sobre todas sus fichas en el mismo acto | una columna, una fila del catálogo (y recontar las cinco líneas que dicen *«trece»*), una regla de efecto | ninguno nuevo; es lo que el paso 2 promete |
| 3 | lo de (2) sin bajar lo publicado | como (2) menos el efecto | lo publicado del abusador sigue visible |

**Recomendación: (1).** El log mide que *«El abuso es teórico a esta escala»* (`D/01:436`, 22
usuarios), y `MODERATED` ya da la herramienta por ficha. Un control sin dato es peor que ninguno,
porque cada implementación lo llena distinto; si el abuso aparece, (2) se agrega sin tocar nada
de lo demás.

#### `AO-3` · Qué puede leer un visitante de una ficha ajena (`F-8CA1-011`)

**El caso.** Un turista abre la ficha publicada de María. El paso 4 pregunta *«¿… es del
sujeto?»* (`V/17:67`) y la respuesta es no: *«no existe»*. Como eso rompe el sitio, cada superficie
pública se hace su exención, y en una de ellas se cuela el borrador o la ficha archivada de María.
Toca **acceso** en la superficie más usada.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **declarar la lectura de lo ajeno en el paso 4**: *«si el sujeto no es el dueño, el recurso existe sólo si está en un estado público»*, con la lista cerrada **`PUBLISHED`** para fichas y *«entitlement de presencia vigente»* para Partner (`V/18:112`) | un párrafo en `V/17` §3.5 y una línea en la tabla del §1.2 | ninguno: es la lista que el diseño ya usa sin haberla escrito |
| 2 | dejarlo a cada superficie, con un guard que exija que declare sus estados | un guard | es la *«exención por superficie»* que `V/17:360-364` descarta |

**Recomendación: (1).**

#### `AO-4` · El suspendido no tiene clave para leer lo suyo (`F-8CA1-013`)

**El caso.** Juan está `SUSPENDED`. Desde `DEC-SUB-021` salir es cambiar la tarjeta, así que
entra a su billing. Esa lectura pasa por el paso 6 (`V/17:356-357`) contra la versión de piso, que
otorga tres cosas y ninguna es *«leer Mi Cuenta»* ni *«leer mi billing»* (`V/02:210-216`). Un
implementador fiel lo rechaza, y Juan no puede ver cómo regularizar. Toca **acceso** (de menos) en
el camino principal de la recuperación, que es plata.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **las lecturas de lo propio no consultan el paso 6**: se declaran en `V/17` §3.5 como el caso simétrico del 5 (*«leer lo propio no consume capacidad comercial»*) | un párrafo | que alguien meta una lectura comercial (una estadística paga) como *«lo propio»*; se acota diciendo que la excepción es para Mi Cuenta, el billing y las fichas propias |
| 2 | **una cuarta fila del piso**: *«leer lo suyo: Mi Cuenta y el estado de su billing»*, y `G-R3` (b) exige tres claves en vez de dos | una fila, un guard | reabre la lista cerrada del piso, que el capítulo defiende por escrito |

**Recomendación: (1).** Es la misma distinción que ya separó el paso 5 del 4 (`V/17:366-369`), y no
toca el piso.

#### `AO-5` · El registro de eventos guarda el texto que el día 180 promete borrar (`F-8CA3-004`)

**El caso.** Laura edita la descripción de su ficha cinco veces. Si esas ediciones son eventos
—y el hecho 1 del reloj dice leerse de ahí (`N/01:54`)—, cada uno guarda el texto viejo y el
nuevo (`N/08:57`) en un registro sin `delete` (`N/08:66`) que la retención ya no toca (`N/08:73`).
Laura deja de pagar, al día 180 `PB9` borra *«el contenido de ESA ficha»* (`V/02:541`), y las diez
versiones del texto siguen en la base. Toca **datos**: la promesa del §25 y de `DEC-DATA-005`.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **para los campos de contenido de una ficha, el evento guarda el NOMBRE del campo y no los valores**; los valores anterior/nuevo quedan para los campos que no son contenido (estado, plan, monto, fechas) | una línea en `N/08` §1.2 y la lista de campos de contenido (la misma de `V/02:541`) | se pierde poder mostrar *«qué decía antes»* de una ficha; no lo pide ningún capítulo |
| 2 | que el hecho 1 no se lea del registro sino de una columna (`listing.ultimo_acto_del_dueño`) | una columna y una fila en `G-R6-B` | no arregla nada si igual se auditan las ediciones con valores |
| 3 | que `PB9` redacte los eventos de esa ficha | rompe *«Append-only: sin `update` y sin `delete`»* (`N/08:66`) | es la escritura que `DEC-DATA-005` sacó |

**Recomendación: (1)**, y en el mismo acto corregir `N/01:54` para que el hecho 1 no diga que el
registro *«ya los guarda todos por el criterio 2»* (no es cierto: editar y exportar no son
transiciones, `N/08:40-41`). Texto propuesto para la celda: *«el registro append-only de eventos
de dominio (cap. 08 §1.3). **Crear, editar y exportar se registran como eventos aunque no sean
transiciones**, y de los campos de contenido guardan sólo el nombre (cap. 08 §1.2)»*.

#### `AO-6` · La cuota impaga de quien se va queda viva, y registrarla cobra sobre una fila muerta (`F-8CB2-005`)

**El caso.** Juan paga a mano, está en grace con su cuota de octubre `AWAITING`, y pide la baja
(`S24`). La cuota queda `AWAITING` para siempre. Juan transfiere igual; el admin, que tiene el
aviso de esa cuota, la registra con `MP1`: se escribe el pago, **se avanza un ciclo la fecha del
próximo cobro de una suscripción `CANCELLED`** y Juan recibe dos *«renovación por venir»*. Si en
cambio la declara impaga (`MP2`), el efecto es `S6` desde `CANCELLED`, que va a
`TRANSICIÓN_NO_DECLARADA`. Toca **plata**: un pago recibido sobre una fila sin servicio.

**Dominio** (contado sobre `B/03:128-158`): del grace salen sin pasar por `S5`/`S6` **seis**
transiciones (`S13`, `S17`, `S20`, `S21`, `S24`, `S26`); de `PENDING_AUTHORIZATION` con la primera
cuota abierta salen sin `S3` **cuatro** (`S13`, `S20`, `S21`, `S28`).

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **una tercera cláusula de `MP3`**: *«la suscripción sale de `GRACE_PERIOD` o de `PENDING_AUTHORIZATION` por cualquier transición que no sea `S5`, `S6`, `S2`/`S29` ni `S3`»* → `DECLARED_UNPAID`, **sin efecto sobre la suscripción** (como la segunda cláusula) | una celda; la máquina sigue con tres estados | `DECLARED_UNPAID` pasa a significar también *«cerrada»*; `MP4` desde ahí tiene que exigir la fila viva, y ya lo hace por la condición 1 de `B/05` §3 |
| 2 | un cuarto estado `CLOSED` para la cuota | un estado, una fila, recontar los *«tres estados»* de `B/03:1916` y `:2294` | ninguno, pero es más texto para lo mismo |

**Recomendación: (1).** Es la extensión que el hallazgo pedía, sobre el dominio completo y no sólo
sobre los cinco casos que nombraba.

### 7.2 DE BORDE

Ninguno está declarado hoy: se grepeó cada tema contra todos los «NO cierra» de `B`, `V`, `N` y el
contrato (514 líneas extraídas por script: sección *«Lo que … NO cierra»* más todo renglón con
*«NO cierra»* o `DEC-METH-015`).

#### `DB-1` · El correo se manda al menos una vez (`F-8CB2-011`)

**Dónde iría**: `N/07` «NO cierra» (`N/07:319`). **Texto**: *«- **El envío es al menos una vez, no
exactamente una.** La clave del §2 impide encolar dos veces, no mandar dos: un proceso que manda y
muere antes de marcar `sent` pierde el `processing` por vencimiento (§1.2) y la fila sale de nuevo.
El daño es un correo repetido —también el que sale antes de cancelar (cap. 03 (billing) §3.2
precisión 3)—, nunca una acción de dominio. **Causa**: el proveedor de correo no está elegido y no
se sabe si acepta una clave de idempotencia.»*

#### `DB-2` · «El último aplicado» sin alcance (`F-8CB2-012`)

Mejor que declararlo es precisarlo, porque es una palabra. **Texto** para `B/03:2613`: *«un hecho
más viejo que el último aplicado **sobre el mismo recurso** —el mismo pago, el mismo reembolso— se
registra y no se aplica. Dos recursos distintos de una misma suscripción no se ordenan entre sí.»*
Si se prefiere no tocar la regla, la declaración va en `B/03` «NO cierra» (`B/03:2641`): *«- **El
alcance de «el último aplicado» del §10.2 no está escrito.** Leído por suscripción, un cobro que
llega tarde detrás de un reembolso quedaría `PENDING`; lo levanta el motivo 19 (`B/02` §2.5).
**Causa**: la regla se escribió para el mismo id que avanza.»*

#### `DB-3` · El stub no miente como el proveedor en la conciliación (`F-8CB3-015`)

**Dónde iría**: `B/20` no tiene «NO cierra»; va como párrafo al final de la tabla del §3.2 (`B/20:454`).
**Texto**: *«⚠️ **Las mentiras de la conciliación no están en esta tabla** (FASE 8 completa,
`F-8CB3-015`; declarado por `DEC-METH-015`): el *«todavía no se sabe»* y el inventario de intentos
(`RC-5`, `RC-6`, `RC-7`), la ventana de reintentos (`GR-3`), las entregas perdidas y reemplazadas
(`WH-1`, `WH-2`, `WH-5`), la pausa y la fecha que avanza sin cobrar (`PS-2`, `PS-6`), y los campos
`charged_quantity` y `last_charged`. El stub no las reproduce, así que el barrido de `B/09` se
verifica contra un proveedor que no existe. **Causa**: la tabla se escribió antes de que la
conciliación tuviera sus filas medidas.»* Y, aparte, **renumerar la lista E2E** (`B/20:514-515`:
el 8 pasa a 7), que es registro y no borde.

#### `DB-4` · El correo inmediato: un caso con motivo y otro sin productor (`F-8CB3-016`)

**Texto** para `N/08:286-287`: *«…es una lista cerrada: la marca con motivo **`COBRO_DUPLICADO`**
(cap. 02 (billing) §2.5, motivo 20), y un reembolso que falló sobre una revocación.»* Y en el «NO
cierra» de `N/08` (`N/08:331`): *«- **El reembolso que falla sobre una revocación no tiene
detector ni motivo** (FASE 8 completa, `F-8CB3-016`). La excepción del §4.1 lo nombra y ninguna
comprobación lo produce, así que hoy llega sólo por el resumen agregado. **Causa**: `DEC-RF-001`
declaró el acto, no su falla.»*

#### `DB-5` · El censo del corte no mira addons, promos ni borrados (`F-8CA3-012`)

**Dónde iría**: `B/21` §1.3 (`B/21:60-65`), que ya exige re-verificar. **Texto**, al final del §:
*«**Y la re-verificación cuenta más que `billing_subscriptions` vivas** (FASE 8 completa,
`F-8CA3-012`): también las soft-deleted —que son trial consumido— y las tablas que el corte descarta
sin nombrar: compras de addon, canjes de promo, grants de destaque y `entity_subscriptions`. Hoy
`payments = 0` sugiere que ninguna tiene plata adentro; es lo que hay que confirmar, no suponer.»*
Y en `V/21` §2.4 (`V/21:208-210`) precisar que *«una suscripción»* incluye las soft-deleted.

### 7.3 CONTRADICCIONES DE TEXTO

| # | lado A | lado B | corrección propuesta |
|---|---|---|---|
| `C-1` | `V/22:79`, `:84`, `:94`; `D/13:135`, `:145`; `V/02:543`: *«hash irreversible»*, *«no se puede leer de vuelta»* | `V/22:83`: sirve para *«comparar un candidato contra lo consumido»*, o sea que re-identifica a quien trae el correo; `V/22:103-104` y `D/13:155` dicen que el *«no»* no cambia ningún mecanismo, y borrar el hash es un escritor nuevo sobre una fila *«íntegra, siempre»* | Reemplazar *«hash irreversible»* por *«**seudónimo determinístico** del correo normalizado: no permite leer el correo, pero **reconoce a quien vuelve con el mismo correo**»*, en los seis lugares. En la rama del «no» (`V/22:103-104`, `D/13:155`): *«cambia un mecanismo: hay que poder borrar el seudónimo de una fila que hoy se declara íntegra, con un escritor nuevo y una columna anulable, y el `UNIQUE` deja de bloquear a esa persona»*. **Va antes de mandar el pliego.** |
| `C-2` | `D/12:84-94` (la firma, seis campos, sin piso) y `D/12:22` (*«se enuncia acá y en ningún otro documento»*) | `V/15:116-117`: la resolución toma *«la fuente `GRANT` de esa vertical —con el plan de esa vertical y el piso de esa vertical—»*; `B/02:493` guarda el piso en una tabla de billing | Agregar a la firma: `piso: versiónDePlan, si tipo = GRANT; nada en los otros cinco` (siete campos), con la nota *«el trinquete se aplica en verticales y su piso cruza por acá; leerlo de `permanent_grant_vertical` sería el acoplamiento que el §4.2 manda detectar»*. **Cambia la firma**, como `cobrada` el 25/09: el orquestador decide si lo lleva al owner |
| `C-3` | `B/02:732`: el piso es *«la referencia a la versión de ESE plan»* | `B/02:493` (restricciones): sólo *«el piso tampoco es anulable»*; `V/02:47`: `plan` sólo tiene `UNIQUE(vertical, slug)` | En `B/02:493`: *«el piso **es una versión de ese mismo plan** (FK compuesta sobre `plan_version(id, plan_id)`), y el plan pertenece a esa vertical (FK compuesta sobre `plan(id, vertical)`)»*; en `V/02:47` agregar `UNIQUE(id, vertical)` *«para la FK del ancla de billing»* |
| `C-4` | `B/03:2581-2582`: lo que no figura es divergencia real | la tabla `B/03:2566-2578` no tiene `authorized`×`ACTIVE`, `paused`×`PAUSED`, ni `cancelled`×`CANCELLED`/`ABANDONED`/`CHARGE_DECLINED` | Tres filas: `authorized` × `ACTIVE` → *«nada: coinciden»*; `paused` × `PAUSED` → *«nada: coinciden (el caso ciego lo mira la quinta comprobación del `B/09` §3)»*; `cancelled` × terminal → *«nada: coinciden — la cancelación ya estaba asentada»*. Y recontar el *«once filas»* de `B/03:2595-2596` (pasa a catorce) |
| `C-5` | `B/05:296`: la fila 1 es *«la cancelamos nosotros»* y `B/05:301-303` el porqué | la enumeración de esa misma fila omite `S21`, `S25`, `S27` y `S31`, que caen en el comodín `B/05:298` | Agregar a la enumeración de `B/05:296`: *«`S21`, `S25`, `S27`, `S31`»*, y decir *«toda transición que lleva la fila a `CANCELLED` salvo las de un Free Forever»* en vez de la lista |
| `C-6` | `B/09:147`: la lápida, *«sin nadie que verifique»*, citando `D/16` §4.2 | `D/16:115`, `:119`: el paso 2 **verifica releyendo por id** y es el gate; la frase de `D/16:130-132` describe la alternativa descartada | Corregir la celda: *«una persona a mano, **verificada por relectura** en el paso 2 del corte (`D/16` §4.2), pero sin idempotencia ni registro de nuestro lado»*. Si con eso la lápida cumple el criterio de exención de `B/09:122-124`, sacarla de la salvedad 4 cambia *«trece de las catorce»* (`B/09:157`) y la lista de `B/03:2577`; **conviene dejarla barrida y decir por qué** (*«se barre igual: es la única escritura del corte y la escribe una persona»*), que no mueve ninguna cifra |
| `C-7` | `V/21:127-130` y `D/16:139`: se despublican *«la mañana del corte»* porque `PB2` se dispara por el cambio; el log `D/01:2579` (`DEC-MIG-003`) dice lo mismo | el log `D/01:2840` (`DEC-MIG-004` #1): *«`PB2` no dispara … y la cartera queda publicada sin cobertura»*; `V/03:847-850` cita ese #1 como el caso de la red de `PB4` | `V/21:127-130`: *«…no cubre, y el corte no es un cambio de `cubierto` (no hay valor anterior), así que `PB2` no dispara por evento: **las despublica la primera corrida del reconciliador diario de cobertura** (`V/03` §9, `DEC-ARCH-009`), dentro del primer día»*; `D/16:139` y `V/21:151` igual. `V/03:847-850`: el caso de la mitad `PUBLISHED` de `PB4` es *«una ficha publicada sin cobertura que el reconciliador todavía no bajó»*. **El log** (`D/01:2579`, `:2840`) necesita una nota de precisión con OK del owner, porque las dos entradas se contradicen entre sí |
| `C-8` | `D/12:436-437`, `:448-449`: `S13` entre las que dejan al cliente en el piso | `B/03:427`: `S13` alcanza *«también a la sucesora»*, y el grant es `TÍTULO` | Sacar `S13` de la lista de `D/12:437` (quedan tres: `S12`, `S16` y el espejo) con la nota *«`S13` no: cancela también a la sucesora y deja un `GRANT` de clase `TÍTULO`»*; y en `B/19:127-128` agregar a la 16 y la 16-bis: *«…y le dice que **perdió la cobertura** y que sus fichas vuelven cuando autorice»* |
| `C-9` | `D/01:2281-2283` (`DEC-MIG-002`, `ACCEPTED`: *«se transcriben a mano»*); `B/21:99`, `:113-115`, `:230-231` (*«se declara abierta»*) | `DEC-MIG-003` (`D/01:2538`): no se migra nada; `DEC-MIG-004` #16: las altas nuevas se llaman | En el log (con OK del owner): *Estado* de `DEC-MIG-002` → *«**SUPERSEDED EN PARTE por `DEC-MIG-003`**: sobrevive *«se siguen tomando altas»*; se cae *«se transcriben a mano»*»*, que lleva a 6 los `SUPERSEDED` del resumen. En `B/21`: el título del §3.3 → *«Las altas nuevas se siguen tomando (`DEC-MIG-002`) y se resuelven como la cartera (`DEC-MIG-003`, `DEC-MIG-004` #16)»*, y sacar la línea de su «NO cierra» |
| `C-10` | `B/21:109` *«unas 20 (§2.4)»*; `D/01:2850` *«`B/21` §2.4»*; `N/02:88` *«se explica en §4»* | la cifra está en `V/21:263` (§2.5); `N/02` no tiene §4 | `B/21:109` y `D/01:2850` → *«(`V/21` §2.5)»*; `N/02:88` → *«se explica en `V/02` §4»* (la retención, `V/02:511`); y renumerar `B/21` (§2.4 y §2.5 pasan a §2.1 y §2.2 de un §2 nuevo, o a §3.4 y §3.5) |
| `C-11` | `B/22:135-136`: *«Las seis … las otras tres»*; `B/22:142`: *«Las seis preguntas»* | la tabla `B/22:129-133` tiene cinco (1, 2, 3, 4, 6); las no negritas son dos | *«**Cinco de las seis del pliego** (`D/13` §2; la 5, la del hash, es de `V/22` §4) piden revisión profesional… las otras dos cambian un número»*; y en el «NO cierra», *«Las cinco preguntas de esta épica»* |
| `C-12` | `V/03:183-184`: *«uno de los **tres»**, con `S5`/`S19` y `S7`/`S19`* | `N/03:82` (*«cuatro»*) y `V/20:270` (nombra `S10`/`S25`) | *«uno de los **cuatro** que el diseño declara hoy — los otros tres son `S5`/`S19`, `S7`/`S19` y `S10`/`S25`»* |
| `C-13` | `N/00:42-45`: *«son **111** al 2026-09-24»* y los `SUPERSEDED` que no cuentan como fuente son `DEC-SUB-001`, `-005`, `DEC-MIG-001` en parte y `DEC-MP-003` en parte | el log: 117 decisiones y **5** `SUPERSEDED`, con **`DEC-SUB-003`** entera por `DEC-SUB-021` (resumen del log, fila `SUPERSEDED`) | *«son **117** al 2026-09-25 … `DEC-SUB-001`, `DEC-SUB-003` y `DEC-SUB-005` enteras, …»*. **Es el lugar donde un implementador busca qué decisiones valen**, y hoy le deja `DEC-SUB-003` como fuente |
| `C-14` | `V/03:97`: *«Los dos sentidos de «vivo» … están en el cap. 01 (núcleo) §2.4»* | `N/01:468`: *««Vivo» nombra cuatro conjuntos»*; `N/00:99` ya se corrigió | *«**Dos de los cuatro** sentidos de «vivo» —fila viva y fuente viva— y por qué no son intercambiables…»*. `V/11:235` dice *«los dos sentidos … están separados»* en el mismo contexto: misma corrección. Y la cifra de `N/00:64` (74) hoy da 76: si se deja, que diga *«recontado el 2026-09-25»* sin pretender estar al día |
| `C-15` | el resumen del log y el handoff: *«15 de metodología, 102 funcionales»* | por **sección**, `## Metodología` tiene **4** decisiones y `## Decisiones funcionales` **113**: `DEC-METH-005` a `-015` (once) viven bajo el encabezado funcional (`D/01:2382` … `:5349`) | Decir el criterio en la fila del resumen: *«contadas por prefijo; once de las de metodología están bajo el encabezado funcional porque se escribieron en orden cronológico»*, o mudarlas. No cambia ninguna cifra |

---

## 8. Lo que este documento no revisó

- **`A3`** (`B/03:2366`, *«la misma ventana que `S3`»*): no dice si hereda la relectura del
  proveedor que `S3` tiene en su condición, que es lo que la regla 5 del núcleo exige de todo job de
  nuestro reloj. Puede que no haga falta —el addon recurrente tiene su propia fila de suscripción
  de complemento, que sí corre `S3`—, pero no lo verifiqué contra `B/16`.
- La forma de referencia *«cap. NN §x»* sin épica: es ambigua por construcción y el resolvedor del
  §4 no la recorre.
- `HOS-1352-billing-verticals-redesign/spec.md:147` sigue diciendo *«106 decisiones»* al
  2026-09-24. Es la salida 3 de `DEC-METH-004` (sub-specs), que va al final por diseño; no es una
  contradicción, es propagación pendiente.
- La cabecera de la matriz sigue diciendo *«FASE 1C en curso»* (`D/06:12`) y su frontmatter no
  tiene `updated:`; no es parte de ningún hallazgo.
