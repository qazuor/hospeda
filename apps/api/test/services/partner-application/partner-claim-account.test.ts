import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signUpEmail } = vi.hoisted(() => ({ signUpEmail: vi.fn() }));
vi.mock('../../../src/lib/auth', () => ({
    getAuth: () => ({ api: { signUpEmail } })
}));

import { createClaimAccount } from '../../../src/services/partner-application/partner-claim-account';

describe('createClaimAccount', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns null when another approval creates the account first', async () => {
        signUpEmail.mockRejectedValueOnce(new Error('User already exists'));
        await expect(createClaimAccount({ email: 'owner@example.test' })).resolves.toBeNull();
    });

    it('throws INTERNAL_ERROR when Better Auth returns no user id', async () => {
        signUpEmail.mockResolvedValueOnce({ user: null });
        await expect(createClaimAccount({ email: 'owner@example.test' })).rejects.toMatchObject({
            code: ServiceErrorCode.INTERNAL_ERROR
        });
    });
});
