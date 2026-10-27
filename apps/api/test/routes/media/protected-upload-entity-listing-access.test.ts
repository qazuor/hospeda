/**
 * @file protected-upload-entity-listing-access.test.ts
 * @description HOS-1682 — `POST /api/v1/protected/media/upload-entity` runs the
 * listing access chain on the three listing verticals, and every `featured`
 * upload gets a unique public id.
 *
 * - TEST:M1682:1 — the chain runs with the vertical of the service branch;
 *   destination/event/post do not run it.
 * - TEST:M1682:2 — no coverage → 403 ENTITLEMENT_REQUIRED (NO_COVERAGE) on both
 *   roles of the three verticals; the plan photo limit answers LIMIT_REACHED
 *   before the general gallery cap.
 * - TEST:M1682:3 — an own ARCHIVED/PURGED listing answers the same whole 404 as
 *   a missing id; DRAFT, UNPUBLISHED_BY_BILLING and MODERATED pass.
 * - TEST:M1682:4 — two `featured` uploads on the same listing never reuse a
 *   fixed public id.
 *
 * @module test/routes/media/protected-upload-entity-listing-access
 */

import { accommodationMediaModel } from '@repo/db';
import {
    getGalleryCap,
    PermissionEnum,
    PublicationStatusEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    PostService,
    VenueService
} from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockUserActor } from '../../helpers/auth';

const mocks = vi.hoisted(() => ({
    loadFacts: vi.fn(),
    coverage: vi.fn(),
    effectiveSet: vi.fn(),
    upload: vi.fn()
}));

// The real service-core: the chain throws its ServiceError and the route
// factory must map it, so the global stub class would turn every gate into 500.
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>())
}));
vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({ upload: mocks.upload })
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: mocks.loadFacts,
        billing: { coverage: mocks.coverage },
        effectiveSet: mocks.effectiveSet
    })
}));

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '44444444-4444-4444-8444-444444444444';
const UPLOAD_URL = 'http://localhost/api/v1/protected/media/upload-entity';

const BASE_SOURCE = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'base' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

const REAL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
);

type ListingEntityType = 'accommodation' | 'venue' | 'experience';

const VERTICALS: readonly {
    readonly entityType: ListingEntityType;
    readonly vertical: VerticalEnum;
    readonly service: { prototype: { getById: unknown } };
}[] = [
    {
        entityType: 'accommodation',
        vertical: VerticalEnum.ACCOMMODATION,
        service: AccommodationService
    },
    { entityType: 'venue', vertical: VerticalEnum.VENUE, service: VenueService },
    { entityType: 'experience', vertical: VerticalEnum.EXPERIENCE, service: ExperienceService }
];

const owner = createMockUserActor({
    id: OWNER_ID,
    permissions: [
        PermissionEnum.ACCOMMODATION_UPDATE_OWN,
        PermissionEnum.GASTRONOMY_EDIT_OWN,
        PermissionEnum.EXPERIENCE_EDIT_OWN
    ]
});

const authHeaders = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(createAuthenticatedRequest(owner).headers)) {
        if (key.toLowerCase() !== 'content-type') out[key] = value;
    }
    return out;
};

/** Stub `getById` of every service so the listing exists and belongs to the owner. */
function ownListing(): void {
    const data = { id: LISTING_ID, ownerId: OWNER_ID, authorId: OWNER_ID, media: {} };
    for (const service of [AccommodationService, VenueService, ExperienceService, PostService]) {
        vi.spyOn(service.prototype, 'getById').mockImplementation(
            async (_actor: unknown, id: unknown) =>
                (id === MISSING_ID
                    ? { error: { code: ServiceErrorCode.NOT_FOUND, message: 'not found' } }
                    : { data }) as never
        );
    }
}

/** Configure the listing facts, the coverage and the owner's effective set. */
function configure(args: {
    readonly status?: PublicationStatusEnum;
    readonly covered?: boolean;
    readonly maxPhotos?: number;
}): void {
    const { status = PublicationStatusEnum.PUBLISHED, covered = true, maxPhotos = 100 } = args;
    mocks.loadFacts.mockResolvedValue({
        facts: { ownerId: OWNER_ID, publicationStatus: status },
        ownerId: OWNER_ID
    });
    mocks.coverage.mockResolvedValue(
        covered ? { covered: true, sources: [BASE_SOURCE] } : { covered: false, sources: [] }
    );
    mocks.effectiveSet.mockImplementation(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [
                    { key: 'edit_accommodation_info', value: 1, strategy: 'MAX' },
                    { key: 'edit_venue_info', value: 1, strategy: 'MAX' },
                    { key: 'edit_experience_info', value: 1, strategy: 'MAX' },
                    { key: 'max_photos_per_accommodation', value: maxPhotos, strategy: 'SUM' }
                ]
            })
    );
}

async function upload(args: {
    readonly entityType: string;
    readonly role: 'gallery' | 'featured';
    readonly entityId?: string;
    readonly overwrite?: boolean;
}): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
    const { initApp } = await import('../../../src/app');
    const app = await initApp();
    const form = new FormData();
    form.append('entityType', args.entityType);
    form.append('entityId', args.entityId ?? LISTING_ID);
    form.append('role', args.role);
    if (args.overwrite !== undefined) form.append('overwrite', String(args.overwrite));
    form.append('file', new File([REAL_PNG], 'photo.png', { type: 'image/png' }));
    const response = await app.request(
        new Request(UPLOAD_URL, { method: 'POST', body: form, headers: authHeaders() })
    );
    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>
    };
}

/** The response body without `metadata` (request id, timestamp), as TEST:V5:4 does. */
function withoutMetadata(body: Record<string, unknown>): Record<string, unknown> {
    const { metadata: _metadata, ...rest } = body;
    return rest;
}

beforeEach(() => {
    vi.clearAllMocks();
    ownListing();
    configure({});
    vi.mocked(accommodationMediaModel.findByAccommodation).mockResolvedValue({
        items: [],
        total: 0
    } as never);
    mocks.upload.mockImplementation(
        async ({ folder, publicId }: { folder: string; publicId: string }) => ({
            url: `https://res.example.com/${folder}/${publicId}.png`,
            publicId: `${folder}/${publicId}`,
            width: 1,
            height: 1
        })
    );
});

describe('TEST:M1682:1 upload-entity runs listing access with the vertical of the service branch', () => {
    it.each(VERTICALS)('$entityType loads the listing facts of its own vertical', async (row) => {
        for (const role of ['gallery', 'featured'] as const) {
            mocks.loadFacts.mockClear();
            const response = await upload({ entityType: row.entityType, role });
            expect(response.status, `${row.entityType} ${role}`).toBe(200);
            expect(mocks.loadFacts).toHaveBeenCalledTimes(1);
            expect(mocks.loadFacts).toHaveBeenCalledWith({
                vertical: row.vertical,
                listingId: LISTING_ID
            });
        }
    });

    it('does not run the chain for a post, which is not a listing', async () => {
        // `featured`: a post gallery counts rows of a model this harness does not stub.
        const response = await upload({ entityType: 'post', role: 'featured' });
        expect(response.status).toBe(200);
        expect(mocks.loadFacts).not.toHaveBeenCalled();
        expect(mocks.coverage).not.toHaveBeenCalled();
    });
});

describe('TEST:M1682:2 coverage and the plan photo limit gate the upload', () => {
    it.each(
        VERTICALS
    )('$entityType without coverage answers NO_COVERAGE on both roles', async (row) => {
        configure({ covered: false });
        for (const role of ['gallery', 'featured'] as const) {
            const response = await upload({ entityType: row.entityType, role });
            expect(response.status, `${row.entityType} ${role}`).toBe(403);
            expect(response.body.error).toMatchObject({
                code: ServiceErrorCode.ENTITLEMENT_REQUIRED,
                details: { entitlementKey: null, reason: 'NO_COVERAGE' }
            });
        }
        expect(mocks.upload).not.toHaveBeenCalled();
    });

    it('answers LIMIT_REACHED for a full accommodation plan before the general gallery cap', async () => {
        const cap = getGalleryCap('accommodation');
        configure({ maxPhotos: 5 });
        vi.mocked(accommodationMediaModel.findByAccommodation).mockResolvedValue({
            items: [],
            total: cap
        } as never);
        const response = await upload({ entityType: 'accommodation', role: 'gallery' });
        expect(response.status).toBe(403);
        expect(response.body.error).toMatchObject({
            code: ServiceErrorCode.LIMIT_REACHED,
            details: { limitKey: 'max_photos_per_accommodation', maxAllowed: 5 }
        });
        expect(mocks.upload).not.toHaveBeenCalled();
    });
});

describe('TEST:M1682:3 the listing state gates the upload', () => {
    it.each(
        VERTICALS
    )('$entityType ARCHIVED and PURGED answer the whole 404 of a missing id', async (row) => {
        const missing = await upload({
            entityType: row.entityType,
            role: 'gallery',
            entityId: MISSING_ID
        });
        expect(missing.status).toBe(404);
        for (const status of [PublicationStatusEnum.ARCHIVED, PublicationStatusEnum.PURGED]) {
            configure({ status });
            const refused = await upload({ entityType: row.entityType, role: 'gallery' });
            expect(refused.status, `${row.entityType} ${status}`).toBe(404);
            expect(withoutMetadata(refused.body)).toEqual(withoutMetadata(missing.body));
        }
        expect(mocks.upload).not.toHaveBeenCalled();
    });

    it.each(
        VERTICALS
    )('$entityType DRAFT, UNPUBLISHED_BY_BILLING and MODERATED pass with coverage', async (row) => {
        for (const status of [
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.MODERATED
        ]) {
            configure({ status });
            const response = await upload({ entityType: row.entityType, role: 'gallery' });
            expect(response.status, `${row.entityType} ${status}`).toBe(200);
        }
    });
});

describe('TEST:M1682:4 a featured upload never reuses a fixed public id', () => {
    it('two featured uploads on the same listing get two distinct featured/ ids', async () => {
        const first = await upload({ entityType: 'venue', role: 'featured', overwrite: true });
        const second = await upload({
            entityType: 'venue',
            role: 'featured',
            overwrite: true
        });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(mocks.upload).toHaveBeenCalledTimes(2);
        const firstId = mocks.upload.mock.calls[0]?.[0].publicId as string;
        const secondId = mocks.upload.mock.calls[1]?.[0].publicId as string;
        expect(firstId).not.toBe('featured');
        expect(secondId).not.toBe('featured');
        expect(firstId.startsWith('featured/')).toBe(true);
        expect(secondId.startsWith('featured/')).toBe(true);
        expect(firstId).not.toBe(secondId);
        expect(mocks.upload.mock.calls[0]?.[0].overwrite).toBe(true);
        const firstUrl = (first.body.data as { url: string }).url;
        const secondUrl = (second.body.data as { url: string }).url;
        expect(firstUrl).not.toBe(secondUrl);
    });
});
