/**
 * @file theme.test.ts
 * @description Unit tests for the single theme module (HOS-1966 / HOS-1969).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    applyThemeAttribute,
    applyThemeChoice,
    DEFAULT_THEME_CHOICE,
    isThemeChoice,
    markThemeSynced,
    readStoredThemeChoice,
    resolveIsDark,
    resolveSignedInThemeChoice,
    syncSavedThemeChoice,
    THEME_STORAGE_KEY,
    THEME_SYNC_MARKER_KEY
} from '../../src/lib/theme';

function mockSystemDark(matches: boolean): void {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark') ? matches : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    })) as unknown as typeof window.matchMedia;
}

describe('theme module', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        mockSystemDark(false);
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        vi.restoreAllMocks();
    });

    describe('isThemeChoice', () => {
        it.each(['light', 'dark', 'system'])('accepts %s', (value) => {
            expect(isThemeChoice(value)).toBe(true);
        });

        it.each([null, undefined, '', 'Dark', 'auto', 1])('rejects %s', (value) => {
            expect(isThemeChoice(value)).toBe(false);
        });
    });

    describe('readStoredThemeChoice', () => {
        it('defaults to light when nothing is stored', () => {
            expect(readStoredThemeChoice()).toBe(DEFAULT_THEME_CHOICE);
            expect(DEFAULT_THEME_CHOICE).toBe('light');
        });

        it('returns each valid stored value', () => {
            for (const choice of ['light', 'dark', 'system'] as const) {
                localStorage.setItem(THEME_STORAGE_KEY, choice);
                expect(readStoredThemeChoice()).toBe(choice);
            }
        });

        it('falls back to light on garbage', () => {
            localStorage.setItem(THEME_STORAGE_KEY, 'purple');
            expect(readStoredThemeChoice()).toBe('light');
        });

        it('falls back to light when storage throws', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            expect(readStoredThemeChoice()).toBe('light');
        });
    });

    describe('resolveIsDark', () => {
        it('is dark only for dark, or system on a dark OS', () => {
            expect(resolveIsDark({ choice: 'dark', systemPrefersDark: false })).toBe(true);
            expect(resolveIsDark({ choice: 'light', systemPrefersDark: true })).toBe(false);
            expect(resolveIsDark({ choice: 'system', systemPrefersDark: true })).toBe(true);
            expect(resolveIsDark({ choice: 'system', systemPrefersDark: false })).toBe(false);
        });
    });

    describe('applyThemeAttribute', () => {
        it('sets data-theme=dark and removes it for light, without persisting', () => {
            applyThemeAttribute({ choice: 'dark' });
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            applyThemeAttribute({ choice: 'light' });
            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
        });

        it('never writes data-theme="light" (light is the absence of the attribute)', () => {
            applyThemeAttribute({ choice: 'light' });
            expect(document.documentElement.getAttribute('data-theme')).toBeNull();
        });

        it('resolves system against the OS', () => {
            mockSystemDark(true);
            applyThemeAttribute({ choice: 'system' });
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });
    });

    describe('applyThemeChoice', () => {
        it('applies and persists the user choice', () => {
            applyThemeChoice({ choice: 'dark' });
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        });

        it('still applies when storage throws', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            applyThemeChoice({ choice: 'dark' });
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });
    });
});

describe('saved profile theme (HOS-1966)', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-theme');
        mockSystemDark(false);
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
    });

    describe('resolveSignedInThemeChoice', () => {
        it('saved preference beats the local choice', () => {
            expect(
                resolveSignedInThemeChoice({
                    savedChoice: 'dark',
                    localChoice: 'light',
                    alreadySynced: false
                })
            ).toEqual({ choice: 'dark', fromSaved: true });
        });

        it('falls back to the local choice when nothing valid was saved', () => {
            for (const savedChoice of [undefined, null, 'purple']) {
                expect(
                    resolveSignedInThemeChoice({
                        savedChoice,
                        localChoice: 'system',
                        alreadySynced: false
                    })
                ).toEqual({ choice: 'system', fromSaved: false });
            }
        });

        it('keeps the local choice once the session is synced', () => {
            expect(
                resolveSignedInThemeChoice({
                    savedChoice: 'dark',
                    localChoice: 'light',
                    alreadySynced: true
                })
            ).toEqual({ choice: 'light', fromSaved: false });
        });
    });

    describe('syncSavedThemeChoice', () => {
        it('applies and stores the saved theme over a different local one', () => {
            localStorage.setItem(THEME_STORAGE_KEY, 'light');
            expect(syncSavedThemeChoice({ userId: 'u1', savedChoice: 'dark' })).toBe(true);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
            expect(sessionStorage.getItem(THEME_SYNC_MARKER_KEY)).toBe('u1');
        });

        it('does not snap back after a signed-in toggle', () => {
            // Saved was light; the user toggles to dark and PATCH is still in flight.
            applyThemeChoice({ choice: 'dark' });
            markThemeSynced({ userId: 'u1' });
            expect(syncSavedThemeChoice({ userId: 'u1', savedChoice: 'light' })).toBe(false);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('applies the saved theme only once per session', () => {
            expect(syncSavedThemeChoice({ userId: 'u1', savedChoice: 'dark' })).toBe(true);
            applyThemeChoice({ choice: 'light' });
            expect(syncSavedThemeChoice({ userId: 'u1', savedChoice: 'dark' })).toBe(false);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        });

        it('a guest toggle before login does not block the saved theme', () => {
            applyThemeChoice({ choice: 'light' }); // guest gesture: no marker
            expect(syncSavedThemeChoice({ userId: 'u1', savedChoice: 'dark' })).toBe(true);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
        });

        it('a different user in the same tab gets their own saved theme', () => {
            syncSavedThemeChoice({ userId: 'u1', savedChoice: 'dark' });
            expect(syncSavedThemeChoice({ userId: 'u2', savedChoice: 'light' })).toBe(true);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        });

        it('keeps the current behaviour when the user never saved one', () => {
            localStorage.setItem(THEME_STORAGE_KEY, 'dark');
            expect(syncSavedThemeChoice({ userId: 'u1', savedChoice: undefined })).toBe(false);
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
            expect(readStoredThemeChoice()).toBe('dark');
        });

        it('logged-out behaviour is untouched: the module never reads a saved value', () => {
            expect(readStoredThemeChoice()).toBe(DEFAULT_THEME_CHOICE);
            applyThemeChoice({ choice: 'dark' });
            expect(readStoredThemeChoice()).toBe('dark');
            expect(sessionStorage.getItem(THEME_SYNC_MARKER_KEY)).toBeNull();
        });
    });
});
