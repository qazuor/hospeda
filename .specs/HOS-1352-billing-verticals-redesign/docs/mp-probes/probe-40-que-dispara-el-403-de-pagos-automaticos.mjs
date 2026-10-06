#!/usr/bin/env node
// =============================================================================
// SONDA 40 — ¿Qué dispara el `403` de pagos automáticos?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352.
//
// DE DÓNDE VIENE
// --------------
// La sonda 39 midió dos cosas que hay que separar antes de sacarles conclusión:
//
//   1. `POST /v1/orders` con una tarjeta tokenizada y **SIN customer** →
//      **`201`, `processed/accredited`, ARS 20 cobrados**. O sea que cobrar por
//      la familia Orders funciona con estas credenciales.
//   2. La MISMA orden, agregándole `automatic_payments` + `stored_credential` →
//      **`403 "The application is not authorized to perform this type of
//      payment."`**
//
// Entre (1) y (2) cambiaron **dos** nodos a la vez. Un `403` sobre un request
// que cambió dos cosas no dice cuál de las dos lo disparó, y la diferencia
// decide qué hay que pedirle al proveedor:
//
//   - si lo dispara `stored_credential` → lo que falta es la habilitación para
//     **transacciones con credencial guardada** (el marco MIT de las marcas);
//   - si lo dispara `automatic_payments` → lo que falta es la habilitación del
//     producto **"Pagos automáticos"**;
//   - si lo disparan los dos por separado → son dos permisos, no uno.
//
// Es la misma disciplina de siempre: cuando una explicación se cae, no se busca
// otra, se busca el experimento que las distinga. Acá ni siquiera se cayó —
// todavía no hay una sola explicación, hay dos candidatas y un solo dato.
//
// Y HAY UNA TERCERA LECTURA QUE NO SE PUEDE DESCARTAR DESDE ACÁ
// -------------------------------------------------------------
// Que la aplicación **de prueba** no tenga ese permiso NUNCA, y que una
// aplicación productiva sí. Eso no se mide con estas credenciales: se mide en
// producción o se le pregunta al proveedor. Esta sonda acota QUÉ preguntar, no
// contesta si en producción funciona.
//
// SIN COSTO: sandbox. Cada escalón que entra cobra ARS 20 de mentira.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-38 node probe-40-que-dispara-el-403-de-pagos-automaticos.mjs
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

// Un token se usa UNA sola vez (medido el 2026-09-15), así que cada escalón
// tokeniza de nuevo. Si no, el segundo escalón fallaría por el token y no por
// lo que se está midiendo — y eso arruinaría exactamente la distinción.
async function escalon(etiqueta, extraPago) {
    const token = await tokenizar();
    const cuerpo = {
        type: 'online',
        external_reference: `HOS-1352-s40-${Date.now()}`,
        total_amount: MONTO,
        processing_mode: 'automatic',
        payer: { email: BUYER },
        transactions: {
            payments: [
                {
                    amount: MONTO,
                    payment_method: { id: 'master', type: 'credit_card', token, installments: 1 },
                    ...extraPago
                }
            ]
        }
    };
    const res = await fetch(`${API}/v1/orders`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': randomUUID()
        },
        body: JSON.stringify(cuerpo)
    });
    const body = await res.json().catch(() => ({}));
    const copia = JSON.parse(JSON.stringify(cuerpo));
    copia.transactions.payments[0].payment_method.token = '(redactado)';
    guardar(`p40-${etiqueta}.request`, copia);
    guardar(`p40-${etiqueta}.response`, { http: res.status, cuerpo: body });

    const detalle =
        body?.errors?.[0]?.message ?? `${body?.status ?? '—'}/${body?.status_detail ?? '—'} · orden ${body?.id ?? '—'}`;
    const perfil = body?.transactions?.payments?.[0]?.automatic_payments?.payment_profile_id ?? null;
    console.log(`  ${etiqueta.padEnd(34)} HTTP ${String(res.status).padEnd(4)} ${detalle}`);
    if (perfil) console.log(`  ${''.padEnd(34)} payment_profile_id = ${perfil}`);
    return { http: res.status, body, perfil };
}

console.log(`############ SONDA 40 · ${new Date().toISOString()}`);
console.log('\n######## ¿Cuál de los dos nodos dispara el 403?\n');

// El control de que el camino base sigue funcionando. Si esto fallara, ningún
// escalón de abajo diría nada.
await escalon('A-control-sin-nada', {});

// Un nodo por vez. Ésta es toda la sonda.
await escalon('B-solo-stored_credential', {
    stored_credential: { payment_initiator: 'customer', reason: 'recurring', first_payment: true }
});
await escalon('C-solo-automatic_payments', { automatic_payments: { retries: 3 } });
await escalon('D-los-dos', {
    automatic_payments: { retries: 3 },
    stored_credential: { payment_initiator: 'customer', reason: 'recurring', first_payment: true }
});

// Y una variante que no pide guardar nada: `payment_initiator: merchant` sin
// perfil. Sirve para ver si el rechazo es por el MARCO MIT o por el PRODUCTO.
await escalon('E-mit-sin-perfil', {
    stored_credential: { payment_initiator: 'merchant', reason: 'recurring', first_payment: false }
});

console.log(`
############ CÓMO SE LEE

  A tiene que entrar; es el control. Después:

    sólo B falla  → falta la habilitación de CREDENCIAL GUARDADA (marco MIT)
    sólo C falla  → falta la habilitación del producto PAGOS AUTOMÁTICOS
    B y C fallan  → son DOS permisos distintos, y hay que pedir los dos
    ninguno falla → el 403 de la sonda 39 era por la COMBINACIÓN, y eso es
                    otra cosa: hay que mirar el request de la 39

  Y lo que esta sonda NO puede contestar: si una aplicación PRODUCTIVA tiene
  esos permisos. Eso se mide en producción o se le pregunta al proveedor.
`);
