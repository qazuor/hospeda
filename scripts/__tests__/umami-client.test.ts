import { describe, expect, it } from 'vitest';
import {
    loginUmami,
    type ReportDefinition,
    UmamiApiError,
    type UmamiClientConfig,
    upsertBoard,
    upsertReport
} from '../umami/client.js';

const TOKEN = 'tok-SECRET-123';
const WEBSITE = 'w1';

interface Call {
    readonly method: string;
    readonly url: string;
    readonly headers: Record<string, string>;
    readonly body: unknown;
}

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

function setup(input: {
    reports?: readonly unknown[];
    boards?: readonly unknown[];
    respond?: (call: Call) => Response | undefined;
    dryRun?: boolean;
}): { config: UmamiClientConfig; calls: Call[] } {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
        const call: Call = {
            method: init?.method ?? 'GET',
            url: String(url),
            headers: (init?.headers ?? {}) as Record<string, string>,
            body: init?.body ? JSON.parse(String(init.body)) : undefined
        };
        calls.push(call);
        const custom = input.respond?.(call);
        if (custom) return custom;
        const path = new URL(call.url).pathname;
        if (call.method === 'GET' && path === '/api/reports') {
            const data = input.reports ?? [];
            return json(200, { data, count: data.length, page: 1, pageSize: 100 });
        }
        if (call.method === 'GET' && path === '/api/boards') {
            const data = input.boards ?? [];
            return json(200, { data, count: data.length, page: 1, pageSize: 100 });
        }
        const id = path.split('/').pop() ?? 'new';
        const stored = {
            id: id === 'reports' || id === 'boards' ? 'new' : id,
            websiteId: WEBSITE,
            ...(call.body as object)
        };
        return json(200, stored);
    }) as typeof fetch;
    return {
        config: {
            baseUrl: 'http://umami.test/',
            token: TOKEN,
            fetchImpl,
            ...(input.dryRun === undefined ? {} : { dryRun: input.dryRun })
        },
        calls
    };
}

const definition: ReportDefinition = {
    websiteId: WEBSITE,
    type: 'funnel',
    name: 'Contact funnel',
    parameters: { window: 30, steps: [{ type: 'event', value: 'a' }] }
};
const stored = {
    id: 'r1',
    websiteId: WEBSITE,
    type: 'funnel',
    name: 'Contact funnel',
    description: '',
    // Key order differs on purpose: Umami reorders parameters.
    parameters: { steps: [{ value: 'a', type: 'event' }], window: 30 }
};
const writes = (calls: Call[]) => calls.filter((c) => c.method !== 'GET');

describe('upsertReport', () => {
    it('creates when absent', async () => {
        const { config, calls } = setup({ reports: [] });
        const result = await upsertReport({ config, definition });
        expect(result.action).toBe('created');
        expect(writes(calls)).toHaveLength(1);
        expect(writes(calls)[0]).toMatchObject({ method: 'POST' });
        expect(new URL(writes(calls)[0]?.url ?? '').pathname).toBe('/api/reports');
    });

    it('updates when present and different', async () => {
        const { config, calls } = setup({ reports: [{ ...stored, parameters: { window: 60 } }] });
        const result = await upsertReport({ config, definition });
        expect(result.action).toBe('updated');
        expect(new URL(writes(calls)[0]?.url ?? '').pathname).toBe('/api/reports/r1');
    });

    it('is a no-op when equal regardless of key order', async () => {
        const { config, calls } = setup({ reports: [stored] });
        const result = await upsertReport({ config, definition });
        expect(result.action).toBe('unchanged');
        expect(writes(calls)).toHaveLength(0);
    });

    it('ignores same-named reports of another website scope via the query', async () => {
        const { config, calls } = setup({ reports: [] });
        await upsertReport({ config, definition });
        expect(new URL(calls[0]?.url ?? '').searchParams.get('websiteId')).toBe(WEBSITE);
    });

    it.each([
        ['absent', [] as unknown[], 'created'],
        ['different', [{ ...stored, parameters: { window: 1 } }], 'updated'],
        ['equal', [stored], 'unchanged']
    ])('performs no write in dry-run when %s', async (_label, reports, action) => {
        const { config, calls } = setup({ reports, dryRun: true });
        const result = await upsertReport({ config, definition });
        expect(result).toMatchObject({ action, dryRun: true });
        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every((c) => c.method === 'GET')).toBe(true);
    });

    it('refuses to guess when the name is ambiguous', async () => {
        const { config } = setup({ reports: [stored, { ...stored, id: 'r2' }] });
        await expect(upsertReport({ config, definition })).rejects.toMatchObject({
            kind: 'ambiguous'
        });
    });
});

describe('upsertBoard', () => {
    const board = { type: 'website', name: 'Resumen', parameters: { websiteId: WEBSITE } } as const;

    it('creates, updates and no-ops', async () => {
        const created = setup({ boards: [] });
        expect((await upsertBoard({ config: created.config, definition: board })).action).toBe(
            'created'
        );
        const existing = { id: 'b1', description: '', ...board };
        const same = setup({ boards: [existing] });
        expect((await upsertBoard({ config: same.config, definition: board })).action).toBe(
            'unchanged'
        );
        expect(writes(same.calls)).toHaveLength(0);
        const diff = setup({ boards: [{ ...existing, description: 'old' }] });
        expect((await upsertBoard({ config: diff.config, definition: board })).action).toBe(
            'updated'
        );
        expect(new URL(writes(diff.calls)[0]?.url ?? '').pathname).toBe('/api/boards/b1');
    });

    it('does not write in dry-run', async () => {
        const { config, calls } = setup({ boards: [], dryRun: true });
        const result = await upsertBoard({ config, definition: board });
        expect(result).toMatchObject({ action: 'created', dryRun: true, resource: null });
        expect(writes(calls)).toHaveLength(0);
    });
});

describe('transport', () => {
    it('sends the bearer credential on every request', async () => {
        const { config, calls } = setup({ reports: [stored] });
        await upsertReport({ config, definition });
        expect(calls[0]?.headers.Authorization).toBe(['Bearer', TOKEN].join(' '));
    });

    it('surfaces an API error as UmamiApiError without the token', async () => {
        const { config } = setup({
            respond: () => json(500, { error: `boom ${TOKEN}` })
        });
        const error = await upsertReport({ config, definition }).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(UmamiApiError);
        const typed = error as UmamiApiError;
        expect(typed.status).toBe(500);
        expect(typed.endpoint).toBe('/api/reports');
        expect(typed.kind).toBe('http');
        expect(typed.message).not.toContain(TOKEN);
        expect(JSON.stringify(typed)).not.toContain(TOKEN);
    });

    it('wraps network failures without the token', async () => {
        const { config } = setup({});
        const failing: UmamiClientConfig = {
            ...config,
            fetchImpl: (async () => {
                throw new Error(`down ${TOKEN}`);
            }) as typeof fetch
        };
        const error = (await upsertReport({ config: failing, definition }).catch(
            (e: unknown) => e
        )) as UmamiApiError;
        expect(error.kind).toBe('network');
        expect(error.status).toBe(0);
        expect(error.message).not.toContain(TOKEN);
    });

    it('raises a typed schema error when the response shape is wrong', async () => {
        const { config } = setup({ respond: () => json(200, { unexpected: true }) });
        await expect(upsertReport({ config, definition })).rejects.toMatchObject({
            kind: 'schema',
            endpoint: '/api/reports'
        });
    });

    it('raises a schema error for a malformed list item', async () => {
        const { config } = setup({ reports: [{ id: 5 }] });
        await expect(upsertReport({ config, definition })).rejects.toMatchObject({
            kind: 'schema'
        });
    });

    it('logs in and returns the token; failures never echo the password', async () => {
        const ok = await loginUmami({
            baseUrl: 'http://umami.test',
            username: 'a',
            password: 'pw-SECRET',
            fetchImpl: (async () => json(200, { token: 'abc', user: {} })) as typeof fetch
        });
        expect(ok).toBe('abc');
        const error = (await loginUmami({
            baseUrl: 'http://umami.test',
            username: 'a',
            password: 'pw-SECRET',
            fetchImpl: (async () => json(401, { error: 'no' })) as typeof fetch
        }).catch((e: unknown) => e)) as UmamiApiError;
        expect(error.status).toBe(401);
        expect(error.message).not.toContain('pw-SECRET');
    });
});
