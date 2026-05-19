/**
 * Regression test for the newsletter toggle handler.
 *
 * Verifies SPEC-101 T-101-02 bug fix:
 *   - Handler writes to user.settings.newsletter (the intended field).
 *   - Handler does NOT modify user.settings.notifications.allowEmails.
 *
 * Tests the pure handler directly (no initApp) with a stub UserService.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    type NewsletterToggleUserService,
    newsletterToggleHandler
} from '../../../src/routes/user/protected/newsletter';

const buildActor = () => ({
    id: '00000000-0000-0000-0000-000000000001',
    role: 'USER',
    permissions: [] as string[]
});

const buildCtx = (actorOverride?: Partial<ReturnType<typeof buildActor>>) => {
    const actor = { ...buildActor(), ...actorOverride };
    return {
        get: (key: string) => (key === 'actor' ? actor : undefined)
    } as unknown as Parameters<typeof newsletterToggleHandler>[0];
};

describe('newsletterToggleHandler (SPEC-101 T-101-02 bug fix)', () => {
    it('toggles settings.newsletter from false to true and preserves notifications.allowEmails=true', async () => {
        const update = vi.fn().mockResolvedValue({ data: {}, error: null });
        const svc: NewsletterToggleUserService = {
            getById: vi.fn().mockResolvedValue({
                data: {
                    id: '00000000-0000-0000-0000-000000000001',
                    settings: {
                        notifications: {
                            enabled: true,
                            allowEmails: true,
                            allowSms: false,
                            allowPush: false
                        },
                        newsletter: false
                    }
                },
                error: null
            }),
            update
        };

        const result = await newsletterToggleHandler(buildCtx(), svc);

        expect(result).toEqual({ subscribed: true });
        expect(update).toHaveBeenCalledOnce();

        const updateCall = update.mock.calls[0];
        const patch = updateCall?.[2] as {
            settings: {
                newsletter?: boolean;
                notifications?: { allowEmails?: boolean };
            };
        };

        // Bug fix assertion 1: settings.newsletter IS updated.
        expect(patch.settings.newsletter).toBe(true);

        // Bug fix assertion 2: settings.notifications.allowEmails is preserved
        // (was true, must remain true — the buggy version flipped this field).
        expect(patch.settings.notifications?.allowEmails).toBe(true);
    });

    it('toggles settings.newsletter from true to false and preserves notifications.allowEmails=false', async () => {
        const update = vi.fn().mockResolvedValue({ data: {}, error: null });
        const svc: NewsletterToggleUserService = {
            getById: vi.fn().mockResolvedValue({
                data: {
                    id: '00000000-0000-0000-0000-000000000002',
                    settings: {
                        notifications: {
                            enabled: true,
                            allowEmails: false,
                            allowSms: false,
                            allowPush: false
                        },
                        newsletter: true
                    }
                },
                error: null
            }),
            update
        };

        const result = await newsletterToggleHandler(buildCtx(), svc);

        expect(result).toEqual({ subscribed: false });

        const patch = update.mock.calls[0]?.[2] as {
            settings: {
                newsletter?: boolean;
                notifications?: { allowEmails?: boolean };
            };
        };

        expect(patch.settings.newsletter).toBe(false);
        expect(patch.settings.notifications?.allowEmails).toBe(false);
    });

    it('initializes settings when undefined: newsletter=true, default notifications', async () => {
        const update = vi.fn().mockResolvedValue({ data: {}, error: null });
        const svc: NewsletterToggleUserService = {
            getById: vi.fn().mockResolvedValue({
                data: {
                    id: '00000000-0000-0000-0000-000000000003',
                    settings: undefined
                },
                error: null
            }),
            update
        };

        const result = await newsletterToggleHandler(buildCtx(), svc);

        expect(result).toEqual({ subscribed: true });

        const patch = update.mock.calls[0]?.[2] as {
            settings: {
                newsletter?: boolean;
                notifications?: { allowEmails?: boolean; enabled?: boolean };
            };
        };

        expect(patch.settings.newsletter).toBe(true);
        expect(patch.settings.notifications?.allowEmails).toBe(false);
        expect(patch.settings.notifications?.enabled).toBe(true);
    });

    it('throws when getById returns an error', async () => {
        const svc: NewsletterToggleUserService = {
            getById: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'INTERNAL_ERROR', message: 'db down' }
            }),
            update: vi.fn()
        };

        await expect(newsletterToggleHandler(buildCtx(), svc)).rejects.toThrow('db down');
    });

    it('throws NOT_FOUND when user does not exist', async () => {
        const svc: NewsletterToggleUserService = {
            getById: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: vi.fn()
        };

        await expect(newsletterToggleHandler(buildCtx(), svc)).rejects.toThrow('User not found');
    });
});
