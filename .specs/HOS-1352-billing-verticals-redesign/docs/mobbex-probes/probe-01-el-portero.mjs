/**
 * Sonda 01 — El portero: ¿las credenciales entran, y el endpoint distingue?
 *
 * HOS-1352 · FASE 1C · evaluación de Mobbex como alternativa a Mercado Pago.
 * NO es código productivo. No se importa desde ningún lado.
 *
 * Qué contesta:
 *   1. ¿Las credenciales públicas de sandbox funcionan contra api.mobbex.com?
 *   2. EL CONTROL QUE DISTINGUE: ¿el endpoint rechaza una llamada sin credenciales?
 *      Sin esto, un 200 no prueba que la autenticación haya sido evaluada.
 *   3. ¿Qué devuelve el listado de suscripciones de una cuenta virgen?
 *
 * Por qué el control importa acá y no es paranoia: con Mercado Pago la sonda 07
 * casi registra un NOT_SUPPORTED inexistente porque un 429 se leyó como
 * prohibición. Un resultado sin control no distingue "lo evaluó y lo rechazó"
 * de "no llegó a evaluarlo".
 */

const API = 'https://api.mobbex.com';

// Credenciales de prueba PÚBLICAS, publicadas por el proveedor en
// https://mobbex.dev/primeros-pasos (leídas el 2026-09-17). No son secretas:
// son las que el proveedor entrega para que cualquiera pruebe sin registrarse.
const CREDS = {
    'x-api-key': 'zJ8LFTBX6Ba8D611e9io13fDZAwj0QmKO1Hn1yIj',
    'x-access-token': 'd31f0721-2f85-44e7-bcc6-15e19d1a53cc',
    'content-type': 'application/json'
};

/**
 * Una llamada, con su respuesta cruda. Nunca se concluye del status solo.
 */
const llamar = async (metodo, ruta, { headers = CREDS, body } = {}) => {
    const t0 = Date.now();
    try {
        const res = await fetch(`${API}${ruta}`, {
            method: metodo,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const texto = await res.text();
        let json;
        try {
            json = JSON.parse(texto);
        } catch {
            json = null;
        }
        return { status: res.status, json, texto: texto.slice(0, 600), ms: Date.now() - t0 };
    } catch (e) {
        return { status: 0, error: String(e), ms: Date.now() - t0 };
    }
};

const mostrar = (titulo, r) => {
    console.log(`\n── ${titulo}`);
    console.log(`   status: ${r.status}  (${r.ms} ms)`);
    if (r.error) {
        console.log(`   ERROR DE RED: ${r.error}`);
        return;
    }
    console.log(`   cuerpo: ${r.texto}`);
};

const main = async () => {
    console.log('SONDA 01 — el portero de Mobbex');
    console.log(`fecha: ${new Date().toISOString()}`);
    console.log(`base:  ${API}`);

    // 1 · Lectura con credenciales. Si esto falla, no hay sonda que valga.
    const conCreds = await llamar('GET', '/p/subscriptions');
    mostrar('1 · GET /p/subscriptions CON credenciales', conCreds);

    // 2 · EL CONTROL: la misma ruta sin credenciales.
    //     Si esto también diera 200, el 200 de arriba no probaría nada.
    const sinCreds = await llamar('GET', '/p/subscriptions', {
        headers: { 'content-type': 'application/json' }
    });
    mostrar('2 · CONTROL — la misma ruta SIN credenciales', sinCreds);

    // 3 · SEGUNDO CONTROL: credenciales con la api-key alterada.
    //     Distingue "no mandé headers" de "mandé headers inválidos".
    const credsMalas = await llamar('GET', '/p/subscriptions', {
        headers: { ...CREDS, 'x-api-key': 'esto-no-es-una-api-key-valida' }
    });
    mostrar('3 · CONTROL — con una api-key inválida', credsMalas);

    // 4 · ¿Quién somos? Si existe un endpoint de entidad, dice contra qué cuenta
    //     estamos operando. Con MP esto fue crítico: live_mode NO distinguía el
    //     entorno (EX-14) y lo único que separaba sandbox de producción era
    //     GET /users/me. Hay que saber si Mobbex tiene un equivalente.
    for (const ruta of ['/p/entity', '/p/entity/validate', '/p/account']) {
        const r = await llamar('GET', ruta);
        mostrar(`4 · GET ${ruta}`, r);
    }

    console.log('\n── VEREDICTO');
    const auth = conCreds.status === 200;
    const rechazaSin = sinCreds.status !== 200;
    const rechazaMalas = credsMalas.status !== 200;
    console.log(`   credenciales válidas entran: ${auth ? 'SÍ' : 'NO'}`);
    console.log(`   sin credenciales rechaza:    ${rechazaSin ? 'SÍ' : 'NO'}`);
    console.log(`   credenciales malas rechaza:  ${rechazaMalas ? 'SÍ' : 'NO'}`);
    if (auth && rechazaSin && rechazaMalas) {
        console.log('   → el portero funciona y distingue. Las sondas siguientes son legibles.');
    } else if (auth && !rechazaSin) {
        console.log('   → ATENCIÓN: el endpoint responde igual con y sin credenciales.');
        console.log('     Ningún resultado de autenticación de esta API es concluyente todavía.');
    } else {
        console.log('   → NO se puede seguir: revisar credenciales o base URL antes de nada.');
    }
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
