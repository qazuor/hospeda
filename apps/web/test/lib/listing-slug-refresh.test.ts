import { describe, expect, it } from 'vitest';
import {
    buildSlugRefreshPayload,
    shouldOfferPublishedSlugRefresh
} from '@/lib/listing-slug-refresh';

describe('listing-slug-refresh', () => {
    it('offers the opt-in only for published listings whose name changed', () => {
        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo'
            })
        ).toBe(true);

        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'DRAFT',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo'
            })
        ).toBe(false);

        expect(
            shouldOfferPublishedSlugRefresh({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre original'
            })
        ).toBe(false);
    });

    it('builds the opt-in payload only when the published rename was explicitly requested', () => {
        expect(
            buildSlugRefreshPayload({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo',
                refreshSlugFromName: true
            })
        ).toEqual({ refreshSlugFromName: true });

        expect(
            buildSlugRefreshPayload({
                currentLifecycleState: 'ACTIVE',
                initialName: 'Nombre original',
                currentName: 'Nombre nuevo',
                refreshSlugFromName: false
            })
        ).toEqual({});
    });
});
