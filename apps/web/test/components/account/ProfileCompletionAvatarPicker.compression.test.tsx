/**
 * @file ProfileCompletionAvatarPicker.compression.test.tsx
 * @description Wiring tests for client-side compression (HOS-332) inside the
 * profile-completion avatar picker. Mirrors
 * `test/components/host/editor/PhotoSection.compression.test.tsx`.
 *
 * `@/lib/media/compress-image` is mocked at the module boundary so these
 * tests exercise the DECISION logic in `ProfileCompletionAvatarPicker.tsx` —
 * without depending on jsdom having a real canvas/`createImageBitmap`.
 *
 * The critical, mandatory case (HOS-332 verification requirement): a file
 * that compression cannot process AND that fits under the cap must still
 * upload successfully, with no error surfaced.
 */

import { DEFAULT_AVATAR_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileCompletionAvatarPicker } from '../../../src/components/account/ProfileCompletionAvatarPicker';
import type { CompressionOutcome } from '../../../src/lib/media/compress-image';
import { tFromCatalog } from '../../helpers/i18n-catalog';

const { mockCompressImage } = vi.hoisted(() => ({ mockCompressImage: vi.fn() }));

vi.mock('../../../src/lib/media/compress-image', () => ({
    compressImageForUpload: mockCompressImage,
    isCompressionUnavailable: (outcome: CompressionOutcome) =>
        !outcome.wasCompressed &&
        (outcome.reason === 'decode-unsupported' || outcome.reason === 'encode-unsupported')
}));

const t = tFromCatalog;
const API_URL = 'http://api.test';
const CAP_BYTES = mbToBytes(DEFAULT_AVATAR_MAX_FILE_SIZE_MB);

function makeFile(bytes: number, type = 'image/heic', name = 'avatar.heic'): File {
    return new File([new Uint8Array(new ArrayBuffer(bytes))], name, { type });
}

function stubUploadOk() {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { url: 'https://cdn.example.com/a.jpg' } })
    }) as unknown as typeof fetch;
}

async function selectFile(file: File): Promise<void> {
    const input = document.querySelector('input#pc-avatar-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
}

describe('ProfileCompletionAvatarPicker client-side compression wiring (HOS-332)', () => {
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
        stubUploadOk();
        const onUploaded = vi.fn();
        const onError = vi.fn();

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={onUploaded}
                onError={onError}
            />
        );
        await selectFile(file);

        await waitFor(() => expect(onUploaded).toHaveBeenCalled());
        const uploadCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = uploadCall?.[1]?.body as FormData;
        expect(body.get('file')).toBe(file);
        expect(onError).not.toHaveBeenCalled();
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
        stubUploadOk();
        const onUploaded = vi.fn();

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={onUploaded}
            />
        );
        await selectFile(original);

        await waitFor(() => expect(onUploaded).toHaveBeenCalled());
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
        global.fetch = vi.fn() as unknown as typeof fetch;
        const onError = vi.fn();

        render(
            <ProfileCompletionAvatarPicker
                apiUrl={API_URL}
                disabled={false}
                t={t}
                onUploaded={() => {}}
                onError={onError}
            />
        );
        await selectFile(file);

        await waitFor(() => expect(onError).toHaveBeenCalled());
        expect(global.fetch).not.toHaveBeenCalled();
        const alert = screen.getByRole('alert');
        expect(alert.textContent?.toLowerCase()).toContain('optimizar');
        expect(alert.textContent).toContain(String(DEFAULT_AVATAR_MAX_FILE_SIZE_MB));
    });
});
