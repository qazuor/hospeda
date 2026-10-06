// =============================================================================
// SONDA 08 — Receptor público de webhooks de Mercado Pago
// =============================================================================
// NO ES CÓDIGO PRODUCTIVO. Worker experimental descartable de FASE 1C (PDR §4).
// No vive en ninguna app de Hospeda, no se importa desde ningún lado, no
// participa de ningún build del monorepo.
//
// Programa: HOS-1352. Cubre WH-1..WH-5, EX-2 y la verificación de firma.
//
// POR QUÉ EXISTE
// --------------
// Medir los webhooks a través del billing de staging mostró que la capa legacy
// RENOMBRA los eventos antes de que se los pueda ver: el proveedor manda
// `subscription_authorized_payment` y el log lo llama `invoice.updated`.
// Además esa tabla no guarda headers, así que la FIRMA es inobservable.
// El §58 exige medir al proveedor, no a nuestra interpretación de él.
//
// Los túneles (cloudflared, ngrok) no funcionan desde el entorno de trabajo:
// seis intentos, 404 desde el borde de Cloudflare. Un Worker sí.
//
// QUÉ GUARDA
// ----------
// Cada POST entrante TAL CUAL llega: bytes crudos del body, TODOS los headers
// (incluidos `x-signature` y `x-request-id`), la query string, el método y el
// instante de llegada con precisión de milisegundo. No interpreta, no
// normaliza, no renombra.
//
// EL INTERRUPTOR DE FALLA
// -----------------------
// Mercado Pago sólo reintenta cuando la entrega falla. Como una aplicación
// tiene UNA sola URL de webhook y cambiarla es manual (403 por API), este
// Worker trae el interruptor adentro: con `mode=fail` responde 500 y el
// proveedor reintenta, sin tener que volver a tocar el panel. Así se miden
// WH-4 y WH-5 de forma controlada.
//
// RUTAS
//   POST  /                     recibe y guarda. 200, salvo mode=fail → 500
//   GET   /dump?t=<TOKEN>       devuelve todo lo recibido, en JSON
//   GET   /mode?t=<TOKEN>       lee el modo actual
//   POST  /mode?t=<TOKEN>&m=ok|fail   cambia el modo
//   DELETE /dump?t=<TOKEN>      borra lo acumulado
//
// El TOKEN es sólo para que la URL no quede legible por cualquiera que la
// adivine. No protege nada valioso: acá no hay datos reales, son eventos de
// un sandbox con un usuario de prueba.
// =============================================================================

const MAX_BODY = 64 * 1024;

function autorizado(url, env) {
  return url.searchParams.get('t') === env.DUMP_TOKEN;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const llegada = new Date().toISOString();

    // --- lectura y administración ------------------------------------------
    if (url.pathname === '/dump' || url.pathname === '/mode') {
      if (!autorizado(url, env)) return new Response('no', { status: 404 });

      if (url.pathname === '/mode') {
        if (request.method === 'POST') {
          const m = url.searchParams.get('m') === 'fail' ? 'fail' : 'ok';
          await env.HOS1352_WEBHOOKS.put('__mode', m);
          return json({ mode: m });
        }
        return json({ mode: (await env.HOS1352_WEBHOOKS.get('__mode')) || 'ok' });
      }

      if (request.method === 'DELETE') {
        const lista = await env.HOS1352_WEBHOOKS.list({ prefix: 'ev:' });
        await Promise.all(lista.keys.map((k) => env.HOS1352_WEBHOOKS.delete(k.name)));
        return json({ borrados: lista.keys.length });
      }

      // Se devuelven ORDENADOS POR NUESTRO INSTANTE DE LLEGADA, que es lo
      // único que no depende de lo que el proveedor diga sobre el orden —
      // que es justamente lo que EX-2 viene a medir.
      const lista = await env.HOS1352_WEBHOOKS.list({ prefix: 'ev:' });
      const eventos = await Promise.all(
        lista.keys.map(async (k) => JSON.parse((await env.HOS1352_WEBHOOKS.get(k.name)) || 'null'))
      );
      const limpios = eventos.filter(Boolean).sort((a, b) => a.llegada.localeCompare(b.llegada));
      return json({ total: limpios.length, eventos: limpios });
    }

    // --- recepción ----------------------------------------------------------
    if (request.method !== 'POST') {
      return new Response('sonda 08 — receptor de webhooks HOS-1352', { status: 200 });
    }

    const crudo = (await request.text()).slice(0, MAX_BODY);

    // TODOS los headers, sin filtrar. `x-signature` es el que decide si la
    // firma se puede verificar, y es exactamente el que la tabla de staging
    // no guardaba.
    const headers = {};
    for (const [k, v] of request.headers) headers[k] = v;

    const evento = {
      llegada,
      metodo: request.method,
      url: request.url,
      query: Object.fromEntries(url.searchParams),
      headers,
      body_crudo: crudo,
      body_bytes: crudo.length
    };

    // La clave lleva el instante para que el listado salga ordenado, más un
    // sufijo aleatorio: dos entregas del mismo milisegundo NO se pisan. Una
    // clave derivada del id del evento habría perdido justamente los
    // duplicados, que son lo que WH-1 mide.
    const clave = `ev:${llegada}:${crypto.randomUUID().slice(0, 8)}`;
    await env.HOS1352_WEBHOOKS.put(clave, JSON.stringify(evento), {
      expirationTtl: 60 * 60 * 24 * 30
    });

    const modo = (await env.HOS1352_WEBHOOKS.get('__mode')) || 'ok';
    if (modo === 'fail') {
      return new Response('forzado por la sonda 08', { status: 500 });
    }
    return new Response('ok', { status: 200 });
  }
};
