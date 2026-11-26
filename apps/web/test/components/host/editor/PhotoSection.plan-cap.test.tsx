/**
 * @file PhotoSection.plan-cap.test.tsx
 * @description HOS-1024 / HOS-2495 — the photo gallery cap shown and enforced
 * in the editor is the owner's EFFECTIVE cap as the listing's `photo-allowance`
 * reports it (the number step 7 enforces), never a flat entity ceiling. The
 * same component serves accommodation, venue and experience.
 *
 * Real i18n and a real toast store/viewport are used throughout (not a
 * hand-rolled translation stub) — the assertions below read the actual copy
 * and the actual upsell CTA the host would see, mirroring
 * `PhotoSection.limit.test.tsx`'s rationale for the same choice.
 *
 * `listingPhotoAllowanceApi.getAllowance` is mocked, so each test controls the
 * allowance answer (or keeps it in flight) without touching the network.
 */

import { DRAFT_DESCRIPTION_PLACEHOLDER } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import { ToastViewport } from '@/components/ui/ToastViewport.client';
import { createTranslations } from '@/lib/i18n';
import { clearToasts } from '@/store/toast-store';
import { allowanceFailed, allowanceOk } from './photo-allowance-fixture';

const {
    mockListMedia,
    mockAddMedia,
    mockListingListMedia,
    mockUploadEntityImage,
    mockGetAllowance,
    mockFeaturedOverride,
    mockSubscribeDestination
} = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockAddMedia: vi.fn(),
    mockListingListMedia: vi.fn(),
    mockUploadEntityImage: vi.fn(),
    mockGetAllowance: vi.fn(),
    mockFeaturedOverride: { current: null as null | Record<string, unknown> },
    mockSubscribeDestination: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: mockAddMedia,
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    },
    listingMediaApi: {
        listMedia: mockListingListMedia,
        addMedia: vi.fn(),
        addFeaturedMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    },
    listingPhotoAllowanceApi: { getAllowance: mockGetAllowance },
    publishApi: {
        subscribeDestination: mockSubscribeDestination
    },
    protectedMediaApi: { deleteMedia: vi.fn() }
}));

vi.mock('@/lib/media/upload-entity', () => ({
    uploadEntityImage: mockUploadEntityImage
}));

vi.mock('@/components/host/editor/use-photo-section', async () => {
    const actual = await vi.importActual<
        typeof import('@/components/host/editor/use-photo-section')
    >('@/components/host/editor/use-photo-section');
    return {
        ...actual,
        usePhotoSection: (params: Parameters<typeof actual.usePhotoSection>[0]) => {
            const state = actual.usePhotoSection(params);
            return mockFeaturedOverride.current === null
                ? state
                : { ...state, featuredItem: mockFeaturedOverride.current as never };
        }
    };
});

const ACC_ID = 'acc-uuid-plan-cap';
const defaultProps: PhotoSectionProps = {
    locale: 'es',
    vertical: 'accommodation',
    listingId: ACC_ID
};

/**
 * Where the cap upsell points. It used to be the photos add-on
 * (`/mi-cuenta/addons/?focus=extra-photos-20`); that page was removed with the
 * old billing (HOS-1637, AC:B13a:20), so it is the plan upgrade.
 */
const PLAN_HREF = '/es/mi-cuenta/suscripcion/';

/** Build N gallery-only rows (never featured) for `listMedia`. */
function buildGalleryRows(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: `g-${i}`,
        url: `https://cdn.example.com/g${i}.jpg`,
        publicId: `hospeda/accommodations/abc/gallery/g${i}`,
        isFeatured: false,
        sortOrder: i,
        state: 'visible' as const,
        moderationState: 'APPROVED'
    }));
}

function makeListOk(rows: ReturnType<typeof buildGalleryRows> = []) {
    return Promise.resolve({ ok: true as const, data: { media: rows } });
}

function makeUploadOk(i: number) {
    return Promise.resolve({
        url: `https://cdn.example.com/new-${i}.jpg`,
        publicId: `hospeda/accommodations/abc/gallery/new-${i}`,
        width: 800,
        height: 600
    });
}

function makeAddOk(i: number) {
    return Promise.resolve({
        ok: true as const,
        data: {
            media: {
                id: `new-${i}`,
                url: `https://cdn.example.com/new-${i}.jpg`,
                publicId: `hospeda/accommodations/abc/gallery/new-${i}`,
                isFeatured: false
            }
        }
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockFeaturedOverride.current = null;
    mockSubscribeDestination.mockResolvedValue({
        ok: true,
        data: { destination: 'PUBLISH', trialDays: 14 }
    });
    clearToasts();
    mockListMedia.mockReturnValue(makeListOk());
    mockListingListMedia.mockReturnValue(makeListOk());
    mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 15 })); // Owner Básico
});

afterEach(() => {
    clearToasts();
});

describe('HOS-1024 — header + gallery label show the PLAN cap, not the entity ceiling', () => {
    it('counts 15 gallery photos independently of the featured cover', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(15)));
        mockFeaturedOverride.current = {
            id: 'featured-cover',
            url: 'https://cdn.example.com/cover.jpg',
            publicId: 'hospeda/accommodations/abc/featured/cover',
            isFeatured: true
        };

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() =>
            expect(screen.getByText('Galería de fotos (máx. 15)')).toBeInTheDocument()
        );
        expect(document.querySelector('#gallery-image-input')).toBeDisabled();
        expect(screen.getByText('Límite de galería alcanzado (máx 15 fotos)')).toBeInTheDocument();
    });

    it('does not count the featured cover toward the 15-photo gallery cap', async () => {
        const cover = {
            id: 'featured-cover',
            url: 'https://cdn.example.com/cover.jpg',
            publicId: 'hospeda/accommodations/abc/featured/cover',
            isFeatured: true,
            sortOrder: 0,
            state: 'visible' as const,
            moderationState: 'APPROVED'
        };
        mockListMedia.mockReturnValue(makeListOk([...buildGalleryRows(14), cover]));

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() => expect(document.querySelector('#gallery-image-input')).toBeEnabled());
        expect(
            screen.queryByText('Límite de galería alcanzado (máx 15 fotos)')
        ).not.toBeInTheDocument();
    });

    it('disables gallery uploads with 15 gallery rows plus the featured cover', async () => {
        const cover = {
            id: 'featured-cover',
            url: 'https://cdn.example.com/cover.jpg',
            publicId: 'hospeda/accommodations/abc/featured/cover',
            isFeatured: true,
            sortOrder: 0,
            state: 'visible' as const,
            moderationState: 'APPROVED'
        };
        mockListMedia.mockReturnValue(makeListOk([...buildGalleryRows(15), cover]));

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() => expect(document.querySelector('#gallery-image-input')).toBeDisabled());
        expect(screen.getByText('Límite de galería alcanzado (máx 15 fotos)')).toBeInTheDocument();
    });

    it('states the plan cap (15) in the section description, never the entity ceiling (50)', async () => {
        render(<PhotoSection {...defaultProps} />);

        const { tPlural } = createTranslations('es');
        const expected = tPlural('account.listingPhotos.description.accommodation', 15, {
            cap: 15
        });

        await waitFor(() => {
            expect(screen.getByText(expected)).toBeInTheDocument();
        });
        expect(screen.queryByText(/\b50\b/)).not.toBeInTheDocument();
    });

    it('states the plan cap (15) in the gallery label, never the entity ceiling (50)', async () => {
        render(<PhotoSection {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Galería de fotos (máx. 15)')).toBeInTheDocument();
        });
        expect(screen.queryByText('Galería de fotos (máx. 50)')).not.toBeInTheDocument();
    });

    it('reflects a DIFFERENT plan cap for a different plan (Owner Pro, 30)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 30 }));
        render(<PhotoSection {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Galería de fotos (máx. 30)')).toBeInTheDocument();
        });
    });
});

describe('HOS-2442 / AC-6 / AC-7 — no plan and a failed read, in every vertical', () => {
    it('never claims the host has no plan when the allowance read failed (AC-7)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceFailed());

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() =>
            expect(screen.getByText(/No pudimos cargar tu límite de fotos/)).toBeInTheDocument()
        );
        expect(screen.queryByText(/necesitás un plan/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Ver planes' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeDisabled();
        expect(document.querySelector('#gallery-image-input')).toBeDisabled();
        expect(document.querySelector('#featured-image-input')).toBeDisabled();
    });

    it('treats a thrown allowance read as failed, not as loading (AC-7)', async () => {
        mockGetAllowance.mockImplementation(() => Promise.reject(new Error('offline')));

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() =>
            expect(screen.getByText(/No pudimos cargar tu límite de fotos/)).toBeInTheDocument()
        );
        expect(screen.queryByText('Cargando tu límite de fotos…')).not.toBeInTheDocument();
    });

    it.each([
        {
            vertical: 'accommodation' as const,
            copy: 'Para subir fotos de tu alojamiento, necesitás un plan que las incluya.',
            pricing: '/es/planes/anfitriones/precios/'
        },
        {
            vertical: 'venue' as const,
            copy: 'Para subir fotos de tu ficha de Comer y salir, necesitás un plan que las incluya.',
            pricing: '/es/planes/comer-y-salir/precios/'
        },
        {
            vertical: 'experience' as const,
            copy: 'Para subir fotos de tu experiencia, necesitás un plan que las incluya.',
            pricing: '/es/planes/experiencias/precios/'
        }
    ])('$vertical without a plan: no-plan copy, pricing link, uploads disabled, photos listed (AC-6)', async ({
        vertical,
        copy,
        pricing
    }) => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ vertical, cap: 'none' }));
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(2)));
        mockListingListMedia.mockReturnValue(makeListOk(buildGalleryRows(2)));

        render(
            <PhotoSection
                locale="es"
                vertical={vertical}
                listingId="listing-1"
            />
        );

        await waitFor(() => expect(screen.getByText(copy)).toBeInTheDocument());
        expect(screen.queryByText('Cargando tu límite de fotos…')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', pricing);
        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeDisabled();
        expect(document.querySelector('#gallery-image-input')).toBeDisabled();
        expect(document.querySelector('#featured-image-input')).toBeDisabled();
        // Existing photos stay listed (and, at cap 0, are marked over cap).
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
        expect(screen.getAllByTestId('photo-over-cap-badge')).toHaveLength(2);
        expect(mockGetAllowance).toHaveBeenCalledWith({ vertical, id: 'listing-1' });
    });
});

describe('HOS-2495 — unlimited and breakdown states', () => {
    it('reads "Sin límite de fotos", prints no "máx. N" and never reports full (AC-16)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 'unlimited', used: 60 }));
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(60)));

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() => expect(screen.getByText('Sin límite de fotos')).toBeInTheDocument());
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(60));
        expect(screen.queryByText(/máx\. \d+\)/)).not.toBeInTheDocument();
        expect(screen.getByText('Galería de fotos')).toBeInTheDocument();
        expect(screen.queryByText(/Límite de galería alcanzado/)).not.toBeInTheDocument();
        expect(screen.queryByTestId('photo-over-cap-badge')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeEnabled();
        expect(document.querySelector('#gallery-image-input')).toHaveAttribute('multiple');
    });

    it('renders the breakdown that adds up to the cap (AC-5)', async () => {
        mockGetAllowance.mockImplementation(() =>
            allowanceOk({
                vertical: 'venue',
                cap: 50,
                breakdown: {
                    contributions: [
                        { kind: 'PLAN', value: 30, sources: 1 },
                        { kind: 'ADDON', value: 20, sources: 1 }
                    ]
                }
            })
        );

        render(
            <PhotoSection
                locale="es"
                vertical="venue"
                listingId="venue-1"
            />
        );

        await waitFor(() =>
            expect(screen.getByTestId('photo-cap-breakdown')).toHaveTextContent(
                '30 de tu plan + 20 de packs de fotos = 50'
            )
        );
        expect(screen.getByText('Galería de fotos (máx. 50)')).toBeInTheDocument();
    });

    it('shows the total alone when the API returned no breakdown (AC-5)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 15, breakdown: null }));

        render(<PhotoSection {...defaultProps} />);

        await waitFor(() =>
            expect(screen.getByText('Subí hasta 15 fotos de tu alojamiento.')).toBeInTheDocument()
        );
        expect(screen.queryByTestId('photo-cap-breakdown')).not.toBeInTheDocument();
    });

    it('names the trial as the only contribution (AC-8)', async () => {
        mockGetAllowance.mockImplementation(() =>
            allowanceOk({
                vertical: 'venue',
                cap: 15,
                breakdown: { contributions: [{ kind: 'TRIAL', value: 15, sources: 1 }] }
            })
        );

        render(
            <PhotoSection
                locale="es"
                vertical="venue"
                listingId="venue-1"
            />
        );

        await waitFor(() =>
            expect(screen.getByTestId('photo-cap-breakdown')).toHaveTextContent(
                '15 de tu prueba = 15'
            )
        );
    });
});

describe('HOS-1024 — the loading window shows no number and disables the upload control', () => {
    it('shows loading copy (no cap number) while entitlements resolve', async () => {
        mockGetAllowance.mockImplementation(() => new Promise(() => {}));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

        expect(screen.getByText('Cargando tu límite de fotos…')).toBeInTheDocument();
        expect(screen.getByText('Galería de fotos')).toBeInTheDocument();
        // Never a false number, and never the old flat default either.
        expect(screen.queryByText(/máx\. \d+\)/)).not.toBeInTheDocument();
    });

    it('disables the gallery add button and the hidden file input while loading', async () => {
        mockGetAllowance.mockImplementation(() => new Promise(() => {}));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeDisabled();
        expect(document.querySelector('#gallery-image-input')).toBeDisabled();
    });

    it('does NOT render the "gallery full" message during the loading window', async () => {
        // Regression for the naive `Math.max(cap - length, 0)` approach: with a
        // gallery that already has photos and no real cap yet, that formula
        // reads as "0 slots free" and would show "cap reached" even though the
        // real plan cap is unknown and may well have room.
        mockGetAllowance.mockImplementation(() => new Promise(() => {}));
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(5)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(5));

        expect(screen.queryByText(/Límite de galería alcanzado/)).not.toBeInTheDocument();
    });

    it('enables the control and shows the real number once the allowance resolves', async () => {
        let resolveAllowance: (value: unknown) => void = () => {};
        mockGetAllowance.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveAllowance = resolve;
                })
        );

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeDisabled();
        expect(screen.getByText('Cargando tu límite de fotos…').closest('p')).toHaveAttribute(
            'aria-busy',
            'true'
        );

        // The allowance answers — same component instance.
        resolveAllowance(await allowanceOk({ cap: 15 }));

        await waitFor(() => {
            expect(screen.getByText('Galería de fotos (máx. 15)')).toBeInTheDocument();
        });
        expect(
            screen.getByRole('button', { name: 'Agregar fotos a la galería' })
        ).not.toBeDisabled();
        expect(document.querySelector('#gallery-image-input')).not.toBeDisabled();
    });
});

describe('HOS-1024 — the selector never accepts more than the PLAN allows', () => {
    it("lets the owner's example through: 10 already uploaded, cap 15 → exactly 5 more accepted", async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(10)));
        mockUploadEntityImage
            .mockReturnValueOnce(makeUploadOk(1))
            .mockReturnValueOnce(makeUploadOk(2))
            .mockReturnValueOnce(makeUploadOk(3))
            .mockReturnValueOnce(makeUploadOk(4))
            .mockReturnValueOnce(makeUploadOk(5));
        mockAddMedia
            .mockReturnValueOnce(makeAddOk(1))
            .mockReturnValueOnce(makeAddOk(2))
            .mockReturnValueOnce(makeAddOk(3))
            .mockReturnValueOnce(makeAddOk(4))
            .mockReturnValueOnce(makeAddOk(5));

        render(
            <>
                <PhotoSection {...defaultProps} />
                <ToastViewport />
            </>
        );
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(10));

        const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
        // 5 remaining slots → the native picker stays in multi-file mode.
        expect(galleryInput).toHaveAttribute('multiple');

        const files = Array.from(
            { length: 5 },
            (_, i) => new File(['img'], `photo-${i}.jpg`, { type: 'image/jpeg' })
        );
        fireEvent.change(galleryInput, { target: { files } });

        await waitFor(() => expect(mockAddMedia).toHaveBeenCalledTimes(5));
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(15));
    });

    it('rejects a selection of 6 when only 5 plan slots remain — nothing uploads', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(10)));

        render(
            <>
                <PhotoSection {...defaultProps} />
                <ToastViewport />
            </>
        );
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(10));

        const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
        const files = Array.from(
            { length: 6 },
            (_, i) => new File(['img'], `over-${i}.jpg`, { type: 'image/jpeg' })
        );
        fireEvent.change(galleryInput, { target: { files } });

        await waitFor(() => {
            expect(screen.getAllByText(/Elegiste 6 fotos/).length).toBeGreaterThan(0);
        });
        expect(mockUploadEntityImage).not.toHaveBeenCalled();
        expect(mockAddMedia).not.toHaveBeenCalled();
        // Still exactly the 10 that were already there.
        expect(screen.getAllByRole('img')).toHaveLength(10);
    });

    it('switches the native picker to single-file mode one slot before the PLAN cap (14/15), even though the entity ceiling (50) is far away', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(14)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(14));

        const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
        expect(galleryInput).not.toHaveAttribute('multiple');
    });
});

describe('HOS-1024 — sober upsell when the gallery is full at the plan cap', () => {
    it('shows the cap-reached message plus a one-line plan upsell link', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(15)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(15));

        expect(screen.getByText('Límite de galería alcanzado (máx 15 fotos)')).toBeInTheDocument();

        const { t } = createTranslations('es');
        const upsellLabel = t('billing.limit.max_photos_per_accommodation.cta');
        const upsellLink = screen.getByRole('link', { name: upsellLabel });
        expect(upsellLink).toHaveAttribute('href', PLAN_HREF);
        expect(document.body.innerHTML).not.toContain('mi-cuenta/addons');

        // Sober: exactly one link in the cap-reached message, no second CTA,
        // no headline/banner copy beyond the existing cap-reached sentence.
        // HOS-2489: the message is a kit Alert, the link its action.
        const message = screen
            .getByText('Límite de galería alcanzado (máx 15 fotos)')
            .closest('[role="status"]');
        expect(message?.querySelectorAll('a')).toHaveLength(1);
    });

    it('hides the add (+) button once the plan cap is reached', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(15)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(15));

        expect(
            screen.queryByRole('button', { name: 'Agregar fotos a la galería' })
        ).not.toBeInTheDocument();
    });

    it('does NOT show the upsell (or cap-reached message) below the plan cap', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(10)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(10));

        expect(screen.queryByText(/Límite de galería alcanzado/)).not.toBeInTheDocument();
        const { t } = createTranslations('es');
        expect(
            screen.queryByRole('link', { name: t('account.subscription.usage.buyAddon') })
        ).not.toBeInTheDocument();
    });
});

describe('HOS-1721 — a pre-trial owner can fill the photos of their DRAFT', () => {
    const publishContext = {
        description: 'A real accommodation description with enough detail.',
        capacity: 2,
        minNights: 1,
        bedrooms: 1,
        bathrooms: 1,
        isDraft: true,
        trialDays: 30
    } as const;

    it('does not show the publish-ready prompt when a completed photo leaves the draft placeholder', async () => {
        mockListMedia.mockReturnValue(makeListOk());

        const props = {
            ...defaultProps,
            publishContext: { ...publishContext, description: DRAFT_DESCRIPTION_PLACEHOLDER }
        };
        const { rerender } = render(<PhotoSection {...props} />);
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /Agregar fotos/i })).toBeEnabled()
        );
        await mockListMedia.mock.results[0]?.value;

        mockFeaturedOverride.current = {
            id: 'featured-id',
            url: 'https://cdn.example.com/featured.jpg',
            publicId: 'featured',
            isFeatured: true
        };
        rerender(<PhotoSection {...props} />);

        await waitFor(() => expect(screen.getByAltText('Imagen principal')).toBeInTheDocument());
        await waitFor(() => expect(mockSubscribeDestination).not.toHaveBeenCalled());
        expect(screen.queryByText(/Tu ficha ya está lista/i)).not.toBeInTheDocument();
    });

    it('shows the pre-trial DRAFT cap the API answers and enables uploads (AC-9)', async () => {
        mockGetAllowance.mockImplementation(() =>
            allowanceOk({
                cap: 15,
                source: 'PRE_TRIAL_DRAFT',
                breakdown: { contributions: [{ kind: 'PRE_TRIAL_DRAFT', value: 15, sources: 1 }] }
            })
        );

        render(
            <PhotoSection
                {...defaultProps}
                publishContext={publishContext}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Galería de fotos (máx. 15)')).toBeInTheDocument();
        });
        expect(screen.getByTestId('photo-cap-breakdown')).toHaveTextContent(
            '15 para tu borrador antes de la prueba = 15'
        );
        expect(screen.queryByText('Cargando tu límite de fotos…')).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Agregar fotos a la galería' })
        ).not.toBeDisabled();
    });

    it('keeps uploads closed when the API answers NONE for a listing that is not a DRAFT (AC-9)', async () => {
        mockGetAllowance.mockImplementation(() => allowanceOk({ cap: 'none' }));

        render(
            <PhotoSection
                {...defaultProps}
                publishContext={{ ...publishContext, isDraft: false }}
            />
        );
        await waitFor(() => expect(screen.getByText(/necesitás un plan/)).toBeInTheDocument());

        expect(screen.queryByText('Galería de fotos (máx. 15)')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeDisabled();
    });
});
