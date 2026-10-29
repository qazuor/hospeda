import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../cutover/provider-api.ts';
import { createRehearsalSandboxApi } from '../../cutover/rehearsal-sandbox-api.ts';

/** HOS-1957: the sandbox calls of the rehearsal sandbox-id rewrite, over a fake fetch. */

interface Sent {
    readonly method: string;
    readonly url: string;
    readonly body: unknown;
    readonly headers: Readonly<Record<string, string>>;
}

function fakeFetch({ status, json }: { readonly status: number; readonly json: unknown }): {
    readonly fetchImpl: typeof fetch;
    readonly sent: Sent[];
} {
    const sent: Sent[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
        sent.push({
            method: String(init.method),
            url,
            body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
            headers: init.headers as Record<string, string>
        });
        return new Response(JSON.stringify(json), { status });
    }) as unknown as typeof fetch;
    return { fetchImpl, sent };
}

const noSleep = async (): Promise<void> => undefined;

describe('HOS-1957 rehearsal sandbox api', () => {
    it('lookup answers found on 200 and not-found on 404, by id', async () => {
        // Arrange
        const ok = fakeFetch({ status: 200, json: { id: 'x', status: 'active' } });
        const missing = fakeFetch({ status: 404, json: { message: 'not found' } });
        // Act
        const found = await createRehearsalSandboxApi({
            accessToken: 't',
            fetchImpl: ok.fetchImpl
        }).lookup({
            kind: 'plan',
            id: 'plan-1'
        });
        const notFound = await createRehearsalSandboxApi({
            accessToken: 't',
            fetchImpl: missing.fetchImpl
        }).lookup({ kind: 'preapproval', id: 'pre-1' });
        // Assert
        expect(found).toBe('found');
        expect(notFound).toBe('not-found');
        expect(ok.sent[0]?.url).toBe('https://api.mercadopago.com/preapproval_plan/plan-1');
        expect(missing.sent[0]?.url).toBe('https://api.mercadopago.com/preapproval/pre-1');
    });

    it('lookup fails closed on any other status (a 401 is not read as not-found)', async () => {
        // Arrange
        const { fetchImpl } = fakeFetch({ status: 401, json: {} });
        const api = createRehearsalSandboxApi({ accessToken: 't', fetchImpl, sleep: noSleep });
        // Act / Assert
        await expect(api.lookup({ kind: 'plan', id: 'p' })).rejects.toBeInstanceOf(ProviderError);
    });

    it('lookup refuses a malformed id without calling the provider', async () => {
        // Arrange
        const { fetchImpl, sent } = fakeFetch({ status: 200, json: {} });
        const api = createRehearsalSandboxApi({ accessToken: 't', fetchImpl });
        // Act / Assert
        await expect(api.lookup({ kind: 'plan', id: '../users/me' })).rejects.toBeInstanceOf(
            ProviderError
        );
        expect(sent).toHaveLength(0);
    });

    it('creates a pending preapproval bound to no plan, with the idempotency key', async () => {
        // Arrange
        const { fetchImpl, sent } = fakeFetch({ status: 201, json: { id: 'sbx-pre-1' } });
        const api = createRehearsalSandboxApi({ accessToken: 't', fetchImpl });
        // Act
        const id = await api.createPreapproval({
            payerEmail: 'buyer@testuser.com',
            idempotencyKey: 'k-1'
        });
        // Assert
        expect(id).toBe('sbx-pre-1');
        expect(sent[0]?.method).toBe('POST');
        expect(sent[0]?.url).toBe('https://api.mercadopago.com/preapproval');
        expect(sent[0]?.headers['X-Idempotency-Key']).toBe('k-1');
        expect(sent[0]?.body).toMatchObject({
            status: 'pending',
            payer_email: 'buyer@testuser.com'
        });
        expect(sent[0]?.body).not.toHaveProperty('preapproval_plan_id');
    });

    it('creates a plan and turns a refused creation into an error that carries no payload', async () => {
        // Arrange
        const ok = fakeFetch({ status: 201, json: { id: 123 } });
        const refused = fakeFetch({
            status: 400,
            json: { message: 'payer buyer@testuser.com invalid' }
        });
        // Act
        const id = await createRehearsalSandboxApi({
            accessToken: 't',
            fetchImpl: ok.fetchImpl
        }).createPlan({
            idempotencyKey: 'k'
        });
        const failure = await createRehearsalSandboxApi({
            accessToken: 't',
            fetchImpl: refused.fetchImpl
        })
            .createPreapproval({ payerEmail: 'buyer@testuser.com', idempotencyKey: 'k' })
            .catch((error: unknown) => error);
        // Assert
        expect(id).toBe('123');
        expect(ok.sent[0]?.url).toBe('https://api.mercadopago.com/preapproval_plan');
        expect(failure).toBeInstanceOf(ProviderError);
        expect(String((failure as Error).message)).not.toContain('@');
    });
});
