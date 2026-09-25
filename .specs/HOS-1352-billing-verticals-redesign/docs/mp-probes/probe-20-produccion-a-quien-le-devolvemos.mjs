// =============================================================================
// SONDA 20 — Producción: quién es el pagador, y tres cosas que no cierran
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. ES DE SÓLO LECTURA.
//
// POR QUÉ EXISTE
// --------------
// La sonda 19 dejó tres cosas que no cierran, y una de ellas decide si los
// experimentos de reembolso se pueden hacer o no.
//
// 1. A QUIÉN LE DEVOLVERÍAMOS LA PLATA
//    Un reembolso no "devuelve el dinero a nuestra cuenta": se lo manda AL
//    PAGADOR. Los reembolsos de la sesión anterior fueron sobre compras del
//    propio owner, y por eso el dinero volvió. Los cuatro pagos con saldo que
//    quedan son de ARS 4.900, 18.000, 7.500 y 5.000 — y si el pagador es un
//    CLIENTE REAL, reembolsar es regalarle plata y pedirle que vuelva a pagar.
//    Antes de proponer un monto hay que saber de quién es cada pago.
//
// 2. EL `status` NO PARTICIONA EN PRODUCCIÓN
//    En sandbox los cuatro estados sumaban exactamente el total (153 = 153).
//    En producción suman 22 sobre 76: hay 54 suscripciones en estados que no
//    son `authorized`, `pending`, `cancelled` ni `paused`. Si un barrido de
//    conciliación itera esos cuatro, se pierde el 71% de la cartera. Hay que
//    saber qué estados son.
//
// 3. `EX-16` SE CAE EN PRODUCCIÓN
//    `/authorized_payments/search?preapproval_id=` devolvió **0** para una
//    suscripción `authorized` real. En sandbox devolvía 1. Y sobre esa fila se
//    apoya la recomendación de `R-MP-01` (construir la conciliación sobre la
//    familia de suscripciones en vez de sobre `/v1/payments`, que el proveedor
//    va a descontinuar). Si en producción no trae nada, la recomendación no
//    tiene piso.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p20.mjs && node /tmp/p20.mjs'
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
console.log(`############ SONDA 20 — producción · ${new Date().toISOString()}`);
console.log(`cuenta: ${yo.b?.nickname} (${yo.b?.id}) · email del vendedor: ${yo.b?.email}`);

// =============================================================================
console.log('\n######## 1. ¿DE QUIÉN SON LOS PAGOS QUE SE PODRÍAN REEMBOLSAR?');
console.log('   Un reembolso le manda la plata AL PAGADOR, no a nosotros.\n');
const CANDIDATOS = ['174625958196', '172900657971', '169332950433', '169761603672', '168470636028'];
for (const id of CANDIDATOS) {
    const p = await g(`/v1/payments/${id}`);
    const b = p.b ?? {};
    console.log(`  --- ${id}`);
    console.log(
        `      ${b.status}/${b.status_detail} · ${b.operation_type} · ARS ${b.transaction_amount} · devuelto ${b.transaction_amount_refunded ?? 0}`
    );
    console.log(
        `      pagador: id ${b.payer?.id} · ${b.payer?.email} · ${b.payer?.first_name ?? ''} ${b.payer?.last_name ?? ''}`.trimEnd()
    );
    console.log(`      descripción: ${b.description ?? '—'}`);
    console.log(`      external_reference: ${b.external_reference ?? '—'}`);
    console.log(`      metadata: ${JSON.stringify(b.metadata ?? {}).slice(0, 200)}`);
}

// =============================================================================
console.log('\n######## 2. ¿QUÉ ESTADOS DE SUSCRIPCIÓN EXISTEN DE VERDAD EN PRODUCCIÓN?');
console.log('   Los cuatro conocidos suman 22 sobre 76. Faltan 54.\n');
const tally = {};
let offset = 0;
let total = null;
while (offset < 500) {
    const r = await g(`/preapproval/search?limit=50&offset=${offset}`);
    total = r.b?.paging?.total ?? total;
    const res = r.b?.results ?? [];
    if (res.length === 0) break;
    for (const p of res) tally[p.status ?? '(sin status)'] = (tally[p.status ?? '(sin status)'] ?? 0) + 1;
    offset += res.length;
    if (offset >= (total ?? 0)) break;
}
console.log(`  recorridas ${offset} de ${total}`);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(20)} ${v}`);
const conocidos = ['authorized', 'pending', 'cancelled', 'paused'];
const desconocidos = Object.keys(tally).filter((k) => !conocidos.includes(k));
console.log(
    desconocidos.length
        ? `  ⚠ ESTADOS QUE NO ESTABAN EN EL MODELO: ${desconocidos.join(', ')}`
        : '  → los estados del listado son los cuatro conocidos: la diferencia está en otro lado'
);

// ¿Y filtran esos estados nuevos?
for (const s of desconocidos) {
    const r = await g(`/preapproval/search?limit=1&status=${encodeURIComponent(s)}`);
    console.log(`    filtro status=${s}: HTTP ${r.code} · total ${r.b?.paging?.total}`);
}

// =============================================================================
console.log('\n######## 3. ¿LA PROYECCIÓN DEL search ES LA MISMA QUE LA DEL GET?');
console.log('   En producción el search devolvió next_payment_date y charged_quantity vacíos.\n');
const unaAuth = await g('/preapproval/search?limit=1&status=authorized');
const sub = (unaAuth.b?.results ?? [])[0];
if (sub) {
    const directo = await g(`/preapproval/${sub.id}`);
    const campos = ['status', 'next_payment_date', 'summarized', 'auto_recurring', 'payer_id', 'external_reference'];
    for (const c of campos) {
        const enSearch = JSON.stringify(sub[c] ?? null).slice(0, 90);
        const enGet = JSON.stringify(directo.b?.[c] ?? null).slice(0, 90);
        const igual = enSearch === enGet ? '=' : '≠';
        console.log(`  ${igual} ${c.padEnd(20)} search: ${enSearch}`);
        if (igual === '≠') console.log(`    ${''.padEnd(21)} GET:    ${enGet}`);
    }
}

// =============================================================================
console.log('\n######## 4. EX-16 EN PRODUCCIÓN — ¿trae algo /authorized_payments?');
console.log('   Se prueba contra TODAS las autorizadas, no contra una sola.\n');
const auths = await g('/preapproval/search?limit=20&status=authorized');
for (const s of auths.b?.results ?? []) {
    const ap = await g(`/authorized_payments/search?preapproval_id=${s.id}&limit=5`);
    console.log(
        `  ${s.id} · ARS ${s.auto_recurring?.transaction_amount} → authorized_payments: HTTP ${ap.code} · total ${ap.b?.paging?.total}`
    );
    for (const a of ap.b?.results ?? []) {
        console.log(`      ${a.id} · ${a.status} · ARS ${a.transaction_amount} · payment ${a.payment?.id}/${a.payment?.status}`);
    }
}

// ¿Y existe algún cobro recurrente en producción, contra el que EX-16 pueda medirse?
console.log('\n  ¿hay cobros recurrentes en producción?');
const rec = await g('/v1/payments/search?operation_type=recurring_payment&sort=date_created&criteria=desc&limit=10');
console.log(`    HTTP ${rec.code} · total ${rec.b?.paging?.total}`);
for (const p of rec.b?.results ?? []) {
    console.log(
        `    ${p.id} · ${p.status} · ARS ${p.transaction_amount} · ${(p.date_approved ?? '').slice(0, 10)} · xref ${p.external_reference ?? '—'}`
    );
    // de dónde sale la suscripción que lo originó
    const pistas = {
        metadata: p.metadata,
        point_of_interaction: p.point_of_interaction?.type,
        description: p.description
    };
    console.log(`        pistas: ${JSON.stringify(pistas).slice(0, 300)}`);
}

console.log('\n############ fin — no se escribió nada');
