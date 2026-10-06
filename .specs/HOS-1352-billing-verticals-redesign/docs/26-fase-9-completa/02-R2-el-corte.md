---
title: "FASE 9 completa · R2 — el corte ciego a lo que vive sólo en el proveedor"
linear: HOS-1352
statusSource: linear
created: 2026-09-25
updated: 2026-09-25
status: CURRENT
fase: 9
---

# FASE 9 completa · R2 — el corte

`DEC-METH-004` cierra un racimo con dos pruebas: el camino de cada hallazgo, reejecutado sobre el
texto **corregido**, ya no llega; y la regla corregida se sostiene sobre **todo** el dominio que
cuantifica. Acá están las dos pruebas para `R2`, más la verificación que pidió el orquestador sobre
las dos escrituras que el corte siembra por otros racimos (`R9`: `inactiva_desde`; `R12`: las filas
de `trial` consumidas).

**Este documento no edita nada.** Las correcciones se proponen con su texto; las aplica el
orquestador.

Abreviaturas de rutas: `D` es `HOS-1352-billing-verticals-redesign/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, `V` es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`,
`NUCLEO` es `D/nucleo/`. Toda cita se verificó contra el archivo el 2026-09-25.

**El resultado en una línea**: el arreglo cierra los dos críticos del proveedor (`F-8CC2-001`,
`F-8CC2-002`) y cambia el tercero de forma; **siete de los diez miembros siguen llegando**, porque
la precisión de `DEC-MIG-003` citó sólo cuatro de ellos y los otros seis no aparecen en ningún
capítulo (§3.0).

---

## 1. La regla corregida, como quedó escrita

`D/16-fase-7-del-paraguas.md:110-117`, la tabla del orden:

```text
| 0 | el despliegue, ensayado en staging y verde | — | lo irreversible (paso 1) sólo arranca cuando lo que puede fallar (paso 3) ya se probó
| 1a | cancelar los `preapproval_plan` viejos | el sistema viejo o una llamada verificada | cierra los links públicos que siguen vendiendo; es reversible (sonda 50) y por eso va primero
| 1b | cancelar TODOS los preapprovals vivos de la cuenta que no sean sondas, tomados del recorrido sin filtro del proveedor y no de nuestra base | el sistema viejo, que todavía corre | …
| 2 | verificar releyendo cada uno por su id y confirmar que quedó `cancelled` | ídem | …
| 3 | desplegar | — | recién acá, y sólo si el paso 2 cerró
| 4 | sembrar las lápidas (`B/21` §2.5) con los ids cancelados | el sistema nuevo | …
```

(Se quitaron los `**` de negrita del original para que la tabla entre en un bloque; el texto es el
de las líneas citadas.)

El gate, `D/16-fase-7-del-paraguas.md:119-120`:

> **El paso 2 es el gate, y es lo único que vuelve segura la secuencia**: si algún plan o preapproval
> **no se pudo cancelar**, el corte **no avanza**.

La rama de aborto, `D/16-fase-7-del-paraguas.md:157-169`:

> **La rama de aborto: si el paso 3 falla después del paso 1.**
>
> 1. Se **reactivan los planes** del paso 1a. […]
> 2. El sistema viejo **sigue corriendo**: no se desplegó nada.
> 3. Los clientes cuyos preapprovals se cancelaron en el paso 1b **se re-suscriben por el link
>    reactivado**. […]
> 4. **El costo, declarado y aceptado por el owner el 2026-09-24**: […] así que les cobra en el
>    acto. […] **Qué se hace con esa diferencia no está decidido.**

El registro, `D/01-decision-log.md:2585-2593` (`DEC-MIG-003`, 📌):

> **📌 Precisado el 2026-09-24, con OK del owner** (FASE 8 completa, racimo `R2`: `F-8CB3-001`,
> `F-8CC2-001`, `F-8CC2-002`, `F-8CC2-004`). **El orden de base no cambia.** Gana tres cosas:
> (1) un **paso 0** […]; (2) un **paso 1a** […]; (3) **el censo del paso 1 sale del recorrido sin
> filtro del proveedor**, no de nuestra base.

Y su eco en billing, `B/21-migracion.md:163-167`: *«**Cuáles son los saca el recorrido sin filtro
del proveedor, no nuestra base**, y antes se cancelan los `preapproval_plan` viejos para cerrar sus
links»*.

**La regla, en una frase**: antes de desplegar —con el despliegue ya ensayado—, el corte cancela en
el proveedor **todo lo que puede vender o cobrar a nombre de Hospeda**, tomado del proveedor y no de
la base, lo verifica releyendo por id, y si algo falla después de lo irreversible tiene una rama de
aborto.

---

## 2. El dominio

La regla cuantifica sobre tres ejes. Cada caso lleva su fuente.

### 2.1 Eje A · lo que vive en el proveedor y puede vender o cobrar

| id | caso | fuente |
|---|---|---|
| A1 | preapproval `authorized` con fila y con id en la base (las tres `trialing`) | `V/21-migracion.md:48` |
| A2 | preapproval `authorized` **sin id** en la base (Path C sin vincular; el caso real `f6d89f71…`) | `D/16…:145-149`; `F-8CC2-002` |
| A3 | preapproval de un checkout `reconcile_assisted` (cobro real sin vincular) | `F-8CB3-001` paso 2 |
| A4 | preapproval de **sonda** vivo en producción (el reloj, la sonda 49, los controles de `RN-3`) | `D/06-mp-validation-matrix.md:192`, `:430`; `D/03-handoff.md:102` |
| A5 | preapproval `pending`, que no vence nunca | `D/06…:314` (`EX-1`) |
| A6 | preapproval `paused` (por mora o por sonda) | `D/06…:430` (`RN-3`) |
| A7 | preapproval ya `cancelled` | `D/06…:274` (`RC-1`: los cuatro estados) |
| A8 | `preapproval_plan` viejo `active` (los cinco) | `D/06…:395` (`EX-40`) |
| A9 | `preapproval_plan` de la cuenta que no salió del sistema viejo (el de la sonda 50, cualquier otro) | `D/mp-probes/RESULTS-2026-09-24-sonda-50.md` |
| A10 | preapproval que **nacería** de un link viejo después del corte | `F-8CC2-001` |
| A11 | cobro en vuelo sobre un id cancelado en 1b **con** fila en la base | `B/21…:167-172` |
| A12 | cobro en vuelo sobre un id cancelado en 1b **sin** fila en la base | `D/16…:114` + `B/02-modelo-de-datos.md:47` |
| A13 | alta nueva de `DEC-MIG-002` durante el rediseño | `D/01-decision-log.md:2594-2598` |
| A14 | preapproval que crea el sistema **nuevo** mientras el contenedor viejo todavía atiende | `F-8CC2-005`; `B/05-idempotencia-y-concurrencia.md:47-48` |

### 2.2 Eje B · el momento del corte en que algo falla

| id | caso | fuente |
|---|---|---|
| B-a | falla el paso 0 (el ensayo) | `D/16…:112` |
| B-b | un plan del paso 1a no se cancela | `D/16…:119-120` |
| B-c | el paso 1b cancela una parte y otra no | `D/16…:119-120` |
| B-d | el paso 2 no ve `cancelled` en alguno | `D/16…:119-120` |
| B-e | falla la migración estructural del paso 3 | `D/16…:157-169`; `F-8CC2-004` paso 3 |
| B-f | el paso 3 falla **después** de aplicada la migración estructural (extras, datos, redeploy de una app) | `F-8CC2-004` (cita `docs/guides/migrations.md:193-195`) |
| B-g | el paso 3 sale bien, con la ventana de rollout de dos contenedores | `F-8CC2-005` |
| B-h | entre el paso 3 y el 4 (sin lápidas todavía) | `D/01…:2842` (`DEC-MIG-004` #15) |
| B-i | hay que volver atrás después del paso 3 | `D/16…:173-175` |

### 2.3 Eje C · lo que el corte escribe o deja atrás

| id | caso | fuente |
|---|---|---|
| C-1 | las lápidas | `D/16…:117`; `B/21…:160-161` |
| C-2 | los dos `permanent_grant` de las cortesías del owner | `B/21…:131`; `V/21…:108-113` |
| C-3 | `inactiva_desde` = instante del corte, en toda ficha preexistente (`R9`) | `V/21…:148-151`; `NUCLEO/01-glosario.md:59` |
| C-4 | la fila de `trial` consumida por dueño existente (`R12`) | `V/21…:209-211`, `:226-227` |
| C-5 | los pagos que el sistema viejo empieza a tener el 2026-09-26 | `B/21…:62-63`, `:80` |
| C-6 | las tablas y columnas viejas con datos (`billing_*`, `featured_by_entitlement`) | `F-8CC2-007` |

**Tamaño: 14 + 9 + 6 = 29 casos.**

---

## 3. Los caminos, reejecutados

### 3.0 Lo que el registro dice que se resolvió, y lo que no

La precisión de `DEC-MIG-003` nombra cuatro hallazgos (`D/01…:2585-2586`). Busqué los otros seis
en todo el diseño, fuera de los informes de la FASE 8:

```text
rg -n 'F-8CB3-008|F-8CC2-005|F-8CC2-007|F-8CC2-008|F-8CB3-014|F-8CA3-007' .specs \
   --glob '!**/25-fase-8-completa/[A-D]*'
```

Única aparición: `D/25-fase-8-completa/00-hallazgos.md:113-114`, la lista de miembros. **Ningún
capítulo ni entrada del log los cita.** Y los temas tampoco aparecen por palabra: `billing_payments`,
`tablas viejas`, `contenedor viejo`, `node-cron`, `featured_by`, `forward-fix` dan **cero** en
`D/16`, el log, el contrato, el núcleo y las dos épicas (conteo con `rg -c` sobre esos seis
lugares).

### 3.1 `F-8CC2-001` (CRÍT) · los planes viejos siguen vendiendo

1. Juan tiene la URL `…/subscriptions/checkout?preapproval_plan_id=…` en el historial. — Sin cambio.
2. Corte: *«el `preapproval_plan` no es una suscripción, así que ningún paso lo toca»*. **Corta
   acá.** `D/16…:113`: *«**cancelar los `preapproval_plan` viejos** […] cierra los links públicos
   que siguen vendiendo»*, y el gate los incluye: *«si algún plan o preapproval **no se pudo
   cancelar**, el corte **no avanza**»* (`:119-120`).
3. Juan abre la URL. `D/06…:395` (`EX-40`, `VERIFIED`, producción): *«el del plan cancelado
   muestra *«Este plan no está aceptando suscripciones»*»*. No nace ningún preapproval.
4. y 5. No ocurren.

**Veredicto: DEJA DE LLEGAR.** El agravante del trial horneado en el plan cae con el plan. Residuo:
de dónde sale la lista de planes del paso 1a no está escrito (caso A9, §5.2 `DB-3`).

### 3.2 `F-8CC2-002` (CRÍT) · el censo sale de la base

1. a 3. Ana autoriza, la fila no recibe el id, el reaper la marca `abandoned`. — Sin cambio.
4. El censo cuenta *«con compromiso»* como `mp_subscription_id IS NOT NULL`. **Corta acá.**
   `D/16…:114`: *«tomados del **recorrido sin filtro del proveedor** y no de nuestra base […]
   porque la base no ve las autorizaciones que nunca se vincularon (`F-8CC2-002`, `F-8CB3-001`)»*.
   Y no es hipótesis: `D/16…:145-149` registra el caso real `f6d89f71…`, encontrado por ese
   recorrido y cancelado antes de cobrar.
5. El preapproval de Ana aparece en el recorrido, se cancela en 1b y se relee en 2.
6. No cobra.

**Veredicto: DEJA DE LLEGAR**, bajo una premisa que la matriz no registra: que el recorrido sin
filtro sea completo (caso A2, §5.1 `AO-6`). Y queda una cola: si un cobro de Ana ya estaba en vuelo,
su lápida no tiene `user` que ponerle (caso A12, §5.1 `AO-2`).

### 3.3 `F-8CB3-001` (CRÍT) · el corte sólo cancela lo que conoce la base

1. Los planes venden por link. — Cortado por 1a (§3.1).
2. El inventario salió de `billing_subscriptions`: no ve planes, `reconcile_assisted` ni sondas.
   **Corta para planes y `reconcile_assisted`** (`D/16…:113-114`). **No corta para las sondas**:
   `D/16…:114` las excluye a propósito, *«cancelar TODOS los preapprovals vivos de la cuenta **que
   no sean sondas**»*, y ningún otro paso ni capítulo dice qué se hace con ellas (`rg -n -i sonda`
   sobre `D/16`, `B/09`, `B/21` y `B/02`: sólo `D/16…:114` y `:159`, y dos menciones de la sonda 49
   en `B/09` que hablan del grace).
3. Los planes no se desactivaban. — Cortado (`EX-40`).
4. *«Pasa lo mismo con un sujeto del reloj que alguien reactiva»*. **Sigue llegando**: los
   sujetos del reloj cobran hoy la tarjeta del owner (`D/06…:192`, `RN-2`: *«los cobros de los
   sujetos del reloj empezaron a volver `rejected/payment_method_not_ready`»*), y `RN-3` dejó uno reactivado a
   `authorized` y dos pausados como control (`D/06…:430`). Nada los cancela en el corte.
5. El webhook llega sin `notification_url` al receptor de la aplicación, como desconocido, y el
   único camino es re-vincular: `B/21…:169-172` sigue diciendo *«El candidato más plausible del
   emparejamiento es **la suscripción nueva de esa misma persona**»*.

**Veredicto: SIGUE LLEGANDO**, en la rama de las sondas. La plata es del owner (su tarjeta), así
que el residuo es de borde (§5.2 `DB-1`); la regla de re-vinculación que lo remata es de
`F-8CB3-008` y sí toca plata ajena (§5.1 `AO-2`).

### 3.4 `F-8CB3-008` · la re-vinculación no tiene regla ni precondición

1. Llega un webhook de un preapproval desconocido que apunta a Juan. — Sin cambio.
2. La re-vinculación le escribe un `provider_link`. `B/09-conciliacion.md:68-69`, **sin cambio**:
   *«Re-vincular una huérfana reescribiendo su `external_reference` **no cambia plata ni estado**:
   sólo dice de quién es.»* No dice contra qué fila ni con qué precondición.
3. `provider_link` sigue siendo único sólo por id del proveedor: `B/02…:51`,
   *«**`UNIQUE(proveedor, id_del_proveedo[r])`**»*.
4. Dos autorizaciones cobrando bajo una suscripción; el barrido lee cada id por separado y los dos
   coinciden (`B/09…:108`: compara el estado de cada fila contra *«el del proveedor, leído por id»*).

**Veredicto: SIGUE LLEGANDO.** Lo único que el arreglo de `R2` le quitó es población: con el censo
del proveedor y los planes cerrados, entran menos desconocidos. El mecanismo está intacto, y `B/21`
§2.5 lo sigue enunciando como el camino por defecto.

### 3.5 `F-8CB3-014` · el destino de las tablas de billing de hoy

1. `B/02` §4.1 obliga a conservar pagos. `B/02…:1096`: *«| **Se conserva íntegro, siempre** |
   pagos, reembolsos, comprobantes, el vínculo con el proveedor | los cuatro primeros son obligación
   legal y contable |»*. — Sin cambio.
2. El corte no escribe ninguna fila de pago en el modelo nuevo. — Sin cambio: el corte escribe
   lápidas, grants, `inactiva_desde` y filas de `trial` (§2.3), ningún `payment`.
3. Ningún capítulo dice qué pasa con `billing_payments`. — Sin cambio: cero apariciones (§3.0).
4. La premisa *«cero pagos»* caduca. `B/21…:221`, **sin cambio**: *«**Los pagos**: no hay
   ninguno.»*; y `B/21…:62-63` sigue diciendo que *«este hecho cambia solo — el 2026-09-26»*. El
   consolidado confirma el cobro: `D/25…/00-hallazgos.md:315-316`, *«La única que cobra el 26/09 es
   `ed00a8fd`»*.

**Veredicto: SIGUE LLEGANDO.** Pedía decisión del owner y no la tuvo (§5.1 `AO-1`).

### 3.6 `F-8CA3-007` · los cobros viejos no tienen dónde conservarse

1. El 2026-09-26 cobra una `trialing` bajo el sistema actual. — Ocurre mañana (§3.5 paso 4).
2. Entran altas nuevas cobradas. — `DEC-MIG-002` sigue vigente (`D/01…:2594`).
3. Corte: lápida sin pagos, `payment` vacío. — Sin cambio.
4. FASE 5 retira lo que cuelga de qzpay. — `DEC-METH-007` filtro 1 sin cambio.
5. Un contracargo pide el comprobante y no está. — Nada lo corta: `B/09…:730-732` sigue diciendo
   que el histórico *«es nuestro o no existe»*.

**Veredicto: SIGUE LLEGANDO.** Mismo residuo que §3.5 (`AO-1`).

### 3.7 `F-8CC2-004` · lo irreversible antes de lo que puede fallar

1. Paso 1: cancelar, irreversible (`PA-5`). **Cambia lo que va antes**: `D/16…:112` agrega el
   paso 0, *«el despliegue, ensayado en staging y verde»*. Baja la probabilidad; no la anula.
2. Paso 2 da verde. — Sin cambio.
3. Paso 3 falla en la migración estructural. **Ahora hay rama**: `D/16…:157-162`, se reactivan
   los planes y *«El sistema viejo **sigue corriendo**: no se desplegó nada»*.
4. Juan queda cancelado en el proveedor y en `trialing` en la base vieja. — Sin cambio; es la
   premisa de la rama.
5. Juan se re-suscribe por el mismo plan y le cobran en el acto. **Llega, pero declarado**:
   `D/16…:165-169`, *«**El costo, declarado y aceptado por el owner el 2026-09-24** […] les cobra en
   el acto. […] **Qué se hace con esa diferencia no está decidido.**»*

**Veredicto: LLEGA A OTRA COSA.** El desenlace del hallazgo pasa a ser un costo aceptado, con dos
agujeros nuevos:

- la diferencia cobrada no tiene destino (§5.1 `AO-4`);
- la frase *«no se desplegó nada»* es falsa si el paso 3 falla **después** de aplicada la migración
  estructural (caso B-f): quedan `inactiva_desde` y las filas de `trial` escritas con el instante del
  intento fallido, y el sistema viejo corre sobre el esquema nuevo (§5.1 `AO-5`).

### 3.8 `F-8CC2-005` · el contenedor viejo durante el rollout

1. Se despliega; Coolify mantiene el contenedor viejo con sus `node-cron`. — Sin cambio. El único
   texto sobre dos contenedores sigue hablando de la **misma** versión: `B/05…:47-48`, *«en un
   despliegue conviven dos contenedores sirviendo tráfico (`DEC-CONC-001`)»*.
2. El owner llama a Juan y Juan contrata. — Sin cambio; `D/16…:138-141` lo sigue pidiendo para la
   mañana del corte.
3. El `preapproval.updated` cae en el contenedor viejo y se confirma como procesado. — Nada lo
   corta: `D/16` no tiene paso ni nota sobre qué atiende el contenedor viejo (`rollout` y
   `coexistence` aparecen sólo en la tabla de ítems huérfanos, `D/16…:37-38` y `:44-45`).
4. y 5. La ficha espera al barrido diario; los crons viejos escriben sobre la base migrada. — Sin
   cambio.

**Veredicto: SIGUE LLEGANDO.** No mueve plata (el barrido lo recupera en un día), así que es de
borde (§5.2 `DB-5`).

### 3.9 `F-8CC2-007` · las tablas viejas y las columnas denormalizadas

1. a 4. (rama conservar) `featured_by_entitlement` queda en `true` en las dos cuentas `comp` y la
   home la sigue leyendo. — Sin cambio: `featured_by|featuredBy` da cero en el diseño (§3.0), y
   `B/21…:216-224` («Lo que NO se migra») sigue enumerando sólo *«Todo lo vivo»*, *«Los pagos»* y
   *«`commerce`»*.
   (rama borrar) El contenedor viejo consulta tablas que ya no existen. — Sin cambio.

**Veredicto: SIGUE LLEGANDO.** Y aparece una dependencia nueva que ninguna de las dos ramas
contemplaba: la fila de `trial` consumida se calcula sobre *«cada suscripción del sistema viejo»*
(`V/21…:220-222`), así que la migración que la escribe **necesita** las tablas viejas en pie. Va
con `AO-1`.

### 3.10 `F-8CC2-008` · nadie es dueño del rollback

1. Corte; Juan contrata en el sistema nuevo. — Sin cambio.
2. Un defecto obliga a volver a la imagen anterior. — Sin cambio.
3. a 5. El webhook de Juan cae en el handler viejo, los compromisos viejos no vuelven (`PA-5`), las
   filas nuevas no existen para el código viejo. **No se corta; se declara**: `D/16…:173-175`,
   *«**Qué pasa si el corte hay que revertirlo después del paso 3.** Eso es el rollback del
   programa, es el §3, y sigue sin escribirse. Lo que este § agrega es que **el punto de no retorno
   ahora tiene una ubicación declarada: está entre el paso 2 y el paso 3.**»*

La mitad de *«ninguna de las dos es dueña»* sí se contestó: el documento es del paraguas
(`D/16…:13-15`). La otra mitad —si hay rollback o sólo arreglo hacia adelante— el hallazgo la marcó
como decisión del owner y sigue sin tomarse.

**Veredicto: SIGUE LLEGANDO** (declarado, no decidido; §5.1 `AO-3`).

### 3.11 Recuento de veredictos

| hallazgo | sev. | veredicto |
|---|---|---|
| `F-8CC2-001` | CRÍT | DEJA DE LLEGAR |
| `F-8CC2-002` | CRÍT | DEJA DE LLEGAR |
| `F-8CB3-001` | CRÍT | SIGUE LLEGANDO (rama sondas) |
| `F-8CB3-008` | MEDIA | SIGUE LLEGANDO |
| `F-8CB3-014` | MEDIA | SIGUE LLEGANDO |
| `F-8CA3-007` | ALTA | SIGUE LLEGANDO |
| `F-8CC2-004` | ALTA | LLEGA A OTRA COSA |
| `F-8CC2-005` | MEDIA | SIGUE LLEGANDO |
| `F-8CC2-007` | MEDIA | SIGUE LLEGANDO |
| `F-8CC2-008` | MEDIA | SIGUE LLEGANDO |

**DEJA 2 · SIGUE 7 · OTRA 1** (contado con script sobre esta tabla).

---

## 4. El dominio recorrido

Resultados posibles: **CUBIERTO** (la regla lo alcanza y el texto lo resuelve), **CONDICIONADO**
(lo resuelve bajo una premisa no medida), **DECLARADO** (no lo resuelve, pero está en un «NO
cierra» con su causa), **ABIERTO** (no lo resuelve ni lo declara).

| id | resultado | por qué | residuo |
|---|---|---|---|
| A1 | CUBIERTO | 1b + 2 + lápida del paso 4 | — |
| A2 | CONDICIONADO | 1b lo toma del recorrido; la completitud del recorrido no es fila de la matriz | `AO-6` |
| A3 | CONDICIONADO | ídem A2 | `AO-6` |
| A4 | ABIERTO | 1b excluye las sondas y nadie dice qué se hace con ellas | `DB-1` |
| A5 | ABIERTO | *«vivos»* no está definido en `D/16`; `pending` puede quedar afuera | `DB-2` |
| A6 | ABIERTO | ídem A5 para `paused` | `DB-2` |
| A7 | CUBIERTO | nada que cancelar | — |
| A8 | CUBIERTO | 1a + gate; `EX-40` midió que el link deja de vender | — |
| A9 | ABIERTO | de dónde sale la lista de planes de 1a no está escrito | `DB-3` |
| A10 | CUBIERTO | con el plan cancelado no nace preapproval (`EX-40`, navegador) | — |
| A11 | CUBIERTO | la lápida lo hace reconocible (`B/21…:174-176`) | — |
| A12 | ABIERTO | la lápida es una `subscription` con `user` y versión de plan (`B/02…:47`); un id sólo del proveedor no tiene `user` —el `GET` devuelve `payer_email` vacío (`D/06…:332`, `EX-19`)— y cae en la re-vinculación | `AO-2` |
| A13 | CUBIERTO | con fila es A1, sin fila es A2; el umbral de ~20 está declarado (`D/01…:2594-2598`) | — |
| A14 | ABIERTO | el contenedor viejo confirma eventos del nuevo | `DB-5` |
| B-a | CUBIERTO | nada irreversible ocurrió | — |
| B-b | CUBIERTO | un plan sin cancelar frena el corte y 1a es reversible | — |
| B-c | ABIERTO | *«no avanza»*, pero la rama de aborto sólo cubre la falla del paso 3 | `DB-4` |
| B-d | ABIERTO | ídem B-c | `DB-4` |
| B-e | DECLARADO | rama de aborto con costo aceptado; falta el destino de la diferencia | `AO-4` |
| B-f | ABIERTO | *«no se desplegó nada»* es falso; `inactiva_desde` y `trial` quedan con el instante del intento | `AO-5` |
| B-g | ABIERTO | = A14 | `DB-5` |
| B-h | CUBIERTO con causa vieja | `DEC-MIG-004` #15 lo retira porque *«el cobro en vuelo es de uno de los tres conocidos»*, y el censo de 1b ya incluye desconocidos | `CT-5` |
| B-i | DECLARADO | `D/16…:173-175`; la decisión de fondo es del owner | `AO-3` |
| C-1 | CUBIERTO | paso 4, con texto contradictorio sobre quién canceló | `CT-2` |
| C-2 | ABIERTO | `V/21…:108-113` pide fijar el orden en el procedimiento; `D/16` no lo fija | `DB-7` |
| C-3 | DECLARADO | `V/21…:252-254` declara que `D/16` no la nombra; el aborto la deja con un instante viejo | `AO-5` |
| C-4 | DECLARADO | ídem C-3; además su censo sale de la base | `AO-5`, `DB-6` |
| C-5 | ABIERTO | ningún destino para `billing_payments` | `AO-1` |
| C-6 | ABIERTO | ningún inventario de tablas y columnas viejas | `AO-1` |

Recuento (script sobre la columna *resultado* de esta tabla): **29 casos · CUBIERTO 9 · CUBIERTO
con causa vieja 1 · CONDICIONADO 2 · DECLARADO 4 · ABIERTO 13.**

```text
python3 - <<'EOF'
import re,collections
t=open('02-R2-el-corte.md').read().split('## 4. El dominio recorrido')[1].split('## 5.')[0]
rows=[l.split('|')[2].strip() for l in t.splitlines() if re.match(r'\| [ABC][0-9-]',l)]
print(len(rows),collections.Counter(rows))
EOF
```

### 4.1 La verificación pedida: `R9` y `R12` dentro del orden del corte

**¿El orden de pasos incluye las dos escrituras?** No.

- La tabla de `D/16…:110-117` tiene seis filas (0, 1a, 1b, 2, 3, 4) y ninguna nombra
  `inactiva_desde` ni la fila de `trial`. `rg -n 'inactiva_desde|trial consumid|TRIAL_CONVERTED'`
  sobre `D/16-fase-7-del-paraguas.md` da cero; `trial` aparece sólo en la rama de aborto (el trial
  que el proveedor no repite).
- Peor: `D/16…:134` afirma *«**El paso 4 es la única escritura del corte, y es a mano.**»* (ver
  `CT-1`).

**¿Tienen dueño?** Sí, pero fuera del procedimiento: *«la migración estructural del corte, **una
vez**»* (`NUCLEO/01-glosario.md:59` para `C`; `V/21…:226-227` para `trial`). Eso las pone,
implícitamente, dentro del paso 3.

**¿Tienen rama de aborto?** No. La rama supone que el paso 3 falla sin dejar nada escrito
(`D/16…:162`). Si falla después de la migración estructural, las dos quedan escritas con el instante
del intento fallido y *«una sola vez»* impide reescribirlas en el reintento (§5.1 `AO-5`).

**¿Está declarado?** A medias. `V/21…:252-254` lo declara para las dos:

> 3. **El procedimiento del corte** (`16-fase-7-del-paraguas.md` §4) no nombra esta escritura, y
>    ese documento no se edita desde esta pasada. **Causa**: la decisión es posterior al
>    procedimiento. Va con la escritura `C`, que tampoco tiene paso propio ahí.

La declaración cubre la ausencia del paso; no cubre el aborto, que es el caso que borra datos.

---

## 5. Residuos

### 5.1 AL OWNER

#### `AO-1` · Qué pasa con las tablas viejas de billing y con las columnas que las copian

`F-8CB3-014`, `F-8CA3-007`, `F-8CC2-007`. Toca plata (un registro de pago que la ley pide conservar)
y acceso (una ficha destacada gratis).

**El ejemplo.** Mañana, 2026-09-26, MercadoPago le cobra ARS 18.000 a uno de los tres clientes en
trial (`ed00a8fd`), y el sistema viejo lo anota en `billing_payments`. Meses después se hace el
corte: el sistema nuevo arranca con `payment` vacío y en FASE 5 se borra el código de qzpay y, con
él, su esquema. En marzo ese cliente desconoce el cargo ante su banco. Nadie tiene el comprobante.
Aparte: una de las cuentas `comp` del owner queda destacada en la home para siempre, porque
`featured_by_entitlement = true` nunca se vuelve a calcular.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **congelar las tablas viejas en solo lectura** y declarar que FASE 5 no las borra; retención igual a la de `payment` | casi nulo | ninguno legal; quedan tablas muertas en el esquema |
| 2 | exportar a un archivo antes de FASE 5 y borrar | una exportación | el archivo vive fuera de la base y se pierde fácil |
| 3 | transcribir los pagos al `payment` nuevo | una migración de datos | contradice `DEC-MIG-003` |

Para las columnas denormalizadas que el código vivo lee: se ponen en su valor neutro (`false`) en
la migración del corte, y la columna se retira en la liberación siguiente.

**Recomendación: 1**, más el valor neutro para las columnas. Tiene una ventaja extra: la fila de
`trial` consumida (`V/21…:220-222`) se calcula sobre *«cada suscripción del sistema viejo»*, así que
la migración del corte necesita esas tablas en pie de todos modos.

#### `AO-2` · La regla de re-vinculación, y el cobro en vuelo sin lápida

`F-8CB3-008`, caso A12, y la rama sondas de `F-8CB3-001`. Toca plata ajena: doble cobro.

**El ejemplo.** Juan contrató en el sistema nuevo el día del corte. Un preapproval viejo suyo, que
sólo existía en el proveedor, se canceló en 1b, pero tenía un cobro en vuelo. No tiene lápida,
porque la lápida es una `subscription` con `user` y versión de plan (`B/02…:47`) y de ese id no se
sabe el `user` (`EX-19`: el `GET` devuelve `payer_email` vacío). El cobro llega como desconocido,
`B/21…:169-172` dice que el candidato es *«la suscripción nueva de esa misma persona»*, y se imputa
al ciclo nuevo de Juan: pagó dos veces y el sistema registra una.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **re-vincular sólo si el `external_reference` del preapproval nombra una fila nuestra que no tenga otro `provider_link` vivo**; cualquier otro desconocido abre marca (motivo `TRANSICIÓN_NO_DECLARADA` o uno nuevo) | una precondición en `B/09` §2.4 | una persona mira cada desconocido; en régimen son pocos |
| 2 | permitir lápidas sin `user` para los ids sólo del proveedor | una columna anulable en la lápida | no resuelve el caso general fuera del corte |
| 3 | dejar la regla como está | cero | el doble cobro invisible de `F-8CB3-008` |

**Recomendación: 1.** Cada preapproval del sistema nuevo nace con nuestro `external_reference`
(`PA-2`), así que una huérfana legítima siempre nombra su fila; todo lo que venga del sistema viejo
no la nombra y termina en una persona. Cierra A12, la rama sondas y el caso general a la vez, y
vuelve innecesario resolver el `user` de la lápida. Corrige también `B/21…:169-172`, que hoy enuncia
el candidato plausible como si fuera la regla.

#### `AO-3` · Si hay vuelta atrás después del paso 3

`F-8CC2-008`. Toca plata: cobros sin servicio.

**El ejemplo.** Una semana después del corte aparece un defecto grave. Si se vuelve a la imagen
vieja, Juan —que contrató en el sistema nuevo— sigue pagando a MercadoPago y el sistema viejo no
sabe quién es.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **sólo arreglo hacia adelante** pasado el paso 3, declarado como política | escribirlo | un defecto grave se arregla bajo presión |
| 2 | rollback con cancelación masiva en el proveedor de lo creado por el sistema nuevo | escribir el procedimiento y la cancelación | clientes nuevos cancelados; los trials no vuelven (`HOS-1012`) |

**Recomendación: 1.** `D/16…:71-78` ya anticipa que *«la conclusión honesta sea que no hay vuelta
atrás»*, y `D/16…:173-175` ya ubica el punto de no retorno. Falta que el owner lo diga, y
`D/16` §2 pide que sea **antes de que nazca la rama del paraguas** (hoy sólo existe
`spec/HOS-1352-billing-verticals-redesign` en el remoto).

#### `AO-4` · La diferencia que cobra la rama de aborto

`F-8CC2-004`, caso B-e. Toca plata de tres clientes reales.

**El ejemplo.** Juan está en el día 10 de sus 30 de trial. El corte cancela su preapproval, el
despliegue falla, se reactiva el plan y Juan se re-suscribe por el mismo link. El proveedor no le da
trial (una vez por pagador y plan) y le cobra ARS 18.000 en el acto, veinte días antes de lo
prometido. `D/16…:169`: *«**Qué se hace con esa diferencia no está decidido.**»*

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **aplicarle `DEC-MIG-004`**: se resuelve hablando, caso por caso, con el reembolso manual del panel si hace falta | cero de diseño | depende de que el owner se acuerde |
| 2 | re-suscribir con un plan nuevo del sistema viejo que traiga los días restantes | provisionar planes a mano | el sistema viejo no sabe hacerlo por cliente |

**Recomendación: 1**, escrita en la rama. Es la misma forma de `DEC-MIG-004` #17 (*«si alguien pagó
un período, se le resuelve hablando»*, `D/01…:2844`) y la población es la misma.

#### `AO-5` · La rama de aborto cuando la migración ya se aplicó

Caso B-f, C-3 y C-4. Borra datos: fichas.

**El ejemplo.** El paso 3 corre `db:migrate` bien —la columna `inactiva_desde` queda con el instante
del 1 de marzo en toda ficha, y las filas de `trial` consumidas quedan escritas—, pero el redeploy de
la web falla. Rama de aborto: *«no se desplegó nada»* (`D/16…:162`), el sistema viejo sigue. El
reintento del corte es el 15 de junio. Como la escritura `C` ocurre *«una vez y en ningún otro
lugar»* (`NUCLEO/01…:59`), la migración no la repite: las fichas de Juan amanecen con 106 días de
inactividad, `PB4` las archiva en la primera corrida y, si el reintento hubiera sido después de 180
días, el borrado corría esa misma noche. Y el dueño que abrió su primera ficha en abril no tiene fila
de `trial` y estrena un trial.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **el instante de `C` y el censo de `trial` son los del corte que TERMINA**: si hubo aborto con la migración aplicada, el reintento las reescribe (una excepción declarada a *«una vez»*, atada al reintento del corte) | una escritura de datos más en el reintento | dos lugares que escriben `C`; `G-R6-B` tiene que admitir los dos |
| 2 | foto de la base antes del paso 3 y restauración en la rama de aborto | la restauración | se pierden los cobros que el viejo anotó en la ventana, que es lo que `D/16…:124-127` quiere conservar |
| 3 | declarar que el aborto sólo vale si falla la migración estructural misma, y que toda falla posterior se arregla hacia adelante | cero | una falla del redeploy obliga a terminar el corte sí o sí |

**Recomendación: 1.** Es la única que no pierde nada. La 3 es coherente con `AO-3`-1 y más barata,
pero convierte una falla de redeploy en un punto de no retorno que hoy nadie declaró.

#### `AO-6` · La completitud del recorrido sin filtro

Casos A2 y A3. Toca plata: todo el arreglo de `F-8CC2-002` descansa en esto.

**El ejemplo.** El proveedor pagina el recorrido sin filtro y, como ya hace con el filtro de estado
(`RC-1`: *«`status=cancelled` devuelve **ALGO PLAUSIBLE**»*), devuelve 107 de 108 sin avisar. El
preapproval que falta es el de Ana. Sobrevive al corte y cobra.

La premisa no está en la matriz. `RC-1` (`D/06…:274`) mide que los **filtros** mienten y usa el
recorrido sin filtro como referencia (*«recorriendo las 76 sin filtro hay 69 canceladas»*), pero
nunca lo contrasta con nada. La frase *«el recorrido sin filtro es el completo»* aparece sólo en
`D/25…/00-hallazgos.md:307-308`. `rg -n 'sin filtro' D/06-mp-validation-matrix.md` da una sola
línea, la de `RC-1`.

| # | opción | costo | riesgo |
|---|---|---|---|
| 1 | **un control en el paso 2**: el conteo del recorrido tiene que igualar el `total` del paginado, y **todo id conocido** —los de la base y los de los manifiestos de sonda— tiene que aparecer; si no, el corte no avanza | un script | ninguno |
| 2 | una fila nueva en la matriz que mida la completitud antes del corte | una sonda | el resultado caduca con el tamaño de la cuenta |

**Recomendación: 1**, que no necesita sonda y usa la misma forma del gate.

### 5.2 DE BORDE

Busqué cada uno en los «NO cierra» de `D/16` (§4.3 y §5), `B/21` y `V/21` con `rg -n -i` por la
palabra clave de cada caso. Ninguno está declarado salvo donde se indica.

#### `DB-1` · Las sondas quedan vivas

**Declarado: no** (`rg -n -i sonda` en `D/16`: sólo `:114` y `:159`). La plata es del owner (su
tarjeta), por eso es de borde. Además, el criterio para reconocer una sonda depende de un manifiesto
que vive **fuera del repo** (`D/06…:430`: *«manifiesto en `~/.hos1352-rn3-manifiesto.json`, fuera
del repo»*).

Texto propuesto para `D/16` §4.2, al pie de la tabla:

> **Las sondas también se cancelan en el paso 1b**, salvo las que tengan una medición abierta el
> día del corte, que se enumeran por id en un manifiesto versionado en `mp-probes/`. **Causa**:
> toda sonda viva que cobre después del corte llega como desconocida. Las enumeradas cobran la
> tarjeta del owner y caen en la marca por la precondición de re-vinculación (`AO-2`).

#### `DB-2` · Qué es *«vivo»* en el paso 1b

**Declarado: no.** `D/16` no lo define; `B/03-maquinas-de-estado.md:2577` usa `authorized` ·
`paused` · `pending` como el conjunto de un preapproval que todavía puede cobrar, y `EX-1` midió que
un `pending` no vence. Texto propuesto para la celda del paso 1b:

> *«vivo»* es **todo estado releído distinto de `cancelled`**: `pending`, `authorized` y `paused`.

#### `DB-3` · De dónde sale la lista de planes del paso 1a

**Declarado: no.** El mismo sesgo que `R2` corrige para los preapprovals. Texto propuesto para la
celda del paso 1a:

> tomados, como los del 1b, **del proveedor** —todo `preapproval_plan` de la cuenta que no esté
> `cancelled`— y no de `billing_mp_plan`.

#### `DB-4` · La rama de aborto no cubre la falla del paso 2

**Declarado: no.** `D/16…:157` la titula *«si el paso 3 falla después del paso 1»*; el gate dice
*«no avanza»* (`:120`) y no dice qué pasa con lo que ya se canceló. Texto propuesto para el título
de la rama:

> **La rama de aborto: si algo falla después del paso 1b** —un preapproval que el paso 2 no ve
> `cancelled` después de reintentar la cancelación, o el paso 3—.

#### `DB-5` · El contenedor viejo durante el rollout

**Declarado: no.** No mueve plata: el barrido diario y la relectura de `S3` recuperan el estado en
un día. Texto propuesto para `D/16` §4.2, después del paso 3:

> **Durante el rollout del paso 3 el contenedor viejo no atiende el webhook ni corre crons**: se
> apagan antes de desplegar y se verifica como parte del paso. **Causa**: el handler viejo confirma
> como procesado el evento de un preapproval que no conoce (`local_row_not_found`), y MercadoPago
> no reintenta. Si no se apaga, el cliente que contrata en esa ventana espera hasta el barrido
> diario.

#### `DB-6` · El censo de la fila de `trial` sale de la base

**Declarado: no** (los cuatro puntos de `V/21…:239-258` no lo nombran). La persona que se suscribió
por un link viejo sin pasar por nuestro checkout —el caso `f6d89f71…`— no tiene fila en el sistema
viejo, y el recorrido del proveedor no da su correo (`EX-19`), así que no recibe fila de `trial` y
estrena uno. Es acceso de una sola vez, un trial. Texto propuesto como punto 5 de `V/21` §2.4
«Lo que esto NO cierra»:

> 5. **Quien autorizó en el proveedor sin fila en el sistema viejo** no recibe la fila consumida y
>    puede estrenar trial. **Causa**: el censo de esta escritura sale de nuestra base, y el
>    recorrido del proveedor que usa el corte (`16-fase-7…` §4.2, paso 1b) no trae el correo del
>    pagador (`EX-19`).

#### `DB-7` · El orden entre los dos grants y el paso 4

**Declarado a medias.** `V/21…:108-113` dice *«**es un orden que hay que escribir, no una decisión
de diseño**»* y remite al procedimiento, que no lo escribe. Afecta dos cuentas del owner por
minutos. Texto propuesto para la tabla de `D/16` §4.2, una fila entre 3 y 4:

> | 3b | **escribir los dos `permanent_grant`** de las cortesías del owner (`B/21` §2.4) | el sistema nuevo | antes del paso 4, para que esas dos cuentas no pasen por `cubierto` falso (`V/21` §2.4, punto 3) |

### 5.3 CONTRADICCIONES DE TEXTO

| id | un lado | el otro lado | corrección propuesta |
|---|---|---|---|
| `CT-1` | `D/16…:134`: *«**El paso 4 es la única escritura del corte, y es a mano.**»* | `NUCLEO/01…:59` (escritura `C`); `V/21…:209-211` (fila de `trial`); `B/21…:131` (los dos `permanent_grant`) | *«El paso 4 es la única escritura **a mano** del corte. Las otras tres —`inactiva_desde`, las filas de `trial` consumidas y los dos `permanent_grant`— las hace la migración del paso 3 (ver `DB-7` para el orden de los grants).»* |
| `CT-2` | `B/09…:147`: la lápida la canceló *«**una persona a mano** contra la API del proveedor, *«sin idempotencia, sin registro y sin nadie que verifique»* (`B/21` §2.5 y `16-fase-7-del-paraguas.md` §4.2)»*; igual `B/21…:182-184` | `D/16…:114-115`: cancela *«el sistema **viejo**»* y el paso 2 relee cada id; `D/16…:129-132` usa esa frase para describir justo el caso que el orden **evita** | En las dos: *«la canceló el sistema viejo en el paso 1b y la verificó el paso 2 releyendo por id; la salvedad 4 la sigue incluyendo porque un cobro en vuelo puede llegar igual»*. La fila sigue en *«no exenta»*: el criterio (quién la dejó sin poder cobrar) no cambia |
| `CT-3` | `D/16…:124-126`: *«el sistema viejo sigue corriendo con **tres** suscripciones canceladas. Si entra un cobro en vuelo, **lo registra el viejo**»* | `D/16…:114`: el censo del 1b sale del proveedor e incluye ids sin fila; para ésos el viejo no registra nada (`B/09…:715-717`: *«webhooks de suscripción que fallan porque el preapproval no resuelve a ninguna suscripción nuestra»*) | *«con las suscripciones del censo canceladas. Si entra un cobro en vuelo de una que la base conoce, lo registra el viejo; si es de una que sólo estaba en el proveedor, lo recoge la lápida del paso 4»* (con `AO-2` resuelto) |
| `CT-4` | `D/01…:2552-2554` (`DEC-MIG-003`): *«**nada de plata** —no hay **un solo pago histórico**»* y *«el *«trial ya consumido»* de **seis personas**»* como pérdida; `D/01…:2580-2581`: *«**No se les siembra nada**»* | `B/21…:62-63` (*«este hecho cambia solo — el 2026-09-26»*); `V/21…:64-69` (*«**Ya no se pierde**»*); `V/21…:148-151` y `:209-211` (se escribe `inactiva_desde` y la fila de `trial`) | Agregar a la entrada un 📌 del 2026-09-25: *«desde el 2026-09-26 hay pagos (destino: `AO-1`); el trial consumido ya no se pierde (`V/21` §2.4); el corte escribe `inactiva_desde` y la fila de `trial`, que no son la siembra de cobertura que esta entrada descarta»*. La entrada vieja no se edita en su contenido |
| `CT-5` | `D/01…:2842` (`DEC-MIG-004` #15): *«la lápida no existe entre el paso 3 y el paso 4 del corte \| el cobro en vuelo es de uno de los tres conocidos»*; #16 (`:2843`): *«el paso 1 cancela «los tres»»* | `D/16…:114`: el paso 1b cancela todo lo vivo del recorrido, conocido o no | La conclusión de #15 sigue (el cobro en vuelo se resuelve hablando o con la marca de `AO-2`); la causa no. Nota en `DEC-MIG-004`: *«desde el 2026-09-24 el censo sale del proveedor; un cobro en vuelo entre el paso 3 y el 4 puede ser de alguien que la base no conoce, y lo recoge la marca (`AO-2`)»* |
| `CT-6` | `B/21…:47`, `:53-55`, `:75`, `:221` y `V/21…:62-63`: *«cero pagos»*, *«No hay débitos corriendo»*, *«**Los pagos**: no hay ninguno»*, *«**Nada de plata.**»* | `B/21…:62-63` y `:80` (el primer cobro, 2026-09-26); `D/25…/00-hallazgos.md:315-316` (`ed00a8fd` cobra ese día) | Después del 2026-09-26: *«**Los pagos**: hay desde el 2026-09-26, bajo el sistema viejo; se conservan como dice `AO-1`»* |
| `CT-7` | `updated: 2026-09-20` en el frontmatter de `D/16` (`:6`), `B/21` (`:6`) y `V/21` (`:6`) | los tres tienen texto del 2026-09-24/25 (`D/16…:152-169`; `B/21…:155-157`; `V/21…:142-156`) | `updated: 2026-09-25` en los tres |

---

## 6. Lo que este documento no revisó

- `F-8CC2-006` (`PB2` la mañana del corte) y `F-8CB3-013`/`F-8CC2-009` (`B/21` §3.3 declara abierta
  una decisión que `DEC-MIG-002` cerró) son de otros racimos. Los vi al pasar: `B/21…:97-115`
  sigue declarando *«Las altas nuevas son una decisión del owner, y se declara abierta»*.
- Que `hops db-migrate` corra la migración estructural en una sola transacción es lo que hace
  cierta la rama de aborto en el caso B-e. No lo verifiqué contra el código; lo tomo del hallazgo.
