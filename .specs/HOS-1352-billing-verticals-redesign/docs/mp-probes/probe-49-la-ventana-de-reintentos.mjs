// =============================================================================
// SONDA 49 — ¿La ventana de reintentos es fija, o es el ciclo?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// No se importa desde ningún lado, no participa de ningún build, no se deploya.
//
// Programa: HOS-1352. Mide UNA cosa y nada más.
//
// QUÉ SE MIDIÓ EL 2026-09-21, Y QUÉ QUEDÓ SIN SABER
// -------------------------------------------------
// Leyendo `/authorized_payments/search` sobre los sujetos de producción del
// reloj apareció un campo que ningún capítulo del corpus nombra: `expire_date`.
// En los tres sujetos que el proveedor pausó solo, el preapproval pasó a
// `paused` entre 80 y 105 SEGUNDOS ANTES del `expire_date` de un cobro fallido
// con `retry_attempt: 4`.
//
//   renov-ok      creado 09-20T20:01:41  expire 09-21T20:01:41  pausa 20:00:20
//   monto-baja    idem                                          pausa 20:00:20
//   reembolso…    creado 09-20T22:01:54  expire 09-21T22:01:54  pausa 22:00:09
//
// El problema: LOS SUJETOS SON TODOS DE `frequency: 1 days`, así que
//
//     expire_date - date_created = 24 h        (medido)
//
// y ESO NO DISTINGUE dos hipótesis que dan predicciones opuestas:
//
//   (A) la ventana es FIJA de 24 h    → con un plan mensual el proveedor
//                                       igual se rinde al día siguiente
//   (B) la ventana es UN CICLO        → con un plan mensual aguanta un mes
//
// La diferencia decide si nuestro `GRACE_PERIOD` de 7 días es implementable
// (B) o si es una promesa que el proveedor no puede sostener (A).
//
// POR QUÉ NO SE PUDO RESPONDER CON LO QUE YA HABÍA
// ------------------------------------------------
// Se buscaron los 105 preapprovals de producción: los 14 que cobraron con
// `frequency` distinta de `1 days` son TODOS mensuales de julio y agosto, y
// NINGUNO trae `expire_date`. No sirve como control: puede ser la frecuencia
// o puede ser que el campo no existía entonces. Dos causas para el mismo vacío.
//
// Y hay un detalle que fija el diseño: `expire_date` NO aparece en el cobro
// del alta, sólo en las RENOVACIONES. Medido en `prueba de cobro rechazado`:
// el cobro del 09-17 (alta) viene sin él; los del 18, 19, 20 y 21 lo traen.
// Por eso esta sonda tiene dos partes separadas por el ciclo.
//
// EL SUJETO, Y POR QUÉ DOS DÍAS
// -----------------------------
// Un solo preapproval, `frequency: 2 days`, ARS 15. Dos días es el ciclo más
// corto que NO es 24 h, o sea el mínimo que separa (A) de (B): si la ventana
// sale 24 h, es fija; si sale 48 h, es el ciclo. No hace falta un mes, y no
// hace falta que nada falle.
//
// PRESUPUESTO, QUE ES LO QUE SE AUTORIZA
// --------------------------------------
//   alta (hoy)        ARS 15
//   renovación (+48h) ARS 15
//   ─────────────────────────
//   TOTAL             ARS 30   sobre la tarjeta real del owner
//
// La sonda ABORTA si el monto no es exactamente 15: un presupuesto autorizado
// vale para ese número, no para "más o menos ese número".
//
// USO
// ---
//   MP_ACCESS_TOKEN=$(cat ~/.mp-token-hos1352) node probe-49-la-ventana-de-reintentos.mjs crear
//   MP_ACCESS_TOKEN=$(cat ~/.mp-token-hos1352) node probe-49-la-ventana-de-reintentos.mjs leer
//
// `crear` se corre UNA vez. `leer` se corre a las 48 h — y se puede correr
// todas las veces que se quiera, no muta nada.
//
// Credenciales por entorno. NUNCA en el repo.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const PAGADOR = process.env.PAGADOR ?? 'qazuor@gmail.com';
// Un intento de alta cuyo cobro el proveedor RECHAZA deja el preapproval
// `cancelled` en ~83 s (medido el 2026-09-21 sobre `792eb0064a…`), y cancelar
// es irreversible (`PA-5`, `EX-3`). O sea que cada tarjeta que falla quema un
// sujeto y hay que crear otro: por eso el intento es parte del nombre y del
// manifiesto, en vez de una sonda que sólo se puede correr una vez.
const INTENTO = process.env.INTENTO ?? '';
const MANIFIESTO = process.env.MANIFIESTO ?? `/tmp/hos1352-sonda-49${INTENTO ? `-${INTENTO}` : ''}.json`;
const MONTO = 15;
const MODO = process.argv[2];

if (!TOKEN) {
    console.error('falta MP_ACCESS_TOKEN');
    process.exit(1);
}
if (!TOKEN.startsWith('APP_USR-')) {
    console.error(`✗ el token no es de producción (${TOKEN.slice(0, 8)}…). Los sujetos a medir son de producción.`);
    process.exit(1);
}
if (MONTO !== 15) {
    console.error('✗ el presupuesto autorizado es ARS 15 por cobro. Abortando.');
    process.exit(1);
}

const pedir = async (ruta, opciones = {}) => {
    const r = await fetch(`${API}${ruta}`, {
        ...opciones,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            ...(opciones.headers ?? {})
        }
    });
    let b = null;
    try {
        b = await r.json();
    } catch {
        /* sin cuerpo */
    }
    return { status: r.status, b };
};

const horas = (desde, hasta) => {
    if (!desde || !hasta) return null;
    return (new Date(hasta) - new Date(desde)) / 3600000;
};

// ---------------------------------------------------------------------------
// CREAR
// ---------------------------------------------------------------------------
if (MODO === 'crear') {
    if (existsSync(MANIFIESTO)) {
        console.error(`✗ ya hay un manifiesto en ${MANIFIESTO}.`);
        console.error('  Esta sonda se crea UNA vez. Para rehacerla, borralo a mano.');
        process.exit(1);
    }

    const cuerpo = {
        reason: `HOS1352 s49${INTENTO ? `${INTENTO}` : ''} ventana de reintentos`.slice(0, 60),
        payer_email: PAGADOR,
        back_url: 'https://www.hospeda.com.ar',
        external_reference: `HOS-1352-s49${INTENTO ? `-${INTENTO}` : ''}-ventana`,
        auto_recurring: {
            frequency: 2,
            frequency_type: 'days',
            transaction_amount: MONTO,
            currency_id: 'ARS'
        }
    };

    // Se crea PENDING y la autoriza el owner en el checkout, que es el camino
    // que `EX-33` midió en producción con tarjeta real. No se usa
    // `card_token_id` porque los tokens de /tmp son de otras sondas y pueden
    // estar gastados (`EX-12`), y un token gastado acá deja la sonda sin sujeto.
    const r = await pedir('/preapproval', { method: 'POST', body: JSON.stringify(cuerpo) });
    if (!r.b?.id) {
        console.error(`✗ no se creó: ${r.status}`);
        console.error(JSON.stringify(r.b, null, 2));
        process.exit(1);
    }

    const manifiesto = {
        sonda: 49,
        creado: new Date().toISOString(),
        entorno: 'produccion',
        pagador: PAGADOR,
        presupuestoAutorizado: 'ARS 30 (alta 15 + renovación 15)',
        id: r.b.id,
        frecuenciaPedida: '2 days',
        init_point: r.b.init_point ?? null
    };
    writeFileSync(MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`, { mode: 0o600 });

    console.log('\n############ SONDA 49 — creada');
    console.log(`  id:     ${r.b.id}`);
    console.log(`  estado: ${r.b.status}`);
    console.log(`  ciclo:  ${r.b.auto_recurring?.frequency} ${r.b.auto_recurring?.frequency_type}`);
    console.log(`  monto:  ARS ${r.b.auto_recurring?.transaction_amount}`);
    console.log(`  manifiesto: ${MANIFIESTO}`);

    // `EX-4` midió que el proveedor IGNORA la frecuencia pedida y deja 1 en
    // silencio, con `200`. Si pasa acá, la sonda entera no mide nada: su único
    // sujeto sería otro `1 days` y las dos hipótesis volverían a ser
    // indistinguibles. Se avisa fuerte en vez de dejarlo pasar.
    if (r.b.auto_recurring?.frequency !== 2 || r.b.auto_recurring?.frequency_type !== 'days') {
        console.log('\n  ⚠⚠ PEDIMOS «2 days» Y QUEDÓ ' +
            `«${r.b.auto_recurring?.frequency} ${r.b.auto_recurring?.frequency_type}» — es EX-4.`);
        console.log('     La sonda NO puede medir con este sujeto: cancelalo y avisá.');
    }

    console.log(`\n  AUTORIZAR ACÁ (tarjeta real, ARS ${MONTO} hoy):`);
    console.log(`  ${r.b.init_point ?? '(sin init_point — ver EX-37)'}\n`);
    console.log('  Después de autorizar, esperar 48 h y correr:  node probe-49-la-ventana-de-reintentos.mjs leer\n');
    process.exit(0);
}

// ---------------------------------------------------------------------------
// LEER
// ---------------------------------------------------------------------------
if (MODO === 'leer') {
    if (!existsSync(MANIFIESTO)) {
        console.error(`✗ no hay manifiesto en ${MANIFIESTO} — ¿corrió «crear»?`);
        process.exit(1);
    }
    const m = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));

    const pre = await pedir(`/preapproval/${m.id}`);
    const x = pre.b ?? {};
    console.log('\n############ SONDA 49 — lectura ' + new Date().toISOString());
    console.log(`  ${x.reason} · ${x.status}`);
    console.log(`  ciclo: ${x.auto_recurring?.frequency} ${x.auto_recurring?.frequency_type} · ARS ${x.auto_recurring?.transaction_amount}`);
    console.log(`  next_payment_date: ${x.next_payment_date ?? '—'}`);
    console.log(`  summarized: charged_quantity=${x.summarized?.charged_quantity ?? '—'} charged_amount=${x.summarized?.charged_amount ?? '—'} last_charged_date=${x.summarized?.last_charged_date ?? '—'}`);

    const ap = await pedir(`/authorized_payments/search?preapproval_id=${m.id}`);
    const filas = ap.b?.results ?? [];
    console.log(`\n  cobros: ${filas.length}`);

    let veredicto = null;
    for (const f of filas) {
        const p = f.payment ?? {};
        const v = horas(f.date_created, f.expire_date);
        console.log(
            `   ${String(f.date_created ?? '').slice(0, 19)} · ${p.status ?? '—'}/${p.status_detail ?? '—'}` +
            ` · retry=${f.retry_attempt ?? '—'} · expire=${String(f.expire_date ?? '—').slice(0, 19)}` +
            (v === null ? ' · ventana=—' : ` · VENTANA=${v.toFixed(1)} h`)
        );
        // El cobro del alta no trae `expire_date`: el veredicto sale de la
        // primera RENOVACIÓN que lo traiga.
        if (v !== null && veredicto === null) veredicto = v;
    }

    console.log('');
    if (veredicto === null) {
        console.log('  SIN VEREDICTO todavía: ninguna fila trae `expire_date`.');
        console.log('  Si ya pasaron 48 h y hay 2 cobros, entonces `expire_date` NO es de las');
        console.log('  renovaciones sino de algo más, y eso es un hallazgo por sí mismo.');
    } else if (veredicto < 36) {
        console.log(`  VEREDICTO → (A) LA VENTANA ES FIJA: ${veredicto.toFixed(1)} h sobre un ciclo de 48 h.`);
        console.log('  El proveedor se rinde al día siguiente sin importar el plan.');
        console.log('  Consecuencia: un `GRACE_PERIOD` de 7 días NO lo sostiene el proveedor.');
    } else {
        console.log(`  VEREDICTO → (B) LA VENTANA ES EL CICLO: ${veredicto.toFixed(1)} h sobre un ciclo de 48 h.`);
        console.log('  Con un plan mensual el proveedor aguantaría el mes entero.');
        console.log('  Consecuencia: el `GRACE_PERIOD` es implementable y hay que atarlo al ciclo.');
    }
    console.log('');
    process.exit(0);
}

console.error('uso: node probe-49-la-ventana-de-reintentos.mjs crear|leer');
process.exit(1);
