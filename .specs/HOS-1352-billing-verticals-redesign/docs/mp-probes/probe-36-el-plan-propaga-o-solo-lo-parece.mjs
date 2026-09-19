#!/usr/bin/env node
// =============================================================================
// SONDA 36 — ¿El plan propaga el monto de verdad, o sólo lo parece?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352. Se ARRANCA hoy y se LEE mañana, junto con el reloj.
//
// QUÉ QUEDÓ SIN CERRAR EN LAS SONDAS 33 A 35
// ------------------------------------------
// Está medido que al editar el monto de un plan, la relectura de sus
// suscripciones YA AUTORIZADAS devuelve el monto nuevo: un testigo que nadie
// tocó pasó de 2000 a 2500 y después a 15. Tres puntos, sobre dos suscriptos.
//
// Y está medido que el CICLO no hace lo mismo: con el plan en `2 months`, los
// dos suscriptos siguen leyéndose en `1 months`.
//
// Esa asimetría admite DOS explicaciones que hoy no se distinguen, y que llevan
// a diseños opuestos:
//
//   (i)  PROPAGA — el proveedor reescribe la suscripción, y mañana cobra el
//        monto nuevo. Entonces existe un cambio de precio MASIVO por plan, que
//        `DEC-MP-001` no consideró (hoy decide mutar suscripción por
//        suscripción) y que sería mucho más barato de operar.
//   (ii) LO REFLEJA — la suscripción no tiene monto propio y la lectura lo va
//        a buscar al plan, pero el cobro sale de otro lado. Entonces la
//        relectura —la única herramienta con la que este programa verifica
//        TODO— estaría diciendo algo que no es el monto que se cobra, y eso es
//        más grave que el hallazgo en sí.
//
// NINGUNA LECTURA DISTINGUE (i) DE (ii). Sólo lo hace un cobro ejecutado.
//
// EL EXPERIMENTO
// --------------
// Dos planes DIARIOS —el ciclo diario en planes quedó verificado por la sonda
// 34, control `C1`— con una suscripción autorizada cada uno:
//
//   `sujeto-editado`  nace a ARS 2000 y su plan se sube a ARS 3300 EN EL ACTO,
//                     antes del primer cobro.
//   `sujeto-control`  nace a ARS 2000 y no se toca nunca.
//
// Mañana, el cobro de `sujeto-editado` responde la pregunta y no deja lugar a
// interpretación:
//
//   cobró 3300  → PROPAGA. La relectura decía la verdad.
//   cobró 2000  → LO REFLEJA. La relectura miente sobre el monto que se cobra,
//                 y eso alcanza a TODA la verificación hecha sobre planes.
//
// `sujeto-control` es el que hace legible al otro: si mañana no cobrara nada,
// sin control no se sabría si el ciclo diario de los planes no ejecuta o si la
// edición rompió algo.
//
// EL MONTO 3300 ES A PROPÓSITO: no es 2000, no es 2500, no es 15 y no es 3000.
// Ninguno de los sujetos anteriores puede confundirse con éste al leer mañana.
//
// SIN COSTO: sandbox. No toca los 8 sujetos del reloj ni su manifiesto
// (`/tmp/mp-probe-05/manifiesto.json`). Los ids quedan en el manifiesto de la
// 33, que es también la lista a EXCLUIR al leer el sink de webhooks.
//
// ARRANCAR:
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-33 node probe-36-el-plan-propaga-o-solo-lo-parece.mjs
//
// LEER MAÑANA (a partir de ~24 h):
//   source ~/.config/hospeda/mp-sandbox-creds.sh && \
//     OUT_DIR=/tmp/mp-probe-33 LEER=1 node probe-36-el-plan-propaga-o-solo-lo-parece.mjs
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-33';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const BUYER = process.env.MP_BUYER_EMAIL;
const LEER = process.env.LEER === '1';
const BACK_URL = 'https://www.hospeda.com.ar';
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

if (!TOKEN || !BUYER) {
    console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL — hay que hacer `source` de las credenciales');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const RUTA_MANIFIESTO = join(OUT, 'manifiesto-36.json');
const guardar = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

async function llamar(nombre, metodo, ruta, cuerpo) {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const texto = await res.text();
    let json;
    try {
        json = JSON.parse(texto);
    } catch {
        json = { __no_era_json: texto.slice(0, 400) };
    }
    if (cuerpo) {
        const copia = { ...cuerpo };
        if (copia.card_token_id) copia.card_token_id = '(redactado)';
        guardar(`${nombre}.request`, { metodo, ruta, cuerpo: copia });
    }
    guardar(`${nombre}.response`, { http: res.status, cuerpo: json });
    return { http: res.status, body: json };
}

async function tokenizar() {
    const res = await fetch(`${API}/v1/card_tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            card_number: '5031755734530604',
            security_code: '123',
            expiration_month: 11,
            expiration_year: 2030,
            cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } }
        })
    });
    return (await res.json())?.id ?? null;
}

const foto = (j) =>
    JSON.stringify({
        status: j?.status ?? null,
        monto_leido: j?.auto_recurring?.transaction_amount ?? null,
        ciclo: j?.auto_recurring ? `${j.auto_recurring.frequency} ${j.auto_recurring.frequency_type}` : null,
        cobros: j?.summarized?.charged_quantity ?? null,
        cobrado_total: j?.summarized?.charged_amount ?? null,
        ultimo_cobro: j?.summarized?.last_charged_amount ?? null,
        next_payment_date: j?.next_payment_date ?? null
    });

// =============================================================================
// MODO LECTURA — mañana
// =============================================================================
if (LEER) {
    if (!existsSync(RUTA_MANIFIESTO)) {
        console.error(`no está ${RUTA_MANIFIESTO}: sin el manifiesto no hay forma de encontrar los sujetos`);
        console.error('(`RC-1`: el search de preapprovals ignora external_reference en silencio)');
        process.exit(1);
    }
    const m = JSON.parse(readFileSync(RUTA_MANIFIESTO, 'utf8'));
    console.log(`############ SONDA 36 — LECTURA · ${new Date().toISOString()}`);
    console.log(`############ arrancada: ${m.arrancado} · esperado: ${m.esperado}\n`);

    for (const s of m.sujetos) {
        const sub = await llamar(`lectura-${s.slug}`, 'GET', `/preapproval/${s.id}`);
        const plan = await llamar(`lectura-${s.slug}.plan`, 'GET', `/preapproval_plan/${s.plan_id}`);
        const pagos = await llamar(`lectura-${s.slug}.pagos`, 'GET', `/authorized_payments/search?preapproval_id=${s.id}`);
        console.log(`=== ${s.slug}  (nació a ARS ${s.monto_alta}${s.editado_a ? `, plan editado a ARS ${s.editado_a}` : ', sin editar'})`);
        console.log(`    suscripción: ${foto(sub.body)}`);
        console.log(`    plan:        monto=${plan.body?.auto_recurring?.transaction_amount ?? '—'}`);
        const cobros = pagos.body?.results ?? [];
        if (cobros.length === 0) {
            console.log('    cobros:      NINGUNO todavía');
            console.log('                 (`/authorized_payments` devuelve cero por tres razones distintas:');
            console.log('                  no cobró nunca, lag del proveedor, o el id es de otra cuenta)');
        }
        for (const c of cobros) {
            console.log(
                `    cobro:       ARS ${c.transaction_amount} · ${c.status}/${c.status_detail} · ${c.date_created}`
            );
        }
    }
    console.log(`
############ CÓMO SE LEE ESTO

  El sujeto EDITADO nació a ARS 2000 y su plan se subió a ARS 3300 antes de
  cobrar. Su primer cobro decide:

     ARS 3300  → el plan PROPAGA de verdad. Existe un cambio de precio masivo.
     ARS 2000  → el plan sólo lo REFLEJA en la lectura. La relectura no dice
                 el monto que se cobra, y eso alcanza a toda verificación
                 hecha sobre planes.

  El sujeto CONTROL tiene que haber cobrado ARS 2000. Si no cobró nada, el
  ciclo diario de los planes no ejecuta y el sujeto editado no dice nada:
  entonces el hallazgo es OTRO y hay que registrarlo como tal, no forzar una
  conclusión sobre el monto.
`);
    process.exit(0);
}

// =============================================================================
// MODO ARRANQUE — hoy
// =============================================================================
console.log(`############ SONDA 36 — ARRANQUE · ${new Date().toISOString()}`);

async function armar(slug, montoAlta, editarA) {
    const plan = await llamar(`36-${slug}.plan`, 'POST', '/preapproval_plan', {
        reason: `HOS1352 s36 ${slug}`,
        back_url: BACK_URL,
        auto_recurring: { frequency: 1, frequency_type: 'days', transaction_amount: montoAlta, currency_id: 'ARS' }
    });
    if (!plan.body?.id) {
        console.log(`\n=== ${slug}: el plan no se creó · HTTP ${plan.http} · ${plan.body?.message}`);
        return null;
    }

    const tok = await tokenizar();
    if (!tok) {
        console.log(`\n=== ${slug}: NO SE PUDO TOKENIZAR`);
        return null;
    }
    const sub = await llamar(`36-${slug}.sub`, 'POST', '/preapproval', {
        preapproval_plan_id: plan.body.id,
        reason: `HOS1352 s36 ${slug}`,
        payer_email: BUYER,
        back_url: BACK_URL,
        external_reference: `HOS-1352-s36-${STAMP}-${slug}`,
        card_token_id: tok,
        status: 'authorized'
    });
    if (!sub.body?.id) {
        console.log(`\n=== ${slug}: la suscripción no se creó · HTTP ${sub.http} · ${sub.body?.message}`);
        return null;
    }

    const alta = await llamar(`36-${slug}.sub.relectura-alta`, 'GET', `/preapproval/${sub.body.id}`);
    console.log(`\n=== ${slug}  · plan ${plan.body.id} · sub ${sub.body.id}`);
    console.log(`    al alta:  ${foto(alta.body)}`);

    if (editarA) {
        const put = await llamar(`36-${slug}.plan.editar`, 'PUT', `/preapproval_plan/${plan.body.id}`, {
            auto_recurring: { transaction_amount: editarA, currency_id: 'ARS' }
        });
        const relPlan = await llamar(`36-${slug}.plan.relectura`, 'GET', `/preapproval_plan/${plan.body.id}`);
        const relSub = await llamar(`36-${slug}.sub.relectura-post`, 'GET', `/preapproval/${sub.body.id}`);
        console.log(`    PUT plan → ARS ${editarA}: HTTP ${put.http} · el plan quedó en ${relPlan.body?.auto_recurring?.transaction_amount}`);
        console.log(`    la sub ahora se LEE: ${foto(relSub.body)}`);
        console.log('    ↑ esto es la lectura. Lo que se cobre mañana es el hecho.');
    }

    return { slug, id: sub.body.id, plan_id: plan.body.id, monto_alta: montoAlta, editado_a: editarA ?? null };
}

const sujetos = [];
const editado = await armar('sujeto-editado', 2000, 3300);
if (editado) sujetos.push(editado);
const control = await armar('sujeto-control', 2000, null);
if (control) sujetos.push(control);

const manifiesto = {
    sonda: 36,
    entorno: 'sandbox',
    arrancado: new Date().toISOString(),
    esperado: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    sujetos
};
writeFileSync(RUTA_MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`);

console.log(`\n\n############ manifiesto → ${RUTA_MANIFIESTO}`);
for (const s of sujetos) console.log(`  ${s.slug.padEnd(16)} sub=${s.id} plan=${s.plan_id}`);
console.log(`
############ FIN — volver en ~24 h

    source ~/.config/hospeda/mp-sandbox-creds.sh && \\
      OUT_DIR=${OUT} LEER=1 node probe-36-el-plan-propaga-o-solo-lo-parece.mjs

  El manifiesto vive en /tmp y NO sobrevive a un reinicio. Copiarlo al repo
  ANTES de cerrar la sesión: sin él se pierde el experimento, porque el search
  de preapprovals ignora \`external_reference\` (\`RC-1\`).
`);
