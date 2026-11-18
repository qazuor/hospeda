/**
 * Tests for GET /api/v1/protected/venues/:id/whatsapp (HOS-2256, AC-18).
 *
 * A guest gets 401 and no number; a malformed id gets 400; the handler answers
 * with whatever the service decided and turns a service error into a thrown
 * `ServiceError`, so the 404 is the shared, enumeration-safe one.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { read } = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, getVenueWhatsappForViewer: read };
});

import { initApp } from '../../../../src/app';
import { handleGetVenueWhatsapp } from '../../../../src/routes/venue/protected/getWhatsapp';
import { validateApiEnv } from '../../../../src/utils/env';

const ID = 'aaaaaaaa-0000-4000-8000-000000002256';

describe('GET /protected/venues/:id/whatsapp', () => {
    it('answers 401 to a guest and never reaches the service', async () => {
        validateApiEnv();
        const app = await initApp();

        const res = await app.request(`/api/v1/protected/venues/${ID}/whatsapp`, {
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });

        expect(res.status).toBe(401);
        expect(await res.text()).not.toMatch(/\+54|number/);
        expect(read).not.toHaveBeenCalled();
    });

    it('returns the number the service resolved', async () => {
        read.mockResolvedValueOnce({ data: { number: '+54 9 343 7654321' } });

        const result = await handleGetVenueWhatsapp({} as never, { id: ID });

        expect(result).toEqual({ number: '+54 9 343 7654321' });
        expect(read).toHaveBeenCalledWith(expect.anything(), { venueId: ID });
    });

    it('throws the service error (shared 404) instead of answering a number', async () => {
        read.mockResolvedValueOnce({ error: { code: 'NOT_FOUND', message: 'venue not found' } });

        await expect(handleGetVenueWhatsapp({} as never, { id: ID })).rejects.toMatchObject({
            code: 'NOT_FOUND'
        });
    });

    it('declares a per-client rate limit, since it reveals a contact to any signed-in account', () => {
        const source = readFileSync(
            resolve(__dirname, '../../../../src/routes/venue/protected/getWhatsapp.ts'),
            'utf8'
        );

        expect(source).toMatch(/customRateLimit:\s*\{\s*requests:\s*20,\s*windowMs:\s*60_000\s*\}/);
    });
});
