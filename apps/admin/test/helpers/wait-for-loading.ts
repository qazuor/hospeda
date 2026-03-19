/// <reference types="vitest/globals" />
import { waitFor } from '@testing-library/react';

/**
 * Waits for loading indicators to disappear.
 * Checks for skeleton components, pulse animations, and loading roles.
 * Times out after 5 seconds if loading indicators persist.
 */
export async function waitForLoadingToFinish(): Promise<void> {
    await waitFor(
        () => {
            const skeletons = document.querySelectorAll(
                '[data-loading="true"], .animate-pulse, [role="status"][aria-label*="loading"]'
            );
            expect(skeletons.length).toBe(0);
        },
        { timeout: 5000 }
    );
}
