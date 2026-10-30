#!/usr/bin/env node
// =============================================================================
// SONDA 35 — ¿El CICLO de un plan es editable, y propaga?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352. Corre después de las sondas 33 y 34 y reusa sus sujetos.
//
// POR QUÉ EXISTE
// --------------
// El control `C4` de la sonda 34 preguntaba si el `PUT` sobre un plan puede
// cambiarle el ciclo, porque la 33 ya había medido que el monto del plan SÍ se
// propaga a los ya suscriptos (el testigo pasó de 2000 a 2500 y después a 15
// sin que nadie lo tocara). Si el ciclo también se pudiera editar y propagara,
// existiría un cambio de ciclo MASIVO —el punto 1 por otra puerta—, aunque la
// 33 ya midió que el INDIVIDUAL no existe.
//
// `C4` devolvió `400`, y el mensaje NO era sobre la frecuencia:
//
//     "The free trial property must be sent"
//
// O sea que el proveedor rechazó el `PUT` antes de llegar a evaluar el cambio
// de ciclo. Es exactamente la trampa que ya mordió dos veces en este programa:
// leer ese `400` como "el ciclo de un plan no se puede editar" habría sido
// registrar un `NOT_SUPPORTED` inventado.
//
// Y hay un dato que lo vuelve más sospechoso todavía: el control `C5`, tres
// llamadas después, mandó un `PUT` al MISMO plan con un `auto_recurring`
// PARCIAL —sólo `transaction_amount` y `currency_id`, sin `free_trial`— y
// devolvió `200` con el cambio aplicado. Los dos mandaron un `auto_recurring`
// incompleto sobre el mismo plan con free trial; uno pidió el free trial y el
// otro no. La única diferencia entre ambos es que `C4` además mandaba
// `frequency` y `frequency_type`.
//
// LOS TRES CONTROLES
// ------------------
//   D1  Un plan SIN free trial y SIN suscriptos (`c1-plan-diario`, de la 34):
//       `PUT` con sólo `frequency`/`frequency_type`. Saca el free trial de la
//       ecuación por completo. Si acá entra, el ciclo es editable y el `400`
//       de `C4` era del free trial.
//   D2  El plan CON free trial (`plan-A`): el mismo `PUT` pero reenviando el
//       `free_trial` que el proveedor pidió. Distingue "hay que reenviarlo"
//       de "el ciclo no se toca".
//   D3  Si alguno de los dos entra: ¿PROPAGA el ciclo nuevo a los ya
//       suscriptos, como propagó el monto? Se lee sobre los suscriptos del
//       plan A (`sub-testigo` y `c3-plan-mas-frecuencia-propia`), fotografiados
//       antes y después.
//
// En los tres, el veredicto sale de la RELECTURA comparada campo por campo, no
// del código de estado (§0): este proveedor ya devolvió `201` descartando
// `billing_day` en silencio dos veces esta misma noche.
//
// SIN COSTO: sandbox. No toca los 8 sujetos del reloj ni su manifiesto.
//
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-33 node probe-35-el-ciclo-de-un-plan-es-editable.mjs
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-33';
const TOKEN = process.env.MP_ACCESS_TOKEN;
if (!TOKEN) {
    console.error('falta MP_ACCESS_TOKEN — hay que hacer `source` de las credenciales');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const man = existsSync(join(OUT, 'manifiesto.json'))
    ? JSON.parse(readFileSync(join(OUT, 'manifiesto.json'), 'utf8'))
    : { sujetos: [] };
const idDe = (slug) => man.sujetos.find((s) => s.slug === slug)?.id ?? null;
const PLAN_A = idDe('plan-A');
const PLAN_DIARIO = idDe('c1-plan-diario');
const SUSCRIPTOS = [
    ['sub-testigo', idDe('sub-testigo')],
    ['c3-plan-mas-frecuencia-propia', idDe('c3-plan-mas-frecuencia-propia')]
].filter(([, id]) => id);

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
    if (cuerpo) guardar(`${nombre}.request`, { metodo, ruta, cuerpo });
    guardar(`${nombre}.response`, { http: res.status, cuerpo: json });
    return { http: res.status, body: json };
}

const ciclo = (j) => (j?.auto_recurring ? `${j.auto_recurring.frequency} ${j.auto_recurring.frequency_type}` : '—');
const foto = (j) =>
    JSON.stringify({
        ciclo: ciclo(j),
        monto: j?.auto_recurring?.transaction_amount ?? null,
        free_trial: j?.auto_recurring?.free_trial ?? null,
        status: j?.status ?? null,
        next_payment_date: j?.next_payment_date ?? null
    });

console.log(`############ SONDA 35 — ¿el ciclo de un plan es editable? · ${new Date().toISOString()}`);

/** PUT + relectura + veredicto por comparación, nunca por el código de estado. */
async function intentar(nombre, planId, parche, esperado) {
    const antes = await llamar(`${nombre}.antes`, 'GET', `/preapproval_plan/${planId}`);
    const put = await llamar(nombre, 'PUT', `/preapproval_plan/${planId}`, parche);
    const desp = await llamar(`${nombre}.despues`, 'GET', `/preapproval_plan/${planId}`);
    const quedo = ciclo(desp.body);
    console.log(`\n--- ${nombre}  ·  HTTP ${put.http}`);
    if (put.http >= 400) console.log(`    mensaje: ${put.body?.message ?? JSON.stringify(put.body)}`);
    console.log(`    ciclo  antes: ${ciclo(antes.body)}   ·   después: ${quedo}   ·   pedido: ${esperado}`);
    const aplicado = quedo === esperado;
    console.log(`    → ${aplicado ? 'APLICADO' : 'NO aplicado'}`);
    return aplicado;
}

// -----------------------------------------------------------------------------
console.log('\n\n######## D1 — plan SIN free trial y SIN suscriptos: cambiar 1 day → 2 days');
let editable = false;
if (PLAN_DIARIO) {
    editable = await intentar(
        'd1-ciclo-plan-sin-freetrial',
        PLAN_DIARIO,
        { auto_recurring: { frequency: 2, frequency_type: 'days', transaction_amount: 2000, currency_id: 'ARS' } },
        '2 days'
    );
} else {
    console.log('  (se saltea: falta c1-plan-diario, que crea la sonda 34)');
}

// -----------------------------------------------------------------------------
console.log('\n\n######## D2 — plan CON free trial: el mismo PUT, reenviando el free_trial que pidió');
console.log('  Distingue "hay que reenviarlo" de "el ciclo no se toca".');

const antesSuscriptos = [];
for (const [slug, id] of SUSCRIPTOS) {
    const s = await llamar(`d3-${slug}.antes`, 'GET', `/preapproval/${id}`);
    antesSuscriptos.push([slug, ciclo(s.body), s.body?.auto_recurring?.transaction_amount ?? null]);
    console.log(`  suscripto ANTES · ${slug.padEnd(30)} ${foto(s.body)}`);
}

let editableConTrial = false;
if (PLAN_A) {
    editableConTrial = await intentar(
        'd2-ciclo-plan-con-freetrial',
        PLAN_A,
        {
            auto_recurring: {
                frequency: 2,
                frequency_type: 'months',
                transaction_amount: 15,
                currency_id: 'ARS',
                free_trial: { frequency: 1, frequency_type: 'days' }
            }
        },
        '2 months'
    );
}

// -----------------------------------------------------------------------------
console.log('\n\n######## D3 — ¿propaga el ciclo a los ya suscriptos, como propagó el monto?');
if (!editable && !editableConTrial) {
    console.log('  (ningún PUT aplicó el ciclo: no hay propagación que medir)');
}
for (const [slug, id] of SUSCRIPTOS) {
    const s = await llamar(`d3-${slug}.despues`, 'GET', `/preapproval/${id}`);
    const prev = antesSuscriptos.find((a) => a[0] === slug);
    const cambio = prev && prev[1] !== ciclo(s.body);
    console.log(`  suscripto DESPUÉS · ${slug.padEnd(30)} ${foto(s.body)}`);
    console.log(`      ciclo ${prev?.[1]} → ${ciclo(s.body)} ${cambio ? '· CAMBIÓ' : '· sin cambios'}`);
}

console.log('\n############ FIN — el veredicto sale de las relecturas de arriba, no de los HTTP.');
