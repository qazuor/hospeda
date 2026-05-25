/**
 * T-046 (SPEC-078-GAPS) — Admin upload flow gaps.
 *
 * Covers:
 * 1. GAP-078-152 — Client MIME allowlist accepts HEIC/HEIF/AVIF, rejects
 *    non-image types. Preview placeholder renders for HEIC/AVIF files on
 *    ImageField.
 * 2. GAP-078-127 — `useGalleryUploads` runs batch uploads with p-limit(4).
 *    Peak concurrency never exceeds 4 even with 6 files.
 * 3. GAP-078-140 — Active upload renders role="status" + aria-live="polite"
 *    progress indicator with "Uploading X MB..." text.
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { GalleryField } from '@/components/entity-form/fields/GalleryField';
import { ImageField, type ImageValue } from '@/components/entity-form/fields/ImageField';
import { useGalleryUploads } from '@/components/entity-form/fields/use-gallery-uploads';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';
import { ModerationStatusEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildGalleryConfig = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
    id: 'photos',
    type: FieldTypeEnum.GALLERY,
    label: 'Gallery',
    typeConfig: {
        type: 'GALLERY',
        maxImages: 10,
        sortable: true,
        // Use defaults by not supplying allowedTypes — GalleryField's default
        // list must include HEIC/HEIF/AVIF per GAP-078-152.
        maxSize: 50 * 1024 * 1024
    },
    ...overrides
});

const buildImageConfig = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
    id: 'cover',
    type: FieldTypeEnum.IMAGE,
    label: 'Cover image',
    typeConfig: {
        type: 'IMAGE',
        maxSize: 50 * 1024 * 1024
    },
    ...overrides
});

const makeFile = (name: string, mime: string, sizeBytes = 1024): File => {
    const blob = new Blob([new Uint8Array(sizeBytes)], { type: mime });
    return new File([blob], name, { type: mime });
};

/**
 * JSDOM doesn't implement `DataTransfer`, so we build a FileList-compatible
 * shim using an array with an `item()` method and a `length` property.
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

// ---------------------------------------------------------------------------
// 1. MIME allowlist (GAP-078-152)
// ---------------------------------------------------------------------------

describe('T-046 / GAP-078-152 — HEIC/HEIF/AVIF MIME allowlist', () => {
    it('exposes heic/heif/avif in the GalleryField file-input accept attribute', () => {
        const { container } = render(
            <GalleryField
                config={buildGalleryConfig()}
                value={[]}
                onChange={vi.fn()}
            />
        );
        const input = container.querySelector('input[type="file"]');
        const accept = input?.getAttribute('accept') ?? '';
        expect(accept).toContain('image/heic');
        expect(accept).toContain('image/heif');
        expect(accept).toContain('image/avif');
    });

    it('exposes heic/heif/avif in the ImageField file-input accept attribute', () => {
        const { container } = render(
            <ImageField
                config={buildImageConfig()}
                value={undefined}
                onChange={vi.fn()}
            />
        );
        const input = container.querySelector('input[type="file"]');
        const accept = input?.getAttribute('accept') ?? '';
        expect(accept).toContain('image/heic');
        expect(accept).toContain('image/heif');
        expect(accept).toContain('image/avif');
    });

    it('uploads a HEIC file through the gallery upload handler', async () => {
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/x.heic');
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useGalleryUploads({
                value: [],
                onChange,
                maxImages: 10,
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['image/heic', 'image/heif', 'image/avif', 'image/jpeg'],
                onUpload,
                formatFileSize: (b) => `${b}B`
            })
        );

        const files = makeFileList([makeFile('photo.heic', 'image/heic', 10)]);
        await act(async () => {
            await result.current.handleFilesSelect(files);
        });

        expect(onUpload).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('uploads an AVIF file and HEIF file through the gallery upload handler', async () => {
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/x.avif');
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useGalleryUploads({
                value: [],
                onChange,
                maxImages: 10,
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['image/heic', 'image/heif', 'image/avif', 'image/jpeg'],
                onUpload,
                formatFileSize: (b) => `${b}B`
            })
        );

        const files = makeFileList([
            makeFile('photo.avif', 'image/avif', 10),
            makeFile('photo.heif', 'image/heif', 10)
        ]);
        await act(async () => {
            await result.current.handleFilesSelect(files);
        });

        expect(onUpload).toHaveBeenCalledTimes(2);
    });

    it('rejects application/pdf with a validation error', async () => {
        const onUpload = vi.fn();
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useGalleryUploads({
                value: [],
                onChange,
                maxImages: 10,
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/heic'],
                onUpload,
                formatFileSize: (b) => `${b}B`
            })
        );

        const files = makeFileList([makeFile('doc.pdf', 'application/pdf', 10)]);
        await act(async () => {
            await result.current.handleFilesSelect(files);
        });

        expect(onUpload).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        expect(result.current.uploadError).not.toBeNull();
    });

    it('renders a preview placeholder for HEIC image values in ImageField', () => {
        const heicImage: ImageValue = {
            url: 'https://cdn.example.com/photo.heic',
            alt: 'photo.heic',
            moderationState: ModerationStatusEnum.APPROVED
        };
        render(
            <ImageField
                config={buildImageConfig()}
                value={heicImage}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('image-field-preview-unavailable')).toBeInTheDocument();
        expect(
            screen.getByText('admin-entities.fields.image.previewUnavailable')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('image-field-preview')).not.toBeInTheDocument();
    });

    it('renders a preview placeholder for AVIF image values in ImageField', () => {
        const avifImage: ImageValue = {
            url: 'blob:https://admin/123',
            alt: 'shot.avif',
            moderationState: ModerationStatusEnum.APPROVED
        };
        render(
            <ImageField
                config={buildImageConfig()}
                value={avifImage}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('image-field-preview-unavailable')).toBeInTheDocument();
    });

    it('renders the native <img> for previewable formats (JPEG)', () => {
        const jpegImage: ImageValue = {
            url: 'https://cdn.example.com/photo.jpg',
            alt: 'photo.jpg',
            moderationState: ModerationStatusEnum.APPROVED
        };
        render(
            <ImageField
                config={buildImageConfig()}
                value={jpegImage}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('image-field-preview')).toBeInTheDocument();
        expect(screen.queryByTestId('image-field-preview-unavailable')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// 2. p-limit concurrency cap (GAP-078-127)
// ---------------------------------------------------------------------------

describe('T-046 / GAP-078-127 — p-limit(4) parallel uploads', () => {
    it('caps concurrent uploads at 4 when 6 files are selected', async () => {
        let active = 0;
        let peak = 0;

        const onUpload = vi.fn(async (_file: File) => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((r) => setTimeout(r, 20));
            active -= 1;
            return `https://cdn.example.com/${_file.name}`;
        });

        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useGalleryUploads({
                value: [],
                onChange,
                maxImages: 10,
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['image/jpeg'],
                onUpload,
                formatFileSize: (b) => `${b}B`
            })
        );

        const filesArr: File[] = [];
        for (let i = 0; i < 6; i++) {
            filesArr.push(makeFile(`img-${i}.jpg`, 'image/jpeg', 100));
        }
        const files = makeFileList(filesArr);

        await act(async () => {
            await result.current.handleFilesSelect(files);
        });

        expect(onUpload).toHaveBeenCalledTimes(6);
        expect(peak).toBeLessThanOrEqual(4);
        expect(peak).toBeGreaterThan(1);
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// 3. Progress indicator (GAP-078-140)
// ---------------------------------------------------------------------------

describe('T-046 / GAP-078-140 — Indeterminate upload progress indicator', () => {
    it('renders role=status aria-live=polite while batch upload is in flight', async () => {
        let resolveUpload: ((url: string) => void) | null = null;
        const onUpload = vi.fn(
            () =>
                new Promise<string>((resolve) => {
                    resolveUpload = resolve;
                })
        );

        render(
            <GalleryField
                config={buildGalleryConfig()}
                value={[]}
                onChange={vi.fn()}
                onUpload={onUpload}
            />
        );

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).not.toBeNull();

        const file = makeFile('hero.jpg', 'image/jpeg', 5 * 1024 * 1024);

        // Fire the change event; the upload promise is intentionally left
        // pending so the progress indicator stays visible.
        await act(async () => {
            Object.defineProperty(input, 'files', { value: [file] });
            fireEvent.change(input);
            // Let microtasks flush so setState inside the hook commits.
            await Promise.resolve();
        });

        const status = await screen.findByTestId('gallery-upload-progress');
        expect(status).toHaveAttribute('role', 'status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status.textContent).toContain('admin-entities.fields.gallery.uploadingProgress');

        // Resolve the upload and let finalization run so we don't leak state
        // across tests.
        await act(async () => {
            resolveUpload?.('https://cdn.example.com/hero.jpg');
            await Promise.resolve();
            await Promise.resolve();
        });
    });

    it('clears progress state after the batch resolves', async () => {
        const onUpload = vi.fn().mockResolvedValue('https://cdn.example.com/x.jpg');
        const onChange = vi.fn();
        const { result } = renderHook(() =>
            useGalleryUploads({
                value: [],
                onChange,
                maxImages: 10,
                maxSize: 50 * 1024 * 1024,
                allowedTypes: ['image/jpeg'],
                onUpload,
                formatFileSize: (b) => `${b}B`
            })
        );

        const files = makeFileList([makeFile('a.jpg', 'image/jpeg', 100)]);
        await act(async () => {
            await result.current.handleFilesSelect(files);
        });

        expect(result.current.progress).toBeNull();
        expect(result.current.isUploading).toBe(false);
    });
});

// Avoid unused-import lint noise — React import is needed for JSX in some
// bundler configs.
void React;
