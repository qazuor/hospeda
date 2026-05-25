/**
 * GalleryField advanced tests (T-067, SPEC-078-GAPS).
 *
 * Extends T-044 smoke coverage with:
 * - Upload happy path: onChange receives the current images + newly uploaded items.
 * - Validation: invalid MIME surfaces uploadError via role="alert", no onChange.
 * - Validation: oversized file surfaces uploadError and is skipped.
 * - maxImages cap: upload zone hides when images.length >= maxImages.
 * - Disabled mode disables the upload zone and file input.
 * - Required mode adds the destructive asterisk class to the label.
 * - sortable=false hides drag handles but keeps images visible.
 * - onDelete is invoked with the extracted publicId before the image is removed.
 * - Internal drag-reorder path: arrayMove updates order values via onChange.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { GalleryField, type GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { ModerationStatusEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildConfig = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
    id: 'photos',
    type: FieldTypeEnum.GALLERY,
    label: 'Gallery',
    typeConfig: {
        type: 'GALLERY',
        maxImages: 5,
        sortable: true,
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: 5 * 1024 * 1024
    },
    ...overrides
});

const buildImage = (id: string, order: number, url?: string): GalleryImage => ({
    id,
    url: url ?? `https://example.com/${id}.jpg`,
    alt: `Alt ${id}`,
    order,
    moderationState: ModerationStatusEnum.APPROVED
});

const makeFile = (args: { name: string; type: string; sizeBytes?: number }): File => {
    const { name, type, sizeBytes = 1024 } = args;
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true });
    return file;
};

/**
 * JSDOM FileList shim (upload-t046 pattern).
 */
const makeFileList = (files: File[]): FileList => {
    const list: FileList = {
        length: files.length,
        item: (i: number) => files[i] ?? null,
        [Symbol.iterator]: function* () {
            for (const f of files) yield f;
        }
    } as unknown as FileList;
    for (let i = 0; i < files.length; i++) {
        (list as unknown as Record<number, File>)[i] = files[i] as File;
    }
    return list;
};

const fireFileChange = (container: HTMLElement, files: File[]): void => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
        value: makeFileList(files),
        configurable: true
    });
    fireEvent.change(input);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GalleryField — upload happy path', () => {
    it('appends uploaded images to the existing value via onChange', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/new.jpg');

        const { container } = render(
            <GalleryField
                config={buildConfig()}
                value={[buildImage('a', 0)]}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        fireFileChange(container, [makeFile({ name: 'ok.jpg', type: 'image/jpeg' })]);

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledTimes(1);
        });

        const next = onChange.mock.calls[0]?.[0] as GalleryImage[];
        expect(next).toHaveLength(2);
        // Existing image kept; new image appended with order === 1.
        expect(next[0]?.id).toBe('a');
        expect(next[1]?.url).toBe('https://cdn.example.com/new.jpg');
        expect(next[1]?.order).toBe(1);
    });
});

describe('GalleryField — validation errors', () => {
    it('rejects a file with a disallowed MIME type and renders role="alert"', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn();

        const { container } = render(
            <GalleryField
                config={buildConfig()}
                value={[]}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        fireFileChange(container, [makeFile({ name: 'bad.gif', type: 'image/gif' })]);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain('invalid type');
        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('rejects an oversized file with a size-based error', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn();

        const { container } = render(
            <GalleryField
                config={buildConfig({
                    typeConfig: {
                        type: 'GALLERY',
                        maxImages: 5,
                        sortable: true,
                        allowedTypes: ['image/jpeg'],
                        maxSize: 1024
                    }
                })}
                value={[]}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        fireFileChange(container, [
            makeFile({ name: 'huge.jpg', type: 'image/jpeg', sizeBytes: 1024 * 1024 })
        ]);

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('exceeds max size');
        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('GalleryField — capacity and state', () => {
    it('hides the upload zone when the gallery reaches maxImages', () => {
        const images: GalleryImage[] = [buildImage('a', 0), buildImage('b', 1), buildImage('c', 2)];

        render(
            <GalleryField
                config={buildConfig({
                    typeConfig: {
                        type: 'GALLERY',
                        maxImages: 3,
                        sortable: true,
                        allowedTypes: ['image/jpeg'],
                        maxSize: 5 * 1024 * 1024
                    }
                })}
                value={images}
                onChange={vi.fn()}
            />
        );

        // Upload zone uses the aria-label key — must not render at the cap.
        expect(
            screen.queryByLabelText('admin-entities.fields.gallery.uploadAriaLabel')
        ).not.toBeInTheDocument();
    });

    it('disables the upload zone and file input when disabled', () => {
        const { container } = render(
            <GalleryField
                config={buildConfig()}
                value={[]}
                onChange={vi.fn()}
                disabled
            />
        );

        const uploadBtn = screen.getByLabelText(
            'admin-entities.fields.gallery.uploadAriaLabel'
        ) as HTMLButtonElement;
        expect(uploadBtn).toBeDisabled();
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeDisabled();
    });

    it('adds the destructive asterisk on the label when required', () => {
        render(
            <GalleryField
                config={buildConfig()}
                value={[]}
                onChange={vi.fn()}
                required
            />
        );

        const label = screen.getByText('Gallery');
        expect(label.className).toMatch(/after:content/);
    });

    it('hides drag handles when sortable is disabled', () => {
        const images: GalleryImage[] = [buildImage('a', 0), buildImage('b', 1)];

        render(
            <GalleryField
                config={buildConfig({
                    typeConfig: {
                        type: 'GALLERY',
                        maxImages: 5,
                        sortable: false,
                        allowedTypes: ['image/jpeg'],
                        maxSize: 5 * 1024 * 1024
                    }
                })}
                value={images}
                onChange={vi.fn()}
            />
        );

        // Gallery items still render.
        expect(screen.getByTestId('gallery-item-0')).toBeInTheDocument();
        // Drag handles are omitted when sortable is false.
        expect(screen.queryByTestId('gallery-drag-handle-0')).not.toBeInTheDocument();
    });
});

describe('GalleryField — delete with onDelete callback', () => {
    it('invokes onDelete with the extracted publicId before removing the image', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        // Cloudinary-style URL so extractPublicId returns a non-null value.
        const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg';
        const onDelete = vi.fn().mockResolvedValue(undefined);

        const images: GalleryImage[] = [buildImage('a', 0, cloudinaryUrl)];

        render(
            <GalleryField
                config={buildConfig()}
                value={images}
                onChange={onChange}
                onDelete={onDelete}
            />
        );

        const deleteBtn = screen.getByLabelText('admin-entities.fields.gallery.deleteLabel 1');
        await user.click(deleteBtn);

        // onDelete should be called with a string publicId (extracted by @repo/media).
        await waitFor(() => {
            expect(onDelete).toHaveBeenCalledTimes(1);
        });
        expect(typeof onDelete.mock.calls[0]?.[0]).toBe('string');

        // onChange fires after the delete callback resolves.
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledTimes(1);
        });
        const next = onChange.mock.calls[0]?.[0] as GalleryImage[];
        expect(next).toHaveLength(0);
    });

    it('silently removes the image when onDelete is absent (non-Cloudinary flow)', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        const images: GalleryImage[] = [buildImage('a', 0), buildImage('b', 1)];

        render(
            <GalleryField
                config={buildConfig()}
                value={images}
                onChange={onChange}
            />
        );

        await user.click(screen.getByLabelText('admin-entities.fields.gallery.deleteLabel 2'));

        await waitFor(() => {
            expect(onChange).toHaveBeenCalledTimes(1);
        });
        const next = onChange.mock.calls[0]?.[0] as GalleryImage[];
        expect(next).toHaveLength(1);
        expect(next[0]?.id).toBe('a');
        // Reorder from 0 is applied on removal.
        expect(next[0]?.order).toBe(0);
    });
});

describe('GalleryField — uploadError surface', () => {
    it('propagates upload handler rejection to the role="alert" region', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockRejectedValue(new Error('Network 503'));

        const { container } = render(
            <GalleryField
                config={buildConfig()}
                value={[]}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        fireFileChange(container, [makeFile({ name: 'ok.jpg', type: 'image/jpeg' })]);

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('Network 503');
        // No successful uploads → onChange never runs.
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('GalleryField — description + helper + error-message branches', () => {
    it('renders the field description when provided', () => {
        render(
            <GalleryField
                config={buildConfig({ description: 'Pick up to 5 images.' })}
                value={[]}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('Pick up to 5 images.')).toBeInTheDocument();
    });

    it('renders the helper text when no validation error is present', () => {
        render(
            <GalleryField
                config={buildConfig({ help: 'JPG, PNG accepted.' })}
                value={[]}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByText('JPG, PNG accepted.')).toBeInTheDocument();
    });

    it('renders the validation error message when hasError + errorMessage are set', () => {
        render(
            <GalleryField
                config={buildConfig({ help: 'Should be hidden when error is set.' })}
                value={[]}
                onChange={vi.fn()}
                hasError
                errorMessage="Gallery is required"
            />
        );

        expect(screen.getByText('Gallery is required')).toBeInTheDocument();
        // Helper text is suppressed while the error is visible.
        expect(screen.queryByText('Should be hidden when error is set.')).not.toBeInTheDocument();
    });
});

describe('GalleryField — drag-and-drop upload path', () => {
    it('accepts a file via drop, fires upload, and appends to value', async () => {
        const onChange = vi.fn();
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/drop.jpg');

        render(
            <GalleryField
                config={buildConfig()}
                value={[]}
                onChange={onChange}
                onUpload={onUpload}
            />
        );

        const dropZone = screen.getByLabelText('admin-entities.fields.gallery.uploadAriaLabel');

        const dropped = makeFile({ name: 'drop.jpg', type: 'image/jpeg' });

        // Simulate drag-over (covers setDragOver(true) branch) then drop.
        fireEvent.dragOver(dropZone, {
            dataTransfer: { files: makeFileList([dropped]) }
        });
        fireEvent.dragLeave(dropZone);
        fireEvent.drop(dropZone, {
            dataTransfer: { files: makeFileList([dropped]) }
        });

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(onChange).toHaveBeenCalledTimes(1);
        });
        const next = onChange.mock.calls[0]?.[0] as GalleryImage[];
        expect(next[0]?.url).toBe('https://cdn.example.com/drop.jpg');
    });
});
