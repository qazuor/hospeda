---
title: Master Spec 19 — Superficies: API, Web y Admin
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 2
capitulo: 19
---

# 19 · Superficies: API, Web y Admin

Las superficies no deciden nada. Leen lo que el núcleo resolvió y lo muestran. Por eso este
capítulo es el más corto de la Parte III en lo conceptual y el más largo en una sola cosa: **la
lista de lo que hay que decirle a la gente**, que los capítulos anteriores fueron dejando y que
nadie tiene junta.

---

## 1. La regla que gobierna todo lo demás

El §45 la escribe en una línea y no admite matices:

> *«Autorización backend jamás depende de ocultar UI.»*

**Ocultar un botón no es un control de acceso: es una comodidad.** Todo lo que la UI esconde
tiene que estar rechazado por la resolución de autorización del capítulo 17, y la UI lo esconde
**porque ya sabe** que sería rechazado, nunca para que no lo intenten.

De ahí sale la única regla de diseño que las tres superficies comparten: **la UI y el backend
preguntan lo mismo, al mismo lugar.** Si la UI tuviera su propia copia del criterio, las dos se
separarían en la primera decisión que alguien cambie en un solo lado.

---

## 2. Qué lee cada superficie

| superficie | qué lee | qué NO lee |
|---|---|---|
| **pricing** (§47) | la **versión vigente** de cada plan, y sólo si es vendible (cap. 10 §2) | nada de la suscripción de nadie |
| **Mi Cuenta** (§45) · **Mi Suscripción** (§46) | la **versión anclada** de la suscripción, su estado, y el conjunto efectivo de entitlements y limits | el catálogo vendible, salvo para ofrecer un cambio |
| **Admin** (§48) | todo lo anterior, de cualquier persona, **como actor distinto del sujeto** (cap. 17 §3) | — |

Las dos primeras filas son la distinción del capítulo 10 §2 dicha desde la UI: **el catálogo es lo
que se puede comprar hoy; la suscripción es lo que se compró.** Una pantalla que las mezcle le
muestra a alguien un precio que no es el suyo.

---

## 3. Mi Suscripción · el §46 pide claridad total de scope

El §46 enumera qué mostrar —todas las verticales, trials, suscripciones, ciclo, grace, pausa,
cancelación programada, addons, cortesía, *Free Forever*— y cierra con *«claridad total de
scope»*. Esa última frase es el requisito real, y significa algo concreto:

**cada cosa que se muestra dice en qué vertical vale.** El modelo entero cuelga de
`user + vertical` (cap. 01 §5) y una persona puede estar en estados distintos en cinco verticales
a la vez. Una pantalla que liste «tu suscripción» sin decir cuál no es ambigua: es incorrecta.

Y **lo global se muestra como global**: un addon de scope `USER` o `GLOBAL`, o una clave de
entitlement global (cap. 15 §3), no pertenece a ninguna vertical. Mostrarlo dentro de una es
sugerir que se pierde con ella.

---

## 4. Lo que hay que decir, y no es una mejora de UX

Ésta es la parte que sólo puede escribirse ahora, con los capítulos ya escritos.

**Cada línea de esta tabla es la mitad de una decisión.** No son advertencias amables: son la
condición bajo la cual se aceptó una regla que, sin el aviso, sería indefendible o directamente
injusta. Si la superficie no lo dice, **la decisión se convierte en lo que se le permitió no
ser.**

| # | dónde | qué tiene que decir | de dónde sale |
|---|---|---|---|
| 1 | el botón **Empezar** de la pricing de Turista | que **consume el trial**, que es de por vida | `DEC-TRIAL-006`, impl. 2 |
| 2 | al **despublicar** una ficha en trial | que **el reloj del trial no se detiene** | cap. 11 §1.2 |
| 3 | al **borrar** una ficha | **qué addons se pierden y por cuánto** | `DEC-ADDON-001`, impl. 1 |
| 4 | Mi Suscripción y el panel | el **total acumulado de días de trial** y su origen | cap. 11 §3.5 |
| 5 | al **pausar estando en cortesía** | que **la pierde**, y dejarlo elegir | `DEC-GRANT-004`, cap. 01 §3 |
| 6 | al **reanudar** una pausa | **una sola cosa: qué día se le va a cobrar** — nada de días perdidos ni compensaciones | `DEC-SUB-010`, impl. 1 |
| 7 | al **cambiar de ciclo** teniendo una promo | que **el importe nuevo ya no lleva el descuento** | cap. 14 §2.3 |
| 8 | el aviso de **excedente** | **el criterio**: cae lo más reciente primero | `DEC-SUB-008`, cap. 03 §9 |
| 9 | cuando el excedente **no tiene ventana** | **qué se hizo**, no una ventana simulada | cap. 15 §4.4 |
| 10 | el aviso de **suspensión** | lo que pierde **como turista**, no sólo como anfitrión — y los **días de addon** que se le van a ir | cap. 15 §6.3, `DEC-ADDON-001` impl. 2 |
| 11 | la compra de **Turista VIP estando suspendido** | que **al regularizar se le cancela**, sin reembolso | cap. 15 §6.3, `DEC-ENT-004` |
| 12 | los **tres avisos de aumento** | precio actual, precio nuevo, **la fecha de ese cliente**, y que puede cancelar | `DEC-MP-002` |
| 13 | la confirmación de **revocar un grant** | que deja al cliente **sin servicio**, y qué addons corta | cap. 08 §3.1, cap. 16 §3.3 |
| 14 | el aviso de **discontinuar una vertical** | la **fecha de fin de servicio**, qué pasa con la ficha y **cómo exportarla** | cap. 10 §4.3 |

### 4.1 Dos reglas sobre cómo se dicen

1. **La confirmación dice qué va a pasar, no pregunta si estás seguro** (cap. 08 §3.1). *«¿Estás
   seguro?»* no transmite información: la persona ya decidió cuando llegó ahí.
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
§48 no enumera aunque el resto del PDR se las asigne— son las doce del capítulo 08 §3, cada una
con permiso propio, auditoría y confirmación explícita si es destructiva o mueve dinero.

Tres cosas que el panel necesita mostrar y que no son inspección de una entidad, sino la salida
de algo que este diseño creó:

| qué | por qué existe |
|---|---|
| el **listado accionable** de `RECONCILIATION_REQUIRED` | es el canal primario, y el correo es agregado (`DEC-OBS-001`) |
| las **versiones de plan retiradas** con cuántas suscripciones siguen ancladas | es lo que convierte la cola larga del retiro en algo que alguien puede decidir atacar (cap. 10 §3.4) |
| las **postulaciones de Partner atrasadas** y las **aprobadas sin reclamar** | nada vence por tiempo, así que la visibilidad es el único control (cap. 18 §2.3, §2.5) |

Y una que ya estaba decidida y conviene repetir acá porque es de superficie: **`SUPER_ADMIN` firma
toda concesión gratuita**, con el costo operativo declarado en el capítulo 08 §3.1 —el riesgo es
que se termine compartiendo la cuenta, y si aparece se resuelve con un permiso acotado, nunca con
una cuenta compartida—.

---

## 7. Pricing

El §47 pide **una pricing por vertical, Turista incluida**, y define tres situaciones: primer uso
(*Empezar*, que inicia esa vertical), trial (elegir plan e iniciar suscripción) y activo (plan
actual y cambio de plan).

Dos cosas que salen de capítulos anteriores y que la pricing tiene que respetar:

1. **Lee la versión vigente y vendible, nada más** (§2). Un plan retirado no aparece, aunque haya
   gente pagándolo.
2. **Que tenga pricing propia es Eje 2** (cap. 01 §4.3, ítem 8): la variación legítima es **su
   página**, no el motor que la alimenta. Una pricing que necesite lógica propia por vertical para
   resolver qué mostrar está resolviendo algo que ya resolvió el núcleo.

---

## Lo que este capítulo NO cierra

- **El ciclo de publicación de la presencia de Partner** (cap. 18): que existe y que la da el plan
  Gold está decidido; cómo se publica es diseño de producto, no de billing.
- **El diseño visual**, que no es materia de esta spec.
- **Qué endpoints expone la API**, uno por uno: lo que este capítulo fija es **qué lee cada
  superficie**, y de ahí sale la API. Enumerarla antes de FASE 3 sería anticipar el trabajo de las
  épicas.
