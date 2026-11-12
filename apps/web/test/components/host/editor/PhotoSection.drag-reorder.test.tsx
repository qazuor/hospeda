/**
 * @file PhotoSection.drag-reorder.test.tsx
 * @description HOS-2126 (drag-and-drop gallery reorder) and HOS-904 (gallery
 * order after changing the cover) for the accommodation photo editor.
 *
 * Covers:
 * - Keyboard drag (focus handle, Space, ArrowRight, Space) persists the new
 *   order through `reorderMedia` with the cover id first
 * - The drag is optimistic: the new order shows before the server answers,
 *   and is rolled back with an error toast when the server rejects it
 * - Escape cancels a keyboard drag without any request
 * - The cover is never draggable (it has no handle)
 * - The move-up/move-down buttons still reorder, through the same path
 * - Screen-reader instructions/announcements come from i18n
 * - HOS-904: after promoting a gallery photo, the gallery shows the order the
 *   server SAVED (re-read via `listMedia`), not a locally invented one
 *
 * jsdom has no layout, so every sortable node reports a zero rect and the
 * keyboard sensor cannot find a neighbour. `getBoundingClientRect` is stubbed
 * to lay `[data-sortable-id]` nodes out on one row, 200px apart, in DOM order.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotoSection } from '@/components/host/editor/PhotoSection.client';

const {
    mockListMedia,
    mockAddMedia,
    mockAddFeaturedMedia,
    mockRemoveMedia,
    mockSetFeaturedMedia,
    mockReorderMedia,
    mockUpdateMedia,
    mockAddToast
} = vi.hoisted(() => ({
    mockListMedia: vi.fn(),
    mockAddMedia: vi.fn(),
    mockAddFeaturedMedia: vi.fn(),
    mockRemoveMedia: vi.fn(),
    mockSetFeaturedMedia: vi.fn(),
    mockReorderMedia: vi.fn(),
    mockUpdateMedia: vi.fn(),
    mockAddToast: vi.fn()
}));

vi.mock('@/lib/forms/leave-warning-registry', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/forms/leave-warning-registry')>()),
    requestLeaveWarning: vi.fn().mockResolvedValue(true)
}));

const MOCK_TRANSLATIONS: Record<string, string> = {
    'host.properties.editor.photo.galleryAlt': 'Foto {{index}}'
};

vi.mock('@/lib/i18n', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/i18n')>()),
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw = MOCK_TRANSLATIONS[key] ?? fallback ?? key;
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
                raw
            );
        },
        tPlural: (key: string) => key
    })
}));

vi.mock('@/components/host/editor/PhotoSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationMediaApi: {
        listMedia: mockListMedia,
        addMedia: mockAddMedia,
        addFeaturedMedia: mockAddFeaturedMedia,
        removeMedia: mockRemoveMedia,
        setFeaturedMedia: mockSetFeaturedMedia,
        reorderMedia: mockReorderMedia,
        updateMedia: mockUpdateMedia
    },
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true }) }
}));

vi.mock('@/lib/media/upload-entity', () => ({ uploadEntityImage: vi.fn() }));
vi.mock('@/store/toast-store', () => ({ addToast: mockAddToast }));

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: () => false,
        limit: () => 50,
        draftLimit: () => 0,
        plan: null,
        isLoading: false,
        error: null
    })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACC_ID = 'acc-uuid-123';

function row(id: string, sortOrder: number, isFeatured = false) {
    return {
        id,
        url: `https://cdn.example.com/${id}.jpg`,
        publicId: `hospeda/${id}`,
        isFeatured,
        sortOrder,
        state: 'visible' as const,
        moderationState: 'APPROVED'
    };
}

const COVER = row('cover', 0, true);
const A = row('a', 1);
const B = row('b', 2);
const C = row('c', 3);

function listOk(rows: readonly ReturnType<typeof row>[]) {
    return Promise.resolve({ ok: true as const, data: { media: rows } });
}

/** Gallery image srcs in DOM order (the cover renders before the gallery). */
function galleryIds(): string[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-sortable-id]')).map(
        (el) => el.dataset.sortableId ?? ''
    );
}

async function renderHydrated(rows: readonly ReturnType<typeof row>[]) {
    mockListMedia.mockReturnValueOnce(listOk(rows));
    render(
        <PhotoSection
            locale="es"
            accommodationId={ACC_ID}
        />
    );
    const galleryCount = rows.filter((r) => !r.isFeatured).length;
    await waitFor(() => expect(galleryIds()).toHaveLength(galleryCount));
    await waitFor(() =>
        expect(screen.getByLabelText('Arrastrar foto 1 para cambiar su orden')).not.toBeDisabled()
    );
}

/**
 * Press one key on the handle and let a macrotask pass. dnd-kit's keyboard
 * sensor registers its move/drop listener in a `setTimeout` after pick-up, so
 * a keystroke fired in the same tick would never reach it.
 */
async function press(handle: HTMLElement, key: string) {
    await act(async () => {
        fireEvent.keyDown(handle, { key: key === 'Space' ? ' ' : key, code: key });
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

/** Keyboard drag: focus the handle, pick up, press `key` `steps` times, drop. */
async function keyboardDrag(handle: HTMLElement, key: 'ArrowRight' | 'ArrowLeft', steps: number) {
    handle.focus();
    await press(handle, 'Space');
    for (let i = 0; i < steps; i++) {
        await press(handle, key);
    }
    await press(handle, 'Space');
}

// ---------------------------------------------------------------------------
// Layout stub
// ---------------------------------------------------------------------------

const originalGetRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
    vi.clearAllMocks();
    mockListMedia.mockReturnValue(listOk([]));
    Element.prototype.getBoundingClientRect = function getRect(this: Element) {
        const sortable = this.closest<HTMLElement>('[data-sortable-id]');
        if (!sortable) return originalGetRect.call(this);
        const nodes = Array.from(document.querySelectorAll('[data-sortable-id]'));
        const left = nodes.indexOf(sortable) * 200;
        return {
            x: left,
            y: 0,
            left,
            top: 0,
            right: left + 150,
            bottom: 150,
            width: 150,
            height: 150,
            toJSON: () => ({})
        } as DOMRect;
    };
});

afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetRect;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PhotoSection — drag-and-drop reorder (HOS-2126)', () => {
    it('persists a keyboard drag with the cover id first', async () => {
        // Arrange
        await renderHydrated([COVER, A, B, C]);
        mockReorderMedia.mockReturnValueOnce(listOk([COVER, row('b', 1), row('a', 2), C]));

        // Act — pick up photo 1 (a), move one slot right, drop.
        await keyboardDrag(
            screen.getByLabelText('Arrastrar foto 1 para cambiar su orden'),
            'ArrowRight',
            1
        );

        // Assert
        await waitFor(() =>
            expect(mockReorderMedia).toHaveBeenCalledWith({
                id: ACC_ID,
                orderedIds: ['cover', 'b', 'a', 'c']
            })
        );
        await waitFor(() => expect(galleryIds()).toEqual(['b', 'a', 'c']));
        expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('shows the new order before the server answers (optimistic)', async () => {
        // Arrange — a reorder that never settles during the assertion.
        await renderHydrated([COVER, A, B]);
        mockReorderMedia.mockReturnValueOnce(new Promise(() => undefined));

        // Act
        await keyboardDrag(
            screen.getByLabelText('Arrastrar foto 1 para cambiar su orden'),
            'ArrowRight',
            1
        );

        // Assert
        await waitFor(() => expect(galleryIds()).toEqual(['b', 'a']));
        expect(mockReorderMedia).toHaveBeenCalledTimes(1);
    });

    it('rolls back to the previous order and toasts when the server rejects the drag', async () => {
        // Arrange
        await renderHydrated([COVER, A, B, C]);
        mockReorderMedia.mockReturnValueOnce(
            Promise.resolve({ ok: false as const, error: { message: 'reorder failed', code: 'X' } })
        );

        // Act
        await keyboardDrag(
            screen.getByLabelText('Arrastrar foto 1 para cambiar su orden'),
            'ArrowRight',
            2
        );

        // Assert
        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith({ type: 'error', message: 'reorder failed' })
        );
        expect(mockReorderMedia).toHaveBeenCalledWith({
            id: ACC_ID,
            orderedIds: ['cover', 'b', 'c', 'a']
        });
        expect(galleryIds()).toEqual(['a', 'b', 'c']);
    });

    it('cancels a keyboard drag with Escape and sends nothing', async () => {
        // Arrange
        await renderHydrated([COVER, A, B]);
        const handle = screen.getByLabelText('Arrastrar foto 1 para cambiar su orden');

        // Act
        handle.focus();
        await press(handle, 'Space');
        await press(handle, 'ArrowRight');
        await press(handle, 'Escape');

        // Assert
        expect(mockReorderMedia).not.toHaveBeenCalled();
        expect(galleryIds()).toEqual(['a', 'b']);
    });

    it('does not make the cover draggable', async () => {
        // Arrange / Act
        await renderHydrated([COVER, A, B]);

        // Assert — one handle per gallery photo, none for the cover.
        expect(screen.getAllByLabelText(/^Arrastrar foto \d+ para cambiar su orden$/)).toHaveLength(
            2
        );
        expect(galleryIds()).not.toContain('cover');
    });

    it('wires the Spanish screen-reader instructions to the handle', async () => {
        // Arrange / Act
        await renderHydrated([COVER, A, B]);
        const handle = screen.getByLabelText('Arrastrar foto 1 para cambiar su orden');

        // Assert
        const describedBy = handle.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        const instructions = document.getElementById(describedBy ?? '');
        expect(instructions?.textContent).toContain('presioná espacio o enter para tomar la foto');
        expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
    });

    it('still reorders with the move-down button, optimistically', async () => {
        // Arrange
        await renderHydrated([COVER, A, B]);
        mockReorderMedia.mockReturnValueOnce(new Promise(() => undefined));

        // Act
        fireEvent.click(screen.getByLabelText('Mover foto 1 hacia abajo'));

        // Assert
        await waitFor(() => expect(galleryIds()).toEqual(['b', 'a']));
        expect(mockReorderMedia).toHaveBeenCalledWith({
            id: ACC_ID,
            orderedIds: ['cover', 'b', 'a']
        });
    });
});

describe('PhotoSection — gallery order after changing the cover (HOS-904)', () => {
    it('shows the SAVED gallery order after promoting a photo, not a locally appended one', async () => {
        // Arrange — the server keeps the demoted cover at its own sortOrder
        // (0), so after the promotion it is the FIRST gallery photo.
        await renderHydrated([COVER, A, B, C]);
        const promotedB = { ...B, isFeatured: true };
        mockSetFeaturedMedia.mockReturnValueOnce(
            Promise.resolve({ ok: true as const, data: { media: promotedB } })
        );
        mockListMedia.mockReturnValueOnce(
            listOk([{ ...COVER, isFeatured: false }, A, promotedB, C])
        );

        // Act — promote photo 2 (b).
        fireEvent.click(screen.getByLabelText('Usar foto 2 como portada'));

        // Assert
        await waitFor(() =>
            expect(screen.getByAltText('Imagen principal')).toHaveAttribute('src', promotedB.url)
        );
        await waitFor(() => expect(galleryIds()).toEqual(['cover', 'a', 'c']));
        expect(mockListMedia).toHaveBeenCalledTimes(2);
    });

    it('keeps the cover change when the re-read fails', async () => {
        // Arrange
        await renderHydrated([COVER, A, B]);
        const promotedA = { ...A, isFeatured: true };
        mockSetFeaturedMedia.mockReturnValueOnce(
            Promise.resolve({ ok: true as const, data: { media: promotedA } })
        );
        mockListMedia.mockReturnValueOnce(Promise.reject(new Error('network')));

        // Act
        fireEvent.click(screen.getByLabelText('Usar foto 1 como portada'));

        // Assert
        await waitFor(() =>
            expect(screen.getByAltText('Imagen principal')).toHaveAttribute('src', promotedA.url)
        );
        const gallery = document.querySelectorAll('[data-sortable-id]');
        expect(gallery).toHaveLength(2);
        expect(within(gallery[0] as HTMLElement).getByRole('img')).toHaveAttribute('src', B.url);
    });
});
