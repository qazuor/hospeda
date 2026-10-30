// =============================================================================
// SONDA 28 — Todo lo que exige una suscripción AUTORIZADA, sin cobrar un peso
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. Apunta a `EX-4`, `EX-6`, `EX-11`, `EX-12`, `PS-1`, `PS-3`,
// `PC-1`, `PC-2`, `PC-3`, `CN-1`, `CN-2`, `PA-5` — y a un montón de caminos de
// error que nadie había recorrido.
//
// EL TRUCO QUE HACE QUE ESTO NO CUESTE NADA
// -----------------------------------------
// Una suscripción autorizada **cobra en el acto** (`PA-3`). Pero `EX-7`/`EX-8`
// midieron que con `start_date` en el futuro **no cobra al crearse**: el
// proveedor lo modela como un `free_trial` que nosotros no pedimos, y respeta
// esa fecha después de autorizar.
//
// Entonces: todos los sujetos nacen con `start_date` a +30 días y se cancelan
// al terminar, mucho antes de que llegue esa fecha. Quedan `authorized` de
// verdad —que es lo que las filas necesitan— y no se le cobra un peso a nadie.
//
// **Eso NO se da por cierto en producción.** El primer sujeto es un CANARIO: se
// crea, se relee, y si tiene un cobro encima la sonda **aborta antes de crear
// los demás**. La regla del §0 vale también para lo que uno da por sabido de
// otro entorno.
//
// LO QUE ESTA SONDA NO PUEDE MEDIR
// --------------------------------
// Todo lo que necesita que un ciclo se EJECUTE: `RN-*`, `GR-*`, `UP-2`, `DW-1`,
// `CT-1`, `PS-2`, `PS-4`, `PS-5`, `PS-6`, `GT-1`. Eso exige un cobro real y va
// en una etapa aparte, con su propio presupuesto.
//
// REQUISITO
// ---------
// `/tmp/hos1352-tokens.txt` adentro del contenedor, escrito por la sonda 27.
// Un `card_token` es de UN SOLO USO, así que cada sujeto consume uno.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p28.mjs && node /tmp/p28.mjs'
// =============================================================================

import { readFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';
const MONTO = 15; // el piso del proveedor: si algo se cobrara por error, cuesta 15
const STAMP = Date.now();

const pedir = async (ruta, init = {}) => {
    const r = await fetch(`${API}${ruta}`, {
        ...init,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) }
    });
    const t = await r.text();
    let b;
    try {
        b = JSON.parse(t);
    } catch {
        b = t === '' ? null : t.slice(0, 300);
    }
    return { code: r.status, b };
};

const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}`);
    process.exit(1);
}
console.log(`############ SONDA 28 — autorizadas sin cobrar · ${new Date().toISOString()}`);
console.log(`cuenta: ${yo.b?.nickname} (${yo.b?.id})`);

// --- los tokens --------------------------------------------------------------
let tokens;
try {
    tokens = readFileSync('/tmp/hos1352-tokens.txt', 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
} catch {
    console.error('✗ no hay /tmp/hos1352-tokens.txt — corré primero la sonda 27 (la corre el owner)');
    process.exit(1);
}
console.log(`tokens disponibles: ${tokens.length} (terminan en ${tokens.map((t) => t.slice(-4)).join(', ')})`);
const tomarToken = () => {
    const t = tokens.shift();
    if (!t) {
        console.error('✗ se acabaron los tokens: volvé a correr la sonda 27');
        process.exit(1);
    }
    return t;
};

const INICIO = new Date(Date.now() + 30 * 86400000).toISOString().replace('Z', '-00:00');
const vivos = [];

const crear = async (slug, extra = {}, tokenExplicito = null) => {
    const cuerpo = {
        reason: `HOS1352 ${slug}`.slice(0, 60),
        payer_email: PAGADOR,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-auth-${STAMP}-${slug}`,
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: MONTO,
            currency_id: 'ARS',
            start_date: INICIO
        },
        card_token_id: tokenExplicito ?? tomarToken(),
        status: 'authorized',
        ...extra
    };
    const r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
    const id = r.b?.id ?? null;
    if (id) vivos.push({ slug, id });
    console.log(
        `  ${slug.padEnd(16)} HTTP ${r.code} ${id ? `· ${id} · ${r.b?.status}` : `· "${r.b?.message ?? JSON.stringify(r.b).slice(0, 140)}"`}`
    );
    return { r, id };
};

const leer = async (id) => (await pedir(`/preapproval/${id}`)).b;

const foto = (x) =>
    x
        ? `${x.status} · ARS ${x.auto_recurring?.transaction_amount} · ${x.auto_recurring?.frequency} ${x.auto_recurring?.frequency_type} · next ${(x.next_payment_date ?? '—').slice(0, 10)} · cobros ${x.summarized?.charged_quantity ?? '—'} · end_date ${x.auto_recurring?.end_date ?? '—'}`
        : '(no se pudo leer)';

// Toda mutación se relee y se compara: el 2xx no prueba nada (§0).
const mutar = async (id, etiqueta, patch, campo = null) => {
    const antes = await leer(id);
    const r = await pedir(`/preapproval/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    const despues = await leer(id);
    const lee = (o) => (campo ? JSON.stringify(campo.split('.').reduce((a, k) => a?.[k], o)) : null);
    const cambio = campo ? lee(antes) !== lee(despues) : null;
    console.log(
        `    ${etiqueta.padEnd(42)} HTTP ${String(r.code).padEnd(3)} ${
            r.code >= 400 ? `· "${r.b?.message ?? ''}"` : ''
        }`
    );
    if (campo) {
        console.log(
            `      ${campo}: ${lee(antes)} → ${lee(despues)}  ${
                cambio ? '✓ APLICÓ' : r.code < 400 ? '⚠ 2xx Y NO APLICÓ (§0)' : '(sin cambio, como corresponde)'
            }`
        );
    }
    return { r, antes, despues, cambio };
};

// =============================================================================
console.log('\n######## CANARIO — ¿de verdad no cobra con start_date futuro?');
console.log(`   start_date: ${INICIO.slice(0, 10)} · monto ARS ${MONTO}\n`);
const canario = await crear('canario');
if (!canario.id) {
    console.error('\n✗ ABORTA: no se pudo crear el canario. Sin él no se mide nada.');
    process.exit(1);
}
const cFoto = await leer(canario.id);
console.log(`    RELECTURA: ${foto(cFoto)}`);
const cobros = Number(cFoto?.summarized?.charged_quantity ?? 0);
const pagos = await pedir(`/authorized_payments/search?preapproval_id=${canario.id}&limit=5`);
console.log(`    cobros del proveedor: charged_quantity=${cobros} · authorized_payments=${pagos.b?.paging?.total}`);
if (cFoto?.status !== 'authorized') {
    console.error(`\n✗ ABORTA: quedó "${cFoto?.status}" y no "authorized".`);
    process.exit(1);
}
if (cobros > 0 || Number(pagos.b?.paging?.total ?? 0) > 0) {
    console.error('\n✗ ABORTA: EL CANARIO COBRÓ. En producción `start_date` futuro NO evita el cobro.');
    console.error('  Cancelando el canario y saliendo antes de crear ningún otro sujeto.');
    await pedir(`/preapproval/${canario.id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    process.exit(1);
}
console.log('    ✓ autorizada y SIN cobrar: se puede seguir.');

// =============================================================================
console.log('\n######## los sujetos\n');
const mutarS = await crear('mutar');
const frecuencia = await crear('frecuencia');
const pausa = await crear('pausa');
const enddate = await crear('enddate');
const cancelar = await crear('cancelar');

console.log(`\n  EX-6 — ¿conviven N autorizadas del mismo pagador? ${vivos.length} vivas del mismo payer_email.`);

// =============================================================================
console.log('\n######## PC-1 / PC-2 / PC-3 — mutar el monto sobre una AUTORIZADA');
if (mutarS.id) {
    console.log(`  estado inicial: ${foto(await leer(mutarS.id))}`);
    await mutar(mutarS.id, 'subir a 2000 (camino feliz)', { auto_recurring: { transaction_amount: 2000, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(mutarS.id, 'bajar al piso, 15', { auto_recurring: { transaction_amount: 15, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    console.log('    — caminos de error:');
    await mutar(mutarS.id, 'bajo el piso: 14', { auto_recurring: { transaction_amount: 14, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(mutarS.id, 'sobre el techo: 2000001', { auto_recurring: { transaction_amount: 2000001, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(mutarS.id, 'cero', { auto_recurring: { transaction_amount: 0, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(mutarS.id, 'negativo', { auto_recurring: { transaction_amount: -100, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(mutarS.id, 'moneda distinta: USD', { auto_recurring: { transaction_amount: 100, currency_id: 'USD' } }, 'auto_recurring.currency_id');
    const post = await leer(mutarS.id);
    console.log(`    PC-3 — ¿sigue autorizada y con su medio de pago? ${post?.status} · payer_id ${post?.payer_id}`);
}

// =============================================================================
console.log('\n######## EX-4 — cambiar la FRECUENCIA sobre una autorizada (sandbox: falla en silencio)');
if (frecuencia.id) {
    await mutar(frecuencia.id, 'a 3 meses', { auto_recurring: { frequency: 3, frequency_type: 'months' } }, 'auto_recurring.frequency');
    await mutar(frecuencia.id, 'a 12 meses', { auto_recurring: { frequency: 12, frequency_type: 'months' } }, 'auto_recurring.frequency');
    await mutar(frecuencia.id, 'a días', { auto_recurring: { frequency: 1, frequency_type: 'days' } }, 'auto_recurring.frequency_type');
    await mutar(
        frecuencia.id,
        'frecuencia + monto en el MISMO PUT',
        { auto_recurring: { frequency: 6, frequency_type: 'months', transaction_amount: 99, currency_id: 'ARS' } },
        'auto_recurring.frequency'
    );
    const f = await leer(frecuencia.id);
    console.log(`    ¿el monto del mismo PUT sí entró? monto=${f?.auto_recurring?.transaction_amount} (se pidió 99)`);
}

// =============================================================================
console.log('\n######## PS-1 / PS-3 / EX-11 — pausa, qué se puede ahí adentro, y reanudar');
if (pausa.id) {
    await mutar(pausa.id, 'PAUSAR', { status: 'paused' }, 'status');
    console.log('    — estando pausada:');
    await mutar(pausa.id, 'cambiar el monto', { auto_recurring: { transaction_amount: 500, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(pausa.id, 'cambiar la frecuencia', { auto_recurring: { frequency: 3, frequency_type: 'months' } }, 'auto_recurring.frequency');
    await mutar(pausa.id, 'fijar end_date', { auto_recurring: { end_date: INICIO } }, 'auto_recurring.end_date');
    await mutar(pausa.id, 'pausar de nuevo', { status: 'paused' }, 'status');
    await mutar(pausa.id, 'REANUDAR', { status: 'authorized' }, 'status');
    console.log('    — con el MISMO payload, ya reanudada (el control de EX-11):');
    await mutar(pausa.id, 'cambiar el monto otra vez', { auto_recurring: { transaction_amount: 500, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    console.log(`    ¿se movió next_payment_date con la pausa? ${(await leer(pausa.id))?.next_payment_date}`);
}

// =============================================================================
console.log('\n######## CN-1 — end_date sobre una ya autorizada (sandbox: 200 y no aplica)');
if (enddate.id) {
    const fin = new Date(Date.now() + 60 * 86400000).toISOString().replace('Z', '-00:00');
    await mutar(enddate.id, 'fijar end_date a +60 días', { auto_recurring: { end_date: fin } }, 'auto_recurring.end_date');
    await mutar(
        enddate.id,
        'end_date junto al monto, mismo PUT',
        { auto_recurring: { end_date: fin, transaction_amount: 77, currency_id: 'ARS' } },
        'auto_recurring.end_date'
    );
    const e = await leer(enddate.id);
    console.log(`    ¿el monto del mismo PUT entró? monto=${e?.auto_recurring?.transaction_amount} (se pidió 77)`);
}

// =============================================================================
console.log('\n######## Campos de IDENTIDAD — ¿se pueden re-vincular después?');
console.log('   Importa de verdad: en producción hay webhooks que fallan porque no se');
console.log('   resuelve la suscripción local. Poder escribir external_reference después');
console.log('   sería una vía de reparación; no poder, cierra esa puerta.');
if (mutarS.id) {
    await mutar(mutarS.id, 'cambiar external_reference', { external_reference: `HOS-1352-REVINCULADO-${STAMP}` }, 'external_reference');
    await mutar(mutarS.id, 'cambiar reason (lo que ve el cliente)', { reason: 'HOS1352 reason nuevo' }, 'reason');
    await mutar(mutarS.id, 'cambiar payer_email', { payer_email: 'otro@example.com' }, 'payer_email');
    await mutar(mutarS.id, 'cambiar back_url', { back_url: 'https://www.hospeda.com.ar/otra' }, 'back_url');
}

// =============================================================================
console.log('\n######## EX-12 — reusar un card_token ya consumido');
const tokenUsado = vivos.length ? 'el del canario' : null;
console.log(`   (se reintenta con un token ya gastado: ${tokenUsado ?? 'n/d'})`);
if (canario.id) {
    // se vuelve a mandar el mismo token que creó el canario
    const gastado = readFileSync('/tmp/hos1352-tokens.txt', 'utf8').split('\n')[0]?.trim();
    if (gastado) await crear('token-gastado', {}, gastado);
    else console.log('   (no quedó registro del token gastado: se saltea)');
}

// =============================================================================
console.log('\n######## Transiciones inválidas y mutaciones sobre una cancelada');
if (cancelar.id) {
    await mutar(cancelar.id, 'CANCELAR', { status: 'cancelled' }, 'status');
    await mutar(cancelar.id, 'cancelar de nuevo', { status: 'cancelled' }, 'status');
    await mutar(cancelar.id, 'revivir: cancelled → authorized', { status: 'authorized' }, 'status');
    await mutar(cancelar.id, 'cancelled → paused', { status: 'paused' }, 'status');
    await mutar(cancelar.id, 'mutar el monto de una cancelada', { auto_recurring: { transaction_amount: 999, currency_id: 'ARS' } }, 'auto_recurring.transaction_amount');
    await mutar(cancelar.id, 'estado inventado', { status: 'chupacabra' }, 'status');
}

// =============================================================================
console.log('\n######## Errores de creación que nadie había probado');
const errores = [
    ['sin card_token, pidiendo authorized', { status: 'authorized' }, true],
    ['sin back_url', { back_url: undefined }, false],
    ['sin payer_email', { payer_email: undefined }, false],
    ['start_date en el PASADO', { auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: MONTO, currency_id: 'ARS', start_date: '2020-01-01T00:00:00.000-00:00' } }, false]
];
for (const [etiqueta, extra, sinToken] of errores) {
    const cuerpo = {
        reason: `HOS1352 err`,
        payer_email: PAGADOR,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-err-${STAMP}-${etiqueta.slice(0, 12)}`,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: MONTO, currency_id: 'ARS', start_date: INICIO },
        ...extra
    };
    if (!sinToken) {
        cuerpo.card_token_id = tokens.length ? tomarToken() : undefined;
        cuerpo.status = 'authorized';
    } else {
        cuerpo.status = 'authorized';
    }
    for (const k of Object.keys(cuerpo)) if (cuerpo[k] === undefined) delete cuerpo[k];
    const r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
    if (r.b?.id) vivos.push({ slug: `err-${etiqueta.slice(0, 12)}`, id: r.b.id });
    console.log(
        `  ${etiqueta.padEnd(36)} HTTP ${r.code} ${r.b?.id ? `· CREÓ ${r.b.id} (${r.b.status})` : `· "${r.b?.message ?? ''}"`}`
    );
}

// =============================================================================
console.log('\n######## LIMPIEZA — cancelar todo y verificarlo por relectura');
for (const v of vivos) {
    const r = await pedir(`/preapproval/${v.id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    const f = await leer(v.id);
    const cobrado = Number(f?.summarized?.charged_quantity ?? 0);
    console.log(
        `  ${v.slug.padEnd(16)} ${v.id} · PUT ${r.code} → ${f?.status}${f?.status === 'cancelled' ? ' ✓' : ' ⚠ QUEDA VIVO'}${cobrado > 0 ? `  ⚠⚠ COBRÓ ${cobrado}` : ''}`
    );
}

console.log(`\n######## ¿se cobró algo en toda la corrida?`);
let totalCobros = 0;
for (const v of vivos) {
    const ap = await pedir(`/authorized_payments/search?preapproval_id=${v.id}&limit=5`);
    const n = Number(ap.b?.paging?.total ?? 0);
    totalCobros += n;
    if (n > 0) console.log(`  ⚠ ${v.slug}: ${n} cobro(s)`);
}
console.log(totalCobros === 0 ? '  ✓ CERO cobros. No se movió un peso.' : `  ⚠ ${totalCobros} cobros — revisar`);
console.log(`\n############ fin · sujetos ${vivos.length} · tokens sin usar: ${tokens.length}`);
