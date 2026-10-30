/**
 * Sonda 05 — Preparar los sujetos de la batería.
 *
 * HOS-1352 · FASE 1C · Mobbex. NO es código productivo.
 *
 * Crea de una vez TODOS los sujetos que las sondas 06 y 07 necesitan, y
 * escribe el manifiesto. Después imprime la tabla de URLs para cargarles la
 * tarjeta — ese paso es manual, con navegador, porque la tokenización
 * server-side exige habilitación por mail y certificación PCI DSS (medido en
 * la sonda 04: cuatro cuerpos distintos, el mismo GENERIC:EFCS).
 *
 * POR QUÉ UN MANIFIESTO Y NO UNA BÚSQUEDA: con Mercado Pago, `RC-1` midió que
 * el buscador ignora `external_reference` en silencio. Si se pierden los ids,
 * se pierde el experimento. Acá el buscador parece filtrar bien, pero la
 * lección se respeta igual hasta medirla.
 *
 *   source ~/.config/hospeda/mobbex-creds.sh && node probe-05-preparar-sujetos.mjs
 */

import { writeFileSync } from 'node:fs';
import { Bitacora, CVV, TARJETAS, TITULAR, credenciales, hacerLlamador, mostrar, quienesSomos } from './_comun.mjs';

const SELLO = `hos1352-bat-${Date.now()}`;
const SINK = process.env.HOS1352_SINK ?? 'https://hos1352-webhook-sink.qazuor.workers.dev/';
const headers = credenciales();
const bitacora = new Bitacora(SELLO);
const llamar = hacerLlamador(headers, bitacora);

/**
 * Los seis sujetos, y qué contesta cada uno.
 *
 * `interval` sólo admite 7d, 15d, 1m, 2m, 3m, 6m, 1y — **el ciclo más corto es
 * de SIETE DÍAS**. Con Mercado Pago se usó ciclo diario para leer una
 * renovación en 24 h; acá eso no existe, así que toda medición de renovación
 * AUTOMÁTICA tarda una semana. El cobro a demanda no depende del ciclo: lo
 * disparamos nosotros, y es justamente lo que se viene a medir.
 */
const SUJETOS = [
    {
        slug: 'cobro-manual',
        tipo: 'manual',
        total: 150,
        tarjeta: TARJETAS.visaDebito,
        cvv: CVV.aprueba,
        contesta: 'el cobro a demanda: estándar, monto libre, y si es idempotente'
    },
    {
        slug: 'cobro-rechazado',
        tipo: 'manual',
        total: 150,
        tarjeta: TARJETAS.visaDebito,
        cvv: CVV.deniega,
        contesta: 'RN-2 y el grace: qué informa un cobro DENEGADO, y si se puede recuperar'
    },
    {
        slug: 'ciclo-de-vida',
        tipo: 'dynamic',
        interval: '7d',
        total: 200,
        tarjeta: TARJETAS.masterCredito,
        cvv: CVV.aprueba,
        contesta: 'pausar, reanudar, cambiar el monto, cancelar — y si la pausa se reanuda sola'
    },
    {
        slug: 'mudanza-origen',
        tipo: 'dynamic',
        interval: '7d',
        total: 200,
        tarjeta: TARJETAS.visaCredito,
        cvv: CVV.aprueba,
        contesta: 'action/move: lo que MP NO tiene (EX-21). Es la salida al cambio de ciclo'
    },
    {
        slug: 'mudanza-destino',
        tipo: 'dynamic',
        interval: '1m',
        total: 500,
        sinSuscriptor: true,
        contesta: 'el destino de la mudanza. Ciclo y monto distintos a propósito'
    },
    {
        slug: 'prepaga',
        tipo: 'manual',
        total: 150,
        tarjeta: TARJETAS.prepaga,
        cvv: CVV.aprueba,
        contesta: 'si una PREPAGA sostiene una recurrencia. Con Mercado Pago no se puede'
    }
];

const main = async () => {
    console.log('SONDA 05 — preparar los sujetos de la batería');
    console.log(`fecha: ${new Date().toISOString()}`);
    console.log(`sello: ${SELLO}`);

    const quien = await quienesSomos(headers);
    console.log(`cuenta: ${quien.nombre} (uid ${quien.uid})`);
    bitacora.anotar({ nota: 'entidad', ...quien, crudo: undefined });
    if (/DEMO/i.test(quien.nombre)) {
        console.log('\n⚠️  ESTA ES LA CUENTA DEMO PÚBLICA, que NO aprueba ningún pago');
        console.log('   (medido: 0 de 12 operaciones con código 200). La batería no sirve acá.');
        console.log('   Cargá las credenciales de la cuenta propia antes de seguir.\n');
        process.exit(2);
    }

    const hoy = new Date();
    const resultado = [];

    for (const s of SUJETOS) {
        console.log(`\n═══ ${s.slug} — ${s.contesta}`);

        const cuerpo = {
            total: s.total,
            currency: 'ARS',
            type: s.tipo,
            name: `HOS-1352 ${s.slug}`,
            description: `Evaluacion de proveedor · ${s.slug}`,
            limit: 0,
            test: true,
            return_url: 'https://hospeda.com.ar',
            reference: `${SELLO}-${s.slug}`,
            // El receptor de webhooks es el MISMO Worker que se usó con Mercado
            // Pago (`mp-probes/probe-08-webhook-sink`): guarda cada POST crudo
            // con TODOS los headers, sin interpretar nada. Sirve igual acá.
            // La query separa las fuentes para que un sink compartido no mezcle.
            webhook: `${SINK}?fuente=mobbex&sujeto=${s.slug}&sello=${SELLO}`
        };
        if (s.interval) cuerpo.interval = s.interval;

        const sus = await llamar('POST', '/p/subscriptions/', cuerpo);
        mostrar(`suscripción ${s.slug}`, sus);
        const suid = sus.json?.data?.uid;
        if (!suid) {
            console.log('   ✗ no se creó: el resto de este sujeto se saltea');
            continue;
        }
        bitacora.creado('subscription', suid, { slug: s.slug });

        // Relectura: con `manual` está medido que el proveedor RELLENA un
        // `interval` que nadie mandó (§2.4). Se anota qué quedó de verdad.
        const rel = await llamar('GET', `/p/subscriptions/${suid}`);
        const d = rel.json?.data ?? {};
        console.log(`   relectura: type=${d.type} interval=${d.interval ?? '(ninguno)'} total=${d.total} test=${d.test} status=${d.status}`);
        if (s.tipo === 'manual' && d.interval) {
            console.log(`   ⚠️  mandamos 'manual' SIN interval y el proveedor puso '${d.interval}'.`);
            console.log('      Hay que medir si eso ejecuta cobros solo — es la diferencia entre');
            console.log('      «el ciclo es nuestro» y «el ciclo es suyo».');
        }

        const fila = { slug: s.slug, contesta: s.contesta, suscripcion: suid, tipo: d.type, interval: d.interval ?? null, total: d.total };

        if (!s.sinSuscriptor) {
            const sub = await llamar('POST', `/p/subscriptions/${suid}/subscriber`, {
                customer: {
                    email: `hos1352-${s.slug}@hospeda.com.ar`,
                    name: `HOS1352 ${s.slug}`,
                    identification: TITULAR.documento
                },
                startDate: { day: hoy.getDate(), month: hoy.getMonth() + 1, year: hoy.getFullYear() },
                test: true,
                reference: `${SELLO}-${s.slug}-sub`
            });
            mostrar(`suscriptor ${s.slug}`, sub);
            // OJO: la clave es `uid`, NO `sid`. La sonda 02 se equivocó acá y
            // por eso no llegó a ejercer el cobro.
            const subid = sub.json?.data?.uid;
            if (subid) {
                bitacora.creado('subscriber', subid, { slug: s.slug, de: suid });
                fila.suscriptor = subid;
                fila.sourceUrl = sub.json?.data?.sourceUrl ?? null;
                fila.tarjeta = s.tarjeta?.numero ?? null;
                fila.marca = s.tarjeta?.marca ?? null;
                fila.cvv = s.tarjeta?.cvv4 ? `0${s.cvv}` : s.cvv;
            }
        }

        resultado.push(fila);
    }

    const manifiesto = {
        sello: SELLO,
        fecha: new Date().toISOString(),
        cuenta: quien.nombre,
        entidad: quien.uid,
        sujetos: resultado
    };
    const archivo = new URL(`./manifiesto-${SELLO}.json`, import.meta.url);
    writeFileSync(archivo, JSON.stringify(manifiesto, null, 2));
    bitacora.escribir(import.meta.url);

    console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  PASO MANUAL — cargar las tarjetas, una por una, en el navegador ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log(`\nTitular: ${TITULAR.nombre} · Documento: ${TITULAR.documento} · Vencimiento: ${TITULAR.vencimiento}`);
    console.log('EL CVV DECIDE EL RESULTADO: 200 aprueba · 400 deniega · 002 deja pendiente.\n');

    for (const f of resultado) {
        if (!f.sourceUrl) continue;
        console.log(`── ${f.slug}  (${f.marca})`);
        console.log(`   tarjeta ${f.tarjeta}   CVV ${f.cvv}`);
        console.log(`   ${f.sourceUrl}\n`);
    }

    console.log(`manifiesto: ${archivo.pathname}`);
    console.log('\nCuando estén las tarjetas cargadas:  node probe-06-el-cobro.mjs');
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
