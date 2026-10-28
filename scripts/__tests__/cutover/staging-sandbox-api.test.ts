import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../cutover/provider-api.ts';
import { createStagingSandboxApi } from '../../cutover/staging-sandbox-api.ts';

/** HOS-1951: the two sandbox reads, against a fake `fetch` (no network). */

const BASE = 'https://provider.invalid';
const EMAIL = 'host+1@example.test';

function fakeFetch({
    answer
}: {
    readonly answer: (url: URL) => { readonly status: number; readonly json: unknown };
}) {
    const urls: URL[] = [];
    const headers: Headers[] = [];
    const impl = (async (input: unknown, init?: RequestInit) => {
        const url = new URL(String(input));
        urls.push(url);
        headers.push(new Headers(init?.headers));
        const { status, json } = answer(url);
        return new Response(JSON.stringify(json), { status });
    }) as typeof fetch;
    return { urls, headers, impl };
}

const build = (impl: typeof fetch) =>
    createStagingSandboxApi({
        accessToken: 'tok',
        baseUrl: BASE,
        fetchImpl: impl,
        sleep: async () => {}
    });

describe('HOS-1951 readAccountTags', () => {
    it('reads the tags of GET /users/me with the bearer token', async () => {
        // Arrange
        const { urls, headers, impl } = fakeFetch({
            answer: () => ({ status: 200, json: { id: 1, tags: ['test_user', 'normal'] } })
        });
        // Act
        const tags = await build(impl).readAccountTags();
        // Assert
        expect(tags).toEqual(['test_user', 'normal']);
        expect(urls.map((u) => u.pathname)).toEqual(['/users/me']);
        expect(headers[0]?.get('authorization')).toBe('Bearer tok');
    });

    it('answers no tags when the account carries none', async () => {
        // Arrange
        const { impl } = fakeFetch({ answer: () => ({ status: 200, json: { id: 1 } }) });
        // Act / Assert
        expect(await build(impl).readAccountTags()).toEqual([]);
    });

    it('throws on a non-200 answer', async () => {
        // Arrange
        const { impl } = fakeFetch({ answer: () => ({ status: 401, json: {} }) });
        // Act / Assert
        await expect(build(impl).readAccountTags()).rejects.toBeInstanceOf(ProviderError);
    });
});

describe('HOS-1951 searchPreapprovalsByPayerEmail', () => {
    it('filters by payer_email and walks every page up to the total', async () => {
        // Arrange
        const all = Array.from({ length: 25 }, (_, i) => ({ id: `pre-${i}`, status: 'pending' }));
        const { urls, impl } = fakeFetch({
            answer: (url) => {
                const offset = Number(url.searchParams.get('offset'));
                const limit = Number(url.searchParams.get('limit'));
                return {
                    status: 200,
                    json: { paging: { total: 25 }, results: all.slice(offset, offset + limit) }
                };
            }
        });
        // Act
        const found = await build(impl).searchPreapprovalsByPayerEmail({ payerEmail: EMAIL });
        // Assert
        expect(found.total).toBe(25);
        expect(found.rowsSeen).toBe(25);
        expect(found.ids).toHaveLength(25);
        expect(urls.map((u) => u.pathname)).toEqual(['/preapproval/search', '/preapproval/search']);
        expect(urls.map((u) => u.searchParams.get('payer_email'))).toEqual([EMAIL, EMAIL]);
        expect(urls.map((u) => u.searchParams.get('offset'))).toEqual(['0', '20']);
        expect(urls.every((u) => !u.searchParams.has('status'))).toBe(true);
    });

    it('stops on an empty page, leaving the count short of the total', async () => {
        // Arrange
        const { impl } = fakeFetch({
            answer: (url) => ({
                status: 200,
                json: {
                    paging: { total: 3 },
                    results: url.searchParams.get('offset') === '0' ? [{ id: 7 }] : []
                }
            })
        });
        // Act
        const found = await build(impl).searchPreapprovalsByPayerEmail({ payerEmail: EMAIL });
        // Assert
        expect(found).toEqual({ total: 3, ids: ['7'], rowsSeen: 1 });
    });

    it('throws without the email in the message on an unusable answer', async () => {
        // Arrange
        const { impl } = fakeFetch({ answer: () => ({ status: 500, json: null }) });
        // Act
        const error = await build(impl)
            .searchPreapprovalsByPayerEmail({ payerEmail: EMAIL })
            .catch((e: unknown) => e);
        // Assert
        expect(error).toBeInstanceOf(ProviderError);
        expect(String((error as Error).message)).not.toContain('example.test');
    });
});
