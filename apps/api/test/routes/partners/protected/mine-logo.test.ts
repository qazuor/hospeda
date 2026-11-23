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
 * 4. **Error-contract order.** Input (size, presence, emptiness, type) is
 *    judged before existence (404), and existence before the provider (503).
 * 5. **Only JPEG, PNG or WebP.** The file check runs for real (not mocked), so
 *    a HEIC or AVIF logo is refused by the route itself.
 *
 * @module test/routes/partners/protected/mine-logo
 */

import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getActorMock, getOwnMock, uploadToProviderMock, providerRef } = vi.hoisted(() => ({
    getActorMock: vi.fn(),
    getOwnMock: vi.fn(),
    uploadToProviderMock: vi.fn(),
    providerRef: { current: { upload: vi.fn() } as { upload: () => unknown } | null }
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((options: unknown) => options)
}));
vi.mock('../../../../src/utils/route-factory.js', () => ({
    createProtectedRoute: vi.fn((options: unknown) => options)
}));
vi.mock('../../../../src/utils/actor', () => ({ getActorFromContext: getActorMock }));
vi.mock('../../../../src/services/media', () => ({ getMediaProvider: () => providerRef.current }));
vi.mock('../../../../src/services/media/upload-helpers', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/services/media/upload-helpers')>();
    // `validateFile` stays REAL: the type and content checks are under test.
    return { ...actual, uploadToProvider: uploadToProviderMock };
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
const makeCtx = ({
    file,
    contentLength = '1000'
}: {
    readonly file?: File | null;
    readonly contentLength?: string;
}) => {
    const form = new FormData();
    if (file) form.append('file', file);
    return {
        header: vi.fn(),
        get: () => 'req-1',
        json: vi.fn((body: unknown, status?: number) => ({ body, status })),
        req: { header: () => contentLength, formData: async () => form }
    } as unknown as Parameters<typeof handleUploadMyPartnerLogo>[0];
};

/** A real 1x1 PNG, so the unmocked content check accepts it. */
const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
);
const png = () => new File([PNG_1X1], 'logo.png', { type: 'image/png' });

/** ISO-BMFF header with the given `ftyp` brand (HEIC / AVIF magic bytes). */
const isoBmff = (brand: string, type: string) =>
    new File(
        [
            new Uint8Array([
                0,
                0,
                0,
                24,
                0x66,
                0x74,
                0x79,
                0x70,
                ...Buffer.from(brand),
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0
            ])
        ],
        `logo.${brand}`,
        { type }
    );

type ErrorResponse = { status: number; body: { error?: { code?: string } } };
const asResponse = (value: unknown) => value as ErrorResponse;

beforeEach(() => {
    vi.clearAllMocks();
    getActorMock.mockReturnValue({ id: OWNER_ID, roles: [RoleEnum.USER], permissions: [] });
    getOwnMock.mockResolvedValue({ data: { partner: { id: PARTNER_ID } } });
    providerRef.current = { upload: vi.fn() };
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

    it.each([
        ['HEIC', isoBmff('heic', 'image/heic')],
        ['AVIF', isoBmff('avif', 'image/avif')],
        [
            'GIF',
            new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], 'l.gif', { type: 'image/gif' })
        ]
    ])('refuses a %s logo with 422 and never uploads', async (_label, file) => {
        const response = asResponse(await handleUploadMyPartnerLogo(makeCtx({ file })));

        expect(response.status).toBe(422);
        expect(response.body.error?.code).toBe('UNPROCESSABLE_ENTITY');
        // The entity allowlist accepts HEIC/AVIF: only the logo allowlist says this.
        expect(JSON.stringify(response.body)).toContain('INVALID_FILE_TYPE');
        expect(uploadToProviderMock).not.toHaveBeenCalled();
        expect(getOwnMock).not.toHaveBeenCalled();
    });

    it('answers 422 when the content does not match the declared type', async () => {
        const fake = new File([new Uint8Array(32).fill(7)], 'logo.png', { type: 'image/png' });
        const response = asResponse(await handleUploadMyPartnerLogo(makeCtx({ file: fake })));

        expect(response.status).toBe(422);
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    it('answers 413 when Content-Length exceeds the cap, before any lookup', async () => {
        const response = asResponse(
            await handleUploadMyPartnerLogo(
                makeCtx({ file: png(), contentLength: String(500 * 1024 * 1024) })
            )
        );

        expect(response.status).toBe(413);
        expect(response.body.error?.code).toBe('PAYLOAD_TOO_LARGE');
        expect(getOwnMock).not.toHaveBeenCalled();
    });

    it('answers 422 EMPTY_FILE for a zero-byte file', async () => {
        const empty = new File([], 'logo.png', { type: 'image/png' });
        const response = asResponse(await handleUploadMyPartnerLogo(makeCtx({ file: empty })));

        expect(response.status).toBe(422);
        expect(response.body.error?.code).toBe('EMPTY_FILE');
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    it('answers 503 when the media provider is not configured', async () => {
        providerRef.current = null;
        const response = asResponse(await handleUploadMyPartnerLogo(makeCtx({ file: png() })));

        expect(response.status).toBe(503);
        expect(response.body.error?.code).toBe('CLOUDINARY_NOT_CONFIGURED');
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    it('propagates a getOwn failure as its typed ServiceError', async () => {
        getOwnMock.mockResolvedValue({
            error: { code: 'SERVICE_UNAVAILABLE', message: 'lookup failed' }
        });

        await expect(handleUploadMyPartnerLogo(makeCtx({ file: png() }))).rejects.toMatchObject({
            code: 'SERVICE_UNAVAILABLE'
        });
        expect(uploadToProviderMock).not.toHaveBeenCalled();
    });

    describe('error-contract order', () => {
        it('a missing file answers 400 even when the account owns no listing', async () => {
            getOwnMock.mockResolvedValue({ data: { partner: null } });
            const response = asResponse(await handleUploadMyPartnerLogo(makeCtx({ file: null })));

            expect(response.status).toBe(400);
            expect(getOwnMock).not.toHaveBeenCalled();
        });

        it('an empty file answers 422 before the 503 of a missing provider', async () => {
            providerRef.current = null;
            const empty = new File([], 'logo.png', { type: 'image/png' });
            const response = asResponse(await handleUploadMyPartnerLogo(makeCtx({ file: empty })));

            expect(response.body.error?.code).toBe('EMPTY_FILE');
        });

        it('an oversize body answers 413 before the 503 of a missing provider', async () => {
            providerRef.current = null;
            const response = asResponse(
                await handleUploadMyPartnerLogo(
                    makeCtx({ file: png(), contentLength: String(500 * 1024 * 1024) })
                )
            );

            expect(response.status).toBe(413);
        });

        it('no listing answers 404 before the 503 of a missing provider', async () => {
            providerRef.current = null;
            getOwnMock.mockResolvedValue({ data: { partner: null } });

            await expect(handleUploadMyPartnerLogo(makeCtx({ file: png() }))).rejects.toMatchObject(
                { code: 'NOT_FOUND' }
            );
        });
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
