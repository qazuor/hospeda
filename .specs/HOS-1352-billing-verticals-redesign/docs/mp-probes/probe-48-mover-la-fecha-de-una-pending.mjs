#!/usr/bin/env node
// =============================================================================
// SONDA 48 — ¿Se puede mover la fecha de cobro de un preapproval `pending`?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352, FASE 9, decisión `D-16`. Sandbox, sin tarjeta real.
//
// POR QUÉ EXISTE
// --------------
// `DEC-SUB-006` computa el crédito del cambio de plan AL CREAR la sucesora. La
// ventana de autorización dura 72 h (cap. 03 §3.4), así que si la predecesora
// RENUEVA dentro de esa ventana, el crédito ya calculado quedó corto por un
// ciclo entero. Corregirlo exige mover la fecha de cobro de la sucesora, que en
// ese momento está `pending`.
//
// Lo único medido es `EX-34`: la fecha de una suscripción viva es INMUTABLE, y
// falla EN SILENCIO — cuatro formas de pedirlo, los cuatro `200`, y
// `last_modified` CONGELADO en los cuatro. Pero eso se midió sobre una
// suscripción **autorizada**. Sobre una `pending` NADIE LO MIDIÓ.
//
// No es lo mismo y hay razón para dudar: `EX-33` ya mostró que una `pending`
// acepta cosas que una autorizada no, y el propio `EX-34` concluye que
// `start_date` sirve «sólo al crear».
//
// QUÉ SE MIDE
// -----------
//   A1  `PUT` con `auto_recurring.start_date` suelto.
//   A2  `PUT` con `next_payment_date` suelto.
//   A3  `PUT` con el `auto_recurring` COMPLETO y la fecha nueva adentro.
//
// EL CONTROL, Y NO ES OPCIONAL
// ----------------------------
//   C1  `PUT` de `transaction_amount` sobre el MISMO sujeto, después de los
//       tres intentos. Es lo que separa «la fecha no se puede mover» de «este
//       objeto no acepta nada». `EX-34` lo usó y fue lo que volvió concluyente
//       su medición: el monto entró y movió `last_modified`, así que lo
//       bloqueado eran las FECHAS y no el objeto.
//
// CÓMO SE LEE EL RESULTADO
// ------------------------
// **El código de estado NO cierra nada** — es `D5`: «toda mutación en el
// proveedor se verifica releyendo y comparando campo por campo». Un `200` con
// `last_modified` congelado es un NO disfrazado, y es exactamente el modo de
// falla que este proveedor ya tuvo dos veces en este programa.
//
// USO
// ---
//   MP_ACCESS_TOKEN=<token de SANDBOX> node probe-48-mover-la-fecha-de-una-pending.mjs
//
// Crea su propio sujeto y no toca ninguno existente. No autoriza nada, así que
// no hay checkout ni tarjeta: un `pending` se crea y se queda ahí.
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-48';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const CONFIRMADO = process.env.MP_SONDA_OK;

if (!TOKEN) {
    console.error('Falta MP_ACCESS_TOKEN (sandbox). No se corre nada.');
    process.exit(1);
}
// El guard NO puede ser sintáctico: las credenciales de una app de pruebas son
// `APP_USR-` igual que las de producción, así que el prefijo no distingue nada.
// En su lugar: confirmación explícita de quien lanza, y la cuenta queda escrita
// en la bitácora antes de que se cree ningún sujeto.
if (CONFIRMADO !== '1') {
    console.error('Falta la confirmación de que el token es el de la app de pruebas.');
    console.error('El prefijo no alcanza: una app de pruebas usa APP_USR- igual que producción.');
    process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const bitacora = [];

const enDias = (n) => new Date(Date.now() + n * 86400_000).toISOString();

async function llamar(nombre, metodo, ruta, cuerpo) {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    const texto = await res.text();
    let body;
    try {
        body = JSON.parse(texto);
    } catch {
        body = texto;
    }
    const registro = { nombre, metodo, ruta, http: res.status, cuerpo, body };
    bitacora.push(registro);
    return registro;
}

/** Lo que hay que mirar de un preapproval para esta sonda. */
const foto = (b) => ({
    status: b?.status,
    start_date: b?.auto_recurring?.start_date,
    next_payment_date: b?.next_payment_date,
    transaction_amount: b?.auto_recurring?.transaction_amount,
    last_modified: b?.last_modified
});

async function intentar(nombre, id, parche) {
    const antes = await llamar(`${nombre}.antes`, 'GET', `/preapproval/${id}`);
    const put = await llamar(nombre, 'PUT', `/preapproval/${id}`, parche);
    const desp = await llamar(`${nombre}.despues`, 'GET', `/preapproval/${id}`);

    const a = foto(antes.body);
    const d = foto(desp.body);
    const movio = a.last_modified !== d.last_modified;
    const fechaCambio = a.next_payment_date !== d.next_payment_date || a.start_date !== d.start_date;

    console.log(`\n--- ${nombre}  ·  HTTP ${put.http}`);
    if (put.http >= 400) {
        console.log(`    mensaje: ${put.body?.message ?? JSON.stringify(put.body)}`);
    }
    console.log(`    last_modified movió: ${movio ? 'SÍ' : 'NO'}`);
    console.log(`    la fecha cambió:     ${fechaCambio ? 'SÍ' : 'NO'}`);
    console.log(`    antes:   ${JSON.stringify(a)}`);
    console.log(`    después: ${JSON.stringify(d)}`);

    // El veredicto NO es el código de estado. Es D5: releer y comparar.
    if (put.http < 400 && !fechaCambio) {
        console.log('    ⚠️  DOSCIENTOS QUE NO APLICÓ — el modo de falla conocido de este proveedor.');
    }
    return { nombre, http: put.http, movio, fechaCambio, antes: a, despues: d };
}

async function main() {
    console.log('SONDA 48 — mover la fecha de un preapproval `pending`. Sandbox.\n');

    // Queda escrito contra qué cuenta se midió, ANTES de crear ningún sujeto.
    // Si esto no es la app de pruebas, se ve acá y se corta a mano.
    const yo = await llamar('quien-soy', 'GET', '/users/me');
    console.log(`cuenta: id=${yo.body?.id}  nick=${yo.body?.nickname}  site=${yo.body?.site_id}`);

    // El sujeto: un preapproval PENDING con fecha futura. Sin `card_token_id`,
    // así que nace `pending` y se queda ahí: no se autoriza nada.
    const creado = await llamar('crear', 'POST', '/preapproval', {
        reason: 'HOS-1352 sonda 48 — pending con fecha futura',
        external_reference: `hos1352-p48-${Date.now()}`,
        payer_email: `test_user_${Date.now()}@testuser.com`,
        back_url: 'https://www.hospeda.com.ar/',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            start_date: enDias(10),
            transaction_amount: 2000,
            currency_id: 'ARS'
        },
        status: 'pending'
    });

    if (creado.http >= 400) {
        console.error(`No se pudo crear el sujeto: HTTP ${creado.http}`);
        console.error(JSON.stringify(creado.body, null, 2));
        writeFileSync(join(OUT, 'bitacora.json'), JSON.stringify(bitacora, null, 2));
        process.exit(1);
    }

    const id = creado.body.id;
    console.log(`sujeto creado: ${id}  ·  status: ${creado.body.status}`);
    console.log(`foto inicial: ${JSON.stringify(foto(creado.body))}\n`);

    if (creado.body.status !== 'pending') {
        console.log(`⚠️  El sujeto NO nació 'pending' sino '${creado.body.status}'.`);
        console.log('    La sonda mide otra cosa entonces. Se sigue igual y se anota.');
    }

    const r = [];
    r.push(await intentar('A1.start_date-suelto', id, { auto_recurring: { start_date: enDias(20) } }));
    r.push(await intentar('A2.next_payment_date', id, { next_payment_date: enDias(25) }));
    r.push(
        await intentar('A3.auto_recurring-completo', id, {
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                start_date: enDias(30),
                transaction_amount: 2000,
                currency_id: 'ARS'
            }
        })
    );

    // El control. Sin esto la medición no separa «la fecha no se mueve» de
    // «este objeto no acepta nada».
    const c1 = await intentar('C1.control-monto', id, {
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 2500,
            currency_id: 'ARS'
        }
    });

    writeFileSync(join(OUT, 'bitacora.json'), JSON.stringify(bitacora, null, 2));

    console.log('\n===================== VEREDICTO =====================');
    const alguna = r.some((x) => x.fechaCambio);
    const controlEntro = c1.movio || c1.despues.transaction_amount === 2500;

    if (alguna) {
        console.log('La fecha de una `pending` SÍ se puede mover.');
        console.log('→ Hay salida limpia para el crédito corto de D-16.');
    } else if (!controlEntro) {
        console.log('NO CONCLUYENTE: el control tampoco entró.');
        console.log('→ El objeto no acepta NINGUNA mutación; no se puede afirmar nada');
        console.log('  sobre las fechas en particular. Hay que repetir con otro sujeto.');
    } else {
        console.log('La fecha de una `pending` NO se puede mover, y el control SÍ entró.');
        console.log('→ Lo bloqueado son las FECHAS, no el objeto. Mismo resultado que EX-34');
        console.log('  sobre una autorizada: la inmutabilidad no depende del estado.');
        console.log('→ D-16 se resuelve con la ventana corta, no con una corrección.');
    }
    console.log(`\nbitácora completa: ${join(OUT, 'bitacora.json')}`);
    console.log(`sujeto: ${id}  (queda en sandbox, no hace falta limpiarlo)`);
}

main().catch((e) => {
    console.error(e);
    writeFileSync(join(OUT, 'bitacora.json'), JSON.stringify(bitacora, null, 2));
    process.exit(1);
});
