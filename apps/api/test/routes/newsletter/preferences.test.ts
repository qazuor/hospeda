/**
 * Unit tests for the protected newsletter preferences PATCH handler.
 *
 * Tests the PURE handler directly with stubbed services. No initApp, no real
 * DB, no auth middleware — that wiring is exercised by the Phase 7 E2E test.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type PreferencesBody,
    type PreferencesNewsletterService,
    preferencesHandler
} from '../../../src/routes/newsletter/protected/preferences';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const buildCtx = () => {
    const actor = {
        id: ACTOR_ID,
        role: 'USER',
        permissions: [] as string[],
        emailVerified: true
    };
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined),
        req: { header: () => undefined }
    } as unknown as Parameters<typeof preferencesHandler>[0];
};

describe('preferencesHandler', () => {
    it('forwards the partial body to updatePreferences and returns the merged map', async () => {
        const merged = {
            offers: false,
            events: true,
            guides: true,
            productNews: true
        };
        const svc: PreferencesNewsletterService = {
            updatePreferences: vi.fn().mockResolvedValue({
                data: { preferences: merged },
                error: null
            })
        };

        const body: PreferencesBody = { offers: false };
        const result = await preferencesHandler(buildCtx(), body, { newsletterService: svc });

        expect(result).toEqual({ preferences: merged });
        expect(svc.updatePreferences).toHaveBeenCalledWith(
            expect.objectContaining({ id: ACTOR_ID }),
            { userId: ACTOR_ID, preferences: { offers: false } }
        );
    });

    it('re-throws ServiceError when the service returns an error result', async () => {
        const svc: PreferencesNewsletterService = {
            updatePreferences: vi.fn().mockResolvedValue({
                data: null,
                error: {
                    code: 'FORBIDDEN' as never,
                    message: 'blocked'
                }
            })
        };

        await expect(
            preferencesHandler(buildCtx(), { offers: false } as PreferencesBody, {
                newsletterService: svc
            })
        ).rejects.toThrow('blocked');
    });

    it('throws INTERNAL_ERROR when the service returns null data and no error', async () => {
        const svc: PreferencesNewsletterService = {
            updatePreferences: vi.fn().mockResolvedValue({ data: null, error: null })
        };

        await expect(
            preferencesHandler(buildCtx(), { offers: false } as PreferencesBody, {
                newsletterService: svc
            })
        ).rejects.toThrow(/no data/i);
    });
});
