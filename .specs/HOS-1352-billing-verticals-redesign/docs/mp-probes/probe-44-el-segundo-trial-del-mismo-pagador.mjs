// =============================================================================
// SONDA 44 — El segundo trial del mismo pagador
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// ⚠️ CORRE CONTRA PRODUCCIÓN, CON LA TARJETA REAL DEL OWNER Y PLATA REAL.
//    Autorizado por el owner el 2026-09-16: ARS 15, un sujeto.
//
// Programa: HOS-1352. Es la condición de `DEC-SUB-006` y `DEC-SUB-007`.
//
// LO QUE ACABA DE PASAR, Y POR QUÉ ABRE ESTA PREGUNTA
// ---------------------------------------------------
// La sonda 43 midió `EX-33` y salió bien: el checkout **respeta** una fecha de
// primer cobro futura. `ex33` quedó `authorized` con `next_payment_date` tres
// días adelante y **cero cobros**. Hasta ahí, `DEC-SUB-006` en pie.
//
// Pero al releer el objeto apareció algo que nadie mandó:
//
//     auto_recurring.free_trial: {frequency: 3, first_invoice_offset: 3,
//                                 frequency_type: "days"}
//     first_invoice_offset: 3
//
// El request **no llevaba `free_trial`**: llevaba `start_date` a +3 días y nada
// más. **El proveedor convirtió la fecha en un free trial por su cuenta**, y así
// se lo mostró al comprador: *«Tu prueba gratis comenzó»*. No tiene el concepto
// «empezá a cobrar el día N»; lo traduce a «prueba gratis de N días».
//
// Consecuencia: **compensar días ya pagados corriendo la fecha ES pedirle un
// trial al proveedor**, aunque el payload no lo nombre en ninguna parte.
//
// QUÉ MIDE ESTA SONDA
// -------------------
// Si ese trial se otorga **una sola vez por pagador**, entonces la compensación
// de `DEC-SUB-006`/`DEC-SUB-007` funciona la primera vez y **falla en silencio
// la segunda**: el cliente que cambia de ciclo por segunda vez no recibiría la
// fecha diferida y **cobraría en el acto, encima de lo que ya pagó**. Que es
// exactamente el doble cobro que esas decisiones existen para evitar.
//
// No es una sospecha suelta. `EX-29` ya midió, sobre PLANES y en sandbox, que
// dos altas idénticas del mismo pagador salen distintas —una con `free_trial` y
// otra con `null`—, reproducido tres veces en frío con el patrón `✅ ✅ ❌`. Esta
// sonda pregunta lo mismo **sin plan y en producción**, que es el caso que nos
// toca.
//
// LO QUE LO CONTESTA, Y ES UNA SOLA COSA
// --------------------------------------
//   respeta la fecha  → `next_payment_date` a +2 días, `charged_quantity` nulo.
//                       La compensación se sostiene en la segunda vuelta.
//   la resetea        → cobra ARS 15 EN EL ACTO. `DEC-SUB-006` y `DEC-SUB-007`
//                       se reabren, porque su mecanismo no es repetible.
//
// Se usa **+2 días** a propósito, no +3: así la fecha por sí sola distingue este
// sujeto de `ex33` y no hay forma de confundir cuál contestó qué.
//
// EL `init_point` SE SANEA ANTES DE ENTREGARLO
// --------------------------------------------
// Medido el 2026-09-16: el `init_point` que devuelve el proveedor trae
// `&activation=true` y esa URL abre **«Esta página no existe»** desde el
// 2026-09-04 — bug abierto del proveedor, sin respuesta oficial
// (mercadopago/sdk-nodejs#480). La misma URL sin el parámetro abre el checkout
// normal. Es el caso más caro de «el 2xx no prueba nada»: la API responde `201`
// y entrega una URL rota, sin error de nuestro lado.
//
//   crear:  hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p44.mjs && node /tmp/p44.mjs'
//   leer:   … && LEER=1 node /tmp/p44.mjs
//   cancelar: … && CANCELAR=1 node /tmp/p44.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';
const BACK_URL = 'https://hospeda.com.ar/';
const MANIFIESTO = '/tmp/hos1352-segundo-trial.json';
const MONTO = 15;
const PRESUPUESTO_AUTORIZADO = 15;

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

// El workaround del bug abierto del proveedor. No se entrega nunca la URL cruda.
const sanear = (u) => (u ?? '').replace(/[?&]activation=true/, '');

const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id ?? '(no se pudo leer)'}, esperaba ${CUENTA_ESPERADA}`);
    process.exit(1);
}
console.log(`############ SONDA 44 — el segundo trial del mismo pagador · ${new Date().toISOString()}`);
console.log(`############ cuenta ${yo.b.nickname} (${yo.b.id}) · pagador ${PAGADOR}`);

const RESUMEN = (s) => ({
    status: s.status,
    next_payment_date: s.next_payment_date,
    start_date: s.auto_recurring?.start_date,
    // el campo que destapó todo: NO se manda, y aparece igual
    free_trial: s.auto_recurring?.free_trial,
    first_invoice_offset: s.first_invoice_offset,
    monto: s.auto_recurring?.transaction_amount,
    cobros: s.summarized?.charged_quantity,
    cobrado_total: s.summarized?.charged_amount,
    last_modified: s.last_modified
});

const leerManifiesto = () => {
    try {
        return JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
    } catch {
        console.error(`✗ no hay manifiesto en ${MANIFIESTO}. ¿Se redeployó el contenedor?`);
        console.error('  Los ids están en el repo: docs/mp-probes/manifiesto-segundo-trial-*.json');
        process.exit(1);
    }
};

if (process.env.LEER === '1') {
    const m = leerManifiesto();
    for (const { slug, id } of m.sujetos) {
        const s = await pedir(`/preapproval/${id}`);
        console.log(`\n=== ${slug}  ${id}`);
        console.log('   ', JSON.stringify(RESUMEN(s.b)));
        const ap = await pedir(`/authorized_payments/search?preapproval_id=${id}`);
        for (const p of ap.b?.results ?? []) {
            console.log(
                '    pago:',
                JSON.stringify({
                    monto: p.transaction_amount,
                    fecha: p.debit_date ?? p.date_created,
                    estado: p.status,
                    pago_status: p.payment?.status,
                    detalle: p.payment?.status_detail
                })
            );
        }
        if ((ap.b?.results ?? []).length === 0) console.log('    (sin pagos autorizados: la fecha se respetó)');
    }
    console.log('\n############ FIN');
    process.exit(0);
}

if (process.env.CANCELAR === '1') {
    const m = leerManifiesto();
    for (const { slug, id } of m.sujetos) {
        const r = await pedir(`/preapproval/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
        await new Promise((res) => setTimeout(res, 1000));
        const s = await pedir(`/preapproval/${id}`);
        console.log(`  ${slug} → HTTP ${r.code} · relectura: ${s.b?.status}`);
    }
    process.exit(0);
}

// ----------------------------------------------------------------- crear ----
if (MONTO !== PRESUPUESTO_AUTORIZADO) {
    console.error(`✗ ABORTA: el máximo a cobrar da ARS ${MONTO} y lo autorizado es ARS ${PRESUPUESTO_AUTORIZADO}.`);
    process.exit(1);
}
console.log(`############ máximo a cobrar: ARS ${MONTO} — coincide con lo autorizado`);
console.log('############ si la fecha se respeta, no cobra NADA hoy');

const FUTURO = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().replace('Z', '-00:00');
const sello = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
const slug = 'segundo-trial';

const r = await pedir('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
        reason: 'Hospeda HOS-1352 prueba fecha 2',
        payer_email: PAGADOR,
        back_url: BACK_URL,
        external_reference: `HOS-1352-segundo-trial-${sello}`,
        status: 'pending',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'days',
            transaction_amount: MONTO,
            currency_id: 'ARS',
            start_date: FUTURO
        }
    })
});

if (!r.b?.id) {
    console.error(`\n✗ NO se creó · HTTP ${r.code} ·`, JSON.stringify(r.b));
    process.exit(1);
}

console.log(`\n✅ ${slug} · id ${r.b.id}`);
console.log(`   start_date pedido:  ${FUTURO}`);
console.log(`   relectura del alta: ${JSON.stringify(RESUMEN(r.b))}`);
console.log(`   AUTORIZAR ACÁ → ${sanear(r.b.init_point)}`);

const m = {
    creado: new Date().toISOString(),
    entorno: 'produccion',
    cuenta: `${yo.b.nickname} (${yo.b.id})`,
    pagador: PAGADOR,
    monto_por_ciclo: MONTO,
    presupuestoAutorizado: PRESUPUESTO_AUTORIZADO,
    mide: 'si el proveedor otorga un segundo free_trial derivado de start_date al MISMO pagador',
    nota: 'RC-1: el search IGNORA external_reference. Sin este id no hay forma de reencontrarlo.',
    sujetos: [{ slug, id: r.b.id }]
};
writeFileSync(MANIFIESTO, JSON.stringify(m, null, 2));
console.log(`\n############ manifiesto → ${MANIFIESTO}`);
console.log('############ COPIAR AL REPO:');
console.log(JSON.stringify(m));

console.log(`
############ LO QUE CONTESTA, APENAS LO AUTORICES
  respeta la fecha → cero cobros, next_payment_date a +2 días. DEC-SUB-006 y
                     DEC-SUB-007 se sostienen: el mecanismo es repetible.
  la resetea       → cobra ARS 15 en el acto, y las dos decisiones se reabren.
`);
