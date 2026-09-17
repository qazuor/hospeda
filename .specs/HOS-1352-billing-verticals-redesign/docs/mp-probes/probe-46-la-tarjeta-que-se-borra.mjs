#!/usr/bin/env node
/**
 * SONDA 46 — la tarjeta que se borra
 * HOS-1352 · FASE 1C · 2026-09-17 · PRODUCCIÓN
 *
 * QUÉ PREGUNTA
 *   `RN-2` (cobro fallido), y con ella `RN-3`, `GR-1`, `GR-2` y sobre todo **`GR-3`, la
 *   política de reintentos del proveedor** — la que gobierna el capítulo 12.
 *
 * LA IDEA, Y ES DEL OWNER
 *   Suscribirse con una tarjeta guardada en Mercado Pago **y después borrarla de la cuenta**.
 *   Es la primera de siete que no depende de conseguir un medio de pago especial: usa una
 *   tarjeta normal y le saca el piso después.
 *
 *   **Los tres desenlaces enseñan algo**, que es lo que faltaba en los seis intentos previos:
 *     · el cobro falla        → `RN-2` medida, y las cuatro que cuelgan de ella;
 *     · el cobro entra igual  → el vínculo tarjeta-suscripción SOBREVIVE al borrado, o sea que
 *                               «saqué mi tarjeta de MP» no frena el cobro. Es un hecho de cara
 *                               al cliente y merece su fila;
 *     · MP no deja borrarla   → el proveedor protege la tarjeta con suscripción viva. Otra fila.
 *
 * LAS SEIS PUERTAS QUE YA ESTÁN CERRADAS, Y MEDIDAS
 *   1. tarjeta mala en sandbox — los SIETE titulares, en creación Y en mutación (sonda 44)
 *   2. monto impagable — piso ARS 15, techo ARS 2.000.000 (`PC-2`)
 *   3. tarjeta con escenario del CLI — exige token de usuario de prueba, que exige cuenta productiva
 *   4. tarjeta real pausada — el banco honra el débito igual (`apagon`, medido el 2026-09-17)
 *   5. prepaga o virtual — el producto Suscripciones no las acepta
 *   6. dinero en cuenta — el checkout no lo ofrece en Argentina
 *
 * POR QUÉ EL MONTO ES EL PISO
 *   Con este mecanismo **la aritmética no importa**: o la tarjeta está o no está. Así que el
 *   monto baja al mínimo que el proveedor acepta, ARS 15, y la exposición cae diez veces
 *   respecto del intento anterior.
 *
 * POR QUÉ CONVIENE QUE EL PRIMER COBRO ENTRE
 *   Deja **un pago acreditado**. Con eso el sujeto mide el camino de **mora real** —alguien que
 *   venía pagando y falló—, que es el que gobierna el grace. Sin ese pago mediría el camino de
 *   entrada, que por el capítulo 12 §4.3 **no lleva grace**.
 *
 * GUARDS
 *   · presupuesto: `PRESUPUESTO_AUTORIZADO = 30`, autorizado por el owner el 2026-09-17.
 *     Son dos ciclos de ARS 15: el de hoy y el de mañana si el borrado no funciona.
 *   · entorno: aborta si el token no resuelve a la cuenta productiva declarada.
 *
 * QUÉ MÁS HACE
 *   Cancela el sujeto `sin-saldo` (ARS 500), que quedó obsoleto cuando se cayó el camino de la
 *   prepaga. Cancelar es irreversible (`PA-5`), y es a propósito: no se deja colgado un link que
 *   cobra ARS 500 si alguien lo abre.
 *
 * USO — desde el VPS, dentro del contenedor de la API
 *   B64=$(base64 -w0 probe-46-la-tarjeta-que-se-borra.mjs)
 *   ssh ... "hops --target=prod exec api -- sh -c 'echo $B64 | base64 -d > /tmp/p46.mjs && node /tmp/p46.mjs'"
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const MANIFIESTO = '/tmp/hos1352-tarjeta-borrada.json';

const CUENTA_ESPERADA = 3497516165;
const PAGADOR = 'qazuor@gmail.com';

const MONTO = 15;
const CICLO_DIAS = 1;
/** Dos ciclos de ARS 15. Autorizado por el owner el 2026-09-17. */
const PRESUPUESTO_AUTORIZADO = 30;

/** El sujeto de ARS 500 que quedó obsoleto al caerse el camino de la prepaga. */
const OBSOLETO = '3cbb1e6c9ce247b4aa85230ec5481bc6';

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

/** `EX-37`: la URL cruda trae activation=true y abre «Esta página no existe». */
const sanear = (url) =>
    typeof url === 'string' ? url.replace(/[?&]activation=true\b/, (m) => (m[0] === '?' ? '?' : '')) : url;

async function main() {
    if (!TOKEN) {
        console.error('✗ no hay token en el entorno del contenedor. ABORTA.');
        process.exit(2);
    }

    // ── GUARD DE PRESUPUESTO ──────────────────────────────────────────────────
    const maximo = MONTO * 2;
    if (maximo !== PRESUPUESTO_AUTORIZADO) {
        console.error(`✗ ABORTA: el máximo da ARS ${maximo} y lo autorizado es ARS ${PRESUPUESTO_AUTORIZADO}.`);
        process.exit(3);
    }

    // ── GUARD DE ENTORNO ──────────────────────────────────────────────────────
    const me = await api('/users/me');
    if (me.status !== 200 || me.json?.id !== CUENTA_ESPERADA) {
        console.error(`✗ ABORTA: el token no resuelve a la cuenta esperada. ${me.status} / id=${me.json?.id}`);
        process.exit(4);
    }
    console.log(`✓ entorno: ${me.json.nickname} (${me.json.id}) — PRODUCCIÓN`);
    console.log(`✓ presupuesto: máximo ARS ${maximo}, autorizado ARS ${PRESUPUESTO_AUTORIZADO}`);

    // ── LIMPIEZA: el sujeto de ARS 500 ────────────────────────────────────────
    const antesObsoleto = await api(`/preapproval/${OBSOLETO}`);
    if (antesObsoleto.status === 200 && antesObsoleto.json?.status !== 'cancelled') {
        const cancel = await api(`/preapproval/${OBSOLETO}`, { method: 'PUT', body: { status: 'cancelled' } });
        const rel = await api(`/preapproval/${OBSOLETO}`);
        console.log(
            `\n✓ obsoleto ${OBSOLETO}: PUT ${cancel.status} → relectura dice "${rel.json?.status}"` +
                (rel.json?.status === 'cancelled' ? '' : '  ⚠ NO quedó cancelado')
        );
    } else {
        console.log(`\n· obsoleto ${OBSOLETO}: ya estaba en "${antesObsoleto.json?.status ?? antesObsoleto.status}"`);
    }

    // ── EL SUJETO NUEVO ───────────────────────────────────────────────────────
    const externalReference = `HOS-1352-borrada-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`;

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
        console.error(JSON.stringify(creacion.json, null, 2));
        process.exit(5);
    }

    const id = creacion.json.id;

    // ── D5: SE RELEE ──────────────────────────────────────────────────────────
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
        mecanismo: 'autorizar con tarjeta guardada y despues borrarla de la cuenta de MP',
        nota: 'RC-1: el search IGNORA external_reference. Sin este id no hay forma de reencontrar el sujeto.',
        sujetos: [{ slug: 'borrada', id, external_reference: externalReference }],
        obsoleto_cancelado: OBSOLETO
    };
    try {
        writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2));
        console.log(`✓ manifiesto → ${MANIFIESTO}`);
    } catch (e) {
        console.log(`⚠ no se pudo escribir el manifiesto (${e.message})`);
    }

    console.log('\n############ EL SUJETO');
    console.log(`  id                  ${id}`);
    console.log(`  external_reference  ${externalReference}`);
    console.log(`  status              ${sub.status}`);
    console.log(`  monto               ARS ${sub.auto_recurring?.transaction_amount}`);

    console.log('\n############ EL LINK — saneado (EX-37)');
    console.log(`  ${sanear(creacion.json.init_point)}`);

    console.log('\n############ MANIFIESTO, COPIAR AL REPO');
    console.log(JSON.stringify(manifiesto, null, 2));

    console.log('\n############ QUÉ SIGUE');
    console.log('  1. autorizar con una tarjeta normal — cobra ARS 15 en el acto;');
    console.log('  2. borrar esa tarjeta de la cuenta de Mercado Pago;');
    console.log('  3. mañana, +24 h y el retraso de 26-44 min, cae el segundo cobro;');
    console.log('  4. se relee: falla, entra igual, o MP no dejó borrarla. Las tres son filas.');
}

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
