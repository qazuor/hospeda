import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    trial: false,
    subscription: false,
    published: false,
    hasEntitlement: false,
    used: 0
}));

vi.mock('../../../src/utils/listing-access/accommodation-import-access-ports', () => ({
    ACCOMMODATION_IMPORT_NEW_USER_MAX: 5,
    getAccommodationImportAccessPorts: () => ({
        hasHadTrial: async () => state.trial,
        hasHadSubscription: async () => state.subscription,
        hasPublishedAccommodation: async () => state.published,
        hasImportEntitlement: async () => state.hasEntitlement,
        consumeNewUserImport: async () => {
            if (state.used >= 5) return false;
            state.used += 1;
            return true;
        },
        countNewUserImports: async () => state.used
    })
}));

import {
    getAccommodationImportAccess,
    requireAccommodationImportAccess
} from '../../../src/utils/listing-access/accommodation-import-access';

describe('accommodation import access', () => {
    beforeEach(() => {
        state.trial = false;
        state.subscription = false;
        state.published = false;
        state.hasEntitlement = false;
        state.used = 0;
    });

    it('allows a new user without a plan', async () => {
        await expect(getAccommodationImportAccess('user-1')).resolves.toMatchObject({
            allowed: true,
            isNewUser: true
        });
        await expect(requireAccommodationImportAccess('user-1')).resolves.toMatchObject({
            allowed: true,
            isNewUser: true
        });
        expect(state.used).toBe(1);
    });

    it('denies a returning user without the entitlement', async () => {
        state.trial = true;
        await expect(requireAccommodationImportAccess('user-1')).rejects.toMatchObject({
            code: 'ENTITLEMENT_REQUIRED'
        });
    });

    it('allows an entitled user without consuming the new-user cap', async () => {
        state.hasEntitlement = true;
        await expect(getAccommodationImportAccess('user-1')).resolves.toMatchObject({
            allowed: true,
            isNewUser: false
        });
        expect(state.used).toBe(0);
    });

    it('denies a new user after five imports in the rolling window', async () => {
        state.used = 5;
        await expect(requireAccommodationImportAccess('user-1')).rejects.toMatchObject({
            status: 429
        });
        await expect(getAccommodationImportAccess('user-1')).resolves.toMatchObject({
            allowed: false,
            reason: 'new_user_cap'
        });
    });

    it.each([
        ['a prior subscription', 'subscription'],
        ['a published accommodation', 'published']
    ] as const)('does not classify a user with %s as new', async (_label, kind) => {
        state[kind === 'subscription' ? 'subscription' : 'published'] = true;
        await expect(getAccommodationImportAccess('user-1')).resolves.toMatchObject({
            allowed: false,
            isNewUser: false,
            reason: 'entitlement'
        });
    });

    it('reports the same server decision for the UI without consuming usage', async () => {
        await expect(getAccommodationImportAccess('user-1')).resolves.toMatchObject({
            allowed: true,
            isNewUser: true,
            remainingNewUserImports: 5
        });
        expect(state.used).toBe(0);
    });
});
