---
title: "FASE 9 completa · R13 y F-8CA1-001 — la página de Partner y la vertical de la ficha"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R13 y `F-8CA1-001`

`DEC-METH-004` pide dos cosas para dar por resuelto un racimo: que el camino de cada hallazgo,
reejecutado sobre el texto corregido, ya no llegue, **y** que la regla corregida se verifique contra
todo el dominio que cuantifica. Este documento lo hace para **R13** (la presencia de Partner) y
para el crítico suelto **`F-8CA1-001`** (la vertical se lee de la ficha).

**No edita nada.** Todo lo que haya que cambiar se propone con su texto; lo aplica el orquestador.

Rutas abreviadas: `V/` = `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B/` =
`HOS-1354-billing-cobro-y-proveedor/docs/`, `D/` = `HOS-1352-billing-verticals-redesign/docs/`,
`N/` = `D/nucleo/`, «contrato» = `D/12-contrato-de-cobertura.md`. El código citado es el del clon
principal `hospeda2` en `cd4e59164b`, sólo como evidencia del comportamiento de hoy.

**Resumen de veredictos**: seis hallazgos — **5 DEJAN DE LLEGAR**, **0 SIGUEN LLEGANDO**, **1 LLEGA A
OTRA COSA** (`F-8CA1-014`). Residuos: **3 al owner**, **4 de borde** (2 ya declarados, 2 sin
declarar), **3 contradicciones de texto**.

---

## Parte 1 · `F-8CA1-001` — la vertical se lee de la ficha

### 1.1 La regla corregida, tal como quedó

`V/17-autorizacion.md:63`, la fila de la precondición de la cadena:

> | — | **contexto de vertical** | *(precondición estructural, §2)* — **en una operación sobre una ficha, la vertical se lee de la ficha y nunca del pedido** (precisión 6) | la operación no se puede expresar — y si el pedido declara otra vertical que la de la ficha, **no existe**, con la respuesta del paso 4 |

`V/17-autorizacion.md:134-138`, precisión 6:

> 6. **En una operación sobre una ficha, la vertical no viene del pedido: se lee de la ficha**
>    (FASE 8 completa, `F-8CA1-001`, owner 2026-09-25). Es el primer paso de la cadena —la fila de
>    la precondición— y va **antes de mirar la cobertura**, porque los pasos 5 a 7 se resuelven
>    sobre `user + vertical` y la vertical tiene que ser la verdadera antes de preguntar nada con
>    ella. Si el pedido declara otra, **no existe**

`V/17-autorizacion.md:177-179`, §2.2:

> la firma, no un parámetro opcional ~~ni un valor que se deduzca del recurso~~. **Y en una operación
> sobre una ficha, ese contexto es la vertical de la ficha, leída de la ficha**: la que el pedido
> declare no decide nada, y si no coincide la operación responde *no existe*

Y su guard, `V/20-testing.md:51`:

> | G2 | **dos mitades, con dos mensajes**. **(a)** una operación de dominio **no declara** su contexto de vertical; **(b)** una operación **sobre una ficha** toma su contexto de vertical **del pedido y no de la ficha** (FASE 8 completa, `F-8CA1-001`, owner 2026-09-25) | cap. 17 §2.3 y §1.2 precisión 6 (épica de verticales) |

La cita del contrato de errores de la API que la precisión invoca existe:
`apps/api/docs/error-contract.md:10` (*«## The order is the contract»*) y `:16` (*«4. existence /
ownership → 404»*).

### 1.2 El dominio

**La regla cuantifica «toda operación que recibe o resuelve una vertical, sobre una ficha».** El
dominio que me dieron es más ancho —toda operación de `V/17` que recibe o resuelve una vertical— y
lo recorro entero, porque justamente el borde entre «sobre una ficha» y «sobre otra cosa» es donde
puede quedar un residuo.

Eje único: la operación. Fuentes:

- los actos del dueño que reinician el reloj, `N/01-glosario.md:54`: *«crearla, editarla,
  publicarla, despublicarla, exportarla, reactivarla»*;
- las transiciones de la ficha `PB1`–`PB12`, `V/03-maquinas-de-estado.md:436-449`;
- el contenido de la ficha (fotos, FAQ, horarios), `V/03-maquinas-de-estado.md:446` (*«textos,
  fotos, FAQ, horarios»*);
- la compra de un addon `LISTING`, `B/03-maquinas-de-estado.md:2364` (`A1`);
- el reconciliador diario, `V/03-maquinas-de-estado.md:876-885`;
- **la edición de la presencia de Partner**, que el propio `V/17-autorizacion.md:230-231` nombra
  como operación en una vertical: *«publica una ficha de gastronomía, edita su presencia de
  partner»*;
- **cambiar la vertical de una ficha**, que el orquestador pidió mirar («cambiar de tipo»).

**Tamaño: 14 operaciones.** Las operaciones de billing sobre la suscripción (cancelar, pausar,
cambiar de plan) quedan **fuera** de este dominio: su recurso es la suscripción, no una ficha, y no
son operaciones de `V/17`. No las recorrí.

### 1.3 El camino reejecutado

Los pasos son los de `25-fase-8-completa/A1-acceso-cruzado-y-autorizacion.md:49-63`.

1. *Juan tiene Alojamiento Premium `ACTIVE` y una ficha de Gastronomía en `DRAFT`; en Gastronomía
   está `TRIAL_EXPIRED`.* — Sigue siendo un estado alcanzable. Pasa.
2. *Juan invoca `PB1` declarando `vertical = Alojamiento` con el id de la ficha de Gastronomía. «La
   firma lo admite: la vertical es obligatoria y no se deduce del recurso.»* — **Acá se corta.** La
   frase que lo permitía está tachada (`V/17:177`, *«~~ni un valor que se deduzca del recurso~~»*),
   y la fila de la precondición (`V/17:63`) responde: *«si el pedido declara otra vertical que la de
   la ficha, **no existe**, con la respuesta del paso 4»*. La API contesta 404.
3. *Paso 4: la ficha existe, está en `DRAFT` y es suya.* — No se llega: la precondición va antes
   (`V/17:135-136`, *«Es el primer paso de la cadena … y va **antes de mirar la cobertura**»*).
4. *Pasos 5-7 resueltos contra `user + Alojamiento`.* — No se llega. **Y aunque se omitiera la
   declaración**, la cadena corre contra Gastronomía, y la fila de `PB1` corta por su cuenta:
   `V/03:438`, *«**sólo si el dueño está cubierto** —`cubierto` verdadero en esa vertical— **o si
   esta publicación dispara `T1`**»*; con `TRIAL_EXPIRED` no hay `T1`, y la pantalla dice
   *«suscribite para publicar»*.
5. *La ficha queda `PUBLISHED` y `PB2` no dispara.* — No ocurre.
6. *Editar cada 89 días la mantiene publicada.* — No ocurre. **Y hay una tercera red** que el
   hallazgo no tenía: aun si la ficha llegara a publicarse, el reconciliador diario la encuentra
   (`V/03:904`, *«`cubierto` **falso** y al menos una ficha en `PUBLISHED`»* → `PB2`).

**Veredicto: DEJA DE LLEGAR**, cortado en el paso 2 por la precisión 6, con dos redes detrás (la
condición de `PB1` y el reconciliador) y un guard (`G2` mitad *b*).

### 1.4 El dominio recorrido

| # | operación | recurso | ¿de dónde sale la vertical? | resultado |
|---|---|---|---|---|
| 1 | crear la ficha | todavía no existe | del pedido, y queda escrita en `listing.vertical` (`V/02:330`, *«`listing` \| vertical, …»*) | correcto por construcción: no hay ficha con la que discrepar |
| 2 | editar el contenido | ficha | de la ficha (precisión 6) | cubierto |
| 3 | subir foto, FAQ, horarios | contenido de la ficha | de la ficha, **si** se lee como operación sobre la ficha | cubierto por lectura, no por letra (ver 1.5, owner 1) |
| 4 | publicar (`PB1`) | ficha | de la ficha, más la condición de `PB1` | cubierto (camino de 1.3) |
| 5 | despublicar (`PB6`) | ficha | de la ficha | cubierto |
| 6 | reactivar (`PB8`) | ficha | de la ficha | cubierto |
| 7 | borrar (`PB12`) | ficha | de la ficha | cubierto |
| 8 | ver, exportar | ficha | de la ficha; es lectura y pasa por ocho de los nueve pasos (`V/17:356-357`) | cubierto |
| 9 | comprar un addon `LISTING` (`A1`) | ficha objetivo | `B/03:2364`, *«en `cobertura(user, vertical del objetivo)`»* | cubierto |
| 10 | moderar (`PB10`/`PB11`, admin) | ficha | de la ficha | cubierto |
| 11 | `PB2`/`PB3`/`PB7` y el reconciliador diario | fichas del `user + vertical` | la población se define por las fichas del par (`V/03:881`, *«todo `user + vertical` con al menos una ficha»*) | cubierto por construcción |
| 12 | `PB4`/`PB5`/`PB9` (reloj) | ficha | relectura de la cobertura del `user + vertical` de la ficha (`V/03:478-479`) | cubierto |
| 13 | **cambiar la vertical de una ficha** | ficha | de la ficha **antes** del cambio; la columna no está declarada inmutable | **abierto → owner 1** |
| 14 | **editar la presencia de Partner** | presencia (no es ficha) | del pedido: la precisión 6 dice *«sobre una ficha»* | **abierto → owner 1** |

Recuento con script (`vert.tsv` en el scratchpad de la sesión): **14 operaciones — 10 cubiertas, 1
cubierta por construcción, 1 cubierta por lectura, 2 abiertas.**

### 1.5 Lo que no cierra

Los dos abiertos (13 y 14) y el tercero por lectura (3) tienen la misma causa y van juntos al owner
como **owner 1** (§3.1). La contradicción del contrato va en §3.3.

---

## Parte 2 · R13 — la página de Partner

### 2.1 La regla corregida, tal como quedó

`V/18-partner.md:112-114`:

> **La página propia de Partner Gold no tiene máquina de estados. La lectura pública pregunta si
> el partner tiene HOY el entitlement de presencia pública (§1.2), desde el caché del conjunto
> efectivo que ya existe (cap. 02 §3), y si no lo tiene responde que no existe: 404.**

Con sus cuatro consecuencias, `V/18-partner.md:116-130`: el contenido se conserva (*«lo único que
cambia es la respuesta de la lectura»*), la página reaparece sola si vuelve a Gold, responde 404 y
no 410, y *«La invalidación la llevan el aviso y el reconciliador diario (`DEC-ARCH-009`)»*.

El reconciliador la incorpora en `V/03-maquinas-de-estado.md:887-892`:

> **Y todo `user + Partner` con presencia cargada, que no tiene fichas** (FASE 8 completa, `R13`:
> […] **no corre ninguna transición**: resuelve en vivo si el conjunto efectivo otorga la presencia, lo
> compara con la entrada del caché y, si no coinciden, **la invalida**.

El 19 ya no se lo devuelve: `V/19-superficies.md:83-86`, *«ahora éste remite y aquél decide»*. Y el
glosario quedó alineado: `N/01-glosario.md:47` tacha *«~~con su propio ciclo de publicación~~»* y
dice *«**No tiene máquina de estados**»*.

### 2.2 El dominio

Tres ejes, como pidió el orquestador:

- **Tier**: Gold y Silver. Fuente: `V/18:43-46` (*«| **Gold** | sí |»*, *«| los demás | no |»*) y el
  producto de hoy, `.specs/HOS-294-partners-ficha-propia/spec.md:30-31`: *«granted only to the
  `gold` tier. `silver` keeps carousel presence on the home page and nothing else»*.
- **Estado del entitlement**, o sea de la fuente que lo sostiene. Fuentes: la tabla de qué emite
  cada estado, contrato `:405-416`; el grant, contrato §2.8; la vertical discontinuada, contrato
  `:534-536`; la sucesión trabada, contrato `:461-465`; y la revocación del admin que existe hoy
  (`apps/api/src/routes/partners/public/get-by-slug.ts:25`, *«The partner was deliberately
  REVOKED»*). Son **19 estados**:

  | id | estado | fuente |
  |---|---|---|
  | E1 | nunca contrató (sólo la fuente `BASE`) | contrato §2.5 |
  | E2 | `PENDING_AUTHORIZATION` | contrato `:407` |
  | E3 | `ABANDONED` | `:408` |
  | E4 | `ACTIVE` | `:409` |
  | E5 | `GRACE_PERIOD` | `:410` |
  | E6 | `PAUSED` por `CUSTOMER_REQUEST` | `:411` |
  | E7 | `PAUSED` por `COURTESY` | `:412` |
  | E8 | `SUSPENDED` | `:413` |
  | E9 | `CANCEL_SCHEDULED`, antes de la fecha | `:414` |
  | E10 | fecha vencida sin transición (`S12` atascado) | contrato `:390-397` |
  | E11 | `CANCELLED` | `:415` |
  | E12 | `CHARGE_DECLINED` | `:416` |
  | E13 | grant permanente vivo | contrato §2.8 |
  | E14 | grant revocado | contrato §2.8, `V/02:475` |
  | E15 | sucesión en curso, sucesora en `PENDING_AUTHORIZATION` | contrato `:428-430` |
  | E16 | sucesión cerrada (cambio de tier) | `V/02:472` |
  | E17 | vertical Partner discontinuada | contrato `:534-536` |
  | E18 | sucesión trabada: emite sólo la sucesora | contrato `:461-465` |
  | E19 | revocado por el admin, con la fuente viva | código de hoy, `get-by-slug.ts:25` |

- **Superficie**: página visible, respuesta HTTP y carrusel. Las dos primeras son una sola columna
  (página visible ⇔ 200; no visible ⇔ 404).

**Tamaño: 19 × 2 = 38 casos, 76 celdas.** Casos ya probados por los hallazgos: E8 y E16 (el Gold que
deja de pagar y el que baja a Silver). Sin mirar hasta hoy: los otros 36, y la columna del carrusel
entera.

### 2.3 Los caminos reejecutados

#### `F-8CA1-005` — la presencia sin ciclo de publicación

Pasos de `A1-acceso-cruzado-y-autorizacion.md:301-306`.

1. *Partner Gold con pago manual; el admin confirma que no pagó y pasa a `SUSPENDED`.* — Alcanzable.
2. *«Ninguna transición de ninguna máquina tiene la presencia como sujeto.»* — Sigue siendo verdad,
   y ya no importa: la visibilidad dejó de ser un estado. `SUSPENDED` no emite (contrato `:413`, *«|
   `SUSPENDED` | **no** |»*), y la transición invalida la entrada (`V/02:473`, *«| toda transición
   de la máquina de suscripción | `ACTIVE`, `SUSPENDED` y `PAUSED` otorgan cosas distintas |»*).
3. *«La página sigue publicada. Lo mismo con un downgrade Gold → Silver.»* — **Acá se corta**: la
   próxima lectura resuelve el conjunto sin la clave y responde 404 (`V/18:112-114`). El downgrade
   es un cambio de plan, y también invalida (`V/02:472`, *«| cambio de plan o de ciclo | cambia la
   versión anclada |»*); la versión Silver no otorga la clave (`V/18:46`).

**Veredicto: DEJA DE LLEGAR.**

#### `F-8CA2-005` — un Gold que deja de pagar sigue publicado

Pasos de `A2-maquinas-carreras-y-huerfanos.md:272-276`.

1. y 2. *Gold publicado; `S4` → `S6` → `SUSPENDED`, o baja a Silver.* — Alcanzables.
3. *«El aviso dispara `PB2` sobre fichas; Juan no tiene fichas.»* — Verdad, e irrelevante.
4. *«Su página sigue pública … No hay transición que la baje ni estado al que bajarla.»* — **Se
   corta**: no hace falta ninguna de las dos (`V/18:132-134`, *«Lo que faltaba no era un estado: era
   que alguien la hiciera en la lectura»*). Si el aviso se perdiera, la red es el reconciliador
   (`V/03:887-892`), con hasta un día, declarado en `V/18:145-147`.

**Veredicto: DEJA DE LLEGAR.**

#### `F-8CA3-006` — sin entidad, sin máquina, sin reloj

Pasos de `A3-datos-migracion-y-acoplamiento.md:342-348`.

1. a 3. — Iguales al anterior; **se cortan en el 3** por la misma regla.
4. *«Nunca entra en el reloj del §25: no tiene `inactiva_desde`.»* — **Sigue siendo verdad**, pero
   ya no es un daño del camino principal: está declarado con su causa en `V/18:139-141`, *«**La
   presencia no tiene reloj de retención.** … La decisión dice que se conserva; hasta cuándo no.»*
   La entidad que falta en `V/02` §2.5 también está declarada, `V/18:142-144`.

**Veredicto: DEJA DE LLEGAR** (el daño —página pública sin pagar— no ocurre; el paso 4 queda como
borde declarado).

#### `F-8CA2-012` — `T7` y los partners del camino B

El informe no numera pasos; el camino es el de `A2-maquinas-carreras-y-huerfanos.md:549-553`: el día
del encendido, un partner del camino B no tiene el hecho que `T7` busca y queda en `PRE_TRIAL` sin
fila; si cancela y vuelve por postulación, `T1` le da un trial entero.

1. *El evento candidato es la aprobación de la postulación, y el camino B no pasa por ella.* — Sigue
   siendo verdad (`V/18:94-96`).
2. *El día del encendido queda en `PRE_TRIAL` sin fila.* — **Se corta en el procedimiento del
   encendido**: el paso 1 de `V/11-trial.md:417` exige ahora que *«**la declaración tiene que decir
   también qué cuenta como «ya ejerció» para un partner dado de alta por el camino B** … sin eso
   `T7` no lo alcanza»*, y `V/11:419` hace de los tres pasos *«**un solo acto**»*. Hoy además no
   puede ocurrir: los días de trial de Partner están en cero (`V/18:96-98`, *«**Hoy no cambia
   nada**»*).

**Veredicto: DEJA DE LLEGAR**, por un paso escrito del procedimiento, no por un guard. **Cuál** es el
hecho para el camino B queda diferido al día del encendido, y está declarado en
`V/18-partner.md:247-251` y `V/11-trial.md:474-477`.

#### `F-8CA1-014` — el 410 contra la indistinguibilidad

El hallazgo es una contradicción, no un camino con pasos: la ruta de hoy responde 410 al partner
revocado y `V/17` precisión 1 exige que ajeno, archivado e inexistente sean indistinguibles.

1. **La contradicción se corta**: `V/18:120-122`, *«**404 y no otra respuesta** … El código de hoy
   responde 410 al partner revocado, y la migración lo cambia»*, y `V/21-migracion.md:275-281`, *«la
   migración lo cambia a 404»*.
2. **Pero reejecutar el escenario —«un partner que el admin revocó»— sobre el diseño nuevo llega a
   otra cosa.** El diseño no tiene ningún concepto de revocación: la página se ve *«mientras exista
   el entitlement»*. Un partner revocado **que sigue pagando** conserva la clave y la lectura
   responde **200**. Hoy eso no pasa, a propósito:
   `packages/service-core/src/services/partner/partner.service.ts:836-838` dice que la revocación
   deja `subscriptionStatus` quieto porque *«writing it here would conflate "we took them down" with
   "they stopped paying"»*. El diseño nuevo hace exactamente esa fusión: la única manera de bajar la
   página es quitar la fuente.

**Veredicto: LLEGA A OTRA COSA** — el 410 se resolvió; la bajada deliberada del admin se perdió. Va
como **owner 3** (§3.1).

### 2.4 El dominio recorrido

La columna «página / HTTP» sale de la regla (`V/18:112-114`) aplicada al estado; la columna
«carrusel», de buscar una regla que lo gobierne.

| id | Gold · página / HTTP | Silver · página / HTTP | carrusel (los dos tiers) |
|---|---|---|---|
| E1 | 404 ✔ (`BASE` no otorga clave comercial, `G-R3` *a*, `V/20:59`) | 404 ✔ | sin regla |
| E2 | 404 ✔ (no emite, contrato `:418`) | 404 ✔ | sin regla |
| E3 | 404 ✔ | 404 ✔ | sin regla |
| E4 | 200 ✔ | 404 ✔ (Silver no tiene la clave) | sin regla |
| E5 | 200 ✔ (*«servicio entero»*, `:410`) | 404 ✔ | sin regla |
| E6 | 404 ✔ (*«el servicio está detenido»*, `:411`) | 404 ✔ | sin regla |
| E7 | 200 ✔ (emite `CORTESÍA`, `:412`) | 404 ✔ | sin regla |
| E8 | 404 ✔ (camino de `F-8CA1-005`) | 404 ✔ | sin regla |
| E9 | 200 ✔ (emite hasta la fecha, `:414`) | 404 ✔ | sin regla |
| E10 | 404 con hasta un día de atraso — **borde declarado** (`V/18:126-130`, `:145-147`) | 404 ✔ | sin regla |
| E11 | 404 ✔ | 404 ✔ | sin regla |
| E12 | 404 ✔ | 404 ✔ | sin regla |
| E13 | 200 ✔ | 404 ✔ | sin regla |
| E14 | 404 ✔ (revocar invalida, `V/02:475`) | 404 ✔ | sin regla |
| E15 | 200 ✔ (emite la predecesora, contrato `:428-430`) | 404 ✔ | sin regla |
| E16 | Gold→Silver: 404 ✔ | Silver→Gold: 200 ✔ (*«reaparece sola»*, `V/18:118-119`) | sin regla |
| E17 | 404 con hasta un día — **borde declarado** (contrato `:574-578`; `V/18:145-147`) | 404 ✔ | sin regla |
| E18 | según el tier de la sucesora ✔ | según el tier de la sucesora ✔ | sin regla |
| E19 | **200 — owner 3** | 404 ✔ (no tiene página) | sin regla |

Recuento con script (`r13.tsv`, `count.py` en el scratchpad): **38 casos. Página / HTTP: 35 ✔, 2 borde
declarado, 1 al owner. Carrusel: 38 de 38 sin regla.**

**Transversal a toda fila con 200 → 404**: entre la invalidación del caché de entitlements y la
respuesta que ve el visitante hay **otro caché**, el del borde. La página se sirve con
`cacheClass: 'detail'` (`apps/web/src/pages/[lang]/partners/[slug].astro:96`), que es
`{ sMaxAge: 3_600, swr: 3_600 }` (`apps/web/src/lib/cache/cache-classes.ts:101`), y sólo la purga
*«A write to THIS partner»* (`[slug].astro:81`). Desde `V/18:116-117` no hay escritura: *«lo único
que cambia es la respuesta de la lectura»*. Va como borde sin declarar (§3.2, B3).

---

## 3. Residuos

### 3.1 Al owner

#### Owner 1 · La precisión 6 dice «sobre una ficha», y hay dos recursos más con vertical

**Ejemplo.** Juan tiene Alojamiento Premium y es Partner Gold.

- **Cambiar la vertical de la ficha.** Crea una ficha en Alojamiento, la publica (pasa contra
  Alojamiento, donde paga) y después la edita cambiándole la vertical a Gastronomía. La edición lee
  la vertical de la ficha **antes** del cambio —Alojamiento—, así que pasa. Queda una ficha de
  Gastronomía publicada sin cobertura en Gastronomía. `V/02:330` guarda `vertical` sin ninguna
  restricción de inmutabilidad; `rg -i "inmutable|cambiar(la)? de vertical|mover(la)? de vertical"`
  sobre `V/`, `N/` y el contrato: la única «inmutable» es de versiones de plan y addon
  (`V/02:48`, `:52`). **La red es el reconciliador**: al día siguiente encuentra `cubierto` falso con
  una ficha publicada y corre `PB2` (`V/03:904`). Cuesta hasta un día por ficha, y se repite con
  cada ficha nueva.
- **Editar la presencia.** Juan sube fotos a su página de Partner **declarando Alojamiento**. La
  precisión 6 no la alcanza (es *«sobre una ficha»*) y `G2` mitad *(b)* tampoco. El paso 7 cuenta el
  cupo de fotos contra Alojamiento: sube las que su plan de Alojamiento permite, no las de Gold.
  `V/17:230-231` nombra justo esta operación como *«edita su presencia de partner»*.
- **Subir una foto** es cubierto sólo si se lee como operación *«sobre la ficha»*; si se modela
  como operación sobre un recurso `foto`, `G2` (*b*) no la ve y queda el mismo cruce de cupo.

**Qué toca**: acceso (publicar sin cobertura, cupo de otra vertical). No es camino principal —es un
abuso—, pero da acceso indebido, y por eso no entra en la definición de borde de `DEC-METH-015`.

**Opciones:**

1. **Generalizar la precisión 6 a «todo recurso que guarda su vertical»** (ficha y su contenido,
   presencia de Partner, instancia de addon) **y declarar `listing.vertical` inmutable desde el
   alta**, con una tercera mitad de `G2`: *«una operación escribe la vertical de un recurso que ya
   existe»*. Costo: una frase en `V/17` §1.2, una restricción en `V/02` §2.5 y una fila más en el
   guard. Riesgo: ninguno conocido; hoy las verticales son tablas separadas en el código, así que
   cambiar de vertical no es un comportamiento que exista.
2. **Sólo la inmutabilidad**, dejando la presencia afuera. Cierra el caso caro (publicar gratis) y
   deja el cruce de cupo de la presencia, que es chico y administrado.
3. **Declararlo** en el «NO cierra» de `V/17`, con el reconciliador como red de la ficha.

**Recomiendo la 1**: es la misma regla con el alcance que su propio §2.4 ya le da (*«toda operación
tiene vertical»*), y deja la vertical como dato de la base, que es el escalón que `V/17:27-32` pone
primero.

#### Owner 2 · El carrusel no tiene regla

**Ejemplo.** Pedro es Partner Silver: lo único que compra es su logo en el carrusel de la home
(`HOS-294-partners-ficha-propia/spec.md:30-31`). Deja de pagar y pasa a `SUSPENDED`. El diseño no
dice qué lee el carrusel: `rg -n -i "carrusel|carousel"` sobre `V/`, `B/`, `N/`, el contrato, el log
y el PDR del programa da **cero resultados**. `V/18:43-46` dice *«| los demás | no |»* de
*«presencia pública»*, lo que leído a la letra saca a Silver del carrusel **también cuando paga**, o
—si se lee como «página propia»— lo deja sin regla. Es el defecto original de R13 (una presencia
pública sin quien la retire) sobre la otra superficie, y ocurre en el camino principal: dejar de
pagar. Hoy el código lo resuelve con estado local (`partner.service.ts:532-534`, *«the same pair
`PartnerModel.findByFilters` forces on the carousel»*), que el diseño nuevo no hereda.

**Opciones:**

1. **Extender la regla del §1.6 al carrusel con una clave propia**: el carrusel lista a quien tiene
   hoy la clave *«presencia en el carrusel»* (la otorgan Gold y Silver), leída del mismo caché, con
   el mismo reconciliador. Costo: una clave de clase `COMERCIAL` en el catálogo, una fila en la tabla
   de `V/18:43-46`, y la población del reconciliador pasa a ser *«todo `user + Partner` con una clave
   de presencia»*. Riesgo: bajo; es la misma mecánica que ya se aceptó para la página.
2. **El carrusel lista a quien está `cubierto` en Partner.** Sin clave nueva, pero ata la superficie
   a la cobertura y no a lo que se vende: un plan de Partner sin carrusel, o un addon que lo agregue,
   quedarían inexpresables.
3. **Declararlo** como diseño de producto de `V/19`.

**Recomiendo la 1**: es la forma que `V/18` §1.2 ya eligió para la página (*«una capacidad que se
tiene o no se tiene»*), y el carrusel es exactamente eso.

#### Owner 3 · Sin máquina, la bajada deliberada del admin no tiene dónde vivir

**Ejemplo.** Ana es Partner Gold al día. El admin decide bajar su página por contenido inadecuado.
Hoy lo hace revocándola (`partner.service.ts:880-887`: `lifecycleState: INACTIVE`, `revokedAt`,
`revokeReason`) sin tocar su cobro. En el diseño nuevo la página se ve *«mientras exista el
entitlement»* y no hay ningún estado que el admin pueda escribir: para bajarla tiene que **cancelarle
la suscripción**, o sea mover plata para hacer moderación. Para las fichas el mismo hueco se cerró
con `MODERATED` (`V/03:447`, `PB10`), y la presencia quedó afuera. `V/21:281` dice que con el 410
*«Lo que se pierde … es esa señal de desindexación»*: se pierde además la revocación misma.

**Opciones:**

1. **Un bit de moderación de la presencia, escrito sólo por la 13.ª acción administrativa** (la
   misma de `PB10`, `V/17:262-263`), y la lectura pasa a ser *«tiene la clave **y** no está
   moderada»*. Sigue sin haber máquina: es una condición más en la lectura. Costo: una columna en la
   entidad que `V/18` ⚠️ 2 ya pide declarar, una frase en §1.6 y una en `V/21` §4. Riesgo: bajo.
2. **La bajada del admin es cancelar la suscripción.** Sin nada nuevo, pero funde moderación con
   cobranza, que es lo que el código de hoy evita a propósito.
3. **Declararlo** en el ⚠️ del §1.6.

**Recomiendo la 1**: mantiene la decisión del owner (*«sin máquina»*) y reusa la acción que ya
existe para las fichas. Hoy Partner tiene cero filas (`D/07-facts-inventory.md:110`, citado en `A3-…:374-375`), así que no hay nada que migrar.

### 3.2 De borde

| # | residuo | ¿declarado? | dónde / texto propuesto |
|---|---|---|---|
| B1 | **La presencia no tiene reloj de retención** (paso 4 de `F-8CA3-006`) | **sí** | `V/18-partner.md:139-141` |
| B2 | **Hasta un día de página visible** si el aviso se pierde o la fuente vence por fecha (E10, E17) | **sí** | `V/18-partner.md:145-147`; `V/03:949-951` |
| B3 | **El caché del borde agrega hasta ~2 h** a toda bajada: `s-maxage` 1 h más `stale-while-revalidate` 1 h (`cache-classes.ts:101`), y ninguna escritura lo purga porque desde §1.6 no hay escritura | **no**: `rg -n -i "revalid\|CDN\|cloudflare\|borde"` sobre `V/18`, `V/19`, `V/02` da cero resultados sobre esto | **Propuesto**, como punto 4 del ⚠️ de `V/18` §1.6: *«4. **El caché de la respuesta, no el de entitlements.** La página pública se sirve desde el caché del borde, y la invalidación de este § vacía el del conjunto efectivo, no ése. Como no hay escritura que dispare una purga, la bajada se ve con hasta la duración de su clase de caché de atraso (hoy ~2 h), además del día del punto 3. Causa: la regla cambia la respuesta y no escribe nada. No mueve plata, no da acceso a ninguna persona y no borra nada.»* |
| B4 | **Nadie le avisa al partner que su página dejó de verse**, ni que el contenido se conserva y vuelve sola. `V/19` §4 tiene la fila 18 para la ficha archivada y ninguna para la presencia | **no**: `rg -n -i "partner\|presencia" V/19-superficies.md` da sólo `:75` (postulaciones) y `:81-86` (el NO cierra) | **Propuesto**, como fila 22 de `V/19` §4: *«\| 22 \| Mi Cuenta de Partner, cuando la página deja de verse \| **que no se borró nada**, que la página **vuelve sola** si recupera el plan que la otorga, y que mientras tanto responde como inexistente \| cap. 18 §1.6 (épica de verticales); FASE 9 completa, `R13` \|»* |

### 3.3 Contradicciones de texto

1. **El contrato conserva la frase que `V/17` tachó.** Contrato `:102-104`: *«con la vertical
   **obligatoria en la firma** — no opcional, no deducible del recurso. Es la misma forma estructural
   que el capítulo 17 §2.2 le dio a toda operación de dominio»*. `V/17:177` tachó justamente *«~~ni
   un valor que se deduzca del recurso~~»*, así que el contrato cita al §2.2 con su lectura vieja.
   **Corrección propuesta**: *«con la vertical **obligatoria en la firma** — no opcional. Es la misma
   forma estructural que el capítulo 17 §2.2 le dio a toda operación de dominio; y cuando la
   operación es sobre una ficha, quien pregunta le pasa la vertical **leída de la ficha** (cap. 17
   §1.2, precisión 6)»*. (Grep: `rg -n -U -i "dedu(zca|cible|ce|cir)[^.]{0,30}\s*recurso"` sobre `N/`,
   el contrato, el log, el handoff, `V/` y `B/`: sólo ésta sobrevive sin tachar.)
2. **`DEC-ARCH-009` quedó más angosto que su aplicación.** `D/01-decision-log.md:5268-5269`: *«Una
   vez por día, para cada dueño con fichas que no estén en `DRAFT` ni `PURGED`»*. `V/03:882` agregó
   `MODERATED` y `V/03:887` agregó *«todo `user + Partner` con presencia cargada, que no tiene
   fichas»*. **Corrección propuesta**: una línea *«**Precisada** (2026-09-25): la población excluye
   también `MODERATED` (`F-8CA2-004`) e incluye a todo `user + Partner` con presencia cargada, sobre
   el que no corre transiciones: compara el entitlement de presencia y, si difiere, invalida (`R13`,
   `V/03` §9, `V/18` §1.6)»* bajo la decisión, y sumar `DEC-ARCH-009` a la lista de precisadas del
   consolidado.
3. **`V/18` ⚠️ 2 dice que la entidad no hace falta, y el reconciliador la usa.** `V/18:143-144`: *«La
   regla de arriba no la necesita —lee el entitlement, no el contenido—»*. Pero la población del
   reconciliador se define por ella: `V/03:887`, *«con presencia cargada»*, y lo mismo el contrato
   `:809` y `V/02:482`. Sin entidad declarada, *«cargada»* no tiene con qué contarse. **Corrección
   propuesta** en `V/18:143-144`: *«La regla de la lectura no la necesita —lee el entitlement—, **pero
   la población del reconciliador sí** (*«con presencia cargada»*, cap. 03 §9): hasta que la entidad
   se declare, esa población se lee como *«todo `user + Partner` con una fuente que alguna vez otorgó
   la clave»*»*, o, más simple, cambiar en las tres citas *«con presencia cargada»* por *«con una
   suscripción, cortesía o grant en Partner que no esté terminal»*.

---

## 4. Lo que pide el owner, en una línea cada uno

1. **Owner 1**: ¿la vertical se lee del recurso para todo recurso con vertical (ficha, contenido,
   presencia) y `listing.vertical` es inmutable? Recomendado: sí a las dos.
2. **Owner 2**: ¿el carrusel se gobierna con una clave propia, igual que la página? Recomendado: sí.
3. **Owner 3**: ¿la presencia lleva un bit de moderación que escribe la 13.ª acción? Recomendado: sí.

---

> **Caducada en todo o en parte por la revisión del owner, 2026-09-28 (ver `30-revision-del-owner/14-` §4).** `F-8CA2-012`, en lo que pedía del encendido de Partner: encender o apagar la prueba de una
> vertical queda fuera de esta versión y `T7` salió (N7, `DEC-TRIAL-003`). Punto 39 de [`14-aplicacion-transversal-y-lote.md`](../30-revision-del-owner/14-aplicacion-transversal-y-lote.md) §4.4, que lo
> agrupa bajo la FASE 9 vuelta 2; su registro es éste.
