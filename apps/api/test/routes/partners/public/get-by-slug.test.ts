/**
 * Unit tests for `getPublicPartnerBySlugHandler` (HOS-294 T-007).
 *
 * Public detail stays dark until V7, even when the service finds a partner.
 *
 * The handler is tested directly rather than through a mounted app, following
 * `send-link.content-gate.test.ts`: the real route factory wires auth and
 * permission middleware that transitively pulls in the whole `@repo/db`
 * surface, and none of it participates in the mapping under test.
 *
 * @module test/routes/partners/public/get-by-slug
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPublicBySlugMock } = vi.hoisted(() => ({
    getPublicBySlugMock: vi.fn()
}));

// The real factory wires middleware this suite does not exercise.
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createPublicRoute: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class PartnerServiceStub {
        getPublicBySlug = getPublicBySlugMock;
    }
    return { ...actual, PartnerService: PartnerServiceStub };
});

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'anon', roles: [], permissions: [] }))
}));

import {
    NO_CACHE_ENDPOINTS,
    PRIVATE_CACHE_ENDPOINTS,
    PUBLIC_CACHE_ENDPOINTS
} from '../../../../src/middlewares/cache.constants.js';
import { getPublicPartnerBySlugHandler } from '../../../../src/routes/partners/public/get-by-slug.js';

/** A minimal partner payload — only the fields the assertions read. */
const partner = { id: 'p1', slug: 'acme-litoral', name: 'Acme Litoral' };

/** The handler only passes ctx to the (mocked) actor resolver, so it stays empty. */
const ctx = {} as unknown as Parameters<typeof getPublicPartnerBySlugHandler>[0];

describe('getPublicPartnerBySlugHandler — outcome to HTTP mapping', () => {
    beforeEach(() => {
        getPublicBySlugMock.mockReset();
    });

    it('returns NOT_FOUND even when the service finds a published partner', async () => {
        // Arrange
        getPublicBySlugMock.mockResolvedValue({ data: { outcome: 'found', partner } });

        // Act
        await expect(
            getPublicPartnerBySlugHandler(ctx, { slug: 'acme-litoral' })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });

    it('returns NOT_FOUND for a partner whose page was retired', async () => {
        // Arrange — the service reports a retired page.
        getPublicBySlugMock.mockResolvedValue({ data: { outcome: 'gone' } });

        // Act / Assert
        await expect(
            getPublicPartnerBySlugHandler(ctx, { slug: 'acme-litoral' })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });

    it('raises NOT_FOUND (404) for a URL that was never served', async () => {
        // Arrange — no public page is available.
        getPublicBySlugMock.mockResolvedValue({ data: { outcome: 'notFound' } });

        // Act / Assert
        await expect(
            getPublicPartnerBySlugHandler(ctx, { slug: 'silver-one' })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });

    it('propagates a service error instead of swallowing it into a 404', async () => {
        // Arrange — a failing lookup is not the same as an absent partner, and
        // reporting it as 404 would hide an outage behind a normal-looking page.
        getPublicBySlugMock.mockResolvedValue({
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
        });

        // Act / Assert
        await expect(
            getPublicPartnerBySlugHandler(ctx, { slug: 'acme-litoral' })
        ).rejects.toMatchObject({ code: ServiceErrorCode.INTERNAL_ERROR });
    });

    it('passes the slug through to the service unchanged', async () => {
        // Arrange
        getPublicBySlugMock.mockResolvedValue({ data: { outcome: 'found', partner } });

        // Act
        await expect(
            getPublicPartnerBySlugHandler(ctx, { slug: 'acme-litoral' })
        ).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });

        // Assert
        expect(getPublicBySlugMock).toHaveBeenCalledWith(expect.anything(), {
            slug: 'acme-litoral'
        });
    });
});

describe('the partner detail response is actor-blind (HOS-294 T-008, AC-13)', () => {
    beforeEach(() => {
        getPublicBySlugMock.mockReset();
    });

    it('is served from the shared public cache bucket', () => {
        // Arrange / Act — `PUBLIC_CACHE_ENDPOINTS` is matched with startsWith,
        // and its cache key carries NO actor component, so anything listed here
        // is a response one visitor stores and every other visitor reads.
        // Assert
        expect(PUBLIC_CACHE_ENDPOINTS).toContain('/api/v1/public/partners');
    });

    it('is not classified as private or no-cache, which would contradict that', () => {
        // Arrange / Act / Assert — the three lists are mutually exclusive
        // policies; being in two of them is a contradiction no test would
        // otherwise surface.
        expect(PRIVATE_CACHE_ENDPOINTS).not.toContain('/api/v1/public/partners');
        expect(NO_CACHE_ENDPOINTS).not.toContain('/api/v1/public/partners');
    });

    it('returns the same payload no matter who asks', async () => {
        // Arrange — the risk the shared bucket creates is a handler that
        // branches on the reader. This asserts the payload is the row itself.
        getPublicBySlugMock.mockResolvedValue({ data: { outcome: 'found', partner } });

        // Act — same service state, two invocations.
        const first = getPublicPartnerBySlugHandler(ctx, { slug: 'acme-litoral' });
        const second = getPublicPartnerBySlugHandler(ctx, { slug: 'acme-litoral' });

        // Assert
        await expect(first).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
        await expect(second).rejects.toMatchObject({ code: ServiceErrorCode.NOT_FOUND });
    });
});
