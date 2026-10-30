// =============================================================================
// SONDA 25 — UN preapproval en producción, para medir el radio de explosión
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352.
//
// POR QUÉ UNO SOLO
// ----------------
// Las filas `EX-17` (idempotencia de creación), `EX-18` (moneda), `EX-5`
// (varios montos), `PC-2` (rango), `FR-1..4` (ciclos) y `EX-7` (`start_date`)
// están medidas en SANDBOX, y el sandbox ya mintió una vez: `RF-1`/`RF-2`
// estuvieron en `UNKNOWN` por un `401` que sólo existía ahí. Re-medirlas en
// producción exige CREAR preapprovals en la cuenta real.
//
// Crear uno no le cobra a nadie —nace `pending` y nadie lo va a autorizar—
// pero **el webhook de la cuenta real apunta a la API de producción**, y los
// logs de hoy muestran que los eventos de suscripción sin fila local terminan
// en `500` con hasta 5 reintentos encolados.
//
// Así que el radio de explosión **se mide, no se supone**: esta sonda crea UNO,
// lo relee, lo cancela, y deja los timestamps exactos para ir a buscar en los
// logs de producción qué hizo la API con sus webhooks. Decidido así con el
// owner el 2026-09-15.
//
// EL PAGADOR
// ----------
// `qazuor@gmail.com`, la cuenta del propio owner, que es la que ya figura como
// pagador de todos los pagos de prueba de producción. Si el proveedor le manda
// un correo por la suscripción pendiente, le llega a él — y eso es, de paso, la
// única vía que quedaba viva para `EX-3`.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p25.mjs && node /tmp/p25.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';

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
const marca = () => new Date().toISOString();
console.log(`############ SONDA 25 — un preapproval en producción · ${marca()}`);
console.log(`cuenta: ${yo.b?.nickname} (${yo.b?.id})`);

const XREF = `HOS-1352-prod-probe-${Date.now()}`;
const cuerpo = {
    reason: 'HOS-1352 sonda de medición (no cobra)',
    payer_email: PAGADOR,
    back_url: 'https://www.hospeda.com.ar',
    external_reference: XREF,
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 100, currency_id: 'ARS' }
};

console.log(`\n######## CREAR · ${marca()}`);
console.log(`  external_reference: ${XREF}`);
const creado = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
console.log(`  HTTP ${creado.code} · id ${creado.b?.id ?? '—'} · status ${creado.b?.status ?? '—'}`);
if (!creado.b?.id) {
    console.error(`  error: ${JSON.stringify(creado.b).slice(0, 400)}`);
    process.exit(1);
}
const ID = creado.b.id;

// RELECTURA — el 2xx no prueba nada (§0)
const leido = await pedir(`/preapproval/${ID}`);
console.log(
    `  RELECTURA: status ${leido.b?.status} · ARS ${leido.b?.auto_recurring?.transaction_amount} · ${leido.b?.auto_recurring?.frequency} ${leido.b?.auto_recurring?.frequency_type} · xref ${leido.b?.external_reference}`
);
if (leido.b?.status !== 'pending') {
    console.error(`  ⚠ NO quedó pending sino "${leido.b?.status}" — cancelando YA`);
}

// esperar a que el proveedor entregue el webhook antes de cancelar, para que
// los dos eventos no se pisen en el log (la demora medida va de 0,6 s a 32 s)
console.log(`\n######## esperando 45 s para que el webhook de la CREACIÓN llegue solo · ${marca()}`);
await new Promise((r) => setTimeout(r, 45000));

console.log(`\n######## CANCELAR · ${marca()}`);
const cancelado = await pedir(`/preapproval/${ID}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' })
});
const final = await pedir(`/preapproval/${ID}`);
console.log(`  HTTP ${cancelado.code} · RELECTURA: ${final.b?.status}`);

console.log(`\n######## esperando 45 s para el webhook de la CANCELACIÓN · ${marca()}`);
await new Promise((r) => setTimeout(r, 45000));
console.log(`\n######## fin · ${marca()}`);
console.log(`  id: ${ID}`);
console.log(`  xref: ${XREF}`);
console.log('  Ahora hay que leer los logs de producción de esta ventana:');
console.log('    hops logs api --since 5m | grep -iE "webhook|preapproval|subscription"');
