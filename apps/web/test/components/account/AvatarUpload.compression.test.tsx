/**
 * @file AvatarUpload.compression.test.tsx
 * @description Wiring tests for client-side compression (HOS-332) inside the
 * avatar upload island. Mirrors
 * `test/components/host/editor/PhotoSection.compression.test.tsx`.
 *
 * `@/lib/media/compress-image` is mocked at the module boundary so these
 * tests exercise the DECISION logic in `AvatarUpload.client.tsx` — without
 * depending on jsdom having a real canvas/`createImageBitmap`.
 *
 * The critical, mandatory case (HOS-332 verification requirement): a file
 * that compression cannot process AND that fits under the cap must still
 * upload successfully, with no error surfaced.
 */

import { DEFAULT_AVATAR_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarUpload } from '../../../src/components/account/AvatarUpload.client';
import type { CompressionOutcome } from '../../../src/lib/media/compress-image';

if (typeof URL.createObjectURL === 'undefined') {
    URL.createObjectURL = vi.fn(() => 'blob:mock-object-url');
}
if (typeof URL.revokeObjectURL === 'undefined') {
    URL.revokeObjectURL = vi.fn();
}

const { mockCompressImage } = vi.hoisted(() => ({ mockCompressImage: vi.fn() }));

vi.mock('../../../src/components/account/AvatarUpload.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, string | number>): string => {
            const raw = fallback ?? key;
            return params
                ? Object.entries(params).reduce(
                      (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
                      raw
                  )
                : raw;
        }
    })
}));

vi.mock('@repo/icons', () => ({
    ImageIcon: () => null,
    UploadIcon: () => null
}));

vi.mock('@repo/media', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/media')>()),
    getMediaUrl: (url: string) => url
}));

vi.mock('../../../src/lib/avatar-utils', () => ({
    getInitials: () => 'TU'
}));

vi.mock('../../../src/lib/media/compress-image', () => ({
    compressImageForUpload: mockCompressImage,
    isCompressionUnavailable: (outcome: CompressionOutcome) =>
        !outcome.wasCompressed &&
        (outcome.reason === 'decode-unsupported' || outcome.reason === 'encode-unsupported')
}));

const DEFAULT_PROPS = {
    userId: 'user-123',
    apiUrl: 'http://api.test',
    locale: 'es' as const
} as const;

const CAP_BYTES = mbToBytes(DEFAULT_AVATAR_MAX_FILE_SIZE_MB);

function makeFile(bytes: number, type = 'image/heic', name = 'avatar.heic'): File {
    return new File([new Uint8Array(new ArrayBuffer(bytes))], name, { type });
}

async function triggerFileChange(file: File): Promise<void> {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
}

function stubUploadAndPatchOk() {
    global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { url: 'https://cdn.example.com/a.jpg' } })
        })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: {} })
        });
}

describe('AvatarUpload client-side compression wiring (HOS-332)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('MANDATORY: uploads the original file successfully when compression cannot decode it, as long as it fits under the cap', async () => {
        const file = makeFile(CAP_BYTES - mbToBytes(1));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        stubUploadAndPatchOk();

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(file);

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const uploadCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = uploadCall?.[1]?.body as FormData;
        expect(body.get('file')).toBe(file);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('uploads the COMPRESSED file (not the original) when compression succeeds', async () => {
        const original = makeFile(CAP_BYTES - mbToBytes(1), 'image/jpeg', 'avatar.jpg');
        const compressed = new File(['small'], 'avatar.jpg', { type: 'image/jpeg' });
        mockCompressImage.mockResolvedValue({
            file: compressed,
            wasCompressed: true,
            originalBytes: original.size,
            compressedBytes: compressed.size
        });
        stubUploadAndPatchOk();

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(original);

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const uploadCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = uploadCall?.[1]?.body as FormData;
        expect(body.get('file')).toBe(compressed);
    });

    it('shows the actionable "could not optimize" message when compression fails AND the file exceeds the cap', async () => {
        const file = makeFile(CAP_BYTES + mbToBytes(1));
        mockCompressImage.mockResolvedValue({
            file,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        global.fetch = vi.fn();

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(file);

        await waitFor(() => {
            const alert = screen.getByRole('alert');
            expect(alert.textContent?.toLowerCase()).toContain('optimizar');
            expect(alert.textContent).toContain(String(DEFAULT_AVATAR_MAX_FILE_SIZE_MB));
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('shows the "optimizing" state on the change button while compression is in flight', async () => {
        let resolveCompression!: (outcome: unknown) => void;
        mockCompressImage.mockReturnValue(
            new Promise((resolve) => {
                resolveCompression = resolve;
            })
        );
        const file = makeFile(CAP_BYTES - mbToBytes(1));

        render(<AvatarUpload {...DEFAULT_PROPS} />);
        await triggerFileChange(file);

        await waitFor(() => expect(screen.getByText('Optimizando…')).toBeInTheDocument());

        stubUploadAndPatchOk();
        resolveCompression({ file, wasCompressed: false, reason: 'decode-unsupported' });

        await waitFor(() => expect(screen.queryByText('Optimizando…')).not.toBeInTheDocument());
    });
});
