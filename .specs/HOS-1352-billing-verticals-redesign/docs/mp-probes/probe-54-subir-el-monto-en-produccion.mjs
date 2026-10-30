#!/usr/bin/env node
// =============================================================================
// SONDA 54 — Subir el monto de un preapproval de PRODUCCIÓN (EX-54)
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Script experimental descartable de FASE 1C (PDR §4).
//
// Programa: HOS-1352. EX-54: qué correo le manda el proveedor al pagador
// cuando le SUBIMOS el monto. EX-3 lo midió al bajar, en la casilla real del
// owner. En sandbox no se puede: el comprador de prueba tiene una casilla
// `@testuser.com` que nadie lee. Por eso esta sonda es de PRODUCCIÓN y la
// corre SÓLO EL OWNER: el agente que la escribió no tiene permiso para mutar
// producción, y no la corrió.
//
// QUÉ HACE, Y NADA MÁS
// --------------------
//   1  lee el preapproval y se niega si no está `authorized` o si su
//      `payer_id` no es PAYER_ID (así no se toca la suscripción de un cliente
//      real). Se compara el id y no el mail: la lectura devuelve
//      `payer_email: ""` (medido en sandbox el 2026-09-29)
//   2  PUT auto_recurring.transaction_amount = monto actual + DELTA
//   3  relee y anota el instante de ENVÍO, que es contra el que se mide el
//      correo (asunto, texto, remitente, hora de llegada)
// No cancela ni revierte: bajar el monto después dispara OTRO correo (EX-3),
// y esa decisión es del owner.
//
// COSTO: el próximo cobro de ese preapproval sale DELTA pesos más caro si no
// se revierte o cancela antes de su `next_payment_date`.
//
//   ID=<preapproval> PAYER_ID=<payer_id del owner> PAGADOR=<mail del owner> DELTA=1 \
//   hops --target=prod exec api -- sh -c 'echo <b64> | base64 -d > /tmp/p54.mjs && node /tmp/p54.mjs'
// (mismo método que la sonda 29: el token de producción vive en el contenedor)
// =============================================================================

const API = 'https://api.mercadopago.com';
const TOKEN = process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN;
const ID = process.env.ID;
const PAGADOR = process.env.PAGADOR;
const PAYER_ID = process.env.PAYER_ID;
const DELTA = Number(process.env.DELTA ?? '1');

if (!TOKEN || !ID || !PAGADOR || !PAYER_ID || !(DELTA > 0)) {
  console.error('faltan HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN, ID, PAGADOR, PAYER_ID o un DELTA > 0');
  process.exit(1);
}
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const leer = async () => (await fetch(`${API}/preapproval/${ID}`, { headers: H })).json();

const antes = await leer();
const monto = antes?.auto_recurring?.transaction_amount;
console.log('antes', JSON.stringify({ status: antes.status, payer_id: antes.payer_id, monto,
  next_payment_date: antes.next_payment_date, version: antes.version }));
if (antes.status !== 'authorized') { console.error('no está authorized: no se toca'); process.exit(1); }
if (String(antes.payer_id) !== String(PAYER_ID)) {
  console.error('el payer_id no es PAYER_ID: no se toca'); process.exit(1);
}

const nuevo = Number(monto) + DELTA;
const envio = new Date().toISOString();
const r = await fetch(`${API}/preapproval/${ID}`, {
  method: 'PUT', headers: H,
  body: JSON.stringify({ auto_recurring: { transaction_amount: nuevo, currency_id: antes.auto_recurring.currency_id } }),
});
const despues = await leer();
console.log('envio', envio, 'http', r.status);
console.log('despues', JSON.stringify({ status: despues.status, monto: despues.auto_recurring?.transaction_amount,
  next_payment_date: despues.next_payment_date, last_modified: despues.last_modified }));
console.log(`Ahora: buscar en la casilla de ${PAGADOR} (in:anywhere) correos de info@mercadopago.com desde ${envio}.`);
