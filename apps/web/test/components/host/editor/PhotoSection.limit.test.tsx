/**
 * @file PhotoSection.limit.test.tsx
 * @description HOS-724 — an upload refused by the plan's photo cap surfaces the
 * photo-specific notice with both ways out, RENDERED, not just dispatched.
 *
 * ## Why this file exists next to `PhotoSection.test.tsx`
 *
 * That suite mocks `@/store/toast-store` away entirely and substitutes
 * `createTranslations` with a hand-rolled fallback map, so a toast asserted
 * there is a call object, never a rendered element, and every string is written
 * by the test itself. Both would hide exactly the regressions this change is
 * about: a CTA landing in the wrong slot, a URL that lost its `?focus=`, or
 * copy that silently degraded to the generic fallback.
 *
 * So here the toast store, the toast renderer, and the translator are all REAL,
 * and `ToastViewport` is mounted alongside the section — the assertions read the
 * DOM the host would actually see. Only the network edges are mocked.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ServiceErrorCode } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import { ToastViewport } from '@/components/ui/ToastViewport.client';
import { createTranslations } from '@/lib/i18n';
import { clearToasts } from '@/store/toast-store';

const { mockListMedia, mockAddMedia, mockUploadEntityImage } = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockAddMedia: vi.fn(),
    mockUploadEntityImage: vi.fn()
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
    protectedMediaApi: { deleteMedia: vi.fn() }
}));

vi.mock('@/lib/media/upload-entity', () => ({
    uploadEntityImage: mockUploadEntityImage
}));

const ACC_ID = 'acc-uuid-123';

const defaultProps: PhotoSectionProps = { locale: 'es', accommodationId: ACC_ID };

/** The whole URL, both halves — `toContain('addons')` survives losing `?focus=`. */
const ADDON_HREF = '/es/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20';
const PLAN_HREF = '/es/mi-cuenta/suscripcion/';

/** The exact 403 body the API sends when the plan photo cap is full. */
function makeLimitReached() {
    return Promise.resolve({
        ok: false as const,
        error: {
            status: 403,
            code: 'LIMIT_REACHED',
            // The API's own hardcoded Spanish sentence. It must NOT be what the
            // host ends up reading.
            message: 'Has alcanzado el límite de 15 fotos por alojamiento. Actualiza tu plan.',
            details: {
                limitKey: 'max_photos_per_accommodation',
                currentCount: 15,
                maxAllowed: 15,
                usagePercent: 100,
                upgradeAudience: 'host'
            }
        }
    });
}

/** Any other upload failure: a 500 with no limit semantics at all. */
function makePlainFailure() {
    return Promise.resolve({
        ok: false as const,
        error: { status: 500, code: 'INTERNAL_ERROR', message: 'Server exploded' }
    });
}

async function uploadOneGalleryPhoto() {
    render(
        <>
            <PhotoSection {...defaultProps} />
            <ToastViewport />
        </>
    );
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

    const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });
}

describe('HOS-724 — photo upload refused by the plan cap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearToasts();
        mockListMedia.mockReturnValue(Promise.resolve({ ok: true, data: { media: [] } }));
        mockUploadEntityImage.mockReturnValue(
            Promise.resolve({
                url: 'https://cdn.example.com/new.jpg',
                publicId: 'hospeda/accommodations/abc/new',
                width: 800,
                height: 600
            })
        );
    });

    afterEach(() => {
        clearToasts();
    });

    it('renders the photo-specific copy instead of the raw API sentence', async () => {
        mockAddMedia.mockReturnValue(makeLimitReached());
        await uploadOneGalleryPhoto();

        const { t } = createTranslations('es');
        const expected = t('billing.limit.max_photos_per_accommodation.title');

        // Sanity: the key really is in the locale file. Without this the
        // assertion below could pass with both sides resolving to the same
        // "[MISSING: ...]" placeholder.
        expect(expected).not.toContain('MISSING');
        expect(expected).not.toBe('Límite del plan alcanzado'); // the generic title

        // Rendered, in the DOM — not merely dispatched to the store.
        await waitFor(() => {
            expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
        });
        // The API's own Spanish sentence must not be what the host reads.
        expect(screen.queryByText(/Actualiza tu plan\.$/)).not.toBeInTheDocument();
    });

    it('resolves the same photo-specific title in en and pt', () => {
        for (const locale of ['en', 'pt'] as const) {
            const title = createTranslations(locale).t(
                'billing.limit.max_photos_per_accommodation.title'
            );
            expect(title).not.toContain('MISSING');
            expect(title).not.toBe(createTranslations(locale).t('billing.limit.generic.title'));
        }
    });

    it("pins the hook's 'LIMIT_REACHED' literal against the enum it stands for", () => {
        // The island cannot import `@repo/billing` (its barrel pulls
        // `@repo/logger`, which reads the process environment at module scope
        // and kills hydration), so `use-photo-section.ts` matches the code as a
        // string. A test runs in node and CAN import the enum — so the literal
        // is checked against its source here rather than left to drift.
        const source = readFileSync(
            resolve(__dirname, '../../../../src/components/host/editor/use-photo-section.ts'),
            'utf8'
        );

        expect(ServiceErrorCode.LIMIT_REACHED).toBe('LIMIT_REACHED');
        expect(source).toContain(`error.code === '${ServiceErrorCode.LIMIT_REACHED}'`);
        // ...and the status it is paired with, which is the other half.
        expect(source).toContain('error.status === 403');
    });

    it('offers the add-on in the PRIMARY slot and the plan in the SECONDARY slot', async () => {
        mockAddMedia.mockReturnValue(makeLimitReached());
        await uploadOneGalleryPhoto();

        const { t } = createTranslations('es');
        const addonLabel = t('account.subscription.usage.buyAddon');
        const planLabel = t('billing.limit.max_photos_per_accommodation.cta');

        const addonLink = await screen.findByRole('link', { name: addonLabel });
        const planLink = screen.getByRole('link', { name: planLabel });

        // Whole URLs, so losing `?focus=` or the fragment fails here.
        expect(addonLink).toHaveAttribute('href', ADDON_HREF);
        expect(planLink).toHaveAttribute('href', PLAN_HREF);

        // Naming the slot is the assertion: both links existing says nothing
        // about which one leads. `ToastViewport` renders the primary action with
        // `actionPrimary` and the secondary with `actionSecondary` (vitest is
        // configured with non-scoped CSS-module class names).
        expect(addonLink.className).toContain('actionPrimary');
        expect(addonLink.className).not.toContain('actionSecondary');
        expect(planLink.className).toContain('actionSecondary');
        expect(planLink.className).not.toContain('actionPrimary');
    });

    it('does not add the photo to the gallery', async () => {
        mockAddMedia.mockReturnValue(makeLimitReached());
        await uploadOneGalleryPhoto();

        await screen.findByRole('link', {
            name: createTranslations('es').t('account.subscription.usage.buyAddon')
        });
        expect(screen.queryAllByRole('img')).toHaveLength(0);
    });

    it('stops the batch at the cap instead of firing one toast per remaining file', async () => {
        mockAddMedia.mockReturnValue(makeLimitReached());

        render(
            <>
                <PhotoSection {...defaultProps} />
                <ToastViewport />
            </>
        );
        await waitFor(() => expect(mockListMedia).toHaveBeenCalled());

        const galleryInput = document.querySelector('#gallery-image-input') as HTMLInputElement;
        const files = [1, 2, 3].map(
            (n) => new File(['img'], `photo-${n}.jpg`, { type: 'image/jpeg' })
        );
        fireEvent.change(galleryInput, { target: { files } });

        await waitFor(() => expect(mockAddMedia).toHaveBeenCalledTimes(1));
        expect(
            await screen.findAllByRole('link', {
                name: createTranslations('es').t('account.subscription.usage.buyAddon')
            })
        ).toHaveLength(1);
    });
});

describe('HOS-724 — an upload failure that is NOT the cap', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearToasts();
        mockListMedia.mockReturnValue(Promise.resolve({ ok: true, data: { media: [] } }));
        mockUploadEntityImage.mockReturnValue(
            Promise.resolve({
                url: 'https://cdn.example.com/new.jpg',
                publicId: 'hospeda/accommodations/abc/new',
                width: 800,
                height: 600
            })
        );
    });

    afterEach(() => {
        clearToasts();
    });

    it('shows the plain error and offers NOTHING to buy', async () => {
        mockAddMedia.mockReturnValue(makePlainFailure());
        await uploadOneGalleryPhoto();

        await waitFor(() => {
            expect(screen.getAllByText('Server exploded').length).toBeGreaterThan(0);
        });

        // No CTA of any kind: an add-on offer bolted onto a 500 would be a
        // misdiagnosis, and a plan-upgrade link would be one too.
        expect(screen.queryAllByRole('link')).toHaveLength(0);
        expect(document.body.innerHTML).not.toContain('extra-photos-20');
        expect(document.body.innerHTML).not.toContain('mi-cuenta/addons');
    });
});
