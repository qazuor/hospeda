/** Unit tests for the public Partner page handler (AC:V7:13; V7 §1.6). */
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as partnerPresenceRead from '../../../../src/services/partner-presence/partner-presence-read.service.js';

vi.mock('../../../../src/utils/route-factory.js', () => ({
    createPublicRoute: vi.fn()
}));

import {
    NO_CACHE_ENDPOINTS,
    PRIVATE_CACHE_ENDPOINTS,
    PUBLIC_CACHE_ENDPOINTS
} from '../../../../src/middlewares/cache.constants.js';
import { getPublicPartnerBySlugHandler } from '../../../../src/routes/partners/public/get-by-slug.js';

const partner = { id: 'p1', slug: 'acme-litoral', name: 'Acme Litoral' };
const ctx = {} as Parameters<typeof getPublicPartnerBySlugHandler>[0];

afterEach(() => vi.restoreAllMocks());

describe('getPublicPartnerBySlugHandler — public page lookup', () => {
    it('returns the partner from the presence read service', async () => {
        vi.spyOn(partnerPresenceRead, 'getPublicPartnerPage').mockResolvedValue({
            partner
        } as never);
        await expect(getPublicPartnerBySlugHandler(ctx, { slug: partner.slug })).resolves.toEqual(
            partner
        );
        expect(partnerPresenceRead.getPublicPartnerPage).toHaveBeenCalledWith({
            slug: partner.slug
        });
    });

    it('maps an unavailable public presence to NOT_FOUND', async () => {
        vi.spyOn(partnerPresenceRead, 'getPublicPartnerPage').mockResolvedValue(null);
        await expect(
            getPublicPartnerBySlugHandler(ctx, { slug: partner.slug })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.NOT_FOUND
        });
    });

    it('does not map a service failure to NOT_FOUND', async () => {
        const failure = new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'read failed');
        vi.spyOn(partnerPresenceRead, 'getPublicPartnerPage').mockRejectedValue(failure);
        await expect(getPublicPartnerBySlugHandler(ctx, { slug: partner.slug })).rejects.toBe(
            failure
        );
    });
});

describe('partner page response cache policy', () => {
    it('remains in the shared public cache bucket', () => {
        expect(PUBLIC_CACHE_ENDPOINTS).toContain('/api/v1/public/partners');
        expect(PRIVATE_CACHE_ENDPOINTS).not.toContain('/api/v1/public/partners');
        expect(NO_CACHE_ENDPOINTS).not.toContain('/api/v1/public/partners');
    });
});
