/**
 * @file mcp-discovery.test.ts
 * @description Unit tests for the MCP URL discovery (HOS-2184 T-028).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpUrl, MCP_DISCOVERY_PATH, resetMcpUrlCache } from '../../src/lib/mcp-discovery';

vi.mock('../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.x',
    getInternalApiUrl: () => undefined
}));

const API = 'https://api.x/';
const MCP = 'https://api.x/mcp';

function reply(status: number, body: unknown = {}): Response {
    return { status, json: async () => body } as Response;
}

describe('getMcpUrl', () => {
    beforeEach(() => {
        resetMcpUrlCache();
    });

    it('returns the published resource byte for byte when the feature is on', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(reply(200, { resource: MCP }));
        expect(await getMcpUrl({ apiUrl: API, fetchImpl })).toBe(MCP);
        expect(fetchImpl.mock.calls[0]?.[0]).toBe(`https://api.x${MCP_DISCOVERY_PATH}`);
    });

    it('returns null when the API answers 404 (feature off)', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(reply(404));
        expect(await getMcpUrl({ apiUrl: API, fetchImpl })).toBeNull();
    });

    it('returns null on a malformed body or a network error', async () => {
        const bad = vi.fn().mockResolvedValue(reply(200, { resource: 'nope' }));
        expect(await getMcpUrl({ apiUrl: API, fetchImpl: bad })).toBeNull();
        resetMcpUrlCache();
        const down = vi.fn().mockRejectedValue(new Error('down'));
        expect(await getMcpUrl({ apiUrl: API, fetchImpl: down })).toBeNull();
    });

    it('serves from cache inside the TTL', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(reply(200, { resource: MCP }));
        await getMcpUrl({ apiUrl: API, fetchImpl, now: () => 0 });
        await getMcpUrl({ apiUrl: API, fetchImpl, now: () => 30_000 });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('serves the stale value after expiry and refreshes in the background', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(reply(200, { resource: MCP }))
            .mockResolvedValueOnce(reply(404));
        await getMcpUrl({ apiUrl: API, fetchImpl, now: () => 0 });

        const stale = await getMcpUrl({ apiUrl: API, fetchImpl, now: () => 120_000 });
        expect(stale).toBe(MCP);

        await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
        await vi.waitFor(async () =>
            expect(await getMcpUrl({ apiUrl: API, fetchImpl, now: () => 120_001 })).toBeNull()
        );
    });
});
