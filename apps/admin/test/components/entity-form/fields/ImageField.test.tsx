/**
 * ImageField component tests — a11y / UX refactor (T-045, SPEC-078-GAPS).
 *
 * Covers:
 * 1. Error banner renders on invalid file type, is an aria-live assertive
 *    region with role="alert", and is dismissible.
 * 2. Clicking delete opens the confirmation dialog; confirming calls
 *    onChange(null); cancelling does not.
 * 3. Reduced-motion Tailwind utility classes are applied to the preview
 *    image and spinner container so animations can be disabled via CSS
 *    when the user opts out.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { ImageField, type ImageValue } from '@/components/entity-form/fields/ImageField';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { ModerationStatusEnum } from '@repo/schemas';

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

const buildImage = (): ImageValue => ({
    url: 'https://example.com/cover.jpg',
    alt: 'Existing cover',
    moderationState: ModerationStatusEnum.APPROVED
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImageField — error banner', () => {
    it('renders a role=alert + aria-live=assertive banner when upload validation fails', async () => {
        const onChange = vi.fn();

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={onChange}
            />
        );

        // Smuggle a bogus file directly into the hidden file input — simulates
        // a user selecting a file whose type is not in allowedTypes.
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
        expect(fileInput).not.toBeNull();

        const invalid = new File(['bad'], 'bad.gif', { type: 'image/gif' });
        // Use fireEvent.change — userEvent.upload honors `accept` and would
        // reject the file silently here. We want to test our own validation.
        Object.defineProperty(fileInput, 'files', { value: [invalid] });
        fireEvent.change(fileInput as HTMLInputElement);

        const banner = await screen.findByTestId('image-field-error-banner');
        expect(banner).toHaveAttribute('role', 'alert');
        expect(banner).toHaveAttribute('aria-live', 'assertive');
        // onChange is NOT called on validation failure.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('is dismissible — clicking dismiss removes the banner', async () => {
        const user = userEvent.setup();

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={vi.fn()}
            />
        );

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const invalid = new File(['bad'], 'bad.gif', { type: 'image/gif' });
        Object.defineProperty(fileInput, 'files', { value: [invalid] });
        fireEvent.change(fileInput);

        expect(await screen.findByTestId('image-field-error-banner')).toBeInTheDocument();

        const dismissBtn = screen.getByTestId('image-field-error-dismiss');
        await user.click(dismissBtn);

        expect(screen.queryByTestId('image-field-error-banner')).not.toBeInTheDocument();
    });

    it('surfaces caller-provided uploadError in the banner', () => {
        render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={vi.fn()}
                uploadError={new Error('Server rejected upload')}
            />
        );

        const message = screen.getByTestId('image-field-error-message');
        expect(message).toHaveTextContent('Server rejected upload');
    });
});

describe('ImageField — delete confirmation dialog', () => {
    it('clicking delete opens the confirmation dialog (does not immediately remove)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <ImageField
                config={buildConfig()}
                value={buildImage()}
                onChange={onChange}
            />
        );

        const removeBtn = screen.getByTestId('image-field-remove');
        await user.click(removeBtn);

        // Dialog visible (Radix renders via portal; queryBy searches entire doc).
        expect(await screen.findByTestId('delete-confirm-dialog')).toBeInTheDocument();
        // onChange is NOT called yet — waiting for confirm.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('confirming the dialog calls onChange(null) and closes the dialog', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <ImageField
                config={buildConfig()}
                value={buildImage()}
                onChange={onChange}
            />
        );

        await user.click(screen.getByTestId('image-field-remove'));
        await screen.findByTestId('delete-confirm-dialog');

        await user.click(screen.getByTestId('delete-confirm-confirm'));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it('cancelling the dialog does NOT call onChange', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <ImageField
                config={buildConfig()}
                value={buildImage()}
                onChange={onChange}
            />
        );

        await user.click(screen.getByTestId('image-field-remove'));
        await screen.findByTestId('delete-confirm-dialog');

        await user.click(screen.getByTestId('delete-confirm-cancel'));

        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('ImageField — prefers-reduced-motion', () => {
    it('applies motion-reduce:* utility classes on the preview image', () => {
        render(
            <ImageField
                config={buildConfig()}
                value={buildImage()}
                onChange={vi.fn()}
            />
        );

        const preview = screen.getByTestId('image-field-preview');
        // Verify both reduced-motion opt-outs (animate + transition) are wired.
        expect(preview.className).toMatch(/motion-reduce:animate-none/);
        expect(preview.className).toMatch(/motion-reduce:transition-none/);
    });

    it('applies motion-reduce:animate-none to the spinner icon when uploading', async () => {
        // Return a never-resolving promise so the spinner stays visible in
        // the assertion window. The promise holds the upload handler open so
        // isUploading=true across the assertion.
        const onUpload = vi.fn(() => new Promise<string>(() => undefined));

        const { container } = render(
            <ImageField
                config={buildConfig()}
                value={undefined}
                onChange={vi.fn()}
                onUpload={onUpload}
            />
        );

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const valid = new File(['ok'], 'ok.jpg', { type: 'image/jpeg' });
        Object.defineProperty(fileInput, 'files', { value: [valid] });
        fireEvent.change(fileInput);

        const spinner = await screen.findByTestId('icon-LoaderIcon');
        expect(spinner.className).toMatch(/motion-reduce:animate-none/);
    });
});
