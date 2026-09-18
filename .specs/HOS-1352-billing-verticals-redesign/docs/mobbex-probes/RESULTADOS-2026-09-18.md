---
title: Mobbex — primera tanda de sondas
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-18
status: CURRENT
fase: 1C
---

# Mobbex · primera tanda medida — 2026-09-18

**Cuatro sondas, 20 llamadas, costo cero.** Contra la cuenta de demostración pública del
proveedor, con las credenciales que publica en
[mobbex.dev/primeros-pasos](https://mobbex.dev/primeros-pasos) — **sin registrarse, sin hablar con
nadie y sin mover un peso**. Con Mercado Pago, llegar a este punto costó tres días, una tarjeta
real del owner y un portón comercial.

> **Regla de lectura, la misma del §0 del programa**: nada se concluye del código de estado. Cada
> resultado de acá tiene su relectura o su control, y lo que no lo tiene está marcado como
> `SIN CONTROL`.

## § 0 · La regla dura de este proveedor, y aparece en la primera llamada

**En Mobbex el status HTTP no cierra nada: el que decide es el campo `result` del cuerpo.**

Medido en la sonda 01: `GET /p/entity` devuelve **`200`** con
`{"result":false,"code":"UAA","error":"Acceso no autorizado"}`. Un cliente que mire `res.ok`
—o `status < 300`— trata un acceso denegado como un éxito.

**Es el mismo `§0` que nos costó nueve filas con Mercado Pago, en otra forma**: allá el `2xx`
mentía sobre una mutación; acá miente sobre la autorización misma. La regla del capítulo 06 §4.1
—releer y comparar campo por campo— **se aplica igual a este proveedor**, y con un renglón más:
**mirar `result` antes que el status**.

## § 1 · Lo que salió MEJOR que Mercado Pago

### 1.1 La creación de suscripción ES idempotente · contra `EX-17`

| | |
|---|---|
| sonda | [02](./probe-02-el-alta.mjs) |
| medido | dos `POST /p/subscriptions/` con la **misma `reference`** |
| primera | `200` · `result:true` · uid `DTKD9WT1BQ43DQT6CR` |
| **segunda** | **`200` · `result:false` · `SUBSCRIPTIONS:ALREADY_EXISTS` «La suscripción ya existe.»** |

Con Mercado Pago, `EX-17` midió **diez creaciones, diez ids**, y ni `external_reference` ni
`X-Idempotency-Key` deduplicaban — el header se acepta y no hace nada. **Acá el proveedor rechaza
el duplicado.**

No cambia `DEC-CONC-001` —el candado nuestro sigue yendo antes de llamar—, pero **deja de ser la
única defensa**.

### 1.2 El checkout que devuelve, ANDA · contra `EX-37`

| | |
|---|---|
| sonda | [04](./probe-04-el-control-que-distingue.mjs) |
| medido | `POST /p/checkout` → `200`, `url: https://mobbex.com/p/checkout/v2/CHK:OIPBLK6P9OU4VZM03B` |
| **control** | **se pidió la URL: responde `200` con 33.543 bytes y el HTML no es una página de error** |

Es el control que con Mercado Pago faltó y salió caro: `EX-37` midió que el `init_point` viene con
`&activation=true` y esa URL abre *«Esta página no existe»*, con la API devolviendo `201` tan
campante. **Acá se pidió la URL y abre.**

### 1.3 Hay un endpoint que dice contra qué cuenta estamos · contra `EX-14`

`GET /p/entity/validate` devuelve `{"name":"CUENTA DEMO", ...}`. Con Mercado Pago, `live_mode`
venía `true` **también en sandbox** y lo único que distinguía el entorno era `GET /users/me` con
`tags:["test_user"]`. Acá hay un equivalente, y además cada objeto lleva su propio `test: true`.

## § 2 · Lo que salió PEOR, y es serio

### 2.1 El cobro a demanda sobre un suscriptor SIN tarjeta devuelve ÉXITO

**Es el hallazgo más importante de la tanda, y es malo.**

| | |
|---|---|
| sondas | [03](./probe-03-el-cobro-a-demanda.mjs) y [04](./probe-04-el-control-que-distingue.mjs) |
| medido | `POST /p/subscriptions/{id}/subscriber/{sid}/execution` con `total: 175` sobre un suscriptor que **nunca cargó una tarjeta** |
| respuesta | **`200` · `{"result":true,"data":{}}`** |
| ídem | el `GET` de la misma ruta —«ejecutar manualmente»— devuelve lo mismo |

**El control que lo cierra**, corrido en la sonda 04:

+ `GET /p/entity/operations?limit=25` → **0 filas** con nuestro sello;
+ `GET .../subscriber/{sid}/execution` → `{"result":true,"data":{}}`, **ninguna ejecución**;
+ el suscriptor releído sigue con `updated` en el instante de su creación (3 ms después de
  `created`): **los dos intentos de cobro no lo movieron**.

**Conclusión: aceptó dos cobros y no creó ninguna operación, con `result:true` en las dos.**

Esto es exactamente el patrón que hace caro a Mercado Pago —aceptar y descartar— **en el endpoint
del que depende toda la arquitectura que el owner quiere**: nosotros pedimos el cobro, el
proveedor cobra. Si ese pedido puede devolver éxito sin cobrar, **el éxito no es verificable por
la respuesta** y hay que confirmar cada cobro releyendo la operación.

> **Lo que todavía NO está medido, y hay que decirlo**: falta ver qué contesta el mismo endpoint
> sobre un suscriptor **que SÍ tiene tarjeta**. Es posible que el `data:{}` sea «no tengo con qué
> cobrar» mal reportado y que con tarjeta devuelva la operación. **Eso no lo salva**: el problema
> es que hoy los dos casos son indistinguibles desde la respuesta.

### 2.2 La tokenización server-side no está habilitada — y el error no lo dice

| | |
|---|---|
| medido | `POST /p/sources/token` → `200` · `result:false` · `GENERIC:EFCS` *«Execution failed. Please contact support with the case ID»* |
| **control** | **cuatro cuerpos distintos** — vacío, basura pura, tarjeta con número inválido, y la tarjeta de prueba del proveedor bien formada |
| resultado | **el mismo `GENERIC:EFCS` en los cuatro** |

**El error es del portero, no del cuerpo.** Coincide con lo que la documentación dice —la
tokenización directa exige escribirles a `operatoria@mobbex.com` y certificar **PCI DSS**—, pero
**el mensaje no lo dice**: un desarrollador sin el control de arriba pasa horas creyendo que arma
mal el request.

**No se concluye que la capacidad no exista.** Se concluye que **esta cuenta no la tiene**, y que
el proveedor no distingue «no tenés permiso» de «mandaste cualquier cosa».

**Consecuencia operativa**: sin tokenización, la tarjeta se carga por la `sourceUrl` que devuelve
el alta de suscriptor, o sea **con un navegador**. La batería no puede completar el ciclo de cobro
sin ese paso.

### 2.3 Un campo inventado se descarta en silencio

`POST /p/subscriptions/` con `campoQueNoExiste: 'hospeda'` → `200`, `result:true`, y la relectura
no lo trae. En la misma llamada, `setupFee: 99` **sí** se aplicó, verificado releyendo.

Es benigno comparado con `EX-5` de Mercado Pago —donde lo descartado era `items`, justo lo que se
preguntaba—, pero **confirma que este proveedor tampoco valida el cuerpo contra un esquema**.

### 2.4 Una suscripción `manual` vuelve con un `interval` que nadie mandó

Se creó con `type: 'manual'` y **sin** `interval`. La relectura trae **`interval: '1m'`**.

No es aceptar-y-descartar: es **aceptar y RELLENAR**. Hay que saber si ese `1m` es decorativo o si
el proveedor va a ejecutar cobros por su cuenta cada mes sobre una suscripción que creímos
manual. **Sin medir** — y es justo la diferencia entre «el ciclo es nuestro» y «el ciclo es suyo».

## § 3 · Inventario de lo creado

Cuenta de demostración **pública y compartida**: hay objetos de terceros ahí, así que **ningún
conteo global significa nada** y todo se busca por sello.

| sello | objeto | uid |
|---|---|---|
| `hos1352-1789701214886` | suscripción `dynamic` 1m | `BUKMU1DXUSY2J8CHTC` |
| | suscripción `manual` | `DAMKFD0ZN6TGI6BE30` |
| | suscripción de la prueba de idempotencia | `DTKD9WT1BQ43DQT6CR` |
| | suscripción del control de campos | `TVKI9Y97E23HB9Q92Y` |
| | **suscriptor** de la primera | `ZWOF5HCVGB12J5BGC0` |
| `hos1352-d-…` | checkout | `CHK:OIPBLK6P9OU4VZM03B` |

Todos con `test: true`. Manifiestos y bitácoras versionados al lado de cada sonda.

## § 4 · Lo que falta, en orden

1. **Cargar una tarjeta de prueba por la `sourceUrl`** (requiere navegador) y **recién entonces**
   medir el cobro a demanda de verdad: el estándar, el de monto libre, y el rechazado por CVV
   `400`. **Es lo que decide todo.**
2. **Un receptor de webhooks**, para medir si avisa, si firma y si avisa nuestras propias
   mutaciones. Las tres son incógnitas y la de la firma es la más grave.
3. **Qué hace realmente una suscripción `manual`** con el `interval` que el proveedor le puso.
4. **`action/schedule` vs. el cobro automático**: ¿se suman? Riesgo de doble cobro.
5. Pausa, reanudación, `action/move`, reembolsos.
