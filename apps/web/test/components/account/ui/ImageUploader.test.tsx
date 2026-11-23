/**
 * Tests for ImageUploader and Disclosure (HOS-2506).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compressMock } = vi.hoisted(() => ({ compressMock: vi.fn() }));

vi.mock('@/lib/media/compress-image', () => ({
    compressImageForUpload: compressMock,
    isCompressionUnavailable: (outcome: { reason?: string }) => outcome.reason === 'unavailable'
}));

import {
    Disclosure,
    ImageUploader,
    type ImageUploaderProps
} from '../../../../src/components/account/ui';

const MB = 1024 * 1024;

const makeFile = ({ type, size = 10 }: { readonly type: string; readonly size?: number }) =>
    new File([new Uint8Array(size)], 'logo', { type });

function setup(overrides: Partial<ImageUploaderProps> = {}) {
    const onChange = vi.fn();
    const upload = vi.fn(async () => ({ ok: true as const, url: 'https://cdn.test/logo.png' }));
    const view = render(
        <ImageUploader
            label="Logo"
            locale="es"
            value={null}
            onChange={onChange}
            upload={upload}
            maxBytes={5 * MB}
            maxMb={5}
            previewAlt="Vista previa del logo"
            {...overrides}
        />
    );
    const input = screen.getByTestId('image-uploader-input') as HTMLInputElement;
    return { onChange, upload, input, ...view };
}

beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:local-preview');
    URL.revokeObjectURL = vi.fn();
    compressMock.mockImplementation(async ({ file }: { file: File }) => ({
        file,
        reason: 'below-threshold'
    }));
});

describe('ImageUploader', () => {
    it('labels the picker button and states the accepted types and the cap', () => {
        setup();
        const button = screen.getByRole('button', { name: 'Logo: Elegir imagen' });
        expect(button).toHaveTextContent('Elegir imagen');
        expect(screen.getByText(/PNG, JPG, WEBP\. Máximo 5 MB\./)).toBeInTheDocument();
    });

    it('rejects a wrong type with a field error and never uploads', async () => {
        const { upload, input } = setup();
        fireEvent.change(input, { target: { files: [makeFile({ type: 'image/gif' })] } });

        expect(await screen.findByText(/Ese formato no está permitido/)).toBeInTheDocument();
        expect(upload).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: /Logo/ })).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('rejects a file still over the cap after compression, with a field error', async () => {
        const { upload, input } = setup();
        fireEvent.change(input, {
            target: { files: [makeFile({ type: 'image/png', size: 6 * MB })] }
        });

        expect(await screen.findByText(/pesa más de 5 MB incluso después/)).toBeInTheDocument();
        expect(upload).not.toHaveBeenCalled();
    });

    it('explains when the browser could not compress and the file is too big', async () => {
        compressMock.mockImplementation(async ({ file }: { file: File }) => ({
            file,
            reason: 'unavailable'
        }));
        const { input } = setup();
        fireEvent.change(input, {
            target: { files: [makeFile({ type: 'image/png', size: 6 * MB })] }
        });

        expect(await screen.findByText(/No pudimos optimizar esta imagen/)).toBeInTheDocument();
    });

    it('accepts a heavy original that compresses under the cap', async () => {
        compressMock.mockImplementation(async () => ({
            file: makeFile({ type: 'image/jpeg', size: 1 * MB }),
            reason: 'compressed'
        }));
        const { upload, input, onChange } = setup();
        fireEvent.change(input, {
            target: { files: [makeFile({ type: 'image/jpeg', size: 9 * MB })] }
        });

        await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://cdn.test/logo.png'));
        expect(upload).toHaveBeenCalledTimes(1);
        expect((upload.mock.calls[0] as unknown as [File])[0].size).toBe(1 * MB);
    });

    it('shows the local preview before the upload resolves, then reports the URL', async () => {
        let resolveUpload: (value: { ok: true; url: string }) => void = () => undefined;
        const upload = vi.fn(
            () =>
                new Promise<{ ok: true; url: string }>((resolve) => {
                    resolveUpload = resolve;
                })
        );
        const { input, onChange } = setup({ upload });
        fireEvent.change(input, { target: { files: [makeFile({ type: 'image/png' })] } });

        const preview = await screen.findByTestId('image-uploader-preview');
        expect(preview).toHaveAttribute('src', 'blob:local-preview');
        expect(onChange).not.toHaveBeenCalled();

        await act(async () => {
            resolveUpload({ ok: true, url: 'https://cdn.test/new.png' });
        });
        expect(onChange).toHaveBeenCalledWith('https://cdn.test/new.png');
    });

    it('shows the upload error and keeps the previous value when the upload fails', async () => {
        const upload = vi.fn(async () => ({ ok: false as const, message: 'Servidor caído' }));
        const { input, onChange } = setup({ upload, value: 'https://cdn.test/old.png' });
        fireEvent.change(input, { target: { files: [makeFile({ type: 'image/webp' })] } });

        expect(await screen.findByText('Servidor caído')).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('image-uploader-preview')).toHaveAttribute(
            'src',
            'https://cdn.test/old.png'
        );
    });

    it('falls back to the generic message when the upload throws', async () => {
        const upload = vi.fn(async () => {
            throw new Error('boom');
        });
        const { input } = setup({ upload });
        fireEvent.change(input, { target: { files: [makeFile({ type: 'image/png' })] } });

        expect(await screen.findByText(/No pudimos subir la imagen/)).toBeInTheDocument();
    });

    it('uploads a dropped file and ignores a drop while disabled', async () => {
        const { upload, onChange, rerender } = setup();
        const zone = screen.getByTestId('image-uploader-zone');
        fireEvent.drop(zone, { dataTransfer: { files: [makeFile({ type: 'image/png' })] } });
        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

        rerender(
            <ImageUploader
                label="Logo"
                locale="es"
                value={null}
                onChange={onChange}
                upload={upload}
                maxBytes={5 * MB}
                maxMb={5}
                previewAlt="x"
                disabled
            />
        );
        fireEvent.drop(screen.getByTestId('image-uploader-zone'), {
            dataTransfer: { files: [makeFile({ type: 'image/png' })] }
        });
        expect(upload).toHaveBeenCalledTimes(1);
    });

    it('lets the form error win over the piece error', () => {
        setup({ error: 'No se pudo guardar' });
        expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
    });
});

describe('Disclosure', () => {
    it('is closed by default and opens from the summary', () => {
        render(<Disclosure summary="Pegar URL">contenido</Disclosure>);
        const details = screen.getByText('Pegar URL').closest('details');
        expect(details).not.toHaveAttribute('open');
        details?.setAttribute('open', '');
        expect(details).toHaveAttribute('open');
    });

    it('starts open with defaultOpen', () => {
        render(
            <Disclosure
                summary="Pegar URL"
                defaultOpen
            >
                contenido
            </Disclosure>
        );
        expect(screen.getByText('Pegar URL').closest('details')).toHaveAttribute('open');
    });
});
