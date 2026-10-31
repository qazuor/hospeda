import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkAll } from '../../cutover/census.ts';
import { readProbeManifest } from '../../cutover/probe-manifest.ts';
import { createProviderApi, ProviderError } from '../../cutover/provider-api.ts';

const TOKEN = 'test-token-value-1234';
const BASE = 'https://provider.invalid';

interface Seen {
    readonly method: string;
    readonly url: string;
    readonly body: string | undefined;
}

function fakeFetch({
    answer
}: {
    readonly answer: (seen: Seen, attempt: number) => { status: number; json: unknown };
}) {
    const seen: Seen[] = [];
    const impl = (async (input: unknown, init?: RequestInit) => {
        const entry: Seen = {
            method: init?.method ?? 'GET',
            url: String(input),
            body: typeof init?.body === 'string' ? init.body : undefined
        };
        seen.push(entry);
        const { status, json } = answer(entry, seen.length);
        return new Response(JSON.stringify(json), { status });
    }) as typeof fetch;
    return { seen, impl };
}

const noSleep = async () => {};

describe('TEST:1402:3 preapproval plan id (AC:1402:2)', () => {
    it.each([
        [{ preapproval_plan_id: 'plan-1' }, 'plan-1'],
        [{ preapproval_plan_id: 42 }, '42'],
        [{}, null],
        [{ preapproval_plan_id: null }, null]
    ])('reads only a preapproval plan id by id', async (fields, expected) => {
        // Arrange
        const { seen, impl } = fakeFetch({
            answer: () => ({ status: 200, json: { id: 'pre-1', status: 'authorized', ...fields } })
        });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const result = await api.getById({ kind: 'preapproval', id: 'pre-1' });
        // Assert
        expect(result.planId).toBe(expected);
        expect(seen).toEqual([
            { method: 'GET', url: `${BASE}/preapproval/pre-1`, body: undefined }
        ]);
    });

    it('does not read a plan id from a plan response', async () => {
        // Arrange
        const { impl } = fakeFetch({
            answer: () => ({
                status: 200,
                json: { id: 'plan-1', status: 'active', preapproval_plan_id: 'other' }
            })
        });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const result = await api.getById({ kind: 'plan', id: 'plan-1' });
        // Assert
        expect(result.planId).toBeUndefined();
    });
});

describe('provider client over fetch', () => {
    it('walks the search without any filter, paginated, and never leaks person data into results', async () => {
        // Arrange: 3 rows over pages of 100 via a fake that serves 2 then 1
        const rows = ['a', 'b', 'c'].map((id) => ({
            id,
            status: 'authorized',
            payer_email: 'x@y.z'
        }));
        const { seen, impl } = fakeFetch({
            answer: (s) => {
                const offset = Number(new URL(s.url).searchParams.get('offset'));
                const results = rows.slice(offset, offset + 2);
                return { status: 200, json: { paging: { total: 3, offset, limit: 2 }, results } };
            }
        });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const walk = await walkAll({ api, kind: 'preapproval' });
        // Assert
        expect(walk.total).toBe(3);
        expect([...walk.ids]).toEqual(['a', 'b', 'c']);
        for (const s of seen) {
            const params = [...new URL(s.url).searchParams.keys()].sort();
            expect(params).toEqual(['limit', 'offset']);
            expect(new URL(s.url).pathname).toBe('/preapproval/search');
        }
        expect(JSON.stringify([...walk.ids])).not.toContain('@');
    });

    it('sets a plan inactive and a preapproval cancelled, by id', async () => {
        // Arrange
        const { seen, impl } = fakeFetch({ answer: () => ({ status: 200, json: {} }) });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const plan = await api.cancel({ kind: 'plan', id: 'p1' });
        const pre = await api.cancel({ kind: 'preapproval', id: 'x-9' });
        // Assert
        expect(plan.accepted && pre.accepted).toBe(true);
        expect(seen[0]).toMatchObject({ method: 'PUT', url: `${BASE}/preapproval_plan/p1` });
        expect(JSON.parse(seen[0]?.body ?? '{}')).toEqual({ status: 'inactive' });
        expect(seen[1]).toMatchObject({ method: 'PUT', url: `${BASE}/preapproval/x-9` });
        expect(JSON.parse(seen[1]?.body ?? '{}')).toEqual({ status: 'cancelled' });
    });

    it('flags only the 400 "already ended" refusal of a preapproval (HOS-1961)', async () => {
        // Arrange
        const ended = {
            status: 400,
            json: { message: 'This subscription has already ended and cannot be modified' }
        };
        const other = { status: 400, json: { message: 'invalid transaction_amount' } };
        const answers = [ended, other, ended];
        const { impl } = fakeFetch({ answer: (_s, attempt) => answers[attempt - 1] ?? ended });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const first = await api.cancel({ kind: 'preapproval', id: 'x-1' });
        const second = await api.cancel({ kind: 'preapproval', id: 'x-2' });
        const plan = await api.cancel({ kind: 'plan', id: 'p-1' });
        // Assert
        expect(first).toEqual({ accepted: false, httpStatus: 400, alreadyEnded: true });
        expect(second).toEqual({ accepted: false, httpStatus: 400 });
        expect(plan.alreadyEnded).toBeUndefined();
    });

    it('reads auto_recurring.end_date of a preapproval by id (HOS-1961)', async () => {
        // Arrange
        const { impl } = fakeFetch({
            answer: () => ({
                status: 200,
                json: {
                    id: 'q',
                    status: 'authorized',
                    auto_recurring: { end_date: '2026-09-16T00:00:00.000-04:00' }
                }
            })
        });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const found = await api.getById({ kind: 'preapproval', id: 'q' });
        // Assert
        expect(found.endDate).toBe('2026-09-16T00:00:00.000-04:00');
    });

    it('retries a 429 and then succeeds', async () => {
        // Arrange
        const { seen, impl } = fakeFetch({
            answer: (_s, attempt) =>
                attempt < 3
                    ? { status: 429, json: { message: 'local_rate_limited' } }
                    : { status: 200, json: { id: 'q', status: 'cancelled' } }
        });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const found = await api.getById({ kind: 'preapproval', id: 'q' });
        // Assert
        expect(found.status).toBe('cancelled');
        expect(seen).toHaveLength(3);
    });

    it('never puts the token or the provider body in an error, and refuses malformed ids', async () => {
        // Arrange
        const { impl } = fakeFetch({
            answer: () => ({ status: 403, json: { message: `secret ${TOKEN} person@example.com` } })
        });
        const api = createProviderApi({
            accessToken: TOKEN,
            baseUrl: BASE,
            fetchImpl: impl,
            sleep: noSleep
        });
        // Act
        const failure = await api
            .getById({ kind: 'preapproval', id: 'ok' })
            .catch((e: unknown) => e);
        const malformed = await api
            .getById({ kind: 'preapproval', id: '../x?y=1' })
            .catch((e: unknown) => e);
        // Assert
        expect(failure).toBeInstanceOf(ProviderError);
        expect(String((failure as Error).message)).not.toContain(TOKEN);
        expect(String((failure as Error).message)).not.toContain('person@');
        expect(malformed).toBeInstanceOf(ProviderError);
    });
});

describe('probe manifest read by path', () => {
    function write(content: string): string {
        const dir = mkdtempSync(path.join(tmpdir(), 'probes-'));
        const file = path.join(dir, 'probes.json');
        writeFileSync(file, content);
        return file;
    }

    it('reads ids from a JSON file and deduplicates', () => {
        expect(readProbeManifest({ path: write('{"ids":["a","b","a"]}') })).toEqual(['a', 'b']);
    });

    it('rejects a file that does not match the schema or is missing', () => {
        expect(() => readProbeManifest({ path: write('{"ids":[1]}') })).toThrow(/does not match/);
        expect(() => readProbeManifest({ path: write('nope') })).toThrow(/not valid JSON/);
        expect(() => readProbeManifest({ path: '/nonexistent/probes.json' })).toThrow(
            /not found or unreadable/
        );
    });
});
