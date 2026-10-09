/** TEST:V5:4 — a gastronomy id declared as accommodation is absent before media limits. */

import { ServiceErrorCode } from '@repo/schemas';
import { AccommodationService, GastronomyService } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

const { countGallery } = vi.hoisted(() => ({ countGallery: vi.fn() }));

vi.mock('../../src/services/media', () => ({
    getMediaProvider: () => ({ upload: vi.fn() })
}));
vi.mock('../../src/routes/media/gallery-count', () => ({
    resolveVisibleGalleryCount: countGallery
}));

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const GASTRONOMY_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '44444444-4444-4444-8444-444444444444';

async function request(id: string) {
    const { initApp } = await import('../../src/app.js');
    const app = await initApp();
    const body = new FormData();
    body.append('entityType', 'accommodation');
    body.append('entityId', id);
    body.append('role', 'gallery');
    body.append('file', new File(['image'], 'image.png', { type: 'image/png' }));
    const response = await app.request(
        new Request('http://localhost/api/v1/protected/media/upload-entity', {
            method: 'POST',
            body,
            headers: {
                'user-agent': 'vitest',
                'x-mock-actor-id': ACTOR_ID,
                'x-mock-actor-role': 'USER',
                'x-mock-actor-permissions': JSON.stringify([])
            }
        })
    );
    const responseBody: unknown = await response.json();
    if (responseBody && typeof responseBody === 'object' && 'metadata' in responseBody) {
        const { metadata, ...rest } = responseBody;
        return {
            status: response.status,
            body: {
                ...rest,
                metadataKeys:
                    metadata && typeof metadata === 'object' ? Object.keys(metadata).sort() : []
            }
        };
    }
    return { status: response.status, body: responseBody };
}

describe('TEST:V5:4 declared vertical on media upload', () => {
    it('pairs a gastronomy id declared as accommodation with an invented id', async () => {
        const accommodation = vi
            .spyOn(AccommodationService.prototype, 'getById')
            .mockResolvedValue({
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'accommodation not found' }
            });
        const gastronomy = vi.spyOn(GastronomyService.prototype, 'getById');
        const foreign = await request(GASTRONOMY_ID);
        const missing = await request(MISSING_ID);
        expect(foreign).toEqual(missing);
        expect(foreign.status).toBe(404);
        expect(accommodation).toHaveBeenCalledTimes(2);
        expect(gastronomy).not.toHaveBeenCalled();
        expect(countGallery).not.toHaveBeenCalled();
    });
});
