/**
 * Sonda 02 — El alta: crear suscripción y suscriptor, y ver dónde aparece la tarjeta.
 *
 * HOS-1352 · FASE 1C · evaluación de Mobbex. NO es código productivo.
 *
 * Qué contesta:
 *   1. ¿Se puede crear una suscripción `dynamic` y una `manual`? ¿En qué difieren
 *      al leerlas de vuelta? (`manual` es la candidata a "el ciclo es nuestro").
 *   2. ¿El alta de suscriptor pide tarjeta, o devuelve una URL para que la cargue
 *      el cliente? Decide si el cobro a demanda se puede ejercer server-side.
 *   3. ¿La creación es IDEMPOTENTE? Se crean dos suscripciones con la MISMA
 *      `reference` y se compara. Con MP esto fue `EX-17`: diez sujetos, diez ids.
 *   4. CONTROL de aceptar-y-descartar: se manda un campo inventado y otro con
 *      valor inválido, y se relee. Es la regla §4.1 del capítulo 06 aplicada a
 *      este proveedor: el status no cierra ninguna mutación.
 *
 * Todo se crea con `test: true`. La cuenta demo es PÚBLICA y compartida: los
 * objetos de otros están ahí, así que nada se concluye de un listado global.
 * Cada objeto creado se escribe en el manifiesto.
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.mobbex.com';
const CREDS = {
    'x-api-key': 'zJ8LFTBX6Ba8D611e9io13fDZAwj0QmKO1Hn1yIj',
    'x-access-token': 'd31f0721-2f85-44e7-bcc6-15e19d1a53cc',
    'content-type': 'application/json'
};

const SELLO = `hos1352-${Date.now()}`;
const creados = [];

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
        /* se deja en null a propósito: el cuerpo crudo queda en `texto` */
    }
    // OJO: en este proveedor un 200 puede traer result:false (medido en la sonda 01,
    // GET /p/entity → 200 + "Acceso no autorizado"). El status NO alcanza.
    return { status: res.status, ok: json?.result === true, json, texto: texto.slice(0, 400) };
};

const base = (extra = {}) => ({
    total: 150,
    currency: 'ARS',
    name: 'HOS-1352 sonda',
    description: 'Evaluacion de proveedor',
    limit: 0,
    test: true,
    return_url: 'https://hospeda.com.ar',
    ...extra
});

const crearSuscripcion = async (etiqueta, cuerpo) => {
    const r = await llamar('POST', '/p/subscriptions/', cuerpo);
    const uid = r.json?.data?.uid;
    console.log(`\n── ${etiqueta}`);
    console.log(`   status ${r.status} · result ${r.json?.result}`);
    if (uid) {
        creados.push({ tipo: 'subscription', uid, etiqueta });
        console.log(`   uid: ${uid}`);
    } else {
        console.log(`   cuerpo: ${r.texto}`);
    }
    return { r, uid };
};

const main = async () => {
    console.log('SONDA 02 — el alta en Mobbex');
    console.log(`fecha: ${new Date().toISOString()}`);
    console.log(`sello: ${SELLO}`);

    // ── 1 · Los dos tipos de suscripción
    const din = await crearSuscripcion('1a · type=dynamic, interval=1m', base({ type: 'dynamic', interval: '1m', reference: `${SELLO}-din` }));
    const man = await crearSuscripcion('1b · type=manual (sin interval)', base({ type: 'manual', reference: `${SELLO}-man` }));

    // Relectura: qué quedó escrito de verdad en cada una.
    for (const [etq, uid] of [
        ['dynamic', din.uid],
        ['manual', man.uid]
    ]) {
        if (!uid) continue;
        const r = await llamar('GET', `/p/subscriptions/${uid}`);
        const d = r.json?.data ?? {};
        console.log(`\n   relectura ${etq}: type=${d.type} interval=${d.interval} variant=${d.variant} total=${d.total} test=${d.test} status=${d.status}`);
    }

    // ── 2 · IDEMPOTENCIA: la misma `reference`, dos veces.
    //        Con MP el header no hacía nada y salían dos objetos (EX-17).
    const refRepetida = `${SELLO}-idem`;
    const i1 = await crearSuscripcion('2a · reference repetida, primera', base({ type: 'dynamic', interval: '1m', reference: refRepetida }));
    const i2 = await crearSuscripcion('2b · reference repetida, SEGUNDA', base({ type: 'dynamic', interval: '1m', reference: refRepetida }));
    console.log('\n   IDEMPOTENCIA:');
    if (i1.uid && i2.uid) {
        console.log(`   ${i1.uid === i2.uid ? 'DEDUPLICA — mismo uid' : 'NO deduplica — dos uid distintos'}`);
    } else if (i1.uid && !i2.uid) {
        console.log(`   RECHAZA la segunda: ${i2.r.texto}`);
    }

    // ── 3 · CONTROL de aceptar-y-descartar (la regla §4.1 aplicada acá).
    //        Un campo inventado y uno inválido. Se RELEE, no se cree el status.
    const ctl = await crearSuscripcion(
        '3 · campo inventado + interval inválido',
        base({ type: 'dynamic', interval: '1m', reference: `${SELLO}-ctl`, campoQueNoExiste: 'hospeda', setupFee: 99 })
    );
    if (ctl.uid) {
        const r = await llamar('GET', `/p/subscriptions/${ctl.uid}`);
        const d = r.json?.data ?? {};
        console.log(`   relectura: setupFee=${d.setupFee} campoQueNoExiste=${d.campoQueNoExiste ?? '(ausente)'}`);
        console.log(`   → ${d.setupFee === 99 ? 'setupFee SÍ se aplicó' : 'setupFee NO se aplicó pese al 200'}`);
    }

    // ── 4 · El suscriptor: ¿pide tarjeta o devuelve una URL?
    if (din.uid) {
        const hoy = new Date();
        const sub = await llamar('POST', `/p/subscriptions/${din.uid}/subscriber`, {
            customer: {
                email: 'sonda-hos1352@hospeda.com.ar',
                name: 'Sonda HOS1352',
                identification: '12123123'
            },
            startDate: { day: hoy.getDate(), month: hoy.getMonth() + 1, year: hoy.getFullYear() },
            test: true,
            reference: `${SELLO}-sub1`
        });
        console.log('\n── 4 · POST subscriber');
        console.log(`   status ${sub.status} · result ${sub.json?.result}`);
        const d = sub.json?.data ?? {};
        console.log(`   claves devueltas: ${Object.keys(d).join(', ') || '(ninguna)'}`);
        if (d.sid) creados.push({ tipo: 'subscriber', uid: d.sid, de: din.uid });
        console.log(`   sourceUrl: ${d.sourceUrl ?? '(no vino)'}`);
        console.log(`   subscriberUrl: ${d.subscriberUrl ?? '(no vino)'}`);
        if (!sub.json?.result) console.log(`   cuerpo: ${sub.texto}`);

        // ── 5 · EL COBRO A DEMANDA sobre un suscriptor SIN tarjeta cargada.
        //        No se espera que cobre. Lo que se mide es QUÉ contesta: si dice
        //        "falta medio de pago" el camino existe y sólo falta la tarjeta;
        //        si dice otra cosa, el camino es distinto del que leímos.
        if (d.sid) {
            const ej = await llamar('POST', `/p/subscriptions/${din.uid}/subscriber/${d.sid}/execution`, {
                total: 175,
                reference: `${SELLO}-exec1`,
                description: 'cobro a demanda, sonda'
            });
            console.log('\n── 5 · POST execution (sin tarjeta cargada)');
            console.log(`   status ${ej.status} · result ${ej.json?.result}`);
            console.log(`   cuerpo: ${ej.texto}`);
        }
    }

    const manifiesto = { sello: SELLO, fecha: new Date().toISOString(), cuenta: 'CUENTA DEMO (publica)', creados };
    writeFileSync(new URL(`./manifiesto-${SELLO}.json`, import.meta.url), JSON.stringify(manifiesto, null, 2));
    console.log(`\n── manifiesto escrito · ${creados.length} objetos creados`);
    console.log(JSON.stringify(creados, null, 2));
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
