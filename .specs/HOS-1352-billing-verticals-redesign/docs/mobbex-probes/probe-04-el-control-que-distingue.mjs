/**
 * Sonda 04 — Los dos controles que la sonda 03 dejó pendientes.
 *
 * HOS-1352 · FASE 1C · evaluación de Mobbex. NO es código productivo.
 *
 * La sonda 03 dejó dos resultados que NO se pueden leer sin un control:
 *
 *   (A) `POST .../execution` sobre un suscriptor SIN tarjeta devolvió
 *       `200 {"result":true,"data":{}}`. Eso admite dos lecturas opuestas:
 *       «lo aceptó y lo procesa en background» (la doc dice que la ejecución
 *       masiva es asíncrona) o «lo aceptó y lo descartó», que es el §0 de
 *       Mercado Pago repetido en el endpoint más caro de todos.
 *       LO QUE LO SEPARA: si se creó una operación. Se busca por `reference`
 *       en el listado de operaciones de la entidad.
 *
 *   (B) `POST /p/sources/token` falló con `GENERIC:EFCS "Execution failed.
 *       Please contact support"`. Ese mensaje no distingue «esta cuenta no
 *       tiene permiso» de «mandaste el cuerpo mal». Un `NOT_SUPPORTED`
 *       registrado sobre esa base sería inventado — es exactamente el error que
 *       la sonda 07 de Mercado Pago casi comete con un 429.
 *       LO QUE LO SEPARA: mandar cuerpos deliberadamente inválidos. Si un
 *       cuerpo vacío da el MISMO error que uno bien formado, el error es del
 *       portero y no del cuerpo.
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.mobbex.com';
const CREDS = {
    'x-api-key': 'zJ8LFTBX6Ba8D611e9io13fDZAwj0QmKO1Hn1yIj',
    'x-access-token': 'd31f0721-2f85-44e7-bcc6-15e19d1a53cc',
    'content-type': 'application/json'
};

const SUSCRIPCION = 'BUKMU1DXUSY2J8CHTC';
const SUSCRIPTOR = 'ZWOF5HCVGB12J5BGC0';
// Las referencias que la sonda 03 usó al ejecutar sin tarjeta. Si el proveedor
// creó una operación, tiene que poder encontrarse por acá.
const REFS_SONDA_03 = ['hos1352-c-1789701285451-sin-tarjeta'];

const SELLO = `hos1352-d-${Date.now()}`;
const bitacora = [];

const llamar = async (metodo, ruta, body) => {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: CREDS,
        body: body ? JSON.stringify(body) : undefined
    });
    const texto = await res.text();
    let json = null;
    try {
        json = JSON.parse(texto);
    } catch {
        /* cuerpo no-JSON */
    }
    const r = { metodo, ruta, status: res.status, json, texto: texto.slice(0, 450) };
    bitacora.push({ metodo, ruta, status: res.status, cuerpo: r.texto });
    return r;
};

const main = async () => {
    console.log('SONDA 04 — los controles');
    console.log(`fecha: ${new Date().toISOString()}`);

    // ═══ CONTROL A · ¿el execution sin tarjeta creó ALGO?
    console.log('\n═══ CONTROL A — ¿el cobro sin tarjeta dejó rastro?');

    for (const ruta of [
        '/p/entity/operations?limit=25',
        `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}/execution?page=0`,
        `/p/subscriptions/${SUSCRIPCION}/execution?page=0`
    ]) {
        const r = await llamar('GET', ruta);
        console.log(`\n── GET ${ruta}`);
        console.log(`   status ${r.status} · result ${r.json?.result}`);
        const d = r.json?.data;
        const docs = Array.isArray(d) ? d : (d?.docs ?? null);
        if (docs) {
            console.log(`   filas: ${docs.length}`);
            const mias = docs.filter((x) => JSON.stringify(x).includes('hos1352'));
            console.log(`   filas con sello hos1352: ${mias.length}`);
            for (const m of mias.slice(0, 5)) {
                console.log(`     · ${JSON.stringify(m).slice(0, 260)}`);
            }
        } else {
            console.log(`   ${r.texto}`);
        }
    }

    // Y el control del control: el suscriptor releído, ¿cambió en algo?
    const sub = await llamar('GET', `/p/subscriptions/${SUSCRIPCION}/subscriber/${SUSCRIPTOR}`);
    const s = sub.json?.data?.subscriber ?? {};
    console.log('\n── relectura del suscriptor tras los dos intentos de cobro');
    console.log(`   status=${s.status} total=${s.total} updated=${s.updated} created=${s.created}`);
    console.log(`   → ${s.updated === s.created ? 'NADA lo movió: `updated` sigue igual a `created`' : '`updated` se movió'}`);
    console.log(`   executions/agenda: ${JSON.stringify(sub.json?.data?.subscriber?.agenda ?? []).slice(0, 200)}`);

    // ═══ CONTROL B · el error de tokenización, ¿distingue el cuerpo?
    console.log('\n═══ CONTROL B — ¿GENERIC:EFCS es del portero o del cuerpo?');

    const cuerpos = [
        ['B1 · cuerpo VACÍO', {}],
        ['B2 · basura pura', { hola: 'mundo' }],
        ['B3 · tarjeta con número inválido', { card: { number: '0000', holder: { name: 'x' } } }],
        [
            'B4 · tarjeta bien formada (la de prueba del proveedor)',
            { card: { number: '4507990000000010', holder: { name: 'demo', identification: '12123123' }, expiration: { month: 12, year: 34 }, code: '200' } }
        ]
    ];

    const codigos = [];
    for (const [etq, body] of cuerpos) {
        const r = await llamar('POST', '/p/sources/token', body);
        const code = r.json?.code ?? '(sin code)';
        codigos.push(code);
        console.log(`\n── ${etq}`);
        console.log(`   status ${r.status} · result ${r.json?.result} · code ${code}`);
        console.log(`   ${r.texto}`);
    }

    const todosIguales = codigos.every((c) => c === codigos[0]);
    console.log('\n── VEREDICTO DEL CONTROL B');
    console.log(`   códigos: ${codigos.join(' | ')}`);
    if (todosIguales) {
        console.log('   → TODOS IGUALES: el error NO depende del cuerpo, así que es del');
        console.log('     PORTERO. La tokenización server-side no está habilitada para esta');
        console.log('     cuenta — que es justo lo que la doc dice (pide PCI DSS y un mail).');
        console.log('     NO se puede concluir nada sobre si la capacidad existe.');
    } else {
        console.log('   → DISTINTOS: el endpoint sí evalúa el cuerpo. Un cuerpo bien formado');
        console.log('     que igual falla apunta a permisos; uno mal formado, a nuestro error.');
    }

    // ═══ C · El camino que SÍ debería andar: el checkout hospedado.
    //        Si éste funciona, el alta existe aunque la tokenización no.
    console.log('\n═══ C — el checkout hospedado, que es el camino documentado');
    const chk = await llamar('POST', '/p/checkout', {
        total: 150,
        currency: 'ARS',
        reference: `${SELLO}-checkout`,
        description: 'HOS-1352 sonda checkout',
        return_url: 'https://hospeda.com.ar/gracias',
        test: true,
        customer: { email: 'sonda-hos1352@hospeda.com.ar', name: 'Sonda HOS1352', identification: '12123123' }
    });
    console.log(`   status ${chk.status} · result ${chk.json?.result}`);
    console.log(`   ${chk.texto}`);
    const url = chk.json?.data?.url;
    if (url) {
        console.log(`   → URL de checkout: ${url}`);
        // Control barato y que con MP resultó CARO de no hacer (EX-37: el
        // init_point venía roto y la API igual devolvía 201). Se pide la URL.
        try {
            const res = await fetch(url, { redirect: 'follow' });
            const html = await res.text();
            console.log(`   → la URL responde ${res.status}, ${html.length} bytes`);
            const rota = /no existe|not found|error/i.test(html.slice(0, 2000));
            console.log(`   → ${rota ? 'ATENCIÓN: el HTML parece una página de error' : 'el HTML no parece una página de error'}`);
        } catch (e) {
            console.log(`   → la URL no se pudo abrir: ${e}`);
        }
    }

    writeFileSync(new URL(`./bitacora-${SELLO}.json`, import.meta.url), JSON.stringify({ sello: SELLO, fecha: new Date().toISOString(), bitacora }, null, 2));
    console.log(`\n── bitácora escrita · ${bitacora.length} llamadas`);
};

main().catch((e) => {
    console.error('la sonda se cayó:', e);
    process.exit(1);
});
