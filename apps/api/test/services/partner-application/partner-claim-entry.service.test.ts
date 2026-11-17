import { beforeEach, describe, expect, it, vi } from 'vitest';

const { claimPartnerByLink, getAuth, getDb, verifyPartnerClaimLink } = vi.hoisted(() => ({
    claimPartnerByLink: vi.fn(),
    getAuth: vi.fn(),
    getDb: vi.fn(),
    verifyPartnerClaimLink: vi.fn()
}));

vi.mock('@repo/db', () => ({
    eq: vi.fn((left, right) => ({ left, right })),
    getDb,
    partnerApplicationModel: {
        findAccountIdByEmail: vi.fn().mockResolvedValue(null)
    },
    users: { id: 'user-id' }
}));

vi.mock('../../../src/lib/auth', () => ({ getAuth }));
vi.mock('../../../src/utils/logger', () => ({ apiLogger: { error: vi.fn() } }));
vi.mock('../../../src/services/partner-application/partner-link-claim.service', () => ({
    claimPartnerByLink,
    verifyPartnerClaimLink
}));

import { signUpAndClaimPartner } from '../../../src/services/partner-application/partner-claim-entry.service';

describe('signUpAndClaimPartner cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDb.mockReturnValue({
            transaction: vi.fn(async (callback) => callback({})),
            delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }))
        });
        getAuth.mockReturnValue({
            api: {
                createUser: vi
                    .fn()
                    .mockResolvedValueOnce({ user: { id: 'created-user-1' } })
                    .mockResolvedValueOnce({ user: { id: 'created-user-2' } })
            }
        });
        verifyPartnerClaimLink.mockResolvedValue({
            partnerId: 'partner-1',
            claimEmail: 'claim@example.test'
        });
    });

    it('deletes a created account after claim failure and allows a later signup retry', async () => {
        claimPartnerByLink
            .mockRejectedValueOnce(new Error('temporary claim failure'))
            .mockResolvedValueOnce({ claimed: true, partnerId: 'partner-1', emailVerified: true });

        await expect(
            signUpAndClaimPartner({
                partnerId: 'partner-1',
                secret: 'valid-secret',
                password: 'StrongPass123!'
            })
        ).rejects.toThrow('temporary claim failure');
        expect(getDb().delete).toHaveBeenCalledTimes(1);

        await expect(
            signUpAndClaimPartner({
                partnerId: 'partner-1',
                secret: 'valid-secret',
                password: 'StrongPass123!'
            })
        ).resolves.toMatchObject({ claimed: true, partnerId: 'partner-1' });
    });
});
