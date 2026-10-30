// =============================================================================
// SONDA 24 — ¿Por qué no se puede reembolsar parcialmente un pago de ARS 15?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// Programa: HOS-1352. Es la última pieza de `RF-2`.
//
// TRES HIPÓTESIS MUERTAS, Y POR QUÉ ESTA ES LA QUE QUEDA
// ------------------------------------------------------
// El rechazo original —`{"amount": 5}` sobre dos pagos de ARS 15, con
// `400 "This transaction does not support to be refunded"`— se explicó mal dos
// veces, y las dos veces lo mató un experimento:
//
//   1. "Hay un monto mínimo de reembolso, entre 5 y 50."
//      MUERTA: la sonda 22 reembolsó ARS 5 sobre un pago de 5.000.
//   2. "El mínimo es del RESTO: 5 sobre 15 dejaba 10, y 10 es poco."
//      MUERTA: la sonda 23 reembolsó 4.875 dejando exactamente 10, y después
//      bajó el saldo a 5 y a 0 en parciales, todos aceptados.
//   3. "Es el tipo de transacción: un cobro recurrente no admite parciales."
//      MUERTA desde la sesión anterior: el mismo rechazo ocurrió sobre un
//      `regular_payment`.
//
// Lo que tienen en común los DOS casos que fallaron, y ninguno de los cinco que
// entraron: **el pago valía ARS 15, que es exactamente el mínimo de
// transacción del proveedor** (medido en `PC-2` para el monto de una
// suscripción: `"Cannot pay an amount lower than $ 15.00"`).
//
// Hipótesis: **sobre un pago que vale el mínimo, el parcial no existe** —
// cualquier parcial produciría un movimiento por debajo del mínimo, del lado
// del reembolso o del que queda. El total sí funciona: `RF-1` reembolsó
// entero un pago de ARS 15.
//
// CÓMO SE PRUEBA, Y CUÁNTO CUESTA
// -------------------------------
// Sobre `168329109416` — ARS 15, `regular_payment`, del propio owner, con su
// saldo entero, y **el mismo pago sobre el que falló el 5** en la sesión
// anterior. Dos intentos: `amount: 5` (reproduce) y `amount: 14` (el parcial
// más grande posible, que deja 1).
//
// **Si la hipótesis es cierta, los dos se rechazan y no se mueve un peso.** Si
// alguno entra, se mueve como mucho ARS 14 a la tarjeta del propio owner, y la
// hipótesis se cae — que también es un resultado.
//
// NO reembolsa el total: dejar el pago intacto permite volver a correr esto.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p24.mjs && node /tmp/p24.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR_ESPERADO = 5860436;
const PAGO = process.env.PAGO ?? '168329109416';
const TOPE = 14; // ningún intento de esta sonda pide más

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
const clave = () => `hos1352-p24-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}`);
    process.exit(1);
}
console.log(`############ SONDA 24 — el pago de quince pesos · ${new Date().toISOString()}`);

const p = await pedir(`/v1/payments/${PAGO}`);
const b = p.b ?? {};
const total = Number(b.transaction_amount);
const devuelto = Number(b.transaction_amount_refunded ?? 0);
console.log(`\n######## el sujeto: ${PAGO}`);
console.log(`  ${b.description} · ${b.status}/${b.status_detail} · ${b.operation_type}`);
console.log(`  ARS ${total} · devuelto ${devuelto} · QUEDA ${total - devuelto}`);
console.log(`  pagador: ${b.payer?.id} (${b.payer?.email})`);

if (Number(b.payer?.id) !== PAGADOR_ESPERADO) {
    console.error(`✗ ABORTA: el pagador no es el owner.`);
    process.exit(1);
}
if (b.status !== 'approved' || total - devuelto <= 0) {
    console.error(`✗ ABORTA: el pago no tiene saldo reembolsable (${b.status}, queda ${total - devuelto}).`);
    process.exit(1);
}
// `AMOUNT=n` prueba un solo monto y sale. Sirve para seguir acotando sin
// repetir los intentos ya hechos —repetirlos con el saldo consumido mediría
// otra cosa— y para probar el MISMO monto sobre un pago de otro total, que es
// lo que distingue si la variable es el monto o el total.
const SOLO_UNO = process["env"].AMOUNT;

if (!SOLO_UNO && total > 15) {
    console.error(`✗ ABORTA: este sujeto vale ${total}, no 15. La hipótesis es sobre un pago AL MÍNIMO.`);
    console.error('  (con AMOUNT=n se puede correr un intento suelto sobre cualquier pago propio)');
    process.exit(1);
}

// `amount === null` manda el reembolso SIN body, que es la forma del total.
// Sobre un pago parcialmente reembolsado el total pide lo que queda, así que
// es el mismo dinero que un parcial por ese monto: la única diferencia es si
// se nombra la cifra. Si uno entra y el otro no, el rechazo no es por el
// dinero.
const intentar = async (etiqueta, amount) => {
    if (amount != null && amount > TOPE) {
        console.error(`✗ ${etiqueta}: ${amount} supera el tope ${TOPE}`);
        return null;
    }
    const r = await pedir(`/v1/payments/${PAGO}/refunds`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': clave() },
        ...(amount == null ? {} : { body: JSON.stringify({ amount }) })
    });
    const ok = r.code === 201;
    console.log(
        `  ${etiqueta.padEnd(30)} amount ${String(amount ?? "(sin body)").padStart(3)} → HTTP ${r.code} ${
            ok ? `· refund ${r.b?.id}` : `· code ${r.b?.cause?.[0]?.code ?? '—'} · "${r.b?.message ?? ''}"`
        }`
    );
    return { r, ok };
};

if (SOLO_UNO) {
    const n = SOLO_UNO === 'sinbody' ? null : Number(SOLO_UNO);
    console.log(`\n######## un solo intento, por AMOUNT=${SOLO_UNO}\n`);
    const u = await intentar(n == null ? 'total (sin body)' : `amount ${n}`, n);
    const d = await pedir(`/v1/payments/${PAGO}`);
    console.log(
        `\n  RELECTURA: ${d.b?.status}/${d.b?.status_detail} · devuelto ${d.b?.transaction_amount_refunded ?? 0} de ${total}`
    );
    console.log(
        u?.ok
            ? '\n  → ENTRÓ. Sumalo a la tabla de RF-2 antes de concluir nada.'
            : `\n  → RECHAZÓ con code ${u?.r.b?.cause?.[0]?.code ?? '—'}.`
    );
    process.exit(0);
}

console.log('\n######## los dos parciales posibles sobre un pago al mínimo\n');
const a = await intentar('a · el 5 que ya había fallado', 5);
const c = await intentar('b · el parcial más grande (deja 1)', 14);

const despues = await pedir(`/v1/payments/${PAGO}`);
console.log(
    `\n######## RELECTURA: ${despues.b?.status}/${despues.b?.status_detail} · devuelto ${despues.b?.transaction_amount_refunded ?? 0}`
);

console.log('\n######## veredicto');
if (!a?.ok && !c?.ok) {
    console.log('  → SOBRE UN PAGO QUE VALE EL MÍNIMO, EL PARCIAL NO EXISTE.');
    console.log('    Ni el más chico ni el más grande entran. La única salida es el reembolso TOTAL,');
    console.log('    que sí funciona (RF-1). Y no se movió un peso: los dos intentos fueron rechazados.');
    console.log(`    código del rechazo: ${a?.r.b?.cause?.[0]?.code ?? '—'} · "${a?.r.b?.message ?? ''}"`);
    console.log('    ⚠ El mensaje NO nombra el motivo: se lee como "este pago no se puede reembolsar",');
    console.log('      cuando el pago SÍ se puede reembolsar entero. Es una propiedad del PEDIDO.');
} else {
    console.log('  → LA HIPÓTESIS SE CAE: al menos un parcial entró sobre un pago de ARS 15.');
    console.log('    Hay que buscar otra explicación para el rechazo original.');
}
console.log('\n############ fin');
