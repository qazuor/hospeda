/**
 * @file owner-listings.test.ts
 * @description Unit tests for `fetchMyCommerceLead` (HOS-257) — the web-layer
 * fetch used to pre-fill `CommerceCreateForm`.
 *
 * Covers:
 * - Returns the pre-fill-shaped lead when the endpoint returns one.
 * - Returns `null` (not an error/throw) when the endpoint returns `{ lead: null }`.
 * - Returns `null` (degrades silently) when the request itself fails.
 * - Forwards `cookieHeader` for SSR callers.
 *
 * @module test/lib/commerce/owner-listings
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProtected = vi.fn();

vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        getProtected: (args: unknown) => getProtected(args)
    }
}));

import { fetchMyCommerceLead } from '../../../src/lib/commerce/owner-listings';

describe('fetchMyCommerceLead (HOS-257)', () => {
    beforeEach(() => {
        getProtected.mockReset();
    });

    it('returns the pre-fill-shaped lead when the endpoint returns one', async () => {
        getProtected.mockResolvedValue({
            ok: true,
            data: {
                lead: {
                    name: 'La Parrilla de Juan',
                    destinationId: 'dest-1',
                    contactName: 'Juan Pérez',
                    email: 'juan@example.com',
                    phone: '+5491112345678'
                }
            }
        });

        const lead = await fetchMyCommerceLead({ vertical: 'gastronomy' });

        expect(lead).toEqual({
            name: 'La Parrilla de Juan',
            destinationId: 'dest-1',
            contactName: 'Juan Pérez',
            email: 'juan@example.com',
            phone: '+5491112345678'
        });
        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/commerce/leads/mine',
            params: { domain: 'gastronomy' },
            cookieHeader: undefined
        });
    });

    it('returns null when the caller has no provisioned lead', async () => {
        getProtected.mockResolvedValue({ ok: true, data: { lead: null } });

        const lead = await fetchMyCommerceLead({ vertical: 'gastronomy' });

        expect(lead).toBeNull();
    });

    it('degrades to null when the request fails (never throws)', async () => {
        getProtected.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        });

        const lead = await fetchMyCommerceLead({ vertical: 'gastronomy' });

        expect(lead).toBeNull();
    });

    it('forwards cookieHeader for SSR callers', async () => {
        getProtected.mockResolvedValue({ ok: true, data: { lead: null } });

        await fetchMyCommerceLead({ vertical: 'gastronomy', cookieHeader: 'sid=abc' });

        expect(getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/commerce/leads/mine',
            params: { domain: 'gastronomy' },
            cookieHeader: 'sid=abc'
        });
    });

    // ── H-155 ───────────────────────────────────────────────────────────────
    //
    // Scoping the lookup by owner alone made the EXPERIENCE create form
    // pre-fill from a GASTRONOMY lead. The form derives the public slug from
    // `name` and the slug is immutable afterwards, so an owner who does not
    // notice the pre-filled restaurant name publishes their excursion under it
    // permanently. Holding listings in both verticals is what the product
    // invites, so this is the ordinary case rather than an edge one.
    it('asks for the experience domain when rendering the experience form (H-155)', async () => {
        getProtected.mockResolvedValue({ ok: true, data: { lead: null } });

        await fetchMyCommerceLead({ vertical: 'experience' });

        expect(getProtected).toHaveBeenCalledWith(
            expect.objectContaining({ params: { domain: 'experience' } })
        );
    });
});
