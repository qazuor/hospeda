/**
 * @file TourController.lifecycle.test.tsx
 * @description HOS-1856: the tour must survive the state updates that happen
 * right after `drive()`, and the driver must only die with `onDestroyStarted`
 * or on unmount.
 *
 * Before the fix, `setIsRunning(true)` / `setShouldStart(false)` changed the
 * start effect's dependencies, React ran that effect's cleanup, and the
 * cleanup destroyed the driver while the popover was still opening.
 */

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TourController } from '@/components/account/TourController.client';

const { driverMock, driveMock, destroyMock } = vi.hoisted(() => {
    const drive = vi.fn();
    const destroy = vi.fn();
    const hasNextStep = vi.fn(() => true);
    const driver = vi.fn((_config: { readonly steps?: readonly unknown[] }) => ({
        drive,
        destroy,
        hasNextStep
    }));

    return { driverMock: driver, driveMock: drive, destroyMock: destroy };
});

vi.mock('@/lib/load-driver', () => ({ driver: driverMock }));

vi.mock('@/hooks/use-tour-state', () => ({
    useTourState: () => ({
        isLoading: false,
        error: null,
        hasSeen: () => false,
        markSeen: vi.fn()
    })
}));

describe('TourController — driver lifecycle (HOS-1856)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <a data-tour="comercio-listings"></a>
            <div data-tour="listings"></div>
            <div data-tour="listing-views"></div>
        `;
    });

    afterEach(() => {
        cleanup();
        document.body.innerHTML = '';
    });

    it('keeps the driver alive after it starts and destroys it on unmount', async () => {
        const { unmount } = render(
            <TourController
                locale="es"
                userRoles={['VENUE_OWNER']}
            />
        );

        await waitFor(() => expect(driveMock).toHaveBeenCalledTimes(1));

        // The bug: the post-`drive()` state updates re-ran the start effect and
        // its cleanup destroyed the driver immediately.
        expect(destroyMock).not.toHaveBeenCalled();

        unmount();

        expect(destroyMock).toHaveBeenCalledTimes(1);
    });
});
