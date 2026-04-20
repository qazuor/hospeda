/**
 * AvatarUpload advanced tests (T-067, SPEC-078-GAPS).
 *
 * Extends T-047 smoke coverage with:
 * - Upload handler failure surfaces the invalidType error message (covers the
 *   catch branch that was previously untested).
 * - Invalid MIME type rejected client-side with visible error and
 *   no onUpload / onChange invocation.
 * - Remove flow calls onChange(null) and clears any prior error.
 * - Disabled prop disables both the upload button and the hidden file input.
 * - Custom label prop is honored (instead of the default i18n key).
 * - Email fallback derives initials when name is missing.
 * - Upload button label flips to uploadButton key when no value is set.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvatarUpload } from '@/components/entity-form/fields/AvatarUpload';

/**
 * Build a File with a controlled byte size without allocating the full buffer.
 */
const buildFile = (args: { name: string; type: string; sizeBytes: number }): File => {
    const { name, type, sizeBytes } = args;
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', {
        value: sizeBytes,
        configurable: true
    });
    return file;
};

const getHiddenInput = (): HTMLInputElement => {
    return screen.getByTestId('avatar-upload-input') as HTMLInputElement;
};

describe('AvatarUpload — advanced coverage (T-067)', () => {
    it('rejects an invalid MIME type and surfaces invalidType error', () => {
        const onChange = vi.fn();
        const onUpload = vi.fn();

        render(
            <AvatarUpload
                name="Ada Lovelace"
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const badFile = buildFile({
            name: 'file.gif',
            type: 'image/gif',
            sizeBytes: 1024
        });

        fireEvent.change(getHiddenInput(), { target: { files: [badFile] } });

        const error = screen.getByTestId('avatar-upload-error');
        expect(error).toHaveAttribute('role', 'alert');
        expect(error.textContent).toContain('admin-entities.fields.avatar.invalidType');
        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('surfaces the invalidType error when the upload handler throws', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockRejectedValue(new Error('Server 503'));

        render(
            <AvatarUpload
                name="Ada Lovelace"
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const goodFile = buildFile({
            name: 'good.png',
            type: 'image/png',
            sizeBytes: 1024
        });

        fireEvent.change(getHiddenInput(), { target: { files: [goodFile] } });

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });

        const error = await screen.findByTestId('avatar-upload-error');
        expect(error.textContent).toContain('admin-entities.fields.avatar.invalidType');
        // onChange must NOT fire when the upload handler rejects.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('clicking Remove calls onChange(null) and does not leave a pending error', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <AvatarUpload
                value="https://cdn.example.com/avatar.png"
                name="Ada Lovelace"
                onChange={onChange}
            />
        );

        const removeBtn = screen.getByTestId('avatar-remove-button');
        await user.click(removeBtn);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(null);
        // No error region should appear after a remove.
        expect(screen.queryByTestId('avatar-upload-error')).not.toBeInTheDocument();
    });

    it('honors the disabled prop on the upload button (blocks the picker)', () => {
        const onChange = vi.fn();
        const onUpload = vi.fn();

        render(
            <AvatarUpload
                disabled
                name="Ada Lovelace"
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const uploadBtn = screen.getByTestId('avatar-upload-button') as HTMLButtonElement;
        expect(uploadBtn).toBeDisabled();
        // Hidden file input is also disabled.
        expect(getHiddenInput()).toBeDisabled();
    });

    it('uses the custom label prop instead of the default i18n key', () => {
        render(
            <AvatarUpload
                name="Ada Lovelace"
                label="Profile picture"
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('Profile picture')).toBeInTheDocument();
        // The default i18n key must NOT render when a custom label is supplied.
        expect(screen.queryByText('admin-entities.fields.avatar.label')).not.toBeInTheDocument();
    });

    it('derives initials from the email when name is empty', () => {
        render(
            <AvatarUpload
                email="grace.hopper@example.com"
                onChange={vi.fn()}
            />
        );

        const fallback = screen.getByTestId('avatar-upload-fallback');
        // getInitialsFromName returns the first letter(s) of the email local part.
        expect(fallback.textContent?.length ?? 0).toBeGreaterThan(0);
        expect(fallback.textContent).not.toBe('?');
    });

    it('shows uploadButton label (not changeButton) when no value is set', () => {
        render(
            <AvatarUpload
                name="Ada Lovelace"
                onChange={vi.fn()}
            />
        );

        const button = screen.getByTestId('avatar-upload-button');
        expect(button.textContent).toContain('admin-entities.fields.avatar.uploadButton');
        // No remove button when value is falsy.
        expect(screen.queryByTestId('avatar-remove-button')).not.toBeInTheDocument();
    });

    it('forwards a custom data-testid to the outer wrapper', () => {
        render(
            <AvatarUpload
                name="Ada Lovelace"
                onChange={vi.fn()}
                data-testid="custom-avatar-wrapper"
            />
        );

        expect(screen.getByTestId('custom-avatar-wrapper')).toBeInTheDocument();
    });
});
