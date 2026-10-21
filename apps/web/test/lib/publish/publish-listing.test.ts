import { beforeEach, describe, expect, it, vi } from 'vitest';

const accommodationPublish = vi.hoisted(() => vi.fn());
const verticalPublish = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: accommodationPublish },
    publishApi: { publish: verticalPublish }
}));

import {
    publishListing,
    resolvePublishEditorPath,
    resolvePublishPricingPath
} from '@/lib/publish/publish-listing';

describe('publishListing (TEST:1729:1)', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('dispatches %s to its publish method', async (vertical) => {
        await publishListing({ vertical, id: 'listing-1' });
        if (vertical === 'accommodation') {
            expect(accommodationPublish).toHaveBeenCalledWith({ id: 'listing-1' });
            expect(verticalPublish).not.toHaveBeenCalled();
        } else {
            expect(verticalPublish).toHaveBeenCalledWith({ vertical, id: 'listing-1' });
            expect(accommodationPublish).not.toHaveBeenCalled();
        }
    });

    it('resolves pricing and editor paths for all verticals', () => {
        expect(resolvePublishPricingPath({ vertical: 'accommodation' })).toBe(
            'planes/anfitriones/precios'
        );
        expect(resolvePublishPricingPath({ vertical: 'gastronomy' })).toBe(
            'planes/gastronomia/precios'
        );
        expect(resolvePublishPricingPath({ vertical: 'experience' })).toBe(
            'planes/experiencias/precios'
        );
        expect(resolvePublishEditorPath({ vertical: 'accommodation', id: 'a-1' })).toBe(
            'mi-cuenta/propiedades/a-1/editar'
        );
        expect(resolvePublishEditorPath({ vertical: 'gastronomy', id: 'g-1' })).toBe(
            'mi-cuenta/comercio/gastronomy/g-1/editar'
        );
        expect(resolvePublishEditorPath({ vertical: 'experience', id: 'e-1' })).toBe(
            'mi-cuenta/comercio/experience/e-1/editar'
        );
    });
});
