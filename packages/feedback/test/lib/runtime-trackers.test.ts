/**
 * Tests for runtime-trackers module (navigation history + last interactions).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    getLastInteractions,
    getNavigationHistory,
    installRuntimeTrackers,
    resetRuntimeTrackers,
    uninstallRuntimeTrackers
} from '../../src/lib/runtime-trackers.js';

describe('runtime-trackers', () => {
    beforeEach(() => {
        resetRuntimeTrackers();
        // Make sure we start fresh
        uninstallRuntimeTrackers();

        // Reset URL to a known state for jsdom
        window.history.replaceState({}, '', '/start');
    });

    afterEach(() => {
        uninstallRuntimeTrackers();
        resetRuntimeTrackers();
    });

    describe('navigation history', () => {
        it('should record pushState navigations', () => {
            installRuntimeTrackers();

            window.history.pushState({}, '', '/page-a');
            window.history.pushState({}, '', '/page-b');

            const history = getNavigationHistory();
            expect(history).toBeDefined();
            expect(history?.[history.length - 1]).toBe('/page-b');
            expect(history).toContain('/page-a');
        });

        it('should record replaceState navigations', () => {
            installRuntimeTrackers();

            window.history.replaceState({}, '', '/replaced');

            const history = getNavigationHistory();
            expect(history?.[history.length - 1]).toBe('/replaced');
        });

        it('should cap the buffer at 10 entries', () => {
            installRuntimeTrackers();

            for (let i = 0; i < 20; i++) {
                window.history.pushState({}, '', `/p${i}`);
            }

            const history = getNavigationHistory();
            expect(history).toBeDefined();
            expect((history ?? []).length).toBeLessThanOrEqual(10);
            // Most recent should be the last one we pushed
            expect(history?.[history.length - 1]).toBe('/p19');
        });

        it('should skip consecutive duplicates', () => {
            installRuntimeTrackers();

            window.history.pushState({}, '', '/dupe');
            window.history.pushState({}, '', '/dupe');
            window.history.pushState({}, '', '/dupe');

            const history = getNavigationHistory();
            // Either 1 entry or, with the seed, the seed + 1 — but no 3 dupes
            const occurrences = (history ?? []).filter((u) => u === '/dupe').length;
            expect(occurrences).toBe(1);
        });

        it('should be idempotent on multiple installRuntimeTrackers calls', () => {
            installRuntimeTrackers();
            installRuntimeTrackers();
            installRuntimeTrackers();

            window.history.pushState({}, '', '/once');

            const history = getNavigationHistory();
            const occurrences = (history ?? []).filter((u) => u === '/once').length;
            // Re-installation must not duplicate the listener
            expect(occurrences).toBe(1);
        });
    });

    describe('last interactions', () => {
        it('should record click target as a structural interaction', () => {
            installRuntimeTrackers();

            const button = document.createElement('button');
            button.id = 'submit-btn';
            button.textContent = 'Should NOT appear in interactions';
            document.body.appendChild(button);

            button.click();

            const interactions = getLastInteractions();
            expect(interactions).toBeDefined();
            expect(interactions?.length).toBe(1);
            expect(interactions?.[0]?.type).toBe('BUTTON');
            expect(interactions?.[0]?.selector).toBe('#submit-btn');
            // Privacy: textContent must NOT leak into the buffer
            const stringified = JSON.stringify(interactions);
            expect(stringified).not.toContain('Should NOT appear');

            document.body.removeChild(button);
        });

        it('should never include input values in recorded interactions', () => {
            installRuntimeTrackers();

            const input = document.createElement('input');
            input.type = 'text';
            input.value = 'super-secret-value';
            input.className = 'login-field';
            document.body.appendChild(input);

            input.click();

            const interactions = getLastInteractions();
            const stringified = JSON.stringify(interactions);
            expect(stringified).not.toContain('super-secret-value');

            document.body.removeChild(input);
        });

        it('should cap interactions buffer at 5 entries', () => {
            installRuntimeTrackers();

            for (let i = 0; i < 10; i++) {
                const el = document.createElement('button');
                el.id = `b${i}`;
                document.body.appendChild(el);
                el.click();
                document.body.removeChild(el);
            }

            const interactions = getLastInteractions();
            expect((interactions ?? []).length).toBeLessThanOrEqual(5);
            expect(interactions?.[interactions.length - 1]?.selector).toBe('#b9');
        });

        it('should skip clicks originating inside the feedback widget', () => {
            installRuntimeTrackers();

            const root = document.createElement('div');
            root.setAttribute('data-feedback-root', '');
            const inner = document.createElement('button');
            inner.id = 'inside-fab';
            root.appendChild(inner);
            document.body.appendChild(root);

            inner.click();

            const interactions = getLastInteractions();
            expect(interactions).toBeUndefined();

            document.body.removeChild(root);
        });
    });
});
