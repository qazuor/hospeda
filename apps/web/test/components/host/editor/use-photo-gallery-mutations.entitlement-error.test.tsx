/**
 * @file use-photo-gallery-mutations.entitlement-error.test.tsx
 * @description HOS-2442 / HOS-2495 (AC-10): a 403 `ENTITLEMENT_REQUIRED` or
 * `LIMIT_REACHED` from any photo mutation, in any of the three listing
 * verticals, reaches the owner as localized copy through `translateApiError` —
 * never the API's raw English `message`.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePhotoGalleryMutations } from '@/components/host/editor/use-photo-gallery-mutations';
import { createListingPhotoApi, type ListingPhotoVertical } from '@/lib/api/listing-photo-api';
import type { AccommodationMediaItem } from '@/lib/api/types';
import { createTranslations } from '@/lib/i18n';

// HOS-2429: removal asks for confirmation; here the user always confirms.
vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: vi.fn().mockResolvedValue(true)
}));

const { mediaApi } = vi.hoisted(() => ({
    mediaApi: {
        listMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: mediaApi,
    listingMediaApi: mediaApi
}));

const photo: AccommodationMediaItem = {
    id: 'photo-1',
    url: 'https://example.com/photo.jpg',
    publicId: 'photo-1',
    isFeatured: false,
    caption: undefined,
    description: undefined,
    attribution: undefined,
    alt: 'Texto'
};
const second: AccommodationMediaItem = { ...photo, id: 'photo-2', publicId: 'photo-2' };

function mount(vertical: ListingPhotoVertical) {
    const setError = vi.fn();
    const reportUploadError = vi.fn();
    const { result } = renderHook(() =>
        usePhotoGalleryMutations({
            api: createListingPhotoApi({ vertical }),
            listingId: 'listing-1',
            t: createTranslations('es').t,
            featuredItem: { ...photo, id: 'cover-1', isFeatured: true },
            galleryItems: [photo, second],
            isHydrated: true,
            setFeaturedItem: vi.fn(),
            setGalleryItems: vi.fn(),
            setError,
            setOpLoading: vi.fn(),
            reportUploadError,
            confirmRemoval: vi.fn().mockResolvedValue(true),
            onUsageChanged: vi.fn().mockResolvedValue(undefined)
        })
    );
    /** Every message the hook rendered, inline or as a toast. */
    const messages = () =>
        [...setError.mock.calls, ...reportUploadError.mock.calls]
            .map((call) => call[0])
            .filter((value): value is string => typeof value === 'string');
    return { result, messages };
}

const ENTITLEMENT_REQUIRED = {
    ok: false,
    error: {
        code: 'ENTITLEMENT_REQUIRED',
        reason: 'NO_COVERAGE',
        message: 'Entitlement required',
        status: 403
    }
};
const LIMIT_REACHED = {
    ok: false,
    error: {
        code: 'LIMIT_REACHED',
        message: 'Limit reached',
        status: 403,
        details: { limitKey: 'max_photos_per_venue', currentCount: 15, maxAllowed: 15 }
    }
};

type Operation = 'remove' | 'removeCover' | 'promote' | 'reorder' | 'update';

async function run(result: ReturnType<typeof mount>['result'], operation: Operation) {
    await act(async () => {
        if (operation === 'remove') await result.current.handleGalleryRemove(photo);
        if (operation === 'removeCover') await result.current.handleFeaturedRemove();
        if (operation === 'promote') await result.current.handlePromoteToFeatured(photo);
        if (operation === 'reorder') {
            result.current.handleMoveDown(photo);
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (operation === 'update') await result.current.handleUpdateMediaText(photo, { alt: 'x' });
    });
}

describe('AC-10 — raw API errors never reach the photo editor, in any vertical', () => {
    beforeEach(() => {
        for (const fn of Object.values(mediaApi)) fn.mockReset();
    });

    const verticals: readonly ListingPhotoVertical[] = ['accommodation', 'venue', 'experience'];
    const operations: readonly Operation[] = [
        'remove',
        'removeCover',
        'promote',
        'reorder',
        'update'
    ];
    const cases = verticals.flatMap((vertical) =>
        operations.flatMap((operation) =>
            [
                { name: 'ENTITLEMENT_REQUIRED', answer: ENTITLEMENT_REQUIRED },
                { name: 'LIMIT_REACHED', answer: LIMIT_REACHED }
            ].map((error) => ({ vertical, operation, ...error }))
        )
    );

    it.each(cases)('$vertical $operation answering $name shows localized copy', async ({
        vertical,
        operation,
        answer
    }) => {
        mediaApi.removeMedia.mockResolvedValue(answer);
        mediaApi.setFeaturedMedia.mockResolvedValue(answer);
        mediaApi.reorderMedia.mockResolvedValue(answer);
        mediaApi.updateMedia.mockResolvedValue(answer);
        const { result, messages } = mount(vertical);

        await run(result, operation);

        const shown = messages();
        expect(shown.length).toBeGreaterThan(0);
        for (const message of shown) {
            expect(message).not.toContain('Entitlement required');
            expect(message).not.toContain('Limit reached');
        }
        const { t } = createTranslations('es');
        const expected =
            answer === ENTITLEMENT_REQUIRED
                ? t('common.apiError.ENTITLEMENT_REQUIRED')
                : t('common.apiError.LIMIT_REACHED');
        expect(shown).toContain(expected);
    });

    it('shows the entitlement copy the owner can act on', async () => {
        mediaApi.removeMedia.mockResolvedValue(ENTITLEMENT_REQUIRED);
        const { result, messages } = mount('venue');

        await run(result, 'remove');

        expect(messages()).toHaveLength(1);
        expect(messages()[0]).toContain('Tu plan no incluye');
    });
});
