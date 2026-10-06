#!/usr/bin/env node
// =============================================================================
// SONDA 41 — Wallet Connect: ¿lo tenemos habilitado?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352.
//
// POR QUÉ EXISTE
// --------------
// Las sondas 38 a 40 midieron que `POST /v1/orders` funciona con estas
// credenciales —una orden con tarjeta tokenizada acreditó ARS 20— pero que
// TODO lo que menciona credencial guardada o pago automático devuelve
// `403 "The application is not authorized to perform this type of payment"`,
// con el mismo mensaje en cuatro variantes distintas.
//
// Esa sonda dejó una pregunta sin dueño: qué habilitación falta, exactamente.
//
// El owner preguntó por **Wallet Connect**, y ahí está la respuesta. La
// documentación oficial del proveedor describe el flujo completo:
//
//   1. `POST /v2/wallet_connect/agreements` (con `x-platform-id`)
//      → devuelve `agreement_id` y `agreement_uri`
//   2. el comprador aprueba el vínculo EN SU APP de Mercado Pago
//   3. `POST /v2/wallet_connect/agreements/{id}/payer_token` con el `code`
//      → devuelve un **`payer_token` de servidor, persistente**
//   4. `POST /v1/orders` con
//        payment_method: { type: 'wallet', id: 'wallet', token: <payer_token> }
//        stored_credential: { reason: 'recurring', payment_initiator: 'merchant' }
//
// **El paso 4 es, campo por campo, el request que las sondas 39 y 40 mandaron
// y que devolvió `403`.** O sea que el `403` que medimos no era un defecto del
// pedido: era la ausencia de esta habilitación.
//
// LO QUE CAMBIA SI ESTO ESTÁ DISPONIBLE
// -------------------------------------
// El `payer_token` de Wallet Connect NO es un token de tarjeta. Los de tarjeta
// son de un solo uso —medido el 2026-09-15: el segundo uso da
// `400 "Card token was used"`— y por eso no sirven para cobrar el mes que
// viene. Éste es persistente y se guarda cifrado del lado del servidor.
//
// Con eso, el ciclo de vida entero pasa a ser nuestro: pausar es no emitir la
// orden del mes, la cortesía es un mes sin orden, el cambio de ciclo es un
// campo nuestro, y un addon es otra línea. Nada de eso se le pide al proveedor.
//
// Y corrige una desventaja que le habíamos atribuido a este camino: **no se
// pierde el saldo en cuenta**. Al contrario — Wallet Connect ES la billetera.
// Lo que se pierde es al comprador que NO tiene cuenta de Mercado Pago, que
// hoy sí puede suscribirse con una tarjeta suelta.
//
// QUÉ MIDE
// --------
// Una sola cosa, y con el control que la hace legible: si
// `POST /v2/wallet_connect/agreements` existe para estas credenciales.
//
//   404  → el recurso no existe para esta cuenta
//   401  → la credencial no puede escribir ahí (como `/v1/customers`, que
//          en sandbox da `401` y en producción entra: NO es una respuesta
//          sobre la capacidad)
//   403  → existe y la aplicación no está habilitada — que es lo que la
//          documentación anticipa, porque dice que **no es autogestionable**
//   400  → existe, está habilitado y no le gustó el cuerpo. Sería la mejor
//          noticia posible.
//
// **Ninguno de esos códigos decide si lo podemos tener.** Wallet Connect se
// habilita comercialmente; esta sonda mide el estado de hoy, no la respuesta
// del proveedor a un pedido.
//
// SIN COSTO: sandbox, y un agreement sin aprobación del comprador no cobra
// nada. No toca ninguno de los tres relojes.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-41 node probe-41-wallet-connect.mjs
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-41';
const TOKEN = process.env.MP_ACCESS_TOKEN;

if (!TOKEN) {
    console.error('falta MP_ACCESS_TOKEN — hay que hacer `source` de las credenciales');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const guardar = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

async function llamar(nombre, metodo, ruta, cuerpo, headers = {}) {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...headers },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const texto = await res.text();
    let body;
    try {
        body = JSON.parse(texto);
    } catch {
        body = { __no_era_json: texto.slice(0, 400) };
    }
    if (cuerpo) guardar(`${nombre}.request`, { metodo, ruta, headers: Object.keys(headers), cuerpo });
    guardar(`${nombre}.response`, { http: res.status, cuerpo: body });
    const msg =
        body?.message ??
        body?.errors?.[0]?.message ??
        (Array.isArray(body) ? JSON.stringify(body).slice(0, 300) : JSON.stringify(body).slice(0, 300));
    console.log(`  ${nombre.padEnd(34)} HTTP ${String(res.status).padEnd(4)} ${msg}`);
    return { http: res.status, body };
}

console.log(`############ SONDA 41 — Wallet Connect · ${new Date().toISOString()}`);

// El control: `/v1/orders` con un cuerpo incompleto sigue devolviendo su `400`
// de validación. Si esto cambiara, cualquier cosa que midan las líneas de abajo
// no diría nada sobre Wallet Connect.
console.log('\n######## control — la API sigue contestando como ayer');
await llamar('control-orders', 'POST', '/v1/orders', { type: 'online' }, { 'X-Idempotency-Key': crypto.randomUUID() });

console.log('\n######## ¿existe Wallet Connect para esta cuenta?');
// Sin `x-platform-id` primero: si el rechazo fuera por el header, el mensaje
// tiene que nombrarlo, y eso ya sería una respuesta distinta de "no habilitado".
await llamar('wc-agreements-sin-platform', 'POST', '/v2/wallet_connect/agreements', {
    return_uri: 'https://www.hospeda.com.ar/wallet-connect/return',
    external_flow_id: `HOS-1352-s41-${Date.now()}`,
    external_user: 'hos1352-sonda'
});

await llamar(
    'wc-agreements-con-platform',
    'POST',
    '/v2/wallet_connect/agreements',
    {
        return_uri: 'https://www.hospeda.com.ar/wallet-connect/return',
        external_flow_id: `HOS-1352-s41-${Date.now()}`,
        external_user: 'hos1352-sonda',
        agreement_data: { description: 'HOS1352 sonda 41', amount: '20.00' }
    },
    { 'x-platform-id': 'hospeda' }
);

// Y una lectura, que no escribe nada: distingue "el recurso no existe" de
// "no podés crear pero el recurso está".
await llamar('wc-agreements-lectura', 'GET', '/v2/wallet_connect/agreements');

console.log(`
############ CÓMO SE LEE

  404 → el recurso no existe para esta cuenta
  401 → la credencial no puede escribir ahí. NO habla de la capacidad: es lo
        mismo que \`/v1/customers\`, que da 401 en sandbox y entra en producción
  403 → existe y la aplicación no está habilitada. Es lo que la documentación
        anticipa: Wallet Connect NO es autogestionable
  400 → existe, está habilitado, y sólo faltó armar bien el cuerpo

  Ninguno de los cuatro dice si lo podemos TENER. Eso se pide, no se mide.
  Los JSON crudos quedan en ${OUT}.
`);
