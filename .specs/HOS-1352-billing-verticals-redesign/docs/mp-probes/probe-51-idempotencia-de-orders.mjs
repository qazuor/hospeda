#!/usr/bin/env node
// =============================================================================
// SONDA 51 — ¿`/v1/orders` es idempotente por `X-Idempotency-Key`?
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
// Programa: HOS-1352, FASE 8 completa, pendiente 7 (g) — `F-8CB1-008`.
//
// POR QUÉ EXISTE
// --------------
// El addon de única vez se cobra por `/v1/orders` (`EX-30`, `B/16` §1.4). Si la
// llamada da timeout y se reintenta, ¿el proveedor cobra dos veces? `EX-30`
// midió que la orden cobra; nadie midió qué pasa al repetirla.
//
// QUÉ SE MIDE
// -----------
//   A  Dos POST con el MISMO cuerpo y la MISMA `X-Idempotency-Key`.
//      ¿Mismo id de orden? ¿Un solo pago?
//   B  Un tercer POST con la MISMA clave y un cuerpo DISTINTO (otro monto).
//      ¿Lo rechaza, devuelve la primera, o crea otra?
//   C  Dos POST con claves DISTINTAS y el mismo `external_reference`.
//      ¿El `external_reference` deduplica algo? (control: se espera que no)
// Cada orden creada se relee por id (`D5`).
//
// SIN COSTO: sandbox, tarjeta de prueba APRO.
//   source ~/.config/hospeda/mp-sandbox-creds.sh && node probe-51-idempotencia-de-orders.mjs
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const API = 'https://api.mercadopago.com';
const OUT = process.env.OUT_DIR || '/tmp/mp-probe-51';
const TOKEN = process.env.MP_ACCESS_TOKEN;
const BUYER = process.env.MP_BUYER_EMAIL;
if (!TOKEN || !BUYER) {
  console.error('falta MP_ACCESS_TOKEN o MP_BUYER_EMAIL');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const save = (n, d) => writeFileSync(join(OUT, `${n}.json`), `${JSON.stringify(d, null, 2)}\n`);

const tokenizar = async () => {
  const r = await fetch(`${API}/v1/card_tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      card_number: '5031755734530604', security_code: '123', expiration_month: 11, expiration_year: 2030,
      cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    }),
  });
  return (await r.json())?.id ?? null;
};
const cuerpo = (token, ref, monto) => ({
  type: 'online', external_reference: ref, total_amount: monto, processing_mode: 'automatic',
  payer: { email: BUYER },
  transactions: { payments: [{ amount: monto, payment_method: { id: 'master', type: 'credit_card', token, installments: 1 } }] },
});
const post = async (tag, body, key) => {
  const r = await fetch(`${API}/v1/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  save(tag, { http: r.status, body: j });
  const p = j?.transactions?.payments?.[0];
  console.log(`${tag}: HTTP ${r.status} · orden ${j?.id} · ${j?.status}/${j?.status_detail} · pago ${p?.id} ${p?.status} · ${Array.isArray(j) ? JSON.stringify(j).slice(0, 200) : (j?.message ?? '')}`);
  return j;
};
const reread = async (tag, id) => {
  if (!id) return;
  const r = await fetch(`${API}/v1/orders/${id}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const j = await r.json();
  save(`${tag}-relectura`, j);
  const p = j?.transactions?.payments?.[0];
  console.log(`  relectura ${id}: ${j?.status}/${j?.status_detail} · pagos ${j?.transactions?.payments?.length} · ${p?.status}/${p?.status_detail}`);
};

console.log(`### SONDA 51 · ${new Date().toISOString()}`);
// A: misma clave, mismo cuerpo
const keyA = randomUUID();
const refA = `HOS-1352-s51-A-${Date.now()}`;
const bodyA = cuerpo(await tokenizar(), refA, '20.00');
const a1 = await post('A1', bodyA, keyA);
const a2 = await post('A2-misma-clave-mismo-cuerpo', bodyA, keyA);
await reread('A1', a1?.id);
if (a2?.id && a2.id !== a1?.id) await reread('A2', a2.id);
console.log(`>>> A: mismo id de orden = ${Boolean(a1?.id) && a1?.id === a2?.id}`);
// B: misma clave, otro cuerpo
const b = await post('B-misma-clave-otro-monto', cuerpo(await tokenizar(), refA, '30.00'), keyA);
console.log(`>>> B: devuelve la primera = ${b?.id === a1?.id} · crea otra = ${Boolean(b?.id) && b?.id !== a1?.id}`);
if (b?.id && b.id !== a1?.id) await reread('B', b.id);
// C: claves distintas, mismo external_reference
const refC = `HOS-1352-s51-C-${Date.now()}`;
const c1 = await post('C1', cuerpo(await tokenizar(), refC, '20.00'), randomUUID());
const c2 = await post('C2-otra-clave-mismo-ref', cuerpo(await tokenizar(), refC, '20.00'), randomUUID());
console.log(`>>> C: external_reference deduplica = ${Boolean(c1?.id) && c1?.id === c2?.id}`);
console.log(`salida en ${OUT}`);
