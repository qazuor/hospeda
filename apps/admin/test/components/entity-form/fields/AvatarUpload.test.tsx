/**
 * AvatarUpload component tests (T-047).
 *
 * Covers:
 * 1. Renders AvatarFallback with initials when no image value is provided.
 * 2. Renders AvatarImage preview when a value is provided.
 * 3. Rejects files larger than `maxFileSizeMb` with a visible error and does
 *    not invoke `onUpload` / `onChange`.
 * 4. Defaults `maxFileSizeMb` to 5 MB when the prop is not supplied.
 * 5. Successful upload surfaces the returned URL via `onChange`.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AvatarUpload } from '@/components/entity-form/fields/AvatarUpload';

/**
 * Build a File with a controlled byte size without allocating the full buffer
 * in memory — we simply override the `size` property via Object.defineProperty.
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
    const input = screen.getByTestId('avatar-upload-input');
    return input as HTMLInputElement;
};

describe('AvatarUpload', () => {
    it('renders AvatarFallback with initials when no value is provided', () => {
        render(
            <AvatarUpload
                name="Ada Lovelace"
                onChange={vi.fn()}
            />
        );

        const fallback = screen.getByTestId('avatar-upload-fallback');
        expect(fallback).toBeInTheDocument();
        expect(fallback).toHaveTextContent('AL');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('falls back to "?" when neither name nor email is provided', () => {
        render(<AvatarUpload onChange={vi.fn()} />);

        expect(screen.getByTestId('avatar-upload-fallback')).toHaveTextContent('?');
    });

    it('rejects a file larger than maxFileSizeMb and surfaces a visible error', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockResolvedValue('https://example.com/a.png');

        render(
            <AvatarUpload
                name="Grace Hopper"
                maxFileSizeMb={1}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const oversized = buildFile({
            name: 'big.png',
            type: 'image/png',
            sizeBytes: 2 * 1024 * 1024 // 2 MB > 1 MB cap
        });

        fireEvent.change(getHiddenInput(), { target: { files: [oversized] } });

        const error = await screen.findByTestId('avatar-upload-error');
        expect(error).toBeInTheDocument();
        // i18n mock returns the key verbatim, so we assert on the key name.
        expect(error.textContent).toContain('admin-entities.fields.avatar.fileTooLarge');
        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('applies the default 5 MB cap when maxFileSizeMb is not provided', () => {
        const onChange = vi.fn();
        const onUpload = vi.fn();

        render(
            <AvatarUpload
                name="Grace Hopper"
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const oversized = buildFile({
            name: 'huge.png',
            type: 'image/png',
            sizeBytes: 6 * 1024 * 1024 // 6 MB > default 5 MB
        });

        fireEvent.change(getHiddenInput(), { target: { files: [oversized] } });

        // Default cap rejects 6 MB files — upload handler must not be invoked.
        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('avatar-upload-error')).toBeInTheDocument();
    });

    it('shows a remove action when a value is provided (image preview path)', () => {
        // Radix Avatar's AvatarImage only attaches the <img> element to the DOM
        // after the browser reports a successful load. JSDOM never fires
        // onLoad, so we assert on the surrounding UI contract instead: the
        // remove action is only rendered when `value` is truthy.
        render(
            <AvatarUpload
                value="https://cdn.example.com/avatar.png"
                name="Ada Lovelace"
                onChange={vi.fn()}
            />
        );

        expect(screen.getByTestId('avatar-remove-button')).toBeInTheDocument();
        // Button label flips from "uploadButton" to "changeButton" when there
        // is already a stored avatar.
        expect(screen.getByTestId('avatar-upload-button').textContent).toContain(
            'admin-entities.fields.avatar.changeButton'
        );
    });

    it('calls onChange with the uploaded URL on successful upload', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/new.png');

        render(
            <AvatarUpload
                name="Grace Hopper"
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const good = buildFile({
            name: 'small.png',
            type: 'image/png',
            sizeBytes: 10 * 1024 // 10 KB
        });

        fireEvent.change(getHiddenInput(), { target: { files: [good] } });

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledWith('https://cdn.example.com/new.png');
        });
        expect(screen.queryByTestId('avatar-upload-error')).not.toBeInTheDocument();
    });
});
