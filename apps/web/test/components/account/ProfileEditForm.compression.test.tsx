/**
 * @file ProfileEditForm.compression.test.tsx
 * @description Wiring tests for client-side avatar compression (HOS-1936)
 * inside the REAL `ProfileEditForm` (the island mounted at
 * `/mi-cuenta/editar/`), not the dead-code `AvatarUpload`.
 *
 * `@/lib/media/compress-image` is mocked at the module boundary so these
 * tests exercise the decision logic in the form (compress BEFORE the size
 * cap, upload the compressed file, type and size limits).
 */

import { DEFAULT_AVATAR_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ProfileEditForm } from '../../../src/components/account/ProfileEditForm.client';
import type { CompressionOutcome } from '../../../src/lib/media/compress-image';
import { addToast } from '../../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const { mockCompressImage } = vi.hoisted(() => ({ mockCompressImage: vi.fn() }));

vi.mock('../../../src/lib/media/compress-image', () => ({
    compressImageForUpload: mockCompressImage,
    isCompressionUnavailable: (outcome: CompressionOutcome) =>
        !outcome.wasCompressed &&
        (outcome.reason === 'decode-unsupported' || outcome.reason === 'encode-unsupported')
}));

vi.mock('../../../src/components/account/ProfileEditForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Resolves against the real `es` catalog and still interpolates `{{param}}`,
// which is what stops a size message shipping with a raw `{{maxSize}}` in it
// (HOS-322). The previous stub returned the inline fallback that HOS-616
// removed from these call sites.
vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    const translations = { t: tFromCatalog } as const;
    return { createTranslations: () => translations };
});

vi.mock('../../../src/lib/avatar-utils', () => ({
    getInitials: ({ name }: { name?: string | null }) =>
        name ? (name[0]?.toUpperCase() ?? '?') : '?'
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('@repo/schemas', async () => {
    // Mirrors the real `ProfileEditSchema` bounds/optionality (HOS-190 slice 3
    // read⊇write fix, bounds reverted to the original loose values): displayName/
    // firstName/lastName are optional/blankable (1-100 chars when provided) so a
    // profile with an unset name — or a legacy short value — can still re-save an
    // unrelated field (read⊇write) — see `packages/schemas/src/user/profile.ts`.
    const nameField = z.union([z.literal(''), z.string().min(1).max(100)]).optional();
    const ProfileEditSchema = z.strictObject({
        displayName: nameField,
        firstName: nameField,
        lastName: nameField,
        bio: z.string().max(1000).optional(),
        avatarUrl: z.union([z.literal(''), z.string().url()]).optional(),
        phone: z.union([z.literal(''), z.string().regex(/^\+\d{1,3}\d{4,14}$/)]).optional()
    });
    return { ProfileEditSchema };
});

const CAP_BYTES = mbToBytes(DEFAULT_AVATAR_MAX_FILE_SIZE_MB);

function makeFile(bytes: number, type = 'image/jpeg', name = 'avatar.jpg'): File {
    return new File([new Uint8Array(new ArrayBuffer(bytes))], name, { type });
}

function renderForm() {
    return render(
        <ProfileEditForm
            initialUser={{ id: 'user-1', displayName: 'Maria', avatarUrl: null }}
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

function pickFile(file: File): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
}

describe('ProfileEditForm avatar compression (HOS-1936)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        URL.createObjectURL = vi.fn(() => 'blob:preview');
        URL.revokeObjectURL = vi.fn();
    });

    it('accepts an oversized original that compression shrinks under the cap, and keeps the compressed file', async () => {
        const original = makeFile(CAP_BYTES + mbToBytes(1));
        const compressed = new File(['small'], 'avatar.jpg', { type: 'image/jpeg' });
        mockCompressImage.mockResolvedValue({
            file: compressed,
            wasCompressed: true,
            originalBytes: original.size,
            compressedBytes: compressed.size
        });
        renderForm();

        pickFile(original);

        await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(compressed));
        expect(mockCompressImage).toHaveBeenCalledWith({ file: original });
        expect(addToast).not.toHaveBeenCalled();
    });

    it('rejects with the generic too-large message when the compressed file is still over the cap', async () => {
        const original = makeFile(CAP_BYTES + mbToBytes(2));
        mockCompressImage.mockResolvedValue({
            file: original,
            wasCompressed: false,
            reason: 'no-size-gain'
        });
        renderForm();

        pickFile(original);

        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining(`${DEFAULT_AVATAR_MAX_FILE_SIZE_MB} MB`)
                })
            )
        );
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('uses the "could not optimize" message when the browser cannot process an oversized file', async () => {
        const original = makeFile(CAP_BYTES + mbToBytes(2));
        mockCompressImage.mockResolvedValue({
            file: original,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        renderForm();

        pickFile(original);

        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    message: expect.stringContaining('No pudimos optimizar')
                })
            )
        );
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('keeps an original that fits under the cap when compression is unavailable', async () => {
        const original = makeFile(CAP_BYTES - mbToBytes(1));
        mockCompressImage.mockResolvedValue({
            file: original,
            wasCompressed: false,
            reason: 'decode-unsupported'
        });
        renderForm();

        pickFile(original);

        await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(original));
        expect(addToast).not.toHaveBeenCalled();
    });

    it('rejects an unsupported type without attempting compression', async () => {
        renderForm();

        pickFile(makeFile(1000, 'application/pdf', 'doc.pdf'));

        await waitFor(() =>
            expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
        );
        expect(mockCompressImage).not.toHaveBeenCalled();
    });

    it('shows the optimizing indicator while compressing', async () => {
        let resolve: (value: CompressionOutcome) => void = () => {};
        mockCompressImage.mockReturnValue(
            new Promise<CompressionOutcome>((r) => {
                resolve = r;
            })
        );
        renderForm();
        const file = makeFile(CAP_BYTES + mbToBytes(1));

        pickFile(file);

        expect(await screen.findByText('Optimizando…')).toBeInTheDocument();
        resolve({ file, wasCompressed: false, reason: 'no-size-gain' });
        await waitFor(() => expect(screen.queryByText('Optimizando…')).not.toBeInTheDocument());
    });
});
