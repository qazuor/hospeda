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

**F2 es la que nadie evaluó todavía y la que más barato podría salir**, porque conserva la
adquirencia local en ARS —que es lo que hace falta para cobrarle a un anfitrión argentino— y
reemplaza justo la parte que nos está doliendo.

**La pregunta que decide F2**: *¿alguna de esas plataformas soporta Mercado Pago —u otro
adquirente argentino— como gateway?* **No lo sabemos, y es lo primero que hay que averiguar.**

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
| 3 | limpiar la ventana de contexto | ⬜ |
| 4 | **investigación exhaustiva por candidato**: costos y comisiones, documentación, qué soporta y qué no, problemas reportados, comunidad | ⬜ |
| 5 | decidir el **orden de prueba** con el resultado del 4 | ⬜ |
| 6 | **empezar las pruebas** | ⬜ |

### 5.1 Qué tiene que traer el paso 4, por candidato

- **Comisiones** y costos fijos, y si hay licencia aparte
- **Plazos de liquidación**
- **Calidad de la documentación**: si contesta las ocho preguntas del §4.1 o si hay que medirlas
- **Qué soporta y qué no**, contra las ocho capacidades del capítulo 06
- **Problemas reportados**: issues de GitHub, Stack Overflow, foros, estado de los SDK
- **Comunidad y soporte**: si hay a quién preguntarle y si contesta
- **Si hay entorno de prueba usable**, y si se puede **provocar un cobro rechazado** — que con MP
  resultó imposible en sandbox, medido en siete intentos
- **Riesgo de continuidad**: quién es el dueño, si está en venta, si anuncia discontinuaciones

### 5.2 Lo que hay que preguntar explícitamente y no está en ningún folleto

1. ¿Soporta **Mercado Pago u otro adquirente argentino** como gateway? *(decide F2)*
2. ¿**Adyen** hace adquirencia local en ARS? *(es lo que usa Netflix, y es la pregunta del owner)*
3. ¿Se puede **provocar un cobro rechazado** en su entorno de prueba?
4. ¿Cuál es su **política de reintentos**, y está documentada sin contradecirse?

---

## 6. Lo que este documento NO resuelve

- **No recomienda ninguno.** El §58 no lo permitiría: todo el §3 es material de folleto.
- **No dice si conviene cambiar.** Eso sale del paso 5, con los datos del 4.
- **No frena la Master Spec.** Falta el capítulo 13 y no depende de esto: se apoya en el 06, que
  está escrito por capacidades.
- **No toca lo que ya está medido de MP.** Si al final nos quedamos, las 49 filas `VERIFIED`
  siguen valiendo.
