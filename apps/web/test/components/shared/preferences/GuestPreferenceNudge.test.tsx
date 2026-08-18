/**
 * @file GuestPreferenceNudge.test.tsx
 * @description Tests the contextual registration nudge.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestPreferenceNudge } from '../../../../src/components/shared/preferences/GuestPreferenceNudge.client';
import { clearToasts, getToasts } from '../../../../src/store/toast-store';

function dispatchPreferenceChange(detail: { kind: 'theme' | 'locale'; value: string }) {
    window.dispatchEvent(new CustomEvent('preferences:change', { detail }));
}

function setAuthState(authenticated: boolean) {
    document.documentElement.setAttribute(
        'data-user-authenticated',
        authenticated ? 'true' : 'false'
    );
}

describe('GuestPreferenceNudge', () => {
    beforeEach(() => {
        clearToasts();
        sessionStorage.clear();
        // Mirrors what every layout emits since HOS-585 G-5: a REGIONAL `lang`
        // for search engines and the bare locale in `data-locale`. Setting only
        // `lang` here would let the CTA assertions below pass on the code's
        // 'es' fallback rather than on the attribute they claim to read.
        document.documentElement.setAttribute('lang', 'es-AR');
        document.documentElement.setAttribute('data-locale', 'es');
        setAuthState(false);
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        clearToasts();
        sessionStorage.clear();
        vi.useRealTimers();
    });

    it('renders nothing', () => {
        const { container } = render(<GuestPreferenceNudge />);
        expect(container.firstChild).toBeNull();
    });

    it('shows a toast on the first preference change', () => {
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        expect(getToasts()).toHaveLength(1);
    });

    it('first toast is the cross-device message', () => {
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'locale', value: 'en' });
        expect(getToasts()[0]?.message).toMatch(/preferencias te seguirán/i);
    });

    it('does not show a toast for authenticated visitors', () => {
        setAuthState(true);
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        expect(getToasts()).toHaveLength(0);
    });

    it('throttles subsequent toasts within 8 seconds', () => {
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        dispatchPreferenceChange({ kind: 'theme', value: 'light' });
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        expect(getToasts()).toHaveLength(1);
    });

    it('shows another toast after the throttle window expires', () => {
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        // First toast auto-dismisses at 6s; throttle is 8s. Move past 8s.
        vi.advanceTimersByTime(9000);
        dispatchPreferenceChange({ kind: 'theme', value: 'light' });
        // The first one is gone, the second one is in the queue.
        expect(getToasts()).toHaveLength(1);
    });

    it('attaches a primary "Iniciar sesión" CTA pointing to /{lang}/auth/signup/', () => {
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        const toast = getToasts()[0];
        expect(toast?.action?.label).toMatch(/iniciar sesión/i);
        expect(toast?.action?.href).toBe('/es/auth/signup/');
    });

    it('attaches a secondary "Ver todas las ventajas" CTA pointing to /{lang}/beneficios/', () => {
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'locale', value: 'pt' });
        const toast = getToasts()[0];
        expect(toast?.secondaryAction?.label).toMatch(/ver todas las ventajas/i);
        expect(toast?.secondaryAction?.href).toBe('/es/beneficios/');
    });

    it('honors the data-locale attribute on <html> for CTA URLs', () => {
        document.documentElement.setAttribute('data-locale', 'en');
        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });
        const toast = getToasts()[0];
        expect(toast?.action?.href).toBe('/en/auth/signup/');
        expect(toast?.secondaryAction?.href).toBe('/en/beneficios/');
    });

    it('ignores the regional lang attribute, which is not a route segment', () => {
        // HOS-585 G-5 moved `<html lang>` to a regional BCP-47 tag for Bing.
        // Reading it here would produce `/es-AR/auth/signup/`, which 404s. This
        // test is the one that caught the regression while it was being made.
        document.documentElement.setAttribute('lang', 'en-US');
        document.documentElement.setAttribute('data-locale', 'en');

        render(<GuestPreferenceNudge />);
        dispatchPreferenceChange({ kind: 'theme', value: 'dark' });

        const toast = getToasts()[0];
        expect(toast?.action?.href).toBe('/en/auth/signup/');
        expect(toast?.action?.href).not.toContain('en-US');
    });
});
