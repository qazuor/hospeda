// =============================================================================
// SONDA 18 — Qué forma tiene el error cuando un reembolso NO se puede hacer
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. Alimenta el CONTRATO DE ERRORES del reconciliador y
// completa lo que `RF-1`/`RF-2` dejaron abierto.
//
// LA PREGUNTA
// -----------
// Los reembolsos ya están medidos por el lado feliz: total y parcial, en los
// dos tipos de pago. Lo que no está medido es el lado que el reconciliador va
// a ver todos los días: qué contesta el proveedor cuando el reembolso NO
// corresponde. Y eso importa porque ya hay UN mensaje suyo que miente por
// omisión —"This transaction does not support to be refunded" para un monto
// por debajo del mínimo, sin nombrar el monto— y ese mensaje ya empujó una
// hipótesis equivocada durante la medición de `RF-2`. Si el mismo texto
// aparece también para un pago ya reembolsado, entonces ese texto NO alcanza
// para decidir qué hacer, y el reconciliador tiene que mirar el pago, no el
// mensaje.
//
// POR QUÉ ESTA SONDA NO MUEVE PLATA
// ---------------------------------
// Corre sobre UN pago que ya está reembolsado por completo: lo que queda por
// reembolsar es CERO, así que ningún intento puede sacar dinero de ningún
// lado. Y no se confía en que eso sea así: es lo primero que verifica, y si
// el pago tuviera saldo reembolsable el script ABORTA sin intentar nada.
//
// El caso hermano —pedir MÁS de lo que queda sobre un pago PARCIALMENTE
// reembolsado— NO está acá a propósito: si el proveedor validara contra el
// monto total en vez de contra el saldo, ese intento movería plata de verdad.
// Necesita autorización del owner por monto exacto, como toda la familia.
//
// DÓNDE CORRE, Y POR QUÉ NO ACÁ
// -----------------------------
// La credencial de producción vive en el entorno del contenedor de la API en
// el VPS. Esta sonda corre ADENTRO de ese contenedor justamente para que el
// secreto no salga de ahí: no se copia a la máquina de nadie, no pasa por un
// archivo local y no aparece en ningún historial.
//
//   base64 -w0 probe-18-errores-de-reembolso.mjs   # y en el VPS:
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p18.mjs && node /tmp/p18.mjs'
//
// GUARD DE CUENTA
// ---------------
// Antes de tocar nada le pregunta al proveedor de quién es el token y exige
// que sea la cuenta real de Hospeda. Una sonda que reembolsa no puede
// depender de que quien la corra haya cargado el entorno correcto.
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165; // HOSPEDA_COM_AR
const PAGO = process.env.PAGO_REEMBOLSADO ?? '168470636028';

if (!TOKEN) {
    console.error('✗ falta HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN en el entorno');
    process.exit(1);
}

const pedir = async (ruta, init = {}) => {
    const r = await fetch(`${API}${ruta}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {})
        }
    });
    const texto = await r.text();
    let cuerpo;
    try {
        cuerpo = JSON.parse(texto);
    } catch {
        cuerpo = texto.slice(0, 300);
    }
    return { code: r.status, cuerpo };
};

console.log(`############ SONDA 18 — errores de reembolso · ${new Date().toISOString()}`);

// --- guard de cuenta ---------------------------------------------------------
const yo = await pedir('/users/me');
console.log(
    `\n######## de quién es el token: ${yo.cuerpo?.nickname} (id ${yo.cuerpo?.id}) · tags ${JSON.stringify(yo.cuerpo?.tags)}`
);
if (yo.cuerpo?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: se esperaba la cuenta ${CUENTA_ESPERADA} y es ${yo.cuerpo?.id}`);
    process.exit(1);
}

// --- guard de saldo: esto es lo que hace que la sonda sea gratis -------------
const antes = await pedir(`/v1/payments/${PAGO}`);
const total = antes.cuerpo?.transaction_amount;
const devuelto = antes.cuerpo?.transaction_amount_refunded;
const queda = Number(total) - Number(devuelto);
console.log(`\n######## el sujeto: pago ${PAGO}`);
console.log(
    `  status: ${antes.cuerpo?.status} · status_detail: ${antes.cuerpo?.status_detail} · operation_type: ${antes.cuerpo?.operation_type}`
);
console.log(`  monto: ${total} · ya devuelto: ${devuelto} · QUEDA POR DEVOLVER: ${queda}`);
if (!(queda === 0)) {
    console.error(`✗ ABORTA: queda ${queda} por reembolsar. Esta sonda sólo corre sobre saldo CERO.`);
    process.exit(1);
}

const refundsAntes = await pedir(`/v1/payments/${PAGO}/refunds`);
const nAntes = Array.isArray(refundsAntes.cuerpo) ? refundsAntes.cuerpo.length : '?';
console.log(`  reembolsos ya existentes: ${nAntes}`);

// --- los intentos ------------------------------------------------------------
// La primera corrida no llegó a medir nada de lo que venía a medir: los tres
// intentos murieron en `400 "Header X-Idempotency-Key can't be null"`, o sea
// ANTES de cualquier validación de negocio. Eso es un hallazgo por sí solo —el
// header es OBLIGATORIO en `/refunds`, a diferencia de `/preapproval`, donde
// la sonda 14 midió que se acepta y no hace nada— y es también la trampa del
// §0 en su otra dirección: un error no prueba que la operación esté prohibida,
// prueba que no llegó a evaluarse.
//
// Cada intento lleva su propia clave: una clave repetida mediría otra cosa
// (la idempotencia del reembolso), y esa necesita un pago CON saldo y la
// autorización del owner, porque ahí sí puede mover plata.
const intentar = async (etiqueta, body, porQue) => {
    const init = {
        method: 'POST',
        headers: { 'X-Idempotency-Key': `hos1352-p18-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
    };
    if (body !== null) init.body = JSON.stringify(body);
    const r = await pedir(`/v1/payments/${PAGO}/refunds`, init);
    console.log(`\n=== ${etiqueta}`);
    console.log(`    por qué: ${porQue}`);
    console.log(`    request: ${body === null ? '(sin body)' : JSON.stringify(body)}`);
    console.log(`    HTTP ${r.code}`);
    console.log(`    respuesta: ${JSON.stringify(r.cuerpo).slice(0, 600)}`);
    return r;
};

console.log('\n######## intentos sobre un pago SIN saldo reembolsable');
const a = await intentar('A · total sin body', null, 'la forma exacta que SÍ funcionó en RF-1, repetida');
const b = await intentar(
    'B · parcial por encima de lo que queda',
    { amount: 5000 },
    'pide 5000 sobre un saldo de 0 — el caso del reconciliador que reintenta con un monto viejo'
);
const c = await intentar(
    'C · parcial por el total original',
    { amount: total },
    'pide exactamente el monto del pago, que ya está devuelto entero'
);

// --- relectura: el 2xx no prueba nada, y el 4xx tampoco ---------------------
// Un error no prueba que no haya pasado nada. Se relee el pago y se cuentan
// los reembolsos: si alguno de los intentos hubiera entrado, se ve acá.
console.log('\n######## RELECTURA — ¿el pago quedó igual?');
const despues = await pedir(`/v1/payments/${PAGO}`);
const refundsDespues = await pedir(`/v1/payments/${PAGO}/refunds`);
const nDespues = Array.isArray(refundsDespues.cuerpo) ? refundsDespues.cuerpo.length : '?';
console.log(
    `  status: ${despues.cuerpo?.status} · devuelto: ${despues.cuerpo?.transaction_amount_refunded} · reembolsos: ${nDespues}`
);
console.log(
    nAntes === nDespues && devuelto === despues.cuerpo?.transaction_amount_refunded
        ? '  ✓ sin cambios: ningún intento entró'
        : '  ⚠ ALGO CAMBIÓ — leer el detalle de arriba'
);

// --- veredicto ---------------------------------------------------------------
console.log('\n######## veredicto — ¿los tres errores se distinguen entre sí?');
for (const [et, r] of [
    ['A', a],
    ['B', b],
    ['C', c]
]) {
    console.log(`  ${et}: HTTP ${r.code} · message="${r.cuerpo?.message ?? ''}" · error="${r.cuerpo?.error ?? ''}"`);
}
console.log(
    '\n  Si los tres traen el MISMO texto, el mensaje no alcanza para decidir y el'
);
console.log('  reconciliador tiene que releer el pago antes de interpretar el error.');
