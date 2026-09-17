#!/usr/bin/env node
/**
 * SONDA 44 — la tarjeta que pasa la validación y no cobra
 * HOS-1352 · FASE 1C · 2026-09-17
 *
 * QUÉ PREGUNTA
 *   `RN-2` (cobro fallido) no tiene sujeto. Las dos salidas conocidas están cerradas:
 *     · `PA-4` midió que una tarjeta mala NO llega a crear la suscripción — el proveedor
 *       valida cobrando ARS 0 y devuelve `400 CC_VAL_433`. Midió DOS titulares: FUND y OTHE.
 *     · `PC-2` cierra el monto impagable: piso ARS 15, techo ARS 2.000.000.
 *
 *   Pero el catálogo de titulares de prueba tiene SIETE, y cinco nunca se probaron:
 *     APRO (aprueba) · FUND ✓medido · OTHE ✓medido · CONT · CALL · SECU · EXPI
 *
 *   La hipótesis, y es concreta: **una validación de ARS 0 no tiene nada que autorizar
 *   por teléfono, ni CVV que verificar contra un monto.** Puede pasar donde un cobro real
 *   rechaza. Si alguno de los cinco pasa, `RN-2`, `RN-3` y `GR-1..3` se contestan solas
 *   en el ciclo siguiente.
 *
 * QUÉ HACE
 *   Por cada titular candidato: tokeniza una tarjeta de prueba y se la manda a una
 *   suscripción VIVA con `PUT {card_token_id}` (el camino de `EX-36`). Después RELEE —
 *   el invariante `D5` de esta spec: ningún código de estado cierra una mutación.
 *
 * QUÉ NO HACE
 *   No crea suscripciones, no cancela, no muta montos. Toca UN sujeto y sólo su tarjeta.
 *
 * GUARDS
 *   · entorno: aborta si el token no resuelve al vendedor de PRUEBA declarado.
 *   · presupuesto: CERO. Tokenizar es gratis y la validación del proveedor es de ARS 0.
 *     Si el proveedor cobrara algo, sería un hallazgo y hay que anotarlo.
 *   · sujeto: sólo el declarado en SUBJECT_ID, que es `renov-falla3` — creado para esto.
 *
 * USO
 *   source ~/.config/hospeda/mp-sandbox-creds.sh && \
 *     OUT_DIR=/tmp/mp-probe-44 node probe-44-la-tarjeta-que-pasa-y-no-cobra.mjs
 *
 * CÓMO SE CORRIÓ, EL 2026-09-17 — TRES PASADAS, y la tercera es la que vale
 *   1. los siete titulares de falla  → `402` los siete, la tarjeta no cambió. `/tmp/mp-probe-44`
 *   2. control con APRO, MASTERCARD  → **`200` y la tarjeta TAMPOCO cambió**. `/tmp/mp-probe-44-control`
 *   3. control con APRO, VISA        → `200` y **cambió**: `9813074735 → 9834888704`,
 *                                      `master → visa`. `/tmp/mp-probe-44-control-visa`
 *
 * LA TRAMPA QUE DESTAPÓ LA PASADA 2, y es un hallazgo aparte
 *   La tarjeta que ya estaba puesta era `master`, y el control usó una Mastercard: **es el
 *   mismo plástico**. Un `200` sin cambios ahí no significa «lo descartó en silencio» sino
 *   «lo aplicó y dio igual». Los dos casos se ven IDÉNTICOS en la relectura.
 *   **Sólo una tarjeta de OTRA MARCA distingue aplicar de descartar en este endpoint.**
 *   Sin la pasada 3, el hallazgo de la 1 no valía nada: no se podía saber si los `402` eran
 *   un rechazo real o si el camino entero estaba roto.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.MP_PUBLIC_KEY;
const OUT_DIR = process.env.OUT_DIR || '/tmp/mp-probe-44';

/** El vendedor de prueba esperado. Si no coincide, la sonda no corre. */
const EXPECTED_SELLER_ID = 3497260543;
/** `renov-falla3`, creado el 2026-09-15 para ser el cobro fallido y que nunca lo fue. */
const SUBJECT_ID = '0e678ead9616489e976c13ef22a1f0ae';
const SUBJECT_SLUG = 'renov-falla3';

/** Tarjeta de prueba de Argentina (MLA). */
const CARD = { number: '4509953566233704', month: '11', year: '2030', cvv: '123' }; // Visa credito MLA — distinta MARCA a proposito: un cambio aplicado TIENE que verse

/**
 * Los cinco sin medir, en orden de probabilidad de pasar la validación y rechazar el cobro.
 * FUND y OTHE van al final: `PA-4` los midió en el camino de CREACIÓN y acá se prueba el
 * de MUTACIÓN, que es otro endpoint — vale re-verificarlos, pero después de los nuevos.
 */
const CANDIDATES = ['CALL', 'SECU', 'CONT', 'EXPI', 'FORM', 'FUND', 'OTHE'];

const stamp = () => new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const save = (name, data) => {
    writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
};

async function api(path, { method = 'GET', body, auth = TOKEN } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
            'Content-Type': 'application/json'
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        /* cuerpo vacío es una respuesta válida y hay que poder verla */
    }
    return { status: res.status, json };
}

/** Tokeniza con la clave pública, que es el camino del cliente. El token es de un solo uso (`EX-12`). */
async function tokenize(holderName) {
    const res = await fetch(`${API}/v1/card_tokens?public_key=${PUBLIC_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            card_number: CARD.number,
            expiration_month: Number(CARD.month),
            expiration_year: Number(CARD.year),
            security_code: CARD.cvv,
            cardholder: {
                name: holderName,
                identification: { type: 'DNI', number: '12345678' }
            }
        })
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        /* ídem */
    }
    return { status: res.status, json };
}

async function main() {
    if (!TOKEN || !PUBLIC_KEY) {
        console.error('Faltan MP_ACCESS_TOKEN o MP_PUBLIC_KEY. Hacé el source de las credenciales.');
        process.exit(2);
    }
    mkdirSync(OUT_DIR, { recursive: true });

    // ── GUARD DE ENTORNO ──────────────────────────────────────────────────────
    const me = await api('/users/me');
    if (me.status !== 200 || me.json?.id !== EXPECTED_SELLER_ID) {
        console.error(
            `GUARD: el token no resuelve al vendedor de prueba esperado (${EXPECTED_SELLER_ID}). ` +
                `Devolvió ${me.status} / id=${me.json?.id}. ABORTA.`
        );
        process.exit(3);
    }
    console.log(`✓ guard de entorno: vendedor de prueba ${me.json.nickname} (${me.json.id})`);

    // ── LÍNEA DE BASE ─────────────────────────────────────────────────────────
    const antes = await api(`/preapproval/${SUBJECT_ID}`);
    if (antes.status !== 200) {
        console.error(`No se pudo leer el sujeto ${SUBJECT_SLUG}: HTTP ${antes.status}. ABORTA.`);
        process.exit(4);
    }
    save(`${stamp()}-00-antes`, antes.json);
    console.log(
        `✓ sujeto ${SUBJECT_SLUG}: status=${antes.json.status} card_id=${antes.json.card_id} ` +
            `payment_method=${antes.json.payment_method_id} monto=${antes.json.auto_recurring?.transaction_amount}`
    );

    const resultados = [];

    for (const holder of CANDIDATES) {
        console.log(`\n=== titular ${holder}`);

        const tok = await tokenize(holder);
        save(`${stamp()}-${holder}-01-token`, tok);
        if (tok.status !== 201 || !tok.json?.id) {
            console.log(`   tokenización: HTTP ${tok.status} — ${tok.json?.message ?? 'sin mensaje'}`);
            resultados.push({ holder, etapa: 'tokenizacion', status: tok.status, detalle: tok.json?.message });
            continue;
        }
        console.log(`   tokenización: OK (${tok.json.id})`);

        const put = await api(`/preapproval/${SUBJECT_ID}`, {
            method: 'PUT',
            body: { card_token_id: tok.json.id }
        });
        save(`${stamp()}-${holder}-02-put`, put);
        console.log(`   PUT: HTTP ${put.status}`);

        // ── D5: NINGÚN CÓDIGO DE ESTADO CIERRA UNA MUTACIÓN. SE RELEE. ────────
        const relectura = await api(`/preapproval/${SUBJECT_ID}`);
        save(`${stamp()}-${holder}-03-relectura`, relectura.json);

        const cambioLaTarjeta =
            relectura.json?.card_id !== antes.json.card_id ||
            relectura.json?.payment_method_id !== antes.json.payment_method_id;

        console.log(
            `   relectura: card_id=${relectura.json?.card_id} ` +
                `payment_method=${relectura.json?.payment_method_id} ` +
                `→ ${cambioLaTarjeta ? '*** LA TARJETA CAMBIÓ ***' : 'sin cambios'}`
        );

        resultados.push({
            holder,
            etapa: 'put',
            status: put.status,
            detalle: put.json?.message ?? null,
            aplicado: cambioLaTarjeta,
            card_id: relectura.json?.card_id,
            payment_method_id: relectura.json?.payment_method_id
        });

        if (cambioLaTarjeta) {
            console.log(
                `\n*** ${holder} PASÓ LA VALIDACIÓN DE ARS 0 Y QUEDÓ APLICADO.\n` +
                    `    El próximo cobro del ciclo diario dice si rechaza. Se corta acá para no\n` +
                    `    pisar el sujeto con otro titular.`
            );
            break;
        }
    }

    save(`${stamp()}-99-resumen`, { sujeto: SUBJECT_SLUG, id: SUBJECT_ID, resultados });

    console.log('\n############ RESUMEN');
    for (const r of resultados) {
        console.log(
            `  ${r.holder.padEnd(5)} ${String(r.status).padEnd(4)} ${r.etapa.padEnd(13)} ` +
                `${r.aplicado ? 'APLICADO' : 'no aplicó'}  ${r.detalle ?? ''}`
        );
    }
    console.log(`\n  Artefactos en ${OUT_DIR}`);
    console.log(
        '  Si NINGUNO aplicó, el hallazgo es que la validación de ARS 0 rechaza los siete\n' +
            '  titulares de prueba, y el camino de sandbox para RN-2 queda cerrado con evidencia.'
    );
}

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
