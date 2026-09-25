/**
 * Sonda 03 — El cobro a demanda: ¿se puede ejercer server-side, sin navegador?
 *
 * HOS-1352 · FASE 1C · evaluación de Mobbex. NO es código productivo.
 *
 * ES LA SONDA QUE DECIDE. Todo el interés en Mobbex viene de que documenta
 * `POST /p/subscriptions/{id}/subscriber/{sid}/execution` con monto libre — el
 * cobro que Mercado Pago nos niega con un 403 y un portón comercial (EX-31).
 * Lo que falta saber es si se puede llegar hasta ahí SIN que el cliente pase por
 * una página del proveedor.
 *
 * Qué contesta, en orden de dependencia:
 *   1. Ejecutar sobre un suscriptor SIN tarjeta: ¿qué error da? Si dice "falta
 *      medio de pago", el camino existe y sólo falta la tarjeta.
 *   2. ¿Se puede TOKENIZAR una tarjeta server-side (`POST /p/sources/token`)?
 *      La doc dice que exige habilitación por mail y PCI DSS — hay que medir si
 *      eso rige también en sandbox, porque de ahí depende todo lo demás.
 *   3. Si se puede: asociar la tarjeta al suscriptor y EJECUTAR EL COBRO.
 *   4. Y entonces: ejecutar con MONTO LIBRE, distinto al de la suscripción.
 *
 * Método: cada paso relee antes de concluir, y ningún resultado se lee del
 * status HTTP — en este proveedor un 200 puede traer `result:false` (sonda 01).
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.mobbex.com';
const CREDS = {
    'x-api-key': 'zJ8LFTBX6Ba8D611e9io13fDZAwj0QmKO1Hn1yIj',
    'x-access-token': 'd31f0721-2f85-44e7-bcc6-15e19d1a53cc',
    'content-type': 'application/json'
};

// Sujetos creados por la sonda 02, manifiesto hos1352-1789701214886.
const SUSCRIPCION = 'BUKMU1DXUSY2J8CHTC'; // dynamic, 1m, total 150, test:true
const SUSCRIPTOR = 'ZWOF5HCVGB12J5BGC0'; // sin medio de pago cargado

// Tarjeta de prueba del proveedor, publicada en
// https://mobbex.dev/medios-de-pago-para-pruebas (leída 2026-09-17).
// El CVV decide el resultado: 200 aprueba · 400 deniega · 002 deja pendiente.
const TARJETA = { number: '4507990000000010', holder: 'demo', expiry: '12/34', doc: '12123123' };

const SELLO = `hos1352-c-${Date.now()}`;
const bitacora = [];

const llamar = async (metodo, ruta, body) => {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: CREDS,
        body: body ? JSON.stringify(body) : undefined
    });
    const texto = await res.text();
    let json = null;
    try {
        json = JSON.parse(texto);
    } catch {
        /* cuerpo no-JSON: queda crudo en `texto` */
    }
    const r = { metodo, ruta, status: res.status, ok: json?.result === true, json, texto: texto.slice(0, 500) };
    bitacora.push({ ...r, json: undefined });
    return r;
};

const mostrar = (titulo, r) => {
    console.log(`\n── ${titulo}`);
    console.log(`   ${r.metodo} ${r.ruta}`);
    console.log(`   status ${r.status} · result ${r.json?.result}`);
    console.log(`   ${r.texto}`);
};

const main = async () => {
    console.log('SONDA 03 — el cobro a demanda');
    console.log(`fecha: ${new Date().toISOString()}`);
    console.log(`sujeto: suscripción ${SUSCRIPCION} · suscriptor ${SUSCRIPTOR}`);

    // ── 0 · Estado de partida del suscriptor. Sin esto no hay delta que comparar.
    const antes = await llamar('GET', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}`);
    mostrar('0 · estado ANTES', antes);

    // ── 1 · Ejecutar sin tarjeta. No se espera un cobro: se mide QUÉ contesta.
    const sinTarjeta = await llamar('POST', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/execution`, {
        total: 175,
        reference: `${SELLO}-sin-tarjeta`,
        description: 'cobro a demanda sin medio de pago'
    });
    mostrar('1 · POST execution SIN tarjeta cargada', sinTarjeta);

    // También la forma GET, que la doc describe como "ejecutar manualmente".
    const sinTarjetaGet = await llamar('GET', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/execution`);
    mostrar('1b · GET execution SIN tarjeta cargada', sinTarjetaGet);

    // ── 2 · ¿Se puede tokenizar server-side? Es la bisagra de toda la sonda.
    //        Se prueban las dos formas que aparecen en la documentación.
    const formas = [
        {
            etq: '2a · POST /p/sources/token — forma "card"',
            ruta: '/p/sources/token',
            body: {
                card: {
                    number: TARJETA.number,
                    holder: { name: TARJETA.holder, identification: TARJETA.doc },
                    expiration: { month: 12, year: 34 },
                    code: '200'
                }
            }
        },
        {
            etq: '2b · POST /p/sources/token — forma plana',
            ruta: '/p/sources/token',
            body: {
                number: TARJETA.number,
                name: TARJETA.holder,
                expirationMonth: 12,
                expirationYear: 34,
                securityCode: '200',
                identification: TARJETA.doc
            }
        }
    ];

    let token = null;
    for (const f of formas) {
        const r = await llamar('POST', f.ruta, f.body);
        mostrar(f.etq, r);
        const t = r.json?.data?.token ?? r.json?.data?.id ?? r.json?.token;
        if (t) {
            token = t;
            console.log(`   → TOKEN OBTENIDO: ${t}`);
            break;
        }
    }

    // ── 3 · Si hay token, asociarlo al suscriptor y RELEER.
    if (token) {
        const asociar = await llamar('POST', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/source`, {
            token,
            securityCode: '200'
        });
        mostrar('3 · POST source — asociar la tarjeta', asociar);

        const despues = await llamar('GET', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}`);
        mostrar('3b · RELECTURA del suscriptor', despues);

        // ── 4 · EL COBRO. Primero el monto estándar, después el libre.
        const cobro = await llamar('POST', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/execution`, {
            reference: `${SELLO}-cobro-estandar`,
            description: 'cobro a demanda, monto de la suscripcion'
        });
        mostrar('4 · POST execution — monto estándar (150)', cobro);

        const cobroLibre = await llamar('POST', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/execution`, {
            total: 987.65,
            reference: `${SELLO}-cobro-libre`,
            description: 'cobro a demanda, monto LIBRE'
        });
        mostrar('4b · POST execution — MONTO LIBRE (987.65)', cobroLibre);

        // ── 5 · Relectura de las ejecuciones: el cobro se verifica leyéndolo,
        //        no creyéndole a la respuesta del POST.
        const ejecuciones = await llamar('GET', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/execution`);
        mostrar('5 · RELECTURA de ejecuciones', ejecuciones);
    } else {
        console.log('\n── 3/4/5 · NO SE CORREN: sin token no hay tarjeta que cobrar.');
        console.log('   Eso NO prueba que el cobro a demanda no exista: prueba que la');
        console.log('   TOKENIZACIÓN server-side no está disponible con estas credenciales.');
        console.log('   El paso siguiente sería cargar la tarjeta por la sourceUrl (navegador)');
        console.log('   y recién entonces volver a ejecutar.');
    }

    writeFileSync(new URL(`./bitacora-${SELLO}.json`, import.meta.url), JSON.stringify({ sello: SELLO, fecha: new Date().toISOString(), bitacora }, null, 2));
    console.log(`\n── bitácora escrita · ${bitacora.length} llamadas`);
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
