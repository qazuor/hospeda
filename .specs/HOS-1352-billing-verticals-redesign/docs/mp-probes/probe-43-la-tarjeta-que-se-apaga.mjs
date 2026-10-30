// =============================================================================
// SONDA 43 — La tarjeta que se apaga
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// ⚠️ CORRE CONTRA PRODUCCIÓN, CON LA TARJETA REAL DEL OWNER Y PLATA REAL.
//
// Programa: HOS-1352. Apunta a `RN-2`, `RN-3`, `GR-1..3` y `EX-33`.
//
// POR QUÉ EXISTE
// --------------
// Falta decidir qué hace Hospeda cuando a un cliente no le pasa la tarjeta:
// cuántos días lo dejamos publicado, cuándo lo suspendemos, qué avisos salen.
// No se puede decidir sin ver cómo se porta el proveedor, porque **nuestra
// política de grace se apoya ENCIMA de la suya**: si él reintenta cuatro días y
// nosotros suspendemos a los tres, suspendemos a alguien que iba a pagar bien.
//
// Y UN COBRO FALLIDO NO SE PUEDE FABRICAR. Medido el 2026-09-16 (sonda 42): el
// proveedor valida la tarjeta **cobrando ARS 0** (`operation_type:
// card_validation`) tanto al crear la suscripción como al cambiarle el medio de
// pago. Los seis cardholders de rechazo dan `400 CC_VAL_433` en el alta y `402`
// en el cambio, cada uno con su `status_detail` propio. Ni `CONT` se cuela: en
// una validación de tarjeta **no existe el estado pendiente**, o aprueba o
// rechaza. El proveedor no permite que una suscripción quede asociada a una
// tarjeta que no aprueba, en ningún momento de su vida.
//
// Queda un solo camino: que la tarjeta apruebe al asociarse y **se degrade
// después**. Idea del owner, 2026-09-16: pausar su propia tarjeta desde el home
// banking una vez que la suscripción está viva. Es mejor que lo que la sonda 29
// había descartado —subir el monto hasta que el límite lo rechace—, porque eso
// era apostar a que el banco rechace, y si el intento entraba **cobraba esa
// cifra**. Acá no hay apuesta: la tarjeta está apagada.
//
// LOS DOS SUJETOS
// ---------------
//   apagon   ARS 15 · ciclo diario, sin `start_date`. Cobra al autorizar. El
//            owner apaga la tarjeta esa noche, y el intento del día siguiente
//            es el cobro fallido: `RN-2`. Lo que pase después da `GR-1..3`
//            (¿reintenta? ¿cuántas veces? ¿en qué estado la deja?) y, cuando la
//            despause, `RN-3` (¿recupera sola?).
//
//   ex33     ARS 15 · ciclo diario, `start_date` a +3 días. **No mide el cobro
//            fallido: mide `EX-33`**, que es la fila `UNKNOWN` más urgente que
//            hay. `EX-8` verificó que una fecha futura se respeta sobre una
//            suscripción autorizada POR API con `card_token_id`; nadie probó el
//            camino del checkout, **donde quien autoriza es otro**. Si el
//            checkout resetea la fecha, `DEC-SUB-006` y `DEC-SUB-007` hacen que
//            el cliente que cambia de ciclo **pague dos veces**. Lo contesta una
//            sola cosa: si cobra hoy, la resetea.
//
// EL PRESUPUESTO ES UN NÚMERO, NO UN ORDEN DE MAGNITUD
// ----------------------------------------------------
// Mismo guard que la sonda 29: **aborta si el máximo a cobrar hoy no da
// exactamente `PRESUPUESTO_AUTORIZADO`**.
//
//   apagon   ARS 15 · cobra hoy, seguro
//   ex33     ARS 15 · cobra hoy SÓLO si el checkout resetea la fecha — que es
//                     justamente lo que se está midiendo, así que se presupuesta
//                     el peor caso
//   ──────────────────
//   MÁXIMO HOY  ARS 30
//
// Después de hoy: si el apagón funciona, `apagon` no vuelve a cobrar. `ex33`
// cobra ARS 15/día a partir del tercer día. Todo se reembolsa **total** al
// terminar (`RF-1`); lo único que no vuelve es la comisión, ~8%.
//
// LA TARJETA NO PASA POR EL CHAT NI POR ESTA SONDA
// ------------------------------------------------
// No tokeniza y no ve la tarjeta. Crea los preapprovals en `pending` y devuelve
// sus `init_point`; el owner los autoriza en el navegador, como un cliente
// cualquiera. Es además lo que hace válido el experimento de `EX-33`: quien
// autoriza tiene que ser el comprador, no la API.
//
// EL MANIFIESTO NO ES OPCIONAL
// ----------------------------
// `RC-1`: el `search` **ignora `external_reference`**. Si se pierden los ids no
// hay forma de volver a encontrar los sujetos, y se pierde el experimento. Por
// eso se escriben en el contenedor **y** se imprimen para copiarlos al repo.
// `/tmp` del contenedor NO sobrevive a un redeploy.
//
//   crear:     hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p43.mjs && node /tmp/p43.mjs'
//   leer:      … && LEER=1 node /tmp/p43.mjs
//   cancelar:  … && CANCELAR=1 node /tmp/p43.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';
const BACK_URL = 'https://hospeda.com.ar/';
const MANIFIESTO = '/tmp/hos1352-tarjeta-apagada.json';
const MONTO = 15;
const PRESUPUESTO_AUTORIZADO = 30;

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

// --- guard de cuenta --------------------------------------------------------
// Un error acá cobra plata de verdad, y la respuesta del proveedor no avisa:
// `EX-14` midió que `live_mode: true` llega igual desde la cuenta de pruebas.
const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id ?? '(no se pudo leer)'}, esperaba ${CUENTA_ESPERADA}`);
    process.exit(1);
}
console.log(`############ SONDA 43 — la tarjeta que se apaga · ${new Date().toISOString()}`);
console.log(`############ cuenta ${yo.b.nickname} (${yo.b.id}) · pagador ${PAGADOR}`);

const RESUMEN = (s) => ({
    status: s.status,
    next_payment_date: s.next_payment_date,
    start_date: s.auto_recurring?.start_date,
    monto: s.auto_recurring?.transaction_amount,
    ciclo: `${s.auto_recurring?.frequency} ${s.auto_recurring?.frequency_type}`,
    card_id: s.card_id,
    payment_method_id: s.payment_method_id,
    last_modified: s.last_modified,
    cobros: s.summarized?.charged_quantity,
    cobrado_total: s.summarized?.charged_amount,
    intentos_pendientes: s.summarized?.pending_charge_quantity,
    monto_pendiente: s.summarized?.pending_charge_amount
});

const leerManifiesto = () => {
    try {
        return JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
    } catch {
        console.error(`✗ no hay manifiesto en ${MANIFIESTO}. ¿Se redeployó el contenedor?`);
        console.error('  Los ids están en el repo: docs/mp-probes/manifiesto-tarjeta-apagada-*.json');
        process.exit(1);
    }
};

// ------------------------------------------------------------------ leer ----
if (process.env.LEER === '1') {
    const m = leerManifiesto();
    for (const { slug, id } of m.sujetos) {
        const s = await pedir(`/preapproval/${id}`);
        console.log(`\n=== ${slug}  ${id}`);
        console.log('   ', JSON.stringify(RESUMEN(s.b)));
        const ap = await pedir(`/authorized_payments/search?preapproval_id=${id}`);
        for (const p of ap.b?.results ?? []) {
            console.log('    pago:', JSON.stringify({
                id: p.id,
                monto: p.transaction_amount,
                fecha: p.debit_date ?? p.date_created,
                estado: p.status,
                intentos: p.retry_attempts,
                pago_id: p.payment?.id,
                pago_status: p.payment?.status,
                // el motivo del rechazo vive ACÁ y no en el preapproval: la
                // sonda 42 midió que el endpoint devuelve "Unknown error"
                detalle: p.payment?.status_detail
            }));
        }
        if ((ap.b?.results ?? []).length === 0) console.log('    (sin pagos autorizados todavía)');
    }
    console.log('\n############ FIN');
    process.exit(0);
}

// -------------------------------------------------------------- cancelar ----
if (process.env.CANCELAR === '1') {
    const m = leerManifiesto();
    for (const { slug, id } of m.sujetos) {
        const r = await pedir(`/preapproval/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'cancelled' })
        });
        await new Promise((res) => setTimeout(res, 1000));
        const s = await pedir(`/preapproval/${id}`);
        // El 2xx no prueba nada (§0): decide la relectura.
        console.log(`  ${slug} → HTTP ${r.code} · relectura: ${s.b?.status}`);
    }
    console.log('\n############ FIN. Falta reembolsar lo cobrado (RF-1: total funciona sobre ARS 15).');
    process.exit(0);
}

// ----------------------------------------------------------------- crear ----
const FUTURO = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().replace('Z', '-00:00');

const SUJETOS = [
    { slug: 'apagon', start: null, razon: 'Hospeda HOS-1352 prueba tarjeta', cobraHoy: MONTO },
    { slug: 'ex33', start: FUTURO, razon: 'Hospeda HOS-1352 prueba fecha', cobraHoy: MONTO }
];

const maximoHoy = SUJETOS.reduce((a, s) => a + s.cobraHoy, 0);
if (maximoHoy !== PRESUPUESTO_AUTORIZADO) {
    console.error(`✗ ABORTA: el máximo a cobrar hoy da ARS ${maximoHoy} y lo autorizado es ARS ${PRESUPUESTO_AUTORIZADO}.`);
    process.exit(1);
}
console.log(`############ máximo a cobrar hoy: ARS ${maximoHoy} — coincide con lo autorizado`);

const sello = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
const creados = [];

for (const { slug, start, razon } of SUJETOS) {
    const body = {
        reason: razon,
        payer_email: PAGADOR,
        back_url: BACK_URL,
        external_reference: `HOS-1352-apagon-${sello}-${slug}`,
        status: 'pending',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'days',
            transaction_amount: MONTO,
            currency_id: 'ARS',
            ...(start ? { start_date: start } : {})
        }
    };
    const r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(body) });
    if (!r.b?.id) {
        console.error(`\n✗ ${slug} NO se creó · HTTP ${r.code} ·`, JSON.stringify(r.b));
        continue;
    }
    creados.push({ slug, id: r.b.id });
    console.log(`\n✅ ${slug} · id ${r.b.id}`);
    console.log(`   start_date pedido: ${start ?? '(ninguno)'}`);
    console.log(`   relectura del alta: ${JSON.stringify(RESUMEN(r.b))}`);
    console.log(`   AUTORIZAR ACÁ → ${r.b.init_point}`);
}

if (creados.length > 0) {
    const m = {
        creado: new Date().toISOString(),
        entorno: 'produccion',
        cuenta: `${yo.b.nickname} (${yo.b.id})`,
        pagador: PAGADOR,
        monto_por_ciclo: MONTO,
        ciclo: '1 days',
        presupuestoAutorizado: PRESUPUESTO_AUTORIZADO,
        nota: 'RC-1: el search IGNORA external_reference. Sin estos ids no hay forma de reencontrar los sujetos.',
        sujetos: creados
    };
    writeFileSync(MANIFIESTO, JSON.stringify(m, null, 2));
    console.log(`\n############ manifiesto → ${MANIFIESTO}`);
    console.log('############ COPIAR ESTO AL REPO (el /tmp del contenedor no sobrevive un redeploy):');
    console.log(JSON.stringify(m));
}

console.log(`
############ AHORA LE TOCA AL OWNER
  1. Abrir los dos init_point y autorizarlos con la tarjeta real.
  2. Avisar: 'ex33' contesta EN EL ACTO — si cobró hoy, el checkout resetea la
     fecha y hay que revisar DEC-SUB-006 y DEC-SUB-007.
  3. Esa noche, apagar la tarjeta en el home banking.
  4. Al día siguiente leer: el intento de 'apagon' es el cobro fallido.
`);
