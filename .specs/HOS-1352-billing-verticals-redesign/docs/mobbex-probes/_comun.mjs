/**
 * Piezas compartidas por las sondas de Mobbex.
 *
 * HOS-1352 · FASE 1C. NO es código productivo: no se importa desde la app.
 *
 * Tres cosas viven acá porque las cuatro primeras sondas las repitieron y
 * porque dos de ellas son reglas del programa, no comodidad:
 *
 *   1. `llamar()` — en Mobbex el status HTTP NO cierra nada. `GET /p/entity`
 *      devuelve 200 con {"result":false,"error":"Acceso no autorizado"}.
 *      Por eso `ok` sale del campo `result` del cuerpo, nunca de res.ok.
 *
 *   2. `comparar()` — toda mutación se verifica releyendo y comparando CAMPO
 *      POR CAMPO cada campo que se mandó. Es la regla §4.1 del capítulo 06, y
 *      nació de que Mercado Pago aplicara un PUT a medias con un solo 200.
 *
 *   3. `Bitacora` — cada llamada queda registrada con su request y su
 *      respuesta. Sin eso, un hallazgo no es evidencia: es un recuerdo.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

export const API = 'https://api.mobbex.com';

const ARCHIVO_CREDS = `${homedir()}/.config/hospeda/mobbex-creds.sh`;

/**
 * Lee el archivo de credenciales DIRECTAMENTE, sin depender del shell.
 *
 * Por qué no alcanza con `source`: el archivo está escrito en sintaxis bash
 * (`export VAR='...'`) y **la terminal de este proyecto es fish**, donde
 * `source` de eso falla. Si las sondas dependieran del `source`, la mitad de
 * las corridas empezarían con un error que no tiene nada que ver con Mobbex.
 *
 * Las variables de entorno siguen teniendo prioridad, para poder apuntar a
 * otra cuenta sin tocar el archivo.
 */
const leerDelArchivo = () => {
    try {
        const texto = readFileSync(ARCHIVO_CREDS, 'utf8');
        const sacar = (clave) => new RegExp(`^\\s*export\\s+${clave}=['"]?([^'"\n]*)['"]?`, 'm').exec(texto)?.[1]?.trim() || undefined;
        return { apiKey: sacar('MOBBEX_API_KEY'), accessToken: sacar('MOBBEX_ACCESS_TOKEN') };
    } catch {
        return {};
    }
};

/**
 * Credenciales. NUNCA hardcodeadas: viven en ~/.config/hospeda/mobbex-creds.sh,
 * fuera del repo y con chmod 600. Se toman del entorno si están, y si no del
 * archivo — así la sonda corre igual en bash, en fish o desde un editor.
 */
export const credenciales = () => {
    const delArchivo = leerDelArchivo();
    const apiKey = process.env.MOBBEX_API_KEY || delArchivo.apiKey;
    const accessToken = process.env.MOBBEX_ACCESS_TOKEN || delArchivo.accessToken;
    if (!apiKey || !accessToken) {
        console.error('\nFALTAN CREDENCIALES.\n');
        console.error(`  Se buscaron en el entorno y en ${ARCHIVO_CREDS}\n`);
        console.error(`  MOBBEX_API_KEY:      ${apiKey ? 'ok' : 'FALTA'}`);
        console.error(`  MOBBEX_ACCESS_TOKEN: ${accessToken ? 'ok' : 'FALTA'}`);
        if (!accessToken) {
            console.error('\n  El token de la ENTIDAD sale de vincularla a la aplicación:');
            console.error('  mobbex.com/devportal → «Hospeda HOS-1352 evaluacion» → + → SOLICITAR ACCESO');
            console.error('  → buscar por CUIT → autorizar. Requiere el KYC aprobado.');
        }
        process.exit(1);
    }
    return {
        'x-api-key': apiKey,
        'x-access-token': accessToken,
        'content-type': 'application/json'
    };
};

/**
 * Guard de entorno. Con Mercado Pago, `live_mode` venía `true` también en
 * sandbox (`EX-14`) y lo único que distinguía era GET /users/me. Acá el
 * equivalente es /p/entity/validate: dice contra qué cuenta estamos operando.
 *
 * Toda sonda que MUTE algo abre con esto y lo imprime. No aborta —la cuenta
 * propia es justamente donde queremos medir— pero deja el nombre asentado en
 * la bitácora, para que ningún resultado quede huérfano de su cuenta.
 */
export const quienesSomos = async (headers) => {
    const res = await fetch(`${API}/p/entity/validate`, { headers });
    const j = await res.json().catch(() => null);
    const d = j?.data ?? {};
    return { nombre: d.name ?? '(desconocida)', uid: d.uid ?? null, id: d._id ?? null, crudo: j };
};

export class Bitacora {
    constructor(sello) {
        this.sello = sello;
        this.entradas = [];
        this.creados = [];
    }

    anotar(entrada) {
        this.entradas.push({ t: new Date().toISOString(), ...entrada });
    }

    creado(tipo, uid, extra = {}) {
        this.creados.push({ tipo, uid, ...extra });
    }

    escribir(dir) {
        const archivo = new URL(`./bitacora-${this.sello}.json`, dir);
        writeFileSync(
            archivo,
            JSON.stringify({ sello: this.sello, fecha: new Date().toISOString(), creados: this.creados, llamadas: this.entradas }, null, 2)
        );
        return archivo.pathname;
    }
}

/**
 * Una llamada a la API, con su respuesta cruda anotada.
 * `ok` sale de `result`, NO del status. Ver el §0 de RESULTADOS-2026-09-18.
 */
export const hacerLlamador = (headers, bitacora) => async (metodo, ruta, body) => {
    const t0 = Date.now();
    let res;
    let texto = '';
    try {
        res = await fetch(`${API}${ruta}`, {
            method: metodo,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        texto = await res.text();
    } catch (e) {
        const caida = { metodo, ruta, status: 0, ok: false, error: String(e), ms: Date.now() - t0 };
        bitacora?.anotar(caida);
        return caida;
    }
    let json = null;
    try {
        json = JSON.parse(texto);
    } catch {
        /* cuerpo no-JSON: queda crudo en `texto` */
    }
    const r = {
        metodo,
        ruta,
        enviado: body ?? null,
        status: res.status,
        ok: json?.result === true,
        code: json?.code ?? null,
        json,
        texto: texto.slice(0, 1500),
        ms: Date.now() - t0
    };
    bitacora?.anotar({ metodo, ruta, enviado: body ?? null, status: r.status, ok: r.ok, code: r.code, respuesta: r.texto, ms: r.ms });
    return r;
};

/**
 * La regla §4.1 hecha función: compara lo que se MANDÓ contra lo que quedó
 * ESCRITO, campo por campo. Devuelve el veredicto por campo, no uno global —
 * porque está medido que el campo que falla no arrastra al que funciona.
 */
export const comparar = (enviado, releido, campos) => {
    const filas = campos.map((campo) => {
        const esperado = campo.split('.').reduce((o, k) => o?.[k], enviado);
        const real = campo.split('.').reduce((o, k) => o?.[k], releido);
        const aplicado = JSON.stringify(esperado) === JSON.stringify(real);
        return { campo, esperado, real, aplicado };
    });
    return {
        filas,
        todos: filas.every((f) => f.aplicado),
        ninguno: filas.every((f) => !f.aplicado),
        parcial: filas.some((f) => f.aplicado) && filas.some((f) => !f.aplicado)
    };
};

export const mostrarComparacion = (titulo, cmp) => {
    console.log(`\n   ${titulo}`);
    for (const f of cmp.filas) {
        const marca = f.aplicado ? '✓' : '✗';
        console.log(`     ${marca} ${f.campo}: mandé ${JSON.stringify(f.esperado)} · quedó ${JSON.stringify(f.real)}`);
    }
    if (cmp.parcial) {
        console.log('     → SE APLICÓ A MEDIAS. Es el caso más caro: un solo 200 y dos destinos distintos.');
    } else if (cmp.ninguno) {
        console.log('     → NO se aplicó NADA. Si el status fue 2xx, es aceptar-y-descartar.');
    } else {
        console.log('     → se aplicó entero.');
    }
};

export const mostrar = (titulo, r) => {
    console.log(`\n── ${titulo}`);
    console.log(`   ${r.metodo} ${r.ruta}  →  ${r.status} · result ${r.json?.result ?? '(sin result)'}${r.code ? ` · ${r.code}` : ''}  (${r.ms} ms)`);
    if (!r.ok) console.log(`   ${r.texto}`);
};

export const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Tarjetas de prueba del proveedor, de
 * https://mobbex.dev/medios-de-pago-para-pruebas (leída 2026-09-17).
 * El CVV decide el resultado: 200 aprueba · 400 deniega · 002 deja pendiente.
 * Amex usa 4 dígitos: 0200 · 0400 · 0002.
 */
export const TARJETAS = {
    visaDebito: { numero: '4507990000000010', marca: 'Visa', tipo: 'débito' },
    visaCredito: { numero: '4507983190082450', marca: 'Visa', tipo: 'crédito' },
    masterCredito: { numero: '5323629993121008', marca: 'Mastercard', tipo: 'crédito' },
    masterDebito: { numero: '5204865118900397', marca: 'Mastercard', tipo: 'débito' },
    amex: { numero: '376411234531007', marca: 'American Express', tipo: 'crédito', cvv4: true },
    // La que contesta si las prepagas sirven para recurrencia — con Mercado
    // Pago es que NO, y su documentación lo declara. Acá el proveedor dice que
    // sí y hasta da una tarjeta para probarlo.
    prepaga: { numero: '5288242191555424', marca: 'Mastercard Prepaga Bancor', tipo: 'PREPAGA' }
};

export const CVV = { aprueba: '200', deniega: '400', pendiente: '002' };
export const TITULAR = { nombre: 'demo', documento: '12123123', vencimiento: '12/34' };
