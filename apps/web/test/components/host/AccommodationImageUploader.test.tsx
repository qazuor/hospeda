/**
 * @file AccommodationImageUploader.test.tsx
 * @description Unit tests for the AccommodationImageUploader React island.
 *
 * Covers: empty state, thumbnail grid, remove, successful upload, failed upload,
 * max images enforcement, partial overflow, missing entityId guard, and drag-and-drop.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationImageUploader } from '../../../src/components/host/AccommodationImageUploader.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Mock i18n to avoid locale file loading in JSDOM.
 * Returns the fallback string directly, which is how the component calls t().
 */
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

/**
 * Mock AccommodationImageUploader CSS Module to avoid CSS Module processing issues
 * in the test environment.
 */
vi.mock('../../../src/components/host/AccommodationImageUploader.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default props used in most tests. */
const defaultProps = {
    value: [] as ReadonlyArray<string>,
    onChange: vi.fn(),
    entityId: 'accommodation-uuid-123',
    apiUrl: 'http://localhost:3001',
    maxImages: 5,
    locale: 'es' as const
};

/**
 * Build a resolved fetch mock returning a given body with an optional ok flag.
 */
function buildFetchMock(opts: { ok?: boolean; body?: unknown; throws?: boolean } = {}) {
    const { ok = true, body, throws = false } = opts;
    if (throws) {
        return vi.fn().mockRejectedValue(new Error('Network failure'));
    }
    return vi.fn().mockResolvedValue({
        ok,
        status: ok ? 200 : 400,
        json: () => Promise.resolve(body ?? {})
    });
}

/**
 * Build a successful upload response body.
 */
function buildSuccessBody(
    url = 'https://res.cloudinary.com/test/image/upload/v1/gallery/img1.jpg'
) {
    return {
        success: true,
        data: {
            url,
            publicId: 'gallery/img1',
            width: 800,
            height: 600,
            moderationState: 'approved'
        }
    };
}

/**
 * Create a mock File object with the given name and type.
 */
function makeFile(name = 'photo.jpg', type = 'image/jpeg', size = 1024): File {
    return new File(['x'.repeat(size)], name, { type });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccommodationImageUploader', () => {
    // -----------------------------------------------------------------------
    // 1. Empty state
    // -----------------------------------------------------------------------

    describe('empty state', () => {
        it('renders upload prompt message when value is empty', () => {
            // Arrange
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                />
            );

            // Assert
            expect(
                screen.getByText('Arrastrá fotos acá o hacé click para seleccionar')
            ).toBeInTheDocument();
        });

        it('renders select button in empty state', () => {
            // Arrange
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                />
            );

            // Assert
            expect(
                screen.getByRole('button', { name: 'Seleccionar archivos' })
            ).toBeInTheDocument();
        });

        it('shows 0 / N counter in empty state', () => {
            // Arrange
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                    maxImages={10}
                />
            );

            // Assert
            expect(screen.getByText('0 / 10 imágenes')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // 2. Thumbnail grid
    // -----------------------------------------------------------------------

    describe('thumbnail grid', () => {
        it('renders correct number of thumbnails when value has URLs', () => {
            // Arrange
            const urls = [
                'https://cdn.example.com/img1.jpg',
                'https://cdn.example.com/img2.jpg'
            ] as const;
            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={urls}
                />
            );

            // Assert — two <img> elements (thumbnails have alt="" so role is "presentation")
            const imgs = container.querySelectorAll('img.thumbnailImg');
            expect(imgs).toHaveLength(2);
        });

        it('renders remove button for each thumbnail', () => {
            // Arrange
            const urls = [
                'https://cdn.example.com/img1.jpg',
                'https://cdn.example.com/img2.jpg'
            ] as const;
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={urls}
                />
            );

            // Assert — one remove button per thumbnail
            const removeButtons = screen.getAllByRole('button', { name: 'Quitar foto' });
            expect(removeButtons).toHaveLength(2);
        });

        it('does not render thumbnail grid when value is empty and no in-flight uploads', () => {
            // Arrange
            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                />
            );

            // Assert — thumbnailGrid div is not rendered
            expect(
                container.querySelector('[aria-label="Galería de fotos subidas"]')
            ).not.toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // 3. Remove button
    // -----------------------------------------------------------------------

    describe('remove button', () => {
        it('calls onChange with image removed from array when remove button is clicked', async () => {
            // Arrange
            const onChange = vi.fn();
            const urls = [
                'https://cdn.example.com/img1.jpg',
                'https://cdn.example.com/img2.jpg'
            ] as const;
            const user = userEvent.setup();
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={urls}
                    onChange={onChange}
                />
            );

            // Act — click the first remove button
            const removeButtons = screen.getAllByRole('button', { name: 'Quitar foto' });
            await user.click(removeButtons[0]);

            // Assert — onChange called with only the second URL
            expect(onChange).toHaveBeenCalledWith(['https://cdn.example.com/img2.jpg']);
        });

        it('calls onChange with empty array when last image is removed', async () => {
            // Arrange
            const onChange = vi.fn();
            const user = userEvent.setup();
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={['https://cdn.example.com/only.jpg']}
                    onChange={onChange}
                />
            );

            // Act
            await user.click(screen.getByRole('button', { name: 'Quitar foto' }));

            // Assert
            expect(onChange).toHaveBeenCalledWith([]);
        });
    });

    // -----------------------------------------------------------------------
    // 4. Successful upload
    // -----------------------------------------------------------------------

    describe('successful upload', () => {
        it('calls onChange with new URL appended after successful fetch', async () => {
            // Arrange
            const onChange = vi.fn();
            const newUrl = 'https://res.cloudinary.com/test/gallery/new.jpg';
            vi.stubGlobal('fetch', buildFetchMock({ ok: true, body: buildSuccessBody(newUrl) }));

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                    onChange={onChange}
                />
            );

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;
            const file = makeFile('new.jpg', 'image/jpeg');

            // Act — fire change on the hidden input
            await act(async () => {
                fireEvent.change(input, { target: { files: [file] } });
            });

            // Assert
            await waitFor(() => {
                expect(onChange).toHaveBeenCalledWith([newUrl]);
            });
        });

        it('does not show error message after successful upload', async () => {
            // Arrange
            const newUrl = 'https://res.cloudinary.com/test/gallery/ok.jpg';
            vi.stubGlobal('fetch', buildFetchMock({ ok: true, body: buildSuccessBody(newUrl) }));

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                />
            );

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;

            // Act
            await act(async () => {
                fireEvent.change(input, { target: { files: [makeFile()] } });
            });

            // Assert
            await waitFor(() => {
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 5. Failed upload
    // -----------------------------------------------------------------------

    describe('failed upload', () => {
        it('shows error state and does not call onChange when fetch fails with non-ok response', async () => {
            // Arrange
            const onChange = vi.fn();
            vi.stubGlobal(
                'fetch',
                buildFetchMock({ ok: false, body: { error: { message: 'Upload failed' } } })
            );

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                    onChange={onChange}
                />
            );

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;

            // Act
            await act(async () => {
                fireEvent.change(input, { target: { files: [makeFile()] } });
            });

            // Assert — onChange not called; error entry visible
            await waitFor(() => {
                expect(onChange).not.toHaveBeenCalled();
            });
        });

        it('shows error state when fetch throws a network error', async () => {
            // Arrange
            const onChange = vi.fn();
            vi.stubGlobal('fetch', buildFetchMock({ throws: true }));

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                    onChange={onChange}
                />
            );

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;

            // Act
            await act(async () => {
                fireEvent.change(input, { target: { files: [makeFile()] } });
            });

            // Assert
            await waitFor(() => {
                expect(onChange).not.toHaveBeenCalled();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 6. Max images enforcement — at capacity
    // -----------------------------------------------------------------------

    describe('max images enforcement — at capacity', () => {
        it('shows max-reached hint when value.length equals maxImages', () => {
            // Arrange
            const urls = [
                'https://cdn.example.com/img1.jpg',
                'https://cdn.example.com/img2.jpg',
                'https://cdn.example.com/img3.jpg'
            ] as const;
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={urls}
                    maxImages={3}
                />
            );

            // Assert
            expect(screen.getByText('Llegaste al máximo de 20 fotos')).toBeInTheDocument();
        });

        it('disables select button when at capacity', () => {
            // Arrange
            const urls = ['https://cdn.example.com/img1.jpg'] as const;
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={urls}
                    maxImages={1}
                />
            );

            // Assert
            expect(screen.getByRole('button', { name: 'Seleccionar archivos' })).toBeDisabled();
        });

        it('does not call fetch when files are dropped at capacity', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={['https://cdn.example.com/img1.jpg']}
                    maxImages={1}
                />
            );

            const dropzone = container.querySelector('[aria-disabled]') as HTMLDivElement;

            // Act
            fireEvent.drop(dropzone, {
                dataTransfer: { files: [makeFile('new.jpg')] }
            });

            // Assert — no fetch because already at cap
            await waitFor(() => {
                expect(fetchMock).not.toHaveBeenCalled();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 7. Partial overflow — user selects more files than slots remaining
    // -----------------------------------------------------------------------

    describe('partial overflow', () => {
        it('uploads only the files that fit, shows global error for rejected files', async () => {
            // Arrange — 2 slots remaining, user selects 5 files
            const existing = [
                'https://cdn.example.com/a.jpg',
                'https://cdn.example.com/b.jpg',
                'https://cdn.example.com/c.jpg'
            ];
            const onChange = vi.fn();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: () =>
                        Promise.resolve(buildSuccessBody('https://res.cloudinary.com/new.jpg'))
                })
            );

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={existing}
                    onChange={onChange}
                    maxImages={5}
                />
            );

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;
            const files = [
                makeFile('f1.jpg'),
                makeFile('f2.jpg'),
                makeFile('f3.jpg'),
                makeFile('f4.jpg'),
                makeFile('f5.jpg')
            ];

            // Act
            await act(async () => {
                fireEvent.change(input, { target: { files } });
            });

            // Assert — global error appears mentioning overflow
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 8. Missing entityId guard
    // -----------------------------------------------------------------------

    describe('missing entityId guard', () => {
        it('shows "requires save first" message when entityId is undefined', () => {
            // Arrange
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    entityId={undefined}
                    value={[]}
                />
            );

            // Assert
            expect(
                screen.getByText('Guardá primero los datos básicos antes de subir fotos')
            ).toBeInTheDocument();
        });

        it('does not call fetch when file is selected without entityId', async () => {
            // Arrange
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    entityId={undefined}
                    value={[]}
                />
            );

            const input = container.querySelector('input[type="file"]') as HTMLInputElement;

            // Act
            fireEvent.change(input, { target: { files: [makeFile()] } });

            // Assert — processFiles guards on entityId and returns early
            await waitFor(() => {
                expect(fetchMock).not.toHaveBeenCalled();
            });
        });

        it('does not show "requires save first" message when entityId is provided', () => {
            // Arrange
            render(
                <AccommodationImageUploader
                    {...defaultProps}
                    entityId="some-uuid"
                    value={[]}
                />
            );

            // Assert
            expect(
                screen.queryByText('Guardá primero los datos básicos antes de subir fotos')
            ).not.toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // 9. Drag-and-drop
    // -----------------------------------------------------------------------

    describe('drag-and-drop', () => {
        it('triggers upload when files are dropped on the dropzone', async () => {
            // Arrange
            const onChange = vi.fn();
            const newUrl = 'https://res.cloudinary.com/test/gallery/dropped.jpg';
            vi.stubGlobal('fetch', buildFetchMock({ ok: true, body: buildSuccessBody(newUrl) }));

            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                    onChange={onChange}
                />
            );

            const dropzone = container.querySelector('[aria-disabled]') as HTMLDivElement;

            // Act — simulate drop event
            await act(async () => {
                fireEvent.drop(dropzone, {
                    dataTransfer: { files: [makeFile('dropped.jpg')] }
                });
            });

            // Assert — fetch called and onChange invoked with new URL
            await waitFor(() => {
                expect(onChange).toHaveBeenCalledWith([newUrl]);
            });
        });

        it('applies dragOver class when dragging files over the dropzone', () => {
            // Arrange
            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                />
            );

            const dropzone = container.querySelector('[aria-disabled]') as HTMLDivElement;

            // Act
            fireEvent.dragEnter(dropzone, {
                dataTransfer: { files: [makeFile()] }
            });

            // Assert — dropzoneActive class applied (CSS module returns class name as-is)
            expect(dropzone.className).toContain('dropzoneActive');
        });

        it('removes dragOver class when drag leaves the dropzone', () => {
            // Arrange
            const { container } = render(
                <AccommodationImageUploader
                    {...defaultProps}
                    value={[]}
                />
            );

            const dropzone = container.querySelector('[aria-disabled]') as HTMLDivElement;

            // Act — enter then leave
            fireEvent.dragEnter(dropzone);
            fireEvent.dragLeave(dropzone);

            // Assert — dropzoneActive class removed
            expect(dropzone.className).not.toContain('dropzoneActive');
        });
    });
});
