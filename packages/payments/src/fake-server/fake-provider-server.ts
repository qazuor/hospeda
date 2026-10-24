import { rename, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { PaymentProviderError } from '../provider/errors';
import { AuthorizeInputSchema } from '../provider/schemas';
import { handleExtraRoutes } from './extra-routes';
import {
    type MercadoPagoDeliveriesResult,
    translateMercadoPagoDeliveries
} from './mercadopago-deliveries';
import { serializeAuthorization } from './serialize-authorization';
import { serializeCharge } from './serialize-charge';

export interface AdjustableFakeServerClock {
    now(): Date;
    advance(args: { readonly ms: number }): void;
    set(args: { readonly at: Date }): void;
}

export interface FakeProviderServerOptions {
    readonly provider: FakePaymentProvider;
    readonly clock: AdjustableFakeServerClock;
    readonly port?: number;
    readonly host?: string;
    readonly clockFile?: string;
}

export interface FakeProviderRequest {
    readonly method: string;
    readonly path: string;
    readonly body: unknown;
    readonly headers?: Readonly<Record<string, string | undefined>>;
    readonly at: string;
}

export interface FakeProviderServer {
    readonly url: string;
    readonly port: number;
    readonly provider: FakePaymentProvider;
    useProvider(args: { readonly provider: FakePaymentProvider }): void;
    now(): Date;
    advanceClock(args: { readonly ms: number }): Promise<void>;
    setClock(args: { readonly at: Date }): Promise<void>;
    requests(): readonly FakeProviderRequest[];
    deliverDue(args: { readonly to: string }): Promise<{ readonly delivered: number }>;
    mercadoPagoDeliveries(args?: { readonly webhookSecret?: string }): MercadoPagoDeliveriesResult;
    deliverDueAsMercadoPago(args: {
        readonly to: string;
        readonly webhookSecret?: string;
    }): Promise<{ readonly delivered: number; readonly skipped: number }>;
    close(): Promise<void>;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function objectBody(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError('Request body must be a JSON object');
    }
    return value as Record<string, unknown>;
}

function statusFor(error: PaymentProviderError): number {
    switch (error.code) {
        case 'NOT_FOUND':
            return 404;
        case 'INVALID_INPUT':
        case 'REJECTED':
            return 400;
        case 'UNAVAILABLE':
            return 503;
        case 'UNSUPPORTED':
            return 422;
        case 'NOT_IMPLEMENTED':
            return 501;
        case 'INVALID_NOTICE':
            return 400;
    }
}

function errorBody(error: PaymentProviderError): Readonly<Record<string, string>> {
    return { message: error.message, status: error.code, error: error.code };
}

async function writeClockFile(args: { readonly path: string; readonly now: Date }): Promise<void> {
    const temporary = `${args.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ now: args.now.toISOString() })}\n`, 'utf8');
    await rename(temporary, args.path);
}

export async function startFakeProviderServer(
    options: FakeProviderServerOptions
): Promise<FakeProviderServer> {
    const requests: FakeProviderRequest[] = [];
    const initPoints = new Map<string, string>();
    const refundAmounts = new Map<string, number>();
    let provider = options.provider;
    const recordRequest = (args: Omit<FakeProviderRequest, 'at'>) => {
        requests.push({ ...args, at: options.clock.now().toISOString() });
    };

    const server: Server = createServer(async (request, response) => {
        const method = request.method ?? 'GET';
        const path = request.url ?? '/';
        const validAuthorization = /^Bearer .+\S$/.test(request.headers.authorization ?? '');
        const missingRefundKey =
            method === 'POST' &&
            /^\/v1\/payments\/[^/?]+\/refunds(?:\?|$)/.test(path) &&
            (typeof request.headers['x-idempotency-key'] !== 'string' ||
                request.headers['x-idempotency-key'].length === 0);
        if (validAuthorization && missingRefundKey) {
            recordRequest({
                method,
                path,
                body: null,
                headers: { 'X-Idempotency-Key': undefined }
            });
            sendJson(response, 400, {
                code: 4292,
                message: "Header X-Idempotency-Key can't be null",
                status: 400
            });
            return;
        }
        let body: unknown;
        try {
            body = await readJson(request);
        } catch {
            recordRequest({
                method: request.method ?? 'GET',
                path: request.url ?? '/',
                body: null
            });
            sendJson(response, 400, {
                message: 'Invalid JSON',
                status: 'INVALID_INPUT',
                error: 'INVALID_INPUT'
            });
            return;
        }
        recordRequest({
            method,
            path,
            body,
            headers: {
                'X-Idempotency-Key': Array.isArray(request.headers['x-idempotency-key'])
                    ? request.headers['x-idempotency-key'][0]
                    : request.headers['x-idempotency-key']
            }
        });
        if (!/^Bearer .+\S$/.test(request.headers.authorization ?? '')) {
            sendJson(response, 401, {
                message: 'Authorization required',
                status: 'UNAUTHORIZED',
                error: 'UNAUTHORIZED'
            });
            return;
        }
        try {
            const extra = await handleExtraRoutes({
                provider,
                method,
                url: new URL(path, 'http://fake.invalid'),
                headers: request.headers,
                body,
                refundAmounts,
                now: options.clock.now()
            });
            if (extra !== null) {
                if (extra.body === undefined) response.writeHead(extra.status).end();
                else sendJson(response, extra.status, extra.body);
                return;
            }
            if (method === 'POST' && path === '/preapproval') {
                const resource = objectBody(body);
                const recurring = objectBody(resource.auto_recurring);
                const parsed = AuthorizeInputSchema.parse({
                    reference: String(resource.external_reference ?? ''),
                    amount: {
                        amountMinor: Math.round(Number(recurring.transaction_amount) * 100),
                        currency: recurring.currency_id
                    },
                    cadence: { everyMonths: recurring.frequency },
                    reason: resource.reason,
                    returnUrl: resource.back_url,
                    ...(resource.payer_email === undefined
                        ? {}
                        : { payerEmail: resource.payer_email }),
                    ...(resource.card_token_id === undefined
                        ? {}
                        : { paymentToken: resource.card_token_id }),
                    ...(recurring.start_date === undefined
                        ? {}
                        : { firstChargeAt: recurring.start_date })
                });
                const created = await provider.authorize(parsed);
                initPoints.set(created.authorizationId, created.approvalUrl);
                const read = await provider.readAuthorization({
                    authorizationId: created.authorizationId
                });
                sendJson(response, 201, {
                    ...serializeAuthorization({
                        snapshot: read.snapshot,
                        initPoint: created.approvalUrl
                    }),
                    init_point: created.approvalUrl
                });
                return;
            }
            const match = /^\/preapproval\/([^/?]+)$/.exec(path);
            const matchedId = match?.[1];
            if (matchedId && method === 'GET') {
                const authorizationId = decodeURIComponent(matchedId);
                const read = await provider.readAuthorization({ authorizationId });
                sendJson(
                    response,
                    200,
                    serializeAuthorization({
                        snapshot: read.snapshot,
                        initPoint: initPoints.get(authorizationId) ?? ''
                    })
                );
                return;
            }
            if (matchedId && method === 'PUT') {
                const resource =
                    typeof body === 'object' && body !== null && !Array.isArray(body)
                        ? (body as Record<string, unknown>)
                        : {};
                const fields = Object.keys(resource);
                const authorizationId = decodeURIComponent(matchedId);
                if (fields.length !== 1) {
                    sendJson(response, 400, {
                        message: 'Invalid preapproval update',
                        status: 'INVALID_INPUT',
                        error: 'INVALID_INPUT'
                    });
                    return;
                }
                if (fields[0] === 'status' && resource.status === 'cancelled') {
                    await provider.cancel({ authorizationId });
                } else if (fields[0] === 'status' && resource.status === 'paused') {
                    await provider.pause({ authorizationId });
                } else if (fields[0] === 'status' && resource.status === 'authorized') {
                    await provider.resume({ authorizationId });
                } else if (fields[0] === 'auto_recurring') {
                    const recurring = resource.auto_recurring;
                    if (
                        typeof recurring !== 'object' ||
                        recurring === null ||
                        Array.isArray(recurring) ||
                        Object.keys(recurring).length !== 2 ||
                        !('transaction_amount' in recurring) ||
                        !('currency_id' in recurring) ||
                        typeof recurring.currency_id !== 'string'
                    ) {
                        sendJson(response, 400, {
                            status: 'INVALID_INPUT',
                            error: 'INVALID_INPUT'
                        });
                        return;
                    }
                    await provider.changeAmount({
                        authorizationId,
                        amount: {
                            amountMinor: Math.round(Number(recurring.transaction_amount) * 100),
                            currency: recurring.currency_id
                        }
                    });
                } else {
                    sendJson(response, 400, {
                        status: 'INVALID_INPUT',
                        error: 'INVALID_INPUT'
                    });
                    return;
                }
                const read = await provider.readAuthorization({ authorizationId });
                sendJson(
                    response,
                    200,
                    serializeAuthorization({
                        snapshot: read.snapshot,
                        initPoint: initPoints.get(authorizationId) ?? ''
                    })
                );
                return;
            }
            const paymentMatch = /^\/v1\/payments\/([^/?]+)$/.exec(path);
            const paymentId = paymentMatch?.[1];
            if (paymentId && method === 'GET') {
                const read = await provider.readCharge({ chargeId: decodeURIComponent(paymentId) });
                sendJson(response, 200, serializeCharge({ snapshot: read.snapshot }));
                return;
            }
            sendJson(response, 404, {
                message: 'Route not found',
                status: 'NOT_FOUND',
                error: 'NOT_FOUND'
            });
        } catch (error) {
            if (error instanceof PaymentProviderError) {
                sendJson(response, statusFor(error), errorBody(error));
                return;
            }
            sendJson(response, 400, {
                message: error instanceof Error ? error.message : 'Invalid request',
                status: 'INVALID_INPUT',
                error: 'INVALID_INPUT'
            });
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 0, options.host ?? '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
        });
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine server port');
    if (options.clockFile)
        await writeClockFile({ path: options.clockFile, now: options.clock.now() });

    return {
        get url() {
            return `http://${options.host ?? '127.0.0.1'}:${address.port}`;
        },
        port: address.port,
        get provider() {
            return provider;
        },
        useProvider(args) {
            provider = args.provider;
        },
        now() {
            return options.clock.now();
        },
        async advanceClock(args) {
            options.clock.advance({ ms: args.ms });
            if (options.clockFile)
                await writeClockFile({ path: options.clockFile, now: options.clock.now() });
        },
        async setClock(args) {
            options.clock.set({ at: args.at });
            if (options.clockFile)
                await writeClockFile({ path: options.clockFile, now: options.clock.now() });
        },
        requests() {
            return structuredClone(requests);
        },
        async deliverDue(args) {
            const destination = new URL(args.to);
            if (!['http:', 'https:'].includes(destination.protocol) || !destination.hostname)
                throw new Error('A valid HTTP destination is required');
            const { deliveries } = provider.takeDeliveries();
            for (const delivery of deliveries) {
                const response = await fetch(destination, {
                    method: 'POST',
                    headers: delivery.headers,
                    body: delivery.body
                });
                if (!response.ok) throw new Error(`Delivery failed with HTTP ${response.status}`);
            }
            return { delivered: deliveries.length };
        },
        mercadoPagoDeliveries(args = {}) {
            const taken = provider.takeDeliveries();
            return translateMercadoPagoDeliveries({
                deliveries: taken.deliveries,
                now: options.clock.now(),
                ...(args.webhookSecret === undefined ? {} : { webhookSecret: args.webhookSecret })
            });
        },
        async deliverDueAsMercadoPago(args) {
            const destination = new URL(args.to);
            if (!['http:', 'https:'].includes(destination.protocol) || !destination.hostname)
                throw new Error('A valid HTTP destination is required');
            const due = provider.takeDeliveries();
            const translated = translateMercadoPagoDeliveries({
                deliveries: due.deliveries,
                now: options.clock.now(),
                ...(args.webhookSecret === undefined ? {} : { webhookSecret: args.webhookSecret })
            });
            for (const delivery of translated.deliveries) {
                const response = await fetch(`${args.to}?${delivery.query}`, {
                    method: 'POST',
                    headers: delivery.headers,
                    body: delivery.body
                });
                if (!response.ok)
                    throw new Error(
                        `Mercado Pago ${delivery.channel} delivery failed with HTTP ${response.status}`
                    );
            }
            return { delivered: translated.deliveries.length, skipped: translated.skipped };
        },
        async close() {
            server.closeAllConnections();
            await new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            );
        }
    };
}
