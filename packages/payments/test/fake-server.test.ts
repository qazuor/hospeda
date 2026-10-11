/** TEST:B3:43 (soporte): HTTP real ejercita la cáscara de pruebas del proveedor falso. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import {
    FAKE_HONEST_LINK_LIFETIME_MS,
    FAKE_NOTICE_DELAY_MS,
    FakePaymentProvider
} from '../src/fake/index';
import { type FakeProviderServer, startFakeProviderServer } from '../src/fake-server';
import { sanitizeApprovalUrl } from '../src/provider/approval-url';

const START = new Date('2026-10-01T03:00:00.000Z');
const BASE = {
    reason: 'Hospeda monthly plan',
    external_reference: 'sub-http-1',
    back_url: 'https://hospeda.test/return',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 18000,
        currency_id: 'ARS'
    }
} as const;

let activeServer: FakeProviderServer | undefined;
afterEach(async () => {
    await activeServer?.close();
    activeServer = undefined;
});

async function server(args: { readonly clockFile?: string } = {}) {
    const clock = createAdjustableClock({ start: START });
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const http = await startServer({ provider, clock, clockFile: args.clockFile });
    return { clock, provider, http };
}

async function startServer(args: {
    readonly provider: FakePaymentProvider;
    readonly clock: ReturnType<typeof createAdjustableClock>;
    readonly clockFile?: string;
}) {
    activeServer = await startFakeProviderServer({
        provider: args.provider,
        clock: args.clock,
        ...(args.clockFile ? { clockFile: args.clockFile } : {})
    });
    return activeServer;
}

async function postAuthorization(url: string, body: unknown = BASE) {
    return fetch(`${url}/preapproval`, {
        method: 'POST',
        headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function responseJson(response: Response): Promise<Record<string, any>> {
    return response.json() as Promise<Record<string, any>>;
}

describe('fake provider HTTP server', () => {
    it('keeps the broken link raw so the caller can sanitize it', async () => {
        // TEST:B3:43 (soporte): el enlace roto cruza HTTP y se sanea en el consumidor.
        const { http } = await server();
        const created = await responseJson(await postAuthorization(http.url));
        expect(created.init_point).toContain('activation=true');
        expect(sanitizeApprovalUrl({ approvalUrl: created.init_point }).url).not.toContain(
            'activation='
        );
    });

    it('returns a healthy link when M10 is named in the test', async () => {
        // TEST:B3:43 (soporte): la mentira se apaga por nombre y con motivo literal.
        const clock = createAdjustableClock({ start: START });
        const provider = new FakePaymentProvider({
            clock,
            idNamespace: crypto.randomUUID(),
            honestAbout: [{ lie: 'M10', why: 'the case checks the honest link path' }]
        });
        const http = await startServer({ provider, clock });
        const created = await responseJson(await postAuthorization(http.url));
        expect(created.init_point).not.toContain('activation=');
    });

    it('serializes reads from stored state, including the unapplied monthly cadence lie', async () => {
        // TEST:B3:43 (soporte): la lectura vuelve a consultar el estado del falso campo por campo.
        const { http, provider } = await server();
        const created = await responseJson(
            await postAuthorization(http.url, {
                ...BASE,
                auto_recurring: { ...BASE.auto_recurring, frequency: 12 }
            })
        );
        const pending = await responseJson(
            await fetch(`${http.url}/preapproval/${created.id}`, {
                headers: { authorization: 'Bearer test-token' }
            })
        );
        expect(pending).toMatchObject({
            id: created.id,
            external_reference: BASE.external_reference,
            status: 'pending',
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: 18000,
                currency_id: 'ARS'
            },
            init_point: created.init_point
        });
        expect(pending.auto_recurring.free_trial).toBeUndefined();
        await provider.approve({ authorizationId: created.id });
        const authorized = await responseJson(
            await fetch(`${http.url}/preapproval/${created.id}`, {
                headers: { authorization: 'Bearer test-token' }
            })
        );
        expect(authorized.status).toBe('authorized');
        expect(authorized.last_modified).toBe(START.toISOString());
        const futureCreated = await responseJson(
            await postAuthorization(http.url, {
                ...BASE,
                external_reference: 'sub-http-trial',
                auto_recurring: { ...BASE.auto_recurring, start_date: '2026-10-04T03:00:00.000Z' }
            })
        );
        const withFreeTrial = await responseJson(
            await fetch(`${http.url}/preapproval/${futureCreated.id}`, {
                headers: { authorization: 'Bearer test-token' }
            })
        );
        expect(withFreeTrial.auto_recurring.free_trial).toEqual({
            frequency: 3,
            frequency_type: 'days'
        });
    });

    it('advances the fake and atomically writes the shared clock file', async () => {
        // TEST:B3:43 (soporte): el reloj movido se comparte y el falso relee la expiración.
        const directory = mkdtempSync(join(tmpdir(), 'payments-fake-clock-'));
        const clockFile = join(directory, 'clock.json');
        try {
            const clock = createAdjustableClock({ start: START });
            const provider = new FakePaymentProvider({
                clock,
                idNamespace: crypto.randomUUID(),
                honestAbout: [{ lie: 'M11', why: 'the case checks expiration on the honest path' }]
            });
            const http = await startServer({ provider, clock, clockFile });
            const created = await responseJson(await postAuthorization(http.url));
            const advanced = new Date(START.getTime() + FAKE_HONEST_LINK_LIFETIME_MS + 1);
            await http.advanceClock({ ms: FAKE_HONEST_LINK_LIFETIME_MS + 1 });
            expect(http.now()).toEqual(advanced);
            expect(JSON.parse(readFileSync(clockFile, 'utf8'))).toEqual({
                now: advanced.toISOString()
            });
            const read = await responseJson(
                await fetch(`${http.url}/preapproval/${created.id}`, {
                    headers: { authorization: 'Bearer test-token' }
                })
            );
            expect(read.status).toBe('cancelled');
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it('delivers only due notices and preserves repeated channel deliveries', async () => {
        // TEST:B3:43 (soporte): el aviso tardío y repetido se entrega según el reloj.
        const received: { headers: Record<string, string | string[] | undefined>; body: string }[] =
            [];
        const receiver = createServer(async (request, response) => {
            const chunks: Buffer[] = [];
            for await (const chunk of request) chunks.push(Buffer.from(chunk));
            received.push({
                headers: request.headers,
                body: Buffer.concat(chunks).toString('utf8')
            });
            response.end('ok');
        });
        await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
        const address = receiver.address();
        if (!address || typeof address === 'string') throw new Error('receiver did not bind');
        try {
            const { http, provider } = await server();
            const created = await responseJson(await postAuthorization(http.url));
            expect(
                (await http.deliverDue({ to: `http://127.0.0.1:${address.port}/notice` })).delivered
            ).toBe(0);
            expect(received).toHaveLength(0);
            await http.advanceClock({ ms: FAKE_NOTICE_DELAY_MS });
            const delivery = await http.deliverDue({
                to: `http://127.0.0.1:${address.port}/notice`
            });
            expect(delivery.delivered).toBe(1);
            expect(received[0]?.headers['x-notice-channel']).toBe('primary');
            await provider.cancel({ authorizationId: created.id });
            await http.advanceClock({ ms: FAKE_NOTICE_DELAY_MS });
            const repeated = await http.deliverDue({
                to: `http://127.0.0.1:${address.port}/notice`
            });
            expect(repeated.delivered).toBe(2);
            expect(received.slice(1).map((item) => item.headers['x-notice-channel'])).toEqual([
                'primary',
                'primary'
            ]);
        } finally {
            receiver.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
                receiver.close((error) => (error ? reject(error) : resolve()))
            );
        }
    });

    it('rejects unauthenticated requests before they reach the fake and records request time', async () => {
        // TEST:B3:43 (soporte): auth protege el falso y requests captura método, ruta e instante.
        const { http } = await server();
        const unauthorized = await fetch(`${http.url}/preapproval`, {
            method: 'POST',
            body: JSON.stringify(BASE)
        });
        expect(unauthorized.status).toBe(401);
        expect(await responseJson(unauthorized)).toMatchObject({ error: 'UNAUTHORIZED' });
        const absent = await responseJson(
            await fetch(`${http.url}/preapproval/nonexistent`, {
                headers: { authorization: 'Bearer test-token' }
            })
        );
        expect(absent).toMatchObject({ status: 'NOT_FOUND', error: 'NOT_FOUND' });
        expect(http.requests()).toHaveLength(2);
        const before = http.requests()[0];
        expect(before).toMatchObject({
            method: 'POST',
            path: '/preapproval',
            at: START.toISOString(),
            body: BASE
        });
        expect(http.requests()[1]).toMatchObject({
            method: 'GET',
            path: '/preapproval/nonexistent'
        });
        expect((await postAuthorization(http.url)).status).toBe(201);
        expect(http.requests()[1]?.at).toBe(START.toISOString());
    });

    it('switches providers without releasing the listening port', async () => {
        // TEST:B3:43 (soporte): la misma cáscara puede apuntar a otro falso.
        const first = await server();
        const secondProvider = new FakePaymentProvider({
            clock: first.clock,
            idNamespace: crypto.randomUUID()
        });
        first.http.useProvider({ provider: secondProvider });
        const created = await responseJson(await postAuthorization(first.http.url));
        const read = await secondProvider.readAuthorization({ authorizationId: created.id });
        expect(read.snapshot.reference).toBe(BASE.external_reference);
        expect(first.http.port).toBeGreaterThan(0);
    });

    it('frees the port on close', async () => {
        // TEST:B3:43 (soporte): close termina el listener y las conexiones persistentes.
        const current = await server();
        const { port } = current.http;
        await current.http.close();
        activeServer = undefined;
        const replacement = await startFakeProviderServer({
            provider: current.provider,
            clock: current.clock,
            port
        });
        activeServer = replacement;
        expect(replacement.port).toBe(port);
    });
});
