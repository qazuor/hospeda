/**
 * @file sign-out.test.ts
 * @description BETA-216: the shared sign-out clears local account state and
 * reports whether the session was really ended.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearCachedAuthMeMock = vi.fn();
const resetUserMock = vi.fn();
const clearThemeSyncMarkerMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('../../src/lib/auth-cache', () => ({ clearCachedAuthMe: () => clearCachedAuthMeMock() }));
vi.mock('../../src/lib/analytics/umami-client', () => ({ resetUser: () => resetUserMock() }));
vi.mock('../../src/lib/theme', () => ({ clearThemeSyncMarker: () => clearThemeSyncMarkerMock() }));
vi.mock('../../src/lib/auth-client', () => ({ signOut: () => signOutMock() }));

import { signOutAndClearClientState } from '../../src/lib/sign-out';

describe('signOutAndClearClientState', () => {
    beforeEach(() => {
        for (const m of [
            clearCachedAuthMeMock,
            resetUserMock,
            clearThemeSyncMarkerMock,
            signOutMock
        ]) {
            m.mockReset();
        }
    });

    it('clears local state and ends the session', async () => {
        signOutMock.mockResolvedValue({ data: { success: true }, error: null });

        const result = await signOutAndClearClientState();

        expect(result).toEqual({ ok: true });
        expect(clearCachedAuthMeMock).toHaveBeenCalledTimes(1);
        expect(resetUserMock).toHaveBeenCalledTimes(1);
        expect(clearThemeSyncMarkerMock).toHaveBeenCalledTimes(1);
    });

    it('reports failure when Better Auth answers with an error', async () => {
        signOutMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

        expect(await signOutAndClearClientState()).toEqual({ ok: false });
    });

    it('reports failure when the call throws, without throwing itself', async () => {
        signOutMock.mockRejectedValue(new Error('network'));

        expect(await signOutAndClearClientState()).toEqual({ ok: false });
    });

    it('still signs out when local cleanup throws', async () => {
        clearCachedAuthMeMock.mockImplementation(() => {
            throw new Error('storage blocked');
        });
        signOutMock.mockResolvedValue({ data: {}, error: null });

        expect(await signOutAndClearClientState()).toEqual({ ok: true });
        expect(signOutMock).toHaveBeenCalledTimes(1);
    });
});
