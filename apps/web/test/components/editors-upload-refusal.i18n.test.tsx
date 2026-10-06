/**
 * @file editors-upload-refusal.i18n.test.tsx
 * @description HOS-1218 — the content (post/event) and listing media editors
 * render an `upload-entity` refusal in the user's language, with the real
 * limit, and never the API's English message.
 *
 * Toast store, toast renderer and translator are REAL; only the network edges
 * (`fetch` for the upload, the media endpoints) are stubbed.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentMediaSection } from '@/components/account/editor/ContentMediaSection.client';
import { MediaSection } from '@/components/listing/editor/MediaSection.client';
import { ToastViewport } from '@/components/ui/ToastViewport.client';
import { clearToasts } from '@/store/toast-store';

const { mockListMedia } = vi.hoisted(() => ({ mockListMedia: vi.fn() }));

vi.mock('@/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    contentMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    listingMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    gastronomyMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    experienceMediaApi: {
        listMedia: mockListMedia,
        addMedia: vi.fn(),
        removeMedia: vi.fn(),
        setFeaturedMedia: vi.fn()
    },
    protectedMediaApi: { deleteMedia: vi.fn() }
}));

const ENGLISH = 'Gallery limit of 15 items reached for this entity';
const EXPECTED_ES = 'Llegaste al límite de 15 fotos de la galería.';

function refuseUpload(): void {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({
                success: false,
                error: {
                    code: 'GALLERY_LIMIT_EXCEEDED',
                    message: ENGLISH,
                    details: { entityType: 'post', currentCount: 15, limit: 15 }
                }
            })
        } as Response)
    );
}

async function pickGalleryFile(): Promise<void> {
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
    const gallery = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    fireEvent.change(gallery, {
        target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] }
    });
}

describe('HOS-1218 — editor upload refusals are localized', () => {
    beforeEach(() => {
        clearToasts();
        mockListMedia.mockReset();
        mockListMedia.mockResolvedValue({ ok: true, data: { media: [] } });
        refuseUpload();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearToasts();
    });

    it('content editor: renders the Spanish limit sentence, not the English message', async () => {
        render(
            <>
                <ContentMediaSection
                    locale="es"
                    entity="post"
                    entityId="00000000-0000-4000-8000-0000000000aa"
                />
                <ToastViewport />
            </>
        );

        await pickGalleryFile();

        await waitFor(() => {
            expect(screen.getAllByText(EXPECTED_ES).length).toBeGreaterThan(0);
        });
        expect(screen.queryByText(ENGLISH)).not.toBeInTheDocument();
    });

    it('listing editor: renders the Spanish limit sentence, not the English message', async () => {
        render(
            <>
                <MediaSection
                    locale="es"
                    vertical="gastronomy"
                    listingId="00000000-0000-4000-8000-0000000000bb"
                />
                <ToastViewport />
            </>
        );

        await pickGalleryFile();

        await waitFor(() => {
            expect(screen.getAllByText(EXPECTED_ES).length).toBeGreaterThan(0);
        });
        expect(screen.queryByText(ENGLISH)).not.toBeInTheDocument();
    });
});
