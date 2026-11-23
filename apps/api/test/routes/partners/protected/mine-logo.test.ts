/**
 * Tests for `POST /api/v1/protected/partners/mine/logo` (HOS-2506).
 *
 * What matters here is the scope, not the happy path:
 *
 * 1. **The folder comes from the actor's OWN listing.** There is no id in the
 *    request, so the upload can only land under the partner `getOwn` resolved.
 * 2. **A logo never overwrites.** Every upload gets a unique public id and
 *    `overwrite: false`, so it cannot replace the avatar nor an earlier logo.
 * 3. **No listing, no upload.** An account without a partner answers NOT_FOUND
 *    and never reaches the provider.
 *
 * @module test/routes/partners/protected/mine-logo
 */

import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getActorMock, getOwnMock, uploadToProviderMock, validateFileMock, providerMock } =
    vi.hoisted(() => ({
        getActorMock: vi.fn(),
        getOwnMock: vi.fn(),
        uploadToProviderMock: vi.fn(),
        validateFileMock: vi.fn(),
        providerMock: { upload: vi.fn() }
    }));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((options: unknown) => options)
}));
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createProtectedRoute: vi.fn((options: unknown) => options)
}));
vi.mock('../../../../src/utils/actor', () => ({ getActorFromContext: getActorMock }));
vi.mock('../../../../src/services/media', () => ({ getMediaProvider: () => providerMock }));
vi.mock('../../../../src/services/media/upload-helpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/services/media/upload-helpers')>();
    return { ...actual, uploadToProvider: uploadToProviderMock, validateFile: validateFileMock };
});
vi.mock('../../../../src/middlewares/rate-limit', () => ({
    createSlidingWindowPerUserRateLimit: () => async (_c: unknown, next: () => Promise<void>) =>
        next()
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    class PartnerServiceWithStub extends actual.PartnerService {
        constructor(ctx: ConstructorParameters<typeof actual.PartnerService>[0]) {
            super(ctx);
            this.getOwn = getOwnMock;
        }
    }
    return { ...actual, PartnerService: PartnerServiceWithStub };
});

import { handleUploadMyPartnerLogo } from '../../../../src/routes/partners/protected/mine-logo';

const OWNER_ID = '00000000-0000-4000-a000-0000000000a1';
const PARTNER_ID = '00000000-0000-4000-a000-0000000000b1';

/** A Hono context stub with just what the handler touches. */
const makeCtx = ({ file }: { readonly file?: File | null }) => {
    const form = new FormData();
    if (file) form.append('file', file);
    return {
        header: vi.fn(),
        get: () => 'req-1',
        json: vi.fn((body: unknown, status?: number) => ({ body, status })),
        req: { header: () => '1000', formData: async () => form }
    } as unknown as Parameters<typeof handleUploadMyPartnerLogo>[0];
};

const png = () => new File([new Uint8Array([1, 2, 3, 4])], 'logo.png', { type: 'image/png' });

beforeEach(() => {
    vi.clearAllMocks();
    getActorMock.mockReturnValue({ id: OWNER_ID, roles: [RoleEnum.USER], permissions: [] });
    getOwnMock.mockResolvedValue({ data: { partner: { id: PARTNER_ID } } });
    validateFileMock.mockReturnValue(null);
    uploadToProviderMock.mockResolvedValue({
        url: 'https://res.cloudinary.com/x/logo.png',
        publicId: 'hospeda/dev/partners/p/logo/abc',
        width: 200,
        height: 100,
        moderationState: 'APPROVED'
    });
});

describe('POST /protected/partners/mine/logo', () => {
    it('uploads under the actor-resolved partner folder without overwriting', async () => {
        const result = await handleUploadMyPartnerLogo(makeCtx({ file: png() }));

        expect(result).toMatchObject({ url: 'https://res.cloudinary.com/x/logo.png' });
        const params = uploadToProviderMock.mock.calls[0]?.[1];
        expect(params.folder).toMatch(new RegExp(`/partners/${PARTNER_ID}$`));
        expect(params.publicId).toMatch(/^logo\//);
        expect(params.overwrite).toBe(false);
        expect(params.entityId).toBe(PARTNER_ID);
    });

    it('rejects an account that owns no partner listing and never uploads', async () => {
        getOwnMock.mockResolvedValue({ data: { partner: null } });

        await expect(handleUploadMyPartnerLogo(makeCtx({ file: png() }))).rejects.toMatchObject({
            code: 'NOT_FOUND'
        });
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    it('answers 400 when the file field is missing', async () => {
        const ctx = makeCtx({ file: null });
        const response = (await handleUploadMyPartnerLogo(ctx)) as unknown as { status: number };

        expect(response.status).toBe(400);
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    it('answers 422 when the file fails validation (wrong type or content)', async () => {
        validateFileMock.mockReturnValue({
            code: 'UNPROCESSABLE_ENTITY',
            message: 'File validation failed: type',
            status: 422
        });
        const response = (await handleUploadMyPartnerLogo(makeCtx({ file: png() }))) as unknown as {
            status: number;
        };

        expect(response.status).toBe(422);
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    it('maps a provider failure to its typed status', async () => {
        uploadToProviderMock.mockResolvedValue({
            code: 'UPSTREAM_ERROR',
            message: 'Image upload failed',
            status: 502
        });
        const response = (await handleUploadMyPartnerLogo(makeCtx({ file: png() }))) as unknown as {
            status: number;
        };

        expect(response.status).toBe(502);
    });
});
