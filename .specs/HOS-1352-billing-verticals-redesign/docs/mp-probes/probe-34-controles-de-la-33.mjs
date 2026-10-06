#!/usr/bin/env node
// =============================================================================
// SONDA 34 — Los controles que le faltaban a la 33
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352. Corre inmediatamente después de la
// `probe-33-planes-vs-suscripciones-sueltas.mjs` y reusa sus sujetos.
//
// POR QUÉ EXISTE
// --------------
// La sonda 33 dejó tres resultados que NO se pueden afirmar como están, porque
// en los tres el proveedor devolvió un error que puede tener más de una causa.
// La lección ya está pagada dos veces en este programa (la sonda 07 casi
// registra un `NOT_SUPPORTED` inexistente por un `429`; la 15 casi registra un
// `PARTIALLY_SUPPORTED` inventado porque el proveedor valida el monto antes que
// la moneda): **un error no prueba que algo esté prohibido, prueba que no llegó
// a evaluarse.** Cuando una explicación se cae no se busca otra: se busca el
// experimento que las distinga.
//
// LOS TRES QUE NO CIERRAN
// -----------------------
//   C1  Un plan con `frequency_type: "days"` dio
//         400 "Invalid value for the type of frequency and start of the billing
//             day, the only valid frequency is months"
//       El mensaje nombra el BILLING DAY, y ese plan mandaba `billing_day: 10`.
//       O sea que hay DOS explicaciones: (i) los planes no aceptan ciclo diario,
//       o (ii) `billing_day` exige ciclo mensual y el ciclo diario no tuvo nada
//       que ver. La diferencia no es académica: con (i), la batería completa
//       sobre planes que pidió el owner cuesta UN MES de reloj en vez de un día.
//       El control: un plan con `days` y SIN `billing_day`.
//
//   C2  Una suscripción SUELTA con `billing_day` dio
//         400 "Only monthly frequencies are able to receive billing day or
//             proportional"
//       Se mandó con ciclo diario, así que el `400` es del ciclo y NO contesta
//       la pregunta de Q4 (¿`billing_day` anda sin plan?).
//       El control: la misma suscripción suelta con ciclo MENSUAL.
//
//   C3  Una suscripción con plan MÁS su propio `auto_recurring` dio
//         400 "The transaction_amount must be the same as preapproval_plan"
//       El mensaje habla SÓLO del monto. No dice si el plan manda sobre todo el
//       `auto_recurring` o si es la única validación que hace.
//       El control: el MISMO monto que el plan y distinta FRECUENCIA.
//
// Y DOS PREGUNTAS NUEVAS QUE ABRIÓ LA 33
// --------------------------------------
//   C4  El `PUT` sobre el PLAN propagó el MONTO a los ya suscriptos (medido:
//       el testigo pasó de 2000 a 2500 sin tocarlo). ¿Propaga también el CICLO?
//       Es la pregunta del punto 1 por otra puerta: si el ciclo del plan es
//       editable y propaga, existe un cambio de ciclo MASIVO —aunque la 33 ya
//       midió que no existe uno INDIVIDUAL—.
//   C5  ¿El plan acepta que le bajen el monto por debajo del piso de ARS 15 que
//       `PC-2` midió sobre suscripciones sueltas? Decide si la cortesía
//       (`BD-MP-02`) tiene un camino por planes.
//
// SIN COSTO: sandbox. No toca los 8 sujetos del reloj ni su manifiesto.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-33 node probe-34-controles-de-la-33.mjs
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-33';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const BUYER = process.env.MP_BUYER_EMAIL;
const BACK_URL = 'https://www.hospeda.com.ar';
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

if (!TOKEN || !BUYER) {
    console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL — hay que hacer `source` de las credenciales');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const manifiestoPrevio = existsSync(join(OUT, 'manifiesto.json'))
    ? JSON.parse(readFileSync(join(OUT, 'manifiesto.json'), 'utf8'))
    : { sujetos: [] };
const idDe = (slug) => manifiestoPrevio.sujetos.find((s) => s.slug === slug)?.id ?? null;
const PLAN_A = idDe('plan-A');
const SUB_TESTIGO = idDe('sub-testigo');

const nuevos = [];
const guardar = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

async function llamar(nombre, metodo, ruta, cuerpo) {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const texto = await res.text();
    let json;
    try {
        json = JSON.parse(texto);
    } catch {
        json = { __no_era_json: texto.slice(0, 400) };
    }
    if (cuerpo) {
        const copia = { ...cuerpo };
        if (copia.card_token_id) copia.card_token_id = '(redactado)';
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
    return (await res.json())?.id ?? null;
}

const resumenAuto = (j) =>
    JSON.stringify({
        ciclo: j?.auto_recurring ? `${j.auto_recurring.frequency} ${j.auto_recurring.frequency_type}` : null,
        monto: j?.auto_recurring?.transaction_amount ?? null,
        billing_day: j?.auto_recurring?.billing_day ?? null,
        billing_day_proportional: j?.auto_recurring?.billing_day_proportional ?? null,
        free_trial: j?.auto_recurring?.free_trial ?? null,
        repetitions: j?.auto_recurring?.repetitions ?? null,
        status: j?.status ?? null,
        next_payment_date: j?.next_payment_date ?? null,
        cobros: j?.summarized?.charged_quantity ?? null
    });

console.log(`############ SONDA 34 — controles de la 33 · ${new Date().toISOString()}`);
console.log(`############ plan-A: ${PLAN_A ?? '—'} · sub-testigo: ${SUB_TESTIGO ?? '—'}`);

// -----------------------------------------------------------------------------
// C1 — ¿los planes aceptan ciclo DIARIO cuando no se les manda `billing_day`?
// -----------------------------------------------------------------------------
console.log('\n\n######## C1 — plan con `days` y SIN `billing_day`');
console.log('  Si entra: el 400 de la 33 era por `billing_day`, y un reloj de planes se lee en 24 h.');
console.log('  Si NO entra: los planes no aceptan ciclo diario y la batería completa cuesta un mes.');

const c1 = await llamar('c1-plan-diario-sin-billingday', 'POST', '/preapproval_plan', {
    reason: 'HOS1352 c1 plan diario',
    back_url: BACK_URL,
    auto_recurring: { frequency: 1, frequency_type: 'days', transaction_amount: 2000, currency_id: 'ARS' }
});
console.log(`  HTTP ${c1.http} · ${c1.body?.id ?? c1.body?.message}`);
if (c1.body?.id) {
    const rel = await llamar('c1-plan-diario-sin-billingday.relectura', 'GET', `/preapproval_plan/${c1.body.id}`);
    console.log(`  RELECTURA: ${resumenAuto(rel.body)}`);
    nuevos.push({ slug: 'c1-plan-diario', tipo: 'preapproval_plan', id: c1.body.id });
}

// -----------------------------------------------------------------------------
// C2 — ¿`billing_day` anda en una suscripción SUELTA con ciclo mensual?
// -----------------------------------------------------------------------------
console.log('\n\n######## C2 — suscripción SUELTA, ciclo MENSUAL, con `billing_day`');
const tokC2 = await tokenizar();
if (tokC2) {
    const cuerpo = {
        reason: 'HOS1352 c2 suelto billing_day mensual',
        payer_email: BUYER,
        back_url: BACK_URL,
        external_reference: `HOS-1352-c2-${STAMP}`,
        card_token_id: tokC2,
        status: 'authorized',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 2000,
            currency_id: 'ARS',
            billing_day: 10,
            billing_day_proportional: false
        }
    };
    const c2 = await llamar('c2-suelto-billingday-mensual', 'POST', '/preapproval', cuerpo);
    console.log(`  HTTP ${c2.http} · ${c2.body?.id ?? c2.body?.message}`);
    if (c2.body?.id) {
        const rel = await llamar('c2-suelto-billingday-mensual.relectura', 'GET', `/preapproval/${c2.body.id}`);
        console.log(`  RELECTURA: ${resumenAuto(rel.body)}`);
        console.log('  → `billing_day` en la relectura = anda sin plan · AUSENTE = se descartó en silencio');
        nuevos.push({ slug: 'c2-suelto-billingday-mensual', tipo: 'preapproval', id: c2.body.id });
    }
}

// -----------------------------------------------------------------------------
// C3 — plan + `auto_recurring` con el MISMO monto y distinta FRECUENCIA
// -----------------------------------------------------------------------------
console.log('\n\n######## C3 — plan (ARS 2500, 1 months) + auto_recurring propio: mismo monto, 2 months');
console.log('  El plan está en 2500 desde el PASO 5 de la 33, así que el monto NO es el que choca acá.');
if (PLAN_A) {
    const tokC3 = await tokenizar();
    if (tokC3) {
        const cuerpo = {
            preapproval_plan_id: PLAN_A,
            reason: 'HOS1352 c3',
            payer_email: BUYER,
            back_url: BACK_URL,
            external_reference: `HOS-1352-c3-${STAMP}`,
            card_token_id: tokC3,
            status: 'authorized',
            auto_recurring: {
                frequency: 2,
                frequency_type: 'months',
                transaction_amount: 2500,
                currency_id: 'ARS'
            }
        };
        const c3 = await llamar('c3-plan-mas-frecuencia-propia', 'POST', '/preapproval', cuerpo);
        console.log(`  HTTP ${c3.http} · ${c3.body?.id ?? c3.body?.message}`);
        if (c3.body?.id) {
            const rel = await llamar('c3-plan-mas-frecuencia-propia.relectura', 'GET', `/preapproval/${c3.body.id}`);
            console.log(`  RELECTURA: ${resumenAuto(rel.body)}`);
            console.log('  → "2 months" = la suscripción puede apartarse del plan · "1 months" = el plan manda');
            nuevos.push({ slug: 'c3-plan-mas-frecuencia-propia', tipo: 'preapproval', id: c3.body.id });
        }
    }
}

// -----------------------------------------------------------------------------
// C4 — el PUT sobre el PLAN propagó el monto. ¿Propaga también el CICLO?
// -----------------------------------------------------------------------------
console.log('\n\n######## C4 — subir el ciclo del plan A de 1 mes a 2 meses');
if (PLAN_A && SUB_TESTIGO) {
    const antes = await llamar('c4-testigo.antes', 'GET', `/preapproval/${SUB_TESTIGO}`);
    console.log(`  testigo ANTES: ${resumenAuto(antes.body)}`);

    const parche = { auto_recurring: { frequency: 2, frequency_type: 'months', transaction_amount: 2500, currency_id: 'ARS' } };
    const put = await llamar('c4-put-ciclo-del-plan', 'PUT', `/preapproval_plan/${PLAN_A}`, parche);
    const relPlan = await llamar('c4-put-ciclo-del-plan.relectura', 'GET', `/preapproval_plan/${PLAN_A}`);
    console.log(`  PUT al plan HTTP ${put.http} · plan ahora: ${resumenAuto(relPlan.body)}`);

    const despues = await llamar('c4-testigo.despues', 'GET', `/preapproval/${SUB_TESTIGO}`);
    console.log(`  testigo DESPUÉS: ${resumenAuto(despues.body)}`);
    console.log('  → si el ciclo del testigo cambió, existe un cambio de ciclo MASIVO por plan');
    console.log('    (la 33 ya midió que el INDIVIDUAL no existe: el PUT ignora `preapproval_plan_id`)');
}

// -----------------------------------------------------------------------------
// C5 — ¿el plan respeta el piso de ARS 15 que `PC-2` midió sobre sueltas?
// -----------------------------------------------------------------------------
console.log('\n\n######## C5 — bajar el plan A a ARS 15, y después a ARS 1');
if (PLAN_A) {
    for (const monto of [15, 1]) {
        const put = await llamar(`c5-plan-a-${monto}`, 'PUT', `/preapproval_plan/${PLAN_A}`, {
            auto_recurring: { transaction_amount: monto, currency_id: 'ARS' }
        });
        const rel = await llamar(`c5-plan-a-${monto}.relectura`, 'GET', `/preapproval_plan/${PLAN_A}`);
        const leido = rel.body?.auto_recurring?.transaction_amount ?? null;
        console.log(
            `  ARS ${String(monto).padStart(4)} → HTTP ${put.http} · el plan quedó en ${leido} ` +
                `→ ${leido === monto ? 'APLICADO' : 'NO aplicado'}${put.http >= 400 ? ` · ${put.body?.message}` : ''}`
        );
    }
    if (SUB_TESTIGO) {
        const t = await llamar('c5-testigo.despues', 'GET', `/preapproval/${SUB_TESTIGO}`);
        console.log(`  testigo después de los dos: ${resumenAuto(t.body)}`);
    }
}

// -----------------------------------------------------------------------------
const manifiesto = { ...manifiestoPrevio, sonda: '33+34', sujetos: [...manifiestoPrevio.sujetos, ...nuevos] };
guardar('manifiesto', manifiesto);
console.log('\n\n############ manifiesto ampliado');
for (const s of manifiesto.sujetos) console.log(`  ${s.tipo.padEnd(18)} ${s.slug.padEnd(30)} ${s.id}`);
console.log('\n############ FIN — ninguna fila se marca por el código de estado (§0).');
