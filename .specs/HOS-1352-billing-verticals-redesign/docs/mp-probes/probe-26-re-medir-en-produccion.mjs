// =============================================================================
// SONDA 26 — Re-medir en PRODUCCIÓN lo que sólo estaba medido en sandbox
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352.
//
// POR QUÉ
// -------
// Pedido del owner: *"ya tuvimos el problema de algo que pensamos que no se
// podía hacer, y la realidad era que no andaba en sandbox, pero en producción
// sí"*. Se refiere a `RF-1`/`RF-2`, que estuvieron en `UNKNOWN` por un `401`
// que sólo existía en la cuenta de prueba.
//
// Así que las filas `NOT_SUPPORTED` y parciales que se puedan re-medir sin
// cobrarle a nadie, se re-miden acá contra la cuenta real.
//
// EL RADIO DE EXPLOSIÓN, MEDIDO ANTES (sonda 25)
// ----------------------------------------------
// Crear un preapproval `pending` en producción y cancelarlo produce
// exactamente DOS webhooks a la API de producción, los dos con `200`:
//   - al crear:    "Subscription in pending state - no status change applied"
//   - al cancelar: WARN "No local subscription found …" y después `200`
// No encola reintentos y no escribe una fila de suscripción. Por eso esta
// sonda puede crear varios sujetos: son ~2 entradas de log por sujeto.
//
// QUÉ NO PUEDE RE-MEDIR, Y POR QUÉ
// --------------------------------
//   `EX-4`  (cambiar el ciclo) y `UP-*`/`DW-*`/`PS-*`: exigen una suscripción
//           AUTORIZADA, y autorizar en producción exige una tarjeta real y un
//           cobro real.
//   `EX-12` (reusar un `card_token`): ídem, exige tokenizar una tarjeta real.
//   `EX-14` (distinguir entorno por `live_mode`): el receptor de producción es
//           nuestra propia API y sus logs no vuelcan el cuerpo del evento.
//
// LIMPIEZA
// --------
// Cancela todo lo que crea y lo verifica por relectura, igual que las sondas
// 14 y 15. Lo que no se crea (los rechazos) no deja nada.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p26.mjs && node /tmp/p26.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';
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
console.log(`############ SONDA 26 — re-medición en PRODUCCIÓN · ${new Date().toISOString()}`);
console.log(`cuenta: ${yo.b?.nickname} (${yo.b?.id}) · site ${yo.b?.site_id}`);

const creados = [];

// <etiqueta> <cuerpo parcial> <clave de idempotencia|null>
const crear = async (etiqueta, extra, key = null) => {
    const cuerpo = {
        reason: `HOS1352 prod ${etiqueta}`.slice(0, 60),
        payer_email: PAGADOR,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-prod-${STAMP}-${etiqueta}`,
        auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 100, currency_id: 'ARS' },
        ...extra
    };
    const init = { method: 'POST', body: JSON.stringify(cuerpo), headers: {} };
    if (key) init.headers['X-Idempotency-Key'] = key;
    const r = await pedir('/preapproval', init);
    const id = r.b?.id ?? null;
    if (id) creados.push({ etiqueta, id });
    console.log(
        `  ${etiqueta.padEnd(22)} HTTP ${r.code} ${id ? `· id ${id}` : `· "${r.b?.message ?? JSON.stringify(r.b).slice(0, 120)}"`}`
    );
    return { r, id };
};

const releer = async (id) => (await pedir(`/preapproval/${id}`)).b;

// =============================================================================
console.log('\n######## EX-17 — ¿deduplica la creación? (en sandbox: NO, por ningún mecanismo)');
const XA = { external_reference: `HOS-1352-prod-${STAMP}-dup` };
const a1 = await crear('ex17-a1', XA);
const a2 = await crear('ex17-a2', XA);
const K = `hos1352-prod-${STAMP}`;
const b1 = await crear('ex17-b1', {}, K);
const b2 = await crear('ex17-b2', {}, K);
const c1 = await crear('ex17-c1', { auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 777, currency_id: 'ARS' } }, K);
console.log(
    `  → external_reference: ${a1.id && a2.id && a1.id !== a2.id ? 'NO deduplica (igual que en sandbox)' : 'DISTINTO que en sandbox — mirar'}`
);
console.log(
    `  → X-Idempotency-Key: ${b1.id && b2.id && b1.id !== b2.id ? 'NO deduplica (igual que en sandbox)' : 'DISTINTO que en sandbox — mirar'}`
);
console.log(`  → misma clave con monto distinto: ${c1.id ? `crea otro (${c1.id})` : 'rechaza'}`);

// =============================================================================
console.log('\n######## EX-18 — moneda (en sandbox: sólo ARS)');
for (const [cur, monto] of [
    ['USD', 100],
    ['BRL', 50]
]) {
    const r = await crear(
        `ex18-${cur}`,
        { auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: monto, currency_id: cur } }
    );
    if (r.id) {
        const l = await releer(r.id);
        console.log(`      RELECTURA: moneda ${l?.auto_recurring?.currency_id} · monto ${l?.auto_recurring?.transaction_amount}`);
    }
}

// =============================================================================
console.log('\n######## PC-2 — piso y techo del monto (en sandbox: 15 a 2.000.000)');
for (const monto of [14, 2000001]) {
    await crear(
        `pc2-${monto}`,
        { auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: monto, currency_id: 'ARS' } }
    );
}

// =============================================================================
console.log('\n######## FR-4 — "years" (en sandbox: NO existe, válidos [days, months])');
await crear('fr4-years', {
    auto_recurring: { frequency: 1, frequency_type: 'years', transaction_amount: 100, currency_id: 'ARS' }
});

// =============================================================================
console.log('\n######## EX-5 — ¿una autorización puede cubrir más de un monto?');
await crear('ex5-array', {
    auto_recurring: [
        { frequency: 1, frequency_type: 'months', transaction_amount: 100, currency_id: 'ARS' },
        { frequency: 1, frequency_type: 'months', transaction_amount: 200, currency_id: 'ARS' }
    ]
});
const items = await crear('ex5-items', {
    items: [
        { title: 'plan', unit_price: 100, quantity: 1 },
        { title: 'addon', unit_price: 50, quantity: 1 }
    ]
});
if (items.id) {
    const l = await releer(items.id);
    console.log(
        `      RELECTURA: ¿volvió "items"? ${l && 'items' in l ? 'SÍ' : 'NO — descartado en silencio'} · monto ${l?.auto_recurring?.transaction_amount}`
    );
}

// =============================================================================
console.log('\n######## CN-1 — end_date al CREAR (en sandbox: se acepta y sobrevive a la relectura)');
const fin = new Date(Date.now() + 90 * 86400000).toISOString().replace('Z', '-00:00');
const cn1 = await crear('cn1-end-date', {
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 100,
        currency_id: 'ARS',
        end_date: fin
    }
});
if (cn1.id) {
    const l = await releer(cn1.id);
    console.log(
        `      RELECTURA: end_date ${l?.auto_recurring?.end_date ?? 'NO APARECE — aceptado y descartado (§0)'}`
    );
}

// =============================================================================
console.log('\n######## LIMPIEZA — cancelar todo lo creado, y verificarlo');
for (const c of creados) {
    const r = await pedir(`/preapproval/${c.id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    const l = await releer(c.id);
    console.log(`  ${c.etiqueta.padEnd(22)} ${c.id} · PUT ${r.code} → ${l?.status}${l?.status === 'cancelled' ? ' ✓' : '  ⚠ QUEDA VIVO'}`);
}

console.log(`\n############ fin · creados y cancelados: ${creados.length}`);
