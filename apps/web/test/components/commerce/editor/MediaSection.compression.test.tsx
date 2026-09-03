/**
 * @file MediaSection.compression.test.tsx
 * @description Wiring tests for client-side compression (HOS-332) inside the
 * commerce owner media editor. Mirrors
 * `test/components/host/editor/PhotoSection.compression.test.tsx`.
 *
 * `@/lib/media/compress-image` is mocked at the module boundary so these
 * tests exercise the DECISION logic in `MediaSection.client.tsx` — without
 * depending on jsdom having a real canvas/`createImageBitmap`.
 *
 * The critical, mandatory case (HOS-332 verification requirement): a file
 * that compression cannot process AND that fits under the cap must still
 * upload successfully, with no error surfaced.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaSectionProps } from '../../../../src/components/commerce/editor/MediaSection.client';
import { MediaSection } from '../../../../src/components/commerce/editor/MediaSection.client';
import type { CompressionOutcome } from '../../../../src/lib/media/compress-image';

const { mockListMedia, mockAddMedia, mockSetFeaturedMedia, mockAddToast, mockCompressImage } =
    vi.hoisted(() => ({
        mockListMedia: vi.fn(),
        mockAddMedia: vi.fn(),
        mockSetFeaturedMedia: vi.fn(),
        mockAddToast: vi.fn(),
        mockCompressImage: vi.fn()
    }));

vi.mock('../../../../src/lib/env', () => ({
    getApiUrl: () => 'http://api.test'
}));

vi.mock('../../../../src/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    commerceMediaApi: {
        listMedia: mockListMedia,
        addMedia: mockAddMedia,
        removeMedia: vi.fn(),
        setFeaturedMedia: mockSetFeaturedMedia
    },
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true }) }
}));

vi.mock('../../../../src/store/toast-store', () => ({
    addToast: mockAddToast
}));

vi.mock('../../../../src/lib/media/compress-image', () => ({
    compressImageForUpload: mockCompressImage,
    isCompressionUnavailable: (outcome: CompressionOutcome) =>
        !outcome.wasCompressed &&
        (outcome.reason === 'decode-unsupported' || outcome.reason === 'encode-unsupported')
}));

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string | number>): string => {
            const raw = fallback ?? key;
            return params
                ? Object.entries(params).reduce(
                      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                      raw
                  )
                : raw;
        },
        tPlural: (key: string, count: number, params?: Record<string, string | number>): string => {
            const raw = `${key}_${count}`;
            return params
                ? Object.entries(params).reduce(
                      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                      raw
                  )
                : raw;
        }
    })
}));

const LISTING_ID = '00000000-0000-4000-8000-0000000000aa';
const CAP_BYTES = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB);

const defaultProps: MediaSectionProps = {
    locale: 'es',
    vertical: 'gastronomy',
    listingId: LISTING_ID
};

const fileOfBytes = (bytes: number, name = 'photo.heic', type = 'image/heic'): File =>
    new File([new Uint8Array(new ArrayBuffer(bytes))], name, { type });

const makeListEmpty = () => Promise.resolve({ ok: true as const, data: { media: [] } });
const NEW_ROW = {
    id: 'row-1',
    url: 'https://cdn.example.com/x.jpg',
    publicId: 'pub-1',
    isFeatured: false,
    sortOrder: 0,
    state: 'visible' as const,
    moderationState: 'APPROVED'
};
const makeAddOk = () => Promise.resolve({ ok: true as const, data: { media: NEW_ROW } });
const makeSetFeaturedOk = () =>
    Promise.resolve({ ok: true as const, data: { media: { ...NEW_ROW, isFeatured: true } } });

function stubFetchUploadOk() {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            success: true,
            data: {
                url: 'https://cdn.example.com/x.jpg',
                publicId: 'pub-1',
                width: 800,
                height: 600
            }
        })
    } as Response);
}

async function selectFeaturedFile(file: File): Promise<void> {
    render(<MediaSection {...defaultProps} />);
    await waitFor(() => expect(mockListMedia).toHaveBeenCalled());
    const input = screen.getByLabelText('Imagen principal', {
        selector: 'input'
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
}

describe('MediaSection client-side compression wiring (HOS-332)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListMedia.mockReturnValue(makeListEmpty());
    });

    it('MANDATORY: uploads the original file successfully when compression cannot decode it, as long as it fits under the cap', async () => {
        const file = fileOfBytes(CAP_BYTES - mbToBytes(2));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        stubFetchUploadOk();
        mockAddMedia.mockReturnValue(makeAddOk());
        mockSetFeaturedMedia.mockReturnValue(makeSetFeaturedOk());

        await selectFeaturedFile(file);

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const body = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
            ?.body as FormData;
        expect(body.get('file')).toBe(file);
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
        stubFetchUploadOk();
        mockAddMedia.mockReturnValue(makeAddOk());
        mockSetFeaturedMedia.mockReturnValue(makeSetFeaturedOk());

        await selectFeaturedFile(original);

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const body = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
            ?.body as FormData;
        expect(body.get('file')).toBe(compressed);
    });

    it('shows the actionable "could not optimize" message when compression fails AND the file exceeds the cap', async () => {
        const file = fileOfBytes(CAP_BYTES + mbToBytes(1));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        global.fetch = vi.fn();

        await selectFeaturedFile(file);

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(global.fetch).not.toHaveBeenCalled();
        const message = mockAddToast.mock.calls[0]?.[0]?.message as string;
        expect(message.toLowerCase()).toContain('optimizar');
        expect(message).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
    });

    it('shows the "optimizing image" indicator while compression is in flight', async () => {
        let resolveCompression!: (outcome: unknown) => void;
        mockCompressImage.mockReturnValue(
            new Promise((resolve) => {
                resolveCompression = resolve;
            })
        );
        const file = fileOfBytes(CAP_BYTES - mbToBytes(1));

        await selectFeaturedFile(file);

        await waitFor(() => expect(screen.getByText('Optimizando imagen…')).toBeInTheDocument());

        stubFetchUploadOk();
        mockAddMedia.mockReturnValue(makeAddOk());
        mockSetFeaturedMedia.mockReturnValue(makeSetFeaturedOk());
        resolveCompression({ file, wasCompressed: false, reason: 'decode-unsupported' });

        await waitFor(() =>
            expect(screen.queryByText('Optimizando imagen…')).not.toBeInTheDocument()
        );
    });
});
