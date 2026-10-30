---
title: "FASE 9 vuelta 1 · G4 verificado — la frontera, las ventas del corte y el botón"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 9
---

# FASE 9 vuelta 1 — G4 verificado

Verificación de los 18 hallazgos de `04-G4-frontera-ventas-y-boton.md` (R5, R8, R10 y los sueltos
de `C1`) contra el texto vigente del worktree (commit `4347cfd9de`), con `G4-1` = **1** (regla de
Cloudflare del 0b al 5), `G4-2` = **2** (mixto: `ficha`, `políticaDeAddon` y `extenderTrial` al
§4.1; las superficies, capa de composición) y `G4-3` = **1** (15 minutos), las tres recomendadas.
Tenidas en cuenta: `G2-1` (el empuje del §3.1 y `fichaPurgada`), `G3-2` (lápida de recepción),
`G5-5` (`G13` en `V4`) y P2 (la extensión de `SUPER_ADMIN`, fuera del contrato). Criterio:
`DEC-METH-004`, opción 3. Abreviaturas: `D/12` y `D/16` son los docs 12 y 16 del paraguas; `V/NN` y
`B/NN`, `docs/NN-*.md` de cada épica; las descomposiciones van con ruta entera. Las líneas son las
de hoy, no las de `14-aplicado-G4.md`.

## 1. Resumen

| hallazgo | veredicto | línea vigente que lo corta o lo declara |
|---|---|---|
| `F-8V1C2-003` | DEJA | `D/16:123` «una regla en el borde (Cloudflare) rechaza toda ruta del viejo que cree o re-autorice un preapproval» |
| `F-8V1A3-005` | DEJA | `D/16:128` «Despliega con sus rutas de alta cerradas en el borde» |
| `F-8V1B3-006` | DEJA | `D/16:123` «Los 30 minutos son la vida de la `Preference` de addons del viejo» |
| `F-8V1A3-008` | DEJA | `B/16:41` «dos lugares: el cobro lo declara el producto (`addon_product`, billing); la vigencia, la versión» |
| `F-8V1C1-008` | DEJA | `D/12:120` «y `A1` de billing (`B/03` §8), que lee si en la vertical del objetivo hay un título» |
| `F-8V1C1-009` | DEJA | `B/14:343` «`extenderTrial(user, vertical, días, claveDeCanje)` (`12-contrato…` §4.1), verticales corre `T4`» |
| `F-8V1A3-009` | DEJA | `V/02:509` «es el único transporte de un cambio de billing» |
| `F-8V1C1-004` | DEJA | `D/12:698` «Y la vigente la resuelve verticales, no billing. En una fuente `GRANT`» |
| `F-8V1A3-014` | DEJA | `D/12:1141` «no contesta ninguna de las preguntas del §4.1 —las consultas y sus» |
| `F-8V1C1-015` | DEJA | `D/12:1014` «salió de `políticaDePlan` el 2026-09-26 (FASE 9 vuelta 1» |
| `F-8V1A1-008` | DEJA | `V/19:68` «Si la causa es que la vertical no admite altas, esta fila no aplica» |
| `F-8V1D1-004` | DEJA | `V/19:70` «La regla del botón está escrita sólo acá, y `B/19` §4 fila 21 la cita» |
| `F-8V1C1-002` | DEJA | `B/10:103` «baja es empeora según la estrategia de la clave (`V/15` §2.2)» |
| `F-8V1C1-003` | DEJA | `V/02:540` «DESPUÉS del commit de la operación que cambió la cobertura, nunca dentro de su transacción» |
| `F-8V1C1-005` | DEJA | `$B/descomposicion.md:603` «B4 una vez que estén B3, B5 y `V4` —`cobrada` se lee sobre pagos acreditados» |
| `F-8V1C1-007` | DEJA | `D/12:487` «una fila cuya sucesora ya autorizó —una fila que la apunta por `sucede_a` y salió de» |
| `F-8V1C1-011` | DEJA | `$V/descomposicion.md:82` «construye `V4`, con la implementación de arranque, y su fila vive en `V/20` §2» |
| `F-8V1C1-014` | DEJA | `$B/descomposicion.md:299` «Las otras tres se enchufan después —cortesía y grant en B9, y el addon en B10» |

**Conteo**: 18 DEJA, 0 SIGUE, 0 DECLARADO, 0 OTRA.

Notas por veredicto, donde el renglón no alcanza:

- **`F-8V1B3-006`**: el camino de Juan (compra a las 13:49, pago a las 13:52 con el viejo apagado)
  deja: después del 0b la compra no se puede iniciar, y una iniciada antes se paga dentro de los 30
  minutos, con el webhook viejo todavía encendido (el apagado es del paso 3, `D/16:146`). El
  residuo de la acreditación diferida queda **declarado** en `D/16:313`; pero la causa que escribe
  apunta a un mecanismo que no la alcanza (`N-G4V-02`), y su premisa de 30 minutos no vale para la
  gemela del cambio de plan (`N-G4V-01`).
- **`F-8V1A3-005`**: el alta de Juan en el paso 3 choca con la fila 3 y el paso 3 tiene fin escrito.
  La frase que lo cierra —*«no hay ninguno»* (objeto del proveedor al restaurar)— es falsa para la
  sonda que el mismo paso 3 da de alta (`N-G4V-03`); el hallazgo, que era sobre un cliente, deja.
- **`F-8V1C1-008`** y **`F-8V1A3-008`**: el camino (*¿de dónde saca `A1` la vertical de la ficha y
  la vigencia?*) deja con `ficha` y `políticaDeAddon`. La misma fila `A1` pide además un estado de
  la ficha que `ficha` excluye a propósito (`N-G4V-06`).
- **`F-8V1A3-009`**: las cuatro filas que nombraba tienen transporte o no necesitan datos de
  billing. La fila gemela del catálogo de addons quedó con el defecto (`N-G4V-09`).
- **`F-8V1C1-003`**: el orden vale para la invalidación y el aviso; el empuje inverso del §3.1, que
  entró el mismo día, no lo tiene (`N-G4V-05`).
- **`F-8V1D1-004`**: además de la regla única, los espejos que la repetían sin condición la citan
  (`V/03:228`, `V/11:495`, fila de `V8`), salvo uno (§4).

## 2. Racimos

### 2.1 R5 — todo canal que crea algo que mueve plata, del censo del 1b al fin del corte

Dominio declarado en `04-` §2.1: *crea o re-autoriza un preapproval, o crea una `Preference` o un
pago*, con 13 casos. Lo recorrí contra el texto de hoy y agregué los tres que salieron de buscar el
caso vecino (14 a 16).

| # | caso | dónde se contesta | ¿cubierto? |
|---|---|---|---|
| 1 | links públicos de `preapproval_plan` | `D/16:124` (1a); el 1b toma el censo después, así que un alta por link entre 0b y 1a entra al censo | sí |
| 2 | checkout de suscripción viejo (preapproval sin plan) y su reintento | `D/16:123` (0b, criterio) | sí |
| 3 | cambio de plan viejo | `D/16:123`, como ruta | **a medias**: la ruta cierra, pero el cambio a más caro del viejo crea una `Preference` **sin vencimiento**, y una abierta antes del 0b se paga cuando quiera (`N-G4V-01`) |
| 4 | cambio de medio de pago / re-autorización | `D/16:123` | sí |
| 5 | addon de única vez (`Preference`, 30 min) | `D/16:123` (espera de 30 min antes del 1a) | sí |
| 6 | addon recurrente viejo | `D/16:123`, por criterio | sí |
| 7 | `pending` creado antes y autorizado después | `D/16:125` (*vivo* incluye `pending`) | sí |
| 8 | sondas | `D/16:134-144` | sí |
| 9 | alta en el nuevo | `D/16:128` y `:132` | sí, salvo la sonda del propio paso 3 (`N-G4V-03`) |
| 10 | sucesión en el nuevo | mismo bloqueo | sí |
| 11 | addon en el nuevo | mismo bloqueo | sí |
| 12 | actos del admin sin proveedor | fuera del criterio | sí (no mueven plata) |
| 13 | `Preference` con acreditación diferida | `D/16:313-318` | declarado, con la causa rota de `N-G4V-02` |
| 14 | crons del viejo entre el 0b y el paso 3 | el borde no los ve; ninguno crea preapprovals ni preferencias (`courtesy-expiry` reanuda uno pausado, que el 1b igual cancela) | sí, por el código de hoy |
| 15 | la sonda que verifica la URL de notificación | `D/16:128` | **no** (`N-G4V-03`) |
| 16 | el viejo después de un aborto | `D/16:244` nombra la regla en los pasos 0b, 3 y 5, ninguno de la rama de aborto | **no** (`N-G4V-04`) |

**Racimo: dominio no cubierto.** La regla del borde corta los tres caminos originales, pero tres
casos del mismo criterio quedan afuera: una `Preference` sin vencimiento (3), la sonda del paso 3
(15) y la reapertura después de un aborto (16).

### 2.2 R8 — toda lectura o escritura entre épicas que declara algún capítulo

Dominio de `04-` §2.2 (15 filas), ampliado como pide la consigna con `fichaPurgada`, el empuje del
§3.1, `ficha`, `políticaDeAddon`, `extenderTrial`, la capa de composición y la extensión de
`SUPER_ADMIN` (P2).

| # | qué cruza | dónde se contesta | ¿cubierto? |
|---|---|---|---|
| 1 | la firma de la fuente y el aviso (B → V) | `D/12:117-127`, `D/12` §3 | sí |
| 2 | `políticaDePlan` y `situaciónDeVertical` | `D/12:1005-1006` | sí; lectores en `$B/descomposicion.md:331-338`. Pero `S1` no lee `vendible` y nadie más frena la venta de un plan retirado (`N-G4V-07`) |
| 3 | `díasDeTrial` | `D/12:1014` (sale); `$V/descomposicion.md:321`, `V/02:130` | sí |
| 4 | el veredicto | `D/12:1141-1142` | sí |
| 5 | `fuentes` para `A1` | `D/12:120` | sí |
| 6 | vertical y dueño de la ficha objetivo | `D/12:1009`, `:1043` | sí para vertical y dueño; **no** para el estado que `A1` también exige (`N-G4V-06`) |
| 7 | vigencia, scope y `addon` madre | `D/12:1010`, `B/16:41`, `B/02:512` | sí |
| 8–10 | pricing, Mi Suscripción, botón | `D/12:1054-1060`, `V/19:45`, `B/19:46` | sí |
| 11 | `extenderTrial` | `D/12:1011`, `:1046`; `B/14:343`; `V/03:54`; unidades en `$V/descomposicion.md:57` y `$B/descomposicion.md:340` | sí en diseño; **sin criterio de terminación** (`N-G4V-08`) |
| 12 | la vigente del grant | `D/12:698-701`, `B/02:755`, `V/15:117-120` | sí |
| 13 | quién está anclado (invalidación) | `V/02:516`, regla 3 en `V/02:553-557` | sí |
| 14 | cambios de suscripción (invalidación) | `V/02:509` | sí |
| 15 | la ficha llegó a `PURGED` (empuje) | `D/12:933-952` | sí en dirección; **sin orden respecto del commit** (`N-G4V-05`) |
| 16 | `fichaPurgada` | `D/12:1028-1038`, `B/09:470-477`, `B/16:473` | sí; la fila de `V6` no la nombra (§4) |
| 17 | extensión de `SUPER_ADMIN` | `V/03:54`, `V/11:180-185`, `B/14:590-600` | sí, fuera del contrato |
| 18 | quién tiene instancias de un addon (invalidación) | `V/02:517` | **no** (`N-G4V-09`) |

**Racimo: dominio no cubierto.** La regla corregida (§4.2 cita preguntas, no cifras) vale para
todas las filas; lo que queda afuera son cuatro lecturas o escrituras concretas que el texto
necesita y no declara bien: el estado de la ficha en `A1`, `vendible` en `S1`, el orden del empuje
y la fila de invalidación de addons.

### 2.3 R10 — toda combinación por la que el botón se muestra, se oculta o redirige

| # | caso | dónde se contesta | ¿cubierto? |
|---|---|---|---|
| 1 | `cubierto` verdadero | `V/19:70` (*con un título el botón es el de plan actual y cambio*) | sí |
| 2 | vertical sin altas | `V/19:70` punto 1; `V/19:68`; `B/19:137` | sí |
| 3 | `PRE_TRIAL`, sin evento ejercido, condiciones de `T1` | `V/19:70` punto 2 | sí |
| 4 | días en 0 | `V/19:70` punto 3 | sí |
| 5 | vertical sin evento | ídem | sí |
| 6 | hash con fila | ídem | sí |
| 7 | ya ejerció el evento | ídem | sí |
| 8 | trial consumido | ídem | sí |
| 9 | cartera vieja | `V/19:70` (*haber publicado en el sistema viejo no cuenta*) | sí (lo resolvió R1) |

Espejos: `B/19:138` y `B/19:300` citan la regla; `V/03:228`, `V/11:495`, `V/spec.md:62` y las filas
de `V8` llevan la condición. Queda uno sin ella, en la tabla de trazabilidad (§4). **Racimo:
dominio cubierto.**

### 2.4 Sueltos de `C1`

Cada uno se recorrió en su camino; los seis dejan (§1). Casos vecinos buscados: el orden del commit
(`C1-003`) en el empuje inverso → `N-G4V-05`; la condición sobre estado (`C1-007`) en la cortesía de
`S18` (`B/09:592`) → ya la cerró P1; la estrategia `MÍNIMO` (`C1-002`) en el primer caso del
criterio de `V2` → texto ambiguo (§4).

## 3. Hallazgos nuevos (casos vecinos)

### N-G4V-01 — ALTA · El cambio de plan del viejo abre una `Preference` sin vencimiento, y los 30 minutos del 0b no la acotan

El 0b espera 30 minutos porque *«son la vida de la `Preference` de addons del viejo»*. El cambio a
un plan más caro del viejo también cobra por una preferencia de pago único, pero sin
`expiresInMinutes`: el adaptador de qzpay sólo pone `expiration_date_to` si se lo pasan, y
`initiatePaidPlanUpgrade` no lo pasa (el de addons sí).

- `apps/api/src/services/subscription-checkout.service.ts:2069`: «Initiate a paid plan upgrade via a one-time MP checkout for the»
- `apps/api/src/services/addon.checkout.ts:236`: «30-minute expiration window and records promo code usage if applicable.»
- `D/16:123`: «Los 30 minutos son la vida de la `Preference` de addons del viejo»

**Juan.** El lunes Juan abre el cambio de Básico a Premium en el sitio viejo y cierra la pestaña.
El corte es el jueves. El viernes vuelve a ese link de MercadoPago y paga la diferencia. El viejo ya
no existe; el pago llega al nuevo sin preapproval ni fila (y con `N-G4V-02`, sin lugar donde caer).
Juan pagó una mejora que ningún sistema le presta. **Qué falta**: nombrar esta preferencia en el 0b
(vencerla por API en el 1a, o declarar su población con la misma causa que el caso 13).

### N-G4V-02 — MEDIA · El residuo declarado de la `Preference` cae en la lápida de recepción, que sólo existe para preapprovals

`D/16:317` dice que el pago diferido *«cae donde cae todo desconocido sin fila»*. Ese lugar es la
lápida de recepción de `G3-2`, que se escribe para *un preapproval desconocido*; un pago de
preferencia no tiene preapproval. Y `B/09` declara que la conciliación de un pago único no está
escrita.

- `D/16:317`: «el pago llega como desconocido y cae donde cae todo desconocido sin fila»
- `B/09:925`: «lee `authorized_payments`, así que ninguna de las tres partes lo alcanza. Cómo se concilia una»

**Juan.** Paga en efectivo, dos días después del corte, una preferencia de destaque del viejo. El
aviso del pago llega al handler nuevo, que no encuentra preapproval: ni lápida, ni marca, ni
persona que lo mire. La declaración dice que hay un lugar y no lo hay. **Qué falta**: que la causa
nombre el vacío real (el `NO cierra` de `B/09` sobre órdenes) o que la lápida de recepción cubra
también un pago sin preapproval.

### N-G4V-03 — MEDIA · La sonda que verifica la URL de notificación es un alta con las rutas de alta cerradas, y la rama de aborto dice que no hay objetos del proveedor

La fila 3 exige verificar la entrega *con el alta de una sonda propia* y, en la misma fila, que las
rutas de alta estén cerradas en el borde. La rama de aborto afirma que al restaurar no existe
ningún objeto del proveedor.

- `D/16:128`: «verificada con una entrega real (el alta de una sonda propia) antes del paso 4»
- `D/16:271`: «Lo que el backup no puede pisar es un objeto del proveedor»

**Juan** (el owner, esta vez). En el paso 3 da de alta la sonda: o la regla del borde la rechaza y
la verificación no se puede hacer, o se hizo por fuera de las rutas y hay un preapproval vivo con su
tarjeta. El 3b falla, se restaura el backup: la sonda no está en el manifiesto del 1b ni en la base
restaurada, y el viejo le contesta `local_row_not_found` a cada cobro. **Qué falta**: decir por
dónde se hace esa alta (excepción declarada del borde o llamada directa), y que la rama de aborto la
cancele antes de restaurar.

### N-G4V-04 — MEDIA · La rama de aborto no levanta la regla del 0b: el viejo queda sin altas

La regla se aplica en los pasos 0b, 3 y 5, y la rama de aborto (reactivar planes, restaurar,
redesplegar la imagen vieja, reencender webhook y crons) no la nombra. Los re-suscriptos del punto 3
usan el link del plan, pero el checkout propio del viejo —el preapproval sin plan de HOS-1221—
sigue rechazado en el borde.

- `D/16:244`: «La regla de las altas en el borde (pasos 0b, 3 y 5): configuración de Cloudflare»
- `D/16:265`: «Se reactivan los planes del paso 1a. La sonda 50 midió»

**Juan.** El corte aborta a las 11:00. A la tarde Juan entra al sitio viejo a suscribirse y el
checkout le responde rechazado, sin fecha. `DEC-MIG-002` dice que las altas siguen en el sistema
actual durante el rediseño, y nadie tiene escrito que hay que levantar la regla. **Qué falta**: un
punto de la rama de aborto que levante la regla del viejo y lo verifique con una petición que pasa.

### N-G4V-05 — ALTA · El empuje del §3.1 no dice «después del commit», y `A6` relee `fichaPurgada` antes de que el `PURGED` exista

`F-8V1C1-003` fijó que la invalidación y el aviso salen después del commit. El empuje inverso se
escribió *«en el mismo acto»* de `PB9`/`PB12`, y el consumidor, por regla, relee antes de actuar.

- `D/12:933`: «Es lo único que verticales le empuja a billing. Lo emite verticales en el mismo acto de»
- `D/12:880`: «El aviso sale después del commit de lo que cambió la respuesta, igual que la invalidación»

**Juan.** Borra su ficha con destaque mensual. `PB12` emite el empuje dentro de su transacción;
billing lo recibe, relee `fichaPurgada`, ve `no` (el `PURGED` todavía no se commiteó) y no corre
`A6`. La red es el barrido del día siguiente, y esa noche entra el cobro del destaque: el caso que
el owner eligió `G2-1` para no aceptar. Es sistemático, no un empuje perdido. **Qué falta**: la
misma frase de `D/12:880`, en el §3.1.

### N-G4V-06 — MEDIA · `A1` exige que la ficha no esté `MODERATED`, y `ficha` excluye el estado a propósito

- `B/03:2522`: «en un estado que acepte destacarla —ni `PURGED` ni `MODERATED`—»
- `D/12:1044`: «manda leer del recurso—, nunca su estado (ése es sólo `fichaPurgada`)»

**Juan.** Su ficha está moderada. Compra un destaque. `A1` tiene `ficha` (vertical y dueño) y
`fichaPurgada` (sólo `PURGED`); para saber `MODERATED` lee la tabla de verticales —la filtración que
el §4.2 vigila— o no lo mira y vende un destaque que no se ve, y que por `G2-3` se sigue cobrando.
**Qué falta**: o `ficha` devuelve *si acepta un destaque* (un sí o no, como `fichaPurgada`), o `A1`
delega en el paso 4 del cap. 17 y esa llamada entra al §4.1.

### N-G4V-07 — MEDIA · `S1` no lee `vendible`: un plan retirado se sigue vendiendo por fuera de la pricing

Es la gemela de `F-8V1A1-008`: para *la vertical no admite altas* hay superficie (fila 20) **y**
guarda en `S1`; para *el plan está retirado* hay superficie (la pricing lee sólo lo vendible) y no
hay guarda. El único lector de `vendible` es `B12`.

- `B/03:147`: «la vertical admite altas —`situaciónDeVertical(vertical).admiteAltas`, `B/10` §4.6—, para el alta nueva Y para la sucesión»
- `B/10:131`: «esta sección. Retirados todos los planes vendibles la vertical queda cerrada a altas: nadie»

**Juan.** Guardó el link del checkout de Premium antes de que lo retiraran. Lo abre después: la
pricing ya no lo muestra, pero `S1` no pregunta si la versión es vigente y vendible, y lo suscribe a
un plan que el negocio sacó de la venta. **Qué falta**: `S1` exige `políticaDePlan(versión).vigente
y vendible` (y `B3` pasa a leerlo en `$B/descomposicion.md` §2.6).

### N-G4V-08 — MEDIA · `extenderTrial` no tiene criterio de terminación ni en `V4` ni en `B9`

La única escritura de la dirección inversa está en el *qué deja funcionando* de `V4` y en la
dependencia 10 de `B9`, pero ningún criterio de terminación la prueba: ni `RECHAZADA` con el techo
lleno, ni el código intacto tras un rechazo, ni el reintento idempotente. Es la forma de
`F-8V1C1-005` (el criterio de `B4` sin caso de `cobrada`).

- `$V/descomposicion.md:57`: «y la operación `extenderTrial` del contrato §4.1 —la única escritura de billing en verticales»
- `$B/descomposicion.md:727`: «un 20 % y ARS 100 sobre ARS 1.000 dan 700 y nunca 720»

**Juan.** Canjea *+7 días* con el techo lleno. La implementación de `B9` gasta el código antes de
mirar la respuesta; las dos unidades cierran en verde. **Qué falta**: en `V4`, *«`extenderTrial`
contesta `RECHAZADA` con el techo lleno y no mueve la fecha»*; en `B9`, *«con `RECHAZADA` el código
queda intacto, y el reintento con la misma clave no extiende dos veces»*.

### N-G4V-09 — BAJA · La fila de invalidación del catálogo de addons es la gemela de la que se tachó

La fila de la suscripción se tachó porque la versión anclada es inmutable. La instancia de addon
también ancla una versión que *«no se mueve»*, y su fila sigue en pie; si invalidara algo, tendría
que saber quién tiene instancias de ese addon, que es billing.

- `V/02:513`: «la suscripción lee su versión anclada, que es inmutable; una versión nueva no la cambia»
- `B/02:535`: «no se mueve: lo ya comprado no cambia»

**Juan.** Se publica la v2 del destaque. Verticales no sabe quién tiene la v1, y la entrada de Juan
tampoco cambia, porque su instancia apunta a la v1. La fila es inejecutable o inocua, y su razón
(*«es lo que otorga el addon»*) compite con la de la inmutabilidad. **Qué falta**: tacharla como la
de suscripciones.

## 4. Texto vencido y contradicciones (BAJA)

1. `$V/descomposicion.md:374`, tabla de trazabilidad: «el botón de suscribirse manda a publicar a quien no publicó» — el último espejo sin la condición de la regla única.
2. `$V/descomposicion.md:92`: «naturaleza: es un guard sobre lo que V4 construye y que no puede nacer acá» — sin tachar, bajo un recuadro que lo declara historia; se lee como vigente.
3. `$V/descomposicion.md:506`, criterio de `V2`: el primer caso (*«un solo limit menor»* → `BAJA`) no dice la estrategia; con una clave `MÍNIMO` contradice el caso que se agregó en la misma celda.
4. `D/12:1037`: «La construye V6, dueña de `PB12`, no `V2`» — la fila de `V6` en la tabla de unidades (`$V/descomposicion.md:59`) nombra `ficha` y no `fichaPurgada`.
5. `$B/descomposicion.md:339`, fila 9: lista *«`addon`, vigencia, tipo de scope»* y omite `díasDeVigencia`, que la firma sí trae (`D/12:1010`).

## Key Learnings

1. Un criterio de canal (*crea algo en el proveedor*) cierra más que una lista de rutas, pero hereda
   las premisas del mecanismo: *30 minutos* era la vida de **una** preferencia, no de todas.
2. Una regla de corte con apertura en el camino feliz (paso 5) necesita su apertura en el camino de
   aborto; si no, el rollback deja un estado que ninguna decisión eligió.
3. El arreglo de orden (*después del commit*) se aplicó al aviso y no al empuje inverso escrito ese
   mismo día: los mecanismos nuevos de la vuelta hay que pasarlos por los arreglos de la vuelta.
4. Una firma que excluye algo *a propósito* (`ficha`: *nunca su estado*) se verifica contra cada
   lector: `A1` ya pedía un estado desde otro hallazgo de otro grupo.
5. La gemela de una fila tachada (suscripción → addon) y la de una guarda agregada (`admiteAltas` →
   `vendible`) son los dos casos vecinos más baratos de encontrar: se busca por forma, no por tema.
6. Una operación nueva sin criterio de terminación es la misma falla que `cobrada` en `B4`: está en
   *qué deja funcionando* y nadie la prueba.
