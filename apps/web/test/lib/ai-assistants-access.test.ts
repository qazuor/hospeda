/**
 * @file ai-assistants-access.test.ts
 * @description HOS-2562: who may open «Asistentes de IA» on the web. Same rule
 * as the API (`isRealClient` in `@repo/schemas`), adapted to the session shape.
 */

import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchAuthMeMock } = vi.hoisted(() => ({ fetchAuthMeMock: vi.fn() }));
vi.mock('../../src/lib/auth-cache', () => ({ fetchAuthMe: fetchAuthMeMock }));

import { canUseAiAssistants, fetchCanUseAiAssistants } from '../../src/lib/ai-assistants-access';

const NONE = { ownsHostTradeListing: false, ownsPartner: false } as const;

describe('canUseAiAssistants', () => {
    it('refuses no session', () => {
        expect(canUseAiAssistants({ user: null })).toBe(false);
        expect(canUseAiAssistants({ user: undefined })).toBe(false);
    });

    it('refuses a pure tourist', () => {
        expect(
            canUseAiAssistants({
                user: { permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE], ...NONE }
            })
        ).toBe(false);
    });

    it.each([
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.VENUE_EDIT_OWN,
        PermissionEnum.EXPERIENCE_EDIT_OWN,
        PermissionEnum.POST_CREATE,
        PermissionEnum.EVENT_CREATE
    ])('allows a client holding %s', (permission) => {
        expect(canUseAiAssistants({ user: { permissions: [permission], ...NONE } })).toBe(true);
    });

    it('allows a partner or a provider by row ownership alone', () => {
        expect(
            canUseAiAssistants({
                user: { permissions: [], ownsHostTradeListing: false, ownsPartner: true }
            })
        ).toBe(true);
        expect(
            canUseAiAssistants({
                user: { permissions: [], ownsHostTradeListing: true, ownsPartner: false }
            })
        ).toBe(true);
    });
});

describe('fetchCanUseAiAssistants', () => {
    beforeEach(() => {
        fetchAuthMeMock.mockReset();
    });

    it('answers null when /auth/me reports no session', async () => {
        fetchAuthMeMock.mockResolvedValue({ isAuthenticated: false, permissions: [] });

        expect(await fetchCanUseAiAssistants()).toBeNull();
    });

    it('answers false for a signed-in tourist and true for a signed-in client', async () => {
        fetchAuthMeMock.mockResolvedValueOnce({ isAuthenticated: true, permissions: [] });
        fetchAuthMeMock.mockResolvedValueOnce({
            isAuthenticated: true,
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });

        expect(await fetchCanUseAiAssistants()).toBe(false);
        expect(await fetchCanUseAiAssistants()).toBe(true);
    });
});
