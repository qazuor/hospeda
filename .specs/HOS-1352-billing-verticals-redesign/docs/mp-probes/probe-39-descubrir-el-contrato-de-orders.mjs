#!/usr/bin/env node
// =============================================================================
// SONDA 39 — Descubrir el contrato de `/v1/orders` preguntándole al validador
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352.
//
// DE DÓNDE VIENE
// --------------
// La sonda 38 dejó dos cosas:
//   1. **`/v1/orders` EXISTE** para las credenciales de prueba y **valida el
//      cuerpo**: con un cuerpo incompleto devolvió `400` nombrando exactamente
//      qué faltaba (`missing properties: '$.external_reference'`, …).
//   2. **`POST /v1/customers` devolvió `401 access denied`**, que es el mismo
//      patrón que `/v1/payments` en sandbox (`RF-1`/`RF-2`): el vendedor de
//      prueba no puede escribir ahí. Eso **no dice nada sobre la capacidad**,
//      dice algo sobre la credencial — y por eso la sonda 38 no llegó a medir
//      lo que iba a medir.
//
// La documentación de "Pagos automáticos" arma el flujo alrededor de un
// `payer.customer_id` y un `payment_profile_id`, y los dos salen de endpoints
// que esta credencial no puede tocar. Pero la documentación describe UN camino,
// no necesariamente el único: el paso "registro con un primer cobro" sugiere
// que la primera orden puede llevar la tarjeta y **devolver** el perfil.
//
// LA TÉCNICA
// ----------
// El validador de `/v1/orders` nombra los campos que faltan. Eso lo convierte
// en un **oráculo del contrato**: se manda un cuerpo mínimo, se lee qué pide,
// se agrega, se vuelve a mandar. Cada paso es una medición con su request y su
// response en disco, y el contrato queda descubierto por el proveedor y no
// adivinado por mí.
//
// Es barato y no mueve plata: mientras el cuerpo esté incompleto, no hay cobro.
//
// LO QUE HAY QUE TENER CLARO ANTES DE LEER EL RESULTADO
// -----------------------------------------------------
// Tres finales posibles, y sólo uno responde la pregunta del owner:
//
//   (i)   Se llega a una orden completa **sin customer** y cobra → entonces el
//         mecanismo existe y es alcanzable, y la opción "nosotros manejamos el
//         ciclo, MP sólo cobra" está medida en sandbox.
//   (ii)  El validador termina exigiendo `customer_id` o un
//         `payment_profile_id` → entonces el camino existe pero **pasa por un
//         endpoint que esta credencial no puede usar**, y la pregunta queda
//         abierta hasta medirla en producción. **Eso NO es un "no se puede".**
//   (iii) Aparece un error que no habla del medio de pago → no contesta nada, y
//         hay que mirarlo en vez de elegir la interpretación cómoda.
//
// SIN COSTO: sandbox. No toca ninguno de los tres relojes.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-38 node probe-39-descubrir-el-contrato-de-orders.mjs
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
    console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const guardar = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

let paso = 0;
async function probar(etiqueta, cuerpo) {
    paso += 1;
    const nombre = `p39-${String(paso).padStart(2, '0')}-${etiqueta}`;
    const res = await fetch(`${API}/v1/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': randomUUID()
        },
        body: JSON.stringify(cuerpo)
    });
    const texto = await res.text();
    let body;
    try {
        body = JSON.parse(texto);
    } catch {
        body = { __no_era_json: texto.slice(0, 500) };
    }
    const copia = JSON.parse(JSON.stringify(cuerpo));
    const limpiar = (o) => {
        for (const k of Object.keys(o ?? {})) {
            if (k === 'token') o[k] = '(redactado)';
            else if (o[k] && typeof o[k] === 'object') limpiar(o[k]);
        }
    };
    limpiar(copia);
    guardar(`${nombre}.request`, copia);
    guardar(`${nombre}.response`, { http: res.status, cuerpo: body });

    const detalles =
        Array.isArray(body) && body[0]?.details
            ? body[0].details.join(' · ')
            : Array.isArray(body)
              ? JSON.stringify(body).slice(0, 400)
              : (body?.message ?? JSON.stringify(body).slice(0, 400));
    console.log(`\n--- ${etiqueta}  ·  HTTP ${res.status}`);
    console.log(`    ${detalles}`);
    return { http: res.status, body };
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
    return (await res.json())?.id ?? null;
}

console.log(`############ SONDA 39 — el validador de /v1/orders como oráculo · ${new Date().toISOString()}`);

const ref = () => `HOS-1352-s39-${Date.now()}`;

// Escalón 1 — lo mínimo que la sonda 38 supo que faltaba
await probar('minimo', { type: 'online', external_reference: ref(), total_amount: MONTO, transactions: {} });

// Escalón 2 — un pago vacío: ¿qué exige de un pago?
await probar('pago-vacio', {
    type: 'online',
    external_reference: ref(),
    total_amount: MONTO,
    transactions: { payments: [{}] }
});

// Escalón 3 — con monto: ¿qué falta ahora?
await probar('pago-con-monto', {
    type: 'online',
    external_reference: ref(),
    total_amount: MONTO,
    transactions: { payments: [{ amount: MONTO }] }
});

// Escalón 4 — con un medio de pago tokenizado y SIN customer.
// Éste es el que decide (i) contra (ii): si el validador acepta la tarjeta sin
// un customer, el camino no pasa por el endpoint que la credencial no puede usar.
const tok1 = await tokenizar();
const conTarjeta = (token, extra = {}) => ({
    type: 'online',
    external_reference: ref(),
    total_amount: MONTO,
    processing_mode: 'automatic',
    payer: { email: BUYER },
    transactions: {
        payments: [
            {
                amount: MONTO,
                payment_method: { id: 'master', type: 'credit_card', token, installments: 1 },
                ...extra
            }
        ]
    }
});
const e4 = await probar('tarjeta-sin-customer', conTarjeta(tok1));

// Escalón 5 — lo mismo, pidiendo GUARDAR el medio de pago para después.
// Si el proveedor devuelve un `payment_profile_id` acá, el registro NO necesita
// `/v1/customers` y la opción del owner es alcanzable con esta credencial.
const tok2 = await tokenizar();
const e5 = await probar(
    'tarjeta-guardando-perfil',
    conTarjeta(tok2, {
        automatic_payments: { retries: 3 },
        stored_credential: { payment_initiator: 'customer', reason: 'recurring', first_payment: true }
    })
);

// Qué devolvió: ¿hay perfil para reusar?
for (const [et, r] of [
    ['tarjeta-sin-customer', e4],
    ['tarjeta-guardando-perfil', e5]
]) {
    if (r.http >= 400) continue;
    const orden = r.body;
    const pago = orden?.transactions?.payments?.[0];
    console.log(`\n>>> ${et}: orden ${orden?.id} · ${orden?.status}/${orden?.status_detail}`);
    console.log(
        `    pago ${pago?.id} · ${pago?.status}/${pago?.status_detail} · monto ${pago?.amount} · ` +
            `perfil=${pago?.automatic_payments?.payment_profile_id ?? '— NINGUNO —'}`
    );
    const perfil = pago?.automatic_payments?.payment_profile_id;
    if (!perfil) continue;

    // -------------------------------------------------------------------------
    // LA PREGUNTA — el segundo cobro, sin el cliente y sin tarjeta nueva
    // -------------------------------------------------------------------------
    console.log('\n######## EL SEGUNDO COBRO — sin cliente, sin tarjeta, sin CVV');
    const segundo = await probar('segundo-cobro-sin-cliente', {
        type: 'online',
        external_reference: ref(),
        total_amount: MONTO,
        processing_mode: 'automatic',
        payer: { email: BUYER },
        transactions: {
            payments: [
                {
                    amount: MONTO,
                    automatic_payments: { payment_profile_id: perfil, retries: 3 },
                    stored_credential: {
                        payment_initiator: 'merchant',
                        reason: 'recurring',
                        first_payment: false,
                        previous_transaction_reference: String(pago?.id ?? pago?.reference_id ?? '')
                    }
                }
            ]
        }
    });
    if (segundo.http < 400) {
        // RELECTURA: un 2xx no prueba que cobró (§0; `PA-3` midió un
        // card_validation de ARS 0 donde parecía haber un cobro)
        const rel = await fetch(`${API}/v1/orders/${segundo.body?.id}`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        const j = await rel.json();
        guardar('p39-segundo-cobro.relectura', j);
        const p = j?.transactions?.payments?.[0];
        console.log(
            `    RELECTURA: ${j?.status}/${j?.status_detail} · pago ${p?.status}/${p?.status_detail} · monto ${p?.amount}`
        );
    }
}

console.log(`
############ FIN

  Lo que decide NO es que la orden entre: es el \`status\` del PAGO en la
  relectura. Los JSON crudos están en ${OUT}.

  Si el validador terminó exigiendo un \`customer_id\` o un
  \`payment_profile_id\`, esta sonda midió que el camino EXISTE y que esta
  credencial no lo alcanza — igual que \`RF-1\`/\`RF-2\`. Eso NO es un "no se
  puede": es una medición pendiente contra producción.
`);
