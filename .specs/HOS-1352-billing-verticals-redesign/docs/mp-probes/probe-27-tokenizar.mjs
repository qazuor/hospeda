// =============================================================================
// SONDA 27 — Tokenizar la tarjeta del owner, SIN que la tarjeta salga de ahí
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352.
//
// POR QUÉ EXISTE, Y POR QUÉ LO CORRE EL OWNER Y NO EL AGENTE
// ----------------------------------------------------------
// Las filas que faltan —`EX-4` (cambiar el ciclo), `PS-*` (pausa), `UP-*`,
// `DW-*`, `EX-12` (reusar un token)— exigen una suscripción **autorizada**, y
// autorizar exige una tarjeta real. La del owner.
//
// **Los datos de la tarjeta no pueden pasar por el chat.** Todo lo que se
// escribe ahí queda en el transcript de la sesión y en los snapshots que el
// harness guarda en disco. Así que la tarjeta se tipea UNA vez, en la sesión
// SSH del propio owner, contra el contenedor de la API de producción — que es
// donde ya vive el access token, así que tampoco hay que mover ese secreto.
//
// QUÉ HACE, EXACTAMENTE
// ---------------------
//   1. Pregunta los datos de la tarjeta por stdin, con el número y el código
//      de seguridad SIN ECO en pantalla.
//   2. Llama N veces a `POST /v1/card_tokens`. **Un `card_token` es de UN SOLO
//      USO** (`EX-12`, medido): cada suscripción que se cree necesita el suyo,
//      y por eso se generan varios de una.
//   3. Escribe SÓLO los ids de token en `/tmp/hos1352-tokens.txt`, adentro del
//      contenedor.
//   4. No imprime los tokens, no imprime la tarjeta, y no escribe la tarjeta
//      en ningún lado.
//
// Los datos de la tarjeta viven en memoria del proceso y se van con él.
//
// CÓMO SE CORRE (lo hace el owner, interactivo)
// ---------------------------------------------
//   ssh -t -p 2222 qazuor@216.238.103.219
//   hops --target=prod exec api --shell
//   node /tmp/p27.mjs
//
// **Tiene que ser `--shell`.** Un comando inline (`hops exec api -- node …`)
// corre con el stdio heredado pero SIN TTY, y sin TTY no se puede ocultar lo
// que se tipea. Esta sonda **se niega a arrancar** en ese caso en vez de pedir
// un número de tarjeta que va a quedar visible en pantalla: medido el
// 2026-09-15, la primera versión se caía con un `ERR_USE_AFTER_CLOSE` después
// de haber impreso el aviso, que es la peor combinación posible.
//
// Si el contenedor se reinicia o se redeploya, `/tmp` se va y hay que volver a
// correrlo. No es un problema: son treinta segundos.
//
// UNA ADVERTENCIA QUE SALE DE LOS DATOS
// -------------------------------------
// En el historial de pagos de producción hay varios `card_validation`
// rechazados con `cc_rejected_high_risk`. Tokenizar y autorizar muchas veces
// seguidas puede disparar esa protección. Si empieza a rechazar, no es un bug
// nuestro: es antifraude, y hay que espaciar los intentos.
// =============================================================================

import { writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const SALIDA = '/tmp/hos1352-tokens.txt';
const CUANTOS = Number(process.env.CUANTOS ?? 12);

if (!TOKEN) {
    console.error('✗ falta el access token en el entorno del contenedor');
    process.exit(1);
}

// --- el guard de TTY, que va ANTES de preguntar nada --------------------------
// Sin TTY no hay forma de ocultar lo que se tipea. Pedir igual un número de
// tarjeta y avisar "se va a ver" es lo peor de los dos mundos: el aviso llega
// cuando el usuario ya está por tipear. Así que acá no se pregunta nada.
if (!process.stdin.isTTY) {
    console.error('✗ No hay TTY, así que no se puede ocultar lo que tipees.');
    console.error('  Esta sonda NO va a pedir un número de tarjeta en esas condiciones.');
    console.error('');
    console.error('  Entrá con una shell interactiva y corrés el script adentro:');
    console.error('');
    console.error('    ssh -t -p 2222 qazuor@216.238.103.219');
    console.error('    hops --target=prod exec api --shell');
    console.error('    node /tmp/p27.mjs');
    console.error('');
    console.error('  (`hops exec api -- node …` hereda el stdio pero no da TTY.)');
    process.exit(1);
}

// Lee una línea en modo raw, haciendo el eco a mano. Se usa para TODOS los
// campos —no sólo los ocultos— porque en modo raw la terminal no hace eco por
// su cuenta, y mezclar readline con raw es justo lo que rompió la v1.
const preguntar = (texto, oculto = false) =>
    new Promise((resolve) => {
        process.stdout.write(texto);
        const stdin = process.stdin;
        stdin.setEncoding('utf8');
        stdin.setRawMode(true);
        stdin.resume();
        let buf = '';
        const onData = (trozo) => {
            for (const c of trozo) {
                if (c === '\r' || c === '\n') {
                    stdin.removeListener('data', onData);
                    stdin.setRawMode(false);
                    stdin.pause();
                    process.stdout.write('\n');
                    return resolve(buf.trim());
                }
                if (c === '') {
                    // Ctrl+C: en modo raw hay que manejarlo a mano o no sale nunca
                    stdin.setRawMode(false);
                    process.stdout.write('\n');
                    process.exit(130);
                }
                if (c === '' || c === '\b') {
                    if (buf.length) {
                        buf = buf.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    continue;
                }
                if (c < ' ') continue; // ignora el resto de los caracteres de control
                buf += c;
                process.stdout.write(oculto ? '*' : c);
            }
        };
        stdin.on('data', onData);
    });

console.log('############ SONDA 27 — tokenizar (los datos NO se guardan ni se imprimen)\n');

const yo = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
console.log(`cuenta vendedora: ${yo?.nickname} (${yo?.id})\n`);

const numero = (await preguntar('  número de tarjeta      : ', true)).replace(/\s|-/g, '');
const cvv = await preguntar('  código de seguridad    : ', true);
const mes = await preguntar('  mes de vencimiento (MM): ');
const anio = await preguntar('  año de vencimiento (YYYY): ');
const titular = await preguntar('  nombre del titular     : ');
const doc = await preguntar('  DNI del titular        : ');

console.log(`\n  tokenizando ${CUANTOS} veces (un token = una suscripción, son de un solo uso)…`);

const tokens = [];
const fallas = [];
for (let i = 0; i < CUANTOS; i++) {
    const r = await fetch(`${API}/v1/card_tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            card_number: numero,
            security_code: cvv,
            expiration_month: Number(mes),
            expiration_year: Number(anio),
            cardholder: { name: titular, identification: { type: 'DNI', number: doc } }
        })
    });
    const b = await r.json().catch(() => null);
    if (b?.id) tokens.push(b.id);
    else fallas.push(`${r.status}: ${b?.message ?? b?.error ?? 'sin detalle'}`);
    await new Promise((res) => setTimeout(res, 400));
}

if (tokens.length === 0) {
    console.error('\n✗ no se generó ningún token.');
    for (const f of [...new Set(fallas)]) console.error(`   ${f}`);
    process.exit(1);
}

writeFileSync(SALIDA, `${tokens.join('\n')}\n`, { mode: 0o600 });

// Lo único que se imprime del token son sus últimos 4 caracteres, para poder
// confirmar de un vistazo que el archivo es el que se acaba de escribir.
console.log(`\n✓ ${tokens.length} de ${CUANTOS} tokens escritos en ${SALIDA}`);
console.log(`  (terminan en: ${tokens.map((t) => t.slice(-4)).join(', ')})`);
if (fallas.length) {
    console.log(`\n  ${fallas.length} fallaron:`);
    for (const f of [...new Set(fallas)]) console.log(`   ${f}`);
}
console.log('\n  La tarjeta no se guardó en ningún lado. Podés cerrar la sesión.');
