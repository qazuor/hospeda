import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDb, readAccountForClaim, lockPartnerForLinkClaim } = vi.hoisted(() => ({
    getDb: vi.fn(),
    readAccountForClaim: vi.fn(),
    lockPartnerForLinkClaim: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb,
    partnerApplicationModel: { readAccountForClaim, lockPartnerForLinkClaim }
}));
vi.mock('../../../src/utils/user-cache', () => ({ userCache: { invalidate: vi.fn() } }));
vi.mock('../../../src/services/partner-application/partner-claim.service', () => ({
    writePartnerClaim: vi.fn()
}));

import { checkPartnerClaimEmail } from '../../../src/services/partner-application/partner-link-claim.service';
import { hashPartnerClaimSecret } from '../../../src/utils/partner-application/partner-claim-secret';

const SECRET = 'valid-secret';
const input = { actorUserId: 'user-1', partnerId: 'partner-1', secret: SECRET };

function stubPartner(overrides: Record<string, unknown> = {}): void {
    lockPartnerForLinkClaim.mockResolvedValue({
        partnerId: 'partner-1',
        claimSecretHash: hashPartnerClaimSecret({ secret: SECRET }),
        ownerUserId: null,
        claimEmail: 'claim@example.test',
        ...overrides
    });
}

describe('checkPartnerClaimEmail (HOS-2353)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDb.mockReturnValue({ transaction: vi.fn(async (callback) => callback({})) });
        readAccountForClaim.mockResolvedValue({ email: 'claim@example.test', emailVerified: true });
        stubPartner();
    });

    it('matches regardless of case and surrounding whitespace', async () => {
        readAccountForClaim.mockResolvedValue({ email: '  Claim@Example.TEST ' });
        await expect(checkPartnerClaimEmail(input)).resolves.toEqual({ emailMatches: true });
    });

    it('does not match another account', async () => {
        readAccountForClaim.mockResolvedValue({ email: 'other@example.test' });
        await expect(checkPartnerClaimEmail(input)).resolves.toEqual({ emailMatches: false });
    });

    it('does not match a Partner without a claim email', async () => {
        stubPartner({ claimEmail: null });
        await expect(checkPartnerClaimEmail(input)).resolves.toEqual({ emailMatches: false });
    });

    it('answers only a boolean, never the claim mailbox', async () => {
        const result = await checkPartnerClaimEmail(input);
        expect(Object.keys(result)).toEqual(['emailMatches']);
    });

    it('rejects a wrong secret as not found', async () => {
        await expect(checkPartnerClaimEmail({ ...input, secret: 'nope' })).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('rejects a missing Partner as not found', async () => {
        lockPartnerForLinkClaim.mockResolvedValue(null);
        await expect(checkPartnerClaimEmail(input)).rejects.toBeInstanceOf(ServiceError);
    });

    it('keeps the claim behaviour for an already claimed Partner', async () => {
        stubPartner({ ownerUserId: 'someone' });
        await expect(checkPartnerClaimEmail(input)).rejects.toMatchObject({
            code: ServiceErrorCode.ALREADY_EXISTS,
            reason: 'PARTNER_ALREADY_CLAIMED'
        });
    });
});
