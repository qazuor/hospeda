/**
 * @file CollectionUsageMeter.test.tsx
 * @description Unit tests for the CollectionUsageMeter React island (HOS-999).
 *
 * Covers:
 * - Renders nothing when `initial` is null (HOS-899 entitlement gate / SSR
 *   fetch failure) and never fetches on its own to find out
 * - Renders the "X / max" label + progress bar when `initial` is provided
 *   (SSR-first: seeded straight from the prop, no placeholder flash)
 * - Bumps the counter after a `hospeda:collection-created` event
 * - Hides itself if a post-event refetch answers 403 ENTITLEMENT_REQUIRED
 * - Cleans up its event listener on unmount
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionUsageMeter } from '../../../src/components/account/CollectionUsageMeter.client';
import { COLLECTION_CREATED_EVENT } from '../../../src/components/account/collection-created-event';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/CollectionUsageMeter.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    return { createT: (_locale: string) => tFromCatalog };
});

const listMock = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarkCollectionsApi: {
        list: (...args: unknown[]) => listMock(...args)
    }
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionUsageMeter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when initial is null and never fetches on its own', () => {
        // Arrange + Act
        const { container } = render(
            <CollectionUsageMeter
                locale="es"
                initial={null}
            />
        );

        // Assert
        expect(container).toBeEmptyDOMElement();
        expect(listMock).not.toHaveBeenCalled();
    });

    it('renders the usage label and progress bar seeded from `initial`', () => {
        // Arrange + Act
        render(
            <CollectionUsageMeter
                locale="es"
                initial={{ current: 3, max: 25 }}
            />
        );

        // Assert — seeded straight from the prop, no "0 / 25" flash.
        expect(screen.getByText('3 de 25 colecciones usadas')).toBeInTheDocument();
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '3');
        expect(bar).toHaveAttribute('aria-valuemax', '25');
    });

    it('bumps the counter after a hospeda:collection-created event', async () => {
        // Arrange
        listMock.mockResolvedValue({ ok: true, data: { usage: { current: 4, max: 25 } } });
        render(
            <CollectionUsageMeter
                locale="es"
                initial={{ current: 3, max: 25 }}
            />
        );
        expect(screen.getByText('3 de 25 colecciones usadas')).toBeInTheDocument();

        // Act
        fireEvent(
            window,
            new CustomEvent(COLLECTION_CREATED_EVENT, { detail: { id: 'c1', name: 'X' } })
        );

        // Assert
        await waitFor(() => {
            expect(screen.getByText('4 de 25 colecciones usadas')).toBeInTheDocument();
        });
        expect(listMock).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
    });

    it('hides itself (does not throw) when the post-event refetch answers 403 ENTITLEMENT_REQUIRED', async () => {
        // Arrange
        listMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'Forbidden' }
        });
        const { container } = render(
            <CollectionUsageMeter
                locale="es"
                initial={{ current: 3, max: 25 }}
            />
        );
        expect(screen.getByText('3 de 25 colecciones usadas')).toBeInTheDocument();

        // Act
        fireEvent(
            window,
            new CustomEvent(COLLECTION_CREATED_EVENT, { detail: { id: 'c1', name: 'X' } })
        );

        // Assert
        await waitFor(() => {
            expect(container).toBeEmptyDOMElement();
        });
    });

    it('keeps the last known value when the post-event refetch fails with a generic error', async () => {
        // Arrange
        listMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Boom' }
        });
        render(
            <CollectionUsageMeter
                locale="es"
                initial={{ current: 3, max: 25 }}
            />
        );

        // Act
        fireEvent(
            window,
            new CustomEvent(COLLECTION_CREATED_EVENT, { detail: { id: 'c1', name: 'X' } })
        );
        await waitFor(() => expect(listMock).toHaveBeenCalled());

        // Assert — still showing the last known value, not blanked out.
        expect(screen.getByText('3 de 25 colecciones usadas')).toBeInTheDocument();
    });

    it('removes its event listener on unmount', () => {
        // Arrange
        const addSpy = vi.spyOn(window, 'addEventListener');
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(
            <CollectionUsageMeter
                locale="es"
                initial={{ current: 3, max: 25 }}
            />
        );
        const [, registeredHandler] =
            addSpy.mock.calls.find(([eventName]) => eventName === COLLECTION_CREATED_EVENT) ?? [];
        expect(registeredHandler).toBeDefined();

        // Act
        unmount();

        // Assert
        expect(removeSpy).toHaveBeenCalledWith(COLLECTION_CREATED_EVENT, registeredHandler);

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
