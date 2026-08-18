/**
 * Tests for GalleryPhotoTextDialog (HOS-388).
 *
 * The patch-building rules are covered exhaustively as pure logic in
 * `utils/__tests__/gallery-photo-text.test.ts`. What is left for a render test
 * is the wiring that logic cannot see:
 *
 *  - The form re-seeds when a DIFFERENT photo opens the dialog. Without it the
 *    fields keep the previous photo's text, and the next save writes one
 *    photo's alt onto another — silently, with a success toast.
 *  - Saving an untouched form sends NOTHING. The endpoint answers
 *    VALIDATION_ERROR on an empty body, so a naive "always PATCH" would show the
 *    moderator an error they did not cause.
 *
 * @module features/accommodations/components/__tests__/GalleryPhotoTextDialog
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMutateAsync } = vi.hoisted(() => ({
    mockMutateAsync: vi.fn(async () => ({}))
}));

vi.mock('@/features/accommodations/hooks/useAccommodationMedia', () => ({
    useAccommodationMediaUpdateText: () => ({
        mutateAsync: mockMutateAsync,
        isPending: false
    })
}));

vi.mock('@/hooks/use-translations', () => ({
    // Returning the key itself keeps the assertions about BEHAVIOR rather than
    // about copy, and makes a missing key visible instead of silently blank.
    useTranslations: () => ({ t: (key: string) => key })
}));

import { GalleryPhotoTextDialog } from '../GalleryPhotoTextDialog';

const PHOTO_A = {
    id: 'media-a',
    alt: 'Alt de la foto A',
    caption: 'Leyenda A',
    description: 'Descripcion A'
} as never;

const PHOTO_B = {
    id: 'media-b',
    alt: 'Alt de la foto B',
    caption: null,
    description: null
} as never;

function renderDialog(photo: unknown) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const onClose = vi.fn();
    const view = render(
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(GalleryPhotoTextDialog, {
                accommodationId: 'acc-1',
                photo: photo as never,
                onClose
            })
        )
    );
    return { ...view, onClose };
}

describe('GalleryPhotoTextDialog', () => {
    beforeEach(() => {
        mockMutateAsync.mockClear();
    });

    it('seeds the fields from the photo it was opened with', () => {
        renderDialog(PHOTO_A);

        expect(screen.getByLabelText('admin-pages.gallery.photoText.fieldAlt')).toHaveValue(
            'Alt de la foto A'
        );
        expect(screen.getByLabelText('admin-pages.gallery.photoText.fieldCaption')).toHaveValue(
            'Leyenda A'
        );
    });

    it('re-seeds when a different photo opens the dialog', () => {
        const { rerender, ...rest } = renderDialog(PHOTO_A);
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });

        rerender(
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                React.createElement(GalleryPhotoTextDialog, {
                    accommodationId: 'acc-1',
                    photo: PHOTO_B,
                    onClose: rest.onClose
                })
            )
        );

        // Keeping A's text here is the bug: the next save would write A's alt
        // onto B, with no visible sign anything went wrong.
        expect(screen.getByLabelText('admin-pages.gallery.photoText.fieldAlt')).toHaveValue(
            'Alt de la foto B'
        );
        // B has no caption; the field must clear, not inherit A's.
        expect(screen.getByLabelText('admin-pages.gallery.photoText.fieldCaption')).toHaveValue('');
    });

    it('sends nothing and just closes when the form was not touched', async () => {
        const { onClose } = renderDialog(PHOTO_A);

        await act(async () => {
            screen.getByText('admin-pages.gallery.photoText.actions.save').click();
        });

        expect(mockMutateAsync).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders nothing when there is no photo to edit', () => {
        renderDialog(null);

        expect(
            screen.queryByLabelText('admin-pages.gallery.photoText.fieldAlt')
        ).not.toBeInTheDocument();
    });
});
