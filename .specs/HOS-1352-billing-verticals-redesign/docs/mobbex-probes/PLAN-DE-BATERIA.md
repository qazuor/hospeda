---
title: Batería de pruebas contra Mobbex — lista para disparar
linear: HOS-1352
statusSource: linear
created: 2026-09-18
updated: 2026-09-18
status: CURRENT
fase: 1C
---

# Batería contra Mobbex · lista para disparar

**Está todo escrito y probado en sintaxis. Falta UNA cosa: el `x-access-token`.**

El alta de la cuenta propia quedó en revisión manual el 2026-09-18 —*«dentro de 72hs hábiles
recibirás un mail»*— y sin entidad aprobada no hay token. Verificado con control:
`POST /2.0/entities/search` devuelve `200` vacío buscando por CUIT **y** por email: la entidad
todavía no existe, no es que la búsqueda falle.

---

## 0 · El gatillo — cuando llegue el mail

```bash
cd .specs/HOS-1352-billing-verticals-redesign/docs/mobbex-probes
```

**Paso 1 · vincular la entidad y sacar el token.** En
[mobbex.com/devportal](https://mobbex.com/devportal) → aplicación **«Hospeda HOS-1352
evaluacion»** (`bfgC3P5a0`) → botón `+` → **SOLICITAR ACCESO** → buscar por CUIT → autorizar.
El token de la entidad sale de ahí.

**Paso 2 · guardarlo.** En `~/.config/hospeda/mobbex-creds.sh`, que ya existe con la API key y
`chmod 600`, completar `MOBBEX_ACCESS_TOKEN`. **Fuera del repo, siempre.**

**Paso 3 · confirmar que entramos, antes de gastar una sola sonda.** Las sondas **leen ese
archivo solas**: no hace falta `source`, y por lo tanto da igual que la terminal sea fish —donde
`source` de un archivo con `export` falla—. Las variables de entorno, si están, tienen prioridad.

```bash
node -e "
import('./_comun.mjs').then(async ({ credenciales, quienesSomos }) => {
  const q = await quienesSomos(credenciales());
  console.log('cuenta:', q.nombre, '· uid', q.uid);
});"
```

Tiene que imprimir el nombre de **la cuenta propia**. Si dice `CUENTA DEMO`, son las credenciales
públicas y **la batería no sirve**: esa cuenta no aprueba ningún pago (0 de 12 operaciones con
código `200`, medido el 2026-09-18).

---

## 1 · El orden, y por qué ese orden

| # | comando | qué contesta | depende de |
|---|---|---|---|
| **05** | `node probe-05-preparar-sujetos.mjs` | crea los 6 sujetos y escribe el manifiesto | el token |
| **manual** | cargar las tarjetas por las URLs que imprime la 05 | sin tarjeta no hay cobro que medir | navegador |
| **06** | `node probe-06-el-cobro.mjs` | **el cobro a demanda** · monto libre · **idempotencia** · cobro denegado · prepaga · `schedule` | la 05 + tarjetas |
| **07** | `node probe-07-el-ciclo-de-vida.mjs` | pausa · reanudación · mutar monto · mutar ciclo · **`move`** · cancelar · reembolso | la 05 |
| **08** | `node probe-08-los-webhooks.mjs` | **¿firma?** · catálogo real de eventos · ¿avisa nuestras mutaciones? · ¿hay con qué ordenar? | que la 06 y la 07 hayan pasado |

**La 06 va antes que la 07** porque el cobro es lo único que justifica evaluar a este proveedor:
si el cobro a demanda no funciona, el resto no importa.

**La 08 va última** porque necesita que algo haya pasado. Si se corre antes, no mide «no avisa»:
mide que todavía no hubo nada que avisar, y son cosas distintas.

---

## 2 · El paso manual, que no se puede evitar

**La tokenización server-side NO está habilitada** y el error no lo dice: `GENERIC:EFCS
"Execution failed"`. El control lo desarmó —cuerpo vacío, basura, tarjeta inválida y tarjeta
válida dan **el mismo error**—, así que es del portero, no del cuerpo. La documentación lo
confirma: exige escribir a `operatoria@mobbex.com` y certificar **PCI DSS**.

Por eso cada tarjeta se carga a mano, en la `sourceUrl` que imprime la sonda 05.

| dato | valor |
|---|---|
| titular | `demo` |
| documento | `12123123` |
| vencimiento | `12/34` |
| **CVV** | **`200` aprueba · `400` deniega · `002` deja pendiente** (Amex: `0200`/`0400`/`0002`) |

> **Dos trampas medidas el 2026-09-18, para no perder media hora:**
>
> + **`form_input` no sirve en este formulario.** Escribe el DOM pero el framework no registra el
>   cambio: los tildes de validación aparecen y el envío va vacío. **Hay que tipear con teclado
>   real** (click en el campo y `type`).
> + **El CVV no toma al primer intento.** Pasó las dos veces: se carga, se mira, y si quedó vacío
>   se vuelve a hacer click y tipear. Verificar SIEMPRE con un screenshot antes de enviar.

**Y una regla que ya se ganó**: después de cargar, **verificar por API**, nunca por la pantalla.
El suscriptor tiene que quedar con `sources` no vacío y `activeSource` distinto de `null`. Una
pantalla verde no es una medición — el 2026-09-18 el checkout mostró «aprobado» y no existía
ninguna operación detrás.

---

## 3 · Lo que la batería NO puede contestar, y hay que decirlo de entrada

+ **La renovación automática tarda SIETE DÍAS.** El `interval` más corto de Mobbex es `7d`; no
  hay ciclo diario. Con Mercado Pago se leía un ciclo en 24 h. **Todo lo que dependa de que el
  proveedor cobre solo —renovación, grace, reintentos suyos— se lee recién el día 7.**
  El cobro a demanda no depende de eso: lo disparamos nosotros, y es el punto.
+ **El reembolso parcial, según su documentación, sólo se puede al día siguiente** del cobro. Si
  la sonda 07 lo rechaza por eso, **es el hallazgo**, no un error de la sonda.
+ **Nada de esto marca una fila de la matriz por sí solo.** El §58 exige experimento ejecutado con
  request, response y webhook registrados. Las sondas guardan las tres cosas; el traslado a
  `06-mp-validation-matrix.md` —o a la matriz que se abra para este proveedor— es un paso aparte
  y **se hace con el OK del owner**, como toda edición de esa matriz.

---

## 4 · Las cinco preguntas que deciden si Mobbex sirve

Ordenadas por lo que cambian. Si las dos primeras salen mal, no hace falta seguir.

1. **¿El cobro a demanda cobra de verdad, con monto libre?** Es la única razón por la que este
   proveedor está sobre la mesa. Sonda 06 §1.
2. **¿Es idempotente?** Con el ciclo de vida de nuestro lado, un reintento mal hecho es un doble
   cobro a un cliente real. Si no deduplica, el candado es nuestro y va antes de llamar — igual
   que `DEC-CONC-001`. Sonda 06 §1c.
3. **¿Los webhooks vienen firmados?** Si no, el receptor no puede distinguir un evento del
   proveedor de uno inventado. Sonda 08 §2.
4. **¿Avisa cuando mutamos nosotros?** Con Mercado Pago no (`EX-15`), y eso obligó a conciliar
   releyendo. Sonda 08 §1 y §3.
5. **¿Se puede provocar un cobro rechazado?** Con Mercado Pago resultó **imposible** (`PA-4`, los
   siete titulares), y eso dejó `RN-2`, `RN-3` y `GR-1..3` sin medir. Acá el CVV lo decide, y si
   funciona **es la ventaja más grande de todas**: se puede probar el camino del fallo sin gastar
   plata real en producción. Sonda 06 §2.

---

## 5 · Inventario de lo que quedó armado

| archivo | qué es |
|---|---|
| [`_comun.mjs`](./_comun.mjs) | credenciales desde el entorno, guard de cuenta, bitácora, y `comparar()` — la regla §4.1 hecha función |
| [`probe-05-preparar-sujetos.mjs`](./probe-05-preparar-sujetos.mjs) | crea los 6 sujetos, escribe el manifiesto, imprime las URLs de carga |
| [`probe-06-el-cobro.mjs`](./probe-06-el-cobro.mjs) | la sonda que decide |
| [`probe-07-el-ciclo-de-vida.mjs`](./probe-07-el-ciclo-de-vida.mjs) | pausa, mutación, mudanza, baja, reembolso |
| [`probe-08-los-webhooks.mjs`](./probe-08-los-webhooks.mjs) | lee el receptor y busca la firma |
| [`RESULTADOS-2026-09-18.md`](./RESULTADOS-2026-09-18.md) | lo ya medido contra la cuenta demo |
| sondas 01 a 04 | la primera tanda, contra la cuenta pública |

**El receptor de webhooks ya existe y está vivo**: es el mismo Worker que se usó con Mercado Pago
(`../mp-probes/probe-08-webhook-sink`), verificado con un POST de control el 2026-09-18 → `200`.
Guarda cada POST crudo con todos los headers, así que sirve igual acá. La sonda 05 apunta el
`webhook` de cada suscripción a `…/?fuente=mobbex&sujeto=<slug>&sello=<sello>`, y la 08 filtra por
`fuente=mobbex` para no mezclarse con lo de Mercado Pago.

---

## 6 · Las trampas de este proveedor, todas medidas

Están acá para no volver a tropezarlas, y cada una costó tiempo el 2026-09-18.

1. **El status HTTP no cierra nada.** `GET /p/entity` devuelve `200` con
   `{"result":false,"error":"Acceso no autorizado"}`. **Lo que decide es el campo `result`.**
   `_comun.mjs` ya lo hace: `ok` sale de `result`, nunca de `res.ok`.
2. **La clave del suscriptor es `uid`, no `sid`** — aunque la ruta se llame `.../subscriber/{sid}`.
   La sonda 02 se equivocó ahí y por eso no llegó a ejercer el cobro.
3. **Las ejecuciones NO están donde uno las busca.** No en `/p/entity/operations` ni en
   `GET .../subscriber/{sid}/execution`, que devuelve vacío: están en el campo `executions`
   **dentro del objeto suscriptor**. Ese error ya obligó a corregir un documento commiteado.
4. **Una suscripción `manual` vuelve con un `interval` que nadie mandó.** Acepta y RELLENA. Hay
   que medir si eso ejecuta cobros por su cuenta: es la diferencia entre «el ciclo es nuestro» y
   «el ciclo es suyo».
5. **Un campo inventado se descarta en silencio**, con `200` y `result:true`.
6. **El código `502` aparece en operaciones vivas y no figura en su tabla de códigos.**
