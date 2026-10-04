// =============================================================================
// SONDA 29 — El reloj, pero en PRODUCCIÓN
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. Apunta a las 16 filas que sólo esperan que un ciclo SE
// EJECUTE: `RN-1`, `RN-3`, `PS-2`, `PS-4`, `PS-5`, `PS-6`, `UP-1`, `UP-2`,
// `DW-1`, `DW-2`, `CT-1`, `CT-3`, `GT-1`, `EX-1`, y la mitad de `CN-1`.
//
// AUTORIZADO POR EL OWNER el 2026-09-15: siete sujetos, **ARS 105 hoy**, sobre
// su propia tarjeta. El desglose está abajo y la sonda **aborta si el total a
// cobrar no da exactamente esa cifra** — un presupuesto autorizado vale para
// ese número, no para "más o menos ese número".
//
// EL DESGLOSE, QUE ES LO QUE SE AUTORIZÓ
// --------------------------------------
//   renov-ok        ARS 15  · cobra hoy y tiene que volver a cobrar mañana
//   pausa-real      ARS 15  · se pausa hoy: ¿cobra igual mañana?
//   monto-sube      ARS 15  · se sube a 30 hoy: ¿cobra 15 o 30 mañana?
//   monto-baja      ARS 30  · se baja a 15 hoy: ¿cobra 30 o 15 mañana?
//   cancelada       ARS 15  · se cancela hoy: ¿cobra igual mañana?
//   end-date        ARS 15  · nace con end_date ANTES del próximo cobro
//   sin-autorizar   ARS  0  · nunca se autoriza (EX-1)
//   ───────────────────────
//   TOTAL HOY       ARS 105
//
// Mañana, en el peor caso, cobra 15 + 30 + 15 = ARS 60 más. Todo se reembolsa
// **total** al terminar —`RF-1` midió que el total sobre un pago de ARS 15
// funciona— y lo único que no vuelve es la comisión, ~8%.
//
// POR QUÉ `monto-baja` ES EL SUJETO CARO
// --------------------------------------
// Porque el piso del proveedor es ARS 15 (`PC-2`): para BAJAR hay que nacer
// arriba. Y por lo mismo, **`monto-baja` es también el sujeto de la cortesía**
// (`CT-1`/`CT-3`): con piso 15, "la cortesía más barata posible" y "un
// downgrade al mínimo" son literalmente la misma operación. Separarlos habría
// costado otro sujeto para medir dos veces lo mismo.
//
// LO QUE NO ESTÁ ACÁ, A PROPÓSITO
// -------------------------------
// **`RN-2` y `GR-1..3`, el cobro fallido.** `PA-4` midió que una tarjeta que va
// a rechazar no llega ni a crear la suscripción, así que el único camino para
// fabricar un fallo es subir el monto a algo impagable — y contra una tarjeta
// real eso es apostar a que el límite lo rechace. Si el intento *entrara*,
// cobra esa cifra. Queda en el reloj de sandbox, donde `renov-falla3` ya está
// corriendo para eso.
//
// EL MANIFIESTO NO ES OPCIONAL
// ----------------------------
// `RC-1`: el `search` **ignora `external_reference`**. Si se pierden los ids,
// no hay forma de volver a encontrar estos sujetos por nuestra referencia y se
// pierde el experimento. Por eso se escriben en el contenedor **y** se imprimen
// para copiarlos al repo. Los ids de una suscripción no son un secreto: son la
// evidencia del §59.
//
//   crear:  hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p29.mjs && node /tmp/p29.mjs'
//   leer:   … && LEER=1 node /tmp/p29.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';
const MANIFIESTO = '/tmp/hos1352-reloj-prod.json';
const PRESUPUESTO_AUTORIZADO = 105;

const pedir = async (ruta, init = {}) => {
    const r = await fetch(`${API}${ruta}`, {
        ...init,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) }
    });
    const t = await r.text();
    let b;
    try {
        b = JSON.parse(t);
    } catch {
        b = t === '' ? null : t.slice(0, 300);
    }
    return { code: r.status, b };
};

const yo = await pedir('/users/me');
if (yo.b?.id !== CUENTA_ESPERADA) {
    console.error(`✗ ABORTA: cuenta ${yo.b?.id}`);
    process.exit(1);
}

const leer = async (id) => (await pedir(`/preapproval/${id}`)).b;
const cobros = async (id) => {
    const r = await pedir(`/authorized_payments/search?preapproval_id=${id}&limit=20`);
    return (r.b?.results ?? []).map((a) => ({
        id: a.id,
        status: a.status,
        monto: a.transaction_amount,
        debit: (a.debit_date ?? '').slice(0, 19),
        retry: a.retry_attempt,
        pago: a.payment?.id,
        pagoEstado: `${a.payment?.status ?? '—'}/${a.payment?.status_detail ?? '—'}`
    }));
};

// =============================================================================
// MODO LECTURA
// =============================================================================
if (process["env"].LEER) {
    const m = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));
    console.log(`############ SONDA 29 — LECTURA · ${new Date().toISOString()}`);
    console.log(`arrancado: ${m.arrancado}\n`);
    for (const s of m.sujetos) {
        const x = await leer(s.id);
        const c = await cobros(s.id);
        console.log(`=== ${s.slug}  (${s.id})`);
        console.log(`    ${s.mide}`);
        console.log(
            `    estado: ${x?.status} · ARS ${x?.auto_recurring?.transaction_amount} · ${x?.auto_recurring?.frequency} ${x?.auto_recurring?.frequency_type} · next ${x?.next_payment_date ?? '—'}`
        );
        console.log(`    end_date: ${x?.auto_recurring?.end_date ?? '—'} · charged_quantity: ${x?.summarized?.charged_quantity ?? '—'}`);
        console.log(`    COBROS (${c.length}):`);
        for (const p of c)
            console.log(`      ${p.debit} · ARS ${p.monto} · ${p.status} · retry ${p.retry} · pago ${p.pago} ${p.pagoEstado}`);
        if (c.length === 0) console.log('      (ninguno)');
        console.log('');
    }
    console.log('Recordá: la primera lectura fija la línea de base y NO concluye nada.');
    console.log('Cada fila se marca contra el DELTA entre dos fotos fechadas.');
    process.exit(0);
}

// =============================================================================
// MODO CREACIÓN
// =============================================================================
console.log(`############ SONDA 29 — arrancar el reloj de PRODUCCIÓN · ${new Date().toISOString()}`);
console.log(`cuenta: ${yo.b?.nickname} (${yo.b?.id})`);

let tokens;
try {
    tokens = readFileSync('/tmp/hos1352-tokens.txt', 'utf8').split('\n').map((x) => x.trim()).filter(Boolean);
} catch {
    console.error('✗ no hay /tmp/hos1352-tokens.txt — corré la sonda 27 (la corre el owner)');
    process.exit(1);
}

// --- el plan, y el guard de presupuesto --------------------------------------
// <slug> <monto al crear> <autoriza> <qué mide>
const PLAN = [
    ['renov-ok', 15, true, 'RN-1/RN-3: ¿vuelve a cobrar a las 24 h?'],
    ['pausa-real', 15, true, 'PS-2/4/5/6: pausada hoy, ¿cobra igual mañana? ¿se reanuda sola? ¿se corren las fechas?'],
    ['monto-sube', 15, true, 'UP-1/UP-2: sube a 30 hoy, ¿cobra 15 o 30 mañana?'],
    ['monto-baja', 30, true, 'DW-1/DW-2 + CT-1/CT-3: baja al piso (15) hoy, ¿cobra 30 o 15 mañana?'],
    ['cancelada', 15, true, 'GT-1: cancelada hoy, ¿cobra igual mañana? (next_payment_date NO se limpia)'],
    ['end-date', 15, true, 'CN-1 (la mitad que falta): nace con end_date ANTES del próximo cobro'],
    ['sin-autorizar', 0, false, 'EX-1: nunca se autoriza. ¿Vence? ¿Cuándo?']
];

const aCobrar = PLAN.filter((p) => p[2]).reduce((a, p) => a + p[1], 0);
console.log(`\npresupuesto: se van a cobrar ARS ${aCobrar} hoy (autorizado: ${PRESUPUESTO_AUTORIZADO})`);
if (aCobrar !== PRESUPUESTO_AUTORIZADO) {
    console.error(`✗ ABORTA: el plan cobra ${aCobrar} y lo autorizado son ${PRESUPUESTO_AUTORIZADO}.`);
    console.error('  Un presupuesto autorizado vale para ESE número. Hay que volver a preguntar.');
    process.exit(1);
}
const guardarTokens = () => writeFileSync('/tmp/hos1352-tokens.txt', `${tokens.join('\n')}\n`, { mode: 0o600 });

const necesarios = PLAN.filter((p) => p[2]).length;
if (tokens.length < necesarios) {
    console.error(`✗ ABORTA: hacen falta ${necesarios} tokens y hay ${tokens.length}.`);
    console.error('  Volvé a correr la sonda 27 con CUANTOS=10.');
    process.exit(1);
}
console.log(`tokens: ${tokens.length} disponibles, se usan ${necesarios}\n`);

const MANANA = new Date(Date.now() + 20 * 3600000).toISOString().replace('Z', '-00:00');
const sujetos = [];

for (const [slug, monto, autoriza, mide] of PLAN) {
    const cuerpo = {
        reason: `HOS1352 reloj ${slug}`.slice(0, 60),
        payer_email: PAGADOR,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-relojprod-${slug}`,
        auto_recurring: {
            frequency: 1,
            frequency_type: 'days',
            transaction_amount: monto || 15,
            currency_id: 'ARS'
        }
    };
    if (slug === 'end-date') cuerpo.auto_recurring.end_date = MANANA;
    // Un token gastado da `400 "Card token was used, please generate new"`
    // (`EX-12`). El archivo puede tener tokens ya consumidos por otra sonda —la
    // 28 no lo reescribía— así que acá se reintenta con el siguiente hasta dar
    // con uno vivo, en vez de dejar un hueco en el reloj. Y el archivo se
    // reescribe con lo que queda: el estado del archivo tiene que seguir a la
    // realidad, o la próxima sonda hereda el mismo problema.
    let r;
    let id = null;
    if (autoriza) {
        cuerpo.status = 'authorized';
        while (tokens.length) {
            cuerpo.card_token_id = tokens.shift();
            guardarTokens();
            r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
            id = r.b?.id ?? null;
            if (id) break;
            const msg = String(r.b?.message ?? '');
            if (!/token was used|token.*generate new/i.test(msg)) break;
            console.log(`    (token gastado, probando el siguiente — quedan ${tokens.length})`);
        }
    } else {
        r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
        id = r.b?.id ?? null;
    }
    console.log(`=== ${slug.padEnd(14)} HTTP ${r.code} ${id ? `· ${id} · ${r.b?.status}` : `· "${r.b?.message ?? ''}"`}`);
    if (!id) {
        // Un reloj incompleto es peor que ninguno: se paga el cobro de los
        // sujetos que sí entraron y al día siguiente faltan filas. Así que si
        // se acabaron los tokens vivos, se corta acá y se dice exactamente qué
        // quedó vivo, en vez de seguir y dejar huecos en silencio.
        if (autoriza && tokens.length === 0) {
            console.error('\n✗ SE ACABARON LOS TOKENS VIVOS.');
            console.error(`  Sujetos ya creados y COBRANDO: ${sujetos.map((s) => s.slug).join(', ') || '(ninguno)'}`);
            console.error('  Volvé a correr la sonda 27 con CUANTOS=10 y después esta sonda de nuevo,');
            console.error('  pero SACANDO del PLAN los slugs de arriba para no duplicarlos.');
            if (sujetos.length) {
                writeFileSync(MANIFIESTO, JSON.stringify({ arrancado: new Date().toISOString(), parcial: true, sujetos }, null, 2));
                console.error(`  El manifiesto PARCIAL quedó en ${MANIFIESTO}:`);
                console.error(`  ${JSON.stringify(sujetos)}`);
            }
            process.exit(1);
        }
        console.log('    ⚠ no se creó: sigue con los demás');
        continue;
    }

    // RELECTURA — el ciclo diario y el monto se verifican acá, no por el 201 (§0)
    const x = await leer(id);
    console.log(
        `    RELECTURA: ${x?.status} · ARS ${x?.auto_recurring?.transaction_amount} · ${x?.auto_recurring?.frequency} ${x?.auto_recurring?.frequency_type} · next ${x?.next_payment_date ?? '—'} · end_date ${x?.auto_recurring?.end_date ?? '—'}`
    );
    if (autoriza && x?.auto_recurring?.frequency_type !== 'days')
        console.log(`    ⚠ PEDIMOS days Y QUEDÓ "${x?.auto_recurring?.frequency_type}" — el reloj no corre`);
    sujetos.push({ slug, id, mide, montoInicial: monto });
}

// --- las mutaciones que TIENEN que quedar hechas HOY --------------------------
// El sentido de cada una es qué hace el proveedor con ella EN EL CICLO
// SIGUIENTE. Aplicadas mañana, habría que esperar un día más.
const porSlug = (s) => sujetos.find((x) => x.slug === s)?.id;
const mutar = async (slug, patch, que) => {
    const id = porSlug(slug);
    if (!id) return console.log(`  (${slug} no existe: se saltea)`);
    const r = await pedir(`/preapproval/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    const x = await leer(id);
    console.log(`  ${slug.padEnd(14)} HTTP ${r.code} · ${que}`);
    console.log(
        `    → ${x?.status} · ARS ${x?.auto_recurring?.transaction_amount} · next ${x?.next_payment_date ?? '—'}`
    );
};

console.log('\n######## mutaciones de hoy (cada una se relee en el acto, §0)');
await mutar('monto-sube', { auto_recurring: { transaction_amount: 30, currency_id: 'ARS' } }, '15 → 30');
await mutar('monto-baja', { auto_recurring: { transaction_amount: 15, currency_id: 'ARS' } }, '30 → 15 (el piso)');
await mutar('pausa-real', { status: 'paused' }, 'PAUSAR');
await mutar('cancelada', { status: 'cancelled' }, 'CANCELAR');

// --- cuánto se cobró de verdad ----------------------------------------------
console.log('\n######## ¿cuánto se cobró HOY, de verdad?');
let total = 0;
for (const s of sujetos) {
    const c = await cobros(s.id);
    const suma = c.reduce((a, p) => a + Number(p.monto ?? 0), 0);
    total += suma;
    console.log(`  ${s.slug.padEnd(14)} ${c.length} cobro(s) · ARS ${suma}`);
}
console.log(`  ─────────────────────────`);
console.log(`  TOTAL COBRADO: ARS ${total} (autorizado: ${PRESUPUESTO_AUTORIZADO})`);
if (total > PRESUPUESTO_AUTORIZADO) console.log('  ⚠⚠ SE COBRÓ MÁS DE LO AUTORIZADO — avisar al owner YA');

// --- manifiesto --------------------------------------------------------------
const manifiesto = {
    arrancado: new Date().toISOString(),
    presupuestoAutorizado: PRESUPUESTO_AUTORIZADO,
    cobradoAlArrancar: total,
    sujetos
};
writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2));
console.log(`\n######## manifiesto en ${MANIFIESTO}`);
console.log('  COPIALO AL REPO: si se pierde, se pierde el experimento (RC-1: el search ignora');
console.log('  external_reference, así que no hay forma de volver a encontrarlos por referencia).\n');
console.log(JSON.stringify(manifiesto));
console.log('\n############ fin · leer a las 24 h con LEER=1');
