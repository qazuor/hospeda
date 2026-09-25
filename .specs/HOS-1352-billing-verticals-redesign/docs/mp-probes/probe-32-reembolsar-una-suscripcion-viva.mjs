// =============================================================================
// SONDA 32 — ¿Qué le pasa a una suscripción VIVA cuando se reembolsa su cobro?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352.
//
// LA PREGUNTA, Y POR QUÉ NO ESTÁ MEDIDA EN NINGÚN LADO
// ----------------------------------------------------
// Los reembolsos están medidos **sobre el pago**: total, parcial, acumulativo,
// idempotencia, códigos de error. Lo que nadie preguntó es qué le pasa a la
// **SUSCRIPCIÓN** de la que ese pago salió:
//
//   - ¿el proveedor la pausa o la cancela por su cuenta?
//   - ¿se corre `next_payment_date`? ¿baja `charged_quantity`?
//   - ¿emite algún webhook, y de qué tipo?
//   - ¿le manda un correo al cliente, y qué le dice?
//
// Es exactamente lo que va a pasar el día que un cliente pida la devolución de
// un mes y la suscripción siga corriendo. Si el proveedor la cancela por su
// cuenta, un reembolso de cortesía se convierte sin querer en una baja.
//
// POR QUÉ UN SUJETO NUEVO Y NO UNO DEL RELOJ
// ------------------------------------------
// Los cuatro sujetos que cobraron tienen cada uno su propia medición pendiente
// para mañana (`RN-1`, `UP-2`, `DW-1`, y el `end_date`). **Si el reembolso
// altera la suscripción, arruina esa medición y encima no se podría saber cuál
// de las dos causas la alteró.** Un sujeto propio cuesta ARS 15 y no contamina
// nada.
//
// DOS FASES, PORQUE EL COBRO TARDA
// --------------------------------
// `PA-3` midió que en producción el primer cobro llega **~26 minutos** después
// de autorizar. Así que:
//
//   FASE=crear      crea el sujeto y sale. Cuesta ARS 15.
//   FASE=reembolsar espera a que el cobro exista, lo reembolsa ENTERO, y
//                   compara la suscripción antes y después, campo por campo.
//
// El reembolso es **total** a propósito: el parcial ya está medido, y sobre un
// pago de ARS 15 el parcial además falla (`RF-8`).
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p32.mjs && FASE=crear node /tmp/p32.mjs'
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR_ESPERADO = 5860436;
const PAGADOR = 'qazuor@gmail.com';
const ESTADO = '/tmp/hos1352-sonda32.json';
const MONTO = 15;

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

const foto = async (id) => {
    const x = (await pedir(`/preapproval/${id}`)).b;
    const ap = await pedir(`/authorized_payments/search?preapproval_id=${id}&limit=10`);
    return {
        status: x?.status,
        monto: x?.auto_recurring?.transaction_amount,
        next: x?.next_payment_date,
        cobros: x?.summarized?.charged_quantity ?? null,
        end_date: x?.auto_recurring?.end_date ?? null,
        xref: x?.external_reference,
        authorized_payments: ap.b?.paging?.total ?? null,
        pagos: (ap.b?.results ?? []).map((a) => `${a.id}:${a.status}:${a.payment?.id}/${a.payment?.status}`)
    };
};

const FASE = process["env"].FASE ?? 'crear';
console.log(`############ SONDA 32 — fase "${FASE}" · ${new Date().toISOString()}`);

// =============================================================================
if (FASE === 'crear') {
    const tokens = readFileSync('/tmp/hos1352-tokens.txt', 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
    if (!tokens.length) {
        console.error('✗ no quedan tokens: corré la sonda 27');
        process.exit(1);
    }
    const cuerpo = {
        reason: 'HOS1352 reembolso sobre viva',
        payer_email: PAGADOR,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-reembolso-${Date.now()}`,
        auto_recurring: { frequency: 1, frequency_type: 'days', transaction_amount: MONTO, currency_id: 'ARS' },
        status: 'authorized'
    };
    let id = null;
    let r;
    while (tokens.length && !id) {
        cuerpo.card_token_id = tokens.shift();
        writeFileSync('/tmp/hos1352-tokens.txt', `${tokens.join('\n')}\n`, { mode: 0o600 });
        r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
        id = r.b?.id ?? null;
        if (!id && !/token was used/i.test(String(r.b?.message ?? ''))) break;
    }
    if (!id) {
        console.error(`✗ no se creó: ${JSON.stringify(r?.b).slice(0, 300)}`);
        process.exit(1);
    }
    writeFileSync(ESTADO, JSON.stringify({ id, creado: new Date().toISOString(), monto: MONTO }, null, 2));
    console.log(`  creado: ${id} · ARS ${MONTO} · ciclo diario`);
    console.log(`  RELECTURA: ${JSON.stringify(await foto(id))}`);
    console.log(`\n  El cobro llega en ~26 minutos (PA-3). Después: FASE=reembolsar`);
    process.exit(0);
}

// =============================================================================
const est = JSON.parse(readFileSync(ESTADO, 'utf8'));
const ID = est.id;
console.log(`sujeto: ${ID} (creado ${est.creado})`);

const antes = await foto(ID);
console.log(`\n######## ANTES del reembolso`);
console.log(`  ${JSON.stringify(antes, null, 2).replace(/\n/g, '\n  ')}`);

// el pago que se va a reembolsar: el cobro recurrente de esta suscripción
const pagos = await pedir(`/v1/payments/search?external_reference=${encodeURIComponent(antes.xref)}&limit=10`);
const cobro = (pagos.b?.results ?? []).find((p) => p.operation_type === 'recurring_payment' && p.status === 'approved');
if (!cobro) {
    console.error('\n✗ TODAVÍA NO COBRÓ. Esperá y volvé a correr esta fase.');
    console.error(`  pagos vistos: ${(pagos.b?.results ?? []).map((p) => `${p.id}:${p.operation_type}:${p.status}`).join(', ') || '(ninguno)'}`);
    process.exit(1);
}
console.log(`\n######## el cobro a reembolsar: ${cobro.id} · ARS ${cobro.transaction_amount} · ${cobro.date_approved}`);
// El guard va por EMAIL, no por id — y eso lo decidió una medición, no una
// preferencia. La primera versión comparaba `payer.id` contra `5860436` y
// ABORTÓ sobre un pago que SÍ era del owner: un cobro recurrente nacido de una
// suscripción creada por API llega con `payer.id: 1505978827`, mientras que los
// pagos sueltos de la misma tarjeta y el mismo mail llegan con `5860436`.
//
// O sea que **una misma persona tiene más de un `payer.id`**, y el id no sirve
// para identificarla. El mail sí: los cuatro pagos comparados dan
// `qazuor@gmail.com`.
const mail = String(cobro.payer?.email ?? '').toLowerCase();
if (mail !== PAGADOR.toLowerCase()) {
    console.error(`✗ ABORTA: el pagador es ${mail || '(sin mail)'} (id ${cobro.payer?.id}), no el owner.`);
    process.exit(1);
}
if (Number(cobro.payer?.id) !== PAGADOR_ESPERADO) {
    console.log(`  (nota: payer.id ${cobro.payer?.id} ≠ ${PAGADOR_ESPERADO}, mismo mail — el id no identifica a la persona)`);
}

const r = await pedir(`/v1/payments/${cobro.id}/refunds`, {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `hos1352-p32-${Date.now()}` }
});
console.log(`  REEMBOLSO TOTAL → HTTP ${r.code} ${r.code === 201 ? `· refund ${r.b?.id} · ARS ${r.b?.amount}` : `· "${r.b?.message ?? ''}"`}`);

const pagoDesp = await pedir(`/v1/payments/${cobro.id}`);
console.log(`  el pago quedó: ${pagoDesp.b?.status}/${pagoDesp.b?.status_detail} · devuelto ${pagoDesp.b?.transaction_amount_refunded}`);

// --- lo que importa: ¿qué le pasó a la SUSCRIPCIÓN? -------------------------
const despues = await foto(ID);
console.log(`\n######## DESPUÉS — la suscripción, campo por campo`);
for (const k of Object.keys(antes)) {
    const a = JSON.stringify(antes[k]);
    const d = JSON.stringify(despues[k]);
    console.log(`  ${k.padEnd(22)} ${a === d ? `= ${a}` : `${a}  →  ${d}   ⚠ CAMBIÓ`}`);
}

console.log('\n######## veredicto');
if (antes.status === despues.status) {
    console.log(`  → el proveedor NO tocó el estado: sigue "${despues.status}".`);
    console.log('     Un reembolso NO da de baja la suscripción por su cuenta.');
} else {
    console.log(`  → ⚠ EL PROVEEDOR CAMBIÓ EL ESTADO: "${antes.status}" → "${despues.status}".`);
    console.log('     Un reembolso de cortesía se convierte sin querer en una baja.');
}
console.log('\n  Falta mirar dos cosas que no se ven desde acá:');
console.log('   1. los logs de la API de producción, para ver si el reembolso emitió webhook');
console.log('      y de qué tipo (RF-7 midió que emite `payment`, pero no sobre una viva);');
console.log('   2. la casilla del owner, para ver qué le dice el proveedor al cliente.');
