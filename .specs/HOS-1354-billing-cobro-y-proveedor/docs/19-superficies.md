---
title: Master Spec 19 — Superficies: API, Web y Admin
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 19
---

# 19 · Superficies: API, Web y Admin

Mitad **BILLING** del capítulo 19 del programa. La otra mitad vive en la otra épica.

Las superficies no deciden nada. Leen lo que el núcleo resolvió y lo muestran. Por eso este
capítulo es el más corto de la Parte III en lo conceptual y el más largo en una sola cosa: **la
lista de lo que hay que decirle a la gente**, que los capítulos anteriores fueron dejando y que
nadie tiene junta.

---

## 1. La regla que gobierna todo lo demás

El §45 la escribe en una línea y no admite matices:

> *«Autorización backend jamás depende de ocultar UI.»*

**Ocultar un botón no es un control de acceso: es una comodidad.** Todo lo que la UI esconde
tiene que estar rechazado por la resolución de autorización del capítulo 17 (épica de
verticales), y la UI lo esconde **porque ya sabe** que sería rechazado, nunca para que no lo
intenten.

De ahí sale la única regla de diseño que las tres superficies comparten: **la UI y el backend
preguntan lo mismo, al mismo lugar.** Si la UI tuviera su propia copia del criterio, las dos se
separarían en la primera decisión que alguien cambie en un solo lado.

---

## 2. Qué lee cada superficie

| superficie | qué lee | qué NO lee |
|---|---|---|
| **pricing** (§47) | la **versión vigente** de cada plan, y sólo si es vendible (cap. 10 §2) | nada de la suscripción de nadie |
| **Mi Cuenta** (§45) · **Mi Suscripción** (§46) | la **versión anclada** de la suscripción, su estado, y el conjunto efectivo de entitlements y limits | el catálogo vendible, salvo para ofrecer un cambio |

Las dos primeras filas son la distinción del capítulo 10 §2 dicha desde la UI: **el catálogo es lo
que se puede comprar hoy; la suscripción es lo que se compró.** Una pantalla que las mezcle le
muestra a alguien un precio que no es el suyo.

---

## 3. Mi Suscripción · el §46 pide claridad total de scope

El §46 enumera qué mostrar —todas las verticales, trials, suscripciones, ciclo, grace, pausa,
cancelación programada, addons, cortesía, *Free Forever*— y cierra con *«claridad total de
scope»*. Esa última frase es el requisito real, y significa algo concreto:

**cada cosa que se muestra dice en qué vertical vale.** El modelo entero cuelga de
`user + vertical` (cap. 01 §5, núcleo) y una persona puede estar en estados distintos en cinco
verticales a la vez. Una pantalla que liste «tu suscripción» sin decir cuál no es ambigua: es
incorrecta.

Y **lo global se muestra como global**: un addon de scope `USER` o `GLOBAL`, o una clave de
entitlement global (cap. 15 §3, épica de verticales), no pertenece a ninguna vertical. Mostrarlo
dentro de una es sugerir que se pierde con ella.

---

## 4. Lo que hay que decir, y no es una mejora de UX

Ésta es la parte que sólo puede escribirse ahora, con los capítulos ya escritos.

**Cada línea de esta tabla es la mitad de una decisión.** No son advertencias amables: son la
condición bajo la cual se aceptó una regla que, sin el aviso, sería indefendible o directamente
injusta. Si la superficie no lo dice, **la decisión se convierte en lo que se le permitió no
ser.**

| # | dónde | qué tiene que decir | de dónde sale |
|---|---|---|---|
| 3 | al **borrar** una ficha | **qué addons se pierden y por cuánto** | `DEC-ADDON-001`, impl. 1 |
| 5 | al **pausar estando en cortesía** | que **la pierde**, y dejarlo elegir | `DEC-GRANT-004`, cap. 01 §3 (núcleo) |
| 5-bis | al **pausar**, antes de confirmar | **qué le pasa a la ficha mientras dure la pausa**: sale del sitio público el mismo día, **vuelve sola al reanudar** si el cupo del plan le alcanza, y si la pausa cruza los 90 días queda **archivada** — sin que se borre nada y sin que la vuelta deje de ser automática. Es el acto que **parece que sólo suspende el cobro**, y el cliente no tiene otra forma de enterarse | cap. 03 §5, `12-contrato…` §2.6, `V/03` §9 (`PB2`, `PB4`, `PB7`), `V/02` §4.2 |
| 6 | al **reanudar** una pausa | **una sola cosa: qué día se le va a cobrar** — nada de días perdidos ni compensaciones | `DEC-SUB-010`, impl. 1 |
| 7 | al **cambiar de ciclo** teniendo una promo | que **el importe nuevo ya no lleva el descuento** | cap. 14 §2.3 (épica de billing) |
| 10 | el aviso de **suspensión** | lo que pierde **como turista**, no sólo como anfitrión — y los **días de addon** que se le van a ir | cap. 15 §6.3 (épica de verticales), `DEC-ADDON-001` impl. 2 |
| 10-bis | al **registrar un pago manual que llegó después de declarar el impago** (`MP4`, cap. 03 §7.1), antes de confirmar | **qué devuelve la reapertura y qué no**: vuelve el servicio y vuelve la publicación (`S7`), y la ficha que se hubiera archivado **vuelve sola si el cupo del plan le alcanza** (`PB7`, `V/03` §9) — pero **el contenido que el hard delete ya borró no vuelve**, y si la suspensión cruzó el día 180 lo que se reactiva es una ficha vacía (`V/02` §4.1). Es el acto que **parece que sólo deshace un estado**, y prometer una ficha que no está es peor que no prometerla (cap. 12 §4.5, punto 3). **Y si la fila es la predecesora de una sucesión en curso, dice que el pago NO reactiva**: queda pendiente por `S19` y lo resuelve el cierre, igual que en la fila 15. **Y dice cuándo se abre la próxima cuota**, que es lo que el admin necesita para contestarle al cliente en el acto y son **dos respuestas distintas** según cuánto duró el atraso: si la reapertura cae **dentro** del período que se acaba de pagar, la próxima cuota es la del día en que ese período termina; si el atraso fue más largo que un período, **arranca uno nuevo hoy** y la cuota se abre ahora (cap. 03 §7.2, *«qué mueve la fecha del próximo cobro»*). Sin esto el acto se confirma sin saber si le queda período pago o si se le abre una cuota en el mismo instante | cap. 03 §7.1, §7.2 y §3.2 (`S19`), `V/02` §4.1, `V/03` §9 |
| 11 | la compra de **Turista VIP estando suspendido** | que **al regularizar se le cancela**, sin reembolso | cap. 15 §6.3 (épica de verticales), `DEC-ENT-004` |
| 12 | los **tres avisos de aumento** | precio actual, precio nuevo, **la fecha de ese cliente**, y que puede cancelar | `DEC-MP-002` |
| 13 | la confirmación de **revocar un grant** | que deja al cliente **sin servicio**, qué addons corta, **y que los que el grant había pasado a costo $0 se apagan y no vuelven solos**: el débito viejo no se reanuda (`PA-5`, `DEC-GRANT-001`) y no hay compensación, así que recuperarlos es volver a suscribirse. Sin esa frase, *«qué addons corta»* se lee como que corta regalos, y **puede estar cortando lo que la persona pagaba** | cap. 08 §3.1 (núcleo), cap. 16 §3.3 y §3.4 (épica de billing) |
| 13-bis | la confirmación de **anclarle una vertical nueva a un grant** | **qué cobro deja de ocurrir**: se cancela la suscripción que el beneficiario paga en esa vertical (`S13`) y termina la cortesía que tuviera vigente ahí. **Y con `includesAddons: true` son varios cobros, enumerados uno por uno**: cada addon compatible que venía pagando pasa a $0 con su suscripción de complemento cancelada (`S20`), y **el cliente recibe un correo del proveedor por cada preapproval** (`EX-3`). Es el acto que **parece que sólo agrega**, y por eso necesita la frase más que los otros | cap. 08 §3.1 (núcleo), `12-contrato…` §2.8, cap. 14 §4.3, cap. 16 §3.4 |
| 14 | el aviso de **discontinuar una vertical** | la **fecha de fin de servicio**, qué pasa con la ficha y **cómo exportarla** | cap. 10 §4.3 |
| 15 | el **cambio de plan** con una cuota impaga viva — la que el proveedor reintenta, **y también la que el cliente puede pagar a mano** (cap. 03 §7, `MP1` o `MP4`): son las **dos puertas del mismo pago** y el desenlace es idéntico | que **el cobro de la cuota impaga puede entrar igual**, antes de confirmar — **y qué pasa con esa plata según lo que el cliente haga**: si termina el checkout **se le devuelve**, si lo abandona **le queda** y le paga el período que está usando. Nunca reactiva la suscripción vieja mientras el cambio esté en curso. **Y que la devolución no es instantánea**: la confirma una persona (`DEC-RF-002`), así que lleva unas horas | cap. 12 §5.3, `NUCLEO/07` §6, cap. 03 §3.2 (`S19`) |
| 16 | el **cambio de plan** con un checkout abierto | que **no se ofrece**: *«terminá o cancelá el checkout que tenés abierto»* | cap. 03 §3.3.1 |
| 16-bis | el **alta nueva** tras un primer cobro rechazado, **teniendo un cambio de plan en curso** | lo mismo que la 16, y por una razón distinta: la sucesora sigue viva y **puede autorizar**, así que un alta nueva serían **dos preapprovals cobrando**. Ofrecer *«empezar de nuevo»* acá —que es lo que el cap. 12 §4.4 pide en el caso general— es ofrecer el doble cobro | cap. 03 §3.2 y §3.3.1, cap. 12 §4.4 |
| 17 | el **cambio de plan** estando pausado | que **no se ofrece**: *«reanudá tu suscripción para cambiar de plan»* | cap. 03 §3.3.1 |

**Los tres últimos son avisos de una operación que NO se ofrece, y por eso están acá.** En los
tres la persona **no queda bloqueada** —puede terminar o abandonar el checkout, puede reanudar—,
así que lo único que faltaba era **decir el no en voz alta** con su motivo, en vez de que la
operación falle sin explicación o, peor, que alguien construya un mecanismo para un camino que el
proveedor no admite (`EX-11`).

### 4.1 Dos reglas sobre cómo se dicen

1. **La confirmación dice qué va a pasar, no pregunta si estás seguro** (cap. 08 §3.1, núcleo).
   *«¿Estás seguro?»* no transmite información: la persona ya decidió cuando llegó ahí.
2. **Cada aviso lleva la fecha de ese cliente, no una global.** `DEC-MP-002` lo exige para el
   aumento y la razón vale para todos: *«cancelá antes si no aceptás»* no sirve para calcular nada
   si no se dice antes de cuándo.

---

## 5. La baja

**Cancelar es self-service, desde Mi Suscripción, en no más pasos que los que costó
suscribirse**, sin teléfono, sin formulario de contacto y sin hablar con nadie. Está decidido en
el capítulo 22 §1.1 como requisito de diseño, **independiente de si además es obligatorio**.

Lo que pasa después ya está resuelto y la pantalla lo dice: se cancela en el proveedor de
inmediato y **el servicio sigue hasta el fin del período pagado** (`DEC-SUB-009`), con esa fecha a
la vista. Y sale **nuestro** correo antes que el del proveedor, porque el suyo dice *«por un pago
no realizado o por opción del vendedor»* y a alguien que canceló por su voluntad eso le insinúa
mora (`DEC-MAIL-001`, `EX-3`).

---

## 6. Admin

El §48 enumera veintiuna cosas que el admin debe poder **inspeccionar**. Las **acciones** —que el
§48 no enumera aunque el resto del PDR se las asigne— son las doce del capítulo 08 §3 (núcleo),
cada una con permiso propio, auditoría y confirmación explícita si es destructiva o mueve dinero.

Tres cosas que el panel necesita mostrar y que no son inspección de una entidad, sino la salida
de algo que este diseño creó:

| qué | por qué existe |
|---|---|
| el **listado accionable** de las filas con la marca `requiere_conciliación` | es el canal primario, y el correo es agregado (`DEC-OBS-001`). El listado muestra **el estado real de la fila**, que la marca ya no pisa |
| las **versiones de plan retiradas** con cuántas suscripciones siguen ancladas | es lo que convierte la cola larga del retiro en algo que alguien puede decidir atacar (cap. 10 §3.4) |

Y una que ya estaba decidida y conviene repetir acá porque es de superficie: **`SUPER_ADMIN` firma
toda concesión gratuita**, con el costo operativo declarado en el capítulo 08 §3.1 (núcleo) —el
riesgo es que se termine compartiendo la cuenta, y si aparece se resuelve con un permiso acotado,
nunca con una cuenta compartida—.

---

## 7. Pricing

El §47 pide **una pricing por vertical, Turista incluida**, y define tres situaciones: primer uso
(*Empezar*, que inicia esa vertical), trial (elegir plan e iniciar suscripción) y activo (plan
actual y cambio de plan).

Dos cosas que salen de capítulos anteriores y que la pricing tiene que respetar:

1. **Lee la versión vigente y vendible, nada más** (§2). Un plan retirado no aparece, aunque haya
   gente pagándolo.
2. **Que tenga pricing propia es Eje 2** (cap. 01 §4.3, núcleo, ítem 8): la variación legítima es
   **su página**, no el motor que la alimenta. Una pricing que necesite lógica propia por vertical
   para resolver qué mostrar está resolviendo algo que ya resolvió el núcleo.

---

## Lo que este capítulo NO cierra

- **El diseño visual**, que no es materia de esta spec.
- **Qué endpoints expone la API**, uno por uno: lo que este capítulo fija es **qué lee cada
  superficie**, y de ahí sale la API. Enumerarla antes de FASE 3 sería anticipar el trabajo de las
  épicas.
