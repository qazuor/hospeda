/**
 * Sonda 06 — El cobro a demanda. ES LA SONDA QUE DECIDE.
 *
 * HOS-1352 · FASE 1C · Mobbex. NO es código productivo.
 *
 * Todo el interés en este proveedor viene de un endpoint: cobrar cuando
 * NOSOTROS se lo pedimos, contra una tarjeta ya guardada, con el monto que
 * queramos. Es la forma F4 del §2 de `10-evaluacion-de-proveedor.md`, la que
 * con Mercado Pago quedó trabada en un 403 y un portón comercial (`EX-31`),
 * y es la arquitectura que el owner declaró querer el 2026-09-18: que el ciclo
 * de vida sea nuestro y la pasarela sólo ejecute el cobro.
 *
 * Las seis preguntas, en orden de lo que decide:
 *   1. ¿Cobra de verdad? Verificado RELEYENDO, no por la respuesta.
 *   2. ¿Acepta un monto distinto al de la suscripción?
 *   3. ¿ES IDEMPOTENTE? Dos cobros con la misma `reference`. Si no lo es, el
 *      candado contra el doble cobro es nuestro — y con la arquitectura del
 *      owner, un doble cobro es plata de un cliente real.
 *   4. ¿Qué informa un cobro DENEGADO, y cuándo se entera uno?
 *   5. ¿Una PREPAGA sostiene la recurrencia? Con Mercado Pago no.
 *   6. ¿La ejecución programada CONVIVE con el cobro automático, o lo pisa?
 *      Si conviven sin avisar, son dos cobros al mismo cliente.
 *
 * DÓNDE SE LEE LA VERDAD, que ya costó una corrección: el resultado NO está en
 * la respuesta del POST (devuelve {"result":true,"data":{}} igual haya cobrado
 * o no) NI en `GET .../execution` (devuelve vacío). Está en el campo
 * `executions` DENTRO del objeto suscriptor.
 *
 *   source ~/.config/hospeda/mobbex-creds.sh && node probe-06-el-cobro.mjs [manifiesto.json]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { Bitacora, credenciales, hacerLlamador, mostrar, pausa } from './_comun.mjs';

const headers = credenciales();
const SELLO = `hos1352-cobro-${Date.now()}`;
const bitacora = new Bitacora(SELLO);
const llamar = hacerLlamador(headers, bitacora);

const cargarManifiesto = () => {
    const explicito = process.argv[2];
    const dir = new URL('.', import.meta.url).pathname;
    const archivo =
        explicito ??
        readdirSync(dir)
            .filter((f) => f.startsWith('manifiesto-hos1352-bat-'))
            .sort()
            .pop();
    if (!archivo) {
        console.error('No hay manifiesto. Corré primero: node probe-05-preparar-sujetos.mjs');
        process.exit(1);
    }
    const ruta = archivo.startsWith('/') ? archivo : `${dir}${archivo}`;
    console.log(`manifiesto: ${ruta}`);
    return JSON.parse(readFileSync(ruta, 'utf8'));
};

/**
 * Lee las ejecuciones DEL LUGAR DONDE ESTÁN. Devuelve también las otras dos
 * lecturas, para dejar registrado en la bitácora que siguen mintiendo — si
 * alguna vez dejan de hacerlo, es un hallazgo.
 */
const leerEjecuciones = async (sus, sub) => {
    const r = await llamar('GET', `/p/subscriptions/${sus}/subscriber/${sub}`);
    const ejec = r.json?.data?.subscriber?.executions ?? [];
    const porEndpoint = await llamar('GET', `/p/subscriptions/${sus}/subscriber/${sub}/execution`);
    return {
        ejecuciones: ejec,
        endpointPropio: porEndpoint.json?.data ?? null,
        sources: r.json?.data?.subscriber?.sources ?? [],
        activeSource: r.json?.data?.subscriber?.activeSource ?? null
    };
};

const mostrarEjecuciones = (etq, ejec) => {
    console.log(`\n   ${etq}: ${ejec.length} ejecución(es)`);
    for (const e of ejec.slice(-6)) {
        console.log(`     · ${e.status}  $${e.total}  ref=${String(e.reference ?? '').slice(-28)}  ${e.created ?? ''}`);
    }
};

const cobrar = async (sus, sub, cuerpo) => {
    const r = await llamar('POST', `/p/subscriptions/${sus}/subscriber/${sub}/execution`, cuerpo);
    mostrar(`POST execution · ${cuerpo.reference}`, r);
    console.log(`   respuesta cruda: ${r.texto}`);
    console.log('   (la respuesta NO dice si cobró: eso se lee releyendo)');
    return r;
};

const main = async () => {
    console.log('SONDA 06 — el cobro a demanda');
    console.log(`fecha: ${new Date().toISOString()}\n`);

    const m = cargarManifiesto();
    const porSlug = Object.fromEntries(m.sujetos.map((s) => [s.slug, s]));

    // ═══════════════════════════════════════════════════════════════════
    // 1 · EL COBRO, sobre el sujeto con tarjeta que aprueba
    // ═══════════════════════════════════════════════════════════════════
    const ok = porSlug['cobro-manual'];
    if (ok?.suscriptor) {
        console.log('\n╔═══ 1 · COBRO A DEMANDA, tarjeta que aprueba ═══╗');

        const antes = await leerEjecuciones(ok.suscripcion, ok.suscriptor);
        mostrarEjecuciones('ANTES', antes.ejecuciones);
        console.log(`   medios de pago cargados: ${antes.sources.length} · activeSource: ${JSON.stringify(antes.activeSource)}`);
        if (antes.sources.length === 0) {
            console.log('\n   ✗ ESTE SUJETO NO TIENE TARJETA. Cargala por su sourceUrl antes de seguir.');
            console.log('     Sin tarjeta, un cobro devuelve result:true y queda en error_no_payment_method.');
        }

        // 1a · monto estándar
        await cobrar(ok.suscripcion, ok.suscriptor, {
            reference: `${SELLO}-estandar`,
            description: 'HOS-1352 cobro estandar'
        });
        await pausa(6000);
        const t1 = await leerEjecuciones(ok.suscripcion, ok.suscriptor);
        mostrarEjecuciones('DESPUÉS del cobro estándar', t1.ejecuciones);

        // 1b · monto LIBRE, distinto al de la suscripción
        await cobrar(ok.suscripcion, ok.suscriptor, {
            total: 987.65,
            reference: `${SELLO}-libre`,
            description: 'HOS-1352 monto libre'
        });
        await pausa(6000);
        const t2 = await leerEjecuciones(ok.suscripcion, ok.suscriptor);
        mostrarEjecuciones('DESPUÉS del monto libre', t2.ejecuciones);
        const libre = t2.ejecuciones.find((e) => String(e.reference ?? '').includes('-libre'));
        console.log(`   monto libre aplicado: ${libre ? `$${libre.total} (${libre.total === 987.65 ? 'SÍ, el que mandamos' : 'NO — cobró otro'})` : 'no se encontró la ejecución'}`);

        // ═══ 1c · IDEMPOTENCIA. La pregunta más cara de la sonda.
        console.log('\n╔═══ 1c · ¿EL COBRO ES IDEMPOTENTE? ═══╗');
        console.log('   Dos cobros con la MISMA reference. Si entran los dos, el candado');
        console.log('   contra el doble cobro es nuestro — y con el ciclo de vida de nuestro');
        console.log('   lado, un reintento mal hecho es plata de un cliente real.');
        const refRepetida = `${SELLO}-idem`;
        await cobrar(ok.suscripcion, ok.suscriptor, { total: 111, reference: refRepetida, description: 'idempotencia 1' });
        await pausa(3000);
        await cobrar(ok.suscripcion, ok.suscriptor, { total: 111, reference: refRepetida, description: 'idempotencia 2' });
        await pausa(6000);
        const t3 = await leerEjecuciones(ok.suscripcion, ok.suscriptor);
        mostrarEjecuciones('DESPUÉS de los dos con la misma reference', t3.ejecuciones);
        const repetidas = t3.ejecuciones.filter((e) => String(e.reference ?? '').includes('-idem'));
        console.log(`\n   → ejecuciones con esa reference: ${repetidas.length}`);
        console.log(`   → ${repetidas.length <= 1 ? 'DEDUPLICA: el proveedor bloqueó la segunda.' : 'NO DEDUPLICA: cobró dos veces. EL CANDADO ES NUESTRO.'}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2 · EL COBRO DENEGADO — lo que con Mercado Pago no se pudo fabricar
    // ═══════════════════════════════════════════════════════════════════
    const malo = porSlug['cobro-rechazado'];
    if (malo?.suscriptor) {
        console.log('\n╔═══ 2 · COBRO DENEGADO (tarjeta cargada con CVV 400) ═══╗');
        console.log('   Con Mercado Pago esto fue IMPOSIBLE de fabricar: los siete titulares');
        console.log('   de rechazo mueren antes de asociarse (PA-4). Es lo que dejó RN-2, RN-3');
        console.log('   y GR-1..3 sin medir y obligó a gastar plata real en producción.');

        const antes = await leerEjecuciones(malo.suscripcion, malo.suscriptor);
        console.log(`   medios cargados: ${antes.sources.length}`);

        await cobrar(malo.suscripcion, malo.suscriptor, {
            reference: `${SELLO}-denegado`,
            description: 'HOS-1352 cobro que debe fallar'
        });
        await pausa(8000);
        const t = await leerEjecuciones(malo.suscripcion, malo.suscriptor);
        mostrarEjecuciones('DESPUÉS', t.ejecuciones);
        const ult = t.ejecuciones[t.ejecuciones.length - 1];
        console.log(`\n   → estado del intento: ${ult?.status ?? '(ninguno)'}`);
        console.log('   → ¿la respuesta del POST había anticipado el fallo? NO: fue result:true.');

        // ¿Se puede REINTENTAR? Es la mitad de RN-3 y de todo el dunning.
        if (ult?.uid) {
            const reint = await llamar('GET', `/p/subscriptions/${malo.suscripcion}/subscriber/${malo.suscriptor}/execution/${ult.uid}/action/retry`);
            mostrar('reintento de la ejecución fallida', reint);
            await pausa(6000);
            const t2 = await leerEjecuciones(malo.suscripcion, malo.suscriptor);
            mostrarEjecuciones('DESPUÉS del reintento', t2.ejecuciones);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3 · PREPAGA — con Mercado Pago no sirve para suscripciones
    // ═══════════════════════════════════════════════════════════════════
    const pre = porSlug.prepaga;
    if (pre?.suscriptor) {
        console.log('\n╔═══ 3 · ¿UNA PREPAGA SOSTIENE LA RECURRENCIA? ═══╗');
        const antes = await leerEjecuciones(pre.suscripcion, pre.suscriptor);
        console.log(`   medios cargados: ${antes.sources.length}`);
        if (antes.sources.length === 0) {
            console.log('   ✗ sin tarjeta cargada. Si la carga FALLÓ, eso ya es el hallazgo:');
            console.log('     el proveedor dice aceptar prepagas y su propio sandbox trae una.');
        } else {
            await cobrar(pre.suscripcion, pre.suscriptor, { reference: `${SELLO}-prepaga`, description: 'HOS-1352 prepaga' });
            await pausa(8000);
            const t = await leerEjecuciones(pre.suscripcion, pre.suscriptor);
            mostrarEjecuciones('DESPUÉS', t.ejecuciones);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4 · LA EJECUCIÓN PROGRAMADA, ¿convive con el cobro automático?
    // ═══════════════════════════════════════════════════════════════════
    const vida = porSlug['ciclo-de-vida'];
    if (vida?.suscriptor) {
        console.log('\n╔═══ 4 · action/schedule sobre una suscripción DINÁMICA ═══╗');
        console.log('   La documentación no dice si la ejecución programada REEMPLAZA al cobro');
        console.log('   automático del ciclo o si corre además. Si corre además y nadie avisa,');
        console.log('   son DOS cobros al mismo cliente.');
        const d = new Date();
        d.setDate(d.getDate() + 5); // el mínimo documentado son 4 días
        const sch = await llamar('POST', `/p/subscriptions/${vida.suscripcion}/subscriber/${vida.suscriptor}/action/schedule`, {
            date: { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() },
            total: 321
        });
        mostrar('programar ejecución a +5 días', sch);

        const rel = await llamar('GET', `/p/subscriptions/${vida.suscripcion}/subscriber/${vida.suscriptor}`);
        const s = rel.json?.data?.subscriber ?? {};
        console.log(`\n   agenda tras programar: ${JSON.stringify(s.agenda ?? []).slice(0, 300)}`);
        console.log(`   nextPayment: ${JSON.stringify(s.nextPayment ?? null)}`);
        console.log('   → COMPARAR con la agenda de antes (manifiesto de la sonda 05).');
        console.log('   → Si la fecha del ciclo NO se movió, conviven: hay que releerlo el día D.');
    }

    const archivo = bitacora.escribir(import.meta.url);
    console.log(`\n── bitácora: ${archivo}`);
    console.log('── seguir con: node probe-07-el-ciclo-de-vida.mjs');
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
