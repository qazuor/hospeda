/**
 * Tests for the partner logo upload inside PartnerEditForm (HOS-2506, AC-6).
 *
 * The uploader and the compression step are mocked: what is under test is the
 * wiring: pick, preview before saving, the uploaded URL landing in `logoUrl`,
 * the typed errors, and the «Pegar URL» fallback.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadMock, updateMineMock, compressMock } = vi.hoisted(() => ({
    uploadMock: vi.fn(),
    updateMineMock: vi.fn(),
    compressMock: vi.fn()
}));

vi.mock('@/lib/media/upload-partner-logo', () => ({ uploadPartnerLogo: uploadMock }));
vi.mock('@/lib/media/compress-image', () => ({
    compressImageForUpload: compressMock,
    isCompressionUnavailable: () => false
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    partnersApi: { updateMine: updateMineMock }
}));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

import { PartnerEditForm } from '../../../src/components/account/PartnerEditForm.client';

const PARTNER = {
    id: 'p-1',
    name: 'Hotel Sol',
    slug: 'hotel-sol',
    logoUrl: 'https://cdn.test/live.png',
    description: 'Una descripción',
    websiteUrl: 'https://sol.test',
    contentReviewState: null,
    contactInfo: {},
    socialNetworks: {}
} as unknown as Parameters<typeof PartnerEditForm>[0]['partner'];

const png = (size = 10) => new File([new Uint8Array(size)], 'logo.png', { type: 'image/png' });

function pick(file: File): void {
    fireEvent.change(screen.getByTestId('image-uploader-input'), { target: { files: [file] } });
}

beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    compressMock.mockImplementation(async ({ file }: { file: File }) => ({
        file,
        reason: 'below-threshold'
    }));
    uploadMock.mockResolvedValue({ ok: true, url: 'https://cdn.test/new.png' });
    updateMineMock.mockResolvedValue({
        ok: true,
        data: { partner: { ...PARTNER, logoUrl: 'https://cdn.test/new.png' } }
    });
});

describe('PartnerEditForm logo upload (HOS-2506)', () => {
    it('shows the current logo as the preview and keeps the save bar hidden until a change', () => {
        render(
            <PartnerEditForm
                locale="es"
                partner={PARTNER}
            />
        );
        expect(screen.getByTestId('image-uploader-preview')).toHaveAttribute(
            'src',
            'https://cdn.test/live.png'
        );
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
    });

    it('uploads the picked image, previews it and saves the resulting URL as logoUrl', async () => {
        render(
            <PartnerEditForm
                locale="es"
                partner={PARTNER}
            />
        );

        pick(png());

        await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
        expect(uploadMock.mock.calls[0]?.[0]).toMatchObject({ locale: 'es' });
        expect(screen.getByTestId('image-uploader-preview')).toHaveAttribute('src', 'blob:preview');

        fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => expect(updateMineMock).toHaveBeenCalledTimes(1));
        expect(updateMineMock.mock.calls[0]?.[0]).toMatchObject({
            logoUrl: 'https://cdn.test/new.png',
            description: 'Una descripción',
            websiteUrl: 'https://sol.test'
        });
    });

    it('rejects a wrong type with a field error and never uploads or dirties the form', async () => {
        render(
            <PartnerEditForm
                locale="es"
                partner={PARTNER}
            />
        );

        pick(new File([new Uint8Array(4)], 'logo.gif', { type: 'image/gif' }));

        expect(await screen.findByText(/Ese formato no está permitido/)).toBeInTheDocument();
        expect(uploadMock).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
    });

    it('rejects an oversize image with a field error', async () => {
        render(
            <PartnerEditForm
                locale="es"
                partner={PARTNER}
            />
        );

        pick(png(11 * 1024 * 1024));

        expect(await screen.findByText(/pesa más de 10 MB/)).toBeInTheDocument();
        expect(uploadMock).not.toHaveBeenCalled();
    });

    it('shows the upload failure and keeps the previous logo', async () => {
        uploadMock.mockResolvedValue({ ok: false, message: 'No pudimos subir la imagen.' });
        render(
            <PartnerEditForm
                locale="es"
                partner={PARTNER}
            />
        );

        pick(png());

        expect(await screen.findByText('No pudimos subir la imagen.')).toBeInTheDocument();
        expect(screen.getByTestId('image-uploader-preview')).toHaveAttribute(
            'src',
            'https://cdn.test/live.png'
        );
    });

    it('keeps the pasted-URL path behind a Pegar URL disclosure', () => {
        render(
            <PartnerEditForm
                locale="es"
                partner={PARTNER}
            />
        );

        const summary = screen.getByText('Pegar URL');
        expect(summary.closest('details')).not.toHaveAttribute('open');

        fireEvent.change(screen.getByLabelText('URL del logo'), {
            target: { value: 'https://other.test/logo.png' }
        });
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    });
});
