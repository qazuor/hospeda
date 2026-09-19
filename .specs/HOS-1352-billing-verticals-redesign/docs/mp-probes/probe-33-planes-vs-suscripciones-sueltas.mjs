#!/usr/bin/env node
// =============================================================================
// SONDA 33 — Planes (`/preapproval_plan`) contra suscripciones sueltas
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352.
//
// POR QUÉ EXISTE
// --------------
// Las 60 filas medidas hasta acá se midieron TODAS sobre `/preapproval`:
// suscripciones sueltas, cada una con su propio `auto_recurring`. Discutiendo
// el punto 1 (cambio de ciclo) apareció que el proveedor tiene un SEGUNDO
// modelo que el programa no tocó: `/preapproval_plan`, planes a los que las
// suscripciones se asocian por `preapproval_plan_id`.
//
// No es un detalle de nomenclatura. Los planes exponen campos que la
// suscripción suelta no tiene documentados: `repetitions` (cantidad total de
// cobros), `billing_day` y `billing_day_proportional` (día fijo de
// facturación y prorrateo del primero), y `free_trial`.
//
// El owner pidió correr la batería COMPLETA sobre planes, y el argumento es
// correcto: medir sólo donde el modelo suelto falla es cambiar un problema por
// otro sin saberlo. Pero esa batería cuesta días de reloj y plata. Antes van
// CUATRO preguntas que son instantáneas y gratis, y que deciden si la batería
// vale la pena.
//
// LAS CUATRO PREGUNTAS
// --------------------
//   Q1  ¿Se puede MOVER una suscripción VIVA de un plan a otro?
//       Es la que decide todo. `EX-4` midió que el CICLO de una suscripción
//       suelta no se puede mutar, y `DEC-SUB-005` pagó ese hallazgo con
//       fricción real: cancelar, recrear y pedirle el código de seguridad al
//       cliente. Si una suscripción se puede reasignar a otro plan con un
//       `PUT`, el punto 1 tiene otra solución y `DEC-SUB-005` hay que
//       revisarla. Si no se puede, el modelo de planes NO resuelve el punto 1
//       y hereda todo lo demás igual.
//   Q2  Si la suscripción trae su propio `auto_recurring` Y un plan, ¿cuál
//       manda? Decide si el plan es un default o un contrato.
//   Q3  Editar el plan, ¿se propaga a los ya suscriptos? Si sí, es un camino
//       de cambio de precio masivo que `DEC-MP-001` no consideró (hoy decide
//       mutar suscripción por suscripción). Si no, el plan es sólo una
//       plantilla de alta.
//   Q4  `free_trial`, `repetitions`, `billing_day`: ¿funcionan también SIN
//       plan? Si funcionan sueltos, los planes no aportan nada nuevo y la
//       batería completa se cae sola.
//
// LO QUE LA DOCUMENTACIÓN YA CONTESTA, Y POR QUÉ NO ALCANZA
// --------------------------------------------------------
// Consultado el 2026-09-15:
//   - Las docs de "suscripción con plan asociado" describen el alta y NO
//     mencionan cambiar de plan después. Ausencia, no negación.
//   - El SDK oficial de Go lleva `preapproval_plan_id` en el request de
//     CREACIÓN y no en el de ACTUALIZACIÓN. Eso dice que el SDK no lo modela;
//     no dice que la API lo rechace.
// Ninguna de las dos es una de las tres fuentes de fundamento del programa
// (PDR, medición propia fechada, respuesta del owner). Están acá para explicar
// el diseño de la sonda, no para concluir nada.
//
// LA REGLA QUE ATRAVIESA TODO (§0 de RESULTS-2026-09-15.md)
// --------------------------------------------------------
// Mercado Pago acepta cambios que no aplica y responde 2xx. Nueve casos
// medidos, y el peor —`EX-20`— es un `PUT` con varios campos que se aplica A
// MEDIAS con un solo `200`. Por eso acá:
//   1. TODO se relee después de escribirse.
//   2. La relectura se compara CAMPO POR CAMPO contra cada campo que se mandó,
//      no "la" mutación.
//   3. Ningún paso concluye por el código de estado.
//
// EL CONTROL QUE DISTINGUE (y por qué Q1 son TRES llamadas y no una)
// ------------------------------------------------------------------
// La otra lección cara del programa: un error no prueba que algo esté
// prohibido, prueba que no llegó a evaluarse (la sonda 07 casi registra un
// `NOT_SUPPORTED` inexistente por un `429`). Si el `PUT` de Q1 devolviera
// `400`, esa respuesta sola no distingue "el proveedor no deja mover de plan"
// de "el `PUT` falló por otra cosa". Por eso Q1 se mide en tres pasos:
//
//   (a) `PUT` con SÓLO `back_url`          → ¿el PUT sobre este sujeto anda?
//   (b) `PUT` con SÓLO `preapproval_plan_id` → la pregunta
//   (c) `PUT` con LOS DOS JUNTOS           → si `back_url` cambia y el plan no,
//                                            es `EX-20` otra vez: 200 que miente
//
// Sin (a) un `400` en (b) no dice nada. Sin (c), un `200` en (b) tampoco.
//
// QUÉ CUESTA
// ----------
// CERO. Corre contra el SANDBOX, donde el dinero es de mentira y los tokens de
// tarjeta son ilimitados. No toca los 8 sujetos del reloj de sandbox ni su
// manifiesto (`/tmp/mp-probe-05/manifiesto.json`), ni el reloj de producción.
//
// LO QUE SÍ TOCA, Y HAY QUE TENERLO EN CUENTA MAÑANA
// --------------------------------------------------
// El webhook de la app de prueba está apuntado al receptor propio, así que
// estas altas VAN A APARECER en el sink. Al leer el sink mañana para `RN-1`,
// los `data.id` de esta sonda son ruido: están todos en el manifiesto de acá
// (`manifiesto-planes-<stamp>.json`) justamente para poder excluirlos.
//
// CÓMO SE CORRE
//   El `source` va en la MISMA LÍNEA: cada invocación arranca un shell nuevo.
//     source ~/.config/hospeda/mp-sandbox-creds.sh && \
//       OUT_DIR=/tmp/mp-probe-33 node probe-33-planes-vs-suscripciones-sueltas.mjs
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-33';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const BUYER = process.env.MP_BUYER_EMAIL;
const BACK_URL = 'https://www.hospeda.com.ar';
const BACK_URL_2 = 'https://www.hospeda.com.ar/?control=33';
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

if (!TOKEN || !BUYER) {
    console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL — hay que hacer `source` de las credenciales');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const sujetos = [];
const guardar = (nombre, datos) =>
    writeFileSync(join(OUT, `${nombre}.json`), `${JSON.stringify(datos, null, 2)}\n`);

/** Una llamada a la API. Deja request y response en disco, SIEMPRE. */
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
    // El request se guarda TAL CUAL se mandó, salvo el token de tarjeta.
    // Agregar una clave que no se mandó falsifica la evidencia.
    if (cuerpo) {
        const copia = { ...cuerpo };
        if (copia.card_token_id) copia.card_token_id = '(redactado)';
        guardar(`${nombre}.request`, { metodo, ruta, cuerpo: copia });
    }
    guardar(`${nombre}.response`, { http: res.status, cuerpo: json });
    return { http: res.status, body: json };
}

/**
 * Compara campo por campo lo PEDIDO contra lo LEÍDO. Recursivo sobre objetos.
 * Es lo único que prueba algo: un 2xx no dice que el campo se haya aplicado.
 */
function comparar(pedido, leido, prefijo = '') {
    const filas = [];
    for (const [k, v] of Object.entries(pedido)) {
        if (k === 'card_token_id') continue; // no se relee nunca
        const camino = prefijo ? `${prefijo}.${k}` : k;
        const actual = leido == null ? undefined : leido[k];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            filas.push(...comparar(v, actual, camino));
        } else if (actual === undefined) {
            filas.push({ campo: camino, pedido: v, leido: '(AUSENTE)', veredicto: 'DESCARTADO' });
        } else if (JSON.stringify(actual) === JSON.stringify(v)) {
            filas.push({ campo: camino, pedido: v, leido: actual, veredicto: 'aplicado' });
        } else {
            filas.push({ campo: camino, pedido: v, leido: actual, veredicto: 'DISTINTO' });
        }
    }
    return filas;
}

function imprimirComparacion(filas) {
    for (const f of filas) {
        const marca = f.veredicto === 'aplicado' ? '  ✓' : '  ✗';
        console.log(
            `${marca} ${f.campo.padEnd(38)} pedido=${JSON.stringify(f.pedido)} leído=${JSON.stringify(f.leido)} → ${f.veredicto}`
        );
    }
    return filas.every((f) => f.veredicto === 'aplicado');
}

/** Crea + relee + compara. Devuelve el id o null. */
async function crearYVerificar(nombre, ruta, cuerpo, rutaLectura) {
    const { http, body } = await llamar(nombre, 'POST', ruta, cuerpo);
    const id = body?.id ?? null;
    console.log(`\n=== ${nombre}  ·  HTTP ${http}  ·  id: ${id ?? '—'}`);
    if (!id) {
        console.log(`    ${JSON.stringify({ message: body?.message, error: body?.error, cause: body?.cause })}`);
        return null;
    }
    const rel = await llamar(`${nombre}.relectura`, 'GET', `${rutaLectura}/${id}`);
    console.log('    RELECTURA campo por campo:');
    imprimirComparacion(comparar(cuerpo, rel.body));
    return id;
}

/**
 * Un token de tarjeta de prueba. UN TOKEN SE USA UNA SOLA VEZ (medido el
 * 2026-09-15: el segundo uso da `400 Card token was used`). El titular decide
 * el resultado del cobro; `APRO` aprueba.
 */
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
    return j?.id ?? null; // el token no se imprime nunca: este archivo va versionado
}

const ref = (slug) => `HOS-1352-planes-${STAMP}-${slug}`;

console.log(`############ SONDA 33 — planes vs suscripciones sueltas · ${new Date().toISOString()}`);
console.log(`############ salida: ${OUT}`);

// -----------------------------------------------------------------------------
// PASO 1 — ¿Existe el modelo de planes, y qué campos acepta de verdad?
// -----------------------------------------------------------------------------
// Se piden TODOS los campos que la documentación atribuye al plan y que la
// suscripción suelta no tiene. La relectura dice cuáles quedaron.
//
// `frequency_type: "days"` se pide a propósito: si los planes lo aceptan, un
// reloj de planes se lee en 24 h como el de suscripciones sueltas. Si lo
// rechaza, es un hallazgo con consecuencia (la batería sobre planes costaría
// un mes, no un día) y se reintenta con `months`.
console.log('\n\n######## PASO 1 — crear los planes (Q4 por contraste: qué acepta un plan)');

const planBase = (monto, extra = {}) => ({
    reason: `HOS1352 plan ${monto}`,
    back_url: BACK_URL,
    auto_recurring: {
        frequency: 1,
        frequency_type: 'days',
        transaction_amount: monto,
        currency_id: 'ARS',
        ...extra
    }
});

const planACuerpo = planBase(2000, {
    repetitions: 3,
    billing_day: 10,
    billing_day_proportional: false,
    free_trial: { frequency: 1, frequency_type: 'days' }
});

let planA = await crearYVerificar('plan-A', '/preapproval_plan', planACuerpo, '/preapproval_plan');
let cicloPlan = 'days';

if (!planA) {
    console.log('\n  → reintento con frequency_type "months": si entra, los planes NO aceptan ciclo diario');
    cicloPlan = 'months';
    const alt = JSON.parse(JSON.stringify(planACuerpo));
    alt.auto_recurring.frequency_type = 'months';
    alt.auto_recurring.free_trial.frequency_type = 'days';
    planA = await crearYVerificar('plan-A-months', '/preapproval_plan', alt, '/preapproval_plan');
}

const planB = planA
    ? await crearYVerificar(
          'plan-B',
          '/preapproval_plan',
          { ...planBase(3000), auto_recurring: { ...planBase(3000).auto_recurring, frequency_type: cicloPlan } },
          '/preapproval_plan'
      )
    : null;

sujetos.push({ slug: 'plan-A', tipo: 'preapproval_plan', id: planA }, { slug: 'plan-B', tipo: 'preapproval_plan', id: planB });

// -----------------------------------------------------------------------------
// PASO 2 — Q4: ¿`free_trial`, `repetitions` y `billing_day` andan SIN plan?
// -----------------------------------------------------------------------------
// Uno por campo, y no los tres juntos a propósito: si van juntos y uno se
// descarta, el sujeto no distingue cuál. Cada uno se crea AUTORIZADO, porque
// el efecto observable (`next_payment_date`, `summarized.charged_quantity`)
// sólo existe en una suscripción autorizada.
console.log('\n\n######## PASO 2 — Q4: los campos del plan, sobre una suscripción SUELTA');

async function sueltoCon(slug, extraAutoRecurring) {
    const tok = await tokenizar();
    if (!tok) {
        console.log(`\n=== ${slug}: NO SE PUDO TOKENIZAR`);
        return null;
    }
    const cuerpo = {
        reason: `HOS1352 suelto ${slug}`,
        payer_email: BUYER,
        back_url: BACK_URL,
        external_reference: ref(slug),
        card_token_id: tok,
        status: 'authorized',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'days',
            transaction_amount: 2000,
            currency_id: 'ARS',
            ...extraAutoRecurring
        }
    };
    const id = await crearYVerificar(slug, '/preapproval', cuerpo, '/preapproval');
    sujetos.push({ slug, tipo: 'preapproval', id, plan: null });
    return id;
}

await sueltoCon('suelto-freetrial', { free_trial: { frequency: 1, frequency_type: 'days' } });
await sueltoCon('suelto-repeticiones', { repetitions: 3 });
await sueltoCon('suelto-billingday', { billing_day: 10, billing_day_proportional: false });

// -----------------------------------------------------------------------------
// PASO 3 — Q2: el plan y la suscripción se contradicen. ¿Cuál manda?
// -----------------------------------------------------------------------------
console.log('\n\n######## PASO 3 — Q2: plan (ARS 2000) + auto_recurring propio (ARS 777)');

let subConflicto = null;
let subTestigo = null;
let subMovible = null;

if (planA) {
    const conPlan = async (slug, extra = {}) => {
        const tok = await tokenizar();
        if (!tok) {
            console.log(`\n=== ${slug}: NO SE PUDO TOKENIZAR`);
            return null;
        }
        const cuerpo = {
            preapproval_plan_id: planA,
            reason: `HOS1352 ${slug}`,
            payer_email: BUYER,
            back_url: BACK_URL,
            external_reference: ref(slug),
            card_token_id: tok,
            status: 'authorized',
            ...extra
        };
        const id = await crearYVerificar(slug, '/preapproval', cuerpo, '/preapproval');
        sujetos.push({ slug, tipo: 'preapproval', id, plan: 'A' });
        return id;
    };

    subConflicto = await conPlan('sub-conflicto', {
        auto_recurring: {
            frequency: 1,
            frequency_type: cicloPlan,
            transaction_amount: 777,
            currency_id: 'ARS'
        }
    });
    console.log('    ↑ Q2 se lee en `auto_recurring.transaction_amount` de la relectura:');
    console.log('      2000 = manda el plan · 777 = manda la suscripción · 400 = no se combinan');

    // Dos suscripciones limpias sobre el plan A: una para MOVER (Q1) y otra que
    // NO se toca, como TESTIGO de Q3. Sin testigo, si Q1 mueve la única
    // suscripción del plan A, Q3 se queda sin sujeto que observar.
    subMovible = await conPlan('sub-movible');
    subTestigo = await conPlan('sub-testigo');
}

// -----------------------------------------------------------------------------
// PASO 4 — Q1: ¿se puede mover una suscripción VIVA de un plan a otro?
// -----------------------------------------------------------------------------
console.log('\n\n######## PASO 4 — Q1: mover `sub-movible` del plan A al plan B');

async function putYComparar(nombre, id, parche) {
    const { http } = await llamar(nombre, 'PUT', `/preapproval/${id}`, parche);
    const rel = await llamar(`${nombre}.relectura`, 'GET', `/preapproval/${id}`);
    console.log(`\n--- ${nombre}  ·  HTTP ${http}`);
    const ok = imprimirComparacion(comparar(parche, rel.body));
    const resp = JSON.parse(
        JSON.stringify({ http, aplicado: ok, plan_leido: rel.body?.preapproval_plan_id ?? null })
    );
    console.log(`    → ${JSON.stringify(resp)}`);
    return resp;
}

if (subMovible && planB) {
    // (a) el control: ¿el PUT sobre este sujeto funciona?
    console.log('\n  (a) CONTROL — PUT con sólo `back_url`. Si esto falla, un 400 en (b) no dice nada.');
    await putYComparar('q1-a-control-backurl', subMovible, { back_url: BACK_URL_2 });

    // (b) la pregunta
    console.log('\n  (b) LA PREGUNTA — PUT con sólo `preapproval_plan_id`.');
    await putYComparar('q1-b-solo-plan', subMovible, { preapproval_plan_id: planB });

    // (c) EX-20: un PUT con varios campos, ¿se aplica a medias?
    console.log('\n  (c) EX-20 — los dos juntos. Si `back_url` cambia y el plan no, el 200 miente.');
    await putYComparar('q1-c-combinado', subMovible, {
        preapproval_plan_id: planB,
        back_url: BACK_URL
    });
} else {
    console.log('  (se saltea: falta sub-movible o plan B)');
}

// -----------------------------------------------------------------------------
// PASO 5 — Q3: editar el plan, ¿se propaga a los ya suscriptos?
// -----------------------------------------------------------------------------
console.log('\n\n######## PASO 5 — Q3: subir el plan A de ARS 2000 a ARS 2500');

if (planA) {
    const parche = { auto_recurring: { transaction_amount: 2500, currency_id: 'ARS' } };
    const { http } = await llamar('q3-put-plan', 'PUT', `/preapproval_plan/${planA}`, parche);
    const rel = await llamar('q3-put-plan.relectura', 'GET', `/preapproval_plan/${planA}`);
    console.log(`\n--- q3-put-plan  ·  HTTP ${http}`);
    console.log('    ¿se aplicó SOBRE EL PLAN?');
    const aplicadoEnPlan = imprimirComparacion(comparar(parche, rel.body));

    // Lo que decide Q3 no es el plan: son los suscriptos.
    for (const [slug, id] of [
        ['sub-testigo', subTestigo],
        ['sub-conflicto', subConflicto]
    ]) {
        if (!id) continue;
        const s = await llamar(`q3-${slug}.relectura`, 'GET', `/preapproval/${id}`);
        console.log(
            `    ${slug.padEnd(14)} monto=${s.body?.auto_recurring?.transaction_amount} ` +
                `plan=${s.body?.preapproval_plan_id ?? '—'} status=${s.body?.status} ` +
                `next=${s.body?.next_payment_date ?? '—'}`
        );
    }
    console.log(
        `    → el cambio ${aplicadoEnPlan ? 'SÍ' : 'NO'} quedó en el plan. ` +
            'Que se propague o no se lee en los montos de arriba: 2500 = propaga · 2000 = no propaga.'
    );
}

// -----------------------------------------------------------------------------
// Manifiesto
// -----------------------------------------------------------------------------
// `RC-1` midió que el `search` de preapprovals IGNORA `external_reference`, así
// que sin esta lista no hay forma de volver a encontrar estos sujetos.
const manifiesto = {
    sonda: 33,
    entorno: 'sandbox',
    creado: new Date().toISOString(),
    stamp: STAMP,
    ciclo_de_los_planes: cicloPlan,
    sujetos: sujetos.filter((s) => s.id)
};
guardar('manifiesto', manifiesto);
console.log('\n\n############ manifiesto');
for (const s of manifiesto.sujetos) console.log(`  ${s.tipo.padEnd(18)} ${s.slug.padEnd(20)} ${s.id}`);
console.log(`\n  guardado en ${join(OUT, 'manifiesto.json')} — copiarlo al repo antes de perderlo.`);
console.log(`
############ FIN

  NINGUNA fila de la matriz se marca desde el código de estado de esta corrida.
  Se marca desde las comparaciones campo por campo de arriba.

  Lo único que queda para el reloj es \`suelto-freetrial\`: si el free_trial de
  1 día se aplicó, mañana tiene que tener UN cobro menos que los otros sueltos.
  Sus ids están en el manifiesto y son también los que hay que EXCLUIR al leer
  el sink de webhooks mañana, donde van a aparecer como ruido.
`);
