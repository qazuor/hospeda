/**
 * @file posthog-client.test.ts
 * @description Unit tests for the `trackEvent` wrapper (SPEC-140 — fix B).
 *
 * Initialisation lives entirely in `PostHogScript.astro` now, so this file
 * only covers the runtime contract of the wrapper:
 *  - SSR safe (no-op when `window` is undefined).
 *  - No-op when `window.posthog` is undefined (key unset / dev mode / SDK
 *    not yet stubbed).
 *  - Forwards `name` and `props` verbatim to `window.posthog.capture(...)`
 *    when the stub is present.
 */

import { trackEvent } from '@/lib/analytics/posthog-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    // Reset window.posthog between tests so cross-test state doesn't leak.
    (window as unknown as { posthog?: unknown }).posthog = undefined;
    vi.restoreAllMocks();
});

describe('trackEvent (SPEC-140 — fix B)', () => {
    it('should no-op when window.posthog is undefined', () => {
        // Arrange — no posthog stub on window. Act / Assert (no throw).
        expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
    });

    it('should call window.posthog.capture(name, props) when stub is present', () => {
        // Arrange
        const captureSpy = vi.fn();
        (window as unknown as { posthog: { capture: typeof captureSpy } }).posthog = {
            capture: captureSpy
        };

        // Act
        trackEvent('accommodation_viewed', { slug: 'mi-cabaña' });

        // Assert
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy).toHaveBeenCalledWith('accommodation_viewed', {
            slug: 'mi-cabaña'
        });
    });

    it('should call window.posthog.capture without props when none provided', () => {
        // Arrange
        const captureSpy = vi.fn();
        (window as unknown as { posthog: { capture: typeof captureSpy } }).posthog = {
            capture: captureSpy
        };

        // Act
        trackEvent('newsletter_subscribed');

        // Assert
        expect(captureSpy).toHaveBeenCalledWith('newsletter_subscribed', undefined);
    });
});
