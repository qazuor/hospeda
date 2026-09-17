#!/usr/bin/env node
/**
 * SONDA 45 — la tarjeta sin saldo
 * HOS-1352 · FASE 1C · 2026-09-17 · PRODUCCIÓN
 *
 * QUÉ PREGUNTA
 *   `RN-2` (cobro fallido) y las cuatro que cuelgan de ella: `RN-3`, `GR-1`, `GR-2` y
 *   sobre todo **`GR-3`, la política de reintentos del proveedor**, que es la que gobierna
 *   el capítulo 12 de la Master Spec.
 *
 * POR QUÉ EN PRODUCCIÓN, Y POR QUÉ ASÍ
 *   **En sandbox no se puede.** Está medido, no supuesto: la [sonda 47] probó los SIETE
 *   titulares de prueba en el camino de creación Y en el de mutación — `402` los siete, con
 *   control `APRO` que sí aplica. `PC-2` cierra el monto impagable por arriba y por abajo.
 *   Y el CLI oficial (`mpcli tester card add --scenario insufficient_funds`) exige el token
 *   del propio usuario de prueba, que exige una cuenta productiva para crearse.
 *
 *   El primer intento en producción fue `apagon` ([sonda 43]): una tarjeta real que el owner
 *   apaga desde el home banking. **Se cayó el 2026-09-17**: el propio home banking avisa que
 *   **los débitos automáticos se siguen cobrando aunque la tarjeta esté pausada**.
 *
 *   Por eso esta sonda no depende de la política de nadie: **la tarjeta tiene menos plata que
 *   el cobro.** El rechazo lo garantiza la aritmética.
 *
 * EL MECANISMO, EN ORDEN
 *   1. el owner carga una prepaga/virtual con ~ARS 20 — el número de tarjeta **nunca** pasa
 *      por acá: lo carga él en el checkout;
 *   2. esta sonda crea un `preapproval` **pendiente** de ARS 500, ciclo diario, y devuelve el
 *      `init_point` **saneado**;
 *   3. el owner autoriza. La validación de ARS 0 pasa: en cero no hay nada que fondear;
 *   4. el primer cobro real —ARS 500 contra ARS 20— **rechaza**. Y ahí se leen las cinco filas.
 *
 * EL `init_point` VIENE ROTO Y SE SANEA
 *   `EX-37` **`NOT_SUPPORTED`**: la URL que entrega la API trae `&activation=true` y abre
 *   «Esta página no existe». La misma sin el parámetro abre el checkout normal. Esta sonda
 *   imprime **la saneada**, nunca la cruda.
 *
 * GUARDS
 *   · **presupuesto**: `PRESUPUESTO_AUTORIZADO = 500`, autorizado por el owner el 2026-09-17.
 *     Aborta si el máximo a cobrar no da **exactamente** ese número.
 *   · **entorno**: aborta si el token no resuelve a la cuenta productiva declarada.
 *   · **exposición real**: ARS 500, y sólo si la aritmética falla — que es lo que se va a medir.
 *
 * USO — desde el VPS, dentro del contenedor de la API, que es donde vive el token
 *   B64=$(base64 -w0 probe-45-la-tarjeta-sin-saldo.mjs)
 *   ssh -p 2222 qazuor@216.238.103.219 "bash -lc \"hops --target=prod exec api -- sh -c \
 *     'echo $B64 | base64 -d > /tmp/p45.mjs && node /tmp/p45.mjs'\""
 *
 * EL MANIFIESTO NO ES OPCIONAL
 *   `RC-1` midió que el buscador del proveedor **IGNORA** `external_reference`. Sin guardar
 *   el id, el sujeto es irrecuperable. Se escribe a /tmp Y se imprime, porque el directorio
 *   temporal NO sobrevive a un redeploy y el que sirve es el que queda en el repo.
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const MANIFIESTO = '/tmp/hos1352-tarjeta-sin-saldo.json';

/** La cuenta productiva de Hospeda. Si no coincide, no corre. */
const CUENTA_ESPERADA = 3497516165;
/** El pagador es la cuenta personal del owner, distinta del colector. */
const PAGADOR = 'qazuor@gmail.com';

const MONTO = 500;
const CICLO_DIAS = 1;
/** Autorizado por el owner el 2026-09-17. Un número exacto, no un orden de magnitud. */
const PRESUPUESTO_AUTORIZADO = 500;

async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        /* un cuerpo vacío también es una respuesta */
    }
    return { status: res.status, json };
}

/** `EX-37`: la URL cruda abre «Esta página no existe». Sin el parámetro, abre el checkout. */
const sanear = (url) =>
    typeof url === 'string' ? url.replace(/[?&]activation=true\b/, (m) => (m[0] === '?' ? '?' : '')) : url;

async function main() {
    if (!TOKEN) {
        console.error('✗ no hay token en el entorno del contenedor. ABORTA.');
        process.exit(2);
    }

    // ── GUARD DE PRESUPUESTO ──────────────────────────────────────────────────
    // Un solo sujeto, un ciclo. El máximo que este script puede llegar a cobrar hoy.
    const maximoHoy = MONTO * 1;
    if (maximoHoy !== PRESUPUESTO_AUTORIZADO) {
        console.error(
            `✗ ABORTA: el máximo a cobrar hoy da ARS ${maximoHoy} y lo autorizado es ARS ${PRESUPUESTO_AUTORIZADO}.`
        );
        process.exit(3);
    }

    // ── GUARD DE ENTORNO ──────────────────────────────────────────────────────
    const me = await api('/users/me');
    if (me.status !== 200 || me.json?.id !== CUENTA_ESPERADA) {
        console.error(
            `✗ ABORTA: el token no resuelve a la cuenta productiva esperada (${CUENTA_ESPERADA}). ` +
                `Devolvió ${me.status} / id=${me.json?.id}.`
        );
        process.exit(4);
    }
    console.log(`✓ guard de entorno: ${me.json.nickname} (${me.json.id}) — PRODUCCIÓN`);
    console.log(`✓ guard de presupuesto: máximo ARS ${maximoHoy}, autorizado ARS ${PRESUPUESTO_AUTORIZADO}`);

    const externalReference = `HOS-1352-sin-saldo-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;

    const creacion = await api('/preapproval', {
        method: 'POST',
        body: {
            reason: 'Hospeda — prueba de cobro rechazado (HOS-1352)',
            external_reference: externalReference,
            payer_email: PAGADOR,
            back_url: 'https://hospeda.com.ar',
            status: 'pending',
            auto_recurring: {
                frequency: CICLO_DIAS,
                frequency_type: 'days',
                transaction_amount: MONTO,
                currency_id: 'ARS'
            }
        }
    });

    console.log(`\n############ POST /preapproval → HTTP ${creacion.status}`);
    if (creacion.status !== 201 || !creacion.json?.id) {
        console.error('✗ no se creó. Respuesta:');
        console.error(JSON.stringify(creacion.json, null, 2));
        process.exit(5);
    }

    const id = creacion.json.id;

    // ── D5: NINGÚN CÓDIGO DE ESTADO CIERRA NADA. SE RELEE. ────────────────────
    const relectura = await api(`/preapproval/${id}`);
    const sub = relectura.json ?? {};

    const manifiesto = {
        creado: new Date().toISOString(),
        entorno: 'produccion',
        cuenta: `${me.json.nickname} (${me.json.id})`,
        pagador: PAGADOR,
        monto_por_ciclo: MONTO,
        ciclo: `${CICLO_DIAS} days`,
        presupuestoAutorizado: PRESUPUESTO_AUTORIZADO,
        nota: 'RC-1: el search IGNORA external_reference. Sin este id no hay forma de reencontrar el sujeto.',
        sujetos: [{ slug: 'sin-saldo', id, external_reference: externalReference }]
    };
    try {
        writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2));
        console.log(`✓ manifiesto → ${MANIFIESTO}`);
    } catch (e) {
        console.log(`⚠ no se pudo escribir el manifiesto (${e.message}) — el de abajo es el que vale`);
    }

    console.log('\n############ EL SUJETO');
    console.log(`  id                  ${id}`);
    console.log(`  external_reference  ${externalReference}`);
    console.log(`  status (relectura)  ${sub.status}`);
    console.log(`  monto               ARS ${sub.auto_recurring?.transaction_amount}`);
    console.log(`  ciclo               ${sub.auto_recurring?.frequency} ${sub.auto_recurring?.frequency_type}`);

    console.log('\n############ EL LINK PARA AUTORIZAR — saneado (EX-37)');
    console.log(`  ${sanear(creacion.json.init_point)}`);

    console.log('\n############ MANIFIESTO, COPIAR AL REPO');
    console.log('  /tmp no sobrevive a un redeploy. Este bloque es el que sirve:');
    console.log(JSON.stringify(manifiesto, null, 2));

    console.log('\n############ QUÉ SIGUE');
    console.log('  1. el owner autoriza con la prepaga cargada con ~ARS 20;');
    console.log('  2. la validación de ARS 0 pasa — en cero no hay nada que fondear;');
    console.log('  3. el primer cobro de ARS 500 rechaza, ~26 min después (PA-3);');
    console.log('  4. se relee para medir RN-2, RN-3, GR-1, GR-2 y GR-3.');
}

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
