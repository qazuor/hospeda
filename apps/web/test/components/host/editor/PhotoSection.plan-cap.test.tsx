/**
 * @file PhotoSection.plan-cap.test.tsx
 * @description HOS-1024 — the photo gallery cap shown and enforced in the
 * editor is the host's EFFECTIVE PLAN cap (`useMyEntitlements().limit(
 * 'max_photos_per_accommodation')`), not the flat `ENTITY_GALLERY_CAPS
 * .accommodation` ceiling (50) every host used to see regardless of plan.
 *
 * Real i18n and a real toast store/viewport are used throughout (not a
 * hand-rolled translation stub) — the assertions below read the actual copy
 * and the actual upsell CTA the host would see, mirroring
 * `PhotoSection.limit.test.tsx`'s rationale for the same choice.
 *
 * `useMyEntitlements` is mocked directly (not `useSession`/`fetch`) — the
 * same convention `CalendarSyncLauncher.test.tsx` and
 * `PlanEntitlementGate.client.test.tsx` use — so each test controls
 * `limit()`/`isLoading` deterministically without touching the network.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import { ToastViewport } from '@/components/ui/ToastViewport.client';
import { createTranslations } from '@/lib/i18n';
import { clearToasts } from '@/store/toast-store';

const { mockListMedia, mockAddMedia, mockUploadEntityImage, mockLimit, mockIsLoading } = vi.hoisted(
    () => ({
        mockListMedia: vi.fn(),
        mockAddMedia: vi.fn(),
        mockUploadEntityImage: vi.fn(),
        mockLimit: vi.fn(),
        mockIsLoading: vi.fn()
    })
);

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: mockAddMedia,
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn(),
        reorderMedia: vi.fn(),
        updateMedia: vi.fn()
    },
    protectedMediaApi: { deleteMedia: vi.fn() }
}));

vi.mock('@/lib/media/upload-entity', () => ({
    uploadEntityImage: mockUploadEntityImage
}));

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: () => false,
        limit: mockLimit,
        plan: null,
        isLoading: mockIsLoading(),
        error: null
    })
}));

const ACC_ID = 'acc-uuid-plan-cap';
const defaultProps: PhotoSectionProps = { locale: 'es', accommodationId: ACC_ID };

/** The exact href `resolveLimitAddonOffer` resolves for the photos add-on. */
const ADDON_HREF = '/es/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20';

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
    clearToasts();
    mockListMedia.mockReturnValue(makeListOk());
    mockIsLoading.mockReturnValue(false);
    mockLimit.mockReturnValue(15); // Owner Básico
});

afterEach(() => {
    clearToasts();
});

describe('HOS-1024 — header + gallery label show the PLAN cap, not the entity ceiling', () => {
    it('states the plan cap (15) in the section description, never the entity ceiling (50)', async () => {
        render(<PhotoSection {...defaultProps} />);

        const { tPlural } = createTranslations('es');
        const expected = tPlural('host.properties.editor.section.photosDescription', 15, {
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
        mockLimit.mockReturnValue(30);
        render(<PhotoSection {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Galería de fotos (máx. 30)')).toBeInTheDocument();
        });
    });
});

describe('HOS-1024 — the loading window shows no number and disables the upload control', () => {
    it('shows loading copy (no cap number) while entitlements resolve', async () => {
        mockIsLoading.mockReturnValue(true);
        mockLimit.mockReturnValue(-1); // the hook's own loading sentinel

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

        expect(screen.getByText('Cargando tu límite de fotos…')).toBeInTheDocument();
        expect(screen.getByText('Galería de fotos')).toBeInTheDocument();
        // Never a false number, and never the old flat default either.
        expect(screen.queryByText(/máx\. \d+\)/)).not.toBeInTheDocument();
    });

    it('disables the gallery add button and the hidden file input while loading', async () => {
        mockIsLoading.mockReturnValue(true);
        mockLimit.mockReturnValue(-1);

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
        mockIsLoading.mockReturnValue(true);
        mockLimit.mockReturnValue(-1);
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(5)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(5));

        expect(screen.queryByText(/Límite de galería alcanzado/)).not.toBeInTheDocument();
    });

    it('enables the control and shows the real number once entitlements resolve', async () => {
        mockIsLoading.mockReturnValue(true);
        mockLimit.mockReturnValue(-1);

        const { rerender } = render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: 'Agregar fotos a la galería' })).toBeDisabled();

        // The plan resolves — same component instance, hook now answers real values.
        mockIsLoading.mockReturnValue(false);
        mockLimit.mockReturnValue(15);
        rerender(<PhotoSection {...defaultProps} />);

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
    it('shows the cap-reached message plus a one-line add-on upsell link', async () => {
        mockListMedia.mockReturnValue(makeListOk(buildGalleryRows(15)));

        render(<PhotoSection {...defaultProps} />);
        await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(15));

        expect(screen.getByText('Límite de galería alcanzado (máx 15 fotos)')).toBeInTheDocument();

        const { t } = createTranslations('es');
        const upsellLabel = t('account.subscription.usage.buyAddon');
        const upsellLink = screen.getByRole('link', { name: upsellLabel });
        expect(upsellLink).toHaveAttribute('href', ADDON_HREF);

        // Sober: exactly one link in the cap-reached message, no second CTA,
        // no headline/banner copy beyond the existing cap-reached sentence.
        const message = screen.getByText(
            (_, el) => el?.textContent?.startsWith('Límite de galería alcanzado') ?? false
        );
        expect(message.querySelectorAll('a')).toHaveLength(1);
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
