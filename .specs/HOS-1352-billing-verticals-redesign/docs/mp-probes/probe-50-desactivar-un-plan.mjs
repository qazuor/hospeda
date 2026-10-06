#!/usr/bin/env node
// =============================================================================
// SONDA 50 — ¿Se puede desactivar un `preapproval_plan`, y qué pasa con su link?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352, FASE 8 completa, racimo `R2` (`F-8CC2-001`, `F-8CB3-001`).
// Producción, sin tarjeta: crea SU PROPIO plan, sin suscriptores, y no toca
// ninguno de los cinco planes viejos.
//
// POR QUÉ EXISTE
// --------------
// El sistema de hoy vende por `preapproval_plan` con un link público
// (`init_point`). El 2026-09-24 se midió que los cinco planes viejos siguen
// `active` y con `init_point`. `DEC-MP-007` sacó los planes del diseño nuevo,
// así que el corte tiene que RETIRARLOS, o un link viejo abre un alta que el
// sistema nuevo recibe como desconocida. Ninguna fila de la matriz (`EX-21` a
// `EX-29`) mide si un plan se puede desactivar. La documentación del proveedor
// dice que cancelar un plan es irreversible y no frena a los suscriptores
// existentes, pero sólo lo describe desde el panel.
//
// QUÉ SE MIDE
// -----------
//   A0  El link del plan recién creado: código HTTP y si la página ofrece
//       suscribirse. Es la línea de base contra la que se lee A3.
//   A1  `PUT {status:"inactive"}`.
//   A2  `PUT {status:"cancelled"}` (si A1 no lo desactivó).
//   A3  El MISMO link, después.
//   A4  `PUT {status:"active"}`: ¿es irreversible, como dice la documentación?
//
// CÓMO SE LEE
// -----------
// El código de estado NO cierra nada (`D5`): cada `PUT` se verifica releyendo
// `status` y `last_modified` por id. Un `200` con el estado sin cambiar es un
// NO disfrazado.
//
// USO
// ---
//   MP_ACCESS_TOKEN=<token de producción> MP_SONDA_OK=1 \
//   node probe-50-desactivar-un-plan.mjs
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const T = process.env.MP_ACCESS_TOKEN;
if (!T || process.env.MP_SONDA_OK !== '1') {
  console.error('falta MP_ACCESS_TOKEN o MP_SONDA_OK=1');
  process.exit(2);
}
const OUT = '/tmp/mp-probe-50';
mkdirSync(OUT, { recursive: true });
const log = [];
const save = (name, data) => writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 2));

const call = async (method, path, body) => {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { http: r.status, json: await r.json() };
};
const read = async (id, tag) => {
  const { http, json } = await call('GET', `/preapproval_plan/${id}`);
  save(`read-${tag}`, json);
  const line = { tag, http, status: json.status, last_modified: json.last_modified, init_point: json.init_point };
  log.push(line);
  console.log('READ', JSON.stringify(line));
  return json;
};
const link = async (url, tag) => {
  const r = await fetch(url, { redirect: 'follow' });
  const html = await r.text();
  writeFileSync(join(OUT, `link-${tag}.html`), html);
  const hints = ['suscrib', 'no está disponible', 'no disponible', 'inactiv', 'cancelad', 'error', 'no existe']
    .filter((h) => html.toLowerCase().includes(h));
  const line = { tag, http: r.status, final_url: r.url, bytes: html.length, hints };
  log.push(line);
  console.log('LINK', JSON.stringify(line));
};

const created = await call('POST', '/preapproval_plan', {
  reason: 'HOS1352 sonda 50 desactivar plan',
  auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 15, currency_id: 'ARS' },
  back_url: 'https://hospeda.com.ar',
});
save('create', created.json);
console.log('CREATE', created.http, created.json.id, created.json.status);
if (created.http >= 300) process.exit(1);
const id = created.json.id;

const base = await read(id, 'a0');
await link(base.init_point, 'a0');

for (const [tag, status] of [['a1', 'inactive'], ['a2', 'cancelled']]) {
  const put = await call('PUT', `/preapproval_plan/${id}`, { status });
  save(`put-${tag}`, put.json);
  console.log('PUT', tag, status, put.http, put.json.status ?? JSON.stringify(put.json).slice(0, 160));
  await new Promise((r) => setTimeout(r, 2000));
  const after = await read(id, tag);
  if (after.status !== 'active') break;
}

await link(base.init_point, 'a3');

const back = await call('PUT', `/preapproval_plan/${id}`, { status: 'active' });
save('put-a4', back.json);
console.log('PUT a4 active', back.http, back.json.status ?? JSON.stringify(back.json).slice(0, 160));
await new Promise((r) => setTimeout(r, 2000));
await read(id, 'a4');

save('log', { id, log });
console.log('salida en', OUT);
