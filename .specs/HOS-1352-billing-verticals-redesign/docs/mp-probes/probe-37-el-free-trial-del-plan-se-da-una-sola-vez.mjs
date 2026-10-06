#!/usr/bin/env node
// =============================================================================
// SONDA 37 — El free trial de un plan, ¿se otorga una sola vez por pagador?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352.
//
// DE DÓNDE SALE LA PREGUNTA
// -------------------------
// De un efecto colateral de la sonda 33, que no estaba buscando esto. Dos
// suscripciones del MISMO pagador sobre el MISMO plan, creadas con **tres
// segundos** de diferencia, salieron distintas:
//
//   sub-movible (22:27:26)  free_trial: {1 days}  ·  next_payment_date: 16/09
//   sub-testigo (22:27:29)  free_trial: null      ·  next_payment_date: 15/09
//
// Ninguna de las dos pidió el free trial: lo trae el plan. O sea que el
// proveedor le dio el período de prueba a la primera y no a la segunda, sin que
// nada en el request las distinguiera.
//
// POR QUÉ IMPORTA
// ---------------
// Si un free trial de plan se otorga UNA VEZ por pagador, entonces un cliente
// que se da de baja y vuelve NO recibe el trial de nuevo, y la fecha del primer
// cobro que nuestra UI le prometa va a ser falsa para todo el que vuelva. Es el
// tipo de divergencia que sólo se descubre cuando ya le cobraste a alguien.
//
// UNA OBSERVACIÓN NO ES UNA MEDICIÓN
// ----------------------------------
// Con dos sujetos hay al menos dos explicaciones que no se distinguen:
//   (i)  el trial se otorga una vez por (pagador, plan);
//   (ii) el trial se otorga sólo a la PRIMERA suscripción del plan, sea quien
//        sea el pagador.
// Y una tercera que hay que descartar antes que las dos: que haya sido una
// casualidad de esa corrida.
//
// EL EXPERIMENTO
// --------------
// Un plan NUEVO con free trial, y TRES suscripciones seguidas del mismo
// pagador. Lo único que decide es `auto_recurring.free_trial` y
// `next_payment_date` de cada relectura:
//
//   1ª con trial y 2ª/3ª sin  → reproducido. (i) y (ii) siguen empatadas, pero
//                               la casualidad queda descartada y el efecto es
//                               real y sistemático.
//   las tres con trial        → lo de la 33 fue otra cosa, y hay que ir a
//                               buscarla en vez de dar por buena la hipótesis.
//
// Distinguir (i) de (ii) necesita un SEGUNDO pagador de prueba, que hoy no
// existe. Eso se registra como lo que es —un límite del experimento— y no se
// tapa eligiendo la explicación más cómoda.
//
// LO BUENO: la relectura LO DELATA. `free_trial` viene `null` en la que no lo
// recibió. O sea que esto es detectable antes de prometerle una fecha al
// cliente, y no hay que inferirlo de un cobro.
//
// SIN COSTO: sandbox. No toca ningún reloj.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-33 node probe-37-el-free-trial-del-plan-se-da-una-sola-vez.mjs
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-33';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const BUYER = process.env.MP_BUYER_EMAIL;
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

if (!TOKEN || !BUYER) {
    console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const guardar = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

async function llamar(nombre, metodo, ruta, cuerpo) {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (cuerpo) {
        const c = { ...cuerpo };
        if (c.card_token_id) c.card_token_id = '(redactado)';
        guardar(`${nombre}.request`, { metodo, ruta, cuerpo: c });
    }
    guardar(`${nombre}.response`, { http: res.status, cuerpo: j });
    return { http: res.status, body: j };
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

console.log(`############ SONDA 37 · ${new Date().toISOString()}`);

const plan = await llamar('37-plan', 'POST', '/preapproval_plan', {
    reason: 'HOS1352 s37 plan con free trial',
    back_url: 'https://www.hospeda.com.ar',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'days',
        transaction_amount: 2000,
        currency_id: 'ARS',
        free_trial: { frequency: 1, frequency_type: 'days' }
    }
});
if (!plan.body?.id) {
    console.error(`el plan no se creó · HTTP ${plan.http} · ${plan.body?.message}`);
    process.exit(1);
}
const relPlan = await llamar('37-plan.relectura', 'GET', `/preapproval_plan/${plan.body.id}`);
console.log(`\nplan ${plan.body.id}`);
console.log(`  free_trial del PLAN: ${JSON.stringify(relPlan.body?.auto_recurring?.free_trial ?? null)}`);
console.log(`  (si el plan no lo guardó, el experimento no dice nada sobre el otorgamiento)\n`);

const sujetos = [];
for (const n of [1, 2, 3]) {
    const tok = await tokenizar();
    if (!tok) {
        console.log(`  sub ${n}: NO SE PUDO TOKENIZAR`);
        continue;
    }
    const sub = await llamar(`37-sub-${n}`, 'POST', '/preapproval', {
        preapproval_plan_id: plan.body.id,
        reason: `HOS1352 s37 sub ${n}`,
        payer_email: BUYER,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-s37-${STAMP}-${n}`,
        card_token_id: tok,
        status: 'authorized'
    });
    if (!sub.body?.id) {
        console.log(`  sub ${n}: HTTP ${sub.http} · ${sub.body?.message}`);
        continue;
    }
    const rel = await llamar(`37-sub-${n}.relectura`, 'GET', `/preapproval/${sub.body.id}`);
    const ft = rel.body?.auto_recurring?.free_trial ?? null;
    console.log(
        `  sub ${n}  ${sub.body.id}  free_trial=${ft ? JSON.stringify(ft) : 'null'}  ` +
            `next=${rel.body?.next_payment_date}  cobros=${rel.body?.summarized?.charged_quantity ?? 'null'}`
    );
    sujetos.push({ n, id: sub.body.id, con_trial: ft !== null });
}

const conTrial = sujetos.filter((s) => s.con_trial).length;
console.log(`\n→ ${conTrial} de ${sujetos.length} recibieron el free trial del plan.`);
if (sujetos.length === 3 && conTrial === 1 && sujetos[0].con_trial) {
    console.log('  REPRODUCIDO: sólo la primera. La casualidad queda descartada.');
    console.log('  Sigue SIN distinguir "una vez por pagador" de "una vez por plan":');
    console.log('  eso necesita un SEGUNDO pagador de prueba, que hoy no existe.');
} else if (conTrial === sujetos.length) {
    console.log('  NO reproducido: las tres lo recibieron. Lo de la sonda 33 fue otra cosa.');
} else {
    console.log('  Patrón distinto al de la 33. NO forzar una conclusión: mirar los JSON en disco.');
}
guardar('manifiesto-37', { sonda: 37, plan: plan.body.id, sujetos, creado: new Date().toISOString() });
