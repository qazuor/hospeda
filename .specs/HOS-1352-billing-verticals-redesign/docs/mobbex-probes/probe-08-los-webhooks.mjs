/**
 * Sonda 08 — Los webhooks de Mobbex: ¿avisa, firma, ordena?
 *
 * HOS-1352 · FASE 1C · Mobbex. NO es código productivo.
 *
 * Lee el receptor propio —el MISMO Worker que se usó con Mercado Pago, en
 * `../mp-probes/probe-08-webhook-sink`— y contesta la capacidad 8 del capítulo
 * 06, que es la que este proveedor tiene más floja según la documentación:
 *
 *   1. ¿QUÉ eventos llegan? Catálogo real, no el de la doc.
 *   2. ¿HAY FIRMA? Es el riesgo más serio que quedó abierto: la documentación
 *      sólo exige TLS 1.2+ del lado receptor y no menciona ningún header de
 *      firma. Con Mercado Pago la firma está medida y reproducida (`EX-13`).
 *      Si de verdad no hay, cualquiera que sepa la URL inyecta un cobro.
 *   3. ¿AVISA CUANDO MUTAMOS NOSOTROS? Con Mercado Pago NO (`EX-15`): mutar el
 *      monto no emite nada, mientras al cliente le escriben por correo. Si acá
 *      pasa lo mismo, es la misma deuda y el capítulo 09 se sostiene igual.
 *   4. ¿Hay contador de versión o algo que permita ordenar? Ninguno de los
 *      cinco candidatos del §7.1 garantiza orden de entrega.
 *
 * El receptor guarda cada POST TAL CUAL llega: bytes crudos, todos los
 * headers, la query y el instante con precisión de milisegundo. No interpreta.
 *
 *   node probe-08-los-webhooks.mjs            # lo acumulado, resumido
 *   node probe-08-los-webhooks.mjs --crudo    # todo, en JSON
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const SINK = process.env.HOS1352_SINK ?? 'https://hos1352-webhook-sink.qazuor.workers.dev';
const TOKEN_FILE = process.env.TOKEN_FILE ?? `${homedir()}/.config/hospeda/hos1352-sink-token.txt`;

// Cabeceras que serían una firma si existieran. La lista es generosa a
// propósito: lo que se quiere descartar es que haya UNA y no la veamos.
const SOSPECHOSAS = /sign|hmac|hash|digest|secret|token|auth|mac|checksum|verify/i;

const leerToken = () => {
    try {
        return readFileSync(TOKEN_FILE, 'utf8').trim();
    } catch {
        console.error(`No se pudo leer el token del sink en ${TOKEN_FILE}`);
        process.exit(1);
    }
};

const main = async () => {
    const token = leerToken();
    const res = await fetch(`${SINK}/dump?t=${token}`);
    if (!res.ok) {
        console.error(`el sink contestó ${res.status}`);
        process.exit(1);
    }
    const data = await res.json();
    const todos = data.items ?? data.entries ?? data.hits ?? (Array.isArray(data) ? data : []);

    // Sólo lo de Mobbex: el sink es compartido con las sondas de Mercado Pago.
    const mios = todos.filter((h) => {
        const q = h.query ?? h.url ?? '';
        return /fuente=mobbex/.test(typeof q === 'string' ? q : JSON.stringify(q));
    });

    console.log('SONDA 08 — los webhooks de Mobbex');
    console.log(`fecha: ${new Date().toISOString()}`);
    console.log(`sink:  ${SINK}`);
    console.log(`\nentregas totales en el receptor: ${todos.length}`);
    console.log(`entregas de Mobbex:             ${mios.length}`);

    if (mios.length === 0) {
        console.log('\nNo llegó ninguna. Tres causas posibles, y conviene descartarlas en orden:');
        console.log('  1. todavía no pasó nada que notificar (ni un cobro, ni una pausa);');
        console.log('  2. el campo `webhook` de la suscripción no quedó apuntado al sink');
        console.log('     — releerlo con GET /p/subscriptions/{id} y mirar el campo;');
        console.log('  3. el proveedor no notifica ese hecho, que ES un hallazgo.');
        console.log('\nNo se concluye 3 sin haber descartado 1 y 2.');
        return;
    }

    if (process.argv.includes('--crudo')) {
        console.log(JSON.stringify(mios, null, 2));
        return;
    }

    // ── 1 · El catálogo REAL de eventos
    const tipos = new Map();
    for (const h of mios) {
        let cuerpo = null;
        try {
            cuerpo = typeof h.body === 'string' ? JSON.parse(h.body) : h.body;
        } catch {
            /* cuerpo no-JSON: se cuenta aparte */
        }
        const tipo = cuerpo?.type ?? cuerpo?.event ?? '(sin campo de tipo)';
        tipos.set(tipo, (tipos.get(tipo) ?? 0) + 1);
    }
    console.log('\n── 1 · eventos recibidos, por tipo');
    for (const [t, n] of [...tipos.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`   ${String(n).padStart(3)} × ${t}`);
    }

    // ── 2 · LA FIRMA. El punto más grave.
    console.log('\n── 2 · ¿vienen firmados?');
    const headersVistos = new Set();
    for (const h of mios) {
        for (const k of Object.keys(h.headers ?? {})) headersVistos.add(k.toLowerCase());
    }
    const candidatas = [...headersVistos].filter((k) => SOSPECHOSAS.test(k));
    console.log(`   cabeceras distintas vistas: ${headersVistos.size}`);
    if (candidatas.length > 0) {
        console.log(`   ⚠️  CANDIDATAS A FIRMA: ${candidatas.join(', ')}`);
        const ej = mios.find((h) => Object.keys(h.headers ?? {}).some((k) => SOSPECHOSAS.test(k)));
        for (const c of candidatas) {
            console.log(`     ${c}: ${ej?.headers?.[c] ?? ej?.headers?.[c.toLowerCase()]}`);
        }
        console.log('   → Si hay firma, el paso siguiente es REPRODUCIRLA, como se hizo con');
        console.log('     Mercado Pago en EX-13. Que exista un header no prueba que valide.');
    } else {
        console.log('   ✗ NINGUNA cabecera parece una firma.');
        console.log(`   todas: ${[...headersVistos].sort().join(', ')}`);
        console.log('   → Coincide con la documentación, que sólo exige TLS 1.2+ del receptor.');
        console.log('   → CONSECUENCIA: el receptor no puede distinguir un evento del proveedor');
        console.log('     de uno inventado por cualquiera que conozca la URL. Con la arquitectura');
        console.log('     de «el ciclo de vida es nuestro» eso importa MENOS que con MP —los');
        console.log('     cobros los disparamos y confirmamos releyendo— pero un evento falso');
        console.log('     igual puede ensuciar el estado local.');
    }

    // ── 3 · ¿Hay con qué ordenar?
    console.log('\n── 3 · ¿hay contador de versión o secuencia?');
    const claves = new Set();
    for (const h of mios) {
        try {
            const c = typeof h.body === 'string' ? JSON.parse(h.body) : h.body;
            for (const k of Object.keys(c ?? {})) claves.add(k);
        } catch {
            /* ignorado */
        }
    }
    const orden = [...claves].filter((k) => /version|sequence|seq|order|revision|updated|timestamp|date/i.test(k));
    console.log(`   claves del cuerpo: ${[...claves].sort().join(', ') || '(ninguna legible)'}`);
    console.log(`   candidatas a ordenar: ${orden.join(', ') || 'NINGUNA'}`);
    if (orden.length === 0) {
        console.log('   → Sin nada que ordene, un evento viejo puede pisar a uno nuevo.');
        console.log('     La defensa es la del capítulo 03: releer el recurso en vez de');
        console.log('     creerle al evento. No depende del proveedor.');
    }

    // ── 4 · La línea de tiempo, para atribuir cada evento a una acción
    console.log('\n── 4 · línea de tiempo');
    for (const h of mios.slice(-15)) {
        let tipo = '(?)';
        try {
            const c = typeof h.body === 'string' ? JSON.parse(h.body) : h.body;
            tipo = c?.type ?? c?.event ?? '(sin tipo)';
        } catch {
            /* ignorado */
        }
        const q = String(h.query ?? h.url ?? '');
        const sujeto = /sujeto=([^&]+)/.exec(q)?.[1] ?? '?';
        console.log(`   ${h.at ?? h.ts ?? '?'}  ${tipo}  · sujeto=${sujeto}`);
    }
    console.log('\n   → Espaciar las acciones al menos 30 s: si dos caen juntas, atribuir un');
    console.log('     evento a una de ellas es una inferencia, no una lectura.');
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
