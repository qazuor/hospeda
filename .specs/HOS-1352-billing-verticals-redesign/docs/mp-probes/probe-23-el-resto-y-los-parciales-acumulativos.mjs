// =============================================================================
// SONDA 23 — ¿La regla es sobre el MONTO o sobre el RESTO?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. Cierra `RF-2` y, de paso, los parciales acumulativos.
//
// AUTORIZADO POR EL OWNER el 2026-09-15: reembolsar ARS 4.875 sobre el pago
// `174625958196`, dejando un resto de 10. El pagador es él mismo
// (`qazuor@gmail.com`), así que la plata va de su saldo de Mercado Pago a su
// propia tarjeta; la comisión ya estaba pagada y no vuelve en ningún escenario,
// así que el costo adicional de este experimento es cero.
//
// QUÉ PREGUNTA, Y POR QUÉ ES LA ÚNICA QUE QUEDABA
// -----------------------------------------------
// La sesión anterior concluyó que había un "monto mínimo de reembolso" porque
// `{"amount": 5}` se rechazaba. La sonda 22 lo desmintió: **ARS 5 entró** sobre
// un pago de 5.000. O sea que no hay piso del MONTO, y lo que fallaba en los
// pagos de ARS 15 era otra cosa.
//
// De todos los datos que hay, una sola hipótesis los explica a todos:
//
//   | reembolso | pago  | resto | resultado |
//   |-----------|-------|-------|-----------|
//   | 5         | 15    | 10    | FALLA     |
//   | 5         | 15    | 10    | FALLA     |
//   | 50        | 100   | 50    | entra     |
//   | 100       | 5.000 | 4.900 | entra     |
//   | 5         | 5.000 | 4.895 | entra     |
//
// **Todos los que fallan dejan un resto de 10; todos los que entran dejan 50 o
// más.** Si la regla es sobre el resto —y el umbral es plausiblemente el mismo
// piso de ARS 15 que `PC-2` midió para el monto de una suscripción— entonces
// reembolsar 4.875 sobre un saldo de 4.885 tiene que FALLAR, porque deja 10.
//
// Y si entra, la hipótesis se cae y hay que buscar otra explicación para los
// pagos de ARS 15. Las dos salidas son informativas; por eso se corre.
//
// LO QUE VIENE DESPUÉS, GRATIS
// ----------------------------
// Si el reembolso grande entra, el pago queda con ARS 10 de saldo, y ahí se
// puede medir sin costo lo que hasta ahora necesitaba autorización: los
// **parciales acumulativos**. Dos parciales de 5 completan el total, y eso
// responde si el proveedor valida contra el SALDO o contra el MONTO ORIGINAL, y
// si al completarse el pago pasa de `partially_refunded` a `refunded`.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p23.mjs && node /tmp/p23.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR_ESPERADO = 5860436; // qazuor@gmail.com
const PAGO = '174625958196';
const AUTORIZADO = 4875; // el monto exacto que autorizó el owner

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
const clave = () => `hos1352-p23-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const leer = async () => {
    const p = await pedir(`/v1/payments/${PAGO}`);
    return {
        status: p.b?.status,
        detalle: p.b?.status_detail,
        total: Number(p.b?.transaction_amount),
        devuelto: Number(p.b?.transaction_amount_refunded ?? 0),
        pagador: p.b?.payer?.id
    };
};

const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}`);
    process.exit(1);
}
console.log(`############ SONDA 23 — el resto · ${new Date().toISOString()}`);

let e = await leer();
console.log(`\n######## el sujeto: ${PAGO}`);
console.log(`  ${e.status}/${e.detalle} · total ${e.total} · devuelto ${e.devuelto} · QUEDA ${e.total - e.devuelto}`);
if (Number(e.pagador) !== PAGADOR_ESPERADO) {
    console.error(`✗ ABORTA: el pagador es ${e.pagador}, no el owner.`);
    process.exit(1);
}
// El monto autorizado se comprueba contra el saldo REAL del momento: si el
// saldo cambió desde que el owner autorizó, este reembolso ya no deja el resto
// que él aprobó, y entonces no es el experimento que autorizó.
const queda = e.total - e.devuelto;
const restoEsperado = queda - AUTORIZADO;
console.log(`  autorizado: ${AUTORIZADO} → dejaría un resto de ${restoEsperado}`);
if (restoEsperado < 0 || restoEsperado > 15) {
    console.error(`✗ ABORTA: con el saldo actual, ${AUTORIZADO} dejaría un resto de ${restoEsperado}.`);
    console.error('  El experimento autorizado dejaba un resto de 10. Hay que volver a preguntar.');
    process.exit(1);
}

const intentar = async (etiqueta, amount) => {
    const r = await pedir(`/v1/payments/${PAGO}/refunds`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': clave() },
        body: JSON.stringify({ amount })
    });
    const ok = r.code === 201;
    console.log(
        `  ${etiqueta.padEnd(34)} amount ${String(amount).padStart(6)} → HTTP ${r.code} ${
            ok
                ? `· refund ${r.b?.id} · ARS ${r.b?.amount}`
                : `· code ${r.b?.cause?.[0]?.code ?? '—'} · "${r.b?.message ?? ''}"`
        }`
    );
    const d = await leer();
    console.log(
        `  ${''.padEnd(34)} relectura: ${d.status}/${d.detalle} · devuelto ${d.devuelto} · queda ${d.total - d.devuelto}`
    );
    return { r, ok, d };
};

// =============================================================================
console.log(`\n######## PASO 1 — reembolsar ${AUTORIZADO}, dejando un resto de ${restoEsperado}`);
console.log('   Si la regla es sobre el RESTO, esto falla aunque el monto sea enorme.');
console.log('   Si entra, la hipótesis del resto se cae y hay que buscar otra.\n');
const p1 = await intentar('1 · deja un resto chico', AUTORIZADO);

if (!p1.ok) {
    console.log('\n  → LA REGLA ES SOBRE EL RESTO.');
    console.log(`     Un reembolso de ${AUTORIZADO} —muchísimo más que los 50 que ya entraron— se rechaza`);
    console.log(`     sólo porque dejaría ${restoEsperado}. El mensaje del proveedor NO nombra el resto.`);
    console.log(`     code: ${p1.r.b?.cause?.[0]?.code ?? '—'} · "${p1.r.b?.message ?? ''}"`);
    console.log('\n  Queda por acotar el umbral exacto del resto, y eso ya se puede hacer barato');
    console.log('  sobre este mismo pago, sin dejarlo en cero.');
    process.exit(0);
}

console.log('\n  → LA HIPÓTESIS DEL RESTO SE CAE: entró dejando un resto de ' + restoEsperado + '.');
console.log('     Entonces lo que fallaba en los pagos de ARS 15 no era el resto.');

// =============================================================================
e = await leer();
const saldo = e.total - e.devuelto;
console.log(`\n######## PASO 2 — parciales acumulativos, con ${saldo} de saldo`);
console.log('   Ahora sale gratis lo que antes necesitaba autorización: ¿el proveedor');
console.log('   valida contra el SALDO o contra el MONTO ORIGINAL? ¿Y qué pasa al completarlo?\n');

// (a) pedir más de lo que queda pero menos que el total original
const deMas = saldo + 5;
console.log(`  (a) pedir ${deMas}: más que el saldo (${saldo}), muchísimo menos que el total (${e.total})`);
const pa = await intentar('2a · más que el saldo', deMas);
console.log(
    pa.ok
        ? '      → VALIDA CONTRA EL TOTAL, no contra el saldo: aceptó de más.'
        : '      → VALIDA CONTRA EL SALDO. Es lo que un reconciliador necesita.'
);

// (b) completar el total en parciales
const e2 = await leer();
const saldo2 = e2.total - e2.devuelto;
if (saldo2 > 0) {
    console.log(`\n  (b) completar el total: quedan ${saldo2}, se van en dos parciales`);
    const mitad = Math.floor(saldo2 / 2);
    if (mitad >= 1) await intentar('2b · primer parcial', mitad);
    const e3 = await leer();
    const resto3 = e3.total - e3.devuelto;
    if (resto3 > 0) {
        const pb = await intentar('2b · parcial que completa el total', resto3);
        if (pb.ok) {
            console.log(
                `      → al completarse, el pago quedó: ${pb.d.status}/${pb.d.detalle}` +
                    (pb.d.detalle === 'refunded' || pb.d.status === 'refunded'
                        ? '  (pasa a refunded solo)'
                        : '  ⚠ NO pasó a refunded pese a estar devuelto entero')
            );
        }
    }
}

const fin = await leer();
console.log(`\n######## estado final: ${fin.status}/${fin.detalle} · devuelto ${fin.devuelto} de ${fin.total}`);
const rf = await pedir(`/v1/payments/${PAGO}/refunds`);
console.log(`  reembolsos del pago: ${Array.isArray(rf.b) ? rf.b.length : '?'}`);
console.log('\n############ fin');
