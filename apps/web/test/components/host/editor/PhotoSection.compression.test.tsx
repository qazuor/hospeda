/**
 * @file PhotoSection.compression.test.tsx
 * @description Wiring tests for client-side compression (HOS-332) inside the
 * accommodation photo editor.
 *
 * `@/lib/media/compress-image` is mocked at the module boundary so these
 * tests exercise the DECISION logic in `use-photo-section.ts` — what happens
 * to an upload when compression succeeds, when it is unavailable (e.g. HEIC
 * on Chrome), and when the file is still too large afterwards — without
 * depending on jsdom having a real canvas/`createImageBitmap`.
 *
 * The critical, mandatory case (HOS-332 verification requirement): a file
 * that compression cannot process AND that fits under the cap must still
 * upload successfully, with no error surfaced.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoSectionProps } from '@/components/host/editor/PhotoSection.client';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';
import type { CompressionOutcome } from '@/lib/media/compress-image';

const { mockListMedia, mockAddMedia, mockUploadEntityImage, mockAddToast, mockCompressImage } =
    vi.hoisted(() => ({
        mockListMedia: vi.fn(),
        mockAddMedia: vi.fn(),
        mockUploadEntityImage: vi.fn(),
        mockAddToast: vi.fn(),
        mockCompressImage: vi.fn()
    }));

vi.mock('@/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/i18n')>()),
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (key: string, count: number, _params?: Record<string, unknown>) =>
            `${key}_${count === 1 ? 'one' : 'other'}`
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
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
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true }) }
}));

vi.mock('@/lib/media/upload-entity', () => ({
    uploadEntityImage: mockUploadEntityImage,
    resolveUploadTimeoutMs: () => 40_000
}));

vi.mock('@/lib/media/compress-image', () => ({
    compressImageForUpload: mockCompressImage,
    isCompressionUnavailable: (outcome: CompressionOutcome) =>
        !outcome.wasCompressed &&
        (outcome.reason === 'decode-unsupported' || outcome.reason === 'encode-unsupported')
}));

vi.mock('@/store/toast-store', () => ({
    addToast: mockAddToast
}));

vi.mock('@repo/schemas', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/schemas')>()),
    ENTITY_GALLERY_CAPS: { accommodation: 50 }
}));

const ACC_ID = 'acc-uuid-332';
const CAP_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

const defaultProps: PhotoSectionProps = { locale: 'es', accommodationId: ACC_ID };

const fileOfBytes = (bytes: number, name = 'photo.heic', type = 'image/heic'): File =>
    new File([new Uint8Array(new ArrayBuffer(bytes))], name, { type });

const makeListEmpty = () => Promise.resolve({ ok: true as const, data: { media: [] } });
const makeUploadOk = () =>
    Promise.resolve({
        url: 'https://cdn.example.com/x.jpg',
        publicId: 'pub-1',
        width: 800,
        height: 600
    });
const makeAddOk = () =>
    Promise.resolve({
        ok: true as const,
        data: {
            media: {
                id: 'row-1',
                url: 'https://cdn.example.com/x.jpg',
                publicId: 'pub-1',
                isFeatured: false,
                sortOrder: 0,
                state: 'visible' as const,
                moderationState: 'APPROVED'
            }
        }
    });

async function selectGalleryFile(file: File): Promise<void> {
    render(<PhotoSection {...defaultProps} />);
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
    const input = document.querySelector('#gallery-image-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
}

describe('PhotoSection client-side compression wiring (HOS-332)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListMedia.mockReturnValue(makeListEmpty());
    });

    it('MANDATORY: uploads the original file successfully when compression cannot decode it, as long as it fits under the cap', async () => {
        // The canonical case: a HEIC photo Chrome cannot decode, well under
        // the 10 MB provider cap. Compression fails to process it; the
        // upload must still succeed, with no error surfaced.
        const file = fileOfBytes(CAP_BYTES - mbToBytes(2));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        mockUploadEntityImage.mockReturnValue(makeUploadOk());
        mockAddMedia.mockReturnValue(makeAddOk());

        await selectGalleryFile(file);

        await waitFor(() => expect(mockUploadEntityImage).toHaveBeenCalled());
        expect(mockUploadEntityImage).toHaveBeenCalledWith(expect.objectContaining({ file }));
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('uploads the COMPRESSED file (not the original) when compression succeeds', async () => {
        const original = fileOfBytes(CAP_BYTES - mbToBytes(1), 'photo.jpg', 'image/jpeg');
        const compressed = new File(['small'], 'photo.jpg', { type: 'image/jpeg' });
        mockCompressImage.mockResolvedValue({
            file: compressed,
            wasCompressed: true,
            originalBytes: original.size,
            compressedBytes: compressed.size
        });
        mockUploadEntityImage.mockReturnValue(makeUploadOk());
        mockAddMedia.mockReturnValue(makeAddOk());

        await selectGalleryFile(original);

        await waitFor(() => expect(mockUploadEntityImage).toHaveBeenCalled());
        expect(mockUploadEntityImage).toHaveBeenCalledWith(
            expect.objectContaining({ file: compressed })
        );
    });

    it('shows the actionable "could not optimize" message when compression fails AND the file exceeds the cap — never a bare upload attempt', async () => {
        const file = fileOfBytes(CAP_BYTES + mbToBytes(1));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });

        await selectGalleryFile(file);

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(mockUploadEntityImage).not.toHaveBeenCalled();
        const message = mockAddToast.mock.calls[0]?.[0]?.message as string;
        // Distinct from the generic "file too large" copy: it must mention
        // that automatic optimization was the thing that failed.
        expect(message.toLowerCase()).toContain('optimizar');
        expect(message).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
    });

    it('shows the generic too-large message (not the compression-specific one) when the file is simply too large and was never a compression candidate', async () => {
        const file = fileOfBytes(CAP_BYTES + mbToBytes(1));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'no-size-gain'
        });

        await selectGalleryFile(file);

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        const message = mockAddToast.mock.calls[0]?.[0]?.message as string;
        expect(message.toLowerCase()).not.toContain('optimizar');
    });

    it('shows the "optimizing image" indicator while compression is in flight', async () => {
        let resolveCompression!: (outcome: unknown) => void;
        mockCompressImage.mockReturnValue(
            new Promise((resolve) => {
                resolveCompression = resolve;
            })
        );
        const file = fileOfBytes(CAP_BYTES - mbToBytes(1));

        await selectGalleryFile(file);

        await waitFor(() => expect(screen.getByText('Optimizando imagen…')).toBeInTheDocument());

        resolveCompression({ file, wasCompressed: false, reason: 'decode-unsupported' });
        mockUploadEntityImage.mockReturnValue(makeUploadOk());
        mockAddMedia.mockReturnValue(makeAddOk());

        await waitFor(() =>
            expect(screen.queryByText('Optimizando imagen…')).not.toBeInTheDocument()
        );
    });
});
