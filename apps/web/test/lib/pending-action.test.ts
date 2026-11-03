/**
 * @file pending-action.test.ts
 * @description Unit tests for the guest pending-action handoff (HOS-1925).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
    PENDING_ACTION_STORAGE_KEY,
    PENDING_ACTION_TTL_MS,
    type PendingAction,
    savePendingAction,
    takePendingAction
} from '../../src/lib/pending-action';

const FAVORITE: PendingAction = { kind: 'favorite', entityType: 'ACCOMMODATION', entityId: 'a-1' };
const PARTNER_CLAIM: PendingAction = {
    kind: 'partner-claim',
    partnerId: 'partner-uuid',
    secret: 'one-time-secret'
};
const anyAction = () => true;

describe('pending-action', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('returns the saved action once and then nothing (idempotent)', () => {
        savePendingAction({ action: FAVORITE, path: '/es/alojamientos/', now: 1000 });

        const first = takePendingAction({
            path: '/es/alojamientos/',
            matches: anyAction,
            now: 2000
        });
        const second = takePendingAction({
            path: '/es/alojamientos/',
            matches: anyAction,
            now: 2001
        });

        expect(first).toEqual(FAVORITE);
        expect(second).toBeNull();
    });

    it('stores and takes a partner claim once, and expires it after ten minutes', () => {
        savePendingAction({ action: PARTNER_CLAIM, path: '/es/partners/reclamar/', now: 1000 });
        const taken = takePendingAction({
            path: '/es/partners/reclamar/',
            matches: anyAction,
            now: 1001
        });
        const takenClaim = taken as Extract<PendingAction, { readonly kind: 'partner-claim' }>;
        expect(takenClaim.kind).toBe('partner-claim');
        expect(takenClaim.partnerId).toBe(PARTNER_CLAIM.partnerId);
        expect(takenClaim.secret === PARTNER_CLAIM.secret).toBe(true);
        const replayed = takePendingAction({
            path: '/es/partners/reclamar/',
            matches: anyAction,
            now: 1002
        });
        expect(replayed === null).toBe(true);

        savePendingAction({ action: PARTNER_CLAIM, path: '/es/partners/reclamar/', now: 2000 });
        const expired = takePendingAction({
            path: '/es/partners/reclamar/',
            matches: anyAction,
            now: 2000 + PENDING_ACTION_TTL_MS
        });
        expect(expired === null).toBe(true);
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY) === null).toBe(true);
    });

    it('discards an expired action and purges it', () => {
        savePendingAction({ action: FAVORITE, path: '/es/alojamientos/', now: 1000 });

        const taken = takePendingAction({
            path: '/es/alojamientos/',
            matches: anyAction,
            now: 1000 + PENDING_ACTION_TTL_MS
        });

        expect(taken).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).toBeNull();
    });

    it('does not apply on a different page and keeps the entry', () => {
        savePendingAction({ action: FAVORITE, path: '/es/alojamientos/', now: 1000 });

        const taken = takePendingAction({ path: '/es/eventos/', matches: anyAction, now: 2000 });

        expect(taken).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
    });

    it('does not hand an action to a caller whose predicate rejects it', () => {
        savePendingAction({ action: FAVORITE, path: '/p/', now: 1000 });

        const taken = takePendingAction({
            path: '/p/',
            matches: (a) => a.kind === 'compare-mode',
            now: 2000
        });

        expect(taken).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
    });

    it('purges malformed storage content', () => {
        window.sessionStorage.setItem(PENDING_ACTION_STORAGE_KEY, '{"action":{"kind":"x"}}');

        expect(takePendingAction({ path: '/p/', matches: anyAction })).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).toBeNull();
    });
});
