/**
 * Sonda 07 — El ciclo de vida: pausar, reanudar, mutar, mudar, cancelar, devolver.
 *
 * HOS-1352 · FASE 1C · Mobbex. NO es código productivo.
 *
 * Contesta las capacidades 3, 4, 5 y 6 del capítulo 06 —cambiar el monto,
 * pausar y reanudar, cancelar, reembolsar— y los casos donde Mercado Pago
 * falla, uno por uno, con el mismo control en todos: **releer y comparar campo
 * por campo cada campo que se mandó**. Un 2xx no cierra nada.
 *
 * La pregunta que más pesa para el diseño está en el §1: si la pausa se
 * reanuda sola. Con Mercado Pago NO existe (`PS-4`), y por eso el reloj de fin
 * de pausa terminó siendo nuestro. Si acá tampoco existe, deja de ser una
 * carencia de un proveedor y pasa a ser una constante de la plaza: el capítulo
 * 03 §5 se sostiene sin depender de quién cobre.
 *
 *   source ~/.config/hospeda/mobbex-creds.sh && node probe-07-el-ciclo-de-vida.mjs [manifiesto.json]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { Bitacora, comparar, credenciales, hacerLlamador, mostrar, mostrarComparacion, pausa } from './_comun.mjs';

const headers = credenciales();
const SELLO = `hos1352-vida-${Date.now()}`;
const bitacora = new Bitacora(SELLO);
const llamar = hacerLlamador(headers, bitacora);

const cargarManifiesto = () => {
    const dir = new URL('.', import.meta.url).pathname;
    const archivo =
        process.argv[2] ??
        readdirSync(dir)
            .filter((f) => f.startsWith('manifiesto-hos1352-bat-'))
            .sort()
            .pop();
    if (!archivo) {
        console.error('No hay manifiesto. Corré primero: node probe-05-preparar-sujetos.mjs');
        process.exit(1);
    }
    return JSON.parse(readFileSync(archivo.startsWith('/') ? archivo : `${dir}${archivo}`, 'utf8'));
};

const leerSus = async (uid) => (await llamar('GET', `/p/subscriptions/${uid}`)).json?.data ?? {};
const leerSub = async (sus, sub) => (await llamar('GET', `/p/subscriptions/${sus}/subscriber/${sub}`)).json?.data?.subscriber ?? {};

const main = async () => {
    console.log('SONDA 07 — el ciclo de vida');
    console.log(`fecha: ${new Date().toISOString()}\n`);

    const m = cargarManifiesto();
    const porSlug = Object.fromEntries(m.sujetos.map((s) => [s.slug, s]));
    const vida = porSlug['ciclo-de-vida'];
    if (!vida) {
        console.error('falta el sujeto `ciclo-de-vida` en el manifiesto');
        process.exit(1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1 · PAUSAR Y REANUDAR — ¿existe la auto-reanudación?
    // ═══════════════════════════════════════════════════════════════════
    console.log('╔═══ 1 · PAUSAR ═══╗');
    const antesPausa = await leerSus(vida.suscripcion);
    console.log(`   estado antes: ${antesPausa.status} · last update ${antesPausa.updated}`);

    const susp = await llamar('POST', `/p/subscriptions/${vida.suscripcion}/action/suspend`);
    mostrar('suspend', susp);
    await pausa(3000);
    const trasPausa = await leerSus(vida.suscripcion);
    console.log(`   estado después: ${trasPausa.status}`);
    console.log(`   → ${trasPausa.status !== antesPausa.status ? 'la pausa SE APLICÓ' : 'el estado NO cambió pese a la respuesta'}`);

    // ¿Acepta una FECHA de reanudación? Si la acepta y la descarta, es el §0
    // otra vez; si la rechaza, al menos avisa. Las dos formas plausibles.
    console.log('\n╔═══ 1b · ¿SE PUEDE PROGRAMAR LA REANUDACIÓN? ═══╗');
    console.log('   Con Mercado Pago no existe `pauseUntil` (PS-4) y el reloj terminó');
    console.log('   siendo nuestro. Se prueban dos formas y se RELEE: si acepta y no');
    console.log('   escribe nada, es aceptar-y-descartar.');
    const d = new Date();
    d.setDate(d.getDate() + 10);
    for (const [etq, cuerpo] of [
        ['resumeAt', { resumeAt: d.toISOString() }],
        ['pausedUntil', { pausedUntil: { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() } }]
    ]) {
        const r = await llamar('POST', `/p/subscriptions/${vida.suscripcion}/action/suspend`, cuerpo);
        mostrar(`suspend con ${etq}`, r);
        const rel = await leerSus(vida.suscripcion);
        const cmp = comparar(cuerpo, rel, Object.keys(cuerpo));
        mostrarComparacion(`¿quedó escrito ${etq}?`, cmp);
    }

    console.log('\n╔═══ 1c · REANUDAR ═══╗');
    const act = await llamar('POST', `/p/subscriptions/${vida.suscripcion}/action/activate`);
    mostrar('activate', act);
    await pausa(3000);
    const trasReanudar = await leerSus(vida.suscripcion);
    console.log(`   estado: ${trasReanudar.status}`);
    // Lo que con MP se perdía: el período pagado durante la pausa (PS-6).
    const sub = await leerSub(vida.suscripcion, vida.suscriptor);
    console.log(`   agenda: ${JSON.stringify(sub.agenda ?? []).slice(0, 220)}`);
    console.log(`   nextPayment: ${JSON.stringify(sub.nextPayment ?? null)}`);
    console.log('   → COMPARAR contra la agenda previa: ¿la fecha corrió, se mantuvo, o se perdió un ciclo?');

    // ═══════════════════════════════════════════════════════════════════
    // 2 · CAMBIAR EL MONTO — capacidad 3, y el control §4.1
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔═══ 2 · CAMBIAR EL MONTO DE UNA SUSCRIPCIÓN VIVA ═══╗');
    const nuevo = { total: 777, name: `HOS-1352 ciclo-de-vida`, description: 'monto mutado', currency: 'ARS', type: 'dynamic', limit: 0, return_url: 'https://hospeda.com.ar' };
    const mut = await llamar('POST', `/p/subscriptions/${vida.suscripcion}`, nuevo);
    mostrar('mutar total a 777', mut);
    await pausa(3000);
    const relMut = await leerSus(vida.suscripcion);
    mostrarComparacion('¿se aplicó el monto?', comparar(nuevo, relMut, ['total', 'description']));

    // Y el caso que MP bloquea: cambiar el CICLO con suscriptores activos.
    console.log('\n╔═══ 2b · CAMBIAR EL CICLO (con suscriptores activos) ═══╗');
    console.log('   La doc de Mobbex dice que `interval` «sólo puede editarse si la');
    console.log('   suscripción no posee suscriptores». Se verifica: ¿avisa con un error');
    console.log('   o acepta y descarta como hace Mercado Pago (EX-4)?');
    const cambioCiclo = { ...nuevo, interval: '1m' };
    const mc = await llamar('POST', `/p/subscriptions/${vida.suscripcion}`, cambioCiclo);
    mostrar('mutar interval a 1m', mc);
    await pausa(3000);
    const relCiclo = await leerSus(vida.suscripcion);
    mostrarComparacion('¿se aplicó el ciclo?', comparar(cambioCiclo, relCiclo, ['interval']));
    console.log(`   → ${mc.ok ? 'respondió OK' : `respondió ERROR (${mc.code})`} · el ciclo quedó en '${relCiclo.interval}'`);
    console.log('   → Si respondió OK y el ciclo NO cambió, es aceptar-y-descartar: el mismo');
    console.log('     vicio que hace caro a Mercado Pago, en el mismo campo.');

    // ═══════════════════════════════════════════════════════════════════
    // 3 · MUDAR DE PLAN — lo que Mercado Pago NO tiene
    // ═══════════════════════════════════════════════════════════════════
    const origen = porSlug['mudanza-origen'];
    const destino = porSlug['mudanza-destino'];
    if (origen?.suscriptor && destino?.suscripcion) {
        console.log('\n╔═══ 3 · action/move — mudar un suscriptor de plan ═══╗');
        console.log('   Es la capacidad que MP NO tiene: allá `preapproval_plan_id` devuelve');
        console.log('   200 y deja el plan viejo (EX-21). Acá hay endpoint dedicado.');
        const antesMove = await leerSub(origen.suscripcion, origen.suscriptor);
        console.log(`   antes: total=${antesMove.total} agenda=${JSON.stringify(antesMove.agenda ?? []).slice(0, 120)}`);

        const mv = await llamar('POST', `/p/subscriptions/${origen.suscripcion}/subscriber/${origen.suscriptor}/action/move`, {
            sid: destino.suscripcion
        });
        mostrar('move al destino', mv);
        await pausa(5000);

        // El control que lo cierra: ¿el suscriptor aparece en el DESTINO?
        const enDestino = await llamar('GET', `/p/subscriptions/${destino.suscripcion}/subscriber?page=0`);
        const docs = enDestino.json?.data?.docs ?? enDestino.json?.data ?? [];
        const lista = Array.isArray(docs) ? docs : [];
        console.log(`   suscriptores en el destino: ${lista.length}`);
        console.log(`   → ${lista.some((x) => x.uid === origen.suscriptor) ? 'MUDÓ: aparece en el destino' : 'NO aparece en el destino'}`);

        const enOrigen = await llamar('GET', `/p/subscriptions/${origen.suscripcion}/subscriber?page=0`);
        const docsO = enOrigen.json?.data?.docs ?? enOrigen.json?.data ?? [];
        const listaO = Array.isArray(docsO) ? docsO : [];
        console.log(`   ¿sigue en el origen?: ${listaO.some((x) => x.uid === origen.suscriptor) ? 'SÍ — quedó en los dos, ojo' : 'no'}`);
        console.log('   → Y lo que más importa para el diseño: ¿se recalculó la agenda al');
        console.log('     ciclo del destino (1m) o conservó la del origen (7d)?');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4 · CANCELAR — ¿es reversible? ¿se puede agendar a fin de período?
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔═══ 4 · CANCELAR ═══╗');
    console.log('   Con Mercado Pago la cancelación es IRREVERSIBLE (PA-5) y la baja a fin');
    console.log('   de período sólo existe al crear (CN-1), lo que obligó a DEC-SUB-009.');
    const pre = porSlug.prepaga;
    if (pre?.suscripcion) {
        // Se cancela el sujeto de prepaga, que para este punto ya cumplió.
        const conFecha = await llamar('DELETE', `/p/subscriptions/${pre.suscripcion}/action/delete`, {
            cancelAtPeriodEnd: true,
            endOfPeriod: true
        });
        mostrar('delete con cancelAtPeriodEnd/endOfPeriod', conFecha);
        await pausa(3000);
        const rel = await leerSus(pre.suscripcion);
        console.log(`   estado tras cancelar: ${rel.status ?? '(no se pudo releer)'}`);
        console.log('   → ¿aceptó los campos de fin de período, o los descartó con un OK?');

        // ¿Revive? Es la mitad de toda recuperación de una baja.
        const revivir = await llamar('POST', `/p/subscriptions/${pre.suscripcion}/action/activate`);
        mostrar('intentar reactivar una cancelada', revivir);
        const rel2 = await leerSus(pre.suscripcion);
        console.log(`   estado: ${rel2.status ?? '(sin dato)'}`);
        console.log(`   → ${revivir.ok ? 'la cancelación PARECE reversible — releer para confirmarlo' : 'no revive: cancelar es terminal, como en MP'}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5 · REEMBOLSAR — capacidad 6
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n╔═══ 5 · REEMBOLSO ═══╗');
    console.log('   Requiere una operación COBRADA. Se toma la última aprobada de la');
    console.log('   entidad; si no hay ninguna, no se puede medir todavía.');
    const ops = await llamar('GET', '/p/entity/operations?limit=25');
    const docs = ops.json?.data?.docs ?? [];
    const pagadas = docs.filter((o) => String(o.status) === '200');
    console.log(`   operaciones con código 200 («Paga»): ${pagadas.length} de ${docs.length}`);
    if (pagadas.length === 0) {
        console.log('   ✗ ninguna aprobada: el reembolso queda sin medir en esta corrida.');
        console.log('     (En la cuenta demo eso era un hallazgo; en la cuenta propia es un');
        console.log('      pendiente: hay que cobrar algo antes.)');
    } else {
        const op = pagadas[0];
        console.log(`   sobre la operación ${op.uid} de $${op.total}`);
        const parcial = await llamar('POST', `/p/operations/${op.uid}/refund`, { total: 1 });
        mostrar('reembolso PARCIAL de $1', parcial);
        // La doc dice que el parcial «únicamente se puede realizar al otro día».
        console.log('   → la doc dice que el parcial sólo se puede el día siguiente: si');
        console.log('     rechaza por eso, ES el hallazgo, no un error nuestro.');
        const repetido = await llamar('POST', `/p/operations/${op.uid}/refund`, { total: 1 });
        mostrar('el MISMO reembolso otra vez (¿idempotente?)', repetido);
    }

    const archivo = bitacora.escribir(import.meta.url);
    console.log(`\n── bitácora: ${archivo}`);
    console.log('── queda: los webhooks (probe-08) y la renovación automática, que tarda 7 días.');
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
