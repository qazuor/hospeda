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

        it('should restore navigation history from sessionStorage on install', () => {
            // Simulate state previously persisted by the BaseLayout bootstrap
            // script, then install — the buffer should pick it up.
            window.sessionStorage.setItem(
                '__hospeda_feedback_nav__',
                JSON.stringify(['/landing', '/landing/details'])
            );
            installRuntimeTrackers();

            const history = getNavigationHistory();
            expect(history).toContain('/landing');
            expect(history).toContain('/landing/details');
        });

        it('should mirror new navigations to sessionStorage', () => {
            installRuntimeTrackers();

            window.history.pushState({}, '', '/persisted');

            const stored = window.sessionStorage.getItem('__hospeda_feedback_nav__');
            expect(stored).toBeTruthy();
            const parsed = JSON.parse(stored ?? '[]') as string[];
            expect(parsed[parsed.length - 1]).toBe('/persisted');
        });
    });

    describe('last interactions', () => {
        it('should record click target with visible text and DOM path', () => {
            installRuntimeTrackers();

            const button = document.createElement('button');
            button.id = 'submit-btn';
            button.textContent = 'Reservar ahora';
            document.body.appendChild(button);

            button.click();

            const interactions = getLastInteractions();
            expect(interactions).toBeDefined();
            expect(interactions?.length).toBe(1);
            const entry = interactions?.[0];
            expect(entry?.type).toBe('BUTTON');
            expect(entry?.selector).toBe('#submit-btn');
            expect(entry?.event).toBe('click');
            expect(entry?.text).toBe('Reservar ahora');
            expect(entry?.domPath).toBeDefined();

            document.body.removeChild(button);
        });

        it('should capture aria-label when present', () => {
            installRuntimeTrackers();

            const button = document.createElement('button');
            button.setAttribute('aria-label', 'Cerrar dialogo');
            button.className = 'close-btn';
            document.body.appendChild(button);

            button.click();

            const interactions = getLastInteractions();
            expect(interactions?.[0]?.ariaLabel).toBe('Cerrar dialogo');

            document.body.removeChild(button);
        });

        it('should capture same-origin href on anchor clicks', () => {
            installRuntimeTrackers();

            const a = document.createElement('a');
            a.href = '/destinos/concepcion';
            a.textContent = 'Concepcion';
            document.body.appendChild(a);

            a.click();

            const interactions = getLastInteractions();
            expect(interactions?.[0]?.href).toBe('/destinos/concepcion');

            document.body.removeChild(a);
        });

        it('should NOT capture cross-origin hrefs', () => {
            installRuntimeTrackers();

            const a = document.createElement('a');
            a.href = 'https://external.example.com/page';
            a.textContent = 'External';
            document.body.appendChild(a);

            a.click();

            const interactions = getLastInteractions();
            expect(interactions?.[0]?.href).toBeUndefined();

            document.body.removeChild(a);
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

        it('should skip clicks on password / sensitive inputs entirely', () => {
            installRuntimeTrackers();

            const pwd = document.createElement('input');
            pwd.type = 'password';
            pwd.value = 'p@ssw0rd';
            document.body.appendChild(pwd);

            pwd.click();

            expect(getLastInteractions()).toBeUndefined();
            document.body.removeChild(pwd);
        });

        it('should skip clicks inside elements marked data-feedback-skip', () => {
            installRuntimeTrackers();

            const wrap = document.createElement('div');
            wrap.setAttribute('data-feedback-skip', '');
            const inner = document.createElement('button');
            inner.id = 'private-btn';
            inner.textContent = 'Hidden';
            wrap.appendChild(inner);
            document.body.appendChild(wrap);

            inner.click();

            expect(getLastInteractions()).toBeUndefined();
            document.body.removeChild(wrap);
        });

        it('should walk up to the actionable ancestor when clicking nested children', () => {
            installRuntimeTrackers();

            const button = document.createElement('button');
            button.id = 'icon-btn';
            button.setAttribute('aria-label', 'Menu');
            const icon = document.createElement('span');
            icon.textContent = '*';
            button.appendChild(icon);
            document.body.appendChild(button);

            icon.click();

            const interactions = getLastInteractions();
            expect(interactions?.[0]?.type).toBe('BUTTON');
            expect(interactions?.[0]?.selector).toBe('#icon-btn');

            document.body.removeChild(button);
        });

        it('should record submit events on forms', () => {
            installRuntimeTrackers();

            const form = document.createElement('form');
            form.id = 'login-form';
            // Avoid actual navigation in jsdom
            form.addEventListener('submit', (e) => e.preventDefault());
            document.body.appendChild(form);

            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

            const interactions = getLastInteractions();
            expect(interactions?.[0]?.event).toBe('submit');
            expect(interactions?.[0]?.type).toBe('FORM');

            document.body.removeChild(form);
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
