// =============================================================================
// SONDA 31 — El contrato de errores del lado de las LECTURAS
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// ES DE SÓLO LECTURA: no crea, no muta, no cancela y no reembolsa.
//
// Programa: HOS-1352. Completa el contrato de errores que hasta ahora estaba
// medido **sólo del lado de las escrituras** (`RF-5`, `RF-8`, `EX-20` y la
// tabla de trece rechazos de la sonda 28).
//
// POR QUÉ IMPORTA MÁS DE LO QUE PARECE
// ------------------------------------
// Un reconciliador vive leyendo. Y las lecturas fallan de formas que no se
// parecen a las escrituras: un id que no existe, un id que existe pero es de
// otra cuenta, un id con el formato equivocado. **Si esos tres casos devuelven
// lo mismo, el reconciliador no puede distinguir "esta suscripción se borró"
// de "me pasaron un id mal formado"** — y esas dos situaciones piden acciones
// opuestas.
//
// Hay un caso que importa especialmente: **un id de OTRA cuenta**. Si devuelve
// `404` igual que uno inexistente, no hay forma de detectar una mezcla de
// credenciales entre entornos; si devuelve `403`, sí. Y `EX-14` ya midió que
// el evento **no** permite distinguir sandbox de producción, así que esta es la
// otra mitad de esa pregunta.
//
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p31.mjs && node /tmp/p31.mjs'
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;

// Un preapproval REAL de la cuenta de PRUEBA (sandbox), del reloj de sandbox.
// Existe, pero pertenece a otra cuenta. Es el sujeto del caso más interesante.
const AJENO_PREAPPROVAL = '930a7596704f4d3ba3cd31a180b4bfcf';
// Un preapproval propio, vivo, para tener el control positivo.
const PROPIO_PREAPPROVAL = '6b293a9499d946f6ac159da7f8f4804e';
const PROPIO_PAGO = '178259523769';

const g = async (ruta) => {
    const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const t = await r.text();
    let b;
    try {
        b = JSON.parse(t);
    } catch {
        b = t === '' ? null : t.slice(0, 200);
    }
    return { code: r.status, b };
};

const yo = await g('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}`);
    process.exit(1);
}
console.log(`############ SONDA 31 — errores de lectura · ${new Date().toISOString()}`);

const casos = [
    ['CONTROL propio', `/preapproval/${PROPIO_PREAPPROVAL}`],
    ['id AJENO (existe en otra cuenta)', `/preapproval/${AJENO_PREAPPROVAL}`],
    ['id inexistente, formato válido', '/preapproval/00000000000000000000000000000000'],
    ['id con formato inválido', '/preapproval/no-soy-un-id'],
    ['id vacío', '/preapproval/'],
    ['', ''],
    ['CONTROL pago propio', `/v1/payments/${PROPIO_PAGO}`],
    ['pago inexistente', '/v1/payments/1'],
    ['pago con formato inválido', '/v1/payments/no-soy-un-pago'],
    ['', ''],
    ['authorized_payments sin filtro', '/authorized_payments/search'],
    ['authorized_payments con id inexistente', '/authorized_payments/search?preapproval_id=00000000000000000000000000000000'],
    ['authorized_payments con id AJENO', `/authorized_payments/search?preapproval_id=${AJENO_PREAPPROVAL}`],
    ['authorized_payment suelto inexistente', '/authorized_payments/1'],
    ['', ''],
    ['payments/search por xref real', '/v1/payments/search?external_reference=HOS-1352-relojprod-renov-ok'],
    ['payments/search por xref inventado', '/v1/payments/search?external_reference=HOS-1352-no-existe-jamas'],
    ['preapproval/search por xref real', '/preapproval/search?external_reference=HOS-1352-relojprod-renov-ok&limit=1'],
    ['', ''],
    ['refunds de un pago inexistente', '/v1/payments/1/refunds'],
    ['refunds de un pago propio', `/v1/payments/${PROPIO_PAGO}/refunds`]
];

for (const [etiqueta, ruta] of casos) {
    if (!etiqueta) {
        console.log('');
        continue;
    }
    const r = await g(ruta);
    const total = r.b?.paging?.total;
    const resumen =
        r.code === 200
            ? total != null
                ? `total ${total}`
                : Array.isArray(r.b)
                  ? `array de ${r.b.length}`
                  : `id ${r.b?.id ?? '—'} · status ${r.b?.status ?? '—'}`
            : `"${r.b?.message ?? r.b?.error ?? JSON.stringify(r.b).slice(0, 90)}"`;
    console.log(`  ${etiqueta.padEnd(40)} HTTP ${String(r.code).padEnd(3)} · ${resumen}`);
}

console.log('\n######## lo que hay que mirar');
console.log('  1. ¿El id AJENO se distingue del INEXISTENTE? Si los dos dan 404, una mezcla');
console.log('     de credenciales entre entornos es indetectable por esta vía.');
console.log('  2. ¿Un formato inválido se distingue de un id que no existe? Son dos bugs');
console.log('     distintos y piden acciones opuestas.');
console.log('  3. ¿Una búsqueda sin resultados se distingue de una búsqueda mal formada?');
console.log('\n############ fin — no se escribió nada');
