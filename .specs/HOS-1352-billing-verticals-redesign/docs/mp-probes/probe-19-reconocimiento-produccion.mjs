// =============================================================================
// SONDA 19 — Reconocimiento de PRODUCCIÓN, sólo lectura
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352.
//
// POR QUÉ EXISTE
// --------------
// El sandbox ya mintió una vez, y caro: `RF-1` y `RF-2` estuvieron en `UNKNOWN`
// con un `401` que se leía como "el proveedor no deja reembolsar", cuando lo
// que pasaba era que **la cuenta de prueba no puede escribir sobre la API de
// Payments en absoluto**. En producción la misma llamada entra.
//
// O sea que **un resultado de sandbox no responde por producción**. Esta sonda
// vuelve a preguntar en producción todo lo que se pueda preguntar SIN ESCRIBIR
// NADA, y deja el inventario que hace falta para decidir los experimentos que
// sí escriben.
//
// ES DE SÓLO LECTURA. No crea, no muta, no cancela y no reembolsa.
//
// DÓNDE CORRE
// -----------
// Adentro del contenedor de la API en el VPS, para que la credencial de
// producción no salga de su entorno:
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p19.mjs && node /tmp/p19.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165; // HOSPEDA_COM_AR

if (!TOKEN) {
    console.error('✗ falta el token en el entorno');
    process.exit(1);
}

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

console.log(`############ SONDA 19 — reconocimiento de PRODUCCIÓN · ${new Date().toISOString()}`);

// --- guard: de quién es el token --------------------------------------------
const yo = await g('/users/me');
console.log(
    `\n######## cuenta: ${yo.b?.nickname} (id ${yo.b?.id}) · tags ${JSON.stringify(yo.b?.tags)} · site ${yo.b?.site_id}`
);
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: se esperaba ${CUENTA_ESPERADA}`);
    process.exit(1);
}

// --- RC-1 en producción ------------------------------------------------------
// El método es el mismo de la sonda 16: el control con basura. Un filtro que se
// ignora no da error, devuelve TODO.
console.log('\n######## RC-1 — ¿filtra igual el search en producción?');
const base = await g('/preapproval/search?limit=1');
const TOTAL = base.b?.paging?.total;
console.log(`  sin filtro                 total ${TOTAL}`);

const estados = {};
for (const s of ['authorized', 'pending', 'cancelled', 'paused']) {
    const r = await g(`/preapproval/search?limit=1&status=${s}`);
    estados[s] = r.b?.paging?.total;
    console.log(`  status=${s.padEnd(18)} total ${estados[s]}`);
}
const basuraStatus = await g('/preapproval/search?limit=1&status=chupacabra');
console.log(`  status=chupacabra          total ${basuraStatus.b?.paging?.total}  ← CONTROL`);
const basuraXref = await g(`/preapproval/search?limit=1&external_reference=HOS-1352-no-existe-${Date.now()}`);
console.log(`  external_reference=basura  total ${basuraXref.b?.paging?.total}  ← CONTROL`);
const sumaEstados = Object.values(estados).reduce((a, b) => a + (b ?? 0), 0);
console.log(`  suma de los 4 estados: ${sumaEstados} · total sin filtro: ${TOTAL}`);
console.log(
    `  → external_reference: ${basuraXref.b?.paging?.total === TOTAL ? 'SE IGNORA (igual que en sandbox)' : 'se comporta DISTINTO que en sandbox — mirar'}`
);
console.log(
    `  → status inválido: ${basuraStatus.b?.paging?.total === 0 ? '200 con total 0 (igual que en sandbox)' : 'DISTINTO — mirar'}`
);

// --- inventario de suscripciones reales --------------------------------------
console.log('\n######## las suscripciones autorizadas de producción');
const auth = await g('/preapproval/search?limit=20&status=authorized');
for (const p of auth.b?.results ?? []) {
    console.log(
        `  ${p.id} · ${p.status} · ARS ${p.auto_recurring?.transaction_amount} · ${p.auto_recurring?.frequency} ${p.auto_recurring?.frequency_type} · cobros ${p.summarized?.charged_quantity} · next ${p.next_payment_date} · xref ${p.external_reference ?? '—'}`
    );
}

// --- EX-16 en producción -----------------------------------------------------
// ¿La conciliación por la familia de suscripciones funciona igual acá?
const unaSub = (auth.b?.results ?? [])[0];
if (unaSub) {
    console.log(`\n######## EX-16 — /authorized_payments sobre ${unaSub.id}`);
    const ap = await g(`/authorized_payments/search?preapproval_id=${unaSub.id}&limit=5`);
    console.log(`  HTTP ${ap.code} · total ${ap.b?.paging?.total}`);
    for (const a of ap.b?.results ?? []) {
        console.log(
            `    ${a.id} · ${a.status} · ARS ${a.transaction_amount} · debit ${a.debit_date} · retry ${a.retry_attempt} · payment ${a.payment?.id}/${a.payment?.status}`
        );
    }
    const apBasura = await g('/authorized_payments/search?preapproval_id=no-existe-1352&limit=5');
    console.log(`  CONTROL con basura: HTTP ${apBasura.code} · total ${apBasura.b?.paging?.total}`);
}

// --- inventario de pagos, para decidir los experimentos que mueven plata -----
console.log('\n######## pagos de producción — qué hay para reembolsar');
const pagos = await g('/v1/payments/search?sort=date_created&criteria=desc&limit=30');
console.log(`  HTTP ${pagos.code} · total ${pagos.b?.paging?.total}`);
const filas = (pagos.b?.results ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    detalle: p.status_detail,
    tipo: p.operation_type,
    monto: p.transaction_amount,
    devuelto: p.transaction_amount_refunded ?? 0,
    queda: Number(p.transaction_amount) - Number(p.transaction_amount_refunded ?? 0),
    fecha: (p.date_approved ?? p.date_created ?? '').slice(0, 10),
    dias: p.date_approved ? Math.floor((Date.now() - Date.parse(p.date_approved)) / 86400000) : null
}));
for (const f of filas) {
    console.log(
        `  ${f.id} · ${String(f.status).padEnd(9)} ${String(f.detalle).padEnd(20)} ${String(f.tipo).padEnd(18)} ARS ${String(f.monto).padStart(9)} · devuelto ${String(f.devuelto).padStart(8)} · QUEDA ${String(f.queda).padStart(9)} · ${f.fecha} (${f.dias}d)`
    );
}

console.log('\n######## candidatos para los experimentos que mueven plata');
const refundables = filas.filter((f) => f.status === 'approved' && f.queda > 0);
console.log(`  pagos con saldo reembolsable: ${refundables.length}`);
for (const f of refundables) {
    console.log(`    ${f.id} · ${f.tipo} · queda ARS ${f.queda} de ${f.monto} · ${f.dias} días`);
}
const masViejo = filas.filter((f) => f.dias != null).sort((a, b) => b.dias - a.dias)[0];
console.log(`  RF-3 — el pago más viejo que se ve: ${masViejo?.id} · ${masViejo?.dias} días · ${masViejo?.status}`);

console.log('\n############ fin — no se escribió nada');
