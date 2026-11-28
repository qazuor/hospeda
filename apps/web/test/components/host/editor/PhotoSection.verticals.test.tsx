/**
 * @file PhotoSection.verticals.test.tsx
 * @description HOS-2495 — the ONE photo editor, rendered for venue and
 * experience (AC-11..AC-14, AC-20). Real i18n and the real kit confirm dialog;
 * only the HTTP clients and the upload helper are mocked.
 *
 * Asserted per vertical:
 *  - every call goes to that vertical's media API (never the accommodation one);
 *  - reorder sends the cover first and rolls back on failure (AC-11);
 *  - metadata edits and cover promotion persist, at or over the cap (AC-12);
 *  - delete asks first; cancel makes no request (AC-13);
 *  - tiles beyond the cap carry "No se muestra: superás tu tope", stay
 *    editable, and the marking follows a reorder (AC-14);
 *  - an upload goes to upload-entity with the vertical and the role, the
 *    allowance is re-read after the batch, and a refused one is localized.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import { UploadEntityError } from '@/lib/media/upload-entity-error';
import { allowanceOk } from './photo-allowance-fixture';

const { listingApi, accommodationApi, mockGetAllowance, mockUploadEntityImage, mockAddToast } =
    vi.hoisted(() => ({
        listingApi: {
            listMedia: vi.fn(),
            addMedia: vi.fn(),
            addFeaturedMedia: vi.fn(),
            removeMedia: vi.fn(),
            setFeaturedMedia: vi.fn(),
            reorderMedia: vi.fn(),
            updateMedia: vi.fn()
        },
        accommodationApi: {
            listMedia: vi.fn(),
            addMedia: vi.fn(),
            addFeaturedMedia: vi.fn(),
            removeMedia: vi.fn(),
            setFeaturedMedia: vi.fn(),
            reorderMedia: vi.fn(),
            updateMedia: vi.fn()
        },
        mockGetAllowance: vi.fn(),
        mockUploadEntityImage: vi.fn(),
        mockAddToast: vi.fn()
    }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: accommodationApi,
    listingMediaApi: listingApi,
    listingPhotoAllowanceApi: { getAllowance: mockGetAllowance },
    publishApi: { subscribeDestination: vi.fn() }
}));
vi.mock('@/lib/api/endpoints-protected-addons', () => ({
    billingAddonApi: {
        offers: () =>
            Promise.resolve({ ok: false, error: { status: 500, code: 'X', message: 'x' } })
    }
}));

vi.mock('@/lib/media/upload-entity', () => ({ uploadEntityImage: mockUploadEntityImage }));
vi.mock('@/lib/media/compress-image', () => ({
    compressImageForUpload: async ({ file }: { file: File }) => ({ file, status: 'skipped' }),
    isCompressionUnavailable: () => false
}));
vi.mock('@/store/toast-store', () => ({ addToast: mockAddToast }));
vi.mock('@/lib/logger', () => ({ webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const LISTING_ID = 'listing-uuid-1';

/** One media row as the listing API answers it. */
function row(id: string, sortOrder: number, overrides: Record<string, unknown> = {}) {
    return {
        id,
        url: `https://cdn.example.com/${id}.jpg`,
        publicId: `hospeda/listings/${id}`,
        caption: null,
        description: null,
        alt: `Foto ${id}`,
        attribution: null,
        isFeatured: false,
        sortOrder,
        state: 'visible' as const,
        moderationState: 'APPROVED',
        ...overrides
    };
}

const COVER = row('cover', 0, { isFeatured: true });
/** g1 is still in moderation: it never takes a public slot and is never marked. */
const ROWS = [
    COVER,
    row('g0', 1),
    row('g1', 2, { moderationState: 'PENDING' }),
    row('g2', 3),
    row('g3', 4),
    row('g4', 5)
];

function listOk(rows: readonly ReturnType<typeof row>[]) {
    return Promise.resolve({ ok: true as const, data: { media: rows } });
}

/** The sortable cell (`data-sortable-id`) of a photo. */
function tileOf(id: string): HTMLElement {
    const tile = document.querySelector(`[data-sortable-id="${id}"]`);
    if (!(tile instanceof HTMLElement)) throw new Error(`no tile ${id}`);
    return tile;
}

/** Ids of the tiles carrying the over-cap badge, in display order. */
function overCapTileIds(): string[] {
    return screen
        .queryAllByTestId('photo-over-cap-badge')
        .map(
            (badge) => badge.closest('[data-sortable-id]')?.getAttribute('data-sortable-id') ?? ''
        );
}

describe.each(['venue', 'experience'] as const)('PhotoSection for %s (HOS-2495)', (vertical) => {
    beforeEach(() => {
        vi.clearAllMocks();
        listingApi.listMedia.mockReturnValue(listOk(ROWS));
        mockGetAllowance.mockImplementation(() => allowanceOk({ vertical, cap: 2, used: 5 }));
    });

    const renderSection = () =>
        render(
            <PhotoSection
                locale="es"
                vertical={vertical}
                listingId={LISTING_ID}
            />
        );

    it('hydrates from the vertical media API and reads the vertical allowance (AC-20)', async () => {
        renderSection();

        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(6));
        expect(listingApi.listMedia).toHaveBeenCalledWith({ vertical, id: LISTING_ID });
        expect(mockGetAllowance).toHaveBeenCalledWith({ vertical, id: LISTING_ID });
        expect(accommodationApi.listMedia).not.toHaveBeenCalled();
    });

    it('marks the approved photos beyond the cap and summarizes them (AC-14)', async () => {
        renderSection();

        await waitFor(() => expect(overCapTileIds()).toEqual(['g3', 'g4']));
        expect(screen.getAllByText('No se muestra: superás tu tope')).toHaveLength(2);
        expect(screen.getByTestId('photo-over-cap-summary')).toHaveTextContent(
            '2 fotos no se muestran porque superás tu tope. Sumá un pack de fotos o reordená para elegir cuáles se ven.'
        );
        // The badge describes the image to screen readers.
        const badge = within(tileOf('g3')).getByTestId('photo-over-cap-badge');
        expect(within(tileOf('g3')).getByRole('img')).toHaveAttribute('aria-describedby', badge.id);
        // A PENDING photo is never marked, and the cover never counts.
        expect(within(tileOf('g1')).queryByTestId('photo-over-cap-badge')).toBeNull();
        // Every control of an over-cap tile stays enabled.
        const tile = within(tileOf('g4'));
        expect(tile.getByRole('button', { name: 'Eliminar' })).toBeEnabled();
        expect(tile.getByRole('button', { name: 'Mover foto 5 hacia arriba' })).toBeEnabled();
        expect(tile.getByRole('button', { name: 'Usar foto 5 como portada' })).toBeEnabled();
        expect(tile.getByRole('button', { name: 'Editar textos de la foto 5' })).toBeEnabled();
    });

    it('reorders with the cover first and re-marks the photo pushed past the cap (AC-11, AC-14)', async () => {
        const reordered = [ROWS[0], ROWS[1], ROWS[2], ROWS[4], ROWS[3], ROWS[5]];
        listingApi.reorderMedia.mockReturnValue(
            listOk(reordered as readonly ReturnType<typeof row>[])
        );
        renderSection();
        await waitFor(() => expect(overCapTileIds()).toEqual(['g3', 'g4']));

        fireEvent.click(screen.getByRole('button', { name: 'Mover foto 4 hacia arriba' }));

        await waitFor(() =>
            expect(listingApi.reorderMedia).toHaveBeenCalledWith({
                vertical,
                id: LISTING_ID,
                orderedIds: ['cover', 'g0', 'g1', 'g3', 'g2', 'g4']
            })
        );
        await waitFor(() => expect(overCapTileIds()).toEqual(['g2', 'g4']));
    });

    it('rolls a failed reorder back with a localized error (AC-11)', async () => {
        listingApi.reorderMedia.mockReturnValue(
            Promise.resolve({
                ok: false,
                error: {
                    status: 403,
                    code: 'ENTITLEMENT_REQUIRED',
                    message: 'Entitlement required'
                }
            })
        );
        renderSection();
        await waitFor(() => expect(overCapTileIds()).toEqual(['g3', 'g4']));

        fireEvent.click(screen.getByRole('button', { name: 'Mover foto 4 hacia arriba' }));

        await waitFor(() => expect(listingApi.reorderMedia).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(overCapTileIds()).toEqual(['g3', 'g4']));
        expect(document.body.textContent).not.toContain('Entitlement required');
    });

    it('promotes an over-cap photo to cover with setFeaturedMedia alone (AC-12)', async () => {
        listingApi.setFeaturedMedia.mockReturnValue(
            Promise.resolve({ ok: true, data: { media: row('g4', 5, { isFeatured: true }) } })
        );
        renderSection();
        await waitFor(() => expect(overCapTileIds()).toEqual(['g3', 'g4']));

        fireEvent.click(screen.getByRole('button', { name: 'Usar foto 5 como portada' }));

        await waitFor(() =>
            expect(listingApi.setFeaturedMedia).toHaveBeenCalledWith({
                vertical,
                id: LISTING_ID,
                mediaId: 'g4'
            })
        );
        expect(mockUploadEntityImage).not.toHaveBeenCalled();
        // A cover change changes what counts: the allowance is read again.
        await waitFor(() => expect(mockGetAllowance).toHaveBeenCalledTimes(2));
    });

    it('saves the metadata of an over-cap photo through the vertical API (AC-12)', async () => {
        listingApi.updateMedia.mockReturnValue(
            Promise.resolve({ ok: true, data: { media: row('g4', 5, { alt: 'Terraza' }) } })
        );
        renderSection();
        await waitFor(() => expect(overCapTileIds()).toEqual(['g3', 'g4']));

        fireEvent.click(screen.getByLabelText('Editar textos de la foto 5'));
        fireEvent.change(screen.getByLabelText('¿Qué muestra la foto?'), {
            target: { value: 'Terraza' }
        });
        fireEvent.click(screen.getByText('Guardar'));

        await waitFor(() =>
            expect(listingApi.updateMedia).toHaveBeenCalledWith({
                vertical,
                id: LISTING_ID,
                mediaId: 'g4',
                body: { alt: 'Terraza', caption: null, description: null, attribution: null }
            })
        );
    });

    it('deletes only after the confirm, once; cancel makes no request (AC-13)', async () => {
        listingApi.removeMedia.mockReturnValue(Promise.resolve({ ok: true, data: {} }));
        renderSection();
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(6));

        fireEvent.click(within(tileOf('g0')).getByRole('button', { name: 'Eliminar' }));
        let dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
        expect(listingApi.removeMedia).not.toHaveBeenCalled();

        fireEvent.click(within(tileOf('g0')).getByRole('button', { name: 'Eliminar' }));
        dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

        await waitFor(() => expect(document.querySelector('[data-sortable-id="g0"]')).toBeNull());
        expect(listingApi.removeMedia).toHaveBeenCalledTimes(1);
        expect(listingApi.removeMedia).toHaveBeenCalledWith({
            vertical,
            id: LISTING_ID,
            mediaId: 'g0'
        });
        // A delete changes `used`: the allowance is read again.
        await waitFor(() => expect(mockGetAllowance).toHaveBeenCalledTimes(2));
    });

    it('uploads to the vertical with the gallery role and re-reads the allowance (AC-2/3)', async () => {
        listingApi.listMedia.mockReturnValue(listOk([COVER, row('g0', 1)]));
        mockGetAllowance.mockImplementation(() => allowanceOk({ vertical, cap: 15, used: 1 }));
        mockUploadEntityImage.mockResolvedValue({
            url: 'https://cdn.example.com/new.jpg',
            publicId: 'hospeda/listings/new',
            width: 800,
            height: 600
        });
        listingApi.addMedia.mockReturnValue(
            Promise.resolve({ ok: true, data: { media: row('new', 2) } })
        );
        renderSection();
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeEnabled()
        );

        const input = document.querySelector('#gallery-image-input') as HTMLInputElement;
        fireEvent.change(input, {
            target: { files: [new File(['img'], 'a.jpg', { type: 'image/jpeg' })] }
        });

        await waitFor(() =>
            expect(listingApi.addMedia).toHaveBeenCalledWith({
                vertical,
                id: LISTING_ID,
                body: {
                    url: 'https://cdn.example.com/new.jpg',
                    publicId: 'hospeda/listings/new',
                    moderationState: 'APPROVED'
                }
            })
        );
        expect(mockUploadEntityImage).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: vertical, entityId: LISTING_ID, role: 'gallery' })
        );
        await waitFor(() => expect(mockGetAllowance).toHaveBeenCalledTimes(2));
    });

    it('shows the localized cap copy when upload-entity refuses with LIMIT_REACHED (AC-10)', async () => {
        listingApi.listMedia.mockReturnValue(listOk([COVER, row('g0', 1)]));
        mockGetAllowance.mockImplementation(() => allowanceOk({ vertical, cap: 15, used: 1 }));
        mockUploadEntityImage.mockRejectedValue(
            new UploadEntityError({
                message: 'Limit reached',
                code: 'LIMIT_REACHED',
                status: 403,
                details: {
                    limitKey: `max_photos_per_${vertical}`,
                    currentCount: 15,
                    maxAllowed: 15
                }
            })
        );
        renderSection();
        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeEnabled()
        );

        const input = document.querySelector('#gallery-image-input') as HTMLInputElement;
        fireEvent.change(input, {
            target: {
                files: [
                    new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
                    new File(['b'], 'b.jpg', { type: 'image/jpeg' })
                ]
            }
        });

        await waitFor(() => expect(mockAddToast).toHaveBeenCalledTimes(1));
        // The batch stopped at the first refusal: no second upload attempt.
        expect(mockUploadEntityImage).toHaveBeenCalledTimes(1);
        expect(listingApi.addMedia).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('Limit reached');
        expect(mockAddToast.mock.calls[0]?.[0]?.message).not.toContain('Limit reached');
    });

    it('uploads a new cover with the featured role (AC-19)', async () => {
        listingApi.listMedia.mockReturnValue(listOk([row('g0', 1)]));
        mockGetAllowance.mockImplementation(() => allowanceOk({ vertical, cap: 15, used: 1 }));
        mockUploadEntityImage.mockResolvedValue({
            url: 'https://cdn.example.com/cover-new.jpg',
            publicId: 'hospeda/listings/cover-new',
            width: 800,
            height: 600
        });
        listingApi.addFeaturedMedia.mockReturnValue(
            Promise.resolve({
                ok: true,
                data: { media: row('cover-new', 0, { isFeatured: true }), previousFeatured: null }
            })
        );
        renderSection();
        await waitFor(() => expect(document.querySelector('#featured-image-input')).toBeEnabled());

        const input = document.querySelector('#featured-image-input') as HTMLInputElement;
        fireEvent.change(input, {
            target: { files: [new File(['img'], 'cover.jpg', { type: 'image/jpeg' })] }
        });

        await waitFor(() => expect(listingApi.addFeaturedMedia).toHaveBeenCalledTimes(1));
        expect(mockUploadEntityImage).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: vertical,
                entityId: LISTING_ID,
                role: 'featured'
            })
        );
    });
});
