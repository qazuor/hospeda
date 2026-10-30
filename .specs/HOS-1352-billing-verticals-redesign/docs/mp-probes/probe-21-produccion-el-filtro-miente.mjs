// =============================================================================
// SONDA 21 — Producción: ¿el filtro `status` devuelve un SUBCONJUNTO?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// ES DE SÓLO LECTURA. Programa: HOS-1352.
//
// LO QUE ENCONTRÓ LA SONDA 20, Y HAY QUE CONFIRMAR ANTES DE CREERLO
// -----------------------------------------------------------------
// Recorriendo las 76 suscripciones de producción una por una, los estados son:
// `cancelled` 69, `authorized` 4, `pending` 3. Suman 76, perfecto.
//
// Pero el FILTRO dice otra cosa: `status=cancelled` devuelve `paging.total: 15`.
// Quince, no sesenta y nueve.
//
// Si eso es cierto, **el filtro devuelve un subconjunto sin decirlo**, y es un
// modo de falla peor que el de `external_reference` (que devuelve todo) y peor
// que el del estado inválido (que devuelve cero): devuelve ALGO, y algo
// plausible. Un barrido de conciliación que itere `status=cancelled` procesaría
// 15 de 69 y no tendría forma de notarlo.
//
// En sandbox esto NO se veía: ahí los cuatro estados sumaban exactamente el
// total (153 = 153). Es justo lo que el owner sospechaba — un resultado de
// sandbox no responde por producción.
//
// TRES LECTURAS POSIBLES, Y HAY QUE DISTINGUIRLAS
// -----------------------------------------------
//   A. `paging.total` de una consulta filtrada es aproximado o está topeado, y
//      las filas SÍ están todas si se pagina.
//   B. El filtro realmente devuelve menos filas.
//   C. El listado sin filtro y el filtrado miran conjuntos distintos.
//
// Se distinguen PAGINANDO el filtrado y contando filas de verdad, en vez de
// creerle al total.
//
// ADEMÁS
// ------
// - `EX-16` contra el preapproval que SÍ produjo un cobro recurrente en
//   producción (`eebf9484…`, el que aparece en la metadata del pago
//   `168470636028`). Las 4 autorizadas daban 0, pero ninguna había cobrado
//   todavía: medirlo contra ellas no probaba nada.
// - Qué le pasa a la comisión cuando se reembolsa.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p21.mjs && node /tmp/p21.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;

const g = async (ruta) => {
    const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const t = await r.text();
    let b;
    try {
        b = JSON.parse(t);
    } catch {
        b = t.slice(0, 200);
    }
    return { code: r.status, b };
};

const yo = await g('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}`);
    process.exit(1);
}
console.log(`############ SONDA 21 — producción · ${new Date().toISOString()}`);

// =============================================================================
console.log('\n######## 1. EL FILTRO `status` — contar filas, no creerle al total');

const paginar = async (qs) => {
    const ids = new Set();
    let offset = 0;
    let total = null;
    for (let i = 0; i < 20; i++) {
        const r = await g(`${qs}&limit=50&offset=${offset}`);
        total = r.b?.paging?.total ?? total;
        const res = r.b?.results ?? [];
        if (res.length === 0) break;
        for (const p of res) ids.add(p.id);
        offset += res.length;
        if (total != null && offset >= total) break;
    }
    return { total, ids };
};

const sinFiltro = await paginar('/preapproval/search?x=1');
const porEstado = {};
for (const id of sinFiltro.ids) porEstado[id] = null;
// recorrer otra vez guardando el status de cada id
{
    let offset = 0;
    for (let i = 0; i < 20; i++) {
        const r = await g(`/preapproval/search?limit=50&offset=${offset}`);
        const res = r.b?.results ?? [];
        if (res.length === 0) break;
        for (const p of res) porEstado[p.id] = p.status;
        offset += res.length;
        if (offset >= (r.b?.paging?.total ?? 0)) break;
    }
}
const realPorEstado = {};
for (const st of Object.values(porEstado)) realPorEstado[st] = (realPorEstado[st] ?? 0) + 1;

console.log(`  sin filtro: total ${sinFiltro.total} · filas distintas recorridas ${sinFiltro.ids.size}`);
console.log(`  estados contados a mano sobre esas filas: ${JSON.stringify(realPorEstado)}`);

for (const st of ['authorized', 'pending', 'cancelled', 'paused']) {
    const f = await paginar(`/preapproval/search?status=${st}`);
    const real = realPorEstado[st] ?? 0;
    const faltan = [...sinFiltro.ids].filter((id) => porEstado[id] === st && !f.ids.has(id));
    const marca = f.ids.size === real ? '✓' : '⚠ SUBCONJUNTO';
    console.log(
        `  status=${st.padEnd(11)} total dice ${String(f.total).padStart(3)} · filas paginadas ${String(f.ids.size).padStart(3)} · contadas sin filtro ${String(real).padStart(3)}  ${marca}`
    );
    if (faltan.length) console.log(`      no aparecen en el filtrado: ${faltan.slice(0, 5).join(', ')}${faltan.length > 5 ? ` … (+${faltan.length - 5})` : ''}`);
}

// =============================================================================
console.log('\n######## 2. EX-16 contra la suscripción que SÍ cobró en producción');
const SUB_CON_COBRO = 'eebf948419bb4cdfaf8f5f3d73fe05ed';
const subGet = await g(`/preapproval/${SUB_CON_COBRO}`);
console.log(
    `  ${SUB_CON_COBRO} → HTTP ${subGet.code} · status ${subGet.b?.status} · ARS ${subGet.b?.auto_recurring?.transaction_amount} · ${subGet.b?.auto_recurring?.frequency} ${subGet.b?.auto_recurring?.frequency_type}`
);
const ap = await g(`/authorized_payments/search?preapproval_id=${SUB_CON_COBRO}&limit=10`);
console.log(`  /authorized_payments/search → HTTP ${ap.code} · total ${ap.b?.paging?.total}`);
for (const a of ap.b?.results ?? []) {
    console.log(
        `    ${a.id} · ${a.status} · ARS ${a.transaction_amount} · debit ${a.debit_date} · retry ${a.retry_attempt} · payment ${a.payment?.id}/${a.payment?.status}/${a.payment?.status_detail}`
    );
}

// por qué las 4 autorizadas daban 0
console.log('\n  las 4 autorizadas: ¿ya les tocó cobrar alguna vez?');
const auths = await g('/preapproval/search?limit=20&status=authorized');
for (const s of auths.b?.results ?? []) {
    const d = await g(`/preapproval/${s.id}`);
    console.log(
        `    ${s.id} · creada ${(d.b?.date_created ?? '').slice(0, 10)} · next ${(d.b?.next_payment_date ?? '—').slice(0, 10)} · free_trial ${JSON.stringify(d.b?.auto_recurring?.free_trial ?? null)}`
    );
}

// =============================================================================
console.log('\n######## 3. ¿Qué pasa con la COMISIÓN cuando se reembolsa?');
console.log('   Importa para saber cuánto cuesta de verdad cada experimento.\n');
for (const id of ['174625958196', '168470636028']) {
    const p = await g(`/v1/payments/${id}`);
    const b = p.b ?? {};
    console.log(`  --- ${id} · ${b.status}/${b.status_detail} · ARS ${b.transaction_amount}`);
    console.log(`      fee_details: ${JSON.stringify(b.fee_details ?? [])}`);
    console.log(
        `      neto recibido: ${b.transaction_details?.net_received_amount} · devuelto: ${b.transaction_amount_refunded}`
    );
    const rf = await g(`/v1/payments/${id}/refunds`);
    for (const r of Array.isArray(rf.b) ? rf.b : []) {
        console.log(
            `      refund ${r.id} · ARS ${r.amount} · ${r.status} · ${(r.date_created ?? '').slice(0, 10)} · ajuste_comision ${JSON.stringify(r.adjustment_amount ?? null)}`
        );
    }
}

console.log('\n############ fin — no se escribió nada');
