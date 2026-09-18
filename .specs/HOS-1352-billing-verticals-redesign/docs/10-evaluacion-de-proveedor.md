---
title: Evaluación de proveedor de pagos — alternativas a Mercado Pago
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
status: CURRENT
fase: 1C
---

# 10 · Evaluación de proveedor de pagos

## Por qué existe este documento

Lo pidió el owner el **2026-09-17**, después de tres días de medición contra Mercado Pago, con
estas palabras: *«ya van demasiadas cosas problemáticas con MP… antes de seguir, evaluemos usar
otro sistema»*.

**No es una decisión ni una recomendación.** Es el insumo para decidir: qué nos pasa hoy, qué
alternativas existen, qué habría que averiguar de cada una, y en qué orden probarlas.

## Lo que NO cambia si cambiamos de proveedor

Conviene decirlo primero porque quita presión a la decisión:

**La Master Spec no depende de Mercado Pago.** El §57 del PDR pidió abstracción de proveedor, y
el capítulo 06 la escribió como **ocho capacidades definidas por lo que el dominio necesita, no
por lo que MP ofrece**. Se dejaron afuera a propósito cinco cosas que MP sí hace —prorratear,
agendar una baja, aplicar descuento, otorgar trial y ordenar eventos— justamente para no
acoplarse.

**Cambiar de pasarela no invalida un solo capítulo de la spec.** Lo que cambia es qué filas de la
matriz de validación quedan en `VERIFIED` y cuáles vuelven a `UNKNOWN`.

---

## 1. Qué nos pasa con Mercado Pago, clasificado

Sobre **98 filas medidas**: 49 `VERIFIED`, **19 `NOT_SUPPORTED`**, 13 `PARTIALLY_SUPPORTED`,
17 `UNKNOWN`. El detalle está en [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md);
acá va la clasificación que decide si cambiar sirve.

### A · Fallas de integridad — responde bien y hace mal

**Es la categoría más cara, y la más específica de este proveedor.**

| # | qué | filas |
|---|---|---|
| A1 | **Acepta y no aplica**: devuelve `2xx` sobre operaciones que descarta en silencio | **9 casos**: `EX-5`, `EX-20`, `EX-21`, `EX-22`, `EX-24`, `EX-25`, `EX-27`, `EX-34`, `EX-35` |
| A2 | **El buscador miente en tres direcciones**: devuelve TODO (ignora `external_reference`), devuelve NADA (`status` inválido → `200` con `total: 0`), o devuelve **un subconjunto plausible** (15 de 69). Ninguno da error | `RC-1`, `RC-4` |
| A3 | **El `init_point` viene roto** y la API responde `201` con él. Bug abierto del proveedor | `EX-37` |
| A4 | **Mutar el monto no emite webhook.** El proveedor le escribe al cliente en el acto y a nosotros no nos avisa nunca | `EX-15` + `EX-3` |
| A5 | **No se distingue sandbox de producción** mirando el evento | `EX-14` |
| A6 | **Correos que sus propios datos desmienten** (*«pagaste la suscripción»* 26 min antes del cobro; *«cobramos $15»* sobre un cargo de $0), y **pausa y cancelación llegan idénticas** al cliente | `EX-3` |
| A7 | **`payer_id` inestable** para la misma persona y la misma cuenta | medido 2026-09-17 |
| A8 | **La documentación se contradice a sí misma** sobre reintentos: una página dice 4 en 10 días, otra dice 8 cada 4 días, y la medición dio 0 | 2026-09-17 |
| A9 | **`cancelled` con doble L**, y hay integraciones públicas rotas por matchear `canceled` | 2026-09-17 |

### B · Capacidades que faltan

Las 19 `NOT_SUPPORTED`. Las que más condicionaron el diseño:

| qué no se puede | consecuencia en la spec |
|---|---|
| **auto-reanudar una pausa** (`PS-4`) | el reloj de fin de pausa es nuestro, sí o sí |
| **correr la fecha de cobro de una viva** (`EX-34`) | no se puede diferir nada; `DEC-SUB-010` se apoya en esto |
| **mover de plan** (`EX-21`) y **cambiar el ciclo** (`EX-4`, `EX-24`, `EX-25`) | todo cambio de ciclo cancela y recrea (`DEC-SUB-006`) |
| **una autorización cubre un solo monto** (`EX-5`) | cada addon recurrente es un preapproval aparte (`DEC-ADDON-002`) |
| **la creación no es idempotente** (`EX-17`) | el candado contra el doble cobro es nuestro (`DEC-CONC-001`) |
| **un `card_token` es de un solo uso** (`EX-12`) | cada reintento re-tokeniza |
| **poner un trial a una viva** (`EX-35`) | la cortesía se implementa pausando (`DEC-GRANT-003`) |
| **sólo ARS** (`EX-18`) | la moneda existe en el modelo pero con un solo valor |
| **los reembolsos viven en una API que MP anuncia en discontinuación**, y su guía de migración **excluye explícitamente a las suscripciones** | `R-MP-01`, sin respuesta del proveedor |

### C · Restricciones del mercado — NO se arreglan cambiando de proveedor

**Esta sección es la que evita una mudanza inútil.**

| qué | por qué no lo arregla otro proveedor |
|---|---|
| **El banco honra el débito automático sobre una tarjeta pausada** | es política del emisor, no de la pasarela. Medido el 2026-09-17: `apagon` cobró y aprobó |
| **El cobro llega con retraso variable** (26 a 44 min medidos) | es el procesamiento de la red, no la API |
| **Rechazos por riesgo del adquirente** (`cc_rejected_high_risk`) | existe en toda la plaza… **pero un orquestador con fallback puede reintentar contra otro adquirente**, y eso sí es diferencial |

> **Hipótesis a verificar, no conclusión**: que las prepagas no sirvan para suscripciones es
> decisión de producto de MP, no una ley del mercado. Hay que confirmarlo con cada candidato.

---

## 2. La distinción que puede cambiar la respuesta entera

**Pasarela ≠ capa de suscripciones.** Casi todo nuestro dolor está en el **ciclo de vida**
—pausar, reanudar, cambiar de plan, reintentar, dunning— y **no** en procesar la tarjeta.

De ahí salen **tres formas posibles**, y hay que evaluarlas como tres, no como una:

| forma | qué implica | lo que arregla | lo que no |
|---|---|---|---|
| **F1 · Reemplazar la pasarela** | otra pasarela argentina con recurrencia propia | A y B, si la nueva es mejor | C |
| **F2 · Capa de suscripciones encima de la adquirencia local** | una plataforma gateway-agnóstica maneja el ciclo de vida; abajo sigue habiendo un adquirente argentino (puede seguir siendo MP) | **B casi entero**, y parte de A | C, y **hereda A1/A2 si abajo sigue MP** |
| **F3 · Merchant of record** | un tercero es el vendedor legal y nos liquida | A, B y parte de C | cambia el modelo fiscal y la relación con el cliente. **Decisión de negocio, no técnica** |
| **F4 · Quedarse en MP, SIN `preapproval`** | MP cobra cuando se lo pedimos, con tarjeta en archivo; el ciclo de vida es **nuestro** | **A casi entera y B casi entera** — ver §2.1 | C. Y **depende de un permiso que MP no nos dio**: es la prueba 0 del §5.0 |

**F2 es la que nadie evaluó todavía y la que más barato podría salir**, porque conserva la
adquirencia local en ARS —que es lo que hace falta para cobrarle a un anfitrión argentino— y
reemplaza justo la parte que nos está doliendo.

**La pregunta que decide F2**: *¿alguna de esas plataformas soporta Mercado Pago —u otro
adquirente argentino— como gateway?* **No lo sabemos, y es lo primero que hay que averiguar.**

### 2.1 F4 en detalle, y por qué va primera aunque probablemente no se pueda

**La idea**: que nosotros manejemos toda la suscripción —trial, pausa, cambio de plan,
reintentos, cancelación— y a MP le pidamos **sólo el cobro puntual de cada mes**, contra una
tarjeta en archivo, **sin que el cliente tenga que volver a entrar**.

**Eso existe, MP lo documenta para Argentina, y ya lo probamos** (`EX-31`, 2026-09-16). Se llama
*«pagos automáticos»* y la documentación del proveedor dice textualmente *«pagos recurrentes… sin
solicitar el CVV para cada transacción»*, con MIT explícito y **«la lógica de recurrencia definida
por el vendedor»**. El contrato es `POST /v1/orders` con `automatic_payments.payment_profile_id`
y `stored_credential`.

**Medido, con el control que lo distingue de un error nuestro:**

| pedido | resultado |
|---|---|
| la misma orden **sin** esos nodos | **`201`, y cobra de verdad** (`EX-30`) |
| sólo `stored_credential` · sólo `automatic_payments` · los dos · `payment_initiator: "merchant"` | **`403` los cuatro**, mensaje idéntico: *«The application is not authorized to perform this type of payment»* |

**El rechazo es del PERMISO, no del pedido.** No hay forma de armar el request que lo evite.

#### Lo que F4 resolvería si el permiso se consiguiera

| problema | qué pasa sin `preapproval` |
|---|---|
| *acepta y no aplica* — `EX-20`, `EX-21`, `EX-22`, `EX-24`, `EX-25`, `EX-34`, `EX-35` | **se evaporan**: son todas operaciones sobre la suscripción de MP, que dejaría de existir |
| no hay auto-reanudación de pausa — `PS-4`, `PS-6` | **pausar es no cobrar**; el reloj ya era nuestro |
| una autorización cubre un solo monto — `EX-5` | **un addon es un cobro más**, no un preapproval aparte |
| el `init_point` roto — `EX-37` | **no hay checkout por addon** |
| los correos del proveedor que mienten — `EX-3` | MP deja de administrar una suscripción, así que no le escribe al cliente sobre ella |
| **`GR-3`, la política de reintentos** | **deja de importar**: los reintentos pasan a ser nuestros, y el capítulo 12 ya está escrito así |
| **`R-MP-01`**, los reembolsos en una API en discontinuación | **se resuelve solo**: su guía de migración **excluye a las suscripciones**, así que dejar de ser una suscripción **nos incluye** |

#### Y la hipótesis en contra, que es fuerte

**La propia fila `EX-31` la dejó anotada el 2026-09-16**, y hay que leerla antes de entusiasmarse:

> *«Lo más plausible es que este `403` sea **el mismo portón comercial que `EX-32`** —el último
> paso de Wallet Connect es, campo por campo, este request— pero **eso no está medido**: son dos
> productos con nombres distintos.»*

Y `EX-32` (Wallet Connect) **sí tiene requisito publicado y medido: más de 100.000 usuarios**.
Hospeda tiene **3** relaciones de cobro vivas — tres órdenes de magnitud. **No es una negociación
que se pueda intentar.**

**Lo único que los separa**, y es lo que hace que la pregunta valga la pena: `stored_credential`

+ MIT es un producto **estándar de las redes de tarjetas** —tarjeta en archivo, iniciado por el
comercio—, que los adquirentes le dan a comercios comunes todo el tiempo. Wallet Connect es un
producto **de billetera**, y ahí el requisito de escala tiene sentido porque MP está dando acceso
a su base de usuarios. **Que compartan el request final no prueba que compartan el requisito
comercial.**

---

## 3. El inventario de opciones, completo

Todo lo que sigue es **de folleto, sin verificar**. Está anotado así a propósito: el §58 del PDR
dice *«NO alcanza documentación»*, y con MP ya nos pasó que dos páginas oficiales se
contradijeran.

### 3.1 Pasarelas argentinas con recurrencia propia · F1

| candidato | qué dice de sí mismo |
|---|---|
| **Mercado Pago** | el actual. Es la línea de base contra la que se compara |
| **Mobbex** | **orquesta entre Payway, Fiserv, Global Processing y Getnet con fallback automático**. Suscripciones por API, webhooks nativos, débito recurrente contra cuentas bancarias **y virtuales** |
| **Payway** (Prisma) | débito automático contra cuenta bancaria. Es infraestructura de adquirencia, no un producto de suscripciones. ⚠️ **Visa anunció en 2026 la compra de Prisma y Newpay** — cambio de dueño en curso |
| **PagoTIC** | pasarela argentina; capacidades de recurrencia **sin verificar** |
| **Ualá Bis** | cobros; actúa como agente de retención de AFIP (IIBB y ganancias) |
| **MODO** | billetera de los bancos; se menciona recurrencia en su plan premium |
| **Getnet** (Santander) | adquirente; aparece como uno de los que Mobbex orquesta |

### 3.2 Plataformas de suscripciones de LATAM · entre F1 y F2

| candidato | qué dice de sí mismo |
|---|---|
| **Rebill** | suscripciones para LATAM. **Reintentos inteligentes** —dice recuperar 71% de los pagos fallidos— y dunning por **WhatsApp, SMS y mail**. Acepta tarjetas, transferencias **y billeteras, Mercado Pago incluido**. Modelo de licencia, apunta a empresas medianas y grandes |

### 3.3 Capas de suscripción gateway-agnósticas · F2

| candidato | qué dice de sí mismo |
|---|---|
| **Recurly** | **independencia de gateway** y recuperación de pagos fallidos como su fuerte |
| **Chargebee** | **ruteo multi-gateway**, familias de planes, precios híbridos. Su módulo *Retain* hace dunning y funciona sobre cualquier plataforma de billing |
| **Lago** | open source, explícitamente agnóstico de procesador |
| **Stripe Billing** | atado a Stripe, que **no tiene adquirencia local en Argentina** |

### 3.4 Procesadores internacionales · F1 o F3

| candidato | qué dice de sí mismo |
|---|---|
| **Adyen** | **es quien procesa Netflix, Spotify, Airbnb y Uber**. Es la respuesta a *«qué usa Netflix»*. ❓ **Falta confirmar si hace adquirencia local en ARS en Argentina** |
| **dLocal** | cross-border para LATAM. Liquida en USD/EUR afuera, sin pasar por el BCRA |
| **Ebanx** · **Nuvei** | cross-border, mismo modelo |
| **Braintree** (PayPal) · **Worldpay** · **Checkout.com** | internacionales; adquirencia local en AR **sin verificar** |

### 3.5 Merchant of record · F3

**Paddle**, **Lemon Squeezy**, **FastSpring**. Son el vendedor legal ante el cliente. Resuelven
impuestos y suscripciones de una, **pero cambian quién le factura al anfitrión**. Es una decisión
comercial y legal antes que técnica.

### 3.6 Descartados, con motivo

| descartado | por qué |
|---|---|
| **Stripe** (directo) | **no hace adquirencia local en Argentina**: no puede cobrar ARS a una tarjeta argentina. Sólo entra por la vía de merchant of record |
| **Rapipago**, **PagoFácil** | efectivo en mostrador. **No pueden respaldar un débito automático** — no hay a qué debitarle |

---

## 4. Cómo se compara, y ya tenemos el instrumento

> **La matriz de 98 filas no es sobre Mercado Pago: es sobre lo que el dominio necesita.**

Se corre **la misma matriz** contra cada candidato. Mismas preguntas, mismas sondas, mismo
criterio de `VERIFIED`. La comparación deja de ser de folletos y pasa a ser de mediciones.

**Con una ventaja que no teníamos en septiembre**: ya sabemos qué preguntar. Las filas que más
duelen —*¿acepta y aplica?*, *¿el buscador dice la verdad?*, *¿mutar emite webhook?*— salieron de
que MP nos mintiera. Contra un proveedor nuevo esas preguntas se hacen **el primer día**.

### 4.1 Las preguntas eliminatorias

Si un candidato falla una de éstas, no hace falta seguir midiéndolo:

1. ¿**Cobra en ARS** a una tarjeta argentina, con adquirencia local?
2. ¿Tiene **suscripciones recurrentes** de verdad, no pagos únicos repetidos?
3. ¿Se puede **mutar el monto** de una suscripción viva, y **se aplica de verdad**?
4. ¿**Emite webhook** cuando algo cambia, incluida una mutación nuestra?
5. ¿Se puede **pausar y reanudar**, con reanudación automática?
6. ¿La **creación es idempotente**?
7. ¿**Reembolsa**, y sobre una API que no esté anunciada en discontinuación?
8. ¿El **buscador** devuelve lo que se le pide?

Las 3, 4 y 8 son las que MP falla, y son las que más código defensivo nos costaron.

---

## 5. El plan, y dónde estamos

Acordado con el owner el 2026-09-17:

| # | paso | estado |
|---|---|---|
| 1 | buscar todas las opciones posibles | ✅ §3 |
| 2 | escribir este documento | ✅ |
| 3 | limpiar la ventana de contexto | ✅ 2026-09-17 |
| **0** | **PRUEBA 0 — preguntarle a MP por `automatic_payments`** (§5.0). **Va primera**, por decisión del owner el 2026-09-17 | 🟡 **los dos textos redactados y los dos canales identificados. Falta que el owner los envíe**: el formulario comercial pide un dato suyo (facturación esperada) y el ticket técnico exige su sesión |
| 4 | **investigación exhaustiva por candidato**: costos y comisiones, documentación, qué soporta y qué no, problemas reportados, comunidad | ⬜ |
| 5 | decidir el **orden de prueba** con el resultado del 4 | ⬜ |
| 6 | **empezar las pruebas** | ⬜ |

### 5.0 PRUEBA 0 — `automatic_payments` de Mercado Pago

**Va antes que todo lo demás**, y no porque sea la más prometedora sino porque **su respuesta
decide si el paso 4 arranca con una duda o con una conclusión ya ganada**:

+ **si es el mismo portón comercial que Wallet Connect** → MP **estructuralmente no puede** darnos
  cobro recurrente sin `preapproval`. Las 19 `NOT_SUPPORTED` y las nueve fallas de integridad son
  **inevitables con ellos**, y evaluar alternativas deja de ser prudencia: es necesario;
+ **si es un permiso comercial común** → **F4 es de lejos lo más barato** y no hace falta mudarse.

**No es un desarrollo: es una pregunta a soporte del proveedor**, con la evidencia adjunta.

#### El `403` está explicado por la documentación del proveedor — lectura del 2026-09-17

**El producto publica su requisito, y el requisito es comercial.** La página de resumen de
*Pagos automáticos* en el sitio argentino
([`/developers/es/docs/automatic-payments-orders/landing`](https://www.mercadopago.com.ar/developers/es/docs/automatic-payments-orders/landing),
leída el 2026-09-17) lista **dos** requisitos previos, y el segundo dice, textual:

> **Contacto con representante Comercial**
>
> Es necesario contar con la autorización del equipo Comercial para poder utilizar esta solución.

Tres cosas se siguen de ahí, y ninguna estaba escrita antes:

1. **El `403` de la sonda 40 no es un bug ni un alcance de credencial mal pedido**: es el portón
   que el proveedor declara por escrito. Deja de haber una hipótesis de que armamos mal el
   request — ya estaba descartada por el control, y ahora además está explicada.
2. **Quien habilita es Comercial, no soporte técnico.** Eso cambia a quién se le pregunta, no qué
   se pregunta.
3. **La página no publica ningún umbral** de volumen, facturación ni usuarios. **Eso no prueba que
   no exista**: es exactamente la trampa que `EX-32` ya dejó anotada —el umbral de Wallet Connect
   tampoco está en su página de *prerrequisitos*, y este documento llegó a afirmar que no había
   mínimo—. Se verificó el 2026-09-17 que la página de prerrequisitos de Wallet Connect **sigue
   sin mencionarlo**, así que en este proveedor **la ausencia en esa clase de página no es
   evidencia de nada**.

> ⚠️ Esto es **lectura de documentación, no una medición**. Por el §58 no marca ninguna fila de la
> matriz. Lo que aporta es a **quién** se dirige la pregunta y con qué cita se abre.

**La pregunta, textual:**

> ¿Qué requisitos tiene que cumplir una aplicación para que se le habilite **`automatic_payments`
> con `stored_credential`** en `POST /v1/orders`? ¿Es el mismo requisito de elegibilidad que
> **Wallet Connect** (más de 100.000 usuarios), o es un permiso comercial independiente?

**La evidencia que va adjunta:**

| | |
|---|---|
| error exacto | `403 "The application is not authorized to perform this type of payment"` |
| control que descarta un error nuestro | la **misma orden sin esos nodos** devuelve `201` y cobra (`EX-30`) |
| variantes probadas, todas con el mismo `403` | sólo `stored_credential` · sólo `automatic_payments` · las dos · `payment_initiator: "merchant"` sin perfil |
| fecha y sonda | 2026-09-16, [sonda 40](./mp-probes/probe-40-que-dispara-el-403-de-pagos-automaticos.mjs) |
| contexto del negocio | plataforma de suscripciones mensuales, ARS, ticket bajo, en crecimiento |

#### Por dónde se manda — dos canales públicos, y ninguno es opcional

El owner confirmó el 2026-09-17 que **no hay representante comercial asignado**, así que se entra
por la vía pública. Son dos canales distintos y **cada uno contesta una cosa que el otro no**:

| canal | qué es | qué contesta |
|---|---|---|
| **Formulario comercial** — [`/herramientas-para-vender/cobrar/contacto`](https://www.mercadopago.com.ar/herramientas-para-vender/cobrar/contacto) | público, sin sesión. Pide nombre, empresa, mail, teléfono, **facturación mensual de e-commerce (real o esperada)**, rubro y un campo **Mensaje** libre | **la habilitación misma**. Es el equipo que la doc nombra |
| **Centro de soporte técnico** — [`/developers/es/support/center`](https://www.mercadopago.com/developers/es/support/center) | **requiere iniciar sesión** con la cuenta de Mercado Pago | el **criterio** de elegibilidad, y `R-MP-01`, que es técnica y no le corresponde a Comercial |

> ⚠️ **El campo de facturación decide si el lead se lee o se descarta**, y es una declaración
> comercial del owner, no un dato técnico: hoy hay **3 relaciones de cobro vivas** (`07`). El
> formulario admite la **esperada**, que es el número honesto para una plataforma que está
> abriendo su cobro. **Lo completa el owner; este documento no lo propone.**

#### Texto 1 — formulario comercial, campo «Mensaje»

> Hola. Integro pagos con Mercado Pago para Hospeda, una plataforma de alojamientos turísticos
> con planes de suscripción mensual en pesos.
>
> Escribo por un requisito que la propia documentación les remite a ustedes: la página de
> resumen de **Pagos automáticos** (`/developers/es/docs/automatic-payments-orders/landing`)
> dice que *«es necesario contar con la autorización del equipo Comercial para poder utilizar
> esta solución»*. Vengo a solicitar esa autorización.
>
> Qué necesitamos habilitar: **`automatic_payments` con `stored_credential` en
> `POST /v1/orders`**, para cobrar la renovación mensual contra una tarjeta ya registrada, sin
> pedirle al cliente que vuelva a ingresar sus datos.
>
> Hoy ese pedido devuelve **`403 "The application is not authorized to perform this type of
> payment"`**. La misma orden **sin** esos campos devuelve `201` y cobra correctamente, así que
> el rechazo es de permisos y no del request.
>
> Dos consultas concretas:
>
> 1. ¿Cuáles son los requisitos de elegibilidad para esta autorización, y cómo se solicita
>    formalmente?
> 2. ¿Es el mismo criterio de elegibilidad que **Wallet Connect** (más de 100.000 usuarios), o
>    es una habilitación independiente?
>
> Cuenta: `3497516165`. Aplicación: `<ID de la aplicación>`.
>
> Gracias.

#### Texto 2 — ticket en el centro de soporte técnico

**El pedido del owner el 2026-09-17**: que el ticket **cuente todo lo que probamos y todo lo que
nos pasó**, no sólo el `403`. El motivo es que **la respuesta útil puede no ser la que estamos
pidiendo**: si hay un producto o una configuración que no estamos viendo, la única forma de que
nos la ofrezcan es que sepan qué estamos intentando hacer y contra qué chocamos.

**Asunto**: *Suscripciones: limitaciones medidas en `preapproval` y solicitud de elegibilidad para
`automatic_payments` en `POST /v1/orders`*

> Hola. Escribo por la cuenta `3497516165`, aplicación `<ID de la aplicación>`.
>
> Somos una plataforma de alojamientos turísticos que cobra **suscripciones mensuales en ARS** a
> sus anfitriones. Durante los últimos días evaluamos a fondo la API de suscripciones para
> implementar el ciclo de vida completo del producto, y llegamos a varias limitaciones que nos
> bloquean. **Antes de decidir cómo seguir, queremos preguntarles si hay algún producto o
> configuración que no estemos viendo.**
>
> **Cómo medimos**: cada resultado se verificó **releyendo el recurso** después de la operación y
> comparando campo por campo, y cada prueba se acompañó de un control que distingue *«el proveedor
> lo rechazó»* de *«no llegó a evaluarse»*. Si alguno de estos puntos es un error nuestro de
> método, nos sirve muchísimo que nos lo digan.
>
> **Qué necesita hacer nuestro producto**: alta con prueba gratis, cambio de plan, cambio de ciclo
> (mensual ↔ anual), pausa temporal con reanudación, cortesías de N meses, adicionales
> contratables aparte, baja, y recuperación de un cobro fallido.
>
> ---
>
> **1 · Operaciones que responden `2xx` y no se aplican**
>
> Es el grupo que más nos preocupa, porque no hay error que detectar: la API responde bien y el
> cambio no ocurre.
>
> + **Cambiar la frecuencia** de una suscripción autorizada: `PUT /preapproval/{id}` con
>   `auto_recurring.frequency` → **`200`** y `frequency` sigue en 1. Cuatro intentos (3 meses, 12
>   meses, `days`), en sandbox y en producción.
> + **Mover una suscripción viva de un plan a otro**: `PUT` con `preapproval_plan_id` → **`200`** y
>   la relectura sigue mostrando el plan anterior. *Control*: el mismo `PUT` con sólo `back_url` sí
>   se aplica, y mandando los dos juntos se aplica `back_url` y se ignora el plan.
> + **Correr la fecha del próximo cobro** de una suscripción viva: cuatro formas
>   (`auto_recurring.start_date`, `next_payment_date`, `auto_recurring` completo,
>   `auto_recurring.billing_day`) → **`200` las cuatro**, y `last_modified` **congelado** en las
>   cuatro. *Control*: un `PUT` de `transaction_amount` sobre la misma suscripción sí entra y mueve
>   `last_modified`.
> + **Poner un `free_trial` a una suscripción ya viva** → **`200`**, `free_trial` sigue en `null`.
> + **Un `PUT` con varios campos se aplica a medias, con un solo `200`**: `frequency: 6` +
>   `transaction_amount: 99` → el monto cambia y la frecuencia no. `end_date` +
>   `transaction_amount: 77` → el monto cambia y el `end_date` no aparece.
> + **Cubrir más de un monto con una misma autorización**: `auto_recurring` como array → `400`;
>   el campo `items` → **`201`** y se descarta (no vuelve en la respuesta).
> + **`repetitions` sin plan** → **`201`** y el campo queda ausente en la relectura.
> + **`currency_id: "USD"` sobre una autorizada** → **`200`** y sigue en ARS. Al **crear**, la misma
>   moneda da `400`.
> + **`X-Idempotency-Key` en `POST /preapproval`**: no deduplica. Diez creaciones, diez ids. Con la
>   misma clave y **monto distinto** devuelve un tercer `201` con el monto nuevo. Como una creación
>   con `card_token_id` cobra en el acto, un reintento nuestro son dos cobros.
>
> **2 · Capacidades que no encontramos**
>
> + **Reanudar una pausa automáticamente**: no encontramos un `pauseUntil` ni equivalente. Una
>   suscripción pausada seguía `paused` **24,5 h después**, con `last_modified` en el instante de la
>   pausa.
> + **El ciclo que vence estando pausada avanza `next_payment_date` sin cobrar**, y al reanudar no
>   hay recuperación de ese período: el tiempo pago se pierde.
> + **Editar el ciclo de un plan no alcanza a los ya suscriptos**, mientras que **editar el monto sí
>   los alcanza**. Nos sorprendió la asimetría: medido sobre los mismos sujetos.
> + **Un `card_token` sirve una sola vez**, así que cada reintento de alta requiere re-tokenizar.
> + **Sólo ARS** (`site_id: MLA`): `USD` y `BRL` → `400`.
>
> **3 · Comportamientos que nos parecen defectos, y queremos confirmar con ustedes**
>
> + **El `init_point` que devuelve `POST /preapproval` no funciona**: viene con `&activation=true` y
>   esa URL abre *«Esta página no existe»*. Sin ese parámetro abre el checkout normal. Reproducido
>   con la cuenta productiva; hay un issue abierto sin respuesta desde el 2026-09-04
>   ([sdk-nodejs#480](https://github.com/mercadopago/sdk-nodejs/issues/480)). Es serio: la API
>   responde `201` con un dato que parece válido y el cliente no se suscribe.
> + **Mutar el monto no emite ninguna notificación**: ventana de 91 s sin eventos, con la mutación
>   aplicada y la `version` del recurso saltando de 5 a 9. Crear, pausar, reanudar y cancelar sí
>   notifican. Al **cliente** ustedes sí le avisan del cambio de precio por correo; a nosotros no.
> + **El `search` de `/preapproval` devuelve resultados incorrectos de tres formas distintas**, y
>   ninguna da error: `external_reference` **se ignora** (devuelve todo el universo); un `status`
>   inválido devuelve `200` con `total: 0`; y en producción `status=cancelled` devolvió **15 filas
>   cuando recorriendo sin filtro hay 69**. Además el `search` trae `next_payment_date: null` y
>   `summarized: {}` donde el `GET` del mismo recurso, en el mismo momento, trae los valores reales.
> + **`live_mode: true` en eventos de la cuenta de prueba** (`tags: ["test_user"]`): no encontramos
>   forma de distinguir sandbox de producción mirando el evento.
> + **Una `start_date` futura se convierte en un `free_trial` sola**: el request no menciona
>   `free_trial` y el objeto queda con uno, y al comprador se le anuncia *«Tu prueba gratis
>   comenzó»*. Reproducido tres veces. Nos afecta porque compensar días ya pagados corriendo la
>   fecha le anuncia al cliente una prueba gratis que no le dimos.
> + **El `free_trial` de un plan no lo decide el request**: dos altas del mismo pagador sobre el
>   mismo plan, con requests idénticos y 3 segundos de diferencia, dieron una con `free_trial` y
>   otra con `null`. Reproducido tres veces sobre tres planes nuevos. No logramos identificar el
>   criterio, y nos importa porque no podemos anunciarle al cliente la fecha del primer cobro desde
>   lo que mandamos.
> + **`PUT {card_token_id}` puede fallar con `402 {"message":"Unknown error","error":null,"cause":null}`**:
>   el motivo real sólo aparece en el pago de validación de ARS 0, que hay que ir a buscar aparte.
> + **`400 code 2084 "This transaction does not support to be refunded"`**: sobre **el mismo pago**
>   de ARS 15, `amount: 5` se rechazó y `amount: 14` entró minutos después. Descartamos cuatro
>   hipótesis y no dimos con la regla.
> + **La documentación de reintentos de cobro se contradice**: una página indica 4 intentos en 10
>   días y otra 8 cada 4 días. ¿Cuál rige hoy en Argentina?
>
> **4 · Lo que no pudimos ensayar en el entorno de pruebas**
>
> + **No se puede asociar una tarjeta que rechace**: los siete titulares de rechazo
>   (`CALL`, `SECU`, `CONT`, `EXPI`, `FORM`, `FUND`, `OTHE`) dan `400 CC_VAL_433` al crear y `402`
>   al cambiar el medio de pago. *Control*: `APRO` sobre el mismo sujeto y endpoint funciona. **No
>   tenemos forma de ensayar un cobro fallido**, que es justamente el caso que más nos importa
>   manejar bien. ¿Hay alguna manera de provocarlo en sandbox?
> + La casilla del comprador de prueba no es accesible, así que no podemos ver los correos que
>   ustedes le envían al cliente sin usar la cuenta real.
>
> ---
>
> **5 · Lo que buscamos, y las tres preguntas**
>
> Frente a esto evaluamos **manejar nosotros el ciclo de vida** y pedirle a Mercado Pago sólo el
> cobro mensual contra una tarjeta en archivo, con `automatic_payments` + `stored_credential` en
> `POST /v1/orders`. Hoy ese pedido devuelve
> **`403 "The application is not authorized to perform this type of payment"`**. Lo probamos el
> 2026-09-16 con el control correspondiente: la **misma orden sin esos nodos** devuelve `201` y
> cobra, y cuatro variantes dan el mismo `403` (sólo `stored_credential`; sólo `automatic_payments`;
> las dos juntas; `payment_initiator: "merchant"` sin perfil de pago). Entendemos por la
> documentación del producto que la autorización la otorga el equipo Comercial, y ya la
> solicitamos por el formulario.
>
> 1. **Dado el caso de uso descripto, ¿hay algún producto, endpoint o configuración que no estemos
>    considerando?** Es la pregunta más importante de este ticket.
> 2. **¿Cuáles son los requisitos de elegibilidad de `automatic_payments` con `stored_credential`, y
>    son los mismos que los de Wallet Connect** (más de 100.000 usuarios) **o es una habilitación
>    independiente?**
> 3. **Reembolsos**: el panel anuncia que la API de Payments se descontinúa y la guía de migración a
>    Orders **excluye explícitamente a las suscripciones**. ¿La discontinuación alcanza también a las
>    **lecturas** de `/v1/payments`? ¿En qué fecha? Y cuando se retire, **¿por qué endpoint se
>    reembolsa un cobro originado por un `preapproval`**?
>
> Quedamos a disposición para enviar los `request`/`response` completos de cualquiera de estos
> puntos, con sus ids.
>
> Gracias.

<!-- separador: termina el texto del ticket y empieza la nota sobre R-MP-01 -->

> **`R-MP-01` va montado en el mismo ticket, a propósito.** Es la consulta pendiente de mayor
> latencia —pregunta por el futuro del proveedor, así que no se puede medir— y viaja gratis en un
> ticket que de todos modos hay que abrir. Está incorporada como punto 2 del Texto 2.

### 5.1 Qué tiene que traer el paso 4, por candidato

+ **Comisiones** y costos fijos, y si hay licencia aparte
+ **Plazos de liquidación**
+ **Calidad de la documentación**: si contesta las ocho preguntas del §4.1 o si hay que medirlas
+ **Qué soporta y qué no**, contra las ocho capacidades del capítulo 06
+ **Problemas reportados**: issues de GitHub, Stack Overflow, foros, estado de los SDK
+ **Comunidad y soporte**: si hay a quién preguntarle y si contesta
+ **Si hay entorno de prueba usable**, y si se puede **provocar un cobro rechazado** — que con MP
  resultó imposible en sandbox, medido en siete intentos
+ **Riesgo de continuidad**: quién es el dueño, si está en venta, si anuncia discontinuaciones

### 5.2 Lo que hay que preguntar explícitamente y no está en ningún folleto

1. ¿Soporta **Mercado Pago u otro adquirente argentino** como gateway? *(decide F2)*
2. ¿**Adyen** hace adquirencia local en ARS? *(es lo que usa Netflix, y es la pregunta del owner)*
3. ¿Se puede **provocar un cobro rechazado** en su entorno de prueba?
4. ¿Cuál es su **política de reintentos**, y está documentada sin contradecirse?

---

## 6. Lo que este documento NO resuelve

+ **No recomienda ninguno.** El §58 no lo permitiría: todo el §3 es material de folleto.
+ **No dice si conviene cambiar.** Eso sale del paso 5, con los datos del 4.
+ **No frena la Master Spec.** Falta el capítulo 13 y no depende de esto: se apoya en el 06, que
  está escrito por capacidades.
+ **No toca lo que ya está medido de MP.** Si al final nos quedamos, las 49 filas `VERIFIED`
  siguen valiendo.
