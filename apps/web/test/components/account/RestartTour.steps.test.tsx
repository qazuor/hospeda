/**
 * @file RestartTour.steps.test.tsx
 * @description Regression for HOS-2448: replaying the tour from Preferences
 * pointed at elements that do not exist on that page.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RestartTour } from '@/components/account/RestartTour.client';

const { driverMock } = vi.hoisted(() => {
    const driver = vi.fn(
        (_config: {
            readonly progressText?: string;
            readonly steps?: readonly { readonly element?: unknown }[];
        }) => ({ drive: vi.fn(), destroy: vi.fn(), hasNextStep: vi.fn(() => true) })
    );
    return { driverMock: driver };
});

vi.mock('@/lib/load-driver', () => ({ driver: driverMock }));

describe('RestartTour — only steps with a destination (HOS-2448)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Preferences page: none of the dashboard anchors exist here.
        document.body.innerHTML = '';
    });

    afterEach(() => {
        cleanup();
    });

    it('hands driver.js only the steps whose anchor is on the page, with a translated counter', async () => {
        render(
            <RestartTour
                locale="es"
                userRoles={['USER']}
            />
        );

        const [button] = screen.getAllByRole('button', { name: /ver tour/i });
        fireEvent.click(button as HTMLElement);

        await waitFor(() => expect(driverMock).toHaveBeenCalledTimes(1));
        const config = driverMock.mock.calls[0]?.[0];
        for (const step of config?.steps ?? []) {
            // Every remaining step is a centre step (no `element`) since no anchor exists.
            expect(step.element).toBeUndefined();
        }
        expect(config?.progressText).toBe('Paso {{current}} de {{total}}');
    });
});
