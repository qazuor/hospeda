/**
 * @file health.test.ts
 * @description Tests for the container liveness probe.
 *
 * The interesting properties here are all negative, because this endpoint's
 * value comes from what it REFUSES to depend on. Coolify aborts a deploy when
 * this probe fails, so every dependency it acquires converts that dependency's
 * outage into "web deploys stop applying". `does not touch the network` and
 * `answers with no environment at all` are therefore the load-bearing cases —
 * a future edit that adds an API ping here would still return 200 in the happy
 * path and would only reveal itself during an unrelated incident.
 *
 * `no-store` is asserted for the same reason it is set: an edge-cached health
 * response could report a container healthy after it has been torn down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../src/pages/api/health';

/** The route ignores its context entirely; this documents that. */
const CONTEXT = {} as Parameters<typeof GET>[0];

describe('GET /api/health/', () => {
    it('answers 200', async () => {
        const response = await GET(CONTEXT);

        expect(response.status).toBe(200);
    });

    it('reports ok as JSON', async () => {
        const response = await GET(CONTEXT);

        expect(response.headers.get('content-type')).toBe('application/json');
        await expect(response.json()).resolves.toEqual({ status: 'ok' });
    });

    it('forbids caching, so no edge copy can outlive the container', async () => {
        const response = await GET(CONTEXT);

        expect(response.headers.get('cache-control')).toBe('no-store');
    });
});

describe('the probe acquires no dependencies', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not touch the network', async () => {
        await GET(CONTEXT);

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('answers with no environment at all', async () => {
        const original = process.env;
        process.env = {} as NodeJS.ProcessEnv;

        try {
            const response = await GET(CONTEXT);

            expect(response.status).toBe(200);
            await expect(response.json()).resolves.toEqual({ status: 'ok' });
        } finally {
            process.env = original;
        }
    });

    it('answers identically on repeated probes (no accumulated state)', async () => {
        const first = await GET(CONTEXT);
        const second = await GET(CONTEXT);

        expect(second.status).toBe(first.status);
        await expect(second.json()).resolves.toEqual(await first.json());
    });
});
