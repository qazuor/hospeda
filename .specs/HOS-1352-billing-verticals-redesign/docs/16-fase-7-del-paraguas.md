---
title: "FASE 7 del paraguas — la estrategia de despliegue que ninguna épica tiene"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-25
status: CURRENT
fase: 7
---

# 16 · La FASE 7 del paraguas

> **Este documento es del paraguas, no de una épica**, igual que
> [`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md). Y por la misma razón: lo que
> describe **no le pertenece a ninguna de las dos**.

**Está escrito qué tiene que contestar, quién lo escribe y para cuándo** — que es lo que faltaba, y
lo que hacía que seis de los diez ítems del §65 no fueran de nadie. ~~**De su contenido hay un ítem
resuelto**, el orden del corte (§4); los otros cinco siguen pendientes.~~ **De su contenido hay dos
ítems resueltos**: el orden del corte (§4) y el rollback, que el owner decidió que **no existe
pasado el paso 3** (§4.3; owner 2026-09-25; FASE 9 completa, `2c`). Los otros cuatro siguen
pendientes.

---

## 1. El hueco, y por qué no se cerraba solo

`DEC-ARCH-007` partió la FASE 7 **por épica**. El problema es que **ninguna de las dos épicas
despliega**: la unidad que llega a `staging` es **el paraguas**, y el paraguas **no tenía fase que
se la escribiera**.

De los diez ítems que el §65 pide para la FASE 7, cuatro encontraron dónde vivir y **seis
quedaron huérfanos**:

| ítem del §65 | dónde vive hoy |
|---|---|
| implementation order · dependency graph | la `descomposicion.md` de cada épica |
| migration | los dos `21-migracion.md` — y desde la decisión de no migrar, **casi sin sujeto** |
| observability | `NUCLEO/08` |
| **rollout** | — |
| **coexistence** | — |
| **staging** | **el §4**, en lo que hace al orden del corte |
| **feature flags** | — |
| **rollback** | ~~—~~ **el §4.3**: sólo hacia adelante pasado el paso 3; antes, la rama de aborto del §4.2 (owner 2026-09-25; FASE 9 completa, `2c`) |
| **acceptance gates** | — |

Cuatro de los seis tienen **cero apariciones en todo el diseño del programa**: `rollout`,
`coexistence`, `feature flags` y `rollback`.

**Por qué no alcanza con que cada épica escriba la suya y después se junten**: es lo que ya pasó y
es lo que produjo el hueco. **Dos mitades que no despliegan no suman una estrategia de
despliegue.**

---

## 2. El momento, y no es una preferencia

> **Se escribe ANTES de que nazca la rama del paraguas.**

La rama todavía no existe —`git ls-remote` devuelve cero— y el desarrollo arranca en días. Después
de que nazca, **la estrategia de despliegue se escribe con código adentro**, que es exactamente la
posición desde la cual una decisión de rollback deja de ser una decisión y pasa a ser una
descripción de lo que ya se hizo.

---

## 3. El rollback es un ítem de esta fase, no una tarea aparte

Están juntos a propósito: **el rollback es uno de los seis ítems huérfanos**. Decidir quién
escribe la FASE 7 del paraguas **es** decidir quién escribe el rollback; separarlos lo deja como
una tarea suelta que nadie toma — que es exactamente su estado hasta ahora, con **la palabra
«rollback» sin aparecer en un solo documento de diseño del programa**.

> ⚠️ **Salvedad aceptada de antemano, y es el resultado más valioso posible.** Puede que la
> conclusión honesta sea **que no hay vuelta atrás**. Reemplazar el sistema de cobro no es revertir
> un deploy: si el corte se hizo y hay gente suscripta en el sistema nuevo, volver al viejo
> significa **deshacer compromisos reales con un proveedor externo**.
>
> Si la respuesta es *«no se puede volver, y el punto de no retorno es éste»*, **eso no es un
> fracaso del documento**. Saber dónde está el punto de no retorno y decidir con eso a la vista es
> mucho mejor que **descubrirlo cruzándolo**.

**Y ésa fue la conclusión** (owner 2026-09-25; FASE 9 completa, `2c`): pasado el paso 3 del corte
**sólo se arregla hacia adelante** — *«no va a pasar»*. Antes del paso 3 lo que existe es la rama
de aborto del §4.2, que restaura el backup. El detalle está en el §4.3.

**Lo que este rollback NO es**: el rollback de las ocho filas de la cartera actual. Ése
desapareció con su sujeto cuando se decidió no migrar (los dos `21-migracion.md` §2). El de acá es
el del **programa**, y es de otro tamaño.

---

## 4. El primer ítem escrito: el orden del corte

De los seis huérfanos, éste se escribe ahora porque **su ausencia tiene un costo concreto y
fechado**, no porque sea el más fácil.

### 4.1 El punto de no retorno no desapareció: subió de escala

Decidir que **no se migra** eliminó el punto de no retorno **por fila** —ya no hay ocho
transcripciones que puedan quedar a medias— y **dejó intacto el del programa**, que es el que
importa:

> **Una autorización viva cobra DESPUÉS del despliegue que borró el código capaz de reconocerla.**
> La persona paga, el dinero entra, y del lado de Hospeda **no queda ni servicio ni asiento
> contable**: el sistema que sabía qué era ese identificador ya no existe, y el nuevo nunca lo
> conoció.

Son **tres** las que pueden hacerlo **según nuestra base** —las únicas con preapproval vivo en ella—,
y el hecho de que sean pocas no cambia nada: **un cobro que entra sin asiento no es un problema de
escala.** ⚠️ **Y la base no las ve todas**: el 2026-09-24 el recorrido del proveedor encontró una
cuarta autorización viva que la base no conocía (§4.2), por eso el censo del paso 1b sale del
proveedor.

### 4.2 El orden, y no es una preferencia

| # | paso | quién lo hace | por qué en ese lugar |
|---|---|---|---|
| 0 | **el despliegue, ensayado en staging y verde** | — | lo irreversible (paso 1) sólo arranca cuando lo que puede fallar (paso 3) ya se probó (FASE 8 completa, `F-8CC2-004`) |
| 1a | **cancelar los `preapproval_plan` viejos**, tomados, como los del 1b, **del proveedor** —todo `preapproval_plan` de la cuenta que no esté `cancelled`— y no de `billing_mp_plan` (FASE 9 completa, `DB-3`) | el sistema **viejo** o una llamada verificada | cierra los links públicos que siguen vendiendo; **es reversible** (sonda 50) y por eso va primero |
| 1b | **cancelar TODOS los preapprovals vivos de la cuenta ~~que no sean sondas~~**, **incluidas las sondas salvo las enumeradas abajo** (FASE 9 completa, `DB-1`), tomados del **recorrido sin filtro del proveedor** y no de nuestra base. *«Vivo»* es **todo estado releído distinto de `cancelled`**: `pending`, `authorized` y `paused` (FASE 9 completa, `DB-2`) | el sistema **viejo**, que todavía corre | es el único que sabe hacerlo; después del despliegue ese código no existe. El censo sale del proveedor porque la base no ve las autorizaciones que nunca se vincularon (`F-8CC2-002`, `F-8CB3-001`) |
| 2 | **verificar releyendo cada uno por su id** y confirmar que quedó `cancelled`. **Y verificar que el recorrido fue completo**: el conteo del recorrido tiene que igualar el `total` del paginado, y **todo id conocido** —los de la base y los de los manifiestos de sonda— tiene que aparecer en él; si no, el corte no avanza (owner 2026-09-25; FASE 9 completa, `2f`) | ídem | `D5` ya lo exige para toda mutación, y `RC-2` mide que leer por id es confiable — **buscar no** (`RC-1`). La completitud del recorrido sin filtro no es fila de la matriz: este control la vuelve condición del gate en vez de premisa |
| 2b | **backup de la base** | — | es lo que restaura la rama de aborto si el paso 3 falla con algo ya escrito (owner 2026-09-25; FASE 9 completa, `2e`) |
| 3 | **desplegar** | — | recién acá, y sólo si el paso 2 cerró |
| 3b | **escribir los dos `permanent_grant`** de las cortesías del owner (`B/21` §2.4) | el sistema **nuevo** | antes del paso 4, para que esas dos cuentas no pasen por `cubierto` falso (`V/21` §2.4, punto 3; FASE 9 completa, `DB-7`) |
| 4 | **sembrar las lápidas** (`B/21` §2.5) con los ids cancelados | el sistema **nuevo** | la fila es del esquema nuevo: no puede existir antes del paso 3 |

**Las sondas también se cancelan en el paso 1b**, salvo las que tengan una medición abierta el día
del corte, que se enumeran por id en un manifiesto versionado en `mp-probes/` (declarado por
`DEC-METH-015`, FASE 9 completa, `DB-1`). **Causa**: toda sonda viva que cobre después del corte
llega como desconocida. Las enumeradas cobran la tarjeta del owner y caen en la marca por la
precondición de re-vinculación (`B/21` §2.5; owner 2026-09-25, FASE 9 completa, `2b`).

**Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons**: se
apagan antes de desplegar y se verifica como parte del paso (declarado por `DEC-METH-015`, FASE 9
completa, `DB-5`). **Causa**: el handler viejo confirma como procesado el evento de un preapproval
que no conoce (`local_row_not_found`), y MercadoPago no reintenta. Si no se apaga, el cliente que
contrata en esa ventana espera hasta el barrido diario.

**El paso 2 es el gate, y es lo único que vuelve segura la secuencia**: si algún plan o preapproval
**no se pudo cancelar**, el corte **no avanza**. Es la misma forma que el programa ya usa en todas
partes —verificar releyendo en vez de creerle al código de estado— aplicada al único momento donde
no hay vuelta atrás.

**La ventana entre el paso 1 y el paso 3 es la parte incómoda, y se declara**: durante ese rato el
sistema viejo sigue corriendo con ~~tres suscripciones canceladas. Si entra un cobro en vuelo, **lo
registra el viejo**~~ **las suscripciones del censo canceladas. Si entra un cobro en vuelo de una que
la base conoce, lo registra el viejo; si es de una que sólo estaba en el proveedor, el viejo no la
reconoce y la recoge, después del paso 4, la marca de la re-vinculación** (`B/21` §2.5; FASE 9
completa, `CT-3`), que es exactamente lo que queremos — sigue existiendo el lugar donde anotarlo.
Al revés, con el despliegue primero, ese mismo cobro cae en el vacío. *(Lo que el viejo anote en
esta ventana no se conserva después del corte: owner 2026-09-25, FASE 9 completa, `2a`; `B/21` §4.)*

**Por qué no cancelar después de desplegar**, que es el orden intuitivo: el código que sabe cancelar
esos preapprovals **se va con el despliegue**. Cancelarlos después exige hacerlo a mano contra la
API del proveedor, sin idempotencia, sin registro y sin nadie que verifique — y es el caso que este
§ existe para evitar.

~~**El paso 4 es la única escritura del corte, y es a mano.**~~ **El paso 4 es la única escritura
a mano del corte. Las otras dos —`inactiva_desde` en toda ficha preexistente (`V/21` §2.4) y los
dos `permanent_grant` del paso 3b— las hace el sistema nuevo en el paso 3** (FASE 9 completa,
`CT-1`). **El corte no escribe filas de `trial`**: los clientes actuales se tratan como nuevos
(owner 2026-09-25; FASE 9 completa, `2g`; `V/21` §2.4). Las lápidas hacen **reconocible** un
cobro viejo que llegue tarde, que es lo único que ninguna llamada puede evitar. Se escriben sobre
una lista conocida, en la misma tanda en la que se habla con la gente.

**Y hay un quinto acto que no es del sistema: las llamadas.** Las fichas publicadas de Alojamiento
~~**se despublican la mañana del corte**~~ **las despublica la primera corrida del reconciliador
diario de cobertura, dentro del primer día**: el corte no es un cambio de `cubierto` (no hay valor
anterior), así que `PB2` no dispara por evento (`V/03` §9, `DEC-ARCH-009`; FASE 9 completa, `C-7`)
—es una consecuencia, no una falla (`V/21` §2.4)— y vuelven solas cuando cada dueño contrata. **El aviso va ANTES del paso 1**, no después: es lo único que
acota cuánto tiempo queda abajo cada ficha. Las dos escriben filas del
esquema nuevo, así que **las dos van después de desplegar** — y por eso el paso 3 no es el final
del corte, aunque lo parezca.

**Por qué el censo sale del proveedor, y no es una hipótesis.** El 2026-09-24 el recorrido sin
filtro de los 108 preapprovals de la cuenta encontró una autorización viva, del propio owner, que
la base no conocía: `f6d89f71…`, creada desde el link del plan Basic, con un cobro de ARS 18.000
vencido esa misma noche. Se canceló antes de que cobrara (`25-fase-8-completa/00-hallazgos.md`
§4). Con el censo de la base, ese preapproval **sobrevivía al corte y cobraba**. Y los cinco planes
viejos seguían `active` con su link vendiendo, medido en el navegador.

**Y el orden no se invierte, aunque el paso 1 sea irreversible.** La FASE 8 completa señaló
(`F-8CC2-004`) que lo irreversible va antes de lo que puede fallar. El remedio no es cancelar al
final, porque eso reabre la razón de arriba: el código que sabe cancelar se va con el despliegue.
El remedio es el **paso 0** y una rama de aborto declarada.

~~**La rama de aborto: si el paso 3 falla después del paso 1.**~~ **La rama de aborto: si algo
falla después del paso 1b** —un preapproval que el paso 2 no ve `cancelled` después de reintentar
la cancelación, un recorrido que el control del paso 2 no da por completo, o el paso 3— (FASE 9
completa, `DB-4`).

1. Se **reactivan los planes** del paso 1a. La sonda 50 midió que un plan cancelado vuelve a
   `active` con un `PUT` y conserva su `init_point`. **Que el link vuelva a vender no se abrió en el
   navegador**: se verifica en el ensayo del paso 0.
2. El sistema viejo **sigue corriendo**: ~~no se desplegó nada.~~ **si el paso 3 alcanzó a escribir
   algo —la migración estructural, `inactiva_desde`, los dos grants—, se restaura el backup del paso
   2b**, y el viejo vuelve a correr sobre su propio esquema (owner 2026-09-25; FASE 9 completa,
   `2e`). Así el reintento del corte escribe `inactiva_desde` con **su** instante, y la regla de
   *«una sola vez»* de la escritura `C` (`NUCLEO/01` §1.2) vale por corte que **termina**. Lo que el
   viejo anotó entre el backup y la restauración se pierde, y no importa: tampoco se conserva
   después de un corte que sale bien (`2a`).
3. Los clientes cuyos preapprovals se cancelaron en el paso 1b **se re-suscriben por el link
   reactivado**. Ese acto no se puede deshacer (`PA-5`).
4. **El costo, declarado y aceptado por el owner el 2026-09-24**: al re-suscribirse al mismo plan,
   el proveedor **ya no les da el trial**, porque lo concede una vez por pagador y plan (medido en
   producción el 2026-08-31, `HOS-1012`; está en el `CLAUDE.md` del repo), así que les cobra en el
   acto. Con la cartera de hoy son tres clientes reales. ~~**Qué se hace con esa diferencia no está
   decidido.**~~ **La diferencia no se devuelve: quien se re-suscribe arranca un trial nuevo desde
   cero** (owner 2026-09-25; FASE 9 completa, `2d`) — en el sistema nuevo, cuando el corte termine,
   porque ahí los clientes actuales se tratan como nuevos (`2g`, `V/21` §2.4).

### 4.3 Lo que este orden NO resuelve

**Qué pasa si el corte hay que revertirlo después del paso 3.** Eso es el rollback del programa,
es el §3, ~~y sigue sin escribirse~~. Lo que este § agrega es que **el punto de no retorno ahora tiene
una ubicación declarada: está entre el paso 2 y el paso 3.**

**Y la decisión está tomada: pasado el paso 3, sólo hacia adelante** (owner 2026-09-25; FASE 9
completa, `2c`: *«no va a pasar»*). Un defecto grave después del paso 3 se arregla sobre el sistema
nuevo; no se vuelve a la imagen vieja ni se cancela en masa lo que creó el sistema nuevo. **Lo que
esto NO cierra**, declarado por `DEC-METH-015` (FASE 9 completa): un defecto grave pasado el paso 3
se arregla bajo presión, con clientes cobrando en el sistema nuevo. **Causa**: la alternativa
—rollback con cancelación masiva— cancela clientes nuevos cuyo trial el proveedor no repite
(`HOS-1012`), y el owner la descartó.

---

## 5. Lo que este documento todavía no contesta

~~**Cinco de los seis ítems huérfanos**, uno por uno — el sexto, `staging`, quedó escrito en el §4 en
lo que hace al orden del corte.~~ **Cuatro de los seis ítems huérfanos** —`rollout`, `coexistence`,
`feature flags` y `acceptance gates`—, uno por uno: `staging` quedó escrito en el §4 en lo que hace
al orden del corte, y `rollback` quedó decidido en el §4.3 (owner 2026-09-25; FASE 9 completa,
`2c`). Ésa es la FASE 7 del paraguas y es trabajo pendiente, con fecha
límite dada por el §2: **antes de que nazca la rama**.

**Una restricción que ya está fijada y lo acota**: `DEC-ARCH-007` decidió que **las dos épicas
llegan juntas**, así que la estrategia no tiene que resolver *«cómo sale una sola»* — no existe
ese caso, y la ausencia de una tercera implementación del contrato de cobertura
([`12-contrato-de-cobertura.md`](./12-contrato-de-cobertura.md) §5.3) descansa en lo mismo.
