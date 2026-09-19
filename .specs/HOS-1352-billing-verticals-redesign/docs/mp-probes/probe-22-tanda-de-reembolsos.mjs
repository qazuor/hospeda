// =============================================================================
// SONDA 22 — La tanda de reembolsos que sí mueve plata
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. Cierra `RF-2` (el mínimo), `RF-4` (el header) y le da
// piso al §51 (idempotencia del reembolso).
//
// A QUIÉN LE DEVUELVE LA PLATA, QUE ES LA PREGUNTA QUE HABÍA QUE HACER PRIMERO
// ----------------------------------------------------------------------------
// Un reembolso NO "devuelve el dinero a nuestra cuenta": se lo manda AL
// PAGADOR. La sonda 20 midió que los cinco pagos reembolsables de producción
// tienen el mismo pagador —`qazuor@gmail.com`, id `5860436`, el propio owner—
// así que acá la plata va de su cuenta vendedora a su propia tarjeta.
//
// **El guard de esta sonda es ése**: relee el pago y ABORTA si el pagador no es
// ese id. Si mañana alguien la corre sobre el pago de un cliente real, no
// corre.
//
// LO QUE SÍ CUESTA
// ----------------
// La comisión NO vuelve. Medido en la sonda 21: sobre el pago de ARS 15 con
// comisión 1,20, el reembolso total de 15 dejó `adjustment_amount: 0` y el
// `fee_details` intacto. O sea que cada reembolso cuesta su parte de comisión,
// y el tope de esta tanda es de unos ARS 16.
//
// EL SUJETO
// ---------
// `174625958196` — ARS 5.000, `regular_payment`, "Visibility Boost (7 days)",
// 27 días, con ARS 4.900 de saldo. Se elige porque es una compra suelta de un
// addon y NO una suscripción viva: reembolsar sobre una suscripción activa
// podría desincronizar el estado de billing de producción. Y ya recibió un
// parcial de ARS 100 el 2026-09-15 sin consecuencias observadas.
//
// EL ORDEN, Y POR QUÉ EMPIEZA DONDE EMPIEZA
// ------------------------------------------
// El primer paso NO es la bisección: es el experimento que DISTINGUE. Lo que
// hay medido es que `{"amount": 5}` se rechazó **sobre dos pagos de ARS 15**, y
// que 50 entró sobre uno de 100 y 100 sobre uno de 5.000. Con eso hay dos
// hipótesis vivas y nadie las separó:
//
//   (a) hay un PISO ABSOLUTO del monto a reembolsar, entre 5 y 50;
//   (b) la regla no es sobre el monto sino sobre lo que QUEDA — refundar 5 de
//       un pago de 15 deja un resto de 10, y los dos casos que entraron dejaron
//       restos cómodos (50 de 100, 4.900 de 5.000).
//
// `{"amount": 5}` sobre un pago de 5.000 las separa de un saque: deja un resto
// de 4.895. Si entra, la hipótesis del piso estaba mal planteada y la bisección
// no había que hacerla. Si no entra, hay piso y recién ahí se bisecta.
//
// LO QUE NO HACE, A PROPÓSITO
// ---------------------------
// Pedir MÁS de lo que queda (por ejemplo 4.901 sobre un saldo de 4.900). Si el
// proveedor validara contra el monto total en vez de contra el saldo, ese
// intento reembolsaría ~4.900 de una y la comisión perdida serían ~390. Es la
// única pieza de la familia que necesita su propia autorización.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p22.mjs && node /tmp/p22.mjs'
//
// Variables: `SOLO=1` corre únicamente el paso 1 (el que distingue) y sale.
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165; // HOSPEDA_COM_AR
const PAGADOR_ESPERADO = 5860436; // qazuor@gmail.com — el propio owner
const PAGO = process.env.PAGO ?? '174625958196';
const TOPE_POR_INTENTO = 50; // ningún intento de esta sonda pide más que esto

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
        b = t.slice(0, 300);
    }
    return { code: r.status, b };
};

const clave = () => `hos1352-p22-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// --- guards ------------------------------------------------------------------
const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}, se esperaba ${CUENTA_ESPERADA}`);
    process.exit(1);
}
console.log(`############ SONDA 22 — tanda de reembolsos · ${new Date().toISOString()}`);
console.log(`cuenta: ${yo.b?.nickname} (${yo.b?.id})`);

const leer = async () => {
    const p = await pedir(`/v1/payments/${PAGO}`);
    return {
        status: p.b?.status,
        detalle: p.b?.status_detail,
        total: Number(p.b?.transaction_amount),
        devuelto: Number(p.b?.transaction_amount_refunded ?? 0),
        pagador: p.b?.payer?.id,
        email: p.b?.payer?.email,
        desc: p.b?.description
    };
};

const antes = await leer();
console.log(`\n######## el sujeto: ${PAGO}`);
console.log(`  ${antes.desc} · ${antes.status}/${antes.detalle} · ARS ${antes.total} · devuelto ${antes.devuelto}`);
console.log(`  pagador: ${antes.pagador} (${antes.email})`);
console.log(`  QUEDA: ${antes.total - antes.devuelto}`);

if (Number(antes.pagador) !== PAGADOR_ESPERADO) {
    console.error(`\n✗ ABORTA: el pagador es ${antes.pagador} (${antes.email}), no el owner (${PAGADOR_ESPERADO}).`);
    console.error('  Esta sonda sólo corre sobre pagos cuyo pagador es el propio owner.');
    process.exit(1);
}
if (antes.total - antes.devuelto <= TOPE_POR_INTENTO * 4) {
    console.error(`\n✗ ABORTA: queda muy poco saldo (${antes.total - antes.devuelto}) para una tanda acotada a ${TOPE_POR_INTENTO} por intento.`);
    process.exit(1);
}

// --- el motor ----------------------------------------------------------------
const hechos = [];
const reembolsar = async (etiqueta, amount, opciones = {}) => {
    if (amount != null && amount > TOPE_POR_INTENTO) {
        console.error(`✗ ${etiqueta}: ${amount} supera el tope de ${TOPE_POR_INTENTO} — no se manda`);
        return { code: 0, b: { message: '(bloqueado por el tope de la sonda)' } };
    }
    const init = { method: 'POST', headers: {} };
    if (!opciones.sinHeader) init.headers['X-Idempotency-Key'] = opciones.key ?? clave();
    if (amount != null) init.body = JSON.stringify({ amount });
    const r = await pedir(`/v1/payments/${PAGO}/refunds`, init);
    const ok = r.code === 201;
    hechos.push({ etiqueta, amount, code: r.code, ok, refund: r.b?.id ?? null });
    console.log(
        `    ${etiqueta.padEnd(30)} amount ${String(amount ?? '(sin body)').padStart(10)} → HTTP ${r.code} ${ok ? `· refund ${r.b?.id} · ARS ${r.b?.amount}` : `· code ${r.b?.cause?.[0]?.code ?? '—'} · "${r.b?.message ?? ''}"`}`
    );
    return r;
};

// =============================================================================
console.log('\n######## PASO 1 — el experimento que DISTINGUE: ¿el piso es del monto o del resto?');
console.log('   `amount: 5` sobre un pago de 5.000. Deja un resto de 4.895.');
console.log('   Si entra: no hay piso absoluto y la bisección sobraba.');
console.log('   Si no entra: hay piso, y recién ahí se bisecta.\n');
const paso1 = await reembolsar('1 · amount 5 sobre 5000', 5);
const hayPiso = paso1.code !== 201;
console.log(
    hayPiso
        ? '\n  → HAY PISO ABSOLUTO: el mismo 5 que fallaba sobre un pago de 15 falla sobre uno de 5.000.'
        : '\n  → NO HAY PISO ABSOLUTO. Lo que fallaba en los pagos de ARS 15 era otra cosa (el RESTO).'
);

if (process.env.SOLO === '1') {
    console.log('\n(SOLO=1: se corta acá)');
    const d = await leer();
    console.log(`  estado final: ${d.status}/${d.detalle} · devuelto ${d.devuelto} · queda ${d.total - d.devuelto}`);
    process.exit(0);
}

// =============================================================================
if (hayPiso) {
    console.log('\n######## PASO 2 — bisección del piso, entre 5 (falla) y 50 (entra)');
    console.log('   Cada paso que ENTRA mueve plata; el tope por intento es 50.\n');
    let lo = 5; // falla
    let hi = 50; // entra (medido el 2026-09-15 sobre otro pago)
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const r = await reembolsar(`2 · bisección amount ${mid}`, mid);
        if (r.code === 201) hi = mid;
        else lo = mid;
    }
    console.log(`\n  → EL MÍNIMO ESTÁ ENTRE ${lo} (rechaza) y ${hi} (acepta): el mínimo exacto es ARS ${hi}.`);
} else {
    console.log('\n######## PASO 2 — no corresponde: sin piso absoluto no hay nada que bisectar');
}

// =============================================================================
console.log('\n######## PASO 3 — idempotencia del reembolso: la MISMA clave dos veces');
console.log('   Es la pregunta que no se puede hacer sobre un pago sin saldo:');
console.log('   ahí los dos intentos mueren en la validación de estado.\n');
const k = clave();
const m = hayPiso ? TOPE_POR_INTENTO : 5;
const i1 = await reembolsar('3 · primera con clave K', m, { key: k });
const i2 = await reembolsar('3 · segunda con la MISMA K', m, { key: k });
if (i1.code === 201 && i2.code === 201) {
    console.log(
        i1.b?.id === i2.b?.id
            ? `\n  → IDEMPOTENTE: las dos devuelven el MISMO refund (${i1.b?.id}). Se reembolsó UNA vez.`
            : `\n  → NO ES IDEMPOTENTE: dos refunds distintos (${i1.b?.id} y ${i2.b?.id}). Se reembolsó DOS veces.`
    );
} else {
    console.log('\n  → uno de los dos no entró: ver los códigos de arriba antes de concluir.');
}

// =============================================================================
console.log('\n######## PASO 4 — RF-4: ¿se puede reembolsar SIN el header?');
console.log('   `RF-1` se ejecutó sin él y dio 201; la sonda 18 lo midió obligatorio.\n');
await reembolsar('4 · sin X-Idempotency-Key', hayPiso ? TOPE_POR_INTENTO : 5, { sinHeader: true });

// --- relectura y cuenta final ------------------------------------------------
console.log('\n######## RELECTURA — qué quedó, y cuánto se movió');
const despues = await leer();
console.log(`  ${despues.status}/${despues.detalle} · devuelto ${despues.devuelto} · queda ${despues.total - despues.devuelto}`);
console.log(`  movido en esta tanda: ARS ${despues.devuelto - antes.devuelto}`);
const rf = await pedir(`/v1/payments/${PAGO}/refunds`);
console.log(`  reembolsos del pago: ${Array.isArray(rf.b) ? rf.b.length : '?'}`);
for (const r of Array.isArray(rf.b) ? rf.b : []) {
    console.log(`    ${r.id} · ARS ${r.amount} · ${r.status} · ${(r.date_created ?? '').slice(0, 19)}`);
}
console.log('\n  intentos de esta corrida:');
for (const h of hechos) console.log(`    ${h.ok ? '✓' : '·'} ${h.etiqueta.padEnd(30)} ${String(h.amount).padStart(10)} → ${h.code}`);

console.log('\n############ fin');
