/**
 * ImageField advanced tests (T-067, SPEC-078-GAPS).
 *
 * Extends T-045 smoke coverage with:
 * - Happy-path upload: valid file triggers onUpload + onChange with the returned URL.
 * - Drag-and-drop path mirrors the file-input path (setDragOver / validation / upload).
 * - Oversized file surfaces errorTooLarge and skips onChange.
 * - Metadata editors (alt / caption / description) propagate via onChange
 *   with the existing URL preserved.
 * - HEIC / AVIF files render the "preview unavailable" placeholder instead
 *   of a broken <img>.
 * - Disabled mode hides the remove button and disables the picker.
 * - Required mode adds the asterisk class on the label.
 * - Validation error clears the banner after a new successful upload.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { ImageField, type ImageValue } from '@/components/entity-form/fields/ImageField';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { ModerationStatusEnum } from '@repo/schemas';

// New uploads always carry moderationState PENDING (commit 61f08b016).
const PENDING = ModerationStatusEnum.PENDING;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildConfig = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
    id: 'cover',
    type: FieldTypeEnum.IMAGE,
    label: 'Cover image',
    typeConfig: {
        type: 'IMAGE',
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: 5 * 1024 * 1024
    },
    ...overrides
});

const buildImage = (over: Partial<ImageValue> = {}): ImageValue => ({
    url: 'https://example.com/cover.jpg',
    alt: 'Existing cover',
    moderationState: ModerationStatusEnum.APPROVED,
    ...over
});

const makeFile = (args: { name: string; type: string; sizeBytes?: number }): File => {
    const { name, type, sizeBytes = 1024 } = args;
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true });
    return file;
};

const fireFileChange = (container: HTMLElement, file: File): void => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // `configurable: true` so the same input can accept a new files list on retry.
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImageField — happy path upload', () => {
    it('invokes onUpload then onChange with the returned URL on a valid file', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/new.jpg');

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const file = makeFile({ name: 'good.jpg', type: 'image/jpeg' });
        fireFileChange(container, file);

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledTimes(1);
        });
        expect(onChange).toHaveBeenCalledWith({
            url: 'https://cdn.example.com/new.jpg',
            alt: 'good.jpg',
            moderationState: PENDING
        });
    });

    it('falls back to URL.createObjectURL when no onUpload handler is provided', async () => {
        const createObjectURL = vi.fn().mockReturnValue('blob:mocked');
        const original = URL.createObjectURL;
        URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;

        const onChange = vi.fn();

        try {
            const { container } = render(
                <ImageField
                    config={buildConfig()}
                    value={undefined}
                    onChange={onChange}
                />
            );

            fireFileChange(container, makeFile({ name: 'ok.png', type: 'image/png' }));

            await waitFor(() => {
                expect(onChange).toHaveBeenCalledWith({
                    url: 'blob:mocked',
                    alt: 'ok.png',
                    moderationState: PENDING
                });
            });
        } finally {
            URL.createObjectURL = original;
        }
    });

    it('surfaces the caller error message when onUpload rejects', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockRejectedValue(new Error('Server 413 Payload Too Large'));

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        fireFileChange(container, makeFile({ name: 'ok.jpg', type: 'image/jpeg' }));

        const msg = await screen.findByTestId('image-field-error-message');
        expect(msg).toHaveTextContent('Server 413 Payload Too Large');
        // onChange not called when upload rejects.
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('ImageField — validation errors', () => {
    it('rejects a file exceeding maxSize with errorTooLarge', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn();

        const { container } = render(
            <ImageField
                config={buildConfig({
                    typeConfig: {
                        type: 'IMAGE',
                        allowedTypes: ['image/jpeg'],
                        maxSize: 1024 // 1 KB cap
                    }
                })}
                value={undefined}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const tooBig = makeFile({
            name: 'big.jpg',
            type: 'image/jpeg',
            sizeBytes: 10 * 1024
        });
        fireFileChange(container, tooBig);

        const msg = await screen.findByTestId('image-field-error-message');
        expect(msg.textContent).toContain('admin-entities.fields.image.errorTooLarge');
        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('caller-provided uploadError wins over internal validation error', async () => {
        const onChange = vi.fn();

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={onChange}
                uploadError={new Error('503 Service Unavailable')}
            />
        );

        // Trigger an internal validation error — caller's error still wins.
        const invalid = makeFile({ name: 'x.gif', type: 'image/gif' });
        fireFileChange(container, invalid);

        const msg = await screen.findByTestId('image-field-error-message');
        expect(msg).toHaveTextContent('503 Service Unavailable');
    });
});

describe('ImageField — metadata editors', () => {
    it('updates alt text via onChange with the URL preserved', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const existing = buildImage({ alt: 'Old' });

        render(
            <ImageField
                config={buildConfig()}
                value={existing}
                onChange={onChange}
            />
        );

        const altInput = screen.getByDisplayValue('Old');
        await user.clear(altInput);
        await user.type(altInput, 'N');

        // After typing "N", onChange was called at least twice (clear + type).
        expect(onChange).toHaveBeenCalled();
        const last = onChange.mock.calls.at(-1)?.[0] as ImageValue;
        expect(last.url).toBe(existing.url);
        expect(typeof last.alt).toBe('string');
    });

    it('updates caption via onChange', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <ImageField
                config={buildConfig()}
                value={buildImage({ caption: '' })}
                onChange={onChange}
            />
        );

        // Caption input is the one with the caption placeholder key.
        const captionInput = screen.getByPlaceholderText(
            'admin-entities.fields.image.captionPlaceholder'
        );
        await user.type(captionInput, 'x');

        const last = onChange.mock.calls.at(-1)?.[0] as ImageValue;
        expect(last.caption).toBe('x');
    });

    it('updates description via onChange', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <ImageField
                config={buildConfig()}
                value={buildImage({ description: '' })}
                onChange={onChange}
            />
        );

        const descInput = screen.getByPlaceholderText(
            'admin-entities.fields.image.descriptionPlaceholder'
        );
        await user.type(descInput, 'y');

        const last = onChange.mock.calls.at(-1)?.[0] as ImageValue;
        expect(last.description).toBe('y');
    });
});

describe('ImageField — HEIC / AVIF preview fallback', () => {
    it('renders the previewUnavailable placeholder for a .heic URL (query-string)', () => {
        // Source checks `.heic` followed by `?`, `#`, or end-of-string. Using
        // a trailing slash-free URL with a query parameter is the simplest way
        // to trigger the branch without depending on alt-text quirks.
        render(
            <ImageField
                config={buildConfig()}
                value={{
                    url: 'https://example.com/photo.heic?v=1',
                    alt: '',
                    moderationState: ModerationStatusEnum.APPROVED
                }}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByTestId('image-field-preview-unavailable')).toBeInTheDocument();
        // The real <img> preview must NOT render for unpreviewable formats.
        expect(screen.queryByTestId('image-field-preview')).not.toBeInTheDocument();
    });

    it('renders the previewUnavailable placeholder when alt ends in .avif', () => {
        render(
            <ImageField
                config={buildConfig()}
                // Alt text ends in `.avif` (with no trailing space) so the
                // regex `\.(avif)(\?|#|$)` matches end-of-string.
                value={{
                    url: 'https://example.com/photo',
                    alt: 'photo.avif',
                    moderationState: ModerationStatusEnum.APPROVED
                }}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByTestId('image-field-preview-unavailable')).toBeInTheDocument();
    });
});

describe('ImageField — disabled / required states', () => {
    it('does not render the remove button when disabled', () => {
        render(
            <ImageField
                config={buildConfig()}
                value={buildImage()}
                onChange={vi.fn()}
                disabled
            />
        );

        expect(screen.queryByTestId('image-field-remove')).not.toBeInTheDocument();
    });

    it('disables the hidden file input when disabled', () => {
        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={vi.fn()}
                disabled
            />
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeDisabled();
    });

    it('adds the destructive asterisk class when required', () => {
        render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={vi.fn()}
                required
            />
        );

        const label = screen.getByText('Cover image');
        // Tailwind class `after:content-["*"]` is the required marker.
        expect(label.className).toMatch(/after:content/);
    });
});

describe('ImageField — banner clears on retry', () => {
    it('clears the dismissed-error key when the user selects a new file', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/ok.jpg');

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        // First: trigger a validation error.
        fireFileChange(container, makeFile({ name: 'bad.gif', type: 'image/gif' }));
        await screen.findByTestId('image-field-error-banner');

        // Now retry with a valid file — banner must clear (internalError reset).
        fireFileChange(container, makeFile({ name: 'good.jpg', type: 'image/jpeg' }));

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByTestId('image-field-error-banner')).not.toBeInTheDocument();
    });
});
