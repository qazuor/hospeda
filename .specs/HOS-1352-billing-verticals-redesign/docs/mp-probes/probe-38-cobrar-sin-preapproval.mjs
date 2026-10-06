#!/usr/bin/env node
// =============================================================================
// SONDA 38 — Cobrar de forma recurrente SIN `preapproval`
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352.
//
// POR QUÉ EXISTE
// --------------
// El owner preguntó qué pasaría si dejáramos de usar el modelo de suscripciones
// de Mercado Pago y manejáramos el ciclo de vida 100% nosotros, pidiéndole al
// proveedor **sólo que cobre**.
//
// Hasta esta sonda, la respuesta parecía ser "no se puede": la documentación de
// tarjetas guardadas dice que para tokenizar una tarjeta guardada hace falta
// **volver a capturar el código de seguridad**, porque el proveedor no lo puede
// almacenar. Con eso, cada renovación le pediría el CVV al cliente, que no es
// una renovación.
//
// Pero esa conclusión estaba mirando el flujo equivocado. Buscando por
// "merchant initiated transaction" apareció una familia que este programa NO
// había tocado, y que el proveedor documenta en el dominio de Argentina:
//
//     Pagos automáticos con Orders API
//     "realizar pagos recurrentes, pagos únicos sin fricción y one-click
//      payments SIN SOLICITAR EL CVV de tarjetas para cada transacción"
//     MIT (Merchant Initiated Transaction) / CIT (Customer Initiated)
//
// El contrato documentado es `POST /v1/orders` con un nodo `stored_credential`
// (`payment_initiator`, `reason: "recurring"`, `first_payment`,
// `previous_transaction_reference`) y un `automatic_payments.payment_profile_id`.
// **La recurrencia la define y la gestiona el vendedor**, no el proveedor.
//
// Si eso funciona, la opción de "nosotros manejamos todo y MP sólo cobra" deja
// de ser una hipótesis y pasa a ser un camino medido. Si no funciona, esa
// opción se cae con una razón concreta en vez de con una intuición.
//
// **Nada de esto se da por bueno desde la documentación** (§58): las docs de
// este proveedor ya se contradijeron con sus propios datos tres veces (el
// `2084`, el "Pagaste la suscripción" de un alta que no cobró, el "Cobramos
// $15" de un cargo inexistente). Acá se mide.
//
// QUÉ MIDE, EN ORDEN
// ------------------
//   P1  ¿Existe `/v1/orders` para estas credenciales? Un `404` dice que no; un
//       `400` de validación dice que existe y que no le gustó el cuerpo; un
//       `401` dice que la cuenta de prueba no puede escribir ahí —que es lo que
//       ya pasó con `/v1/payments` (`RF-1`/`RF-2`) y que NO sería una respuesta
//       sobre la capacidad sino sobre la credencial—.
//   P2  ¿Cómo se registra un medio de pago? Se prueban los caminos candidatos y
//       se registra el código de cada uno. Adivinar un endpoint no es medir:
//       por eso se prueban varios y lo que se anota es la respuesta de cada
//       uno, no la conclusión que convenga.
//   P3  El primer cobro, CON código de seguridad y `first_payment: true`.
//   P4  **LA PREGUNTA**: el segundo cobro, **sin ningún dato del cliente**,
//       con `first_payment: false` y `previous_transaction_reference`.
//
// P4 es la que decide. Si un segundo cobro entra sin el cliente presente,
// entonces el proveedor **sí** expone el mecanismo que la opción necesita, y el
// ciclo de vida puede vivir del lado nuestro.
//
// LA TRAMPA QUE HAY QUE EVITAR ACÁ
// --------------------------------
// Un `2xx` no prueba que cobró. `PA-3` ya midió que en producción autorizar no
// cobra en el acto y deja un `card_validation` de ARS 0; y el §0 lleva nueve
// casos de aceptar-y-no-aplicar. Por eso **cada orden se relee** y lo que se
// mira es el `status` del pago y el monto, no el código de estado del POST.
//
// SIN COSTO: sandbox, dinero de mentira. No toca ninguno de los tres relojes.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-38 node probe-38-cobrar-sin-preapproval.mjs
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-38';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const BUYER = process.env.MP_BUYER_EMAIL;
const MONTO = '20.00';

if (!TOKEN || !BUYER) {
    console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL — hay que hacer `source` de las credenciales');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const guardar = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

async function llamar(nombre, metodo, ruta, cuerpo, extraHeaders = {}) {
    const headers = {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...extraHeaders
    };
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const texto = await res.text();
    let json;
    try {
        json = JSON.parse(texto);
    } catch {
        json = { __no_era_json: texto.slice(0, 500) };
    }
    if (cuerpo) {
        const copia = JSON.parse(JSON.stringify(cuerpo));
        // el token de tarjeta nunca se escribe: este archivo va versionado
        const limpiar = (o) => {
            for (const k of Object.keys(o ?? {})) {
                if (k === 'token' || k === 'card_token_id') o[k] = '(redactado)';
                else if (o[k] && typeof o[k] === 'object') limpiar(o[k]);
            }
        };
        limpiar(copia);
        guardar(`${nombre}.request`, { metodo, ruta, cuerpo: copia });
    }
    guardar(`${nombre}.response`, { http: res.status, cuerpo: json });
    return { http: res.status, body: json };
}

async function tokenizar() {
    const res = await fetch(`${API}/v1/card_tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            card_number: '5031755734530604',
            security_code: '123',
            expiration_month: 11,
            expiration_year: 2030,
            cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } }
        })
    });
    const j = await res.json();
    return j?.id ?? null;
}

const err = (b) =>
    b?.message ??
    b?.error ??
    (Array.isArray(b?.errors) ? JSON.stringify(b.errors).slice(0, 300) : null) ??
    JSON.stringify(b ?? {}).slice(0, 300);

console.log(`############ SONDA 38 — cobrar sin preapproval · ${new Date().toISOString()}`);
console.log(`############ salida: ${OUT}\n`);

// -----------------------------------------------------------------------------
// P1 — ¿existe la familia `/v1/orders` para estas credenciales?
// -----------------------------------------------------------------------------
// Se manda un cuerpo DELIBERADAMENTE incompleto. Lo que se busca no es que
// funcione: es distinguir "no existe" (404) de "existe y falta algo" (400) de
// "no podés escribir acá" (401/403), que son tres respuestas distintas y una
// sola de ellas habla de la capacidad.
console.log('######## P1 — ¿existe /v1/orders?');
const p1 = await llamar('p1-orders-sonda', 'POST', '/v1/orders', { type: 'online' }, { 'X-Idempotency-Key': randomUUID() });
console.log(`  POST /v1/orders (cuerpo incompleto) → HTTP ${p1.http}`);
console.log(`    ${err(p1.body)}`);
console.log(
    `    → ${
        p1.http === 404
            ? 'NO EXISTE para esta cuenta'
            : p1.http === 401 || p1.http === 403
              ? 'EXISTE pero la credencial no puede escribir (como /v1/payments en sandbox: NO es una respuesta sobre la capacidad)'
              : 'EXISTE y validó el cuerpo'
    }\n`
);

// -----------------------------------------------------------------------------
// P2 — ¿cómo se registra el medio de pago?
// -----------------------------------------------------------------------------
console.log('######## P2 — registrar el medio de pago');

// (a) el camino clásico documentado: customer + card guardada
const cust = await llamar('p2a-customer', 'POST', '/v1/customers', {
    email: BUYER,
    first_name: 'HOS1352',
    last_name: 'Sonda38'
});
let customerId = cust.body?.id ?? null;
console.log(`  (a) POST /v1/customers → HTTP ${cust.http} · id: ${customerId ?? err(cust.body)}`);
if (!customerId) {
    // el proveedor rechaza un customer duplicado y devuelve el existente en el error
    const busca = await llamar('p2a-customer-search', 'GET', `/v1/customers/search?email=${encodeURIComponent(BUYER)}`);
    customerId = busca.body?.results?.[0]?.id ?? null;
    console.log(`      buscado por email → ${customerId ?? 'no encontrado'}`);
}

let cardId = null;
if (customerId) {
    const tok = await tokenizar();
    const card = await llamar('p2a-card', 'POST', `/v1/customers/${customerId}/cards`, { token: tok });
    cardId = card.body?.id ?? null;
    console.log(`      POST /v1/customers/{id}/cards → HTTP ${card.http} · card id: ${cardId ?? err(card.body)}`);
}

// (b) ¿existe un endpoint propio de "payment profiles"? Se PREGUNTA, no se supone.
//     Un 404 acá es una respuesta válida y se registra como tal.
for (const ruta of ['/v1/payment-profiles', '/v1/payment_profiles']) {
    const r = await llamar(`p2b-${ruta.replaceAll('/', '_')}`, 'GET', ruta);
    console.log(`  (b) GET ${ruta.padEnd(24)} → HTTP ${r.http} · ${err(r.body).slice(0, 90)}`);
}

// -----------------------------------------------------------------------------
// P3 — el PRIMER cobro, con el cliente presente
// -----------------------------------------------------------------------------
console.log('\n######## P3 — primer cobro (first_payment: true)');

const orden = (n, perfilId, extraStored) => ({
    type: 'online',
    external_reference: `HOS-1352-s38-${Date.now()}-${n}`,
    total_amount: MONTO,
    processing_mode: 'automatic_async',
    payer: { customer_id: customerId, email: BUYER },
    transactions: {
        payments: [
            {
                amount: MONTO,
                automatic_payments: {
                    payment_profile_id: perfilId,
                    retries: 3,
                    subscription: {
                        id: 'hos1352-sonda38',
                        sequence: { number: n, total: 12 },
                        invoice: {
                            id: `hos1352-inv-${n}`,
                            billing_date: new Date().toISOString().slice(0, 10),
                            period: { interval: 1, type: 'monthly' }
                        }
                    }
                },
                stored_credential: {
                    payment_initiator: 'customer',
                    reason: 'recurring',
                    ...extraStored
                }
            }
        ]
    }
});

let referenciaPrevia = null;
let perfil = cardId;

if (!perfil) {
    console.log('  (se saltea: no hay medio de pago registrado)');
} else {
    const p3 = await llamar('p3-primer-cobro', 'POST', '/v1/orders', orden(1, perfil, { first_payment: true }), {
        'X-Idempotency-Key': randomUUID()
    });
    console.log(`  POST /v1/orders → HTTP ${p3.http}`);
    if (p3.http >= 400) {
        console.log(`    ${err(p3.body)}`);
    } else {
        const ordenId = p3.body?.id;
        // RELECTURA: un 2xx no prueba que cobró (§0, y `PA-3` midió un
        // card_validation de ARS 0 donde parecía haber un cobro)
        const rel = await llamar('p3-primer-cobro.relectura', 'GET', `/v1/orders/${ordenId}`);
        const pago = rel.body?.transactions?.payments?.[0];
        console.log(
            `    RELECTURA: orden=${rel.body?.status}/${rel.body?.status_detail} · ` +
                `pago=${pago?.status}/${pago?.status_detail} · monto=${pago?.amount} · ref=${pago?.reference_id ?? '—'}`
        );
        referenciaPrevia = pago?.reference_id ?? pago?.id ?? null;
    }
}

// -----------------------------------------------------------------------------
// P4 — LA PREGUNTA: el segundo cobro, sin el cliente
// -----------------------------------------------------------------------------
console.log('\n######## P4 — segundo cobro SIN el cliente (first_payment: false)');
console.log('  Sin tokenizar nada nuevo, sin código de seguridad, sin que el cliente toque nada.');

if (!perfil) {
    console.log('  (se saltea: no hay medio de pago registrado)');
} else {
    const p4 = await llamar(
        'p4-segundo-cobro',
        'POST',
        '/v1/orders',
        orden(2, perfil, {
            payment_initiator: 'merchant',
            first_payment: false,
            ...(referenciaPrevia ? { previous_transaction_reference: referenciaPrevia } : {})
        }),
        { 'X-Idempotency-Key': randomUUID() }
    );
    console.log(`  POST /v1/orders → HTTP ${p4.http}`);
    if (p4.http >= 400) {
        console.log(`    ${err(p4.body)}`);
        console.log('    → si el error NO habla del medio de pago, no contesta la pregunta: hay que mirarlo');
    } else {
        const rel = await llamar('p4-segundo-cobro.relectura', 'GET', `/v1/orders/${p4.body?.id}`);
        const pago = rel.body?.transactions?.payments?.[0];
        console.log(
            `    RELECTURA: orden=${rel.body?.status}/${rel.body?.status_detail} · ` +
                `pago=${pago?.status}/${pago?.status_detail} · monto=${pago?.amount}`
        );
        console.log(
            `    → ${
                pago?.status === 'processed' || pago?.status === 'approved'
                    ? 'COBRÓ SIN EL CLIENTE. El ciclo de vida puede vivir de nuestro lado.'
                    : 'la orden entró pero el pago NO quedó aprobado: leer el status_detail antes de concluir'
            }`
        );
    }
}

console.log(`
############ FIN

  Ninguna conclusión sale del código de estado de un POST. Sale de las
  relecturas de arriba, y los JSON crudos están en ${OUT}.

  Si P1 devolvió 401/403, esta sonda NO midió la capacidad: midió la
  credencial, igual que \`RF-1\`/\`RF-2\` en sandbox. En ese caso la pregunta
  sigue abierta y hay que repetirla contra producción, que cuesta plata real y
  necesita autorización del owner.
`);
